import { supabase } from './supabase.js'

const EDGE_URL = () => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hyper-handler`
const ANON_KEY = () => import.meta.env.VITE_SUPABASE_ANON_KEY

async function chamarEdge(payload) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autorizado')
  const resp = await fetch(EDGE_URL(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY(),
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify(payload)
  })
  const data = await resp.json()
  if (data.error) throw new Error(data.error)
  return data
}

// Gera token aleatório de sessão
function gerarToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/** Login com email e senha */
export async function login(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw error

  if (data.user) {
    const token = gerarToken()
    // Salva token e último acesso no perfil
    await supabase.from('perfis')
      .update({
        session_token: token,
        ultimo_acesso: new Date().toISOString()
      })
      .eq('id', data.user.id)
    // Salva token localmente
    localStorage.setItem('hrsm_session_token', token)
    localStorage.setItem('hrsm_user_id', data.user.id)
  }
  return data.user
}

/** Logout */
export async function logout() {
  localStorage.removeItem('hrsm_session_token')
  localStorage.removeItem('hrsm_user_id')
  await supabase.auth.signOut()
}

/** Verifica se sessão ainda é válida */
export async function verificarSessao() {
  const token   = localStorage.getItem('hrsm_session_token')
  const userId  = localStorage.getItem('hrsm_user_id')
  if (!token || !userId) return false

  const { data } = await supabase
    .from('perfis')
    .select('session_token')
    .eq('id', userId)
    .single()

  return data?.session_token === token
}

/** Retorna sessão atual */
export async function getSessao() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/** Retorna perfil do usuário logado */
export async function getMeuPerfil() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return null
  const { data } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', session.user.id)
    .single()
  return { ...data, email: session.user.email }
}

/** Admin: cria usuário via Edge Function */
export async function criarUsuario(email, senha, nome, role) {
  return chamarEdge({ acao: 'criar', email, senha, nome, role })
}

/** Admin: deleta usuário via Edge Function */
export async function removerUsuario(userId) {
  return chamarEdge({ acao: 'deletar', userId })
}

/** Admin: bloquear/desbloquear usuário */
export async function bloquearUsuario(userId, bloqueado) {
  return chamarEdge({ acao: 'bloquear', userId, bloqueado })
}

/** Admin: lista todos os perfis */
export async function listarUsuarios() {
  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .order('nome')
  if (error) throw error
  return data
}

/** Registra mudança na sessão */
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}
