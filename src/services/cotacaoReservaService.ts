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
async function numeroJaExisteNoBanco(numero: string): Promise<boolean> {
  try {
    const { data, error } = await db.from('cotacoes').select('id').eq('numero', numero).limit(1);
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

async function maiorSequencialDoBanco(prefix: string): Promise<number> {
  // Busca TODOS os números do prefixo e calcula o maior NUMERICAMENTE
  // (ordenar texto falha quando há larguras diferentes, ex: "999" > "001184").
  let maior = 0;
  try {
    const pageSize = 1000;
    for (let from = 0; from < 50000; from += pageSize) {
      const { data, error } = await db
        .from('cotacoes')
        .select('numero')
        .like('numero', `${prefix}%`)
        .range(from, from + pageSize - 1);
      if (error || !data || data.length === 0) break;
      for (const row of data as any[]) {
        const m = String(row?.numero || '').match(/(\d+)$/);
        if (m) maior = Math.max(maior, parseInt(m[1], 10));
      }
      if (data.length < pageSize) break;
    }
  } catch {}
  return maior;
}

/**
 * Garante que o número sugerido é SEMPRE maior que qualquer número já salvo.
 * Mesmo que a RPC/emitente esteja com contador atrasado, pula para maior + 1.
 */
async function garantirNumeroLivre(numero: string): Promise<string> {
  const m = numero.match(/^(.*?)(\d+)$/);
  if (!m) return numero;
  const prefix = m[1];
  const largura = Math.max(6, m[2].length);
  const maiorBanco = await maiorSequencialDoBanco(prefix);
  let seq = Math.max(parseInt(m[2], 10), maiorBanco + 1);
  for (let i = 0; i < 50; i++) {
    const cand = `${prefix}${String(seq).padStart(largura, '0')}`;
    if (!(await numeroJaExisteNoBanco(cand))) {
      if (cand !== numero) console.warn(`[Reserva Cotação] ${numero} ocupado/atrasado. Usando ${cand}.`);
      return cand;
    }
    seq++;
  }
  return `${prefix}${String(seq).padStart(largura, '0')}`;
}

export async function obterProximoNumeroCotacaoAtomics(): Promise<string> {
  const n = await obterProximoNumeroCotacaoBruto();
  return garantirNumeroLivre(n);
}

async function obterProximoNumeroCotacaoBruto(): Promise<string> {
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

/**
 * 4. LIMPEZA DE RASCUNHOS VAZIOS:
 * Remove do banco todos os rascunhos sem itens, liberando os números.
 * Retorna quantos foram removidos.
 */
export async function limparRascunhosVaziosDb(): Promise<{ success: boolean; removidos: number; error?: any }> {
  let removidos = 0;
  try {
    const { data: rascunhos, error } = await db
      .from('cotacoes')
      .select('id, numero, status')
      .in('status', ['rascunho', 'RASCUNHO']);
    if (error) return { success: false, removidos: 0, error };

    for (const r of (rascunhos || []) as any[]) {
      const { data: itens } = await db.from('cotacao_itens').select('id').eq('cotacao_id', r.id).limit(1);
      if (itens && itens.length > 0) continue;
      const { error: delErr } = await db.from('cotacoes').delete().eq('id', r.id);
      if (!delErr) removidos++;
    }
    return { success: true, removidos };
  } catch (e) {
    console.warn('[Reserva Cotação] Erro ao limpar rascunhos vazios:', e);
    return { success: false, removidos, error: e };
  }
}
