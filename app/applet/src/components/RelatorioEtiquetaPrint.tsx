import React from 'react';

export interface ItemRelatorio {
  idVer?: string | number;
  produto: string;
  medida: string;
  qtd: number;
}

interface Props {
  cliente: string;
  numeroPedido: string;
  itens: ItemRelatorio[];
}

export default function RelatorioEtiquetaPrint({ cliente, numeroPedido, itens }: Props) {
  return (
    <div className="w-full bg-slate-50 text-slate-900 font-sans print:bg-white print:p-0 p-4 sm:p-8 max-w-5xl mx-auto box-border overflow-x-hidden">
      {/* Botão de Impressão (Oculto na impressão) */}
      <div className="print:hidden mb-6 flex justify-between sm:justify-end items-center gap-3">
        <span className="text-xs text-slate-500 font-semibold sm:hidden">
          {itens.length} {itens.length === 1 ? 'etiqueta' : 'etiquetas'}
        </span>
        <button
          onClick={() => window.print()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded shadow font-bold text-xs sm:text-sm cursor-pointer transition flex items-center gap-2"
        >
          <span>🏷️</span> Imprimir Etiquetas
        </button>
      </div>

      {/* Grade de Etiquetas (1 coluna no mobile, 2 colunas no desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        {itens.map((item, index) => (
          <div
            key={item.idVer || index}
            className="border-2 border-slate-900 rounded-xl bg-white p-4 sm:p-6 relative flex flex-col justify-between shadow-sm print:shadow-none"
            style={{ width: '100%', minHeight: '360px' }}
          >
            {/* Topo da Etiqueta */}
            <div className="text-center mb-3 sm:mb-4 border-b border-slate-200 pb-2">
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-slate-900">
                Usicorte Metais
              </h1>
              <h2 className="text-xs sm:text-sm font-bold text-slate-600 mt-0.5 uppercase">
                Pedido Nº: <span className="text-blue-700 font-mono">{numeroPedido}</span>
              </h2>
            </div>

            {/* Conteúdo: Dados à esquerda, Esquema Técnico à direita */}
            <div className="flex-1 flex flex-row gap-3 sm:gap-4 my-2">
              {/* Informações da Peça */}
              <div className="w-1/2 flex flex-col justify-start gap-2.5 text-left">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Empresa:</p>
                  <p className="font-bold text-xs sm:text-sm leading-tight uppercase text-slate-900 break-words">
                    {cliente}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Material:</p>
                  <p className="text-base sm:text-lg font-black uppercase text-slate-900">
                    {item.produto}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Medida:</p>
                  <p className="text-sm sm:text-base font-bold leading-tight text-slate-800 font-mono">
                    {item.medida}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase">Qtd:</p>
                  <p className="text-base sm:text-xl font-black text-slate-900">
                    {item.qtd} PÇ
                  </p>
                </div>
              </div>

              {/* Esquema Técnico / Gabarito de Usinagem */}
              <div className="w-1/2 border-2 border-dashed border-slate-400 rounded-lg flex items-center justify-center relative bg-slate-50 p-2 min-h-[140px]">
                <div className="w-full h-full border border-slate-200 bg-white flex flex-col items-center justify-center relative shadow-xs p-2">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-slate-400 flex items-center justify-center bg-slate-100 z-10">
                    <span className="text-[9px] sm:text-[10px] text-slate-600 font-bold whitespace-nowrap">
                      Ø 70 mm
                    </span>
                  </div>
                  <div className="absolute border-t border-dashed border-slate-300 w-full top-1/2 -translate-y-1/2"></div>
                  <div className="absolute border-l border-dashed border-slate-300 h-full left-1/2 -translate-x-1/2"></div>
                  <span className="absolute bottom-1.5 text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase tracking-wider text-center">
                    Corte / Usinagem CNC
                  </span>
                </div>
              </div>
            </div>

            {/* Rodapé da Etiqueta */}
            <div className="mt-3 sm:mt-4 border-t-2 border-slate-900 pt-1.5 text-center">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-700">
                Identificação de Peça / Usicorte Metais
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
