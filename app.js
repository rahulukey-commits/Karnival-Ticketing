/* ============================================================
   Karnival Ticketing — app (router, state, views, interactions)
   ============================================================ */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const view = $('#view');

const esc = s => (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const titleCase = s => (s||'').replace(/_/g,' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const statusLabel = s => ({VERIFY:'Under Verification'}[s] || titleCase(s));
const fmtDT = d => d ? `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)} ${d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}` : '';
const fmtAgo = d => { if(!d) return ''; const s=(Date.now()-d.getTime())/1000;
  if(s<60) return 'just now'; if(s<3600) return Math.floor(s/60)+'m ago';
  if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; };
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fmtDateAbs = d => d ? `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}` : '';
const renderMentions = txt => { let s=esc(txt); AGENTS.forEach(a=>{ s=s.replace(new RegExp('@'+a.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'), `<span class="ment">@${esc(a.name)}</span>`); }); return s; };
const statusBadge = s => `<span class="badge b-${(s||'').toLowerCase()}">${statusLabel(s)}</span>`;
const prioBadge = p => `<span class="badge p-${(p||'').toLowerCase()}">${titleCase(p)}</span>`;
const slaBadge = t => { if(!t.escalation_info && !t.is_overdue) return '';
  if(t.escalation_info) return `<span class="badge sla-breach">L${t.escalation_info.level} Breached</span>`;
  return `<span class="badge ${t.is_overdue?'sla-breach':'sla-ok'}">${t.is_overdue?'SLA Breached':'On Track'}</span>`; };
const initials = n => (n||'?').trim().split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
const agentName = e => (AGENTS.find(a=>a.email===e)||{}).name || e || '—';
const CURRENT_USER = {email:'rahul.ukey@karnival.com', name:'Rahul Ukey'};   // logged-in agent (RU)
const getAgentStatusDotClass = email => {
  const status = StatusService.getAgentStatus(email);
  if(!status) return '';
  if(status.status === 'not_available') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [fromY, fromM, fromD] = status.fromDate.split('-');
    const fromDate = new Date(fromY, fromM - 1, fromD, 0, 0, 0, 0);
    const [tillY, tillM, tillD] = status.tillDate.split('-');
    const tillDate = new Date(tillY, tillM - 1, tillD, 0, 0, 0, 0);
    if(today >= fromDate && today <= tillDate) return 'unavailable';
  }
  return '';
};
const getAgentEmailFromName = name => {
  const agent = AGENTS.find(a => a.name === name);
  return agent ? agent.email : '';
};

function toast(title,msg,kind='ok'){
  const ico = kind==='ok'?'✅':kind==='warn'?'⚠️':'ℹ️';
  const t=document.createElement('div'); t.className='toast '+kind;
  t.innerHTML=`<div class="t-ico">${ico}</div><div><div class="t-title">${esc(title)}</div>${msg?`<div class="t-msg">${esc(msg)}</div>`:''}</div>`;
  $('#toastWrap').appendChild(t); setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(40px)';setTimeout(()=>t.remove(),250);},2800);
}

/* ============================================================ STATUS INDICATOR */
function updateStatusIndicator(){
  const status = StatusService.getCurrentUserStatus();
  const dot = $('#statusDot');
  const profileStatusText = $('#profileStatusText');
  const profileUnavailableInfo = $('#profileUnavailableInfo');

  // Check if unavailability is currently active (today is within the date range)
  let isCurrentlyUnavailable = false;
  if(status.status === 'not_available' && status.fromDate && status.tillDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [fromY, fromM, fromD] = status.fromDate.split('-');
    const fromDateObj = new Date(fromY, fromM - 1, fromD, 0, 0, 0, 0);
    const [tillY, tillM, tillD] = status.tillDate.split('-');
    const tillDateObj = new Date(tillY, tillM - 1, tillD, 0, 0, 0, 0);
    isCurrentlyUnavailable = today >= fromDateObj && today <= tillDateObj;
  }

  if(dot){
    dot.className = `status-dot ${isCurrentlyUnavailable ? 'unavailable' : 'available'}`;
  }

  // Update profile dropdown — status button shows only the status word based on TODAY's availability
  if(profileStatusText){
    if(isCurrentlyUnavailable) {
      profileStatusText.textContent = 'Unavailable';
    } else {
      profileStatusText.textContent = 'Available';
    }
  }

  // Update unavailable info section — shows date range if applicable
  if(profileUnavailableInfo){
    if(status.status === 'not_available' && status.fromDate && status.tillDate) {
      const formatted = StatusService.formatDateRange(status.fromDate, status.tillDate);
      if(isCurrentlyUnavailable){
        profileUnavailableInfo.textContent = `Unavailable: ${formatted}`;
      } else {
        profileUnavailableInfo.textContent = `Unavailable period: ${formatted}`;
      }
    } else {
      profileUnavailableInfo.textContent = '';
    }
  }
}

function openStatusPicker(){
  const status = StatusService.getCurrentUserStatus();
  const modal = document.createElement('div');
  modal.className = 'status-modal-overlay';
  modal.id = 'statusModal';
  // Use simplest possible CSS with explicit positioning
  modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999';
  // Ensure the modal root container is visible
  const modalRoot = $('#modalRoot');
  if(modalRoot) modalRoot.style.display = 'block';
  modal.innerHTML = `
    <div class="status-modal" style="background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.15);width:90%;max-width:420px;animation:slideUp 0.2s ease-out">
      <div class="status-modal-header" style="padding:20px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between">
        <h3 style="margin:0;font-size:16px;font-weight:600;color:var(--text)">Update Availability Status</h3>
        <button class="modal-close" onclick="document.getElementById('statusModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted);padding:0;width:24px;height:24px;display:flex;align-items:center;justify-content:center">✕</button>
      </div>
      <div class="status-modal-body" style="padding:20px">
        <div class="status-radio-group" style="display:flex;flex-direction:column;gap:12px">
          <label class="status-radio" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px;border-radius:8px;transition:background 0.2s">
            <input type="radio" name="status" value="available" ${status.status === 'available' ? 'checked' : ''} style="cursor:pointer;width:18px;height:18px">
            <span style="font-size:14px;font-weight:500;color:var(--text)">Available</span>
          </label>
          <label class="status-radio" style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:10px;border-radius:8px;transition:background 0.2s">
            <input type="radio" name="status" value="not_available" ${status.status === 'not_available' ? 'checked' : ''} style="cursor:pointer;width:18px;height:18px">
            <span style="font-size:14px;font-weight:500;color:var(--text)">Not Available</span>
          </label>
        </div>
        <div id="datePickerWrap" style="display:${status.status === 'not_available' ? 'block' : 'none'};margin-top:16px">
          <div style="margin-bottom:12px">
            <label class="status-label-text" style="display:block;font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">From</label>
            <input type="date" id="fromDateInput" class="status-date-input" value="${status.fromDate || ''}" min="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box">
          </div>
          <div>
            <label class="status-label-text" style="display:block;font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px">Till</label>
            <input type="date" id="tillDateInput" class="status-date-input" value="${status.tillDate || ''}" min="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font-size:14px;font-family:inherit;box-sizing:border-box">
          </div>
          <div class="status-helper-text" style="font-size:12px;color:var(--muted);margin-top:6px">Select your unavailable period</div>
        </div>
      </div>
      <div class="status-modal-footer" style="padding:16px 20px;border-top:1px solid var(--line);display:flex;gap:10px;justify-content:flex-end">
        <button class="btn-secondary" onclick="document.getElementById('statusModal').remove()" style="padding:8px 16px;border-radius:6px;border:none;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;background:var(--line);color:var(--text)">Cancel</button>
        <button class="btn-primary" id="statusSaveBtn" style="padding:8px 16px;border-radius:6px;border:none;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.2s;background:var(--primary);color:#fff">Save Changes</button>
      </div>
    </div>
  `;
  $('#modalRoot').appendChild(modal);

  const radios = modal.querySelectorAll('input[name="status"]');
  const fromDateInput = modal.querySelector('#fromDateInput');
  const tillDateInput = modal.querySelector('#tillDateInput');
  const datePickerWrap = modal.querySelector('#datePickerWrap');
  const saveBtn = modal.querySelector('#statusSaveBtn');

  radios.forEach(r => {
    r.onchange = () => {
      const isUnavailable = r.value === 'not_available';
      datePickerWrap.style.display = isUnavailable ? 'block' : 'none';
      if(!isUnavailable) {
        fromDateInput.value = '';
        tillDateInput.value = '';
      }
    };
  });

  const hideModalRoot = () => {
    const mr = $('#modalRoot');
    if(mr && mr.children.length === 0) mr.style.display = 'none';
  };

  modal.onclick = (e) => {
    if(e.target === modal) {
      modal.remove();
      hideModalRoot();
    }
  };

  saveBtn.onclick = () => {
    const selectedStatus = modal.querySelector('input[name="status"]:checked').value;
    const fromDate = selectedStatus === 'not_available' ? fromDateInput.value : null;
    const tillDate = selectedStatus === 'not_available' ? tillDateInput.value : null;

    if(StatusService.setUserStatus(selectedStatus, fromDate, tillDate)){
      updateStatusIndicator();
      if(selectedStatus === 'available') {
        toast('Status Updated', 'You are now available');
      } else {
        const formatted = StatusService.formatDateRange(fromDate, tillDate);
        toast('Status Updated', `Not available from ${formatted}`);
      }
      modal.remove();
      hideModalRoot();
    }
  };
}

function getAssigneeOptionsHTML(currentAssignee = null, includeUnavailable = true){
  let html = '<option value="">Unassigned</option>';
  const available = [];
  const unavailable = [];

  AGENTS.forEach(a => {
    const isAvailable = StatusService.isAgentAvailable(a.email);
    const isSelected = currentAssignee === a.email;
    const status = StatusService.getAgentStatus(a.email);
    const label = status.status === 'not_available' && status.fromDate && status.tillDate
      ? `${a.name} (unavailable: ${StatusService.formatDateRange(status.fromDate, status.tillDate)})`
      : a.name;

    if(isAvailable || isSelected){
      available.push(`<option value="${a.email}" ${isSelected ? 'selected' : ''}>${label}</option>`);
    } else if(includeUnavailable){
      const suffix = label.includes('(unavailable') ? '' : ' (unavailable)';
      unavailable.push(`<option value="${a.email}" disabled style="color:#999">${label}${suffix}</option>`);
    }
  });

  html += available.join('') + unavailable.join('');
  return html;
}

/* ---------- state ---------- */
// Generic unsaved-changes navigation guard: any view can set this to a function
// fn(next) that either calls next() immediately (nothing dirty) or intercepts
// with its own confirmation UI and calls next() only once the user confirms.
// Checked by the sheet-close button and sidebar nav clicks before navigating away.
let appUnsavedGuard = null;
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
    $('#sheetClose').onclick=()=>{ if(appUnsavedGuard) appUnsavedGuard(()=>go('home')); else go('home'); };
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

/* ============================================================ ANALYTICS MODULE
   Faithful port of ticket-analytics-prototype.html — progressive drilldown
   (Brand > Country > Zone > State > City > Store), independent filter bars,
   Open vs Closed (chart/table + config modal), Ticket Performance Overview
   (sortable + paginated + config modal). Namespaced with TA_ / ta- prefixes
   so nothing here collides with the rest of app.js. */

const TA_STATUSES = ["Open","In Progress","Under Verification","Closed","Resolved","Escalated","Reopened","Auto Closed"];
const TA_DRILL_COLOR = "#4ADE80";

/* Realistic dummy-data generator: every brand/level gets its own randomized
   (but plausibly-shaped) split, so no two brands or levels end up with
   identical or suspiciously uniform ratios. Totals always reconcile exactly
   with their parent so hierarchy sums never drift from rounding. */
const taRandRange = (min, max) => min + Math.random()*(max-min);

function taDistributeAcross(total, weights){
  const sum = weights.reduce((a,b)=>a+b,0);
  const rounded = weights.map(w => Math.round((w/sum)*total));
  let diff = total - rounded.reduce((a,b)=>a+b,0);
  if (diff !== 0){
    let idx = rounded.indexOf(Math.max(...rounded));
    if (idx < 0) idx = 0;
    rounded[idx] = Math.max(0, rounded[idx]+diff);
  }
  return rounded;
}

// Baseline shape of a realistic ticket-status mix (sums to 1); jittered per brand so
// no two brands land on identical proportions.
const TA_STATUS_BASE_WEIGHTS = [0.20,0.12,0.07,0.28,0.22,0.04,0.04,0.03]; // aligned to TA_STATUSES order
function taGenerateStatusDist(total){
  const jittered = TA_STATUS_BASE_WEIGHTS.map(w => w * taRandRange(0.7, 1.3));
  return taDistributeAcross(total, jittered);
}

function taRandWeights(n){
  // descending-ish so the first name tends to carry more volume, with enough
  // per-call jitter that the ratio differs brand to brand and level to level.
  return Array.from({length:n}, (_,i) => (n-i) * taRandRange(0.55, 1.45));
}

function taSplitDist(dist, names){
  const n = names.length;
  const weights = taRandWeights(n);
  const perStatus = dist.map(v => taDistributeAcross(v, weights));
  return names.map((name, idx) => ({ name, dist: perStatus.map(arr => arr[idx]) }));
}

const TA_CITY_NAMES = ["Riyadh","Jeddah","Dubai","Abu Dhabi","Doha","Manama"];
const TA_STORE_SUFFIXES = ["Mall Branch","City Centre","Flagship Store","Outlet"];
function taBuildBrand(name, total){
  return {
    name, dist: total,
    chain: [
      {level:"Country", items: taSplitDist(total, ["SA","AE"])},
      {level:"Zone", items: taSplitDist(total, ["Central Zone","Eastern Zone"])},
      {level:"State", items: taSplitDist(total, ["Riyadh Province","Makkah Province"])},
      {level:"City", items: taSplitDist(total, [TA_CITY_NAMES[0], TA_CITY_NAMES[1], TA_CITY_NAMES[2]])},
      {level:"Store", items: taSplitDist(total, [name+" - "+TA_STORE_SUFFIXES[0], name+" - "+TA_STORE_SUFFIXES[1], name+" - "+TA_STORE_SUFFIXES[2]])}
    ]
  };
}

const TA_BRAND_NAMES = ["RB","Skechers","LC Waikiki","BBZ","NYSAA","Aldo","Charles and Keith","Nine West",
  "Tommy Hilfiger","Steve Madden","Call It Spring","Bath and Body Works","Victoria's Secret","GAP","Old Navy",
  "Mothercare","Early Learning Centre","American Eagle","Aeropostale","Foot Locker","Toys R Us","Babyshop",
  "Shoe Mart","Splash","Lifestyle"];

// Long-tail brand volumes: a gentle rank-based decay plus per-brand jitter so
// totals vary organically instead of everyone being a multiple of one scale factor.
const TA_BRANDS = TA_BRAND_NAMES.map((name, i)=>{
  const rankFactor = Math.pow(0.9, i);
  const total = Math.max(60, Math.round(1800 * rankFactor * taRandRange(0.55, 1.35)));
  return taBuildBrand(name, taGenerateStatusDist(total));
});

const TA_COUNTRIES = ["SA","AE","KW","QA","OM","BH"];
const TA_PROJECTS = [
  {name:"Ramadan Campaign", brand:"RB"},
  {name:"CES Detractors", brand:"RB"},
  {name:"CES Detractors", brand:"Skechers"},
  {name:"Store Launch", brand:"LC Waikiki"},
  {name:"Loyalty Feedback", brand:"BBZ"},
  {name:"Support Ticket Flow", brand:"NYSAA"},
  {name:"Ramadan Campaign", brand:"Aldo"},
  {name:"Checkout Experience", brand:"Nine West"},
  {name:"Onboarding Survey", brand:"Tommy Hilfiger"},
];
const taProjectKey = (brand, name) => brand+"::"+name;

// Give every brand's tracked projects a stable slice of its ticket volume; whatever
// isn't claimed by a project stays "unassigned" and drops out when a project filter
// is active — this is what makes the Project filter actually change the counts.
TA_BRANDS.forEach(brand=>{
  brand.projectDist = {};
  const projs = TA_PROJECTS.filter(p=>p.brand===brand.name);
  if(!projs.length) return;
  const assignedShare = taRandRange(0.45, 0.8);
  const assignedTotal = brand.dist.map(v=>Math.round(v*assignedShare));
  taSplitDist(assignedTotal, projs.map(p=>p.name)).forEach(s=>{ brand.projectDist[s.name] = s.dist; });
});

function taProjectFilteredDist(brand, selectedProjectKeys){
  const prefix = brand.name+"::";
  const keys = selectedProjectKeys.filter(k=>k.startsWith(prefix));
  const dist = new Array(TA_STATUSES.length).fill(0);
  keys.forEach(k=>{
    const pd = brand.projectDist[k.slice(prefix.length)];
    if(pd) pd.forEach((v,i)=> dist[i]+=v);
  });
  return dist;
}

const TA_DATE_OPTIONS = ["Last 7 days","Last 14 days","Last Month","Last 3 Months","Custom"];
// The baked-in dist arrays represent "Last 7 days" — every other preset (and Custom
// range) scales those numbers by how many days it actually spans, so switching the
// date filter visibly changes every count instead of being decorative.
const TA_DATE_DAY_COUNTS = { "Last 7 days":7, "Last 14 days":14, "Last Month":30, "Last 3 Months":90 };
function taDateMultiplier(dateValue, customFrom, customTo){
  if (dateValue === "Custom"){
    if (!customFrom || !customTo) return 1;
    const days = Math.max(1, Math.round((customTo - customFrom)/86400000) + 1);
    return days/7;
  }
  return (TA_DATE_DAY_COUNTS[dateValue] || 7) / 7;
}
// Human-readable label for whichever preset (or custom range) a filter is currently on.
function taDateLabel(state, valueKey){
  if (state[valueKey]==="Custom" && state.customFrom && state.customTo){
    return taFmtCalDate(state.customFrom)+' – '+taFmtCalDate(state.customTo);
  }
  return state[valueKey];
}

/* ---------------- state (persists across navigations, like the prototype's top-level lets) ---------------- */
const taCalDefaults = { customFrom:null, customTo:null, calOpen:false, calAnchor:null, calHoverDate:null, calViewMonth:null };
let taState = { scopeMode:"Overall", selectedBrands:[], selectedCountries:[], selectedProjects:[], dateRange:"Last 7 days", openDropdown:null, selectedStatus:null, brandLevelShown:5, ...structuredClone(taCalDefaults) };
let taOcState = { scope:"Overall", brands:[], projects:[], date:"Last 7 days", openDropdown:null, view:"chart", openBucket:["Open"], closedBucket:["Closed"], levelShown:5, ...structuredClone(taCalDefaults) };
let taPerfState = { scope:"Overall", brands:[], projects:[], date:"Last 7 days", openDropdown:null,
  openBucket:["Open"], closedBucket:["Closed"], fcrBucket:["Resolved"], sortCol:"openRate", sortDir:"desc", page:1, perPage:10, ...structuredClone(taCalDefaults) };

function taSumDist(entities){
  const totals = new Array(TA_STATUSES.length).fill(0);
  entities.forEach(e => e.dist.forEach((v,i)=> totals[i]+=v));
  return totals;
}
function taInScopeBrands(){
  return taState.selectedBrands.length ? TA_BRANDS.filter(b=>taState.selectedBrands.includes(b.name)) : TA_BRANDS;
}

// Applies Country scope, the Project filter, and the date multiplier — in that order —
// to a single brand's raw dist, so every section reads one consistent, filtered number.
function taEffectiveBrandDist(brand){
  let dist = brand.dist;
  if (taState.scopeMode==="Country" && taState.selectedCountries.length){
    const countryLevel = brand.chain.find(c=>c.level==="Country");
    const matching = countryLevel.items.filter(it=>taState.selectedCountries.includes(it.name));
    const countryDist = new Array(TA_STATUSES.length).fill(0);
    matching.forEach(it=> it.dist.forEach((v,i)=> countryDist[i]+=v));
    dist = countryDist;
  }
  if (taState.selectedProjects.length){
    const projDist = taProjectFilteredDist(brand, taState.selectedProjects);
    dist = (dist===brand.dist) ? projDist
      : dist.map((v,i)=> brand.dist[i] ? Math.round(v * (projDist[i]/brand.dist[i])) : 0);
  }
  const mult = taDateMultiplier(taState.dateRange, taState.customFrom, taState.customTo);
  return dist.map(v=>Math.max(0, Math.round(v*mult)));
}
function taCurrentEntities(){
  return taInScopeBrands().map(b=>({ name:b.name, dist:taEffectiveBrandDist(b), chain:b.chain }));
}

// Shared by the Open vs Closed and Performance sections (Overall/Brand scope only —
// no Country there), applying the Project filter + date multiplier to a brand's dist.
function taScopedDist(brand, selectedProjectKeys, dateValue, customFrom, customTo){
  const dist = selectedProjectKeys.length ? taProjectFilteredDist(brand, selectedProjectKeys) : brand.dist;
  const mult = taDateMultiplier(dateValue, customFrom, customTo);
  return dist.map(v=>Math.max(0, Math.round(v*mult)));
}

/* ---------------- main filter bar ---------------- */
function renderTAFilterBar(){
  const bar = document.getElementById("taFilterBar");
  if(!bar) return;
  bar.innerHTML = "";

  const seg = document.createElement("div");
  seg.className = "ta-seg";
  ["Overall","Brand","Country"].forEach(m=>{
    const b = document.createElement("button");
    b.textContent = m;
    if (m===taState.scopeMode) b.classList.add("active");
    b.onclick = ()=>{ taState.scopeMode=m; if(m==="Overall"){taState.selectedBrands=[];taState.selectedCountries=[];} if(m==="Brand"){taState.selectedCountries=[];} taState.openDropdown=null; renderTAAll(); };
    seg.appendChild(b);
  });
  bar.appendChild(seg);

  if (taState.scopeMode==="Brand" || taState.scopeMode==="Country"){
    bar.appendChild(makeTAMultiDropdown("brand","Select brands", TA_BRANDS.map(b=>b.name), taState.selectedBrands, (vals)=>{taState.selectedBrands=vals; renderTAAll();}));
  }
  if (taState.scopeMode==="Country"){
    bar.appendChild(makeTAMultiDropdown("country","Select countries", TA_COUNTRIES, taState.selectedCountries, (vals)=>{taState.selectedCountries=vals; renderTAAll();}));
  }

  const projOptions = TA_PROJECTS
    .filter(p => taState.selectedBrands.length===0 || taState.selectedBrands.includes(p.brand))
    .map(p => ({ value: taProjectKey(p.brand,p.name), label: (taState.selectedBrands.length===1 ? p.name : p.brand+" - "+p.name) }));
  bar.appendChild(makeTAMultiDropdown("project","Select projects", projOptions, taState.selectedProjects, (vals)=>{taState.selectedProjects=vals; renderTAAll();}));

  bar.appendChild(renderTADateControl({ state:taState, valueKey:"dateRange", rerender:renderTAAll, rerenderLight:renderTAFilterBar }));
}

function taNormalizeTAOptions(options){
  return options.map(o => typeof o === "string" ? {value:o, label:o} : o);
}

function makeTAMultiDropdown(key, placeholder, rawOptions, selectedArr, onChange){
  const options = taNormalizeTAOptions(rawOptions);
  const wrap = document.createElement("div");
  wrap.className = "ta-dd";
  const btn = document.createElement("button");
  btn.className = "ta-dd-btn";
  const selectedLabels = selectedArr.map(v => (options.find(o=>o.value===v)||{label:v}).label);
  const label = selectedArr.length===0 ? placeholder : (selectedArr.length<=2 ? selectedLabels.join(", ") : selectedArr.length+" selected");
  btn.innerHTML = '<span class="'+(selectedArr.length===0?'ta-muted':'')+'">'+esc(label)+'</span><span>▾</span>';
  btn.onclick = (e)=>{ e.stopPropagation(); taState.openDropdown = (taState.openDropdown===key ? null : key); renderTAFilterBar(); };
  wrap.appendChild(btn);

  if (taState.openDropdown===key){
    const panel = document.createElement("div");
    panel.className = "ta-dd-panel";
    panel.onclick = (e)=> e.stopPropagation();
    const search = document.createElement("input");
    search.className = "ta-dd-search"; search.placeholder = "Search";
    panel.appendChild(search);

    const actionsRow = document.createElement("div");
    actionsRow.style.cssText = "display:flex; justify-content:space-between; align-items:center;";
    const selAll = document.createElement("div");
    selAll.className = "ta-dd-selectall"; selAll.textContent = "Select all";
    selAll.onclick = ()=> onChange(options.map(o=>o.value));
    actionsRow.appendChild(selAll);
    if (selectedArr.length>0){
      const clearAll = document.createElement("div");
      clearAll.className = "ta-dd-selectall"; clearAll.textContent = "Clear all";
      clearAll.onclick = ()=> onChange([]);
      actionsRow.appendChild(clearAll);
    }
    panel.appendChild(actionsRow);

    const list = document.createElement("div");
    list.className = "ta-dd-list";
    function renderList(filterText){
      list.innerHTML = "";
      options.filter(o=>o.label.toLowerCase().includes(filterText.toLowerCase())).forEach(o=>{
        const item = document.createElement("div");
        item.className = "ta-dd-item";
        const checked = selectedArr.includes(o.value);
        item.innerHTML = '<input type="checkbox" '+(checked?'checked':'')+'><span>'+esc(o.label)+'</span>';
        item.onclick = ()=>{ onChange(checked ? selectedArr.filter(x=>x!==o.value) : selectedArr.concat([o.value])); };
        list.appendChild(item);
      });
    }
    renderList("");
    search.oninput = ()=>renderList(search.value);
    panel.appendChild(list);
    wrap.appendChild(panel);
  }
  return wrap;
}

/* ---------------- custom date-range calendar (hover trail, click start then end) ---------------- */
function taFmtCalDate(d){ return d ? `${MON[d.getMonth()]} ${d.getDate()}` : ''; }
function taSameCalDay(a,b){ return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

function taOpenCalendar(state){
  state.calOpen = true;
  state.calAnchor = null;
  state.calHoverDate = null;
  state.calViewMonth = state.customFrom ? new Date(state.customFrom.getFullYear(), state.customFrom.getMonth(), 1) : new Date();
}
function taCloseCalendar(state){
  state.calOpen = false;
  state.calAnchor = null;
  state.calHoverDate = null;
}

// Renders the preset <select> plus — only when "Custom" is chosen — a trigger button
// that opens a real calendar: click a start day, then hover trails a live preview of
// the range up to the pointer, click the end day to lock it in.
function renderTADateControl(cfg){
  const state = cfg.state;
  const wrap = document.createElement("div");

  const sel = document.createElement("select");
  sel.className = "ta-date-select";
  TA_DATE_OPTIONS.forEach(d=>{
    const o = document.createElement("option");
    o.value=d; o.textContent=d; if(d===state[cfg.valueKey]) o.selected=true;
    sel.appendChild(o);
  });
  sel.onchange = (e)=>{
    state[cfg.valueKey] = e.target.value;
    if (e.target.value==="Custom" && !(state.customFrom && state.customTo)) taOpenCalendar(state);
    else taCloseCalendar(state);
    cfg.rerender();
  };
  wrap.appendChild(sel);

  if (state[cfg.valueKey] === "Custom"){
    const ddWrap = document.createElement("div");
    ddWrap.className = "ta-dd"; ddWrap.style.marginTop = "6px";
    const trigger = document.createElement("button");
    trigger.type = "button"; trigger.className = "ta-dd-btn"; trigger.style.width = "100%";
    const hasRange = state.customFrom && state.customTo;
    const label = hasRange ? (taFmtCalDate(state.customFrom)+' – '+taFmtCalDate(state.customTo)) : 'Select dates';
    trigger.innerHTML = '<span class="'+(hasRange?'':'ta-muted')+'">'+esc(label)+'</span><span>📅</span>';
    trigger.onclick = (e)=>{ e.stopPropagation(); if(state.calOpen) taCloseCalendar(state); else taOpenCalendar(state); cfg.rerender(); };
    ddWrap.appendChild(trigger);
    if (state.calOpen) ddWrap.appendChild(renderTACalendarPanel(state, cfg.rerenderLight||cfg.rerender, cfg.rerender));
    wrap.appendChild(ddWrap);
  }
  return wrap;
}

function renderTACalendarPanel(state, rerenderLight, rerenderFull){
  const panel = document.createElement("div");
  panel.className = "ta-cal-panel";
  panel.onclick = e=>e.stopPropagation();

  const viewMonth = state.calViewMonth || new Date();
  const year = viewMonth.getFullYear(), month = viewMonth.getMonth();

  const header = document.createElement("div");
  header.className = "ta-cal-header";
  const prevBtn = document.createElement("button"); prevBtn.type="button"; prevBtn.className="ta-cal-nav"; prevBtn.textContent="‹";
  prevBtn.onclick = ()=>{ state.calViewMonth = new Date(year, month-1, 1); rerenderLight(); };
  const nextBtn = document.createElement("button"); nextBtn.type="button"; nextBtn.className="ta-cal-nav"; nextBtn.textContent="›";
  nextBtn.onclick = ()=>{ state.calViewMonth = new Date(year, month+1, 1); rerenderLight(); };
  const label = document.createElement("div"); label.className="ta-cal-label"; label.textContent = `${MON[month]} ${year}`;
  header.appendChild(prevBtn); header.appendChild(label); header.appendChild(nextBtn);
  panel.appendChild(header);

  const grid = document.createElement("div"); grid.className="ta-cal-grid";
  ["Su","Mo","Tu","We","Th","Fr","Sa"].forEach(d=>{
    const dh = document.createElement("div"); dh.className="ta-cal-dow"; dh.textContent=d; grid.appendChild(dh);
  });
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  for(let i=0;i<firstDow;i++){ const blank=document.createElement("div"); blank.className="ta-cal-day ta-cal-blank"; grid.appendChild(blank); }

  let rangeStart = state.calAnchor;
  let rangeEnd = (state.calAnchor && state.calHoverDate) ? state.calHoverDate : null;
  if (!state.calAnchor && state.customFrom && state.customTo){ rangeStart = state.customFrom; rangeEnd = state.customTo; }
  if (rangeStart && rangeEnd && rangeStart > rangeEnd){ const tmp=rangeStart; rangeStart=rangeEnd; rangeEnd=tmp; }

  for(let day=1; day<=daysInMonth; day++){
    const d = new Date(year, month, day);
    const cell = document.createElement("div");
    cell.className = "ta-cal-day";
    cell.textContent = day;
    if (rangeStart && rangeEnd && d>=rangeStart && d<=rangeEnd){
      cell.classList.add("in-range");
      if (taSameCalDay(d, rangeStart)) cell.classList.add("range-start");
      if (taSameCalDay(d, rangeEnd)) cell.classList.add("range-end");
    } else if (rangeStart && !rangeEnd && taSameCalDay(d, rangeStart)){
      cell.classList.add("range-start","range-end","in-range");
    }
    cell.onmouseenter = ()=>{ if (state.calAnchor && !taSameCalDay(state.calHoverDate, d)){ state.calHoverDate = d; rerenderLight(); } };
    cell.onclick = ()=>{
      if (!state.calAnchor){
        state.calAnchor = d; state.calHoverDate = d;
        rerenderLight();
      } else {
        let from = state.calAnchor, to = d;
        if (from > to){ const tmp=from; from=to; to=tmp; }
        state.customFrom = from; state.customTo = to;
        state.calAnchor = null; state.calHoverDate = null; state.calOpen = false;
        rerenderFull();
      }
    };
    grid.appendChild(cell);
  }
  panel.appendChild(grid);

  const footer = document.createElement("div"); footer.className="ta-cal-footer";
  if (state.calAnchor){
    footer.innerHTML = rangeEnd && !taSameCalDay(rangeStart,rangeEnd)
      ? `<span>${esc(taFmtCalDate(rangeStart))} – ${esc(taFmtCalDate(rangeEnd))}</span>`
      : `<span>${esc(taFmtCalDate(rangeStart))} → pick an end date</span>`;
  } else if (state.customFrom && state.customTo){
    footer.innerHTML = `<span>${esc(taFmtCalDate(state.customFrom))} – ${esc(taFmtCalDate(state.customTo))}</span><button type="button" class="ta-cal-clear" id="taCalClear">Clear</button>`;
  } else {
    footer.innerHTML = '<span>Click a start date, then an end date</span>';
  }
  panel.appendChild(footer);
  const clearBtn = footer.querySelector("#taCalClear");
  if (clearBtn) clearBtn.onclick = ()=>{ state.customFrom=null; state.customTo=null; state.calAnchor=null; state.calHoverDate=null; rerenderFull(); };

  return panel;
}

/* ---------------- header + progressive drilldown ---------------- */
function renderTAHeader(){
  const card = document.getElementById("taHeaderCardBody");
  if(!card) return;
  const entities = taCurrentEntities();
  const totals = taSumDist(entities);
  const grand = totals.reduce((a,b)=>a+b,0);
  const rows = TA_STATUSES.map((s,i)=>({name:s, count:totals[i]})).sort((a,b)=>b.count-a.count);
  const max = Math.max(1, rows[0].count);
  card.innerHTML = `
    <div class="ta-total-num">${grand.toLocaleString()}</div>
    <div class="ta-total-sub">total tickets &middot; ${esc(taDateLabel(taState,"dateRange"))}${taState.scopeMode!=="Overall" ? " &middot; scoped to "+esc(taState.scopeMode.toLowerCase()) : ""}</div>
    ${rows.map(r=>`
      <div class="ta-bar-row" data-status="${esc(r.name)}" title="${esc(r.name)}: ${r.count.toLocaleString()}" style="opacity:${taState.selectedStatus && taState.selectedStatus!==r.name ? '0.6':'1'};">
        <div class="ta-lbl">${esc(r.name)}</div>
        <div class="ta-track"><div class="ta-fill" style="width:${Math.round(r.count/max*100)}%; background:${TA_DRILL_COLOR}"></div></div>
        <div class="ta-val">${r.count.toLocaleString()}</div>
      </div>
    `).join("")}
  `;
  card.querySelectorAll(".ta-bar-row").forEach(row=>{ row.onclick = ()=> onTAStatusClick(row.dataset.status); });
}

function taSelectRow(panel, rowEl){
  panel.querySelectorAll(".ta-bar-row").forEach(r=>{ r.style.opacity = (r===rowEl) ? "1" : "0.6"; });
}

// Collapses everything after `panel` and clears the open/dimmed state of its rows —
// used both to close a re-clicked row and before opening a different one.
function taCollapseAfter(panel){
  let sib = panel.nextSibling;
  while(sib){ const rm=sib; sib=sib.nextSibling; rm.remove(); }
  panel.querySelectorAll(".ta-bar-row").forEach(r=>{ r.style.opacity = "1"; r.classList.remove("ta-row-open"); });
}

// Shared click behavior for every drilldown row (Brand level + every cascade level,
// including Store): first click expands the next level, clicking the SAME row again
// collapses it back closed instead of re-expanding.
function taWireDrillRow(row, panel, expandFn){
  row.onclick = ()=>{
    if (row.classList.contains("ta-row-open")){
      taCollapseAfter(panel);
      return;
    }
    taCollapseAfter(panel);
    taSelectRow(panel, row);
    row.classList.add("ta-row-open");
    expandFn();
  };
}

function onTAStatusClick(statusName){
  const container = document.getElementById("taDrillArea");
  if(!container) return;
  if (taState.selectedStatus === statusName){
    taState.selectedStatus = null;
    renderTAHeader();
    container.innerHTML = "";
    return;
  }
  taState.selectedStatus = statusName;
  renderTAHeader();
  taState.brandLevelShown = 5;
  const idx = TA_STATUSES.indexOf(statusName);
  container.innerHTML = "";
  renderTAEntityLevel(taCurrentEntities(), idx, statusName, ["Brand"], container, true);
}

function renderTAEntityLevel(entities, statusIdx, statusName, breadcrumbBase, container, isTopLevel){
  const panel = document.createElement("div");
  panel.className = "ta-panel";
  const crumb = document.createElement("div");
  crumb.className = "ta-breadcrumb";
  crumb.innerHTML = '<span id="taCrumbReset">All statuses</span><span class="ta-sep">›</span><b>'+esc(statusName)+'</b><span class="ta-sep">›</span>'+esc(breadcrumbBase[breadcrumbBase.length-1]);
  panel.appendChild(crumb);

  const allItems = entities.map(e=>({name:e.name, count:e.dist[statusIdx], ref:e}));
  const paginate = isTopLevel && taState.selectedBrands.length===0 && allItems.length>5;
  const items = paginate ? allItems.slice(0, taState.brandLevelShown) : allItems;
  const max = Math.max(1, ...allItems.map(i=>i.count));
  if (items.length===0){
    panel.innerHTML += '<div class="ta-empty">No data for this level yet.</div>';
  } else {
    items.forEach(it=>{
      const row = document.createElement("div");
      row.className = "ta-bar-row";
      row.title = `${it.name}: ${it.count.toLocaleString()}`;
      row.innerHTML = `<div class="ta-lbl">${esc(it.name)}</div><div class="ta-track"><div class="ta-fill" style="width:${Math.round(it.count/max*100)}%; background:${TA_DRILL_COLOR}"></div></div><div class="ta-val">${it.count.toLocaleString()}</div>`;
      taWireDrillRow(row, panel, ()=>{
        let chain = it.ref.chain;
        if (taState.scopeMode==="Country" && taState.selectedCountries.length){
          chain = chain.map((lvl,i)=> i===0 ? {level:lvl.level, items:lvl.items.filter(x=>taState.selectedCountries.includes(x.name))} : lvl);
        }
        cascadeTAChain(chain, 0, breadcrumbBase.concat([it.name]), statusIdx, statusName, container);
      });
      panel.appendChild(row);
    });
    if (paginate || taState.brandLevelShown>5){
      const remaining = allItems.length - items.length;
      const loadWrap = document.createElement("div");
      loadWrap.className = "ta-load-controls";
      let controlsHtml = "";
      if (remaining>0){
        controlsHtml += `<button class="ta-load-btn" id="taBrandLoadMoreBtn">Load ${Math.min(5,remaining)} more</button>
          <button class="ta-load-link" id="taBrandShowAllBtn">Show all (${remaining} remaining)</button>`;
      }
      if (taState.brandLevelShown>5){
        controlsHtml += `<button class="ta-load-link" id="taBrandViewLessBtn">View less</button>`;
      }
      loadWrap.innerHTML = controlsHtml;
      panel.appendChild(loadWrap);
      const note = document.createElement("div");
      note.className = "ta-entries-note";
      note.textContent = items.length+" of "+allItems.length+" brands shown";
      panel.appendChild(note);
      const loadMoreBtn = loadWrap.querySelector("#taBrandLoadMoreBtn");
      if (loadMoreBtn) loadMoreBtn.onclick = ()=>{ taState.brandLevelShown += 5; panel.remove(); renderTAEntityLevel(entities, statusIdx, statusName, breadcrumbBase, container, isTopLevel); };
      const showAllBtn = loadWrap.querySelector("#taBrandShowAllBtn");
      if (showAllBtn) showAllBtn.onclick = ()=>{ taState.brandLevelShown = allItems.length; panel.remove(); renderTAEntityLevel(entities, statusIdx, statusName, breadcrumbBase, container, isTopLevel); };
      const viewLessBtn = loadWrap.querySelector("#taBrandViewLessBtn");
      if (viewLessBtn) viewLessBtn.onclick = ()=>{ taState.brandLevelShown = 5; panel.remove(); renderTAEntityLevel(entities, statusIdx, statusName, breadcrumbBase, container, isTopLevel); };
    }
  }
  container.appendChild(panel);
  panel.querySelector("#taCrumbReset")?.addEventListener("click", ()=>{ container.innerHTML=""; taState.selectedStatus=null; renderTAHeader(); });
}

function cascadeTAChain(chain, startIdx, breadcrumbNames, statusIdx, statusName, container){
  let idx = startIdx;
  while (idx < chain.length){
    const levelDef = chain[idx];
    const panel = document.createElement("div");
    panel.className = "ta-panel";
    const crumb = document.createElement("div");
    crumb.className = "ta-breadcrumb";
    crumb.innerHTML = '<span class="taCrumbHome">All statuses</span><span class="ta-sep">›</span>'+
      breadcrumbNames.map(n=>'<span>'+esc(n)+'</span>').join('<span class="ta-sep">›</span>') +
      '<span class="ta-sep">›</span><b>'+esc(levelDef.level)+'</b>';
    panel.appendChild(crumb);

    if (levelDef.items.length===0){
      panel.innerHTML += '<div class="ta-empty">Looks like there is currently no data at this level.</div>';
      container.appendChild(panel);
      panel.querySelector(".taCrumbHome").onclick = ()=>{ container.innerHTML=""; taState.selectedStatus=null; renderTAHeader(); };
      idx++;
      continue;
    }

    const mult = taDateMultiplier(taState.dateRange, taState.customFrom, taState.customTo);
    const max = Math.max(1, ...levelDef.items.map(i=>Math.round(i.dist[statusIdx]*mult)));
    const isLastLevel = idx === chain.length-1;
    levelDef.items.forEach(it=>{
      const row = document.createElement("div");
      row.className = "ta-bar-row";
      const count = Math.round(it.dist[statusIdx]*mult);
      row.title = `${it.name}: ${count.toLocaleString()}`;
      row.innerHTML = `<div class="ta-lbl">${esc(it.name)}</div><div class="ta-track"><div class="ta-fill" style="width:${Math.round(count/max*100)}%; background:${TA_DRILL_COLOR}"></div></div><div class="ta-val">${count.toLocaleString()}</div>`;
      if (isLastLevel){
        // Store is the last level — still clickable (highlights + hover shows the count), just nothing further to expand.
        row.onclick = ()=>{
          const isOpen = row.classList.contains("ta-row-open");
          panel.querySelectorAll(".ta-bar-row").forEach(r=>{ r.style.opacity = "1"; r.classList.remove("ta-row-open"); });
          if (!isOpen){ taSelectRow(panel, row); row.classList.add("ta-row-open"); }
        };
      } else {
        taWireDrillRow(row, panel, ()=> cascadeTAChain(chain, idx+1, breadcrumbNames.concat([it.name]), statusIdx, statusName, container));
      }
      panel.appendChild(row);
    });
    container.appendChild(panel);
    panel.querySelector(".taCrumbHome").onclick = ()=>{ container.innerHTML=""; taState.selectedStatus=null; renderTAHeader(); };
    break;
  }
}

/* ---------------- reusable config modal ---------------- */
function renderTAModal(cfg){
  const root = document.getElementById("taModalRoot");
  if(!root) return;
  root.innerHTML = "";
  const overlay = document.createElement("div");
  overlay.className = "ta-modal-overlay";
  overlay.onclick = (e)=>{ if(e.target===overlay){ root.innerHTML=""; cfg.onClose && cfg.onClose(); } };
  const box = document.createElement("div");
  box.className = "ta-modal-box";
  box.onclick = (e)=> e.stopPropagation();
  box.innerHTML = '<h3>'+esc(cfg.title)+'</h3><div class="ta-modal-sub">'+esc(cfg.subtitle)+'</div>';
  const groupsWrap = document.createElement("div");
  groupsWrap.className = "ta-modal-groups";
  cfg.groups.forEach(g=>{
    const gWrap = document.createElement("div");
    gWrap.style.cssText = "display:flex; gap:12px;";
    const label = document.createElement("div");
    label.className = "ta-modal-group-label"; label.textContent = g.label;
    gWrap.appendChild(label);
    const checks = document.createElement("div");
    checks.className = "ta-modal-checks";
    g.options.forEach(opt=>{
      const lab = document.createElement("label");
      const checked = g.selected.includes(opt);
      lab.innerHTML = '<input type="checkbox" '+(checked?'checked':'')+'><span>'+esc(opt)+'</span>';
      lab.querySelector("input").onchange = (e)=>{
        g.onChange(e.target.checked ? g.selected.concat([opt]) : g.selected.filter(x=>x!==opt));
      };
      checks.appendChild(lab);
    });
    gWrap.appendChild(checks);
    groupsWrap.appendChild(gWrap);
  });
  box.appendChild(groupsWrap);
  const closeBtn = document.createElement("button");
  closeBtn.className = "ta-modal-close-btn"; closeBtn.textContent = "Close";
  closeBtn.onclick = ()=>{ root.innerHTML=""; cfg.onClose && cfg.onClose(); };
  box.appendChild(closeBtn);
  overlay.appendChild(box);
  root.appendChild(overlay);
}

/* ---------------- generic dropdown for the independently-filtered sections below ---------------- */
function makeTAMultiDropdown2(cfg){
  const options = taNormalizeTAOptions(cfg.options);
  const wrap = document.createElement("div");
  wrap.className = "ta-dd";
  const btn = document.createElement("button");
  btn.className = "ta-dd-btn";
  const selectedLabels = cfg.selected.map(v => (options.find(o=>o.value===v)||{label:v}).label);
  const label = cfg.selected.length===0 ? cfg.placeholder : (cfg.selected.length<=2 ? selectedLabels.join(", ") : cfg.selected.length+" selected");
  btn.innerHTML = '<span class="'+(cfg.selected.length===0?'ta-muted':'')+'">'+esc(label)+'</span><span>▾</span>';
  btn.onclick = (e)=>{ e.stopPropagation(); cfg.state.openDropdown = (cfg.state.openDropdown===cfg.key ? null : cfg.key); cfg.rerender(); };
  wrap.appendChild(btn);
  if (cfg.state.openDropdown===cfg.key){
    const panel = document.createElement("div");
    panel.className = "ta-dd-panel";
    panel.onclick = (e)=> e.stopPropagation();
    const search = document.createElement("input");
    search.className = "ta-dd-search"; search.placeholder = "Search";
    panel.appendChild(search);
    const actionsRow = document.createElement("div");
    actionsRow.style.cssText = "display:flex; justify-content:space-between; align-items:center;";
    const selAll = document.createElement("div");
    selAll.className = "ta-dd-selectall"; selAll.textContent = "Select all";
    selAll.onclick = ()=> cfg.onChange(options.map(o=>o.value));
    actionsRow.appendChild(selAll);
    if (cfg.selected.length>0){
      const clearAll = document.createElement("div");
      clearAll.className = "ta-dd-selectall"; clearAll.textContent = "Clear all";
      clearAll.onclick = ()=> cfg.onChange([]);
      actionsRow.appendChild(clearAll);
    }
    panel.appendChild(actionsRow);
    const list = document.createElement("div");
    list.className = "ta-dd-list";
    function renderList(f){
      list.innerHTML = "";
      options.filter(o=>o.label.toLowerCase().includes(f.toLowerCase())).forEach(o=>{
        const item = document.createElement("div");
        item.className = "ta-dd-item";
        const checked = cfg.selected.includes(o.value);
        item.innerHTML = '<input type="checkbox" '+(checked?'checked':'')+'><span>'+esc(o.label)+'</span>';
        item.onclick = ()=>{ cfg.onChange(checked ? cfg.selected.filter(x=>x!==o.value) : cfg.selected.concat([o.value])); };
        list.appendChild(item);
      });
    }
    renderList("");
    search.oninput = ()=> renderList(search.value);
    panel.appendChild(list);
    wrap.appendChild(panel);
  }
  return wrap;
}

/* ---------------- section: Open vs Closed tickets ---------------- */
function taOcScopedBrands(){
  return taOcState.brands.length ? TA_BRANDS.filter(b=>taOcState.brands.includes(b.name)) : TA_BRANDS;
}

function renderTAOc(){
  const card = document.getElementById("taOcSection");
  if(!card) return;
  card.innerHTML = "";
  const head = document.createElement("div");
  head.className = "ta-section-head";
  head.innerHTML = '<h2>Open vs Closed Tickets</h2>';
  const actions = document.createElement("div");
  actions.className = "ta-section-head-actions";
  const chartBtn = document.createElement("button");
  chartBtn.className = "ta-icon-btn"+(taOcState.view==="chart"?" active":"");
  chartBtn.textContent = "\u{1F4CA}"; chartBtn.title = "Chart view";
  chartBtn.onclick = ()=>{ taOcState.view="chart"; renderTAOc(); };
  const tableBtn = document.createElement("button");
  tableBtn.className = "ta-icon-btn"+(taOcState.view==="table"?" active":"");
  tableBtn.textContent = "▦"; tableBtn.title = "Table view";
  tableBtn.onclick = ()=>{ taOcState.view="table"; renderTAOc(); };
  const gearBtn = document.createElement("button");
  gearBtn.className = "ta-icon-btn"; gearBtn.textContent = "⚙"; gearBtn.title = "Configure chart display";
  gearBtn.onclick = ()=> openTAOcModal();
  actions.appendChild(chartBtn); actions.appendChild(tableBtn); actions.appendChild(gearBtn);
  head.appendChild(actions);
  card.appendChild(head);

  const filterRow = document.createElement("div");
  filterRow.className = "ta-filter-bar"; filterRow.style.marginBottom = "14px";
  const seg = document.createElement("div");
  seg.className = "ta-seg";
  ["Overall","Brand"].forEach(m=>{
    const b = document.createElement("button");
    b.textContent = m;
    if (m===taOcState.scope) b.classList.add("active");
    b.onclick = ()=>{ taOcState.scope=m; if(m==="Overall") taOcState.brands=[]; taOcState.openDropdown=null; taOcState.levelShown=5; renderTAOc(); };
    seg.appendChild(b);
  });
  filterRow.appendChild(seg);
  if (taOcState.scope==="Brand"){
    filterRow.appendChild(makeTAMultiDropdown2({key:"ocBrand", placeholder:"Select brands", options:TA_BRANDS.map(b=>b.name), selected:taOcState.brands, onChange:(v)=>{taOcState.brands=v; taOcState.levelShown=5; renderTAOc();}, state:taOcState, rerender:renderTAOc}));
  }
  const ocProjOptions = TA_PROJECTS.filter(p=> taOcState.brands.length===0 || taOcState.brands.includes(p.brand)).map(p=>({ value:taProjectKey(p.brand,p.name), label: taOcState.brands.length===1 ? p.name : p.brand+" - "+p.name }));
  filterRow.appendChild(makeTAMultiDropdown2({key:"ocProject", placeholder:"Select projects", options:ocProjOptions, selected:taOcState.projects, onChange:(v)=>{taOcState.projects=v; taOcState.levelShown=5; renderTAOc();}, state:taOcState, rerender:renderTAOc}));
  filterRow.appendChild(renderTADateControl({ state:taOcState, valueKey:"date", rerender:renderTAOc }));
  card.appendChild(filterRow);

  const legend = document.createElement("div");
  legend.className = "ta-legend-row";
  legend.innerHTML = '<span><span class="ta-legend-dot" style="background:var(--st-open)"></span>Open ('+esc(taOcState.openBucket.join(", "))+')</span><span><span class="ta-legend-dot" style="background:var(--st-esc)"></span>Closed ('+esc(taOcState.closedBucket.join(", "))+')</span>';
  card.appendChild(legend);

  const brands = taOcScopedBrands();
  const allRows = brands.map(b=>{
    const dist = taScopedDist(b, taOcState.projects, taOcState.date, taOcState.customFrom, taOcState.customTo);
    return {
      name:b.name,
      open: dist.reduce((s,v,i)=> s + (taOcState.openBucket.includes(TA_STATUSES[i]) ? v : 0), 0),
      closed: dist.reduce((s,v,i)=> s + (taOcState.closedBucket.includes(TA_STATUSES[i]) ? v : 0), 0)
    };
  }).filter(r=> r.open>0 || r.closed>0).sort((a,b)=> (b.open+b.closed)-(a.open+a.closed));
  const rows = allRows.slice(0, taOcState.levelShown);

  if (rows.length===0){
    card.innerHTML += '<div class="ta-empty">No tickets match the current bucket definition and filters.</div>';
    return;
  }

  if (taOcState.view==="chart"){
    const maxTotal = Math.max(1, ...rows.map(r=>r.open+r.closed));
    rows.forEach(r=>{
      const total = r.open+r.closed;
      const stackWidthPct = Math.round(total/maxTotal*100);
      const openPct = total ? Math.round(r.open/total*100) : 0;
      const closedPct = total ? 100-openPct : 0;
      const row = document.createElement("div");
      row.className = "ta-oc-row";
      row.innerHTML = '<div class="ta-lbl">'+esc(r.name)+'</div>'+
        '<div class="ta-oc-stack-track"><div class="ta-oc-stack" style="width:'+stackWidthPct+'%;">'+
          '<div class="ta-oc-seg" style="width:'+openPct+'%; background:var(--st-open);"></div>'+
          '<div class="ta-oc-seg" style="width:'+closedPct+'%; background:var(--st-esc);"></div>'+
        '</div></div>'+
        '<div class="ta-val">'+r.open.toLocaleString()+' open &middot; '+r.closed.toLocaleString()+' closed</div>';
      card.appendChild(row);
    });
  } else {
    const tbl = document.createElement("table");
    tbl.className = "ta-perf-table";
    tbl.innerHTML = '<thead><tr><th>Brand</th><th class="ta-num">Open</th><th class="ta-num">Closed</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+esc(r.name)+'</td><td class="ta-num">'+r.open.toLocaleString()+'</td><td class="ta-num">'+r.closed.toLocaleString()+'</td></tr>').join("")+
      '</tbody>';
    card.appendChild(tbl);
  }

  if (allRows.length>5 || taOcState.levelShown>5){
    const remaining = allRows.length - rows.length;
    const loadWrap = document.createElement("div");
    loadWrap.className = "ta-load-controls";
    let controlsHtml = "";
    if (remaining>0){
      controlsHtml += `<button class="ta-load-btn" id="taOcLoadMoreBtn">Load ${Math.min(5,remaining)} more</button>
        <button class="ta-load-link" id="taOcShowAllBtn">Show all (${remaining} remaining)</button>`;
    }
    if (taOcState.levelShown>5){
      controlsHtml += `<button class="ta-load-link" id="taOcViewLessBtn">View less</button>`;
    }
    loadWrap.innerHTML = controlsHtml;
    card.appendChild(loadWrap);
    const note = document.createElement("div");
    note.className = "ta-entries-note";
    note.textContent = rows.length+" of "+allRows.length+" brands shown";
    card.appendChild(note);
    const loadMoreBtn = loadWrap.querySelector("#taOcLoadMoreBtn");
    if (loadMoreBtn) loadMoreBtn.onclick = ()=>{ taOcState.levelShown += 5; renderTAOc(); };
    const showAllBtn = loadWrap.querySelector("#taOcShowAllBtn");
    if (showAllBtn) showAllBtn.onclick = ()=>{ taOcState.levelShown = allRows.length; renderTAOc(); };
    const viewLessBtn = loadWrap.querySelector("#taOcViewLessBtn");
    if (viewLessBtn) viewLessBtn.onclick = ()=>{ taOcState.levelShown = 5; renderTAOc(); };
  }
}

function openTAOcModal(){
  renderTAModal({
    title:"Configure chart display",
    subtitle:"Select which ticket statuses to include in the chart",
    groups:[
      {label:"Open tickets", options:TA_STATUSES.filter(s=>s!=="Closed"), selected:taOcState.openBucket, onChange:(v)=>{taOcState.openBucket=v; openTAOcModal(); renderTAOc();}},
      {label:"Closed tickets", options:TA_STATUSES.filter(s=>s!=="Open"), selected:taOcState.closedBucket, onChange:(v)=>{taOcState.closedBucket=v; openTAOcModal(); renderTAOc();}}
    ],
    onClose: ()=> renderTAOc()
  });
}

/* ---------------- section: Ticket performance overview ---------------- */
function taPerfScopedBrands(){
  return taPerfState.brands.length ? TA_BRANDS.filter(b=>taPerfState.brands.includes(b.name)) : TA_BRANDS;
}

function renderTAPerf(){
  const card = document.getElementById("taPerfSection");
  if(!card) return;
  card.innerHTML = "";
  const head = document.createElement("div");
  head.className = "ta-section-head";
  head.innerHTML = '<h2>Ticket Performance Overview</h2>';
  const actions = document.createElement("div");
  actions.className = "ta-section-head-actions";
  const gearBtn = document.createElement("button");
  gearBtn.className = "ta-icon-btn"; gearBtn.textContent = "⚙"; gearBtn.title = "Configure buckets";
  gearBtn.onclick = ()=> openTAPerfModal();
  actions.appendChild(gearBtn);
  head.appendChild(actions);
  card.appendChild(head);

  const filterRow = document.createElement("div");
  filterRow.className = "ta-filter-bar"; filterRow.style.marginBottom = "14px";
  const seg = document.createElement("div");
  seg.className = "ta-seg";
  ["Overall","Brand"].forEach(m=>{
    const b = document.createElement("button");
    b.textContent = m;
    if (m===taPerfState.scope) b.classList.add("active");
    b.onclick = ()=>{ taPerfState.scope=m; if(m==="Overall") taPerfState.brands=[]; taPerfState.openDropdown=null; renderTAPerf(); };
    seg.appendChild(b);
  });
  filterRow.appendChild(seg);
  if (taPerfState.scope==="Brand"){
    filterRow.appendChild(makeTAMultiDropdown2({key:"perfBrand", placeholder:"Select brands", options:TA_BRANDS.map(b=>b.name), selected:taPerfState.brands, onChange:(v)=>{taPerfState.brands=v; renderTAPerf();}, state:taPerfState, rerender:renderTAPerf}));
  }
  const perfProjOptions = TA_PROJECTS.filter(p=> taPerfState.brands.length===0 || taPerfState.brands.includes(p.brand)).map(p=>({ value:taProjectKey(p.brand,p.name), label: taPerfState.brands.length===1 ? p.name : p.brand+" - "+p.name }));
  filterRow.appendChild(makeTAMultiDropdown2({key:"perfProject", placeholder:"Select projects", options:perfProjOptions, selected:taPerfState.projects, onChange:(v)=>{taPerfState.projects=v; renderTAPerf();}, state:taPerfState, rerender:renderTAPerf}));
  filterRow.appendChild(renderTADateControl({ state:taPerfState, valueKey:"date", rerender:renderTAPerf }));
  card.appendChild(filterRow);

  const brands = taPerfScopedBrands();
  let rows = brands.map(b=>{
    const dist = taScopedDist(b, taPerfState.projects, taPerfState.date, taPerfState.customFrom, taPerfState.customTo);
    const total = dist.reduce((a,c)=>a+c,0);
    const open = dist.reduce((s,v,i)=> s + (taPerfState.openBucket.includes(TA_STATUSES[i])?v:0),0);
    const closed = dist.reduce((s,v,i)=> s + (taPerfState.closedBucket.includes(TA_STATUSES[i])?v:0),0);
    const fcr = dist.reduce((s,v,i)=> s + (taPerfState.fcrBucket.includes(TA_STATUSES[i])?v:0),0);
    return { name:b.name, open, closed, fcr, total,
      openRate: total ? Math.round(open/total*100) : 0,
      closureRate: total ? Math.round(closed/total*100) : 0,
      fcrRate: total ? Math.round(fcr/total*100) : 0 };
  });
  rows.sort((a,b)=> taPerfState.sortDir==="desc" ? b[taPerfState.sortCol]-a[taPerfState.sortCol] : a[taPerfState.sortCol]-b[taPerfState.sortCol]);

  const totalPages = Math.max(1, Math.ceil(rows.length/taPerfState.perPage));
  taPerfState.page = Math.min(taPerfState.page, totalPages);
  const pageStart = (taPerfState.page-1)*taPerfState.perPage;
  const pageRows = rows.slice(pageStart, pageStart+taPerfState.perPage);

  function th(label, col){
    const arrow = taPerfState.sortCol===col ? (taPerfState.sortDir==="desc" ? "↓" : "↑") : "";
    return '<th class="ta-num" data-col="'+col+'">'+label+'<span class="ta-arrow">'+arrow+'</span></th>';
  }
  const tbl = document.createElement("table");
  tbl.className = "ta-perf-table";
  tbl.innerHTML = '<thead><tr>'+
      '<th>Brand</th><th class="ta-num">Open tickets</th><th class="ta-num">Closed tickets</th><th class="ta-num">FCR tickets</th><th class="ta-num">Total tickets</th>'+
      th("Open rate","openRate")+th("Closure rate","closureRate")+th("FCR rate","fcrRate")+
    '</tr></thead><tbody>'+
      pageRows.map(r=>'<tr><td>'+esc(r.name)+'</td><td class="ta-num">'+r.open.toLocaleString()+'</td><td class="ta-num">'+r.closed.toLocaleString()+'</td><td class="ta-num">'+r.fcr.toLocaleString()+'</td><td class="ta-num">'+r.total.toLocaleString()+'</td><td class="ta-num">'+r.openRate+'%</td><td class="ta-num">'+r.closureRate+'%</td><td class="ta-num">'+r.fcrRate+'%</td></tr>').join("")+
    '</tbody>';
  card.appendChild(tbl);
  tbl.querySelectorAll("th[data-col]").forEach(h=>{
    h.onclick = ()=>{
      const col = h.dataset.col;
      if (taPerfState.sortCol===col){ taPerfState.sortDir = taPerfState.sortDir==="desc" ? "asc" : "desc"; }
      else { taPerfState.sortCol=col; taPerfState.sortDir="desc"; }
      taPerfState.page = 1;
      renderTAPerf();
    };
  });

  const pager = document.createElement("div");
  pager.className = "ta-pager";
  pager.innerHTML = `
    <div><select id="taPerfPerPage">${[10,25,50].map(n=>`<option value="${n}" ${n===taPerfState.perPage?'selected':''}>${n}</option>`).join("")}</select> per page</div>
    <div>Showing ${rows.length ? pageStart+1 : 0} to ${pageStart+pageRows.length} of ${rows.length} brands</div>
    <div class="ta-pages">
      <button id="taPerfPrevPage" ${taPerfState.page<=1?'disabled':''}>Previous</button>
      Page ${taPerfState.page} of ${totalPages}
      <button id="taPerfNextPage" ${taPerfState.page>=totalPages?'disabled':''}>Next</button>
    </div>`;
  card.appendChild(pager);
  document.getElementById("taPerfPerPage").onchange = (e)=>{ taPerfState.perPage = parseInt(e.target.value); taPerfState.page = 1; renderTAPerf(); };
  document.getElementById("taPerfPrevPage").onclick = ()=>{ taPerfState.page--; renderTAPerf(); };
  document.getElementById("taPerfNextPage").onclick = ()=>{ taPerfState.page++; renderTAPerf(); };
}

function openTAPerfModal(){
  renderTAModal({
    title:"Configure bucket display",
    subtitle:"Select which ticket statuses count toward each metric",
    groups:[
      {label:"Open tickets", options:TA_STATUSES.filter(s=>s!=="Closed"), selected:taPerfState.openBucket, onChange:(v)=>{taPerfState.openBucket=v; openTAPerfModal(); renderTAPerf();}},
      {label:"Closed tickets", options:TA_STATUSES.filter(s=>s!=="Open"), selected:taPerfState.closedBucket, onChange:(v)=>{taPerfState.closedBucket=v; openTAPerfModal(); renderTAPerf();}},
      {label:"FCR tickets", options:TA_STATUSES, selected:taPerfState.fcrBucket, onChange:(v)=>{taPerfState.fcrBucket=v; openTAPerfModal(); renderTAPerf();}}
    ],
    onClose: ()=> renderTAPerf()
  });
}

/* ---------------- top-level wiring ---------------- */
function renderTAAll(){
  taState.selectedStatus = null;
  renderTAFilterBar();
  renderTAHeader();
  const drillArea = document.getElementById("taDrillArea");
  if(drillArea) drillArea.innerHTML = "";
}

function taGlobalClickHandler(){
  if(taState.openDropdown){ taState.openDropdown=null; renderTAFilterBar(); }
  if(taOcState.openDropdown){ taOcState.openDropdown=null; renderTAOc(); }
  if(taPerfState.openDropdown){ taPerfState.openDropdown=null; renderTAPerf(); }
  if(taState.calOpen){ taCloseCalendar(taState); renderTAFilterBar(); }
  if(taOcState.calOpen){ taCloseCalendar(taOcState); renderTAOc(); }
  if(taPerfState.calOpen){ taCloseCalendar(taPerfState); renderTAPerf(); }
}

function ensureTAModalRoot(){
  if(!document.getElementById('taModalRoot')){
    const d = document.createElement('div');
    d.id = 'taModalRoot';
    document.body.appendChild(d);
  }
}

function injectTAStyles(){
  if(document.getElementById('taStyles')) return;
  const style = document.createElement('style');
  style.id = 'taStyles';
  style.textContent = `
    .ta-page{max-width:1200px;margin:0 auto;padding:20px 0 40px;color:var(--ink);font-size:14px;}
    .ta-h1{font-size:20px;font-weight:600;margin:0 0 18px;color:var(--ink);}
    .ta-filter-bar{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:20px;align-items:flex-start;position:relative;}
    .ta-seg{display:flex;border:1px solid var(--line);border-radius:6px;overflow:hidden;height:36px;}
    .ta-seg button{border:none;background:#fff;padding:8px 14px;font-size:13px;font-family:inherit;cursor:pointer;color:var(--ink-2);border-right:1px solid var(--line);}
    .ta-seg button:last-child{border-right:none;}
    .ta-seg button.active{background:var(--primary);color:#fff;font-weight:500;}
    .ta-dd{position:relative;}
    .ta-dd-btn{border:1px solid var(--line);border-radius:6px;background:#fff;padding:8px 12px;font-size:13px;font-family:inherit;cursor:pointer;min-width:150px;height:36px;text-align:left;display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--ink);}
    .ta-dd-btn .ta-muted{color:var(--muted);}
    .ta-dd-panel{position:absolute;top:calc(100% + 4px);left:0;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow-lg);width:240px;z-index:400;padding:8px;}
    .ta-dd-search{width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:6px;font-size:12.5px;font-family:inherit;margin-bottom:6px;outline:none;box-sizing:border-box;}
    .ta-dd-selectall{font-size:12px;color:var(--primary);cursor:pointer;padding:4px 6px;font-weight:500;}
    .ta-dd-list{max-height:220px;overflow-y:auto;margin-top:4px;}
    .ta-dd-item{display:flex;align-items:center;gap:8px;padding:6px 6px;font-size:13px;cursor:pointer;border-radius:4px;}
    .ta-dd-item:hover{background:var(--bg);}
    .ta-dd-item input{margin:0;}
    .ta-date-select{border:1px solid var(--line);border-radius:6px;padding:8px 10px;font-size:13px;font-family:inherit;background:#fff;height:36px;}
    .ta-custom-dates{display:flex;gap:6px;align-items:center;}
    .ta-custom-dates input{border:1px solid var(--line);border-radius:6px;padding:6px 8px;font-size:12.5px;font-family:inherit;}
    .ta-header-card{border:1px solid var(--line);border-radius:12px;padding:18px 20px;background:#fff;margin-bottom:20px;}
    .ta-card-title{font-size:15px;font-weight:600;margin:0 0 14px;color:var(--ink);}
    .ta-total-num{font-size:30px;font-weight:600;color:var(--ink);}
    .ta-total-sub{font-size:12.5px;color:var(--muted);margin-bottom:14px;}
    .ta-bar-row{display:flex;align-items:center;gap:10px;margin-bottom:9px;cursor:pointer;}
    .ta-bar-row .ta-lbl{width:160px;font-size:12.5px;color:var(--ink);flex-shrink:0;}
    .ta-bar-row .ta-track{flex:1;background:var(--bg);border-radius:4px;height:20px;position:relative;}
    .ta-bar-row .ta-fill{height:100%;border-radius:4px;}
    .ta-bar-row .ta-val{width:60px;text-align:right;font-size:12.5px;font-weight:600;color:var(--ink);}
    .ta-breadcrumb{font-size:12.5px;color:var(--muted);margin:4px 0 10px;}
    .ta-breadcrumb span{cursor:pointer;}
    .ta-breadcrumb b{color:var(--ink);font-weight:600;}
    .ta-breadcrumb .ta-sep{margin:0 6px;}
    .ta-panel{border:1px solid var(--line);border-radius:10px;padding:16px 18px;background:#fff;margin-bottom:14px;}
    .ta-empty{color:var(--muted);font-size:13px;text-align:center;padding:26px 10px;}
    .ta-load-controls{display:flex;justify-content:center;gap:16px;margin-top:6px;}
    .ta-load-btn{padding:7px 14px;border:1px solid var(--line);border-radius:6px;background:#fff;font-size:12.5px;cursor:pointer;font-family:inherit;color:var(--ink);}
    .ta-load-link{background:none;border:none;color:var(--primary);font-size:12.5px;cursor:pointer;font-family:inherit;}
    .ta-entries-note{text-align:center;font-size:12px;color:var(--muted);margin-top:8px;}
    .ta-section-card{border:1px solid var(--line);border-radius:12px;padding:18px 20px;background:#fff;margin-top:24px;}
    .ta-section-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;}
    .ta-section-head h2{font-size:15px;font-weight:600;margin:0;color:var(--ink);}
    .ta-section-head-actions{display:flex;align-items:center;gap:8px;}
    .ta-icon-btn{width:32px;height:32px;border:1px solid var(--line);border-radius:6px;background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:15px;color:var(--muted);}
    .ta-icon-btn.active{background:var(--bg);color:var(--ink);}
    .ta-legend-row{display:flex;gap:16px;font-size:12px;color:var(--muted);margin:8px 0 12px;}
    .ta-legend-dot{width:9px;height:9px;border-radius:50%;display:inline-block;margin-right:5px;}
    .ta-oc-row{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
    .ta-oc-row .ta-lbl{width:170px;font-size:12.5px;flex-shrink:0;color:var(--ink);}
    .ta-oc-stack-track{flex:1;height:20px;display:flex;align-items:center;}
    .ta-oc-stack{height:100%;border-radius:4px;display:flex;overflow:hidden;background:var(--bg);}
    .ta-oc-seg{height:100%;}
    .ta-oc-row .ta-val{width:190px;text-align:right;font-size:12px;color:var(--muted);flex-shrink:0;}
    table.ta-perf-table{width:100%;border-collapse:collapse;font-size:13px;}
    table.ta-perf-table th{text-align:left;padding:9px 8px;border-bottom:1px solid var(--line-2);font-weight:600;color:var(--ink);cursor:pointer;white-space:nowrap;}
    table.ta-perf-table th.ta-num, table.ta-perf-table td.ta-num{text-align:right;}
    table.ta-perf-table td{padding:11px 8px;border-bottom:1px solid var(--line-2);color:var(--ink);}
    table.ta-perf-table th .ta-arrow{font-size:10px;color:var(--muted);margin-left:3px;}
    .ta-pager{display:flex;align-items:center;justify-content:space-between;margin-top:14px;font-size:12.5px;color:var(--muted);flex-wrap:wrap;gap:8px;}
    .ta-pager select{padding:5px 8px;border:1px solid var(--line);border-radius:6px;font-family:inherit;}
    .ta-pager .ta-pages{display:flex;align-items:center;gap:8px;}
    .ta-pager button{padding:6px 12px;border:1px solid var(--line);background:#fff;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12.5px;}
    .ta-pager button:disabled{opacity:.4;cursor:default;}
    .ta-modal-overlay{position:fixed;inset:0;background:rgba(25,18,40,.45);display:flex;align-items:center;justify-content:center;z-index:9999;}
    .ta-modal-box{background:#fff;border-radius:10px;padding:24px 28px;max-width:520px;width:92%;max-height:80vh;overflow-y:auto;}
    .ta-modal-box h3{font-size:17px;font-weight:600;margin:0 0 4px;text-align:center;color:var(--ink);}
    .ta-modal-sub{font-size:13px;color:var(--muted);text-align:center;margin-bottom:18px;}
    .ta-modal-groups{display:flex;gap:32px;flex-wrap:wrap;}
    .ta-modal-group-label{font-size:13px;font-weight:600;width:110px;flex-shrink:0;padding-top:4px;color:var(--ink);}
    .ta-modal-checks{display:flex;flex-direction:column;gap:8px;}
    .ta-modal-checks label{display:flex;align-items:center;gap:8px;font-size:13.5px;cursor:pointer;color:var(--ink);}
    .ta-modal-close-btn{margin-top:20px;width:100%;padding:10px;border:1px solid var(--line);border-radius:6px;background:#fff;font-family:inherit;font-size:14px;cursor:pointer;color:var(--ink);}
    .ta-cal-panel{position:absolute;top:calc(100% + 4px);left:0;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow-lg);width:260px;z-index:400;padding:10px;}
    .ta-cal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
    .ta-cal-label{font-size:13px;font-weight:600;color:var(--ink);}
    .ta-cal-nav{border:1px solid var(--line);background:#fff;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:14px;color:var(--ink-2);line-height:1;}
    .ta-cal-nav:hover{background:var(--bg);}
    .ta-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;}
    .ta-cal-dow{font-size:10.5px;color:var(--muted);text-align:center;padding:4px 0;font-weight:600;}
    .ta-cal-day{font-size:12.5px;text-align:center;padding:6px 0;cursor:pointer;color:var(--ink);border-radius:4px;}
    .ta-cal-day:not(.ta-cal-blank):hover{background:var(--bg);}
    .ta-cal-day.ta-cal-blank{cursor:default;}
    .ta-cal-day.in-range{background:var(--primary-050);border-radius:0;}
    .ta-cal-day.range-start{border-radius:50% 0 0 50%;}
    .ta-cal-day.range-end{border-radius:0 50% 50% 0;}
    .ta-cal-day.range-start.range-end{border-radius:50%;}
    .ta-cal-day.range-start,.ta-cal-day.range-end{background:var(--primary);color:#fff;font-weight:600;}
    .ta-cal-footer{margin-top:8px;padding-top:8px;border-top:1px solid var(--line-2);font-size:12px;color:var(--muted);display:flex;align-items:center;justify-content:space-between;gap:8px;}
    .ta-cal-clear{border:none;background:none;color:var(--primary);font-size:12px;font-weight:500;cursor:pointer;font-family:inherit;padding:0;}
  `;
  document.head.appendChild(style);
}

function renderTicketOverview(){
  injectTAStyles();
  ensureTAModalRoot();
  document.getElementById('taModalRoot').innerHTML = '';
  mount().innerHTML = `
    <div class="ta-page">
      <h1 class="ta-h1">Ticketing Analytics - Overview</h1>
      <div class="ta-header-card">
        <h2 class="ta-card-title">Tickets - Progressive Drilldown</h2>
        <div class="ta-filter-bar" id="taFilterBar"></div>
        <div id="taHeaderCardBody"></div>
      </div>
      <div id="taDrillArea"></div>
      <div class="ta-section-card" id="taOcSection"></div>
      <div class="ta-section-card" id="taPerfSection"></div>
    </div>
  `;
  if(!window.__taClickBound){
    window.__taClickBound = true;
    document.addEventListener('click', taGlobalClickHandler);
  }
  renderTAAll();
  renderTAOc();
  renderTAPerf();
}
function kpiGrid(){
  return `<div class="kpi-grid">
    <div class="kpi k-open"><div class="k-label">Open Tickets</div><div class="k-val">${KPI.OPEN}</div></div>
    <div class="kpi k-prog"><div class="k-label">In progress Tickets</div><div class="k-val">${KPI.INPROGRESS}</div></div>
    <div class="kpi k-verify"><div class="k-label">Under Verification Tickets</div><div class="k-val">${KPI.VERIFY}</div></div>
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
      <select class="select fdrop" id="fStatus"><option value="">Status</option>${ENUM.status.map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${statusLabel(s)}</option>`).join('')}</select>
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
  /* BRAND BREAKDOWN MODAL — KPI card click handlers */
  const kpiMap={'k-open':'OPEN', 'k-prog':'INPROGRESS', 'k-verify':'VERIFY', 'k-res':'RESOLVED', 'k-closed':'CLOSED', 'k-reopen':'REOPEN'};
  Object.entries(kpiMap).forEach(([klass,status])=>{
    const el=document.querySelector(`.${klass}`);
    if(el){el.style.cursor='pointer'; el.onclick=()=>openBrandBreakdownModal(status);}
  });
  /* END BRAND BREAKDOWN MODAL */
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
          <select class="select" id="dAssignee">${getAssigneeOptionsHTML(draft.assignee)}</select></div>
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
      <div class="chips" id="dSuggested">${((p.suggestedTags||[]).concat(['cod','asdfghkl'])).filter((v,i,a)=>a.indexOf(v)===i).map(t=>`<button type="button" class="chip tag ${draft.tags.includes(t)?'on':''}" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
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
  const prefix=p.code||makeProjectCode(p.name);
  const cat=resolvedCategory(), sub=resolvedSubCategory();

  // Show loader
  closeModal();
  mount().innerHTML=`<div style="display:flex;align-items:center;justify-content:center;height:100%;"><div style="text-align:center"><div style="font-size:48px;margin-bottom:20px">⏳</div><div style="font-size:18px;color:#666;margin-bottom:10px">Creating ticket...</div><div style="font-size:14px;color:#999">Please wait while we process your request</div></div></div>`;

  // Simulate processing delay for UX
  setTimeout(()=>{
    const t=mkTicket({num:nextTicketNo(prefix), brand:p.brand, project:p.project_id, projectName:p.name,
      title:draft.title.trim(), status:'OPEN', type:draft.type, priority:draft.priority, source:'MANUAL', manualSource:draft.source,
      sentiment:draft.sentiment||null, subCategory:sub||null,
      store:draft.store||null, storeName:store?store.name:null, location:store?store.address:null,
      city:store?store.city:null, state:store?store.state:null, zone:store?store.zone:null, country:store?store.country:'India',
      assigned:draft.assignee, assignedName:agentName(draft.assignee), createdBy:CURRENT_USER.name,
      customer:{name:draft.custName||'—', email:draft.custEmail, phone:draft.custPhone, id:draft.custId},
      description:draft.desc, categories:cat?[cat]:[], tags:draft.tags.slice(),
      skus:draft.sku?[draft.sku]:[], billId:draft.invoices[0]||null,
      attachments:draft.files.map((f,i)=>({attachment_id:'att_'+Date.now()+i, filename:f.name, size_bytes:f.size, mime_type:f.type||'application/octet-stream', uploaded_by:CURRENT_USER.email, uploaded_at:new Date()})),
      history:[{field:'status', old:'—', neu:'OPEN', by:CURRENT_USER.email, at:new Date()},
               {field:'assigned_to', old:'—', neu:agentName(draft.assignee), by:CURRENT_USER.email, at:new Date()}],
    });
    TICKETS.unshift(t); KPI.OPEN++; KPI.TOTAL++;
    LOGS.unshift({at:new Date(), ticket:t.ticket_number, event:'CREATED', actor:CURRENT_USER.name, detail:`Ticket created from ${titleCase(draft.source)}`});
    toast('✅ Ticket Created', `${t.ticket_number} · ${t.title}`);
    go('view/'+t.ticket_number);
  }, 800);
}

/* ============================================================ VERIF_FEATURE
   Verification flow: ops agent sends a ticket for review, the system picks a
   verifier from a per-project pool (load-based, availability-aware), and the
   verifier either marks it verified or rejects it back with a reason.
   REMOVABLE: this whole block, plus a handful of single-line call-sites each
   marked with a VERIF_FEATURE hook comment inside ticketDetailHTML, wireDetail,
   historyEntries, and pjRenderForm (Projects tab). Delete the block and those
   lines and nothing else in the app changes. ============================================================ */
const VERIF_CONFIG = {
  pe_test_2: { verifiers: ['rahul.ukey@karnival.com', 'sushil.sharma@karnival.com'], instructions: 'Check the comments, Check the resolution' },
  soll_cod: { verifiers: ['siva@karnival.com', 'rahul.ukey@karnival.com'], instructions: 'Confirm the COD refund or resolution was actually applied before signing off.' },
  vh_live: { verifiers: ['siva.kumar@karnival.com', 'priya.menon@karnival.com'], instructions: 'Cross-check the dashboard figures against the live store feed before marking verified.' },
}; // project_id -> {verifiers:[email,...], instructions:''}
const VERIF_REJECT_REASONS = ['Incomplete Work','Incorrect Resolution','Missing Documentation','Policy Not Followed','Other'];

function verifConfig(projectId){ return VERIF_CONFIG[projectId] || null; }

function verifPickVerifier(projectId){
  const cfg = verifConfig(projectId);
  if(!cfg || !cfg.verifiers.length) return null;
  let pool = cfg.verifiers.filter(e=>StatusService.isAgentAvailable(e));
  const fellBack = pool.length===0;
  if(fellBack) pool = cfg.verifiers.slice();
  const load = email => TICKETS.filter(t2=>t2.assigned_to===email && t2.ticket_status==='VERIFY').length;
  let best = pool[0];
  pool.forEach(e=>{ if(load(e) < load(best)) best = e; });
  return { email: best, fellBack };
}

// Inline button only — rendered as a flex child of .detail-controls, pushed to the right of Priority/Status/Store/Due Date.
function verifSendButtonHTML(t){
  const cfg = verifConfig(t.project_id);
  if(!cfg || !cfg.verifiers.length) return '';
  if(t.ticket_status==='VERIFY') return '';
  if(t.assigned_to===CURRENT_USER.email && !['RESOLVED','CLOSED'].includes(t.ticket_status)){
    return `<button class="btn btn-light btn-sm" id="verifSend" style="margin-left:auto">🔍 Send for Verification</button>`;
  }
  return '';
}
// Everything else — the Mark Verified/Reject panel and the passive "awaiting verification" note — stays below the controls row.
function verifStatusPanelHTML(t){
  const cfg = verifConfig(t.project_id);
  if(!cfg || !cfg.verifiers.length) return '';
  if(t.ticket_status==='VERIFY'){
    if(t.assigned_to===CURRENT_USER.email){
      return `<div class="panel" style="margin-top:14px;border-color:var(--primary-050);background:var(--primary-050)">
        <div class="kv-l">🔍 Verification</div>
        ${cfg.instructions?`<div class="page-sub" style="margin:8px 0;white-space:pre-wrap">${esc(cfg.instructions)}</div>`:'<div class="page-sub" style="margin:8px 0">No instructions configured for this project.</div>'}
        <div class="row" style="gap:8px;margin-top:10px">
          <button class="btn btn-primary btn-sm" id="verifMarkVerified">✓ Mark Verified</button>
          <button class="btn btn-light btn-sm" id="verifReject" style="color:#dc2626">Reject</button>
        </div></div>`;
    }
    return `<div class="page-sub" style="margin-top:10px">🔍 Awaiting verification — assigned to <b>${esc(agentName(t.assigned_to))}</b></div>`;
  }
  return '';
}

function verifWireTicketControls(t){
  const sendBtn = $('#verifSend');
  if(sendBtn) sendBtn.onclick=(e)=>{
    e.stopPropagation();
    const picked = verifPickVerifier(t.project_id);
    if(!picked) return;
    t._verifyMeta = { prevAssignee:t.assigned_to, prevAssigneeName:t.assigned_name||agentName(t.assigned_to) };
    const oldStatus=t.ticket_status;
    t.assigned_to=picked.email; t.assigned_name=agentName(picked.email);
    t.ticket_status='VERIFY';
    t.history_audit=t.history_audit||[];
    t.history_audit.unshift({field:'verification_sent', old:statusLabel(oldStatus), neu:agentName(picked.email), by:CURRENT_USER.email, at:new Date()});
    LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'VERIFICATION_SENT',actor:CURRENT_USER.name,detail:`Sent for verification → ${agentName(picked.email)}`});
    toast('🔍 Sent for Verification', picked.fellBack?`${agentName(picked.email)} (all verifiers unavailable)`:agentName(picked.email));
    paintListKeepScroll();
  };
  const mvBtn = $('#verifMarkVerified');
  if(mvBtn) mvBtn.onclick=(e)=>{
    e.stopPropagation();
    t.history_audit=t.history_audit||[];
    t.history_audit.unshift({field:'verification_result', neu:'Verified', by:CURRENT_USER.email, at:new Date()});
    t.ticket_status='RESOLVED';
    LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'VERIFIED',actor:CURRENT_USER.name,detail:'Ticket verified'});
    toast('✓ Marked Verified', t.ticket_number);
    paintListKeepScroll();
  };
  const rjBtn = $('#verifReject');
  if(rjBtn) rjBtn.onclick=(e)=>{ e.stopPropagation(); verifOpenRejectModal(t); };
}

function verifOpenRejectModal(t){
  let reason='', note='';
  const prevName = t._verifyMeta ? t._verifyMeta.prevAssigneeName : 'the agent';
  openModal(`<div class="modal-head"><div class="mh-ico">↩️</div><h2>Reject Verification</h2><button class="modal-close" data-close>×</button></div>
    <div class="modal-body">
      <label class="lbl">Reason <span class="req">*</span></label>
      <select class="select" id="vjReason"><option value="">Select Reason</option>${VERIF_REJECT_REASONS.map(r=>`<option>${esc(r)}</option>`).join('')}</select>
      <label class="lbl" style="margin-top:16px">Notes for ${esc(prevName)} <span class="req">*</span> (Min 20 characters)</label>
      <textarea class="field" id="vjNote" rows="4" placeholder="What needs to be fixed before this can be verified again..."></textarea>
      <div class="hint" id="vjCount">0 / 20 characters minimum</div>
    </div>
    <div class="modal-foot"><div class="spacer"></div>
      <button class="btn btn-light" data-close>Cancel</button>
      <button class="btn btn-primary" id="vjConfirm" disabled>Reject</button></div>`, 560);
  $$('[data-close]').forEach(b=>b.onclick=closeModal);
  const sync=()=>{ $('#vjConfirm').disabled=!(reason && note.trim().length>=20); };
  $('#vjReason').onchange=e=>{reason=e.target.value;sync();};
  $('#vjNote').oninput=e=>{note=e.target.value;$('#vjCount').textContent=`${note.trim().length} / 20 characters minimum`;sync();};
  $('#vjConfirm').onclick=()=>{
    const prev = t._verifyMeta || {prevAssignee:t.assigned_to, prevAssigneeName:t.assigned_name};
    t.assigned_to=prev.prevAssignee; t.assigned_name=prev.prevAssigneeName;
    t.ticket_status='INPROGRESS';
    t.history_audit=t.history_audit||[];
    t.history_audit.unshift({field:'verification_result', neu:'Rejected', by:CURRENT_USER.email, at:new Date(), reason, note});
    LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'VERIFICATION_REJECTED',actor:CURRENT_USER.name,detail:`Rejected: ${reason}`});
    closeModal();
    toast('↩️ Verification Rejected', `Back to ${prev.prevAssigneeName}`);
    paintListKeepScroll();
  };
}

// Project Configuration UI: eligible verifiers + instructions (appended after Escalation Matrix)
function verifProjectSectionHTML(projectId){
  if(!projectId){
    return `<div class="fsection" style="border-top:1px solid var(--line-2)">
      <div class="fsection-head"><div class="fs-ico violet">🔍</div><h3>Verification</h3></div>
      <div class="page-sub">Save the project first to configure verification.</div></div>`;
  }
  const cfg = VERIF_CONFIG[projectId] || (VERIF_CONFIG[projectId] = {verifiers:[], instructions:''});
  return `<div class="fsection" style="border-top:1px solid var(--line-2)">
    <div class="fsection-head"><div class="fs-ico violet">🔍</div><h3>Verification</h3></div>
    <label class="lbl">Eligible Verifiers</label>
    <select class="select" id="verifPicker"><option value="">Add verifier</option>${AGENTS.map(a=>`<option value="${a.email}">${a.name}</option>`).join('')}</select>
    <div class="sel-box" id="verifPickerBox" style="margin-top:8px"></div>
    <label class="lbl" style="margin-top:14px">Verification Instructions</label>
    <textarea class="field" id="verifInstructions" rows="3" placeholder="What should the verifier check before signing off?">${esc(cfg.instructions)}</textarea>
  </div>`;
}
function verifWireProjectSection(projectId){
  if(!projectId) return;
  const cfg = VERIF_CONFIG[projectId] || (VERIF_CONFIG[projectId] = {verifiers:[], instructions:''});
  const box = $('#verifPickerBox');
  if(!box) return;
  const renderChips=()=>{
    box.innerHTML = cfg.verifiers.map(em=>`<span class="sel-chip">${esc(agentName(em))} <button data-verifrm="${esc(em)}">×</button></span>`).join('') || '<span class="hint">None selected</span>';
    $$('#verifPickerBox [data-verifrm]').forEach(b=>b.onclick=()=>{ cfg.verifiers=cfg.verifiers.filter(x=>x!==b.dataset.verifrm); renderChips(); });
  };
  renderChips();
  $('#verifPicker').onchange=e=>{ if(e.target.value && !cfg.verifiers.includes(e.target.value)){ cfg.verifiers.push(e.target.value); renderChips(); } e.target.value=''; };
  $('#verifInstructions').oninput=e=>{ cfg.instructions=e.target.value; };
}
/* ============================================================ END VERIF_FEATURE ============================================================ */

/* ============================================================ OPS_ADMIN_HANDOFF
   Ops can't call customers — only a Ticket Admin (fixed pool, TICKET_ADMINS in
   data.js) can. Ops investigates and leaves internal comments, but routinely
   forgets to hand the ticket to an Admin once they've worked out next steps.
   Rather than a separate action to remember, the moment an Ops user saves an
   internal comment we ask right there whether to hand the ticket off. This is
   a one-way relay (Ops → Admin → resolved) — no review/reject round-trip like
   VERIF_FEATURE, no new ticket status, no per-project pool config (the admin
   pool is fixed and global). The resulting reassignment is logged with the
   same generic 'assigned_to' history field as any other reassignment — no
   special-cased history entry. REMOVABLE: this block, plus the single call
   in the comments-tab #addComment handler. ============================================================ */
function opsIsCurrentUserAdmin(){ return TICKET_ADMINS.includes(CURRENT_USER.email); }
function opsOpenHandoffPrompt(t){
  openModal(`<div class="modal-head"><div class="mh-ico">🔀</div><h2>Assign this ticket?</h2><button class="modal-close" data-close>×</button></div>
    <div class="modal-body"><p style="margin:0;color:var(--ink-2)">You just added an internal comment. Do you want to assign this ticket to a Ticket Admin now?</p></div>
    <div class="modal-foot"><div class="spacer"></div><button class="btn btn-light" id="opsNo">No, just save the comment</button><button class="btn btn-primary" id="opsYes">Yes, assign</button></div>`, 460);
  $$('[data-close]').forEach(b=>b.onclick=closeModal);
  $('#opsNo').onclick=closeModal;
  $('#opsYes').onclick=()=>opsRenderAssignStep(t);
}
function opsRenderAssignStep(t){
  let picked='';
  $('#modalRoot .modal').innerHTML=`<div class="modal-head"><div class="mh-ico">🔀</div><h2>Assign to Admin</h2><button class="modal-close" data-close>×</button></div>
    <div class="modal-body">
      <label class="lbl">Assign To <span class="req">*</span></label>
      <select class="select" id="opsAdminSelect"><option value="">Select Admin</option>${TICKET_ADMINS.map(email=>`<option value="${email}">${esc(agentName(email))}</option>`).join('')}</select>
    </div>
    <div class="modal-foot"><div class="spacer"></div><button class="btn btn-light" data-close>Cancel</button><button class="btn btn-primary" id="opsAssignSave" disabled>Save</button></div>`;
  $$('[data-close]').forEach(b=>b.onclick=closeModal);
  $('#opsAdminSelect').onchange=e=>{ picked=e.target.value; $('#opsAssignSave').disabled=!picked; };
  $('#opsAssignSave').onclick=()=>{
    const oldName = t.assigned_name||'—';
    t.assigned_to=picked; t.assigned_name=agentName(picked);
    pushHistory(t,'assigned_to',oldName,t.assigned_name);
    LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'OPS_HANDOFF',actor:CURRENT_USER.name,detail:`Assigned to ${agentName(picked)} after internal comment`});
    closeModal();
    toast('Assigned to Admin', agentName(picked));
    paintListKeepScroll();
  };
}
/* ============================================================ END OPS_ADMIN_HANDOFF ============================================================ */

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
        <select class="select" id="dvStatus">${ENUM.status.map(s=>`<option value="${s}" ${t.ticket_status===s?'selected':''}>${statusLabel(s)}</option>`).join('')}</select>
        <select class="select" id="dvStoreAssign"><option value="">Select Store</option>${STORES.map(s=>`<option value="${s.id}" ${t.store===s.id?'selected':''}>${esc(s.name)} · ${esc(s.city)}</option>`).join('')}</select>
        <input type="date" class="select" id="dvDue" value="${t.due_date?t.due_date.toISOString().slice(0,10):''}">
        ${/* VERIF_FEATURE hook */ verifSendButtonHTML(t)}
      </div>
      ${/* VERIF_FEATURE hook */ verifStatusPanelHTML(t)}
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
        ${t.assigned_to?`<div style="display:flex;align-items:center;gap:8px;margin-top:8px;margin-bottom:8px"><div class="avatar" style="width:32px;height:32px;flex-shrink:0">${initials(agentName(t.assigned_to))}<span class="status-dot ${getAgentStatusDotClass(t.assigned_to)}"></span></div><div style="flex:1"><div style="font-weight:600;font-size:13px">${esc(agentName(t.assigned_to))}</div></div></div>`:''}
        <select class="select" id="dvAssignee" style="background:#fff;margin-top:8px">${getAssigneeOptionsHTML(t.assigned_to)}</select>
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
  $('#dvPriority').onchange=e=>{const old=t.ticket_priority;t.ticket_priority=e.target.value.toUpperCase();pushHistory(t,'priority',titleCase(old),titleCase(t.ticket_priority));toast('🎯 Priority Updated',titleCase(t.ticket_priority));};
  $('#dvStatus').onchange=e=>{const old=t.ticket_status;const nw=e.target.value.toUpperCase().replace(/ /g,'_');
    if(nw==='RESOLVED'){ openResolveCloseModal(t,'resolve',old,e.target); return; }
    if(nw==='CLOSED'){ openResolveCloseModal(t,'close',old,e.target); return; }
    transitionStatus(t,old,nw);Array.from(e.target.options).forEach(opt=>{opt.selected=opt.value===nw;});paintListKeepScroll();};
  $('#dvAssignee').onchange=e=>{const old=t.assigned_name||'—';t.assigned_to=e.target.value;t.assigned_name=agentName(e.target.value);pushHistory(t,'assigned_to',old,t.assigned_name);toast('👤 Reassigned',t.assigned_name);LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'ASSIGNED',actor:CURRENT_USER.name,detail:'Assigned to '+t.assigned_name});};
  if($('#dvAssignMe')) $('#dvAssignMe').onclick=(e)=>{e.stopPropagation();const old=t.assigned_name||'—';t.assigned_to=CURRENT_USER.email;t.assigned_name=CURRENT_USER.name;pushHistory(t,'assigned_to',old,CURRENT_USER.name);LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'ASSIGNED',actor:CURRENT_USER.name,detail:'Self-assigned to '+CURRENT_USER.name});paintListKeepScroll();toast('🙋 Self-Assigned','Now assigned to you');};
  if($('#dvStoreAssign')) $('#dvStoreAssign').onchange=e=>{const old=t.storeName||'—';const store=STORES.find(s=>s.id===e.target.value);t.store=e.target.value||null;t.storeName=store?store.name:null;t.location=store?store.address:null;t.city=store?store.city:null;t.state=store?store.state:null;t.zone=store?store.zone:null;pushHistory(t,'store',old,t.storeName||'—');toast('📍 Store Updated',t.storeName||'Cleared');};
  $('#dvDue').onchange=e=>{t.due_date=new Date(e.target.value);t.is_overdue=t.due_date<new Date();toast('📅 Due Date Updated',fmtDT(t.due_date));};
  $('#editTitle').onclick=()=>{const v=prompt('Edit ticket title',t.title);if(v&&v.trim()){t.title=v.trim();paintListKeepScroll();toast('✏️ Title Updated',v.trim());}};
  $('#replyBtn').onclick=()=>openReplyModal(t);
  if($('#dvTagSelect')) $('#dvTagSelect').onchange=e=>{const v=e.target.value;if(v){t.tags=t.tags||[];if(!t.tags.includes(v)){t.tags.push(v);paintListKeepScroll();}}};
  $$('#dvTags [data-rmt]').forEach(b=>b.onclick=()=>{t.tags=t.tags.filter(x=>x!==b.dataset.rmt);paintListKeepScroll();});
  const collab=[],groups=[];
  $('#dvCollab').onchange=e=>{if(e.target.value&&!collab.includes(e.target.value)){collab.push(e.target.value);$('#collabChips').innerHTML=collab.map(c=>`<span class="sel-chip"><span style="display:inline-flex;align-items:center;gap:6px"><span class="avatar" style="width:24px;height:24px;font-size:10px;font-weight:700">${initials(agentName(c))}<span class="status-dot ${getAgentStatusDotClass(c)}"></span></span>${esc(agentName(c))}</span></span>`).join('');}e.target.value='';};
  $('#dvGroup').onchange=e=>{if(e.target.value&&!groups.includes(e.target.value)){groups.push(e.target.value);$('#groupChips').innerHTML=groups.map(g=>`<span class="sel-chip">${esc(g)}</span>`).join('');}e.target.value='';};
  $('#dvAddFile').onclick=()=>$('#dvFileInput').click();
  $('#dvFileInput').onchange=e=>{[...e.target.files].forEach(f=>{t.attachments=t.attachments||[];t.attachments.push({attachment_id:'att_'+Date.now(),filename:f.name,size_bytes:f.size,mime_type:f.type||'application/octet-stream',uploaded_by:CURRENT_USER.email,uploaded_at:new Date()});});paintListKeepScroll();toast('Attachment added');};
  verifWireTicketControls(t); /* VERIF_FEATURE hook */
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
  t.ticket_status=nw; pushHistory(t,'status',statusLabel(old),statusLabel(nw));
  LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'STATUS_CHANGE',actor:CURRENT_USER.name,detail:`${statusLabel(old)} → ${statusLabel(nw)}`});
  if(nw==='RESOLVED'){t.resolved_at=new Date();}
}
function transitionStatus(t,old,nw){
  applyStatus(t,old,nw);
  const emojis={OPEN:'📋',INPROGRESS:'⚙️',VERIFY:'🔍',RESOLVED:'✅',CLOSED:'🔒',ESCALATED:'⬆️',AUTO_ESCALATED:'⬆️',REOPEN:'🔄'};
  const emoji=emojis[nw]||'📊';
  toast(`${emoji} Status Updated`,statusLabel(nw));
}

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
        <optgroup label="Agents">${AGENTS.map(a=>{const s=StatusService.getAgentStatus(a.email);return `<option value="a:${a.email}" ${StatusService.isAgentAvailable(a.email)?'':'disabled'}>${a.name}${s.status==='not_available'&&s.fromDate&&s.tillDate?` (unavailable: ${StatusService.formatDateRange(s.fromDate,s.tillDate)})`:''}</option>`;}).join('')}</optgroup>
        <optgroup label="Groups">${GROUPS.map(g=>`<option value="g:${esc(g)}">${esc(g)}</option>`).join('')}</optgroup></select>
      <button class="btn btn-primary btn-sm" id="bbAssignGo" hidden>Assign</button>
      <select class="select bb-sel" id="bbStatus"><option value="">Status…</option>${ENUM.status.map(s=>`<option value="${s}">${statusLabel(s)}</option>`).join('')}</select>
      <select class="select bb-sel" id="bbPriority"><option value="">Priority…</option>${ENUM.priority.map(p=>`<option>${titleCase(p)}</option>`).join('')}</select>
      <select class="select bb-sel" id="bbTag"><option value="">Add tag…</option>${TAGS.map(t=>`<option>${esc(t)}</option>`).join('')}</select>
    </div>`;
  const sel=()=>[...state.selected].map(findTicket).filter(Boolean);
  $('#bbClear').onclick=()=>{state.selected.clear();paintListKeepScroll();};
  $('#bbSelectAll').onclick=()=>{filteredTickets().forEach(t=>state.selected.add(t.ticket_number));paintListKeepScroll();};
  $('#bbAssignMe').onclick=()=>openBulkAssignConfirm(sel(),CURRENT_USER.email,CURRENT_USER.name,false);
  $('#bbAssign').onchange=e=>{ $('#bbAssignGo').hidden=!e.target.value; };
  $('#bbAssignGo').onclick=()=>{
    const v=$('#bbAssign').value; if(!v) return;
    const isGroup=v.startsWith('g:'); const val=v.slice(2);
    openBulkAssignConfirm(sel(), isGroup?null:val, isGroup?val:agentName(val), isGroup);
  };
  $('#bbStatus').onchange=e=>{if(e.target.value) {bulkStatus(sel(), e.target.value.toUpperCase().replace(/ /g,'_'));e.target.value='';}};  $('#bbPriority').onchange=e=>{if(e.target.value) bulkPriority(sel(), e.target.value.toUpperCase());};
  $('#bbTag').onchange=e=>{if(e.target.value) bulkTag(sel(), e.target.value);};
}
function openBulkAssignConfirm(list, email, name, isGroup){
  if(!list.length) return;
  const noun=list.length>1?'Tickets':'Ticket';
  openModal(`<div class="modal-head"><div class="mh-ico">${isGroup?'👥':'👤'}</div><h2>Assign ${list.length} ${noun}</h2><button class="modal-close" data-close>×</button></div>
    <div class="modal-body">
      <div class="ok-text">Applying to ${list.length} selected ticket(s): ${list.map(t=>t.ticket_number).join(', ')}</div>
      <div style="margin-top:14px;font-size:14px">Assign to <b>${esc(name)}</b>${isGroup?' (group)':''}?</div>
    </div>
    <div class="modal-foot"><div class="spacer"></div>
      <button class="btn btn-light" data-close>Cancel</button>
      <button class="btn btn-primary" id="baConfirm">Assign ${list.length} ${noun}</button></div>`, 560);
  $$('[data-close]').forEach(b=>b.onclick=closeModal);
  $('#baConfirm').onclick=()=>{ closeModal(); bulkAssign(list, email, name, isGroup); };
}
function bulkAssign(list, email, name, isGroup){
  if(!list.length) return;
  list.forEach(t=>{ if(isGroup){ const old=t.group_assigned_to||'—'; t.group_assigned_to=name; pushHistory(t,'group_assigned_to',old,name); }
    else { const old=t.assigned_name||'—'; t.assigned_to=email; t.assigned_name=name; pushHistory(t,'assigned_to',old,name); }
    LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'ASSIGNED',actor:CURRENT_USER.name,detail:`${isGroup?'Group ':''}Assigned to ${name} (bulk)`}); });
  toast(`${isGroup?'👥':'👤'} Bulk Assigned`,`${list.length} ticket(s) → ${name}`); state.selected.clear(); paintListKeepScroll();
}
function bulkPriority(list,p){ list.forEach(t=>{const old=t.ticket_priority;t.ticket_priority=p;pushHistory(t,'priority',titleCase(old),titleCase(p));});
  toast('🎯 Bulk Priority Updated',`${list.length} ticket(s) → ${titleCase(p)}`); state.selected.clear(); paintListKeepScroll(); }
function bulkTag(list,tag){ list.forEach(t=>{t.tags=t.tags||[];if(!t.tags.includes(tag))t.tags.push(tag);pushHistory(t,'tag','—',tag);});
  toast('🏷️ Tag Added',`"${tag}" → ${list.length} ticket(s)`); state.selected.clear(); paintListKeepScroll(); }
function bulkStatus(list,nw){
  if(!list.length) return;
  if(nw==='RESOLVED'||nw==='CLOSED'){ openBulkResolveClose(list, nw==='RESOLVED'?'resolve':'close'); return; }
  list.forEach(t=>applyStatus(t,t.ticket_status,nw));
  const emojis={OPEN:'📋',INPROGRESS:'⚙️',VERIFY:'🔍',RESOLVED:'✅',CLOSED:'🔒',ESCALATED:'⬆️',AUTO_ESCALATED:'⬆️',REOPEN:'🔄'};
  const emoji=emojis[nw]||'📊';
  toast(`${emoji} Bulk Status Updated`,`${list.length} ticket(s) → ${statusLabel(nw)}`); state.selected.clear(); paintListKeepScroll();
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
function pushHistory(t,field,old,neu){t.history_audit=t.history_audit||[];t.history_audit.unshift({field,old,neu,by:CURRENT_USER.email,at:new Date()});t.updated_at=new Date();}
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
        <div class="row" style="gap:10px;margin-bottom:12px"><div class="avatar" style="width:34px;height:34px;background:#ece7f6;color:var(--primary);position:relative">R<span class="status-dot ${getAgentStatusDotClass(CURRENT_USER.email)}"></span></div>
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
      t.comments=t.comments||[];t.comments.push({author:CURRENT_USER.name,email:CURRENT_USER.email,text,internal:mode==='internal',at:new Date(),mentions});
      t.updated_at=new Date();
      LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'COMMENT_ADDED',actor:CURRENT_USER.name,detail:(mode==='internal'?'Internal':'Public')+' comment added'});
      paintListKeepScroll();toast('Comment saved',mentions.length?`Notified ${mentions.length} mention(s)`:'');
      if(mode==='internal' && !opsIsCurrentUserAdmin()) opsOpenHandoffPrompt(t); /* OPS_ADMIN_HANDOFF hook */};
  } else {
    b.innerHTML=`<div style="font-weight:700;margin-bottom:16px">Change History</div>
      ${historyEntries(t).map(h=>`<div class="hist-item">
        <div class="avatar" style="width:34px;height:34px;background:#eef0f5;color:#5b6472;position:relative">${initials(h.actorName)}<span class="status-dot ${getAgentStatusDotClass(h.actor)}"></span></div>
        <div style="flex:1"><div class="row" style="justify-content:space-between"><div>
          <div style="font-weight:600">${esc(h.actorName)}</div><div class="c-time">${fmtDateAbs(h.at)}</div></div>
          ${h.badge?`<span class="hist-badge">${esc(h.badge)}</span>`:''}</div>
          <div class="c-body" style="margin-top:6px">${h.html}</div></div></div>`).join('')||'<div class="page-sub">No history.</div>'}`;
  }
}
// build a chronological change-history feed (comments + field changes + creation)
function historyEntries(t){
  const items=[];
  (t.comments||[]).forEach(c=>items.push({at:c.at, actor:c.email||c.author, actorName:c.author, badge:c.internal?'Internal comment':'Public reply', html:`Comment: ${renderMentions(c.text)}`}));
  const pill=v=>`<span class="hist-pill">${esc(v)}</span>`;
  (t.history_audit||[]).forEach(h=>{ if(h.field==='comment') return;
    if(h.field==='resolution'||h.field==='closure'){   // resolve/close: show reason, category + the note
      items.push({at:h.at, actor:h.by, actorName:agentName(h.by)||h.by, badge: h.field==='resolution'?'Resolved':'Closed',
        html:`<b>Reason:</b> ${esc(h.reason)} &nbsp;·&nbsp; <b>Category:</b> ${esc(h.category)}${h.note?`<div class="c-body" style="margin-top:6px">${esc(h.note)}</div>`:''}`});
      return; }
    /* VERIF_FEATURE hook */
    if(h.field==='verification_sent'){
      items.push({at:h.at, actor:h.by, actorName:agentName(h.by)||h.by, badge:'Sent for Verification',
        html:`<b>Sent for Verification</b> → ${esc(h.neu)}`});
      return; }
    if(h.field==='verification_result'){
      items.push({at:h.at, actor:h.by, actorName:agentName(h.by)||h.by, badge: h.neu==='Verified'?'Verified':'Verification Rejected',
        html: h.neu==='Verified' ? `Ticket verified` : `<b>Rejected:</b> ${esc(h.reason)}${h.note?`<div class="c-body" style="margin-top:6px">${esc(h.note)}</div>`:''}`});
      return; }
    const label = h.field==='assigned_to'?'Assigned':h.field==='group_assigned_to'?'Group':titleCase(h.field);
    items.push({at:h.at, actor:h.by, actorName:agentName(h.by)||h.by, badge:'', html:`<b>${esc(label)}:</b> ${pill(h.old)} → ${pill(h.neu)}`}); });
  items.push({at:t.created_at, actor:t.created_by, actorName:t.created_by, badge:'', html:`${t.created_by==='Auto Created'?'Ticket Auto-created':'Ticket created'}${t.assigned_name?`<div style="margin-top:6px"><b>Assigned:</b> ${pill('N/A')} → ${pill(t.assigned_name)}</div>`:''}`});
  return items.sort((a,b)=>b.at-a.at);
}
function pj2(t){return PROJECTS.find(p=>p.project_id===t.project_id)||PROJECTS[0];}
function commentHTML(c){return `<div class="comment"><div class="avatar">${initials(c.author)}<span class="status-dot ${getAgentStatusDotClass(c.email)}"></span></div>
  <div style="flex:1"><div class="c-head"><span class="c-author">${esc(c.author)}</span><span class="c-internal">${c.internal?'Internal':'Public'}</span><span class="c-time">${fmtDateAbs(c.at)}</span></div>
  <div class="c-body">${renderMentions(c.text)}</div>
  ${(c.tags&&c.tags.length)?`<div class="c-tags">${c.tags.map(tg=>`<span class="mini-tag">${esc(tg)}</span>`).join('')}</div>`:''}</div></div>`;}

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
    closeModal(); paintListKeepScroll(); const emoji=isResolve?'✅':'🔒'; toast(`${emoji} Ticket ${isResolve?'Resolved':'Closed'}`, `${reason} · ${category}`);
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
    t.communication_audit.push({channel,direction:'OUT',at:new Date(),party:t.customer_info?.email||t.customer_info?.phone||'customer',subject:channel==='EMAIL'?$('#rSubject').value:'',body,by:CURRENT_USER.email});
    LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'COMMUNICATION_SENT',actor:CURRENT_USER.name,detail:`${titleCase(channel)} sent to ${t.customer_info?.email||'customer'}`});
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
      <div class="sl-filters"><select class="select" id="sStatus"><option value="">All Statuses</option>${ENUM.status.map(s=>`<option value="${s}">${statusLabel(s)}</option>`).join('')}</select>
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
    <div class="slc-top"><span class="slc-num">${t.ticket_number}</span><span class="b-pill" style="background:${stColor(t.ticket_status)}">${statusLabel(t.ticket_status==='AUTO_ESCALATED'?'OPEN':t.ticket_status)}</span></div>
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
    t.communication_audit=t.communication_audit||[];t.communication_audit.push({channel:ch,direction:'OUT',at:new Date(),party:c.email||c.phone||'customer',body:v,by:CURRENT_USER.email});
    LOGS.unshift({at:new Date(),ticket:t.ticket_number,event:'COMMUNICATION_SENT',actor:CURRENT_USER.name,detail:`${titleCase(ch)} sent`});paintConv();toast('Message sent','via '+supportChannel);};
  $('#convSend').onclick=send; $('#sendVia').onclick=send;
  $('#convInput').onkeydown=e=>{if(e.key==='Enter')send();};
}

