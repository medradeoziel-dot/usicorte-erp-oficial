import DxfParser from 'dxf-parser';

export interface DxfRenderOptions {
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  paddingRatio?: number;
  format?: 'png' | 'svg';
  medida?: string;
  material?: string;
  observacao?: string;
  descricao?: string;
}

interface Point2D {
  x: number;
  y: number;
}

interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Verifica se um arquivo ou nome de arquivo é do tipo DXF (CAD)
 */
export function isDxfFile(fileOrName: File | string): boolean {
  if (typeof fileOrName === 'string') {
    return /\.dxf$/i.test(fileOrName.trim());
  }
  return /\.dxf$/i.test(fileOrName.name) || (fileOrName.type ? fileOrName.type.includes('dxf') || fileOrName.type.includes('cad') : false);
}

/**
 * Converte arquivo DXF ou imagem em DataURL (PNG de alta nitidez com linhas pretas em fundo branco)
 */
export async function fileToDxfImage(
  file: File,
  options?: DxfRenderOptions
): Promise<string> {
  const isDxf = isDxfFile(file);

  if (!isDxf) {
    // Arquivo de imagem convencional (PNG, JPG, WebP, etc.)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Falha ao ler arquivo de imagem'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // É um arquivo .dxf -> lê como texto e renderiza os vetores
  const dxfText = await file.text();
  return renderDxfToDataUrl(dxfText, options);
}

/**
 * Renderiza texto DXF diretamente em DataURL (PNG via Canvas ou SVG) de alta nitidez.
 * - Inverte todas as cores de traços do DXF para PRETO (#000000) sobre fundo BRANCO (#ffffff).
 * - Enquadra e centraliza a geometria perfeitamente no quadrado (Zoom Fit).
 * - Caso não encontre entidades válidas ou ocorra erro, usa a medição (ex: 1/4 x 200 x 140 mm) para desenhar a geometria correta como fallback.
 */
export function renderDxfToDataUrl(dxfString: string, options: DxfRenderOptions = {}): string {
  const width = options.width || 600;
  const height = options.height || 600;
  const strokeColor = '#000000'; // Forçado para preto nítido em etiquetas
  const strokeWidth = options.strokeWidth || 3.5;
  const backgroundColor = options.backgroundColor || '#ffffff';
  const paddingRatio = options.paddingRatio !== undefined ? options.paddingRatio : 0.08;

  let entities: any[] = [];

  // 1. Tenta usar o dxf-parser
  try {
    const parser = new (DxfParser as any)();
    const parsed = parser.parseSync(dxfString);
    if (parsed && Array.isArray(parsed.entities) && parsed.entities.length > 0) {
      entities = parsed.entities;
    }
  } catch (err) {
    console.warn('DxfParser sync falhou, tentando parser regex fallback:', err);
  }

  // 2. Se o parser não encontrou entidades, tenta o scanner nativo DXF ASCII
  if (entities.length === 0 && dxfString) {
    entities = parseDxfFallback(dxfString);
  }

  // 3. Renderiza via Canvas 2D no browser se disponível
  if (typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Fundo Branco Sólido
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        const renderedOk = renderEntitiesToCanvas(ctx, entities, width, height, {
          strokeColor,
          strokeWidth,
          paddingRatio,
          medida: options.medida,
          material: options.material,
          observacao: options.observacao,
          descricao: options.descricao
        });

        if (renderedOk) {
          return canvas.toDataURL('image/png');
        }
      }
    } catch (e) {
      console.warn('Falha no renderizador Canvas 2D, tentando SVG:', e);
    }
  }

  // 4. Fallback para SVG string
  const svgString = generateSvgFromDxfEntities(entities, {
    width,
    height,
    strokeColor,
    strokeWidth,
    backgroundColor,
    paddingRatio,
    medida: options.medida,
    material: options.material,
    observacao: options.observacao,
    descricao: options.descricao
  });

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}

/**
 * Renderiza as entidades DXF no Canvas 2D com enquadramento (Zoom Fit) e inversão de cores (linhas pretas sobre fundo branco).
 */
