import { CompanyFiscalData } from '../types';
export type { CompanyFiscalData };
import { db } from '../lib/db';

export const DEFAULT_COMPANY_DATA: CompanyFiscalData = {
  id: 'empresa-default',
  // 1. Dados Fiscais
  personType: 'Jurídica',
  corporateName: 'L. M. BANZATTO METAIS',
  tradeName: 'USICORTE METAIS',
  cnpj: '25.038.430/0001-23',
  ie: '20963213114',
  im: '558747',
  cnae: '4744001',
  taxRegime: 'Simples Nacional',
  aliquotaIcmsSimples: 2.75,

  // 2. Endereço Completo
  cep: '17031-350',
  street: 'RUA CORONEL IVON CESAR PIMENTEL',
  number: '3-41',
  complement: '',
  neighborhood: 'PARQUE PAULISTA',
  city: 'BAURU',
  state: 'SP',
  ibgeCode: '3506003',
  countryCode: '1058 - BRASIL',

  // 3. Contato e Mídia
  email: 'financeirousicorte@gmail.com',
  website: 'WWW.USICORTEMETAIS.COM.BR',
  phone: '(14) 99880-9362',
  mobile: '(14) 99819-6873',
  logoUrl: '',

  // 4. Responsável Legal
  legalRepresentativeName: 'MARCOS MARTINS',
  legalRepresentativeDoc: '092.345.510/0001-94',

  // 5. Numeração Sequencial de Cotações / Pedidos
  nextQuoteSequential: 140,
  proximo_numero_sequencial: 140,
  quotePrefix: 'COT-2026-',
  proximo_numero_cotacao: 140,
  prefixo_cotacao: 'COT-2026-',

  // 6. Controle de Numeração Fiscal (NF-e Modelo 55)
  ultimo_numero_nfe: 0,
  serie_nfe: 1,

  // 7. Informações para Pagamento & Chave PIX (Dinâmico)
  chavePix: '25.038.430/0001-23',
  tipoChavePix: 'CNPJ',
  favorecidoPix: 'L. M. BANZATTO METAIS',
  bancoNome: 'Banco do Brasil S.A.',
  bancoAgencia: '0037-1',
  bancoConta: '45.890-1',
  bancoTitular: 'L. M. BANZATTO METAIS',
  bancoCnpj: '25.038.430/0001-23',
  instrucoesPagamento: 'Após efetuar o pagamento, favor encaminhar o comprovante para o WhatsApp (14) 99880-9362 / (14) 99819-6873 ou e-mail financeirousicorte@gmail.com para rápida conciliação e baixa no sistema.',

  // Aliases
  tipo_pessoa: 'Jurídica',
  razao_social: 'L. M. BANZATTO METAIS',
  nome_fantasia: 'USICORTE METAIS',
  inscricao_estadual: '209632312114',
  inscricao_municipal: '558747',
  regime_tributario: 'Simples Nacional',
  aliquota_icms_simples: 2.75,
  endereco: 'RUA CORONEL IVON CESAR PIMENTEL',
  numero: '3-41',
  complemento: '',
  bairro: 'PARQUE PAULISTA',
  cidade: 'BAURU',
  uf: 'SP',
  ibge_cidade: '3506003',
  codigo_pais: '1058',
  telefone: '(14) 99880-9362',
  celular: '(14) 99819-6873',
  nome_responsavel: 'MARCOS MARTINS',
  documento_responsavel: '092.345.510/0001-94',
  chave_pix: '25.038.430/0001-23',
  tipo_chave_pix: 'CNPJ',
  favorecido_pix: 'L. M. BANZATTO METAIS',
  banco_nome: 'Banco do Brasil S.A.',
  banco_agencia: '0037-1',
  banco_conta: '45.890-1',
  banco_titular: 'L. M. BANZATTO METAIS',
  banco_cnpj: '25.038.430/0001-23',
  instrucoes_pagamento: 'Após efetuar o pagamento, favor encaminhar o comprovante para o WhatsApp (14) 99880-9362 / (14) 99819-6873 ou e-mail financeirousicorte@gmail.com para rápida conciliação e baixa no sistema.'
};

const STORAGE_KEY = 's_empresa_emitente';

