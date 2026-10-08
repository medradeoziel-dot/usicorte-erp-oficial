import React, { useEffect, useState } from 'react';
import { Quote, Client } from '../types';
import { CompanyFiscalData, DEFAULT_COMPANY_DATA, getLocalCompanyData } from '../services/companyService';
import DanfeEspelhoA4 from './DanfeEspelhoA4';
import { abrirDanfeEmNovaAba, abrirPreDanfeEmNovaAba } from '../services/nfeService';
import { X, Printer, ExternalLink, Send, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';

interface DanfeEspelhoA4ModalProps {
  isOpen: boolean;
  onClose: () => void;
  quote: Quote;
  client?: Client | null;
  company?: CompanyFiscalData;
  isPrevia?: boolean;
  onTransmit?: () => void;
  isTransmitting?: boolean;
}

export default function DanfeEspelhoA4Modal({
  isOpen,
  onClose,
  quote,
  client,
  company: initialCompany,
  isPrevia: isPreviaProp,
  onTransmit,
  isTransmitting = false
}: DanfeEspelhoA4ModalProps) {
  const [company, setCompany] = useState<CompanyFiscalData>(initialCompany || getLocalCompanyData());
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [isOpeningTab, setIsOpeningTab] = useState<boolean>(false);

  useEffect(() => {
    if (initialCompany) {
      setCompany(initialCompany);
    } else {
      setCompany(getLocalCompanyData());
    }
  }, [initialCompany, isOpen]);

  if (!isOpen || !quote) return null;

  const isPrevia = isPreviaProp !== undefined ? isPreviaProp : (quote.status_nfe !== 'Emitida');

  const handlePrint = () => {
    setIsPrinting(true);
    document.body.classList.add('print-danfe');
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove('print-danfe');
        setIsPrinting(false);
      }, 500);
    }, 150);
  };

  const handleOpenNewTab = async () => {
    setIsOpeningTab(true);
    try {
      if (isPrevia) {
        await abrirPreDanfeEmNovaAba(quote, client);
      } else {
        await abrirDanfeEmNovaAba(quote, client);
      }
    } finally {
      setIsOpeningTab(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border-b border-slate-700 flex items-center justify-between shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${isPrevia ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-base">
                  {isPrevia ? 'Pré-Visualização da DANFE (Espelho Fiscal Modelo 55)' : 'DANFE Oficial - Modelo 55'}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${isPrevia ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'}`}>
                  {isPrevia ? 'PRÉVIA / CONFERÊNCIA' : 'EMITIDA'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isPrevia 
                  ? 'Verifique os dados tributários e do destinatário antes da transmissão definitiva' 
                  : `Documento Auxiliar da NF-e nº ${quote.nfe_numero || '—'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Imprimir documento em formato A4"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>Imprimir / PDF</span>
            </button>

            <button
              type="button"
              onClick={handleOpenNewTab}
              disabled={isOpeningTab}
              className="px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Abrir DANFE em uma nova aba"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{isOpeningTab ? 'Abrindo...' : 'Nova Aba'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Banner de status / aviso */}
        {isPrevia ? (
          <div className="px-5 py-2 bg-amber-950/70 border-b border-amber-500/30 text-amber-200 flex items-center justify-between text-xs shrink-0 no-print">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>MODO DE CONFERÊNCIA - DOCUMENTO SEM VALIDADE FISCAL (NÃO TRANSMITIDO À SEFAZ)</span>
            </div>
            <span className="text-[11px] text-amber-300/80 font-mono">
              Ref: {quote.quoteNumber}
            </span>
          </div>
        ) : (
          <div className="px-5 py-2 bg-emerald-950/70 border-b border-emerald-500/30 text-emerald-200 flex items-center justify-between text-xs shrink-0 no-print">
            <div className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>DOCUMENTO AUXILIAR AUTORIZADO PELA SEFAZ</span>
            </div>
            <span className="text-[11px] text-emerald-300/80 font-mono">
              NF-e Nº {quote.nfe_numero || '—'}
            </span>
          </div>
        )}

        {/* Conteúdo com Scroll da Folha A4 */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-950/60 flex justify-center">
          <div id="container-impressao-danfe" className="w-full max-w-[820px]">
            <DanfeEspelhoA4
              quote={quote}
              client={client}
              company={company}
              isPrevia={isPrevia}
              onClose={onClose}
              onTransmitir={onTransmit}
              isTransmitting={isTransmitting}
            />
          </div>
        </div>

        {/* Rodapé de Ações do Modal */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Fechar
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>Imprimir</span>
            </button>

            {isPrevia && onTransmit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTransmit();
                }}
                disabled={isTransmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>Confirmar & Transmitir SEFAZ</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
