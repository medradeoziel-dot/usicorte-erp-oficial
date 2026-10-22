import { db, isUuid, deleteCotacaoDb, invalidateCotacoesCache } from '../lib/db';
import { resolveNextUniqueQuoteNumber, updateEmitenteNextSequential, fetchEmitenteNumberingConfig } from './companyService';

export interface CotacaoReservaResultado {
  id: string; // UUID do registro oficial criado no Supabase
  numero: string; // Número único reservado (ex: COT-2026-000990)
  data: string;
  status: 'RASCUNHO' | 'rascunho';
  success: boolean;
  isFallbackLocal?: boolean;
}

/**
 * 1. OBTENÇÃO DA PRÓXIMA NUMERAÇÃO SEQUENCIAL OFICIAL:
 * Consulta a sequência oficial na tabela 'emitente' e valida contra os números reais
 * já cadastrados na tabela 'cotacoes' para garantir um sequencial estrito (ex: COT-2026-000990).
 * NUNCA embutir timestamps ou ano duplicado dentro do número sequencial.
 */
export async function obterProximoNumeroCotacaoAtomics(): Promise<string> {
  // 1. Consulta prioritária através do resolveNextUniqueQuoteNumber (autoridade oficial)
  try {
    const res = await resolveNextUniqueQuoteNumber();
    if (res?.quoteNumber) {
      console.log('[Reserva Cotação] Próxima numeração sequencial calculada com sucesso:', res.quoteNumber);
      return res.quoteNumber;
    }
  } catch (err) {
    console.warn('[Reserva Cotação] Aviso ao resolver numeração via emitente/cotacoes:', err);
  }

  // 2. Fallback de contingência local seguro baseado no sequencial emitente (sem timestamp aleatório)
  try {
    const config = await fetchEmitenteNumberingConfig();
    const prefix = config.prefix || 'COT-2026-';
    const seq = config.nextSequential || 990;
    return `${prefix}${String(seq).padStart(6, '0')}`;
  } catch {
    return `COT-2026-000990`;
  }
}

/**
 * 2. RESERVA EXPLÍCITA DE COTAÇÃO NO SUPABASE:
 * Chamada EXCLUSIVAMENTE mediante ação do usuário (ao clicar em 'Nova Cotação' ou ao preencher dados):
 * - Obtém o próximo número sequencial oficial
 * - Grava um registro inicial no Supabase com status 'rascunho'
 * - Atualiza o próximo sequencial na tabela emitente (+1) para evitar colisões
 */
export async function reservarNovaCotacaoNoSupabase(
  currentUser?: string
): Promise<CotacaoReservaResultado> {
  const maxTentativas = 5;

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    const proximoNumero = await obterProximoNumeroCotacaoAtomics();
    const hoje = new Date().toISOString().split('T')[0];

    // Payload de reserva inicial explícita no banco
    const payloadBase: Record<string, any> = {
      numero: proximoNumero,
      data: hoje,
      cliente_nome: 'Rascunho em Edição',
      status: 'rascunho',
      situacao: 'RASCUNHO',
      valor_total: 0,
      observacoes: 'Reserva explícita criada pelo operador.',
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

      // 3. Se foi inserido com sucesso, atualiza o próximo sequencial no emitente e retorna
      if (!res.error && res.data?.id) {
        console.log(`[Reserva Cotação] SUCESSO: Cotação ${proximoNumero} reservada no Supabase! ID=${res.data.id}`);
        
        // Atualiza a tabela emitente com o próximo número
        const match = proximoNumero.match(/(\d+)$/);
        if (match) {
          const currentNum = parseInt(match[1], 10);
          updateEmitenteNextSequential(currentNum + 1).catch(() => {});
        }

        return {
          id: String(res.data.id),
          numero: String(res.data.numero || proximoNumero),
          data: hoje,
          status: 'rascunho',
          success: true
        };
      }

      // 4. Se erro de chave duplicada (concorrência): tenta o próximo
      if (res.error && (res.error.code === '23505' || res.error.message?.includes('duplicate key') || res.error.message?.includes('unique'))) {
        console.warn(`[Reserva Cotação] Número ${proximoNumero} já ocupado no banco. Avançando sequencial...`);
        continue;
      }

      console.warn('[Reserva Cotação] Erro retornado ao inserir reserva:', res.error);
    } catch (err) {
      console.warn(`[Reserva Cotação] Exceção na tentativa ${tentativa}:`, err);
    }
  }

  // Fallback local caso o banco esteja inacessível
  const fallbackNum = await obterProximoNumeroCotacaoAtomics();
  const fallbackId = `TEMP-LOCAL-${Date.now()}`;
  return {
    id: fallbackId,
    numero: fallbackNum,
    data: new Date().toISOString().split('T')[0],
    status: 'rascunho',
    success: false,
    isFallbackLocal: true
  };
}

