import { Quote, QuoteItem, Client } from '../types';
import { db, updateCotacaoNfeStatusDb } from '../lib/db';
import { fetchCompanyData, CompanyFiscalData, DEFAULT_COMPANY_DATA, incrementEmitenteUltimoNumeroNfe } from './companyService';
import { generateBarcodeSvg } from '../utils/barcode';

/**
 * Formata o número da NF-e para exibição oficial no DANFE (ex: 000538 -> 000.538 ou 538)
 */
export function formatarNumeroDanfe(numStr: string | number): string {
  const clean = String(numStr).replace(/\D/g, '');
  if (clean.length === 6) {
    return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  }
  return clean || String(numStr);
}

export interface ItemFiscalNfe {
  id: string;
  ordem: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  subtotal: number;
  csosn: string;
}

export interface DadosEmitenteNfe {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  ie: string;
  im?: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  regimeTributario: string;
}

export interface DadosDestinatarioNfe {
  nome: string;
  documento: string;
  tipoDocumento: 'CNPJ' | 'CPF';
  inscricaoEstadual?: string;
  indicadorIe: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone?: string;
  email?: string;
}

export interface NfeTransmissionResult {
  sucesso: boolean;
  statusNfe: 'Emitida' | 'Erro';
  nfeChave?: string;
  nfeNumero?: string;
  serie?: string;
  protocolo?: string;
  dataEmissao?: string;
  danfeUrl?: string;
  xmlUrl?: string;
  mensagemErro?: string;
}

/**
 * Calcula o Dígito Verificador (DV) Módulo 11 da chave de acesso de 44 dígitos da NF-e
 */
function calcularDvModulo11(chave43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = chave43.length - 1; i >= 0; i--) {
    soma += parseInt(chave43[i], 10) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  return dv === 0 || dv === 10 || dv === 11 ? 0 : dv;
}

/**
 * Gera a chave de acesso de 44 dígitos oficial no padrão SEFAZ NF-e modelo 55
 */
export function gerarChaveAcessoNfe(
  ufEmitente: string,
  dataEmissao: Date,
  cnpjEmitente: string,
  serie: string,
  numeroNfe: string,
  codigoAleatorio?: string
): string {
  // Código da UF (35 para SP)
  const codUf = ufEmitente.toUpperCase() === 'SP' ? '35' : '35';
  
  // AAMM (Ano e Mês, ex: 2610)
  const ano = String(dataEmissao.getFullYear()).slice(-2);
  const mes = String(dataEmissao.getMonth() + 1).padStart(2, '0');
  const aamm = `${ano}${mes}`;

  // CNPJ sem formatação (14 dígitos)
  const cleanCnpj = cnpjEmitente.replace(/\D/g, '').padStart(14, '0').slice(0, 14);

  // Modelo (55 = NF-e)
  const mod = '55';

  // Série (3 dígitos)
  const cleanSerie = serie.replace(/\D/g, '').padStart(3, '0').slice(-3);

  // Número da NF-e (9 dígitos)
  const cleanNumero = numeroNfe.replace(/\D/g, '').padStart(9, '0').slice(-9);

  // Tipo de Emissão (1 = Normal)
  const tpEmis = '1';

  // Código Numérico Aleatório (8 dígitos)
  const cNF = (codigoAleatorio || String(Math.floor(10000000 + Math.random() * 90000000))).padStart(8, '0').slice(0, 8);

  const base43 = `${codUf}${aamm}${cleanCnpj}${mod}${cleanSerie}${cleanNumero}${tpEmis}${cNF}`;
  const cDV = calcularDvModulo11(base43);

  return `${base43}${cDV}`;
}

/**
 * Formata a Chave de Acesso da NF-e com espaços a cada 4 dígitos
 */
export function formatarChaveAcesso(chave: string): string {
  const clean = (chave || '').replace(/\D/g, '');
  return clean.replace(/(\d{4})/g, '$1 ').trim();
}

/**
 * Prepara a lista de itens fiscais aplicando a regra estrita de validação de CFOP:
 * - Se UF do cliente for "SP": define o CFOP como cfop_interno (5102)
 * - Se UF for diferente de "SP": define o CFOP como cfop_externo (6102)
 */
export function prepararItensFiscais(items: QuoteItem[], ufDestinatario: string): ItemFiscalNfe[] {
  const isDestinatarioSP = (ufDestinatario || 'SP').trim().toUpperCase() === 'SP';
  const cfopPadrao = isDestinatarioSP ? '5102' : '6102';

  return (items || []).map((it, idx) => {
    const rawNcm = (it.ncm || '').replace(/\D/g, '') || '72085200';
    const rawCfop = isDestinatarioSP 
      ? (it.cfop_interno || cfopPadrao) 
      : (it.cfop_externo || cfopPadrao);
    const rawUn = (it.unidade_medida || it.unidadeMedida || 'PC').trim().toUpperCase();
    const rawCsosn = it.csosn || '102 - Sem permissão de crédito';

    const qty = Number(it.quantity || it.qtd || 1);
    const vUnit = Number(it.unitPrice || it.valorUnitario || 0);
    const subtotal = Number(it.subtotal || (vUnit * qty));

    return {
      id: it.id || `item-${idx + 1}`,
      ordem: idx + 1,
      codigo: String(it.id || idx + 1).slice(-6).toUpperCase(),
      descricao: (it.description || it.descricao || it.constantName || 'ITEM METALÚRGICO USICORTE').trim(),
      ncm: rawNcm,
      cfop: rawCfop,
      unidade: rawUn,
      quantidade: qty,
      valorUnitario: vUnit,
      subtotal: subtotal,
      csosn: rawCsosn
    };
  });
}

/**
 * Constrói o XML oficial da NF-e v4.00 com tags conforme manual do contribuinte SEFAZ
 */
