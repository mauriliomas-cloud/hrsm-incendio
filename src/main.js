import { supabase } from './supabase.js'
import { login, logout, getMeuPerfil, onAuthChange } from './auth.js'
import {
  listarExtintores, inserirExtintor, atualizarExtintor, deletarExtintor, escutarExtintores,
  listarHidrantes,  inserirHidrante,  atualizarHidrante,  deletarHidrante, escutarHidrantes,
  listarEmpresas, inserirEmpresa,
  listarOcorrencias, inserirOcorrencia, atualizarOcorrencia, deletarOcorrencia
} from './db.js'
import { fmm, fdt, sortByNum, getStatus, getStatusHid, stBadge, stBadgeHid, clsBadge, toast, confirmar } from './utils.js'
import { baixarRelatorio, abrirRelatorio } from './relatorio.js'

// ═══════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════
let EXT = [], HID = [], perfil = null
let curPg = 'ext', editExtId = null, editHidId = null, manId = null
let relFiltro = 'ext-todos'
let ultimaAbaRelevante = 'ext'
let EMPRESAS = []
let OCR = []
let editOcrId = null
let isDev = false
let isAdmin = false

async function carregarEmpresas() {
  try {
    EMPRESAS = await listarEmpresas()
    popularSelectEmpresas()
  } catch(e) { console.warn('Erro ao carregar empresas:', e.message) }
}

function popularSelectEmpresas() {
  const sel = document.getElementById('ef-empresa')
  if (!sel) return
  const atual = sel.value
  sel.innerHTML = '<option value="">— Selecione —</option>'
  EMPRESAS.forEach(emp => {
    sel.innerHTML += `<option value="${emp.nome}">${emp.nome}</option>`
  })
  sel.innerHTML += '<option value="__nova__">＋ Cadastrar nova empresa</option>'
  if (atual) sel.value = atual
}

// ═══════════════════════════════════════
// ═══════════════════════════════════════
// DETECÇÃO DE QR CODE ESCANEADO
// ═══════════════════════════════════════
function verificarQRScan() {
  const params = new URLSearchParams(window.location.search)
  const tipo   = params.get('scan')
  const num    = params.get('num')
  if (!tipo || !num) return

  window.history.replaceState({}, '', window.location.pathname)

  const tentativa = setInterval(() => {
    if (tipo === 'ext') {
      const e = EXT.find(x => x.num === num)
      if (e) { clearInterval(tentativa); irPg('ext'); setTimeout(() => editExt(e.id), 300) }
    } else if (tipo === 'hid') {
      const h = HID.find(x => x.num === num)
      if (h) { clearInterval(tentativa); irPg('hid'); setTimeout(() => abrirChecklist(h.id), 300) }
    }
  }, 500)
  setTimeout(() => clearInterval(tentativa), 5000)
}

// ═══════════════════════════════════════
// PING AUTOMÁTICO — mantém Supabase ativo
// ═══════════════════════════════════════
async function pingSupabase() {
  try {
    await supabase.from('perfis').select('id').limit(1)
    console.log('✅ Ping Supabase OK')
  } catch(e) {
    console.warn('Ping falhou:', e.message)
  }
}

// Ping a cada 24 horas
setInterval(pingSupabase, 24 * 60 * 60 * 1000)
pingSupabase() // Ping imediato ao abrir o app
window.addEventListener('online', () => {
  toast('✅ Conexão restaurada!', 'ok')
  carregarExt()
  carregarHid()
})

window.addEventListener('offline', () => {
  toast('⚠️ Sem internet — modo offline')
})

// ═══════════════════════════════════════
// TELA INICIAL
// ═══════════════════════════════════════
document.getElementById('btn-ir-login')?.addEventListener('click', () => {
  document.getElementById('ws').style.display = 'none'
  document.getElementById('ls').style.display  = 'flex'
  setTimeout(() => document.getElementById('lu')?.focus(), 300)
})

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
    document.getElementById('ws').style.display = 'none'
    document.getElementById('ls').style.display = 'none'
    await iniciarApp()
  } else {
    document.getElementById('app').style.display = 'none'
    document.getElementById('ws').style.display  = 'flex'
    document.getElementById('ls').style.display  = 'none'
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

    isDev   = perfil?.nivel === 'dev'   || perfil?.email === 'maurilio.mas@gmail.com'
    isAdmin = perfil?.nivel === 'admin' || perfil?.nivel === 'dev' || perfil?.role === 'admin'
    const isUser  = true // todos têm acesso básico

    document.getElementById('nb-adm').style.display  = isAdmin ? 'flex' : 'none'
    document.getElementById('um-adm').style.display   = isAdmin ? 'block' : 'none'
    document.getElementById('nb-ocr').style.display   = isDev   ? 'flex' : 'none'
    document.getElementById('nb-dash').style.display  = isDev   ? 'flex' : 'none'
    document.getElementById('btn-qr-ext-todos').style.display = isDev ? 'inline-flex' : 'none'
    document.getElementById('btn-qr-hid-todos').style.display = isDev ? 'inline-flex' : 'none'

    // Verifica primeiro acesso — só para usuários não-admin
    if (perfil?.primeiro_acesso === true && perfil?.nivel !== 'dev' && perfil?.role !== 'admin') {
      document.getElementById('ov-senha').classList.add('on')
    }

    // Verifica sessão a cada 5 segundos
    const intervaloSessao = setInterval(async () => {
      // Se não tem sessão ativa, para o intervalo silenciosamente
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { clearInterval(intervaloSessao); return }

      const { verificarSessao } = await import('./auth.js')
      const valida = await verificarSessao()
      if (!valida) {
        clearInterval(intervaloSessao)
        toast('⚠️ Sessão encerrada em outro dispositivo.')
        setTimeout(async () => {
          const { logout } = await import('./auth.js')
          await logout()
        }, 2000)
      }
    }, 5000)

    await Promise.all([carregarExt(), carregarHid(), carregarEmpresas()])
    irPg('ext')
    verificarQRScan()

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
  const pgAnterior = curPg
  curPg = p
  if (p === 'ext' || p === 'hid') ultimaAbaRelevante = p

  document.querySelectorAll('.pg').forEach(el => el.classList.remove('on'))
  document.getElementById('pg-' + p)?.classList.add('on')
  document.querySelectorAll('.bnav button').forEach(b => {
    b.classList.toggle('on', b.dataset.pg === p)
  })
  document.getElementById('fab').style.display = (p === 'ext' || p === 'hid') ? 'flex' : 'none'

  // Seleciona filtro de relatório automaticamente baseado na última aba relevante
  if (p === 'rel') {
    const veioDeHid = ultimaAbaRelevante === 'hid'
    const filtroAuto = veioDeHid ? 'hid-todos' : 'ext-todos'
    document.querySelectorAll('.btn-rel-opt').forEach(b => {
      b.classList.toggle('on', b.dataset.rel === filtroAuto)
    })
    relFiltro = filtroAuto

    // Mostra só a seção relevante
    document.getElementById('rel-secao-ext').style.display = veioDeHid ? 'none' : 'block'
    document.getElementById('rel-secao-hid').style.display = veioDeHid ? 'block' : 'none'
    document.getElementById('rel-titulo-pg').textContent = veioDeHid ? '📋 Relatório — Hidrantes' : '📋 Relatório — Extintores'
  }

  if (p === 'ext') renderExt()
  if (p === 'hid') renderHid()
  if (p === 'rel') renderRel()
  if (p === 'adm')  renderAdm()
  if (p === 'ocr')  renderOcr()
  if (p === 'dash') renderDash()
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
// ═══════════════════════════════════════
// RELATÓRIO — SELEÇÃO DE FILTRO
// ═══════════════════════════════════════

document.querySelectorAll('.btn-rel-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.btn-rel-opt').forEach(b => b.classList.remove('on'))
    btn.classList.add('on')
    relFiltro = btn.dataset.rel
    renderRel()
  })
})

