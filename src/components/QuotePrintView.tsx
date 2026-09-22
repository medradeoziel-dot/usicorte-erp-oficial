import React from "react";
import { formatSafeDate, getObservacaoEspecificaItem } from "../utils/calculator";
import CompanyHeader from "./CompanyHeader";

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
  quote?: QuoteData;
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
}

export const QuotePrintView: React.FC<QuotePrintViewProps> = (props) => {
  const { quote } = props;

  const numeroOrcamento =
    props.numeroOrcamento ??
    quote?.quoteNumber ??
    quote?.id ??
    "COT-2026-3169";

  const dataEmissao =
    props.dataEmissao ??
    quote?.date ??
    (quote?.createdAt ? formatSafeDate(quote.createdAt) : new Date().toLocaleDateString("pt-BR"));

  const validade =
    props.validade ??
    (quote?.validityDays ? `${quote.validityDays} dias` : "10 dias");

  const cliente: CustomerData = {
    nome:
      props.cliente?.nome ??
      props.cliente?.name ??
      quote?.clientName ??
      quote?.client?.name ??
      quote?.cliente?.nome ??
      "CLIENTE BALCÃO",
    documento:
      props.cliente?.documento ??
      quote?.client?.documento ??
      quote?.cliente?.documento ??
      "",
    telefone:
      props.cliente?.telefone ??
      props.cliente?.phone ??
      quote?.client?.telefone ??
      quote?.cliente?.telefone ??
      "",
    email:
      props.cliente?.email ??
      quote?.client?.email ??
      quote?.cliente?.email ??
      "",
    endereco:
      props.cliente?.endereco ??
      props.cliente?.address ??
      quote?.client?.endereco ??
      quote?.cliente?.endereco ??
      "",
  };

  const rawItens =
    props.itens ??
    quote?.items ??
    quote?.itens ??
    [];

  const itens: QuoteItem[] = rawItens.map((item, index) => ({
    id: item.id ?? index + 1,
    material: item.material ?? item.name ?? "MATERIAL",
    medidas: item.medidas ?? item.dimensions ?? item.dimensões ?? "",
    descricao: item.descricao ?? item.descrição ?? item.description ?? "",
    informacoes: item.informacoes ?? item.informação ?? item.info ?? "",
    observacao: item.observacao ?? item.obs ?? item.notes ?? item.observacoes ?? "",
    quantidade: item.quantidade ?? item.qtd ?? item.quantity ?? 1,
    valorUnitario: item.valorUnitario ?? item.unitPrice ?? 0,
    valorTotal: item.valorTotal ?? item.subtotal ?? (Number(item.valorUnitario || item.unitPrice || 0) * Number(item.quantidade || item.qtd || item.quantity || 1)),
    drawingImage: item.drawingImage ?? item.fotoDesenho ?? item.desenhoUrl ?? item.desenho_url ?? item.foto ?? "",
    created_at: item.created_at ?? item.createdAt ?? undefined,
    data: item.data ?? item.date ?? item.data_orcamento ?? undefined,
  }));

  const getItemDate = (item: QuoteItem) => {
    const rawDate =
      item.created_at ||
      item.data ||
      item.date ||
      item.createdAt ||
      item.data_item ||
      quote?.date ||
      quote?.data_orcamento ||
      quote?.data ||
      quote?.createdAt ||
      dataEmissao;
    return formatSafeDate(rawDate);
  };

  const subtotal =
    props.subtotal ??
    quote?.subtotal ??
    itens.reduce((acc, it) => acc + (it.valorTotal || 0), 0);

  const desconto =
    props.desconto ??
    quote?.desconto ??
    quote?.totalDiscount ??
    quote?.discount ??
    0;

  const valorTotal =
    props.valorTotal ??
    quote?.valorTotal ??
    quote?.grandTotal ??
    (subtotal - (desconto || 0) + (quote?.shippingCost || quote?.shipping || 0));

  const rawObs =
    props.observacoes ??
    quote?.observacoes ??
    quote?.observations ??
    "";
  
  const observacoes = (() => {
    if (!rawObs || typeof rawObs !== 'string') return "";
    const trimmed = rawObs.trim();
    if (!trimmed || trimmed === '-' || trimmed === '—') return "";
    const lower = trimmed.toLowerCase();
    if (
      lower.includes("preços com impostos inclusos") ||
      lower.includes("precos com impostos inclusos") ||
      lower.includes("material sujeito a conferência") ||
      lower.includes("material sujeito a conferencia") ||
      lower.includes("material sujeito à conferência") ||
      lower.includes("material sujeito à conferencia")
    ) {
      return "";
    }
    return trimmed;
  })();

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
        {/* Header Centralizado da Empresa */}
        <CompanyHeader 
          documentType="Orçamento / Proposta"
          documentNumber={numeroOrcamento}
          documentDate={dataEmissao}
          compact={true}
        />

        {/* Dados do Cliente (Coluna Única) */}
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Dados do Cliente</h2>
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1 text-xs">
            <p className="font-bold text-slate-800 text-sm">{cliente.nome}</p>
            {cliente.documento && <p className="text-slate-600">CPF/CNPJ: {cliente.documento}</p>}
            {cliente.telefone && <p className="text-slate-600">Tel: {cliente.telefone}</p>}
            {cliente.email && <p className="text-slate-600">Email: {cliente.email}</p>}
            {cliente.endereco && <p className="text-slate-600">Endereço: {cliente.endereco}</p>}
          </div>
        </div>

        {/* Lista de Itens (Cards) */}
        <div className="mb-4">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Itens do Orçamento ({itens.length})</h2>
          <div className="space-y-3">
            {itens.map((item, index) => (
              <div
                key={item.id || index}
                className="bg-white border border-slate-200 rounded-lg p-3 shadow-xs space-y-2 text-xs"
              >
                <div className="border-b border-slate-100 pb-1.5 flex justify-between items-start">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Produto / Material</span>
                  <div className="text-right">
                    <div style={{ fontWeight: 'bold' }} className="text-slate-800 text-sm leading-tight">
                      {item.material || (item as any).produto}
                    </div>
                    <div
                      className="medida-obs"
                      style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                    >
                      {formatSafeDate(item.data || item.created_at || (item as any).createdAt || quote?.data_orcamento || quote?.date || quote?.createdAt || '22/09/2026')}
                    </div>
                  </div>
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
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Medidas</span>
                    <div className="medida-bloco flex flex-col">
                      <span className="medida-dimensao font-mono text-slate-900 font-bold">{item.medidas}</span>
                      {getObservacaoEspecificaItem(item) && (
                        <span className="medida-obs text-[10px] text-slate-500 italic mt-0.5">{getObservacaoEspecificaItem(item)}</span>
                      )}
                    </div>
                  </div>
                )}

                {item.descricao && (
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Descrição</span>
                    <span className="text-slate-700 break-words">{item.descricao}</span>
                  </div>
                )}

                {getObservacaoEspecificaItem(item) && (
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Informações</span>
                    <span className="text-slate-600 italic break-words">{getObservacaoEspecificaItem(item)}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-slate-500">Qtd: <strong>{item.quantidade}</strong></span>
                    <span className="text-slate-300 mx-1.5">|</span>
                    <span className="text-slate-500">Unit: {formatCurrency(item.valorUnitario || 0)}</span>
                  </div>
                  <div className="font-bold text-slate-900 font-mono text-sm">
                    {formatCurrency(item.valorTotal || 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totais (100% largura) */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-1.5 mb-4 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono">{formatCurrency(subtotal)}</span>
          </div>
          {desconto > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Desconto:</span>
              <span className="font-mono">- {formatCurrency(desconto)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-bold text-slate-900 text-sm">
            <span>Total:</span>
            <span className="text-lg font-mono text-blue-900">{formatCurrency(valorTotal)}</span>
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
          
          {/* Header Centralizado da Empresa com Logo à Esquerda */}
          <CompanyHeader 
            documentType="Orçamento / Proposta Comercial"
            documentNumber={numeroOrcamento}
            documentDate={dataEmissao}
            showBorder={true}
          />

          {/* Cliente Desktop */}
          <div className="bg-slate-50 rounded-lg p-3.5 mb-5 border border-slate-200">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Dados do Cliente</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-bold text-slate-900 text-sm">{cliente.nome}</p>
                {cliente.documento && <p className="text-slate-600 mt-0.5 font-mono">CPF/CNPJ: {cliente.documento}</p>}
                {cliente.endereco && <p className="text-slate-600 mt-0.5">{cliente.endereco}</p>}
              </div>
              <div className="text-right">
                {cliente.telefone && <p className="text-slate-600">Tel: {cliente.telefone}</p>}
                {cliente.email && <p className="text-slate-600">Email: {cliente.email}</p>}
                <p className="text-slate-500 mt-1">Validade: <strong>{validade}</strong></p>
              </div>
            </div>
          </div>

          {/* Tabela Desktop & Impressão (7 Colunas Exatas) */}
          <table className="w-full text-left border-collapse mb-6 text-xs" border={1} cellPadding={5}>
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold uppercase text-[10.5px] border-b border-black">
                <th className="p-2 text-left">PRODUTO / MATERIAL</th>
                <th className="p-2 text-center">MEDIDAS</th>
                <th className="p-2 text-left">DESCRIÇÃO</th>
                <th className="p-2 text-left">INFORMAÇÕES</th>
                <th className="p-2 text-right">UNITÁRIO</th>
                <th className="p-2 text-center w-12">QTD</th>
                <th className="p-2 text-right">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {itens.map((item, index) => (
                <tr key={item.id || index} className="align-top hover:bg-slate-50">
                  <td className="p-2 font-bold text-slate-900">
                    <div>
                      <div style={{ fontWeight: 'bold' }} className="leading-tight">
                        {item.material || (item as any).produto || "—"}
                      </div>
                      <div
                        className="medida-obs"
                        style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                      >
                        {formatSafeDate(item.data || item.created_at || (item as any).createdAt || quote?.data_orcamento || quote?.date || quote?.createdAt || '22/09/2026')}
                      </div>
                    </div>
                    {item.drawingImage && (
                      <img
                        src={item.drawingImage}
                        alt="Desenho"
                        className="max-h-[50px] w-auto mt-1 object-contain print:contrast-[200%]"
                      />
                    )}
                  </td>
                  <td className="p-2 text-center">
                    <div className="medida-bloco-center flex flex-col items-center justify-center">
                      <span className="medida-dimensao font-bold font-mono text-[11px] text-slate-900 leading-tight">
                        {item.medidas || "—"}
                      </span>
                      {getObservacaoEspecificaItem(item) && (
                        <span className="medida-obs text-[9.5px] text-slate-500 italic font-sans leading-tight mt-0.5">
                          {getObservacaoEspecificaItem(item)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2 text-slate-800">
                    {item.descricao || "—"}
                  </td>
                  <td className="p-2 text-slate-600 italic text-[11px]">
                    {getObservacaoEspecificaItem(item) || "—"}
                  </td>
                  <td className="p-2 text-right text-slate-800 font-mono">
                    {formatCurrency(item.valorUnitario || 0)}
                  </td>
                  <td className="p-2 text-center font-bold text-slate-900 font-mono">
                    {item.quantidade}
                  </td>
                  <td className="p-2 text-right font-bold text-slate-950 font-mono">
                    {formatCurrency(item.valorTotal || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totais Desktop */}
          <div className="flex justify-end mb-6">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">{formatCurrency(subtotal)}</span>
              </div>
              {desconto > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Desconto:</span>
                  <span className="font-mono">- {formatCurrency(desconto)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-slate-950 pt-2 border-t border-black">
                <span>VALOR TOTAL:</span>
                <span className="font-mono text-blue-900">{formatCurrency(valorTotal)}</span>
              </div>
            </div>
          </div>

          {/* Observações Desktop */}
          {observacoes && (
            <div className="border-t border-slate-300 pt-3 text-xs">
              <h4 className="font-bold text-slate-700 uppercase tracking-wider mb-1 text-[10px]">
                Observações
              </h4>
              <p className="text-slate-600 whitespace-pre-line leading-relaxed">{observacoes}</p>
            </div>
          )}

        </div>
      </div>
    </>
  );
};

export default QuotePrintView;
