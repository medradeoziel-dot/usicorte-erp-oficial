import React, { useState, useEffect } from 'react';
import { Client, ViaCepResponse, BrasilApiCnpjResponse } from '../types';
import { 
  formatCPF, 
  formatCNPJ, 
  formatCEP, 
  formatPhone, 
  validateCPF, 
  validateCNPJ 
} from '../utils/validators';
import { 
  Search, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  User, 
  Calendar, 
  Trash2, 
  CheckSquare, 
  AlertCircle,
  RotateCcw,
  PlusCircle,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ClientFormProps {
  activeClient: Client | null;
  onSave: (client: Client) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export default function ClientForm({ activeClient, onSave, onDelete, onClear }: ClientFormProps) {
  // Local form states
  const [type, setType] = useState<'CNPJ' | 'CPF'>('CNPJ');
  const [document, setDocument] = useState('');
  const [name, setName] = useState('');
  const [fantasyName, setFantasyName] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [situation, setSituation] = useState('ATIVA');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [registrationDate, setRegistrationDate] = useState('');

  // Status message state
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({
    message: '',
    type: null
  });

  // Loading states
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  // Load active client data for editing
  useEffect(() => {
    if (activeClient) {
      setType(activeClient.type);
      setDocument(activeClient.type === 'CNPJ' ? formatCNPJ(activeClient.document) : formatCPF(activeClient.document));
      setName(activeClient.name);
      setFantasyName(activeClient.fantasyName || '');
      setCep(formatCEP(activeClient.cep));
      setStreet(activeClient.street);
      setNeighborhood(activeClient.neighborhood);
      setCity(activeClient.city);
      setState(activeClient.state);
      setSituation(activeClient.situation);
      setContactPerson(activeClient.contactPerson || '');
      setPhone(formatPhone(activeClient.phone));
      setEmail(activeClient.email);
      setEnabled(activeClient.enabled);
      setRegistrationDate(activeClient.registrationDate);
      showStatus('Cliente carregado para edição!', 'info');
    } else {
      handleClear();
    }
  }, [activeClient]);

  // Set default registration date to today on mount if empty
  useEffect(() => {
    if (!registrationDate) {
      const today = new Date().toISOString().split('T')[0];
      setRegistrationDate(today);
    }
  }, [registrationDate]);

  const showStatus = (message: string, type: 'success' | 'error' | 'info') => {
    setStatus({ message, type });
    setTimeout(() => {
      setStatus(prev => prev.message === message ? { message: '', type: null } : prev);
    }, 5000);
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (type === 'CNPJ') {
      setDocument(formatCNPJ(val));
    } else {
      setDocument(formatCPF(val));
    }
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = formatCEP(e.target.value);
    setCep(val);

    // Auto-search CEP if it's 8 digits
    const cleanCep = val.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      fetchAddressByCep(cleanCep);
    }
  };

  const fetchAddressByCep = async (cleanCep: string) => {
    setIsSearchingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: ViaCepResponse = await response.json();
      if (!data.erro) {
        setStreet(data.logradouro || '');
        setNeighborhood(data.bairro || '');
        setCity(data.localidade || '');
        setState(data.uf || '');
        showStatus('Endereço auto-preenchido via CEP!', 'success');
      } else {
        showStatus('CEP não encontrado.', 'error');
      }
    } catch (err) {
      showStatus('Erro ao buscar CEP.', 'error');
    } finally {
      setIsSearchingCep(false);
    }
  };

  // Live Receita Federal API CNPJ Consultation
  const fetchCnpjDetails = async () => {
    const cleanCnpj = document.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      showStatus('Por favor, digite um CNPJ com 14 dígitos.', 'error');
      return;
    }

    setIsSearchingCnpj(true);
    showStatus('Consultando base da Receita Federal / SEFAZ...', 'info');

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!response.ok) {
        throw new Error('Serviço indisponível ou CNPJ inexistente.');
      }
      const data: BrasilApiCnpjResponse = await response.json();
      
      setName(data.razao_social || '');
      setFantasyName(data.nome_fantasia || '');
      setSituation(data.descricao_situacao_cadastral || 'ATIVA');
      
      if (data.cep) {
        setCep(formatCEP(data.cep));
      }
      setStreet(data.logradouro || '');
      setNeighborhood(data.bairro || '');
      setCity(data.municipio || '');
      setState(data.uf || '');
      setEmail(data.email || '');
      
      if (data.ddd_telefone_1) {
        setPhone(formatPhone(data.ddd_telefone_1));
      }

      showStatus('Dados recuperados com sucesso da base do SEFAZ / Receita!', 'success');
    } catch (err: any) {
      showStatus('Erro ao consultar CNPJ. Verifique se o número está correto.', 'error');
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanDoc = document.replace(/\D/g, '');
    
    // Validate Document
    if (type === 'CNPJ') {
      if (!validateCNPJ(cleanDoc)) {
        showStatus('CNPJ inválido!', 'error');
        return;
      }
    } else {
      if (!validateCPF(cleanDoc)) {
        showStatus('CPF inválido!', 'error');
        return;
      }
    }

    const clientData: Client = {
      id: activeClient?.id || Math.random().toString(36).substr(2, 9),
      type,
      document: cleanDoc,
      name,
      fantasyName: type === 'CNPJ' ? fantasyName : '',
      cep: cep.replace(/\D/g, ''),
      street,
      neighborhood,
      city,
      state,
      situation,
      contactPerson,
      phone: phone.replace(/\D/g, ''),
      email,
      enabled,
      registrationDate: registrationDate || new Date().toISOString().split('T')[0]
    };

    onSave(clientData);
    showStatus(activeClient ? 'Cliente atualizado com sucesso!' : 'Novo cliente cadastrado!', 'success');
    
    if (!activeClient) {
      handleClear();
    }
  };

  const handleClear = () => {
    setDocument('');
    setName('');
    setFantasyName('');
    setCep('');
    setStreet('');
    setNeighborhood('');
    setCity('');
    setState('');
    setSituation('ATIVA');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setEnabled(true);
    setRegistrationDate(new Date().toISOString().split('T')[0]);
    onClear();
  };

  const handleDelete = () => {
    if (activeClient && window.confirm('Deseja realmente excluir este cliente?')) {
      onDelete(activeClient.id);
      handleClear();
      showStatus('Cliente excluído.', 'info');
    }
  };

  return (
    <div id="client-registration-card" className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Dynamic Alert message */}
      <AnimatePresence mode="wait">
        {status.message && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3.5 px-6 border-b text-xs flex items-center justify-between gap-3 font-medium transition-all ${
              status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
              status.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-100' :
              'bg-blue-50 text-blue-800 border-blue-100'
            }`}
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{status.message}</span>
            </div>
            <button onClick={() => setStatus({ message: '', type: null })} className="text-[10px] uppercase tracking-wider hover:underline">
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="p-6 md:p-8 flex-1 flex flex-col gap-5">
        
        {/* Toggle between CNPJ / CPF with beautifully custom buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipo de Cadastro</span>
            <span className="text-[10px] text-slate-400">Preenchimento manual ou consulta automática</span>
          </div>
          
          <div className="flex items-center p-1 bg-slate-50 border border-slate-200/50 rounded-xl max-w-xs gap-1">
            <button
              type="button"
              onClick={() => { setType('CNPJ'); setDocument(''); }}
              className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-semibold transition-all duration-200 ${
                type === 'CNPJ' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              CNPJ (Jurídica)
            </button>
            <button
              type="button"
              onClick={() => { setType('CPF'); setDocument(''); }}
              className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-semibold transition-all duration-200 ${
                type === 'CPF' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              CPF (Física)
            </button>
          </div>
        </div>

        {/* Form Body - Grid inputs */}
        <div className="space-y-4">
          
          {/* Row 1: Document (CNPJ / CPF) with auto consult badge, and Name/Razão Social */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Document Input (CNPJ/CPF) */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center justify-between">
                <span>{type === 'CNPJ' ? 'CNPJ' : 'CPF'}</span>
                {type === 'CNPJ' && (
                  <span className="text-[9px] text-indigo-500 font-medium font-mono">SEFAZ live query</span>
                )}
              </label>
              
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder={type === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                  value={document}
                  onChange={handleDocumentChange}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-800"
                />
                
                {/* Auto Lookup Button for CNPJ */}
                {type === 'CNPJ' && (
                  <button
                    type="button"
                    onClick={fetchCnpjDetails}
                    disabled={isSearchingCnpj}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition-colors border border-indigo-100/50 disabled:opacity-40"
                    title="Consultar Dados do SEFAZ / Receita"
                  >
                    {isSearchingCnpj ? (
                      <span className="block h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Client / Corporation Name */}
            <div className="md:col-span-8 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{type === 'CNPJ' ? 'Razão Social' : 'Nome Completo'}</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === 'CNPJ' ? 'Razão Social da Empresa' : 'Nome Completo do Cliente'}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-800"
              />
            </div>

          </div>

          {/* Row 2 (Visible only if type is CNPJ): Nome Fantasia & Situation */}
          <AnimatePresence mode="popLayout">
            {type === 'CNPJ' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden"
              >
                {/* Trade / Fantasy Name */}
                <div className="md:col-span-8 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Nome Fantasia</label>
                  <input
                    type="text"
                    value={fantasyName}
                    onChange={(e) => setFantasyName(e.target.value)}
                    placeholder="Nome Fantasia / Comercial"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-800"
                  />
                </div>

                {/* Situation */}
                <div className="md:col-span-4 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-slate-600">Situação Cadastral</label>
                  <input
                    type="text"
                    value={situation}
                    onChange={(e) => setSituation(e.target.value)}
                    placeholder="ATIVA, INATIVA, BAIXADA"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all font-semibold text-emerald-600 uppercase"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Row 3: CEP and Street Address */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* CEP Input */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>CEP</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="00000-000"
                  value={cep}
                  onChange={handleCepChange}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-800 font-mono"
                />
                {isSearchingCep && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 block h-3.5 w-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></span>
                )}
              </div>
            </div>

            {/* Street Address */}
            <div className="md:col-span-8 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Digite a Rua (Endereço)</label>
              <input
                type="text"
                required
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Ex: Avenida Paulista, Nº 1000, Apto 21"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-800"
              />
            </div>

          </div>

          {/* Row 4: Bairro, Cidade and UF */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Bairro */}
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Bairro</label>
              <input
                type="text"
                required
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Bairro"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-800"
              />
            </div>

            {/* Cidade */}
            <div className="md:col-span-5 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600">Cidade</label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Nome da Cidade"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-800"
              />
            </div>

            {/* UF (State) */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 text-center">UF</label>
              <input
                type="text"
                required
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
                placeholder="SP"
                className="w-full py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-800 text-center uppercase font-bold"
              />
            </div>

          </div>

          {/* Row 5: Contato, Telefone and Email */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Contato (Contact Person) */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Contato / Representante</span>
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Nome do contato principal"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-800"
              />
            </div>

            {/* Telefone */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>Telefone de Contato</span>
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(11) 98888-7777"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-800 font-mono"
              />
            </div>

            {/* Email */}
            <div className="md:col-span-4 flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Email do Contribuinte</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@contribuinte.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-sm outline-none hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-slate-800"
              />
            </div>

          </div>

          {/* Row 6: Habilitado checkbox and Data Cadastro */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-slate-100 mt-4">
            
            {/* Enabled toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer group select-none">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded-lg focus:ring-indigo-500 cursor-pointer accent-indigo-600"
              />
              <div>
                <span className="block text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
                  Habilitado
                </span>
                <span className="block text-[10px] text-slate-400">
                  Permitir emissão de notas no sistema
                </span>
              </div>
            </label>

            {/* Registration Date */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">Data de Cadastro:</span>
              <input
                type="date"
                required
                value={registrationDate}
                onChange={(e) => setRegistrationDate(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all"
              />
            </div>

          </div>

        </div>

        {/* Action Panel / Controle */}
        <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 mt-auto">
          <div className="flex items-center gap-1.5 self-start sm:self-center">
            <CheckSquare className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Controle</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {/* Clear Form / Exit Button */}
            <button
              type="button"
              onClick={handleClear}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-xs cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar / Sair
            </button>
            
            {/* Delete button (active only when editing) */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={!activeClient}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-30 disabled:cursor-not-allowed rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-sm shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir
            </button>

            {/* Save Client Button */}
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md shadow-indigo-200/80 hover:shadow-indigo-300/80 shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              {activeClient ? 'Salvar Edição' : 'Salvar Registro'}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
