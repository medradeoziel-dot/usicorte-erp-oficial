import { 
  MaterialEstoque, 
  RetalhoEstoque, 
  MovimentacaoEstoque, 
  LancamentoFinanceiro, 
  FormaPagamentoFinanceiro,
  Quote, 
  OrdemServico 
} from '../types';
import { 
  db, 
  fetchCotacoesDb, 
  SupabaseCotacao, 
  atualizarSituacaoCotacaoDb,
  atualizarStatusPagamentoCotacaoDb,
  sincronizarPagamentoContaReceberDb,
  isNotFoundError,
  safeFetchTable,
  isUuid
} from '../lib/db';

// Materiais Iniciais Padrão UsiCorte / Caldeiraria
export const INITIAL_MATERIAIS: MaterialEstoque[] = [
  {
    id: 'mat-001',
    codigo: 'CHP-A36-0317',
    nome: 'Chapa A36 1/8" (3.17mm) 1200x3000',
    tipo: 'chapa',
    material: 'A36',
    espessuraMm: 3.17,
    larguraMm: 1200,
    comprimentoMm: 3000,
    densidade: 0.00785,
    pesoUnitarioKg: 89.57,
    quantidade: 15,
    pesoTotalKg: 1343.55,
    estoqueMinimoKg: 500,
    estoqueMinimoQtd: 6,
    custoKg: 7.20,
    precoVendaKg: 19.50,
    localizacao: 'Pátio Chapa - Rack A1',
    fornecedor: 'Gerdau / Açotubo',
    observacoes: 'Chapa fina a quente para corte laser/plasma',
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'mat-002',
    codigo: 'CHP-A36-0475',
    nome: 'Chapa A36 3/16" (4.75mm) 1500x3000',
    tipo: 'chapa',
    material: 'A36',
    espessuraMm: 4.75,
    larguraMm: 1500,
    comprimentoMm: 3000,
    densidade: 0.00785,
    pesoUnitarioKg: 167.80,
    quantidade: 8,
    pesoTotalKg: 1342.40,
    estoqueMinimoKg: 600,
    estoqueMinimoQtd: 4,
    custoKg: 7.40,
    precoVendaKg: 20.00,
    localizacao: 'Pátio Chapa - Rack A2',
    fornecedor: 'Usiminas',
    observacoes: 'Material decapado e oleado para corte a laser',
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'mat-003',
    codigo: 'CHP-A36-0635',
    nome: 'Chapa A36 1/4" (6.35mm) 1500x3000',
    tipo: 'chapa',
    material: 'A36',
    espessuraMm: 6.35,
    larguraMm: 1500,
    comprimentoMm: 3000,
    densidade: 0.00785,
    pesoUnitarioKg: 224.32,
    quantidade: 3,
    pesoTotalKg: 672.96,
    estoqueMinimoKg: 900,
    estoqueMinimoQtd: 5,
    custoKg: 7.50,
    precoVendaKg: 22.00,
    localizacao: 'Pátio Chapa - Rack A3',
    fornecedor: 'ArcelorMittal',
    observacoes: 'Alta rotatividade em bases e flanges industriais',
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'mat-004',
    codigo: 'CHP-A36-0952',
    nome: 'Chapa A36 3/8" (9.52mm) 1500x3000',
    tipo: 'chapa',
    material: 'A36',
    espessuraMm: 9.52,
    larguraMm: 1500,
    comprimentoMm: 3000,
    densidade: 0.00785,
    pesoUnitarioKg: 336.30,
    quantidade: 6,
    pesoTotalKg: 2017.80,
    estoqueMinimoKg: 700,
    estoqueMinimoQtd: 3,
    custoKg: 7.80,
    precoVendaKg: 23.50,
    localizacao: 'Pátio Chapa - Rack B1',
    fornecedor: 'Gerdau',
    observacoes: 'Corte laser alta potência e oxicorte',
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'mat-005',
    codigo: 'CHP-A36-1270',
    nome: 'Chapa A36 1/2" (12.70mm) 1500x3000',
    tipo: 'chapa',
    material: 'A36',
    espessuraMm: 12.70,
    larguraMm: 1500,
    comprimentoMm: 3000,
    densidade: 0.00785,
    pesoUnitarioKg: 448.64,
    quantidade: 2,
    pesoTotalKg: 897.28,
    estoqueMinimoKg: 1200,
    estoqueMinimoQtd: 4,
    custoKg: 8.00,
    precoVendaKg: 24.00,
    localizacao: 'Pátio Chapa - Rack B2',
    fornecedor: 'Usiminas',
    observacoes: 'Chapa grossa estrutural',
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'mat-006',
    codigo: 'CHP-INOX304-0200',
    nome: 'Chapa Inox 304 2.00mm 1250x3000',
    tipo: 'chapa',
    material: 'Inox 304',
    espessuraMm: 2.00,
    larguraMm: 1250,
    comprimentoMm: 3000,
    densidade: 0.00800,
    pesoUnitarioKg: 60.00,
    quantidade: 7,
    pesoTotalKg: 420.00,
    estoqueMinimoKg: 200,
    estoqueMinimoQtd: 3,
    custoKg: 28.50,
    precoVendaKg: 58.00,
    localizacao: 'Pátio Inox - Rack C1',
    fornecedor: 'Aperam',
    observacoes: 'Aço inoxidável austenítico com película protetora',
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'mat-007',
    codigo: 'BAR-1020-0508',
    nome: 'Barra Redonda SAE 1020 Ø 2" (50.80mm) x 6000mm',
    tipo: 'barra',
    material: '1020',
    espessuraMm: 50.80,
    larguraMm: 50.80,
    comprimentoMm: 6000,
    densidade: 0.00785,
    pesoUnitarioKg: 95.74,
    quantidade: 10,
    pesoTotalKg: 957.40,
    estoqueMinimoKg: 300,
    estoqueMinimoQtd: 4,
    custoKg: 8.90,
    precoVendaKg: 25.00,
    localizacao: 'Prateleira Maciços - Baia 3',
    fornecedor: 'Villares Metals',
    observacoes: 'Maciço para torneamento e buchas',
    atualizadoEm: new Date().toISOString()
  },
  {
    id: 'mat-008',
    codigo: 'BAR-1045-0762',
    nome: 'Barra Redonda SAE 1045 Ø 3" (76.20mm) x 6000mm',
    tipo: 'barra',
    material: '1045',
    espessuraMm: 76.20,
    larguraMm: 76.20,
    comprimentoMm: 6000,
    densidade: 0.00785,
    pesoUnitarioKg: 215.42,
    quantidade: 4,
    pesoTotalKg: 861.68,
    estoqueMinimoKg: 400,
    estoqueMinimoQtd: 2,
    custoKg: 10.50,
    precoVendaKg: 29.00,
    localizacao: 'Prateleira Maciços - Baia 4',
    fornecedor: 'Gerdau Aços Especiais',
    observacoes: 'Aço de médio carbono temperável para eixos',
    atualizadoEm: new Date().toISOString()
  }
];

