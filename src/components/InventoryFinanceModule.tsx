import React, { useState, useEffect, useMemo } from 'react';
import { 
  MaterialEstoque, 
  RetalhoEstoque, 
  MovimentacaoEstoque, 
  LancamentoFinanceiro, 
  TipoMaterialEstoque,
  TipoLancamento,
  CategoriaLancamento,
  FormaPagamentoFinanceiro,
  StatusFinanceiro
} from '../types';
import {
  getMateriaisEstoque,
  saveMateriaisEstoque,
  getRetalhosEstoque,
  saveRetalhosEstoque,
  getLancamentosFinanceiros,
  saveLancamentosFinanceiros,
  getMovimentacoesEstoque,
  registrarMovimentacao,
  calcularLucratividadePorPedido,
  obterAlertasReposicao,
  LucratividadeItem
} from '../services/inventoryFinanceService';
import { formatCurrency, formatWeightKg } from '../utils/calculator';
import {
  Package,
  Boxes,
  Scissors,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Layers,
  FileSpreadsheet,
  Printer,
  Edit2,
  Trash2,
  RefreshCw,
  Eye,
  Check,
  X,
  Scale,
  Building,
  CreditCard,
  PieChart as PieChartIcon,
  BarChart3,
  Receipt,
  FileText,
  ShieldAlert,
  ArrowRight,
  Tag
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';

type ActiveTab = 'estoque' | 'retalhos' | 'financeiro' | 'relatorios';
type FinanceSubTab = 'fluxo' | 'receber' | 'pagar' | 'novo_lancamento';

interface InventoryFinanceModuleProps {
  initialTab?: ActiveTab;
  onNavigateToQuote?: () => void;
  onNavigateToFechamento?: () => void;
}

export default function InventoryFinanceModule({
  initialTab = 'estoque',
  onNavigateToQuote,
  onNavigateToFechamento
}: InventoryFinanceModuleProps) {
  // Navigation State
  const [activeTab, setActiveTab] = useState<ActiveTab>(initialTab);
  const [financeSubTab, setFinanceSubTab] = useState<FinanceSubTab>('fluxo');

  // Data States
  const [materiais, setMateriais] = useState<MaterialEstoque[]>(() => getMateriaisEstoque());
  const [retalhos, setRetalhos] = useState<RetalhoEstoque[]>(() => getRetalhosEstoque());
  const [lancamentos, setLancamentos] = useState<LancamentoFinanceiro[]>(() => getLancamentosFinanceiros());
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>(() => getMovimentacoesEstoque());
  const [lucratividadeList, setLucratividadeList] = useState<LucratividadeItem[]>(() => calcularLucratividadePorPedido());

  // Feedback State
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Reload data from storage
  const reloadAllData = () => {
    setMateriais(getMateriaisEstoque());
    setRetalhos(getRetalhosEstoque());
    setLancamentos(getLancamentosFinanceiros());
    setMovimentacoes(getMovimentacoesEstoque());
    setLucratividadeList(calcularLucratividadePorPedido());
  };

  // =========================================================================
  // ESTOQUE: Filtros & Estados de Modal
  // =========================================================================
  const [searchMaterial, setSearchMaterial] = useState('');
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');
  const [filterOnlyLowStock, setFilterOnlyLowStock] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialEstoque | null>(null);

  // Form Material State
  const [formCodigo, setFormCodigo] = useState('');
  const [formNome, setFormNome] = useState('');
  const [formTipo, setFormTipo] = useState<TipoMaterialEstoque>('chapa');
  const [formMaterial, setFormMaterial] = useState('A36');
  const [formEspessura, setFormEspessura] = useState<number | string>(6.35);
  const [formLargura, setFormLargura] = useState<number | string>(1500);
  const [formComprimento, setFormComprimento] = useState<number | string>(3000);
  const [formDensidade, setFormDensidade] = useState<number | string>(0.00785);
  const [formQuantidade, setFormQuantidade] = useState<number | string>(10);
  const [formEstoqueMinKg, setFormEstoqueMinKg] = useState<number | string>(500);
  const [formEstoqueMinQtd, setFormEstoqueMinQtd] = useState<number | string>(4);
  const [formCustoKg, setFormCustoKg] = useState<number | string>(7.50);
  const [formPrecoVendaKg, setFormPrecoVendaKg] = useState<number | string>(22.00);
  const [formLocalizacao, setFormLocalizacao] = useState('Pátio Chapa - Rack A1');
  const [formFornecedor, setFormFornecedor] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');

  // Modal Ajuste Rápido de Saldo
  const [adjustMaterial, setAdjustMaterial] = useState<MaterialEstoque | null>(null);
  const [adjustQtd, setAdjustQtd] = useState<number | string>(1);
  const [adjustTipo, setAdjustTipo] = useState<'entrada' | 'saida_ajuste'>('entrada');
  const [adjustObs, setAdjustObs] = useState('');

  // Auto-cálculo do peso unitário do material no modal
  const calculatedUnitWeight = useMemo(() => {
    const esp = Number(formEspessura) || 0;
    const larg = Number(formLargura) || 0;
    const comp = Number(formComprimento) || 0;
    const dens = Number(formDensidade) || 0.00785;

    if (formTipo === 'chapa') {
      // espessura * largura * comprimento * densidade / 1000
      return Number(((esp * larg * comp * dens) / 1000).toFixed(2));
    } else if (formTipo === 'barra') {
      // barra redonda: raio^2 * pi * comprimento * densidade / 1000
      const raio = esp / 2;
      const area = Math.PI * raio * raio;
      return Number(((area * comp * dens) / 1000).toFixed(2));
    } else {
      return Number(((esp * larg * comp * dens) / 1000).toFixed(2));
    }
  }, [formEspessura, formLargura, formComprimento, formDensidade, formTipo]);

  const handleOpenNewMaterialModal = () => {
    setEditingMaterial(null);
    setFormCodigo(`MAT-${Date.now().toString().slice(-4)}`);
    setFormNome('');
    setFormTipo('chapa');
    setFormMaterial('A36');
    setFormEspessura(6.35);
    setFormLargura(1500);
    setFormComprimento(3000);
    setFormDensidade(0.00785);
    setFormQuantidade(5);
    setFormEstoqueMinKg(500);
    setFormEstoqueMinQtd(3);
    setFormCustoKg(7.50);
    setFormPrecoVendaKg(22.00);
    setFormLocalizacao('Pátio Chapa - Rack A1');
    setFormFornecedor('');
    setFormObservacoes('');
    setIsMaterialModalOpen(true);
  };

  const handleOpenEditMaterialModal = (mat: MaterialEstoque) => {
    setEditingMaterial(mat);
    setFormCodigo(mat.codigo);
    setFormNome(mat.nome);
    setFormTipo(mat.tipo);
    setFormMaterial(mat.material);
    setFormEspessura(mat.espessuraMm);
    setFormLargura(mat.larguraMm);
    setFormComprimento(mat.comprimentoMm);
    setFormDensidade(mat.densidade);
    setFormQuantidade(mat.quantidade);
    setFormEstoqueMinKg(mat.estoqueMinimoKg);
    setFormEstoqueMinQtd(mat.estoqueMinimoQtd);
    setFormCustoKg(mat.custoKg);
    setFormPrecoVendaKg(mat.precoVendaKg);
    setFormLocalizacao(mat.localizacao);
    setFormFornecedor(mat.fornecedor || '');
    setFormObservacoes(mat.observacoes || '');
    setIsMaterialModalOpen(true);
  };

  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNome.trim()) {
      showFeedback('Por favor, informe a descrição/nome do material.', 'error');
      return;
    }

    const qtd = Number(formQuantidade) >= 0 ? Number(formQuantidade) : 0;
    const unitWeight = calculatedUnitWeight > 0 ? calculatedUnitWeight : 1;
    const pesoTotal = Number((qtd * unitWeight).toFixed(2));

    const materialData: MaterialEstoque = {
      id: editingMaterial ? editingMaterial.id : `mat-${Date.now()}`,
      codigo: formCodigo.trim() || `MAT-${Date.now().toString().slice(-4)}`,
      nome: formNome.trim(),
      tipo: formTipo,
      material: formMaterial.trim(),
      espessuraMm: Number(formEspessura) || 0,
      larguraMm: Number(formLargura) || 0,
      comprimentoMm: Number(formComprimento) || 0,
      densidade: Number(formDensidade) || 0.00785,
      pesoUnitarioKg: unitWeight,
      quantidade: qtd,
      pesoTotalKg: pesoTotal,
      estoqueMinimoKg: Number(formEstoqueMinKg) || 0,
      estoqueMinimoQtd: Number(formEstoqueMinQtd) || 0,
      custoKg: Number(formCustoKg) || 0,
      precoVendaKg: Number(formPrecoVendaKg) || 0,
      localizacao: formLocalizacao.trim() || 'Estoque Geral',
      fornecedor: formFornecedor.trim() || undefined,
      observacoes: formObservacoes.trim() || undefined,
      atualizadoEm: new Date().toISOString()
    };

    let updated: MaterialEstoque[];
    if (editingMaterial) {
      updated = materiais.map(m => m.id === editingMaterial.id ? materialData : m);
      showFeedback(`Material "${materialData.nome}" atualizado com sucesso!`);
    } else {
      updated = [materialData, ...materiais];
      showFeedback(`Material "${materialData.nome}" cadastrado com sucesso!`);
    }

    setMateriais(updated);
    saveMateriaisEstoque(updated);
    setIsMaterialModalOpen(false);
  };

  const handleDeleteMaterial = (id: string, nome: string) => {
    if (!confirm(`Deseja realmente excluir o material "${nome}" do estoque?`)) return;
    const updated = materiais.filter(m => m.id !== id);
    setMateriais(updated);
    saveMateriaisEstoque(updated);
    showFeedback(`Material "${nome}" excluído do estoque.`);
  };

  const handleExecuteAdjustStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustMaterial) return;

    const deltaQtd = Number(adjustQtd);
    if (isNaN(deltaQtd) || deltaQtd <= 0) {
      showFeedback('Informe uma quantidade válida maior que zero.', 'error');
      return;
    }

    const mat = adjustMaterial;
    let novaQtd = mat.quantidade;
    const deltaPeso = Number((deltaQtd * mat.pesoUnitarioKg).toFixed(2));

    if (adjustTipo === 'entrada') {
      novaQtd = Number((mat.quantidade + deltaQtd).toFixed(2));
      registrarMovimentacao({
        materialId: mat.id,
        materialNome: mat.nome,
        tipo: 'entrada',
        quantidade: deltaQtd,
        pesoKg: deltaPeso,
        custoTotal: Number((deltaPeso * mat.custoKg).toFixed(2)),
        observacao: adjustObs.trim() || 'Entrada manual / Reposição de estoque'
      });
    } else {
      novaQtd = Number(Math.max(0, mat.quantidade - deltaQtd).toFixed(2));
      registrarMovimentacao({
        materialId: mat.id,
        materialNome: mat.nome,
        tipo: 'saida_ajuste',
        quantidade: deltaQtd,
        pesoKg: deltaPeso,
        custoTotal: Number((deltaPeso * mat.custoKg).toFixed(2)),
        observacao: adjustObs.trim() || 'Ajuste manual de saída / Perda / Conferência'
      });
    }

    const novoPesoTotal = Number((novaQtd * mat.pesoUnitarioKg).toFixed(2));

    const updated = materiais.map(m => m.id === mat.id ? {
      ...m,
      quantidade: novaQtd,
      pesoTotalKg: novoPesoTotal,
      atualizadoEm: new Date().toISOString()
    } : m);

    setMateriais(updated);
    saveMateriaisEstoque(updated);
    setMovimentacoes(getMovimentacoesEstoque());
    showFeedback(`Estoque de "${mat.nome}" ajustado com sucesso para ${novaQtd} un (${novoPesoTotal} kg)!`);
    setAdjustMaterial(null);
    setAdjustObs('');
  };

  // =========================================================================
  // RETALHOS: Estados e Ações
  // =========================================================================
  const [searchRetalho, setSearchRetalho] = useState('');
  const [filterRetalhoStatus, setFilterRetalhoStatus] = useState<string>('disponivel');
  const [isRetalhoModalOpen, setIsRetalhoModalOpen] = useState(false);

  // Form Retalho
  const [retMaterialNome, setRetMaterialNome] = useState('Chapa A36 1/4" (6.35mm)');
  const [retTipo, setRetTipo] = useState<TipoMaterialEstoque>('chapa');
  const [retEspessura, setRetEspessura] = useState<number | string>(6.35);
  const [retLargura, setRetLargura] = useState<number | string>(500);
  const [retComprimento, setRetComprimento] = useState<number | string>(1000);
  const [retCotacao, setRetCotacao] = useState('');
  const [retLocalizacao, setRetLocalizacao] = useState('Rack de Retalhos - Baia 1');
  const [retObs, setRetObs] = useState('');

  const calculatedRetalhoWeight = useMemo(() => {
    const esp = Number(retEspessura) || 0;
    const larg = Number(retLargura) || 0;
    const comp = Number(retComprimento) || 0;
    return Number(((esp * larg * comp * 0.00785) / 1000).toFixed(2));
  }, [retEspessura, retLargura, retComprimento]);

  const handleSaveRetalho = (e: React.FormEvent) => {
    e.preventDefault();
    if (!retMaterialNome.trim()) {
      showFeedback('Por favor, informe a descrição do material do retalho.', 'error');
      return;
    }

    const novoRetalho: RetalhoEstoque = {
      id: `ret-${Date.now()}`,
      codigo: `RET-${Date.now().toString().slice(-4)}`,
      materialNome: retMaterialNome.trim(),
      tipo: retTipo,
      espessuraMm: Number(retEspessura) || 0,
      larguraMm: Number(retLargura) || 0,
      comprimentoMm: Number(retComprimento) || 0,
      pesoKg: calculatedRetalhoWeight > 0 ? calculatedRetalhoWeight : 1,
      cotacaoOrigem: retCotacao.trim() || undefined,
      localizacao: retLocalizacao.trim() || 'Rack de Retalhos',
      status: 'disponivel',
      dataEntrada: new Date().toISOString().split('T')[0],
      observacao: retObs.trim() || undefined
    };

    const updated = [novoRetalho, ...retalhos];
    setRetalhos(updated);
    saveRetalhosEstoque(updated);
    setIsRetalhoModalOpen(false);
    showFeedback(`Retalho "${novoRetalho.codigo}" cadastrado com sucesso!`);
  };

  const handleMarcarRetalhoUtilizado = (retalho: RetalhoEstoque) => {
    const updated = retalhos.map(r => r.id === retalho.id ? {
      ...r,
      status: 'utilizado' as const,
      dataUso: new Date().toISOString().split('T')[0]
    } : r);
    setRetalhos(updated);
    saveRetalhosEstoque(updated);
    showFeedback(`Retalho "${retalho.codigo}" marcado como utilizado em produção.`);
  };

  const handleDeleteRetalho = (id: string) => {
    if (!confirm('Deseja excluir este registro de retalho?')) return;
    const updated = retalhos.filter(r => r.id !== id);
    setRetalhos(updated);
    saveRetalhosEstoque(updated);
    showFeedback('Retalho removido.');
  };

  // =========================================================================
  // FINANCEIRO: Estados e Ações
  // =========================================================================
  const [finTipo, setFinTipo] = useState<TipoLancamento>('despesa');
  const [finCategoria, setFinCategoria] = useState<CategoriaLancamento>('compra_chapa');
  const [finDescricao, setFinDescricao] = useState('');
  const [finClienteFornecedor, setFinClienteFornecedor] = useState('');
  const [finDocRef, setFinDocRef] = useState('');
  const [finValor, setFinValor] = useState<number | string>('');
  const [finDataVencimento, setFinDataVencimento] = useState(new Date().toISOString().split('T')[0]);
  const [finFormaPagamento, setFinFormaPagamento] = useState<FormaPagamentoFinanceiro>('Boleto');
  const [finStatus, setFinStatus] = useState<StatusFinanceiro>('pendente');
  const [finObs, setFinObs] = useState('');

  const handleSaveLancamento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!finDescricao.trim() || !finValor || Number(finValor) <= 0) {
      showFeedback('Por favor, informe a descrição e um valor válido.', 'error');
      return;
    }

    const novoLancamento: LancamentoFinanceiro = {
      id: `fin-${Date.now()}`,
      tipo: finTipo,
      categoria: finCategoria,
      descricao: finDescricao.trim(),
      clienteFornecedor: finClienteFornecedor.trim() || (finTipo === 'receita' ? 'Cliente' : 'Fornecedor'),
      documentoRef: finDocRef.trim() || undefined,
      valor: Number(finValor),
      dataVencimento: finDataVencimento,
      dataCompetencia: new Date().toISOString().split('T')[0],
      dataPagamento: finStatus === 'pago' ? new Date().toISOString().split('T')[0] : undefined,
      formaPagamento: finFormaPagamento,
      status: finStatus,
      observacoes: finObs.trim() || undefined,
      criadoEm: new Date().toISOString()
    };

    const updated = [novoLancamento, ...lancamentos];
    setLancamentos(updated);
    saveLancamentosFinanceiros(updated);
    showFeedback(`Lançamento "${novoLancamento.descricao}" registrado com sucesso!`);

    // Limpa formulário e vai para a listagem correspondente
    setFinDescricao('');
    setFinValor('');
    setFinDocRef('');
    setFinObs('');
    setFinanceSubTab(finTipo === 'receita' ? 'receber' : 'pagar');
  };

  const handleBaixarLancamento = (lancamento: LancamentoFinanceiro) => {
    const updated = lancamentos.map(l => l.id === lancamento.id ? {
      ...l,
      status: 'pago' as const,
      dataPagamento: new Date().toISOString().split('T')[0]
    } : l);
    setLancamentos(updated);
    saveLancamentosFinanceiros(updated);
    showFeedback(`Lançamento "${lancamento.descricao}" baixado / liquidado com sucesso!`);
  };

  const handleDeleteLancamento = (id: string) => {
    if (!confirm('Deseja realmente excluir este lançamento financeiro?')) return;
    const updated = lancamentos.filter(l => l.id !== id);
    setLancamentos(updated);
    saveLancamentosFinanceiros(updated);
    showFeedback('Lançamento financeiro excluído.');
  };

  // =========================================================================
  // CÁLCULOS & KPIS
  // =========================================================================
  const totalKgEstoque = useMemo(() => {
    return Number(materiais.reduce((acc, m) => acc + (m.pesoTotalKg || 0), 0).toFixed(2));
  }, [materiais]);

  const totalValorCustoEstoque = useMemo(() => {
    return Number(materiais.reduce((acc, m) => acc + ((m.pesoTotalKg || 0) * (m.custoKg || 0)), 0).toFixed(2));
  }, [materiais]);

  const alertasReposicao = useMemo(() => {
    return materiais.filter(m => m.pesoTotalKg <= m.estoqueMinimoKg || m.quantidade <= m.estoqueMinimoQtd);
  }, [materiais]);

  // Totais Financeiros
  const receitasMes = useMemo(() => {
    const mesAtual = new Date().toISOString().slice(0, 7); // YYYY-MM
    return lancamentos
      .filter(l => l.tipo === 'receita' && l.dataVencimento.startsWith(mesAtual))
      .reduce((acc, l) => acc + l.valor, 0);
  }, [lancamentos]);

  const despesasMes = useMemo(() => {
    const mesAtual = new Date().toISOString().slice(0, 7);
    return lancamentos
      .filter(l => l.tipo === 'despesa' && l.dataVencimento.startsWith(mesAtual))
      .reduce((acc, l) => acc + l.valor, 0);
  }, [lancamentos]);

  const saldoMes = useMemo(() => receitasMes - despesasMes, [receitasMes, despesasMes]);

  const totalAReceberPendente = useMemo(() => {
    return lancamentos
      .filter(l => l.tipo === 'receita' && l.status === 'pendente')
      .reduce((acc, l) => acc + l.valor, 0);
  }, [lancamentos]);

  const totalAPagarPendente = useMemo(() => {
    return lancamentos
      .filter(l => l.tipo === 'despesa' && l.status === 'pendente')
      .reduce((acc, l) => acc + l.valor, 0);
  }, [lancamentos]);

  // Dados para Gráfico de Fluxo de Caixa (Últimos 6 meses)
  const chartFluxoData = useMemo(() => {
    const months = ['Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago'];
    const currentMonthIndex = new Date().getMonth();
    return [
      { mes: 'Mar/26', receitas: 38500, despesas: 24200 },
      { mes: 'Abr/26', receitas: 42100, despesas: 28900 },
      { mes: 'Mai/26', receitas: 49800, despesas: 31400 },
      { mes: 'Jun/26', receitas: 45300, despesas: 29800 },
      { mes: 'Jul/26', receitas: 53200, despesas: 34100 },
      { mes: 'Ago/26 (Atual)', receitas: Number(receitasMes.toFixed(2)) || 56800, despesas: Number(despesasMes.toFixed(2)) || 36400 }
    ];
  }, [receitasMes, despesasMes]);

  // Dados para Gráfico de Despesas por Categoria
  const chartDespesasCategoriaData = useMemo(() => {
    const map = new Map<string, number>();
    lancamentos.filter(l => l.tipo === 'despesa').forEach(l => {
      const catLabel = 
        l.categoria === 'compra_chapa' ? 'Matéria-Prima / Chapas' :
        l.categoria === 'energia' ? 'Energia Elétrica' :
        l.categoria === 'frete' ? 'Frete / Logística' :
        l.categoria === 'manutencao' ? 'Manutenção Máquinas' :
        l.categoria === 'custo_operacional' ? 'Custos Operacionais' : 'Outras Despesas';
      map.set(catLabel, (map.get(catLabel) || 0) + l.valor);
    });

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    let idx = 0;
    const res = [];
    for (const [name, value] of map.entries()) {
      res.push({ name, value, color: colors[idx % colors.length] });
      idx++;
    }
    return res.length > 0 ? res : [
      { name: 'Matéria-Prima / Chapas', value: 14500, color: '#3b82f6' },
      { name: 'Energia Elétrica', value: 3820, color: '#10b981' },
      { name: 'Frete', value: 450, color: '#f59e0b' }
    ];
  }, [lancamentos]);

  // Filtros aplicados em Materiais
  const filteredMateriais = useMemo(() => {
    return materiais.filter(m => {
      if (filterTipo !== 'TODOS' && m.tipo !== filterTipo) return false;
      if (filterOnlyLowStock && m.pesoTotalKg > m.estoqueMinimoKg && m.quantidade > m.estoqueMinimoQtd) return false;
      if (!searchMaterial.trim()) return true;
      const q = searchMaterial.toLowerCase();
      return (
        m.nome.toLowerCase().includes(q) ||
        m.codigo.toLowerCase().includes(q) ||
        m.material.toLowerCase().includes(q) ||
        m.localizacao.toLowerCase().includes(q)
      );
    });
  }, [materiais, filterTipo, filterOnlyLowStock, searchMaterial]);

  // Filtros aplicados em Retalhos
  const filteredRetalhos = useMemo(() => {
    return retalhos.filter(r => {
      if (filterRetalhoStatus !== 'TODOS' && r.status !== filterRetalhoStatus) return false;
      if (!searchRetalho.trim()) return true;
      const q = searchRetalho.toLowerCase();
      return (
        r.materialNome.toLowerCase().includes(q) ||
        r.codigo.toLowerCase().includes(q) ||
        (r.cotacaoOrigem && r.cotacaoOrigem.toLowerCase().includes(q))
      );
    });
  }, [retalhos, filterRetalhoStatus, searchRetalho]);

  return (
    <div id="screen-inventory-finance" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Feedback */}
      {feedback && (
        <div 
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl border shadow-xl flex items-center gap-3 text-sm font-medium transition-all animate-in slide-in-from-top-4 ${
            feedback.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/60 shadow-emerald-950/40' :
            feedback.type === 'warning' ? 'bg-amber-950/90 text-amber-300 border-amber-700/60 shadow-amber-950/40' :
            'bg-rose-950/90 text-rose-300 border-rose-700/60 shadow-rose-950/40'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-amber-400" />}
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="ml-2 text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Principal do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl text-white shadow-md shadow-blue-600/30">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Gestão Integrada: Estoque & Financeiro
                <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono font-semibold uppercase">
                  UsiCorte ERP
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Controle de chapas, sobras/retalhos de corte, contas a pagar/receber, lucratividade e alertas automáticos de reposição.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={reloadAllData}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Recarregar dados do banco"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
          {onNavigateToFechamento && (
            <button
              onClick={onNavigateToFechamento}
              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              title="Acessar Fechamento & Extrato de Cotações"
            >
              <Receipt className="w-3.5 h-3.5 text-blue-400 hover:text-white" />
              <span>Fechamento & Extrato</span>
            </button>
          )}
          {onNavigateToQuote && (
            <button
              onClick={onNavigateToQuote}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Ir para Cotações</span>
            </button>
          )}
        </div>
      </div>

      {/* Navegação de Abas do Módulo */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('estoque')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'estoque'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Estoque de Matéria-Prima</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
            activeTab === 'estoque' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            {materiais.length}
          </span>
          {alertasReposicao.length > 0 && (
            <span className="text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-mono animate-pulse">
              {alertasReposicao.length} alerta{alertasReposicao.length > 1 ? 's' : ''}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('retalhos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'retalhos'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>Controle de Retalhos / Sobras</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
            activeTab === 'retalhos' ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-400'
          }`}>
            {retalhos.filter(r => r.status === 'disponivel').length} disp.
          </span>
        </button>

        <button
          onClick={() => setActiveTab('financeiro')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'financeiro'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Caixa & Contas (Financeiro)</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
            saldoMes >= 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400'
          }`}>
            {formatCurrency(saldoMes)}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('relatorios')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'relatorios'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Relatórios Consolidados & Rentabilidade</span>
        </button>
      </div>

      {/* =====================================================================
          ABA 1: ESTOQUE DE MATÉRIA-PRIMA
          ===================================================================== */}
      {activeTab === 'estoque' && (
        <div className="space-y-6">
          {/* Alertas Críticos de Reposição */}
          {alertasReposicao.length > 0 && (
            <div className="p-4 bg-rose-950/40 border border-rose-800/80 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-rose-200 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-600/20 text-rose-400 rounded-xl border border-rose-600/40">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Alerta de Reposição Automática ({alertasReposicao.length} materiais abaixo do estoque mínimo)</h4>
                  <p className="text-xs text-rose-300">
                    Materiais com saldo crítico: {alertasReposicao.map(m => m.nome).join(', ')}.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFilterOnlyLowStock(true);
                  setActiveTab('relatorios');
                }}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-md transition-all self-start md:self-auto cursor-pointer"
              >
                Ver Relatório de Compra
              </button>
            </div>
          )}

          {/* Cards de Métricas de Estoque */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Total de Itens / Perfis</span>
                <Package className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">{materiais.length}</div>
              <div className="text-[11px] text-slate-500">Chapas, Barras e Perfis cadastrados</div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Peso Total em Estoque</span>
                <Scale className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">{formatWeightKg(totalKgEstoque)}</div>
              <div className="text-[11px] text-slate-500">Saldo consolidado de matéria-prima</div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Valor de Custo Imobilizado</span>
                <DollarSign className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">{formatCurrency(totalValorCustoEstoque)}</div>
              <div className="text-[11px] text-slate-500">Capital investido em estoque</div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Materiais em Nível Crítico</span>
                <AlertTriangle className={`w-4 h-4 ${alertasReposicao.length > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
              </div>
              <div className={`text-2xl font-bold font-mono ${alertasReposicao.length > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {alertasReposicao.length}
              </div>
              <div className="text-[11px] text-slate-500">Abaixo do estoque mínimo</div>
            </div>
          </div>

          {/* Barra de Filtros e Ações */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchMaterial}
                  onChange={(e) => setSearchMaterial(e.target.value)}
                  placeholder="Buscar por código, material, espessura, local..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              {/* Filtro por Tipo */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {['TODOS', 'chapa', 'barra', 'perfil', 'tubo'].map((tipo) => (
                  <button
                    key={tipo}
                    onClick={() => setFilterTipo(tipo)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer uppercase ${
                      filterTipo === tipo
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tipo === 'TODOS' ? 'Todos' : tipo}
                  </button>
                ))}
              </div>

              {/* Filtro de Críticos */}
              <button
                onClick={() => setFilterOnlyLowStock(!filterOnlyLowStock)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  filterOnlyLowStock
                    ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-600/20'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Apenas Críticos</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {onNavigateToFechamento && (
                <button
                  onClick={onNavigateToFechamento}
                  className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Acessar Fechamento & Extrato de Cotações"
                >
                  <Receipt className="w-4 h-4 text-blue-400 group-hover:text-white" />
                  <span>Fechamento & Extrato</span>
                </button>
              )}
              <button
                onClick={handleOpenNewMaterialModal}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Cadastrar Material</span>
              </button>
            </div>
          </div>

          {/* Tabela de Materiais em Estoque */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Descrição do Material</th>
                    <th className="py-3 px-4 text-center">Tipo</th>
                    <th className="py-3 px-4 text-right">Espessura</th>
                    <th className="py-3 px-4 text-right">Dimensões (mm)</th>
                    <th className="py-3 px-4 text-right">Peso Unit. (KG)</th>
                    <th className="py-3 px-4 text-right">Saldo (Un)</th>
                    <th className="py-3 px-4 text-right">Saldo Total (KG)</th>
                    <th className="py-3 px-4 text-right">Custo / KG</th>
                    <th className="py-3 px-4 text-center">Nível / Alerta</th>
                    <th className="py-3 px-4">Localização</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredMateriais.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-500">
                        Nenhum material encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredMateriais.map((mat) => {
                      const isLowStock = mat.pesoTotalKg <= mat.estoqueMinimoKg || mat.quantidade <= mat.estoqueMinimoQtd;
                      const percentualMinimo = mat.estoqueMinimoKg > 0 ? (mat.pesoTotalKg / mat.estoqueMinimoKg) * 100 : 100;

                      return (
                        <tr key={mat.id} className={`hover:bg-slate-800/40 transition-colors ${isLowStock ? 'bg-rose-950/10' : ''}`}>
                          <td className="py-3 px-4 font-mono font-bold text-blue-400">{mat.codigo}</td>
                          <td className="py-3 px-4 font-semibold text-white">
                            <div>{mat.nome}</div>
                            {mat.fornecedor && <div className="text-[10px] text-slate-500 font-normal">Fornecedor: {mat.fornecedor}</div>}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                              {mat.tipo}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono">{mat.espessuraMm ? `${mat.espessuraMm} mm` : '-'}</td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">
                            {mat.larguraMm && mat.comprimentoMm ? `${mat.larguraMm} x ${mat.comprimentoMm}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">{formatWeightKg(mat.pesoUnitarioKg)}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-white">
                            {mat.quantidade} un
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                            {formatWeightKg(mat.pesoTotalKg)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-300">
                            {formatCurrency(mat.custoKg)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isLowStock ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                                <AlertTriangle className="w-3 h-3" />
                                Crítico (&lt; {mat.estoqueMinimoKg}kg)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Check className="w-3 h-3" />
                                Normal
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">{mat.localizacao}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setAdjustMaterial(mat);
                                  setAdjustQtd(1);
                                  setAdjustTipo('entrada');
                                }}
                                className="p-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                                title="Entrada / Ajuste rápido de saldo"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditMaterialModal(mat)}
                                className="p-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                                title="Editar Material"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteMaterial(mat.id, mat.nome)}
                                className="p-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                                title="Excluir Material"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 2: CONTROLE DE RETALHOS (SOBRAS DE CORTE)
          ===================================================================== */}
      {activeTab === 'retalhos' && (
        <div className="space-y-6">
          {/* Cards de Métricas de Retalhos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Retalhos Disponíveis</span>
                <Scissors className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {retalhos.filter(r => r.status === 'disponivel').length}
              </div>
              <div className="text-[11px] text-slate-500">Sobras aproveitáveis prontas para corte</div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Peso Total de Sobras (KG)</span>
                <Scale className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400 font-mono">
                {formatWeightKg(retalhos.filter(r => r.status === 'disponivel').reduce((acc, r) => acc + r.pesoKg, 0))}
              </div>
              <div className="text-[11px] text-slate-500">Matéria-prima estocada em retalhos</div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Economia Estimada</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {formatCurrency(retalhos.filter(r => r.status === 'disponivel').reduce((acc, r) => acc + (r.pesoKg * 22), 0))}
              </div>
              <div className="text-[11px] text-slate-500">Valor comercial reaproveitado</div>
            </div>
          </div>

          {/* Barra de Filtros e Botão Novo Retalho */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchRetalho}
                  onChange={(e) => setSearchRetalho(e.target.value)}
                  placeholder="Buscar por código, material, cotação de origem..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                {['disponivel', 'utilizado', 'TODOS'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterRetalhoStatus(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer uppercase ${
                      filterRetalhoStatus === st
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st === 'disponivel' ? 'Disponíveis' : st === 'utilizado' ? 'Utilizados' : 'Todos'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsRetalhoModalOpen(true)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Retalho / Sobra</span>
            </button>
          </div>

          {/* Tabela de Retalhos */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Material / Liga</th>
                    <th className="py-3 px-4 text-right">Espessura (mm)</th>
                    <th className="py-3 px-4 text-right">Dimensões (Larg x Comp)</th>
                    <th className="py-3 px-4 text-right">Peso Estimado (KG)</th>
                    <th className="py-3 px-4">Cotação Origem</th>
                    <th className="py-3 px-4">Localização</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {filteredRetalhos.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        Nenhum retalho registrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredRetalhos.map((ret) => (
                      <tr key={ret.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">{ret.codigo}</td>
                        <td className="py-3 px-4 font-semibold text-white">
                          <div>{ret.materialNome}</div>
                          {ret.observacao && <div className="text-[10px] text-slate-400 font-normal">{ret.observacao}</div>}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">{ret.espessuraMm} mm</td>
                        <td className="py-3 px-4 text-right font-mono text-slate-300">
                          {ret.larguraMm} x {ret.comprimentoMm} mm
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {formatWeightKg(ret.pesoKg)}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400">{ret.cotacaoOrigem || '-'}</td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">{ret.localizacao}</td>
                        <td className="py-3 px-4 text-center">
                          {ret.status === 'disponivel' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Disponível
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                              Utilizado {ret.dataUso ? `(${ret.dataUso})` : ''}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {ret.status === 'disponivel' && (
                              <button
                                onClick={() => handleMarcarRetalhoUtilizado(ret)}
                                className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                title="Marcar como utilizado em produção"
                              >
                                Usar Sobra
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteRetalho(ret.id)}
                              className="p-1 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                              title="Excluir Retalho"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ABA 3: GESTÃO FINANCEIRA (CAIXA & CONTAS)
          ===================================================================== */}
      {activeTab === 'financeiro' && (
        <div className="space-y-6">
          {/* Sub-navegação do Financeiro */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-2">
            <button
              onClick={() => setFinanceSubTab('fluxo')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                financeSubTab === 'fluxo'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Dashboard de Fluxo de Caixa</span>
            </button>

            <button
              onClick={() => setFinanceSubTab('receber')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                financeSubTab === 'receber'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Contas a Receber ({lancamentos.filter(l => l.tipo === 'receita').length})</span>
            </button>

            <button
              onClick={() => setFinanceSubTab('pagar')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                financeSubTab === 'pagar'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Contas a Pagar ({lancamentos.filter(l => l.tipo === 'despesa').length})</span>
            </button>

            <div className="flex items-center gap-2 ml-auto">
              {onNavigateToFechamento && (
                <button
                  onClick={onNavigateToFechamento}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 shadow-sm"
                  title="Acessar Fechamento & Extrato de Cotações"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Fechamento & Extrato</span>
                </button>
              )}

              <button
                onClick={() => setFinanceSubTab('novo_lancamento')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  financeSubTab === 'novo_lancamento'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800 text-indigo-400 hover:text-white border border-indigo-500/30'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Novo Lançamento</span>
              </button>
            </div>
          </div>

          {/* Sub-Aba: Dashboard Fluxo de Caixa */}
          {financeSubTab === 'fluxo' && (
            <div className="space-y-6">
              {/* KPIs de Fluxo de Caixa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Entradas do Mês</span>
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-xl font-bold text-emerald-400 font-mono">{formatCurrency(receitasMes)}</div>
                  <div className="text-[10px] text-slate-500">Vendas de cotações e OS</div>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Saídas do Mês</span>
                    <TrendingDown className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-xl font-bold text-rose-400 font-mono">{formatCurrency(despesasMes)}</div>
                  <div className="text-[10px] text-slate-500">Chapas, energia e custos</div>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>Saldo Líquido</span>
                    <DollarSign className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className={`text-xl font-bold font-mono ${saldoMes >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(saldoMes)}
                  </div>
                  <div className="text-[10px] text-slate-500">Entradas - Saídas do Mês</div>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>A Receber (Pendente)</span>
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-xl font-bold text-amber-400 font-mono">{formatCurrency(totalAReceberPendente)}</div>
                  <div className="text-[10px] text-slate-500">Boletos e prazos a vencer</div>
                </div>

                <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                    <span>A Pagar (Pendente)</span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-xl font-bold text-rose-400 font-mono">{formatCurrency(totalAPagarPendente)}</div>
                  <div className="text-[10px] text-slate-500">Compromissos a liquidar</div>
                </div>
              </div>

              {/* Gráficos Comparativos Recharts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Gráfico 1: Evolução de Entradas vs Saídas */}
                <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-blue-400" />
                        Evolução Mensal de Faturamento vs Custos
                      </h3>
                      <p className="text-xs text-slate-400">Comparativo dos últimos 6 meses</p>
                    </div>
                  </div>

                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartFluxoData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                        <XAxis dataKey="mes" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                          formatter={(val: any) => formatCurrency(Number(val))}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Bar dataKey="receitas" name="Entradas (R$)" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="despesas" name="Saídas (R$)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gráfico 2: Composição de Despesas */}
                <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                        <PieChartIcon className="w-4 h-4 text-indigo-400" />
                        Composição de Despesas Operacionais
                      </h3>
                      <p className="text-xs text-slate-400">Distribuição por categoria</p>
                    </div>
                  </div>

                  <div className="h-64 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartDespesasCategoriaData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {chartDespesasCategoriaData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                          formatter={(val: any) => formatCurrency(Number(val))}
                        />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sub-Aba: Contas a Receber */}
          {financeSubTab === 'receber' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white">Contas a Receber (Vendas & Cotações)</h3>
                  <p className="text-xs text-slate-400">Lançamentos gerados automaticamente pelo fechamento de pedidos</p>
                </div>
                <div className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  Total Pendente: {formatCurrency(totalAReceberPendente)}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-3 px-4">Documento</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Descrição</th>
                      <th className="py-3 px-4">Vencimento</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                      <th className="py-3 px-4 text-center">Forma</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {lancamentos.filter(l => l.tipo === 'receita').length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          Nenhum lançamento a receber encontrado.
                        </td>
                      </tr>
                    ) : (
                      lancamentos.filter(l => l.tipo === 'receita').map((l) => (
                        <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-blue-400">{l.documentoRef || l.id}</td>
                          <td className="py-3 px-4 font-semibold text-white">{l.clienteFornecedor}</td>
                          <td className="py-3 px-4 text-slate-300">{l.descricao}</td>
                          <td className="py-3 px-4 font-mono text-slate-400">{l.dataVencimento}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                            {formatCurrency(l.valor)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {l.formaPagamento}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {l.status === 'pago' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Recebido
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                Pendente
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {l.status === 'pendente' && (
                                <button
                                  onClick={() => handleBaixarLancamento(l)}
                                  className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                  title="Marcar como recebido"
                                >
                                  Receber
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteLancamento(l.id)}
                                className="p-1 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                                title="Excluir lançamento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Aba: Contas a Pagar */}
          {financeSubTab === 'pagar' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white">Contas a Pagar (Chapas, Custos, Frete, Energia)</h3>
                  <p className="text-xs text-slate-400">Controle de despesas operacionais e compra de matéria-prima</p>
                </div>
                <div className="font-mono text-xs font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                  Total Pendente: {formatCurrency(totalAPagarPendente)}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-3 px-4">Documento / NF</th>
                      <th className="py-3 px-4">Fornecedor / Favorecido</th>
                      <th className="py-3 px-4">Categoria</th>
                      <th className="py-3 px-4">Vencimento</th>
                      <th className="py-3 px-4 text-right">Valor</th>
                      <th className="py-3 px-4 text-center">Forma</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {lancamentos.filter(l => l.tipo === 'despesa').length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500">
                          Nenhum lançamento a pagar encontrado.
                        </td>
                      </tr>
                    ) : (
                      lancamentos.filter(l => l.tipo === 'despesa').map((l) => (
                        <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-rose-400">{l.documentoRef || l.id}</td>
                          <td className="py-3 px-4 font-semibold text-white">
                            <div>{l.clienteFornecedor}</div>
                            <div className="text-[10px] text-slate-400 font-normal">{l.descricao}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {l.categoria === 'compra_chapa' ? 'Compra de Chapa' :
                               l.categoria === 'energia' ? 'Energia Elétrica' :
                               l.categoria === 'frete' ? 'Frete' :
                               l.categoria === 'manutencao' ? 'Manutenção' : 'Despesa'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400">{l.dataVencimento}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                            {formatCurrency(l.valor)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {l.formaPagamento}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {l.status === 'pago' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                Pago
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                Pendente
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {l.status === 'pendente' && (
                                <button
                                  onClick={() => handleBaixarLancamento(l)}
                                  className="px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                  title="Liquidar / Marcar como pago"
                                >
                                  Pagar
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteLancamento(l.id)}
                                className="p-1 bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg text-xs transition-all cursor-pointer"
                                title="Excluir lançamento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Aba: Formulário Novo Lançamento */}
          {financeSubTab === 'novo_lancamento' && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl mx-auto space-y-5 shadow-2xl">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-600/40">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Novo Lançamento Financeiro</h3>
                  <p className="text-xs text-slate-400">Registre compras de chapas, frete, custos operacionais ou receitas avulsas</p>
                </div>
              </div>

              <form onSubmit={handleSaveLancamento} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Lançamento *</label>
                    <select
                      value={finTipo}
                      onChange={(e) => setFinTipo(e.target.value as TipoLancamento)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="despesa">Saída / Contas a Pagar</option>
                      <option value="receita">Entrada / Contas a Receber</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Categoria *</label>
                    <select
                      value={finCategoria}
                      onChange={(e) => setFinCategoria(e.target.value as CategoriaLancamento)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="compra_chapa">Compra de Chapas / Matéria-Prima</option>
                      <option value="custo_operacional">Custo Operacional</option>
                      <option value="frete">Frete / Entrega</option>
                      <option value="energia">Energia Elétrica (Maquinário)</option>
                      <option value="manutencao">Manutenção Laser / Plasma</option>
                      <option value="despesa_fixa">Despesa Fixa / Aluguel</option>
                      <option value="venda_cotacao">Receita de Cotação</option>
                      <option value="ordem_servico">Receita de Ordem de Serviço</option>
                      <option value="outros">Outros Lançamentos</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Descrição / Histórico *</label>
                  <input
                    type="text"
                    value={finDescricao}
                    onChange={(e) => setFinDescricao(e.target.value)}
                    placeholder="Ex: Compra de lote de chapa A36 1/4 Gerdau"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Cliente / Fornecedor</label>
                    <input
                      type="text"
                      value={finClienteFornecedor}
                      onChange={(e) => setFinClienteFornecedor(e.target.value)}
                      placeholder="Ex: Gerdau / Enel / Metalúrgica"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Nº Documento / NF-e</label>
                    <input
                      type="text"
                      value={finDocRef}
                      onChange={(e) => setFinDocRef(e.target.value)}
                      placeholder="Ex: NF-44910 ou COT-2026-0004"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Valor (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={finValor}
                      onChange={(e) => setFinValor(e.target.value)}
                      placeholder="0,00"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold text-emerald-400 focus:outline-hidden focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Data Vencimento *</label>
                    <input
                      type="date"
                      value={finDataVencimento}
                      onChange={(e) => setFinDataVencimento(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Forma de Pagamento</label>
                    <select
                      value={finFormaPagamento}
                      onChange={(e) => setFinFormaPagamento(e.target.value as FormaPagamentoFinanceiro)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                    >
                      <option value="Boleto">Boleto Bancário</option>
                      <option value="PIX">PIX (Instantâneo)</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Transferência">Transferência / TED</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="A Prazo">A Prazo</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={finStatus === 'pago'}
                      onChange={(e) => setFinStatus(e.target.checked ? 'pago' : 'pendente')}
                      className="rounded border-slate-700 text-blue-600 focus:ring-0 w-4 h-4"
                    />
                    <span>Marcar como já pago / liquidado hoje</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFinanceSubTab('fluxo')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                  >
                    Salvar Lançamento
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          ABA 4: RELATÓRIOS CONSOLIDADOS & LUCRATIVIDADE
          ===================================================================== */}
      {activeTab === 'relatorios' && (
        <div className="space-y-6">
          {/* Relatório 1: Lucratividade por Pedido */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  Relatório de Lucratividade por Pedido (Venda - Custo de Matéria-Prima)
                </h3>
                <p className="text-xs text-slate-400">
                  Cálculo automático de margem bruta considerando o peso consumido e o preço de custo por KG dos materiais
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Nº Pedido / Cotação</th>
                    <th className="py-3 px-4">Cliente</th>
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4 text-right">Peso Consumido</th>
                    <th className="py-3 px-4 text-right">Valor Vendido (R$)</th>
                    <th className="py-3 px-4 text-right">Custo Matéria-Prima</th>
                    <th className="py-3 px-4 text-right">Lucro Bruto (R$)</th>
                    <th className="py-3 px-4 text-center">Margem (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {lucratividadeList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhum pedido finalizado no histórico para cálculo de lucratividade.
                      </td>
                    </tr>
                  ) : (
                    lucratividadeList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-400">{item.cotacaoNumero}</td>
                        <td className="py-3 px-4 font-semibold text-white">{item.cliente}</td>
                        <td className="py-3 px-4 font-mono text-slate-400">{item.data}</td>
                        <td className="py-3 px-4 text-right font-mono">{formatWeightKg(item.pesoTotalKg)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {formatCurrency(item.valorVendido)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-rose-400">
                          {formatCurrency(item.custoMaterialEstimado)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(item.lucroBruto)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                            item.margemLucroPercent >= 50
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : item.margemLucroPercent >= 30
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {item.margemLucroPercent}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Relatório 2: Alertas de Reposição e Sugestão de Compra */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-400" />
                  Alerta de Reposição de Estoque & Sugestão de Compra
                </h3>
                <p className="text-xs text-slate-400">
                  Lista automática dos materiais com saldo abaixo do ponto de pedido configurado
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Material / Chapa</th>
                    <th className="py-3 px-4 text-right">Saldo Atual (KG)</th>
                    <th className="py-3 px-4 text-right">Estoque Mínimo (KG)</th>
                    <th className="py-3 px-4 text-right">Déficit (KG)</th>
                    <th className="py-3 px-4 text-right">Sugestão de Compra</th>
                    <th className="py-3 px-4">Fornecedor Indicado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {alertasReposicao.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-emerald-400 font-semibold">
                        ✅ Todos os materiais estão com saldo saudável acima do estoque mínimo!
                      </td>
                    </tr>
                  ) : (
                    alertasReposicao.map((mat) => {
                      const deficitKg = Number(Math.max(0, mat.estoqueMinimoKg - mat.pesoTotalKg).toFixed(2));
                      const chapasSugeridas = mat.pesoUnitarioKg > 0 ? Math.ceil(deficitKg / mat.pesoUnitarioKg) + 2 : 5;

                      return (
                        <tr key={mat.id} className="hover:bg-slate-800/40 bg-rose-950/15 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-rose-400">{mat.codigo}</td>
                          <td className="py-3 px-4 font-semibold text-white">{mat.nome}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                            {formatWeightKg(mat.pesoTotalKg)} ({mat.quantidade} un)
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-400">
                            {formatWeightKg(mat.estoqueMinimoKg)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-rose-300">
                            {formatWeightKg(deficitKg)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                            Comprar +{chapasSugeridas} {mat.tipo === 'chapa' ? 'Chapas' : 'Barras'} ({formatWeightKg(chapasSugeridas * mat.pesoUnitarioKg)})
                          </td>
                          <td className="py-3 px-4 text-slate-300">{mat.fornecedor || 'Gerdau / Açotubo'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CADASTRO / EDIÇÃO DE MATERIAL
          ===================================================================== */}
      {isMaterialModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-slate-100 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsMaterialModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-600/40">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-white">
                  {editingMaterial ? 'Editar Material de Estoque' : 'Cadastrar Novo Material / Matéria-Prima'}
                </h3>
                <p className="text-xs text-slate-400">Parâmetros geométricos para controle de peso e saldos de corte</p>
              </div>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Código do Item *</label>
                  <input
                    type="text"
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold text-blue-400 focus:outline-hidden focus:border-blue-500"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Descrição Comercial Completa *</label>
                  <input
                    type="text"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    placeholder="Ex: Chapa A36 1/4 (6.35mm) 1500x3000"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Perfil</label>
                  <select
                    value={formTipo}
                    onChange={(e) => setFormTipo(e.target.value as TipoMaterialEstoque)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500 uppercase"
                  >
                    <option value="chapa">Chapa / Placa</option>
                    <option value="barra">Barra Redonda / Maciço</option>
                    <option value="perfil">Perfil / Viga</option>
                    <option value="tubo">Tubo / Bucha</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Material / Liga</label>
                  <input
                    type="text"
                    value={formMaterial}
                    onChange={(e) => setFormMaterial(e.target.value)}
                    placeholder="Ex: A36, 1020, Inox 304"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Densidade / Constante</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={formDensidade}
                    onChange={(e) => setFormDensidade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Espessura (mm)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formEspessura}
                    onChange={(e) => setFormEspessura(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Largura (mm)</label>
                  <input
                    type="number"
                    step="1"
                    value={formLargura}
                    onChange={(e) => setFormLargura(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Comprimento (mm)</label>
                  <input
                    type="number"
                    step="1"
                    value={formComprimento}
                    onChange={(e) => setFormComprimento(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Box de Cálculo Automático do Peso da Chapa */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Peso Teórico por Unidade/Chapa:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">
                  {formatWeightKg(calculatedUnitWeight)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Quantidade em Estoque (Un)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formQuantidade}
                    onChange={(e) => setFormQuantidade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono font-bold text-blue-400 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Estoque Mínimo (KG)</label>
                  <input
                    type="number"
                    step="1"
                    value={formEstoqueMinKg}
                    onChange={(e) => setFormEstoqueMinKg(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500 text-rose-400 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Custo Compra (R$ / KG)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCustoKg}
                    onChange={(e) => setFormCustoKg(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Localização no Pátio / Rack</label>
                  <input
                    type="text"
                    value={formLocalizacao}
                    onChange={(e) => setFormLocalizacao(e.target.value)}
                    placeholder="Ex: Pátio Chapa - Rack A2"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Fornecedor Habitual</label>
                  <input
                    type="text"
                    value={formFornecedor}
                    onChange={(e) => setFormFornecedor(e.target.value)}
                    placeholder="Ex: Gerdau / Açotubo"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsMaterialModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                >
                  Salvar Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: AJUSTE RÁPIDO DE SALDO / ENTRADA DE NOTA
          ===================================================================== */}
      {adjustMaterial && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-slate-100 relative">
            <button
              onClick={() => setAdjustMaterial(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl border border-emerald-600/40">
                <Plus className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Movimentação de Estoque</h3>
                <p className="text-xs text-slate-400">{adjustMaterial.nome}</p>
              </div>
            </div>

            <form onSubmit={handleExecuteAdjustStock} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tipo de Movimentação</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustTipo('entrada')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      adjustTipo === 'entrada'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    + Entrada (Compra / NF)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustTipo('saida_ajuste')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      adjustTipo === 'saida_ajuste'
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    - Saída / Baixa / Perda
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Quantidade a {adjustTipo === 'entrada' ? 'Adicionar' : 'Deduzir'} ({adjustMaterial.tipo === 'chapa' ? 'Chapas' : 'Unidades'}) *
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={adjustQtd}
                  onChange={(e) => setAdjustQtd(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white font-mono font-bold text-emerald-400 focus:outline-hidden focus:border-blue-500"
                  required
                />
                <div className="text-[11px] text-slate-400 mt-1">
                  Peso total movimentado: <span className="font-mono font-bold text-slate-200">{formatWeightKg((Number(adjustQtd) || 0) * adjustMaterial.pesoUnitarioKg)}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Motivo / Observação</label>
                <input
                  type="text"
                  value={adjustObs}
                  onChange={(e) => setAdjustObs(e.target.value)}
                  placeholder="Ex: NF-e 99182 Gerdau ou inventário mensal"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAdjustMaterial(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  Confirmar Movimentação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: CADASTRO DE RETALHO
          ===================================================================== */}
      {isRetalhoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-slate-100 relative">
            <button
              onClick={() => setIsRetalhoModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-600/40">
                <Scissors className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Registrar Sobra de Corte / Retalho</h3>
                <p className="text-xs text-slate-400">Controle dimensional para reutilização em novos pedidos</p>
              </div>
            </div>

            <form onSubmit={handleSaveRetalho} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Material / Liga *</label>
                <input
                  type="text"
                  value={retMaterialNome}
                  onChange={(e) => setRetMaterialNome(e.target.value)}
                  placeholder="Ex: Chapa A36 1/4 (6.35mm) ou Inox 304"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Espessura (mm)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={retEspessura}
                    onChange={(e) => setRetEspessura(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Largura (mm)</label>
                  <input
                    type="number"
                    step="1"
                    value={retLargura}
                    onChange={(e) => setRetLargura(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Comprimento (mm)</label>
                  <input
                    type="number"
                    step="1"
                    value={retComprimento}
                    onChange={(e) => setRetComprimento(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-400">Peso Calculado da Sobra:</span>
                <span className="font-mono font-bold text-emerald-400">{formatWeightKg(calculatedRetalhoWeight)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Cotação / Pedido de Origem</label>
                  <input
                    type="text"
                    value={retCotacao}
                    onChange={(e) => setRetCotacao(e.target.value)}
                    placeholder="Ex: COT-2026-0002"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white font-mono focus:outline-hidden focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Localização</label>
                  <input
                    type="text"
                    value={retLocalizacao}
                    onChange={(e) => setRetLocalizacao(e.target.value)}
                    placeholder="Ex: Rack de Retalhos 1"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Observações</label>
                <input
                  type="text"
                  value={retObs}
                  onChange={(e) => setRetObs(e.target.value)}
                  placeholder="Ex: Corte reto limpo, pronto para reaproveitamento"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRetalhoModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-600/30 transition-all cursor-pointer"
                >
                  Salvar Retalho
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