export function mapSupabaseToCompany(row: any): CompanyFiscalData {
  if (!row) return DEFAULT_COMPANY_DATA;

  return {
    id: row.id ? String(row.id) : DEFAULT_COMPANY_DATA.id,
    personType: row.tipo_pessoa || row.person_type || row.personType || DEFAULT_COMPANY_DATA.personType,
    corporateName: row.razao_social || row.corporate_name || row.corporateName || row.nome || DEFAULT_COMPANY_DATA.corporateName,
    tradeName: row.nome_fantasia || row.trade_name || row.tradeName || row.fantasia || DEFAULT_COMPANY_DATA.tradeName,
    cnpj: row.cnpj || row.documento || DEFAULT_COMPANY_DATA.cnpj,
    ie: row.inscricao_estadual || row.ie || DEFAULT_COMPANY_DATA.ie,
    im: row.inscricao_municipal || row.im || DEFAULT_COMPANY_DATA.im,
    cnae: row.cnae || DEFAULT_COMPANY_DATA.cnae,
    taxRegime: row.regime_tributario || row.tax_regime || row.taxRegime || DEFAULT_COMPANY_DATA.taxRegime,
    aliquotaIcmsSimples: row.aliquota_icms_simples !== undefined && row.aliquota_icms_simples !== null
      ? Number(row.aliquota_icms_simples)
      : (row.aliquotaIcmsSimples !== undefined && row.aliquotaIcmsSimples !== null
        ? Number(row.aliquotaIcmsSimples)
        : (DEFAULT_COMPANY_DATA.aliquotaIcmsSimples ?? 2.75)),
    aliquota_icms_simples: row.aliquota_icms_simples !== undefined && row.aliquota_icms_simples !== null
      ? Number(row.aliquota_icms_simples)
      : (row.aliquotaIcmsSimples !== undefined && row.aliquotaIcmsSimples !== null
        ? Number(row.aliquotaIcmsSimples)
        : (DEFAULT_COMPANY_DATA.aliquota_icms_simples ?? 2.75)),

    cep: row.cep || DEFAULT_COMPANY_DATA.cep,
    street: row.endereco || row.logradouro || row.street || DEFAULT_COMPANY_DATA.street,
    number: row.numero || row.number || DEFAULT_COMPANY_DATA.number,
    complement: row.complemento || row.complement || '',
    neighborhood: row.bairro || row.neighborhood || DEFAULT_COMPANY_DATA.neighborhood,
    city: row.cidade || row.city || row.municipio || DEFAULT_COMPANY_DATA.city,
    state: (row.uf || row.state || row.estado || DEFAULT_COMPANY_DATA.state).toUpperCase(),
    ibgeCode: row.ibge_cidade || row.ibge_code || row.ibgeCode || DEFAULT_COMPANY_DATA.ibgeCode,
    countryCode: row.codigo_pais || row.country_code || row.countryCode || DEFAULT_COMPANY_DATA.countryCode,

    email: row.email || row.e_mail || DEFAULT_COMPANY_DATA.email,
    website: row.website || row.site || DEFAULT_COMPANY_DATA.website,
    phone: row.telefone || row.phone || DEFAULT_COMPANY_DATA.phone,
    mobile: row.celular || row.mobile || row.whatsapp || DEFAULT_COMPANY_DATA.mobile,
    logoUrl: row.logo_url || row.logoUrl || '',

    legalRepresentativeName: row.nome_responsavel || row.legal_representative_name || row.legalRepresentativeName || DEFAULT_COMPANY_DATA.legalRepresentativeName,
    legalRepresentativeDoc: row.documento_responsavel || row.legal_representative_doc || row.legalRepresentativeDoc || DEFAULT_COMPANY_DATA.legalRepresentativeDoc,

    // 5. Numeração Sequencial
    nextQuoteSequential: typeof row.proximo_numero_sequencial === 'number' && !isNaN(row.proximo_numero_sequencial)
      ? row.proximo_numero_sequencial
      : (typeof row.nextQuoteSequential === 'number' && !isNaN(row.nextQuoteSequential)
        ? row.nextQuoteSequential
        : (typeof row.proximo_numero_cotacao === 'number' && !isNaN(row.proximo_numero_cotacao)
          ? row.proximo_numero_cotacao
          : (parseInt(row.proximo_numero_sequencial || row.proximo_numero_cotacao || row.nextQuoteSequential, 10) || 140))),
    proximo_numero_sequencial: typeof row.proximo_numero_sequencial === 'number' && !isNaN(row.proximo_numero_sequencial)
      ? row.proximo_numero_sequencial
      : (typeof row.nextQuoteSequential === 'number' && !isNaN(row.nextQuoteSequential)
        ? row.nextQuoteSequential
        : (typeof row.proximo_numero_cotacao === 'number' && !isNaN(row.proximo_numero_cotacao)
          ? row.proximo_numero_cotacao
          : (parseInt(row.proximo_numero_sequencial || row.proximo_numero_cotacao || row.nextQuoteSequential, 10) || 140))),
    quotePrefix: row.prefixo_cotacao || row.quotePrefix || DEFAULT_COMPANY_DATA.quotePrefix,

    // 6. Controle de Numeração Fiscal (NF-e)
    ultimo_numero_nfe: typeof row.ultimo_numero_nfe === 'number' && !isNaN(row.ultimo_numero_nfe)
      ? row.ultimo_numero_nfe
      : (typeof row.ultimoNumeroNfe === 'number' && !isNaN(row.ultimoNumeroNfe)
        ? row.ultimoNumeroNfe
        : (parseInt(row.ultimo_numero_nfe || row.ultimoNumeroNfe, 10) || 0)),
    serie_nfe: typeof row.serie_nfe === 'number' && !isNaN(row.serie_nfe)
      ? row.serie_nfe
      : (typeof row.serieNfe === 'number' && !isNaN(row.serieNfe)
        ? row.serieNfe
        : (parseInt(row.serie_nfe || row.serieNfe, 10) || 1)),

    // 7. Dados Bancários & PIX
    chavePix: row.chave_pix !== undefined && row.chave_pix !== null ? row.chave_pix : (row.chavePix ?? DEFAULT_COMPANY_DATA.chavePix),
    tipoChavePix: row.tipo_chave_pix !== undefined && row.tipo_chave_pix !== null ? row.tipo_chave_pix : (row.tipoChavePix ?? DEFAULT_COMPANY_DATA.tipoChavePix),
    favorecidoPix: row.favorecido_pix !== undefined && row.favorecido_pix !== null ? row.favorecido_pix : (row.favorecidoPix ?? DEFAULT_COMPANY_DATA.favorecidoPix),
    bancoNome: row.banco_nome !== undefined && row.banco_nome !== null ? row.banco_nome : (row.bancoNome ?? DEFAULT_COMPANY_DATA.bancoNome),
    bancoAgencia: row.banco_agencia !== undefined && row.banco_agencia !== null ? row.banco_agencia : (row.bancoAgencia ?? DEFAULT_COMPANY_DATA.bancoAgencia),
    bancoConta: row.banco_conta !== undefined && row.banco_conta !== null ? row.banco_conta : (row.bancoConta ?? DEFAULT_COMPANY_DATA.bancoConta),
    bancoTitular: row.banco_titular !== undefined && row.banco_titular !== null ? row.banco_titular : (row.bancoTitular ?? DEFAULT_COMPANY_DATA.bancoTitular),
    bancoCnpj: row.banco_cnpj !== undefined && row.banco_cnpj !== null ? row.banco_cnpj : (row.bancoCnpj ?? DEFAULT_COMPANY_DATA.bancoCnpj),
    instrucoesPagamento: row.instrucoes_pagamento !== undefined && row.instrucoes_pagamento !== null ? row.instrucoes_pagamento : (row.instrucoesPagamento ?? DEFAULT_COMPANY_DATA.instrucoesPagamento),

    // Aliases
    tipo_pessoa: row.tipo_pessoa || DEFAULT_COMPANY_DATA.personType,
    razao_social: row.razao_social || DEFAULT_COMPANY_DATA.corporateName,
    nome_fantasia: row.nome_fantasia || DEFAULT_COMPANY_DATA.tradeName,
    inscricao_estadual: row.inscricao_estadual || row.ie || DEFAULT_COMPANY_DATA.ie,
    inscricao_municipal: row.inscricao_municipal || row.im || DEFAULT_COMPANY_DATA.im,
    regime_tributario: row.regime_tributario || DEFAULT_COMPANY_DATA.taxRegime,
    endereco: row.endereco || DEFAULT_COMPANY_DATA.street,
    numero: row.numero || DEFAULT_COMPANY_DATA.number,
    complemento: row.complemento || '',
    bairro: row.bairro || DEFAULT_COMPANY_DATA.neighborhood,
    cidade: row.cidade || DEFAULT_COMPANY_DATA.city,
    uf: (row.uf || row.estado || DEFAULT_COMPANY_DATA.state).toUpperCase(),
    ibge_cidade: row.ibge_cidade || DEFAULT_COMPANY_DATA.ibgeCode,
    codigo_pais: row.codigo_pais || DEFAULT_COMPANY_DATA.countryCode,
    telefone: row.telefone || DEFAULT_COMPANY_DATA.phone,
    celular: row.celular || DEFAULT_COMPANY_DATA.mobile,
    logo_url: row.logo_url || '',
    nome_responsavel: row.nome_responsavel || DEFAULT_COMPANY_DATA.legalRepresentativeName,
    documento_responsavel: row.documento_responsavel || DEFAULT_COMPANY_DATA.legalRepresentativeDoc,
    proximo_numero_cotacao: typeof row.proximo_numero_sequencial === 'number' && !isNaN(row.proximo_numero_sequencial)
      ? row.proximo_numero_sequencial
      : (typeof row.proximo_numero_cotacao === 'number' && !isNaN(row.proximo_numero_cotacao)
        ? row.proximo_numero_cotacao
        : (typeof row.nextQuoteSequential === 'number' && !isNaN(row.nextQuoteSequential)
          ? row.nextQuoteSequential
          : (parseInt(row.proximo_numero_sequencial || row.proximo_numero_cotacao || row.nextQuoteSequential, 10) || 140))),
    prefixo_cotacao: row.prefixo_cotacao || row.quotePrefix || DEFAULT_COMPANY_DATA.quotePrefix,
    chave_pix: row.chave_pix !== undefined && row.chave_pix !== null ? row.chave_pix : (row.chavePix ?? DEFAULT_COMPANY_DATA.chavePix),
    tipo_chave_pix: row.tipo_chave_pix !== undefined && row.tipo_chave_pix !== null ? row.tipo_chave_pix : (row.tipoChavePix ?? DEFAULT_COMPANY_DATA.tipoChavePix),
    favorecido_pix: row.favorecido_pix !== undefined && row.favorecido_pix !== null ? row.favorecido_pix : (row.favorecidoPix ?? DEFAULT_COMPANY_DATA.favorecidoPix),
    banco_nome: row.banco_nome !== undefined && row.banco_nome !== null ? row.banco_nome : (row.bancoNome ?? DEFAULT_COMPANY_DATA.bancoNome),
    banco_agencia: row.banco_agencia !== undefined && row.banco_agencia !== null ? row.banco_agencia : (row.bancoAgencia ?? DEFAULT_COMPANY_DATA.bancoAgencia),
    banco_conta: row.banco_conta !== undefined && row.banco_conta !== null ? row.banco_conta : (row.bancoConta ?? DEFAULT_COMPANY_DATA.bancoConta),
    banco_titular: row.banco_titular !== undefined && row.banco_titular !== null ? row.banco_titular : (row.bancoTitular ?? DEFAULT_COMPANY_DATA.bancoTitular),
    banco_cnpj: row.banco_cnpj !== undefined && row.banco_cnpj !== null ? row.banco_cnpj : (row.bancoCnpj ?? DEFAULT_COMPANY_DATA.bancoCnpj),
    instrucoes_pagamento: row.instrucoes_pagamento !== undefined && row.instrucoes_pagamento !== null ? row.instrucoes_pagamento : (row.instrucoesPagamento ?? DEFAULT_COMPANY_DATA.instrucoesPagamento),
    updated_at: row.updated_at || new Date().toISOString()
  };
}

