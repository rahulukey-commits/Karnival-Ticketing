/* ============================================================
   Karnival Ticketing — mock data + enums + reference config
   Mirrors the support_ticket model from the reference doc.
   ============================================================ */
const ENUM = {
  status: ['OPEN','INPROGRESS','RESOLVED','CLOSED','ESCALATED','AUTO_ESCALATED','REOPEN'],
  priority: ['HIGH','MEDIUM','LOW'],
  sourceType: ['FEEDBACK','SURVEY','NPS','CSAT','MANUAL','EMAIL','CHAT','WHATSAPP','PHONE'],
  // manual source channels (seen in recording dropdown)
  manualSource: [
    {key:'IN_STORE_COMPLAINT', label:'In-Store Complaint', sub:'Customer visits retail store', needsStore:true},
    {key:'PHONE_CALL',         label:'Phone Call (Untracked)', sub:'General phone lines not integrated'},
    {key:'WALK_IN_OFFICE',     label:'Walk-in at Office', sub:'Corporate office visit'},
    {key:'PHYSICAL_MAIL',      label:'Physical Mail/Letter', sub:'Postal Complaints'},
    {key:'IN_PERSON_MEETING',  label:'In-Person Meeting', sub:'Face-to-face discussions'},
    {key:'WHATSAPP_PERSONAL',  label:'WhatsApp Personal', sub:'Staff personal whatsapp (not business api)'},
    {key:'FIELD_SALES_REPORT', label:'Field Sales Report', sub:'Sales team feedback'},
    {key:'RETAIL_STAFF_REPORT',label:'Retail Staff Report', sub:'Store employee observation'},
    {key:'EVENT_TRADE_SHOW',   label:'Event Trade/Show', sub:'Booth & event interactions'},
  ],
  categories: ['Product Quality','Delivery','Customer Service','Store Experience','Website','Pricing',
               'Returns & Refunds','Product Information','Technical Issue','Billing','Customer Retention','Other'],
  ticketTypes: ['Complaint','Inquiry','Request','Suggestion','Compliment'],
  sentiments: ['Detractor','Passive','Promoter'],
};

// Category → Sub-category tree (single-select category drives sub-category list)
const CATEGORY_TREE = {
  'Store Staff': ['Product Knowledge','Proactive Assistance','In-Store Engagement','Staff Attitude','Staff Availability','Grooming & Appearance','Staff Follow-up','Language Barrier'],
  'Product': ['Product Quality','Defective Item','Damaged Item','Incorrect Information','Product Variety','Product Availability','Size Availability','Product Accessibility','Product Display','Missing Item'],
  'Store Experience': ['Cleanliness','Store Ambience','Music & Lighting','Temperature','Fitting Room Experience','Store Navigation','Visual Merchandising','Security Concern'],
  'Checkout Experience': ['Queue Time','Speed of Checkout','Payment Issue','Staff at Checkout','Receipt Issue','Digital Receipt Issue','Price Discrepancy','Checkout Counter Accessibility'],
  'Club Apparel': ['Points Not Added','Points Redemption','Membership Registration','Membership Upgrade','Benefits Inquiry','Reward Issue','App Login Issue','Loyalty Communication'],
  'Promotions & Offers': ['Offer Not Applied','Promotion Miscommunication','Voucher Issue','Coupon Issue','Discount Not Received','Offer Eligibility','Campaign Inquiry'],
  'Refunds & Returns': ['Return Request','Exchange Request','Refund Delay','Refund Amount Issue','Return Policy Inquiry','Alteration Issue'],
  'Store Operations': ['Store Opening Hours','Store Closure','Inventory Accuracy','Stock Reservation','Lost & Found','Shopping Bag Issue'],
  'Complaint Escalation': ['Unresolved Complaint','Repeat Complaint','Escalation Request','Manager Request','Legal Concern','VIP Complaint'],
  'Omnichannel Services': ['Store Transfer Request','Home Delivery Request','Product Availability Check'],
};
const CATEGORY_LIST = Object.keys(CATEGORY_TREE).concat('Other');

