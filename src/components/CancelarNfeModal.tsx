import React, { useState } from 'react';
import { Quote, Client } from '../types';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Ban, 
  FileText, 
  Download, 
  Loader2, 
  ShieldAlert, 
  Copy, 
  Check,
  Building2,
  Calendar,
  Hash
} from 'lucide-react';
import { 
  transmitirCancelamentoNfeSefaz, 
  formatarChaveAcesso, 
  downloadXmlCancelamento,
  NfeCancellationResult
} from '../services/nfeService';

interface CancelarNfeModalProps {
  quote: Quote;
  client?: Client | null;
  onSuccess: (updatedQuote: Quote) => void;
  onClose: () => void;
}

const SUGESTOES_JUSTIFICATIVA = [
  'Desistência da compra pelo cliente antes da saída das mercadorias da indústria',
  'Erro no preenchimento dos dados cadastrais e tributários do destinatário',
  'Erro nos valores comerciais, quantidades e condições acordadas com o cliente',
  'Cancelamento comercial do pedido solicitado pelo cliente com emissão substituta'
];

export default function CancelarNfeModal({
  quote,
  client,
  onSuccess,
  onClose
}: CancelarNfeModalProps) {
  const [justificativa, setJustificativa] = useState<string>('');
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [resultado, setResultado] = useState<NfeCancellationResult | null>(null);
  const [hasConfirmedCheckbox, setHasConfirmedCheckbox] = useState<boolean>(true);

  // Chave de acesso oficial (44 dígitos) com resolução resiliente
  const chaveDireta = (quote.nfe_chave || quote.chave_acesso || '').replace(/\D/g, '');
  let chaveAcesso = chaveDireta;
  if (!chaveAcesso || chaveAcesso.length !== 44) {
    try {
      const localStr = localStorage.getItem('usicorte_notas_fiscais');
      if (localStr) {
        const list = JSON.parse(localStr);
        const match = list.find((it: any) =>
          (it.cotacao_id && (it.cotacao_id === quote.id || it.cotacao_id === quote.quoteNumber)) ||
          (it.numero_nfe && quote.nfe_numero && String(it.numero_nfe) === String(quote.nfe_numero))
        );
        if (match && match.chave_acesso) {
          chaveAcesso = String(match.chave_acesso).replace(/\D/g, '');
        }
      }
    } catch {}
  }

  const numeroNfe = quote.nfe_numero || '—';
  const serie = quote.serie_nfe || '1';
  const protocoloAutorizacao = quote.protocolo_autorizacao || quote.protocolo_nfe || '135260000000001';
  const valorTotal = quote.grandTotal || quote.subtotalTotal || 0;
  const clienteNome = client?.name || quote.clientName || 'Cliente';

  const charCount = justificativa.trim().length;
  const isJustificativaValida = charCount >= 15;

  const handleCopyChave = () => {
    if (chaveAcesso) {
      navigator.clipboard.writeText(chaveAcesso);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleAplicarSugestao = (sugestao: string) => {
    setJustificativa(sugestao);
    setErrorMsg(null);
  };

  const handleConfirmarCancelamento = async () => {
    if (!isJustificativaValida) {
      setErrorMsg('A justificativa deve conter no mínimo 15 caracteres para transmissão à SEFAZ.');
      return;
    }

    if (!chaveAcesso || chaveAcesso.length !== 44) {
      setErrorMsg(`Chave de acesso inválida ou incompleta (${chaveAcesso.length} dígitos encontrados. A SEFAZ exige exatamente 44 dígitos).`);
      return;
    }

    setIsTransmitting(true);
    setErrorMsg(null);

    try {
      const res = await transmitirCancelamentoNfeSefaz(quote, justificativa.trim());

      if (res.sucesso && res.statusNfe === 'CANCELADA') {
        setResultado(res);
        const updatedQuote: Quote = {
          ...quote,
          status_nfe: 'CANCELADA',
          protocolo_cancelamento: res.protocoloCancelamento,
          xml_cancelamento: res.xmlCancelamento,
          motivo_cancelamento: justificativa.trim(),
          nfe_cancelada_em: res.dataCancelamento || new Date().toISOString()
        };
        onSuccess(updatedQuote);
      } else {
        setErrorMsg(res.mensagemErro || 'Rejeição da SEFAZ ao tentar cancelar a NF-e.');
      }
    } catch (err: any) {
      console.error('Erro ao transmitir cancelamento para SEFAZ:', err);
      setErrorMsg(err?.message || 'Falha de comunicação com a SEFAZ.');
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleDownloadXmlCancel = () => {
    if (resultado?.xmlCancelamento) {
      downloadXmlCancelamento(resultado.xmlCancelamento, chaveAcesso);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-cancel-title"
      >
        {/* Top Header */}
        <div className="p-5 border-b border-slate-800 bg-gradient-to-r from-rose-950/70 via-slate-900 to-slate-900 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0 shadow-inner">
              <Ban className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  EVENTO FISCAL SEFAZ
                </span>
                <span className="text-xs font-mono font-bold text-slate-400">
                  NF-e Nº {numeroNfe}
                </span>
              </div>
              <h2 id="modal-cancel-title" className="text-lg font-black text-slate-100 tracking-tight mt-0.5">
                Cancelamento de NF-e Homologada
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Transmissão do evento de cancelamento oficial da SEFAZ (Modelo 55 • Status 101)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isTransmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            title="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {resultado && resultado.sucesso ? (
            /* TELA DE SUCESSO - CANCELAMENTO HOMOLOGADO */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/50 flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-emerald-300 uppercase tracking-wide">
                    Cancelamento Homologado com Sucesso! (Status 101)
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    O evento de cancelamento foi registrado e autorizado no ambiente da SEFAZ. O status da NF-e foi atualizado para <strong>CANCELADA</strong> no Supabase.
                  </p>
                </div>
              </div>

              {/* Detalhes do Evento Homologado */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5 text-xs font-mono">
                <div className="flex justify-between items-center py-1 border-b border-slate-800">
                  <span className="text-slate-400">Protocolo de Cancelamento:</span>
                  <span className="text-emerald-400 font-bold">{resultado.protocoloCancelamento}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800">
                  <span className="text-slate-400">Data e Hora do Evento:</span>
                  <span className="text-slate-200">
                    {resultado.dataCancelamento ? new Date(resultado.dataCancelamento).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800">
                  <span className="text-slate-400">Status Retorno SEFAZ:</span>
                  <span className="text-emerald-300 font-bold">101 - Cancelamento de NF-e homologado</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-800">
                  <span className="text-slate-400">Chave de Acesso:</span>
                  <span className="text-slate-300 text-[11px]">{chaveAcesso}</span>
                </div>
                <div className="py-1">
                  <span className="text-slate-400 block mb-1">Justificativa Registrada:</span>
                  <span className="text-slate-200 italic font-sans">{justificativa}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-950/30 border border-amber-600/40 rounded-xl flex items-center gap-2.5 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  A emissão de novo DANFE com valor fiscal foi desativada. As impressões desta nota exibirão a tarja oficial de NF-e Cancelada.
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadXmlCancel}
                  className="flex-1 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Baixar XML do Evento de Cancelamento
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          ) : (
            /* FORMULÁRIO DE JUSTIFICATIVA E CONFIRMAÇÃO */
            <>
              {/* Card de Resumo Fiscal */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2 border-b border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block font-semibold">Número / Série</span>
                    <span className="font-bold text-slate-200">NF-e {numeroNfe} (Série {serie})</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block font-semibold">Valor Total</span>
                    <span className="font-bold text-emerald-400">
                      R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block font-semibold">Destinatário</span>
                    <span className="font-bold text-slate-200 truncate block" title={clienteNome}>{clienteNome}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase block font-semibold">Protocolo Vigente</span>
                    <span className="font-mono text-slate-300 truncate block text-[11px]">{protocoloAutorizacao}</span>
                  </div>
                </div>

                {/* Chave de acesso com botão de cópia */}
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold mb-1">
                    Chave de Acesso (44 Dígitos)
                  </span>
                  <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300">
                    <span className="tracking-wider truncate">{formatarChaveAcesso(chaveAcesso) || '—'}</span>
                    <button
                      type="button"
                      onClick={handleCopyChave}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                      title="Copiar chave de acesso"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Mensagem de Erro / Rejeição SEFAZ */}
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500 text-xs text-rose-200 flex items-start gap-3 animate-in fade-in shadow-lg">
                  <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="block text-rose-300 font-black uppercase tracking-wider text-[11px]">
                      Rejeição da SEFAZ:
                    </strong>
                    <p className="text-slate-100 font-medium leading-relaxed">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Campo de Justificativa com validação dinâmica */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="motivo-cancelamento" className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <span>Justificativa do Cancelamento</span>
                    <span className="text-rose-400">*</span>
                  </label>
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                    isJustificativaValida 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {charCount} / 15 caracteres mínimos
                  </span>
                </div>

                <textarea
                  id="motivo-cancelamento"
                  rows={3}
                  value={justificativa}
                  onChange={(e) => {
                    setJustificativa(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  disabled={isTransmitting}
                  placeholder="Informe detalhadamente a justificativa para o cancelamento perante a SEFAZ (mínimo de 15 caracteres)..."
                  className={`w-full p-3 rounded-xl bg-slate-950 border text-slate-100 placeholder-slate-500 text-xs focus:outline-none transition-colors ${
                    isJustificativaValida
                      ? 'border-emerald-500/50 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/40'
                      : 'border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/40'
                  }`}
                />

                <div className="flex items-center gap-1.5 text-[11px]">
                  {isJustificativaValida ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Justificativa válida para homologação na SEFAZ.
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> Faltam {15 - charCount} caracteres para atingir o mínimo obrigatório de 15.
                    </span>
                  )}
                </div>
              </div>

              {/* Sugestões Rápidas de Justificativa */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Sugestões Rápidas (Clique para preencher):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {SUGESTOES_JUSTIFICATIVA.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleAplicarSugestao(sug)}
                      disabled={isTransmitting}
                      className="text-left p-2 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-[11px] text-slate-300 hover:text-slate-100 transition cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Checkbox de Confirmação Irreversível */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 cursor-pointer hover:bg-slate-950 transition">
                <input
                  type="checkbox"
                  checked={hasConfirmedCheckbox}
                  onChange={(e) => setHasConfirmedCheckbox(e.target.checked)}
                  disabled={isTransmitting}
                  className="mt-0.5 rounded border-slate-700 text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span>
                  Declaro que a mercadoria <strong>não circulou</strong> e estou ciente de que o cancelamento de NF-e na SEFAZ é um procedimento oficial <strong>irreversível</strong>.
                </span>
              </label>

              {/* Ações do Rodapé */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isTransmitting}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 transition cursor-pointer disabled:opacity-50"
                >
                  Cancelar / Voltar
                </button>

                <button
                  type="button"
                  onClick={handleConfirmarCancelamento}
                  disabled={!isJustificativaValida || !hasConfirmedCheckbox || isTransmitting}
                  className={`w-full sm:w-auto px-5 py-2.5 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    isJustificativaValida && hasConfirmedCheckbox && !isTransmitting
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50'
                  }`}
                >
                  {isTransmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      Transmitindo para SEFAZ...
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4 text-white" />
                      CONFIRMAR CANCELAMENTO NA SEFAZ
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