/**
 * 3. CANCELAMENTO / DESCARTE DE RASCUNHO:
 * Descarta o rascunho com soft delete marcando como 'CANCELADO' / 'rejeitado'
 */
export async function cancelarOuDescartarRascunho(
  cotacaoId: string,
  cotacaoNumero?: string
): Promise<{ success: boolean; error?: any }> {
  if (!cotacaoId) return { success: true };

  try {
    const res = await deleteCotacaoDb(cotacaoId);
    return { success: !res.error, error: res.error };
  } catch (e) {
    console.warn('[Reserva Cotação] Erro ao descartar rascunho:', e);
    return { success: false, error: e };
  }
}

/**
 * 4. ROTINA DE LIMPEZA DE RASCUNHOS VAZIOS:
 * Localiza e apaga/inativa todos os rascunhos vazios ("Rascunho em Edição" sem itens)
 * e códigos errôneos (como 202620, 202600), e recalcula o sequencial correto.
 */
export async function limparRascunhosVaziosDb(): Promise<{
  success: boolean;
  purgedCount: number;
  nextQuoteNumber?: string;
  error?: any;
}> {
  try {
    // 1. Busca todos os rascunhos vazios acumulados
    const { data: drafts, error } = await db
      .from('cotacoes')
      .select('id, numero, cliente_nome, status, situacao, cotacao_itens(id)')
      .or("cliente_nome.eq.Rascunho em Edição,cliente_nome.ilike.%Rascunho Machine%,numero.like.%202620%,numero.like.%202600%");

    if (error) {
      console.warn('Erro ao consultar rascunhos para limpeza:', error);
      return { success: false, purgedCount: 0, error };
    }

    if (!drafts || drafts.length === 0) {
      const nextRes = await resolveNextUniqueQuoteNumber();
      return { success: true, purgedCount: 0, nextQuoteNumber: nextRes?.quoteNumber };
    }

    // Filtra apenas registros sem itens ou marcados como Rascunho em Edição
    const emptyDrafts = drafts.filter((d: any) => {
      const semItens = !d.cotacao_itens || d.cotacao_itens.length === 0;
      const isNomeRascunho = d.cliente_nome === 'Rascunho em Edição' || String(d.cliente_nome || '').toLowerCase().includes('rascunho machine');
      const isNumeroErrado = String(d.numero || '').includes('202620') || String(d.numero || '').includes('202600');
      return (isNomeRascunho || isNumeroErrado) && semItens;
    });

    const ids = emptyDrafts.map((d: any) => d.id);
    const agoraIso = new Date().toISOString();

    let cleanedCount = 0;
    if (ids.length > 0) {
      // Aplica exclusão lógica (soft delete) em lotes
      for (let i = 0; i < ids.length; i += 40) {
        const chunk = ids.slice(i, i + 40);
        const { error: updErr, data } = await db
          .from('cotacoes')
          .update({
            deletado_em: agoraIso,
            status: 'rejeitado',
            situacao: 'CANCELADO'
          })
          .in('id', chunk)
          .select('id');

        if (!updErr) {
          cleanedCount += data?.length || chunk.length;
        }
      }

      // Tenta também exclusão física direta (se o banco permitir)
      try {
        await db.from('cotacoes').delete().in('id', ids.slice(0, 100));
      } catch {}
    }

    // 2. Invalida cache de cotações
    invalidateCotacoesCache();

    // 3. Recalcula o sequencial correto oficial
    const nextRes = await resolveNextUniqueQuoteNumber();
    if (nextRes?.sequential) {
      await updateEmitenteNextSequential(nextRes.sequential);
    }

    console.log(`[Limpeza de Rascunhos] Limpeza concluída: ${cleanedCount} rascunhos inativados. Próximo sequencial: ${nextRes?.quoteNumber}`);

    return {
      success: true,
      purgedCount: cleanedCount,
      nextQuoteNumber: nextRes?.quoteNumber
    };
  } catch (err: any) {
    console.error('Erro geral na rotina de limpeza de rascunhos:', err);
    return { success: false, purgedCount: 0, error: err };
  }
}

