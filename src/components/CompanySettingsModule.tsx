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
  Trash2
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
