(function(){
'use strict';

/* ================= Configuration ================= */
var APP_VERSION = '1.18.4';  // shown on the home screen — use it to confirm the live app is up to date
var STATUSES = [
  {k:'ok',      s:'OK',       i:'✓',  l:'OK / good condition'},
  {k:'clean',   s:'Requires Cleaning', i:'🧽', l:'Requires cleaning'},
  {k:'damaged', s:'Damaged',  i:'💥', l:'Damaged / broken'},
  {k:'missing', s:'Missing',  i:'🚫', l:'Missing / not working'},
  {k:'na',      s:'N/A',      i:'–',  l:'Not applicable'}
];
var STATUS_LABEL = {}; STATUSES.forEach(function(s){ STATUS_LABEL[s.k]=s.l; });
var ISSUE = {clean:1,damaged:1,missing:1};
/* Who needs to act on an issue — not who is at fault (a tenant may cause damage only the landlord can fix) */
var ACTIONS = [{k:'tenant',l:'Tenant to action',s:'Tenant to action',i:'🧑'},{k:'landlord',l:'Landlord to action',s:'Landlord to action',i:'🏠'},{k:'none',l:'No action required',s:'No action',i:'➖'}];
var ACTION_LABEL = {}; ACTIONS.forEach(function(x){ ACTION_LABEL[x.k]=x.l; });
var INSPECTION_TYPES = ['Routine','Ingoing (move-in)','Outgoing (move-out)','Pre-listing / maintenance'];

var COMMON = ['Walls – marks, holes, damage','Ceiling','Floor / carpet','Skirting boards','Windows & glass','Curtains / blinds','Doors, handles & locks','Light fittings & bulbs','Power points & switches'];
var LIB = {
  'Bedroom': COMMON.concat(['Wardrobe / storage','Smoke alarm – present & working']),
  'Living / Dining': COMMON.concat(['Heat pump / heater','Smoke alarm – present & working']),
  'Kitchen': COMMON.concat(['Benchtops','Cupboards & drawers','Oven & hob','Rangehood','Sink & taps','Dishwasher (chattel)','Fridge (chattel)']),
  'Bathroom': ['Walls – marks, holes, damage','Ceiling','Floor / tiles','Skirting boards','Windows & glass','Light fittings & bulbs','Shower / bath','Toilet','Vanity & basin','Mirror & cabinet','Extractor fan','Mould / mildew','Towel rail'],
  'Toilet': ['Walls','Floor','Toilet','Hand basin','Light fittings & bulbs','Extractor fan'],
  'Laundry': ['Walls','Floor','Skirting boards','Tub & taps','Washing machine connections','Dryer (chattel)','Light fittings & bulbs'],
  'Hallway / Entry': COMMON.concat(['Smoke alarm – present & working']),
  'Garage': ['Floor – oil stains','Garage door & opener','Walls','Light fittings & bulbs','Rubbish removed'],
  'Exterior / Grounds': ['Lawns & gardens','Rubbish removed / bins','Driveway & paths','Fences & gates','Clothesline','Exterior windows','Exterior walls & cladding','Letterbox','Outdoor lighting'],
  'General / Whole property': ['Smoke alarms – all present & working','Rubbish removed from property','Keys & remotes','Meter readings (power / water)','Ventilation & insulation','Pests – any evidence'],
  'Special features': [],
  'Custom': []
};
var AREA_TYPES = Object.keys(LIB);

/* ================= Platform tweaks ================= */
// the extra top space is only for the old app inside Google's frame (its white status-bar strip); the Rentals app has none
(function(){ var ua=navigator.userAgent||''; if(!window.RENTALS_CONFIG && (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints>1))) document.documentElement.classList.add('ios'); })();

/* ================= Helpers ================= */
function $(s,r){ return (r||document).querySelector(s); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function nowIso(){ return new Date().toISOString(); }
function fmt(iso){ if(!iso) return ''; try{ return new Date(iso).toLocaleString('en-NZ',{day:'numeric',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'}); }catch(e){ return iso; } }
function uid(p){ return p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function toast(msg,ms){ var t=$('#toast'); t.innerHTML='<span>'+esc(msg)+'</span>'; clearTimeout(toast._t); toast._t=setTimeout(function(){t.innerHTML='';},ms||2600); }

/* ================= Backend API (Google Apps Script or demo) ================= */
var HAS_GAS = !!(window.google && google.script && google.script.run);
function gas(fn){
  var args=[].slice.call(arguments,1);
  return new Promise(function(res,rej){
    var r=google.script.run.withSuccessHandler(res).withFailureHandler(function(e){ rej(new Error((e&&e.message)||String(e))); });
    r[fn].apply(r,args);
  });
}
var Demo = {
  pin:'1234',
  load:function(){ try{ var p=JSON.parse(localStorage.getItem('fi-demo-props')); if(p&&p.length) return p; }catch(e){} var s=[Demo.sample()]; Demo.save(s); return s; },
  save:function(p){ try{ localStorage.setItem('fi-demo-props',JSON.stringify(p)); }catch(e){} },
  sample:function(){
    var areas=[['Kitchen','Kitchen'],['Living / Dining','Living / Dining'],['Bedroom 1','Bedroom'],['Bedroom 2','Bedroom'],['Bathroom','Bathroom'],['Laundry','Laundry'],['Exterior / Grounds','Exterior / Grounds'],['General / Whole property','General / Whole property']];
    var a=areas.map(function(x,i){ return {id:'A'+(i+1),name:x[0],type:x[1],items:LIB[x[1]].slice(),notes:''}; });
    a.push({id:'A9',name:'Special features',type:'Special features',items:['Heat pump (living room)','Dishwasher','Garden shed'],notes:''});
    return {id:'P-DEMO1',name:'Unit 3, 12 Sample Street',address:'12 Sample Street, Dunedin',notes:'Example property — edit or archive in Admin.',active:true,areas:a};
  },
  wait:function(v){ return new Promise(function(r){ setTimeout(function(){ r(v); },250); }); }
};
var api = {
  bootstrap:function(){ return HAS_GAS? gas('getBootstrap') : Demo.wait({properties:Demo.load(),appName:'Flat Inspections'}); },
  verifyPin:function(pin){ return HAS_GAS? gas('verifyPin',pin) : Demo.wait(pin===Demo.pin); },
  saveProperty:function(pin,p){
    if(HAS_GAS) return gas('saveProperty',pin,p);
    if(pin!==Demo.pin) return Promise.reject(new Error('Incorrect PIN'));
    var list=Demo.load(); if(!p.id) p.id=uid('P'); var i=list.findIndex(function(x){return x.id===p.id;});
    if(i>=0) list[i]=p; else list.push(p); Demo.save(list); return Demo.wait({properties:list.filter(function(x){return x.active!==false;})});
  },
  archiveProperty:function(pin,id){
    if(HAS_GAS) return gas('archiveProperty',pin,id);
    var list=Demo.load().filter(function(x){return x.id!==id;}); Demo.save(list); return Demo.wait({properties:list});
  },
  createInspection:function(meta){ return HAS_GAS? gas('createInspection',meta) : Demo.wait({folderId:'demo',photosFolderId:'demo',folderUrl:''}); },
  uploadPhoto:function(obj){ return HAS_GAS? gas('uploadPhoto',obj) : Demo.wait({fileId:'demo-'+obj.photoId,url:''}); },
  emailReport:function(obj){ return HAS_GAS? gas('emailReport',obj) : Demo.wait({ok:true,sentTo:obj.to,notes:['Demo mode: no email was actually sent.']}); },
  prepareTenantIssues:function(obj){
    if(HAS_GAS) return gas('prepareTenantIssues',obj);
    return Demo.wait({inspectionId:obj.inspectionId,propertyName:'Unit 3, 12 Sample Street',address:'12 Sample Street, Dunedin',date:'14 October 2026',type:'Routine',inspector:'Demo',
      subject:'Property inspection – items for you to action – Unit 3, 12 Sample Street – 14 Oct 2026',opening:'Thank you for your time during the recent inspection of the property. The following 2 items were identified as needing your attention.',
      closing:'Please address these items as soon as possible. Your property manager may be in touch if they decide a reinspection is warranted.',signoff:'Demo',
      items:[{area:'Kitchen',item:'Oven',issue:'Requires cleaning',note:'Grease on the door seal'},{area:'Bathroom',item:'Shower',issue:'Requires cleaning',note:''}],
      tenants:[{name:'Ana Smith',knownAs:'',email:'ana@example.com',current:true,note:'Current tenant'},{name:'Bo Ng',knownAs:'Bobby',email:'bo@example.com',current:true,note:'Current tenant'},{name:'Cy Old',knownAs:'',email:'cy@example.com',current:false,note:'Tenancy ended 2026-01-31'}]});
  },
  previewTenantIssues:function(obj){
    if(HAS_GAS) return gas('previewTenantIssues',obj);
    var p=function(t){ return '<p style="margin:0 0 14px;white-space:pre-wrap">'+esc(t)+'</p>'; };
    return Demo.wait({to:validEmails(obj.to),cc:validEmails(obj.cc),subject:obj.subject,items:obj.items.length,
      html:'<div style="background:#f4f2ff;padding:20px 10px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e6e3f5">'+
        '<div style="background:#5b21b6;color:#fff;padding:24px"><div style="font-size:13px;opacity:.85;text-transform:uppercase;letter-spacing:1px">Property inspection — items for you to action</div><div style="font-size:22px;font-weight:800;margin-top:4px">Unit 3, 12 Sample Street</div></div>'+
        '<div style="padding:20px 24px;font-size:15px;line-height:1.55;color:#14122b">'+p(obj.greeting)+p(obj.opening)+'<p>(Demo: the inspection summary and the '+obj.items.length+' chosen item(s) go here.)</p>'+p(obj.closing)+'<p style="margin:0">Kind regards,<br>'+esc(obj.signoff)+'</p></div></div></div>'});
  },
  emailTenantIssues:function(obj){ return HAS_GAS? gas('emailTenantIssues',obj) : Demo.wait({ok:true,sentTo:obj.to,items:0,notes:[]}); },
  getPrior:function(pid){ return HAS_GAS? gas('getPriorFindings',pid) : Promise.resolve(null); },
  deleteInspection:function(pin,ref){
    if(HAS_GAS) return gas('deleteInspection',pin,ref);
    return pin===Demo.pin? Demo.wait({ok:true,inspectionId:ref.id}) : Promise.reject(new Error('Incorrect admin PIN'));
  },
  getVersion:function(){ return HAS_GAS? gas('getVersion') : Promise.resolve({version:APP_VERSION,url:''}); },
  deletePhoto:function(obj){ return HAS_GAS? gas('deletePhoto',obj) : Demo.wait({ok:true}); },
  discardInspection:function(id){ return HAS_GAS? gas('discardInspection',id) : Demo.wait({ok:true}); },
  submitInspection:function(payload,pin){ return HAS_GAS? gas('submitInspection',payload,pin||'') : Demo.wait({reportUrl:'',folderUrl:'',sheetUrl:''}); },
  backup:function(p){ return HAS_GAS? gas('backupInspection',p) : Demo.wait({ok:true,savedAt:nowIso()}); },
  openInProgress:function(id){ return HAS_GAS? gas('openInProgress',id) : Promise.reject(new Error('Reopening from the online copy needs the Google backend.')); },
  getInspection:function(ref){
    if(HAS_GAS) return gas('getInspection',ref);
    var p=Demo.load()[0];
    return Demo.wait({id:ref.id,propertyId:p.id,propertyName:p.name,address:p.address||'',type:'Routine',inspector:'Demo',tenant:'',startedAt:nowIso(),submittedAt:nowIso(),
      overallNotes:'Demo inspection.',reportUrl:'',folderUrl:'',areas:p.areas.map(function(a,ai){ return {name:a.name,type:a.type,notes:'',photos:[],
        items:(a.items||[]).map(function(l,i){ var bad=(ai+i)%7===3; return {label:l,status:bad?'clean':'ok',note:bad?'Needs a wipe down':'',action:bad?'tenant':null,photos:[]}; })}; })});
  },
  openForEdit:function(pin,ref){ return HAS_GAS? gas('openInspectionForEdit',pin,ref) : Promise.reject(new Error('Editing submitted inspections needs the Google backend.')); }
};

/* ================= Local storage (IndexedDB) — drafts survive no signal ================= */
var DB = (function(){
  var dbp=null, mem={drafts:{},photos:{}};
  function open(){
    if(!dbp) dbp=new Promise(function(res,rej){
      if(!window.indexedDB) return rej(new Error('no idb'));
      var r=indexedDB.open('flat-inspections',1);
      r.onupgradeneeded=function(){ var db=r.result; db.createObjectStore('drafts',{keyPath:'id'}); db.createObjectStore('photos',{keyPath:'id'}); };
      r.onsuccess=function(){ res(r.result); }; r.onerror=function(){ rej(r.error); };
    });
    return dbp;
  }
  function run(store,mode,fn){
    return open().then(function(db){ return new Promise(function(res,rej){
      var t=db.transaction(store,mode), req=fn(t.objectStore(store));
      t.oncomplete=function(){ res(req&&req.result); }; t.onerror=function(){ rej(t.error); };
    }); });
  }
  // If the browser won't store anything (private browsing, storage full or blocked), say so instead of quietly keeping
  // the work in memory only, where a refresh loses it.
  function bad(e){ if(DB.failed) return; DB.failed=true; try{ console.warn('Local storage failed',e); $('#storeBanner').classList.remove('hidden'); }catch(x){} }
  function fb(store,op,a){ var m=mem[store]; if(op==='put'){ m[a.id]=a; } else if(op==='get'){ return m[a]; } else if(op==='all'){ return Object.keys(m).map(function(k){return m[k];}); } else if(op==='del'){ delete m[a]; } }
  var DB={ failed:false,
    put:function(store,v){ return run(store,'readwrite',function(s){ return s.put(v); }).catch(function(e){ bad(e); fb(store,'put',v); }); },
    get:function(store,id){ return run(store,'readonly',function(s){ return s.get(id); }).catch(function(e){ bad(e); return fb(store,'get',id); }); },
    all:function(store){ return run(store,'readonly',function(s){ return s.getAll(); }).catch(function(e){ bad(e); return fb(store,'all'); }); },
    del:function(store,id){ return run(store,'readwrite',function(s){ return s.delete(id); }).catch(function(e){ bad(e); fb(store,'del',id); }); }
  };
  return DB;
})();
/* Ask the browser to keep this app's storage instead of clearing it when space is short (where supported) */
try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(function(p){ if(!p) return navigator.storage.persist(); }).catch(function(){}); }catch(e){}

/* Storage check: does this phone keep the app's data after the app is closed?
   Each open records a marker in localStorage, IndexedDB, a cookie and sessionStorage, after first reading what the
   previous open left. Kept = the phone kept it; empty = wiped (or this is the first open). */
var Probe=(function(){
  var KEY='fi-probe', now=new Date().toISOString(), out={rows:[],info:[]}, ready=null;
  function parse(v){ try{ return JSON.parse(v); }catch(e){ return null; } }
  function next(prev){ return {n:((prev&&prev.n)||0)+1,at:now}; }
  function row(name,prev,err){ out.rows.push({name:name,prev:prev,err:err||''}); }
  function idb(){ return new Promise(function(res){
    try{ var r=indexedDB.open('fi-probe',1);
      r.onupgradeneeded=function(){ r.result.createObjectStore('p'); };
      r.onerror=function(){ res({err:String(r.error||'error')}); };
      r.onsuccess=function(){ var db=r.result;
        try{ var t=db.transaction('p','readwrite'), st=t.objectStore('p'), g=st.get(KEY);
          g.onsuccess=function(){ var prev=g.result||null; st.put(next(prev),KEY); t.oncomplete=function(){ res({prev:prev}); }; };
          t.onerror=function(){ res({err:String(t.error||'error')}); };
        }catch(e){ res({err:String(e)}); } };
    }catch(e){ res({err:String(e)}); } }); }
  function start(){
    if(ready) return ready;
    var prev;
    try{ prev=parse(localStorage.getItem(KEY)); localStorage.setItem(KEY,JSON.stringify(next(prev))); row('Local storage',prev); }catch(e){ row('Local storage',null,String(e)); }
    try{ var m=document.cookie.match(/(?:^|; )fi-probe=([^;]*)/); prev=m?parse(decodeURIComponent(m[1])):null;
      document.cookie='fi-probe='+encodeURIComponent(JSON.stringify(next(prev)))+'; max-age=31536000; path=/; SameSite=None; Secure'; row('Cookie',prev); }catch(e){ row('Cookie',null,String(e)); }
    try{ prev=parse(sessionStorage.getItem(KEY)); sessionStorage.setItem(KEY,JSON.stringify(next(prev))); row('Session storage (expected to clear)',prev); }catch(e){ row('Session storage',null,String(e)); }
    var embedded=true; try{ embedded=window.top!==window; }catch(e){}
    var standalone=!!(navigator.standalone||(window.matchMedia&&matchMedia('(display-mode: standalone)').matches));
    out.info.push(['Page address',location.hostname],['Embedded in another page',embedded?'Yes':'No'],['Opened as a home-screen app',standalone?'Yes':'No (or can\u2019t tell from inside a frame)'],
      ['Browser',navigator.userAgent],['Checked at',new Date(now).toLocaleString('en-NZ')]);
    var jobs=[idb().then(function(r){ out.rows.splice(1,0,{name:'IndexedDB (where inspections are kept)',prev:r.prev||null,err:r.err||''}); })];
    if(navigator.storage&&navigator.storage.persisted) jobs.push(navigator.storage.persisted().then(function(p){ out.info.push(['Phone agreed to keep the data',p?'Yes':'No']); }).catch(function(){}));
    if(document.hasStorageAccess) jobs.push(document.hasStorageAccess().then(function(a){ out.info.push(['Full storage access (embedded pages)',a?'Yes':'No']); }).catch(function(){}));
    ready=Promise.all(jobs).then(function(){ return out; });
    return ready;
  }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function when(iso){ try{ return new Date(iso).toLocaleString('en-NZ',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit',second:'2-digit'}); }catch(e){ return iso; } }
  function html(o){
    var kept=o.rows.filter(function(r){ return r.prev; }).length;
    return '<table style="width:100%;border-collapse:collapse;font-size:.9rem">'+o.rows.map(function(r){
      return '<tr><td style="padding:6px 8px 6px 0;vertical-align:top;font-weight:700">'+esc(r.name)+'</td><td style="padding:6px 0;vertical-align:top">'+
        (r.err?'<span style="color:#b91c1c">Not available: '+esc(r.err)+'</span>':r.prev?'<span style="color:#15803d;font-weight:700">\u2713 Kept</span> from open #'+esc(r.prev.n)+' at '+esc(when(r.prev.at)):
          '<span style="color:#b91c1c;font-weight:700">\u2717 Empty</span> (wiped, or this is the first open)')+'</td></tr>'; }).join('')+'</table>'+
      '<div style="font-size:.8rem;opacity:.75;margin-top:10px">'+o.info.map(function(x){ return '<div><b>'+esc(x[0])+':</b> '+esc(x[1])+'</div>'; }).join('')+'</div>'+
      (kept?'':'<div style="font-size:.85rem;margin-top:8px">Nothing was kept. If you have opened this before, the phone cleared the data.</div>');
  }
  return {start:start,html:html};
})();

/* ================= State & navigation ================= */
var S = { props:[], draft:null, areaIdx:0, pin:null, editing:null, stack:[], history:[] };
try{ S.history=JSON.parse(localStorage.getItem('fi-history')||'[]'); }catch(e){}
S.recent=null; S.me=''; S.recentShow=10;
try{ var rc=JSON.parse(localStorage.getItem('fi-recent-cache')||'null'); if(rc){ S.recent=rc.items; S.me=rc.me||''; } }catch(e){}
S.recentFilter=localStorage.getItem('fi-recent-filter')||'all';
S.tab=null;   // 'new' | 'progress' | 'submitted' | 'setup'; chosen on first show (In progress if anything is)
/* Submitted inspections opened read-only are kept on this phone (the last 15), so they open at once and offline */
function viewCacheGet(id){ try{ var c=JSON.parse(localStorage.getItem('fi-view-cache')||'{}'); return c[id]? c[id].d : null; }catch(e){ return null; } }
function viewCachePut(id,d){
  var c={}; try{ c=JSON.parse(localStorage.getItem('fi-view-cache')||'{}'); }catch(e){}
  c[id]={d:d,at:Date.now()};
  var keys=Object.keys(c).sort(function(a,b){ return c[b].at-c[a].at; }); keys.slice(15).forEach(function(k){ delete c[k]; });
  store('fi-view-cache',c);
}
function viewCacheDrop(id){ try{ var c=JSON.parse(localStorage.getItem('fi-view-cache')||'{}'); delete c[id]; store('fi-view-cache',c); }catch(e){} }
S.inProgress=null; try{ S.inProgress=JSON.parse(localStorage.getItem('fi-inprogress-cache')||'null'); }catch(e){}
function store(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ try{ localStorage.removeItem(k); }catch(x){} } }
function setInProgress(list){ S.inProgress=list; store('fi-inprogress-cache',list); }
function setProps(list){ S.props=list||[]; store('fi-props-cache',S.props); }
function saveRecent(){ store('fi-recent-cache',{items:S.recent,me:S.me}); }
/* Something was deleted, archived or saved here: a server refresh that started before it is out of date (loadProps fetches again) */
function changedHere(){ S.changeSeq=(S.changeSeq||0)+1; }
/* Submitted inspections from ALL devices (from the Sheet), plus anything this device submitted that
   the server list doesn't include yet. Falls back to this device's list in demo mode / offline. */
function recentList(){
  var list=(S.recent||[]).map(function(x){ return Object.assign({},x); }), ids={};
  list.forEach(function(x){ ids[x.id]=1; });
  S.history.forEach(function(x){ if(!x.id || !ids[x.id]) list.push(Object.assign({mine:true,inspector:localStorage.getItem('fi-inspector')||''},x)); });
  var myName=(localStorage.getItem('fi-inspector')||'').trim().toLowerCase();
  list.forEach(function(x){ if(!x.mine && !S.me && myName && String(x.inspector||'').trim().toLowerCase()===myName) x.mine=true; });
  list.sort(function(a,b){ return String(b.submittedAt||'').localeCompare(String(a.submittedAt||'')); });
  return list;
}
function recentFiltered(){ var l=recentList(); return S.recentFilter==='mine'? l.filter(function(x){ return x.mine; }) : l; }
function recById(id){ return recentList().find(function(x){ return x.id===id; }); }

var saveTimer=null;
function persist(now){
  if(!S.draft) return Promise.resolve();
  S.draft.updatedAt=nowIso();
  clearTimeout(saveTimer);
  Backup.schedule(); upStats();
  if(now) return DB.put('drafts',clone(S.draft));
  saveTimer=setTimeout(function(){ DB.put('drafts',clone(S.draft)); },300);
  return Promise.resolve();
}

/* ================= Online backup =================
   A few seconds after a change (while there is signal), everything about the inspection except the photo files
   (which upload on their own) is saved to its Drive folder. If this device loses its copy, the inspection can be
   reopened from "In progress" on any device. Edits of submitted inspections aren't backed up: the submitted copy is safe. */
function hasContent(d){ return !!d.overallNotes || d.areas.some(function(a){ return a.notes || a.photos.length || a.items.some(function(i){ return i.status || i.note || i.photos.length; }); }); }
function backupPayload(d){ var p=payloadOf(d); delete p.submittedAt; delete p.keepPhotoIds; delete p.edit; p.storage=storageCode(); p.device=deviceCode(); return p; }
/* A short code for this phone (from its browser details), to tell this phone's online copies from other devices' */
function deviceCode(){ var s=String(navigator.userAgent||''), h=0; for(var i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return (h>>>0).toString(36).toUpperCase(); }
/* A short code for where this phone keeps the app's data (Google serves the app from its own web address, and the
   phone's storage belongs to that address). If it changes, data saved under the old one can't be seen any more. */
function storageCode(){ var s=String(location.hostname||''), h=0; for(var i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))|0; return s? (h>>>0).toString(36).toUpperCase() : ''; }
function backupSig(d){ var p=backupPayload(d); return JSON.stringify([p.areas,p.overallNotes]); }
function backupWanted(d){ return !!d && !d.edit && HAS_GAS && !d.backupGone && hasContent(d); }
/* What on this inspection hasn't reached Google yet ('' when everything has) */
function unsaved(d){
  if(!d) return '';
  var c=upCounts(d), n=c.total-c.up, t=[];
  if(n>0) t.push(n+' photo'+(n===1?'':'s')+' not uploaded');
  if(backupWanted(d) && d.backupSig!==backupSig(d)) t.push(d.backupAt?'latest changes not backed up':'not backed up yet');
  return t.join(' · ');
}
var Backup = {
  timer:null, busy:null, failed:false,
  /* at most a few seconds after the first unsaved change, even while changes keep coming */
  schedule:function(ms){
    if(Backup.timer && ms==null) return;
    clearTimeout(Backup.timer);
    Backup.timer=setTimeout(function(){ Backup.timer=null; Backup.run(S.draft); }, ms==null?6000:ms);
  },
  run:function(d){
    if(!d || d.edit || !HAS_GAS || !navigator.onLine || d.backupGone || !hasContent(d)) return Promise.resolve(false);
    if(Backup.busy) return Backup.busy.then(function(){ return Backup.run(d); });
    var p=backupPayload(d), sig=backupSig(d);
    if(d.backupSig===sig) return Promise.resolve(true);
    Backup.busy=ensureFolder(d).then(function(){ p.folder=d.folder; return api.backup(p); }).then(function(r){
      Backup.busy=null; Backup.failed=false;
      if(r && (r.gone || r.submitted)) d.backupGone=true;
      else { d.backupSig=sig; d.backupAt=(r&&r.savedAt)||nowIso(); }
      upStats();
      // only if it's still on this device (it may have been submitted or deleted meanwhile)
      return DB.get('drafts',d.id).then(function(cur){ if(cur) return DB.put('drafts',clone(d)); }).then(function(){ return true; });
    }, function(){ Backup.busy=null; Backup.failed=true; upStats(); Backup.schedule(30000); return false; });
    return Backup.busy;
  },
  /* every inspection on this device (e.g. before an update, or on the home screen) */
  all:function(){
    return DB.all('drafts').then(function(list){
      var chain=Promise.resolve();
      (list||[]).forEach(function(x){ chain=chain.then(function(){ return Backup.run(S.draft && S.draft.id===x.id ? S.draft : x); }); });
      return chain;
    }).catch(function(){});
  }
};

function go(view,arg,replace){ if(!replace && S.cur) S.stack.push(S.cur); S.cur={view:view,arg:arg}; render(); window.scrollTo(0,0); }
function back(){
  // Backing out of an edit you never changed shouldn't leave it sitting under "In progress"
  var d=S.draft;
  if(S.cur.view==='inspect' && d && d.edit){
    if(!editChanged(d)){ dropEditDraft(d).then(function(){ S.stack=[]; S.cur={view:'home'}; render(); window.scrollTo(0,0); }); return; }
    toast('Your changes are kept under “In progress” — open it to save or cancel.',4000);
  }
  var p=S.stack.pop(); if(!p){ S.cur={view:'home'}; } else S.cur=p; render(); window.scrollTo(0,0); }
function home(){ S.stack=[]; S.cur={view:'home'}; render(); window.scrollTo(0,0); }

function setFooter(html){ var f=$('#footer'); if(html){ $('#footerIn').innerHTML=html; f.classList.remove('hidden'); } else f.classList.add('hidden'); }
function setTitle(t){ $('#title').textContent=t; $('#backBtn').classList.toggle('hidden', S.cur.view==='home'); }

function render(){
  var v=S.cur.view, fn=VIEWS[v]; setFooter(null);
  Promise.resolve(fn(S.cur.arg)).catch(function(e){ $('#app').innerHTML='<div class="card">Something went wrong: '+esc(e.message)+'</div>'; });
}

/* ================= Draft helpers ================= */
function newDraft(prop, meta){
  return {
    id: uid('INS'), propertyId: prop.id, propertyName: prop.name, address: prop.address||'',
    propertyNotes: prop.notes||'', type: meta.type, inspector: meta.inspector, tenant: meta.tenant,
    startedAt: nowIso(), updatedAt: nowIso(), overallNotes:'', overallNotesAt:null, folder:null,
    areas: prop.areas.map(function(a){ return {
      id:a.id||uid('A'), name:a.name, type:a.type, guidance:a.notes||'', notes:'', notesAt:null, photos:[],
      items:(a.items||[]).filter(Boolean).map(function(l){ return {id:uid('I'),label:l,status:null,statusAt:null,note:'',noteAt:null,photos:[]}; })
    }; })
  };
}
function stats(d){
  var t=0,done=0,iss=0,ph=0;
  d.areas.forEach(function(a){ ph+=a.photos.length; a.items.forEach(function(i){ t++; if(i.status) done++; if(ISSUE[i.status]) iss++; ph+=i.photos.length; }); });
  return {total:t,done:done,issues:iss,photos:ph,pct:t?Math.round(done*100/t):0};
}
function tenantCount(d){ var n=0; d.areas.forEach(function(a){ a.items.forEach(function(i){ if(ISSUE[i.status] && i.action==='tenant') n++; }); }); return n; }
function noAction(d){ var n=0; d.areas.forEach(function(a){ a.items.forEach(function(i){ if(ISSUE[i.status] && !i.action) n++; }); }); return n; }
function areaStats(a){ var d=0,i=0,p=a.photos.length; a.items.forEach(function(x){ if(x.status) d++; if(ISSUE[x.status]) i++; p+=x.photos.length; }); return {done:d,total:a.items.length,issues:i,photos:p}; }
function target(ai,ti){ var a=S.draft.areas[ai]; return (ti===''||ti==null||ti<0)? a : a.items[ti]; }

/* ================= Photo capture ================= */
var pendingPhoto=null;
function loadImage(file){
  function viaImg(){ return new Promise(function(res,rej){ var u=URL.createObjectURL(file), i=new Image(); i.onload=function(){ res(i); }; i.onerror=function(){ rej(new Error('Could not read image')); }; i.src=u; }); }
  if(window.createImageBitmap) return createImageBitmap(file,{imageOrientation:'from-image'}).catch(viaImg);
  return viaImg();
}
function draw(img,max,stamp){
  var w=img.width,h=img.height,s=Math.min(1,max/Math.max(w,h)),c=document.createElement('canvas');
  c.width=Math.round(w*s); c.height=Math.round(h*s);
  var x=c.getContext('2d'); x.drawImage(img,0,0,c.width,c.height);
  if(stamp){
    var fs=Math.max(14,Math.round(c.width/48)), pad=Math.round(fs*.5), lh=Math.round(fs*1.3);
    x.font='600 '+fs+'px system-ui, sans-serif';
    var bw=Math.max.apply(null,stamp.map(function(l){return x.measureText(l).width;}))+pad*2, bh=lh*stamp.length+pad;
    x.fillStyle='rgba(0,0,0,0.55)'; x.fillRect(0,c.height-bh,Math.min(bw,c.width),bh);
    x.fillStyle='#ffffff'; stamp.forEach(function(l,i){ x.fillText(l,pad,c.height-bh+pad/2+lh*(i+1)-Math.round(fs*.3)); });
  }
  return c;
}
function handleFiles(files){
  if(!pendingPhoto||!files||!files.length) return;
  var p=pendingPhoto, d=S.draft, a=d.areas[p.ai], tgt=target(p.ai,p.ti);
  var label=(p.ti===''||p.ti==null)? a.name : a.name+' – '+tgt.label;
  toast('Processing photo…',1500);
  var chain=Promise.resolve();
  [].slice.call(files).forEach(function(f){
    chain=chain.then(function(){
      return loadImage(f).then(function(img){
        var taken=nowIso();
        var stamp=[fmt(taken)+'  •  '+d.propertyName, label];
        var full=draw(img,1600,stamp).toDataURL('image/jpeg',0.78);
        var thumb=draw(img,260,null).toDataURL('image/jpeg',0.6);
        var id=uid('PH');
        return DB.put('photos',{id:id,data:full}).then(function(){
          tgt.photos.push({id:id,thumb:thumb,takenAt:taken,caption:'',uploaded:false,url:'',fileId:''});
        });
      });
    });
  });
  chain.then(function(){ persist(true); render(); toast('Photo saved'); Up.schedule(1200); }).catch(function(e){ toast('Photo failed: '+e.message); });
}

/* ================= Celebration & haptics ================= */
function buzz(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms||12); }catch(e){} }
function confetti(){
  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var cols=['#7c3aed','#06b6d4','#f43f5e','#f59e0b','#10b981','#ec4899','#3b82f6'], box=document.createElement('div'); box.className='confetti';
  for(var i=0;i<110;i++){ var c=document.createElement('i');
    c.style.cssText='inset-inline-start:'+(Math.random()*100)+'%;background:'+cols[i%cols.length]+';animation-delay:'+(Math.random()*0.6)+'s;animation-duration:'+(2+Math.random()*1.8)+'s;--dx:'+((Math.random()-.5)*240)+'px;--rot:'+(Math.random()*1080-540)+'deg;border-radius:'+(i%3?'3px':'50%');
    box.appendChild(c); }
  document.body.appendChild(box); buzz([30,40,60]); setTimeout(function(){ box.remove(); },5000);
}

/* ================= Email report ================= */
function validEmails(v){ return String(v||'').split(/[,;\s]+/).map(function(x){return x.trim();}).filter(Boolean); }
function badEmails(list){ return list.filter(function(x){ return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x); }); }
function emailDialog(rec){
  var m=document.createElement('div'); m.className='modal';
  m.innerHTML='<div class="box"><div class="title" style="font-size:1.15rem;margin-block-end:4px">✉ Email full report</div>'+
    '<div class="small muted" style="margin-block-end:14px">'+esc(rec.propertyName||'')+' · '+esc(rec.type||'')+'</div>'+
    '<label class="fld"><span>To (separate several with commas)</span><input type="text" id="emTo" inputmode="email" autocomplete="email" value="'+esc(localStorage.getItem('fi-email-to')||'')+'" placeholder="landlord@example.com"></label>'+
    '<label class="fld"><span>CC (optional)</span><input type="text" id="emCc" inputmode="email" value="'+esc(localStorage.getItem('fi-email-cc')||'')+'"></label>'+
    '<label class="fld"><span>Message (optional)</span><textarea id="emMsg" placeholder="Hi, please find the inspection report below…"></textarea></label>'+
    '<div id="emStatus"></div>'+
    '<div class="row" style="justify-content:flex-end;margin-block-start:6px"><button class="btn" type="button" data-em="cancel">Cancel</button><button class="btn primary" type="button" data-em="send">Send email</button></div></div>';
  document.body.appendChild(m); setTimeout(function(){ $('#emTo',m).focus(); },60);
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-em]'); if(!b) return;
    if(b.getAttribute('data-em')==='cancel'){ m.remove(); return; }
    var to=validEmails($('#emTo',m).value), cc=validEmails($('#emCc',m).value), bad=badEmails(to.concat(cc)), st=$('#emStatus',m);
    if(!to.length){ st.innerHTML='<div class="small" style="color:var(--bad);margin-block-end:8px">Enter at least one email address.</div>'; return; }
    if(bad.length){ st.innerHTML='<div class="small" style="color:var(--bad);margin-block-end:8px">Check these addresses: '+esc(bad.join(', '))+'</div>'; return; }
    if(!navigator.onLine){ st.innerHTML='<div class="small" style="color:var(--bad);margin-block-end:8px">You are offline — try again when you have signal.</div>'; return; }
    b.disabled=true; st.innerHTML='<div class="row small" style="margin-block-end:8px"><span class="spin"></span><span>Building and sending the email…</span></div>';
    localStorage.setItem('fi-email-to',to.join(', ')); localStorage.setItem('fi-email-cc',cc.join(', '));
    api.emailReport({inspectionId:rec.id||'',folderUrl:rec.folderUrl||'',reportUrl:rec.reportUrl||'',to:to.join(','),cc:cc.join(','),message:$('#emMsg',m).value.trim()}).then(function(r){
      m.remove(); toast('✉ Report emailed to '+to.join(', '),4000); buzz(20);
      if(r && r.inspectionId && !rec.id){ rec.id=r.inspectionId; S.history.forEach(function(x){ if(x.folderUrl&&x.folderUrl===rec.folderUrl) x.id=r.inspectionId; }); try{ localStorage.setItem('fi-history',JSON.stringify(S.history)); }catch(e){} }
      if(r && r.notes && r.notes.length) setTimeout(function(){ toast(r.notes.join(' '),6000); },4200);
    }).catch(function(err){ b.disabled=false; st.innerHTML='<div class="small" style="color:var(--bad);margin-block-end:8px">Couldn’t send: '+esc(err.message)+'</div>'; });
  });
}
/* Emails the tenant only the issues marked "Tenant to action" (no Drive links or photos) */
/* The tenant email exactly as it will arrive, built by the server (nothing is sent). Closes back to the editor. */
function emailPreview(r){
  var v=document.createElement('div'); v.className='modal tallm';
  v.innerHTML='<div class="box tall epv"><div class="row" style="align-items:center;margin-block-end:10px"><div class="title grow" style="font-size:1.15rem">👁 Preview</div><button class="btn sm" type="button" data-pv="close">Back to editing</button></div>'+
    '<div class="small" style="margin-block-end:4px"><span class="muted">To:</span> '+esc((r.to||[]).join(', ')||'(no one chosen yet)')+'</div>'+
    ((r.cc||[]).length?'<div class="small" style="margin-block-end:4px"><span class="muted">CC:</span> '+esc(r.cc.join(', '))+'</div>':'')+
    '<div class="small" style="margin-block-end:10px"><span class="muted">Subject:</span> <b>'+esc(r.subject||'')+'</b></div><iframe title="Email preview"></iframe></div>';
  document.body.appendChild(v);
  var f=v.querySelector('iframe');
  f.addEventListener('load',function(){ try{ f.style.height=(f.contentDocument.documentElement.scrollHeight+4)+'px'; }catch(e){ f.style.height='70vh'; } });
  f.srcdoc='<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0">'+(r.html||'')+'</body></html>';
  v.addEventListener('click',function(e){ if(e.target.closest('[data-pv=close]')) v.remove(); });
}
function tenantEmailDialog(rec){
  /* The tenant email, prepared on the server, then reviewed and edited here before it's sent:
     who it goes to (the property's tenants, ticked for current ones), subject, greeting, wording, which items, sign-off. */
  var key='fi-tenant-to-'+(rec.propertyName||'');
  var m=document.createElement('div'); m.className='modal tallm';
  m.innerHTML='<div class="box tall"><div class="title" style="font-size:1.15rem">✉ Email tenant issues</div><div class="row small" style="margin-block-start:12px"><span class="spin"></span><span>Preparing the email…</span></div></div>';
  document.body.appendChild(m);
  m.addEventListener('click',function(e){ if(e.target.closest('[data-te=cancel]')) m.remove(); });   // only Cancel closes it, so a stray tap can't lose edits
  if(HAS_GAS && !navigator.onLine){ $('.box',m).innerHTML='<div class="title">✉ Email tenant issues</div><div class="small" style="margin-block:10px 14px">You are offline. Preparing and sending the email needs signal.</div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-te="cancel">Close</button></div>'; return; }
  api.prepareTenantIssues({inspectionId:rec.id||''}).then(function(dr){ draw(dr); }, function(x){
    $('.box',m).innerHTML='<div class="title">✉ Email tenant issues</div><div class="small" style="color:var(--bad);margin-block:10px 14px">Couldn’t prepare the email: '+esc(x.message)+'</div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-te="cancel">Close</button></div>';
  });
  function draw(dr){
    var tenants=dr.tenants||[], greetEdited=false;
    var others=validEmails(localStorage.getItem(key)||'').filter(function(e){ return !tenants.some(function(t){ return t.email.toLowerCase()===e.toLowerCase(); }); });
    var h='<div class="title" style="font-size:1.15rem">✉ Email tenant issues</div><div class="small muted" style="margin-block-end:12px">'+esc(dr.propertyName)+' · '+esc(dr.type)+' · '+esc(dr.date)+'</div>';
    h+='<div class="sasec small" style="font-weight:800;margin-block-end:6px">To</div>';
    if(tenants.length) h+=tenants.map(function(t,i){ var who=t.name+(t.knownAs&&t.knownAs!==t.name?' ('+t.knownAs+')':'');
      return '<label class="row small" style="gap:10px;padding:8px 10px;border:1.5px solid var(--line);border-radius:12px;margin-block-end:6px;'+(t.email?'cursor:pointer':'opacity:.55')+'">'+
        '<input type="checkbox" data-tt="'+i+'"'+(t.current&&t.email?' checked':'')+(t.email?'':' disabled')+'><span class="grow"><b>'+esc(who||t.email)+'</b><br><span class="muted">'+esc(t.email||'No email on file')+' · '+esc(t.note||'')+'</span></span></label>'; }).join('');
    else h+='<div class="small muted" style="margin-block-end:6px">No tenants are recorded for this property'+(HAS_GAS&&!window.RENTALS_CONFIG?' (the Rentals app lists them)':'')+'. Enter their email below.</div>';
    h+='<label class="fld"><span>'+(tenants.length?'Other email addresses (optional)':'Tenant email (separate several with commas)')+'</span><input type="text" id="teTo" inputmode="email" autocomplete="off" value="'+esc(others.join(', '))+'" placeholder="tenant@example.com"></label>'+
      '<label class="fld"><span>CC (optional)</span><input type="text" id="teCc" inputmode="email" value="'+esc(localStorage.getItem('fi-email-cc')||'')+'"></label>';
    h+='<div class="sasec small" style="font-weight:800;margin-block:6px">The email</div>'+
      '<label class="fld"><span>Subject</span><input type="text" id="teSubj" value="'+esc(dr.subject)+'"></label>'+
      '<label class="fld"><span>Greeting</span><input type="text" id="teGreet" value=""></label>'+
      '<label class="fld"><span>Opening</span><textarea id="teOpen" rows="3">'+esc(dr.opening)+'</textarea></label>'+
      '<div class="small" style="font-weight:800;margin-block:4px 6px">Items for them to action</div>'+
      dr.items.map(function(it,i){ return '<label class="row small" style="gap:10px;align-items:flex-start;padding:6px 0;border-block-end:1px solid var(--line);cursor:pointer"><input type="checkbox" data-ti="'+i+'" checked style="margin-block-start:3px">'+
        '<span class="grow"><b>'+esc(it.area)+'</b> — '+esc(it.item)+' · <span class="muted">'+esc(it.issue)+'</span>'+(it.note?'<span class="tnote muted" style="display:none"><br>'+esc(it.note)+'</span>':'')+'</span></label>'; }).join('')+
      (dr.items.some(function(it){ return it.note; })?'<label class="row small" style="gap:8px;margin-block:8px 4px"><input type="checkbox" id="teNotes"> Include the inspector’s notes for each item</label>':'')+
      '<label class="fld" style="margin-block-start:10px"><span>Closing</span><textarea id="teClose" rows="3">'+esc(dr.closing)+'</textarea></label>'+
      '<label class="fld"><span>Signed (after “Kind regards,”)</span><input type="text" id="teSign" value="'+esc(dr.signoff)+'"></label>';
    h+='<div class="small muted" style="margin-block-end:10px">The inspection summary (property, address, date, type and inspector) is added above the items. No photos or Drive links are shared.</div>'+
      '<div id="teStatus"></div><div class="row" style="justify-content:flex-end;gap:8px;position:sticky;bottom:0;background:var(--surface);padding-block:10px 4px"><button class="btn" type="button" data-te="cancel">Cancel</button><button class="btn" type="button" data-te="preview">👁 Preview</button><button class="btn primary" type="button" data-te="send">Send</button></div>';
    $('.box',m).innerHTML=h;
    /* Greeting follows the ticked tenants' first names (preferred names first) until it's typed over */
    function greet(){
      if(greetEdited) return;
      var names=tenants.filter(function(t,i){ var c=m.querySelector('[data-tt="'+i+'"]'); return c&&c.checked; }).map(function(t){ return String(t.knownAs||t.name||'').trim().split(/\s+/)[0]; }).filter(Boolean);
      $('#teGreet',m).value=names.length?'Hi '+(names.length<2?names[0]:names.slice(0,-1).join(', ')+' and '+names[names.length-1])+',':'Hello,';
    }
    greet();
    m.addEventListener('input',function(e){ if(e.target.id==='teGreet') greetEdited=true; });
    m.addEventListener('change',function(e){
      if(e.target.hasAttribute('data-tt')) greet();
      if(e.target.id==='teNotes') Array.prototype.forEach.call(m.querySelectorAll('.tnote'),function(n){ n.style.display=e.target.checked?'':'none'; });
    });
    /* what's in the form now, as the server wants it (the same for Preview and Send) */
    function payload(){
      var picked=tenants.filter(function(t,i){ var c=m.querySelector('[data-tt="'+i+'"]'); return c&&c.checked&&t.email; }).map(function(t){ return t.email; });
      var extra=validEmails($('#teTo',m).value), cc=validEmails($('#teCc',m).value), notes=$('#teNotes',m), items=[];
      Array.prototype.forEach.call(m.querySelectorAll('[data-ti]'),function(c){ if(c.checked) items.push(+c.getAttribute('data-ti')); });
      return {extra:extra, to:picked.concat(extra), cc:cc, bad:badEmails(extra.concat(cc)),
        req:{inspectionId:rec.id||'',to:picked.concat(extra).join(','),cc:cc.join(','),includeNotes:!!(notes&&notes.checked),items:items,
          subject:$('#teSubj',m).value,greeting:$('#teGreet',m).value,opening:$('#teOpen',m).value,closing:$('#teClose',m).value,signoff:$('#teSign',m).value}};
    }
    m.addEventListener('click',function(e){
      var b=e.target.closest('[data-te=send],[data-te=preview]'); if(!b) return;
      var st=$('#teStatus',m); function err(t){ st.innerHTML='<div class="small" style="color:var(--bad);margin-block-end:8px">'+t+'</div>'; }
      var P=payload();
      if(P.bad.length) return err('Check these addresses: '+esc(P.bad.join(', ')));
      if(!P.req.items.length) return err('Choose at least one item to include.');
      if(HAS_GAS && !navigator.onLine) return err('You are offline — try again when you have signal.');
      if(b.getAttribute('data-te')==='preview'){
        b.disabled=true; st.innerHTML='<div class="row small" style="margin-block-end:8px"><span class="spin"></span><span>Building the preview…</span></div>';
        api.previewTenantIssues(P.req).then(function(r){ b.disabled=false; st.innerHTML=''; emailPreview(r); }, function(x){ b.disabled=false; err('Couldn’t build the preview: '+esc(x.message)); });
        return;
      }
      if(!P.to.length) return err('Choose a tenant or enter an email address.');
      b.disabled=true; st.innerHTML='<div class="row small" style="margin-block-end:8px"><span class="spin"></span><span>Sending…</span></div>';
      try{ localStorage.setItem(key,P.extra.join(', ')); if(P.cc.length) localStorage.setItem('fi-email-cc',P.cc.join(', ')); }catch(x){}
      api.emailTenantIssues(P.req).then(function(r){
        var n=(r&&r.items)||P.req.items.length;
        m.remove(); toast('✉ '+n+' tenant item'+(n===1?'':'s')+' emailed to '+P.to.join(', '),4000); buzz(20);
      }).catch(function(x){ b.disabled=false; err('Couldn’t send: '+esc(x.message)); });
    });
  }
}

/* ================= Delete a submitted inspection (admin) ================= */
function deleteInspDialog(rec){
  var m=document.createElement('div'); m.className='modal';
  m.innerHTML='<div class="box"><div class="title" style="font-size:1.15rem;margin-block-end:4px">🗑 Delete inspection?</div>'+
    '<div class="small" style="margin-block-end:4px"><b>'+esc(rec.propertyName||'')+'</b> · '+esc(rec.type||'')+' · '+esc(fmt(rec.submittedAt))+'</div>'+
    '<div class="small muted" style="margin-block-end:14px">This removes it for everyone: its rows are deleted from the Sheet, and its Drive folder (photos and report) moves to the Drive bin, where it can be restored for 30 days.</div>'+
    '<label class="fld"><span>Admin PIN</span><input type="password" id="delPin" inputmode="numeric" autocomplete="off" value="'+esc(S.pin||'')+'"></label>'+
    '<div id="delErr" class="small" style="color:var(--bad);margin-block-end:8px"></div>'+
    '<div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-dl="cancel">Cancel</button><button class="btn danger" type="button" data-dl="go">Delete</button></div></div>';
  document.body.appendChild(m); setTimeout(function(){ var p=$('#delPin',m); if(!p.value) p.focus(); },60);
  m.addEventListener('click',function(ev){
    var b=ev.target.closest('[data-dl]'); if(!b) return;
    if(b.getAttribute('data-dl')==='cancel'){ m.remove(); return; }
    var pin=$('#delPin',m).value.trim(), err=$('#delErr',m);
    if(!pin){ err.textContent='Enter the admin PIN.'; return; }
    if(HAS_GAS && !navigator.onLine){ err.textContent='You are offline — try again when you have signal.'; return; }
    b.disabled=true; b.textContent='Deleting…'; err.textContent='';
    api.deleteInspection(pin,{id:rec.id||'',folderUrl:rec.folderUrl||'',reportUrl:rec.reportUrl||''}).then(function(r){
      changedHere(); S.pin=pin; try{ localStorage.setItem('fi-admin-seen','1'); }catch(e){}
      var id=(r&&r.inspectionId)||rec.id;
      function keep(x){ return !((id && x.id===id) || (rec.folderUrl && x.folderUrl===rec.folderUrl)); }
      S.history=S.history.filter(keep); try{ localStorage.setItem('fi-history',JSON.stringify(S.history)); }catch(e){}
      if(S.recent){ S.recent=S.recent.filter(keep); saveRecent(); }
      if(r && r.propertyId) try{ localStorage.removeItem('fi-prior-'+r.propertyId); }catch(e){}
      m.remove(); viewCacheDrop(id); if(S.cur.view==='viewInsp'||S.cur.view==='viewArea'){ S.stack=[]; S.cur={view:'home'}; S.tab='submitted'; } render(); toast('🗑 Inspection deleted',3000); buzz(20);
    }).catch(function(e2){ b.disabled=false; b.textContent='Delete'; err.textContent=e2.message; });
  });
}

/* ================= Edit a submitted inspection (admin) ================= */
/* Asks for the admin PIN. run(pin) does the work and returns a promise; a rejection shows its message in the dialog. */
function pinDialog(o){
  var m=document.createElement('div'); m.className='modal';
  m.innerHTML='<div class="box"><div class="title" style="font-size:1.15rem;margin-block-end:4px">'+esc(o.title)+'</div>'+
    (o.sub?'<div class="small" style="margin-block-end:4px">'+o.sub+'</div>':'')+
    '<div class="small muted" style="margin-block-end:14px">'+esc(o.msg||'')+'</div>'+
    '<label class="fld"><span>Admin PIN</span><input type="password" id="edPin" inputmode="numeric" autocomplete="off" value="'+esc(S.pin||'')+'"></label>'+
    '<div id="edErr" class="small" style="color:var(--bad);margin-block-end:8px"></div>'+
    '<div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-pd="cancel">Cancel</button><button class="btn primary" type="button" data-pd="go">'+esc(o.ok||'Continue')+'</button></div></div>';
  document.body.appendChild(m); setTimeout(function(){ var p=$('#edPin',m); if(!p.value) p.focus(); },60);
  m.addEventListener('click',function(ev){
    var b=ev.target.closest('[data-pd]'); if(!b) return;
    if(b.getAttribute('data-pd')==='cancel'){ m.remove(); return; }
    var pin=$('#edPin',m).value.trim(), err=$('#edErr',m), label=b.textContent;
    if(!pin){ err.textContent='Enter the admin PIN.'; return; }
    if(HAS_GAS && !navigator.onLine){ err.textContent='You are offline — try again when you have signal.'; return; }
    b.disabled=true; b.textContent=o.busy||'Working…'; err.textContent='';
    Promise.resolve(o.run(pin)).then(function(){ S.pin=pin; try{ localStorage.setItem('fi-admin-seen','1'); }catch(e){} m.remove(); if(o.after) o.after(); })
      .catch(function(e){ b.disabled=false; b.textContent=label; err.textContent=e.message; });
  });
}
var PHOTO_PLACEHOLDER=window.PHOTO_PLACEHOLDER='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#e6e3f5"/><text x="40" y="50" font-size="30" text-anchor="middle">📷</text></svg>');
function driveThumb(fileId){ return fileId? 'https://drive.google.com/thumbnail?id='+encodeURIComponent(fileId)+'&sz=w400' : PHOTO_PLACEHOLDER; }
/* Turns what openInspectionForEdit returns into a normal draft. Existing photos are marked `existing`:
   they're already in Drive, and removing one only takes effect when the edit is saved. */
function editDraft(r){ var d=serverDraft(r); d.edit={submittedAt:r.submittedAt}; return d; }
function serverDraft(r){
  var prop=S.props.find(function(x){ return x.id===r.propertyId; });
  function guide(n){ var a=prop&&prop.areas.find(function(x){ return x.name===n; }); return a? a.notes||'' : ''; }
  function ph(p){ return {id:p.id,thumb:driveThumb(p.fileId),takenAt:p.takenAt,caption:p.caption||'',uploaded:true,existing:true,url:p.url||'',fileId:p.fileId||''}; }
  return {
    id:r.id, propertyId:r.propertyId, propertyName:r.propertyName, address:r.address||'',
    propertyNotes:prop?prop.notes||'':'', type:r.type, inspector:r.inspector, tenant:r.tenant,
    startedAt:r.startedAt, updatedAt:nowIso(), overallNotes:r.overallNotes||'', overallNotesAt:r.overallNotesAt||null, folder:r.folder,
    areas:(r.areas||[]).map(function(a){ return {
      id:uid('A'), name:a.name, type:a.type||'Custom', guidance:guide(a.name), notes:a.notes||'', notesAt:a.notesAt||null, photos:(a.photos||[]).map(ph),
      items:(a.items||[]).map(function(it){ return {id:uid('I'),label:it.label,status:it.status||null,statusAt:it.statusAt||null,note:it.note||'',noteAt:it.noteAt||null,
        action:it.action||null,actionAt:it.actionAt||null,photos:(it.photos||[]).map(ph)}; })
    }; })
  };
}
/* Snapshot of everything an edit can change, so we can tell whether anything was actually changed */
function editPrint(d){ var p=payloadOf(d); return JSON.stringify([p.areas,p.overallNotes,p.keepPhotoIds]); }
function editChanged(d){ return !d.edit || !d.edit.base || editPrint(d)!==d.edit.base; }
/* Throws away an edit draft. The submitted inspection is untouched; only photos added during the edit come out of Drive. */
function dropEditDraft(x){
  allPhotos(x).forEach(function(y){
    DB.del('photos',y.p.id);
    if(y.p.uploaded && !y.p.existing && !y.p.missing) api.deletePhoto({inspectionId:x.id,photoId:y.p.id}).catch(function(){});
  });
  (x.pendingDeletes||[]).forEach(function(pid){ api.deletePhoto({inspectionId:x.id,photoId:pid}).catch(function(){}); });
  clearTimeout(saveTimer);
  if(S.draft && S.draft.id===x.id) S.draft=null;
  return DB.del('drafts',x.id);
}
function editInspDialog(rec){
  // Already editing this one on this device? Carry on where you left off.
  DB.get('drafts',rec.id).then(function(x){
    if(x && x.edit){ S.draft=x; S.stack=[{view:'home'}]; S.cur={view:'inspect'}; render(); Up.schedule(500); return; }
    pinDialog({title:'✎ Edit submitted inspection',
      sub:'<b>'+esc(rec.propertyName||'')+'</b> · '+esc(rec.type||'')+' · '+esc(fmt(rec.submittedAt)),
      msg:'You can change statuses, notes and photos, then save. The report is rebuilt and the edit is recorded in the EditLog tab.',
      ok:'Open for editing', busy:'Opening…',
      run:function(pin){ return api.openForEdit(pin,{id:rec.id}).then(function(r){
        S.draft=editDraft(r); S.draft.edit.base=editPrint(S.draft);
        return persist(true).then(function(){ S.stack=[{view:'home'}]; S.cur={view:'inspect'}; render(); });
      }); }});
  });
}

/* ================= Reopen an in-progress inspection from its online copy ================= */
function remoteInProgress(localIds){
  var q=[]; try{ q=JSON.parse(localStorage.getItem('fi-discards')||'[]'); }catch(e){}
  return (S.inProgress||[]).filter(function(x){ return !localIds[x.id] && q.indexOf(x.id)<0; });
}
/* Saved online by this Google account (last backup, else whoever started it): it's yours, so no need to ask */
function sameUser(a,b){ return !!a && !!b && String(a).trim().toLowerCase()===String(b).trim().toLowerCase(); }
function recMine(rec){ return sameUser(rec.savedBy||rec.startedBy,S.me); }
function onlineDraft(r){
  var d=serverDraft(r); d.recoveredAt=nowIso();
  if(r.backupAt){ d.backupAt=r.backupAt; d.backupSig=backupSig(d); }
  attachPrior(d,priorCacheGet(d.propertyId));
  return d;
}
/* Some phones clear the app's data whenever the app is closed. This phone's own in-progress inspections (last saved
   online by this account from this phone) are then brought back from their online copy without asking. */
var autoRestoring=false;
function autoRestore(){
  if(autoRestoring || !HAS_GAS || !navigator.onLine) return Promise.resolve(0);
  return DB.all('drafts').then(function(list){
    var local={}; (list||[]).forEach(function(d){ local[d.id]=1; });
    var mine=remoteInProgress(local).filter(function(x){ return recMine(x) && x.savedDevice && x.savedDevice===deviceCode(); });
    if(!mine.length) return 0;
    autoRestoring=true;
    var n=0, chain=Promise.resolve();
    mine.forEach(function(x){ chain=chain.then(function(){
      return api.openInProgress(x.id).then(function(r){ var d=onlineDraft(r); return DB.put('drafts',clone(d)).then(function(){ n++; setInProgress((S.inProgress||[]).filter(function(y){ return y.id!==x.id; })); }); })
        .catch(function(e){ console.warn('Auto-restore failed for '+x.id,e); });
    }); });
    return chain.then(function(){ autoRestoring=false;
      if(n){ if(S.cur && S.cur.view==='home') render(); toast('\u2601 Your in-progress inspection'+(n>1?'s were':' was')+' restored from the online copy. This phone clears the app\u2019s data when it\u2019s closed, so keep signal on until your photos upload.',8000); }
      return n; });
  }).catch(function(){ autoRestoring=false; return 0; });
}
function recoverInsp(id){
  var rec=(S.inProgress||[]).find(function(x){ return x.id===id; }); if(!rec) return;
  if(!HAS_GAS){ toast('Demo mode — nothing saved online'); return; }
  if(!navigator.onLine){ toast('You are offline — reopening needs signal.',4000); return; }
  var who=rec.savedBy||rec.inspector||rec.startedBy||'someone';
  (recMine(rec)? Promise.resolve(true) :
    ask('Open '+rec.propertyName+' ('+rec.type+', '+(rec.savedAt?'last saved '+fmt(rec.savedAt):'started '+fmt(rec.startedAt))+' by '+who+') on this device? If it is still open on their phone, carry on there instead, or the two copies will differ.',{ok:'Open it'})).then(function(ok){
    if(!ok) return;
    toast('Opening…',8000);
    return api.openInProgress(id).then(function(r){
      var d=onlineDraft(r);
      S.draft=d; setInProgress((S.inProgress||[]).filter(function(x){ return x.id!==id; }));
      if(!d.prior && navigator.onLine) fetchPrior(d.propertyId).then(function(pr){ if(attachPrior(d,pr)){ persist(true); if(S.draft===d) render(); } });
      return persist(true).then(function(){
        S.stack=[{view:'home'}]; S.cur={view:'inspect'}; render();
        var moved=r.backupStorage&&r.backupStorage!==storageCode();
        var msg=r.backupAt? 'Reopened from the online copy saved '+fmt(r.backupAt)+'.'+(moved?' This phone\u2019s own copy was saved before the app\u2019s storage changed (storage '+r.backupStorage+', now '+storageCode()+'), which is why it wasn\u2019t found.':'') :
          'Reopened with its '+r.photoCount+' uploaded photo'+(r.photoCount===1?'':'s')+'. Ticks and notes weren’t saved online for this one, so please check each item again.';
        if(r.missingPhotos) msg+=' '+r.missingPhotos+' photo'+(r.missingPhotos===1?' was':'s were')+' never uploaded and couldn’t be recovered.';
        toast(msg,9000);
      });
    });
  }).catch(function(e){ toast('Couldn’t open it: '+e.message,5000); });
}
function discardRemote(id){
  var rec=(S.inProgress||[]).find(function(x){ return x.id===id; }); if(!rec) return;
  ask('Delete '+rec.propertyName+' ('+rec.type+', started '+fmt(rec.startedAt)+') for everyone? Its uploaded photos move to the Drive bin.',{ok:'Delete'}).then(function(ok){
    if(!ok) return;
    if(!navigator.onLine){ toast('You are offline — try again when you have signal.'); return; }
    return api.discardInspection(id).then(function(){ changedHere(); setInProgress((S.inProgress||[]).filter(function(x){ return x.id!==id; })); render(); toast('🗑 Deleted'); });
  }).catch(function(e){ toast('Couldn’t delete: '+e.message,5000); });
}

/* ================= Self-update =================
   Home-screen apps can keep an old copy of the page. On load, when the app returns to the
   foreground, and every 30 minutes, ask the server which version is deployed. If it's newer,
   save everything and reload from the live link (or show a one-tap "Update" banner if the
   browser blocks the automatic reload). */
function cmpVer(a,b){ a=String(a||'0').split('.').map(Number); b=String(b||'0').split('.').map(Number);
  for(var i=0;i<Math.max(a.length,b.length);i++){ var x=a[i]||0,y=b[i]||0; if(x!==y) return x>y?1:-1; } return 0; }
var lastCheck=0;
/* manual = the user tapped the version line: always report the result and always offer the update */
function checkForUpdate(force,manual){
  if(!HAS_GAS){ if(manual) toast('Demo mode — nothing to update'); return; }
  if(!navigator.onLine){ if(manual) toast('You are offline — try again when you have signal'); return; }
  if(!force && Date.now()-lastCheck<60000) return; lastCheck=Date.now();
  if(manual) toast('Checking for updates…',1500);
  api.getVersion().then(function(r){
    if(!r || !r.version){ if(manual) toast('Couldn’t check for updates'); return; }
    S.serverVersion=r.version;
    // pageVersion = the version of the Index page the live deployment actually serves.
    var target=r.pageVersion||r.version, c=cmpVer(target,APP_VERSION);
    if(c<=0){
      hideUpdateBanner(); try{ sessionStorage.removeItem('fi-update-tried'); }catch(e){}
      if(cmpVer(r.version,APP_VERSION)!==0) showMismatch(r.version,target);
      if(manual) toast('You’re up to date — the live app is version '+target+'. If you’ve just changed the code, deploy it as a new version first.',6000);
      return;
    }
    if(manual){ try{ sessionStorage.removeItem('fi-update-asked'); sessionStorage.removeItem('fi-update-tried'); localStorage.removeItem('fi-update-snooze-'+target); }catch(e){} }
    var snooze=0; try{ snooze=+localStorage.getItem('fi-update-snooze-'+target)||0; }catch(e){}
    var busy=!!Up.running || !!$('#submitStatus .spin');
    var tried=''; try{ tried=sessionStorage.getItem('fi-update-tried')||''; }catch(e){}
    var url=(r.url||'')+(r.url&&r.url.indexOf('?')>=0?'&':'?')+'v='+encodeURIComponent(target)+'&t='+Date.now();
    // Google's app frame only lets the page reload itself from a real tap, so never reload
    // automatically (that is what caused the blank screen) — ask once, then fall back to the banner.
    if(!r.url) return;
    // In the middle of an inspection: wait until they're back on the home screen
    if(!manual && S.draft && S.cur && /^(inspect|area|review)$/.test(S.cur.view)) return;
    var asked=''; try{ asked=sessionStorage.getItem('fi-update-asked')||''; }catch(e){}
    if(busy || asked===target || tried===target || $('.modal')){ if(Date.now()>snooze) showUpdateBanner(target,url); return; }
    try{ sessionStorage.setItem('fi-update-asked',target); }catch(e){}
    persist(true); Backup.all().then(function(){ if(!$('.modal')) showUpdatePrompt(target,url); });
  }).catch(function(e){ if(manual) toast('Couldn’t check for updates: '+e.message,4000); });
}
function bannerEl(){
  var b=$('#updBanner'); if(!b){ b=document.createElement('div'); b.id='updBanner'; b.className='banner'; b.style.cssText='display:flex;align-items:center;gap:10px;background:var(--grad);position:relative;z-index:6'; document.body.insertBefore(b,$('main'));
    b.addEventListener('click',function(ev){
      var x=ev.target.closest('[data-upd]'); if(!x) return;
      var v=b.getAttribute('data-ver');
      if(x.getAttribute('data-upd')==='go'){ persist(true); x.textContent='Updating…'; try{ sessionStorage.setItem('fi-update-tried',v); }catch(e){} }
      else { try{ localStorage.setItem('fi-update-snooze-'+v,String(Date.now()+12*3600*1000)); }catch(e){} hideUpdateBanner(); }
    });
  }
  return b;
}
function showUpdateBanner(ver,url){
  var b=bannerEl(); b.setAttribute('data-ver',ver);
  b.innerHTML='<span style="flex:1">✨ Version '+esc(ver)+' is available.</span><a class="btn sm" data-upd="go" style="background:#fff;color:#4c1d95;border:0" target="_top" href="'+esc(url)+'">Update now</a>'+
    '<button type="button" class="icon-btn" data-upd="later" aria-label="Dismiss" style="font-size:1.1rem;width:32px;height:32px">✕</button>';
}
function showMismatch(backendVer,pageVer){
  if(!S.pin && !localStorage.getItem('fi-admin-seen')) { console.warn('Backend '+backendVer+' / page '+pageVer); return; }
  var b=bannerEl(); b.setAttribute('data-ver','mismatch-'+backendVer);
  var snooze=0; try{ snooze=+localStorage.getItem('fi-update-snooze-mismatch-'+backendVer)||0; }catch(e){} if(Date.now()<snooze) return;
  b.style.background='var(--grad-miss)';
  b.innerHTML='<span style="flex:1">⚠ Admin: the live deployment has backend '+esc(backendVer)+' but app page '+esc(pageVer)+'. Paste the latest Index file into Apps Script, then deploy a new version.</span>'+
    '<button type="button" class="icon-btn" data-upd="later" aria-label="Dismiss" style="font-size:1.1rem;width:32px;height:32px">✕</button>';
}
function showUpdatePrompt(ver,url){
  var m=document.createElement('div'); m.className='modal';
  m.innerHTML='<div class="box" style="text-align:center"><div style="font-size:2.6rem;line-height:1">✨</div>'+
    '<div class="title" style="font-size:1.2rem;margin-block:8px 4px">Update available</div>'+
    '<div class="small muted" style="margin-block-end:16px">Version '+esc(ver)+' is ready (you have '+esc(APP_VERSION)+'). Your in-progress inspections are saved on this device and backed up online.</div>'+
    '<div class="row" style="justify-content:center"><button class="btn" type="button" data-up="later">Later</button>'+
    '<a class="btn primary" data-up="go" target="_top" href="'+esc(url)+'">Update now</a></div></div>';
  document.body.appendChild(m);
  m.addEventListener('click',function(ev){
    var b=ev.target.closest('[data-up]'); if(!b) return;
    if(b.getAttribute('data-up')==='go'){ try{ sessionStorage.setItem('fi-update-tried',ver); }catch(e){} b.textContent='Updating…'; return; }  // let the link navigate
    m.remove(); showUpdateBanner(ver,url);
  });
}
function hideUpdateBanner(){ var b=$('#updBanner'); if(b) b.remove(); }

/* ================= Modal ================= */
function ask(msg,opts){
  opts=opts||{};
  return new Promise(function(res){
    var m=document.createElement('div'); m.className='modal';
    m.innerHTML='<div class="box"><div style="margin-block-end:12px">'+esc(msg)+'</div>'+
      (opts.input?'<input type="text" id="askIn" value="'+esc(opts.value||'')+'" placeholder="'+esc(opts.placeholder||'')+'">':'')+
      '<div class="row" style="margin-block-start:14px;justify-content:flex-end"><button class="btn" data-r="0" type="button">Cancel</button><button class="btn primary" data-r="1" type="button">'+esc(opts.ok||'OK')+'</button></div></div>';
    document.body.appendChild(m);
    var inp=$('#askIn',m); if(inp) setTimeout(function(){ inp.focus(); },50);
    m.addEventListener('click',function(e){ var b=e.target.closest('[data-r]'); if(!b) return; var ok=b.getAttribute('data-r')==='1'; var v=inp?inp.value.trim():true; m.remove(); res(ok?(inp?v:true):null); });
  });
}
function viewPhoto(id,thumb){
  var v=document.createElement('div'); v.className='viewer'; v.innerHTML='<img alt="Photo" src="'+thumb+'">'; document.body.appendChild(v);
  v.addEventListener('click',function(){ v.remove(); });
  DB.get('photos',id).then(function(p){ if(p&&p.data) $('img',v).src=p.data; });
}

/* ================= Prior inspection ("last time") ================= */
function priorCacheGet(pid){ try{ return JSON.parse(localStorage.getItem('fi-prior-'+pid)||'null'); }catch(e){ return null; } }
function priorCacheSet(pid,v){ try{ localStorage.setItem('fi-prior-'+pid,JSON.stringify(v||{none:true})); }catch(e){} }
function fetchPrior(pid){
  return api.getPrior(pid).then(function(pr){ priorCacheSet(pid,pr); return pr; }).catch(function(){ return priorCacheGet(pid); });
}
/* Items renamed since an earlier inspection: last time's result is found under the old name too */
var RENAMED_ITEMS={'Windows & glass':['Windows & glass – intact','Windows & glass - intact'],'Floor / carpet':['Floor / carpet – stains, damage','Floor / carpet - stains, damage'],'Skirting boards':['Skirting boards – clean','Skirting boards - clean']};
function priorItem(a,it){ var P=S.draft&&S.draft.prior; var p=P&&P.items? P.items[a.name+'|'+it.label] : null;
  if(!p && P && P.items) (RENAMED_ITEMS[it.label]||[]).some(function(old){ return (p=P.items[a.name+'|'+old]); });
  if(p && !p.isIssue && !p.note && (p.key==='ok'||p.key==='na')) return null;   // OK and N/A with no note: nothing to flag
  return p; }
function priorArea(a){ var P=S.draft&&S.draft.prior; return P&&P.areaNotes? P.areaNotes[a.name] : null; }
function priorAreaCount(a){ var n=0; a.items.forEach(function(it){ var p=priorItem(a,it); if(p&&p.isIssue) n++; }); return n; }
function priorDate(){ var P=S.draft&&S.draft.prior; if(!P) return ''; try{ return new Date(P.date||P.submittedAt).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return ''; } }
function priorLinks(list){ return (list||[]).map(function(p,i){ return '<a target="_blank" rel="noopener" href="'+esc(p.url)+'">📷 '+(i+1)+'</a>'; }).join(' '); }
function priorHtml(ai,ti,it){
  var a=S.draft.areas[ai], p=priorItem(a,it); if(!p) return '';
  var h='<div class="prior" data-ps="'+esc(p.key||'')+'">↺ <b>Last time</b> · '+esc(priorDate())+': <span class="pst">'+esc(STATUS_LABEL[p.key]||p.status||'—')+'</span>'+
    (p.action&&ACTION_LABEL[p.action]?' · '+esc(ACTION_LABEL[p.action]):'')+
    (p.note?' — “'+esc(p.note)+'”':'')+(p.photos&&p.photos.length?' · '+priorLinks(p.photos):'');
  if(p.isIssue && !it.status) h+='<div class="acts"><button type="button" data-act="prior-same" data-a="'+ai+'" data-t="'+ti+'">Still an issue</button><button type="button" data-act="prior-fixed" data-a="'+ai+'" data-t="'+ti+'">Now fixed ✓</button></div>';
  return h+'</div>';
}
function attachPrior(d,pr){
  if(!d || !pr || pr.none) return false;
  d.prior={inspectionId:pr.inspectionId,date:pr.date,submittedAt:pr.submittedAt,inspector:pr.inspector,type:pr.type,issues:pr.issues,reportUrl:pr.reportUrl,items:pr.items||{},areaNotes:pr.areaNotes||{}};
  return true;
}

/* ================= Views ================= */
var VIEWS = {};

VIEWS.home = function(){
  return DB.all('drafts').then(function(drafts){
    drafts=(drafts||[]).sort(function(a,b){ return (b.updatedAt||'').localeCompare(a.updatedAt||''); });
    var localIds={}; drafts.forEach(function(d){ localIds[d.id]=1; });
    var remote=remoteInProgress(localIds), nProg=drafts.length+remote.length;
    if(drafts.length) setTimeout(function(){ Backup.all(); checkForUpdate(); },500);
    if(!S.tab) S.tab=nProg?'progress':'new';
    setTitle({'new':'New inspection',progress:'In progress',submitted:'Submitted',setup:'Setup'}[S.tab]);
    var h= S.tab==='progress'? progressTabHtml(drafts,remote) : S.tab==='submitted'? submittedTabHtml() : S.tab==='setup'? setupTabHtml() : newTabHtml();
    $('#app').innerHTML=h;
    setFooter(tabBar(nProg));
  });
};
function tabBar(nProg){
  function b(id,ic,label,n){ return '<button type="button" data-act="tab" data-id="'+id+'" class="'+(S.tab===id?'on':'')+'"><span class="ic">'+ic+'</span>'+label+(n?'<span class="n">'+n+'</span>':'')+'</button>'; }
  return '<div class="tabbar">'+b('new','＋','New')+b('progress','⏳','In progress',nProg)+b('submitted','✅','Submitted')+b('setup','⚙','Setup')+'</div>';
}
function newTabHtml(){
  return '<input type="search" id="propSearch" placeholder="Search properties…" style="margin-block-end:10px"><div id="propList">'+propListHtml('')+'</div>';
}
function progressTabHtml(drafts,remote){
  var h='';
  remote.forEach(function(x){ var pct=x.total?Math.round(x.checked*100/x.total):0;
    h+='<div class="card"><div class="row"><div class="ring" style="--p:'+pct+'"><b>'+(x.total?pct+'%':'☁')+'</b></div><div class="grow tap" data-act="recover" data-id="'+esc(x.id)+'"><div class="title">'+esc(x.propertyName)+'</div>'+
      '<div style="margin-block-start:2px"><span class="pill">☁ Saved online'+(x.savedAt?' '+esc(new Date(x.savedAt).toLocaleTimeString('en-NZ',{hour:'numeric',minute:'2-digit'})):'')+(recMine(x)?' · you':x.inspector?' · '+esc(x.inspector):'')+'</span></div>'+
      '<div class="small muted">'+esc(x.type)+' · started '+esc(fmt(x.startedAt))+'</div>'+
      '<div class="small muted" style="margin-block-start:4px">'+(x.total?x.checked+'/'+x.total+' checked · '+x.issues+' issues · ':'')+x.photos+' photo'+(x.photos===1?'':'s')+' uploaded · tap to open</div></div>'+
      '<button class="btn sm danger" data-act="discard-remote" data-id="'+esc(x.id)+'" type="button">Delete</button></div></div>';
  });
  drafts.forEach(function(d){ var s=stats(d);
    h+='<div class="card"><div class="row"><div class="ring'+(s.pct===100?' full':'')+'" style="--p:'+s.pct+'"><b>'+s.pct+'%</b></div><div class="grow tap" data-act="resume" data-id="'+esc(d.id)+'"><div class="title">'+esc(d.propertyName)+'</div>'+
      (d.edit?'<div style="margin-block-start:2px"><span class="pill prior-pill">✎ Editing submitted inspection</span></div>':'')+
      '<div class="small muted">'+esc(d.type)+' · started '+esc(fmt(d.startedAt))+'</div>'+
      '<div class="progress" style="margin-block-start:8px"><i style="inline-size:'+s.pct+'%"></i></div>'+
      '<div class="small muted" style="margin-block-start:4px">'+s.done+'/'+s.total+' checked · '+s.issues+' issues · '+s.photos+' photos</div></div>'+
      '<button class="btn sm danger" data-act="discard" data-id="'+esc(d.id)+'" type="button">Delete</button></div></div>';
  });
  if(!h) h='<div class="card" style="text-align:center;padding-block:28px"><div class="title">Nothing in progress</div><div class="small muted" style="margin-block:6px 14px">Start an inspection from the property list.</div>'+
    '<button class="btn primary" type="button" data-act="tab" data-id="new">＋ Start an inspection</button></div>';
  return h;
}
function submittedTabHtml(){
  var h='<div class="row" style="gap:8px;margin-block-end:10px"><input type="search" id="subSearch" class="grow" placeholder="Search submitted…" value="'+esc(S.subQ||'')+'" style="margin:0">'+
    '<div class="row" style="gap:4px;background:var(--chip);padding:3px;border-radius:99px;flex:none">'+
    ['all','mine'].map(function(f){ var on=S.recentFilter===f; return '<button type="button" class="btn sm'+(on?' primary':'')+'" data-act="recent-filter" data-id="'+f+'" style="min-height:32px;border:0;border-radius:99px;box-shadow:none;'+(on?'':'background:transparent')+'">'+(f==='all'?'Everyone':'Mine')+'</button>'; }).join('')+'</div></div>';
  return h+'<div id="subList">'+submittedListHtml()+'</div>';
}
function submittedListHtml(){
  var q=String(S.subQ||'').trim().toLowerCase();
  var rl=recentFiltered().filter(function(x){ return !q || (x.propertyName+' '+(x.address||'')+' '+(x.type||'')+' '+(x.inspector||'')).toLowerCase().indexOf(q)>=0; });
  var h='';
  if(!rl.length) h+='<div class="card small muted">'+(q?'Nothing submitted matches that.':S.recentFilter==='mine'?'You haven’t submitted any inspections yet. Switch to “Everyone” to see the team’s.':'No inspections submitted yet.')+'</div>';
  rl.slice(0,S.recentShow).forEach(function(x){
    var who=x.mine?'You':(x.inspector||'');
    h+='<div class="card small'+(x.id?' tap" data-act="view-insp" data-id="'+esc(x.id)+'"':'"')+'><div class="row"><div class="grow"><div class="title">'+esc(x.propertyName)+'</div>'+
      '<div class="muted">'+esc(x.type)+' · '+esc(fmt(x.submittedAt))+'</div>'+
      '<div style="margin-block-start:6px">'+(who?'<span class="pill">👤 '+esc(who)+'</span>':'')+'<span class="pill'+(x.issues?' issue':' done')+'">'+(x.issues||0)+' issues</span>'+(x.photos?'<span class="pill">📷 '+x.photos+'</span>':'')+'</div>'+
      (!x.id&&x.reportUrl?'<div class="row wrap" style="margin-block-start:8px"><a class="btn sm" target="_blank" rel="noopener" href="'+esc(x.reportUrl)+'">Report</a></div>':'')+
      '</div>'+(x.id?'<span class="chev">›</span>':'')+'</div></div>';
  });
  if(rl.length>S.recentShow) h+='<button class="btn block dashed" type="button" data-act="recent-more">Show more ('+(rl.length-S.recentShow)+')</button>';
  if(HAS_GAS && S.recentOffline) h+='<div class="small muted" style="text-align:center;margin-block-start:6px">Offline — showing the list saved on this device.</div>';
  return h;
}
function setupTabHtml(){
  var h='<div class="card tap" data-act="admin"><div class="row"><div class="tile t1">🏠</div><div class="grow"><div class="title">Manage properties</div><div class="small muted">Areas and checks for each property, and the letting details (admin PIN)</div></div><span class="chev">›</span></div></div>';
  h+='<div class="card"><label class="fld" style="margin:0"><span>Your name as inspector</span><input type="text" id="setInspector" value="'+esc(localStorage.getItem('fi-inspector')||'')+'" placeholder="Used when you start an inspection"></label></div>';
  h+='<button class="btn block" type="button" data-act="refresh">↻ Refresh properties and inspections</button>';
  h+='<div class="small muted" style="text-align:center;margin-block-start:18px">App version '+APP_VERSION+(S.serverVersion?' · backend '+esc(S.serverVersion):'')+(HAS_GAS?'':' · demo')+'</div>';
  return h;
}
/* ---- a submitted inspection, read-only ---- */
VIEWS.viewInsp = function(id){
  var rec=recById(id)||{}; setTitle(rec.propertyName||'Inspection');
  var have=viewCacheGet(id);
  if(have){ S.viewD=have; viewInspRender(id); }
  else $('#app').innerHTML='<div class="card row"><span class="spin"></span><span class="title">Opening…</span></div>';
  setFooter('<button class="btn" type="button" data-act="back">‹ Back</button>');
  return api.getInspection({id:id}).then(function(r){
    var d=serverDraft(r); d.submittedAt=r.submittedAt; d.reportUrl=r.reportUrl||rec.reportUrl||''; d.folderUrl=r.folderUrl||rec.folderUrl||''; d.submittedBy=r.submittedBy||'';
    viewCachePut(id,d);
    if(S.cur.view==='viewInsp' && S.cur.arg===id){ S.viewD=d; viewInspRender(id); }
  }).catch(function(e){ if(!have && S.cur.view==='viewInsp' && S.cur.arg===id) $('#app').innerHTML='<div class="card">Couldn’t open this inspection: '+esc(e.message)+'</div>'; });
};
function viewInspRender(id){
  var d=S.viewD, s=stats(d), rec=recById(id)||{}, tn=tenantCount(d);
  var h='<div class="card"><div class="row" style="align-items:flex-start"><div class="grow"><div class="title">'+esc(d.propertyName)+'</div><div class="small muted">'+esc(d.address||'')+'</div></div><span class="ro-badge">Read only</span></div>'+
    '<div class="small" style="margin-block-start:8px">'+esc(d.type)+' · submitted '+esc(fmt(d.submittedAt))+(d.inspector?' · '+esc(d.inspector):'')+(d.tenant?' · tenant '+esc(d.tenant):'')+'</div>'+
    '<div style="margin-block-start:8px"><span class="pill">'+s.done+'/'+s.total+' checked</span><span class="pill'+(s.issues?' issue':' done')+'">'+s.issues+' issues</span>'+(s.photos?'<span class="pill">📷 '+s.photos+'</span>':'')+'</div>'+
    '<div class="row wrap" style="margin-block-start:12px">'+(d.reportUrl?'<a class="btn sm" target="_blank" rel="noopener" href="'+esc(d.reportUrl)+'">📄 Report</a>':'')+
      (HAS_GAS?'<button class="btn sm ghost" type="button" data-act="email" data-id="'+esc(id)+'" data-f="'+esc(d.folderUrl||'')+'">✉ Email full report</button>':'')+
      (tn?'<button class="btn sm ghost" type="button" data-act="email-tenant" data-id="'+esc(id)+'">🧑 Email tenant issues ('+tn+')</button>':'')+
      (d.folderUrl?'<a class="btn sm ghost" target="_blank" rel="noopener" href="'+esc(d.folderUrl)+'">📁 Drive folder</a>':'')+'</div>'+
    '<div class="row wrap" style="margin-block-start:8px">'+(HAS_GAS?'<button class="btn sm" type="button" data-act="edit-insp" data-id="'+esc(id)+'">✏️ Edit (admin PIN)</button>':'')+
      '<button class="btn sm danger" type="button" data-act="del-insp" data-id="'+esc(id)+'" data-f="'+esc(d.folderUrl||rec.folderUrl||'')+'">🗑 Delete</button></div></div>';
  var issues='';
  d.areas.forEach(function(a,ai){ a.items.forEach(function(it){ if(!ISSUE[it.status]) return;
    issues+='<div class="list-issue tap" data-act="view-area" data-i="'+ai+'"><div><b>'+esc(a.name)+'</b> — '+esc(it.label)+'</div><div class="small"><span class="pill issue">'+esc(STATUS_LABEL[it.status])+'</span>'+
      (it.action?'<span class="pill">'+esc(ACTION_LABEL[it.action])+'</span>':'')+(it.photos.length?'<span class="pill">📷 '+it.photos.length+'</span>':'')+'</div>'+(it.note?'<div class="small muted">'+esc(it.note)+'</div>':'')+'</div>';
  }); });
  if(issues) h+='<h2>Issues</h2><div class="card">'+issues+'</div>';
  h+='<h2>Areas</h2>';
  d.areas.forEach(function(a,ai){ var as=areaStats(a);
    h+='<div class="card tap" data-act="view-area" data-i="'+ai+'"><div class="row"><div class="grow"><div class="title">'+esc(a.name)+'</div>'+
      '<div class="small" style="margin-block-start:4px"><span class="pill'+(as.done===as.total&&as.total?' done':'')+'">'+as.done+'/'+as.total+'</span>'+(as.issues?'<span class="pill issue">'+as.issues+' issues</span>':'')+(as.photos?'<span class="pill">📷 '+as.photos+'</span>':'')+'</div>'+
      (a.notes?'<div class="small muted" style="margin-block-start:4px">'+esc(a.notes)+'</div>':'')+'</div><span class="chev">›</span></div></div>';
  });
  if(d.overallNotes) h+='<h2>Overall comments</h2><div class="card small">'+esc(d.overallNotes)+'</div>';
  $('#app').innerHTML=h;
}
function roThumbs(photos){
  if(!photos||!photos.length) return '';
  return '<div class="ro-thumbs">'+photos.map(function(p){ var img='<img alt="Photo" src="'+esc(p.thumb)+'" referrerpolicy="no-referrer" data-fallback="PHOTO_PLACEHOLDER">';
    return p.url? '<a href="'+esc(p.url)+'" target="_blank" rel="noopener">'+img+'</a>' : img; }).join('')+'</div>';
}
VIEWS.viewArea = function(ai){
  var d=S.viewD; if(!d) return back(); var a=d.areas[ai]; if(!a) return back();
  setTitle(a.name);
  var h='<div class="card"><div class="row"><div class="grow small muted">Area '+(ai+1)+' of '+d.areas.length+' · '+esc(d.propertyName)+'</div><span class="ro-badge">Read only</span></div>';
  a.items.forEach(function(it){
    var cls=ISSUE[it.status]?' issue':it.status==='ok'?' done':'';
    h+='<div class="ro-item"><div class="row" style="align-items:flex-start"><div class="grow" style="font-weight:700">'+esc(it.label)+'</div><span class="pill'+cls+'">'+esc(it.status?(STATUSES.find(function(s){ return s.k===it.status; })||{s:it.status}).s:'Not checked')+'</span></div>'+
      (it.action&&ISSUE[it.status]?'<div class="small muted">Action: '+esc(ACTION_LABEL[it.action])+'</div>':'')+
      (it.note?'<div class="small" style="margin-block-start:4px">'+esc(it.note)+'</div>':'')+roThumbs(it.photos)+'</div>';
  });
  h+='</div>';
  if(a.notes||a.photos.length) h+='<h2>Area notes and photos</h2><div class="card">'+(a.notes?'<div class="small">'+esc(a.notes)+'</div>':'')+roThumbs(a.photos)+'</div>';
  $('#app').innerHTML=h;
  var prev=ai>0, next=ai<d.areas.length-1;
  setFooter('<button class="btn" type="button" data-act="view-goto" data-i="'+(ai-1)+'"'+(prev?'':' disabled')+'>‹ Prev</button>'+
    '<button class="btn" type="button" data-act="back">All areas</button>'+
    '<button class="btn" type="button" data-act="view-goto" data-i="'+(ai+1)+'"'+(next?'':' disabled')+'>Next ›</button>');
};
function propListHtml(q){
  q=(q||'').toLowerCase();
  var list=S.props.filter(function(p){ return !q || (p.name+' '+(p.address||'')).toLowerCase().indexOf(q)>=0; });
  if(!list.length) return '<div class="card muted">No properties found. Add one in Setup › Manage properties.</div>';
  return list.map(function(p){ var n=0; p.areas.forEach(function(a){ n+=(a.items||[]).length; });
    var k=0; for(var c=0;c<p.id.length;c++) k+=p.id.charCodeAt(c);
    var last=recentList().find(function(x){ return (x.propertyId && x.propertyId===p.id) || (!x.propertyId && x.propertyName===p.name); });
    return '<div class="card tap" data-act="open-prop" data-id="'+esc(p.id)+'"><div class="row"><div class="tile t'+(k%5)+'">🏠</div><div class="grow"><div class="title">'+esc(p.name)+'</div><div class="small muted">'+esc(p.address||'')+'</div>'+
      '<div style="margin-block-start:6px"><span class="pill">🚪 '+p.areas.length+' areas</span><span class="pill">✅ '+n+' checks</span>'+(last?'<span class="pill">Last: '+esc(new Date(last.submittedAt).toLocaleDateString('en-NZ',{day:'numeric',month:'short'}))+'</span>':'')+'</div></div><span class="chev">›</span></div></div>';
  }).join('');
}

VIEWS.start = function(pid){
  var p=S.props.find(function(x){return x.id===pid;}); if(!p) return home();
  setTitle('New inspection');
  var last=localStorage.getItem('fi-inspector')||'';
  $('#app').innerHTML='<div class="card"><div class="title">'+esc(p.name)+'</div><div class="small muted">'+esc(p.address||'')+'</div>'+
    (p.notes?'<div class="small" style="margin-block-start:8px">📝 '+esc(p.notes)+'</div>':'')+
    '<div class="small muted" style="margin-block-start:8px">'+p.areas.map(function(a){return esc(a.name);}).join(' · ')+'</div></div>'+
    '<div class="card"><label class="fld"><span>Inspection type</span><select id="stType">'+INSPECTION_TYPES.map(function(t){return '<option>'+esc(t)+'</option>';}).join('')+'</select></label>'+
    '<label class="fld"><span>Inspector name</span><input type="text" id="stInspector" value="'+esc(last)+'" autocomplete="name"></label>'+
    '<label class="fld"><span>Tenant(s) present / name (optional)</span><input type="text" id="stTenant"></label>'+
    '<div class="small muted">Start time will be recorded as '+esc(fmt(nowIso()))+'.</div></div>'+
    '<div id="priorInfo"></div>';
  setFooter('<button class="btn primary" data-act="begin" data-id="'+esc(p.id)+'" type="button">Begin inspection</button>');
  function showPrior(pr){ var box=$('#priorInfo'); if(!box) return;
    if(!pr||pr.none){ box.innerHTML='<div class="small muted" style="margin:4px 6px">No previous inspection found for this property.</div>'; return; }
    var d=new Date(pr.date||pr.submittedAt).toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'});
    box.innerHTML='<div class="prior" style="margin:0 0 12px">↺ <b>Last inspection</b> · '+esc(d)+' · '+esc(pr.type||'')+(pr.inspector?' · '+esc(pr.inspector):'')+
      '<br>'+pr.issues+' issue'+(pr.issues===1?'':'s')+' and '+Object.keys(pr.items||{}).length+' noted item'+(Object.keys(pr.items||{}).length===1?'':'s')+' will be shown alongside each check so you can see what’s changed.</div>'; }
  var cached=priorCacheGet(p.id); if(cached) showPrior(cached);
  if(navigator.onLine && HAS_GAS) fetchPrior(p.id).then(showPrior); else if(!cached) showPrior(null);
};

VIEWS.inspect = function(){
  var d=S.draft; if(!d) return home(); var s=stats(d);
  setTitle(d.propertyName);
  var h='<div class="card hero"><div class="row" style="position:relative;z-index:1"><div class="grow"><div class="small">'+esc(d.type)+' · '+esc(d.inspector||'')+'</div><div class="big" style="font-size:1.35rem">'+esc(d.propertyName)+'</div><div class="small">Started '+esc(fmt(d.startedAt))+'</div></div>'+
    '<div class="ring xl" style="--p:'+s.pct+'"><b>'+s.pct+'%</b></div></div>'+
    '<div class="stats"><div class="stat"><b>'+s.done+'/'+s.total+'</b><span>Checked</span></div><div class="stat"><b>'+s.issues+'</b><span>Issues</span></div><div class="stat"><b>'+s.photos+'</b><span>Photos</span></div></div>'+
    (d.prior?'<div class="small" style="position:relative;z-index:1;margin-block-start:10px">↺ Last inspection '+esc(priorDate())+(d.prior.inspector?' by '+esc(d.prior.inspector):'')+' — '+d.prior.issues+' issue'+(d.prior.issues===1?'':'s')+' then'+(d.prior.reportUrl?' · <a target="_blank" rel="noopener" href="'+esc(d.prior.reportUrl)+'" style="color:#fff;font-weight:700">view report</a>':'')+'</div>':'')+
    (d.edit?'<div class="small" style="position:relative;z-index:1;margin-block-start:10px">✎ <b>Editing</b> — submitted '+esc(fmt(d.edit.submittedAt))+'. Changes are saved only when you tap Save changes.</div>':'')+
    '<div class="small" id="upStat" style="position:relative;z-index:1;margin-block-start:10px"></div></div>';
  h+='<h2>Areas</h2>';
  d.areas.forEach(function(a,i){ var as=areaStats(a);
    var cls= as.done===as.total && as.total? 'done':'';
    var ap=as.total?Math.round(as.done*100/as.total):0;
    h+='<div class="card tap" data-act="area" data-i="'+i+'"><div class="row"><div class="ring'+(ap===100?' full':'')+'" style="--p:'+ap+'"><b>'+(ap===100?'✓':ap+'%')+'</b></div><div class="grow"><div class="title">'+esc(a.name)+'</div>'+
    '<div class="small" style="margin-block-start:4px"><span class="pill '+cls+'">'+as.done+'/'+as.total+'</span>'+(as.issues?'<span class="pill issue">'+as.issues+' issues</span>':'')+(as.photos?'<span class="pill">📷 '+as.photos+'</span>':'')+(priorAreaCount(a)?'<span class="pill prior-pill">↺ '+priorAreaCount(a)+' from last time</span>':'')+'</div></div><span class="chev">›</span></div></div>';
  });
  h+='<button class="btn block dashed" data-act="add-area" type="button">＋ Add an extra area</button>';
  $('#app').innerHTML=h; upStats();
  setFooter((d.edit?'<button class="btn" data-act="cancel-edit" type="button">Cancel edit</button>':'')+'<button class="btn primary" data-act="review" type="button">'+(d.edit?'Review & save':'Review & submit')+'</button>');
};

function itemHtml(ai,ti,it){
  var cls=ISSUE[it.status]?'issue':(it.status==='ok'?'okay':'');
  var h='<div class="card item '+cls+'" id="it-'+ai+'-'+ti+'"><div class="title">'+esc(it.label)+'</div>'+priorHtml(ai,ti,it)+'<div class="chips">';
  STATUSES.forEach(function(s){ h+='<button type="button" class="chip'+(it.status===s.k?' on':'')+'" data-s="'+s.k+'" title="'+esc(s.l)+'" data-act="status" data-a="'+ai+'" data-t="'+ti+'" data-v="'+s.k+'"><i>'+s.i+'</i>'+esc(s.s)+'</button>'; });
  h+='</div>';
  var showNote = it.note || ISSUE[it.status] || it._open;
  h+= showNote ? '<textarea placeholder="Describe the condition, location, severity…" data-bind="note" data-a="'+ai+'" data-t="'+ti+'">'+esc(it.note)+'</textarea>'
               : '<button class="btn sm" type="button" data-act="open-note" data-a="'+ai+'" data-t="'+ti+'">✎ Add note</button> ';
  if(ISSUE[it.status]){
    h+='<div class="actby" role="radiogroup" aria-label="Who needs to action this">'+ACTIONS.map(function(x){
      return '<label><input type="radio" name="act-'+ai+'-'+ti+'" value="'+x.k+'" data-bind="action" data-a="'+ai+'" data-t="'+ti+'"'+(it.action===x.k?' checked':'')+'><span>'+x.i+'</span><span>'+esc(x.s)+'</span></label>'; }).join('')+'</div>';
    if(!it.action) h+='<div class="actby-need">Choose who needs to action this, or No action.</div>';
  }
  h+='<div class="row wrap" style="margin-block-start:8px"><button class="btn sm ghost" type="button" data-act="cam" data-a="'+ai+'" data-t="'+ti+'">📷 Camera</button><button class="btn sm ghost" type="button" data-act="gal" data-a="'+ai+'" data-t="'+ti+'">🖼 Gallery</button></div>';
  h+=thumbsHtml(ai,ti,it.photos);
  var st=[]; if(it.statusAt) st.push('Status '+fmt(it.statusAt)); if(it.noteAt) st.push('Note '+fmt(it.noteAt));
  if(st.length) h+='<div class="stamp">🕒 '+esc(st.join(' · '))+'</div>';
  return h+'</div>';
}
function upIcon(p){ return p.uploaded?'☁':(Up.current===p.id?'⇡':'⏳'); }
function thumbsHtml(ai,ti,photos){
  if(!photos.length) return '';
  return '<div class="thumbs">'+photos.map(function(p,pi){ return '<div class="thumb"><img alt="Photo" src="'+esc(p.thumb)+'"'+(p.existing?' referrerpolicy="no-referrer" data-fallback="PHOTO_PLACEHOLDER"':'')+' data-act="view" data-id="'+esc(p.id)+'" data-a="'+ai+'" data-t="'+ti+'" data-p="'+pi+'">'+
    '<button type="button" aria-label="Delete photo" data-act="del-photo" data-a="'+ai+'" data-t="'+ti+'" data-p="'+pi+'">×</button>'+
    '<span class="up" id="up-'+esc(p.id)+'">'+upIcon(p)+' '+esc(new Date(p.takenAt).toLocaleTimeString('en-NZ',{hour:'numeric',minute:'2-digit'}))+'</span></div>'; }).join('')+'</div>';
}

VIEWS.area = function(ai){
  var d=S.draft; if(!d) return home(); var a=d.areas[ai]; if(!a) return back();
  S.areaIdx=ai; setTitle(a.name);
  var as=areaStats(a);
  var h='<div id="upWarn" class="small"></div><div class="card"><div class="row"><div class="grow small muted">Area '+(ai+1)+' of '+d.areas.length+' · '+as.done+'/'+as.total+' checked</div>'+
    '<button class="btn sm ghost" type="button" data-act="all-ok" data-a="'+ai+'">✓ Rest OK</button></div>'+
    (a.guidance?'<div class="small" style="margin-block-start:8px">📝 '+esc(a.guidance)+'</div>':'')+'</div>';
  a.items.forEach(function(it,ti){ h+=itemHtml(ai,ti,it); });
  h+='<button class="btn block dashed" type="button" data-act="add-item" data-a="'+ai+'">＋ Add item to this area</button>';
  var pa=priorArea(a);
  h+='<h2>Area notes & photos</h2><div class="card">'+(pa?'<div class="prior" style="margin:0 0 10px">↺ <b>Last time</b> · '+esc(priorDate())+': “'+esc(pa.note||'')+'”'+(pa.photos&&pa.photos.length?' · '+priorLinks(pa.photos):'')+'</div>':'')+'<textarea placeholder="General comments for '+esc(a.name)+'…" data-bind="area-notes" data-a="'+ai+'">'+esc(a.notes)+'</textarea>'+
    '<div class="row wrap" style="margin-block-start:8px"><button class="btn sm ghost" type="button" data-act="cam" data-a="'+ai+'" data-t="">📷 Camera</button><button class="btn sm ghost" type="button" data-act="gal" data-a="'+ai+'" data-t="">🖼 Gallery</button></div>'+
    thumbsHtml(ai,'',a.photos)+(a.notesAt?'<div class="stamp">🕒 Note '+esc(fmt(a.notesAt))+'</div>':'')+'</div>';
  $('#app').innerHTML=h; upStats();
  var prev=ai>0, next=ai<d.areas.length-1;
  setFooter('<button class="btn" type="button" data-act="goto-area" data-i="'+(ai-1)+'"'+(prev?'':' disabled')+'>‹ Prev</button>'+
    '<button class="btn" type="button" data-act="to-inspect">All areas</button>'+
    (next?'<button class="btn primary" type="button" data-act="goto-area" data-i="'+(ai+1)+'">Next ›</button>':'<button class="btn primary" type="button" data-act="review">Review</button>'));
};

VIEWS.review = function(){
  var d=S.draft; if(!d) return home(); var s=stats(d); setTitle(d.edit?'Review & save':'Review & submit');
  var h='<div class="card"><div class="title">'+esc(d.propertyName)+'</div><div class="small muted">'+esc(d.type)+' · '+esc(d.inspector||'')+' · started '+esc(fmt(d.startedAt))+'</div>'+
    '<div class="small" style="margin-block-start:8px">'+s.done+' of '+s.total+' checks · <b>'+s.issues+' issues</b> · '+s.photos+' photos</div>'+
    (s.done<s.total?'<div class="small" style="color:var(--miss);margin-block-start:6px">⚠ '+(s.total-s.done)+' items not yet checked — they will be recorded as “Not checked”.</div>':'')+
    (noAction(d)?'<div class="small" style="color:var(--miss);margin-block-start:6px">⚠ '+noAction(d)+' issue'+(noAction(d)===1?' doesn’t':'s don’t')+' say whether the tenant or landlord needs to action '+(noAction(d)===1?'it':'them')+' (or that no action is needed).</div>':'')+'</div>';
  h+='<h2>Issues found</h2><div class="card">';
  var any=false;
  d.areas.forEach(function(a,ai){ a.items.forEach(function(it,ti){ if(!ISSUE[it.status]) return; any=true;
    h+='<div class="list-issue tap" data-act="goto-area" data-i="'+ai+'"><div><b>'+esc(a.name)+'</b> — '+esc(it.label)+'</div><div class="small"><span class="pill issue">'+esc(STATUS_LABEL[it.status])+'</span>'+
      (it.action?'<span class="pill">'+esc(ACTION_LABEL[it.action])+'</span>':'<span class="pill" style="color:var(--miss)">who actions? not set</span>')+(it.photos.length?'<span class="pill">📷 '+it.photos.length+'</span>':'')+
      (!it.note&&!it.photos.length?'<span class="pill">no note or photo</span>':'')+'</div>'+(it.note?'<div class="small muted">'+esc(it.note)+'</div>':'')+'</div>';
  }); });
  if(!any) h+='<div class="muted">No issues recorded.</div>';
  h+='</div><h2>Overall comments</h2><div class="card"><textarea data-bind="overall" placeholder="Summary, follow-up actions, tenant comments…">'+esc(d.overallNotes)+'</textarea></div>';
  h+='<div id="submitStatus"></div>';
  $('#app').innerHTML=h;
  setFooter((d.edit?'<button class="btn" type="button" data-act="cancel-edit">Cancel edit</button>':'')+'<button class="btn" type="button" data-act="to-inspect">Back to areas</button><button class="btn primary" type="button" data-act="submit" id="submitBtn">'+(d.edit?'Save changes':'Submit to Google Drive')+'</button>');
};

VIEWS.done = function(res){
  S.tab='submitted'; if(res && res.id) viewCacheDrop(res.id);
  setTitle(res.edited?'Saved':'Submitted');
  if(res.edited) buzz(20); else confetti();
  $('#app').innerHTML='<div class="card success"><div class="boom">'+(res.edited?'✅':'🎉')+'</div><div class="big">'+(res.edited?'Changes saved':'Inspection submitted!')+'</div><div class="muted small" style="margin-block-start:6px">'+esc(res.propertyName)+' · '+esc(fmt(res.submittedAt))+'</div>'+
    '<div class="small" style="margin-block-start:8px">'+res.issues+' issues · '+res.photos+' photos uploaded</div>'+
    (res.reportError?'<div class="small" style="color:var(--bad);margin-block-start:8px">⚠ The report couldn’t be rebuilt ('+esc(res.reportError)+'). Your results are saved — edit and save again to retry.</div>'
      : res.edited?'<div class="small" style="margin-block-start:8px">📄 Report rebuilt with your changes.</div>':'')+
    '<div class="row wrap" style="margin-block-start:16px;justify-content:center"><button class="btn primary" type="button" data-act="email" data-id="'+esc(res.id||'')+'" data-f="'+esc(res.folderUrl||'')+'">✉ Email Full Report</button>'+
      (res.tenantIssues&&HAS_GAS?'<button class="btn" type="button" data-act="email-tenant" data-id="'+esc(res.id||'')+'">🧑 Email Tenant Issues ('+res.tenantIssues+')</button>':'')+(res.reportUrl?'<a class="btn" target="_blank" rel="noopener" href="'+esc(res.reportUrl)+'">Open report</a>':'')+(res.folderUrl?'<a class="btn" target="_blank" rel="noopener" href="'+esc(res.folderUrl)+'">Drive folder</a>':'')+(res.sheetUrl?'<a class="btn" target="_blank" rel="noopener" href="'+esc(res.sheetUrl)+'">Database sheet</a>':'')+'</div>'+
    (HAS_GAS?'':'<div class="small muted" style="margin-block-start:10px">Demo mode: nothing was sent to Google. Connect the backend to store photos in Drive and results in Sheets.</div>')+'</div>';
  setFooter('<button class="btn primary" type="button" data-act="home">Done</button>');
};

/* ---------- Admin ---------- */
VIEWS.adminLogin = function(){
  setTitle('Admin');
  $('#app').innerHTML='<div class="card"><label class="fld"><span>Admin PIN</span><input type="password" id="pinIn" inputmode="numeric" autocomplete="off"></label><button class="btn primary block" type="button" data-act="admin-login">Unlock</button></div>';
};
VIEWS.adminList = function(){
  setTitle('Manage properties');
  var h='<div class="small muted" style="margin:4px">Each property has its own inspection template — the areas and checks inspectors will see.</div>';
  S.props.forEach(function(p){ var n=0; p.areas.forEach(function(a){ n+=(a.items||[]).length; });
    h+='<div class="card"><div class="row"><div class="tile">🏠</div><div class="grow tap" data-act="edit-prop" data-id="'+esc(p.id)+'"><div class="title">'+esc(p.name)+'</div><div class="small muted">'+esc(p.address||'')+'</div>'+
      '<div style="margin-block-start:6px"><span class="pill">🚪 '+p.areas.length+' areas</span><span class="pill">✅ '+n+' checks</span></div></div></div>'+
      '<div class="row" style="margin-block-start:12px"><button class="btn sm grow" type="button" data-act="edit-prop" data-id="'+esc(p.id)+'">✎ Edit</button><button class="btn sm ghost grow" type="button" data-act="clone-prop" data-id="'+esc(p.id)+'">⧉ Clone</button></div></div>'; });
  $('#app').innerHTML=h;
  setFooter('<button class="btn primary" type="button" data-act="new-prop">+ New property</button>');
};
/* Bond defaults to 4 weeks' rent: when the rent changes, a blank bond (or one still 4 weeks of the old rent) follows it */
function bond4(rent){ var r=+rent; return r>0? String(Math.round(r*400)/100) : ''; }
function bondFollows(bond,oldRent){ return bond===''||bond==null||(+oldRent>0&&Math.abs(+bond-(+oldRent)*4)<0.005); }
/* A property's address is street + suburb/city (no postcode); the one-line address is made from them */
function noPostcode(s){ return String(s||'').trim().replace(/[\s,]+\d{4}$/,'').trim(); }
function joinAddr(a1,a2){ a1=String(a1||'').trim(); a2=noPostcode(a2); return a1&&a2? a1+', '+a2 : a1||a2; }
/* Letting details: the bond can be at most 4 weeks' rent; occupants a whole number */
function lettingProblem(e){
  var r=+e.rent||0, b=e.bond===''||e.bond==null?NaN:+e.bond, o=e.maxOccupants===''||e.maxOccupants==null?NaN:+e.maxOccupants;
  if(e.rent!==''&&e.rent!=null&&!(r>=0)) return 'Check the rent per week';
  if(!isNaN(b)&&r>0&&b>r*4+0.005) return 'The bond can’t be more than 4 weeks’ rent ($'+(Math.round(r*400)/100)+')';
  if(!isNaN(o)&&(o<1||Math.floor(o)!==o)) return 'Maximum occupants must be a whole number';
  if(e.excess!==''&&e.excess!=null&&!(+e.excess>=0)) return 'Check the insurance excess';
  if(e.insulationDate){ var n=new Date(), today=n.getFullYear()+'-'+('0'+(n.getMonth()+1)).slice(-2)+'-'+('0'+n.getDate()).slice(-2);
    if(e.insulationDate>today) return 'The insulation inspection date can’t be in the future'; }
  return '';
}
function bondHint(){
  var el=$('#edBondHint'); if(!el||!S.editing) return;
  var r=+S.editing.rent||0, p=lettingProblem(S.editing);
  el.textContent=p||(r>0?'Up to 4 weeks’ rent: $'+(Math.round(r*400)/100):'');
  el.style.color=p?'var(--bad)':'';
}
VIEWS.editor = function(){
  var e=S.editing; setTitle(e.id?'Edit property':(e.clonedFrom?'Cloned property':'New property'));
  var h='<div class="card"><label class="fld"><span>Property name</span><input type="text" data-ed="name" value="'+esc(e.name)+'" placeholder="e.g. Flat 2, 45 George St"></label>'+
    '<div class="row wrap"><label class="fld grow"><span>Street address</span><input type="text" data-ed="address1" value="'+esc(e.address1||'')+'" placeholder="e.g. 208 Hanover Street"></label>'+
    '<label class="fld grow"><span>Suburb / city</span><input type="text" data-ed="address2" value="'+esc(e.address2||'')+'" placeholder="e.g. Dunedin"></label></div>'+
    '<label class="fld"><span>Notes for inspectors (access, keys, alarms…)</span><textarea data-ed="notes">'+esc(e.notes||'')+'</textarea></label></div>';
  // Letting details are shared with Tenant Management (viewings, applications and tenancy agreements)
  var ten=e.tenancy||'', tens=['12 months','6 months','Periodic','Other'];
  h+='<h2>Letting details</h2><div class="card"><div class="small muted" style="margin-block-end:10px">Shared with Tenant Management for viewings, applications and tenancy agreements.</div>'+
    '<div class="row wrap"><label class="fld grow"><span>Rent per week ($)</span><input type="number" inputmode="decimal" min="0" data-ed="rent" value="'+esc(e.rent||'')+'"></label>'+
    '<label class="fld grow"><span>Bond ($)</span><input type="number" inputmode="decimal" min="0" data-ed="bond" value="'+esc(e.bond||'')+'"></label></div>'+
    '<div id="edBondHint" class="small muted" style="margin:-6px 0 10px"></div>'+
    '<div class="row wrap"><label class="fld grow"><span>Maximum occupants</span><input type="number" inputmode="numeric" min="1" data-ed="maxOccupants" value="'+esc(e.maxOccupants||'')+'"></label>'+
    '<label class="fld grow"><span>Length of tenancy</span><select data-ed="tenancy"><option value="">—</option>'+tens.map(function(t){ return '<option'+(t===ten?' selected':'')+'>'+esc(t)+'</option>'; }).join('')+
      (ten&&tens.indexOf(ten)<0?'<option selected>'+esc(ten)+'</option>':'')+'</select></label></div>'+
    '<div class="row wrap"><label class="fld grow"><span>Insurer</span><input type="text" data-ed="insurer" value="'+esc(e.insurer||'')+'" placeholder="e.g. AMI, or Not insured"></label>'+
    '<label class="fld grow"><span>Insurance policy</span><input type="text" data-ed="insurancePolicy" value="'+esc(e.insurancePolicy||'')+'"></label></div>'+
    '<div class="row wrap"><label class="fld grow"><span>Insurance excess ($)</span><input type="number" inputmode="decimal" min="0" data-ed="excess" value="'+esc(e.excess||'')+'"></label>'+
    '<label class="fld grow"><span>Insulation inspection date</span><input type="date" data-ed="insulationDate" value="'+esc(e.insulationDate||'')+'"></label></div>'+
    '<div class="small muted">Default landlord: <b>'+esc(e.landlord||'not set')+'</b> · Agreement template: <b>'+esc(e.agreementTemplate||'not set')+'</b><br>These two are chosen in Tenant Management (group screen → Tenancy agreement → Settings).</div></div>';
  h+='<h2>Quick layout builder</h2><div class="card small"><div class="row wrap">'+
    '<label class="fld grow"><span>Bedrooms</span><input type="number" id="qbBed" min="0" max="12" value="2"></label>'+
    '<label class="fld grow"><span>Bathrooms</span><input type="number" id="qbBath" min="0" max="6" value="1"></label>'+
    '<label class="fld grow"><span>Separate toilets</span><input type="number" id="qbWc" min="0" max="4" value="0"></label></div>'+
    '<div class="row wrap" style="gap:14px;margin-block-end:10px">'+['Laundry','Hallway / Entry','Garage','Exterior / Grounds'].map(function(t,i){ return '<label><input type="checkbox" class="qbOpt" value="'+esc(t)+'"'+(i!==2?' checked':'')+'> '+esc(t)+'</label>'; }).join('')+'</div>'+
    '<label class="fld"><span>Special features to inspect (one per line)</span><textarea id="qbSpecial" placeholder="Heat pump&#10;Spa pool&#10;Garden shed"></textarea></label>'+
    '<button class="btn block" type="button" data-act="ed-quick">Generate areas (replaces list below)</button></div>';
  h+='<h2>Areas & checks</h2>';
  e.areas.forEach(function(a,i){
    h+='<div class="editor-area"><div class="row"><input type="text" class="grow" data-ea="name" data-i="'+i+'" value="'+esc(a.name)+'">'+
      '<button class="btn sm" type="button" data-act="ed-up" data-i="'+i+'" aria-label="Move up">↑</button><button class="btn sm" type="button" data-act="ed-down" data-i="'+i+'" aria-label="Move down">↓</button><button class="btn sm danger" type="button" data-act="ed-del" data-i="'+i+'" aria-label="Remove">✕</button></div>'+
      '<label class="fld small" style="margin-block-start:8px"><span>Type</span><select data-ea="type" data-i="'+i+'">'+AREA_TYPES.map(function(t){return '<option'+(t===a.type?' selected':'')+'>'+esc(t)+'</option>';}).join('')+'</select></label>'+
      '<label class="fld small"><span>Checks (one per line)</span><textarea rows="5" data-ea="items" data-i="'+i+'">'+esc((a.items||[]).join('\n'))+'</textarea></label>'+
      '<label class="fld small" style="margin:0"><span>Guidance note for this area (optional)</span><input type="text" data-ea="notes" data-i="'+i+'" value="'+esc(a.notes||'')+'"></label></div>';
  });
  h+='<div class="row"><select id="newAreaType" class="grow">'+AREA_TYPES.map(function(t){return '<option>'+esc(t)+'</option>';}).join('')+'</select><button class="btn" type="button" data-act="ed-add">+ Add area</button></div>';
  if(e.id) h+='<div class="sep"></div><button class="btn danger block" type="button" data-act="ed-archive">Archive property</button>';
  if(e.clonedFrom) h='<div class="card small" style="background:var(--brand-soft);border-color:transparent">⧉ Exact copy of <b>'+esc(e.clonedFrom)+'</b> — '+e.areas.length+' areas copied. Adjust anything you need, then <b>Save template</b>.</div>'+h;
  if(e.id) h+='<button class="btn ghost block" type="button" data-act="clone-prop" data-id="'+esc(e.id)+'" style="margin-block-start:10px">⧉ Clone this property</button>';
  $('#app').innerHTML=h; bondHint();
  setFooter('<button class="btn" type="button" data-act="back">Cancel</button><button class="btn primary" type="button" data-act="ed-save">Save template</button>');
};
function buildLayout(bed,bath,wc,opts,special){
  var out=[]; function add(n,t){ out.push({id:uid('A'),name:n,type:t,items:LIB[t].slice(),notes:''}); }
  add('Kitchen','Kitchen'); add('Living / Dining','Living / Dining');
  if(opts.indexOf('Hallway / Entry')>=0) add('Hallway / Entry','Hallway / Entry');
  for(var i=1;i<=bed;i++) add(bed>1?'Bedroom '+i:'Bedroom','Bedroom');
  for(i=1;i<=bath;i++) add(bath>1?'Bathroom '+i:'Bathroom','Bathroom');
  for(i=1;i<=wc;i++) add(wc>1?'Toilet '+i:'Toilet','Toilet');
  ['Laundry','Garage','Exterior / Grounds'].forEach(function(t){ if(opts.indexOf(t)>=0) add(t,t); });
  add('General / Whole property','General / Whole property');
  if(special.length) out.push({id:uid('A'),name:'Special features',type:'Special features',items:special,notes:''});
  return out;
}

/* ================= Background uploader =================
   Photos upload one at a time, shortly after they are taken, whenever there is signal.
   Deleting a photo removes it from the phone immediately and from Google Drive as soon as possible. */
var Up = {
  running:null, timer:null, current:null, onProgress:null,
  schedule:function(ms){ clearTimeout(Up.timer); Up.timer=setTimeout(function(){ Up.drain().catch(function(){ Up.schedule(15000); }); }, ms==null?1200:ms); },
  drain:function(){
    if(Up.running) return Up.running.then(function(){ return Up.drain(); }, function(){ return Up.drain(); });
    var d=S.draft; if(!d) return Promise.resolve();
    Up.running=Up.loop(d).then(function(v){ Up.running=null; Up.current=null; upStats(); return v; }, function(e){ Up.running=null; Up.current=null; upStats(); throw e; });
    return Up.running;
  },
  loop:function(d){
    if(S.draft!==d || !navigator.onLine) return Promise.resolve();
    d.pendingDeletes=d.pendingDeletes||[];
    if(d.pendingDeletes.length){
      var del=d.pendingDeletes[0];
      return api.deletePhoto({inspectionId:d.id,photoId:del}).then(function(){ d.pendingDeletes.shift(); return persist(true); }).then(function(){ return Up.loop(d); });
    }
    var x=allPhotos(d).filter(function(y){ return !y.p.uploaded; })[0];
    if(!x) return Promise.resolve();
    return ensureFolder(d).then(function(){ return DB.get('photos',x.p.id); }).then(function(rec){
      if(!rec){ x.p.uploaded=true; x.p.missing=true; return persist(true); }
      Up.current=x.p.id; upMark(x.p);
      return api.uploadPhoto({inspectionId:d.id,photoId:x.p.id,photosFolderId:d.folder.photosFolderId,propertyName:d.propertyName,area:x.area,item:x.item,caption:x.p.caption,takenAt:x.p.takenAt,dataUrl:rec.data})
        .then(function(r){
          x.p.uploaded=true; x.p.url=r.url; x.p.fileId=r.fileId; Up.current=null;
          // Deleted while it was uploading? Remove it from Drive too.
          if(!allPhotos(d).some(function(y){ return y.p.id===x.p.id; })) d.pendingDeletes.push(x.p.id);
          upMark(x.p); upStats(); if(Up.onProgress) Up.onProgress();
          return persist(true);
        });
    }).then(function(){ return Up.loop(d); });
  }
};
function ensureFolder(d){
  if(d.folder) return Promise.resolve(d.folder);
  return api.createInspection({id:d.id,propertyId:d.propertyId,propertyName:d.propertyName,address:d.address,type:d.type,inspector:d.inspector,tenant:d.tenant,startedAt:d.startedAt})
    .then(function(f){ d.folder=f; return persist(true).then(function(){ return f; }); });
}
function upMark(p){ var el=document.getElementById('up-'+p.id); if(el) el.firstChild.nodeValue=upIcon(p)+' '+new Date(p.takenAt).toLocaleTimeString('en-NZ',{hour:'numeric',minute:'2-digit'}); }
function upCounts(d){ var all=allPhotos(d), u=all.filter(function(x){ return x.p.uploaded; }).length; return {up:u,total:all.length}; }
function upStats(){
  var d=S.draft, el=document.getElementById('upStat'), w=document.getElementById('upWarn'); if(!d || (!el && !w)) return;
  var u=unsaved(d), stuck=!!u && HAS_GAS && (!navigator.onLine || Backup.failed);
  var warn=stuck? '⚠ Not saved online yet: '+u+(navigator.onLine?' · retrying':' · no signal') : '';
  if(el){
    var c=upCounts(d), t=[];
    if(c.total) t.push('☁ '+c.up+' of '+c.total+' photos uploaded');
    if(backupWanted(d)) t.push(d.backupSig===backupSig(d) && d.backupAt? '✓ Backed up online '+new Date(d.backupAt).toLocaleTimeString('en-NZ',{hour:'numeric',minute:'2-digit'}) : 'Saving online…');
    el.innerHTML=stuck? '<span class="amber">'+esc(warn)+'</span>' : esc(t.join(' · '));
  }
  if(w){ w.innerHTML=stuck? '<span class="amber">'+esc(warn)+'</span>' : ''; }
}
function removePhoto(d,ph){
  if(!ph) return; DB.del('photos',ph.id);
  // A photo from the submitted inspection stays in Drive until the edit is saved (the server bins it then)
  if(ph.uploaded && !ph.missing && !ph.existing){ d.pendingDeletes=d.pendingDeletes||[]; d.pendingDeletes.push(ph.id); }
  persist(true).then(function(){ Up.schedule(300); });
}
function flushDiscards(){
  var q; try{ q=JSON.parse(localStorage.getItem('fi-discards')||'[]'); }catch(e){ q=[]; }
  if(!q.length || !navigator.onLine) return;
  var id=q[0];
  api.discardInspection(id).then(function(){ q.shift(); localStorage.setItem('fi-discards',JSON.stringify(q)); flushDiscards(); }).catch(function(){});
}
var wake=null;
function keepAwake(on){ try{ if(on && navigator.wakeLock){ navigator.wakeLock.request('screen').then(function(w){ wake=w; }).catch(function(){}); } else if(!on && wake){ wake.release(); wake=null; } }catch(e){} }

/* ================= New / clone property ================= */
function newPropDialog(fromId){
  var m=document.createElement('div'); m.className='modal';
  var opts='<option value="">Blank template (use the quick builder)</option>'+S.props.map(function(p){ return '<option value="'+esc(p.id)+'"'+(p.id===fromId?' selected':'')+'>Clone: '+esc(p.name)+'</option>'; }).join('');
  m.innerHTML='<div class="box"><div class="title" style="font-size:1.15rem;margin-block-end:12px">'+(fromId?'⧉ Clone property':'＋ New property')+'</div>'+
    '<label class="fld"><span>Start from</span><select id="npFrom">'+opts+'</select></label>'+
    '<div id="npInfo" class="small muted" style="margin:-6px 0 12px"></div>'+
    '<label class="fld"><span>New property name</span><input type="text" id="npName" placeholder="e.g. Flat 2, 45 George St"></label>'+
    '<label class="fld"><span>Street address</span><input type="text" id="npA1" placeholder="e.g. 208 Hanover Street"></label>'+
    '<label class="fld"><span>Suburb / city</span><input type="text" id="npA2" placeholder="e.g. Dunedin"></label>'+
    '<div id="npErr" class="small" style="color:var(--bad);margin-block-end:8px"></div>'+
    '<div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-np="cancel">Cancel</button><button class="btn primary" type="button" data-np="go">Continue</button></div></div>';
  document.body.appendChild(m);
  function info(){ var p=S.props.find(function(x){ return x.id===$('#npFrom',m).value; });
    if(!p){ $('#npInfo',m).textContent='Starts with a standard 2-bedroom layout you can change.'; $('[data-np=go]',m).textContent='Continue'; return; }
    var n=0; p.areas.forEach(function(a){ n+=(a.items||[]).length; });
    $('#npInfo',m).textContent='Copies all '+p.areas.length+' areas, '+n+' checks, guidance notes and inspector notes from '+p.name+'.';
    $('[data-np=go]',m).textContent='Clone'; }
  info(); $('#npFrom',m).addEventListener('change',info); setTimeout(function(){ $('#npName',m).focus(); },60);
  m.addEventListener('click',function(ev){
    var b=ev.target.closest('[data-np]'); if(!b) return;
    if(b.getAttribute('data-np')==='cancel'){ m.remove(); return; }
    var name=$('#npName',m).value.trim(), a1=$('#npA1',m).value.trim(), a2=noPostcode($('#npA2',m).value), addr=joinAddr(a1,a2), src=S.props.find(function(x){ return x.id===$('#npFrom',m).value; });
    if(!name){ $('#npErr',m).textContent='Enter a name for the new property.'; return; }
    if(!a1){ $('#npErr',m).textContent='Enter the street address.'; return; }
    if(S.props.some(function(x){ return x.name.trim().toLowerCase()===name.toLowerCase(); })){ $('#npErr',m).textContent='A property with that name already exists — use a different name.'; return; }
    m.remove();
    if(src){
      var c=clone(src);
      S.editing={id:'',name:name,address:addr,address1:a1,address2:a2,notes:c.notes||'',active:true,clonedFrom:src.name,
        areas:c.areas.map(function(a){ return {id:uid('A'),name:a.name,type:a.type,items:(a.items||[]).slice(),notes:a.notes||''}; })};
    } else {
      S.editing={id:'',name:name,address:addr,address1:a1,address2:a2,notes:'',active:true,areas:buildLayout(2,1,0,['Laundry','Hallway / Entry','Exterior / Grounds'],[])};
    }
    if(S.cur.view==='editor') go('editor',null,true); else go('editor');
  });
}

/* ================= Submit ================= */
function allPhotos(d){ var out=[]; d.areas.forEach(function(a){ a.photos.forEach(function(p){ out.push({p:p,area:a.name,item:'(Area)'}); }); a.items.forEach(function(it){ it.photos.forEach(function(p){ out.push({p:p,area:a.name,item:it.label}); }); }); }); return out; }
function stripPhoto(p){ return {id:p.id,takenAt:p.takenAt,caption:p.caption,url:p.url,fileId:p.fileId}; }
function payloadOf(d){
  return { id:d.id, edit:!!d.edit, propertyId:d.propertyId, propertyName:d.propertyName, address:d.address, type:d.type, inspector:d.inspector, tenant:d.tenant,
    startedAt:d.startedAt, submittedAt:nowIso(), keepPhotoIds:allPhotos(d).map(function(x){ return x.p.id; }), overallNotes:d.overallNotes, overallNotesAt:d.overallNotesAt, folder:d.folder,
    areas:d.areas.map(function(a){ return {name:a.name,type:a.type,notes:a.notes,notesAt:a.notesAt,photos:a.photos.map(stripPhoto),
      items:a.items.map(function(it){ var iss=!!ISSUE[it.status];
        return {label:it.label,status:it.status||'unchecked',statusAt:it.statusAt,note:it.note,noteAt:it.noteAt,
                action:iss?(it.action||''):'',actionAt:iss?(it.actionAt||null):null,photos:it.photos.map(stripPhoto)}; })}; }) };
}
function submit(){
  var d=S.draft, box=$('#submitStatus'), btn=$('#submitBtn');
  if(!navigator.onLine){ toast('You are offline. Your inspection is saved on this device — submit when you have signal.',4000); return; }
  if(d.edit && !S.pin){
    pinDialog({title:'✎ Save changes', msg:'Enter the admin PIN to save your changes to this submitted inspection.', ok:'Save changes', busy:'Checking…',
      run:function(pin){ return api.verifyPin(pin).then(function(ok){ if(!ok) throw new Error('Incorrect admin PIN'); }); }, after:submit});
    return;
  }
  btn.disabled=true; keepAwake(true); clearTimeout(Backup.timer); Backup.timer=null;
  function status(msg){ box.innerHTML='<div class="card row"><span class="spin"></span><span>'+esc(msg)+'</span></div>'; }
  function prog(){ var c=upCounts(d); status(c.up<c.total? 'Uploading photos… '+c.up+' of '+c.total+' done' : 'Photos uploaded ✓'); }
  var photos=allPhotos(d);
  prog(); Up.onProgress=prog; clearTimeout(Up.timer);
  Up.drain().then(function(){
    Up.onProgress=null;
    var c=upCounts(d); if(c.up<c.total) throw new Error('Some photos have not uploaded yet.');
    status('Saving results to the database and building the report…');
    return ensureFolder(d).then(function(){ return api.submitInspection(payloadOf(d), d.edit? S.pin : ''); });
  })
  .then(function(r){
    keepAwake(false);
    var s=stats(d), rec={id:d.id,propertyName:d.propertyName,type:d.type,submittedAt:nowIso(),issues:s.issues,photos:s.photos,reportUrl:r.reportUrl||'',folderUrl:r.folderUrl||(d.folder&&d.folder.folderUrl)||'',sheetUrl:r.sheetUrl||'',reportError:r.reportError||'',tenantIssues:tenantCount(d)};
    if(d.edit){
      // Update the existing tile in place rather than adding a new one
      rec.submittedAt=d.edit.submittedAt||rec.submittedAt; rec.edited=true;
      var upd=function(x){ return x.id===d.id? Object.assign({},x,{issues:s.issues,photos:s.photos,tenantIssues:rec.tenantIssues,reportUrl:rec.reportUrl||x.reportUrl,folderUrl:rec.folderUrl||x.folderUrl}) : x; };
      S.history=S.history.map(upd);
      if(S.recent){ S.recent=S.recent.map(upd); saveRecent(); }
      try{ localStorage.removeItem('fi-prior-'+d.propertyId); }catch(e){}
    } else S.history.unshift(rec);
    S.history=S.history.slice(0,20); try{ localStorage.setItem('fi-history',JSON.stringify(S.history)); }catch(e){}
    clearTimeout(saveTimer); S.draft=null;  // no late autosave can bring the draft back
    photos.forEach(function(x){ DB.del('photos',x.p.id); });
    return DB.del('drafts',d.id).then(function(){ S.stack=[]; S.cur={view:'done',arg:rec}; render(); });
  })
  .catch(function(e){ Up.onProgress=null; keepAwake(false); btn.disabled=false; if(/admin PIN/i.test(e.message)) S.pin=null; box.innerHTML='<div class="card" style="border-color:var(--bad)"><b>Upload paused.</b> '+esc(e.message)+'<div class="small muted" style="margin-block-start:6px">Nothing is lost — everything is saved on this device and already-uploaded photos won’t be sent twice. Tap Submit to try again.</div></div>'; });
}

/* ================= Events ================= */
function num(v){ return v===''||v==null? '' : parseInt(v,10); }
document.addEventListener('click',function(ev){
  var el=ev.target.closest('[data-act]'); if(!el) return;
  var act=el.getAttribute('data-act'), id=el.getAttribute('data-id'), ai=num(el.getAttribute('data-a')), ti=num(el.getAttribute('data-t')), i=num(el.getAttribute('data-i'));
  var d=S.draft;
  switch(act){
    case 'home': home(); break;
    case 'tab': S.tab=id; S.stack=[]; S.cur={view:'home'}; render(); window.scrollTo(0,0); break;
    case 'view-insp': go('viewInsp',id); break;
    case 'view-area': go('viewArea',num(el.getAttribute('data-i'))); break;
    case 'view-goto': var vi=num(el.getAttribute('data-i')); if(S.viewD && vi>=0 && vi<S.viewD.areas.length) go('viewArea',vi,true); break;
    case 'back': back(); break;
    case 'refresh': loadProps().then(function(){ render(); toast('Properties refreshed'); autoRestore(); }); break;
    case 'open-prop': go('start',id); break;
    case 'begin':
      if(OLD_APP && S.retire==='block'){ toast('New inspections are started in the new Rentals app now.',6000); break; }
      var p=S.props.find(function(x){return x.id===id;}), insp=$('#stInspector').value.trim();
      if(!insp){ toast('Please enter the inspector name'); return; }
      localStorage.setItem('fi-inspector',insp);
      S.draft=newDraft(clone(p),{type:$('#stType').value,inspector:insp,tenant:$('#stTenant').value.trim()});
      var nd=S.draft; attachPrior(nd,priorCacheGet(p.id));
      if(!nd.prior && HAS_GAS && navigator.onLine) fetchPrior(p.id).then(function(pr){ if(attachPrior(nd,pr)){ persist(true); if(S.draft===nd) render(); } });
      S.tab='progress'; persist(true).then(function(){ S.stack=[{view:'home'}]; S.cur={view:'inspect'}; render(); });
      break;
    case 'recover': recoverInsp(id); break;
    case 'discard-remote': discardRemote(id); break;
    case 'resume': DB.get('drafts',id).then(function(x){ if(!x) return; S.draft=x; go('inspect'); Up.schedule(500); }); break;
    case 'discard':
      var dx=null; DB.get('drafts',id).then(function(x){ dx=x;
        return ask(x&&x.edit? 'Discard your changes? The submitted inspection stays exactly as it was.' : 'Delete this in-progress inspection? Its photos are removed from this device and from Google Drive.',{ok:x&&x.edit?'Discard changes':'Delete'}); })
      .then(function(ok){ if(!ok) return; var x=dx;
        if(x && x.edit) return dropEditDraft(x);
        if(x){ allPhotos(x).forEach(function(y){ DB.del('photos',y.p.id); });
          if(x.folder){ var q; try{ q=JSON.parse(localStorage.getItem('fi-discards')||'[]'); }catch(e){ q=[]; } q.push(x.id); localStorage.setItem('fi-discards',JSON.stringify(q)); flushDiscards(); } }
        if(S.draft&&S.draft.id===id) S.draft=null; return DB.del('drafts',id); }).then(render); break;
    case 'cancel-edit':
      (editChanged(d)? ask('Discard your changes? The submitted inspection stays exactly as it was.',{ok:'Discard changes'}) : Promise.resolve(true))
        .then(function(ok){ if(!ok) return; return dropEditDraft(d).then(function(){ home(); toast('Edit cancelled'); }); });
      break;
    case 'area': go('area',i); break;
    case 'goto-area': if(i>=0 && d && i<d.areas.length){ go('area',i,S.cur.view==='area'); } break;
    case 'to-inspect': S.stack=[{view:'home'}]; S.cur={view:'inspect'}; render(); break;
    case 'status':
      var it=d.areas[ai].items[ti], v=el.getAttribute('data-v'); it.status=(it.status===v?null:v); it.statusAt=it.status?nowIso():null;
      if(!ISSUE[it.status]){ it.action=null; it.actionAt=null; }
      persist(); buzz(it.status && ISSUE[it.status]?[15,30,15]:10); var card=$('#it-'+ai+'-'+ti); if(card){ card.outerHTML=itemHtml(ai,ti,it); $('#it-'+ai+'-'+ti).style.animation='none'; }
      if(ISSUE[it.status]){ var ta=$('#it-'+ai+'-'+ti+' textarea'); if(ta && !ta.value) ta.focus(); }
      break;
    case 'prior-same': case 'prior-fixed':
      var pit=d.areas[ai].items[ti], pp=priorItem(d.areas[ai],pit); if(!pp) break;
      if(act==='prior-same'){ pit.status=pp.key||'damaged'; if(!pit.note && pp.note){ pit.note=pp.note; pit.noteAt=nowIso(); }
        if(!pit.action && pp.action){ pit.action=pp.action; pit.actionAt=nowIso(); } }
      else { pit.status='ok'; pit.action=null; pit.actionAt=null; if(!pit.note){ pit.note='Fixed since last inspection ('+priorDate()+')'; pit.noteAt=nowIso(); } }
      pit.statusAt=nowIso(); persist(); buzz(12);
      var pc=$('#it-'+ai+'-'+ti); if(pc){ pc.outerHTML=itemHtml(ai,ti,pit); $('#it-'+ai+'-'+ti).style.animation='none'; }
      break;
    case 'open-note': d.areas[ai].items[ti]._open=true; var c=$('#it-'+ai+'-'+ti); c.outerHTML=itemHtml(ai,ti,d.areas[ai].items[ti]); $('#it-'+ai+'-'+ti).style.animation='none'; $('#it-'+ai+'-'+ti+' textarea').focus(); break;
    case 'all-ok': d.areas[ai].items.forEach(function(x){ if(!x.status){ x.status='ok'; x.statusAt=nowIso(); } }); persist(); render(); toast('Remaining items marked OK'); break;
    case 'cam': pendingPhoto={ai:ai,ti:ti}; $('#camInput').value=''; $('#camInput').click(); break;
    case 'gal': pendingPhoto={ai:ai,ti:ti}; $('#galInput').value=''; $('#galInput').click(); break;
    case 'view': var vp=target(ai,ti).photos[num(el.getAttribute('data-p'))];
      if(vp && vp.existing && vp.url) window.open(vp.url,'_blank','noopener'); else viewPhoto(id, el.getAttribute('src')); break;
    case 'del-photo': ask('Delete this photo? It will also be removed from Google Drive.',{ok:'Delete'}).then(function(ok){ if(!ok) return; var t=target(ai,ti), ph=t.photos.splice(num(el.getAttribute('data-p')),1)[0]; removePhoto(d,ph); render(); toast('Photo deleted'); }); break;
    case 'add-item': ask('New item to check in '+d.areas[ai].name,{input:true,ok:'Add',placeholder:'e.g. Heated towel rail'}).then(function(v){ if(!v) return; d.areas[ai].items.push({id:uid('I'),label:v,status:null,statusAt:null,note:'',noteAt:null,photos:[]}); persist(); render(); }); break;
    case 'add-area': ask('Name of the extra area',{input:true,ok:'Add',placeholder:'e.g. Sleep-out'}).then(function(v){ if(!v) return; d.areas.push({id:uid('A'),name:v,type:'Custom',guidance:'',notes:'',notesAt:null,photos:[],items:COMMON.map(function(l){return {id:uid('I'),label:l,status:null,statusAt:null,note:'',noteAt:null,photos:[]};})}); persist(); render(); }); break;
    case 'review': go('review'); break;
    case 'submit': submit(); break;
    case 'email': var ff=el.getAttribute('data-f'), hrec=(id&&recById(id))||recentList().find(function(x){ return ff && x.folderUrl===ff; }); if(hrec) emailDialog(hrec); break;
    case 'check-update': checkForUpdate(true,true); break;
    case 'storage-test': Probe.start().then(function(o){
      var m=document.createElement('div'); m.className='modal';
      m.innerHTML='<div class="box"><div class="title" style="font-size:1.1rem;margin-block-end:6px">Storage check</div>'+
        '<div class="small muted" style="margin-block-end:10px">What this phone kept from the last time the app was opened. To test: open this, close the app completely (swipe it away), open it again, then open this check.</div>'+
        Probe.html(o)+'<div class="row" style="justify-content:flex-end;margin-block-start:14px"><button class="btn" type="button" data-pr="close">Close</button></div></div>';
      document.body.appendChild(m); m.addEventListener('click',function(e){ if(e.target.closest('[data-pr]')||e.target===m) m.remove(); });
    }); break;
    case 'email-tenant': var trec=recById(id); if(trec) tenantEmailDialog(trec); break;
    case 'recent-filter': S.recentFilter=id; S.recentShow=10; localStorage.setItem('fi-recent-filter',id); render(); break;
    case 'recent-more': S.recentShow+=20; render(); break;
    case 'edit-insp': var erec=recById(id); if(erec) editInspDialog(erec); break;
    case 'del-insp': var df=el.getAttribute('data-f'), drec=(id&&recById(id))||recentList().find(function(x){ return df && x.folderUrl===df; }); if(drec) deleteInspDialog(drec); break;
    /* admin */
    case 'admin': if(S.pin) go('adminList'); else go('adminLogin'); break;
    case 'admin-login': var pin=$('#pinIn').value.trim(); api.verifyPin(pin).then(function(ok){ if(!ok){ toast('Incorrect PIN'); return; } S.pin=pin; try{ localStorage.setItem('fi-admin-seen','1'); }catch(e){} S.cur={view:'adminList'}; render(); }).catch(function(e){ toast(e.message); }); break;
    case 'new-prop': newPropDialog(''); break;
    case 'clone-prop': newPropDialog(id); break;
    case 'edit-prop': S.editing=clone(S.props.find(function(x){return x.id===id;})); go('editor'); break;
    case 'ed-quick':
      var opts=[].slice.call(document.querySelectorAll('.qbOpt')).filter(function(x){return x.checked;}).map(function(x){return x.value;});
      var sp=$('#qbSpecial').value.split('\n').map(function(x){return x.trim();}).filter(Boolean);
      S.editing.areas=buildLayout(+$('#qbBed').value||0,+$('#qbBath').value||0,+$('#qbWc').value||0,opts,sp); render(); toast('Areas generated — review and save'); break;
    case 'ed-add': var t=$('#newAreaType').value, same=S.editing.areas.filter(function(a){return a.type===t;}).length; S.editing.areas.push({id:uid('A'),name:same?t+' '+(same+1):t,type:t,items:LIB[t].slice(),notes:''}); render(); break;
    case 'ed-del': S.editing.areas.splice(i,1); render(); break;
    case 'ed-up': if(i>0){ var A=S.editing.areas; A.splice(i-1,0,A.splice(i,1)[0]); render(); } break;
    case 'ed-down': var B=S.editing.areas; if(i<B.length-1){ B.splice(i+1,0,B.splice(i,1)[0]); render(); } break;
    case 'ed-save':
      var e=S.editing; if(!e.name.trim()){ toast('Property name is required'); return; } if(!e.areas.length){ toast('Add at least one area'); return; }
      if(!String(e.address1||'').trim()){ toast('Street address is required'); return; }
      var lp=lettingProblem(e); if(lp){ toast(lp,4000); return; }
      e.address2=noPostcode(e.address2); e.address=joinAddr(e.address1,e.address2);   // the one-line address is always street, suburb
      el.disabled=true; delete e.clonedFrom; api.saveProperty(S.pin,e).then(function(r){ changedHere(); setProps(r.properties); toast('Template saved'); back(); }).catch(function(x){ el.disabled=false; toast('Save failed: '+x.message,4000); }); break;
    case 'ed-archive': ask('Archive this property? It will no longer appear for inspectors (past inspections are kept).',{ok:'Archive'}).then(function(ok){ if(!ok) return;
      api.archiveProperty(S.pin,S.editing.id).then(function(r){ changedHere(); setProps(r.properties); back(); toast('Property archived'); }).catch(function(x){ toast(x.message); }); }); break;
  }
});
document.addEventListener('input',function(ev){
  if(ev.target.id==='subSearch'){ S.subQ=ev.target.value; S.recentShow=10; var sl=$('#subList'); if(sl) sl.innerHTML=submittedListHtml(); return; }
  if(ev.target.id==='setInspector'){ try{ localStorage.setItem('fi-inspector',ev.target.value.trim()); }catch(e){} return; }
  var el=ev.target, b=el.getAttribute('data-bind'), d=S.draft;
  if(el.id==='propSearch'){ $('#propList').innerHTML=propListHtml(el.value); return; }
  if(b==='note'){ var it=d.areas[+el.getAttribute('data-a')].items[+el.getAttribute('data-t')]; it.note=el.value; it.noteAt=nowIso(); persist(); }
  else if(b==='area-notes'){ var a=d.areas[+el.getAttribute('data-a')]; a.notes=el.value; a.notesAt=nowIso(); persist(); }
  else if(b==='overall'){ d.overallNotes=el.value; d.overallNotesAt=nowIso(); persist(); }
  var ed=el.getAttribute('data-ed'); if(ed&&S.editing){ var edWas=S.editing[ed]; S.editing[ed]=el.value;
    if(ed==='rent'&&bondFollows(S.editing.bond,edWas)){ S.editing.bond=bond4(el.value); var eb=document.querySelector('[data-ed=bond]'); if(eb) eb.value=S.editing.bond; }
    if(ed==='rent'||ed==='bond') bondHint(); }
  var ea=el.getAttribute('data-ea'); if(ea&&S.editing){ var ar=S.editing.areas[+el.getAttribute('data-i')];
    if(ea==='items') ar.items=el.value.split('\n').map(function(x){return x.trim();}).filter(Boolean); else ar[ea]=el.value; }
});
document.addEventListener('change',function(ev){
  var el=ev.target;
  if(el.getAttribute('data-bind')==='action' && S.draft){
    var ai=+el.getAttribute('data-a'), ti=+el.getAttribute('data-t'), it=S.draft.areas[ai].items[ti];
    it.action=el.value; it.actionAt=nowIso(); persist(); buzz(10);
    var need=document.querySelector('#it-'+ai+'-'+ti+' .actby-need'); if(need) need.remove();
    return;
  }
  if(el.getAttribute('data-ea')==='type' && S.editing){ var ar=S.editing.areas[+el.getAttribute('data-i')]; ar.type=el.value; if(!ar.items.length) { ar.items=LIB[el.value].slice(); render(); } }
});
$('#camInput').addEventListener('change',function(){ handleFiles(this.files); });
$('#galInput').addEventListener('change',function(){ handleFiles(this.files); });
$('#backBtn').addEventListener('click',back);
function net(){ var b=$('#netBadge'); b.textContent=navigator.onLine?(S.syncing?'Updating…':HAS_GAS?'Online':'Demo'):'Offline'; b.classList.toggle('off',!navigator.onLine); }
window.addEventListener('beforeunload',function(ev){
  var d=S.draft; if(!d || !HAS_GAS) return;
  if(!unsaved(d) && !$('#submitStatus .spin')) return;
  persist(true); Backup.run(d);
  ev.preventDefault(); ev.returnValue='Some of this inspection isn\u2019t saved online yet.'; return ev.returnValue;
});
window.addEventListener('online',function(){ net(); Up.schedule(800); Backup.schedule(3000); flushDiscards(); upStats(); }); window.addEventListener('offline',function(){ net(); upStats(); });
document.addEventListener('visibilitychange',function(){ if(document.hidden){ if(S.draft){ persist(true); Backup.run(S.draft); } } else checkForUpdate(); });
setInterval(function(){ checkForUpdate(); },30*60*1000);

/* ================= Boot ================= */
function loadProps(){
  var seq=S.changeSeq||0;
  return api.bootstrap().then(function(r){ if((S.changeSeq||0)!==seq) return loadProps();   // changed here meanwhile: this reply is out of date
      S.props=r.properties||[]; S.serverVersion=r.version||''; S.retire=r.retire||'';
      if(r.inProgress) setInProgress(r.inProgress);
      if(r.recent){ S.recent=r.recent; S.me=r.me||''; S.recentOffline=false; saveRecent(); }
 setProps(S.props); })
    .catch(function(err){ try{ S.props=JSON.parse(localStorage.getItem('fi-props-cache')||'[]'); }catch(e){ S.props=[]; } S.recentOffline=true;
      var m=(err&&err.message)||''; toast(/access|set up/i.test(m)? m : 'Offline — using saved property list', 6000); });
}
if(!HAS_GAS) $('#demoBanner').classList.remove('hidden');
net();
/* Start from what this phone saved last time (properties, recent and in-progress inspections), then refresh from the
   server in the background. Only the very first open on a phone waits for the server. */
function afterLoad(){ flushDiscards(); autoRestore(); checkForUpdate(true); moveBanner(); }
/* The old app (inside Google's frame) is being replaced by the Rentals app: say so, and say how many photos on this
   phone still have to upload before switching (switching apps doesn't carry photos that haven't uploaded). */
var OLD_APP = HAS_GAS && !window.RENTALS_CONFIG, NEW_APP_URL = 'https://lsproperties.github.io/';
function moveBanner(){
  if(!OLD_APP) return;
  DB.all('drafts').then(function(list){
    var n=0; (list||[]).forEach(function(d){ n+=allPhotos(d).filter(function(x){ return !x.p.uploaded; }).length; });
    var b=$('#moveBanner'); if(!b) return;
    var gone=false; try{ gone=sessionStorage.getItem('fi-move-hide')==='1'; }catch(e){}
    if(gone && !n && S.retire!=='block'){ b.classList.add('hidden'); return; }
    b.innerHTML='🏠 A new <b>Rentals</b> app is replacing this one. <a href="'+NEW_APP_URL+'" target="_blank" rel="noopener" style="color:#fff;font-weight:700">Open the new app</a>'+
      (n? '<br>⚠ <b>'+n+' photo'+(n===1?'':'s')+'</b> on this phone still to upload. Keep this app open with signal until this says 0, then switch.' : '')+
      (S.retire==='block'? '<br>New inspections are started in the new app.' : '')+
      (n||S.retire==='block'? '' : ' <button type="button" data-move="hide" style="background:none;border:0;color:#fff;font:inherit;text-decoration:underline;cursor:pointer">Hide</button>');
    b.classList.remove('hidden');
  }).catch(function(){});
}
document.addEventListener('click',function(e){ if(e.target.closest('[data-move=hide]')){ try{ sessionStorage.setItem('fi-move-hide','1'); }catch(x){} $('#moveBanner').classList.add('hidden'); } });
if(OLD_APP) setInterval(moveBanner, 15000);
var savedProps=null; try{ savedProps=JSON.parse(localStorage.getItem('fi-props-cache')||'null'); }catch(e){}
if(HAS_GAS && savedProps && savedProps.length){
  S.props=savedProps; S.cur={view:'home'}; render();
  S.syncing=true; net();
  loadProps().then(function(){ S.syncing=false; net(); if(S.cur && S.cur.view==='home') render(); afterLoad(); });
} else loadProps().then(function(){ S.cur={view:'home'}; render(); afterLoad(); });
})();