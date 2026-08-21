
import type { Cliente, ItemPedido, Pedido } from "../lib/types";

interface A4PreviewProps {
  pedido: Pedido;
  cliente: Cliente | null;
  itens: ItemPedido[];
  fotosPorPeca: Record<number, string>;
  mode: "a4-inteiro" | "a4-2vias" | "proposta-4col";
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function total(itens: ItemPedido[]) {
  return itens.reduce((s, i) => s + i.valorUnit * i.quantidade, 0);
}

export default function A4Preview({ pedido, cliente, itens, fotosPorPeca, mode }: A4PreviewProps) {
  const totalVal = total(itens);
  const is2vias = mode === "a4-2vias";
  const is4col = mode === "proposta-4col";

  const DocumentBlock = ({ label }: { label?: string }) => (
    <div className="a4-doc bg-white text-black" style={{ fontFamily: "Arial, sans-serif" }}>
      {label && <div className="a4-via-label">{label}</div>}

      <div className="a4-header">
        <div className="a4-logo-area">
          <div className="a4-logo-box">
            <span className="a4-logo-text">USICORTE</span>
            <span className="a4-logo-sub">METAIS</span>
          </div>
          <div className="a4-company-info">
            <p className="a4-company-name">Usicorte Metais Ltda</p>
            <p className="a4-company-detail">CNPJ: 00.000.000/0001-00</p>
            <p className="a4-company-detail">www.usicortemetais.com.br</p>
          </div>
        </div>
        <div className="a4-header-right">
          <div className="a4-cotacao-box">
            <div className="a4-cotacao-label">COTAÇÃO / PROPOSTA</div>
            <div className="a4-cotacao-num">{pedido.id}</div>
            <div className="a4-cotacao-date">Data: {new Date(pedido.data).toLocaleDateString("pt-BR")}</div>
            <div className={`a4-status-badge a4-status--${pedido.status.toLowerCase().replace(" ", "-")}`}>
              {pedido.status}
            </div>
          </div>
        </div>
      </div>

      <div className="a4-client-block">
        <div className="a4-section-title">DADOS DO CLIENTE</div>
        <div className="a4-client-grid">
          <div><span className="a4-field-key">Cliente:</span> <span className="a4-field-val">{cliente?.nome ?? "—"}</span></div>
          <div><span className="a4-field-key">CNPJ:</span> <span className="a4-field-val">{cliente?.cnpj ?? "—"}</span></div>
          <div><span className="a4-field-key">Telefone:</span> <span className="a4-field-val">{cliente?.telefone ?? "—"}</span></div>
          <div><span className="a4-field-key">Cidade:</span> <span className="a4-field-val">{cliente?.cidade ?? "—"}</span></div>
        </div>
      </div>

      {is4col ? (
        <div className="a4-items-4col">
          <div className="a4-section-title">ITENS DO PEDIDO</div>
          <div className="a4-grid-4col">
            {itens.map((item) => (
              <div key={item.id} className="a4-card-4col">
                <div className="a4-card-header">
                  <span className="a4-card-num">#{item.id}</span>
                  <span className="a4-card-name">{item.descricao}</span>
                </div>
                {fotosPorPeca[item.id] ? (
                  <img src={fotosPorPeca[item.id]} alt="" className="a4-card-img" />
                ) : (
                  <div className="a4-card-no-img">SEM DESENHO</div>
                )}
                <div className="a4-card-detail"><b>Material:</b> {item.material}</div>
                <div className="a4-card-detail"><b>Medida:</b> {item.medida}</div>
                <div className="a4-card-detail"><b>Qtd:</b> {item.quantidade} pcs</div>
                <div className="a4-card-detail a4-card-obs"><b>Obs:</b> {item.observacoes}</div>
                <div className="a4-card-price">{formatCurrency(item.valorUnit)} / pc</div>
                <div className="a4-card-subtotal">Total: {formatCurrency(item.valorUnit * item.quantidade)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="a4-items-table">
          <div className="a4-section-title">ITENS DO PEDIDO</div>
          <table className="a4-table">
            <thead>
              <tr>
                <th className="a4-th a4-th-num">#</th>
                <th className="a4-th">Descrição</th>
                <th className="a4-th">Material</th>
                <th className="a4-th">Medida</th>
                <th className="a4-th a4-th-r">Qtd</th>
                <th className="a4-th a4-th-r">Unit.</th>
                <th className="a4-th a4-th-r">Total</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id} className="a4-tr">
                  <td className="a4-td a4-td-num">{item.id}</td>
                  <td className="a4-td a4-td-desc">
                    <div className="a4-td-name">{item.descricao}</div>
                    <div className="a4-td-obs">{item.observacoes}</div>
                  </td>
                  <td className="a4-td">{item.material}</td>
                  <td className="a4-td">{item.medida}</td>
                  <td className="a4-td a4-td-r">{item.quantidade}</td>
                  <td className="a4-td a4-td-r">{formatCurrency(item.valorUnit)}</td>
                  <td className="a4-td a4-td-r a4-td-total">{formatCurrency(item.valorUnit * item.quantidade)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="a4-tfoot">
                <td colSpan={6} className="a4-td a4-td-total-label">TOTAL GERAL</td>
                <td className="a4-td a4-td-r a4-td-grand-total">{formatCurrency(totalVal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="a4-footer">
        <div className="a4-footer-note">
          Proposta válida por 15 dias a partir da data de emissão. Preços sujeitos a alteração sem aviso prévio.
        </div>
        <div className="a4-footer-sig">
          <div className="a4-sig-line">________________________________</div>
          <div className="a4-sig-label">Usicorte Metais — Responsável Técnico</div>
        </div>
      </div>
    </div>
  );

  if (is2vias) {
    return (
      <div className="flex flex-col gap-4">
        <DocumentBlock label="1ª VIA — CLIENTE" />
        <div className="border-t-4 border-dashed border-slate-400 my-2 no-print" />
        <DocumentBlock label="2ª VIA — EMPRESA" />
      </div>
    );
  }

  return <DocumentBlock />;
}
