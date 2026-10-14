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
  inscricao_estadual?: string;
  indicador_ie?: string;
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
  // Módulo Fiscal (NF-e):
  status_nfe?: string;
  nfe_chave?: string;
  chave_acesso?: string;
  nfe_numero?: string;
  serie_nfe?: string;
  protocolo_autorizacao?: string;
  protocolo_nfe?: string;
  danfe_url?: string;
  xml_url?: string;
  xml_conteudo?: string;
  mensagem_erro_nfe?: string;
  nfe_emitida_em?: string;
  // Exclusão lógica (soft delete)
  deletado_em?: string | null;
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
  ncm?: string;
  unidade_medida?: string;
  csosn?: string;
  cfop?: string;
  cfop_interno?: string;
  cfop_externo?: string;
  created_at?: string;
  updated_at?: string;
}

export type UserRole = 'admin' | 'operador';
export type NivelAcesso = 'admin' | 'operador' | 'calculadora';

export interface UserProfile {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  nivel_acesso: 'admin' | 'operador' | 'calculadora';
  cargo?: string;
}

/* =========================================================================
   1. AUTENTICAÇÃO E PERFIS DA EQUIPE
   ========================================================================= */

export async function getCurrentAuthUser(): Promise<UserProfile | null> {
  try {
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) return null;

    let role: 'admin' | 'operador' = 'operador';
    let nivel_acesso: 'admin' | 'operador' | 'calculadora' = 'operador';
    let cargo: string = 'Operador';

    // 1. Verifica metadata do Supabase Auth
    const metaNivel = user.user_metadata?.nivel_acesso || user.user_metadata?.role;
    if (metaNivel) {
      if (metaNivel === 'admin') {
        role = 'admin';
        nivel_acesso = 'admin';
        cargo = 'Administrador';
      } else {
        role = 'operador';
        nivel_acesso = metaNivel === 'calculadora' ? 'calculadora' : 'operador';
        cargo = user.user_metadata?.cargo || 'Operador de Vendas';
      }
    }

    // 2. Verifica na tabela usuarios do Supabase
    try {
      const { data: uData } = await db
        .from('usuarios')
        .select('nome, cargo, role, nivel_acesso')
        .or(`email.eq.${user.email},nome.eq.${user.user_metadata?.nome || user.email?.split('@')[0]}`)
        .maybeSingle();

      if (uData) {
        const rawNivel = (uData.nivel_acesso || uData.role || '').toLowerCase();
        const isAdmin = rawNivel === 'admin' || 
                        (uData.nome || '').toUpperCase() === 'ADMIN' || 
                        (uData.cargo || '').toLowerCase().includes('admin');
        if (isAdmin) {
          role = 'admin';
          nivel_acesso = 'admin';
          cargo = uData.cargo || 'Administrador';
        } else {
          role = 'operador';
          nivel_acesso = rawNivel === 'calculadora' ? 'calculadora' : 'operador';
          cargo = uData.cargo || 'Operador de Vendas';
        }
      }
    } catch {}

    // 3. Fallback: tabela user_roles
    try {
      const { data: roleData } = await db
        .from('user_roles')
        .select('role, nivel_acesso')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData?.role || roleData?.nivel_acesso) {
        const rawR = (roleData.nivel_acesso || roleData.role).toLowerCase();
        if (rawR === 'admin') {
          role = 'admin';
          nivel_acesso = 'admin';
          cargo = 'Administrador';
        } else {
          role = 'operador';
          nivel_acesso = rawR === 'calculadora' ? 'calculadora' : 'operador';
        }
      }
    } catch {}

    const nome = user.user_metadata?.nome || user.email?.split('@')[0] || 'Usuário';

    return {
      id: user.id,
      email: user.email || '',
      nome,
      role,
      nivel_acesso,
      cargo
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
        nome,
        role: 'operador',
        nivel_acesso: 'operador'
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
  nivel_acesso?: 'admin' | 'operador' | 'calculadora';
  senha?: string;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_USUARIOS_EQUIPE: SupabaseUserRole[] = [
  { nome: 'ADMIN', senha: '1234', email: 'admin@usicorte.com.br', cargo: 'Administrador', role: 'admin', nivel_acesso: 'admin' },
  { nome: 'MARCOS (VENDAS)', senha: '123', email: 'marcos@usicorte.com.br', cargo: 'Operador de Vendas', role: 'operador', nivel_acesso: 'operador' },
  { nome: 'CARLOS (PRODUÇÃO)', senha: '123', email: 'carlos@usicorte.com.br', cargo: 'Operador de Produção', role: 'operador', nivel_acesso: 'operador' }
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
        const rawNivel = (item.nivel_acesso || item.role || '').toLowerCase();
        const isAdmin = rawNivel === 'admin' || 
                        (item.nome || '').toUpperCase() === 'ADMIN' || 
                        (item.cargo || '').toLowerCase().includes('admin');
        const cargo = item.cargo || item.perfil || (isAdmin ? 'Administrador' : 'Operador');
        const role: 'admin' | 'operador' = isAdmin ? 'admin' : 'operador';
        const nivel_acesso: 'admin' | 'operador' | 'calculadora' = isAdmin 
          ? 'admin' 
          : (rawNivel === 'calculadora' ? 'calculadora' : 'operador');

        return {
          id: item.id ? String(item.id) : undefined,
          user_id: item.user_id ? String(item.user_id) : undefined,
          nome: item.nome || item.name || (item.email ? item.email.split('@')[0] : 'Usuário'),
          email: item.email || '',
          cargo: cargo,
          role: role,
          nivel_acesso: nivel_acesso,
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
            cargo: u.cargo,
            nivel_acesso: u.nivel_acesso,
            role: u.role
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
        return roleData.map((item: any) => {
          const rawNivel = (item.nivel_acesso || item.role || '').toLowerCase();
          const isAdmin = rawNivel === 'admin' || (item.nome || '').toUpperCase() === 'ADMIN';
          return {
            id: item.id ? String(item.id) : undefined,
            user_id: item.user_id ? String(item.user_id) : undefined,
            nome: item.nome || (item.email ? item.email.split('@')[0] : 'Usuário'),
            email: item.email || '',
            cargo: isAdmin ? 'Administrador' : 'Operador',
            role: (isAdmin ? 'admin' : 'operador') as 'admin' | 'operador',
            nivel_acesso: (isAdmin ? 'admin' : (rawNivel === 'calculadora' ? 'calculadora' : 'operador')) as 'admin' | 'operador' | 'calculadora',
            senha: item.senha || '123',
            created_at: item.created_at,
            updated_at: item.updated_at
          };
        });
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
  nivel_acesso?: 'admin' | 'operador' | 'calculadora';
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const nomeTrim = usuario.nome.trim();
    const emailToUse = usuario.email?.trim() || `${nomeTrim.toLowerCase().replace(/[^a-z0-9]/g, '')}@usicorte.com.br`;
    const rawNivel = (usuario.nivel_acesso || usuario.role || '').toLowerCase();
    const isAdmin = nomeTrim.toUpperCase() === 'ADMIN' || 
                    rawNivel === 'admin' || 
                    (usuario.cargo || '').toLowerCase().includes('admin');
    const roleToUse: 'admin' | 'operador' = isAdmin ? 'admin' : 'operador';
    const nivelToUse: 'admin' | 'operador' | 'calculadora' = isAdmin 
      ? 'admin' 
      : (rawNivel === 'calculadora' ? 'calculadora' : 'operador');
    const cargoToUse = usuario.cargo || (isAdmin ? 'Administrador' : 'Operador');
    const senhaToUse = usuario.senha || '123';

    // 1. Tenta gravar na tabela principal `usuarios` com todos os campos incluindo nivel_acesso e role
    const payloadCompleto: any = {
      nome: nomeTrim,
      email: emailToUse,
      senha: senhaToUse,
      cargo: cargoToUse,
      nivel_acesso: nivelToUse,
      role: roleToUse
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

    // Se ainda falhar por causa da coluna 'nivel_acesso', tenta sem ela
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
        // Tenta apenas nome, email, senha, cargo
        res = await db.from('usuarios').insert([{
          nome: nomeTrim,
          email: emailToUse,
          senha: senhaToUse,
          cargo: cargoToUse
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
        nivel_acesso: nivelToUse,
        senha: senhaToUse
      }], { onConflict: 'email' }).select();

      if (!resRole.error) {
        return { success: true, data: resRole.data };
      }

      return { 
        success: false, 
        error: `Erro no Supabase: ${res.error.message}. Certifique-se de que a tabela "usuarios" (com colunas nome, email, senha, cargo, nivel_acesso) foi criada.` 
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
    // Campos Fiscais (NF-e)
    inscricaoEstadual: c.inscricao_estadual || c.inscricaoEstadual || c.ie || '',
    inscricao_estadual: c.inscricao_estadual || c.inscricaoEstadual || c.ie || '',
    ie: c.inscricao_estadual || c.inscricaoEstadual || c.ie || '',
    indicadorIe: c.indicador_ie ? String(c.indicador_ie) : (c.indicadorIe ? String(c.indicadorIe) : (clientType === 'CNPJ' ? '1' : '9')),
    indicador_ie: c.indicador_ie ? String(c.indicador_ie) : (c.indicadorIe ? String(c.indicadorIe) : (clientType === 'CNPJ' ? '1' : '9')),
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
  const clientType = c.type || c.tipo || (cleanDoc.length > 11 ? 'CNPJ' : 'CPF');
  const rawIe = c.inscricao_estadual || c.inscricaoEstadual || c.ie || c.i_e || c.InscricaoEstadual || '';
  const rawIndicador = c.indicador_ie || c.indicadorIe || (clientType === 'CNPJ' ? '1' : '9');

  return {
    tipo: clientType,
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
    empresa: c.fantasyName || c.nome_fantasia || c.empresa || c.name || c.nome || '',
    inscricao_estadual: rawIe ? String(rawIe).trim().toUpperCase() : '',
    indicador_ie: String(rawIndicador).trim()
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
          endereco: payload.endereco,
          inscricao_estadual: payload.inscricao_estadual || '',
          indicador_ie: payload.indicador_ie || ''
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
        endereco: payload.endereco,
        inscricao_estadual: payload.inscricao_estadual || '',
        indicador_ie: payload.indicador_ie || ''
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

export async function saveCotacaoDb(
  quote: Quote,
  originalQuoteNumber?: string
): Promise<{ data: any; error: any }> {
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
      cliente_id: quote.clientId && isUuid(quote.clientId) ? quote.clientId : undefined,
      status_nfe: quote.status_nfe || 'Pendente',
      nfe_chave: quote.nfe_chave || quote.chave_acesso,
      chave_acesso: quote.chave_acesso || quote.nfe_chave,
      nfe_numero: quote.nfe_numero,
      serie_nfe: quote.serie_nfe,
      protocolo_autorizacao: quote.protocolo_autorizacao || quote.protocolo_nfe,
      protocolo_nfe: quote.protocolo_nfe || quote.protocolo_autorizacao,
      danfe_url: quote.danfe_url,
      xml_url: quote.xml_url,
      xml_conteudo: quote.xml_conteudo,
      mensagem_erro_nfe: quote.mensagem_erro_nfe,
      nfe_emitida_em: quote.nfe_emitida_em
    };

    // 1. Busca se a cotação já existe no Supabase para garantir UPDATE correto (UPSERT)
    let existingRecords: { id: string; numero: string; created_at?: string }[] = [];

    // Prioridade 1: Buscar pelo ID direto
    if (quote.id) {
      if (isUuid(quote.id)) {
        const { data: byId } = await db
          .from('cotacoes')
          .select('id, numero, created_at')
          .eq('id', quote.id)
          .maybeSingle();

        if (byId) {
          existingRecords = [byId];
        }
      } else {
        try {
          const { data: byRawId } = await db
            .from('cotacoes')
            .select('id, numero, created_at')
            .or(`id.eq.${quote.id},numero.eq.${quote.id}`)
            .limit(1)
            .maybeSingle();

          if (byRawId) {
            existingRecords = [byRawId];
          }
        } catch {}
      }
    }

    // Prioridade 2: Buscar pelo número original de cotação (quando estiver em modo edição)
    if (existingRecords.length === 0 && originalQuoteNumber && originalQuoteNumber.trim()) {
      const cleanOrig = originalQuoteNumber.trim();
      const { data: byOrig } = await db
        .from('cotacoes')
        .select('id, numero, created_at')
        .eq('numero', cleanOrig)
        .limit(1)
        .maybeSingle();

      if (byOrig) {
        existingRecords = [byOrig];
      }
    }

    // Prioridade 3: Se não encontrou por ID ou número original, busca pelo número de cotação atual
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

      // Se existiam duplicatas antigas com o mesmo número, aplica exclusão lógica (soft delete)
      if (existingRecords.length > 1) {
        const duplicateIds = existingRecords.slice(1).map(r => r.id);
        for (const extraId of duplicateIds) {
          try {
            await db.from('cotacoes').update({
              deletado_em: new Date().toISOString(),
              status: 'cancelado',
              situacao: 'CANCELADO',
              updated_at: new Date().toISOString()
            }).eq('id', extraId);
          } catch (e) {
            console.warn("Aviso ao desativar duplicata antiga:", e);
          }
        }
      }

      // Executa o UPDATE no registro existente pelo seu ID oficial
      let { error: updateErr } = await db
        .from('cotacoes')
        .update({
          ...cotacaoPayload,
          deletado_em: null, // garante reativação se estava com soft delete
          updated_at: new Date().toISOString()
        })
        .eq('id', cotacaoId);

      // Fallback gracioso caso colunas fiscais de NF-e ainda não existam no schema da tabela
      if (updateErr) {
        const basicPayload = {
          numero: cotacaoPayload.numero,
          data: cotacaoPayload.data,
          cliente_nome: cotacaoPayload.cliente_nome,
          contato: cotacaoPayload.contato,
          telefone: cotacaoPayload.telefone,
          email: cotacaoPayload.email,
          status: cotacaoPayload.status,
          situacao: cotacaoPayload.situacao,
          observacoes: cotacaoPayload.observacoes,
          valor_total: cotacaoPayload.valor_total,
          cliente_id: cotacaoPayload.cliente_id,
          updated_at: new Date().toISOString()
        };
        const fbUpdate = await db.from('cotacoes').update(basicPayload).eq('id', cotacaoId);
        updateErr = fbUpdate.error;
      }

      if (updateErr) {
        console.error('UPDATE cotacoes falhou:', updateErr);
        return { data: null, error: updateErr };
      }

      // Limpa os itens antigos associados a essa cotação para sincronizar a lista atualizada
      const { error: delItensErr } = await db
        .from('cotacao_itens')
        .delete()
        .eq('cotacao_id', cotacaoId);

      if (delItensErr) {
        console.warn("Aviso ao limpar itens antigos da cotação:", delItensErr);
      }
    } else {
      // É INSERT de novo registro
      const insertObj: any = { ...cotacaoPayload };
      if (quote.id && isUuid(quote.id)) {
        insertObj.id = quote.id;
      }

      let { data: created, error: insertErr } = await db
        .from('cotacoes')
        .insert(insertObj)
        .select()
        .single();

      // Fallback sem campos de NF-e se colunas ainda não existirem no schema
      if (insertErr) {
        const basicPayload: any = {
          numero: cotacaoPayload.numero,
          data: cotacaoPayload.data,
          cliente_nome: cotacaoPayload.cliente_nome,
          contato: cotacaoPayload.contato,
          telefone: cotacaoPayload.telefone,
          email: cotacaoPayload.email,
          status: cotacaoPayload.status,
          situacao: cotacaoPayload.situacao,
          observacoes: cotacaoPayload.observacoes,
          valor_total: cotacaoPayload.valor_total,
          cliente_id: cotacaoPayload.cliente_id
        };
        if (quote.id && isUuid(quote.id)) {
          basicPayload.id = quote.id;
        }
        const fbInsert = await db.from('cotacoes').insert(basicPayload).select().single();
        created = fbInsert.data;
        insertErr = fbInsert.error;
      }

      if (insertErr) {
        console.error('INSERT cotacoes falhou:', insertErr);
        return { data: null, error: insertErr };
      }
      cotacaoId = created.id;
    }

    // 2. Insere os itens atualizados da cotação gravando campos fiscais em background
    if (cotacaoId && quote.items && quote.items.length > 0) {
      // Carrega materiais do cache local para herança tributária automática
      let cachedMaterialsList: any[] = [];
      try {
        if (typeof window !== 'undefined') {
          const raw = localStorage.getItem('s_materiais_cadastrados');
          if (raw) cachedMaterialsList = JSON.parse(raw);
        }
      } catch {}

      const itensPayload = quote.items.map((it, idx) => {
        const medidaCalculada = formatarMedidasLimpa(it);
        const medidaFinal = (medidaCalculada && medidaCalculada !== '-')
          ? medidaCalculada
          : '—';

        const matName = String(it.material || it.constantName || it.constanteNome || '').trim().toUpperCase();
        const foundMat = cachedMaterialsList.find((m: any) => 
          (m.nome && m.nome.trim().toUpperCase() === matName) ||
          (m.id && m.id === (it as any).materialProfileId)
        );

        const ncmFiscal = it.ncm || foundMat?.ncm || '72085200';
        const unFiscal = (it.unidade_medida || it.unidadeMedida || foundMat?.unidade_medida || 'PC').toUpperCase();
        const rawCsosn = it.csosn || foundMat?.csosn || '';
        const csosnFiscal = (!rawCsosn || String(rawCsosn).includes('102') || String(rawCsosn).includes('101')) 
          ? '101 - Com permissão de crédito' 
          : String(rawCsosn).trim();
        const cfopFiscal = it.cfop || it.cfop_interno || foundMat?.cfop_interno || '5102';

        return {
          cotacao_id: cotacaoId,
          ordem: idx,
          produto: it.constantName || it.constanteNome || it.material || 'MATERIAL',
          material: it.material || it.constantName || '',
          medida: medidaFinal,
          descricao: it.description || it.descricao || 'Item industrial',
          observacao: it.notes || it.observacao || it.info || '',
          quantidade: Number(it.quantity || it.qtd || 1),
          valor_unitario: Number(it.unitPrice || it.valorUnitario || 0),
          valor_total: Number(it.subtotal || ((it.unitPrice || 0) * (it.quantity || 1))),
          desenho_url: it.drawingImage || it.fotoDesenho || '',
          cortado: false,
          // Campos fiscais herdados automaticamente em background
          ncm: ncmFiscal,
          unidade_medida: unFiscal,
          csosn: csosnFiscal,
          cfop: cfopFiscal
        };
      });

      const itensPayloadWithWeight = quote.items.map((it, idx) => ({
        ...itensPayload[idx],
        peso_unitario: Number(it.unitWeightKg || (it as any).pesoUnitario || 0),
        peso_total: Number(it.totalWeightKg || it.pesoTotal || 0)
      }));

      let { error: itensErr } = await db.from('cotacao_itens').insert(itensPayloadWithWeight);
      if (itensErr) {
        // Fallback 1: tenta sem peso
        const fallbackRes = await db.from('cotacao_itens').insert(itensPayload);
        itensErr = fallbackRes.error;
      }
      if (itensErr) {
        // Fallback 2: colunas básicas sem campos fiscais
        const basicItens = quote.items.map((it, idx) => ({
          cotacao_id: cotacaoId,
          ordem: idx,
          produto: it.constantName || it.constanteNome || it.material || 'MATERIAL',
          material: it.material || it.constantName || '',
          medida: formatarMedidasLimpa(it) || '—',
          descricao: it.description || it.descricao || 'Item industrial',
          observacao: it.notes || it.observacao || it.info || '',
          quantidade: Number(it.quantity || it.qtd || 1),
          valor_unitario: Number(it.unitPrice || it.valorUnitario || 0),
          valor_total: Number(it.subtotal || ((it.unitPrice || 0) * (it.quantity || 1))),
          desenho_url: it.drawingImage || it.fotoDesenho || '',
          cortado: false
        }));
        const fb2 = await db.from('cotacao_itens').insert(basicItens);
        itensErr = fb2.error;
      }
      if (itensErr) {
        console.error("Erro ao inserir itens da cotação no Supabase:", itensErr);
        return { data: { id: cotacaoId, ...cotacaoPayload }, error: itensErr };
      }
    }

    invalidateCotacoesCache();
    return { data: { id: cotacaoId, ...cotacaoPayload }, error: null };
  } catch (err) {
    return { data: null, error: err };
  }
}

/**
 * Helper resiliente para resolver o status final da NF-e considerando
 * tanto a base de dados do Supabase quanto o status local gravado.
 * Se qualquer fonte registrar como CANCELADA, o status definitivo é CANCELADA.
 */
export function resolveStatusNfeFinal(
  dbStatus?: string | null,
  currentStatus?: string | null,
  chaveAcesso?: string | null
): string {
  const cleanKey = (chaveAcesso || '').replace(/\D/g, '');
  if (cleanKey && typeof window !== 'undefined') {
    try {
      const localFlag = localStorage.getItem(`usicorte_nfe_status_${cleanKey}`);
      if (localFlag === 'CANCELADA') return 'CANCELADA';
    } catch {}
  }
  const sDb = String(dbStatus || '').trim().toUpperCase();
  const sCur = String(currentStatus || '').trim().toUpperCase();
  if (sDb === 'CANCELADA' || sDb === 'CANCELADO' || sCur === 'CANCELADA' || sCur === 'CANCELADO') {
    return 'CANCELADA';
  }
  if (sDb === 'AUTORIZADA' || sDb === 'EMITIDA' || sDb === 'EMITIDO' || sDb === 'AUTORIZADO') {
    return 'AUTORIZADA';
  }
  if (sCur === 'AUTORIZADA' || sCur === 'EMITIDA' || sCur === 'EMITIDO' || sCur === 'AUTORIZADO') {
    return sCur;
  }
  return dbStatus || currentStatus || 'Pendente';
}

/**
 * Atualiza status e metadados fiscais da NF-e na tabela 'cotacoes' do Supabase
 * utilizando estritamente colunas existentes no schema:
 * status_nfe, nfe_status, nfe_chave, chave_acesso, nfe_numero, nfe_serie, danfe_url, xml_url, mensagem_erro_nfe, nfe_xml, updated_at
 */
export async function updateCotacaoNfeStatusDb(
  cotacaoIdOrNumber: string,
  payload: {
    status_nfe: 'Pendente' | 'Processando' | 'Emitida' | 'AUTORIZADA' | 'CANCELADA' | 'Erro' | string;
    nfe_chave?: string;
    chave_acesso?: string;
    nfe_numero?: string;
    serie_nfe?: string;
    protocolo_autorizacao?: string;
    protocolo_nfe?: string;
    danfe_url?: string;
    xml_url?: string;
    xml_conteudo?: string;
    mensagem_erro_nfe?: string | null;
    nfe_emitida_em?: string;
    protocolo_cancelamento?: string;
    xml_cancelamento?: string;
    motivo_cancelamento?: string;
    nfe_cancelada_em?: string;
  }
): Promise<{ success: boolean; error: any }> {
  try {
    if (!cotacaoIdOrNumber) return { success: false, error: 'Identificador não fornecido' };

    const chaveFinal = payload.chave_acesso || payload.nfe_chave;
    const cleanChave = (chaveFinal || '').replace(/\D/g, '');

    // Payload estritamente compatível com o schema real da tabela cotacoes do Supabase
    const updateObj: Record<string, any> = {
      status_nfe: payload.status_nfe,
      nfe_status: payload.status_nfe,
      updated_at: new Date().toISOString()
    };

    if (cleanChave) {
      updateObj.nfe_chave = cleanChave;
      updateObj.chave_acesso = cleanChave;
    }
    if (payload.nfe_numero !== undefined) {
      updateObj.nfe_numero = String(payload.nfe_numero).replace(/\D/g, '');
    }
    if (payload.serie_nfe !== undefined) {
      updateObj.nfe_serie = String(payload.serie_nfe).replace(/\D/g, '');
    }
    if (payload.danfe_url !== undefined) updateObj.danfe_url = payload.danfe_url;
    if (payload.xml_url !== undefined) updateObj.xml_url = payload.xml_url;
    if (payload.xml_conteudo !== undefined) updateObj.nfe_xml = payload.xml_conteudo;
    if (payload.xml_cancelamento !== undefined) updateObj.nfe_xml = payload.xml_cancelamento;

    if (payload.status_nfe === 'CANCELADA') {
      const msgCanc = `CANCELADA SEFAZ - Prot: ${payload.protocolo_cancelamento || ''} - Motivo: ${payload.motivo_cancelamento || ''}`.trim();
      updateObj.mensagem_erro_nfe = msgCanc;
    } else if (payload.mensagem_erro_nfe !== undefined) {
      updateObj.mensagem_erro_nfe = payload.mensagem_erro_nfe;
    }

    // Persistência local redundante e imediata
    try {
      if (cleanChave) {
        if (payload.xml_conteudo) localStorage.setItem(`usicorte_nfe_xml_${cleanChave}`, payload.xml_conteudo);
        if (payload.xml_cancelamento) localStorage.setItem(`usicorte_nfe_cancel_xml_${cleanChave}`, payload.xml_cancelamento);
        if (payload.protocolo_cancelamento) localStorage.setItem(`usicorte_nfe_cancel_prot_${cleanChave}`, payload.protocolo_cancelamento);
        if (payload.status_nfe === 'CANCELADA') localStorage.setItem(`usicorte_nfe_status_${cleanChave}`, 'CANCELADA');
      }
      if (payload.xml_conteudo) {
        localStorage.setItem(`usicorte_nfe_xml_cot_${cotacaoIdOrNumber}`, payload.xml_conteudo);
      }

      // Sincroniza também no cache s_orcamentos caso exista
      const sOrc = localStorage.getItem('s_orcamentos');
      if (sOrc) {
        const arr = JSON.parse(sOrc);
        if (Array.isArray(arr)) {
          const updatedArr = arr.map((q: any) => {
            const matches = 
              q.id === cotacaoIdOrNumber ||
              q.quoteNumber === cotacaoIdOrNumber ||
              (cleanChave && (q.nfe_chave === cleanChave || q.chave_acesso === cleanChave)) ||
              (payload.nfe_numero && String(q.nfe_numero) === String(payload.nfe_numero));
            if (matches) {
              return {
                ...q,
                status_nfe: payload.status_nfe,
                nfe_status: payload.status_nfe,
                motivo_cancelamento: payload.motivo_cancelamento || q.motivo_cancelamento,
                protocolo_cancelamento: payload.protocolo_cancelamento || q.protocolo_cancelamento
              };
            }
            return q;
          });
          localStorage.setItem('s_orcamentos', JSON.stringify(updatedArr));
        }
      }
    } catch {}

    const isIdUuid = isUuid(cotacaoIdOrNumber);

    // 1. Tenta atualizar pelo ID/Número
    let query = db.from('cotacoes').update(updateObj);
    if (isIdUuid) {
      query = query.eq('id', cotacaoIdOrNumber);
    } else {
      query = query.or(`id.eq.${cotacaoIdOrNumber},numero.eq.${cotacaoIdOrNumber}`);
    }

    let { error } = await query;

    // 2. Se não deu erro mas queremos garantir sincronia em duplicatas por chave de acesso
    if (cleanChave) {
      try {
        await db.from('cotacoes').update(updateObj).or(`chave_acesso.eq.${cleanChave},nfe_chave.eq.${cleanChave}`);
      } catch {}
    }

    // Invalida cache de memória para leitura imediata atualizada
    invalidateCotacoesCache();

    if (error) {
      console.warn('Aviso ao atualizar status_nfe no Supabase:', error.message);
      return { success: false, error };
    }
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err };
  }
}

/**
 * Operação DEFINITIVA de cancelamento da NF-e no Supabase:
 * Atualiza simultaneamente as tabelas 'notas_fiscais' e 'cotacoes',
 * garantindo persistência imediata, sincronia no cache e permanência no F5.
 */
export async function cancelarNotaFiscalSupabase(params: {
  cotacaoIdOrNumber?: string;
  chaveAcesso: string;
  numeroNfe?: string | number;
  protocoloCancelamento: string;
  xmlCancelamento: string;
  justificativa: string;
  clienteId?: string;
  valorTotal?: number;
}): Promise<{ success: boolean; error?: any }> {
  try {
    const cleanChave = (params.chaveAcesso || '').replace(/\D/g, '');
    const numLimpo = parseInt(String(params.numeroNfe || '').replace(/\D/g, ''), 10) || null;
    const idOrNum = params.cotacaoIdOrNumber || '';

    // 1. ATUALIZAÇÃO NO SUPABASE: Tabela 'notas_fiscais'
    // Colunas válidas: id, created_at, cotacao_id, cliente_id, numero_nfe, serie_nfe, chave_acesso, protocolo, status, xml_conteudo, valor_total, data_emissao
    const nfPayloadUpdate: Record<string, any> = {
      status: 'CANCELADA',
      protocolo: params.protocoloCancelamento,
      xml_conteudo: params.xmlCancelamento
    };

    let updatedRowsNf = 0;

    // 1a. Update por chave de acesso (se tiver 44 dígitos)
    if (cleanChave) {
      const resKey = await db
        .from('notas_fiscais')
        .update(nfPayloadUpdate)
        .eq('chave_acesso', cleanChave)
        .select();
      if (resKey.data && resKey.data.length > 0) {
        updatedRowsNf += resKey.data.length;
      }
    }

    // 1b. Update por numero_nfe se ainda não atualizou
    if (updatedRowsNf === 0 && numLimpo) {
      const resNum = await db
        .from('notas_fiscais')
        .update(nfPayloadUpdate)
        .eq('numero_nfe', numLimpo)
        .select();
      if (resNum.data && resNum.data.length > 0) {
        updatedRowsNf += resNum.data.length;
      }
    }

    // 1c. Update por cotacao_id se ainda não atualizou
    if (updatedRowsNf === 0 && idOrNum) {
      const resCot = await db
        .from('notas_fiscais')
        .update(nfPayloadUpdate)
        .eq('cotacao_id', idOrNum)
        .select();
      if (resCot.data && resCot.data.length > 0) {
        updatedRowsNf += resCot.data.length;
      }
    }

    // 1d. Se nenhum registro existia na tabela notas_fiscais, INSERE o registro com status CANCELADA
    // para que qualquer leitura subsequente (inclusive no F5) carregue como CANCELADA
    if (updatedRowsNf === 0 && cleanChave) {
      try {
        await db.from('notas_fiscais').insert({
          cotacao_id: isUuid(idOrNum) ? idOrNum : null,
          cliente_id: params.clienteId && isUuid(params.clienteId) ? params.clienteId : null,
          numero_nfe: numLimpo || 1,
          serie_nfe: 1,
          chave_acesso: cleanChave,
          protocolo: params.protocoloCancelamento,
          status: 'CANCELADA',
          xml_conteudo: params.xmlCancelamento,
          valor_total: Number(params.valorTotal) || 0,
          created_at: new Date().toISOString()
        });
      } catch (insertErr) {
        console.warn('Aviso ao inserir nota fiscal cancelada em notas_fiscais:', insertErr);
      }
    }

    // 2. ATUALIZAÇÃO NO SUPABASE: Tabela 'cotacoes'
    const cotPayloadUpdate: Record<string, any> = {
      status_nfe: 'CANCELADA',
      nfe_status: 'CANCELADA',
      mensagem_erro_nfe: `CANCELADA SEFAZ - Prot: ${params.protocoloCancelamento} - Motivo: ${params.justificativa}`.trim(),
      nfe_xml: params.xmlCancelamento,
      updated_at: new Date().toISOString()
    };

    // 2a. Update por id / numero
    if (idOrNum) {
      if (isUuid(idOrNum)) {
        await db.from('cotacoes').update(cotPayloadUpdate).eq('id', idOrNum);
      } else {
        await db.from('cotacoes').update(cotPayloadUpdate).or(`id.eq.${idOrNum},numero.eq.${idOrNum}`);
      }
    }

    // 2b. Update por chave de acesso
    if (cleanChave) {
      await db.from('cotacoes').update(cotPayloadUpdate).or(`chave_acesso.eq.${cleanChave},nfe_chave.eq.${cleanChave}`);
    }

    // 2c. Update por numero_nfe
    if (numLimpo) {
      await db.from('cotacoes').update(cotPayloadUpdate).eq('nfe_numero', String(numLimpo));
    }

    // 3. LIMPEZA DE CACHE EM MEMÓRIA
    invalidateCotacoesCache();

    // 4. ATUALIZAÇÃO NO LOCALSTORAGE (Redundância offline e persistência local garantida)
    try {
      if (cleanChave) {
        localStorage.setItem(`usicorte_nfe_status_${cleanChave}`, 'CANCELADA');
        localStorage.setItem(`usicorte_nfe_cancel_xml_${cleanChave}`, params.xmlCancelamento);
        localStorage.setItem(`usicorte_nfe_cancel_prot_${cleanChave}`, params.protocoloCancelamento);
      }

      // Atualiza array usicorte_notas_fiscais
      const existingStr = localStorage.getItem('usicorte_notas_fiscais');
      if (existingStr) {
        const list: any[] = JSON.parse(existingStr);
        let foundInList = false;
        const updatedList = list.map(item => {
          const matchKey = cleanChave && item.chave_acesso === cleanChave;
          const matchNum = numLimpo && Number(item.numero_nfe) === numLimpo;
          const matchCot = idOrNum && (item.cotacao_id === idOrNum);
          if (matchKey || matchNum || matchCot) {
            foundInList = true;
            return {
              ...item,
              status: 'CANCELADA',
              protocolo: params.protocoloCancelamento,
              xml_cancelamento: params.xmlCancelamento,
              motivo_cancelamento: params.justificativa
            };
          }
          return item;
        });

        if (!foundInList && cleanChave) {
          updatedList.unshift({
            chave_acesso: cleanChave,
            numero_nfe: numLimpo || 1,
            serie_nfe: 1,
            status: 'CANCELADA',
            protocolo: params.protocoloCancelamento,
            xml_cancelamento: params.xmlCancelamento,
            motivo_cancelamento: params.justificativa,
            cotacao_id: idOrNum || null,
            valor_total: params.valorTotal || 0,
            created_at: new Date().toISOString()
          });
        }
        localStorage.setItem('usicorte_notas_fiscais', JSON.stringify(updatedList));
      }

      // Atualiza array s_orcamentos caso exista
      const sOrc = localStorage.getItem('s_orcamentos');
      if (sOrc) {
        const orcList: any[] = JSON.parse(sOrc);
        if (Array.isArray(orcList)) {
          const updatedOrc = orcList.map(q => {
            const matches =
              q.id === idOrNum ||
              q.quoteNumber === idOrNum ||
              (cleanChave && (q.nfe_chave === cleanChave || q.chave_acesso === cleanChave)) ||
              (numLimpo && Number(q.nfe_numero) === numLimpo);
            if (matches) {
              return {
                ...q,
                status_nfe: 'CANCELADA',
                nfe_status: 'CANCELADA',
                protocolo_cancelamento: params.protocoloCancelamento,
                xml_cancelamento: params.xmlCancelamento,
                motivo_cancelamento: params.justificativa
              };
            }
            return q;
          });
          localStorage.setItem('s_orcamentos', JSON.stringify(updatedOrc));
        }
      }

      // Notifica componentes através de evento global
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('nfe_status_changed', {
            detail: {
              chaveAcesso: cleanChave,
              numeroNfe: numLimpo,
              status: 'CANCELADA',
              protocolo: params.protocoloCancelamento
            }
          })
        );
      }
    } catch {}

    return { success: true };
  } catch (err) {
    console.error('Erro em cancelarNotaFiscalSupabase:', err);
    return { success: false, error: err };
  }
}

