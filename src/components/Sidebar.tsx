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
          /* 3. MODO ADMINISTRADOR: MENU COMPLETO */
          <div className="flex-1 flex flex-col gap-0.5">
            {/* Categoria 1: Navegação Principal */}
            {!isCollapsed ? (
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-1 pb-1">
                Navegação Principal
              </div>
            ) : (
              <div className="w-10 mx-auto my-1 border-t border-slate-800/60" />
            )}

            {renderSidebarItem({
              icon: Home,
              label: 'Início / Dashboard',
              isActive: currentScreen === 'home',
              onClick: () => trocarTela('home')
            })}

            {renderSidebarItem({
              icon: Users,
              label: 'Cadastro de Clientes',
              badge: clientsCount,
              isActive: currentScreen === 'clientes',
              onClick: () => trocarTela('clientes')
            })}

            {renderSidebarItem({
              icon: Package,
              label: 'Cadastro de Produtos',
              badge: totalMateriaisCount,
              isActive: currentScreen === 'produtos',
              onClick: () => trocarTela('produtos')
            })}

            {/* Categoria 2: Vendas & Serviços */}
            {!isCollapsed ? (
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-3 pb-1">
                Vendas & Serviços
              </div>
            ) : (
              <div className="w-10 mx-auto my-1 border-t border-slate-800/60" />
            )}

            {renderSidebarItem({
              icon: Calculator,
              iconColor: 'text-blue-300',
              label: 'Calculadora Usicorte ⚡',
              badge: '⚡ Rápido',
              isActive: currentScreen === 'calculadora',
              activeClassName: 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400/40',
              inactiveClassName: 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/20 border border-blue-400/30',
              onClick: () => {
                trocarTela('calculadora');
                setIsQuickCalcOpen(true);
              }
            })}

            {renderSidebarItem({
              icon: ClipboardList,
              iconColor: 'text-red-400',
              label: 'OS Diária (Expediente)',
              isActive: currentScreen === 'ordem_servico',
              activeClassName: 'bg-red-600 text-white shadow-md shadow-red-600/30 font-bold',
              onClick: () => trocarTela('ordem_servico')
            })}

            {renderSidebarItem({
              icon: ShoppingCart,
              label: 'Vendas & PDV',
              badge: 'PDV',
              isActive: currentScreen === 'vendas',
              onClick: () => trocarTela('vendas')
            })}

            {/* Categoria 3: Estoque & Financeiro */}
            {!isCollapsed ? (
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-3 pb-1">
                Estoque & Financeiro
              </div>
            ) : (
              <div className="w-10 mx-auto my-1 border-t border-slate-800/60" />
            )}

            {renderSidebarItem({
              icon: Boxes,
              iconColor: 'text-blue-400',
              label: 'Estoque & Retalhos',
              badge: getMateriaisEstoque().length,
              badgeColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
              isActive: currentScreen === 'estoque',
              onClick: () => trocarTela('estoque')
            })}

            {renderSidebarItem({
              icon: DollarSign,
              iconColor: 'text-emerald-400',
              label: 'Caixa & Financeiro',
              isActive: currentScreen === 'financeiro',
              activeClassName: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30',
              onClick: () => trocarTela('financeiro')
            })}

            {onOpenHistoricoFechamento && renderSidebarItem({
              icon: Calendar,
              iconColor: 'text-purple-400',
              label: 'Histórico de Fechamentos',
              badge: 'Supabase',
              badgeColor: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
              isActive: false,
              inactiveClassName: 'bg-purple-950/40 hover:bg-purple-900/60 text-purple-200 border border-purple-500/30 hover:border-purple-400 shadow-sm',
              onClick: onOpenHistoricoFechamento
            })}

            {/* Categoria 4: Gestão & Fiscal */}
            {!isCollapsed ? (
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 px-3 pt-3 pb-1">
                Gestão & Fiscal
              </div>
            ) : (
              <div className="w-10 mx-auto my-1 border-t border-slate-800/60" />
            )}

            {renderSidebarItem({
              icon: FileText,
              iconColor: 'text-blue-400',
              label: 'Emissão de Propostas & Etiquetas',
              isActive: currentScreen === 'relatorios' && reportsTab === 'propostas',
              onClick: () => trocarTela('relatorios', 'propostas')
            })}

            {renderSidebarItem({
              icon: Search,
              iconColor: 'text-emerald-400',
              label: 'Consulta & Relatório Geral',
              isActive: currentScreen === 'relatorios' && reportsTab === 'consulta',
              onClick: () => trocarTela('relatorios', 'consulta')
            })}

            {renderSidebarItem({
              icon: Barcode,
              iconColor: 'text-indigo-400',
              label: 'Andamento das Movimentações',
              badge: 'Boletos',
              badgeColor: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30',
              isActive: currentScreen === 'movimentacoes',
              activeClassName: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold',
              onClick: () => trocarTela('movimentacoes')
            })}

            {renderSidebarItem({
              icon: Building2,
              iconColor: 'text-blue-400',
              label: 'Dados da Empresa / Emitente',
              badge: 'NF-e',
              badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
              isActive: currentScreen === 'empresa',
              onClick: () => trocarTela('empresa')
            })}

            {renderSidebarItem({
              icon: FileCode,
              iconColor: 'text-emerald-400',
              label: 'Código PHP / MySQL',
              isActive: currentScreen === 'php',
              activeClassName: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30',
              onClick: () => trocarTela('php')
            })}

            {/* Bloco de Instalação PWA */}
            <PWAInstallButton 
              variant="sidebar" 
              isCollapsed={isCollapsed}
              onHoverCollapsed={(e) => handleItemHover(e, 'Instalar Aplicativo (PWA)')}
              onLeaveCollapsed={handleItemLeave}
              className={isCollapsed ? 'mx-auto my-1.5' : 'mt-2'} 
            />
          </div>
        )}

        {/* 4. RODAPÉ DA SIDEBAR: STATUS E BOTÃO DE ALTERNÂNCIA INFERIOR */}
        {!isCollapsed ? (
          <div className="mt-auto pt-2 space-y-2">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] space-y-1">
              <div className="flex items-center justify-between text-slate-400">
                <span>Status Sistema:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  ONLINE
                </span>
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {isAdmin ? 'Acesso Total (Admin)' : 'Acesso Restrito (Operador)'}
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
            <div 
              className="flex justify-center cursor-help"
              onMouseEnter={(e) => handleItemHover(e, 'Sistema Online - ' + (isAdmin ? 'Admin' : 'Operador'))}
              onMouseLeave={handleItemLeave}
              title={`Sistema Online - ${isAdmin ? 'Acesso Total (Admin)' : 'Acesso Restrito (Operador)'}`}
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
