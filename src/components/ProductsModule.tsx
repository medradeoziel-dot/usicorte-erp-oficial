import React, { useState } from 'react';
import { MaterialProfile } from '../utils/calculator';
import { 
  useMaterialsCatalog, 
  createMaterialDb, 
  updateMaterialDb, 
  deleteMaterialDb, 
  MaterialItem, 
  TipoGeometriaExtensa,
  materialItemToProfile
} from '../services/materialsService';
import { 
  Package, 
  Search, 
  Plus, 
  ArrowRight, 
  Check, 
  Info,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  AlertTriangle,
  Loader2,
  Sparkles,
  Layers,
  CheckCircle2,
  FileText
} from 'lucide-react';

interface ProductsModuleProps {
  onSelectProductForQuote?: (material: MaterialProfile) => void;
}

export default function ProductsModule({ onSelectProductForQuote }: ProductsModuleProps) {
  const { materials, loading, error: catalogError, reload } = useMaterialsCatalog();

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'chapa' | 'macico' | 'bucha'>('ALL');

  // Modal State (Novo / Editar Material)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingMaterial, setEditingMaterial] = useState<MaterialItem | null>(null);
  const [formData, setFormData] = useState<{
    nome: string;
    descricao: string;
    tipo: TipoGeometriaExtensa;
    constante: string;
    preco_base: string;
    ncm: string;
    cfop_interno: string;
    cfop_externo: string;
    unidade_medida: string;
    csosn: string;
  }>({
    nome: '',
    descricao: '',
    tipo: 'Redondo / Maciço',
    constante: '0.0062',
    preco_base: '45,00',
    ncm: '72085200',
    cfop_interno: '5102',
    cfop_externo: '6102',
    unidade_medida: 'PC',
    csosn: '101 - Com permissão de crédito'
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal Exclusão
  const [materialToDelete, setMaterialToDelete] = useState<MaterialItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Notificação Toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleOpenNewModal = () => {
    setEditingMaterial(null);
    setFormData({
      nome: '',
      descricao: '',
      tipo: 'Redondo / Maciço',
      constante: '0.0062',
      preco_base: '45,00',
      ncm: '72085200',
      cfop_interno: '5102',
      cfop_externo: '6102',
      unidade_medida: 'PC',
      csosn: '101 - Com permissão de crédito'
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (mat: MaterialItem) => {
    setEditingMaterial(mat);
    const matCsosn = (!mat.csosn || mat.csosn.includes('102') || mat.csosn.includes('101'))
      ? '101 - Com permissão de crédito'
      : mat.csosn;
    setFormData({
      nome: mat.nome,
      descricao: mat.descricao || '',
      tipo: mat.tipoExtenso,
      constante: String(mat.k),
      preco_base: mat.precoKg.toFixed(2).replace('.', ','),
      ncm: mat.ncm || '72085200',
      cfop_interno: mat.cfop_interno || '5102',
      cfop_externo: mat.cfop_externo || '6102',
      unidade_medida: mat.unidade_medida || 'PC',
      csosn: matCsosn
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleTipoChange = (newTipo: TipoGeometriaExtensa) => {
    let defaultK = formData.constante;
    // Sugestões inteligentes de constante k caso esteja criando novo
    if (!editingMaterial) {
      if (newTipo === 'Redondo / Maciço') {
        defaultK = '0.00617';
      } else if (newTipo === 'Chapa / Placa') {
        defaultK = '0.00785';
      } else if (newTipo === 'Bucha / Tubo') {
        defaultK = '0.00617';
      }
    }
    setFormData(prev => ({
      ...prev,
      tipo: newTipo,
      constante: defaultK
    }));
  };

  const parseNumberInput = (str: string): number => {
    if (!str) return 0;
    const clean = str.replace(/\s+/g, '').replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanNome = formData.nome.trim().toUpperCase();
    if (!cleanNome) {
      setFormError('Por favor, informe o nome do material.');
      return;
    }

    const kNum = parseNumberInput(formData.constante);
    if (kNum < 0) {
      setFormError('A constante metalúrgica (k) deve ser um número válido (Ex: 0.0062).');
      return;
    }

    const precoNum = parseNumberInput(formData.preco_base);
    if (precoNum < 0) {
      setFormError('O preço base por Kg deve ser um número válido (Ex: 45,00).');
      return;
    }

    setIsSaving(true);
    try {
      if (editingMaterial) {
        const res = await updateMaterialDb(editingMaterial.id, {
          nome: cleanNome,
          descricao: formData.descricao,
          tipo: formData.tipo,
          constante: kNum,
          preco_base: precoNum,
          ncm: formData.ncm,
          cfop_interno: formData.cfop_interno,
          cfop_externo: formData.cfop_externo,
          unidade_medida: formData.unidade_medida,
          csosn: formData.csosn
        });

        if (res.error) {
          setFormError(res.error);
        } else {
          showToast(`Material "${cleanNome}" atualizado com sucesso no Supabase e sincronizado com a Calculadora!`);
          setIsModalOpen(false);
          await reload();
        }
      } else {
        const res = await createMaterialDb({
          nome: cleanNome,
          descricao: formData.descricao,
          tipo: formData.tipo,
          constante: kNum,
          preco_base: precoNum,
          ncm: formData.ncm,
          cfop_interno: formData.cfop_interno,
          cfop_externo: formData.cfop_externo,
          unidade_medida: formData.unidade_medida,
          csosn: formData.csosn
        });

        if (res.error) {
          setFormError(res.error);
        } else {
          showToast(`Novo material "${cleanNome}" gravado com sucesso no Supabase e disponível na Calculadora!`);
          setIsModalOpen(false);
          await reload();
        }
      }
    } catch (err: any) {
      setFormError(err?.message || 'Falha ao gravar material no banco.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMaterial = async () => {
    if (!materialToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteMaterialDb(materialToDelete.id);
      if (res.success) {
        showToast(`Material "${materialToDelete.nome}" excluído do Supabase com sucesso.`);
        setMaterialToDelete(null);
        reload();
      } else {
        showToast(res.error || 'Erro ao excluir material do Supabase.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro inesperado ao excluir material.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter profiles based on search and category
  const filteredMaterials = materials.filter(item => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q ||
      item.nome.toLowerCase().includes(q) ||
      (item.descricao || '').toLowerCase().includes(q) ||
      item.id.toLowerCase().includes(q) ||
      item.tipo.toLowerCase().includes(q) ||
      item.tipoExtenso.toLowerCase().includes(q) ||
      item.k.toString().includes(q) ||
      item.precoKg.toString().includes(q) ||
      (item.ncm && item.ncm.toLowerCase().includes(q)) ||
      (item.unidade_medida && item.unidade_medida.toLowerCase().includes(q));

    const matchesCategory = categoryFilter === 'ALL' || item.tipo === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  const countChapa = materials.filter(m => m.tipo === 'chapa').length;
  const countMacico = materials.filter(m => m.tipo === 'macico').length;
  const countBucha = materials.filter(m => m.tipo === 'bucha').length;

  const getGeometryBadge = (tipo: string) => {
    switch (tipo) {
      case 'chapa':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Chapa / Placa
          </span>
        );
      case 'macico':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Redondo / Maciço
          </span>
        );
      case 'bucha':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
            Bucha / Tubo
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
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
      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div 
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 border transition-all animate-in fade-in slide-in-from-top-3 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-500/40 shadow-emerald-950/50'
              : 'bg-rose-950 text-rose-100 border-rose-500/40 shadow-rose-950/50'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-xs font-bold">{toastMessage.text}</span>
          <button 
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-700/80">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-400" />
            Tabela de Materiais & Constantes Metalúrgicas
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Catálogo dinâmico conectado diretamente à tabela <code className="text-purple-400 bg-purple-950/40 px-1 py-0.5 rounded font-mono font-bold">materiais</code> do Supabase, com sincronização em tempo real na Calculadora de Cotações.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => reload()}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
            title="Recarregar materiais do Supabase"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          <span className="bg-slate-800 text-slate-300 text-xs px-3 py-2 rounded-xl border border-slate-700 font-mono">
            Total: <strong className="text-blue-400">{materials.length}</strong> materiais
          </span>

          {/* Botão de Destaque + Novo Material */}
          <button
            onClick={handleOpenNewModal}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all cursor-pointer border border-blue-400/30 active:scale-95"
            title="Cadastrar novo material na tabela do Supabase"
          >
            <Plus className="w-4 h-4 text-blue-200" />
            <span>+ Novo Material</span>
          </button>
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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
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
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            Todos ({materials.length})
          </button>
          <button
            onClick={() => setCategoryFilter('chapa')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'chapa'
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            Chapas & Barras ({countChapa})
          </button>
          <button
            onClick={() => setCategoryFilter('macico')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'macico'
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            Maciços & Redondos ({countMacico})
          </button>
          <button
            onClick={() => setCategoryFilter('bucha')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
              categoryFilter === 'bucha'
                ? 'bg-blue-600 text-white shadow-sm font-bold'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
            }`}
          >
            Buchas & Tubos ({countBucha})
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
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Tipo / Geometria</th>
                <th className="py-3 px-3 text-center" title="Nomenclatura Comum do Mercosul">NCM</th>
                <th className="py-3 px-2 text-center" title="Unidade Comercial">UN</th>
                <th className="py-3 px-4 text-center">Constante Metalúrgica (k)</th>
                <th className="py-3 px-4 text-right">Preço Base (R$/Kg)</th>
                <th className="py-3 px-4">Fórmula Teórica de Peso</th>
                <th className="py-3 px-4 text-center w-48">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {filteredMaterials.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    {loading ? (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                        <span>Carregando materiais do Supabase...</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p>Nenhum material encontrado com o filtro aplicado.</p>
                        <button
                          onClick={handleOpenNewModal}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Cadastrar Primeiro Material
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredMaterials.map((item, idx) => (
                  <tr 
                    key={item.id}
                    className="hover:bg-slate-700/40 transition-colors group"
                  >
                    <td className="py-3 px-4 text-center font-mono text-slate-500 font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-100 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 group-hover:scale-125 transition-transform"></span>
                      <span>{item.nome}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-medium">
                      {item.descricao && item.descricao.trim() !== '' ? item.descricao : '—'}
                    </td>
                    <td className="py-3 px-4">
                      {getGeometryBadge(item.tipo)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-mono text-[11px] font-semibold text-slate-300 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/80">
                        {item.ncm || '72085200'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center font-mono text-xs font-bold text-blue-400">
                      {item.unidade_medida || 'PC'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-amber-300 bg-slate-900/30 rounded">
                      {item.k}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                      R$ {item.precoKg.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                      {getFormula(item.tipo, item.k)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {onSelectProductForQuote && (
                          <button
                            onClick={() => onSelectProductForQuote(materialItemToProfile(item))}
                            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1 cursor-pointer shadow-sm active:scale-95"
                            title="Lançar material diretamente no orçamento de cotação"
                          >
                            <span>Lançar</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 bg-slate-700/80 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="Editar material, descrição, constante e preço no Supabase"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setMaterialToDelete(item)}
                          className="p-1.5 bg-slate-700/80 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="Excluir material do Supabase"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
          <p className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Constantes Metalúrgicas e Preços Sincronizados com a Calculadora
          </p>
          <p className="text-slate-400 leading-relaxed">
            Ao cadastrar ou editar qualquer material nesta tabela, as alterações são salvas na tabela <code className="text-slate-200 font-mono">materiais</code> do Supabase e sincronizadas instantaneamente na caixa seletora/combobox de materiais da tela de Cotação e na Calculadora Rápida.
          </p>
        </div>
      </div>

      {/* =====================================================================
          MODAL: + NOVO MATERIAL / EDITAR MATERIAL
      ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">
                    {editingMaterial ? 'Editar Material Metalúrgico' : 'Novo Material Metalúrgico'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {editingMaterial ? 'Atualize as constantes e preço no Supabase' : 'Cadastre um novo perfil para a calculadora de cotações'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700/50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveMaterial} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Nome do Material */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nome do Material <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: AÇO REDONDO INOX"
                  value={formData.nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value.toUpperCase() }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 uppercase font-mono"
                  autoFocus
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Identificação visível no combobox de cotações e relatórios.
                </span>
              </div>

              {/* Descrição do Material */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Descrição do Material
                </label>
                <input
                  type="text"
                  placeholder="Ex: CHAPA DE AÇO CARBONO SAE 1020 / A36 CORTE A LASER"
                  value={formData.descricao}
                  onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Preenchida automaticamente no campo "Descrição do Produto / Serviço" ao selecionar este material no PDV.
                </span>
              </div>

              {/* 2. Tipo / Geometria (Dropdown) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Tipo / Geometria <span className="text-rose-400">*</span>
                </label>
                <select
                  value={formData.tipo}
                  onChange={(e) => handleTipoChange(e.target.value as TipoGeometriaExtensa)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-100 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Redondo / Maciço">Redondo / Maciço</option>
                  <option value="Chapa / Placa">Chapa / Placa</option>
                  <option value="Bucha / Tubo">Bucha / Tubo</option>
                </select>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Define a fórmula volumétrica usada pela calculadora de peso.
                </span>
              </div>

              {/* 3. Constante Metalúrgica (k) e 4. Preço Base por Kg (R$) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Constante Metalúrgica (k) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 0.0062"
                    value={formData.constante}
                    onChange={(e) => setFormData(prev => ({ ...prev, constante: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-amber-300 placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[9px] text-slate-400">Exemplos:</span>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, constante: '0.00617' }))}
                      className="text-[9px] bg-slate-800 hover:bg-slate-700 text-blue-300 px-1.5 py-0.5 rounded border border-slate-700 cursor-pointer"
                    >
                      Aço (0.00617)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, constante: '0.00785' }))}
                      className="text-[9px] bg-slate-800 hover:bg-slate-700 text-blue-300 px-1.5 py-0.5 rounded border border-slate-700 cursor-pointer"
                    >
                      Chapa (0.00785)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, constante: '0.00214' }))}
                      className="text-[9px] bg-slate-800 hover:bg-slate-700 text-blue-300 px-1.5 py-0.5 rounded border border-slate-700 cursor-pointer"
                    >
                      Alumínio (0.00214)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Preço Base por Kg (R$) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 45,00"
                      value={formData.preco_base}
                      onChange={(e) => setFormData(prev => ({ ...prev, preco_base: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-xs font-mono font-bold text-emerald-400 placeholder:text-slate-500 focus:outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Preço padrão sugerido ao selecionar o material.
                  </span>
                </div>
              </div>

              {/* Preview da Fórmula */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] space-y-1">
                <span className="text-slate-400 font-medium block">Fórmula Teórica Resultante:</span>
                <span className="font-mono text-blue-400 font-bold block">
                  {formData.tipo === 'Redondo / Maciço' && `Ø² (mm) × Comp (mm) × ${formData.constante || '0'}`}
                  {formData.tipo === 'Chapa / Placa' && `Esp (mm) × Larg (mm) × Comp (mm) × ${formData.constante || '0'}`}
                  {formData.tipo === 'Bucha / Tubo' && `(ØExt² - ØInt²) × Comp (mm) × ${formData.constante || '0'}`}
                </span>
              </div>

              {/* Informações Fiscais & Tributárias (NF-e) */}
              <div className="pt-4 border-t border-slate-700/80 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-200">
                      Informações Fiscais & Tributárias (NF-e)
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      Parâmetros tributários transmitidos à SEFAZ na emissão da Nota Fiscal
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. NCM */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      NCM <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="72085200"
                      value={formData.ncm}
                      onChange={(e) => setFormData(prev => ({ ...prev, ncm: e.target.value.replace(/\D/g, '') }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-500 mt-0.5 block">8 dígitos (Padrão: 72085200)</span>
                  </div>

                  {/* 2. CFOP Interno/SP */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      CFOP Interno / SP <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="5102"
                      value={formData.cfop_interno}
                      onChange={(e) => setFormData(prev => ({ ...prev, cfop_interno: e.target.value.replace(/\D/g, '') }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-500 mt-0.5 block">Vendas SP (Padrão: 5102)</span>
                  </div>

                  {/* 3. CFOP Interestadual */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      CFOP Interestadual <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="6102"
                      value={formData.cfop_externo}
                      onChange={(e) => setFormData(prev => ({ ...prev, cfop_externo: e.target.value.replace(/\D/g, '') }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
                    />
                    <span className="text-[9px] text-slate-500 mt-0.5 block">Outros estados (Padrão: 6102)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 4. Unidade Comercial */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Unidade Comercial <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formData.unidade_medida}
                      onChange={(e) => setFormData(prev => ({ ...prev, unidade_medida: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-100 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="PC">PC (Peça)</option>
                      <option value="KG">KG (Quilograma)</option>
                      <option value="M">M (Metro)</option>
                      <option value="M2">M2 (Metro Quadrado)</option>
                      <option value="UN">UN (Unidade)</option>
                    </select>
                    <span className="text-[9px] text-slate-500 mt-0.5 block">Padrão: PC</span>
                  </div>

                  {/* 5. CSOSN */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      CSOSN (Simples Nacional) <span className="text-rose-400">*</span>
                    </label>
                    <select
                      value={formData.csosn}
                      onChange={(e) => setFormData(prev => ({ ...prev, csosn: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-100 focus:outline-hidden focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="101 - Com permissão de crédito">101 - Tributada pelo Simples Nacional com permissão de crédito</option>
                      <option value="102 - Sem permissão de crédito">102 - Sem permissão de crédito</option>
                      <option value="103 - Isenção do ICMS no Simples Nacional">103 - Isenção do ICMS no Simples Nacional</option>
                      <option value="201 - Com permissão de crédito e cobrança por ST">201 - Com permissão de crédito e ST</option>
                      <option value="202 - Sem permissão de crédito e cobrança por ST">202 - Sem permissão de crédito e ST</option>
                      <option value="300 - Imune">300 - Imune</option>
                      <option value="400 - Não tributada pelo Simples Nacional">400 - Não tributada pelo Simples Nacional</option>
                      <option value="500 - ICMS cobrado anteriormente por ST">500 - ICMS cobrado anteriormente por ST</option>
                      <option value="900 - Outros">900 - Outros</option>
                    </select>
                    <span className="text-[9px] text-slate-500 mt-0.5 block">Padrão: 101 - Tributada pelo Simples Nacional com permissão de crédito</span>
                  </div>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gravando no Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingMaterial ? 'Atualizar no Supabase' : 'Salvar no Supabase'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL DE CONFIRMAÇÃO DE EXCLUSÃO
      ===================================================================== */}
      {materialToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-600/20 text-rose-400 border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Excluir Material</h3>
                <p className="text-xs text-slate-400">Esta ação removerá o material do banco de dados.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-slate-300 space-y-1.5">
              <p>
                Tem certeza que deseja excluir o material <strong className="text-white font-mono">{materialToDelete.nome}</strong>?
              </p>
              <div className="text-[11px] text-slate-400 space-y-0.5">
                <p>• Geometria: <span className="text-slate-200">{materialToDelete.tipoExtenso}</span></p>
                <p>• Constante (k): <span className="text-amber-300 font-mono">{materialToDelete.k}</span></p>
                <p>• Preço Base: <span className="text-emerald-400 font-mono">R$ {materialToDelete.precoKg.toFixed(2).replace('.', ',')}/Kg</span></p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMaterialToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteMaterial}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Sim, Excluir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
