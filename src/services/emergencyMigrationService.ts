import { db, fetchCotacoesDb, saveCotacaoDb } from '../lib/db';
import { Quote, QuoteItem } from '../types';

export interface EmergencyMigrationStatus {
  hasLocalQuotes: boolean;
  totalFound: number;
  migratedCount: number;
  alreadyInDbCount: number;
  failedCount: number;
  isFullyCleaned: boolean;
  message: string;
  errors: string[];
}

/**
 * Normaliza um objeto qualquer de orçamento salvo localmente para a interface Quote
 */
function normalizeLocalQuote(raw: any, fallbackIndex: number): Quote {
  const quoteNumber = String(raw.quoteNumber || raw.numero || raw.id || `COT-${Date.now()}-${fallbackIndex}`).trim();
  const dateStr = raw.date || raw.data || (raw.createdAt ? String(raw.createdAt).split('T')[0] : new Date().toISOString().split('T')[0]);
  
  const rawItems = Array.isArray(raw.items) 
    ? raw.items 
    : (Array.isArray(raw.cotacao_itens) ? raw.cotacao_itens : []);

  const normalizedItems: QuoteItem[] = rawItems.map((it: any, idx: number) => {
    const unitPrice = Number(it.unitPrice || it.valorUnitario || it.valor_unitario || 0);
    const quantity = Number(it.quantity || it.qtd || it.quantidade || 1);
    const subtotal = Number(it.subtotal || it.valorTotal || it.valor_total || (unitPrice * quantity));

    return {
      id: String(it.id || `item-${idx}-${Date.now()}`),
      date: dateStr,
      companyName: raw.clientName || raw.cliente_nome || 'Cliente Balcão',
      description: it.description || it.descricao || it.produto || 'Item de Usinagem / Corte',
      constant: it.constant || '0.00785',
      constantName: it.constantName || it.constanteNome || it.produto || it.material || 'Material',
      material: it.material || it.constantName || it.constanteNome || '',
      measure: it.measure || it.medida || it.medidaFormatada || '',
      diameter: it.diameter || it.diametro || '',
      widthLength: it.widthLength || it.larguraComprimento || '',
      unitPrice,
      quantity,
      subtotal,
      notes: it.notes || it.observacao || it.info || '',
      drawingImage: it.drawingImage || it.fotoDesenho || it.desenho_url || it.desenhoUrl || undefined
    };
  });

  const subtotalTotal = Number(raw.subtotalTotal || raw.subtotal || raw.valor_total || 0) ||
    normalizedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
  const discount = Number(raw.discount || raw.desconto || 0);
  const shipping = Number(raw.shipping || raw.frete || 0);
  const grandTotal = Number(raw.grandTotal || raw.valor_total || raw.totalAmount || (subtotalTotal - discount + shipping));

  let status: Quote['status'] = 'Rascunho';
  const st = String(raw.status || '').toLowerCase();
  if (st.includes('aprovado')) status = 'Aprovado';
  else if (st.includes('faturado')) status = 'Faturado';
  else if (st.includes('cancelado')) status = 'Cancelado';
  else if (st.includes('rejeitado')) status = 'Rejeitado';
  else if (st.includes('enviado') || st.includes('pendente')) status = 'Enviado';

  return {
    id: raw.id ? String(raw.id) : quoteNumber,
    quoteNumber,
    clientId: raw.clientId || raw.cliente_id || undefined,
    clientName: raw.clientName || raw.cliente_nome || 'Cliente Balcão',
    clientDocument: raw.clientDocument || raw.documento || raw.cpf_cnpj || '',
    contactPerson: raw.contactPerson || raw.contato || '',
    clientPhone: raw.clientPhone || raw.telefone || '',
    clientEmail: raw.clientEmail || raw.email || '',
    date: dateStr,
    validityDays: Number(raw.validityDays || raw.dias_validade || 10),
    paymentTerms: raw.paymentTerms || raw.forma_pagamento || 'À Vista',
    status,
    observations: raw.observations || raw.observacoes || '',
    discount,
    shipping,
    subtotalTotal,
    grandTotal,
    items: normalizedItems,
    createdAt: raw.createdAt || raw.created_at || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status_nfe: raw.status_nfe || raw.nfe_status || (raw.nfe_chave ? 'AUTORIZADA' : 'Pendente'),
    nfe_numero: raw.nfe_numero,
    serie_nfe: raw.serie_nfe,
    nfe_chave: raw.nfe_chave || raw.chave_acesso,
    chave_acesso: raw.chave_acesso || raw.nfe_chave,
    protocolo_cancelamento: raw.protocolo_cancelamento,
    xml_cancelamento: raw.xml_cancelamento,
    motivo_cancelamento: raw.motivo_cancelamento
  };
}

