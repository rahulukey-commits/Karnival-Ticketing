/* ============================================================
   Karnival Ticketing — app (router, state, views, interactions)
   ============================================================ */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const view = $('#view');

const esc = s => (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const titleCase = s => (s||'').replace(/_/g,' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const fmtDT = d => d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)} ${d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}` : '';
const fmtAgo = d => { if(!d) return ''; const s=(Date.now()-d.getTime())/1000;
  if(s<60) return 'just now'; if(s<3600) return Math.floor(s/60)+'m ago';
  if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; };
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDateAbs = d => d ? `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}` : '';
const renderMentions = txt => { let s=esc(txt); AGENTS.forEach(a=>{ s=s.replace(new RegExp('@'+a.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'), `<span class="ment">@${esc(a.name)}</span>`); }); return s; };
const statusBadge = s => `<span class="badge b-${(s||'').toLowerCase()}">${titleCase(s)}</span>`;
const prioBadge = p => `<span class="badge p-${(p||'').toLowerCase()}">${titleCase(p)}</span>`;
const slaBadge = t => { if(!t.escalation_info && !t.is_overdue) return '';
  if(t.escalation_info) return `<span class="badge sla-breach">L${t.escalation_info.level} Breached</span>`;
  return `<span class="badge ${t.is_overdue?'sla-breach':'sla-ok'}">${t.is_overdue?'SLA Breached':'On Track'}</span>`; };
const initials = n => (n||'?').trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
const agentName = e => (AGENTS.find(a=>a.email===e)||{}).name || e || '—';
const CURRENT_USER = {email:'rahul.ukey@karnival.com', name:'Rahul Ukey'};   // logged-in agent (RU)

function toast(title,msg,kind='ok'){
  const ico = kind==='ok'?'✅':kind==='warn'?'⚠️':'ℹ️';
  const t=document.createElement('div'); t.className='toast '+kind;
  t.innerHTML=`<div class="t-ico">${ico}</div><div><div class="t-title">${esc(title)}</div>${msg?`<div class="t-msg">${esc(msg)}</div>`:''}</div>`;
  $('#toastWrap').appendChild(t); setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(40px)';setTimeout(()=>t.remove(),250);},2800);
}

/* ---------- state ---------- */
const state = {
  page:1, pageSize:10,
  filters:{search:'',assignee:'',priority:'',status:'',tag:'',brand:'',project:'',from:'',to:''},
  moreOptions:false, expanded:null, selected:new Set(),
};

/* ============================================================ ROUTER + SHEET
   Portal home is the base layer (topbar + sidebar + Bill Overview).
   Every ticketing view renders inside a floating ✕-dismissable sheet,
   exactly like the recording. */
function mount(){ return document.getElementById('sheetBody') || view; }
function openSheet(){
  const ov=$('#overlay');
  if(!$('#sheetBody')){
    ov.innerHTML=`<div class="sheet"><button class="sheet-close" id="sheetClose" title="Close">✕</button><div class="sheet-body" id="sheetBody"></div></div>`;
    $('#sheetClose').onclick=()=>go('home');
  }
  ov.classList.add('show'); document.body.style.overflow='hidden';
}
function closeSheet(){ const ov=$('#overlay'); ov.classList.remove('show'); ov.innerHTML=''; document.body.style.overflow=''; }
function router(){
  let hash = location.hash.slice(1) || 'home';
  if(hash.startsWith('/')) hash = hash.slice(1);
  hash = hash.split('?')[0].replace(/\/$/,'') || 'home';

  /* nav highlight + auto-open owning accordion group */
  $$('.nav-child').forEach(n=>n.classList.toggle('active', n.dataset.route===hash));
  $$('.nav-item[data-route]').forEach(n=>n.classList.toggle('active', n.dataset.route===hash));
  const activeChild = $$('.nav-child').find(n=>n.dataset.route===hash);
  if(activeChild){
    const grp = activeChild.closest('.nav-group');
    if(grp && !grp.classList.contains('open')){
      $$('.nav-group').forEach(g=>g.classList.remove('open'));
      grp.classList.add('open');
    }
  }

  /* full-page module routes (Survey Analytics / CX Report / Live Dashboard / POS Uploads) */
  if(typeof MODULE_ROUTES!=='undefined' && FULLPAGE_ROUTES.includes(hash)){
    closeSheet(); MODULE_ROUTES[hash](); return;
  }
  if(typeof M!=='undefined' && M.closeFull) M.closeFull();

  /* inline module routes (everything except ticketing) */
  if(typeof MODULE_ROUTES!=='undefined' && MODULE_ROUTES[hash]){
    closeSheet(); MODULE_ROUTES[hash](); view.scrollTop=0; window.scrollTo(0,0); return;
  }

  const [route, param] = hash.split('/');
  renderHome();                                    // base layer always present
  if(route==='home'){ closeSheet(); return; }
  openSheet();
  // 'view/NUM' shares the All Tickets sheet with that ticket expanded inline (accordion)
  if(route==='tickets'){ state.expanded=null; state.selected.clear(); renderTickets(); mount().scrollTop=0; return; }
  if(route==='view'){ state.expanded=param; state.expandLoading=true; renderTickets();
    setTimeout(()=>{const el=document.getElementById('expandedTop'); if(el) el.scrollIntoView({block:'start'});},30);
    setTimeout(()=>{ if(state.expanded===param){ state.expandLoading=false; paintList(); } },420);  // skeleton → content
    return; }
  const map = {projects:renderProjects, overview:renderTicketOverview,
    support:renderSupport, agents:renderAgents, source:renderSource, logs:renderLogs};
  state.expanded=null;
  (map[route]||renderTickets)(param);
  mount().scrollTop=0;
}
window.addEventListener('hashchange', router);
function go(h){ location.hash = h; }

/* ============================================================ PORTAL HOME (Bill Overview) */
function renderHome(){
  const boFilters = `
      <div class="bo-filters">
        <select class="select"><option>Overall</option></select>
        <select class="select" disabled><option>Sales Person</option></select>
        <select class="select"><option>Daily</option></select>
        <select class="select"><option>Last 28 Days</option></select>
      </div>`;
  view.innerHTML=`
    <div class="home-strip">
      <div class="home-tile"><span class="ht-label">Live Stores</span><span class="ht-val">0</span></div>
      <div class="home-tile"><span class="ht-label">Live POS</span><span class="ht-val">0</span></div>
    </div>
    <div class="home-card">
      <h3>Bill Overview</h3>
      ${boFilters}
      <div class="bo-grid">
        <div class="bo-cell"><div class="boc-l">Total Bills Generated</div><div class="boc-v">-</div></div>
        <div class="bo-cell green"><div class="boc-l">Digital Bills Only</div><div class="boc-v">-</div></div>
        <div class="bo-cell amber"><div class="boc-l">Digital Bills + Printed</div><div class="boc-v">-</div></div>
        <div class="bo-cell red"><div class="boc-l">Printed Only</div><div class="boc-v">-</div></div>
      </div>
      <div class="bo-grid" style="grid-template-columns:1fr 1fr 2fr">
        <div class="bo-cell"><div class="boc-l">Bill Open</div><div class="boc-v">90</div></div>
        <div class="bo-cell"><div class="boc-l">Revenue</div><div class="boc-v">-</div></div>
        <div></div>
      </div>
      <div class="legend" style="margin:18px 0 6px;justify-content:center">
        <div class="lg"><span class="sq" style="background:#a855f7"></span>Bill Stats</div>
        <div class="lg"><span class="sq" style="background:#38bdf8"></span>Bill Open Stats</div>
        <div class="lg"><span class="sq" style="background:#eab308"></span>Email Stats</div>
        <div class="lg"><span class="sq" style="background:#22c55e"></span>SMS Stats</div>
        <div class="lg"><span class="sq" style="background:#f97316"></span>Unique Bill View Stats</div>
      </div>
      ${Charts.line([{label:'Bill Open Stats',data:TREND.open,color:'#38bdf8'},{label:'Unique Bill View Stats',data:TREND.res,color:'#f97316'}],{x:TREND.dates})}
    </div>
    <div class="home-card">
      <h3>Invoices Count Summary (B2C Sales)</h3>
      ${boFilters}
      <div class="m-empty" style="padding:70px 0">Not Enough Data</div>
    </div>
    <div class="home-card">
      <h3>📊 Sales Overview</h3>
      ${boFilters}
      <div class="m-empty" style="padding:70px 0">Not Enough Data</div>
    </div>`;
}

/* ============================================================ TICKETING OVERVIEW */
function renderTicketOverview(){
  const statusData=[
    {label:'Open',color:'#2563eb',value:KPI.OPEN},
    {label:'In Progress',color:'#fb923c',value:KPI.INPROGRESS},
    {label:'Verify',color:'#0e7490',value:KPI.VERIFY},
    {label:'Resolved',color:'#22c55e',value:KPI.RESOLVED},
    {label:'Closed',color:'#94a3b8',value:KPI.CLOSED},
    {label:'Reopen',color:'#7c3aed',value:KPI.REOPEN},
  ];
  mount().innerHTML=`
    <div class="page-head"><div><div class="page-title">Ticketing Overview</div>
      <div class="page-sub">Real-time KPI rollup · last 30 days · brand timezone</div></div>
      <button class="btn btn-primary" onclick="go('tickets')">＋ Create Ticket</button></div>
    ${kpiGrid()}
    <div class="an-grid">
      <div class="an-card"><h4>Status Distribution</h4><div class="an-sub">All open + closed tickets by status</div>${Charts.donut(statusData,{center:KPI.TOTAL,centerLabel:'Tickets'})}</div>
      <div class="an-card"><h4>Tickets Trend</h4><div class="an-sub">Created vs Resolved · daily</div>
        ${Charts.line([{label:'Created',data:TREND.open,color:'#6a1b6e'},{label:'Resolved',data:TREND.res,color:'#22c55e'}],{x:TREND.dates})}</div>
      <div class="an-card"><h4>Tickets by Source</h4><div class="an-sub">Origin channel breakdown</div>
        ${Charts.hbars(SOURCE_STATS.slice(0,6).map(s=>({label:titleCase(s.source),value:s.count,color:s.auto?'#7c3aed':'#fb923c'})))}</div>
      <div class="an-card"><h4>Recent Tickets</h4><div class="an-sub">Latest activity</div>
        <div style="display:flex;flex-direction:column;gap:10px">${TICKETS.slice(0,5).map(t=>`
          <div class="row" style="justify-content:space-between;border-bottom:1px solid var(--line-2);padding-bottom:8px;cursor:pointer" onclick="go('view/${t.ticket_number}')">
            <div><span class="tcard-num">${t.ticket_number}</span> <b style="margin-left:8px">${esc(t.title)}</b><div class="page-sub">${esc(t.brand_id)} · ${fmtAgo(t.created_at)}</div></div>
            ${statusBadge(t.ticket_status)}</div>`).join('')}</div></div>
    </div>`;
}
function kpiGrid(){
  return `<div class="kpi-grid">
    <div class="kpi k-open"><div class="k-label">Open Tickets</div><div class="k-val">${KPI.OPEN}</div></div>
    <div class="kpi k-prog"><div class="k-label">In progress Tickets</div><div class="k-val">${KPI.INPROGRESS}</div></div>
    <div class="kpi k-verify"><div class="k-label">Verify Tickets</div><div class="k-val">${KPI.VERIFY}</div></div>
    <div class="kpi k-res"><div class="k-label">Resolved Tickets</div><div class="k-val">${KPI.RESOLVED}</div></div>
    <div class="kpi k-closed"><div class="k-label">Closed Tickets</div><div class="k-val">${KPI.CLOSED}</div></div>
    <div class="kpi k-reopen"><div class="k-label">Reopen Tickets</div><div class="k-val">${KPI.REOPEN}</div></div>
    <div class="kpi"><div class="k-label">Total Tickets</div><div class="k-val">${KPI.TOTAL}</div></div></div>`;
}

/* ============================================================ ALL TICKETS */
function filteredTickets(){
  const f=state.filters;
  return TICKETS.filter(t=>{
    if(f.search){const q=f.search.toLowerCase(); if(!(t.title.toLowerCase().includes(q)||t.ticket_number.toLowerCase().includes(q)||(t.description||'').toLowerCase().includes(q))) return false;}
    if(f.assignee && t.assigned_to!==f.assignee) return false;
    if(f.priority && t.ticket_priority!==f.priority) return false;
    if(f.status && t.ticket_status!==f.status) return false;
    if(f.tag && !(t.tags||[]).includes(f.tag)) return false;
    if(f.brand && t.brand_id!==f.brand) return false;
    if(f.project && t.project_id!==f.project) return false;
    return true;
  });
}
function renderTickets(){
  const f=state.filters;
  mount().innerHTML=`
    <div class="page-head"><div class="page-title">All Tickets</div>
      <div class="row">
        <select class="select fdrop" id="fBrand" style="width:170px"><option value="">Brands</option>${BRANDS.map(b=>`<option ${f.brand===b?'selected':''}>${b}</option>`).join('')}</select>
        <select class="select fdrop" id="fProject" style="width:200px"><option value="">Project</option>${PROJECTS.map(p=>`<option value="${p.project_id}" ${f.project===p.project_id?'selected':''}>${esc(p.name)}</option>`).join('')}</select>
        <button class="btn btn-primary" id="createBtn">＋ Create Ticket</button>
      </div></div>
    ${kpiGrid()}
    <div class="filterbar">
      <div class="search-field"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>
        <input class="field" id="fSearch" placeholder="Search Ticket..." value="${esc(f.search)}"></div>
      <select class="select fdrop" id="fAssignee"><option value="">Assignee</option>${AGENTS.map(a=>`<option value="${a.email}" ${f.assignee===a.email?'selected':''}>${a.name}</option>`).join('')}</select>
      <select class="select fdrop" id="fPriority"><option value="">Priority</option>${ENUM.priority.map(p=>`<option ${f.priority===p?'selected':''}>${p}</option>`).join('')}</select>
      <select class="select fdrop" id="fStatus"><option value="">Status</option>${ENUM.status.map(s=>`<option ${f.status===s?'selected':''}>${s}</option>`).join('')}</select>
      <select class="select fdrop" id="fTag"><option value="">Tags</option>${TAGS.map(t=>`<option ${f.tag===t?'selected':''}>${t}</option>`).join('')}</select>
      <button class="btn-ghost" id="moreOpt">More Options ${state.moreOptions?'<<':'>>'}</button>
    </div>
    ${state.moreOptions?`<div class="filterbar" style="margin-top:-8px">
        <div><label class="lbl">From</label><input type="date" class="field" id="fFrom" value="${f.from}" style="width:170px"></div>
        <div><label class="lbl">To</label><input type="date" class="field" id="fTo" value="${f.to}" style="width:170px"></div>
        <button class="btn btn-light btn-sm" id="clearF" style="align-self:flex-end">Clear filters</button>
      </div>`:''}
    <div id="ticketList"></div>
    <div id="bulkBar" class="bulkbar" hidden></div>`;

  $('#createBtn').onclick=openCreateModal;
  const bind=(id,key,re=false)=>{const el=$('#'+id); if(!el)return; el.oninput=el.onchange=()=>{state.filters[key]=el.value;state.page=1;state.selected.clear();paintList();if(re)renderTickets();};};
  bind('fSearch','search'); bind('fAssignee','assignee'); bind('fPriority','priority');
  bind('fStatus','status'); bind('fTag','tag'); bind('fBrand','brand'); bind('fProject','project');
  bind('fFrom','from'); bind('fTo','to');
  $('#moreOpt').onclick=()=>{state.moreOptions=!state.moreOptions;renderTickets();};
  if($('#clearF')) $('#clearF').onclick=()=>{state.filters={search:'',assignee:'',priority:'',status:'',tag:'',brand:'',project:'',from:'',to:''};state.page=1;renderTickets();};
  paintList();
}
function paintList(){
  const all=filteredTickets();
  const start=(state.page-1)*state.pageSize;
  let rows=all.slice(start,start+state.pageSize);
  const host=$('#ticketList'); if(!host) return;
  // ensure the expanded ticket is shown even if filtered/paged out
  const expT = state.expanded ? findTicket(state.expanded) : null;
  if(expT && !rows.includes(expT)) rows = [expT, ...rows];
  if(!all.length && !expT){host.innerHTML=`<div class="empty"><div class="e-ico">🎫</div><div>No Tickets Found</div></div>`;return;}
  host.innerHTML=`<div class="ticket-list">${rows.map(t=> t.ticket_number===state.expanded ? (state.expandLoading?skeletonHTML():ticketDetailHTML(t)) : ticketCard(t)).join('')}</div>
    <div class="pagination"><span>${start+1}–${Math.min(start+state.pageSize,all.length)} of ${all.length} entries</span>
      <button class="pg" id="prevPg" ${state.page<=1?'disabled':''}>Previous</button>
      <button class="pg" id="nextPg" ${start+state.pageSize>=all.length?'disabled':''}>Next</button></div>`;
  $$('.tcard',host).forEach(c=>c.onclick=()=>go('view/'+c.dataset.num));
  // selection checkboxes (don't trigger card-expand)
  $$('.tcheck',host).forEach(l=>{ l.onclick=e=>e.stopPropagation();
    const cb=l.querySelector('input'); cb.onchange=e=>{e.stopPropagation();
      if(cb.checked) state.selected.add(cb.dataset.sel); else state.selected.delete(cb.dataset.sel);
      l.closest('.tcard').classList.toggle('tcard-sel',cb.checked); paintBulkBar(); };});
  if(expT && !state.expandLoading){ wireDetail(expT); paintTab(expT); }
  if($('#prevPg')) $('#prevPg').onclick=()=>{state.page--;paintList();};
  if($('#nextPg')) $('#nextPg').onclick=()=>{state.page++;paintList();};
  paintBulkBar();
}
function paintListKeepScroll(){ const sb=$('#sheetBody'); const sc=sb?sb.scrollTop:0; paintList(); if(sb) sb.scrollTop=sc; }
// loading skeleton shown briefly while a ticket expands (matches the app's expand transition)
function skeletonHTML(){
  const bar=(w)=>`<div class="sk" style="width:${w}"></div>`;
  return `<div class="tdetail" id="expandedTop"><div class="tdetail-card">
    <div class="td-head"><div><div class="panel-title" style="margin:0">Ticket Actions</div><div class="page-sub">Manage ticket workflow and communication</div></div>
      <div class="sk" style="width:150px;height:40px;border-radius:9px"></div></div>
    <div class="panel"><div class="row" style="gap:10px;margin-bottom:12px"><div class="sk" style="width:38px;height:38px;border-radius:10px"></div>${bar('120px')}</div>
      ${bar('55%')}<div style="height:10px"></div>${bar('80%')}<div class="row" style="justify-content:flex-end;margin-top:10px">${bar('160px')}</div></div>
    <div class="panel"><div class="kv-l">Assigned To</div><div style="height:8px"></div>${bar('100%')}</div>
    <div class="kv-grid" style="margin-top:14px">
      <div class="panel"><div class="kv-l">Collaborators</div><div style="height:8px"></div>${bar('100%')}</div>
      <div class="panel"><div class="kv-l">Group Collaborators</div><div style="height:8px"></div>${bar('100%')}</div>
    </div>
  </div></div>`;
}
function ticketCard(t){
  const isSurvey = !!t.score;                       // survey/feedback tickets show location + score bar
  const person = (t.customer_info&&t.customer_info.name) || t.created_by || 'Unknown';
  const srcLabel = titleCase(t.source_type||'MANUAL');
  const prefix = isSurvey ? `${srcLabel} (${esc(t.project_name)}): ` : `${srcLabel}: `;
  const sel=state.selected.has(t.ticket_number);
  return `<div class="tcard ${sel?'tcard-sel':''}" data-num="${t.ticket_number}">
    <div class="tcard-top">
      <label class="tcheck" title="Select ticket"><input type="checkbox" data-sel="${t.ticket_number}" ${sel?'checked':''}></label>
      <div class="tcard-ico">💬</div>
      <div class="tcard-main">
        <div class="tcard-meta">
          <span class="tcard-brand">${esc(t.brand_id)}</span>
          <span class="tcard-num">${t.ticket_number}</span>
          <span class="tcard-assignee">👤 ${esc(maskName(t,person))}</span>
          <span>📅 Created: ${fmtDT(t.created_at)}</span>
        </div>
        <div class="tcard-title">${prefix}<b>${esc(t.title)}</b></div>
        ${isSurvey&&t.location?`<div class="tcard-loc">📍 ${esc(t.location)}</div>`:''}
        ${isSurvey?`<div class="tcard-tags"><span class="score-chip">${esc(t.score)}</span>${(t.score_cats||[]).map(c=>`<span>"${esc(c)}"</span>`).join(' ')}</div>`:''}
      </div>
      <div class="tcard-badges">
        ${(t.ticket_status==='AUTO_ESCALATED'||t.ticket_status==='ESCALATED')?`<span class="badge b-escalated">${titleCase(t.ticket_status)}</span>`:''}
        ${prioBadge(t.ticket_priority)}
        ${statusBadge(t.ticket_status==='AUTO_ESCALATED'||t.ticket_status==='ESCALATED'?'OPEN':t.ticket_status)}
      </div>
    </div>
    <div class="tcard-foot"><span>Assigned to <b>${esc(t.assigned_name||t.group_assigned_to||agentName(t.assigned_to)||'—')}</b> | Created by <b>${esc(t.created_by)}</b></span>${slaBadge(t)}</div>
  </div>`;
}

/* ============================================================ CREATE TICKET MODAL */
const draft = {};
function openCreateModal(){
  Object.assign(draft,{brandProject:'pe_test_2', customer:null, custEmail:'',custPhone:'',custName:'',custId:'',
    invoices:[], source:'', store:'', incidentDate:'', incidentTime:'', title:'', priority:'MEDIUM',
    type:'Complaint', sentiment:'', category:'', categoryOther:'', subCategory:'', subCategoryOther:'',
    assignee:'', desc:'', sku:'', tags:[], files:[]});
  openModal(createModalHTML(), null, {full:true});
  wireCreateModal();
}
function pj(){ return PROJECTS.find(p=>p.project_id===draft.brandProject)||PROJECTS[0]; }
function createValid(){
  const catOk = draft.category && (draft.category!=='Other'||draft.categoryOther.trim());
  const subOk = draft.category==='Other' ? true : (draft.subCategory && (draft.subCategory!=='Other'||draft.subCategoryOther.trim()));
  return !!(draft.custName.trim() && (draft.custEmail||draft.custPhone) &&
    draft.source && draft.store && draft.incidentDate &&
    draft.type && draft.sentiment && draft.title.trim() && draft.priority && draft.assignee &&
    (draft.desc||'').trim() && catOk && subOk);
}
function createModalHTML(){
  const p=pj();
  const cust=draft.customer;
  const canCreate = createValid();
  return `
  <div class="modal-head"><div class="mh-ico">＋</div><h2>Create New Support Ticket</h2><button class="modal-close" data-close>×</button></div>
  <div class="modal-body" id="createBody">

    <div class="fsection">
      <div class="fsection-head"><div class="fs-ico red">🏢</div><h3>Brand &amp; Project Information</h3><span class="fs-tag req">Required</span></div>
      <label class="lbl">Brand &amp; Project <span class="req">*</span></label>
      <select class="select" id="dBrandProject">${PROJECTS.map(p=>`<option value="${p.project_id}" ${draft.brandProject===p.project_id?'selected':''}>${esc(p.brand)} - ${esc(p.name)}</option>`).join('')}</select>
    </div>

    <div class="fsection">
      <div class="fsection-head"><div class="fs-ico blue">👤</div><h3>Customer Information</h3><span class="fs-tag step">Step 1: Identify Customer First</span></div>
      <label class="lbl">Search</label>
      <div class="search-inline"><input class="field" id="dCustSearch" placeholder="Search by phone or email"><button class="btn btn-light" id="dCustSearchBtn">Search</button></div>
      <div id="dCustMsg"></div>
      ${cust?`<div class="ok-text" style="margin-top:10px">✔ Auto-filled from selection</div>
        <button class="btn btn-light btn-sm" id="dClearCust" style="margin-bottom:14px">✕ Clear Selection &amp; Choose Different Customer</button>`:''}
      <div class="fgrid" style="margin-top:12px">
        <div><label class="lbl">Customer Email</label><input class="field" id="dEmail" placeholder="Customer Email" value="${esc(draft.custEmail)}"></div>
        <div><label class="lbl">Customer Phone</label><input class="field" id="dPhone" placeholder="Customer Phone" value="${esc(draft.custPhone)}"></div>
        <div><label class="lbl">Customer Name <span class="req">*</span></label><input class="field" id="dName" placeholder="Enter Customer's full name" value="${esc(draft.custName)}"></div>
        <div><label class="lbl">Customer ID</label><input class="field" id="dCid" placeholder="Customer ID" value="${esc(draft.custId)}"></div>
      </div>
      ${cust&&cust.invoices?`
      <div style="margin-top:18px">
        <div class="fsection-head" style="margin-bottom:10px"><div class="fs-ico blue">🧾</div><h3 style="font-size:15px">Related Invoices &amp; Orders</h3><span class="fs-tag opt">${cust.invoices.length} found</span></div>
        <input class="field" id="dInvSearch" placeholder="Search invoices by number" style="margin-bottom:8px">
        <div class="inv-list" id="dInvList">${cust.invoices.map(inv=>invRow(inv)).join('')}</div>
      </div>`:''}
    </div>

    <div class="fsection">
      <div class="fsection-head"><div class="fs-ico violet">⚡</div><h3>Source Information</h3><span class="fs-tag step">Step 2: Select Ticket Source</span></div>
      <div class="fgrid">
        <div><label class="lbl">Ticket Source Channel <span class="req">*</span></label>
          <select class="select" id="dSource"><option value="">Ticket Source</option>${ENUM.manualSource.map(m=>`<option value="${m.key}" ${draft.source===m.key?'selected':''}>${m.label}</option>`).join('')}</select>
          <div class="hint" id="dSourceHint">${draft.source?esc(ENUM.manualSource.find(m=>m.key===draft.source)?.sub||''):''}</div>
        </div>
        <div><label class="lbl">Store Name <span class="req">*</span></label>
          <select class="select" id="dStore"><option value="">Select Store</option>${STORES.map(s=>`<option value="${s.id}" ${draft.store===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
      </div>
      <div class="fgrid" style="margin-top:16px"><div><label class="lbl">Incident Date &amp; Time <span class="req">*</span></label>
        <div class="row"><input type="date" class="field" id="dIncDate" value="${draft.incidentDate}"><input type="time" class="field" id="dIncTime" value="${draft.incidentTime}" style="width:130px"></div>
        <div class="hint">When did the actual incident occur</div></div></div>
    </div>

    <div class="fsection">
      <div class="fsection-head"><div class="fs-ico amber">📄</div><h3>Ticket Details</h3><span class="fs-tag req">Required</span></div>
      <div class="fgrid">
        <div><label class="lbl">Ticket Type <span class="req">*</span></label>
          <select class="select" id="dType">${ENUM.ticketTypes.map(t=>`<option ${draft.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
        <div><label class="lbl">Customer Sentiment <span class="req">*</span></label>
          <select class="select" id="dSentiment"><option value="">Select Sentiment</option>${ENUM.sentiments.map(s=>`<option ${draft.sentiment===s?'selected':''}>${s}</option>`).join('')}</select></div>
      </div>
      <label class="lbl" style="margin-top:16px">Ticket Title <span class="req">*</span></label>
      <div style="position:relative"><input class="field" id="dTitle" placeholder="Brief summary of the issue" maxlength="200" value="${esc(draft.title)}">
        <span class="hint" id="dTitleCount" style="position:absolute;right:12px;top:11px">${draft.title.length}/200 characters</span></div>
      <div class="fgrid" style="margin-top:16px">
        <div><label class="lbl">Priority <span class="req">*</span></label>
          <select class="select" id="dPriority">${ENUM.priority.map(p=>`<option ${draft.priority===p?'selected':''}>${titleCase(p)}</option>`).join('')}</select></div>
        <div><label class="lbl">Assign To <span class="req">*</span></label>
          <select class="select" id="dAssignee"><option value="">Select Assignee</option>${AGENTS.map(a=>`<option value="${a.email}" ${draft.assignee===a.email?'selected':''}>${a.name}</option>`).join('')}</select></div>
      </div>
      <div style="margin-top:16px"><label class="lbl">Description <span class="req">*</span></label>${richText('dDesc',draft.desc,8000)}</div>
      <div style="margin-top:16px"><label class="lbl">Product Name/SKU</label><input class="field" id="dSku" placeholder="e.g., Gold Necklace SKU-123" value="${esc(draft.sku)}"></div>
    </div>

    <div class="fsection">
      <div class="fsection-head"><div class="fs-ico violet">🏷️</div><h3>Category &amp; Tags</h3><span class="fs-tag req">Required</span></div>
      <div class="fgrid">
        <div><label class="lbl">Category <span class="req">*</span></label>
          <select class="select" id="dCategory"><option value="">Select Category</option>${CATEGORY_LIST.map(c=>`<option ${draft.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
          ${draft.category==='Other'?`<input class="field" id="dCategoryOther" placeholder="Enter custom category" value="${esc(draft.categoryOther)}" style="margin-top:8px">`:''}
        </div>
        <div><label class="lbl">Sub Category ${draft.category==='Other'?'':'<span class="req">*</span>'}</label>
          ${draft.category && draft.category!=='Other'
            ? `<select class="select" id="dSubCategory"><option value="">Select Sub Category</option>${(CATEGORY_TREE[draft.category]||[]).concat('Other').map(s=>`<option ${draft.subCategory===s?'selected':''}>${esc(s)}</option>`).join('')}</select>
               ${draft.subCategory==='Other'?`<input class="field" id="dSubCategoryOther" placeholder="Enter custom sub category" value="${esc(draft.subCategoryOther)}" style="margin-top:8px">`:''}`
            : `<select class="select" disabled><option>Select a category first</option></select>`}
        </div>
      </div>
      <label class="lbl" style="margin-top:16px">Suggested Tags</label>
      <div class="chips" id="dSuggested">${(p.creationLogic.flatMap(c=>c.tags).concat(['cod','asdfghkl'])).filter((v,i,a)=>a.indexOf(v)===i).map(t=>`<button type="button" class="chip tag ${draft.tags.includes(t)?'on':''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <label class="lbl" style="margin-top:16px">Add Custom Tags</label>
      <div class="search-inline"><input class="field" id="dCustomTag" placeholder="Type a custom tag..."><button class="btn btn-light" id="dAddTag">＋ Add Tag</button></div>
      <label class="lbl" style="margin-top:16px">Selected Categories &amp; Tags</label>
      <div class="sel-box" id="dSelected">${selectedChips()}</div>
    </div>

    <div class="fsection">
      <div class="fsection-head"><div class="fs-ico violet">📎</div><h3>Attachments</h3><span class="fs-tag opt">Optional</span></div>
      <div class="dropzone" id="dDrop"><div>Drag and drop files here, or click to select</div>
        <div class="dz-sub">(Only images, pdfs, excels and csvs are allowed)</div><span class="dz-browse">Browse Files</span>
        <input type="file" id="dFile" multiple style="display:none" accept="image/*,.pdf,.xls,.xlsx,.csv"></div>
      <div id="dFiles">${draft.files.map((f,i)=>`<span class="file-pill">📄 ${esc(f.name)} · ${(f.size/1024).toFixed(0)}KB <button data-rmfile="${i}">×</button></span>`).join('')}</div>
    </div>
  </div>
  <div class="modal-foot"><span class="foot-note">ⓘ Fields marked with <span style="color:#ef4444">*</span> are required • At least Email OR Phone required</span>
    <div class="spacer"></div>
    <button class="btn btn-light" data-close>Cancel</button>
    <button class="btn btn-primary" id="dCreate" ${canCreate?'':'disabled'}>＋ Create Ticket</button></div>`;
}
function invRow(inv){const sel=draft.invoices.includes(inv.no);
  return `<label class="inv-row ${sel?'sel':''}"><input type="checkbox" data-inv="${esc(inv.no)}" ${sel?'checked':''}>
    <div><div class="inv-name">${esc(inv.no)}</div><div class="inv-meta"><span>📅 ${inv.date}</span><span>💰 ${inv.amount}</span><span>📦 ${inv.items} item(s)</span></div></div></label>`;}
function resolvedCategory(){ return draft.category==='Other'?(draft.categoryOther.trim()||'Other'):draft.category; }
function resolvedSubCategory(){ return draft.subCategory==='Other'?(draft.subCategoryOther.trim()||'Other'):draft.subCategory; }
function selectedChips(){
  const chips=[];
  if(draft.category) chips.push(`<span class="sel-chip" style="border-color:var(--primary-700);color:var(--primary-700)">📁 ${esc(resolvedCategory())}</span>`);
  if(draft.subCategory) chips.push(`<span class="sel-chip">↳ ${esc(resolvedSubCategory())}</span>`);
  draft.tags.forEach(t=>chips.push(`<span class="sel-chip">${esc(t)} <button data-rmtag="${esc(t)}">×</button></span>`));
  return chips.join('')||'<span class="hint">Nothing selected yet</span>';
}
function richText(id,val,max){
  return `<div class="rt"><div class="rt-bar">
    <button title="Bold"><b>B</b></button><button title="Italic"><i>I</i></button><button title="Underline"><u>U</u></button><button title="Strike"><s>S</s></button>
    <button title="Bullets">•≡</button><button title="Numbered">1.</button><button title="Link">🔗</button><span style="width:1px;height:18px;background:var(--line);margin:0 2px"></span>
    <button title="Align">≡</button><span class="swatch"></span><select><option>16px</option><option>14px</option><option>18px</option></select></div>
    <textarea id="${id}" placeholder="Type here..." data-max="${max}">${esc(val)}</textarea>
    <div class="rt-count" id="${id}Count">${(val||'').length}/${max} characters</div></div>`;
}
function rerenderCreate(){
  const sc = $('#createBody') ? $('#createBody').scrollTop : 0;   // preserve scroll
  $('#modalRoot .modal').innerHTML=createModalHTML();
  wireCreateModal();
  const body=$('#createBody'); if(body) body.scrollTop=sc;        // restore scroll
}
function wireCreateModal(){
  const m=$('#modalRoot');
  $$('[data-close]',m).forEach(b=>b.onclick=closeModal);
  $('#dBrandProject').onchange=e=>{draft.brandProject=e.target.value;rerenderCreate();};
  const searchCust=()=>{
    const q=($('#dCustSearch').value||'').trim();
    const c=CUSTOMERS[q];
    if(c){draft.customer=c;draft.custEmail=c.email;draft.custPhone=c.phone;draft.custName=c.name;draft.custId=c.id;draft.invoices=[];rerenderCreate();toast('Customer found',c.name);}
    else{$('#dCustMsg').innerHTML='<div class="err-text">Customer doesn\'t exists.</div>';}
  };
  $('#dCustSearchBtn').onclick=searchCust;
  $('#dCustSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();searchCust();}};
  if($('#dClearCust')) $('#dClearCust').onclick=()=>{draft.customer=null;draft.custEmail=draft.custPhone=draft.custName=draft.custId='';draft.invoices=[];rerenderCreate();};
  ['dEmail|custEmail','dPhone|custPhone','dName|custName','dCid|custId','dSku|sku'].forEach(p=>{const[id,k]=p.split('|');const el=$('#'+id);if(el)el.oninput=()=>{draft[k]=el.value;syncCreateBtn();};});
  if($('#dInvList')) $$('#dInvList input').forEach(cb=>cb.onchange=()=>{const no=cb.dataset.inv;if(cb.checked)draft.invoices.push(no);else draft.invoices=draft.invoices.filter(x=>x!==no);cb.closest('.inv-row').classList.toggle('sel',cb.checked);});
  $('#dSource').onchange=e=>{draft.source=e.target.value;if($('#dSourceHint'))$('#dSourceHint').textContent=ENUM.manualSource.find(m=>m.key===draft.source)?.sub||'';syncCreateBtn();};
  $('#dStore').onchange=e=>{draft.store=e.target.value;syncCreateBtn();};
  if($('#dIncDate')) $('#dIncDate').onchange=e=>{draft.incidentDate=e.target.value;syncCreateBtn();};
  if($('#dIncTime')) $('#dIncTime').onchange=e=>draft.incidentTime=e.target.value;
  $('#dTitle').oninput=e=>{draft.title=e.target.value;$('#dTitleCount').textContent=`${e.target.value.length}/200 characters`;syncCreateBtn();};
  $('#dType').onchange=e=>{draft.type=e.target.value;syncCreateBtn();};
  $('#dSentiment').onchange=e=>{draft.sentiment=e.target.value;syncCreateBtn();};
  $('#dPriority').onchange=e=>{draft.priority=e.target.value.toUpperCase();};
  $('#dAssignee').onchange=e=>{draft.assignee=e.target.value;syncCreateBtn();};
  const dd=$('#dDesc'); dd.oninput=()=>{draft.desc=dd.value;$('#dDescCount').textContent=`${dd.value.length}/8000 characters`;syncCreateBtn();};
  // Category → Sub Category (dependent). Changing category resets sub-category and re-renders.
  $('#dCategory').onchange=e=>{draft.category=e.target.value;draft.categoryOther='';draft.subCategory='';draft.subCategoryOther='';rerenderCreate();};
  if($('#dCategoryOther')) $('#dCategoryOther').oninput=e=>{draft.categoryOther=e.target.value;$('#dSelected').innerHTML=selectedChips();wireSelected();syncCreateBtn();};
  if($('#dSubCategory')) $('#dSubCategory').onchange=e=>{draft.subCategory=e.target.value;draft.subCategoryOther='';rerenderCreate();};
  if($('#dSubCategoryOther')) $('#dSubCategoryOther').oninput=e=>{draft.subCategoryOther=e.target.value;$('#dSelected').innerHTML=selectedChips();wireSelected();};
  $$('#dSuggested .chip').forEach(c=>c.onclick=()=>{const tg=c.dataset.tag;draft.tags.includes(tg)?draft.tags=draft.tags.filter(x=>x!==tg):draft.tags.push(tg);c.classList.toggle('on');$('#dSelected').innerHTML=selectedChips();wireSelected();});
  $('#dAddTag').onclick=()=>{const v=$('#dCustomTag').value.trim();if(v&&!draft.tags.includes(v)){draft.tags.push(v);$('#dCustomTag').value='';$('#dSelected').innerHTML=selectedChips();wireSelected();}};
  $('#dCustomTag').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#dAddTag').click();}};
  wireSelected();
  $('#dDrop').onclick=()=>$('#dFile').click();
  $('#dFile').onchange=e=>{[...e.target.files].forEach(f=>draft.files.push({name:f.name,size:f.size,type:f.type}));paintFiles();};
  $('#dDrop').ondragover=e=>{e.preventDefault();$('#dDrop').style.borderColor='var(--primary)';};
  $('#dDrop').ondragleave=()=>$('#dDrop').style.borderColor='';
  $('#dDrop').ondrop=e=>{e.preventDefault();$('#dDrop').style.borderColor='';[...e.dataTransfer.files].forEach(f=>draft.files.push({name:f.name,size:f.size,type:f.type}));paintFiles();};
  $('#dCreate').onclick=submitCreate;
  function wireSelected(){$$('#dSelected [data-rmcat]').forEach(b=>b.onclick=()=>{draft.categories=draft.categories.filter(x=>x!==b.dataset.rmcat);rerenderCreate();});$$('#dSelected [data-rmtag]').forEach(b=>b.onclick=()=>{draft.tags=draft.tags.filter(x=>x!==b.dataset.rmtag);rerenderCreate();});}
  function paintFiles(){$('#dFiles').innerHTML=draft.files.map((f,i)=>`<span class="file-pill">📄 ${esc(f.name)} · ${(f.size/1024).toFixed(0)}KB <button data-rmfile="${i}">×</button></span>`).join('');$$('#dFiles [data-rmfile]').forEach(b=>b.onclick=()=>{draft.files.splice(+b.dataset.rmfile,1);paintFiles();});syncCreateBtn();}
  paintFiles();
}
function syncCreateBtn(){const b=$('#dCreate');if(!b)return; b.disabled=!createValid();}
function submitCreate(){
  const p=pj();
  const store=STORES.find(s=>s.id===draft.store);
  const prefix=(p.name.match(/\b\w/g)||['T']).slice(0,4).join('').toUpperCase();
  const cat=resolvedCategory(), sub=resolvedSubCategory();
  const t=mkTicket({num:nextTicketNo(prefix), brand:p.brand, project:p.project_id, projectName:p.name,
    title:draft.title.trim(), status:'OPEN', type:draft.type, priority:draft.priority, source:'MANUAL', manualSource:draft.source,
    sentiment:draft.sentiment||null, subCategory:sub||null,
    store:draft.store||null, storeName:store?store.name:null, location:store?store.address:null,
    city:store?store.city:null, state:store?store.state:null, zone:store?store.zone:null, country:store?store.country:'India',
    assigned:draft.assignee, assignedName:agentName(draft.assignee), createdBy:'Rahul Ukey',
    customer:{name:draft.custName||'—', email:draft.custEmail, phone:draft.custPhone, id:draft.custId},
    description:draft.desc, categories:cat?[cat]:[], tags:draft.tags.slice(),
    skus:draft.sku?[draft.sku]:[], billId:draft.invoices[0]||null,
    attachments:draft.files.map((f,i)=>({attachment_id:'att_'+Date.now()+i, filename:f.name, size_bytes:f.size, mime_type:f.type||'application/octet-stream', uploaded_by:'rahul.ukey@karnival.com', uploaded_at:new Date()})),
    history:[{field:'status', old:'—', neu:'OPEN', by:'rahul.ukey@karnival.com', at:new Date()},
             {field:'assigned_to', old:'—', neu:agentName(draft.assignee), by:'rahul.ukey@karnival.com', at:new Date()}],
  });
  TICKETS.unshift(t); KPI.OPEN++; KPI.TOTAL++;
  LOGS.unshift({at:new Date(), ticket:t.ticket_number, event:'CREATED', actor:'Rahul Ukey', detail:`Ticket created from ${titleCase(draft.source)}`});
  closeModal(); toast('Ticket created', `${t.ticket_number} · ${t.title}`); go('view/'+t.ticket_number);
}

/* ============================================================ TICKET DETAIL (inline accordion) */
let detailTab='description';
function findTicket(num){ return TICKETS.find(t=>t.ticket_number===num); }
function renderDetail(num){ state.expanded=num; renderTickets(); }   // deep-link → expand inline

// green SLA countdown pill ("L0: 46h 6m to L1")
function slaPill(t){
  if(t.escalation_info) return `<span class="badge sla-breach">L${t.escalation_info.level} Breached</span>`;
  const ms = t.due_date - Date.now();
  if(ms<=0) return `<span class="badge sla-breach">L0 Breached</span>`;
  const mins=Math.floor(ms/60000), d=Math.floor(mins/1440), h=Math.floor((mins%1440)/60), m=mins%60;
  const txt = d>0?`${d}d ${h}h`:`${h}h ${m}m`;
  return `<span class="sla-pill">L0: ${txt} to L1</span>`;
}
function billStrip(t){
  if(!t.bill_id) return '';
  const items=t.line_items||[];
  return `<div class="panel bill-strip" style="margin-top:14px">
    <div class="row" id="billToggle" style="gap:34px;cursor:${items.length?'pointer':'default'}">
      <div class="bs-ico">🧾</div>
      <div><div class="kv-l">Bill Number:</div><div style="font-weight:600">#${esc(t.bill_id)}</div></div>
      <div><div class="kv-l">Amount:</div><div style="font-weight:600">${esc(t.amount||'—')}</div></div>
      <div><div class="kv-l">Receipt Date:</div><div style="font-weight:600">${t.receipt_date?fmtDT(t.receipt_date):'—'}</div></div>
      <div class="spacer"></div>${items.length?`<span id="billChevron" style="color:var(--muted);font-size:18px">⌄</span>`:''}</div>
    ${items.length?`<div id="billItems" style="display:none;margin-top:14px;border-top:1px solid var(--line-2);padding-top:12px">
      <table class="tbl" style="border:none"><thead><tr><th style="background:none">Product</th><th style="background:none">No of Units</th><th style="background:none">Unit Price</th><th style="background:none">Total Amount</th></tr></thead>
      <tbody>${items.map(li=>`<tr><td style="font-weight:600">${esc(li.product)}</td><td>${li.units}</td><td>${esc(li.unitPrice)}</td><td style="font-weight:700">${esc(li.total)}</td></tr>`).join('')}</tbody></table></div>`:''}
  </div>`;
}
function sentBadge(s){ return `<span class="badge ${s==='Detractor'?'p-high':s==='Promoter'?'b-resolved':'p-medium'}">${esc(s)}</span>`; }
function deriveSent(t){ if(t.sentiment) return t.sentiment; const n=parseInt(t.score); return isNaN(n)?'':(n<=6?'Detractor':n<=8?'Passive':'Promoter'); }
// right-side card: survey result for survey tickets, else category/sub-category
function surveyOrCategoryCard(t){
  if(t.score){
    return `<div class="panel survey-card"><div class="row" style="justify-content:space-between;align-items:flex-start">
      <div><span class="score-chip">${esc(t.score)}</span> ${deriveSent(t)?sentBadge(deriveSent(t)):''}
        <div class="sc-cats">${(t.score_cats||[]).map(c=>`"${esc(c)}"`).join('<br>')}</div></div>
      <button class="btn btn-light btn-sm" id="viewSurvey">View Survey</button></div></div>`;
  }
  if(t.categories&&t.categories.length){
    return `<div class="panel"><div class="kv-l">🗂️ Category &amp; Sub Category</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px">
        <span class="sel-chip" style="border-color:var(--primary-700);color:var(--primary-700)">📁 ${esc(t.categories[0])}</span>
        ${t.sub_category?`<span style="color:var(--muted)">›</span><span class="sel-chip">${esc(t.sub_category)}</span>`:'<span class="hint">No sub category</span>'}
        ${t.sentiment?`<span style="margin-left:auto">${sentBadge(t.sentiment)}</span>`:''}
      </div></div>`;
  }
  return `<div class="panel"><div class="page-sub">No survey linked</div></div>`;
}
function ticketDetailHTML(t){
  detailTab='description';
  return `<div class="tdetail" id="expandedTop"><div class="tdetail-card" id="expandedCard" title="Click to collapse">
    <div class="td-head">
      <div><div class="panel-title" style="margin:0">Ticket Actions</div><div class="page-sub">Manage ticket workflow and communication</div></div>
      <button class="btn btn-primary" id="replyBtn">Reply to Customer</button>
    </div>
    <div class="panel">
      <div class="row" style="justify-content:space-between;align-items:flex-start">
        <div class="row" style="gap:10px">
          <div class="tcard-ico" id="collapseIco" style="cursor:pointer" title="Click to collapse">💬</div>
          <span class="tcard-brand">${esc(t.brand_id)}</span><span class="tcard-num">${t.ticket_number}</span></div>
        ${t.bill_id?`<span class="inv-chip">📄 Invoice #${esc(t.bill_id)}</span>`:''}
      </div>
      <div class="detail-title">${esc(t.title)} <button class="btn-ghost" id="editTitle" title="Edit">✎</button></div>
      <div class="detail-controls">
        <select class="select" id="dvPriority">${ENUM.priority.map(p=>`<option ${t.ticket_priority===p?'selected':''}>${titleCase(p)}</option>`).join('')}</select>
        <select class="select" id="dvStatus">${ENUM.status.map(s=>`<option ${t.ticket_status===s?'selected':''}>${titleCase(s)}</option>`).join('')}</select>
        <select class="select" id="dvGroupAssign"><option value="">Assign group</option>${GROUPS.concat(STORES.map(s=>s.name)).map(g=>`<option ${t.group_assigned_to===g?'selected':''}>${esc(g)}</option>`).join('')}</select>
        <input type="date" class="select" id="dvDue" value="${t.due_date?t.due_date.toISOString().slice(0,10):''}">
      </div>
      <div class="row" style="justify-content:space-between;margin-top:12px">${slaPill(t)}<span class="page-sub">Created: ${fmtDT(t.created_at)}</span></div>
    </div>

    ${billStrip(t)}

    <div class="kv-grid" style="margin-top:14px">
      ${t.location
        ? `<div class="panel"><div class="cust-line" style="align-items:flex-start;gap:10px"><div style="color:var(--primary);font-size:18px">📍</div>
            <div><div class="kv-l">Store Location</div><div class="c-name" style="color:var(--primary-700)">${esc(t.store_name||t.location)}</div></div></div></div>
           ${surveyOrCategoryCard(t)}`
        : `<div style="grid-column:1/-1">${surveyOrCategoryCard(t)}</div>`}

      <div class="panel"><div class="kv-l">Customer</div>${t.customer_info?`<div class="cust-line" style="margin-top:8px"><div class="avatar">${initials(t.customer_info.name)}</div>
        <div><div class="c-name">${esc(maskName(t,t.customer_info.name))}</div><div class="c-sub">${esc(maskPhone(t,t.customer_info.phone))}</div><div class="c-sub">${esc(maskEmail(t,t.customer_info.email))}</div></div></div>`:'<div class="page-sub">No customer linked</div>'}</div>
      <div class="panel"><div class="kv-l">Assigned To</div>
        <select class="select" id="dvAssignee" style="background:#fff;margin-top:8px"><option value="">Unassigned</option>${AGENTS.map(a=>`<option value="${a.email}" ${t.assigned_to===a.email?'selected':''}>${a.name}</option>`).join('')}</select>
        ${t.assigned_to===CURRENT_USER.email
          ? `<button class="btn btn-light btn-sm" id="dvAssignMe" style="margin-top:8px" disabled>✓ Assigned to you</button>`
          : `<button class="btn btn-light btn-sm" id="dvAssignMe" style="margin-top:8px">👤 Assign to me</button>`}</div>

      <div class="panel"><div class="kv-l">👤 Collaborators</div><select class="select" id="dvCollab" style="background:#fff;margin-top:8px"><option value="">Collaborators</option>${AGENTS.map(a=>`<option value="${a.email}">${a.name}</option>`).join('')}</select><div id="collabChips" style="margin-top:8px"></div></div>
      <div class="panel"><div class="kv-l">👥 Group Collaborators</div><select class="select" id="dvGroup" style="background:#fff;margin-top:8px"><option value="">Group Collaborators</option>${GROUPS.map(g=>`<option>${g}</option>`).join('')}</select><div id="groupChips" style="margin-top:8px"></div></div>

      <div class="panel"><div class="kv-l">Tags</div>
        <select class="select" id="dvTagSelect" style="background:#fff;margin-top:8px"><option value="">Select Tags</option>${TAGS.filter(tg=>!(t.tags||[]).includes(tg)).map(tg=>`<option>${esc(tg)}</option>`).join('')}</select>
        <div id="dvTags" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">${(t.tags||[]).map(tg=>`<span class="sel-chip">${esc(tg)} <button data-rmt="${esc(tg)}">×</button></span>`).join('')}</div></div>
      <div class="panel"><div class="kv-l">Attachments</div><button class="btn btn-primary btn-sm" id="dvAddFile" style="margin:8px 0">＋ Add File</button><input type="file" id="dvFileInput" style="display:none">
        <div id="dvAtt">${(t.attachments||[]).map(attRow).join('')||'<span class="hint">No files attached</span>'}</div></div>
    </div>

    <div class="panel" style="margin-top:14px;padding:0">
      <div class="tabs" style="margin-bottom:0">
        <div class="tab active" data-tab="description"><span>📄</span> Description</div>
        <div class="tab" data-tab="comments"><span>💬</span> Comment</div>
        <div class="tab" data-tab="history"><span>🕘</span> History</div>
      </div>
      <div id="tabBody" style="padding:20px"></div>
    </div>
  </div></div>`;
}
function infoRow(l,v){return `<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line-2)"><span class="page-sub" style="margin:0">${l}</span><span style="font-weight:600">${v}</span></div>`;}
function attRow(a){return `<div class="att-row"><div class="att-ico">📄</div><div style="flex:1"><div style="font-weight:600;font-size:13px">${esc(a.filename)}</div><div class="att-meta">${(a.size_bytes/1024).toFixed(0)}KB · ${esc(a.mime_type)} · ${esc(agentName(a.uploaded_by))}</div></div><button class="btn-ghost" title="Download">⬇</button></div>`;}
const maskName=(t,n)=>t.hide_personal_data&&n?n.split(' ')[0]+' ***':n;
const maskEmail=(t,e)=>t.hide_personal_data&&e?e.slice(0,3)+'***@***.com':e;
const maskPhone=(t,p)=>t.hide_personal_data&&p?'+'+p.slice(0,2)+'****'+p.slice(-4):p;

function wireDetail(t){
  $('#dvPriority').onchange=e=>{const old=t.ticket_priority;t.ticket_priority=e.target.value.toUpperCase();pushHistory(t,'priority',titleCase(old),titleCase(t.ticket_priority));toast('Priority updated',titleCase(t.ticket_priority));};
  $('#dvStatus').onchange=e=>{const old=t.ticket_status;const nw=e.target.value.toUpperCase().replace(/ /g,'_');
    if(nw==='RESOLVED'){ openResolveCloseModal(t,'resolve',old,e.target); return; }
    if(nw==='CLOSED'){ openResolveCloseModal(t,'close',old,e.target); return; }
    transitionStatus(t,old,nw);paintListKeepScroll();};
  $('#dvAssignee').onchange=e=>{t.assigned_to=e.target.value;t.assigned_name=agentName(e.target.value);pushHistory(t,'assigned_to','—',t.assigned_name);toast('Reassigned',t.assigned_name);LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'ASSIGNED',actor:'Rahul Ukey',detail:'Assigned to '+t.assigned_name});};
  if($('#dvAssignMe')) $('#dvAssignMe').onclick=(e)=>{e.stopPropagation();const old=t.assigned_name||'—';t.assigned_to=CURRENT_USER.email;t.assigned_name=CURRENT_USER.name;pushHistory(t,'assigned_to',old,CURRENT_USER.name);LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'ASSIGNED',actor:CURRENT_USER.name,detail:'Self-assigned to '+CURRENT_USER.name});paintListKeepScroll();toast('Assigned to you',CURRENT_USER.name);};
  if($('#dvGroupAssign')) $('#dvGroupAssign').onchange=e=>{t.group_assigned_to=e.target.value||null;pushHistory(t,'group_assigned_to','—',t.group_assigned_to||'—');toast('Group assignment updated',t.group_assigned_to||'Cleared');};
  $('#dvDue').onchange=e=>{t.due_date=new Date(e.target.value);t.is_overdue=t.due_date<new Date();toast('Due date set',fmtDT(t.due_date));};
  $('#editTitle').onclick=()=>{const v=prompt('Edit ticket title',t.title);if(v&&v.trim()){t.title=v.trim();paintListKeepScroll();toast('Title updated');}};
  $('#replyBtn').onclick=()=>openReplyModal(t);
  if($('#dvTagSelect')) $('#dvTagSelect').onchange=e=>{const v=e.target.value;if(v){t.tags=t.tags||[];if(!t.tags.includes(v)){t.tags.push(v);paintListKeepScroll();}}};
  $$('#dvTags [data-rmt]').forEach(b=>b.onclick=()=>{t.tags=t.tags.filter(x=>x!==b.dataset.rmt);paintListKeepScroll();});
  const collab=[],groups=[];
  $('#dvCollab').onchange=e=>{if(e.target.value&&!collab.includes(e.target.value)){collab.push(e.target.value);$('#collabChips').innerHTML=collab.map(c=>`<span class="sel-chip">${esc(agentName(c))}</span>`).join('');}e.target.value='';};
  $('#dvGroup').onchange=e=>{if(e.target.value&&!groups.includes(e.target.value)){groups.push(e.target.value);$('#groupChips').innerHTML=groups.map(g=>`<span class="sel-chip">${esc(g)}</span>`).join('');}e.target.value='';};
  $('#dvAddFile').onclick=()=>$('#dvFileInput').click();
  $('#dvFileInput').onchange=e=>{[...e.target.files].forEach(f=>{t.attachments=t.attachments||[];t.attachments.push({attachment_id:'att_'+Date.now(),filename:f.name,size_bytes:f.size,mime_type:f.type||'application/octet-stream',uploaded_by:'rahul.ukey@karnival.com',uploaded_at:new Date()});});paintListKeepScroll();toast('Attachment added');};
  $$('.tab').forEach(tab=>tab.onclick=()=>{detailTab=tab.dataset.tab;$$('.tab').forEach(x=>x.classList.toggle('active',x===tab));paintTab(t);});
  // Collapse: click the 💬 ticket icon, or the card header/chrome (not a nested sub-card or control)
  if($('#collapseIco')) $('#collapseIco').onclick=(e)=>{e.stopPropagation();go('tickets');};
  if($('#expandedCard')) $('#expandedCard').onclick=(e)=>{
    if(e.target.closest('.panel,input,select,textarea,button,a,.tab,.rt,.sel-chip,[data-rmt],.inv-chip,label')) return;
    go('tickets');
  };
  if($('#viewSurvey')) $('#viewSurvey').onclick=(e)=>{e.stopPropagation();openSurveyDrawer(t);};
  if($('#billToggle')) $('#billToggle').onclick=(e)=>{e.stopPropagation();const li=$('#billItems');if(li){const open=li.style.display!=='none';li.style.display=open?'none':'block';$('#billChevron').textContent=open?'⌄':'⌃';}};
}
function applyStatus(t,old,nw){
  t.ticket_status=nw; pushHistory(t,'status',titleCase(old),titleCase(nw));
  LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'STATUS_CHANGE',actor:CURRENT_USER.name,detail:`${titleCase(old)} → ${titleCase(nw)}`});
  if(nw==='RESOLVED'){t.resolved_at=new Date();}
}
function transitionStatus(t,old,nw){ applyStatus(t,old,nw); toast('Status updated',titleCase(nw)); }

/* ============================================================ BULK ACTIONS */
function paintBulkBar(){
  const bar=$('#bulkBar'); if(!bar) return;
  const n=state.selected.size;
  if(n===0){ bar.hidden=true; bar.innerHTML=''; return; }
  bar.hidden=false;
  bar.innerHTML=`
    <div class="bb-left">
      <span class="bb-count">${n} selected</span>
      <button class="btn-ghost btn-sm" id="bbSelectAll">Select all ${filteredTickets().length}</button>
      <button class="btn-ghost btn-sm" id="bbClear">Clear</button>
    </div>
    <div class="bb-actions">
      <button class="btn btn-light btn-sm" id="bbAssignMe">👤 Assign to me</button>
      <select class="select bb-sel" id="bbAssign"><option value="">Assign to…</option>
        <optgroup label="Agents">${AGENTS.map(a=>`<option value="a:${a.email}">${a.name}</option>`).join('')}</optgroup>
        <optgroup label="Groups">${GROUPS.map(g=>`<option value="g:${esc(g)}">${esc(g)}</option>`).join('')}</optgroup></select>
      <select class="select bb-sel" id="bbStatus"><option value="">Status…</option>${ENUM.status.map(s=>`<option>${titleCase(s)}</option>`).join('')}</select>
      <select class="select bb-sel" id="bbPriority"><option value="">Priority…</option>${ENUM.priority.map(p=>`<option>${titleCase(p)}</option>`).join('')}</select>
      <select class="select bb-sel" id="bbTag"><option value="">Add tag…</option>${TAGS.map(t=>`<option>${esc(t)}</option>`).join('')}</select>
    </div>`;
  const sel=()=>[...state.selected].map(findTicket).filter(Boolean);
  $('#bbClear').onclick=()=>{state.selected.clear();paintListKeepScroll();};
  $('#bbSelectAll').onclick=()=>{filteredTickets().forEach(t=>state.selected.add(t.ticket_number));paintListKeepScroll();};
  $('#bbAssignMe').onclick=()=>bulkAssign(sel(),CURRENT_USER.email,CURRENT_USER.name,false);
  $('#bbAssign').onchange=e=>{const v=e.target.value;if(!v)return;const isGroup=v.startsWith('g:');const val=v.slice(2);
    bulkAssign(sel(), isGroup?null:val, isGroup?val:agentName(val), isGroup);};
  $('#bbStatus').onchange=e=>{if(e.target.value) bulkStatus(sel(), e.target.value.toUpperCase().replace(/ /g,'_'));};
  $('#bbPriority').onchange=e=>{if(e.target.value) bulkPriority(sel(), e.target.value.toUpperCase());};
  $('#bbTag').onchange=e=>{if(e.target.value) bulkTag(sel(), e.target.value);};
}
function bulkAssign(list, email, name, isGroup){
  if(!list.length) return;
  list.forEach(t=>{ if(isGroup){ t.group_assigned_to=name; pushHistory(t,'group_assigned_to','—',name); }
    else { t.assigned_to=email; t.assigned_name=name; pushHistory(t,'assigned_to','—',name); }
    LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'ASSIGNED',actor:CURRENT_USER.name,detail:`${isGroup?'Group ':''}Assigned to ${name} (bulk)`}); });
  toast('Bulk assigned',`${list.length} ticket(s) → ${name}`); state.selected.clear(); paintListKeepScroll();
}
function bulkPriority(list,p){ list.forEach(t=>{const old=t.ticket_priority;t.ticket_priority=p;pushHistory(t,'priority',titleCase(old),titleCase(p));});
  toast('Priority updated',`${list.length} ticket(s) → ${titleCase(p)}`); state.selected.clear(); paintListKeepScroll(); }
function bulkTag(list,tag){ list.forEach(t=>{t.tags=t.tags||[];if(!t.tags.includes(tag))t.tags.push(tag);pushHistory(t,'tag','—',tag);});
  toast('Tag added',`"${tag}" → ${list.length} ticket(s)`); state.selected.clear(); paintListKeepScroll(); }
function bulkStatus(list,nw){
  if(!list.length) return;
  if(nw==='RESOLVED'||nw==='CLOSED'){ openBulkResolveClose(list, nw==='RESOLVED'?'resolve':'close'); return; }
  list.forEach(t=>applyStatus(t,t.ticket_status,nw));
  toast('Status updated',`${list.length} ticket(s) → ${titleCase(nw)}`); state.selected.clear(); paintListKeepScroll();
}
function openBulkResolveClose(list, mode){
  const isResolve=mode==='resolve';
  const title=isResolve?`Resolve ${list.length} Tickets`:`Close ${list.length} Tickets`;
  const reasons=isResolve?RESOLVING_REASONS:CLOSING_REASONS; const verbNoun=isResolve?'Resolving':'Closing';
  let reason='',category='',note='';
  openModal(`<div class="modal-head"><div class="mh-ico">${isResolve?'✓':'🔒'}</div><h2>${title}</h2><button class="modal-close" data-close>×</button></div>
    <div class="modal-body">
      <div class="ok-text" style="margin-bottom:6px">Applying to ${list.length} selected ticket(s): ${list.map(t=>t.ticket_number).join(', ')}</div>
      <label class="lbl" style="margin-top:10px">${verbNoun} Reason <span class="req">*</span></label>
      <select class="select" id="rcReason"><option value="">Select Reason</option>${reasons.map(r=>`<option>${esc(r)}</option>`).join('')}</select>
      <label class="lbl" style="margin-top:16px">${verbNoun} Resolution Category <span class="req">*</span></label>
      <select class="select" id="rcCategory"><option value="">Select Resolution Category</option>${RESOLUTION_CATEGORIES.map(c=>`<option>${esc(c)}</option>`).join('')}</select>
      <label class="lbl" style="margin-top:16px">Please specify the reason <span class="req">*</span> (Min 20 characters)</label>
      <textarea class="field" id="rcNote" rows="4" placeholder="Enter the reason for ${isResolve?'resolving':'closing'} these tickets..."></textarea>
      <div class="hint" id="rcCount">0 / 20 characters minimum</div>
    </div>
    <div class="modal-foot"><div class="spacer"></div>
      <button class="btn btn-light" data-close>Cancel</button>
      <button class="btn btn-primary" id="rcConfirm" disabled>${isResolve?'Resolve':'Close'} ${list.length} Tickets</button></div>`, 640);
  $$('[data-close]').forEach(b=>b.onclick=closeModal);
  const sync=()=>{ $('#rcConfirm').disabled=!(reason&&category&&note.trim().length>=20); };
  $('#rcReason').onchange=e=>{reason=e.target.value;sync();};
  $('#rcCategory').onchange=e=>{category=e.target.value;sync();};
  $('#rcNote').oninput=e=>{note=e.target.value;$('#rcCount').textContent=`${note.trim().length} / 20 characters minimum`;sync();};
  $('#rcConfirm').onclick=()=>{
    const nw=isResolve?'RESOLVED':'CLOSED';
    list.forEach(t=>{ t.resolution={type:nw,reason,category,note,by:CURRENT_USER.name,at:new Date()};
      const old=t.ticket_status; applyStatus(t,old,nw);
      t.history_audit.unshift({field:isResolve?'resolution':'closure',old:titleCase(old),neu:titleCase(nw),by:CURRENT_USER.email,at:new Date(),reason,category,note}); });
    closeModal(); state.selected.clear(); paintListKeepScroll();
    toast(`${list.length} ticket(s) ${isResolve?'resolved':'closed'}`,`${reason} · ${category}`);
  };
}
function pushHistory(t,field,old,neu){t.history_audit=t.history_audit||[];t.history_audit.unshift({field,old,neu,by:'rahul.ukey@karnival.com',at:new Date()});t.updated_at=new Date();}
function paintTab(t){
  const b=$('#tabBody'); if(!b) return;
  if(detailTab==='description'){
    b.innerHTML=`<div class="row" style="justify-content:space-between;margin-bottom:10px"><span style="font-weight:700">Ticket Description</span>
        <button class="btn-ghost" id="editDesc">✎ Edit</button></div>
      ${t.description?`<div style="color:var(--ink-2);line-height:1.6">${esc(t.description)}</div>`:'<div class="page-sub">No description provided.</div>'}
      ${(t.product_skus&&t.product_skus.length)?`<div style="margin-top:14px"><span class="kv-l">Product / SKU</span><div>${esc(t.product_skus.join(', '))}</div></div>`:''}`;
    $('#editDesc').onclick=()=>{const v=prompt('Edit description',t.description||'');if(v!=null){t.description=v;paintTab(t);toast('Description updated');}};
  } else if(detailTab==='comments'){
    let mode='internal';
    b.innerHTML=`<div style="font-weight:700;margin-bottom:16px">Comments &amp; Activity</div>
      <div id="commentList">${(t.comments||[]).map(commentHTML).join('')}</div>
      <div class="comment-box">
        <div class="row" style="gap:10px;margin-bottom:12px"><div class="avatar" style="width:34px;height:34px;background:#ece7f6;color:var(--primary)">R</div>
          <select class="select" id="cMode" style="width:210px;background:#fff">
            <option value="internal">Internal comment</option><option value="public">Public reply</option></select></div>
        ${richText('newComment','',4000)}
        <div class="cb-actions" style="margin-top:12px">
          <button class="btn btn-primary btn-sm" id="addComment">Save</button>
          <button class="btn btn-light btn-sm" id="cancelComment">Cancel</button></div></div>`;
    $('#newComment').setAttribute('placeholder','Type here or @ to mention and notify someone...');
    $('#cMode').onchange=e=>mode=e.target.value;
    const ta=$('#newComment'); ta.oninput=()=>$('#newCommentCount').textContent=`${ta.value.length}/4000 characters`;
    $('#cancelComment').onclick=()=>{ta.value='';$('#newCommentCount').textContent='0/4000 characters';};
    $('#addComment').onclick=()=>{const text=ta.value.trim();if(!text){toast('Empty comment','Type something first','warn');return;}
      const mentions=[]; AGENTS.forEach(a=>{ if(text.includes('@'+a.name)) mentions.push(a.name); });
      t.comments=t.comments||[];t.comments.push({author:'Rahul Ukey',email:'rahul.ukey@karnival.com',text,internal:mode==='internal',at:new Date(),mentions});
      pushHistory(t,'comment','—',mode==='internal'?'internal note':'public reply');
      LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'COMMENT_ADDED',actor:'Rahul Ukey',detail:(mode==='internal'?'Internal':'Public')+' comment added'});
      paintListKeepScroll();toast('Comment saved',mentions.length?`Notified ${mentions.length} mention(s)`:'');};
  } else {
    b.innerHTML=`<div style="font-weight:700;margin-bottom:16px">Change History</div>
      ${historyEntries(t).map(h=>`<div class="hist-item">
        <div class="avatar" style="width:34px;height:34px;background:#eef0f5;color:#5b6472">${initials(h.actor)}</div>
        <div style="flex:1"><div class="row" style="justify-content:space-between"><div>
          <div style="font-weight:600">${esc(h.actor)}</div><div class="c-time">${fmtDateAbs(h.at)}</div></div>
          ${h.badge?`<span class="hist-badge">${esc(h.badge)}</span>`:''}</div>
          <div class="c-body" style="margin-top:6px">${h.html}</div></div></div>`).join('')||'<div class="page-sub">No history.</div>'}`;
  }
}
// build a chronological change-history feed (comments + field changes + creation)
function historyEntries(t){
  const items=[];
  (t.comments||[]).forEach(c=>items.push({at:c.at, actor:c.email||c.author, badge:c.internal?'Internal comment':'Public reply', html:`Comment: ${renderMentions(c.text)}`}));
  const pill=v=>`<span class="hist-pill">${esc(v)}</span>`;
  (t.history_audit||[]).forEach(h=>{ if(h.field==='comment') return;
    if(h.field==='resolution'||h.field==='closure'){   // resolve/close: show reason, category + the note
      items.push({at:h.at, actor:agentName(h.by)||h.by, badge: h.field==='resolution'?'Resolved':'Closed',
        html:`<b>Reason:</b> ${esc(h.reason)} &nbsp;·&nbsp; <b>Category:</b> ${esc(h.category)}${h.note?`<div class="c-body" style="margin-top:6px">${esc(h.note)}</div>`:''}`});
      return; }
    const label = h.field==='assigned_to'?'Assigned':h.field==='group_assigned_to'?'Group':titleCase(h.field);
    items.push({at:h.at, actor:agentName(h.by)||h.by, badge:'', html:`<b>${esc(label)}:</b> ${pill(h.old)} → ${pill(h.neu)}`}); });
  items.push({at:t.created_at, actor:t.created_by, badge:'', html:`${t.created_by==='Auto Created'?'Ticket Auto-created':'Ticket created'}${t.assigned_name?`<div style="margin-top:6px"><b>Assigned:</b> ${pill('N/A')} → ${pill(t.assigned_name)}</div>`:''}`});
  return items.sort((a,b)=>b.at-a.at);
}
function pj2(t){return PROJECTS.find(p=>p.project_id===t.project_id)||PROJECTS[0];}
function commentHTML(c){return `<div class="comment"><div class="avatar">${initials(c.author)}</div>
  <div style="flex:1"><div class="c-head"><span class="c-author">${esc(c.author)}</span><span class="c-time">${fmtDateAbs(c.at)}</span></div>
  <div class="c-body">${renderMentions(c.text)}</div></div></div>`;}

/* Resolve / Close ticket modal — required when status → RESOLVED or CLOSED (manual & auto tickets) */
function openResolveCloseModal(t, mode, oldStatus, selectEl){
  const isResolve = mode==='resolve';
  const title = isResolve ? 'Resolve Ticket' : 'Close Ticket';
  const reasons = isResolve ? RESOLVING_REASONS : CLOSING_REASONS;
  const verbNoun = isResolve ? 'Resolving' : 'Closing';
  const lastComment = (t.comments||[]).slice(-1)[0];
  let reason='', category='', note='';
  const revert=()=>{ if(selectEl) selectEl.value = titleCase(oldStatus); };
  openModal(`<div class="modal-head"><div class="mh-ico">${isResolve?'✓':'🔒'}</div><h2>${title}</h2><button class="modal-close" data-close>×</button></div>
    <div class="modal-body">
      <label class="lbl">Previous Comments &amp; Activity</label>
      <div class="field" style="height:auto;min-height:44px;background:var(--field);padding:10px 12px;color:var(--ink-2)">${lastComment?esc(lastComment.text):'<span class="hint">No previous comments</span>'}</div>
      <label class="lbl" style="margin-top:16px">${verbNoun} Reason <span class="req">*</span></label>
      <select class="select" id="rcReason"><option value="">Select Reason</option>${reasons.map(r=>`<option>${esc(r)}</option>`).join('')}</select>
      <label class="lbl" style="margin-top:16px">${verbNoun} Resolution Category <span class="req">*</span></label>
      <select class="select" id="rcCategory"><option value="">Select Resolution Category</option>${RESOLUTION_CATEGORIES.map(c=>`<option>${esc(c)}</option>`).join('')}</select>
      <label class="lbl" style="margin-top:16px">Please specify the reason <span class="req">*</span> (Min 20 characters)</label>
      <textarea class="field" id="rcNote" rows="4" placeholder="Enter the reason for ${isResolve?'resolving':'closing'} this ticket..."></textarea>
      <div class="hint" id="rcCount">0 / 20 characters minimum</div>
    </div>
    <div class="modal-foot"><div class="spacer"></div>
      <button class="btn btn-light" data-close>Cancel</button>
      <button class="btn btn-primary" id="rcConfirm" disabled>${title}</button></div>`, 640);
  $$('[data-close]').forEach(b=>b.onclick=()=>{revert();closeModal();});
  $('[data-overlay]')&&($('[data-overlay]').onclick=()=>{revert();closeModal();});
  const sync=()=>{ $('#rcConfirm').disabled=!(reason && category && note.trim().length>=20); };
  $('#rcReason').onchange=e=>{reason=e.target.value;sync();};
  $('#rcCategory').onchange=e=>{category=e.target.value;sync();};
  $('#rcNote').oninput=e=>{note=e.target.value;$('#rcCount').textContent=`${note.trim().length} / 20 characters minimum`;sync();};
  $('#rcConfirm').onclick=()=>{
    const nw = isResolve?'RESOLVED':'CLOSED';
    t.resolution={type:nw, reason, category, note, by:CURRENT_USER.name, at:new Date()};
    transitionStatus(t, oldStatus, nw);
    // record the resolution/closure details — reason, category AND the note — in history
    t.history_audit=t.history_audit||[];
    t.history_audit.unshift({field:isResolve?'resolution':'closure', old:titleCase(oldStatus), neu:titleCase(nw),
      by:CURRENT_USER.email, at:new Date(), reason, category, note});
    t.updated_at=new Date();
    closeModal(); paintListKeepScroll(); toast(title.replace('Ticket','')+'d', `${reason} · ${category}`);
  };
}

/* View Survey drawer — right-side panel showing the linked survey Q&A (survey/auto tickets) */
function openSurveyDrawer(t){
  const s=t.survey; const c=t.customer_info||{};
  const qHTML=(q)=>{
    if(q.type==='nps'){ const n=q.scale||10; let btns='';
      for(let i=1;i<=n;i++){ btns+=`<span class="nps-btn ${i<=q.answer?'on':''}">${i}</span>`; }
      return `<div class="sv-q">${esc(q.q)}</div><div class="nps-row">${btns}</div>`; }
    if(q.type==='single'){ return `<div class="sv-q">${esc(q.q)}</div>`+q.options.map(o=>`<div class="sv-opt ${o===q.answer?'on':''}"><span class="radio"></span>${esc(o)}</div>`).join(''); }
    return `<div class="sv-q">${esc(q.q)}</div><div class="sv-ans">${esc(q.answer)}</div>`;
  };
  const drawer=document.createElement('div');
  drawer.className='drawer-root show';
  drawer.innerHTML=`<div class="drawer-overlay"></div><div class="drawer">
    <button class="drawer-close">×</button>
    <div class="drawer-head">
      <div><b>Customer Name:</b> ${esc(maskName(t,c.name)||'—')}</div>
      <div><b>Customer Email:</b> ${esc(maskEmail(t,c.email)||'Unavailable')}</div>
      <div><b>Customer Phone No:</b> ${esc(maskPhone(t,c.phone)||'—')}</div>
      <div><b>Submission Time:</b> ${s?fmtDT(s.submittedAt):fmtDT(t.created_at)}</div>
    </div>
    <div class="drawer-body">${s?s.questions.map(q=>`<div class="sv-card">${qHTML(q)}</div>`).join(''):'<div class="page-sub">No survey data.</div>'}</div>
  </div>`;
  document.body.appendChild(drawer);
  const close=()=>drawer.remove();
  drawer.querySelector('.drawer-close').onclick=close;
  drawer.querySelector('.drawer-overlay').onclick=close;
}

function openReplyModal(t){
  let channel='EMAIL';
  openModal(`<div class="modal-head"><div class="mh-ico">✉️</div><h2>Reply to Customer</h2><button class="modal-close" data-close>×</button></div>
    <div class="modal-body">
      <div class="page-sub" style="margin-bottom:14px">Ticket <b>${t.ticket_number}</b> · ${esc(maskName(t,t.customer_info?.name)||'customer')}</div>
      <label class="lbl">Channel</label>
      <select class="select" id="rChannel" style="margin-bottom:14px"><option>EMAIL</option><option>SMS</option><option>WHATSAPP</option></select>
      <div id="rSubjWrap"><label class="lbl">Subject</label><input class="field" id="rSubject" value="[${t.ticket_number}] Re: ${esc(t.title)}" style="margin-bottom:14px"></div>
      <label class="lbl">Message</label><textarea class="field" id="rBody" rows="6" placeholder="Type your reply..."></textarea>
    </div>
    <div class="modal-foot"><span class="foot-note">Logged to communication audit</span><div class="spacer"></div>
      <button class="btn btn-light" data-close>Cancel</button><button class="btn btn-primary" id="rSend">Send</button></div>`, 620);
  $$('[data-close]').forEach(b=>b.onclick=closeModal);
  $('#rChannel').onchange=e=>{channel=e.target.value;$('#rSubjWrap').style.display=channel==='EMAIL'?'block':'none';};
  $('#rSend').onclick=()=>{const body=$('#rBody').value.trim();if(!body){toast('Empty message','','warn');return;}
    t.communication_audit=t.communication_audit||[];
    t.communication_audit.push({channel,direction:'OUT',at:new Date(),party:t.customer_info?.email||t.customer_info?.phone||'customer',subject:channel==='EMAIL'?$('#rSubject').value:'',body,by:'rahul.ukey@karnival.com'});
    LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'COMMUNICATION_SENT',actor:'Rahul Ukey',detail:`${titleCase(channel)} sent to ${t.customer_info?.email||'customer'}`});
    closeModal();paintListKeepScroll();toast('Reply sent','via '+titleCase(channel));};
}

/* ============================================================ SUPPORT */
let supportActive=null, supportChannel='Email';
function renderSupport(){
  if(!supportActive) supportActive=TICKETS[0].ticket_number;
  mount().innerHTML=`<div class="support-grid">
    <div class="support-list">
      <h3>Support Tickets</h3>
      <div class="search-field" style="margin-bottom:10px"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg><input class="field" id="sSearch" placeholder="Search Ticket" style="padding-left:38px"></div>
      <div class="sl-filters"><select class="select" id="sStatus"><option value="">All Statuses</option>${ENUM.status.map(s=>`<option>${s}</option>`).join('')}</select>
        <select class="select" id="sProject"><option value="">All Projects</option>${PROJECTS.map(p=>`<option value="${p.project_id}">${esc(p.name)}</option>`).join('')}</select>
        <button class="btn btn-light" title="Sort">⇅</button></div>
      <div class="sl-cards" id="sCards"></div>
    </div>
    <div class="conv" id="convPane"></div>
  </div>`;
  $('#sSearch').oninput=paintSupportList; $('#sStatus').onchange=paintSupportList; $('#sProject').onchange=paintSupportList;
  paintSupportList(); paintConv();
}
function paintSupportList(){
  const q=($('#sSearch')?.value||'').toLowerCase(), st=$('#sStatus')?.value, pr=$('#sProject')?.value;
  const rows=TICKETS.filter(t=>(!q||t.title.toLowerCase().includes(q)||t.ticket_number.toLowerCase().includes(q))&&(!st||t.ticket_status===st)&&(!pr||t.project_id===pr));
  $('#sCards').innerHTML=rows.map(t=>`<div class="sl-card ${t.ticket_number===supportActive?'active':''}" data-num="${t.ticket_number}">
    <div class="slc-top"><span class="slc-num">${t.ticket_number}</span><span class="b-pill" style="background:${stColor(t.ticket_status)}">${titleCase(t.ticket_status==='AUTO_ESCALATED'?'OPEN':t.ticket_status)}</span></div>
    <div class="slc-title">${esc(t.title)}</div>
    <div class="slc-agent">🎧 ${esc(t.assigned_name||agentName(t.assigned_to)||'Unassigned')}</div></div>`).join('')||'<div class="page-sub">No tickets</div>';
  $$('#sCards .sl-card').forEach(c=>c.onclick=()=>{supportActive=c.dataset.num;renderSupport();});
}
function stColor(s){return {OPEN:'#2563eb',INPROGRESS:'#b45309',VERIFY:'#0e7490',RESOLVED:'#15803d',CLOSED:'#5b6472',AUTO_ESCALATED:'#2563eb',ESCALATED:'#dc2626',REOPEN:'#7c3aed'}[s]||'#2563eb';}
function chIcon(ch){return {EMAIL:'✉️',Email:'✉️',SMS:'📱',WHATSAPP:'💬',WhatsApp:'💬',MANUAL:'📝'}[ch]||'✉️';}
function paintConv(){
  const t=findTicket(supportActive); const pane=$('#convPane'); if(!t){pane.innerHTML='';return;}
  const c=t.customer_info||{name:'Customer'};
  const msgs=(t.communication_audit||[]);
  pane.innerHTML=`
    <div class="conv-head"><div class="avatar">${initials(c.name)}</div>
      <div style="flex:1"><div class="ch-name">${esc(maskName(t,c.name))}</div>
        <div class="ch-sub">${c.email?`<span>✉️ ${esc(maskEmail(t,c.email))}</span>`:''}${c.phone?`<span>📞 ${esc(maskPhone(t,c.phone))}</span>`:''}</div></div>
      <button class="btn btn-light btn-sm" onclick="go('view/${t.ticket_number}')">View Ticket</button>
      <button class="btn btn-light btn-sm">⋮</button></div>
    <div class="conv-body" id="convBody">${msgs.length?msgs.map(m=>`<div class="msg-row ${m.direction==='OUT'?'out':'in'}">
        <div class="msg ${m.direction==='OUT'?'out':'in'}"><div class="m-top"><span class="m-chip">${esc(m.channel)}</span><span class="m-time">${fmtDT(m.at)}</span></div>
        ${m.subject&&m.channel==='EMAIL'?`<div class="m-subj">${esc(m.subject)}</div>`:''}<div class="m-text">${esc(m.body||m.subject||'')}</div></div>
        <div class="m-ico">${chIcon(m.channel)}</div></div>`).join(''):'<div class="empty" style="margin:auto"><div class="e-ico">💬</div>No messages yet. Start the conversation below.</div>'}</div>
    <div class="conv-foot"><div class="cf-top">
      <div class="channel-select"><button class="channel-btn" id="chBtn">${chIcon(supportChannel)} <span id="chLabel">${supportChannel}</span> ⌄</button>
        <div class="channel-menu" id="chMenu">
          <button data-ch="WhatsApp">💬 WhatsApp</button><button data-ch="SMS">📱 SMS</button><button data-ch="Email">✔ ✉️ Email</button></div></div>
      <button class="btn btn-light btn-sm" id="sendVia">Send via ${supportChannel}</button></div>
      <div class="cf-input"><input id="convInput" placeholder="Type a ${supportChannel} message..."><button class="send-btn" id="convSend">➤ Send</button></div></div>`;
  const body=$('#convBody'); body.scrollTop=body.scrollHeight;
  $('#chBtn').onclick=()=>$('#chMenu').classList.toggle('show');
  $$('#chMenu button').forEach(b=>b.onclick=()=>{supportChannel=b.dataset.ch;$('#chLabel').textContent=supportChannel;$('#sendVia').textContent='Send via '+supportChannel;$('#chMenu').classList.remove('show');});
  const send=()=>{const v=$('#convInput').value.trim();if(!v)return;const ch=supportChannel.toUpperCase()==='WHATSAPP'?'WHATSAPP':supportChannel.toUpperCase();
    t.communication_audit=t.communication_audit||[];t.communication_audit.push({channel:ch,direction:'OUT',at:new Date(),party:c.email||c.phone||'customer',body:v,by:'rahul.ukey@karnival.com'});
    LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'COMMUNICATION_SENT',actor:'Rahul Ukey',detail:`${titleCase(ch)} sent`});paintConv();toast('Message sent','via '+supportChannel);};
  $('#convSend').onclick=send; $('#sendVia').onclick=send;
  $('#convInput').onkeydown=e=>{if(e.key==='Enter')send();};
}

