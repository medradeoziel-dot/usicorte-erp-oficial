import { 
  MaterialEstoque, 
  RetalhoEstoque, 
  MovimentacaoEstoque, 
  LancamentoFinanceiro, 
  Quote, 
  OrdemServico 
} from '../types';
import { db } from '../lib/db';

const STORAGE_KEY_MATERIAIS = 's_estoque_materiais';
const STORAGE_KEY_RETALHOS = 's_estoque_retalhos';
const STORAGE_KEY_MOVIMENTACOES = 's_estoque_movimentacoes';
const STORAGE_KEY_FINANCEIRO = 's_financeiro_lancamentos';
const STORAGE_KEY_BAIXAS_COTACAO = 's_cotacoes_estoque_baixado';

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
    quantidade: 3, // Abaixo do mínimo propositalmente para testar alertas
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
    quantidade: 2, // Alerta crítico
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

// ==========================================
// FUNÇÕES DE SERVIÇO DE ESTOQUE
// ==========================================

export function getMateriaisEstoque(): MaterialEstoque[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MATERIAIS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Erro ao ler materiais do localStorage:', e);
  }
  localStorage.setItem(STORAGE_KEY_MATERIAIS, JSON.stringify(INITIAL_MATERIAIS));
  return INITIAL_MATERIAIS;
}

export function saveMateriaisEstoque(materiais: MaterialEstoque[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_MATERIAIS, JSON.stringify(materiais));
    // Tenta sincronizar com Supabase se a tabela existir
    try {
      db.from('estoque_materiais').upsert(materiais.map(m => ({
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
        updated_at: new Date().toISOString()
      }))).then(res => {
        if (res.error) console.warn('Supabase estoque_materiais aviso:', res.error.message);
      }, () => {});
    } catch (err) {}
  } catch (e) {
    console.error('Erro ao salvar materiais:', e);
  }
}

export function getRetalhosEstoque(): RetalhoEstoque[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_RETALHOS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  localStorage.setItem(STORAGE_KEY_RETALHOS, JSON.stringify(INITIAL_RETALHOS));
  return INITIAL_RETALHOS;
}

export function saveRetalhosEstoque(retalhos: RetalhoEstoque[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_RETALHOS, JSON.stringify(retalhos));
  } catch (e) {
    console.error('Erro ao salvar retalhos:', e);
  }
}

