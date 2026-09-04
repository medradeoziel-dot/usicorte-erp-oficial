import React, { useState, useEffect, useMemo } from 'react';
import { ContaReceberParcela, ItemCotacaoResumo, Client } from '../types';
import { 
  formatCurrencyPtBr, 
  formatDataPtBr, 
  getDataHojeIso, 
  gerarParcelasCondicaoPagamento,
  salvarEAtualizarBoletosCotacaoDb,
  calcularPrevisaoFluxoMensal,
  normalizeStatus,
  getStatusOption
} from '../services/boletosService';
import {
  X,
  Calendar,
  CreditCard,
  Barcode,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  TrendingUp,
  RefreshCw,
  Building,
  Sparkles,
  Search,
  Check,
  FileText,
  Filter
} from 'lucide-react';

export interface BoletosGestaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  cotacaoNumero?: string;
  clienteNome?: string;
  valorTotal?: number;
  cotacaoId?: string;
  clienteId?: string;
  boletosExistentes: ContaReceberParcela[];
  cotacoesDisponiveis?: ItemCotacaoResumo[];
  clientesDisponiveis?: Client[];
  onBoletosAtualizados: (boletosAtualizados: ContaReceberParcela[]) => void;
  onFeedback?: (tipo: 'success' | 'error' | 'info', mensagem: string) => void;
}