/* ============================================================ PROJECTS */
function renderProjects(){
  mount().innerHTML=`<div class="page-head"><div><div class="page-title">Projects</div><div class="page-sub">Configure escalation matrix, collaborators & auto-ticket rules</div></div>
    <button class="btn btn-primary" id="newProj">＋ New Project</button></div>
    <div class="proj-grid">${PROJECTS.map(projCard).join('')}</div>`;
  $('#newProj').onclick=()=>openProjectModal(null);
  $$('.proj-card [data-edit]').forEach(b=>b.onclick=()=>openProjectModal(b.dataset.edit));
  $$('.proj-card [data-del]').forEach(b=>b.onclick=()=>{if(confirm('Delete this project?')){const i=PROJECTS.findIndex(p=>p.project_id===b.dataset.del);PROJECTS.splice(i,1);renderProjects();toast('Project deleted','','warn');}});
}
function projCard(p){return `<div class="proj-card"><div class="row" style="justify-content:space-between"><h4>${esc(p.name)}</h4><span class="tcard-brand">${esc(p.brand)}</span></div>
  <div class="pc-desc">${esc(p.description||'')}</div>
  <div class="pc-meta"><div>Tickets<b>${p.ticketCount}</b></div><div>Escalation Levels<b>${p.matrix.length}</b></div><div>Collaborators<b>${p.collaborators.length}</b></div></div>
  <div style="margin-bottom:12px">${p.matrix.map(m=>`<span class="lvl-pill" style="display:inline-block;padding:4px 10px;margin:0 6px 6px 0">${m.level}: ${m.value}${m.unit[0].toLowerCase()}</span>`).join('')}</div>
  ${p.creationLogic.length?`<div class="page-sub" style="margin-bottom:12px">⚙️ ${p.creationLogic.length} auto-ticket rule(s)</div>`:''}
  <div class="pc-actions"><button class="btn btn-light btn-sm" data-edit="${p.project_id}">Edit</button><button class="btn btn-light btn-sm" data-del="${p.project_id}">Delete</button></div></div>`;}
