import React from 'react';
import { createPortal } from 'react-dom';
import CompanyHeader from './CompanyHeader';
import { QuotePrintView } from './QuotePrintView';
import EtiquetaDesenho from './EtiquetaDesenho';
import OrdemCorte80mm, { imprimirCupom80mm, gerarHtmlCupom80mm } from './OrdemCorte80mm';
import { 
  formatCurrency, 
  formatSafeDate, 
  formatarMedidasLimpa, 
  formatWeightKg, 
  getObservacaoEspecificaItem 
} from '../utils/calculator';
import { Quote } from '../types';

export type TipoImpressaoConsulta = 'GERAL' | 'EMPRESA' | 'PEDIDO' | 'ETIQUETAS' | 'CORTE' | 'CORTE_80MM';

// Normaliza o objeto de orçamento para garantir dados 100% completos e consistentes
export function normalizeQuoteForPrint(rawQuote: any): any {
  if (!rawQuote) return null;

  const quoteNumber = rawQuote.quoteNumber || rawQuote.id || rawQuote.numero || 'COT-2026-0001';
  const clientName = 
    rawQuote.clientName || 
    rawQuote.cliente?.nome || 
    rawQuote.client?.name || 
    rawQuote.empresa || 
    'CLIENTE BALCÃO';

  const dateVal = 
    rawQuote.date || 
    rawQuote.data_orcamento || 
    rawQuote.data || 
    (rawQuote.createdAt ? formatSafeDate(rawQuote.createdAt) : formatSafeDate(new Date()));

  const paymentTerms = rawQuote.paymentTerms || rawQuote.condicoesPagamento || 'À Vista / Pix';
  const validityDays = rawQuote.validityDays || 10;
  const observations = rawQuote.observations || rawQuote.observacoes || '';

  const rawItems = rawQuote.items || rawQuote.itens || [];
  const items = rawItems.map((item: any, idx: number) => {
    const qty = Number(item.qtd !== undefined ? item.qtd : (item.quantity || 1));
    const unitPrice = Number(item.valorUnitario !== undefined ? item.valorUnitario : (item.unitPrice || item.unitario || 0));
    const subtotal = Number(item.subtotal !== undefined ? item.subtotal : (item.valorTotal || item.valorGeral || (unitPrice * qty)));
    const totalWeightKg = Number(item.totalWeightKg !== undefined ? item.totalWeightKg : (item.pesoTotal || 0));
    const material = item.constanteNome || item.constantName || item.material || item.produto || 'MATERIAL';
    const medidas = formatarMedidasLimpa(item) || item.dimensions || item.medida || item.medidas || '';
    const descricao = item.descricao || item.description || item.produto || '-';
    const observacao = getObservacaoEspecificaItem(item) || item.observacao || item.notes || item.info || '';
    const drawingImage = item.drawingImage || item.fotoDesenho || item.desenhoUrl || item.desenho_url || '';
    const rawItemDate = item.created_at || item.data || item.date || item.createdAt || dateVal;

    return {
      ...item,
      id: item.id || `item-${idx}`,
      idVer: item.idVer || idx + 1,
      material,
      constanteNome: material,
      produto: material,
      dimensions: medidas,
      medida: medidas,
      medidas: medidas,
      description: descricao,
      descricao: descricao,
      qtd: qty,
      quantity: qty,
      unitPrice,
      valorUnitario: unitPrice,
      unitario: unitPrice,
      subtotal,
      totalPrice: subtotal,
      valorGeral: subtotal,
      totalWeightKg,
      pesoTotal: totalWeightKg,
      observacao,
      notes: observacao,
      info: observacao,
      drawingImage,
      fotoDesenho: drawingImage,
      desenhoUrl: drawingImage,
      created_at: rawItemDate,
      data: formatSafeDate(rawItemDate)
    };
  });

  const subtotalTotal = 
    rawQuote.subtotalTotal ?? 
    rawQuote.subtotal ?? 
    items.reduce((acc: number, it: any) => acc + (it.subtotal || 0), 0);

  const discount = Number(rawQuote.discount || rawQuote.totalDiscount || rawQuote.desconto || 0);
  const shipping = Number(rawQuote.shipping || rawQuote.shippingCost || rawQuote.frete || 0);
  const grandTotal = 
    rawQuote.grandTotal ?? 
    rawQuote.valorTotal ?? 
    (subtotalTotal - discount + shipping);

  const totalWeightKg = 
    rawQuote.totalWeightKg ?? 
    items.reduce((acc: number, it: any) => acc + (it.totalWeightKg || 0), 0);

  return {
    ...rawQuote,
    id: quoteNumber,
    quoteNumber,
    date: dateVal,
    clientName,
    cliente: {
      nome: clientName,
      documento: rawQuote.clientDocument || rawQuote.cliente?.documento || '',
      telefone: rawQuote.clientPhone || rawQuote.cliente?.telefone || '',
      email: rawQuote.clientEmail || rawQuote.cliente?.email || '',
      endereco: [rawQuote.clientCity, rawQuote.clientState].filter(Boolean).join(' - ') || rawQuote.cliente?.endereco || ''
    },
    paymentTerms,
    validityDays,
    observations,
    items,
    itens: items,
    subtotal: subtotalTotal,
    subtotalTotal,
    discount,
    totalDiscount: discount,
    shipping,
    shippingCost: shipping,
    grandTotal,
    valorTotal: grandTotal,
    totalWeightKg
  };
}

