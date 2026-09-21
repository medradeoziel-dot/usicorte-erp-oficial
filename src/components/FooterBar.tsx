import React from 'react';
import { UserProfile } from '../lib/db';

interface FooterBarProps {
  currentUser: string | null;
  currentUserProfile?: UserProfile | null;
  isAdmin?: boolean;
  currentTime: string;
}

export default function FooterBar({ currentUser, currentUserProfile, isAdmin, currentTime }: FooterBarProps) {
  return (
    <footer className="statusbar no-print h-8 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-5 text-[11px] text-slate-400 z-20 shrink-0 select-none">
      <div className="flex items-center gap-2.5">
        <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse"></div>
        <span>Empresa: <strong className="text-slate-200">USICORTE METAIS EIRELI</strong></span>
      </div>

      <div className="flex items-center gap-3 font-mono text-[10px]">
        <span>
          Usuário: <strong className={isAdmin ? "text-amber-400" : "text-blue-300"}>{currentUser || 'NÃO AUTENTICADO'}</strong>
          {currentUser && (
            <span className="text-slate-400 ml-1">
              ({currentUserProfile?.cargo || (isAdmin ? 'Administrador' : 'Operador')})
            </span>
          )}
        </span>
        <span className="text-slate-600">|</span>
        <span>Perfil: <strong className={isAdmin ? "text-amber-400" : "text-emerald-400"}>{isAdmin ? 'ACESSO TOTAL' : 'OPERADOR RESTRITO'}</strong></span>
        <span className="text-slate-600">|</span>
        <span>Versão: <strong className="text-slate-300">2026.1.0</strong></span>
        <span className="text-slate-600">|</span>
        <span className="text-emerald-400 font-bold">{currentTime}</span>
      </div>
    </footer>
  );
}