function openProjectModal(id){
  const p=id?JSON.parse(JSON.stringify(PROJECTS.find(x=>x.project_id===id))):{project_id:'',brand:BRANDS[0],name:'',description:'',collaborators:[],ticketCount:0,matrix:[{level:'L1',value:2,unit:'HOURS',to:['Supervisor'],channel:'EMAIL'}],creationLogic:[]};
  const draftP=p;
  const render=()=>{
    $('#modalRoot .modal').innerHTML=`<div class="modal-head"><div class="mh-ico">📁</div><h2>${id?'Edit':'New'} Project</h2><button class="modal-close" data-close>×</button></div>
    <div class="modal-body">
      <div class="fgrid"><div><label class="lbl">Project Name <span class="req">*</span></label><input class="field" id="pName" value="${esc(draftP.name)}"></div>
        <div><label class="lbl">Brand <span class="req">*</span></label><select class="select" id="pBrand">${BRANDS.map(b=>`<option ${draftP.brand===b?'selected':''}>${b}</option>`).join('')}</select></div></div>
      <div style="margin-top:14px"><label class="lbl">Description</label><input class="field" id="pDesc" value="${esc(draftP.description||'')}"></div>
      <div style="margin-top:14px"><label class="lbl">Collaborators</label><select class="select" id="pCollab"><option value="">Add collaborator</option>${AGENTS.map(a=>`<option value="${a.email}">${a.name}</option>`).join('')}</select>
        <div class="sel-box" id="pCollabBox" style="margin-top:8px">${draftP.collaborators.map(c=>`<span class="sel-chip">${esc(agentName(c))} <button data-rmc="${c}">×</button></span>`).join('')||'<span class="hint">None</span>'}</div></div>
      <div class="fsection" style="border-top:1px solid var(--line-2);margin-top:18px">
        <div class="fsection-head"><div class="fs-ico red">⚡</div><h3>Escalation Matrix</h3></div>
        <div class="matrix-row matrix-head"><div>Level</div><div>Duration</div><div>Escalate To</div><div>Channel</div><div></div></div>
        <div id="matrixRows">${draftP.matrix.map((m,i)=>matrixRow(m,i)).join('')}</div>
        <button class="btn btn-light btn-sm" id="addLevel">＋ Add Level</button>
      </div>
    </div>
    <div class="modal-foot"><div class="spacer"></div><button class="btn btn-light" data-close>Cancel</button><button class="btn btn-primary" id="pSave">${id?'Save Changes':'Create Project'}</button></div>`;
    wire();
  };
  function matrixRow(m,i){return `<div class="matrix-row" data-row="${i}"><div class="lvl-pill">${m.level}</div>
    <div class="row" style="gap:6px"><input class="field" type="number" value="${m.value}" data-mval="${i}" style="width:70px"><select class="select" data-munit="${i}">${['HOURS','DAYS','MINUTES'].map(u=>`<option ${m.unit===u?'selected':''}>${u}</option>`).join('')}</select></div>
    <input class="field" value="${esc(m.to.join(', '))}" data-mto="${i}">
    <select class="select" data-mch="${i}">${['EMAIL','SMS','WHATSAPP'].map(c=>`<option ${m.channel===c?'selected':''}>${c}</option>`).join('')}</select>
    <button class="btn-ghost" data-mrm="${i}" style="color:#dc2626">×</button></div>`;}
  function wire(){
    $$('[data-close]').forEach(b=>b.onclick=closeModal);
    $('#pName').oninput=e=>draftP.name=e.target.value;
    $('#pBrand').onchange=e=>draftP.brand=e.target.value;
    $('#pDesc').oninput=e=>draftP.description=e.target.value;
    $('#pCollab').onchange=e=>{if(e.target.value&&!draftP.collaborators.includes(e.target.value)){draftP.collaborators.push(e.target.value);render();}};
    $$('#pCollabBox [data-rmc]').forEach(b=>b.onclick=()=>{draftP.collaborators=draftP.collaborators.filter(x=>x!==b.dataset.rmc);render();});
    $$('[data-mval]').forEach(el=>el.onchange=()=>draftP.matrix[+el.dataset.mval].value=+el.value);
    $$('[data-munit]').forEach(el=>el.onchange=()=>draftP.matrix[+el.dataset.munit].unit=el.value);
    $$('[data-mto]').forEach(el=>el.onchange=()=>draftP.matrix[+el.dataset.mto].to=el.value.split(',').map(s=>s.trim()).filter(Boolean));
    $$('[data-mch]').forEach(el=>el.onchange=()=>draftP.matrix[+el.dataset.mch].channel=el.value);
    $$('[data-mrm]').forEach(b=>b.onclick=()=>{draftP.matrix.splice(+b.dataset.mrm,1);render();});
    $('#addLevel').onclick=()=>{draftP.matrix.push({level:'L'+(draftP.matrix.length+1),value:4,unit:'HOURS',to:[],channel:'EMAIL'});render();};
    $('#pSave').onclick=()=>{if(!draftP.name.trim()){toast('Name required','','warn');return;}
      draftP.matrix.forEach((m,i)=>m.level='L'+(i+1));
      if(id){const idx=PROJECTS.findIndex(x=>x.project_id===id);PROJECTS[idx]=draftP;}
      else{draftP.project_id='proj_'+Date.now();PROJECTS.push(draftP);}
      closeModal();renderProjects();toast(id?'Project updated':'Project created',draftP.name);};
  }
  openModal('',880); render();
}

