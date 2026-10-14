import React, { useState, useEffect, useMemo } from 'react';
import { Quote, Client, QuoteItem } from '../types';
import { 
  transmitirNfeSefaz, 
  prepararItensFiscais, 
  ItemFiscalNfe,
  NfeTransmissionResult,
  formatarChaveAcesso,
  abrirPreDanfeEmNovaAba,
  montarEnderecoSemDuplicacao,
  buscarInscricaoEstadual,
  downloadXmlNfe,
  obterOuBaixarXmlNfe,
  enviarEmailNfe,
  isNfeAutorizada,
  isNfeCancelada,
  downloadXmlCancelamento,
  abrirDanfeEmNovaAba,
  obterAliquotaIcmsSimples,
  calcularCreditoIcmsSimples
} from '../services/nfeService';
import CancelarNfeModal from './CancelarNfeModal';
import DanfeEspelhoA4Modal from './DanfeEspelhoA4Modal';
import { updateCotacaoNfeStatusDb, fetchItensByCotacaoId, db } from '../lib/db';
import { fetchCompanyData, CompanyFiscalData, DEFAULT_COMPANY_DATA, updateEmitenteNfeConfig, formatarEnderecoEmitenteLimpo } from '../services/companyService';
import { formatCurrency } from '../utils/calculator';
import Logo from './Logo';
import { 
  Building2, 
  User, 
  FileText, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Printer, 
  Download, 
  Loader2, 
  ShieldCheck, 
  BadgePercent,
  Check,
  ExternalLink,
  Info,
  Eye,
  Mail,
  Ban
} from 'lucide-react';

interface EmissaoNfeModalProps {
  quote: Quote;
  client?: Client | null;
  onSuccess: (updatedQuote: Quote) => void;
  onClose: () => void;
}