/* ============================================================ PROJECTS
   Rich Projects settings screen, cloned pixel-for-pixel from the live Karnival
   dashboard's Support Ticket > Settings > Projects screen and merged in here as
   the "Projects" ticketing sub-tab (router map at the top of this file already
   points data-route="projects" at renderProjects()). Renders inside the shared
   sheet body (mount()), exactly like every other ticketing view.
   VERIF_FEATURE hooks into pjRenderForm via verifProjectSectionHTML/
   verifWireProjectSection, keyed by project_id — unchanged, to be redesigned
   in a follow-up pass once this merge is confirmed working. ============================================================ */
const pjState = {
  editingId:null,          // project_id being edited, or null for a new project
  draft:null,
  isDirty:false,
  pendingNav:null,
  openDropdown:null,       // key of currently open dropdown
  openLogicCollapsed:{},   // logicId -> bool
  openInfoTip:false,
  openCollabPopover:null,  // project_id whose collaborators popover is open
  collapse:{comms:false, escalation:false, notifications:false},
};
const PJ_ICONS = {
  people: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19"/><circle cx="9" cy="7" r="3"/><path d="M20 19v-1.2a3 3 0 0 0-2.2-2.9"/><path d="M14.5 4.2a3 3 0 0 1 0 5.6"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3V9Z"/><path d="M14 7v10" stroke-dasharray="2 2.4"/></svg>',
  edit: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6"/><path d="M19 6l-.8 13.2A2 2 0 0 1 16.2 21H7.8a2 2 0 0 1-2-1.8L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  chevronUp: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>',
  chevronLeft: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
};
const PJ_PRIORITIES = [{v:'High',ico:'⬆'},{v:'Medium',ico:'≡'},{v:'Low',ico:'⬇'}];
function pjAgentChip(email){
  return `<span style="display:inline-flex;align-items:center;gap:6px"><span class="avatar" style="width:22px;height:22px;font-size:10px;font-weight:700">${initials(agentName(email))}<span class="status-dot ${getAgentStatusDotClass(email)}"></span></span>${esc(agentName(email))}</span>`;
}
function makeProjectCode(name){ return ((name||'').match(/\b[a-zA-Z]/g)||['P','R','O','J']).slice(0,4).join('').toUpperCase(); }
function pjRenderFormKeepScroll(){ const sb=$('#sheetBody'); const sc=sb?sb.scrollTop:0; pjRenderForm(); if(sb) sb.scrollTop=sc; }