export function mapCompanyToSupabase(data: CompanyFiscalData): Record<string, any> {
  const street = data.street || data.endereco || '';
  const num = data.number || data.numero || '';
  const neighborhood = data.neighborhood || data.bairro || '';
  
  let fullEndereco = street;
  if (num && !fullEndereco.includes(num)) {
    fullEndereco += `, ${num}`;
  }
  if (neighborhood && !fullEndereco.includes(neighborhood)) {
    fullEndereco += ` - ${neighborhood}`;
  }

  const seq = typeof data.proximo_numero_sequencial === 'number' && !isNaN(data.proximo_numero_sequencial)
    ? data.proximo_numero_sequencial
    : (typeof data.nextQuoteSequential === 'number' && !isNaN(data.nextQuoteSequential)
      ? data.nextQuoteSequential
      : (typeof data.proximo_numero_cotacao === 'number' && !isNaN(data.proximo_numero_cotacao)
        ? data.proximo_numero_cotacao
        : (parseInt(String(data.proximo_numero_sequencial || data.nextQuoteSequential || data.proximo_numero_cotacao || 140), 10) || 140)));

  const prefix = data.prefixo_cotacao || data.quotePrefix || 'COT-2026-';

  return {
    razao_social: data.corporateName || data.razao_social || '',
    nome_fantasia: data.tradeName || data.nome_fantasia || '',
    cnpj: data.cnpj || '',
    ie: data.ie || data.inscricao_estadual || '',
    telefone: data.phone || data.telefone || '',
    email: data.email || '',
    endereco: fullEndereco,
    cidade: data.city || data.cidade || '',
    estado: (data.state || data.uf || 'SP').toUpperCase(),
    cep: data.cep || '',
    proximo_numero_sequencial: seq,
    prefixo_cotacao: prefix,
    ultimo_numero_nfe: typeof data.ultimo_numero_nfe === 'number' && !isNaN(data.ultimo_numero_nfe)
      ? data.ultimo_numero_nfe
      : (parseInt(String(data.ultimo_numero_nfe || 0), 10) || 0),
    serie_nfe: typeof data.serie_nfe === 'number' && !isNaN(data.serie_nfe)
      ? data.serie_nfe
      : (parseInt(String(data.serie_nfe || 1), 10) || 1),
    chave_pix: data.chavePix !== undefined ? data.chavePix : (data.chave_pix || ''),
    tipo_chave_pix: data.tipoChavePix !== undefined ? data.tipoChavePix : (data.tipo_chave_pix || ''),
    favorecido_pix: data.favorecidoPix !== undefined ? data.favorecidoPix : (data.favorecido_pix || ''),
    banco_nome: data.bancoNome !== undefined ? data.bancoNome : (data.banco_nome || ''),
    banco_agencia: data.bancoAgencia !== undefined ? data.bancoAgencia : (data.banco_agencia || ''),
    banco_conta: data.bancoConta !== undefined ? data.bancoConta : (data.banco_conta || ''),
    banco_titular: data.bancoTitular !== undefined ? data.bancoTitular : (data.banco_titular || ''),
    banco_cnpj: data.bancoCnpj !== undefined ? data.bancoCnpj : (data.banco_cnpj || ''),
    instrucoes_pagamento: data.instrucoesPagamento !== undefined ? data.instrucoesPagamento : (data.instrucoes_pagamento || '')
  };
}

