import { supabase } from './supabase.js'

// ══════════════════════════════════════
// EXTINTORES
// ══════════════════════════════════════

export async function listarExtintores() {
  const { data, error } = await supabase
    .from('extintores')
    .select('*')
    .order('num')
  if (error) throw error
  return data
}

export async function inserirExtintor(item) {
  const { data, error } = await supabase
    .from('extintores')
    .insert([item])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarExtintor(id, item) {
  const { data, error } = await supabase
    .from('extintores')
    .update({ ...item, upd_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletarExtintor(id) {
  const { error } = await supabase
    .from('extintores')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ══════════════════════════════════════
// HIDRANTES
// ══════════════════════════════════════

export async function listarHidrantes() {
  const { data, error } = await supabase
    .from('hidrantes')
    .select('*')
    .order('num')
  if (error) throw error
  return data
}

export async function inserirHidrante(item) {
  const { data, error } = await supabase
    .from('hidrantes')
    .insert([item])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarHidrante(id, item) {
  const { data, error } = await supabase
    .from('hidrantes')
    .update({ ...item, upd_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletarHidrante(id) {
  const { error } = await supabase
    .from('hidrantes')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ══════════════════════════════════════
// ══════════════════════════════════════
// SETORES PERSONALIZADOS
// ══════════════════════════════════════

export async function listarSetores(grupo) {
  const { data, error } = await supabase
    .from('setores')
    .select('*')
    .eq('grupo', grupo)
    .order('nome')
  if (error) throw error
  return data
}

export async function inserirSetor(grupo, nome) {
  const { data, error } = await supabase
    .from('setores')
    .insert([{ grupo, nome }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarSetor(id, nome) {
  const { data, error } = await supabase
    .from('setores')
    .update({ nome })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletarSetor(id) {
  const { error } = await supabase
    .from('setores')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ══════════════════════════════════════
// HISTÓRICO
// ══════════════════════════════════════

export async function registrarHistorico(tipo, itemId, itemNum, acao, descricao, por) {
  const { error } = await supabase
    .from('historico')
    .insert([{ tipo, item_id: itemId, item_num: itemNum, acao, descricao, por }])
  if (error) console.warn('Histórico:', error.message)
}

export async function listarHistorico(tipo, itemId) {
  const { data, error } = await supabase
    .from('historico')
    .select('*')
    .eq('tipo', tipo)
    .eq('item_id', itemId)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data
}

// ══════════════════════════════════════
// OCORRÊNCIAS
// ══════════════════════════════════════

export async function listarOcorrencias() {
  const { data, error } = await supabase
    .from('ocorrencias')
    .select('*')
    .order('data_hora', { ascending: false })
  if (error) throw error
  return data
}

export async function inserirOcorrencia(item) {
  const { data, error } = await supabase
    .from('ocorrencias')
    .insert([item])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function atualizarOcorrencia(id, item) {
  const { data, error } = await supabase
    .from('ocorrencias')
    .update(item)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deletarOcorrencia(id) {
  const { error } = await supabase
    .from('ocorrencias')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ══════════════════════════════════════
// EMPRESAS
// ══════════════════════════════════════

export async function listarEmpresas() {
  const { data, error } = await supabase
    .from('empresas')
    .select('*')
    .order('nome')
  if (error) throw error
  return data
}

export async function inserirEmpresa(nome) {
  const { data, error } = await supabase
    .from('empresas')
    .insert([{ nome: nome.toUpperCase().trim() }])
    .select()
    .single()
  if (error) throw error
  return data
}

// ══════════════════════════════════════
// REALTIME — escuta mudanças ao vivo
// ══════════════════════════════════════

export function escutarExtintores(callback) {
  // Remove canal existente antes de criar novo
  const existing = supabase.getChannels().find(c => c.topic === 'realtime:extintores_changes')
  if (existing) supabase.removeChannel(existing)
  return supabase
    .channel('extintores_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'extintores' }, callback)
    .subscribe()
}

export function escutarHidrantes(callback) {
  const existing = supabase.getChannels().find(c => c.topic === 'realtime:hidrantes_changes')
  if (existing) supabase.removeChannel(existing)
  return supabase
    .channel('hidrantes_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'hidrantes' }, callback)
    .subscribe()
}
