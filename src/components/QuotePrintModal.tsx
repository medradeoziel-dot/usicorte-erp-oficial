import React, { useState, useEffect } from "react";
import { 
  X, 
  Printer, 
  Building2, 
  ClipboardList, 
  Tag, 
  Scissors 
} from "lucide-react";
import { QuotePrintView, QuoteData } from "./QuotePrintView";
import RelatorioPropostaPrint from "./prints/RelatorioPropostaPrint";
import RelatorioEmpresaPrint from "./prints/RelatorioEmpresaPrint";
import RelatorioPedidoPrint from "./prints/RelatorioPedidoPrint";
import RelatorioEtiquetaPrint from "./prints/RelatorioEtiquetaPrint";
import RelatorioCortePrint from "./prints/RelatorioCortePrint";

export type PrintMode = 'GERAL' | 'EMPRESA' | 'PEDIDO' | 'ETIQUETAS' | 'CORTE';

interface QuotePrintModalProps {
  quote: QuoteData | any;
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

  const applyPrintClass = (mode: PrintMode) => {
    document.body.classList.remove('print-pedido', 'print-etiqueta', 'print-proposta', 'print-corte', 'print-geral', 'print-empresa');
    if (mode === 'GERAL') {
      document.body.classList.add('print-geral');
    } else if (mode === 'EMPRESA') {
      document.body.classList.add('print-empresa');
    } else if (mode === 'PEDIDO') {
      document.body.classList.add('print-pedido');
    } else if (mode === 'ETIQUETAS') {
      document.body.classList.add('print-etiqueta');
    } else if (mode === 'CORTE') {
      document.body.classList.add('print-corte');
    }
  };

  const handlePrint = () => {
    applyPrintClass(activeMode);
    const onAfterPrint = () => {
      document.body.classList.remove('print-pedido', 'print-etiqueta', 'print-proposta', 'print-corte', 'print-geral', 'print-empresa');
      window.removeEventListener('afterprint', onAfterPrint);
    };
    window.addEventListener('afterprint', onAfterPrint);

    setTimeout(() => {
      window.print();
    }, 200);
  };

  // Se autoPrint estiver habilitado, dispara impressão após breve intervalo para renderização
  useEffect(() => {
    if (autoPrint) {
      applyPrintClass(initialMode);
      const timer = setTimeout(() => {
        window.print();
      }, 350);
      return () => {
        clearTimeout(timer);
        document.body.classList.remove('print-pedido', 'print-etiqueta', 'print-proposta', 'print-corte', 'print-geral', 'print-empresa');
      };
    }
  }, [autoPrint, initialMode]);

  const numeroOrcamento =
    quote?.quoteNumber || quote?.id || "COT-2026-3169";

  const dataEmissao =
    quote?.date ||
    (quote?.createdAt
      ? new Date(quote.createdAt).toLocaleDateString("pt-BR")
      : new Date().toLocaleDateString("pt-BR"));

  const validade = quote?.validityDays
    ? `${quote.validityDays} dias`
    : "10 dias";

  const cliente = {
    nome:
      quote?.clientName ||
      quote?.cliente?.nome ||
      quote?.client?.name ||
      "Cliente Balcão",
    documento:
      quote?.clientDocument ||
      quote?.cliente?.documento ||
      quote?.client?.documento,
    telefone:
      quote?.clientPhone ||
      quote?.cliente?.telefone ||
      quote?.client?.telefone,
    email:
      quote?.clientEmail ||
      quote?.cliente?.email ||
      quote?.client?.email,
    endereco:
      [quote?.clientCity, quote?.clientState].filter(Boolean).join(" - ") ||
      quote?.cliente?.endereco ||
      quote?.client?.endereco,
  };

  const empresa = {
    nome: "Usicorte Metais",
    cnpj: "25.038.430/0001-23",
    telefone: "(14) 99880-9362 / (14) 99819-6873",
    email: "vendas.usicorte@gmail.com",
    endereco: "L. M. BANZATTO METAIS",
  };

