import React from 'react';
import { getObservacaoEspecificaItem, formatSafeDate } from '../../../../src/utils/calculator';

export interface ItemRelatorio {
  idVer?: string | number;
  produto: string;
  medida: string;
  descricao: string;
  qtd: number;
  observacao?: string;
  created_at?: string;
  data?: string;
  date?: string;
}

interface Props {
  itens: ItemRelatorio[];
}

export default function RelatorioCortePrint({ itens }: Props) {
  const totalTiposItens = itens.length;
  const totalPecas = itens.reduce((acc, item) => acc + Number(item.qtd || 0), 0);

  const getItemDate = (item: ItemRelatorio) => {
    const rawDate = item.created_at || item.data || item.date || (item as any).createdAt || new Date();
    return formatSafeDate(rawDate);
  };

  return (
    <div className="ordem-corte-a4-container w-full bg-white text-black font-sans print:p-0 p-4 sm:p-8 max-w-[210mm] mx-auto box-border overflow-x-hidden">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          body, .ordem-corte-a4-container {
            width: 100% !important;
            max-width: 210mm !important;
            margin: 0 auto !important;
          }
        }
      `}</style>
      <div className="print:hidden mb-6 flex justify-between sm:justify-end items-center gap-3">
        <span className="text-xs text-slate-500 font-semibold sm:hidden">
          {itens.length} {itens.length === 1 ? 'item' : 'itens'} para corte
        </span>
        <button
          onClick={() => window.print()}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow font-bold text-xs sm:text-sm cursor-pointer transition flex items-center gap-2"
        >
          <span>✂️</span> Imprimir Ordem de Corte
        </button>
      </div>

      {/* MOBILE: Cards (< 640px) */}
      <div className="block sm:hidden space-y-3 mb-6">
        {itens.map((item, index) => (
          <div key={item.idVer || index} className="border-2 border-slate-900 rounded-lg p-3 bg-white space-y-2 text-xs">
            <div className="flex justify-between items-start border-b border-slate-200 pb-1.5">
              <div>
                <div style={{ fontWeight: 'bold' }} className="text-slate-900 text-sm leading-tight">
                  {item.produto}
                </div>
                <div
                  className="medida-obs"
                  style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                >
                  {getItemDate(item)}
                </div>
              </div>
              <span className="bg-slate-100 border border-slate-300 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
                Qtd: {item.qtd}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-700">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Medida</span>
                <div className="medida-bloco flex flex-col">
                  <span className="font-mono font-semibold text-slate-900">{item.medida}</span>
                  {getObservacaoEspecificaItem(item) && (
                    <span className="medida-obs text-[9.5px] text-slate-500 italic mt-0.5">{getObservacaoEspecificaItem(item)}</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Código</span>
                <span className="font-mono">{getObservacaoEspecificaItem(item) || '-'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Descrição</span>
              <span className="text-slate-800">{item.descricao}</span>
            </div>

            <div className="pt-2 border-t border-dashed border-slate-300">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Visto Produção / Conferência:</span>
              <div className="h-6 border-b border-slate-300"></div>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP & IMPRESSÃO: Tabela (>= 640px / print) */}
      <div className="hidden sm:block print:block overflow-x-auto">
        <table className="w-full text-xs sm:text-sm border-separate" style={{ borderSpacing: '0 8px' }}>
          <thead>
            <tr>
              <th className="border-b border-black pb-2 text-center font-bold uppercase">Código</th>
              <th className="border-b border-black pb-2 text-center font-bold uppercase">Produto</th>
              <th className="border-b border-black pb-2 text-center font-bold uppercase">Medida</th>
              <th className="border-b border-black pb-2 text-center font-bold uppercase">Descrição</th>
              <th className="border-b border-black pb-2 text-center font-bold uppercase">Qtd</th>
              <th className="border-b border-black pb-2 w-3"></th>
              <th className="border-b border-black pb-2 text-center font-bold uppercase w-32">Observação</th>
            </tr>
          </thead>
          
          <tbody>
            {itens.map((item, index) => {
              const obsItem = getObservacaoEspecificaItem(item);
              return (
                <tr key={item.idVer || index} className="text-gray-900">
                  <td className="border-y border-l border-black py-2 px-2 text-center whitespace-nowrap font-mono">{obsItem || '-'}</td>
                  <td className="border-y border-black py-2 px-2 text-center font-medium">
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
                  <td className="border-y border-black py-2 px-2 text-center font-mono">
                    <div className="medida-bloco-center flex flex-col items-center justify-center">
                      <span className="medida-dimensao font-bold font-mono text-slate-900 leading-tight">{item.medida}</span>
                      {obsItem && (
                        <span className="medida-obs text-[9.5px] text-slate-500 italic font-sans leading-tight mt-0.5">{obsItem}</span>
                      )}
                    </div>
                  </td>
                  <td className="border-y border-black py-2 px-2 text-center">{item.descricao}</td>
                  <td className="border-y border-r border-black py-2 px-2 text-center font-bold font-mono text-sm">{item.qtd}</td>
                  <td className="border-transparent"></td>
                  <td className="border border-black py-2 px-2"></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-400 font-bold text-xs">
        <div className="flex gap-4 text-slate-700">
          <span>ITENS: <strong className="text-slate-900">{totalTiposItens}</strong></span>
          <span>TOTAL PEÇAS: <strong className="text-slate-900">{totalPecas} PÇ</strong></span>
        </div>
      </div>
    </div>
  );
}