/* ---------- router entry point + navigation ---------- */
function renderProjects(){ pjGoList(); }
function pjGoList(){
  appUnsavedGuard=null; pjState.editingId=null; pjState.draft=null; pjState.isDirty=false;
  pjState.openDropdown=null; pjState.openInfoTip=false; // clear form-only UI state so the click-away listener can't crash pjRenderForm() with a null draft
  pjRenderList();
}
function pjGoCreate(){
  pjState.editingId=null; pjState.draft=emptyProjectDraft(); pjState.isDirty=false;
  appUnsavedGuard = next=>pjAttemptNav(next);
  pjRenderForm();
}
function pjGoEdit(id){
  pjState.editingId=id; pjState.draft=JSON.parse(JSON.stringify(PROJECTS.find(p=>p.project_id===id))); pjState.isDirty=false;
  appUnsavedGuard = next=>pjAttemptNav(next);
  pjRenderForm();
}
function pjMarkDirty(){ pjState.isDirty=true; }
function pjAttemptNav(fn){
  if(pjState.isDirty){
    pjState.pendingNav = fn;
    openModal(`<div class="modal-head"><div class="mh-ico" style="background:#dc2626">⚠️</div><h2>Unsaved changes!</h2><button class="modal-close" data-close>×</button></div>
      <div class="modal-body"><p style="margin:0;color:var(--ink-2)">You have unsaved changes. Do you really want to leave this page?</p></div>
      <div class="modal-foot"><div class="spacer"></div><button class="btn btn-light" data-close>Cancel</button><button class="btn btn-primary" id="pjLeaveBtn" style="background:#dc2626">Leave</button></div>`, 440);
    $$('[data-close]').forEach(b=>b.onclick=closeModal);
    $('#pjLeaveBtn').onclick=()=>{
      closeModal(); pjState.isDirty=false; appUnsavedGuard=null;
      const next=pjState.pendingNav; pjState.pendingNav=null; if(next) next();
    };
  } else fn();
}

