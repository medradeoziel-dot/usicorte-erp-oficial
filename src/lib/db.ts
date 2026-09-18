import { createClient } from "@supabase/supabase-js";
import { 
  Client, 
  Quote, 
  QuoteItem, 
  FechamentoMensal, 
  FechamentoMensalResumoJson, 
  FechamentoEmpresaResumo, 
  FechamentoCotacaoDetalhe 
} from "../types";
import { formatarMedidasLimpa } from "../utils/calculator";

// Fallbacks robustos para variáveis de ambiente do Supabase (evita travamento do preview)
const DEFAULT_SUPABASE_URL = "https://kyzeiroxvgbkincisrdf.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_2vCA1d0mEry_9Qy-QREVxA_aaR9IE6z";

const rawUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL 
  ? String(import.meta.env.VITE_SUPABASE_URL).trim() 
  : "");
const rawKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY 
  ? String(import.meta.env.VITE_SUPABASE_ANON_KEY).trim() 
  : "");

const SUPABASE_URL = (rawUrl && rawUrl.startsWith("http")) ? rawUrl : DEFAULT_SUPABASE_URL;
const SUPABASE_ANON_KEY = (rawKey && rawKey.length > 0) ? rawKey : DEFAULT_SUPABASE_ANON_KEY;

function initSupabaseClient() {
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch (err) {
    console.warn("Aviso: Falha ao inicializar cliente Supabase com credenciais fornecidas. Usando cliente fallback para evitar travamento do preview.", err);
    return createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }
}

export const db = initSupabaseClient();
export const supabase = db;

export type StatusCotacao = 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado';

/**
 * Identifica se um erro retornado pelo Supabase/PostgREST ou uma exceção de rede
 * corresponde a um erro 404 (tabela não encontrada no schema cache, relação inexistente ou status 404).
 */
export function isNotFoundError(error: any, status?: number): boolean {
  if (!error && status !== 404) return false;
  if (status === 404) return true;
  if (error?.status === 404 || error?.statusCode === 404) return true;
  if (
    error?.code === 'PGRST205' || 
    error?.code === 'PGRST116' || 
    error?.code === '42P01' || 
    error?.code === '42703' || 
    error?.code === 'PGRST204'
  ) return true;
  const msg = String(error?.message || error?.details || error || '').toLowerCase();
  return (
    msg.includes('404') ||
    msg.includes('not found') ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the column') ||
    msg.includes('schema cache') ||
    (msg.includes('relation') && msg.includes('does not exist')) ||
    (msg.includes('column') && msg.includes('does not exist'))
  );
}

/**
 * Executa uma busca segura em qualquer tabela do Supabase.
 * Se a busca retornar erro 404 (ou a tabela não existir no schema cache),
 * captura a exceção/erro e retorna um array vazio ([]) sem travar a tela ou gerar loops de erro no console.
 */
export async function safeFetchTable<T = any>(
  tableName: string,
  queryBuilder?: (query: any) => any
): Promise<T[]> {
  try {
    let q = db.from(tableName).select('*');
    if (queryBuilder) {
      q = queryBuilder(q);
    }
    const res = await q;

    if (res.error || res.status === 404 || isNotFoundError(res.error, res.status)) {
      return [];
    }

    return (res.data || []) as T[];
  } catch {
    return [];
  }
}

/**
 * Busca registros da tabela 'estoque' no Supabase de forma segura com ordenação por nome.
 * Retorna [] silenciosamente se a tabela retornar 404 ou estiver vazia.
 */
