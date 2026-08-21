import React, { useState } from 'react';
import { Quote } from './types';
import { INITIAL_QUOTE } from './data/initialData';
import { useClients } from './hooks/useClients';
import { useClock } from './hooks/useClock';
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
import UsicorteCalculatorModal from './components/UsicorteCalculatorModal';
import { MaterialProfile } from './utils/calculator';
import { Users, FileCode } from 'lucide-react';

export type ScreenType = 'home' | 'clientes' | 'produtos' | 'orcamento' | 'ordem_servico' | 'vendas' | 'relatorios' | 'php';

export default function App() {
  const { clients, activeClient, setActiveClient, handleSaveClient, handleDeleteClient, handleExportClients } = useClients();
  const currentTime = useClock();

  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [selectedMaterialForQuote, setSelectedMaterialForQuote] = useState<MaterialProfile | null>(null);
  const [currentQuote, setCurrentQuote] = useState<Quote>(INITIAL_QUOTE);

  // Autenticação & Modais
  const [currentUser, setCurrentUser] = useState<string | null>(() => sessionStorage.getItem('usuario_logado'));
  const [isLoginOpen, setIsLoginOpen] = useState<boolean>(() => !sessionStorage.getItem('usuario_logado'));
  const [isQuickCalcOpen, setIsQuickCalcOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  const trocarTela = (nomeTela: ScreenType) => {
    setCurrentScreen(nomeTela);
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
    setCurrentScreen('orcamento');
  };

  const handleLaunchProductIntoQuote = (material: MaterialProfile) => {
    setSelectedMaterialForQuote(material);
    setCurrentScreen('orcamento');
  };

  return (
    <div id="app-root" className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden font-sans selection:bg-blue-600 selection:text-white">
      <TopBar 
        currentScreen={currentScreen}
        currentUser={currentUser}
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        trocarTela={trocarTela}
        setIsLoginOpen={setIsLoginOpen}
      />

      <div className="flex flex-1 relative overflow-hidden">
        <Sidebar 
          currentScreen={currentScreen}
          isMobileSidebarOpen={isMobileSidebarOpen}
          clientsCount={clients.length}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
          trocarTela={trocarTela}
          setIsQuickCalcOpen={setIsQuickCalcOpen}
        />

        <main className="flex-1 bg-slate-950 p-6 overflow-y-auto">
          {currentScreen === 'home' && (
            <DashboardView 
              clients={clients}
              currentQuote={currentQuote}
              trocarTela={trocarTela}
              setIsQuickCalcOpen={setIsQuickCalcOpen}
            />
          )}

          {currentScreen === 'clientes' && (
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
                  <ClientForm activeClient={activeClient} onSave={handleSaveClient} onDelete={handleDeleteClient} onClear={() => setActiveClient(null)} />
                </div>
                <div className="lg:col-span-4">
                  <ClientList clients={clients} activeClientId={activeClient?.id} onSelectClient={(c) => setActiveClient(c)} onExportClients={handleExportClients} />
                </div>
              </div>
            </div>
          )}

          {currentScreen === 'produtos' && <ProductsModule onSelectProductForQuote={handleLaunchProductIntoQuote} />}
          
          {(currentScreen === 'orcamento' || currentScreen === 'vendas') && (
            <SalesModule 
              clients={clients} 
              selectedMaterial={currentScreen === 'orcamento' ? selectedMaterialForQuote : null} 
              onQuoteChange={setCurrentQuote} 
              onNavigateToClients={() => trocarTela('clientes')} 
              onNavigateToReports={() => trocarTela('relatorios')} 
            />
          )}

          {currentScreen === 'ordem_servico' && <DailyOSModule clients={clients} onNavigateToClients={() => trocarTela('clientes')} />}
          
          {currentScreen === 'relatorios' && <ReportsModule currentQuote={currentQuote} clients={clients} onNavigateToQuote={() => trocarTela('orcamento')} />}

          {currentScreen === 'php' && (
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

      <FooterBar currentUser={currentUser} currentTime={currentTime} />

      <LoginModule 
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(user) => { setCurrentUser(user); setIsLoginOpen(false); }}
        currentUser={currentUser}
        onLogout={() => { sessionStorage.removeItem('usuario_logado'); setCurrentUser(null); setIsLoginOpen(true); }}
      />

      <UsicorteCalculatorModal
        isOpen={isQuickCalcOpen}
        onClose={() => setIsQuickCalcOpen(false)}
        onAddItemToQuote={handleAddItemFromQuickCalc}
      />
    </div>
  );
}