import { createClient } from "@supabase/supabase-js";
import { Client, Quote, QuoteItem } from "../types";
import { formatarMedidasLimpa } from "../utils/calculator";

const SUPABASE_URL = (import.meta.env?.VITE_SUPABASE_URL as string) || "https://kyzeiroxvgbkincisrdf.supabase.co";
const SUPABASE_ANON_KEY = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || "sb_publishable_2vCA1d0mEry_9Qy-QREVxA_aaR9IE6z";

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export type StatusCotacao = 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado';

/* ---- helper: só aceita UUID de verdade ---- */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v?: string | null): v is string => !!v && UUID_RE.test(v.trim());

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
  status: 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado' | 'reprovado' | 'cancelado' | 'em_analise' | string;
  observacoes?: string;
  valor_total: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  cotacao_itens?: SupabaseCotacaoItem[];
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
    const { data, error } = await db
      .from('usuarios')
      .select('*')
      .order('nome', { ascending: true });

    if (!error && data && data.length > 0) {
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

    if (error) {
      console.warn("Aviso ao buscar tabela 'usuarios' no Supabase:", error.message);
    }

    // 2. Se a tabela 'usuarios' estiver vazia, tenta semear os usuários padrões nela
    if (!error && (!data || data.length === 0)) {
      try {
        await Promise.all(DEFAULT_USUARIOS_EQUIPE.map(u => 
          db.from('usuarios').upsert({
            nome: u.nome,
            email: u.email,
            senha: u.senha,
            cargo: u.cargo
          }, { onConflict: 'nome' })
        ));
      } catch (e) {}
    }

    // 3. Fallback: Se usuarios deu erro, tenta consultar user_roles
    try {
      const { data: roleData, error: roleError } = await db
        .from('user_roles')
        .select('*');

      if (!roleError && roleData && roleData.length > 0) {
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
    } catch (e) {}

    return DEFAULT_USUARIOS_EQUIPE;
  } catch (err) {
    console.error("Erro ao carregar usuários do Supabase:", err);
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
    let query = db
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.warn("Aviso ao buscar clientes no Supabase:", error.message);
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
  } catch (err) {
    console.error("Erro na conexão Supabase (clientes):", err);
    return [];
  }
}

export async function fetchClienteById(id: string): Promise<Client | null> {
  try {
    if (!id) return null;
    const { data, error } = await db
      .from('clientes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.warn("Erro ao buscar cliente por ID:", error.message);
      return null;
    }

    return data ? mapSupabaseToClient(data) : null;
  } catch (err) {
    console.error("Erro ao buscar cliente por ID:", err);
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

export function mapQuoteStatusToSupabase(status: string): 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado' {
  const st = (status || '').toLowerCase();
  if (st.includes('aprovado') || st.includes('faturado')) return 'aprovado';
  if (st.includes('rejeitado') || st.includes('cancelado')) return 'rejeitado';
  if (st.includes('pendente') || st.includes('enviado')) return 'pendente';
  return 'rascunho';
}

export function mapSupabaseStatusToQuote(status: string): 'Rascunho' | 'Enviado' | 'Aprovado' | 'Faturado' | 'Cancelado' {
  const st = (status || '').toLowerCase();
  if (st === 'aprovado') return 'Aprovado';
  if (st === 'rejeitado') return 'Cancelado';
  if (st === 'pendente') return 'Enviado';
  return 'Rascunho';
}

export async function saveCotacaoDb(quote: Quote): Promise<{ data: any; error: any }> {
  try {
    const cotacaoPayload = {
      numero: quote.quoteNumber,
      data: quote.date || new Date().toISOString().split('T')[0],
      cliente_nome: quote.clientName || 'Cliente Balcão',
      contato: quote.contactPerson || '',
      telefone: quote.clientPhone || '',
      email: quote.clientEmail || '',
      status: mapQuoteStatusToSupabase(quote.status),
      observacoes: quote.observations || '',
      valor_total: quote.grandTotal || quote.subtotalTotal || 0,
      cliente_id: quote.clientId && isUuid(quote.clientId) ? quote.clientId : undefined
    };

    // 1. Busca se a cotação já existe no Supabase (pelo ID direto ou pelo Número)
    let existingRecords: { id: string; numero: string; created_at?: string }[] = [];

    // Prioridade 1: Buscar pelo ID direto (seja UUID ou ID de registro existente)
    if (quote.id) {
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

    const { data, error } = await q;
    if (error) {
      console.warn("Erro ao carregar cotações do Supabase:", error.message);
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
  const payload = { status: statusStr, updated_at: new Date().toISOString() };

  let updateQuery;
  if (targetId) {
    updateQuery = db.from('cotacoes').update(payload).eq('id', targetId);
  } else if (targetNumero) {
    updateQuery = db.from('cotacoes').update(payload).eq('numero', targetNumero);
  } else {
    return { data: null, error: new Error('Sem identificador para atualizar cotação') };
  }

  let { data, error } = await updateQuery;

  // Se houver restrição no banco de dados (ex: constraint de enum aceitando apenas rascunho/pendente/aprovado/rejeitado)
  if (error && (error.message?.includes('check') || error.message?.includes('invalid input') || error.code === '23514')) {
    const fallback = mapQuoteStatusToSupabase(statusStr);
    const fallbackPayload = { status: fallback, updated_at: new Date().toISOString() };
    if (targetId) {
      const retry = await db.from('cotacoes').update(fallbackPayload).eq('id', targetId);
      error = retry.error;
    } else if (targetNumero) {
      const retry = await db.from('cotacoes').update(fallbackPayload).eq('numero', targetNumero);
      error = retry.error;
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

    // 2. Deleta itens filhos da cotação
    if (cotacaoId) {
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

    // 1. Busca nativa pelo campo 'id' (UUID ou texto)
    const { data: dataById, error: errorById } = await db
      .from('cotacoes')
      .select('*, cotacao_itens(*)')
      .eq('id', idOrNumero)
      .maybeSingle();

    if (dataById && !errorById) {
      return dataById as SupabaseCotacao;
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
    const { data, error } = await db
      .from('cotacao_itens')
      .select('*')
      .eq('cotacao_id', cotacaoId)
      .order('ordem', { ascending: true });

    if (error) {
      console.warn("Erro ao buscar itens da cotação:", error.message);
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
