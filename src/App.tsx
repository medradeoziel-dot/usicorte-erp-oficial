import React, { useState, useEffect, useMemo } from 'react';
import { Quote } from './types';
import { INITIAL_QUOTE } from './data/initialData';
import { useClients } from './hooks/useClients';
import { useClock } from './hooks/useClock';
import { executarMigracaoEmergenciaOrcamentos } from './services/emergencyMigrationService';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import FooterBar from './components/FooterBar';
import DashboardView from './components/DashboardView';

import ClientForm from './components/ClientForm';
import ClientList from './components/ClientList';
import SalesModule from './components/SalesModule';
import ProductsModule from './components/ProductsModule';
import ReportsModule from './components/ReportsModule';
import PhpCodeViewer from './components/PhpCodeViewer';
import LoginModule from './components/LoginModule';
import DailyOSModule from './components/DailyOSModule';
import InventoryFinanceModule from './components/InventoryFinanceModule';
import CompanySettingsModule from './components/CompanySettingsModule';
import FechamentoCotacoesModule from './components/FechamentoCotacoesModule';
import AndamentoMovimentacoesModule from './components/AndamentoMovimentacoesModule';
import FechamentoMensalModal from './components/FechamentoMensalModal';
import UsicorteCalculatorModal from './components/UsicorteCalculatorModal';
import CalculadoraView from './components/CalculadoraView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { MaterialProfile } from './utils/calculator';
import { UserProfile } from './lib/db';
import { Users, FileCode, CheckCircle2, AlertTriangle, X } from 'lucide-react';

export type ScreenType = 'home' | 'clientes' | 'produtos' | 'orcamento' | 'ordem_servico' | 'vendas' | 'calculadora' | 'relatorios' | 'estoque' | 'financeiro' | 'fechamento' | 'movimentacoes' | 'empresa' | 'php';