export interface FetchCotacoesOptions {
  limit?: number;
  offset?: number;
  page?: number;
  dataInicio?: string;
  dataFim?: string;
  situacao?: string;
  forceRefresh?: boolean;
}

// Cache em memória de curta duração para aceleração da navegação e troca de abas
let cotacoesMemoryCache: Map<string, { data: SupabaseCotacao[]; timestamp: number }> = new Map();
const COTACOES_CACHE_TTL_MS = 10000; // 10 segundos de reaproveitamento ultrarrápido

export function invalidateCotacoesCache() {
  cotacoesMemoryCache.clear();
}

export async function fetchCotacoesDb(
  filtroCliente?: string, 
  filtroStatus?: string,
  options?: FetchCotacoesOptions
): Promise<SupabaseCotacao[]> {
  try {
    const cacheKey = JSON.stringify({ filtroCliente, filtroStatus, options });
    const cached = cotacoesMemoryCache.get(cacheKey);
    const now = Date.now();

    if (!options?.forceRefresh && cached && (now - cached.timestamp < COTACOES_CACHE_TTL_MS)) {
      return cached.data;
    }

    // Consulta otimizada ignorando registros com exclusão lógica (.is('deletado_em', null))
    let q = db
      .from('cotacoes')
      .select('*, cotacao_itens(*)')
      .is('deletado_em', null)
      .order('created_at', { ascending: false, nullsFirst: false });

    // 1. Filtro server-side por cliente
    if (filtroCliente && filtroCliente.trim()) {
      q = q.ilike('cliente_nome', `%${filtroCliente.trim()}%`);
    }

    // 2. Filtro server-side por status
    if (filtroStatus && filtroStatus !== 'todas' && filtroStatus !== 'todos') {
      if (filtroStatus === 'ativas') {
        q = q.in('status', ['pendente', 'aprovado', 'rascunho']);
      } else {
        q = q.eq('status', filtroStatus);
      }
    }

    // 3. Filtro server-side por situação (ex: FATURADO)
    if (options?.situacao) {
      q = q.eq('situacao', options.situacao);
    }

    // 4. Filtros server-side por intervalo de datas
    if (options?.dataInicio) {
      q = q.gte('data', options.dataInicio);
    }
    if (options?.dataFim) {
      q = q.lte('data', options.dataFim);
    }

    // 5. Paginação e Limites: aplica apenas se explicitamente configurado pelo chamador
    if (options?.page && options.page > 0) {
      const limit = options?.limit ?? 50;
      const from = (options.page - 1) * limit;
      const to = from + limit - 1;
      q = q.range(from, to);
    } else if (options?.offset !== undefined) {
      const limit = options?.limit ?? 50;
      const from = options.offset;
      const to = from + limit - 1;
      q = q.range(from, to);
    } else if (options?.limit && options.limit > 0) {
      q = q.limit(options.limit);
    }

    let { data, error, status } = await q;

    // Fallback: se a coluna 'deletado_em' ainda não existir na tabela cotacoes do Supabase
    if (error && (error.code === '42703' || error.message?.toLowerCase().includes('deletado_em') || error.code === 'PGRST204')) {
      let retryQ = db
        .from('cotacoes')
        .select('*, cotacao_itens(*)')
        .order('created_at', { ascending: false, nullsFirst: false });

      if (filtroCliente && filtroCliente.trim()) {
        retryQ = retryQ.ilike('cliente_nome', `%${filtroCliente.trim()}%`);
      }
      if (filtroStatus && filtroStatus !== 'todas' && filtroStatus !== 'todos') {
        if (filtroStatus === 'ativas') {
          retryQ = retryQ.in('status', ['pendente', 'aprovado', 'rascunho']);
        } else {
          retryQ = retryQ.eq('status', filtroStatus);
        }
      }
      if (options?.situacao) {
        retryQ = retryQ.eq('situacao', options.situacao);
      }
      if (options?.dataInicio) {
        retryQ = retryQ.gte('data', options.dataInicio);
      }
      if (options?.dataFim) {
        retryQ = retryQ.lte('data', options.dataFim);
      }
      if (options?.limit && options.limit > 0) {
        retryQ = retryQ.limit(options.limit);
      }
      const retryRes = await retryQ;
      data = retryRes.data;
      error = retryRes.error;
      status = retryRes.status;
    }

    if (error) {
      if (!isNotFoundError(error, status)) {
        console.warn("Erro ao carregar cotações do Supabase:", error.message);
      }
      return [];
    }

    let result: SupabaseCotacao[] = [];
    if (data && Array.isArray(data)) {
      result = (data as SupabaseCotacao[]).filter((c: any) => {
        const num = String(c.numero || c.id || '');
        if (num.includes('021935') || num.includes('21935')) return false;
        // Filtro rigoroso: ignora registros com exclusão lógica
        if (c.deletado_em) return false;
        return true;
      });
    }

    // Armazena no cache local em memória
    cotacoesMemoryCache.set(cacheKey, { data: result, timestamp: now });

    return result;
  } catch (err) {
    console.error("Erro na busca de cotações:", err);
    return [];
  }
}

