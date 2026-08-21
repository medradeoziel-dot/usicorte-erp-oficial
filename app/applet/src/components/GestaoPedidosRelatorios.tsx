import React, { useState } from 'react';

// ============================================================================
// 1. INTERFACE DE DADOS
// ============================================================================
export interface ItemRelatorio {
  idVer: number;
  data: string;
  cliente: string;
  contato: string;
  produto: string;
  medida: string;
  descricao: string;
  qtd: number;
  unitario: number;
  valorGeral: number;
  observacao?: string;
  pesoTotal?: number;
}

// ============================================================================
// 2. DADOS DE EXEMPLO
// ============================================================================
const DADOS_INICIAIS: ItemRelatorio[] = [
  { idVer: 14000, data: '14/08/2026', cliente: 'Brasil Tecnologias Ltda', contato: 'Oziel Medrade', produto: 'CHAPA', medida: '1/2" (12.7mm) x 1200 x 2400', descricao: 'Chapa de Aço SAE 1020 Cut', qtd: 2, unitario: 6316.57, valorGeral: 12633.14, pesoTotal: 574.23, observacao: 'SAE 1020' },
  { idVer: 14001, data: '14/08/2026', cliente: 'Brasil Tecnologias Ltda', contato: 'Oziel Medrade', produto: 'CHAPA', medida: '1" (25.4mm) x 300 x 600', descricao: 'Chapa Aço SAE 1045 Bloco', qtd: 4, unitario: 638.82, valorGeral: 2555.28, pesoTotal: 143.55, observacao: 'SAE 1045' },
  { idVer: 13942, data: '12/08/2026', cliente: 'DPROJECTS', contato: 'Marcos', produto: 'NYLON REDONDO', medida: '60 x 780', descricao: 'NYLON', qtd: 1, unitario: 238.00, valorGeral: 238.00, pesoTotal: 2.50, observacao: 'NYLON' },
  { idVer: 13940, data: '12/08/2026', cliente: 'DPROJECTS', contato: 'Marcos', produto: 'QUADRADO', medida: '1 1/4 x 110', descricao: 'TREFILADO SAE 1045', qtd: 2, unitario: 15.00, valorGeral: 30.00, pesoTotal: 1.20, observacao: 'TREFILADO' },
  { idVer: 13930, data: '12/08/2026', cliente: 'VCI METAIS', contato: 'Carlos', produto: 'CHAPA', medida: '1 1/2 x 79 x 155', descricao: 'RETANGULO', qtd: 3, unitario: 27.00, valorGeral: 81.00, pesoTotal: 4.30, observacao: 'RETANGULO' },
  { idVer: 13911, data: '12/08/2026', cliente: 'PORTEX', contato: 'Roberto', produto: 'AÇO REDONDO', medida: '4"1/2 x 40', descricao: 'LAMINADO SAE 4140', qtd: 1, unitario: 90.00, valorGeral: 90.00, pesoTotal: 12.10, observacao: 'SAE 4140' },
  { idVer: 13897, data: '12/08/2026', cliente: 'IRMÃOS VICENTE', contato: 'João', produto: 'AÇO REDONDO', medida: '5" x 43', descricao: 'LAMINADO SAE 1045', qtd: 1, unitario: 110.00, valorGeral: 110.00, pesoTotal: 14.50, observacao: 'SAE 1045' },
];

