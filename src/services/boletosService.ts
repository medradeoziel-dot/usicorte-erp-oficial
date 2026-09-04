import { ContaReceberParcela, LancamentoFinanceiro } from '../types';
export type { ContaReceberParcela, LancamentoFinanceiro };
import { db } from '../lib/db';
import { saveLancamentoFinanceiroDb, fetchLancamentosFinanceirosDb } from './inventoryFinanceService';

const LOCAL_STORAGE_KEY = 'usicorte_boletos_contas_receber';

// Cache em memória
let cacheBoletos: ContaReceberParcela[] = [];

// Helper para obter a data atual local no formato YYYY-MM-DD
export function getDataHojeIso(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(hoje.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Formata data ISO (YYYY-MM-DD) para pt-BR (DD/MM/YYYY)
export function formatDataPtBr(dateStr?: string): string {
  if (!dateStr) return '-';
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// Formata moeda R$
export function formatCurrencyPtBr(val: number): string {
  return (Number(val) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  });
}

// Boletos iniciais de demonstração vinculados a prazos e vencimento de hoje
export const INITIAL_BOLETOS: ContaReceberParcela[] = [
  {
    id: 'bol-demo-001',
    clienteNome: 'METALÚRGICA ALFA LTDA',
    cotacaoNumero: '21940',
    numeroParcela: 1,
    totalParcelas: 2,
    valorParcela: 3850.00,
    dataVencimento: getDataHojeIso(), // Vence Hoje!
    dataEmissao: getDataHojeIso(),
    status: 'Pendente',
    formaPagamento: 'Boleto',
    banco: 'Banco Itaú',
    nossoNumero: '34191.78201 01234.567890',
    observacoes: 'Parcela 1 de 2 - Faturamento Cotação 21940'
  },
  {
    id: 'bol-demo-002',
    clienteNome: 'CALDEIRARIA SÃO PAULO',
    cotacaoNumero: '21938',
    numeroParcela: 1,
    totalParcelas: 1,
    valorParcela: 1980.50,
    dataVencimento: getDataHojeIso(), // Vence Hoje!
    dataEmissao: getDataHojeIso(),
    status: 'Pendente',
    formaPagamento: 'Boleto',
    banco: 'Banco Bradesco',
    nossoNumero: '23793.38120 40123.891234',
    observacoes: 'À Vista 30 dias - Cotação 21938'
  },
  {
    id: 'bol-demo-003',
    clienteNome: 'METALÚRGICA ALFA LTDA',
    cotacaoNumero: '21940',
    numeroParcela: 2,
    totalParcelas: 2,
    valorParcela: 3850.00,
    dataVencimento: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })(),
    dataEmissao: getDataHojeIso(),
    status: 'Pendente',
    formaPagamento: 'Boleto',
    banco: 'Banco Itaú',
    nossoNumero: '34191.78202 01234.567891',
    observacoes: 'Parcela 2 de 2 - Faturamento Cotação 21940'
  },
  {
    id: 'bol-demo-004',
    clienteNome: 'ESTRUTURAS METÁLICAS PROGRESSO',
    cotacaoNumero: '21935',
    numeroParcela: 1,
    totalParcelas: 3,
    valorParcela: 4200.00,
    dataVencimento: getDataHojeIso(),
    dataEmissao: getDataHojeIso(),
    dataPagamento: getDataHojeIso(),
    status: 'Baixado',
    formaPagamento: 'Boleto',
    banco: 'Santander',
    nossoNumero: '03399.11223 44556.778899',
    observacoes: 'Parcela 1 de 3 - Baixada com sucesso'
  }
];

// Helper para ler do localStorage
function loadLocalBoletos(): ContaReceberParcela[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Erro ao carregar boletos do localStorage:', e);
  }
  return INITIAL_BOLETOS;
}

// Helper para salvar no localStorage
function saveLocalBoletos(boletos: ContaReceberParcela[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(boletos));
  } catch (e) {
    console.warn('Erro ao salvar boletos no localStorage:', e);
  }
}