/**
 * 1. Leitura do LocalStorage:
 * Verifica se existem orçamentos armazenados na chave 's_orcamentos'.
 */
export function verificarOrcamentosLocaisPendentes(): { exists: boolean; count: number; rawJson: string | null } {
  try {
    const raw = localStorage.getItem('s_orcamentos');
    if (!raw || !raw.trim()) {
      return { exists: false, count: 0, rawJson: null };
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      // Chave vazia ou inválida; limpa com segurança
      localStorage.removeItem('s_orcamentos');
      return { exists: false, count: 0, rawJson: null };
    }
    return { exists: true, count: parsed.length, rawJson: raw };
  } catch (err) {
    console.warn('Aviso ao ler chave local s_orcamentos:', err);
    return { exists: false, count: 0, rawJson: null };
  }
}

/**
 * 2 e 3. Rotina de migração e sincronização de emergência para não perder orçamentos locais:
 * - Lê 's_orcamentos' do localStorage.
 * - Compara com os orçamentos já presentes no Supabase.
 * - Para cada orçamento que ainda não exista no Supabase (ou que precise de sincronização),
 *   executa o INSERT/UPSERT seguro no Supabase.
 * - Somente APÓS confirmar a gravação com sucesso no Supabase, limpa a chave 's_orcamentos'
 *   do localStorage, liberando a cota do navegador e resolvendo o erro QuotaExceededError.
 */
let isMigrationRunning = false;

