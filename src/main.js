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

    // Verifica primeiro acesso — só para usuários não-admin
    if (perfil?.primeiro_acesso === true && perfil?.role !== 'admin') {
      document.getElementById('ov-senha').classList.add('on')
    }

    // Verifica sessão a cada 5 segundos
    setInterval(async () => {
      const { verificarSessao } = await import('./auth.js')
      const valida = await verificarSessao()
      if (!valida) {
        toast('⚠️ Sua sessão foi encerrada em outro dispositivo.')
        setTimeout(async () => {
          const { logout } = await import('./auth.js')
          await logout()
        }, 2000)
      }
    }, 5000)

    await Promise.all([carregarExt(), carregarHid()])
    irPg('ext')

    // Realtime — evita duplicar canais
    try {
      escutarExtintores(() => carregarExt())
      escutarHidrantes(() => carregarHid())
    } catch(re) {
      console.warn('Realtime:', re.message)
    }
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
  const temFiltro = q || cls || sts || mk
  const cnt = document.getElementById('cnt-ext')
  if (temFiltro) {
    cnt.textContent = data.length + ' de ' + EXT.length
    cnt.style.background = data.length < EXT.length ? 'var(--blue)' : ''
  } else {
    cnt.textContent = data.length
    cnt.style.background = ''
  }
  stExt()
  const el = document.getElementById('list-ext')
  if (!data.length) {
    el.innerHTML = '<div class="empty"><div class="ei">🧯</div><p>Nenhum extintor encontrado.</p></div>'
    return
  }
  const isAdmin = perfil?.role === 'admin'
  el.innerHTML = data.map(e => {
    const s = getStatus(e.validade, e.em_manut)
    const manBtn = e.em_manut
      ? `<button class="bmr" data-id="${e.id}" data-act="ret">✅ Retornou</button>`
      : `<button class="bmo" data-id="${e.id}" data-act="man">🔧 Manutenção</button>`
    const delBtn = isAdmin ? `<button class="bd" data-id="${e.id}" data-act="del-ext">🗑️</button>` : ''
    const fotoHtml = e.foto_url ? `<button class="btn bout bsm" style="margin-bottom:8px;font-size:11px" onclick="verFoto('${e.foto_url}','${e.num}')">📷 Ver Foto</button>` : ''
    return `<div class="card ${s}">
      ${fotoHtml}
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
        ${delBtn}
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
  const temFiltroH = q || tp || sts
  const cntH = document.getElementById('cnt-hid')
  if (temFiltroH) {
    cntH.textContent = data.length + ' de ' + HID.length
    cntH.style.background = data.length < HID.length ? 'var(--blue)' : ''
  } else {
    cntH.textContent = data.length
    cntH.style.background = ''
  }
  stHid()
  const el = document.getElementById('list-hid')
  if (!data.length) {
    el.innerHTML = '<div class="empty"><div class="ei">💧</div><p>Nenhum hidrante encontrado.</p></div>'
    return
  }
  const isAdminH = perfil?.role === 'admin'
  el.innerHTML = data.map(h => {
    const s = getStatus(h.pi, false)
    const fotoHtml = h.foto_url ? `<button class="btn bout bsm" style="margin-bottom:8px;font-size:11px" onclick="verFoto('${h.foto_url}','${h.num}')">📷 Ver Foto</button>` : ''
    const delBtn = isAdminH ? `<button class="bd" data-id="${h.id}" data-act="del-hid">🗑️ Excluir</button>` : ''
    return `<div class="card ${s}">
      ${fotoHtml}
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
        <button class="bmo" data-id="${h.id}" data-act="chk-hid">📋 Checklist</button>
        ${delBtn}
      </div>
    </div>`
  }).join('')

  el.querySelectorAll('[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.act === 'edit-hid') editHid(btn.dataset.id)
      if (btn.dataset.act === 'del-hid')  delHid(btn.dataset.id)
      if (btn.dataset.act === 'chk-hid')  abrirChecklist(btn.dataset.id)
    })
  })
}

// ═══════════════════════════════════════
// SALVAR EXTINTOR
// ═══════════════════════════════════════
function gv(id) { return document.getElementById(id)?.value || '' }
function sv(id, v) { const el = document.getElementById(id); if(el) el.value = v || '' }

// ═══════════════════════════════════════
// LOCAIS POR ANDAR
// ═══════════════════════════════════════
const LOCAIS = {
  terreo: [
    'Almoxarifado','Anatomia','APC','Auditório','Banco de Leite','Banco de Sangue',
    'Centro Cirúrgico Externo','Centro Cirúrgico Interno',
    'Centro Obstétrico Externo','Centro Obstétrico Interno',
    'CME Externo','CME Interno','Copa — Centro Cirúrgico','Copa dos Vigilantes',
    'Corredor Central','Corredor da Administração',
    'Corredor — Fisioterapia e Anatomia',
    'Corredor — Pronto-Socorro Infantil','Corredor — Pronto-Socorro / Triagem',
    'Espaço Lúdico','Farmácia','Fisioterapia',
    'Hall Elevador — Bloco A','Hall Elevador — Bloco B','Hall Elevador — Bloco C',
    'Hotelaria','Laboratório','Núcleo de Mobilidade (NUMOB)',
    'Observação Feminina — Pronto-Socorro','Observação Masculina — Pronto-Socorro',
    'Recepção — Ambulatório','Recepção — Pronto-Socorro',
    'Refeitório','Salão do Auditório','UTI Neonatal'
  ],
  andar: [
    'Corredor Sul','Corredor AB','Corredor BC','Corredor Norte',
    'Hall Elevador — Bloco A','Hall Elevador — Bloco B','Hall Elevador — Bloco C'
  ],
  torre: ['Torre A','Torre B','Torre C'],
  mezanino: ['Ala Norte','Ala Sul'],
  externa: [
    'Anexo','Área de Gases — Oxigênio','Caldeira Interna','Depósito',
    'Guarita — Área de Gases','Guarita — Portaria Central','Guarita — Pronto-Socorro',
    'Heliponto','Pátio — Frente da Caldeira','Resíduos Sólidos'
  ]
}

function filtrarSetor(tipo) {
  const prefix = tipo === 'ext' ? 'ef' : 'hf'
  const andar  = document.getElementById(prefix+'-andar').value
  const sel    = document.getElementById(prefix+'-setor')
  sel.innerHTML = '<option value="">— Selecione o Setor —</option>'

  let lista = []
  if (andar === 'terreo') lista = LOCAIS.terreo
  else if (['1andar','2andar','3andar','4andar','5andar'].includes(andar)) lista = LOCAIS.andar
  else if (andar === 'torre')    lista = LOCAIS.torre
  else if (andar === 'mezanino') lista = LOCAIS.mezanino
  else if (andar === 'externa')  lista = LOCAIS.externa

  // Admin pode adicionar "Outro"
  lista.forEach(function(s){ sel.innerHTML += '<option>'+s+'</option>' })
  if (perfil && perfil.role === 'admin') {
    sel.innerHTML += '<option value="outro">— Outro (digitar) —</option>'
  }

  sel.onchange = function() {
    const outroDiv = document.getElementById(prefix+'-outro-div')
    if (sel.value === 'outro') {
      if (!outroDiv) {
        const div = document.createElement('div')
        div.className = 'mfg'
        div.id = prefix+'-outro-div'
        div.innerHTML = '<label>Digite o local</label><input id="'+prefix+'-outro-input" placeholder="Nome do local...">'
        sel.parentNode.after(div)
      }
    } else {
      if (outroDiv) outroDiv.remove()
    }
  }
}

function montarLocal(tipo) {
  const prefix = tipo === 'ext' ? 'ef' : 'hf'
  const andar  = document.getElementById(prefix+'-andar').value
  const setor  = document.getElementById(prefix+'-setor').value
  const andares = {'terreo':'Térreo','1andar':'1º Andar','2andar':'2º Andar',
    '3andar':'3º Andar','4andar':'4º Andar','5andar':'5º Andar',
    'torre':'Torre','mezanino':'Mezanino','externa':'Área Externa'}

  let setorFinal = setor
  if (setor === 'outro') {
    const inp = document.getElementById(prefix+'-outro-input')
    setorFinal = inp ? inp.value.trim() : ''
  }
  if (!setorFinal) return ''
  const andarLabel = andares[andar] || ''
  return andarLabel ? andarLabel + ' — ' + setorFinal : setorFinal
}

// ═══════════════════════════════════════
// TROCA DE SENHA NO PRIMEIRO ACESSO
// ═══════════════════════════════════════
document.getElementById('btn-salva-senha').addEventListener('click', async () => {
  const senha = document.getElementById('ns-senha').value
  const conf  = document.getElementById('ns-conf').value
  const err   = document.getElementById('ns-err')
  if (!senha || senha.length < 6) { err.textContent = 'Mínimo 6 caracteres.'; return }
  if (senha !== conf) { err.textContent = 'As senhas não coincidem.'; return }
  try {
    await supabase.auth.updateUser({ password: senha })
    await supabase.from('perfis').update({ primeiro_acesso: false }).eq('id', perfil.id)
    perfil.primeiro_acesso = false
    document.getElementById('ov-senha').classList.remove('on')
    toast('✅ Senha atualizada com sucesso!', 'ok')
  } catch(e) { err.textContent = 'Erro: ' + e.message }
})

// ═══════════════════════════════════════
// PREVIEW E UPLOAD DE FOTO
// ═══════════════════════════════════════
function previewFoto(tipo) {
  const prefix = tipo === 'ext' ? 'ef' : 'hf'
  const file   = document.getElementById(prefix+'-foto').files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = function(e) {
    document.getElementById(prefix+'-foto-img').src = e.target.result
    document.getElementById(prefix+'-foto-preview').style.display = 'block'
  }
  reader.readAsDataURL(file)
}

async function uploadFoto(tipo, id) {
  const prefix = tipo === 'ext' ? 'ef' : 'hf'
  const file   = document.getElementById(prefix+'-foto').files[0]
  if (!file) return null
  const ext  = file.name.split('.').pop()
  const path = tipo + '/' + id + '.' + ext
  const { error } = await supabase.storage.from('fotos').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('fotos').getPublicUrl(path)
  return data.publicUrl
}

// Setores dentro do prédio (para reconstituir andar/setor ao editar)
const SETORES_PREDIO = ['terreo','andar','torre','mezanino','externa']
const ANDAR_MAP = {
  'Térreo':'terreo','1º Andar':'1andar','2º Andar':'2andar',
  '3º Andar':'3andar','4º Andar':'4andar','5º Andar':'5andar',
  'Torre':'torre','Mezanino':'mezanino','Área Externa':'externa'
}

function separarLocal(loc) {
  if (!loc) return { andar: '', setor: '' }
  const andares = Object.keys(ANDAR_MAP)
  for (let i = 0; i < andares.length; i++) {
    const a = andares[i]
    if (loc.startsWith(a + ' — ')) {
      return { andar: ANDAR_MAP[a], setor: loc.replace(a + ' — ', '') }
    }
  }
  // Tenta encontrar setor na lista
  for (const key in LOCAIS) {
    if (LOCAIS[key].includes(loc)) {
      if (key === 'andar') return { andar: '1andar', setor: loc }
      return { andar: key, setor: loc }
    }
  }
  return { andar: 'externa', setor: loc }
}

// Setores dentro do prédio
const SETORES_PREDIO_LIST = [
  'Corredor Sul','Corredor AB','Corredor BC','Corredor Norte',
  'Hall Elevador — Bloco A','Hall Elevador — Bloco B','Hall Elevador — Bloco C'
]

function toggleAndar() {} // compatibilidade

function abrirExt() {
  editExtId = null
  document.getElementById('tit-ext').textContent = 'Novo Extintor'
  ;['ef-num','ef-cls','ef-cap','ef-mk','ef-andar','ef-setor','ef-desc','ef-val','ef-troca','ef-hdt','ef-hnum','ef-obs'].forEach(id => sv(id,''))
  abrirOv('ov-ext')
}

document.getElementById('btn-salva-ext').addEventListener('click', async () => {
  const num   = gv('ef-num').trim(), cls = gv('ef-cls'), val = gv('ef-val')
  const setor = document.getElementById('ef-setor').value
  const loc   = montarLocal('ext')
  if (!num||!cls||!setor||!val) { toast('⚠️ Preencha os campos obrigatórios'); return }

  // Verifica número duplicado
  const duplicado = EXT.find(e => e.num.trim().toLowerCase() === num.toLowerCase() && e.id !== editExtId)
  if (duplicado) { toast('⚠️ Já existe um extintor com o número ' + num); return }

  const payload = {
    num, cls, loc, validade: val,
    cap: gv('ef-cap'), mk: gv('ef-mk'), descricao: gv('ef-desc'),
    troca: gv('ef-troca'), hdt: gv('ef-hdt'), hnum: gv('ef-hnum'), obs: gv('ef-obs'),
    upd_by: perfil?.nome || '—'
  }
  try {
    let saved
    if (editExtId) {
      saved = await atualizarExtintor(editExtId, payload)
      toast('✅ Extintor atualizado!', 'ok')
    } else {
      saved = await inserirExtintor({ ...payload, em_manut: false, manut_hist: [] })
      toast('✅ Extintor cadastrado!', 'ok')
    }
    // Upload da foto se selecionada
    const fotoUrl = await uploadFoto('ext', saved.id)
    if (fotoUrl) await atualizarExtintor(saved.id, { foto_url: fotoUrl })
    fecharOv('ov-ext'); await carregarExt()
  } catch(e) { toast('Erro: ' + e.message, 'err') }
})

function editExt(id) {
  const e = EXT.find(x => x.id === id); if (!e) return
  editExtId = id
  document.getElementById('tit-ext').textContent = 'Editar Extintor'
  sv('ef-num', e.num); sv('ef-cls', e.cls); sv('ef-cap', e.cap); sv('ef-mk', e.mk)
  const loc = separarLocal(e.loc)
  sv('ef-andar', loc.andar)
  filtrarSetor('ext')
  setTimeout(function(){ sv('ef-setor', loc.setor) }, 50)
  sv('ef-desc', e.descricao); sv('ef-val', e.validade)
  sv('ef-troca', e.troca); sv('ef-hdt', e.hdt); sv('ef-hnum', e.hnum); sv('ef-obs', e.obs)
  // Mostra foto existente
  if (e.foto_url) {
    document.getElementById('ef-foto-img').src = e.foto_url
    document.getElementById('ef-foto-preview').style.display = 'block'
  } else {
    document.getElementById('ef-foto-preview').style.display = 'none'
  }
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
      <div class="mfg"><label>Data de Saída</label><input id="mf-said" type="date"></div>
      <div class="mfg"><label>Motivo / Empresa</label><textarea id="mf-mot" placeholder="Ex: Recarga — Extinfor LTDA"></textarea></div>`
    foot.innerHTML = `
      <button class="btn bout bfull" onclick="document.getElementById('ov-man').classList.remove('on')">Cancelar</button>
      <button class="btn borange bfull" id="btn-man-ok">🔧 Confirmar Saída</button>`
  } else {
    document.getElementById('tit-man').textContent = `✅ Retorno — ${e.num}`
    body.innerHTML = `
      <div class="mfg"><label>Data de Retorno</label><input id="mf-ret" type="date"></div>
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
  const setor = document.getElementById('hf-setor').value
  const loc   = montarLocal('hid')
  if (!num||!tp||!setor||!pi) { toast('⚠️ Preencha os campos obrigatórios'); return }

  // Verifica número duplicado
  const duplicadoH = HID.find(h => h.num.trim().toLowerCase() === num.toLowerCase() && h.id !== editHidId)
  if (duplicadoH) { toast('⚠️ Já existe um hidrante com o número ' + num); return }

  const payload = {
    num, tp, loc, pi,
    mk:gv('hf-mk'), dm:gv('hf-dm'), descricao:gv('hf-desc'),
    ui:gv('hf-ui'), pt:gv('hf-pt'), pv:gv('hf-pv'), obs:gv('hf-obs'),
    upd_by: perfil?.nome || '—'
  }
  try {
    let saved
    if (editHidId) { saved = await atualizarHidrante(editHidId, payload); toast('✅ Hidrante atualizado!', 'ok') }
    else           { saved = await inserirHidrante(payload);               toast('✅ Hidrante cadastrado!', 'ok') }
    const fotoUrl = await uploadFoto('hid', saved.id)
    if (fotoUrl) await atualizarHidrante(saved.id, { foto_url: fotoUrl })
    fecharOv('ov-hid'); await carregarHid()
  } catch(e) { toast('Erro: ' + e.message, 'err') }
})

function editHid(id) {
  const h = HID.find(x => x.id === id); if (!h) return
  editHidId = id
  document.getElementById('tit-hid').textContent = 'Editar Hidrante'
  sv('hf-num',h.num); sv('hf-tp',h.tp); sv('hf-mk',h.mk); sv('hf-dm',h.dm)
  const loc = separarLocal(h.loc)
  sv('hf-andar', loc.andar)
  filtrarSetor('hid')
  setTimeout(function(){ sv('hf-setor', loc.setor) }, 50)
  sv('hf-desc',h.descricao); sv('hf-ui',h.ui)
  sv('hf-pi',h.pi); sv('hf-pt',h.pt); sv('hf-pv',h.pv); sv('hf-obs',h.obs)
  // Mostra foto existente
  if (h.foto_url) {
    document.getElementById('hf-foto-img').src = h.foto_url
    document.getElementById('hf-foto-preview').style.display = 'block'
  } else {
    document.getElementById('hf-foto-preview').style.display = 'none'
  }
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
// CHECKLIST HIDRANTE
// ═══════════════════════════════════════
let chkId = null

function fdata(d) {
  if (!d) return '—'
  const [y,m,dd] = d.split('-')
  return dd+'/'+m+'/'+y
}

function itemCor(v) {
  if (!v || v === '—') return ''
  if (v === 'Bom' || v === 'Presente' || v === 'Desobstruído') return 'color:var(--green);font-weight:700'
  if (v === 'Regular') return 'color:var(--amber);font-weight:700'
  if (v === 'Ruim' || v === 'Ausente' || v === 'Obstruído') return 'color:var(--red);font-weight:700'
  return ''
}

function abrirChecklist(id) {
  chkId = id
  const h = HID.find(x => x.id === id); if (!h) return
  document.getElementById('tit-chk').textContent = `📋 Checklist — ${h.num}`
  document.getElementById('chk-resp').value = perfil?.nome || '—'

  // Limpa campos
  ;['chk-data','chk-mang1','chk-mang2','chk-chave','chk-esguicho',
    'chk-abrigo','chk-registro','chk-lacre',
    'chk-hid1-ult','chk-hid1-prox','chk-hid2-ult','chk-hid2-prox','chk-obs'
  ].forEach(id => { const el=document.getElementById(id); if(el) el.value='' })

  // Define data de hoje
  const hoje = new Date()
  const pad = n => String(n).padStart(2,'0')
  document.getElementById('chk-data').value =
    hoje.getFullYear()+'-'+pad(hoje.getMonth()+1)+'-'+pad(hoje.getDate())

  // Preenche com última inspeção se existir
  const hist = Array.isArray(h.checklist) ? h.checklist : []
  if (hist.length) {
    const ult = hist[hist.length-1]
    if (ult.hid1_ult)  document.getElementById('chk-hid1-ult').value  = ult.hid1_ult
    if (ult.hid1_prox) document.getElementById('chk-hid1-prox').value = ult.hid1_prox
    if (ult.hid2_ult)  document.getElementById('chk-hid2-ult').value  = ult.hid2_ult
    if (ult.hid2_prox) document.getElementById('chk-hid2-prox').value = ult.hid2_prox
  }

  // Histórico
  const histEl = document.getElementById('chk-hist')
  if (hist.length) {
    histEl.innerHTML = hist.slice().reverse().map(ins => `
      <div style="border:1px solid var(--bdr);border-radius:9px;padding:10px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <b style="font-size:12px">📅 ${fdata(ins.data)}</b>
          <span style="font-size:10px;color:var(--muted)">👤 ${ins.resp||'—'}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:11px">
          <span>Mangueira 1: <b style="${itemCor(ins.mang1)}">${ins.mang1||'—'}</b></span>
          <span>Mangueira 2: <b style="${itemCor(ins.mang2)}">${ins.mang2||'—'}</b></span>
          <span>Chave: <b style="${itemCor(ins.chave)}">${ins.chave||'—'}</b></span>
          <span>Esguicho: <b style="${itemCor(ins.esguicho)}">${ins.esguicho||'—'}</b></span>
          <span>Abrigo: <b style="${itemCor(ins.abrigo)}">${ins.abrigo||'—'}</b></span>
          <span>Registro: <b style="${itemCor(ins.registro)}">${ins.registro||'—'}</b></span>
          <span>Lacre: <b style="${itemCor(ins.lacre)}">${ins.lacre||'—'}</b></span>
        </div>
        ${ins.hid1_ult ? `<div style="font-size:10px;color:var(--muted);margin-top:4px">Teste Hid. Mang.1: ${fdata(ins.hid1_ult)} → ${fdata(ins.hid1_prox)}</div>` : ''}
        ${ins.hid2_ult ? `<div style="font-size:10px;color:var(--muted)">Teste Hid. Mang.2: ${fdata(ins.hid2_ult)} → ${fdata(ins.hid2_prox)}</div>` : ''}
        ${ins.obs ? `<div style="font-size:11px;color:var(--ink2);margin-top:4px;font-style:italic">"${ins.obs}"</div>` : ''}
      </div>`).join('')
  } else {
    histEl.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0">Nenhuma inspeção anterior.</div>'
  }

  abrirOv('ov-chk')
}

document.getElementById('btn-rel-chk').addEventListener('click', () => {
  const h = HID.find(x => x.id === chkId); if (!h) return
  gerarRelatorioChecklist(h)
})

function gerarRelatorioChecklist(h) {
  const hist = Array.isArray(h.checklist) ? h.checklist : []
  const ultimos = hist.slice(-10).reverse() // últimos 10

  function cor(v) {
    if (!v || v === '—') return '#666'
    if (v === 'Bom' || v === 'Presente') return '#1E8449'
    if (v === 'Regular') return '#D68910'
    return '#C0392B'
  }

  function linha(label, val) {
    if (!val) return ''
    return `<tr>
      <td style="padding:4px 8px;color:#555;font-size:10pt">${label}</td>
      <td style="padding:4px 8px;font-weight:700;font-size:10pt;color:${cor(val)}">${val}</td>
    </tr>`
  }

  const now = new Date().toLocaleDateString('pt-BR', {day:'2-digit',month:'long',year:'numeric'})

  let corpo = ''
  ultimos.forEach((ins, i) => {
    corpo += `
    <div style="border:1pt solid #ccc;border-radius:6pt;padding:12pt;margin-bottom:14pt;page-break-inside:avoid">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8pt;border-bottom:1pt solid #eee;padding-bottom:6pt">
        <b style="font-size:12pt;color:#1A5276">Inspeção ${ultimos.length - i}ª mais recente</b>
        <span style="font-size:10pt;color:#555">📅 ${fdata(ins.data)} &nbsp;·&nbsp; 👤 ${ins.resp||'—'}</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <tr style="background:#f5f5f5">
          <td colspan="2" style="padding:3px 8px;font-size:9pt;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px">Itens Inspecionados</td>
        </tr>
        ${linha('Mangueira 1', ins.mang1)}
        ${linha('Mangueira 2', ins.mang2)}
        ${linha('Chave', ins.chave)}
        ${linha('Esguicho', ins.esguicho)}
        ${linha('Abrigo / Caixa', ins.abrigo)}
        ${linha('Registro', ins.registro)}
        ${linha('Lacre', ins.lacre)}
      </table>
      ${ins.hid1_ult || ins.hid2_ult ? `
      <table style="width:100%;border-collapse:collapse;margin-top:6pt">
        <tr style="background:#f5f5f5">
          <td colspan="2" style="padding:3px 8px;font-size:9pt;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px">Teste Hidrostático das Mangueiras</td>
        </tr>
        ${ins.hid1_ult ? `<tr><td style="padding:3px 8px;font-size:10pt;color:#555">Mangueira 1 — Último</td><td style="padding:3px 8px;font-size:10pt;font-weight:700">${fmm(ins.hid1_ult)}</td></tr>` : ''}
        ${ins.hid1_prox ? `<tr><td style="padding:3px 8px;font-size:10pt;color:#555">Mangueira 1 — Próximo</td><td style="padding:3px 8px;font-size:10pt;font-weight:700">${fmm(ins.hid1_prox)}</td></tr>` : ''}
        ${ins.hid2_ult ? `<tr><td style="padding:3px 8px;font-size:10pt;color:#555">Mangueira 2 — Último</td><td style="padding:3px 8px;font-size:10pt;font-weight:700">${fmm(ins.hid2_ult)}</td></tr>` : ''}
        ${ins.hid2_prox ? `<tr><td style="padding:3px 8px;font-size:10pt;color:#555">Mangueira 2 — Próximo</td><td style="padding:3px 8px;font-size:10pt;font-weight:700">${fmm(ins.hid2_prox)}</td></tr>` : ''}
      </table>` : ''}
      ${ins.obs ? `<div style="margin-top:6pt;font-size:10pt;color:#333;font-style:italic;padding:6pt;background:#f9f9f9;border-radius:4pt">"${ins.obs}"</div>` : ''}
    </div>`
  })

  if (!ultimos.length) {
    corpo = '<div style="text-align:center;color:#999;padding:24pt">Nenhuma inspeção registrada.</div>'
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Checklist — ${h.num}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 16mm; color: #111; background: #fff }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact } }
  </style>
</head>
<body>
  <div style="border-bottom:2pt solid #7B241C;padding-bottom:10pt;margin-bottom:16pt">
    <div style="font-size:9pt;color:#888;text-transform:uppercase;letter-spacing:.7px;margin-bottom:2pt">Hospital Regional de Santa Maria — Brigada de Incêndio</div>
    <div style="font-size:18pt;font-weight:700;color:#7B241C">Relatório de Checklist — ${h.num}</div>
    <div style="font-size:10pt;color:#555;margin-top:4pt">
      Local: <b>${h.loc}</b> &nbsp;·&nbsp; Tipo: <b>${h.tp}</b> &nbsp;·&nbsp; Gerado em: <b>${now}</b>
    </div>
    <div style="font-size:10pt;color:#555">Exibindo os últimos <b>${ultimos.length}</b> registros de inspeção</div>
  </div>
  ${corpo}
  <div style="text-align:center;font-size:9pt;color:#999;margin-top:16pt;border-top:1pt solid #eee;padding-top:8pt">
    HRSM — Brigada de Incêndio — ${now}
  </div>
  <script>window.onload = () => window.print()<\/script>
</body>
</html>`

  const blob = new Blob([html], {type:'text/html;charset=utf-8'})
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `checklist_${h.num}_${new Date().toISOString().slice(0,10)}.html`
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 1500)
  toast('📄 Relatório gerado!', 'ok')
}