/* ============================================================ AGENTS REPORTS */
let agentSort={key:'volume',dir:-1};
function renderAgents(){
  mount().innerHTML=`<div class="page-head"><div><div class="page-title">Agents Reports</div><div class="page-sub">Per-agent KPIs · SLA %, response time, resolution rate, volume</div></div></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th data-s="name">Agent</th><th data-s="volume">Volume</th><th data-s="sla">SLA Met %</th><th data-s="avgResp">Avg Response</th><th data-s="resolution">Resolution Rate</th></tr></thead>
      <tbody id="agentBody"></tbody></table></div>`;
  paintAgents();
  $$('.tbl th').forEach(th=>th.onclick=()=>{const k=th.dataset.s;agentSort.dir=agentSort.key===k?-agentSort.dir:-1;agentSort.key=k;paintAgents();});
}
function paintAgents(){
  const rows=[...AGENT_STATS].sort((a,b)=>{const k=agentSort.key;const av=a[k],bv=b[k];return (typeof av==='string'?av.localeCompare(bv):av-bv)*agentSort.dir;});
  $('#agentBody').innerHTML=rows.map(a=>`<tr>
    <td><div class="agent-cell"><div class="avatar">${initials(a.name)}</div><div><div style="font-weight:600">${esc(a.name)}</div><div class="page-sub" style="margin:0">${esc(a.email)}</div></div></div></td>
    <td><b>${a.volume}</b></td>
    <td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${a.sla}%;background:${a.sla>=90?'#22c55e':a.sla>=80?'#fb923c':'#ef4444'}"></div></div><span style="font-weight:600">${a.sla}%</span></div></td>
    <td>${a.avgResp}</td>
    <td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${a.resolution}%"></div></div><span style="font-weight:600">${a.resolution}%</span></div></td></tr>`).join('');
}

