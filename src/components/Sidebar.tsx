import React from 'react';
import { ScreenType } from '../App';
import { UserProfile } from '../lib/db';
import { MATERIAL_PROFILES } from '../utils/calculator';
import { useMaterialsCatalog } from '../services/materialsService';
import { PWAInstallButton } from './PWAInstallButton';
import { 
  Home, 
  Users, 
  Package, 
  Calculator, 
  ClipboardList, 
  ShoppingCart, 
  FileText, 
  Search,
  FileCode, 
  Boxes,
  DollarSign,
  Building2,
  Scissors,
  Receipt,
  Barcode,
  Calendar,
  LogOut,
  X 
} from 'lucide-react';
import { getMateriaisEstoque } from '../services/inventoryFinanceService';

interface SidebarProps {
  currentScreen: ScreenType;
  reportsTab?: 'propostas' | 'consulta';
  isMobileSidebarOpen: boolean;
  clientsCount: number;
  isAdmin: boolean;
  currentUser?: string | null;
  currentUserProfile?: UserProfile | null;
  setIsMobileSidebarOpen: (val: boolean) => void;
  trocarTela: (screen: ScreenType, tab?: 'propostas' | 'consulta') => void;
  setIsQuickCalcOpen: (val: boolean) => void;
  onOpenHistoricoFechamento?: () => void;
  onLogout?: () => void;
}

