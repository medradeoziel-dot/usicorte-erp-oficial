import React from 'react';
import Logo from './Logo';
import { Client, Quote } from '../types';
import { ScreenType } from '../App';
import { MATERIAL_PROFILES, formatCurrency, formatWeightKg } from '../utils/calculator';
import { Calculator, ClipboardList, Users, Package, ShoppingCart, FileText, Scale, TrendingUp, Boxes, DollarSign } from 'lucide-react';
import { getMateriaisEstoque, calcularFluxoCaixa } from '../services/inventoryFinanceService';

interface DashboardViewProps {
  clients: Client[];
  currentQuote: Quote;
  trocarTela: (screen: ScreenType) => void;
  setIsQuickCalcOpen: (val: boolean) => void;
}

export default function DashboardView({ clients, currentQuote, trocarTela, setIsQuickCalcOpen }: DashboardViewProps) {
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

          <div onClick={() => trocarTela('orcamento')} className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500 p-4 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center text-center gap-2 group hover:-translate-y-1 hover:shadow-xl shadow-slate-950/50">
            <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors border border-blue-500/20"><Calculator className="w-5 h-5" /></div>
            <div>
              <strong className="text-xs text-slate-100 block font-bold group-hover:text-blue-400 transition-colors">Lançamento</strong>
              <span className="text-[10px] text-slate-400">Por ENTER</span>
            </div>
          </div>

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
              <span className="text-[10px] text-slate-400">{getMateriaisEstoque().length} itens</span>
            </div>
          </div>

          <div onClick={() => trocarTela('financeiro')} className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-emerald-500 p-4 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col items-center text-center gap-2 group hover:-translate-y-1 hover:shadow-xl shadow-slate-950/50">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors border border-emerald-500/20"><DollarSign className="w-5 h-5" /></div>
            <div>
              <strong className="text-xs text-slate-100 block font-bold group-hover:text-emerald-400 transition-colors">Financeiro</strong>
              <span className="text-[10px] text-emerald-400 font-bold">{formatCurrency(calcularFluxoCaixa().saldoGeral)}</span>
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
              {formatWeightKg(getMateriaisEstoque().reduce((acc, m) => acc + (m.pesoTotalKg || 0), 0), 1)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">{getMateriaisEstoque().length} chapas / perfis</span>
          </div>
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20"><Boxes className="w-5 h-5" /></div>
        </div>

        <div onClick={() => trocarTela('financeiro')} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex items-center justify-between cursor-pointer hover:border-emerald-500/50 transition-colors">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Saldo Financeiro</span>
            <span className={`text-2xl font-mono font-black block ${calcularFluxoCaixa().saldoGeral >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(calcularFluxoCaixa().saldoGeral)}
            </span>
            <span className="text-[10px] text-emerald-400 font-medium">+ {formatCurrency(calcularFluxoCaixa().totalEntradas)} recebidos</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20"><DollarSign className="w-5 h-5" /></div>
        </div>

        <div onClick={() => trocarTela('orcamento')} className="bg-slate-900 rounded-2xl border border-slate-800 p-5 flex items-center justify-between cursor-pointer hover:border-amber-500/50 transition-colors">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Cotação Atual</span>
            <span className="text-2xl font-mono font-black text-amber-400 block">
              {formatCurrency(currentQuote.totalAmount || currentQuote.grandTotal || 0)}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">{currentQuote.quoteNumber || 'Sem cotação aberta'}</span>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20"><TrendingUp className="w-5 h-5" /></div>
        </div>
      </div>
    </div>
  );
}