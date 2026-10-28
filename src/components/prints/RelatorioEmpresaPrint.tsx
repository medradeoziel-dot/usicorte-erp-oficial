import React from 'react';
import { getObservacaoEspecificaItem, formatSafeDate, formatItemDescription, formatarMedidasLimpa } from '../../utils/calculator';
import { ItemRelatorio } from './RelatorioPropostaPrint';

interface Props {
  itens: ItemRelatorio[];
  cliente?: string;
  numeroProposta?: string;
  data?: string;
}

export default function RelatorioEmpresaPrint({ itens, cliente, numeroProposta, data }: Props) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
  };

  const totalTiposItens = itens.length;
  const totalPecas = itens.reduce((acc, item) => acc + Number(item.qtd || 0), 0);
  const valorTotal = itens.reduce((acc, item) => acc + (item.valorGeral || 0), 0);

  return (
    <div className="print-container w-full bg-white text-black font-sans print:p-0 p-4 sm:p-8 max-w-[1000px] mx-auto box-border overflow-x-hidden print:overflow-visible print:h-auto print:max-h-none secao-proposta-resumida">
      {/* Cabeçalho Empresa */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-3 gap-2 border-b-2 border-slate-900 pb-2">
        <div className="leading-tight">
          <div className="text-2xl font-bold text-slate-900">
            Usi<span className="text-red-600">corte</span> Metais
          </div>
          <div className="text-xs text-slate-600 font-semibold uppercase">
            Via Interna da Empresa / Controle de Produção
          </div>
        </div>
        <div className="text-left sm:text-right text-xs font-bold text-slate-700">
          {numeroProposta && <p>COTAÇÃO / PEDIDO: <span className="font-mono text-blue-700">{numeroProposta}</span></p>}
          <p>DATA DE EMISSÃO: <span className="font-mono text-slate-900">{data || new Date().toLocaleDateString('pt-BR')}</span></p>
        </div>
      </div>

      {cliente && (
        <div className="bg-slate-100 border border-slate-300 p-2 rounded mb-3 text-xs flex justify-between items-center">
          <div><span className="font-bold text-slate-600">CLIENTE:</span> <strong className="text-slate-900">{cliente}</strong></div>
          <span className="text-[11px] font-bold text-slate-500 uppercase bg-white px-2 py-0.5 rounded border border-slate-200">USO INTERNO</span>
        </div>
      )}

      {/* MOBILE: Cards (< 640px) */}
      <div className="block sm:hidden space-y-3 mb-6">
        {itens.map((item, index) => (
          <div key={item.idVer || index} className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-1.5 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-900 text-sm">{item.produto}</span>
              <span className="text-slate-500 text-[11px] font-mono">{item.data || data}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-700">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Medida</span>
                <span className="font-semibold font-mono">{formatarMedidasLimpa(item) || item.medida}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Código / Obs</span>
                <span>{getObservacaoEspecificaItem(item) || item.observacao || item.info || '-'}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Descrição</span>
              <span className="text-slate-700">{formatItemDescription(item)}</span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
              <span className="text-slate-600">Qtd: <strong>{item.qtd}</strong> | Unit: {formatCurrency(item.unitario)}</span>
              <strong className="text-slate-950 font-bold text-sm font-mono">{formatCurrency(item.valorGeral)}</strong>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP & IMPRESSÃO: Tabela (>= 640px / print) */}
      <div className="hidden sm:block print:block overflow-x-auto">
        <table className="w-full text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="bg-slate-200 border-y border-slate-300 text-slate-800">
              <th className="py-2 px-1 text-center font-semibold uppercase whitespace-nowrap">Data</th>
              <th className="py-2 px-1 text-center font-semibold uppercase">Produto</th>
              <th className="py-2 px-1 text-center font-semibold uppercase">Medida</th>
              <th className="py-2 px-1 text-center font-semibold uppercase">Descrição</th>
              <th className="py-2 px-1 text-center font-semibold uppercase whitespace-nowrap">Código</th>
              <th className="py-2 px-1 text-center font-semibold uppercase">Qtd</th>
              <th className="py-2 px-1 text-center font-semibold uppercase whitespace-nowrap">Unitário</th>
              <th className="py-2 px-1 text-center font-semibold uppercase whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, index) => {
              const obsItem = getObservacaoEspecificaItem(item);
              return (
                <tr key={item.idVer || index} className="odd:bg-white even:bg-slate-50 text-slate-900 border-b border-slate-100" style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                  <td className="py-2 px-1 text-center whitespace-nowrap font-mono text-xs">{item.data || data || '-'}</td>
                  <td className="py-2 px-1 text-center font-medium">
                    <div>
                      <div style={{ fontWeight: 'bold' }} className="leading-tight">
                        {item.produto}
                      </div>
                      <div
                        className="medida-obs"
                        style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                      >
                        {formatSafeDate(item.data || (item as any).created_at || (item as any).createdAt || data || new Date())}
                      </div>
                    </div>
                  </td>
                  <td className="py-2 px-1 text-center font-mono text-xs">
                    <div className="medida-bloco-center flex flex-col items-center justify-center">
                      <span className="medida-dimensao font-bold font-mono text-slate-900 leading-tight">
                        {formatarMedidasLimpa(item) || item.medida}
                      </span>
                      {obsItem && (
                        <span className="medida-obs text-[9px] text-slate-500 italic font-sans leading-tight mt-0.5">{obsItem}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-1 text-center">{formatItemDescription(item)}</td>
                  <td className="py-2 px-1 text-center">{obsItem || item.observacao || item.info || '-'}</td>
                  <td className="py-2 px-1 text-center font-bold font-mono">{item.qtd}</td>
                  <td className="py-2 px-1 text-center whitespace-nowrap font-mono">{formatCurrency(item.unitario)}</td>
                  <td className="py-2 px-1 text-center font-bold whitespace-nowrap font-mono">{formatCurrency(item.valorGeral)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-3 pt-2 border-t-2 border-slate-400 font-bold text-xs gap-2">
        <div className="flex gap-4 text-slate-700">
          <span>ITENS: <strong className="text-slate-900">{totalTiposItens}</strong></span>
          <span>TOTAL PEÇAS: <strong className="text-slate-900">{totalPecas} PÇ</strong></span>
        </div>
        <div className="text-sm">
          TOTAL: <strong className="text-slate-900 font-mono font-black">{formatCurrency(valorTotal)}</strong>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-dashed border-slate-300 grid grid-cols-2 gap-8 text-[11px] text-slate-600">
        <div>
          <span>Visto do Vendedor / Responsável:</span>
          <div className="border-b border-slate-400 mt-6"></div>
        </div>
        <div>
          <span>Visto da Produção / Expedição:</span>
          <div className="border-b border-slate-400 mt-6"></div>
        </div>
      </div>
    </div>
  );
}
