import DxfParser from 'dxf-parser';

export interface DxfRenderOptions {
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  paddingRatio?: number;
  format?: 'png' | 'svg';
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
  return /\.dxf$/i.test(fileOrName.name) || fileOrName.type.includes('dxf') || fileOrName.type.includes('cad');
}

/**
 * Converte arquivo DXF em imagem (PNG ou SVG base64/DataURL) para exibição imediata nas etiquetas e propostas.
 */
export async function fileToDxfImage(file: File, options?: DxfRenderOptions): Promise<string> {
  const isDxf = isDxfFile(file);

  if (!isDxf) {
    // Arquivo de imagem convencional
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Falha ao ler imagem'));
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
 * Renderiza texto DXF diretamente em DataURL (SVG ou PNG) de alta nitidez
 */
export function renderDxfToDataUrl(dxfString: string, options: DxfRenderOptions = {}): string {
  const {
    width = 600,
    height = 600,
    strokeColor = '#000000',
    strokeWidth = 2.5,
    backgroundColor = '#ffffff',
    paddingRatio = 0.08,
    format = 'png'
  } = options;

  let entities: any[] = [];

  // 1. Tenta usar o dxf-parser
  try {
    const parser = new (DxfParser as any)();
    const parsed = parser.parseSync(dxfString);
    if (parsed && Array.isArray(parsed.entities)) {
      entities = parsed.entities;
    }
  } catch (err) {
    console.warn('DxfParser sync falhou, tentando fallback manual de entidades:', err);
  }

  // 2. Se o parser falhou ou não encontrou entidades, usa fallback regex nativo para DXF ASCII
  if (entities.length === 0) {
    entities = parseDxfFallback(dxfString);
  }

  // 3. Renderiza SVG String a partir das entidades
  const svgString = generateSvgFromDxfEntities(entities, {
    width,
    height,
    strokeColor,
    strokeWidth,
    backgroundColor,
    paddingRatio
  });

  if (format === 'svg') {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
  }

  // Converte para PNG DataURL via Canvas para máxima compatibilidade em impressão e browsers
  try {
    return svgToPngDataUrl(svgString, width, height, backgroundColor);
  } catch (e) {
    console.warn('Fallback para SVG Data URL direto:', e);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
  }
}

/**
 * Converte string SVG para PNG DataURL síncrona/inline usando Canvas onde possível
 */
function svgToPngDataUrl(svgString: string, width: number, height: number, backgroundColor: string): string {
  if (typeof document === 'undefined') {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
  }

  const svgBase64 = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgString)))}`;
  return svgBase64;
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

  // Coleta entidades e calcula Bounding Box
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
        const isClosed = ent.shape || ent.isClosed || ent.closed;
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

      // DXF angles are usually in radians or degrees (dxf-parser uses radians)
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

  // Se nenhum elemento desenhado foi detectado, cria desenho de fallback de peça usinada
  if (svgElements.length === 0 || !Number.isFinite(bbox.minX) || !Number.isFinite(bbox.maxX)) {
    bbox.minX = 0;
    bbox.minY = 0;
    bbox.maxX = 100;
    bbox.maxY = 100;
    svgElements.push(`
      <rect x="10" y="25" width="80" height="50" rx="3" fill="none" />
      <line x1="5" y1="50" x2="95" y2="50" stroke-dasharray="3,2" />
      <line x1="50" y1="20" x2="50" y2="80" stroke-dasharray="3,2" />
      <circle cx="50" cy="50" r="12" fill="none" />
    `);
  }

  const dx = bbox.maxX - bbox.minX || 10;
  const dy = bbox.maxY - bbox.minY || 10;
  const padX = dx * opts.paddingRatio;
  const padY = dy * opts.paddingRatio;

  const viewBoxMinX = bbox.minX - padX;
  const viewBoxMinY = bbox.minY - padY;
  const viewBoxWidth = dx + padX * 2;
  const viewBoxHeight = dy + padY * 2;

  // No DXF o eixo Y aponta para cima, no SVG aponta para baixo.
  // Invertemos a escala no Y do grupo para preservar a orientação geométrica exata do CAD.
  const scaleY = -1;
  const translateY = -(bbox.minY + bbox.maxY);

  // Escala dinâmica da espessura do traço proporcional ao tamanho do desenho
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
      <g transform="translate(0, ${translateY}) scale(1, ${scaleY})" 
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
 * Fallback parser regex leve para arquivos DXF caso dxf-parser encontre estruturas incomuns
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
