import { supabase } from './supabase.js'

/** Login com email e senha */
export async function login(email, senha) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw error
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
  return data
}

/** Admin: convida usuário por email (Supabase envia link automático) */
export async function criarUsuario(email, senha, nome, role) {
  // Usa signUp que não requer chave secreta
  // O usuário receberá email para confirmar e criar senha
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: {
      data: { nome, role },
      emailRedirectTo: window.location.origin
    }
  })
  if (error) throw error

  // Atualiza o perfil com nome e role após criação
  if (data.user) {
    await supabase
      .from('perfis')
      .upsert({ id: data.user.id, nome, role, primeiro_acesso: true })
  }
  return data.user
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

/** Admin: remove usuário */
export async function removerUsuario(id) {
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) throw error
}

/** Registra mudança na sessão */
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session)
  })
}
