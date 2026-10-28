import React from 'react';
import { getObservacaoEspecificaItem, formatSafeDate, formatItemDescription, formatarMedidasLimpa } from '../../utils/calculator';
import { ItemRelatorio } from './RelatorioPropostaPrint';

interface Props {
  itens: ItemRelatorio[];
  cliente?: string;
  numeroPedido?: string;
  data?: string;
}

export default function RelatorioCortePrint({ itens, cliente, numeroPedido, data }: Props) {
  const totalTiposItens = itens.length;
  const totalPecas = itens.reduce((acc, item) => acc + Number(item.qtd || 0), 0);

  const getItemDate = (item: ItemRelatorio) => {
    const rawDate = item.created_at || item.data || item.date || (item as any).createdAt || data || new Date();
    return formatSafeDate(rawDate);
  };

  return (
    <div className="print-container ordem-corte-a4-container w-full bg-white text-black font-sans print:p-0 p-4 sm:p-8 max-w-[210mm] mx-auto box-border overflow-x-hidden print:overflow-visible print:h-auto print:max-h-none secao-corte">
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

          .ordem-corte-a4-container table {
            width: 100% !important;
            page-break-inside: auto;
          }

          .ordem-corte-a4-container tr {
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Cabeçalho Corte CNC */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-3 gap-2 border-b-2 border-slate-900 pb-2">
        <div className="leading-tight">
          <div className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <span>✂️</span> Usi<span className="text-red-600">corte</span> Metais
          </div>
          <div className="text-xs text-slate-700 font-bold uppercase tracking-wide">
            Ordem de Produção / Ficha Técnica de Corte CNC
          </div>
        </div>
        <div className="text-left sm:text-right text-xs font-bold text-slate-700">
          {numeroPedido && (
            <p>ORDEM / COTAÇÃO: <span className="font-mono text-red-600 font-black text-sm">{numeroPedido}</span></p>
          )}
          <p>DATA: <span className="font-mono text-slate-900">{data || new Date().toLocaleDateString('pt-BR')}</span></p>
        </div>
      </div>

      {cliente && (
        <div className="bg-slate-100 border border-slate-300 p-2 rounded mb-3 text-xs flex justify-between items-center">
          <div><span className="font-bold text-slate-600">CLIENTE / DESTINO:</span> <strong className="text-slate-900">{cliente}</strong></div>
          <span className="text-[11px] font-bold text-red-700 uppercase bg-red-50 border border-red-200 px-2 py-0.5 rounded">SETOR DE CORTE CNC</span>
        </div>
      )}

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
                Qtd: {item.qtd} PÇ
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-slate-700">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Medida de Corte</span>
                <div className="medida-bloco flex flex-col">
                  <span className="font-mono font-bold text-slate-900">{formatarMedidasLimpa(item) || item.medida}</span>
                  {getObservacaoEspecificaItem(item) && (
                    <span className="medida-obs text-[9.5px] text-slate-500 italic mt-0.5">{getObservacaoEspecificaItem(item)}</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Código / Tolerância</span>
                <span className="font-mono">{getObservacaoEspecificaItem(item) || '-'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Descrição</span>
              <span className="text-slate-800">{formatItemDescription(item)}</span>
            </div>

            <div className="pt-2 border-t border-dashed border-slate-300">
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Visto Operador / Máquina:</span>
              <div className="h-6 border-b border-slate-300"></div>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP & IMPRESSÃO: Tabela (>= 640px / print) */}
      <div className="hidden sm:block print:block overflow-x-hidden">
        <table className="w-full text-xs border-collapse table-fixed">
          <thead>
            <tr className="bg-slate-100 print:bg-slate-200">
              <th className="border border-black p-1.5 text-left font-bold uppercase text-[11px] w-[20%]">Observação</th>
              <th className="border border-black p-1.5 text-left font-bold uppercase text-[11px] w-[24%]">Produto / Material</th>
              <th className="border border-black p-1.5 text-left font-bold uppercase text-[11px] w-[22%]">Medidas</th>
              <th className="border border-black p-1.5 text-left font-bold uppercase text-[11px] w-[20%]">Descrição</th>
              <th className="border border-black p-1.5 text-center font-bold uppercase text-[11px] w-[7%]">Qtd</th>
              <th className="border border-black p-1.5 text-center font-bold uppercase text-[11px] w-[7%]">Cortado</th>
            </tr>
          </thead>
          
          <tbody>
            {itens.map((item, index) => {
              const obsItem = getObservacaoEspecificaItem(item);
              return (
                <tr key={item.idVer || index} className="text-gray-900" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td className="border border-black p-1.5 text-left font-bold uppercase text-[11px] break-words">{obsItem || '-'}</td>
                  <td className="border border-black p-1.5 text-left font-bold uppercase text-[11px]">
                    <div>
                      <div className="leading-tight text-slate-900">
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
                  <td className="border border-black p-1.5 text-left">
                    <div className="medida-bloco flex flex-col">
                      <span className="medida-dimensao font-bold font-mono text-slate-900 leading-tight">
                        {formatarMedidasLimpa(item) || item.medida}
                      </span>
                      {obsItem && (
                        <span className="medida-obs text-[9.5px] text-slate-500 italic font-sans leading-tight mt-0.5">{obsItem}</span>
                      )}
                    </div>
                  </td>
                  <td className="border border-black p-1.5 text-left uppercase text-[10px] text-gray-700 break-words">{formatItemDescription(item)}</td>
                  <td className="border border-black p-1.5 text-center font-black font-mono text-xs">{item.qtd}</td>
                  <td className="border border-black p-1.5 text-center">
                    <div className="w-4 h-4 border border-black mx-auto"></div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center mt-3 pt-2 border-t-2 border-slate-400 font-bold text-xs">
        <div className="flex gap-4 text-slate-700">
          <span>ITENS PARA CORTE: <strong className="text-slate-900">{totalTiposItens}</strong></span>
          <span>TOTAL DE PEÇAS A CORTAR: <strong className="text-slate-900">{totalPecas} PÇ</strong></span>
        </div>
      </div>

      {/* Apontamento de Produção */}
      <div className="mt-6 p-3 border border-slate-300 rounded bg-slate-50 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
        <div>
          <span className="font-bold block text-[10px] uppercase text-slate-500">Máquina / Equipamento:</span>
          <div className="h-6 border-b border-slate-400 mt-1"></div>
        </div>
        <div>
          <span className="font-bold block text-[10px] uppercase text-slate-500">Operador Responsável:</span>
          <div className="h-6 border-b border-slate-400 mt-1"></div>
        </div>
        <div>
          <span className="font-bold block text-[10px] uppercase text-slate-500">Conferência / CQ:</span>
          <div className="h-6 border-b border-slate-400 mt-1"></div>
        </div>
      </div>
    </div>
  );
}
