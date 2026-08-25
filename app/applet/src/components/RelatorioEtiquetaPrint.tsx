import React from "react";
import EtiquetaDesenho, { detectarTipoDesenho } from "./EtiquetaDesenho";

export interface ItemRelatorio {
  idVer?: string | number;
  produto: string;
  medida: string;
  qtd: number;
  observacao?: string;
  /** Desenho colado/enviado manualmente (dataURL ou URL). Se vazio, o desenho é automático. */
  desenho?: string;
}

interface Props {
  cliente: string;
  numeroPedido: string;
  itens: ItemRelatorio[];
}

/**
 * Etiqueta de impressão 80 x 80 mm.
 *
 * - Cada etiqueta ocupa UMA página de exatamente 80 x 80 mm (margem 0).
 * - Desenho automático: RETANGULO -> retângulo, DISCO -> redondo sem furo,
 *   FLANGE -> redondo com furo, CONF. DESENHO -> campo em branco para colar.
 * - Imagem colada (Ctrl+V) no campo do desenho é ampliada para 70 mm e tem
 *   os traços reforçados automaticamente.
 */
export default function RelatorioEtiquetaPrint({
  cliente,
  numeroPedido,
  itens,
}: Props) {
  const [desenhos, setDesenhos] = React.useState<Record<string, string>>({});

  const chave = (item: ItemRelatorio, index: number) => String(item.idVer ?? index);

  const lerArquivo = (file: File, key: string) => {
    const reader = new FileReader();
    reader.onload = () => setDesenhos((d) => ({ ...d, [key]: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent, key: string) => {
    const file = Array.from(e.clipboardData?.items ?? [])
      .find((i) => i.type.startsWith("image/"))
      ?.getAsFile();
    if (file) {
      e.preventDefault();
      lerArquivo(file, key);
    }
  };

  const handleDrop = (e: React.DragEvent, key: string) => {
    const file = Array.from(e.dataTransfer?.files ?? []).find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      lerArquivo(file, key);
    }
  };

  return (
    <div className="relatorio-etiqueta-root">
      {/* Ações (ocultas na impressão) */}
      <div className="relatorio-acoes">
        <span className="relatorio-contagem">
          {itens.length} {itens.length === 1 ? "etiqueta" : "etiquetas"} · clique no desenho e pressione Ctrl+V para colar uma imagem
        </span>
        <button type="button" onClick={() => window.print()} className="relatorio-botao">
          🏷️ Imprimir Etiquetas
        </button>
      </div>

      <div className="relatorio-grade">
        {itens.map((item, index) => {
          const key = chave(item, index);
          const imagem = item.desenho ?? desenhos[key];
          const tipo = detectarTipoDesenho(item.produto, item.medida, item.observacao);

          return (
            <section key={key} className="etiqueta-pagina" aria-label={`Etiqueta ${index + 1}`}>
              <header className="etiqueta-topo">
                <span className="etiqueta-marca">Usicorte Metais</span>
                <span className="etiqueta-pedido">
                  Pedido Nº: <strong>{numeroPedido}</strong>
                </span>
              </header>

              <dl className="etiqueta-dados">
                <div className="etiqueta-linha">
                  <dt>Cliente</dt>
                  <dd>{cliente}</dd>
                </div>
                <div className="etiqueta-linha">
                  <dt>Material</dt>
                  <dd>{item.produto}</dd>
                </div>
                <div className="etiqueta-linha etiqueta-linha--dupla">
                  <div>
                    <dt>Medida</dt>
                    <dd>{item.medida}</dd>
                  </div>
                  <div>
                    <dt>Qtd</dt>
                    <dd>{item.qtd} PC</dd>
                  </div>
                </div>
                {item.observacao && (
                  <div className="etiqueta-linha">
                    <dt>Observação</dt>
                    <dd>{item.observacao}</dd>
                  </div>
                )}
              </dl>

              {/* Campo do desenho — 70 mm de largura */}
              <div
                className="etiqueta-desenho"
                tabIndex={0}
                onPaste={(e) => handlePaste(e, key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, key)}
                title="Clique aqui e pressione Ctrl+V para colar o desenho"
              >
                <EtiquetaDesenho tipo={tipo} medida={item.medida} imagem={imagem} />
              </div>
            </section>
          );
        })}
      </div>

      <style>{`
        .relatorio-etiqueta-root {
          font-family: Arial, Helvetica, sans-serif;
          color: #000;
          padding: 12px;
        }
        .relatorio-acoes {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-bottom: 12px; flex-wrap: wrap;
        }
        .relatorio-contagem { font-size: 13px; font-weight: 600; color: #333; }
        .relatorio-botao {
          background: #059669; color: #fff; border: none; padding: 8px 16px;
          border-radius: 6px; font-weight: 700; font-size: 13px; cursor: pointer;
        }
        .relatorio-botao:hover { background: #047857; }

        .relatorio-grade {
          display: grid;
          grid-template-columns: repeat(auto-fill, 80mm);
          gap: 5mm;
          justify-content: start;
        }

        /* ===== Etiqueta 80 x 80 mm ===== */
        .etiqueta-pagina {
          box-sizing: border-box;
          width: 80mm; height: 80mm;
          padding: 2.5mm 5mm;
          display: flex; flex-direction: column; gap: 1.5mm;
          overflow: hidden;
          background: #fff; color: #000;
        }
        .etiqueta-topo {
          display: flex; align-items: baseline; justify-content: space-between; gap: 2mm;
        }
        .etiqueta-marca {
          font-size: 9.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: .2mm;
        }
        .etiqueta-pedido { font-size: 7.5pt; color: #333; }

        .etiqueta-dados { margin: 0; display: flex; flex-direction: column; gap: 1mm; }
        .etiqueta-linha { display: flex; flex-direction: column; }
        .etiqueta-linha--dupla { flex-direction: row; gap: 4mm; }
        .etiqueta-dados dt {
          font-size: 6pt; font-weight: 700; color: #555;
          text-transform: uppercase; letter-spacing: .1mm;
        }
        .etiqueta-dados dd {
          margin: 0; font-size: 8.5pt; font-weight: 700; line-height: 1.1;
          word-break: break-word;
        }

        /* ===== Campo do desenho (70 mm) ===== */
        .etiqueta-desenho {
          width: 70mm;
          flex: 1;
          min-height: 0;
          margin: 0 auto;
          outline: none;
        }
        .etiqueta-desenho:focus-visible { box-shadow: 0 0 0 1px #059669; }
        .desenho-box {
          width: 100%; height: 100%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: .5mm;
          overflow: hidden;
        }
        .desenho-svg { width: auto; height: 100%; max-width: 100%; display: block; }
        .desenho-medida { font-size: 6.5pt; font-weight: 700; }
        .desenho-img {
          max-width: 70mm; max-height: 100%;
          width: auto; height: auto;
          object-fit: contain;
        }
        /* Reforço automático de traços finos/claros */
        .desenho-img--traco {
          filter: grayscale(1) brightness(1.05) contrast(2600%);
          image-rendering: crisp-edges;
        }
        .desenho-box--vazio { border: 0.3mm dashed #999; }
        .desenho-vazio-texto {
          font-size: 6.5pt; color: #999; text-transform: uppercase; letter-spacing: .3mm;
        }

        /* ===== Impressão — rolo contínuo 80mm ===== */
        /* Página = 80mm (etiqueta) + 5mm (separação) = 85mm de altura */
        @media print {
          @page { size: 80mm 85mm; margin: 0; }
          html, body {
            margin: 0; padding: 0; background: #fff;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .relatorio-etiqueta-root { padding: 0; }
          .relatorio-acoes { display: none !important; }
          .relatorio-grade { display: block; gap: 0; }
          .etiqueta-pagina {
            width: 80mm; height: 80mm; margin: 0; border: 0;
            page-break-after: always; break-after: page;
            break-inside: avoid; page-break-inside: avoid;
          }
          .etiqueta-pagina:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>
    </div>
  );
}