/**
 * Obtém os dados da empresa salvos localmente de forma instantânea
 */
export function getLocalCompanyData(): CompanyFiscalData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.email && (parsed.email.toLowerCase().includes('luan.usicorte') || parsed.email.toLowerCase().includes('financeiro.usicorte'))) {
        parsed.email = DEFAULT_COMPANY_DATA.email;
      }
      if (parsed.phone && (parsed.phone.includes('3203-1742') || parsed.phone.includes('32031742'))) {
        parsed.phone = DEFAULT_COMPANY_DATA.phone;
        parsed.telefone = DEFAULT_COMPANY_DATA.telefone;
      }
      if (!parsed.mobile || parsed.mobile.includes('3203-1742')) {
        parsed.mobile = DEFAULT_COMPANY_DATA.mobile;
        parsed.celular = DEFAULT_COMPANY_DATA.celular;
      }
      return { ...DEFAULT_COMPANY_DATA, ...parsed };
    }
  } catch (e) {
    console.warn('Erro ao ler dados locais da empresa:', e);
  }
  return DEFAULT_COMPANY_DATA;
}

/**
 * Busca dados da empresa do Supabase (tabela emitente) com fallback garantido para LocalStorage
 */
export async function fetchCompanyData(): Promise<CompanyFiscalData> {
  // 1. Tenta carregar do Supabase (tabela emitente)
  try {
    let data: any = null;
    let error: any = null;

    // Busca direta segura sem order('created_at') para evitar quebra caso a coluna não exista
    const res = await db
      .from('emitente')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!res.error && res.data) {
      data = res.data;
    } else {
      // Tenta tabela alternativa empresa_emitente
      const resAlt = await db
        .from('empresa_emitente')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (!resAlt.error && resAlt.data) {
        data = resAlt.data;
      }
    }

    if (data) {
      const local = getLocalCompanyData();
      const mapped = mapSupabaseToCompany(data);
      const merged: CompanyFiscalData = {
        ...DEFAULT_COMPANY_DATA,
        ...local,
        ...mapped,
        chavePix: data.chave_pix !== null && data.chave_pix !== undefined ? data.chave_pix : (mapped.chavePix ?? local.chavePix),
        tipoChavePix: data.tipo_chave_pix !== null && data.tipo_chave_pix !== undefined ? data.tipo_chave_pix : (mapped.tipoChavePix ?? local.tipoChavePix),
        favorecidoPix: data.favorecido_pix !== null && data.favorecido_pix !== undefined ? data.favorecido_pix : (mapped.favorecidoPix ?? local.favorecidoPix),
        bancoNome: data.banco_nome !== null && data.banco_nome !== undefined ? data.banco_nome : (mapped.bancoNome ?? local.bancoNome),
        bancoAgencia: data.banco_agencia !== null && data.banco_agencia !== undefined ? data.banco_agencia : (mapped.bancoAgencia ?? local.bancoAgencia),
        bancoConta: data.banco_conta !== null && data.banco_conta !== undefined ? data.banco_conta : (mapped.bancoConta ?? local.bancoConta),
        bancoTitular: data.banco_titular !== null && data.banco_titular !== undefined ? data.banco_titular : (mapped.bancoTitular ?? local.bancoTitular),
        bancoCnpj: data.banco_cnpj !== null && data.banco_cnpj !== undefined ? data.banco_cnpj : (mapped.bancoCnpj ?? local.bancoCnpj),
        instrucoesPagamento: data.instrucoes_pagamento !== null && data.instrucoes_pagamento !== undefined ? data.instrucoes_pagamento : (mapped.instrucoesPagamento ?? local.instrucoesPagamento),
        ultimo_numero_nfe: data.ultimo_numero_nfe !== null && data.ultimo_numero_nfe !== undefined 
          ? Number(data.ultimo_numero_nfe) 
          : (mapped.ultimo_numero_nfe ?? local.ultimo_numero_nfe ?? 0),
        serie_nfe: data.serie_nfe !== null && data.serie_nfe !== undefined ? Number(data.serie_nfe) : (mapped.serie_nfe ?? local.serie_nfe ?? 1),
        aliquotaIcmsSimples: (data as any).aliquota_icms_simples !== null && (data as any).aliquota_icms_simples !== undefined
          ? Number((data as any).aliquota_icms_simples)
          : (mapped.aliquotaIcmsSimples ?? local.aliquotaIcmsSimples ?? 2.75),
        aliquota_icms_simples: (data as any).aliquota_icms_simples !== null && (data as any).aliquota_icms_simples !== undefined
          ? Number((data as any).aliquota_icms_simples)
          : (mapped.aliquota_icms_simples ?? local.aliquota_icms_simples ?? 2.75),
        updated_at: data.updated_at || data.created_at || new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('Aviso ao consultar tabela emitente:', err);
  }

  // 2. Tenta tabela alternativa configuracoes caso exista
  try {
    const { data: configData } = await db
      .from('configuracoes')
      .select('*')
      .eq('chave', 'empresa_emitente')
      .maybeSingle();

    if (configData && configData.valor) {
      const parsed = typeof configData.valor === 'string' ? JSON.parse(configData.valor) : configData.valor;
      const mapped = mapSupabaseToCompany(parsed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
      return mapped;
    }
  } catch (e) {
    // Silently fallback
  }

  // 3. Fallback no LocalStorage ou Padrão
  return getLocalCompanyData();
}

/**
 * Salva os dados fiscais da empresa localmente e no Supabase (tabela emitente)
 */
export async function saveCompanyData(data: CompanyFiscalData): Promise<{ success: boolean; data: CompanyFiscalData; error?: any }> {
  // 1. Salva imediatamente no LocalStorage
  const payload = { ...data, updated_at: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  // Dispara evento global para que todos os componentes (cabeçalho, relatórios, etc.) atualizem imediatamente
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('company-data-updated', { detail: payload }));
  }

  // 2. Persiste no Supabase (tabela emitente)
  try {
    const dbPayload = mapCompanyToSupabase(payload);
    
    // Busca registro existente de forma segura sem dependência de created_at
    const { data: existing } = await db
      .from('emitente')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existing && existing.id) {
      let { data: updated, error: updateError } = await db
        .from('emitente')
        .update(dbPayload)
        .eq('id', existing.id)
        .select()
        .single();

      // Fallback gracioso com colunas essenciais caso alguma coluna extra (como dados bancários) não exista
      if (updateError) {
        console.warn('UPDATE emitente completo falhou, tentando colunas essenciais:', updateError.message);
        const essentialPayload = {
          razao_social: dbPayload.razao_social,
          nome_fantasia: dbPayload.nome_fantasia,
          cnpj: dbPayload.cnpj,
          ie: dbPayload.ie,
          telefone: dbPayload.telefone,
          email: dbPayload.email,
          endereco: dbPayload.endereco,
          cidade: dbPayload.cidade,
          estado: dbPayload.estado,
          cep: dbPayload.cep,
          proximo_numero_sequencial: dbPayload.proximo_numero_sequencial,
          prefixo_cotacao: dbPayload.prefixo_cotacao,
          ultimo_numero_nfe: dbPayload.ultimo_numero_nfe,
          serie_nfe: dbPayload.serie_nfe
        };
        const fbRes = await db
          .from('emitente')
          .update(essentialPayload)
          .eq('id', existing.id)
          .select()
          .single();

        if (!fbRes.error && fbRes.data) {
          updated = fbRes.data;
          updateError = null;
        }
      }

      if (!updateError && updated) {
        const result = {
          ...payload,
          ...mapSupabaseToCompany(updated),
          id: updated.id
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        return { success: true, data: result };
      }
    } else {
      let { data: inserted, error: insertError } = await db
        .from('emitente')
        .insert([dbPayload])
        .select()
        .single();

      if (insertError) {
        const essentialPayload = {
          razao_social: dbPayload.razao_social,
          nome_fantasia: dbPayload.nome_fantasia,
          cnpj: dbPayload.cnpj,
          ie: dbPayload.ie,
          telefone: dbPayload.telefone,
          email: dbPayload.email,
          endereco: dbPayload.endereco,
          cidade: dbPayload.cidade,
          estado: dbPayload.estado,
          cep: dbPayload.cep,
          proximo_numero_sequencial: dbPayload.proximo_numero_sequencial,
          prefixo_cotacao: dbPayload.prefixo_cotacao,
          ultimo_numero_nfe: dbPayload.ultimo_numero_nfe,
          serie_nfe: dbPayload.serie_nfe
        };
        const fbIns = await db.from('emitente').insert([essentialPayload]).select().single();
        if (!fbIns.error && fbIns.data) {
          inserted = fbIns.data;
          insertError = null;
        }
      }

      if (!insertError && inserted) {
        const result = {
          ...payload,
          ...mapSupabaseToCompany(inserted),
          id: inserted.id
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        return { success: true, data: result };
      }
    }
  } catch (e) {
    console.warn('Aviso ao sincronizar dados da empresa no Supabase:', e);
  }

  // Garante que o ultimo_numero_nfe seja gravado via updateEmitenteNfeConfig
  await updateEmitenteNfeConfig(payload.ultimo_numero_nfe || 0, payload.serie_nfe || 1);

  // Tenta backup na tabela genérica configuracoes
  try {
    await db
      .from('configuracoes')
      .upsert({ chave: 'empresa_emitente', valor: payload }, { onConflict: 'chave' });
  } catch (e) {
    // local fallback already guaranteed
  }

  return { success: true, data: payload };
}

/**
 * 1. Leitura da Numeração da Aba Emitente:
 * Busca as configurações de numeração diretamente da tabela 'emitente' no Supabase:
 * - 'proximo_numero_sequencial' (ex: 140)
 * - 'prefixo_cotacao' (ex: COT-2026-)
 */
export async function fetchEmitenteNumberingConfig(): Promise<{ nextSequential: number; prefix: string }> {
  try {
    const { data, error } = await db
      .from('emitente')
      .select('proximo_numero_sequencial, prefixo_cotacao')
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const nextSequential = typeof data.proximo_numero_sequencial === 'number' && !isNaN(data.proximo_numero_sequencial)
        ? data.proximo_numero_sequencial
        : (parseInt(data.proximo_numero_sequencial, 10) || 140);
      const prefix = data.prefixo_cotacao || 'COT-2026-';

      // Atualiza cache local instantâneo
      const local = getLocalCompanyData();
      local.proximo_numero_sequencial = nextSequential;
      local.nextQuoteSequential = nextSequential;
      local.proximo_numero_cotacao = nextSequential;
      local.prefixo_cotacao = prefix;
      local.quotePrefix = prefix;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
      } catch {}

      return { nextSequential, prefix };
    }
  } catch (err) {
    console.warn('Aviso ao buscar configurações de numeração da tabela emitente:', err);
  }

  // Fallback para dados locais
  const local = getLocalCompanyData();
  const nextSequential = typeof local.proximo_numero_sequencial === 'number' && !isNaN(local.proximo_numero_sequencial)
    ? local.proximo_numero_sequencial
    : (typeof local.nextQuoteSequential === 'number' && !isNaN(local.nextQuoteSequential)
      ? local.nextQuoteSequential
      : (typeof local.proximo_numero_cotacao === 'number' && !isNaN(local.proximo_numero_cotacao)
        ? local.proximo_numero_cotacao
        : 140));
  const prefix = local.prefixo_cotacao || local.quotePrefix || 'COT-2026-';
  return { nextSequential, prefix };
}

