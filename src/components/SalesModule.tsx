import React, { useState, useEffect, useRef } from 'react';
import { Client, Quote, QuoteItem } from '../types';
import { 
  saveCotacaoDb, 
  deleteCotacaoDb,
  fetchCotacoesDb, 
  mapSupabaseStatusToQuote, 
  db,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SupabaseCotacao
} from '../lib/db';
import { 
  reservarNovaCotacaoNoSupabase, 
  cancelarOuDescartarRascunho,
  limparRascunhosVaziosDb
} from '../services/cotacaoReservaService';
import { executarMigracaoEmergenciaOrcamentos } from '../services/emergencyMigrationService';
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
  isRetalhoOrMaoDeObra,
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
import { useMaterialsCatalog } from '../services/materialsService';
import { fileToDxfImage, isDxfFile } from '../utils/dxfRenderer';
import { 
  baixarEstoquePorCotacao, 
  gerarContasReceberPorCotacao 
} from '../services/inventoryFinanceService';
import {
  getQuoteSequentialConfig,
  incrementQuoteSequentialConfig,
  setQuoteSequentialConfig,
  fetchEmitenteNumberingConfig,
  resolveNextUniqueQuoteNumber,
  updateEmitenteNextSequential,
  incrementEmitenteQuoteSequential
} from '../services/companyService';
import { createPortal } from 'react-dom';
import QuotePrintModal, { PrintMode } from './QuotePrintModal';
import QuotePrintOptionsModal, { TipoImpressaoOrcamento } from './QuotePrintOptionsModal';
import EmissaoNfeModal from './EmissaoNfeModal';
import CancelarNfeModal from './CancelarNfeModal';
import { 
  abrirDanfeEmNovaAba, 
  obterOuBaixarXmlNfe, 
  isNfeAutorizada, 
  isNfeCancelada, 
  downloadXmlCancelamento 
} from '../services/nfeService';
import { 
  ConsultaPrintDocuments, 
  TipoImpressaoConsulta,
  normalizeQuoteForPrint,
  imprimirOrcamentoGeral,
  imprimirOrcamentoEmpresa,
  imprimirOrcamentoPedido,
  imprimirEtiquetas,
  imprimirFichaCorte,
  imprimirOrdemCorte80mm
} from './ConsultaPrintDocuments';
import QuoteHistoryModal from './QuoteHistoryModal';
import MaterialAutocomplete, { AutocompleteOption } from './MaterialAutocomplete';
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
  Lock,
  Loader2,
  X,
  Ruler,
  Upload,
  Image as ImageIcon,
  Ban,
  FileCheck2,
  Download,
  FileText
} from 'lucide-react';

interface SalesModuleProps {
  clients: Client[];
  onNavigateToClients?: () => void;
  selectedMaterial?: MaterialProfile | null;
  onQuoteChange?: (quote: Quote) => void;
  onNavigateToReports?: () => void;
  quoteToEdit?: Quote | null;
  onClearQuoteToEdit?: () => void;
  quoteToDuplicate?: { quote: Quote; originalNumber: string } | null;
  onClearQuoteToDuplicate?: () => void;
}