// Mapeador para Supabase
function mapBoletoToSupabase(b: ContaReceberParcela): Record<string, any> {
  return {
    id: b.id,
    cliente_id: b.clienteId || null,
    cliente_nome: b.clienteNome,
    cotacao_id: b.cotacaoId || null,
    cotacao_numero: b.cotacaoNumero,
    numero_parcela: b.numeroParcela,
    total_parcelas: b.totalParcelas,
    valor_parcela: b.valorParcela,
    data_vencimento: b.dataVencimento,
    data_emissao: b.dataEmissao,
    data_pagamento: b.dataPagamento || null,
    status: b.status,
    forma_pagamento: b.formaPagamento || 'Boleto',
    banco: b.banco || 'Banco Itaú',
    codigo_barras: b.codigoBarras || '',
    nosso_numero: b.nossoNumero || '',
    observacoes: b.observacoes || '',
    lancamento_id: b.lancamentoId || null,
    updated_at: new Date().toISOString()
  };
}

// Mapeador do Supabase para o modelo de aplicação
function mapSupabaseToBoleto(row: any): ContaReceberParcela {
  return {
    id: row.id || `bol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    clienteId: row.cliente_id || row.clienteId || undefined,
    clienteNome: row.cliente_nome || row.clienteNome || 'Cliente',
    cotacaoId: row.cotacao_id || row.cotacaoId || undefined,
    cotacaoNumero: row.cotacao_numero || row.cotacaoNumero || '',
    numeroParcela: Number(row.numero_parcela || row.numeroParcela || 1),
    totalParcelas: Number(row.total_parcelas || row.totalParcelas || 1),
    valorParcela: Number(row.valor_parcela || row.valorParcela || 0),
    dataVencimento: (row.data_vencimento || row.dataVencimento || getDataHojeIso()).split('T')[0],
    dataEmissao: (row.data_emissao || row.dataEmissao || getDataHojeIso()).split('T')[0],
    dataPagamento: row.data_pagamento ? String(row.data_pagamento).split('T')[0] : undefined,
    status: (row.status === 'Baixado' || row.status === 'pago' || row.status === 'Pago') ? 'Baixado' : 'Pendente',
    formaPagamento: row.forma_pagamento || row.formaPagamento || 'Boleto',
    banco: row.banco || 'Banco Itaú',
    codigoBarras: row.codigo_barras || row.codigoBarras || '',
    nossoNumero: row.nosso_numero || row.nossoNumero || '',
    observacoes: row.observacoes || '',
    lancamentoId: row.lancamento_id || row.lancamentoId || undefined,
    criadoEm: row.created_at || row.criadoEm || new Date().toISOString(),
    atualizadoEm: row.updated_at || row.atualizadoEm || new Date().toISOString()
  };
}

/**
 * Busca a lista completa de boletos / contas a receber
 */
export async function fetchBoletosDb(): Promise<ContaReceberParcela[]> {
  try {
    const { data, error } = await db
      .from('contas_a_receber')
      .select('*')
      .order('data_vencimento', { ascending: true });

    if (!error && data && data.length > 0) {
      const mapped = data.map(mapSupabaseToBoleto);
      cacheBoletos = mapped;
      saveLocalBoletos(mapped);
      return mapped;
    }
  } catch (err) {
    // Tabela contas_a_receber pode não existir no Supabase, segue com cache
  }

  // Tenta carregar do localStorage ou demo
  if (cacheBoletos.length === 0) {
    cacheBoletos = loadLocalBoletos();
  }
  return cacheBoletos;
}

/**
 * Salva uma lista de parcelas/boletos gerados no banco de dados e sincroniza com o Financeiro
 */
export async function saveBoletosParcelasDb(
  boletos: ContaReceberParcela[]
): Promise<{ sucesso: boolean; boletos: ContaReceberParcela[] }> {
  // 1. Atualiza cache em memória e localStorage
  const existingMap = new Map<string, ContaReceberParcela>();
  cacheBoletos.forEach(b => existingMap.set(b.id, b));
  boletos.forEach(b => existingMap.set(b.id, b));
  cacheBoletos = Array.from(existingMap.values());
  saveLocalBoletos(cacheBoletos);

  // 2. Tenta persistir no Supabase tabela contas_a_receber
  try {
    const payloads = boletos.map(mapBoletoToSupabase);
    await db.from('contas_a_receber').upsert(payloads, { onConflict: 'id' });
  } catch (err) {
    // Silencioso se a tabela ainda não existir no projeto Supabase
  }

  // 3. Sincroniza cada parcela no Módulo Financeiro (financeiro_lancamentos)
  for (const boleto of boletos) {
    try {
      const docRef = `${boleto.cotacaoNumero || 'COT'}-${boleto.numeroParcela}/${boleto.totalParcelas}`;
      const lancamento: LancamentoFinanceiro = {
        id: boleto.lancamentoId || `fin-bol-${boleto.id}`,
        tipo: 'receita',
        categoria: 'venda_cotacao',
        descricao: `Boleto Parc. ${boleto.numeroParcela}/${boleto.totalParcelas} - ${boleto.clienteNome} (Cotação ${boleto.cotacaoNumero})`,
        clienteFornecedor: boleto.clienteNome,
        documentoRef: docRef,
        valor: boleto.valorParcela,
        dataVencimento: boleto.dataVencimento,
        dataCompetencia: boleto.dataEmissao,
        dataPagamento: boleto.status === 'Baixado' ? (boleto.dataPagamento || getDataHojeIso()) : undefined,
        formaPagamento: 'Boleto',
        status: boleto.status === 'Baixado' ? 'pago' : 'pendente',
        observacoes: boleto.observacoes || `Boleto ${boleto.banco || ''} Nosso Nº: ${boleto.nossoNumero || ''}`,
        cotacaoId: boleto.cotacaoId,
        criadoEm: boleto.criadoEm || new Date().toISOString()
      };
      await saveLancamentoFinanceiroDb(lancamento);
      boleto.lancamentoId = lancamento.id;
    } catch (e) {
      console.warn('Aviso ao sincronizar boleto no financeiro:', e);
    }
  }

  saveLocalBoletos(cacheBoletos);
  return { sucesso: true, boletos };
}

/**
 * Salva e atualiza as parcelas de uma cotação específica,
 * removendo do banco de dados (Supabase) quaisquer parcelas antigas que foram
 * excluídas ou substituídas durante a reconfiguração.
 */
export async function salvarEAtualizarBoletosCotacaoDb(
  cotacaoNumero: string,
  novasParcelas: ContaReceberParcela[],
  cotacaoId?: string
): Promise<{ sucesso: boolean; boletos: ContaReceberParcela[] }> {
  // Identifica parcelas antigas desta cotação que estão no cache
  const antigas = cacheBoletos.filter(b => 
    (cotacaoNumero && b.cotacaoNumero === cotacaoNumero) || 
    (cotacaoId && b.cotacaoId === cotacaoId)
  );

  const novasIds = new Set(novasParcelas.map(p => p.id));
  const idsParaRemover = antigas.filter(b => !novasIds.has(b.id)).map(b => b.id);

  // Se há parcelas excluídas/substituídas, remove do Supabase e do cache
  if (idsParaRemover.length > 0) {
    try {
      await db.from('contas_a_receber').delete().in('id', idsParaRemover);
    } catch (e) {
      console.warn('Aviso ao remover boletos antigos do Supabase:', e);
    }

    // Remove lançamentos vinculados no financeiro se houver
    const lancamentosParaRemover = antigas
      .filter(b => !novasIds.has(b.id) && b.lancamentoId)
      .map(b => b.lancamentoId!);

    if (lancamentosParaRemover.length > 0) {
      try {
        await db.from('financeiro_lancamentos').delete().in('id', lancamentosParaRemover);
      } catch (e) {}
    }

    // Atualiza cache em memória
    cacheBoletos = cacheBoletos.filter(b => !idsParaRemover.includes(b.id));
  }

  // Agora salva/upserta as novas parcelas
  return await saveBoletosParcelasDb(novasParcelas);
}

/**
 * Dá baixa rápida em um boleto/parcela confirmando o recebimento
 */
export async function darBaixaBoletoDb(
  boletoId: string,
  dataPagamento?: string,
  contaDestino: string = 'Caixa Central'
): Promise<{ sucesso: boolean; boleto: ContaReceberParcela | null; mensagem: string }> {
  const dataHoje = dataPagamento || getDataHojeIso();

  // Encontra o boleto no cache
  let boleto = cacheBoletos.find(b => b.id === boletoId) || null;
  if (!boleto) {
    const locais = loadLocalBoletos();
    boleto = locais.find(b => b.id === boletoId) || null;
  }

  if (!boleto) {
    return { sucesso: false, boleto: null, mensagem: 'Boleto não encontrado para efetuar baixa.' };
  }

  // Atualiza dados da parcela
  boleto.status = 'Baixado';
  boleto.dataPagamento = dataHoje;
  boleto.atualizadoEm = new Date().toISOString();

  // Atualiza cache e localStorage
  const idx = cacheBoletos.findIndex(b => b.id === boletoId);
  if (idx >= 0) cacheBoletos[idx] = { ...boleto };
  else cacheBoletos.push({ ...boleto });
  saveLocalBoletos(cacheBoletos);

  // Tenta atualizar no Supabase contas_a_receber
  try {
    await db.from('contas_a_receber').update({
      status: 'Baixado',
      data_pagamento: dataHoje,
      updated_at: new Date().toISOString()
    }).eq('id', boletoId);
  } catch (err) {}

  // Cria / atualiza lançamento no Módulo Financeiro
  const docRef = `${boleto.cotacaoNumero || 'COT'}-${boleto.numeroParcela}/${boleto.totalParcelas}`;
  const lancamentoId = boleto.lancamentoId || `fin-bol-${boleto.id}`;
  const lancamento: LancamentoFinanceiro = {
    id: lancamentoId,
    tipo: 'receita',
    categoria: 'venda_cotacao',
    descricao: `Recebimento Boleto Parc. ${boleto.numeroParcela}/${boleto.totalParcelas} - ${boleto.clienteNome}`,
    clienteFornecedor: boleto.clienteNome,
    documentoRef: docRef,
    valor: boleto.valorParcela,
    dataVencimento: boleto.dataVencimento,
    dataCompetencia: boleto.dataEmissao,
    dataPagamento: dataHoje,
    formaPagamento: 'Boleto',
    status: 'pago',
    observacoes: `Baixa de boleto confirmada. Conta Destino: ${contaDestino}. Nosso Número: ${boleto.nossoNumero || '-'}`,
    cotacaoId: boleto.cotacaoId,
    criadoEm: new Date().toISOString()
  };

  await saveLancamentoFinanceiroDb(lancamento);
  boleto.lancamentoId = lancamento.id;
  saveLocalBoletos(cacheBoletos);

  return {
    sucesso: true,
    boleto,
    mensagem: `Boleto de ${formatCurrencyPtBr(boleto.valorParcela)} (${boleto.clienteNome}) baixado com sucesso no Caixa!`
  };
}

/**
 * Estorna a baixa de um boleto/parcela (volta para status 'Em Aberto')
 */
export async function estornarBaixaBoletoDb(
  boletoId: string
): Promise<{ sucesso: boolean; boleto: ContaReceberParcela | null; mensagem: string }> {
  let boleto = cacheBoletos.find(b => b.id === boletoId) || null;
  if (!boleto) {
    const locais = loadLocalBoletos();
    boleto = locais.find(b => b.id === boletoId) || null;
  }

  if (!boleto) {
    return { sucesso: false, boleto: null, mensagem: 'Boleto não encontrado para estornar.' };
  }

  boleto.status = 'Pendente';
  boleto.dataPagamento = undefined;
  boleto.atualizadoEm = new Date().toISOString();

  const idx = cacheBoletos.findIndex(b => b.id === boletoId);
  if (idx >= 0) cacheBoletos[idx] = { ...boleto };
  saveLocalBoletos(cacheBoletos);

  try {
    await db.from('contas_a_receber').update({
      status: 'Pendente',
      data_pagamento: null,
      updated_at: new Date().toISOString()
    }).eq('id', boletoId);
  } catch (err) {}

  if (boleto.lancamentoId) {
    try {
      await db.from('financeiro_lancamentos').update({
        status: 'pendente',
        data_pagamento: null
      }).eq('id', boleto.lancamentoId);
    } catch (e) {}
  }

  return { sucesso: true, boleto, mensagem: 'Baixa estornada com sucesso!' };
}

/**
 * Registra faturamento imediato no Financeiro ao mudar cotação para FATURADO
 */
export async function registrarFaturamentoCotacaoDb(
  cotacaoNumero: string,
  clienteNome: string,
  valorTotal: number,
  cotacaoId?: string
): Promise<LancamentoFinanceiro> {
  const dataHoje = getDataHojeIso();
  const lancamentoId = `fin-fat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

  const lancamento: LancamentoFinanceiro = {
    id: lancamentoId,
    tipo: 'receita',
    categoria: 'venda_cotacao',
    descricao: `Faturamento Cotação ${cotacaoNumero} - ${clienteNome}`,
    clienteFornecedor: clienteNome,
    documentoRef: cotacaoNumero,
    valor: Number(valorTotal.toFixed(2)),
    dataVencimento: dataHoje,
    dataCompetencia: dataHoje,
    dataPagamento: dataHoje,
    formaPagamento: 'Boleto',
    status: 'pago',
    observacoes: `Faturamento automático gerado pela alteração da cotação para FATURADO na Consulta Geral.`,
    cotacaoId: cotacaoId,
    criadoEm: new Date().toISOString()
  };

  await saveLancamentoFinanceiroDb(lancamento);
  return lancamento;
}

/**
 * Gera parcelas com base em condição comercial selecionada
 */
export function gerarParcelasCondicaoPagamento(params: {
  cotacaoId?: string;
  cotacaoNumero: string;
  clienteId?: string;
  clienteNome: string;
  valorTotal: number;
  condicao: 'a_vista' | '30' | '30_60' | '30_60_90' | '30_60_90_120' | '15_30_45_60' | 'personalizado';
  qtdParcelasPersonalizada?: number;
  intervaloDias?: number;
  dataBase?: string;
  bancoPadrao?: string;
}): ContaReceberParcela[] {
  const {
    cotacaoId,
    cotacaoNumero,
    clienteId,
    clienteNome,
    valorTotal,
    condicao,
    qtdParcelasPersonalizada = 1,
    intervaloDias = 30,
    dataBase = getDataHojeIso(),
    bancoPadrao = 'Banco Itaú'
  } = params;

  let prazosDias: number[] = [];

  switch (condicao) {
    case 'a_vista':
      prazosDias = [0];
      break;
    case '30':
      prazosDias = [30];
      break;
    case '30_60':
      prazosDias = [30, 60];
      break;
    case '30_60_90':
      prazosDias = [30, 60, 90];
      break;
    case '30_60_90_120':
      prazosDias = [30, 60, 90, 120];
      break;
    case '15_30_45_60':
      prazosDias = [15, 30, 45, 60];
      break;
    case 'personalizado':
    default: {
      const qtd = Math.max(1, Math.min(12, qtdParcelasPersonalizada));
      const step = Math.max(1, intervaloDias);
      prazosDias = Array.from({ length: qtd }, (_, i) => (i + 1) * step);
      break;
    }
  }

  const totalParcelas = prazosDias.length;
  const valorBase = Math.floor((valorTotal / totalParcelas) * 100) / 100;
  let somaCalculada = valorBase * totalParcelas;
  let diferencaCentavos = Math.round((valorTotal - somaCalculada) * 100) / 100;

  const parcelas: ContaReceberParcela[] = [];
  const baseDate = new Date(`${dataBase}T12:00:00`);

  prazosDias.forEach((dias, index) => {
    const numParcela = index + 1;
    // O ajuste dos centavos vai na primeira ou na última parcela
    const valorParcela = numParcela === totalParcelas 
      ? Number((valorBase + diferencaCentavos).toFixed(2)) 
      : valorBase;

    const dataVenc = new Date(baseDate.getTime());
    dataVenc.setDate(dataVenc.getDate() + dias);
    const ano = dataVenc.getFullYear();
    const mes = String(dataVenc.getMonth() + 1).padStart(2, '0');
    const dia = String(dataVenc.getDate()).padStart(2, '0');
    const dataVencimentoStr = `${ano}-${mes}-${dia}`;

    const randNum = Math.floor(100000 + Math.random() * 900000);

    parcelas.push({
      id: `bol-${cotacaoNumero || 'COT'}-p${numParcela}-${Date.now().toString(36)}`,
      clienteId,
      clienteNome,
      cotacaoId,
      cotacaoNumero,
      numeroParcela: numParcela,
      totalParcelas,
      valorParcela,
      dataVencimento: dataVencimentoStr,
      dataEmissao: dataBase,
      status: 'Pendente',
      formaPagamento: 'Boleto',
      banco: bancoPadrao,
      nossoNumero: `34191.${cotacaoNumero || '00'}${numParcela} 00000.${randNum}`,
      observacoes: `Parcela ${numParcela} de ${totalParcelas} - Cotação ${cotacaoNumero} (${clienteNome})`
    });
  });

  return parcelas;
}

/**
 * Filtra boletos que vencem na data de hoje ou estão vencidos/pendentes
 */
export function obterBoletosVencimentoHoje(boletos: ContaReceberParcela[]): {
  vencemHoje: ContaReceberParcela[];
  atrasados: ContaReceberParcela[];
  totalHoje: number;
  totalAtrasado: number;
} {
  const hojeStr = getDataHojeIso();
  const vencemHoje: ContaReceberParcela[] = [];
  const atrasados: ContaReceberParcela[] = [];

  let totalHoje = 0;
  let totalAtrasado = 0;

  boletos.forEach(b => {
    if (b.status !== 'Baixado') {
      if (b.dataVencimento === hojeStr) {
        vencemHoje.push(b);
        totalHoje += b.valorParcela;
      } else if (b.dataVencimento < hojeStr) {
        atrasados.push(b);
        totalAtrasado += b.valorParcela;
      }
    }
  });

  return {
    vencemHoje,
    atrasados,
    totalHoje,
    totalAtrasado
  };
}

export interface MesFluxoCaixa {
  chaveMesAno: string; // "2026-03"
  tituloMesAno: string; // "Março 2026"
  totalPendente: number;
  totalBaixado: number;
  totalGeral: number;
  quantidadeBoletos: number;
  boletos: ContaReceberParcela[];
}

const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Calcula a previsão de fluxo de caixa mensal com base nas datas de vencimento dos boletos
 */
export function calcularPrevisaoFluxoMensal(boletos: ContaReceberParcela[]): MesFluxoCaixa[] {
  const mapa = new Map<string, MesFluxoCaixa>();

  boletos.forEach(b => {
    if (!b.dataVencimento) return;
    const parts = b.dataVencimento.split('-');
    if (parts.length < 2) return;
    const ano = parts[0];
    const mesIdx = parseInt(parts[1], 10) - 1;
    const chave = `${ano}-${parts[1]}`;
    const nomeMes = NOMES_MESES[mesIdx] || `Mês ${parts[1]}`;
    const titulo = `${nomeMes} ${ano}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chaveMesAno: chave,
        tituloMesAno: titulo,
        totalPendente: 0,
        totalBaixado: 0,
        totalGeral: 0,
        quantidadeBoletos: 0,
        boletos: []
      });
    }

    const item = mapa.get(chave)!;
    item.quantidadeBoletos += 1;
    item.totalGeral += b.valorParcela;
    if (b.status === 'Baixado') {
      item.totalBaixado += b.valorParcela;
    } else {
      item.totalPendente += b.valorParcela;
    }
    item.boletos.push(b);
  });

  // Ordena por chave cronológica
  return Array.from(mapa.values()).sort((a, b) => a.chaveMesAno.localeCompare(b.chaveMesAno));
}

export interface StatusOptionConfig {
  value: string;
  label: string;
  dotClass: string;
}

export const STATUS_OPTIONS: StatusOptionConfig[] = [
  { value: 'pendente', label: 'Pendente', dotClass: 'bg-blue-500' },
  { value: 'aprovado', label: 'Aprovado', dotClass: 'bg-green-500' },
  { value: 'rascunho', label: 'Rascunho', dotClass: 'bg-yellow-400' },
  { value: 'faturado', label: 'Faturado', dotClass: 'bg-purple-500' },
  { value: 'rejeitado', label: 'Rejeitado', dotClass: 'bg-red-500' },
  { value: 'cancelado', label: 'Cancelado', dotClass: 'bg-slate-100 border border-slate-600' },
];

export function normalizeStatus(rawStatus?: string): string {
  if (!rawStatus) return 'pendente';
  const s = rawStatus.trim().toLowerCase();
  if (s === 'aprovado') return 'aprovado';
  if (s === 'faturado') return 'faturado';
  if (s === 'rascunho') return 'rascunho';
  if (s === 'rejeitado' || s === 'reprovado') return 'rejeitado';
  if (s === 'cancelado') return 'cancelado';
  if (s === 'pendente' || s === 'enviado' || s.includes('analise') || s.includes('análise')) return 'pendente';
  return s;
}

export function getStatusOption(rawStatus?: string): StatusOptionConfig {
  const norm = normalizeStatus(rawStatus);
  const found = STATUS_OPTIONS.find(o => o.value === norm);
  if (found) return found;
  return { value: norm, label: (rawStatus || 'Pendente'), dotClass: 'bg-blue-500' };
}

export function getStatusLabel(rawStatus?: string): string {
  return getStatusOption(rawStatus).label;
}