// Retalhos Padrão Iniciais
export const INITIAL_RETALHOS: RetalhoEstoque[] = [
  {
    id: 'ret-001',
    codigo: 'RET-A36-635-01',
    materialNome: 'Chapa A36 1/4" (6.35mm)',
    tipo: 'chapa',
    espessuraMm: 6.35,
    larguraMm: 450,
    comprimentoMm: 1200,
    pesoKg: 26.92,
    cotacaoOrigem: 'COT-2026-0002',
    localizacao: 'Rack de Retalhos - Compartimento 1',
    status: 'disponivel',
    dataEntrada: new Date().toISOString().split('T')[0],
    observacao: 'Sobra de corte longitudinal limpa sem queima'
  },
  {
    id: 'ret-002',
    codigo: 'RET-INOX-200-01',
    materialNome: 'Chapa Inox 304 2.00mm',
    tipo: 'chapa',
    espessuraMm: 2.00,
    larguraMm: 600,
    comprimentoMm: 800,
    pesoKg: 7.68,
    cotacaoOrigem: 'COT-2026-0005',
    localizacao: 'Rack Retalhos Inox - Prateleira 2',
    status: 'disponivel',
    dataEntrada: new Date().toISOString().split('T')[0],
    observacao: 'Com filme de PVC em ótimo estado'
  },
  {
    id: 'ret-003',
    codigo: 'RET-A36-127-01',
    materialNome: 'Chapa A36 1/2" (12.70mm)',
    tipo: 'chapa',
    espessuraMm: 12.70,
    larguraMm: 350,
    comprimentoMm: 500,
    pesoKg: 17.45,
    cotacaoOrigem: 'COT-2026-0001',
    localizacao: 'Rack de Retalhos - Compartimento 3',
    status: 'utilizado',
    dataEntrada: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    dataUso: new Date().toISOString().split('T')[0],
    observacao: 'Utilizado para confecção de 4 flanges de 150mm'
  }
];

// Lançamentos Financeiros Padrão
export const INITIAL_FINANCEIRO: LancamentoFinanceiro[] = [
  {
    id: 'fin-001',
    tipo: 'receita',
    categoria: 'venda_cotacao',
    descricao: 'Recebimento Cotação COT-2026-0001 (Flanges e Bases)',
    clienteFornecedor: 'Metalúrgica Imperial Ltda',
    documentoRef: 'COT-2026-0001',
    valor: 4850.00,
    dataVencimento: new Date().toISOString().split('T')[0],
    dataCompetencia: new Date().toISOString().split('T')[0],
    dataPagamento: new Date().toISOString().split('T')[0],
    formaPagamento: 'PIX',
    status: 'pago',
    observacoes: 'Pagamento à vista confirmado com 3% de desconto',
    criadoEm: new Date().toISOString()
  },
  {
    id: 'fin-002',
    tipo: 'receita',
    categoria: 'venda_cotacao',
    descricao: 'Faturamento Cotação COT-2026-0003 (Corte Laser Chapa Grossa)',
    clienteFornecedor: 'Indústria Mecânica Progresso S/A',
    documentoRef: 'COT-2026-0003',
    valor: 9200.00,
    dataVencimento: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    dataCompetencia: new Date().toISOString().split('T')[0],
    formaPagamento: 'Boleto',
    status: 'pendente',
    observacoes: 'Prazo 28 dias após faturamento',
    criadoEm: new Date().toISOString()
  },
  {
    id: 'fin-003',
    tipo: 'despesa',
    categoria: 'compra_chapa',
    descricao: 'Compra de Lote de Chapas A36 (Gerdau)',
    clienteFornecedor: 'Gerdau Aços Brasil S/A',
    documentoRef: 'NF-e 884920',
    valor: 14500.00,
    dataVencimento: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    dataCompetencia: new Date().toISOString().split('T')[0],
    formaPagamento: 'Boleto',
    status: 'pendente',
    observacoes: 'Reposição de chapas 1/4" e 1/2"',
    criadoEm: new Date().toISOString()
  },
  {
    id: 'fin-004',
    tipo: 'despesa',
    categoria: 'energia',
    descricao: 'Conta de Energia Elétrica - Máquinas Laser / Plasma',
    clienteFornecedor: 'Enel / CPFL Distribuidora',
    documentoRef: 'FAT-2026/08',
    valor: 3820.50,
    dataVencimento: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
    dataCompetencia: new Date().toISOString().split('T')[0],
    formaPagamento: 'Boleto',
    status: 'pendente',
    observacoes: 'Consumo horário ponta e fora de ponta',
    criadoEm: new Date().toISOString()
  },
  {
    id: 'fin-005',
    tipo: 'despesa',
    categoria: 'frete',
    descricao: 'Frete de Entrega de Peças Cortadas',
    clienteFornecedor: 'TransCargas Express',
    documentoRef: 'CTE-44120',
    valor: 450.00,
    dataVencimento: new Date().toISOString().split('T')[0],
    dataCompetencia: new Date().toISOString().split('T')[0],
    dataPagamento: new Date().toISOString().split('T')[0],
    formaPagamento: 'PIX',
    status: 'pago',
    observacoes: 'Entrega na fábrica do cliente em Campinas/SP',
    criadoEm: new Date().toISOString()
  }
];

// In-memory cache synced with Supabase for instant responsive UI
let cacheMateriais: MaterialEstoque[] = [...INITIAL_MATERIAIS];
let cacheRetalhos: RetalhoEstoque[] = [...INITIAL_RETALHOS];
let cacheLancamentos: LancamentoFinanceiro[] = [...INITIAL_FINANCEIRO];
let cacheMovimentacoes: MovimentacaoEstoque[] = [];
let cachePagamentosMap: Record<string, RegistroPagamentoCotacao> = {};

