import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Save, 
  RotateCcw, 
  Upload, 
  Image as ImageIcon, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  FileText, 
  UserCheck, 
  ShieldCheck, 
  CheckCircle2, 
  Search, 
  HelpCircle,
  FileCode,
  Landmark,
  Trash2,
  Hash,
  Sparkles,
  ArrowRight,
  ListOrdered,
  CreditCard,
  QrCode,
  Wallet
} from 'lucide-react';
import { CompanyFiscalData } from '../types';
import { 
  fetchCompanyData, 
  saveCompanyData, 
  DEFAULT_COMPANY_DATA 
} from '../services/companyService';
import { formatCNPJ, formatCPF, formatCEP, formatPhone } from '../utils/validators';

interface CompanySettingsModuleProps {
  onBackToDashboard?: () => void;
}

export default function CompanySettingsModule({ onBackToDashboard }: CompanySettingsModuleProps) {
  const [formData, setFormData] = useState<CompanyFiscalData>(DEFAULT_COMPANY_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSearchingCep, setIsSearchingCep] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' | null }>({
    text: '',
    type: null
  });

  // Carrega dados iniciais do banco
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const data = await fetchCompanyData();
        setFormData(data);
      } catch (e) {
        console.warn('Erro ao carregar dados da empresa:', e);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const showStatus = (text: string, type: 'success' | 'error' | 'info') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(prev => prev.text === text ? { text: '', type: null } : prev);
    }, 6000);
  };

  const handleInputChange = (field: keyof CompanyFiscalData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDocumentChange = (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length <= 11) {
      setFormData(prev => ({ ...prev, cnpj: formatCPF(clean) }));
    } else {
      setFormData(prev => ({ ...prev, cnpj: formatCNPJ(clean) }));
    }
  };

  const handleRepresentativeDocChange = (value: string) => {
    const clean = value.replace(/\D/g, '');
    if (clean.length <= 11) {
      setFormData(prev => ({ ...prev, legalRepresentativeDoc: formatCPF(clean) }));
    } else {
      setFormData(prev => ({ ...prev, legalRepresentativeDoc: formatCNPJ(clean) }));
    }
  };

  const handleCepSearch = async () => {
    const cleanCep = (formData.cep || '').replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      showStatus('Digite um CEP válido com 8 dígitos para consultar.', 'error');
      return;
    }

    setIsSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          street: data.logradouro || prev.street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: (data.uf || prev.state).toUpperCase(),
          ibgeCode: data.ibge || prev.ibgeCode
        }));
        showStatus('Endereço e código IBGE preenchidos automaticamente via CEP!', 'success');
      } else {
        showStatus('CEP não encontrado na base dos Correios.', 'error');
      }
    } catch (err) {
      showStatus('Erro ao consultar CEP na rede.', 'error');
    } finally {
      setIsSearchingCep(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showStatus('Selecione um arquivo de imagem válido (PNG, JPG, SVG, WebP).', 'error');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showStatus('O tamanho da logomarca não pode exceder 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData(prev => ({ ...prev, logoUrl: base64 }));
      showStatus('Logomarca carregada com sucesso!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, logoUrl: '' }));
    showStatus('Logomarca removida.', 'info');
  };

  const handleResetToDefault = () => {
    if (window.confirm('Deseja restaurar as configurações padrão da Usicorte Metais (L. M. BANZATTO METAIS)?')) {
      setFormData(DEFAULT_COMPANY_DATA);
      showStatus('Dados restaurados para os padrões fiscais Usicorte.', 'info');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.corporateName.trim()) {
      showStatus('Razão Social é obrigatória.', 'error');
      return;
    }

    if (!formData.cnpj.trim()) {
      showStatus('CNPJ é obrigatório para emissão de NF-e e documentos fiscais.', 'error');
      return;
    }

    setIsSaving(true);
    showStatus('Salvando dados fiscais no banco de dados e sincronizando...', 'info');

    try {
      const res = await saveCompanyData(formData);
      if (res.success) {
        setFormData(res.data);
        showStatus('Dados da empresa e emitente gravados com sucesso! Cabeçalhos e relatórios atualizados.', 'success');
      } else {
        showStatus('Erro ao gravar no banco de dados.', 'error');
      }
    } catch (err: any) {
      showStatus(`Erro ao salvar: ${err?.message || 'Falha na conexão'}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="screen-empresa" className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Dados da Empresa / Emitente
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  NF-e & Propostas
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Armazene as informações cadastrais e fiscais da empresa emissora para emissão de Nota Fiscal Eletrônica, orçamentos, ordens de serviço e relatórios.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Redefinir para os dados fiscais padrão"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Padrão Usicorte</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving || isLoading}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <span className="block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Gravando...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Gravar / Salvar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Status Feedback Toast */}
      {statusMessage.type && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between shadow-md transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : statusMessage.type === 'error'
              ? 'bg-rose-950/80 border-rose-800 text-rose-200'
              : 'bg-blue-950/80 border-blue-800 text-blue-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {statusMessage.type === 'error' && <ShieldCheck className="w-4 h-4 text-rose-400 shrink-0" />}
            {statusMessage.type === 'info' && <FileText className="w-4 h-4 text-blue-400 shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage({ text: '', type: null })}
            className="text-xs opacity-70 hover:opacity-100 ml-4 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Formulário Principal Dividido em Seções Fiscais */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* SEÇÃO 1: DADOS FISCAIS & TRIBUTÁRIOS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-bold text-slate-200">1. Identificação Fiscal & Tributação (NF-e)</h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">SEFAZ / Receita Federal</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Tipo Pessoa */}
            <div className="md:col-span-3 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Tipo de Pessoa *</label>
              <select
                value={formData.personType}
                onChange={(e) => handleInputChange('personType', e.target.value as 'Jurídica' | 'Física')}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-medium"
              >
                <option value="Jurídica">Pessoa Jurídica (CNPJ)</option>
                <option value="Física">Pessoa Física (CPF)</option>
              </select>
            </div>

            {/* CNPJ / CPF */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">CNPJ / CPF Emitente *</label>
              <input
                type="text"
                value={formData.cnpj}
                onChange={(e) => handleDocumentChange(e.target.value)}
                placeholder="25.038.430/0001-23"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono font-bold"
                required
              />
            </div>

            {/* Inscrição Estadual (IE) */}
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Inscrição Estadual (IE) *</label>
              <input
                type="text"
                value={formData.ie}
                onChange={(e) => handleInputChange('ie', e.target.value)}
                placeholder="209632312114"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono"
              />
            </div>

            {/* Razão Social */}
            <div className="md:col-span-6 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Razão Social / Nome Empresarial *</label>
              <input
                type="text"
                value={formData.corporateName}
                onChange={(e) => handleInputChange('corporateName', e.target.value)}
                placeholder="L. M. BANZATTO METAIS"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-bold"
                required
              />
            </div>

            {/* Nome Fantasia */}
            <div className="md:col-span-6 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Nome Fantasia (Comercial) *</label>
              <input
                type="text"
                value={formData.tradeName}
                onChange={(e) => handleInputChange('tradeName', e.target.value)}
                placeholder="USICORTE METAIS"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-semibold text-blue-400"
              />
            </div>

            {/* Inscrição Municipal */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Inscrição Municipal (IM)</label>
              <input
                type="text"
                value={formData.im || ''}
                onChange={(e) => handleInputChange('im', e.target.value)}
                placeholder="558747"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono"
              />
            </div>

            {/* CNAE */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>CNAE Principal</span>
                <span className="text-[10px] text-slate-500">Atividade</span>
              </label>
              <input
                type="text"
                value={formData.cnae || ''}
                onChange={(e) => handleInputChange('cnae', e.target.value)}
                placeholder="4744001"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono"
              />
            </div>

            {/* Regime Tributário */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Regime Tributário *</label>
              <select
                value={formData.taxRegime}
                onChange={(e) => handleInputChange('taxRegime', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-medium"
              >
                <option value="Simples Nacional">1 - Simples Nacional</option>
                <option value="Simples Nacional - Excesso de Sublimite">2 - Simples Nacional (Excesso Sublimite)</option>
                <option value="Regime Normal (Lucro Presumido)">3 - Regime Normal (Lucro Presumido)</option>
                <option value="Regime Normal (Lucro Real)">3 - Regime Normal (Lucro Real)</option>
                <option value="MEI - Microempreendedor Individual">MEI - Microempreendedor Individual</option>
              </select>
            </div>

            {/* Alíquota ICMS Simples Nacional */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Alíquota ICMS Simples (%)</span>
                <span className="text-[10px] text-blue-400 font-mono">Crédito DANFE</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.aliquotaIcmsSimples !== undefined ? formData.aliquotaIcmsSimples : 2.75}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const safeVal = isNaN(val) ? 0 : val;
                    handleInputChange('aliquotaIcmsSimples', safeVal);
                    handleInputChange('aliquota_icms_simples', safeVal);
                  }}
                  placeholder="2.75"
                  className="w-full pl-3.5 pr-8 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono font-bold"
                />
                <span className="absolute right-3.5 top-2.5 text-slate-400 text-xs font-bold font-mono pointer-events-none">%</span>
              </div>
              <span className="text-[10px] text-slate-400">
                Aproveitamento de crédito de ICMS no DANFE (Art. 23 LC 123/06). Padrão: 2,75%.
              </span>
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: ENDEREÇO COMPLETO DO ESTABELECIMENTO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-slate-200">2. Endereço Completo & Localização Fiscal</h2>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">ViaCEP & IBGE</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* CEP */}
            <div className="md:col-span-3 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">CEP *</label>
              <div className="relative">
                <input
                  type="text"
                  value={formatCEP(formData.cep)}
                  onChange={(e) => handleInputChange('cep', formatCEP(e.target.value))}
                  placeholder="17031-350"
                  className="w-full pl-3.5 pr-9 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono font-bold"
                />
                <button
                  type="button"
                  onClick={handleCepSearch}
                  disabled={isSearchingCep}
                  className="absolute right-1.5 top-1.5 p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  title="Buscar dados no ViaCEP"
                >
                  <Search className={`w-4 h-4 ${isSearchingCep ? 'animate-spin text-blue-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Endereço / Logradouro */}
            <div className="md:col-span-6 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Logradouro / Endereço *</label>
              <input
                type="text"
                value={formData.street}
                onChange={(e) => handleInputChange('street', e.target.value)}
                placeholder="RUA CORONEL IVON CESAR PIMENTEL"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100"
                required
              />
            </div>

            {/* Número */}
            <div className="md:col-span-3 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Número *</label>
              <input
                type="text"
                value={formData.number}
                onChange={(e) => handleInputChange('number', e.target.value)}
                placeholder="3-41"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono font-bold"
                required
              />
            </div>

            {/* Complemento */}
            <div className="md:col-span-3 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Complemento</label>
              <input
                type="text"
                value={formData.complement || ''}
                onChange={(e) => handleInputChange('complement', e.target.value)}
                placeholder="Galpão / Sala / Bloco"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100"
              />
            </div>

            {/* Bairro */}
            <div className="md:col-span-3 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Bairro *</label>
              <input
                type="text"
                value={formData.neighborhood}
                onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                placeholder="PARQUE PAULISTA"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100"
                required
              />
            </div>

            {/* Cidade */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Cidade / Município *</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="BAURU"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-semibold"
                required
              />
            </div>

            {/* UF */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">UF *</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value.toUpperCase().slice(0, 2))}
                placeholder="SP"
                maxLength={2}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono font-bold text-center uppercase"
                required
              />
            </div>

            {/* Código IBGE Cidade */}
            <div className="md:col-span-6 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Código IBGE da Cidade (cMun) *</span>
                <span className="text-[10px] text-slate-500">Ex: 3506003 (Bauru/SP)</span>
              </label>
              <input
                type="text"
                value={formData.ibgeCode || ''}
                onChange={(e) => handleInputChange('ibgeCode', e.target.value)}
                placeholder="3506003"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono"
              />
            </div>

            {/* Código do País */}
            <div className="md:col-span-6 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Código País (cPais)</span>
                <span className="text-[10px] text-slate-500">Padrão BACEN / NF-e</span>
              </label>
              <input
                type="text"
                value={formData.countryCode || '1058 - BRASIL'}
                onChange={(e) => handleInputChange('countryCode', e.target.value)}
                placeholder="1058 - BRASIL"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono"
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: CONTATOS, MÍDIA & LOGOMARCA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-indigo-400" />
                <h2 className="text-sm font-bold text-slate-200">3. Contatos Comerciais & Mídia</h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* E-mail */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>E-mail de Contato / Faturamento *</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="financeirousicorte@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100"
                  required
                />
              </div>

              {/* Website */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span>Website Oficial</span>
                </label>
                <input
                  type="text"
                  value={formData.website || ''}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="WWW.USICORTEMETAIS.COM.BR"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono text-xs"
                />
              </div>

              {/* Telefone Fixo */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">Telefone Comercial 1 *</label>
                <input
                  type="text"
                  value={formatPhone(formData.phone)}
                  onChange={(e) => handleInputChange('phone', formatPhone(e.target.value))}
                  placeholder="(14) 99880-9362"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono"
                  required
                />
              </div>

              {/* Celular / WhatsApp */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">Telefone / WhatsApp 2</label>
                <input
                  type="text"
                  value={formatPhone(formData.mobile || '')}
                  onChange={(e) => handleInputChange('mobile', formatPhone(e.target.value))}
                  placeholder="(14) 99819-6873"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono"
                />
              </div>
            </div>

            {/* SEÇÃO 4: RESPONSÁVEL LEGAL */}
            <div className="pt-4 border-t border-slate-800/80 space-y-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">4. Responsável Legal / Titular</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">Nome do Responsável Legal</label>
                  <input
                    type="text"
                    value={formData.legalRepresentativeName || ''}
                    onChange={(e) => handleInputChange('legalRepresentativeName', e.target.value)}
                    placeholder="MARCOS MARTINS"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">CPF / CNPJ do Representante</label>
                  <input
                    type="text"
                    value={formData.legalRepresentativeDoc || ''}
                    onChange={(e) => handleRepresentativeDocChange(e.target.value)}
                    placeholder="092.345.510/0001-94"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Upload e Preview da Logomarca */}
          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-amber-400" />
                  <h2 className="text-sm font-bold text-slate-200">Logomarca da Empresa</h2>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Cabeçalho & Impressão</span>
              </div>

              <div className="mt-4 flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-700 hover:border-blue-500 bg-slate-950/60 rounded-xl transition-all text-center">
                {formData.logoUrl ? (
                  <div className="relative group flex flex-col items-center">
                    <img
                      src={formData.logoUrl}
                      alt="Logomarca da Empresa"
                      className="max-h-24 max-w-full object-contain rounded-lg p-2 bg-white/5 border border-white/10"
                    />
                    <div className="mt-3 flex items-center gap-2">
                      <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer transition-colors flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Alterar</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-600/30 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer flex flex-col items-center gap-2">
                    <div className="p-3 bg-slate-800 text-blue-400 rounded-full group-hover:scale-110 transition-transform">
                      <Upload className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-slate-200">Clique para enviar a Logomarca</span>
                    <span className="text-[10px] text-slate-400 max-w-[200px]">
                      Formatos suportados: PNG, JPG, SVG ou WebP (máx. 2MB).
                    </span>
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            {/* Card de Visualização do Cabeçalho Fiscal */}
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400 pb-1.5 border-b border-slate-800 text-[11px]">
                <span className="font-semibold text-slate-300">Prévia do Cabeçalho nos Documentos:</span>
                <span className="text-emerald-400 font-mono text-[10px]">● DINÂMICO</span>
              </div>
              <div className="space-y-0.5 text-center font-sans">
                <div className="font-black text-slate-100 uppercase text-xs">{formData.corporateName || 'RAZÃO SOCIAL'}</div>
                <div className="text-[11px] text-slate-300 font-mono">CNPJ: {formData.cnpj || '00.000.000/0000-00'} | IE: {formData.ie || 'ISENTO'}</div>
                <div className="text-[10px] text-slate-400">{formData.street}, {formData.number} - {formData.neighborhood}, {formData.city}/{formData.state}</div>
                <div className="text-[10px] text-slate-400 font-mono">FONE: {formData.phone} | {formData.email}</div>
              </div>
            </div>
          </div>
        </div>

        {/* SEÇÃO 5: CONFIGURAÇÃO DE NUMERAÇÃO DE COTAÇÕES / PEDIDOS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/80 gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg">
                <Hash className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-200">5. Configuração de Numeração de Cotações / Pedidos</h2>
                <p className="text-[11px] text-slate-400">Controle a numeração sequencial inicial e o prefixo oficial gerado pelo sistema.</p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 w-fit">
              <Sparkles className="w-3 h-3" /> Sequencial Automático (+1)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Campo Numérico: Próximo Número Sequencial */}
            <div className="md:col-span-6 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Próximo Número Sequencial *</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Ex: 140 ou 50000</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.proximo_numero_sequencial !== undefined ? formData.proximo_numero_sequencial : (formData.nextQuoteSequential !== undefined ? formData.nextQuoteSequential : (formData.proximo_numero_cotacao ?? 140))}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const validVal = isNaN(val) || val < 1 ? 1 : val;
                  setFormData(prev => ({
                    ...prev,
                    proximo_numero_sequencial: validVal,
                    nextQuoteSequential: validVal,
                    proximo_numero_cotacao: validVal
                  }));
                }}
                placeholder="140"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-indigo-500 text-indigo-300 font-mono font-bold text-base"
                required
              />
              <span className="text-[11px] text-slate-400">
                Configuração gravada diretamente na tabela <code>emitente</code> (coluna <code>proximo_numero_sequencial</code>). A cada nova cotação gravada, esse número avança automaticamente (+1).
              </span>
            </div>

            {/* Campo de Texto Opcional: Prefixo Personalizado */}
            <div className="md:col-span-6 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Prefixo Personalizado (Opcional)</span>
                <span className="text-[10px] text-slate-500 font-mono">Ex: COT-2026-</span>
              </label>
              <input
                type="text"
                value={formData.prefixo_cotacao ?? formData.quotePrefix ?? `COT-${new Date().getFullYear()}-`}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    prefixo_cotacao: val,
                    quotePrefix: val
                  }));
                }}
                placeholder={`COT-${new Date().getFullYear()}-`}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-indigo-500 text-slate-100 font-mono font-bold"
              />
              <span className="text-[11px] text-slate-400">
                Prefixo adicionado antes do número sequencial (ex: <code>COT-2026-</code>). Gravado na coluna <code>prefixo_cotacao</code>.
              </span>
            </div>

            {/* Card Demonstrativo do Funcionamento e Prévia em Tempo Real */}
            <div className="md:col-span-12 p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <span>Prévia da Sequência de Orçamentos:</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Os novos orçamentos seguirão estritamente o formato e o número definidos acima.
                </div>
              </div>

              {(() => {
                const currentSeq = Number(formData.proximo_numero_sequencial ?? formData.nextQuoteSequential ?? formData.proximo_numero_cotacao ?? 140);
                const rawPrefix = formData.prefixo_cotacao ?? formData.quotePrefix ?? `COT-${new Date().getFullYear()}-`;
                const next1 = `${rawPrefix}${String(currentSeq).padStart(6, '0')}`;
                const next2 = `${rawPrefix}${String(currentSeq + 1).padStart(6, '0')}`;

                return (
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <div className="px-3 py-1.5 bg-indigo-950/70 border border-indigo-600/40 text-indigo-300 rounded-lg font-black flex flex-col">
                      <span className="text-[9px] font-sans text-indigo-400 uppercase font-semibold">Próximo Orçamento</span>
                      <span>{next1}</span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-600" />

                    <div className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg flex flex-col">
                      <span className="text-[9px] font-sans text-slate-500 uppercase font-semibold">Orçamento Seguinte</span>
                      <span>{next2}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* SEÇÃO 6: CONTROLE DE NUMERAÇÃO FISCAL (NF-E / DANFE) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/80 gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-200">6. Controle de Numeração Fiscal (NF-e / DANFE)</h2>
                <p className="text-[11px] text-slate-400">
                  Numeração oficial e independente de emissão de Nota Fiscal Eletrônica (Modelo 55).
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full flex items-center gap-1.5 w-fit">
              <Sparkles className="w-3 h-3" /> Sequencial Fiscal Independente
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Campo Numérico: Último Número de NF-e Emitida */}
            <div className="md:col-span-6 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5 text-blue-400" />
                  <span>Último Número de NF-e Emitida *</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Ex: 537</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formData.ultimo_numero_nfe !== undefined ? formData.ultimo_numero_nfe : 0}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const validVal = isNaN(val) || val < 0 ? 0 : val;
                  setFormData(prev => ({
                    ...prev,
                    ultimo_numero_nfe: validVal
                  }));
                }}
                placeholder="537"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-blue-300 font-mono font-bold text-base"
                required
              />
              <span className="text-[11px] text-slate-400">
                Guarda o último número emitido (coluna <code>ultimo_numero_nfe</code> na tabela <code>emitente</code>). A próxima NF-e gerada ou conferida terá o número <strong>{(Number(formData.ultimo_numero_nfe) || 0) + 1}</strong>.
              </span>
            </div>

            {/* Campo Numérico: Série da NF-e */}
            <div className="md:col-span-6 flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Série da NF-e *</span>
                <span className="text-[10px] text-slate-500 font-mono">Padrão: 1</span>
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={formData.serie_nfe !== undefined ? formData.serie_nfe : 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  const validVal = isNaN(val) || val < 1 ? 1 : val;
                  setFormData(prev => ({
                    ...prev,
                    serie_nfe: validVal
                  }));
                }}
                placeholder="1"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm outline-none focus:border-blue-500 text-slate-100 font-mono font-bold"
                required
              />
              <span className="text-[11px] text-slate-400">
                Série fiscal de emissão da NF-e gravada na tabela <code>emitente</code> (coluna <code>serie_nfe</code>).
              </span>
            </div>

            {/* Card Demonstrativo da Prévia da NF-e */}
            <div className="md:col-span-12 p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <span>Prévia da Próxima Nota Fiscal Eletrônica:</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Totalmente separada da cotação. A cotação continuará identificada no rodapé como referência comercial.
                </div>
              </div>

              {(() => {
                const ultimo = Number(formData.ultimo_numero_nfe) || 0;
                const proxNfe = ultimo + 1;
                const proxNfeFormatado = String(proxNfe).padStart(6, '0');
                const serieAtual = formData.serie_nfe || 1;

                return (
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    <div className="px-3 py-1.5 bg-blue-950/70 border border-blue-600/40 text-blue-300 rounded-lg font-black flex flex-col">
                      <span className="text-[9px] font-sans text-blue-400 uppercase font-semibold">Próxima NF-e</span>
                      <span>Nº {proxNfeFormatado} (Série {serieAtual})</span>
                    </div>

                    <ArrowRight className="w-4 h-4 text-slate-600" />

                    <div className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-400 rounded-lg flex flex-col">
                      <span className="text-[9px] font-sans text-slate-500 uppercase font-semibold">NF-e Posterior</span>
                      <span>Nº {String(proxNfe + 1).padStart(6, '0')} (Série {serieAtual})</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* 7. INFORMAÇÕES PARA PAGAMENTO & PIX */}
        <div className="p-6 bg-slate-900/90 border border-emerald-900/40 rounded-2xl shadow-xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4 relative z-10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-950/80 border border-emerald-600/30 rounded-xl text-emerald-400">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  7. Informações para Pagamento & PIX
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                    Extrato & PDF Dinâmico
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Cadastre as chaves de recebimento e dados bancários gravados na tabela <code>emitente</code> e exibidos dinamicamente nos documentos e relatórios.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 relative z-10">
            {/* Sub-bloco PIX */}
            <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                <QrCode className="w-4 h-4" />
                <span>Chave PIX Oficial</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Chave PIX */}
                <div className="md:col-span-5 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Chave PIX</span>
                    <span className="text-[10px] text-slate-500 font-mono">CNPJ / E-mail / Celular</span>
                  </label>
                  <input
                    type="text"
                    value={formData.chavePix ?? formData.chave_pix ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, chavePix: val, chave_pix: val }));
                    }}
                    placeholder="Ex: 25.038.430/0001-23"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono font-bold text-emerald-400 outline-none focus:border-emerald-500"
                  />
                  <span className="text-[11px] text-slate-400">
                    Chave para transferência imediata (deixe em branco se não quiser exibir).
                  </span>
                </div>

                {/* Tipo da Chave */}
                <div className="md:col-span-3 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Tipo da Chave
                  </label>
                  <input
                    list="tipos-chave-pix-list"
                    type="text"
                    value={formData.tipoChavePix ?? formData.tipo_chave_pix ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, tipoChavePix: val, tipo_chave_pix: val }));
                    }}
                    placeholder="Ex: CNPJ / E-mail"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 outline-none focus:border-emerald-500"
                  />
                  <datalist id="tipos-chave-pix-list">
                    <option value="CNPJ" />
                    <option value="E-mail" />
                    <option value="Celular / WhatsApp" />
                    <option value="Chave Aleatória (EVP)" />
                    <option value="CPF" />
                  </datalist>
                  <span className="text-[11px] text-slate-400">
                    Tipo identificador da chave (Ex: CNPJ / E-mail).
                  </span>
                </div>

                {/* Favorecido / Titular do PIX */}
                <div className="md:col-span-4 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Favorecido / Titular do PIX
                  </label>
                  <input
                    type="text"
                    value={formData.favorecidoPix ?? formData.favorecido_pix ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, favorecidoPix: val, favorecido_pix: val }));
                    }}
                    placeholder="Ex: L. M. BANZATTO METAIS"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 outline-none focus:border-emerald-500"
                  />
                  <span className="text-[11px] text-slate-400">
                    Nome da razão social que aparece ao confirmar o PIX.
                  </span>
                </div>
              </div>
            </div>

            {/* Sub-bloco Dados Bancários */}
            <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase tracking-wider">
                <Landmark className="w-4 h-4" />
                <span>Dados Bancários para TED / DOC / Depósito</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Banco (Nome do Banco) */}
                <div className="md:col-span-4 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Banco (Nome do Banco)
                  </label>
                  <input
                    type="text"
                    value={formData.bancoNome ?? formData.banco_nome ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, bancoNome: val, banco_nome: val }));
                    }}
                    placeholder="Ex: Banco do Brasil (001)"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>

                {/* Agência */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Agência
                  </label>
                  <input
                    type="text"
                    value={formData.bancoAgencia ?? formData.banco_agencia ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, bancoAgencia: val, banco_agencia: val }));
                    }}
                    placeholder="Ex: 0037-1"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>

                {/* Conta Corrente */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Conta Corrente
                  </label>
                  <input
                    type="text"
                    value={formData.bancoConta ?? formData.banco_conta ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, bancoConta: val, banco_conta: val }));
                    }}
                    placeholder="Ex: 45.890-1"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>

                {/* Titular / Razão Social do Banco */}
                <div className="md:col-span-4 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Titular / Razão Social do Banco
                  </label>
                  <input
                    type="text"
                    value={formData.bancoTitular ?? formData.banco_titular ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, bancoTitular: val, banco_titular: val }));
                    }}
                    placeholder="Ex: L. M. BANZATTO METAIS"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>

                {/* CNPJ do Banco */}
                <div className="md:col-span-6 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    CNPJ do Banco / Titular
                  </label>
                  <input
                    type="text"
                    value={formData.bancoCnpj ?? formData.banco_cnpj ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, bancoCnpj: val, banco_cnpj: val }));
                    }}
                    placeholder="Ex: 25.038.430/0001-23"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm font-mono text-slate-100 outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* Sub-bloco Texto de Instrução */}
            <div className="p-4 bg-slate-950/70 border border-slate-800/80 rounded-xl space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Texto de Observação / Instrução de Pagamento</span>
                <span className="text-[10px] text-slate-500">Exibido em destaque no rodapé do bloco de pagamento</span>
              </label>
              <textarea
                rows={3}
                value={formData.instrucoesPagamento ?? formData.instrucoes_pagamento ?? ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => ({ ...prev, instrucoesPagamento: val, instrucoes_pagamento: val }));
                }}
                placeholder="Ex: Após efetuar o pagamento, favor encaminhar o comprovante para o WhatsApp (14) 99880-9362 / (14) 99819-6873 ou e-mail financeirousicorte@gmail.com para rápida conciliação e baixa no sistema."
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-200 outline-none focus:border-emerald-500 leading-relaxed resize-y"
              />
              <span className="text-[11px] text-slate-400">
                Instruções de envio de comprovante, prazos e canais de atendimento financeiro.
              </span>
            </div>

            {/* Live Preview Card do Bloco de Pagamento */}
            <div className="p-4 bg-slate-950 border border-emerald-900/30 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Prévia do Bloco Impresso no Extrato / PDF:</span>
                </span>
                <span className="text-[10px] text-slate-500">Campos em branco são automaticamente omitidos</span>
              </div>

              <div className="bg-white text-slate-900 p-3.5 rounded-lg border border-slate-300 text-xs shadow-sm">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                  💳 Informações para Pagamento & Chave PIX
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {(formData.chavePix || formData.tipoChavePix || formData.favorecidoPix) ? (
                    <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                      <div className="text-[10px] font-bold uppercase text-slate-600 mb-0.5">Chave PIX Oficial</div>
                      {formData.chavePix && (
                        <div className="text-sm font-mono font-black text-slate-900">
                          {formData.chavePix}
                        </div>
                      )}
                      {formData.tipoChavePix && (
                        <div className="text-[9.5px] text-slate-600 mt-1">
                          Tipo da Chave: <strong>{formData.tipoChavePix}</strong>
                        </div>
                      )}
                      {formData.favorecidoPix && (
                        <div className="text-[9.5px] text-slate-600 mt-0.5">
                          Favorecido: <strong>{formData.favorecidoPix}</strong>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded p-2.5 text-[11px] text-slate-400 italic">
                      (Nenhum dado PIX informado - bloco será ocultado)
                    </div>
                  )}

                  {(formData.bancoNome || formData.bancoAgencia || formData.bancoConta || formData.bancoTitular || formData.bancoCnpj) ? (
                    <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                      <div className="text-[10px] font-bold uppercase text-slate-600 mb-0.5">Dados Bancários / Transferência</div>
                      {formData.bancoNome && (
                        <div className="text-xs text-slate-900 font-semibold">Banco: {formData.bancoNome}</div>
                      )}
                      <div className="flex flex-wrap gap-x-2 text-xs text-slate-800">
                        {formData.bancoAgencia && <span>Ag: <strong>{formData.bancoAgencia}</strong></span>}
                        {formData.bancoConta && <span>CC: <strong>{formData.bancoConta}</strong></span>}
                      </div>
                      {formData.bancoTitular && (
                        <div className="text-[9.5px] text-slate-600 mt-1">
                          Titular: <strong>{formData.bancoTitular}</strong>
                        </div>
                      )}
                      {formData.bancoCnpj && (
                        <div className="text-[9.5px] text-slate-500 mt-0.5">
                          CNPJ: {formData.bancoCnpj}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded p-2.5 text-[11px] text-slate-400 italic">
                      (Nenhum dado bancário informado - bloco será ocultado)
                    </div>
                  )}
                </div>

                {formData.instrucoesPagamento && (
                  <div className="mt-2.5 text-[10px] text-slate-700 bg-amber-50 border border-amber-200 rounded p-2 leading-relaxed">
                    📌 <strong>Importante:</strong> {formData.instrucoesPagamento}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Ações Inferior */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Os dados salvos serão integrados automaticamente à emissão de NF-e, relatórios e orçamentos.</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Voltar
              </button>
            )}

            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Gravando no Banco...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Gravar / Salvar Configurações</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