function renderEntitiesToCanvas(
  ctx: CanvasRenderingContext2D,
  entities: any[],
  canvasWidth: number,
  canvasHeight: number,
  opts: {
    strokeColor: string;
    strokeWidth: number;
    paddingRatio: number;
    medida?: string;
    material?: string;
    observacao?: string;
    descricao?: string;
  }
): boolean {
  const bbox: BoundingBox = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  };

  const expandBbox = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < bbox.minX) bbox.minX = x;
    if (x > bbox.maxX) bbox.maxX = x;
    if (y < bbox.minY) bbox.minY = y;
    if (y > bbox.maxY) bbox.maxY = y;
  };

  const validEntities: any[] = [];

  for (const ent of entities) {
    const type = (ent.type || '').toUpperCase();

    if (type === 'LINE') {
      const x1 = ent.start?.x ?? ent.vertices?.[0]?.x;
      const y1 = ent.start?.y ?? ent.vertices?.[0]?.y;
      const x2 = ent.end?.x ?? ent.vertices?.[1]?.x;
      const y2 = ent.end?.y ?? ent.vertices?.[1]?.y;
      if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
        expandBbox(x1, y1);
        expandBbox(x2, y2);
        validEntities.push({ type: 'LINE', x1, y1, x2, y2 });
      }
    } else if (type === 'LWPOLYLINE' || type === 'POLYLINE') {
      const verts: Point2D[] = (ent.vertices || []).map((v: any) => ({ x: v.x ?? 0, y: v.y ?? 0 }));
      if (verts.length > 1) {
        verts.forEach(v => expandBbox(v.x, v.y));
        const isClosed = Boolean(ent.shape || ent.isClosed || ent.closed);
        validEntities.push({ type: 'POLYLINE', vertices: verts, isClosed });
      }
    } else if (type === 'CIRCLE') {
      const cx = ent.center?.x ?? 0;
      const cy = ent.center?.y ?? 0;
      const r = ent.radius ?? 1;
      if (r > 0) {
        expandBbox(cx - r, cy - r);
        expandBbox(cx + r, cy + r);
        validEntities.push({ type: 'CIRCLE', cx, cy, r });
      }
    } else if (type === 'ARC') {
      const cx = ent.center?.x ?? 0;
      const cy = ent.center?.y ?? 0;
      const r = ent.radius ?? 1;
      let startAngle = ent.startAngle ?? 0;
      let endAngle = ent.endAngle ?? Math.PI * 2;
      if (startAngle > 2 * Math.PI || endAngle > 2 * Math.PI) {
        startAngle = (startAngle * Math.PI) / 180;
        endAngle = (endAngle * Math.PI) / 180;
      }
      if (r > 0) {
        expandBbox(cx - r, cy - r);
        expandBbox(cx + r, cy + r);
        validEntities.push({ type: 'ARC', cx, cy, r, startAngle, endAngle });
      }
    } else if (type === 'ELLIPSE') {
      const cx = ent.center?.x ?? 0;
      const cy = ent.center?.y ?? 0;
      const rx = Math.hypot(ent.majorAxisEndPoint?.x ?? 1, ent.majorAxisEndPoint?.y ?? 0);
      const ry = rx * (ent.axisRatio ?? 1);
      if (rx > 0 && ry > 0) {
        expandBbox(cx - rx, cy - ry);
        expandBbox(cx + rx, cy + ry);
        validEntities.push({ type: 'ELLIPSE', cx, cy, rx, ry });
      }
    } else if (type === 'RECTANGLE') {
      const x = ent.x ?? 0;
      const y = ent.y ?? 0;
      const w = ent.width ?? 10;
      const h = ent.height ?? 10;
      expandBbox(x, y);
      expandBbox(x + w, y + h);
      validEntities.push({ type: 'RECTANGLE', x, y, w, h });
    }
  }

  const spanX = bbox.maxX - bbox.minX;
  const spanY = bbox.maxY - bbox.minY;

  // Se não houver geometrias válidas ou bounding box inválido, desenha fallback baseado nas dimensões
  if (validEntities.length === 0 || !Number.isFinite(spanX) || !Number.isFinite(spanY) || spanX <= 0 && spanY <= 0) {
    drawFallbackToCanvas(ctx, canvasWidth, canvasHeight, opts.medida, opts.material, opts.observacao, opts.descricao);
    return true;
  }

  const effectiveSpanX = Math.max(spanX, 0.001);
  const effectiveSpanY = Math.max(spanY, 0.001);

  // Cálculo do enquadramento (Zoom Fit / Bounding Box Centralizado)
  const padX = canvasWidth * opts.paddingRatio;
  const padY = canvasHeight * opts.paddingRatio;
  const availW = canvasWidth - padX * 2;
  const availH = canvasHeight - padY * 2;

  const scale = Math.min(availW / effectiveSpanX, availH / effectiveSpanY);
  const drawW = effectiveSpanX * scale;
  const drawH = effectiveSpanY * scale;

  const offsetX = (canvasWidth - drawW) / 2;
  const offsetY = (canvasHeight - drawH) / 2;

  // Converte coordenadas CAD (Y cresce para cima) para Canvas (Y cresce para baixo)
  const mapX = (x: number) => offsetX + (x - bbox.minX) * scale;
  const mapY = (y: number) => offsetY + (bbox.maxY - y) * scale;

  // Configuração dos traços: preto nítido sobre branco com cantos arredondados
  ctx.strokeStyle = opts.strokeColor;
  ctx.fillStyle = opts.strokeColor;
  ctx.lineWidth = Math.max(opts.strokeWidth, 2.5);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const ent of validEntities) {
    if (ent.type === 'LINE') {
      ctx.beginPath();
      ctx.moveTo(mapX(ent.x1), mapY(ent.y1));
      ctx.lineTo(mapX(ent.x2), mapY(ent.y2));
      ctx.stroke();
    } else if (ent.type === 'POLYLINE') {
      const verts: Point2D[] = ent.vertices;
      if (verts.length > 0) {
        ctx.beginPath();
        ctx.moveTo(mapX(verts[0].x), mapY(verts[0].y));
        for (let i = 1; i < verts.length; i++) {
          ctx.lineTo(mapX(verts[i].x), mapY(verts[i].y));
        }
        if (ent.isClosed) {
          ctx.closePath();
        }
        ctx.stroke();
      }
    } else if (ent.type === 'CIRCLE') {
      ctx.beginPath();
      ctx.arc(mapX(ent.cx), mapY(ent.cy), Math.max(ent.r * scale, 1), 0, Math.PI * 2);
      ctx.stroke();
    } else if (ent.type === 'ARC') {
      ctx.beginPath();
      // No CAD o ângulo é anti-horário com Y para cima. No Canvas Y é invertido, então invertemos os ângulos
      ctx.arc(mapX(ent.cx), mapY(ent.cy), Math.max(ent.r * scale, 1), -ent.startAngle, -ent.endAngle, true);
      ctx.stroke();
    } else if (ent.type === 'ELLIPSE') {
      ctx.beginPath();
      ctx.ellipse(mapX(ent.cx), mapY(ent.cy), Math.max(ent.rx * scale, 1), Math.max(ent.ry * scale, 1), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (ent.type === 'RECTANGLE') {
      ctx.strokeRect(mapX(ent.x), mapY(ent.y + ent.h), ent.w * scale, ent.h * scale);
    }
  }

  return true;
}

/**
 * Desenho técnico de fallback caso o arquivo DXF não contenha vetores ou falhe
 * Detecta a medida (ex: 1/4 x 200 x 140 mm ou Ø 50 x 200) e desenha a forma correspondente.
 */
function drawFallbackToCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  medida?: string,
  material?: string,
  observacao?: string,
  descricao?: string
) {
  const combinedText = `${medida || ''} ${material || ''} ${observacao || ''} ${descricao || ''}`.toUpperCase();

  ctx.strokeStyle = '#000000';
  ctx.fillStyle = '#000000';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const pad = width * 0.15;
  const cx = width / 2;
  const cy = height / 2;

  // 1. Verifica se é Redondo / Flange / Disco / Bucha
  const isRedondo = /Ø|\bREDONDO\b|\bDISCO\b|\bFLANGE\b|\bBUCHA\b|\bEIXO\b|\bTARUGO\b/.test(combinedText);
  const isFlangeOuBucha = /COM\s*FURO|\bFLANGE\b|\bBUCHA\b|\bARRUELA\b|\bANEL\b/.test(combinedText);
  const isSextavado = /\bSEXTAVAD(O|A)?\b|\bHEXAGONAL\b/.test(combinedText);

  if (isSextavado) {
    // Hexágono
    const r = (width - 2 * pad) / 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 - Math.PI / 6;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // Linhas de centro
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, pad * 0.7);
    ctx.lineTo(cx, height - pad * 0.7);
    ctx.moveTo(pad * 0.7, cy);
    ctx.lineTo(width - pad * 0.7, cy);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (isRedondo && !/\d+\s*[xX]\s*\d+\s*[xX]\s*\d+/.test(combinedText)) {
    const rExterno = (width - 2 * pad) / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rExterno, 0, Math.PI * 2);
    ctx.stroke();

    if (isFlangeOuBucha) {
      ctx.beginPath();
      ctx.arc(cx, cy, rExterno * 0.42, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Linhas de centro
    ctx.save();
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, pad * 0.6);
    ctx.lineTo(cx, height - pad * 0.6);
    ctx.moveTo(pad * 0.6, cy);
    ctx.lineTo(width - pad * 0.6, cy);
    ctx.stroke();
    ctx.restore();
    return;
  }

  // 2. Padrão: Bloco Retangular / Chapa Cortada (ex: 1/4 x 200 x 140 mm ou Retangular)
  const rw = width - 2 * pad;
  const rh = rw * 0.68;
  const rx = cx - rw / 2;
  const ry = cy - rh / 2;

  // Retângulo principal com chanfros de usinagem
  ctx.beginPath();
  const corner = 8;
  ctx.moveTo(rx + corner, ry);
  ctx.lineTo(rx + rw - corner, ry);
  ctx.lineTo(rx + rw, ry + corner);
  ctx.lineTo(rx + rw, ry + rh - corner);
  ctx.lineTo(rx + rw - corner, ry + rh);
  ctx.lineTo(rx + corner, ry + rh);
  ctx.lineTo(rx, ry + rh - corner);
  ctx.lineTo(rx, ry + corner);
  ctx.closePath();
  ctx.stroke();

  // Linhas de centro técnicas tracejadas
  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(rx - 15, cy);
  ctx.lineTo(rx + rw + 15, cy);
  ctx.moveTo(cx, ry - 15);
  ctx.lineTo(cx, ry + rh + 15);
  ctx.stroke();
  ctx.restore();

  // Indicação de espessura / vista isométrica sutil
  ctx.save();
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.moveTo(rx, ry + corner);
  ctx.lineTo(rx - 12, ry + corner - 12);
  ctx.lineTo(rx + rw - corner - 12, ry + corner - 12);
  ctx.lineTo(rx + rw, ry);
  ctx.stroke();
  ctx.restore();
}

