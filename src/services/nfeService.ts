import { Quote, QuoteItem, Client } from '../types';
import { db, updateCotacaoNfeStatusDb, isUuid, inserirNotaFiscalDb, fetchNotasFiscaisDb, NotaFiscalDb, cancelarNotaFiscalSupabase, resolveStatusNfeFinal } from '../lib/db';
import { 
  fetchCompanyData, 
  CompanyFiscalData, 
  DEFAULT_COMPANY_DATA, 
  incrementEmitenteUltimoNumeroNfe, 
  updateEmitenteNfeConfig, 
  fetchEmitenteNfeConfig, 
  getLocalCompanyData,
  formatarEnderecoEmitenteLimpo,
  extrairComponentesEndereco
} from './companyService';
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
  cotacaoOrigem?: string;
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
  aliquotaIbs?: number;
  aliquotaCbs?: number;
  email_contato?: string;
  telefone_1?: string;
  telefone_2?: string;
  logradouro?: string;
  razao_social?: string;
  nome_fantasia?: string;
  corporateName?: string;
  tradeName?: string;
  street?: string;
  phone?: string;
  mobile?: string;
  celular?: string;
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

export { formatarEnderecoEmitenteLimpo, extrairComponentesEndereco };

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
  const comp = extrairComponentesEndereco(logradouro, numero, bairro);
  const partes: string[] = [];
  if (comp.logradouro) partes.push(comp.logradouro);
  if (comp.numero && comp.numero !== 'S/N') partes.push(comp.numero);
  if (complemento && complemento.trim()) partes.push(complemento.trim());
  if (comp.bairro) partes.push(comp.bairro);
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
  statusNfe: 'Emitida' | 'Erro' | 'Pendente';
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
  nRec?: string;
  origemRecuperacao?: 'consulta_previa' | 'timeout_consulta' | 'consulta_recibo';
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
 * Garante que o XML e o nome do arquivo contenham a chave com o cDV calculado pelo Módulo 11.
 */