export default function SalesModule({ 
  clients, 
  onNavigateToClients,
  selectedMaterial,
  onQuoteChange,
  onNavigateToReports,
  quoteToEdit,
  onClearQuoteToEdit,
  quoteToDuplicate,
  onClearQuoteToDuplicate
}: SalesModuleProps) {
  // Catálogo dinâmico de materiais conectado ao Supabase
  const { profiles: dynamicMaterialProfiles, materials } = useMaterialsCatalog();
  const activeMaterialProfiles = dynamicMaterialProfiles.length > 0 ? dynamicMaterialProfiles : MATERIAL_PROFILES;

  // Helper universal para buscar dados oficiais cadastrados do produto/material (Supabase / Catálogo)
  const findProductOrMaterialData = (searchKey: string) => {
    if (!searchKey || !searchKey.trim()) return null;
    const clean = searchKey.trim().toLowerCase();
    const cleanSimple = clean.replace(/[^a-z0-9]/g, '');

    // 1. Tabela de materiais do Supabase (prioridade máxima aos valores cadastrados)
    const fromMaterials = materials.find(m =>
      m.id.toLowerCase() === clean ||
      m.nome.toLowerCase() === clean ||
      (cleanSimple && m.nome.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanSimple)
    );
    if (fromMaterials) {
      return {
        id: fromMaterials.id,
        name: fromMaterials.nome,
        descricao: fromMaterials.descricao && fromMaterials.descricao.trim() !== '' ? fromMaterials.descricao.trim() : fromMaterials.nome,
        tipo: fromMaterials.tipo,
        k: fromMaterials.k,
        precoKg: fromMaterials.precoKg,
        ncm: fromMaterials.ncm || '72085200',
        cfop_interno: fromMaterials.cfop_interno || '5102',
        cfop_externo: fromMaterials.cfop_externo || '6102',
        unidade_medida: fromMaterials.unidade_medida || 'PC',
        csosn: (!fromMaterials.csosn || fromMaterials.csosn.includes('102') || fromMaterials.csosn.includes('101')) ? '101 - Com permissão de crédito' : fromMaterials.csosn
      };
    }

    // 2. Perfis ativos da Calculadora
    const fromProfiles = activeMaterialProfiles.find(p =>
      p.id.toLowerCase() === clean ||
      p.name.toLowerCase() === clean ||
      (cleanSimple && p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanSimple)
    );
    if (fromProfiles) {
      return {
        id: fromProfiles.id,
        name: fromProfiles.name,
        tipo: fromProfiles.tipo,
        k: fromProfiles.k,
        precoKg: fromProfiles.defaultPriceKg,
        ncm: fromProfiles.ncm || '72085200',
        cfop_interno: fromProfiles.cfop_interno || '5102',
        cfop_externo: fromProfiles.cfop_externo || '6102',
        unidade_medida: fromProfiles.unidade_medida || 'PC',
        csosn: (!fromProfiles.csosn || fromProfiles.csosn.includes('102') || fromProfiles.csosn.includes('101')) ? '101 - Com permissão de crédito' : fromProfiles.csosn
      };
    }

    // 3. Mapa global DADOS_MATERIAIS_MAP
    const fromMap = DADOS_MATERIAIS_MAP[searchKey.trim()] || DADOS_MATERIAIS_MAP[clean];
    if (fromMap) {
      return {
        id: fromMap.id || clean,
        name: fromMap.nome,
        tipo: fromMap.tipo,
        k: fromMap.k,
        precoKg: fromMap.precoKg,
        ncm: '72085200',
        cfop_interno: '5102',
        cfop_externo: '6102',
        unidade_medida: 'PC',
        csosn: '101 - Com permissão de crédito'
      };
    }

    // 4. Presets de descrição de produtos
    const fromPreset = PRODUCT_DESCRIPTION_PRESETS.find(p =>
      p.name.toLowerCase() === clean ||
      (cleanSimple && p.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanSimple)
    );
    if (fromPreset) {
      return {
        id: fromPreset.constantSelect || clean,
        name: fromPreset.name,
        tipo: fromPreset.geometryType,
        k: fromPreset.constant,
        precoKg: fromPreset.defaultPriceKg,
        ncm: '72085200',
        cfop_interno: '5102',
        cfop_externo: '6102',
        unidade_medida: 'PC',
        csosn: '101 - Com permissão de crédito'
      };
    }

    return null;
  };

  // Saved quotes history (carregado diretamente do Supabase e mantido no estado da aplicação)
  const [savedQuotes, setSavedQuotes] = useState<Quote[]>([]);

  // Rastreia se estamos editando uma cotação existente (armazena o ID do banco e o número original)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(() => quoteToEdit?.id || null);
  const [editingOriginalQuoteNumber, setEditingOriginalQuoteNumber] = useState<string | null>(() => quoteToEdit?.quoteNumber || quoteToEdit?.id || null);
  const [editingQuoteCreatedAt, setEditingQuoteCreatedAt] = useState<string | null>(() => quoteToEdit?.createdAt || null);
  const [quoteForCancelNfe, setQuoteForCancelNfe] = useState<Quote | null>(null);
  const [isSavingQuote, setIsSavingQuote] = useState<boolean>(false);
  const [isReservingQuote, setIsReservingQuote] = useState<boolean>(false);
  const isReservingRef = useRef<boolean>(false);

  const editingQuoteIdRef = useRef<string | null>(quoteToEdit?.id || null);
  const editingQuoteNumberRef = useRef<string | null>(quoteToEdit?.quoteNumber || quoteToEdit?.id || null);
  const itemsRef = useRef<QuoteItem[]>([]);
  const quoteStatusRef = useRef<Quote['status']>('Rascunho');
  const numeroCotacaoRef = useRef<string>('');
  const isSavedRef = useRef<boolean>(false);

  // Quote header state
  const generateNextQuoteNumber = (quotesList?: Quote[]) => {
    const config = getQuoteSequentialConfig();
    const prefix = config.prefix || `COT-${new Date().getFullYear()}-`;
    let targetSeq = typeof config.nextSequential === 'number' && !isNaN(config.nextSequential)
      ? config.nextSequential
      : 990;

    const listToScan = quotesList && Array.isArray(quotesList) ? quotesList : savedQuotes;
    const existingSet = new Set<string>();
    const validSeqs: number[] = [];
    listToScan.forEach((q: any) => {
      const isDraftVazio = q.clientName === 'Rascunho em Edição' || q.cliente_nome === 'Rascunho em Edição';
      const numStr = String(q.quoteNumber || q.numero || q.id || "").trim();
      const isCorrupted = numStr.includes('202600') || numStr.includes('202620');
      if (!isDraftVazio && !isCorrupted) {
        existingSet.add(numStr.toLowerCase());
        const match = numStr.match(/(\d+)$/);
        if (match) {
          const val = parseInt(match[1], 10);
          if (val > 0 && val < 50000 && !String(val).startsWith('2026')) {
            validSeqs.push(val);
          }
        }
      }
    });

    const maxReal = validSeqs.length > 0 ? Math.max(...validSeqs) : 0;
    if (maxReal >= targetSeq) {
      targetSeq = maxReal + 1;
    }

    // Procura o próximo número sequencial livre a partir de targetSeq
    while (existingSet.has(`${prefix}${String(targetSeq).padStart(6, "0")}`.toLowerCase())) {
      targetSeq++;
    }

    return `${prefix}${String(targetSeq).padStart(6, "0")}`;
  };

  // Sugestão sequencial oficial da aba Emitente
  const [autoSuggestedNumber, setAutoSuggestedNumber] = useState<string>('');
  const [autoSuggestedSeq, setAutoSuggestedSeq] = useState<number>(140);
  const [isCheckingDbDuplicate, setIsCheckingDbDuplicate] = useState<boolean>(false);
  const [dbDuplicateResult, setDbDuplicateResult] = useState<{
    checkedNum: string;
    exists: boolean;
    clientName?: string;
  } | null>(null);

  const [numeroCotacao, setNumeroCotacao] = useState<string>(() => {
    if (quoteToEdit) {
      return quoteToEdit.quoteNumber || quoteToEdit.id || '';
    }
    return '';
  });

  // Alias semântico para o ID da cotação ativa no Supabase
  const cotacaoId = editingQuoteId;

  // Validação em tempo real se o número de cotação já existe no sistema (memória + Supabase)
  const checkQuoteNumberExists = (num: string, originalNum?: string | null): { exists: boolean; existingQuote?: Quote; clientName?: string } => {
    const cleanNum = num.trim().toLowerCase();
    if (!cleanNum) return { exists: false };

    // Se estiver editando a mesma cotação original ou o rascunho reservado no banco nesta sessão, não considera duplicata
    if (originalNum && cleanNum === originalNum.trim().toLowerCase()) {
      return { exists: false };
    }
    if (editingQuoteId && cleanNum === (numeroCotacao || '').trim().toLowerCase()) {
      return { exists: false };
    }

    // 1. Busca nas cotações salvas em memória
    const found = savedQuotes.find(
      q => (q.quoteNumber && q.quoteNumber.trim().toLowerCase() === cleanNum) ||
           (q.id && String(q.id).trim().toLowerCase() === cleanNum)
    );
    if (found) {
      // Se a cotação encontrada for o próprio rascunho em edição, não é duplicata
      if (editingQuoteId && (found.id === editingQuoteId || found.quoteNumber === numeroCotacao)) {
        return { exists: false };
      }
      return {
        exists: true,
        existingQuote: found,
        clientName: found.clientName
      };
    }

    // 2. Checagem do resultado da consulta do Supabase para números digitados manualmente
    if (dbDuplicateResult && dbDuplicateResult.checkedNum.toLowerCase() === cleanNum) {
      if (dbDuplicateResult.exists) {
        return {
          exists: true,
          clientName: dbDuplicateResult.clientName
        };
      }
    }

    return {
      exists: false
    };
  };

  // 1. OBTENÇÃO DA SUGESTÃO SEQUENCIAL NA ABERTURA (SEM CRIAR RASCUNHO NO BANCO):
  // Ao carregar a tela, apenas consulta a sequência oficial e preenche visualmente
  // o número sugerido (ex: COT-2026-000990), SEM efetuar nenhum INSERT ou reserva no Supabase.
  // Um rascunho só é gerado no banco quando o usuário clicar em "Nova Cotação" ou preencher dados na tela.
  useEffect(() => {
    if (!quoteToEdit && !quoteToDuplicate && !editingQuoteId) {
      resolveNextUniqueQuoteNumber(savedQuotes)
        .then(res => {
          if (res?.quoteNumber) {
            setNumeroCotacao(res.quoteNumber);
            setAutoSuggestedNumber(res.quoteNumber);
            setAutoSuggestedSeq(res.sequential);
            setQuoteStatus('Rascunho');
            quoteStatusRef.current = 'Rascunho';
            isSavedRef.current = false;
            console.log(`[SalesModule] Sugestão sequencial oficial pronta na tela: Nº ${res.quoteNumber} (sem criação de rascunho no banco)`);
          }
        })
        .catch(err => {
          console.warn('[SalesModule] Erro ao sugerir numeração sequencial na abertura:', err);
        });
    }
  }, []);

  // 2. Validação contra Duplicidade no Supabase:
  // Sempre que um número for digitado manualmente ou alterado, consulta diretamente a tabela 'cotacoes' com debounce
  useEffect(() => {
    const cleanNum = numeroCotacao.trim();
    if (!cleanNum) {
      setDbDuplicateResult(null);
      setIsCheckingDbDuplicate(false);
      return;
    }

    // Se estiver editando a cotação original e o número não mudou, está livre
    if (editingOriginalQuoteNumber && cleanNum.toLowerCase() === editingOriginalQuoteNumber.trim().toLowerCase()) {
      setDbDuplicateResult({ checkedNum: cleanNum, exists: false });
      setIsCheckingDbDuplicate(false);
      return;
    }

    // Checagem imediata nas cotações em memória
    const localFound = savedQuotes.find(
      q => (q.quoteNumber && q.quoteNumber.trim().toLowerCase() === cleanNum.toLowerCase()) ||
           (q.id && String(q.id).trim().toLowerCase() === cleanNum.toLowerCase())
    );
    if (localFound) {
      setDbDuplicateResult({
        checkedNum: cleanNum,
        exists: true,
        clientName: localFound.clientName
      });
      setIsCheckingDbDuplicate(false);
      return;
    }

    // Consulta assíncrona ao Supabase (tabela 'cotacoes')
    setIsCheckingDbDuplicate(true);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await db
          .from('cotacoes')
          .select('id, numero, cliente_nome')
          .ilike('numero', cleanNum)
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          // Se for o próprio registro que está sendo editado no banco
          if (editingQuoteId && (data.id === editingQuoteId || String(data.id) === String(editingQuoteId))) {
            setDbDuplicateResult({ checkedNum: cleanNum, exists: false });
          } else {
            setDbDuplicateResult({
              checkedNum: cleanNum,
              exists: true,
              clientName: data.cliente_nome
            });
          }
        } else {
          setDbDuplicateResult({ checkedNum: cleanNum, exists: false });
        }
      } catch (err) {
        console.warn('Aviso ao verificar duplicidade no Supabase:', err);
        setDbDuplicateResult({ checkedNum: cleanNum, exists: false });
      } finally {
        setIsCheckingDbDuplicate(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [numeroCotacao, editingOriginalQuoteNumber, editingQuoteId, savedQuotes]);
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
  const [quoteStatus, setQuoteStatus] = useState<Quote['status']>(() => {
    if (quoteToEdit) return quoteToEdit.status || 'Pendente';
    return 'Rascunho';
  });
  const [observations, setObservations] = useState<string>('Preços com impostos inclusos. Material sujeito a conferência no ato do recebimento.');

  // Adjustments (Discount & Shipping)
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [shippingAmount, setShippingAmount] = useState<number>(0);

  // Items list
  const [items, setItems] = useState<QuoteItem[]>([]);

  // Sincroniza refs do rascunho ativo em tempo real para os handlers de encerramento
  editingQuoteIdRef.current = editingQuoteId;
  editingQuoteNumberRef.current = editingOriginalQuoteNumber || numeroCotacao;
  itemsRef.current = items;
  quoteStatusRef.current = quoteStatus;
  numeroCotacaoRef.current = numeroCotacao;

  // E SE A TELA FOR FECHADA SEM SALVAR:
  // 1. Ao sair/desmontar a tela do módulo de Vendas (navegação para outro menu no sistema):
  // Se o usuário fechar a tela sem adicionar nenhum item, apaga o rascunho vazio do banco
  // para NÃO consumir o número de sequência desnecessariamente.
  useEffect(() => {
    return () => {
      const idToClean = editingQuoteIdRef.current;
      const currentItems = itemsRef.current;
      const currentStatus = quoteStatusRef.current;
      const isSaved = isSavedRef.current;

      if (idToClean && !isSaved && currentItems.length === 0 && (currentStatus === 'Rascunho' || (currentStatus as string) === 'RASCUNHO')) {
        console.log(`[SalesModule] Fechando tela sem itens. Excluindo rascunho vazio ${idToClean} para liberar o número.`);
        cancelarOuDescartarRascunho(idToClean, numeroCotacaoRef.current).catch(err => {
          console.warn('Erro ao limpar rascunho vazio ao fechar tela:', err);
        });
      }
    };
  }, []);

  // 2. Ao fechar a aba/janela do navegador ou recarregar a página (F5):
  useEffect(() => {
    const handleBeforeUnload = () => {
      const idToClean = editingQuoteIdRef.current;
      const currentItems = itemsRef.current;
      const currentStatus = quoteStatusRef.current;
      const isSaved = isSavedRef.current;

      if (idToClean && !isSaved && currentItems.length === 0 && (currentStatus === 'Rascunho' || (currentStatus as string) === 'RASCUNHO')) {
        const cleanUrl = SUPABASE_URL.replace(/\/$/, '');

        try {
          const deleteEndpoint = `${cleanUrl}/rest/v1/cotacoes?id=eq.${idToClean}`;
          fetch(deleteEndpoint, {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            keepalive: true
          }).catch(() => {});
        } catch {}
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, []);

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
  const [itemManualUnitWeightKg, setItemManualUnitWeightKg] = useState<string>('1');
  const [itemNotes, setItemNotes] = useState<string>('');
  const [itemDrawingImage, setItemDrawingImage] = useState<string | null>(null);
  const [isManualUnitPrice, setIsManualUnitPrice] = useState<boolean>(false);
  const itemFileInputRef = useRef<HTMLInputElement>(null);

  // Constante Combobox & Autocomplete state
  const [isConstantOpen, setIsConstantOpen] = useState<boolean>(false);
  const [constantSearchQuery, setConstantSearchQuery] = useState<string>('');
  const [constantCategoryFilter, setConstantCategoryFilter] = useState<string>('ALL');
  const [constantHighlightIndex, setConstantHighlightIndex] = useState<number>(0);
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
  const [descriptionHighlightIndex, setDescriptionHighlightIndex] = useState<number>(0);
  const descriptionComboboxRef = useRef<HTMLDivElement>(null);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // Normalizador sem acentos para busca inteligente em tempo real (ex: "oxi", "1045", "aço")
  const normalizeSearchText = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const matchesSearchQuery = (queryRaw: string, ...targets: (string | number | undefined)[]) => {
    const q = normalizeSearchText(queryRaw);
    if (!q) return true;
    const combinedTarget = targets
      .map(t => normalizeSearchText(String(t ?? '')))
      .join(' ');
    if (combinedTarget.includes(q)) return true;
    const tokens = q.split(/\s+/).filter(Boolean);
    return tokens.length > 1 && tokens.every(tok => combinedTarget.includes(tok));
  };

  // Auto-calculator helper state
  const [showAutoCalcHelp, setShowAutoCalcHelp] = useState<boolean>(false);
  const [autoCalcWeight, setAutoCalcWeight] = useState<number | null>(null);

  // Modals & History state
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showPrintOptionsModal, setShowPrintOptionsModal] = useState<boolean>(false);
  const [printModalMode, setPrintModalMode] = useState<TipoImpressaoOrcamento>('GERAL');
  const [autoTriggerPrint, setAutoTriggerPrint] = useState<boolean>(false);
  const [lastSavedQuoteForPrint, setLastSavedQuoteForPrint] = useState<any | null>(null);
  const [quoteForDirectNfe, setQuoteForDirectNfe] = useState<Quote | null>(null);
  const [activeDirectPrint, setActiveDirectPrint] = useState<{ quote: any; tipo: TipoImpressaoConsulta } | null>(null);

  // Refs para autofoco imediato na entrada de novas cotações
  const clientSelectRef = useRef<HTMLSelectElement | null>(null);
  const clientNameInputRef = useRef<HTMLInputElement | null>(null);
  const handleAdvanceToNextQuoteRef = useRef<(() => void) | null>(null);

  // Efeito responsável por sincronizar a renderização completa do documento e disparar window.print()
  useEffect(() => {
    if (activeDirectPrint && activeDirectPrint.tipo !== 'CORTE_80MM') {
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
        setActiveDirectPrint(null);
        window.removeEventListener('afterprint', handleAfterPrint);

        // FLUXO AUTOMÁTICO: Assim que a janela de impressão for fechada ou confirmada:
        // Limpa todos os campos da tela atual, gera o novo sequencial e foca no 1º campo de digitação!
        if (handleAdvanceToNextQuoteRef.current) {
          handleAdvanceToNextQuoteRef.current();
        }
      };

      window.addEventListener('afterprint', handleAfterPrint);
      const timer = setTimeout(() => {
        window.print();
      }, 250);

      return () => {
        clearTimeout(timer);
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
      };
    }
  }, [activeDirectPrint]);

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

  // Load saved quotes on mount (Supabase primário e desvinculação do s_orcamentos do localStorage)
  const loadQuotesFromDb = async () => {
    try {
      const dbQuotes = await fetchCotacoesDb();
        const mappedDbQuotes: Quote[] = (dbQuotes || [])
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
              clientName: q.cliente_nome || q.clientes?.nome || q.clientes?.razao_social || q.clientes?.empresa || 'Cliente Balcão',
              contactPerson: q.contato || q.clientes?.contato || '',
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
              // Dados Fiscais da NF-e
              status_nfe: q.status_nfe || 'Pendente',
              nfe_chave: q.nfe_chave || q.chave_acesso,
              chave_acesso: q.chave_acesso || q.nfe_chave,
              nfe_numero: q.nfe_numero,
              serie_nfe: q.serie_nfe,
              danfe_url: q.danfe_url,
              xml_url: q.xml_url,
              xml_conteudo: q.xml_conteudo,
              protocolo_autorizacao: q.protocolo_autorizacao || q.protocolo_nfe,
              protocolo_nfe: q.protocolo_nfe || q.protocolo_autorizacao,
              mensagem_erro_nfe: q.mensagem_erro_nfe,
              nfe_emitida_em: q.nfe_emitida_em,
              items: (q.cotacao_itens || []).map((it: any, idx: number) => {
                const qty = Number(it.quantidade) || 1;
                const medidaStr = String(it.medida || '').trim();
                const isSpec = isRetalhoOrMaoDeObra(it.produto || it.material, it.descricao || it.produto);
                const kgMatch = medidaStr.match(/^([\d.,]+)\s*kg$/i);
                const parsedKg = !isSpec && kgMatch ? parseFloat(kgMatch[1].replace(/\./g, '').replace(',', '.')) : 0;
                const unitW = isSpec
                  ? 0
                  : (it.peso_unitario !== undefined && it.peso_unitario !== null
                      ? Number(it.peso_unitario)
                      : (parsedKg > 0 ? parsedKg : undefined));
                const totalW = isSpec
                  ? 0
                  : (it.peso_total !== undefined && it.peso_total !== null
                      ? Number(it.peso_total)
                      : (unitW !== undefined ? Number((unitW * qty).toFixed(3)) : undefined));

                return {
                  id: String(it.id || idx),
                  date: safeDateIso,
                  companyName: q.cliente_nome || 'Cliente Balcão',
                  description: it.descricao || it.produto || 'Item',
                  constant: isSpec ? '0' : '0.00785',
                  constantName: it.produto || 'Material',
                  measure: isSpec || kgMatch ? '—' : medidaStr,
                  diameter: '',
                  widthLength: isSpec ? '—' : '',
                  unitWeightKg: unitW,
                  totalWeightKg: totalW,
                  pesoTotal: totalW,
                  unitPrice: Number(it.valor_unitario) || 0,
                  quantity: qty,
                  subtotal: Number(it.valor_total) || ((Number(it.valor_unitario) || 0) * qty),
                  notes: it.observacao || '',
                  drawingImage: it.desenho_url || undefined,
                  // Campos Fiscais herdados
                  ncm: it.ncm || '72085200',
                  cfop: it.cfop,
                  cfop_interno: it.cfop_interno || '5102',
                  cfop_externo: it.cfop_externo || '6102',
                  unidade_medida: it.unidade_medida || 'PC',
                  unidadeMedida: it.unidade_medida || 'PC',
                  csosn: (!it.csosn || it.csosn.includes('102') || it.csosn.includes('101')) ? '101 - Com permissão de crédito' : it.csosn
                };
              })
            };
          });

        // Atualiza estado do módulo com os orçamentos vindos diretamente do Supabase
        setSavedQuotes(mappedDbQuotes);

        // Rotina de migração e sincronização de emergência:
        // Verifica se existem orçamentos locais em 's_orcamentos', envia para o Supabase (INSERT/UPSERT),
        // e SOMENTE limpa 's_orcamentos' após confirmação de gravação no banco de dados.
        try {
          const migRes = await executarMigracaoEmergenciaOrcamentos();
          if (migRes.migratedCount > 0) {
            // Se houve novos orçamentos gravados no Supabase, recarrega para atualizar a lista
            const freshDb = await fetchCotacoesDb();
            if (freshDb && freshDb.length > 0) {
              const freshMapped: Quote[] = freshDb
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
                    clientName: q.cliente_nome || q.clientes?.nome || q.clientes?.razao_social || q.clientes?.empresa || 'Cliente Balcão',
                    contactPerson: q.contato || q.clientes?.contato || '',
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
                    // Dados Fiscais da NF-e
                    status_nfe: q.status_nfe || 'Pendente',
                    nfe_chave: q.nfe_chave || q.chave_acesso,
                    chave_acesso: q.chave_acesso || q.nfe_chave,
                    nfe_numero: q.nfe_numero,
                    serie_nfe: q.serie_nfe,
                    danfe_url: q.danfe_url,
                    xml_url: q.xml_url,
                    xml_conteudo: q.xml_conteudo,
                    protocolo_autorizacao: q.protocolo_autorizacao || q.protocolo_nfe,
                    protocolo_nfe: q.protocolo_nfe || q.protocolo_autorizacao,
                    mensagem_erro_nfe: q.mensagem_erro_nfe,
                    nfe_emitida_em: q.nfe_emitida_em,
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
                      drawingImage: it.desenho_url || undefined,
                      ncm: it.ncm || '72085200',
                      cfop: it.cfop,
                      cfop_interno: it.cfop_interno || '5102',
                      cfop_externo: it.cfop_externo || '6102',
                      unidade_medida: it.unidade_medida || 'PC',
                      unidadeMedida: it.unidade_medida || 'PC',
                      csosn: (!it.csosn || it.csosn.includes('102') || it.csosn.includes('101')) ? '101 - Com permissão de crédito' : it.csosn
                    }))
                  };
                });
              setSavedQuotes(freshMapped);
            }
          }
        } catch (migErr) {
          console.warn('Aviso ao sincronizar emergência em SalesModule:', migErr);
        }

        // 1 & 2. Se NÃO estiver em modo edição, busca a numeração viva da tabela 'emitente' e protege contra duplicidade na tabela 'cotacoes'
        if (!editingQuoteNumberRef.current && !editingQuoteIdRef.current && !editingOriginalQuoteNumber) {
          resolveNextUniqueQuoteNumber(mappedDbQuotes).then(res => {
            if (res?.quoteNumber) {
              setAutoSuggestedNumber(res.quoteNumber);
              setAutoSuggestedSeq(res.sequential);
              setNumeroCotacao(prev => (!prev || prev === res.quoteNumber || prev === autoSuggestedNumber ? res.quoteNumber : prev));
            }
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Erro ao consultar cotações do Supabase:', err);
      }
  };

  useEffect(() => {
    loadQuotesFromDb();

    const handleMigrated = () => {
      loadQuotesFromDb();
    };
    window.addEventListener('cotacoes_migradas_emergencia', handleMigrated);
    return () => {
      window.removeEventListener('cotacoes_migradas_emergencia', handleMigrated);
    };
  }, []);

  // Atualiza automaticamente o número do orçamento quando as configurações da empresa forem salvas (somente se não estiver em edição)
  useEffect(() => {
    const handleCompanyUpdate = () => {
      if (!editingQuoteNumberRef.current && !editingQuoteIdRef.current && !editingOriginalQuoteNumber) {
        resolveNextUniqueQuoteNumber(savedQuotes).then(res => {
          if (res?.quoteNumber) {
            setAutoSuggestedNumber(res.quoteNumber);
            setAutoSuggestedSeq(res.sequential);
            setNumeroCotacao(prev => (!prev || prev === res.quoteNumber || prev === autoSuggestedNumber ? res.quoteNumber : prev));
          }
        }).catch(() => {});
      }
    };
    window.addEventListener('company-data-updated', handleCompanyUpdate);
    return () => {
      window.removeEventListener('company-data-updated', handleCompanyUpdate);
    };
  }, [editingOriginalQuoteNumber, savedQuotes]);

  // Carrega cotação para edição caso passada via prop quoteToEdit
  useEffect(() => {
    if (quoteToEdit) {
      handleLoadQuoteFromHistory(quoteToEdit);
      if (onClearQuoteToEdit) {
        onClearQuoteToEdit();
      }
    }
  }, [quoteToEdit]);

  // Carrega cotação para duplicação com novo número caso passada via prop quoteToDuplicate
  useEffect(() => {
    if (quoteToDuplicate) {
      handleLoadQuoteForDuplication(quoteToDuplicate);
      if (onClearQuoteToDuplicate) {
        onClearQuoteToDuplicate();
      }
    }
  }, [quoteToDuplicate]);

  // When selectedMaterial is passed from Products screen, apply it immediately
  useEffect(() => {
    if (selectedMaterial) {
      const material = materials.find(
        m => m.id.toLowerCase() === selectedMaterial.id.toLowerCase() ||
             m.nome.toLowerCase() === selectedMaterial.name.toLowerCase()
      );
      const registered = findProductOrMaterialData(selectedMaterial.name) || findProductOrMaterialData(selectedMaterial.id);
      const kVal = material ? material.k : (registered ? registered.k : selectedMaterial.k);
      const precoVal = material ? material.precoKg : (registered ? registered.precoKg : selectedMaterial.defaultPriceKg);
      const tipoVal = material ? material.tipo : (registered ? registered.tipo : selectedMaterial.tipo);
      const nameVal = material ? material.nome : (registered ? registered.name : selectedMaterial.name);
      const descVal = (material && material.descricao && material.descricao.trim() !== '')
        ? material.descricao.trim()
        : nameVal;
      const precoKgStr = precoVal.toFixed(2).replace('.', ',');
      const kStr = kVal.toString();

      setItemConstantSelect(selectedMaterial.id);
      setItemConstantName(nameVal);
      setItemGeometryType(tipoVal);
      setItemConstant(kStr);
      setItemPricePerKg(precoKgStr);
      setItemDescription(descVal);
      setIsManualUnitPrice(false);

      // Executa o cálculo automático imediatamente com a constante k e preço/kg oficiais
      updateCascadingUnitPrice(
        precoKgStr,
        kStr,
        tipoVal,
        itemWidthMm,
        itemLengthMm,
        itemDiameter,
        itemThickness
      );

      // Focus on the first dimension field
      setTimeout(() => {
        const firstField = document.getElementById('diametro') || document.getElementById('espessura');
        if (firstField) {
          firstField.focus();
        }
      }, 100);
    }
  }, [selectedMaterial]);

  // 2. EDICÃO E SALVAMENTO VIA UPDATE NO SUPABASE:
  // Conforme o usuário adiciona itens, cliente ou observações, as alterações são salvas/atualizadas via UPDATE
  // na cotação já existente usando o cotacaoId (editingQuoteId).
  const syncDraftUpdateToDb = (updatedFields?: Partial<Quote>, updatedItems?: QuoteItem[]) => {
    const targetId = editingQuoteIdRef.current;
    const cleanNum = (numeroCotacaoRef.current || numeroCotacao || '').trim();
    if (!targetId || !cleanNum) return;

    const currentItems = updatedItems !== undefined ? updatedItems : itemsRef.current;
    const subtotal = Number(currentItems.reduce((sum, it) => sum + (it.subtotal || 0), 0).toFixed(2));
    const totalWeight = Number(currentItems.reduce((sum, it) => sum + (Number(it.totalWeightKg) || 0), 0).toFixed(3));
    const grand = Number(Math.max(0, subtotal - discountAmount + shippingAmount).toFixed(2));

    const quoteToSync: Quote = {
      id: targetId,
      quoteNumber: cleanNum,
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
      status: quoteStatusRef.current || 'Rascunho',
      items: currentItems,
      discount: discountAmount,
      discountPercent: 0,
      shipping: shippingAmount,
      subtotalTotal: subtotal,
      grandTotal: grand,
      totalWeightKg: totalWeight,
      observations: observations,
      createdAt: editingQuoteCreatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...updatedFields
    };

    saveCotacaoDb(quoteToSync, editingOriginalQuoteNumber || undefined).catch(err => {
      console.warn('[SalesModule] Erro ao sincronizar alteração do rascunho no Supabase:', err);
    });
  };

  // Sincronização automática em background (com debounce) para alterações nos campos de cabeçalho
  useEffect(() => {
    if (!editingQuoteId || isSavingQuote || isReservingQuote) return;

    const timer = setTimeout(() => {
      syncDraftUpdateToDb();
    }, 1200);

    return () => clearTimeout(timer);
  }, [
    clientName,
    selectedClientId,
    clientDocument,
    contactPerson,
    clientPhone,
    clientEmail,
    clientCity,
    clientState,
    observations,
    discountAmount,
    shippingAmount,
    paymentTerms,
    validityDays,
    quoteDate
  ]);

  // When selectedClientId changes, auto fill client data e atualiza cotação existente via UPDATE
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) {
      setClientName('Cliente Balcão (UsiCorte)');
      setClientDocument('');
      setContactPerson('');
      setClientPhone('');
      setClientEmail('');
      setClientCity('');
      setClientState('');
      syncDraftUpdateToDb({
        clientId: undefined,
        clientName: 'Cliente Balcão (UsiCorte)',
        clientDocument: '',
        contactPerson: '',
        clientPhone: '',
        clientEmail: '',
        clientCity: '',
        clientState: ''
      });
      return;
    }

    const found = clients.find(c => c.id === clientId);
    if (found) {
      const cName = found.fantasyName || found.name;
      setClientName(cName);
      setClientDocument(found.document);
      setContactPerson(found.contactPerson || '');
      setClientPhone(found.phone);
      setClientEmail(found.email);
      setClientCity(found.city);
      setClientState(found.state);
      syncDraftUpdateToDb({
        clientId: clientId,
        clientName: cName,
        clientDocument: found.document,
        contactPerson: found.contactPerson || '',
        clientPhone: found.phone,
        clientEmail: found.email,
        clientCity: found.city,
        clientState: found.state
      });
    }
  };

  // Real-time calculation of item dimensions, weight and cascading price
  const isSpecialItem = isRetalhoOrMaoDeObra(itemConstantName, itemDescription);
  const currentFormPriceKg = parseNumberBR(itemPricePerKg);
  const currentFormConstant = isSpecialItem ? 0 : normalizeConstant(itemConstant);
  const currentFormQty = parseFloat(itemQuantity) || 0;
  const effectiveQtyForCalc = currentFormQty > 0 ? currentFormQty : 1;

  // Derive dimensions for real-time live weight
  const parsedDims = parseDimensionStrings(itemWidthLength, itemDiameter, itemThickness);
  const effectiveDiameterMm = isSpecialItem ? 0 : parseDiameterOrThicknessMm(itemDiameter, itemThickness);
  const effectiveThicknessMm = isSpecialItem ? 0 : parseDiameterOrThicknessMm(itemThickness, itemDiameter);
  const effectiveWidthMm = isSpecialItem ? 0 : (parseDimensionToMm(itemWidthMm) || parsedDims.parsedWidthMm || 0);
  const effectiveLengthMm = isSpecialItem ? 0 : (parseDimensionToMm(itemLengthMm) || parsedDims.parsedLengthMm || 0);

  const { unitWeightKg: geoFormUnitWeightKg, totalWeightKg: geoFormTotalWeightKg } = calculateItemWeightKg({
    geometryType: itemGeometryType,
    constant: currentFormConstant,
    diameterMm: effectiveDiameterMm,
    thicknessMm: effectiveThicknessMm,
    widthMm: effectiveWidthMm,
    lengthMm: effectiveLengthMm,
    quantity: effectiveQtyForCalc,
    diameterStr: itemDiameter,
    thicknessStr: itemThickness
  });

  const currentFormUnitWeightKg = isSpecialItem ? 0 : geoFormUnitWeightKg;
  const currentFormTotalWeightKg = isSpecialItem ? 0 : geoFormTotalWeightKg;

  // Theoretical unit price calculated in cascade:
  // For RETALHO / MÃO DE OBRA / SERVIÇOS (cálculo direto):
  // • Peso Unitário = 0.000 Kg e Peso Total = 0.000 Kg
  // • Valor Unitário (R$) = Preço Unitário digitado
  // • Subtotal (R$) = Quantidade × Valor Unitário (R$)
  const calculatedUnitPrice = isSpecialItem
    ? (currentFormPriceKg > 0 ? currentFormPriceKg : 0)
    : (currentFormUnitWeightKg > 0 && currentFormPriceKg > 0
        ? Math.ceil(currentFormUnitWeightKg * currentFormPriceKg)
        : 0);

  // Live unit price for form calculations (prioritizes direct price for special items)
  const rawFormUnitPrice = isSpecialItem
    ? (currentFormPriceKg > 0 ? currentFormPriceKg : parseNumberBR(itemUnitPrice))
    : (parseNumberBR(itemUnitPrice) || calculatedUnitPrice);
  const currentFormUnitPrice = isSpecialItem ? rawFormUnitPrice : Math.ceil(rawFormUnitPrice);
  const currentFormSubtotal = isSpecialItem
    ? Number((effectiveQtyForCalc * currentFormUnitPrice).toFixed(2))
    : calculateItemSubtotal(currentFormUnitPrice, effectiveQtyForCalc);

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
    if (isRetalhoOrMaoDeObra(itemConstantName, itemDescription)) {
      setItemUnitPrice(pKg > 0 ? pKg.toFixed(2).replace('.', ',') : '');
      return;
    }
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

    // Busca nas constantes e materiais oficiais cadastrados no Supabase
    const material = materials.find(
      m => m.id.toLowerCase() === val.trim().toLowerCase() ||
           m.nome.toLowerCase() === val.trim().toLowerCase()
    );
    const matData = findProductOrMaterialData(val) ||
      DADOS_MATERIAIS_MAP[val] || 
      DADOS_MATERIAIS_MAP[val.toLowerCase()] ||
      activeMaterialProfiles.find(p => p.id === val || p.name.toLowerCase() === val.toLowerCase());

    if (material || matData) {
      const newGeom = material ? material.tipo : matData!.tipo;
      const newConstant = (material ? material.k : matData!.k).toString();
      const newPriceKg = (material ? material.precoKg : ('precoKg' in matData! ? matData!.precoKg : ('defaultPriceKg' in matData! ? (matData as any).defaultPriceKg : 22.00))).toFixed(2).replace('.', ',');
      const newProfileName = material ? material.nome : ('nome' in matData! ? (matData as any).nome : ('name' in matData! ? (matData as any).name : val));
      const newDesc = (material && material.descricao && material.descricao.trim() !== '')
        ? material.descricao.trim()
        : newProfileName;

      setItemConstantName(newProfileName);
      setItemGeometryType(newGeom);
      setItemConstant(newConstant);
      setItemPricePerKg(newPriceKg);
      setItemDescription(newDesc);
      setIsManualUnitPrice(false);

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
  const filteredMaterialProfiles = activeMaterialProfiles.filter(profile => {
    if (constantCategoryFilter !== 'ALL') {
      if (constantCategoryFilter === 'chapa' && profile.tipo !== 'chapa') return false;
      if (constantCategoryFilter === 'macico' && profile.tipo !== 'macico') return false;
      if (constantCategoryFilter === 'bucha' && profile.tipo !== 'bucha') return false;
    }
    if (!constantSearchQuery.trim()) return true;
    return matchesSearchQuery(
      constantSearchQuery,
      profile.name,
      profile.id,
      profile.description,
      profile.k,
      profile.k.toString().replace('.', ','),
      profile.tipo
    );
  });

  // Select Material Profile handler
  const handleSelectMaterialProfile = (profile: MaterialProfile) => {
    // a) Localiza o objeto do material selecionado na lista carregada do Supabase
    const material = materials.find(
      m => m.id.toLowerCase() === (profile.id || '').trim().toLowerCase() ||
           m.nome.toLowerCase() === (profile.name || '').trim().toLowerCase()
    );
    const registered = findProductOrMaterialData(profile.name) || findProductOrMaterialData(profile.id);
    const kVal = material ? material.k : (registered ? registered.k : profile.k);
    const precoVal = material ? material.precoKg : (registered ? registered.precoKg : profile.defaultPriceKg);
    const tipoVal = material ? material.tipo : (registered ? registered.tipo : profile.tipo);
    const nameVal = material ? material.nome : (registered ? registered.name : profile.name);
    const precoKgStr = precoVal.toFixed(2).replace('.', ',');
    const kStr = kVal.toString();

    // b) Preenche automaticamente a caixa de texto "Descrição do Produto / Serviço" APENAS com material.descricao
    // c) Se material.descricao estiver vazio ou nulo, utiliza apenas material.nome (sem sufixos ou prefixos)
    const descricaoPreenchida = (material && material.descricao && material.descricao.trim() !== '')
      ? material.descricao.trim()
      : nameVal;

    setItemConstantName(nameVal);
    setItemConstantSelect(material ? material.id : profile.id);
    setItemGeometryType(tipoVal);
    setItemConstant(kStr);
    setItemPricePerKg(precoKgStr);
    setItemDescription(descricaoPreenchida);
    setIsManualUnitPrice(false);

    const isSpec = isRetalhoOrMaoDeObra(nameVal, descricaoPreenchida);
    if (isSpec) {
      setItemDiameter('');
      setItemThickness('');
      setItemWidthMm('');
      setItemLengthMm('');
      setItemWidthLength('');
      setItemManualUnitWeightKg('0');
      setItemUnitPrice(precoVal > 0 ? precoVal.toFixed(2).replace('.', ',') : '');
      setIsConstantOpen(false);
      setConstantSearchQuery('');
      setConstantHighlightIndex(0);
      focusNextField('qtd');
      return;
    }

    // Execute o cálculo automático do valor do item utilizando a constante 'k' e o 'preco_kg' oficiais do cadastro
    updateCascadingUnitPrice(
      precoKgStr,
      kStr,
      tipoVal,
      itemWidthMm,
      itemLengthMm,
      itemDiameter,
      itemThickness
    );

    setIsConstantOpen(false);
    setConstantSearchQuery('');
    setConstantHighlightIndex(0);
    
    // Passa o foco do cursor (focus()) para o próximo campo (Espessura para chapa, ou Diâmetro para maciço/bucha)
    if (tipoVal === 'chapa' || (tipoVal as string) === 'CHAPA_RETANGULO') {
      focusNextField('espessura');
    } else {
      focusNextField('diametro');
    }
  };

  // 2. Campo de Nome/Descrição 100% Editável:
  // O usuário pode alterar livremente o texto (ex: mudar de "TREFILADO SAE 1045" para "AÇO REDONDO 1045 CORTE ESPECIAL")
  // diretamente no formulário do item. Alterar o nome digitado NÃO deve apagar, resetar ou desvincular o Preço/Kg e a Constante 'k'.
  const handleConstantInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitado = e.target.value;
    setItemConstantName(digitado);
    setConstantSearchQuery(digitado);
    setConstantHighlightIndex(0);
    setIsConstantOpen(true);
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

  // 1. Campo de Descrição 100% Livre e Editável:
  // Permite edição livre da Descrição do Produto / Serviço sem resetar ou desvincular a constante e preço já carregados
  // Abre automaticamente o dropdown (isDescriptionOpen = true) ao digitar (onChange / onInput)
  const handleDescriptionInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitado = e.target.value;
    setItemDescription(digitado);
    setDescriptionSearchQuery(digitado);
    setDescriptionHighlightIndex(0);
    setIsDescriptionOpen(true);
  };

  // Auto-detect geometry suggestion when description changes directly
  const handleDescriptionChange = (value: string) => {
    setItemDescription(value);
  };

  // Helper para focar no próximo campo lógico após a Descrição -> vai para Observação
  const focusNextAfterDescriptionSelect = () => {
    focusNextField('observacao');
  };

  // Handle selection from Description Combobox
  const handleSelectDescriptionPreset = (preset: any) => {
    const presetName = preset.name || preset.nome || '';
    const material = materials.find(
      m => m.nome.toLowerCase() === presetName.trim().toLowerCase() ||
           m.id.toLowerCase() === String(preset.constantSelect || preset.id || '').trim().toLowerCase()
    );
    const registered = findProductOrMaterialData(presetName) || findProductOrMaterialData(preset.constantSelect || preset.id);

    const nameVal = material ? material.nome : (registered ? registered.name : presetName);
    const descVal = (material && material.descricao && material.descricao.trim() !== '')
      ? material.descricao.trim()
      : nameVal;
    const kVal = material ? material.k : (registered ? registered.k : (preset.constant ?? 0.00785));
    const precoVal = material ? material.precoKg : (registered ? registered.precoKg : (preset.defaultPriceKg ?? 22.00));
    const tipoVal = material ? material.tipo : (registered ? registered.tipo : (preset.geometryType || 'chapa'));
    const precoKgStr = precoVal.toFixed(2).replace('.', ',');
    const kStr = kVal.toString();

    setItemDescription(descVal);
    setItemConstantName(nameVal);
    if (material?.id || registered?.id || preset.constantSelect) {
      setItemConstantSelect(material?.id || registered?.id || preset.constantSelect);
    }
    setItemGeometryType(tipoVal);
    setItemConstant(kStr);
    setItemPricePerKg(precoKgStr);
    setIsManualUnitPrice(false);
    setDescriptionSearchQuery('');
    setDescriptionHighlightIndex(0);
    setIsDescriptionOpen(false);

    if (isRetalhoOrMaoDeObra(nameVal, descVal)) {
      setItemDiameter('');
      setItemThickness('');
      setItemWidthMm('');
      setItemLengthMm('');
      setItemWidthLength('');
      setItemManualUnitWeightKg('0');
      setItemUnitPrice(precoVal > 0 ? precoVal.toFixed(2).replace('.', ',') : '');
      focusNextField('observacao');
      return;
    }

    updateCascadingUnitPrice(
      precoKgStr,
      kStr,
      tipoVal,
      itemWidthMm,
      itemLengthMm,
      itemDiameter,
      itemThickness
    );

    focusNextField('observacao');
  };

  // Combina todos os materiais cadastrados no Supabase (prioridade máxima) com presets para busca unificada
  const allDescriptionOptions = [
    ...activeMaterialProfiles.map(p => ({
      name: p.name,
      category: (p.tipo === 'chapa' ? 'Chapas & Desenhos' : p.tipo === 'bucha' ? 'Tubos & Buchas' : 'Trefilados & Eixos') as any,
      geometryType: p.tipo,
      constant: p.k,
      constantSelect: p.id,
      defaultPriceKg: p.defaultPriceKg,
      badge: `k=${p.k} • R$ ${p.defaultPriceKg.toFixed(2).replace('.', ',')}/Kg`,
      description: p.description || p.name,
      keywords: [p.name.toLowerCase(), p.id.toLowerCase(), p.tipo]
    })),
    ...PRODUCT_DESCRIPTION_PRESETS.filter(p => !activeMaterialProfiles.some(m => normalizeSearchText(m.name) === normalizeSearchText(p.name)))
  ];

  // Lista estritamente vinculada ao Cadastro de Produtos (tabela materiais do Supabase)
  const autocompleteMaterialOptions: AutocompleteOption[] = materials.map(m => ({
    id: m.id,
    nome: m.nome,
    tipo: m.tipo,
    k: m.k,
    precoKg: m.precoKg,
    sae: m.sae || '',
    norma: m.norma || '',
    descricao: m.descricao ? m.descricao.trim() : ''
  }));

  // Filter description presets em tempo real (suporta "oxi", "1045", "aço" com ou sem acento)
  const filteredDescriptionPresets = allDescriptionOptions.filter(preset => {
    if (descriptionCategoryFilter !== 'ALL' && preset.category !== descriptionCategoryFilter) {
      return false;
    }
    const query = (descriptionSearchQuery || '').trim();
    if (!query) return true;
    return matchesSearchQuery(
      query,
      preset.name,
      preset.description,
      preset.badge,
      preset.constant,
      ...(preset.keywords || [])
    );
  });

  // Add or Update item
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();

    if (!itemDescription.trim()) {
      setErrorMessage('Por favor, informe a descrição do item.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const rawUnitPriceNum = isSpecialItem
      ? (currentFormPriceKg > 0 ? currentFormPriceKg : (parseNumberBR(itemUnitPrice) || 0))
      : (parseNumberBR(itemUnitPrice) || calculatedUnitPrice);
    const unitPriceNum = isSpecialItem ? rawUnitPriceNum : Math.ceil(rawUnitPriceNum);
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

    const subtotal = isSpecialItem
      ? Number((qtyNum * unitPriceNum).toFixed(2))
      : calculateItemSubtotal(unitPriceNum, qtyNum);

    // Exact weight calculation according to user rules
    const { unitWeightKg: geoUnitWeightKg, totalWeightKg: geoTotalWeightKg } = calculateItemWeightKg({
      geometryType: itemGeometryType,
      constant: currentFormConstant,
      diameterMm: effectiveDiameterMm,
      thicknessMm: effectiveThicknessMm,
      widthMm: effectiveThicknessMm > 0 || effectiveDiameterMm > 0 ? effectiveWidthMm : effectiveWidthMm,
      lengthMm: effectiveLengthMm,
      quantity: qtyNum,
      diameterStr: itemDiameter,
      thicknessStr: itemThickness
    });

    const unitWeightKg = isSpecialItem ? 0 : geoUnitWeightKg;
    const totalWeightKg = isSpecialItem ? 0 : geoTotalWeightKg;

    const priceKgNum = isSpecialItem
      ? unitPriceNum
      : (parseNumberBR(itemPricePerKg) || (unitWeightKg > 0 ? unitPriceNum / unitWeightKg : undefined));

    const formattedWidthLength = isSpecialItem
      ? '—'
      : (itemGeometryType === 'CHAPA_RETANGULO' || itemGeometryType === 'chapa'
          ? (effectiveWidthMm > 0 && effectiveLengthMm > 0 ? `${effectiveWidthMm} x ${effectiveLengthMm} mm` : itemWidthLength.trim() || '-')
          : (effectiveLengthMm > 0 ? `${effectiveLengthMm} mm` : itemWidthLength.trim() || '-'));

    const itemMatName = itemConstantName.trim() || (isSpecialItem ? itemDescription.trim() : 'CHAPA');
    const tempItemData = {
      geometryType: itemGeometryType,
      diameter: isSpecialItem ? '' : itemDiameter.trim(),
      thickness: isSpecialItem ? '' : itemThickness.trim(),
      measure: isSpecialItem ? '—' : (itemThickness.trim() || itemDiameter.trim()),
      widthMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
      lengthMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
      widthLength: formattedWidthLength,
      diameterMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
      thicknessMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined
    };
    const medidasFormatadas = isSpecialItem
      ? '—'
      : formatarMedidasLimpa(tempItemData);

    let updatedItemsList: QuoteItem[];

    if (editingItemId) {
      // Update existing item
      updatedItemsList = items.map(item => item.id === editingItemId ? {
        ...item,
        companyName: clientName || 'UsiCorte Cliente',
        description: itemDescription.trim() || itemMatName,
        descricao: itemDescription.trim() || itemMatName,
        constantName: itemMatName,
        constanteNome: itemMatName,
        material: itemMatName,
        produto: itemMatName,
        geometryType: itemGeometryType,
        constant: isSpecialItem ? '0' : (itemConstant.trim() || '0.00785'),
        pricePerKg: priceKgNum,
        measure: isSpecialItem ? '—' : (itemThickness.trim() || itemDiameter.trim()),
        thickness: isSpecialItem ? '' : itemThickness.trim(),
        espessura: isSpecialItem ? '' : itemThickness.trim(),
        thicknessMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined,
        espessuraMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined,
        diameter: isSpecialItem ? '' : itemDiameter.trim(),
        diametro: isSpecialItem ? '' : itemDiameter.trim(),
        diameterMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
        diametroMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
        widthLength: formattedWidthLength,
        widthMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
        largura: isSpecialItem ? '' : itemWidthMm.trim(),
        larguraMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
        lengthMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
        comprimento: isSpecialItem ? '' : itemLengthMm.trim(),
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
        fotoDesenho: itemDrawingImage || undefined,
        ncm: item.ncm || findProductOrMaterialData(itemMatName)?.ncm || '72085200',
        cfop_interno: item.cfop_interno || findProductOrMaterialData(itemMatName)?.cfop_interno || '5102',
        cfop_externo: item.cfop_externo || findProductOrMaterialData(itemMatName)?.cfop_externo || '6102',
        unidade_medida: item.unidade_medida || findProductOrMaterialData(itemMatName)?.unidade_medida || 'PC',
        unidadeMedida: item.unidadeMedida || findProductOrMaterialData(itemMatName)?.unidade_medida || 'PC',
        csosn: (!item.csosn || item.csosn.includes('102') || item.csosn.includes('101')) 
          ? '101 - Com permissão de crédito' 
          : (findProductOrMaterialData(itemMatName)?.csosn || '101 - Com permissão de crédito')
      } : item);

      setItems(updatedItemsList);
      setSuccessMessage('Item atualizado com sucesso!');
      setEditingItemId(null);
    } else {
      // Add new item
      const fiscalData = findProductOrMaterialData(itemMatName) || findProductOrMaterialData(itemConstantSelect) || findProductOrMaterialData(selectedMaterial?.id) || findProductOrMaterialData(itemDescription);
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
        constant: isSpecialItem ? '0' : (itemConstant.trim() || '0.00785'),
        pricePerKg: priceKgNum,
        measure: isSpecialItem ? '—' : (itemThickness.trim() || itemDiameter.trim()),
        thickness: isSpecialItem ? '' : itemThickness.trim(),
        espessura: isSpecialItem ? '' : itemThickness.trim(),
        thicknessMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined,
        espessuraMm: effectiveThicknessMm > 0 ? effectiveThicknessMm : undefined,
        diameter: isSpecialItem ? '' : itemDiameter.trim(),
        diametro: isSpecialItem ? '' : itemDiameter.trim(),
        diameterMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
        diametroMm: effectiveDiameterMm > 0 ? effectiveDiameterMm : undefined,
        widthLength: formattedWidthLength,
        widthMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
        largura: isSpecialItem ? '' : itemWidthMm.trim(),
        larguraMm: effectiveWidthMm > 0 ? effectiveWidthMm : undefined,
        lengthMm: effectiveLengthMm > 0 ? effectiveLengthMm : undefined,
        comprimento: isSpecialItem ? '' : itemLengthMm.trim(),
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
        fotoDesenho: itemDrawingImage || undefined,
        // Campos fiscais herdados automaticamente do material selecionado
        ncm: fiscalData?.ncm || '72085200',
        cfop_interno: fiscalData?.cfop_interno || '5102',
        cfop_externo: fiscalData?.cfop_externo || '6102',
        unidade_medida: fiscalData?.unidade_medida || 'PC',
        unidadeMedida: fiscalData?.unidade_medida || 'PC',
        csosn: (!fiscalData?.csosn || fiscalData.csosn.includes('102') || fiscalData.csosn.includes('101')) 
          ? '101 - Com permissão de crédito' 
          : fiscalData.csosn
      };

      updatedItemsList = [...items, newItem];
      setItems(updatedItemsList);
      setSuccessMessage('Item adicionado à cotação com sucesso!');
    }

    // 3. Atualização no Banco de Dados / Estado:
    // Salva automaticamente o Peso (Kg), Valor Unitário (R$) e Subtotal (R$) na lista do orçamento/pedido no Supabase
    const cleanNum = numeroCotacao.trim();
    if (cleanNum && updatedItemsList.length > 0) {
      const targetId = editingQuoteId || cleanNum;
      const newSubtotalTotal = Number(updatedItemsList.reduce((sum, it) => sum + it.subtotal, 0).toFixed(2));
      const newGrandTotal = Number(Math.max(0, newSubtotalTotal - discountAmount + shippingAmount).toFixed(2));
      const newTotalWeightKg = Number(updatedItemsList.reduce((sum, it) => sum + (Number(it.totalWeightKg) || 0), 0).toFixed(3));

      const quoteToSync: Quote = {
        id: targetId,
        quoteNumber: cleanNum,
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
        items: updatedItemsList,
        discount: discountAmount,
        discountPercent: 0,
        shipping: shippingAmount,
        subtotalTotal: newSubtotalTotal,
        grandTotal: newGrandTotal,
        totalWeightKg: newTotalWeightKg,
        observations: observations,
        createdAt: editingQuoteCreatedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const existsIdx = savedQuotes.findIndex(
        q => (editingQuoteId && (q.id === editingQuoteId || String(q.id).toLowerCase() === String(editingQuoteId).toLowerCase())) ||
             (editingOriginalQuoteNumber && (
               (q.quoteNumber && q.quoteNumber.trim().toLowerCase() === editingOriginalQuoteNumber.trim().toLowerCase()) ||
               (q.id && String(q.id).trim().toLowerCase() === editingOriginalQuoteNumber.trim().toLowerCase())
             )) ||
             (q.quoteNumber && q.quoteNumber.trim().toLowerCase() === cleanNum.toLowerCase()) ||
             (q.id && q.id === cleanNum)
      );

      if (existsIdx >= 0) {
        const nextSaved = [...savedQuotes];
        nextSaved[existsIdx] = { ...savedQuotes[existsIdx], ...quoteToSync, id: savedQuotes[existsIdx].id || targetId };
        setSavedQuotes(nextSaved);
      } else {
        setSavedQuotes([quoteToSync, ...savedQuotes]);
      }
      setEditingOriginalQuoteNumber(cleanNum);
      editingQuoteNumberRef.current = cleanNum;

      saveCotacaoDb(quoteToSync).then(res => {
        if (res.data?.id) {
          setEditingQuoteId(res.data.id);
          editingQuoteIdRef.current = res.data.id;
        }
      }).catch(err => {
        console.warn('Aviso ao sincronizar item no Supabase:', err);
      });
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
    setItemManualUnitWeightKg('1');
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
    const matchMap = DADOS_MATERIAIS_MAP[matName] || activeMaterialProfiles.find(p => p.name.toLowerCase() === matName);
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
    const matchedProfile = activeMaterialProfiles.find(
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

    const isSpecEdit = isRetalhoOrMaoDeObra(resolvedConstantName, item.description || item.descricao || '');
    if (isSpecEdit) {
      setItemManualUnitWeightKg('0');
      setItemDiameter('');
      setItemThickness('');
      setItemWidthMm('');
      setItemLengthMm('');
      setItemWidthLength('');
      if (unitPriceVal > 0) {
        setItemPricePerKg(Number(unitPriceVal).toFixed(2).replace('.', ','));
      }
    } else {
      setItemManualUnitWeightKg('0');
    }

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
    const nextItems = [...items, duplicated];
    setItems(nextItems);
    setSuccessMessage('Item duplicado com sucesso!');
    setTimeout(() => setSuccessMessage(null), 2500);
    syncDraftUpdateToDb({}, nextItems);
  };

  const handleDeleteItem = (id: string) => {
    const nextItems = items.filter(i => i.id !== id);
    setItems(nextItems);
    if (editingItemId === id) {
      resetItemForm();
    }
    syncDraftUpdateToDb({}, nextItems);
  };

  // Calculations for quote totals and total weight com travas toFixed(2) e toFixed(3)
  const subtotalTotal = Number(items.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  const grandTotal = Number(Math.max(0, subtotalTotal - discountAmount + shippingAmount).toFixed(2));
  const totalItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalQuoteWeightKg = Number(items.reduce((sum, item) => sum + (Number(item.totalWeightKg) || 0), 0).toFixed(3));

  // Save full quote to history (localStorage & Supabase)
  const handleSaveFullQuote = async () => {
    if (isSavingQuote) return;

    if (items.length === 0) {
      setErrorMessage('Adicione pelo menos 1 item antes de salvar o orçamento.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const isEditing = !!(editingQuoteId || editingOriginalQuoteNumber);
    const cleanNum = numeroCotacao.trim();
    if (!cleanNum) {
      setErrorMessage('Informe um número válido para a cotação.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    // VALIDAÇÃO DE DUPLICIDADE: Não permitir gravar se já existir aquela cotação (exceto quando em modo edição da mesma)
    const duplicateCheck = checkQuoteNumberExists(cleanNum, editingOriginalQuoteNumber);
    if (duplicateCheck.exists) {
      const clientMsg = duplicateCheck.clientName ? ` (${duplicateCheck.clientName})` : '';
      setErrorMessage(
        `⚠️ A cotação "${cleanNum}" já existe no sistema${clientMsg}! Não é permitido salvar números duplicados. Escolha outro número.`
      );
      setTimeout(() => setErrorMessage(null), 6000);
      return;
    }

    // RESOLVE O ID CORRETO PARA ATUALIZAÇÃO (UPSERT):
    // Ao editar ou finalizar uma cotação reservada, garante que o sistema atualize o registro existente pelo ID
    const targetId = editingQuoteId || cleanNum;

    // Conforme instrução: Ao clicar em "Salvar / Finalizar", altera o status de 'RASCUNHO' para 'PENDENTE' (ou 'APROVADO')
    const finalStatus: Quote['status'] = (quoteStatus === 'Rascunho' || (quoteStatus as string) === 'RASCUNHO')
      ? 'Pendente'
      : quoteStatus;

    const currentQuoteObject: Quote = {
      id: targetId,
      quoteNumber: cleanNum,
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
      status: finalStatus,
      items: items,
      discount: discountAmount,
      discountPercent: 0,
      shipping: shippingAmount,
      subtotalTotal: subtotalTotal,
      grandTotal: grandTotal,
      totalWeightKg: totalQuoteWeightKg,
      observations: observations,
      createdAt: editingQuoteCreatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsSavingQuote(true);

    try {
      // 2. TRATAMENTO DE ERROS NO SALVAMENTO/EDIÇÃO:
      // Chamada assíncrona ao Supabase com try/catch. Caso falhe, exibe toast/alerta de erro e impede fechamento da tela.
      const saveRes = await saveCotacaoDb(currentQuoteObject, editingOriginalQuoteNumber || undefined);

      if (saveRes.error) {
        console.error('Erro retornado pelo Supabase ao gravar cotação:', saveRes.error);
        const errMsg = saveRes.error.message || (typeof saveRes.error === 'string' ? saveRes.error : 'Falha na comunicação com o banco de dados');
        setErrorMessage(`⚠️ Falha ao salvar cotação no banco de dados: ${errMsg}. Os dados permanecem na tela para não haver perda. Tente salvar novamente.`);
        setTimeout(() => setErrorMessage(null), 8000);
        return; // Interrompe imediatamente para NÃO simular sucesso nem abrir modal
      }

      // Se salvou com sucesso no Supabase, registra o ID oficial confirmado pelo banco
      const confirmedId = saveRes.data?.id || targetId;
      currentQuoteObject.id = confirmedId;
      setEditingQuoteId(confirmedId);
      editingQuoteIdRef.current = confirmedId;
      setEditingOriginalQuoteNumber(cleanNum);
      editingQuoteNumberRef.current = cleanNum;
      setQuoteStatus(finalStatus);
      quoteStatusRef.current = finalStatus;
      isSavedRef.current = true;

      // 3. Atualiza lista em memória e cache
      const existsIndex = savedQuotes.findIndex(
        q => (confirmedId && (q.id === confirmedId || String(q.id).toLowerCase() === String(confirmedId).toLowerCase())) ||
             (cleanNum && (q.quoteNumber && q.quoteNumber.trim().toLowerCase() === cleanNum.toLowerCase())) ||
             (editingOriginalQuoteNumber && (q.quoteNumber === editingOriginalQuoteNumber || q.id === editingOriginalQuoteNumber))
      );

      let updatedQuotes: Quote[];
      if (existsIndex >= 0) {
        updatedQuotes = [...savedQuotes];
        updatedQuotes[existsIndex] = {
          ...savedQuotes[existsIndex],
          ...currentQuoteObject,
          id: confirmedId
        };
      } else {
        updatedQuotes = [currentQuoteObject, ...savedQuotes];
      }
      setSavedQuotes(updatedQuotes);
      try { localStorage.removeItem('s_orcamentos'); } catch {}

      // Sequência Automática do Emitente
      const isAutoSequential = !isEditing && autoSuggestedNumber && cleanNum.toLowerCase() === autoSuggestedNumber.trim().toLowerCase();
      if (isAutoSequential) {
        incrementEmitenteQuoteSequential(autoSuggestedSeq).catch(err => {
          console.warn('Erro ao atualizar proximo_numero_sequencial no Supabase:', err);
        });
        const nextSeq = autoSuggestedSeq + 1;
        setAutoSuggestedSeq(nextSeq);
        const prefix = cleanNum.replace(/\d+$/, '');
        const nextNumStr = `${prefix}${String(nextSeq).padStart(6, '0')}`;
        setAutoSuggestedNumber(nextNumStr);
      }

      // Se a cotação estiver Aprovada ou Faturada, realiza a baixa no estoque
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

      // Normaliza os dados completos para emissão de qualquer modelo de impressão
      const normalizedSavedQuote = normalizeQuoteForPrint(currentQuoteObject);
      setLastSavedQuoteForPrint(normalizedSavedQuote);

      // Notificação Toast de Sucesso e abertura do Modal de Opções de Impressão
      setSuccessMessage(`✅ Orçamento ${cleanNum} salvo com sucesso no banco de dados!`);
      setShowPrintOptionsModal(true);

      setTimeout(() => {
        setSuccessMessage(null);
      }, 4500);

    } catch (err: any) {
      console.error('Exceção ao gravar cotação no Supabase:', err);
      setErrorMessage(`❌ Erro inesperado ao gravar no banco: ${err?.message || 'Falha de conexão'}. Seus dados foram mantidos na tela.`);
      setTimeout(() => setErrorMessage(null), 8000);
    } finally {
      setIsSavingQuote(false);
    }
  };

  // Aprovar cotação com 1 clique (baixa estoque + gera contas a receber + UPDATE direto no Supabase)
  const handleApproveAndDeductQuote = async () => {
    if (isSavingQuote) return;

    if (items.length === 0) {
      setErrorMessage('Adicione pelo menos 1 item antes de aprovar o orçamento.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    const isEditing = !!(editingQuoteId || editingOriginalQuoteNumber);
    const cleanNum = numeroCotacao.trim();
    if (!cleanNum) {
      setErrorMessage('Informe um número válido para a cotação.');
      setTimeout(() => setErrorMessage(null), 3500);
      return;
    }

    // VALIDAÇÃO DE DUPLICIDADE: Não permitir gravar se já existir aquela cotação
    const duplicateCheck = checkQuoteNumberExists(cleanNum, editingOriginalQuoteNumber);
    if (duplicateCheck.exists) {
      const clientMsg = duplicateCheck.clientName ? ` (${duplicateCheck.clientName})` : '';
      setErrorMessage(
        `⚠️ A cotação "${cleanNum}" já existe no sistema${clientMsg}! Não é permitido aprovar/gravar números duplicados.`
      );
      setTimeout(() => setErrorMessage(null), 6000);
      return;
    }

    const targetId = editingQuoteId || cleanNum;

    const currentQuoteObject: Quote = {
      id: targetId,
      quoteNumber: cleanNum,
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
      createdAt: editingQuoteCreatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setIsSavingQuote(true);

    try {
      // Gravação direta no Supabase com try/catch e verificação de erro
      const saveRes = await saveCotacaoDb(currentQuoteObject, editingOriginalQuoteNumber || undefined);

      if (saveRes.error) {
        console.error('Erro retornado pelo Supabase ao aprovar cotação:', saveRes.error);
        const errMsg = saveRes.error.message || 'Falha de comunicação';
        setErrorMessage(`⚠️ Erro ao salvar cotação aprovada no Supabase: ${errMsg}. Os dados permanecem na tela para nova tentativa.`);
        setTimeout(() => setErrorMessage(null), 8000);
        return; // Interrompe para não simular aprovação se falhou no Supabase
      }

      const confirmedId = saveRes.data?.id || targetId;
      currentQuoteObject.id = confirmedId;
      setEditingQuoteId(confirmedId);
      editingQuoteIdRef.current = confirmedId;
      setEditingOriginalQuoteNumber(cleanNum);
      editingQuoteNumberRef.current = cleanNum;
      setQuoteStatus('Aprovado');
      quoteStatusRef.current = 'Aprovado';
      isSavedRef.current = true;

      // Executa baixa de estoque e contas a receber
      const baixaRes = baixarEstoquePorCotacao(currentQuoteObject);
      const finRes = gerarContasReceberPorCotacao(currentQuoteObject);

      // Atualiza lista em memória
      const existsIndex = savedQuotes.findIndex(
        q => (confirmedId && (q.id === confirmedId || String(q.id).toLowerCase() === String(confirmedId).toLowerCase())) ||
             (cleanNum && q.quoteNumber && q.quoteNumber.trim().toLowerCase() === cleanNum.toLowerCase()) ||
             (editingOriginalQuoteNumber && (q.quoteNumber === editingOriginalQuoteNumber || q.id === editingOriginalQuoteNumber))
      );

      let updatedQuotes: Quote[];
      if (existsIndex >= 0) {
        updatedQuotes = [...savedQuotes];
        updatedQuotes[existsIndex] = {
          ...savedQuotes[existsIndex],
          ...currentQuoteObject,
          id: confirmedId
        };
      } else {
        updatedQuotes = [currentQuoteObject, ...savedQuotes];
      }
      setSavedQuotes(updatedQuotes);
      try { localStorage.removeItem('s_orcamentos'); } catch {}

      // Sequência automática do emitente
      const isAutoSequential = !isEditing && autoSuggestedNumber && cleanNum.toLowerCase() === autoSuggestedNumber.trim().toLowerCase();
      if (isAutoSequential) {
        incrementEmitenteQuoteSequential(autoSuggestedSeq).catch(err => {
          console.warn('Erro ao atualizar proximo_numero_sequencial no Supabase:', err);
        });
        const nextSeq = autoSuggestedSeq + 1;
        setAutoSuggestedSeq(nextSeq);
        const prefix = cleanNum.replace(/\d+$/, '');
        const nextNumStr = `${prefix}${String(nextSeq).padStart(6, '0')}`;
        setAutoSuggestedNumber(nextNumStr);
      } else {
        console.log(`[Cotação] Número manual "${cleanNum}" aprovado. Sequência do emitente preservada intacta.`);
      }

      setSuccessMessage(`✅ Cotação ${cleanNum} APROVADA e salva com sucesso no banco de dados! ${baixaRes.itensBaixados} itens baixados no Estoque (${baixaRes.pesoTotalBaixadoKg} kg) e R$ ${formatCurrency(grandTotal)} lançado no Contas a Receber!`);
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error('Exceção ao aprovar cotação no Supabase:', err);
      setErrorMessage(`❌ Erro inesperado ao aprovar no banco: ${err?.message || 'Falha de conexão'}. Seus dados permanecem intactos na tela.`);
      setTimeout(() => setErrorMessage(null), 8000);
    } finally {
      setIsSavingQuote(false);
    }
  };

  // FLUXO AUTOMÁTICO PARA PRÓXIMA COTAÇÃO AO SALVAR/IMPRIMIR OU AO CLICAR EM NOVA COTAÇÃO
  // 1. Caso o rascunho anterior estivesse vazio e em status Rascunho, descarta no Supabase
  // 2. Reserva IMEDIATAMENTE uma nova cotação atômica no Supabase com status: 'RASCUNHO'
  // 3. Posiciona o foco (.focus()) automaticamente no primeiro campo de digitação
  const handleAdvanceToNextQuote = async (showNotification = true) => {
    // Se o rascunho anterior estava totalmente vazio (sem itens e status Rascunho), descarta para não acumular
    if (editingQuoteId && items.length === 0 && (quoteStatus === 'Rascunho' || (quoteStatus as string) === 'RASCUNHO')) {
      cancelarOuDescartarRascunho(editingQuoteId, numeroCotacao).catch(() => {});
    }

    setEditingQuoteId(null);
    setEditingOriginalQuoteNumber(null);
    setEditingQuoteCreatedAt(null);
    editingQuoteIdRef.current = null;
    editingQuoteNumberRef.current = null;

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
    setQuoteStatus('Rascunho');
    setItems([]);
    setDiscountAmount(0);
    setShippingAmount(0);
    setObservations('Preços com impostos inclusos. Material sujeito a conferência no ato do recebimento.');
    resetItemForm();

    setIsReservingQuote(true);
    try {
      const res = await reservarNovaCotacaoNoSupabase();
      if (res?.numero) {
        setNumeroCotacao(res.numero);
        setAutoSuggestedNumber(res.numero);
        setEditingQuoteId(res.id);
        setEditingOriginalQuoteNumber(res.numero);
        editingQuoteIdRef.current = res.id;
        editingQuoteNumberRef.current = res.numero;
        setQuoteStatus('Rascunho');
        quoteStatusRef.current = 'Rascunho';
        isSavedRef.current = false;
        if (showNotification) {
          setSuccessMessage(`🔒 Reserva atômica: Cotação Nº ${res.numero} gravada como Rascunho no Supabase!`);
          setTimeout(() => setSuccessMessage(null), 3500);
        }
      }
    } catch (err) {
      console.warn('Erro ao reservar próxima cotação no Supabase:', err);
    } finally {
      setIsReservingQuote(false);
    }

    // Posiciona o foco (.focus()) automaticamente no primeiro campo de digitação (Busca de Cliente ou Inserção de Produto)
    setTimeout(() => {
      if (clientSelectRef.current) {
        clientSelectRef.current.focus();
      } else if (clientNameInputRef.current) {
        clientNameInputRef.current.focus();
      } else if (constantInputRef.current) {
        constantInputRef.current.focus();
      }
    }, 150);
  };

  const handleDiscardCurrentDraft = async () => {
    if (!editingQuoteId) return;
    if (confirm(`Deseja realmente cancelar e descartar o rascunho da cotação Nº ${numeroCotacao}?`)) {
      setIsSavingQuote(true);
      try {
        await cancelarOuDescartarRascunho(editingQuoteId, numeroCotacao);
        setSuccessMessage(`Rascunho da cotação Nº ${numeroCotacao} descartado com sucesso.`);
        setTimeout(() => setSuccessMessage(null), 3500);
        await handleAdvanceToNextQuote(false);
      } catch (e) {
        console.warn('Erro ao descartar rascunho:', e);
      } finally {
        setIsSavingQuote(false);
      }
    }
  };

  const [isPurgingDrafts, setIsPurgingDrafts] = useState<boolean>(false);

  const handlePurgeEmptyDrafts = async () => {
    if (!confirm('Deseja realmente limpar todos os rascunhos vazios acumulados no banco de dados e recalcular a numeração sequencial correta?')) {
      return;
    }
    setIsPurgingDrafts(true);
    try {
      const res = await limparRascunhosVaziosDb();
      if (res.success) {
        setSuccessMessage(`🧹 Limpeza concluída: ${res.purgedCount} rascunhos vazios limpos do Supabase! Próxima cotação: ${res.nextQuoteNumber || 'recalculada'}.`);
        if (res.nextQuoteNumber) {
          setNumeroCotacao(res.nextQuoteNumber);
          setAutoSuggestedNumber(res.nextQuoteNumber);
        }
        await loadQuotesFromDb();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setErrorMessage('Aviso na limpeza de rascunhos: ' + (res.error?.message || 'Falha'));
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } catch (err: any) {
      setErrorMessage('Erro ao limpar rascunhos: ' + (err?.message || 'Erro'));
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setIsPurgingDrafts(false);
    }
  };

  // Mantém a referência sincronizada para o listener onafterprint
  useEffect(() => {
    handleAdvanceToNextQuoteRef.current = () => handleAdvanceToNextQuote(true);
  });

  const handleNewQuote = () => handleAdvanceToNextQuote(true);

  // Load a quote from history modal / edit action - MANTÉM FIXO o número e ID original
  const handleLoadQuoteFromHistory = (quote: Quote) => {
    const targetId = quote.id || null;
    const targetNum = quote.quoteNumber || quote.id || '';
    
    setEditingQuoteId(targetId);
    setEditingOriginalQuoteNumber(targetNum);
    setEditingQuoteCreatedAt(quote.createdAt || new Date().toISOString());
    editingQuoteIdRef.current = targetId;
    editingQuoteNumberRef.current = targetNum;

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
    isSavedRef.current = true;

    setSuccessMessage(`Orçamento ${targetNum} carregado para edição com número e ID preservados!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Carrega dados de uma cotação para Duplicação no PDV, gerando um NOVO número sequencial e mantendo a cotação original intacta
  const handleLoadQuoteForDuplication = async (payload: { quote: Quote; originalNumber: string }) => {
    const { quote, originalNumber } = payload;
    const oldNumber = originalNumber || quote.quoteNumber || 'antiga';

    // 1. Zera dados de edição para garantir que NUNCA sobrescreva a cotação original no banco de dados
    setEditingQuoteId(null);
    setEditingOriginalQuoteNumber(null);
    setEditingQuoteCreatedAt(null);
    editingQuoteIdRef.current = null;
    editingQuoteNumberRef.current = null;

    // 2. Resolve e RESERVA IMEDIATAMENTE um NOVO número e rascunho atômico no Supabase
    setIsReservingQuote(true);
    let nextUniqueNumber = generateNextQuoteNumber(savedQuotes);
    try {
      const res = await reservarNovaCotacaoNoSupabase();
      if (res?.numero) {
        nextUniqueNumber = res.numero;
        setAutoSuggestedNumber(res.numero);
        setEditingQuoteId(res.id);
        setEditingOriginalQuoteNumber(res.numero);
        editingQuoteIdRef.current = res.id;
        editingQuoteNumberRef.current = res.numero;
        setQuoteStatus('Rascunho');
      }
    } catch (err) {
      console.warn('Aviso ao gerar nova numeração sequencial para duplicação:', err);
    } finally {
      setIsReservingQuote(false);
    }
    setNumeroCotacao(nextUniqueNumber);

    // 3. Preenche dados do cliente
    setSelectedClientId(quote.clientId || '');
    setClientName(quote.clientName || 'Cliente Balcão (UsiCorte)');
    setClientDocument(quote.clientDocument || '');
    setContactPerson(quote.contactPerson || '');
    setClientPhone(quote.clientPhone || '');
    setClientEmail(quote.clientEmail || '');
    setClientCity(quote.clientCity || '');
    setClientState(quote.clientState || '');

    // 4. Preenche cabeçalho do orçamento
    setQuoteDate(new Date().toISOString().split('T')[0]);
    setValidityDays(quote.validityDays || 10);
    setPaymentTerms(quote.paymentTerms || 'À Vista / Pix (3% Desc.)');
    setQuoteStatus('Pendente');
    setObservations(quote.observations || 'Preços com impostos inclusos. Material sujeito a conferência no ato do recebimento.');
    setDiscountAmount(quote.discount || 0);
    setShippingAmount(quote.shipping || 0);

    // 5. Clona todos os itens com IDs novos para o novo pedido
    const clonedItems: QuoteItem[] = (quote.items || []).map((it, idx) => ({
      ...it,
      id: `item-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 6)}`,
      date: new Date().toISOString().split('T')[0],
      subtotal: Number(it.subtotal || ((Number(it.unitPrice || (it as any).valorUnitario || 0)) * Number(it.quantity || (it as any).qtd || 1)))
    }));
    setItems(clonedItems);

    // 6. Reseta formulário de inclusão de item
    resetItemForm();

    // 7. Toast de confirmação com a mensagem exata requerida:
    // "Dados da cotação [NÚMERO_ANTIGO] carregados no PDV. Um novo número de pedido foi gerado."
    setSuccessMessage(`Dados da cotação ${oldNumber} carregados no PDV. Um novo número de pedido foi gerado.`);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Delete quote from history (soft delete)
  const handleDeleteSavedQuote = async (id: string) => {
    const quoteToDelete = savedQuotes.find(q => q.id === id || q.quoteNumber === id);
    if (!quoteToDelete) return;

    try {
      const res = await deleteCotacaoDb(quoteToDelete.id || quoteToDelete.quoteNumber);
      if (res?.error) {
        console.warn('Erro ao aplicar soft delete na cotação:', res.error);
        setErrorMessage(`Erro ao excluir cotação: ${res.error.message || 'Falha de comunicação'}`);
        setTimeout(() => setErrorMessage(null), 5000);
        return;
      }

      const updated = savedQuotes.filter(q => q.id !== id && q.quoteNumber !== id && q.id !== quoteToDelete.id && q.quoteNumber !== quoteToDelete.quoteNumber);
      setSavedQuotes(updated);
      try { localStorage.removeItem('s_orcamentos'); } catch {}

      setSuccessMessage(`Cotação ${quoteToDelete.quoteNumber || quoteToDelete.id} excluída com sucesso!`);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: any) {
      console.warn('Erro ao deletar cotação no Supabase:', err);
      setErrorMessage(`Erro ao excluir cotação: ${err?.message || 'Falha de rede'}`);
      setTimeout(() => setErrorMessage(null), 5000);
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
          {/* BARRA DE AÇÕES FISCAIS (NF-E) QUANDO AUTORIZADA OU CANCELADA */}
          {(() => {
            const cleanNum = numeroCotacao.trim();
            const matchedQuote = savedQuotes.find(
              q => (editingQuoteId && (q.id === editingQuoteId || String(q.id).toLowerCase() === String(editingQuoteId).toLowerCase())) ||
                   (editingOriginalQuoteNumber && (q.quoteNumber === editingOriginalQuoteNumber || q.id === editingOriginalQuoteNumber)) ||
                   (cleanNum && (q.quoteNumber === cleanNum || q.id === cleanNum))
            ) || lastSavedQuoteForPrint;

            if (!matchedQuote) return null;

            const isAutorizada = isNfeAutorizada(matchedQuote.status_nfe);
            const isCancelada = isNfeCancelada(matchedQuote.status_nfe);

            if (isAutorizada) {
              const resolvedCl = clients.find(c => c.id === matchedQuote.clientId || (matchedQuote.clientDocument && c.document === matchedQuote.clientDocument)) || null;
              return (
                <div className="flex items-center gap-1.5 p-1 bg-emerald-950/40 border border-emerald-500/40 rounded-xl">
                  <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1 px-1.5 hidden sm:flex">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    NF-e #{matchedQuote.nfe_numero || ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => abrirDanfeEmNovaAba(matchedQuote, resolvedCl)}
                    className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition cursor-pointer shadow-xs"
                    title="Visualizar DANFE A4 oficial"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>VER DANFE</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => obterOuBaixarXmlNfe(matchedQuote, resolvedCl)}
                    className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition cursor-pointer shadow-xs"
                    title="Baixar XML oficial autorizado pela SEFAZ"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>BAIXAR XML</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteForCancelNfe(matchedQuote)}
                    className="px-2.5 py-1.5 bg-rose-700 hover:bg-rose-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 transition cursor-pointer shadow-xs"
                    title="Cancelar NF-e Homologada na SEFAZ (Status 101)"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>CANCELAR NF-E</span>
                  </button>
                </div>
              );
            }

            if (isCancelada) {
              const resolvedCl = clients.find(c => c.id === matchedQuote.clientId || (matchedQuote.clientDocument && c.document === matchedQuote.clientDocument)) || null;
              return (
                <div className="flex items-center gap-1.5 p-1 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-bold">
                  <span className="flex items-center gap-1 px-1.5">
                    <Ban className="w-3.5 h-3.5 text-rose-400" />
                    <span>NF-e Cancelada</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => abrirDanfeEmNovaAba(matchedQuote, resolvedCl)}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-200 text-xs font-bold rounded-lg transition cursor-pointer"
                    title="Visualizar DANFE cancelada com tarja SEM VALOR FISCAL"
                  >
                    DANFE Cancelada
                  </button>
                </div>
              );
            }

            return null;
          })()}

          {editingQuoteId && (quoteStatus === 'Rascunho' || (quoteStatus as string) === 'RASCUNHO') && (
            <button
              type="button"
              onClick={handleDiscardCurrentDraft}
              disabled={isSavingQuote || isReservingQuote}
              className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Descarta o rascunho atual reservado no Supabase e inicia uma nova cotação"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              Descartar Rascunho
            </button>
          )}

          <button
            type="button"
            onClick={handlePurgeEmptyDrafts}
            disabled={isPurgingDrafts}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Limpa rascunhos vazios acumulados no banco de dados e recalcula a sequência oficial (ex: COT-2026-000990)"
          >
            {isPurgingDrafts ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            )}
            Limpar Rascunhos Vazios
          </button>

          <button
            onClick={() => handleAdvanceToNextQuote(true)}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Limpa todos os campos, gera a nova numeração sequencial e posiciona o foco no primeiro campo"
          >
            <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
            Nova Cotação
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
            {(() => {
              const cleanNum = numeroCotacao.trim();
              const duplicateStatus = checkQuoteNumberExists(numeroCotacao, editingOriginalQuoteNumber);
              const isDuplicate = duplicateStatus.exists;
              const isEditing = !!(editingQuoteId || editingOriginalQuoteNumber);
              const isCustomNumber = !!(autoSuggestedNumber && cleanNum && cleanNum.toLowerCase() !== autoSuggestedNumber.trim().toLowerCase());

              return (
                <div className={`px-3 py-2 border rounded-xl min-w-[260px] transition-all ${
                  isDuplicate 
                    ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20' 
                    : isCheckingDbDuplicate
                    ? 'bg-indigo-50/50 border-indigo-200'
                    : isCustomNumber
                    ? 'bg-amber-50/50 border-amber-200 focus-within:border-amber-500 focus-within:bg-white'
                    : 'bg-slate-50 border-slate-200 focus-within:border-indigo-500 focus-within:bg-white'
                }`}>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label htmlFor="quote-number-input" className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">
                      Cotação Nº {isCustomNumber && <span className="text-amber-600 font-normal lowercase">(manual)</span>}
                    </label>
                    <div className="flex items-center gap-1">
                      {isReservingQuote ? (
                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-600" /> Reservando...
                        </span>
                      ) : isCheckingDbDuplicate ? (
                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-600" /> Verificando...
                        </span>
                      ) : editingQuoteId && (quoteStatus === 'Rascunho' || (quoteStatus as string) === 'RASCUNHO') ? (
                        <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md flex items-center gap-1" title="Número atômico reservado no Supabase para este computador">
                          <Lock className="w-2.5 h-2.5 text-amber-700" /> Rascunho Reservado
                        </span>
                      ) : isDuplicate ? (
                        <span className="text-[9px] font-black text-rose-700 bg-rose-100 border border-rose-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 animate-pulse" title={`Cotação já cadastrada para: ${duplicateStatus.clientName || 'Outro cliente'}`}>
                          <AlertCircle className="w-2.5 h-2.5" /> Já Existe!
                        </span>
                      ) : cleanNum ? (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5" title="Número livre e pronto para salvar">
                          <Check className="w-2.5 h-2.5" /> Disponível
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                          Vazio
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      id="quote-number-input"
                      type="text"
                      value={numeroCotacao}
                      onChange={(e) => setNumeroCotacao(e.target.value)}
                      placeholder={isReservingQuote ? "Reservando cotação no banco..." : "Ex: COT-2026-000140 ou 5000"}
                      disabled={isReservingQuote}
                      title="Número da cotação editável livremente. Você pode apagar e digitar qualquer número específico ou aleatório."
                      className={`w-full bg-transparent text-xs font-mono font-black outline-none transition-colors ${
                        isDuplicate 
                          ? 'text-rose-700 focus:text-rose-950' 
                          : isCustomNumber
                          ? 'text-amber-900 focus:text-amber-950'
                          : 'text-indigo-700 focus:text-indigo-950'
                      }`}
                    />
                  </div>

                  {/* Informações contextuais e botões rápidos */}
                  {isDuplicate ? (
                    <div className="mt-1.5 pt-1 border-t border-rose-200 text-[10px] text-rose-700 font-medium flex items-center justify-between">
                      <span className="truncate max-w-[140px]" title={duplicateStatus.clientName}>
                        {duplicateStatus.clientName ? `Cliente: ${duplicateStatus.clientName}` : 'Já cadastrado no banco'}
                      </span>
                      {autoSuggestedNumber && autoSuggestedNumber !== numeroCotacao.trim() && (
                        <button
                          type="button"
                          onClick={() => setNumeroCotacao(autoSuggestedNumber)}
                          className="text-indigo-700 font-black underline hover:text-indigo-950 cursor-pointer ml-1 text-[10px]"
                          title="Restaurar sequencial automático do emitente"
                        >
                          Usar {autoSuggestedNumber}
                        </button>
                      )}
                    </div>
                  ) : isCustomNumber && autoSuggestedNumber ? (
                    <div className="mt-1 pt-0.5 border-t border-amber-200/60 text-[9px] text-amber-700 font-medium flex items-center justify-between">
                      <span className="truncate" title="A numeração sequencial do emitente será preservada intacta ao salvar">
                        Sequência original preservada
                      </span>
                      <button
                        type="button"
                        onClick={() => setNumeroCotacao(autoSuggestedNumber)}
                        className="text-amber-900 font-bold underline hover:text-amber-950 cursor-pointer ml-1 text-[9px]"
                        title={`Voltar para o sequencial padrão sugerido (${autoSuggestedNumber})`}
                      >
                        Restaurar padrão
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })()}
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
              ref={clientSelectRef}
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
              ref={clientNameInputRef}
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
      <div id="item-input-form" className="bg-white rounded-2xl border-2 border-indigo-200/90 p-6 shadow-sm space-y-6 relative overflow-visible">
        
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
            
            {/* Constante / Material com Componente Autocomplete Flutuante (z-50) */}
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

              <MaterialAutocomplete
                id="constante"
                inputRef={constantInputRef}
                value={itemConstantName}
                options={autocompleteMaterialOptions}
                placeholder="Digite ex: oxi, 1045, aço, bronze..."
                currentK={currentFormConstant}
                currentPriceKg={itemPricePerKg}
                onChangeText={(txt) => {
                  setItemConstantName(txt);
                  setConstantSearchQuery(txt);
                  // No evento onChange do campo "Constante / Material":
                  // a) Localiza o objeto do material selecionado na lista carregada do Supabase
                  const material = materials.find(
                    m => m.nome.trim().toLowerCase() === txt.trim().toLowerCase() ||
                         m.id.trim().toLowerCase() === txt.trim().toLowerCase()
                  );
                  let nextDesc = itemDescription;
                  if (material) {
                    // b) Preenche automaticamente "Descrição do Produto / Serviço" com material.descricao
                    // c) Se material.descricao estiver vazio ou não definido, utiliza material.nome
                    const descAuto = material.descricao && material.descricao.trim() !== ''
                      ? material.descricao.trim()
                      : material.nome;
                    nextDesc = descAuto;
                    setItemDescription(descAuto);
                    setItemConstantSelect(material.id);
                    setItemGeometryType(material.tipo);
                    setItemConstant(String(material.k));
                    setItemPricePerKg(material.precoKg.toFixed(2).replace('.', ','));
                  }
                  const normTxt = txt.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  if (isRetalhoOrMaoDeObra(txt, nextDesc)) {
                    setItemDiameter('');
                    setItemThickness('');
                    setItemWidthMm('');
                    setItemLengthMm('');
                    setItemWidthLength('');
                    if (normTxt === 'retalho' || normTxt === 'mao de obra') {
                      if (!material && normTxt === 'retalho') {
                        setItemDescription(nextDesc || 'RETALHO');
                        setItemConstant('0');
                        setItemPricePerKg('15,00');
                      } else if (!material && normTxt === 'mao de obra') {
                        setItemDescription(nextDesc || 'MÃO DE OBRA');
                        setItemConstant('0');
                      }
                      focusNextField('qtd');
                    }
                  }
                }}
                onSelectOption={(opt) => {
                  const material = materials.find(
                    m => m.id === opt.id || m.nome.toLowerCase() === opt.nome.toLowerCase()
                  );
                  const descAuto = (material && material.descricao && material.descricao.trim() !== '')
                    ? material.descricao.trim()
                    : (material ? material.nome : opt.nome);
                  handleSelectMaterialProfile({
                    id: opt.id,
                    name: opt.nome,
                    tipo: opt.tipo,
                    k: opt.k,
                    defaultPriceKg: opt.precoKg,
                    description: descAuto
                  });
                }}
                onAdvanceFocus={() => {
                  if (isRetalhoOrMaoDeObra(itemConstantName, itemDescription)) {
                    focusNextField('qtd');
                  } else if (itemGeometryType === 'chapa' || itemGeometryType === 'CHAPA_RETANGULO') {
                    focusNextField('espessura');
                  } else {
                    focusNextField('diametro');
                  }
                }}
                inputClassName="w-full pl-3 pr-8 py-2 bg-white border border-slate-300 hover:border-indigo-500 focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-800 shadow-2xs transition-all outline-hidden"
              />
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
                placeholder={isSpecialItem ? '—' : (itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA' ? 'Ø Ext' : 'Ø mm')}
                value={itemDiameter}
                disabled={isSpecialItem || itemGeometryType === 'chapa' || itemGeometryType === 'CHAPA_RETANGULO'}
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
                    if (isSpecialItem) {
                      focusNextField('qtd');
                    } else if (itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA') {
                      focusNextField('espessura');
                    } else {
                      focusNextField('comprimento');
                    }
                  }
                }}
                className={`w-full px-2 py-2 border rounded-xl text-xs font-mono font-bold text-center outline-hidden transition-all ${
                  isSpecialItem || itemGeometryType === 'chapa' || itemGeometryType === 'CHAPA_RETANGULO'
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
                placeholder={isSpecialItem ? '—' : (itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA' ? 'Ø Int' : 'Esp mm')}
                value={itemThickness}
                disabled={isSpecialItem || itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO'}
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
                    if (isSpecialItem) {
                      focusNextField('qtd');
                    } else if (itemGeometryType === 'chapa') {
                      focusNextField('largura');
                    } else {
                      focusNextField('comprimento');
                    }
                  }
                }}
                className={`w-full px-2 py-2 border rounded-xl text-xs font-mono font-bold text-center outline-hidden transition-all ${
                  isSpecialItem || itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO'
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
                placeholder={isSpecialItem ? '—' : '0'}
                value={itemWidthMm}
                disabled={isSpecialItem || itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO' || itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA'}
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
                    focusNextField(isSpecialItem ? 'qtd' : 'comprimento');
                  }
                }}
                className={`w-full px-2 py-2 border rounded-xl text-xs font-mono font-bold text-center outline-hidden transition-all ${
                  isSpecialItem || itemGeometryType === 'macico' || itemGeometryType === 'REDONDO_QUADRADO' || itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA'
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
                placeholder={isSpecialItem ? '—' : '0'}
                value={itemLengthMm}
                disabled={isSpecialItem}
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
                    focusNextField(isSpecialItem ? 'qtd' : 'descricao');
                  }
                }}
                className={`w-full px-2 py-2 border rounded-xl text-xs font-mono font-bold text-center outline-hidden transition-all ${
                  isSpecialItem
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-slate-800 border-slate-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500'
                }`}
              />
            </div>

            {/* Descrição do Produto / Serviço (100% limpa do Cadastro de Produtos + Edição Manual Livre) */}
            <div className="field relative w-full md:flex-1 min-w-[220px] space-y-1" ref={descriptionComboboxRef}>
              <label htmlFor="descricao" className="block text-xs font-bold text-slate-700 flex items-center justify-between">
                <span className="truncate">Descrição do Produto / Serviço *</span>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded shrink-0">
                  R$ {itemPricePerKg}/Kg • k={currentFormConstant}
                </span>
              </label>

              <input
                id="descricao"
                ref={descriptionInputRef}
                type="text"
                value={itemDescription}
                placeholder="Preenchido pelo material ou digite manualmente..."
                required
                autoComplete="off"
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const txt = e.target.value;
                  setItemDescription(txt);
                  const normTxt = txt.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  if (isRetalhoOrMaoDeObra(itemConstantName, txt)) {
                    setItemDiameter('');
                    setItemThickness('');
                    setItemWidthMm('');
                    setItemLengthMm('');
                    setItemWidthLength('');
                    if (normTxt === 'retalho') {
                      setItemConstantName('RETALHO');
                      setItemConstant('0');
                      setItemPricePerKg('15,00');
                    } else if (normTxt === 'mao de obra') {
                      setItemConstantName('MÃO DE OBRA');
                      setItemConstant('0');
                    }
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    focusNextField('observacao');
                  }
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all placeholder:normal-case placeholder:font-normal"
              />
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
                    tabIndex={-1}
                    onClick={() => setItemDrawingImage(null)}
                    className="text-[10px] text-rose-600 hover:text-rose-800 font-bold cursor-pointer"
                  >
                    Remover
                  </button>
                )}
              </div>

              <input
                type="file"
                tabIndex={-1}
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
                  tabIndex={-1}
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
                tabIndex={-1}
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
                tabIndex={-1}
                readOnly
                value={currentFormSubtotal > 0 ? `R$ ${formatNumberBR(currentFormSubtotal, 2)}` : 'R$ 0,00'}
                className="w-full px-3 py-2 bg-rose-50/70 border border-rose-300 rounded-xl text-xs font-mono font-black text-rose-700 cursor-not-allowed outline-none"
              />
            </div>

            {/* Peso Estimado (KG) */}
            <div className="field field-resultado lg:col-span-2 space-y-1">
              <label htmlFor="pesoEstimado" className="block text-xs font-bold text-emerald-800 flex items-center justify-between">
                <span>Peso Estimado (KG)</span>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                  3 casas
                </span>
              </label>
              <input
                type="text"
                id="pesoEstimado"
                tabIndex={-1}
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
                {isSpecialItem
                  ? 'Cálculo Direto: Peso = 0,000 Kg | Valor Unitário (R$) = Preço Unitário Digitado | Subtotal (R$) = Qtd × Valor Unitário (R$)'
                  : itemGeometryType === 'bucha' || itemGeometryType === 'TUBO_BUCHA'
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
                  const produtoMaterial = item.constanteNome || item.constantName || item.material || 'MATERIAL';
                  const isRowSpecial = isRetalhoOrMaoDeObra(produtoMaterial, item.description || item.descricao || '');
                  const effectiveItemPriceKg = isRowSpecial
                    ? (item.unitPrice || item.valorUnitario || 0)
                    : (item.pricePerKg !== undefined 
                        ? item.pricePerKg 
                        : (item.unitWeightKg && item.unitWeightKg > 0 ? item.unitPrice / item.unitWeightKg : 0));
                  const medidasFormatadas = isRowSpecial ? '—' : formatarMedidasLimpa(item);
                  const rowTotalWeight = isRowSpecial ? 0 : (item.totalWeightKg || item.pesoTotal || 0);
                  const rowUnitWeight = isRowSpecial ? 0 : (item.unitWeightKg || 0);

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
                        <div>{formatWeightKg(rowTotalWeight, 3)}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{formatNumberBR(rowUnitWeight, 3)} kg/un</div>
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
                disabled={isSavingQuote}
                className={`w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer border border-emerald-400/40 ${isSavingQuote ? 'opacity-60 cursor-not-allowed' : ''}`}
                title="Aprova o orçamento, dá baixa no estoque de matéria-prima e lança em Contas a Receber"
              >
                {isSavingQuote ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Gravando no Banco...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                    Aprovar & Baixar Estoque ⚡
                  </>
                )}
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSaveFullQuote}
                  disabled={isSavingQuote}
                  className={`w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer border border-slate-700 ${isSavingQuote ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {isSavingQuote ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Orçamento
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setAutoTriggerPrint(false);
                    setShowPrintModal(true);
                  }}
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

      {/* MODAL DE OPÇÕES DE IMPRESSÃO APÓS SALVAR */}
      {showPrintOptionsModal && (
        <QuotePrintOptionsModal
          orcamentoSalvo={lastSavedQuoteForPrint || normalizeQuoteForPrint(currentQuoteForModal)}
          quoteNumber={numeroCotacao.trim() || currentQuoteForModal.quoteNumber || 'COT'}
          clientName={clientName.trim() || 'Cliente Balcão'}
          itemCount={items.length}
          totalValue={grandTotal}
          client={clients.find(c => c.id === selectedClientId || (clientDocument && c.document === clientDocument)) || null}
          clients={clients}
          onUpdateQuote={(updated) => {
            setLastSavedQuoteForPrint(updated);
            setSavedQuotes(prev => prev.map(q => q.id === updated.id || q.quoteNumber === updated.quoteNumber ? updated : q));
          }}
          onSelectPrint={(tipo) => {
            setShowPrintOptionsModal(false);
            const quoteToPrint = lastSavedQuoteForPrint || normalizeQuoteForPrint(currentQuoteForModal);

            if (tipo === 'NFE') {
              const isNfeEmitida = (quoteToPrint.status_nfe || '').toLowerCase() === 'emitida';
              const resolvedCl = clients.find(c => c.id === quoteToPrint.clientId || (quoteToPrint.clientDocument && c.document === quoteToPrint.clientDocument)) || null;
              if (isNfeEmitida) {
                abrirDanfeEmNovaAba(quoteToPrint, resolvedCl);
              } else {
                setQuoteForDirectNfe(quoteToPrint);
              }
              return;
            }

            // Invocação nominal das funções de impressão conforme fluxo técnico:
            if (tipo === 'CORTE_80MM') {
              // Cupom térmico 80mm abre em janela popup isolada (sem disparar window.print() na página principal)
              imprimirOrdemCorte80mm(quoteToPrint, () => {
                if (handleAdvanceToNextQuoteRef.current) {
                  handleAdvanceToNextQuoteRef.current();
                }
              });
              setShowPrintOptionsModal(false);
              return;
            } else if (tipo === 'GERAL') {
              imprimirOrcamentoGeral(quoteToPrint);
            } else if (tipo === 'EMPRESA') {
              imprimirOrcamentoEmpresa(quoteToPrint);
            } else if (tipo === 'PEDIDO') {
              imprimirOrcamentoPedido(quoteToPrint);
            } else if (tipo === 'ETIQUETAS') {
              imprimirEtiquetas(quoteToPrint);
            } else if (tipo === 'CORTE') {
              imprimirFichaCorte(quoteToPrint);
            }

            // Ativa a renderização do layout de impressão oficial idêntico à Consulta
            setActiveDirectPrint({ quote: quoteToPrint, tipo });
          }}
          onClose={() => {
            setShowPrintOptionsModal(false);
            handleAdvanceToNextQuote(true);
          }}
        />
      )}

      {/* MODAL DIRETO DE CONFERÊNCIA E EMISSÃO DE NF-E */}
      {quoteForDirectNfe && (
        <EmissaoNfeModal
          quote={quoteForDirectNfe}
          client={clients.find(c => c.id === quoteForDirectNfe.clientId || (quoteForDirectNfe.clientDocument && c.document === quoteForDirectNfe.clientDocument)) || null}
          onSuccess={(updated) => {
            setLastSavedQuoteForPrint(updated);
            setSavedQuotes(prev => prev.map(q => q.id === updated.id || q.quoteNumber === updated.quoteNumber ? updated : q));
          }}
          onClose={() => setQuoteForDirectNfe(null)}
        />
      )}

      {/* MODAL PRINT PROPOSAL (PREVIEW COMPLETO) */}
      {showPrintModal && (
        <QuotePrintModal
          quote={lastSavedQuoteForPrint || normalizeQuoteForPrint(currentQuoteForModal)}
          initialMode={printModalMode}
          autoPrint={autoTriggerPrint}
          onClose={() => {
            setShowPrintModal(false);
            setAutoTriggerPrint(false);
          }}
        />
      )}

      {/* MODAL HISTORY QUOTES */}
      {showHistoryModal && (
        <QuoteHistoryModal
          quotes={savedQuotes}
          clients={clients}
          onSelectQuote={handleLoadQuoteFromHistory}
          onDeleteQuote={handleDeleteSavedQuote}
          onUpdateQuote={(updated) => {
            setSavedQuotes(prev => prev.map(q => q.id === updated.id || q.quoteNumber === updated.quoteNumber ? updated : q));
          }}
          onClose={() => setShowHistoryModal(false)}
        />
      )}

      {/* MODAL DE CANCELAMENTO DE NF-E HOMOLOGADA NA SEFAZ */}
      {quoteForCancelNfe && (
        <CancelarNfeModal
          quote={quoteForCancelNfe}
          client={clients.find(c => c.id === quoteForCancelNfe.clientId || (quoteForCancelNfe.clientDocument && c.document === quoteForCancelNfe.clientDocument)) || null}
          onSuccess={(updated) => {
            setLastSavedQuoteForPrint(prev => prev && (prev.id === updated.id || prev.quoteNumber === updated.quoteNumber) ? { ...prev, ...updated, status_nfe: 'CANCELADA' } : updated);
            setSavedQuotes(prev => prev.map(q => {
              const matches = 
                q.id === updated.id || 
                q.quoteNumber === updated.quoteNumber ||
                (q.nfe_chave && updated.nfe_chave && q.nfe_chave.replace(/\D/g, '') === updated.nfe_chave.replace(/\D/g, '')) ||
                (q.nfe_numero && updated.nfe_numero && String(q.nfe_numero) === String(updated.nfe_numero));
              return matches ? { ...q, ...updated, status_nfe: 'CANCELADA' } : q;
            }));
            setQuoteForCancelNfe(null);
          }}
          onClose={() => setQuoteForCancelNfe(null)}
        />
      )}

      {/* PORTAL DE IMPRESSÃO DIRETA COM LAYOUTS IDÊNTICOS À CONSULTA */}
      {activeDirectPrint && typeof document !== 'undefined' && createPortal(
        <div id="print-area">
          <ConsultaPrintDocuments quote={activeDirectPrint.quote} tipo={activeDirectPrint.tipo} />
        </div>,
        document.body
      )}

    </div>
  );
}
