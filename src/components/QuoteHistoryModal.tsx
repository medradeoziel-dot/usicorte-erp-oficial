import React, { useState } from 'react';
import { Quote } from '../types';
import { formatCurrency } from '../utils/calculator';
import { 
  History, 
  Search, 
  X, 
  Trash2, 
  Edit3, 
  FileText, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  User, 
  DollarSign, 
  Download 
} from 'lucide-react';

interface QuoteHistoryModalProps {
  quotes: Quote[];
  onSelectQuote: (quote: Quote) => void;
  onDeleteQuote: (id: string) => void;
  onClose: () => void;
}

export default function QuoteHistoryModal({
  quotes,
  onSelectQuote,
  onDeleteQuote,
  onClose
}: QuoteHistoryModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = 
      q.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (q.contactPerson && q.contactPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
      q.items.some(i => i.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'ALL' || q.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Quote['status']) => {
    switch (status) {
      case 'Aprovado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Aprovado
          </span>
        );
      case 'Enviado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Enviado
          </span>
        );
      case 'Faturado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Faturado
          </span>
        );
      case 'Cancelado':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Cancelado
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
            Rascunho
          </span>
        );
    }
  };

  const handleExportAllQuotes = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(quotes, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "historico_orcamentos_usicorte.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400 border border-indigo-500/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Histórico de Orçamentos Salvos (UsiCorte)</h3>
              <p className="text-xs text-slate-400">Consulte, reabra ou edite cotações anteriores</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {quotes.length > 0 && (
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
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por número, cliente, item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            {['ALL', 'Rascunho', 'Enviado', 'Aprovado', 'Faturado'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  filterStatus === status
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {status === 'ALL' ? 'Todos' : status}
              </button>
            ))}
          </div>
        </div>

        {/* Quotes List Content */}
        <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-100">
          {filteredQuotes.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <FileText className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
              <p className="text-sm font-semibold text-slate-700">Nenhum orçamento encontrado</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {quotes.length === 0 
                  ? 'Você ainda não salvou nenhum orçamento. Crie e salve um orçamento na tela principal para vê-lo aqui.'
                  : 'Nenhum orçamento corresponde aos filtros de busca aplicados.'}
              </p>
            </div>
          ) : (
            filteredQuotes.map(quote => (
              <div
                key={quote.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 -mx-2 px-3 rounded-xl transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-indigo-700 text-sm">{quote.quoteNumber}</span>
                    {getStatusBadge(quote.status)}
                    <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" /> {quote.date}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {quote.clientName}
                    {quote.clientDocument && <span className="text-xs text-slate-400 font-normal">({quote.clientDocument})</span>}
                  </h4>

                  <p className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{quote.items.length}</span> item(ns) discriminado(s) • Condição: {quote.paymentTerms}
                  </p>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Geral</span>
                    <span className="text-base font-extrabold text-slate-900 font-mono">
                      {formatCurrency(quote.grandTotal)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        onSelectQuote(quote);
                        onClose();
                      }}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      title="Carregar orçamento para edição ou visualização"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Carregar
                    </button>
                    
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
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center shrink-0">
          <span>Total salvo: <b>{quotes.length}</b> cotações</span>
          <span>UsiCorte Sistema de Orçamentos</span>
        </div>

      </div>
    </div>
  );
}
