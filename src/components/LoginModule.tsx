import React, { useState, useEffect } from 'react';
import { ShieldCheck, UserPlus, LogIn, Lock, User, X, Mail, CheckCircle2, AlertCircle, Sparkles, Database } from 'lucide-react';
import Logo from './Logo';
import { 
  signInSupabase, 
  signUpSupabase, 
  signOutSupabase, 
  getCurrentAuthUser, 
  UserProfile,
  db
} from '../lib/db';

export interface Usuario {
  nome: string;
  senha: string;
  email?: string;
  role?: 'admin' | 'operador';
}

interface LoginModuleProps {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (nomeUsuario: string, userProfile?: UserProfile) => void;
  currentUser?: string | null;
  onLogout?: () => void;
}

// Configuração padrão do Administrador
const SENHA_ADMIN_PADRAO = "1234";

// Carrega os usuários salvos no LocalStorage
export function obterUsuariosCadastrados(): Usuario[] {
  const usuariosSalvos = localStorage.getItem('usicorte_usuarios');
  return usuariosSalvos ? JSON.parse(usuariosSalvos) : [
    { nome: 'ADMIN', senha: SENHA_ADMIN_PADRAO, email: 'admin@usicorte.com.br', role: 'admin' },
    { nome: 'MARCOS (VENDAS)', senha: '123', email: 'marcos@usicorte.com.br', role: 'operador' },
    { nome: 'CARLOS (PRODUÇÃO)', senha: '123', email: 'carlos@usicorte.com.br', role: 'operador' }
  ];
}