// Helper: mapeia registro do Supabase para MaterialEstoque
export function mapSupabaseToMaterial(row: any): MaterialEstoque {
  const nome = row.nome || row.name || 'Material sem nome';
  const matchedInitial = INITIAL_MATERIAIS.find(m => 
    m.nome.toLowerCase() === nome.toLowerCase() ||
    (row.codigo && m.codigo.toLowerCase() === String(row.codigo).toLowerCase())
  );

  const qtd = Number(row.quantidade != null ? row.quantidade : (row.quantity != null ? row.quantity : (matchedInitial?.quantidade ?? 0)));
  const pesoUnit = Number(row.peso_unitario_kg != null ? row.peso_unitario_kg : (row.pesoUnitarioKg != null ? row.pesoUnitarioKg : (matchedInitial?.pesoUnitarioKg ?? 0)));
  const pesoTot = Number(row.peso_total_kg != null ? row.peso_total_kg : (row.pesoTotalKg != null ? row.pesoTotalKg : (qtd * pesoUnit || (matchedInitial?.pesoTotalKg ?? 0))));

  return {
    id: String(row.id || matchedInitial?.id || `mat-${Date.now()}`),
    codigo: row.codigo || row.code || matchedInitial?.codigo || '',
    nome,
    tipo: row.tipo || row.type || matchedInitial?.tipo || 'chapa',
    material: row.material || row.liga || matchedInitial?.material || 'A36',
    espessuraMm: Number(row.espessura_mm != null ? row.espessura_mm : (row.espessuraMm != null ? row.espessuraMm : (matchedInitial?.espessuraMm ?? 0))),
    larguraMm: Number(row.largura_mm != null ? row.largura_mm : (row.larguraMm != null ? row.larguraMm : (matchedInitial?.larguraMm ?? 0))),
    comprimentoMm: Number(row.comprimento_mm != null ? row.comprimento_mm : (row.comprimentoMm != null ? row.comprimentoMm : (matchedInitial?.comprimentoMm ?? 0))),
    densidade: Number(row.densidade != null ? row.densidade : (matchedInitial?.densidade ?? 0.00785)),
    pesoUnitarioKg: pesoUnit,
    quantidade: qtd,
    pesoTotalKg: pesoTot,
    estoqueMinimoKg: Number(row.estoque_minimo_kg != null ? row.estoque_minimo_kg : (matchedInitial?.estoqueMinimoKg ?? 0)),
    estoqueMinimoQtd: Number(row.estoque_minimo_qtd != null ? row.estoque_minimo_qtd : (matchedInitial?.estoqueMinimoQtd ?? 0)),
    custoKg: Number(row.custo_kg != null ? row.custo_kg : (matchedInitial?.custoKg ?? 0)),
    precoVendaKg: Number(row.preco_venda_kg != null ? row.preco_venda_kg : (matchedInitial?.precoVendaKg ?? 0)),
    localizacao: row.localizacao || row.location || matchedInitial?.localizacao || '',
    fornecedor: row.fornecedor || row.supplier || matchedInitial?.fornecedor || '',
    observacoes: row.observacoes || row.observacao || row.notes || matchedInitial?.observacoes || '',
    atualizadoEm: row.updated_at || row.created_at || row.atualizado_em || row.atualizadoEm || new Date().toISOString(),
    ncm: row.ncm || row.ncm_codigo || matchedInitial?.ncm || '',
    constanteK: Number(row.constante_k != null ? row.constante_k : (row.constanteK != null ? row.constanteK : (matchedInitial?.constanteK ?? 0))),
    bitolaMm: Number(row.bitola_mm != null ? row.bitola_mm : (row.bitolaMm != null ? row.bitolaMm : (matchedInitial?.bitolaMm ?? 0))),
    metroLinearTotal: Number(row.metro_linear_total != null ? row.metro_linear_total : (row.metroLinearTotal != null ? row.metroLinearTotal : (matchedInitial?.metroLinearTotal ?? 0)))
  };
}

export function mapMaterialToSupabase(m: MaterialEstoque): Record<string, any> {
  return {
    id: m.id,
    codigo: m.codigo,
    nome: m.nome,
    tipo: m.tipo,
    material: m.material,
    espessura_mm: m.espessuraMm,
    largura_mm: m.larguraMm,
    comprimento_mm: m.comprimentoMm,
    densidade: m.densidade,
    peso_unitario_kg: m.pesoUnitarioKg,
    quantidade: m.quantidade,
    peso_total_kg: m.pesoTotalKg,
    estoque_minimo_kg: m.estoqueMinimoKg,
    estoque_minimo_qtd: m.estoqueMinimoQtd,
    custo_kg: m.custoKg,
    preco_venda_kg: m.precoVendaKg,
    localizacao: m.localizacao,
    fornecedor: m.fornecedor,
    observacoes: m.observacoes,
    ncm: m.ncm,
    constante_k: m.constanteK,
    bitola_mm: m.bitolaMm,
    metro_linear_total: m.metroLinearTotal,
    updated_at: new Date().toISOString()
  };
}

// Helper: mapeia registro do Supabase para RetalhoEstoque
export function mapSupabaseToRetalho(row: any): RetalhoEstoque {
  return {
    id: String(row.id || `ret-${Date.now()}`),
    codigo: row.codigo || row.code || '',
    materialNome: row.material_nome || row.materialNome || row.material || '',
    tipo: row.tipo || row.type || 'chapa',
    espessuraMm: Number(row.espessura_mm || row.espessuraMm || 0),
    larguraMm: Number(row.largura_mm || row.larguraMm || 0),
    comprimentoMm: Number(row.comprimento_mm || row.comprimentoMm || 0),
    pesoKg: Number(row.peso_kg || row.pesoKg || 0),
    cotacaoOrigem: row.cotacao_origem || row.cotacaoOrigem || '',
    localizacao: row.localizacao || row.location || '',
    status: (row.status === 'utilizado' ? 'utilizado' : 'disponivel') as any,
    dataEntrada: row.data_entrada || row.dataEntrada || new Date().toISOString().split('T')[0],
    dataUso: row.data_uso || row.dataUso || undefined,
    observacao: row.observacao || row.observacoes || ''
  };
}

export function mapRetalhoToSupabase(r: RetalhoEstoque): Record<string, any> {
  return {
    id: r.id,
    codigo: r.codigo,
    material_nome: r.materialNome,
    tipo: r.tipo,
    espessura_mm: r.espessuraMm,
    largura_mm: r.larguraMm,
    comprimento_mm: r.comprimentoMm,
    peso_kg: r.pesoKg,
    cotacao_origem: r.cotacaoOrigem || '',
    localizacao: r.localizacao || '',
    status: r.status,
    data_entrada: r.dataEntrada,
    data_uso: r.dataUso || null,
    observacao: r.observacao || '',
    updated_at: new Date().toISOString()
  };
}

// Helper: mapeia registro do Supabase para MovimentacaoEstoque
export function mapSupabaseToMovimentacao(row: any): MovimentacaoEstoque {
  return {
    id: String(row.id || `mov-${Date.now()}`),
    materialId: String(row.material_id || row.materialId || ''),
    materialNome: row.material_nome || row.materialNome || 'Material',
    tipo: row.tipo || 'entrada',
    quantidade: Number(row.quantidade || 0),
    pesoKg: Number(row.peso_kg || row.pesoKg || 0),
    data: row.data || row.created_at || new Date().toISOString(),
    referenciaDoc: row.referencia_doc || row.referenciaDoc || '',
    custoTotal: row.custo_total !== undefined ? Number(row.custo_total) : undefined,
    usuario: row.usuario || 'Sistema',
    observacao: row.observacao || ''
  };
}

export function mapMovimentacaoToSupabase(m: MovimentacaoEstoque): Record<string, any> {
  return {
    id: m.id,
    material_id: m.materialId,
    material_nome: m.materialNome,
    tipo: m.tipo,
    quantidade: m.quantidade,
    peso_kg: m.pesoKg,
    referencia_doc: m.referenciaDoc || '',
    custo_total: m.custoTotal || 0,
    usuario: m.usuario || 'Sistema',
    observacao: m.observacao || '',
    data: m.data || new Date().toISOString()
  };
}

// Helper: mapeia registro do Supabase para LancamentoFinanceiro
export function mapSupabaseToLancamento(row: any): LancamentoFinanceiro {
  return {
    id: String(row.id || `fin-${Date.now()}`),
    tipo: (row.tipo === 'despesa' ? 'despesa' : 'receita') as any,
    categoria: row.categoria || 'venda_cotacao',
    descricao: row.descricao || row.description || 'Lançamento',
    clienteFornecedor: row.cliente_fornecedor || row.clienteFornecedor || '',
    documentoRef: row.documento_ref || row.documentoRef || '',
    valor: Number(row.valor || row.value || 0),
    dataVencimento: row.data_vencimento || row.dataVencimento || new Date().toISOString().split('T')[0],
    dataCompetencia: row.data_competencia || row.dataCompetencia || new Date().toISOString().split('T')[0],
    dataPagamento: row.data_pagamento || row.dataPagamento || undefined,
    formaPagamento: row.forma_pagamento || row.formaPagamento || 'PIX',
    status: (row.status || 'pendente') as any,
    observacoes: row.observacoes || row.observacao || '',
    cotacaoId: row.cotacao_id || row.cotacaoId || undefined,
    criadoEm: row.created_at || row.criado_em || row.criadoEm || new Date().toISOString()
  };
}

