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

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Identifica a forma geométrica / perfil do item para chão de fábrica
 */
export function resolverFormaItem(item: any): string {
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

/**
 * Gera o código HTML completo da Ordem de Corte 80mm
 * Ocupando 100% da largura útil da bobina de 80mm com alto contraste
 */
export function gerarHtmlCupom80mm(dadosOrdem: any): string {
  const listaItens = dadosOrdem?.itens || dadosOrdem?.items || [];
  const nomeCliente = (
    dadosOrdem?.cliente?.nome ||
    dadosOrdem?.cliente ||
    dadosOrdem?.clientName ||
    dadosOrdem?.client?.name ||
    dadosOrdem?.empresa ||
    'CLIENTE BALCÃO'
  ).toString().trim().toUpperCase();

  const numCotacao = (
    dadosOrdem?.quoteNumber ||
    dadosOrdem?.numeroPedido ||
    dadosOrdem?.id ||
    dadosOrdem?.numero ||
    'S/N'
  ).toString().trim();

  const dataRef = dadosOrdem?.data || dadosOrdem?.date || formatSafeDate(new Date());
  const agora = new Date();
  const horaFormatada = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dataHoraImpressao = `${dataRef} às ${horaFormatada}`;

  const totalTiposItens = listaItens.length;
  const totalPecas = listaItens.reduce((acc: number, it: any) => acc + (Number(it?.qtd ?? it?.quantity) || 1), 0);

  const itensHtml = listaItens.length === 0
    ? `
      <div style="width: 100%; padding: 12px; text-align: center; border: 2px solid #000; font-weight: bold; font-size: 13px; box-sizing: border-box;">
        NENHUM ITEM PARA CORTE
      </div>
    `
    : listaItens.map((item: any, idx: number) => {
        const numItem = idx + 1;
        const qtd = Number(item?.qtd ?? item?.quantity) || 1;
        const material = item?.material || item?.constanteNome || item?.constantName || item?.produto || 'MATERIAL';
        const medidas = formatarMedidasLimpa(item) || item?.medida || item?.dimensions || item?.medidas || '—';
        const forma = resolverFormaItem(item);
        const obsEspecifica = getObservacaoEspecificaItem(item);
        const obsCod = obsEspecifica || item?.observacao || item?.notes || item?.descricao || item?.description || '-';

        return `
          <div class="card-item">
            <div class="flex-between" style="border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; font-weight: 900;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="display: inline-block; width: 14px; height: 14px; border: 2px solid #000; background: #fff; flex-shrink: 0;"></span>
                <span style="font-size: 13px; font-weight: 900;">CORTADO</span>
                <span style="margin: 0 2px;">|</span>
                <span style="font-size: 14px; font-weight: 900;">ITEM #${numItem}</span>
              </div>
              <span style="font-size: 14px; font-weight: 900; text-align: right; text-transform: uppercase;">QTD: ${qtd} PÇS</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
              <div class="row-field">
                <span class="field-label">MATERIAL:</span>
                <span class="field-value">${escapeHtml(material)}</span>
              </div>
              <div class="row-field">
                <span class="field-label">MEDIDAS:</span>
                <span class="field-value" style="font-family: monospace;">${escapeHtml(medidas)}</span>
              </div>
              <div class="row-field">
                <span class="field-label">FORMA:</span>
                <span class="field-value">${escapeHtml(forma)}</span>
              </div>
              <div class="row-field">
                <span class="field-label">OBS/COD:</span>
                <span class="field-value">${escapeHtml(obsCod)}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

  return `
    <div style="width: 100%; max-width: 80mm; margin: 0 auto; box-sizing: border-box; text-align: left;">
      <!-- CABEÇALHO COMPACTO -->
      <header style="text-align: center; width: 100%; margin-bottom: 4px;">
        <h1 style="font-size: 18px; font-weight: 900; margin: 0; padding: 0; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
          === ORDEM DE CORTE ===
        </h1>
        <div style="font-size: 14px; font-weight: 900; margin-top: 3px; text-transform: uppercase; letter-spacing: 1px;">
          USICORTE METAIS
        </div>

        <div class="hr-line"></div>

        <div style="width: 100%; display: flex; flex-direction: column; gap: 4px; text-align: left;">
          <div class="flex-between" style="align-items: flex-start;">
            <span style="font-weight: bold; min-width: 80px; font-size: 13px;">CLIENTE:</span>
            <span style="font-weight: 900; font-size: 14px; text-align: right; flex: 1; text-transform: uppercase; word-break: break-word;">${escapeHtml(nomeCliente)}</span>
          </div>
          <div class="flex-between" style="align-items: center;">
            <span style="font-weight: bold; min-width: 80px; font-size: 13px;">COTAÇÃO:</span>
            <span style="font-weight: 900; font-size: 14px; text-align: right; flex: 1; font-family: monospace;">#${escapeHtml(numCotacao)}</span>
          </div>
          <div class="flex-between" style="align-items: center;">
            <span style="font-weight: bold; min-width: 80px; font-size: 13px;">DATA/HORA:</span>
            <span style="font-weight: 900; font-size: 13px; text-align: right; flex: 1;">${escapeHtml(dataHoraImpressao)}</span>
          </div>
        </div>

        <div class="hr-line"></div>
      </header>

      <!-- LISTA DE ITENS -->
      <main style="width: 100%; margin: 4px 0;">
        ${itensHtml}
      </main>

      <!-- RODAPÉ DO CUPOM -->
      <footer style="width: 100%; margin-top: 4px; page-break-inside: avoid; break-inside: avoid;">
        <div class="hr-line"></div>

        <div class="flex-between" style="font-size: 14px; font-weight: 900; padding: 0 2px; text-transform: uppercase;">
          <span>ITENS: ${totalTiposItens}</span>
          <span>TOTAL: ${totalPecas} ${totalPecas === 1 ? 'PEÇA' : 'PEÇAS'}</span>
        </div>

        <div style="width: 100%; margin-top: 10px; margin-bottom: 12px;">
          <div style="font-size: 13px; font-weight: 900; text-transform: uppercase; margin-bottom: 4px;">
            VISTO DO OPERADOR:
          </div>
          <div style="border-bottom: 2px solid #000; width: 100%; margin-top: 22px; margin-bottom: 4px;"></div>
        </div>

        <div style="text-align: center; font-size: 16px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 10px;">
          USICORTE METAIS
        </div>
        <div style="text-align: center; font-size: 11px; font-weight: 900; text-transform: uppercase; margin-top: 2px;">
          CORTE CNC & USINAGEM
        </div>
      </footer>
    </div>
  `;
}

/**
 * Função de Impressão em Janela Popup Isolada (para POS-80C e bobinas de 80mm)
 * Garante que o navegador imprima estritamente no rolo térmico sem assumir folha A4
 */
export function imprimirCupom80mm(dadosOrdem: any, onAfterPrint?: () => void): void {
  const larguraTela = window.screen.availWidth || 1024;
  const alturaTela = window.screen.availHeight || 768;

  const janela = window.open(
    '',
    '_blank',
    `width=${larguraTela},height=${alturaTela},top=0,left=0,resizable=yes,scrollbars=yes`
  );

  if (janela) {
    try {
      janela.moveTo(0, 0);
      janela.resizeTo(screen.width, screen.height);
      janela.focus();
    } catch (e) {
      console.warn('Erro ao posicionar/maximizar janela:', e);
    }
  }

  const corpoHtml = gerarHtmlCupom80mm(dadosOrdem);
  const numCotacao = dadosOrdem?.quoteNumber || dadosOrdem?.numeroPedido || dadosOrdem?.id || '';

  const docHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ordem de Corte 80mm${numCotacao ? ` - #${numCotacao}` : ''}</title>
        <style>
          @page {
            size: 80mm auto;
            margin: 0mm;
          }
          html, body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            background-color: #f1f5f9;
            font-family: monospace, sans-serif;
            color: #000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          * {
            box-sizing: border-box;
            color: #000 !important;
            border-color: #000 !important;
          }
          /* Contêiner do cupom térmico centralizado na tela maximizada */
          .cupom-tela-wrapper {
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh;
            width: 100%;
            padding: 24px 16px;
            box-sizing: border-box;
          }
          .cupom-card {
            width: 80mm;
            max-width: 80mm;
            background: #ffffff;
            padding: 4mm;
            border-radius: 4px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            box-sizing: border-box;
          }
          .hr-line {
            border-bottom: 2px dashed #000;
            margin: 8px 0;
            width: 100%;
          }
          .card-item {
            border: 2px solid #000;
            padding: 6px;
            margin-bottom: 8px;
            width: 100%;
            page-break-inside: avoid;
            break-inside: avoid;
            background: #fff;
            box-sizing: border-box;
          }
          .flex-between {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
          }
          .row-field {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            width: 100%;
            padding: 1px 0;
            line-height: 1.3;
          }
          .field-label {
            font-weight: bold;
            min-width: 90px;
            flex-shrink: 0;
            font-size: 13px;
          }
          .field-value {
            font-weight: 900;
            text-align: right;
            flex: 1;
            font-size: 14px;
            word-break: break-word;
            text-transform: uppercase;
          }
          @media print {
            @page {
              size: 80mm auto;
              margin: 0mm;
            }
            html, body {
              width: 80mm !important;
              max-width: 80mm !important;
              min-height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
            }
            .cupom-tela-wrapper {
              display: block !important;
              width: 80mm !important;
              max-width: 80mm !important;
              min-height: auto !important;
              padding: 0 !important;
              margin: 0 !important;
            }
            .cupom-card {
              width: 80mm !important;
              max-width: 80mm !important;
              margin: 0 !important;
              padding: 3mm !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
            }
            .card-item {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
            * {
              color: #000000 !important;
              border-color: #000000 !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="cupom-tela-wrapper">
          <div class="cupom-card">
            ${corpoHtml}
          </div>
        </div>
        <script>
          function dispararImpressao() {
            try {
              window.moveTo(0, 0);
              window.resizeTo(screen.width, screen.height);
              window.focus();
            } catch(e) {}

            // Garante que a janela já esteja totalmente expandida e com o layout pronto antes do diálogo de impressão
            setTimeout(function() {
              window.focus();
              window.print();
              setTimeout(function() {
                try { window.close(); } catch(e) {}
              }, 800);
            }, 250);
          }
          if (document.readyState === 'complete') {
            dispararImpressao();
          } else {
            window.onload = function() {
              dispararImpressao();
            };
          }
        </script>
      </body>
    </html>
  `;

  if (janela) {
    janela.document.open();
    janela.document.write(docHtml);
    janela.document.close();
    if (onAfterPrint) {
      janela.onafterprint = onAfterPrint;
    }
    return;
  }

  // Fallback seguro caso o navegador bloqueie popups:
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '80mm';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.zIndex = '-9999';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(docHtml);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Erro ao disparar impressão via iframe:', err);
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
          if (onAfterPrint) onAfterPrint();
        }, 1500);
      }
    }, 300);
  }
}

/**
 * Alias para manter compatibilidade com nomes anteriores
 */
export const imprimirOrdemCorte80mm = imprimirCupom80mm;

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

      {/* Botão de Impressão Direta em Janela Isolada (Visível apenas em tela / Oculto na impressão) */}
      <div className="w-full mb-3 print:hidden no-print">
        <button
          type="button"
          onClick={() =>
            imprimirCupom80mm({
              itens: listaItens,
              cliente: nomeCliente,
              numeroPedido: numCotacao,
              data: dataRef,
            })
          }
          className="w-full py-2.5 px-3 bg-black hover:bg-neutral-800 text-white font-mono font-bold text-xs rounded uppercase tracking-wider flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all border border-black"
          title="Abrir e imprimir na janela popup isolada de 80mm"
        >
          <span>🖨️</span>
          <span>IMPRIMIR CUPOM 80MM (POPUP ISOLADO)</span>
        </button>
      </div>

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
