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

/** Login com email e senha */
export async function login(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw error
  if (data.user) {
    await supabase.from('perfis')
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq('id', data.user.id)
  }
  return data.user
}

/** Logout */
export async function logout() {
  await supabase.auth.signOut()
}

/** Retorna sessão atual */
export async function getSessao() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/** Retorna perfil do usuário logado */
export async function getMeuPerfil() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('perfis')
    .select('*')
    .eq('id', user.id)
    .single()
  return { ...data, email: user.email }
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
