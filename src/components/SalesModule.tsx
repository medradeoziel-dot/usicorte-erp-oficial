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