export function getMovimentacoesEstoque(): MovimentacaoEstoque[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MOVIMENTACOES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

export function registrarMovimentacao(mov: Omit<MovimentacaoEstoque, 'id' | 'data'>): MovimentacaoEstoque {
  const novaMov: MovimentacaoEstoque = {
    ...mov,
    id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    data: new Date().toISOString()
  };
  const list = getMovimentacoesEstoque();
  const updated = [novaMov, ...list];
  localStorage.setItem(STORAGE_KEY_MOVIMENTACOES, JSON.stringify(updated));
  return novaMov;
}

// ==========================================
// BAIXA AUTOMÁTICA DE ESTOQUE POR COTAÇÃO/VENDA
// ==========================================

export interface ResultadoBaixaEstoque {
  sucesso: boolean;
  mensagem: string;
  itensBaixados: number;
  pesoTotalBaixadoKg: number;
  alertasEstoqueMinimo: string[];
}

export function baixarEstoquePorCotacao(quote: Quote, usuario?: string): ResultadoBaixaEstoque {
  if (!quote || !quote.items || quote.items.length === 0) {
    return {
      sucesso: false,
      mensagem: 'Cotação não possui itens válidos para dar baixa no estoque.',
      itensBaixados: 0,
      pesoTotalBaixadoKg: 0,
      alertasEstoqueMinimo: []
    };
  }

  // Verifica se esta cotação já foi baixada anteriormente para evitar duplicidade
  let baixadas: string[] = [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY_BAIXAS_COTACAO);
    if (saved) baixadas = JSON.parse(saved);
  } catch (e) {}

  const cotacaoKey = quote.quoteNumber || quote.id;
  if (baixadas.includes(cotacaoKey)) {
    return {
      sucesso: true,
      mensagem: `A cotação ${cotacaoKey} já teve seu estoque baixado anteriormente.`,
      itensBaixados: 0,
      pesoTotalBaixadoKg: 0,
      alertasEstoqueMinimo: []
    };
  }

  const materiais = getMateriaisEstoque();
  let itensBaixados = 0;
  let pesoTotalBaixado = 0;
  const alertasEstoqueMinimo: string[] = [];

  const materiaisAtualizados = materiais.map(mat => ({ ...mat }));

  quote.items.forEach(item => {
    const itemWeightKg = Number(item.totalWeightKg || item.pesoTotal || 0) || 
      (Number(item.unitWeightKg || 0) * (Number(item.quantity || item.qtd || 1)));
    
    const itemDesc = (item.description || item.descricao || '').toLowerCase();
    const itemMat = (item.constantName || item.constanteNome || item.material || '').toLowerCase();
    const itemMeasure = (item.measure || item.medida || '').toLowerCase();

    // Tenta encontrar o material no estoque que melhor corresponde
    let matIndex = materiaisAtualizados.findIndex(m => {
      const nomeMat = m.nome.toLowerCase();
      const codMat = m.codigo.toLowerCase();
      const ligaMat = m.material.toLowerCase();
      
      // Match exato de código ou nome
      if (itemDesc.includes(codMat) || itemDesc.includes(m.material.toLowerCase())) {
        if (m.espessuraMm && itemMeasure.includes(m.espessuraMm.toString())) return true;
        if (m.espessuraMm && itemDesc.includes(m.espessuraMm.toString())) return true;
      }

      // Match por tipo e espessura aproximada
      if (itemMat.includes(ligaMat) || itemDesc.includes(ligaMat)) {
        if (m.espessuraMm && (itemMeasure.includes(m.espessuraMm.toString()) || itemDesc.includes(m.espessuraMm.toString()))) {
          return true;
        }
      }

      return false;
    });

    // Se não encontrou por correspondência estrita, pega pelo tipo de liga padrão
    if (matIndex === -1) {
      if (itemMat.includes('inox') || itemDesc.includes('inox')) {
        matIndex = materiaisAtualizados.findIndex(m => m.material.toLowerCase().includes('inox'));
      } else if (itemMat.includes('1045') || itemDesc.includes('1045')) {
        matIndex = materiaisAtualizados.findIndex(m => m.material.toLowerCase().includes('1045'));
      } else if (itemMat.includes('1020') || itemDesc.includes('1020')) {
        matIndex = materiaisAtualizados.findIndex(m => m.material.toLowerCase().includes('1020'));
      } else {
        // Default A36
        matIndex = materiaisAtualizados.findIndex(m => m.material.toLowerCase().includes('a36'));
      }
    }

    if (matIndex !== -1) {
      const alvo = materiaisAtualizados[matIndex];
      const pesoParaBaixar = itemWeightKg > 0 ? itemWeightKg : 5.0; // fallback mínimo
      
      // Atualiza peso total e calcula fração de chapas consumidas
      alvo.pesoTotalKg = Number(Math.max(0, alvo.pesoTotalKg - pesoParaBaixar).toFixed(2));
      if (alvo.pesoUnitarioKg > 0) {
        const chapasConsumidas = pesoParaBaixar / alvo.pesoUnitarioKg;
        alvo.quantidade = Number(Math.max(0, alvo.quantidade - chapasConsumidas).toFixed(2));
      }

      alvo.atualizadoEm = new Date().toISOString();
      pesoTotalBaixado += pesoParaBaixar;
      itensBaixados++;

      // Registra movimentação de saída
      registrarMovimentacao({
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

      // Checa se atingiu o estoque mínimo
      if (alvo.pesoTotalKg <= alvo.estoqueMinimoKg || alvo.quantidade <= alvo.estoqueMinimoQtd) {
        alertasEstoqueMinimo.push(`⚠️ ${alvo.nome}: Saldo restante (${alvo.pesoTotalKg} kg / ${alvo.quantidade} un) está abaixo do estoque mínimo (${alvo.estoqueMinimoKg} kg).`);
      }
    }
  });

  // Salva os materiais atualizados
  saveMateriaisEstoque(materiaisAtualizados);

  // Registra que a cotação já foi baixada
  baixadas.push(cotacaoKey);
  localStorage.setItem(STORAGE_KEY_BAIXAS_COTACAO, JSON.stringify(baixadas));

  return {
    sucesso: true,
    mensagem: `Baixa de estoque realizada com sucesso para o pedido ${cotacaoKey}! ${pesoTotalBaixado.toFixed(2)} KG consumidos.`,
    itensBaixados,
    pesoTotalBaixadoKg: Number(pesoTotalBaixado.toFixed(2)),
    alertasEstoqueMinimo
  };
}

// ==========================================
// FUNÇÕES DE SERVIÇO FINANCEIRO
// ==========================================

export function getLancamentosFinanceiros(): LancamentoFinanceiro[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_FINANCEIRO);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  localStorage.setItem(STORAGE_KEY_FINANCEIRO, JSON.stringify(INITIAL_FINANCEIRO));
  return INITIAL_FINANCEIRO;
}

export function saveLancamentosFinanceiros(lancamentos: LancamentoFinanceiro[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_FINANCEIRO, JSON.stringify(lancamentos));
    // Sincroniza com Supabase se disponível
    try {
      db.from('financeiro_lancamentos').upsert(lancamentos.map(l => ({
        id: l.id,
        tipo: l.tipo,
        categoria: l.categoria,
        descricao: l.descricao,
        cliente_fornecedor: l.clienteFornecedor,
        documento_ref: l.documentoRef,
        valor: l.valor,
        data_vencimento: l.dataVencimento,
        data_competencia: l.dataCompetencia,
        data_pagamento: l.dataPagamento || null,
        forma_pagamento: l.formaPagamento,
        status: l.status,
        observacoes: l.observacoes,
        cotacao_id: l.cotacaoId || null,
        updated_at: new Date().toISOString()
      }))).then(res => {
        if (res.error) console.warn('Supabase financeiro_lancamentos aviso:', res.error.message);
      }, () => {});
    } catch (e) {}
  } catch (e) {
    console.error('Erro ao salvar lançamentos financeiros:', e);
  }
}