// priority -> SLA mapping (reference §3.5)
const SLA = {
  HIGH:   {response:'1 hour',  duration:4,  esc:'Supervisor'},
  MEDIUM: {response:'4 hours', duration:24, esc:'Manager'},
  LOW:    {response:'24 hours',duration:72, esc:'Lead'},
};

const AGENTS = [
  {email:'rahul.ukey@karnival.com', name:'Rahul Ukey'},
  {email:'sushil.sharma@karnival.com', name:'Sushil Sharma'},
  {email:'siva@karnival.com', name:'siva'},
  {email:'siva.kumar@karnival.com', name:'Siva Kumar'},
  {email:'priya.menon@karnival.com', name:'Priya Menon'},
  {email:'arjun.rao@karnival.com', name:'Arjun Rao'},
];

const GROUPS = ['Escalations Queue','Tier-2 Support','Store Ops','Logistics Desk'];

const STORES = [
  {id:'PE1234', name:'Peter England Store-PE1234', address:'Western Express Hwy, Yashodham, Goregaon, Mumbai - 400080 MH, India', city:'Mumbai', state:'MH', country:'India', zone:'West'},
  {id:'PE0098', name:'Peter England Store-PE0098', address:'Shop No 1, Ground Floor, Building-Manazil Al Raffa 01 Al Raffa - Bur Dubai', city:'Dubai', state:'DXB', country:'UAE', zone:'Gulf'},
  {id:'VH4521', name:'Van Heusen Store-VH4521', address:'MG Road, Bengaluru, Karnataka - 560001, India', city:'Bengaluru', state:'KA', country:'India', zone:'South'},
];

const BRANDS = ['Peter England','Van Heusen','Allen Solly','Louis Philippe'];

const PROJECTS = [
  {project_id:'pe_test_2', brand:'Peter England', name:'Peter England Test Project 2',
   description:'Complaint handling & survey-triggered tickets for PE retail.',
   collaborators:['sushil.sharma@karnival.com','siva@karnival.com'], ticketCount:412,
   matrix:[
     {level:'L1', value:2, unit:'HOURS', to:['Supervisor'], channel:'EMAIL'},
     {level:'L2', value:4, unit:'HOURS', to:['manager@karnival.com'], channel:'SMS'},
     {level:'L3', value:1, unit:'DAYS', to:['Escalations Queue'], channel:'WHATSAPP'},
   ],
   creationLogic:[{source:'NPS', condition:'rating < 6', priority:'HIGH', tags:['detractor']},
                  {source:'CSAT', condition:'sentiment = NEGATIVE', priority:'MEDIUM', tags:['csat']}]},
  {project_id:'soll_cod', brand:'Peter England', name:'Peter England Survey COD',
   description:'Cash-on-delivery survey feedback auto-tickets.',
   collaborators:['siva@karnival.com'], ticketCount:188,
   matrix:[
     {level:'L1', value:1, unit:'HOURS', to:['Supervisor'], channel:'EMAIL'},
     {level:'L2', value:4, unit:'HOURS', to:['Tier-2 Support'], channel:'EMAIL'},
   ],
   creationLogic:[{source:'SURVEY', condition:'score >= 9', priority:'MEDIUM', tags:['promoter']}]},
  {project_id:'vh_live', brand:'Van Heusen', name:'Live Dashboard Testing',
   description:'Live dashboard QA tickets and field reports.',
   collaborators:['siva.kumar@karnival.com','priya.menon@karnival.com'], ticketCount:92,
   matrix:[
     {level:'L1', value:4, unit:'HOURS', to:['Store Ops'], channel:'EMAIL'},
     {level:'L2', value:1, unit:'DAYS', to:['manager@karnival.com'], channel:'SMS'},
   ],
   creationLogic:[]},
];

const TAGS = ['urgent','checkout','cod','detractor','promoter','csat','asdfghkl','vip','refund','delay','quality'];