export default function Sidebar({
  currentScreen,
  reportsTab = 'propostas',
  isMobileSidebarOpen,
  clientsCount,
  isAdmin,
  currentUser,
  currentUserProfile,
  setIsMobileSidebarOpen,
  trocarTela,
  setIsQuickCalcOpen,
  onOpenHistoricoFechamento,
  onLogout
}: SidebarProps) {
  const { materials } = useMaterialsCatalog();
  const totalMateriaisCount = materials.length > 0 ? materials.length : MATERIAL_PROFILES.length;

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

        {/* CONTROLE DE ACESSO RBAC: MODO OPERADOR (RESTRITO) */}
        {!isAdmin ? (
          <div className="flex-1 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-2xl mb-1 text-left">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-300 mb-1">
                  <Calculator className="w-4 h-4 text-blue-400" />
                  <span>Acesso Restrito: Operador</span>
                </div>
                <p className="text-[11px] text-slate-200 font-bold leading-tight">
                  {currentUserProfile?.nome || currentUser || 'Operador'}
                </p>
                <p className="text-[10px] text-blue-300/80 mt-0.5">
                  Calculadora de Pesos/Cortes & Orçamentos
                </p>
              </div>

              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-2 pb-1">
                Calculadora & Cortes
              </div>

              <button 
                onClick={() => {
                  trocarTela('calculadora');
                  setIsQuickCalcOpen(true);
                }}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer w-full text-left ${
                  currentScreen === 'calculadora'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40 ring-2 ring-blue-400/30' 
                    : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Calculator className="w-5 h-5 shrink-0 text-white" />
                <div className="flex flex-col">
                  <span>Calculadora Usicorte ⚡</span>
                  <span className="text-[10px] text-blue-200 font-normal">Cálculo Rápido de Cortes & Pesos</span>
                </div>
              </button>

              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-3 pb-1">
                Vendas & Cotações
              </div>

              <button 
                onClick={() => trocarTela('vendas')}
                title="Vendas & PDV"
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
                  currentScreen === 'vendas' || currentScreen === 'orcamento' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40' 
                    : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <ShoppingCart className="w-4 h-4 shrink-0 text-slate-300" />
                <span>Vendas & PDV</span>
              </button>

              {/* Botão de Instalação PWA para Operador */}
              <div className="mt-2">
                <PWAInstallButton variant="sidebar" />
              </div>
            </div>

            {/* Opção de Encerrar Sessão (Sair) */}
            <div className="pt-4 border-t border-slate-800 pb-2">
              <button
                onClick={onLogout}
                className="flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 transition-all cursor-pointer w-full shadow-sm"
                title="Encerrar Sessão (Sair)"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Encerrar Sessão (Sair)</span>
              </button>
            </div>
          </div>
        ) : (
          /* MODO ADMINISTRADOR: MENU COMPLETO */
          <>
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
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">{totalMateriaisCount}</span>
            </button>

            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-4 pb-1">Vendas & Serviços</div>

            <button 
              onClick={() => {
                trocarTela('calculadora');
                setIsQuickCalcOpen(true);
              }}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer w-full text-left ${
                currentScreen === 'calculadora'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/20 border border-blue-400/30'
              }`}
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
              title="Vendas & PDV"
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
                currentScreen === 'vendas' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <ShoppingCart className="w-4 h-4 shrink-0" />
              <span>Vendas & PDV</span>
            </button>

            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-4 pb-1">Estoque & Financeiro</div>

            <button 
              onClick={() => trocarTela('estoque')}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
                currentScreen === 'estoque' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Boxes className="w-4 h-4 shrink-0 text-blue-400" />
                <span>Estoque & Retalhos</span>
              </div>
              <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono">
                {getMateriaisEstoque().length}
              </span>
            </button>

            <button 
              onClick={() => trocarTela('financeiro')}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
                currentScreen === 'financeiro' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>Caixa & Financeiro</span>
            </button>

            <button 
              onClick={() => trocarTela('fechamento')}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
                currentScreen === 'fechamento' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Receipt className="w-4 h-4 shrink-0 text-blue-400" />
                <span>Fechamento & Extrato</span>
              </div>
              <span className="text-[9px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1 py-0.5 rounded font-mono font-bold">
                Cobrança
              </span>
            </button>

            {onOpenHistoricoFechamento && (
              <button 
                onClick={onOpenHistoricoFechamento}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer w-full text-left bg-purple-950/40 hover:bg-purple-900/60 text-purple-200 border border-purple-500/30 hover:border-purple-400 shadow-sm"
                title="Histórico de Fechamentos Mensais Gravados no Supabase"
              >
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 shrink-0 text-purple-400" />
                  <span>Histórico de Fechamentos</span>
                </div>
                <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded font-mono font-bold">
                  Supabase
                </span>
              </button>
            )}

            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-4 pb-1">Gestão & Fiscal</div>

            <button 
              onClick={() => trocarTela('relatorios', 'propostas')}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
                currentScreen === 'relatorios' && reportsTab === 'propostas' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0 text-blue-400" />
              <span>📄 Emissão de Propostas & Etiquetas</span>
            </button>

            <button 
              onClick={() => trocarTela('relatorios', 'consulta')}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
                currentScreen === 'relatorios' && reportsTab === 'consulta' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>🔍 Consulta & Relatório Geral</span>
            </button>

            <button 
              onClick={() => trocarTela('movimentacoes')}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
                currentScreen === 'movimentacoes' 
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold' 
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Barcode className="w-4 h-4 shrink-0 text-indigo-400" />
                <span>Andamento das Movimentações</span>
              </div>
              <span className="text-[9px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1 py-0.5 rounded font-mono font-bold">
                Boletos
              </span>
            </button>

            <button 
              onClick={() => trocarTela('empresa')}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
                currentScreen === 'empresa' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 shrink-0 text-blue-400" />
                <span>Dados da Empresa / Emitente</span>
              </div>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0.5 rounded font-mono font-bold">
                NF-e
              </span>
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

            {/* Botão de Instalação PWA para Administrador */}
            <div className="pt-2">
              <PWAInstallButton variant="sidebar" />
            </div>
          </>
        )}

        <div className="mt-auto pt-4 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span>Status Sistema:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              ONLINE
            </span>
          </div>
          <div className="text-[10px] text-slate-500">
            {isAdmin ? 'Acesso Total (Admin)' : 'Acesso Restrito (Operador)'}
          </div>
        </div>
      </aside>
    </>
  );
}