/**
 * 2. Proteção contra Duplicidade & Resolução de Número Único:
 * - Busca as configurações na tabela 'emitente'
 * - Formata combinando o prefixo com o sequencial preenchido com zeros (ex: 140 vira COT-2026-000140)
 * - Verifica na tabela 'cotacoes' se o número gerado já existe
 * - Se já existir, busca o maior número sequencial cadastrado no banco, soma +1 e usa esse novo número
 */
export async function resolveNextUniqueQuoteNumber(
  existingLocalQuotes?: { quoteNumber?: string; numero?: string; id?: string }[]
): Promise<{ quoteNumber: string; sequential: number; prefix: string; wasAdjustedDueToDuplicate: boolean }> {
  // 1. Busca configurações da tabela emitente
  const config = await fetchEmitenteNumberingConfig();
  const prefix = config.prefix || 'COT-2026-';
  const targetSeq = config.nextSequential || 140;

  // 2. Coleta todos os números existentes em 'cotacoes' no Supabase
  const existingSet = new Set<string>();
  const allDbRows: { numero?: string }[] = [];

  try {
    const { data: cotacoesData } = await db.from('cotacoes').select('numero');
    if (cotacoesData && Array.isArray(cotacoesData)) {
      cotacoesData.forEach(r => {
        allDbRows.push(r);
        const s = (r.numero || '').trim().toLowerCase();
        if (s) existingSet.add(s);
      });
    }
  } catch (e) {
    console.warn('Aviso ao consultar números na tabela cotacoes:', e);
  }

  // Mescla com cotações locais em memória caso passadas
  if (existingLocalQuotes && Array.isArray(existingLocalQuotes)) {
    existingLocalQuotes.forEach(q => {
      const s = (q.quoteNumber || q.numero || q.id || '').trim().toLowerCase();
      if (s) existingSet.add(s);
    });
  }

  const initialCandidate = `${prefix}${String(targetSeq).padStart(6, '0')}`;

  // Se o número gerado ainda não existe, pode ser usado com segurança
  if (!existingSet.has(initialCandidate.toLowerCase())) {
    return {
      quoteNumber: initialCandidate,
      sequential: targetSeq,
      prefix,
      wasAdjustedDueToDuplicate: false
    };
  }

  // 2. Se já existir, busca o maior número sequencial cadastrado no banco, soma +1
  const seqs: number[] = [];
  for (const row of allDbRows) {
    const numStr = (row.numero || '').trim();
    const match = numStr.match(/(\d+)$/);
    if (match) {
      seqs.push(parseInt(match[1], 10));
    }
  }
  if (existingLocalQuotes && Array.isArray(existingLocalQuotes)) {
    for (const q of existingLocalQuotes) {
      const numStr = String(q.quoteNumber || q.numero || q.id || '').trim();
      const match = numStr.match(/(\d+)$/);
      if (match) {
        seqs.push(parseInt(match[1], 10));
      }
    }
  }

  seqs.sort((a, b) => a - b);

  // Identifica a sequência ativa a partir de targetSeq (filtrando pedidos específicos de clientes com salto grande > 100)
  const higherOrEqual = seqs.filter(s => s >= targetSeq);
  let topInSequence = targetSeq;

  if (higherOrEqual.length > 0) {
    for (let i = 0; i < higherOrEqual.length; i++) {
      const curr = higherOrEqual[i];
      if (i === 0) {
        topInSequence = curr;
      } else {
        const prev = higherOrEqual[i - 1];
        if (curr - prev > 100) {
          // Salto brusco (ex: de 171 para 3574 de cliente externo)
          break;
        }
        topInSequence = curr;
      }
    }
  } else if (seqs.length > 0) {
    topInSequence = seqs[seqs.length - 1];
  }

  let resolvedSeq = topInSequence + 1;

  // Garante que o número final é absolutamente único (avança caso haja colisão)
  while (existingSet.has(`${prefix}${String(resolvedSeq).padStart(6, '0')}`.toLowerCase())) {
    resolvedSeq++;
  }

  const resolvedNumber = `${prefix}${String(resolvedSeq).padStart(6, '0')}`;

  return {
    quoteNumber: resolvedNumber,
    sequential: resolvedSeq,
    prefix,
    wasAdjustedDueToDuplicate: true
  };
}