export default function EmissaoNfeModal({
  quote,
  client,
  onSuccess,
  onClose
}: EmissaoNfeModalProps) {
  const [company, setCompany] = useState<CompanyFiscalData>(DEFAULT_COMPANY_DATA);
  const [loadingCompany, setLoadingCompany] = useState<boolean>(true);
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [transmissionResult, setTransmissionResult] = useState<NfeTransmissionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPreDanfeModal, setShowPreDanfeModal] = useState<boolean>(false);
  const [openingNewTab, setOpeningNewTab] = useState<boolean>(false);
  const [emailFeedback, setEmailFeedback] = useState<string | null>(null);
  const [isDownloadingXml, setIsDownloadingXml] = useState<boolean>(false);
  const [currentQuoteState, setCurrentQuoteState] = useState<Quote>(quote);
  const [showCancelarModal, setShowCancelarModal] = useState<boolean>(false);
  const [showDanfeOficialModal, setShowDanfeOficialModal] = useState<boolean>(false);
  const [autoPrintDanfe, setAutoPrintDanfe] = useState<boolean>(false);

  const [isLoadingItems, setIsLoadingItems] = useState<boolean>(false);

  useEffect(() => {
    setCurrentQuoteState(quote);

    // CONSULTA INTEGRAL NO SUPABASE: Busca SEM LIMITES todos os itens pertencentes a esta cotação na tabela cotacao_itens
    let isMounted = true;
    async function carregarItensIntegrais() {
      // Se for cotação agrupada (multi-cotação), unifica os itens de todas as cotações sem sobrescrever
      if (quote.origemCotacoes && quote.origemCotacoes.length > 1) {
        try {
          setIsLoadingItems(true);
          const todosIds = quote.origemCotacaoIds || quote.origemCotacoes;
          const itensDbPorCotacao = await Promise.all(
            todosIds.map(id => fetchItensByCotacaoId(String(id)))
          );
          if (!isMounted) return;

          const itensDbAgrupados: any[] = [];
          itensDbPorCotacao.forEach((itensArr, qIdx) => {
            const qNum = quote.origemCotacoes?.[qIdx] || todosIds[qIdx];
            if (itensArr && itensArr.length > 0) {
              itensArr.forEach((it: any) => {
                itensDbAgrupados.push({
                  ...it,
                  cotacaoOrigemRef: qNum
                });
              });
            }
          });

          if (itensDbAgrupados.length >= (quote.items?.length || 0) && itensDbAgrupados.length > 0) {
            let idxGlobal = 1;
            const mappedItems: QuoteItem[] = itensDbAgrupados.map((it: any) => ({
              id: String(it.id || idxGlobal++),
              date: it.created_at?.slice(0, 10) || quote.date || new Date().toISOString().slice(0, 10),
              companyName: quote.clientName || 'Cliente Selecionado',
              constant: '1.0',
              diameter: it.medida || '',
              description: it.descricao || it.produto || `Item #${idxGlobal}`,
              descricao: it.descricao || it.produto || `Item #${idxGlobal}`,
              material: it.material || it.produto || 'Aço Carbono',
              constanteNome: it.material || it.produto || 'Material',
              measure: it.medida || 'Conforme desenho',
              widthLength: it.medida || '',
              quantity: Number(it.quantidade) || 1,
              qtd: Number(it.quantidade) || 1,
              unitPrice: Number(it.valor_unitario) || 0,
              valorUnitario: Number(it.valor_unitario) || 0,
              subtotal: Number(it.valor_total) || ((Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 1)),
              notes: it.observacao || '',
              observacao: it.observacao || '',
              drawingImage: it.desenho_url || undefined,
              fotoDesenho: it.desenho_url || undefined,
              ncm: it.ncm,
              cfop: it.cfop,
              cfop_interno: it.cfop_interno,
              cfop_externo: it.cfop_externo,
              csosn: (!it.csosn || String(it.csosn).includes('102') || String(it.csosn).includes('101')) ? '101 - Com permissão de crédito' : it.csosn,
              unidade_medida: it.unidade_medida,
              totalWeightKg: Number((it as any).peso_total || 0),
              pesoTotal: Number((it as any).peso_total || 0),
              unitWeightKg: Number((it as any).peso_unitario || 0),
              cotacaoOrigem: it.cotacaoOrigemRef
            }));

            const calcTotal = mappedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
            setCurrentQuoteState(prev => ({
              ...prev,
              items: mappedItems,
              subtotalTotal: calcTotal || prev.subtotalTotal,
              grandTotal: calcTotal || prev.grandTotal
            }));
          }
        } catch (err) {
          console.warn('Aviso ao sincronizar itens de multi-cotações na modal de NF-e:', err);
        } finally {
          if (isMounted) setIsLoadingItems(false);
        }
        return;
      }

      const targetId = quote.id || quote.quoteNumber;
      if (!targetId) return;

      try {
        setIsLoadingItems(true);
        let dbItens = await fetchItensByCotacaoId(String(targetId));
        if ((!dbItens || dbItens.length === 0) && quote.quoteNumber) {
          dbItens = await fetchItensByCotacaoId(String(quote.quoteNumber));
        }
        if ((!dbItens || dbItens.length === 0) && quote.id) {
          dbItens = await fetchItensByCotacaoId(String(quote.id));
        }

        if (!isMounted) return;

        if (dbItens && dbItens.length > 0) {
          if (dbItens.length >= (quote.items?.length || 0)) {
            const mappedItems: QuoteItem[] = dbItens.map((it: any, idx: number) => ({
              id: String(it.id || (idx + 1)),
              date: it.created_at?.slice(0, 10) || quote.date || new Date().toISOString().slice(0, 10),
              companyName: quote.clientName || 'Cliente Selecionado',
              constant: '1.0',
              diameter: it.medida || '',
              description: it.descricao || it.produto || `Item #${idx + 1}`,
              descricao: it.descricao || it.produto || `Item #${idx + 1}`,
              material: it.material || it.produto || 'Aço Carbono',
              constanteNome: it.material || it.produto || 'Material',
              measure: it.medida || 'Conforme desenho',
              widthLength: it.medida || '',
              quantity: Number(it.quantidade) || 1,
              qtd: Number(it.quantidade) || 1,
              unitPrice: Number(it.valor_unitario) || 0,
              valorUnitario: Number(it.valor_unitario) || 0,
              subtotal: Number(it.valor_total) || ((Number(it.valor_unitario) || 0) * (Number(it.quantidade) || 1)),
              notes: it.observacao || '',
              observacao: it.observacao || '',
              drawingImage: it.desenho_url || undefined,
              fotoDesenho: it.desenho_url || undefined,
              ncm: it.ncm,
              cfop: it.cfop,
              cfop_interno: it.cfop_interno,
              cfop_externo: it.cfop_externo,
              csosn: (!it.csosn || String(it.csosn).includes('102') || String(it.csosn).includes('101')) ? '101 - Com permissão de crédito' : it.csosn,
              unidade_medida: it.unidade_medida,
              totalWeightKg: Number((it as any).peso_total || 0),
              pesoTotal: Number((it as any).peso_total || 0),
              unitWeightKg: Number((it as any).peso_unitario || 0)
            }));

            const calcTotal = mappedItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
            setCurrentQuoteState(prev => ({
              ...prev,
              items: mappedItems,
              subtotalTotal: calcTotal || prev.subtotalTotal,
              grandTotal: calcTotal || prev.grandTotal
            }));
          }
        }
      } catch (err) {
        console.warn('Aviso ao sincronizar itens integrais na modal de NF-e:', err);
      } finally {
        if (isMounted) setIsLoadingItems(false);
      }
    }

    carregarItensIntegrais();
    return () => { isMounted = false; };
  }, [quote.id, quote.quoteNumber, quote.origemCotacoes]);

  const isCancelada = isNfeCancelada(currentQuoteState.status_nfe);
  const isAutorizada = isNfeAutorizada(currentQuoteState.status_nfe);

  const handleOpenPreDanfeNewTab = async () => {
    setOpeningNewTab(true);
    try {
      await abrirPreDanfeEmNovaAba(currentQuoteState, client);
    } finally {
      setOpeningNewTab(false);
    }
  };

  // 1. Busca os dados oficiais do Emitente (UsiCorte Metais - busca direta e em tempo real da tabela 'emitente')
  useEffect(() => {
    let isMounted = true;
    async function loadEmitente() {
      try {
        const data = await fetchCompanyData(true);
        if (isMounted) {
          setCompany(data);
        }
      } catch (err) {
        console.warn('Erro ao carregar dados do emitente:', err);
      } finally {
        if (isMounted) setLoadingCompany(false);
      }
    }
    loadEmitente();

    // 1. Atualização em tempo real quando alterado no módulo de configurações da empresa
    const handleCompanyUpdate = (e: CustomEvent) => {
      if (isMounted) {
        if (e.detail) {
          setCompany(prev => ({
            ...prev,
            ...e.detail,
            ultimo_numero_nfe: e.detail.ultimo_numero_nfe !== undefined ? e.detail.ultimo_numero_nfe : prev.ultimo_numero_nfe
          }));
        }
        loadEmitente();
      }
    };
    window.addEventListener('company-data-updated', handleCompanyUpdate as EventListener);

    // 2. Atualização ao retornar o foco na janela
    const handleWindowFocus = () => {
      if (isMounted) {
        loadEmitente();
      }
    };
    window.addEventListener('focus', handleWindowFocus);

    // 3. Inscrição em tempo real no Supabase na tabela 'emitente'
    const channelName = `realtime_emitente_modal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = db
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'emitente' },
        () => {
          if (isMounted) {
            loadEmitente();
          }
        }
      )
      .subscribe();

    return () => { 
      isMounted = false;
      window.removeEventListener('company-data-updated', handleCompanyUpdate as EventListener);
      window.removeEventListener('focus', handleWindowFocus);
      try {
        db.removeChannel(channel);
      } catch {}
    };
  }, []);

  // 2. Dados do Destinatário / Cliente
  const clienteInfo = useMemo(() => {
    const nome = client?.name || client?.nome || currentQuoteState.clientName || 'Cliente Balcão';
    const doc = client?.document || client?.documento || currentQuoteState.clientDocument || 'Não informado';
    const ie = buscarInscricaoEstadual(client) !== 'ISENTO' 
      ? buscarInscricaoEstadual(client) 
      : buscarInscricaoEstadual(currentQuoteState);
    const indicadorIe = client?.indicador_ie || client?.indicadorIe || (doc.replace(/\D/g, '').length > 11 ? '1' : '9');
    const cidade = client?.city || client?.cidade || currentQuoteState.clientCity || 'BAURU';
    const uf = (client?.state || client?.uf || currentQuoteState.clientState || 'SP').toUpperCase();
    const endereco = client?.street || client?.endereco || 'Endereço Comercial';

    return { nome, doc, ie, indicadorIe, cidade, uf, endereco };
  }, [client, currentQuoteState]);

  // 3. Validação de CFOP Automática:
  // Se a UF do cliente for "SP" => cfop_interno (5102)
  // Se a UF for diferente de "SP" => cfop_externo (6102)
  const itensFiscais: ItemFiscalNfe[] = useMemo(() => {
    return prepararItensFiscais(currentQuoteState.items || [], clienteInfo.uf);
  }, [currentQuoteState.items, clienteInfo.uf]);

  const valorTotal = useMemo(() => {
    return currentQuoteState.grandTotal || currentQuoteState.subtotalTotal || itensFiscais.reduce((acc, it) => acc + it.subtotal, 0);
  }, [currentQuoteState.grandTotal, currentQuoteState.subtotalTotal, itensFiscais]);

  const aliquotaIcmsSimples = obterAliquotaIcmsSimples(company);
  const creditoIcms = useMemo(() => {
    return calcularCreditoIcmsSimples(valorTotal, aliquotaIcmsSimples);
  }, [valorTotal, aliquotaIcmsSimples]);

  const isOperacaoInterestadual = clienteInfo.uf !== 'SP';

  const proximoNumeroNfe = useMemo(() => {
    if (currentQuoteState.nfe_numero) return currentQuoteState.nfe_numero;
    const ultimo = typeof company.ultimo_numero_nfe === 'number' && !isNaN(company.ultimo_numero_nfe)
      ? company.ultimo_numero_nfe
      : 0;
    return String(ultimo + 1).padStart(6, '0');
  }, [currentQuoteState.nfe_numero, company.ultimo_numero_nfe]);

  const serieNfe = useMemo(() => {
    return String(currentQuoteState.serie_nfe || company.serie_nfe || '1');
  }, [currentQuoteState.serie_nfe, company.serie_nfe]);

  // Identifica o CSOSN principal para exibição do cabeçalho e regras de crédito
  const csosnPrincipal = useMemo(() => {
    if (!itensFiscais || itensFiscais.length === 0) return '101';
    const item101 = itensFiscais.find(it => (it.csosn || '').includes('101'));
    if (item101) return '101';
    const primeiro = (itensFiscais[0].csosn || '').split(' ')[0].replace(/\D/g, '');
    return primeiro || '101';
  }, [itensFiscais]);

  // 4. Confirmar & Transmitir SEFAZ
  const handleTransmitirSefaz = async () => {
    setIsTransmitting(true);
    setErrorMessage(null);

    // 1. Altera o status_nfe para "Processando"
    try {
      await updateCotacaoNfeStatusDb(currentQuoteState.id || currentQuoteState.quoteNumber, {
        status_nfe: 'Processando'
      });
      if (currentQuoteState.origemCotacaoIds && currentQuoteState.origemCotacaoIds.length > 0) {
        for (const cid of currentQuoteState.origemCotacaoIds) {
          if (cid && cid !== (currentQuoteState.id || currentQuoteState.quoteNumber)) {
            try {
              await updateCotacaoNfeStatusDb(cid, { status_nfe: 'Processando' });
            } catch {}
          }
        }
      }
      onSuccess({
        ...currentQuoteState,
        status_nfe: 'Processando'
      });
    } catch (e) {
      console.warn('Aviso ao registrar status Processando:', e);
    }

    try {
      // 2. Envia a solicitação para a API fiscal / SEFAZ com todos os itens da cotação
      const res = await transmitirNfeSefaz(currentQuoteState, client);

      if (res.sucesso && res.statusNfe === 'Emitida') {
        // 3. Sucesso: Grava a nfe_chave, nfe_numero, danfe_url, xml_url e muda o status para "Emitida"
        setTransmissionResult(res);
        const updatedQuote: Quote = {
          ...currentQuoteState,
          status_nfe: 'Emitida',
          nfe_chave: res.nfeChave,
          nfe_numero: res.nfeNumero,
          danfe_url: res.danfeUrl,
          xml_url: res.xmlUrl,
          xml_conteudo: res.xmlConteudo,
          mensagem_erro_nfe: undefined,
          nfe_emitida_em: res.dataEmissao
        };
        setCurrentQuoteState(updatedQuote);
        onSuccess(updatedQuote);

        // INCREMENTO AUTOMÁTICO NA EMISSÃO:
        // No momento exato em que a nota for autorizada com sucesso na SEFAZ,
        // o sistema incrementa o ultimo_numero_nfe na base de dados (tabela emitente)
        // para que a próxima nota siga a sequência corretamente (ex: emitiu a 1, atualiza para 1 para a próxima ser a 2)
        const numAutorizado = parseInt(String(res.nfeNumero).replace(/\D/g, ''), 10);
        if (numAutorizado > 0) {
          try {
            await updateEmitenteNfeConfig(numAutorizado, parseInt(String(res.serie || serieNfe || 1), 10));
          } catch (numErr) {
            console.warn('Aviso ao sincronizar ultimo_numero_nfe pós-autorização:', numErr);
          }
        }

        // 1. AÇÃO AUTOMÁTICA PÓS-AUTORIZAÇÃO (STATUS 100):
        // Dispara imediatamente o Modal/Visualizador do DANFE em PDF
        // e aciona a impressão automática / salvar como PDF do sistema
        setShowDanfeOficialModal(true);
        setAutoPrintDanfe(true);

        // 2. DISPARO AUTOMÁTICO DO XML E DANFE POR E-MAIL (CLIENTE + CONTADOR):
        // Dispara automaticamente cópia com XML e DANFE para o e-mail do Contador (email_contador)
        // e para o cliente (se cadastrado)
        try {
          const emailRes = enviarEmailNfe(updatedQuote, client, company, res.xmlConteudo, true);
          if (emailRes.destinatariosDescricao) {
            setEmailFeedback(emailRes.destinatariosDescricao);
            setTimeout(() => setEmailFeedback(null), 8000);
          }
        } catch (emailErr) {
          console.warn('Aviso ao disparar e-mail automático pós-autorização:', emailErr);
        }
      } else {
        // 4. Rejeição/Erro: Salva o erro em mensagem_erro_nfe e exibe o alerta explicativo na tela
        const msg = res.mensagemErro || 'Rejeição desconhecida pela SEFAZ.';
        setErrorMessage(msg);
        try {
          await updateCotacaoNfeStatusDb(currentQuoteState.id || currentQuoteState.quoteNumber, {
            status_nfe: 'Erro',
            mensagem_erro_nfe: msg
          });
        } catch {}
        const errorQuote: Quote = {
          ...currentQuoteState,
          status_nfe: 'Erro',
          mensagem_erro_nfe: msg
        };
        onSuccess(errorQuote);
      }
    } catch (err: any) {
      const msg = err?.message || 'Falha na comunicação com os servidores da SEFAZ.';
      setErrorMessage(msg);
      try {
        await updateCotacaoNfeStatusDb(currentQuoteState.id || currentQuoteState.quoteNumber, {
          status_nfe: 'Erro',
          mensagem_erro_nfe: msg
        });
      } catch {}
      const errorQuote: Quote = {
        ...currentQuoteState,
        status_nfe: 'Erro',
        mensagem_erro_nfe: msg
      };
      onSuccess(errorQuote);
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleOpenDanfe = () => {
    setShowDanfeOficialModal(true);
    setAutoPrintDanfe(false);
  };

  const handleDownloadXml = async () => {
    setIsDownloadingXml(true);
    try {
      if (transmissionResult?.xmlConteudo && (transmissionResult.chaveAcesso || transmissionResult.nfeChave)) {
        downloadXmlNfe(transmissionResult.xmlConteudo, (transmissionResult.chaveAcesso || transmissionResult.nfeChave)!);
      } else {
        await obterOuBaixarXmlNfe(quote, client, company);
      }
    } catch (e) {
      console.error('Erro ao baixar XML:', e);
    } finally {
      setIsDownloadingXml(false);
    }
  };

  const handleEnviarEmail = () => {
    const res = enviarEmailNfe(currentQuoteState, client, company, transmissionResult?.xmlConteudo || currentQuoteState.xml_conteudo);
    setEmailFeedback(res.destinatariosDescricao || (res.emailDestinatario ? `E-mail para: ${res.emailDestinatario}` : 'Nenhum e-mail de cliente ou contador configurado.'));
    setTimeout(() => setEmailFeedback(null), 7000);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950/70 border-b border-slate-700/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-100 text-base">
                  Revisão Fiscal & Emissão de NF-e
                </h3>
                {currentQuoteState.origemCotacoes && currentQuoteState.origemCotacoes.length > 1 ? (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shadow-xs">
                    ⚡ Multi-Cotação ({currentQuoteState.origemCotacoes.length} Agrupadas)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Cotação {quote.quoteNumber}
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-xs">
                  <FileText className="w-3 h-3 text-emerald-400" />
                  NF-e Nº {proximoNumeroNfe} - Série {serieNfe}
                </span>
              </div>
              {currentQuoteState.origemCotacoes && currentQuoteState.origemCotacoes.length > 1 ? (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] text-slate-400 font-semibold">Cotações agrupadas:</span>
                  {currentQuoteState.origemCotacoes.map((cNum) => (
                    <span key={cNum} className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-800 text-amber-200 border border-slate-700">
                      {cNum}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Conferência cadastral e tributária antes da transmissão para a SEFAZ
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          
          {/* Banner de NF-e CANCELADA */}
          {isCancelada && (
            <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-500/60 text-rose-100 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <Ban className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-rose-200">
                      NF-E CANCELADA HOMOLOGADA NA SEFAZ (STATUS 101)
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/30 text-rose-300 border border-rose-500/50">
                      SEM VALOR FISCAL
                    </span>
                  </div>
                  <p className="text-xs text-rose-300/90">
                    Esta nota fiscal foi cancelada perante a Receita Estadual. A emissão de novo DANFE com validade jurídica foi permanentemente desativada.
                  </p>
                  {currentQuoteState.protocolo_cancelamento && (
                    <p className="text-xs text-slate-300">
                      <strong>Protocolo do Evento de Cancelamento:</strong> <span className="font-mono text-rose-300">{currentQuoteState.protocolo_cancelamento}</span>
                    </p>
                  )}
                  {currentQuoteState.motivo_cancelamento && (
                    <p className="text-xs text-slate-300">
                      <strong>Justificativa Informada:</strong> <span className="italic text-slate-200">"{currentQuoteState.motivo_cancelamento}"</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sucesso Banner */}
          {transmissionResult && transmissionResult.sucesso && (
            <div className="p-4 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-100 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 space-y-1">
                  <h4 className="font-bold text-sm text-emerald-200">
                    NF-e Autorizada com Sucesso pela SEFAZ!
                  </h4>
                  <p className="text-xs text-emerald-300/90">
                    Nota Fiscal Eletrônica nº <strong className="text-white font-mono">{transmissionResult.nfeNumero}</strong> emitida e vinculada a esta cotação.
                  </p>
                  <div className="p-2.5 bg-slate-950/70 rounded-lg border border-emerald-500/30 font-mono text-[11px] text-slate-200 break-all select-all mt-2">
                    <span className="text-slate-400 block text-[9px] uppercase font-sans font-bold">Chave de Acesso (44 dígitos):</span>
                    {formatarChaveAcesso(transmissionResult.nfeChave || '')}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  onClick={handleOpenDanfe}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Visualizar / Imprimir DANFE
                </button>
                <button
                  onClick={handleDownloadXml}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar XML da NF-e
                </button>
              </div>
            </div>
          )}

          {/* Erro Banner */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 flex items-start gap-3 animate-in fade-in duration-200">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-rose-200">Rejeição na Transmissão Fiscal</h4>
                <p className="text-xs text-rose-300 leading-relaxed font-mono">
                  {errorMessage}
                </p>
                <p className="text-[11px] text-rose-400/90 mt-1">
                  Corrija o cadastro do cliente ou do produto e tente transmitir novamente.
                </p>
              </div>
            </div>
          )}

          {/* 1. Cabeçalho: Dados do Emitente e Dados do Cliente */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Box Emitente */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-400" />
                  Emitente (UsiCorte Metais)
                </span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  {company.taxRegime || 'Simples Nacional'}
                </span>
              </div>
              <div className="space-y-1 text-slate-300">
                <p className="font-bold text-slate-100">{company.corporateName || company.razao_social || 'L. M. BANZATTO METAIS'}</p>
                <p className="text-[11px] text-slate-400">{company.tradeName || company.nome_fantasia || 'USICORTE METAIS'}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-500 block">CNPJ:</span>
                    <strong className="text-slate-200 font-mono">{company.cnpj || '25.038.430/0001-23'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Inscrição Estadual:</span>
                    <strong className="text-slate-200 font-mono">{company.ie || company.inscricao_estadual || '20963213114'}</strong>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 pt-1 font-sans">
                  {formatarEnderecoEmitenteLimpo(company)}
                </p>
                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400 flex-wrap gap-1 border-t border-slate-700/50 mt-1">
                  <span>E-mail: <strong className="text-slate-200">{company.email}</strong></span>
                  {company.email_contador ? (
                    <span className="text-emerald-400 font-medium flex items-center gap-1" title="Contador que receberá cópia do XML/DANFE">
                      <Mail className="w-3 h-3 text-emerald-400" />
                      Contador: <strong className="text-emerald-300 font-mono text-[10px]">{company.email_contador}</strong>
                    </span>
                  ) : (
                    <span className="text-slate-500 text-[10px]" title="Configure na aba Emitente">Contador: não informado</span>
                  )}
                </div>
              </div>
            </div>

            {/* Box Destinatário / Cliente */}
            <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-400" />
                  Destinatário (Cliente)
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  isOperacaoInterestadual 
                    ? 'bg-amber-950/60 text-amber-300 border-amber-500/30' 
                    : 'bg-blue-950/60 text-blue-300 border-blue-500/30'
                }`}>
                  {isOperacaoInterestadual ? 'Operação Interestadual' : 'Operação Interna (SP)'}
                </span>
              </div>
              <div className="space-y-1 text-slate-300">
                <p className="font-bold text-slate-100">{clienteInfo.nome}</p>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-500 block">Documento:</span>
                    <strong className="text-slate-200 font-mono">{clienteInfo.doc}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Inscrição Estadual:</span>
                    <strong className="text-slate-200 font-mono">{clienteInfo.ie || 'ISENTO'}</strong>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400">
                    {clienteInfo.cidade} - <strong className="text-indigo-300">{clienteInfo.uf}</strong>
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Indicador IE: <strong className="text-slate-300 font-mono">{clienteInfo.indicadorIe}</strong>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-700/60 mt-1">
                  <span className="text-slate-400 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    Numeração Fiscal da Nota:
                  </span>
                  <strong className="text-emerald-400 font-mono font-bold bg-slate-900/80 px-2 py-0.5 rounded border border-emerald-500/30">
                    NF-e Nº {proximoNumeroNfe} - Série {serieNfe}
                  </strong>
                </div>
              </div>
            </div>

          </div>

          {/* 2. Validação Automática de CFOP */}
          <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                Regra SEFAZ Aplicada: Destinatário em <strong>{clienteInfo.uf}</strong> ➔ CFOP Automático definido para:
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs ${
                isOperacaoInterestadual
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}>
                {isOperacaoInterestadual ? '6102 (Interestadual)' : '5102 (Dentro de SP)'}
              </span>
            </div>
          </div>

          {/* 3. Tabela de Itens Fiscais */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                <span>Itens Fiscais da NF-e ({itensFiscais.length})</span>
                {isLoadingItems ? (
                  <span className="flex items-center gap-1 text-[11px] font-normal text-amber-300 ml-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Carregando todos os itens da cotação...
                  </span>
                ) : (
                  <span className="text-[10px] text-emerald-400/90 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Total integral carregado
                  </span>
                )}
              </h4>
              <span className="text-[11px] font-semibold text-indigo-300 bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-500/30">
                Tributação: Simples Nacional (CSOSN {csosnPrincipal})
              </span>
            </div>

            <div className="rounded-xl border border-slate-700 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-800 text-slate-300 uppercase font-semibold text-[10px] border-b border-slate-700">
                    <tr>
                      <th className="py-2.5 px-3 text-center w-10">Item</th>
                      <th className="py-2.5 px-3">Código & Descrição</th>
                      <th className="py-2.5 px-3 text-center">NCM</th>
                      <th className="py-2.5 px-3 text-center">CSOSN/CST</th>
                      <th className="py-2.5 px-3 text-center">CFOP</th>
                      <th className="py-2.5 px-3 text-center">UN</th>
                      <th className="py-2.5 px-3 text-right">Qtd</th>
                      <th className="py-2.5 px-3 text-right">Unitário</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                    {itensFiscais.map((it) => (
                      <tr key={it.id} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-center font-mono text-slate-500 font-bold">
                          {it.ordem}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-200">{it.descricao}</span>
                            {it.cotacaoOrigem && (
                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                Ref: {it.cotacaoOrigem}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">Cód: {it.codigo}</span>
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-slate-300">
                          {it.ncm}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="font-mono font-bold px-1.5 py-0.5 rounded text-[11px] text-indigo-300 bg-indigo-950/50 border border-indigo-500/30">
                            {(it.csosn && !it.csosn.includes('102')) ? it.csosn.split(' ')[0] : '101'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                            isOperacaoInterestadual ? 'text-amber-400 bg-amber-950/40' : 'text-emerald-400 bg-emerald-950/40'
                          }`}>
                            {it.cfop}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-bold text-blue-400">
                          {it.unidade}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-200">
                          {it.quantidade.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-300">
                          {formatCurrency(it.valorUnitario)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(it.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Resumo dos Valores */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between flex-wrap gap-4">
            <div className="text-slate-400 text-xs space-y-1">
              <p>• Regime Tributário: <strong className="text-slate-200">Simples Nacional (ME/EPP)</strong></p>
              {csosnPrincipal === '101' ? (
                <p className="text-emerald-400 font-medium">
                  • Imposto ICMS (Simples Nacional - CSOSN 101):{' '}
                  <strong className="text-emerald-300 font-bold">
                    Permite crédito de R$ {creditoIcms.valorCreditoFormatado} (Alíquota de {creditoIcms.aliquotaFormatada}%)
                  </strong>
                </p>
              ) : (
                <p>
                  • Imposto ICMS (Simples Nacional - CSOSN {csosnPrincipal}):{' '}
                  <strong className="text-slate-200">R$ 0,00 (Sem permissão de crédito)</strong>
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                • IPI: <strong className="text-slate-400">R$ 0,00 (Não tributado / Alíquota zero)</strong>
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                Valor Total da NF-e
              </span>
              <span className="text-xl font-mono font-extrabold text-emerald-400">
                {formatCurrency(valorTotal)}
              </span>
            </div>
          </div>

          {/* 4. Dados Adicionais e Informações Complementares da NF-e (infAdic / infCpl) */}
          <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5 text-xs">
                <Info className="w-4 h-4 text-blue-400" />
                Informações Complementares / Observações da NF-e (infAdic / infCpl)
              </span>
              {currentQuoteState.origemCotacoes && currentQuoteState.origemCotacoes.length > 1 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Agrupamento de {currentQuoteState.origemCotacoes.length} Cotações
                </span>
              )}
            </div>
            <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] leading-relaxed space-y-1 font-mono">
              <p className="text-slate-300 font-sans">
                • <strong className="text-slate-100 font-semibold">DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL.</strong> {creditoIcms.textoCredito}
              </p>
              <p className="text-slate-400">
                • Trib aprox: R$ {(valorTotal * 0.085).toFixed(2).replace('.', ',')} Fed (8,50%), R$ {(valorTotal * 0.0495).toFixed(2).replace('.', ',')} Est (4,95%) e R$ 0,00 Mun - Fonte: IBPT.
              </p>
              {currentQuoteState.origemCotacoes && currentQuoteState.origemCotacoes.length > 1 ? (
                <p className="text-amber-300 font-bold bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20 font-sans">
                  • Ref. Cotações: {currentQuoteState.origemCotacoes.join(', ')}
                </p>
              ) : (
                <p className="text-slate-400">
                  • Pedido de Venda / Cotação UsiCorte Ref: Nº {currentQuoteState.quoteNumber}.
                </p>
              )}
              {currentQuoteState.observations && !currentQuoteState.observations.includes('Ref. Cotações') && (
                <p className="text-slate-400 italic font-sans text-[10px]">
                  • Observações adicionais: {currentQuoteState.observations}
                </p>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isTransmitting}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
          >
            {transmissionResult?.sucesso ? 'Fechar' : 'Cancelar'}
          </button>

          <div className="flex items-center gap-2.5">
            {emailFeedback && (
              <span className="text-xs text-indigo-300 font-medium px-2 py-1 bg-indigo-950/60 rounded-md border border-indigo-500/30 animate-pulse">
                ✉️ {emailFeedback}
              </span>
            )}

            {isCancelada ? (
              <>
                <button
                  type="button"
                  onClick={() => abrirDanfeEmNovaAba(currentQuoteState, client)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Visualizar espelho da DANFE cancelada com tarja oficial SEM VALOR FISCAL"
                >
                  <Ban className="w-4 h-4 text-rose-400" />
                  DANFE Cancelada (Sem Valor Fiscal)
                </button>
                {currentQuoteState.xml_cancelamento && (
                  <button
                    type="button"
                    onClick={() => {
                      const chave = currentQuoteState.nfe_chave || currentQuoteState.chave_acesso || currentQuoteState.quoteNumber;
                      downloadXmlCancelamento(currentQuoteState.xml_cancelamento!, chave);
                    }}
                    className="px-4 py-2.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 border border-rose-700/50 font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Baixar XML do evento de cancelamento da NF-e homologado na SEFAZ"
                  >
                    <Download className="w-4 h-4" />
                    Baixar XML Cancelamento
                  </button>
                )}
              </>
            ) : (transmissionResult?.sucesso || isAutorizada) ? (
              <>
                <button
                  type="button"
                  onClick={handleEnviarEmail}
                  className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold text-xs rounded-xl border border-indigo-500/30 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Enviar XML e DANFE da NF-e por e-mail para o cliente e contador"
                >
                  <Mail className="w-4 h-4 text-indigo-400" />
                  Enviar E-mail (Cliente & Contador)
                </button>
                <button
                  type="button"
                  onClick={handleDownloadXml}
                  disabled={isDownloadingXml}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                  title="Baixar arquivo XML autorizado pela SEFAZ"
                >
                  <Download className="w-4 h-4" />
                  {isDownloadingXml ? 'Baixando...' : 'Baixar XML'}
                </button>
                {/* BOTÃO CANCELAR NF-E NA BARRA DE FERRAMENTAS FISCAL */}
                <button
                  type="button"
                  onClick={() => setShowCancelarModal(true)}
                  className="px-4 py-2.5 bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  title="Cancelar NF-e Homologada na SEFAZ (Status 101)"
                >
                  <Ban className="w-4 h-4" />
                  <span>CANCELAR NF-E</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenDanfe}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir DANFE
                </button>
              </>
            ) : (
              <>
                {/* BOTÃO DE PRÉ-VISUALIZAÇÃO DA DANFE */}
                <button
                  type="button"
                  onClick={() => setShowPreDanfeModal(true)}
                  disabled={isTransmitting || loadingCompany}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-indigo-300 hover:text-indigo-200 border border-indigo-500/40 hover:border-indigo-400 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Visualizar modelo de conferência (Pré-DANFE) antes de transmitir para a SEFAZ"
                >
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <span>👁️ Pré-visualizar DANFE</span>
                </button>

                {/* BOTÃO DE TRANSMISSÃO PRINCIPAL */}
                <button
                  type="button"
                  onClick={handleTransmitirSefaz}
                  disabled={isTransmitting || loadingCompany}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isTransmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Transmitindo para SEFAZ...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Confirmar & Transmitir SEFAZ</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>

      {/* ========================================================================= */}
      {/* MODAL ESPELHO DE PRÉ-VISUALIZAÇÃO DA DANFE (MODO DE CONFERÊNCIA FISCAL)   */}
      {/* ========================================================================= */}
      {showPreDanfeModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden">
            
            {/* Top Bar da Pré-Visualização */}
            <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 border-b border-slate-700 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-100 text-base">
                      Pré-Visualização da DANFE (Espelho Fiscal)
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      RASCUNHO / PRÉVIA
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Modo de conferência idêntico ao documento que será gerado pela SEFAZ
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenPreDanfeNewTab}
                  disabled={openingNewTab}
                  className="px-3.5 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Abrir Pré-DANFE em uma nova aba do navegador para impressão rápida"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{openingNewTab ? 'Abrindo...' : 'Abrir em Nova Aba'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreDanfeModal(false)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Banner de Aviso de Conferência */}
            <div className="px-5 py-2.5 bg-amber-950/80 border-b border-amber-500/40 text-amber-200 flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>MODO DE CONFERÊNCIA - NOTA AINDA NÃO TRANSMITIDA PARA A SEFAZ (PRÉVIA - SEM VALOR FISCAL)</span>
              </div>
              <span className="text-[11px] text-amber-300/80 hidden sm:inline">
                Cotação nº {quote.quoteNumber}
              </span>
            </div>

            {/* Corpo Espelho da DANFE (Layout Fiscal em Papel Branco A4) */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-950/60 flex justify-center">
              <div className="bg-white text-black p-6 rounded-lg shadow-xl max-w-4xl w-full text-[11px] font-sans relative border border-slate-300 select-text">
                
                {/* Marca d'água Diagonal Central */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10 overflow-hidden">
                  <div className="rotate-[-25deg] border-4 border-dashed border-red-500/30 text-red-500/20 font-black text-3xl sm:text-5xl uppercase tracking-widest p-6 text-center rounded-2xl">
                    PRÉVIA - SEM VALOR FISCAL<br />
                    <span className="text-xl sm:text-2xl font-bold tracking-normal">MODO DE CONFERÊNCIA</span>
                  </div>
                </div>

                {/* 1. Cabeçalho DANFE */}
                <div className="grid grid-cols-12 border border-black mb-1.5">
                  {/* Emitente (Prévia Centralizada DANFE) */}
                  <div className="col-span-6 p-2 border-r border-black flex flex-col items-center justify-center text-center overflow-hidden">
                    <div className="flex items-center justify-center w-full mb-1">
                      <Logo variant="print" className="h-8.5 w-auto max-h-10 mx-auto" />
                    </div>
                    <h2 className="font-extrabold text-[11px] leading-tight uppercase text-black">
                      L. M. BANZATTO METAIS
                    </h2>
                    <h3 className="font-bold text-[9.5px] text-red-700 leading-snug uppercase mt-0.5">
                      USICORTE METAIS
                    </h3>
                    <div className="my-1.5 w-full" />
                    <div className="text-[7.5px] leading-snug text-gray-800 font-normal space-y-0.5 w-full">
                      <div>RUA CORONEL INON CESAR PIMENTEL, 3-41</div>
                      <div>PARQUE PAULISTA</div>
                      <div>BAURU - SP - CEP: 17031-350</div>
                      <div className="font-medium text-gray-900">Fone: (14) 99880-9362 • Email: financeiro@usicorte.com.br</div>
                    </div>
                  </div>

                  {/* DANFE Box */}
                  <div className="col-span-2 p-2 border-r border-black text-center flex flex-col justify-center">
                    <span className="font-extrabold text-base leading-none">PRÉ-DANFE</span>
                    <span className="text-[8px] leading-tight text-gray-600 mt-0.5">Documento Auxiliar da Nota Fiscal Eletrônica</span>
                    <div className="my-1 text-[9px] font-bold">
                      0 - ENTRADA<br />
                      <strong>1 - SAÍDA [ 1 ]</strong>
                    </div>
                    <span className="font-bold text-[11px]">Nº {proximoNumeroNfe}</span>
                    <span className="text-[9px]">SÉRIE {serieNfe}</span>
                  </div>

                  {/* Chave de Acesso / Protocolo */}
                  <div className="col-span-4 p-2 flex flex-col justify-between">
                    <div>
                      <span className="block text-[8px] font-bold uppercase text-gray-500">CHAVE DE ACESSO (SIMULAÇÃO):</span>
                      <span className="font-mono text-[9px] font-bold text-gray-800 break-all">
                        CHAVE SERÁ GERADA APÓS TRANSMISSÃO SEFAZ
                      </span>
                    </div>
                    <div className="text-[9px] text-gray-500 my-1">
                      Documento emitido exclusivamente para prévia e conferência de dados fiscais.
                    </div>
                    <div className="pt-1 border-t border-gray-300">
                      <span className="block text-[8px] font-bold uppercase text-gray-500">PROTOCOLO DE AUTORIZAÇÃO:</span>
                      <span className="font-bold text-[10px] text-amber-800">
                        NÃO TRANSMITIDA (PRÉVIA FISCAL)
                      </span>
                    </div>
                  </div>
                </div>

                {/* Natureza da Operação / Inscrição Estadual / CNPJ */}
                <div className="border border-black mb-1.5 p-1.5 grid grid-cols-12 text-[10px]">
                  <div className="col-span-6">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">NATUREZA DA OPERAÇÃO</span>
                    <strong className="text-[11px]">VENDA DE MERCADORIA (PRÉVIA FISCAL)</strong>
                  </div>
                  <div className="col-span-3 border-l border-black pl-2">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">INSCRIÇÃO ESTADUAL</span>
                    <strong className="font-mono">{company.ie || company.inscricao_estadual || '20963213114'}</strong>
                  </div>
                  <div className="col-span-3 border-l border-black pl-2">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">CNPJ</span>
                    <strong className="font-mono">{company.cnpj || '25.038.430/0001-23'}</strong>
                  </div>
                </div>

                {/* 2. Destinatário / Remetente */}
                <div className="text-[9px] font-bold uppercase mb-0.5 text-gray-700">DESTINATÁRIO / REMETENTE</div>
                <div className="border border-black mb-1.5 p-1.5 space-y-1 text-[10px]">
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-7">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">NOME / RAZÃO SOCIAL</span>
                      <strong className="text-[11px]">{clienteInfo.nome}</strong>
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">CNPJ / CPF</span>
                      <strong className="font-mono">{clienteInfo.doc}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">DATA DA EMISSÃO</span>
                      <strong>{new Date().toLocaleDateString('pt-BR')}</strong>
                    </div>
                  </div>
                  <div className="grid grid-cols-12 gap-2 border-t border-gray-200 pt-1">
                    <div className="col-span-6">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">ENDEREÇO</span>
                      <span>{clienteInfo.endereco}</span>
                    </div>
                    <div className="col-span-3">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">MUNICÍPIO</span>
                      <span>{clienteInfo.cidade}</span>
                    </div>
                    <div className="col-span-1">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">UF</span>
                      <strong>{clienteInfo.uf}</strong>
                    </div>
                    <div className="col-span-2">
                      <span className="block text-[8px] font-bold text-gray-500 uppercase">INSCRIÇÃO ESTADUAL</span>
                      <strong className="font-mono">{clienteInfo.ie}</strong>
                    </div>
                  </div>
                </div>

                {/* 3. Cálculo do Imposto */}
                <div className="text-[9px] font-bold uppercase mb-0.5 text-gray-700">CÁLCULO DO IMPOSTO</div>
                <div className="border border-black mb-1.5 p-1.5 grid grid-cols-6 gap-2 text-center text-[10px]">
                  <div>
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">BASE CÁLC. ICMS</span>
                    <strong>R$ 0,00</strong>
                  </div>
                  <div className="border-l border-gray-300">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">VALOR DO ICMS</span>
                    <strong>R$ 0,00</strong>
                  </div>
                  <div className="border-l border-gray-300">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">BASE CÁLC. ICMS ST</span>
                    <strong>R$ 0,00</strong>
                  </div>
                  <div className="border-l border-gray-300">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">VALOR ICMS ST</span>
                    <strong>R$ 0,00</strong>
                  </div>
                  <div className="border-l border-gray-300">
                    <span className="block text-[8px] font-bold text-gray-500 uppercase">TOTAL PRODUTOS</span>
                    <strong>{formatCurrency(valorTotal)}</strong>
                  </div>
                  <div className="border-l border-black bg-gray-50">
                    <span className="block text-[8px] font-bold text-red-700 uppercase">TOTAL DA NOTA</span>
                    <strong className="text-red-700 font-bold">{formatCurrency(valorTotal)}</strong>
                  </div>
                </div>

                {/* 4. Tabela de Produtos / Serviços */}
                <div className="text-[9px] font-bold uppercase mb-0.5 text-gray-700">DADOS DOS PRODUTOS / SERVIÇOS</div>
                <div className="border border-black mb-1.5 overflow-hidden">
                  <table className="w-full text-left border-collapse text-[9px]">
                    <thead className="bg-gray-100 border-b border-black text-center font-bold text-[8px]">
                      <tr>
                        <th className="p-1 border-r border-black w-14">CÓDIGO</th>
                        <th className="p-1 border-r border-black text-left">DESCRIÇÃO DOS PRODUTOS / SERVIÇOS</th>
                        <th className="p-1 border-r border-black w-16">NCM</th>
                        <th className="p-1 border-r border-black w-12">CSOSN</th>
                        <th className="p-1 border-r border-black w-12">CFOP</th>
                        <th className="p-1 border-r border-black w-8">UN</th>
                        <th className="p-1 border-r border-black w-12 text-right">QTD</th>
                        <th className="p-1 border-r border-black w-16 text-right">V. UNIT</th>
                        <th className="p-1 w-16 text-right">V. TOTAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                      {itensFiscais.map((it) => (
                        <tr key={it.id}>
                          <td className="p-1 border-r border-black text-center font-mono">{it.codigo}</td>
                          <td className="p-1 border-r border-black font-semibold">{it.descricao}</td>
                          <td className="p-1 border-r border-black text-center font-mono">{it.ncm}</td>
                          <td className="p-1 border-r border-black text-center font-mono">{(it.csosn && !it.csosn.includes('102')) ? (it.csosn.includes('101') ? '101' : it.csosn.split(' ')[0]) : '101'}</td>
                          <td className="p-1 border-r border-black text-center font-mono font-bold text-indigo-900">{it.cfop}</td>
                          <td className="p-1 border-r border-black text-center font-bold">{it.unidade}</td>
                          <td className="p-1 border-r border-black text-right font-mono">{it.quantidade.toFixed(2)}</td>
                          <td className="p-1 border-r border-black text-right font-mono">{formatCurrency(it.valorUnitario)}</td>
                          <td className="p-1 text-right font-mono font-bold">{formatCurrency(it.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 5. Dados Adicionais / Observações ao Fisco */}
                <div className="text-[9px] font-bold uppercase mb-0.5 text-gray-700">DADOS ADICIONAIS / INFORMAÇÕES COMPLEMENTARES</div>
                <div className="border border-black p-2 text-[9px] leading-relaxed bg-gray-50/50">
                  <p className="font-semibold text-slate-900">
                    DOCUMENTO EMITIDO POR ME OU EPP OPTANTE PELO SIMPLES NACIONAL. {creditoIcms.textoCredito}
                  </p>
                  <p className="text-gray-600">
                    Trib aprox: R$ {(valorTotal * 0.085).toFixed(2).replace('.', ',')} Fed, R$ {(valorTotal * 0.0495).toFixed(2).replace('.', ',')} Est e R$ 0,00 Mun - Fonte: IBPT.{' '}
                    {currentQuoteState.origemCotacoes && currentQuoteState.origemCotacoes.length > 1 ? (
                      <strong className="text-slate-900">Ref. Cotações: {currentQuoteState.origemCotacoes.join(', ')}.</strong>
                    ) : (
                      <>Cotação de Venda Ref: Nº {currentQuoteState.quoteNumber}.</>
                    )}
                  </p>
                  <p className="text-red-700 font-bold mt-1">
                    ATENÇÃO: MODO DE CONFERÊNCIA. ESTE DOCUMENTO É UMA PRÉVIA E NÃO POSSUI VALIDADE JURÍDICA OU FISCAL.
                  </p>
                </div>

              </div>
            </div>

            {/* Rodapé do Modal Espelho com Ações */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowPreDanfeModal(false)}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Voltar para Revisão
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleOpenPreDanfeNewTab}
                  disabled={openingNewTab}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Prévia / Nova Aba</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPreDanfeModal(false);
                    handleTransmitirSefaz();
                  }}
                  disabled={isTransmitting || loadingCompany}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Confirmar & Transmitir SEFAZ</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE CANCELAMENTO DE NF-E HOMOLOGADA (SEFAZ) */}
      {showCancelarModal && (
        <CancelarNfeModal
          quote={currentQuoteState}
          client={client}
          onSuccess={(updated) => {
            setCurrentQuoteState(updated);
            onSuccess(updated);
            setShowCancelarModal(false);
          }}
          onClose={() => setShowCancelarModal(false)}
        />
      )}

      {/* MODAL / VISUALIZADOR OFICIAL DA DANFE (A4) COM DISPARO AUTOMÁTICO DE IMPRESSÃO */}
      {showDanfeOficialModal && (
        <DanfeEspelhoA4Modal
          isOpen={showDanfeOficialModal}
          onClose={() => {
            setShowDanfeOficialModal(false);
            setAutoPrintDanfe(false);
          }}
          quote={currentQuoteState}
          client={client}
          company={company}
          isPrevia={false}
          autoPrint={autoPrintDanfe}
          onQuoteUpdated={(updated) => {
            setCurrentQuoteState(updated);
            onSuccess(updated);
          }}
        />
      )}
    </>
  );
}

