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
  nome: string;
  empresa?: string;
  contato?: string;
  telefone?: string;
  "e-mail"?: string;        // coluna real tem hífen
  email?: string;
  documento?: string;
  endereco?: string;
  "observações"?: string;   // coluna real tem acento
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

export function mapSupabaseToClient(c: any): Client {
  const isCnpj = (c.documento || '').replace(/\D/g, '').length > 11;
  return {
    id: c.id || String(Date.now()),
    type: isCnpj ? 'CNPJ' : 'CPF',
    document: c.documento || '',
    name: c.nome || c.empresa || 'Cliente sem nome',
    fantasyName: c.empresa || '',
    contactPerson: c.contato || '',
    phone: c.telefone || '',
    email: c.email || c['e-mail'] || '',
    cep: '',
    street: c.endereco || '',
    neighborhood: '',
    city: '',
    state: '',
    situation: 'Ativa',
    enabled: true,
    registrationDate: c.criado_em || c.created_at
      ? new Date(c.criado_em || c.created_at).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR'),
  };
}

export function mapClientToSupabase(c: any): Record<string, any> {
  // Retorna payload limpo contendo apenas as colunas válidas da tabela
  return {
    nome: c.nome || c.name || c.razao_social || c.companyName || '',
    empresa: c.empresa || c.fantasyName || c.name || '',
    contato: c.contato || c.contactPerson || '',
    telefone: c.telefone || c.phone || '',
    email: c.email || c['e-mail'] || ''
  };
}

export async function fetchClientesDb(searchQuery?: string): Promise<Client[]> {
  try {
    let query = db
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });

    if (searchQuery && searchQuery.trim()) {
      const cleanTerm = searchQuery.trim();
      query = query.or(
        `nome.ilike.%${cleanTerm}%,empresa.ilike.%${cleanTerm}%,documento.ilike.%${cleanTerm}%,email.ilike.%${cleanTerm}%`
      );
    }

    const { data, error } = await query;

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
    const payload = {
      nome: client.nome || client.name || client.razao_social || '',
      empresa: client.empresa || client.fantasyName || '',
      contato: client.contato || client.contactPerson || '',
      telefone: client.telefone || client.phone || '',
      email: client.email || ''
    };

    if (isUuid(client.id)) {
      const { data, error } = await db
        .from('clientes')
        .update(payload)
        .eq('id', client.id)
        .select()
        .single();
      if (error) { console.error('UPDATE clientes falhou:', error); return { data: null, error }; }
      return { data: mapSupabaseToClient(data), error: null };
    }

    // Ao criar um NOVO cliente: sem propriedade 'id', o Supabase gera o UUID automaticamente
    const { data, error } = await db
      .from('clientes')
      .insert(payload)
      .select()
      .single();
    if (error) { console.error('INSERT clientes falhou:', error); return { data: null, error }; }
    return { data: mapSupabaseToClient(data), error: null };
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
      cliente_id: quote.clientId && isUuid(quote.clientId) ? quote.clientId : undefined
    };

    // 1. Busca TODAS as cotações existentes com o mesmo número ou mesmo ID no Supabase
    let existingRecords: { id: string; numero: string; created_at?: string }[] = [];
    if (quote.quoteNumber && quote.quoteNumber.trim()) {
      const { data } = await db
        .from('cotacoes')
        .select('id, numero, created_at')
        .eq('numero', quote.quoteNumber.trim());
      if (data && data.length > 0) existingRecords = data;
    }

    if (existingRecords.length === 0 && quote.id && isUuid(quote.id)) {
      const { data } = await db
        .from('cotacoes')
        .select('id, numero, created_at')
        .eq('id', quote.id);
      if (data && data.length > 0) existingRecords = data;
    }

    let cotacaoId: string | undefined = undefined;

    if (existingRecords.length > 0) {
      // Usa o primeiro registro como principal
      cotacaoId = existingRecords[0].id;

      // Se existiam duplicatas antigas com o mesmo número, remove os itens e registros extras
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

      // Atualiza a cotação principal (UPDATE)
      const { error: updateErr } = await db
        .from('cotacoes')
        .update(cotacaoPayload)
        .eq('id', cotacaoId);

      if (updateErr) {
        console.error('UPDATE cotacoes falhou:', updateErr);
        return { data: null, error: updateErr };
      }

      // Limpa TODOS os itens antigos associados a essa cotação para garantir que não haja duplicatas
      const { error: delItensErr } = await db
        .from('cotacao_itens')
        .delete()
        .eq('cotacao_id', cotacaoId);

      if (delItensErr) {
        console.warn("Aviso ao limpar itens antigos da cotação:", delItensErr);
      }
    } else {
      // Insere nova cotação (INSERT)
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
