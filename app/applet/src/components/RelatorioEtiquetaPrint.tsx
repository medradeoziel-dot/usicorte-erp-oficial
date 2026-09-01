import React from 'react';
import EtiquetaDesenho from '../../../../src/components/EtiquetaDesenho';

export interface ItemRelatorio {
  idVer?: string | number;
  produto: string;
  medida: string;
  qtd: number;
  observacao?: string;
  descricao?: string;
  imagem?: string;
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12mm]">
        {itens.map((item, index) => (
          <div
            key={item.idVer || index}
            className="etiqueta-card border-2 border-slate-900 rounded-xl bg-white relative flex flex-col justify-between shadow-sm print:shadow-none"
            style={{ 
              width: '100%', 
              minHeight: '340px',
              padding: '8px',
              marginBottom: '12mm',
              breakInside: 'avoid',
              pageBreakInside: 'avoid',
              boxSizing: 'border-box'
            }}
          >
            {/* Topo da Etiqueta */}
            <div className="text-center mb-2 pb-1.5 border-b border-slate-300">
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-wide text-slate-900">
                Usicorte Metais
              </h1>
              <h2 className="text-[11px] sm:text-xs font-bold text-slate-600 mt-0.5 uppercase">
                Pedido Nº: <span className="text-blue-700 font-mono">{numeroPedido}</span>
              </h2>
            </div>

            {/* Conteúdo: Dados à esquerda, Esquema Técnico à direita */}
            <div className="flex-1 flex flex-row gap-2.5 my-1.5 items-stretch">
              {/* Informações da Peça */}
              <div className="w-1/2 flex flex-col justify-start gap-1.5 text-left">
                <div>
                  <p className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 uppercase">Empresa:</p>
                  <p className="font-bold text-[11px] sm:text-xs leading-tight uppercase text-slate-900 break-words">
                    {cliente}
                  </p>
                </div>
                <div>
                  <p className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 uppercase">Material:</p>
                  <p className="text-xs sm:text-sm font-black uppercase text-slate-900">
                    {item.produto}
                  </p>
                </div>
                <div>
                  <p className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 uppercase">Medida:</p>
                  <p className="text-xs sm:text-sm font-bold leading-tight text-slate-800 font-mono">
                    {item.medida}
                  </p>
                </div>
                <div>
                  <p className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 uppercase">Qtd:</p>
                  <p className="text-xs sm:text-sm font-black text-slate-900">
                    {item.qtd} PÇ
                  </p>
                </div>
                {item.observacao && (
                  <div>
                    <p className="text-[9.5px] sm:text-[10px] font-bold text-slate-500 uppercase">Obs:</p>
                    <p className="text-[10.5px] font-semibold text-slate-700 italic">
                      {item.observacao}
                    </p>
                  </div>
                )}
              </div>

              {/* Esquema Técnico / Gabarito de Usinagem Nítido */}
              <div className="w-1/2 border-2 border-dashed border-slate-400 rounded-lg flex items-center justify-center relative bg-slate-50 p-1 min-h-[110px] overflow-hidden">
                <EtiquetaDesenho
                  material={item.produto}
                  medida={item.medida}
                  observacao={item.observacao}
                  descricao={item.descricao || item.produto}
                  imagem={item.imagem}
                  engrossarTracos={true}
                />
              </div>
            </div>

            {/* Rodapé da Etiqueta */}
            <div className="mt-auto border-t border-slate-900 pt-1.5 pb-0.5 text-center">
              <span className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-700 block">
                www.usicortemetais.com.br
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
