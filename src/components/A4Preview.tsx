import React from "react";
import type { Cliente, ItemPedido, Pedido } from "../lib/types";
import { formatSafeDate, getObservacaoEspecificaItem } from "../utils/calculator";
import CompanyHeader from "./CompanyHeader";

interface A4PreviewProps {
  pedido: Pedido;
  cliente: Cliente | null;
  itens: ItemPedido[];
  fotosPorPeca: Record<number, string>;
  mode: "a4-inteiro" | "a4-2vias" | "proposta-4col";
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function total(itens: ItemPedido[]) {
  return itens.reduce((s, i) => s + i.valorUnit * i.quantidade, 0);
}

export default function A4Preview({ pedido, cliente, itens, fotosPorPeca, mode }: A4PreviewProps) {
  const totalVal = total(itens);
  const is2vias = mode === "a4-2vias";
  const is4col = mode === "proposta-4col";

  const getItemDate = (item: ItemPedido) => {
    const rawDate =
      (item as any).created_at ||
      (item as any).data ||
      (item as any).date ||
      (item as any).createdAt ||
      pedido.data ||
      (pedido as any).created_at ||
      (pedido as any).data_orcamento;
    return formatSafeDate(rawDate);
  };

  const DocumentBlock = ({ label, tagColor = "blue" }: { label?: string; tagColor?: "blue" | "amber" | "emerald" | "slate" }) => (
    <div className="a4-doc print-container bg-white text-black p-4 sm:p-6 print:overflow-visible print:h-auto print:max-h-none print:p-0" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Header Centralizado da Empresa com Logo à Esquerda */}
      <CompanyHeader
        documentType="Cotação / Proposta Comercial"
        documentNumber={pedido.id}
        documentDate={formatSafeDate(pedido.data)}
        tag={label}
        tagColor={tagColor}
        compact={is2vias}
      />

      <div className="a4-client-block my-3 bg-slate-50 border border-slate-300 p-2.5 rounded text-xs">
        <div className="a4-section-title font-bold text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">DADOS DO CLIENTE</div>
        <div className="a4-client-grid grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div><span className="a4-field-key font-bold text-slate-600">Cliente:</span> <span className="a4-field-val font-semibold text-slate-900">{cliente?.nome ?? "—"}</span></div>
          <div><span className="a4-field-key font-bold text-slate-600">CNPJ/CPF:</span> <span className="a4-field-val font-mono">{cliente?.cnpj ?? "—"}</span></div>
          <div><span className="a4-field-key font-bold text-slate-600">Telefone:</span> <span className="a4-field-val">{cliente?.telefone ?? "—"}</span></div>
          <div><span className="a4-field-key font-bold text-slate-600">Cidade:</span> <span className="a4-field-val">{cliente?.cidade ?? "—"}</span></div>
        </div>
      </div>

      {is4col ? (
        <div className="a4-items-4col my-3">
          <div className="a4-section-title font-bold text-xs text-slate-700 uppercase mb-2">ITENS DO PEDIDO</div>
          <div className="a4-grid-4col grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {itens.map((item) => (
              <div key={item.id} className="a4-card-4col border border-slate-300 rounded p-2.5 bg-white text-xs space-y-1">
                <div className="a4-card-header flex justify-between items-center border-b border-slate-200 pb-1">
                  <span className="a4-card-num font-mono font-bold text-slate-500">#{item.id}</span>
                  <span className="a4-card-name font-bold text-slate-900 truncate">{item.descricao}</span>
                </div>
                {fotosPorPeca[item.id] ? (
                  <img src={fotosPorPeca[item.id]} alt="" className="a4-card-img w-full h-24 object-contain bg-slate-50 border border-slate-100 rounded" />
                ) : (
                  <div className="a4-card-no-img h-24 flex items-center justify-center bg-slate-100 text-slate-400 text-[10px] rounded">SEM DESENHO</div>
                )}
                <div className="a4-card-detail text-[11px]">
                  <div>
                    <div style={{ fontWeight: 'bold' }} className="text-slate-900 leading-tight">
                      {item.material}
                    </div>
                    <div
                      className="medida-obs"
                      style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                    >
                      {getItemDate(item)}
                    </div>
                  </div>
                </div>
                <div className="a4-card-detail text-[11px]">
                  <b>Medida:</b> <span className="font-mono font-bold text-slate-900">{item.medida}</span>
                  {getObservacaoEspecificaItem(item) && (
                    <span className="block text-[10px] text-slate-500 italic mt-0.5">{getObservacaoEspecificaItem(item)}</span>
                  )}
                </div>
                <div className="a4-card-detail text-[11px]"><b>Qtd:</b> {item.quantidade} pcs</div>
                {getObservacaoEspecificaItem(item) && <div className="a4-card-detail a4-card-obs text-[10px] text-slate-500 italic"><b>Obs:</b> {getObservacaoEspecificaItem(item)}</div>}
                <div className="a4-card-price text-[11px] text-slate-600">{formatCurrency(item.valorUnit)} / pc</div>
                <div className="a4-card-subtotal font-bold text-slate-900 pt-1 border-t border-slate-100 flex justify-between">
                  <span>Total:</span>
                  <span className="font-mono">{formatCurrency(item.valorUnit * item.quantidade)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="a4-items-table my-3">
          <table className="a4-table w-full border-collapse text-xs" border={1} cellPadding={4}>
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold uppercase text-[10.5px] border-b border-black">
                <th className="a4-th text-left p-1.5">PRODUTO / MATERIAL</th>
                <th className="a4-th text-center p-1.5">MEDIDAS</th>
                <th className="a4-th text-left p-1.5">DESCRIÇÃO</th>
                <th className="a4-th text-left p-1.5">INFORMAÇÕES</th>
                <th className="a4-th a4-th-r text-right p-1.5">UNITÁRIO</th>
                <th className="a4-th a4-th-r text-center p-1.5 w-12">QTD</th>
                <th className="a4-th a4-th-r text-right p-1.5">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {itens.map((item) => (
                <tr key={item.id} className="a4-tr hover:bg-slate-50">
                  <td className="a4-td font-bold text-slate-900 p-1.5">
                    <div>
                      <div style={{ fontWeight: 'bold' }} className="leading-tight">
                        {item.material || "—"}
                      </div>
                      <div
                        className="medida-obs"
                        style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                      >
                        {getItemDate(item)}
                      </div>
                    </div>
                  </td>
                  <td className="a4-td text-center p-1.5">
                    <div className="medida-bloco-center flex flex-col items-center justify-center">
                      <span className="medida-dimensao font-bold font-mono text-[11px] text-slate-900 leading-tight">{item.medida || "—"}</span>
                      {getObservacaoEspecificaItem(item) && (
                        <span className="medida-obs text-[9.5px] text-slate-500 italic font-sans leading-tight mt-0.5">{getObservacaoEspecificaItem(item)}</span>
                      )}
                    </div>
                  </td>
                  <td className="a4-td a4-td-desc text-left text-slate-800 p-1.5">{item.descricao || "—"}</td>
                  <td className="a4-td text-left text-slate-600 italic text-[10px] p-1.5">{getObservacaoEspecificaItem(item) || "—"}</td>
                  <td className="a4-td a4-td-r text-right font-mono p-1.5">{formatCurrency(item.valorUnit)}</td>
                  <td className="a4-td a4-td-r text-center font-mono font-bold p-1.5">{item.quantidade}</td>
                  <td className="a4-td a4-td-r text-right font-mono font-bold p-1.5 text-slate-950">{formatCurrency(item.valorUnit * item.quantidade)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="a4-tfoot bg-slate-50 border-t-2 border-black font-bold">
                <td colSpan={6} className="a4-td a4-td-total-label font-black text-right p-2">TOTAL GERAL:</td>
                <td className="a4-td a4-td-r a4-td-grand-total text-right font-black font-mono text-sm text-blue-900 p-2">{formatCurrency(totalVal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="a4-footer border-t border-slate-300 pt-3 mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-end text-xs gap-3">
        <div className="a4-footer-note text-slate-600 text-[11px] max-w-sm">
          Proposta válida por 15 dias a partir da data de emissão. Material sujeito a conferência no ato da entrega.
        </div>
        <div className="a4-footer-sig text-center">
          <div className="a4-sig-line">__________________________________________</div>
          <div className="a4-sig-label text-[10px] text-slate-600 mt-1 uppercase font-semibold">L.M BANZATTO METAIS - ME</div>
        </div>
      </div>
    </div>
  );

  if (is2vias) {
    return (
      <div className="print-container flex flex-col justify-between w-full max-w-4xl mx-auto secao-pedido modelo-duas-vias print:overflow-visible print:h-auto">
        <div className="via-bloco via-cliente border border-black rounded p-1 sm:p-2 bg-white" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <DocumentBlock label="VIA DO CLIENTE" tagColor="blue" />
        </div>
        <div className="linha-corte border-b border-dashed border-[#999] my-1.5 text-center relative w-full h-0">
          <span className="bg-white px-2.5 text-[9.5px] font-bold text-slate-500 relative -top-2">✂️ CORTE AQUI</span>
        </div>
        <div className="via-bloco via-empresa border border-black rounded p-1 sm:p-2 bg-white" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <DocumentBlock label="VIA DA EMPRESA / PRODUÇÃO" tagColor="amber" />
        </div>
      </div>
    );
  }

  return (
    <div className="print-container w-full max-w-4xl mx-auto border border-slate-300 shadow-xl rounded-xl overflow-hidden bg-white print:border-none print:shadow-none print:rounded-none print:overflow-visible print:max-w-none print:h-auto print:max-h-none">
      <DocumentBlock />
    </div>
  );
}
