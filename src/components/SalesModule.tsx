import React, { useState, useEffect, useRef } from 'react';
import { Client, Quote, QuoteItem } from '../types';
import { 
  saveCotacaoDb, 
  deleteCotacaoDb,
  fetchCotacoesDb, 
  mapSupabaseStatusToQuote, 
  db,
  SupabaseCotacao
} from '../lib/db';
import { 
  reservarNovaCotacaoNoSupabase, 
  cancelarOuDescartarRascunho 
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