export default function LoginModule({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUser,
  onLogout
}: LoginModuleProps) {
  const [authMode, setAuthMode] = useState<'quick' | 'email'>('quick');
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<string>('');
  const [senhaDigitada, setSenhaDigitada] = useState<string>('');
  const [emailDigitado, setEmailDigitado] = useState<string>('');
  const [nomeDigitado, setNomeDigitado] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal Novo Usuário State
  const [isModalNovoUsuarioOpen, setIsModalNovoUsuarioOpen] = useState<boolean>(false);
  const [novoNome, setNovoNome] = useState<string>('');
  const [novoEmail, setNovoEmail] = useState<string>('');
  const [novaSenha, setNovaSenha] = useState<string>('');
  const [senhaAdminAuth, setSenhaAdminAuth] = useState<string>('');

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

  const carregarListaUsuarios = () => {
    const list = obterUsuariosCadastrados();
    setUsuarios(list);
  };

  // 1. AUTENTICAÇÃO DE LOGIN
  const autenticarUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);

    if (authMode === 'email') {
      if (isRegistering) {
        // Cadastro via Supabase Auth
        const { data, error } = await signUpSupabase(emailDigitado, senhaDigitada, nomeDigitado || emailDigitado.split('@')[0]);
        setLoading(false);
        if (error) {
          setFeedback({ type: 'error', message: error.message || 'Erro ao realizar cadastro.' });
          return;
        }
        const nomeFinal = nomeDigitado || emailDigitado.split('@')[0];
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

    // Validação para funcionários comuns
    const list = obterUsuariosCadastrados();
    const usuarioEncontrado = list.find(u => u.nome.toUpperCase() === usuarioSelecionado.toUpperCase());

    if (usuarioEncontrado && usuarioEncontrado.senha === senhaDigitada) {
      setLoading(false);
      concluirLogin(usuarioEncontrado.nome, {
        id: 'usr-' + usuarioEncontrado.nome,
        email: usuarioEncontrado.email || `${usuarioEncontrado.nome.toLowerCase().replace(/\s+/g, '')}@usicorte.com.br`,
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
  const abrirModalNovoUsuario = () => {
    setIsModalNovoUsuarioOpen(true);
    setFeedback(null);
  };

  const fecharModalNovoUsuario = () => {
    setIsModalNovoUsuarioOpen(false);
    setNovoNome('');
    setNovoEmail('');
    setNovaSenha('');
    setSenhaAdminAuth('');
  };

  // 3. SALVAR NOVO FUNCIONÁRIO
  const salvarNovoUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    const nomeTrim = novoNome.trim();

    if (senhaAdminAuth !== SENHA_ADMIN_PADRAO) {
      alert("Senha de Administrador incorreta! Autorização negada.");
      return;
    }

    const list = obterUsuariosCadastrados();

    if (list.some(u => u.nome.toLowerCase() === nomeTrim.toLowerCase()) || nomeTrim.toUpperCase() === "ADMIN") {
      alert("Já existe um funcionário cadastrado com este nome!");
      return;
    }

    // Registra no Supabase se email fornecido
    const emailToUse = novoEmail.trim() || `${nomeTrim.toLowerCase().replace(/\s+/g, '')}@usicorte.com.br`;
    try {
      await signUpSupabase(emailToUse, novaSenha, nomeTrim);
    } catch (err) {
      console.warn("Aviso ao registrar funcionário no Supabase:", err);
    }

    const novaLista: Usuario[] = [...list, { nome: nomeTrim, senha: novaSenha, email: emailToUse, role: 'operador' }];
    localStorage.setItem('usicorte_usuarios', JSON.stringify(novaLista));

    alert(`Funcionário ${nomeTrim} cadastrado com sucesso!`);
    fecharModalNovoUsuario();
    carregarListaUsuarios();
    setUsuarioSelecionado(nomeTrim);
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
                    <option value="ADMIN">👑 ADMINISTRADOR</option>
                    {usuarios.filter(u => u.nome !== 'ADMIN').map((u, idx) => (
                      <option key={idx} value={u.nome}>
                        👤 {u.nome.toUpperCase()}
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
            onClick={abrirModalNovoUsuario}
          >
            <UserPlus className="w-4 h-4 text-blue-400" />
            <span>⚙️ Cadastrar Novo Funcionário na Equipe</span>
          </button>

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

      {/* MODAL DE CADASTRO DE NOVO USUÁRIO (ACESSO RESTRITO) */}
      {isModalNovoUsuarioOpen && (
        <div id="modal-novo-usuario" className="login-overlay">
          <div className="login-card bg-slate-900 border border-slate-700 shadow-2xl">
            <div className="login-title">Cadastrar Novo Funcionário</div>
            <div className="login-subtitle">Registra na equipe e sincroniza com o banco Supabase</div>

            <form id="formCadastroUsuario" onSubmit={salvarNovoUsuario}>
              <div className="form-group">
                <label>Nome do Funcionário:</label>
                <input
                  type="text"
                  id="novoNome"
                  className="form-control"
                  placeholder="Ex: Marcos Silva"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>E-mail (opcional para login Supabase):</label>
                <input
                  type="email"
                  id="novoEmail"
                  className="form-control"
                  placeholder="marcos@usicorte.com.br"
                  value={novoEmail}
                  onChange={(e) => setNovoEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Criar Senha para o Funcionário:</label>
                <input
                  type="password"
                  id="novaSenha"
                  className="form-control"
                  placeholder="Senha de acesso"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ borderTop: '1px dashed #3f3f5e', paddingTop: '12px', marginTop: '15px' }}>
                <label style={{ color: '#ff5555' }}>
                  <strong>Senha de Autorização (ADMIN):</strong>
                </label>
                <input
                  type="password"
                  id="senhaAdminAutorizacao"
                  className="form-control"
                  placeholder="Digite a senha do ADMIN (padrão: 1234)"
                  value={senhaAdminAuth}
                  onChange={(e) => setSenhaAdminAuth(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button
                  type="button"
                  className="btn-admin-opt"
                  style={{ marginTop: 0 }}
                  onClick={fecharModalNovoUsuario}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-login"
                  style={{ marginTop: 0 }}
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

