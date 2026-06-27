import { supabase } from './supabase.js'
import { login, logout, getMeuPerfil, onAuthChange } from './auth.js'
import {
  listarExtintores, inserirExtintor, atualizarExtintor, deletarExtintor, escutarExtintores,
  listarHidrantes,  inserirHidrante,  atualizarHidrante,  deletarHidrante, escutarHidrantes
} from './db.js'
import { fmm, fdt, sortByNum, getStatus, stBadge, clsBadge, toast, confirmar } from './utils.js'
import { baixarRelatorio } from './relatorio.js'

// ═══════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════
let EXT = [], HID = [], perfil = null
let curPg = 'ext', editExtId = null, editHidId = null, manId = null

// ═══════════════════════════════════════
// AUTH
// ═══════════════════════════════════════
document.getElementById('lbtn').addEventListener('click', async () => {
  const email = document.getElementById('lu').value.trim()
  const senha  = document.getElementById('lp').value
  const err    = document.getElementById('lerr')
  err.textContent = ''
  if (!email || !senha) { err.textContent = 'Preencha e-mail e senha.'; return }
  document.getElementById('lbtn').textContent = 'Entrando…'
  try {
    await login(email, senha)
  } catch (e) {
    err.textContent = 'E-mail ou senha incorretos.'
    document.getElementById('lbtn').textContent = 'Entrar →'
  }
})
document.getElementById('lu').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('lp').focus() })
document.getElementById('lp').addEventListener('keydown', e => { if(e.key==='Enter') document.getElementById('lbtn').click() })

document.getElementById('btn-logout').addEventListener('click', async () => {
  await logout()
  fecharOv('ov-user')
})

// Escuta mudanças de sessão
onAuthChange(async session => {
  if (session) {
    await iniciarApp()
  } else {
    document.getElementById('app').style.display = 'none'
    document.getElementById('ls').style.display  = 'flex'
    document.getElementById('lbtn').textContent  = 'Entrar →'
  }
})

async function iniciarApp() {
  try {
    perfil = await getMeuPerfil()
    document.getElementById('ls').style.display  = 'none'
    document.getElementById('app').style.display = 'block'
    document.getElementById('uav').textContent   = (perfil?.nome || 'U').charAt(0).toUpperCase()
    document.getElementById('unm').textContent   = (perfil?.nome || '').split(' ')[0]
    document.getElementById('um-name').textContent = perfil?.nome || ''

    const isAdmin = perfil?.role === 'admin'
    document.getElementById('nb-adm').style.display = isAdmin ? 'flex' : 'none'
    document.getElementById('um-adm').style.display  = isAdmin ? 'block' : 'none'

    // Carrega dados
    await Promise.all([carregarExt(), carregarHid()])
    irPg('ext')

    // Realtime
    escutarExtintores(() => carregarExt())
    escutarHidrantes( () => carregarHid())
  } catch (e) {
    console.error('Erro ao iniciar app:', e)
  }
}

// ═══════════════════════════════════════
// DADOS
// ═══════════════════════════════════════
async function carregarExt() {
  try {
    EXT = await listarExtintores()
    if (curPg === 'ext') renderExt()
    if (curPg === 'rel') renderRel()
  } catch (e) { toast('Erro ao carregar extintores', 'err') }
}

async function carregarHid() {
  try {
    HID = await listarHidrantes()
    if (curPg === 'hid') renderHid()
    if (curPg === 'rel') renderRel()
  } catch (e) { toast('Erro ao carregar hidrantes', 'err') }
}

// ═══════════════════════════════════════
// NAVEGAÇÃO
// ═══════════════════════════════════════
function irPg(p) {
  curPg = p
  document.querySelectorAll('.pg').forEach(el => el.classList.remove('on'))
  document.getElementById('pg-' + p)?.classList.add('on')
  document.querySelectorAll('.bnav button').forEach(b => {
    b.classList.toggle('on', b.dataset.pg === p)
  })
  document.getElementById('fab').style.display = (p === 'ext' || p === 'hid') ? 'flex' : 'none'
  if (p === 'ext') renderExt()
  if (p === 'hid') renderHid()
  if (p === 'rel') renderRel()
  if (p === 'adm') renderAdm()
  fecharOv('ov-user')
}

