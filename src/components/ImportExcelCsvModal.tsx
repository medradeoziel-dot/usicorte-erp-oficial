import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  X, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Trash2, 
  Layers, 
  Scale, 
  DollarSign, 
  AlertCircle, 
  Sparkles, 
  Box, 
  CircleDot, 
  Ruler, 
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { QuoteItem } from '../types';
import { 
  parseDimensionToMm, 
  formatDimensaoPolegada, 
  formatDimensaoMm,
  formatCurrency, 
  formatNumberBR, 
  formatWeightKg, 
  calculateItemSubtotal,
  normalizeConstant,
  tabelaConstantes,
  formatarMedidasLimpa,
  formatItemDescription,
  getSafeISODate
} from '../utils/calculator';

export type SystemColumnField = 
  | 'material'
  | 'description'
  | 'diameter'
  | 'thickness'
  | 'width'
  | 'length'
  | 'quantity'
  | 'notes'
  | 'priceKg'
  | 'ignore';

export interface ColumnMappingOption {
  field: SystemColumnField;
  label: string;
  description: string;
  required?: boolean;
}

export const SYSTEM_COLUMN_OPTIONS: ColumnMappingOption[] = [
  { field: 'ignore', label: '— Não Mapear (Ignorar) —', description: 'Coluna será desconsiderada' },
  { field: 'material', label: 'Material / Liga', description: 'Ex: OXICORTE A36, SAE 1045, BRONZE TM 23', required: true },
  { field: 'description', label: 'Descrição / Formato / Especificação', description: 'Ex: Retângulo, Trefilado, Corte Especial, Flange' },
  { field: 'diameter', label: 'Diâmetro (Ø)', description: 'Ex: 1", 1.1/2", 50mm, Ø 2"' },
  { field: 'thickness', label: 'Espessura', description: 'Ex: 1/2", 1", 1.1/2", 25.4mm' },
  { field: 'width', label: 'Largura (mm)', description: 'Ex: 45, 50, 100mm, 200' },
  { field: 'length', label: 'Comprimento (mm)', description: 'Ex: 88, 250, 500, 1000mm' },
  { field: 'quantity', label: 'Quantidade (Qtd)', description: 'Ex: 1, 2, 10 peças' },
  { field: 'notes', label: 'Informações / Observações (CONF DESENHO / Códigos)', description: 'Ex: CONF DESENHO, cód. peça, chanfrar' },
  { field: 'priceKg', label: 'Preço por Kg (R$/Kg) [Opcional]', description: 'Ex: 22,00, 35,00' }
];

export type GeometryChoice = 'chapa' | 'macico' | 'bucha';

export interface ImportedRowPreview {
  id: string;
  originalRowIndex: number;
  materialName: string;
  description: string;
  geometry: GeometryChoice;
  rawDiameter: string;
  rawThickness: string;
  rawWidth: string;
  rawLength: string;
  diameterMm: number;
  thicknessMm: number;
  widthMm: number;
  lengthMm: number;
  quantity: number;
  notes: string;
  priceKg: number;
  constantK: number;
  unitWeightKg: number;
  totalWeightKg: number;
  unitPrice: number;
  subtotal: number;
  displayMeasure: string;
}

interface ImportExcelCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportItems: (items: QuoteItem[]) => void;
  clientName?: string;
}

