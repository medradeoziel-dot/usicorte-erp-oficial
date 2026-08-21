import React, { useState } from 'react';
import { MATERIAL_PROFILES, MaterialProfile } from '../utils/calculator';
import { 
  Package, 
  Search, 
  Layers, 
  Scale, 
  Coins, 
  Plus, 
  Filter, 
  ArrowRight, 
  Check, 
  FileText,
  Sparkles,
  Info
} from 'lucide-react';

interface ProductsModuleProps {
  onSelectProductForQuote?: (material: MaterialProfile) => void;
}

export default function ProductsModule({ onSelectProductForQuote }: ProductsModuleProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'chapa' | 'macico' | 'bucha'>('ALL');
  const [selectedProfile, setSelectedProfile] = useState<MaterialProfile | null>(null);

  // Filter profiles based on search and category
  const filteredProfiles = MATERIAL_PROFILES.filter(profile => {
    const matchesSearch = profile.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      profile.tipo.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'ALL' || profile.tipo === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const getGeometryBadge = (tipo: string) => {
    switch (tipo) {
      case 'chapa':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Chapa / Placa
          </span>
        );
      case 'macico':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Redondo / Maciço
          </span>
        );
      case 'bucha':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            Bucha / Tubo
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
            {tipo}
          </span>
        );
    }
  };

  const getFormula = (tipo: string, k: number) => {
    switch (tipo) {
      case 'chapa':
        return `Esp (mm) × Larg (mm) × Comp (mm) × ${k}`;
      case 'macico':
        return `Ø² (mm) × Comp (mm) × ${k}`;
      case 'bucha':
        return `(ØExt² - ØInt²) × Comp (mm) × ${k}`;
      default:
        return `Dimensões × ${k}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-700/80">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-400" />
            Tabela de Materiais & Constantes Metalúrgicas
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Catálogo oficial com os 26 materiais cadastrados, fatores de densidade (k) e preços base por Kg da UsiCorte.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-slate-800 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700 font-mono">
            Total: <strong className="text-blue-400">{MATERIAL_PROFILES.length}</strong> materiais
          </span>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar material, código ou constante..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Categories / Filter pills */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setCategoryFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            Todos ({MATERIAL_PROFILES.length})
          </button>
          <button
            onClick={() => setCategoryFilter('chapa')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'chapa'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            Chapas & Barras
          </button>
          <button
            onClick={() => setCategoryFilter('macico')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'macico'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            Maciços & Redondos
          </button>
          <button
            onClick={() => setCategoryFilter('bucha')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'bucha'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            Buchas & Tubos
          </button>
        </div>
      </div>

      {/* Materials Table */}
      <div className="bg-slate-800/90 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-900/90 text-slate-300 uppercase font-semibold text-[11px] border-b border-slate-700 tracking-wider">
              <tr>
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4">Nome do Material</th>
                <th className="py-3 px-4">Tipo / Geometria</th>
                <th className="py-3 px-4 text-center">Constante Metalúrgica (k)</th>
                <th className="py-3 px-4 text-right">Preço Base (R$/Kg)</th>
                <th className="py-3 px-4">Fórmula Teórica de Peso</th>
                <th className="py-3 px-4 text-center w-36">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Nenhum material encontrado com o filtro aplicado.
                  </td>
                </tr>
              ) : (
                filteredProfiles.map((mat, idx) => (
                  <tr 
                    key={mat.id}
                    className="hover:bg-slate-700/40 transition-colors"
                  >
                    <td className="py-3 px-4 text-center font-mono text-slate-500 font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      {mat.name}
                    </td>
                    <td className="py-3 px-4">
                      {getGeometryBadge(mat.tipo)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-amber-300 bg-slate-900/30">
                      {mat.k}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      R$ {mat.defaultPriceKg.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {getFormula(mat.tipo, mat.k)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {onSelectProductForQuote && (
                        <button
                          onClick={() => onSelectProductForQuote(mat)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 mx-auto cursor-pointer shadow-sm active:scale-95"
                        >
                          <span>Lançar</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info helper banner */}
      <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 flex items-start gap-3 text-slate-300">
        <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-semibold text-slate-200">
            Constantes metalúrgicas calculadas para precisão em gramas e quilogramas
          </p>
          <p className="text-slate-400 leading-relaxed">
            Ao selecionar qualquer material no formulário de Lançamento ou digitar no campo de busca com autocompletar inteligente, os parâmetros de cálculo ($k$, geometria e preço/kg) são preenchidos automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