export default function App() {
  const { 
    clients, 
    activeClient, 
    setActiveClient, 
    handleSaveClient, 
    handleDeleteClient, 
    handleExportClients,
    refreshClients,
    isLoading,
    isSaving,
    isDbSynced 
  } = useClients();
  const currentTime = useClock();

  const [currentScreen, setCurrentScreen] = useState<ScreenType>(() => {
    try {
      const user = sessionStorage.getItem('usuario_logado') || '';
      const savedPerfil = sessionStorage.getItem('usuario_perfil');
      const perfil = savedPerfil ? JSON.parse(savedPerfil) : null;
      const nivel = (perfil?.nivel_acesso || perfil?.role || '').toLowerCase();
      const userUpper = user.toUpperCase();
      const isUserAdmin = nivel === 'admin' || nivel === 'administrador' || userUpper === 'ADMIN' || userUpper === 'ADMINISTRADOR';
      if (user && !isUserAdmin) {
        return 'calculadora';
      }
    } catch {
      // ignore
    }
    return 'home';
  });
  const [reportsTab, setReportsTab] = useState<'propostas' | 'consulta'>('propostas');
  const [selectedMaterialForQuote, setSelectedMaterialForQuote] = useState<MaterialProfile | null>(null);
  const [currentQuote, setCurrentQuote] = useState<Quote>(INITIAL_QUOTE);
  const [quoteToEdit, setQuoteToEdit] = useState<Quote | null>(null);
  const [quoteToDuplicate, setQuoteToDuplicate] = useState<{ quote: Quote; originalNumber: string } | null>(null);

  // Autenticação & Modais
  const [currentUser, setCurrentUser] = useState<string | null>(() => sessionStorage.getItem('usuario_logado'));
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(() => {
    try {
      const saved = sessionStorage.getItem('usuario_perfil');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(() => !sessionStorage.getItem('usuario_logado'));
  const [isQuickCalcOpen, setIsQuickCalcOpen] = useState<boolean>(() => {
    try {
      const user = sessionStorage.getItem('usuario_logado') || '';
      const savedPerfil = sessionStorage.getItem('usuario_perfil');
      const perfil = savedPerfil ? JSON.parse(savedPerfil) : null;
      const nivel = (perfil?.nivel_acesso || perfil?.role || '').toLowerCase();
      const userUpper = user.toUpperCase();
      const isUserAdmin = nivel === 'admin' || nivel === 'administrador' || userUpper === 'ADMIN' || userUpper === 'ADMINISTRADOR';
      if (user && !isUserAdmin) {
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isFechamentoModalOpen, setIsFechamentoModalOpen] = useState<boolean>(false);
  const [isAutoOpenDia1, setIsAutoOpenDia1] = useState<boolean>(false);
  const [migrationAlert, setMigrationAlert] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // RBAC: Identificação do nível de acesso do usuário logado
  const isAdmin = useMemo(() => {
    if (!currentUser) return true; // Modo flexível se não houver usuário logado
    if (currentUserProfile) {
      const nivel = (currentUserProfile.nivel_acesso || currentUserProfile.role || '').toLowerCase();
      if (nivel === 'operador' || nivel === 'calculadora') return false;
      if (nivel === 'admin' || nivel === 'administrador') return true;
    }
    const userUpper = currentUser.toUpperCase();
    if (userUpper === 'ADMIN' || userUpper === 'ADMINISTRADOR') return true;
    if (userUpper.includes('VENDAS') || userUpper.includes('PRODUÇÃO') || userUpper.includes('OPERADOR')) return false;
    return true;
  }, [currentUser, currentUserProfile]);

  // 3. Proteção de Rotas e Redirecionamento Automático:
  // Caso um usuário restrito tente acessar diretamente uma tela/módulo bloqueado (ex: Estoque), redirecione-o automaticamente para a 'calculadora' ou 'vendas'.
  useEffect(() => {
    if (currentUser && !isAdmin && currentScreen !== 'calculadora' && currentScreen !== 'vendas' && currentScreen !== 'orcamento') {
      console.warn(`[RBAC Guard] Usuário '${currentUser}' com perfil restrito tentou acessar '${currentScreen}'. Redirecionando para Calculadora.`);
      setCurrentScreen('calculadora');
      setIsQuickCalcOpen(true);
    }
  }, [currentUser, isAdmin, currentScreen]);

  const abrirHistoricoFechamento = (autoDia1 = false) => {
    if (!isAdmin) return; // Apenas admin pode abrir fechamento mensal
    setIsAutoOpenDia1(autoDia1);
    setIsFechamentoModalOpen(true);
  };

  const handleLoginSuccess = (user: string, profile?: UserProfile) => {
    setCurrentUser(user);
    if (profile) {
      setCurrentUserProfile(profile);
      try {
        sessionStorage.setItem('usuario_perfil', JSON.stringify(profile));
      } catch (e) {
        console.warn('Erro ao salvar usuario_perfil no sessionStorage:', e);
      }
    }
    setIsLoginOpen(false);

    const nivel = (profile?.nivel_acesso || profile?.role || '').toLowerCase();
    const isUserAdmin = nivel === 'admin' || nivel === 'administrador' || user.toUpperCase() === 'ADMIN' || user.toUpperCase() === 'ADMINISTRADOR';

    if (!isUserAdmin) {
      // 1. Operador: direcione o usuário AUTOMATICAMENTE e OBRIGATORIAMENTE para a "Calculadora Usicorte ⚡"
      // Definindo o estado inicial estritamente para a Calculadora
      // NÃO abra a tela de "Vendas & Orçamentos" por padrão
      // Abre o módulo/modal de cálculo imediatamente com foco visual
      setCurrentScreen('calculadora');
      setIsQuickCalcOpen(true);
    } else {
      // 1. Administrador (ADMIN): MANTENHA EXATAMENTE COMO ESTÁ ATUALMENTE:
      // abre na tela inicial/dashboard padrão atual com acesso total a todos os módulos e menus.
      setCurrentScreen('home');
      setIsQuickCalcOpen(false);

      // Disparo Automático em Todos os Logins do Dia de Fechamento (Admin):
      const hoje = new Date();
      const isDia1 = hoje.getDate() === 1 || sessionStorage.getItem('simular_login_dia_1') === 'true';
      if (isDia1) {
        sessionStorage.removeItem('simular_login_dia_1');
        abrirHistoricoFechamento(true);
      }
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('usuario_logado');
    sessionStorage.removeItem('usuario_perfil');
    setCurrentUser(null);
    setCurrentUserProfile(null);
    setIsLoginOpen(true);
    setIsQuickCalcOpen(false);
    setCurrentScreen('home'); // Retorna ao Início/Dashboard padrão para o próximo login
  };

  // 1. Leitura do LocalStorage ao carregar o sistema:
  // 2. Envio para o Supabase (INSERT/UPSERT) dos orçamentos locais
  // 3. Limpeza Segura: Somente após confirmar sucesso no Supabase, limpa 's_orcamentos'
  useEffect(() => {
    let isMounted = true;
    async function rodarMigracaoEmergencia() {
      try {
        const resultado = await executarMigracaoEmergenciaOrcamentos();
        if (!isMounted) return;

        if (resultado.migratedCount > 0) {
          setMigrationAlert({
            type: 'success',
            message: `⚡ Sincronização de Emergência: ${resultado.migratedCount} orçamento(s) local(is) gravado(s) com sucesso no Supabase! Limite de armazenamento local liberado com segurança.`
          });
          setTimeout(() => {
            if (isMounted) setMigrationAlert(null);
          }, 8000);
        } else if (resultado.failedCount > 0) {
          setMigrationAlert({
            type: 'warning',
            message: `⚠️ Atenção: ${resultado.failedCount} orçamento(s) não puderam ser gravados no Supabase devido a conexão e foram preservados no dispositivo para não haver perda de dados.`
          });
          setTimeout(() => {
            if (isMounted) setMigrationAlert(null);
          }, 10000);
        }
      } catch (err) {
        console.warn('Erro ao verificar/migrar orçamentos locais na inicialização:', err);
      }
    }

    rodarMigracaoEmergencia();

    return () => {
      isMounted = false;
    };
  }, []);

  const trocarTela = (nomeTela: ScreenType, tab?: 'propostas' | 'consulta') => {
    // Se o usuário for operador, proíbe navegação para módulos restritos e direciona para a Calculadora
    if (currentUser && !isAdmin && nomeTela !== 'calculadora' && nomeTela !== 'vendas' && nomeTela !== 'orcamento') {
      setCurrentScreen('calculadora');
      setIsQuickCalcOpen(true);
      setIsMobileSidebarOpen(false);
      return;
    }
    setCurrentScreen(nomeTela);
    if (nomeTela === 'calculadora') {
      setIsQuickCalcOpen(true);
    }
    if (tab) {
      setReportsTab(tab);
    }
    setIsMobileSidebarOpen(false);
  };

  const handleEditQuote = (quote: Quote) => {
    setQuoteToDuplicate(null);
    setQuoteToEdit(quote);
    setCurrentQuote(quote);
    setCurrentScreen('vendas');
    setIsMobileSidebarOpen(false);
  };

  const handleDuplicateQuote = (quote: Quote, originalNumber: string) => {
    setQuoteToEdit(null); // Desativa modo edição para não atualizar cotação original
    setQuoteToDuplicate({ quote, originalNumber });
    setCurrentQuote(quote);
    setCurrentScreen('vendas');
    setIsMobileSidebarOpen(false);
  };

  const handleAddItemFromQuickCalc = (item: any) => {
    const updatedItems = [...currentQuote.items, item];
    const subtotalTotal = Number(updatedItems.reduce((acc, i) => acc + (i.subtotal || 0), 0).toFixed(2));
    const grandTotal = Number((subtotalTotal - (currentQuote.discount || 0) + (currentQuote.shipping || 0)).toFixed(2));
    const totalWeightKg = Number(updatedItems.reduce((acc, i) => acc + (i.totalWeightKg || 0), 0).toFixed(3));

    setCurrentQuote({
      ...currentQuote,
      items: updatedItems,
      subtotalTotal,
      grandTotal,
      totalWeightKg
    });
    setCurrentScreen('vendas');
  };

  const handleLaunchProductIntoQuote = (material: MaterialProfile) => {
    setSelectedMaterialForQuote(material);
    setCurrentScreen('vendas');
  };

  return (
    <div id="app-root" className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      <TopBar 
        currentScreen={currentScreen}
        currentUser={currentUser}
        currentUserProfile={currentUserProfile}
        isAdmin={isAdmin}
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        trocarTela={trocarTela}
        setIsLoginOpen={setIsLoginOpen}
        onOpenHistoricoFechamento={() => abrirHistoricoFechamento(false)}
        setIsQuickCalcOpen={setIsQuickCalcOpen}
        onLogout={handleLogout}
      />

      {migrationAlert && (
        <div 
          id="migration-alert-banner"
          className={`px-4 py-2.5 flex items-center justify-between text-xs font-medium z-30 transition-all shrink-0 ${
            migrationAlert.type === 'success'
              ? 'bg-emerald-950/90 border-b border-emerald-600/40 text-emerald-200'
              : 'bg-amber-950/90 border-b border-amber-600/40 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {migrationAlert.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{migrationAlert.message}</span>
          </div>
          <button
            onClick={() => setMigrationAlert(null)}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors cursor-pointer"
            title="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-1 relative overflow-hidden">
        <Sidebar 
          currentScreen={currentScreen}
          reportsTab={reportsTab}
          isMobileSidebarOpen={isMobileSidebarOpen}
          clientsCount={clients.length}
          isAdmin={isAdmin}
          currentUser={currentUser}
          currentUserProfile={currentUserProfile}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
          trocarTela={trocarTela}
          setIsQuickCalcOpen={setIsQuickCalcOpen}
          onOpenHistoricoFechamento={() => abrirHistoricoFechamento(false)}
          onLogout={handleLogout}
        />

        <main className="flex-1 bg-slate-950 p-6 overflow-y-auto">
          {isAdmin && currentScreen === 'home' && (
            <DashboardView 
              clients={clients}
              currentQuote={currentQuote}
              trocarTela={trocarTela}
              setIsQuickCalcOpen={setIsQuickCalcOpen}
            />
          )}

          {isAdmin && currentScreen === 'clientes' && (
            <div id="screen-clientes" className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-400" />
                    Cadastro de Clientes
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">
                    Gestão de clientes Pessoa Física (CPF) e Jurídica (CNPJ) com auto-preenchimento ViaCEP e Receita Federal.
                  </p>
                </div>
                <button onClick={handleExportClients} className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all cursor-pointer">
                  Exportar JSON ({clients.length})
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-8">
                  <ClientForm 
                    activeClient={activeClient} 
                    onSave={handleSaveClient} 
                    onDelete={handleDeleteClient} 
                    onClear={() => setActiveClient(null)} 
                    isSaving={isSaving}
                  />
                </div>
                <div className="lg:col-span-4">
                  <ClientList 
                    clients={clients} 
                    activeClientId={activeClient?.id} 
                    onSelectClient={(c) => setActiveClient(c)} 
                    onExportClients={handleExportClients} 
                    onRefresh={refreshClients}
                    isLoading={isLoading}
                    isDbSynced={isDbSynced}
                  />
                </div>
              </div>
            </div>
          )}

          {isAdmin && currentScreen === 'produtos' && <ProductsModule onSelectProductForQuote={handleLaunchProductIntoQuote} />}
          
          {currentScreen === 'calculadora' && (
            <CalculadoraView 
              onOpenCalculatorModal={() => setIsQuickCalcOpen(true)}
              onNavigateToSales={() => trocarTela('vendas')}
              isQuickCalcOpen={isQuickCalcOpen}
            />
          )}

          {(currentScreen === 'orcamento' || currentScreen === 'vendas') && (
            <SalesModule 
              clients={clients} 
              selectedMaterial={selectedMaterialForQuote} 
              onQuoteChange={setCurrentQuote} 
              onNavigateToClients={isAdmin ? () => trocarTela('clientes') : undefined} 
              onNavigateToReports={isAdmin ? () => trocarTela('relatorios') : undefined} 
              quoteToEdit={quoteToEdit}
              onClearQuoteToEdit={() => setQuoteToEdit(null)}
              quoteToDuplicate={quoteToDuplicate}
              onClearQuoteToDuplicate={() => setQuoteToDuplicate(null)}
            />
          )}

          {isAdmin && currentScreen === 'ordem_servico' && <DailyOSModule clients={clients} onNavigateToClients={() => trocarTela('clientes')} />}
          
          {isAdmin && currentScreen === 'relatorios' && (
            <ReportsModule 
              currentQuote={currentQuote} 
              clients={clients} 
              onNavigateToQuote={() => trocarTela('vendas')} 
              onEditQuote={handleEditQuote}
              onDuplicateQuote={handleDuplicateQuote}
              initialTab={reportsTab}
              onTabChange={setReportsTab}
              onNavigateToMovimentacoes={() => trocarTela('movimentacoes')}
              onOpenHistoricoFechamento={() => abrirHistoricoFechamento(false)}
            />
          )}

          {isAdmin && currentScreen === 'movimentacoes' && (
            <AndamentoMovimentacoesModule 
              clients={clients}
              onNavigateToReports={(tab) => trocarTela('relatorios', tab)}
              onNavigateToQuote={() => trocarTela('vendas')}
            />
          )}

          {isAdmin && currentScreen === 'estoque' && (
            <InventoryFinanceModule 
              initialTab="estoque" 
              onNavigateToQuote={() => trocarTela('vendas')} 
              onNavigateToFechamento={() => trocarTela('fechamento')}
              onOpenHistoricoFechamento={() => abrirHistoricoFechamento(false)}
            />
          )}

          {isAdmin && currentScreen === 'financeiro' && (
            <InventoryFinanceModule 
              initialTab="financeiro" 
              onNavigateToQuote={() => trocarTela('vendas')} 
              onNavigateToFechamento={() => trocarTela('fechamento')}
              onOpenHistoricoFechamento={() => abrirHistoricoFechamento(false)}
            />
          )}

          {isAdmin && currentScreen === 'fechamento' && (
            <FechamentoCotacoesModule 
              clients={clients}
              onNavigateToFinanceiro={() => trocarTela('financeiro')}
              onNavigateToQuote={() => trocarTela('vendas')}
              onOpenHistoricoFechamento={() => abrirHistoricoFechamento(false)}
            />
          )}

          {isAdmin && currentScreen === 'empresa' && (
            <CompanySettingsModule 
              onBackToDashboard={() => trocarTela('home')} 
            />
          )}

          {isAdmin && currentScreen === 'php' && (
            <div id="screen-php" className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                    <FileCode className="w-5 h-5 text-emerald-400" />
                    Código PHP / MySQL & Backend
                  </h1>
                  <p className="text-xs text-slate-400 mt-1">Scripts PHP prontos para produção e schema SQL compatíveis com XAMPP, WampServer e servidores Apache/Nginx.</p>
                </div>
              </div>
              <PhpCodeViewer />
            </div>
          )}
        </main>
      </div>

      <FooterBar 
        currentUser={currentUser} 
        currentUserProfile={currentUserProfile} 
        isAdmin={isAdmin} 
        currentTime={currentTime} 
      />

      <LoginModule 
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        currentUser={currentUser}
        currentUserProfile={currentUserProfile}
        isAdmin={isAdmin}
        onLogout={handleLogout}
      />

      <FechamentoMensalModal
        isOpen={isFechamentoModalOpen}
        onClose={() => setIsFechamentoModalOpen(false)}
        currentUser={currentUser}
        isAutoOpenDia1={isAutoOpenDia1}
      />

      <UsicorteCalculatorModal
        isOpen={isQuickCalcOpen}
        onClose={() => setIsQuickCalcOpen(false)}
        onAddItemToQuote={handleAddItemFromQuickCalc}
      />

      <OfflineIndicator />
    </div>
  );
}