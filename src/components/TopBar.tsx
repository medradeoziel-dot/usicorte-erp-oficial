import React from 'react';
import Logo from './Logo';
import { ScreenType } from '../App';
import { UserProfile } from '../lib/db';
import { PWAInstallButton } from './PWAInstallButton';
import { 
  Menu, 
  Lock, 
  LogOut, 
  LogIn, 
  ShieldCheck
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
    <header className="topbar no-print h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 sm:px-6 z-20 shrink-0 sticky top-0">
      {/* 1. Lado Esquerdo: Logotipo "Usi corte Metais" com a etiqueta vermelha "ERP" */}
      <div className="flex items-center gap-2.5">
        <button 
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="md:hidden text-slate-300 hover:text-white p-2 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
          title="Abrir Menu Lateral"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button 
          onClick={() => trocarTela(isAdmin ? 'home' : 'calculadora')}
          className="flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer text-left"
          title="Ir para o Início"
        >
          <Logo className="h-8 sm:h-9 w-auto" />
          <span className="text-[10px] bg-red-600/25 text-red-500 border border-red-600/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-xs">
            ERP
          </span>
        </button>
      </div>

      {/* 2. Centro: Logotipo Central "Usi corte Metais" com etiqueta vermelha "ERP" */}
      <div className="hidden md:flex items-center justify-center flex-1 px-4">
        <button 
          onClick={() => trocarTela(isAdmin ? 'home' : 'calculadora')}
          className="flex items-center gap-2.5 hover:opacity-90 transition-opacity cursor-pointer py-1 px-3 rounded-xl hover:bg-slate-800/40"
          title="Ir para o Início"
        >
          <Logo className="h-9 sm:h-10 w-auto" />
          <span className="text-[10px] bg-red-600/25 text-red-500 border border-red-600/40 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow-xs">
            ERP
          </span>
        </button>
      </div>

      {/* 3. Lado Direito: Botão Verde Instalar App, Badge Usuário "Logado como: OZIEL MEDRADE - Administrador ADMIN" e Encerrar Sessão */}
      <div className="flex items-center gap-2 sm:gap-3 justify-end">
        {/* Botão de Instalação PWA Verde */}
        <PWAInstallButton variant="topbar" />

        {/* Badge do Usuário e Botão Encerrar Sessão */}
        {currentUser ? (
          <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-800">
            <button 
              type="button"
              onClick={() => setIsLoginOpen(true)}
              className="flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer text-left py-1 px-2 rounded-xl hover:bg-slate-800/50"
              title="Clique para ver dados do perfil ou alternar usuário"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner uppercase shrink-0 border ${
                isAdmin 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                  : 'bg-blue-600 text-white border-blue-400/40'
              }`}>
                {isAdmin ? '👑' : currentUser.charAt(0)}
              </div>
              <div className="flex flex-col text-left hidden sm:flex">
                <span className="text-[11px] font-bold text-slate-200 leading-tight flex items-center gap-1">
                  <span className="text-slate-400 font-normal">Logado como:</span>
                  <strong className={isAdmin ? 'text-amber-400 font-bold' : 'text-blue-300 font-bold'}>
                    {currentUser || 'OZIEL MEDRADE'}
                  </strong>
                </span>
                <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                  <span className={isAdmin ? 'text-amber-300 font-semibold' : 'text-slate-300 font-semibold'}>
                    {currentUserProfile?.cargo || (isAdmin ? 'Administrador' : 'Operador')}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-black uppercase tracking-wider border ${
                    isAdmin 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                      : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  }`}>
                    {isAdmin ? 'ADMIN' : 'OPERADOR'}
                  </span>
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="ml-1 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-600 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-xs"
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
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-blue-600/20"
          >
            <LogIn className="w-4 h-4" />
            <span>Fazer Login</span>
          </button>
        )}
      </div>
    </header>
  );
}