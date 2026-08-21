import type { ItemPedido, Cliente } from "../lib/types";

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

  return (
    <div className="flex justify-center no-print-wrapper">
      <div
        id="etiqueta-print"
        className="label-80x80 bg-white text-black select-none"
        style={{ fontFamily: "'Courier New', Courier, monospace" }}
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
          <div className="label-row label-row--split">
            <div className="label-row">
              <span className="label-key">MEDIDA:</span>
              <span className="label-val">{peca?.medida ?? "—"}</span>
            </div>
            <div className="label-row">
              <span className="label-key">QTD:</span>
              <span className="label-val label-val--bold">{peca?.quantidade ?? "—"} pcs</span>
            </div>
          </div>
        </div>

        <div className="label-body">
          <div className="label-obs">
            <div className="label-key label-key--block">OBSERVAÇÕES:</div>
            <div className="label-obs-text">{peca?.observacoes ?? "—"}</div>
          </div>
          <div className="label-drawing">
            {foto ? (
              <img
                key={pecaAtiva}
                src={foto}
                alt={`Desenho peça #${pecaAtiva}`}
                className="label-img"
              />
            ) : (
              <div className="label-no-drawing">
                <div className="label-no-drawing-icon">⊘</div>
                <div className="label-no-drawing-text">SEM DESENHO</div>
                <div className="label-no-drawing-sub">PEÇA #{pecaAtiva}</div>
              </div>
            )}
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
