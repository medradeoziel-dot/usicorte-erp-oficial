import { CompanyFiscalData } from '../types';
import { db } from '../lib/db';

export const DEFAULT_COMPANY_DATA: CompanyFiscalData = {
  id: 'empresa-default',
  // 1. Dados Fiscais
  personType: 'Jurídica',
  corporateName: 'L. M. BANZATTO METAIS',
  tradeName: 'USICORTE METAIS',
  cnpj: '25.038.430/0001-23',
  ie: '209632312114',
  im: '558747',
  cnae: '4744001',
  taxRegime: 'Simples Nacional',

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
  nextQuoteSequential: 20,
  quotePrefix: 'COT-2026-',
  proximo_numero_cotacao: 20,
  prefixo_cotacao: 'COT-2026-',

  // 6. Informações para Pagamento & Chave PIX (Dinâmico)
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
    nextQuoteSequential: typeof row.nextQuoteSequential === 'number' && !isNaN(row.nextQuoteSequential)
      ? row.nextQuoteSequential
      : (typeof row.proximo_numero_cotacao === 'number' && !isNaN(row.proximo_numero_cotacao)
        ? row.proximo_numero_cotacao
        : (parseInt(row.proximo_numero_cotacao || row.nextQuoteSequential, 10) || 20)),
    quotePrefix: row.quotePrefix || row.prefixo_cotacao || DEFAULT_COMPANY_DATA.quotePrefix,

    // 6. Dados Bancários & PIX
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
    proximo_numero_cotacao: typeof row.proximo_numero_cotacao === 'number' && !isNaN(row.proximo_numero_cotacao)
      ? row.proximo_numero_cotacao
      : (typeof row.nextQuoteSequential === 'number' && !isNaN(row.nextQuoteSequential)
        ? row.nextQuoteSequential
        : (parseInt(row.proximo_numero_cotacao || row.nextQuoteSequential, 10) || 20)),
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
  return {
    razao_social: data.corporateName || data.razao_social || '',
    nome_fantasia: data.tradeName || data.nome_fantasia || '',
    cnpj: data.cnpj || '',
    ie: data.ie || data.inscricao_estadual || '',
    telefone: data.phone || data.telefone || '',
    email: data.email || '',
    endereco: `${data.street || data.endereco || ''}${data.number ? `, ${data.number}` : ''}${data.neighborhood ? ` - ${data.neighborhood}` : ''}`,
    cidade: data.city || data.cidade || '',
    estado: (data.state || data.uf || 'SP').toUpperCase(),
    cep: data.cep || '',
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
    const { data, error } = await db
      .from('emitente')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
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
        updated_at: data.created_at || new Date().toISOString()
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

  // 2. Tenta persistir no Supabase (tabela emitente)
  try {
    const dbPayload = mapCompanyToSupabase(payload);
    
    // Verifica se já existe algum registro
    const { data: existing } = await db
      .from('emitente')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.id) {
      const { data: updated, error: updateError } = await db
        .from('emitente')
        .update(dbPayload)
        .eq('id', existing.id)
        .select()
        .single();

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
      const { data: inserted, error: insertError } = await db
        .from('emitente')
        .insert([dbPayload])
        .select()
        .single();

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
 * Obtém a configuração de numeração sequencial de cotações (próximo número e prefixo)
 */
export function getQuoteSequentialConfig(): { nextSequential: number; prefix: string } {
  const comp = getLocalCompanyData();
  const nextSequential = typeof comp.nextQuoteSequential === 'number' && !isNaN(comp.nextQuoteSequential)
    ? comp.nextQuoteSequential
    : (typeof comp.proximo_numero_cotacao === 'number' && !isNaN(comp.proximo_numero_cotacao)
      ? comp.proximo_numero_cotacao
      : 20);
  const prefix = comp.quotePrefix || comp.prefixo_cotacao || `COT-${new Date().getFullYear()}-`;
  return { nextSequential, prefix };
}

/**
 * Incrementa o número sequencial de cotação em +1 nas configurações e persiste no LocalStorage/Supabase
 */
export function incrementQuoteSequentialConfig(): number {
  const comp = getLocalCompanyData();
  const current = typeof comp.nextQuoteSequential === 'number' && !isNaN(comp.nextQuoteSequential)
    ? comp.nextQuoteSequential
    : (typeof comp.proximo_numero_cotacao === 'number' && !isNaN(comp.proximo_numero_cotacao)
      ? comp.proximo_numero_cotacao
      : 20);
  const next = current + 1;
  comp.nextQuoteSequential = next;
  comp.proximo_numero_cotacao = next;
  saveCompanyData(comp).catch(() => {});
  return next;
}

/**
 * Atualiza o número sequencial de cotação nas configurações
 */
export function setQuoteSequentialConfig(nextSequential: number, prefix?: string): void {
  const comp = getLocalCompanyData();
  comp.nextQuoteSequential = nextSequential;
  comp.proximo_numero_cotacao = nextSequential;
  if (prefix !== undefined) {
    comp.quotePrefix = prefix;
    comp.prefixo_cotacao = prefix;
  }
  saveCompanyData(comp).catch(() => {});
}

