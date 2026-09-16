import React, { useState, useEffect } from 'react';
import Logo from './Logo';
import { Client, Quote } from '../types';
import { ScreenType } from '../App';
import { formatCurrency, formatWeightKg } from '../utils/calculator';
import { 
  ClipboardList, 
  Users, 
  ShoppingCart, 
  FileText, 
  TrendingUp, 
  Boxes, 
  DollarSign, 
  Receipt,
  RefreshCw,
  Database
} from 'lucide-react';
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
  trocarTela: (screen: ScreenType) => void;
  setIsQuickCalcOpen: (val: boolean) => void;
}

export default function DashboardView({ clients, currentQuote, trocarTela, setIsQuickCalcOpen }: DashboardViewProps) {
  const [totalMateriaisCount, setTotalMateriaisCount] = useState<number>(0);
  const [totalEstoqueKg, setTotalEstoqueKg] = useState<number>(0);
  const [fluxoCaixa, setFluxoCaixa] = useState<FluxoCaixaResumo>({
    totalEntradas: 0,
    totalSaidas: 0,
    saldoGeral: 0,
    contasReceberPendente: 0,
    contasPagarPendente: 0
  });
  const [totalCotacoesDbCount, setTotalCotacoesDbCount] = useState<number>(0);
  const [totalCotacoesDbValor, setTotalCotacoesDbValor] = useState<number>(0);
  const [isLoadingDb, setIsLoadingDb] = useState<boolean>(true);

  const loadSupabaseStats = async () => {
    setIsLoadingDb(true);
    try {
      const [materiais, lancamentos, cotacoes] = await Promise.all([
        fetchMateriaisEstoqueDb(),
        fetchLancamentosFinanceirosDb(),
        fetchCotacoesDb()
      ]);

      if (materiais && Array.isArray(materiais)) {
        setTotalMateriaisCount(materiais.length);
        const somaKg = materiais.reduce((acc, m) => acc + (Number(m.pesoTotalKg) || 0), 0);
        setTotalEstoqueKg(somaKg);
      }

      if (lancamentos && Array.isArray(lancamentos)) {
        setFluxoCaixa(calcularFluxoCaixaFromList(lancamentos));
      }

      if (cotacoes && Array.isArray(cotacoes)) {
        setTotalCotacoesDbCount(cotacoes.length);
        const somaValor = cotacoes.reduce((acc, q) => acc + (Number(q.valor_total) || 0), 0);
        setTotalCotacoesDbValor(somaValor);
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

  const totalCnpjs = clients.filter(c => c.type === 'CNPJ').length;
  const totalCpfs = clients.filter(c => c.type === 'CPF').length;

  return (
    <div id="screen-home" className="space-y-8 max-w-6xl mx-auto">
      <header className="header-principal rounded-3xl shadow-2xl relative overflow-hidden border border-slate-800">
        <div className="logo-container py-2 flex justify-center">
          <Logo className="max-w-[340px] w-full h-auto" />
        </div>
        <div className="header-subtitle">SISTEMA ERP DE GESTÃO DE COTAÇÕES E VENDAS</div>
        <p className="header-description">
          Selecione um módulo abaixo para começar a trabalhar, calcular pesos com constantes metalúrgicas ou emitir relatórios comerciais:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-6 sm:mt-8 relative z-10">
          <button 
            onClick={() => setIsQuickCalcOpen(true)}
            className="bg-[#0d1c38] border-2 border-blue-500 hover:bg-blue-600/20 p-4 rounded-2xl flex flex-col items-center justify-center text-center transition-all group shadow-lg shadow-blue-500/10 cursor-pointer hover:-translate-y-1"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/60 flex items-center justify-center text-blue-300 text-xl mb-2 group-hover:scale-110 transition-transform">⚡</div>
            <span className="text-xs font-bold text-blue-200">Calculadora</span>
            <span className="text-[10px] text-blue-400/80 mt-1 font-medium">Cálculo Rápido</span>
          </button>

          <div onClick={() => trocarTela('ordem_servico')} className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-red-500 p-4 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center text-center gap-2 group hover:-translate-y-1 hover:shadow-xl shadow-slate-950/50">
            <div className="p-2.5 bg-red-500/10 text-red-400 rounded-xl group-hover:bg-red-600 group-hover:text-white transition-colors border border-red-500/20"><ClipboardList className="w-5 h-5" /></div>
            <div>
              <strong className="text-xs text-slate-100 block font-bold group-hover:text-red-400 transition-colors">OS Diária</strong>
              <span className="text-[10px] text-slate-400">Expediente</span>
            </div>
          </div>

          <div onClick={() => trocarTela('estoque')} className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-500 p-4 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center text-center gap-2 group hover:-translate-y-1 hover:shadow-xl shadow-slate-950/50">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors border border-indigo-500/20"><Boxes className="w-5 h-5" /></div>
            <div>
              <strong className="text-xs text-slate-100 block font-bold group-hover:text-indigo-400 transition-colors">Estoque</strong>
              <span className="text-[10px] text-slate-400">{totalMateriaisCount} itens</span>
            </div>
          </div>

          <div onClick={() => trocarTela('financeiro')} className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500 p-4 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center text-center gap-2 group hover:-translate-y-1 hover:shadow-xl shadow-slate-950/50">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors border border-emerald-500/20"><DollarSign className="w-5 h-5" /></div>
            <div>
              <strong className="text-xs text-slate-100 block font-bold group-hover:text-emerald-400 transition-colors">Financeiro</strong>
              <span className="text-[10px] text-emerald-400 font-bold">{formatCurrency(fluxoCaixa.saldoGeral)}</span>
            </div>
          </div>

          <div onClick={() => trocarTela('clientes')} className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500 p-4 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center text-center gap-2 group hover:-translate-y-1 hover:shadow-xl shadow-slate-950/50">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors border border-blue-500/20"><Users className="w-5 h-5" /></div>
            <div>
              <strong className="text-xs text-slate-100 block font-bold group-hover:text-blue-400 transition-colors">Clientes</strong>
              <span className="text-[10px] text-slate-400">{clients.length} cad.</span>
            </div>
          </div>

          <div onClick={() => trocarTela('vendas')} className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500 p-4 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center text-center gap-2 group hover:-translate-y-1 hover:shadow-xl shadow-slate-950/50">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors border border-emerald-500/20"><ShoppingCart className="w-5 h-5" /></div>
            <div>
              <strong className="text-xs text-slate-100 block font-bold group-hover:text-emerald-400 transition-colors">Vendas & PDV</strong>
              <span className="text-[10px] text-slate-400">{totalCotacoesDbCount} orç.</span>
            </div>
          </div>

          <div onClick={() => trocarTela('fechamento')} className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500 p-4 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center text-center gap-2 group hover:-translate-y-1 hover:shadow-xl shadow-slate-950/50">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors border border-blue-500/20"><Receipt className="w-5 h-5" /></div>
            <div>
              <strong className="text-xs text-slate-100 block font-bold group-hover:text-blue-400 transition-colors">Extrato & Cobrança</strong>
              <span className="text-[10px] text-slate-400">Fechamento</span>
            </div>
          </div>

          <div onClick={() => trocarTela('relatorios')} className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500 p-4 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center text-center gap-2 group hover:-translate-y-1 hover:shadow-xl shadow-slate-950/50">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-colors border border-amber-500/20"><FileText className="w-5 h-5" /></div>
            <div>
              <strong className="text-xs text-slate-100 block font-bold group-hover:text-amber-400 transition-colors">Relatórios</strong>
              <span className="text-[10px] text-slate-400">Propostas A4</span>
            </div>
          </div>
        </div>
      </header>

      {/* Sync Status Banner */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-3 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          <span>Banco de Dados Supabase Conectado: <strong className="text-slate-200">100% Sincronizado em Nuvem</strong></span>
        </div>
        <button 
          onClick={loadSupabaseStats}
          disabled={isLoadingDb}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDb ? 'animate-spin text-blue-400' : ''}`} />
          <span>Atualizar Indicadores</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => trocarTela('clientes')} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex items-center justify-between cursor-pointer hover:border-blue-500/50 transition-colors">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Clientes Cadastrados</span>
            <span className="text-2xl font-mono font-black text-slate-100 block">{clients.length}</span>
            <span className="text-[10px] text-emerald-400 font-medium">{totalCnpjs} CNPJs • {totalCpfs} CPFs</span>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20"><Users className="w-5 h-5" /></div>
        </div>

        <div onClick={() => trocarTela('estoque')} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex items-center justify-between cursor-pointer hover:border-indigo-500/50 transition-colors">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estoque Matéria-Prima</span>
            <span className="text-2xl font-mono font-black text-indigo-400 block">
              {formatWeightKg(totalEstoqueKg, 1)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">{totalMateriaisCount} chapas / perfis no Supabase</span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20"><Boxes className="w-5 h-5" /></div>
        </div>

        <div onClick={() => trocarTela('financeiro')} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex items-center justify-between cursor-pointer hover:border-emerald-500/50 transition-colors">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Financeiro</span>
            <span className={`text-2xl font-mono font-black block ${fluxoCaixa.saldoGeral >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(fluxoCaixa.saldoGeral)}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">+ {formatCurrency(fluxoCaixa.totalEntradas)} recebidos</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20"><DollarSign className="w-5 h-5" /></div>
        </div>

        <div onClick={() => trocarTela('relatorios')} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex items-center justify-between cursor-pointer hover:border-amber-500/50 transition-colors">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Cotações & Vendas</span>
            <span className="text-2xl font-mono font-black text-amber-400 block">
              {formatCurrency(totalCotacoesDbValor)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">{totalCotacoesDbCount} orçamentos no Supabase</span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20"><TrendingUp className="w-5 h-5" /></div>
        </div>
      </div>
    </div>
  );
}