// known customers (phone search)
const CUSTOMERS = {
  '9021785090': {name:'Rahul', email:'abc@gmail.com', phone:'9021785090', id:'CUST-77120',
    invoices:[
      {no:'Test_12May', date:'12/05/2026', amount:'₹71.50', items:5},
      {no:'Test_0MaySt', date:'12/05/2026', amount:'₹71.50', items:5},
      {no:'Test_0MayS', date:'12/05/2026', amount:'₹71.50', items:5},
      {no:'INV-4471', date:'02/05/2026', amount:'₹1,240.00', items:2},
      {no:'INV-4470', date:'28/04/2026', amount:'₹560.00', items:3},
    ]},
};

let SEQ = 100;
function nextTicketNo(prefix){ SEQ++; return `${prefix}-${SEQ}`; }

function hoursAgo(h){ return new Date(Date.now() - h*3600*1000); }

function mkTicket(o){
  const created = o.created || hoursAgo(o.ageH||4);
  const prio = o.priority||'MEDIUM';
  const due = new Date(created.getTime() + SLA[prio].duration*3600*1000);
  const overdue = due < new Date() && o.status!=='RESOLVED' && o.status!=='CLOSED';
  return Object.assign({
    ticket_number:o.num, brand_id:o.brand, project_id:o.project, project_name:o.projectName,
    ticket_type:o.type||'COMPLAINT', ticket_status:o.status||'OPEN', ticket_priority:prio,
    title:o.title, description:o.description||'',
    created_at:created, updated_at:o.updated||created, created_by:o.createdBy||'Auto Created',
    assigned_to:o.assigned||null, assigned_name:o.assignedName||null, group_assigned_to:o.group||null,
    store_id:o.store||null, store_name:o.storeName||null, location:o.location||null,
    city:o.city, state:o.state, zone:o.zone, country:o.country||'India',
    customer_info:o.customer||null, source_type:o.source||'MANUAL', manual_source:o.manualSource||null,
    source_identifier:o.sourceId||null, bill_id:o.billId||null,
    tags:o.tags||[], categories:o.categories||[], sub_category:o.subCategory||null,
    sentiment:o.sentiment||null, product_skus:o.skus||[],
    amount:o.amount||null, receipt_date:o.receiptDate||null,
    score:o.score, score_cats:o.scoreCats||[],
    due_date:due, is_overdue:overdue, sla_status:overdue?'BREACHED':(due-new Date()<3600*1000?'AT_RISK':'ON_TRACK'),
    escalation_info:o.escalation||null,
    comments:o.comments||[], communication_audit:o.comms||[],
    attachments:o.attachments||[], history_audit:o.history||[],
    hide_personal_data:!!o.hide,
  }, {});
}

