import React from "react";
import { formatSafeDate } from "../utils/calculator";

// Types/Interfaces
export interface QuoteItem {
  id?: string | number;
  material?: string;
  medidas?: string;
  dimensions?: string;
  dimensões?: string;
  descricao?: string;
  descrição?: string;
  description?: string;
  informacoes?: string;
  informação?: string;
  info?: string;
  quantidade?: number;
  valorUnitario?: number;
  valorTotal?: number;
  drawingImage?: string;
  fotoDesenho?: string;
  [key: string]: any;
}

export type Item = QuoteItem;

export interface CustomerData {
  nome?: string;
  name?: string;
  documento?: string;
  telefone?: string;
  phone?: string;
  email?: string;
  endereco?: string;
  address?: string;
  [key: string]: any;
}

export interface CompanyData {
  nome?: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  logoUrl?: string;
  [key: string]: any;
}

export interface QuoteData {
  id?: string;
  quoteNumber?: string;
  date?: string;
  clientName?: string;
  client?: CustomerData;
  cliente?: CustomerData;
  company?: CompanyData;
  empresa?: CompanyData;
  paymentTerms?: string;
  items?: QuoteItem[];
  itens?: QuoteItem[];
  validityDays?: number | string;
  deliveryTerms?: string;
  observations?: string;
  observacoes?: string;
  totalWeightKg?: number;
  totalDiscount?: number;
  discount?: number;
  shippingCost?: number;
  shipping?: number;
  subtotal?: number;
  grandTotal?: number;
  valorTotal?: number;
  [key: string]: any;
}

export interface QuotePrintViewProps {
  numeroOrcamento?: string;
  dataEmissao?: string;
  validade?: string;
  cliente?: CustomerData;
  empresa?: CompanyData;
  itens?: QuoteItem[];
  subtotal?: number;
  desconto?: number;
  valorTotal?: number;
  observacoes?: string;
  quote?: QuoteData;
  [key: string]: any;
}

