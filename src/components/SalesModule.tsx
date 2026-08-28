import React, { useState, useEffect, useRef } from 'react';
import { Client, Quote, QuoteItem } from '../types';
import { 
  saveCotacaoDb, 
  fetchCotacoesDb, 
  mapSupabaseStatusToQuote, 
  db,
  SupabaseCotacao
} from '../lib/db';
import { 
  formatCurrency, 
  formatNumberBR, 
  formatWeightKg,
  formatSafeDate,
  getSafeISODate,
  formatarMedidasLimpa,
  renderizarTabelaRelatorio,
  parseNumberBR, 
  parseDimensionToMm,
  normalizeConstant,
  calculateItemSubtotal, 
  calculateItemWeightKg,
  calculateItemUnitPrice,
  detectGeometryTypeFromText,
  parseDimensionStrings,
  parseDiameterOrThicknessMm,
  calculateTheoreticalWeightAndPrice,
  GeometryType,
  MATERIAL_PROFILES,
  MaterialProfile,
  MATERIAL_PRESETS,
  MaterialConstantPreset,
  STANDARD_MEASURE_PRESETS,
  StandardMeasurePreset,
  PRODUCT_DESCRIPTION_PRESETS,
  ProductDescriptionPreset,
  INLINE_PRODUCT_OPTIONS,
  LISTA_MATERIAIS_INLINE,
  DADOS_MATERIAIS_MAP
} from '../utils/calculator';
import { fileToDxfImage, isDxfFile } from '../utils/dxfRenderer';
import { 
  baixarEstoquePorCotacao, 
  gerarContasReceberPorCotacao 
} from '../services/inventoryFinanceService';
import QuotePrintModal from './QuotePrintModal';
import QuoteHistoryModal from './QuoteHistoryModal';
import {
  FileSpreadsheet,
  PlusCircle,
  Trash2,
  Edit2,
  Copy,
  Printer,
  Save,
  RotateCcw,
  History,
  CheckCircle2,
  Calculator,
  Layers,
  Sparkles,
  Calendar,
  User,
  Phone,
  Mail,
  Building,
  Tag,
  Clock,
  ArrowRight,
  TrendingUp,
  FileCheck,
  AlertCircle,
  HelpCircle,
  Scale,
  Box,
  CircleDot,
  Weight,
  Zap,
  Coins,
  DollarSign,
  ChevronDown,
  Search,
  Check,
  X,
  Ruler,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

interface SalesModuleProps {
  clients: Client[];
  onNavigateToClients?: () => void;
  selectedMaterial?: MaterialProfile | null;
  onQuoteChange?: (quote: Quote) => void;
  onNavigateToReports?: () => void;
  quoteToEdit?: Quote | null;
  onClearQuoteToEdit?: () => void;
}

export default function SalesModule({ 
  clients, 
  onNavigateToClients,
  selectedMaterial,
  onQuoteChange,
  onNavigateToReports,
  quoteToEdit,
  onClearQuoteToEdit
}: SalesModuleProps) {
  // Geração determinística do próximo número de cotação sequencial (Início estrito: COT-2026-000020)
  const generateNextQuoteNumber = (quotesList?: Quote[]): string => {
    const year = new Date().getFullYear();
    let quotes: any[] = [];
    if (quotesList && Array.isArray(quotesList)) {
      quotes = quotesList;
    } else {
      try {
        quotes = JSON.parse(localStorage.getItem("s_orcamentos") || "[]");
      } catch {
        quotes = [];
      }
    }

    // Se não houver cotações válidas para o ano, inicia estritamente em 19 para a próxima ser 20 (COT-YYYY-000020)
    let maxSequential = 19;

    quotes.forEach((q: any) => {
      const raw = String(q.quoteNumber || q.numero || q.id || "").trim();
      if (raw.includes('021935') || raw.includes('21935')) return;

      const matchYear = raw.match(/^COT-(\d{4})-(\d{6})$/i);
      if (matchYear) {
        const qYear = parseInt(matchYear[1], 10);
        const seq = parseInt(matchYear[2], 10);
        // Aceita sequenciais legítimos a partir de 20 e menores que 10000
        if (qYear === year && !isNaN(seq) && seq !== 21935 && seq > maxSequential && seq < 10000) {
          maxSequential = seq;
        }
      }
    });

    const nextNumber = maxSequential + 1;
    return `COT-${year}-${String(nextNumber).padStart(6, "0")}`;
  };

  const [numeroCotacao, setNumeroCotacao] = useState<string>('COT-2026-000020');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [clientDocument, setClientDocument] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [clientEmail, setClientEmail] = useState<string>('');
  const [clientCity, setClientCity] = useState<string>('');
  const [clientState, setClientState] = useState<string>('');
  const [quoteDate, setQuoteDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [validityDays, setValidityDays] = useState<number>(10);
  const [paymentTerms, setPaymentTerms] = useState<string>('À Vista / Pix (3% Desc.)');
  const [quoteStatus, setQuoteStatus] = useState<Quote['status']>('Pendente');
  const [observations, setObservations] = useState<string>('Preços com impostos inclusos. Material sujeito a conferência no ato do recebimento.');

  // Adjustments (Discount & Shipping)
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [shippingAmount, setShippingAmount] = useState<number>(0);

  // Items list
  const [items, setItems] = useState<QuoteItem[]>([]);

  // Item form state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemGeometryType, setItemGeometryType] = useState<GeometryType>('chapa');
  const [itemConstantSelect, setItemConstantSelect] = useState<string>('laser_a36');
  const [itemConstantName, setItemConstantName] = useState<string>('LASER A36');
  const [itemConstant, setItemConstant] = useState<string>('0.00785');
  const [itemPricePerKg, setItemPricePerKg] = useState<string>('22,00');
  const [itemDescription, setItemDescription] = useState<string>('');
  const [itemDiameter, setItemDiameter] = useState<string>('');
  const [itemThickness, setItemThickness] = useState<string>('');
  const [itemWidthLength, setItemWidthLength] = useState<string>('');
  const [itemWidthMm, setItemWidthMm] = useState<string>('');
  const [itemLengthMm, setItemLengthMm] = useState<string>('');
  const [itemUnitPrice, setItemUnitPrice] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<string>('1');
  const [itemNotes, setItemNotes] = useState<string>('');
  const [itemDrawingImage, setItemDrawingImage] = useState<string | null>(null);
  const [isManualUnitPrice, setIsManualUnitPrice] = useState<boolean>(false);
  const itemFileInputRef = useRef<HTMLInputElement>(null);

  // Constante Combobox & Autocomplete state
  const [isConstantOpen, setIsConstantOpen] = useState<boolean>(false);
  const [constantSearchQuery, setConstantSearchQuery] = useState<string>('');
  const [constantCategoryFilter, setConstantCategoryFilter] = useState<string>('ALL');
  const constantComboboxRef = useRef<HTMLDivElement>(null);
  const constantInputRef = useRef<HTMLInputElement>(null);

  // Diâmetro (Ø) / Espessura Combobox & Autocomplete state
  const [isDiameterOpen, setIsDiameterOpen] = useState<boolean>(false);
  const [diameterSearchQuery, setDiameterSearchQuery] = useState<string>('');
  const [diameterCategoryFilter, setDiameterCategoryFilter] = useState<string>('ALL');
  const diameterComboboxRef = useRef<HTMLDivElement>(null);

  // Descrição do Produto / Serviço Combobox & Autocomplete state
  const [isDescriptionOpen, setIsDescriptionOpen] = useState<boolean>(false);
  const [descriptionSearchQuery, setDescriptionSearchQuery] = useState<string>('');
  const [descriptionCategoryFilter, setDescriptionCategoryFilter] = useState<string>('ALL');
  const descriptionComboboxRef = useRef<HTMLDivElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // Auto-calculator helper state
  const [showAutoCalcHelp, setShowAutoCalcHelp] = useState<boolean>(false);
  const [autoCalcWeight, setAutoCalcWeight] = useState<number | null>(null);

  // Saved quotes history (stored in localStorage under 's_orcamentos')
  const [savedQuotes, setSavedQuotes] = useState<Quote[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Feedback banners
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Close comboboxes when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (constantComboboxRef.current && !constantComboboxRef.current.contains(event.target as Node)) {
        setIsConstantOpen(false);
      }
      if (diameterComboboxRef.current && !diameterComboboxRef.current.contains(event.target as Node)) {
        setIsDiameterOpen(false);
      }
      if (descriptionComboboxRef.current && !descriptionComboboxRef.current.contains(event.target as Node)) {
        setIsDescriptionOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Limpeza de Storage para chaves antigas ou com cache residual ao carregar
  useEffect(() => {
    try {
      const keysToCheck = ['s_orcamentos', 'cotacao_atual', 'numeroCotacao', 'quoteNumber', 'lastQuoteNumber', 'ultimoNumero'];
      keysToCheck.forEach(key => {
        const val = localStorage.getItem(key);
        if (val && (val.includes('021935') || val.includes('21935'))) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Erro ao limpar cache:', e);
    }
  }, []);

  // Load saved quotes on mount (LocalStorage + Supabase)
  useEffect(() => {
    async function loadQuotes() {
      let localQuotes: Quote[] = [];
      const saved = localStorage.getItem('s_orcamentos');
      if (saved) {
        try {
          let parsedQuotes = JSON.parse(saved);
          if (Array.isArray(parsedQuotes)) {
            // Sanitiza registros legados
            const cleanedQuotes = parsedQuotes.filter((q: any) => {
              const str = String(q.quoteNumber || q.numero || q.id || '');
              return !str.includes('021935') && !str.includes('21935');
            });
            if (cleanedQuotes.length !== parsedQuotes.length) {
              localStorage.setItem('s_orcamentos', JSON.stringify(cleanedQuotes));
              parsedQuotes = cleanedQuotes;
            }

            // Deduplica e sanitiza o localQuotes inicial
            const localMap = new Map<string, Quote>();
            parsedQuotes.forEach((lq: any) => {
              const key = String(lq.quoteNumber || lq.id || '').trim().toLowerCase();
              if (key && !localMap.has(key)) {
                localMap.set(key, {
                  ...lq,
                  date: getSafeISODate(lq.date || lq.createdAt),
                  createdAt: lq.createdAt && !isNaN(new Date(lq.createdAt).getTime()) ? lq.createdAt : new Date().toISOString(),
                  updatedAt: lq.updatedAt && !isNaN(new Date(lq.updatedAt).getTime()) ? lq.updatedAt : new Date().toISOString()
                });
              }
            });
            localQuotes = Array.from(localMap.values());
            setSavedQuotes(localQuotes);
          }
        } catch (e) {
          console.error('Error loading saved quotes from localStorage:', e);
        }
      }

      // Consulta cotações salvas no Supabase
      try {
        const dbQuotes = await fetchCotacoesDb();
        if (dbQuotes && dbQuotes.length > 0) {
          // Mapeia cotações vindas do Supabase com validação e fallback seguro de data
          const mappedDbQuotes: Quote[] = dbQuotes
            .filter(q => {
              const num = String(q.numero || q.id || '');
              return !num.includes('021935') && !num.includes('21935');
            })
            .map(q => {
            const safeDateIso = getSafeISODate(q.data || q.created_at);
            const safeCreatedAt = q.created_at && !isNaN(new Date(q.created_at).getTime())
              ? new Date(q.created_at).toISOString()
              : (q.data && !isNaN(new Date(q.data).getTime()) ? new Date(q.data).toISOString() : new Date().toISOString());
            const safeUpdatedAt = q.updated_at && !isNaN(new Date(q.updated_at).getTime())
              ? new Date(q.updated_at).toISOString()
              : safeCreatedAt;

            return {
              id: q.id || q.numero || `db-quote-${Date.now()}`,
              quoteNumber: q.numero || q.id || 'COT-SEM-NUMERO',
              clientName: q.cliente_nome || 'Cliente Balcão',
              contactPerson: q.contato || '',
              clientPhone: q.telefone || '',
              clientEmail: q.email || '',
              date: safeDateIso,
              validityDays: 10,
              paymentTerms: 'À Vista',
              status: mapSupabaseStatusToQuote(q.status),
              observations: q.observacoes || '',
              discount: 0,
              shipping: 0,
              subtotalTotal: Number(q.valor_total) || 0,
              grandTotal: Number(q.valor_total) || 0,
              createdAt: safeCreatedAt,
              updatedAt: safeUpdatedAt,
              items: (q.cotacao_itens || []).map((it, idx) => ({
                id: String(it.id || idx),
                date: safeDateIso,
                companyName: q.cliente_nome || 'Cliente Balcão',
                description: it.descricao || it.produto || 'Item',
                constant: '0.00785',
                constantName: it.produto || 'Material',
                measure: it.medida || '',
                diameter: '',
                widthLength: '',
                unitPrice: Number(it.valor_unitario) || 0,
                quantity: Number(it.quantidade) || 1,
                subtotal: Number(it.valor_total) || ((Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 1)),
                notes: it.observacao || '',
                drawingImage: it.desenho_url || undefined
              }))
            };
          });

          // Deduplicação: Prioridade total aos dados do Supabase sobre o localStorage
          const quotesMap = new Map<string, Quote>();
          const seenKeys = new Set<string>();

          const extractKeys = (q: Quote) => {
            const keys: string[] = [];
            if (q.id) keys.push(String(q.id).trim().toLowerCase());
            if (q.quoteNumber) keys.push(String(q.quoteNumber).trim().toLowerCase());
            return keys;
          };

          // 1. Insere todas as cotações do Supabase no mapa
          mappedDbQuotes.forEach(q => {
            const primaryKey = String(q.quoteNumber || q.id).trim().toLowerCase();
            quotesMap.set(primaryKey, q);
            extractKeys(q).forEach(k => seenKeys.add(k));
          });

          // 2. Insere cotações do LocalStorage apenas se não existirem no Supabase (por ID ou número)
          localQuotes.forEach(lq => {
            const keys = extractKeys(lq);
            const existsInSupabase = keys.some(k => seenKeys.has(k));
            if (!existsInSupabase) {
              const primaryKey = String(lq.quoteNumber || lq.id).trim().toLowerCase();
              const sanitizedLq: Quote = {
                ...lq,
                date: getSafeISODate(lq.date || lq.createdAt),
                createdAt: lq.createdAt && !isNaN(new Date(lq.createdAt).getTime()) ? lq.createdAt : new Date().toISOString(),
                updatedAt: lq.updatedAt && !isNaN(new Date(lq.updatedAt).getTime()) ? lq.updatedAt : new Date().toISOString()
              };
              quotesMap.set(primaryKey, sanitizedLq);
              keys.forEach(k => seenKeys.add(k));
            }
          });

          const combined = Array.from(quotesMap.values());
          setSavedQuotes(combined);
          localStorage.setItem('s_orcamentos', JSON.stringify(combined));
        }
      } catch (err) {
        console.warn('Banco Supabase em modo cotações offline:', err);
      }
    }

    loadQuotes();
  }, []);

  // Carrega cotação para edição caso passada via prop quoteToEdit
  useEffect(() => {
    if (quoteToEdit) {
      handleLoadQuoteFromHistory(quoteToEdit);
      if (onClearQuoteToEdit) {
        onClearQuoteToEdit();
      }
    }
  }, [quoteToEdit]);

  // When selectedMaterial is passed from Products screen, apply it immediately
  useEffect(() => {
    if (selectedMaterial) {
      setItemConstantSelect(selectedMaterial.id);
      setItemConstantName(selectedMaterial.name);
      setItemGeometryType(selectedMaterial.tipo);
      setItemConstant(selectedMaterial.k.toString());
      setItemPricePerKg(selectedMaterial.defaultPriceKg.toFixed(2).replace('.', ','));
      setItemDescription(selectedMaterial.name);
      setIsManualUnitPrice(false);

      // Focus on the first dimension field
      setTimeout(() => {
        const firstField = document.getElementById('diametro') || document.getElementById('espessura');
        if (firstField) {
          firstField.focus();
        }
      }, 100);
    }
  }, [selectedMaterial]);

  // When selectedClientId changes, auto fill client data
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) return;

    const found = clients.find(c => c.id === clientId);
    if (found) {
      setClientName(found.fantasyName || found.name);
      setClientDocument(found.document);
      setContactPerson(found.contactPerson || '');
      setClientPhone(found.phone);
      setClientEmail(found.email);
      setClientCity(found.city);
      setClientState(found.state);
    }
  };

  // Real-time calculation of item dimensions, weight and cascading price
  const currentFormPriceKg = parseNumberBR(itemPricePerKg);
  const currentFormConstant = normalizeConstant(itemConstant);
  const currentFormQty = parseFloat(itemQuantity) || 0;

  // Derive dimensions for real-time live weight
  const parsedDims = parseDimensionStrings(itemWidthLength, itemDiameter, itemThickness);
  const effectiveDiameterMm = parseDiameterOrThicknessMm(itemDiameter, itemThickness);
  const effectiveThicknessMm = parseDiameterOrThicknessMm(itemThickness, itemDiameter);
  const effectiveWidthMm = parseDimensionToMm(itemWidthMm) || parsedDims.parsedWidthMm || 0;
  const effectiveLengthMm = parseDimensionToMm(itemLengthMm) || parsedDims.parsedLengthMm || 0;

  const { unitWeightKg: currentFormUnitWeightKg, totalWeightKg: currentFormTotalWeightKg } = calculateItemWeightKg({
    geometryType: itemGeometryType,
    constant: currentFormConstant,
    diameterMm: effectiveDiameterMm,
    thicknessMm: effectiveThicknessMm,
    widthMm: effectiveWidthMm,
    lengthMm: effectiveLengthMm,
    quantity: currentFormQty > 0 ? currentFormQty : 1,
    diameterStr: itemDiameter,
    thicknessStr: itemThickness
  });

  // Theoretical unit price calculated in cascade: Peso Unitário (Kg) * Preço/Kg (R$) arredondando para cima inteiro (Math.ceil)
  const calculatedUnitPrice = currentFormUnitWeightKg > 0 && currentFormPriceKg > 0
    ? Math.ceil(currentFormUnitWeightKg * currentFormPriceKg)
    : 0;

  // Live unit price for form calculations (prioritizes active input or cascading result, arredondando para cima inteiro)
  const rawFormUnitPrice = parseNumberBR(itemUnitPrice) || calculatedUnitPrice;
  const currentFormUnitPrice = Math.ceil(rawFormUnitPrice);
  const currentFormSubtotal = calculateItemSubtotal(currentFormUnitPrice, currentFormQty > 0 ? currentFormQty : 1);

  // Helper to recompute and update the Unit Price (R$) field whenever dimensions, constant or price/kg changes
  const updateCascadingUnitPrice = (
    priceKgStr: string,
    constantStr: string,
    geom: GeometryType,
    widthMmStr: string,
    lengthMmStr: string,
    diameterStr: string,
    thicknessStr: string = ''
  ) => {
    const pKg = parseNumberBR(priceKgStr);
    const k = normalizeConstant(constantStr);
    const parsedThick = parseDiameterOrThicknessMm(thicknessStr, diameterStr);
    const parsedDia = parseDiameterOrThicknessMm(diameterStr, thicknessStr);
    const wMm = parseDimensionToMm(widthMmStr) || 0;
    const lMm = parseDimensionToMm(lengthMmStr) || 0;

    const unitPrice = calculateItemUnitPrice({
      geometryType: geom,
      constant: k,
      diameterMm: parsedDia,
      thicknessMm: parsedThick,
      widthMm: wMm,
      lengthMm: lMm,
      pricePerKg: pKg,
      diameterStr: diameterStr,
      thicknessStr: thicknessStr
    });

    if (unitPrice > 0) {
      const roundedPrice = Math.ceil(unitPrice);
      setItemUnitPrice(roundedPrice.toFixed(2).replace('.', ','));
    }
  };

  const handleConstantSelectChange = (val: string) => {
    setItemConstantSelect(val);
    if (!val) return;

    // Busca nas novas constantes oficiais
    const matData = DADOS_MATERIAIS_MAP[val] || 
      DADOS_MATERIAIS_MAP[val.toLowerCase()] ||
      MATERIAL_PROFILES.find(p => p.id === val || p.name.toLowerCase() === val.toLowerCase());

    if (matData) {
      const newGeom = matData.tipo;
      const newConstant = matData.k.toString();
      const newPriceKg = ('precoKg' in matData ? matData.precoKg : ('defaultPriceKg' in matData ? (matData as any).defaultPriceKg : 22.00)).toFixed(2).replace('.', ',');
      const newProfileName = ('nome' in matData ? matData.nome : ('name' in matData ? (matData as any).name : val));

      setItemConstantName(newProfileName);
      setItemGeometryType(newGeom);
      setItemConstant(newConstant);
      setItemPricePerKg(newPriceKg);
      setIsManualUnitPrice(false);

      if (!itemDescription || MATERIAL_PROFILES.some(p => p.name === itemDescription)) {
        setItemDescription(newProfileName);
      }

      updateCascadingUnitPrice(
        newPriceKg,
        newConstant,
        newGeom,
        itemWidthMm,
        itemLengthMm,
        itemDiameter,
        itemThickness
      );
      return;
    }

    // Fallbacks para perfis legados
    if (val === 'chapa_aco' || val === 'laser_chapa') {
      setItemConstantName('CHAPA');
      setItemGeometryType('chapa');
      setItemConstant('0.00785');
      setItemPricePerKg('22,00');
    }
  };

  // Live Auto-calculator button trigger (Metallurgical calculation)
  const handleTriggerAutoCalc = () => {
    const k = normalizeConstant(itemConstant);
    const pKg = parseNumberBR(itemPricePerKg) || 22.00;
    const res = calculateTheoreticalWeightAndPrice({
      geometryType: itemGeometryType,
      constant: k,
      measureStr: itemDiameter,
      widthLengthStr: itemWidthLength,
      diameterStr: itemDiameter,
      widthMm: effectiveWidthMm,
      lengthMm: effectiveLengthMm,
      baseKgPrice: pKg
    });

    setAutoCalcWeight(res.estimatedWeightKg);
    setItemUnitPrice(res.suggestedUnitPrice.toFixed(2).replace('.', ','));
    setIsManualUnitPrice(false);
    setShowAutoCalcHelp(true);
  };

  // Filter presets for the Constante Combobox Autocomplete
  const filteredPresets = MATERIAL_PRESETS.filter(preset => {
    if (!constantSearchQuery.trim()) return true;
    const q = constantSearchQuery.toLowerCase().trim();
    const nameMatch = preset.name.toLowerCase().includes(q);
    const catMatch = preset.category.toLowerCase().includes(q);
    const constMatch = preset.constant.toString().includes(q) || preset.constant.toString().replace('.', ',').includes(q);
    const descMatch = preset.description.toLowerCase().includes(q);
    const kwMatch = preset.keywords ? preset.keywords.some(k => k.toLowerCase().includes(q)) : false;
    return nameMatch || catMatch || constMatch || descMatch || kwMatch;
  });

  // Ordem canônica dos campos conforme fluxo do usuário
  const FORM_FIELD_ORDER = [
    'constante',
    'diametro',
    'espessura',
    'largura',
    'comprimento',
    'descricao',
    'observacao',
    'qtd',
    'precoKg',
    'btn-adicionar'
  ];

  // Focus next field helper for smooth Enter key navigation
  const focusNextField = (fieldId: string) => {
    setTimeout(() => {
      let targetId = fieldId;
      let el = document.getElementById(targetId);
      if (!el && fieldId === 'constante') {
        el = document.getElementById('constante') || document.getElementById('constante-search-btn') || document.getElementById('diametro');
      }
      if (!el && fieldId === 'btn-adicionar') {
        el = document.getElementById('btn-adicionar') || document.getElementById('btn-salvar-item') || document.getElementById('btn-add-item-plus');
      }

      // Se o elemento estiver desabilitado (ex: largura em maciço ou bucha), avança automaticamente para o próximo
      if (el && 'disabled' in el && (el as HTMLInputElement).disabled) {
        const currentIndex = FORM_FIELD_ORDER.indexOf(targetId);
        if (currentIndex !== -1 && currentIndex < FORM_FIELD_ORDER.length - 1) {
          focusNextField(FORM_FIELD_ORDER[currentIndex + 1]);
          return;
        }
      }

      if (el) {
        el.focus();
        if (el.tagName === 'INPUT' && typeof (el as HTMLInputElement).select === 'function') {
          (el as HTMLInputElement).select();
        }
      }
    }, 30);
  };

  // Filtered Material Profiles for Select2-style dynamic Material combobox
  const filteredMaterialProfiles = MATERIAL_PROFILES.filter(profile => {
    if (constantCategoryFilter !== 'ALL') {
      if (constantCategoryFilter === 'chapa' && profile.tipo !== 'chapa') return false;
      if (constantCategoryFilter === 'macico' && profile.tipo !== 'macico') return false;
      if (constantCategoryFilter === 'bucha' && profile.tipo !== 'bucha') return false;
    }
    if (!constantSearchQuery.trim()) return true;
    const q = constantSearchQuery.toLowerCase().trim();
    const nameMatch = profile.name.toLowerCase().includes(q);
    const idMatch = profile.id.toLowerCase().includes(q);
    const descMatch = profile.description.toLowerCase().includes(q);
    const kMatch = profile.k.toString().includes(q) || profile.k.toString().replace('.', ',').includes(q);
    return nameMatch || idMatch || descMatch || kMatch;
  });

  // Select Material Profile handler
  const handleSelectMaterialProfile = (profile: MaterialProfile) => {
    setItemConstantName(profile.name);
    handleConstantSelectChange(profile.id);
    setIsConstantOpen(false);
    setConstantSearchQuery('');
    
    // Jump to the next dimensional field automatically (diametro)
    focusNextField('diametro');
  };

  // Autocompletar em linha com seleção destacada para o campo Constante / Material
  const handleConstantInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitado = e.target.value;
    const nativeEvent = e.nativeEvent as InputEvent;
    const isDeleting = 
      nativeEvent?.inputType === 'deleteContentBackward' ||
      nativeEvent?.inputType === 'deleteContentForward' ||
      (nativeEvent?.inputType && nativeEvent.inputType.startsWith('delete'));

    setItemConstantName(digitado);
    setConstantSearchQuery(digitado);

    // Se apagou tudo ou usou Backspace/Delete, não auto-completa
    if (!digitado || isDeleting) {
      return;
    }

    // Lista de materiais cadastrados no sistema
    const listaOpcoes = Array.from(new Set([
      ...LISTA_MATERIAIS_INLINE,
      ...MATERIAL_PROFILES.map(p => p.name)
    ]));

    // Busca o primeiro item que começa com o que foi digitado (ignorando maiúsculas)
    const correspondencia = listaOpcoes.find(item =>
      item.toLowerCase().startsWith(digitado.toLowerCase())
    );

    if (correspondencia) {
      const posCursor = digitado.length;
      setItemConstantName(correspondencia);

      // Mapeamento dos valores de K e tipo para o cálculo
      const matData = DADOS_MATERIAIS_MAP[correspondencia] || 
        MATERIAL_PROFILES.find(p => p.name.toLowerCase() === correspondencia.toLowerCase());

      if (matData) {
        const profileId = 'id' in matData ? matData.id : 'chapa_aco';
        const tipo = matData.tipo;
        const k = matData.k;
        const precoKg = ('precoKg' in matData ? matData.precoKg : ('defaultPriceKg' in matData ? matData.defaultPriceKg : 22.00)).toFixed(2).replace('.', ',');

        setItemConstantSelect(profileId);
        setItemGeometryType(tipo);
        setItemConstant(k.toString());
        setItemPricePerKg(precoKg);
        setIsManualUnitPrice(false);

        updateCascadingUnitPrice(
          precoKg,
          k.toString(),
          tipo,
          itemWidthMm,
          itemLengthMm,
          itemDiameter,
          itemThickness
        );
      }

      // Seleciona do cursor até o final (fica destacado como no Access/Excel)
      setTimeout(() => {
        const el = constantInputRef.current || (document.getElementById('constante') as HTMLInputElement);
        if (el) {
          el.value = correspondencia;
          el.setSelectionRange(posCursor, correspondencia.length);
        }
      }, 10);
    }
  };

  // Match active preset for badge indicator
  const matchedPreset = MATERIAL_PRESETS.find(
    p => p.constant === currentFormConstant ||
         p.constant.toString() === itemConstant.replace(',', '.') ||
         (itemDescription && p.name.toLowerCase() === itemDescription.toLowerCase())
  );

  // Preset constant & price/kg picker handler
  const handleSelectPresetConstant = (preset: MaterialConstantPreset) => {
    const constStr = preset.constant.toString();
    const priceKgStr = (preset.defaultPriceKg || 22.00).toFixed(2).replace('.', ',');
    setItemConstant(constStr);
    setItemPricePerKg(priceKgStr);
    setConstantSearchQuery('');
    setIsManualUnitPrice(false);
    setIsConstantOpen(false);

    // If description is empty or equals a previous preset name, update it to the selected preset's name
    if (!itemDescription || MATERIAL_PRESETS.some(p => p.name === itemDescription)) {
      setItemDescription(preset.name);
    }

    updateCascadingUnitPrice(
      priceKgStr,
      constStr,
      itemGeometryType,
      itemWidthMm,
      itemLengthMm,
      itemWidthLength,
      itemDiameter
    );
  };

  // Filter presets for the Diâmetro / Espessura Combobox Autocomplete
  const filteredDiameterPresets = STANDARD_MEASURE_PRESETS.filter(preset => {
    // Category filter tab
    if (diameterCategoryFilter !== 'ALL') {
      if (diameterCategoryFilter === 'POLEGADAS' && !preset.category.includes('Polegadas')) return false;
      if (diameterCategoryFilter === 'BITOLAS' && !preset.category.includes('Bitolas')) return false;
      if (diameterCategoryFilter === 'MILIMETROS' && !preset.category.includes('Milímetros')) return false;
      if (diameterCategoryFilter === 'DIAMETROS' && !preset.category.includes('Diâmetros')) return false;
    }

    if (!diameterSearchQuery.trim()) return true;
    const q = diameterSearchQuery.toLowerCase().trim();
    const labelMatch = preset.label.toLowerCase().includes(q);
    const dispMatch = preset.displayValue.toLowerCase().includes(q);
    const catMatch = preset.category.toLowerCase().includes(q);
    const descMatch = preset.description.toLowerCase().includes(q);
    const thickMatch = preset.thicknessMm.toString().includes(q) || preset.thicknessMm.toString().replace('.', ',').includes(q);
    const kwMatch = preset.keywords ? preset.keywords.some(k => k.toLowerCase().includes(q)) : false;
    return labelMatch || dispMatch || catMatch || descMatch || thickMatch || kwMatch;
  });

  // Match active diameter preset for badge indicator
  const matchedDiameterPreset = STANDARD_MEASURE_PRESETS.find(
    p => p.displayValue.toLowerCase() === itemDiameter.trim().toLowerCase() ||
         p.label.toLowerCase() === itemDiameter.trim().toLowerCase() ||
         p.thicknessMm.toString() === itemDiameter.trim().replace(',', '.')
  );

  // Preset diameter picker handler
  const handleSelectPresetDiameter = (preset: StandardMeasurePreset) => {
    setItemDiameter(preset.displayValue);
    setDiameterSearchQuery('');
    setIsDiameterOpen(false);

    updateCascadingUnitPrice(
      itemPricePerKg,
      itemConstant,
      itemGeometryType,
      itemWidthMm,
      itemLengthMm,
      itemWidthLength,
      preset.displayValue
    );
  };

  // Manual change in Preço/Kg field
  const handlePricePerKgChange = (val: string) => {
    setItemPricePerKg(val);
    setIsManualUnitPrice(false);
    updateCascadingUnitPrice(
      val,
      itemConstant,
      itemGeometryType,
      itemWidthMm,
      itemLengthMm,
      itemDiameter,
      itemThickness
    );
  };

  // Manual change in Valor Unitário (R$)
  const handleUnitPriceManualChange = (val: string) => {
    setItemUnitPrice(val);
    setIsManualUnitPrice(true);
    const manualVal = parseNumberBR(val);
    if (currentFormUnitWeightKg > 0 && manualVal > 0) {
      const derivedPriceKg = Math.round((manualVal / currentFormUnitWeightKg) * 100) / 100;
      setItemPricePerKg(derivedPriceKg.toFixed(2).replace('.', ','));
    }
  };

  // 1. Efeito do Vídeo: Autocompletar em linha com seleção destacada ao digitar
  const handleDescriptionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitado = e.target.value;
    const nativeEvent = e.nativeEvent as InputEvent;
    const isDeleting = 
      nativeEvent?.inputType === 'deleteContentBackward' ||
      nativeEvent?.inputType === 'deleteContentForward' ||
      (nativeEvent?.inputType && nativeEvent.inputType.startsWith('delete'));

    setItemDescription(digitado);
    setDescriptionSearchQuery(digitado);

    // Se apagou tudo ou usou Backspace/Delete, não auto-completa
    if (!digitado || isDeleting) {
      const detected = detectGeometryTypeFromText(digitado + ' ' + itemDiameter + ' ' + itemThickness);
      if (!editingItemId) {
        setItemGeometryType(detected);
      }
      return;
    }

    // Lista de opções cadastradas no sistema
    const listaCompleta = Array.from(new Set([
      ...INLINE_PRODUCT_OPTIONS,
      ...PRODUCT_DESCRIPTION_PRESETS.map(p => p.name)
    ]));

    // Busca o primeiro item que começa com o que foi digitado (ignorando maiúsculas/minúsculas)
    const correspondencia = listaCompleta.find(item => 
      item.toLowerCase().startsWith(digitado.toLowerCase())
    );

    if (correspondencia) {
      const posicaoCursor = digitado.length;
      setItemDescription(correspondencia); // Preenche o texto inteiro

      // Sincroniza dados do preset se existir
      const matchedPreset = PRODUCT_DESCRIPTION_PRESETS.find(
        p => p.name.toLowerCase() === correspondencia.toLowerCase()
      );

      if (matchedPreset) {
        setItemGeometryType(matchedPreset.geometryType);
        setItemConstant(matchedPreset.constant.toString());
        setItemConstantSelect(matchedPreset.constantSelect);
        const newPriceKg = (matchedPreset.defaultPriceKg || 22.00).toFixed(2).replace('.', ',');
        setItemPricePerKg(newPriceKg);
        setIsManualUnitPrice(false);
        updateCascadingUnitPrice(
          newPriceKg,
          matchedPreset.constant.toString(),
          matchedPreset.geometryType,
          itemWidthMm,
          itemLengthMm,
          itemDiameter,
          itemThickness
        );
      } else {
        const detected = detectGeometryTypeFromText(correspondencia + ' ' + itemDiameter + ' ' + itemThickness);
        if (!editingItemId) {
          setItemGeometryType(detected);
        }
      }

      // Seleciona do cursor até o final (fica destacado como no Access/Excel)
      setTimeout(() => {
        const el = descriptionInputRef.current || (document.getElementById('descricao') as HTMLInputElement);
        if (el) {
          el.value = correspondencia;
          el.setSelectionRange(posicaoCursor, correspondencia.length);
        }
      }, 10);
    } else {
      const detected = detectGeometryTypeFromText(digitado + ' ' + itemDiameter + ' ' + itemThickness);
      if (!editingItemId) {
        setItemGeometryType(detected);
      }
    }
  };

  // Auto-detect geometry suggestion when description changes directly
  const handleDescriptionChange = (value: string) => {
    setItemDescription(value);
    const detected = detectGeometryTypeFromText(value + ' ' + itemDiameter + ' ' + itemThickness);
    if (!editingItemId) {
      setItemGeometryType(detected);
    }
  };

  // Handle selection from Description Combobox
  const handleSelectDescriptionPreset = (preset: ProductDescriptionPreset) => {
    setItemDescription(preset.name);
    setItemGeometryType(preset.geometryType);
    setItemConstant(preset.constant.toString());
    setItemConstantSelect(preset.constantSelect);
    
    // Set appropriate price per kg if needed
    const newPriceKg = (preset.defaultPriceKg || 22.00).toFixed(2).replace('.', ',');
    setItemPricePerKg(newPriceKg);
    setIsManualUnitPrice(false);
    setDescriptionSearchQuery('');
    setIsDescriptionOpen(false);

    updateCascadingUnitPrice(
      newPriceKg,
      preset.constant.toString(),
      preset.geometryType,
      itemWidthMm,
      itemLengthMm,
      itemDiameter,
      itemThickness
    );
  };

  // Filter description presets
  const filteredDescriptionPresets = PRODUCT_DESCRIPTION_PRESETS.filter(preset => {
    if (descriptionCategoryFilter !== 'ALL' && preset.category !== descriptionCategoryFilter) {
      return false;
    }
    const query = (descriptionSearchQuery || '').toLowerCase().trim();
    if (!query) return true;
    const nameMatch = preset.name.toLowerCase().includes(query);
    const catMatch = preset.category.toLowerCase().includes(query);
    const descMatch = preset.description.toLowerCase().includes(query);
    const badgeMatch = preset.badge.toLowerCase().includes(query);
    const kwMatch = preset.keywords ? preset.keywords.some(k => k.toLowerCase().includes(query)) : false;
    return nameMatch || catMatch || descMatch || badgeMatch || kwMatch;
  });

  // Add or Update item
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemDescription.trim()) {
      setErrorMessage('Por favor, informe a descrição do item.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const rawUnitPriceNum = parseNumberBR(itemUnitPrice) || calculatedUnitPrice;
    const unitPriceNum = Math.ceil(rawUnitPriceNum);
    if (unitPriceNum <= 0) {
      setErrorMessage('O valor unitário deve ser maior que zero (R$). Verifique as medidas ou o Preço/Kg.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const qtyNum = parseFloat(itemQuantity) || 1;
    if (qtyNum <= 0) {
      setErrorMessage('A quantidade deve ser de no mínimo 1 unidade.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const subtotal = calculateItemSubtotal(unitPriceNum, qtyNum);

    // Exact weight calculation according to user rules
    const { unitWeightKg, totalWeightKg } = calculateItemWeightKg({
      geometryType: itemGeometryType,
      constant: currentFormConstant,
      diameterMm: effectiveDiameterMm,
      thicknessMm: effectiveThicknessMm,
      widthMm: effectiveWidthMm,
      lengthMm: effectiveLengthMm,
      quantity: qtyNum,
      diameterStr: itemDiameter,
      thicknessStr: itemThickness
    });

    const priceKgNum = parseNumberBR(itemPricePerKg) || (unitWeightKg > 0 ? unitPriceNum / unitWeightKg : undefined);

    const formattedWidthLength = itemGeometryType === 'CHAPA_RETANGULO' || itemGeometryType === 'chapa'
      ? (effectiveWidthMm > 0 && effectiveLengthMm > 0 ? `${effectiveWidthMm} x ${effectiveLengthMm} mm` : itemWidthLength.trim() || '-')
      : (effectiveLengthMm > 0 ? `${effectiveLengthMm} mm` : itemWidthLength.trim() || '-');

    const itemMatName = itemConstantName.trim() || 'CHAPA';
    const tempItemData = {
      geometryType: itemGeometryType,
      diameter: itemDiameter.trim(),
      thickness: itemThickness.trim(),
      measure: itemThickness.trim() || itemDiameter.trim(),
      widthMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
      lengthMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
      widthLength: formattedWidthLength,
      diameterMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
      thicknessMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined
    };
    const medidasFormatadas = formatarMedidasLimpa(tempItemData);

    if (editingItemId) {
      // Update existing item
      setItems(items.map(item => item.id === editingItemId ? {
        ...item,
        companyName: clientName || 'UsiCorte Cliente',
        description: itemDescription.trim() || itemMatName,
        descricao: itemDescription.trim() || itemMatName,
        constantName: itemMatName,
        constanteNome: itemMatName,
        material: itemMatName,
        geometryType: itemGeometryType,
        constant: itemConstant.trim() || '0.00785',
        pricePerKg: priceKgNum,
        measure: itemThickness.trim() || itemDiameter.trim(),
        thickness: itemThickness.trim(),
        espessura: itemThickness.trim(),
        thicknessMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined,
        espessuraMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined,
        diameter: itemDiameter.trim(),
        diametro: itemDiameter.trim(),
        diameterMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
        diametroMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
        widthLength: formattedWidthLength,
        widthMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
        largura: itemWidthMm.trim(),
        larguraMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
        lengthMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
        comprimento: itemLengthMm.trim(),
        comprimentoMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
        unitWeightKg: unitWeightKg,
        totalWeightKg: totalWeightKg,
        pesoTotal: totalWeightKg,
        unitPrice: unitPriceNum,
        valorUnitario: unitPriceNum,
        quantity: qtyNum,
        qtd: qtyNum,
        subtotal: subtotal,
        notes: itemNotes.trim(),
        observacao: itemNotes.trim(),
        info: itemNotes.trim(),
        medidasFormatadas: medidasFormatadas,
        medidaFormatada: medidasFormatadas,
        drawingImage: itemDrawingImage || undefined,
        fotoDesenho: itemDrawingImage || undefined
      } : item));

      setSuccessMessage('Item atualizado com sucesso!');
      setEditingItemId(null);
    } else {
      // Add new item
      const newItem: QuoteItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        date: quoteDate || new Date().toISOString().split('T')[0],
        companyName: clientName || 'UsiCorte Cliente',
        description: itemDescription.trim() || itemMatName,
        descricao: itemDescription.trim() || itemMatName,
        constantName: itemMatName,
        constanteNome: itemMatName,
        material: itemMatName,
        geometryType: itemGeometryType,
        constant: itemConstant.trim() || '0.00785',
        pricePerKg: priceKgNum,
        measure: itemThickness.trim() || itemDiameter.trim(),
        thickness: itemThickness.trim(),
        espessura: itemThickness.trim(),
        thicknessMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined,
        espessuraMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined,
        diameter: itemDiameter.trim(),
        diametro: itemDiameter.trim(),
        diameterMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
        diametroMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
        widthLength: formattedWidthLength,
        widthMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
        largura: itemWidthMm.trim(),
        larguraMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
        lengthMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
        comprimento: itemLengthMm.trim(),
        comprimentoMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
        unitWeightKg: unitWeightKg,
        totalWeightKg: totalWeightKg,
        pesoTotal: totalWeightKg,
        unitPrice: unitPriceNum,
        valorUnitario: unitPriceNum,
        quantity: qtyNum,
        qtd: qtyNum,
        subtotal: subtotal,
        notes: itemNotes.trim(),
        observacao: itemNotes.trim(),
        info: itemNotes.trim(),
        medidasFormatadas: medidasFormatadas,
        medidaFormatada: medidasFormatadas,
        drawingImage: itemDrawingImage || undefined,
        fotoDesenho: itemDrawingImage || undefined
      };

      setItems([...items, newItem]);
      setSuccessMessage('Item adicionado à cotação com sucesso!');
    }

    // Reset item form fields
    resetItemForm();
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const resetItemForm = () => {
    setEditingItemId(null);
    setItemConstantSelect('laser_a36');
    setItemConstantName('LASER A36');
    setItemDescription('');
    setItemConstant('0.00785');
    setItemPricePerKg('22,00');
    setItemDiameter('');
    setItemThickness('');
    setItemWidthLength('');
    setItemWidthMm('');
    setItemLengthMm('');
    setItemUnitPrice('');
    setItemQuantity('1');
    setItemNotes('');
    setItemDrawingImage(null);
    setIsManualUnitPrice(false);
    setShowAutoCalcHelp(false);
    setAutoCalcWeight(null);
    setIsConstantOpen(false);
    setConstantSearchQuery('');
    setIsDiameterOpen(false);
    setDiameterSearchQuery('');
    setDiameterCategoryFilter('ALL');

    // Volta o foco imediatamente para o primeiro campo da rotação com seleção automática
    focusNextField('constante');
  };

  // Helper para resolver o tipo de geometria oficial (1. Chapa / Retângulo, 2. Maciço ou 3. Tubo)
  const resolveItemGeometry = (it: any): GeometryType => {
    // 1. Checa geometryType explícito
    const g = String(it.geometryType || it.profileType || it.geometry || it.tipo || '').toLowerCase();
    if (g.includes('bucha') || g.includes('tubo') || g === 'tubo_bucha') {
      return 'bucha';
    }
    if (g.includes('macico') || g.includes('maciço') || g.includes('redondo') || g.includes('sextavado') || g === 'redondo_quadrado') {
      return 'macico';
    }
    if (g.includes('chapa') || g.includes('retangulo') || g.includes('placa') || g === 'chapa_retangulo') {
      return 'chapa';
    }

    // 2. Checa tabela de materiais e constantes
    const matName = String(it.constanteNome || it.constantName || it.material || it.description || it.descricao || '').toLowerCase();
    const matchMap = DADOS_MATERIAIS_MAP[matName] || MATERIAL_PROFILES.find(p => p.name.toLowerCase() === matName);
    if (matchMap) {
      if (matchMap.tipo === 'bucha') return 'bucha';
      if (matchMap.tipo === 'macico') return 'macico';
      if (matchMap.tipo === 'chapa') return 'chapa';
    }

    // 3. Detecção por palavras-chave na descrição ou medida
    const combinedText = `${matName} ${it.description || it.descricao || ''} ${it.measure || it.medidaFormatada || ''}`.toLowerCase();
    if (combinedText.includes('bucha') || combinedText.includes('tubo') || combinedText.includes('tubo mecanico')) {
      return 'bucha';
    }
    if (
      combinedText.includes('redondo') ||
      combinedText.includes('macico') ||
      combinedText.includes('maciço') ||
      combinedText.includes('tarugo') ||
      combinedText.includes('eixo') ||
      combinedText.includes('sextavado') ||
      combinedText.includes('bronze tm') ||
      combinedText.includes('nylon redondo') ||
      combinedText.includes('aluminio redondo') ||
      combinedText.includes('aço vc') ||
      combinedText.includes('ffnodular')
    ) {
      return 'macico';
    }
    if (
      combinedText.includes('chapa') ||
      combinedText.includes('laser') ||
      combinedText.includes('oxicorte') ||
      combinedText.includes('retalho') ||
      combinedText.includes('barra chata') ||
      combinedText.includes('placa') ||
      combinedText.includes('chaveta')
    ) {
      return 'chapa';
    }

    return 'chapa';
  };

  // Helper para extrair e preencher isoladamente as medidas (espessura, largura, comprimento, diametro)
  const extractItemDimensions = (it: any, geom: GeometryType) => {
    const isSingleValue = (val: any) => {
      if (val === undefined || val === null) return false;
      const s = String(val).trim();
      if (!s) return false;
      // Se contém delimitadores de medidas concatenadas (x, X, ×, *), NÃO é um valor individual
      if (/[xX×*]/.test(s)) return false;
      return true;
    };

    const cleanNumberStr = (val: any): string => {
      if (val === undefined || val === null) return '';
      let s = String(val).trim();
      if (!s) return '';
      // Remove prefixos de diâmetro e sufixos de unidades (mantém frações como 1/2 ou decimais)
      s = s.replace(/^[Øø\s]+/, '').replace(/\s*mm$/i, '').trim();
      return s;
    };

    // 1. Mapeamento Correto dos Campos Numéricos individuais
    let espessura = isSingleValue(it.espessura) ? cleanNumberStr(it.espessura)
      : isSingleValue(it.espessuraMm) ? cleanNumberStr(it.espessuraMm)
      : isSingleValue(it.thicknessMm) ? cleanNumberStr(it.thicknessMm)
      : isSingleValue(it.thickness) ? cleanNumberStr(it.thickness)
      : '';

    let largura = isSingleValue(it.largura) ? cleanNumberStr(it.largura)
      : isSingleValue(it.larguraMm) ? cleanNumberStr(it.larguraMm)
      : isSingleValue(it.widthMm) ? cleanNumberStr(it.widthMm)
      : isSingleValue(it.width) ? cleanNumberStr(it.width)
      : '';

    let comprimento = isSingleValue(it.comprimento) ? cleanNumberStr(it.comprimento)
      : isSingleValue(it.comprimentoMm) ? cleanNumberStr(it.comprimentoMm)
      : isSingleValue(it.lengthMm) ? cleanNumberStr(it.lengthMm)
      : isSingleValue(it.length) ? cleanNumberStr(it.length)
      : '';

    let diametro = isSingleValue(it.diametro) ? cleanNumberStr(it.diametro)
      : isSingleValue(it.diametroMm) ? cleanNumberStr(it.diametroMm)
      : isSingleValue(it.diameterMm) ? cleanNumberStr(it.diameterMm)
      : isSingleValue(it.diameter) ? cleanNumberStr(it.diameter)
      : '';

    // 2. Sanitização e Parse de Medidas se o item contiver apenas o texto formatado no campo de medida
    const formattedCandidates = [
      it.medidaFormatada,
      it.medidasFormatadas,
      it.descricaoMedida,
      it.medida,
      it.measure,
      it.widthLength,
      it.dimensoes,
      it.medidas,
      it.thickness,
      it.diameter
    ];

    let rawConcatString = '';
    for (const cand of formattedCandidates) {
      if (cand && typeof cand === 'string' && /[xX×*]/.test(cand)) {
        rawConcatString = cand;
        break;
      }
    }

    if (rawConcatString) {
      const parts = rawConcatString
        .replace(/[×*]/g, 'x')
        .split(/[xX]/)
        .map(p => cleanNumberStr(p))
        .filter(p => p !== '');

      if (geom === 'chapa' || geom === 'CHAPA_RETANGULO') {
        if (parts.length >= 3) {
          if (!espessura) espessura = parts[0];
          if (!largura) largura = parts[1];
          if (!comprimento) comprimento = parts[2];
        } else if (parts.length === 2) {
          if (!largura) largura = parts[0];
          if (!comprimento) comprimento = parts[1];
        }
      } else if (geom === 'macico' || geom === 'REDONDO_QUADRADO') {
        if (parts.length >= 2) {
          if (!diametro) diametro = parts[0];
          if (!comprimento) comprimento = parts[parts.length - 1];
        } else if (parts.length === 1) {
          if (!diametro) diametro = parts[0];
        }
      } else if (geom === 'bucha' || geom === 'TUBO_BUCHA') {
        if (parts.length >= 3) {
          if (!diametro) diametro = parts[0];
          if (!espessura) espessura = parts[1];
          if (!comprimento) comprimento = parts[2];
        } else if (parts.length === 2) {
          if (!diametro) diametro = parts[0];
          if (!comprimento) comprimento = parts[1];
        }
      }
    }

    // Se o comprimento não foi preenchido, verificar se widthLength é valor numérico único
    if (!comprimento && it.widthLength && isSingleValue(it.widthLength)) {
      comprimento = cleanNumberStr(it.widthLength);
    }

    // 3. Validação do Tipo de Geometria: Limpa campos que não pertencem àquela geometria
    if (geom === 'chapa' || geom === 'CHAPA_RETANGULO') {
      diametro = ''; // Diâmetro zerado/desabilitado na Chapa/Retângulo
    } else if (geom === 'macico' || geom === 'REDONDO_QUADRADO') {
      espessura = ''; // Espessura zerada/desabilitada no Maciço
      largura = '';   // Largura zerada/desabilitada no Maciço
    } else if (geom === 'bucha' || geom === 'TUBO_BUCHA') {
      largura = '';   // Largura zerada/desabilitada no Tubo/Bucha
    }

    return { espessura, largura, comprimento, diametro };
  };

  const handleEditItem = (item: QuoteItem) => {
    setEditingItemId(item.id);
    setItemDescription(item.description || item.descricao || (item as any).produto || '');

    // 1. Resolução automática e validação do tipo de geometria (Chapa, Maciço ou Tubo)
    const resolvedGeometry = resolveItemGeometry(item);
    setItemGeometryType(resolvedGeometry);

    // 2. Extração isolada e sanitizada das medidas numéricas individuais
    const dims = extractItemDimensions(item, resolvedGeometry);
    setItemDiameter(dims.diametro);
    setItemThickness(dims.espessura);
    setItemWidthMm(dims.largura);
    setItemLengthMm(dims.comprimento);
    setItemWidthLength(
      resolvedGeometry === 'chapa' || resolvedGeometry === 'CHAPA_RETANGULO'
        ? (dims.largura && dims.comprimento ? `${dims.largura} x ${dims.comprimento} mm` : dims.comprimento ? `${dims.comprimento} mm` : '')
        : (dims.comprimento ? `${dims.comprimento} mm` : '')
    );

    // 3. Mapeamento de Constante e Perfil de Material
    const matchedProfile = MATERIAL_PROFILES.find(
      p => p.id === (item as any).materialProfileId ||
           p.name.toLowerCase() === (item.constanteNome || item.constantName || item.material || '').toLowerCase() ||
           (p.k.toString() === item.constant.toString() && (p.tipo === resolvedGeometry || (p.tipo === 'chapa' && resolvedGeometry === 'CHAPA_RETANGULO') || (p.tipo === 'macico' && resolvedGeometry === 'REDONDO_QUADRADO') || (p.tipo === 'bucha' && resolvedGeometry === 'TUBO_BUCHA')))
    );

    const defaultProfileName = resolvedGeometry === 'chapa' || resolvedGeometry === 'CHAPA_RETANGULO'
      ? 'LASER A36'
      : resolvedGeometry === 'macico' || resolvedGeometry === 'REDONDO_QUADRADO'
      ? 'AÇO REDONDO SAE 1045'
      : 'BUCHA REDONDO';

    const resolvedConstantName = item.constanteNome || item.constantName || item.material || matchedProfile?.name || defaultProfileName;
    setItemConstantName(resolvedConstantName);
    setItemConstantSelect(matchedProfile?.id || (resolvedGeometry === 'chapa' || resolvedGeometry === 'CHAPA_RETANGULO' ? 'laser_a36' : resolvedGeometry === 'macico' || resolvedGeometry === 'REDONDO_QUADRADO' ? 'aco_redondo_sae_1045' : 'bucha_redondo'));
    
    const constantVal = item.constant !== undefined && item.constant !== null
      ? item.constant.toString()
      : (matchedProfile ? matchedProfile.k.toString() : (resolvedGeometry === 'chapa' || resolvedGeometry === 'CHAPA_RETANGULO' ? '0.00785' : '0.00617'));
    setItemConstant(constantVal);

    // 4. Preço por Kg e Preço Unitário
    const rawPriceKg = item.pricePerKg !== undefined 
      ? item.pricePerKg 
      : ((item as any).precoKg !== undefined ? (item as any).precoKg : undefined);

    let pricePerKgStr = '22,00';
    if (rawPriceKg !== undefined && !isNaN(Number(rawPriceKg))) {
      pricePerKgStr = Number(rawPriceKg).toFixed(2).replace('.', ',');
    } else if (item.unitWeightKg && item.unitWeightKg > 0 && item.unitPrice) {
      pricePerKgStr = (item.unitPrice / item.unitWeightKg).toFixed(2).replace('.', ',');
    } else if (matchedProfile) {
      pricePerKgStr = matchedProfile.defaultPriceKg.toFixed(2).replace('.', ',');
    }
    setItemPricePerKg(pricePerKgStr);

    const unitPriceVal = item.unitPrice !== undefined ? item.unitPrice : (item.valorUnitario !== undefined ? item.valorUnitario : 0);
    setItemUnitPrice(Number(unitPriceVal).toFixed(2).replace('.', ','));

    const qtyVal = item.quantity !== undefined ? item.quantity : (item.qtd !== undefined ? item.qtd : 1);
    setItemQuantity(qtyVal.toString());

    setItemNotes(item.notes || item.observacao || (item as any).info || '');
    setItemDrawingImage(item.drawingImage || item.fotoDesenho || (item as any).desenhoUrl || (item as any).desenho_url || null);
    setIsManualUnitPrice(false);

    // Scroll smoothly to item form
    const formElement = document.getElementById('item-input-form');
    if (formElement) {
      formElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleDuplicateItem = (item: QuoteItem) => {
    const duplicated: QuoteItem = {
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      description: `${item.description} (Cópia)`
    };
    setItems([...items, duplicated]);
    setSuccessMessage('Item duplicado com sucesso!');
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
    if (editingItemId === id) {
      resetItemForm();
    }
  };

  // Calculations for quote totals and total weight com travas toFixed(2) e toFixed(3)
  const subtotalTotal = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  const grandTotal = Number(Math.max(0, subtotalTotal - discountAmount + shippingAmount).toFixed(2));
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalQuoteWeightKg = Number(items.reduce((sum, item) => sum + (Number(item.totalWeightKg) || 0), 0).toFixed(3));

  // Save full quote to history (localStorage)
  const handleSaveFullQuote = () => {
    if (items.length === 0) {
      setErrorMessage('Adicione pelo menos 1 item antes de salvar o orçamento.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const currentQuoteObject: Quote = {
      id: numeroCotacao,
      quoteNumber: numeroCotacao,
      clientId: selectedClientId || undefined,
      clientName: clientName.trim() || 'Cliente Balcão (UsiCorte)',
      clientDocument: clientDocument.trim(),
      contactPerson: contactPerson.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim(),
      clientCity: clientCity.trim(),
      clientState: clientState.trim(),
      date: quoteDate,
      validityDays: validityDays,
      paymentTerms: paymentTerms,
      status: quoteStatus,
      items: items,
      discount: discountAmount,
      discountPercent: 0,
      shipping: shippingAmount,
      subtotalTotal: subtotalTotal,
      grandTotal: grandTotal,
      totalWeightKg: totalQuoteWeightKg,
      observations: observations,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const existsIndex = savedQuotes.findIndex(
      q => (q.quoteNumber && q.quoteNumber.trim().toLowerCase() === numeroCotacao.trim().toLowerCase()) ||
           (q.id && (q.id === numeroCotacao || (currentQuoteObject.id && q.id === currentQuoteObject.id)))
    );
    let updatedQuotes: Quote[];

    if (existsIndex >= 0) {
      updatedQuotes = [...savedQuotes];
      updatedQuotes[existsIndex] = currentQuoteObject;
    } else {
      updatedQuotes = [currentQuoteObject, ...savedQuotes];
    }

    setSavedQuotes(updatedQuotes);
    localStorage.setItem('s_orcamentos', JSON.stringify(updatedQuotes));

    // Se a cotação estiver Aprovada ou Faturada, realiza a baixa automática no estoque e gera contas a receber
    if (quoteStatus === 'Aprovado' || quoteStatus === 'Faturado') {
      const baixaRes = baixarEstoquePorCotacao(currentQuoteObject);
      const finRes = gerarContasReceberPorCotacao(currentQuoteObject);
      if (baixaRes.itensBaixados > 0) {
        console.log(`Estoque atualizado: ${baixaRes.itensBaixados} itens baixados (${baixaRes.pesoTotalBaixadoKg} kg).`);
      }
      if (finRes) {
        console.log(`Lançamento a receber gerado: R$ ${finRes.valor}.`);
      }
    }

    // Persiste e atualiza no Supabase
    saveCotacaoDb(currentQuoteObject).then(res => {
      if (res.error) {
        console.warn('Cotação salva localmente; aviso no Supabase:', res.error);
        setSuccessMessage(existsIndex >= 0 ? `Orçamento ${numeroCotacao} atualizado no histórico (local)!` : `Orçamento ${numeroCotacao} salvo no histórico (local)!`);
      } else {
        setSuccessMessage(existsIndex >= 0 ? `Orçamento ${numeroCotacao} atualizado com sucesso e sincronizado! ⚡` : `Orçamento ${numeroCotacao} salvo com sucesso e sincronizado! ⚡`);
      }
    }).catch(() => {
      setSuccessMessage(existsIndex >= 0 ? `Orçamento ${numeroCotacao} atualizado com sucesso!` : `Orçamento ${numeroCotacao} salvo com sucesso!`);
    });

    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Aprovar cotação com 1 clique (baixa estoque + gera contas a receber)
  const handleApproveAndDeductQuote = () => {
    setQuoteStatus('Aprovado');
    if (items.length === 0) {
      setErrorMessage('Adicione pelo menos 1 item antes de aprovar o orçamento.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const currentQuoteObject: Quote = {
      id: numeroCotacao,
      quoteNumber: numeroCotacao,
      clientId: selectedClientId || undefined,
      clientName: clientName.trim() || 'Cliente Balcão (UsiCorte)',
      clientDocument: clientDocument.trim(),
      contactPerson: contactPerson.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim(),
      clientCity: clientCity.trim(),
      clientState: clientState.trim(),
      date: quoteDate,
      validityDays: validityDays,
      paymentTerms: paymentTerms,
      status: 'Aprovado',
      items: items,
      discount: discountAmount,
      discountPercent: 0,
      shipping: shippingAmount,
      subtotalTotal: subtotalTotal,
      grandTotal: grandTotal,
      totalWeightKg: totalQuoteWeightKg,
      observations: observations,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const existsIndex = savedQuotes.findIndex(
      q => (q.quoteNumber && q.quoteNumber.trim().toLowerCase() === numeroCotacao.trim().toLowerCase()) ||
           (q.id && (q.id === numeroCotacao || (currentQuoteObject.id && q.id === currentQuoteObject.id)))
    );
    let updatedQuotes: Quote[];

    if (existsIndex >= 0) {
      updatedQuotes = [...savedQuotes];
      updatedQuotes[existsIndex] = currentQuoteObject;
    } else {
      updatedQuotes = [currentQuoteObject, ...savedQuotes];
    }

    setSavedQuotes(updatedQuotes);
    localStorage.setItem('s_orcamentos', JSON.stringify(updatedQuotes));

    // Executa baixa de estoque e contas a receber
    const baixaRes = baixarEstoquePorCotacao(currentQuoteObject);
    const finRes = gerarContasReceberPorCotacao(currentQuoteObject);

    saveCotacaoDb(currentQuoteObject).catch(() => {});

    setSuccessMessage(`✅ Cotação ${numeroCotacao} APROVADA! ${baixaRes.itensBaixados} itens baixados no Estoque (${baixaRes.pesoTotalBaixadoKg} kg) e R$ ${formatCurrency(grandTotal)} lançado no Contas a Receber!`);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // New clean quote
  const handleNewQuote = () => {
    const newId = generateNextQuoteNumber(savedQuotes);
    setNumeroCotacao(newId);
    setSelectedClientId('');
    setClientName('');
    setClientDocument('');
    setContactPerson('');
    setClientPhone('');
    setClientEmail('');
    setClientCity('');
    setClientState('');
    setQuoteDate(new Date().toISOString().split('T')[0]);
    setValidityDays(10);
    setPaymentTerms('À Vista / Pix (3% Desc.)');
    setQuoteStatus('Pendente');
    setItems([]);
    setDiscountAmount(0);
    setShippingAmount(0);
    resetItemForm();
    setSuccessMessage('Novo orçamento iniciado!');
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  // Load a quote from history modal / edit action
  const handleLoadQuoteFromHistory = (quote: Quote) => {
    const targetNum = quote.quoteNumber || quote.id || generateNextQuoteNumber();
    setNumeroCotacao(targetNum);
    setSelectedClientId(quote.clientId || '');
    setClientName(quote.clientName || 'Cliente Balcão (UsiCorte)');
    setClientDocument(quote.clientDocument || '');
    setContactPerson(quote.contactPerson || '');
    setClientPhone(quote.clientPhone || '');
    setClientEmail(quote.clientEmail || '');
    setClientCity(quote.clientCity || '');
    setClientState(quote.clientState || '');
    setQuoteDate(getSafeISODate(quote.date || quote.createdAt));
    setValidityDays(quote.validityDays || 10);
    setPaymentTerms(quote.paymentTerms || 'À Vista / Pix (3% Desc.)');
    setQuoteStatus(quote.status || 'Pendente');
    setItems(quote.items || []);
    setDiscountAmount(quote.discount || 0);
    setShippingAmount(quote.shipping || 0);
    setObservations(quote.observations || 'Preços com impostos inclusos. Material sujeito a conferência no ato do recebimento.');
    resetItemForm();

    setSuccessMessage(`Orçamento ${targetNum} carregado para edição com sucesso!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Delete quote from history
  const handleDeleteSavedQuote = async (id: string) => {
    const quoteToDelete = savedQuotes.find(q => q.id === id || q.quoteNumber === id);
    const updated = savedQuotes.filter(q => q.id !== id && q.quoteNumber !== id);
    setSavedQuotes(updated);
    localStorage.setItem('s_orcamentos', JSON.stringify(updated));

    if (quoteToDelete) {
      try {
        await db.from('cotacoes').delete().eq('numero', quoteToDelete.quoteNumber);
      } catch (err) {
        console.warn('Erro ao deletar cotação no Supabase:', err);
      }
    }
  };

  // Quick Description suggestions
  const QUICK_DESCRIPTIONS = [
    'Chapa de Aço 1020 Cortada Oxicorte CNC',
    'Chapa de Aço A36 Cortada a Plasma CNC',
    'Laser Chapa Aço Carbono 1020',
    'Barra Chata Aço SAE 1020 Cortada',
    'Disco Usinado com Furo Central',
    'Flange Cortada com Furação Industrial',
    'Tarugo Redondo Aço SAE 1045',
    'Barra Quadrada Trefilada SAE 1020',
    'Barra Sextavada Aço Carbono',
    'Eixo Trefilado Aço SAE 1045'
  ];

  // Current quote object for print modal
  const currentQuoteForModal: Quote = {
    id: numeroCotacao,
    quoteNumber: numeroCotacao,
    clientId: selectedClientId,
    clientName: clientName || 'Cliente Balcão',
    clientDocument: clientDocument,
    contactPerson: contactPerson,
    clientPhone: clientPhone,
    clientEmail: clientEmail,
    clientCity: clientCity,
    clientState: clientState,
    date: quoteDate,
    validityDays: validityDays,
    paymentTerms: paymentTerms,
    status: quoteStatus,
    items: items,
    discount: discountAmount,
    discountPercent: 0,
    shipping: shippingAmount,
    subtotalTotal: subtotalTotal,
    grandTotal: grandTotal,
    totalWeightKg: totalQuoteWeightKg,
    observations: observations,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Sync to parent on quote update
  useEffect(() => {
    if (onQuoteChange) {
      onQuoteChange(currentQuoteForModal);
    }
  }, [
    numeroCotacao,
    selectedClientId,
    clientName,
    clientDocument,
    contactPerson,
    clientPhone,
    clientEmail,
    clientCity,
    clientState,
    quoteDate,
    validityDays,
    paymentTerms,
    quoteStatus,
    items,
    discountAmount,
    shippingAmount,
    subtotalTotal,
    grandTotal,
    totalQuoteWeightKg,
    observations
  ]);

  return (
    <div className="space-y-8">
      
      {/* Toast Notifications */}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span className="text-xs font-semibold">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 bg-rose-600 text-white px-5 py-3 rounded-2xl shadow-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-xs font-semibold">{errorMessage}</span>
        </div>
      )}

      {/* Top Action Bar & Branding */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white flex items-center justify-center font-black text-xl shadow-md border border-indigo-500/30">
            UC
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">UsiCorte • Vendas & Orçamentos</h2>
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-extrabold uppercase tracking-wider rounded-full border border-indigo-200">
                Módulo Industrial
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Gerador de Propostas Comerciais, Lançamento de Itens, Cálculo de Peso (Kg) e Impressão de PDF
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleNewQuote}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Novo Orçamento
          </button>

          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            Histórico ({savedQuotes.length})
          </button>

          <button
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Visualizar / Imprimir PDF
          </button>
        </div>
      </div>

      {/* 1. CABEÇALHO (DADOS GERAIS DO ORÇAMENTO & CLIENTE) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                1. Cabeçalho • Dados Gerais & Cliente
              </h3>
              <p className="text-xs text-slate-400">Identificação do solicitante, data e condições comerciais</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-2 bg-slate-50 border border-slate-200 focus-within:border-indigo-500 focus-within:bg-white rounded-lg min-w-[200px] transition-all">
              <div className="flex items-center justify-between gap-1 mb-1">
                <label className="text-[10px] text-slate-500 font-bold block uppercase">
                  Cotação Nº (Editável)
                </label>
                <span className="text-[9px] text-indigo-600 font-semibold bg-indigo-50 px-1 py-0.2 rounded" title="Sugerido automaticamente com base no histórico. Totalmente liberado para edição manual.">
                  Auto / Manual
                </span>
              </div>

              <input
                id="quote-number-input"
                type="text"
                value={numeroCotacao}
                onChange={(e) => setNumeroCotacao(e.target.value)}
                placeholder="COT-2026-000020"
                title="Número da Cotação (pode ser alterado para qualquer valor ou formato que desejar)"
                className="w-full bg-transparent text-xs font-mono font-black text-indigo-700 outline-none focus:text-indigo-950"
              />
            </div>
            <select
              value={quoteStatus}
              onChange={(e) => setQuoteStatus(e.target.value as Quote['status'])}
              className={`px-3 py-2 border rounded-lg text-xs font-bold transition-all outline-hidden cursor-pointer shadow-xs ${
                quoteStatus === 'Pendente'
                  ? 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-500/20'
                  : quoteStatus === 'Aprovado'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300 ring-1 ring-emerald-500/20'
                  : quoteStatus === 'Rascunho'
                  ? 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-500/20'
                  : quoteStatus === 'Faturado'
                  ? 'bg-purple-50 text-purple-700 border-purple-300 ring-1 ring-purple-500/20'
                  : 'bg-rose-50 text-rose-700 border-rose-300 ring-1 ring-rose-500/20'
              }`}
              title="Status da Cotação"
            >
              <option value="Pendente">🔵 Pendente</option>
              <option value="Aprovado">🟢 Aprovado</option>
              <option value="Rascunho">🟡 Rascunho</option>
              <option value="Faturado">🟣 Faturado</option>
              <option value="Rejeitado">🔴 Rejeitado</option>
              <option value="Cancelado">⚪ Cancelado</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          
          {/* Seleção do Cliente (Autocomplete / Dropdown) */}
          <div className="md:col-span-6 space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-slate-700">
                Cliente / Empresa Cadastrada *
              </label>
              {onNavigateToClients && (
                <button
                  type="button"
                  onClick={onNavigateToClients}
                  className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                >
                  + Cadastrar Novo Cliente
                </button>
              )}
            </div>

            <select
              value={selectedClientId}
              onChange={(e) => handleClientSelect(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
            >
              <option value="">-- Selecione uma empresa ou preencha manualmente --</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.fantasyName ? `${c.fantasyName} (${c.name})` : c.name} • CNPJ: {c.document}
                </option>
              ))}
            </select>
          </div>

          {/* Nome Fantasia / Razão Social Livre */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Razão Social / Nome do Cliente</label>
            <input
              type="text"
              placeholder="Ex: Usinagem & Estruturas Brasil Ltda"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all font-medium"
            />
          </div>

          {/* CNPJ / CPF */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">CNPJ / CPF do Cliente</label>
            <input
              type="text"
              placeholder="00.000.000/0000-00"
              value={clientDocument}
              onChange={(e) => setClientDocument(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
            />
          </div>

          {/* Contato / Solicitante */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Contato / Solicitante</label>
            <input
              type="text"
              placeholder="Ex: Carlos Mecânica / Comprador"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
            />
          </div>

          {/* Telefone / WhatsApp */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Telefone / WhatsApp</label>
            <input
              type="text"
              placeholder="(00) 00000-0000"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
            />
          </div>

          {/* Data da Proposta */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Data do Orçamento</label>
            <input
              type="date"
              value={quoteDate}
              onChange={(e) => setQuoteDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
            />
          </div>

          {/* Condição de Pagamento */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Condições de Pagamento</label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
            >
              <option value="À Vista / Pix (3% Desc.)">À Vista / Pix (3% Desc.)</option>
              <option value="À Vista Antecipado">À Vista Antecipado</option>
              <option value="15 Dias Boleto">15 Dias Boleto</option>
              <option value="28 Dias Boleto">28 Dias Boleto</option>
              <option value="30 Dias no Boleto">30 Dias no Boleto</option>
              <option value="30 / 60 Dias Faturado">30 / 60 Dias Faturado</option>
              <option value="30 / 60 / 90 Dias">30 / 60 / 90 Dias</option>
              <option value="Cartão de Crédito em até 6x">Cartão de Crédito em até 6x</option>
            </select>
          </div>

          {/* Validade */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Validade (Dias)</label>
            <input
              type="number"
              min="1"
              max="90"
              value={validityDays}
              onChange={(e) => setValidityDays(parseInt(e.target.value) || 10)}
              className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-center text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
            />
          </div>

          {/* Cidade/UF */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">Localidade / UF</label>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Cidade"
                value={clientCity}
                onChange={(e) => setClientCity(e.target.value)}
                className="col-span-2 px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 outline-hidden"
              />
              <input
                type="text"
                placeholder="UF"
                maxLength={2}
                value={clientState}
                onChange={(e) => setClientState(e.target.value.toUpperCase())}
                className="px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold uppercase text-center text-slate-800 outline-hidden"
              />
            </div>
          </div>

        </div>
      </div>

      {/* 2. FORMULÁRIO DE ADIÇÃO DE ITEM & CÁLCULO DE PESO */}
      <div id="item-input-form" className="bg-white rounded-2xl border-2 border-indigo-200/90 p-6 shadow-sm space-y-6 relative overflow-hidden">
        
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                2. Lançamento de Itens • Medidas, Constante & Cálculo de Peso (Kg)
                {editingItemId && (
                  <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">
                    Modo Edição de Item
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">Insira as especificações geométricas para calcular o Peso em Kg e Subtotal em R$</p>
            </div>
          </div>

          {/* Quick presets shortcut button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTriggerAutoCalc}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-indigo-200 transition-colors cursor-pointer"
              title="Calcular preço e peso teórico automaticamente com base nas dimensões e constante"
            >
              <Calculator className="w-3.5 h-3.5 text-indigo-600" />
              Cálculo Automático UsiCorte
            </button>
          </div>
        </div>

        {/* GEOMETRY TYPE SELECTOR TABS (FÓRMULAS USICORTE) */}
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-indigo-600" />
              Tipo de Geometria & Regras de Cálculo UsiCorte:
            </span>
            <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200 shadow-2xs">
              {itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA'
                ? 'Bucha / Tubo: Peso = ((ØExt² - ØInt²) × Comp × k / 1000).toFixed(3) | Unit = Peso × R$/Kg'
                : itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO'
                ? 'Maciço / Redondo: Peso = (d² × Comp × k / 1000).toFixed(3) | Unit = Peso × R$/Kg'
                : 'Chapa / Retângulo: Peso = (Esp × Larg × Comp × k / 1000).toFixed(3) | Unit = Peso × R$/Kg'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Tab 1: Chapa */}
            <button
              type="button"
              onClick={() => {
                setItemGeometryType('chapa');
                setItemDiameter(''); // Diâmetro zerado/desabilitado na Chapa
                const newConstantSelect = (itemConstantSelect === 'redondo_aco' || itemConstantSelect === 'tubo_mecanico') ? 'chapa_aco' : itemConstantSelect;
                const newConstant = (itemConstantSelect === 'redondo_aco' || itemConstantSelect === 'tubo_mecanico') ? '0.00785' : itemConstant;
                if (itemConstantSelect === 'redondo_aco' || itemConstantSelect === 'tubo_mecanico') {
                  setItemConstantSelect('chapa_aco');
                  setItemConstant('0.00785');
                }
                updateCascadingUnitPrice(
                  itemPricePerKg,
                  newConstant,
                  'chapa',
                  itemWidthMm,
                  itemLengthMm,
                  '',
                  itemThickness
                );
              }}
              className={`p-2.5 rounded-xl text-xs font-bold text-left border transition-all cursor-pointer flex items-center gap-3 ${
                itemGeometryType === 'chapa' || itemGeometryType === 'CHAPA_RETANGULO'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${itemGeometryType === 'chapa' || itemGeometryType === 'CHAPA_RETANGULO' ? 'bg-indigo-500' : 'bg-slate-100 text-slate-600'}`}>
                <Box className="w-4 h-4" />
              </div>
              <div>
                <div className="font-extrabold">1. Chapa / Retângulo</div>
                <div className={`text-[10px] font-semibold ${itemGeometryType === 'chapa' || itemGeometryType === 'CHAPA_RETANGULO' ? 'text-indigo-100' : 'text-indigo-600'}`}>
                  (Esp × Larg × Comp × k) / 1000
                </div>
              </div>
            </button>

            {/* Tab 2: Maciço */}
            <button
              type="button"
              onClick={() => {
                setItemGeometryType('macico');
                setItemThickness(''); // Espessura zerada/desabilitada no Maciço
                setItemWidthMm('');   // Largura zerada/desabilitada no Maciço
                const newConstantSelect = (itemConstantSelect === 'chapa_aco' || itemConstantSelect === 'tubo_mecanico') ? 'redondo_aco' : itemConstantSelect;
                const newConstant = (itemConstantSelect === 'chapa_aco' || itemConstantSelect === 'tubo_mecanico') ? '0.00617' : itemConstant;
                if (itemConstantSelect === 'chapa_aco' || itemConstantSelect === 'tubo_mecanico') {
                  setItemConstantSelect('redondo_aco');
                  setItemConstant('0.00617');
                }
                updateCascadingUnitPrice(
                  itemPricePerKg,
                  newConstant,
                  'macico',
                  '',
                  itemLengthMm,
                  itemDiameter,
                  ''
                );
              }}
              className={`p-2.5 rounded-xl text-xs font-bold text-left border transition-all cursor-pointer flex items-center gap-3 ${
                itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO' ? 'bg-indigo-500' : 'bg-slate-100 text-slate-600'}`}>
                <CircleDot className="w-4 h-4" />
              </div>
              <div>
                <div className="font-extrabold">2. Maciço (Redondo / Inox)</div>
                <div className={`text-[10px] font-semibold ${itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO' ? 'text-indigo-100' : 'text-indigo-600'}`}>
                  (d² × Comp × k) / 1000
                </div>
              </div>
            </button>

            {/* Tab 3: Bucha / Tubo Mecânico */}
            <button
              type="button"
              onClick={() => {
                setItemGeometryType('bucha');
                setItemWidthMm(''); // Largura zerada/desabilitada na Bucha/Tubo
                setItemConstantSelect('tubo_mecanico');
                setItemConstant('0.00617');
                const newPriceKg = (!itemPricePerKg || itemPricePerKg === '22,00') ? '24,00' : itemPricePerKg;
                if (!itemPricePerKg || itemPricePerKg === '22,00') {
                  setItemPricePerKg('24,00');
                }
                updateCascadingUnitPrice(
                  newPriceKg,
                  '0.00617',
                  'bucha',
                  '',
                  itemLengthMm,
                  itemDiameter,
                  itemThickness
                );
              }}
              className={`p-2.5 rounded-xl text-xs font-bold text-left border transition-all cursor-pointer flex items-center gap-3 ${
                itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/70'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA' ? 'bg-indigo-500' : 'bg-slate-100 text-slate-600'}`}>
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="font-extrabold">3. Tubo Mecânico / Bucha</div>
                <div className={`text-[10px] font-semibold ${itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA' ? 'text-indigo-100' : 'text-indigo-600'}`}>
                  (ØExt² - ØInt²) × Comp × k / 1000
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Form Inputs Grid - 3 Linhas Conforme Estrutura do Usuário */}
        <form onSubmit={handleSaveItem} className="space-y-4">
          
          {/* Linha 1 */}
          <div className="form-row flex flex-col md:flex-row gap-2.5 items-end w-full">
            
            {/* Constante / Material com Autocompletar Inline e Busca Dinâmica */}
            <div className="field relative w-full md:w-[26%] shrink-0 space-y-1" ref={constantComboboxRef}>
              <label htmlFor="constante" className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1 text-indigo-950 truncate">
                  <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  Constante / Material *
                </span>
                <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1 rounded shrink-0">
                  k={currentFormConstant}
                </span>
              </label>

              <div className="relative">
                <input
                  type="text"
                  id="constante"
                  ref={constantInputRef}
                  placeholder="Ex: BRONZE REDONDO, CHAPA, BUCHA..."
                  value={itemConstantName}
                  autoComplete="off"
                  onChange={handleConstantInputChange}
                  onFocus={(e) => {
                    if (e.target && typeof e.target.select === 'function') {
                      e.target.select();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setIsConstantOpen(false);
                      const input = e.currentTarget;
                      input.setSelectionRange(input.value.length, input.value.length);
                      
                      // Sincroniza se houver correspondência exata ou aproximada
                      const matData = DADOS_MATERIAIS_MAP[itemConstantName] || 
                        DADOS_MATERIAIS_MAP[itemConstantName.toLowerCase()] ||
                        MATERIAL_PROFILES.find(p => p.name.toLowerCase() === itemConstantName.toLowerCase());
                      if (matData) {
                        const profileId = 'id' in matData ? matData.id : 'chapa';
                        handleConstantSelectChange(profileId);
                      }

                      focusNextField('diametro');
                    } else if (e.key === 'Escape') {
                      setIsConstantOpen(false);
                    }
                  }}
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 hover:border-indigo-500 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-800 shadow-2xs transition-all outline-hidden"
                />

                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setIsConstantOpen(!isConstantOpen)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 cursor-pointer p-0.5"
                  title="Abrir catálogo de materiais"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isConstantOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                </button>
              </div>

              {/* Dropdown Menu com Busca Dinâmica (Select2 style) */}
              {isConstantOpen && (
                <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2.5 max-h-[380px] overflow-hidden flex flex-col w-[320px] sm:w-[360px] animate-in fade-in slide-in-from-top-2 duration-150">
                  
                  {/* Search Bar inside Select2 popup */}
                  <div className="relative mb-2 shrink-0">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar material, perfil, k..."
                      value={constantSearchQuery}
                      onChange={(e) => setConstantSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (filteredMaterialProfiles.length > 0) {
                            handleSelectMaterialProfile(filteredMaterialProfiles[0]);
                          }
                        } else if (e.key === 'Escape') {
                          setIsConstantOpen(false);
                        }
                      }}
                      className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                      autoFocus
                    />
                    {constantSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setConstantSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="flex gap-1 overflow-x-auto pb-1.5 mb-1.5 border-b border-slate-100 shrink-0 text-[10px] no-scrollbar">
                    {[
                      { id: 'ALL', label: 'Todos' },
                      { id: 'chapa', label: 'Chapas' },
                      { id: 'macico', label: 'Maciços' },
                      { id: 'bucha', label: 'Tubos / Buchas' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setConstantCategoryFilter(cat.id)}
                        className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          constantCategoryFilter === cat.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Material Options List */}
                  <div className="overflow-y-auto space-y-1 pr-1 flex-1 max-h-[220px]">
                    {filteredMaterialProfiles.length > 0 ? (
                      filteredMaterialProfiles.map((profile) => {
                        const isSelected = itemConstantSelect === profile.id;
                        return (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => handleSelectMaterialProfile(profile)}
                            className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between gap-2.5 cursor-pointer border ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                                : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-900">{profile.name}</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 capitalize">
                                  {profile.tipo === 'macico' ? 'Maciço' : profile.tipo === 'bucha' ? 'Bucha' : 'Chapa'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[9px] text-slate-600 mt-0.5">
                                <span className="font-mono text-indigo-600 font-bold">k={profile.k}</span>
                                <span>•</span>
                                <span className="font-mono text-emerald-700 font-bold">R$ {profile.defaultPriceKg.toFixed(2).replace('.', ',')}/Kg</span>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-xs">
                        Nenhum material encontrado para "{constantSearchQuery}".
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-600 shrink-0">
                    <span>{filteredMaterialProfiles.length} materiais disponíveis</span>
                    <button
                      type="button"
                      onClick={() => setIsConstantOpen(false)}
                      className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Diâmetro (Ø) / Diâmetro Ext. (Ø) */}
            <div className="field w-full md:w-[8.5%] md:min-w-[72px] shrink-0 space-y-1">
              <label id="lbl-diametro" htmlFor="diametro" className="block text-xs font-bold text-slate-700 flex items-center justify-between" title={itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA' ? 'Diâmetro Ext. (Ø)' : 'Diâmetro (Ø)'}>
                <span className="flex items-center gap-1 text-slate-800 truncate">
                  <CircleDot className="w-3 h-3 text-indigo-600 shrink-0" />
                  {itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA' ? 'Ø Ext.' : 'Diâm (Ø)'}
                </span>
                {effectiveDiameterMm > 0 && (
                  <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 px-1 rounded shrink-0">
                    {effectiveDiameterMm}
                  </span>
                )}
              </label>
              <input
                type="text"
                id="diametro"
                placeholder={itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA' ? 'Ø Ext' : 'Ø mm'}
                value={itemDiameter}
                disabled={itemGeometryType === 'chapa' || itemGeometryType === 'CHAPA_RETANGULO'}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemDiameter(val);
                  updateCascadingUnitPrice(
                    itemPricePerKg,
                    itemConstant,
                    itemGeometryType,
                    itemWidthMm,
                    itemLengthMm,
                    val,
                    itemThickness
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA') {
                      focusNextField('espessura');
                    } else {
                      focusNextField('comprimento');
                    }
                  }
                }}
                className={`w-full px-2 py-2 border rounded-xl text-xs font-mono font-bold text-center outline-hidden transition-all ${
                  itemGeometryType === 'chapa' || itemGeometryType === 'CHAPA_RETANGULO'
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />
            </div>

            {/* Espessura (mm) / Diâmetro Int. (Furo) */}
            <div className="field w-full md:w-[8.5%] md:min-w-[72px] shrink-0 space-y-1">
              <label id="lbl-espessura" htmlFor="espessura" className="block text-xs font-bold text-slate-700 flex items-center justify-between" title={itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA' ? 'Diâmetro Int. (Furo)' : 'Espessura (mm)'}>
                <span className="flex items-center gap-1 text-slate-800 truncate">
                  <Ruler className="w-3 h-3 text-indigo-600 shrink-0" />
                  {itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA' ? 'Ø Int.' : 'Espess.'}
                </span>
                {effectiveThicknessMm > 0 && (
                  <span className="text-[9px] font-mono text-indigo-700 bg-indigo-50 px-1 rounded shrink-0">
                    {effectiveThicknessMm}
                  </span>
                )}
              </label>
              <input
                type="text"
                id="espessura"
                placeholder={itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA' ? 'Ø Int' : 'Esp mm'}
                value={itemThickness}
                disabled={itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO'}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemThickness(val);
                  updateCascadingUnitPrice(
                    itemPricePerKg,
                    itemConstant,
                    itemGeometryType,
                    itemWidthMm,
                    itemLengthMm,
                    itemDiameter,
                    val
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (itemGeometryType === 'chapa') {
                      focusNextField('largura');
                    } else {
                      focusNextField('comprimento');
                    }
                  }
                }}
                className={`w-full px-2 py-2 border rounded-xl text-xs font-mono font-bold text-center outline-hidden transition-all ${
                  itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO'
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />
            </div>

            {/* Largura (mm) */}
            <div className="field w-full md:w-[6%] md:min-w-[56px] shrink-0 space-y-1">
              <label htmlFor="largura" className="block text-xs font-bold text-slate-700 flex items-center justify-between" title="Largura (mm)">
                <span className="text-slate-800 truncate">Larg (mm)</span>
              </label>
              <input
                type="text"
                id="largura"
                placeholder="0"
                value={itemWidthMm}
                disabled={itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO' || itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA'}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemWidthMm(val);
                  updateCascadingUnitPrice(
                    itemPricePerKg,
                    itemConstant,
                    itemGeometryType,
                    val,
                    itemLengthMm,
                    itemDiameter,
                    itemThickness
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField('comprimento');
                  }
                }}
                className={`w-full px-2 py-2 border rounded-xl text-xs font-mono font-bold text-center outline-hidden transition-all ${
                  itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO' || itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA'
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />
            </div>

            {/* Comprimento (mm) */}
            <div className="field w-full md:w-[6%] md:min-w-[56px] shrink-0 space-y-1">
              <label htmlFor="comprimento" className="block text-xs font-bold text-slate-700 flex items-center justify-between" title="Comprimento (mm)">
                <span className="text-slate-800 truncate">Comp (mm)</span>
              </label>
              <input
                type="text"
                id="comprimento"
                placeholder="0"
                value={itemLengthMm}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value;
                  setItemLengthMm(val);
                  updateCascadingUnitPrice(
                    itemPricePerKg,
                    itemConstant,
                    itemGeometryType,
                    itemWidthMm,
                    val,
                    itemDiameter,
                    itemThickness
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField('descricao');
                  }
                }}
                className="w-full px-2 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
              />
            </div>

            {/* Descrição do Produto / Serviço Combobox (Estilo Select2 Dinâmico) */}
            <div className="field relative w-full md:flex-1 min-w-[220px] space-y-1" ref={descriptionComboboxRef}>
              <label htmlFor="descricao" className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="truncate">Descrição do Produto / Serviço *</span>
                <button
                  type="button"
                  onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                  className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-all flex items-center gap-1 cursor-pointer"
                  title="Abrir catálogo com busca"
                >
                  <Search className="w-2.5 h-2.5" />
                  {isDescriptionOpen ? 'Fechar Lista' : 'Combobox'}
                </button>
              </label>
              
              <div className="relative">
                <input
                  ref={descriptionInputRef}
                  type="text"
                  id="descricao"
                  placeholder="Ex: CONF DESENHO, TREFILADO SAE 1045, ALUMINIO..."
                  value={itemDescription}
                  autoComplete="off"
                  onChange={handleDescriptionInputChange}
                  onFocus={(e) => {
                    if (e.target && typeof e.target.select === 'function') {
                      e.target.select();
                    }
                    if (!itemDescription) {
                      setIsDescriptionOpen(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault(); // Impede submeter o formulário
                      setIsDescriptionOpen(false);
                      
                      // Mova o cursor para o final do texto
                      const input = e.currentTarget;
                      input.setSelectionRange(input.value.length, input.value.length);

                      // Sincroniza preset se existir
                      const matched = PRODUCT_DESCRIPTION_PRESETS.find(
                        p => p.name.toLowerCase() === itemDescription.toLowerCase()
                      );
                      if (matched) {
                        handleSelectDescriptionPreset(matched);
                      }

                      // Pula o foco para o próximo campo (observação)
                      focusNextField('observacao');
                    } else if (e.key === 'Escape') {
                      setIsDescriptionOpen(false);
                    }
                  }}
                  className="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all uppercase placeholder:normal-case placeholder:font-normal auto-inline"
                  required
                />
                <button
                  type="button"
                  onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                  title="Abrir opções do combobox"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDescriptionOpen ? 'rotate-180 text-indigo-600' : ''}`} />
                </button>
              </div>

              {/* Combobox Dropdown Menu (Select2 style) */}
              {isDescriptionOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2.5 max-h-[380px] overflow-hidden flex flex-col min-w-[320px] md:min-w-[420px] animate-in fade-in slide-in-from-top-2 duration-150">
                  
                  {/* Search bar inside dropdown */}
                  <div className="relative mb-2 shrink-0">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome, SAE, norma, material..."
                      value={descriptionSearchQuery}
                      onChange={(e) => setDescriptionSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (filteredDescriptionPresets.length > 0) {
                            handleSelectDescriptionPreset(filteredDescriptionPresets[0]);
                            focusNextField('observacao');
                          } else {
                            setIsDescriptionOpen(false);
                            focusNextField('observacao');
                          }
                        }
                      }}
                      className="w-full pl-8 pr-7 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-hidden focus:border-indigo-500 focus:bg-white"
                      autoFocus
                    />
                    {descriptionSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setDescriptionSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Category filter tabs */}
                  <div className="flex gap-1 overflow-x-auto pb-1.5 mb-1.5 border-b border-slate-100 shrink-0 text-[10px] no-scrollbar">
                    {[
                      { id: 'ALL', label: 'Todos' },
                      { id: 'Trefilados & Eixos', label: 'Trefilados / Aços' },
                      { id: 'Chapas & Desenhos', label: 'Chapas / Desenho' },
                      { id: 'Inox', label: 'Inox' },
                      { id: 'Bronze & Latão', label: 'Bronze & Latão' },
                      { id: 'Tubos & Buchas', label: 'Tubos / Buchas' },
                      { id: 'Alumínio & Plásticos', label: 'Alumínio / Plásticos' }
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setDescriptionCategoryFilter(cat.id)}
                        className={`px-2 py-0.5 rounded-full font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          descriptionCategoryFilter === cat.id
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom text button if user typed something not in list */}
                  {itemDescription.trim() && !PRODUCT_DESCRIPTION_PRESETS.some(p => p.name.toLowerCase() === itemDescription.toLowerCase()) && (
                    <div className="mb-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDescriptionOpen(false);
                          focusNextField('observacao');
                        }}
                        className="w-full text-left p-2 rounded-xl bg-indigo-50/80 border border-indigo-200 hover:bg-indigo-100/80 transition-colors flex items-center justify-between gap-2 text-xs text-indigo-900 font-bold cursor-pointer"
                      >
                        <div className="truncate">
                          <span className="text-[10px] text-indigo-600 font-normal block">Usar descrição digitada:</span>
                          <span className="font-extrabold uppercase">"{itemDescription}"</span>
                        </div>
                        <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                      </button>
                    </div>
                  )}

                  {/* Preset Items List */}
                  <div className="overflow-y-auto space-y-1 pr-1 flex-1 max-h-[220px]">
                    {filteredDescriptionPresets.length > 0 ? (
                      filteredDescriptionPresets.map((preset) => {
                        const isSelected = itemDescription === preset.name;
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              handleSelectDescriptionPreset(preset);
                              focusNextField('observacao');
                            }}
                            className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between gap-2.5 cursor-pointer border ${
                              isSelected
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold shadow-2xs'
                                : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                                  {preset.badge}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-600 truncate mt-0.5">
                                {preset.description}
                              </div>
                              <div className="flex items-center gap-2 text-[9px] text-slate-600 mt-0.5">
                                <span className="font-mono text-indigo-600 font-bold">k={preset.constant}</span>
                                <span>•</span>
                                <span className="font-mono text-emerald-700 font-bold">R$ {preset.defaultPriceKg.toFixed(2).replace('.', ',')}/Kg</span>
                                <span>•</span>
                                <span className="capitalize text-slate-600">{preset.geometryType === 'macico' ? 'Maciço' : preset.geometryType === 'bucha' ? 'Bucha' : 'Chapa'}</span>
                              </div>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-xs">
                        Nenhum produto encontrado para "{descriptionSearchQuery}".
                      </div>
                    )}
                  </div>
                  
                  {/* Footer summary */}
                  <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-600 shrink-0">
                    <span>{filteredDescriptionPresets.length} itens no catálogo</span>
                    <button
                      type="button"
                      onClick={() => setIsDescriptionOpen(false)}
                      className="text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Linha 2 - Observação e Anexo de Desenho/DXF */}
          <div className="form-row grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
            <div className="field md:col-span-8 space-y-1">
              <label htmlFor="observacao" className="block text-xs font-bold text-slate-700">
                Observação
              </label>
              <input
                type="text"
                id="observacao"
                placeholder="Ex: CONF DESENHO, NYLON, TREFILADO SAE 1045..."
                value={itemNotes}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setItemNotes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField('qtd');
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all shadow-2xs"
              />
            </div>

            {/* Anexo de Imagem / Arquivo CAD .DXF */}
            <div className="field md:col-span-4 space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Desenho / Arquivo .DXF
                </label>
                {itemDrawingImage && (
                  <button
                    type="button"
                    onClick={() => setItemDrawingImage(null)}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                  >
                    Remover
                  </button>
                )}
              </div>

              <input
                type="file"
                ref={itemFileInputRef}
                accept="image/*,.dxf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const medidasFormatadas = formatarMedidasLimpa({
                      geometryType: itemGeometryType,
                      diameter: itemDiameter.trim(),
                      thickness: itemThickness.trim(),
                      measure: itemThickness.trim() || itemDiameter.trim(),
                      widthMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
                      lengthMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
                      widthLength: itemWidthLength.trim(),
                      diameterMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
                      thicknessMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined
                    });
                    const base64 = await fileToDxfImage(file, {
                      medida: medidasFormatadas || undefined,
                      material: itemConstantName.trim() || itemDescription,
                      observacao: itemNotes,
                      descricao: itemDescription
                    });
                    setItemDrawingImage(base64);
                    setSuccessMessage(isDxfFile(file) ? 'Arquivo DXF convertido em vetor com sucesso!' : 'Imagem carregada com sucesso!');
                    setTimeout(() => setSuccessMessage(null), 3000);
                  } catch (err) {
                    console.error('Erro ao processar imagem ou DXF:', err);
                    setErrorMessage('Falha ao processar arquivo. Verifique o formato.');
                    setTimeout(() => setErrorMessage(null), 3500);
                  }
                  e.target.value = '';
                }}
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => itemFileInputRef.current?.click()}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                    itemDrawingImage
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                  title="Aceita fotos (PNG, JPG) e arquivos CAD (.dxf) com conversão vetorial automática"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{itemDrawingImage ? 'Alterar .DXF / Imagem' : 'Anexar .DXF / Imagem'}</span>
                </button>

                {itemDrawingImage && (
                  <div className="w-9 h-9 rounded-lg border border-slate-300 bg-slate-100 p-0.5 overflow-hidden flex items-center justify-center shrink-0" title="Miniatura do desenho técnico / DXF">
                    <img src={itemDrawingImage} alt="Preview" className="max-w-full max-h-full object-contain" />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Linha 3 */}
          <div className="form-row grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-3.5 items-end">
            
            {/* Quantidade (QTD) */}
            <div className="field lg:col-span-1 space-y-1">
              <label htmlFor="qtd" className="block text-xs font-bold text-slate-700">
                Qtd (Peças) *
              </label>
              <input
                type="number"
                id="qtd"
                min="1"
                step="any"
                value={itemQuantity}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setItemQuantity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField('precoKg');
                  }
                }}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-center text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
                required
              />
            </div>

            {/* Preço / Kg (R$) */}
            <div className="field lg:col-span-2 space-y-1">
              <label htmlFor="precoKg" className="block text-xs font-bold text-emerald-800 flex items-center justify-between">
                <span>Preço / Kg (R$) *</span>
                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">R$/Kg</span>
              </label>
              <div className="flex items-center w-full bg-emerald-50/70 border-2 border-emerald-300 rounded-xl focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all overflow-hidden px-2.5 py-1.5">
                <span className="text-xs font-mono font-black text-emerald-700 select-none mr-1.5 shrink-0">R$</span>
                <input
                  type="text"
                  id="precoKg"
                  placeholder="22,00"
                  value={itemPricePerKg}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => handlePricePerKgChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      focusNextField('btn-adicionar');
                    }
                  }}
                  className="w-full bg-transparent text-xs font-mono font-black text-emerald-950 outline-none border-none p-0 focus:ring-0"
                  required
                />
              </div>
            </div>

            {/* Valor Unitário (R$) */}
            <div className="field field-resultado lg:col-span-2 space-y-1">
              <label htmlFor="valorUnitario" className="block text-xs font-bold text-indigo-900 flex items-center justify-between">
                <span>Valor Unitário (R$)</span>
                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1 rounded">Inteiro ↑</span>
              </label>
              <input
                type="text"
                id="valorUnitario"
                readOnly
                value={currentFormUnitPrice > 0 ? `R$ ${formatNumberBR(currentFormUnitPrice, 2)}` : 'R$ 0,00'}
                className="w-full px-3 py-2 bg-indigo-50/70 border border-indigo-300 rounded-xl text-xs font-mono font-bold text-indigo-950 cursor-not-allowed outline-none"
              />
            </div>

            {/* Valor Total (R$) */}
            <div className="field field-resultado lg:col-span-2 space-y-1">
              <label htmlFor="valorTotal" className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Valor Total (R$)</span>
                <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1 rounded">Inteiro ↑</span>
              </label>
              <input
                type="text"
                id="valorTotal"
                readOnly
                value={currentFormSubtotal > 0 ? `R$ ${formatNumberBR(currentFormSubtotal, 2)}` : 'R$ 0,00'}
                className="w-full px-3 py-2 bg-rose-50/70 border border-rose-300 rounded-xl text-xs font-mono font-black text-rose-700 cursor-not-allowed outline-none"
              />
            </div>

            {/* Peso Estimado (KG) */}
            <div className="field field-resultado lg:col-span-2 space-y-1">
              <label htmlFor="pesoEstimado" className="block text-xs font-bold text-emerald-800 flex items-center justify-between">
                <span>Peso Estimado (KG)</span>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">3 casas</span>
              </label>
              <input
                type="text"
                id="pesoEstimado"
                readOnly
                value={currentFormTotalWeightKg > 0 ? `${formatNumberBR(currentFormTotalWeightKg, 3)} KG` : '0,000 KG'}
                className="w-full px-3 py-2 bg-emerald-50/70 border border-emerald-300 rounded-xl text-xs font-mono font-black text-emerald-950 text-center cursor-not-allowed outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="field lg:col-span-3 flex items-center gap-2">
              {/* Legacy Quick Action Buttons */}
              <button
                type="submit"
                id="btn-adicionar"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveItem(e);
                  }
                }}
                className="w-10 h-10 bg-indigo-800 hover:bg-indigo-900 text-white rounded-md flex items-center justify-center font-black text-xl shadow-md border border-indigo-950 transition-transform active:scale-95 cursor-pointer shrink-0"
                title="Adicionar Item (+) [ENTER]"
              >
                +
              </button>

              <button
                type="button"
                id="btn-limpar-form"
                onClick={resetItemForm}
                className="w-10 h-10 bg-red-700 hover:bg-red-800 text-white rounded-md flex items-center justify-center font-black text-base shadow-md border border-red-900 transition-transform active:scale-95 cursor-pointer shrink-0"
                title="Limpar formulário"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="submit"
                id="btn-salvar-item"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveItem(e);
                  }
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all truncate ${
                  editingItemId
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                <PlusCircle className="w-4 h-4 shrink-0" />
                <span>{editingItemId ? 'Atualizar' : 'Salvar Item'}</span>
              </button>
            </div>

          </div>

          {/* Live Status Calculation Bar */}
          <div className="p-3 bg-gradient-to-r from-emerald-50 via-slate-50 to-indigo-50 rounded-xl border border-indigo-200/80 shadow-2xs space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="text-indigo-950 uppercase tracking-wide text-[11px]">Fórmula UsiCorte em Tempo Real:</span>
              </div>
              <div className="text-[10px] font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">
                {itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA'
                  ? 'Peso = ((ØExt² - ØInt²) × Comp × k / 1000).toFixed(3) | Unitário = Math.ceil(Peso × R$/Kg) | Total = Math.ceil(Unitário × Qtd)'
                  : itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO'
                  ? 'Peso = (d² × Comp × k / 1000).toFixed(3) | Unitário = Math.ceil(Peso × R$/Kg) | Total = Math.ceil(Unitário × Qtd)'
                  : 'Peso = (Esp × Larg × Comp × k / 1000).toFixed(3) | Unitário = Math.ceil(Peso × R$/Kg) | Total = Math.ceil(Unitário × Qtd)'}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA' ? (
                <>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">ØExt:</span>
                    <b>{effectiveDiameterMm > 0 ? `${effectiveDiameterMm}mm` : '0mm'}</b>
                  </div>
                  <span className="font-bold text-slate-400">-</span>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">ØInt:</span>
                    <b>{effectiveThicknessMm > 0 ? `${effectiveThicknessMm}mm` : '0mm'}</b>
                  </div>
                  <span className="font-bold text-slate-400">×</span>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">Comp:</span>
                    <b>{effectiveLengthMm}mm</b>
                  </div>
                  <span className="font-bold text-slate-400">×</span>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">k:</span>
                    <b>{currentFormConstant}</b>
                  </div>
                </>
              ) : itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO' ? (
                <>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">d:</span>
                    <b>{effectiveDiameterMm > 0 ? `${effectiveDiameterMm}mm` : (effectiveThicknessMm > 0 ? `${effectiveThicknessMm}mm` : '0mm')}</b>
                  </div>
                  <span className="font-bold text-slate-400">×</span>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">d:</span>
                    <b>{effectiveDiameterMm > 0 ? `${effectiveDiameterMm}mm` : (effectiveThicknessMm > 0 ? `${effectiveThicknessMm}mm` : '0mm')}</b>
                  </div>
                  <span className="font-bold text-slate-400">×</span>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">Comp:</span>
                    <b>{effectiveLengthMm}mm</b>
                  </div>
                  <span className="font-bold text-slate-400">×</span>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">k:</span>
                    <b>{currentFormConstant}</b>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">Esp:</span>
                    <b>{effectiveThicknessMm > 0 ? `${effectiveThicknessMm}mm` : (effectiveDiameterMm > 0 ? `${effectiveDiameterMm}mm` : '1mm')}</b>
                  </div>
                  <span className="font-bold text-slate-400">×</span>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">Larg:</span>
                    <b>{effectiveWidthMm}mm</b>
                  </div>
                  <span className="font-bold text-slate-400">×</span>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">Comp:</span>
                    <b>{effectiveLengthMm}mm</b>
                  </div>
                  <span className="font-bold text-slate-400">×</span>
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                    <span className="text-[10px] text-slate-400 font-sans">k:</span>
                    <b>{currentFormConstant}</b>
                  </div>
                </>
              )}
              <span className="font-bold text-slate-400">÷ 1000 =</span>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-50 rounded border border-amber-300 font-mono font-black text-amber-900">
                <span className="text-[10px] text-amber-600 font-sans">Peso:</span>
                <span>{formatWeightKg(currentFormUnitWeightKg, 3)}</span>
              </div>
              <span className="font-bold text-slate-400">×</span>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-700 text-white rounded font-mono font-bold">
                <span className="text-[10px] text-emerald-200 font-sans">R$/Kg:</span>
                <span>R$ {formatNumberBR(currentFormPriceKg, 2)}</span>
              </div>
              <span className="font-bold text-slate-400">=</span>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 rounded border border-indigo-200 font-mono font-extrabold text-indigo-950">
                <span className="text-[10px] text-indigo-500 font-sans">Unit:</span>
                <span>{formatCurrency(currentFormUnitPrice)}</span>
              </div>
              <span className="font-bold text-slate-400">×</span>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded border border-slate-200 font-mono text-slate-800">
                <span className="text-[10px] text-slate-400 font-sans">Qtd:</span>
                <b>{currentFormQty}</b>
              </div>
              <span className="font-bold text-slate-400">=</span>
              <div className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-600 text-white rounded font-mono font-black text-xs shadow-xs sm:ml-auto">
                <span className="text-[10px] text-emerald-100 font-sans uppercase">Total:</span>
                <span>{formatCurrency(currentFormSubtotal)}</span>
              </div>
            </div>
          </div>

        </form>

      </div>

      {/* 3. TABELA DE ITENS LANÇADOS COM COLUNA DE PESO TOTAL (KG) E PREÇO/KG */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                3. Tabela de Itens Lançados ({items.length})
              </h3>
              <p className="text-xs text-slate-400">Produtos, serviços, preços por Kg, pesos em Kg e valores inclusos nesta cotação</p>
            </div>
          </div>

          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (confirm('Deseja realmente limpar todos os itens deste orçamento?')) {
                    setItems([]);
                    resetItemForm();
                  }
                }}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpar Todos os Itens
              </button>
            </div>
          )}
        </div>

        {/* Dynamic Responsive Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900 text-slate-200 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3">Material</th>
                <th className="py-3 px-3">Medidas / Dimensões</th>
                <th className="py-3 px-3">Descrição / Obs</th>
                <th className="py-3 px-3 text-center">Const.</th>
                <th className="py-3 px-3 text-right text-emerald-300 font-bold bg-slate-800/90">Preço / Kg</th>
                <th className="py-3 px-3 text-right">Valor Unitário</th>
                <th className="py-3 px-3 text-center w-12">Qtd</th>
                <th className="py-3 px-3 text-right text-emerald-300 font-bold bg-slate-800/80">Peso Total (Kg)</th>
                <th className="py-3 px-3 text-right font-bold w-28">Subtotal</th>
                <th className="py-3 px-3 text-center w-24">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <div className="space-y-2">
                      <Layers className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-600">Nenhum item adicionado ainda</p>
                      <p className="text-[11px] text-slate-400">
                        Preencha o formulário acima e clique em <b>"Adicionar Item"</b> para lançar produtos com cálculo automático por Kg.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const effectiveItemPriceKg = item.pricePerKg !== undefined 
                    ? item.pricePerKg 
                    : (item.unitWeightKg && item.unitWeightKg > 0 ? item.unitPrice / item.unitWeightKg : 0);
                  const produtoMaterial = item.constanteNome || item.constantName || item.material || 'MATERIAL';
                  const medidasFormatadas = formatarMedidasLimpa(item);

                  return (
                    <tr 
                      key={item.id} 
                      className={`hover:bg-slate-50/90 transition-colors ${
                        editingItemId === item.id ? 'bg-amber-50/70 border-l-4 border-l-amber-500' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold text-[11px]">
                          {produtoMaterial}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                        <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 font-medium">
                          {medidasFormatadas}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          {(item.drawingImage || item.fotoDesenho) && (
                            <div className="w-6 h-6 rounded border border-indigo-200 bg-indigo-50/50 p-0.5 overflow-hidden flex items-center justify-center shrink-0" title="Desenho técnico / CAD anexado">
                              <img src={item.drawingImage || item.fotoDesenho} alt="CAD" className="max-w-full max-h-full object-contain" />
                            </div>
                          )}
                          <div>
                            <span>{item.description || item.descricao || '-'}</span>
                            {(item.notes || item.observacao) && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                Obs: {item.notes || item.observacao}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-600 font-bold">
                        {item.constant || '7.85'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/30 whitespace-nowrap">
                        R$ {formatNumberBR(effectiveItemPriceKg, 2)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700 font-bold">
                        {formatCurrency(item.unitPrice || item.valorUnitario || 0)}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-slate-900 bg-slate-50/50">
                        {item.quantity || item.qtd || 1}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800 bg-emerald-50/40 whitespace-nowrap">
                        <div>{formatWeightKg(item.totalWeightKg || item.pesoTotal || 0, 3)}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{formatNumberBR(item.unitWeightKg || 0, 3)} kg/un</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-indigo-700 whitespace-nowrap">
                        {formatCurrency(item.subtotal)}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditItem(item)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Editar item"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDuplicateItem(item)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Duplicar item"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* CLASSIC USICORTE ACTION BAR & GRAND TOTAL BOX (CONFORME FOTO DO SISTEMA LEGADO) */}
        <div className="bg-slate-100/90 border-2 border-slate-300/80 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          {/* Classic Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('item-input-form');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-12 h-10 bg-indigo-800 hover:bg-indigo-900 text-white rounded-md flex items-center justify-center font-black text-xl shadow-md border border-indigo-950 transition-transform active:scale-95 cursor-pointer"
              title="Adicionar / Novo Item (+)"
            >
              +
            </button>

            <button
              type="button"
              onClick={() => {
                if (confirm('Deseja limpar todos os itens da cotação atual?')) {
                  setItems([]);
                  resetItemForm();
                }
              }}
              className="w-12 h-10 bg-red-700 hover:bg-red-800 text-white rounded-md flex items-center justify-center font-black text-base shadow-md border border-red-900 transition-transform active:scale-95 cursor-pointer"
              title="Excluir / Limpar Itens"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={resetItemForm}
              className="w-12 h-10 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center justify-center font-black text-base shadow-md border border-red-800 transition-transform active:scale-95 cursor-pointer"
              title="Cancelar / Limpar Campos"
            >
              <X className="w-5 h-5 stroke-[3]" />
            </button>

            <span className="text-xs text-slate-500 font-bold ml-2 hidden md:inline">
              {items.length} item(ns) • {totalItemCount} peça(s)
            </span>
          </div>

          {/* Big Solid Black Total Display Box (Identical to legacy system: R$ 126,00) */}
          <div className="flex items-center gap-3">
            <div className="bg-black text-white px-6 py-2 rounded-md shadow-md border border-slate-900 flex items-center justify-center min-w-[170px]">
              <span className="font-mono font-black text-xl sm:text-2xl tracking-wide text-white">
                {formatCurrency(grandTotal)}
              </span>
            </div>
          </div>
        </div>

        {/* TABLE FOOTER SUMMARY BAR (PESO TOTAL DO PEDIDO EM DESTAQUE) */}
        {items.length > 0 && (
          <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Resumo de Cargas & Peso Total do Pedido
                </span>
                <span className="text-xs text-slate-200">
                  <b>{items.length}</b> itens cadastrados • <b>{totalItemCount}</b> peças totais
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right bg-slate-800/80 px-4 py-2 rounded-lg border border-slate-700">
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">
                  PESO TOTAL DO PEDIDO
                </span>
                <span className="text-lg font-black text-emerald-300 font-mono">
                  {formatWeightKg(totalQuoteWeightKg, 3)}
                </span>
              </div>

              <div className="text-right bg-slate-800/80 px-4 py-2 rounded-lg border border-slate-700">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block">
                  SUBTOTAL DOS ITENS
                </span>
                <span className="text-lg font-black text-indigo-200 font-mono">
                  {formatCurrency(subtotalTotal)}
                </span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 4. RODAPÉ, TOTAIS E IDENTIFICAÇÃO USICORTE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Observations and terms */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
            <Tag className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Observações & Termos Gerais de Fornecimento
            </h4>
          </div>

          <textarea
            rows={3}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Digite termos adicionais, prazos ou garantias..."
            className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
          />

          {/* Company ID Card UsiCorte */}
          <div className="bg-slate-900 text-white p-4 rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-indigo-300 tracking-tight">UsiCorte</span>
                <span className="text-[10px] text-slate-400">| CNPJ: 00.000.000/0001-00</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Usinagem de Precisão, Cortes em Plasma CNC, Oxicorte e Dobras.
              </p>
            </div>
            <div className="text-right text-[11px] text-slate-300 shrink-0">
              <span>{new Date().toLocaleDateString('pt-BR')} • {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </div>

        {/* Totals highlight panel */}
        <div className="lg:col-span-5 bg-white rounded-2xl border-2 border-indigo-500/30 p-6 shadow-sm space-y-4 relative overflow-hidden">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Resumo & Total Geral
            </h4>
            <span className="text-xs font-mono font-bold text-slate-500">
              {totalItemCount} peça(s) no total
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Subtotal dos Itens ({items.length} itens):</span>
              <span className="font-mono font-bold text-slate-800">{formatCurrency(subtotalTotal)}</span>
            </div>

            {/* Destaque do Peso Total do Pedido */}
            <div className="flex justify-between items-center text-emerald-950 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200 font-semibold">
              <span className="flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-emerald-600" />
                PESO TOTAL DO PEDIDO:
              </span>
              <span className="font-mono font-black text-emerald-800 text-sm">
                {formatWeightKg(totalQuoteWeightKg, 3)}
              </span>
            </div>

            {/* Desconto */}
            <div className="flex justify-between items-center text-slate-600 gap-4">
              <span>Desconto (R$):</span>
              <div className="w-32">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount || ''}
                  placeholder="0,00"
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1 text-right bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-emerald-700 outline-hidden"
                />
              </div>
            </div>

            {/* Frete */}
            <div className="flex justify-between items-center text-slate-600 gap-4">
              <span>Frete / Transporte (R$):</span>
              <div className="w-32">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingAmount || ''}
                  placeholder="0,00"
                  onChange={(e) => setShippingAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-2.5 py-1 text-right bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 outline-hidden"
                />
              </div>
            </div>

            {/* Grand Total Big Display */}
            <div className="bg-indigo-950 text-white p-4 rounded-xl border border-indigo-900/60 mt-4 flex items-center justify-between shadow-inner">
              <div>
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block">
                  VALOR TOTAL GERAL
                </span>
                <span className="text-[11px] text-slate-400">
                  {paymentTerms}
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>

            {/* Quick Action in Footer */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleApproveAndDeductQuote}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer border border-emerald-400/40"
                title="Aprova o orçamento, dá baixa no estoque de matéria-prima e lança em Contas a Receber"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                Aprovar & Baixar Estoque ⚡
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSaveFullQuote}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer border border-slate-700"
                >
                  <Save className="w-4 h-4" />
                  Salvar Orçamento
                </button>

                <button
                  onClick={() => setShowPrintModal(true)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir / PDF
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* MODAL PRINT PROPOSAL */}
      {showPrintModal && (
        <QuotePrintModal
          quote={currentQuoteForModal}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* MODAL HISTORY QUOTES */}
      {showHistoryModal && (
        <QuoteHistoryModal
          quotes={savedQuotes}
          onSelectQuote={handleLoadQuoteFromHistory}
          onDeleteQuote={handleDeleteSavedQuote}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

    </div>
  );
}