document.querySelectorAll('.bnav button').forEach(b => {
  b.addEventListener('click', () => irPg(b.dataset.pg))
})
document.getElementById('fab').addEventListener('click', () => {
  if (curPg === 'ext') abrirExt()
  else if (curPg === 'hid') abrirHid()
})
document.getElementById('user-btn').addEventListener('click', () => abrirOv('ov-user'))
document.getElementById('btn-ir-adm').addEventListener('click', () => irPg('adm'))
document.getElementById('btn-rel-dl').addEventListener('click', () => {
  baixarRelatorio(EXT, HID, perfil?.nome || '—')
  toast('📄 Relatório gerado! Abra o arquivo para imprimir.', 'ok')
})

// ═══════════════════════════════════════
// STATS
// ═══════════════════════════════════════
function mkSt(l, v, s, c) {
  return `<div class="sc ${c}"><div class="sl">${l}</div><div class="sv">${v}</div><div class="ss">${s}</div></div>`
}
function stExt() {
  const ok   = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'ok').length
  const warn = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'warn').length
  const venc = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'danger').length
  const man  = EXT.filter(e => e.em_manut).length
  document.getElementById('st-ext').innerHTML =
    mkSt('Total', EXT.length, 'cadastrados', '') +
    mkSt('Em dia', ok, 'OK', 'cg') +
    mkSt('Atenção', warn, '60 dias', 'ca') +
    mkSt('Vencidos', venc, 'urgente', 'cr') +
    mkSt('Manutenção', man, 'fora serviço', 'co')
}
function stHid() {
  const ok   = HID.filter(h => getStatus(h.pi, false) === 'ok').length
  const warn = HID.filter(h => getStatus(h.pi, false) === 'warn').length
  const venc = HID.filter(h => getStatus(h.pi, false) === 'danger').length
  document.getElementById('st-hid').innerHTML =
    mkSt('Total', HID.length, 'cadastrados', '') +
    mkSt('Em dia', ok, 'OK', 'cg') +
    mkSt('Atenção', warn, '60 dias', 'ca') +
    mkSt('Vencidos', venc, 'urgente', 'cr')
}

// ═══════════════════════════════════════
// RENDER EXTINTORES
// ═══════════════════════════════════════
function buildMarcas() {
  const sel = document.getElementById('emk')
  const cur = sel.value
  const ms  = [...new Set(EXT.map(e => e.mk).filter(Boolean))].sort()
  sel.innerHTML = '<option value="">Todas as marcas</option>'
  ms.forEach(m => sel.innerHTML += `<option${m===cur?' selected':''}>${m}</option>`)
}

