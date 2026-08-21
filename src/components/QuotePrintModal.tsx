import React from "react";
import { X, Printer } from "lucide-react";
import { QuotePrintView, QuoteData } from "./QuotePrintView";

interface QuotePrintModalProps {
  quote: QuoteData | any;
  onClose: () => void;
}

export default function QuotePrintModal({
  quote,
  onClose,
}: QuotePrintModalProps) {
  const handlePrint = () => {
    window.print();
  };

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
    cnpj: "12.345.678/0001-00",
    telefone: "(11) 4002-8922",
    email: "vendas@usicortemetais.com.br",
    endereco: "Rua Industrial, 1000 - Distrito Industrial - SP",
  };

  const itens = (quote?.items || quote?.itens || []).map(
    (item: any, idx: number) => ({
      id: item.id || `item-${idx}`,
      material: item.material || item.name || "MATERIAL",
      medidas: item.dimensions || item.dimensões || item.medidas || "",
      descricao: item.description || item.descrição || item.descricao || "",
      informacoes: item.info || item.informação || item.informacoes || "",
      quantidade: item.quantity || item.quantidade || 1,
      valorUnitario:
        item.unitPrice ||
        item.valorUnitario ||
        (item.totalPrice ? item.totalPrice / (item.quantity || 1) : 0),
      valorTotal: item.totalPrice || item.valorTotal || item.subtotal || 0,
    })
  );

  const subtotal =
    quote?.subtotal ||
    itens.reduce((acc: number, it: any) => acc + (it.valorTotal || 0), 0) ||
    quote?.grandTotal ||
    0;

  const desconto =
    quote?.discount || quote?.totalDiscount || quote?.desconto || 0;

  const valorTotal =
    quote?.grandTotal ||
    quote?.valorTotal ||
    subtotal - desconto + (quote?.shipping || quote?.shippingCost || 0);

  const observacoes =
    quote?.observations ||
    quote?.observacoes ||
    (quote?.paymentTerms
      ? `Condições de Pagamento: ${quote.paymentTerms}\nPreços com impostos inclusos. Material sujeito à conferência no ato do recebimento.`
      : "Preços com impostos inclusos. Material sujeito à conferência no ato do recebimento.");

  return (
    <div className="fixed inset-0 z-50 w-full h-full overflow-y-auto overflow-x-hidden p-0 sm:p-4 bg-slate-900/80 flex items-start sm:items-center justify-center print:p-0 print:bg-white print:static print:h-auto">
      {/* Container do Modal */}
      <div className="bg-white w-full min-h-screen sm:min-h-0 sm:w-full sm:max-w-5xl sm:my-8 sm:rounded-xl overflow-hidden flex flex-col shadow-2xl print:shadow-none print:rounded-none print:w-full print:m-0 print:border-none">

        {/* Barra Superior de Ações (Oculta na impressão) */}
        <div className="h-14 border-b border-slate-200 px-4 flex items-center justify-between bg-white shrink-0 sticky top-0 z-10 print:hidden">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-800 text-sm sm:text-base">
              Visualizar Proposta #{numeroOrcamento}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
              <span className="sm:hidden">Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conteúdo Renderizando QuotePrintView */}
        <div className="w-full flex-1 overflow-x-hidden bg-slate-100 print:bg-white">
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
        </div>

      </div>
    </div>
  );
}
