import React, { useState, useMemo } from 'react';
import { Quote, Client } from '../types';
import { formatCurrency, formatSafeDate } from '../utils/calculator';
import EmissaoNfeModal from './EmissaoNfeModal';
import { abrirDanfeEmNovaAba, obterOuBaixarXmlNfe, isNfeAutorizada, isNfeCancelada, downloadXmlCancelamento } from '../services/nfeService';
import { fetchNotasFiscaisDb } from '../lib/db';
import CancelarNfeModal from './CancelarNfeModal';
import { 
  History, 
  Search, 
  X, 
  Trash2, 
  Edit3, 
  Pencil, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  User, 
  DollarSign, 
  Download,
  Copy,
  Printer,
  Send,
  ExternalLink,
  Ban
} from 'lucide-react';

interface QuoteHistoryModalProps {
  quotes: Quote[];
  clients?: Client[];
  onSelectQuote: (quote: Quote) => void;
  onDeleteQuote: (id: string) => void;
  onDuplicateQuote?: (quote: Quote) => void;
  onUpdateQuote?: (quote: Quote) => void;
  onClose: () => void;
}

export default function QuoteHistoryModal({
  quotes,
  clients = [],
  onSelectQuote,
  onDeleteQuote,
  onDuplicateQuote,
  onUpdateQuote,
  onClose
}: QuoteHistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterNfe, setFilterNfe] = useState<string>('ALL');
  const [quoteForNfe, setQuoteForNfe] = useState<Quote | null>(null);
  const [quoteForCancelNfe, setQuoteForCancelNfe] = useState<Quote | null>(null);
  const [localQuotes, setLocalQuotes] = useState<Quote[]>(quotes);

  // Mantém localQuotes em sincronia quando a prop quotes atualizar e hidrata da tabela notas_fiscais
  React.useEffect(() => {
    let isMounted = true;

    async function carregarEHarmonizarNotas() {
      try {
        const { data: notasDb } = await fetchNotasFiscaisDb();
        if (!isMounted) return;

        setLocalQuotes(prev => {
          const base = [...quotes];
          const matchedChaves = new Set<string>();

          // 1. Atualiza e hidrata cotações existentes com a tabela notas_fiscais
          base.forEach(q => {
            const match = (notasDb || []).find(nf => 
              (nf.cotacao_id && (nf.cotacao_id === q.id || nf.cotacao_id === q.quoteNumber)) ||
              (q.nfe_chave && nf.chave_acesso && q.nfe_chave === nf.chave_acesso) ||
              (q.nfe_numero && nf.numero_nfe && String(q.nfe_numero) === String(nf.numero_nfe))
            );
            if (match) {
              q.status_nfe = match.status || 'AUTORIZADA';
              q.nfe_numero = String(match.numero_nfe);
              q.nfe_chave = match.chave_acesso;
              q.chave_acesso = match.chave_acesso;
              q.protocolo_nfe = match.protocolo || q.protocolo_nfe;
              q.xml_conteudo = match.xml_conteudo || q.xml_conteudo;
              matchedChaves.add(match.chave_acesso);
            }
          });

          // 2. Insere notas fiscais emitidas da tabela que não existam como cotação local
          (notasDb || []).forEach(nf => {
            const chave = nf.chave_acesso;
            if (chave && !matchedChaves.has(chave)) {
              matchedChaves.add(chave);
              const clientFound = clients.find(c => c.id === nf.cliente_id);
              const cliNome = clientFound?.name || clientFound?.nome || nf.cliente_nome || 'Cliente NF-e';

              const syntheticQuote: Quote = {
                id: nf.cotacao_id || `nf_${nf.numero_nfe}`,
                quoteNumber: nf.cotacao_id || `NF-${String(nf.numero_nfe).padStart(6, '0')}`,
                clientId: nf.cliente_id || undefined,
                clientName: cliNome,
                date: nf.created_at ? nf.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
                status: 'Faturado',
                status_nfe: nf.status || 'AUTORIZADA',
                nfe_numero: String(nf.numero_nfe),
                serie_nfe: String(nf.serie_nfe || '1'),
                nfe_chave: nf.chave_acesso,
                chave_acesso: nf.chave_acesso,
                protocolo_nfe: nf.protocolo || undefined,
                xml_conteudo: nf.xml_conteudo || undefined,
                grandTotal: Number(nf.valor_total) || 0,
                subtotalTotal: Number(nf.valor_total) || 0,
                validityDays: 10,
                paymentTerms: 'Faturado / NF-e',
                discount: 0,
                shipping: 0,
                items: [
                  {
                    id: '1',
                    date: nf.created_at ? nf.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
                    companyName: cliNome,
                    constant: '1.0',
                    diameter: '',
                    description: `Faturamento NF-e Nº ${String(nf.numero_nfe).padStart(6, '0')}`,
                    material: 'Material Industrial',
                    measure: 'Peça',
                    widthLength: '',
                    quantity: 1,
                    unitPrice: Number(nf.valor_total) || 0,
                    subtotal: Number(nf.valor_total) || 0
                  }
                ],
                createdAt: nf.created_at,
                updatedAt: nf.updated_at || nf.created_at
              };
              base.unshift(syntheticQuote);
            }
          });

          return base;
        });
      } catch (err) {
        console.warn('Aviso ao sincronizar notas_fiscais no histórico:', err);
      }
    }

    carregarEHarmonizarNotas();
    return () => { isMounted = false; };
  }, [quotes, clients]);

  // Deduplicação preventiva por id / quoteNumber
  const uniqueQuotes = useMemo(() => {
    const seen = new Set<string>();
    const result: Quote[] = [];
    localQuotes.forEach(q => {
      const key = (q.quoteNumber || q.id || '').trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push(q);
      } else if (!key) {
        result.push(q);
      }
    });
    return result;
  }, [localQuotes]);

  const filteredQuotes = uniqueQuotes.filter(q => {
    const quoteNum = q.quoteNumber || q.id || '';
    const cName = q.clientName || '';
    const cPerson = q.contactPerson || '';
    const matchesSearch = 
      quoteNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.items || []).some(i => (i.description || i.descricao || '').toLowerCase().includes(searchTerm.toLowerCase())) ||
      (q.nfe_numero && q.nfe_numero.includes(searchTerm)) ||
      (q.nfe_chave && q.nfe_chave.includes(searchTerm)) ||
      (q.chave_acesso && q.chave_acesso.includes(searchTerm));

    const matchesStatus = filterStatus === 'ALL' || q.status === filterStatus;
    
    const stNfe = (q.status_nfe || 'Pendente').toLowerCase();
    const matchesNfe = filterNfe === 'ALL' || 
      (filterNfe === 'Emitida' && (stNfe === 'emitida' || stNfe === 'autorizada')) ||
      (filterNfe === 'Pendente' && (stNfe === 'pendente' || !q.status_nfe)) ||
      (filterNfe === 'Erro' && stNfe.includes('erro'));

    return matchesSearch && matchesStatus && matchesNfe;
  });

  const getStatusBadge = (status: Quote['status']) => {
    switch (status) {
      case 'Aprovado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Aprovado
          </span>
        );
      case 'Pendente':
      case 'Enviado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {status === 'Pendente' ? 'Pendente' : 'Enviado'}
          </span>
        );
      case 'Faturado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Faturado
          </span>
        );
      case 'Cancelado':
      case 'Rejeitado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> {status}
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
            Rascunho
          </span>
        );
    }
  };

  /**
   * Badge de Status da Nota Fiscal (status_nfe):
   * "Pendente", "Emitida" / "AUTORIZADA", "CANCELADA", "Erro"
   */
  const getNfeBadge = (quote: Quote) => {
    const rawSt = (quote.status_nfe || 'Pendente').trim().toLowerCase();

    if (rawSt === 'cancelada') {
      return (
        <span 
          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-xs"
          title={quote.motivo_cancelamento ? `NF-e CANCELADA (Status 101): ${quote.motivo_cancelamento}` : 'NF-e Cancelada perante a SEFAZ (Status 101)'}
        >
          <Ban className="w-3 h-3 text-rose-600" />
          <span>NF-e Cancelada</span>
          {quote.nfe_numero && <span className="font-mono font-extrabold text-[9px]">#{quote.nfe_numero}</span>}
        </span>
      );
    }

    if (rawSt === 'emitida' || rawSt === 'autorizada') {
      return (
        <span 
          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 shadow-xs"
          title={`NF-e Nº ${quote.nfe_numero || ''} autorizada pela SEFAZ`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>NF-e Autorizada</span>
          {quote.nfe_numero && <span className="font-mono font-extrabold text-[9px]">#{quote.nfe_numero}</span>}
        </span>
      );
    }

    if (rawSt.includes('erro') || rawSt.includes('rejeit')) {
      return (
        <span 
          className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-xs"
          title={quote.mensagem_erro_nfe || 'Erro retornado na transmissão da SEFAZ'}
        >
          <AlertCircle className="w-3 h-3 text-rose-600" />
          <span>NF-e Erro</span>
        </span>
      );
    }

    if (rawSt === 'processando') {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 animate-pulse">
          <Clock className="w-3 h-3 text-amber-600" />
          <span>NF-e Processando...</span>
        </span>
      );
    }

    // Padrão: Pendente (cinza/azul)
    return (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 flex items-center gap-1">
        <FileText className="w-3 h-3 text-slate-400" />
        <span>NF-e Pendente</span>
      </span>
    );
  };

  const handleExportAllQuotes = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(localQuotes, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "historico_orcamentos_usicorte.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleNfeSuccess = (updatedQuote: Quote) => {
    setLocalQuotes(prev => prev.map(q => q.id === updatedQuote.id || q.quoteNumber === updatedQuote.quoteNumber ? updatedQuote : q));
    if (onUpdateQuote) {
      onUpdateQuote(updatedQuote);
    }
  };

  // Encontra cliente associado à cotação para preencher dados no modal
  const clientForSelectedQuote = useMemo(() => {
    if (!quoteForNfe) return null;
    const cleanDoc = (quoteForNfe.clientDocument || '').replace(/\D/g, '');
    const cleanId = quoteForNfe.clientId;
    return clients.find(c => 
      (cleanId && c.id === cleanId) ||
      (cleanDoc && c.document.replace(/\D/g, '') === cleanDoc) ||
      (c.name.trim().toLowerCase() === quoteForNfe.clientName.trim().toLowerCase())
    ) || null;
  }, [quoteForNfe, clients]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 border border-indigo-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Histórico de Cotações & Emissão Fiscal (UsiCorte)</h3>
              <p className="text-xs text-slate-400">Consulte orçamentos anteriores, reabra no PDV ou emita Nota Fiscal Eletrônica (NF-e)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {localQuotes.length > 0 && (
              <button
                onClick={handleExportAllQuotes}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center gap-1.5 border border-slate-700 transition-colors"
                title="Exportar todos os orçamentos em JSON"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar JSON
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filters Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-3 items-center justify-between shrink-0">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por número, cliente, item, NF-e..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto flex-wrap">
            {/* Filtro Status da Cotação */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold px-2 uppercase">Status:</span>
              {['ALL', 'Aprovado', 'Faturado', 'Pendente', 'Rascunho'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    filterStatus === status
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {status === 'ALL' ? 'Todos' : status}
                </button>
              ))}
            </div>

            {/* Filtro NF-e */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              <span className="text-[10px] text-slate-400 font-bold px-2 uppercase">NF-e:</span>
              {[
                { id: 'ALL', label: 'Todas' },
                { id: 'Emitida', label: 'Emitidas' },
                { id: 'Pendente', label: 'Pendentes' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilterNfe(f.id)}
                  className={`px-2 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    filterNfe === f.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quotes List Content */}
        <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-100">
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <FileText className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
              <p className="text-sm font-semibold text-slate-700">Nenhum orçamento encontrado</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {localQuotes.length === 0 
                  ? 'Você ainda não salvou nenhum orçamento. Crie e salve um orçamento na tela principal para vê-lo aqui.'
                  : 'Nenhum orçamento corresponde aos filtros de busca aplicados.'}
              </p>
            </div>
          ) : (
            filteredQuotes.map(quote => {
              const isFinalizadoOuAprovado = 
                quote.status === 'Aprovado' || 
                quote.status === 'Faturado' || 
                quote.status === 'Enviado';
              const isCancelada = isNfeCancelada(quote.status_nfe);
              const isAutorizada = isNfeAutorizada(quote.status_nfe) || (Boolean(quote.nfe_chave || quote.chave_acesso) && !isCancelada);

              return (
                <div
                  key={quote.id}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-slate-50/80 -mx-2 px-3 rounded-xl transition-colors"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-indigo-700 text-sm">{quote.quoteNumber}</span>
                      
                      {/* Badge de Status Comercial */}
                      {getStatusBadge(quote.status)}
                      
                      {/* Badge de Status da Nota Fiscal (status_nfe) */}
                      {getNfeBadge(quote)}

                      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3" /> {formatSafeDate(quote.date || quote.createdAt)}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{quote.clientName}</span>
                      {quote.clientDocument && <span className="text-xs text-slate-400 font-normal shrink-0">({quote.clientDocument})</span>}
                    </h4>

                    <p className="text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{quote.items.length}</span> item(ns) discriminado(s) • Condição: {quote.paymentTerms}
                      {quote.clientCity && <span> • {quote.clientCity}/{quote.clientState || 'SP'}</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 self-end lg:self-center flex-wrap shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Geral</span>
                      <span className="text-base font-extrabold text-slate-900 font-mono">
                        {formatCurrency(quote.grandTotal)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      
                      {/* AÇÃO 1: EMITIR NF-E (Disponível nas cotações finalizadas/aprovadas, DESATIVADO se Cancelada ou Autorizada) */}
                      {isFinalizadoOuAprovado && !isAutorizada && !isCancelada && (
                        <button
                          onClick={() => setQuoteForNfe(quote)}
                          className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-600/30 transition-all active:scale-95 border border-emerald-400/30"
                          title="Abrir conferência fiscal e transmitir NF-e para a SEFAZ"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Emitir NF-e</span>
                        </button>
                      )}

                      {/* Se AUTORIZADA: Botões de DANFE, XML e CANCELAR NF-E */}
                      {isAutorizada && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const resolvedClient = clients.find(c => 
                                (quote.clientId && c.id === quote.clientId) || 
                                (quote.clientDocument && c.document && c.document.replace(/\D/g, '') === quote.clientDocument.replace(/\D/g, '')) ||
                                (c.name || (c as any).nome) === quote.clientName
                              );
                              abrirDanfeEmNovaAba(quote, resolvedClient);
                            }}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                            title="Abrir DANFE da NF-e emitida em nova aba para impressão rápida"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Imprimir DANFE</span>
                          </button>

                          <button
                            onClick={async () => {
                              const resolvedClient = clients.find(c => 
                                (quote.clientId && c.id === quote.clientId) || 
                                (quote.clientDocument && c.document && c.document.replace(/\D/g, '') === quote.clientDocument.replace(/\D/g, '')) ||
                                (c.name || (c as any).nome) === quote.clientName
                              );
                              await obterOuBaixarXmlNfe(quote, resolvedClient);
                            }}
                            className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                            title="Baixar arquivo XML autorizado pela SEFAZ (NFe[CHAVE].xml)"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Baixar XML</span>
                          </button>

                          {/* BOTÃO DE CANCELAR NF-E HOMOLOGADA */}
                          <button
                            onClick={() => setQuoteForCancelNfe(quote)}
                            className="px-3 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                            title="Cancelar NF-e Homologada na SEFAZ (Status 101)"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>CANCELAR NF-E</span>
                          </button>

                          <button
                            onClick={() => setQuoteForNfe(quote)}
                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                            title="Ver dados fiscais e chave da NF-e"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Se CANCELADA: Exibe espelho da DANFE cancelada (sem valor fiscal) e XML do cancelamento */}
                      {isCancelada && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              const resolvedClient = clients.find(c => 
                                (quote.clientId && c.id === quote.clientId) || 
                                (quote.clientDocument && c.document && c.document.replace(/\D/g, '') === quote.clientDocument.replace(/\D/g, '')) ||
                                (c.name || (c as any).nome) === quote.clientName
                              );
                              abrirDanfeEmNovaAba(quote, resolvedClient);
                            }}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                            title="Visualizar espelho da DANFE cancelada com tarja 'SEM VALOR FISCAL'"
                          >
                            <Ban className="w-3.5 h-3.5 text-rose-400" />
                            <span>DANFE Cancelada</span>
                          </button>

                          {quote.xml_cancelamento && (
                            <button
                              onClick={() => {
                                const chave = quote.nfe_chave || quote.chave_acesso || quote.quoteNumber;
                                downloadXmlCancelamento(quote.xml_cancelamento!, chave);
                              }}
                              className="px-3 py-2 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/50 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                              title="Baixar XML do evento de cancelamento homologado (procEventoNFe)"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>XML Cancelamento</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* DUPLICAR */}
                      {onDuplicateQuote && (
                        <button
                          onClick={() => {
                            onDuplicateQuote(quote);
                            onClose();
                          }}
                          className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                          title="Duplicar este orçamento no PDV com nova numeração"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Duplicar
                        </button>
                      )}

                      {/* EDITAR / CARREGAR NO PDV */}
                      <button
                        onClick={() => {
                          onSelectQuote(quote);
                          onClose();
                        }}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                        title="Editar / Carregar este orçamento no formulário de vendas"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      
                      {/* EXCLUIR */}
                      <button
                        onClick={() => {
                          if (confirm(`Deseja realmente excluir o orçamento ${quote.quoteNumber}?`)) {
                            onDeleteQuote(quote.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Excluir orçamento"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center shrink-0">
          <span>Total salvo: <b>{localQuotes.length}</b> cotações • <b>{localQuotes.filter(q => (q.status_nfe || '').toLowerCase() === 'emitida').length}</b> com NF-e emitida</span>
          <span>UsiCorte Metais • Gestão Comercial & Fiscal</span>
        </div>

      </div>

      {/* Modal de Conferência e Emissão de NF-e */}
      {quoteForNfe && (
        <EmissaoNfeModal
          quote={quoteForNfe}
          client={clientForSelectedQuote}
          onSuccess={handleNfeSuccess}
          onClose={() => setQuoteForNfe(null)}
        />
      )}

      {/* Modal de Cancelamento de NF-e Homologada na SEFAZ */}
      {quoteForCancelNfe && (
        <CancelarNfeModal
          quote={quoteForCancelNfe}
          client={clients.find(c => 
            (quoteForCancelNfe.clientId && c.id === quoteForCancelNfe.clientId) || 
            (quoteForCancelNfe.clientDocument && c.document && c.document.replace(/\D/g, '') === quoteForCancelNfe.clientDocument.replace(/\D/g, '')) ||
            (c.name || (c as any).nome) === quoteForCancelNfe.clientName
          ) || null}
          onSuccess={(updated) => {
            setLocalQuotes(prev => prev.map(q => (q.id === updated.id || q.quoteNumber === updated.quoteNumber) ? updated : q));
            if (onUpdateQuote) {
              onUpdateQuote(updated);
            }
            setQuoteForCancelNfe(null);
          }}
          onClose={() => setQuoteForCancelNfe(null)}
        />
      )}
    </div>
  );
}