function renderExt() {
  buildMarcas()
  const q   = document.getElementById('eq').value.toLowerCase()
  const cls = document.getElementById('ecls').value
  const sts = document.getElementById('ests').value
  const mk  = document.getElementById('emk').value
  const data = sortByNum(EXT).filter(e => {
    const s = getStatus(e.validade, e.em_manut)
    if (q   && ![e.num, e.loc, e.mk, e.descricao, e.obs].filter(Boolean).join(' ').toLowerCase().includes(q)) return false
    if (cls && e.cls !== cls)  return false
    if (sts && s   !== sts)   return false
    if (mk  && e.mk !== mk)   return false
    return true
  })
  document.getElementById('cnt-ext').textContent = data.length
  stExt()
  const el = document.getElementById('list-ext')
  if (!data.length) {
    el.innerHTML = '<div class="empty"><div class="ei">🧯</div><p>Nenhum extintor encontrado.</p></div>'
    return
  }
  el.innerHTML = data.map(e => {
    const s = getStatus(e.validade, e.em_manut)
    const manBtn = e.em_manut
      ? `<button class="bmr" data-id="${e.id}" data-act="ret">✅ Retornou</button>`
      : `<button class="bmo" data-id="${e.id}" data-act="man">🔧 Manutenção</button>`
    return `<div class="card ${s}">
      <div class="chead">
        <div>
          <div class="cnum">${e.num}</div>
          ${e.em_manut ? `<div class="manut-info">🔧 Em manutenção desde ${fmm(e.manut_saida)}</div>` : ''}
        </div>
        <div class="cbadges">${clsBadge(e.cls)}${stBadge(s)}</div>
      </div>
      <div class="cbody">
        <div class="cf"><div class="fl">Capacidade</div><div class="fv">${e.cap||'—'}</div></div>
        <div class="cf"><div class="fl">Marca</div><div class="fv">${e.mk||'—'}</div></div>
        <div class="cf full"><div class="fl">Local</div><div class="fv">${e.loc}</div></div>
        <div class="cf"><div class="fl">Validade Carga</div><div class="fv">${fmm(e.validade)}</div></div>
        <div class="cf"><div class="fl">Próxima Troca</div><div class="fv">${fmm(e.troca)}</div></div>
        <div class="cf"><div class="fl">Hidrostático</div><div class="fv">${e.hdt||'—'}</div></div>
        <div class="cf"><div class="fl">Nº Hid.</div><div class="fv">${e.hnum||'—'}</div></div>
        ${e.obs ? `<div class="cf full"><div class="fl">Obs.</div><div class="fv">${e.obs}</div></div>` : ''}
      </div>
      <div class="cupd"><span>👤 ${e.upd_by||'—'}</span><span>🕐 ${fdt(e.upd_at)}</span></div>
      <div class="cact">
        <button class="be" data-id="${e.id}" data-act="edit-ext">✏️ Editar</button>
        ${manBtn}
        <button class="bd" data-id="${e.id}" data-act="del-ext">🗑️</button>
      </div>
    </div>`
  }).join('')

  // Event delegation
  el.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id  = btn.dataset.id
      const act = btn.dataset.act
      if (act === 'edit-ext') editExt(id)
      if (act === 'del-ext')  delExt(id)
      if (act === 'man')      abrirMan(id, 'said')
      if (act === 'ret')      abrirMan(id, 'ret')
    })
  })
}

// ═══════════════════════════════════════
// RENDER HIDRANTES
// ═══════════════════════════════════════
function renderHid() {
  const q  = document.getElementById('hq').value.toLowerCase()
  const tp = document.getElementById('htp').value
  const sts= document.getElementById('hsts').value
  const data = sortByNum(HID).filter(h => {
    const s = getStatus(h.pi, false)
    if (q  && ![h.num, h.loc, h.mk, h.descricao, h.obs].filter(Boolean).join(' ').toLowerCase().includes(q)) return false
    if (tp  && h.tp !== tp) return false
    if (sts && s   !== sts) return false
    return true
  })
  document.getElementById('cnt-hid').textContent = data.length
  stHid()
  const el = document.getElementById('list-hid')
  if (!data.length) {
    el.innerHTML = '<div class="empty"><div class="ei">💧</div><p>Nenhum hidrante encontrado.</p></div>'
    return
  }
  el.innerHTML = data.map(h => {
    const s = getStatus(h.pi, false)
    return `<div class="card ${s}">
      <div class="chead"><div class="cnum">${h.num}</div><div class="cbadges">${stBadge(s)}</div></div>
      <div class="cbody">
        <div class="cf"><div class="fl">Tipo</div><div class="fv">${h.tp}</div></div>
        <div class="cf"><div class="fl">Marca</div><div class="fv">${h.mk||'—'}</div></div>
        <div class="cf full"><div class="fl">Local</div><div class="fv">${h.loc}</div></div>
        <div class="cf"><div class="fl">Últ. Inspeção</div><div class="fv">${fmm(h.ui)}</div></div>
        <div class="cf"><div class="fl">Próx. Inspeção</div><div class="fv">${fmm(h.pi)}</div></div>
        <div class="cf"><div class="fl">Teste Pressão</div><div class="fv">${fmm(h.pt)}</div></div>
        <div class="cf"><div class="fl">Pressão</div><div class="fv">${h.pv ? h.pv+' bar' : '—'}</div></div>
        ${h.obs ? `<div class="cf full"><div class="fl">Obs.</div><div class="fv">${h.obs}</div></div>` : ''}
      </div>
      <div class="cupd"><span>👤 ${h.upd_by||'—'}</span><span>🕐 ${fdt(h.upd_at)}</span></div>
      <div class="cact">
        <button class="be" data-id="${h.id}" data-act="edit-hid">✏️ Editar</button>
        <button class="bd" data-id="${h.id}" data-act="del-hid">🗑️ Excluir</button>
      </div>
    </div>`
  }).join('')

  el.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.act === 'edit-hid') editHid(btn.dataset.id)
      if (btn.dataset.act === 'del-hid')  delHid(btn.dataset.id)
    })
  })
}