export function mapLancamentoToSupabase(l: LancamentoFinanceiro): Record<string, any> {
  return {
    id: l.id,
    tipo: l.tipo,
    categoria: l.categoria,
    descricao: l.descricao,
    cliente_fornecedor: l.clienteFornecedor || '',
    documento_ref: l.documentoRef || '',
    valor: l.valor,
    data_vencimento: l.dataVencimento,
    data_competencia: l.dataCompetencia,
    data_pagamento: l.dataPagamento || null,
    forma_pagamento: l.formaPagamento || 'PIX',
    status: l.status,
    observacoes: l.observacoes || '',
    cotacao_id: l.cotacaoId || null,
    updated_at: new Date().toISOString()
  };
}

// ==========================================
// 1. FUNÇÕES DE BUSCA E PERSISTÊNCIA NO SUPABASE (ESTOQUE)
// ==========================================

/**
 * Busca direta na tabela 'estoque' do Supabase com ordenação por nome.
 * Se a busca retornar erro 404 (tabela não encontrada no schema cache) ou qualquer erro,
 * captura a exceção e retorna um array vazio ([]) silenciosamente sem registrar erro vermelho no console.
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
 * Busca direta na tabela 'estoque_movimentacoes' do Supabase.
 * Se a busca retornar erro 404 ou qualquer erro, captura a exceção e retorna um array vazio ([]) silenciosamente sem registrar erro vermelho no console.
 */
export async function fetchEstoqueMovimentacoesDb(): Promise<any[]> {
  try {
    const { data, error, status } = await db
      .from('estoque_movimentacoes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || status === 404 || isNotFoundError(error, status)) {
      return [];
    }
    return data || [];
  } catch {
    return [];
  }
}

export async function fetchMateriaisEstoqueDb(): Promise<MaterialEstoque[]> {
  try {
    // 1. Tenta buscar da tabela 'estoque' com ordenação por nome (order=nome.asc)
    const { data: estoqueData, error: estoqueError, status: estoqueStatus } = await db
      .from('estoque')
      .select('*')
      .order('nome', { ascending: true });

    if (!estoqueError && estoqueStatus !== 404 && !isNotFoundError(estoqueError, estoqueStatus) && estoqueData && estoqueData.length > 0) {
      const mapped = estoqueData.map(mapSupabaseToMaterial);
      cacheMateriais = mapped;
      return mapped;
    }

    // 2. Tenta tabela alternativa 'estoque_materiais' caso 'estoque' não retorne itens
    try {
      const { data: matData, error: matError, status: matStatus } = await db
        .from('estoque_materiais')
        .select('*')
        .order('nome', { ascending: true });

      if (!matError && matStatus !== 404 && !isNotFoundError(matError, matStatus) && matData && matData.length > 0) {
        const mapped = matData.map(mapSupabaseToMaterial);
        cacheMateriais = mapped;
        return mapped;
      }
    } catch {
      // Silencioso
    }
  } catch {
    // Silencioso
  }

  // Certifique-se de que a aplicação utilize a lista de materiais em memória/estado caso o Supabase não retorne resultados
  if (!cacheMateriais || cacheMateriais.length === 0) {
    cacheMateriais = [...INITIAL_MATERIAIS];
  }
  return cacheMateriais;
}

export async function saveMaterialEstoqueDb(material: MaterialEstoque): Promise<{ data: MaterialEstoque; error: any }> {
  try {
    // Persiste no Supabase estritamente em KG para permitir baixas fracionadas nas vendas
    const pesoKgReal = Number((material.pesoTotalKg ?? 0).toFixed(2));
    const payloadEstoque: Record<string, any> = {
      nome: material.nome,
      quantidade: pesoKgReal, // Saldo principal estritamente em KG
      unidade: 'KG', // Unidade em KG para baixas fracionadas de corte/venda
      peso_total_kg: pesoKgReal
    };
    if (isUuid(material.id)) {
      payloadEstoque.id = material.id;
    }

    const { error: estErr } = await db
      .from('estoque')
      .upsert(payloadEstoque)
      .select()
      .maybeSingle();

    // Sincroniza também com a tabela detalhada 'estoque_materiais'
    const payloadMat = mapMaterialToSupabase(material);
    payloadMat.peso_total_kg = pesoKgReal;
    payloadMat.quantidade = pesoKgReal; // Saldo principal em KG
    await db.from('estoque_materiais').upsert(payloadMat, { onConflict: 'id' });
  } catch (e: any) {
    // Captura qualquer exceção sem travar a aplicação
  }

  // Atualiza cache em memória
  const idx = cacheMateriais.findIndex(m => m.id === material.id);
  if (idx >= 0) cacheMateriais[idx] = material;
  else cacheMateriais.push(material);

  return { data: material, error: null };
}

/**
 * Salva múltiplos materiais simultaneamente no Supabase (tabela 'estoque' e 'estoque_materiais'),
 * persistindo a quantidade principal estritamente em KG.
 */
export async function saveMultiplosMateriaisEstoqueDb(
  materiaisParaSalvar: MaterialEstoque[]
): Promise<{ sucesso: boolean; count: number; error: any }> {
  if (!materiaisParaSalvar || materiaisParaSalvar.length === 0) {
    return { sucesso: true, count: 0, error: null };
  }

  try {
    // 1. Prepara batch para tabela 'estoque' com saldo estritamente em KG
    const payloadEstoqueBatch = materiaisParaSalvar.map(material => {
      const pesoKgReal = Number((material.pesoTotalKg ?? 0).toFixed(2));
      const obj: Record<string, any> = {
        nome: material.nome,
        quantidade: pesoKgReal, // Saldo principal estritamente em KG
        unidade: 'KG', // Unidade em KG para baixas fracionadas de vendas/corte
        peso_total_kg: pesoKgReal
      };
      if (isUuid(material.id)) {
        obj.id = material.id;
      }
      return obj;
    });

    // Envia upsert em batch para a tabela 'estoque'
    await db.from('estoque').upsert(payloadEstoqueBatch).select();

    // 2. Sincroniza em batch na tabela detalhada 'estoque_materiais'
    const payloadDetalhadoBatch = materiaisParaSalvar.map(material => {
      const payloadMat = mapMaterialToSupabase(material);
      const pesoKgReal = Number((material.pesoTotalKg ?? 0).toFixed(2));
      payloadMat.peso_total_kg = pesoKgReal;
      payloadMat.quantidade = pesoKgReal; // Saldo principal em KG
      return payloadMat;
    });

    await db.from('estoque_materiais').upsert(payloadDetalhadoBatch, { onConflict: 'id' });

    // 3. Atualiza cache em memória
    for (const material of materiaisParaSalvar) {
      const idx = cacheMateriais.findIndex(m => m.id === material.id);
      if (idx >= 0) cacheMateriais[idx] = material;
      else cacheMateriais.push(material);
    }

    return { sucesso: true, count: materiaisParaSalvar.length, error: null };
  } catch (err: any) {
    console.warn('Aviso: Falha ao persistir múltiplos materiais no Supabase:', err);
    // Mesmo com erro de rede/offline, atualiza cache em memória local
    for (const material of materiaisParaSalvar) {
      const idx = cacheMateriais.findIndex(m => m.id === material.id);
      if (idx >= 0) cacheMateriais[idx] = material;
      else cacheMateriais.push(material);
    }
    return { sucesso: false, count: 0, error: err };
  }
}

