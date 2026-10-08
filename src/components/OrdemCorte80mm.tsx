import React from 'react';
import { formatSafeDate, formatarMedidasLimpa, getObservacaoEspecificaItem } from '../utils/calculator';

export interface OrdemCorte80mmProps {
  itens?: any[];
  items?: any[];
  cliente?: string;
  clientName?: string;
  numeroPedido?: string;
  quoteNumber?: string;
  data?: string;
  date?: string;
  className?: string;
}

/**
 * Identifica a forma geométrica / perfil do item para chão de fábrica
 */
function resolverFormaItem(item: any): string {
  if (item?.forma) return String(item.forma).toUpperCase();

  const geom = String(item?.geometryType || item?.profileType || '').toLowerCase();
  if (geom.includes('chapa') || geom.includes('retang')) return 'RETÂNGULO';
  if (geom.includes('macico') || geom.includes('redond')) return 'REDONDO';
  if (geom.includes('bucha') || geom.includes('tubo')) return 'TUBO / BUCHA';

  const desc = String(item?.descricao || item?.description || item?.produto || item?.material || '').toLowerCase();
  if (desc.includes('redond') || desc.includes('disco') || desc.includes('anel') || desc.includes('flange') || desc.includes('ø')) {
    return 'REDONDO';
  }
  if (desc.includes('quadrad')) {
    return 'QUADRADO';
  }
  if (desc.includes('tubo') || desc.includes('bucha')) {
    return 'TUBO / BUCHA';
  }
  if (desc.includes('chapa') || desc.includes('retang') || desc.includes('bloco') || desc.includes('barra')) {
    return 'RETÂNGULO';
  }

  // Verifica medida para diâmetro (Ø)
  const med = String(item?.medida || item?.dimensions || '').toLowerCase();
  if (med.includes('ø') || med.includes('diam')) return 'REDONDO';

  return 'RETÂNGULO';
}

