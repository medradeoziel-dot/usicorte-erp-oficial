import React from 'react';

export interface ItemRelatorio {
  idVer?: string | number;
  data: string;
  produto: string;
  medida: string;
  descricao: string;
  qtd: number;
  unitario: number;
  valorGeral: number;
  observacao?: string;
  pesoTotal?: number;
}

interface Props {
  itens: ItemRelatorio[];
}

export default function RelatorioEmpresaPrint({ itens }: Props) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
  };

  const valorTotal = itens.reduce((acc, item) => acc + (item.valorGeral || 0), 0);

  return (
    <div className="w-full bg-white text-black font-sans print:p-0 p-4 sm:p-8 max-w-[1000px] mx-auto box-border overflow-x-hidden">
      <div className="print:hidden mb-6 flex justify-between sm:justify-end items-center gap-3">
        <span className="text-xs text-slate-500 font-semibold sm:hidden">
          {itens.length} {itens.length === 1 ? 'registro' : 'registros'}
        </span>
        <button
          onClick={() => window.print()}
          className="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded shadow font-bold text-xs sm:text-sm cursor-pointer transition flex items-center gap-2"
        >
          <span>🖨️</span> Imprimir Relatório Empresa
        </button>
      </div>

      {/* MOBILE: Cards (< 640px) */}
      <div className="block sm:hidden space-y-3 mb-6">
        {itens.map((item, index) => (
          <div key={item.idVer || index} className="border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-1.5 text-xs">
            <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
              <span className="font-bold text-slate-900 text-sm">{item.produto}</span>
              <span className="text-slate-500 text-[11px] font-mono">{item.data}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-700">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Medida</span>
                <span className="font-semibold">{item.medida}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Código / Obs</span>
                <span>{item.observacao || '-'}</span>
              </div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold">Descrição</span>
              <span className="text-slate-700">{item.descricao}</span>
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
            {itens.map((item, index) => (
              <tr key={item.idVer || index} className="odd:bg-white even:bg-slate-50 text-slate-900 border-b border-slate-100">
                <td className="py-2 px-1 text-center whitespace-nowrap font-mono text-xs">{item.data}</td>
                <td className="py-2 px-1 text-center font-medium">{item.produto}</td>
                <td className="py-2 px-1 text-center font-mono text-xs">{item.medida}</td>
                <td className="py-2 px-1 text-center">{item.descricao}</td>
                <td className="py-2 px-1 text-center">{item.observacao || '-'}</td>
                <td className="py-2 px-1 text-center font-bold font-mono">{item.qtd}</td>
                <td className="py-2 px-1 text-center whitespace-nowrap font-mono">{formatCurrency(item.unitario)}</td>
                <td className="py-2 px-1 text-center font-bold whitespace-nowrap font-mono">{formatCurrency(item.valorGeral)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-4 pt-3 border-t border-slate-300 gap-2">
        <div className="font-bold text-xs sm:text-sm text-slate-700">
          Quantidade de Registros: <span className="ml-2 font-black text-slate-900">{itens.length}</span>
        </div>
        <div className="font-bold text-xs sm:text-sm text-slate-800 w-full sm:w-auto flex justify-between sm:block">
          <span>VALOR TOTAL:</span> <span className="ml-2 text-blue-700 font-black text-sm sm:text-base font-mono">{formatCurrency(valorTotal)}</span>
        </div>
      </div>
    </div>
  );
}
