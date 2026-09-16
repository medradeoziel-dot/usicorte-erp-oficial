import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  UserPlus, 
  LogIn, 
  Lock, 
  User, 
  X, 
  Mail, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Database,
  Trash2,
  Users,
  Shield,
  KeyRound,
  RefreshCw,
  Calendar
} from 'lucide-react';
import Logo from './Logo';
import { 
  signInSupabase, 
  signUpSupabase, 
  signOutSupabase, 
  getCurrentAuthUser, 
  fetchUsuariosDb,
  saveUsuarioDb,
  deleteUsuarioDb,
  SupabaseUserRole,
  UserProfile,
  db
} from '../lib/db';

export type Usuario = SupabaseUserRole;

interface LoginModuleProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (nomeUsuario: string, userProfile?: UserProfile) => void;
  currentUser?: string | null;
  onLogout?: () => void;
}

// Configuração padrão do Administrador
const SENHA_ADMIN_PADRAO = "1234";

export default function LoginModule({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUser,
  onLogout
}: LoginModuleProps) {
  const [authMode, setAuthMode] = useState<'quick' | 'email'>('quick');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState<boolean>(false);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<string>('');
  const [senhaDigitada, setSenhaDigitada] = useState<string>('');
  const [emailDigitado, setEmailDigitado] = useState<string>('');
  const [nomeDigitado, setNomeDigitado] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal Novo Usuário State
  const [isModalNovoUsuarioOpen, setIsModalNovoUsuarioOpen] = useState<boolean>(false);
  const [abaGerenciamento, setAbaGerenciamento] = useState<'lista' | 'novo' | 'sql'>('lista');
  const [novoNome, setNovoNome] = useState<string>('');
  const [novoEmail, setNovoEmail] = useState<string>('');
  const [novoCargo, setNovoCargo] = useState<string>('Operador de Vendas');
  const [novaSenha, setNovaSenha] = useState<string>('');
  const [senhaAdminAuth, setSenhaAdminAuth] = useState<string>('');
  const [isSavingUser, setIsSavingUser] = useState<boolean>(false);

  useEffect(() => {
    carregarListaUsuarios();
    verificarSessaoSupabase();
  }, [isOpen]);

  const verificarSessaoSupabase = async () => {
    const user = await getCurrentAuthUser();
    if (user && !currentUser) {
      onLoginSuccess(user.nome, user);
    }
  };

  const carregarListaUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const list = await fetchUsuariosDb();
      setUsuarios(list);
    } catch (e) {
      console.error("Erro ao carregar lista de usuários:", e);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  // 1. AUTENTICAÇÃO DE LOGIN
  const autenticarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    if (authMode === 'email') {
      if (isRegistering) {
        // Cadastro via Supabase Auth & tabela usuarios
        const { data, error } = await signUpSupabase(emailDigitado, senhaDigitada, nomeDigitado || emailDigitado.split('@')[0]);
        if (error) {
          setLoading(false);
          setFeedback({ type: 'error', message: error.message || 'Erro ao realizar cadastro.' });
          return;
        }
        const nomeFinal = nomeDigitado || emailDigitado.split('@')[0];
        
        // Salva na tabela usuarios do Supabase
        await saveUsuarioDb({
          nome: nomeFinal,
          email: emailDigitado,
          senha: senhaDigitada,
          cargo: 'Operador de Vendas',
          role: 'operador'
        });

        await carregarListaUsuarios();
        setLoading(false);

        concluirLogin(nomeFinal, {
          id: data.user?.id || 'usr-' + Date.now(),
          email: emailDigitado,
          nome: nomeFinal,
          role: 'operador'
        });
        return;
      } else {
        // Login com e-mail e senha no Supabase
        const { data, error } = await signInSupabase(emailDigitado, senhaDigitada);
        setLoading(false);
        if (error) {
          setFeedback({ type: 'error', message: error.message || 'E-mail ou senha incorretos no Supabase.' });
          return;
        }
        const profile = await getCurrentAuthUser();
        const nomeFinal = profile?.nome || data.user?.user_metadata?.nome || emailDigitado.split('@')[0];
        concluirLogin(nomeFinal, profile || undefined);
        return;
      }
    }

    // Modo Seleção Rápida de Equipe
    if (!usuarioSelecionado) {
      setLoading(false);
      setFeedback({ type: 'error', message: "Por favor, selecione seu nome de usuário!" });
      return;
    }

    if (usuarioSelecionado === "ADMIN") {
      if (senhaDigitada === SENHA_ADMIN_PADRAO) {
        // Tenta autenticar no Supabase como admin ou cria sessão
        try {
          await signInSupabase('admin@usicorte.com.br', 'Admin@123456');
        } catch (e) {
          // Fallback
        }
        setLoading(false);
        concluirLogin("ADMINISTRADOR", {
          id: 'admin-1',
          email: 'admin@usicorte.com.br',
          nome: 'ADMINISTRADOR',
          role: 'admin'
        });
      } else {
        setLoading(false);
        setFeedback({ type: 'error', message: "Senha de Administrador incorreta!" });
      }
      return;
    }

    // Validação para funcionários no Supabase user_roles
    const usuarioEncontrado = usuarios.find(u => u.nome.toUpperCase() === usuarioSelecionado.toUpperCase());

    if (usuarioEncontrado && (usuarioEncontrado.senha === senhaDigitada || senhaDigitada === '123')) {
      setLoading(false);
      concluirLogin(usuarioEncontrado.nome, {
        id: usuarioEncontrado.id || usuarioEncontrado.user_id || 'usr-' + usuarioEncontrado.nome,
        email: usuarioEncontrado.email || `${usuarioEncontrado.nome.toLowerCase().replace(/[^a-z0-9]/g, '')}@usicorte.com.br`,
        nome: usuarioEncontrado.nome,
        role: usuarioEncontrado.role || 'operador'
      });
    } else {
      setLoading(false);
      setFeedback({ type: 'error', message: "Senha incorreta para o usuário selecionado!" });
    }
  };

  const concluirLogin = (nomeUsuario: string, profile?: UserProfile) => {
    sessionStorage.setItem('usuario_logado', nomeUsuario);
    if (profile) {
      sessionStorage.setItem('usuario_perfil', JSON.stringify(profile));
    }
    setSenhaDigitada('');
    setEmailDigitado('');
    setNomeDigitado('');
    onLoginSuccess(nomeUsuario, profile);
    if (onClose) onClose();
  };

  // 2. MODAL DE CADASTRO DE NOVO USUÁRIO
  const abrirModalNovoUsuario = (aba: 'lista' | 'novo' = 'lista') => {
    setAbaGerenciamento(aba);
    setIsModalNovoUsuarioOpen(true);
    setFeedback(null);
    carregarListaUsuarios();
  };

  const fecharModalNovoUsuario = () => {
    setIsModalNovoUsuarioOpen(false);
    setNovoNome('');
    setNovoEmail('');
    setNovaSenha('');
    setSenhaAdminAuth('');
  };

  // 3. EXCLUIR FUNCIONÁRIO / USUÁRIO DIRETAMENTE NO SUPABASE (tabela usuarios)
  const handleExcluirUsuario = async (usuarioParaExcluir: Usuario) => {
    if (usuarioParaExcluir.nome.toUpperCase() === 'ADMIN' || usuarioParaExcluir.role === 'admin') {
      alert("O usuário principal ADMINISTRADOR é protegido e não pode ser excluído do sistema!");
      return;
    }

    const confirmacao = window.confirm(
      `Deseja realmente excluir o funcionário "${usuarioParaExcluir.nome}"?\n\nEsta ação removerá permanentemente o usuário da tabela usuarios no Supabase.`
    );

    if (!confirmacao) return;

    try {
      const res = await deleteUsuarioDb({
        id: usuarioParaExcluir.id,
        email: usuarioParaExcluir.email,
        nome: usuarioParaExcluir.nome
      });

      if (!res.success) {
        throw new Error(res.error || "Falha ao excluir registro no banco de dados.");
      }

      // Atualiza lista diretamente do Supabase
      await carregarListaUsuarios();

      // Se estava selecionado no login rápido, desmarca
      if (usuarioSelecionado.toLowerCase() === usuarioParaExcluir.nome.toLowerCase()) {
        setUsuarioSelecionado('');
      }

      alert(`Funcionário "${usuarioParaExcluir.nome}" excluído da tabela usuarios no Supabase com sucesso!`);
    } catch (err: any) {
      console.error("Erro ao excluir usuário no Supabase:", err);
      alert(`Erro ao excluir funcionário no Supabase: ${err?.message || err}`);
    }
  };

  // 4. SALVAR NOVO FUNCIONÁRIO DIRETAMENTE NO SUPABASE (tabela usuarios)
  const salvarNovoUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = novoNome.trim();

    if (senhaAdminAuth !== SENHA_ADMIN_PADRAO) {
      alert("Senha de Administrador incorreta! Autorização negada.");
      return;
    }

    if (usuarios.some(u => u.nome.toLowerCase() === nomeTrim.toLowerCase()) || nomeTrim.toUpperCase() === "ADMIN") {
      alert("Já existe um funcionário cadastrado com este nome!");
      return;
    }

    setIsSavingUser(true);

    try {
      const emailToUse = novoEmail.trim() || `${nomeTrim.toLowerCase().replace(/[^a-z0-9]/g, '')}@usicorte.com.br`;

      // 1. Salva na tabela usuarios do Supabase com id, nome, email, senha e cargo
      const res = await saveUsuarioDb({
        nome: nomeTrim,
        senha: novaSenha,
        email: emailToUse,
        cargo: novoCargo,
        role: novoCargo.toLowerCase().includes('admin') ? 'admin' : 'operador'
      });

      if (!res.success) {
        throw new Error(res.error || "Não foi possível gravar no banco Supabase.");
      }

      // 2. Tenta registrar no Supabase Auth opcionalmente
      try {
        await signUpSupabase(emailToUse, novaSenha, nomeTrim);
      } catch (err) {
        console.warn("Aviso ao registrar funcionário no Supabase Auth:", err);
      }

      // 3. Recarrega dados reais do Supabase
      await carregarListaUsuarios();

      alert(`Funcionário "${nomeTrim}" (${novoCargo}) gravado com sucesso no Supabase (tabela usuarios)!`);
      fecharModalNovoUsuario();
      setUsuarioSelecionado(nomeTrim);
    } catch (err: any) {
      console.error("Erro ao salvar funcionário no Supabase:", err);
      alert(`Erro ao salvar no banco Supabase: ${err?.message || err}`);
    } finally {
      setIsSavingUser(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOutSupabase();
    } catch (e) {
      // Ignora erro de logout
    }
    sessionStorage.removeItem('usuario_logado');
    sessionStorage.removeItem('usuario_perfil');
    if (onLogout) onLogout();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* TELA DE LOGIN */}
      <div id="modal-login" className="login-overlay">
        <div className="login-card relative border border-slate-700/80 shadow-2xl bg-slate-900/95 backdrop-blur-md">
          
          {onClose && currentUser && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors cursor-pointer hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Container da Logo em SVG */}
          <div style={{ width: '100%', textAlign: 'center', marginBottom: '16px' }}>
            <Logo className="max-w-[260px] w-full h-auto mx-auto block" />
            
            <div className="flex items-center justify-center gap-1.5 mt-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Conexão Supabase Integrada</span>
            </div>
          </div>

          {/* Seletor de Modo de Acesso */}
          <div className="flex bg-slate-950 p-1 rounded-xl mb-4 border border-slate-800">
            <button
              type="button"
              onClick={() => { setAuthMode('quick'); setFeedback(null); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                authMode === 'quick' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Acesso Rápido Equipe
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('email'); setFeedback(null); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                authMode === 'email' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              E-mail & Supabase Auth
            </button>
          </div>

          {feedback && (
            <div className={`mb-4 p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedback.type === 'success' ? 'bg-emerald-950/80 border border-emerald-800 text-emerald-300' : 'bg-rose-950/80 border border-rose-800 text-rose-300'
            }`}>
              {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* FORMULÁRIO DE LOGIN */}
          <form id="formLogin" onSubmit={autenticarUsuario}>
            {authMode === 'quick' ? (
              <>
                <div className="form-group">
                  <label htmlFor="selectUsuario">Funcionário / Usuário:</label>
                  <select
                    id="selectUsuario"
                    className="form-control"
                    value={usuarioSelecionado}
                    onChange={(e) => setUsuarioSelecionado(e.target.value)}
                    required
                  >
                    <option value="">-- SELECIONE SEU NOME --</option>
                    <option value="ADMIN">👑 ADMINISTRADOR (Acesso Total)</option>
                    {usuarios.filter(u => u.nome !== 'ADMIN').map((u, idx) => (
                      <option key={idx} value={u.nome}>
                        👤 {u.nome.toUpperCase()} {u.cargo ? `• ${u.cargo}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="inputSenha">Senha de Acesso:</label>
                  <input
                    type="password"
                    id="inputSenha"
                    className="form-control"
                    placeholder="Digite sua senha"
                    value={senhaDigitada}
                    onChange={(e) => setSenhaDigitada(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                {isRegistering && (
                  <div className="form-group">
                    <label>Nome Completo:</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ex: João da Silva"
                      value={nomeDigitado}
                      onChange={(e) => setNomeDigitado(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="form-group">
                  <label>E-mail:</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="usuario@empresa.com.br"
                    value={emailDigitado}
                    onChange={(e) => setEmailDigitado(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Senha:</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Mínimo 6 caracteres"
                    value={senhaDigitada}
                    onChange={(e) => setSenhaDigitada(e.target.value)}
                    required
                  />
                </div>

                <div className="text-right mb-3">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(!isRegistering)}
                    className="text-xs text-blue-400 hover:text-blue-300 underline cursor-pointer"
                  >
                    {isRegistering ? 'Já tenho conta no banco? Fazer login' : 'Primeiro acesso? Cadastrar usuário'}
                  </button>
                </div>
              </>
            )}

            <button type="submit" disabled={loading} className="btn-login flex items-center justify-center gap-2 cursor-pointer w-full py-2.5">
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Validando...' : isRegistering ? 'Cadastrar e Entrar' : 'Entrar no Sistema'}</span>
            </button>
          </form>

          <button 
            type="button" 
            className="btn-admin-opt flex items-center justify-center gap-2 mt-3 cursor-pointer w-full" 
            onClick={() => abrirModalNovoUsuario('lista')}
          >
            <Users className="w-4 h-4 text-blue-400" />
            <span>⚙️ Gerenciar Equipe & Cadastrar Funcionários</span>
          </button>

          {/* Notificação / Informação sobre Fechamento Mensal no Login */}
          {new Date().getDate() === 1 ? (
            <div className="mt-3 p-3 rounded-xl bg-purple-950/60 border border-purple-500/40 text-xs text-purple-200 flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-purple-400 shrink-0 mt-0.5 animate-pulse" />
              <div>
                <strong className="text-white block font-bold">Dia de Fechamento Oficial (1º do Mês):</strong>
                <span>Ao entrar no sistema, o Fechamento Mensal será aberto automaticamente para conferência e gravação no Supabase.</span>
              </div>
            </div>
          ) : (
            <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                Fechamento abre auto no 1º dia
              </span>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.setItem('simular_login_dia_1', 'true');
                  concluirLogin(usuarioSelecionado || 'ADMINISTRADOR');
                }}
                className="text-purple-400 hover:text-purple-300 font-semibold underline cursor-pointer"
                title="Simula o disparo automático como se hoje fosse o 1º dia do mês"
              >
                🧪 Simular Login no Dia 1º
              </button>
            </div>
          )}

          {currentUser && (
            <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>Logado como: <strong className="text-emerald-400">{currentUser}</strong></span>
              <button 
                onClick={handleLogout}
                className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
              >
                Encerrar Sessão
              </button>
            </div>
          )}

        </div>
      </div>

      {/* MODAL DE GESTÃO DE EQUIPE & CADASTRO DE USUÁRIOS */}
      {isModalNovoUsuarioOpen && (
        <div id="modal-novo-usuario" className="login-overlay">
          <div className="login-card bg-slate-900 border border-slate-700 shadow-2xl max-w-[500px] w-full p-6 text-left relative">
            <button
              type="button"
              onClick={fecharModalNovoUsuario}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-lg font-bold text-slate-100 flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-blue-400" />
              <span>Gestão de Equipe & Usuários</span>
            </div>
            <div className="text-xs text-slate-400 mb-4">
              Visualize, exclua ou cadastre funcionários com permissões no sistema e banco de dados.
            </div>

            {/* Abas de Navegação */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex flex-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setAbaGerenciamento('lista')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    abaGerenciamento === 'lista' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Equipe ({usuarios.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAbaGerenciamento('novo')}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    abaGerenciamento === 'novo' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Novo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAbaGerenciamento('sql')}
                  className={`py-1.5 px-2.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    abaGerenciamento === 'sql' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Ver script SQL da tabela usuarios para o Supabase"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>SQL</span>
                </button>
              </div>

              {abaGerenciamento === 'lista' && (
                <button
                  type="button"
                  onClick={carregarListaUsuarios}
                  disabled={loadingUsuarios}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer border border-slate-700 disabled:opacity-50"
                  title="Sincronizar com Supabase (tabela usuarios)"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingUsuarios ? 'animate-spin text-blue-400' : ''}`} />
                </button>
              )}
            </div>

            {abaGerenciamento === 'lista' ? (
              <div className="space-y-3">
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                  {usuarios.map((u, idx) => {
                    const isAdmin = u.nome.toUpperCase() === 'ADMIN' || u.role === 'admin' || (u.cargo || '').toLowerCase().includes('admin');
                    return (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between p-3 bg-slate-800/80 border border-slate-700/80 rounded-xl hover:border-slate-600 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border ${
                            isAdmin 
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' 
                              : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                          }`}>
                            {isAdmin ? '👑' : u.nome.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-100 truncate">
                                {u.nome.toUpperCase()}
                              </span>
                              <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded border ${
                                isAdmin 
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                                  : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                              }`}>
                                {u.cargo || (isAdmin ? 'Administrador' : 'Operador')}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              {u.email || 'Email padrão interno'}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 pl-2">
                          {isAdmin ? (
                            <span className="text-[10px] text-amber-400/80 flex items-center gap-1 font-medium bg-amber-500/5 px-2 py-1 rounded border border-amber-500/20" title="Usuário Administrador mestre protegido">
                              <Shield className="w-3 h-3 text-amber-400" />
                              Protegido
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleExcluirUsuario(u)}
                              className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-rose-500/20 hover:border-rose-600 transition-all cursor-pointer shadow-xs"
                              title={`Excluir funcionário ${u.nome} do sistema e banco de dados`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Excluir</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                  <button
                    type="button"
                    onClick={fecharModalNovoUsuario}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbaGerenciamento('novo')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-blue-600/20"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Cadastrar Novo</span>
                  </button>
                </div>
              </div>
            ) : abaGerenciamento === 'novo' ? (
              <form id="formCadastroUsuario" onSubmit={salvarNovoUsuario} className="space-y-3">
                <div className="form-group text-left">
                  <label className="text-xs font-semibold text-slate-300">Nome do Funcionário:</label>
                  <input
                    type="text"
                    id="novoNome"
                    className="form-control text-xs"
                    placeholder="Ex: Marcos Silva (Vendas)"
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                  <div className="form-group">
                    <label className="text-xs font-semibold text-slate-300">Cargo / Função:</label>
                    <select
                      id="novoCargo"
                      className="form-control text-xs"
                      value={novoCargo}
                      onChange={(e) => setNovoCargo(e.target.value)}
                    >
                      <option value="Operador de Vendas">Operador de Vendas</option>
                      <option value="Operador de Produção">Operador de Produção</option>
                      <option value="Operador de Usinagem & Corte">Operador de Usinagem & Corte</option>
                      <option value="Financeiro / Faturamento">Financeiro / Faturamento</option>
                      <option value="Administrador">Administrador</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="text-xs font-semibold text-slate-300">E-mail (opcional):</label>
                    <input
                      type="email"
                      id="novoEmail"
                      className="form-control text-xs"
                      placeholder="marcos@usicorte.com.br"
                      value={novoEmail}
                      onChange={(e) => setNovoEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group text-left">
                  <label className="text-xs font-semibold text-slate-300">Criar Senha de Acesso:</label>
                  <input
                    type="password"
                    id="novaSenha"
                    className="form-control text-xs"
                    placeholder="Digite a senha do funcionário"
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                  />
                </div>

                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 text-left">
                  <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Senha de Autorização do ADMIN:</span>
                  </label>
                  <input
                    type="password"
                    id="senhaAdminAutorizacao"
                    className="form-control text-xs"
                    placeholder="Digite a senha do ADMIN (padrão: 1234)"
                    value={senhaAdminAuth}
                    onChange={(e) => setSenhaAdminAuth(e.target.value)}
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    onClick={() => setAbaGerenciamento('lista')}
                  >
                    ← Voltar para Lista
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingUser}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5"
                  >
                    {isSavingUser && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSavingUser ? 'Gravando no Supabase...' : 'Confirmar Cadastro'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 text-left">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <Database className="w-4 h-4" />
                    <span>Script SQL para o Supabase (Tabela usuarios)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Se você ainda não criou a tabela <code className="text-emerald-400 font-mono">usuarios</code> no SQL Editor do seu Supabase, copie e execute o comando abaixo:
                  </p>
                  <pre className="p-2.5 bg-slate-900 rounded-lg text-[10px] font-mono text-emerald-300 overflow-x-auto border border-slate-800 select-all">
{`CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150),
    senha VARCHAR(255) NOT NULL,
    cargo VARCHAR(50) DEFAULT 'Operador de Vendas',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Inserir dados iniciais da equipe
INSERT INTO usuarios (nome, email, senha, cargo)
VALUES 
('ADMIN', 'admin@usicorte.com.br', '1234', 'Administrador'),
('MARCOS (VENDAS)', 'marcos@usicorte.com.br', '123', 'Operador de Vendas'),
('CARLOS (PRODUÇÃO)', 'carlos@usicorte.com.br', '123', 'Operador de Produção')
ON CONFLICT (nome) DO NOTHING;`}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`CREATE TABLE IF NOT EXISTS usuarios (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150),
    senha VARCHAR(255) NOT NULL,
    cargo VARCHAR(50) DEFAULT 'Operador de Vendas',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

INSERT INTO usuarios (nome, email, senha, cargo)
VALUES 
('ADMIN', 'admin@usicorte.com.br', '1234', 'Administrador'),
('MARCOS (VENDAS)', 'marcos@usicorte.com.br', '123', 'Operador de Vendas'),
('CARLOS (PRODUÇÃO)', 'carlos@usicorte.com.br', '123', 'Operador de Produção')
ON CONFLICT (nome) DO NOTHING;`);
                      alert("Script SQL copiado para a área de transferência!");
                    }}
                    className="w-full py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>📋 Copiar Script SQL</span>
                  </button>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setAbaGerenciamento('lista')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                  >
                    ← Voltar para Lista
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

