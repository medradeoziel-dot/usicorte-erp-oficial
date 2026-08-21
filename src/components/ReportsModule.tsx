import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Quote, QuoteItem, Client } from '../types';
import Logo from './Logo';
import { QuotePrintView } from './QuotePrintView';
import { 
  formatCurrency, 
  formatWeightKg, 
  formatarMedidasLimpa 
} from '../utils/calculator';
import { 
  fetchCotacoesDb, 
  uploadDesenhoStorage, 
  updateItemCortadoDb,
  db 
} from '../lib/db';
import { 
  FileText, 
  Printer, 
  Download, 
  Calendar, 
  Building, 
  User, 
  Scale, 
  DollarSign, 
  Layers, 
  FileSpreadsheet,
  Scissors,
  Tag,
  Image as ImageIcon,
  Upload,
  Trash2,
  Eye,
  CheckCircle2,
  Search,
  Filter,
  CheckSquare,
  Square,
  Sparkles
} from 'lucide-react';

interface ReportsModuleProps {
  currentQuote: Quote;
  clients?: Client[];
  onNavigateToQuote?: () => void;
}

export type StatusProposta = 'rascunho' | 'pendente' | 'aprovado' | 'rejeitado';

type PrintModelType = 'A4-inteiro' | 'A4-2vias' | 'etiqueta-80' | 'proposta-resumida' | 'corte';

export interface ConsultaItem {
  idVer: number;
  data: string;
  empresa: string;
  contato: string;
  produto: string;
  medida: string;
  descricao: string;
  valor: string;
  qtd: number;
  unitario: number;
  valorGeral: number;
  cotacao: string;
  observacao?: string;
  status: StatusProposta;
}

// Dados de exemplo para o módulo de consulta
const DADOS_CONSULTA_EXEMPLO: ConsultaItem[] = [
  { idVer: 13942, data: '12/08/2026', empresa: 'DPROJECTS', contato: 'Marcos', produto: 'NYLON REDONDO', medida: '60 x 780', descricao: 'NYLON', valor: 'R$ 90,00', qtd: 1, unitario: 238, valorGeral: 238, cotacao: '' , status: 'rascunho' },
  { idVer: 13940, data: '12/08/2026', empresa: 'DPROJECTS', contato: 'Marcos', produto: 'QUADRADO', medida: '1 1/4 x 110', descricao: 'TREFILADO SAE 1045', valor: 'R$ 35,00', qtd: 1, unitario: 30, valorGeral: 30, cotacao: '' , status: 'pendente' },
  { idVer: 13930, data: '12/08/2026', empresa: 'VCI METAIS', contato: 'Carlos', produto: 'CHAPA', medida: '1 1/2 x 79 x 155', descricao: 'RETANGULO', valor: 'R$ 22,00', qtd: 1, unitario: 81, valorGeral: 81, cotacao: '' , status: 'aprovado' },
  { idVer: 13911, data: '12/08/2026', empresa: 'PORTEX', contato: 'Roberto', produto: 'AÇO REDONDO', medida: '4"1/2 x 40', descricao: 'LAMINADO SAE 4140', valor: 'R$ 28,00', qtd: 1, unitario: 90, valorGeral: 90, cotacao: 'COT 127' , status: 'rejeitado' },
  { idVer: 13897, data: '12/08/2026', empresa: 'IRMÃOS VICENTE', contato: 'João', produto: 'AÇO REDONDO', medida: '5" x 43', descricao: 'LAMINADO SAE 1045', valor: 'R$ 21,00', qtd: 1, unitario: 90, valorGeral: 90, cotacao: '', status: 'aprovado' }
];

const STATUS_STYLES: Record<StatusProposta, string> = {
  rascunho: 'bg-slate-200 text-slate-700',
  pendente: 'bg-amber-200 text-amber-900',
  aprovado: 'bg-emerald-200 text-emerald-900',
  rejeitado: 'bg-rose-200 text-rose-900'
};