export default function ImportExcelCsvModal({
  isOpen,
  onClose,
  onImportItems,
  clientName = 'UsiCorte Cliente'
}: ImportExcelCsvModalProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [rawMatrix, setRawMatrix] = useState<any[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<number, SystemColumnField>>({});
  const [hasHeaderRow, setHasHeaderRow] = useState<boolean>(true);
  const [unitMode, setUnitMode] = useState<'auto' | 'inch' | 'mm'>('auto');

  // Lote / Cabeçalho do modal de conferência
  const [batchPriceKg, setBatchPriceKg] = useState<string>('22,00');
  const [batchGeometry, setBatchGeometry] = useState<GeometryChoice>('chapa');
  const [batchMaterial, setBatchMaterial] = useState<string>('');

  // Itens em pré-visualização
  const [previewRows, setPreviewRows] = useState<ImportedRowPreview[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Resolve constante k e preço/kg padrão para um nome de material
  const resolveMaterialDefaults = (matName: string, geom: GeometryChoice): { k: number; precoKg: number; matchedName: string } => {
    const clean = matName.trim().toLowerCase();
    const found = tabelaConstantes.find(t => 
      t.nome.toLowerCase() === clean || 
      clean.includes(t.nome.toLowerCase()) || 
      t.nome.toLowerCase().includes(clean)
    );

    if (found) {
      return { k: found.k, precoKg: found.precoKg, matchedName: found.nome };
    }

    // Padrões canônicos da UsiCorte por geometria
    if (geom === 'macico') {
      return { k: 0.00617, precoKg: 22.00, matchedName: matName || 'AÇO REDONDO SAE 1045' };
    }
    if (geom === 'bucha') {
      return { k: 0.00617, precoKg: 24.00, matchedName: matName || 'BUCHA MECÂNICA' };
    }
    return { k: 0.00785, precoKg: 22.00, matchedName: matName || 'OXICORTE A36' };
  };

  // Cálculo individual das fórmulas Usicorte
  const computeRowCalculations = (
    geom: GeometryChoice,
    thickMm: number,
    diaMm: number,
    wMm: number,
    lMm: number,
    kVal: number,
    pKg: number,
    qty: number
  ): { unitWeightKg: number; totalWeightKg: number; unitPrice: number; subtotal: number } => {
    const k = normalizeConstant(kVal);
    let unitWeightKg = 0;

    if (geom === 'chapa') {
      // 1. CHAPA / RETÂNGULO: (Espessura x Largura x Comprimento x k) / 1000
      const t = thickMm > 0 ? thickMm : (diaMm > 0 ? diaMm : 1);
      const w = wMm > 0 ? wMm : 1;
      const l = lMm > 0 ? lMm : 0;
      unitWeightKg = Number(((t * w * l * k) / 1000).toFixed(3));
    } else if (geom === 'macico') {
      // 2. MACIÇO REDONDO: (Diâmetro² x Comprimento x k) / 1000
      const d = diaMm > 0 ? diaMm : (thickMm > 0 ? thickMm : 0);
      const l = lMm > 0 ? lMm : 0;
      unitWeightKg = Number(((d * d * l * k) / 1000).toFixed(3));
    } else {
      // 3. BUCHA / TUBO: ((ØExt² - ØInt²) x Comprimento x k) / 1000
      const dExt = diaMm > 0 ? diaMm : thickMm;
      const dInt = (diaMm > 0 && thickMm > 0 && diaMm > thickMm) ? thickMm : (wMm > 0 ? wMm : 0);
      const l = lMm > 0 ? lMm : 0;
      if (dExt > dInt && dInt > 0) {
        const pBruto = (dExt * dExt * l * k) / 1000;
        const pFuro = (dInt * dInt * l * k) / 1000;
        unitWeightKg = Number((pBruto - pFuro).toFixed(3));
      } else {
        unitWeightKg = Number(((dExt * dExt * l * k) / 1000).toFixed(3));
      }
    }

    unitWeightKg = Math.max(0, unitWeightKg);
    const totalWeightKg = Number((unitWeightKg * qty).toFixed(3));
    // Regra oficial UsiCorte: Valor_Unitario = Math.ceil(Peso_Unitario * Preco_Kg)
    const unitPrice = Math.ceil(unitWeightKg * pKg);
    const subtotal = calculateItemSubtotal(unitPrice, qty);

    return { unitWeightKg, totalWeightKg, unitPrice, subtotal };
  };

  // Formata o resumo das medidas conforme regras oficiais UsiCorte:
  // - LARGURA: SEMPRE em mm (ex: 50mm, 72mm), NUNCA em polegadas
  // - COMPRIMENTO: SEMPRE em mm (ex: 1000mm)
  // - ESPESSURA (Chapa): em polegadas (ex: 1/2", 1/4") quando aplicável
  // - DIÂMETRO (Maciço): em polegadas (ex: 1", 2") quando aplicável
  // Exemplos:
  // Para Chapa: 1/2" x 50mm x 1000mm
  // Para Maciço: Ø 1" x 1000mm
  const buildDisplayMeasure = (
    geom: GeometryChoice,
    thickMm: number,
    diaMm: number,
    wMm: number,
    lMm: number,
    rawDia: string,
    rawThick: string
  ): string => {
    const diaPol = formatDimensaoPolegada(diaMm > 0 ? diaMm : rawDia);
    const thickPol = formatDimensaoPolegada(thickMm > 0 ? thickMm : rawThick);
    const widthStr = wMm > 0 ? formatDimensaoMm(wMm) : '';
    const lengthStr = lMm > 0 ? formatDimensaoMm(lMm) : '';

    if (geom === 'macico') {
      let d = diaPol || thickPol || 'Ø';
      if (!d.startsWith('Ø')) d = `Ø ${d}`;
      return [d, lengthStr].filter(Boolean).join(' x ');
    }
    if (geom === 'bucha') {
      let ext = diaPol || 'Ø Ext';
      if (!ext.startsWith('Ø')) ext = `Ø Ext. ${ext}`;
      const int = thickPol ? (thickPol.startsWith('Ø') ? thickPol : `Ø Int. ${thickPol}`) : '';
      return [ext, int, lengthStr].filter(Boolean).join(' x ');
    }
    // Chapa: Espessura em polegadas, largura em mm, comprimento em mm
    return [thickPol || diaPol, widthStr, lengthStr].filter(Boolean).join(' x ');
  };

  // Processamento do arquivo Excel/CSV
  const handleFileUpload = (file: File) => {
    if (!file) return;
    setErrorMsg(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          setErrorMsg('A planilha selecionada está vazia ou ilegível.');
          return;
        }

        const worksheet = workbook.Sheets[sheetName];
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rows || rows.length === 0) {
          setErrorMsg('Nenhum dado encontrado na planilha.');
          return;
        }

        // Filtra linhas completamente vazias
        const cleanRows = rows.filter(r => Array.isArray(r) && r.some(cell => String(cell).trim() !== ''));

        if (cleanRows.length === 0) {
          setErrorMsg('A planilha contém apenas linhas vazias.');
          return;
        }

        setRawMatrix(cleanRows);

        // Mapeamento automático inicial baseado nos nomes de cabeçalho da linha 1
        const headerRow = cleanRows[0] || [];
        const initialMapping: Record<number, SystemColumnField> = {};

        headerRow.forEach((colVal: any, idx: number) => {
          const colTxt = String(colVal || '').trim().toLowerCase();
          
          if (/obs|not|info|detalhe|desenho|observa[cç][aã]o|informa[cç][aã]o/i.test(colTxt)) {
            initialMapping[idx] = 'notes';
          } else if (/desc|descri[cç][aã]o|formato|tipo|especific/i.test(colTxt)) {
            initialMapping[idx] = 'description';
          } else if (/mat|material|liga|a[cç]o|produto|prod/i.test(colTxt)) {
            initialMapping[idx] = 'material';
          } else if (/di[aâ]m|diametro|diâmetro|ø|dext|ext/i.test(colTxt)) {
            initialMapping[idx] = 'diameter';
          } else if (/esp|bitola|espessura|thk|thick/i.test(colTxt)) {
            initialMapping[idx] = 'thickness';
          } else if (/larg|width|largura/i.test(colTxt)) {
            initialMapping[idx] = 'width';
          } else if (/comp|len|cpr|comprimento|comp\./i.test(colTxt)) {
            initialMapping[idx] = 'length';
          } else if (/qtd|quant|pe[cç]as|quantidade|un/i.test(colTxt)) {
            initialMapping[idx] = 'quantity';
          } else if (/pre[cç]o|r\$|kg|valor/i.test(colTxt)) {
            initialMapping[idx] = 'priceKg';
          } else {
            initialMapping[idx] = 'ignore';
          }
        });

        setColumnMappings(initialMapping);
        setStep('mapping');
      } catch (err: any) {
        console.error('Erro ao ler planilha Excel/CSV:', err);
        setErrorMsg('Falha ao processar o arquivo: ' + (err?.message || 'Formato não suportado'));
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Avançar do Mapeamento para a Pré-visualização
  const handleProceedToPreview = () => {
    if (rawMatrix.length === 0) return;

    const dataRows = hasHeaderRow ? rawMatrix.slice(1) : rawMatrix;
    if (dataRows.length === 0) {
      setErrorMsg('Não há linhas de dados para importar.');
      return;
    }

    const defaultPrice = parseFloat(batchPriceKg.replace(',', '.')) || 22.0;

    const generatedRows: ImportedRowPreview[] = [];

    dataRows.forEach((row, rIdx) => {
      let rawMat = '';
      let rawDesc = '';
      let rawDia = '';
      let rawThick = '';
      let rawWidth = '';
      let rawLength = '';
      let rawQty = '1';
      let rawNotes = '';
      let rawPriceKg = '';

      Object.entries(columnMappings).forEach(([colIdxStr, field]) => {
        const colIdx = parseInt(colIdxStr, 10);
        const cellVal = String(row[colIdx] ?? '').trim();
        if (!cellVal) return;

        if (field === 'material') rawMat = cellVal;
        else if (field === 'description') rawDesc = cellVal;
        else if (field === 'diameter') rawDia = cellVal;
        else if (field === 'thickness') rawThick = cellVal;
        else if (field === 'width') rawWidth = cellVal;
        else if (field === 'length') rawLength = cellVal;
        else if (field === 'quantity') rawQty = cellVal;
        else if (field === 'notes') rawNotes = cellVal;
        else if (field === 'priceKg') rawPriceKg = cellVal;
      });

      // Conversão rigorosa para milímetros (em mm para cálculo matemático exato)
      const diaMm = parseDimensionToMm(rawDia, unitMode);
      const thickMm = parseDimensionToMm(rawThick, unitMode);
      const widthMm = parseDimensionToMm(rawWidth, unitMode);
      const lengthMm = parseDimensionToMm(rawLength, unitMode === 'inch' ? 'auto' : unitMode);
      const qtyNum = Math.max(1, parseFloat(rawQty.replace(',', '.')) || 1);

      // 2. DETECÇÃO AUTOMÁTICA DE GEOMETRIA (Regras Usicorte):
      // - Se contiver Espessura e Largura: classificar como "Chapa/Retângulo"
      // - Se contiver Diâmetro e Comprimento: classificar como "Maciço Redondo"
      let detectedGeom: GeometryChoice = 'chapa';
      if (thickMm > 0 && widthMm > 0) {
        detectedGeom = 'chapa';
      } else if (diaMm > 0 && thickMm > 0 && diaMm > thickMm) {
        detectedGeom = 'bucha';
      } else if (diaMm > 0 || /redondo|maci[cç]o|tarugo|eixo|1045|1020|4140/i.test(rawMat)) {
        detectedGeom = 'macico';
      } else {
        detectedGeom = 'chapa';
      }

      // Material e Constante
      const matFinalName = rawMat || batchMaterial || (detectedGeom === 'macico' ? 'AÇO REDONDO SAE 1045' : 'OXICORTE A36');
      const { k, precoKg: defaultMatPrice, matchedName } = resolveMaterialDefaults(matFinalName, detectedGeom);

      // Descrição técnica limpa: nunca duplica o nome do material
      const defaultDesc = detectedGeom === 'macico' 
        ? 'Trefilado' 
        : (detectedGeom === 'bucha' ? 'Bucha / Tubo Mecânico' : 'Retângulo');
      
      let itemDescriptionVal = rawDesc.trim();
      if (!itemDescriptionVal || itemDescriptionVal.toLowerCase() === matFinalName.trim().toLowerCase()) {
        itemDescriptionVal = defaultDesc;
      }

      const rowPriceKg = rawPriceKg ? (parseFloat(rawPriceKg.replace(',', '.')) || defaultPrice) : (defaultMatPrice || defaultPrice);

      const { unitWeightKg, totalWeightKg, unitPrice, subtotal } = computeRowCalculations(
        detectedGeom,
        thickMm,
        diaMm,
        widthMm,
        lengthMm,
        k,
        rowPriceKg,
        qtyNum
      );

      const displayMeasure = buildDisplayMeasure(
        detectedGeom,
        thickMm,
        diaMm,
        widthMm,
        lengthMm,
        rawDia,
        rawThick
      );

      generatedRows.push({
        id: `imp-${Date.now()}-${rIdx}-${Math.random().toString(36).slice(2, 6)}`,
        originalRowIndex: hasHeaderRow ? rIdx + 2 : rIdx + 1,
        materialName: matchedName || matFinalName,
        description: itemDescriptionVal,
        geometry: detectedGeom,
        rawDiameter: rawDia,
        rawThickness: rawThick,
        rawWidth: rawWidth,
        rawLength: rawLength,
        diameterMm: diaMm,
        thicknessMm: thickMm,
        widthMm: widthMm,
        lengthMm: lengthMm,
        quantity: qtyNum,
        notes: rawNotes,
        priceKg: rowPriceKg,
        constantK: k,
        unitWeightKg,
        totalWeightKg,
        unitPrice,
        subtotal,
        displayMeasure
      });
    });

    setPreviewRows(generatedRows);
    setStep('preview');
  };

  // Ações em Lote no Cabeçalho
  const handleApplyPriceToAll = () => {
    const p = parseFloat(batchPriceKg.replace(',', '.')) || 22.0;
    setPreviewRows(prev => prev.map(row => {
      const { unitWeightKg, totalWeightKg, unitPrice, subtotal } = computeRowCalculations(
        row.geometry,
        row.thicknessMm,
        row.diameterMm,
        row.widthMm,
        row.lengthMm,
        row.constantK,
        p,
        row.quantity
      );
      return { ...row, priceKg: p, unitWeightKg, totalWeightKg, unitPrice, subtotal };
    }));
  };

  const handleApplyGeometryToAll = () => {
    setPreviewRows(prev => prev.map(row => {
      const { k } = resolveMaterialDefaults(row.materialName, batchGeometry);
      const { unitWeightKg, totalWeightKg, unitPrice, subtotal } = computeRowCalculations(
        batchGeometry,
        row.thicknessMm,
        row.diameterMm,
        row.widthMm,
        row.lengthMm,
        k,
        row.priceKg,
        row.quantity
      );
      const displayMeasure = buildDisplayMeasure(
        batchGeometry,
        row.thicknessMm,
        row.diameterMm,
        row.widthMm,
        row.lengthMm,
        row.rawDiameter,
        row.rawThickness
      );
      return {
        ...row,
        geometry: batchGeometry,
        constantK: k,
        unitWeightKg,
        totalWeightKg,
        unitPrice,
        subtotal,
        displayMeasure
      };
    }));
  };

  const handleApplyMaterialToAll = () => {
    if (!batchMaterial.trim()) return;
    setPreviewRows(prev => prev.map(row => {
      const { k, precoKg } = resolveMaterialDefaults(batchMaterial, row.geometry);
      const newPrice = row.priceKg || precoKg;
      const { unitWeightKg, totalWeightKg, unitPrice, subtotal } = computeRowCalculations(
        row.geometry,
        row.thicknessMm,
        row.diameterMm,
        row.widthMm,
        row.lengthMm,
        k,
        newPrice,
        row.quantity
      );
      return {
        ...row,
        materialName: batchMaterial,
        constantK: k,
        priceKg: newPrice,
        unitWeightKg,
        totalWeightKg,
        unitPrice,
        subtotal
      };
    }));
  };

  // Atualização de Linha Individual na Tabela
  const handleRowChange = (id: string, updates: Partial<ImportedRowPreview>) => {
    setPreviewRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, ...updates };

      const { unitWeightKg, totalWeightKg, unitPrice, subtotal } = computeRowCalculations(
        updated.geometry,
        updated.thicknessMm,
        updated.diameterMm,
        updated.widthMm,
        updated.lengthMm,
        updated.constantK,
        updated.priceKg,
        updated.quantity
      );

      const displayMeasure = buildDisplayMeasure(
        updated.geometry,
        updated.thicknessMm,
        updated.diameterMm,
        updated.widthMm,
        updated.lengthMm,
        updated.rawDiameter,
        updated.rawThickness
      );

      return {
        ...updated,
        unitWeightKg,
        totalWeightKg,
        unitPrice,
        subtotal,
        displayMeasure
      };
    }));
  };

  const handleRemoveRow = (id: string) => {
    setPreviewRows(prev => prev.filter(r => r.id !== id));
  };

  // 5. CONFIRMAR E LANÇAR ITENS NO ORÇAMENTO PRINCIPAL
  const handleConfirmImport = () => {
    if (previewRows.length === 0) {
      alert('Não há itens válidos para importar.');
      return;
    }

    const todayIso = getSafeISODate();

    const quoteItems: QuoteItem[] = previewRows.map((row, idx) => {
      const geomType = row.geometry === 'macico' 
        ? 'REDONDO_QUADRADO' 
        : (row.geometry === 'bucha' ? 'TUBO_BUCHA' : 'CHAPA_RETANGULO');

      const diaPol = formatDimensaoPolegada(row.diameterMm > 0 ? row.diameterMm : row.rawDiameter);
      const thickPol = formatDimensaoPolegada(row.thicknessMm > 0 ? row.thicknessMm : row.rawThickness);
      const widthMmStr = row.widthMm > 0 ? formatDimensaoMm(row.widthMm) : '';
      const lengthMmStr = row.lengthMm > 0 ? formatDimensaoMm(row.lengthMm) : '';

      const cleanDesc = row.description?.trim() || (row.geometry === 'macico' ? 'Trefilado' : row.geometry === 'bucha' ? 'Bucha / Tubo Mecânico' : 'Retângulo');

      return {
        id: `item-import-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
        date: todayIso,
        companyName: clientName,
        description: cleanDesc,
        descricao: cleanDesc,
        constant: row.constantK >= 0.1 ? row.constantK : (row.constantK * 1000).toFixed(2),
        constantName: row.materialName,
        constanteNome: row.materialName,
        material: row.materialName,
        produto: row.materialName,
        pricePerKg: row.priceKg,
        geometryType: geomType,
        profileType: row.geometry,
        measure: row.displayMeasure,
        medida: row.displayMeasure,
        medidaFormatada: row.displayMeasure,
        medidasFormatadas: row.displayMeasure,
        thickness: thickPol,
        espessura: thickPol,
        thicknessMm: row.thicknessMm > 0 ? row.thicknessMm : undefined,
        espessuraMm: row.thicknessMm > 0 ? row.thicknessMm : undefined,
        diameter: diaPol,
        diametro: diaPol,
        diameterMm: row.diameterMm > 0 ? row.diameterMm : undefined,
        diametroMm: row.diameterMm > 0 ? row.diameterMm : undefined,
        widthLength: row.lengthMm > 0 ? (row.widthMm > 0 ? `${widthMmStr} x ${lengthMmStr}` : lengthMmStr) : '-',
        widthMm: row.widthMm > 0 ? row.widthMm : undefined,
        larguraMm: row.widthMm > 0 ? row.widthMm : undefined,
        largura: widthMmStr,
        lengthMm: row.lengthMm > 0 ? row.lengthMm : undefined,
        comprimentoMm: row.lengthMm > 0 ? row.lengthMm : undefined,
        comprimento: lengthMmStr,
        unitPrice: row.unitPrice,
        valorUnitario: row.unitPrice,
        quantity: row.quantity,
        qtd: row.quantity,
        subtotal: row.subtotal,
        unitWeightKg: row.unitWeightKg,
        totalWeightKg: row.totalWeightKg,
        pesoTotal: row.totalWeightKg,
        notes: row.notes,
        observacao: row.notes,
        info: row.notes,
        informacoes: row.notes
      };
    });

    onImportItems(quoteItems);
    onClose();
  };

  // Totais do Preview
  const totalItemsCount = previewRows.length;
  const totalPiecesCount = previewRows.reduce((acc, r) => acc + (r.quantity || 0), 0);
  const totalWeightPreview = previewRows.reduce((acc, r) => acc + (r.totalWeightKg || 0), 0);
  const totalSubtotalPreview = previewRows.reduce((acc, r) => acc + (r.subtotal || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* CABEÇALHO DO MODAL */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
                {step === 'preview' 
                  ? 'Pré-visualização da Importação de Itens' 
                  : step === 'mapping' 
                  ? 'Mapeamento Manual de Colunas' 
                  : 'Importar Planilha Excel / CSV'}
                <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  UsiCorte Industrial
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                {step === 'preview'
                  ? 'Conferência técnica em polegadas, edição em lote e cálculo automático de pesos (Kg)'
                  : step === 'mapping'
                  ? 'Associe as colunas do seu arquivo aos campos do sistema com base na 1ª linha'
                  : 'Carregue arquivos .xlsx, .xls ou .csv de pedidos e projetos'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Fechar Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MENSAGEM DE ERRO SE HOUVER */}
        {errorMsg && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex items-center gap-2 text-xs font-semibold text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* CORPO DO MODAL BASEADO NO PASSO */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ============================================================== */}
          {/* PASSO 1: UPLOAD                                                */}
          {/* ============================================================== */}
          {step === 'upload' && (
            <div className="space-y-6 max-w-2xl mx-auto py-8 text-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-indigo-300 hover:border-indigo-600 rounded-2xl p-10 bg-indigo-50/40 hover:bg-indigo-50/70 transition-all cursor-pointer flex flex-col items-center justify-center space-y-4 group"
              >
                <div className="p-4 bg-white rounded-2xl shadow-sm text-indigo-600 group-hover:scale-105 transition-transform border border-indigo-100">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Clique para selecionar ou arraste sua planilha
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Formatos aceitos: Microsoft Excel (.xlsx, .xls) ou Texto delimitado (.csv)
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Detecção automática de polegadas (1", 1.1/2") e fórmulas UsiCorte
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs text-slate-600 space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-indigo-600" />
                  Dicas para compatibilidade 100%:
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>Se sua planilha tiver medidas em polegadas (ex: <b>1"</b>, <b>1.1/2"</b>, <b>3/4"</b>), o sistema converterá automaticamente para milímetros nos cálculos matemáticos.</li>
                  <li>Se tiver <b>Espessura e Largura</b>, será classificada como <b>Chapa/Retângulo</b>: <code>(Esp × Larg × Comp × k) / 1000</code>.</li>
                  <li>Se tiver <b>Diâmetro e Comprimento</b>, será classificada como <b>Maciço Redondo</b>: <code>(Ø² × Comp × k) / 1000</code>.</li>
                </ul>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASSO 2: MAPEAMENTO MANUAL DE COLUNAS                          */}
          {/* ============================================================== */}
          {step === 'mapping' && (
            <div className="space-y-6">
              {/* Painel Informativo e Configurações de Unidade */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    Arquivo: <span className="font-mono text-indigo-700">{fileName}</span> ({rawMatrix.length} linhas detectadas)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Revise cada coluna e associe aos campos correspondentes do sistema UsiCorte.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300">
                    <input
                      type="checkbox"
                      checked={hasHeaderRow}
                      onChange={(e) => setHasHeaderRow(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                    />
                    <span>1ª linha é Cabeçalho</span>
                  </label>

                  <div className="flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200">
                    <span className="text-slate-500 font-normal">Unidade:</span>
                    <select
                      value={unitMode}
                      onChange={(e) => setUnitMode(e.target.value as any)}
                      className="bg-transparent font-bold text-slate-800 outline-hidden cursor-pointer"
                    >
                      <option value="auto">Automático (detecta " e frações)</option>
                      <option value="inch">Forçar Polegadas (")</option>
                      <option value="mm">Milímetros (mm)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Grid de Colunas para Mapeamento */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(rawMatrix[0] || []).map((headerVal, colIdx) => {
                  const sampleValueRow1 = rawMatrix[hasHeaderRow ? 1 : 0]?.[colIdx];
                  const sampleValueRow2 = rawMatrix[hasHeaderRow ? 2 : 1]?.[colIdx];
                  const currentField = columnMappings[colIdx] || 'ignore';

                  return (
                    <div 
                      key={colIdx}
                      className={`p-4 rounded-xl border transition-all ${
                        currentField !== 'ignore' 
                          ? 'bg-indigo-50/50 border-indigo-200 shadow-xs' 
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-200/70 text-slate-700 rounded">
                          Coluna {String.fromCharCode(65 + (colIdx % 26))} (#{colIdx + 1})
                        </span>
                        {hasHeaderRow && (
                          <span className="text-xs font-bold text-slate-900 truncate max-w-[160px]" title={String(headerVal)}>
                            "{String(headerVal || 'Sem título')}"
                          </span>
                        )}
                      </div>

                      {/* Amostras da Coluna */}
                      <div className="bg-white/80 rounded-lg p-2 border border-slate-100 text-[11px] font-mono space-y-0.5 mb-3">
                        <div className="text-slate-400 text-[10px] font-sans">Amostra de valores da planilha:</div>
                        <div className="truncate text-slate-800 font-semibold">
                          1ª linha: <span className="text-indigo-600 font-bold">{sampleValueRow1 !== undefined && sampleValueRow1 !== '' ? String(sampleValueRow1) : '(Vazio)'}</span>
                        </div>
                        {sampleValueRow2 !== undefined && (
                          <div className="truncate text-slate-500">
                            2ª linha: <span>{String(sampleValueRow2)}</span>
                          </div>
                        )}
                      </div>

                      {/* Dropdown de Associação */}
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Mapear para o campo:
                      </label>
                      <select
                        value={currentField}
                        onChange={(e) => {
                          const val = e.target.value as SystemColumnField;
                          setColumnMappings(prev => ({ ...prev, [colIdx]: val }));
                        }}
                        className={`w-full px-2.5 py-2 text-xs font-semibold rounded-xl border outline-hidden transition-all cursor-pointer ${
                          currentField !== 'ignore'
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {SYSTEM_COLUMN_OPTIONS.map(opt => (
                          <option key={opt.field} value={opt.field} className="bg-white text-slate-800">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASSO 3: PRÉ-VISUALIZAÇÃO COM ALTERAÇÃO EM LOTE E CONFERÊNCIA   */}
          {/* ============================================================== */}
          {step === 'preview' && (
            <div className="space-y-5">
              
              {/* CABEÇALHO DO MODAL: ALTERAÇÃO EM LOTE CONFORME ITEM 3 DO BRIEF */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-md space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      Alteração em Lote no Cabeçalho da Importação
                    </h3>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Defina parâmetros globais e clique nos botões para aplicar instantaneamente a todas as linhas da tabela
                    </p>
                  </div>

                  {/* Badges de Resumo em Tempo Real */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-slate-800/90 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg text-xs font-mono font-bold">
                      {totalItemsCount} Itens ({totalPiecesCount} Peças)
                    </span>
                    <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-lg text-xs font-mono font-bold">
                      Peso Total: {formatWeightKg(totalWeightPreview, 3)}
                    </span>
                    <span className="bg-indigo-900/80 text-indigo-200 border border-indigo-700 px-2.5 py-1 rounded-lg text-xs font-mono font-black">
                      Subtotal: {formatCurrency(totalSubtotalPreview)}
                    </span>
                  </div>
                </div>

                {/* Controles de Lote: Preço por Kg e Geometria */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end pt-1">
                  
                  {/* Preço Padrão por Kg (R$/Kg) com Botão Aplicar a Todos */}
                  <div className="lg:col-span-4 space-y-1">
                    <label className="block text-[11px] font-bold text-emerald-300 flex items-center justify-between">
                      <span>Preço Padrão por Kg (R$/Kg) *</span>
                      <span className="text-[9px] font-mono text-emerald-400">R$/Kg</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-2 text-xs font-mono font-black text-slate-400">R$</span>
                        <input
                          type="text"
                          value={batchPriceKg}
                          onChange={(e) => setBatchPriceKg(e.target.value)}
                          placeholder="22,00"
                          className="w-full pl-8 pr-2.5 py-1.5 bg-slate-800 text-white border border-slate-700 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-emerald-400 outline-hidden"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyPriceToAll}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0 shadow-xs active:scale-95"
                        title="Aplica este preço por Kg para todas as linhas da tabela"
                      >
                        Aplicar a Todos
                      </button>
                    </div>
                  </div>

                  {/* Geometria Padrão com Botão Aplicar Geometria a Todos */}
                  <div className="lg:col-span-4 space-y-1">
                    <label className="block text-[11px] font-bold text-indigo-300 flex items-center justify-between">
                      <span>Geometria Padrão *</span>
                      <span className="text-[9px] font-mono text-indigo-400">Fórmula UsiCorte</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={batchGeometry}
                        onChange={(e) => setBatchGeometry(e.target.value as GeometryChoice)}
                        className="flex-1 px-2.5 py-1.5 bg-slate-800 text-white border border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-400 outline-hidden cursor-pointer"
                      >
                        <option value="chapa">1. Chapa / Retângulo (Esp × Larg × Comp × k)</option>
                        <option value="macico">2. Maciço Redondo (Ø² × Comp × k)</option>
                        <option value="bucha">3. Tubo / Bucha ((ØExt² - ØInt²) × Comp × k)</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleApplyGeometryToAll}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0 shadow-xs active:scale-95"
                        title="Aplica esta geometria para todas as linhas da tabela"
                      >
                        Aplicar Geometria a Todos
                      </button>
                    </div>
                  </div>

                  {/* Material Padrão Opcional */}
                  <div className="lg:col-span-4 space-y-1">
                    <label className="block text-[11px] font-bold text-slate-300">
                      Material Padrão (Opcional)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={batchMaterial}
                        onChange={(e) => setBatchMaterial(e.target.value)}
                        placeholder="Ex: OXICORTE A36, SAE 1045..."
                        className="flex-1 px-2.5 py-1.5 bg-slate-800 text-white border border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-400 outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleApplyMaterialToAll}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors shrink-0 active:scale-95"
                      >
                        Aplicar Material
                      </button>
                    </div>
                  </div>

                </div>
              </div>

              {/* TABELA DE CONFERÊNCIA COM EDIÇÃO POR LINHA */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-[48vh]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-slate-200 uppercase font-semibold text-[10px] tracking-wider sticky top-0 z-10 shadow-xs">
                      <tr>
                        <th className="py-3 px-2.5 w-10 text-center">#</th>
                        <th className="py-3 px-3 min-w-[150px]">Material / Item</th>
                        <th className="py-3 px-3 min-w-[130px]">Descrição / Formato</th>
                        <th className="py-3 px-3 min-w-[130px]">Geometria</th>
                        <th className="py-3 px-3 min-w-[150px]">Dimensões (Polegadas / mm)</th>
                        <th className="py-3 px-3 text-center w-16">Qtd</th>
                        <th className="py-3 px-3 min-w-[140px]">Observações / Info</th>
                        <th className="py-3 px-3 text-right text-emerald-300 bg-slate-800 font-bold whitespace-nowrap">Peso Calc. (Kg)</th>
                        <th className="py-3 px-3 text-right min-w-[90px]">Preço/Kg (R$)</th>
                        <th className="py-3 px-3 text-right font-bold text-indigo-200 min-w-[90px]">Subtotal (R$)</th>
                        <th className="py-3 px-2 w-10 text-center">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {previewRows.map((row, idx) => (
                        <tr key={row.id} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-400">
                            {idx + 1}
                          </td>

                          {/* Material */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={row.materialName}
                              onChange={(e) => handleRowChange(row.id, { materialName: e.target.value })}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-500 outline-hidden"
                            />
                          </td>

                          {/* Descrição / Formato do Corte */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={row.description}
                              onChange={(e) => handleRowChange(row.id, { description: e.target.value })}
                              placeholder="Ex: Retângulo, Trefilado..."
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-indigo-950 focus:bg-white focus:border-indigo-500 outline-hidden"
                            />
                          </td>

                          {/* Geometria por Linha */}
                          <td className="py-2.5 px-3">
                            <select
                              value={row.geometry}
                              onChange={(e) => {
                                const newGeom = e.target.value as GeometryChoice;
                                const { k } = resolveMaterialDefaults(row.materialName, newGeom);
                                const defaultD = newGeom === 'macico' ? 'Trefilado' : newGeom === 'bucha' ? 'Bucha / Tubo Mecânico' : 'Retângulo';
                                const descUpdated = (!row.description || row.description === 'Retângulo' || row.description === 'Trefilado' || row.description === 'Bucha / Tubo Mecânico')
                                  ? defaultD
                                  : row.description;
                                handleRowChange(row.id, { geometry: newGeom, constantK: k, description: descUpdated });
                              }}
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:border-indigo-500 outline-hidden cursor-pointer"
                            >
                              <option value="chapa">Chapa / Retângulo</option>
                              <option value="macico">Maciço Redondo</option>
                              <option value="bucha">Tubo / Bucha</option>
                            </select>
                          </td>

                          {/* Dimensões em Polegadas */}
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                            <div className="font-bold text-indigo-900 bg-indigo-50 px-2 py-1 rounded-md border border-indigo-100 flex items-center gap-1.5" title="Dimensão formatada: Espessura/Diâmetro em polegadas, Largura/Comprimento em mm">
                              <span>{row.displayMeasure || '—'}</span>
                            </div>
                          </td>

                          {/* Quantidade */}
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={row.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 1;
                                handleRowChange(row.id, { quantity: val });
                              }}
                              className="w-14 px-1.5 py-1 text-center font-mono font-bold bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:border-indigo-500 outline-hidden"
                            />
                          </td>

                          {/* Observações / Informações */}
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={row.notes}
                              onChange={(e) => handleRowChange(row.id, { notes: e.target.value })}
                              placeholder="Ex: CONF DESENHO..."
                              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:border-indigo-500 outline-hidden"
                            />
                          </td>

                          {/* Peso Calculado (KG) */}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/40 whitespace-nowrap">
                            <div>{formatWeightKg(row.totalWeightKg, 3)}</div>
                            <div className="text-[10px] text-slate-400 font-normal">
                              {formatNumberBR(row.unitWeightKg, 3)} kg/un
                            </div>
                          </td>

                          {/* Preço / Kg (R$) */}
                          <td className="py-2.5 px-3 text-right font-mono">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-[10px] text-slate-400">R$</span>
                              <input
                                type="text"
                                value={formatNumberBR(row.priceKg, 2)}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value.replace(',', '.')) || 0;
                                  handleRowChange(row.id, { priceKg: val });
                                }}
                                className="w-16 px-1.5 py-1 text-right font-mono font-bold text-emerald-700 bg-emerald-50/50 border border-emerald-200 rounded-lg text-xs focus:bg-white focus:border-emerald-500 outline-hidden"
                              />
                            </div>
                          </td>

                          {/* Subtotal (R$) */}
                          <td className="py-2.5 px-3 text-right font-mono font-black text-indigo-700 whitespace-nowrap">
                            {formatCurrency(row.subtotal)}
                          </td>

                          {/* Remover Linha */}
                          <td className="py-2.5 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Remover linha da importação"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* RODAPÉ DO MODAL COM BOTÕES DE AÇÃO */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div>
            {step === 'mapping' && (
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Trocar Arquivo
              </button>
            )}

            {step === 'preview' && (
              <button
                type="button"
                onClick={() => setStep('mapping')}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar ao Mapeamento
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* BOTÃO CANCELAR */}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            {/* BOTÃO AVANÇAR NO MAPEAMENTO */}
            {step === 'mapping' && (
              <button
                type="button"
                onClick={handleProceedToPreview}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span>Avançar para Pré-visualização</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {/* BOTÃO CONFIRMAR E LANÇAR ITENS NO PREVIEW */}
            {step === 'preview' && (
              <button
                type="button"
                onClick={handleConfirmImport}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar e Lançar {previewRows.length} Itens</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