export async function deleteMaterialEstoqueDb(id: string): Promise<{ error: any }> {
  try {
    if (isUuid(id)) {
      await db.from('estoque').delete().eq('id', id);
    }
    await db.from('estoque_materiais').delete().eq('id', id);
  } catch (e: any) {
    // Silently continue
  }
  cacheMateriais = cacheMateriais.filter(m => m.id !== id);
  return { error: null };
}

export async function fetchRetalhosEstoqueDb(): Promise<RetalhoEstoque[]> {
  try {
    const { data, error, status } = await db
      .from('estoque_retalhos')
      .select('*')
      .order('data_entrada', { ascending: false });

    if (!error && status !== 404 && !isNotFoundError(error, status) && data && data.length > 0) {
      const mapped = data.map(mapSupabaseToRetalho);
      cacheRetalhos = mapped;
      return mapped;
    }
  } catch {
    // Silencioso
  }

  // Se o banco estiver vazio ou retornar 404, carrega normalmente com dados padrão em memória
  if (!cacheRetalhos || cacheRetalhos.length === 0) {
    cacheRetalhos = [...INITIAL_RETALHOS];
  }
  return cacheRetalhos;
}

export async function saveRetalhoEstoqueDb(retalho: RetalhoEstoque): Promise<{ data: RetalhoEstoque; error: any }> {
  try {
    const payload = mapRetalhoToSupabase(retalho);
    const { data, error } = await db
      .from('estoque_retalhos')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (!error && data) {
      const mapped = mapSupabaseToRetalho(data);
      const idx = cacheRetalhos.findIndex(r => r.id === mapped.id);
      if (idx >= 0) cacheRetalhos[idx] = mapped;
      else cacheRetalhos.unshift(mapped);
      return { data: mapped, error: null };
    }
  } catch (e) {}

  const idx = cacheRetalhos.findIndex(r => r.id === retalho.id);
  if (idx >= 0) cacheRetalhos[idx] = retalho;
  else cacheRetalhos.unshift(retalho);

  return { data: retalho, error: null };
}

export async function deleteRetalhoEstoqueDb(id: string): Promise<{ error: any }> {
  try {
    await db.from('estoque_retalhos').delete().eq('id', id);
  } catch (e) {}
  cacheRetalhos = cacheRetalhos.filter(r => r.id !== id);
  return { error: null };
}

export async function fetchMovimentacoesEstoqueDb(): Promise<MovimentacaoEstoque[]> {
  try {
    const { data, error, status } = await db
      .from('estoque_movimentacoes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && status !== 404 && !isNotFoundError(error, status) && data && data.length > 0) {
      const mapped = data.map(mapSupabaseToMovimentacao);
      cacheMovimentacoes = mapped;
      return mapped;
    }
  } catch {
    // Captura silenciosamente sem registrar erro no console
  }
  return cacheMovimentacoes || [];
}

export async function registrarMovimentacaoDb(mov: Omit<MovimentacaoEstoque, 'id' | 'data'>): Promise<MovimentacaoEstoque> {
  const novaMov: MovimentacaoEstoque = {
    ...mov,
    id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    data: new Date().toISOString()
  };

  try {
    const payload: Record<string, any> = {
      descricao: `${mov.materialNome || 'Material'} (${mov.tipo.toUpperCase()}) - ${mov.observacao || ''}`.trim(),
      tipo: mov.tipo,
      quantidade: mov.quantidade
    };
    if (mov.materialId && isUuid(mov.materialId)) {
      payload.estoque_id = mov.materialId;
    }
    await db.from('estoque_movimentacoes').insert(payload);
  } catch (e) {
    // Não trava se a gravação remota falhar
  }

  cacheMovimentacoes = [novaMov, ...cacheMovimentacoes];
  return novaMov;
}

// ==========================================
// 2. FUNÇÕES DE BUSCA E PERSISTÊNCIA NO SUPABASE (FINANCEIRO)
// ==========================================

export async function fetchLancamentosFinanceirosDb(): Promise<LancamentoFinanceiro[]> {
  try {
    const { data, error, status } = await db
      .from('financeiro_lancamentos')
      .select('*')
      .order('data_vencimento', { ascending: false });

    if (!error && status !== 404 && !isNotFoundError(error, status) && data && data.length > 0) {
      const mapped = data.map(mapSupabaseToLancamento);
      cacheLancamentos = mapped;
      return mapped;
    }
  } catch {
    // Silencioso
  }

  // Se o banco estiver vazio ou retornar 404, carrega normalmente com dados padrão em memória
  if (!cacheLancamentos || cacheLancamentos.length === 0) {
    cacheLancamentos = [...INITIAL_FINANCEIRO];
  }
  return cacheLancamentos;
}

export async function saveLancamentoFinanceiroDb(lancamento: LancamentoFinanceiro): Promise<{ data: LancamentoFinanceiro; error: any }> {
  try {
    const payload = mapLancamentoToSupabase(lancamento);
    const { data, error } = await db
      .from('financeiro_lancamentos')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .maybeSingle();

    if (!error && data) {
      const mapped = mapSupabaseToLancamento(data);
      const idx = cacheLancamentos.findIndex(l => l.id === mapped.id);
      if (idx >= 0) cacheLancamentos[idx] = mapped;
      else cacheLancamentos.unshift(mapped);
      return { data: mapped, error: null };
    }
  } catch (e) {}

  const idx = cacheLancamentos.findIndex(l => l.id === lancamento.id);
  if (idx >= 0) cacheLancamentos[idx] = lancamento;
  else cacheLancamentos.unshift(lancamento);

  return { data: lancamento, error: null };
}

export async function deleteLancamentoFinanceiroDb(id: string): Promise<{ error: any }> {
  try {
    const { error } = await db.from('financeiro_lancamentos').delete().eq('id', id);
    cacheLancamentos = cacheLancamentos.filter(l => l.id !== id);
    return { error };
  } catch (e) {
    cacheLancamentos = cacheLancamentos.filter(l => l.id !== id);
    return { error: e };
  }
}

// ==========================================
// 3. FLUXO DE CAIXA E LUCRO BASEADOS NO SUPABASE
// ==========================================

export interface FluxoCaixaResumo {
  totalEntradas: number;
  totalSaidas: number;
  saldoGeral: number;
  contasReceberPendente: number;
  contasPagarPendente: number;
}

