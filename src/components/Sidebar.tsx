import React from 'react';
import { ScreenType } from '../App';
import { MATERIAL_PROFILES } from '../utils/calculator';
import { Home, Users, Package, Calculator, ClipboardList, ShoppingCart, FileText, FileCode, X } from 'lucide-react';

interface SidebarProps {
  currentScreen: ScreenType;
  isMobileSidebarOpen: boolean;
  clientsCount: number;
  setIsMobileSidebarOpen: (val: boolean) => void;
  trocarTela: (screen: ScreenType) => void;
  setIsQuickCalcOpen: (val: boolean) => void;
}

export default function Sidebar({
  currentScreen,
  isMobileSidebarOpen,
  clientsCount,
  setIsMobileSidebarOpen,
  trocarTela,
  setIsQuickCalcOpen
}: SidebarProps) {
  return (
    <>
      {isMobileSidebarOpen && (
        <div 
          id="sidebarOverlay" 
          onClick={() => setIsMobileSidebarOpen(false)} 
          className="fixed inset-0 bg-black/70 z-30 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      <aside className={`sidebar no-print fixed md:static inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-3 gap-1 overflow-y-auto shrink-0 select-none z-40 transition-transform duration-300 ease-in-out ${
        isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="flex justify-between items-center md:hidden pb-2.5 border-b border-slate-800 mb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Menu de Navegação</span>
          <button onClick={() => setIsMobileSidebarOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-2 pb-1">Navegação Principal</div>

        <button 
          onClick={() => trocarTela('home')}
          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
            currentScreen === 'home' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <Home className="w-4 h-4 shrink-0" />
          <span>Início / Dashboard</span>
        </button>

        <button 
          onClick={() => trocarTela('clientes')}
          className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
            currentScreen === 'clientes' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <Users className="w-4 h-4 shrink-0" />
            <span>Cadastro de Clientes</span>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">{clientsCount}</span>
        </button>

        <button 
          onClick={() => trocarTela('produtos')}
          className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
            currentScreen === 'produtos' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <Package className="w-4 h-4 shrink-0" />
            <span>Cadastro de Produtos</span>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">{MATERIAL_PROFILES.length}</span>
        </button>

        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-4 pb-1">Vendas & Lançamentos</div>

        <button 
          onClick={() => trocarTela('orcamento')}
          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
            currentScreen === 'orcamento' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <Calculator className="w-4 h-4 shrink-0" />
          <span>Lançamento / Orçamento</span>
        </button>

        <button 
          onClick={() => setIsQuickCalcOpen(true)}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer w-full text-left bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/20 border border-blue-400/30"
        >
          <Calculator className="w-4 h-4 shrink-0 text-blue-200" />
          <span>Calculadora Usicorte ⚡</span>
        </button>

        <button 
          onClick={() => trocarTela('ordem_servico')}
          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
            currentScreen === 'ordem_servico' ? 'bg-red-600 text-white shadow-md shadow-red-600/30 font-bold' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <ClipboardList className="w-4 h-4 shrink-0 text-red-400" />
          <span>OS Diária (Expediente)</span>
        </button>

        <button 
          onClick={() => trocarTela('vendas')}
          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
            currentScreen === 'vendas' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <ShoppingCart className="w-4 h-4 shrink-0" />
          <span>Força de Vendas / PDV</span>
        </button>

        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-4 pb-1">Gestão & Fiscal</div>

        <button 
          onClick={() => trocarTela('relatorios')}
          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
            currentScreen === 'relatorios' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 shrink-0" />
          <span>Relatórios & Propostas</span>
        </button>

        <button 
          onClick={() => trocarTela('php')}
          className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
            currentScreen === 'php' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
          }`}
        >
          <FileCode className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>Código PHP / MySQL</span>
        </button>

        <div className="mt-auto pt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span>Status Sistema:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              ONLINE
            </span>
          </div>
          <div className="text-[10px] text-slate-500">Banco Local & APIs Ativas</div>
        </div>
      </aside>
    </>
  );
}