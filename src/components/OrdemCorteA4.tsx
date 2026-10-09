import React from 'react';
import RelatorioCortePrint from './prints/RelatorioCortePrint';
import { ItemRelatorio } from './prints/RelatorioPropostaPrint';

export interface OrdemCorteA4Props {
  itens?: ItemRelatorio[];
  items?: any[];
  cliente?: string;
  clientName?: string;
  numeroPedido?: string;
  quoteNumber?: string;
  data?: string;
  date?: string;
}

export const OrdemCorteA4: React.FC<OrdemCorteA4Props> = ({
  itens,
  items,
  cliente,
  clientName,
  numeroPedido,
  quoteNumber,
  data,
  date,
}) => {
  const listaItens: ItemRelatorio[] = (itens || items || []).map((it: any) => ({
    produto: it.produto || it.material || it.constanteNome || 'MATERIAL',
    medida: it.medida || it.medidas || '',
    descricao: it.descricao || it.description || '',
    qtd: Number(it.qtd || it.quantity || 1),
    observacao: it.observacao || it.obs || it.notes || '',
    created_at: it.created_at || it.data || it.date || '',
    data: it.data || it.date || '',
    idVer: it.id || it.idVer,
  }));

  const nomeCliente = cliente || clientName;
  const numPedido = numeroPedido || quoteNumber;
  const dataRef = data || date;

  return (
    <div className="ordem-corte-a4-container w-full max-w-[210mm] mx-auto">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }

          body, .ordem-corte-a4-container {
            width: 100% !important;
            max-width: 210mm !important;
            margin: 0 auto !important;
          }
        }
      `}</style>
      <RelatorioCortePrint
        itens={listaItens}
        cliente={nomeCliente}
        numeroPedido={numPedido}
        data={dataRef}
      />
    </div>
  );
};

export const OrdemCortePrintModal = OrdemCorteA4;
export default OrdemCorteA4;