const TICKETS = [
  mkTicket({num:'TEEC-6', brand:'Peter England', project:'pe_test_2', projectName:'Peter England Test Project 2',
    title:'Test', status:'OPEN', priority:'MEDIUM', source:'MANUAL', manualSource:'IN_STORE_COMPLAINT',
    store:'PE1234', storeName:'Peter England Store-PE1234',
    location:'Western Express Hwy, Yashodham, Goregaon, Mumbai, Mumbai, Mumbai - 400080 MH, India',
    city:'Mumbai', state:'MH', zone:'West',
    assigned:'rahul.ukey@karnival.com', assignedName:'Rahul Ukey', createdBy:'Rahul Ukey',
    customer:{name:'Rahul', email:'abc@gmail.com', phone:'9021785090', id:'CUST-77120'},
    description:'Customer reported a sizing discrepancy on a shirt purchased in-store.',
    categories:['Product Quality'], sentiment:'Passive', tags:['cod'], ageH:2,
    billId:'T3HH13R3M1141CMIX4C1PII', amount:'AED 538.00', receiptDate:hoursAgo(3),
    comments:[
      {author:'Rahul Ukey', email:'rahul.ukey@karnival.com', text:'@siva Email was sent to store for further investigation.', internal:true, at:hoursAgo(1.5), mentions:['siva']},
    ],
    comms:[
      {channel:'EMAIL', direction:'OUT', at:hoursAgo(1), party:'abc@gmail.com', subject:'[TEEC-6] We are looking into this', body:'Hi Rahul, thanks for reaching out. We are investigating.', by:'rahul.ukey@karnival.com'},
    ],
    history:[
      {field:'status', old:'—', neu:'OPEN', by:'rahul.ukey@karnival.com', at:hoursAgo(2)},
      {field:'assigned_to', old:'—', neu:'Rahul Ukey', by:'rahul.ukey@karnival.com', at:hoursAgo(2)},
    ]}),
  mkTicket({num:'SOLL-7', brand:'Peter England', project:'soll_cod', projectName:'Peter England Survey COD',
    title:'Feedback Ticket', status:'AUTO_ESCALATED', priority:'MEDIUM', source:'SURVEY',
    location:'Shop No 1, Ground Floor, Building-Manazil Al Raffa 01 Al Raffa - Bur Delhi',
    city:'Dubai', country:'UAE', zone:'Gulf',
    assigned:'siva@karnival.com', assignedName:'siva',
    customer:{name:'Sushil Sharma', email:'sushil.s@example.com', phone:'9700012345', id:'CUST-66120'},
    score:'10 / 10', sentiment:'Promoter', scoreCats:['CheckOut Experience','Clarity of Information','Double checking again for correct'],
    sourceId:'survey_889', tags:['promoter'], categories:['Store Experience'], ageH:600,
    billId:'AGSURV889COD', amount:'AED 312.00', receiptDate:hoursAgo(602),
    escalation:{level:2, escalated_at:hoursAgo(580), escalated_to:['Tier-2 Support'], reason:'L2 SLA breached'},
    comments:[], comms:[],
    history:[{field:'status', old:'OPEN', neu:'AUTO_ESCALATED', by:'TicketEscalationJob', at:hoursAgo(580)}]}),
  mkTicket({num:'JETC-8', brand:'Peter England', project:'soll_cod', projectName:'Peter England Survey COD',
    title:'Feedback Ticket', status:'AUTO_ESCALATED', priority:'HIGH', source:'SURVEY',
    location:'Shop No 1, Ground Floor, Building-Manazil Al Raffa 01 Al Raffa - Bur Delhi',
    city:'Dubai', country:'UAE', zone:'Gulf',
    assigned:'siva@karnival.com', assignedName:'siva',
    customer:{name:'Sushil Sharma', email:'sushil.s@example.com', phone:'9700012345', id:'CUST-66120'},
    score:'10 / 10', sentiment:'Promoter', scoreCats:['CheckOut Experience','Clarity of Information','Double checking again for correct'],
    sourceId:'survey_890', tags:['detractor'], categories:['Customer Service'], ageH:610,
    billId:'AGSURV890COD', amount:'AED 489.00', receiptDate:hoursAgo(612),
    escalation:{level:2, escalated_at:hoursAgo(600), escalated_to:['manager@karnival.com'], reason:'L2 SLA breached'}}),
  mkTicket({num:'SOLL-6', brand:'Peter England', project:'soll_cod', projectName:'Peter England Survey COD',
    title:'Feedback Ticket', status:'AUTO_ESCALATED', priority:'MEDIUM', source:'SURVEY',
    location:'Shop No 1, Ground Floor, Building-Manazil Al Raffa 01 Al Raffa - Bur Delhi',
    city:'Dubai', country:'UAE', zone:'Gulf',
    assigned:'siva@karnival.com', assignedName:'siva',
    customer:{name:'Sushil Sharma', email:'sushil.s@example.com', phone:'9700012345', id:'CUST-66120'},
    score:'9 / 10', sentiment:'Promoter', scoreCats:['Product','Variety of products','Checking the Head count of the survey Analytics'],
    sourceId:'survey_888', tags:['promoter'], categories:['Product Information'], ageH:600,
    billId:'AGSURV888COD', amount:'AED 205.50', receiptDate:hoursAgo(602),
    escalation:{level:1, escalated_at:hoursAgo(595), escalated_to:['Supervisor'], reason:'L1 SLA breached'}}),
  mkTicket({num:'IWHO-16', brand:'Van Heusen', project:'vh_live', projectName:'Live Dashboard Testing',
    title:'Feedback Ticket', status:'OPEN', priority:'MEDIUM', source:'SURVEY',
    location:'MG Road, Bengaluru, Karnataka - 560001, India',
    city:'Bengaluru', state:'KA', zone:'South',
    assigned:'siva.kumar@karnival.com', assignedName:'Siva Kumar',
    customer:{name:'Siva Kumar', email:'siva.k@example.com', phone:'9811122233', id:'CUST-41200'},
    score:'8 / 10', sentiment:'Passive', scoreCats:['Service','Wait time'], categories:['Customer Service'], ageH:740,
    billId:'VHSURV016', amount:'₹1,899.00', receiptDate:hoursAgo(742)}),
  mkTicket({num:'TKT-101', brand:'Allen Solly', project:'pe_test_2', projectName:'Peter England Test Project 2',
    title:'Refund not processed for online order', status:'INPROGRESS', priority:'HIGH', source:'EMAIL',
    city:'Mumbai', state:'MH', zone:'West',
    assigned:'priya.menon@karnival.com', assignedName:'Priya Menon', createdBy:'priya.menon@karnival.com',
    customer:{name:'Anita Desai', email:'anita.d@example.com', phone:'9876500011', id:'CUST-55012'},
    description:'Refund of ₹2,499 pending for 6 days against returned order.',
    categories:['Returns & Refunds','Billing'], tags:['refund','urgent'], ageH:30,
    comments:[{author:'Priya Menon', email:'priya.menon@karnival.com', text:'Raised reversal request with payments team.', internal:true, at:hoursAgo(20), tags:['Action taken']}]}),
  mkTicket({num:'TKT-102', brand:'Van Heusen', project:'vh_live', projectName:'Live Dashboard Testing',
    title:'Website checkout throwing 500 error', status:'RESOLVED', priority:'HIGH', source:'CHAT',
    city:'Bengaluru', state:'KA', zone:'South',
    assigned:'arjun.rao@karnival.com', assignedName:'Arjun Rao', createdBy:'arjun.rao@karnival.com',
    customer:{name:'Karthik N', email:'karthik@example.com', phone:'9000011122', id:'CUST-33910'},
    description:'Payment gateway timeout during checkout, now patched.',
    categories:['Website','Technical Issue'], tags:['checkout'], ageH:50, status:'RESOLVED'}),
  mkTicket({num:'TKT-103', brand:'Louis Philippe', project:'pe_test_2', projectName:'Peter England Test Project 2',
    title:'Loyalty points not credited', status:'CLOSED', priority:'LOW', source:'PHONE',
    manualSource:'PHONE_CALL', city:'Delhi', state:'DL', zone:'North',
    assigned:'siva@karnival.com', assignedName:'siva', createdBy:'siva@karnival.com',
    customer:{name:'Meera Iyer', email:'meera@example.com', phone:'9112233445', id:'CUST-22011'},
    description:'500 loyalty points missing from last purchase. Credited manually.',
    categories:['Customer Retention'], tags:['vip'], ageH:120}),
  mkTicket({num:'TKT-104', brand:'Peter England', project:'pe_test_2', projectName:'Peter England Test Project 2',
    title:'Damaged packaging on delivery', status:'REOPEN', priority:'MEDIUM', source:'WHATSAPP',
    city:'Pune', state:'MH', zone:'West',
    assigned:'rahul.ukey@karnival.com', assignedName:'Rahul Ukey', createdBy:'rahul.ukey@karnival.com',
    customer:{name:'Sahil Verma', email:'sahil@example.com', phone:'9333344455', id:'CUST-90871'},
    description:'Customer reopened — replacement also arrived damaged.',
    categories:['Delivery','Product Quality'], tags:['delay'], ageH:8}),
];