  const itens = (quote?.items || quote?.itens || []).map(
    (item: any, idx: number) => ({
      id: item.id || `item-${idx}`,
      material: item.material || item.name || item.constantName || "MATERIAL",
      medidas: item.dimensions || item.dimensões || item.medidas || "",
      descricao: item.description || item.descrição || item.descricao || "",
      informacoes: item.info || item.informação || item.informacoes || "",
      observacao: item.observacao || item.observacoes || item.obs || item.notes || "",
      quantidade: item.quantity || item.quantidade || item.qtd || 1,
      valorUnitario:
        item.unitPrice ||
        item.valorUnitario ||
        (item.totalPrice ? item.totalPrice / (item.quantity || 1) : 0),
      valorTotal: item.totalPrice || item.valorTotal || item.subtotal || 0,
      totalWeightKg: item.totalWeightKg || item.pesoTotal || 0,
      drawingImage: item.drawingImage || item.fotoDesenho || item.desenhoUrl || "",
      created_at: item.created_at || item.createdAt,
      data: item.data || item.date || item.data_item || quote?.date || quote?.data_orcamento,
    })
  );

  const subtotal =
    quote?.subtotal ||
    itens.reduce((acc: number, it: any) => acc + (it.valorTotal || 0), 0) ||
    quote?.grandTotal ||
    0;

  const desconto =
    quote?.discount || quote?.totalDiscount || quote?.desconto || 0;

  const frete = quote?.shipping || quote?.shippingCost || 0;

  const valorTotal =
    quote?.grandTotal ||
    quote?.valorTotal ||
    subtotal - desconto + frete;

  const observacoes =
    quote?.observations ||
    quote?.observacoes ||
    (quote?.paymentTerms
      ? `Condições de Pagamento: ${quote.paymentTerms}\nPreços com impostos inclusos. Material sujeito à conferência no ato do recebimento.`
      : "Preços com impostos inclusos. Material sujeito à conferência no ato do recebimento.");

  // Itens normalizados para os modelos de impressão
  const itensFormatadosRelatorio = itens.map((it: any, idx: number) => ({
    idVer: it.id || idx + 1,
    data: it.data || dataEmissao,
    cliente: cliente.nome,
    contato: quote?.contactPerson || '',
    produto: it.material || 'PEÇA',
    medida: it.medidas || '',
    descricao: it.descricao || '',
    qtd: Number(it.quantidade || 1),
    unitario: Number(it.valorUnitario || 0),
    valorGeral: Number(it.valorTotal || (it.valorUnitario * it.quantidade) || 0),
    observacao: it.observacao || it.informacoes || '',
    pesoTotal: Number(it.totalWeightKg || 0),
    drawingImage: it.drawingImage || '',
    imagem: it.drawingImage || '',
  }));

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

            {/* Abas com os 5 formatos */}
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

        {/* Conteúdo Renderizando o Modelo Selecionado */}
        <div className="print-container w-full flex-1 overflow-x-hidden bg-slate-100 print:bg-white print:overflow-visible print:h-auto print:max-h-none">
          {activeMode === 'GERAL' && (
            <QuotePrintView
              quote={quote}
              numeroOrcamento={numeroOrcamento}
              dataEmissao={dataEmissao}
              validade={validade}
              cliente={cliente}
              empresa={empresa}
              itens={itens}
              subtotal={subtotal}
              desconto={desconto}
              valorTotal={valorTotal}
              observacoes={observacoes}
            />
          )}

          {activeMode === 'EMPRESA' && (
            <RelatorioEmpresaPrint
              itens={itensFormatadosRelatorio}
              cliente={cliente.nome}
              numeroProposta={numeroOrcamento}
              data={dataEmissao}
            />
          )}

          {activeMode === 'PEDIDO' && (
            <RelatorioPedidoPrint
              cliente={cliente.nome}
              numeroPedido={numeroOrcamento}
              data={dataEmissao}
              itens={itensFormatadosRelatorio}
              formaPagamento={quote?.paymentTerms || 'À vista'}
            />
          )}

          {activeMode === 'ETIQUETAS' && (
            <RelatorioEtiquetaPrint
              cliente={cliente.nome}
              numeroPedido={numeroOrcamento}
              itens={itensFormatadosRelatorio}
            />
          )}

          {activeMode === 'CORTE' && (
            <RelatorioCortePrint
              itens={itensFormatadosRelatorio}
              cliente={cliente.nome}
              numeroPedido={numeroOrcamento}
              data={dataEmissao}
            />
          )}
        </div>

      </div>
    </div>
  );
}
