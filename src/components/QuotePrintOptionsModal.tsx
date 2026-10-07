import React, { useEffect } from 'react';
import { 
  Printer, 
  Building2, 
  ClipboardList, 
  Tag, 
  Scissors, 
  CheckCircle2, 
  X,
  FileCheck2
} from 'lucide-react';

export type TipoImpressaoOrcamento = 'GERAL' | 'EMPRESA' | 'PEDIDO' | 'ETIQUETAS' | 'CORTE';

interface QuotePrintOptionsModalProps {
  quoteNumber: string;
  clientName?: string;
  itemCount?: number;
  totalValue?: number;
  onSelectPrint: (tipo: TipoImpressaoOrcamento) => void;
  onClose: () => void;
}

export default function QuotePrintOptionsModal({
  quoteNumber,
  clientName,
  itemCount,
  totalValue,
  onSelectPrint,
  onClose
}: QuotePrintOptionsModalProps) {
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
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
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
                  Cotação #{quoteNumber}
                </span>
              </div>
              <h2 id="modal-title" className="text-lg sm:text-xl font-black text-slate-100 tracking-tight mt-0.5">
                Opções de Impressão do Orçamento
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {clientName ? (
                  <>Cliente: <strong className="text-slate-200">{clientName}</strong> • </>
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

        {/* Grade Horizontal com os 5 botões de ação com ícones visíveis */}
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {opcoes.map((opcao) => (
              <button
                key={opcao.tipo}
                type="button"
                onClick={() => onSelectPrint(opcao.tipo)}
                className={`group flex flex-col items-center text-center p-4 rounded-xl border transition-all duration-150 cursor-pointer shadow-md hover:shadow-xl hover:-translate-y-0.5 ${opcao.cardClasses}`}
              >
                {/* Ícone Visível */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 border ${opcao.iconBgClasses}`}>
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
  );
}