// ═══════════════════════════════════════
// SALVAR EXTINTOR
// ═══════════════════════════════════════
function gv(id) { return document.getElementById(id)?.value || '' }
function sv(id, v) { const el = document.getElementById(id); if(el) el.value = v || '' }

// Setores que ficam dentro do prédio (precisam de andar)
const SETORES_PREDIO = [
  'Corredor AB','Corredor BC','Corredor Norte','Corredor Sul',
  'Hall Elevador — Bloco A','Hall Elevador — Bloco B','Hall Elevador — Bloco C'
]

function toggleAndar(tipo) {
  // Não faz nada por enquanto — andar é sempre opcional
}

function montarLocal(andar, setor) {
  if (!setor) return ''
  if (andar && SETORES_PREDIO.includes(setor)) return andar + ' — ' + setor
  return setor
}

function abrirExt() {
  editExtId = null
  document.getElementById('tit-ext').textContent = 'Novo Extintor'
  ;['ef-num','ef-cls','ef-cap','ef-mk','ef-andar','ef-setor','ef-desc','ef-val','ef-troca','ef-hdt','ef-hnum','ef-obs'].forEach(id => sv(id,''))
  abrirOv('ov-ext')
}

document.getElementById('btn-salva-ext').addEventListener('click', async () => {
  const num   = gv('ef-num').trim(), cls = gv('ef-cls'), val = gv('ef-val')
  const andar = gv('ef-andar'), setor = gv('ef-setor')
  const loc   = montarLocal(andar, setor)
  if (!num||!cls||!setor||!val) { toast('⚠️ Preencha os campos obrigatórios'); return }
  const payload = {
    num, cls, loc, validade: val,
    cap: gv('ef-cap'), mk: gv('ef-mk'), descricao: gv('ef-desc'),
    troca: gv('ef-troca'), hdt: gv('ef-hdt'), hnum: gv('ef-hnum'), obs: gv('ef-obs'),
    upd_by: perfil?.nome || '—'
  }
  try {
    if (editExtId) {
      // Mantém campos de manutenção
      const old = EXT.find(e => e.id === editExtId)
      await atualizarExtintor(editExtId, {
        ...payload,
        em_manut: old?.em_manut || false,
        manut_saida: old?.manut_saida || null,
        manut_motivo: old?.manut_motivo || null,
        manut_hist: old?.manut_hist || []
      })
      toast('✅ Extintor atualizado!', 'ok')
    } else {
      await inserirExtintor({ ...payload, em_manut: false, manut_hist: [] })
      toast('✅ Extintor cadastrado!', 'ok')
    }
    fecharOv('ov-ext')
    await carregarExt()
  } catch(e) { toast('Erro: ' + e.message, 'err') }
})

function editExt(id) {
  const e = EXT.find(x => x.id === id); if (!e) return
  editExtId = id
  document.getElementById('tit-ext').textContent = 'Editar Extintor'
  sv('ef-num', e.num); sv('ef-cls', e.cls); sv('ef-cap', e.cap); sv('ef-mk', e.mk)
  // Tenta separar andar e setor do local salvo
  const partes = (e.loc || '').split(' — ')
  const andares = ['Térreo','1º Andar','2º Andar','3º Andar','4º Andar','5º Andar']
  if (partes.length >= 2 && andares.includes(partes[0])) {
    sv('ef-andar', partes[0])
    sv('ef-setor', partes.slice(1).join(' — '))
  } else {
    sv('ef-andar', '')
    sv('ef-setor', e.loc || '')
  }
  sv('ef-desc', e.descricao); sv('ef-val', e.validade)
  sv('ef-troca', e.troca); sv('ef-hdt', e.hdt); sv('ef-hnum', e.hnum); sv('ef-obs', e.obs)
  abrirOv('ov-ext')
}

