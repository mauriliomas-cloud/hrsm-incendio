import { fmm, fdt, sortByNum, getStatus, getStatusHid } from './utils.js'

function cls(c) {
  const key = (c || '').replace('₂','2').toLowerCase()
  const cores = { ap:'#1A5276;background:#EBF5FB', bc:'#7D6608;background:#FEF9E7', abc:'#1E8449;background:#EAFAF1', co2:'#6C3483;background:#F4ECF7' }
  const cor = cores[key] || '#555;background:#eee'
  return `<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:9pt;font-weight:700;color:${cor}">${c}</span>`
}

function st(s) {
  const L = { ok:'✅ Em dia', warn:'⚠️ Atenção', danger:'🔴 Vencido', manut:'🔧 Manutenção' }
  const C = { ok:'#1E8449', warn:'#D68910', danger:'#C0392B', manut:'#E67E22' }
  return `<span style="color:${C[s]||'#555'};font-weight:700">${L[s]||s}</span>`
}

function td(v, cor='') {
  return `<td style="padding:3mm 3mm;border-bottom:.5pt solid #eee;vertical-align:top;${cor?'color:'+cor+';font-weight:700':''}">${v||'—'}</td>`
}

function th(v) {
  return `<th style="padding:2.5mm 3mm;text-align:left;font-size:9pt;background:#7B241C;color:#fff">${v}</th>`
}

