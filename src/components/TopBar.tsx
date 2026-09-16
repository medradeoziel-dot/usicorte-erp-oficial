import React from 'react';
import Logo from './Logo';
import { ScreenType } from '../App';
import { Menu, Package, Users, Calculator, ShoppingCart, FileText, Boxes, DollarSign, Building2, Calendar } from 'lucide-react';

interface TopBarProps {
  currentScreen: ScreenType;
  currentUser: string | null;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (val: boolean) => void;
  trocarTela: (screen: ScreenType) => void;
  setIsLoginOpen: (val: boolean) => void;
  onOpenHistoricoFechamento?: () => void;
}

export default function TopBar({
  currentScreen,
  currentUser,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  trocarTela,
  setIsLoginOpen,
  onOpenHistoricoFechamento
}: TopBarProps) {
  const isDia1 = new Date().getDate() === 1;
  return (
    <header className="topbar no-print h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sm:px-5 z-20 shrink-0 sticky top-0">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="md:hidden text-slate-300 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          title="Abrir Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button 
          onClick={() => trocarTela('home')}
          className="flex items-center gap-2.5 hover:opacity-90 transition-opacity cursor-pointer text-left"
        >
          <Logo className="h-9 sm:h-10 w-auto" />
          <span className="text-[10px] bg-red-600/20 text-red-500 border border-red-600/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider hidden sm:inline-block">
            ERP
          </span>
        </button>
      </div>

      <nav className="hidden md:flex items-center gap-1.5 overflow-x-auto py-1">
        {[
          { id: 'produtos', label: 'Produtos', icon: Package },
          { id: 'clientes', label: 'Clientes', icon: Users },
          { id: 'orcamento', label: 'Lançamento', icon: Calculator },
          { id: 'vendas', label: 'Vendas', icon: ShoppingCart },
          { id: 'estoque', label: 'Estoque', icon: Boxes },
          { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
          { id: 'relatorios', label: 'Relatórios', icon: FileText },
          { id: 'empresa', label: 'Emitente', icon: Building2 },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => trocarTela(item.id as ScreenType)}
              className={`flex flex-col items-center justify-center px-3.5 py-1.5 rounded-lg border transition-all cursor-pointer min-w-[70px] ${
                isActive
                  ? 'bg-blue-600 text-white border-transparent shadow-md shadow-blue-600/30'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[11px] font-semibold">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        {onOpenHistoricoFechamento && (
          <button
            onClick={onOpenHistoricoFechamento}
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              isDia1
                ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30 animate-pulse'
                : 'bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 border-purple-500/30 hover:border-purple-400'
            }`}
            title="Fechamento Mensal no Login & Histórico no Supabase"
          >
            <Calendar className="w-4 h-4 text-purple-400" />
            <span className="hidden lg:inline">Fechamento Mensal</span>
            {isDia1 && (
              <span className="bg-amber-400 text-black text-[9px] px-1.5 py-0.2 rounded font-black uppercase">
                Dia 1º
              </span>
            )}
          </button>
        )}

        <button 
          onClick={() => setIsLoginOpen(true)}
          className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-slate-800 hover:opacity-80 transition-opacity cursor-pointer text-left"
          title="Clique para alternar usuário ou cadastrar novo funcionário"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-inner uppercase">
            {currentUser ? currentUser.charAt(0) : '?'}
          </div>
          <div className="flex flex-col text-left hidden sm:flex">
            <span className="text-xs font-bold text-slate-200 leading-tight">
              {currentUser || 'Entrar no Sistema'}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              {currentUser === 'ADMINISTRADOR' ? 'Administrador' : currentUser ? 'Funcionário' : 'Clique para Login'}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
}