/**
 * 3. Atualização Automática ao Gravar:
 * Assim que um novo orçamento for salvo com sucesso, atualiza o 'proximo_numero_sequencial'
 * na tabela 'emitente' (somando +1) para que a próxima cotação já venha com o número seguinte automático (ex: 141).
 */
export async function updateEmitenteNextSequential(nextSequential: number): Promise<boolean> {
  try {
    const { data: existing } = await db
      .from('emitente')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.id) {
      const { error } = await db
        .from('emitente')
        .update({
          proximo_numero_sequencial: nextSequential
        })
        .eq('id', existing.id);

      if (error) {
        console.warn('Erro ao atualizar proximo_numero_sequencial no Supabase:', error);
      }
    }

    // Atualiza cache local e dispara evento para sincronizar todas as abas
    const local = getLocalCompanyData();
    local.proximo_numero_sequencial = nextSequential;
    local.nextQuoteSequential = nextSequential;
    local.proximo_numero_cotacao = nextSequential;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
    } catch {}

    window.dispatchEvent(new CustomEvent('company-data-updated', { detail: local }));
    return true;
  } catch (err) {
    console.warn('Falha ao atualizar proximo_numero_sequencial:', err);
    return false;
  }
}

/**
 * Incrementa o número sequencial do emitente na gravação de um orçamento
 */