export async function executarMigracaoEmergenciaOrcamentos(): Promise<EmergencyMigrationStatus> {
  // Evita concorrência de múltiplas execuções simultâneas
  if (isMigrationRunning) {
    return {
      hasLocalQuotes: false,
      totalFound: 0,
      migratedCount: 0,
      alreadyInDbCount: 0,
      failedCount: 0,
      isFullyCleaned: false,
      message: 'Migração de emergência já está em execução.',
      errors: []
    };
  }

  isMigrationRunning = true;

  const result: EmergencyMigrationStatus = {
    hasLocalQuotes: false,
    totalFound: 0,
    migratedCount: 0,
    alreadyInDbCount: 0,
    failedCount: 0,
    isFullyCleaned: false,
    message: '',
    errors: []
  };

  try {
    // 1. Leitura segura do LocalStorage
    const raw = localStorage.getItem('s_orcamentos');
    if (!raw || !raw.trim()) {
      result.isFullyCleaned = true;
      result.message = 'Nenhum orçamento pendente no armazenamento local.';
      return result;
    }

    let parsedQuotes: any[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsedQuotes = parsed;
      }
    } catch (parseError: any) {
      result.errors.push(`Erro ao decodificar JSON local: ${parseError?.message}`);
      console.error('Falha ao decodificar s_orcamentos:', parseError);
      // Se não é JSON válido mas há lixo ocupando espaço, remove com segurança
      try {
        localStorage.removeItem('s_orcamentos');
        result.isFullyCleaned = true;
      } catch {}
      return result;
    }

    if (parsedQuotes.length === 0) {
      try {
        localStorage.removeItem('s_orcamentos');
        result.isFullyCleaned = true;
        result.message = 'Chave local continha array vazio. Limpeza realizada com sucesso.';
      } catch {}
      return result;
    }

    result.hasLocalQuotes = true;
    result.totalFound = parsedQuotes.length;

    // Filtra eventuais resíduos legados inválidos
    const validQuotes = parsedQuotes.filter(q => {
      const idOrNum = String(q.quoteNumber || q.numero || q.id || '');
      return !idOrNum.includes('021935') && !idOrNum.includes('21935');
    });

    // 2. Consulta orçamentos já gravados no Supabase
    const dbQuotes = await fetchCotacoesDb();
    const existingKeys = new Set<string>();

    dbQuotes.forEach(q => {
      if (q.id) existingKeys.add(String(q.id).trim().toLowerCase());
      if (q.numero) existingKeys.add(String(q.numero).trim().toLowerCase());
    });

    const failedQuotesToKeep: any[] = [];

    // Processa sequencialmente cada orçamento local com confirmação de gravação
    for (let i = 0; i < validQuotes.length; i++) {
      const rawQuote = validQuotes[i];
      const qNum = String(rawQuote.quoteNumber || rawQuote.numero || '').trim().toLowerCase();
      const qId = String(rawQuote.id || '').trim().toLowerCase();

      // Verifica se já existe no banco de dados
      const existsInDb = (qNum && existingKeys.has(qNum)) || (qId && existingKeys.has(qId));

      if (existsInDb) {
        result.alreadyInDbCount++;
        // Já existe confirmado no Supabase, portanto não precisa de novo insert
        continue;
      }

      // Normaliza o orçamento para o padrão do Supabase
      const normalizedQuote = normalizeLocalQuote(rawQuote, i);

      try {
        // Envio para o Supabase (INSERT/UPSERT)
        const saveRes = await saveCotacaoDb(normalizedQuote);

        if (saveRes.error) {
          result.failedCount++;
          result.errors.push(`Cotação ${normalizedQuote.quoteNumber}: ${saveRes.error.message || 'Falha de gravação'}`);
          console.error(`Erro ao migrar cotação ${normalizedQuote.quoteNumber} para o Supabase:`, saveRes.error);
          failedQuotesToKeep.push(rawQuote);
        } else {
          // Gravação confirmada com sucesso no Supabase!
          result.migratedCount++;
          if (normalizedQuote.quoteNumber) existingKeys.add(normalizedQuote.quoteNumber.trim().toLowerCase());
          if (saveRes.data?.id) existingKeys.add(String(saveRes.data.id).trim().toLowerCase());
        }
      } catch (err: any) {
        result.failedCount++;
        result.errors.push(`Exceção na cotação ${normalizedQuote.quoteNumber}: ${err?.message || 'Erro inesperado'}`);
        console.error(`Exceção ao salvar cotação ${normalizedQuote.quoteNumber}:`, err);
        failedQuotesToKeep.push(rawQuote);
      }
    }

    // 3. Limpeza Segura:
    // Somente APÓS confirmar a gravação com sucesso no Supabase, limpe a chave 's_orcamentos'
    // do localStorage para liberar o limite do navegador e resolver o erro QuotaExceededError.
    if (failedQuotesToKeep.length === 0) {
      try {
        localStorage.removeItem('s_orcamentos');
        result.isFullyCleaned = true;
      } catch (cleanErr) {
        console.warn('Aviso ao remover s_orcamentos após sincronização:', cleanErr);
      }
    } else {
      // Se alguma cotação falhou na gravação (ex: queda momentânea de conexão),
      // mantém no localStorage APENAS as que falharam, para não perder nenhum orçamento!
      try {
        localStorage.setItem('s_orcamentos', JSON.stringify(failedQuotesToKeep));
        result.isFullyCleaned = false;
      } catch (quotaErr) {
        console.warn('QuotaExceeded ao reescrever pendências locais:', quotaErr);
      }
    }

    // Monta mensagem de retorno amigável
    if (result.migratedCount > 0) {
      result.message = `Sincronização de Emergência concluída: ${result.migratedCount} orçamento(s) migrado(s) com sucesso para o banco de dados. Armazenamento local liberado!`;
    } else if (result.alreadyInDbCount > 0 && result.isFullyCleaned) {
      result.message = `Todos os ${result.alreadyInDbCount} orçamentos já estavam seguros no banco de dados. Chave local liberada.`;
    } else if (result.failedCount > 0) {
      result.message = `${result.failedCount} orçamento(s) falharam na migração e foram preservados no dispositivo para nova tentativa.`;
    } else {
      result.message = 'Nenhum orçamento necessitou de migração.';
    }

    // Notifica os componentes da aplicação caso haja cotações migradas
    if (result.migratedCount > 0 || (result.totalFound > 0 && result.isFullyCleaned)) {
      try {
        window.dispatchEvent(
          new CustomEvent('cotacoes_migradas_emergencia', {
            detail: {
              migratedCount: result.migratedCount,
              totalFound: result.totalFound,
              isCleaned: result.isFullyCleaned
            }
          })
        );
      } catch {}
    }

    return result;
  } finally {
    isMigrationRunning = false;
  }
}
