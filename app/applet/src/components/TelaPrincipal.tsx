import React, { useState } from 'react';
// Importe dos componentes visuais de impressão
import RelatorioPedidoPrint from './RelatorioPedidoPrint';
import RelatorioPropostaPrint from './RelatorioPropostaPrint';
import RelatorioEmpresaPrint from './RelatorioEmpresaPrint';
import RelatorioCortePrint from './RelatorioCortePrint';
import RelatorioEtiquetaPrint from './RelatorioEtiquetaPrint';

// Simulando os dados do banco de dados
const dadosDoBanco = [
  { idVer: 14000, data: '14/08/2026', cliente: 'Brasil Tecnologias Ltda', contato: 'Oziel Medrade', produto: 'CHAPA', medida: '1/2" (12.7mm) x 1200 x 2400', descricao: 'Chapa de Aço SAE 1020', qtd: 2, unitario: 6316.57, valorGeral: 12633.14, observacao: 'Bordas escariadas', pesoTotal: 574.56 },
  { idVer: 14001, data: '14/08/2026', cliente: 'Brasil Tecnologias Ltda', contato: 'Oziel Medrade', produto: 'CHAPA', medida: '1" (25.4mm) x 300 x 600', descricao: 'Chapa Aço SAE 1045', qtd: 4, unitario: 638.82, valorGeral: 2555.28, observacao: 'Corte retificado', pesoTotal: 143.23 },
  { idVer: 13942, data: '12/08/2026', cliente: 'DPROJECTS', contato: 'Marcos', produto: 'NYLON REDONDO', medida: '60 x 780', descricao: 'NYLON', qtd: 1, unitario: 150.00, valorGeral: 150.00, observacao: '-', pesoTotal: 2.50 },
];