async function delExt(id) {
  const e = EXT.find(x => x.id === id); if (!e) return
  const ok = await confirmar('🗑️', 'Excluir extintor', `Excluir <b>${e.num}</b>?<br>${e.loc}`, 'Excluir')
  if (!ok) return
  try { await deletarExtintor(id); toast('🗑️ Extintor removido.'); await carregarExt() }
  catch(err) { toast('Erro: ' + err.message, 'err') }
}

// ═══════════════════════════════════════
// MANUTENÇÃO
// ═══════════════════════════════════════
function abrirMan(id, modo) {
  manId = id
  const e = EXT.find(x => x.id === id); if (!e) return
  const body = document.getElementById('man-body')
  const foot = document.getElementById('man-foot')
  if (modo === 'said') {
    document.getElementById('tit-man').textContent = `🔧 Manutenção — ${e.num}`
    body.innerHTML = `
      <div class="mfg"><label>Data de Saída</label><input id="mf-said" type="month"></div>
      <div class="mfg"><label>Motivo / Empresa</label><textarea id="mf-mot" placeholder="Ex: Recarga — Extinfor LTDA"></textarea></div>`
    foot.innerHTML = `
      <button class="btn bout bfull" onclick="document.getElementById('ov-man').classList.remove('on')">Cancelar</button>
      <button class="btn borange bfull" id="btn-man-ok">🔧 Confirmar Saída</button>`
  } else {
    document.getElementById('tit-man').textContent = `✅ Retorno — ${e.num}`
    body.innerHTML = `
      <div class="mfg"><label>Data de Retorno</label><input id="mf-ret" type="month"></div>
      <div class="mfg"><label>Serviços realizados</label><textarea id="mf-obs" placeholder="Recarga, teste…"></textarea></div>`
    foot.innerHTML = `
      <button class="btn bout bfull" onclick="document.getElementById('ov-man').classList.remove('on')">Cancelar</button>
      <button class="btn bgreen bfull" id="btn-man-ok">✅ Confirmar Retorno</button>`
  }
  abrirOv('ov-man')
  document.getElementById('btn-man-ok').addEventListener('click', async () => {
    const e2 = EXT.find(x => x.id === manId); if (!e2) return
    const hist = Array.isArray(e2.manut_hist) ? [...e2.manut_hist] : []
    let payload
    if (modo === 'said') {
      const said = gv('mf-said'), mot = gv('mf-mot')
      hist.push({ tipo:'saida', data:said, motivo:mot, por:perfil?.nome||'—', ts:Date.now() })
      payload = { em_manut:true, manut_saida:said, manut_motivo:mot, manut_hist:hist, upd_by:perfil?.nome||'—' }
    } else {
      const ret = gv('mf-ret'), obs = gv('mf-obs')
      hist.push({ tipo:'retorno', data:ret, obs, por:perfil?.nome||'—', ts:Date.now() })
      payload = { em_manut:false, manut_hist:hist, upd_by:perfil?.nome||'—' }
    }
    try {
      await atualizarExtintor(manId, payload)
      fecharOv('ov-man')
      toast(modo==='said'?'🔧 Em manutenção!':'✅ Retornou!', 'ok')
      await carregarExt()
    } catch(err) { toast('Erro: ' + err.message, 'err') }
  })
}

// ═══════════════════════════════════════
// SALVAR HIDRANTE
// ═══════════════════════════════════════
function abrirHid() {
  editHidId = null
  document.getElementById('tit-hid').textContent = 'Novo Hidrante'
  ;['hf-num','hf-tp','hf-mk','hf-dm','hf-andar','hf-setor','hf-desc','hf-ui','hf-pi','hf-pt','hf-pv','hf-obs'].forEach(id => sv(id,''))
  abrirOv('ov-hid')
}