/**
 * Busca direta e ultra-rápida dos últimos N itens da tabela 'cotacao_itens' do Supabase,
 * trazendo a cotação pai associada para abertura instantânea da Consulta Geral.
 */
export async function fetchUltimosItensCotacaoDb(limit = 10): Promise<{ itens: any[]; error: any }> {
  try {
    const { data, error, status } = await db
      .from('cotacao_itens')
      .select('*, cotacoes(*)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (!isNotFoundError(error, status)) {
        console.warn("Erro ao buscar últimos itens de cotações no Supabase:", error.message);
      }
      return { itens: [], error };
    }

    const filtered = (data || []).filter((it: any) => {
      const q = Array.isArray(it.cotacoes) ? it.cotacoes[0] : it.cotacoes;
      if (q && q.deletado_em) return false;
      const num = String(q?.numero || q?.id || '');
      return !num.includes('021935') && !num.includes('21935');
    });

    return { itens: filtered, error: null };
  } catch (err) {
    console.error("Erro na busca direta de itens de cotação:", err);
    return { itens: [], error: err };
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

  invalidateCotacoesCache();
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

  invalidateCotacoesCache();
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

    const agoraIso = new Date().toISOString();
    let cotacaoId = idOrNumero;
    let cotacaoNumero = idOrNumero;

    // 1. Localiza a cotação se for pelo número ou por ID
    if (isUuid(idOrNumero)) {
      const { data: found } = await db
        .from('cotacoes')
        .select('id, numero')
        .eq('id', idOrNumero)
        .maybeSingle();
      if (found) {
        cotacaoNumero = found.numero;
      }
    } else {
      const { data: found } = await db
        .from('cotacoes')
        .select('id, numero')
        .eq('numero', idOrNumero)
        .maybeSingle();
      if (found?.id) {
        cotacaoId = found.id;
        cotacaoNumero = found.numero;
      }
    }

    // 2. EXCLUSÃO LÓGICA (SOFT DELETE)
    // Atualiza status para 'cancelado', situacao para 'CANCELADO' e deletado_em com timestamp atual
    const softDeletePayload: Record<string, any> = {
      deletado_em: agoraIso,
      status: 'cancelado',
      situacao: 'CANCELADO',
      updated_at: agoraIso
    };

    let updateQuery = isUuid(cotacaoId)
      ? db.from('cotacoes').update(softDeletePayload).eq('id', cotacaoId)
      : db.from('cotacoes').update(softDeletePayload).or(`id.eq.${cotacaoId},numero.eq.${cotacaoNumero}`);

    let { error: errUpdate } = await updateQuery;

    // Fallback caso a coluna deletado_em não exista no schema do Supabase
    if (errUpdate && (errUpdate.code === '42703' || errUpdate.message?.toLowerCase().includes('deletado_em') || errUpdate.code === 'PGRST204')) {
      const fallbackPayload = {
        status: 'cancelado',
        situacao: 'CANCELADO',
        updated_at: agoraIso
      };
      const fbQuery = isUuid(cotacaoId)
        ? db.from('cotacoes').update(fallbackPayload).eq('id', cotacaoId)
        : db.from('cotacoes').update(fallbackPayload).or(`id.eq.${cotacaoId},numero.eq.${cotacaoNumero}`);
      const fbRes = await fbQuery;
      errUpdate = fbRes.error;
    }

    // Se houver número e não for UUID, garante atualização também pelo número
    if (!errUpdate && cotacaoNumero && cotacaoNumero !== cotacaoId) {
      try {
        await db.from('cotacoes').update(softDeletePayload).eq('numero', cotacaoNumero);
      } catch {}
    }

    // 3. Atualiza cache em memória e cache local
    invalidateCotacoesCache();

    try {
      const localStr = localStorage.getItem('s_orcamentos');
      if (localStr) {
        const orcs = JSON.parse(localStr);
        if (Array.isArray(orcs)) {
          const filtered = orcs.filter(
            (o: any) => o.id !== cotacaoId && o.quoteNumber !== cotacaoNumero && o.id !== idOrNumero && o.quoteNumber !== idOrNumero
          );
          localStorage.setItem('s_orcamentos', JSON.stringify(filtered));
        }
      }
    } catch {}

    return { error: errUpdate };
  } catch (err) {
    console.error("Erro ao aplicar soft delete na cotação:", err);
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
    const clean = idOrNumero.trim();

    let cotacao: any = null;

    // 1. Busca nativa pelo campo 'id' se for um UUID válido
    if (isUuid(clean)) {
      const { data: dataById } = await db
        .from('cotacoes')
        .select('*')
        .eq('id', clean)
        .maybeSingle();

      if (dataById) {
        cotacao = dataById;
      }
    }

    // 2. Busca pelo campo 'numero' (ex: COT-2026-0001)
    if (!cotacao) {
      const { data: dataByNumero } = await db
        .from('cotacoes')
        .select('*')
        .eq('numero', clean)
        .maybeSingle();

      if (dataByNumero) {
        cotacao = dataByNumero;
      }
    }

    // 3. Fallback adicional por ID sem restrição de regex UUID (ex: id numérico)
    if (!cotacao) {
      const { data: dataFallback } = await db
        .from('cotacoes')
        .select('*')
        .eq('id', clean)
        .maybeSingle();

      if (dataFallback) {
        cotacao = dataFallback;
      }
    }

    if (!cotacao) return null;

    // 4. CONSULTA INTEGRAL DE TODOS OS ITENS SEM LIMITE NA TABELA 'cotacao_itens'
    // Evita truncamento e garante que todos os 65+ itens sejam carregados
    let itensDaCotacao: SupabaseCotacaoItem[] = [];

    // Helper interno para buscar sem limite
    const buscarItensSemLimite = async (campo: string, valor: string): Promise<SupabaseCotacaoItem[]> => {
      try {
        let res = await db
          .from('cotacao_itens')
          .select('*')
          .eq(campo, valor)
          .order('ordem', { ascending: true });
        if (!res.error && res.data && res.data.length > 0) return res.data;

        // Fallback sem order
        const fb = await db
          .from('cotacao_itens')
          .select('*')
          .eq(campo, valor);
        if (!fb.error && fb.data && fb.data.length > 0) return fb.data;
      } catch {}
      return [];
    };

    // Busca direta pelo UUID / ID da cotação
    if (cotacao.id) {
      itensDaCotacao = await buscarItensSemLimite('cotacao_id', String(cotacao.id));
    }

    // Se não encontrou por ID, ou se os itens foram associados pelo campo 'numero'
    if (itensDaCotacao.length === 0 && cotacao.numero) {
      itensDaCotacao = await buscarItensSemLimite('cotacao_id', String(cotacao.numero));
    }

    cotacao.cotacao_itens = itensDaCotacao;
    return cotacao as SupabaseCotacao;
  } catch (err) {
    console.error("Erro ao buscar cotação por ID/número:", err);
    return null;
  }
}