// status counts (mirrors All Tickets KPIs in the recording)
const KPI = {OPEN:294, INPROGRESS:36, RESOLVED:11, CLOSED:41, REOPEN:2, TOTAL:692};

const COUNTRY_STATS = [
  {country:'India', count:438}, {country:'UAE', count:171}, {country:'UK', count:52}, {country:'USA', count:31},
];
const STORE_STATS = [
  {store:'Peter England Store-PE1234', OPEN:88, INPROGRESS:12, RESOLVED:4, CLOSED:9},
  {store:'Peter England Store-PE0098', OPEN:121, INPROGRESS:9, RESOLVED:3, CLOSED:14},
  {store:'Van Heusen Store-VH4521', OPEN:85, INPROGRESS:15, RESOLVED:4, CLOSED:18},
];
const TREND = (()=>{ const d=[],open=[],res=[]; for(let i=13;i>=0;i--){
  const dt=new Date(Date.now()-i*86400000); d.push(`${dt.getDate()}/${dt.getMonth()+1}`);
  open.push(18+Math.round(Math.abs(Math.sin(i*1.1))*22)); res.push(6+Math.round(Math.abs(Math.cos(i*0.9))*12)); }
  return {dates:d, open, res}; })();

const AGENT_STATS = [
  {email:'rahul.ukey@karnival.com', name:'Rahul Ukey', volume:128, sla:94, avgResp:'42m', resolution:91},
  {email:'sushil.sharma@karnival.com', name:'Sushil Sharma', volume:204, sla:81, avgResp:'1h 12m', resolution:78},
  {email:'siva@karnival.com', name:'siva', volume:176, sla:88, avgResp:'55m', resolution:84},
  {email:'priya.menon@karnival.com', name:'Priya Menon', volume:97, sla:96, avgResp:'31m', resolution:93},
  {email:'arjun.rao@karnival.com', name:'Arjun Rao', volume:142, sla:73, avgResp:'1h 48m', resolution:69},
  {email:'siva.kumar@karnival.com', name:'Siva Kumar', volume:63, sla:90, avgResp:'48m', resolution:86},
];