document.getElementById('btn-salva-hid').addEventListener('click', async () => {
  const num   = gv('hf-num').trim(), tp = gv('hf-tp'), pi = gv('hf-pi')
  const andar = gv('hf-andar'), setor = gv('hf-setor')
  const loc   = montarLocal(andar, setor)
  if (!num||!tp||!setor||!pi) { toast('⚠️ Preencha os campos obrigatórios'); return }
  const payload = {
    num, tp, loc, pi,
    mk:gv('hf-mk'), dm:gv('hf-dm'), descricao:gv('hf-desc'),
    ui:gv('hf-ui'), pt:gv('hf-pt'), pv:gv('hf-pv'), obs:gv('hf-obs'),
    upd_by: perfil?.nome || '—'
  }
  try {
    if (editHidId) { await atualizarHidrante(editHidId, payload); toast('✅ Hidrante atualizado!', 'ok') }
    else           { await inserirHidrante(payload);                toast('✅ Hidrante cadastrado!', 'ok') }
    fecharOv('ov-hid'); await carregarHid()
  } catch(e) { toast('Erro: ' + e.message, 'err') }
})

function editHid(id) {
  const h = HID.find(x => x.id === id); if (!h) return
  editHidId = id
  document.getElementById('tit-hid').textContent = 'Editar Hidrante'
  sv('hf-num',h.num); sv('hf-tp',h.tp); sv('hf-mk',h.mk); sv('hf-dm',h.dm)
  // Tenta separar andar e setor do local salvo
  const partes = (h.loc || '').split(' — ')
  const andares = ['Térreo','1º Andar','2º Andar','3º Andar','4º Andar','5º Andar']
  if (partes.length >= 2 && andares.includes(partes[0])) {
    sv('hf-andar', partes[0])
    sv('hf-setor', partes.slice(1).join(' — '))
  } else {
    sv('hf-andar', '')
    sv('hf-setor', h.loc || '')
  }
  sv('hf-desc',h.descricao); sv('hf-ui',h.ui)
  sv('hf-pi',h.pi); sv('hf-pt',h.pt); sv('hf-pv',h.pv); sv('hf-obs',h.obs)
  abrirOv('ov-hid')
}

async function delHid(id) {
  const h = HID.find(x => x.id === id); if (!h) return
  const ok = await confirmar('🗑️', 'Excluir hidrante', `Excluir <b>${h.num}</b>?<br>${h.loc}`, 'Excluir')
  if (!ok) return
  try { await deletarHidrante(id); toast('🗑️ Hidrante removido.'); await carregarHid() }
  catch(err) { toast('Erro: ' + err.message, 'err') }
}

// ═══════════════════════════════════════
// FILTROS
// ═══════════════════════════════════════
;['eq','ecls','ests','emk'].forEach(id => document.getElementById(id)?.addEventListener('input', renderExt))
;['hq','htp','hsts'].forEach(id => document.getElementById(id)?.addEventListener('input', renderHid))
document.getElementById('btn-limp-ext')?.addEventListener('click', () => {
  ;['eq','ecls','ests','emk'].forEach(id => sv(id,''))
  renderExt()
})
document.getElementById('btn-limp-hid')?.addEventListener('click', () => {
  ;['hq','htp','hsts'].forEach(id => sv(id,''))
  renderHid()
})