interface ConsultaPrintDocumentsProps {
  quote: any;
  tipo: TipoImpressaoConsulta;
}

export function ConsultaPrintDocuments({ quote, tipo }: ConsultaPrintDocumentsProps) {
  const q = normalizeQuoteForPrint(quote);
  if (!q) return null;

  const totalTiposItens = q.items.length;
  const totalPecas = q.items.reduce((acc: number, it: any) => acc + Number(it.qtd || 1), 0);
  const effectiveClientName = q.clientName || 'CLIENTE BALCÃO';

  const getItemDateReports = (item: any) => {
    const rawDate = item?.created_at || item?.data || item?.date || item?.createdAt || q.date;
    return formatSafeDate(rawDate);
  };

  return (
    <div 
      id="print-area" 
      className="print-area container-impressao-vendas print-container w-full overflow-x-hidden bg-slate-900/60 p-2 sm:p-6 rounded-2xl border border-slate-800 print:bg-transparent print:p-0 print:m-0 print:border-none print:shadow-none print:overflow-visible print:h-auto print:max-h-none"
    >
      {/* ===================================================
           1. GERAL: RELATÓRIO A4 INTEIRO
           =================================================== */}
      <div 
        id="doc-A4-inteiro" 
        className={`documento-modelo secao-proposta print-container bg-white text-slate-900 p-4 sm:p-8 rounded-xl shadow-2xl font-sans w-full max-w-4xl mx-auto overflow-x-hidden print:overflow-visible print:h-auto print:max-h-none print:min-h-0 ${
          tipo === 'GERAL' ? 'block' : 'hidden'
        }`}
        style={{ minHeight: '800px' }}
      >
        <CompanyHeader 
          documentType="Relatório / Proposta Comercial"
          documentNumber={q.quoteNumber || '00124'}
          documentDate={q.date || new Date().toLocaleDateString('pt-BR')}
        />

        {/* Client box */}
        <div className="bg-slate-100 border border-slate-300 p-3 rounded-md mb-4 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <span className="font-bold text-slate-700">EMPRESA / CLIENTE:</span>{' '}
            <strong className="lbl-cliente-nome text-slate-900 text-sm font-black uppercase break-words">{effectiveClientName}</strong>
          </div>
          <div className="text-slate-600 font-mono">
            Condições: <strong>{q.paymentTerms || 'À Vista / Pix'}</strong>
          </div>
        </div>

        {/* Tabela Desktop & Mobile */}
        <table className="w-full border-collapse text-xs mb-6 print:overflow-visible print:h-auto print:max-h-none" border={1} cellPadding={6}>
          <thead>
            <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-[11px] border-b border-black">
              <th className="text-left p-2">PRODUTO / MATERIAL</th>
              <th className="text-center p-2">MEDIDAS</th>
              <th className="text-left p-2">DESCRIÇÃO</th>
              <th className="text-left p-2">INFORMAÇÕES</th>
              <th className="text-right p-2">UNITÁRIO</th>
              <th className="text-center p-2 w-12">QTD</th>
              <th className="text-right p-2">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody id="tbody-a4-inteiro" className="divide-y divide-slate-300">
            {q.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                  Nenhum item na cotação para exibição.
                </td>
              </tr>
            ) : (
              q.items.map((item: any, idx: number) => {
                const produtoMaterial = item.constanteNome || item.material || 'MATERIAL';
                const medidasFormatadas = formatarMedidasLimpa(item);
                const descricaoItem = item.descricao || item.description || '-';
                const obsEspecifica = getObservacaoEspecificaItem(item) || item.observacao || '';
                const valorUnitario = Number(item.valorUnitario || item.unitPrice || 0);
                const qtd = Number(item.qtd || item.quantity || 1);
                const subtotal = Number(item.subtotal || item.totalPrice || (valorUnitario * qtd));

                return (
                  <tr key={item.id || idx} className="hover:bg-slate-50">
                    <td className="text-left font-bold text-slate-900 p-2">
                      <div>
                        <div style={{ fontWeight: 'bold' }} className="leading-tight">
                          {produtoMaterial}
                        </div>
                        <div
                          className="medida-obs"
                          style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                        >
                          {getItemDateReports(item)}
                        </div>
                      </div>
                    </td>
                    <td className="text-center p-2">
                      <div className="medida-bloco-center flex flex-col items-center justify-center">
                        <span className="medida-dimensao font-bold font-mono text-[11px] text-slate-900 leading-tight">
                          {medidasFormatadas}
                        </span>
                        {obsEspecifica && (
                          <span className="medida-obs text-[9.5px] text-slate-500 italic font-sans leading-tight mt-0.5">
                            {obsEspecifica}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-left p-2 text-slate-800">{descricaoItem}</td>
                    <td className="text-left p-2 text-slate-600 italic text-[10px]">{obsEspecifica || '-'}</td>
                    <td className="text-right font-mono p-2">{formatCurrency(valorUnitario)}</td>
                    <td className="text-center font-bold font-mono p-2">{qtd}</td>
                    <td className="text-right font-mono font-bold p-2 text-slate-950">{formatCurrency(subtotal)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Totais de Itens / Peças */}
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-400 font-bold text-xs">
          <div className="flex gap-4 text-slate-700">
            <span>ITENS: <strong className="text-slate-900">{totalTiposItens}</strong></span>
            <span>TOTAL PEÇAS: <strong className="text-slate-900">{totalPecas} PÇ</strong></span>
          </div>
          <div className="text-sm">
            TOTAL: <strong className="text-slate-900 font-mono font-black">{formatCurrency(q.grandTotal)}</strong>
          </div>
        </div>

        {/* Rodapé Totais & Notas */}
        <div className="border-t-2 border-black pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-end text-xs gap-4 mt-2">
          <div className="space-y-1 text-slate-600 max-w-md w-full sm:w-auto">
            <p>• Validade da proposta: <strong>{q.validityDays || 10} dias</strong></p>
            <p>• Prazo de entrega: <strong>A combinar após aprovação</strong></p>
            {q.observations && <p>• Obs: {q.observations}</p>}
          </div>

          <div className="text-left sm:text-right space-y-1 w-full sm:w-auto min-w-[220px] bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200">
            <div className="flex justify-between text-slate-700">
              <span>Peso Total Estimado:</span>
              <strong className="font-mono">{formatWeightKg(q.totalWeightKg, 3)}</strong>
            </div>
            {q.discount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Desconto:</span>
                <strong className="font-mono">- {formatCurrency(q.discount)}</strong>
              </div>
            )}
            {q.shipping > 0 && (
              <div className="flex justify-between text-slate-700">
                <span>Frete:</span>
                <strong className="font-mono">+ {formatCurrency(q.shipping)}</strong>
              </div>
            )}
            <div className="flex justify-between text-base font-black border-t border-black pt-2 text-slate-950">
              <span>VALOR TOTAL:</span>
              <span className="font-mono text-blue-900">{formatCurrency(q.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================
           2. EMPRESA: PROPOSTA COMERCIAL RESUMIDA (4 COLUNAS)
           =================================================== */}
      <div 
        id="doc-proposta-resumida" 
        className={`documento-modelo secao-proposta-resumida print-container mx-auto print:overflow-visible print:h-auto print:max-h-none ${
          tipo === 'EMPRESA' ? 'block' : 'hidden'
        }`}
      >
        <QuotePrintView 
          quote={{
            id: q.quoteNumber || 'COT-2026-3169',
            quoteNumber: q.quoteNumber || 'COT-2026-3169',
            date: q.date,
            clientName: effectiveClientName,
            paymentTerms: q.paymentTerms || 'À Vista / Pix (3% Desc.)',
            validityDays: q.validityDays || 10,
            deliveryTerms: 'A combinar / Imediato',
            observations: q.observations,
            totalWeightKg: q.totalWeightKg,
            totalDiscount: q.discount,
            shippingCost: q.shipping,
            grandTotal: q.grandTotal,
            items: q.items.map((it: any) => ({
              material: it.material || 'MATERIAL',
              dimensions: formatarMedidasLimpa(it) || 'Ø 50 x 200 mm',
              description: it.descricao || it.description || 'Corte / Usinagem Industrial',
              info: it.observacao || it.info || '-',
              drawingImage: it.drawingImage || '',
              created_at: it.created_at,
              data: it.data || q.date,
            }))
          }}
        />
      </div>

      {/* ===================================================
           3. PEDIDO: A4 EM 2 VIAS (FOLHA ÚNICA DIVIDIDA AO MEIO)
           =================================================== */}
      <div 
        id="doc-A4-2vias" 
        className={`documento-modelo secao-pedido modelo-duas-vias bg-white text-slate-900 p-2 sm:p-4 rounded-xl shadow-2xl w-full max-w-4xl mx-auto font-sans overflow-hidden flex flex-col justify-between ${
          tipo === 'PEDIDO' ? 'block' : 'hidden'
        }`}
      >
        {/* VIA 1: CLIENTE (Metade Superior) */}
        <div 
          className="via-pedido via-cliente border border-black p-2 sm:p-3 rounded bg-white flex flex-col justify-between overflow-hidden" 
          style={{ 
            minHeight: '340px',
            maxHeight: '135mm',
            pageBreakInside: 'avoid',
            breakInside: 'avoid'
          }}
        >
          <div>
            <CompanyHeader 
              tag="VIA DO CLIENTE"
              tagColor="blue"
              documentNumber={q.quoteNumber || '00124'}
              documentDate={q.date || new Date().toLocaleDateString('pt-BR')}
              compact={true}
            />

            <div className="text-[11px] mb-1.5 text-slate-700 flex flex-col sm:flex-row justify-between gap-1">
              <div><strong>Cliente:</strong> <span className="lbl-cliente-nome font-bold uppercase">{effectiveClientName}</span></div>
              <div><strong>Condições:</strong> <span className="font-semibold">{q.paymentTerms || 'À Vista / Pix'}</span></div>
            </div>

            <table className="w-full text-[11px] border-collapse mb-1.5" border={1} cellPadding={2}>
              <thead>
                <tr className="bg-slate-100 font-bold text-[9.5px] uppercase border-b border-black">
                  <th className="text-left px-1.5 py-0.5">PRODUTO / MATERIAL</th>
                  <th className="text-center px-1.5 py-0.5">MEDIDAS</th>
                  <th className="text-left px-1.5 py-0.5">DESCRIÇÃO</th>
                  <th className="text-left px-1.5 py-0.5">INFORMAÇÕES</th>
                  <th className="text-right px-1.5 py-0.5">UNITÁRIO</th>
                  <th className="text-center px-1.5 py-0.5 w-10">QTD</th>
                  <th className="text-right px-1.5 py-0.5">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody className="tbody-resumido divide-y divide-slate-200">
                {q.items.map((item: any, idx: number) => {
                  const produtoMaterial = item.material || 'MATERIAL';
                  const medidasFormatadas = formatarMedidasLimpa(item);
                  const descricaoItem = item.descricao || item.description || '-';
                  const obsEspecifica = getObservacaoEspecificaItem(item) || item.observacao || '';
                  const valorUnitario = Number(item.valorUnitario || item.unitPrice || 0);
                  const qtd = Number(item.qtd || item.quantity || 1);
                  const subtotal = Number(item.subtotal || item.totalPrice || (valorUnitario * qtd));

                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-1.5 py-0.5 font-bold text-slate-900">
                        <div>
                          <div style={{ fontWeight: 'bold' }} className="leading-tight">
                            {produtoMaterial}
                          </div>
                          <div
                            className="medida-obs"
                            style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '1px', lineHeight: '1.1' }}
                          >
                            {getItemDateReports(item)}
                          </div>
                        </div>
                      </td>
                      <td className="px-1.5 py-0.5 text-center">
                        <div className="medida-bloco-center flex flex-col items-center justify-center">
                          <span className="medida-dimensao font-bold font-mono text-[9.5px] text-slate-900 leading-tight">
                            {medidasFormatadas}
                          </span>
                          {obsEspecifica && (
                            <span className="medida-obs text-[8.5px] text-slate-500 italic font-sans leading-tight mt-0.5">
                              {obsEspecifica}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-1.5 py-0.5 text-left text-slate-800 text-[10.5px]">{descricaoItem}</td>
                      <td className="px-1.5 py-0.5 text-left text-slate-600 italic text-[9.5px]">{obsEspecifica || '-'}</td>
                      <td className="px-1.5 py-0.5 text-right font-mono">{formatCurrency(valorUnitario)}</td>
                      <td className="px-1.5 py-0.5 text-center font-mono font-bold">{qtd}</td>
                      <td className="px-1.5 py-0.5 text-right font-mono font-bold">{formatCurrency(subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-400 font-bold text-xs">
              <div className="flex gap-4 text-slate-700">
                <span>ITENS: <strong className="text-slate-900">{totalTiposItens}</strong></span>
                <span>TOTAL PEÇAS: <strong className="text-slate-900">{totalPecas} PÇ</strong></span>
              </div>
              <div className="text-xs sm:text-sm">
                TOTAL: <strong className="text-slate-950 font-mono font-black">{formatCurrency(q.grandTotal)}</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[11px] border-t border-black pt-1 mt-1 gap-1">
            <span className="text-slate-600">Assinatura Cliente: ___________________________________</span>
          </div>
        </div>

        {/* LINHA DE DESTAQUE / CORTE ENTRE AS DUAS VIAS */}
        <div className="linha-corte my-1.5 border-b border-dashed border-[#999] text-center relative w-full h-0">
          <span className="bg-white px-2.5 text-[9.5px] font-bold text-slate-500 relative -top-2">
            --- ✂ CORTE AQUI ---
          </span>
        </div>

        {/* VIA 2: EMPRESA / PRODUÇÃO (Metade Inferior) */}
        <div 
          className="via-pedido via-empresa border border-black p-2 sm:p-3 rounded bg-white flex flex-col justify-between overflow-hidden" 
          style={{ 
            minHeight: '340px',
            maxHeight: '135mm',
            pageBreakInside: 'avoid',
            breakInside: 'avoid'
          }}
        >
          <div>
            <CompanyHeader 
              tag="VIA DA EMPRESA / PRODUÇÃO"
              tagColor="amber"
              documentNumber={q.quoteNumber || '00124'}
              documentDate={q.date || new Date().toLocaleDateString('pt-BR')}
              compact={true}
            />

            <div className="text-[11px] mb-1.5 text-slate-700 flex flex-col sm:flex-row justify-between gap-1">
              <div><strong>Cliente:</strong> <span className="lbl-cliente-nome font-bold uppercase">{effectiveClientName}</span></div>
              <div><strong>Data:</strong> <span className="rel-data font-mono">{q.date || new Date().toLocaleDateString('pt-BR')}</span></div>
            </div>

            <table className="w-full text-[11px] border-collapse mb-1.5" border={1} cellPadding={2}>
              <thead>
                <tr className="bg-slate-100 font-bold text-[9.5px] uppercase border-b border-black">
                  <th className="text-left px-1.5 py-0.5">PRODUTO / MATERIAL</th>
                  <th className="text-center px-1.5 py-0.5">MEDIDAS</th>
                  <th className="text-left px-1.5 py-0.5">DESCRIÇÃO</th>
                  <th className="text-left px-1.5 py-0.5">INFORMAÇÕES</th>
                  <th className="text-right px-1.5 py-0.5">UNITÁRIO</th>
                  <th className="text-center px-1.5 py-0.5 w-10">QTD</th>
                  <th className="text-right px-1.5 py-0.5">SUBTOTAL</th>
                </tr>
              </thead>
              <tbody className="tbody-resumido divide-y divide-slate-200">
                {q.items.map((item: any, idx: number) => {
                  const produtoMaterial = item.material || 'MATERIAL';
                  const medidasFormatadas = formatarMedidasLimpa(item);
                  const descricaoItem = item.descricao || item.description || '-';
                  const obsEspecifica = getObservacaoEspecificaItem(item) || item.observacao || '';
                  const valorUnitario = Number(item.valorUnitario || item.unitPrice || 0);
                  const qtd = Number(item.qtd || item.quantity || 1);
                  const subtotal = Number(item.subtotal || item.totalPrice || (valorUnitario * qtd));

                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-1.5 py-0.5 font-bold text-slate-900">
                        <div>
                          <div style={{ fontWeight: 'bold' }} className="leading-tight">
                            {produtoMaterial}
                          </div>
                          <div
                            className="medida-obs"
                            style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '1px', lineHeight: '1.1' }}
                          >
                            {getItemDateReports(item)}
                          </div>
                        </div>
                      </td>
                      <td className="px-1.5 py-0.5 text-center">
                        <div className="medida-bloco-center flex flex-col items-center justify-center">
                          <span className="medida-dimensao font-bold font-mono text-[9.5px] text-slate-900 leading-tight">
                            {medidasFormatadas}
                          </span>
                          {obsEspecifica && (
                            <span className="medida-obs text-[8.5px] text-slate-500 italic font-sans leading-tight mt-0.5">
                              {obsEspecifica}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-1.5 py-0.5 text-left text-slate-800 text-[10.5px]">{descricaoItem}</td>
                      <td className="px-1.5 py-0.5 text-left text-slate-600 italic text-[9.5px]">{obsEspecifica || '-'}</td>
                      <td className="px-1.5 py-0.5 text-right font-mono">{formatCurrency(valorUnitario)}</td>
                      <td className="px-1.5 py-0.5 text-center font-mono font-bold">{qtd}</td>
                      <td className="px-1.5 py-0.5 text-right font-mono font-bold">{formatCurrency(subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-between items-center mt-1.5 pt-1.5 border-t border-slate-400 font-bold text-xs">
              <div className="flex gap-4 text-slate-700">
                <span>ITENS: <strong className="text-slate-900">{totalTiposItens}</strong></span>
                <span>TOTAL PEÇAS: <strong className="text-slate-900">{totalPecas} PÇ</strong></span>
              </div>
              <div className="text-xs sm:text-sm">
                TOTAL: <strong className="text-slate-950 font-mono font-black">{formatCurrency(q.grandTotal)}</strong>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[11px] border-t border-black pt-1 mt-1 gap-1">
            <span className="text-slate-600">Vendedor / Produção: ___________________________________</span>
          </div>
        </div>
      </div>

      {/* ===================================================
           4. ETIQUETAS: CUPOM 80x80mm (IDENTIFICAÇÃO DA PEÇA)
           =================================================== */}
      <div className={`print-container ${tipo === 'ETIQUETAS' ? 'block' : 'hidden'}`}>
        {q.items.map((item: any, itemIdx: number) => {
          const obsItem = getObservacaoEspecificaItem(item) || item.observacao || '';
          return (
            <div 
              key={itemIdx}
              id={`doc-etiqueta-80-${itemIdx}`}
              className="documento-modelo secao-etiqueta modelo-etiqueta-80 etiqueta-card w-full max-w-[380px] border-2 border-black rounded-lg bg-white text-black font-sans relative mx-auto shadow-2xl block mb-6 print:mb-[12mm]"
              style={{
                padding: '8px',
                breakInside: 'avoid',
                pageBreakInside: 'avoid',
                boxSizing: 'border-box'
              }}
            >
              {/* Cabeçalho da Empresa */}
              <div className="etiqueta-header text-center pb-1.5 mb-2 border-b border-black">
                <h2 className="font-black text-sm tracking-wide uppercase leading-tight text-slate-950 font-sans">
                  USICORTE METAIS
                </h2>
                <p className="text-[7px] font-bold text-slate-900 leading-tight mt-0.5 font-sans">
                  SOB CNPJ: 25.038.430/0001-23
                </p>
                <p className="text-[5px] font-semibold text-slate-800 leading-tight mt-0.5 font-sans">
                  (14) 99880-9362   (14) 99819-6873
                </p>
                <div className="text-xs font-bold text-slate-900 mt-1 pt-1 border-t border-slate-200">
                  PEDIDO Nº: <span className="font-mono font-black text-blue-900 rel-numero">{q.quoteNumber || 'COT-2026-9663'}</span>
                </div>
              </div>

              {/* Conteúdo: Dados + Desenho */}
              <div className="etiqueta-corpo grid grid-cols-12 gap-2 items-start mb-2">
                <div className="etiqueta-dados col-span-7 text-xs space-y-1 leading-tight">
                  <div>
                    <span className="font-bold text-gray-600 block text-[11px]">EMPRESA / CLIENTE:</span>
                    <span className="lbl-cliente-nome font-extrabold uppercase">{effectiveClientName}</span>
                  </div>

                  <div>
                    <span className="font-bold text-gray-600 block text-[8px]">MATERIAL:</span>
                    <span id="etiq-material" className="font-extrabold uppercase text-[10px] text-blue-950 block truncate">
                      {item.material || 'BRONZE TM-23'}
                    </span>
                  </div>

                  <div>
                    <span className="font-bold text-gray-600 block text-[8px]">MEDIDA:</span>
                    <div className="medida-bloco flex flex-col">
                      <span id="etiq-medida" className="medida-dimensao font-extrabold uppercase text-[10.5px] font-mono leading-tight text-slate-900">
                        {formatarMedidasLimpa(item) || 'Ø 50 x 200 mm'}
                      </span>
                      {obsItem && (
                        <span id="etiq-obs" className="medida-obs text-[8.5px] text-gray-500 italic font-sans leading-tight mt-0.5">
                          {obsItem}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="font-bold text-gray-600 block text-[8px]">QTD:</span>
                    <span id="etiq-qtd" className="font-black text-[10px]">
                      {item.qtd || 1} PC
                    </span>
                  </div>
                </div>

                <div 
                  id="box-foto-etiqueta"
                  className="etiqueta-foto-box col-span-5 border-2 border-dashed border-gray-400 p-1 rounded flex items-center justify-center min-h-[105px] bg-slate-50 overflow-hidden"
                >
                  <EtiquetaDesenho
                    material={item.material || item.descricao}
                    medida={formatarMedidasLimpa(item) || item.medida}
                    observacao={obsItem || ''}
                    descricao={item.descricao || item.material}
                    imagem={item.drawingImage}
                    engrossarTracos={true}
                  />
                </div>
              </div>

              <div className="etiqueta-footer pt-1.5 pb-0.5 text-center mt-auto">
                <span className="site-url text-[9.5px] font-bold tracking-widest text-black uppercase block">
                  www.usicortemetais.com.br
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================================================
           5. CORTE: ORDEM DE CORTE CHÃO DE FÁBRICA
           =================================================== */}
      <div
        id="doc-corte"
        className={`documento-modelo secao-corte bg-white text-slate-900 p-6 rounded-xl shadow-2xl font-sans w-full max-w-4xl mx-auto ${
          tipo === 'CORTE' ? 'block' : 'hidden'
        }`}
      >
        <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
          <div>
            <h2 className="m-0 text-lg font-black uppercase tracking-wide">Ordem de Corte</h2>
            <div className="flex flex-wrap items-center gap-x-3 text-[11px] font-semibold text-slate-600 uppercase mt-0.5">
              <p className="m-0">
                Cliente: <span className="text-black font-bold">{effectiveClientName}</span>
              </p>
              <span className="text-slate-400">•</span>
              <p className="m-0">
                Cotação: <span className="text-black font-bold font-mono">{q.quoteNumber || '-'}</span>
              </p>
            </div>
          </div>
          <div className="text-right text-[11px] font-semibold text-slate-600">
            <p className="m-0">Data: {new Date().toLocaleDateString('pt-BR')}</p>
            <p className="m-0">Itens: {q.items.length}</p>
          </div>
        </div>

        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-slate-200">
              <th className="border border-black p-1.5 text-left">Observação</th>
              <th className="border border-black p-1.5 text-left">Produto / Material</th>
              <th className="border border-black p-1.5 text-left">Medidas</th>
              <th className="border border-black p-1.5 text-left">Descrição</th>
              <th className="border border-black p-1.5 text-center w-12">Qtd</th>
              <th className="border border-black p-1.5 text-center w-16">Cortado</th>
            </tr>
          </thead>
          <tbody>
            {q.items.map((item: any, idx: number) => {
              const obsItem = getObservacaoEspecificaItem(item) || item.observacao || '';
              return (
                <tr key={item.id || idx}>
                  <td className="border border-black p-1.5 font-bold uppercase">{obsItem || '-'}</td>
                  <td className="border border-black p-1.5 uppercase font-bold">
                    <div>
                      <div style={{ fontWeight: 'bold' }} className="leading-tight">
                        {item.material || 'MATERIAL'}
                      </div>
                      <div
                        className="medida-obs"
                        style={{ fontSize: '9px', fontStyle: 'italic', color: '#6b7280', fontWeight: 'normal', marginTop: '2px', lineHeight: '1.2' }}
                      >
                        {getItemDateReports(item)}
                      </div>
                    </div>
                  </td>
                  <td className="border border-black p-1.5">
                    <div className="medida-bloco flex flex-col">
                      <span className="medida-dimensao font-bold font-mono text-slate-900">{formatarMedidasLimpa(item)}</span>
                      {obsItem && (
                        <span className="medida-obs text-[9px] text-gray-500 italic font-sans mt-0.5">
                          {obsItem}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="border border-black p-1.5 uppercase">{item.descricao || item.description || '-'}</td>
                  <td className="border border-black p-1.5 text-center font-bold">{item.qtd || 1}</td>
                  <td className="border border-black p-1.5 text-center">
                    <span className="inline-block w-4 h-4 border-2 border-black align-middle" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-center">
          www.usicortemetais.com.br
        </p>
      </div>

      {/* ===================================================
           6. ORDEM DE CORTE TÉRMICO 80MM (CUPOM TÉRMICO)
           =================================================== */}
      <div 
        id="doc-corte-80mm" 
        className={`documento-modelo secao-corte-80mm print-container bg-white text-black p-1 font-mono w-full max-w-[80mm] mx-auto box-border overflow-x-hidden print:overflow-visible print:h-auto print:max-h-none print:min-h-0 print:p-0 ${
          tipo === 'CORTE_80MM' ? 'block' : 'hidden'
        }`}
      >
        <OrdemCorte80mm
          itens={q.items}
          cliente={effectiveClientName}
          numeroPedido={q.quoteNumber || '00124'}
          data={q.date || new Date().toLocaleDateString('pt-BR')}
        />
      </div>
    </div>
  );
}

// ============================================================================
// SERVIÇO GLOBAL DE IMPRESSÃO - UTILIZADO NA CONSULTA E NO SALVAMENTO DO PDV
// ============================================================================

let activePrintPortalContainer: HTMLDivElement | null = null;

// Função executora que aplica a classe correta ao body e aciona window.print()
export function dispararImpressaoConsulta(
  orcamento: any, 
  tipo: TipoImpressaoConsulta,
  onAfterPrintCallback?: () => void
) {
  const quoteNormalizado = normalizeQuoteForPrint(orcamento);
  if (!quoteNormalizado) return;

  // Para o cupom de corte térmico 80mm, imprime em janela popup isolada
  // evitando que o navegador assuma a página inteira A4 e encolha o cupom
  if (tipo === 'CORTE_80MM') {
    imprimirCupom80mm(quoteNormalizado, onAfterPrintCallback);
    return;
  }

  // Remove qualquer classe anterior de impressão
  document.body.classList.remove(
    'print-pedido', 
    'print-etiqueta', 
    'print-proposta', 
    'print-corte', 
    'print-corte-80',
    'print-geral', 
    'print-empresa'
  );

  // Define a classe correta conforme o modelo
  if (tipo === 'CORTE') {
    document.body.classList.add('print-corte');
  } else if (tipo === 'GERAL') {
    document.body.classList.add('print-geral');
  } else if (tipo === 'EMPRESA') {
    document.body.classList.add('print-empresa');
  } else if (tipo === 'PEDIDO') {
    document.body.classList.add('print-pedido');
  } else if (tipo === 'ETIQUETAS') {
    document.body.classList.add('print-etiqueta');
  }

  // Listener para limpar as classes e container após a impressão
  const handleAfterPrint = () => {
    document.body.classList.remove(
      'print-pedido', 
      'print-etiqueta', 
      'print-proposta', 
      'print-corte', 
      'print-corte-80',
      'print-geral', 
      'print-empresa'
    );
    window.removeEventListener('afterprint', handleAfterPrint);
    if (onAfterPrintCallback) {
      onAfterPrintCallback();
    }
  };
  window.addEventListener('afterprint', handleAfterPrint);

  // Aciona a caixa de impressão do navegador após breve delay para estabilização do DOM
  setTimeout(() => {
    window.print();
  }, 250);
}

// Funções solicitadas nominalmente pelo usuário:
export function imprimirOrcamentoGeral(orcamentoSalvo: any, onAfterPrint?: () => void) {
  dispararImpressaoConsulta(orcamentoSalvo, 'GERAL', onAfterPrint);
}

export function imprimirOrcamentoEmpresa(orcamentoSalvo: any, onAfterPrint?: () => void) {
  dispararImpressaoConsulta(orcamentoSalvo, 'EMPRESA', onAfterPrint);
}

export function imprimirOrcamentoPedido(orcamentoSalvo: any, onAfterPrint?: () => void) {
  dispararImpressaoConsulta(orcamentoSalvo, 'PEDIDO', onAfterPrint);
}

export function imprimirEtiquetas(orcamentoSalvo: any, onAfterPrint?: () => void) {
  dispararImpressaoConsulta(orcamentoSalvo, 'ETIQUETAS', onAfterPrint);
}

export function imprimirFichaCorte(orcamentoSalvo: any, onAfterPrint?: () => void) {
  dispararImpressaoConsulta(orcamentoSalvo, 'CORTE', onAfterPrint);
}

export function imprimirOrdemCorte80mm(orcamentoSalvo: any, onAfterPrint?: () => void) {
  const norm = normalizeQuoteForPrint(orcamentoSalvo) || orcamentoSalvo;
  imprimirCupom80mm(norm, onAfterPrint);
}

export const imprimirCupomCorte80mm = imprimirOrdemCorte80mm;
export { imprimirCupom80mm, gerarHtmlCupom80mm };
