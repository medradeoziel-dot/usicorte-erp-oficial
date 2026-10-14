import React, { useState, useEffect, useMemo } from 'react';
import Logo from './Logo';
import { CompanyFiscalData, Client } from '../types';
import { formatCurrency, formatSafeDate } from '../utils/calculator';
import { getLocalCompanyData, fetchCompanyData, DEFAULT_COMPANY_DATA } from '../services/companyService';
import { RegistroPagamentoCotacao } from '../services/inventoryFinanceService';

export interface ExtratoCotacaoItemDetalhado {
  id?: string | number;
  produto: string;
  medida: string;
  descricao: string;
  info?: string;
  unitario: number;
  qtd: number;
  subtotal: number;
}

export interface ExtratoCotacaoItem {
  id?: string;
  numero: string;
  data: string;
  cliente: string;
  clienteDoc?: string;
  clienteTelefone?: string;
  clienteEndereco?: string;
  clienteCidade?: string;
  clienteContato?: string;
  valor: number;
  pesoKg?: number;
  qtdItens?: number;
  itensResumo?: string;
  statusCotacao?: string;
  pagamento?: RegistroPagamentoCotacao;
  itens?: ExtratoCotacaoItemDetalhado[];
}

interface ExtratoCobrancaPrintProps {
  cotacoes: ExtratoCotacaoItem[];
  clienteInfo?: Partial<Client> & Record<string, any>;
  periodoInicio?: string;
  periodoFim?: string;
  observacoesExtrato?: string;
  chavePixCustom?: string;
  dadosBancariosCustom?: string;
}

