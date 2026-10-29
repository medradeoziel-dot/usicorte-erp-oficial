import React, { useState, useEffect, useRef } from 'react';
import { Client, Quote, QuoteItem } from '../types';
import { 
  saveCotacaoDb, 
  deleteCotacaoDb,
  fetchCotacoesDb, 
  mapSupabaseStatusToQuote, 
  db,
} from '../lib/db';
import { 
  formatCurrency, 
  formatNumberBR, 
  formatWeightKg,
  formatSafeDate,
  getSafeISODate,
  formatarMedidasLimpa,
  formatItemDescription,
  getObservacaoEspecificaItem,
  formatDimensaoPolegada,
  formatDimensaoMm,
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
import ImportExcelCsvModal from './ImportExcelCsvModal';
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

// A sugestão é apenas visual. O gatilho SQL atribui o número definitivo no INSERT.
// Instale numeracao_cotacao_multicomputador_v2.sql antes de usar em vários computadores.
const normalizarStatusCotacao = (status: Quote['status']): Quote['status'] =>
  String(status).toLowerCase() === 'rascunho' ? 'Pendente' : status;

const filtroNumeroExato = (numero: string) => numero.replace(/[\\%_]/g, '\\$&');

async function consultarProximoNumeroSemGravar(existingQuotes: { quoteNumber?: string }[] = []) {
  const { data, error } = await db.from('emitente')
    .select('proximo_numero_sequencial, prefixo_cotacao')
    .order('created_at', { ascending: false }).limit(1).single();
  if (error || !data) throw new Error(' Não foi possível consultar a sequência do emitente.');
  let sequential = Number(data.proximo_numero_sequencial);
  if (!Number.isSafeInteger(sequential) || sequential < 1) {
    throw new Error('Configure um próximo número válido no emitente.');
  }
  const prefix = String(data.prefixo_cotacao || `COT-${new Date().getFullYear()}-`);
  const occupied = new Set(existingQuotes.map(q => String(q.quoteNumber || '').trim().toLowerCase()));
  for (let attempt = 0; attempt < 10000; attempt++, sequential++) {
    const quoteNumber = `${prefix}${String(sequential).padStart(6, '0')}`;
    if (occupied.has(quoteNumber.toLowerCase())) continue;
    const result = await db.from('cotacoes').select('id')
      .ilike('numero', filtroNumeroExato(quoteNumber)).limit(1);
    if (result.error) throw new Error('Não foi possível verificar a numeração no banco.');
    if (!result.data?.length) return { quoteNumber, sequential, prefix };
  }
  throw new Error('Não foi possível encontrar um número livre. Confira o emitente.');
}

async function salvarCotacaoComIdentidadeSegura(quote: Quote, existingId: string | null, originalNumber: string | null) {
  // Nunca passe o número como ID para um upsert: outro computador pode já tê-lo salvo.
  let confirmedId = existingId;
  let confirmedNumber = quote.quoteNumber;
  try {
    if (confirmedId) {
      const current = await db.from('cotacoes').select('id, numero').eq('id', confirmedId).single();
      if (current.error || !current.data) throw new Error('A cotação original não foi encontrada. Nada foi sobrescrito.');
      if (originalNumber && String(current.data.numero) !== originalNumber) {
        throw new Error('A identificação da cotação mudou. Reabra-a pelo histórico.');
      }
      if (quote.quoteNumber !== String(current.data.numero)) {
        const conflict = await db.from('cotacoes').select('id')
          .ilike('numero', filtroNumeroExato(quote.quoteNumber)).neq('id', confirmedId).limit(1);
        if (conflict.error) throw conflict.error;
        if (conflict.data?.length) throw new Error('Este número já pertence a outra cotação. Seus dados foram mantidos.');
      }
    } else {
      // INSERT exclusivo, com UUID gerado pelo banco e número atribuído pelo gatilho.
      // Só é executado dentro do clique em Salvar Orçamento, nunca ao preencher a tela.
      const created = await db.from('cotacoes').insert([{
        numero: quote.quoteNumber,
        data: quote.date,
        cliente_nome: quote.clientName,
        contato: quote.contactPerson || '',
        telefone: quote.clientPhone || '',
        email: quote.clientEmail || '',
        observacoes: quote.observations || '',
        valor_total: quote.grandTotal,
        status: 'pendente'
      }]).select('id, numero').single();
      if (created.error) throw created.error;
      if (!created.data?.id || !created.data?.numero) {
        throw new Error('O banco não confirmou a identificação da nova cotação. Consulte o histórico antes de tentar novamente.');
      }
      confirmedId = String(created.data.id);
      confirmedNumber = String(created.data.numero);
      quote.id = confirmedId;
      quote.quoteNumber = confirmedNumber;
    }
    // O serviço existente preserva o mapeamento dos campos e dos itens.
    // Em caso de falha parcial, mantenha este UUID na tela para retomar a MESMA cotação.
    if (!confirmedId) throw new Error('O banco não confirmou o ID da cotação.');
    quote.id = confirmedId;
    const saved = await saveCotacaoDb(quote, existingId ? originalNumber || undefined : confirmedNumber);
    if (saved.error) return { error: saved.error, confirmedId, confirmedNumber };
    const verified = await db.from('cotacoes').select('id, numero').eq('id', confirmedId).single();
    if (verified.error || !verified.data) throw new Error('Não foi possível confirmar a cotação gravada. Seus dados foram mantidos.');
    confirmedNumber = String(verified.data.numero);
    quote.quoteNumber = confirmedNumber;
    return { error: null, confirmedId, confirmedNumber };
  } catch (error: any) {
    return { error, confirmedId, confirmedNumber };
  }
}

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
  const [quoteForCancelNfe, setQuoteForCancelNfe] = useState<Quote