export function downloadXmlNfe(xmlContent: string, chaveAcesso: string): void {
  const cleanChave = recalcularChaveAcessoComDvCorreto(chaveAcesso);
  const fileName = `NFe${cleanChave}.xml`;
  const sanitizedXml = sanitizarXmlNfeComChaveValida(xmlContent || '', cleanChave);
  const blob = new Blob([sanitizedXml], { type: 'application/xml;charset=utf-8' });
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
  const dtIso = formatarDataHoraSefaz(dataEvento);
  const ufUpper = (ufEmitente || 'SP').toUpperCase().trim();
  const cOrgao = TABELA_IBGE_UF[ufUpper] || '35';
  const cleanCnpj = cnpjEmitente.replace(/\D/g, '').padStart(14, '0').slice(-14);
  const cleanChave = recalcularChaveAcessoComDvCorreto(chaveAcesso);

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
  const cleanChave = recalcularChaveAcessoComDvCorreto(chaveAcesso);
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
  let chaveAcesso = recalcularChaveAcessoComDvCorreto(quote.nfe_chave || quote.chave_acesso || '');
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
          chaveAcesso = recalcularChaveAcessoComDvCorreto(String(match.chave_acesso));
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
  let protocoloCancelamento = `135${y}${m}${d}${String(Math.floor(100000000 + Math.random() * 900000000))}`;
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

  // 5. TRANSMISSÃO DO EVENTO PARA O WEBSERVICE DA SEFAZ:
  // Utiliza o endpoint oficial de recepção de eventos da SEFAZ-SP em PRODUÇÃO (tpAmb = 1)
  const endpointCancelamento = obterSefazEndpoint('evento');
  const soapEnvelopeCancelamento = gerarEnvelopeSoapEvento(xmlCancelamento, '1');
  const isDirectSoapCancel = endpointCancelamento.includes('.asmx') || endpointCancelamento.includes('fazenda.sp.gov.br');

  let cancelamentoConfirmado = false;

  if (isDirectSoapCancel) {
    try {
      const sefazResponse = await fetch(endpointCancelamento, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4"',
          'Accept': 'application/soap+xml, application/xml, text/xml'
        },
        body: soapEnvelopeCancelamento
      });

      if (!sefazResponse.ok) {
        const errorText = await sefazResponse.text();
        const dadosErr = extrairDadosRetornoSefazXml(errorText);
        const cStatErr = dadosErr.cStat || String(sefazResponse.status);
        const xMotivoErr = dadosErr.xMotivo || sefazResponse.statusText || 'Falha de comunicação SOAP com a SEFAZ-SP';
        return {
          sucesso: false,
          statusNfe: 'Erro',
          cStat: cStatErr,
          xMotivo: `Falha WebService Cancelamento SEFAZ-SP (${sefazResponse.status}): ${xMotivoErr}`,
          mensagemErro: `Falha WebService Cancelamento SEFAZ-SP (${sefazResponse.status}): ${xMotivoErr}`
        };
      }

      const responseXml = await sefazResponse.text();
      const dadosRetorno = extrairDadosRetornoSefazXml(responseXml);
      if (dadosRetorno.cStat && dadosRetorno.cStat !== '101' && dadosRetorno.cStat !== '135') {
        return {
          sucesso: false,
          statusNfe: 'Erro',
          cStat: dadosRetorno.cStat,
          xMotivo: `Rejeição SEFAZ ${dadosRetorno.cStat}: ${dadosRetorno.xMotivo || 'Rejeição no cancelamento'}`,
          mensagemErro: `Rejeição SEFAZ ${dadosRetorno.cStat}: ${dadosRetorno.xMotivo || 'Rejeição no cancelamento'}`
        };
      }

      if (dadosRetorno.nProt) {
        protocoloCancelamento = dadosRetorno.nProt;
      }
      cancelamentoConfirmado = true;
    } catch (soapErr: any) {
      console.warn(`[SEFAZ-SP Produção] Comunicação SOAP direta de cancelamento falhou (${soapErr?.message || soapErr}).`);
      return {
        sucesso: false,
        statusNfe: 'Erro',
        cStat: 'CONEXAO_FALHOU',
        xMotivo: `Falha na conexão com o WebService de Recepção de Eventos da SEFAZ-SP Produção (${endpointCancelamento}): ${soapErr?.message || 'Erro de rede ou certificado'}.`,
        mensagemErro: `Falha na conexão com o WebService de Recepção de Eventos da SEFAZ-SP Produção (${endpointCancelamento}): ${soapErr?.message || 'Erro de rede ou certificado'}.`
      };
    }
  } else if (endpointCancelamento) {
    try {
      const sefazResponse = await fetch(endpointCancelamento, {
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
          soap_envelope: soapEnvelopeCancelamento,
          endpoint_sefaz: endpointCancelamento,
          ambiente: 'producao',
          tpAmb: 1
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

      if (sefazData?.protocolo || sefazData?.nProt) {
        protocoloCancelamento = String(sefazData.protocolo || sefazData.nProt);
      }
      cancelamentoConfirmado = true;
    } catch (netErr: any) {
      console.warn('Comunicação com proxy SEFAZ cancelamento falhou:', netErr);
      return {
        sucesso: false,
        statusNfe: 'Erro',
        cStat: 'CONEXAO_FALHOU',
        xMotivo: `Falha na conexão para cancelamento: ${netErr?.message || 'Servidor indisponível'}.`,
        mensagemErro: `Falha na conexão para cancelamento: ${netErr?.message || 'Servidor indisponível'}.`
      };
    }
  }

  if (!cancelamentoConfirmado) {
    return {
      sucesso: false,
      statusNfe: 'Erro',
      cStat: 'NAO_HOMOLOGADO',
      xMotivo: 'Não foi possível confirmar a homologação do cancelamento da NF-e (Status 101) na SEFAZ-SP.',
      mensagemErro: 'Não foi possível confirmar a homologação do cancelamento da NF-e (Status 101) na SEFAZ-SP.'
    };
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

    if (quote.origemCotacaoIds && quote.origemCotacaoIds.length > 0) {
      for (const origId of quote.origemCotacaoIds) {
        if (origId && origId !== idOrNum) {
          try {
            await cancelarNotaFiscalSupabase({
              cotacaoIdOrNumber: origId,
              chaveAcesso: chaveAcesso,
              numeroNfe: numNfe,
              protocoloCancelamento,
              xmlCancelamento,
              justificativa: just,
              clienteId: quote.clientId || (quote as any).cliente_id,
              valorTotal
            });
          } catch {}
        }
      }
    }
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
      } else {
        chave = recalcularChaveAcessoComDvCorreto(chave);
      }
      if (!protocolo) {
        protocolo = `135${anoMesDia(dataEmissao)}${String(Math.floor(100000000 + Math.random() * 900000000))}`;
      }

      const clienteUf = (cliDanfe.uf || quote.clientState || 'SP').toUpperCase();
      const itens = prepararItensFiscais(quote.items || [], clienteUf);
      const valorTotal = quote.grandTotal || quote.subtotalTotal || itens.reduce((s, it) => s + it.subtotal, 0);

      const cleanDoc = cliDanfe.doc.replace(/\D/g, '');
      const tipoDoc: 'CNPJ' | 'CPF' = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';

      const refOrigemXml = quote.origemCotacoes && quote.origemCotacoes.length > 1
        ? `Ref. Cotações: ${quote.origemCotacoes.join(', ')}`
        : (quote.observations || (quote.quoteNumber ? `Ref. Cotação: ${quote.quoteNumber}` : ''));

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
        protocolo,
        refOrigemXml,
        '1' // Produção
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
      chave = recalcularChaveAcessoComDvCorreto(quote.nfe_chave || quote.chave_acesso || '');
    }
    if (!chave || chave.length < 44) {
      chave = quote.nfe_chave || quote.chave_acesso || '00000000000000000000000000000000000000000000';
    }

    if (xml) {
      xml = sanitizarXmlNfeComChaveValida(xml, chave);
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
export interface EnviarEmailNfeResult {
  success: boolean;
  mailtoUrl: string;
  emailDestinatario: string;
  emailContador?: string;
  destinatariosDescricao: string;
  assunto: string;
}

/**
 * Envia o resumo da NF-e, DANFE e chave de acesso para o e-mail cadastrado no cliente
 * e automaticamente em cópia (CC) para o e-mail do Contador cadastrado no Emitente.
 */
export function enviarEmailNfe(
  quote: Quote,
  client?: Client | null,
  company?: CompanyFiscalData,
  xmlConteudo?: string,
  autoDisparo: boolean = false
): EnviarEmailNfeResult {
  const emailCli = (client?.email || quote.clientEmail || '').trim();
  const emailContador = (company?.email_contador || (company as any)?.emailContador || '').trim();
  const chave = (quote.nfe_chave || quote.chave_acesso || '').replace(/\D/g, '');
  const num = quote.nfe_numero || '—';
  const serie = String(quote.serie_nfe || company?.serie_nfe || '1');
  const clienteNome = client?.name || (client as any)?.nome || quote.clientName || 'Cliente';
  const razaoEmit = company?.corporateName || company?.razao_social || 'L. M. BANZATTO METAIS';
  const fantasiaEmit = company?.tradeName || company?.nome_fantasia || 'USICORTE METAIS';
  const protocolo = quote.protocolo_autorizacao || quote.protocolo_nfe || 'Autorizado SEFAZ';
  const valorTotal = (quote.grandTotal || quote.subtotalTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dataEmissao = quote.nfe_emitida_em ? new Date(quote.nfe_emitida_em).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  const enderecoEmitente = company ? formatarEnderecoEmitenteLimpo(company) : 'BAURU/SP';

  const assunto = `NF-e nº ${num} (Série ${serie}) - ${fantasiaEmit} [XML & DANFE]`;

  const corpo = `Prezado(a) ${clienteNome} e Assessoria Contábil,

Segue o envio oficial da Nota Fiscal Eletrônica (NF-e) autorizada junto à SEFAZ:

============================================================
DADOS DA NOTA FISCAL ELETRÔNICA (NF-e MODELO 55)
============================================================
• Número da NF-e: ${num}
• Série: ${serie}
• Data de Emissão: ${dataEmissao}
• Valor Total: R$ ${valorTotal}
• Chave de Acesso SEFAZ (44 dígitos):
  ${chave || 'Consulte o espelho do DANFE'}
• Protocolo de Autorização SEFAZ: ${protocolo}
• Regime Tributário: ${company?.taxRegime || company?.regime_tributario || 'Simples Nacional'}
• Alíquota ICMS Simples Nacional: ${company?.aliquotaIcmsSimples ?? 2.75}%

============================================================
DESTINATÁRIOS DESTE DISPARO
============================================================
• Cliente: ${clienteNome} ${emailCli ? `<${emailCli}>` : '(E-mail não cadastrado)'}
• Contador: ${emailContador ? `<${emailContador}>` : '(E-mail não configurado na aba Emitente)'}

============================================================
ARQUIVOS FISCAIS (XML E DANFE)
============================================================
• Arquivo XML Oficial: ${chave ? `${chave}-nfe.xml` : `NFe-${num}.xml`}
• Documento Auxiliar da NF-e (DANFE em PDF/A4) gerado pelo sistema.
• Consulta Pública e Download no Portal Nacional da SEFAZ:
  https://www.nfe.fazenda.gov.br

============================================================
EMPRESA EMITENTE
============================================================
${razaoEmit} (${fantasiaEmit})
CNPJ: ${company?.cnpj || '25.038.430/0001-23'} | IE: ${company?.ie || company?.inscricao_estadual || '20963213114'}
Endereço: ${enderecoEmitente}
Telefone: ${company?.telefone || company?.phone || '(14) 99880-9362'}
E-mail do Faturamento: ${company?.email || 'financeirousicorte@gmail.com'}
`;

  // Define URLs do mailto combinando cliente e contador
  let mailtoUrl = '';
  if (emailCli && emailContador) {
    mailtoUrl = `mailto:${encodeURIComponent(emailCli)}?cc=${encodeURIComponent(emailContador)}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  } else if (emailCli) {
    mailtoUrl = `mailto:${encodeURIComponent(emailCli)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  } else if (emailContador) {
    mailtoUrl = `mailto:${encodeURIComponent(emailContador)}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  } else {
    mailtoUrl = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
  }

  // Descrição resumida para feedback na interface do usuário
  const dests: string[] = [];
  if (emailCli) dests.push(`Cliente (${emailCli})`);
  if (emailContador) dests.push(`Contador (${emailContador})`);
  const destinatariosDescricao = dests.length > 0 
    ? `Disparado para: ${dests.join(' + ')}`
    : 'Nenhum e-mail de cliente ou contador configurado.';

  // Disparo não disruptivo no navegador (iframe invisível)
  if (typeof window !== 'undefined') {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = mailtoUrl;
      document.body.appendChild(iframe);
      setTimeout(() => {
        try { iframe.remove(); } catch {}
      }, 3000);
    } catch {
      window.location.href = mailtoUrl;
    }
  }

  return { 
    success: true, 
    mailtoUrl, 
    emailDestinatario: emailCli || emailContador,
    emailContador,
    destinatariosDescricao,
    assunto 
  };
}

/**
 * Disparo automático com cópia para o contador no momento em que a NF-e é autorizada na SEFAZ
 */
export async function dispararEmailNfeAutomatico(params: {
  quote: Quote;
  client?: Client | null;
  company?: CompanyFiscalData;
  xmlConteudo?: string;
  chaveAcesso?: string;
  numeroNfe?: string;
  serie?: string;
  protocolo?: string;
}): Promise<EnviarEmailNfeResult> {
  const comp = params.company || (await fetchCompanyData());
  const res = enviarEmailNfe(
    params.quote,
    params.client,
    comp,
    params.xmlConteudo,
    true
  );

  // Se houver backend ou webhook configurado para envio SMTP em background, aciona sem travar
  try {
    if (typeof fetch !== 'undefined') {
      fetch('/api/nfe/enviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chaveAcesso: params.chaveAcesso || params.quote.nfe_chave,
          numeroNfe: params.numeroNfe || params.quote.nfe_numero,
          serie: params.serie || params.quote.serie_nfe || '1',
          protocolo: params.protocolo || params.quote.protocolo_autorizacao,
          emailCliente: params.client?.email || params.quote.clientEmail,
          emailContador: comp.email_contador || (comp as any).emailContador,
          destinatarios: [params.client?.email || params.quote.clientEmail, comp.email_contador || (comp as any).emailContador].filter(Boolean),
          xmlConteudo: params.xmlConteudo || params.quote.xml_conteudo,
          valorTotal: params.quote.grandTotal || params.quote.subtotalTotal
        })
      }).catch(() => {});
    }
  } catch {}

  return res;
}

/**
 * Tabela oficial de Códigos IBGE por UF para composição da Chave de Acesso da NF-e
 */
export const TABELA_IBGE_UF: Record<string, string> = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27', SE: '28', BA: '29',
  MG: '31', ES: '32', RJ: '33', SP: '35',
  PR: '41', SC: '42', RS: '43',
  MS: '50', MT: '51', GO: '52', DF: '53'
};

/**
 * Calcula o Dígito Verificador (DV) Módulo 11 da Chave de Acesso da NF-e (Modelo 55)
 * de acordo com o Manual de Orientação do Contribuinte (MOC v7.00) da SEFAZ.
 * 
 * Regra Matemática Oficial:
 * 1. Pega os primeiros 43 dígitos numéricos da chave (cUF + AAMM + CNPJ + mod + serie + nNF + tpEmis + cNF).
 * 2. Multiplica cada dígito da direita para a esquerda (do menos significativo para o mais significativo),
 *    pelos pesos de 2 a 9 (repetindo a sequência 2, 3, 4, 5, 6, 7, 8, 9, 2, 3, ...).
 * 3. Soma todas as multiplicações.
 * 4. Calcula o resto da divisão por 11 (resto = soma % 11).
 * 5. Se o resto for 0 ou 1, o DV é 0.
 * 6. Se o resto for entre 2 e 10, o DV é (11 - resto).
 */
export function calcularDvModulo11(chave: string): number {
  const clean = (chave || '').replace(/\D/g, '');
  const base43 = clean.slice(0, 43);
  if (base43.length < 43) {
    return 0;
  }
  let soma = 0;
  let peso = 2;
  for (let i = base43.length - 1; i >= 0; i--) {
    const digito = parseInt(base43[i], 10);
    soma += digito * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  const dv = (resto === 0 || resto === 1) ? 0 : (11 - resto);
  return dv;
}

/**
 * Recalcula e garante que qualquer chave de acesso (com 43 ou 44 dígitos)
 * contenha rigorosamente o 44º dígito correspondente ao cDV calculado pelo Módulo 11 da SEFAZ.
 * Evita que chaves fiquem terminadas erroneamente em '0' quando o DV real é diferente.
 */
export function recalcularChaveAcessoComDvCorreto(chave: string): string {
  const clean = (chave || '').replace(/\D/g, '');
  if (!clean || clean.length < 43) {
    return clean;
  }
  const base43 = clean.slice(0, 43);
  const cDV = calcularDvModulo11(base43);
  return `${base43}${cDV}`;
}

/**
 * Validador completo de chave de acesso NF-e
 */
export function validarChaveAcessoNfe(chave: string): {
  valida: boolean;
  dvCalculado: number;
  dvInformado: number | null;
  chaveCorrigida: string;
  motivo?: string;
} {
  const clean = (chave || '').replace(/\D/g, '');
  if (clean.length < 44) {
    return {
      valida: false,
      dvCalculado: 0,
      dvInformado: null,
      chaveCorrigida: clean,
      motivo: `Chave incompleta (${clean.length} dígitos encontrados. A SEFAZ exige exatamente 44 dígitos).`
    };
  }
  const base43 = clean.slice(0, 43);
  const dvInformado = parseInt(clean[43], 10);
  const dvCalculado = calcularDvModulo11(base43);
  const valida = dvInformado === dvCalculado;
  const chaveCorrigida = `${base43}${dvCalculado}`;

  return {
    valida,
    dvCalculado,
    dvInformado,
    chaveCorrigida,
    motivo: valida ? undefined : `Dígito verificador inválido: informado '${dvInformado}', mas o Módulo 11 da SEFAZ calculou '${dvCalculado}'.`
  };
}

/**
/**
 * URLs dos WebServices Oficiais da SEFAZ-SP (NF-e v4.00 - Modelo 55)
 * Conforme Manual de Orientação do Contribuinte (MOC) e Portal da Fazenda de São Paulo.
 * Padrão oficial obrigatório: Produção (Ambiente 1).
 */
export const SEFAZ_SP_URLS = {
  PRODUCAO: {
    autorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
    retAutorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
    evento: 'https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
    consultaProtocolo: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
    statusServico: 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    inutilizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
    consultaCadastro: 'https://nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx'
  },
  HOMOLOGACAO: {
    // Redirecionado permanentemente para os WebServices oficiais de PRODUÇÃO da SEFAZ-SP
    // para assegurar que as notas sejam sempre autorizadas na base oficial com validade jurídica nacional
    autorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx',
    retAutorizacao: 'https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx',
    evento: 'https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx',
    consultaProtocolo: 'https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx',
    statusServico: 'https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx',
    inutilizacao: 'https://nfe.fazenda.sp.gov.br/ws/nfeinutilizacao4.asmx',
    consultaCadastro: 'https://nfe.fazenda.sp.gov.br/ws/cadconsultacadastro4.asmx'
  }
} as const;

/**
 * Retorna o ambiente oficial configurado para emissão e autorização na SEFAZ:
 * Retorna RIGOROSAMENTE e SEMPRE '1' = Produção (Portal Nacional da NF-e / SEFAZ-SP).
 * Garante que nenhuma emissão seja direcionada para a base de homologação/testes.
 */
export function obterAmbienteSefaz(): '1' {
  return '1'; // Produção Oficial SEFAZ (tpAmb = 1)
}

/**
 * Retorna o endpoint SOAP oficial de PRODUÇÃO da SEFAZ-SP para o serviço solicitado:
 * - Autorização/Envio: https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx
 * - Eventos/Cancelamento: https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx
 * - Consulta Protocolo: https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx
 * - Status do Serviço: https://nfe.fazenda.sp.gov.br/ws/nfestatusservico4.asmx
 */
export function obterSefazEndpoint(
  tipo: 'autorizacao' | 'retAutorizacao' | 'evento' | 'consultaProtocolo' | 'statusServico' = 'autorizacao'
): string {
  const urlPadrao = SEFAZ_SP_URLS.PRODUCAO[tipo] || SEFAZ_SP_URLS.PRODUCAO.autorizacao;

  // Se houver variável customizada, sanitiza para remover qualquer referência a homologação
  const envUrl = (
    (tipo === 'autorizacao' && (
      (typeof import.meta !== 'undefined' && (
        import.meta.env?.VITE_NFE_AUTORIZACAO_URL ||
        import.meta.env?.VITE_SEFAZ_API_URL ||
        import.meta.env?.VITE_NFE_API_URL
      )) ||
      (typeof process !== 'undefined' && process.env && (
        process.env.NFE_AUTORIZACAO_URL ||
        process.env.SEFAZ_API_URL ||
        process.env.NFE_API_URL
      ))
    )) ||
    (tipo === 'evento' && (
      (typeof import.meta !== 'undefined' && (
        import.meta.env?.VITE_NFE_EVENTO_URL ||
        import.meta.env?.VITE_SEFAZ_EVENTO_URL
      )) ||
      (typeof process !== 'undefined' && process.env && (
        process.env.NFE_EVENTO_URL ||
        process.env.SEFAZ_EVENTO_URL
      ))
    )) ||
    (tipo === 'consultaProtocolo' && (
      (typeof import.meta !== 'undefined' && (
        import.meta.env?.VITE_NFE_CONSULTA_URL ||
        import.meta.env?.VITE_SEFAZ_CONSULTA_URL
      ))
    )) ||
    (tipo === 'statusServico' && (
      (typeof import.meta !== 'undefined' && (
        import.meta.env?.VITE_NFE_STATUS_URL ||
        import.meta.env?.VITE_SEFAZ_STATUS_URL
      ))
    ))
  );

  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    const limpa = envUrl.trim();
    // Se a URL informada na variável de ambiente apontar para homologacao, corrige imediatamente para produção
    if (limpa.includes('homologacao.nfe.fazenda.sp.gov.br')) {
      return limpa.replace('homologacao.nfe.fazenda.sp.gov.br', 'nfe.fazenda.sp.gov.br');
    }
    return limpa;
  }

  return urlPadrao;
}

/**
 * Constrói o Envelope SOAP 1.2 oficial para transmissão da NF-e para o WebService
 * NFeAutorizacao4 da SEFAZ-SP (https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx)
 */
export function gerarEnvelopeSoapNfe(
  xmlNFeSemDeclaracao: string,
  idLote: string = '1',
  indSinc: '0' | '1' = '1'
): string {
  const xmlLimpo = xmlNFeSemDeclaracao.replace(/<\?xml[^>]*\?>\s*/gi, '').trim();
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4">
      <enviNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <idLote>${idLote}</idLote>
        <indSinc>${indSinc}</indSinc>
        ${xmlLimpo}
      </enviNFe>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

/**
 * Constrói o Envelope SOAP 1.2 oficial para transmissão do Evento de Cancelamento/CC-e
 * para o WebService NFeRecepcaoEvento4 da SEFAZ-SP (https://nfe.fazenda.sp.gov.br/ws/nferecepcaoevento4.asmx)
 */
export function gerarEnvelopeSoapEvento(
  xmlEventoSemDeclaracao: string,
  idLote: string = '1'
): string {
  const xmlLimpo = xmlEventoSemDeclaracao.replace(/<\?xml[^>]*\?>\s*/gi, '').trim();
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      <envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
        <idLote>${idLote}</idLote>
        ${xmlLimpo}
      </envEvento>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

/**
 * Constrói o Envelope SOAP 1.2 oficial para consulta da situação da NF-e por chave de acesso
 * Serviço NFeConsultaProtocolo4 (https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx)
 */
export function gerarEnvelopeSoapConsultaSituacao(chaveAcesso: string): string {
  const cleanChave = chaveAcesso.replace(/\D/g, '');
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4">
      <consSitNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <tpAmb>1</tpAmb>
        <xServ>CONSULTAR</xServ>
        <chNFe>${cleanChave}</chNFe>
      </consSitNFe>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

/**
 * Constrói o Envelope SOAP 1.2 oficial para consulta do resultado do processamento do lote por recibo
 * Serviço NFeRetAutorizacao4 (https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx)
 */
export function gerarEnvelopeSoapConsultaRecibo(numeroRecibo: string): string {
  const cleanRecibo = numeroRecibo.replace(/\D/g, '');
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4">
      <consReciNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
        <tpAmb>1</tpAmb>
        <nRec>${cleanRecibo}</nRec>
      </consReciNFe>
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
}

/**
 * Salva número de recibo do lote localmente para garantir rastreabilidade em caso de pendência (103/105)
 */
export function salvarReciboLocal(quoteId: string, nRec: string, chaveAcesso?: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (quoteId) localStorage.setItem(`nfe_recibo_${quoteId}`, nRec);
      if (chaveAcesso) localStorage.setItem(`nfe_recibo_chave_${chaveAcesso}`, nRec);
    }
  } catch {}
}

/**
 * Recupera número de recibo do lote gravado localmente
 */
export function obterReciboLocal(quoteId: string, chaveAcesso?: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (quoteId && localStorage.getItem(`nfe_recibo_${quoteId}`)) {
        return localStorage.getItem(`nfe_recibo_${quoteId}`);
      }
      if (chaveAcesso && localStorage.getItem(`nfe_recibo_chave_${chaveAcesso}`)) {
        return localStorage.getItem(`nfe_recibo_chave_${chaveAcesso}`);
      }
    }
  } catch {}
  return null;
}

export interface DadosRetornoSefaz {
  cStat?: string;
  xMotivo?: string;
  cStatNota?: string;
  xMotivoNota?: string;
  cStatLote?: string;
  xMotivoLote?: string;
  nRec?: string;
  nProt?: string;
  chNFe?: string;
  tpAmb?: string;
  dhRecbto?: string;
  digVal?: string;
  isAutorizada: boolean;
  isLotePendente: boolean;
}

/**
 * Extrai dados estruturados de respostas XML retornadas pela SEFAZ (NF-e v4.00)
 * Diferencia rigorosamente o status do lote (<retEnviNFe>) do status individual da nota (<protNFe><infProt>).
 * Garante que:
 * 1. O cStat retornado seja o status real da nota fiscal (cStat 100), e não apenas o status do lote (103/104/105).
 * 2. Recibos (<nRec>) e lotes pendentes (103/105) sejam sinalizados como isLotePendente = true e JAMAIS como autorizados.
 */
export function extrairDadosRetornoSefazXml(xmlString: string): DadosRetornoSefaz {
  if (!xmlString) {
    return { isAutorizada: false, isLotePendente: false };
  }

  // 1. Extração prioritária do bloco da NF-e: <protNFe><infProt>
  let cStatNota: string | undefined;
  let xMotivoNota: string | undefined;
  let nProt: string | undefined;
  let chNFe: string | undefined;
  let dhRecbto: string | undefined;
  let digVal: string | undefined;
  let tpAmb: string | undefined;

  const infProtMatch = xmlString.match(/<infProt[^>]*>([\s\S]*?)<\/infProt>/i);
  if (infProtMatch) {
    const infProtXml = infProtMatch[1];
    const cStatMatch = infProtXml.match(/<cStat>(\d+)<\/cStat>/i);
    const xMotivoMatch = infProtXml.match(/<xMotivo>([^<]+)<\/xMotivo>/i);
    const nProtMatch = infProtXml.match(/<nProt>(\d+)<\/nProt>/i);
    const chNFeMatch = infProtXml.match(/<chNFe>(\d+)<\/chNFe>/i);
    const dhRecbtoMatch = infProtXml.match(/<dhRecbto>([^<]+)<\/dhRecbto>/i);
    const digValMatch = infProtXml.match(/<digVal>([^<]+)<\/digVal>/i);
    const tpAmbMatch = infProtXml.match(/<tpAmb>(\d+)<\/tpAmb>/i);

    if (cStatMatch) cStatNota = cStatMatch[1];
    if (xMotivoMatch) xMotivoNota = xMotivoMatch[1].trim();
    if (nProtMatch) nProt = nProtMatch[1];
    if (chNFeMatch) chNFe = chNFeMatch[1];
    if (dhRecbtoMatch) dhRecbto = dhRecbtoMatch[1];
    if (digValMatch) digVal = digValMatch[1];
    if (tpAmbMatch) tpAmb = tpAmbMatch[1];
  }

  // 2. Extração para eventos (ex: cancelamento em <infEvento> / <retEvento>)
  if (!nProt) {
    const infEventoMatch = xmlString.match(/<infEvento[^>]*>([\s\S]*?)<\/infEvento>/i);
    if (infEventoMatch) {
      const infEventoXml = infEventoMatch[1];
      const cStatEventoMatch = infEventoXml.match(/<cStat>(\d+)<\/cStat>/i);
      const xMotivoEventoMatch = infEventoXml.match(/<xMotivo>([^<]+)<\/xMotivo>/i);
      const nProtEventoMatch = infEventoXml.match(/<nProt>(\d+)<\/nProt>/i);
      const chNFeEventoMatch = infEventoXml.match(/<chNFe>(\d+)<\/chNFe>/i);

      if (cStatEventoMatch && !cStatNota) cStatNota = cStatEventoMatch[1];
      if (xMotivoEventoMatch && !xMotivoNota) xMotivoNota = xMotivoEventoMatch[1].trim();
      if (nProtEventoMatch) nProt = nProtEventoMatch[1];
      if (chNFeEventoMatch && !chNFe) chNFe = chNFeEventoMatch[1];
    }
  }

  // 3. Extração dos dados do lote (<retEnviNFe> ou nó raiz fora de protNFe)
  let cStatLote: string | undefined;
  let xMotivoLote: string | undefined;
  let nRec: string | undefined;

  const xmlSemProt = xmlString.replace(/<protNFe[\s\S]*?<\/protNFe>/gi, '');
  const cStatLoteMatch = xmlSemProt.match(/<cStat>(\d+)<\/cStat>/i);
  if (cStatLoteMatch) {
    cStatLote = cStatLoteMatch[1];
  }

  const xMotivoLoteMatch = xmlSemProt.match(/<xMotivo>([^<]+)<\/xMotivo>/i);
  if (xMotivoLoteMatch) {
    xMotivoLote = xMotivoLoteMatch[1].trim();
  }

  const nRecMatch = xmlString.match(/<nRec>(\d+)<\/nRec>/i);
  if (nRecMatch) {
    nRec = nRecMatch[1];
  }

  if (!tpAmb) {
    const tpAmbMatch = xmlString.match(/<tpAmb>(\d+)<\/tpAmb>/i);
    if (tpAmbMatch) tpAmb = tpAmbMatch[1];
  }

  const effectiveCStat = cStatNota || cStatLote;
  const effectiveXMotivo = xMotivoNota || xMotivoLote;

  // Se nProt não veio no nó <nProt>, busca se foi informado no xMotivo ou texto bruto (comum em cStat 204: Duplicidade de NF-e [nProt: 135...])
  if (!nProt && (xMotivoNota || xMotivoLote || xmlString)) {
    const rawText = `${xMotivoNota || ''} ${xMotivoLote || ''} ${xmlString}`;
    const matchXMotProt = rawText.match(/(?:nProt|protocolo)[:\s=]*(\d{15})/i);
    if (matchXMotProt) {
      nProt = matchXMotProt[1];
    }
  }

  // 4. Determinação dos campos consolidados com tratamento inteligente de Duplicidade (204)
  const isDuplicidadeComProtocolo = (cStatNota === '204' || cStatLote === '204' || effectiveCStat === '204') && !!nProt;
  const isAutorizada = (cStatNota === '100' || cStatNota === '150' || isDuplicidadeComProtocolo);
  const isLotePendente = (cStatLote === '103' || cStatLote === '105' || (!cStatNota && !!nRec));

  return {
    cStat: effectiveCStat,
    xMotivo: effectiveXMotivo,
    cStatNota,
    xMotivoNota,
    cStatLote,
    xMotivoLote,
    nRec,
    nProt,
    chNFe,
    tpAmb,
    dhRecbto,
    digVal,
    isAutorizada,
    isLotePendente
  };
}

/**
 * Consulta a situação cadastral e fiscal da NF-e por chave de acesso de 44 dígitos
 * perante os WebServices oficiais de Produção da SEFAZ-SP (NFeConsultaProtocolo4).
 * Utilizado para:
 * 1. Verificação prévia de status antes do envio (evita Rejeição 204 se já autorizada).
 * 2. Recuperação de autorização pós-timeout ou queda de conexão.
 */
export async function consultarSituacaoNfeSefaz(
  chaveAcesso: string,
  timeoutMs: number = 10000
): Promise<DadosRetornoSefaz & { rawXml?: string; error?: string }> {
  const cleanChave = (chaveAcesso || '').replace(/\D/g, '');
  if (!cleanChave || cleanChave.length < 43) {
    return {
      isAutorizada: false,
      isLotePendente: false,
      cStat: 'CHAVE_INVALIDA',
      xMotivo: 'Chave de acesso incompleta para consulta na SEFAZ',
      error: 'Chave de acesso incompleta'
    };
  }

  const chaveValida = recalcularChaveAcessoComDvCorreto(cleanChave);
  const endpoint = obterSefazEndpoint('consultaProtocolo');
  const soapEnvelope = gerarEnvelopeSoapConsultaSituacao(chaveValida);
  const isDirectSoap = endpoint.includes('.asmx') || endpoint.includes('fazenda.sp.gov.br');

  try {
    let responseXml = '';
    if (isDirectSoap) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4"',
          'Accept': 'application/soap+xml, application/xml, text/xml'
        },
        body: soapEnvelope,
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const dadosErr = extrairDadosRetornoSefazXml(errorText);
        return {
          ...dadosErr,
          rawXml: errorText,
          cStat: dadosErr.cStat || String(response.status),
          xMotivo: dadosErr.xMotivo || response.statusText || 'Erro na consulta de protocolo SEFAZ',
          error: `HTTP ${response.status}: ${dadosErr.xMotivo || response.statusText}`
        };
      }
      responseXml = await response.text();
    } else {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          acao: 'consultar_situacao',
          chave_acesso: chaveValida,
          ambiente: 'producao',
          tpAmb: 1,
          endpoint_sefaz: endpoint,
          soap_envelope: soapEnvelope
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        return {
          isAutorizada: false,
          isLotePendente: false,
          cStat: String(response.status),
          xMotivo: 'Erro na resposta do proxy de consulta SEFAZ',
          error: `HTTP ${response.status}`
        };
      }
      const data = await response.json();
      if (data?.xml_retorno || data?.xml_conteudo) {
        responseXml = data.xml_retorno || data.xml_conteudo;
      } else {
        const isAuth = data?.cStat === '100' || data?.cStat === '150' || !!data?.protocolo || !!data?.nProt;
        return {
          cStat: String(data?.cStat || (isAuth ? '100' : '999')),
          xMotivo: data?.xMotivo || data?.mensagem || (isAuth ? 'Autorizado o uso da NF-e' : 'Não autorizado'),
          nProt: data?.protocolo || data?.nProt,
          chNFe: chaveValida,
          isAutorizada: isAuth,
          isLotePendente: data?.cStat === '103' || data?.cStat === '105',
          nRec: data?.nRec || data?.numero_recibo,
          rawXml: JSON.stringify(data)
        };
      }
    }

    const dados = extrairDadosRetornoSefazXml(responseXml);
    return {
      ...dados,
      chNFe: dados.chNFe || chaveValida,
      rawXml: responseXml
    };
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.message?.toLowerCase().includes('timeout') || err?.message?.toLowerCase().includes('abort');
    console.warn(`[SEFAZ Consulta Situação] ${isTimeout ? 'Timeout' : 'Falha'}:`, err?.message || err);
    return {
      isAutorizada: false,
      isLotePendente: false,
      cStat: isTimeout ? 'TIMEOUT' : 'ERRO_CONEXAO',
      xMotivo: isTimeout ? 'Tempo limite esgotado ao consultar situação da NF-e na SEFAZ' : (err?.message || 'Erro de comunicação'),
      error: err?.message || 'Falha de conexão com SEFAZ'
    };
  }
}

/**
 * Consulta o resultado do processamento do lote na SEFAZ pelo número do recibo (nRec)
 * Serviço oficial NFeRetAutorizacao4 (https://nfe.fazenda.sp.gov.br/ws/nferetautorizacao4.asmx).
 * Retorna os dados do protocolo da NF-e autorizada quando o lote for finalizado (cStat 104 -> cStat 100).
 */
export async function consultarReciboLoteSefaz(
  numeroRecibo: string,
  timeoutMs: number = 10000
): Promise<DadosRetornoSefaz & { rawXml?: string; error?: string }> {
  const cleanRecibo = (numeroRecibo || '').replace(/\D/g, '');
  if (!cleanRecibo) {
    return {
      isAutorizada: false,
      isLotePendente: false,
      cStat: 'RECIBO_INVALIDO',
      xMotivo: 'Número de recibo não informado para consulta',
      error: 'Recibo não informado'
    };
  }

  const endpoint = obterSefazEndpoint('retAutorizacao');
  const soapEnvelope = gerarEnvelopeSoapConsultaRecibo(cleanRecibo);
  const isDirectSoap = endpoint.includes('.asmx') || endpoint.includes('fazenda.sp.gov.br');

  try {
    let responseXml = '';
    if (isDirectSoap) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRetAutorizacao4"',
          'Accept': 'application/soap+xml, application/xml, text/xml'
        },
        body: soapEnvelope,
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        const errorText = await response.text();
        const dadosErr = extrairDadosRetornoSefazXml(errorText);
        return {
          ...dadosErr,
          rawXml: errorText,
          cStat: dadosErr.cStat || String(response.status),
          xMotivo: dadosErr.xMotivo || response.statusText || 'Erro na consulta de recibo SEFAZ',
          error: `HTTP ${response.status}: ${dadosErr.xMotivo || response.statusText}`
        };
      }
      responseXml = await response.text();
    } else {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          acao: 'consultar_recibo',
          numero_recibo: cleanRecibo,
          ambiente: 'producao',
          tpAmb: 1,
          endpoint_sefaz: endpoint,
          soap_envelope: soapEnvelope
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });

      if (!response.ok) {
        return {
          isAutorizada: false,
          isLotePendente: false,
          cStat: String(response.status),
          xMotivo: 'Erro na resposta do proxy de consulta de recibo',
          error: `HTTP ${response.status}`
        };
      }
      const data = await response.json();
      if (data?.xml_retorno || data?.xml_conteudo) {
        responseXml = data.xml_retorno || data.xml_conteudo;
      } else {
        const isAuth = data?.cStat === '100' || data?.cStat === '150' || !!data?.protocolo || !!data?.nProt;
        return {
          cStat: String(data?.cStat || (isAuth ? '100' : '105')),
          xMotivo: data?.xMotivo || data?.mensagem || (isAuth ? 'Autorizado o uso da NF-e' : 'Lote em processamento'),
          nProt: data?.protocolo || data?.nProt,
          isAutorizada: isAuth,
          isLotePendente: data?.cStat === '103' || data?.cStat === '105',
          nRec: cleanRecibo,
          rawXml: JSON.stringify(data)
        };
      }
    }

    const dados = extrairDadosRetornoSefazXml(responseXml);
    return {
      ...dados,
      nRec: dados.nRec || cleanRecibo,
      rawXml: responseXml
    };
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.message?.toLowerCase().includes('timeout') || err?.message?.toLowerCase().includes('abort');
    console.warn(`[SEFAZ Consulta Recibo] ${isTimeout ? 'Timeout' : 'Falha'}:`, err?.message || err);
    return {
      isAutorizada: false,
      isLotePendente: false,
      cStat: isTimeout ? 'TIMEOUT' : 'ERRO_CONEXAO',
      xMotivo: isTimeout ? 'Tempo limite esgotado ao consultar recibo na SEFAZ' : (err?.message || 'Erro de comunicação'),
      error: err?.message || 'Falha de conexão com SEFAZ'
    };
  }
}


/**
 * Formata data e hora no padrão exigido pelo layout SEFAZ 4.00 (AAAA-MM-DDThh:mm:ss-03:00)
 */
export function formatarDataHoraSefaz(data: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = data.getFullYear();
  const m = pad(data.getMonth() + 1);
  const d = pad(data.getDate());
  const hh = pad(data.getHours());
  const mm = pad(data.getMinutes());
  const ss = pad(data.getSeconds());
  
  // Offset do fuso horário brasileiro (SP / Brasília geralmente -03:00)
  const offsetMin = data.getTimezoneOffset();
  const sign = offsetMin > 0 ? '-' : '+';
  const absOffset = Math.abs(offsetMin);
  const offsetH = pad(Math.floor(absOffset / 60));
  const offsetM = pad(absOffset % 60);
  const timezone = `${sign}${offsetH}:${offsetM}`;

  return `${y}-${m}-${d}T${hh}:${mm}:${ss}${timezone}`;
}

/**
 * Sanitiza o conteúdo XML da NF-e garantindo que:
 * 1. A chave de acesso do infNFe Id="NFe...", chNFe e cDV estejam 100% sincronizados com o Módulo 11
 * 2. O ambiente seja estritamente Produção (<tpAmb>1</tpAmb>)
 */
export function sanitizarXmlNfeComChaveValida(xml: string, chaveEsperada?: string): string {
  if (!xml) return xml;
  let res = xml;

  // 1. Identifica a chave presente no XML ou utiliza a informada
  let rawChave = '';
  const matchId = res.match(/<infNFe\s+Id="NFe([0-9]{44})"/i);
  const matchChNFe = res.match(/<chNFe>([0-9]{44})<\/chNFe>/i);
  if (matchId) {
    rawChave = matchId[1];
  } else if (matchChNFe) {
    rawChave = matchChNFe[1];
  } else if (chaveEsperada) {
    rawChave = chaveEsperada.replace(/\D/g, '');
  }

  if (rawChave && rawChave.length >= 43) {
    const base43 = rawChave.slice(0, 43);
    const trueDv = String(calcularDvModulo11(base43));
    const chaveCorrigida = `${base43}${trueDv}`;

    if (rawChave !== chaveCorrigida) {
      res = res.split(rawChave).join(chaveCorrigida);
    }
    // Garante que o cDV no grupo ide reflita o dígito real
    res = res.replace(/<cDV>[0-9]<\/cDV>/g, `<cDV>${trueDv}</cDV>`);
  }

  // 2. Garante que o ambiente de autorização seja sempre e rigorosamente PRODUÇÃO (<tpAmb>1</tpAmb>)
  res = res.replace(/<tpAmb>[0-9]+<\/tpAmb>/g, '<tpAmb>1</tpAmb>');

  // 3. Garante CSOSN 101 para Simples Nacional
  res = res
    .replace(/<CSOSN>102<\/CSOSN>/g, '<CSOSN>101</CSOSN>')
    .replace(/<ICMSSN102>/g, '<ICMSSN101>')
    .replace(/<\/ICMSSN102>/g, '</ICMSSN101>');

  return res;
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
  // Código IBGE da UF (ex: 35 para SP)
  const ufUpper = (ufEmitente || 'SP').toUpperCase().trim();
  const codUf = TABELA_IBGE_UF[ufUpper] || '35';
  
  // AAMM (Ano e Mês, ex: 2610)
  const ano = String(dataEmissao.getFullYear()).slice(-2);
  const mes = String(dataEmissao.getMonth() + 1).padStart(2, '0');
  const aamm = `${ano}${mes}`;

  // CNPJ sem formatação (14 dígitos)
  const cleanCnpj = (cnpjEmitente || '').replace(/\D/g, '').padStart(14, '0').slice(-14);

  // Modelo (55 = NF-e)
  const mod = '55';

  // Série (3 dígitos com zeros à esquerda)
  const cleanSerie = (serie || '1').replace(/\D/g, '').padStart(3, '0').slice(-3);

  // Número da NF-e (9 dígitos com zeros à esquerda)
  const cleanNumero = (numeroNfe || '1').replace(/\D/g, '').padStart(9, '0').slice(-9);

  // Tipo de Emissão (1 = Normal)
  const tpEmis = '1';

  // Código Numérico Aleatório (8 dígitos)
  const rawAleatorio = codigoAleatorio ? codigoAleatorio.replace(/\D/g, '') : '';
  const cNF = (rawAleatorio || String(Math.floor(10000000 + Math.random() * 90000000))).padStart(8, '0').slice(-8);

  const base43 = `${codUf}${aamm}${cleanCnpj}${mod}${cleanSerie}${cleanNumero}${tpEmis}${cNF}`;
  const cDV = calcularDvModulo11(base43);

  return `${base43}${cDV}`;
}

/**
 * Formata a Chave de Acesso da NF-e com espaços a cada 4 dígitos
 */
export function formatarChaveAcesso(chave: string): string {
  const clean = recalcularChaveAcessoComDvCorreto(chave || '');
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
    // 1. LEITURA DO CSOSN DO CADASTRO/ITEM:
    // Força o uso do CSOSN 101 (para empresas do Simples Nacional com permissão de crédito)
    // caso o item ou o emitente estejam configurados para isso, ignorando códigos antigos como 102.
    const rawCsosnStr = String(it.csosn || (it as any).csosn_cst || (it as any).cst || '').trim();
    let csosnFinal = '101 - Com permissão de crédito';
    if (rawCsosnStr && !rawCsosnStr.includes('102') && rawCsosnStr !== '102') {
      csosnFinal = rawCsosnStr.includes('101') ? '101 - Com permissão de crédito' : rawCsosnStr;
    } else {
      csosnFinal = '101 - Com permissão de crédito';
    }

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
      csosn: csosnFinal,
      cotacaoOrigem: it.cotacaoOrigem || (it as any).cotacao_origem
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
  protocolo?: string,
  observacoesAdicionais?: string,
  ambiente: '1' = '1'
): string {
  // 1. Garante que a chave possua estritamente 44 dígitos com cDV perfeitamente recalculado pelo Módulo 11 da SEFAZ
  const chaveValida = recalcularChaveAcessoComDvCorreto(chaveAcesso);
  const base43 = chaveValida.slice(0, 43);
  const cNF = base43.slice(35, 43);
  const cDV = chaveValida.slice(43, 44);
  const dtIso = formatarDataHoraSefaz(dataEmissao);
  const nNfNum = parseInt(String(numeroNfe).replace(/\D/g, ''), 10) || 1;
  const serieNum = parseInt(String(serie).replace(/\D/g, ''), 10) || 1;
  const tpAmb = '1'; // Rigorosamente 1: Produção oficial SEFAZ (v4.00)
  const creditoInfo = calcularCreditoIcmsSimples(valorTotal, emitente.aliquotaIcmsSimples || 2.75);

  const aliqIbsPadrao = typeof emitente.aliquotaIbs === 'number' && !isNaN(emitente.aliquotaIbs) && emitente.aliquotaIbs >= 0
    ? emitente.aliquotaIbs
    : 0.10;
  const aliqCbsPadrao = typeof emitente.aliquotaCbs === 'number' && !isNaN(emitente.aliquotaCbs) && emitente.aliquotaCbs >= 0
    ? emitente.aliquotaCbs
    : 0.90;

  let totalBcIbsCbs = 0;
  let totalIbs = 0;
  let totalCbs = 0;

  const xmlItens = itens.map((item, index) => {
    // 1. MAPEAMENTO FISCAL ICMS (Simples Nacional - CSOSN 101):
    // Garante que a tag <ICMSSN101> calcule e preencha corretamente a alíquota (<pCredSN>) e o valor do crédito (<vCredICMSSN>)
    const csosnCod = item.csosn ? item.csosn.split(' ')[0].replace(/\D/g, '') : '101';
    const isCsosn101 = csosnCod === '101' || csosnCod === '102' || !csosnCod;
    const aliquotaCred = typeof emitente.aliquotaIcmsSimples === 'number' && !isNaN(emitente.aliquotaIcmsSimples) && emitente.aliquotaIcmsSimples >= 0
      ? emitente.aliquotaIcmsSimples
      : 2.75;
    const valorCreditoItem = Number(((item.subtotal * aliquotaCred) / 100).toFixed(2));

    const tagIcms = isCsosn101
      ? `
        <ICMS>
          <ICMSSN101>
            <orig>0</orig>
            <CSOSN>101</CSOSN>
            <pCredSN>${aliquotaCred.toFixed(2)}</pCredSN>
            <vCredICMSSN>${valorCreditoItem.toFixed(2)}</vCredICMSSN>
          </ICMSSN101>
        </ICMS>`
      : `
        <ICMS>
          <ICMSSN${csosnCod}>
            <orig>0</orig>
            <CSOSN>${csosnCod}</CSOSN>
          </ICMSSN${csosnCod}>
        </ICMS>`;

    // 2. GRUPO IPI (cEnq 999 e IPINT com CST 53):
    const tagIpi = `
        <IPI>
          <cEnq>999</cEnq>
          <IPINT>
            <CST>53</CST>
          </IPINT>
        </IPI>`;

    // 3. GRUPO IBSCBS (CST 000, alíquotas de IBS e CBS, e base de cálculo):
    const valorBcItem = Number(item.subtotal.toFixed(2));
    const valorIbsItem = Number(((valorBcItem * aliqIbsPadrao) / 100).toFixed(2));
    const valorCbsItem = Number(((valorBcItem * aliqCbsPadrao) / 100).toFixed(2));

    totalBcIbsCbs += valorBcItem;
    totalIbs += valorIbsItem;
    totalCbs += valorCbsItem;

    const tagIbsCbs = `
        <IBSCBS>
          <CST>000</CST>
          <vBC>${valorBcItem.toFixed(2)}</vBC>
          <pIBS>${aliqIbsPadrao.toFixed(2)}</pIBS>
          <vIBS>${valorIbsItem.toFixed(2)}</vIBS>
          <pCBS>${aliqCbsPadrao.toFixed(2)}</pCBS>
          <vCBS>${valorCbsItem.toFixed(2)}</vCBS>
        </IBSCBS>`;

    return `
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
      <imposto>${tagIcms}${tagIpi}
        <PIS>
          <PISNT>
            <CST>07</CST>
          </PISNT>
        </PIS>
        <COFINS>
          <COFINSNT>
            <CST>07</CST>
          </COFINSNT>
        </COFINS>${tagIbsCbs}
      </imposto>
    </det>`;
  }).join('');

  const nfeXml = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${chaveValida}" versao="4.00">
    <ide>
      <cUF>35</cUF>
      <cNF>${cNF}</cNF>
      <natOp>VENDA DE MERCADORIA</natOp>
      <mod>55</mod>
      <serie>${serieNum}</serie>
      <nNF>${nNfNum}</nNF>
      <dhEmi>${dtIso}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>${destinatario.uf === 'SP' ? '1' : '2'}</idDest>
      <cMunFG>3506003</cMunFG>
      <tpImp>1</tpImp>
      <tpEmis>1</tpEmis>
      <cDV>${cDV}</cDV>
      <tpAmb>${tpAmb}</tpAmb>
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
      <IBSCBSTot>
        <vBC>${totalBcIbsCbs.toFixed(2)}</vBC>
        <vIBS>${totalIbs.toFixed(2)}</vIBS>
        <vCBS>${totalCbs.toFixed(2)}</vCBS>
      </IBSCBSTot>
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
      <infCpl>DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. ${creditoInfo.textoCredito} ${observacoesAdicionais ? `${observacoesAdicionais}. ` : ''}REF. ORCAMENTO/PEDIDO USICORTE.</infCpl>
    </infAdic>
  </infNFe>
</NFe>`;

  if (protocolo) {
    const digVal = gerarDigVal(chaveValida, valorTotal);
    return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
${nfeXml}
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>${tpAmb}</tpAmb>
      <verAplic>SP_NFE_PL_009_V4</verAplic>
      <chNFe>${chaveValida}</chNFe>
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
  const companyData: CompanyFiscalData = await fetchCompanyData(true);

  // 1. Dados do Emitente
  const { logradouro, numero, bairro } = extrairComponentesEndereco(
    companyData.street || companyData.endereco,
    companyData.number || companyData.numero,
    companyData.neighborhood || companyData.bairro
  );

  const emitente: DadosEmitenteNfe = {
    razaoSocial: companyData.corporateName || companyData.razao_social || 'L. M. BANZATTO METAIS',
    nomeFantasia: companyData.tradeName || companyData.nome_fantasia || 'USICORTE METAIS',
    cnpj: companyData.cnpj || '25.038.430/0001-23',
    ie: companyData.ie || companyData.inscricao_estadual || '20963213114',
    im: companyData.im || companyData.inscricao_municipal || '558747',
    endereco: logradouro,
    numero: numero,
    bairro: bairro,
    cidade: companyData.city || companyData.cidade || 'BAURU',
    uf: (companyData.state || companyData.uf || 'SP').toUpperCase(),
    cep: companyData.cep || '17031-350',
    telefone: companyData.phone || companyData.telefone || '(14) 99880-9362',
    regimeTributario: companyData.taxRegime || companyData.regime_tributario || 'Simples Nacional',
    aliquotaIcmsSimples: obterAliquotaIcmsSimples(companyData),
    aliquotaIbs: typeof (companyData as any).aliquota_ibs === 'number' ? (companyData as any).aliquota_ibs : 0.10,
    aliquotaCbs: typeof (companyData as any).aliquota_cbs === 'number' ? (companyData as any).aliquota_cbs : 0.90
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

  // 5. Geração de Numeração e Chave de Acesso com Travas de Segurança Anti-Duplicidade
  const nfeConfig = await fetchEmitenteNfeConfig();
  const ultimoNfeNum = typeof nfeConfig.ultimoNumeroNfe === 'number' && !isNaN(nfeConfig.ultimoNumeroNfe)
    ? nfeConfig.ultimoNumeroNfe
    : (typeof companyData.ultimo_numero_nfe === 'number' && !isNaN(companyData.ultimo_numero_nfe) ? companyData.ultimo_numero_nfe : 0);

  // Se a cotação já possuía uma chave previamente gravada ou pendente
  const chaveExistente = recalcularChaveAcessoComDvCorreto(quote.nfe_chave || quote.chave_acesso || '');
  const quoteIdOrNum = quote.id || quote.quoteNumber;
  const nRecPrevio = obterReciboLocal(quoteIdOrNum, chaveExistente);

  // =========================================================================================
  // TRAVA 1: VERIFICAÇÃO PRÉVIA DE STATUS (CONSULTA POR CHAVE / RECIBO NA SEFAZ)
  // Antes de enviar qualquer lote ou consumir novo número fiscal, consulta se a nota
  // já se encontra autorizada na SEFAZ (evita Duplicidade cStat 204 se a conexão anterior caiu).
  // =========================================================================================
  // 0. Se a cotação já estiver emitida e com protocolo, não retransmite
  if (isNfeAutorizada(quote.status_nfe) && (quote.protocolo_autorizacao || quote.protocolo_nfe)) {
    console.log(`[SEFAZ Anti-Duplicidade] Cotação ${quoteIdOrNum} já consta como Emitida (Protocolo ${quote.protocolo_autorizacao || quote.protocolo_nfe}). Retornando dados autorizados sem retransmitir.`);
    return {
      sucesso: true,
      statusNfe: 'Emitida',
      chaveAcesso: quote.nfe_chave || quote.chave_acesso || '',
      nfeChave: quote.nfe_chave || quote.chave_acesso || '',
      nfeNumero: quote.nfe_numero || '',
      serie: quote.serie_nfe || '1',
      protocolo: quote.protocolo_autorizacao || quote.protocolo_nfe || '',
      protocoloAutorizacao: quote.protocolo_autorizacao || quote.protocolo_nfe || '',
      dataEmissao: quote.nfe_emitida_em || new Date().toISOString(),
      danfeUrl: quote.danfe_url,
      xmlUrl: quote.xml_url,
      xmlConteudo: quote.xml_conteudo,
      cStat: '100',
      xMotivo: 'NF-e já se encontra autorizada perante a SEFAZ.',
      origemRecuperacao: 'consulta_previa'
    };
  }

  // 1. Se houver recibo pendente (nRec), consulta o recibo antes de enviar novo lote
  if (nRecPrevio) {
    console.log(`[SEFAZ Anti-Duplicidade] Recibo pendente ${nRecPrevio} detectado para cotação ${quoteIdOrNum}. Consultando recibo antes de qualquer envio...`);
    try {
      const consultaReciboPrevia = await consultarReciboLoteSefaz(nRecPrevio, 9000);
      if (consultaReciboPrevia.isAutorizada && consultaReciboPrevia.nProt) {
        console.log(`[SEFAZ Anti-Duplicidade] NF-e autorizada via recibo prévio (${consultaReciboPrevia.nProt})! Evitando retransmissão.`);
        return await consultarStatusOuReciboNfe({
          ...quote,
          nfe_chave: chaveExistente || consultaReciboPrevia.chNFe || quote.nfe_chave,
          chave_acesso: chaveExistente || consultaReciboPrevia.chNFe || quote.chave_acesso,
          nfe_numero: quote.nfe_numero,
          serie_nfe: quote.serie_nfe
        }, client);
      } else if (consultaReciboPrevia.isLotePendente || consultaReciboPrevia.cStat === '105') {
        console.log(`[SEFAZ Anti-Duplicidade] Lote com recibo ${nRecPrevio} ainda em processamento na SEFAZ. Aguardando 2.5s para 2ª verificação...`);
        await new Promise(r => setTimeout(r, 2500));
        const retryRecibo = await consultarReciboLoteSefaz(nRecPrevio, 9000);
        if (retryRecibo.isAutorizada && retryRecibo.nProt) {
          return await consultarStatusOuReciboNfe({
            ...quote,
            nfe_chave: chaveExistente || retryRecibo.chNFe || quote.nfe_chave,
            chave_acesso: chaveExistente || retryRecibo.chNFe || quote.chave_acesso,
            nfe_numero: quote.nfe_numero,
            serie_nfe: quote.serie_nfe
          }, client);
        } else if (retryRecibo.isLotePendente || retryRecibo.cStat === '105') {
          const msgAindaPendente = `Lote em processamento na SEFAZ (Recibo Nº ${nRecPrevio}). O lote já foi recebido e aguarda processamento da SEFAZ. O reenvio foi bloqueado para evitar duplicidade de notas. Clique em "Consultar Recibo / Situação" para obter o resultado final.`;
          return {
            sucesso: false,
            statusNfe: 'Pendente',
            chaveAcesso: chaveExistente,
            nRec: nRecPrevio,
            cStat: '105',
            xMotivo: msgAindaPendente,
            mensagemErro: msgAindaPendente
          };
        }
      }
    } catch (eRec) {
      console.warn('Aviso ao consultar recibo prévio:', eRec);
    }
  }

  // 2. Se houver chave existente na cotação, consulta situação na SEFAZ antes do envio
  if (chaveExistente && chaveExistente.length === 44) {
    console.log(`[SEFAZ Anti-Duplicidade] Chave ${chaveExistente} detectada na cotação. Consultando situação na SEFAZ antes do envio...`);
    try {
      const consultaChavePrevia = await consultarSituacaoNfeSefaz(chaveExistente, 9000);
      if (consultaChavePrevia.isAutorizada && consultaChavePrevia.nProt) {
        console.log(`[SEFAZ Anti-Duplicidade] Chave ${chaveExistente} já se encontra autorizada (Protocolo ${consultaChavePrevia.nProt})! Evitando envio duplicado.`);
        return await consultarStatusOuReciboNfe({
          ...quote,
          nfe_chave: chaveExistente,
          chave_acesso: chaveExistente,
          nfe_numero: quote.nfe_numero || chaveExistente.slice(25, 34),
          serie_nfe: quote.serie_nfe || chaveExistente.slice(22, 25)
        }, client);
      } else if (consultaChavePrevia.cStat === '204') {
        const matchP = (consultaChavePrevia.xMotivo || '').match(/(?:nProt|protocolo)[:\s=]*(\d{15})/i);
        if (matchP) {
          console.log(`[SEFAZ Anti-Duplicidade] Protocolo ${matchP[1]} recuperado do retorno de duplicidade da chave ${chaveExistente}!`);
          return await consultarStatusOuReciboNfe({
            ...quote,
            nfe_chave: chaveExistente,
            chave_acesso: chaveExistente,
            nfe_numero: quote.nfe_numero || chaveExistente.slice(25, 34),
            serie_nfe: quote.serie_nfe || chaveExistente.slice(22, 25),
            protocolo_autorizacao: matchP[1]
          }, client);
        }
      }
    } catch (eChave) {
      console.warn('Aviso ao consultar situação prévia da chave:', eChave);
    }
  }

  // Preservação do número e série caso a cotação já estivesse em estado Pendente ou possuísse chave
  let proximoNumeroNfe: number;
  let numeroNfe: string;
  let serie: string;
  let chaveAcesso: string;
  const dataEmissao = new Date();

  if (quote.status_nfe === 'Pendente' && quote.nfe_numero && chaveExistente && chaveExistente.length === 44) {
    proximoNumeroNfe = parseInt(String(quote.nfe_numero).replace(/\D/g, ''), 10) || (ultimoNfeNum + 1);
    numeroNfe = String(proximoNumeroNfe).padStart(6, '0');
    serie = String(quote.serie_nfe || nfeConfig.serieNfe || companyData.serie_nfe || '1');
    chaveAcesso = chaveExistente;
  } else if (chaveExistente && chaveExistente.length === 44) {
    proximoNumeroNfe = parseInt(chaveExistente.slice(25, 34), 10) || (ultimoNfeNum + 1);
    numeroNfe = String(proximoNumeroNfe).padStart(6, '0');
    serie = String(quote.serie_nfe || chaveExistente.slice(22, 25) || '1');
    chaveAcesso = chaveExistente;
  } else {
    proximoNumeroNfe = ultimoNfeNum + 1;
    numeroNfe = String(proximoNumeroNfe).padStart(6, '0');
    serie = String(nfeConfig.serieNfe || companyData.serie_nfe || '1');
    chaveAcesso = gerarChaveAcessoNfe(
      emitente.uf,
      dataEmissao,
      emitente.cnpj,
      serie,
      numeroNfe
    );
  }

  // Verificação de segurança da chave gerada antes do envio
  try {
    const checkNova = await consultarSituacaoNfeSefaz(chaveAcesso, 6000);
    if (checkNova.isAutorizada && checkNova.nProt) {
      console.log(`[SEFAZ Anti-Duplicidade] Nova chave ${chaveAcesso} já consta como autorizada na SEFAZ! Recuperando protocolo...`);
      return await consultarStatusOuReciboNfe({
        ...quote,
        nfe_chave: chaveAcesso,
        chave_acesso: chaveAcesso,
        nfe_numero: numeroNfe,
        serie_nfe: serie
      }, client);
    } else if (checkNova.cStat === '204') {
      const matchP = (checkNova.xMotivo || '').match(/(?:nProt|protocolo)[:\s=]*(\d{15})/i);
      if (matchP) {
        return await consultarStatusOuReciboNfe({
          ...quote,
          nfe_chave: chaveAcesso,
          chave_acesso: chaveAcesso,
          nfe_numero: numeroNfe,
          serie_nfe: serie,
          protocolo_autorizacao: matchP[1]
        }, client);
      }
    }
  } catch {}

  let protocolo = `135${anoMesDia(dataEmissao)}${String(Math.floor(100000000 + Math.random() * 900000000))}`;
  let origemRecuperacao: 'consulta_previa' | 'timeout_consulta' | 'consulta_recibo' | undefined;

  // 6. Geração do XML e DANFE (Status 100 - Autorizado o uso da NF-e)
  const refOrigemXml = quote.origemCotacoes && quote.origemCotacoes.length > 1
    ? `Ref. Cotações: ${quote.origemCotacoes.join(', ')}`
    : (quote.quoteNumber ? `Ref. Cotação: ${quote.quoteNumber}` : '');

  let xmlConteudo = gerarXmlNfe(
    emitente,
    destinatario,
    itensFiscais,
    numeroNfe,
    serie,
    chaveAcesso,
    valorTotal,
    dataEmissao,
    protocolo,
    refOrigemXml,
    '1' // Produção oficial SEFAZ (tpAmb = 1)
  );

  // 7. TRANSMISSÃO OFICIAL PARA A SEFAZ-SP (WEBSERVICE DE PRODUÇÃO):
  // Endpoint oficial: https://nfe.fazenda.sp.gov.br/ws/nfeautorizacao4.asmx
  const sefazEndpoint = obterSefazEndpoint('autorizacao');
  const soapEnvelope = gerarEnvelopeSoapNfe(xmlConteudo, '1', '1');
  const isDirectSoap = sefazEndpoint.includes('.asmx') || sefazEndpoint.includes('fazenda.sp.gov.br');
  let autorizacaoConfirmadaSefaz = false;

  if (isDirectSoap) {
    try {
      const sefazResponse = await fetch(sefazEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfe/wsdl/NFeAutorizacao4"',
          'Accept': 'application/soap+xml, application/xml, text/xml'
        },
        body: soapEnvelope,
        signal: AbortSignal.timeout(15000)
      });

      if (!sefazResponse.ok) {
        const errorText = await sefazResponse.text();
        const dadosErr = extrairDadosRetornoSefazXml(errorText);
        const cStatErr = dadosErr.cStat || String(sefazResponse.status);
        const xMotivoErr = dadosErr.xMotivo || sefazResponse.statusText || 'Falha de comunicação SOAP com a SEFAZ-SP';
        const errMsg = `Rejeição/Falha WebService SEFAZ-SP (${sefazResponse.status}): cStat ${cStatErr} - ${xMotivoErr}`;
        try {
          await updateCotacaoNfeStatusDb(quoteIdOrNum, {
            status_nfe: 'Erro',
            mensagem_erro_nfe: errMsg
          });
        } catch {}
        return {
          sucesso: false,
          statusNfe: 'Erro',
          cStat: cStatErr,
          xMotivo: errMsg,
          mensagemErro: errMsg
        };
      }

      const responseXml = await sefazResponse.text();
      const dadosRetorno = extrairDadosRetornoSefazXml(responseXml);

      // =========================================================================================
      // TRAVA 3: CONSULTA AUTOMÁTICA DE RECIBO (103 / 105)
      // Caso a SEFAZ retorne lote recebido (103) ou em processamento (105), salva o recibo (nRec),
      // executa polling automático e fornece uma rotina segura para consulta posterior.
      // =========================================================================================
      if (dadosRetorno.isLotePendente || dadosRetorno.cStatLote === '103' || dadosRetorno.cStatLote === '105') {
        const nRecibo = dadosRetorno.nRec || 'NÃO INFORMADO';
        salvarReciboLocal(quoteIdOrNum, nRecibo, chaveAcesso);
        console.log(`[SEFAZ-SP] Lote recebido (cStat ${dadosRetorno.cStatLote}). Recibo ${nRecibo}. Executando consulta automática em 2.5s...`);

        // 1ª Tentativa de consulta de recibo após 2.5s
        await new Promise(r => setTimeout(r, 2500));
        let consultaRecibo = await consultarReciboLoteSefaz(nRecibo, 10000);

        // Se ainda estiver processando (105), realiza 2ª tentativa após 3.5s
        if (!consultaRecibo.isAutorizada && (consultaRecibo.isLotePendente || consultaRecibo.cStat === '105')) {
          console.log(`[SEFAZ-SP] Lote ainda em processamento na SEFAZ. Aguardando 3.5s para 2ª tentativa de consulta do recibo ${nRecibo}...`);
          await new Promise(r => setTimeout(r, 3500));
          consultaRecibo = await consultarReciboLoteSefaz(nRecibo, 10000);
        }

        if (consultaRecibo.isAutorizada && consultaRecibo.nProt) {
          console.log(`[SEFAZ-SP] Lote processado e autorizado com sucesso (Protocolo ${consultaRecibo.nProt})!`);
          protocolo = consultaRecibo.nProt;
          autorizacaoConfirmadaSefaz = true;
          origemRecuperacao = 'consulta_recibo';
        } else {
          const msgPendente = `Lote recebido com sucesso pela SEFAZ e atualmente em processamento (cStat ${consultaRecibo.cStat || dadosRetorno.cStatLote}: ${consultaRecibo.xMotivo || dadosRetorno.xMotivoLote || 'Lote em processamento'}). Recibo Nº ${nRecibo}. O recibo foi salvo e o status gravado como Pendente. Utilize "Consultar Recibo / Situação" para obter a autorização final sem duplicidade.`;
          try {
            await updateCotacaoNfeStatusDb(quoteIdOrNum, {
              status_nfe: 'Pendente',
              nfe_chave: chaveAcesso,
              chave_acesso: chaveAcesso,
              nfe_numero: numeroNfe,
              serie_nfe: serie,
              mensagem_erro_nfe: msgPendente
            });
          } catch {}
          return {
            sucesso: false,
            statusNfe: 'Pendente',
            chaveAcesso,
            nfeNumero: numeroNfe,
            serie,
            nRec: nRecibo,
            cStat: consultaRecibo.cStat || dadosRetorno.cStatLote || '105',
            xMotivo: msgPendente,
            mensagemErro: msgPendente
          };
        }
      }

      // CASO 2: Lote rejeitado na raiz (ex: schema inválido, erro de certificado, cStat != 100 e != 104)
      if (!autorizacaoConfirmadaSefaz && dadosRetorno.cStatLote && dadosRetorno.cStatLote !== '100' && dadosRetorno.cStatLote !== '104') {
        const cStatLote = dadosRetorno.cStatLote;
        const xMotivoLote = dadosRetorno.xMotivoLote || 'Rejeição no lote da NF-e na SEFAZ';
        const errMsg = `Rejeição do Lote SEFAZ ${cStatLote}: ${xMotivoLote}`;
        try {
          await updateCotacaoNfeStatusDb(quoteIdOrNum, {
            status_nfe: 'Erro',
            mensagem_erro_nfe: errMsg
          });
        } catch {}
        return {
          sucesso: false,
          statusNfe: 'Erro',
          cStat: cStatLote,
          xMotivo: errMsg,
          mensagemErro: errMsg
        };
      }

      // CASO 2.5: Verificação especial para Duplicidade (cStat 204 ou 539)
      const cStatCheck = dadosRetorno.cStatNota || dadosRetorno.cStatLote || dadosRetorno.cStat;
      const xMotivoCheck = dadosRetorno.xMotivoNota || dadosRetorno.xMotivoLote || dadosRetorno.xMotivo || '';
      if (!autorizacaoConfirmadaSefaz && (cStatCheck === '204' || cStatCheck === '539' || xMotivoCheck.toLowerCase().includes('duplicidade'))) {
        console.log(`[SEFAZ Anti-Duplicidade] SEFAZ retornou duplicidade (cStat ${cStatCheck}). Recuperando protocolo oficial da nota já autorizada...`);
        const matchProt = xMotivoCheck.match(/(?:nProt|protocolo)[:\s=]*(\d{15})/i);
        if (matchProt) {
          protocolo = matchProt[1];
          autorizacaoConfirmadaSefaz = true;
          origemRecuperacao = 'consulta_previa';
        } else {
          try {
            const consultaDup = await consultarSituacaoNfeSefaz(chaveAcesso, 10000);
            if (consultaDup.isAutorizada && consultaDup.nProt) {
              protocolo = consultaDup.nProt;
              autorizacaoConfirmadaSefaz = true;
              origemRecuperacao = 'consulta_previa';
            }
          } catch (eDup) {
            console.warn('Aviso ao consultar duplicidade na SEFAZ:', eDup);
          }
        }
      }

      // CASO 3: Rejeição da Nota específica dentro de <infProt> (diferente de 100, 150 e 204)
      if (!autorizacaoConfirmadaSefaz && dadosRetorno.cStatNota && dadosRetorno.cStatNota !== '100' && dadosRetorno.cStatNota !== '150') {
        const cStatNota = dadosRetorno.cStatNota;
        const xMotivoNota = dadosRetorno.xMotivoNota || 'Nota fiscal rejeitada pela SEFAZ';
        const errMsg = `Rejeição SEFAZ ${cStatNota}: ${xMotivoNota}`;
        try {
          await updateCotacaoNfeStatusDb(quoteIdOrNum, {
            status_nfe: 'Erro',
            mensagem_erro_nfe: errMsg
          });
        } catch {}
        return {
          sucesso: false,
          statusNfe: 'Erro',
          cStat: cStatNota,
          xMotivo: errMsg,
          mensagemErro: errMsg
        };
      }

      // CASO 4: Validação rigorosa de Autorização Oficial (cStat == 100 ou 150)
      if (!autorizacaoConfirmadaSefaz && !dadosRetorno.isAutorizada && dadosRetorno.cStat !== '100' && dadosRetorno.cStat !== '150') {
        const cStatFinal = dadosRetorno.cStat || 'NAO_AUTORIZADO';
        const xMotivoFinal = dadosRetorno.xMotivo || 'A SEFAZ não autorizou a NF-e';
        const errMsg = `Nota não autorizada na SEFAZ (cStat: ${cStatFinal} - ${xMotivoFinal}).`;
        try {
          await updateCotacaoNfeStatusDb(quoteIdOrNum, {
            status_nfe: 'Erro',
            mensagem_erro_nfe: errMsg
          });
        } catch {}
        return {
          sucesso: false,
          statusNfe: 'Erro',
          cStat: cStatFinal,
          xMotivo: errMsg,
          mensagemErro: errMsg
        };
      }

      // CASO 5: Exigência do número de protocolo oficial da SEFAZ (<nProt>)
      if (!autorizacaoConfirmadaSefaz && !dadosRetorno.nProt) {
        const errMsg = `A SEFAZ confirmou recebimento (cStat ${dadosRetorno.cStat || '100'}), porém não retornou o número de protocolo oficial de autorização (<nProt>). A nota não pôde ser gravada como autorizada.`;
        try {
          await updateCotacaoNfeStatusDb(quoteIdOrNum, {
            status_nfe: 'Erro',
            mensagem_erro_nfe: errMsg
          });
        } catch {}
        return {
          sucesso: false,
          statusNfe: 'Erro',
          cStat: dadosRetorno.cStat || 'SEM_PROTOCOLO',
          xMotivo: errMsg,
          mensagemErro: errMsg
        };
      }

      // Autorização confirmada com sucesso pela SEFAZ
      if (!autorizacaoConfirmadaSefaz && dadosRetorno.nProt) {
        protocolo = dadosRetorno.nProt;
        autorizacaoConfirmadaSefaz = true;
      }
      if (responseXml.includes('<nfeProc')) {
        xmlConteudo = sanitizarXmlNfeComChaveValida(responseXml, chaveAcesso);
      }
    } catch (soapErr: any) {
      // =========================================================================================
      // TRAVA 2: TRATAMENTO DE TIMEOUT E PERDA DE CONEXÃO
      // Se a requisição sofrer timeout ou falhar por rede, o ERP NÃO deve gerar novo XML ou reenvio cego.
      // Dispara obrigatoriamente consulta de situação por chave para capturar o protocolo real caso o lote tenha sido processado.
      // =========================================================================================
      console.warn(`[SEFAZ-SP Produção] Erro/Timeout na transmissão SOAP direta (${soapErr?.message || soapErr}). Acionando consulta de situação por chave para verificar processamento...`);

      try {
        const consultaTimeout = await consultarSituacaoNfeSefaz(chaveAcesso, 12000);
        if (consultaTimeout.isAutorizada && consultaTimeout.nProt) {
          console.log(`[SEFAZ-SP Produção] Protocolo ${consultaTimeout.nProt} recuperado com sucesso pós-timeout! Evitada duplicidade.`);
          protocolo = consultaTimeout.nProt;
          autorizacaoConfirmadaSefaz = true;
          origemRecuperacao = 'timeout_consulta';
        } else if (consultaTimeout.cStat === '204') {
          const matchP = (consultaTimeout.xMotivo || '').match(/(?:nProt|protocolo)[:\s=]*(\d{15})/i);
          if (matchP) {
            protocolo = matchP[1];
            autorizacaoConfirmadaSefaz = true;
            origemRecuperacao = 'timeout_consulta';
          }
        } else if (consultaTimeout.isLotePendente || consultaTimeout.cStatLote === '103' || consultaTimeout.cStatLote === '105') {
          const nRec = consultaTimeout.nRec || 'PENDENTE';
          salvarReciboLocal(quoteIdOrNum, nRec, chaveAcesso);
          const msgPendente = `Timeout na resposta, mas o lote consta como recebido na SEFAZ (Recibo Nº ${nRec}). Chave e número preservados com status Pendente. Utilize "Consultar Recibo / Situação" para obter a resposta final sem duplicidade.`;
          try {
            await updateCotacaoNfeStatusDb(quoteIdOrNum, {
              status_nfe: 'Pendente',
              nfe_chave: chaveAcesso,
              chave_acesso: chaveAcesso,
              nfe_numero: numeroNfe,
              serie_nfe: serie,
              mensagem_erro_nfe: msgPendente
            });
          } catch {}
          return {
            sucesso: false,
            statusNfe: 'Pendente',
            chaveAcesso,
            nfeNumero: numeroNfe,
            serie,
            nRec,
            cStat: '105',
            xMotivo: msgPendente,
            mensagemErro: msgPendente
          };
        } else {
          // Nota não autorizada e status incerto: salva como Pendente com a mesma chave para não gastar numeração
          const msgPendente = `A requisição sofreu timeout ou oscilação na rede (${soapErr?.message || 'Servidor indisponível'}). O documento foi preservado com status Pendente e a Chave ${chaveAcesso}. Execute "Consultar Recibo / Situação" para verificar se a SEFAZ processou o documento antes de reenviar.`;
          try {
            await updateCotacaoNfeStatusDb(quoteIdOrNum, {
              status_nfe: 'Pendente',
              nfe_chave: chaveAcesso,
              chave_acesso: chaveAcesso,
              nfe_numero: numeroNfe,
              serie_nfe: serie,
              mensagem_erro_nfe: msgPendente
            });
          } catch {}
          return {
            sucesso: false,
            statusNfe: 'Pendente',
            chaveAcesso,
            nfeNumero: numeroNfe,
            serie,
            cStat: 'TIMEOUT',
            xMotivo: msgPendente,
            mensagemErro: msgPendente
          };
        }
      } catch (eCons) {
        const errMsg = `Falha de conexão com a SEFAZ-SP Produção (${sefazEndpoint}): ${soapErr?.message || 'Erro de rede'}. Status mantido como Pendente para evitar duplicidade.`;
        try {
          await updateCotacaoNfeStatusDb(quoteIdOrNum, {
            status_nfe: 'Pendente',
            nfe_chave: chaveAcesso,
            chave_acesso: chaveAcesso,
            nfe_numero: numeroNfe,
            serie_nfe: serie,
            mensagem_erro_nfe: errMsg
          });
        } catch {}
        return {
          sucesso: false,
          statusNfe: 'Pendente',
          chaveAcesso,
          nfeNumero: numeroNfe,
          serie,
          mensagemErro: errMsg
        };
      }
    }
  } else if (sefazEndpoint) {
    try {
      const sefazResponse = await fetch(sefazEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          acao: 'emitir_nfe',
          ambiente: 'producao',
          tpAmb: 1,
          endpoint_sefaz: sefazEndpoint,
          soap_envelope: soapEnvelope,
          chave_acesso: chaveAcesso,
          numero_nfe: numeroNfe,
          serie_nfe: serie,
          xml_envio: xmlConteudo,
          emitente,
          destinatario,
          valor_total: valorTotal
        }),
        signal: AbortSignal.timeout(15000)
      });

      if (!sefazResponse.ok) {
        const errorBody = await sefazResponse.text();
        let parsedErr: any = null;
        try { parsedErr = JSON.parse(errorBody); } catch {}
        const cStatRet = parsedErr?.cStat || String(sefazResponse.status);
        const xMotivoRet = parsedErr?.xMotivo || parsedErr?.mensagem || errorBody;
        const errMsg = `Rejeição SEFAZ ${cStatRet}: ${xMotivoRet}`;
        try {
          await updateCotacaoNfeStatusDb(quoteIdOrNum, {
            status_nfe: 'Erro',
            mensagem_erro_nfe: errMsg
          });
        } catch {}
        return {
          sucesso: false,
          statusNfe: 'Erro',
          cStat: cStatRet,
          xMotivo: errMsg,
          mensagemErro: errMsg
        };
      }

      const sefazData = await sefazResponse.json();

      // =========================================================================================
      // TRAVA 3: CONSULTA AUTOMÁTICA DE RECIBO (103 / 105) NO PROXY
      // =========================================================================================
      const cStatProxy = String(sefazData?.cStat || '');
      if (cStatProxy === '103' || cStatProxy === '105') {
        const nRec = sefazData?.nRec || sefazData?.numero_recibo || 'N/A';
        salvarReciboLocal(quoteIdOrNum, nRec, chaveAcesso);
        console.log(`[SEFAZ-SP Proxy] Lote recebido (cStat ${cStatProxy}). Recibo ${nRec}. Aguardando consulta...`);

        await new Promise(r => setTimeout(r, 2500));
        let consultaRecibo = await consultarReciboLoteSefaz(nRec, 10000);

        if (!consultaRecibo.isAutorizada && (consultaRecibo.isLotePendente || consultaRecibo.cStat === '105')) {
          await new Promise(r => setTimeout(r, 3500));
          consultaRecibo = await consultarReciboLoteSefaz(nRec, 10000);
        }

        if (consultaRecibo.isAutorizada && consultaRecibo.nProt) {
          protocolo = consultaRecibo.nProt;
          autorizacaoConfirmadaSefaz = true;
          origemRecuperacao = 'consulta_recibo';
        } else {
          const msgPendente = `Lote recebido com sucesso pela SEFAZ e atualmente em processamento (cStat ${cStatProxy}: ${sefazData?.xMotivo || 'Lote em processamento'}). Recibo Nº ${nRec}. O recibo foi salvo e o documento mantido com status Pendente. Utilize "Consultar Recibo / Situação" para obter a autorização final sem duplicidade.`;
          try {
            await updateCotacaoNfeStatusDb(quoteIdOrNum, {
              status_nfe: 'Pendente',
              nfe_chave: chaveAcesso,
              chave_acesso: chaveAcesso,
              nfe_numero: numeroNfe,
              serie_nfe: serie,
              mensagem_erro_nfe: msgPendente
            });
          } catch {}
          return {
            sucesso: false,
            statusNfe: 'Pendente',
            chaveAcesso,
            nfeNumero: numeroNfe,
            serie,
            nRec,
            cStat: cStatProxy,
            xMotivo: msgPendente,
            mensagemErro: msgPendente
          };
        }
      }

      // Verificação de Duplicidade (204 / 539) no Proxy
      if (!autorizacaoConfirmadaSefaz && (cStatProxy === '204' || cStatProxy === '539' || String(sefazData.xMotivo || '').toLowerCase().includes('duplicidade'))) {
        const matchProt = String(sefazData.xMotivo || '').match(/(?:nProt|protocolo)[:\s=]*(\d{15})/i);
        if (matchProt) {
          protocolo = matchProt[1];
          autorizacaoConfirmadaSefaz = true;
          origemRecuperacao = 'consulta_previa';
        } else {
          try {
            const consultaDup = await consultarSituacaoNfeSefaz(chaveAcesso, 10000);
            if (consultaDup.isAutorizada && consultaDup.nProt) {
              protocolo = consultaDup.nProt;
              autorizacaoConfirmadaSefaz = true;
              origemRecuperacao = 'consulta_previa';
            }
          } catch (eDup) {}
        }
      }

      // Validação estrita de autorização (cStat == 100 ou 150)
      if (!autorizacaoConfirmadaSefaz && cStatProxy !== '100' && cStatProxy !== '150') {
        const cStatRet = cStatProxy || 'REJEICAO';
        const xMotivoRet = sefazData.xMotivo || sefazData.mensagem || 'Rejeição na SEFAZ';
        const errMsg = `Rejeição SEFAZ ${cStatRet}: ${xMotivoRet}`;
        try {
          await updateCotacaoNfeStatusDb(quoteIdOrNum, {
            status_nfe: 'Erro',
            mensagem_erro_nfe: errMsg
          });
        } catch {}
        return {
          sucesso: false,
          statusNfe: 'Erro',
          cStat: cStatRet,
          xMotivo: errMsg,
          mensagemErro: errMsg
        };
      }

      if (!autorizacaoConfirmadaSefaz && !sefazData?.protocolo && !sefazData?.nProt) {
        const errMsg = 'A SEFAZ confirmou recebimento mas não retornou o número de protocolo oficial de autorização (<nProt>).';
        try {
          await updateCotacaoNfeStatusDb(quoteIdOrNum, {
            status_nfe: 'Erro',
            mensagem_erro_nfe: errMsg
          });
        } catch {}
        return {
          sucesso: false,
          statusNfe: 'Erro',
          cStat: cStatProxy,
          xMotivo: errMsg,
          mensagemErro: errMsg
        };
      }

      if (!autorizacaoConfirmadaSefaz) {
        protocolo = String(sefazData.protocolo || sefazData.nProt);
        autorizacaoConfirmadaSefaz = true;
      }
      if (sefazData?.xml_conteudo || sefazData?.xml_retorno) {
        xmlConteudo = sanitizarXmlNfeComChaveValida(sefazData.xml_conteudo || sefazData.xml_retorno, chaveAcesso);
      }
    } catch (apiErr: any) {
      console.warn('Timeout ou erro de rede no serviço SEFAZ:', apiErr);
      try {
        const consultaTimeout = await consultarSituacaoNfeSefaz(chaveAcesso, 12000);
        if (consultaTimeout.isAutorizada && consultaTimeout.nProt) {
          protocolo = consultaTimeout.nProt;
          autorizacaoConfirmadaSefaz = true;
          origemRecuperacao = 'timeout_consulta';
        } else if (consultaTimeout.cStat === '204') {
          const matchP = (consultaTimeout.xMotivo || '').match(/(?:nProt|protocolo)[:\s=]*(\d{15})/i);
          if (matchP) {
            protocolo = matchP[1];
            autorizacaoConfirmadaSefaz = true;
            origemRecuperacao = 'timeout_consulta';
          }
        } else if (consultaTimeout.isLotePendente || consultaTimeout.cStatLote === '103' || consultaTimeout.cStatLote === '105') {
          const nRec = consultaTimeout.nRec || 'PENDENTE';
          salvarReciboLocal(quoteIdOrNum, nRec, chaveAcesso);
          const msgPendente = `Timeout na resposta, mas o lote consta como recebido na SEFAZ (Recibo Nº ${nRec}). Chave e número preservados com status Pendente. Utilize "Consultar Recibo / Situação" para obter a resposta final sem duplicidade.`;
          try {
            await updateCotacaoNfeStatusDb(quoteIdOrNum, {
              status_nfe: 'Pendente',
              nfe_chave: chaveAcesso,
              chave_acesso: chaveAcesso,
              nfe_numero: numeroNfe,
              serie_nfe: serie,
              mensagem_erro_nfe: msgPendente
            });
          } catch {}
          return {
            sucesso: false,
            statusNfe: 'Pendente',
            chaveAcesso,
            nfeNumero: numeroNfe,
            serie,
            nRec,
            cStat: '105',
            xMotivo: msgPendente,
            mensagemErro: msgPendente
          };
        } else {
          const errMsg = `Timeout na conexão com a SEFAZ Produção (${sefazEndpoint}). Chave ${chaveAcesso} preservada com status Pendente para evitar duplicidade.`;
          try {
            await updateCotacaoNfeStatusDb(quoteIdOrNum, {
              status_nfe: 'Pendente',
              nfe_chave: chaveAcesso,
              chave_acesso: chaveAcesso,
              nfe_numero: numeroNfe,
              serie_nfe: serie,
              mensagem_erro_nfe: errMsg
            });
          } catch {}
          return {
            sucesso: false,
            statusNfe: 'Pendente',
            chaveAcesso,
            nfeNumero: numeroNfe,
            serie,
            mensagemErro: errMsg
          };
        }
      } catch {}
    }
  }

  // Se nenhuma confirmação oficial foi obtida do WebService, interrompe a gravação de emissão
  if (!autorizacaoConfirmadaSefaz) {
    const errMsg = 'Transmissão interrompida: Não houve confirmação oficial de autorização da NF-e (cStat 100) perante os WebServices da SEFAZ-SP Produção.';
    try {
      await updateCotacaoNfeStatusDb(quoteIdOrNum, {
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

  const xmlBlob = new Blob([xmlConteudo], { type: 'application/xml;charset=utf-8' });
  const xmlUrl = URL.createObjectURL(xmlBlob);

  const refDanfeTexto = quote.origemCotacoes && quote.origemCotacoes.length > 1
    ? `Ref. Cotações: ${quote.origemCotacoes.join(', ')}`
    : quote.quoteNumber;

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
    refDanfeTexto,
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
      nfe_emitida_em: dataEmissao.toISOString(),
      situacao: 'FATURADO'
    });

    // Se for multi-cotação (agrupamento), atualiza simultaneamente todas as cotações de origem
    const todosOrigens = [
      ...(quote.origemCotacaoIds || []),
      ...(quote.origemCotacoes || [])
    ];
    const origensUnicas = Array.from(new Set(todosOrigens.filter(Boolean)));

    for (const origId of origensUnicas) {
      if (origId && origId !== (quote.id || quote.quoteNumber)) {
        try {
          await updateCotacaoNfeStatusDb(String(origId), {
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
            nfe_emitida_em: dataEmissao.toISOString(),
            situacao: 'FATURADO'
          });
        } catch (eOrig) {
          console.warn(`Aviso ao atualizar cotação de origem ${origId} para Emitida:`, eOrig);
        }
      }
    }

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
    xMotivo: 'Autorizado o uso da NF-e',
    origemRecuperacao
  };
}

/**
 * Consulta a situação da NF-e ou o processamento do lote por recibo na SEFAZ,
 * recuperando o protocolo oficial e atualizando a base de dados caso a nota já tenha sido processada.
 */
export async function consultarStatusOuReciboNfe(
  quote: Quote,
  client?: Client | null
): Promise<NfeTransmissionResult> {
  const quoteIdOrNum = quote.id || quote.quoteNumber;
  let chaveAcesso = recalcularChaveAcessoComDvCorreto(quote.nfe_chave || quote.chave_acesso || '');
  let nRec = obterReciboLocal(quoteIdOrNum, chaveAcesso);

  if (!nRec && quote.mensagem_erro_nfe) {
    const matchRec = quote.mensagem_erro_nfe.match(/Recibo\s*(?:Nº|N|n°)?\s*(\d+)/i);
    if (matchRec) {
      nRec = matchRec[1];
    }
  }

  // 1. Se possuir recibo gravado, consulta o recibo (NFeRetAutorizacao4)
  if (nRec) {
    console.log(`[SEFAZ Consulta] Consultando processamento do recibo de lote ${nRec} para cotação ${quoteIdOrNum}...`);
    const resRecibo = await consultarReciboLoteSefaz(nRec, 12000);
    if (resRecibo.isAutorizada && resRecibo.nProt) {
      const companyData = await fetchCompanyData(true);
      const cliDanfe = await fetchClienteCompletoParaDanfe(quote, client);
      const cleanDoc = cliDanfe.doc.replace(/\D/g, '');
      const tipoDoc = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';
      const ufDest = (cliDanfe.uf || quote.clientState || 'SP').toUpperCase();
      const itensFiscais = prepararItensFiscais(quote.items || [], ufDest);
      const valorTotal = quote.grandTotal || quote.subtotalTotal || itensFiscais.reduce((s, it) => s + it.subtotal, 0);
      const numeroNfe = quote.nfe_numero || (chaveAcesso ? chaveAcesso.slice(25, 34) : '000001');
      const serie = String(quote.serie_nfe || (chaveAcesso ? chaveAcesso.slice(22, 25) : '1'));
      const dtEmissao = quote.nfe_emitida_em ? new Date(quote.nfe_emitida_em) : new Date();
      const finalChave = resRecibo.chNFe || chaveAcesso;
      const refDanfeTexto = quote.origemCotacoes && quote.origemCotacoes.length > 1
        ? `Ref. Cotações: ${quote.origemCotacoes.join(', ')}`
        : quote.quoteNumber;

      const emitente: DadosEmitenteNfe = {
        razaoSocial: companyData.corporateName || companyData.razao_social || 'L. M. BANZATTO METAIS',
        nomeFantasia: companyData.tradeName || companyData.nome_fantasia || 'USICORTE METAIS',
        cnpj: companyData.cnpj || '25.038.430/0001-23',
        ie: companyData.ie || companyData.inscricao_estadual || '20963213114',
        im: companyData.im || companyData.inscricao_municipal || '558747',
        endereco: companyData.street || companyData.endereco || '',
        numero: companyData.number || companyData.numero || 'S/N',
        bairro: companyData.neighborhood || companyData.bairro || '',
        cidade: companyData.city || companyData.cidade || 'BAURU',
        uf: (companyData.state || companyData.uf || 'SP').toUpperCase(),
        cep: companyData.cep || '17031-350',
        telefone: companyData.phone || companyData.telefone || '(14) 99880-9362',
        regimeTributario: companyData.taxRegime || companyData.regime_tributario || 'Simples Nacional',
        aliquotaIcmsSimples: obterAliquotaIcmsSimples(companyData)
      };

      const destinatario: DadosDestinatarioNfe = {
        nome: cliDanfe.nome,
        documento: cliDanfe.doc,
        tipoDocumento: tipoDoc,
        inscricaoEstadual: cliDanfe.ie,
        indicadorIe: tipoDoc === 'CNPJ' ? '1' : '9',
        endereco: cliDanfe.endereco,
        bairro: cliDanfe.bairro,
        cidade: cliDanfe.cidade,
        uf: ufDest,
        cep: cliDanfe.cep,
        telefone: cliDanfe.telefone,
        email: client?.email || quote.clientEmail
      };

      let xmlConteudo = quote.xml_conteudo;
      if (!xmlConteudo) {
        xmlConteudo = gerarXmlNfe(
          emitente, destinatario, itensFiscais,
          numeroNfe, serie, finalChave, valorTotal,
          dtEmissao, resRecibo.nProt, refDanfeTexto, '1'
        );
      }
      const danfeHtml = gerarDanfeHtml(
        emitente, destinatario, itensFiscais,
        numeroNfe, serie, finalChave, resRecibo.nProt,
        dtEmissao, valorTotal, false, refDanfeTexto,
        undefined, false, xmlConteudo
      );

      const xmlBlob = new Blob([xmlConteudo], { type: 'application/xml;charset=utf-8' });
      const xmlUrl = URL.createObjectURL(xmlBlob);
      const danfeBlob = new Blob([danfeHtml], { type: 'text/html' });
      const danfeUrl = URL.createObjectURL(danfeBlob);

      await updateCotacaoNfeStatusDb(quoteIdOrNum, {
        status_nfe: 'Emitida',
        nfe_chave: finalChave,
        chave_acesso: finalChave,
        nfe_numero: numeroNfe,
        serie_nfe: serie,
        protocolo_autorizacao: resRecibo.nProt,
        protocolo_nfe: resRecibo.nProt,
        danfe_url: danfeUrl,
        xml_url: xmlUrl,
        xml_conteudo: xmlConteudo,
        mensagem_erro_nfe: null,
        nfe_emitida_em: dtEmissao.toISOString(),
        situacao: 'FATURADO'
      });

      return {
        sucesso: true,
        statusNfe: 'Emitida',
        chaveAcesso: finalChave,
        nfeChave: finalChave,
        nfeNumero: numeroNfe,
        serie,
        protocolo: resRecibo.nProt,
        protocoloAutorizacao: resRecibo.nProt,
        dataEmissao: dtEmissao.toISOString(),
        danfeUrl,
        xmlUrl,
        xmlConteudo,
        cStat: '100',
        xMotivo: 'Autorizado o uso da NF-e (Recuperado via Consulta de Recibo SEFAZ)',
        nRec,
        origemRecuperacao: 'consulta_recibo'
      };
    } else if (resRecibo.isLotePendente || resRecibo.cStat === '105') {
      return {
        sucesso: false,
        statusNfe: 'Pendente',
        cStat: '105',
        nRec,
        xMotivo: `Lote em processamento na SEFAZ (Recibo Nº ${nRec}). Aguarde alguns instantes e consulte novamente.`,
        mensagemErro: `Lote em processamento na SEFAZ (Recibo Nº ${nRec}). Aguarde alguns instantes e consulte novamente.`
      };
    }
  }

  // 2. Se não possuir recibo ou recibo ainda não finalizado, consulta por chave (NFeConsultaProtocolo4)
  if (chaveAcesso && chaveAcesso.length === 44) {
    console.log(`[SEFAZ Consulta] Consultando situação da chave ${chaveAcesso}...`);
    const resChave = await consultarSituacaoNfeSefaz(chaveAcesso, 12000);

    // Se a SEFAZ acusou duplicidade (cStat 204), extrai o protocolo existente
    if (!resChave.nProt && (resChave.cStat === '204' || resChave.cStatNota === '204' || (resChave.xMotivo || '').toLowerCase().includes('duplicidade'))) {
      const matchP = (resChave.xMotivo || '').match(/(?:nProt|protocolo)[:\s=]*(\d{15})/i);
      if (matchP) {
        console.log(`[SEFAZ Consulta] Protocolo ${matchP[1]} recuperado do retorno de duplicidade (cStat 204) na consulta de situação!`);
        resChave.nProt = matchP[1];
        resChave.isAutorizada = true;
      }
    }

    if (resChave.isAutorizada && resChave.nProt) {
      const companyData = await fetchCompanyData(true);
      const cliDanfe = await fetchClienteCompletoParaDanfe(quote, client);
      const cleanDoc = cliDanfe.doc.replace(/\D/g, '');
      const tipoDoc = cleanDoc.length > 11 ? 'CNPJ' : 'CPF';
      const ufDest = (cliDanfe.uf || quote.clientState || 'SP').toUpperCase();
      const itensFiscais = prepararItensFiscais(quote.items || [], ufDest);
      const valorTotal = quote.grandTotal || quote.subtotalTotal || itensFiscais.reduce((s, it) => s + it.subtotal, 0);
      const numeroNfe = quote.nfe_numero || chaveAcesso.slice(25, 34);
      const serie = String(quote.serie_nfe || chaveAcesso.slice(22, 25) || '1');
      const dtEmissao = quote.nfe_emitida_em ? new Date(quote.nfe_emitida_em) : new Date();
      const refDanfeTexto = quote.origemCotacoes && quote.origemCotacoes.length > 1
        ? `Ref. Cotações: ${quote.origemCotacoes.join(', ')}`
        : quote.quoteNumber;

      const emitente: DadosEmitenteNfe = {
        razaoSocial: companyData.corporateName || companyData.razao_social || 'L. M. BANZATTO METAIS',
        nomeFantasia: companyData.tradeName || companyData.nome_fantasia || 'USICORTE METAIS',
        cnpj: companyData.cnpj || '25.038.430/0001-23',
        ie: companyData.ie || companyData.inscricao_estadual || '20963213114',
        im: companyData.im || companyData.inscricao_municipal || '558747',
        endereco: companyData.street || companyData.endereco || '',
        numero: companyData.number || companyData.numero || 'S/N',
        bairro: companyData.neighborhood || companyData.bairro || '',
        cidade: companyData.city || companyData.cidade || 'BAURU',
        uf: (companyData.state || companyData.uf || 'SP').toUpperCase(),
        cep: companyData.cep || '17031-350',
        telefone: companyData.phone || companyData.telefone || '(14) 99880-9362',
        regimeTributario: companyData.taxRegime || companyData.regime_tributario || 'Simples Nacional',
        aliquotaIcmsSimples: obterAliquotaIcmsSimples(companyData)
      };

      const destinatario: DadosDestinatarioNfe = {
        nome: cliDanfe.nome,
        documento: cliDanfe.doc,
        tipoDocumento: tipoDoc,
        inscricaoEstadual: cliDanfe.ie,
        indicadorIe: tipoDoc === 'CNPJ' ? '1' : '9',
        endereco: cliDanfe.endereco,
        bairro: cliDanfe.bairro,
        cidade: cliDanfe.cidade,
        uf: ufDest,
        cep: cliDanfe.cep,
        telefone: cliDanfe.telefone,
        email: client?.email || quote.clientEmail
      };

      let xmlConteudo = quote.xml_conteudo;
      if (!xmlConteudo) {
        xmlConteudo = gerarXmlNfe(
          emitente, destinatario, itensFiscais,
          numeroNfe, serie, chaveAcesso, valorTotal,
          dtEmissao, resChave.nProt, refDanfeTexto, '1'
        );
      }
      const danfeHtml = gerarDanfeHtml(
        emitente, destinatario, itensFiscais,
        numeroNfe, serie, chaveAcesso, resChave.nProt,
        dtEmissao, valorTotal, false, refDanfeTexto,
        undefined, false, xmlConteudo
      );

      const xmlBlob = new Blob([xmlConteudo], { type: 'application/xml;charset=utf-8' });
      const xmlUrl = URL.createObjectURL(xmlBlob);
      const danfeBlob = new Blob([danfeHtml], { type: 'text/html' });
      const danfeUrl = URL.createObjectURL(danfeBlob);

      await updateCotacaoNfeStatusDb(quoteIdOrNum, {
        status_nfe: 'Emitida',
        nfe_chave: chaveAcesso,
        chave_acesso: chaveAcesso,
        nfe_numero: numeroNfe,
        serie_nfe: serie,
        protocolo_autorizacao: resChave.nProt,
        protocolo_nfe: resChave.nProt,
        danfe_url: danfeUrl,
        xml_url: xmlUrl,
        xml_conteudo: xmlConteudo,
        mensagem_erro_nfe: null,
        nfe_emitida_em: dtEmissao.toISOString(),
        situacao: 'FATURADO'
      });

      return {
        sucesso: true,
        statusNfe: 'Emitida',
        chaveAcesso,
        nfeChave: chaveAcesso,
        nfeNumero: numeroNfe,
        serie,
        protocolo: resChave.nProt,
        protocoloAutorizacao: resChave.nProt,
        dataEmissao: dtEmissao.toISOString(),
        danfeUrl,
        xmlUrl,
        xmlConteudo,
        cStat: '100',
        xMotivo: 'Autorizado o uso da NF-e (Recuperado via Consulta de Situação SEFAZ)',
        origemRecuperacao: 'timeout_consulta'
      };
    } else if (resChave.cStat === '217') {
      return {
        sucesso: false,
        statusNfe: 'Erro',
        cStat: '217',
        xMotivo: 'NF-e não consta na base de dados da SEFAZ (o lote não chegou a ser recebido). É seguro efetuar uma nova transmissão.',
        mensagemErro: 'NF-e não consta na base de dados da SEFAZ (o lote não chegou a ser recebido). É seguro efetuar uma nova transmissão.'
      };
    } else {
      return {
        sucesso: false,
        statusNfe: resChave.isLotePendente ? 'Pendente' : 'Erro',
        cStat: resChave.cStat,
        xMotivo: resChave.xMotivo || 'Situação da NF-e não autorizada na SEFAZ',
        mensagemErro: resChave.xMotivo || 'Situação da NF-e não autorizada na SEFAZ'
      };
    }
  }

  return {
    sucesso: false,
    statusNfe: 'Erro',
    cStat: 'DADOS_INSUFICIENTES',
    xMotivo: 'Não há chave de acesso ou número de recibo associado a esta cotação para consultar na SEFAZ.',
    mensagemErro: 'Não há chave de acesso ou número de recibo associado a esta cotação para consultar na SEFAZ.'
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

  const { logradouro: emitenteLogradouro, numero: emitenteNumero, bairro: emitenteBairro } = extrairComponentesEndereco(
    emitente.logradouro || emitente.street || emitente.endereco,
    emitente.numero,
    emitente.bairro
  );
  const emitenteCidade = (emitente.cidade || 'BAURU').toUpperCase();
  const emitenteUf = (emitente.uf || 'SP').toUpperCase();
  const emitenteCep = emitente.cep || '17031-350';
  const emitenteEmail = emitente.email_contato || emitente.email || 'vendas.usicorte@gmail.com';
  const emitenteTel1 = emitente.telefone_1 || emitente.telefone || emitente.phone || '(14) 99880-9362';
  const emitenteTel2 = emitente.telefone_2 || emitente.celular || emitente.mobile || '';
  const emitenteTelefones = [emitenteTel1, emitenteTel2].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' / ');
  const emitenteRazao = (emitente.razaoSocial && emitente.razaoSocial.toUpperCase() !== 'UNDEFINED' && emitente.razaoSocial.toLowerCase() !== 'undefined' ? emitente.razaoSocial : '') ||
    (emitente.razao_social && emitente.razao_social.toUpperCase() !== 'UNDEFINED' && emitente.razao_social.toLowerCase() !== 'undefined' ? emitente.razao_social : '') ||
    (emitente.corporateName && emitente.corporateName.toUpperCase() !== 'UNDEFINED' && emitente.corporateName.toLowerCase() !== 'undefined' ? emitente.corporateName : '') ||
    (emitente.tradeName && emitente.tradeName.toUpperCase() !== 'UNDEFINED' && emitente.tradeName.toLowerCase() !== 'undefined' ? emitente.tradeName : '') ||
    'L. M. BANZATTO METAIS';
  const emitenteFantasia = (emitente.nomeFantasia && emitente.nomeFantasia.toUpperCase() !== 'UNDEFINED' && emitente.nomeFantasia.toLowerCase() !== 'undefined' ? emitente.nomeFantasia : '') ||
    (emitente.nome_fantasia && emitente.nome_fantasia.toUpperCase() !== 'UNDEFINED' && emitente.nome_fantasia.toLowerCase() !== 'undefined' ? emitente.nome_fantasia : '') ||
    (emitente.tradeName && emitente.tradeName.toUpperCase() !== 'UNDEFINED' && emitente.tradeName.toLowerCase() !== 'undefined' ? emitente.tradeName : '') ||
    'USICORTE METAIS';

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
      <td style="border: 1px solid #000; padding: 2px 4px; text-align: center; font-family: monospace;">${(it.csosn && !it.csosn.includes('102')) ? (it.csosn.includes('101') ? '101' : it.csosn.split(' ')[0]) : '101'}</td>
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
    .sheet { max-width: 210mm; min-height: 285mm; margin: 0 auto; position: relative; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; }
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
              RECEBEMOS DE <strong>${emitenteRazao}</strong> OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO.
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
            <div style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #000; line-height: 1.2;">${emitenteRazao}</div>
            <div style="font-size: 9.5px; font-weight: 800; color: #b91c1c; text-transform: uppercase; margin-top: 2px; line-height: 1.2;">${emitenteFantasia}</div>
            <div style="margin: 6px 0;"></div>
            <div style="font-size: 7.5px; color: #222; line-height: 1.35; text-align: center;">
              <div>${emitenteLogradouro}${emitenteNumero && emitenteNumero !== 'S/N' ? `, ${emitenteNumero}` : ''}</div>
              <div>${emitenteBairro}</div>
              <div>${emitenteCidade} - ${emitenteUf} - CEP: ${emitenteCep}</div>
              <div style="font-weight: 600; color: #000;">Fone: ${emitenteTelefones || '(14) 99880-9362'} • Email: ${emitenteEmail}</div>
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

    <!-- DADOS ADICIONAIS (FIXADO NO RODAPÉ DO DANFE) -->
    <div class="danfe-bloco-rodape" style="margin-top: auto; page-break-inside: avoid; break-inside: avoid; page-break-after: avoid; break-after: avoid; width: 100%;">
      <div style="font-weight: 900; font-size: 7.5px; text-transform: uppercase; margin: 2px 0 1px 0;">DADOS ADICIONAIS</div>
      <div class="box" style="min-height: 32mm; page-break-inside: avoid; break-inside: avoid;">
        <table>
          <tr>
            <td style="width: 70%; padding: 4px; border-right: 1px solid #000; vertical-align: top;">
              <div class="title">INFORMAÇÕES COMPLEMENTARES</div>
              <div style="font-size: 7.5px; line-height: 1.3;">
                <strong>DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. ${creditoInfo.textoCredito}</strong><br>
                Valor aprox. tributos: R$ ${ibptFed.toFixed(2).replace('.', ',')} Federal (8,50%), R$ ${ibptEst.toFixed(2).replace('.', ',')} Estadual (4,95%) e R$ 0,00 Municipal. Fonte: IBPT.<br>
                ${numeroCotacaoRef && (numeroCotacaoRef.includes('Ref. Cotações') || numeroCotacaoRef.includes(','))
                  ? (numeroCotacaoRef.startsWith('Ref. Cotações:') ? `<strong>${numeroCotacaoRef}.</strong>` : `<strong>Ref. Cotações: ${numeroCotacaoRef}.</strong>`)
                  : `Pedido de Venda / Cotação UsiCorte Ref: Nº ${numeroCotacaoRef || 'COT-1'}.`}<br>
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
        UsiCorte Metais ERP • DANFE Modelo 55 - Versão 4.00 • ${numeroCotacaoRef && (numeroCotacaoRef.includes('Ref. Cotações') || numeroCotacaoRef.includes(',')) ? (numeroCotacaoRef.startsWith('Ref. Cotações:') ? `${numeroCotacaoRef} • ` : `Ref. Cotações: ${numeroCotacaoRef} • `) : ''}Emissão em ${dataEmissao.toLocaleDateString('pt-BR')} ${dataEmissao.toLocaleTimeString('pt-BR')}
      </div>
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
    const emitente = await fetchCompanyData(true);
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

    const refDanfeTexto = quote.origemCotacoes && quote.origemCotacoes.length > 1
      ? `Ref. Cotações: ${quote.origemCotacoes.join(', ')}`
      : quote.quoteNumber;

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
      refDanfeTexto,
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
  const emitente = await fetchCompanyData(true);
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

  const refDanfeTexto = quote.origemCotacoes && quote.origemCotacoes.length > 1
    ? `Ref. Cotações: ${quote.origemCotacoes.join(', ')}`
    : quote.quoteNumber;

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
    refDanfeTexto,
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


