import { db, isUuid, deleteCotacaoDb } from '../lib/db';
import { resolveNextUniqueQuoteNumber } from './companyService';

export interface CotacaoReservaResultado {
  id: string; // UUID do registro oficial criado no Supabase
  numero: string; // Número único reservado (ex: #1051 ou COT-2026-000151)
  data: string;
  status: 'RASCUNHO' | 'rascunho';
  success: boolean;
  isFallbackLocal?: boolean;
}

/**
 * 1. Chama a função SQL `supabase.rpc('gerar_proximo_numero_cotacao')` para obter o novo número atômico.
 * Caso a RPC não esteja instalada no Supabase ou retorne erro, utiliza o cálculo seguro consultando o banco diretamente.
 */
export async function obterProximoNumeroCotacaoAtomics(): Promise<string> {
  // 1. Tenta chamar a RPC oficial no Supabase conforme solicitado
  try {
    const { data, error } = await db.rpc('gerar_proximo_numero_cotacao');
    if (!error && data !== null && data !== undefined) {
      let numStr = '';
      if (typeof data === 'number') {
        const ano = new Date().getFullYear();
        numStr = `COT-${ano}-${String(data).padStart(6, '0')}`;
      } else if (typeof data === 'string') {
        const trimmed = data.trim();
        if (/^\d+$/.test(trimmed)) {
          const ano = new Date().getFullYear();
          numStr = `COT-${ano}-${trimmed.padStart(6, '0')}`;
        } else {
          numStr = trimmed;
        }
      } else if (typeof data === 'object' && data !== null) {
        const raw = (data as any).numero || 
                    (data as any).numero_cotacao || 
                    (data as any).proximo_numero || 
                    (data as any).proximoNumero || 
                    Object.values(data)[0] || '';
        if (typeof raw === 'number') {
          const ano = new Date().getFullYear();
          numStr = `COT-${ano}-${String(raw).padStart(6, '0')}`;
        } else {
          const trimmed = String(raw).trim();
          if (/^\d+$/.test(trimmed)) {
            const ano = new Date().getFullYear();
            numStr = `COT-${ano}-${trimmed.padStart(6, '0')}`;
          } else {
            numStr = trimmed;
          }
        }
      }
      if (numStr) {
        console.log('[Reserva Cotação] Número gerado atomicamente via RPC gerar_proximo_numero_cotacao:', numStr);
        return numStr;
      }
    } else if (error) {
      console.warn('[Reserva Cotação] RPC gerar_proximo_numero_cotacao:', error.message || error);
    }
  } catch (err) {
    console.warn('[Reserva Cotação] Exceção ao chamar RPC gerar_proximo_numero_cotacao:', err);
  }

  // 2. Fallback resiliente: Cálculo sequencial atômico consultando 'cotacoes' e 'emitente'
  try {
    const res = await resolveNextUniqueQuoteNumber();
    if (res?.quoteNumber) {
      console.log('[Reserva Cotação] Número sequencial atômico calculado via cotacoes/emitente:', res.quoteNumber);
      return res.quoteNumber;
    }
  } catch (err) {
    console.warn('[Reserva Cotação] Fallback resolveNextUniqueQuoteNumber falhou:', err);
  }

  // 3. Fallback de emergência caso offline
  const ano = new Date().getFullYear();
  return `COT-${ano}-${String(Date.now()).slice(-6)}`;
}

/**
 * 2. RESERVA IMEDIATA NO SUPABASE (RASCUNHO AUTOMÁTICO):
 * Assim que o usuário clica em "Nova Cotação" ou abre a tela:
 * - Chama a função SQL atômica `gerar_proximo_numero_cotacao`
 * - Insere imediatamente um registro inicial no Supabase com status: 'RASCUNHO' gravando o numero_cotacao
 * - O segundo computador que abrir a tela verá o número já ocupado e pulará para o próximo (+1).
 */