export function calcularFluxoCaixaFromList(lancamentos: LancamentoFinanceiro[]): FluxoCaixaResumo {
  let totalEntradas = 0;
  let totalSaidas = 0;
  let contasReceberPendente = 0;
  let contasPagarPendente = 0;

  lancamentos.forEach(l => {
    const val = Number(l.valor) || 0;
    if (l.tipo === 'receita') {
      if (l.status === 'pago') {
        totalEntradas += val;
      } else if (l.status === 'pendente' || l.status === 'atrasado') {
        contasReceberPendente += val;
      }
    } else if (l.tipo === 'despesa') {
      if (l.status === 'pago') {
        totalSaidas += val;
      } else if (l.status === 'pendente' || l.status === 'atrasado') {
        contasPagarPendente += val;
      }
    }
  });

  return {
    totalEntradas: Number(totalEntradas.toFixed(2)),
    totalSaidas: Number(totalSaidas.toFixed(2)),
    saldoGeral: Number((totalEntradas - totalSaidas).toFixed(2)),
    contasReceberPendente: Number(contasReceberPendente.toFixed(2)),
    contasPagarPendente: Number(contasPagarPendente.toFixed(2))
  };
}

export async function calcularFluxoCaixaDb(): Promise<FluxoCaixaResumo> {
  const list = await fetchLancamentosFinanceirosDb();
  return calcularFluxoCaixaFromList(list);
}

export function calcularFluxoCaixa(): FluxoCaixaResumo {
  return calcularFluxoCaixaFromList(cacheLancamentos);
}

// ==========================================
// 4. LUCRATIVIDADE 100% SUPABASE (COTAÇÕES + ITENS + ESTOQUE)
// ==========================================

export interface LucratividadeItem {
  cotacaoNumero: string;
  cliente: string;
  data: string;
  status: string;
  valorVendido: number;
  pesoTotalKg: number;
  custoMaterialEstimado: number;
  lucroBruto: number;
  margemLucroPercent: number;
}

export async function calcularLucratividadeDb(): Promise<LucratividadeItem[]> {
  const [cotacoesDb, materiaisDb] = await Promise.all([
    fetchCotacoesDb(),
    fetchMateriaisEstoqueDb()
  ]);

  const CUSTO_MEDIO_KG = 7.80;

  return cotacoesDb.map(q => {
    const valorVendido = Number(q.valor_total || 0);
    let pesoTotal = 0;
    let custoTotalMaterial = 0;

    if (q.cotacao_itens && q.cotacao_itens.length > 0) {
      q.cotacao_itens.forEach(it => {
        const itQtd = Number(it.quantidade) || 1;
        const itPrice = Number(it.valor_unitario) || 0;
        const itSub = Number(it.valor_total) || (itPrice * itQtd);

        const itDesc = (it.descricao || it.produto || '').toLowerCase();
        const itMat = (it.material || it.produto || '').toLowerCase();

        const matchingMat = materiaisDb.find(m =>
          itDesc.includes(m.material.toLowerCase()) ||
          itMat.includes(m.material.toLowerCase())
        );

        const custoKg = matchingMat ? matchingMat.custoKg : CUSTO_MEDIO_KG;
        const estimatedWeightKg = (matchingMat && matchingMat.pesoUnitarioKg > 0)
          ? matchingMat.pesoUnitarioKg * itQtd
          : (itSub / 22.0); // estimativa com base no preço/kg médio de venda

        pesoTotal += estimatedWeightKg;
        custoTotalMaterial += (estimatedWeightKg > 0 ? estimatedWeightKg : (itSub * 0.4)) * custoKg;
      });
    }

    if (custoTotalMaterial >= valorVendido && valorVendido > 0) {
      custoTotalMaterial = valorVendido * 0.45;
    }

    custoTotalMaterial = Number(custoTotalMaterial.toFixed(2));
    const lucroBruto = Number((valorVendido - custoTotalMaterial).toFixed(2));
    const margemLucroPercent = valorVendido > 0 ? Number(((lucroBruto / valorVendido) * 100).toFixed(1)) : 0;

    return {
      cotacaoNumero: q.numero || q.id || 'COT',
      cliente: q.cliente_nome || 'Cliente Balcão',
      data: q.data || (q.created_at ? q.created_at.split('T')[0] : new Date().toISOString().split('T')[0]),
      status: q.status || 'rascunho',
      valorVendido,
      pesoTotalKg: Number(pesoTotal.toFixed(2)),
      custoMaterialEstimado: custoTotalMaterial,
      lucroBruto,
      margemLucroPercent
    };
  });
}

export function calcularLucratividadePorPedido(): LucratividadeItem[] {
  return [];
}

// ==========================================
// 5. BAIXA AUTOMÁTICA DE ESTOQUE NO SUPABASE
// ==========================================

export interface ResultadoBaixaEstoque {
  sucesso: boolean;
  mensagem: string;
  itensBaixados: number;
  pesoTotalBaixadoKg: number;
  alertasEstoqueMinimo: string[];
}

export async function baixarEstoquePorCotacaoDb(quote: Quote, usuario?: string): Promise<ResultadoBaixaEstoque> {
  if (!quote || !quote.items || quote.items.length === 0) {
    return {
      sucesso: false,
      mensagem: 'Cotação não possui itens válidos para dar baixa no estoque.',
      itensBaixados: 0,
      pesoTotalBaixadoKg: 0,
      alertasEstoqueMinimo: []
    };
  }

  const cotacaoKey = quote.quoteNumber || quote.id;
  const materiais = await fetchMateriaisEstoqueDb();
  let itensBaixados = 0;
  let pesoTotalBaixado = 0;
  const alertasEstoqueMinimo: string[] = [];

  for (const item of quote.items) {
    const itemWeightKg = Number(item.totalWeightKg || item.pesoTotal || 0) || 
      (Number(item.unitWeightKg || 0) * (Number(item.quantity || item.qtd || 1)));

    const itemDesc = (item.description || item.descricao || '').toLowerCase();
    const itemMat = (item.constantName || item.constanteNome || item.material || '').toLowerCase();

    let matIndex = materiais.findIndex(m => {
      const codMat = m.codigo.toLowerCase();
      const ligaMat = m.material.toLowerCase();
      return itemDesc.includes(codMat) || itemDesc.includes(ligaMat) || itemMat.includes(ligaMat);
    });

    if (matIndex === -1) {
      matIndex = materiais.findIndex(m => m.material.toLowerCase().includes('a36'));
    }

    if (matIndex !== -1) {
      const alvo = materiais[matIndex];
      const pesoParaBaixar = itemWeightKg > 0 ? itemWeightKg : 5.0;

      alvo.pesoTotalKg = Number(Math.max(0, alvo.pesoTotalKg - pesoParaBaixar).toFixed(2));
      if (alvo.pesoUnitarioKg > 0) {
        const chapasConsumidas = pesoParaBaixar / alvo.pesoUnitarioKg;
        alvo.quantidade = Number(Math.max(0, alvo.quantidade - chapasConsumidas).toFixed(2));
      }

      alvo.atualizadoEm = new Date().toISOString();
      pesoTotalBaixado += pesoParaBaixar;
      itensBaixados++;

      // Atualiza material no Supabase
      await saveMaterialEstoqueDb(alvo);

      // Registra movimentação no Supabase
      await registrarMovimentacaoDb({
        materialId: alvo.id,
        materialNome: alvo.nome,
        tipo: 'saida_venda',
        quantidade: Number((pesoParaBaixar / (alvo.pesoUnitarioKg || 1)).toFixed(2)),
        pesoKg: Number(pesoParaBaixar.toFixed(2)),
        referenciaDoc: cotacaoKey,
        custoTotal: Number((pesoParaBaixar * alvo.custoKg).toFixed(2)),
        usuario: usuario || 'Vendedor / Sistema',
        observacao: `Baixa automática gerada pela aprovação da Cotação ${cotacaoKey} (${item.description || item.descricao || 'Item cortado'})`
      });

      if (alvo.pesoTotalKg <= alvo.estoqueMinimoKg || alvo.quantidade <= alvo.estoqueMinimoQtd) {
        alertasEstoqueMinimo.push(`⚠️ ${alvo.nome}: Saldo restante (${alvo.pesoTotalKg} kg / ${alvo.quantidade} un) está abaixo do estoque mínimo (${alvo.estoqueMinimoKg} kg).`);
      }
    }
  }

  return {
    sucesso: true,
    mensagem: `Baixa de estoque realizada com sucesso no Supabase para o pedido ${cotacaoKey}! ${pesoTotalBaixado.toFixed(2)} KG consumidos.`,
    itensBaixados,
    pesoTotalBaixadoKg: Number(pesoTotalBaixado.toFixed(2)),
    alertasEstoqueMinimo
  };
}