const SOURCE_STATS = [
  {source:'SURVEY', count:241, auto:true}, {source:'NPS', count:118, auto:true}, {source:'CSAT', count:64, auto:true},
  {source:'EMAIL', count:73, auto:false}, {source:'MANUAL', count:96, auto:false}, {source:'WHATSAPP', count:48, auto:false},
  {source:'CHAT', count:33, auto:false}, {source:'PHONE', count:19, auto:false},
];

const LOGS = [
  {at:hoursAgo(0.2), ticket:'TEEC-6', event:'COMMENT_ADDED', actor:'Rahul Ukey', detail:'Internal comment added'},
  {at:hoursAgo(0.5), ticket:'TEEC-6', event:'COMMUNICATION_SENT', actor:'Rahul Ukey', detail:'Email sent to abc@gmail.com'},
  {at:hoursAgo(1), ticket:'TKT-104', event:'STATUS_CHANGE', actor:'Rahul Ukey', detail:'CLOSED → REOPEN'},
  {at:hoursAgo(9), ticket:'TKT-101', event:'ASSIGNED', actor:'System', detail:'Assigned to Priya Menon'},
  {at:hoursAgo(20), ticket:'SOLL-7', event:'AUTO_ESCALATED', actor:'TicketEscalationJob', detail:'Escalated to L2 (Tier-2 Support)'},
  {at:hoursAgo(24), ticket:'JETC-8', event:'AUTO_ESCALATED', actor:'TicketEscalationJob', detail:'Escalated to L2 (Manager)'},
  {at:hoursAgo(48), ticket:'TKT-102', event:'STATUS_CHANGE', actor:'Arjun Rao', detail:'INPROGRESS → RESOLVED'},
  {at:hoursAgo(50), ticket:'TKT-102', event:'CREATED', actor:'Arjun Rao', detail:'Ticket created from CHAT'},
];
