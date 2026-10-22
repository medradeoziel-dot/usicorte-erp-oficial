import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Barcode, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Bell, 
  Search, 
  DollarSign, 
  ArrowLeft, 
  RefreshCw, 
  Loader2, 
  Clock, 
  FileText, 
  ChevronRight, 
  Filter, 
  RotateCcw,
  Check,
  Plus,
  FileEdit
} from 'lucide-react';
import { Client, Quote, StatusProposta, ItemCotacaoResumo } from '../types';
import { db, fetchCotacoesDb } from '../lib/db';
import { 
  fetchBoletosDb, 
  darBaixaBoletoDb, 
  estornarBaixaBoletoDb, 
  obterBoletosVencimentoHoje, 
  calcularPrevisaoFluxoMensal,
  getDataHojeIso, 
  formatDataPtBr, 
  formatCurrencyPtBr, 
  STATUS_OPTIONS, 
  getStatusOption,
  normalizeStatus,
  ContaReceberParcela 
} from '../services/boletosService';
import BoletosGestaoModal from './BoletosGestaoModal';

interface AndamentoMovimentacoesModuleProps {
  clients?: Client[];
  onNavigateToReports?: (tab?: 'propostas' | 'consulta') => void;
  onNavigateToQuote?: () => void;
}

export default function AndamentoMovimentacoesModule({
  clients = [],
  onNavigateToReports,
  onNavigateToQuote
}: AndamentoMovimentacoesModuleProps) {
  // Estados de dados principais
  const [boletos, setBoletos] = useState<ContaReceberParcela[]>([]);
  const [cotacoes, setCotacoes] = useState<ItemCotacaoResumo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Estados de filtros
  const [filtroSituacao, setFiltroSituacao] = useState<string>('todos');
  const [filtroStatusBoleto, setFiltroStatusBoleto] = useState<'todos' | 'Pendente' | 'Baixado' | 'hoje' | 'atrasados'>('todos');
  const [buscaTexto, setBuscaTexto] = useState<string>('');
  const [mostrarPrevisao, setMostrarPrevisao] = useState<boolean>(true);

  // Estados do Modal de Gestão de Boletos
  const [isBoletosModalOpen, setIsBoletosModalOpen] = useState<boolean>(false);
  const [selectedCotacaoBoleto, setSelectedCotacaoBoleto] = useState<{
    cotacaoNumero: string;
    clienteNome: string;
    valorTotal: number;
    cotacaoId?: string;
    clienteId?: string;
  } | null>(null);

  // Estado para loading individual de ações de baixa/estorno
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Carrega cotações e boletos do Supabase e cache local
  const carregarDados = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      // 1. Carrega boletos
      const boletosList = await fetchBoletosDb();
      setBoletos(boletosList);

      // 2. Carrega cotações do Supabase
      const cotacoesResumo: ItemCotacaoResumo[] = [];
      const seenCotacoes = new Set<string>();

      try {
        const dbData = await fetchCotacoesDb();

        if (Array.isArray(dbData)) {
          dbData.forEach((q: any) => {
            const rawNum = q.numero || q.id || '';
            const key = String(rawNum).trim().toLowerCase();
            if (!key || seenCotacoes.has(key)) return;

            seenCotacoes.add(key);
            if (q.id) seenCotacoes.add(String(q.id).trim().toLowerCase());

            const itens = q.cotacao_itens || [];
            cotacoesResumo.push({
              id: q.id || rawNum,
              cotacaoNumero: q.numero || 'COT',
              clienteNome: q.cliente_nome || 'Cliente',
              clienteId: q.cliente_id || q.clientId,
              data: (q.data || q.created_at || '').slice(0, 10),
              valorTotal: Number(q.valor_total) || 0,
              status: normalizeStatus(q.status) as StatusProposta,
              itensCount: itens.length
            });
          });
        }
      } catch (err) {
        console.warn('Aviso ao consultar cotações do banco:', err);
      }

      // 3. Fallback: cotações no LocalStorage
      try {
        const saved = localStorage.getItem('s_orcamentos');
        if (saved) {
          const localQuotes: Quote[] = JSON.parse(saved);
          if (Array.isArray(localQuotes)) {
            localQuotes.forEach(q => {
              const rawNum = q.quoteNumber || q.id || '';
              const key = String(rawNum).trim().toLowerCase();
              if (!key || seenCotacoes.has(key)) return;

              seenCotacoes.add(key);
              if (q.id) seenCotacoes.add(String(q.id).trim().toLowerCase());

              const normStatus =
                q.status === 'Aprovado' ? 'aprovado' :
                q.status === 'Faturado' ? 'faturado' :
                q.status === 'Cancelado' ? 'cancelado' :
                q.status === 'Rejeitado' ? 'rejeitado' :
                q.status === 'Enviado' ? 'pendente' : 'rascunho';

              cotacoesResumo.push({
                id: q.id || rawNum,
                cotacaoNumero: q.quoteNumber || 'COT',
                clienteNome: q.clientName || 'Cliente',
                clienteId: q.clientId,
                data: (q.date || q.createdAt || '').slice(0, 10),
                valorTotal: Number(q.grandTotal || q.subtotalTotal) || 0,
                status: normStatus as StatusProposta,
                itensCount: (q.items || []).length
              });
            });
          }
        }
      } catch (errLocal) {
        console.warn('Aviso ao ler cotações locais:', errLocal);
      }

      setCotacoes(cotacoesResumo);

      if (isRefresh) {
        setFeedback({ message: 'Dados de cotações e boletos atualizados com sucesso!', type: 'success' });
        setTimeout(() => setFeedback(null), 3000);
      }
    } catch (error: any) {
      console.error('Erro ao carregar dados do módulo de movimentações:', error);
      setFeedback({ message: 'Erro ao conectar ao banco de dados.', type: 'error' });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  // Cálculos de Totais Financeiros por Situação
  const totaisPorSituacao = useMemo(() => {
    const mapa: Record<string, { totalValor: number; qtdCotacoes: number; qtdItens: number }> = {
      pendente: { totalValor: 0, qtdCotacoes: 0, qtdItens: 0 },
      aprovado: { totalValor: 0, qtdCotacoes: 0, qtdItens: 0 },
      rascunho: { totalValor: 0, qtdCotacoes: 0, qtdItens: 0 },
      faturado: { totalValor: 0, qtdCotacoes: 0, qtdItens: 0 },
      rejeitado: { totalValor: 0, qtdCotacoes: 0, qtdItens: 0 },
      cancelado: { totalValor: 0, qtdCotacoes: 0, qtdItens: 0 },
    };

    cotacoes.forEach(cot => {
      const st = normalizeStatus(cot.status);
      if (!mapa[st]) {
        mapa[st] = { totalValor: 0, qtdCotacoes: 0, qtdItens: 0 };
      }
      mapa[st].totalValor += Number(cot.valorTotal) || 0;
      mapa[st].qtdCotacoes += 1;
      mapa[st].qtdItens += cot.itensCount || 1;
    });

    return mapa;
  }, [cotacoes]);

  // Indicador consolidado de Faturado / Recebido Hoje
  const faturadoHojeInfo = useMemo(() => {
    const hojeIso = getDataHojeIso();
    let totalHoje = 0;
    let countHoje = 0;

    // 1. Cotações marcadas como FATURADO na data de hoje
    cotacoes.forEach(cot => {
      if (normalizeStatus(cot.status) === 'faturado' && cot.data === hojeIso) {
        totalHoje += Number(cot.valorTotal) || 0;
        countHoje += 1;
      }
    });

    // 2. Boletos baixados / liquidados na data de hoje
    boletos.forEach(b => {
      if (b.status === 'Baixado' && b.dataPagamento === hojeIso) {
        totalHoje += Number(b.valorParcela) || 0;
        countHoje += 1;
      }
    });

    return { total: totalHoje, count: countHoje };
  }, [cotacoes, boletos]);

  // Alertas diários de boletos que vencem hoje e atrasados
  const alertasBoletos = useMemo(() => {
    return obterBoletosVencimentoHoje(boletos);
  }, [boletos]);

  // Previsão de Fluxo de Caixa Mensal
  const previsaoMensal = useMemo(() => {
    return calcularPrevisaoFluxoMensal(boletos);
  }, [boletos]);

  // Totais consolidados de boletos
  const totaisBoletos = useMemo(() => {
    let pendente = 0;
    let baixado = 0;
    let atrasado = 0;
    const hoje = getDataHojeIso();

    boletos.forEach(b => {
      const val = Number(b.valorParcela) || 0;
      if (b.status === 'Baixado') {
        baixado += val;
      } else {
        pendente += val;
        if (b.dataVencimento < hoje) {
          atrasado += val;
        }
      }
    });

    return { pendente, baixado, atrasado, total: pendente + baixado };
  }, [boletos]);

  // Filtra boletos para a listagem
  const boletosFiltrados = useMemo(() => {
    const termo = buscaTexto.toLowerCase().trim();
    const hojeIso = getDataHojeIso();

    return boletos.filter(b => {
      // Filtro de texto por cliente ou cotação
      if (termo) {
        const matchCli = (b.clienteNome || '').toLowerCase().includes(termo);
        const matchCot = (b.cotacaoNumero || '').toLowerCase().includes(termo);
        const matchNum = (b.numeroBoleto || '').toLowerCase().includes(termo);
        if (!matchCli && !matchCot && !matchNum) return false;
      }

      // Filtro de status
      if (filtroStatusBoleto === 'Pendente' && b.status !== 'Pendente') return false;
      if (filtroStatusBoleto === 'Baixado' && b.status !== 'Baixado') return false;
      if (filtroStatusBoleto === 'hoje') {
        return b.status === 'Pendente' && b.dataVencimento === hojeIso;
      }
      if (filtroStatusBoleto === 'atrasados') {
        return b.status === 'Pendente' && b.dataVencimento < hojeIso;
      }

      return true;
    });
  }, [boletos, buscaTexto, filtroStatusBoleto]);

  // Ação rápida: Dar baixa em boleto
  const handleDarBaixa = async (boletoId: string) => {
    setActionLoadingId(boletoId);
    try {
      const res = await darBaixaBoletoDb(boletoId, getDataHojeIso());
      if (res.sucesso && res.boleto) {
        setBoletos(prev => prev.map(b => b.id === boletoId ? res.boleto! : b));
        setFeedback({ message: res.mensagem, type: 'success' });
      } else {
        setFeedback({ message: res.mensagem || 'Erro ao dar baixa no boleto.', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ message: `Erro ao baixar boleto: ${err?.message || 'Falha de comunicação'}`, type: 'error' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  // Ação rápida: Estornar baixa de boleto
  const handleEstornarBaixa = async (boletoId: string) => {
    setActionLoadingId(boletoId);
    try {
      const res = await estornarBaixaBoletoDb(boletoId);
      if (res.sucesso && res.boleto) {
        setBoletos(prev => prev.map(b => b.id === boletoId ? res.boleto! : b));
        setFeedback({ message: res.mensagem, type: 'info' });
      } else {
        setFeedback({ message: res.mensagem || 'Erro ao estornar boleto.', type: 'error' });
      }
    } catch (err: any) {
      setFeedback({ message: `Erro ao estornar boleto: ${err?.message || 'Falha'}`, type: 'error' });
    } finally {
      setActionLoadingId(null);
      setTimeout(() => setFeedback(null), 3500);
    }
  };

  // Abre o modal de gestão de boletos para uma cotação
  const handleAbrirGestaoBoletos = (cot?: ItemCotacaoResumo) => {
    if (cot) {
      setSelectedCotacaoBoleto({
        cotacaoNumero: cot.cotacaoNumero,
        clienteNome: cot.clienteNome,
        valorTotal: cot.valorTotal,
        cotacaoId: cot.id,
        clienteId: cot.clienteId
      });
    } else {
      // Procura primeiro por cotações com status aprovado ou faturado
      const aprovadaOuFaturada = cotacoes.find(c => {
        const s = normalizeStatus(c.status);
        return s === 'aprovado' || s === 'faturado';
      });

      if (aprovadaOuFaturada) {
        setSelectedCotacaoBoleto({
          cotacaoNumero: aprovadaOuFaturada.cotacaoNumero,
          clienteNome: aprovadaOuFaturada.clienteNome,
          valorTotal: aprovadaOuFaturada.valorTotal,
          cotacaoId: aprovadaOuFaturada.id,
          clienteId: aprovadaOuFaturada.clienteId
        });
      } else if (cotacoes.length > 0) {
        const primeira = cotacoes[0];
        setSelectedCotacaoBoleto({
          cotacaoNumero: primeira.cotacaoNumero,
          clienteNome: primeira.clienteNome,
          valorTotal: primeira.valorTotal,
          cotacaoId: primeira.id,
          clienteId: primeira.clienteId
        });
      } else {
        setSelectedCotacaoBoleto({
          cotacaoNumero: '',
          clienteNome: '',
          valorTotal: 0
        });
      }
    }
    setIsBoletosModalOpen(true);
  };

  return (
    <div id="screen-andamento-movimentacoes" className="space-y-5 animate-in fade-in duration-200">
      
      {/* CABEÇALHO DO MÓDULO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-md">
            <Barcode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Andamento das Movimentações
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                Boletos & Contas a Receber
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Painel consolidado por situação de cotações, faturamento em tempo real e gestão diária de boletos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => carregarDados(true)}
            disabled={isRefreshing}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title="Atualizar dados do Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => handleAbrirGestaoBoletos()}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Gerenciar / Novo Boleto</span>
          </button>

          {onNavigateToReports && (
            <button
              type="button"
              onClick={() => onNavigateToReports('consulta')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>Ver Cotações (Consulta)</span>
            </button>
          )}
        </div>
      </div>

      {/* FEEDBACK TOAST / ALERT */}
      {feedback && (
        <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all animate-in fade-in duration-200 ${
          feedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
          feedback.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' :
          'bg-blue-500/10 border-blue-500/30 text-blue-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
             feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> :
             <Bell className="w-4 h-4 text-blue-400" />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================================================
           1. CARDS DE TOTAIS FINANCEIROS POR SITUAÇÃO (KPIS)
           =================================================== */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <span>Totais Financeiros por Situação da Cotação</span>
            <span className="text-[11px] font-mono text-slate-500 font-normal">({cotacoes.length} cotações cadastradas)</span>
          </h3>
          {filtroSituacao !== 'todos' && (
            <button
              type="button"
              onClick={() => setFiltroSituacao('todos')}
              className="text-[11px] font-semibold text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Limpar filtro ({filtroSituacao})</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {/* 6 Cards por Situação */}
          {STATUS_OPTIONS.map(opt => {
            const info = totaisPorSituacao[opt.value] || { totalValor: 0, qtdCotacoes: 0, qtdItens: 0 };
            const isFiltroAtivo = filtroSituacao === opt.value;

            return (
              <div
                key={opt.value}
                onClick={() => setFiltroSituacao(prev => prev === opt.value ? 'todos' : opt.value)}
                className={`p-3 rounded-xl border transition-all cursor-pointer select-none relative overflow-hidden flex flex-col justify-between ${
                  isFiltroAtivo
                    ? 'bg-slate-800 border-indigo-500 ring-2 ring-indigo-500/40 shadow-lg'
                    : 'bg-slate-900/90 hover:bg-slate-800/80 border-slate-800 hover:border-slate-700 shadow-xs'
                }`}
                title={`Clique para filtrar cotações por situação: ${opt.label}`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${opt.dotClass}`} />
                    <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate">
                      {opt.label}
                    </span>
                  </div>
                  {isFiltroAtivo && (
                    <span className="text-[9px] font-bold bg-indigo-500 text-white px-1.5 py-0.2 rounded-sm">
                      Ativo
                    </span>
                  )}
                </div>

                <div className="my-0.5">
                  <span className="text-sm sm:text-base font-black text-white tracking-tight block">
                    {formatCurrencyPtBr(info.totalValor)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>{info.qtdCotacoes} cotação(ões)</span>
                  <span>{info.qtdItens} item(ns)</span>
                </div>
              </div>
            );
          })}

          {/* 7º Card: Faturado / Recebido Hoje */}
          <div 
            className="p-3 rounded-xl border border-emerald-500/40 bg-gradient-to-br from-indigo-950/40 via-slate-900 to-emerald-950/40 shadow-lg shadow-emerald-950/20 flex flex-col justify-between"
            title="Total consolidado de cotações faturadas e boletos/parcelas liquidadas hoje"
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                  Faturado Hoje
                </span>
              </div>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>

            <div className="my-0.5">
              <span className="text-sm sm:text-base font-black text-emerald-300 tracking-tight block">
                {formatCurrencyPtBr(faturadoHojeInfo.total)}
              </span>
            </div>

            <div className="text-[10px] text-emerald-400/80 font-semibold flex items-center justify-between">
              <span>{faturadoHojeInfo.count} movimento(s)</span>
              <span>{formatDataPtBr(getDataHojeIso())}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================
           2. PAINEL DE DESTAQUES: VENCIMENTOS DO DIA (BOLETOS)
           =================================================== */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/95 overflow-hidden shadow-xl">
        {/* Header do Painel */}
        <div className="px-5 py-3.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xs">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white tracking-wide flex items-center gap-2.5 flex-wrap">
                <span>Vencimentos do Dia (Boletos & Contas a Receber)</span>
                {alertasBoletos.vencemHoje.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/20 border border-amber-500/40 text-amber-300 animate-pulse">
                    ⚡ {alertasBoletos.vencemHoje.length} vence(m) hoje ({formatCurrencyPtBr(alertasBoletos.totalHoje)})
                  </span>
                )}
                {alertasBoletos.atrasados.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/20 border border-rose-500/40 text-rose-300">
                    ⚠️ {alertasBoletos.atrasados.length} atrasado(s) ({formatCurrencyPtBr(alertasBoletos.totalAtrasado)})
                  </span>
                )}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMostrarPrevisao(prev => !prev)}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700/60 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{mostrarPrevisao ? 'Ocultar Previsão Mensal' : 'Ver Previsão Mensal'}</span>
            </button>
          </div>
        </div>

        {/* Conteúdo: Lista de Boletos com Vencimento Hoje ou Atrasados */}
        <div className="p-4">
          {alertasBoletos.totalGeralAlertas === 0 ? (
            <div className="flex items-center justify-between text-xs text-slate-400 py-2 flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Nenhum boleto com vencimento para hoje. Todas as parcelas e cobranças estão em dia!</span>
              </div>
              <button
                type="button"
                onClick={() => handleAbrirGestaoBoletos()}
                className="text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer text-xs"
              >
                + Gerenciar Boletos / Condição de Pagamento
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {/* Vencem Hoje */}
              {alertasBoletos.vencemHoje.map(b => (
                <div 
                  key={b.id} 
                  className="bg-slate-950/80 border border-amber-500/40 rounded-xl p-3 flex items-center justify-between gap-3 shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-white text-xs truncate block">{b.clienteNome}</strong>
                      <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                        #{b.cotacaoNumero}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase">
                        Vence Hoje
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>Parc. {b.numeroParcela}/{b.totalParcelas}</span>
                      <span>•</span>
                      <strong className="text-emerald-400 font-bold text-xs">{formatCurrencyPtBr(b.valorParcela)}</strong>
                      {b.numeroBoleto && (
                        <span className="text-[10px] text-slate-500 font-mono">({b.numeroBoleto})</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDarBaixa(b.id)}
                    disabled={actionLoadingId === b.id}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-600/30 shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Dar baixa e confirmar recebimento deste boleto hoje"
                  >
                    {actionLoadingId === b.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Baixar</span>
                  </button>
                </div>
              ))}

              {/* Atrasados */}
              {alertasBoletos.atrasados.map(b => (
                <div 
                  key={b.id} 
                  className="bg-slate-950/80 border border-rose-500/40 rounded-xl p-3 flex items-center justify-between gap-3 shadow-md"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <strong className="text-white text-xs truncate block">{b.clienteNome}</strong>
                      <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                        #{b.cotacaoNumero}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold uppercase">
                        Venc: {formatDataPtBr(b.dataVencimento)}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                      <span>Parc. {b.numeroParcela}/{b.totalParcelas}</span>
                      <span>•</span>
                      <strong className="text-emerald-400 font-bold text-xs">{formatCurrencyPtBr(b.valorParcela)}</strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDarBaixa(b.id)}
                    disabled={actionLoadingId === b.id}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-600/30 shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Dar baixa e confirmar recebimento deste boleto"
                  >
                    {actionLoadingId === b.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Baixar</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* PREVISÃO DE FLUXO DE CAIXA MENSAL (COLAPSÁVEL) */}
        {mostrarPrevisao && previsaoMensal.length > 0 && (
          <div className="px-5 py-3.5 bg-slate-950/70 border-t border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Previsão de Recebimento por Mês (Fluxo de Caixa)</span>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {previsaoMensal.map((p, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-center">
                  <div className="text-[11px] font-bold text-slate-300 capitalize">{p.mesNome}</div>
                  <div className="text-xs font-black text-emerald-400 mt-0.5">{formatCurrencyPtBr(p.totalValor)}</div>
                  <div className="text-[10px] text-slate-500">{p.quantidadeParcelas} parcela(s)</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===================================================
           3. LISTAGEM GERAL DE BOLETOS & CONTAS A RECEBER
           =================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        
        {/* Barra de Filtros e Busca */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Barcode className="w-4 h-4 text-indigo-400" />
              <span>Contas a Receber & Boletos Emitidos</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Histórico detalhado de todas as parcelas, vencimentos e liquidações
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Input de busca */}
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar cliente, cotação..."
                value={buscaTexto}
                onChange={e => setBuscaTexto(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Filtro por status do boleto */}
            <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg p-0.5 text-xs">
              {(['todos', 'Pendente', 'Baixado', 'hoje', 'atrasados'] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setFiltroStatusBoleto(st)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    filtroStatusBoleto === st
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st === 'todos' ? 'Todos' :
                   st === 'Pendente' ? 'Pendentes' :
                   st === 'Baixado' ? 'Baixados' :
                   st === 'hoje' ? 'Vencem Hoje' : 'Atrasados'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Resumo Rápido de Valores */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-2 border-y border-slate-800/80">
          <div className="text-left">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Total a Receber (Pendente)</span>
            <span className="text-sm font-black text-amber-400 block">{formatCurrencyPtBr(totaisBoletos.pendente)}</span>
          </div>
          <div className="text-left">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Total Recebido (Baixado)</span>
            <span className="text-sm font-black text-emerald-400 block">{formatCurrencyPtBr(totaisBoletos.baixado)}</span>
          </div>
          <div className="text-left">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Total Atrasado</span>
            <span className="text-sm font-black text-rose-400 block">{formatCurrencyPtBr(totaisBoletos.atrasado)}</span>
          </div>
          <div className="text-left">
            <span className="text-[10px] text-slate-400 uppercase font-bold">Volume Geral</span>
            <span className="text-sm font-black text-slate-200 block">{formatCurrencyPtBr(totaisBoletos.total)}</span>
          </div>
        </div>

        {/* Tabela de Boletos */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Cotação</th>
                <th className="py-2.5 px-3">Cliente / Sacado</th>
                <th className="py-2.5 px-3 text-center">Parcela</th>
                <th className="py-2.5 px-3">Vencimento</th>
                <th className="py-2.5 px-3 text-right">Valor da Parcela</th>
                <th className="py-2.5 px-3 text-center">Situação</th>
                <th className="py-2.5 px-3">Data Pagamento</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
                    <span>Carregando movimentações do banco de dados...</span>
                  </td>
                </tr>
              ) : boletosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    <Barcode className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <span>Nenhum boleto encontrado com os filtros selecionados.</span>
                  </td>
                </tr>
              ) : (
                boletosFiltrados.map(b => {
                  const hojeIso = getDataHojeIso();
                  const isAtrasado = b.status === 'Pendente' && b.dataVencimento < hojeIso;
                  const isVenceHoje = b.status === 'Pendente' && b.dataVencimento === hojeIso;

                  return (
                    <tr key={b.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-indigo-400">
                        #{b.cotacaoNumero}
                      </td>
                      <td className="py-2.5 px-3">
                        <strong className="text-white block">{b.clienteNome}</strong>
                        {b.numeroBoleto && (
                          <span className="text-[10px] text-slate-500 font-mono">{b.numeroBoleto}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {b.numeroParcela} / {b.totalParcelas}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span className={isAtrasado ? 'text-rose-400 font-bold' : isVenceHoje ? 'text-amber-400 font-bold' : 'text-slate-300'}>
                          {formatDataPtBr(b.dataVencimento)}
                        </span>
                        {isVenceHoje && (
                          <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-bold">HOJE</span>
                        )}
                        {isAtrasado && (
                          <span className="ml-1 text-[9px] bg-rose-500/20 text-rose-300 px-1 py-0.2 rounded font-bold">ATRASADO</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatCurrencyPtBr(b.valorParcela)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.status === 'Baixado'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : isAtrasado
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        }`}>
                          {b.status === 'Baixado' ? 'Liquidado' : isAtrasado ? 'Em Atraso' : 'A Vencer'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">
                        {b.dataPagamento ? formatDataPtBr(b.dataPagamento) : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {b.status === 'Pendente' ? (
                            <button
                              type="button"
                              onClick={() => handleDarBaixa(b.id)}
                              disabled={actionLoadingId === b.id}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Dar baixa nesta parcela (confirmar pagamento)"
                            >
                              {actionLoadingId === b.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              <span>Baixar</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleEstornarBaixa(b.id)}
                              disabled={actionLoadingId === b.id}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 rounded text-[11px] font-semibold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Estornar baixa (retornar para Pendente)"
                            >
                              {actionLoadingId === b.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                              <span>Estornar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              const cotEncontrada = cotacoes.find(c => c.cotacaoNumero === b.cotacaoNumero || c.id === b.cotacaoId);
                              handleAbrirGestaoBoletos(cotEncontrada || {
                                id: b.cotacaoId || b.cotacaoNumero,
                                cotacaoNumero: b.cotacaoNumero,
                                clienteNome: b.clienteNome,
                                clienteId: b.clienteId,
                                data: '',
                                valorTotal: b.valorParcela * b.totalParcelas,
                                status: 'faturado',
                                itensCount: 1
                              });
                            }}
                            className="px-2 py-1 bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 hover:text-white rounded text-[11px] font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                            title="Editar e gerenciar parcelas desta cotação"
                          >
                            <FileEdit className="w-3 h-3" />
                            <span>Editar</span>
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

        <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
          <span>Mostrando {boletosFiltrados.length} de {boletos.length} parcelas registradas</span>
          <span>Sincronizado com Supabase & Módulo Financeiro</span>
        </div>
      </div>

      {/* ===================================================
           MODAL DE GESTÃO DE BOLETOS & CONDIÇÃO DE PAGAMENTO
           =================================================== */}
      {isBoletosModalOpen && (
        <BoletosGestaoModal
          isOpen={isBoletosModalOpen}
          onClose={() => setIsBoletosModalOpen(false)}
          cotacaoNumero={selectedCotacaoBoleto?.cotacaoNumero}
          clienteNome={selectedCotacaoBoleto?.clienteNome}
          valorTotal={selectedCotacaoBoleto?.valorTotal}
          cotacaoId={selectedCotacaoBoleto?.cotacaoId}
          clienteId={selectedCotacaoBoleto?.clienteId}
          boletosExistentes={boletos}
          cotacoesDisponiveis={cotacoes}
          clientesDisponiveis={clients}
          onBoletosAtualizados={(atualizados) => {
            setBoletos(atualizados);
            carregarDados(false);
          }}
          onFeedback={(tipo, mensagem) => {
            setFeedback({ message: mensagem, type: tipo });
            setTimeout(() => setFeedback(null), 4000);
          }}
        />
      )}

    </div>
  );
}
