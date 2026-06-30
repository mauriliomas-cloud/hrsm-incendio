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
