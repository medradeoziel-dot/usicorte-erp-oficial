import type { ItemPedido, Cliente } from "../lib/types";
import EtiquetaDesenho from "./EtiquetaDesenho";
import { getObservacaoEspecificaItem } from "../utils/calculator";

interface LabelPreviewProps {
  pedidoId: string;
  cliente: Cliente | null;
  itens: ItemPedido[];
  pecaAtiva: number;
  fotosPorPeca: Record<number, string>;
  onSelectPeca: (id: number) => void;
}

export default function LabelPreview({
  pedidoId,
  cliente,
  itens,
  pecaAtiva,
  fotosPorPeca,
  onSelectPeca,
}: LabelPreviewProps) {
  const peca = itens.find((i) => i.id === pecaAtiva);
  const foto = fotosPorPeca[pecaAtiva];
  const obsItem = getObservacaoEspecificaItem(peca);

  return (
    <div className="flex justify-center no-print-wrapper">
      <div
        id="etiqueta-print"
        className="label-80x80 etiqueta-card bg-white text-black select-none"
        style={{ 
          fontFamily: "'Courier New', Courier, monospace",
          padding: '8px',
          marginBottom: '12mm',
          breakInside: 'avoid',
          pageBreakInside: 'avoid',
          boxSizing: 'border-box'
        }}
      >
        <div className="label-header">
          <div className="label-company">USICORTE METAIS</div>
          <div className="label-pedido">PEDIDO: {pedidoId}</div>
        </div>

        <div className="label-section label-info">
          <div className="label-row">
            <span className="label-key">CLIENTE:</span>
            <span className="label-val label-val--bold truncate">{cliente?.nome ?? "—"}</span>
          </div>
          <div className="label-row label-row--split">
            <div className="label-row">
              <span className="label-key">MATERIAL:</span>
              <span className="label-val">{peca?.material ?? "—"}</span>
            </div>
            <div className="label-row label-peca-badge">
              PEÇA <span className="label-badge">#{pecaAtiva}</span>
            </div>
          </div>
          <div className="label-row">
            <span className="label-key">DESCRIÇÃO:</span>
            <span className="label-val label-val--bold">{peca?.descricao ?? "—"}</span>
          </div>
          <div className="label-row label-row--split items-start">
            <div className="label-row flex-col items-start">
              <span className="label-key">MEDIDA:</span>
              <div className="medida-bloco flex flex-col items-start">
                <span className="label-val label-val--bold font-mono text-[11px] leading-tight text-black">{peca?.medida ?? "—"}</span>
                {obsItem && (
                  <span className="medida-obs text-[9px] text-gray-500 italic font-sans leading-tight mt-0.5">
                    {obsItem}
                  </span>
                )}
              </div>
            </div>
            <div className="label-row">
              <span className="label-key">QTD:</span>
              <span className="label-val label-val--bold">{peca?.quantidade ?? "—"} pcs</span>
            </div>
          </div>
        </div>

        <div className="label-body">
          {obsItem && (
            <div className="label-obs">
              <div className="label-key label-key--block">OBSERVAÇÕES:</div>
              <div className="label-obs-text">{obsItem}</div>
            </div>
          )}
          <div className="label-drawing flex items-center justify-center p-1">
            <EtiquetaDesenho
              material={peca?.material}
              medida={peca?.medida}
              observacao={obsItem || ''}
              descricao={peca?.descricao}
              imagem={foto}
              engrossarTracos={true}
            />
          </div>
        </div>

        <div className="label-footer">
          <div className="label-peca-tabs">
            {itens.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectPeca(item.id)}
                className={`label-tab ${item.id === pecaAtiva ? "label-tab--active" : ""}`}
              >
                #{item.id}
              </button>
            ))}
          </div>
          <div className="label-site">WWW.USICORTEMETAIS.COM.BR</div>
        </div>
      </div>
    </div>
  );
}