export async function fetchEstoqueDb(): Promise<any[]> {
  try {
    const { data, error, status } = await db
      .from('estoque')
      .select('*')
      .order('nome', { ascending: true });

    if (error || status === 404 || isNotFoundError(error, status)) {
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Busca registros da tabela 'estoque_movimentacoes' no Supabase de forma segura.
 * Retorna [] se a tabela retornar 404 ou estiver vazia.
 */
export async function fetchEstoqueMovimentacoesDb(): Promise<any[]> {
  try {
    const { data, error, status } = await db
      .from('estoque_movimentacoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || status === 404 || isNotFoundError(error, status)) {
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

/* ---- helper: só aceita UUID de verdade ---- */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v?: string | null): v is string => !!v && UUID_RE.test(v.trim());

/**
 * Resolve o UUID de uma cotação no Supabase caso seja passado o número de cotação
 */
export async function resolveCotacaoUuid(cotacaoIdOrNumero?: string): Promise<string | null> {
  if (!cotacaoIdOrNumero) return null;
  const clean = cotacaoIdOrNumero.trim();
  if (isUuid(clean)) return clean;
  try {
    const { data } = await db
      .from('cotacoes')
      .select('id')
      .eq('numero', clean)
      .limit(1)
      .maybeSingle();
    return data?.id || null;
  } catch {
    return null;
  }
}

export interface SupabaseCliente {
  id?: string;
  tipo?: 'CNPJ' | 'CPF' | string;
  documento?: string;
  nome: string;
  nome_fantasia?: string;
  situacao?: string;
  cep?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  contato?: string;
  telefone?: string;
  email?: string;
  "e-mail"?: string;
  habilitado?: boolean;
  data_cadastro?: string;
  empresa?: string;
  "observações"?: string;
  observacoes?: string;
  criado_por?: string;
  created_by?: string;
  criado_em?: string;
  created_at?: string;
  atualizado_em?: string;
  updated_at?: string;
}

export interface SupabaseCotacao {
  id?: string;
  numero: string;
  data: string;
  cliente_id?: string;
  cliente_nome: string;
  contato?: string;
  telefone?: string;
  email?: string;
  status: 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado' | 'reprovado' | 'cancelado' | 'em_analise' | 'faturado' | string;
  situacao?: string;
  observacoes?: string;
  valor_total: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  cotacao_itens?: SupabaseCotacaoItem[];
  // Pagamento & Faturamento:
  status_pagamento?: string;
  data_pagamento?: string | null;
  forma_pagamento?: string;
  valor_pago?: number;
  conta_destino?: string;
  observacoes_baixa?: string;
  lancamento_financeiro_id?: string;
  baixado_em?: string | null;
}

export interface SupabaseCotacaoItem {
  id?: string | number;
  cotacao_id?: string;
  ordem: number;
  produto?: string;
  material?: string;
  medida?: string;
  descricao?: string;
  observacao?: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  desenho_url?: string;
  cortado?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  nome: string;
  role: 'admin' | 'operador';
}

/* =========================================================================
   1. AUTENTICAÇÃO E PERFIS DA EQUIPE
   ========================================================================= */

export async function getCurrentAuthUser(): Promise<UserProfile | null> {
  try {
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) return null;

    let role: 'admin' | 'operador' = 'operador';
    try {
      const { data: roleData } = await db
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData?.role) {
        role = roleData.role as 'admin' | 'operador';
      }
    } catch (e) {
      console.warn("Não foi possível carregar user_roles:", e);
    }

    const nome = user.user_metadata?.nome || user.email?.split('@')[0] || 'Usuário';

    return {
      id: user.id,
      email: user.email || '',
      nome,
      role
    };
  } catch (err) {
    console.error("Erro ao obter usuário atual do Supabase:", err);
    return null;
  }
}

export async function signInSupabase(email: string, password: string) {
  const res = await db.auth.signInWithPassword({ email, password });
  return res;
}

export async function signUpSupabase(email: string, password: string, nome: string) {
  const res = await db.auth.signUp({
    email,
    password,
    options: {
      data: {
        nome
      }
    }
  });
  return res;
}

export async function signOutSupabase() {
  const res = await db.auth.signOut();
  return res;
}

export interface SupabaseUserRole {
  id?: string | number;
  user_id?: string;
  nome: string;
  email: string;
  cargo: string;
  role: 'admin' | 'operador';
  senha?: string;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_USUARIOS_EQUIPE: SupabaseUserRole[] = [
  { nome: 'ADMIN', senha: '1234', email: 'admin@usicorte.com.br', cargo: 'Administrador', role: 'admin' },
  { nome: 'MARCOS (VENDAS)', senha: '123', email: 'marcos@usicorte.com.br', cargo: 'Operador de Vendas', role: 'operador' },
  { nome: 'CARLOS (PRODUÇÃO)', senha: '123', email: 'carlos@usicorte.com.br', cargo: 'Operador de Produção', role: 'operador' }
];

export async function fetchUsuariosDb(): Promise<SupabaseUserRole[]> {
  try {
    // 1. Tenta buscar da tabela principal `usuarios`
    const { data, error, status } = await db
      .from('usuarios')
      .select('*')
      .order('nome', { ascending: true });

    if (!error && status !== 404 && data && data.length > 0) {
      return data.map((item: any) => {
        const isAdmin = (item.nome || '').toUpperCase() === 'ADMIN' || 
                        item.role === 'admin' || 
                        (item.cargo || '').toLowerCase().includes('admin');
        const cargo = item.cargo || item.perfil || (isAdmin ? 'Administrador' : 'Operador');
        const role = isAdmin ? 'admin' : 'operador';

        return {
          id: item.id ? String(item.id) : undefined,
          user_id: item.user_id ? String(item.user_id) : undefined,
          nome: item.nome || item.name || (item.email ? item.email.split('@')[0] : 'Usuário'),
          email: item.email || '',
          cargo: cargo,
          role: role,
          senha: item.senha || item.password || '123',
          created_at: item.created_at || item.criado_em,
          updated_at: item.updated_at || item.atualizado_em
        };
      });
    }

    // 2. Se a tabela 'usuarios' estiver vazia (sem erro), tenta semear os usuários padrões nela
    if (!error && status !== 404 && (!data || data.length === 0)) {
      try {
        await Promise.all(DEFAULT_USUARIOS_EQUIPE.map(u => 
          db.from('usuarios').upsert({
            nome: u.nome,
            email: u.email,
            senha: u.senha,
            cargo: u.cargo
          }, { onConflict: 'nome' })
        ));
      } catch {}
    }

    // 3. Fallback: Se usuarios deu erro, tenta consultar user_roles
    try {
      const { data: roleData, error: roleError, status: roleStatus } = await db
        .from('user_roles')
        .select('*');

      if (!roleError && roleStatus !== 404 && roleData && roleData.length > 0) {
        return roleData.map((item: any) => ({
          id: item.id ? String(item.id) : undefined,
          user_id: item.user_id ? String(item.user_id) : undefined,
          nome: item.nome || (item.email ? item.email.split('@')[0] : 'Usuário'),
          email: item.email || '',
          cargo: item.role === 'admin' ? 'Administrador' : 'Operador',
          role: (item.role === 'admin' ? 'admin' : 'operador') as 'admin' | 'operador',
          senha: item.senha || '123',
          created_at: item.created_at,
          updated_at: item.updated_at
        }));
      }
    } catch {}

    return DEFAULT_USUARIOS_EQUIPE;
  } catch {
    return DEFAULT_USUARIOS_EQUIPE;
  }
}

export async function saveUsuarioDb(usuario: {
  id?: string | number;
  nome: string;
  senha?: string;
  email?: string;
  cargo?: string;
  role?: 'admin' | 'operador';
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const nomeTrim = usuario.nome.trim();
    const emailToUse = usuario.email?.trim() || `${nomeTrim.toLowerCase().replace(/[^a-z0-9]/g, '')}@usicorte.com.br`;
    const isAdmin = nomeTrim.toUpperCase() === 'ADMIN' || usuario.role === 'admin' || (usuario.cargo || '').toLowerCase().includes('admin');
    const roleToUse: 'admin' | 'operador' = isAdmin ? 'admin' : 'operador';
    const cargoToUse = usuario.cargo || (isAdmin ? 'Administrador' : 'Operador');
    const senhaToUse = usuario.senha || '123';

    // 1. Tenta gravar na tabela principal `usuarios` com todos os campos (id, nome, email, senha, cargo)
    const payloadCompleto: any = {
      nome: nomeTrim,
      email: emailToUse,
      senha: senhaToUse,
      cargo: cargoToUse
    };

    if (usuario.id && (typeof usuario.id === 'number' || isUuid(String(usuario.id)) || /^\d+$/.test(String(usuario.id)))) {
      payloadCompleto.id = usuario.id;
    }

    // Tenta primeiro upsert na tabela `usuarios`
    let res = await db.from('usuarios').upsert([payloadCompleto], { onConflict: 'nome' }).select();
    
    // Se upsert falhar, tenta insert simples na tabela `usuarios`
    if (res.error) {
      res = await db.from('usuarios').insert([payloadCompleto]).select();
    }

    // Se ainda falhar por causa da coluna 'cargo', tenta variações de coluna (role / perfil)
    if (res.error) {
      console.warn("Tentando salvar em 'usuarios' com variações de colunas...", res.error.message);
      
      const payloadVariacao = {
        nome: nomeTrim,
        email: emailToUse,
        senha: senhaToUse,
        cargo: cargoToUse,
        role: roleToUse,
        perfil: cargoToUse
      };

      res = await db.from('usuarios').insert([payloadVariacao]).select();

      if (res.error) {
        // Tenta apenas nome, email, senha
        res = await db.from('usuarios').insert([{
          nome: nomeTrim,
          email: emailToUse,
          senha: senhaToUse
        }]).select();
      }
    }

    // 2. Se a tabela 'usuarios' não existir no banco, tenta salvar na 'user_roles' como contingência
    if (res.error) {
      console.warn("Aviso ao salvar em 'usuarios', tentando 'user_roles':", res.error.message);
      const resRole = await db.from('user_roles').upsert([{
        nome: nomeTrim,
        email: emailToUse,
        role: roleToUse,
        senha: senhaToUse
      }], { onConflict: 'email' }).select();

      if (!resRole.error) {
        return { success: true, data: resRole.data };
      }

      return { 
        success: false, 
        error: `Erro no Supabase: ${res.error.message}. Certifique-se de que a tabela "usuarios" (com colunas nome, email, senha, cargo) foi criada.` 
      };
    }

    return { success: true, data: res.data };
  } catch (err: any) {
    console.error("Erro inesperado ao salvar usuário no Supabase:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

export async function deleteUsuarioDb(identificador: {
  id?: string | number;
  email?: string;
  nome?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    let deletou = false;

    // 1. Deleta da tabela principal `usuarios`
    if (identificador.id) {
      const { error } = await db.from('usuarios').delete().eq('id', identificador.id);
      if (!error) deletou = true;
    }
    if (identificador.nome) {
      const { error } = await db.from('usuarios').delete().eq('nome', identificador.nome);
      if (!error) deletou = true;
    }
    if (identificador.email) {
      const { error } = await db.from('usuarios').delete().eq('email', identificador.email);
      if (!error) deletou = true;
    }

    // 2. Também tenta remover de user_roles caso exista
    try {
      if (identificador.email) await db.from('user_roles').delete().eq('email', identificador.email);
      if (identificador.nome) await db.from('user_roles').delete().eq('nome', identificador.nome);
    } catch (e) {}

    return { success: true };
  } catch (err: any) {
    console.error("Erro ao deletar usuário no Supabase:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

/* =========================================================================
   2. CLIENTES (TABELA: clientes)
   ========================================================================= */

export function mapSupabaseToClient(c: any): Client {
  const cleanDoc = (c.documento || c.document || '').replace(/\D/g, '');
  const isCnpj = cleanDoc.length > 11 || c.tipo === 'CNPJ' || c.type === 'CNPJ';
  const rawType = c.tipo || c.type;
  const clientType: 'CNPJ' | 'CPF' = (rawType === 'CPF' || rawType === 'CNPJ') ? rawType : (isCnpj ? 'CNPJ' : 'CPF');

  // Trata a data de cadastro para formato ISO YYYY-MM-DD
  let regDate = c.data_cadastro || c.registration_date || c.registrationDate;
  if (!regDate && (c.criado_em || c.created_at)) {
    try {
      const dt = new Date(c.criado_em || c.created_at);
      if (!isNaN(dt.getTime())) {
        regDate = dt.toISOString().split('T')[0];
      }
    } catch (e) {
      regDate = new Date().toISOString().split('T')[0];
    }
  }
  if (!regDate) {
    regDate = new Date().toISOString().split('T')[0];
  }

  return {
    id: c.id ? String(c.id) : String(Date.now()),
    type: clientType,
    document: c.documento || c.document || '',
    name: c.nome || c.name || c.razao_social || c.empresa || 'Cliente sem nome',
    fantasyName: c.nome_fantasia || c.fantasy_name || c.fantasyName || c.empresa || '',
    situation: c.situacao || c.situation || 'ATIVA',
    cep: c.cep || '',
    street: c.endereco || c.street || c.logradouro || '',
    neighborhood: c.bairro || c.neighborhood || '',
    city: c.cidade || c.city || c.municipio || '',
    state: (c.uf || c.state || c.estado || '').toUpperCase(),
    contactPerson: c.contato || c.contact_person || c.contactPerson || '',
    phone: c.telefone || c.phone || c.ddd_telefone_1 || '',
    email: c.email || c['e-mail'] || '',
    enabled: c.habilitado !== undefined ? Boolean(c.habilitado) : (c.enabled !== undefined ? Boolean(c.enabled) : true),
    registrationDate: regDate,
    // Aliases para máxima compatibilidade
    tipo: clientType,
    documento: c.documento || c.document || '',
    nome: c.nome || c.name || c.razao_social || c.empresa || 'Cliente sem nome',
    nome_fantasia: c.nome_fantasia || c.fantasy_name || c.fantasyName || c.empresa || '',
    situacao: c.situacao || c.situation || 'ATIVA',
    endereco: c.endereco || c.street || c.logradouro || '',
    bairro: c.bairro || c.neighborhood || '',
    cidade: c.cidade || c.city || c.municipio || '',
    uf: (c.uf || c.state || c.estado || '').toUpperCase(),
    contato: c.contato || c.contact_person || c.contactPerson || '',
    telefone: c.telefone || c.phone || c.ddd_telefone_1 || '',
    habilitado: c.habilitado !== undefined ? Boolean(c.habilitado) : (c.enabled !== undefined ? Boolean(c.enabled) : true),
    data_cadastro: regDate,
  };
}

export function mapClientToSupabase(c: any): Record<string, any> {
  const cleanDoc = (c.document || c.documento || '').replace(/\D/g, '');
  const cleanCep = (c.cep || '').replace(/\D/g, '');
  const cleanPhone = (c.phone || c.telefone || '').replace(/\D/g, '');
  const rawDate = c.registrationDate || c.data_cadastro || new Date().toISOString().split('T')[0];

  return {
    tipo: c.type || c.tipo || (cleanDoc.length > 11 ? 'CNPJ' : 'CPF'),
    documento: cleanDoc,
    nome: c.name || c.nome || c.razao_social || '',
    nome_fantasia: c.fantasyName || c.nome_fantasia || c.empresa || '',
    situacao: (c.situation || c.situacao || 'ATIVA').toUpperCase(),
    cep: cleanCep,
    endereco: c.street || c.endereco || c.logradouro || '',
    bairro: c.neighborhood || c.bairro || '',
    cidade: c.city || c.cidade || c.municipio || '',
    uf: (c.state || c.uf || '').toUpperCase(),
    contato: c.contactPerson || c.contato || '',
    telefone: cleanPhone,
    email: c.email || c['e-mail'] || '',
    habilitado: c.enabled !== undefined ? Boolean(c.enabled) : (c.habilitado !== undefined ? Boolean(c.habilitado) : true),
    data_cadastro: rawDate,
    empresa: c.fantasyName || c.nome_fantasia || c.empresa || c.name || c.nome || ''
  };
}

export async function fetchClientesDb(searchQuery?: string): Promise<Client[]> {
  try {
    const query = db
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });

    const { data, error, status } = await query;

    if (error || status === 404 || isNotFoundError(error, status)) {
      return [];
    }

    if (data && data.length > 0) {
      const mapped = data.map(mapSupabaseToClient);
      if (searchQuery && searchQuery.trim()) {
        const term = searchQuery.trim().toLowerCase();
        return mapped.filter(c => 
          c.name.toLowerCase().includes(term) ||
          (c.fantasyName && c.fantasyName.toLowerCase().includes(term)) ||
          c.document.includes(term) ||
          c.email.toLowerCase().includes(term) ||
          c.city.toLowerCase().includes(term) ||
          c.phone.includes(term) ||
          (c.contactPerson && c.contactPerson.toLowerCase().includes(term))
        );
      }
      return mapped;
    }
    return [];
  } catch {
    // Retorna array vazio silenciosamente sem exibir log vermelho no console
    return [];
  }
}

export async function fetchClienteById(id: string): Promise<Client | null> {
  try {
    if (!id) return null;
    const { data, error, status } = await db
      .from('clientes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || status === 404 || isNotFoundError(error, status)) {
      return null;
    }

    return data ? mapSupabaseToClient(data) : null;
  } catch {
    return null;
  }
}

export async function saveClienteDb(client: Client | any): Promise<{ data: Client | null; error: any }> {
  try {
    const payload = mapClientToSupabase(client);

    // 1. Caso seja UPDATE por UUID existente
    if (client.id && isUuid(client.id)) {
      const { data, error } = await db
        .from('clientes')
        .update(payload)
        .eq('id', client.id)
        .select()
        .single();

      if (!error && data) {
        return { data: mapSupabaseToClient(data), error: null };
      }

      // Fallback em caso de colunas extras ou divergência de schema
      if (error) {
        console.warn('UPDATE clientes com payload completo falhou, tentando payload simplificado:', error.message);
        const minimalPayload: Record<string, any> = {
          nome: payload.nome,
          empresa: payload.empresa || payload.nome_fantasia || payload.nome,
          contato: payload.contato,
          telefone: payload.telefone,
          email: payload.email,
          documento: payload.documento,
          endereco: payload.endereco
        };
        const { data: fbData, error: fbError } = await db
          .from('clientes')
          .update(minimalPayload)
          .eq('id', client.id)
          .select()
          .single();

        if (fbError) {
          console.error('UPDATE clientes falhou definitivamente:', fbError);
          return { data: null, error: fbError };
        }
        return { data: mapSupabaseToClient(fbData), error: null };
      }
    }

    // 2. Caso seja NOVO cliente, verifica se já existe registro com o mesmo documento para atualizar
    if (payload.documento && payload.documento.length >= 11) {
      const { data: existing } = await db
        .from('clientes')
        .select('id')
        .eq('documento', payload.documento)
        .maybeSingle();

      if (existing?.id) {
        const { data: updated, error: updateErr } = await db
          .from('clientes')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single();

        if (!updateErr && updated) {
          return { data: mapSupabaseToClient(updated), error: null };
        }
      }
    }

    // 3. Insere novo registro na tabela 'clientes' do Supabase
    const { data, error } = await db
      .from('clientes')
      .insert(payload)
      .select()
      .single();

    if (!error && data) {
      return { data: mapSupabaseToClient(data), error: null };
    }

    // Fallback de insert com colunas compatíveis
    if (error) {
      console.warn('INSERT clientes com payload completo retornou erro, tentando payload simplificado:', error.message);
      const minimalPayload: Record<string, any> = {
        nome: payload.nome,
        empresa: payload.empresa || payload.nome_fantasia || payload.nome,
        contato: payload.contato,
        telefone: payload.telefone,
        email: payload.email,
        documento: payload.documento,
        endereco: payload.endereco
      };
      const { data: fbData, error: fbError } = await db
        .from('clientes')
        .insert(minimalPayload)
        .select()
        .single();

      if (fbError) {
        console.error('INSERT clientes falhou definitivamente:', fbError);
        return { data: null, error: fbError };
      }
      return { data: mapSupabaseToClient(fbData), error: null };
    }

    return { data: mapSupabaseToClient(data), error: null };
  } catch (err) {
    console.error('Erro geral em saveClienteDb:', err);
    return { data: null, error: err };
  }
}

export async function deleteClienteDb(id: string): Promise<{ error: any }> {
  try {
    const { error } = await db
      .from('clientes')
      .delete()
      .eq('id', id);

    return { error };
  } catch (err) {
    return { error: err };
  }
}

/* =========================================================================
   3. COTAÇÕES E ITENS (TABELAS: cotacoes & cotacao_itens)
   ========================================================================= */

export function mapQuoteStatusToSupabase(status: string): 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado' | 'faturado' {
  const st = (status || '').toLowerCase();
  if (st.includes('faturad')) return 'faturado';
  if (st.includes('aprovado')) return 'aprovado';
  if (st.includes('rejeitado') || st.includes('cancelado')) return 'rejeitado';
  if (st.includes('pendente') || st.includes('enviado')) return 'pendente';
  return 'rascunho';
}

export function mapSupabaseStatusToQuote(status?: string, situacao?: string): 'Rascunho' | 'Enviado' | 'Aprovado' | 'Faturado' | 'Cancelado' {
  const sit = (situacao || '').toLowerCase().trim();
  if (sit === 'faturado' || sit === 'faturada' || sit === 'baixado' || sit === 'baixada') return 'Faturado';

  const st = (status || '').toLowerCase().trim();
  if (st === 'faturado' || st === 'faturada' || st === 'baixado' || st === 'baixada') return 'Faturado';
  if (st === 'aprovado') return 'Aprovado';
  if (st === 'rejeitado' || st === 'cancelado') return 'Cancelado';
  if (st === 'pendente' || st === 'enviado') return 'Enviado';
  return 'Rascunho';
}

export async function saveCotacaoDb(quote: Quote): Promise<{ data: any; error: any }> {
  try {
    const isFaturado = String(quote.status || '').toLowerCase().includes('faturad') || String((quote as any).situacao || '').toUpperCase() === 'FATURADO';
    const cotacaoPayload: any = {
      numero: quote.quoteNumber,
      data: quote.date || new Date().toISOString().split('T')[0],
      cliente_nome: quote.clientName || 'Cliente Balcão',
      contato: quote.contactPerson || '',
      telefone: quote.clientPhone || '',
      email: quote.clientEmail || '',
      status: mapQuoteStatusToSupabase(quote.status),
      situacao: isFaturado ? 'FATURADO' : ((quote as any).situacao || 'ATIVA'),
      observacoes: quote.observations || '',
      valor_total: quote.grandTotal || quote.subtotalTotal || 0,
      cliente_id: quote.clientId && isUuid(quote.clientId) ? quote.clientId : undefined
    };

    // 1. Busca se a cotação já existe no Supabase (pelo ID direto ou pelo Número)
    let existingRecords: { id: string; numero: string; created_at?: string }[] = [];

    // Prioridade 1: Buscar pelo ID direto apenas se for um UUID válido
    if (quote.id && isUuid(quote.id)) {
      const { data: byId } = await db
        .from('cotacoes')
        .select('id, numero, created_at')
        .eq('id', quote.id)
        .maybeSingle();

      if (byId) {
        existingRecords = [byId];
      }
    }

    // Prioridade 2: Se não encontrou por ID, busca pelo número de cotação
    if (existingRecords.length === 0 && quote.quoteNumber && quote.quoteNumber.trim()) {
      const { data: byNumero } = await db
        .from('cotacoes')
        .select('id, numero, created_at')
        .eq('numero', quote.quoteNumber.trim());

      if (byNumero && byNumero.length > 0) {
        existingRecords = byNumero;
      }
    }

    let cotacaoId: string | undefined = undefined;

    if (existingRecords.length > 0) {
      // É UPDATE de registro existente
      cotacaoId = existingRecords[0].id;

      // Se existiam duplicatas antigas com o mesmo número, remove os registros e itens extras
      if (existingRecords.length > 1) {
        const duplicateIds = existingRecords.slice(1).map(r => r.id);
        for (const extraId of duplicateIds) {
          try {
            await db.from('cotacao_itens').delete().eq('cotacao_id', extraId);
            await db.from('cotacoes').delete().eq('id', extraId);
          } catch (e) {
            console.warn("Aviso ao limpar cotação duplicada antiga:", e);
          }
        }
      }

      // Executa o UPDATE no registro existente pelo seu ID
      const { error: updateErr } = await db
        .from('cotacoes')
        .update({
          ...cotacaoPayload,
          updated_at: new Date().toISOString()
        })
        .eq('id', cotacaoId);

      if (updateErr) {
        console.error('UPDATE cotacoes falhou:', updateErr);
        return { data: null, error: updateErr };
      }

      // Limpa TODOS os itens antigos associados a essa cotação para garantir lista sincronizada
      const { error: delItensErr } = await db
        .from('cotacao_itens')
        .delete()
        .eq('cotacao_id', cotacaoId);

      if (delItensErr) {
        console.warn("Aviso ao limpar itens antigos da cotação:", delItensErr);
      }
    } else {
      // É INSERT de novo registro
      const { data: created, error: insertErr } = await db
        .from('cotacoes')
        .insert(cotacaoPayload)
        .select()
        .single();

      if (insertErr) {
        console.error('INSERT cotacoes falhou:', insertErr);
        return { data: null, error: insertErr };
      }
      cotacaoId = created.id;
    }

    // 2. Insere os itens atualizados da cotação
    if (cotacaoId && quote.items && quote.items.length > 0) {
      const itensPayload = quote.items.map((it, idx) => {
        const medidaCalculada = formatarMedidasLimpa(it);
        const medidaFinal = (medidaCalculada && medidaCalculada !== '-')
          ? medidaCalculada
          : (it.measure || (it.widthLength ? `${it.diameter || ''} x ${it.widthLength}` : it.diameter || '') || '');

        return {
          cotacao_id: cotacaoId,
          ordem: idx,
          produto: it.constantName || it.constanteNome || it.material || 'MATERIAL',
          material: it.material || it.constantName || '',
          medida: medidaFinal,
          descricao: it.description || it.descricao || 'Item industrial',
          observacao: it.notes || it.observacao || it.info || '',
          quantidade: it.quantity || it.qtd || 1,
          valor_unitario: it.unitPrice || it.valorUnitario || 0,
          valor_total: it.subtotal || ((it.unitPrice || 0) * (it.quantity || 1)),
          desenho_url: it.drawingImage || it.fotoDesenho || '',
          cortado: false
        };
      });

      const { error: itensErr } = await db.from('cotacao_itens').insert(itensPayload);
      if (itensErr) {
        console.warn("Erro ao inserir itens da cotação no Supabase:", itensErr);
      }
    }

    return { data: { id: cotacaoId, ...cotacaoPayload }, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

export async function fetchCotacoesDb(filtroCliente?: string, filtroStatus?: string): Promise<SupabaseCotacao[]> {
  try {
    let q = db
      .from('cotacoes')
      .select('*, cotacao_itens(*)')
      .order('data', { ascending: false });

    if (filtroCliente && filtroCliente.trim()) {
      q = q.ilike('cliente_nome', `%${filtroCliente.trim()}%`);
    }

    if (filtroStatus && filtroStatus !== 'todas' && filtroStatus !== 'todos') {
      q = q.eq('status', filtroStatus);
    }

    const { data, error, status } = await q;
    if (error) {
      if (!isNotFoundError(error, status)) {
        console.warn("Erro ao carregar cotações do Supabase:", error.message);
      }
      return [];
    }

    if (data && Array.isArray(data)) {
      // Deleta do Supabase se existirem registros legados
      const invalid = data.filter((c: any) => {
        const num = String(c.numero || c.id || '');
        return num.includes('021935') || num.includes('21935');
      });
      if (invalid.length > 0) {
        invalid.forEach(async (inv: any) => {
          if (inv.id) {
            await db.from('cotacao_itens').delete().eq('cotacao_id', inv.id);
            await db.from('cotacoes').delete().eq('id', inv.id);
          }
        });
      }

      return (data as SupabaseCotacao[]).filter((c: any) => {
        const num = String(c.numero || c.id || '');
        return !num.includes('021935') && !num.includes('21935');
      });
    }

    return (data as SupabaseCotacao[]) || [];
  } catch (err) {
    console.error("Erro na busca de cotações:", err);
    return [];
  }
}

export async function updateCotacaoStatusDb(
  cotacaoIdOrObj: string | { id?: string; numero?: string },
  status: 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado' | 'reprovado' | 'cancelado' | 'em_analise' | string
) {
  const targetId = typeof cotacaoIdOrObj === 'string' ? cotacaoIdOrObj : cotacaoIdOrObj.id;
  const targetNumero = typeof cotacaoIdOrObj === 'object' ? cotacaoIdOrObj.numero : undefined;
  const statusStr = (status || '').toLowerCase().trim();
  const situacaoStr = statusStr === 'faturado' ? 'FATURADO' : 
                      statusStr === 'aprovado' ? 'APROVADO' : 
                      statusStr === 'pendente' ? 'PENDENTE' : 
                      statusStr === 'rascunho' ? 'RASCUNHO' : statusStr.toUpperCase();

  const payload: any = { 
    status: statusStr, 
    situacao: situacaoStr,
    updated_at: new Date().toISOString() 
  };

  let updateQuery;
  if (targetId && isUuid(targetId)) {
    updateQuery = db.from('cotacoes').update(payload).eq('id', targetId);
  } else if (targetId) {
    updateQuery = db.from('cotacoes').update(payload).or(`id.eq.${targetId},numero.eq.${targetId}`);
  } else if (targetNumero) {
    updateQuery = db.from('cotacoes').update(payload).eq('numero', targetNumero);
  } else {
    return { data: null, error: new Error('Sem identificador para atualizar cotação') };
  }

  let { data, error } = await updateQuery;

  // Se a coluna situacao não existir na tabela, tenta atualizar apenas status
  if (error && (error.message?.toLowerCase().includes('situacao') || error.code === '42703')) {
    const payloadNoSituacao = { status: statusStr, updated_at: new Date().toISOString() };
    if (targetId && isUuid(targetId)) {
      updateQuery = db.from('cotacoes').update(payloadNoSituacao).eq('id', targetId);
    } else if (targetId) {
      updateQuery = db.from('cotacoes').update(payloadNoSituacao).or(`id.eq.${targetId},numero.eq.${targetId}`);
    } else if (targetNumero) {
      updateQuery = db.from('cotacoes').update(payloadNoSituacao).eq('numero', targetNumero);
    }
    const res = await updateQuery;
    data = res.data;
    error = res.error;
  }

  // Se houver restrição no banco de dados (ex: constraint de enum aceitando apenas rascunho/pendente/aprovado/rejeitado)
  if (error && (error.message?.includes('check') || error.message?.includes('invalid input') || error.code === '23514')) {
    const fallback = mapQuoteStatusToSupabase(statusStr);
    const fallbackPayload: any = { status: fallback, situacao: situacaoStr, updated_at: new Date().toISOString() };
    if (targetId && isUuid(targetId)) {
      const retry = await db.from('cotacoes').update(fallbackPayload).eq('id', targetId);
      error = retry.error;
    } else if (targetId) {
      const retry = await db.from('cotacoes').update(fallbackPayload).or(`id.eq.${targetId},numero.eq.${targetId}`);
      error = retry.error;
    } else if (targetNumero) {
      const retry = await db.from('cotacoes').update(fallbackPayload).eq('numero', targetNumero);
      error = retry.error;
    }
    if (error && (error.message?.toLowerCase().includes('situacao') || error.code === '42703')) {
      const finalFallback = { status: fallback, updated_at: new Date().toISOString() };
      if (targetId && isUuid(targetId)) {
        await db.from('cotacoes').update(finalFallback).eq('id', targetId);
      } else if (targetNumero) {
        await db.from('cotacoes').update(finalFallback).eq('numero', targetNumero);
      }
    }
  }

  // Se a tabela cotacao_itens tiver o campo status ou updated_at, sincroniza os itens pertencentes a essa cotação
  if (targetId) {
    try {
      await db.from('cotacao_itens').update({ updated_at: new Date().toISOString() }).eq('cotacao_id', targetId);
    } catch (_) {
      // silencioso se cotacao_itens não tiver os campos
    }
  }

  return { data, error };
}

/**
 * Atualiza explicitamente a situação da cotação (ex: 'FATURADO') na tabela cotacoes do Supabase
 */
export async function atualizarSituacaoCotacaoDb(
  cotacaoIdOrObj: string | { id?: string; numero?: string },
  situacao: string = 'FATURADO'
) {
  const targetId = typeof cotacaoIdOrObj === 'string' ? cotacaoIdOrObj : cotacaoIdOrObj.id;
  const targetNumero = typeof cotacaoIdOrObj === 'object' ? cotacaoIdOrObj.numero : undefined;

  const situacaoUpper = (situacao || 'FATURADO').toUpperCase().trim();
  const isFaturado = situacaoUpper === 'FATURADO';

  return await atualizarStatusPagamentoCotacaoDb(
    { id: targetId, numero: targetNumero },
    {
      status_pagamento: isFaturado ? 'PAGO' : 'Pendente',
      situacao: situacaoUpper,
      data_pagamento: isFaturado ? new Date().toISOString().split('T')[0] : null
    }
  );
}

/**
 * 1. Atualização direta na Tabela 'cotacoes':
 * Ao clicar em 'Dar Baixa nas Selecionadas', faz o UPDATE direto na tabela 'cotacoes' alterando as colunas:
 * - status_pagamento = 'PAGO'
 * - situacao = 'FATURADO'
 * - data_pagamento = [Data Atual]
 * Também atualiza forma_pagamento, valor_pago, conta_destino, observacoes_baixa e baixado_em.
 */
export async function atualizarStatusPagamentoCotacaoDb(
  cotacaoIdOrObj: string | { id?: string; numero?: string },
  dados?: {
    status_pagamento?: string; // 'PAGO' | 'Pendente'
    situacao?: string; // 'FATURADO' | 'APROVADO'
    data_pagamento?: string | null; // YYYY-MM-DD
    forma_pagamento?: string;
    valor_pago?: number;
    conta_destino?: string;
    observacoes_baixa?: string;
    lancamento_financeiro_id?: string;
  }
) {
  let targetId = typeof cotacaoIdOrObj === 'string' ? cotacaoIdOrObj : cotacaoIdOrObj?.id;
  const targetNumero = typeof cotacaoIdOrObj === 'object' ? cotacaoIdOrObj?.numero : undefined;

  // Resolve UUID se targetId não for UUID válido
  if (targetId && !isUuid(targetId)) {
    const resolved = await resolveCotacaoUuid(targetId);
    if (resolved) targetId = resolved;
  } else if (!targetId && targetNumero) {
    const resolved = await resolveCotacaoUuid(targetNumero);
    if (resolved) targetId = resolved;
  }

  const statusPagamento = dados?.status_pagamento || 'PAGO';
  const situacao = dados?.situacao || (statusPagamento === 'PAGO' ? 'FATURADO' : 'APROVADO');
  const dataHoje = dados?.data_pagamento !== undefined 
    ? dados.data_pagamento 
    : (statusPagamento === 'PAGO' ? new Date().toISOString().split('T')[0] : null);

  const payloadCompleto: any = {
    status_pagamento: statusPagamento,
    situacao: situacao,
    data_pagamento: dataHoje,
    updated_at: new Date().toISOString()
  };

  if (dados?.forma_pagamento) payloadCompleto.forma_pagamento = dados.forma_pagamento;
  if (dados?.valor_pago !== undefined) payloadCompleto.valor_pago = dados.valor_pago;
  if (dados?.conta_destino) payloadCompleto.conta_destino = dados.conta_destino;
  if (dados?.observacoes_baixa !== undefined) payloadCompleto.observacoes_baixa = dados.observacoes_baixa;
  if (dados?.lancamento_financeiro_id) payloadCompleto.lancamento_financeiro_id = dados.lancamento_financeiro_id;
  if (statusPagamento === 'PAGO') {
    payloadCompleto.baixado_em = new Date().toISOString();
  } else {
    payloadCompleto.baixado_em = null;
  }

  let updateQuery;
  if (targetId && isUuid(targetId)) {
    updateQuery = db.from('cotacoes').update(payloadCompleto).eq('id', targetId);
  } else if (targetNumero) {
    updateQuery = db.from('cotacoes').update(payloadCompleto).eq('numero', targetNumero);
  } else {
    return { data: null, error: new Error('Sem identificador válido para a cotação') };
  }

  let { data, error } = await updateQuery;

  // Se a coluna 'situacao' não existir na tabela cotacoes (PGRST204 ou 42703), tenta sem ela
  if (error && (error.message?.toLowerCase().includes('situacao') || error.code === '42703' || error.code === 'PGRST204')) {
    const { situacao: _, ...payloadSemSituacao } = payloadCompleto;
    if (targetId && isUuid(targetId)) {
      updateQuery = db.from('cotacoes').update(payloadSemSituacao).eq('id', targetId);
    } else if (targetNumero) {
      updateQuery = db.from('cotacoes').update(payloadSemSituacao).eq('numero', targetNumero);
    }
    const res = await updateQuery;
    data = res.data;
    error = res.error;
  }

  // Sincroniza também no cache local 's_orcamentos' se presente
  try {
    const localStr = localStorage.getItem('s_orcamentos');
    if (localStr) {
      const orcs = JSON.parse(localStr);
      let alterou = false;
      const updated = orcs.map((o: any) => {
        const match = (targetId && (o.id === targetId || o.quoteNumber === targetId)) ||
                      (targetNumero && o.quoteNumber === targetNumero);
        if (match) {
          alterou = true;
          return {
            ...o,
            paymentStatus: statusPagamento === 'PAGO' ? 'Pago' : 'Pendente',
            paymentDate: dataHoje || undefined,
            paymentMethod: dados?.forma_pagamento || o.paymentMethod,
            status: statusPagamento === 'PAGO' ? 'Faturado' : (o.status === 'Faturado' ? 'Aprovado' : o.status)
          };
        }
        return o;
      });
      if (alterou) {
        localStorage.setItem('s_orcamentos', JSON.stringify(updated));
      }
    }
  } catch {
    // Silencioso em caso de localStorage indisponível
  }

  return { data, error };
}

/**
 * 2. Evitar Duplicidades em 'contas_a_receber':
 * Antes de inserir um pagamento em 'contas_a_receber', verifica se já existe
 * um registro para aquele 'cotacao_id'.
 * Se já existir, faz um UPDATE no registro existente em vez de criar um novo INSERT.
 */
export async function sincronizarPagamentoContaReceberDb(params: {
  cotacaoId?: string;
  cotacaoNumero?: string;
  clienteNome?: string;
  valor: number;
  dataPagamento?: string | null;
  status?: string; // 'Baixado' | 'Pendente'
}) {
  try {
    let cotacaoUuid: string | null = null;
    if (params.cotacaoId && isUuid(params.cotacaoId)) {
      cotacaoUuid = params.cotacaoId;
    } else {
      cotacaoUuid = await resolveCotacaoUuid(params.cotacaoId || params.cotacaoNumero);
    }

    const dataHoje = params.dataPagamento || new Date().toISOString().split('T')[0];
    const statusFinal = params.status || 'Baixado';

    // 1. Verifica se já existe um registro para aquele 'cotacao_id'
    let existingId: string | null = null;
    if (cotacaoUuid && isUuid(cotacaoUuid)) {
      const { data: found } = await db
        .from('contas_a_receber')
        .select('id, cotacao_id, numero_parcela, status')
        .eq('cotacao_id', cotacaoUuid)
        .limit(1)
        .maybeSingle();

      if (found?.id) {
        existingId = found.id;
      }
    }

    // 2. Se já existir, faz um UPDATE no registro existente em vez de criar um novo INSERT
    if (existingId) {
      const { data, error } = await db
        .from('contas_a_receber')
        .update({
          status: statusFinal,
          data_pagamento: statusFinal === 'Baixado' ? dataHoje : null,
          cliente_nome: params.clienteNome || undefined,
          valor_parcela: Number(params.valor) || undefined
        })
        .eq('id', existingId);

      return { data, error, operacao: 'UPDATE' as const };
    }

    // 3. Se NÃO existir, faz o INSERT do pagamento
    const { data, error } = await db
      .from('contas_a_receber')
      .insert([{
        cotacao_id: cotacaoUuid && isUuid(cotacaoUuid) ? cotacaoUuid : null,
        cliente_nome: params.clienteNome || 'Cliente Balcão',
        numero_parcela: 1,
        total_parcelas: 1,
        valor_parcela: Number(params.valor) || 0,
        data_vencimento: dataHoje,
        status: statusFinal,
        data_pagamento: statusFinal === 'Baixado' ? dataHoje : null
      }]);

    return { data, error, operacao: 'INSERT' as const };
  } catch (err) {
    console.warn('Erro ao sincronizar contas_a_receber sem duplicidade:', err);
    return { data: null, error: err, operacao: 'ERRO' as const };
  }
}

export async function updateItemCortadoDb(itemId: string | number, cortado: boolean) {
  return await db
    .from('cotacao_itens')
    .update({ cortado, updated_at: new Date().toISOString() })
    .eq('id', itemId);
}

export async function deleteCotacaoItemDb(itemId: string | number): Promise<{ error: any }> {
  try {
    const { error } = await db
      .from('cotacao_itens')
      .delete()
      .eq('id', itemId);
    return { error };
  } catch (err) {
    console.error("Erro ao deletar item de cotação:", err);
    return { error: err };
  }
}

export async function deleteCotacaoDb(idOrNumero: string): Promise<{ error: any }> {
  try {
    if (!idOrNumero) return { error: new Error('ID ou Número da cotação não informado') };

    // 1. Localiza a cotação se for pelo número
    let cotacaoId = idOrNumero;
    if (!isUuid(idOrNumero)) {
      const { data: found } = await db
        .from('cotacoes')
        .select('id')
        .eq('numero', idOrNumero)
        .maybeSingle();
      if (found?.id) {
        cotacaoId = found.id;
      }
    }

    // 2. Deleta itens filhos da cotação e parcelas de contas a receber vinculadas
    if (cotacaoId) {
      try {
        await db
          .from('contas_a_receber')
          .delete()
          .eq('cotacao_id', cotacaoId);
      } catch (e) {
        console.warn("Aviso ao limpar contas_a_receber vinculadas à cotação:", e);
      }

      await db
        .from('cotacao_itens')
        .delete()
        .eq('cotacao_id', cotacaoId);
    }

    // 3. Deleta a cotação (por id e por número)
    const { error: errId } = await db
      .from('cotacoes')
      .delete()
      .eq('id', cotacaoId);

    if (errId && !isUuid(idOrNumero)) {
      const { error: errNum } = await db
        .from('cotacoes')
        .delete()
        .eq('numero', idOrNumero);
      return { error: errNum || errId };
    }

    return { error: errId };
  } catch (err) {
    console.error("Erro ao excluir cotação:", err);
    return { error: err };
  }
}

export async function deleteMultipleCotacoesDb(idsOrNumeros: string[]): Promise<{ error: any }> {
  try {
    if (!idsOrNumeros || idsOrNumeros.length === 0) return { error: null };

    for (const item of idsOrNumeros) {
      await deleteCotacaoDb(item);
    }

    return { error: null };
  } catch (err) {
    console.error("Erro ao excluir múltiplas cotações:", err);
    return { error: err };
  }
}

/* =========================================================================
   4. BUCKET DE IMAGENS / DESENHOS TÉCNICOS (BUCKET: desenhos)
   ========================================================================= */

export async function uploadDesenhoStorage(
  cotacaoNumeroOuId: string,
  arquivo: File,
  itemId?: string | number
): Promise<{ path: string | null; signedUrl: string | null; error: any }> {
  try {
    const cleanFileName = arquivo.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${cotacaoNumeroOuId}/${Date.now()}_${cleanFileName}`;

    const { error: uploadError } = await db.storage
      .from('desenhos')
      .upload(path, arquivo, { upsert: true });

    if (uploadError) {
      console.warn("Aviso upload bucket desenhos:", uploadError.message);
      return { path: null, signedUrl: null, error: uploadError };
    }

    // Gera URL assinada de 1 hora (ou publica caso liberada)
    const { data: signedData, error: signError } = await db.storage
      .from('desenhos')
      .createSignedUrl(path, 3600);

    const signedUrl = signedData?.signedUrl || null;

    if (itemId) {
      await db.from('cotacao_itens').update({ desenho_url: signedUrl || path }).eq('id', itemId);
    }

    return { path, signedUrl, error: signError };
  } catch (err) {
    return { path: null, signedUrl: null, error: err };
  }
}

export type Cotacao = SupabaseCotacao;

export function brl(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "R$ 0,00";
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function fetchCotacaoById(idOrNumero: string): Promise<SupabaseCotacao | null> {
  try {
    if (!idOrNumero) return null;

    // 1. Busca nativa pelo campo 'id' se for um UUID válido
    if (isUuid(idOrNumero)) {
      const { data: dataById, error: errorById } = await db
        .from('cotacoes')
        .select('*, cotacao_itens(*)')
        .eq('id', idOrNumero)
        .maybeSingle();

      if (dataById && !errorById) {
        return dataById as SupabaseCotacao;
      }
    }

    // 2. Fallback de busca nativa pelo campo 'numero' (ex: COT-2026-0001)
    const { data: dataByNumero, error: errorByNumero } = await db
      .from('cotacoes')
      .select('*, cotacao_itens(*)')
      .eq('numero', idOrNumero)
      .maybeSingle();

    if (errorByNumero) {
      console.warn("Aviso ao buscar cotação por número:", errorByNumero.message);
    }

    return (dataByNumero as SupabaseCotacao) || null;
  } catch (err) {
    console.error("Erro ao buscar cotação por ID/número:", err);
    return null;
  }
}

export async function fetchItensByCotacaoId(cotacaoId: string): Promise<SupabaseCotacaoItem[]> {
  try {
    if (!cotacaoId) return [];
    const { data, error, status } = await db
      .from('cotacao_itens')
      .select('*')
      .eq('cotacao_id', cotacaoId)
      .order('ordem', { ascending: true });

    if (error) {
      if (!isNotFoundError(error, status)) {
        console.warn("Erro ao buscar itens da cotação:", error.message);
      }
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Erro na busca de itens por cotação ID:", err);
    return [];
  }
}

export async function getDesenhoUrl(pathOrUrl: string): Promise<string> {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http') || pathOrUrl.startsWith('data:image')) {
    return pathOrUrl;
  }
  try {
    const { data } = await db.storage.from('desenhos').createSignedUrl(pathOrUrl, 3600);
    return data?.signedUrl || '';
  } catch (e) {
    return '';
  }
}

/* =========================================================================
   6. FECHAMENTO MENSAL NO SUPABASE (TABELA: fechamentos_mensais)
   ========================================================================= */

const NOMES_MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Retorna o mês anterior no formato YYYY-MM (ex: se hoje é setembro/2026, retorna '2026-08')
 */
export function getMesAnterior(refDate: Date = new Date()): string {
  const d = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  return `${ano}-${mes}`;
}

/**
 * Formata 'YYYY-MM' para 'Mês por Extenso de YYYY' (ex: '2026-08' -> 'Agosto de 2026')
 */
export function formatarMesAnoLabel(mesAno: string): string {
  if (!mesAno || !mesAno.includes('-')) return mesAno || '';
  const parts = mesAno.split('-');
  const ano = parts[0];
  const mesIdx = parseInt(parts[1], 10) - 1;
  if (mesIdx >= 0 && mesIdx < 12) {
    return `${NOMES_MESES_PT[mesIdx]} de ${ano}`;
  }
  return mesAno;
}

/**
 * Extrai o ano e mês (YYYY-MM) de uma string de data flexível
 */
export function extrairAnoMes(dataStr?: string | null): string | null {
  if (!dataStr) return null;
  const limpo = dataStr.trim();
  
  // Formato ISO: YYYY-MM-DD
  const matchIso = limpo.match(/^(\d{4})-(\d{2})/);
  if (matchIso) {
    return `${matchIso[1]}-${matchIso[2]}`;
  }

  // Formato BR: DD/MM/YYYY
  const matchBr = limpo.match(/^(\d{1,2})\/(\d{2})\/(\d{4})/);
  if (matchBr) {
    return `${matchBr[3]}-${matchBr[2]}`;
  }

  // Tenta parse via new Date
  try {
    const dt = new Date(limpo);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
  } catch {}

  return null;
}

/**
 * 2. Consolidação e Busca no Supabase:
 * Busca na tabela 'cotacoes' os registros do mês especificado com 'situacao' = 'APROVADO'.
 * Calcula o total por empresa, a lista de cotações e o Total Geral.
 */
export async function buscarCotacoesParaFechamento(mesAno: string): Promise<{
  mesAno: string;
  mesAnoFormatado: string;
  totalGeral: number;
  totalEmpresas: number;
  totalCotacoes: number;
  ticketMedio: number;
  empresas: FechamentoEmpresaResumo[];
  todasCotacoes: FechamentoCotacaoDetalhe[];
}> {
  const mesAnoAlvo = mesAno.trim();
  const mesAnoFormatado = formatarMesAnoLabel(mesAnoAlvo);

  let cotacoesCandidatas: any[] = [];

  // 1. Busca direto do Supabase
  try {
    const { data, error } = await db
      .from('cotacoes')
      .select('*, cotacao_itens(*)')
      .order('data', { ascending: false });

    if (!error && data && data.length > 0) {
      cotacoesCandidatas = data;
    }
  } catch (err) {
    console.warn("Aviso ao buscar cotações no Supabase para fechamento:", err);
  }

  // 2. Fallback de contingência local se Supabase retornar vazio
  if (cotacoesCandidatas.length === 0) {
    try {
      const localStr = localStorage.getItem('s_orcamentos');
      if (localStr) {
        cotacoesCandidatas = JSON.parse(localStr);
      }
    } catch (e) {
      console.warn("Erro ao ler fallback s_orcamentos:", e);
    }
  }

  // 3. Filtra apenas do mês alvo com 'situacao' = 'APROVADO' (ou status = 'aprovado')
  const cotacoesFiltradas: FechamentoCotacaoDetalhe[] = [];

  cotacoesCandidatas.forEach((c: any) => {
    // Validação de mês/ano
    const mesCotacao = extrairAnoMes(c.data) || extrairAnoMes(c.date) || extrairAnoMes(c.created_at) || extrairAnoMes(c.createdAt);
    if (mesCotacao !== mesAnoAlvo) {
      return;
    }

    // Validação estrita da situação = 'APROVADO' (aceita variações de caixa ou faturado)
    const situacaoUpper = String(c.situacao || '').toUpperCase().trim();
    const statusLower = String(c.status || '').toLowerCase().trim();

    const isAprovado = 
      situacaoUpper === 'APROVADO' || 
      statusLower === 'aprovado' || 
      situacaoUpper === 'FATURADO' || 
      statusLower === 'faturado';

    if (!isAprovado) {
      return;
    }

    const valorTotal = Number(c.valor_total || c.grandTotal || c.subtotalTotal || 0);
    const clienteNome = (c.cliente_nome || c.clientName || c.empresa || 'Cliente Balcão').trim();
    const numero = c.numero || c.quoteNumber || String(c.id || 'S/N');
    const id = String(c.id || numero);
    const data = c.data || c.date || new Date().toISOString().split('T')[0];

    cotacoesFiltradas.push({
      id,
      numero,
      data,
      cliente_nome: clienteNome,
      valor_total: valorTotal,
      contato: c.contato || c.contactPerson || '',
      telefone: c.telefone || c.clientPhone || '',
      email: c.email || c.clientEmail || '',
      observacoes: c.observacoes || c.observations || '',
      situacao: situacaoUpper || 'APROVADO',
      status: statusLower || 'aprovado',
      forma_pagamento: c.forma_pagamento || c.paymentMethod || '',
      data_pagamento: c.data_pagamento || c.paymentDate || null
    });
  });

  // 4. Agrupa e calcula o total por empresa
  const mapaEmpresas = new Map<string, {
    empresa: string;
    total: number;
    cotacoes: FechamentoCotacaoDetalhe[];
  }>();

  cotacoesFiltradas.forEach(cot => {
    const chave = cot.cliente_nome.toUpperCase();
    const atual = mapaEmpresas.get(chave) || {
      empresa: cot.cliente_nome,
      total: 0,
      cotacoes: []
    };

    atual.total = Number((atual.total + cot.valor_total).toFixed(2));
    atual.cotacoes.push(cot);
    mapaEmpresas.set(chave, atual);
  });

  // 5. Total Geral
  const totalGeral = Number(
    Array.from(mapaEmpresas.values()).reduce((acc, emp) => acc + emp.total, 0).toFixed(2)
  );
  const totalEmpresas = mapaEmpresas.size;
  const totalCotacoes = cotacoesFiltradas.length;
  const ticketMedio = totalCotacoes > 0 ? Number((totalGeral / totalCotacoes).toFixed(2)) : 0;

  // 6. Ordena empresas por faturamento decrescente
  const empresas: FechamentoEmpresaResumo[] = Array.from(mapaEmpresas.values())
    .map(emp => ({
      empresa: emp.empresa,
      total: emp.total,
      quantidadeCotacoes: emp.cotacoes.length,
      percentualDoTotal: totalGeral > 0 ? Number(((emp.total / totalGeral) * 100).toFixed(1)) : 0,
      cotacoes: emp.cotacoes.sort((a, b) => b.valor_total - a.valor_total)
    }))
    .sort((a, b) => b.total - a.total);

  return {
    mesAno: mesAnoAlvo,
    mesAnoFormatado,
    totalGeral,
    totalEmpresas,
    totalCotacoes,
    ticketMedio,
    empresas,
    todasCotacoes: cotacoesFiltradas
  };
}

/**
 * 2. Gravação no Supabase:
 * Faz um UPSERT na tabela 'fechamentos_mensais' salvando:
 * - mes_ano (ex: '2026-08')
 * - total_geral
 * - total_empresas
 * - resumo_json (detalhes de cada empresa e suas cotações)
 */
export async function salvarFechamentoMensalDb(payload: {
  mes_ano: string;
  total_geral: number;
  total_empresas: number;
  resumo_json: FechamentoMensalResumoJson;
  fechado_por?: string;
}): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  isFallbackLocal?: boolean;
}> {
  try {
    const dadosParaUpsert: any = {
      mes_ano: payload.mes_ano,
      total_geral: payload.total_geral,
      total_empresas: payload.total_empresas,
      total_cotacoes: payload.resumo_json?.geral?.total_cotacoes || 0,
      fechado_por: payload.fechado_por || 'ADMIN',
      resumo_json: payload.resumo_json,
      fechado_em: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 1. Tenta UPSERT no Supabase
    let supabaseSucesso = false;
    let supabaseErro: string | undefined = undefined;

    try {
      const { data, error } = await db
        .from('fechamentos_mensais')
        .upsert(dadosParaUpsert, { onConflict: 'mes_ano' })
        .select()
        .single();

      if (!error) {
        supabaseSucesso = true;
      } else {
        supabaseErro = error.message;
        console.warn("Aviso no UPSERT fechamentos_mensais (Supabase):", error.message);
      }
    } catch (e: any) {
      supabaseErro = e?.message || String(e);
      console.warn("Exceção ao conectar na tabela fechamentos_mensais:", e);
    }

    // 2. Sempre persiste também no LocalStorage como espelho seguro
    try {
      const storageKey = 's_fechamentos_mensais';
      const locaisStr = localStorage.getItem(storageKey);
      let lista: FechamentoMensal[] = locaisStr ? JSON.parse(locaisStr) : [];
      
      const indexExistente = lista.findIndex(f => f.mes_ano === payload.mes_ano);
      const novoRegistro: FechamentoMensal = {
        mes_ano: payload.mes_ano,
        total_geral: payload.total_geral,
        total_empresas: payload.total_empresas,
        total_cotacoes: payload.resumo_json?.geral?.total_cotacoes || 0,
        fechado_por: payload.fechado_por || 'ADMIN',
        fechado_em: dadosParaUpsert.fechado_em,
        resumo_json: payload.resumo_json,
        updated_at: dadosParaUpsert.updated_at
      };

      if (indexExistente >= 0) {
        lista[indexExistente] = novoRegistro;
      } else {
        lista.unshift(novoRegistro);
      }

      localStorage.setItem(storageKey, JSON.stringify(lista));
    } catch (errLocal) {
      console.warn("Erro ao gravar fechamento no localStorage:", errLocal);
    }

    if (supabaseSucesso) {
      return { success: true, data: dadosParaUpsert };
    }

    // Retorna com sucesso local caso o Supabase precise criar a tabela
    return {
      success: true,
      data: dadosParaUpsert,
      isFallbackLocal: true,
      error: supabaseErro ? `Salvo localmente com sucesso! No Supabase, execute o script SQL da tabela "fechamentos_mensais": ${supabaseErro}` : undefined
    };
  } catch (err: any) {
    console.error("Erro geral em salvarFechamentoMensalDb:", err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * 3. Consulta do Histórico de Fechamentos:
 * Busca todos os fechamentos gravados na tabela 'fechamentos_mensais' e no cache local
 */
export async function fetchFechamentosMensaisDb(): Promise<FechamentoMensal[]> {
  const mapaFechamentos = new Map<string, FechamentoMensal>();

  // 1. Busca do LocalStorage primeiro
  try {
    const locaisStr = localStorage.getItem('s_fechamentos_mensais');
    if (locaisStr) {
      const listaLocal: FechamentoMensal[] = JSON.parse(locaisStr);
      listaLocal.forEach(f => mapaFechamentos.set(f.mes_ano, f));
    }
  } catch (e) {
    console.warn("Aviso ao ler fechamentos locais:", e);
  }

  // 2. Busca da tabela 'fechamentos_mensais' do Supabase
  try {
    const { data, error, status } = await db
      .from('fechamentos_mensais')
      .select('*')
      .order('mes_ano', { ascending: false });

    if (!error && data && Array.isArray(data)) {
      data.forEach((item: any) => {
        mapaFechamentos.set(item.mes_ano, {
          id: item.id ? String(item.id) : undefined,
          mes_ano: item.mes_ano,
          total_geral: Number(item.total_geral || 0),
          total_empresas: Number(item.total_empresas || 0),
          total_cotacoes: Number(item.total_cotacoes || 0),
          fechado_por: item.fechado_por || 'ADMIN',
          fechado_em: item.fechado_em || item.created_at,
          resumo_json: item.resumo_json,
          created_at: item.created_at,
          updated_at: item.updated_at
        });
      });
    } else if (error && !isNotFoundError(error, status)) {
      console.warn("Aviso ao carregar fechamentos do Supabase:", error.message || error);
    }
  } catch (err: any) {
    if (!isNotFoundError(err, err?.status)) {
      console.warn("Aviso ao carregar fechamentos do Supabase:", err);
    }
  }

  // Retorna ordenado pelo mês mais recente primeiro
  return Array.from(mapaFechamentos.values()).sort((a, b) => b.mes_ano.localeCompare(a.mes_ano));
}

/**
 * Busca um fechamento específico por mes_ano ('YYYY-MM')
 */
export async function fetchFechamentoPorMesDb(mesAno: string): Promise<FechamentoMensal | null> {
  if (!mesAno) return null;

  try {
    const { data, error } = await db
      .from('fechamentos_mensais')
      .select('*')
      .eq('mes_ano', mesAno)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id ? String(data.id) : undefined,
        mes_ano: data.mes_ano,
        total_geral: Number(data.total_geral || 0),
        total_empresas: Number(data.total_empresas || 0),
        total_cotacoes: Number(data.total_cotacoes || 0),
        fechado_por: data.fechado_por,
        fechado_em: data.fechado_em || data.created_at,
        resumo_json: data.resumo_json,
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    }
  } catch (e) {
    console.warn("Erro ao buscar fechamento no Supabase:", e);
  }

  // Fallback Local
  try {
    const locaisStr = localStorage.getItem('s_fechamentos_mensais');
    if (locaisStr) {
      const listaLocal: FechamentoMensal[] = JSON.parse(locaisStr);
      const encontrado = listaLocal.find(f => f.mes_ano === mesAno);
      if (encontrado) return encontrado;
    }
  } catch {}

  return null;
}

