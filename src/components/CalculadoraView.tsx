import React from 'react';
import { Calculator, Sparkles, Layers, Box, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { tabelaConstantes } from '../utils/calculator';
import { useMaterialsCatalog } from '../services/materialsService';

interface CalculadoraViewProps {
  onOpenCalculatorModal: () => void;
  onNavigateToSales: () => void;
  isQuickCalcOpen?: boolean;
}

const BITOLAS_POPULARES = [
  { label: '20 GA', mm: '0,90 mm', bitola: '0.90' },
  { label: '18 GA', mm: '1,20 mm', bitola: '1.20' },
  { label: '16 GA', mm: '1,50 mm', bitola: '1.50' },
  { label: '14 GA', mm: '1,90 mm', bitola: '1.90' },
  { label: '1/8"', mm: '3,17 mm', bitola: '3.17' },
  { label: '3/16"', mm: '4,75 mm', bitola: '4.75' },
  { label: '1/4"', mm: '6,35 mm', bitola: '6.35' },
  { label: '5/16"', mm: '8,00 mm', bitola: '8.00' },
  { label: '3/8"', mm: '9,52 mm', bitola: '9.52' },
  { label: '1/2"', mm: '12,70 mm', bitola: '12.70' },
  { label: '5/8"', mm: '15,87 mm', bitola: '15.87' },
  { label: '3/4"', mm: '19,05 mm', bitola: '19.05' },
  { label: '1"', mm: '25,40 mm', bitola: '25.40' },
];

export default function CalculadoraView({
  onOpenCalculatorModal,
  onNavigateToSales,
  isQuickCalcOpen
}: CalculadoraViewProps) {
  const { constantes: dynamicConstantes } = useMaterialsCatalog();
  const activeConstantes = dynamicConstantes.length > 0 ? dynamicConstantes : tabelaConstantes;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner de Destaque da Calculadora */}
      <div className="p-6 bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border border-blue-500/30 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/40 text-blue-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              <span>Ambiente Oficial de Operação</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
              <Calculator className="w-8 h-8 text-blue-400" />
              Calculadora Usicorte ⚡
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Cálculo instantâneo de cortes, pesos unitários, totais e preços de chapas, barras maciças, buchas e tubos com constantes metalúrgicas calibradas e arredondamento padrão Usicorte.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={onOpenCalculatorModal}
              className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 border border-blue-400/40 cursor-pointer transition-all active:scale-98"
            >
              <Calculator className="w-5 h-5" />
              <span>{isQuickCalcOpen ? 'Janela Aberta (Focar)' : 'Abrir Calculadora Usicorte ⚡'}</span>
            </button>

            <button
              onClick={onNavigateToSales}
              className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 font-semibold text-xs border border-slate-700 cursor-pointer transition-all"
            >
              <span>Vendas & PDV</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Apoio Rápido do Operador */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tabela de Bitolas Populares */}
        <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
              <Layers className="w-4 h-4 text-blue-400" />
              <span>Bitolas e Espessuras Mais Utilizadas</span>
            </div>
            <span className="text-[11px] text-slate-400">Referência Rápida</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {BITOLAS_POPULARES.map((b) => (
              <div
                key={b.bitola}
                onClick={onOpenCalculatorModal}
                className="p-3 bg-slate-950/60 hover:bg-blue-950/40 border border-slate-800 hover:border-blue-500/40 rounded-xl cursor-pointer transition-all group"
              >
                <div className="text-xs font-bold text-blue-300 group-hover:text-blue-200">{b.label}</div>
                <div className="text-sm font-mono font-semibold text-slate-200 mt-0.5">{b.mm}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Constantes & Regras do Sistema */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-slate-100 pb-3 mb-3 border-b border-slate-800">
              <Box className="w-4 h-4 text-emerald-400" />
              <span>Constantes & Fórmulas</span>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <p className="font-semibold text-slate-200 mb-1">Chapa Retangular / Quadrada:</p>
                <code className="text-blue-300 font-mono text-[11px] block bg-slate-900 px-2 py-1 rounded">
                  (Esp × Larg × Comp × K) / 1000
                </code>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <p className="font-semibold text-slate-200 mb-1">Barra Redonda Maciça:</p>
                <code className="text-emerald-300 font-mono text-[11px] block bg-slate-900 px-2 py-1 rounded">
                  (Ø × Ø × Comp × K) / 1000
                </code>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <p className="font-semibold text-slate-200 mb-1">Bucha / Tubo Mecânico:</p>
                <code className="text-purple-300 font-mono text-[11px] block bg-slate-900 px-2 py-1 rounded">
                  ((ØExt² - ØInt²) × Comp × K) / 1000
                </code>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Arredondamento Padrão UsiCorte</span>
            </span>
            <span className="font-mono text-slate-300">{activeConstantes.length} Materiais</span>
          </div>
        </div>
      </div>
    </div>
  );
}