// ═══════════════════════════════════════
// RELATÓRIO NA TELA
// ═══════════════════════════════════════
function renderRel() {
  const el   = document.getElementById('rel-body')
  const now  = new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})
  const nome = perfil?.nome || '—'

  const eOk   = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'ok')
  const eWarn = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'warn')
  const eVenc = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'danger')
  const eMan  = EXT.filter(e => e.em_manut)
  const hVenc = HID.filter(h => getStatus(h.pi, false) === 'danger')
  const hWarn = HID.filter(h => getStatus(h.pi, false) === 'warn')

  let h = `<div style="background:#7B241C;color:#fff;border-radius:12px;padding:14px;margin-bottom:14px">
    <div style="font-size:9px;opacity:.6;text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px">Hospital Regional de Santa Maria</div>
    <div style="font-size:16px;font-weight:700;margin-bottom:5px">Relatório de Combate a Incêndio</div>
    <div style="font-size:11px;opacity:.8">📅 ${now} &nbsp;|&nbsp; 👤 ${nome}</div>
  </div>`

  h += `<div class="stats" style="margin-bottom:13px">
    ${mkSt('Extintores',EXT.length,'total','')}
    ${mkSt('OK',eOk.length,'em dia','cg')}
    ${mkSt('Atenção',eWarn.length,'60 dias','ca')}
    ${mkSt('Vencidos',eVenc.length,'urgente','cr')}
    ${mkSt('Manutenção',eMan.length,'fora serviço','co')}
    ${mkSt('Hidrantes',HID.length,'total','')}
    ${mkSt('OK',HID.filter(h=>getStatus(h.pi,false)==='ok').length,'em dia','cg')}
    ${mkSt('Vencidos',hVenc.length,'urgente','cr')}
  </div>`

  // Manutenção
  h += `<div class="rcard"><div class="rhdr rorange">🔧 Em Manutenção (${eMan.length})</div>`
  if (eMan.length) {
    sortByNum(eMan).forEach(e => {
      const hist = (e.manut_hist||[]).map(hh =>
        (hh.tipo==='saida'?'⬆ Saída ':'⬇ Retorno ') + fmm(hh.data) + ' — ' + hh.por
      ).join(' · ')
      h += `<div class="rrow">
        <div><div class="rnum">${e.num}</div>${clsBadge(e.cls)}</div>
        <div class="rloc">${e.loc}${e.manut_motivo?`<br><span style="font-size:10px">${e.manut_motivo}</span>`:''}${hist?`<div style="font-size:10px;color:var(--muted);margin-top:2px">${hist}</div>`:''}</div>
        <div><div class="rdt" style="color:var(--orange)">${fmm(e.manut_saida)}</div><div class="rby">${e.upd_by||'—'}</div></div>
      </div>`
    })
  } else { h += `<div class="na">Nenhum extintor em manutenção.</div>` }
  h += `</div>`

  if (eVenc.length) {
    h += `<div class="rcard"><div class="rhdr rdanger">🔴 Extintores Vencidos (${eVenc.length})</div>`
    sortByNum(eVenc).forEach(e => {
      h += `<div class="rrow"><div><div class="rnum">${e.num}</div>${clsBadge(e.cls)}</div><div class="rloc">${e.loc}</div><div><div class="rdt" style="color:var(--red)">${fmm(e.validade)}</div><div class="rby">${e.upd_by||'—'}</div></div></div>`
    })
    h += `</div>`
  }
  if (eWarn.length) {
    h += `<div class="rcard"><div class="rhdr rwarn">⚠️ Atenção — Vencimento Próximo (${eWarn.length})</div>`
    sortByNum(eWarn).forEach(e => {
      h += `<div class="rrow"><div><div class="rnum">${e.num}</div>${clsBadge(e.cls)}</div><div class="rloc">${e.loc}</div><div><div class="rdt" style="color:var(--amber)">${fmm(e.validade)}</div><div class="rby">${e.upd_by||'—'}</div></div></div>`
    })
    h += `</div>`
  }
  if (hVenc.length) {
    h += `<div class="rcard"><div class="rhdr rdanger">🔴 Hidrantes — Inspeção Vencida (${hVenc.length})</div>`
    sortByNum(hVenc).forEach(hh => {
      h += `<div class="rrow"><div class="rnum">${hh.num}</div><div class="rloc">${hh.tp}<br>${hh.loc}</div><div><div class="rdt" style="color:var(--red)">${fmm(hh.pi)}</div><div class="rby">${hh.upd_by||'—'}</div></div></div>`
    })
    h += `</div>`
  }

  h += `<div class="rcard"><div class="rhdr rok">✅ Todos os Extintores (${EXT.length})</div>`
  sortByNum(EXT).forEach(e => {
    const s = getStatus(e.validade, e.em_manut)
    h += `<div class="rrow"><div><div class="rnum">${e.num}</div>${clsBadge(e.cls)}${e.em_manut?'<br><span style="font-size:9px;color:var(--orange);font-weight:700">MANUT.</span>':''}</div><div class="rloc">${e.loc}<br><span style="font-size:10px">${e.mk||''}</span></div><div>${stBadge(s)}<div class="rdt">${fmm(e.validade)}</div><div class="rby">${e.upd_by||'—'}</div></div></div>`
  })
  if (!EXT.length) h += `<div class="na">Nenhum extintor cadastrado.</div>`
  h += `</div>`

  h += `<div class="rcard"><div class="rhdr rok">✅ Todos os Hidrantes (${HID.length})</div>`
  sortByNum(HID).forEach(hh => {
    const s = getStatus(hh.pi, false)
    h += `<div class="rrow"><div class="rnum">${hh.num}</div><div class="rloc">${hh.tp}<br>${hh.loc}</div><div>${stBadge(s)}<div class="rby">${hh.upd_by||'—'}</div></div></div>`
  })
  if (!HID.length) h += `<div class="na">Nenhum hidrante cadastrado.</div>`
  h += `</div>`

  h += `<div style="text-align:center;color:var(--muted);font-size:10px;padding:8px 0 14px">HRSM · Combate a Incêndio · ${now}</div>`
  el.innerHTML = h
}