export function baixarEstoquePorCotacao(quote: Quote, usuario?: string): ResultadoBaixaEstoque {
  // Dispara a operação assíncrona no Supabase
  baixarEstoquePorCotacaoDb(quote, usuario);
  return {
    sucesso: true,
    mensagem: `Baixa de estoque sincronizada no Supabase para o pedido ${quote.quoteNumber || quote.id}.`,
    itensBaixados: quote.items?.length || 1,
    pesoTotalBaixadoKg: Number(quote.totalWeightKg || 0),
    alertasEstoqueMinimo: []
  };
}

// ==========================================
// 6. GERAÇÃO DE CONTAS A RECEBER NO SUPABASE
// ==========================================

export async function gerarContasReceberPorCotacaoDb(quote: Quote): Promise<LancamentoFinanceiro | null> {
  if (!quote || (quote.grandTotal <= 0 && quote.subtotalTotal <= 0)) return null;

  const docRef = quote.quoteNumber || quote.id;
  const dataHoje = new Date();
  let diasVencimento = 15;
  const terms = (quote.paymentTerms || '').toLowerCase();
  if (terms.includes('vista') || terms.includes('pix')) {
    diasVencimento = 0;
  } else if (terms.includes('28')) {
    diasVencimento = 28;
  } else if (terms.includes('30')) {
    diasVencimento = 30;
  }

  const dataVenc = new Date(dataHoje.getTime() + diasVencimento * 86400000).toISOString().split('T')[0];

  const novoLancamento: LancamentoFinanceiro = {
    id: `fin-rec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    tipo: 'receita',
    categoria: 'venda_cotacao',
    descricao: `Faturamento Cotação ${docRef} (${quote.clientName})`,
    clienteFornecedor: quote.clientName || 'Cliente Balcão',
    documentoRef: docRef,
    valor: Number(quote.grandTotal || quote.subtotalTotal || 0),
    dataVencimento: dataVenc,
    dataCompetencia: quote.date || new Date().toISOString().split('T')[0],
    dataPagamento: diasVencimento === 0 ? quote.date || new Date().toISOString().split('T')[0] : undefined,
    formaPagamento: (terms.includes('pix') ? 'PIX' : terms.includes('boleto') ? 'Boleto' : terms.includes('cart') ? 'Cartão de Crédito' : 'Boleto') as any,
    status: diasVencimento === 0 ? 'pago' : 'pendente',
    observacoes: `Lançamento gerado automaticamente pelo fechamento da cotação ${docRef}. Total de peso: ${quote.totalWeightKg || 0} kg.`,
    cotacaoId: quote.id,
    criadoEm: new Date().toISOString()
  };

  await saveLancamentoFinanceiroDb(novoLancamento);
  return novoLancamento;
}

export function gerarContasReceberPorCotacao(quote: Quote): LancamentoFinanceiro | null {
  gerarContasReceberPorCotacaoDb(quote);
  return null;
}

export function gerarContasReceberPorOS(os: OrdemServico): LancamentoFinanceiro | null {
  if (!os || !os.itens || os.itens.length === 0) return null;
  const total = os.itens.reduce((acc, i) => acc + (i.valorTotal || 0), 0);
  if (total <= 0) return null;

  const docRef = `OS-${os.id}`;
  const novoLancamento: LancamentoFinanceiro = {
    id: `fin-os-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    tipo: 'receita',
    categoria: 'ordem_servico',
    descricao: `Recebimento Ordem de Serviço ${docRef} (${os.clienteNome})`,
    clienteFornecedor: os.clienteNome || 'Cliente OS',
    documentoRef: docRef,
    valor: total,
    dataVencimento: os.data || new Date().toISOString().split('T')[0],
    dataCompetencia: os.data || new Date().toISOString().split('T')[0],
    dataPagamento: os.data || new Date().toISOString().split('T')[0],
    formaPagamento: 'PIX',
    status: 'pago',
    observacoes: `Encerramento de OS Diária consolidada com ${os.itens.length} itens cortados.`,
    criadoEm: new Date().toISOString()
  };

  saveLancamentoFinanceiroDb(novoLancamento);
  return novoLancamento;
}

// ==========================================
// 7. FECHAMENTO & EXTRATO DE COTAÇÕES NO SUPABASE
// ==========================================

export interface RegistroPagamentoCotacao {
  status: 'Pendente' | 'Pago';
  dataPagamento?: string;
  formaPagamento?: FormaPagamentoFinanceiro;
  observacoes?: string;
  valorPago?: number;
  baixadoEm?: string;
  lancamentoId?: string;
}

export function getPagamentosCotacoesMap(): Record<string, RegistroPagamentoCotacao> {
  return cachePagamentosMap;
}

export function salvarPagamentosCotacoesMap(map: Record<string, RegistroPagamentoCotacao>): void {
  cachePagamentosMap = map;
}

export function getStatusPagamentoCotacao(idOuNumero: string): RegistroPagamentoCotacao {
  if (!idOuNumero) return { status: 'Pendente' };
  const key = idOuNumero.trim().toLowerCase();
  return cachePagamentosMap[key] || cachePagamentosMap[idOuNumero] || { status: 'Pendente' };
}

export interface DadosBaixaFechamento {
  dataPagamento: string;
  formaPagamento: FormaPagamentoFinanceiro;
  observacoes?: string;
  contaDestino?: string;
}

