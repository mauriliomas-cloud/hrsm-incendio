import { fmm, fdt, sortByNum, getStatus } from './utils.js'

function clsBadge(c) {
  const key = (c || '').replace('₂','2').toLowerCase()
  return `<span class="cls cls-${key}">${c}</span>`
}
function stStr(s) {
  const L = { ok:'Em dia', warn:'Atenção', danger:'Vencido', manut:'Manutenção' }
  const C = { ok:'ok', warn:'warn', danger:'danger', manut:'orange' }
  return `<span class="${C[s] || ''}">${L[s] || s}</span>`
}

export function gerarRelatorio(EXT, HID, nomeUsuario) {
  const now  = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })
  const hora = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })

  const eOk   = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'ok')
  const eWarn = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'warn')
  const eVenc = EXT.filter(e => getStatus(e.validade, e.em_manut) === 'danger')
  const eMan  = EXT.filter(e => e.em_manut)
  const hOk   = HID.filter(h => getStatus(h.pi, false) === 'ok')
  const hWarn = HID.filter(h => getStatus(h.pi, false) === 'warn')
  const hVenc = HID.filter(h => getStatus(h.pi, false) === 'danger')

  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #111; background: #fff }
    .page { padding: 18mm 16mm }
    h1 { font-size: 15pt; color: #7B241C; margin: 0 0 2mm }
    h2 { font-size: 11pt; color: #7B241C; margin: 7mm 0 3mm; border-bottom: 1.5pt solid #7B241C; padding-bottom: 1mm; page-break-after: avoid }
    .cab { border: 2pt solid #7B241C; border-radius: 4pt; padding: 4mm 5mm; margin-bottom: 5mm }
    .cab .org { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1mm }
    .cab .meta { font-size: 9pt; color: #555; margin-top: 2mm }
    .resumo { display: grid; grid-template-columns: repeat(4,1fr); gap: 3mm; margin-bottom: 5mm }
    .sc { border: 1pt solid #ddd; border-radius: 3pt; padding: 3mm; text-align: center }
    .sc .sl { font-size: 7pt; text-transform: uppercase; color: #888; letter-spacing: .5px }
    .sc .sv { font-size: 18pt; font-weight: 700; font-family: monospace; margin: 1mm 0 }
    .sc .ss { font-size: 7pt; color: #888 }
    .cr .sv { color: #C0392B } .ca .sv { color: #D68910 } .cg .sv { color: #1E8449 } .co .sv { color: #E67E22 }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4mm; font-size: 9pt; page-break-inside: auto }
    thead { display: table-header-group }
    tr { page-break-inside: avoid }
    thead th { background: #7B241C; color: #fff; padding: 2mm 2.5mm; text-align: left; font-size: 8pt }
    tbody tr:nth-child(even) { background: #F9F9F9 }
    tbody td { padding: 1.8mm 2.5mm; border-bottom: .5pt solid #E5E5E5; vertical-align: top }
    .danger { color: #C0392B; font-weight: 700 }
    .warn   { color: #D68910; font-weight: 700 }
    .ok     { color: #1E8449; font-weight: 700 }
    .orange { color: #E67E22; font-weight: 700 }
    .cls { display: inline-block; padding: 1px 5px; border-radius: 9pt; font-size: 8pt; font-weight: 700 }
    .cls-ap  { background: #EBF5FB; color: #1A5276 }
    .cls-bc  { background: #FEF9E7; color: #7D6608 }
    .cls-abc { background: #EAFAF1; color: #1E8449 }
    .cls-co2 { background: #F4ECF7; color: #6C3483 }
    .th-orange thead th { background: #E67E22 }
    .th-red    thead th { background: #C0392B }
    .th-amber  thead th { background: #D68910 }
    .th-green  thead th { background: #1E8449 }
    .th-blue   thead th { background: #1A5276 }
    .rodape { text-align: center; font-size: 8pt; color: #888; margin-top: 8mm; padding-top: 3mm; border-top: .5pt solid #ccc }
    .na { color: #aaa }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact }
      h2 { page-break-after: avoid }
    }
  `

  let b = ''

  // Cabeçalho
  b += `<div class="cab">
    <div class="org">Hospital Regional de Santa Maria — CBMDF</div>
    <h1>🔥 Relatório de Combate a Incêndio</h1>
    <div class="meta">Data: <b>${now}</b> às <b>${hora}</b> &nbsp;|&nbsp; Responsável: <b>${nomeUsuario}</b></div>
  </div>`

  // Resumo
  b += `<div class="resumo">
    <div class="sc"><div class="sl">Extintores</div><div class="sv">${EXT.length}</div><div class="ss">total</div></div>
    <div class="sc cg"><div class="sl">Em dia</div><div class="sv">${eOk.length}</div><div class="ss">OK</div></div>
    <div class="sc ca"><div class="sl">Atenção</div><div class="sv">${eWarn.length}</div><div class="ss">60 dias</div></div>
    <div class="sc cr"><div class="sl">Vencidos</div><div class="sv">${eVenc.length}</div><div class="ss">urgente</div></div>
    <div class="sc co"><div class="sl">Manutenção</div><div class="sv">${eMan.length}</div><div class="ss">fora serviço</div></div>
    <div class="sc"><div class="sl">Hidrantes</div><div class="sv">${HID.length}</div><div class="ss">total</div></div>
    <div class="sc cr"><div class="sl">Hid. Vencidos</div><div class="sv">${hVenc.length}</div><div class="ss">urgente</div></div>
    <div class="sc ca"><div class="sl">Hid. Atenção</div><div class="sv">${hWarn.length}</div><div class="ss">60 dias</div></div>
  </div>`

  // Manutenção
  b += `<h2>🔧 Extintores em Manutenção (${eMan.length})</h2>`
  if (eMan.length) {
    b += `<table class="th-orange"><thead><tr>
      <th>Nº</th><th>Classe</th><th>Local</th><th>Saída</th><th>Motivo/Empresa</th><th>Histórico</th><th>Atualizado por</th>
    </tr></thead><tbody>`
    sortByNum(eMan).forEach(e => {
      const hist = (e.manut_hist || [])
        .map(h => (h.tipo==='saida'?'⬆ Saída ':'⬇ Retorno ') + fmm(h.data) + ' — ' + h.por)
        .join('<br>') || '—'
      b += `<tr>
        <td><b>${e.num}</b></td>
        <td>${clsBadge(e.cls)}</td>
        <td>${e.loc}</td>
        <td class="orange">${fmm(e.manut_saida)}</td>
        <td>${e.manut_motivo || '—'}</td>
        <td style="font-size:8pt">${hist}</td>
        <td style="font-size:8pt">${e.upd_by || '—'}</td>
      </tr>`
    })
    b += `</tbody></table>`
  } else {
    b += `<p class="na">Nenhum extintor em manutenção no momento.</p>`
  }

  // Vencidos Ext
  b += `<h2>🔴 Extintores Vencidos (${eVenc.length})</h2>`
  if (eVenc.length) {
    b += `<table class="th-red"><thead><tr>
      <th>Nº</th><th>Classe</th><th>Cap.</th><th>Marca</th><th>Local</th><th>Validade</th><th>Atualizado por</th>
    </tr></thead><tbody>`
    sortByNum(eVenc).forEach(e => {
      b += `<tr>
        <td><b>${e.num}</b></td><td>${clsBadge(e.cls)}</td>
        <td>${e.cap||'—'}</td><td>${e.mk||'—'}</td><td>${e.loc}</td>
        <td class="danger">${fmm(e.validade)}</td>
        <td style="font-size:8pt">${e.upd_by||'—'}</td>
      </tr>`
    })
    b += `</tbody></table>`
  } else { b += `<p class="na">Nenhum extintor vencido.</p>` }

  // Atenção Ext
  b += `<h2>⚠️ Atenção — Vencimento Próximo (${eWarn.length})</h2>`
  if (eWarn.length) {
    b += `<table class="th-amber"><thead><tr>
      <th>Nº</th><th>Classe</th><th>Marca</th><th>Local</th><th>Validade</th><th>Atualizado por</th>
    </tr></thead><tbody>`
    sortByNum(eWarn).forEach(e => {
      b += `<tr>
        <td><b>${e.num}</b></td><td>${clsBadge(e.cls)}</td>
        <td>${e.mk||'—'}</td><td>${e.loc}</td>
        <td class="warn">${fmm(e.validade)}</td>
        <td style="font-size:8pt">${e.upd_by||'—'}</td>
      </tr>`
    })
    b += `</tbody></table>`
  } else { b += `<p class="na">Nenhum extintor com vencimento próximo.</p>` }

  // Vencidos Hid
  b += `<h2>🔴 Hidrantes — Inspeção Vencida (${hVenc.length})</h2>`
  if (hVenc.length) {
    b += `<table class="th-red"><thead><tr>
      <th>Nº</th><th>Tipo</th><th>Local</th><th>Próx. Inspeção</th><th>Atualizado por</th>
    </tr></thead><tbody>`
    sortByNum(hVenc).forEach(h => {
      b += `<tr>
        <td><b>${h.num}</b></td><td>${h.tp}</td><td>${h.loc}</td>
        <td class="danger">${fmm(h.pi)}</td>
        <td style="font-size:8pt">${h.upd_by||'—'}</td>
      </tr>`
    })
    b += `</tbody></table>`
  } else { b += `<p class="na">Nenhum hidrante vencido.</p>` }

  // Lista completa Ext
  b += `<h2>📋 Lista Completa — Extintores (${EXT.length})</h2>`
  b += `<table class="th-green"><thead><tr>
    <th>Nº</th><th>Classe</th><th>Cap.</th><th>Marca</th><th>Localização</th>
    <th>Validade</th><th>Hid. Ano</th><th>Nº Hid.</th><th>Próx. Troca</th><th>Status</th><th>Atualiz. por</th><th>Data/Hora</th>
  </tr></thead><tbody>`
  if (EXT.length) {
    sortByNum(EXT).forEach(e => {
      const s = getStatus(e.validade, e.em_manut)
      b += `<tr>
        <td><b>${e.num}</b></td><td>${clsBadge(e.cls)}</td>
        <td>${e.cap||'—'}</td><td>${e.mk||'—'}</td><td>${e.loc}</td>
        <td class="${s==='danger'?'danger':s==='warn'?'warn':''}">${fmm(e.validade)}</td>
        <td>${e.hdt||'—'}</td><td>${e.hnum||'—'}</td><td>${fmm(e.troca)}</td>
        <td>${stStr(s)}</td>
        <td style="font-size:8pt">${e.upd_by||'—'}</td>
        <td style="font-size:8pt">${fdt(e.upd_at)}</td>
      </tr>`
    })
  } else {
    b += `<tr><td colspan="12" style="text-align:center;color:#aaa">Nenhum extintor cadastrado.</td></tr>`
  }
  b += `</tbody></table>`

  // Lista completa Hid
  b += `<h2>📋 Lista Completa — Hidrantes (${HID.length})</h2>`
  b += `<table class="th-blue"><thead><tr>
    <th>Nº</th><th>Tipo</th><th>Marca</th><th>Diâm.</th><th>Localização</th>
    <th>Últ. Insp.</th><th>Próx. Insp.</th><th>Teste P.</th><th>Pressão</th><th>Status</th><th>Atualiz. por</th><th>Data/Hora</th>
  </tr></thead><tbody>`
  if (HID.length) {
    sortByNum(HID).forEach(h => {
      const s = getStatus(h.pi, false)
      b += `<tr>
        <td><b>${h.num}</b></td><td>${h.tp}</td>
        <td>${h.mk||'—'}</td><td>${h.dm||'—'}</td><td>${h.loc}</td>
        <td>${fmm(h.ui)}</td>
        <td class="${s==='danger'?'danger':s==='warn'?'warn':''}">${fmm(h.pi)}</td>
        <td>${fmm(h.pt)}</td><td>${h.pv?h.pv+' bar':'—'}</td>
        <td>${stStr(s)}</td>
        <td style="font-size:8pt">${h.upd_by||'—'}</td>
        <td style="font-size:8pt">${fdt(h.upd_at)}</td>
      </tr>`
    })
  } else {
    b += `<tr><td colspan="12" style="text-align:center;color:#aaa">Nenhum hidrante cadastrado.</td></tr>`
  }
  b += `</tbody></table>`

  b += `<div class="rodape">Hospital Regional de Santa Maria &nbsp;·&nbsp; Combate a Incêndio &nbsp;·&nbsp; ${now} ${hora}</div>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório HRSM — ${now}</title>
  <style>${css}</style>
</head>
<body>
  <div class="page">${b}</div>
  <script>window.onload = () => window.print()<\/script>
</body>
</html>`
}

/** Faz download do relatório como arquivo HTML */
export function baixarRelatorio(EXT, HID, nomeUsuario) {
  const html = gerarRelatorio(EXT, HID, nomeUsuario)
  const data = new Date()
  const nome = `relatorio_hrsm_${data.getFullYear()}${String(data.getMonth()+1).padStart(2,'0')}${String(data.getDate()).padStart(2,'0')}_${String(data.getHours()).padStart(2,'0')}${String(data.getMinutes()).padStart(2,'0')}.html`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = nome
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 1500)
}
