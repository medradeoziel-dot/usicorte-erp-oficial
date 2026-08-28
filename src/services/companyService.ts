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
  documento_responsavel: '092.345.510/0001-94'
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

    // Aliases
    tipo_pessoa: row.tipo_pessoa || DEFAULT_COMPANY_DATA.personType,
    razao_social: row.razao_social || DEFAULT_COMPANY_DATA.corporateName,
    nome_fantasia: row.nome_fantasia || DEFAULT_COMPANY_DATA.tradeName,
    inscricao_estadual: row.inscricao_estadual || DEFAULT_COMPANY_DATA.ie,
    inscricao_municipal: row.inscricao_municipal || DEFAULT_COMPANY_DATA.im,
    regime_tributario: row.regime_tributario || DEFAULT_COMPANY_DATA.taxRegime,
    endereco: row.endereco || DEFAULT_COMPANY_DATA.street,
    numero: row.numero || DEFAULT_COMPANY_DATA.number,
    complemento: row.complemento || '',
    bairro: row.bairro || DEFAULT_COMPANY_DATA.neighborhood,
    cidade: row.cidade || DEFAULT_COMPANY_DATA.city,
    uf: (row.uf || DEFAULT_COMPANY_DATA.state).toUpperCase(),
    ibge_cidade: row.ibge_cidade || DEFAULT_COMPANY_DATA.ibgeCode,
    codigo_pais: row.codigo_pais || DEFAULT_COMPANY_DATA.countryCode,
    telefone: row.telefone || DEFAULT_COMPANY_DATA.phone,
    celular: row.celular || DEFAULT_COMPANY_DATA.mobile,
    logo_url: row.logo_url || '',
    nome_responsavel: row.nome_responsavel || DEFAULT_COMPANY_DATA.legalRepresentativeName,
    documento_responsavel: row.documento_responsavel || DEFAULT_COMPANY_DATA.legalRepresentativeDoc,
    updated_at: row.updated_at || new Date().toISOString()
  };
}

export function mapCompanyToSupabase(data: CompanyFiscalData): Record<string, any> {
  return {
    tipo_pessoa: data.personType || 'Jurídica',
    razao_social: data.corporateName || '',
    nome_fantasia: data.tradeName || '',
    cnpj: (data.cnpj || '').replace(/\D/g, ''),
    inscricao_estadual: data.ie || '',
    inscricao_municipal: data.im || '',
    cnae: (data.cnae || '').replace(/\D/g, ''),
    regime_tributario: data.taxRegime || 'Simples Nacional',
    cep: (data.cep || '').replace(/\D/g, ''),
    endereco: data.street || '',
    numero: data.number || '',
    complemento: data.complement || '',
    bairro: data.neighborhood || '',
    cidade: data.city || '',
    uf: (data.state || '').toUpperCase(),
    ibge_cidade: data.ibgeCode || '',
    codigo_pais: data.countryCode || '1058',
    email: data.email || '',
    website: data.website || '',
    telefone: data.phone || '',
    celular: data.mobile || '',
    logo_url: data.logoUrl || '',
    nome_responsavel: data.legalRepresentativeName || '',
    documento_responsavel: (data.legalRepresentativeDoc || '').replace(/\D/g, ''),
    updated_at: new Date().toISOString()
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
 * Busca dados da empresa do Supabase com fallback garantido para LocalStorage
 */
export async function fetchCompanyData(): Promise<CompanyFiscalData> {
  // 1. Tenta carregar do Supabase (tabela empresa_emitente ou configuracoes)
  try {
    const { data, error } = await db
      .from('empresa_emitente')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const mapped = mapSupabaseToCompany(data);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
      return mapped;
    }
  } catch (err) {
    // Tabela pode ainda não ter sido criada no Supabase
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
 * Salva os dados fiscais da empresa localmente e no Supabase
 */
export async function saveCompanyData(data: CompanyFiscalData): Promise<{ success: boolean; data: CompanyFiscalData; error?: any }> {
  // 1. Salva imediatamente no LocalStorage
  const payload = { ...data, updated_at: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  // Dispara evento global para que todos os componentes (cabeçalho, relatórios, etc.) atualizem imediatamente
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('company-data-updated', { detail: payload }));
  }

  // 2. Tenta persistir no Supabase (tabela empresa_emitente)
  try {
    const dbPayload = mapCompanyToSupabase(payload);
    
    // Verifica se já existe algum registro
    const { data: existing } = await db
      .from('empresa_emitente')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existing && existing.id) {
      const { data: updated, error: updateError } = await db
        .from('empresa_emitente')
        .update(dbPayload)
        .eq('id', existing.id)
        .select()
        .single();

      if (!updateError && updated) {
        const result = mapSupabaseToCompany(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
        return { success: true, data: result };
      }
    } else {
      const { data: inserted, error: insertError } = await db
        .from('empresa_emitente')
        .insert([dbPayload])
        .select()
        .single();

      if (!insertError && inserted) {
        const result = mapSupabaseToCompany(inserted);
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