document.getElementById('btn-salva-chk').addEventListener('click', async () => {
  const h = HID.find(x => x.id === chkId)
  if (!h) return

  const data = document.getElementById('chk-data').value
  if (!data) { toast('⚠️ Informe a data da inspeção'); return }

  // Verifica se pelo menos um item foi preenchido
  const itens = [
    document.getElementById('chk-mang1').value,
    document.getElementById('chk-mang2').value,
    document.getElementById('chk-chave').value,
    document.getElementById('chk-esguicho').value,
    document.getElementById('chk-abrigo').value,
    document.getElementById('chk-registro').value,
    document.getElementById('chk-lacre').value,
  ]
  const algumPreenchido = itens.some(v => v && v !== '')
  if (!algumPreenchido) {
    toast('⚠️ Preencha pelo menos um item do checklist')
    return
  }

  const insp = {
    data,
    resp:      perfil?.nome || '—',
    mang1:     document.getElementById('chk-mang1').value,
    mang2:     document.getElementById('chk-mang2').value,
    chave:     document.getElementById('chk-chave').value,
    esguicho:  document.getElementById('chk-esguicho').value,
    abrigo:    document.getElementById('chk-abrigo').value,
    registro:  document.getElementById('chk-registro').value,
    lacre:     document.getElementById('chk-lacre').value,
    hid1_ult:  document.getElementById('chk-hid1-ult').value,
    hid1_prox: document.getElementById('chk-hid1-prox').value,
    hid2_ult:  document.getElementById('chk-hid2-ult').value,
    hid2_prox: document.getElementById('chk-hid2-prox').value,
    obs:       document.getElementById('chk-obs').value,
    ts:        Date.now()
  }

  const hist = Array.isArray(h.checklist) ? [...h.checklist, insp] : [insp]

  try {
    await atualizarHidrante(chkId, {
      checklist: hist,
      upd_by: perfil?.nome || '—'
    })
    toast('✅ Checklist salvo!', 'ok')
    fecharOv('ov-chk')
    await carregarHid()
  } catch(e) { toast('Erro: ' + e.message, 'err') }
})

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

    function statusOnline(ultimoAcesso) {
      if (!ultimoAcesso) return { cor: '#ccc', label: 'Nunca acessou' }
      const diff = (Date.now() - new Date(ultimoAcesso).getTime()) / 60000
      if (diff < 5)    return { cor: '#1E8449', label: '🟢 Online agora' }
      if (diff < 60)   return { cor: '#D68910', label: `🟡 Há ${Math.floor(diff)} min` }
      if (diff < 1440) return { cor: '#7F8C8D', label: `⚫ Há ${Math.floor(diff/60)}h` }
      const d = new Date(ultimoAcesso)
      return { cor: '#BDC3C7', label: '⚪ ' + d.toLocaleDateString('pt-BR') }
    }

    let h = `<div class="rcard"><div class="rhdr rinfo">👥 Usuários (${users.length})</div>`
    users.forEach(u => {
      const st  = statusOnline(u.ultimo_acesso)
      const ehEu = u.id === perfil.id
      const bloq  = u.bloqueado
      h += `<div class="urow">
        <div class="uav2" style="${bloq ? 'background:#FADBD8;color:#C0392B' : ''}">${(u.nome||'?').charAt(0).toUpperCase()}</div>
        <div class="uinfo">
          <div class="un">
            ${u.nome||'—'}
            ${bloq ? '<span style="font-size:10px;color:#C0392B;font-weight:700;margin-left:6px">🔒 BLOQUEADO</span>' : ''}
            ${ehEu ? '<span style="font-size:10px;color:#1A5276;font-weight:700;margin-left:6px">VOCÊ</span>' : ''}
          </div>
          <div class="ul" style="display:flex;flex-direction:column;gap:2px">
            <span>${u.role==='admin'?'<b style="color:#C0392B">Administrador</b>':'Usuário'}</span>
            <span style="font-size:10px;color:${st.cor}">${st.label}</span>
          </div>
        </div>
        ${!ehEu ? `
        <div style="display:flex;flex-direction:column;gap:5px">
          <button class="udel" data-uid="${u.id}" data-nome="${u.nome||''}" 
            style="height:30px;padding:0 10px;border:1.5px solid var(--redl);background:var(--redl);color:var(--red);border-radius:7px;cursor:pointer;font-size:11px;font-weight:600">
            🗑️ Excluir
          </button>
          <button class="ubloq" data-uid="${u.id}" data-nome="${u.nome||''}" data-bloq="${bloq}"
            style="height:30px;padding:0 10px;border:1.5px solid ${bloq?'var(--greenl)':'var(--amberl)'};background:${bloq?'var(--greenl)':'var(--amberl)'};color:${bloq?'var(--green)':'var(--amber)'};border-radius:7px;cursor:pointer;font-size:11px;font-weight:600">
            ${bloq ? '🔓 Desbloquear' : '🔒 Bloquear'}
          </button>
        </div>` : ''}
      </div>`
    })
    h += `<div style="padding:12px 13px"><button class="btn bgreen bfull" id="btn-open-nu">＋ Novo Usuário</button></div>`
    h += `</div>`

    // Backup
    h += `<div class="rcard"><div class="rhdr rinfo">💾 Backup</div>
      <div style="padding:13px;display:flex;flex-direction:column;gap:9px">
        <button class="btn bblue bfull" onclick="expBkp()">⬇ Exportar Backup JSON</button>
        <label class="btn bout bfull" style="cursor:pointer">⬆ Importar Backup JSON
          <input type="file" accept=".json" onchange="impBkp(event)" style="display:none">
        </label>
      </div>
    </div>`

    el.innerHTML = h

    document.getElementById('btn-open-nu')?.addEventListener('click', () => {
      ;['nu-e','nu-n','nu-s'].forEach(id => sv(id,''))
      sv('nu-r','user')
      abrirOv('ov-nu')
    })

    // Deletar
    el.querySelectorAll('.udel').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmar('🗑️','Excluir usuário',
          `Excluir <b>${btn.dataset.nome}</b>?<br><small style="color:var(--red)">Esta ação não pode ser desfeita.</small>`,
          'Excluir')
        if (!ok) return
        try {
          const { removerUsuario } = await import('./auth.js')
          await removerUsuario(btn.dataset.uid)
          toast('🗑️ Usuário excluído.')
          renderAdm()
        } catch(err) { toast('Erro: ' + err.message, 'err') }
      })
    })

    // Bloquear/Desbloquear
    el.querySelectorAll('.ubloq').forEach(btn => {
      btn.addEventListener('click', async () => {
        const bloq = btn.dataset.bloq === 'true'
        const acao = bloq ? 'Desbloquear' : 'Bloquear'
        const ok = await confirmar(
          bloq ? '🔓' : '🔒',
          `${acao} usuário`,
          `${acao} <b>${btn.dataset.nome}</b>?`,
          acao)
        if (!ok) return
        try {
          const { bloquearUsuario } = await import('./auth.js')
          await bloquearUsuario(btn.dataset.uid, !bloq)
          toast(`${bloq ? '🔓 Desbloqueado' : '🔒 Bloqueado'} com sucesso!`, 'ok')
          renderAdm()
        } catch(err) { toast('Erro: ' + err.message, 'err') }
      })
    })

  } catch(err) {
    el.innerHTML = `<div class="empty"><p>Erro ao carregar.<br><small>${err.message}</small></p></div>`
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

// ═══════════════════════════════════════
// BOTÃO VOLTAR DO ANDROID
// ═══════════════════════════════════════

// Adiciona estado ao histórico para interceptar o botão voltar
function pushState() {
  history.pushState({ hrsm: true }, '', window.location.href)
}

// Quando o app carrega, adiciona um estado
window.addEventListener('load', () => {
  pushState()
})

// Intercepta o botão voltar
window.addEventListener('popstate', (e) => {
  // Se tem modal aberto, fecha o modal
  const modaisAbertos = document.querySelectorAll('.ov.on')
  if (modaisAbertos.length > 0) {
    modaisAbertos.forEach(m => m.classList.remove('on'))
    pushState() // Re-adiciona estado
    return
  }
  // Se está em uma aba que não é extintores, volta para extintores
  if (curPg !== 'ext') {
    irPg('ext')
    pushState()
    return
  }
  // Se já está em extintores, re-adiciona estado para não sair
  pushState()
})

// Expõe funções globais necessárias pelo HTML
window.filtrarSetor = filtrarSetor
window.previewFoto  = previewFoto
window.toggleAndar  = toggleAndar
window.verFoto      = verFoto

function verFoto(url, titulo) {
  // Cria modal de foto dinamicamente
  let ov = document.getElementById('ov-foto')
  if (!ov) {
    ov = document.createElement('div')
    ov.id = 'ov-foto'
    ov.className = 'ov center'
    ov.innerHTML = `<div class="modal sm" style="padding:16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <b id="foto-titulo" style="flex:1;font-size:15px"></b>
        <button onclick="document.getElementById('ov-foto').classList.remove('on')" 
          style="border:none;background:var(--bg);border-radius:7px;width:34px;height:34px;cursor:pointer;font-size:16px">✕</button>
      </div>
      <img id="foto-img" style="width:100%;border-radius:10px;max-height:70vh;object-fit:contain">
    </div>`
    ov.addEventListener('click', function(e){ if(e.target===ov) ov.classList.remove('on') })
    document.body.appendChild(ov)
  }
  document.getElementById('foto-titulo').textContent = titulo
  document.getElementById('foto-img').src = url
  ov.classList.add('on')
}