/* ---------- LIST ---------- */
function pjToggleCollabPopover(id){
  pjState.openCollabPopover = pjState.openCollabPopover===id ? null : id;
  const sb=$('#sheetBody'); const sc=sb?sb.scrollTop:0; pjRenderList(); if(sb) sb.scrollTop=sc;
}
function pjRenderList(){
  const rows = PROJECTS.map(p=>`
    <tr>
      <td>${esc(p.name)}</td>
      <td>${esc(p.code)}</td>
      <td>${p.defaultAssignee?esc(agentName(p.defaultAssignee)):''}</td>
      <td style="position:relative">
        <button class="pj-icon-btn" title="${p.collaborators.length} collaborator(s)" data-collab="${p.project_id}">${PJ_ICONS.people}</button>
        ${pjState.openCollabPopover===p.project_id?`
        <div class="pj-collab-popover">
          <div class="pj-collab-head">${p.collaborators.length} Collaborator${p.collaborators.length===1?'':'s'}</div>
          ${p.collaborators.length?p.collaborators.map(e=>`<div class="pj-collab-item">${pjAgentChip(e)}</div>`).join(''):'<div class="pj-collab-item hint">No collaborators</div>'}
        </div>`:''}
      </td>
      <td>${p.createdBy?esc(agentName(p.createdBy)):''}</td>
      <td><div class="row" style="gap:4px">
        <button class="pj-icon-plain" title="View tickets for this project" data-tickets="${p.project_id}">${PJ_ICONS.ticket}</button>
        <button class="pj-icon-plain" title="Edit project" data-edit="${p.project_id}">${PJ_ICONS.edit}</button>
      </div></td>
    </tr>`).join('');
  mount().innerHTML = `
    <div class="page-head"><div><div class="page-title">Projects</div><div class="page-sub">Configure escalation levels, auto-ticket logic, communication & notification rules per project</div></div>
      <button class="btn btn-primary" id="pjNewBtn">＋ Create Project</button></div>
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Project Name</th><th>Code</th><th>Default Assignee</th><th>Collaborators</th><th>Created By</th><th>Action</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${!PROJECTS.length?'<div class="hint" style="text-align:center;padding:40px 0">No projects found. Click "Create Project" to add your first one.</div>':''}
  `;
  $('#pjNewBtn').onclick=()=>pjGoCreate();
  $$('[data-collab]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); pjToggleCollabPopover(b.dataset.collab); });
  $$('[data-tickets]').forEach(b=>b.onclick=()=>{ state.filters.project=b.dataset.tickets; go('tickets'); });
  $$('[data-edit]').forEach(b=>b.onclick=()=>pjGoEdit(b.dataset.edit));
}

/* ---------- shared dropdowns ---------- */
function pjToggleDropdown(key){ pjState.openDropdown=(pjState.openDropdown===key?null:key); pjRenderFormKeepScroll(); }
function pjCloseDropdowns(){ if(pjState.openDropdown){ pjState.openDropdown=null; pjRenderFormKeepScroll(); } }

function pjSingleUserDropdown(key, placeholder, selectedEmail, onPick){
  const wrap=document.createElement('div'); wrap.className='pj-dd';
  const btn=document.createElement('button'); btn.type='button'; btn.className='pj-dd-btn';
  btn.innerHTML = selectedEmail
    ? `<span>${esc(agentName(selectedEmail))}</span><span class="pj-dd-clear" data-clear>×</span>`
    : `<span class="pj-ph">${esc(placeholder)}</span><span class="pj-dd-chevron">${PJ_ICONS.chevronDown}</span>`;
  btn.onclick=(e)=>{ if(e.target.closest('[data-clear]')){ e.stopPropagation(); onPick(''); return; } e.stopPropagation(); pjToggleDropdown(key); };
  wrap.appendChild(btn);
  if(pjState.openDropdown===key){
    const panel=document.createElement('div'); panel.className='pj-dd-panel'; panel.onclick=e=>e.stopPropagation();
    const search=document.createElement('input'); search.className='pj-dd-search'; search.placeholder='Search user...';
    panel.appendChild(search);
    const list=document.createElement('div'); list.className='pj-dd-list';
    function paint(filter){
      list.innerHTML='';
      const opts=AGENTS.filter(a=>a.name.toLowerCase().includes(filter.toLowerCase()));
      if(!opts.length){ list.innerHTML='<div class="pj-dd-empty">No results found.</div>'; return; }
      opts.forEach(a=>{
        const item=document.createElement('div'); item.className='pj-dd-item'+(selectedEmail===a.email?' checked':'');
        item.innerHTML=`${pjAgentChip(a.email)}${selectedEmail===a.email?`<span class="pj-tick">${PJ_ICONS.check}</span>`:''}`;
        item.onclick=()=>{ onPick(a.email); pjState.openDropdown=null; pjRenderForm(); };
        list.appendChild(item);
      });
    }
    paint(''); search.oninput=()=>paint(search.value);
    panel.appendChild(list); wrap.appendChild(panel);
  }
  return wrap;
}
function pjMultiUserDropdown(key, placeholder, selectedEmails, onChange){
  const wrap=document.createElement('div'); wrap.className='pj-dd';
  const btn=document.createElement('button'); btn.type='button'; btn.className='pj-dd-btn';
  const label=selectedEmails.map(agentName).join(' , ');
  btn.innerHTML = selectedEmails.length
    ? `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(label)}</span><span class="pj-dd-clear" data-clear>×</span>`
    : `<span class="pj-ph">${esc(placeholder)}</span><span class="pj-dd-chevron">${PJ_ICONS.chevronDown}</span>`;
  btn.onclick=(e)=>{ if(e.target.closest('[data-clear]')){ e.stopPropagation(); onChange([]); return; } e.stopPropagation(); pjToggleDropdown(key); };
  wrap.appendChild(btn);
  if(pjState.openDropdown===key){
    const panel=document.createElement('div'); panel.className='pj-dd-panel'; panel.onclick=e=>e.stopPropagation();
    const search=document.createElement('input'); search.className='pj-dd-search'; search.placeholder='Search user...';
    panel.appendChild(search);
    const list=document.createElement('div'); list.className='pj-dd-list';
    function paint(filter){
      list.innerHTML='';
      const opts=AGENTS.filter(a=>a.name.toLowerCase().includes(filter.toLowerCase()));
      if(!opts.length){ list.innerHTML='<div class="pj-dd-empty">No results found.</div>'; return; }
      opts.forEach(a=>{
        const checked=selectedEmails.includes(a.email);
        const item=document.createElement('div'); item.className='pj-dd-item'+(checked?' checked':'');
        item.innerHTML=`${pjAgentChip(a.email)}${checked?`<span class="pj-tick">${PJ_ICONS.check}</span>`:''}`;
        item.onclick=()=>{ onChange(checked?selectedEmails.filter(x=>x!==a.email):selectedEmails.concat([a.email])); };
        list.appendChild(item);
      });
    }
    paint(''); search.oninput=()=>paint(search.value);
    panel.appendChild(list); wrap.appendChild(panel);
  }
  return wrap;
}
function pjMultiGroupDropdown(key, placeholder, selectedGroups, onChange){
  const wrap=document.createElement('div'); wrap.className='pj-dd';
  const btn=document.createElement('button'); btn.type='button'; btn.className='pj-dd-btn';
  btn.innerHTML = selectedGroups.length
    ? `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(selectedGroups.join(' , '))}</span><span class="pj-dd-clear" data-clear>×</span>`
    : `<span class="pj-ph">${esc(placeholder)}</span><span class="pj-dd-chevron">${PJ_ICONS.chevronDown}</span>`;
  btn.onclick=(e)=>{ if(e.target.closest('[data-clear]')){ e.stopPropagation(); onChange([]); return; } e.stopPropagation(); pjToggleDropdown(key); };
  wrap.appendChild(btn);
  if(pjState.openDropdown===key){
    const panel=document.createElement('div'); panel.className='pj-dd-panel'; panel.onclick=e=>e.stopPropagation();
    const list=document.createElement('div'); list.className='pj-dd-list';
    GROUPS.forEach(g=>{
      const checked=selectedGroups.includes(g);
      const item=document.createElement('div'); item.className='pj-dd-item'+(checked?' checked':'');
      item.innerHTML=`<span>${esc(g)}</span>${checked?`<span class="pj-tick">${PJ_ICONS.check}</span>`:''}`;
      item.onclick=()=>{ onChange(checked?selectedGroups.filter(x=>x!==g):selectedGroups.concat([g])); };
      list.appendChild(item);
    });
    panel.appendChild(list); wrap.appendChild(panel);
  }
  return wrap;
}
function pjPlainSelectDropdown(key, options, selectedVal, onPick, renderLabel){
  const wrap=document.createElement('div'); wrap.className='pj-dd';
  const btn=document.createElement('button'); btn.type='button'; btn.className='pj-dd-btn';
  btn.innerHTML=`<span>${renderLabel?renderLabel(selectedVal):esc(selectedVal)}</span><span class="pj-dd-chevron">${PJ_ICONS.chevronDown}</span>`;
  btn.onclick=(e)=>{ e.stopPropagation(); pjToggleDropdown(key); };
  wrap.appendChild(btn);
  if(pjState.openDropdown===key){
    const panel=document.createElement('div'); panel.className='pj-dd-panel'; panel.onclick=e=>e.stopPropagation();
    const list=document.createElement('div'); list.className='pj-dd-list';
    options.forEach(o=>{
      const checked=o===selectedVal;
      const item=document.createElement('div'); item.className='pj-dd-item'+(checked?' checked':'');
      item.innerHTML=`<span>${renderLabel?renderLabel(o):esc(o)}</span>${checked?`<span class="pj-tick">${PJ_ICONS.check}</span>`:''}`;
      item.onclick=()=>{ onPick(o); pjState.openDropdown=null; pjRenderForm(); };
      list.appendChild(item);
    });
    panel.appendChild(list); wrap.appendChild(panel);
  }
  return wrap;
}
function pjSearchableDropdown(key, placeholder, options, selectedVal, onPick, groupedLabel){
  const wrap=document.createElement('div'); wrap.className='pj-dd';
  const btn=document.createElement('button'); btn.type='button'; btn.className='pj-dd-btn';
  const opt=options.find(o=>o.value===selectedVal);
  btn.innerHTML = opt
    ? `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(opt.label)}</span><span class="pj-dd-chevron">${PJ_ICONS.chevronDown}</span>`
    : `<span class="pj-ph">${esc(placeholder)}</span><span class="pj-dd-chevron">${PJ_ICONS.chevronDown}</span>`;
  btn.onclick=(e)=>{ e.stopPropagation(); pjToggleDropdown(key); };
  wrap.appendChild(btn);
  if(pjState.openDropdown===key){
    const panel=document.createElement('div'); panel.className='pj-dd-panel'; panel.onclick=e=>e.stopPropagation();
    const search=document.createElement('input'); search.className='pj-dd-search'; search.placeholder='Search';
    panel.appendChild(search);
    const list=document.createElement('div'); list.className='pj-dd-list';
    function paint(filter){
      list.innerHTML='';
      const opts=options.filter(o=>o.label.toLowerCase().includes(filter.toLowerCase()));
      if(!opts.length){ list.innerHTML='<div class="pj-dd-empty">No results found.</div>'; return; }
      let lastGroup=null;
      opts.forEach(o=>{
        if(groupedLabel && o.group!==lastGroup){
          lastGroup=o.group;
          const gh=document.createElement('div'); gh.style.cssText='font-size:11px;font-weight:700;color:var(--muted);padding:8px 10px 2px;'; gh.textContent=o.group;
          list.appendChild(gh);
        }
        const checked=o.value===selectedVal;
        const item=document.createElement('div'); item.className='pj-dd-item'+(checked?' checked':'');
        item.innerHTML=`<span>${esc(o.label)}</span>${checked?`<span class="pj-tick">${PJ_ICONS.check}</span>`:''}`;
        item.onclick=()=>{ onPick(o.value); pjState.openDropdown=null; pjRenderForm(); };
        list.appendChild(item);
      });
    }
    paint(''); search.oninput=()=>paint(search.value);
    panel.appendChild(list); wrap.appendChild(panel);
  }
  return wrap;
}
function pjMultiOptionsDropdown(key, placeholder, options, selected, onChange){
  const wrap=document.createElement('div'); wrap.className='pj-dd';
  const btn=document.createElement('button'); btn.type='button'; btn.className='pj-dd-btn';
  btn.innerHTML = selected.length
    ? `<span>${esc(selected.join(', '))}</span><span class="pj-dd-chevron">${PJ_ICONS.chevronDown}</span>`
    : `<span class="pj-ph">${esc(placeholder)}</span><span class="pj-dd-chevron">${PJ_ICONS.chevronDown}</span>`;
  btn.onclick=(e)=>{ e.stopPropagation(); pjToggleDropdown(key); };
  wrap.appendChild(btn);
  if(pjState.openDropdown===key){
    const panel=document.createElement('div'); panel.className='pj-dd-panel'; panel.onclick=e=>e.stopPropagation();
    const list=document.createElement('div'); list.className='pj-dd-list';
    options.forEach(o=>{
      const checked=selected.includes(o);
      const item=document.createElement('div'); item.className='pj-dd-item'+(checked?' checked':'');
      item.innerHTML=`<span>${esc(o)}</span>${checked?`<span class="pj-tick">${PJ_ICONS.check}</span>`:''}`;
      item.onclick=()=>{ onChange(checked?selected.filter(x=>x!==o):selected.concat([o])); };
      list.appendChild(item);
    });
    panel.appendChild(list); wrap.appendChild(panel);
  }
  return wrap;
}

/* ---------- escalation levels (reused by the project itself and by each Logic block) ---------- */
function pjRenderEscalationLevels(levels, keyPrefix){
  const box=document.createElement('div');
  const lbl=document.createElement('div'); lbl.className='lbl'; lbl.style.marginTop='18px'; lbl.textContent='Escalation Levels';
  box.appendChild(lbl);
  if(levels.length){
    const table=document.createElement('table'); table.className='pj-esc-table';
    table.innerHTML=`<thead><tr><th></th><th>Escalate After</th><th>Time Unit</th><th>Escalate To</th><th>Group Escalate To</th><th>Targeted Escalation</th><th></th></tr></thead>`;
    const tbody=document.createElement('tbody');
    levels.forEach((lvl,i)=>{
      const tr=document.createElement('tr');
      const tdLabel=document.createElement('td'); tdLabel.className='pj-esc-lvl-label'; tdLabel.textContent=lvl.level;
      const tdAfter=document.createElement('td');
      const inp=document.createElement('input'); inp.type='number'; inp.className='field pj-num'; inp.value=lvl.after; inp.min=0;
      inp.oninput=()=>{ lvl.after=+inp.value; pjMarkDirty(); };
      tdAfter.appendChild(inp);
      const tdUnit=document.createElement('td');
      tdUnit.appendChild(pjPlainSelectDropdown(keyPrefix+'unit'+i, TIME_UNITS, lvl.unit, v=>{ lvl.unit=v; pjMarkDirty(); }));
      const tdTo=document.createElement('td');
      tdTo.appendChild(pjMultiUserDropdown(keyPrefix+'to'+i, 'Select User', lvl.escalateTo, v=>{ lvl.escalateTo=v; pjMarkDirty(); pjRenderForm(); }));
      const tdGroup=document.createElement('td');
      tdGroup.appendChild(pjMultiGroupDropdown(keyPrefix+'grp'+i, 'Select Group', lvl.groupEscalateTo, v=>{ lvl.groupEscalateTo=v; pjMarkDirty(); pjRenderForm(); }));
      const tdTarget=document.createElement('td');
      const cb=document.createElement('div'); cb.className='pj-chk'+(lvl.targeted?' on':''); cb.innerHTML=lvl.targeted?PJ_ICONS.check:'';
      cb.onclick=()=>{ lvl.targeted=!lvl.targeted; pjMarkDirty(); pjRenderForm(); };
      tdTarget.appendChild(cb);
      const tdDel=document.createElement('td');
      const del=document.createElement('button'); del.className='pj-trash'; del.innerHTML=PJ_ICONS.trash; del.title='Remove level';
      del.onclick=()=>{ levels.splice(i,1); levels.forEach((l,idx)=>l.level='Project Level '+(idx+1)); pjMarkDirty(); pjRenderForm(); };
      tdDel.appendChild(del);
      tr.append(tdLabel,tdAfter,tdUnit,tdTo,tdGroup,tdTarget,tdDel);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody); box.appendChild(table);
  }
  const addRow=document.createElement('div'); addRow.style.cssText='display:flex;align-items:center;gap:10px;margin-top:14px;position:relative';
  const addBtn=document.createElement('button'); addBtn.className='btn btn-primary btn-sm'; addBtn.textContent='+ Add Escalation Level';
  addBtn.onclick=()=>{ levels.push(emptyEscLevel(levels.length+1)); pjMarkDirty(); pjRenderForm(); };
  const info=document.createElement('span'); info.className='pj-info-ico'; info.textContent='i';
  info.onclick=(e)=>{ e.stopPropagation(); pjState.openInfoTip = pjState.openInfoTip===keyPrefix ? false : keyPrefix; pjRenderForm(); };
  addRow.append(addBtn, info);
  if(pjState.openInfoTip===keyPrefix){
    const tip=document.createElement('div'); tip.className='pj-info-tip';
    tip.textContent='Specify how long to wait before notifying an additional user or team if this ticket remains unresolved.';
    addRow.appendChild(tip);
  }
  box.appendChild(addRow);
  return box;
}

/* ---------- Logic blocks (auto-ticket-creation rules, with OR-condition groups) ---------- */
function pjRenderConditionRow(cond, survey, onRemove){
  const wrap=document.createElement('div'); wrap.className='pj-cond-row';
  const grid=document.createElement('div'); grid.className='pj-cond-grid';
  const qOptions = survey ? survey.questions.map(q=>({value:q.id, label:q.text, group:q.page})) : [];
  const qCol=document.createElement('div'); qCol.innerHTML='<label class="lbl" style="font-size:12.5px">Question</label>';
  qCol.appendChild(pjSearchableDropdown('cond-q-'+cond._key, 'Select Question', qOptions, cond.question, v=>{ cond.question=v; cond.selType=''; cond.options=[]; pjMarkDirty(); }, true));
  const tCol=document.createElement('div'); tCol.innerHTML='<label class="lbl" style="font-size:12.5px">Selection Type</label>';
  tCol.appendChild(pjSearchableDropdown('cond-t-'+cond._key, 'Select Type', SELECTION_TYPES.map(t=>({value:t,label:t})), cond.selType, v=>{ cond.selType=v; cond.options=[]; pjMarkDirty(); }));
  grid.append(qCol, tCol);
  if(cond.selType==='SELECTED' || cond.selType==='UNSELECTED'){
    const q = survey ? survey.questions.find(x=>x.id===cond.question) : null;
    const oCol=document.createElement('div'); oCol.innerHTML='<label class="lbl" style="font-size:12.5px">Options</label>';
    oCol.appendChild(pjMultiOptionsDropdown('cond-o-'+cond._key, 'Select Options', q?q.options:[], cond.options, v=>{ cond.options=v; pjMarkDirty(); pjRenderForm(); }));
    grid.appendChild(oCol);
  } else grid.appendChild(document.createElement('div'));
  const delCol=document.createElement('div');
  const del=document.createElement('button'); del.className='pj-trash'; del.innerHTML=PJ_ICONS.trash; del.style.marginTop='22px';
  del.onclick=onRemove;
  delCol.appendChild(del); grid.appendChild(delCol);
  wrap.appendChild(grid);
  return wrap;
}
function pjRenderLogicBlock(logic, index, onRemove){
  logic.conditionGroups.forEach(g=>g.conditions.forEach((c,i)=>{ if(!c._key) c._key=g.id+'_'+i; }));
  const survey = SURVEYS.find(s=>s.id===logic.surveyId);
  const collapsed = !!pjState.openLogicCollapsed[logic.id];
  const block=document.createElement('div'); block.className='pj-logic-block';
  const head=document.createElement('div'); head.className='pj-logic-head';
  const chev=document.createElement('span'); chev.innerHTML=collapsed?PJ_ICONS.chevronDown:PJ_ICONS.chevronUp; chev.className='pj-dd-chevron'; chev.style.cssText='cursor:pointer;margin-left:auto';
  const title=document.createElement('span'); title.textContent='Logic #'+(index+1); title.style.cursor='pointer';
  const del=document.createElement('button'); del.className='pj-trash'; del.innerHTML=PJ_ICONS.trash; del.onclick=(e)=>{ e.stopPropagation(); onRemove(); };
  const toggle=()=>{ pjState.openLogicCollapsed[logic.id]=!collapsed; pjRenderForm(); };
  title.onclick=toggle; chev.onclick=toggle;
  head.append(title, del, chev);
  block.appendChild(head);
  if(!collapsed){
    const body=document.createElement('div');
    const row1=document.createElement('div'); row1.className='pj-grid2';
    const c1=document.createElement('div'); c1.innerHTML='<label class="lbl">Select Entity Type</label>';
    c1.appendChild(pjPlainSelectDropdown('logic-entity-'+logic.id, ['Survey'], logic.entityType, v=>{ logic.entityType=v; pjMarkDirty(); }));
    const c2=document.createElement('div'); c2.innerHTML='<label class="lbl">Select Survey</label>';
    c2.appendChild(pjSearchableDropdown('logic-survey-'+logic.id, 'Select Survey', SURVEYS.map(s=>({value:s.id,label:s.name})), logic.surveyId, v=>{ logic.surveyId=v; logic.conditionGroups=[]; pjMarkDirty(); }));
    row1.append(c1,c2); body.appendChild(row1);

    const row2=document.createElement('div'); row2.className='pj-grid2';
    const c3=document.createElement('div'); c3.innerHTML='<label class="lbl">Priority</label>';
    c3.appendChild(pjPlainSelectDropdown('logic-prio-'+logic.id, PJ_PRIORITIES.map(x=>x.v), logic.priority, v=>{ logic.priority=v; pjMarkDirty(); }, v=>{ const pr=PJ_PRIORITIES.find(x=>x.v===v); return `${pr.ico} ${v}`; }));
    const c4=document.createElement('div'); c4.innerHTML='<label class="lbl">Assign to</label>';
    c4.appendChild(pjSingleUserDropdown('logic-assign-'+logic.id, 'Select Assignee', logic.assignTo, v=>{ logic.assignTo=v; pjMarkDirty(); pjRenderForm(); }));
    row2.append(c3,c4); body.appendChild(row2);

    const togRow=document.createElement('div'); togRow.className='pj-toggle-row'; togRow.style.marginBottom='20px';
    togRow.innerHTML=`<span class="lbl" style="margin:0">Targeted Assignment for Collaborators</span>`;
    const sw=document.createElement('div'); sw.className='pj-switch'+(logic.targetedAssignment?' on':''); sw.innerHTML='<div class="pj-knob"></div>';
    sw.onclick=()=>{ logic.targetedAssignment=!logic.targetedAssignment; pjMarkDirty(); pjRenderForm(); };
    togRow.appendChild(sw); body.appendChild(togRow);

    const row3=document.createElement('div'); row3.className='pj-grid2';
    const c5=document.createElement('div'); c5.innerHTML='<label class="lbl">Collaborators</label>';
    c5.appendChild(pjMultiUserDropdown('logic-collab-'+logic.id, 'Select Collaborators', logic.collaborators, v=>{ logic.collaborators=v; pjMarkDirty(); pjRenderForm(); }));
    const c6=document.createElement('div'); c6.innerHTML='<label class="lbl">Group Collaborators</label>';
    c6.appendChild(pjMultiGroupDropdown('logic-gcollab-'+logic.id, 'Select Group Collaborators', logic.groupCollaborators, v=>{ logic.groupCollaborators=v; pjMarkDirty(); pjRenderForm(); }));
    row3.append(c5,c6); body.appendChild(row3);

    body.appendChild(pjRenderEscalationLevels(logic.escalationLevels, 'logic-'+logic.id+'-'));

    const condWrap=document.createElement('div'); condWrap.style.marginTop='18px';
    if(!logic.conditionGroups.length){
      const addBtn=document.createElement('button'); addBtn.className='btn btn-light btn-sm'; addBtn.textContent='+ Add Condition';
      addBtn.onclick=()=>{ logic.conditionGroups.push(emptyCondGroup()); pjMarkDirty(); pjRenderForm(); };
      condWrap.appendChild(addBtn);
    } else {
      logic.conditionGroups.forEach((grp,gi)=>{
        if(gi>0){ const orLbl=document.createElement('div'); orLbl.className='pj-cond-and'; orLbl.textContent='OR'; condWrap.appendChild(orLbl); }
        const groupBox=document.createElement('div'); groupBox.className='pj-cond-group';
        const groupDel=document.createElement('button'); groupDel.className='pj-trash pj-cond-group-del'; groupDel.innerHTML=PJ_ICONS.trash; groupDel.title='Remove group';
        groupDel.onclick=()=>{ logic.conditionGroups.splice(gi,1); pjMarkDirty(); pjRenderForm(); };
        groupBox.appendChild(groupDel);
        grp.conditions.forEach((cond,i)=>{
          if(i>0){ const and=document.createElement('div'); and.className='pj-cond-and'; and.textContent='AND'; groupBox.appendChild(and); }
          groupBox.appendChild(pjRenderConditionRow(cond, survey, ()=>{
            grp.conditions.splice(i,1);
            if(!grp.conditions.length) logic.conditionGroups.splice(gi,1);
            pjMarkDirty(); pjRenderForm();
          }));
        });
        const andBtn=document.createElement('button'); andBtn.className='btn btn-light btn-sm'; andBtn.style.marginTop='10px'; andBtn.textContent='+ AND Condition';
        andBtn.onclick=()=>{ grp.conditions.push({question:'',selType:'',options:[]}); pjMarkDirty(); pjRenderForm(); };
        groupBox.appendChild(andBtn);
        condWrap.appendChild(groupBox);
      });
      const orBtn=document.createElement('button'); orBtn.className='btn btn-light btn-sm'; orBtn.style.marginTop='14px'; orBtn.textContent='+ OR Group';
      orBtn.onclick=()=>{ logic.conditionGroups.push(emptyCondGroup()); pjMarkDirty(); pjRenderForm(); };
      condWrap.appendChild(orBtn);
    }
    body.appendChild(condWrap);
    block.appendChild(body);
  }
  return block;
}

/* ---------- collapsible sections + Communication Setup ---------- */
function pjCollapsibleCard(key, title, desc, bodyFn){
  const card=document.createElement('div'); card.className='pj-collapse-card';
  const head=document.createElement('div'); head.className='pj-collapse-head';
  head.innerHTML=`<span>${esc(title)}</span><span class="pj-dd-chevron">${pjState.collapse[key]?PJ_ICONS.chevronUp:PJ_ICONS.chevronDown}</span>`;
  head.onclick=()=>{ pjState.collapse[key]=!pjState.collapse[key]; pjRenderForm(); };
  card.appendChild(head);
  if(pjState.collapse[key]){
    const body=document.createElement('div'); body.className='pj-collapse-body';
    body.appendChild(bodyFn());
    card.appendChild(body);
  }
  const descEl=document.createElement('div'); descEl.className='pj-collapse-desc'; descEl.textContent=desc;
  card.appendChild(descEl);
  return card;
}
function pjRenderCommsBody(comms){
  const wrap=document.createElement('div');
  const tabs=document.createElement('div'); tabs.className='pj-chan-tabs';
  [{k:'Email',ico:'✉',enabled:true},{k:'Instagram',ico:'◎',enabled:false},{k:'Whatsapp',ico:'💬',enabled:false},{k:'SMS',ico:'▤',enabled:false}].forEach(c=>{
    const b=document.createElement('button'); b.type='button'; b.className='pj-chan-tab'+(comms.activeChannel===c.k?' active':'');
    b.innerHTML=`<span>${c.ico}</span><span>${c.k}</span>`;
    if(!c.enabled) b.disabled=true; else b.onclick=()=>{ comms.activeChannel=c.k; pjMarkDirty(); pjRenderForm(); };
    tabs.appendChild(b);
  });
  wrap.appendChild(tabs);
  if(comms.activeChannel==='Email'){
    const e=comms.email;
    const head=document.createElement('div'); head.style.cssText='display:flex;align-items:center;gap:10px;margin-bottom:18px';
    head.innerHTML=`<div style="width:36px;height:36px;border-radius:8px;background:var(--field);display:flex;align-items:center;justify-content:center">✉</div>
      <div><div style="font-weight:600;font-size:14px">Email Configuration</div><div class="page-sub" style="margin:0">Configure email settings to send and receive messages.</div></div>`;
    wrap.appendChild(head);
    const mkField=(labelText,val,onInput,placeholder,type='text')=>{
      const d=document.createElement('div'); d.innerHTML=`<label class="lbl">${labelText}</label>`;
      const inp=document.createElement('input'); inp.type=type; inp.className='field'; inp.value=val; inp.placeholder=placeholder||'';
      inp.oninput=()=>{ onInput(inp.value); pjMarkDirty(); };
      d.appendChild(inp); return d;
    };
    const sectionLbl=(text)=>{ const l=document.createElement('div'); l.className='lbl'; l.style.cssText='font-weight:700;margin-top:18px'; l.textContent=text; return l; };
    wrap.appendChild(sectionLbl('Connection Settings'));
    const row1=document.createElement('div'); row1.className='pj-grid2';
    row1.append(mkField('Hostname', e.hostname, v=>e.hostname=v, 'Enter Hostname'), mkField('Port', e.port, v=>e.port=v, '587'));
    wrap.appendChild(row1);
    wrap.appendChild(sectionLbl('Authentication'));
    wrap.appendChild(mkField('Username', e.username, v=>e.username=v, 'Enter Username'));
    wrap.appendChild(mkField('Password / App Token', e.password, v=>e.password=v, 'Enter Password or App Token', 'password'));
    wrap.appendChild(sectionLbl('Sender Settings'));
    wrap.appendChild(mkField('Sender Email', e.senderEmail, v=>e.senderEmail=v, 'Enter email'));
    wrap.appendChild(sectionLbl('Security Options'));
    [['SMTP Authentication','smtpAuth'],['SMTP TLS Enabled','smtpTLS']].forEach(([label,key])=>{
      const tr=document.createElement('div'); tr.className='pj-toggle-row'; tr.style.marginTop='10px';
      tr.innerHTML=`<span class="lbl" style="margin:0">${label}</span>`;
      const sw=document.createElement('div'); sw.className='pj-switch'+(e[key]?' on':''); sw.innerHTML='<div class="pj-knob"></div>';
      sw.onclick=()=>{ e[key]=!e[key]; pjMarkDirty(); pjRenderForm(); };
      tr.appendChild(sw); wrap.appendChild(tr);
    });
    const propHead=document.createElement('div'); propHead.style.cssText='display:flex;justify-content:space-between;align-items:center;margin-top:18px';
    propHead.innerHTML=`<span class="lbl" style="margin:0;font-weight:700">Custom Properties</span>`;
    const addPropBtn=document.createElement('button'); addPropBtn.className='btn btn-primary btn-sm'; addPropBtn.textContent='+ Add Property';
    addPropBtn.onclick=()=>{ e.customProps.push({name:'',value:''}); pjMarkDirty(); pjRenderForm(); };
    propHead.appendChild(addPropBtn); wrap.appendChild(propHead);
    e.customProps.forEach((prop,i)=>{
      const row=document.createElement('div'); row.className='pj-prop-row'; row.style.marginTop='10px';
      const nameInp=document.createElement('input'); nameInp.className='field'; nameInp.placeholder='Property name'; nameInp.value=prop.name;
      nameInp.oninput=()=>{ prop.name=nameInp.value; pjMarkDirty(); };
      const valInp=document.createElement('input'); valInp.className='field'; valInp.placeholder='Property value'; valInp.value=prop.value;
      valInp.oninput=()=>{ prop.value=valInp.value; pjMarkDirty(); };
      const del=document.createElement('button'); del.className='pj-trash'; del.innerHTML=PJ_ICONS.trash;
      del.onclick=()=>{ e.customProps.splice(i,1); pjMarkDirty(); pjRenderForm(); };
      row.append(nameInp, valInp, del);
      wrap.appendChild(row);
    });
  } else {
    const disabledMsg=document.createElement('div'); disabledMsg.className='hint'; disabledMsg.style.padding='10px 0';
    disabledMsg.textContent=comms.activeChannel+' is not configured for this account.';
    wrap.appendChild(disabledMsg);
  }
  return wrap;
}

/* ---------- CREATE / EDIT form ---------- */
function pjRenderForm(){
  const sb=$('#sheetBody'); const scrollY=sb?sb.scrollTop:0;
  const isEdit=!!pjState.editingId;
  const p=pjState.draft;
  const container=document.createElement('div');

  const backRow=document.createElement('div'); backRow.className='pj-back-row';
  backRow.innerHTML=`<span class="pj-chev">${PJ_ICONS.chevronLeft}</span> ${isEdit?'Edit Project':'Create New Project'}`;
  backRow.onclick=()=>pjAttemptNav(()=>pjGoList());
  container.appendChild(backRow);
  container.appendChild(Object.assign(document.createElement('div'),{style:'height:20px'}));

  const nameWrap=document.createElement('div');
  nameWrap.innerHTML='<label class="lbl">Project Name <span class="req">*</span></label>';
  const fieldWrap=document.createElement('div'); fieldWrap.style.cssText='position:relative';
  const nameInput=document.createElement('input'); nameInput.type='text'; nameInput.className='field'; nameInput.placeholder='Project Name'; nameInput.maxLength=100; nameInput.value=p.name;
  nameInput.style.paddingRight='96px';
  const count=document.createElement('span'); count.className='hint'; count.style.cssText='position:absolute;right:14px;top:50%;transform:translateY(-50%);margin:0';
  count.textContent=`${p.name.length}/100 characters`;
  nameInput.oninput=()=>{ p.name=nameInput.value; count.textContent=`${p.name.length}/100 characters`; pjMarkDirty(); pjSyncSaveBtn(); };
  fieldWrap.append(nameInput, count);
  nameWrap.appendChild(fieldWrap);
  container.appendChild(nameWrap);
  container.appendChild(Object.assign(document.createElement('div'),{style:'height:20px'}));

  const rowBrand=document.createElement('div'); rowBrand.className='pj-grid2';
  const brandCol=document.createElement('div'); brandCol.innerHTML='<label class="lbl">Brand <span class="req">*</span></label>';
  brandCol.appendChild(pjPlainSelectDropdown('proj-brand', BRANDS, p.brand, v=>{ p.brand=v; pjMarkDirty(); }));
  const assigneeCol=document.createElement('div'); assigneeCol.innerHTML='<label class="lbl">Default Assigned To</label>';
  assigneeCol.appendChild(pjSingleUserDropdown('proj-assignee', 'Select Assignee', p.defaultAssignee, v=>{ p.defaultAssignee=v; pjMarkDirty(); pjRenderForm(); }));
  rowBrand.append(brandCol, assigneeCol);
  container.appendChild(rowBrand);

  const togRow=document.createElement('div'); togRow.className='pj-toggle-row';
  togRow.innerHTML=`<span class="lbl" style="margin:0">Targeted Assignment for Collaborators</span>`;
  const sw=document.createElement('div'); sw.className='pj-switch'+(p.targetedAssignment?' on':''); sw.innerHTML='<div class="pj-knob"></div>';
  sw.onclick=()=>{ p.targetedAssignment=!p.targetedAssignment; pjMarkDirty(); pjRenderForm(); };
  togRow.appendChild(sw);
  container.appendChild(togRow);
  container.appendChild(Object.assign(document.createElement('div'),{style:'height:20px'}));

  const rowCollab=document.createElement('div'); rowCollab.className='pj-grid2';
  const collabCol=document.createElement('div'); collabCol.innerHTML='<label class="lbl">Collaborators</label>';
  collabCol.appendChild(pjMultiUserDropdown('proj-collab', 'Select Collaborators', p.collaborators, v=>{ p.collaborators=v; pjMarkDirty(); pjRenderForm(); }));
  const gcollabCol=document.createElement('div'); gcollabCol.innerHTML='<label class="lbl">Group Collaborators</label>';
  gcollabCol.appendChild(pjMultiGroupDropdown('proj-gcollab', 'Select Group Collaborators', p.groupCollaborators, v=>{ p.groupCollaborators=v; pjMarkDirty(); pjRenderForm(); }));
  rowCollab.append(collabCol, gcollabCol);
  container.appendChild(rowCollab);

  container.appendChild(document.createElement('hr')).className='pj-sep';
  container.appendChild(pjRenderEscalationLevels(p.escalationLevels, 'proj-'));
  container.appendChild(document.createElement('hr')).className='pj-sep';

  p.logics.forEach((logic,i)=>{ container.appendChild(pjRenderLogicBlock(logic, i, ()=>{ p.logics.splice(i,1); pjMarkDirty(); pjRenderForm(); })); });
  const addLogicBtn=document.createElement('button'); addLogicBtn.className='btn btn-primary btn-sm'; addLogicBtn.style.marginTop='16px'; addLogicBtn.textContent='+ Add Logic';
  addLogicBtn.onclick=()=>{ p.logics.push(emptyLogic()); pjMarkDirty(); pjRenderForm(); };
  container.appendChild(addLogicBtn);

  container.appendChild(pjCollapsibleCard('comms', 'Communication Setup', 'Customize how project communication is handled.', ()=>pjRenderCommsBody(p.comms)));
  container.appendChild(pjCollapsibleCard('escalation', 'Escalation Settings', 'Configure skip escalation behaviour in the project.', ()=>{
    const b=document.createElement('div');
    const tr=document.createElement('div'); tr.className='pj-toggle-row'; tr.style.cssText='background:var(--field);border:none;padding:14px';
    tr.innerHTML=`<div><div style="font-weight:600;font-size:13.5px">Skip Escalations</div><div class="page-sub" style="margin:0">Pause all project-level escalations</div></div>`;
    const sw2=document.createElement('div'); sw2.className='pj-switch'+(p.escalationSettings.skipEscalations?' on':''); sw2.innerHTML='<div class="pj-knob"></div>';
    sw2.onclick=()=>{ p.escalationSettings.skipEscalations=!p.escalationSettings.skipEscalations; pjMarkDirty(); pjRenderForm(); };
    tr.appendChild(sw2); b.appendChild(tr);
    if(p.escalationSettings.skipEscalations){
      const dayWrap=document.createElement('div'); dayWrap.style.marginTop='16px';
      const dayLbl=document.createElement('div'); dayLbl.className='lbl'; dayLbl.textContent='Select Days to Skip Escalations';
      dayWrap.appendChild(dayLbl);
      const chipBox=document.createElement('div'); chipBox.style.cssText='border:1px solid var(--line);border-radius:9px;padding:16px;display:flex;gap:10px;flex-wrap:wrap;';
      ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].forEach(d=>{
        const on=p.escalationSettings.skipDays.includes(d);
        const chip=document.createElement('button'); chip.type='button'; chip.className='pj-day-chip'+(on?' on':''); chip.textContent=d;
        chip.onclick=()=>{ p.escalationSettings.skipDays = on ? p.escalationSettings.skipDays.filter(x=>x!==d) : p.escalationSettings.skipDays.concat([d]); pjMarkDirty(); pjRenderForm(); };
        chipBox.appendChild(chip);
      });
      dayWrap.appendChild(chipBox);
      if(p.escalationSettings.skipDays.length){
        const summary=document.createElement('div'); summary.className='page-sub'; summary.style.marginTop='8px';
        summary.textContent='Escalations will be skipped on: '+p.escalationSettings.skipDays.join(', ');
        dayWrap.appendChild(summary);
      }
      b.appendChild(dayWrap);
    }
    return b;
  }));
  container.appendChild(pjCollapsibleCard('notifications', 'Email Notifications', 'Enable the events you want to receive email notifications for. You can change these settings anytime.', ()=>{
    const b=document.createElement('div');
    [
      ['ticketCreation','Ticket Creation','Receive email when a new ticket is created in this project'],
      ['ticketStatus','Ticket Status','Receive email when a ticket status is updated'],
      ['priorityChanged','Priority Changed','Receive email when ticket priority is modified'],
      ['ticketAssignee','Ticket Assignee','Receive email when a ticket is assigned to you or updated'],
      ['ticketEscalation','Ticket Escalation','Receive email when a ticket is escalated'],
      ['commentOrMentions','Comment or Mentions','Receive email when someone comments or mention someone on a ticket'],
      ['descriptionAttachments','Description and Attachments','Receive email when someone adds or update description or attachments on a ticket'],
      ['ticketCollaborators','Ticket Collaborators','Receive email when a new collaborator or group collaborators are added to a ticket'],
      ['ticketDueDate','Ticket Due Date','Receive email reminder when ticket due date is approaching'],
    ].forEach(([key,title,sub])=>{
      const row=document.createElement('div'); row.className='pj-notif-row';
      row.innerHTML=`<div><div class="pj-notif-title">${title}</div><div class="pj-notif-sub">${sub}</div></div>`;
      const sw3=document.createElement('div'); sw3.className='pj-switch'+(p.notifications[key]?' on':''); sw3.innerHTML='<div class="pj-knob"></div>';
      sw3.onclick=()=>{ p.notifications[key]=!p.notifications[key]; pjMarkDirty(); pjRenderForm(); };
      row.appendChild(sw3);
      b.appendChild(row);
    });
    return b;
  }));

  const verifHost=document.createElement('div');
  verifHost.innerHTML=verifProjectSectionHTML(p.project_id); /* VERIF_FEATURE hook */
  container.appendChild(verifHost);

  const saveRow=document.createElement('div'); saveRow.className='pj-save-row';
  const cancelBtn=document.createElement('button'); cancelBtn.className='btn btn-light'; cancelBtn.textContent='Cancel';
  cancelBtn.onclick=()=>pjAttemptNav(()=>pjGoList());
  const saveBtn=document.createElement('button'); saveBtn.className='btn btn-primary'; saveBtn.id='pjSaveBtn'; saveBtn.textContent='Save';
  saveBtn.disabled=!(p.name.trim().length>0);
  saveBtn.onclick=()=>{
    if(isEdit){ const idx=PROJECTS.findIndex(x=>x.project_id===pjState.editingId); PROJECTS[idx]=JSON.parse(JSON.stringify(p)); }
    else { p.project_id=pjUid('proj'); p.code=p.code||makeProjectCode(p.name); PROJECTS.push(JSON.parse(JSON.stringify(p))); }
    pjState.isDirty=false; appUnsavedGuard=null;
    toast(isEdit?'Project updated':'Project created', p.name);
    pjGoList();
  };
  saveRow.append(cancelBtn, saveBtn);
  container.appendChild(saveRow);

  mount().innerHTML=''; mount().appendChild(container);
  verifWireProjectSection(p.project_id); /* VERIF_FEATURE hook */
  if(sb) sb.scrollTop=scrollY;
}
function pjSyncSaveBtn(){ const b=document.getElementById('pjSaveBtn'); if(b) b.disabled=!(pjState.draft.name.trim().length>0); }

document.addEventListener('click', (e)=>{
  if(pjState.draft){
    if(pjState.openDropdown && !e.target.closest('.pj-dd')) pjCloseDropdowns();
    if(pjState.openInfoTip && !e.target.closest('.pj-info-ico') && !e.target.closest('.pj-info-tip')){ pjState.openInfoTip=false; pjRenderForm(); }
  }
  if(pjState.openCollabPopover && !e.target.closest('.pj-icon-btn') && !e.target.closest('.pj-collab-popover')){ pjState.openCollabPopover=null; pjRenderList(); }
});

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
    <td><div class="agent-cell"><div class="avatar" style="position:relative">${initials(a.name)}<span class="status-dot ${getAgentStatusDotClass(a.email)}"></span></div><div><div style="font-weight:600">${esc(a.name)}</div><div class="page-sub" style="margin:0">${esc(a.email)}</div></div></div></td>
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

/* ============================================================ BRAND BREAKDOWN MODAL (Easy to remove as a block) */
function buildBrandHierarchy(statusCode){
  const filtered = TICKETS.filter(t => t.ticket_status === statusCode);
  const hierarchy = {};

  filtered.forEach(ticket => {
    const brand = ticket.brand_id || 'Unknown';
    const country = ticket.country || 'India';
    const zone = ticket.zone || 'Unknown';
    const state = ticket.state || 'Unknown';
    const city = ticket.city || 'Unknown';
    const store = ticket.store_name || 'Unknown';

    if (!hierarchy[brand]) hierarchy[brand] = { count: 0, countries: {} };
    hierarchy[brand].count++;

    if (!hierarchy[brand].countries[country]) hierarchy[brand].countries[country] = { count: 0, zones: {} };
    hierarchy[brand].countries[country].count++;

    if (!hierarchy[brand].countries[country].zones[zone]) hierarchy[brand].countries[country].zones[zone] = { count: 0, states: {} };
    hierarchy[brand].countries[country].zones[zone].count++;

    if (!hierarchy[brand].countries[country].zones[zone].states[state]) hierarchy[brand].countries[country].zones[zone].states[state] = { count: 0, cities: {} };
    hierarchy[brand].countries[country].zones[zone].states[state].count++;

    if (!hierarchy[brand].countries[country].zones[zone].states[state].cities[city]) hierarchy[brand].countries[country].zones[zone].states[state].cities[city] = { count: 0, stores: {} };
    hierarchy[brand].countries[country].zones[zone].states[state].cities[city].count++;

    if (!hierarchy[brand].countries[country].zones[zone].states[state].cities[city].stores[store]) hierarchy[brand].countries[country].zones[zone].states[state].cities[city].stores[store] = { count: 0 };
    hierarchy[brand].countries[country].zones[zone].states[state].cities[city].stores[store].count++;
  });

  return hierarchy;
}

function renderBrandBreakdownTable(hierarchy, expandedState){
  let html = '<table class="bd-table"><tbody>';

  const sortByCount = (obj) => Object.entries(obj).sort((a, b) => b[1].count - a[1].count);

  sortByCount(hierarchy).forEach(([brand, brandData]) => {
    const brandId = `brand-${brand}`;
    const isBrandExpanded = expandedState[brandId];
    html += `<tr class="bd-row bd-level-0" data-id="${brandId}">
      <td class="bd-cell"><span class="bd-chevron ${isBrandExpanded ? 'open' : ''}" onclick="toggleBrandBreakdown('${brandId}')">▶</span> ${esc(brand)}</td>
      <td class="bd-count">${brandData.count}</td>
    </tr>`;

    if (isBrandExpanded) {
      sortByCount(brandData.countries).forEach(([country, countryData]) => {
        const countryId = `${brandId}-country-${country}`;
        const isCountryExpanded = expandedState[countryId];
        html += `<tr class="bd-row bd-level-1" data-id="${countryId}" style="display:table-row">
          <td class="bd-cell"><span class="bd-chevron ${isCountryExpanded ? 'open' : ''}" onclick="toggleBrandBreakdown('${countryId}')">▶</span> ${esc(country)}</td>
          <td class="bd-count">${countryData.count}</td>
        </tr>`;

        if (isCountryExpanded) {
          sortByCount(countryData.zones).forEach(([zone, zoneData]) => {
            const zoneId = `${countryId}-zone-${zone}`;
            const isZoneExpanded = expandedState[zoneId];
            html += `<tr class="bd-row bd-level-2" data-id="${zoneId}" style="display:table-row">
              <td class="bd-cell"><span class="bd-chevron ${isZoneExpanded ? 'open' : ''}" onclick="toggleBrandBreakdown('${zoneId}')">▶</span> ${esc(zone)}</td>
              <td class="bd-count">${zoneData.count}</td>
            </tr>`;

            if (isZoneExpanded) {
              sortByCount(zoneData.states).forEach(([state, stateData]) => {
                const stateId = `${zoneId}-state-${state}`;
                const isStateExpanded = expandedState[stateId];
                html += `<tr class="bd-row bd-level-3" data-id="${stateId}" style="display:table-row">
                  <td class="bd-cell"><span class="bd-chevron ${isStateExpanded ? 'open' : ''}" onclick="toggleBrandBreakdown('${stateId}')">▶</span> ${esc(state)}</td>
                  <td class="bd-count">${stateData.count}</td>
                </tr>`;

                if (isStateExpanded) {
                  sortByCount(stateData.cities).forEach(([city, cityData]) => {
                    const cityId = `${stateId}-city-${city}`;
                    const isCityExpanded = expandedState[cityId];
                    html += `<tr class="bd-row bd-level-4" data-id="${cityId}" style="display:table-row">
                      <td class="bd-cell"><span class="bd-chevron ${isCityExpanded ? 'open' : ''}" onclick="toggleBrandBreakdown('${cityId}')">▶</span> ${esc(city)}</td>
                      <td class="bd-count">${cityData.count}</td>
                    </tr>`;

                    if (isCityExpanded) {
                      sortByCount(cityData.stores).forEach(([store, storeData]) => {
                        const storeId = `${cityId}-store-${store}`;
                        html += `<tr class="bd-row bd-level-5" data-id="${storeId}" style="display:table-row">
                          <td class="bd-cell" style="padding-left:100px">${esc(store)}</td>
                          <td class="bd-count">${storeData.count}</td>
                        </tr>`;
                      });
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  });

  html += '</tbody></table>';
  return html;
}

let brandBreakdownState = {hierarchy: null, statusCode: null};
function toggleBrandBreakdown(id){
  brandBreakdownState[id] = !brandBreakdownState[id];
  const newTableHtml = renderBrandBreakdownTable(brandBreakdownState.hierarchy, brandBreakdownState);
  const content = $('#modalRoot .modal .bd-content');
  if (content) content.innerHTML = newTableHtml;
}

function openBrandBreakdownModal(statusCode){
  const statusName = statusLabel(statusCode) || titleCase(statusCode);
  const hierarchy = buildBrandHierarchy(statusCode);
  brandBreakdownState = {hierarchy: hierarchy, statusCode: statusCode};
  const tableHtml = renderBrandBreakdownTable(hierarchy, brandBreakdownState);

  const html = `<div class="bd-header">
    <h2>${esc(statusName)}</h2>
    <button class="bd-close" onclick="closeModal()">×</button>
  </div>
  <div class="bd-content">${tableHtml}</div>`;

  openModal(html, null, { full: true });
}
/* END BRAND BREAKDOWN MODAL */

/* ============================================================ NAV + BOOT */
/* accordion — one group open at a time, exactly like the live portal */
$$('.nav-parent').forEach(p=>p.onclick=()=>{
  const grp=p.closest('.nav-group'), wasOpen=grp.classList.contains('open');
  $$('.nav-group').forEach(g=>g.classList.remove('open'));
  if(!wasOpen) grp.classList.add('open');
});
$('#navToggle').onclick=()=>$('#sidebar').classList.toggle('collapsed');
$$('.nav-child').forEach(n=>n.onclick=()=>{const target=n.dataset.route; if(appUnsavedGuard) appUnsavedGuard(()=>go(target)); else go(target);});
$$('[data-route]').forEach(n=>{if(n.classList.contains('nav-item')&&!n.classList.contains('nav-parent'))n.onclick=()=>{const target=n.dataset.route; if(appUnsavedGuard) appUnsavedGuard(()=>go(target)); else go(target);};});
window.go=go;
window.router=router;
if(typeof M!=='undefined' && M.bootShell) M.bootShell();

/* ============================================================ PROFILE DROPDOWN INIT */
const avatarBtn = $('#avatarBtn');
const profileDropdown = $('#profileDropdown');
const profileStatusBtn = $('#profileStatusBtn');

if(avatarBtn && profileDropdown) {
  avatarBtn.onclick = (e) => {
    e.stopPropagation();
    profileDropdown.hidden = profileDropdown.hidden ? false : true;
  };

  document.onclick = (e) => {
    // Don't close dropdown if overlay/modal is open
    const hasOverlay = document.querySelector('.status-modal-overlay');
    if(hasOverlay) return;

    if(!avatarBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
      profileDropdown.hidden = true;
    }
  };

  profileStatusBtn.onclick = (e) => {
    e.stopPropagation();
    openStatusPicker();
  };
}

/* ============================================================ STATUS INDICATOR INIT */
updateStatusIndicator();
const statusBtn = $('#statusIndicatorBtn');
if(statusBtn) statusBtn.onclick = openStatusPicker;

router();