/* ============================================================ TICKET SOURCE */
function renderSource(){
  mount().innerHTML=`<div class="page-head"><div><div class="page-title">Ticket Source</div><div class="page-sub">Where tickets originate · auto vs manual channels</div></div></div>
    <div class="an-grid">
      <div class="an-card"><h4>Source Distribution</h4><div class="an-sub">By origin channel</div>
        ${Charts.donut(SOURCE_STATS.map((s,i)=>({label:titleCase(s.source),value:s.count,color:['#6a1b6e','#7c3aed','#a855f7','#fb923c','#f59e0b','#22c55e','#2563eb','#94a3b8'][i]})),{center:SOURCE_STATS.reduce((a,b)=>a+b.count,0)})}</div>
      <div class="an-card"><h4>Volume by Source</h4><div class="an-sub">Auto-created vs manual</div>
        ${Charts.hbars(SOURCE_STATS.map(s=>({label:titleCase(s.source),value:s.count,color:s.auto?'#7c3aed':'#fb923c'})))}
        <div class="legend"><div class="lg"><span class="dot" style="background:#7c3aed"></span>Auto-created (feedback triggers)</div><div class="lg"><span class="dot" style="background:#fb923c"></span>Manual</div></div></div>
    </div>
    <div class="tbl-wrap" style="margin-top:18px"><table class="tbl"><thead><tr><th>Source Channel</th><th>Type</th><th>Tickets</th><th>Share</th></tr></thead><tbody>
      ${SOURCE_STATS.map(s=>{const tot=SOURCE_STATS.reduce((a,b)=>a+b.count,0);return `<tr><td><b>${titleCase(s.source)}</b></td><td>${s.auto?'<span class="badge b-reopen">Auto</span>':'<span class="badge b-inprogress">Manual</span>'}</td><td>${s.count}</td>
        <td><div class="bar-cell"><div class="bar-track"><div class="bar-fill" style="width:${s.count/tot*100}%"></div></div><span>${(s.count/tot*100).toFixed(1)}%</span></div></td></tr>`;}).join('')}
    </tbody></table></div>`;
}