export default function TelaPrincipal() {
  const [itensSelecionadosIds, setItensSelecionadosIds] = useState<number[]>([14000, 14001]);
  
  // Define o que está sendo visualizado na tela: 'tabela', 'preview-pedido', 'preview-proposta', 'preview-empresa', 'preview-corte' ou 'preview-etiquetas'
  const [telaAtual, setTelaAtual] = useState<'tabela' | 'preview-pedido' | 'preview-proposta' | 'preview-empresa' | 'preview-corte' | 'preview-etiquetas'>('tabela');

  const toggleSelecao = (id: number) => {
    setItensSelecionadosIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const selecionarTodos = () => {
    if (itensSelecionadosIds.length === dadosDoBanco.length) {
      setItensSelecionadosIds([]);
    } else {
      setItensSelecionadosIds(dadosDoBanco.map(d => d.idVer));
    }
  };

  const itensParaImprimir = dadosDoBanco.filter(item => itensSelecionadosIds.includes(item.idVer));

  // =========================================================================
  // TELA 2: MODO DE PRÉ-VISUALIZAÇÃO (PREVIEW)
  // =========================================================================
  if (telaAtual !== 'tabela') {
    return (
      <div className="bg-slate-900/90 min-h-screen pb-10 box-border overflow-x-hidden text-slate-100">
        
        {/* Barra de Controles da Pré-visualização (Fica invisível na hora de imprimir) */}
        <div className="print:hidden bg-slate-900 border border-slate-800 shadow-xl p-4 mb-6 flex flex-col sm:flex-row justify-between items-center max-w-[1000px] mx-auto mt-4 rounded-xl gap-3">
          <button 
            onClick={() => setTelaAtual('tabela')} 
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs sm:text-sm cursor-pointer transition flex items-center justify-center gap-2 border border-slate-700"
          >
            <span>⬅️</span> Voltar para Tabela
          </button>
          
          <div className="text-slate-300 font-semibold text-xs sm:text-sm text-center">
            Modo de Pré-visualização ({itensParaImprimir.length} {itensParaImprimir.length === 1 ? 'item selecionado' : 'itens selecionados'})
          </div>

          <button 
            onClick={() => window.print()} 
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg shadow font-bold text-xs sm:text-sm cursor-pointer transition flex items-center justify-center gap-2"
          >
            <span>🖨️</span> Confirmar e Imprimir
          </button>
        </div>

        {/* Renderiza o layout de acordo com o relatório selecionado */}
        <div className="shadow-2xl max-w-[1000px] mx-auto overflow-hidden rounded-xl bg-white text-slate-900 print:shadow-none print:rounded-none">
          {telaAtual === 'preview-pedido' && (
            <RelatorioPedidoPrint 
              cliente={itensParaImprimir[0]?.cliente || "Cliente"} 
              numeroPedido="COT-2026-8166" 
              data={itensParaImprimir[0]?.data || "Data"} 
              itens={itensParaImprimir} 
            />
          )}

          {telaAtual === 'preview-proposta' && (
            <RelatorioPropostaPrint 
              cliente={itensParaImprimir[0]?.cliente || "Cliente"} 
              numeroProposta="COT-2026-1560" 
              data={itensParaImprimir[0]?.data || "Data"} 
              condicoesPagamento="À Vista" 
              validade="10 dias" 
              prazoEntrega="A combinar" 
              desconto={0} 
              frete={0} 
              itens={itensParaImprimir} 
            />
          )}

          {telaAtual === 'preview-empresa' && (
            <RelatorioEmpresaPrint 
              itens={itensParaImprimir} 
            />
          )}

          {telaAtual === 'preview-corte' && (
            <RelatorioCortePrint 
              itens={itensParaImprimir} 
            />
          )}

          {telaAtual === 'preview-etiquetas' && (
            <RelatorioEtiquetaPrint 
              cliente={itensParaImprimir[0]?.cliente || "Cliente"} 
              numeroPedido="COT-2026-8166" 
              itens={itensParaImprimir} 
            />
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // TELA 1: TABELA PRINCIPAL DE CONSULTA
  // =========================================================================
  return (
    <div className="p-4 sm:p-8 bg-slate-950 min-h-screen text-slate-100 box-border overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Sistema Usicorte - Pedidos e Relatórios</h1>
            <p className="text-xs text-slate-400">Selecione os registros para pré-visualizar ou imprimir</p>
          </div>
          <div className="text-xs text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            Total na base: <strong>{dadosDoBanco.length}</strong> | Selecionados: <strong>{itensSelecionadosIds.length}</strong>
          </div>
        </div>
        
        {/* Botões de Ação / Pré-visualização */}
        <div className="bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-800 flex flex-wrap gap-2 sm:gap-3 items-center">
          <button 
            onClick={() => setTelaAtual('preview-pedido')} 
            disabled={itensSelecionadosIds.length === 0}
            className="bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs sm:text-sm transition flex items-center gap-2 border border-slate-700 cursor-pointer"
          >
            <span>📋</span> Visualizar Pedido (2 Vias)
          </button>
          
          <button 
            onClick={() => setTelaAtual('preview-proposta')} 
            disabled={itensSelecionadosIds.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer"
          >
            <span>📄</span> Visualizar Proposta
          </button>

          <button 
            onClick={() => setTelaAtual('preview-empresa')} 
            disabled={itensSelecionadosIds.length === 0}
            className="bg-slate-700 hover:bg-slate-600 text-white px-3.5 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer"
          >
            <span>🏢</span> Relatório Empresa
          </button>

          <button 
            onClick={() => setTelaAtual('preview-corte')} 
            disabled={itensSelecionadosIds.length === 0}
            className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer"
          >
            <span>✂️</span> Ordem de Corte
          </button>

          <button 
            onClick={() => setTelaAtual('preview-etiquetas')} 
            disabled={itensSelecionadosIds.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer"
          >
            <span>🏷️</span> Etiquetas
          </button>
          
          {itensSelecionadosIds.length === 0 && (
            <span className="text-amber-400 text-xs flex items-center font-medium">
              * Selecione ao menos um item abaixo para habilitar a visualização.
            </span>
          )}
        </div>

        {/* 📱 MOBILE: Cards com Checkbox (< 768px) */}
        <div className="block md:hidden space-y-3">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Registros ({dadosDoBanco.length})
            </span>
            <button
              onClick={selecionarTodos}
              className="text-xs text-blue-400 hover:text-blue-300 font-semibold underline cursor-pointer"
            >
              {itensSelecionadosIds.length === dadosDoBanco.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
            </button>
          </div>

          {dadosDoBanco.map(item => {
            const isSelected = itensSelecionadosIds.includes(item.idVer);
            return (
              <div 
                key={item.idVer} 
                onClick={() => toggleSelecao(item.idVer)}
                className={`border rounded-xl p-3.5 transition cursor-pointer space-y-2 text-xs ${
                  isSelected 
                    ? 'bg-slate-900 border-blue-500 ring-1 ring-blue-500 shadow-md' 
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2.5">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer accent-blue-600"
                      checked={isSelected}
                      onChange={() => {}} // tratado no container
                    />
                    <span className="font-mono font-bold text-blue-400">ID #{item.idVer}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">{item.data}</span>
                </div>

                <div className="space-y-1">
                  <div className="text-slate-100 font-bold text-sm">{item.cliente}</div>
                  <div className="text-slate-400 text-[11px]">Contato: <span className="text-slate-200">{item.contato}</span></div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Produto</span>
                    <span className="font-semibold text-slate-200">{item.produto}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Medida</span>
                    <span className="font-mono text-slate-300">{item.medida}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                  <span className="text-slate-400">Qtd: <strong className="text-white font-mono">{item.qtd}</strong></span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valorGeral)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 🖥️ DESKTOP: Tabela Completa (>= 768px) */}
        <div className="hidden md:block bg-slate-900 border border-slate-800 shadow-xl rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm text-left">
              <thead className="bg-slate-800/90 text-slate-300 border-b border-slate-700">
                <tr>
                  <th className="p-3 w-12 text-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 cursor-pointer accent-blue-600 rounded"
                      checked={itensSelecionadosIds.length === dadosDoBanco.length && dadosDoBanco.length > 0}
                      onChange={selecionarTodos}
                      title="Selecionar todos"
                    />
                  </th>
                  <th className="p-3 font-semibold uppercase text-xs">IdVer</th>
                  <th className="p-3 font-semibold uppercase text-xs">Data</th>
                  <th className="p-3 font-semibold uppercase text-xs">Cliente / Empresa</th>
                  <th className="p-3 font-semibold uppercase text-xs">Contato</th>
                  <th className="p-3 font-semibold uppercase text-xs">Produto</th>
                  <th className="p-3 font-semibold uppercase text-xs">Medida</th>
                  <th className="p-3 font-semibold uppercase text-xs text-center">Qtd</th>
                  <th className="p-3 font-semibold uppercase text-xs text-right">Valor Geral</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {dadosDoBanco.map(item => {
                  const isSelected = itensSelecionadosIds.includes(item.idVer);
                  return (
                    <tr 
                      key={item.idVer} 
                      className={`hover:bg-slate-800/50 transition cursor-pointer ${
                        isSelected ? 'bg-slate-800/30' : ''
                      }`}
                      onClick={() => toggleSelecao(item.idVer)}
                    >
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 cursor-pointer accent-blue-600 rounded"
                          checked={isSelected}
                          onChange={() => toggleSelecao(item.idVer)}
                        />
                      </td>
                      <td className="p-3 font-bold font-mono text-blue-400">{item.idVer}</td>
                      <td className="p-3 font-mono text-slate-300">{item.data}</td>
                      <td className="p-3 font-semibold text-white">{item.cliente}</td>
                      <td className="p-3 text-slate-300">{item.contato}</td>
                      <td className="p-3 text-slate-200 font-medium">{item.produto}</td>
                      <td className="p-3 font-mono text-slate-300 text-xs">{item.medida}</td>
                      <td className="p-3 font-mono font-bold text-center text-slate-200">{item.qtd}</td>
                      <td className="p-3 font-mono font-bold text-right text-emerald-400">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.valorGeral)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