export default function BoletosGestaoModal({
  isOpen,
  onClose,
  cotacaoNumero: initCotacaoNumero = '',
  clienteNome: initClienteNome = '',
  valorTotal: initValorTotal = 0,
  cotacaoId: initCotacaoId = '',
  clienteId: initClienteId,
  boletosExistentes,
  cotacoesDisponiveis = [],
  clientesDisponiveis = [],
  onBoletosAtualizados,
  onFeedback
}: BoletosGestaoModalProps) {
  const [activeTab, setActiveTab] = useState<'parcelas' | 'fluxo'>('parcelas');

  // Seleção de Cotação e Cliente
  const [selectedCotacaoId, setSelectedCotacaoId] = useState<string>(initCotacaoId);
  const [selectedCotacaoNumero, setSelectedCotacaoNumero] = useState<string>(initCotacaoNumero);
  const [selectedClienteNome, setSelectedClienteNome] = useState<string>(initClienteNome);
  const [selectedClienteId, setSelectedClienteId] = useState<string | undefined>(initClienteId);
  const [valorTotalInput, setValorTotalInput] = useState<number>(initValorTotal);

  // Filtros para o seletor de cotações
  const [filtroStatusCotacao, setFiltroStatusCotacao] = useState<'aprovados_faturados' | 'todos'>('aprovados_faturados');
  const [filtroClienteId, setFiltroClienteId] = useState<string>('');
  const [buscaCotacaoTermo, setBuscaCotacaoTermo] = useState<string>('');

  // Estado das condições de pagamento e prazos
  const [condicao, setCondicao] = useState<'a_vista' | '30' | '30_60' | '30_60_90' | '30_60_90_120' | '15_30_45_60' | 'personalizado'>('30_60_90');
  const [qtdPersonalizada, setQtdPersonalizada] = useState<number>(3);
  const [intervaloDias, setIntervaloDias] = useState<number>(30);
  const [dataBase, setDataBase] = useState<string>(getDataHojeIso());
  const [bancoPadrao, setBancoPadrao] = useState<string>('Banco Itaú');

  // Parcelas em edição
  const [parcelas, setParcelas] = useState<ContaReceberParcela[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Lista filtrada de cotações para seleção
  const cotacoesFiltradas = useMemo(() => {
    if (!cotacoesDisponiveis || cotacoesDisponiveis.length === 0) return [];
    const termo = buscaCotacaoTermo.toLowerCase().trim();

    return cotacoesDisponiveis.filter(cot => {
      // 1. Filtro por status (APROVADO ou FATURADO por padrão)
      const st = normalizeStatus(cot.status);
      if (filtroStatusCotacao === 'aprovados_faturados') {
        if (st !== 'aprovado' && st !== 'faturado') return false;
      }

      // 2. Filtro por cliente
      if (filtroClienteId) {
        const cliObj = clientesDisponiveis.find(c => c.id === filtroClienteId);
        const nomeAlvo = (cliObj ? cliObj.nome : filtroClienteId).toLowerCase();
        const cotCliNome = (cot.clienteNome || '').toLowerCase();
        if (cot.clienteId && cot.clienteId !== filtroClienteId && !cotCliNome.includes(nomeAlvo)) {
          return false;
        }
        if (!cot.clienteId && !cotCliNome.includes(nomeAlvo)) {
          return false;
        }
      }

      // 3. Busca por texto (número da cotação ou nome do cliente)
      if (termo) {
        const matchNum = (cot.cotacaoNumero || '').toLowerCase().includes(termo);
        const matchCli = (cot.clienteNome || '').toLowerCase().includes(termo);
        if (!matchNum && !matchCli) return false;
      }

      return true;
    });
  }, [cotacoesDisponiveis, filtroStatusCotacao, filtroClienteId, buscaCotacaoTermo, clientesDisponiveis]);

  // Contagem de cotações aprovadas/faturadas vs total
  const countAprovadasFaturadas = useMemo(() => {
    return cotacoesDisponiveis.filter(c => {
      const s = normalizeStatus(c.status);
      return s === 'aprovado' || s === 'faturado';
    }).length;
  }, [cotacoesDisponiveis]);

  // Carrega parcelas ao inicializar o modal ou quando a cotação selecionada muda
  useEffect(() => {
    if (!isOpen) return;

    let targetCotNumero = initCotacaoNumero;
    let targetCotId = initCotacaoId;
    let targetCliNome = initClienteNome;
    let targetCliId = initClienteId;
    let targetValor = initValorTotal;

    // Se não foi passada cotação inicial mas temos cotações disponíveis, seleciona a primeira aplicável
    if (!targetCotNumero && !targetCotId && cotacoesDisponiveis.length > 0) {
      // Prefere primeira aprovada/faturada
      const primeira = cotacoesDisponiveis.find(c => {
        const s = normalizeStatus(c.status);
        return s === 'aprovado' || s === 'faturado';
      }) || cotacoesDisponiveis[0];

      targetCotNumero = primeira.cotacaoNumero;
      targetCotId = primeira.id;
      targetCliNome = primeira.clienteNome;
      targetCliId = primeira.clienteId;
      targetValor = Number(primeira.valorTotal) || 0;
    }

    setSelectedCotacaoNumero(targetCotNumero);
    setSelectedCotacaoId(targetCotId);
    setSelectedClienteNome(targetCliNome);
    setSelectedClienteId(targetCliId);
    setValorTotalInput(targetValor);

    // Carrega boletos existentes para essa cotação
    const vinculados = boletosExistentes.filter(
      b => (targetCotNumero && b.cotacaoNumero === targetCotNumero) || (targetCotId && b.cotacaoId === targetCotId)
    );

    if (vinculados.length > 0) {
      setParcelas(JSON.parse(JSON.stringify(vinculados)));
    } else if (targetCotNumero || targetValor > 0) {
      const geradas = gerarParcelasCondicaoPagamento({
        cotacaoId: targetCotId,
        cotacaoNumero: targetCotNumero,
        clienteId: targetCliId,
        clienteNome: targetCliNome,
        valorTotal: targetValor,
        condicao: '30_60_90',
        dataBase: getDataHojeIso(),
        bancoPadrao: 'Banco Itaú'
      });
      setParcelas(geradas);
    }
  }, [isOpen, initCotacaoNumero, initCotacaoId, initClienteNome, initValorTotal, initClienteId, cotacoesDisponiveis, boletosExistentes]);

  // Manipulador de troca de cotação selecionada
  const handleSelecionarCotacao = (cotId: string) => {
    const cot = cotacoesDisponiveis.find(c => c.id === cotId || c.cotacaoNumero === cotId);
    if (!cot) return;

    setSelectedCotacaoId(cot.id);
    setSelectedCotacaoNumero(cot.cotacaoNumero);
    setSelectedClienteNome(cot.clienteNome);
    setSelectedClienteId(cot.clienteId);
    const novoValor = Number(cot.valorTotal) || 0;
    setValorTotalInput(novoValor);

    // Verifica se já existem boletos para esta cotação
    const vinculados = boletosExistentes.filter(
      b => (cot.cotacaoNumero && b.cotacaoNumero === cot.cotacaoNumero) || (cot.id && b.cotacaoId === cot.id)
    );

    if (vinculados.length > 0) {
      setParcelas(JSON.parse(JSON.stringify(vinculados)));
    } else {
      const geradas = gerarParcelasCondicaoPagamento({
        cotacaoId: cot.id,
        cotacaoNumero: cot.cotacaoNumero,
        clienteId: cot.clienteId,
        clienteNome: cot.clienteNome,
        valorTotal: novoValor,
        condicao,
        qtdParcelasPersonalizada: qtdPersonalizada,
        intervaloDias,
        dataBase,
        bancoPadrao
      });
      setParcelas(geradas);
    }
  };

  // Totais calculados
  const somaParcelas = useMemo(() => {
    return parcelas.reduce((acc, p) => acc + (Number(p.valorParcela) || 0), 0);
  }, [parcelas]);

  const diferencaValor = useMemo(() => {
    return Number((valorTotalInput - somaParcelas).toFixed(2));
  }, [valorTotalInput, somaParcelas]);

  // Previsão de fluxo agrupada por mês
  const mesesFluxo = useMemo(() => {
    const outrosBoletos = boletosExistentes.filter(
      b => b.cotacaoNumero !== selectedCotacaoNumero && b.cotacaoId !== selectedCotacaoId
    );
    const todos = [...outrosBoletos, ...parcelas];
    return calcularPrevisaoFluxoMensal(todos);
  }, [boletosExistentes, parcelas, selectedCotacaoNumero, selectedCotacaoId]);

  if (!isOpen) return null;

  // Gerar novas parcelas baseado nos seletores e no valor total
  const handleGerarParcelas = () => {
    if (valorTotalInput <= 0) {
      if (onFeedback) onFeedback('error', 'Informe um valor total maior que zero para parcelar.');
      return;
    }

    const geradas = gerarParcelasCondicaoPagamento({
      cotacaoId: selectedCotacaoId,
      cotacaoNumero: selectedCotacaoNumero,
      clienteId: selectedClienteId,
      clienteNome: selectedClienteNome,
      valorTotal: valorTotalInput,
      condicao,
      qtdParcelasPersonalizada: qtdPersonalizada,
      intervaloDias,
      dataBase,
      bancoPadrao
    });
    setParcelas(geradas);
    if (onFeedback) {
      onFeedback('info', `${geradas.length} parcela(s) geradas com sucesso. Confira a prévia abaixo!`);
    }
  };

  // Ajusta automaticamente a diferença de centavos na última parcela
  const handleAutoAjustarCentavos = () => {
    if (parcelas.length === 0 || diferencaValor === 0) return;
    setParcelas(prev => {
      const copy = [...prev];
      const lastIdx = copy.length - 1;
      const novoValor = Number((copy[lastIdx].valorParcela + diferencaValor).toFixed(2));
      copy[lastIdx] = {
        ...copy[lastIdx],
        valorParcela: Math.max(0, novoValor)
      };
      return copy;
    });
  };

  // Alterar valor ou vencimento de uma parcela específica
  const handleAtualizarParcela = (idx: number, campo: keyof ContaReceberParcela, valor: any) => {
    setParcelas(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [campo]: valor };
      return copy;
    });
  };

  // Alternar status da parcela (Pendente <-> Baixado)
  const handleToggleStatusParcela = (idx: number) => {
    setParcelas(prev => {
      const copy = [...prev];
      const atual = copy[idx];
      const novoStatus = atual.status === 'Baixado' ? 'Pendente' : 'Baixado';
      copy[idx] = {
        ...atual,
        status: novoStatus,
        dataPagamento: novoStatus === 'Baixado' ? getDataHojeIso() : undefined
      };
      return copy;
    });
  };

  // Remover parcela
  const handleRemoverParcela = (idx: number) => {
    setParcelas(prev => {
      const filtrado = prev.filter((_, i) => i !== idx);
      return filtrado.map((p, i) => ({
        ...p,
        numeroParcela: i + 1,
        totalParcelas: filtrado.length
      }));
    });
  };

  // Adicionar parcela manual
  const handleAdicionarParcela = () => {
    const novaNum = parcelas.length + 1;
    const ultimaData = parcelas[parcelas.length - 1]?.dataVencimento || getDataHojeIso();
    const dt = new Date(`${ultimaData}T12:00:00`);
    dt.setDate(dt.getDate() + 30);
    const dataVenc = dt.toISOString().split('T')[0];

    const nova: ContaReceberParcela = {
      id: `bol-${selectedCotacaoNumero || 'COT'}-p${novaNum}-${Date.now().toString(36)}`,
      clienteId: selectedClienteId,
      clienteNome: selectedClienteNome,
      cotacaoId: selectedCotacaoId,
      cotacaoNumero: selectedCotacaoNumero,
      numeroParcela: novaNum,
      totalParcelas: novaNum,
      valorParcela: Math.max(0, diferencaValor > 0 ? diferencaValor : 0),
      dataVencimento: dataVenc,
      dataEmissao: dataBase,
      status: 'Pendente',
      formaPagamento: 'Boleto',
      banco: bancoPadrao,
      nossoNumero: `34191.${selectedCotacaoNumero || '00'}${novaNum} 00000.${Math.floor(100000 + Math.random() * 900000)}`,
      observacoes: `Parcela ${novaNum} - Cotação ${selectedCotacaoNumero}`
    };

    setParcelas(prev => {
      const atualizados = [...prev, nova].map((p, _, arr) => ({
        ...p,
        totalParcelas: arr.length
      }));
      return atualizados;
    });
  };

  // Salvar tudo no Supabase com sincronização instantânea
  const handleSalvar = async () => {
    if (parcelas.length === 0) {
      if (onFeedback) onFeedback('error', 'Defina ao menos 1 parcela para salvar os boletos.');
      return;
    }

    if (!selectedCotacaoNumero && !selectedCotacaoId) {
      if (onFeedback) onFeedback('error', 'Selecione uma Cotação para vincular as parcelas.');
      return;
    }

    setIsSaving(true);
    try {
      // 1. Grava no Supabase (contas_a_receber + financeiro_lancamentos) substituindo parcelas antigas desta cotação
      const { sucesso, boletos } = await salvarEAtualizarBoletosCotacaoDb(
        selectedCotacaoNumero,
        parcelas,
        selectedCotacaoId
      );

      // 2. Atualiza a lista geral mantida pelo módulo pai
      const outros = boletosExistentes.filter(
        b => b.cotacaoNumero !== selectedCotacaoNumero && b.cotacaoId !== selectedCotacaoId
      );
      const novaListaCompleta = [...outros, ...boletos];
      onBoletosAtualizados(novaListaCompleta);

      if (onFeedback) {
        onFeedback('success', `${parcelas.length} parcela(s)/boleto(s) da Cotação #${selectedCotacaoNumero} gravadas com sucesso no Supabase e sincronizadas no Módulo Financeiro!`);
      }
      onClose();
    } catch (e: any) {
      if (onFeedback) onFeedback('error', `Erro ao salvar boletos no Supabase: ${e?.message || 'Falha inesperada'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="bg-linear-to-r from-slate-900 via-slate-800 to-indigo-950 px-5 py-4 border-b border-slate-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
              <Barcode className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Emissão & Gerenciamento de Boletos
                </h3>
                {selectedCotacaoNumero && (
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-500/30 border border-indigo-400/40 text-indigo-300">
                    Cotação #{selectedCotacaoNumero}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <Building className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold text-slate-200">{selectedClienteNome || 'Selecione uma cotação'}</span>
                <span>•</span>
                <span>Valor a Parcelar:</span>
                <strong className="text-emerald-400 font-bold text-xs sm:text-sm">{formatCurrencyPtBr(valorTotalInput)}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="px-5 pt-3 bg-slate-900/60 border-b border-slate-800 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveTab('parcelas')}
            className={`pb-3 px-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'parcelas'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Condição de Pagamento & Parcelas ({parcelas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fluxo')}
            className={`pb-3 px-2 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'fluxo'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Previsão de Fluxo de Caixa Mensal</span>
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar text-slate-200">
          {activeTab === 'parcelas' && (
            <>
              {/* ===================================================
                   1. SELEÇÃO DE CLIENTE & COTAÇÃO / PEDIDO
                   =================================================== */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">1</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Cliente e Cotação / Pedido de Venda
                    </span>
                  </div>

                  {/* Filtro por Situação (Aprovado / Faturado) */}
                  <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-700/80 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFiltroStatusCotacao('aprovados_faturados')}
                      className={`px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        filtroStatusCotacao === 'aprovados_faturados'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Check className="w-3 h-3" />
                      <span>Aprovadas & Faturadas ({countAprovadasFaturadas})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFiltroStatusCotacao('todos')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                        filtroStatusCotacao === 'todos'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>Todas ({cotacoesDisponiveis.length})</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                  {/* Filtro / Seleção por Cliente */}
                  <div className="lg:col-span-4">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Filtrar por Cliente:
                    </label>
                    <select
                      value={filtroClienteId}
                      onChange={(e) => setFiltroClienteId(e.target.value)}
                      className="w-full h-9 px-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg text-xs text-white font-medium focus:outline-hidden"
                    >
                      <option value="">Todos os Clientes</option>
                      {clientesDisponiveis.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nome} {c.cidade ? `(${c.cidade})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Seleção de Cotação */}
                  <div className="lg:col-span-5">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center justify-between">
                      <span>Cotação / Pedido:</span>
                      <span className="text-[10px] text-indigo-400 font-normal">
                        {cotacoesFiltradas.length} cotação(ões) encontrada(s)
                      </span>
                    </label>
                    <select
                      value={selectedCotacaoId || selectedCotacaoNumero}
                      onChange={(e) => handleSelecionarCotacao(e.target.value)}
                      className="w-full h-9 px-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg text-xs text-white font-medium focus:outline-hidden"
                    >
                      {cotacoesFiltradas.length === 0 ? (
                        <option value="">Nenhuma cotação com este filtro</option>
                      ) : (
                        cotacoesFiltradas.map(c => {
                          const opt = getStatusOption(c.status);
                          return (
                            <option key={c.id} value={c.id}>
                              #{c.cotacaoNumero} - {c.clienteNome} | {formatCurrencyPtBr(c.valorTotal)} ({opt.label})
                            </option>
                          );
                        })
                      )}
                    </select>
                  </div>

                  {/* Valor Total a Parcelar (Editável) */}
                  <div className="lg:col-span-3">
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Valor Total a Parcelar (R$):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={valorTotalInput}
                        onChange={(e) => setValorTotalInput(parseFloat(e.target.value) || 0)}
                        className="w-full h-9 pl-3 pr-2 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg text-xs text-emerald-400 font-bold focus:outline-hidden"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                {/* Resumo da Cotação Selecionada */}
                {selectedCotacaoNumero && (
                  <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-400" />
                      <span>Cotação <strong>#{selectedCotacaoNumero}</strong> vinculada a <strong>{selectedClienteNome || 'Cliente'}</strong></span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-400">Total: <strong className="text-emerald-400 font-bold">{formatCurrencyPtBr(valorTotalInput)}</strong></span>
                      <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono font-bold">
                        {parcelas.length} boleto(s) em aberto/configurados
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ===================================================
                   2. CONFIGURAÇÃO DE PARCELAMENTO & PRAZOS
                   =================================================== */}
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">2</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Prazos de Vencimento & Condição Comercial
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    Selecione o prazo e clique em <strong>Gerar / Recalcular</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  {/* Seletor de Condição */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Condição de Pagamento:
                    </label>
                    <select
                      value={condicao}
                      onChange={(e) => {
                        const novaCond = e.target.value as any;
                        setCondicao(novaCond);
                      }}
                      className="w-full h-9 px-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg text-xs text-white font-medium focus:outline-hidden"
                    >
                      <option value="a_vista">À Vista (1x - Vence Hoje)</option>
                      <option value="30">30 Dias (1x)</option>
                      <option value="30_60">30 / 60 Dias (2x)</option>
                      <option value="30_60_90">30 / 60 / 90 Dias (3x)</option>
                      <option value="30_60_90_120">30 / 60 / 90 / 120 Dias (4x)</option>
                      <option value="15_30_45_60">15 / 30 / 45 / 60 Dias (4x)</option>
                      <option value="personalizado">Personalizado (Qtd & Intervalo livre)</option>
                    </select>
                  </div>

                  {/* Qtd Parcelas ou Data Base */}
                  {condicao === 'personalizado' ? (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Número de Parcelas (1 a 12x):
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={qtdPersonalizada}
                        onChange={(e) => setQtdPersonalizada(Math.max(1, Math.min(12, parseInt(e.target.value, 10) || 1)))}
                        className="w-full h-9 px-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg text-xs text-white font-medium focus:outline-hidden"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Data Base / 1º Vencimento:
                      </label>
                      <input
                        type="date"
                        value={dataBase}
                        onChange={(e) => setDataBase(e.target.value)}
                        className="w-full h-9 px-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg text-xs text-white font-medium focus:outline-hidden"
                      />
                    </div>
                  )}

                  {/* Banco de Cobrança */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Banco de Cobrança / Emissor:
                    </label>
                    <select
                      value={bancoPadrao}
                      onChange={(e) => setBancoPadrao(e.target.value)}
                      className="w-full h-9 px-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg text-xs text-white font-medium focus:outline-hidden"
                    >
                      <option value="Banco Itaú">Banco Itaú</option>
                      <option value="Banco Bradesco">Banco Bradesco</option>
                      <option value="Banco Santander">Banco Santander</option>
                      <option value="Banco do Brasil">Banco do Brasil</option>
                      <option value="Caixa Econômica">Caixa Econômica</option>
                      <option value="Sicoob / Sicredi">Sicoob / Sicredi</option>
                      <option value="Banco Inter">Banco Inter</option>
                      <option value="Nubank">Nubank</option>
                    </select>
                  </div>

                  {/* Botão Gerar / Recalcular */}
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleGerarParcelas}
                      className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-indigo-600/30 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Gerar / Recalcular Parcelas</span>
                    </button>
                  </div>
                </div>

                {/* Se personalizado, mostra intervalo em dias */}
                {condicao === 'personalizado' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Intervalo entre parcelas (dias):
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={intervaloDias}
                        onChange={(e) => setIntervaloDias(Math.max(1, parseInt(e.target.value, 10) || 30))}
                        className="w-full h-9 px-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg text-xs text-white font-medium focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Data Base de Emissão:
                      </label>
                      <input
                        type="date"
                        value={dataBase}
                        onChange={(e) => setDataBase(e.target.value)}
                        className="w-full h-9 px-2.5 bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-lg text-xs text-white font-medium focus:outline-hidden"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ===================================================
                   3. PRÉVIA INDIVIDUAL DAS PARCELAS & BOLETOS
                   =================================================== */}
              <div className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900 shadow-sm">
                <div className="px-4 py-2.5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">3</span>
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Prévia Individual dos Boletos & Parcelas Programadas
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAdicionarParcela}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs text-indigo-300 hover:text-white font-semibold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Adicionar Parcela</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-800/50 text-slate-400 border-b border-slate-700 font-semibold">
                        <th className="py-2.5 px-3 text-center w-14">Parc.</th>
                        <th className="py-2.5 px-3">Data de Vencimento</th>
                        <th className="py-2.5 px-3 text-right">Valor Parcela (R$)</th>
                        <th className="py-2.5 px-3">Banco / Nosso Número</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3 text-center w-28">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {parcelas.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            Nenhuma parcela gerada ainda. Escolha a cotação e a condição acima e clique em "Gerar / Recalcular".
                          </td>
                        </tr>
                      ) : (
                        parcelas.map((parc, idx) => {
                          const isBaixado = parc.status === 'Baixado';
                          const isHoje = parc.dataVencimento === getDataHojeIso();
                          const isVencido = !isBaixado && parc.dataVencimento < getDataHojeIso();

                          return (
                            <tr key={parc.id || idx} className="hover:bg-slate-800/40 transition-colors">
                              {/* Número da Parcela */}
                              <td className="py-2.5 px-3 text-center font-bold text-slate-300">
                                <span className="inline-flex items-center justify-center w-7 h-6 rounded-md bg-slate-800 border border-slate-700 text-[11px] font-mono">
                                  {parc.numeroParcela}/{parc.totalParcelas}
                                </span>
                              </td>

                              {/* Vencimento (Editável individualmente) */}
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="date"
                                    value={parc.dataVencimento}
                                    onChange={(e) => handleAtualizarParcela(idx, 'dataVencimento', e.target.value)}
                                    className="h-8 px-2 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-md text-xs text-white font-medium focus:outline-hidden"
                                    title="Editar data de vencimento específica desta parcela"
                                  />
                                  {isHoje && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase whitespace-nowrap animate-pulse">
                                      Hoje
                                    </span>
                                  )}
                                  {isVencido && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 uppercase whitespace-nowrap">
                                      Atrasado
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Valor (Editável individualmente) */}
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1">
                                  <span className="text-slate-400 text-[11px]">R$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={parc.valorParcela}
                                    onChange={(e) => handleAtualizarParcela(idx, 'valorParcela', parseFloat(e.target.value) || 0)}
                                    className="h-8 w-28 px-2 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-md text-xs text-right font-bold text-emerald-400 focus:outline-hidden"
                                    title="Editar valor específico deste boleto"
                                  />
                                </div>
                              </td>

                              {/* Banco & Nosso Número */}
                              <td className="py-2.5 px-3">
                                <input
                                  type="text"
                                  value={parc.nossoNumero || ''}
                                  placeholder="Nosso Número / Linha Digitável"
                                  onChange={(e) => handleAtualizarParcela(idx, 'nossoNumero', e.target.value)}
                                  className="h-8 w-full max-w-[220px] px-2 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-md text-xs text-slate-300 font-mono focus:outline-hidden"
                                />
                              </td>

                              {/* Status */}
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleStatusParcela(idx)}
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                                    isBaixado
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                  }`}
                                  title="Clique para alternar entre Pendente e Baixado"
                                >
                                  {isBaixado ? '✓ Baixado' : '🟡 Pendente'}
                                </button>
                              </td>

                              {/* Ações */}
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleStatusParcela(idx)}
                                    className={`h-7 px-2 text-[10px] font-bold rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                                      isBaixado
                                        ? 'bg-slate-800 text-slate-400 hover:text-white'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    }`}
                                    title={isBaixado ? 'Reverter para pendente' : 'Confirmar pagamento desta parcela'}
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>{isBaixado ? 'Desfazer' : 'Baixar'}</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoverParcela(idx)}
                                    className="w-7 h-7 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Excluir parcela"
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

                {/* BARRA DE TOTALIZAÇÃO & CONFERÊNCIA DE CENTAVOS */}
                <div className="bg-slate-950 px-4 py-3 border-t border-slate-700 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">
                      Soma das Parcelas: <strong className="text-white font-bold">{formatCurrencyPtBr(somaParcelas)}</strong>
                    </span>
                    <span className="text-xs text-slate-600">|</span>
                    <span className="text-xs text-slate-400">
                      Valor Cotação: <strong className="text-emerald-400 font-bold">{formatCurrencyPtBr(valorTotalInput)}</strong>
                    </span>
                  </div>

                  {diferencaValor !== 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Diferença: {formatCurrencyPtBr(Math.abs(diferencaValor))}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleAutoAjustarCentavos}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Ajustar Centavos na Última Parcela
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Valores 100% Conferidos e Balanceados!</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'fluxo' && (
            <div className="space-y-4">
              <div className="bg-slate-800/60 border border-slate-700 p-4 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                    Previsão de Fluxo de Caixa Mensal (Boletos a Vencer)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Projeção consolidada de recebimentos por mês considerando os boletos de todas as cotações.
                  </p>
                </div>
              </div>

              {mesesFluxo.length === 0 ? (
                <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                  Nenhum boleto com data de vencimento encontrada no sistema.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mesesFluxo.map((mes) => {
                    const percentBaixado = mes.totalGeral > 0 ? (mes.totalBaixado / mes.totalGeral) * 100 : 0;
                    return (
                      <div key={mes.chaveMesAno} className="bg-slate-800/40 border border-slate-700/80 rounded-xl p-4 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                          <span className="font-bold text-sm text-white">{mes.tituloMesAno}</span>
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300">
                            {mes.quantidadeBoletos} boleto(s)
                          </span>
                        </div>

                        {/* Indicadores do Mês */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-amber-400 block font-semibold uppercase">A Receber (Pendente)</span>
                            <strong className="text-white text-sm">{formatCurrencyPtBr(mes.totalPendente)}</strong>
                          </div>
                          <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                            <span className="text-[10px] text-emerald-400 block font-semibold uppercase">Recebido (Baixado)</span>
                            <strong className="text-white text-sm">{formatCurrencyPtBr(mes.totalBaixado)}</strong>
                          </div>
                        </div>

                        {/* Barra de Progresso */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                            <span>Progresso de Liquidação</span>
                            <span>{percentBaixado.toFixed(0)}%</span>
                          </div>
                          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                            <div 
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${percentBaixado}%` }}
                            />
                          </div>
                        </div>

                        {/* Lista resumida de boletos */}
                        <div className="pt-1 space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                          {mes.boletos.map((b) => (
                            <div key={b.id} className="flex items-center justify-between text-[11px] py-1 px-2 rounded-md bg-slate-900/50 hover:bg-slate-900">
                              <div className="truncate pr-2">
                                <span className="font-semibold text-slate-200 block truncate">{b.clienteNome}</span>
                                <span className="text-slate-500 text-[10px]">
                                  Cot. {b.cotacaoNumero} • Parc. {b.numeroParcela}/{b.totalParcelas} • Venc: {formatDataPtBr(b.dataVencimento)}
                                </span>
                              </div>
                              <div className="text-right shrink-0">
                                <strong className="text-white block">{formatCurrencyPtBr(b.valorParcela)}</strong>
                                <span className={`text-[9px] font-bold ${b.status === 'Baixado' ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {b.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RODAPÉ DO MODAL COM BOTÕES DE CONFIRMAÇÃO */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-slate-400">
            {parcelas.length} parcela(s) configurada(s) totalizando <strong className="text-white font-bold">{formatCurrencyPtBr(somaParcelas)}</strong>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSalvar}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait rounded-lg shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Gravando no Supabase...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirmar & Gravar Boletos</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
