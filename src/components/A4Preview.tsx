
import type { Cliente, ItemPedido, Pedido } from "../lib/types";
import { formatSafeDate } from "../utils/calculator";

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
            <div className="a4-cotacao-date">Data: {formatSafeDate(pedido.data)}</div>
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
          <table className="a4-table w-full">
            <thead>
              <tr>
                <th className="a4-th text-left">PRODUTO / MATERIAL</th>
                <th className="a4-th text-center">MEDIDAS</th>
                <th className="a4-th text-left">DESCRIÇÃO</th>
                <th className="a4-th text-left">INFORMAÇÕES</th>
                <th className="a4-th a4-th-r text-right">UNITÁRIO</th>
                <th className="a4-th a4-th-r text-center w-14">QTD</th>
                <th className="a4-th a4-th-r text-right">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id} className="a4-tr">
                  <td className="a4-td font-semibold">{item.material || "—"}</td>
                  <td className="a4-td text-center font-mono text-xs">{item.medida || "—"}</td>
                  <td className="a4-td a4-td-desc">
                    <div className="a4-td-name font-medium">{item.descricao || "—"}</div>
                  </td>
                  <td className="a4-td text-xs text-slate-600 italic">{item.observacoes || "—"}</td>
                  <td className="a4-td a4-td-r text-right font-mono">{formatCurrency(item.valorUnit)}</td>
                  <td className="a4-td a4-td-r text-center font-mono font-semibold">{item.quantidade}</td>
                  <td className="a4-td a4-td-r text-right font-mono font-bold a4-td-total">{formatCurrency(item.valorUnit * item.quantidade)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="a4-tfoot">
                <td colSpan={6} className="a4-td a4-td-total-label font-bold text-right">TOTAL GERAL</td>
                <td className="a4-td a4-td-r a4-td-grand-total text-right font-bold">{formatCurrency(totalVal)}</td>
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
    const isMultiPage = itens.length > 3;
    return (
      <div className="flex flex-col gap-4">
        <div className={`via-bloco via-cliente ${isMultiPage ? 'quebra-pagina' : ''}`} style={{ breakAfter: isMultiPage ? 'page' : 'auto', pageBreakAfter: isMultiPage ? 'always' : 'auto' }}>
          <DocumentBlock label="1ª VIA — CLIENTE" />
        </div>
        <div className={`border-t-4 border-dashed border-slate-400 my-2 ${isMultiPage ? 'hidden print:hidden' : 'no-print'}`} />
        <div className="via-bloco via-empresa">
          <DocumentBlock label="2ª VIA — EMPRESA / PRODUÇÃO" />
        </div>
      </div>
    );
  }

  return <DocumentBlock />;
}
