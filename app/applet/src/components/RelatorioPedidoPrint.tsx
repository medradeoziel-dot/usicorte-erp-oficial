import React from 'react';

export interface ItemRelatorio {
  idVer?: string | number;
  produto: string;
  medida: string;
  qtd: number;
  valorGeral: number;
  pesoTotal?: number;
}

interface Props {
  cliente: string;
  numeroPedido: string;
  data: string;
  itens: ItemRelatorio[];
}

export default function RelatorioPedidoPrint({ cliente, numeroPedido, data, itens }: Props) {
  const formatMoeda = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
  const formatPeso = (val?: number) =>
    val ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3 }).format(val) + " Kg" : "-";

  const valorTotal = itens.reduce((acc, item) => acc + (item.valorGeral || 0), 0);

  const ViaDocumento = ({ tipo, bgTag }: { tipo: string; bgTag: string }) => (
    <div className="w-full box-border">
      {/* Cabeçalho da Via */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-800 pb-2 mb-3 gap-2">
        <div className="flex items-center gap-3">
          <div className="leading-none">
            <span className="text-xl text-slate-900 font-bold">Usi</span>
            <span className="text-xl text-red-600 font-bold">corte</span>
            <br />
            <span className="text-xl text-slate-900">Metais</span>
          </div>
          <div className={`${bgTag} text-xs font-bold px-2 py-1 rounded text-slate-800 uppercase`}>
            {tipo}
          </div>
        </div>
        <div className="text-xs sm:text-sm font-bold text-slate-700 uppercase">
          Pedido Nº: <span className="text-slate-900 font-mono font-black">{numeroPedido}</span>
        </div>
      </div>

      {/* Dados do Cliente e Data */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm mb-3 font-medium text-slate-700 gap-1">
        <div>
          Cliente: <span className="font-bold text-slate-900 uppercase">{cliente}</span>
        </div>
        <div>
          Data: <span className="font-bold text-slate-900 font-mono">{data}</span>
        </div>
      </div>

      {/* MOBILE: Cards (< 640px) */}
      <div className="block sm:hidden space-y-2 mb-4">
        {itens.map((item, index) => (
          <div
            key={item.idVer || index}
            className="border border-slate-200 rounded p-2.5 bg-slate-50 text-xs space-y-1"
          >
            <div className="flex justify-between items-center font-bold">
              <span className="text-slate-900">{item.produto}</span>
              <span className="font-mono text-slate-900">{formatMoeda(item.valorGeral)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-600 font-mono">
              <span>Medida: {item.medida}</span>
              <span>Qtd: <strong>{item.qtd}</strong></span>
            </div>
            {item.pesoTotal ? (
              <div className="text-[11px] text-slate-500 font-mono">
                Peso: {formatPeso(item.pesoTotal)}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* DESKTOP & IMPRESSÃO: Tabela (>= 640px / print) */}
      <div className="hidden sm:block print:block overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-y-2 border-slate-300 text-slate-600">
              <th className="py-2 px-1 text-left font-bold uppercase">Material</th>
              <th className="py-2 px-1 text-center font-bold uppercase">Medidas</th>
              <th className="py-2 px-1 text-center font-bold uppercase">Qtd</th>
              <th className="py-2 px-1 text-center font-bold uppercase">Peso Total</th>
              <th className="py-2 px-1 text-right font-bold uppercase">Total</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item, index) => (
              <tr key={item.idVer || index} className="border-b border-slate-100">
                <td className="py-2 px-1 font-bold">{item.produto}</td>
                <td className="py-2 px-1 text-center text-slate-600 font-mono">{item.medida}</td>
                <td className="py-2 px-1 text-center font-bold font-mono">{item.qtd}</td>
                <td className="py-2 px-1 text-center font-medium font-mono">{formatPeso(item.pesoTotal)}</td>
                <td className="py-2 px-1 text-right font-bold font-mono">{formatMoeda(item.valorGeral)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Rodapé da Via */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-t border-slate-300 pt-4 gap-3">
        <div className="text-xs text-slate-500 w-full sm:w-1/2">
          {tipo === 'VIA DO CLIENTE' ? 'Assinatura Cliente:' : 'Vendedor / Produção:'}{' '}
          <span className="inline-block border-b border-slate-400 w-full sm:w-56 mt-1 sm:mt-0 sm:ml-2"></span>
        </div>
        <div className="text-xs sm:text-sm font-bold uppercase w-full sm:w-auto flex justify-between sm:block">
          <span>Total:</span>{' '}
          <span className="text-sm sm:text-base font-mono font-black text-slate-900 ml-1">
            {formatMoeda(valorTotal)}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full bg-white text-slate-900 font-sans print:p-0 p-4 sm:p-8 max-w-[900px] mx-auto min-h-screen flex flex-col justify-between box-border overflow-x-hidden">
      {/* Botão de Impressão (Oculto na impressão) */}
      <div className="print:hidden mb-4 flex justify-end">
        <button
          onClick={() => window.print()}
          className="bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded shadow font-bold text-xs sm:text-sm cursor-pointer transition flex items-center gap-2"
        >
          <span>🖨️</span> Imprimir Pedido
        </button>
      </div>

      {/* VIA 1: CLIENTE */}
      <ViaDocumento tipo="VIA DO CLIENTE" bgTag="bg-blue-100" />

      {/* LINHA DE CORTE */}
      <div className="relative my-8 sm:my-10 border-t-2 border-dashed border-slate-400 flex justify-center items-center">
        <span className="absolute bg-white px-3 text-[11px] sm:text-xs text-slate-500 font-bold tracking-widest uppercase flex items-center gap-1.5">
          ✂️ Corte Aqui
        </span>
      </div>

      {/* VIA 2: EMPRESA / PRODUÇÃO */}
      <ViaDocumento tipo="VIA DA EMPRESA / PRODUÇÃO" bgTag="bg-yellow-200" />
    </div>
  );
}