// ═══════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════
async function renderAdm() {
  const el = document.getElementById('adm-body')
  if (!perfil || perfil.role !== 'admin') {
    el.innerHTML = '<div class="empty"><p>Acesso restrito.</p></div>'
    return
  }
  el.innerHTML = '<div class="loading">Carregando…</div>'
  try {
    const { listarUsuarios } = await import('./auth.js')
    const users = await listarUsuarios()
    let h = `<div class="rcard"><div class="rhdr rinfo">👥 Usuários Cadastrados</div>`
    users.forEach(u => {
      h += `<div class="urow">
        <div class="uav2">${u.nome.charAt(0).toUpperCase()}</div>
        <div class="uinfo">
          <div class="un">${u.nome}</div>
          <div class="ul">${u.role==='admin'?'<b style="color:#C0392B">Administrador</b>':'Usuário'}</div>
        </div>
        ${u.id !== perfil.id ? `<button class="udel" data-uid="${u.id}" data-nome="${u.nome}">Remover</button>` : ''}
      </div>`
    })
    h += `<div style="padding:12px 13px"><button class="btn bgreen bfull" id="btn-open-nu">＋ Novo Usuário</button></div>`
    h += `</div>`
    el.innerHTML = h

    document.getElementById('btn-open-nu')?.addEventListener('click', () => {
      ;['nu-e','nu-n','nu-s'].forEach(id => sv(id,''))
      sv('nu-r','user')
      abrirOv('ov-nu')
    })
    el.querySelectorAll('.udel').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmar('👤','Remover usuário',`Remover <b>${btn.dataset.nome}</b>?`,'Remover')
        if (!ok) return
        try {
          const { removerUsuario } = await import('./auth.js')
          await removerUsuario(btn.dataset.uid)
          toast('🗑️ Usuário removido.'); renderAdm()
        } catch(err) { toast('Erro: ' + err.message, 'err') }
      })
    })
  } catch(err) {
    el.innerHTML = `<div class="empty"><p>Erro ao carregar usuários.<br><small>${err.message}</small></p></div>`
  }
}

document.getElementById('btn-cria-user')?.addEventListener('click', async () => {
  const email = gv('nu-e').trim()
  const nome  = gv('nu-n').trim()
  const senha = gv('nu-s')
  const role  = gv('nu-r')
  if (!email||!nome||!senha) { toast('⚠️ Preencha todos os campos'); return }
  if (senha.length < 6)       { toast('⚠️ Senha mínimo 6 caracteres'); return }
  try {
    const { criarUsuario } = await import('./auth.js')
    await criarUsuario(email, senha, nome, role)
    fecharOv('ov-nu')
    toast('✅ Usuário criado!', 'ok')
    renderAdm()
  } catch(err) { toast('Erro: ' + err.message, 'err') }
})

// ═══════════════════════════════════════
// MODAIS
// ═══════════════════════════════════════
function abrirOv(id) { document.getElementById(id)?.classList.add('on') }
function fecharOv(id) { document.getElementById(id)?.classList.remove('on') }

document.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', () => fecharOv(el.dataset.close))
})
document.querySelectorAll('.ov').forEach(o => {
  o.addEventListener('click', e => {
    if (e.target === o && o.id !== 'ov-conf') fecharOv(o.id)
  })
})