// Sample technical blueprint drawing in base64 SVG
const SAMPLE_DRAWING_BASE64 = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><rect width="200" height="200" fill="%23f8fafc" stroke="%23cbd5e1" stroke-width="2"/><circle cx="100" cy="100" r="60" fill="none" stroke="%232563eb" stroke-width="2" stroke-dasharray="4,2"/><circle cx="100" cy="100" r="35" fill="%23dbeafe" stroke="%231e40af" stroke-width="2.5"/><line x1="20" y1="100" x2="180" y2="100" stroke="%23ef4444" stroke-width="1" stroke-dasharray="3,3"/><line x1="100" y1="20" x2="100" y2="180" stroke="%23ef4444" stroke-width="1" stroke-dasharray="3,3"/><circle cx="100" cy="100" r="3" fill="%23ef4444"/><text x="100" y="32" font-family="monospace" font-size="10" text-anchor="middle" font-weight="bold" fill="%231e293b">Ø 120 ±0.05</text><text x="100" y="104" font-family="monospace" font-size="9" text-anchor="middle" font-weight="bold" fill="%231e40af">Ø 70 mm</text><text x="100" y="188" font-family="sans-serif" font-size="8" text-anchor="middle" fill="%2364748b">CORTE / USINAGEM CNC</text></svg>`;

export default function ReportsModule({ currentQuote, clients = [], onNavigateToQuote }: ReportsModuleProps) {
  // Navigation tab: 'propostas' | 'consulta'
  const [activeTab, setActiveTab] = useState<'propostas' | 'consulta'>('propostas');

  // Active document preview / print mode
  const [activeModel, setActiveModel] = useState<PrintModelType>('A4-inteiro');
  const [printMode, setPrintMode] = useState<'pedido' | 'etiqueta' | 'proposta' | 'corte'>('pedido');
  
  // Limpeza de classes de impressão ao desmontar ou após fechar caixa de impressão
  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('print-pedido', 'print-etiqueta', 'print-proposta', 'print-corte');
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      handleAfterPrint();
    };
  }, []);
  
  // Selected client for report (prioritizing Nome Fantasia)
  const [selectedClientName, setSelectedClientName] = useState<string>(() => currentQuote.clientName || 'CLIENTE BALCÃO');
  
  // Selected saved order/file
  const [selectedOrderKey, setSelectedOrderKey] = useState<string>('CURRENT');
  
  // Drawing photo for item/label
  // ✅ UMA imagem POR ITEM (chave = índice do item), em vez de uma única imagem global
  const [drawingPhotos, setDrawingPhotos] = useState<Record<number, string>>({});
  
  // Selected item index for individual label printing
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);

  // Status message for Ctrl+V paste area
  const [pasteSuccess, setPasteSuccess] = useState<boolean>(false);

  // States for Consulta Module
  const [tipoFiltro, setTipoFiltro] = useState<'cliente' | 'cotacao' | 'contato' | 'produto' | 'data'>('cliente');
  const [inputBusca, setInputBusca] = useState<string>('');
  // Campo dedicado: NOME DO CLIENTE (filtra sempre, combinado com a busca acima)
  const [clienteBusca, setClienteBusca] = useState<string>('');
  // Filtro por situação da proposta (para não misturar no fechamento)
  const [statusFiltro, setStatusFiltro] = useState<'todos' | StatusProposta>('todos');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dbQuotesItems, setDbQuotesItems] = useState<ConsultaItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  // Carrega cotações e itens do Supabase e LocalStorage
  useEffect(() => {
    async function loadAllConsultaData() {
      const itemsList: ConsultaItem[] = [];

      // 1. Do LocalStorage
      const saved = localStorage.getItem('s_orcamentos');
      if (saved) {
        try {
          const quotes: Quote[] = JSON.parse(saved);
          quotes.forEach((q, qIdx) => {
            (q.items || []).forEach((it, itIdx) => {
              itemsList.push({
                idVer: 20000 + qIdx * 100 + itIdx,
                data: q.date ? new Date(q.date).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
                empresa: q.clientName || 'Cliente Balcão',
                contato: q.contactPerson || '-',
                produto: it.constantName || it.description || 'Material',
                medida: formatarMedidasLimpa(it),
                descricao: it.description || 'Peça UsiCorte',
                valor: formatCurrency(it.unitPrice || 0),
                qtd: it.quantity || 1,
                unitario: it.unitPrice || 0,
                valorGeral: (it.unitPrice || 0) * (it.quantity || 1),
                cotacao: q.quoteNumber || `COT-${qIdx + 1}`,
                observacao: it.notes || '',
                status: (q.status?.toLowerCase().includes('aprov') ? 'aprovado' :
                         q.status?.toLowerCase().includes('canc') ? 'rejeitado' :
                         q.status?.toLowerCase().includes('env') ? 'pendente' : 'rascunho') as StatusProposta
              });
            });
          });
        } catch (e) {
          console.warn('Erro ao ler s_orcamentos');
        }
      }

      // 2. Do Supabase
      try {
        const dbData = await fetchCotacoesDb();
        if (dbData && dbData.length > 0) {
          dbData.forEach((q, qIdx) => {
            (q.cotacao_itens || []).forEach((it, itIdx) => {
              // Evita duplicatas se já adicionado por número de cotação
              const cotNum = q.numero;
              const exists = itemsList.some(ex => ex.cotacao === cotNum && ex.descricao === it.descricao);
              if (!exists) {
                itemsList.push({
                  idVer: 30000 + qIdx * 100 + itIdx,
                  data: q.data ? new Date(q.data).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
                  empresa: q.cliente_nome,
                  contato: q.contato || '-',
                  produto: it.produto || 'Peça',
                  medida: it.medida || '',
                  descricao: it.descricao || 'Item UsiCorte',
                  valor: formatCurrency(it.valor_unitario || 0),
                  qtd: it.quantidade || 1,
                  unitario: it.valor_unitario || 0,
                  valorGeral: it.valor_total || ((it.valor_unitario || 0) * (it.quantidade || 1)),
                  cotacao: q.numero,
                  observacao: it.observacao || '',
                  status: q.status as StatusProposta
                });
              }
            });
          });
        }
      } catch (err) {
        console.warn('Supabase offline ou sem cotações:', err);
      }

      if (itemsList.length > 0) {
        setDbQuotesItems(itemsList);
      }
    }

    loadAllConsultaData();
  }, []);

  // Combine current quote items with Supabase and sample database entries
  const allConsultaItems: ConsultaItem[] = useMemo(() => {
    const currentItems: ConsultaItem[] = (currentQuote?.items || []).map((it, idx) => ({
      idVer: 14000 + idx,
      data: new Date().toLocaleDateString('pt-BR'),
      empresa: selectedClientName || currentQuote.clientName || 'CLIENTE BALCÃO',
      contato: currentQuote.contactPerson || 'Marcos',
      produto: it.constanteNome || it.material || 'MATERIAL',
      medida: formatarMedidasLimpa(it),
      descricao: it.descricao || it.description || 'PEÇA USICORTE',
      valor: formatCurrency(it.unitPrice || 0),
      qtd: it.qtd || it.quantity || 1,
      unitario: it.unitPrice || 0,
      valorGeral: (it.unitPrice || 0) * (it.qtd || it.quantity || 1),
      cotacao: currentQuote.quoteNumber || 'COT-00124',
      observacao: (it.observacao || it.notes || it.info || '') as string,
      status: (((it as unknown as { status?: StatusProposta }).status) || (currentQuote as unknown as { status?: StatusProposta }).status || 'rascunho') as StatusProposta
    }));

    if (dbQuotesItems.length > 0) {
      return [...currentItems, ...dbQuotesItems];
    }

    return [...currentItems, ...DADOS_CONSULTA_EXEMPLO];
  }, [currentQuote, selectedClientName, dbQuotesItems]);

  // Normaliza texto (minúsculo, sem acentos) para comparações
  const normalizar = (v: unknown) =>
    String(v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();

  // Filtra a tabela: NOME DO CLIENTE (sempre) + categoria selecionada
  const filteredConsultaItems = useMemo(() => {
    const term = normalizar(inputBusca);
    const cliente = normalizar(clienteBusca);

    return allConsultaItems.filter(item => {
      // 1) Filtro fixo por nome do cliente
      if (cliente && !normalizar(item.empresa).includes(cliente)) return false;

      // 1.b) Filtro por situação (rascunho / pendente / aprovado / rejeitado)
      if (statusFiltro !== 'todos' && item.status !== statusFiltro) return false;

      // 2) Filtro por categoria selecionada
      if (!term) return true;

      switch (tipoFiltro) {
        case 'cliente':
          return normalizar(item.empresa).includes(term);
        case 'cotacao':
          return normalizar(item.cotacao).includes(term);
        case 'contato':
          return normalizar(item.contato).includes(term);
        case 'produto':
          return normalizar(item.produto).includes(term) || normalizar(item.descricao).includes(term);
        case 'data':
          return normalizar(item.data).includes(term);
        default:
          return true;
      }
    });
  }, [allConsultaItems, inputBusca, clienteBusca, tipoFiltro, statusFiltro]);

  // Mantém selecionados apenas os itens que continuam visíveis após o filtro
  useEffect(() => {
    setSelectedIds(prev => {
      const visiveis = new Set(filteredConsultaItems.map(i => i.idVer));
      const next = prev.filter(id => visiveis.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [filteredConsultaItems]);

  // Linhas selecionadas usadas no modelo de CORTE
  const itensCorte = useMemo(
    () => filteredConsultaItems.filter(i => selectedIds.includes(i.idVer)),
    [filteredConsultaItems, selectedIds]
  );

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredConsultaItems.map(item => item.idVer));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (idVer: number) => {
    setSelectedIds(prev => 
      prev.includes(idVer) ? prev.filter(id => id !== idVer) : [...prev, idVer]
    );
  };

  // ✅ Cada botão da CONSULTA chama a sua própria tela de impressão (modelos já existentes)
  const imprimirRelatorioGeral = (tipoRelatorio: 'GERAL' | 'EMPRESA' | 'PEDIDO' | 'ETIQUETAS' | 'CORTE') => {
    if (selectedIds.length === 0) {
      alert(`Por favor, selecione ao menos um item da tabela para gerar o relatório de ${tipoRelatorio}.`);
      return;
    }

    document.body.classList.remove('print-pedido', 'print-etiqueta', 'print-proposta', 'print-corte', 'print-geral');

    // O modelo de CORTE é gerado a partir das linhas selecionadas na própria consulta
    if (tipoRelatorio === 'CORTE') {
      setActiveModel('corte');
      setPrintMode('corte');
      document.body.classList.add('print-corte');
      setTimeout(() => window.print(), 250);
      return;
    }

    // Demais botões reaproveitam os modelos da aba de Propostas
    const mapa: Record<string, PrintModelType> = {
      GERAL: 'A4-inteiro',        // modelo inteiro A4 (Geral)
      EMPRESA: 'proposta-resumida', // antigo "4 colunas" -> Empresa
      PEDIDO: 'A4-2vias',
      ETIQUETAS: 'etiqueta-80'
    };

    setActiveTab('propostas');
    setTimeout(() => gerarEImprimir(mapa[tipoRelatorio]), 200);
  };

  // Sync client name if quote updates
  useEffect(() => {
    if (currentQuote.clientName && selectedOrderKey === 'CURRENT') {
      setSelectedClientName(currentQuote.clientName);
    }
  }, [currentQuote.clientName, selectedOrderKey]);

  // ✅ Normaliza texto para comparação (sem acento, sem símbolos, maiúsculo)
  const normalizeKey = (txt: string) =>
    (txt || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\.[^.]+$/, '')            // remove extensão do arquivo
      .replace(/[^a-zA-Z0-9]/g, '')       // remove espaços, traços, underline...
      .toUpperCase();

  // Texto de "observação" usado como etiqueta de cada item
  const getItemLabel = (it: Partial<QuoteItem>) =>
    (it?.observacao || it?.notes || it?.info || it?.descricao || '') as string;

  // Mensagem de resultado do casamento nome-do-arquivo x observação
  const [matchInfo, setMatchInfo] = useState<string>('');

  // Handle clipboard paste (Ctrl + V / PrintScreen / Win+Shift+S)
  const processClipboardItems = (clipboardData: DataTransfer | null) => {
    if (!clipboardData) return;
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const base64 = e.target?.result as string;
            // aplica a imagem colada APENAS ao item selecionado
            setDrawingPhotos(prev => ({ ...prev, [selectedItemIndex]: base64 }));
            setPasteSuccess(true);
            setTimeout(() => setPasteSuccess(false), 4000);
          };
          reader.readAsDataURL(blob);
        }
        break;
      }
    }
  };

  const handlePasteEvent = (e: React.ClipboardEvent) => {
    processClipboardItems(e.clipboardData);
  };

  // Handle saved file / order switcher
const handleOrderChange = (key: string) => {
  setSelectedOrderKey(key);

  if (key === 'PED-00124') {
    setSelectedClientName('USICORTE USINAGEM LTDA');
    setDrawingPhotos({});
  } else if (key === 'PED-00125') {
    setSelectedClientName('INDÚSTRIA METALÚRGICA SP');
    // pedido sem foto: marca todos os itens como vazio
    setDrawingPhotos(Object.fromEntries(currentQuote.items.map((_, i) => [i, ''])));
  } else {
    setSelectedClientName(currentQuote.clientName || 'CLIENTE BALCÃO');
    // ✅ cada item volta a usar a SUA própria imagem
    setDrawingPhotos({});
  }
};

  // Handle drawing photo upload (SELEÇÃO MÚLTIPLA + casamento pelo nome do arquivo)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;

    // Mapa: observação normalizada -> índice do item
    const labelMap = new Map<string, number>();
    (currentQuote.items || []).forEach((it, idx) => {
      const key = normalizeKey(getItemLabel(it));
      if (key && !labelMap.has(key)) labelMap.set(key, idx);
    });

    const matched: string[] = [];
    const unmatched: string[] = [];
    let pending = files.length;

    files.forEach((file) => {
      const fileKey = normalizeKey(file.name);

      // 1) match exato  2) match parcial (arquivo contém a observação ou vice-versa)
      let targetIdx = labelMap.get(fileKey);
      if (targetIdx === undefined) {
        for (const [key, idx] of labelMap.entries()) {
          if (fileKey.includes(key) || key.includes(fileKey)) {
            targetIdx = idx;
            break;
          }
        }
      }
      // 3) se veio um único arquivo e nada casou, aplica no item selecionado
      if (targetIdx === undefined && files.length === 1) targetIdx = selectedItemIndex;

      if (targetIdx === undefined) {
        unmatched.push(file.name);
        if (--pending === 0) finish();
        return;
      }

      const idx = targetIdx;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setDrawingPhotos(prev => ({ ...prev, [idx]: base64 }));
        matched.push(`${file.name} → item ${idx + 1}`);
        if (--pending === 0) finish();
      };
      reader.onerror = () => {
        unmatched.push(file.name);
        if (--pending === 0) finish();
      };
      reader.readAsDataURL(file);

      // Sincroniza com Supabase Storage bucket 'desenhos'
      if (currentQuote?.quoteNumber) {
        uploadDesenhoStorage(currentQuote.quoteNumber, file).catch(e => {
          console.warn('Upload bucket desenhos aviso:', e);
        });
      }
    });

    function finish() {
      setPasteSuccess(matched.length > 0);
      setMatchInfo(
        `${matched.length} imagem(ns) vinculada(s)` +
        (unmatched.length ? ` • sem correspondência: ${unmatched.join(', ')}` : '')
      );
      setTimeout(() => { setPasteSuccess(false); setMatchInfo(''); }, 6000);
    }

    // permite reenviar os mesmos arquivos
    e.target.value = '';
  };

  // Alterna entre os modelos e ativa a caixa de impressão do navegador com setTimeout
  const gerarEImprimir = (tipoProposta: PrintModelType | 'pedido' | 'etiqueta' | 'proposta') => {
    // Remove classes anteriores
    document.body.classList.remove('print-pedido', 'print-etiqueta', 'print-proposta', 'print-corte');

    if (tipoProposta === 'corte') {
      setPrintMode('corte');
      setActiveModel('corte');
      document.body.classList.add('print-corte');
    } else if (tipoProposta === 'pedido' || tipoProposta === 'A4-2vias') {
      setPrintMode('pedido');
      setActiveModel('A4-2vias');
      document.body.classList.add('print-pedido');
    } else if (tipoProposta === 'etiqueta' || tipoProposta === 'etiqueta-80') {
      setPrintMode('etiqueta');
      setActiveModel('etiqueta-80');
      document.body.classList.add('print-etiqueta');
    } else {
      setPrintMode('proposta');
      setActiveModel('A4-inteiro');
      document.body.classList.add('print-proposta');
    }

    // Pequeno setTimeout antes do window.print() para dar tempo do React atualizar a tela antes de abrir a janela da impressora
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const totalItems = currentQuote.items.length;
  const totalWeight = currentQuote.totalWeightKg || currentQuote.items.reduce((acc, item) => acc + (item.totalWeightKg || item.pesoTotal || 0), 0);
  const subtotalValue = currentQuote.subtotalTotal || currentQuote.items.reduce((acc, item) => acc + (item.subtotal || (item.unitPrice * item.quantity)), 0);
  const discountVal = currentQuote.discount || 0;
  const shippingVal = currentQuote.shipping || 0;
  const grandTotal = currentQuote.grandTotal || (subtotalValue - discountVal + shippingVal);

  const activeItem: Partial<QuoteItem> = currentQuote.items[selectedItemIndex] || currentQuote.items[0] || {
    material: 'BRONZE TM-23 REDONDO',
    constanteNome: 'BRONZE TM-23 REDONDO',
    measure: 'Ø 50 × 200 mm',
    widthLength: '200 mm',
    quantity: 1,
    qtd: 1,
    unitPrice: 185.00,
    totalWeightKg: 3.450,
    observacao: 'CONFORME DESENHO TÉCNICO',
    description: 'BUCHA USINADA'
  };

  // ✅ imagem de UM item específico: override manual -> imagem do próprio item -> exemplo
  const getDrawing = (idx: number): string => {
    const override = drawingPhotos[idx];
    if (override !== undefined) return override;
    const it = currentQuote.items[idx] as (QuoteItem & { drawingImage?: string; fotoDesenho?: string }) | undefined;
    return it?.drawingImage || it?.fotoDesenho || SAMPLE_DRAWING_BASE64;
  };

  const currentDrawing = getDrawing(selectedItemIndex);

  const handleExportJSON = () => {
    const dataToExport = {
      ...currentQuote,
      clientName: selectedClientName,
      drawingPhoto: currentDrawing || null,
      exportedAt: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `proposta_${currentQuote.quoteNumber || 'cotacao'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportCSV = () => {
    const headers = ["Material", "Medidas", "Descricao", "Informacoes", "Valor_Unitario", "Qtd", "Peso_Total_Kg", "Subtotal"];
    const rows = currentQuote.items.map(item => [
      `"${(item.constanteNome || item.constantName || item.material || 'MATERIAL').replace(/"/g, '""')}"`,
      `"${formatarMedidasLimpa(item).replace(/"/g, '""')}"`,
      `"${(item.descricao || item.description || '-').replace(/"/g, '""')}"`,
      `"${(item.observacao || item.notes || item.info || '-').replace(/"/g, '""')}"`,
      (item.valorUnitario !== undefined ? item.valorUnitario : item.unitPrice).toFixed(2),
      item.qtd || item.quantity || 1,
      (item.pesoTotal !== undefined ? item.pesoTotal : (item.totalWeightKg || 0)).toFixed(3),
      (item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1))).toFixed(2)
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_itens_${currentQuote.quoteNumber || 'cotacao'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div id="screen-relatorios" className="space-y-6">

      {/* Tamanho de página: A4 RETRATO para todos os modelos, exceto ETIQUETAS */}
      <style>{activeModel === 'etiqueta-80'
        ? `@page { size: 80mm auto; margin: 3mm; }`
        : `@page { size: A4 portrait; margin: 10mm; }
           @media print {
             html, body { width: 210mm; }
             .documento-modelo { width: 100% !important; max-width: 190mm !important; margin: 0 auto !important; box-shadow: none !important; }
           }`}</style>

      {/* Regras de impressão do modelo de CORTE */}
      <style>{`
        @media print {
          body.print-corte .btn-no-print,
          body.print-corte .filtros-bar,
          body.print-corte .tabela-container,
          body.print-corte .screen-header,
          body.print-corte .documento-modelo:not(.secao-corte) { display: none !important; }
          body.print-corte #doc-corte { display: block !important; box-shadow: none !important; padding: 0 !important; }
          body.print-corte #doc-corte table { page-break-inside: auto; }
          body.print-corte #doc-corte tr { page-break-inside: avoid; }
        }
      `}</style>
      
      {/* TAB NAVIGATION: PROPOSTAS vs CONSULTA */}
      <div className="btn-no-print flex items-center justify-between border-b border-slate-800 pb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('propostas')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'propostas'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-blue-300" />
            <span>📄 Emissão de Propostas & Etiquetas</span>
          </button>

          <button
            onClick={() => setActiveTab('consulta')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'consulta'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
            }`}
          >
            <Search className="w-4 h-4 text-emerald-400" />
            <span>🔍 Consulta & Relatório Geral</span>
          </button>
        </div>

        {onNavigateToQuote && (
          <button
            onClick={onNavigateToQuote}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Voltar para Calculadora de Cotações</span>
          </button>
        )}
      </div>

      {/* ===================================================
           MÓDULO DE CONSULTA E IMPRESSÃO DE RELATÓRIOS
           =================================================== */}
      {activeTab === 'consulta' && (
        <div id="screen-consulta" className="space-y-4">
          
          {/* BARRA SUPERIOR COM BOTÕES E CAMPOS DE BUSCA */}
          <div className="filtros-bar btn-no-print">
            
            {/* Botões de Impressão */}
            <div className="botoes-impressao">
              <button className="btn-print" onClick={() => imprimirRelatorioGeral('GERAL')}>
                <span>🖨️</span> GERAL
              </button>
              <button className="btn-print" onClick={() => imprimirRelatorioGeral('EMPRESA')}>
                <span>🏢</span> EMPRESA
              </button>
              <button className="btn-print" onClick={() => imprimirRelatorioGeral('PEDIDO')}>
                <span>📋</span> PEDIDO
              </button>
              <button className="btn-print" onClick={() => imprimirRelatorioGeral('ETIQUETAS')}>
                <span>🏷️</span> ETIQUETAS
              </button>
              <button className="btn-print" onClick={() => imprimirRelatorioGeral('CORTE')}>
                <span>✂️</span> CORTE
              </button>
            </div>

            {/* Filtros por Categoria e Campo de Texto */}
            <div className="opcoes-pesquisa">
              <label>
                <input 
                  type="radio" 
                  name="tipoFiltro" 
                  value="cliente" 
                  checked={tipoFiltro === 'cliente'} 
                  onChange={() => setTipoFiltro('cliente')} 
                /> CLIENTE
              </label>
              <label>
                <input 
                  type="radio" 
                  name="tipoFiltro" 
                  value="cotacao" 
                  checked={tipoFiltro === 'cotacao'} 
                  onChange={() => setTipoFiltro('cotacao')} 
                /> COTAÇÃO
              </label>
              <label>
                <input 
                  type="radio" 
                  name="tipoFiltro" 
                  value="contato" 
                  checked={tipoFiltro === 'contato'} 
                  onChange={() => setTipoFiltro('contato')} 
                /> CONTATO
              </label>
              <label>
                <input 
                  type="radio" 
                  name="tipoFiltro" 
                  value="produto" 
                  checked={tipoFiltro === 'produto'} 
                  onChange={() => setTipoFiltro('produto')} 
                /> PRODUTO / DESCRIÇÃO
              </label>
              <label>
                <input 
                  type="radio" 
                  name="tipoFiltro" 
                  value="data" 
                  checked={tipoFiltro === 'data'} 
                  onChange={() => setTipoFiltro('data')} 
                /> DATA
              </label>

              <select
                id="selectStatus"
                className="input-busca-avancada"
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as 'todos' | StatusProposta)}
                title="Filtrar por situação da proposta"
              >
                <option value="todos">SITUAÇÃO: TODAS</option>
                <option value="rascunho">RASCUNHO</option>
                <option value="pendente">PENDENTE</option>
                <option value="aprovado">APROVADO</option>
                <option value="rejeitado">REJEITADO</option>
              </select>

              <input 
                type="text" 
                id="inputCliente" 
                className="input-busca-avancada" 
                placeholder="Nome do Cliente..." 
                value={clienteBusca} 
                onChange={(e) => setClienteBusca(e.target.value)} 
              />

              <input 
                type="text" 
                id="inputBusca" 
                className="input-busca-avancada" 
                placeholder="Digite para pesquisar..." 
                value={inputBusca} 
                onChange={(e) => setInputBusca(e.target.value)} 
              />
            </div>

          </div>

          {/* TABELA COM DADOS TÉCNICOS */}
          <div className="tabela-container shadow-2xl">
            <table className="tabela-consulta" id="tabelaDados">
              <thead>
                <tr>
                  <th style={{ width: '30px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      id="checkTodos" 
                      checked={filteredConsultaItems.length > 0 && selectedIds.length === filteredConsultaItems.length}
                      onChange={(e) => handleSelectAll(e.target.checked)} 
                    />
                  </th>
                  <th>Cotação</th>
                  <th>Situação</th>
                  <th>Data</th>
                  <th>Cliente / Empresa</th>
                  <th>Contato</th>
                  <th>Produto</th>
                  <th>Medida</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Qtd</th>
                  <th>Unitário</th>
                  <th>Valor Geral</th>
                </tr>
              </thead>
              <tbody id="tbodyConsulta">
                {filteredConsultaItems.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-6 text-slate-500 font-medium">
                      Nenhum registro encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredConsultaItems.map((item) => {
                    const isSelected = selectedIds.includes(item.idVer);
                    return (
                      <tr 
                        key={item.idVer} 
                        className={isSelected ? 'linha-selecionada' : ''}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.tagName !== 'INPUT') {
                            handleToggleSelect(item.idVer);
                          }
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            className="chk-item" 
                            value={item.idVer} 
                            checked={isSelected}
                            onChange={() => handleToggleSelect(item.idVer)} 
                          />
                        </td>
                        <td><strong>{item.cotacao || '-'}</strong></td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLES[item.status]}`}>
                            {item.status}
                          </span>
                        </td>
                        <td>{item.data}</td>
                        <td><strong>{item.empresa}</strong></td>
                        <td>{item.contato || '-'}</td>
                        <td>{item.produto}</td>
                        <td>{item.medida}</td>
                        <td>{item.descricao}</td>
                        <td>{item.valor}</td>
                        <td>{item.qtd}</td>
                        <td>R$ {item.unitario.toFixed(2)}</td>
                        <td><strong>R$ {item.valorGeral.toFixed(2)}</strong></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="btn-no-print text-xs text-slate-400 flex items-center justify-between pt-2">
            <span>Mostrando {filteredConsultaItems.length} de {allConsultaItems.length} itens</span>
            <span>{selectedIds.length} item(ns) selecionado(s) para impressão</span>
          </div>

          {/* ===================================================
               MODELO DE CORTE (Observação, Produto/Material, Medidas,
               Descrição, Qtd e quadradinho para marcar como CORTADO)
               =================================================== */}
          <div
            id="doc-corte"
            className={`documento-modelo secao-corte bg-white text-slate-900 p-6 rounded-xl shadow-2xl font-sans w-full max-w-4xl mx-auto ${
              activeModel === 'corte' ? 'block' : 'hidden'
            }`}
          >
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
              <div>
                <h2 className="m-0 text-lg font-black uppercase tracking-wide">Ordem de Corte</h2>
                <p className="m-0 text-[11px] font-semibold text-slate-600 uppercase">
                  Cliente: {clienteBusca || selectedClientName || currentQuote.clientName || 'TODOS'}
                </p>
              </div>
              <div className="text-right text-[11px] font-semibold text-slate-600">
                <p className="m-0">Data: {new Date().toLocaleDateString('pt-BR')}</p>
                <p className="m-0">Itens: {itensCorte.length}</p>
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
                {itensCorte.map((item) => (
                  <tr key={item.idVer}>
                    <td className="border border-black p-1.5 font-bold uppercase">{item.observacao || item.cotacao || '-'}</td>
                    <td className="border border-black p-1.5 uppercase">{item.produto}</td>
                    <td className="border border-black p-1.5">{item.medida}</td>
                    <td className="border border-black p-1.5 uppercase">{item.descricao}</td>
                    <td className="border border-black p-1.5 text-center font-bold">{item.qtd}</td>
                    <td className="border border-black p-1.5 text-center">
                      <span className="inline-block w-4 h-4 border-2 border-black align-middle" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-center">
              www.usicortemetais.com.br
            </p>
          </div>

        </div>
      )}

      {/* ===================================================
           ABA 1: EMISSÃO DE PROPOSTAS & ETIQUETAS (PADRÃO)
           =================================================== */}
      {activeTab === 'propostas' && (
        <>
          {/* PAINEL DE CONTROLE E FILTROS (NÃO SAI NA IMPRESSÃO) */}
          <div className="screen-header btn-no-print flex flex-col gap-5 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-xl">
        
        {/* Top Header with title and 3 direct Print Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              Relatório e Emissão de Propostas
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Gere propostas oficiais completas em A4, pedidos de produção em 2 vias com linha de corte, ou etiquetas técnicas 80x80mm.
            </p>
          </div>

          {/* BOTÕES DAS PROPOSTAS DE IMPRESSÃO (AÇÕES INDEPENDENTES) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => gerarEImprimir('pedido')}
              title="Imprime apenas a Via do Cliente e Via da Empresa/Produção em A4 (oculta a etiqueta da peça)"
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                activeModel === 'A4-2vias'
                  ? 'bg-amber-600 text-white shadow-amber-600/30 ring-2 ring-amber-300'
                  : 'bg-slate-800 hover:bg-amber-900/40 text-amber-200 border border-amber-500/40'
              }`}
            >
              <Scissors className="w-4 h-4 text-amber-300" />
              <span>📋 Imprimir Pedido (A4)</span>
            </button>

            <button
              onClick={() => gerarEImprimir('etiqueta')}
              title="Imprime apenas a Etiqueta de Identificação da Peça (oculta as vias do pedido em A4)"
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-95 ${
                activeModel === 'etiqueta-80'
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-2 ring-emerald-300'
                  : 'bg-slate-800 hover:bg-emerald-900/40 text-emerald-200 border border-emerald-500/40'
              }`}
            >
              <Tag className="w-4 h-4 text-emerald-300" />
              <span>🏷️ Imprimir Etiqueta da Peça</span>
            </button>

            <button
              onClick={() => gerarEImprimir('proposta')}
              title="Imprime a Proposta Comercial completa em A4"
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-95 ${
                activeModel === 'A4-inteiro'
                  ? 'bg-blue-600 text-white shadow-blue-600/30 ring-2 ring-blue-300'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <FileText className="w-4 h-4 text-blue-300" />
              <span>📄 Imprimir Proposta (A4 Inteiro)</span>
            </button>
          </div>
        </div>

        {/* SELEÇÃO DE EMPRESA E ARQUIVO */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800 items-end">
          
          {/* SELEÇÃO DE CLIENTE COM NOME FANTASIA (Ponto 3) */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-blue-400" />
              Selecione o Cliente (Nome Fantasia):
            </label>
            <select 
              id="select-relatorio-cliente"
              value={selectedClientName}
              onChange={(e) => setSelectedClientName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 text-slate-100 border border-slate-700 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-medium"
            >
              <option value="">-- SELECIONE O CLIENTE --</option>
              <option value="CLIENTE BALCÃO">CLIENTE BALCÃO</option>
              <option value="IGREJA PRIMOGÊNITOS" data-razao="IGREJA EVANGELICA IRMAOS PRIMOGENITOS">IGREJA PRIMOGÊNITOS (Fantasia)</option>
              <option value="USICORTE METAIS" data-razao="USICORTE USINAGEM E MANUTENCAO EIRELI">USICORTE METAIS (Fantasia)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.fantasyName || c.name} data-razao={c.name}>
                  {c.fantasyName ? `${c.fantasyName} (Fantasia)` : `${c.name} (${c.type})`}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Puxar Arquivo / Pedido Salvo */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              Selecione o Pedido Salvo:
            </label>
            <select 
              id="select-relatorio-arquivo"
              value={selectedOrderKey}
              onChange={(e) => handleOrderChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 text-slate-100 border border-slate-700 rounded-lg text-xs focus:outline-hidden focus:border-blue-500 font-mono"
            >
              <option value="CURRENT">{currentQuote.quoteNumber || 'COT-2026-0001'} (Cotação Atual)</option>
              <option value="PED-00124">Pedido #00124 - 11/08/2026</option>
              <option value="PED-00125">Pedido #00125 - 11/08/2026 (Sem Foto)</option>
            </select>
          </div>

        </div>

        {/* ÁREA PARA COLAR O PRINT SCREEN COM CTRL + V (Ponto 1) */}
        <div className="pt-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
              📸 Desenho Técnico (Copie o print com Win+Shift+S ou PrintScreen e cole abaixo):
            </label>
            {currentDrawing && (
              <button
                type="button"
                onClick={() => {
                  setDrawingPhotos(prev => ({ ...prev, [selectedItemIndex]: '' }));
                  setPasteSuccess(false);
                }}
                className="text-[11px] text-red-400 hover:text-red-300 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                title="Remover Desenho"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remover Foto (Exibir SEM DESENHO)</span>
              </button>
            )}
          </div>

          <div
            id="paste-area"
            ref={pasteAreaRef}
            tabIndex={0}
            onPaste={handlePasteEvent}
            onClick={() => pasteAreaRef.current?.focus()}
            className={`p-3.5 border-2 border-dashed rounded-xl text-center cursor-pointer outline-hidden transition-all flex flex-col sm:flex-row items-center justify-between gap-3 ${
              pasteSuccess
                ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300'
                : 'border-blue-500/70 hover:border-blue-400 bg-blue-950/10 focus:bg-blue-950/20 text-slate-200'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs text-left">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <span id="paste-msg" className="block font-medium">
                  {pasteSuccess ? (
                    <strong className="text-emerald-400 font-bold">✅ Foto do print colada com sucesso!</strong>
                  ) : (
                    <>Clique aqui e pressione <strong className="text-blue-400 font-bold bg-blue-950 px-1.5 py-0.5 rounded border border-blue-800/60">Ctrl + V</strong> para colar a foto do print</>
                  )}
                </span>
                <span className="text-[11px] text-slate-400">
                  Ou clique em "Carregar Arquivos" e selecione VÁRIAS imagens de uma vez — cada arquivo vai
                  para a etiqueta cujo campo <strong>Observação</strong> tenha o mesmo nome do arquivo.
                </span>
                {matchInfo && (
                  <span className="block text-[11px] text-amber-300 mt-1">{matchInfo}</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {currentDrawing && (
                <div className="w-10 h-10 rounded border border-slate-700 bg-slate-900 overflow-hidden flex items-center justify-center shrink-0">
                  <img 
                    src={currentDrawing} 
                    alt="Miniatura" 
                    className="desenho-tecnico-img w-full h-full object-contain"
                  />
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                multiple 
                className="hidden" 
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>{currentDrawing ? 'Alterar / Adicionar Arquivos' : 'Carregar Arquivos'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Action toolbar with visual model switchers and export buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">Visualizar na tela:</span>
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 flex-wrap gap-1">
              <button
                onClick={() => setActiveModel('A4-inteiro')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeModel === 'A4-inteiro' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Geral (A4 Inteiro)
              </button>
              <button
                onClick={() => setActiveModel('proposta-resumida')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  activeModel === 'proposta-resumida' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Empresa</span>
              </button>
              <button
                onClick={() => setActiveModel('A4-2vias')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeModel === 'A4-2vias' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                A4 2 Vias
              </button>
              <button
                onClick={() => setActiveModel('etiqueta-80')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeModel === 'etiqueta-80' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Etiqueta 80x80
              </button>
              <button
                onClick={() => setActiveModel('corte')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  activeModel === 'corte' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Corte
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>

            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>JSON</span>
            </button>
          </div>
        </div>

      </div>

      {/* ===================================================
           CONTAINER DE IMPRESSÃO (O QUE SAI NA IMPRESSORA E NA PRÉVIA)
           =================================================== */}
      <div id="container-impressao" className="bg-slate-900/60 p-2 sm:p-6 rounded-2xl border border-slate-800 w-full overflow-x-hidden">
        
        {/* ===================================================
             PROPOSTA 1: RELATÓRIO A4 INTEIRO
             =================================================== */}
        <div 
          id="doc-A4-inteiro" 
          className={`documento-modelo secao-proposta bg-white text-slate-900 p-4 sm:p-8 rounded-xl shadow-2xl font-sans w-full max-w-4xl mx-auto overflow-x-hidden ${
            activeModel === 'A4-inteiro' ? 'block' : 'hidden'
          }`}
          style={{ minHeight: '800px' }}
        >
          {/* Header */}
          <div className="border-b-2 border-black pb-3 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="logo-impressao mb-2" style={{ width: '180px' }}>
                <Logo variant="light" className="w-[180px] h-auto" />
              </div>
              <p className="m-0 text-xs font-semibold text-slate-600 tracking-wide uppercase">Relatório / Proposta Comercial</p>
            </div>
            <div className="text-left sm:text-right text-xs space-y-0.5 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
              <div><strong>PROPOSTA Nº:</strong> <span className="rel-numero font-mono font-bold text-blue-800">{currentQuote.quoteNumber || '00124'}</span></div>
              <div><strong>DATA:</strong> <span className="rel-data font-mono">{currentQuote.date || new Date().toLocaleDateString('pt-BR')}</span></div>
            </div>
          </div>

          {/* Client box */}
          <div className="bg-slate-100 border border-slate-300 p-3 rounded-md mb-4 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <span className="font-bold text-slate-700">EMPRESA / CLIENTE:</span>{' '}
              <strong className="lbl-cliente-nome text-slate-900 text-sm font-black uppercase break-words">{selectedClientName}</strong>
            </div>
            <div className="text-slate-600 font-mono">
              Condições: <strong>{currentQuote.paymentTerms || 'À Vista / Pix'}</strong>
            </div>
          </div>

          {/* 📱 MOBILE: Cards de Produtos (< 640px) */}
          <div className="block sm:hidden space-y-3 mb-6 flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Itens da Proposta ({currentQuote.items.length})
            </span>
            {currentQuote.items.length === 0 ? (
              <div className="py-6 text-center text-slate-500 italic text-xs bg-slate-50 rounded-lg border border-slate-200">
                Nenhum item na cotação para exibição.
              </div>
            ) : (
              currentQuote.items.map((item, idx) => {
                const produtoMaterial = item.constanteNome || item.constantName || item.material || 'MATERIAL';
                const medidasFormatadas = formatarMedidasLimpa(item);
                const descricaoItem = item.descricao || item.description || '-';
                const informacoesObs = item.observacao || item.notes || item.info || '-';
                const valorUnitario = Number(item.valorUnitario !== undefined ? item.valorUnitario : (item.unitPrice || 0));
                const qtd = Number(item.qtd !== undefined ? item.qtd : (item.quantity || 1));
                const pesoTotal = Number(item.pesoTotal !== undefined ? item.pesoTotal : (item.totalWeightKg || 0));
                const subtotal = Number(item.subtotal !== undefined ? item.subtotal : (valorUnitario * qtd));

                return (
                  <div key={item.id || idx} className="border border-slate-300 rounded-lg p-3 bg-white space-y-2 text-xs shadow-xs">
                    <div className="flex justify-between items-center border-b border-slate-200 pb-1.5">
                      <span className="text-[10px] text-slate-500 uppercase font-bold">Produto / Material</span>
                      <strong className="font-bold text-slate-900 text-sm">{produtoMaterial}</strong>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Medidas</span>
                      <span className="font-mono text-slate-800 font-semibold">{medidasFormatadas}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Descrição</span>
                      <span className="text-slate-700">{descricaoItem}</span>
                    </div>

                    {informacoesObs !== '-' && (
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-bold block">Informações</span>
                        <span className="italic text-slate-600">{informacoesObs}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-slate-500">Qtd: <strong>{qtd}</strong></span>
                        <span className="mx-1.5 text-slate-300">|</span>
                        <span className="text-slate-500">Peso: <strong>{formatWeightKg(pesoTotal, 3)}</strong></span>
                      </div>
                      <div className="font-bold text-slate-950 font-mono text-sm">
                        {formatCurrency(subtotal)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 🖥️ DESKTOP: 8-Column Table (>= 640px) */}
          <table className="hidden sm:table w-full border-collapse text-xs mb-6" border={1} cellPadding={6}>
            <thead>
              <tr className="bg-slate-200 text-slate-900 font-bold uppercase text-[11px] border-b border-black">
                <th className="text-left p-2">PRODUTO / MATERIAL</th>
                <th className="text-center p-2">MEDIDAS</th>
                <th className="text-left p-2">DESCRIÇÃO</th>
                <th className="text-left p-2">INFORMAÇÕES</th>
                <th className="text-right p-2">UNITÁRIO</th>
                <th className="text-center p-2 w-12">QTD</th>
                <th className="text-right p-2">PESO TOTAL</th>
                <th className="text-right p-2">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody id="tbody-a4-inteiro" className="divide-y divide-slate-300">
              {currentQuote.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                    Nenhum item na cotação para exibição.
                  </td>
                </tr>
              ) : (
                currentQuote.items.map((item, idx) => {
                  const produtoMaterial = item.constanteNome || item.constantName || item.material || 'MATERIAL';
                  const medidasFormatadas = formatarMedidasLimpa(item);
                  const descricaoItem = item.descricao || item.description || '-';
                  const informacoesObs = item.observacao || item.notes || item.info || '-';
                  const valorUnitario = Number(item.valorUnitario !== undefined ? item.valorUnitario : (item.unitPrice || 0));
                  const qtd = Number(item.qtd !== undefined ? item.qtd : (item.quantity || 1));
                  const pesoTotal = Number(item.pesoTotal !== undefined ? item.pesoTotal : (item.totalWeightKg || 0));
                  const subtotal = Number(item.subtotal !== undefined ? item.subtotal : (valorUnitario * qtd));

                  return (
                    <tr key={item.id || idx} className="hover:bg-slate-50">
                      <td className="text-left font-bold text-slate-900 p-2">{produtoMaterial}</td>
                      <td className="text-center font-mono text-[11px] p-2">{medidasFormatadas}</td>
                      <td className="text-left p-2 text-slate-800">{descricaoItem}</td>
                      <td className="text-left p-2 text-slate-600 italic text-[10px]">{informacoesObs}</td>
                      <td className="text-right font-mono p-2">{formatCurrency(valorUnitario)}</td>
                      <td className="text-center font-bold font-mono p-2">{qtd}</td>
                      <td className="text-right font-mono font-bold p-2 text-slate-900">{formatWeightKg(pesoTotal, 3)}</td>
                      <td className="text-right font-mono font-bold p-2 text-slate-950">{formatCurrency(subtotal)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Totals & Notes footer */}
          <div className="border-t-2 border-black pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-end text-xs gap-4">
            <div className="space-y-1 text-slate-600 max-w-md w-full sm:w-auto">
              <p>• Validade da proposta: <strong>{currentQuote.validityDays || 10} dias</strong></p>
              <p>• Prazo de entrega: <strong>A combinar após aprovação</strong></p>
              {currentQuote.observations && <p>• Obs: {currentQuote.observations}</p>}
            </div>

            <div className="text-left sm:text-right space-y-1 w-full sm:w-auto min-w-[220px] bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200">
              <div className="flex justify-between text-slate-700">
                <span>Peso Total Estimado:</span>
                <strong className="font-mono">{formatWeightKg(totalWeight, 3)}</strong>
              </div>
              {discountVal > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Desconto:</span>
                  <strong className="font-mono">- {formatCurrency(discountVal)}</strong>
                </div>
              )}
              {shippingVal > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Frete:</span>
                  <strong className="font-mono">+ {formatCurrency(shippingVal)}</strong>
                </div>
              )}
              <div className="flex justify-between text-base font-black border-t border-black pt-2 text-slate-950">
                <span>VALOR TOTAL:</span>
                <span className="font-mono text-blue-900">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===================================================
             PROPOSTA 2: PEDIDO A4 DIVIDIDO AO MEIO (2 VIAS)
             =================================================== */}
        <div 
          id="doc-A4-2vias" 
          className={`documento-modelo secao-pedido modelo-duas-vias bg-white text-slate-900 p-4 sm:p-6 rounded-xl shadow-2xl w-full max-w-4xl mx-auto font-sans overflow-x-hidden ${
            activeModel === 'A4-2vias' ? 'block' : 'hidden'
          }`}
          style={{ minHeight: '850px' }}
        >
          
          {/* VIA 1: CLIENTE */}
          <div className="via-pedido border border-black p-3 sm:p-4 rounded bg-white flex flex-col justify-between" style={{ minHeight: '380px' }}>
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-black pb-2 mb-3 gap-2">
                <div className="flex items-center gap-3">
                  <div className="logo-impressao" style={{ width: '130px' }}>
                    <Logo variant="light" className="w-[130px] h-auto" />
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold">VIA DO CLIENTE</span>
                </div>
                <span className="text-xs">
                  <strong>PEDIDO Nº:</strong> <span className="rel-numero font-mono font-bold">{currentQuote.quoteNumber || '00124'}</span>
                </span>
              </div>

              <div className="text-xs mb-3 text-slate-700 flex flex-col sm:flex-row justify-between gap-1">
                <div><strong>Cliente:</strong> <span className="lbl-cliente-nome font-bold uppercase">{selectedClientName}</span></div>
                <div><strong>Data:</strong> <span className="rel-data font-mono">{currentQuote.date || new Date().toLocaleDateString('pt-BR')}</span></div>
              </div>

              {/* Mobile Cards Via 1 */}
              <div className="block sm:hidden space-y-2 mb-3">
                {currentQuote.items.map((item, idx) => (
                  <div key={idx} className="border border-slate-200 rounded p-2 text-xs bg-slate-50 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>{item.constanteNome || item.material || 'MATERIAL'}</span>
                      <span className="font-mono">{formatCurrency(item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1)))}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 flex justify-between">
                      <span>Medida: {formatarMedidasLimpa(item)}</span>
                      <span>Qtd: {item.qtd || item.quantity || 1}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table Via 1 */}
              <table className="hidden sm:table w-full text-xs border-collapse mb-3" border={1} cellPadding={4}>
                <thead>
                  <tr className="bg-slate-100 font-bold text-[10px] uppercase">
                    <th className="text-left p-1.5">MATERIAL</th>
                    <th className="text-center p-1.5">MEDIDAS</th>
                    <th className="text-center p-1.5 w-12">QTD</th>
                    <th className="text-right p-1.5">PESO TOTAL</th>
                    <th className="text-right p-1.5">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="tbody-resumido divide-y divide-slate-200">
                  {currentQuote.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-1.5 font-bold text-slate-900">{item.constanteNome || item.material || 'MATERIAL'}</td>
                      <td className="p-1.5 text-center font-mono text-[10px]">{formatarMedidasLimpa(item)}</td>
                      <td className="p-1.5 text-center font-mono font-bold">{item.qtd || item.quantity || 1}</td>
                      <td className="p-1.5 text-right font-mono">{formatWeightKg(item.pesoTotal || item.totalWeightKg || 0, 3)}</td>
                      <td className="p-1.5 text-right font-mono font-bold">{formatCurrency(item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs border-t border-black pt-2 mt-2 gap-2">
              <span className="text-slate-600">Assinatura Cliente: ___________________________________</span>
              <strong className="text-sm font-mono text-slate-950">TOTAL: <span className="lbl-valor-total">{formatCurrency(grandTotal)}</span></strong>
            </div>
          </div>

          {/* LINHA DE CORTE */}
          <div className="linha-corte my-6 border-t-2 border-dashed border-black text-center relative">
            <span className="bg-white px-3 text-[11px] font-bold text-slate-900 relative -top-3">
              ✂️ CORTE AQUI
            </span>
          </div>

          {/* VIA 2: EMPRESA / PRODUÇÃO */}
          <div className="via-pedido border border-black p-3 sm:p-4 rounded bg-white flex flex-col justify-between" style={{ minHeight: '380px' }}>
            <div>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-black pb-2 mb-3 gap-2">
                <div>
                  <strong className="text-sm tracking-tight text-slate-900 font-black">USICORTE METAIS</strong>
                  <span className="text-xs ml-2 px-2 py-0.5 bg-amber-100 text-amber-900 rounded font-bold">VIA DA EMPRESA / PRODUÇÃO</span>
                </div>
                <span className="text-xs">
                  <strong>PEDIDO Nº:</strong> <span className="rel-numero font-mono font-bold">{currentQuote.quoteNumber || '00124'}</span>
                </span>
              </div>

              <div className="text-xs mb-3 text-slate-700 flex flex-col sm:flex-row justify-between gap-1">
                <div><strong>Cliente:</strong> <span className="lbl-cliente-nome font-bold uppercase">{selectedClientName}</span></div>
                <div><strong>Data:</strong> <span className="rel-data font-mono">{currentQuote.date || new Date().toLocaleDateString('pt-BR')}</span></div>
              </div>

              {/* Mobile Cards Via 2 */}
              <div className="block sm:hidden space-y-2 mb-3">
                {currentQuote.items.map((item, idx) => (
                  <div key={idx} className="border border-slate-200 rounded p-2 text-xs bg-slate-50 space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>{item.constanteNome || item.material || 'MATERIAL'}</span>
                      <span className="font-mono">{formatCurrency(item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1)))}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 flex justify-between">
                      <span>Medida: {formatarMedidasLimpa(item)}</span>
                      <span>Qtd: {item.qtd || item.quantity || 1}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table Via 2 */}
              <table className="hidden sm:table w-full text-xs border-collapse mb-3" border={1} cellPadding={4}>
                <thead>
                  <tr className="bg-slate-100 font-bold text-[10px] uppercase">
                    <th className="text-left p-1.5">MATERIAL</th>
                    <th className="text-center p-1.5">MEDIDAS</th>
                    <th className="text-center p-1.5 w-12">QTD</th>
                    <th className="text-right p-1.5">PESO TOTAL</th>
                    <th className="text-right p-1.5">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="tbody-resumido divide-y divide-slate-200">
                  {currentQuote.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="p-1.5 font-bold text-slate-900">{item.constanteNome || item.material || 'MATERIAL'}</td>
                      <td className="p-1.5 text-center font-mono text-[10px]">{formatarMedidasLimpa(item)}</td>
                      <td className="p-1.5 text-center font-mono font-bold">{item.qtd || item.quantity || 1}</td>
                      <td className="p-1.5 text-right font-mono">{formatWeightKg(item.pesoTotal || item.totalWeightKg || 0, 3)}</td>
                      <td className="p-1.5 text-right font-mono font-bold">{formatCurrency(item.subtotal || ((item.unitPrice || 0) * (item.quantity || 1)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs border-t border-black pt-2 mt-2 gap-2">
              <span className="text-slate-600">Vendedor / Produção: ___________________________________</span>
              <strong className="text-sm font-mono text-slate-950">TOTAL: <span className="lbl-valor-total">{formatCurrency(grandTotal)}</span></strong>
            </div>
          </div>

        </div>

        {/* ===================================================
             PROPOSTA 3: ETIQUETA CUPOM 80x80mm (IDENTIFICAÇÃO DA PEÇA)
             =================================================== */}
        {/* ✅ Uma etiqueta POR ITEM: texto e imagem sempre do mesmo item */}
        {currentQuote.items.map((rawItem, itemIdx) => {
          const item: Partial<QuoteItem> = rawItem || {};
          const img = getDrawing(itemIdx);
          return (
        <div 
          key={itemIdx}
          id={`doc-etiqueta-80-${itemIdx}`}
          className={`documento-modelo secao-etiqueta modelo-etiqueta-80 w-full max-w-[380px] border-2 border-black rounded-lg p-4 bg-white text-black font-sans relative mx-auto shadow-2xl print:m-0 print:break-after-page ${
            activeModel === 'etiqueta-80'
              ? (selectedItemIndex === itemIdx ? 'block' : 'hidden print:block')
              : 'hidden'
          }`}
        >
          {/* Cabeçalho Original */}
          <div className="etiqueta-header text-center pb-2 border-b-2 border-black mb-3">
            <h2 className="font-extrabold text-xl tracking-wider uppercase leading-tight">USICORTE METAIS</h2>
            <p className="text-xs font-bold text-gray-800 mt-0.5">
              PEDIDO Nº: <span className="font-mono font-black text-blue-900 rel-numero">{currentQuote.quoteNumber || currentQuote.id || 'COT-2026-9663'}</span>
            </p>
          </div>

          {/* Conteúdo: Dados + Desenho */}
          <div className="etiqueta-corpo grid grid-cols-12 gap-2 items-start mb-3">
            {/* Coluna Esquerda - Informações */}
            <div className="etiqueta-dados col-span-7 text-xs space-y-1.5 leading-tight">
              <div>
                <span className="font-bold text-gray-600 block text-[10px]">EMPRESA / CLIENTE:</span>
                <span className="lbl-cliente-nome font-extrabold uppercase block">{selectedClientName || currentQuote.clientName || 'CLIENTE BALCÃO'}</span>
              </div>

              <div>
                <span className="font-bold text-gray-600 block text-[10px]">MATERIAL:</span>
                <span id="etiq-material" className="font-extrabold uppercase text-sm text-blue-950 block truncate">
                  {item.constanteNome || item.material || 'BRONZE TM-23'}
                </span>
              </div>

              <div>
                <span className="font-bold text-gray-600 block text-[10px]">MEDIDA:</span>
                <span id="etiq-medida" className="font-bold block text-[11.5px] font-mono">
                  {formatarMedidasLimpa(item) || 'Ø 50 x 200 mm'}
                </span>
              </div>

              <div>
                <span className="font-bold text-gray-600 block text-[10px]">QTD:</span>
                <span id="etiq-qtd" className="font-black text-sm">
                  {item.qtd || item.quantity || 1} PC
                </span>
              </div>

              {/* Campo de Observação */}
              {(item.observacao || item.notes || item.info || item.descricao || currentQuote.observations) && (
                <div className="pt-1">
                  <span className="font-bold text-gray-600 block text-[10px]">OBSERVAÇÃO:</span>
                  <span id="etiq-obs" className="font-semibold text-[11px] block text-gray-800 italic leading-snug">
                    {item.observacao || item.notes || item.info || item.descricao || currentQuote.observations}
                  </span>
                </div>
              )}
            </div>

            {/* Coluna Direita - Desenho Técnico Nítido */}
            <div 
              id="box-foto-etiqueta"
              className="etiqueta-foto-box col-span-5 border-2 border-dashed border-gray-400 p-1 rounded flex items-center justify-center min-h-[110px] bg-slate-50 overflow-hidden"
            >
              {img ? (
                <img 
                  id="img-desenho-etiqueta"
                  src={img} 
                  alt="Desenho Peça" 
                  className="desenho-tecnico-img max-h-[100px] w-auto object-contain print:contrast-[250%] print:brightness-90"
                  style={{ filter: 'contrast(200%) brightness(85%)' }}
                />
              ) : (
                <span id="sem-foto-msg" className="text-[9px] font-bold text-gray-400 text-center uppercase tracking-wide">
                  CORTE / USINAGEM CNC
                </span>
              )}
            </div>
          </div>

          {/* Item selector pills if quote has multiple items */}
          {currentQuote.items.length > 1 && (
            <div className="btn-no-print pt-1 pb-2 mb-2 flex items-center gap-1 overflow-x-auto border-t border-slate-200">
              <span className="text-[9px] text-slate-400 font-bold">Peça:</span>
              {currentQuote.items.map((it, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedItemIndex(idx)}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold cursor-pointer transition-all ${
                    selectedItemIndex === idx ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  #{idx + 1}
                </button>
              ))}
            </div>
          )}

          {/* Rodapé Interno */}
          <div className="etiqueta-footer pt-2 border-t border-black text-center mt-auto">
            <span className="site-url text-[10px] font-bold tracking-widest text-black uppercase block">
              www.usicortemetais.com.br
            </span>
          </div>
        </div>
          );
        })}

        {/* ===================================================
             PROPOSTA 4: RELATÓRIO / PROPOSTA COMERCIAL (4 COLUNAS RESPONSIVA)
             =================================================== */}
        <div 
          id="doc-proposta-resumida" 
          className={`documento-modelo secao-proposta-resumida mx-auto ${
            activeModel === 'proposta-resumida' ? 'block' : 'hidden'
          }`}
        >
          <QuotePrintView 
            quote={{
              id: currentQuote.quoteNumber || currentQuote.id || 'COT-2026-3169',
              quoteNumber: currentQuote.quoteNumber || currentQuote.id || 'COT-2026-3169',
              date: currentQuote.date || new Date().toLocaleDateString('pt-BR'),
              clientName: selectedClientName || currentQuote.clientName || 'BRASIL TECNOLOGIAS LTDA',
              paymentTerms: currentQuote.paymentTerms || 'À Vista / Pix (3% Desc.)',
              validityDays: currentQuote.validityDays || 10,
              deliveryTerms: 'A combinar / Imediato',
              observations: currentQuote.observations,
              totalWeightKg: currentQuote.totalWeightKg || (currentQuote.items ? currentQuote.items.reduce((acc, it) => acc + (it.totalWeightKg || 0), 0) : undefined),
              totalDiscount: currentQuote.discount,
              shippingCost: currentQuote.shipping,
              grandTotal: currentQuote.grandTotal,
              items: currentQuote.items.map((it, idx) => ({
                material: it.constanteNome || it.constantName || it.material || 'MATERIAL',
                dimensions: formatarMedidasLimpa(it) || 'Ø 50 x 200 mm',
                description: it.descricao || it.description || 'Corte / Usinagem Industrial',
                info: it.observacao || it.notes || it.info || '-',
                // ✅ imagem do próprio item
                drawingImage: getDrawing(idx)
              }))
            }}
          />
        </div>

      </div>
        </>
      )}

    </div>
  );
}