/* ============================================================ TICKET LOGS */
function renderLogs(){
  const evColor={CREATED:'#2563eb',STATUS_CHANGE:'#fb923c',ASSIGNED:'#7c3aed',COMMENT_ADDED:'#22c55e',COMMUNICATION_SENT:'#0ea5e9',AUTO_ESCALATED:'#dc2626'};
  mount().innerHTML=`<div class="page-head"><div><div class="page-title">Ticket Logs</div><div class="page-sub">Audit trail of every ticket mutation & event</div></div></div>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Time</th><th>Ticket</th><th>Event</th><th>Actor</th><th>Detail</th></tr></thead><tbody>
      ${LOGS.map(l=>`<tr><td class="page-sub" style="margin:0">${fmtDT(l.at)}</td>
        <td><span class="tcard-num" style="cursor:pointer" onclick="go('view/${l.ticket}')">${l.ticket}</span></td>
        <td><span class="badge" style="background:${(evColor[l.event]||'#888')}22;color:${evColor[l.event]||'#888'}">${titleCase(l.event)}</span></td>
        <td>${esc(l.actor)}</td><td>${esc(l.detail)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

/* ============================================================ MODAL PRIMITIVES */
function openModal(html,width,opts={}){
  const root=$('#modalRoot');
  const cls = opts.full ? 'modal modal-full' : 'modal';
  const style = opts.full ? '' : (width?`width:min(${width}px,94vw)`:'');
  root.innerHTML=`<div class="modal-overlay" data-overlay></div><div class="${cls}" style="${style}">${html}</div>`;
  root.classList.add('show'); document.body.style.overflow='hidden';
  $('[data-overlay]',root).onclick=closeModal;
}
function closeModal(){ $('#modalRoot').classList.remove('show'); $('#modalRoot').innerHTML=''; document.body.style.overflow=''; }
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#modalRoot').classList.contains('show'))closeModal();});

/* ============================================================ NAV + BOOT */
/* accordion — one group open at a time, exactly like the live portal */
$$('.nav-parent').forEach(p=>p.onclick=()=>{
  const grp=p.closest('.nav-group'), wasOpen=grp.classList.contains('open');
  $$('.nav-group').forEach(g=>g.classList.remove('open'));
  if(!wasOpen) grp.classList.add('open');
});
$('#navToggle').onclick=()=>$('#sidebar').classList.toggle('collapsed');
$$('.nav-child').forEach(n=>n.onclick=()=>go(n.dataset.route));
$$('[data-route]').forEach(n=>{if(n.classList.contains('nav-item')&&!n.classList.contains('nav-parent'))n.onclick=()=>go(n.dataset.route);});
window.go=go;
window.router=router;
if(typeof M!=='undefined' && M.bootShell) M.bootShell();
router();
