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

/**
 * Etiqueta de impressão 80 x 80 mm.
 *
 * - Cada etiqueta ocupa UMA página de exatamente 80 x 80 mm (margem 0),
 *   ideal para impressora térmica de etiquetas.
 * - Sem a linha/borda superior que existia no cabeçalho da versão anterior.
 * - Todo o conteúdo é dimensionado em mm e usa box-sizing: border-box para
 *   nunca estourar os limites da etiqueta.
 */
export default function RelatorioEtiquetaPrint({
  cliente,
  numeroPedido,
  itens,
}: Props) {
  return (
    <div className="relatorio-etiqueta-root">
      {/* Botão de Impressão (oculto na impressão) */}
      <div className="relatorio-acoes">
        <span className="relatorio-contagem">
          {itens.length} {itens.length === 1 ? "etiqueta" : "etiquetas"}
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="relatorio-botao"
        >
          🏷️ Imprimir Etiquetas
        </button>
      </div>

      {/* Grade de etiquetas (apenas para visualização; na impressão cada uma vira uma página) */}
      <div className="relatorio-grade">
        {itens.map((item, index) => (
          <section
            key={item.idVer ?? index}
            className="etiqueta-pagina"
            aria-label={`Etiqueta ${index + 1}`}
          >
            {/* Topo da etiqueta — sem borda/linha superior */}
            <header className="etiqueta-topo">
              <span className="etiqueta-marca">Usicorte Metais</span>
              <span className="etiqueta-pedido">
                Pedido Nº: <strong>{numeroPedido}</strong>
              </span>
            </header>

            {/* Conteúdo: dados à esquerda, esquema técnico à direita */}
            <div className="etiqueta-corpo">
              {/* Informações da peça */}
              <dl className="etiqueta-dados">
                <div className="etiqueta-linha">
                  <dt>Empresa / Cliente:</dt>
                  <dd>{cliente}</dd>
                </div>
                <div className="etiqueta-linha">
                  <dt>Material:</dt>
                  <dd>{item.produto}</dd>
                </div>
                <div className="etiqueta-linha">
                  <dt>Medida:</dt>
                  <dd>{item.medida}</dd>
                </div>
                <div className="etiqueta-linha">
                  <dt>Qtd:</dt>
                  <dd>{item.qtd} PC</dd>
                </div>
                {item.observacao && (
                  <div className="etiqueta-linha">
                    <dt>Observação:</dt>
                    <dd>{item.observacao}</dd>
                  </div>
                )}
              </dl>

              {/* Esquema técnico / gabarito de usinagem */}
              <div className="etiqueta-esquema">
                <div className="esquema-circulo">
                  <span className="esquema-diametro">Ø {item.medida}</span>
                </div>
                <span className="esquema-legenda">Corte / Usinagem CNC</span>
              </div>
            </div>

            {/* Rodapé da etiqueta */}
            <footer className="etiqueta-rodape">
              Identificação de Peça / Usicorte Metais
            </footer>
          </section>
        ))}
      </div>

      <style>{`
        /* ===== Visualização na tela ===== */
        .relatorio-etiqueta-root {
          font-family: Arial, Helvetica, sans-serif;
          color: #000;
          padding: 12px;
        }
        .relatorio-acoes {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .relatorio-contagem {
          font-size: 13px;
          font-weight: 600;
          color: #333;
        }
        .relatorio-botao {
          background: #059669;
          color: #fff;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 1px 2px rgba(0,0,0,.15);
          transition: background .15s ease;
        }
        .relatorio-botao:hover { background: #047857; }

        .relatorio-grade {
          display: grid;
          grid-template-columns: repeat(auto-fill, 80mm);
          gap: 10px;
          justify-content: start;
        }

        /* ===== A etiqueta em si (80 x 80 mm) ===== */
        .etiqueta-pagina {
          box-sizing: border-box;
          width: 80mm;
          height: 80mm;
          padding: 2.5mm 3mm;
          border: 0.4mm solid #000;
          border-radius: 1.5mm;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #fff;
          color: #000;
        }

        /* Topo — SEM linha/borda inferior (era a "linha de cima" indesejada) */
        .etiqueta-topo {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 2mm;
          padding-bottom: 1.5mm;
        }
        .etiqueta-marca {
          font-size: 10pt;
          font-weight: 800;
          letter-spacing: .2mm;
          text-transform: uppercase;
        }
        .etiqueta-pedido {
          font-size: 8.5pt;
          color: #333;
        }
        .etiqueta-pedido strong { color: #000; }

        /* Corpo: dados + esquema */
        .etiqueta-corpo {
          flex: 1;
          display: flex;
          gap: 3mm;
          min-height: 0;
        }
        .etiqueta-dados {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1.6mm;
          margin: 0;
        }
        .etiqueta-linha {
          display: flex;
          flex-direction: column;
          gap: .3mm;
        }
        .etiqueta-linha dt {
          font-size: 6.8pt;
          font-weight: 700;
          color: #555;
          text-transform: uppercase;
          letter-spacing: .1mm;
        }
        .etiqueta-linha dd {
          margin: 0;
          font-size: 9pt;
          font-weight: 600;
          color: #000;
          line-height: 1.15;
          word-break: break-word;
        }

        .etiqueta-esquema {
          flex: 0 0 26mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1.5mm;
        }
        .esquema-circulo {
          width: 24mm;
          height: 24mm;
          border: 0.4mm dashed #888;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }
        .esquema-circulo::before {
          content: "";
          position: absolute;
          inset: 4mm;
          border: 0.3mm solid #000;
          border-radius: 50%;
        }
        .esquema-diametro {
          font-size: 7pt;
          font-weight: 700;
          background: #fff;
          padding: 0 .5mm;
          z-index: 1;
        }
        .esquema-legenda {
          font-size: 6.5pt;
          color: #555;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: .1mm;
        }

        .etiqueta-rodape {
          font-size: 6.5pt;
          color: #555;
          text-align: center;
          padding-top: 1.5mm;
          text-transform: uppercase;
          letter-spacing: .2mm;
        }

        /* ===== Impressão ===== */
        @media print {
          @page {
            size: 80mm 80mm;
            margin: 0;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .relatorio-etiqueta-root { padding: 0; }
          /* Esconde tudo que não é a etiqueta */
          .relatorio-acoes { display: none !important; }
          .relatorio-grade {
            display: block;
            gap: 0;
          }
          /* Cada etiqueta = 1 página, exatamente 80x80mm, sem margem extra */
          .etiqueta-pagina {
            width: 80mm;
            height: 80mm;
            margin: 0;
            border-radius: 0;
            border: 0.4mm solid #000;
            page-break-after: always;
            break-after: page;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* A última etiqueta não força página em branco extra */
          .etiqueta-pagina:last-child {
            page-break-after: auto;
            break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}
