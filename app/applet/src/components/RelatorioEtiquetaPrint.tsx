import React from "react";

export interface ItemRelatorio {
  idVer?: string | number;
  produto: string;
  medida: string;
  qtd: number;
  observacao?: string;
}

interface Props {
  cliente: string;
  numeroPedido: string;
  itens: ItemRelatorio[];
}

export default function RelatorioEtiquetaPrint({
  cliente,
  numeroPedido,
  itens,
}: Props) {
  return (
    <div className="w-full min-h-screen bg-background text-foreground font-sans print:bg-white print:p-0 p-4 sm:p-8 max-w-5xl mx-auto box-border overflow-x-hidden">
      {/* Botão de Impressão (Oculto na impressão) */}
      <div className="print:hidden mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-end">
        <span className="text-xs text-muted-foreground font-semibold sm:hidden truncate">
          {itens.length} {itens.length === 1 ? "etiqueta" : "etiquetas"}
        </span>
        <button
          onClick={() => window.print()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded shadow font-bold text-xs sm:text-sm cursor-pointer transition flex items-center gap-2 shrink-0"
        >
          <span>🏷️</span> Imprimir Etiquetas
        </button>
      </div>

      {/* Grade de Etiquetas (1 coluna no mobile, 2 colunas no desktop) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 print:grid-cols-2 print:gap-0">
        {itens.map((item, index) => (
          <div
            key={item.idVer || index}
            className="etiqueta-pagina border-2 border-foreground rounded-xl bg-card p-4 sm:p-5 relative flex flex-col justify-between shadow-sm print:shadow-none print:rounded-none print:border-0 print:w-[204mm] print:h-[291mm] print:overflow-hidden print:mx-auto print:my-0"
            style={{ width: "100%", minHeight: "360px" }}
          >
            {/* Topo da Etiqueta */}
            <div className="text-center mb-3 sm:mb-4 border-b border-border pb-2 print:mb-6">
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-card-foreground print:text-3xl">
                Usicorte Metais
              </h1>
              <h2 className="text-xs sm:text-sm font-bold text-muted-foreground mt-0.5 uppercase print:text-base">
                Pedido Nº:{" "}
                <span className="text-primary font-mono">{numeroPedido}</span>
              </h2>
            </div>

            {/* Conteúdo: Dados à esquerda, Esquema Técnico à direita */}
            <div className="flex-1 flex flex-row gap-3 sm:gap-4 my-2 print:gap-6 print:my-4">
              {/* Informações da Peça */}
              <div className="w-1/2 flex flex-col justify-start gap-2.5 text-left print:gap-4">
                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase print:text-sm">
                    Empresa / Cliente:
                  </p>
                  <p className="font-bold text-xs sm:text-sm leading-tight uppercase text-card-foreground break-words print:text-base">
                    {cliente}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase print:text-sm">
                    Material:
                  </p>
                  <p className="text-base sm:text-lg font-black uppercase text-card-foreground print:text-xl">
                    {item.produto}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase print:text-sm">
                    Medida:
                  </p>
                  <p className="text-sm sm:text-base font-bold leading-tight text-foreground font-mono print:text-lg">
                    {item.medida}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase print:text-sm">
                    Qtd:
                  </p>
                  <p className="text-base sm:text-xl font-black text-card-foreground print:text-2xl">
                    {item.qtd} PC
                  </p>
                </div>

                {item.observacao && (
                  <div>
                    <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase print:text-sm">
                      Observação:
                    </p>
                    <p className="text-xs sm:text-sm font-bold italic text-foreground break-words print:text-base">
                      {item.observacao}
                    </p>
                  </div>
                )}
              </div>

              {/* Esquema Técnico / Gabarito de Usinagem */}
              <div className="w-1/2 border-2 border-dashed border-muted-foreground rounded-lg flex items-center justify-center relative bg-muted p-2 min-h-[140px] print:min-h-[200px]">
                <div className="w-full h-full border border-border bg-card flex flex-col items-center justify-center relative p-2">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-muted-foreground flex items-center justify-center bg-muted z-10 print:w-28 print:h-28">
                    <span className="text-[9px] sm:text-[10px] text-muted-foreground font-bold whitespace-nowrap print:text-xs">
                      Ø 70 mm
                    </span>
                  </div>
                  <div className="absolute border-t border-dashed border-border w-full top-1/2 -translate-y-1/2"></div>
                  <div className="absolute border-l border-dashed border-border h-full left-1/2 -translate-x-1/2"></div>
                  <span className="absolute bottom-1.5 text-[7px] sm:text-[8px] font-bold text-muted-foreground uppercase tracking-wider text-center print:text-[10px]">
                    Corte / Usinagem CNC
                  </span>
                </div>
              </div>
            </div>

            {/* Rodapé da Etiqueta */}
            <div className="mt-3 sm:mt-4 border-t-2 border-foreground pt-1.5 text-center print:mt-6 print:pt-3">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground print:text-sm">
                Identificação de Peça / Usicorte Metais
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Estilos de impressão */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 3mm;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            width: 210mm;
            height: 297mm;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .etiqueta-pagina {
            box-sizing: border-box;
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
