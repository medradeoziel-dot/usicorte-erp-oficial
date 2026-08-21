import { createClient } from "@supabase/supabase-js";
import { Client, Quote, QuoteItem } from "../types";

const URL = "https://qdhkrhkmfbichbronyxt.supabase.co";
const KEY = "sb_publishable_KcO_a5doEprHC607uoXxuA_7iLP9wUA"; // chave pública, pode ficar no código

export const db = createClient(URL, KEY);

export type StatusCotacao = 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado';

export interface SupabaseCliente {
  id?: string;
  nome: string;
  empresa?: string;
  contato?: string;
  telefone?: string;
  email?: string;
  documento?: string;
  endereco?: string;
  observacoes?: string;
  created_by?: string;
  created_at?: string;
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
  status: 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado';
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

/* =========================================================================
   2. CLIENTES (TABELA: clientes)
   ========================================================================= */

export function mapSupabaseToClient(c: SupabaseCliente): Client {
  const isCnpj = (c.documento || '').replace(/\D/g, '').length > 11;
  return {
    id: c.id || String(Date.now()),
    type: isCnpj ? 'CNPJ' : 'CPF',
    document: c.documento || '',
    name: c.nome || c.empresa || 'Cliente sem nome',
    fantasyName: c.empresa || '',
    contactPerson: c.contato || '',
    phone: c.telefone || '',
    email: c.email || '',
    cep: '',
    street: c.endereco || '',
    neighborhood: '',
    city: '',
    state: '',
    situation: 'Ativa',
    enabled: true,
    registrationDate: c.created_at ? new Date(c.created_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')
  };
}

export function mapClientToSupabase(c: Client): Partial<SupabaseCliente> {
  const fullAddress = [c.street, c.neighborhood, c.city, c.state, c.cep].filter(Boolean).join(', ');
  const payload: Partial<SupabaseCliente> = {
    nome: c.name,
    empresa: c.fantasyName || c.name,
    contato: c.contactPerson || '',
    telefone: c.phone || '',
    email: c.email || '',
    documento: c.document || '',
    endereco: fullAddress || c.street || '',
    observacoes: ''
  };

  if (c.id && !c.id.startsWith('seed-') && !c.id.startsWith('temp-') && isNaN(Number(c.id))) {
    // Only pass id if it looks like a valid UUID or existing DB id
    payload.id = c.id;
  }

  return payload;
}

export async function fetchClientesDb(): Promise<Client[]> {
  try {
    const { data, error } = await db
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });

    if (error) {
      console.warn("Aviso ao buscar clientes no Supabase:", error.message);
      return [];
    }

    if (data && data.length > 0) {
      return data.map(mapSupabaseToClient);
    }
    return [];
  } catch (err) {
    console.error("Erro na conexão Supabase (clientes):", err);
    return [];
  }
}

export async function saveClienteDb(client: Client): Promise<{ data: Client | null; error: any }> {
  try {
    const supabasePayload = mapClientToSupabase(client);
    
    // Se o cliente tem ID válido no DB
    if (client.id && isNaN(Number(client.id)) && client.id.length > 15) {
      const { data, error } = await db
        .from('clientes')
        .update(supabasePayload)
        .eq('id', client.id)
        .select()
        .single();

      if (error) return { data: null, error };
      return { data: mapSupabaseToClient(data), error: null };
    } else {
      // Inserção de novo
      const { data, error } = await db
        .from('clientes')
        .insert(supabasePayload)
        .select()
        .single();

      if (error) return { data: null, error };
      return { data: mapSupabaseToClient(data), error: null };
    }
  } catch (err) {
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
      cliente_id: quote.clientId && isNaN(Number(quote.clientId)) ? quote.clientId : undefined
    };

    // 1. Tenta buscar cotação existente pelo número
    let cotacaoId: string | undefined = undefined;
    const { data: existing } = await db
      .from('cotacoes')
      .select('id')
      .eq('numero', quote.quoteNumber)
      .maybeSingle();

    if (existing?.id) {
      cotacaoId = existing.id;
      const { error: updateErr } = await db
        .from('cotacoes')
        .update(cotacaoPayload)
        .eq('id', cotacaoId);
      if (updateErr) return { data: null, error: updateErr };

      // Limpa itens antigos para reinserir os atualizados
      await db.from('cotacao_itens').delete().eq('cotacao_id', cotacaoId);
    } else {
      const { data: created, error: insertErr } = await db
        .from('cotacoes')
        .insert(cotacaoPayload)
        .select()
        .single();

      if (insertErr) return { data: null, error: insertErr };
      cotacaoId = created.id;
    }

    // 2. Insere itens
    if (cotacaoId && quote.items && quote.items.length > 0) {
      const itensPayload = quote.items.map((it, idx) => ({
        cotacao_id: cotacaoId,
        ordem: idx,
        produto: it.constantName || it.constanteNome || it.material || 'MATERIAL',
        material: it.material || it.constantName || '',
        medida: it.measure || (it.widthLength ? `${it.diameter || ''} x ${it.widthLength}` : it.diameter || ''),
        descricao: it.description || it.descricao || 'Item industrial',
        observacao: it.notes || it.observacao || it.info || '',
        quantidade: it.quantity || it.qtd || 1,
        valor_unitario: it.unitPrice || it.valorUnitario || 0,
        valor_total: it.subtotal || ((it.unitPrice || 0) * (it.quantity || 1)),
        desenho_url: it.drawingImage || it.fotoDesenho || '',
        cortado: false
      }));

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

    return (data as SupabaseCotacao[]) || [];
  } catch (err) {
    console.error("Erro na busca de cotações:", err);
    return [];
  }
}

export async function updateCotacaoStatusDb(cotacaoId: string, status: 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado') {
  return await db
    .from('cotacoes')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', cotacaoId);
}

export async function updateItemCortadoDb(itemId: string | number, cortado: boolean) {
  return await db
    .from('cotacao_itens')
    .update({ cortado, updated_at: new Date().toISOString() })
    .eq('id', itemId);
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