/**
 * Gera string SVG precisa a partir das entidades DXF
 */
function generateSvgFromDxfEntities(
  entities: any[],
  opts: {
    width: number;
    height: number;
    strokeColor: string;
    strokeWidth: number;
    backgroundColor: string;
    paddingRatio: number;
    medida?: string;
    material?: string;
    observacao?: string;
    descricao?: string;
  }
): string {
  const bbox: BoundingBox = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  };

  const expandBbox = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (x < bbox.minX) bbox.minX = x;
    if (x > bbox.maxX) bbox.maxX = x;
    if (y < bbox.minY) bbox.minY = y;
    if (y > bbox.maxY) bbox.maxY = y;
  };

  const svgElements: string[] = [];

  for (const ent of entities) {
    const type = (ent.type || '').toUpperCase();

    if (type === 'LINE') {
      const x1 = ent.start?.x ?? ent.vertices?.[0]?.x;
      const y1 = ent.start?.y ?? ent.vertices?.[0]?.y;
      const x2 = ent.end?.x ?? ent.vertices?.[1]?.x;
      const y2 = ent.end?.y ?? ent.vertices?.[1]?.y;
      if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
        expandBbox(x1, y1);
        expandBbox(x2, y2);
        svgElements.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`);
      }
    } else if (type === 'LWPOLYLINE' || type === 'POLYLINE') {
      const verts: Point2D[] = (ent.vertices || []).map((v: any) => ({ x: v.x ?? 0, y: v.y ?? 0 }));
      if (verts.length > 1) {
        verts.forEach(v => expandBbox(v.x, v.y));
        const isClosed = Boolean(ent.shape || ent.isClosed || ent.closed);
        const pointsStr = verts.map(v => `${v.x},${v.y}`).join(' ');
        if (isClosed) {
          svgElements.push(`<polygon points="${pointsStr}" fill="none" />`);
        } else {
          svgElements.push(`<polyline points="${pointsStr}" fill="none" />`);
        }
      }
    } else if (type === 'CIRCLE') {
      const cx = ent.center?.x ?? 0;
      const cy = ent.center?.y ?? 0;
      const r = ent.radius ?? 1;
      expandBbox(cx - r, cy - r);
      expandBbox(cx + r, cy + r);
      svgElements.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" />`);
    } else if (type === 'ARC') {
      const cx = ent.center?.x ?? 0;
      const cy = ent.center?.y ?? 0;
      const r = ent.radius ?? 1;
      let startAngle = ent.startAngle ?? 0;
      let endAngle = ent.endAngle ?? Math.PI * 2;
      if (startAngle > 2 * Math.PI || endAngle > 2 * Math.PI) {
        startAngle = (startAngle * Math.PI) / 180;
        endAngle = (endAngle * Math.PI) / 180;
      }
      expandBbox(cx - r, cy - r);
      expandBbox(cx + r, cy + r);

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);

      let diff = endAngle - startAngle;
      if (diff < 0) diff += 2 * Math.PI;
      const largeArc = diff > Math.PI ? 1 : 0;

      svgElements.push(
        `<path d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}" fill="none" />`
      );
    } else if (type === 'ELLIPSE') {
      const cx = ent.center?.x ?? 0;
      const cy = ent.center?.y ?? 0;
      const rx = Math.hypot(ent.majorAxisEndPoint?.x ?? 1, ent.majorAxisEndPoint?.y ?? 0);
      const ry = rx * (ent.axisRatio ?? 1);
      expandBbox(cx - rx, cy - ry);
      expandBbox(cx + rx, cy + ry);
      svgElements.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" />`);
    } else if (type === 'RECTANGLE') {
      const x = ent.x ?? 0;
      const y = ent.y ?? 0;
      const w = ent.width ?? 10;
      const h = ent.height ?? 10;
      expandBbox(x, y);
      expandBbox(x + w, y + h);
      svgElements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" />`);
    }
  }

  // Fallback se não encontrou geometrias
  if (svgElements.length === 0 || !Number.isFinite(bbox.minX) || !Number.isFinite(bbox.maxX)) {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${opts.width}" height="${opts.height}" style="background-color: ${opts.backgroundColor};">
        <rect x="15" y="25" width="70" height="50" rx="3" fill="none" stroke="${opts.strokeColor}" stroke-width="3" />
        <line x1="8" y1="50" x2="92" y2="50" stroke="${opts.strokeColor}" stroke-width="1.2" stroke-dasharray="4,3" />
        <line x1="50" y1="18" x2="50" y2="82" stroke="${opts.strokeColor}" stroke-width="1.2" stroke-dasharray="4,3" />
      </svg>
    `.trim();
  }

  const dx = bbox.maxX - bbox.minX || 10;
  const dy = bbox.maxY - bbox.minY || 10;
  const padX = dx * opts.paddingRatio;
  const padY = dy * opts.paddingRatio;

  const viewBoxMinX = bbox.minX - padX;
  const viewBoxMinY = bbox.minY - padY;
  const viewBoxWidth = dx + padX * 2;
  const viewBoxHeight = dy + padY * 2;

  // Inversão correta de Y no SVG para manter a orientação do CAD
  const translateY = bbox.minY + bbox.maxY;

  const computedStrokeWidth = Math.max(
    (viewBoxWidth + viewBoxHeight) / 300 * (opts.strokeWidth / 2),
    0.01
  );

  return `
    <svg xmlns="http://www.w3.org/2000/svg" 
         viewBox="${viewBoxMinX} ${viewBoxMinY} ${viewBoxWidth} ${viewBoxHeight}" 
         width="${opts.width}" 
         height="${opts.height}" 
         style="background-color: ${opts.backgroundColor};">
      <g transform="translate(0, ${translateY}) scale(1, -1)" 
         stroke="${opts.strokeColor}" 
         stroke-width="${computedStrokeWidth}" 
         stroke-linecap="round" 
         stroke-linejoin="round">
        ${svgElements.join('\n')}
      </g>
    </svg>
  `.trim();
}

/**
 * Fallback parser regex leve para arquivos DXF ASCII caso dxf-parser encontre cabeçalhos incomuns
 */
function parseDxfFallback(dxfText: string): any[] {
  const entities: any[] = [];
  const lines = dxfText.split(/\r?\n/).map(l => l.trim());

  let i = 0;
  let inEntitiesSection = false;

  while (i < lines.length - 1) {
    const code = lines[i];
    const value = lines[i + 1];

    if (code === '2' && value === 'ENTITIES') {
      inEntitiesSection = true;
      i += 2;
      continue;
    }

    if (code === '0' && value === 'ENDSEC') {
      if (inEntitiesSection) break;
    }

    if (inEntitiesSection && code === '0') {
      const entType = value.toUpperCase();
      i += 2;

      if (entType === 'LINE') {
        const ent: any = { type: 'LINE', start: {}, end: {} };
        while (i < lines.length - 1 && lines[i] !== '0') {
          const c = lines[i];
          const v = parseFloat(lines[i + 1]);
          if (c === '10') ent.start.x = v;
          if (c === '20') ent.start.y = v;
          if (c === '11') ent.end.x = v;
          if (c === '21') ent.end.y = v;
          i += 2;
        }
        if (ent.start.x !== undefined && ent.end.x !== undefined) {
          entities.push(ent);
        }
        continue;
      }

      if (entType === 'CIRCLE') {
        const ent: any = { type: 'CIRCLE', center: {} };
        while (i < lines.length - 1 && lines[i] !== '0') {
          const c = lines[i];
          const v = parseFloat(lines[i + 1]);
          if (c === '10') ent.center.x = v;
          if (c === '20') ent.center.y = v;
          if (c === '40') ent.radius = v;
          i += 2;
        }
        if (ent.center.x !== undefined && ent.radius !== undefined) {
          entities.push(ent);
        }
        continue;
      }

      if (entType === 'ARC') {
        const ent: any = { type: 'ARC', center: {} };
        while (i < lines.length - 1 && lines[i] !== '0') {
          const c = lines[i];
          const v = parseFloat(lines[i + 1]);
          if (c === '10') ent.center.x = v;
          if (c === '20') ent.center.y = v;
          if (c === '40') ent.radius = v;
          if (c === '50') ent.startAngle = (v * Math.PI) / 180;
          if (c === '51') ent.endAngle = (v * Math.PI) / 180;
          i += 2;
        }
        if (ent.center.x !== undefined && ent.radius !== undefined) {
          entities.push(ent);
        }
        continue;
      }

      if (entType === 'LWPOLYLINE') {
        const ent: any = { type: 'LWPOLYLINE', vertices: [] };
        let curX: number | null = null;
        while (i < lines.length - 1 && lines[i] !== '0') {
          const c = lines[i];
          const v = lines[i + 1];
          if (c === '10') curX = parseFloat(v);
          if (c === '20' && curX !== null) {
            ent.vertices.push({ x: curX, y: parseFloat(v) });
            curX = null;
          }
          if (c === '70') {
            const flag = parseInt(v, 10);
            if ((flag & 1) === 1) ent.shape = true;
          }
          i += 2;
        }
        if (ent.vertices.length > 0) {
          entities.push(ent);
        }
        continue;
      }
    }

    i += 2;
  }

  return entities;
}
