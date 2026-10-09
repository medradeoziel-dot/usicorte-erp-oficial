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
  operador?: string;
  operator?: string;
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
 * Obtém o nome do operador responsável ativo (do pedido ou utilizador logado no sistema)
 */
export function getOperadorResponsavel(dadosOrdem?: any): string {
  let op = dadosOrdem?.operador || dadosOrdem?.operator || dadosOrdem?.vendedor || dadosOrdem?.responsavel || dadosOrdem?.usuario || '';
  if (!op && typeof window !== 'undefined') {
    try {
      op = sessionStorage.getItem('usuario_logado') || localStorage.getItem('usuario_logado') || '';
      if (!op) {
        const perfilStr = sessionStorage.getItem('usuario_perfil');
        if (perfilStr) {
          const p = JSON.parse(perfilStr);
          op = p?.nome || p?.nome_completo || p?.name || '';
        }
      }
    } catch {}
  }
  return String(op || '').trim().toUpperCase();
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
 * Remove prefixos como '#COT-', 'COT-', '#' deixando apenas o número da cotação
 * Exemplo: '#COT-2026-000509' -> '2026-000509'
 */
export function formatarNumeroCotacaoSemPrefixo(valor: any): string {
  if (valor === null || valor === undefined) return 'S/N';
  let str = String(valor).trim();
  str = str.replace(/^(#?COT-?|#?ORC-?|#)/i, '').trim();
  return str || 'S/N';
}

/**
 * Monta a linha 2 do item: Medidas (item.medidas) seguidas da Descrição/Forma (item.descricao / item.forma)
 * Exemplo: 2" X 66 MM - RETÂNGULO ou 2" X 66 MM - CONF DESENHO
 */
export function resolverMedidasDescricaoForma(item: any): string {
  const medBruta = (
    item?.medidas ||
    item?.medida ||
    item?.medidaFormatada ||
    item?.medidasFormatadas ||
    item?.dimensions ||
    formatarMedidasLimpa(item) ||
    ''
  ).toString().trim();

  const descBruta = (
    item?.descricao ||
    item?.description ||
    item?.forma ||
    ''
  ).toString().trim();

  const formaResolvida = resolverFormaItem(item) || 'RETÂNGULO';

  let descFinal = '';
  if (descBruta && descBruta.toUpperCase() !== 'ITEM INDUSTRIAL' && descBruta.toUpperCase() !== 'MATERIAL') {
    descFinal = descBruta.toUpperCase();
  } else if (formaResolvida) {
    descFinal = formaResolvida.toUpperCase();
  }

  const medLimpa = (medBruta === '—' || medBruta === '-') ? '' : medBruta;

  if (!medLimpa) {
    return descFinal || formaResolvida || '-';
  }

  if (descFinal && !medLimpa.toUpperCase().includes(descFinal) && !descFinal.includes(medLimpa.toUpperCase())) {
    return `${medLimpa} - ${descFinal}`;
  }

  if (!medLimpa.toUpperCase().includes(formaResolvida.toUpperCase())) {
    return `${medLimpa} - ${formaResolvida}`;
  }

  return medLimpa;
}

/**
 * Obtém SOMENTE o conteúdo do campo Observação (item.observacao).
 * Não junte nem repita o campo Descrição aqui.
 * Se vazio, retorna string vazia para não renderizar linha em branco.
 */
export function resolverObservacaoItem(item: any): string {
  const raw = item?.observacao ?? item?.obs ?? item?.notes ?? getObservacaoEspecificaItem(item) ?? item?.informacoes ?? item?.observacoes ?? '';
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (
    !trimmed ||
    trimmed === '-' ||
    trimmed === '—' ||
    trimmed.toLowerCase() === 'n/a' ||
    trimmed.toLowerCase().includes('preços com impostos') ||
    trimmed.toLowerCase().includes('material sujeito a conferência')
  ) {
    return '';
  }
  return trimmed.toUpperCase();
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
    dadosOrdem?.cliente_nome ||
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
  const operador = getOperadorResponsavel(dadosOrdem);

  const itensHtml = listaItens.length === 0
    ? `
      <div style="width: 100%; padding: 12px; text-align: center; border: 2px solid #000; font-weight: bold; font-size: 13px; box-sizing: border-box;">
        NENHUM ITEM PARA CORTE
      </div>
    `
    : listaItens.map((item: any, _idx: number) => {
        const qtd = Number(item?.qtd ?? item?.quantity) || 1;

        // Cotação específica do item ou cotação geral da ordem (sem prefixo #COT-)
        const itemCotacao = (
          item?.quoteNumber ||
          item?.numeroPedido ||
          item?.cotacao ||
          item?.numero ||
          numCotacao ||
          'S/N'
        ).toString().trim();
        const numCotacaoLimpo = formatarNumeroCotacaoSemPrefixo(itemCotacao);

        // Cliente específico do item ou cliente geral da ordem
        const clienteItem = (
          item?.cliente_nome ||
          item?.cliente?.nome ||
          item?.cliente ||
          item?.clientName ||
          item?.client?.name ||
          item?.empresa ||
          dadosOrdem?.cliente_nome ||
          dadosOrdem?.cliente?.nome ||
          dadosOrdem?.cliente ||
          dadosOrdem?.clientName ||
          dadosOrdem?.client?.name ||
          dadosOrdem?.empresa ||
          nomeCliente ||
          'CLIENTE BALCÃO'
        ).toString().trim().toUpperCase();

        const medidasDescForma = resolverMedidasDescricaoForma(item);
        const obsItem = resolverObservacaoItem(item);

        return `
          <div class="card-item">
            <!-- CABEÇALHO DO QUADRADO (LINHA SUPERIOR): COTAÇÃO À ESQUERDA E QTD À DIREITA -->
            <div class="flex-between" style="border-bottom: 2px solid #000; padding-bottom: 4px; margin-bottom: 6px; font-weight: 900; font-size: 13px; line-height: 1.2;">
              <span style="font-size: 13px; font-weight: 900; font-family: monospace;">${escapeHtml(numCotacaoLimpo)}</span>
              <span style="font-size: 13px; font-weight: 900; text-transform: uppercase;">QTD: ${qtd} PÇS</span>
            </div>

            <!-- DADOS DENTRO DO QUADRADO (SEM RÓTULOS, DIRETO E EM ALTO CONTRASTE) -->
            <div style="display: flex; flex-direction: column; gap: 4px; width: 100%; text-align: left;">
              <!-- LINHA 1 (Cliente) -->
              <div style="font-size: 13px; font-weight: 900; text-transform: uppercase; word-break: break-word; color: #000000; line-height: 1.25;">
                ${escapeHtml(clienteItem)}
              </div>

              <!-- LINHA 2 (Medidas - Descrição/Forma) -->
              <div style="font-size: 13px; font-weight: 900; font-family: monospace; text-transform: uppercase; word-break: break-word; color: #000000; line-height: 1.25;">
                ${escapeHtml(medidasDescForma)}
              </div>

              <!-- LINHA 3 (Observação - exibida apenas se preenchida) -->
              ${obsItem ? `
              <div style="font-size: 12.5px; font-weight: 900; text-transform: uppercase; word-break: break-word; color: #000000; line-height: 1.25;">
                ${escapeHtml(obsItem)}
              </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

  return `
    <div style="width: 100%; max-width: 80mm; margin: 0 auto; box-sizing: border-box; text-align: left;">
      <!-- CABEÇALHO SUPERIOR (TOPO DO CUPOM): Apenas título, empresa e Data/Hora -->
      <header style="text-align: center; width: 100%; margin-bottom: 4px;">
        <h1 style="font-size: 18px; font-weight: 900; margin: 0; padding: 0; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
          === ORDEM DE CORTE ===
        </h1>
        <div style="font-size: 14px; font-weight: 900; margin-top: 3px; text-transform: uppercase; letter-spacing: 1px;">
          USICORTE METAIS
        </div>

        <div class="hr-line"></div>

        <div style="width: 100%; display: flex; flex-direction: column; gap: 4px; text-align: left;">
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

      <!-- RESUMO E IDENTIFICAÇÃO DO OPERADOR (SEM RODAPÉ FINAL DE ASSINATURA) -->
      <footer style="width: 100%; margin-top: 4px; page-break-inside: avoid; break-inside: avoid;">
        <div class="hr-line"></div>

        <div class="flex-between" style="font-size: 14px; font-weight: 900; padding: 0 2px; text-transform: uppercase;">
          <span>ITENS: ${totalTiposItens}</span>
          <span>TOTAL: ${totalPecas} ${totalPecas === 1 ? 'PEÇA' : 'PEÇAS'}</span>
        </div>

        <div class="hr-line"></div>

        <div style="width: 100%; margin-top: 6px; margin-bottom: 6px;">
          <div class="flex-between" style="align-items: center; font-size: 13px; font-weight: 900; text-transform: uppercase;">
            <span style="font-weight: bold; min-width: 80px;">OPERADOR:</span>
            <span style="font-weight: 900; font-size: 13px; text-align: right; flex: 1;">
              ${operador ? escapeHtml(operador) : '___________________________'}
            </span>
          </div>
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
            justify-content: flex-start;
            align-items: baseline;
            gap: 6px;
            width: 100%;
            padding: 1.5px 0;
            line-height: 1.3;
            text-align: left;
          }
          .field-label {
            font-weight: bold;
            font-size: 12.5px;
            flex-shrink: 0;
            white-space: nowrap;
          }
          .field-value {
            font-weight: 900;
            text-align: left;
            flex: 1;
            font-size: 13px;
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
  operador: propOperador,
  operator: propOperator,
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
  const operador = (propOperador || propOperator || getOperadorResponsavel({ quoteNumber, numeroPedido })).trim();

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
              operador: operador,
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
          1. CABEÇALHO COMPACTO (CUPOM TÉRMICO 80MM): Apenas título, marca e Data/Hora
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

        {/* Dados de Data/Hora (Cliente e Cotação foram transferidos para os cards dos itens) */}
        <div className="w-full text-left space-y-1.5" style={{ color: '#000000' }}>
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
            const qtd = Number(item?.qtd ?? item?.quantity) || 1;

            // Cotação específica do item ou cotação geral da ordem (sem prefixo #COT-)
            const itemCotacao = (
              item?.quoteNumber ||
              item?.numeroPedido ||
              item?.cotacao ||
              item?.numero ||
              numCotacao ||
              'S/N'
            ).toString().trim();
            const numCotacaoLimpo = formatarNumeroCotacaoSemPrefixo(itemCotacao);

            // Cliente específico do item ou cliente geral da ordem
            const clienteItem = (
              item?.cliente_nome ||
              item?.cliente?.nome ||
              item?.cliente ||
              item?.clientName ||
              item?.client?.name ||
              item?.empresa ||
              cliente ||
              clientName ||
              nomeCliente ||
              'CLIENTE BALCÃO'
            ).toString().trim().toUpperCase();

            const medidasDescForma = resolverMedidasDescricaoForma(item);
            const obsItem = resolverObservacaoItem(item);

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
                {/* ┌────────────────────────────────────────────────────────┐
                    │ 2026-000509                                QTD: 5 PÇS  │
                    └────────────────────────────────────────────────────────┘ */}
                <div 
                  className="flex justify-between items-center w-full pb-1.5 font-black leading-tight"
                  style={{
                    borderBottom: '2px solid #000000',
                    color: '#000000',
                    fontSize: '13px'
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'monospace' }}>
                    {numCotacaoLimpo}
                  </span>
                  <span className="font-black uppercase text-right" style={{ fontSize: '13px', fontWeight: 900 }}>
                    QTD: {qtd} PÇS
                  </span>
                </div>

                {/* ┌────────────────────────────────────────────────────────┐
                    │ INDEL BAURU INDUSTRIA ELETROMETALURGICA LTDA           │
                    │ 2" X 66 MM - RETÂNGULO                                 │
                    │ 1045 AÇO REDONDO - TREFILADO SAE 1045                  │
                    └────────────────────────────────────────────────────────┘ */}
                <div 
                  className="w-full pt-1.5 space-y-1 leading-snug bg-white text-left"
                  style={{ color: '#000000' }}
                >
                  {/* LINHA 1 (Cliente) */}
                  <div 
                    className="font-black uppercase break-words text-left w-full text-black" 
                    style={{ fontSize: '13px', fontWeight: 900 }}
                  >
                    {clienteItem}
                  </div>

                  {/* LINHA 2 (Medidas - Descrição/Forma) */}
                  <div 
                    className="font-black uppercase font-mono break-words text-left w-full text-black" 
                    style={{ fontSize: '13px', fontWeight: 900 }}
                  >
                    {medidasDescForma}
                  </div>

                  {/* LINHA 3 (Observação - exibida apenas se preenchida) */}
                  {obsItem && (
                    <div 
                      className="font-black uppercase break-words text-left w-full text-black" 
                      style={{ fontSize: '12.5px', fontWeight: 900 }}
                    >
                      {obsItem}
                    </div>
                  )}
                </div>
              </section>
            );
          })
        )}
      </main>

      {/* =========================================================================
          3. RESUMO E IDENTIFICAÇÃO DO OPERADOR (SEM RODAPÉ FINAL DE ASSINATURA)
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

        {/* Linha Divisória */}
        <div className="w-full border-b-2 border-dashed border-black my-2" />

        {/* Identificação do Operador */}
        <div className="w-full my-1.5" style={{ fontSize: '13px', color: '#000000' }}>
          <div className="flex justify-between items-center w-full font-black uppercase">
            <span className="font-bold min-w-[80px]">OPERADOR:</span>
            <span className="font-black text-right flex-1" style={{ fontSize: '13px', fontWeight: 900 }}>
              {operador || '___________________________'}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