export function gerarRelatorio(EXT, HID, nomeUsuario, filtro = 'ext-todos') {
  const now  = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' })
  const hora = new Date().toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })

  // Aplica filtro
  let extF = EXT, hidF = HID, titulo = 'Relatório Completo'
  if (filtro === 'ext-todos') { hidF=[]; titulo='🧯 Todos os Extintores' }
  else if (filtro === 'ext-venc')  { extF = EXT.filter(e => getStatus(e.validade,e.em_manut)==='danger'); hidF=[]; titulo='🔴 Extintores Vencidos' }
  else if (filtro === 'ext-warn')  { extF = EXT.filter(e => getStatus(e.validade,e.em_manut)==='warn'); hidF=[]; titulo='⚠️ Extintores com Atenção' }
  else if (filtro === 'ext-manut') { extF = EXT.filter(e => e.em_manut); hidF=[]; titulo='🔧 Extintores em Manutenção' }
  else if (filtro === 'ext-ap')    { extF = EXT.filter(e => e.cls==='AP'); hidF=[]; titulo='🔵 Extintores AP' }
  else if (filtro === 'ext-bc')    { extF = EXT.filter(e => e.cls==='BC'); hidF=[]; titulo='🟡 Extintores BC' }
  else if (filtro === 'ext-abc')   { extF = EXT.filter(e => e.cls==='ABC'); hidF=[]; titulo='🟢 Extintores ABC' }
  else if (filtro === 'ext-co2')   { extF = EXT.filter(e => e.cls==='CO₂'); hidF=[]; titulo='🟣 Extintores CO₂' }
  else if (filtro === 'hid-todos') { extF=[]; titulo='💧 Todos os Hidrantes' }
  else if (filtro === 'hid-pend')  { extF=[]; hidF=HID.filter(h=>getStatusHid(h.checklist)==='danger'); titulo='🔴 Hidrantes com Checklist Pendente' }
  else if (filtro === 'hid-conf')  { extF=[]; hidF=HID.filter(h=>{let hist=h.checklist;if(typeof hist==='string'){try{hist=JSON.parse(hist)}catch(e){return false}}if(!Array.isArray(hist)||!hist.length)return false;const ult=hist[hist.length-1];return['Ruim','Regular','Ausente'].some(v=>[ult.mang1,ult.mang2,ult.chave,ult.esguicho,ult.abrigo,ult.registro,ult.lacre].includes(v))}); titulo='⚠️ Hidrantes Fora de Conformidade' }

  const eOk   = extF.filter(e => getStatus(e.validade, e.em_manut) === 'ok')
  const eWarn = extF.filter(e => getStatus(e.validade, e.em_manut) === 'warn')
  const eVenc = extF.filter(e => getStatus(e.validade, e.em_manut) === 'danger')
  const eMan  = extF.filter(e => e.em_manut)
  const hVenc = hidF.filter(h => getStatusHid(h.checklist) === 'danger')

  const css = `
    * { box-sizing:border-box; margin:0; padding:0 }
    body { font-family: Arial, Helvetica, sans-serif; font-size:10pt; color:#111; background:#fff }
    .page { padding:8mm 10mm }
    table { width:100%; border-collapse:collapse; margin-bottom:6mm; page-break-inside:auto }
    thead { display:table-header-group }
    tr { page-break-inside:avoid }
    tbody tr:nth-child(even) { background:#F8F8F8 }
    h2 { font-size:12pt; color:#7B241C; margin:8mm 0 4mm; padding-bottom:2mm; border-bottom:2pt solid #7B241C; page-break-after:avoid }
    .cab { border:2pt solid #7B241C; border-radius:6pt; padding:5mm 6mm; margin-bottom:6mm; display:flex; justify-content:space-between; align-items:flex-start }
    .cab-left .org { font-size:8pt; color:#888; text-transform:uppercase; letter-spacing:1px; margin-bottom:2mm }
    .cab-left h1 { font-size:16pt; color:#7B241C; margin-bottom:2mm }
    .cab-left .meta { font-size:9pt; color:#555 }
    .cab-right { text-align:right; font-size:9pt; color:#555 }
    .resumo { display:grid; grid-template-columns:repeat(4,1fr); gap:4mm; margin-bottom:6mm }
    .sc { border:1.5pt solid #ddd; border-radius:4pt; padding:4mm; text-align:center }
    .sc .sl { font-size:8pt; text-transform:uppercase; color:#888; letter-spacing:.5px; margin-bottom:1mm }
    .sc .sv { font-size:20pt; font-weight:700; font-family:monospace; margin:2mm 0 }
    .sc .ss { font-size:8pt; color:#888 }
    .cr .sv { color:#C0392B } .ca .sv { color:#D68910 } .cg .sv { color:#1E8449 } .co .sv { color:#E67E22 }
    .cr { border-color:#FADBD8 } .ca { border-color:#FDEBD0 } .cg { border-color:#D5F5E3 } .co { border-color:#FEF0E5 }
    .na { color:#aaa; font-size:10pt; padding:4mm; text-align:center }
    .rodape { text-align:center; font-size:8pt; color:#aaa; margin-top:10mm; padding-top:4mm; border-top:.5pt solid #ddd }
    .assinatura { display:grid; grid-template-columns:1fr 1fr; gap:20mm; margin-top:15mm }
    .ass-linha { border-top:1pt solid #333; padding-top:2mm; font-size:9pt; color:#555; text-align:center }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact }
      h2 { page-break-after:avoid }
      @page { size: A4 landscape; margin: 5mm 8mm }
    }
  `

  let b = ''

  // Cabeçalho
  b += `<div class="cab">
    <div class="cab-left">
      <div class="org">Instituto de Gestão Estratégica de Saúde do DF — IGESDF</div>
      <h1>🔥 ${titulo}</h1>
      <div class="meta">Hospital Regional de Santa Maria — CBMDF</div>
    </div>
    <div class="cab-right">
      <div><b>Data:</b> ${now}</div>
      <div><b>Hora:</b> ${hora}</div>
      <div><b>Responsável:</b> ${nomeUsuario}</div>
    </div>
  </div>`

  const ap  = EXT.filter(e => e.cls === 'AP').length
  const bc  = EXT.filter(e => e.cls === 'BC').length
  const abc = EXT.filter(e => e.cls === 'ABC').length
  const co2 = EXT.filter(e => e.cls === 'CO₂').length

  // Resumo
  b += `<div class="resumo">
    <div class="sc"><div class="sl">Total Extintores</div><div class="sv">${EXT.length}</div><div class="ss">cadastrados</div></div>
    <div class="sc cg"><div class="sl">Em Dia</div><div class="sv">${eOk.length}</div><div class="ss">OK</div></div>
    <div class="sc ca"><div class="sl">Atenção</div><div class="sv">${eWarn.length}</div><div class="ss">60 dias</div></div>
    <div class="sc cr"><div class="sl">Vencidos</div><div class="sv">${eVenc.length}</div><div class="ss">urgente</div></div>
    <div class="sc co"><div class="sl">Manutenção</div><div class="sv">${eMan.length}</div><div class="ss">fora serviço</div></div>
    <div class="sc" style="border-color:#EBF5FB"><div class="sl">AP</div><div class="sv" style="color:#1A5276">${ap}</div><div class="ss">água pressurizada</div></div>
    <div class="sc" style="border-color:#FEF9E7"><div class="sl">BC</div><div class="sv" style="color:#7D6608">${bc}</div><div class="ss">pó químico BC</div></div>
    <div class="sc" style="border-color:#EAFAF1"><div class="sl">ABC</div><div class="sv" style="color:#1E8449">${abc}</div><div class="ss">pó químico ABC</div></div>
    <div class="sc" style="border-color:#F4ECF7"><div class="sl">CO₂</div><div class="sv" style="color:#6C3483">${co2}</div><div class="ss">gás carbônico</div></div>
    <div class="sc"><div class="sl">Total Hidrantes</div><div class="sv">${HID.length}</div><div class="ss">cadastrados</div></div>
    <div class="sc cr"><div class="sl">Checklist Pendente</div><div class="sv">${hVenc.length}</div><div class="ss">este mês</div></div>
    <div class="sc cg"><div class="sl">Checklist OK</div><div class="sv">${HID.length - hVenc.length}</div><div class="ss">feito este mês</div></div>
  </div>`

  // Manutenção
  b += `<h2>🔧 Extintores em Manutenção (${eMan.length})</h2>`
  if (eMan.length) {
    b += `<table><thead><tr>${['Nº','Classe','Local','Saída','Motivo / Empresa','Atualizado por'].map(th).join('')}</tr></thead><tbody>`
    sortByNum(eMan).forEach(e => {
      b += `<tr>${td('<b>'+e.num+'</b>')}${td(cls(e.cls))}${td(e.loc)}${td(fmm(e.manut_saida),'#E67E22')}${td(e.manut_motivo)}${td(e.upd_by)}</tr>`
    })
    b += `</tbody></table>`
  } else { b += `<p class="na">Nenhum extintor em manutenção.</p>` }

  // Vencidos
  b += `<h2>🔴 Extintores Vencidos (${eVenc.length})</h2>`
  if (eVenc.length) {
    b += `<table><thead><tr>${['Nº','Classe','Cap.','Marca','Local','Próx. Recarga','Empresa','Atualizado por'].map(th).join('')}</tr></thead><tbody>`
    sortByNum(eVenc).forEach(e => {
      b += `<tr>${td('<b>'+e.num+'</b>')}${td(cls(e.cls))}${td(e.cap)}${td(e.mk)}${td(e.loc)}${td(fmm(e.validade),'#C0392B')}${td(e.empresa)}${td(e.upd_by)}</tr>`
    })
    b += `</tbody></table>`
  } else { b += `<p class="na">Nenhum extintor vencido.</p>` }

  // Atenção
  b += `<h2>⚠️ Atenção — Próxima Recarga em até 60 dias (${eWarn.length})</h2>`
  if (eWarn.length) {
    b += `<table><thead><tr>${['Nº','Classe','Marca','Local','Próx. Recarga','Empresa','Atualizado por'].map(th).join('')}</tr></thead><tbody>`
    sortByNum(eWarn).forEach(e => {
      b += `<tr>${td('<b>'+e.num+'</b>')}${td(cls(e.cls))}${td(e.mk)}${td(e.loc)}${td(fmm(e.validade),'#D68910')}${td(e.empresa)}${td(e.upd_by)}</tr>`
    })
    b += `</tbody></table>`
  } else { b += `<p class="na">Nenhum extintor com vencimento próximo.</p>` }

  // Hidrantes com itens fora de conformidade
  const hNaoConformes = HID.filter(h => {
    let hist = h.checklist
    if (typeof hist === 'string') { try { hist = JSON.parse(hist) } catch(e) { return false } }
    if (!Array.isArray(hist) || !hist.length) return false
    const ult = hist[hist.length - 1]
    return ['Ruim','Regular','Ausente'].some(v =>
      [ult.mang1, ult.mang2, ult.chave, ult.esguicho, ult.abrigo, ult.registro, ult.lacre].includes(v)
    )
  })

  b += `<h2>⚠️ Hidrantes com Itens Fora de Conformidade (${hNaoConformes.length})</h2>`
  if (hNaoConformes.length) {
    b += `<table><thead><tr>${['Nº','Local','Item','Status','Data Inspeção','Responsável'].map(th).join('')}</tr></thead><tbody>`
    sortByNum(hNaoConformes).forEach(h => {
      let hist = h.checklist
      if (typeof hist === 'string') { try { hist = JSON.parse(hist) } catch(e) { hist = [] } }
      const ult  = hist[hist.length - 1]
      const itens = [
        { nome: 'Mangueira 1',  val: ult.mang1 },
        { nome: 'Mangueira 2',  val: ult.mang2 },
        { nome: 'Chave',        val: ult.chave },
        { nome: 'Esguicho',     val: ult.esguicho },
        { nome: 'Abrigo/Caixa', val: ult.abrigo },
        { nome: 'Registro',     val: ult.registro },
        { nome: 'Lacre',        val: ult.lacre },
      ].filter(i => ['Ruim','Regular','Ausente'].includes(i.val))

      itens.forEach((item, idx) => {
        const cor = item.val === 'Regular' ? '#D68910' : '#C0392B'
        b += `<tr>
          ${idx === 0 ? `<td rowspan="${itens.length}" style="padding:3mm;border-bottom:.5pt solid #eee;font-weight:700">${h.num}</td>
          <td rowspan="${itens.length}" style="padding:3mm;border-bottom:.5pt solid #eee">${h.loc}</td>` : ''}
          ${td(item.nome)}
          ${td(item.val, cor)}
          ${idx === 0 ? `<td rowspan="${itens.length}" style="padding:3mm;border-bottom:.5pt solid #eee">${fmm(ult.data)}</td>
          <td rowspan="${itens.length}" style="padding:3mm;border-bottom:.5pt solid #eee">${ult.resp||'—'}</td>` : ''}
        </tr>`
      })
    })
    b += `</tbody></table>`
  } else {
    b += `<p class="na">✅ Nenhum hidrante com itens fora de conformidade.</p>`
  }

  // Hidrantes com checklist pendente
  if (hVenc.length) {
    b += `<h2>🔴 Hidrantes — Checklist Pendente este Mês (${hVenc.length})</h2>`
    b += `<table><thead><tr>${['Nº','Tipo','Local','Próx. Inspeção','Atualizado por'].map(th).join('')}</tr></thead><tbody>`
    sortByNum(hVenc).forEach(h => {
      b += `<tr>${td('<b>'+h.num+'</b>')}${td(h.tp)}${td(h.loc)}${td(fmm(h.pi),'#C0392B')}${td(h.upd_by)}</tr>`
    })
    b += `</tbody></table>`
  }

  if (extF.length > 0) {
    b += `<h2>📋 Lista — Extintores (${extF.length})</h2>`
    b += `<table><thead><tr>${[
      'Nº','Classe','Cap.','Marca','Localização',
      'Últ. Recarga','Próx. Recarga','Últ. Teste Hid.','Próx. Teste Hid.',
      'Nº Laudo','Nº Lacre','Empresa','Status','Atualiz. por','Data/Hora'
    ].map(th).join('')}</tr></thead><tbody>`
    sortByNum(extF).forEach(e => {
      const s = getStatus(e.validade, e.em_manut)
      const corData = s==='danger'?'#C0392B':s==='warn'?'#D68910':''
      b += `<tr>
        ${td('<b>'+e.num+'</b>')}
        ${td(cls(e.cls))}
        ${td(e.cap)}
        ${td(e.mk)}
        ${td(e.loc)}
        ${td(fmm(e.ult_recarga))}
        ${td(fmm(e.validade), corData)}
        ${td(e.hdt||'—')}
        ${td(e.troca||'—')}
        ${td(e.hnum)}
        ${td(e.lacre)}
        ${td(e.empresa)}
        ${td(st(s))}
        ${td(e.upd_by)}
        ${td(fdt(e.upd_at))}
      </tr>`
    })
    b += `</tbody></table>`
  }

  if (hidF.length > 0) {
    b += `<h2>📋 Lista — Hidrantes (${hidF.length})</h2>`
    b += `<table><thead><tr>${[
      'Nº','Tipo','Marca','Diâm.','Localização',
      'Teste Pressão','Pressão','Status','Atualiz. por','Data/Hora'
    ].map(th).join('')}</tr></thead><tbody>`
    sortByNum(hidF).forEach(h => {
      const s = getStatusHid(h.checklist)
      b += `<tr>
        ${td('<b>'+h.num+'</b>')}
        ${td(h.tp)}
        ${td(h.mk)}
        ${td(h.dm)}
        ${td(h.loc)}
        ${td(fmm(h.pt))}
        ${td(h.pv ? h.pv+' bar' : '—')}
        ${td(s==='ok'?'✅ Checklist OK':'🔴 Pendente', s==='ok'?'#1E8449':'#C0392B')}
        ${td(h.upd_by)}
        ${td(fdt(h.upd_at))}
      </tr>`
    })
    b += `</tbody></table>`
  }

  // Assinatura
  b += `<div class="assinatura">
    <div class="ass-linha">Responsável pela Vistoria</div>
    <div class="ass-linha">Chefe da Brigada de Incêndio</div>
  </div>`

  b += `<div class="rodape">
    Hospital Regional de Santa Maria — IGESDF/CBMDF — Brigada de Incêndio<br>
    Gerado em ${now} às ${hora} por ${nomeUsuario}
  </div>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório HRSM — Brigada de Incêndio — ${now}</title>
  <style>${css}</style>
</head>
<body>
  <div class="page">${b}</div>
  <script>window.onload = () => window.print()<\/script>
</body>
</html>`
}

export function baixarRelatorio(EXT, HID, nomeUsuario, filtro = 'ext-todos') {
  const html = gerarRelatorio(EXT, HID, nomeUsuario, filtro)
  const data = new Date()
  const nome = `relatorio_hrsm_${data.getFullYear()}${String(data.getMonth()+1).padStart(2,'0')}${String(data.getDate()).padStart(2,'0')}_${String(data.getHours()).padStart(2,'0')}${String(data.getMinutes()).padStart(2,'0')}.html`
  const blob = new Blob([html], { type:'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = nome; a.style.display = 'none'
  document.body.appendChild(a); a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 1500)
}

export function abrirRelatorio(EXT, HID, nomeUsuario, filtro = 'ext-todos') {
  const html = gerarRelatorio(EXT, HID, nomeUsuario, filtro)
  const blob = new Blob([html], { type:'text/html;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
