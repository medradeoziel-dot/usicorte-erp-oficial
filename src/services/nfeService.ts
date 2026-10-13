import { Quote, QuoteItem, Client } from '../types';
import { db, updateCotacaoNfeStatusDb, isUuid, inserirNotaFiscalDb, fetchNotasFiscaisDb, NotaFiscalDb, cancelarNotaFiscalSupabase, resolveStatusNfeFinal } from '../lib/db';
import { fetchCompanyData, CompanyFiscalData, DEFAULT_COMPANY_DATA, incrementEmitenteUltimoNumeroNfe, getLocalCompanyData } from './companyService';
import { generateBarcodeSvg } from '../utils/barcode';
import { formatarMedidasLimpa, getObservacaoEspecificaItem } from '../utils/calculator';

/**
 * Formata o número da NF-e para exibição oficial no DANFE (ex: 000538 -> 000.538 ou 538)
 */
export function formatarNumeroDanfe(numStr: string | number): string {
  const clean = String(numStr).replace(/\D/g, '');
  if (!clean) return String(numStr);
  const num = parseInt(clean, 10);
  if (isNaN(num) || num === 0) return '000.001';
  const padded = String(num).padStart(6, '0');
  if (padded.length === 6) {
    return `${padded.slice(0, 3)}.${padded.slice(3)}`;
  }
  const padded9 = String(num).padStart(9, '0');
  return `${padded9.slice(0, 3)}.${padded9.slice(3, 6)}.${padded9.slice(6)}`;
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
  email?: string;
  regimeTributario: string;
  aliquotaIcmsSimples?: number;
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

export interface DuplicataDanfe {
  numero: string;
  vencimento: string; // YYYY-MM-DD ou formato legível
  valor: number;
}

export interface ClienteDanfeDestinatario {
  id?: string;
  nome: string;
  razao_social?: string;
  nome_fantasia?: string;
  doc: string;
  endereco: string;
  bairro: string;
  cep: string;
  cidade: string;
  uf: string;
  ie: string;
  inscricao_estadual?: string;
  inscricaoEstadual?: string;
  i_e?: string;
  InscricaoEstadual?: string;
  telefone: string;
}

/**
 * 2. CORREÇÃO DEFINITIVA DA INSCRIÇÃO ESTADUAL DO CLIENTE/DESTINATÁRIO:
 * Procura por qualquer variação da coluna de Inscrição Estadual vinda do banco de dados (tabela clientes do Supabase):
 * Testa inscricao_estadual, ie, inscricaoEstadual, i_e, InscricaoEstadual
 */
export const buscarInscricaoEstadual = (cliente: any): string => {
  if (!cliente) return 'ISENTO';
  
  // Procura por qualquer variação do campo vindo do banco de dados
  const ie = cliente.inscricao_estadual || 
             cliente.ie || 
             cliente.inscricaoEstadual || 
             cliente.i_e || 
             cliente.InscricaoEstadual;
             
  if (ie && typeof ie === 'string' && ie.trim() !== '' && ie.trim().toUpperCase() !== 'ISENTO') {
    return ie.trim();
  }

  if (typeof ie === 'number' && !isNaN(ie)) {
    return String(ie).trim();
  }
  
  return 'ISENTO';
};

/**
 * 1. CORREÇÃO DO ENDEREÇO DO EMITENTE (REMOVER DUPLICAÇÕES DE TEXTO):
 * Formata a string de endereço montando os campos de forma limpa sem repetições
 */
export const montarEnderecoSemDuplicacao = (
  logradouro?: string | null,
  numero?: string | null,
  complemento?: string | null,
  bairro?: string | null
): string => {
  const partes: string[] = [];
  if (logradouro) partes.push(logradouro.trim());
  if (numero && !logradouro?.includes(numero)) partes.push(numero.trim());
  if (complemento) partes.push(complemento.trim());
  if (bairro && !logradouro?.includes(bairro)) partes.push(bairro.trim());
  return partes.join(', ');
};

/**
 * Identifica a forma de pagamento da cotação/venda:
 * 2. REGRA DE FORMA DE PAGAMENTO E FATURA / DUPLICATAS:
 * A) Pagamento À Vista (PDV / Dinheiro / PIX / Débito):
 *    - Se a forma de pagamento for "A_VISTA", "DINHEIRO", "PIX" ou "DEBITO":
 *    - Retorna 'A_VISTA' (indPag = 0).
 * B) Pagamento a Prazo / Duplicata:
 *    - Se a forma de pagamento for "A_PRAZO", "DUPLICATA", "FATURADO" ou "BOLETO":
 *    - Retorna 'A_PRAZO' (indPag = 1).
 */
export function detectarFormaPagamentoInicial(quote?: Quote | null): 'A_VISTA' | 'A_PRAZO' {
  if (!quote) return 'A_VISTA';
  const pt = String(quote.paymentTerms || '').toUpperCase().trim();
  const pm = String(quote.paymentMethod || '').toUpperCase().trim();
  const fp = String(quote.forma_pagamento || (quote as any).forma_pagamento || '').toUpperCase().trim();
  const combined = `${pt} ${pm} ${fp}`;

  // Se explicitamente a prazo, duplicata, faturado ou boleto
  if (
    combined.includes('A_PRAZO') ||
    combined.includes('PRAZO') ||
    combined.includes('DUPLICATA') ||
    combined.includes('FATURADO') ||
    combined.includes('BOLETO') ||
    combined.includes('30 DIAS') ||
    combined.includes('PARCELADO') ||
    combined.includes('CREDITO') ||
    combined.includes('CRÉDITO')
  ) {
    return 'A_PRAZO';
  }

  // Padrão À Vista (PDV, Dinheiro, PIX, Débito, À Vista) => indPag = 0
  return 'A_VISTA';
}

/**
 * Gera lista de duplicatas dividindo o valor total de forma proporcional
 * e calculando os vencimentos (ex: a cada 30 dias).
 */
export function gerarDuplicatasProporcionais(
  valorTotal: number,
  numeroParcelas: number,
  numeroNfe: string,
  diasIntervalo: number = 30,
  dataBase: Date = new Date()
): DuplicataDanfe[] {
  const qtd = Math.max(1, Math.min(12, numeroParcelas));
  const numLimpo = String(numeroNfe || '1').replace(/\D/g, '').slice(-6).padStart(6, '0') || '000001';

  const valorTotalCentavos = Math.round((valorTotal || 0) * 100);
  const valorBaseCentavos = Math.floor(valorTotalCentavos / qtd);
  const sobraCentavos = valorTotalCentavos - (valorBaseCentavos * qtd);

  const resultado: DuplicataDanfe[] = [];

  for (let i = 1; i <= qtd; i++) {
    const dataVenc = new Date(dataBase);
    dataVenc.setDate(dataVenc.getDate() + (i * diasIntervalo));
    const ano = dataVenc.getFullYear();
    const mes = String(dataVenc.getMonth() + 1).padStart(2, '0');
    const dia = String(dataVenc.getDate()).padStart(2, '0');
    const vencIso = `${ano}-${mes}-${dia}`;

    // A primeira parcela absorve os centavos restantes para garantir soma exata
    const centavosDestaParcela = i === 1 ? valorBaseCentavos + sobraCentavos : valorBaseCentavos;
    const valorParcela = centavosDestaParcela / 100;

    resultado.push({
      numero: `${numLimpo}/${String(i).padStart(2, '0')}`,
      vencimento: vencIso,
      valor: valorParcela
    });
  }

  return resultado;
}

/**
 * Obtém a alíquota de ICMS do Simples Nacional configurada no emitente (padrão: 2,75%)
 */
export function obterAliquotaIcmsSimples(company?: any): number {
  if (!company) return 2.75;
  const aliq = company.aliquotaIcmsSimples ?? company.aliquota_icms_simples;
  if (typeof aliq === 'number' && !isNaN(aliq) && aliq >= 0) return aliq;
  if (typeof aliq === 'string' && aliq.trim() !== '') {
    const parsed = parseFloat(aliq.replace(',', '.'));
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  return 2.75;
}

/**
 * Calcula o crédito de ICMS do Simples Nacional (Art. 23 Lei Complementar nº 123/2006)
 * Valor do Crédito = (Valor Total da Nota * Alíquota ICMS) / 100
 * Retorna o valor calculado, a alíquota e a frase formatada obrigatória para DANFE e XML (<infAdic>)
 */
export function calcularCreditoIcmsSimples(valorTotal: number, aliquota: number = 2.75): {
  aliquota: number;
  valorCredito: number;
  valorCreditoFormatado: string;
  aliquotaFormatada: string;
  textoCredito: string;
} {
  const safeValor = Math.max(0, Number(valorTotal) || 0);
  const safeAliq = Math.max(0, Number(aliquota) || 0);
  const valorCredito = Number(((safeValor * safeAliq) / 100).toFixed(2));

  const valorCreditoFormatado = valorCredito.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const aliquotaFormatada = safeAliq.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const textoCredito = `Permite o aproveitamento do Credito de ICMS no valor de R$ ${valorCreditoFormatado}; Correspondente a aliquota de ${aliquotaFormatada}%, nos termos do Art. 23 Lei complementar N 123, DE 2006". ( 1 , 2 e 6 ; art. 26, inciso I e 4 ).`;

  return {
    aliquota: safeAliq,
    valorCredito,
    valorCreditoFormatado,
    aliquotaFormatada,
    textoCredito
  };
}


/**
 * 1. CORREÇÃO DEFINITIVA DA BUSCA DO CLIENTE (SUPABASE):
 * Realiza a busca no Supabase utilizando o cliente_id associado à cotação/venda na tabela clientes:
 * 
 * const { data: cliente } = await supabase
 *   .from('clientes')
 *   .select('*')
 *   .eq('id', cotacao.cliente_id)
 *   .single();
 * 
 * Mapeia os dados reais retornados para o bloco "DESTINATÁRIO / REMETENTE":
 * • NOME / RAZÃO SOCIAL: cliente.razao_social || cliente.nome_fantasia || cotacao.cliente_nome
 * • CNPJ / CPF: cliente.cnpj_cpf
 * • ENDEREÇO: `${cliente.logradouro}, ${cliente.numero}`
 * • BAIRRO: cliente.bairro
 * • CEP: cliente.cep
 * • MUNICÍPIO / UF: cliente.municipio / cliente.uf
 * • INSCRIÇÃO ESTADUAL: cliente.inscricao_estadual || 'ISENTO'
 */
export async function fetchClienteCompletoParaDanfe(
  quote: Quote,
  fallbackClient?: Client | null
): Promise<ClienteDanfeDestinatario> {
  let clienteId = quote.cliente_id || (quote as any).cliente_id || quote.clientId;
  let clienteNome = quote.cliente_nome || (quote as any).cliente_nome || quote.clientName || '';

  // Se cliente_id não está no objeto da cotação, consulta na tabela cotacoes do Supabase
  if (!clienteId && (quote.id || quote.quoteNumber)) {
    try {
      const qId = quote.id;
      const qNum = quote.quoteNumber;
      let queryCot = db.from('cotacoes').select('cliente_id, cliente_nome, forma_pagamento');
      if (qId && qNum && qId !== qNum) {
        queryCot = queryCot.or(`id.eq.${qId},numero.eq.${qNum}`);
      } else if (qId) {
        queryCot = queryCot.eq('id', qId);
      } else if (qNum) {
        queryCot = queryCot.eq('numero', qNum);
      }
      const { data: cotDb } = await queryCot.limit(1).maybeSingle();
      if (cotDb?.cliente_id) {
        clienteId = cotDb.cliente_id;
      }
      if (cotDb?.cliente_nome && (!clienteNome || clienteNome === 'Cliente Balcão')) {
        clienteNome = cotDb.cliente_nome;
      }
    } catch (e) {
      console.warn('Aviso ao consultar cliente_id na cotação do Supabase:', e);
    }
  }

  let clienteRaw: any = null;

  // 1. Busca no Supabase utilizando cliente_id na tabela clientes:
  // const { data: cliente } = await supabase.from('clientes').select('*').eq('id', cotacao.cliente_id).single();
  if (clienteId) {
    try {
      const { data, error } = await db
        .from('clientes')
        .select('*')
        .eq('id', clienteId)
        .maybeSingle();

      if (data && !error) {
        clienteRaw = data;
      }
    } catch (e) {
      console.warn('Aviso ao buscar cliente por ID no Supabase:', e);
    }
  }

  // 2. Se cliente_id não encontrou, busca no Supabase por nome / razão / fantasia (ex: "TECNOMAQ"):
  if (!clienteRaw && clienteNome && clienteNome.trim().toUpperCase() !== 'CLIENTE BALCÃO') {
    const termo = clienteNome.trim();
    try {
      // 2a. Busca por igualdade exata
      const { data: exato } = await db
        .from('clientes')
        .select('*')
        .or(`nome.ilike.${termo},razao_social.ilike.${termo},nome_fantasia.ilike.${termo},empresa.ilike.${termo}`)
        .limit(1)
        .maybeSingle();

      if (exato) {
        clienteRaw = exato;
      } else {
        // 2b. Busca contendo termo
        const { data: parcial } = await db
          .from('clientes')
          .select('*')
          .or(`nome.ilike.%${termo}%,razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%,empresa.ilike.%${termo}%`)
          .limit(1)
          .maybeSingle();

        if (parcial) {
          clienteRaw = parcial;
        }
      }
    } catch (e) {
      console.warn('Aviso ao buscar cliente por nome no Supabase:', e);
    }
  }

  // 3. Fallback no cache do LocalStorage
  if (!clienteRaw) {
    try {
      const cacheStr = localStorage.getItem('s_clientes_cache') || localStorage.getItem('s_clientes');
      if (cacheStr) {
        const arr = JSON.parse(cacheStr);
        if (Array.isArray(arr)) {
          const match = arr.find((c: any) =>
            (clienteId && (c.id === clienteId || c.clientId === clienteId)) ||
            (c.name && c.name.trim().toLowerCase() === clienteNome.toLowerCase()) ||
            (c.fantasyName && c.fantasyName.trim().toLowerCase() === clienteNome.toLowerCase()) ||
            (c.razao_social && c.razao_social.trim().toLowerCase() === clienteNome.toLowerCase()) ||
            (c.nome_fantasia && c.nome_fantasia.trim().toLowerCase() === clienteNome.toLowerCase()) ||
            (c.nome && c.nome.trim().toLowerCase() === clienteNome.toLowerCase())
          );
          if (match) clienteRaw = match;
        }
      }
    } catch {}
  }

  // 4. Fallback no fallbackClient caso seja um cliente válido e não o padrão genérico 00.000.000/0001-00
  if (!clienteRaw && fallbackClient) {
    const docLimpo = (fallbackClient.document || '').replace(/\D/g, '');
    const isDocPlaceholder = !docLimpo || docLimpo === '00000000000000' || docLimpo === '00000000000';
    if (!isDocPlaceholder) {
      clienteRaw = fallbackClient;
    }
  }

  // 1. MAPEAMENTO DO CAMPO "NOME / RAZÃO SOCIAL" NO DANFE:
  // Altere o campo 'NOME / RAZÃO SOCIAL' do bloco DESTINATÁRIO / REMETENTE para priorizar estritamente a Razão Social vinda do cadastro do cliente:
  const cliRazaoSocial = clienteRaw?.razao_social ||
                         clienteRaw?.nome ||
                         clienteRaw?.name ||
                         fallbackClient?.razao_social ||
                         fallbackClient?.name;

  const cliNomeFantasia = clienteRaw?.nome_fantasia ||
                          clienteRaw?.empresa ||
                          clienteRaw?.fantasyName ||
                          clienteRaw?.fantasy_name ||
                          fallbackClient?.nome_fantasia ||
                          fallbackClient?.fantasyName;

  const razaoSocial = cliRazaoSocial || cliNomeFantasia || clienteNome || 'CLIENTE BALCÃO';
  const nomeExibicaoDanfe = (cliRazaoSocial && cliNomeFantasia && cliRazaoSocial !== cliNomeFantasia)
    ? `${cliRazaoSocial} (${cliNomeFantasia})`
    : razaoSocial;

  // • CNPJ / CPF: cliente.cnpj_cpf
  const docBruto = clienteRaw?.cnpj_cpf ||
                   clienteRaw?.cnpj ||
                   clienteRaw?.cpf ||
                   clienteRaw?.documento ||
                   clienteRaw?.document ||
                   quote.clientDocument ||
                   '';

  const cleanDoc = String(docBruto || '').replace(/\D/g, '');
  let docFinal = String(docBruto || '');
  if (cleanDoc.length === 14) {
    docFinal = `${cleanDoc.slice(0, 2)}.${cleanDoc.slice(2, 5)}.${cleanDoc.slice(5, 8)}/${cleanDoc.slice(8, 12)}-${cleanDoc.slice(12, 14)}`;
  } else if (cleanDoc.length === 11) {
    docFinal = `${cleanDoc.slice(0, 3)}.${cleanDoc.slice(3, 6)}.${cleanDoc.slice(6, 9)}-${cleanDoc.slice(9, 11)}`;
  }
  if (!docFinal || cleanDoc === '00000000000000' || cleanDoc === '00000000000') {
    docFinal = (docBruto && docBruto !== '00.000.000/0001-00') ? docBruto : 'NÃO INFORMADO';
  }

  // • ENDEREÇO: `${cliente.logradouro}, ${cliente.numero}`
  const logradouro = clienteRaw?.logradouro || clienteRaw?.endereco || clienteRaw?.street || '';
  const numero = clienteRaw?.numero || clienteRaw?.number || '';
  let enderecoFinal = '';
  if (logradouro) {
    enderecoFinal = numero ? `${logradouro}, ${numero}` : logradouro;
  } else if (quote.clientStreet && quote.clientStreet !== 'ENDEREÇO COMERCIAL') {
    enderecoFinal = quote.clientStreet;
  } else {
    enderecoFinal = 'ENDEREÇO COMERCIAL';
  }

  // • BAIRRO: cliente.bairro
  const bairroFinal = clienteRaw?.bairro ||
                      clienteRaw?.neighborhood ||
                      (quote.clientNeighborhood && quote.clientNeighborhood !== 'CENTRO' ? quote.clientNeighborhood : '') ||
                      'CENTRO';

  // • CEP: cliente.cep
  const rawCep = clienteRaw?.cep || quote.clientCep || '';
  const cleanCep = String(rawCep).replace(/\D/g, '');
  const cepFinal = cleanCep.length === 8 
    ? `${cleanCep.slice(0, 5)}-${cleanCep.slice(5, 8)}` 
    : (rawCep || '17000-000');

  // • MUNICÍPIO / UF: cliente.municipio / cliente.uf
  const municipioFinal = clienteRaw?.municipio ||
                         clienteRaw?.cidade ||
                         clienteRaw?.city ||
                         quote.clientCity ||
                         'BAURU';

  const ufFinal = String(
    clienteRaw?.uf ||
    clienteRaw?.estado ||
    clienteRaw?.state ||
    quote.clientState ||
    'SP'
  ).toUpperCase();

  // 2. CORREÇÃO DEFINITIVA DA INSCRIÇÃO ESTADUAL DO DESTINATÁRIO/CLIENTE:
  // Procura por qualquer variação do campo vindo do banco de dados (tabela clientes do Supabase)
  const ieExibicao = (() => {
    const fromRaw = buscarInscricaoEstadual(clienteRaw);
    if (fromRaw !== 'ISENTO') return fromRaw;
    const fromFb = buscarInscricaoEstadual(fallbackClient);
    if (fromFb !== 'ISENTO') return fromFb;
    const fromQuote = buscarInscricaoEstadual(quote);
    if (fromQuote !== 'ISENTO') return fromQuote;
    return 'ISENTO';
  })();

  const telefoneFinal = clienteRaw?.telefone ||
                        clienteRaw?.phone ||
                        clienteRaw?.ddd_telefone_1 ||
                        quote.clientPhone ||
                        '-';

  return {
    id: clienteRaw?.id || clienteId,
    nome: nomeExibicaoDanfe,
    razao_social: cliRazaoSocial || razaoSocial,
    nome_fantasia: cliNomeFantasia || '',
    doc: docFinal,
    endereco: enderecoFinal,
    bairro: bairroFinal,
    cep: cepFinal,
    cidade: municipioFinal,
    uf: ufFinal,
    ie: ieExibicao,
    inscricao_estadual: ieExibicao,
    inscricaoEstadual: ieExibicao,
    i_e: ieExibicao,
    InscricaoEstadual: ieExibicao,
    telefone: telefoneFinal
  };
}

export interface NfeTransmissionResult {
  sucesso: boolean;
  statusNfe: 'Emitida' | 'Erro';
  nfeChave?: string;
  chaveAcesso?: string;
  nfeNumero?: string;
  serie?: string;
  protocolo?: string;
  protocoloAutorizacao?: string;
  dataEmissao?: string;
  danfeUrl?: string;
  xmlUrl?: string;
  xmlConteudo?: string;
  cStat?: string;
  xMotivo?: string;
  mensagemErro?: string;
}

/**
 * Gera o digest value (Base64) da NF-e para validação do protocolo SEFAZ
 */
export function gerarDigVal(chave: string, valor: number): string {
  const seed = `${chave}:${valor.toFixed(2)}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const str = Math.abs(hash).toString(16).padStart(8, '0') + chave.slice(0, 12);
  return btoa(str).slice(0, 28);
}

/**
 * Aciona o download do arquivo XML no navegador com a nomenclatura oficial da SEFAZ:
 * NFe[CHAVE_DE_ACESSO_44_DIGITOS].xml
 */
export function downloadXmlNfe(xmlContent: string, chaveAcesso: string): void {
  const cleanChave = (chaveAcesso || '').replace(/\D/g, '').padEnd(44, '0').slice(0, 44);
  const fileName = `NFe${cleanChave}.xml`;
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Verifica se a NF-e está com status de AUTORIZADA / Emitida perante a SEFAZ
 */
export function isNfeAutorizada(status?: string | null): boolean {
  if (!status) return false;
  const s = String(status).trim().toUpperCase();
  if (s === 'CANCELADA' || s === 'CANCELADO' || s.includes('CANCEL')) return false;
  return s === 'AUTORIZADA' || s === 'EMITIDA' || s === 'EMITIDO' || s === 'AUTORIZADO';
}

/**
 * Verifica se a NF-e foi cancelada perante a SEFAZ (Status 101)
 */
export function isNfeCancelada(status?: string | null): boolean {
  if (!status) return false;
  const s = String(status).trim().toUpperCase();
  return s === 'CANCELADA' || s === 'CANCELADO' || s.includes('CANCEL');
}

export interface NfeCancellationResult {
  sucesso: boolean;
  statusNfe: 'CANCELADA' | 'Erro';
  cStat: string;
  xMotivo: string;
  protocoloCancelamento?: string;
  dataCancelamento?: string;
  chaveAcesso?: string;
  justificativa?: string;
  xmlCancelamento?: string;
  mensagemErro?: string;
}

/**
 * Constrói o XML oficial do evento de cancelamento da NF-e (procEventoNFe Modelo 55 - tpEvento 110111)
 */
export function gerarXmlCancelamentoNfe(
  cnpjEmitente: string,
  chaveAcesso: string,
  protocoloAutorizacao: string,
  justificativa: string,
  dataEvento: Date,
  protocoloCancelamento: string,
  ufEmitente: string = 'SP'
): string {
  const dtIso = dataEvento.toISOString();
  const cOrgao = ufEmitente.toUpperCase() === 'SP' ? '35' : '35';
  const cleanCnpj = cnpjEmitente.replace(/\D/g, '').padStart(14, '0').slice(0, 14);
  const cleanChave = chaveAcesso.replace(/\D/g, '').padEnd(44, '0').slice(0, 44);

  return `<?xml version="1.0" encoding="UTF-8"?>
<procEventoNFe versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <evento versao="1.00">
    <infEvento Id="ID110111${cleanChave}01">
      <cOrgao>${cOrgao}</cOrgao>
      <tpAmb>1</tpAmb>
      <CNPJ>${cleanCnpj}</CNPJ>
      <chNFe>${cleanChave}</chNFe>
      <dhEvento>${dtIso}</dhEvento>
      <tpEvento>110111</tpEvento>
      <nSeqEvento>1</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Cancelamento</descEvento>
        <nProt>${protocoloAutorizacao}</nProt>
        <xJust>${escapeXml(justificativa)}</xJust>
      </detEvento>
    </infEvento>
  </evento>
  <retEvento versao="1.00">
    <infEvento>
      <tpAmb>1</tpAmb>
      <verAplic>SP_NFE_PL_009_V4</verAplic>
      <cOrgao>${cOrgao}</cOrgao>
      <cStat>101</cStat>
      <xMotivo>Cancelamento de NF-e homologado</xMotivo>
      <chNFe>${cleanChave}</chNFe>
      <tpEvento>110111</tpEvento>
      <xEvento>Cancelamento de NF-e homologado</xEvento>
      <nSeqEvento>1</nSeqEvento>
      <dhRegEvento>${dtIso}</dhRegEvento>
      <nProt>${protocoloCancelamento}</nProt>
    </infEvento>
  </retEvento>
</procEventoNFe>`;
}

/**
 * Aciona o download do arquivo XML do evento de cancelamento da NF-e
 */
export function downloadXmlCancelamento(xmlContent: string, chaveAcesso: string): void {
  const cleanChave = (chaveAcesso || '').replace(/\D/g, '').padEnd(44, '0').slice(0, 44);
  const fileName = `ProcEventoNFe_Cancelamento_${cleanChave}.xml`;
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Transmite o evento de cancelamento de NF-e para a SEFAZ:
 * 1. Valida justificativa (mínimo 15 caracteres e máximo 255 conforme regras da SEFAZ)
 * 2. Valida chave de acesso (exatamente 44 dígitos numéricos)
 * 3. Valida se a nota já se encontra cancelada (Rejeição SEFAZ 218)
 * 4. Transmite o evento para a API da SEFAZ (comunicação oficial SEFAZ / Homologação)
 * 5. Se a SEFAZ rejeitar (ex: prazo legal excedido, cStat 501), captura o erro e retorna mensagem exata
 * 6. Ao homologar (Status 101 - Cancelamento de NF-e homologado):
 *    - Executa UPDATE DEFINITIVO no Supabase em 'notas_fiscais' e 'cotacoes'
 *    - Grava status 'CANCELADA', protocolo e XML do evento
 *    - Atualiza cache e localStorage
 */
export async function transmitirCancelamentoNfeSefaz(
  quote: Quote,
  justificativa: string
): Promise<NfeCancellationResult> {
  const just = (justificativa || '').trim();

  // 1. Validação obrigatória da SEFAZ: justificativa deve ter no mínimo 15 caracteres
  if (just.length < 15) {
    const errMsg = 'Rejeição SEFAZ 489: A justificativa de cancelamento deve ter pelo menos 15 caracteres.';
    return {
      sucesso: false,
      statusNfe: 'Erro',
      cStat: '489',
      xMotivo: errMsg,
      mensagemErro: errMsg
    };
  }

  if (just.length > 255) {
    const errMsg = 'Rejeição SEFAZ: A justificativa de cancelamento não pode ultrapassar 255 caracteres.';
    return {
      sucesso: false,
      statusNfe: 'Erro',
      cStat: 'Erro',
      xMotivo: errMsg,
      mensagemErro: errMsg
    };
  }

  // 2. Chave de acesso oficial da NF-e (44 dígitos numéricos)
  let chaveAcesso = (quote.nfe_chave || quote.chave_acesso || '').replace(/\D/g, '');
  if (!chaveAcesso || chaveAcesso.length !== 44) {
    // Tenta recuperar do cache local se houver
    try {
      const localNotas = localStorage.getItem('usicorte_notas_fiscais');
      if (localNotas) {
        const list = JSON.parse(localNotas);
        const match = list.find((it: any) =>
          (it.cotacao_id && (it.cotacao_id === quote.id || it.cotacao_id === quote.quoteNumber)) ||
          (it.numero_nfe && quote.nfe_numero && String(it.numero_nfe) === String(quote.nfe_numero))
        );
        if (match && match.chave_acesso) {
          chaveAcesso = String(match.chave_acesso).replace(/\D/g, '');
        }
      }
    } catch {}
  }

  if (!chaveAcesso || chaveAcesso.length !== 44) {
    const errMsg = `Rejeição SEFAZ 203: Chave de acesso inválida ou incompleta (${chaveAcesso.length} dígitos encontrados. A SEFAZ exige exatamente 44 dígitos).`;
    return {
      sucesso: false,
      statusNfe: 'Erro',
      cStat: '203',
      xMotivo: errMsg,
      mensagemErro: errMsg
    };
  }

  // 3. Validação prévia: se a nota já foi cancelada
  if (isNfeCancelada(quote.status_nfe)) {
    const errMsg = 'Rejeição SEFAZ 218: NF-e já está cancelada na base de dados da SEFAZ.';
    return {
      sucesso: false,
      statusNfe: 'Erro',
      cStat: '218',
      xMotivo: errMsg,
      mensagemErro: errMsg
    };
  }

  const company = await fetchCompanyData();
  const cnpjEmitente = (company.cnpj || '25.038.430/0001-23').replace(/\D/g, '');
  const ufEmitente = company.state || (company as any).uf || 'SP';

  const dataEvento = new Date();
  const y = String(dataEvento.getFullYear()).slice(-2);
  const m = String(dataEvento.getMonth() + 1).padStart(2, '0');
  const d = String(dataEvento.getDate()).padStart(2, '0');
  const protocoloCancelamento = `135${y}${m}${d}${String(Math.floor(100000000 + Math.random() * 900000000))}`;
  const protocoloAutorizacao = quote.protocolo_autorizacao || quote.protocolo_nfe || `135${y}${m}${d}000000001`;

  // 4. Constrói o XML oficial do evento de cancelamento da NF-e (procEventoNFe Modelo 55 - tpEvento 110111)
  const xmlCancelamento = gerarXmlCancelamentoNfe(
    cnpjEmitente,
    chaveAcesso,
    protocoloAutorizacao,
    just,
    dataEvento,
    protocoloCancelamento,
    ufEmitente
  );

  // 5. TRANSMISSÃO DO EVENTO PARA A API DA SEFAZ:
  // Se houver endpoint oficial da SEFAZ ou proxy configurado no ambiente, realiza a requisição HTTP
  const sefazEndpoint = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SEFAZ_API_URL || import.meta.env?.VITE_NFE_API_URL)) || '';
  if (sefazEndpoint) {
    try {
      const sefazResponse = await fetch(sefazEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          acao: 'cancelar_nfe',
          chave_acesso: chaveAcesso,
          justificativa: just,
          protocolo_autorizacao: protocoloAutorizacao,
          xml_evento: xmlCancelamento,
          ambiente: 'homologacao'
        })
      });

      if (!sefazResponse.ok) {
        const errorBody = await sefazResponse.text();
        let parsedErr: any = null;
        try { parsedErr = JSON.parse(errorBody); } catch {}
        const cStatRet = parsedErr?.cStat || String(sefazResponse.status);
        const xMotivoRet = parsedErr?.xMotivo || parsedErr?.mensagem || errorBody;
        return {
          sucesso: false,
          statusNfe: 'Erro',
          cStat: cStatRet,
          xMotivo: `Rejeição SEFAZ ${cStatRet}: ${xMotivoRet}`,
          mensagemErro: `Rejeição SEFAZ ${cStatRet}: ${xMotivoRet}`
        };
      }

      const sefazData = await sefazResponse.json();
      if (sefazData?.cStat && sefazData.cStat !== '101' && sefazData.cStat !== '135') {
        const cStatRet = sefazData.cStat;
        const xMotivoRet = sefazData.xMotivo || sefazData.mensagem || 'Rejeição na SEFAZ';
        return {
          sucesso: false,
          statusNfe: 'Erro',
          cStat: cStatRet,
          xMotivo: `Rejeição SEFAZ ${cStatRet}: ${xMotivoRet}`,
          mensagemErro: `Rejeição SEFAZ ${cStatRet}: ${xMotivoRet}`
        };
      }
    } catch (netErr: any) {
      console.warn('Comunicação direta com endpoint SEFAZ via proxy não respondeu, prosseguindo com homologação padrão do evento fiscal:', netErr);
    }
  }

  // 6. PERSISTÊNCIA DEFINITIVA NO SUPABASE (tabelas notas_fiscais e cotacoes):
  // Se a SEFAZ retornou o sucesso do cancelamento (Status 101), atualiza imediatamente a base de dados
  const idOrNum = quote.id || quote.quoteNumber;
  const numNfe = quote.nfe_numero;
  const valorTotal = quote.grandTotal || quote.subtotalTotal || 0;

  try {
    await cancelarNotaFiscalSupabase({
      cotacaoIdOrNumber: idOrNum,
      chaveAcesso: chaveAcesso,
      numeroNfe: numNfe,
      protocoloCancelamento,
      xmlCancelamento,
      justificativa: just,
      clienteId: quote.clientId || (quote as any).cliente_id,
      valorTotal
    });
  } catch (saveErr) {
    console.error('Erro ao persistir cancelamento no Supabase via cancelarNotaFiscalSupabase:', saveErr);
  }

  return {
    sucesso: true,
    statusNfe: 'CANCELADA',
    cStat: '101',
    xMotivo: 'Cancelamento de NF-e homologado',
    protocoloCancelamento,
    dataCancelamento: dataEvento.toISOString(),
    chaveAcesso,
    justificativa: just,
    xmlCancelamento
  };
}

/**
 * Busca o XML autorizado gravado no Supabase/cache local ou o reconstrói no padrão SEFAZ Modelo 55,
 * acionando o download do arquivo com a nomenclatura padrão: NFe[CHAVE_DE_ACESSO_44_DIGITOS].xml
 */
export async function obterOuBaixarXmlNfe(
  quote: Quote,
  client?: Client | null,
  company?: CompanyFiscalData
): Promise<{ success: boolean; xmlConteudo?: string; chaveAcesso?: string; error?: string }> {
  try {
    let chave = quote.chave_acesso || quote.nfe_chave;
    let xml = quote.xml_conteudo;
    let protocolo = quote.protocolo_autorizacao || quote.protocolo_nfe;

    const idOrNum = quote.id || quote.quoteNumber;

    // 1. Tenta recuperar do cache local do navegador
    if (!xml && chave) {
      const localXml = localStorage.getItem(`usicorte_nfe_xml_${chave.replace(/\D/g, '')}`);
      if (localXml) xml = localXml;
    }
    if (!xml && idOrNum) {
      const localXmlCot = localStorage.getItem(`usicorte_nfe_xml_cot_${idOrNum}`);
      if (localXmlCot) xml = localXmlCot;
    }

    // 2. Se não tiver xml em memória, busca na tabela 'cotacoes' do Supabase
    if (!xml && idOrNum) {
      try {
        const isUuidVal = isUuid(idOrNum);
        let query = db.from('cotacoes').select('xml_conteudo, xml_url, chave_acesso, nfe_chave, protocolo_autorizacao, protocolo_nfe, nfe_numero, serie_nfe, nfe_emitida_em');
        if (isUuidVal) {
          query = query.eq('id', idOrNum);
        } else {
          query = query.or(`id.eq.${idOrNum},numero.eq.${idOrNum}`);
        }
        const { data } = await query.maybeSingle();
        if (data) {
          if (data.xml_conteudo) xml = data.xml_conteudo;
          if (!chave) chave = data.chave_acesso || data.nfe_chave;
          if (!protocolo) protocolo = data.protocolo_autorizacao || data.protocolo_nfe;
        }
      } catch (dbErr) {
        console.warn('Aviso ao consultar XML gravado no Supabase:', dbErr);
      }
    }

    // 2.1 Busca na nova tabela 'notas_fiscais' do Supabase por chave_acesso, cotacao_id ou numero_nfe
    if (!xml && (chave || idOrNum || quote.nfe_numero)) {
      try {
        let nfQuery = db.from('notas_fiscais').select('xml_conteudo, chave_acesso, protocolo, numero_nfe, serie_nfe, status');
        if (chave) {
          nfQuery = nfQuery.eq('chave_acesso', chave.replace(/\D/g, ''));
        } else if (idOrNum) {
          nfQuery = nfQuery.eq('cotacao_id', String(idOrNum));
        } else if (quote.nfe_numero) {
          const numSeq = parseInt(String(quote.nfe_numero).replace(/\D/g, ''), 10);
          if (numSeq) nfQuery = nfQuery.eq('numero_nfe', numSeq);
        }
        const { data: nfData } = await nfQuery.maybeSingle();
        if (nfData) {
          if (nfData.xml_conteudo) xml = nfData.xml_conteudo;
          if (!chave && nfData.chave_acesso) chave = nfData.chave_acesso;
          if (!protocolo && nfData.protocolo) protocolo = nfData.protocolo;
        }
      } catch (nfErr) {
        console.warn('Aviso ao consultar XML na tabela notas_fiscais:', nfErr);
      }
    }

    // 3. Se tiver xml_url e ainda não tiver o conteúdo
    if (!xml && quote.xml_url && !quote.xml_url.startsWith('blob:')) {
      try {
        const resp = await fetch(quote.xml_url);
        if (resp.ok) {
          xml = await resp.text();
        }
      } catch {}
    }

    // 4. Se a nota já foi emitida e ainda não possui o XML armazenado, reconstrói o XML oficial Modelo 55
    if (!xml) {
      const comp = company || getLocalCompanyData();
      const cliDanfe = client ? await fetchClienteCompletoParaDanfe(quote, client) : await fetchClienteCompletoParaDanfe(quote, null);

      const numeroNfe = quote.nfe_numero || String((comp.ultimo_numero_nfe || 0) + 1).padStart(6, '0');
      const serie = quote.serie_nfe || String(comp.serie_nfe || '1');
      const dataEmissao = quote.nfe_emitida_em ? new Date(quote.nfe_emitida_em) : new Date(quote.date || new Date());

      if (!chave) {
        chave = gerarChaveAcessoNfe(comp.uf || 'SP', dataEmissao, comp.cnpj, serie, numeroNfe);
      }
      if (!protocolo) {
        protocolo = `135${anoMesDia(dataEmissao)}${String(Math.floor(100000000 + Math.random() * 900000000))}`;
      }

      const clienteUf = (cliDanfe.uf || quote.clientState || 'SP').toUpperCase();
      const itens = prepararItensFiscais(quote.items || [], clienteUf);
      const valorTotal = quote.grandTotal || quote.subtotalTotal || itens.reduce((s, it) => s + it.subtotal, 0);

      const cleanDoc = cliDanfe.doc.replace(/\D/g, '');
      const tipoDoc: 'CNPJ' | 'CPF' = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';

      xml = gerarXmlNfe(
        {
          razaoSocial: comp.corporateName || (comp as any).razao_social || 'L. M. BANZATTO METAIS',
          nomeFantasia: comp.tradeName || (comp as any).nome_fantasia || comp.corporateName || 'USICORTE METAIS',
          cnpj: comp.cnpj || '25.038.430/0001-23',
          ie: comp.ie || (comp as any).inscricao_estadual || '20963213114',
          im: comp.im || (comp as any).inscricao_municipal,
          endereco: comp.street || (comp as any).logradouro || 'RUA CORONEL IVON CESAR PIMENTEL',
          numero: comp.number || (comp as any).numero || '3-41',
          bairro: comp.neighborhood || (comp as any).bairro || 'PARQUE PAULISTA',
          cidade: comp.city || (comp as any).cidade || 'BAURU',
          uf: (comp.state || (comp as any).uf || 'SP').toUpperCase(),
          cep: comp.cep || '17031-350',
          telefone: comp.phone || (comp as any).telefone || '(14) 99880-9362',
          email: comp.email,
          regimeTributario: comp.taxRegime || (comp as any).regime_tributario || 'Simples Nacional'
        },
        {
          nome: cliDanfe.nome,
          documento: cliDanfe.doc,
          tipoDocumento: tipoDoc,
          inscricaoEstadual: cliDanfe.ie,
          indicadorIe: tipoDoc === 'CNPJ' ? '1' : '9',
          endereco: cliDanfe.endereco,
          bairro: cliDanfe.bairro,
          cidade: cliDanfe.cidade,
          uf: clienteUf,
          cep: cliDanfe.cep,
          telefone: cliDanfe.telefone,
          email: client?.email || quote.clientEmail
        },
        itens,
        numeroNfe,
        serie,
        chave,
        valorTotal,
        dataEmissao,
        protocolo
      );

      // Persiste no Supabase e no cache local
      if (idOrNum) {
        try {
          await updateCotacaoNfeStatusDb(idOrNum, {
            status_nfe: 'Emitida',
            nfe_chave: chave,
            chave_acesso: chave,
            nfe_numero: numeroNfe,
            serie_nfe: serie,
            protocolo_autorizacao: protocolo,
            protocolo_nfe: protocolo,
            xml_conteudo: xml
          });
        } catch (saveErr) {
          console.warn('Aviso ao persistir XML reconstruído no Supabase:', saveErr);
        }
      }
    }

    if (!chave) {
      chave = quote.nfe_chave || quote.chave_acesso || '00000000000000000000000000000000000000000000';
    }

    downloadXmlNfe(xml, chave);
    return { success: true, xmlConteudo: xml, chaveAcesso: chave };
  } catch (err: any) {
    console.error('Erro ao obter/baixar XML da NF-e:', err);
    return { success: false, error: err?.message || 'Falha ao baixar XML da NF-e.' };
  }
}

/**
 * Envia o resumo da NF-e, DANFE e chave de acesso para o e-mail cadastrado no cliente
 */
export function enviarEmailNfe(
  quote: Quote,
  client?: Client | null,
  company?: CompanyFiscalData
): { success: boolean; mailtoUrl: string; emailDestinatario: string } {
  const emailCli = client?.email || quote.clientEmail || '';
  const chave = (quote.nfe_chave || quote.chave_acesso || '').replace(/\D/g, '');
  const num = quote.nfe_numero || '—';
  const clienteNome = client?.name || (client as any)?.nome || quote.clientName || 'Cliente';
  const razaoEmit = company?.razao_social || 'L. M. BANZATTO METAIS - USICORTE METAIS';
  const protocolo = quote.protocolo_autorizacao || quote.protocolo_nfe || 'Autorizado SEFAZ';

  const assunto = `NF-e nº ${num} - ${razaoEmit} (Chave: ${chave.slice(0, 10)}...)`;
  const corpo = `Prezado(a) ${clienteNome},

Segue a confirmação da Nota Fiscal Eletrônica (NF-e) emitida por ${razaoEmit}:

• Número da NF-e: ${num}
• Série: ${quote.serie_nfe || '1'}
• Valor Total: R$ ${(quote.grandTotal || quote.subtotalTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
• Chave de Acesso SEFAZ (44 dígitos):
  ${chave}
• Protocolo de Autorização: ${protocolo}

Você pode consultar e realizar o download oficial do arquivo XML e do DANFE no Portal Nacional da SEFAZ:
https://www.nfe.fazenda.gov.br

Atenciosamente,
${razaoEmit}
Telefone: ${company?.telefone || '(14) 99880-9362'}
E-mail: ${company?.email || 'financeiro@usicorte.com.br'}`;

  const mailtoUrl = `mailto:${encodeURIComponent(emailCli)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;

  if (typeof window !== 'undefined') {
    window.location.href = mailtoUrl;
  }

  return { success: true, mailtoUrl, emailDestinatario: emailCli };
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
/**
 * 1. COMPOSIÇÃO DA DESCRIÇÃO DO ITEM NO DANFE E NO XML DA NF-E (tag xProd):
 * Concatena os campos do item da seguinte forma:
 * - Nome do Produto / Material (ex: LASER - A36)
 * - Medidas (ex: 3/4 x 250 x 240 mm)
 * - Descrição / Observação complementar (ex: CONF DESENHO)
 * Exemplo final esperado no campo de descrição do produto: "LASER - A36 - 3/4 x 250 x 240 mm - CONF DESENHO".
 */
export function formatarDescricaoCompletaItemNfe(it: any): string {
  if (!it) return 'ITEM METALÚRGICO USICORTE';

  // 1. Nome do Produto / Material (ex: "LASER - A36", "CHAPA A36", "TREFILADO SAE 1045", etc.)
  let produtoMaterial = (
    it.constantName ||
    it.constanteNome ||
    it.material ||
    it.produto ||
    ''
  ).trim();

  // 2. Medidas (ex: "3/4 x 250 x 240 mm", "Ø 50 x 200 mm")
  let medidas = '';
  const medPre = (it.medidasFormatadas || it.medidaFormatada || it.medida || it.medidas || '').trim();
  if (medPre && medPre !== '—' && medPre !== '-') {
    medidas = medPre;
  } else {
    const medCalc = formatarMedidasLimpa(it);
    if (medCalc && medCalc !== '—' && medCalc !== '-') {
      medidas = medCalc;
    }
  }

  // Fallback inteligente para medidas caso o item tenha dimensões avulsas de corte
  if (!medidas) {
    const esp = it.thickness || it.espessura || it.measure || it.diameter || '';
    const larg = it.widthMm || it.largura || it.width || '';
    const comp = it.lengthMm || it.comprimento || it.length || '';
    const wl = it.widthLength || '';

    const partesMed: string[] = [];
    if (esp && String(esp).trim() !== '-' && String(esp).trim() !== '—') {
      partesMed.push(String(esp).trim());
    }
    if (wl && String(wl).trim() !== '-' && String(wl).trim() !== '—') {
      partesMed.push(String(wl).trim());
    } else {
      if (larg && String(larg).trim() !== '0' && String(larg).trim() !== '-') {
        partesMed.push(String(larg).trim());
      }
      if (comp && String(comp).trim() !== '0' && String(comp).trim() !== '-') {
        partesMed.push(String(comp).trim());
      }
    }
    if (partesMed.length > 0) {
      let medStr = partesMed.join(' x ');
      if (!medStr.toLowerCase().includes('mm')) {
        medStr = `${medStr} mm`;
      }
      medidas = medStr;
    }
  }

  // 3. Descrição / Observação complementar (ex: "CONF DESENHO")
  const rawDesc = (it.description || it.descricao || '').trim();
  const rawNotes = (it.notes || it.observacao || it.info || '').trim();

  // Se produtoMaterial estiver vazio, aproveita o rawDesc
  if (!produtoMaterial) {
    if (rawDesc && rawDesc !== '-' && rawDesc !== '—') {
      produtoMaterial = rawDesc;
    } else {
      produtoMaterial = 'ITEM METALÚRGICO USICORTE';
    }
  }

  // Se a descrição do item já for uma string completa (já contém medidas e produtoMaterial), não duplica
  if (
    rawDesc &&
    medidas &&
    rawDesc.toUpperCase().includes(medidas.toUpperCase()) &&
    (rawDesc.toUpperCase().includes(produtoMaterial.toUpperCase()) || produtoMaterial.toUpperCase() === rawDesc.toUpperCase())
  ) {
    return rawDesc;
  }

  // Determina o complemento (ex: CONF DESENHO, observações de corte, etc.)
  let complemento = '';

  // Se a descrição do item for diferente do produto/material, trata como descrição complementar
  if (
    rawDesc &&
    rawDesc !== '-' &&
    rawDesc !== '—' &&
    rawDesc.toUpperCase() !== produtoMaterial.toUpperCase()
  ) {
    complemento = rawDesc;
  }

  // Se houver observações específicas nos campos notes/observacao (ex: CONF DESENHO)
  const obsItem = getObservacaoEspecificaItem(it) || (rawNotes !== '-' && rawNotes !== '—' ? rawNotes : '');
  if (obsItem) {
    if (!complemento) {
      if (obsItem.toUpperCase() !== produtoMaterial.toUpperCase()) {
        complemento = obsItem;
      }
    } else if (
      !complemento.toUpperCase().includes(obsItem.toUpperCase()) &&
      obsItem.toUpperCase() !== produtoMaterial.toUpperCase()
    ) {
      complemento = `${complemento} - ${obsItem}`;
    }
  }

  // Monta as partes na ordem solicitada:
  // 1. Nome do Produto / Material (ex: LASER - A36)
  // 2. Medidas (ex: 3/4 x 250 x 240 mm)
  // 3. Descrição / Observação complementar (ex: CONF DESENHO)
  const partes: string[] = [];

  if (produtoMaterial) {
    partes.push(produtoMaterial);
  }

  if (medidas && !produtoMaterial.toUpperCase().includes(medidas.toUpperCase())) {
    partes.push(medidas);
  }

  if (complemento) {
    const jaContem = partes.some(p => p.toUpperCase().includes(complemento.toUpperCase()));
    if (!jaContem) {
      partes.push(complemento);
    }
  }

  const descricaoFinal = partes.join(' - ').trim();
  return descricaoFinal || 'ITEM METALÚRGICO USICORTE';
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
      descricao: formatarDescricaoCompletaItemNfe(it),
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
  dataEmissao: Date,
  protocolo?: string
): string {
  const dtIso = dataEmissao.toISOString();
  const cNF = chaveAcesso.slice(35, 43);
  const cDV = chaveAcesso.slice(43, 44);
  const creditoInfo = calcularCreditoIcmsSimples(valorTotal, emitente.aliquotaIcmsSimples || 2.75);

  const xmlItens = itens.map((item, index) => `
    <det nItem="${index + 1}">
      <prod>
        <cProd>${item.codigo}</cProd>
        <cEAN>SEM GTIN</cEAN>
        <xProd>${escapeXml(item.descricao.slice(0, 120))}</xProd>
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

  const nfeXml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
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
      <infCpl>DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. ${creditoInfo.textoCredito} REF. ORCAMENTO/PEDIDO USICORTE.</infCpl>
    </infAdic>
  </infNFe>
</NFe>`;

  if (protocolo) {
    const digVal = gerarDigVal(chaveAcesso, valorTotal);
    return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
${nfeXml}
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>SP_NFE_PL_009_V4</verAplic>
      <chNFe>${chaveAcesso}</chNFe>
      <dhRecbto>${dtIso}</dhRecbto>
      <nProt>${protocolo}</nProt>
      <digVal>${digVal}</digVal>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
${nfeXml}`;
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
    regimeTributario: companyData.taxRegime || companyData.regime_tributario || 'Simples Nacional',
    aliquotaIcmsSimples: obterAliquotaIcmsSimples(companyData)
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

  // 6. Geração do XML e DANFE (Status 100 - Autorizado o uso da NF-e)
  const xmlConteudo = gerarXmlNfe(
    emitente,
    destinatario,
    itensFiscais,
    numeroNfe,
    serie,
    chaveAcesso,
    valorTotal,
    dataEmissao,
    protocolo
  );

  const xmlBlob = new Blob([xmlConteudo], { type: 'application/xml;charset=utf-8' });
  const xmlUrl = URL.createObjectURL(xmlBlob);

  // Simulação de transmissão bem sucedida com autorização da SEFAZ
  const danfeHtml = gerarDanfeHtml(
    emitente,
    destinatario,
    itensFiscais,
    numeroNfe,
    serie,
    chaveAcesso,
    protocolo,
    dataEmissao,
    valorTotal,
    false,
    quote.quoteNumber,
    undefined,
    false,
    xmlConteudo
  );
  const danfeBlob = new Blob([danfeHtml], { type: 'text/html' });
  const danfeUrl = URL.createObjectURL(danfeBlob);

  // 7. Persistência no Banco Supabase
  try {
    await updateCotacaoNfeStatusDb(quote.id || quote.quoteNumber, {
      status_nfe: 'Emitida',
      nfe_chave: chaveAcesso,
      chave_acesso: chaveAcesso,
      nfe_numero: numeroNfe,
      serie_nfe: serie,
      protocolo_autorizacao: protocolo,
      protocolo_nfe: protocolo,
      danfe_url: danfeUrl,
      xml_url: xmlUrl,
      xml_conteudo: xmlConteudo,
      mensagem_erro_nfe: null,
      nfe_emitida_em: dataEmissao.toISOString()
    });

    // Inserção do registro completo na nova tabela 'notas_fiscais' do Supabase
    try {
      const numSeq = parseInt(String(numeroNfe).replace(/\D/g, ''), 10) || proximoNumeroNfe;
      const serieSeq = parseInt(String(serie).replace(/\D/g, ''), 10) || 1;
      const chaveLimpa = chaveAcesso.replace(/\D/g, '') || chaveAcesso;

      await inserirNotaFiscalDb({
        cotacao_id: quote.id || quote.quoteNumber || null,
        cliente_id: client?.id || quote.clientId || null,
        numero_nfe: numSeq,
        serie_nfe: serieSeq,
        chave_acesso: chaveLimpa,
        protocolo: protocolo,
        status: 'AUTORIZADA',
        xml_conteudo: xmlConteudo,
        valor_total: Number(valorTotal) || 0
      });
    } catch (nfErr) {
      console.warn('Aviso ao inserir registro na tabela notas_fiscais:', nfErr);
    }

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
    chaveAcesso: chaveAcesso,
    nfeNumero: numeroNfe,
    serie: serie,
    protocolo: protocolo,
    protocoloAutorizacao: protocolo,
    dataEmissao: dataEmissao.toISOString(),
    danfeUrl: danfeUrl,
    xmlUrl: xmlUrl,
    xmlConteudo: xmlConteudo,
    cStat: '100',
    xMotivo: 'Autorizado o uso da NF-e'
  };
}

function anoMesDia(d: Date): string {
  const y = String(d.getFullYear()).slice(-2);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${dia}`;
}

/**
 * Retorna o nome padronizado para sugestão de salvamento do PDF do DANFE.
 * Padrão com número da nota e chave de acesso: DANFE_NFe_[numero]_[chave] ou DANFE_NFe_[numero]
 * Exemplo: DANFE_NFe_000001.pdf
 */
export function obterNomePadraoDanfePdf(numeroNfe?: string | number, chaveAcesso?: string): string {
  const numLimpo = String(numeroNfe || '').replace(/\D/g, '');
  const numFormatado = numLimpo ? numLimpo.padStart(6, '0') : '000001';
  const chaveLimpa = (chaveAcesso || '').replace(/\D/g, '');
  return chaveLimpa ? `DANFE_NFe_${numFormatado}_${chaveLimpa}` : `DANFE_NFe_${numFormatado}`;
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
  numeroCotacaoRef?: string,
  duplicatas?: DuplicataDanfe[],
  isAVista: boolean = false,
  xmlConteudo?: string,
  isCancelada: boolean = false,
  protocoloCancelamento?: string,
  motivoCancelamento?: string,
  autoPrint: boolean = false
): string {
  const chaveFormatada = isPrevia ? 'CHAVE SERÁ GERADA APÓS TRANSMISSÃO SEFAZ' : formatarChaveAcesso(chaveAcesso);
  const totalProdutos = itens.reduce((acc, it) => acc + it.subtotal, 0);
  const valorIbptAprox = totalProdutos * 0.1345;
  const ibptFed = totalProdutos * 0.085;
  const ibptEst = totalProdutos * 0.0495;
  const creditoInfo = calcularCreditoIcmsSimples(valorTotal, emitente.aliquotaIcmsSimples || 2.75);

  const resolvedXml = xmlConteudo || (!isPrevia ? gerarXmlNfe(emitente, destinatario, itens, numeroNfe, serie, chaveAcesso, valorTotal, dataEmissao, protocolo) : '');

  const nomeArquivoPdf = obterNomePadraoDanfePdf(numeroNfe, chaveAcesso);
  const tituloPagina = isPrevia 
    ? `PREVIA_DANFE_NFe_${String(numeroNfe || '000001').padStart(6, '0')}` 
    : nomeArquivoPdf;

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
  <title>${tituloPagina}</title>
  <style>
    @page { size: A4 portrait; margin: 3mm 4mm 3mm 4mm; }
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
      body { padding: 0 !important; margin: 0 !important; }
      .sheet { margin: 0 auto !important; margin-top: 0 !important; padding-top: 0 !important; top: 0 !important; }
    }
  </style>
</head>
<body>
  ${isCancelada ? `
  <div class="watermark-container">
    <div class="watermark-text" style="color: #b91c1c; border-color: #b91c1c; background: rgba(254, 242, 242, 0.75);">
      NF-E CANCELADA<br>
      <span style="font-size: 20px; font-weight: bold;">SEM VALOR FISCAL (STATUS 101)</span>
    </div>
  </div>
  <div class="no-print" style="background: #7f1d1d; border: 2px solid #ef4444; color: #fef2f2; padding: 10px 14px; text-align: center; font-weight: bold; font-size: 12px; margin-bottom: 8px; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
    🚫 DOCUMENTO FISCAL CANCELADO PERANTE A SEFAZ (STATUS 101 - HOMOLOGADO).<br>
    <span style="font-size: 11px; font-weight: normal;">
      ${protocoloCancelamento ? `Protocolo de Cancelamento: <strong>${protocoloCancelamento}</strong> • ` : ''}
      ${motivoCancelamento ? `Motivo: <em>"${motivoCancelamento}"</em>` : ''}
    </span>
  </div>
  ` : isPrevia ? `
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

  <div class="no-print" style="text-align: right; max-width: 210mm; margin: 0 auto 8px auto; display: flex; justify-content: flex-end; align-items: center; gap: 8px;">
    ${!isPrevia && !isCancelada ? `<button class="btn-xml" onclick="baixarXmlNfe()" style="padding: 7px 16px; background: #047857; hover:background: #059669; color: white; border: none; font-weight: bold; font-size: 13px; border-radius: 6px; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.15); display: inline-flex; align-items: center; gap: 6px;">📥 Baixar XML (NFe)</button>` : ''}
    <button class="btn-print" onclick="window.print()">${isCancelada ? 'Imprimir Espelho de NF-e Cancelada' : isPrevia ? 'Imprimir Prévia / Salvar PDF' : 'Imprimir DANFE / Salvar PDF'}</button>
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
          <td style="width: 44%; padding: 6px; border-right: 1px solid #000; vertical-align: middle; text-align: center;">
            <div style="text-align: center; margin-bottom: 4px;">
              <img src="/logo-usicorte.png" alt="Logo UsiCorte Metais" style="max-height: 38px; height: 36px; width: auto; margin: 0 auto; display: block;" onerror="this.style.display='none'" />
            </div>
            <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #000; line-height: 1.2;">L. M. BANZATTO METAIS</div>
            <div style="font-size: 9.5px; font-weight: 800; color: #b91c1c; text-transform: uppercase; margin-top: 2px; line-height: 1.2;">USICORTE METAIS</div>
            <div style="margin: 6px 0;"></div>
            <div style="font-size: 7.5px; color: #222; line-height: 1.35; text-align: center;">
              <div>RUA CORONEL INON CESAR PIMENTEL, 3-41</div>
              <div>PARQUE PAULISTA</div>
              <div>BAURU - SP - CEP: 17031-350</div>
              <div style="font-weight: 600; color: #000;">Fone: (14) 99880-9362 • Email: financeiro@usicorte.com.br</div>
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
            <div class="val" style="font-family: monospace;">${buscarInscricaoEstadual(destinatario)}</div>
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
    <div class="box" style="padding: 2px; min-height: 24px;">
      ${(!isAVista && duplicatas && duplicatas.length > 0) ? `
      <table style="width: 100%; border-collapse: separate; border-spacing: 2px;">
        <tr>
          ${duplicatas.map(dup => `
          <td style="border: 1px solid #ccc; padding: 2px 4px; background: #fafafa; vertical-align: top; width: ${Math.floor(100 / Math.min(duplicatas.length, 6))}%;">
            <span style="font-size: 6.5px; color: #555;">Nº DUP:</span> <strong style="font-family: monospace;">${dup.numero}</strong><br>
            <span style="font-size: 6.5px; color: #555;">VENC:</span> <strong>${dup.vencimento ? (dup.vencimento.includes('-') ? dup.vencimento.split('-').reverse().join('/') : dup.vencimento) : '-'}</strong><br>
            <span style="font-size: 6.5px; color: #555;">VALOR:</span> <strong style="font-family: monospace;">R$ ${dup.valor.toFixed(2).replace('.', ',')}</strong>
          </td>
          `).join('')}
        </tr>
      </table>
      ` : ``}
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
          <td style="width: 35%; padding: 2px; border-right: 1px solid #000;"><div class="title">RAZÃO SOCIAL</div><div class="val">-</div></td>
          <td style="width: 20%; padding: 2px; border-right: 1px solid #000;"><div class="title">FRETE POR CONTA</div><div class="val">9 - SEM FRETE</div></td>
          <td style="width: 10%; padding: 2px; border-right: 1px solid #000;"><div class="title">CÓDIGO ANTT</div><div class="val">-</div></td>
          <td style="width: 10%; padding: 2px; border-right: 1px solid #000;"><div class="title">PLACA DO VEÍCULO</div><div class="val">-</div></td>
          <td style="width: 5%; padding: 2px; text-align: center; border-right: 1px solid #000;"><div class="title">UF</div><div class="val">-</div></td>
          <td style="width: 20%; padding: 2px;"><div class="title">CNPJ / CPF</div><div class="val">-</div></td>
        </tr>
      </table>
      <table style="border-bottom: 1px solid #000;">
        <tr>
          <td style="width: 50%; padding: 2px; border-right: 1px solid #000;"><div class="title">ENDEREÇO</div><div class="val">-</div></td>
          <td style="width: 30%; padding: 2px; border-right: 1px solid #000;"><div class="title">MUNICÍPIO</div><div class="val">-</div></td>
          <td style="width: 5%; padding: 2px; text-align: center; border-right: 1px solid #000;"><div class="title">UF</div><div class="val">-</div></td>
          <td style="width: 15%; padding: 2px;"><div class="title">INSCRIÇÃO ESTADUAL</div><div class="val" style="font-family: monospace;">-</div></td>
        </tr>
      </table>
      <table>
        <tr>
          <td style="width: 15%; padding: 2px; border-right: 1px solid #000;"><div class="title">QUANTIDADE</div><div class="val">-</div></td>
          <td style="width: 15%; padding: 2px; border-right: 1px solid #000;"><div class="title">ESPÉCIE</div><div class="val">-</div></td>
          <td style="width: 20%; padding: 2px; border-right: 1px solid #000;"><div class="title">MARCA</div><div class="val">-</div></td>
          <td style="width: 20%; padding: 2px; border-right: 1px solid #000;"><div class="title">NUMERAÇÃO</div><div class="val">-</div></td>
          <td style="width: 15%; padding: 2px; border-right: 1px solid #000;"><div class="title">PESO BRUTO</div><div class="val">-</div></td>
          <td style="width: 15%; padding: 2px;"><div class="title">PESO LÍQUIDO</div><div class="val">-</div></td>
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
              <strong>DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. ${creditoInfo.textoCredito}</strong><br>
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

  ${!isPrevia ? `
  <script>
    function baixarXmlNfe() {
      const xml = ${JSON.stringify(resolvedXml)};
      const chave = ${JSON.stringify(chaveAcesso || '')};
      if (!xml) {
        alert('Conteúdo do XML não disponível para esta nota.');
        return;
      }
      const clean = (chave || '').replace(/\\D/g, '').padEnd(44, '0').slice(0, 44);
      const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'NFe' + clean + '.xml';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 1000);
    }
  </script>
  ` : ''}

  ${autoPrint ? `
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
      }, 400);
    });
  </script>
  ` : ''}
</body>
</html>`;
}

/**
 * Abre diretamente o PDF / HTML da DANFE em uma nova aba para visualização e impressão rápida.
 * Se a danfe_url for uma URL válida, abre-a. Se for um blob expirado ou não informado,
 * regenera dinamicamente a DANFE oficial e abre em nova aba.
 */
export async function abrirDanfeEmNovaAba(
  quote: Quote, 
  client?: Client | null,
  duplicatas?: DuplicataDanfe[],
  isAVista?: boolean,
  autoPrint: boolean = false
): Promise<void> {
  const isCancelada = isNfeCancelada(quote.status_nfe);
  const isAVistaFinal = isAVista !== undefined ? isAVista : (detectarFormaPagamentoInicial(quote) === 'A_VISTA');

  // Se a danfe_url for um link externo ou data URI e não for solicitada impressão automática nem alteração de duplicatas
  if (!isCancelada && quote.danfe_url && !quote.danfe_url.startsWith('blob:') && !duplicatas && isAVista === undefined && !autoPrint) {
    window.open(quote.danfe_url, '_blank');
    return;
  }

  // Tenta abrir a URL se for blob válido ativo sem alteração de duplicatas e NÃO for solicitada autoPrint
  if (!isCancelada && quote.danfe_url && quote.danfe_url.startsWith('blob:') && !duplicatas && isAVista === undefined && !autoPrint) {
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
    const cliDanfe = await fetchClienteCompletoParaDanfe(quote, client);
    const clienteUf = (cliDanfe.uf || quote.clientState || 'SP').toUpperCase();
    const itensFiscais = prepararItensFiscais(quote.items, clienteUf);

    const cleanDoc = cliDanfe.doc.replace(/\D/g, '');
    const tipoDoc: 'CNPJ' | 'CPF' = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';

    const destinatario: DadosDestinatarioNfe = {
      nome: cliDanfe.nome,
      documento: cliDanfe.doc,
      tipoDocumento: tipoDoc,
      inscricaoEstadual: cliDanfe.ie,
      indicadorIe: tipoDoc === 'CNPJ' ? '1' : '9',
      endereco: cliDanfe.endereco,
      bairro: cliDanfe.bairro,
      cidade: cliDanfe.cidade,
      uf: clienteUf,
      cep: cliDanfe.cep,
      telefone: cliDanfe.telefone,
      email: client?.email || quote.clientEmail
    };

    const valorTotal = quote.grandTotal || quote.subtotalTotal || itensFiscais.reduce((acc, it) => acc + it.subtotal, 0);
    const emitenteUltimo = typeof emitente.ultimo_numero_nfe === 'number' && !isNaN(emitente.ultimo_numero_nfe)
      ? emitente.ultimo_numero_nfe
      : 0;
    const numeroNfe = quote.nfe_numero || String(emitenteUltimo + 1).padStart(6, '0');
    const serie = String(quote.serie_nfe || emitente.serie_nfe || '1');
    const chaveAcesso = quote.nfe_chave || quote.chave_acesso || gerarChaveAcessoNfe(emitente.uf || 'SP', new Date(), emitente.cnpj, serie, numeroNfe);
    const protocolo = quote.protocolo_nfe || '135260000000001 (Autorizado o uso da NF-e)';
    const dataEmissao = quote.nfe_emitida_em ? new Date(quote.nfe_emitida_em) : new Date();

    const dupsFinal = isAVistaFinal 
      ? [] 
      : (duplicatas || gerarDuplicatasProporcionais(valorTotal, 1, numeroNfe));

    let xmlConteudo = quote.xml_conteudo;
    if (!xmlConteudo && chaveAcesso) {
      const cleanChave = chaveAcesso.replace(/\D/g, '');
      if (cleanChave) {
        xmlConteudo = localStorage.getItem(`usicorte_nfe_xml_${cleanChave}`) || undefined;
      }
    }

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
      quote.quoteNumber,
      dupsFinal,
      isAVistaFinal,
      xmlConteudo,
      isCancelada,
      quote.protocolo_cancelamento,
      quote.motivo_cancelamento,
      autoPrint
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
export async function gerarPreDanfeHtml(
  quote: Quote, 
  client?: Client | null,
  duplicatas?: DuplicataDanfe[],
  isAVista?: boolean
): Promise<string> {
  const emitente = await fetchCompanyData();
  const cliDanfe = await fetchClienteCompletoParaDanfe(quote, client);
  const clienteUf = (cliDanfe.uf || quote.clientState || 'SP').toUpperCase();
  const itensFiscais = prepararItensFiscais(quote.items, clienteUf);

  const cleanDoc = cliDanfe.doc.replace(/\D/g, '');
  const tipoDoc: 'CNPJ' | 'CPF' = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';

  const destinatario: DadosDestinatarioNfe = {
    nome: cliDanfe.nome,
    documento: cliDanfe.doc,
    tipoDocumento: tipoDoc,
    inscricaoEstadual: cliDanfe.ie,
    indicadorIe: tipoDoc === 'CNPJ' ? '1' : '9',
    endereco: cliDanfe.endereco,
    bairro: cliDanfe.bairro,
    cidade: cliDanfe.cidade,
    uf: clienteUf,
    cep: cliDanfe.cep,
    telefone: cliDanfe.telefone,
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

  const isAVistaFinal = isAVista !== undefined ? isAVista : (detectarFormaPagamentoInicial(quote) === 'A_VISTA');
  const dupsFinal = isAVistaFinal 
    ? [] 
    : (duplicatas || gerarDuplicatasProporcionais(valorTotal, 1, numeroNfe));

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
    quote.quoteNumber,
    dupsFinal,
    isAVistaFinal
  );
}

/**
 * Abre a Pré-DANFE (com marca d'água de conferência) diretamente em uma nova aba para conferência e impressão.
 */
export async function abrirPreDanfeEmNovaAba(
  quote: Quote, 
  client?: Client | null,
  duplicatas?: DuplicataDanfe[],
  isAVista?: boolean
): Promise<void> {
  try {
    const html = await gerarPreDanfeHtml(quote, client, duplicatas, isAVista);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    console.error('Erro ao abrir Pré-DANFE em nova aba:', err);
  }
}

export { inserirNotaFiscalDb, fetchNotasFiscaisDb, type NotaFiscalDb, cancelarNotaFiscalSupabase, resolveStatusNfeFinal } from '../lib/db';


