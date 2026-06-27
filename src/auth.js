import { supabase } from './supabase.js'

/** Login com email e senha */
export async function login(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw error
  // Registra último acesso
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

/** Retorna perfil do usuário logado (nome, role) */
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
  const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

  // Pega o token da sessão atual
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autorizado')

  const resp = await fetch(`${SUPABASE_URL}/functions/v1/hyper-handler`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ email, senha, nome, role })
  })

  const data = await resp.json()
  if (data.error) throw new Error(data.error)
  return data
}

/** Admin: lista todos os perfis com email */
export async function listarUsuarios() {
  const { data, error } = await supabase
    .from('perfis')
    .select('*')
    .order('nome')
  if (error) throw error
  return data
}

/** Admin: remove usuário pelo id do perfil */
export async function removerUsuario(id) {
  // Remove perfil (a cascata remove o auth user)
  const { error } = await supabase
    .from('perfis')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/** Registra mudança na sessão */
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}
