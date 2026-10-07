import React, { useState, useEffect } from "react";
import { 
  X, 
  Printer, 
  Building2, 
  ClipboardList, 
  Tag, 
  Scissors 
} from "lucide-react";
import { 
  ConsultaPrintDocuments, 
  TipoImpressaoConsulta, 
  dispararImpressaoConsulta,
  normalizeQuoteForPrint
} from "./ConsultaPrintDocuments";

export type PrintMode = TipoImpressaoConsulta;

interface QuotePrintModalProps {
  quote: any;
  initialMode?: PrintMode;
  autoPrint?: boolean;
  onClose: () => void;
}

export default function QuotePrintModal({
  quote,
  initialMode = 'GERAL',
  autoPrint = false,
  onClose,
}: QuotePrintModalProps) {
  const [activeMode, setActiveMode] = useState<PrintMode>(initialMode);
  const normalizedQuote = normalizeQuoteForPrint(quote);

  const handlePrint = () => {
    dispararImpressaoConsulta(normalizedQuote, activeMode);
  };

  // Se autoPrint estiver habilitado, dispara impressão automática após renderização
  useEffect(() => {
    if (autoPrint) {
      dispararImpressaoConsulta(normalizedQuote, initialMode);
    }
  }, [autoPrint, initialMode]);

  const numeroOrcamento =
    normalizedQuote?.quoteNumber || normalizedQuote?.id || "COT-2026-3169";

  const abas: Array<{
    mode: PrintMode;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    activeClasses: string;
  }> = [
    {
      mode: 'GERAL',
      label: 'GERAL',
      sublabel: 'Proposta A4',
      icon: <Printer className="w-4 h-4" />,
      activeClasses: 'bg-blue-600 text-white shadow-xs',
    },
    {
      mode: 'EMPRESA',
      label: 'EMPRESA',
      sublabel: 'Via Interna',
      icon: <Building2 className="w-4 h-4" />,
      activeClasses: 'bg-slate-700 text-white shadow-xs',
    },
    {
      mode: 'PEDIDO',
      label: 'PEDIDO',
      sublabel: '2 Vias A4',
      icon: <ClipboardList className="w-4 h-4" />,
      activeClasses: 'bg-amber-600 text-white shadow-xs',
    },
    {
      mode: 'ETIQUETAS',
      label: 'ETIQUETAS',
      sublabel: '80x80mm',
      icon: <Tag className="w-4 h-4" />,
      activeClasses: 'bg-emerald-600 text-white shadow-xs',
    },
    {
      mode: 'CORTE',
      label: 'CORTE',
      sublabel: 'Ficha CNC',
      icon: <Scissors className="w-4 h-4" />,
      activeClasses: 'bg-rose-600 text-white shadow-xs',
    },
  ];

  return (
    <div className="print-container fixed inset-0 z-50 w-full h-full overflow-y-auto overflow-x-hidden p-0 sm:p-4 bg-slate-900/80 flex items-start sm:items-center justify-center print:p-0 print:bg-white print:static print:h-auto print:overflow-visible print:max-h-none">
      {/* Container do Modal */}
      <div className="print-container bg-white w-full min-h-screen sm:min-h-0 sm:w-full sm:max-w-5xl sm:my-8 sm:rounded-xl overflow-hidden flex flex-col shadow-2xl print:shadow-none print:rounded-none print:w-full print:m-0 print:border-none print:overflow-visible print:h-auto print:max-h-none print:min-h-0">

        {/* Barra Superior de Ações (Oculta na impressão) */}
        <div className="border-b border-slate-200 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between bg-white shrink-0 sticky top-0 z-10 print:hidden no-print gap-2">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <h2 className="font-black text-slate-800 text-sm sm:text-base flex items-center gap-1.5">
              <span>Orçamento</span>
              <span className="font-mono text-blue-600">#{numeroOrcamento}</span>
            </h2>

            {/* Abas com os 5 formatos idênticos à Consulta */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              {abas.map((aba) => {
                const isActive = activeMode === aba.mode;
                return (
                  <button
                    key={aba.mode}
                    type="button"
                    onClick={() => setActiveMode(aba.mode)}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                      isActive 
                        ? aba.activeClasses 
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                    title={aba.sublabel}
                  >
                    {aba.icon}
                    <span>{aba.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-sm hover:shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              title="Fechar visualização"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo Renderizando o Modelo da Consulta com os dados 100% preenchidos */}
        <div className="print-container w-full flex-1 overflow-x-hidden bg-slate-100 print:bg-white print:overflow-visible print:h-auto print:max-h-none">
          <ConsultaPrintDocuments quote={normalizedQuote} tipo={activeMode} />
        </div>

      </div>
    </div>
  );
}
