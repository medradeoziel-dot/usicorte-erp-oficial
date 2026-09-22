import React, { useState, useEffect } from 'react';
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
  Barcode, 
  Calendar, 
  LogOut, 
  X, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Receipt,
  Layers,
  PanelLeftClose,
  PanelLeftOpen
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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  onLogout,
  isCollapsed: propIsCollapsed,
  onToggleCollapse
}: SidebarProps) {
  const { materials } = useMaterialsCatalog();
  const totalMateriaisCount = materials.length > 0 ? materials.length : MATERIAL_PROFILES.length;

  // Estado de alternância de largura: false = 'w-64' (completo), true = 'w-20' (compacto)
  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('usicorte_sidebar_collapsed');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalCollapsed;

  // Estado do menu recolhível da categoria FECHAMENTOS (CONSOLIDAÇÃO)
  const [isFechamentoOpen, setIsFechamentoOpen] = useState<boolean>(true);

  const toggleCollapse = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('usicorte_sidebar_collapsed', JSON.stringify(next));
        } catch (e) {
          console.error(e);
        }
        return next;
      });
    }
  };

  // Atalho de teclado rápido Ctrl+B / Cmd+B para alternar menu
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleCollapse]);

  // Tooltip flutuante adicional para o modo recolhido
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    label: string;
    badge?: string;
    y: number;
  } | null>(null);

  const handleItemHover = (
    e: React.MouseEvent<HTMLElement>,
    label: string,
    badge?: string
  ) => {
    if (!isCollapsed) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredTooltip({
      label,
      badge,
      y: rect.top + rect.height / 2,
    });
  };

  const handleItemLeave = () => {
    setHoveredTooltip(null);
  };

  // Renderizador unificado para botões de navegação
  const renderSidebarItem = ({
    id,
    icon: Icon,
    iconColor,
    label,
    subLabel,
    badge,
    badgeColor,
    isActive,
    activeClassName,
    inactiveClassName,
    onClick
  }: {
    id?: string;
    icon: React.ComponentType<{ className?: string }>;
    iconColor?: string;
    label: string;
    subLabel?: string;
    badge?: string | number;
    badgeColor?: string;
    isActive: boolean;
    activeClassName?: string;
    inactiveClassName?: string;
    onClick: () => void;
  }) => {
    if (isCollapsed) {
      return (
        <button
          key={label}
          id={id}
          onClick={onClick}
          onMouseEnter={(e) => handleItemHover(e, label, badge !== undefined ? String(badge) : undefined)}
          onMouseLeave={handleItemLeave}
          className={`w-12 h-12 mx-auto flex items-center justify-center rounded-xl transition-all cursor-pointer relative group ${
            isActive
              ? (activeClassName || 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-1 ring-blue-400/40')
              : (inactiveClassName || 'text-slate-300 hover:bg-slate-800/80 hover:text-white')
          }`}
          title={`${label}${badge !== undefined ? ` (${badge})` : ''}`}
        >
          <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : (iconColor || 'text-slate-300')}`} />
          {badge !== undefined && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-[9px] font-bold flex items-center justify-center border border-slate-900 shadow-xs">
              {badge}
            </span>
          )}
        </button>
      );
    }

    return (
      <button
        key={label}
        id={id}
        onClick={onClick}
        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer w-full text-left ${
          isActive
            ? (activeClassName || 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold')
            : (inactiveClassName || 'text-slate-300 hover:bg-slate-800/80 hover:text-white')
        }`}
        title={label}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : (iconColor || 'text-slate-300')}`} />
          <div className="flex flex-col min-w-0">
            <span className="truncate">{label}</span>
            {subLabel && (
              <span className="text-[10px] text-blue-200 font-normal truncate">{subLabel}</span>
            )}
          </div>
        </div>
        {badge !== undefined && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
            badgeColor || (isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400')
          }`}>
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <>
      {/* Overlay Mobile */}
      {isMobileSidebarOpen && (
        <div 
          id="sidebarOverlay" 
          onClick={() => setIsMobileSidebarOpen(false)} 
          className="fixed inset-0 bg-black/70 z-30 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Barra Lateral com Transição Suave (Expandida: w-64, Recolhida: w-20) */}
      <aside className={`sidebar no-print fixed md:static inset-y-0 left-0 ${
        isCollapsed ? 'w-20 p-2' : 'w-64 p-3'
      } bg-slate-900 border-r border-slate-800 flex flex-col gap-1 overflow-y-auto overflow-x-hidden shrink-0 select-none z-40 transition-all duration-300 ease-in-out ${
        isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
      }`}>
        
        {/* 1. CABEÇALHO DA SIDEBAR COM LOGOTIPO E BOTÃO FÍSICO DE ALTERNÂNCIA (TOGGLE BUTTON) */}
        {!isCollapsed ? (
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-2 px-1">
            {/* Logotipo UsiCorte Metais */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-slate-800/90 border border-slate-700/60 p-1 flex items-center justify-center shrink-0 shadow-md">
                <img 
                  src="/icon-192.png" 
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/icon.svg'; }} 
                  alt="Usi Corte Metais" 
                  className="w-full h-full object-contain rounded-lg" 
                />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="text-xs font-bold tracking-tight flex items-center gap-0.5">
                  <span className="text-white">Usi</span>
                  <span className="text-[#ef4444]">corte</span>
                  <span className="text-white">Metais</span>
                </div>
                <span className="text-[10px] text-slate-400 truncate font-medium">Gestão & Cortes</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              {/* Botão Físico no Cabeçalho (Recolher / Collapse) */}
              <button
                onClick={toggleCollapse}
                className="hidden md:flex items-center justify-center p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 hover:border-slate-500 text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer group"
                title="Recolher barra lateral (Ctrl+B)"
              >
                <PanelLeftClose className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </button>

              {/* Botão Fechar (Mobile) */}
              <button 
                onClick={() => setIsMobileSidebarOpen(false)} 
                className="md:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer"
                title="Fechar menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Cabeçalho Compacto no Modo Recolhido (w-20) com Botão Físico */
          <div className="hidden md:flex flex-col items-center gap-2 pb-3 border-b border-slate-800/80 mb-2">
            <div className="w-11 h-11 rounded-xl bg-slate-800/90 border border-slate-700/60 p-1.5 flex items-center justify-center shadow-md">
              <img 
                src="/icon-192.png" 
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/icon.svg'; }} 
                alt="Usi Corte Metais" 
                className="w-full h-full object-contain rounded-lg" 
              />
            </div>

            {/* Botão Físico no Cabeçalho (Expandir / Open) */}
            <button
              onClick={toggleCollapse}
              onMouseEnter={(e) => handleItemHover(e, 'Expandir Menu (Ctrl+B)')}
              onMouseLeave={handleItemLeave}
              className="w-10 h-8 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 hover:border-slate-500 flex items-center justify-center text-blue-400 hover:text-blue-300 transition-all shadow-sm cursor-pointer group"
              title="Expandir barra lateral (Ctrl+B)"
            >
              <PanelLeftOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}

        {/* 2. MODO OPERADOR (ACESSO RESTRITO) */}
        {!isAdmin ? (
          <div className="flex-1 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              {/* Card de Perfil do Operador */}
              {!isCollapsed ? (
                <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-2xl mb-1 text-left">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-300 mb-1">
                    <Calculator className="w-4 h-4 text-blue-400" />
                    <span>Acesso Restrito: Operador</span>
                  </div>
                  <p className="text-[11px] text-slate-200 font-bold leading-tight truncate">
                    {currentUserProfile?.nome || currentUser || 'Operador'}
                  </p>
                  <p className="text-[10px] text-blue-300/80 mt-0.5">
                    Calculadora de Pesos/Cortes & Orçamentos
                  </p>
                </div>
              ) : (
                <div 
                  className="flex justify-center mb-1 cursor-help"
                  onMouseEnter={(e) => handleItemHover(e, `Operador: ${currentUserProfile?.nome || currentUser || 'Operador'}`)}
                  onMouseLeave={handleItemLeave}
                  title={`Operador: ${currentUserProfile?.nome || currentUser || 'Operador'}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-950/60 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-md">
                    <Calculator className="w-5 h-5" />
                  </div>
                </div>
              )}

              {/* Rótulo de Categoria */}
              {!isCollapsed ? (
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-2 pb-1">
                  Calculadora & Cortes
                </div>
              ) : (
                <div className="w-10 mx-auto my-1 border-t border-slate-800/60" />
              )}

              {/* Calculadora Usicorte */}
              {renderSidebarItem({
                icon: Calculator,
                iconColor: 'text-white',
                label: 'Calculadora Usicorte ⚡',
                subLabel: 'Cálculo Rápido de Cortes & Pesos',
                badge: '⚡ Rápido',
                isActive: currentScreen === 'calculadora',
                activeClassName: 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40 ring-2 ring-blue-400/30',
                inactiveClassName: 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white',
                onClick: () => {
                  trocarTela('calculadora');
                  setIsQuickCalcOpen(true);
                }
              })}

              {!isCollapsed ? (
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-3 pb-1">
                  Vendas & Cotações
                </div>
              ) : (
                <div className="w-10 mx-auto my-1 border-t border-slate-800/60" />
              )}

              {/* Vendas & PDV */}
              {renderSidebarItem({
                icon: ShoppingCart,
                iconColor: 'text-slate-300',
                label: 'Vendas & PDV',
                isActive: currentScreen === 'vendas' || currentScreen === 'orcamento',
                activeClassName: 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40',
                inactiveClassName: 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white',
                onClick: () => trocarTela('vendas')
              })}

              {/* Bloco de Instalação PWA */}
              <PWAInstallButton 
                variant="sidebar" 
                isCollapsed={isCollapsed}
                onHoverCollapsed={(e) => handleItemHover(e, 'Instalar Aplicativo (PWA)')}
                onLeaveCollapsed={handleItemLeave}
                className={isCollapsed ? 'mx-auto my-1' : 'mt-2'} 
              />
            </div>

            {/* Logout Operador */}
            <div className="pt-3 border-t border-slate-800/80 pb-1">
              {!isCollapsed ? (
                <button
                  onClick={onLogout}
                  className="flex items-center justify-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 transition-all cursor-pointer w-full shadow-sm"
                  title="Encerrar Sessão (Sair)"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Encerrar Sessão (Sair)</span>
                </button>
              ) : (
                <button
                  onClick={onLogout}
                  onMouseEnter={(e) => handleItemHover(e, 'Encerrar Sessão (Sair)')}
                  onMouseLeave={handleItemLeave}
                  className="w-12 h-12 mx-auto flex items-center justify-center rounded-xl text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-600 transition-all cursor-pointer"
                  title="Encerrar Sessão (Sair)"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* 3. MODO ADMINISTRADOR: EXATAMENTE AS 4 CATEGORIAS REQUISITADAS */
          <div className="flex-1 flex flex-col gap-0.5">
            {/* Categoria 1: VENDAS & SERVIÇOS */}
            {!isCollapsed ? (
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-1 pb-1">
                VENDAS & SERVIÇOS
              </div>
            ) : (
              <div className="w-10 mx-auto my-1 border-t border-slate-800/60" />
            )}

            {/* Calculadora Usicorte ⚡ (destacada em azul/roxo) */}
            {renderSidebarItem({
              icon: Calculator,
              iconColor: 'text-white',
              label: 'Calculadora Usicorte ⚡',
              isActive: currentScreen === 'calculadora',
              activeClassName: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-extrabold shadow-lg shadow-indigo-600/30 border border-indigo-400/50',
              inactiveClassName: 'bg-gradient-to-r from-blue-600/30 via-indigo-600/25 to-purple-600/20 text-blue-200 hover:text-white hover:from-blue-600 hover:to-indigo-600 border border-indigo-500/40 font-bold shadow-xs',
              onClick: () => {
                trocarTela('calculadora');
                setIsQuickCalcOpen(true);
              }
            })}

            {/* Ordens de Serviço (OS) */}
            {renderSidebarItem({
              icon: ClipboardList,
              iconColor: 'text-red-400',
              label: 'Ordens de Serviço (OS)',
              isActive: currentScreen === 'ordem_servico',
              activeClassName: 'bg-red-600 text-white shadow-md shadow-red-600/30 font-bold',
              onClick: () => trocarTela('ordem_servico')
            })}

            {/* Vendas & PDV */}
            {renderSidebarItem({
              icon: ShoppingCart,
              iconColor: 'text-amber-400',
              label: 'Vendas & PDV',
              isActive: currentScreen === 'vendas',
              activeClassName: 'bg-amber-600 text-white shadow-md shadow-amber-600/30 font-bold',
              onClick: () => trocarTela('vendas')
            })}

            {/* Categoria 2: ESTOQUE & FINANCEIRO */}
            {!isCollapsed ? (
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-3 pb-1">
                ESTOQUE & FINANCEIRO
              </div>
            ) : (
              <div className="w-10 mx-auto my-1 border-t border-slate-800/60" />
            )}

            {/* Fechamento (badge 1) */}
            {renderSidebarItem({
              icon: Receipt,
              iconColor: 'text-purple-400',
              label: 'Fechamento',
              badge: 1,
              badgeColor: 'bg-purple-600 text-white font-extrabold px-1.5',
              isActive: currentScreen === 'fechamento',
              activeClassName: 'bg-purple-600 text-white shadow-md shadow-purple-600/30 font-bold',
              onClick: () => trocarTela('fechamento')
            })}

            {/* Extrato */}
            {renderSidebarItem({
              icon: DollarSign,
              iconColor: 'text-emerald-400',
              label: 'Extrato',
              isActive: currentScreen === 'financeiro',
              activeClassName: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 font-bold',
              onClick: () => trocarTela('financeiro')
            })}

            {/* Histórico (badge Supabase) */}
            {renderSidebarItem({
              icon: Calendar,
              iconColor: 'text-emerald-400',
              label: 'Histórico',
              badge: 'Supabase',
              badgeColor: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] font-bold px-1.5',
              isActive: false,
              onClick: onOpenHistoricoFechamento ? onOpenHistoricoFechamento : () => trocarTela('movimentacoes')
            })}

            {/* Categoria 3: FECHAMENTOS */}
            {!isCollapsed ? (
              <div className="text-[10px] uppercase font-bold tracking-wider text-purple-400 px-3 pt-3 pb-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_6px_#a855f7]"></span>
                <span>FECHAMENTOS</span>
              </div>
            ) : (
              <div className="w-10 mx-auto my-1 border-t border-purple-500/40" />
            )}

            {/* Consolidação Mensal */}
            {renderSidebarItem({
              icon: Layers,
              iconColor: 'text-purple-400',
              label: 'Consolidação Mensal',
              isActive: currentScreen === 'fechamento',
              activeClassName: 'bg-purple-600 text-white shadow-md shadow-purple-600/30 font-bold',
              onClick: () => trocarTela('fechamento')
            })}

            {/* Relatório de Cobrança */}
            {renderSidebarItem({
              icon: FileText,
              iconColor: 'text-purple-400',
              label: 'Relatório de Cobrança',
              isActive: false,
              onClick: () => trocarTela('fechamento')
            })}

            {/* Histórico de Fechamentos */}
            {renderSidebarItem({
              icon: Calendar,
              iconColor: 'text-purple-400',
              label: 'Histórico de Fechamentos',
              isActive: false,
              onClick: onOpenHistoricoFechamento ? onOpenHistoricoFechamento : () => trocarTela('fechamento')
            })}

            {/* Categoria 4: GESTÃO & FISCAL */}
            {!isCollapsed ? (
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-3 pb-1">
                GESTÃO & FISCAL
              </div>
            ) : (
              <div className="w-10 mx-auto my-1 border-t border-slate-800/60" />
            )}

            {/* Orçamentos */}
            {renderSidebarItem({
              icon: FileText,
              iconColor: 'text-slate-300',
              label: 'Orçamentos',
              isActive: currentScreen === 'relatorios' && reportsTab === 'propostas',
              onClick: () => trocarTela('relatorios', 'propostas')
            })}

            {/* Relatórios Gerais */}
            {renderSidebarItem({
              icon: Search,
              iconColor: 'text-slate-300',
              label: 'Relatórios Gerais',
              isActive: currentScreen === 'relatorios' && reportsTab === 'consulta',
              onClick: () => trocarTela('relatorios', 'consulta')
            })}

            {/* Andamento e Boleto */}
            {renderSidebarItem({
              icon: Barcode,
              iconColor: 'text-slate-300',
              label: 'Andamento e Boleto',
              isActive: currentScreen === 'movimentacoes',
              activeClassName: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold',
              onClick: () => trocarTela('movimentacoes')
            })}

            {/* Emitente */}
            {renderSidebarItem({
              icon: Building2,
              iconColor: 'text-slate-300',
              label: 'Emitente',
              isActive: currentScreen === 'empresa',
              onClick: () => trocarTela('empresa')
            })}
          </div>
        )}

        {/* 4. RODAPÉ DA SIDEBAR: CARD VERDE PWA, STATUS "ONLINE" E RODAPÉ DA EMPRESA "USICORTE METAIS EIRELI" */}
        {!isCollapsed ? (
          <div className="mt-auto pt-2 space-y-2">
            {/* Bloco de Instalação PWA: Card verde "Instalar Usicorte no Dispositivo" */}
            <PWAInstallButton 
              variant="sidebar" 
              isCollapsed={false}
              className="mt-2" 
            />

            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-medium text-slate-300">Status:</span>
                <span className="text-emerald-400 font-extrabold flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]"></span>
                  ONLINE
                </span>
              </div>
              <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  USICORTE METAIS EIRELI
                </span>
              </div>
            </div>

            {/* Botão de Alternância Inferior (Desktop) */}
            <button
              onClick={toggleCollapse}
              className="hidden md:flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 border border-slate-800 transition-all cursor-pointer w-full group"
              title="Recolher barra lateral (Ctrl+B)"
            >
              <PanelLeftClose className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Recolher Menu</span>
            </button>
          </div>
        ) : (
          /* Rodapé Compacto no Modo Recolhido (w-20) */
          <div className="mt-auto pt-2 flex flex-col items-center gap-2">
            <PWAInstallButton 
              variant="sidebar" 
              isCollapsed={true}
              onHoverCollapsed={(e) => handleItemHover(e, 'Instalar Aplicativo (PWA)')}
              onLeaveCollapsed={handleItemLeave}
              className="mx-auto my-1" 
            />

            <div 
              className="flex justify-center cursor-help"
              onMouseEnter={(e) => handleItemHover(e, 'Status: ONLINE - USICORTE METAIS EIRELI')}
              onMouseLeave={handleItemLeave}
              title="Status: ONLINE - USICORTE METAIS EIRELI"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50"></span>
              </div>
            </div>

            {/* Botão de Alternância Inferior (Desktop) */}
            <button
              onClick={toggleCollapse}
              onMouseEnter={(e) => handleItemHover(e, 'Expandir Menu (Ctrl+B)')}
              onMouseLeave={handleItemLeave}
              className="hidden md:flex items-center justify-center w-12 h-10 rounded-xl text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 transition-all cursor-pointer group"
              title="Expandir barra lateral (Ctrl+B)"
            >
              <PanelLeftOpen className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        )}
      </aside>

      {/* Tooltip Flutuante Fixo (posicionado fora do container com overflow para nunca ser cortado) */}
      {isCollapsed && hoveredTooltip && (
        <div 
          className="fixed left-[86px] -translate-y-1/2 z-50 pointer-events-none transition-all duration-150 animate-in fade-in zoom-in-95"
          style={{ top: `${hoveredTooltip.y}px` }}
        >
          <div className="bg-slate-900 border border-slate-700/80 text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-2xl flex items-center gap-2 ring-1 ring-white/10 backdrop-blur-md whitespace-nowrap">
            <span className="text-white font-medium">{hoveredTooltip.label}</span>
            {hoveredTooltip.badge && (
              <span className="text-[9px] bg-blue-500/25 text-blue-300 border border-blue-500/40 px-1.5 py-0.5 rounded font-mono font-bold">
                {hoveredTooltip.badge}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
}
