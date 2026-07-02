/** Formata YYYY-MM → Mmm/YYYY */
export function fmm(d) {
  if (!d || d === 'undefined' || d === 'null') return '—'
  const parts = String(d).split('-')
  if (parts.length === 3) {
    const [y, m, dd] = parts
    return dd + '/' + m + '/' + y
  }
  const [y, m] = parts
  if (!m) return y // só ano
  const M = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return (M[parseInt(m, 10) - 1] || m) + '/' + y
}

/** Formata timestamp ISO → dd/mm/aaaa hh:mm */
export function fdt(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return [
    String(d.getDate()).padStart(2,'0'),
    String(d.getMonth()+1).padStart(2,'0'),
    d.getFullYear()
  ].join('/') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0')
}

/** Ordena array por campo num de forma natural */
export function sortByNum(arr) {
  return [...arr].sort((a, b) => {
    const na = (a.num || '').replace(/\D/g, '')
    const nb = (b.num || '').replace(/\D/g, '')
    if (na && nb) return parseInt(na, 10) - parseInt(nb, 10)
    return (a.num || '').localeCompare(b.num || '', 'pt-BR', { numeric: true })
  })
}

/** Retorna status: ok | warn | danger | manut */
export function getStatus(ym, emManut) {
  if (emManut) return 'manut'
  if (!ym) return 'warn'
  const parts = ym.split('-').map(Number)
  const now = new Date()
  let diff
  if (parts.length === 3) {
    // Formato YYYY-MM-DD (data completa)
    const dataAlvo = new Date(parts[0], parts[1]-1, parts[2])
    const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    diff = Math.floor((dataAlvo - hoje) / (1000*60*60*24)) // diff em dias
    if (diff < 0)   return 'danger'
    if (diff <= 60) return 'warn'
    return 'ok'
  } else {
    // Formato YYYY-MM (mês/ano)
    const [y, m] = parts
    diff = (y * 12 + (m - 1)) - (now.getFullYear() * 12 + now.getMonth())
    if (diff < 0)  return 'danger'
    if (diff <= 2) return 'warn'
    return 'ok'
  }
}

/** Badge HTML de status */
export function stBadge(s) {
  const L = { ok: 'Em dia', warn: 'Atenção', danger: 'Vencido', manut: 'Manutenção' }
  const C = { ok: 'st-ok', warn: 'st-warn', danger: 'st-danger', manut: 'st-manut' }
  return `<span class="badge-st ${C[s] || 'st-warn'}">${L[s] || s}</span>`
}

/** Retorna status do hidrante — verifica se checklist foi feito nos últimos 30 dias */
export function getStatusHid(checklist) {
  if (!checklist) return 'danger'
  let hist = checklist
  if (typeof hist === 'string') { try { hist = JSON.parse(hist) } catch(e) { return 'danger' } }
  if (!Array.isArray(hist) || !hist.length) return 'danger'
  const ult = hist[hist.length - 1]
  if (!ult.data) return 'danger'
  const d    = new Date(ult.data)
  const hoje = new Date()
  const diff = Math.floor((hoje - d) / (1000 * 60 * 60 * 24))
  return diff <= 30 ? 'ok' : 'danger'
}
/** Badge HTML de status para hidrante */
export function stBadgeHid(s) {
  const L = { ok: '✅ Checklist OK', danger: '🔴 Pendente' }
  const C = { ok: 'st-ok', danger: 'st-danger' }
  return `<span class="badge-st ${C[s] || 'st-danger'}">${L[s] || s}</span>`
}

export function clsBadge(c) {
  const key = (c || '').replace('₂','2').toLowerCase()
  return `<span class="badge-cls cls-${key}">${c}</span>`
}

/** Toast global */
export function toast(msg, tipo = '') {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.className = 'toast on' + (tipo ? ' toast-' + tipo : '')
  clearTimeout(t._timer)
  t._timer = setTimeout(() => t.classList.remove('on'), 2800)
}

/** Confirmar ação */
export function confirmar(ico, titulo, msg, textoBotao = 'Confirmar') {
  return new Promise(resolve => {
    document.getElementById('conf-ico').textContent  = ico
    document.getElementById('conf-tit').textContent  = titulo
    document.getElementById('conf-msg').innerHTML    = msg
    document.getElementById('conf-ok').textContent   = textoBotao
    const ov = document.getElementById('ov-conf')
    ov.classList.add('on')
    const ok  = document.getElementById('conf-ok')
    const can = document.getElementById('conf-can')
    const cleanup = () => { ov.classList.remove('on'); ok.onclick = null; can.onclick = null }
    ok.onclick  = () => { cleanup(); resolve(true)  }
    can.onclick = () => { cleanup(); resolve(false) }
  })
}