export default function GestaoPedidosRelatorios() {
  const [itens] = useState<ItemRelatorio[]>(DADOS_INICIAIS);
  const [itensSelecionadosIds, setItensSelecionadosIds] = useState<number[]>([14000, 14001]);
  const [modeloAtivo, setModeloAtivo] = useState<'tabela' | 'empresa' | 'corte' | 'proposta' | 'pedido' | 'etiqueta'>('tabela');

  const formatCurrency = (val: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

  // Seleção individual de checkboxes
  const toggleSelecao = (id: number) => {
    setItensSelecionadosIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Selecionar todos os itens
  const toggleTodos = () => {
    if (itensSelecionadosIds.length === itens.length) {
      setItensSelecionadosIds([]);
    } else {
      setItensSelecionadosIds(itens.map(i => i.idVer));
    }
  };

  // Itens filtrados para o relatório
  const itensParaImprimir = itens.filter(item => itensSelecionadosIds.includes(item.idVer));
  const clienteAtual = itensParaImprimir[0]?.cliente || "CLIENTE NÃO SELECIONADO";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans">
      {/* 
        ========================================================================
        REGRAS CSS MÁGICAS DE IMPRESSÃO
        Garante que ao clicar em Imprimir, NADA do sistema vaze na folha!
        ========================================================================
      */}
      <style>{`
        @media print {
          /* Esconde tudo no sistema */
          body * {
            visibility: hidden !important;
          }
          /* Mostra APENAS a área do relatório escolhido */
          #area-impressao, #area-impressao * {
            visibility: visible !important;
          }
          #area-impressao {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
          }
          /* Esconde botões de controle na impressão */
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* ========================================================================
          VISÃO 1: PAINEL PRINCIPAL DO SISTEMA (TABELA)
          ======================================================================== */}
      {modeloAtivo === 'tabela' && (
        <div className="p-6 max-w-7xl mx-auto">
          <header className="mb-6 flex justify-between items-center border-b border-slate-700 pb-4">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-blue-500">Usicorte</span> Metais - Gestão de Pedidos
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Selecione os itens desejados na tabela e escolha o modelo para visualizar.
              </p>
            </div>
            <div className="text-right">
              <span className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-full border border-slate-700">
                Itens selecionados: <strong className="text-blue-400">{itensSelecionadosIds.length}</strong>
              </span>
            </div>
          </header>

          {/* BARRA DE AÇÕES / MODELOS DE RELATÓRIO */}
          <div className="bg-slate-800 p-4 rounded-xl shadow-lg border border-slate-700 mb-6 flex flex-wrap gap-3 items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Visualizar Modelo:</span>
            
            <button
              onClick={() => setModeloAtivo('empresa')}
              disabled={itensSelecionadosIds.length === 0}
              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              🏢 1. Relatório Empresa
            </button>

            <button
              onClick={() => setModeloAtivo('corte')}
              disabled={itensSelecionadosIds.length === 0}
              className="bg-red-950/80 hover:bg-red-900 border border-red-800/50 disabled:opacity-40 text-red-200 px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              ✂️ 2. Ordem de Corte
            </button>

            <button
              onClick={() => setModeloAtivo('proposta')}
              disabled={itensSelecionadosIds.length === 0}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-blue-900/30 cursor-pointer"
            >
              📄 3. Proposta Comercial
            </button>

            <button
              onClick={() => setModeloAtivo('pedido')}
              disabled={itensSelecionadosIds.length === 0}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-amber-900/30 cursor-pointer"
            >
              📋 4. Pedido (2 Vias)
            </button>

            <button
              onClick={() => setModeloAtivo('etiqueta')}
              disabled={itensSelecionadosIds.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-900/30 cursor-pointer"
            >
              🏷️ 5. Etiquetas de Peças
            </button>
          </div>

          {/* TABELA PRINCIPAL DO SISTEMA */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-200 border-collapse">
                <thead className="bg-slate-950/60 text-slate-400 font-bold uppercase border-b border-slate-700">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input 
                        type="checkbox" 
                        checked={itensSelecionadosIds.length === itens.length && itens.length > 0} 
                        onChange={toggleTodos}
                        className="rounded accent-blue-600 cursor-pointer w-4 h-4"
                      />
                    </th>
                    <th className="p-3">IdVer</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Cliente / Empresa</th>
                    <th className="p-3">Contato</th>
                    <th className="p-3">Produto</th>
                    <th className="p-3">Medida</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3 text-right">Qtd</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {itens.map((item) => {
                    const isSelected = itensSelecionadosIds.includes(item.idVer);
                    return (
                      <tr 
                        key={item.idVer} 
                        className={`transition-colors hover:bg-slate-700/50 cursor-pointer ${isSelected ? 'bg-blue-950/30' : ''}`}
                        onClick={() => toggleSelecao(item.idVer)}
                      >
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            checked={isSelected} 
                            onChange={() => toggleSelecao(item.idVer)}
                            className="rounded accent-blue-600 cursor-pointer w-4 h-4"
                          />
                        </td>
                        <td className="p-3 font-bold text-slate-100">{item.idVer}</td>
                        <td className="p-3 text-slate-400">{item.data}</td>
                        <td className="p-3 font-bold text-blue-300">{item.cliente}</td>
                        <td className="p-3 text-slate-300">{item.contato}</td>
                        <td className="p-3 font-medium text-slate-200">{item.produto}</td>
                        <td className="p-3 font-mono text-slate-300">{item.medida}</td>
                        <td className="p-3 text-slate-400">{item.descricao}</td>
                        <td className="p-3 text-right font-bold text-white">{item.qtd}</td>
                        <td className="p-3 text-right font-bold text-emerald-400">{formatCurrency(item.valorGeral)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          VISÃO 2: TELA DE PRÉ-VISUALIZAÇÃO / IMPRESSÃO ISOLADA
          ======================================================================== */}
      {modeloAtivo !== 'tabela' && (
        <div className="min-h-screen bg-slate-950 pb-12">
          
          {/* BARRA SUPERIOR DE PRÉ-VISUALIZAÇÃO (NÃO SAI NA IMPRESSÃO) */}
          <div className="no-print sticky top-0 z-50 bg-slate-900 border-b border-slate-800 p-4 shadow-xl">
            <div className="max-w-5xl mx-auto flex justify-between items-center">
              <button 
                onClick={() => setModeloAtivo('tabela')}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 border border-slate-700 transition-all cursor-pointer"
              >
                ⬅️ Voltar para Tabela
              </button>

              <div className="text-center">
                <span className="text-xs text-slate-400 uppercase font-semibold tracking-wider block">Modo Pré-visualização</span>
                <span className="text-sm font-bold text-white">
                  {modeloAtivo === 'empresa' && 'Relatório Interno - Empresa'}
                  {modeloAtivo === 'corte' && 'Ordem de Corte - Chão de Fábrica'}
                  {modeloAtivo === 'proposta' && 'Proposta Comercial'}
                  {modeloAtivo === 'pedido' && 'Pedido de Venda (2 Vias)'}
                  {modeloAtivo === 'etiqueta' && 'Etiquetas de Identificação'}
                </span>
              </div>

              <button 
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-emerald-950/50 flex items-center gap-2 transition-all cursor-pointer"
              >
                🖨️ Confirmar e Imprimir
              </button>
            </div>
          </div>

          {/* FOLHA DE IMPRESSÃO (O NAVEGADOR IMPRIME APENAS ESTE BLOCO) */}
          <div className="max-w-[1000px] mx-auto mt-6 bg-white rounded-lg shadow-2xl overflow-hidden">
            <div id="area-impressao" className="p-8 text-black">

              {/* MODELO 1: EMPRESA */}
              {modeloAtivo === 'empresa' && (
                <div>
                  <h2 className="text-xl font-bold text-slate-800 border-b-2 border-slate-800 pb-2 mb-4">Relatório Empresa</h2>
                  <table className="w-full text-xs border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 border-b border-slate-300">
                        <th className="p-2 border border-slate-300">Data</th>
                        <th className="p-2 border border-slate-300">Produto</th>
                        <th className="p-2 border border-slate-300">Medida</th>
                        <th className="p-2 border border-slate-300">Descrição</th>
                        <th className="p-2 border border-slate-300">Qtd</th>
                        <th className="p-2 border border-slate-300">Unitário</th>
                        <th className="p-2 border border-slate-300">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensParaImprimir.map((item) => (
                        <tr key={item.idVer} className="border-b border-slate-200">
                          <td className="p-2 border text-center">{item.data}</td>
                          <td className="p-2 border">{item.produto}</td>
                          <td className="p-2 border font-mono">{item.medida}</td>
                          <td className="p-2 border">{item.descricao}</td>
                          <td className="p-2 border text-center font-bold">{item.qtd}</td>
                          <td className="p-2 border text-right">{formatCurrency(item.unitario)}</td>
                          <td className="p-2 border text-right font-bold">{formatCurrency(item.valorGeral)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-4 flex justify-between font-bold text-sm">
                    <span>Qtd de Registros: {itensParaImprimir.length}</span>
                    <span>TOTAL: {formatCurrency(itensParaImprimir.reduce((a, b) => a + b.valorGeral, 0))}</span>
                  </div>
                </div>
              )}

              {/* MODELO 2: CORTE */}
              {modeloAtivo === 'corte' && (
                <div>
                  <h2 className="text-xl font-bold text-slate-900 border-b-2 border-black pb-2 mb-4 uppercase">Ordem de Corte - Produção</h2>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-black text-black">
                        <th className="p-2 text-left">Código</th>
                        <th className="p-2 text-left">Produto</th>
                        <th className="p-2 text-left">Medida</th>
                        <th className="p-2 text-left">Descrição</th>
                        <th className="p-2 text-center">Qtd</th>
                        <th className="p-2 text-center w-32 border-l border-black">Conferência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensParaImprimir.map((item) => (
                        <tr key={item.idVer} className="border-b border-slate-300">
                          <td className="p-2.5 font-mono">{item.observacao || '-'}</td>
                          <td className="p-2.5 font-bold">{item.produto}</td>
                          <td className="p-2.5 font-mono">{item.medida}</td>
                          <td className="p-2.5">{item.descricao}</td>
                          <td className="p-2.5 text-center font-bold text-sm">{item.qtd}</td>
                          <td className="p-2.5 border-l border-slate-300"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* MODELO 3: PROPOSTA COMERCIAL */}
              {modeloAtivo === 'proposta' && (
                <div>
                  <div className="flex justify-between items-end mb-4 border-b-2 border-slate-900 pb-2">
                    <div>
                      <div className="text-3xl font-black text-slate-900">Usi<span className="text-red-600">corte</span> Metais</div>
                      <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Corte e Usinagem de Metais</p>
                    </div>
                    <div className="text-right text-xs font-bold text-slate-700">
                      <p>PROPOSTA: <span className="text-blue-600">COT-2026-1560</span></p>
                      <p>DATA: {itensParaImprimir[0]?.data}</p>
                    </div>
                  </div>

                  <div className="bg-slate-100 p-3 rounded mb-4 text-xs">
                    <p><strong>CLIENTE / EMPRESA:</strong> {clienteAtual}</p>
                    <p><strong>CONTATO:</strong> {itensParaImprimir[0]?.contato || 'Atendimento'}</p>
                  </div>

                  <table className="w-full text-xs mb-6 border-collapse">
                    <thead>
                      <tr className="bg-slate-200 border-y border-slate-400">
                        <th className="p-2 text-left">Material</th>
                        <th className="p-2 text-left">Medidas</th>
                        <th className="p-2 text-left">Descrição</th>
                        <th className="p-2 text-right">Unitário</th>
                        <th className="p-2 text-center">Qtd</th>
                        <th className="p-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensParaImprimir.map((item) => (
                        <tr key={item.idVer} className="border-b border-slate-200">
                          <td className="p-2 font-bold">{item.produto}</td>
                          <td className="p-2 font-mono">{item.medida}</td>
                          <td className="p-2">{item.descricao}</td>
                          <td className="p-2 text-right">{formatCurrency(item.unitario)}</td>
                          <td className="p-2 text-center font-bold">{item.qtd}</td>
                          <td className="p-2 text-right font-bold">{formatCurrency(item.valorGeral)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="border-t-2 border-slate-900 pt-4 flex justify-between text-xs">
                    <div>
                      <p>• Validade: <strong>10 dias</strong></p>
                      <p>• Condições: <strong>À Vista / Pix</strong></p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold">TOTAL: <span className="text-blue-700">{formatCurrency(itensParaImprimir.reduce((a, b) => a + b.valorGeral, 0))}</span></p>
                    </div>
                  </div>
                </div>
              )}

              {/* MODELO 4: PEDIDO (DUAS VIAS) */}
              {modeloAtivo === 'pedido' && (
                <div className="space-y-12">
                  {/* VIA 1: CLIENTE */}
                  <div>
                    <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
                      <div className="font-bold text-lg">Usicorte Metais <span className="text-xs bg-slate-200 px-2 py-0.5 rounded ml-2">VIA DO CLIENTE</span></div>
                      <div className="text-xs font-bold">PEDIDO Nº COT-2026-8166</div>
                    </div>
                    <p className="text-xs mb-2"><strong>Cliente:</strong> {clienteAtual} | <strong>Data:</strong> {itensParaImprimir[0]?.data}</p>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-y border-black bg-slate-100">
                          <th className="p-1.5 text-left">Material</th>
                          <th className="p-1.5 text-left">Medida</th>
                          <th className="p-1.5 text-center">Qtd</th>
                          <th className="p-1.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itensParaImprimir.map((item) => (
                          <tr key={item.idVer} className="border-b border-slate-200">
                            <td className="p-1.5 font-bold">{item.produto}</td>
                            <td className="p-1.5 font-mono">{item.medida}</td>
                            <td className="p-1.5 text-center font-bold">{item.qtd}</td>
                            <td className="p-1.5 text-right font-bold">{formatCurrency(item.valorGeral)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-dashed border-slate-400 text-center text-xs text-slate-400 py-1">✂️ Corte Aqui</div>

                  {/* VIA 2: EMPRESA */}
                  <div>
                    <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-3">
                      <div className="font-bold text-lg">Usicorte Metais <span className="text-xs bg-yellow-200 px-2 py-0.5 rounded ml-2 text-black">VIA DA EMPRESA</span></div>
                      <div className="text-xs font-bold">PEDIDO Nº COT-2026-8166</div>
                    </div>
                    <p className="text-xs mb-2"><strong>Cliente:</strong> {clienteAtual} | <strong>Data:</strong> {itensParaImprimir[0]?.data}</p>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-y border-black bg-slate-100">
                          <th className="p-1.5 text-left">Material</th>
                          <th className="p-1.5 text-left">Medida</th>
                          <th className="p-1.5 text-center">Qtd</th>
                          <th className="p-1.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itensParaImprimir.map((item) => (
                          <tr key={item.idVer} className="border-b border-slate-200">
                            <td className="p-1.5 font-bold">{item.produto}</td>
                            <td className="p-1.5 font-mono">{item.medida}</td>
                            <td className="p-1.5 text-center font-bold">{item.qtd}</td>
                            <td className="p-1.5 text-right font-bold">{formatCurrency(item.valorGeral)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* MODELO 5: ETIQUETAS */}
              {modeloAtivo === 'etiqueta' && (
                <div className="grid grid-cols-2 gap-6">
                  {itensParaImprimir.map((item) => (
                    <div key={item.idVer} className="border-2 border-black p-4 rounded-xl flex flex-col justify-between aspect-square">
                      <div className="text-center border-b border-slate-300 pb-2">
                        <h3 className="font-black text-lg uppercase tracking-wide">Usicorte Metais</h3>
                        <p className="text-xs font-bold text-slate-600">PEDIDO: COT-2026-8166</p>
                      </div>

                      <div className="space-y-2 text-xs my-2">
                        <p><span className="text-slate-500 font-bold uppercase">Cliente:</span> <br/><strong className="text-sm">{item.cliente}</strong></p>
                        <p><span className="text-slate-500 font-bold uppercase">Material:</span> <br/><strong className="text-base text-blue-900">{item.produto}</strong></p>
                        <p><span className="text-slate-500 font-bold uppercase">Medida:</span> <br/><strong className="font-mono">{item.medida}</strong></p>
                        <p><span className="text-slate-500 font-bold uppercase">Qtd:</span> <strong className="text-base font-black">{item.qtd} PÇ</strong></p>
                      </div>

                      <div className="border-t border-black pt-1 text-center text-[10px] font-bold text-slate-600 uppercase">
                        Identificação de Peça / Usicorte
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