export async function fetchItensByCotacaoId(cotacaoIdOrNumero: string): Promise<SupabaseCotacaoItem[]> {
  try {
    if (!cotacaoIdOrNumero) return [];
    const clean = String(cotacaoIdOrNumero).trim();

    const buscarItensSemLimite = async (campo: string, valor: string): Promise<SupabaseCotacaoItem[]> => {
      try {
        let res = await db
          .from('cotacao_itens')
          .select('*')
          .eq(campo, valor)
          .order('ordem', { ascending: true });
        if (!res.error && res.data && res.data.length > 0) return res.data;

        // Fallback sem order para suportar esquemas sem coluna ordem
        const fb = await db
          .from('cotacao_itens')
          .select('*')
          .eq(campo, valor);
        if (!fb.error && fb.data && fb.data.length > 0) return fb.data;
      } catch {}
      return [];
    };

    // 1. Busca direta por cotacao_id sem qualquer restrição de limite
    let itens = await buscarItensSemLimite('cotacao_id', clean);
    if (itens && itens.length > 0) {
      return itens;
    }

    // 2. Se clean for número de cotação (ex: COT-2026-0001), resolve o UUID correspondente
    if (!isUuid(clean)) {
      const uuid = await resolveCotacaoUuid(clean);
      if (uuid) {
        itens = await buscarItensSemLimite('cotacao_id', uuid);
        if (itens && itens.length > 0) {
          return itens;
        }
      }
    } else {
      // 3. Se clean for UUID, busca o número da cotação e consulta por ele
      const { data: cotData } = await db
        .from('cotacoes')
        .select('numero')
        .eq('id', clean)
        .maybeSingle();

      if (cotData?.numero) {
        itens = await buscarItensSemLimite('cotacao_id', cotData.numero);
        if (itens && itens.length > 0) {
          return itens;
        }
      }
    }

    // 4. Fallback por cotacao_numero caso a coluna alternativa seja usada
    try {
      const { data: altCols } = await db
        .from('cotacao_itens')
        .select('*')
        .eq('cotacao_numero', clean);
      if (altCols && altCols.length > 0) return altCols;
    } catch {}

    // 5. Fallback por localStorage ('s_orcamentos') garantindo todos os itens em modo offline/local
    try {
      const saved = localStorage.getItem('s_orcamentos');
      if (saved) {
        const parsed = JSON.parse(saved);
        const found = parsed.find((q: any) => 
          (q.id && String(q.id).trim() === clean) ||
          (q.quoteNumber && String(q.quoteNumber).trim().toLowerCase() === clean.toLowerCase())
        );
        if (found && Array.isArray(found.items) && found.items.length > 0) {
          return found.items.map((it: any, idx: number) => ({
            id: it.id || idx + 1,
            cotacao_id: clean,
            ordem: idx,
            produto: it.constantName || it.constanteNome || it.material || 'MATERIAL',
            material: it.material || it.constantName || '',
            medida: it.measure || it.diameter || it.medida || '—',
            descricao: it.description || it.descricao || 'Item industrial',
            observacao: it.notes || it.observacao || '',
            quantidade: Number(it.quantity || it.qtd || 1),
            valor_unitario: Number(it.unitPrice || it.valorUnitario || 0),
            valor_total: Number(it.subtotal || ((it.unitPrice || 0) * (it.quantity || 1))),
            desenho_url: it.drawingImage || it.fotoDesenho || '',
            ncm: it.ncm,
            unidade_medida: it.unidade_medida || it.unidade,
            csosn: it.csosn,
            cfop: it.cfop,
            cfop_interno: it.cfop_interno,
            cfop_externo: it.cfop_externo,
            peso_unitario: Number(it.unitWeightKg || it.pesoUnitario || 0),
            peso_total: Number(it.totalWeightKg || it.pesoTotal || 0)
          }));
        }
      }
    } catch {}

    return [];
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

// =========================================================================
// INTEGRAÇÃO COM A TABELA 'NOTAS_FISCAIS' NO SUPABASE
// =========================================================================

export interface NotaFiscalDb {
  id?: string;
  cotacao_id?: string | null;
  cliente_id?: string | null;
  numero_nfe: number | string;
  serie_nfe?: number | string;
  chave_acesso: string;
  protocolo?: string | null;
  status: 'AUTORIZADA' | 'CANCELADA' | string;
  xml_conteudo?: string | null;
  valor_total: number;
  created_at?: string;
  updated_at?: string;
  cliente_nome?: string;
  cotacao_numero?: string;
}

/**
 * Insere um registro oficial de NF-e na tabela 'notas_fiscais' do Supabase
 * logo após retorno de "AUTORIZADA" (Status 100) da SEFAZ.
 */
export async function inserirNotaFiscalDb(nota: {
  cotacao_id?: string | null;
  cliente_id?: string | null;
  numero_nfe: number | string;
  serie_nfe?: number | string;
  chave_acesso: string;
  protocolo?: string | null;
  status: string;
  xml_conteudo?: string | null;
  valor_total: number;
}): Promise<{ data: any; error: any }> {
  try {
    const numLimpo = parseInt(String(nota.numero_nfe || '').replace(/\D/g, ''), 10) || 1;
    const serieLimpa = parseInt(String(nota.serie_nfe || '1').replace(/\D/g, ''), 10) || 1;
    const chaveLimpa = (nota.chave_acesso || '').replace(/\D/g, '') || nota.chave_acesso;

    const payload: any = {
      cotacao_id: nota.cotacao_id || null,
      cliente_id: nota.cliente_id || null,
      numero_nfe: numLimpo,
      serie_nfe: serieLimpa,
      chave_acesso: chaveLimpa,
      protocolo: nota.protocolo || null,
      status: nota.status || 'AUTORIZADA',
      xml_conteudo: nota.xml_conteudo || null,
      valor_total: Number(nota.valor_total) || 0,
      created_at: new Date().toISOString()
    };

    // 1. Gravação no LocalStorage como redundância imediata e cache
    try {
      const existingStr = localStorage.getItem('usicorte_notas_fiscais');
      const list: any[] = existingStr ? JSON.parse(existingStr) : [];
      const filtered = list.filter(
        item => item.chave_acesso !== chaveLimpa && item.numero_nfe !== numLimpo
      );
      filtered.unshift({ ...payload, id: `nf_${Date.now()}` });
      localStorage.setItem('usicorte_notas_fiscais', JSON.stringify(filtered.slice(0, 300)));
      
      if (nota.xml_conteudo && chaveLimpa) {
        localStorage.setItem(`usicorte_nfe_xml_${chaveLimpa}`, nota.xml_conteudo);
      }
    } catch (localErr) {
      console.warn('Aviso ao persistir nota fiscal no localStorage:', localErr);
    }

    // 2. Inserção na tabela notas_fiscais do Supabase
    let { data, error } = await db.from('notas_fiscais').insert(payload).select().maybeSingle();

    // Fallback: se houver violação de chave única (já existe), faz update
    if (error && (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique'))) {
      const updateRes = await db
        .from('notas_fiscais')
        .update(payload)
        .eq('chave_acesso', chaveLimpa)
        .select()
        .maybeSingle();
      data = updateRes.data;
      error = updateRes.error;
    }

    // Fallback: se o banco exigir que cotacao_id/cliente_id sejam UUIDs estritos e receber string não-UUID
    if (error && (error.code === '22P02' || error.message?.includes('uuid'))) {
      const safePayload = {
        ...payload,
        cotacao_id: isUuid(payload.cotacao_id) ? payload.cotacao_id : null,
        cliente_id: isUuid(payload.cliente_id) ? payload.cliente_id : null
      };
      const retry = await db.from('notas_fiscais').insert(safePayload).select().maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    // Fallback: se a coluna numero_nfe esperar string em vez de inteiro
    if (error && (error.code === '42804' || error.message?.includes('type'))) {
      const stringPayload = {
        ...payload,
        numero_nfe: String(numLimpo),
        serie_nfe: String(serieLimpa)
      };
      const retry = await db.from('notas_fiscais').insert(stringPayload).select().maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    // Fallback: se a coluna created_at não existir no schema
    if (error && (error.code === '42703' || error.message?.includes('created_at'))) {
      const payloadNoDate = { ...payload };
      delete payloadNoDate.created_at;
      const retry = await db.from('notas_fiscais').insert(payloadNoDate).select().maybeSingle();
      data = retry.data;
      error = retry.error;
    }

    // Fallback: se RLS permitir insert mas não select()
    if (error && (error.code === '42501' || error.message?.includes('policy') || error.message?.includes('permission'))) {
      const retryWithoutSelect = await db.from('notas_fiscais').insert(payload);
      if (!retryWithoutSelect.error) {
        return { data: payload, error: null };
      }
    }

    if (error) {
      console.warn('Aviso ao inserir na tabela notas_fiscais do Supabase (mantido no cache local):', error.message);
      return { data: payload, error };
    }

    return { data, error: null };
  } catch (err: any) {
    console.warn('Exceção ao inserir nota fiscal:', err);
    return { data: null, error: err };
  }
}

/**
 * Consulta a lista de notas fiscais diretamente da tabela 'notas_fiscais' do Supabase
 * com fallback e mesclagem transparente do cache local.
 */
export async function fetchNotasFiscaisDb(): Promise<{ data: NotaFiscalDb[]; error: any }> {
  let dbNotas: any[] = [];
  let dbError: any = null;

  try {
    const res = await db.from('notas_fiscais').select('*').order('created_at', { ascending: false });
    if (res.data) {
      dbNotas = res.data;
    }
    if (res.error) {
      dbError = res.error;
      // Fallback: se a ordenação por created_at falhar por coluna inexistente, busca sem ordenação
      if (res.error.code === '42703' || res.error.message?.includes('created_at')) {
        const retryRes = await db.from('notas_fiscais').select('*');
        if (retryRes.data) {
          dbNotas = retryRes.data;
          dbError = null;
        }
      }
    }
  } catch (err) {
    dbError = err;
  }

  // Mescla com cache do localStorage para resiliência offline e visualização instantânea
  try {
    const localStr = localStorage.getItem('usicorte_notas_fiscais');
    if (localStr) {
      const localList: any[] = JSON.parse(localStr);
      const seenChaves = new Set(dbNotas.map(n => String(n.chave_acesso || '').trim()));
      const seenNumeros = new Set(dbNotas.map(n => String(n.numero_nfe || '').trim()));

      // 1. Se o localList marcar como CANCELADA, propaga para dbNotas
      dbNotas.forEach(n => {
        const cleanChave = String(n.chave_acesso || '').replace(/\D/g, '');
        const localMatch = localList.find(ln => 
          (cleanChave && String(ln.chave_acesso || '').replace(/\D/g, '') === cleanChave) ||
          (n.numero_nfe && String(ln.numero_nfe) === String(n.numero_nfe))
        );
        if (localMatch && String(localMatch.status).toUpperCase() === 'CANCELADA') {
          n.status = 'CANCELADA';
          if (localMatch.protocolo) n.protocolo = localMatch.protocolo;
          if (localMatch.xml_cancelamento) n.xml_conteudo = localMatch.xml_cancelamento;
        }
        if (cleanChave && typeof window !== 'undefined') {
          if (localStorage.getItem(`usicorte_nfe_status_${cleanChave}`) === 'CANCELADA') {
            n.status = 'CANCELADA';
          }
        }
      });

      // 2. Adiciona notas do localList que não estão em dbNotas
      localList.forEach(ln => {
        const chave = String(ln.chave_acesso || '').trim();
        const num = String(ln.numero_nfe || '').trim();
        if ((chave && !seenChaves.has(chave)) && (!num || !seenNumeros.has(num))) {
          dbNotas.push(ln);
          if (chave) seenChaves.add(chave);
        }
      });
    }
  } catch {}

  // Garante que qualquer nota com flag local ou status cancelada permaneça como CANCELADA
  dbNotas.forEach(n => {
    const cleanKey = String(n.chave_acesso || '').replace(/\D/g, '');
    if (cleanKey && typeof window !== 'undefined') {
      try {
        if (localStorage.getItem(`usicorte_nfe_status_${cleanKey}`) === 'CANCELADA') {
          n.status = 'CANCELADA';
        }
      } catch {}
    }
  });

  // Ordenação decrescente por numero_nfe ou created_at
  dbNotas.sort((a, b) => {
    const numA = Number(a.numero_nfe) || 0;
    const numB = Number(b.numero_nfe) || 0;
    if (numB !== numA) return numB - numA;
    const dateA = new Date(a.created_at || 0).getTime();
    const dateB = new Date(b.created_at || 0).getTime();
    return dateB - dateA;
  });

  return { data: dbNotas, error: dbError };
}


