import React, { useEffect, useState, useMemo } from 'react';
import { 
  Printer, 
  Building2, 
  ClipboardList, 
  Tag, 
  Scissors, 
  CheckCircle2, 
  X,
  FileCheck2,
  FileText,
  Receipt
} from 'lucide-react';
import { TipoImpressaoConsulta } from './ConsultaPrintDocuments';
import { Client, Quote } from '../types';
import EmissaoNfeModal from './EmissaoNfeModal';
import { abrirDanfeEmNovaAba } from '../services/nfeService';

export type TipoImpressaoOrcamento = TipoImpressaoConsulta | 'NFE';

interface QuotePrintOptionsModalProps {
  orcamentoSalvo?: any;
  quoteNumber?: string;
  clientName?: string;
  itemCount?: number;
  totalValue?: number;
  client?: Client | null;
  clients?: Client[];
  onSelectPrint: (tipo: TipoImpressaoOrcamento) => void;
  onClose: () => void;
  onUpdateQuote?: (updatedQuote: Quote) => void;
}

export default function QuotePrintOptionsModal({
  orcamentoSalvo,
  quoteNumber,
  clientName,
  itemCount,
  totalValue,
  client,
  clients,
  onSelectPrint,
  onClose,
  onUpdateQuote
}: QuotePrintOptionsModalProps) {
  const [currentQuote, setCurrentQuote] = useState<any>(orcamentoSalvo);
  const [showEmissaoNfeModal, setShowEmissaoNfeModal] = useState<boolean>(false);

  useEffect(() => {
    if (orcamentoSalvo) {
      setCurrentQuote(orcamentoSalvo);
    }
  }, [orcamentoSalvo]);

  // Fecha com ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const displayQuoteNumber = 
    quoteNumber || 
    currentQuote?.quoteNumber || 
    currentQuote?.id || 
    orcamentoSalvo?.quoteNumber || 
    orcamentoSalvo?.id || 
    'COT';

  const displayClientName = 
    clientName || 
    currentQuote?.clientName || 
    currentQuote?.cliente?.nome || 
    orcamentoSalvo?.clientName || 
    orcamentoSalvo?.cliente?.nome || 
    'Cliente';

  const displayItemCount = 
    itemCount ?? 
    currentQuote?.items?.length ?? 
    currentQuote?.itens?.length ?? 
    orcamentoSalvo?.items?.length ?? 
    orcamentoSalvo?.itens?.length ?? 
    0;

  // Resolução inteligente dos dados fiscais do cliente
  const resolvedClient = useMemo<Client | null>(() => {
    if (client) return client;
    if (currentQuote?.cliente) return currentQuote.cliente;
    if (orcamentoSalvo?.cliente) return orcamentoSalvo.cliente;

    if (clients && clients.length > 0) {
      const targetId = currentQuote?.clientId || currentQuote?.cliente_id || orcamentoSalvo?.clientId || orcamentoSalvo?.cliente_id;
      const targetDoc = currentQuote?.clientDocument || currentQuote?.documento || orcamentoSalvo?.clientDocument;
      const targetName = currentQuote?.clientName || currentQuote?.cliente?.nome || displayClientName;

      const found = clients.find(c => 
        (targetId && (c.id === targetId || String(c.id) === String(targetId))) ||
        (targetDoc && c.document && c.document.replace(/\D/g, '') === String(targetDoc).replace(/\D/g, '')) ||
        (targetName && (c.name || (c as any).nome || '').trim().toLowerCase() === String(targetName).trim().toLowerCase())
      );
      if (found) return found;
    }

    const q = currentQuote || orcamentoSalvo;
    if (!q) return null;

    return {
      id: q.clientId || 'client-temp',
      name: displayClientName,
      document: q.clientDocument || '',
      inscricao_estadual: q.inscricao_estadual || q.ie || 'ISENTO',
      indicador_ie: q.indicador_ie || '9',
      city: q.clientCity || 'BAURU',
      state: q.clientState || 'SP',
      phone: q.clientPhone || '',
      email: q.clientEmail || '',
      street: q.clientStreet || 'Endereço Comercial'
    } as Client;
  }, [client, clients, currentQuote, orcamentoSalvo, displayClientName]);

  // Controle de status da NF-e
  const statusNfe = (
    currentQuote?.status_nfe || 
    currentQuote?.statusNfe || 
    orcamentoSalvo?.status_nfe || 
    orcamentoSalvo?.statusNfe || 
    ''
  ).trim();

  const isNfeEmitida = statusNfe.toLowerCase() === 'emitida';

  // Descrição Dinâmica baseada em status_nfe
  const nfeDescricao = isNfeEmitida
    ? 'Imprimir / Baixar DANFE (PDF da Nota Fiscal Emitida)'
    : 'Emitir Nota Fiscal Eletrônica (SEFAZ) para este pedido';

  const opcoes: Array<{
    tipo: TipoImpressaoOrcamento;
    titulo: string;
    subtitulo: string;
    descricao: string;
    icone: React.ReactNode;
    cardClasses: string;
    iconBgClasses: string;
  }> = [
    {
      tipo: 'GERAL',
      titulo: 'GERAL',
      subtitulo: 'A4 Padrão',
      descricao: 'Impressão / PDF completa da proposta comercial padrão',
      icone: <Printer className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />,
      cardClasses: 'hover:border-blue-500 hover:bg-blue-950/40 border-slate-700 bg-slate-900/90 text-blue-300',
      iconBgClasses: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    },
    {
      tipo: 'EMPRESA',
      titulo: 'EMPRESA',
      subtitulo: 'Via Interna',
      descricao: 'Impressão da via interna e resumida de controle da empresa',
      icone: <Building2 className="w-6 h-6 text-slate-300 group-hover:scale-110 transition-transform" />,
      cardClasses: 'hover:border-slate-400 hover:bg-slate-800/60 border-slate-700 bg-slate-900/90 text-slate-200',
      iconBgClasses: 'bg-slate-500/10 border-slate-500/30 text-slate-300',
    },
    {
      tipo: 'PEDIDO',
      titulo: 'PEDIDO',
      subtitulo: '2 Vias A4',
      descricao: 'Comprovante e resumo oficial em formato de pedido de venda',
      icone: <ClipboardList className="w-6 h-6 text-amber-400 group-hover:scale-110 transition-transform" />,
      cardClasses: 'hover:border-amber-500 hover:bg-amber-950/40 border-slate-700 bg-slate-900/90 text-amber-300',
      iconBgClasses: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    },
    {
      tipo: 'ETIQUETAS',
      titulo: 'ETIQUETAS',
      subtitulo: '80x80mm',
      descricao: 'Etiquetas técnicas de identificação de material e peças',
      icone: <Tag className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />,
      cardClasses: 'hover:border-emerald-500 hover:bg-emerald-950/40 border-slate-700 bg-slate-900/90 text-emerald-300',
      iconBgClasses: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    },
    {
      tipo: 'CORTE',
      titulo: 'CORTE',
      subtitulo: 'Ordem CNC',
      descricao: 'Ordem de Produção e Ficha Técnica de Corte CNC',
      icone: <Scissors className="w-6 h-6 text-rose-400 group-hover:scale-110 transition-transform" />,
      cardClasses: 'hover:border-rose-500 hover:bg-rose-950/40 border-slate-700 bg-slate-900/90 text-rose-300',
      iconBgClasses: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    },
    {
      tipo: 'CORTE_80MM',
      titulo: 'CUPOM 80MM',
      subtitulo: 'CORTE TÉRMICO',
      descricao: 'Ordem de corte em cupom térmico para bobina de 80mm',
      icone: <Printer className="w-6 h-6 text-orange-400 group-hover:scale-110 transition-transform" />,
      cardClasses: 'hover:border-orange-500 hover:bg-orange-950/40 border-slate-700 bg-slate-900/90 text-orange-300',
      iconBgClasses: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
    },
    {
      tipo: 'NFE',
      titulo: 'NOTA FISCAL',
      subtitulo: isNfeEmitida ? 'DANFE EMITIDA' : 'NF-E / DANFE',
      descricao: nfeDescricao,
      icone: isNfeEmitida ? (
        <FileText className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform" />
      ) : (
        <Receipt className="w-6 h-6 text-purple-400 group-hover:scale-110 transition-transform" />
      ),
      cardClasses: isNfeEmitida
        ? 'hover:border-emerald-500 hover:bg-emerald-950/40 border-emerald-700/60 bg-emerald-950/20 text-emerald-300 shadow-emerald-950/30'
        : 'hover:border-purple-500 hover:bg-purple-950/40 border-purple-800/60 bg-purple-950/20 text-purple-300 shadow-purple-950/30',
      iconBgClasses: isNfeEmitida
        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
        : 'bg-purple-500/15 border-purple-500/30 text-purple-400',
    },
  ];

  const handleAction = async (tipo: TipoImpressaoOrcamento) => {
    if (tipo === 'NFE') {
      const targetQuote = currentQuote || orcamentoSalvo;
      if (isNfeEmitida) {
        // Caso A NOTA JÁ FOI EMITIDA (status_nfe == 'Emitida'):
        // Abre diretamente o PDF da DANFE (danfe_url) em uma nova aba para impressão rápida.
        await abrirDanfeEmNovaAba(targetQuote, resolvedClient);
      } else {
        // Caso A NOTA AINDA NÃO FOI EMITIDA (status_nfe != 'Emitida'):
        // Abre o Modal/Tela de Conferência e Transmissão Fiscal para a SEFAZ.
        setShowEmissaoNfeModal(true);
      }
      return;
    }

    onSelectPrint(tipo);
  };

  const handleNfeSuccess = (updatedQuote: Quote) => {
    setCurrentQuote(updatedQuote);
    if (onUpdateQuote) {
      onUpdateQuote(updatedQuote);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
        <div 
          className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Cabeçalho do Modal */}
          <div className="p-5 sm:p-6 border-b border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-850 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    GRAVADO COM SUCESSO
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400">
                    Cotação #{displayQuoteNumber}
                  </span>
                  {isNfeEmitida && (
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <FileText className="w-3 h-3" /> NF-e Emitida
                    </span>
                  )}
                </div>
                <h2 id="modal-title" className="text-lg sm:text-xl font-black text-slate-100 tracking-tight mt-0.5">
                  Opções de Impressão do Orçamento
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {displayClientName ? (
                    <>Cliente: <strong className="text-slate-200">{displayClientName}</strong> ({displayItemCount} {displayItemCount === 1 ? 'item' : 'itens'}) • </>
                  ) : null}
                  Selecione o modelo desejado para emitir a impressão/PDF correspondente:
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Fechar opções"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Grade Horizontal com os 7 botões de ação com ícones visíveis */}
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {opcoes.map((opcao) => (
                <button
                  key={opcao.tipo}
                  type="button"
                  onClick={() => handleAction(opcao.tipo)}
                  className={`group flex flex-col items-center text-center p-3.5 sm:p-4 rounded-xl border transition-all duration-150 cursor-pointer shadow-md hover:shadow-xl hover:-translate-y-0.5 ${opcao.cardClasses}`}
                >
                  {/* Ícone Visível */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 border ${opcao.iconBgClasses}`}>
                    {opcao.icone}
                  </div>

                  {/* Título Principal */}
                  <span className="text-sm font-black tracking-wide text-white group-hover:text-white">
                    {opcao.titulo}
                  </span>

                  {/* Badge/Subtítulo */}
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/60 mt-1 mb-2">
                    {opcao.subtitulo}
                  </span>

                  {/* Descrição resumida */}
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {opcao.descricao}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Rodapé com botão secundário de fechamento */}
          <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Os dados e itens já foram gravados com segurança no banco de dados.</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Apenas Fechar (Orçamento já Salvo)
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DE CONFERÊNCIA E TRANSMISSÃO FISCAL SEFAZ */}
      {showEmissaoNfeModal && (
        <EmissaoNfeModal
          quote={currentQuote || orcamentoSalvo}
          client={resolvedClient}
          onSuccess={handleNfeSuccess}
          onClose={() => setShowEmissaoNfeModal(false)}
        />
      )}
    </>
  );
}