document.getElementById('btn-rel-dl').addEventListener('click', () => {
  baixarRelatorio(EXT, HID, perfil?.nome || '—', relFiltro)
  toast('📄 Relatório gerado!', 'ok')
})
document.getElementById('btn-rel-ver').addEventListener('click', () => {
  abrirRelatorio(EXT, HID, perfil?.nome || '—', relFiltro)
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
  const ap   = EXT.filter(e => e.cls === 'AP').length
  const bc   = EXT.filter(e => e.cls === 'BC').length
  const abc  = EXT.filter(e => e.cls === 'ABC').length
  const co2  = EXT.filter(e => e.cls === 'CO₂').length

  document.getElementById('st-ext').innerHTML =
    mkSt('Total', EXT.length, 'cadastrados', '') +
    mkSt('Em dia', ok, 'OK', 'cg') +
    mkSt('Atenção', warn, '60 dias', 'ca') +
    mkSt('Vencidos', venc, 'urgente', 'cr') +
    mkSt('Manutenção', man, 'fora serviço', 'co') +
    `<div class="sc" style="border-color:#EBF5FB"><div class="sl">AP</div><div class="sv" style="color:#1A5276">${ap}</div><div class="ss">água pressurizada</div></div>` +
    `<div class="sc" style="border-color:#FEF9E7"><div class="sl">BC</div><div class="sv" style="color:#7D6608">${bc}</div><div class="ss">pó químico BC</div></div>` +
    `<div class="sc" style="border-color:#EAFAF1"><div class="sl">ABC</div><div class="sv" style="color:#1E8449">${abc}</div><div class="ss">pó químico ABC</div></div>` +
    `<div class="sc" style="border-color:#F4ECF7"><div class="sl">CO₂</div><div class="sv" style="color:#6C3483">${co2}</div><div class="ss">gás carbônico</div></div>`
}
function stHid() {
  const ok      = HID.filter(h => getStatusHid(h.checklist) === 'ok').length
  const pending = HID.filter(h => getStatusHid(h.checklist) === 'danger').length
  document.getElementById('st-hid').innerHTML =
    mkSt('Total', HID.length, 'cadastrados', '') +
    mkSt('Checklist OK', ok, 'últimos 30 dias', 'cg') +
    mkSt('Pendente', pending, '30 dias', 'cr')
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
  const isAdminLocal = perfil?.nivel === 'dev' || perfil?.nivel === 'admin' || perfil?.role === 'admin'
  el.innerHTML = data.map(e => {
    const s = getStatus(e.validade, e.em_manut)
    const manBtn = e.em_manut
      ? `<button class="bmr" data-id="${e.id}" data-act="ret">✅ Retornou</button>`
      : `<button class="bmo" data-id="${e.id}" data-act="man">🔧 Manutenção</button>`
    const delBtn = isAdminLocal ? `<button class="bd" data-id="${e.id}" data-act="del-ext">🗑️</button>` : ''
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
        <div class="cf"><div class="fl">Última Recarga</div><div class="fv">${fmm(e.ult_recarga)}</div></div>
        <div class="cf"><div class="fl">Próxima Recarga</div><div class="fv">${fmm(e.validade)}</div></div>
        <div class="cf"><div class="fl">Último Teste Hid.</div><div class="fv">${e.hdt||'—'}</div></div>
        <div class="cf"><div class="fl">Próximo Teste Hid.</div><div class="fv">${e.troca||'—'}</div></div>
        <div class="cf"><div class="fl">Nº Laudo Hid.</div><div class="fv">${e.hnum||'—'}</div></div>
        <div class="cf"><div class="fl">Ano Fabricação</div><div class="fv">${e.fab||'—'}</div></div>
        <div class="cf"><div class="fl">Nº Lacre</div><div class="fv">${e.lacre||'—'}</div></div>
        <div class="cf"><div class="fl">Empresa</div><div class="fv">${e.empresa||'—'}</div></div>
        ${e.obs ? `<div class="cf full"><div class="fl">Obs.</div><div class="fv">${e.obs}</div></div>` : ''}
      </div>
      <div class="cupd"><span>👤 ${e.upd_by||'—'}</span><span>🕐 ${fdt(e.upd_at)}</span></div>
      <div class="cact">
        <button class="be" data-id="${e.id}" data-act="edit-ext">✏️ Editar</button>
        <button class="be" data-id="${e.id}" data-num="${e.num}" data-act="qr-ext" style="display:${isDev?'':'none'}">📱 QR</button>
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
      if (act === 'qr-ext')   abrirQR(btn.dataset.num, 'ext')
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
    const s = getStatusHid(h.checklist)
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
  const isAdminH = perfil?.nivel === 'dev' || perfil?.nivel === 'admin' || perfil?.role === 'admin'
  el.innerHTML = data.map(h => {
    const s = getStatusHid(h.checklist)
    const fotoHtml = h.foto_url ? `<button class="btn bout bsm" style="margin-bottom:8px;font-size:11px" onclick="verFoto('${h.foto_url}','${h.num}')">📷 Ver Foto</button>` : ''
    const delBtn = isAdminH ? `<button class="bd" data-id="${h.id}" data-act="del-hid">🗑️ Excluir</button>` : ''
    return `<div class="card ${s}">
      ${fotoHtml}
      <div class="chead"><div class="cnum">${h.num}</div><div class="cbadges">${stBadgeHid(s)}</div></div>
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
        <button class="be" data-id="${h.id}" data-num="${h.num}" data-act="qr-hid" style="display:${isDev?'':'none'}">📱 QR</button>
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
      if (btn.dataset.act === 'qr-hid')   abrirQR(btn.dataset.num, 'hid')
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
    'Almoxarifado','Ambulatório Bucomaxilo','Anatomia','APC','Auditório',
    'Banco de Leite','Banco de Sangue',
    'Centro Cirúrgico Externo','Centro Cirúrgico Interno',
    'Centro Obstétrico Externo','Centro Obstétrico Interno',
    'CME Externo','CME Interno','Copa — Centro Cirúrgico','Copa dos Vigilantes',
    'Corredor Central','Corredor da Administração',
    'Corredor — Fisioterapia e Anatomia',
    'Corredor — Pronto-Socorro Infantil','Corredor — Pronto-Socorro / Triagem',
    'Espaço Lúdico e Gerência de Emergências — PS','Farmácia','Fisioterapia',
    'Hall Elevador — Bloco A','Hall Elevador — Bloco B','Hall Elevador — Bloco C',
    'Hotelaria','Jardim da Odontologia','Laboratório','Núcleo de Mobilidade (NUMOB)',
    'Observação Feminina — Pronto-Socorro','Observação Masculina — Pronto-Socorro',
    'Radiologia','Recepção — Ambulatório','Recepção do Laboratório',
    'Recepção — Pronto-Socorro','Refeitório','Salão do Auditório','UTI Neonatal'
  ],
  andar: [
    'Corredor Sul','Corredor AB','Corredor BC','Corredor Norte',
    'Hall Elevador — Bloco A','Hall Elevador — Bloco B','Hall Elevador — Bloco C'
  ],
  torre: ['Torre A','Torre B','Torre C'],
  mezanino: ['Ala Norte','Ala Sul'],
  subsolo: [
    'Casa de Bombas','Corredor — Grupo Gerador','Corredor — Subestação',
    'Quadros Gerais de Distribuição Elétrica','Sala de Nobreak'
  ],
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
  else if (andar === 'subsolo')  lista = LOCAIS.subsolo
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
  'Torre':'torre','Mezanino':'mezanino','Subsolo':'subsolo','Área Externa':'externa'
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
  ;['ef-num','ef-cls','ef-cap','ef-mk','ef-andar','ef-setor','ef-desc',
    'ef-ult-recarga','ef-val','ef-troca','ef-hdt','ef-hnum',
    'ef-fab','ef-lacre','ef-obs'
  ].forEach(id => sv(id,''))
  popularSelectEmpresas()
  document.getElementById('ef-foto').value = ''
  document.getElementById('ef-foto-preview').style.display = 'none'
  abrirOv('ov-ext')
}

document.getElementById('ef-empresa').addEventListener('change', async function() {
  if (this.value === '__nova__') {
    const nome = prompt('Digite o nome da nova empresa:')
    if (nome && nome.trim()) {
      try {
        const nova = await inserirEmpresa(nome)
        await carregarEmpresas()
        sv('ef-empresa', nova.nome)
        toast('✅ Empresa cadastrada!', 'ok')
      } catch(e) {
        toast('Erro: ' + e.message, 'err')
        sv('ef-empresa', '')
      }
    } else {
      sv('ef-empresa', '')
    }
  }
})

document.getElementById('btn-salva-ext').addEventListener('click', async () => {
  if (isModoTeste()) return
  const btn = document.getElementById('btn-salva-ext')
  if (btn.disabled) return
  btn.disabled = true
  btn.textContent = '⏳ Salvando…'

  try {
    const numRaw = gv('ef-num').trim()
    const cls    = gv('ef-cls')
    const val    = gv('ef-val')
    const setor  = document.getElementById('ef-setor').value

    if (!numRaw||!cls||!setor||!val) { toast('⚠️ Preencha os campos obrigatórios'); return }

    const num = 'EXT-' + String(parseInt(numRaw,10)).padStart(3,'0')
    const capRaw = gv('ef-cap').replace(/[^0-9.,]/g,'').trim()
    const cap = capRaw ? (cls === 'AP' ? capRaw + 'L' : capRaw + 'KG') : ''
    const loc = montarLocal('ext')

    const duplicado = EXT.find(e => e.num === num && e.id !== editExtId)
    if (duplicado) { toast('⚠️ Já existe um extintor com o número ' + num); return }

    const payload = {
      num, cls, loc, validade: val,
      cap, mk: gv('ef-mk'), descricao: gv('ef-desc'),
      ult_recarga: gv('ef-ult-recarga'),
      troca: gv('ef-troca'), hdt: gv('ef-hdt'), hnum: gv('ef-hnum'),
      fab: gv('ef-fab'), lacre: gv('ef-lacre'), empresa: gv('ef-empresa').toUpperCase().trim(),
      obs: gv('ef-obs'),
      upd_by: perfil?.nome || '—'
    }

    let saved
    if (editExtId) {
      saved = await atualizarExtintor(editExtId, payload)
      toast('✅ Extintor atualizado!', 'ok')
    } else {
      saved = await inserirExtintor({ ...payload, em_manut: false, manut_hist: [] })
      toast('✅ Extintor cadastrado!', 'ok')
    }
    const fotoUrl = await uploadFoto('ext', saved.id)
    if (fotoUrl) await atualizarExtintor(saved.id, { foto_url: fotoUrl })
    fecharOv('ov-ext'); await carregarExt()
  } catch(e) { toast('Erro: ' + e.message, 'err') }
  finally {
    btn.disabled = false
    btn.textContent = '💾 Salvar'
  }
})

function editExt(id) {
  const e = EXT.find(x => x.id === id); if (!e) return
  editExtId = id
  document.getElementById('tit-ext').textContent = 'Editar Extintor'
  // Remove prefixo EXT- para edição
  const numEdit = (e.num || '').replace('EXT-','').replace(/^0+/,'') || ''
  sv('ef-num', numEdit)
  // Remove sufixo L ou KG da capacidade para edição
  const capEdit = (e.cap || '').replace('KG','').replace('L','')
  sv('ef-cap', capEdit)
  const loc = separarLocal(e.loc)
  sv('ef-andar', loc.andar)
  filtrarSetor('ext')
  setTimeout(function(){ sv('ef-setor', loc.setor) }, 50)
  sv('ef-desc', e.descricao); sv('ef-val', e.validade)
  sv('ef-ult-recarga', e.ult_recarga)
  sv('ef-hdt', e.hdt)
  sv('ef-troca', e.troca)
  sv('ef-hnum', e.hnum)
  sv('ef-fab', e.fab); sv('ef-lacre', e.lacre)
  popularSelectEmpresas()
  sv('ef-empresa', e.empresa)
  sv('ef-obs', e.obs)
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
  document.getElementById('hf-foto').value = ''
  document.getElementById('hf-foto-preview').style.display = 'none'
  abrirOv('ov-hid')
}

document.getElementById('btn-salva-hid').addEventListener('click', async () => {
  if (isModoTeste()) return
  const btn = document.getElementById('btn-salva-hid')
  if (btn.disabled) return
  btn.disabled = true
  btn.textContent = '⏳ Salvando…'

  const reativar = () => { btn.disabled = false; btn.textContent = '💾 Salvar' }

  try {
    const numRawH = gv('hf-num').trim(), tp = gv('hf-tp'), pi = gv('hf-pi')
    const setor   = document.getElementById('hf-setor').value

    if (!numRawH||!tp||!setor) { toast('⚠️ Preencha os campos obrigatórios'); reativar(); return }

    const num = 'HID-' + String(parseInt(numRawH,10)).padStart(3,'0')
    const loc = montarLocal('hid')

    const duplicadoH = HID.find(h => h.num === num && h.id !== editHidId)
    if (duplicadoH) { toast('⚠️ Já existe um hidrante com o número ' + num); reativar(); return }

    const payload = {
      num, tp, loc, pi,
      mk:gv('hf-mk'), dm:gv('hf-dm'), descricao:gv('hf-desc'),
      ui:gv('hf-ui'), pt:gv('hf-pt'), pv:gv('hf-pv'), obs:gv('hf-obs'),
      upd_by: perfil?.nome || '—'
    }

    let saved
    const eraNovo = !editHidId
    if (editHidId) { saved = await atualizarHidrante(editHidId, payload); toast('✅ Hidrante atualizado!', 'ok') }
    else           { saved = await inserirHidrante(payload);               toast('✅ Hidrante cadastrado!', 'ok') }
    const fotoUrl = await uploadFoto('hid', saved.id)
    if (fotoUrl) await atualizarHidrante(saved.id, { foto_url: fotoUrl })
    fecharOv('ov-hid'); await carregarHid()

    // Se for cadastro novo, abre o checklist automaticamente
    if (eraNovo) {
      setTimeout(() => {
        toast('📋 Agora vamos fazer o primeiro checklist!', 'ok')
        abrirChecklist(saved.id)
      }, 600)
    }
  } catch(e) { toast('Erro: ' + e.message, 'err') }
  finally {
    btn.disabled = false
    btn.textContent = '💾 Salvar'
  }
})

function editHid(id) {
  const h = HID.find(x => x.id === id); if (!h) return
  editHidId = id
  document.getElementById('tit-hid').textContent = 'Editar Hidrante'
  // Remove prefixo HID- para edição
  const numEditH = (h.num || '').replace('HID-','').replace(/^0+/,'') || ''
  sv('hf-num', numEditH)
  sv('hf-tp',h.tp); sv('hf-mk',h.mk); sv('hf-dm',h.dm)
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
  const f    = relFiltro || 'ext-todos'

  // Filtra dados conforme seleção
  let extFiltrados = EXT
  let hidFiltrados = HID
  let titulo = 'Relatório Completo'

  if (f === 'ext-todos') { hidFiltrados = []; titulo = '🧯 Todos os Extintores' }
  else if (f === 'ext-venc')  { extFiltrados = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'danger'); hidFiltrados = []; titulo = '🔴 Extintores Vencidos' }
  else if (f === 'ext-warn')  { extFiltrados = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'warn'); hidFiltrados = []; titulo = '⚠️ Extintores com Atenção' }
  else if (f === 'ext-manut') { extFiltrados = EXT.filter(e => e.em_manut); hidFiltrados = []; titulo = '🔧 Extintores em Manutenção' }
  else if (f === 'ext-ap')    { extFiltrados = EXT.filter(e => e.cls === 'AP'); hidFiltrados = []; titulo = '🔵 Extintores AP' }
  else if (f === 'ext-bc')    { extFiltrados = EXT.filter(e => e.cls === 'BC'); hidFiltrados = []; titulo = '🟡 Extintores BC' }
  else if (f === 'ext-abc')   { extFiltrados = EXT.filter(e => e.cls === 'ABC'); hidFiltrados = []; titulo = '🟢 Extintores ABC' }
  else if (f === 'ext-co2')   { extFiltrados = EXT.filter(e => e.cls === 'CO₂'); hidFiltrados = []; titulo = '🟣 Extintores CO₂' }
  else if (f === 'hid-todos') { extFiltrados = []; titulo = '💧 Todos os Hidrantes' }
  else if (f === 'hid-pend')  { extFiltrados = []; hidFiltrados = HID.filter(h => getStatusHid(h.checklist) === 'danger'); titulo = '🔴 Hidrantes com Checklist Pendente' }
  else if (f === 'hid-conf')  { extFiltrados = []; hidFiltrados = HID.filter(h => { let hist = h.checklist; if(typeof hist==='string'){try{hist=JSON.parse(hist)}catch(e){return false}} if(!Array.isArray(hist)||!hist.length) return false; const ult=hist[hist.length-1]; return ['Ruim','Regular','Ausente'].some(v=>[ult.mang1,ult.mang2,ult.chave,ult.esguicho,ult.abrigo,ult.registro,ult.lacre].includes(v)) }); titulo = '⚠️ Hidrantes Fora de Conformidade' }

  const eOk   = extFiltrados.filter(e => getStatus(e.validade, e.em_manut) === 'ok')
  const eWarn = extFiltrados.filter(e => getStatus(e.validade, e.em_manut) === 'warn')
  const eVenc = extFiltrados.filter(e => getStatus(e.validade, e.em_manut) === 'danger')
  const eMan  = extFiltrados.filter(e => e.em_manut)
  const hVenc = hidFiltrados.filter(h => getStatusHid(h.checklist) === 'danger')
  const hOk   = hidFiltrados.filter(h => getStatusHid(h.checklist) === 'ok')

  let h = `<div style="background:#7B241C;color:#fff;border-radius:12px;padding:14px;margin-bottom:14px">
    <div style="font-size:9px;opacity:.6;text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px">Hospital Regional de Santa Maria</div>
    <div style="font-size:16px;font-weight:700;margin-bottom:5px">${titulo}</div>
    <div style="font-size:11px;opacity:.8">📅 ${now} &nbsp;|&nbsp; 👤 ${nome}</div>
  </div>`

  const isExtFiltro = f.startsWith('ext')
  const isHidFiltro = f.startsWith('hid')

  let statsHtml = ''
  if (isExtFiltro) {
    statsHtml += mkSt('Extintores',extFiltrados.length,'total','') +
      mkSt('OK',eOk.length,'em dia','cg') +
      mkSt('Atenção',eWarn.length,'60 dias','ca') +
      mkSt('Vencidos',eVenc.length,'urgente','cr') +
      mkSt('Manutenção',eMan.length,'fora serviço','co')
  }
  if (isHidFiltro) {
    statsHtml += mkSt('Hidrantes',hidFiltrados.length,'total','') +
      mkSt('Checklist OK',hOk.length,'30 dias','cg') +
      mkSt('Pendente',hVenc.length,'30 dias','cr')
  }

  h += `<div class="stats" style="margin-bottom:13px">${statsHtml}</div>`

  // Manutenção — só para extintores
  if (isExtFiltro) {
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
  } // fim isExtFiltro

  if (isHidFiltro && hVenc.length) {
    h += `<div class="rcard"><div class="rhdr rdanger">🔴 Hidrantes — Checklist Pendente (${hVenc.length})</div>`
    sortByNum(hVenc).forEach(hh => {
      h += `<div class="rrow"><div class="rnum">${hh.num}</div><div class="rloc">${hh.tp}<br>${hh.loc}</div><div><div class="rby">${hh.upd_by||'—'}</div></div></div>`
    })
    h += `</div>`
  }

  if (isExtFiltro && extFiltrados.length > 0) {
    h += `<div class="rcard"><div class="rhdr rok">📋 Extintores (${extFiltrados.length})</div>`
    sortByNum(extFiltrados).forEach(e => {
      const s = getStatus(e.validade, e.em_manut)
      h += `<div class="rrow"><div><div class="rnum">${e.num}</div>${clsBadge(e.cls)}${e.em_manut?'<br><span style="font-size:9px;color:var(--orange);font-weight:700">MANUT.</span>':''}</div><div class="rloc">${e.loc}<br><span style="font-size:10px">${e.mk||''}</span></div><div>${stBadge(s)}<div class="rdt">${fmm(e.validade)}</div><div class="rby">${e.upd_by||'—'}</div></div></div>`
    })
    h += `</div>`
  }

  if (hidFiltrados.length > 0) {
    h += `<div class="rcard"><div class="rhdr rok">📋 Hidrantes (${hidFiltrados.length})</div>`
    sortByNum(hidFiltrados).forEach(hh => {
      const s = getStatusHid(hh.checklist)
      h += `<div class="rrow"><div class="rnum">${hh.num}</div><div class="rloc">${hh.tp}<br>${hh.loc}</div><div>${stBadgeHid(s)}<div class="rby">${hh.upd_by||'—'}</div></div></div>`
    })
    h += `</div>`
  }

  if (!extFiltrados.length && !hidFiltrados.length) {
    h += `<div class="empty"><div class="ei">✅</div><p>Nenhum item encontrado para este filtro.</p></div>`
  }

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
  document.getElementById('chk-foto').value = ''
  document.getElementById('chk-foto-preview').style.display = 'none'

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
        ${ins.hid1_ult ? `<div style="font-size:10px;color:var(--muted);margin-top:4px">🔧 Mang.1 — Último teste: <b>${fmm(ins.hid1_ult)}</b>${ins.hid1_prox ? ` · Próximo: <b>${fmm(ins.hid1_prox)}</b>` : ''}</div>` : ''}
        ${ins.hid2_ult ? `<div style="font-size:10px;color:var(--muted)">🔧 Mang.2 — Último teste: <b>${fmm(ins.hid2_ult)}</b>${ins.hid2_prox ? ` · Próximo: <b>${fmm(ins.hid2_prox)}</b>` : ''}</div>` : ''}
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
  if (isModoTeste()) return
  const h = HID.find(x => x.id === chkId)
  if (!h) return

  const data = document.getElementById('chk-data').value
  if (!data) { toast('⚠️ Informe a data da inspeção'); return }

  // Exige foto atualizada
  const fotoFile = document.getElementById('chk-foto').files[0]
  if (!fotoFile) { toast('⚠️ Tire uma foto atualizada do hidrante'); return }

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
    // Upload da nova foto — atualiza foto principal do hidrante
    const ext  = fotoFile.name.split('.').pop()
    const path = 'hid/' + chkId + '.' + ext
    const { error: upErr } = await supabase.storage.from('fotos').upload(path, fotoFile, { upsert: true })
    if (upErr) throw upErr
    const { data: pub } = supabase.storage.from('fotos').getPublicUrl(path)

    await atualizarHidrante(chkId, {
      checklist: hist,
      foto_url: pub.publicUrl,
      upd_by: perfil?.nome || '—'
    })
    toast('✅ Checklist e foto salvos!', 'ok')
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
      const ehMaster = u.email === 'maurilio.mas@gmail.com'
      const bloq  = u.bloqueado
      const nivelLabel = u.nivel === 'dev' ? '👑 Desenvolvedor' : u.nivel === 'admin' ? '🔑 Administrador' : '👤 Usuário'
      h += `<div class="urow">
        <div class="uav2" style="${bloq ? 'background:#FADBD8;color:#C0392B' : ''}">${(u.nome||'?').charAt(0).toUpperCase()}</div>
        <div class="uinfo">
          <div class="un">
            ${u.nome||'—'}
            ${bloq ? '<span style="font-size:10px;color:#C0392B;font-weight:700;margin-left:6px">🔒 BLOQUEADO</span>' : ''}
            ${ehEu ? '<span style="font-size:10px;color:#1A5276;font-weight:700;margin-left:6px">VOCÊ</span>' : ''}
          </div>
          <div class="ul" style="display:flex;flex-direction:column;gap:2px">
            <span>${nivelLabel}</span>
            <span style="font-size:10px;color:${st.cor}">${st.label}</span>
          </div>
        </div>
        ${!ehEu && !ehMaster ? `
        <div style="display:flex;flex-direction:column;gap:5px">
          <button class="udel" data-uid="${u.id}" data-nome="${u.nome||''}" 
            style="height:30px;padding:0 10px;border:1.5px solid var(--redl);background:var(--redl);color:var(--red);border-radius:7px;cursor:pointer;font-size:11px;font-weight:600">
            🗑️ Excluir
          </button>
          <button class="ubloq" data-uid="${u.id}" data-nome="${u.nome||''}" data-bloq="${bloq}"
            style="height:30px;padding:0 10px;border:1.5px solid ${bloq?'var(--greenl)':'var(--amberl)'};background:${bloq?'var(--greenl)':'var(--amberl)'};color:${bloq?'var(--green)':'var(--amber)'};border-radius:7px;cursor:pointer;font-size:11px;font-weight:600">
            ${bloq ? '🔓 Desbloquear' : '🔒 Bloquear'}
          </button>
        </div>` : ehMaster ? `<span style="font-size:10px;color:var(--muted);font-style:italic">🛡️ Protegido</span>` : ''}
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
  if (isModoTeste()) return
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
// ═══════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════
async function renderDash() {
  const el = document.getElementById('dash-body')
  if (perfil?.email !== 'maurilio.mas@gmail.com') {
    el.innerHTML = '<div class="empty"><p>Acesso restrito.</p></div>'
    return
  }

  const now = new Date()
  const mes = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  // Status extintores
  const eOk   = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'ok').length
  const eWarn = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'warn').length
  const eVenc = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'danger').length
  const eMan  = EXT.filter(e => e.em_manut).length
  const eTotal = EXT.length

  // Por classe
  const ap  = EXT.filter(e => e.cls === 'AP').length
  const bc  = EXT.filter(e => e.cls === 'BC').length
  const abc = EXT.filter(e => e.cls === 'ABC').length
  const co2 = EXT.filter(e => e.cls === 'CO₂').length

  // Hidrantes
  const hOk   = HID.filter(h => getStatusHid(h.checklist) === 'ok').length
  const hPend = HID.filter(h => getStatusHid(h.checklist) === 'danger').length
  const hTotal = HID.length

  // Ocorrências do mês
  let ocrMes = 0
  try {
    const ocrs = await listarOcorrencias()
    ocrMes = ocrs.filter(o => {
      const d = new Date(o.data_hora)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  } catch(e) {}

  // Próximos vencimentos (extintores)
  const proxVenc = EXT
    .filter(e => e.validade && !e.em_manut)
    .map(e => {
      const [y, m] = e.validade.split('-').map(Number)
      const diff = (y * 12 + m - 1) - (now.getFullYear() * 12 + now.getMonth())
      return { ...e, diff }
    })
    .filter(e => e.diff >= 0 && e.diff <= 3)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 5)

  // Gráfico de rosca — status extintores
  function rosca(total, vals) {
    if (!total) return `<svg viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="35" fill="none" stroke="#eee" stroke-width="18"/><text x="50" y="55" text-anchor="middle" font-size="14" fill="#888">0</text></svg>`
    let offset = 25
    const r = 35, circ = 2 * Math.PI * r
    const segs = vals.map(v => {
      const pct = v.val / total
      const dash = pct * circ
      const gap  = circ - dash
      const seg  = `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${v.cor}" stroke-width="18" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)"/>`
      offset += pct * circ
      return seg
    })
    return `<svg viewBox="0 0 100 100" width="100" height="100">${segs.join('')}<text x="50" y="52" text-anchor="middle" font-size="18" font-weight="bold" fill="#333">${total}</text><text x="50" y="64" text-anchor="middle" font-size="8" fill="#888">total</text></svg>`
  }

  // Gráfico de barras — classes
  function barras(dados) {
    const max = Math.max(...dados.map(d => d.val), 1)
    const barW = 32, gap = 10, h = 80
    const w = dados.length * (barW + gap)
    const bars = dados.map((d, i) => {
      const bh = (d.val / max) * (h - 20)
      const x  = i * (barW + gap)
      const y  = h - 20 - bh
      return `
        <rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="4" fill="${d.cor}"/>
        <text x="${x + barW/2}" y="${h - 8}" text-anchor="middle" font-size="9" fill="#888">${d.label}</text>
        <text x="${x + barW/2}" y="${y - 4}" text-anchor="middle" font-size="11" font-weight="bold" fill="${d.cor}">${d.val}</text>
      `
    }).join('')
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${bars}</svg>`
  }

  const svgStatus = rosca(eTotal, [
    { val: eOk,   cor: '#1E8449' },
    { val: eWarn, cor: '#D68910' },
    { val: eVenc, cor: '#C0392B' },
    { val: eMan,  cor: '#E67E22' },
  ])

  const svgClasses = barras([
    { label: 'AP',   val: ap,  cor: '#1A5276' },
    { label: 'BC',   val: bc,  cor: '#7D6608' },
    { label: 'ABC',  val: abc, cor: '#1E8449' },
    { label: 'CO₂',  val: co2, cor: '#6C3483' },
  ])

  const svgHid = rosca(hTotal, [
    { val: hOk,   cor: '#1E8449' },
    { val: hPend, cor: '#C0392B' },
  ])

  el.innerHTML = `
  <div style="font-size:11px;color:var(--muted);margin-bottom:12px">📅 ${mes}</div>

  <!-- CARDS RESUMO -->
  <div class="stats" style="margin-bottom:16px">
    ${mkSt('Extintores', eTotal, 'total', '')}
    ${mkSt('Em dia', eOk, 'OK', 'cg')}
    ${mkSt('Atenção', eWarn, '60 dias', 'ca')}
    ${mkSt('Vencidos', eVenc, 'urgente', 'cr')}
    ${mkSt('Hidrantes', hTotal, 'total', '')}
    ${mkSt('Checklist OK', hOk, '30 dias', 'cg')}
    ${mkSt('Pendente', hPend, '30 dias', 'cr')}
    ${mkSt('Ocorrências', ocrMes, '30 dias', '')}
  </div>

  <!-- GRÁFICOS -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">

    <div class="rcard">
      <div class="rhdr rinfo">🧯 Status dos Extintores</div>
      <div style="padding:14px;display:flex;align-items:center;gap:16px">
        ${svgStatus}
        <div style="font-size:12px;display:flex;flex-direction:column;gap:6px">
          <div><span style="color:#1E8449;font-weight:700">${eOk}</span> Em dia</div>
          <div><span style="color:#D68910;font-weight:700">${eWarn}</span> Atenção</div>
          <div><span style="color:#C0392B;font-weight:700">${eVenc}</span> Vencidos</div>
          <div><span style="color:#E67E22;font-weight:700">${eMan}</span> Manutenção</div>
        </div>
      </div>
    </div>

    <div class="rcard">
      <div class="rhdr rinfo">💧 Hidrantes — Checklist</div>
      <div style="padding:14px;display:flex;align-items:center;gap:16px">
        ${svgHid}
        <div style="font-size:12px;display:flex;flex-direction:column;gap:6px">
          <div><span style="color:#1E8449;font-weight:700">${hOk}</span> Checklist OK</div>
          <div><span style="color:#C0392B;font-weight:700">${hPend}</span> Pendentes</div>
        </div>
      </div>
    </div>

  </div>

  <div class="rcard" style="margin-bottom:16px">
    <div class="rhdr rinfo">🧯 Extintores por Classe</div>
    <div style="padding:14px;display:flex;justify-content:center">${svgClasses}</div>
  </div>

  <!-- PRÓXIMOS VENCIMENTOS -->
  <div class="rcard">
    <div class="rhdr rwarn">⚠️ Próximos Vencimentos (até 3 meses)</div>
    ${proxVenc.length ? proxVenc.map(e => `
      <div class="rrow">
        <div><div class="rnum">${e.num}</div>${clsBadge(e.cls)}</div>
        <div class="rloc">${e.loc}</div>
        <div><div class="rdt" style="color:var(--amber)">${fmm(e.validade)}</div><div class="rby">${e.diff === 0 ? 'Este mês' : `Em ${e.diff} mês${e.diff > 1 ? 'es' : ''}`}</div></div>
      </div>`).join('') : '<div class="na">✅ Nenhum vencimento nos próximos 3 meses.</div>'}
  </div>

  <!-- MAPA DE CALOR POR ANDAR -->
  <div class="rcard" style="margin-bottom:16px">
    <div class="rhdr rinfo">🗺️ Mapa de Calor — Status por Andar</div>
    <div style="padding:12px;display:flex;flex-direction:column;gap:8px">
      ${(() => {
        const andares = [
          { key: 'Térreo', label: 'Térreo' },
          { key: '1º Andar', label: '1º Andar' },
          { key: '2º Andar', label: '2º Andar' },
          { key: '3º Andar', label: '3º Andar' },
          { key: '4º Andar', label: '4º Andar' },
          { key: '5º Andar', label: '5º Andar' },
          { key: 'Torre', label: 'Torre' },
          { key: 'Mezanino', label: 'Mezanino' },
          { key: 'Subsolo', label: 'Subsolo' },
          { key: 'Área Externa', label: 'Área Externa' },
        ]

        return andares.map(a => {
          const extAndar = EXT.filter(e => e.loc && e.loc.startsWith(a.key))
          const hidAndar = HID.filter(h => h.loc && h.loc.startsWith(a.key))
          if (!extAndar.length && !hidAndar.length) return ''

          const eOk   = extAndar.filter(e => getStatus(e.validade, e.em_manut) === 'ok').length
          const eWarn = extAndar.filter(e => getStatus(e.validade, e.em_manut) === 'warn').length
          const eVenc = extAndar.filter(e => getStatus(e.validade, e.em_manut) === 'danger').length
          const hOk   = hidAndar.filter(h => getStatusHid(h.checklist) === 'ok').length
          const hPend = hidAndar.filter(h => getStatusHid(h.checklist) === 'danger').length

          const total = extAndar.length + hidAndar.length
          const prob  = eWarn + eVenc + hPend
          const pctOk = total > 0 ? ((total - prob) / total) * 100 : 100

          const cor = pctOk === 100 ? '#1E8449' : pctOk >= 70 ? '#D68910' : '#C0392B'
          const corBg = pctOk === 100 ? '#EAFAF1' : pctOk >= 70 ? '#FEF9E7' : '#FADBD8'

          return `<div style="display:grid;grid-template-columns:90px 1fr auto;gap:8px;align-items:center">
            <span style="font-size:11px;color:var(--ink2);font-weight:600">${a.label}</span>
            <div style="height:24px;border-radius:6px;background:${corBg};position:relative;overflow:hidden">
              <div style="height:100%;width:${pctOk}%;background:${cor};border-radius:6px;transition:width .3s"></div>
              <div style="position:absolute;inset:0;display:flex;align-items:center;padding:0 8px;font-size:10px;color:#333;font-weight:500">
                🧯 ${extAndar.length} · 💧 ${hidAndar.length}
                ${prob > 0 ? `<span style="margin-left:6px;color:${cor};font-weight:700">${prob} pendente${prob > 1 ? 's' : ''}</span>` : ''}
              </div>
            </div>
            <span style="font-size:10px;font-weight:700;color:${cor}">${Math.round(pctOk)}%</span>
          </div>`
        }).filter(Boolean).join('')
      })()}
    </div>
  </div>`
}

// ═══════════════════════════════════════
// OCORRÊNCIAS
// ═══════════════════════════════════════
async function renderOcr() {
  const el = document.getElementById('ocr-body')
  if (perfil?.email !== 'maurilio.mas@gmail.com') {
    el.innerHTML = '<div class="empty"><p>Acesso restrito.</p></div>'
    return
  }
  el.innerHTML = '<div class="loading">Carregando…</div>'
  try {
    OCR = await listarOcorrencias()
    if (!OCR.length) {
      el.innerHTML = '<div class="empty"><div class="ei">🚨</div><p>Nenhuma ocorrência registrada.</p></div>'
      return
    }

    const TIPO_COR = {
      'Atendimento APH': 'var(--blue)',
      'Princípio de Incêndio': 'var(--red)',
      'Vazamento de Gás': 'var(--orange)',
      'Falha em Equipamento': 'var(--amber)',
      'Acionamento de Alarme': 'var(--red)',
      'Evacuação': 'var(--red)',
      'Treinamento / Simulado': 'var(--green)',
      'Outro': 'var(--muted)'
    }

    el.innerHTML = OCR.map(o => {
      const cor = TIPO_COR[o.tipo] || 'var(--muted)'
      const dataFmt = o.data_hora ? new Date(o.data_hora).toLocaleString('pt-BR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'
      return `<div class="card" style="border-left-color:${cor}">
        <div class="chead">
          <div>
            <div class="cnum" style="font-size:14px">${o.tipo}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">🕐 ${dataFmt}</div>
          </div>
        </div>
        <div class="cbody">
          <div class="cf full"><div class="fl">Local</div><div class="fv">${o.loc}</div></div>
          ${o.descricao ? `<div class="cf full"><div class="fl">Descrição</div><div class="fv">${o.descricao}</div></div>` : ''}
          ${o.equipe ? `<div class="cf full"><div class="fl">Equipe</div><div class="fv">${o.equipe}</div></div>` : ''}
          ${o.acoes ? `<div class="cf full"><div class="fl">Ações</div><div class="fv">${o.acoes}</div></div>` : ''}
          ${o.encaminhamento ? `<div class="cf full"><div class="fl">Encaminhamento</div><div class="fv">${o.encaminhamento}</div></div>` : ''}
        </div>
        <div class="cupd"><span>👤 ${o.upd_by||'—'}</span></div>
        <div class="cact">
          <button class="be" data-id="${o.id}" data-act="edit-ocr">✏️ Editar</button>
          <button class="bd" data-id="${o.id}" data-act="del-ocr">🗑️ Excluir</button>
        </div>
      </div>`
    }).join('')

    el.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.act === 'edit-ocr') editOcr(btn.dataset.id)
        if (btn.dataset.act === 'del-ocr')  delOcr(btn.dataset.id)
      })
    })
  } catch(e) {
    el.innerHTML = `<div class="empty"><p>Erro ao carregar.<br><small>${e.message}</small></p></div>`
  }
}

document.getElementById('btn-nova-ocr').addEventListener('click', () => {
  editOcrId = null
  document.getElementById('tit-ocr').textContent = 'Nova Ocorrência'
  ;['ocr-data','ocr-hora','ocr-tipo','ocr-loc','ocr-desc','ocr-equipe','ocr-acoes','ocr-encam'].forEach(id => sv(id,''))
  const hoje = new Date()
  const pad = n => String(n).padStart(2,'0')
  sv('ocr-data', hoje.getFullYear()+'-'+pad(hoje.getMonth()+1)+'-'+pad(hoje.getDate()))
  sv('ocr-hora', pad(hoje.getHours())+':'+pad(hoje.getMinutes()))
  abrirOv('ov-ocr')
})

document.getElementById('btn-salva-ocr').addEventListener('click', async () => {
  if (isModoTeste()) return
  const data = gv('ocr-data'), hora = gv('ocr-hora'), tipo = gv('ocr-tipo'), loc = gv('ocr-loc').trim()
  if (!data||!hora||!tipo||!loc) { toast('⚠️ Preencha os campos obrigatórios'); return }

  const payload = {
    data_hora: new Date(data+'T'+hora).toISOString(),
    tipo, loc,
    descricao: gv('ocr-desc'),
    equipe: gv('ocr-equipe'),
    acoes: gv('ocr-acoes'),
    encaminhamento: gv('ocr-encam'),
    upd_by: perfil?.nome || '—'
  }

  try {
    if (editOcrId) { await atualizarOcorrencia(editOcrId, payload); toast('✅ Ocorrência atualizada!', 'ok') }
    else           { await inserirOcorrencia(payload);                toast('✅ Ocorrência registrada!', 'ok') }
    fecharOv('ov-ocr')
    renderOcr()
  } catch(e) { toast('Erro: ' + e.message, 'err') }
})

function editOcr(id) {
  const o = OCR.find(x => x.id === id); if (!o) return
  editOcrId = id
  document.getElementById('tit-ocr').textContent = 'Editar Ocorrência'
  const d = new Date(o.data_hora)
  const pad = n => String(n).padStart(2,'0')
  sv('ocr-data', d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()))
  sv('ocr-hora', pad(d.getHours())+':'+pad(d.getMinutes()))
  sv('ocr-tipo', o.tipo); sv('ocr-loc', o.loc); sv('ocr-desc', o.descricao)
  sv('ocr-equipe', o.equipe); sv('ocr-acoes', o.acoes); sv('ocr-encam', o.encaminhamento)
  abrirOv('ov-ocr')
}

async function delOcr(id) {
  const o = OCR.find(x => x.id === id); if (!o) return
  const ok = await confirmar('🗑️', 'Excluir ocorrência', `Excluir esta ocorrência de <b>${o.tipo}</b>?`, 'Excluir')
  if (!ok) return
  try { await deletarOcorrencia(id); toast('🗑️ Ocorrência removida.'); renderOcr() }
  catch(e) { toast('Erro: ' + e.message, 'err') }
}

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
// MODO TESTE
// ═══════════════════════════════════════
function isModoTeste() {
  if (perfil?.modo_teste) {
    toast('🔒 Modo demonstração — alterações não permitidas', 'err')
    return true
  }
  return false
}

// ═══════════════════════════════════════
// QR CODE
// ═══════════════════════════════════════
function abrirQR(num, tipo) {
  const url = `${window.location.origin}?scan=${tipo}&num=${encodeURIComponent(num)}`
  document.getElementById('tit-qr').textContent = `QR Code — ${num}`
  document.getElementById('qr-info').textContent = `Escaneie para abrir a ficha do ${tipo === 'ext' ? 'extintor' : 'hidrante'} ${num}`

  const canvas = document.getElementById('qr-canvas')
  canvas.innerHTML = ''
  new QRCode(canvas, {
    text: url,
    width: 200,
    height: 200,
    colorDark: '#7B241C',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.H
  })
  abrirOv('ov-qr')
}

document.getElementById('btn-qr-print').addEventListener('click', () => {
  const titulo = document.getElementById('tit-qr').textContent
  const info   = document.getElementById('qr-info').textContent
  const canvas = document.getElementById('qr-canvas')
  const img    = canvas.querySelector('img') || canvas.querySelector('canvas')
  const src    = img?.src || (img instanceof HTMLCanvasElement ? img.toDataURL() : '')

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>${titulo}</title>
<style>
  body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff }
  .card { border: 2px solid #7B241C; border-radius: 12px; padding: 24px; text-align: center; width: 220px }
  .logo { font-size: 32px; margin-bottom: 8px }
  h2 { color: #7B241C; margin: 0 0 4px; font-size: 18px }
  p { color: #666; font-size: 11px; margin: 0 0 16px }
  img { width: 180px; height: 180px }
  .rodape { margin-top: 12px; font-size: 10px; color: #999 }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">🔥</div>
    <h2>${titulo.replace('QR Code — ', '')}</h2>
    <p>${info}</p>
    <img src="${src}">
    <div class="rodape">Brigada 360 — HRSM</div>
  </div>
  <script>window.onload = () => window.print()<\/script>
</body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 5000)
})

function imprimirTodosQR(lista, tipo) {
  const base = window.location.origin
  const itens = lista.map(item => {
    const url = `${base}?scan=${tipo}&num=${encodeURIComponent(item.num)}`
    return { num: item.num, loc: item.loc, url }
  })

  // Gera QR Codes como Data URLs usando QRCode.js
  const promises = itens.map(item => new Promise(resolve => {
    const div = document.createElement('div')
    new QRCode(div, {
      text: item.url,
      width: 140,
      height: 140,
      colorDark: '#7B241C',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    })
    setTimeout(() => {
      const img = div.querySelector('img') || div.querySelector('canvas')
      const src = img?.src || (img instanceof HTMLCanvasElement ? img.toDataURL() : '')
      resolve({ ...item, src })
    }, 200)
  }))

  Promise.all(promises).then(dados => {
    const etiquetas = dados.map(d => `
      <div class="etiqueta">
        <div class="marca">🔥 BRIGADA 360</div>
        <img src="${d.src}" width="120" height="120">
        <div class="num">${d.num}</div>
        <div class="loc">${d.loc}</div>
      </div>
    `).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>QR Codes — ${tipo === 'ext' ? 'Extintores' : 'Hidrantes'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: Arial, sans-serif; background: #fff }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5mm; padding: 8mm }
    .etiqueta { border: 1.5px solid #7B241C; border-radius: 4mm; padding: 3mm; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2mm; page-break-inside: avoid }
    .marca { font-size: 7pt; font-weight: 700; color: #7B241C; letter-spacing: 0.3px }
    .num { font-size: 11pt; font-weight: 700; color: #7B241C }
    .loc { font-size: 7pt; color: #555; line-height: 1.3 }
    img { width: 110px; height: 110px }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
      @page { size: A4; margin: 5mm }
    }
  </style>
</head>
<body>
  <div class="grid">${etiquetas}</div>
  <script>window.onload = () => window.print()<\/script>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    toast(`📱 ${dados.length} QR Codes gerados!`, 'ok')
  })
}

document.getElementById('btn-qr-ext-todos').addEventListener('click', () => {
  if (!EXT.length) { toast('⚠️ Nenhum extintor cadastrado'); return }
  toast('⏳ Gerando QR Codes...')
  setTimeout(() => imprimirTodosQR(sortByNum(EXT), 'ext'), 100)
})

document.getElementById('btn-qr-hid-todos').addEventListener('click', () => {
  if (!HID.length) { toast('⚠️ Nenhum hidrante cadastrado'); return }
  toast('⏳ Gerando QR Codes...')
  setTimeout(() => imprimirTodosQR(sortByNum(HID), 'hid'), 100)
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
window.filtrarSetor       = filtrarSetor
window.previewFoto        = previewFoto
window.toggleAndar        = toggleAndar
window.verFoto            = verFoto
window.autoUltTeste       = autoUltTeste
window.autoUltMangueira   = autoUltMangueira
window.preencherTudoBom   = preencherTudoBom
window.previewFotoChk     = previewFotoChk

function previewFotoChk() {
  const file = document.getElementById('chk-foto').files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = function(e) {
    document.getElementById('chk-foto-img').src = e.target.result
    document.getElementById('chk-foto-preview').style.display = 'block'
  }
  reader.readAsDataURL(file)
}

function autoUltMangueira(n) {
  const prox = document.getElementById('chk-hid'+n+'-prox').value // YYYY-MM
  if (!prox) return
  const [y, m] = prox.split('-').map(Number)
  const ultAno = y - 1
  document.getElementById('chk-hid'+n+'-ult').value = String(ultAno).padStart(4,'0') + '-' + String(m).padStart(2,'0')
}

function preencherTudoBom() {
  document.getElementById('chk-mang1').value    = 'Bom'
  document.getElementById('chk-mang2').value    = 'Bom'
  document.getElementById('chk-chave').value    = 'Presente'
  document.getElementById('chk-esguicho').value = 'Bom'
  document.getElementById('chk-abrigo').value   = 'Bom'
  document.getElementById('chk-registro').value = 'Bom'
  document.getElementById('chk-lacre').value    = 'Presente'
  toast('✅ Todos os itens preenchidos como Bom!', 'ok')
}

function autoUltTeste() {
  const prox = parseInt(document.getElementById('ef-troca').value)
  if (prox && prox >= 2005) {
    document.getElementById('ef-hdt').value = prox - 5
  }
}

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