export async function incrementEmitenteQuoteSequential(usedSequential?: number): Promise<number> {
  const currentConfig = await fetchEmitenteNumberingConfig();
  const current = currentConfig.nextSequential;
  const next = typeof usedSequential === 'number' && !isNaN(usedSequential) && usedSequential >= current
    ? usedSequential + 1
    : current + 1;

  await updateEmitenteNextSequential(next);
  return next;
}

/**
 * Obtém a configuração de numeração sequencial de cotações de forma síncrona/cache
 */
export function getQuoteSequentialConfig(): { nextSequential: number; prefix: string } {
  const comp = getLocalCompanyData();
  const nextSequential = typeof comp.proximo_numero_sequencial === 'number' && !isNaN(comp.proximo_numero_sequencial)
    ? comp.proximo_numero_sequencial
    : (typeof comp.nextQuoteSequential === 'number' && !isNaN(comp.nextQuoteSequential)
      ? comp.nextQuoteSequential
      : (typeof comp.proximo_numero_cotacao === 'number' && !isNaN(comp.proximo_numero_cotacao)
        ? comp.proximo_numero_cotacao
        : 140));
  const prefix = comp.prefixo_cotacao || comp.quotePrefix || 'COT-2026-';
  return { nextSequential, prefix };
}

/**
 * Incrementa o número sequencial de cotação nas configurações e persiste
 */
export function incrementQuoteSequentialConfig(usedSequential?: number): number {
  const currentConfig = getQuoteSequentialConfig();
  const current = currentConfig.nextSequential;
  const next = typeof usedSequential === 'number' && !isNaN(usedSequential) && usedSequential >= current
    ? usedSequential + 1
    : current + 1;

  updateEmitenteNextSequential(next).catch(() => {});
  return next;
}

/**
 * Atualiza o número sequencial de cotação nas configurações
 */
export function setQuoteSequentialConfig(nextSequential: number, prefix?: string): void {
  const comp = getLocalCompanyData();
  comp.proximo_numero_sequencial = nextSequential;
  comp.nextQuoteSequential = nextSequential;
  comp.proximo_numero_cotacao = nextSequential;
  if (prefix !== undefined) {
    comp.quotePrefix = prefix;
    comp.prefixo_cotacao = prefix;
  }
  updateEmitenteNextSequential(nextSequential).catch(() => {});
}

/**
 * Busca as configurações de controle fiscal de NF-e da tabela 'emitente'
 */