export const QuotePrintView: React.FC<QuotePrintViewProps> = (props) => {
  const quote = props.quote;

  const numeroOrcamento =
    props.numeroOrcamento ||
    quote?.quoteNumber ||
    quote?.id ||
    "COT-2026-3169";

  const dataEmissao =
    props.dataEmissao ||
    (quote?.date ? formatSafeDate(quote.date) : formatSafeDate(new Date()));

  const validade =
    props.validade ||
    (quote?.validityDays ? `${quote.validityDays} dias` : undefined) ||
    "10 dias";

  const cliente: CustomerData = props.cliente ||
    quote?.cliente ||
    quote?.client || {
      nome: quote?.clientName || "BRASIL TECNOLOGIAS LTDA",
      documento: "12.345.678/0001-90",
      telefone: "(11) 98765-4321",
      email: "contato@brasiltecnologias.com.br",
    };

  const empresa: CompanyData = props.empresa ||
    quote?.empresa ||
    quote?.company || {
      nome: "Usicorte Metais",
      cnpj: "12.345.678/0001-00",
      telefone: "(11) 4002-8922",
      email: "vendas@usicortemetais.com.br",
      endereco: "Rua Industrial, 1000 - Distrito Industrial - SP",
    };

  const rawItens: QuoteItem[] =
    props.itens ||
    quote?.itens ||
    quote?.items || [
      {
        id: "1",
        material: "CHAPA",
        medidas: '1/2" (12,7mm) × 1200 × 2400',
        descricao: "Chapa Aço SAE 1020 Cortada a Plasma CNC",
        informacoes: "Bordas escariadas e desbastadas",
        quantidade: 2,
        valorUnitario: 3800,
        valorTotal: 7600,
      },
      {
        id: "2",
        material: "CHAPA",
        medidas: '1" (25,4mm) × 300 × 600',
        descricao: "Chapa Aço SAE 1045 Bloco Retangular",
        informacoes: "Tolerância e esquadro usinados",
        quantidade: 1,
        valorUnitario: 7738.42,
        valorTotal: 7738.42,
      },
    ];

  const itens: QuoteItem[] = rawItens.map((item, idx) => ({
    id: item.id || `item-${idx}`,
    material: item.material || "MATERIAL",
    medidas: item.medidas || item.dimensões || item.dimensions || "",
    descricao: item.descricao || item.descrição || item.description || "",
    informacoes: item.informacoes || item.informação || item.info || "",
    quantidade: item.quantidade ?? 1,
    valorUnitario:
      item.valorUnitario ??
      (item.valorTotal ? item.valorTotal / (item.quantidade || 1) : 0),
    valorTotal:
      item.valorTotal ??
      (item.valorUnitario ? item.valorUnitario * (item.quantidade || 1) : 0),
    // imagem PROPRIA de cada item (nunca uma imagem global compartilhada)
    drawingImage: item.drawingImage || item.fotoDesenho || "",
  }));

  const subtotal =
    props.subtotal ??
    quote?.subtotal ??
    (itens.reduce((acc, it) => acc + (it.valorTotal || 0), 0) || 15338.42);

  const desconto =
    props.desconto ??
    quote?.desconto ??
    quote?.totalDiscount ??
    quote?.discount ??
    100;

  const valorTotal =
    props.valorTotal ??
    quote?.valorTotal ??
    quote?.grandTotal ??
    (subtotal - (desconto || 0) + (quote?.shippingCost || quote?.shipping || 0) || 15238.42);

  const observacoes =
    props.observacoes ??
    quote?.observacoes ??
    quote?.observations ??
    (quote?.paymentTerms
      ? `Condições de pagamento: ${quote.paymentTerms}\nPreços com impostos inclusos. Material sujeito à conferência no ato do recebimento.`
      : "Preços com impostos inclusos. Material sujeito à conferência no ato do recebimento.");

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  return (
    <>
      <style>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ========================================================= */}
      {/* LAYOUT MOBILE (visível apenas abaixo de 640px / sm:hidden) */}
      {/* ========================================================= */}
      <div className="block sm:hidden w-full bg-white min-h-screen p-3 text-slate-800 print:hidden box-border overflow-x-hidden">
        {/* Cabeçalho Empresa */}
        <div className="border-b border-slate-200 pb-4 mb-4">
          {empresa.logoUrl ? (
            <img
              src={empresa.logoUrl}
              alt={empresa.nome || "Empresa"}
              className="h-12 w-auto object-contain mb-2"
            />
          ) : (
            <h1 className="text-xl font-bold text-slate-900 leading-none">
              {empresa.nome || "Usicorte Metais"}
            </h1>
          )}
          {empresa.cnpj && <p className="text-xs text-slate-500 mt-1">CNPJ: {empresa.cnpj}</p>}
          {empresa.telefone && <p className="text-xs text-slate-500">Tel: {empresa.telefone}</p>}
          {empresa.email && <p className="text-xs text-slate-500">Email: {empresa.email}</p>}
        </div>

        {/* Informações do Orçamento */}
        <div className="bg-slate-50 p-3 rounded-lg mb-4 border border-slate-200">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Orçamento</span>
            <span className="text-sm font-bold text-slate-900">#{numeroOrcamento}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-600">
            <span>Emissão: {dataEmissao}</span>
            {validade && <span>Validade: {validade}</span>}
          </div>
        </div>

        {/* Dados do Cliente (Coluna Única) */}
        <div className="mb-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Dados do Cliente</h2>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-xs">
            <p className="font-bold text-slate-800 text-sm">{cliente.nome}</p>
            {cliente.documento && <p className="text-slate-600">CPF/CNPJ: {cliente.documento}</p>}
            {cliente.telefone && <p className="text-slate-600">Tel: {cliente.telefone}</p>}
            {cliente.email && <p className="text-slate-600">Email: {cliente.email}</p>}
            {cliente.endereco && <p className="text-slate-600">Endereço: {cliente.endereco}</p>}
          </div>
        </div>

        {/* Lista de Itens (Cards) */}
        <div className="mb-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Itens do Orçamento</h2>
          <div className="space-y-3">
            {itens.map((item, index) => (
              <div
                key={item.id || index}
                className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm space-y-2"
              >
                <div className="border-b border-slate-100 pb-2">
                  <span className="text-xs text-slate-400 block">Material</span>
                  <span className="font-semibold text-slate-800 text-sm">{item.material}</span>
                </div>

                {item.drawingImage && (
                  <div className="flex justify-center border border-dashed border-slate-300 rounded p-1 bg-slate-50">
                    <img
                      src={item.drawingImage}
                      alt={`Desenho técnico do item ${index + 1} - ${item.material}`}
                      className="max-h-[110px] w-auto object-contain print:contrast-[200%]"
                    />
                  </div>
                )}

                {item.medidas && (
                  <div>
                    <span className="text-xs text-slate-400 block">Medidas</span>
                    <span className="text-xs text-slate-700 break-all">{item.medidas}</span>
                  </div>
                )}

                {item.descricao && (
                  <div>
                    <span className="text-xs text-slate-400 block">Descrição</span>
                    <span className="text-xs text-slate-700 break-words">{item.descricao}</span>
                  </div>
                )}

                {item.informacoes && item.informacoes !== "-" && (
                  <div>
                    <span className="text-xs text-slate-400 block">Informações</span>
                    <span className="text-xs text-slate-700 break-words italic">{item.informacoes}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-500">Qtd: {item.quantidade}</span>
                    <span className="text-slate-400 mx-1 font-light">|</span>
                    <span className="text-slate-500">Unit: {formatCurrency(item.valorUnitario || 0)}</span>
                  </div>
                  <div className="font-bold text-slate-900 text-sm">
                    {formatCurrency(item.valorTotal || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totais (100% largura) */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-2 mb-4">
          <div className="flex justify-between text-xs text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          {desconto > 0 && (
            <div className="flex justify-between text-xs text-emerald-600 font-medium">
              <span>Desconto</span>
              <span>- {formatCurrency(desconto)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
            <span className="font-bold text-slate-800 text-sm">Total</span>
            <span className="font-bold text-slate-900 text-lg">{formatCurrency(valorTotal)}</span>
          </div>
        </div>

        {/* Observações */}
        {observacoes && (
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs">
            <span className="font-semibold text-slate-700 block mb-1">Observações:</span>
            <p className="text-slate-600 whitespace-pre-line leading-relaxed">{observacoes}</p>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* LAYOUT DESKTOP & IMPRESSÃO (sm:flex / A4)                 */}
      {/* ========================================================= */}
      <div className="hidden sm:flex justify-center bg-slate-100 p-6 print:p-0 print:bg-white print:block">
        <div className="w-full max-w-[794px] bg-white rounded-xl shadow-2xl p-8 print:shadow-none print:rounded-none print:p-0 print:max-w-none text-slate-800">
          
          {/* Cabeçalho Desktop */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
            <div>
              {empresa.logoUrl ? (
                <img src={empresa.logoUrl} alt={empresa.nome || "Empresa"} className="h-16 w-auto object-contain mb-3" />
              ) : (
                <h1 className="text-2xl font-bold text-slate-900 mb-1">{empresa.nome || "Usicorte Metais"}</h1>
              )}
              {empresa.cnpj && <p className="text-sm text-slate-500">CNPJ: {empresa.cnpj}</p>}
              {empresa.endereco && <p className="text-sm text-slate-500">{empresa.endereco}</p>}
              <p className="text-sm text-slate-500">
                {[empresa.telefone, empresa.email].filter(Boolean).join(" | ")}
              </p>
            </div>

            <div className="text-right">
              <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">ORÇAMENTO</h2>
              <p className="text-lg font-bold text-slate-600 mb-2">#{numeroOrcamento}</p>
              <p className="text-xs text-slate-500">Data: {dataEmissao}</p>
              {validade && <p className="text-xs text-slate-500">Validade: {validade}</p>}
            </div>
          </div>

          {/* Cliente Desktop */}
          <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Cliente</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-bold text-slate-800">{cliente.nome}</p>
                {cliente.documento && <p className="text-slate-600 text-xs mt-1">CPF/CNPJ: {cliente.documento}</p>}
              </div>
              <div className="text-right">
                {cliente.telefone && <p className="text-slate-600 text-xs">Tel: {cliente.telefone}</p>}
                {cliente.email && <p className="text-slate-600 text-xs">Email: {cliente.email}</p>}
                {cliente.endereco && <p className="text-slate-600 text-xs mt-1">{cliente.endereco}</p>}
              </div>
            </div>
          </div>

          {/* Tabela Desktop (4 Colunas) */}
          <table className="w-full text-left border-collapse mb-6">
            <thead>
              <tr className="border-b-2 border-slate-200 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-2">Item / Descrição</th>
                <th className="py-3 px-2 text-center w-28">Desenho</th>
                <th className="py-3 px-2 text-center w-20">Qtd</th>
                <th className="py-3 px-2 text-right w-32">Valor Unit.</th>
                <th className="py-3 px-2 text-right w-32">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {itens.map((item, index) => (
                <tr key={item.id || index} className="align-top">
                  <td className="py-3 px-2">
                    <p className="font-semibold text-slate-800">{item.material}</p>
                    {item.medidas && <p className="text-xs text-slate-500 mt-0.5">Medidas: {item.medidas}</p>}
                    {item.descricao && <p className="text-xs text-slate-600 mt-1">{item.descricao}</p>}
                    {item.informacoes && <p className="text-xs text-slate-500 italic mt-0.5">{item.informacoes}</p>}
                  </td>
                  <td className="py-3 px-2 text-center">
                    {item.drawingImage ? (
                      <img
                        src={item.drawingImage}
                        alt={`Desenho técnico do item ${index + 1} - ${item.material}`}
                        className="max-h-[80px] w-auto mx-auto object-contain print:contrast-[200%]"
                      />
                    ) : (
                      <span className="text-[10px] text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-center text-slate-700">{item.quantidade}</td>
                  <td className="py-3 px-2 text-right text-slate-700">{formatCurrency(item.valorUnitario || 0)}</td>
                  <td className="py-3 px-2 text-right font-medium text-slate-900">
                    {formatCurrency(item.valorTotal || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totais Desktop */}
          <div className="flex justify-end mb-6">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {desconto > 0 && (
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Desconto:</span>
                  <span>- {formatCurrency(desconto)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Total:</span>
                <span>{formatCurrency(valorTotal)}</span>
              </div>
            </div>
          </div>

          {/* Observações Desktop */}
          {observacoes && (
            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Observações
              </h4>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">{observacoes}</p>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default QuotePrintView;