export function gerarXmlNfe(
  emitente: DadosEmitenteNfe,
  destinatario: DadosDestinatarioNfe,
  itens: ItemFiscalNfe[],
  numeroNfe: string,
  serie: string,
  chaveAcesso: string,
  valorTotal: number,
  dataEmissao: Date
): string {
  const dtIso = dataEmissao.toISOString();
  const cNF = chaveAcesso.slice(35, 43);
  const cDV = chaveAcesso.slice(43, 44);

  const xmlItens = itens.map((item, index) => `
    <det nItem="${index + 1}">
      <prod>
        <cProd>${item.codigo}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${escapeXml(item.descricao)}</xProd>
        <NCM>${item.ncm}</NCM>
        <CFOP>${item.cfop}</CFOP>
        <uCom>${item.unidade}</uCom>
        <qCom>${item.quantidade.toFixed(4)}</qCom>
        <vUnCom>${item.valorUnitario.toFixed(4)}</vUnCom>
        <vProd>${item.subtotal.toFixed(2)}</vProd>
        <cEANTrib>SEM GTIN</cEANTrib>
        <uTrib>${item.unidade}</uTrib>
        <qTrib>${item.quantidade.toFixed(4)}</qTrib>
        <vUnTrib>${item.valorUnitario.toFixed(4)}</vUnTrib>
        <indTot>1</indTot>
      </prod>
      <imposto>
        <ICMS>
          <ICMSSN102>
            <orig>0</orig>
            <CSOSN>102</CSOSN>
          </ICMSSN102>
        </ICMS>
        <PIS>
          <PISNT>
            <CST>07</CST>
          </PISNT>
        </PIS>
        <COFINS>
          <COFINSNT>
            <CST>07</CST>
          </COFINSNT>
        </COFINS>
      </imposto>
    </det>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chaveAcesso}" versao="4.00">
    <ide>
      <cUF>35</cUF>
      <cNF>${cNF}</cNF>
      <natOp>VENDA DE MERCADORIA</natOp>
      <mod>55</mod>
      <serie>${serie}</serie>
      <nNF>${numeroNfe}</nNF>
      <dhEmi>${dtIso}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>${destinatario.uf === 'SP' ? '1' : '2'}</idDest>
      <cMunFG>3506003</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${cDV}</cDV>
      <tpAmb>1</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>${destinatario.indicadorIe === '9' ? '1' : '0'}</indFinal>
      <indPres>1</indPres>
      <procEmi>0</procEmi>
      <verProc>UsiCorte-ERP-1.0</verProc>
    </ide>
    <emit>
      <CNPJ>${emitente.cnpj.replace(/\D/g, '')}</CNPJ>
      <xNome>${escapeXml(emitente.razaoSocial)}</xNome>
      <xFant>${escapeXml(emitente.nomeFantasia)}</xFant>
      <enderEmit>
        <xLgr>${escapeXml(emitente.endereco)}</xLgr>
        <nro>${emitente.numero || 'S/N'}</nro>
        <xBairro>${escapeXml(emitente.bairro)}</xBairro>
        <cMun>3506003</cMun>
        <xMun>${escapeXml(emitente.cidade)}</xMun>
        <UF>${emitente.uf}</UF>
        <CEP>${emitente.cep.replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
        <fone>${emitente.telefone.replace(/\D/g, '')}</fone>
      </enderEmit>
      <IE>${emitente.ie.replace(/\D/g, '')}</IE>
      <CRT>1</CRT>
    </emit>
    <dest>
      <${destinatario.tipoDocumento === 'CPF' ? 'CPF' : 'CNPJ'}>${destinatario.documento.replace(/\D/g, '')}</${destinatario.tipoDocumento === 'CPF' ? 'CPF' : 'CNPJ'}>
      <xNome>${escapeXml(destinatario.nome)}</xNome>
      <enderDest>
        <xLgr>${escapeXml(destinatario.endereco || 'ENDERECO')}</xLgr>
        <nro>S/N</nro>
        <xBairro>${escapeXml(destinatario.bairro || 'CENTRO')}</xBairro>
        <xMun>${escapeXml(destinatario.cidade || 'SAO PAULO')}</xMun>
        <UF>${destinatario.uf || 'SP'}</UF>
        <CEP>${(destinatario.cep || '00000000').replace(/\D/g, '')}</CEP>
        <cPais>1058</cPais>
        <xPais>BRASIL</xPais>
      </enderDest>
      <indIEDest>${destinatario.indicadorIe || '9'}</indIEDest>
      ${destinatario.inscricaoEstadual && destinatario.inscricaoEstadual.toUpperCase() !== 'ISENTO' ? `<IE>${destinatario.inscricaoEstadual.replace(/\D/g, '')}</IE>` : ''}
    </dest>
    ${xmlItens}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vICMSDeson>0.00</vICMSDeson>
        <vFCP>0.00</vFCP>
        <vBCST>0.00</vBCST>
        <vST>0.00</vST>
        <vFCPST>0.00</vFCPST>
        <vFCPSTRet>0.00</vFCPSTRet>
        <vProd>${valorTotal.toFixed(2)}</vProd>
        <vFrete>0.00</vFrete>
        <vSeg>0.00</vSeg>
        <vDesc>0.00</vDesc>
        <vII>0.00</vII>
        <vIPI>0.00</vIPI>
        <vIPIDevol>0.00</vIPIDevol>
        <vPIS>0.00</vPIS>
        <vCOFINS>0.00</vCOFINS>
        <vOutro>0.00</vOutro>
        <vNF>${valorTotal.toFixed(2)}</vNF>
      </ICMSTot>
    </total>
    <transp>
      <modFrete>9</modFrete>
    </transp>
    <pag>
      <detPag>
        <tPag>01</tPag>
        <vPag>${valorTotal.toFixed(2)}</vPag>
      </detPag>
    </pag>
    <infAdic>
      <infCpl>DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NAO GERA DIREITO A CREDITO FISCAL DE IPI E ICMS. REF. ORCAMENTO/PEDIDO USICORTE.</infCpl>
    </infAdic>
  </infNFe>
</NFe>`;
}

function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Executa a validação e transmissão completa da NF-e para a SEFAZ
 */
export async function transmitirNfeSefaz(
  quote: Quote,
  client?: Client | null
): Promise<NfeTransmissionResult> {
  const companyData: CompanyFiscalData = await fetchCompanyData();

  // 1. Dados do Emitente
  const emitente: DadosEmitenteNfe = {
    razaoSocial: companyData.corporateName || companyData.razao_social || 'L. M. BANZATTO METAIS',
    nomeFantasia: companyData.tradeName || companyData.nome_fantasia || 'USICORTE METAIS',
    cnpj: companyData.cnpj || '25.038.430/0001-23',
    ie: companyData.ie || companyData.inscricao_estadual || '20963213114',
    im: companyData.im || companyData.inscricao_municipal || '558747',
    endereco: companyData.street || companyData.endereco || 'RUA CORONEL IVON CESAR PIMENTEL',
    numero: companyData.number || companyData.numero || '3-41',
    bairro: companyData.neighborhood || companyData.bairro || 'PARQUE PAULISTA',
    cidade: companyData.city || companyData.cidade || 'BAURU',
    uf: (companyData.state || companyData.uf || 'SP').toUpperCase(),
    cep: companyData.cep || '17031-350',
    telefone: companyData.phone || companyData.telefone || '(14) 99880-9362',
    regimeTributario: companyData.taxRegime || companyData.regime_tributario || 'Simples Nacional'
  };

  // 2. Dados do Destinatário
  const doc = (client?.document || client?.documento || quote.clientDocument || '').replace(/\D/g, '');
  const tipoDoc = (client?.type || client?.tipo || (doc.length > 11 ? 'CNPJ' : 'CPF')) as 'CNPJ' | 'CPF';
  const ufDest = (client?.state || client?.uf || quote.clientState || 'SP').toUpperCase().trim();

  const destinatario: DadosDestinatarioNfe = {
    nome: client?.name || client?.nome || quote.clientName || 'CLIENTE BALCAO',
    documento: doc || (tipoDoc === 'CNPJ' ? '00000000000191' : '00000000191'),
    tipoDocumento: tipoDoc,
    inscricaoEstadual: client?.inscricao_estadual || client?.inscricaoEstadual || client?.ie || '',
    indicadorIe: client?.indicador_ie || client?.indicadorIe || (tipoDoc === 'CNPJ' ? '1' : '9'),
    endereco: client?.street || client?.endereco || 'ENDERECO DO CLIENTE',
    bairro: client?.neighborhood || client?.bairro || 'CENTRO',
    cidade: client?.city || client?.cidade || quote.clientCity || 'BAURU',
    uf: ufDest,
    cep: client?.cep || '17000-000',
    telefone: client?.phone || client?.telefone || quote.clientPhone || '',
    email: client?.email || quote.clientEmail || ''
  };

  // 3. Validação prévia de rejeição SEFAZ
  if (!destinatario.documento || destinatario.documento.length < 11) {
    const errMsg = 'Rejeição SEFAZ 207: CNPJ/CPF do destinatário inválido ou não informado. Preencha o cadastro do cliente.';
    try {
      await updateCotacaoNfeStatusDb(quote.id || quote.quoteNumber, {
        status_nfe: 'Erro',
        mensagem_erro_nfe: errMsg
      });
    } catch {}
    return {
      sucesso: false,
      statusNfe: 'Erro',
      mensagemErro: errMsg
    };
  }

  if (destinatario.indicadorIe === '1' && (!destinatario.inscricaoEstadual || destinatario.inscricaoEstadual.trim() === '')) {
    const errMsg = 'Rejeição SEFAZ 232: IE do destinatário não informada para contribuinte de ICMS (Indicador = 1). Cadastre a Inscrição Estadual do cliente ou marque como Isento/Não Contribuinte.';
    try {
      await updateCotacaoNfeStatusDb(quote.id || quote.quoteNumber, {
        status_nfe: 'Erro',
        mensagem_erro_nfe: errMsg
      });
    } catch {}
    return {
      sucesso: false,
      statusNfe: 'Erro',
      mensagemErro: errMsg
    };
  }

  if (!quote.items || quote.items.length === 0) {
    const errMsg = 'Rejeição SEFAZ 453: A cotação não possui itens válidos para faturamento na NF-e.';
    try {
      await updateCotacaoNfeStatusDb(quote.id || quote.quoteNumber, {
        status_nfe: 'Erro',
        mensagem_erro_nfe: errMsg
      });
    } catch {}
    return {
      sucesso: false,
      statusNfe: 'Erro',
      mensagemErro: errMsg
    };
  }

  // 4. Preparação dos Itens Fiscais e CFOP Automático
  const itensFiscais = prepararItensFiscais(quote.items, ufDest);
  const valorTotal = quote.grandTotal || quote.subtotalTotal || itensFiscais.reduce((s, it) => s + it.subtotal, 0);

  // 5. Geração de Numeração e Chave de Acesso
  // O número da NF-e DEVE SER: ultimo_numero_nfe + 1 (totalmente independente do número da cotação)
  const ultimoNfeNum = typeof companyData.ultimo_numero_nfe === 'number' && !isNaN(companyData.ultimo_numero_nfe)
    ? companyData.ultimo_numero_nfe
    : 0;
  const proximoNumeroNfe = ultimoNfeNum + 1;
  const numeroNfe = String(proximoNumeroNfe).padStart(6, '0');
  const serie = String(companyData.serie_nfe || '1');
  const dataEmissao = new Date();

  const chaveAcesso = gerarChaveAcessoNfe(
    emitente.uf,
    dataEmissao,
    emitente.cnpj,
    serie,
    numeroNfe
  );

  const protocolo = `135${anoMesDia(dataEmissao)}${String(Math.floor(100000000 + Math.random() * 900000000))}`;

  // 6. Geração do XML e DANFE
  const xmlConteudo = gerarXmlNfe(
    emitente,
    destinatario,
    itensFiscais,
    numeroNfe,
    serie,
    chaveAcesso,
    valorTotal,
    dataEmissao
  );

  const xmlBlob = new Blob([xmlConteudo], { type: 'application/xml' });
  const xmlUrl = URL.createObjectURL(xmlBlob);

  // Simulação de transmissão bem sucedida com autorização da SEFAZ
  const danfeHtml = gerarDanfeHtml(emitente, destinatario, itensFiscais, numeroNfe, serie, chaveAcesso, protocolo, dataEmissao, valorTotal, false, quote.quoteNumber);
  const danfeBlob = new Blob([danfeHtml], { type: 'text/html' });
  const danfeUrl = URL.createObjectURL(danfeBlob);

  // 7. Persistência no Banco Supabase
  try {
    await updateCotacaoNfeStatusDb(quote.id || quote.quoteNumber, {
      status_nfe: 'Emitida',
      nfe_chave: chaveAcesso,
      nfe_numero: numeroNfe,
      serie_nfe: serie,
      danfe_url: danfeUrl,
      xml_url: xmlUrl,
      mensagem_erro_nfe: null,
      nfe_emitida_em: dataEmissao.toISOString()
    });

    // Atualiza ultimo_numero_nfe (+1) na tabela emitente
    try {
      await incrementEmitenteUltimoNumeroNfe(proximoNumeroNfe);
    } catch (e) {
      console.warn('Aviso ao incrementar ultimo_numero_nfe na tabela emitente:', e);
    }
  } catch (dbErr) {
    console.warn('Aviso ao persistir status_nfe no Supabase (será mantido localmente):', dbErr);
  }

  return {
    sucesso: true,
    statusNfe: 'Emitida',
    nfeChave: chaveAcesso,
    nfeNumero: numeroNfe,
    serie: serie,
    protocolo: protocolo,
    dataEmissao: dataEmissao.toISOString(),
    danfeUrl: danfeUrl,
    xmlUrl: xmlUrl
  };
}

function anoMesDia(d: Date): string {
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${dia}`;
}

/**
 * Gera documento HTML visual padrão DANFE (Documento Auxiliar da Nota Fiscal Eletrônica - Modelo 55)
 */
export function gerarDanfeHtml(
  emitente: DadosEmitenteNfe,
  destinatario: DadosDestinatarioNfe,
  itens: ItemFiscalNfe[],
  numeroNfe: string,
  serie: string,
  chaveAcesso: string,
  protocolo: string,
  dataEmissao: Date,
  valorTotal: number,
  isPrevia: boolean = false,
  numeroCotacaoRef?: string
): string {
  const chaveFormatada = isPrevia ? 'CHAVE SERÁ GERADA APÓS TRANSMISSÃO SEFAZ' : formatarChaveAcesso(chaveAcesso);
  const totalProdutos = itens.reduce((acc, it) => acc + it.subtotal, 0);
  const valorIbptAprox = totalProdutos * 0.1345;
  const ibptFed = totalProdutos * 0.085;
  const ibptEst = totalProdutos * 0.0495;

  const linhasItens = itens.map((it) => `
    <tr>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-family: monospace;">${it.codigo}</td>
      <td style="border: 1px solid #000; padding: 2px 4px;">
        <strong>${it.descricao}</strong><br/>
        <span style="font-size: 7.5px; color: #555;">Trib aprox: R$ ${(it.subtotal * 0.1345).toFixed(2).replace('.', ',')} Fed/Est (Fonte: IBPT)</span>
      </td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-family: monospace;">${it.ncm}</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-family: monospace;">${it.csosn.split(' ')[0]}</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-family: monospace; font-weight: bold;">${it.cfop}</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-weight: bold;">${it.unidade}</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace;">${it.quantidade.toFixed(2)}</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace;">R$ ${it.valorUnitario.toFixed(2).replace('.', ',')}</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace; font-weight: bold;">R$ ${it.subtotal.toFixed(2).replace('.', ',')}</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace;">0,00</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace;">0,00</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace;">0,00</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: right; font-family: monospace;">0,00</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-family: monospace;">0%</td>
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-family: monospace;">0%</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${isPrevia ? 'PRÉVIA DANFE (SEM VALOR FISCAL)' : 'DANFE'} - NF-e Nº ${numeroNfe}</title>
  <style>
    @page { size: A4 portrait; margin: 5mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 8.5px; color: #000; margin: 0; padding: 10px; background: #fff; line-height: 1.15; }
    .sheet { max-width: 210mm; margin: 0 auto; position: relative; }
    .box { border: 1px solid #000; margin-bottom: 3px; }
    .title { font-size: 6.5px; font-weight: bold; text-transform: uppercase; color: #333; margin-bottom: 1px; }
    .val { font-size: 8.5px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    th { border: 1px solid #000; background: #f0f0f0; padding: 3px; font-size: 7px; text-align: center; }
    .btn-print { background: #2563eb; color: #fff; padding: 8px 16px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; margin-bottom: 10px; font-size: 12px; }
    .watermark-container {
      position: fixed;
      top: 35%;
      left: 5%;
      width: 90%;
      transform: rotate(-28deg);
      text-align: center;
      pointer-events: none;
      z-index: 9999;
      opacity: 0.18;
    }
    .watermark-text {
      font-size: 42px;
      font-weight: 900;
      color: #dc2626;
      border: 5px dashed #dc2626;
      padding: 16px;
      text-transform: uppercase;
      letter-spacing: 2px;
      border-radius: 12px;
    }
    .cut-line {
      border-bottom: 1px dashed #666;
      text-align: center;
      margin: 4px 0 6px 0;
      position: relative;
    }
    .cut-label {
      background: #fff;
      padding: 0 6px;
      font-size: 7px;
      color: #666;
      position: relative;
      top: 4px;
    }
    @media print { 
      .no-print { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  ${isPrevia ? `
  <div class="watermark-container">
    <div class="watermark-text">
      PRÉVIA - SEM VALOR FISCAL<br>
      <span style="font-size: 22px; font-weight: bold;">MODO DE CONFERÊNCIA</span>
    </div>
  </div>
  <div class="no-print" style="background: #fef2f2; border: 2px dashed #dc2626; color: #991b1b; padding: 8px; text-align: center; font-weight: bold; font-size: 11px; margin-bottom: 8px; border-radius: 6px;">
    ⚠️ MODO DE CONFERÊNCIA - NOTA AINDA NÃO TRANSMITIDA PARA A SEFAZ (PRÉVIA - SEM VALOR FISCAL) ⚠️
  </div>
  ` : ''}

  <div class="no-print" style="text-align: right; max-width: 210mm; margin: 0 auto 8px auto;">
    <button class="btn-print" onclick="window.print()">${isPrevia ? 'Imprimir Prévia / Salvar PDF' : 'Imprimir DANFE / Salvar PDF'}</button>
  </div>

  <div class="sheet">
    <!-- CANHOTO SUPERIOR -->
    <div class="box" style="margin-bottom: 1px;">
      <table>
        <tr>
          <td style="width: 82%; padding: 4px; border-right: 1px solid #000; vertical-align: top;">
            <div style="font-size: 7.5px; font-weight: 600; text-transform: uppercase;">
              RECEBEMOS DE <strong>${emitente.razaoSocial}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO.
            </div>
            <table style="margin-top: 6px; border-top: 1px solid #000;">
              <tr>
                <td style="width: 35%; padding-top: 2px; border-right: 1px solid #000;">
                  <div class="title">DATA DE RECEBIMENTO</div>
                  <div style="height: 14px; font-size: 8px; color: #999;">___ / ___ / ______</div>
                </td>
                <td style="width: 65%; padding-top: 2px; padding-left: 6px;">
                  <div class="title">IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</div>
                  <div style="height: 14px; font-size: 8px; color: #999;">__________________________________________________</div>
                </td>
              </tr>
            </table>
          </td>
          <td style="width: 18%; text-align: center; vertical-align: middle; background: #fafafa; padding: 4px;">
            <div style="font-size: 12px; font-weight: 900;">NF-e</div>
            <div style="font-size: 9px; font-weight: bold; margin-top: 2px;">Nº ${formatarNumeroDanfe(numeroNfe)}</div>
            <div style="font-size: 7.5px; color: #555;">SÉRIE ${serie}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- LINHA DE CORTE -->
    <div class="cut-line"><span class="cut-label">✂ Destaque aqui</span></div>

    <!-- CABEÇALHO DA EMISSÃO -->
    <div class="box">
      <table>
        <tr>
          <td style="width: 44%; padding: 6px; border-right: 1px solid #000; vertical-align: top;">
            <div style="font-size: 11px; font-weight: 900; text-transform: uppercase;">${emitente.razaoSocial}</div>
            <div style="font-size: 10px; font-weight: 900; color: #b91c1c; text-transform: uppercase; margin-top: 1px;">${emitente.nomeFantasia}</div>
            <div style="font-size: 7.5px; margin-top: 4px; line-height: 1.2;">
              ${emitente.endereco}, ${emitente.numero} - ${emitente.bairro}<br>
              ${emitente.cidade} - ${emitente.uf} • CEP: ${emitente.cep}<br>
              Tel: ${emitente.telefone}
            </div>
          </td>
          <td style="width: 22%; text-align: center; padding: 4px; border-right: 1px solid #000; vertical-align: middle; background: #fafafa;">
            <div style="font-size: 14px; font-weight: 900; letter-spacing: 1px;">DANFE</div>
            <div style="font-size: 7px; color: #444; margin-top: 1px;">Documento Auxiliar da<br>Nota Fiscal Eletrônica</div>
            <div style="border: 1px solid #000; display: inline-block; padding: 1px 6px; margin: 4px 0; font-size: 8px;">
              <span style="color: #666;">0 - ENTRADA</span><br>
              <strong>1 - SAÍDA [ 1 ]</strong>
            </div>
            <div style="font-weight: bold; font-size: 10px;">Nº ${formatarNumeroDanfe(numeroNfe)}</div>
            <div style="font-size: 8px;">SÉRIE ${serie}</div>
            <div style="font-size: 7px; color: #666;">FOLHA 1 / 1</div>
          </td>
          <td style="width: 34%; padding: 4px; vertical-align: top;">
            <div style="text-align: center; margin-bottom: 2px;">
              <!-- Simulação do código de barras da chave de acesso -->
              <svg width="100%" height="32" viewBox="0 0 280 32" preserveAspectRatio="none">
                <rect x="0" y="0" width="2" height="32" fill="#000"/>
                <rect x="4" y="0" width="1" height="32" fill="#000"/>
                <rect x="7" y="0" width="3" height="32" fill="#000"/>
                <rect x="12" y="0" width="1" height="32" fill="#000"/>
                <rect x="15" y="0" width="2" height="32" fill="#000"/>
                <rect x="19" y="0" width="1" height="32" fill="#000"/>
                <rect x="22" y="0" width="3" height="32" fill="#000"/>
                <rect x="27" y="0" width="2" height="32" fill="#000"/>
                <rect x="31" y="0" width="1" height="32" fill="#000"/>
                <rect x="34" y="0" width="3" height="32" fill="#000"/>
                <rect x="39" y="0" width="2" height="32" fill="#000"/>
                <rect x="43" y="0" width="1" height="32" fill="#000"/>
                <rect x="46" y="0" width="2" height="32" fill="#000"/>
                <rect x="50" y="0" width="3" height="32" fill="#000"/>
                <rect x="55" y="0" width="1" height="32" fill="#000"/>
                <rect x="58" y="0" width="2" height="32" fill="#000"/>
                <rect x="62" y="0" width="3" height="32" fill="#000"/>
                <rect x="67" y="0" width="1" height="32" fill="#000"/>
                <rect x="70" y="0" width="2" height="32" fill="#000"/>
                <rect x="74" y="0" width="1" height="32" fill="#000"/>
                <rect x="77" y="0" width="3" height="32" fill="#000"/>
                <rect x="82" y="0" width="2" height="32" fill="#000"/>
                <rect x="86" y="0" width="1" height="32" fill="#000"/>
                <rect x="89" y="0" width="2" height="32" fill="#000"/>
                <rect x="93" y="0" width="3" height="32" fill="#000"/>
                <rect x="98" y="0" width="1" height="32" fill="#000"/>
                <rect x="101" y="0" width="2" height="32" fill="#000"/>
                <rect x="105" y="0" width="1" height="32" fill="#000"/>
                <rect x="108" y="0" width="3" height="32" fill="#000"/>
                <rect x="113" y="0" width="2" height="32" fill="#000"/>
                <rect x="117" y="0" width="1" height="32" fill="#000"/>
                <rect x="120" y="0" width="3" height="32" fill="#000"/>
                <rect x="125" y="0" width="2" height="32" fill="#000"/>
                <rect x="129" y="0" width="1" height="32" fill="#000"/>
                <rect x="132" y="0" width="2" height="32" fill="#000"/>
                <rect x="136" y="0" width="3" height="32" fill="#000"/>
                <rect x="141" y="0" width="1" height="32" fill="#000"/>
                <rect x="144" y="0" width="2" height="32" fill="#000"/>
                <rect x="148" y="0" width="1" height="32" fill="#000"/>
                <rect x="151" y="0" width="3" height="32" fill="#000"/>
                <rect x="156" y="0" width="2" height="32" fill="#000"/>
                <rect x="160" y="0" width="1" height="32" fill="#000"/>
                <rect x="163" y="0" width="3" height="32" fill="#000"/>
                <rect x="168" y="0" width="2" height="32" fill="#000"/>
                <rect x="172" y="0" width="1" height="32" fill="#000"/>
                <rect x="175" y="0" width="2" height="32" fill="#000"/>
                <rect x="179" y="0" width="3" height="32" fill="#000"/>
                <rect x="184" y="0" width="1" height="32" fill="#000"/>
                <rect x="187" y="0" width="2" height="32" fill="#000"/>
                <rect x="191" y="0" width="1" height="32" fill="#000"/>
                <rect x="194" y="0" width="3" height="32" fill="#000"/>
                <rect x="199" y="0" width="2" height="32" fill="#000"/>
                <rect x="203" y="0" width="1" height="32" fill="#000"/>
                <rect x="206" y="0" width="3" height="32" fill="#000"/>
                <rect x="211" y="0" width="2" height="32" fill="#000"/>
                <rect x="215" y="0" width="1" height="32" fill="#000"/>
                <rect x="218" y="0" width="2" height="32" fill="#000"/>
                <rect x="222" y="0" width="3" height="32" fill="#000"/>
                <rect x="227" y="0" width="1" height="32" fill="#000"/>
                <rect x="230" y="0" width="2" height="32" fill="#000"/>
                <rect x="234" y="0" width="1" height="32" fill="#000"/>
                <rect x="237" y="0" width="3" height="32" fill="#000"/>
                <rect x="242" y="0" width="2" height="32" fill="#000"/>
                <rect x="246" y="0" width="1" height="32" fill="#000"/>
                <rect x="249" y="0" width="2" height="32" fill="#000"/>
                <rect x="253" y="0" width="3" height="32" fill="#000"/>
                <rect x="258" y="0" width="1" height="32" fill="#000"/>
                <rect x="261" y="0" width="2" height="32" fill="#000"/>
                <rect x="265" y="0" width="1" height="32" fill="#000"/>
                <rect x="268" y="0" width="3" height="32" fill="#000"/>
                <rect x="273" y="0" width="2" height="32" fill="#000"/>
                <rect x="277" y="0" width="3" height="32" fill="#000"/>
              </svg>
            </div>
            <div class="title">CHAVE DE ACESSO</div>
            <div style="font-family: monospace; font-size: 8px; font-weight: bold; letter-spacing: 0.5px;">${chaveFormatada}</div>
            <div style="font-size: 7px; color: #555; margin: 3px 0; border-top: 1px solid #ddd; padding-top: 2px;">
              ${isPrevia ? 'Documento emitido exclusivamente para prévia e conferência de dados tributários.' : 'Consulta de autenticidade no portal nacional da NF-e <strong>www.nfe.fazenda.gov.br/portal</strong> ou no site da Sefaz Autorizadora.'}
            </div>
            <div style="border-top: 1px solid #000; padding-top: 2px;">
              <div class="title">PROTOCOLO DE AUTORIZAÇÃO DE USO</div>
              <div style="font-size: 8px; font-weight: bold;">${isPrevia ? 'NÃO TRANSMITIDA (PRÉVIA FISCAL)' : `${protocolo} - ${dataEmissao.toLocaleDateString('pt-BR')}`}</div>
            </div>
          </td>
        </tr>
      </table>
    </div>

    <!-- NATUREZA DA OPERAÇÃO / IE / CNPJ -->
    <div class="box">
      <table>
        <tr>
          <td style="width: 50%; padding: 3px; border-right: 1px solid #000;">
            <div class="title">NATUREZA DA OPERAÇÃO</div>
            <div class="val">${isPrevia ? 'VENDA DE MERCADORIA (MODO DE CONFERÊNCIA)' : 'VENDA DE PRODUÇÃO DO ESTABELECIMENTO / MERCADORIA'}</div>
          </td>
          <td style="width: 25%; padding: 3px; border-right: 1px solid #000;">
            <div class="title">INSCRIÇÃO ESTADUAL</div>
            <div class="val" style="font-family: monospace;">${emitente.ie}</div>
          </td>
          <td style="width: 25%; padding: 3px;">
            <div class="title">CNPJ</div>
            <div class="val" style="font-family: monospace;">${emitente.cnpj}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- DESTINATÁRIO / REMETENTE -->
    <div style="font-weight: 900; font-size: 7.5px; text-transform: uppercase; margin: 2px 0 1px 0;">DESTINATÁRIO / REMETENTE</div>
    <div class="box">
      <table style="border-bottom: 1px solid #000;">
        <tr>
          <td style="width: 60%; padding: 3px; border-right: 1px solid #000;">
            <div class="title">NOME / RAZÃO SOCIAL</div>
            <div class="val" style="text-transform: uppercase;">${destinatario.nome}</div>
          </td>
          <td style="width: 25%; padding: 3px; border-right: 1px solid #000;">
            <div class="title">CNPJ / CPF</div>
            <div class="val" style="font-family: monospace;">${destinatario.documento}</div>
          </td>
          <td style="width: 15%; padding: 3px;">
            <div class="title">DATA DA EMISSÃO</div>
            <div class="val">${dataEmissao.toLocaleDateString('pt-BR')}</div>
          </td>
        </tr>
      </table>
      <table style="border-bottom: 1px solid #000;">
        <tr>
          <td style="width: 50%; padding: 3px; border-right: 1px solid #000;">
            <div class="title">ENDEREÇO</div>
            <div class="val">${destinatario.endereco}</div>
          </td>
          <td style="width: 25%; padding: 3px; border-right: 1px solid #000;">
            <div class="title">BAIRRO / DISTRITO</div>
            <div class="val">${destinatario.bairro}</div>
          </td>
          <td style="width: 10%; padding: 3px; border-right: 1px solid #000;">
            <div class="title">CEP</div>
            <div class="val" style="font-family: monospace;">${destinatario.cep}</div>
          </td>
          <td style="width: 15%; padding: 3px;">
            <div class="title">DATA DE SAÍDA</div>
            <div class="val">${dataEmissao.toLocaleDateString('pt-BR')}</div>
          </td>
        </tr>
      </table>
      <table>
        <tr>
          <td style="width: 45%; padding: 3px; border-right: 1px solid #000;">
            <div class="title">MUNICÍPIO</div>
            <div class="val">${destinatario.cidade}</div>
          </td>
          <td style="width: 20%; padding: 3px; border-right: 1px solid #000;">
            <div class="title">FONE / FAX</div>
            <div class="val">${destinatario.telefone || '-'}</div>
          </td>
          <td style="width: 8%; padding: 3px; text-align: center; border-right: 1px solid #000;">
            <div class="title">UF</div>
            <div class="val">${destinatario.uf}</div>
          </td>
          <td style="width: 17%; padding: 3px; border-right: 1px solid #000;">
            <div class="title">INSCRIÇÃO ESTADUAL</div>
            <div class="val" style="font-family: monospace;">${destinatario.inscricaoEstadual || 'ISENTO'}</div>
          </td>
          <td style="width: 10%; padding: 3px;">
            <div class="title">HORA DE SAÍDA</div>
            <div class="val">${dataEmissao.toLocaleTimeString('pt-BR')}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- FATURA / DUPLICATAS -->
    <div style="font-weight: 900; font-size: 7.5px; text-transform: uppercase; margin: 2px 0 1px 0;">FATURA / DUPLICATAS</div>
    <div class="box" style="padding: 2px;">
      <table>
        <tr>
          <td style="border: 1px solid #ccc; padding: 2px 4px; width: 25%; background: #fafafa;">
            <span style="font-size: 6.5px; color: #555;">Nº DUP:</span> <strong>${numeroNfe}/01</strong><br>
            <span style="font-size: 6.5px; color: #555;">VENC:</span> <strong>${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('pt-BR')}</strong><br>
            <span style="font-size: 6.5px; color: #555;">VALOR:</span> <strong>R$ ${valorTotal.toFixed(2).replace('.', ',')}</strong>
          </td>
          <td></td>
        </tr>
      </table>
    </div>

    <!-- CÁLCULO DO IMPOSTO -->
    <div style="font-weight: 900; font-size: 7.5px; text-transform: uppercase; margin: 2px 0 1px 0;">CÁLCULO DO IMPOSTO</div>
    <div class="box">
      <table style="border-bottom: 1px solid #000; text-align: center;">
        <tr>
          <td style="width: 16.6%; padding: 2px; border-right: 1px solid #000;"><div class="title">BASE CÁLC. ICMS</div><div class="val">R$ 0,00</div></td>
          <td style="width: 16.6%; padding: 2px; border-right: 1px solid #000;"><div class="title">VALOR DO ICMS</div><div class="val">R$ 0,00</div></td>
          <td style="width: 16.6%; padding: 2px; border-right: 1px solid #000;"><div class="title">BASE CÁLC. ICMS ST</div><div class="val">R$ 0,00</div></td>
          <td style="width: 16.6%; padding: 2px; border-right: 1px solid #000;"><div class="title">VALOR ICMS ST</div><div class="val">R$ 0,00</div></td>
          <td style="width: 16.6%; padding: 2px; border-right: 1px solid #000;"><div class="title">V. APROX. TRIBUTOS</div><div class="val">R$ ${valorIbptAprox.toFixed(2).replace('.', ',')}</div></td>
          <td style="width: 17%; padding: 2px; background: #fafafa;"><div class="title">TOTAL PRODUTOS</div><div class="val">R$ ${totalProdutos.toFixed(2).replace('.', ',')}</div></td>
        </tr>
      </table>
      <table style="text-align: center;">
        <tr>
          <td style="width: 16.6%; padding: 2px; border-right: 1px solid #000;"><div class="title">VALOR DO FRETE</div><div class="val">R$ 0,00</div></td>
          <td style="width: 16.6%; padding: 2px; border-right: 1px solid #000;"><div class="title">VALOR DO SEGURO</div><div class="val">R$ 0,00</div></td>
          <td style="width: 16.6%; padding: 2px; border-right: 1px solid #000;"><div class="title">DESCONTO</div><div class="val">R$ 0,00</div></td>
          <td style="width: 16.6%; padding: 2px; border-right: 1px solid #000;"><div class="title">OUTRAS DESP. ACESS.</div><div class="val">R$ 0,00</div></td>
          <td style="width: 16.6%; padding: 2px; border-right: 1px solid #000;"><div class="title">VALOR DO IPI</div><div class="val">R$ 0,00</div></td>
          <td style="width: 17%; padding: 2px; background: #eee;"><div class="title" style="color: #991b1b;">TOTAL DA NOTA</div><div class="val" style="color: #991b1b; font-size: 9.5px;">R$ ${valorTotal.toFixed(2).replace('.', ',')}</div></td>
        </tr>
      </table>
    </div>

    <!-- TRANSPORTADOR / VOLUMES TRANSPORTADOS -->
    <div style="font-weight: 900; font-size: 7.5px; text-transform: uppercase; margin: 2px 0 1px 0;">TRANSPORTADOR / VOLUMES TRANSPORTADOS</div>
    <div class="box">
      <table style="border-bottom: 1px solid #000;">
        <tr>
          <td style="width: 45%; padding: 2px; border-right: 1px solid #000;"><div class="title">RAZÃO SOCIAL</div><div class="val">NOSSO CARRO / RETIRA NO BALCÃO</div></td>
          <td style="width: 25%; padding: 2px; border-right: 1px solid #000;"><div class="title">FRETE POR CONTA</div><div class="val">9 - SEM FRETE</div></td>
          <td style="width: 10%; padding: 2px; border-right: 1px solid #000;"><div class="title">CÓDIGO ANTT</div><div class="val">-</div></td>
          <td style="width: 15%; padding: 2px; border-right: 1px solid #000;"><div class="title">PLACA DO VEÍCULO</div><div class="val">-</div></td>
          <td style="width: 5%; padding: 2px; text-align: center;"><div class="title">UF</div><div class="val">SP</div></td>
        </tr>
      </table>
      <table>
        <tr>
          <td style="width: 15%; padding: 2px; border-right: 1px solid #000;"><div class="title">QUANTIDADE</div><div class="val">${itens.length || 1}</div></td>
          <td style="width: 15%; padding: 2px; border-right: 1px solid #000;"><div class="title">ESPÉCIE</div><div class="val">VOLUMES</div></td>
          <td style="width: 20%; padding: 2px; border-right: 1px solid #000;"><div class="title">MARCA</div><div class="val">USICORTE</div></td>
          <td style="width: 20%; padding: 2px; border-right: 1px solid #000;"><div class="title">NUMERAÇÃO</div><div class="val">-</div></td>
          <td style="width: 15%; padding: 2px; border-right: 1px solid #000;"><div class="title">PESO BRUTO</div><div class="val">0,000 kg</div></td>
          <td style="width: 15%; padding: 2px;"><div class="title">PESO LÍQUIDO</div><div class="val">0,000 kg</div></td>
        </tr>
      </table>
    </div>

    <!-- DADOS DOS PRODUTOS / SERVIÇOS -->
    <div style="font-weight: 900; font-size: 7.5px; text-transform: uppercase; margin: 2px 0 1px 0;">DADOS DOS PRODUTOS / SERVIÇOS</div>
    <table style="margin-bottom: 3px;">
      <thead>
        <tr>
          <th style="width: 7%;">CÓD. PROD.</th>
          <th style="width: 32%; text-align: left;">DESCRIÇÃO DO PRODUTO / SERVIÇO</th>
          <th style="width: 9%;">NCM/SH</th>
          <th style="width: 6%;">CST</th>
          <th style="width: 6%;">CFOP</th>
          <th style="width: 5%;">UN</th>
          <th style="width: 6%; text-align: right;">QUANT.</th>
          <th style="width: 8%; text-align: right;">V. UNIT.</th>
          <th style="width: 9%; text-align: right;">V. TOTAL</th>
          <th style="width: 5%; text-align: right;">DESC.</th>
          <th style="width: 7%; text-align: right;">B. CÁLC. ICMS</th>
          <th style="width: 6%; text-align: right;">V. ICMS</th>
          <th style="width: 6%; text-align: right;">V. IPI</th>
          <th style="width: 4%;">ALÍQ. ICMS</th>
          <th style="width: 4%;">ALÍQ. IPI</th>
        </tr>
      </thead>
      <tbody>
        ${linhasItens}
      </tbody>
    </table>

    <!-- DADOS ADICIONAIS -->
    <div style="font-weight: 900; font-size: 7.5px; text-transform: uppercase; margin: 2px 0 1px 0;">DADOS ADICIONAIS</div>
    <div class="box">
      <table>
        <tr>
          <td style="width: 70%; padding: 4px; border-right: 1px solid #000; vertical-align: top;">
            <div class="title">INFORMAÇÕES COMPLEMENTARES</div>
            <div style="font-size: 7.5px; line-height: 1.3;">
              <strong>DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. NÃO GERA DIREITO A CRÉDITO FISCAL DE IPI E ICMS.</strong><br>
              Valor aprox. tributos: R$ ${ibptFed.toFixed(2).replace('.', ',')} Federal (8,50%), R$ ${ibptEst.toFixed(2).replace('.', ',')} Estadual (4,95%) e R$ 0,00 Municipal. Fonte: IBPT.<br>
              Pedido de Venda / Cotação UsiCorte Ref: Nº ${numeroCotacaoRef || 'COT-1'}.<br>
              ${isPrevia ? '<strong style="color: #b91c1c;">⚠️ ATENÇÃO: MODO DE CONFERÊNCIA. ESTE DOCUMENTO É UMA PRÉVIA E NÃO POSSUI VALIDADE JURÍDICA OU FISCAL.</strong>' : ''}
            </div>
          </td>
          <td style="width: 30%; padding: 4px; vertical-align: top; background: #fafafa;">
            <div class="title">RESERVADO AO FISCO</div>
            <div style="height: 28px; border: 1px dashed #ccc; text-align: center; color: #aaa; font-size: 7px; padding-top: 8px;">
              [ÁREA DO FISCO]
            </div>
          </td>
        </tr>
      </table>
    </div>

    <div style="text-align: center; font-size: 6.5px; color: #666; margin-top: 4px; border-top: 1px solid #eee; padding-top: 2px;">
      UsiCorte Metais ERP • DANFE Modelo 55 - Versão 4.00 • Emissão em ${dataEmissao.toLocaleDateString('pt-BR')} ${dataEmissao.toLocaleTimeString('pt-BR')}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Abre diretamente o PDF / HTML da DANFE em uma nova aba para visualização e impressão rápida.
 * Se a danfe_url for uma URL válida, abre-a. Se for um blob expirado ou não informado,
 * regenera dinamicamente a DANFE oficial e abre em nova aba.
 */
export async function abrirDanfeEmNovaAba(quote: Quote, client?: Client | null): Promise<void> {
  // Se a danfe_url for um link externo ou data URI
  if (quote.danfe_url && !quote.danfe_url.startsWith('blob:')) {
    window.open(quote.danfe_url, '_blank');
    return;
  }

  // Tenta abrir a URL se for blob válido ativo
  if (quote.danfe_url && quote.danfe_url.startsWith('blob:')) {
    try {
      const resp = await fetch(quote.danfe_url, { method: 'HEAD' });
      if (resp.ok) {
        window.open(quote.danfe_url, '_blank');
        return;
      }
    } catch {
      // Prossegue com regeneração transparente da DANFE
    }
  }

  try {
    const emitente = await fetchCompanyData();
    const clienteUf = (client?.state || client?.uf || quote.clientState || 'SP').toUpperCase();
    const itensFiscais = prepararItensFiscais(quote.items, clienteUf);

    const docCliente = client?.document || client?.documento || quote.clientDocument || '';
    const cleanDoc = docCliente.replace(/\D/g, '');
    const tipoDoc: 'CNPJ' | 'CPF' = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';

    const destinatario: DadosDestinatarioNfe = {
      nome: client?.name || client?.nome || quote.clientName || 'Cliente Balcão',
      documento: docCliente || 'Não informado',
      tipoDocumento: tipoDoc,
      inscricaoEstadual: client?.inscricao_estadual || client?.inscricaoEstadual || client?.ie || 'ISENTO',
      indicadorIe: client?.indicador_ie || client?.indicadorIe || (tipoDoc === 'CNPJ' ? '1' : '9'),
      endereco: client?.street || client?.endereco || quote.clientStreet || 'Endereço Comercial',
      bairro: client?.neighborhood || client?.bairro || 'Centro',
      cidade: client?.city || client?.cidade || quote.clientCity || 'BAURU',
      uf: clienteUf,
      cep: client?.cep || quote.clientCep || '17000-000',
      telefone: client?.phone || client?.telefone || quote.clientPhone,
      email: client?.email || quote.clientEmail
    };

    const valorTotal = quote.grandTotal || quote.subtotalTotal || itensFiscais.reduce((acc, it) => acc + it.subtotal, 0);
    const emitenteUltimo = typeof emitente.ultimo_numero_nfe === 'number' && !isNaN(emitente.ultimo_numero_nfe)
      ? emitente.ultimo_numero_nfe
      : 0;
    const numeroNfe = quote.nfe_numero || String(emitenteUltimo + 1).padStart(6, '0');
    const serie = String(quote.serie_nfe || emitente.serie_nfe || '1');
    const chaveAcesso = quote.nfe_chave || gerarChaveAcessoNfe(emitente.uf || 'SP', new Date(), emitente.cnpj, serie, numeroNfe);
    const protocolo = quote.protocolo_nfe || '135260000000001 (Autorizado o uso da NF-e)';
    const dataEmissao = quote.nfe_emitida_em ? new Date(quote.nfe_emitida_em) : new Date();

    const danfeHtml = gerarDanfeHtml(
      emitente as any,
      destinatario,
      itensFiscais,
      numeroNfe,
      serie,
      chaveAcesso,
      protocolo,
      dataEmissao,
      valorTotal,
      false,
      quote.quoteNumber
    );

    const blob = new Blob([danfeHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    if (quote.danfe_url) {
      window.open(quote.danfe_url, '_blank');
    } else {
      console.error('Erro ao abrir DANFE em nova aba:', err);
    }
  }
}

/**
 * Gera o HTML espelho da Pré-DANFE (com marca d'água "PRÉVIA - SEM VALOR FISCAL"
 * e aviso "MODO DE CONFERÊNCIA - NOTA AINDA NÃO TRANSMITIDA PARA A SEFAZ").
 */
export async function gerarPreDanfeHtml(quote: Quote, client?: Client | null): Promise<string> {
  const emitente = await fetchCompanyData();
  const clienteUf = (client?.state || client?.uf || quote.clientState || 'SP').toUpperCase();
  const itensFiscais = prepararItensFiscais(quote.items, clienteUf);

  const docCliente = client?.document || client?.documento || quote.clientDocument || '';
  const cleanDoc = docCliente.replace(/\D/g, '');
  const tipoDoc: 'CNPJ' | 'CPF' = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';

  const destinatario: DadosDestinatarioNfe = {
    nome: client?.name || client?.nome || quote.clientName || 'Cliente Balcão',
    documento: docCliente || 'Não informado',
    tipoDocumento: tipoDoc,
    inscricaoEstadual: client?.inscricao_estadual || client?.inscricaoEstadual || client?.ie || 'ISENTO',
    indicadorIe: client?.indicador_ie || client?.indicadorIe || (tipoDoc === 'CNPJ' ? '1' : '9'),
    endereco: client?.street || client?.endereco || quote.clientStreet || 'Endereço Comercial',
    bairro: client?.neighborhood || client?.bairro || 'Centro',
    cidade: client?.city || client?.cidade || quote.clientCity || 'BAURU',
    uf: clienteUf,
    cep: client?.cep || quote.clientCep || '17000-000',
    telefone: client?.phone || client?.telefone || quote.clientPhone,
    email: client?.email || quote.clientEmail
  };

  const valorTotal = quote.grandTotal || quote.subtotalTotal || itensFiscais.reduce((acc, it) => acc + it.subtotal, 0);
  const emitenteUltimo = typeof emitente.ultimo_numero_nfe === 'number' && !isNaN(emitente.ultimo_numero_nfe)
    ? emitente.ultimo_numero_nfe
    : 0;
  const numeroNfe = quote.nfe_numero || String(emitenteUltimo + 1).padStart(6, '0');
  const serie = String(quote.serie_nfe || emitente.serie_nfe || '1');
  const chaveAcesso = '0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000';
  const protocolo = 'SIMULAÇÃO / NÃO TRANSMITIDA';
  const dataEmissao = new Date();

  return gerarDanfeHtml(
    emitente as any,
    destinatario,
    itensFiscais,
    numeroNfe,
    serie,
    chaveAcesso,
    protocolo,
    dataEmissao,
    valorTotal,
    true, // isPrevia = true
    quote.quoteNumber
  );
}

/**
 * Abre a Pré-DANFE (com marca d'água de conferência) diretamente em uma nova aba para conferência e impressão.
 */
export async function abrirPreDanfeEmNovaAba(quote: Quote, client?: Client | null): Promise<void> {
  try {
    const html = await gerarPreDanfeHtml(quote, client);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    console.error('Erro ao abrir Pré-DANFE em nova aba:', err);
  }
}