export interface FluxoCaixaResumo {
  totalEntradas: number;
  totalSaidas: number;
  saldoGeral: number;
  contasReceberPendente: number;
  contasPagarPendente: number;
}

export function calcularFluxoCaixa(): FluxoCaixaResumo {
  const lancamentos = getLancamentosFinanceiros();
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

export function gerarContasReceberPorCotacao(quote: Quote): LancamentoFinanceiro | null {
  if (!quote || (quote.grandTotal <= 0 && quote.subtotalTotal <= 0)) return null;

  const lancamentos = getLancamentosFinanceiros();
  const docRef = quote.quoteNumber || quote.id;

  // Evita duplicidade se já houver lançamento gerado para este pedido
  const jaExiste = lancamentos.find(l => l.documentoRef === docRef && l.tipo === 'receita');
  if (jaExiste) {
    return jaExiste;
  }

  // Calcula data de vencimento com base na condição de pagamento ou prazo padrão (15 dias)
  const dataHoje = new Date();
  let diasVencimento = 15;
  const terms = (quote.paymentTerms || '').toLowerCase();
  if (terms.includes('vista') || terms.includes('pix')) {
    diasVencimento = 0;
  } else if (terms.includes('28')) {
    diasVencimento = 28;
  } else if (terms.includes('30')) {
    diasVencimento = 30;
  } else if (terms.includes('45')) {
    diasVencimento = 45;
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

  saveLancamentosFinanceiros([novoLancamento, ...lancamentos]);
  return novoLancamento;
}

export function gerarContasReceberPorOS(os: OrdemServico): LancamentoFinanceiro | null {
  if (!os || !os.itens || os.itens.length === 0) return null;

  const total = os.itens.reduce((acc, i) => acc + (i.valorTotal || 0), 0);
  if (total <= 0) return null;

  const lancamentos = getLancamentosFinanceiros();
  const docRef = `OS-${os.id}`;

  const jaExiste = lancamentos.find(l => l.documentoRef === docRef && l.tipo === 'receita');
  if (jaExiste) return jaExiste;

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

  saveLancamentosFinanceiros([novoLancamento, ...lancamentos]);
  return novoLancamento;
}

// ==========================================
// RELATÓRIOS CONSOLIDADOS & LUCRATIVIDADE
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

export function calcularLucratividadePorPedido(): LucratividadeItem[] {
  let quotes: Quote[] = [];
  try {
    const saved = localStorage.getItem('s_orcamentos');
    if (saved) {
      quotes = JSON.parse(saved);
    }
  } catch (e) {}

  const materiais = getMateriaisEstoque();

  // Custo médio por kg se não houver material exato: R$ 7.80/kg
  const CUSTO_MEDIO_KG = 7.80;

  return quotes.map(q => {
    const valorVendido = Number(q.grandTotal || q.subtotalTotal || 0);
    const pesoTotal = Number(q.totalWeightKg || 0);

    let custoTotalMaterial = 0;

    if (q.items && q.items.length > 0) {
      q.items.forEach(it => {
        const itWeight = Number(it.totalWeightKg || it.pesoTotal || 0) || 
          (Number(it.unitWeightKg || 0) * (Number(it.quantity || it.qtd || 1)));

        // Tenta achar custo do material
        const matDesc = (it.description || it.descricao || '').toLowerCase();
        const matName = (it.constantName || it.constanteNome || it.material || '').toLowerCase();
        
        const matchingMat = materiais.find(m => 
          matDesc.includes(m.material.toLowerCase()) || 
          matName.includes(m.material.toLowerCase())
        );

        const custoKg = matchingMat ? matchingMat.custoKg : CUSTO_MEDIO_KG;
        custoTotalMaterial += (itWeight > 0 ? itWeight : (it.unitPrice * 0.4)) * custoKg;
      });
    } else {
      custoTotalMaterial = pesoTotal * CUSTO_MEDIO_KG;
    }

    // Se o custo ficou maior que o valor vendido (ex: serviço puro), ajusta com proporção de corte
    if (custoTotalMaterial >= valorVendido && valorVendido > 0) {
      custoTotalMaterial = valorVendido * 0.45;
    }

    custoTotalMaterial = Number(custoTotalMaterial.toFixed(2));
    const lucroBruto = Number((valorVendido - custoTotalMaterial).toFixed(2));
    const margemLucroPercent = valorVendido > 0 ? Number(((lucroBruto / valorVendido) * 100).toFixed(1)) : 0;

    return {
      cotacaoNumero: q.quoteNumber || q.id,
      cliente: q.clientName || 'Cliente Balcão',
      data: q.date || q.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
      status: q.status || 'Rascunho',
      valorVendido,
      pesoTotalKg: pesoTotal,
      custoMaterialEstimado: custoTotalMaterial,
      lucroBruto,
      margemLucroPercent
    };
  });
}

export function obterAlertasReposicao(): MaterialEstoque[] {
  const materiais = getMateriaisEstoque();
  return materiais.filter(m => m.pesoTotalKg <= m.estoqueMinimoKg || m.quantidade <= m.estoqueMinimoQtd);
}