export async function reservarNovaCotacaoNoSupabase(
  currentUser?: string
): Promise<CotacaoReservaResultado> {
  const maxTentativas = 5;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    const proximoNumero = await obterProximoNumeroCotacaoAtomics();
    const hoje = new Date().toISOString().split('T')[0];

    // Payload de reserva inicial imediata no banco
    const payloadBase: Record<string, any> = {
      numero: proximoNumero,
      data: hoje,
      cliente_nome: 'Rascunho em Edição',
      status: 'rascunho',
      situacao: 'RASCUNHO',
      valor_total: 0,
      observacoes: 'Reserva automática imediata contra concorrência simultânea.',
      created_by: currentUser || undefined
    };

    try {
      // 1. Tenta INSERT direto na tabela 'cotacoes'
      let res = await db
        .from('cotacoes')
        .insert([payloadBase])
        .select('id, numero, status, created_at')
        .single();

      // 2. Se falhar por constraint de status uppercase, tenta com 'RASCUNHO'
      if (res.error && (res.error.message?.toLowerCase().includes('status') || res.error.message?.toLowerCase().includes('check'))) {
        const payloadUpper = { ...payloadBase, status: 'RASCUNHO' };
        res = await db
          .from('cotacoes')
          .insert([payloadUpper])
          .select('id, numero, status, created_at')
          .single();
      }

      // 3. Se foi inserido com sucesso, retorna os dados da reserva garantida
      if (!res.error && res.data?.id) {
        console.log(`[Reserva Cotação] SUCESSO: Cotação ${proximoNumero} reservada no Supabase! ID=${res.data.id}, status=${res.data.status}`);
        return {
          id: String(res.data.id),
          numero: String(res.data.numero || proximoNumero),
          data: hoje,
          status: 'rascunho',
          success: true
        };
      }

      // 4. Se erro de chave duplicada (outro computador reservou exatamente no mesmo instante):
      if (res.error && (res.error.code === '23505' || res.error.message?.includes('duplicate key') || res.error.message?.includes('unique'))) {
        console.warn(`[Reserva Cotação] Conflito concorrente detectado no número ${proximoNumero} (tentativa ${tentativa}/${maxTentativas}). Buscando próximo número...`);
        continue;
      }

      console.warn('[Reserva Cotação] Supabase retornou erro ao reservar:', res.error);
    } catch (err) {
      console.warn(`[Reserva Cotação] Exceção na tentativa ${tentativa}:`, err);
    }
  }

  // Fallback local se o banco estiver totalmente offline
  const fallbackNum = await obterProximoNumeroCotacaoAtomics();
  const fallbackId = `TEMP-LOCAL-${Date.now()}`;
  console.warn('[Reserva Cotação] Usando fallback local provisório:', fallbackId);
  return {
    id: fallbackId,
    numero: fallbackNum,
    data: new Date().toISOString().split('T')[0],
    status: 'RASCUNHO',
    success: false,
    isFallbackLocal: true
  };
}

/**
 * 3. CANCELAMENTO / DESCARTE DE RASCUNHO:
 * Caso o operador cancele ou feche a tela sem adicionar nenhum item:
 * - Apaga fisicamente o rascunho vazio do Supabase para NÃO consumir o número de sequência desnecessariamente.
 * - Caso já contenha itens, aplica soft delete marcando como 'CANCELADO'.
 */
export async function cancelarOuDescartarRascunho(
  cotacaoId: string,
  cotacaoNumero?: string
): Promise<{ success: boolean; error?: any }> {
  if (!cotacaoId) return { success: true };

  try {
    // 1. Verifica se a cotação possui itens cadastrados
    let temItens = false;
    try {
      let qItens = db.from('cotacao_itens').select('id');
      if (isUuid(cotacaoId)) {
        qItens = qItens.eq('cotacao_id', cotacaoId);
      } else {
        const numToMatch = cotacaoNumero || cotacaoId;
        qItens = qItens.or(`cotacao_id.eq.${cotacaoId},cotacao_id.eq.${numToMatch}`);
      }
      const { data: itens } = await qItens;
      if (itens && itens.length > 0) {
        temItens = true;
      }
    } catch {}

    // 2. Se for um rascunho vazio SEM itens, remove fisicamente do banco para liberar o número
    if (!temItens) {
      let delQuery = db.from('cotacoes').delete();
      if (isUuid(cotacaoId)) {
        delQuery = delQuery.eq('id', cotacaoId);
      } else {
        const numToMatch = cotacaoNumero || cotacaoId;
        delQuery = delQuery.or(`id.eq.${cotacaoId},numero.eq.${numToMatch}`);
      }
      const { error: delErr } = await delQuery;

      if (!delErr) {
        console.log(`[Reserva Cotação] Rascunho vazio ${cotacaoId} (${cotacaoNumero || ''}) excluído do Supabase. Sequência preservada!`);
        return { success: true };
      }
    }

    // 3. Se possuía itens ou delete direto falhou, aplica soft delete
    const res = await deleteCotacaoDb(cotacaoId);
    return { success: !res.error, error: res.error };
  } catch (e) {
    console.warn('[Reserva Cotação] Erro ao descartar rascunho:', e);
    return { success: false, error: e };
  }
}
