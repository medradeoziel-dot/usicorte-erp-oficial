import React from 'react';
import { getObservacaoEspecificaItem, formatSafeDate } from '../../utils/calculator';
import { ItemRelatorio } from './RelatorioPropostaPrint';

interface Props {
  cliente: string;
  numeroPedido: string;
  data: string;
  itens: ItemRelatorio[];
  formaPagamento?: string;
}

export default function RelatorioPedidoPrint({ cliente, numeroPedido, data, itens, formaPagamento }: Props) {
  const formatMoeda = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);
  const formatPeso = (val?: number) =>
    val ? new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3 }).format(val) + " Kg" : "-";

  const totalTiposItens = itens.length;
  const totalPecas = itens.reduce((acc, item) => acc + Number(item.qtd || 0), 0);
  const valorTotal = itens.reduce((acc, item) => acc + (item.valorGeral || 0), 0);

  const getItemDate = (item: ItemRelatorio) => {
    const rawDate = item.created_at || item.data || item.date || (item as any).createdAt || data;
    return formatSafeDate(rawDate);
  };

  const ViaDocumento = ({ tipo, bgTag }: { tipo: string; bgTag: string }) => (
    <div className="w-full box-border via-pedido flex flex-col justify-between" style={{ minHeight: '44vh', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
      <div>
        {/* Cabeçalho da Via */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-slate-800 pb-1.5 mb-2 gap-1">
          <div className="flex items-center gap-2">
            <div className="leading-none">
              <span className="text-base sm:text-lg text-slate-900 font-bold">Usi</span>
              <span className="text-base sm:text-lg text-red-600 font-bold">corte</span>
              <span className="text-base sm:text-lg text-slate-900 font-medium ml-1">Metais</span>
            </div>
            <div className={`${bgTag} text-[10px] font-bold px-2 py-0.5 rounded text-slate-800 uppercase`}>
              {tipo}
            </div>
          </div>
          <div className="text-[11px] sm:text-xs font-bold text-slate-700 uppercase">
            Pedido Nº: <span className="text-slate-900 font-mono font-black">{numeroPedido}</span>
          </div>
        </div>

        {/* Dados do Cliente e Data */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[11px] mb-2 font-medium text-slate-700 gap-1 bg-slate-50 p-1.5 rounded border border-slate-200">
          <div>
            Cliente: <span className="font-bold text-slate-900 uppercase">{cliente}</span>
          </div>
          <div className="flex gap-4">
            {formaPagamento && <div>Pagamento: <strong className="text-slate-900">{formaPagamento}</strong></div>}
            <div>Data: <span className="font-bold text-slate-900 font-mono">{data}</span></div>
          </div>
        </div>

        {/* DESKTOP & IMPRESSÃO: Tabela */}
        <div className="overflow-x-auto mb-2">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-y border-slate-300 bg-slate-100 text-slate-700 text-[10px]">
                <th className="py-1 px-1.5 text-left font-bold uppercase">Material</th>
                <th className="py-1 px-1.5 text-center font-bold uppercase">Medidas</th>
                <th className="py-1 px-1.5 text-center font-bold uppercase">Qtd</th>
                <th className="py-1 px-1.5 text-center font-bold uppercase">Peso Total</th>
                <th className="py-1 px-1.5 text-right font-bold uppercase">Total</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item, index) => {
                const obsItem = getObservacaoEspecificaItem(item);
                return (
                  <tr key={item.idVer || index} className="border-b border-slate-100">
                    <td className="py-1 px-1.5 font-bold">
                      <div>
                        <div style={{ fontWeight: 'bold' }} className="leading-tight text-slate-900">
                          {item.produto}
                        </div>
                        {item.descricao && item.descricao.trim().toLowerCase() !== item.produto.trim().toLowerCase() && (
                          <div className="text-[10px] text-slate-600 font-semibold leading-tight mt-0.5">
                            {item.descricao}
                          </div>
                        )}
                        <div
                          className="medida-obs"
                          style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '1px', lineHeight: '1.1' }}
                        >
                          {getItemDate(item)}
                        </div>
                      </div>
                    </td>
                    <td className="py-1 px-1.5 text-center text-slate-600 font-mono text-[10px]">
                      <div className="medida-bloco-center flex flex-col items-center justify-center">
                        <span className="medida-dimensao font-bold font-mono text-slate-900 leading-tight">{item.medida}</span>
                        {obsItem && (
                          <span className="medida-obs text-[9px] text-slate-500 italic font-sans leading-tight mt-0.5">{obsItem}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-1 px-1.5 text-center font-bold font-mono">{item.qtd}</td>
                    <td className="py-1 px-1.5 text-center font-medium font-mono text-[10px]">{formatPeso(item.pesoTotal)}</td>
                    <td className="py-1 px-1.5 text-right font-bold font-mono text-slate-900">{formatMoeda(item.valorGeral)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rodapé da Via com Totais de Itens, Peças e Valor */}
      <div>
        <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-slate-400 font-bold text-xs">
          <div className="flex gap-4 text-slate-700">
            <span>ITENS: <strong className="text-slate-900">{totalTiposItens}</strong></span>
            <span>TOTAL PEÇAS: <strong className="text-slate-900">{totalPecas} PÇ</strong></span>
          </div>
          <div className="text-xs sm:text-sm">
            TOTAL: <strong className="text-slate-900 font-mono font-black">{formatMoeda(valorTotal)}</strong>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end border-t border-slate-200 pt-1 mt-1 gap-1 text-[11px]">
          <div className="text-[10px] text-slate-500 w-full sm:w-1/2">
            {tipo === 'VIA DO CLIENTE' ? 'Assinatura Cliente:' : 'Vendedor / Produção:'}{' '}
            <span className="inline-block border-b border-slate-400 w-full sm:w-48 mt-1 sm:mt-0 sm:ml-2"></span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="print-container w-full bg-white text-slate-900 font-sans print:p-0 p-2 sm:p-4 max-w-[900px] mx-auto min-h-screen flex flex-col justify-between box-border overflow-hidden secao-pedido modelo-duas-vias">
      {/* 1ª Via: VIA CLIENTE */}
      <ViaDocumento tipo="VIA DO CLIENTE" bgTag="bg-blue-100" />

      {/* Linha de separação / corte */}
      <div className="border-t-2 border-dashed border-slate-400 my-4 relative text-center">
        <span className="bg-white px-3 text-[10px] font-bold text-slate-500 font-mono absolute -top-2.5 left-1/2 -translate-x-1/2">
          ✂ -------------------------------- CORTE AQUI -------------------------------- ✂
        </span>
      </div>

      {/* 2ª Via: VIA EXPEDIÇÃO / PRODUÇÃO */}
      <ViaDocumento tipo="VIA EXPEDIÇÃO / PRODUÇÃO" bgTag="bg-amber-100" />
    </div>
  );
}
