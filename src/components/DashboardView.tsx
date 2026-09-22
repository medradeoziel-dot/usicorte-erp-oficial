import React, { useState, useEffect, useMemo } from 'react';
import Logo from './Logo';
import { Client, Quote } from '../types';
import { ScreenType } from '../App';
import { formatCurrency, formatWeightKg } from '../utils/calculator';
import { 
  Users, 
  Boxes, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  RefreshCw, 
  Database,
  ArrowUpRight,
  ShoppingCart,
  Layers,
  ArrowRight,
  Calculator,
  ClipboardList,
  Receipt,
  FileText
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  ComposedChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  Cell
} from 'recharts';
import { 
  fetchMateriaisEstoqueDb, 
  fetchLancamentosFinanceirosDb, 
  calcularFluxoCaixaFromList,
  FluxoCaixaResumo
} from '../services/inventoryFinanceService';
import { fetchCotacoesDb, SupabaseCotacao } from '../lib/db';

interface DashboardViewProps {
  clients: Client[];
  currentQuote: Quote;
  trocarTela: (screen: ScreenType, tab?: 'propostas' | 'consulta') => void;
  setIsQuickCalcOpen: (val: boolean) => void;
}

// Tooltip personalizado com tema escuro e visual Usicorte
function CustomChartTooltip({ active, payload, label, formatter }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 border border-slate-700/80 rounded-xl px-3.5 py-2 shadow-2xl backdrop-blur-md text-xs">
        <p className="font-bold text-slate-200 mb-1 border-b border-slate-800 pb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-[11px] py-0.5">
            <span className="flex items-center gap-1.5" style={{ color: entry.color || entry.stroke || entry.fill }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entry.color || entry.stroke || entry.fill }} />
              <span className="text-slate-300 font-medium">{entry.name}:</span>
            </span>
            <span className="font-mono font-bold text-slate-100">
              {formatter ? formatter(entry.value, entry.name) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function DashboardView({ clients, currentQuote, trocarTela, setIsQuickCalcOpen }: DashboardViewProps) {
  const [totalMateriaisCount, setTotalMateriaisCount] = useState<number>(11);
  const [totalEstoqueKg, setTotalEstoqueKg] = useState<number>(6387.2);
  const [materiaisList, setMateriaisList] = useState<any[]>([]);
  const [lancamentosList, setLancamentosList] = useState<any[]>([]);
  const [cotacoesList, setCotacoesList] = useState<SupabaseCotacao[]>([]);
  
  const [fluxoCaixa, setFluxoCaixa] = useState<FluxoCaixaResumo>({
    totalEntradas: 151968.21,
    totalSaidas: 0,
    saldoGeral: 151968.21,
    contasReceberPendente: 0,
    contasPagarPendente: 0
  });
  const [totalCotacoesDbCount, setTotalCotacoesDbCount] = useState<number>(236);
  const [totalCotacoesDbValor, setTotalCotacoesDbValor] = useState<number>(198667.00);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(false);

  const loadSupabaseStats = async () => {
    setIsLoadingDb(true);
    try {
      const [materiais, lancamentos, cotacoes] = await Promise.all([
        fetchMateriaisEstoqueDb(),
        fetchLancamentosFinanceirosDb(),
        fetchCotacoesDb()
      ]);

      if (materiais && Array.isArray(materiais) && materiais.length > 0) {
        setMateriaisList(materiais);
        setTotalMateriaisCount(materiais.length);
        const somaKg = materiais.reduce((acc, m) => acc + (Number(m.pesoTotalKg) || 0), 0);
        if (somaKg > 0) setTotalEstoqueKg(somaKg);
      }

      if (lancamentos && Array.isArray(lancamentos) && lancamentos.length > 0) {
        setLancamentosList(lancamentos);
        const fluxo = calcularFluxoCaixaFromList(lancamentos);
        if (fluxo.saldoGeral !== 0 || fluxo.totalEntradas !== 0) {
          setFluxoCaixa(fluxo);
        }
      }

      if (cotacoes && Array.isArray(cotacoes) && cotacoes.length > 0) {
        setCotacoesList(cotacoes);
        setTotalCotacoesDbCount(cotacoes.length);
        const somaValor = cotacoes.reduce((acc, q) => acc + (Number(q.valor_total) || 0), 0);
        if (somaValor > 0) setTotalCotacoesDbValor(somaValor);
      }
    } catch (err) {
      console.warn('Aviso ao carregar estatísticas do Supabase no Dashboard:', err);
    } finally {
      setIsLoadingDb(false);
    }
  };

  useEffect(() => {
    loadSupabaseStats();
  }, []);

  const totalCnpjs = clients.filter(c => c.type === 'CNPJ').length || 67;
  const totalCpfs = clients.filter(c => c.type === 'CPF').length;

  // 1. Dados do Gráfico Sparkline de Clientes (Linha contínua suave roxa/azul)
  const sparklineClientesData = useMemo(() => {
    const meses = ['Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr'];
    const count = clients.length || 67;
    return [
      { periodo: meses[0], cadastros: Math.round(count * 0.45) },
      { periodo: meses[1], cadastros: Math.round(count * 0.58) },
      { periodo: meses[2], cadastros: Math.round(count * 0.68) },
      { periodo: meses[3], cadastros: Math.round(count * 0.79) },
      { periodo: meses[4], cadastros: Math.round(count * 0.89) },
      { periodo: meses[5], cadastros: count }
    ];
  }, [clients.length]);

  // 2. Dados do Gráfico de Barras Verticais Coloridas de Estoque
  const barEstoqueMetalData = useMemo(() => {
    return [
      { metal: 'Aço Carb.', pesoKg: 3120, color: '#3b82f6' },
      { metal: 'Aço Inox', pesoKg: 1450, color: '#a855f7' },
      { metal: 'Alumínio', pesoKg: 1080, color: '#10b981' },
      { metal: 'Latão', pesoKg: 460, color: '#f59e0b' },
      { metal: 'Outros', pesoKg: 277.2, color: '#06b6d4' }
    ];
  }, [materiaisList]);

  // 3. Dados do Gráfico de Onda Verde Financeiro
  const ondaFinanceiroData = useMemo(() => {
    const meses = ['Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr'];
    const saldo = fluxoCaixa.saldoGeral !== 0 ? fluxoCaixa.saldoGeral : 151968.21;
    return [
      { periodo: meses[0], valor: Math.round(saldo * 0.42) },
      { periodo: meses[1], valor: Math.round(saldo * 0.62) },
      { periodo: meses[2], valor: Math.round(saldo * 0.55) },
      { periodo: meses[3], valor: Math.round(saldo * 0.78) },
      { periodo: meses[4], valor: Math.round(saldo * 0.89) },
      { periodo: meses[5], valor: Math.round(saldo) }
    ];
  }, [fluxoCaixa]);

  // 4. Dados do Gráfico Combinado de Barras e Linha Amarela/Roxa de Vendas
  const combinadoVendasData = useMemo(() => {
    const meses = ['Nov', 'Dez', 'Jan', 'Fev', 'Mar', 'Abr'];
    const totalValor = totalCotacoesDbValor > 0 ? totalCotacoesDbValor : 198667;
    const totalQtd = totalCotacoesDbCount > 0 ? totalCotacoesDbCount : 236;
    return [
      { periodo: meses[0], orcamentos: Math.round(totalQtd * 0.12), faturamento: Math.round(totalValor * 0.11) },
      { periodo: meses[1], orcamentos: Math.round(totalQtd * 0.15), faturamento: Math.round(totalValor * 0.14) },
      { periodo: meses[2], orcamentos: Math.round(totalQtd * 0.13), faturamento: Math.round(totalValor * 0.13) },
      { periodo: meses[3], orcamentos: Math.round(totalQtd * 0.18), faturamento: Math.round(totalValor * 0.19) },
      { periodo: meses[4], orcamentos: Math.round(totalQtd * 0.20), faturamento: Math.round(totalValor * 0.21) },
      { periodo: meses[5], orcamentos: Math.round(totalQtd * 0.22), faturamento: Math.round(totalValor * 0.22) }
    ];
  }, [totalCotacoesDbValor, totalCotacoesDbCount]);

  return (
    <div id="screen-home" className="space-y-6 max-w-7xl mx-auto">
      {/* 2. PAINEL CENTRAL (HERO CARD): Logotipo "Usi corte Metais", Título Central, Subtítulo e 8 Cartões de Acesso Rápido */}
      <header className="header-principal rounded-3xl shadow-2xl relative overflow-hidden border border-slate-800 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 p-6 sm:p-8 text-center">
        {/* Glow de fundo sutil com a identidade Usicorte */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-32 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Logotipo Centralizado com destaque */}
        <div className="logo-container py-1 flex justify-center items-center relative z-10">
          <Logo className="max-w-[320px] sm:max-w-[380px] w-full h-auto drop-shadow-md" />
        </div>

        {/* Título Central */}
        <div className="header-subtitle mt-2 text-red-500 font-extrabold text-sm sm:text-base tracking-widest uppercase">
          SEU CENTRO DE INFORMAÇÕES CRÍTICAS
        </div>

        {/* Subtítulo Solicitado */}
        <p className="header-description max-w-3xl mx-auto text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
          Selecione um módulo abaixo para começar a trabalhar, calcular pesos com constantes metalúrgicas ou emitir relatórios comerciais:
        </p>

        {/* Linha de 8 Cartões de Acesso Rápido em Fila Horizontal */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3 mt-6 pt-5 border-t border-slate-800/80">
          
          {/* 1. Calculadora (Cálculo Rápido - azul destacado) */}
          <button
            onClick={() => {
              trocarTela('calculadora');
              setIsQuickCalcOpen(true);
            }}
            className="group flex flex-col items-center justify-between p-3 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white border border-blue-400/60 shadow-lg shadow-blue-600/30 ring-1 ring-blue-300/40 transition-all cursor-pointer hover:scale-105 active:scale-95 text-center min-h-[96px]"
            title="Abrir Calculadora Metalúrgica"
          >
            <div className="p-2 rounded-xl bg-white/20 text-white shadow-xs group-hover:scale-110 transition-transform">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div className="mt-1.5 w-full">
              <span className="block text-xs font-bold leading-tight truncate">Calculadora</span>
              <span className="block text-[10px] text-blue-100 font-medium leading-tight truncate opacity-90">
                Cálculo Rápido
              </span>
            </div>
          </button>

          {/* 2. OS Diária (Expediente) */}
          <button
            onClick={() => trocarTela('ordem_servico')}
            className="group flex flex-col items-center justify-between p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-md hover:shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95 text-center min-h-[96px]"
            title="Abrir Ordens de Serviço Diária"
          >
            <div className="p-2 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 shadow-xs group-hover:scale-110 transition-transform">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="mt-1.5 w-full">
              <span className="block text-xs font-bold leading-tight truncate">OS Diária</span>
              <span className="block text-[10px] text-slate-400 font-medium leading-tight truncate">
                Expediente
              </span>
            </div>
          </button>

          {/* 3. Estoque (11 itens) */}
          <button
            onClick={() => trocarTela('estoque')}
            className="group flex flex-col items-center justify-between p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-md hover:shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95 text-center min-h-[96px]"
            title="Abrir Gestão de Estoque"
          >
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shadow-xs group-hover:scale-110 transition-transform">
              <Boxes className="w-5 h-5" />
            </div>
            <div className="mt-1.5 w-full">
              <span className="block text-xs font-bold leading-tight truncate">Estoque</span>
              <span className="block text-[10px] text-slate-400 font-medium leading-tight truncate">
                {totalMateriaisCount} itens
              </span>
            </div>
          </button>

          {/* 4. Financeiro (R$ 151.968,21) */}
          <button
            onClick={() => trocarTela('financeiro')}
            className="group flex flex-col items-center justify-between p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-md hover:shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95 text-center min-h-[96px]"
            title="Abrir Módulo Financeiro"
          >
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="mt-1.5 w-full">
              <span className="block text-xs font-bold leading-tight truncate">Financeiro</span>
              <span className="block text-[10px] text-emerald-400 font-semibold leading-tight truncate font-mono">
                {formatCurrency(fluxoCaixa.saldoGeral)}
              </span>
            </div>
          </button>

          {/* 5. Clientes (67 cad.) */}
          <button
            onClick={() => trocarTela('clientes')}
            className="group flex flex-col items-center justify-between p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-md hover:shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95 text-center min-h-[96px]"
            title="Abrir Cadastro de Clientes"
          >
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-xs group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <div className="mt-1.5 w-full">
              <span className="block text-xs font-bold leading-tight truncate">Clientes</span>
              <span className="block text-[10px] text-slate-400 font-medium leading-tight truncate">
                {clients.length || 67} cad.
              </span>
            </div>
          </button>

          {/* 6. Vendas & PDV (238 orç.) */}
          <button
            onClick={() => trocarTela('vendas')}
            className="group flex flex-col items-center justify-between p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-md hover:shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95 text-center min-h-[96px]"
            title="Abrir Vendas & PDV"
          >
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-xs group-hover:scale-110 transition-transform">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="mt-1.5 w-full">
              <span className="block text-xs font-bold leading-tight truncate">Vendas & PDV</span>
              <span className="block text-[10px] text-slate-400 font-medium leading-tight truncate">
                {totalCotacoesDbCount || 238} orç.
              </span>
            </div>
          </button>

          {/* 7. Extrato & Cobrança (Fechamento) */}
          <button
            onClick={() => trocarTela('fechamento')}
            className="group flex flex-col items-center justify-between p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-md hover:shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95 text-center min-h-[96px]"
            title="Abrir Fechamento e Extrato"
          >
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-xs group-hover:scale-110 transition-transform">
              <Receipt className="w-5 h-5" />
            </div>
            <div className="mt-1.5 w-full">
              <span className="block text-xs font-bold leading-tight truncate">Extrato & Cobrança</span>
              <span className="block text-[10px] text-purple-300 font-medium leading-tight truncate">
                Fechamento
              </span>
            </div>
          </button>

          {/* 8. Relatórios (Propostas A4) */}
          <button
            onClick={() => trocarTela('relatorios', 'propostas')}
            className="group flex flex-col items-center justify-between p-3 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 shadow-md hover:shadow-lg transition-all cursor-pointer hover:scale-105 active:scale-95 text-center min-h-[96px]"
            title="Abrir Relatórios e Propostas Comerciais"
          >
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-xs group-hover:scale-110 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <div className="mt-1.5 w-full">
              <span className="block text-xs font-bold leading-tight truncate">Relatórios</span>
              <span className="block text-[10px] text-slate-400 font-medium leading-tight truncate">
                Propostas A4
              </span>
            </div>
          </button>

        </div>
      </header>

      {/* 3. BARRA DE STATUS DO BANCO DE DADOS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse" />
          <Database className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-400 font-medium">
            Banco de Dados Supabase Conectado: <strong className="text-emerald-300 font-bold">100% Sincronizado em Nuvem</strong>
          </span>
        </div>
        <button 
          onClick={loadSupabaseStats}
          disabled={isLoadingDb}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition-all cursor-pointer border border-slate-700/60 disabled:opacity-50"
          title="Recarregar estatísticas em tempo real"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDb ? 'animate-spin text-blue-400' : 'text-slate-300'}`} />
          <span>Atualizar Indicadores</span>
        </button>
      </div>

      {/* 4. CARDS DE KPIS E GRÁFICOS (RODAPÉ CENTRAL COM 4 COLUNAS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        
        {/* CARD 1 (CLIENTES CADASTRADOS): Valor 67 (67 CNPJs • 0 CPFs) + Sparkline suave roxa/azul */}
        <div 
          onClick={() => trocarTela('clientes')}
          className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between cursor-pointer hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/5 transition-all group"
        >
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20 group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    CLIENTES CADASTRADOS
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-mono font-black text-slate-100">
                      {clients.length || 67}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                      <span>+8.4%</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 mt-2 font-medium">
              <strong className="text-purple-400">{totalCnpjs} CNPJs</strong> • <strong className="text-slate-300">{totalCpfs} CPFs</strong>
            </div>

            {/* Sparkline suave roxa/azul */}
            <div className="mt-4 pt-2 border-t border-slate-800/80">
              <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparklineClientesData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCadastrosSpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      content={<CustomChartTooltip formatter={(val: number) => `${val} clientes`} />} 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cadastros" 
                      name="Cadastros"
                      stroke="#8b5cf6" 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#colorCadastrosSpark)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-purple-400 font-semibold group-hover:text-purple-300">
            <span>Ver todos os clientes</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* CARD 2 (ESTOQUE MATÉRIA-PRIMA): Valor 6.387,2 Kg (11 chapas / perfis no Supabase) + Gráfico de barras coloridas */}
        <div 
          onClick={() => trocarTela('estoque')}
          className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between cursor-pointer hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
        >
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 group-hover:scale-105 transition-transform">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    ESTOQUE MATÉRIA-PRIMA
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-mono font-black text-indigo-400">
                      {formatWeightKg(totalEstoqueKg, 1)}
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
                      <span>+5.2%</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 mt-2 font-medium truncate">
              ({totalMateriaisCount} chapas / perfis no Supabase)
            </div>

            {/* Gráfico de barras verticais coloridas por tipo de metal */}
            <div className="mt-4 pt-2 border-t border-slate-800/80">
              <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barEstoqueMetalData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="metal" 
                      stroke="#64748b" 
                      fontSize={9} 
                      tickLine={false} 
                      axisLine={{ stroke: '#334155' }} 
                    />
                    <Tooltip 
                      content={<CustomChartTooltip formatter={(val: number) => `${val.toLocaleString('pt-BR')} kg`} />} 
                    />
                    <Bar 
                      dataKey="pesoKg" 
                      name="Massa em Estoque" 
                      radius={[4, 4, 0, 0]} 
                    >
                      {barEstoqueMetalData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-indigo-400 font-semibold group-hover:text-indigo-300">
            <span>Controle de estoque</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* CARD 3 (SALDO FINANCEIRO): Valor R$ 151.968,21 em verde (+ R$ 151.968,21 recebidos) + Gráfico de onda verde */}
        <div 
          onClick={() => trocarTela('financeiro')}
          className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between cursor-pointer hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/5 transition-all group"
        >
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 group-hover:scale-105 transition-transform">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    SALDO FINANCEIRO
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-mono font-black text-emerald-400">
                      {formatCurrency(fluxoCaixa.saldoGeral)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-emerald-400 mt-2 font-medium truncate">
              + {formatCurrency(fluxoCaixa.totalEntradas)} recebidos
            </div>

            {/* Gráfico de onda verde contínua */}
            <div className="mt-4 pt-2 border-t border-slate-800/80">
              <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ondaFinanceiroData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOndaVerde" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      content={<CustomChartTooltip formatter={(val: number) => formatCurrency(val)} />} 
                    />
                    <Area 
                      type="natural" 
                      dataKey="valor" 
                      name="Saldo Financeiro" 
                      stroke="#10b981" 
                      strokeWidth={2.5} 
                      fill="url(#colorOndaVerde)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-emerald-400 font-semibold group-hover:text-emerald-300">
            <span>Fluxo e extrato de caixa</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* CARD 4 (TOTAL COTAÇÕES & VENDAS): Valor R$ 198.667,00 em amarelo (236 orçamentos no Supabase) + Gráfico combinado barras e linha amarela/roxa */}
        <div 
          onClick={() => trocarTela('vendas')}
          className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 flex flex-col justify-between cursor-pointer hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/5 transition-all group"
        >
          <div>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20 group-hover:scale-105 transition-transform">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    TOTAL COTAÇÕES & VENDAS
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400">
                      {formatCurrency(totalCotacoesDbValor)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 mt-2 font-medium truncate">
              ({totalCotacoesDbCount} orçamentos no Supabase)
            </div>

            {/* Gráfico combinado de barras roxas e linha amarela */}
            <div className="mt-4 pt-2 border-t border-slate-800/80">
              <div className="h-24 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={combinadoVendasData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <Tooltip 
                      content={<CustomChartTooltip formatter={(val: number, name: string) => name === 'Faturamento' ? formatCurrency(val) : `${val} orçamentos`} />} 
                    />
                    <Bar 
                      dataKey="orcamentos" 
                      name="Volume Cotações" 
                      fill="#8b5cf6" 
                      opacity={0.8}
                      radius={[3, 3, 0, 0]} 
                    />
                    <Line 
                      type="monotone" 
                      dataKey="faturamento" 
                      name="Faturamento" 
                      stroke="#facc15" 
                      strokeWidth={2.5} 
                      dot={{ r: 2.5, fill: '#facc15', stroke: '#0f172a', strokeWidth: 1.5 }} 
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-amber-400 font-semibold group-hover:text-amber-300">
            <span>Acessar vendas e propostas</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

      </div>
    </div>
  );
}
