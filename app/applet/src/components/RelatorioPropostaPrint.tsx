import React from 'react';
import { getObservacaoEspecificaItem, formatSafeDate } from '../../../../src/utils/calculator';

export interface ItemRelatorio {
  idVer?: string | number;
  produto: string;
  medida: string;
  descricao: string;
  qtd: number;
  unitario: number;
  valorGeral: number;
  observacao?: string;
  pesoTotal?: number;
  created_at?: string;
  data?: string;
  date?: string;
}

interface Props {
  cliente: string;
  numeroProposta: string;
  data: string;
  condicoesPagamento: string;
  validade: string;
  prazoEntrega: string;
  desconto: number;
  frete: number;
  itens: ItemRelatorio[];
}

export default function RelatorioPropostaPrint({
  cliente,
  numeroProposta,
  data,
  condicoesPagamento,
  validade,
  prazoEntrega,
  desconto,
  frete,
  itens,
}: Props) {
  const formatMoeda = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  const formatPeso = (val?: number) =>
    val ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3 }).format(val) + " Kg" : "-";

  const totalTiposItens = itens.length;
  const totalPecas = itens.reduce((acc, item) => acc + Number(item.qtd || 0), 0);
  const subtotalGeral = itens.reduce((acc, item) => acc + (item.valorGeral || 0), 0);
  const pesoGeral = itens.reduce((acc, item) => acc + (item.pesoTotal || 0), 0);
  const valorTotal = subtotalGeral - desconto + frete;

  const getItemDate = (item: ItemRelatorio) => {
    const rawDate = item.created_at || item.data || item.date || (item as any).createdAt || data;
    return formatSafeDate(rawDate);
  };

  return (
    <div className="w-full bg-white text-slate-900 font-sans print:p-0 p-4 sm:p-8 max-w-[1000px] mx-auto box-border overflow-x-hidden">
      {/* Botão de Impressão */}
      <div className="print:hidden mb-6 flex justify-end">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow font-bold text-xs sm:text-sm cursor-pointer transition flex items-center gap-2"
        >
          <span>🖨️</span> Imprimir Proposta
        </button>
      </div>

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-3 gap-2">
        <div className="leading-tight">
          <div className="text-2xl sm:text-3xl font-normal">
            <span className="text-slate-900 font-bold">Usi</span>
            <span className="text-red-600 font-bold">corte</span>
          </div>
          <div className="text-2xl sm:text-3xl text-slate-900 font-medium">Metais</div>
        </div>
        <div className="text-left sm:text-right text-xs sm:text-sm font-bold text-slate-600 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
          <p>
            PROPOSTA Nº: <span className="text-blue-600 font-mono">{numeroProposta}</span>
          </p>
          <p>
            DATA: <span className="text-slate-900 font-mono">{data}</span>
          </p>
        </div>
      </div>

      <h2 className="text-xs sm:text-sm font-bold text-slate-500 uppercase mb-3 border-b-2 border-slate-900 pb-1">
        Relatório / Proposta Comercial
      </h2>

      {/* Dados do Cliente e Condições */}
      <div className="bg-slate-100 border border-slate-200 rounded-md p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm mb-4 gap-2">
        <div>
          <span className="text-slate-600 font-bold">EMPRESA / CLIENTE:</span>{" "}
          <span className="font-extrabold text-slate-900 break-words">{cliente}</span>
        </div>
        <div className="text-slate-500">
          Condições: <span className="font-semibold text-slate-800">{condicoesPagamento}</span>
        </div>
      </div>

      {/* MOBILE: Cards de Itens (< 640px) */}
      <div className="block sm:hidden space-y-3 mb-6">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Itens da Proposta ({itens.length})
        </span>
        {itens.map((item, index) => {
          const obsItem = getObservacaoEspecificaItem(item);
          return (
            <div
              key={item.idVer || index}
              className="border border-slate-200 rounded-lg p-3 bg-white space-y-2 text-xs shadow-xs"
            >
              <div className="flex justify-between items-start border-b border-slate-100 pb-1.5">
                <span className="text-[10px] text-slate-400 uppercase font-bold">Material</span>
                <div className="text-right">
                  <div style={{ fontWeight: 'bold' }} className="font-bold text-slate-900 text-sm leading-tight">
                    {item.produto}
                  </div>
                  <div
                    className="medida-obs"
                    style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                  >
                    {getItemDate(item)}
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Medidas</span>
                <div className="medida-bloco flex flex-col">
                  <span className="medida-dimensao font-mono text-slate-800 font-semibold">{item.medida}</span>
                  {obsItem && (
                    <span className="medida-obs text-[10px] text-slate-500 italic mt-0.5">{obsItem}</span>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">Descrição</span>
                <span className="text-slate-700">{item.descricao}</span>
              </div>

              {obsItem && (
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Informações</span>
                  <span className="italic text-slate-600">{obsItem}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500">Qtd: <strong>{item.qtd}</strong></span>
                  <span className="mx-1 text-slate-300">|</span>
                  <span className="text-slate-500">Unit: {formatMoeda(item.unitario)}</span>
                </div>
                <div className="font-bold text-slate-950 font-mono text-sm">
                  {formatMoeda(item.valorGeral)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP & IMPRESSÃO: Tabela (>= 640px / print) */}
      <div className="hidden sm:block print:block overflow-x-auto mb-6">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-700 border-y-2 border-slate-300">
              <th className="py-2 px-2 text-left font-bold uppercase">Produto / Material</th>
              <th className="py-2 px-2 text-center font-bold uppercase">Medidas</th>
              <th className="py-2 px-2 text-left font-bold uppercase">Descrição</th>
              <th className="py-2 px-2 text-left font-bold uppercase">Informações</th>
              <th className="py-2 px-2 text-right font-bold uppercase">Unitário</th>
              <th className="py-2 px-2 text-center font-bold uppercase">Qtd</th>
              <th className="py-2 px-2 text-right font-bold uppercase">Peso Total</th>
              <th className="py-2 px-2 text-right font-bold uppercase">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, index) => {
              const obsItem = getObservacaoEspecificaItem(item);
              return (
                <tr key={item.idVer || index} className="border-b border-slate-200">
                  <td className="py-3 px-2 font-bold">
                    <div>
                      <div style={{ fontWeight: 'bold' }} className="leading-tight">
                        {item.produto}
                      </div>
                      <div
                        className="medida-obs"
                        style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                      >
                        {getItemDate(item)}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center text-slate-600 font-medium whitespace-pre-line font-mono text-xs">
                    <div className="medida-bloco-center flex flex-col items-center justify-center">
                      <span className="medida-dimensao font-bold font-mono text-slate-900 leading-tight">{item.medida}</span>
                      {obsItem && (
                        <span className="medida-obs text-[9.5px] text-slate-500 italic font-sans leading-tight mt-0.5">{obsItem}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-slate-700">{item.descricao}</td>
                  <td className="py-3 px-2 text-slate-500 italic text-xs">{obsItem || "-"}</td>
                  <td className="py-3 px-2 text-right font-semibold font-mono">{formatMoeda(item.unitario)}</td>
                  <td className="py-3 px-2 text-center font-bold font-mono">{item.qtd}</td>
                  <td className="py-3 px-2 text-right font-semibold font-mono">{formatPeso(item.pesoTotal)}</td>
                  <td className="py-3 px-2 text-right font-bold font-mono">{formatMoeda(item.valorGeral)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Totais de Itens / Peças */}
      <div className="flex justify-between items-center mb-3 pt-2 border-t border-slate-400 font-bold text-xs">
        <div className="flex gap-4 text-slate-700">
          <span>ITENS: <strong className="text-slate-900">{totalTiposItens}</strong></span>
          <span>TOTAL PEÇAS: <strong className="text-slate-900">{totalPecas} PÇ</strong></span>
        </div>
        <div className="text-sm">
          SUBTOTAL: <strong className="text-slate-900 font-mono font-black">{formatMoeda(subtotalGeral)}</strong>
        </div>
      </div>

      {/* Observações e Totais */}
      <div className="border-t-2 border-slate-900 pt-4 flex flex-col sm:flex-row justify-between gap-4">
        <div className="text-xs sm:text-sm text-slate-600 space-y-1">
          <p>
            • Validade da proposta: <span className="font-bold text-slate-800">{validade}</span>
          </p>
          <p>
            • Prazo de entrega: <span className="font-bold text-slate-800">{prazoEntrega}</span>
          </p>
          <p className="text-xs max-w-sm mt-2">
            • Obs: Preços com impostos inclusos. Material sujeito a conferência no ato do recebimento.
          </p>
        </div>

        <div className="w-full sm:w-72 text-xs sm:text-sm bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200 space-y-1">
          <div className="flex justify-between py-1">
            <span className="text-slate-600">Peso Total Estimado:</span>
            <span className="font-bold font-mono">{formatPeso(pesoGeral)}</span>
          </div>
          {desconto > 0 && (
            <div className="flex justify-between py-1 text-red-600">
              <span>Desconto:</span>
              <span className="font-mono">- {formatMoeda(desconto)}</span>
            </div>
          )}
          {frete > 0 && (
            <div className="flex justify-between py-1">
              <span className="text-slate-600">Frete:</span>
              <span className="font-mono">+ {formatMoeda(frete)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-2 border-t border-slate-300">
            <span className="font-bold text-sm sm:text-base uppercase">Valor Total:</span>
            <span className="font-bold text-base sm:text-lg text-blue-700 font-mono">
              {formatMoeda(valorTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