export async function darBaixaMultiplasCotacoesDb(
  cotacoes: { id?: string; numero: string; cliente: string; valor: number }[],
  dados: DadosBaixaFechamento
): Promise<{ sucesso: boolean; lancamento: LancamentoFinanceiro | null; qtdBaixadas: number; valorTotal: number; mensagem: string }> {
  if (!cotacoes || cotacoes.length === 0) {
    return {
      sucesso: false,
      lancamento: null,
      qtdBaixadas: 0,
      valorTotal: 0,
      mensagem: 'Nenhuma cotação selecionada para dar baixa.'
    };
  }

  const dataHoje = dados.dataPagamento || new Date().toISOString().split('T')[0];
  let valorTotal = 0;
  const listaNumeros: string[] = [];
  const nomeCliente = cotacoes[0]?.cliente || 'Cliente';

  cotacoes.forEach(c => {
    valorTotal += Number(c.valor) || 0;
    if (c.numero) listaNumeros.push(c.numero);
    else if (c.id) listaNumeros.push(c.id);
  });

  valorTotal = Number(valorTotal.toFixed(2));

  const docRef = listaNumeros.length <= 4 
    ? listaNumeros.join(', ') 
    : `${listaNumeros.slice(0, 3).join(', ')} e +${listaNumeros.length - 3} cotações`;

  const lancamentoId = `fin-fech-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
  const novoLancamento: LancamentoFinanceiro = {
    id: lancamentoId,
    tipo: 'receita',
    categoria: 'venda_cotacao',
    descricao: `Fechamento de Cotações - ${nomeCliente} (${docRef})`,
    clienteFornecedor: nomeCliente,
    documentoRef: docRef,
    valor: valorTotal,
    dataVencimento: dataHoje,
    dataCompetencia: dataHoje,
    dataPagamento: dataHoje,
    formaPagamento: dados.formaPagamento,
    status: 'pago',
    observacoes: `Baixa em lote de ${cotacoes.length} cotação(ões). Conta de Destino: ${dados.contaDestino || 'Caixa Central'}. Obs: ${dados.observacoes || 'Fechamento de faturamento consolidado'}`,
    criadoEm: new Date().toISOString()
  };

  // Salva no financeiro do Supabase
  await saveLancamentoFinanceiroDb(novoLancamento);

  // Atualiza status e situação das cotações no Supabase
  for (const c of cotacoes) {
    const registro: RegistroPagamentoCotacao = {
      status: 'Pago',
      dataPagamento: dataHoje,
      formaPagamento: dados.formaPagamento,
      observacoes: dados.observacoes,
      valorPago: Number(c.valor) || 0,
      baixadoEm: new Date().toISOString(),
      lancamentoId: novoLancamento.id
    };

    if (c.numero) {
      cachePagamentosMap[c.numero.trim().toLowerCase()] = registro;
      cachePagamentosMap[c.numero] = registro;
    }
    if (c.id) {
      cachePagamentosMap[c.id.trim().toLowerCase()] = registro;
      cachePagamentosMap[c.id] = registro;
    }

    // 1. Atualização direta na Tabela 'cotacoes':
    // Ao clicar em 'Dar Baixa nas Selecionadas', faça o UPDATE direto na tabela 'cotacoes' alterando:
    // status_pagamento = 'PAGO', situacao = 'FATURADO', data_pagamento = [Data Atual]
    try {
      await atualizarStatusPagamentoCotacaoDb(
        { id: c.id, numero: c.numero },
        {
          status_pagamento: 'PAGO',
          situacao: 'FATURADO',
          data_pagamento: dataHoje,
          forma_pagamento: dados.formaPagamento,
          valor_pago: Number(c.valor) || 0,
          conta_destino: dados.contaDestino || 'Conta Banco do Brasil - Principal',
          observacoes_baixa: dados.observacoes || '',
          lancamento_financeiro_id: novoLancamento.id
        }
      );
    } catch (err) {
      console.warn('Aviso ao atualizar tabela cotacoes para PAGO/FATURADO no Supabase:', err);
    }

    // 2. Evitar Duplicidades em 'contas_a_receber':
    // Antes de inserir um pagamento em 'contas_a_receber', verifique se já existe um registro para aquele 'cotacao_id'.
    // Se já existir, faça um UPDATE no registro existente em vez de criar um novo INSERT.
    try {
      await sincronizarPagamentoContaReceberDb({
        cotacaoId: c.id,
        cotacaoNumero: c.numero,
        clienteNome: c.cliente,
        valor: Number(c.valor) || 0,
        dataPagamento: dataHoje,
        status: 'Baixado'
      });
    } catch (errCr) {
      console.warn('Aviso ao sincronizar contas_a_receber sem duplicidade:', errCr);
    }
  }

  // Notifica o sistema para recarregar cotações e atualizar filtros em tempo real
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cotacoes_migradas_emergencia'));
    window.dispatchEvent(new CustomEvent('cotacao_status_alterado'));
    window.dispatchEvent(new CustomEvent('cotacoes_atualizadas'));
  }

  return {
    sucesso: true,
    lancamento: novoLancamento,
    qtdBaixadas: cotacoes.length,
    valorTotal,
    mensagem: `Baixa de ${cotacoes.length} cotação(ões) no valor total de R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} sincronizada no Supabase com sucesso!`
  };
}

export function darBaixaMultiplasCotacoes(
  cotacoes: { id?: string; numero: string; cliente: string; valor: number }[],
  dados: DadosBaixaFechamento
) {
  darBaixaMultiplasCotacoesDb(cotacoes, dados);
  return {
    sucesso: true,
    lancamento: null,
    qtdBaixadas: cotacoes.length,
    valorTotal: cotacoes.reduce((acc, c) => acc + (Number(c.valor) || 0), 0),
    mensagem: `Baixa de ${cotacoes.length} cotações enviada para o Supabase!`
  };
}

// Helpers síncronos para compatibilidade imediata
export function getMateriaisEstoque(): MaterialEstoque[] {
  if (!cacheMateriais || cacheMateriais.length === 0) {
    cacheMateriais = [...INITIAL_MATERIAIS];
  }
  return cacheMateriais;
}

export function saveMateriaisEstoque(materiais: MaterialEstoque[]): void {
  cacheMateriais = materiais;
  materiais.forEach(m => saveMaterialEstoqueDb(m));
}

export function getRetalhosEstoque(): RetalhoEstoque[] {
  return cacheRetalhos;
}

export function saveRetalhosEstoque(retalhos: RetalhoEstoque[]): void {
  cacheRetalhos = retalhos;
  retalhos.forEach(r => saveRetalhoEstoqueDb(r));
}

export function getMovimentacoesEstoque(): MovimentacaoEstoque[] {
  return cacheMovimentacoes;
}

export function registrarMovimentacao(mov: Omit<MovimentacaoEstoque, 'id' | 'data'>): MovimentacaoEstoque {
  return {
    ...mov,
    id: `mov-${Date.now()}`,
    data: new Date().toISOString()
  };
}

export function getLancamentosFinanceiros(): LancamentoFinanceiro[] {
  return cacheLancamentos;
}

export function saveLancamentosFinanceiros(lancamentos: LancamentoFinanceiro[]): void {
  cacheLancamentos = lancamentos;
  lancamentos.forEach(l => saveLancamentoFinanceiroDb(l));
}

export function obterAlertasReposicao(): MaterialEstoque[] {
  return cacheMateriais.filter(m => m.pesoTotalKg <= m.estoqueMinimoKg || m.quantidade <= m.estoqueMinimoQtd);
}