export async function fetchEmitenteNfeConfig(): Promise<{ ultimoNumeroNfe: number; serieNfe: number }> {
  try {
    let data: any = null;
    const res = await db
      .from('emitente')
      .select('ultimo_numero_nfe, serie_nfe')
      .limit(1)
      .maybeSingle();

    if (!res.error && res.data) {
      data = res.data;
    } else {
      const resAlt = await db
        .from('empresa_emitente')
        .select('ultimo_numero_nfe, serie_nfe')
        .limit(1)
        .maybeSingle();
      if (!resAlt.error && resAlt.data) {
        data = resAlt.data;
      }
    }

    if (data) {
      const ultimoNumeroNfe = typeof data.ultimo_numero_nfe === 'number' && !isNaN(data.ultimo_numero_nfe)
        ? data.ultimo_numero_nfe
        : (parseInt(data.ultimo_numero_nfe, 10) || 0);
      const serieNfe = typeof data.serie_nfe === 'number' && !isNaN(data.serie_nfe)
        ? data.serie_nfe
        : (parseInt(data.serie_nfe, 10) || 1);
      return { ultimoNumeroNfe, serieNfe };
    }
  } catch (err) {
    console.warn('Aviso ao consultar controle fiscal na tabela emitente:', err);
  }

  const local = getLocalCompanyData();
  return {
    ultimoNumeroNfe: Number(local.ultimo_numero_nfe ?? 0),
    serieNfe: Number(local.serie_nfe ?? 1)
  };
}

/**
 * Atualiza o último número de NF-e e a série na tabela 'emitente' de forma persistente e com fallbacks no Supabase
 */
export async function updateEmitenteNfeConfig(
  ultimoNumeroNfe: number, 
  serieNfe?: number
): Promise<{ success: boolean; data?: any; error?: any }> {
  const numeroValido = typeof ultimoNumeroNfe === 'number' && !isNaN(ultimoNumeroNfe) && ultimoNumeroNfe >= 0
    ? ultimoNumeroNfe
    : parseInt(String(ultimoNumeroNfe || 0), 10) || 0;

  const updatePayload: Record<string, any> = {
    ultimo_numero_nfe: numeroValido
  };
  if (serieNfe !== undefined) {
    const sVal = typeof serieNfe === 'number' && !isNaN(serieNfe) ? serieNfe : parseInt(String(serieNfe), 10) || 1;
    updatePayload.serie_nfe = sVal;
  }

  let supabaseSuccess = false;
  let lastError: any = null;

  // 1. Atualizar na tabela 'emitente'
  try {
    const { data: row, error: selectErr } = await db
      .from('emitente')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!selectErr && row?.id) {
      const { error: updErr } = await db
        .from('emitente')
        .update(updatePayload)
        .eq('id', row.id);

      if (!updErr) {
        supabaseSuccess = true;
      } else {
        lastError = updErr;
        console.warn('Aviso: UPDATE emitente por id falhou:', updErr.message);
      }
    } else {
      // Se não encontrou ID específico, tenta UPDATE na tabela emitente
      const { error: updAllErr } = await db
        .from('emitente')
        .update(updatePayload)
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (!updAllErr) {
        supabaseSuccess = true;
      } else {
        // Se a tabela emitente está vazia, insere o registro inicial completo
        const local = getLocalCompanyData();
        const insertPayload = {
          ...mapCompanyToSupabase({ ...local, ...updatePayload }),
          ...updatePayload
        };
        const { error: insErr } = await db
          .from('emitente')
          .insert([insertPayload]);

        if (!insErr) {
          supabaseSuccess = true;
        } else {
          lastError = insErr;
          console.warn('Aviso ao inserir na tabela emitente:', insErr.message);
        }
      }
    }
  } catch (err: any) {
    lastError = err;
    console.warn('Exceção ao atualizar emitente no Supabase:', err);
  }

  // 2. Tenta também na tabela alternativa 'empresa_emitente'
  try {
    const { data: empRow } = await db
      .from('empresa_emitente')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (empRow?.id) {
      const { error: empErr } = await db
        .from('empresa_emitente')
        .update(updatePayload)
        .eq('id', empRow.id);

      if (!empErr) supabaseSuccess = true;
    }
  } catch {}

  // 3. Tenta salvar na tabela 'configuracoes' como chave 'ultimo_numero_nfe' e 'empresa_emitente'
  try {
    await db
      .from('configuracoes')
      .upsert({ 
        chave: 'ultimo_numero_nfe', 
        valor: numeroValido,
        updated_at: new Date().toISOString() 
      }, { onConflict: 'chave' });

    const localAtual = getLocalCompanyData();
    await db
      .from('configuracoes')
      .upsert({ 
        chave: 'empresa_emitente', 
        valor: { ...localAtual, ultimo_numero_nfe: numeroValido },
        updated_at: new Date().toISOString() 
      }, { onConflict: 'chave' });
  } catch {}

  // 4. Atualiza LocalStorage e sincroniza aplicação
  const local = getLocalCompanyData();
  local.ultimo_numero_nfe = numeroValido;
  if (serieNfe !== undefined) {
    local.serie_nfe = updatePayload.serie_nfe;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(local));
  } catch {}

  window.dispatchEvent(new CustomEvent('company-data-updated', { detail: local }));
  return { success: true, data: local, error: lastError };
}

/**
 * Incrementa o último número de NF-e na tabela 'emitente' ao emitir/transmitir uma nota
 */
export async function incrementEmitenteUltimoNumeroNfe(currentUsedNumber?: number): Promise<number> {
  let next = 1;
  if (typeof currentUsedNumber === 'number' && !isNaN(currentUsedNumber) && currentUsedNumber > 0) {
    next = currentUsedNumber;
  } else {
    const config = await fetchEmitenteNfeConfig();
    next = config.ultimoNumeroNfe + 1;
  }

  await updateEmitenteNfeConfig(next);
  return next;
}


