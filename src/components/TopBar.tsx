import React from 'react';
import Logo from './Logo';
import { ScreenType } from '../App';
import { UserProfile } from '../lib/db';
import { PWAInstallButton } from './PWAInstallButton';
import { 
  Menu, 
  Package, 
  Users, 
  ShoppingCart, 
  FileText, 
  Boxes, 
  DollarSign, 
  Building2, 
  Calendar,
  Calculator,
  Lock,
  LogOut,
  LogIn,
  ShieldCheck,
  Receipt
} from 'lucide-react';

interface TopBarProps {
  currentScreen: ScreenType;
  currentUser: string | null;
  currentUserProfile?: UserProfile | null;
  isAdmin: boolean;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (val: boolean) => void;
  trocarTela: (screen: ScreenType) => void;
  setIsLoginOpen: (val: boolean) => void;
  onOpenHistoricoFechamento?: () => void;
  setIsQuickCalcOpen?: (val: boolean) => void;
  onLogout: () => void;
}

export default function TopBar({
  currentScreen,
  currentUser,
  currentUserProfile,
  isAdmin,
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  trocarTela,
  setIsLoginOpen,
  onOpenHistoricoFechamento,
  setIsQuickCalcOpen,
  onLogout
}: TopBarProps) {
  const isDia1 = new Date().getDate() === 1;

  return (
    <header className="topbar no-print h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 sm:px-5 z-20 shrink-0 sticky top-0">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="md:hidden text-slate-300 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          title="Abrir Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button 
          onClick={() => trocarTela(isAdmin ? 'home' : 'calculadora')}
          className="flex items-center gap-2.5 hover:opacity-90 transition-opacity cursor-pointer text-left"
        >
          <Logo className="h-9 sm:h-10 w-auto" />
          <span className="text-[10px] bg-red-600/20 text-red-500 border border-red-600/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider hidden sm:inline-block">
            ERP
          </span>
          {!isAdmin && currentUser && (
            <span className="hidden xl:inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-md font-semibold">
              <Lock className="w-3 h-3 text-blue-400" />
              <span>Modo Operador</span>
            </span>
          )}
        </button>
      </div>

      {/* NAVEGAÇÃO SUPERIOR - DINÂMICA POR NÍVEL DE ACESSO (RBAC) */}
      <nav className="hidden md:flex items-center gap-1.5 overflow-x-auto py-1">
        {isAdmin ? (
          // Menu Completo para Administrador
          [
            { id: 'produtos', label: 'Produtos', icon: Package },
            { id: 'clientes', label: 'Clientes', icon: Users },
            { id: 'vendas', label: 'Vendas & PDV', icon: ShoppingCart },
            { id: 'estoque', label: 'Estoque', icon: Boxes },
            { id: 'financeiro', label: 'Financeiro', icon: DollarSign },
            { id: 'fechamento', label: 'Fechamento & Extrato', icon: Receipt },
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
                <span className="text-[11px] font-semibold whitespace-nowrap">{item.label}</span>
              </button>
            );
          })
        ) : (
          // Menu Restrito para Operador / Calculadora
          <div className="flex items-center gap-2">
            {setIsQuickCalcOpen && (
              <button
                onClick={() => {
                  trocarTela('calculadora');
                  setIsQuickCalcOpen(true);
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  currentScreen === 'calculadora'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-md shadow-amber-500/30 ring-1 ring-amber-400'
                    : 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300'
                }`}
              >
                <Calculator className="w-4 h-4" />
                <span>Calculadora Usicorte ⚡</span>
              </button>
            )}

            <button
              onClick={() => trocarTela('vendas')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                currentScreen === 'vendas' || currentScreen === 'orcamento'
                  ? 'bg-blue-600 text-white border-transparent shadow-md shadow-blue-600/30'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Vendas & PDV</span>
            </button>

            <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Acesso restrito à Calculadora / Orçamentos</span>
            </div>
          </div>
        )}
      </nav>

      {/* ÁREA DIREITA: Fechamento (Admin) & Instalação PWA & Dados da Sessão / Logout */}
      <div className="flex items-center gap-2">
        {/* Fechamento Mensal no Login: Apenas Admin */}
        {isAdmin && onOpenHistoricoFechamento && (
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

        {/* Botão de Instalação PWA no canto superior direito, antes do perfil do usuário */}
        <PWAInstallButton variant="topbar" />

        {/* Informação do Usuário Logado e Cargo / Opção de Encerrar Sessão */}
        {currentUser ? (
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-800">
            <button 
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className="flex items-center gap-2.5 hover:opacity-90 transition-opacity cursor-pointer text-left"
              title="Clique para alternar usuário ou ver dados do perfil"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner uppercase shrink-0 border ${
                isAdmin 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                  : 'bg-blue-600 text-white border-blue-400/40'
              }`}>
                {isAdmin ? '👑' : currentUser.charAt(0)}
              </div>
              <div className="flex flex-col text-left hidden sm:flex">
                <span className="text-xs font-bold text-slate-200 leading-tight flex items-center gap-1">
                  <span>Logado como:</span>
                  <strong className={isAdmin ? 'text-amber-400' : 'text-blue-300'}>{currentUser}</strong>
                </span>
                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                  <span>•</span>
                  <span className={`font-semibold ${isAdmin ? 'text-amber-400' : 'text-slate-300'}`}>
                    {currentUserProfile?.cargo || (isAdmin ? 'Administrador' : 'Operador')}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-extrabold uppercase border ${
                    isAdmin 
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' 
                      : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                  }`}>
                    {isAdmin ? 'ADMIN' : 'OPERADOR'}
                  </span>
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="ml-1 sm:ml-2 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-600 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
              title="Encerrar Sessão do usuário"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Encerrar Sessão</span>
            </button>
          </div>
        ) : (
          <button 
            type="button"
            onClick={() => setIsLoginOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-blue-600/20"
          >
            <LogIn className="w-4 h-4" />
            <span>Fazer Login</span>
          </button>
        )}
      </div>
    </header>
  );
}