export default function ExtratoCobrancaPrint({
  cotacoes,
  clienteInfo,
  periodoInicio,
  periodoFim,
  observacoesExtrato,
  chavePixCustom,
  dadosBancariosCustom
}: ExtratoCobrancaPrintProps) {
  const [companyData, setCompanyData] = useState<CompanyFiscalData>(() => getLocalCompanyData() || DEFAULT_COMPANY_DATA);

  useEffect(() => {
    let isMounted = true;
    fetchCompanyData().then((data) => {
      if (isMounted && data) {
        setCompanyData(data);
      }
    });

    const handleUpdate = (e: any) => {
      if (isMounted && e?.detail) {
        setCompanyData(e.detail);
      }
    };
    window.addEventListener('company-data-updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('company-data-updated', handleUpdate);
    };
  }, []);

  // Totais
  const totalValor = useMemo(() => {
    return cotacoes.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
  }, [cotacoes]);

  // Nome do cliente para o cabeçalho
  const nomeClienteDisplay = useMemo(() => {
    const nomeInfo = clienteInfo?.nomeFantasia || clienteInfo?.nome || clienteInfo?.name || clienteInfo?.fantasyName;
    if (nomeInfo && String(nomeInfo).trim()) {
      return String(nomeInfo).trim().toUpperCase();
    }
    const nomes = Array.from(new Set(cotacoes.map(c => (c.cliente || '').trim()).filter(Boolean)));
    if (nomes.length === 1) return nomes[0].toUpperCase();
    if (nomes.length > 1) return `CONSOLIDADO (${nomes.length} CLIENTES)`;
    return 'CLIENTE';
  }, [clienteInfo, cotacoes]);

  const docCliente = clienteInfo?.document || clienteInfo?.documento || cotacoes[0]?.clienteDoc || '';
  const foneCliente = clienteInfo?.phone || clienteInfo?.telefone || cotacoes[0]?.clienteTelefone || '';
  const enderecoCliente = clienteInfo?.street || clienteInfo?.endereco || cotacoes[0]?.clienteEndereco || '';
  const cidadeUfCliente = (clienteInfo?.city || clienteInfo?.cidade) 
    ? `${clienteInfo?.city || clienteInfo?.cidade} / ${clienteInfo?.state || clienteInfo?.uf || 'SP'}`
    : (cotacoes[0]?.clienteCidade || '');

  const dataAtual = new Date().toLocaleDateString('pt-BR');

  // Dados Bancários e Chave PIX
  const chavePix = (chavePixCustom || companyData.chavePix || companyData.chave_pix || '').trim();
  const tipoChavePix = (companyData.tipoChavePix || companyData.tipo_chave_pix || '').trim();
  const favorecidoPix = (companyData.favorecidoPix || companyData.favorecido_pix || '').trim();

  const bancoNome = (companyData.bancoNome || companyData.banco_nome || '').trim();
  const bancoAgencia = (companyData.bancoAgencia || companyData.banco_agencia || '').trim();
  const bancoConta = (companyData.bancoConta || companyData.banco_conta || '').trim();
  const bancoTitular = (companyData.bancoTitular || companyData.banco_titular || '').trim();
  const bancoCnpj = (companyData.bancoCnpj || companyData.banco_cnpj || '').trim();

  const instrucoesPagamento = (companyData.instrucoesPagamento || companyData.instrucoes_pagamento || '').trim();

  const hasPix = Boolean(chavePix || tipoChavePix || favorecidoPix);
  const hasBank = Boolean(dadosBancariosCustom || bancoNome || bancoAgencia || bancoConta || bancoTitular || bancoCnpj);
  const hasPaymentInfo = hasPix || hasBank || Boolean(instrucoesPagamento);

  return (
    <div className="extrato-print-area secao-extrato bg-white text-black p-6 sm:p-8 max-w-[850px] mx-auto font-sans leading-relaxed text-xs print:p-0 print:m-0 print:max-w-none print:w-full print:h-auto print:overflow-visible">
      {/* Regras de impressão específicas para garantir página única / sem páginas em branco extras */}
      <style>{`
        @media print {
          /* Oculta o fundo da aplicação e overlays da modal */
          body * {
            visibility: hidden !important;
          }
          /* Exibe apenas o conteúdo da folha do extrato */
          .extrato-print-area, .extrato-print-area * {
            visibility: visible !important;
          }
          .extrato-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            overflow: visible !important;
            background: white !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .extrato-blocos-cotacoes,
          .bloco-cotacao-extrato,
          .extrato-total-geral-box,
          .extrato-pagamento-box,
          .extrato-assinaturas {
            height: auto !important;
            overflow: visible !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .extrato-assinaturas {
            margin-bottom: 0 !important;
            padding-bottom: 0 !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

      {/* ========================================================
          A) CABEÇALHO SUPERIOR FIXO
          ======================================================== */}
      <header className="extrato-cabecalho-superior border-b-2 border-slate-900 pb-3 mb-4 print:border-slate-900 print:pb-2 print:mb-3">
        <div className="flex items-center justify-between gap-4">
          {/* Logo "Usicorte Metais" à esquerda */}
          <div className="w-[160px] sm:w-[180px] shrink-0">
            <Logo variant="print" className="h-10 sm:h-12 w-auto" />
          </div>

          {/* Razão Social centralizada */}
          <div className="flex-1 text-center px-1">
            <div className="text-[11.5px] sm:text-[12px] font-bold text-slate-900 leading-tight sm:leading-snug tracking-wide uppercase">
              L. M. BANZATTO METAIS | SOB CNPJ: 25.038.430/0001-23 | IE: 209632312114
            </div>
            <div className="text-[10px] text-slate-700 font-medium mt-0.5">
              FONE: (14) 99880-9362 / (14) 99819-6873 / vendas.usicorte@gmail.com
            </div>
          </div>

          {/* Espaçador para alinhamento geométrico perfeito */}
          <div className="w-[120px] sm:w-[180px] shrink-0 hidden sm:block text-right">
            <span className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">UsiCorte Metais</span>
          </div>
        </div>

        {/* Sub-cabeçalho: Badge "FATURAMENTO", "EXTRATO DE COBRANÇA E FECHAMENTO - [Nome do Cliente]" e a Data Atual */}
        <div className="mt-2.5 pt-2 border-t border-slate-300 flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-2 rounded border border-slate-200 print:bg-slate-50 print:border-slate-300 print:py-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-blue-600 text-white text-[9.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-sm print:bg-blue-600 print:text-white">
              FATURAMENTO
            </span>
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              EXTRATO DE COBRANÇA E FECHAMENTO - {nomeClienteDisplay}
            </span>
          </div>
          <div className="text-xs text-slate-800 font-medium">
            <span className="text-slate-600">Data:</span> <strong className="font-mono text-slate-950">{dataAtual}</strong>
          </div>
        </div>
      </header>

      {/* Dados do Cliente / Sacado (quando disponíveis) */}
      {(docCliente || foneCliente || enderecoCliente) && (
        <div className="border border-slate-300 rounded p-2.5 mb-3 bg-slate-50/70 text-xs print:bg-slate-50 print:border-slate-300 print:p-2 print:mb-2.5">
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-slate-700">
            {docCliente && (
              <div>
                <span className="text-slate-500 font-semibold">CNPJ/CPF:</span>{' '}
                <span className="font-mono font-bold text-slate-900">{docCliente}</span>
              </div>
            )}
            {foneCliente && (
              <div>
                <span className="text-slate-500 font-semibold">Telefone:</span>{' '}
                <span className="font-semibold text-slate-900">{foneCliente}</span>
              </div>
            )}
            {enderecoCliente && (
              <div>
                <span className="text-slate-500 font-semibold">Endereço:</span>{' '}
                <span className="text-slate-900">{enderecoCliente} {cidadeUfCliente ? ` - ${cidadeUfCliente}` : ''}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================
          B) CORPO DO EXTRATO (BLOCOS DE COTAÇÕES SELECIONADAS)
          ======================================================== */}
      <div className="extrato-blocos-cotacoes space-y-4 print:space-y-4 mb-4">
        {cotacoes.map((quote, qIndex) => {
          const items = (quote.itens && quote.itens.length > 0)
            ? quote.itens
            : [{
                id: 1,
                produto: 'SERVIÇOS DE CORTE DIVERSOS',
                medida: '—',
                descricao: quote.itensResumo || 'Serviços industriais de corte e conformação',
                info: '',
                unitario: Number(quote.valor) || 0,
                qtd: 1,
                subtotal: Number(quote.valor) || 0
              }];

          const totalPecasBloco = items.reduce((acc, it) => acc + (Number(it.qtd) || 1), 0);

          return (
            <div 
              key={quote.id || quote.numero || qIndex}
              className="bloco-cotacao-extrato border-2 border-slate-400 rounded-lg overflow-hidden bg-white shadow-sm print:shadow-none print:border-slate-400 print:rounded"
              style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
            >
              {/* Barra de título do bloco: "COTAÇÃO: [N°] | DATA: [Data]" */}
              <div className="bg-slate-800 text-white px-3.5 py-1.5 flex items-center justify-between text-xs font-bold uppercase tracking-wider print:bg-slate-800 print:text-white">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[12px] font-black text-white">
                    COTAÇÃO: {quote.numero}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-200">
                    DATA: {formatSafeDate(quote.data)}
                  </span>
                </div>
                {quote.cliente && (
                  <span className="text-[10.5px] text-slate-300 font-medium truncate max-w-[280px]">
                    CLIENTE: {quote.cliente}
                  </span>
                )}
              </div>

              {/* Tabela de itens com colunas: PRODUTO / MATERIAL, MEDIDAS, DESCRIÇÃO, INFORMAÇÕES, UNITÁRIO, QTD e SUBTOTAL */}
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 border-b border-slate-300 font-bold uppercase text-[9.5px]">
                    <th className="border border-slate-300 px-2.5 py-1.5 text-left">PRODUTO / MATERIAL</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-left w-24">MEDIDAS</th>
                    <th className="border border-slate-300 px-2.5 py-1.5 text-left">DESCRIÇÃO</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-left w-28">INFORMAÇÕES</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-right w-20">UNITÁRIO</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-center w-14">QTD</th>
                    <th className="border border-slate-300 px-2.5 py-1.5 text-right w-24">SUBTOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, iIdx) => (
                    <tr 
                      key={item.id || iIdx} 
                      className={`border-b border-slate-200 ${iIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
                    >
                      <td className="border border-slate-300 px-2.5 py-1.5 font-bold text-slate-900 uppercase text-[10.5px]">
                        {item.produto}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 font-mono text-slate-800 text-[10px]">
                        {item.medida || '—'}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-1.5 text-slate-700 text-[10.5px]">
                        {item.descricao || 'Item industrial'}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-slate-600 text-[10px]">
                        {item.info || '—'}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-mono text-slate-800 text-[10.5px] whitespace-nowrap">
                        {formatCurrency(item.unitario)}
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-center font-mono font-bold text-slate-900 text-[10.5px]">
                        {item.qtd}
                      </td>
                      <td className="border border-slate-300 px-2.5 py-1.5 text-right font-mono font-bold text-slate-950 text-[10.5px] whitespace-nowrap">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Barra de totais do bloco: "ITENS: [N°] TOTAL PEÇAS: [Qtd Peças] PC" e "TOTAL: R$ [Valor]" */}
              <div className="bg-slate-100 border-t border-slate-300 px-3 py-1.5 flex items-center justify-between text-xs font-bold text-slate-800">
                <div className="flex items-center gap-3">
                  <span>ITENS: <span className="font-mono text-slate-900">{items.length}</span></span>
                  <span className="text-slate-400">|</span>
                  <span>TOTAL PEÇAS: <span className="font-mono text-slate-900">{totalPecasBloco}</span> PC</span>
                </div>
                <div className="text-right">
                  <span>TOTAL: <span className="font-mono font-black text-slate-950">{formatCurrency(quote.valor)}</span></span>
                </div>
              </div>

              {/* Rodapé do bloco com as observações: "Validade da proposta: 10 dias | Prazo de entrega: A combinar após aprovação" e o "VALOR TOTAL: R$ [Valor]" */}
              <div className="bg-slate-50 border-t border-slate-300 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-700">
                <div className="italic text-slate-600">
                  Validade da proposta: 10 dias | Prazo de entrega: A combinar após aprovação
                </div>
                <div className="text-right font-bold text-xs text-slate-900">
                  VALOR TOTAL: <span className="font-mono font-black text-sm text-blue-900">{formatCurrency(quote.valor)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Destaque Consolidado do Total Geral a Cobrar */}
      <div className="extrato-total-geral-box border-2 border-slate-900 rounded-lg p-3.5 mb-4 bg-slate-900 text-white flex items-center justify-between shadow-sm print:bg-slate-50 print:border-slate-900 print:text-slate-900 print:p-2.5 print:mb-3">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-slate-300 print:text-slate-700 block">
            Valor Total Geral do Extrato ({cotacoes.length} {cotacoes.length === 1 ? 'Cotação' : 'Cotações'})
          </span>
          <span className="text-[11px] text-slate-400 print:text-slate-500">
            Referente a todas as cotações selecionadas acima
          </span>
        </div>
        <div className="text-right">
          <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-white print:text-slate-950">
            {formatCurrency(totalValor)}
          </span>
        </div>
      </div>

      {/* Informações Bancárias & Chave PIX da Empresa Emitente */}
      {hasPaymentInfo && (
        <div className="extrato-pagamento-box border border-slate-300 rounded-lg p-3 mb-4 bg-slate-50 print:bg-slate-50 print:border-slate-300 print:mb-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
            💳 Informações para Pagamento & Chave PIX
          </div>

          <div className="flex flex-col sm:flex-row gap-3 text-xs">
            {hasPix && (
              <div className="flex-1 bg-white border border-slate-200 rounded p-2.5">
                <div className="text-[10px] font-bold uppercase text-slate-600 mb-0.5">Chave PIX Oficial</div>
                {chavePix && (
                  <div className="text-sm font-mono font-black text-slate-900 select-all">
                    {chavePix}
                  </div>
                )}
                {tipoChavePix && (
                  <div className="text-[9.5px] text-slate-600 mt-1">
                    Tipo da Chave: <strong>{tipoChavePix}</strong>
                  </div>
                )}
                {favorecidoPix && (
                  <div className="text-[9.5px] text-slate-600 mt-0.5">
                    Favorecido: <strong>{favorecidoPix}</strong>
                  </div>
                )}
              </div>
            )}

            {hasBank && (
              <div className="flex-1 bg-white border border-slate-200 rounded p-2.5">
                <div className="text-[10px] font-bold uppercase text-slate-600 mb-0.5">Dados Bancários / Transferência</div>
                {dadosBancariosCustom ? (
                  <div className="text-xs text-slate-900 font-semibold leading-relaxed">
                    {dadosBancariosCustom}
                  </div>
                ) : (
                  <div className="text-xs text-slate-900 space-y-0.5 leading-relaxed">
                    {bancoNome && <div>Banco: <strong>{bancoNome}</strong></div>}
                    <div className="flex flex-wrap gap-x-3">
                      {bancoAgencia && <span>Agência: <strong>{bancoAgencia}</strong></span>}
                      {bancoConta && <span>Conta: <strong>{bancoConta}</strong></span>}
                    </div>
                    {bancoTitular && <div>Titular: <strong>{bancoTitular}</strong></div>}
                    {bancoCnpj && <div>CNPJ: <strong>{bancoCnpj}</strong></div>}
                  </div>
                )}
              </div>
            )}
          </div>

          {instrucoesPagamento && (
            <div className="mt-2 text-[10px] text-slate-700 bg-amber-50 border border-amber-200 rounded p-2">
              📌 <strong>Importante:</strong> {instrucoesPagamento}
            </div>
          )}
        </div>
      )}

      {/* Observações Complementares */}
      {observacoesExtrato && (
        <div className="border border-slate-300 rounded p-2.5 mb-4 print:mb-2 print:p-2 text-xs text-slate-700 bg-white">
          <strong className="text-slate-900 block mb-0.5 text-[10.5px] uppercase">Observações Complementares:</strong>
          <p className="whitespace-pre-line">{observacoesExtrato}</p>
        </div>
      )}

      {/* Assinaturas / Termo de Conferência */}
      <div className="extrato-assinaturas flex flex-row justify-between gap-8 pt-5 mt-4 print:pt-3 print:mt-2 print:mb-0 border-t border-slate-300 text-center text-xs">
        <div className="flex-1">
          <div className="border-b border-slate-400 w-4/5 mx-auto mb-1"></div>
          <div className="font-bold text-slate-900">{companyData.tradeName || 'USICORTE METAIS'}</div>
          <div className="text-[10px] text-slate-600">Departamento Financeiro / Vendas</div>
        </div>

        <div className="flex-1">
          <div className="border-b border-slate-400 w-4/5 mx-auto mb-1"></div>
          <div className="font-bold text-slate-900 uppercase">{nomeClienteDisplay}</div>
          <div className="text-[10px] text-slate-600">Conferência & De Acordo</div>
        </div>
      </div>
    </div>
  );
}