export default function OrdemCorte80mm({
  itens,
  items,
  cliente,
  clientName,
  numeroPedido,
  quoteNumber,
  data,
  date,
  className = ''
}: OrdemCorte80mmProps) {
  const listaItens = itens || items || [];
  const nomeCliente = (cliente || clientName || 'CLIENTE BALCÃO').trim();
  const numCotacao = (numeroPedido || quoteNumber || 'S/N').trim();

  // Data e hora de impressão em alto contraste
  const dataRef = data || date || formatSafeDate(new Date());
  const agora = new Date();
  const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataHoraImpressao = `${dataRef} às ${horaFormatada}`;

  // Totais calculados
  const totalTiposItens = listaItens.length;
  const totalPecas = listaItens.reduce((acc, it) => acc + (Number(it?.qtd ?? it?.quantity) || 1), 0);

  return (
    <div
      className={`ordem-corte-80mm-root w-full bg-white text-black font-mono select-text box-border ${className}`}
      style={{
        width: '100%',
        maxWidth: '80mm',
        margin: '0 auto',
        padding: '4px',
        boxSizing: 'border-box',
        color: '#000000',
        backgroundColor: '#ffffff',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact'
      }}
    >
      {/* Estilos específicos de impressão incorporados diretamente no cupom */}
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body, .print-container {
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 3mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          body.print-corte-80,
          body.print-corte-80 .print-container,
          body.print-corte-80 .ordem-corte-80mm-root {
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 3mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            color: #000000 !important;
          }
          * {
            color: #000000 !important;
            border-color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .ordem-corte-80mm-root {
            width: 100% !important;
            max-width: 80mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
          .bloco-item-corte {
            width: 100% !important;
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* =========================================================================
          1. CABEÇALHO COMPACTO (CUPOM TÉRMICO 80MM)
          ========================================================================= */}
      <header className="w-full text-center pb-1">
        <h1 
          className="w-full font-black text-center tracking-wider leading-tight m-0 uppercase"
          style={{ fontSize: '18px', color: '#000000', fontWeight: 900 }}
        >
          === ORDEM DE CORTE ===
        </h1>
        <div 
          className="w-full font-black text-center tracking-widest mt-0.5 uppercase"
          style={{ fontSize: '14px', color: '#000000', fontWeight: 900 }}
        >
          USICORTE METAIS
        </div>

        {/* Linha Divisória de Largura Total */}
        <div className="w-full border-b-2 border-dashed border-black my-2" />

        {/* Dados do Pedido / Destino com Flexbox de Largura Total */}
        <div className="w-full text-left space-y-1.5" style={{ color: '#000000' }}>
          <div className="flex justify-between items-start w-full leading-snug">
            <span className="font-bold min-w-[80px] shrink-0 text-black" style={{ fontSize: '13px' }}>
              CLIENTE:
            </span>
            <span className="font-bold uppercase break-words text-right flex-1 text-black" style={{ fontSize: '14px', fontWeight: 900 }}>
              {nomeCliente.toUpperCase()}
            </span>
          </div>

          <div className="flex justify-between items-center w-full leading-snug">
            <span className="font-bold min-w-[80px] shrink-0 text-black" style={{ fontSize: '13px' }}>
              COTAÇÃO:
            </span>
            <span className="font-bold font-mono text-right flex-1 text-black" style={{ fontSize: '14px', fontWeight: 900 }}>
              #{numCotacao}
            </span>
          </div>

          <div className="flex justify-between items-center w-full leading-snug">
            <span className="font-bold min-w-[80px] shrink-0 text-black" style={{ fontSize: '13px' }}>
              DATA/HORA:
            </span>
            <span className="font-bold text-right flex-1 text-black" style={{ fontSize: '13px', fontWeight: 900 }}>
              {dataHoraImpressao}
            </span>
          </div>
        </div>

        {/* Linha Divisória de Largura Total */}
        <div className="w-full border-b-2 border-dashed border-black my-2" />
      </header>

      {/* =========================================================================
          2. LISTA DE ITENS (ESTRUTURA EMPILHADA EM BLOCOS DE LARGURA TOTAL 100%)
          ========================================================================= */}
      <main className="w-full space-y-2.5 my-1">
        {listaItens.length === 0 ? (
          <div 
            className="w-full p-3 text-center border-2 border-black font-bold text-xs box-border"
            style={{ border: '2px solid #000000', color: '#000000' }}
          >
            NENHUM ITEM PARA CORTE
          </div>
        ) : (
          listaItens.map((item: any, idx: number) => {
            const numItem = idx + 1;
            const qtd = Number(item?.qtd ?? item?.quantity) || 1;
            const material = item?.material || item?.constanteNome || item?.constantName || item?.produto || 'MATERIAL';
            const medidas = formatarMedidasLimpa(item) || item?.medida || item?.dimensions || item?.medidas || '—';
            const forma = resolverFormaItem(item);
            const obsEspecifica = getObservacaoEspecificaItem(item);
            const obsCod = obsEspecifica || item?.observacao || item?.notes || item?.descricao || item?.description || '-';

            return (
              <section
                key={item?.id || item?.idVer || idx}
                className="bloco-item-corte w-full border-2 border-black p-2 my-2 bg-white box-border"
                style={{
                  border: '2px solid #000000',
                  borderRadius: '3px',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid',
                  backgroundColor: '#ffffff',
                  boxSizing: 'border-box'
                }}
              >
                {/* ┌────────────────────────────────────────┐
                    │ [  ] CORTADO  |  ITEM #1   |  QTD: 2 PÇS│
                    └────────────────────────────────────────┘ */}
                <div 
                  className="flex justify-between items-center w-full pb-1.5 font-black"
                  style={{
                    borderBottom: '2px solid #000000',
                    color: '#000000'
                  }}
                >
                  {/* Lado Esquerdo: Checkbox + Cortado + Item # */}
                  <div className="flex items-center gap-1.5">
                    <span 
                      className="inline-block bg-white shrink-0" 
                      style={{ 
                        width: '14px', 
                        height: '14px', 
                        border: '2px solid #000000',
                        backgroundColor: '#ffffff'
                      }} 
                    />
                    <span style={{ fontSize: '13px', fontWeight: 900 }}>CORTADO</span>
                    <span className="text-black font-black mx-0.5">|</span>
                    <span style={{ fontSize: '14px', fontWeight: 900 }}>
                      ITEM #{numItem}
                    </span>
                  </div>

                  {/* Lado Direito: Quantidade Empurrada para a Borda Direita */}
                  <span 
                    className="font-black uppercase text-right"
                    style={{ fontSize: '14px', fontWeight: 900 }}
                  >
                    QTD: {qtd} PÇS
                  </span>
                </div>

                {/* ┌────────────────────────────────────────┐
                    │ MATERIAL: OXICORTE A36                 │
                    │ MEDIDAS:  1" x 50 x 195 mm             │
                    │ FORMA:    RETANGULO                    │
                    │ OBS/COD:  PCM 055                      │
                    └────────────────────────────────────────┘ */}
                <div 
                  className="w-full pt-1.5 space-y-1 leading-snug bg-white"
                  style={{ color: '#000000' }}
                >
                  <div className="flex justify-between items-start w-full py-0.5">
                    <span className="font-bold min-w-[90px] shrink-0 text-black" style={{ fontSize: '13px' }}>
                      MATERIAL:
                    </span>
                    <span 
                      className="font-black uppercase break-words text-right flex-1 text-black" 
                      style={{ fontSize: '14px', fontWeight: 900 }}
                    >
                      {material}
                    </span>
                  </div>

                  <div className="flex justify-between items-start w-full py-0.5">
                    <span className="font-bold min-w-[90px] shrink-0 text-black" style={{ fontSize: '13px' }}>
                      MEDIDAS:
                    </span>
                    <span 
                      className="font-black uppercase font-mono break-words text-right flex-1 text-black" 
                      style={{ fontSize: '14px', fontWeight: 900 }}
                    >
                      {medidas}
                    </span>
                  </div>

                  <div className="flex justify-between items-start w-full py-0.5">
                    <span className="font-bold min-w-[90px] shrink-0 text-black" style={{ fontSize: '13px' }}>
                      FORMA:
                    </span>
                    <span 
                      className="font-black uppercase break-words text-right flex-1 text-black" 
                      style={{ fontSize: '13px', fontWeight: 900 }}
                    >
                      {forma}
                    </span>
                  </div>

                  <div className="flex justify-between items-start w-full py-0.5">
                    <span className="font-bold min-w-[90px] shrink-0 text-black" style={{ fontSize: '13px' }}>
                      OBS/COD:
                    </span>
                    <span 
                      className="font-black uppercase break-words text-right flex-1 text-black" 
                      style={{ fontSize: '13.5px', fontWeight: 900 }}
                    >
                      {obsCod}
                    </span>
                  </div>
                </div>
              </section>
            );
          })
        )}
      </main>

      {/* =========================================================================
          3. RODAPÉ DO CUPOM TÉRMICO (80MM)
          ========================================================================= */}
      <footer className="w-full pt-1" style={{ color: '#000000', pageBreakInside: 'avoid', breakInside: 'avoid' }}>
        {/* Linha Divisória de Largura Total */}
        <div className="w-full border-b-2 border-dashed border-black my-2" />

        {/* Totais da Ordem Alinhados nas Extremidades */}
        <div 
          className="flex justify-between items-center w-full px-0.5 font-black uppercase"
          style={{ fontSize: '14px', color: '#000000', fontWeight: 900 }}
        >
          <span>ITENS: {totalTiposItens}</span>
          <span>TOTAL: {totalPecas} {totalPecas === 1 ? 'PEÇA' : 'PEÇAS'}</span>
        </div>

        {/* Campo para Visto do Operador no Chão de Fábrica */}
        <div className="pt-3 pb-1 w-full">
          <div 
            className="flex justify-between items-center w-full font-black uppercase mb-1" 
            style={{ fontSize: '13px', color: '#000000', fontWeight: 900 }}
          >
            <span>VISTO DO OPERADOR:</span>
          </div>
          <div 
            className="w-full border-b-2 border-black mt-4 mb-2" 
            style={{ 
              borderBottom: '2px solid #000000', 
              width: '100%' 
            }} 
          />
        </div>

        {/* Assinatura Final da Marca Centralizada */}
        <div 
          className="w-full text-center pt-2 font-black uppercase tracking-widest"
          style={{ fontSize: '16px', color: '#000000', fontWeight: 900 }}
        >
          USICORTE METAIS
        </div>
        <div 
          className="w-full text-center font-bold text-xs mt-0.5"
          style={{ color: '#000000', fontWeight: 900 }}
        >
          CORTE CNC & USINAGEM
        </div>
      </footer>
    </div>
  );
}
