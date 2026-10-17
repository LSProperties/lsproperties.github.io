(function(){
'use strict';
var APP_VERSION = '1.3.1';   // Maintenance page (1.1.0: jobs can be turned off; Manage jobs opens from Setup on the home screen)
var $=function(s,r){ return (r||document).querySelector(s); };
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
function dt(s){ var p=String(s||'').split('-'); return p.length===3? new Date(Date.UTC(+p[0],+p[1]-1,+p[2])) : null; }
function dayName(s){ var d=dt(s); return d? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]+' '+d.getUTCDate()+' '+MONTHS[d.getUTCMonth()].slice(0,3)+' '+d.getUTCFullYear() : ''; }
function shortDay(s){ var d=dt(s); return d? d.getUTCDate()+' '+MONTHS[d.getUTCMonth()]+' '+d.getUTCFullYear() : ''; }

/* ---------- talking to the server (through the Rentals API: shell/api.js), or the demo ---------- */
var DEMO=/[?&]demo\b/.test(location.search);
function api(fn,args){
  if(DEMO) return Demo.call(fn,args||[]);
  return new Promise(function(ok,fail){ var r=google.script.run.withSuccessHandler(ok).withFailureHandler(fail); r[fn].apply(r,args||[]); });
}
function canEdit(){ return DEMO || !window.RentalsSession || window.RentalsSession.level('mt')==='edit'; }

var S={ d:null, view:'list', key:null, filter:'all', other:false, err:'' };

/* 1.2.0: opens straight away from the copy kept on this phone (one per person), then quietly checks with the server.
   The screen is only redrawn from the server's answer on the list, so nothing being typed is lost. */
var CACHE_KEY='mt-cache:'+String(((window.RentalsSession&&window.RentalsSession.get())||{}).email||(DEMO?'demo':'')).toLowerCase();
function readCache(){ try{ var c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null'); return c&&c.tasks?c:null; }catch(e){ return null; } }
function keep(d){ try{ localStorage.setItem(CACHE_KEY,JSON.stringify(d)); }catch(e){} return d; }
function syncHtml(){
  if(S.refreshing) return '<div class="sync"><span class="spin"></span>Checking for changes\u2026</div>';
  if(S.offline) return '<div class="sync">\u26A0\uFE0F Couldn\u2019t check for changes. Showing what was saved on this phone.</div>';
  return '';
}
function load(){
  S.refreshing=true;
  return api('mtBootstrap').then(function(d){ S.refreshing=false; S.offline=false; S.d=keep(d); S.err=''; if(S.view==='list') render(); },
    function(e){ S.refreshing=false; if(S.d){ S.offline=true; if(S.view==='list') render(); } else { S.err=e&&e.message||'Couldn\u2019t load'; render(); } });
}
function nameOf(email){ var n=(S.d&&S.d.names||{})[String(email||'').toLowerCase()]; return n||String(email||'').split('@')[0]||''; }
function typeOf(id){ return (S.d.types||[]).filter(function(t){ return t.id===id; })[0]||{}; }
function taskOf(key){ return (S.d.tasks||[]).filter(function(k){ return k.typeId+'|'+k.propertyId===key; })[0]; }

/* ---------- what each job's state says ---------- */
var ICON={MM:'\uD83D\uDCA7',INS:'\uD83C\uDFE0'};   // each kind of job's picture (anything else: a spanner)
var DOT={overdue:'🔴',due:'🟠',soon:'🟠',ok:'🟢',none:'⚪'};
function statusText(k){
  if(k.status==='overdue') return 'Overdue — was due '+dayName(k.due);
  if(k.status==='due') return 'Due today';
  if(k.status==='soon') return 'Due in '+k.days+' day'+(k.days===1?'':'s')+' — '+dayName(k.due);
  if(k.status==='none') return 'No date recorded yet';
  return 'Next due '+dayName(k.due);
}

/* ---------- screens ---------- */
function render(){
  var back=$('#backBtn'); back.classList.toggle('hidden',S.view==='list');
  $('#title').textContent=S.view==='manage'?'Manage jobs':S.view==='reminders'?'Reminders':'Maintenance';
  var h;
  if(S.err&&!S.d) h='<div class="card err">'+esc(S.err)+'</div><button class="btn" type="button" data-act="reload">Try again</button>';
  else if(!S.d) h='<div class="card"><span class="spin"></span> Loading…</div>';
  else if(S.view==='task') h=taskHtml();
  else if(S.view==='manage') h=manageHtml();
  else if(S.view==='reminders') h='<div id="pushBox"></div>';
  else h=listHtml();
  $('#app').innerHTML=h;
  var tabs=[['list','\uD83D\uDD27','Jobs'],['reminders','\uD83D\uDD14','Reminders']].concat(canEdit()?[['manage','\u2699\uFE0F','Manage jobs']]:[]), cur=S.view==='task'?'list':S.view, nav=$('#mtTabs');
  nav.innerHTML=S.d? tabs.map(function(t){ return '<button type="button" data-tab="'+t[0]+'" class="'+(cur===t[0]?'on':'')+'"'+(cur===t[0]?' aria-current="page"':'')+'><span class="ic" aria-hidden="true">'+t[1]+'</span>'+t[2]+'</button>'; }).join('') : '';
  nav.classList.toggle('hidden',!S.d);
  if(S.view==='reminders'){ var b=$('#pushBox'); if(window.RentalsPush) window.RentalsPush.mount(b,{only:['maintenance']}); else b.innerHTML='<div class="card muted">Reminders can be turned on in the Rentals app on your phone.</div>'; }
  window.scrollTo(0,0);
}
function listHtml(){
  var d=S.d, tasks=(d.tasks||[]).filter(function(k){ return S.filter==='all'||k.typeId===S.filter; });
  var h='';
  if((d.types||[]).length>1) h+='<div class="chips">'+[['all','All jobs']].concat(d.types.filter(function(t){ return t.active; }).map(function(t){ return [t.id,t.name]; }))
    .map(function(c){ return '<button type="button" data-filter="'+esc(c[0])+'" class="'+(S.filter===c[0]?'on':'')+'">'+esc(c[1])+'</button>'; }).join('')+'</div>';
  var need=tasks.filter(function(k){ return /^(overdue|due|soon)$/.test(k.status); }), over=need.filter(function(k){ return k.status==='overdue'; }).length;
  var next=tasks.filter(function(k){ return k.status==='ok'; })[0];
  h+=syncHtml()+'<div class="card hero"><div class="ic" aria-hidden="true">'+(need.length?'\uD83D\uDD14':'\u2705')+'</div><div><div class="big">'+
    (need.length? need.length+' job'+(need.length===1?' needs':'s need')+' doing' : 'Everything\u2019s up to date')+'</div><div class="sub">'+
    (need.length? (over? over+' overdue':'Due soon') : next? 'Next: '+esc(next.typeName.toLowerCase())+' at '+esc(next.property.split(',')[0])+', '+esc(dayName(next.due)) : 'Nothing due')+'</div></div></div>';
  var groups=[['Needs doing',function(k){ return /^(overdue|due|soon)$/.test(k.status); }],['No date recorded yet',function(k){ return k.status==='none'; }],['Up to date',function(k){ return k.status==='ok'; }]];
  groups.forEach(function(g){
    var list=tasks.filter(g[1]); if(!list.length) return;
    h+='<div class="sec">'+esc(g[0])+' ('+list.length+')</div>'+list.map(function(k){
      return '<button type="button" class="card job '+k.status+'" data-task="'+esc(k.typeId+'|'+k.propertyId)+'"><span class="tile" aria-hidden="true">'+(ICON[k.typeId]||'\uD83D\uDD27')+'</span>'+
        '<span class="txt"><b>'+esc(k.property)+'</b><span class="muted">'+esc(k.typeName)+'</span><br><span class="st">'+esc(statusText(k))+'</span></span><span class="chev" aria-hidden="true">\u203A</span></button>';
    }).join('');
  });
  if(!tasks.length) h+='<div class="card muted">Nothing to show. Jobs appear here for active properties: tick <b>Has a Moisture Master unit</b> on a property in Tenancies › Setup › Properties.</div>';
  h+=(canEdit()?'':'<p class="small muted">You can look at everything here, but not record or change anything.</p>');
  return h;
}
function taskHtml(){
  var k=taskOf(S.key); if(!k) return '<div class="card">That job is no longer on the list.</div>';
  var t=typeOf(k.typeId), hist=(S.d.log||[]).filter(function(e){ return e.typeId===k.typeId&&e.propertyId===k.propertyId; }).sort(function(a,b){ return b.doneOn.localeCompare(a.doneOn)||b.row-a.row; });
  var col={overdue:'bad',due:'warn',soon:'warn',ok:'ok',none:'none'}[k.status];
  var h='<div class="card"><div class="title" style="font-size:1.3rem">'+esc(k.property)+'</div><div class="muted">'+esc(k.typeName)+' · every '+t.every+' month'+(t.every===1?'':'s')+'</div>'+
    '<div class="big-status" style="background:var(--'+col+'-soft);color:var(--'+col+')">'+DOT[k.status]+' '+esc(statusText(k))+'</div>'+
    (k.lastDone?'<div>Last done <b>'+esc(shortDay(k.lastDone))+'</b>'+(k.lastBy?' by '+esc(nameOf(k.lastBy)):'')+'</div>':'')+
    (t.howTo?'<p class="small muted" style="margin-block:10px 0">'+esc(t.howTo)+'</p>':'')+'</div>';
  if(canEdit()){
    // the big button first; the note is tucked away (read when either button is used)
    h+='<div class="card">'+
      (S.other?'<label class="fld" style="margin-block-start:0"><span>The day it was done</span><input type="date" id="doneOn" max="'+esc(S.d.today)+'" value="'+esc(S.d.today)+'"></label>'+
          '<button class="btn primary big" type="button" data-act="done-on">✓ Save</button>'+
          '<div style="margin-block-start:10px"><button class="btn sm" type="button" data-act="other-off">Cancel</button></div>'
        :'<button class="btn primary big" type="button" data-act="done">✓ Done today</button>'+
          '<div style="margin-block-start:12px"><button class="btn" type="button" data-act="other">It was done on a different day</button></div>')+
      '<details style="margin-block-start:14px"><summary class="muted" style="cursor:pointer;font-weight:700">Add a note (optional)</summary>'+
        '<textarea id="note" maxlength="500" placeholder="e.g. used the last spare filter" style="margin-block-start:8px"></textarea></details>'+
      '<div id="taskErr" class="err" style="margin-block-start:10px"></div></div>';
  }
  h+='<div class="sec">History</div><div class="card">'+(hist.length?hist.map(function(e){
    return '<div class="hist"><span style="flex:1"><b>'+esc(shortDay(e.doneOn))+'</b> · '+esc(nameOf(e.by))+(e.note?'<div class="small muted">'+esc(e.note)+'</div>':'')+'</span>'+
      (canEdit()?'<button class="btn sm danger" type="button" data-del="'+e.row+'">Remove</button>':'')+'</div>';
  }).join(''):'<div class="muted">Nothing recorded yet'+(k.typeId==='INS'&&k.lastDone?' here (the date above is from the property’s insulation details).':'.')+'</div>')+'</div>';
  return h;
}
function manageHtml(){
  return '<p class="small muted" style="margin:4px 6px 12px">How often each job is done, and how many days ahead the reminder comes.</p>'+(S.d.types||[]).map(function(t){
    return '<div class="card" data-type="'+esc(t.id)+'"'+(t.active?'':' style="opacity:.75"')+'><div class="title">'+esc(t.name)+(t.active?'':' <span class="st" style="background:var(--none-soft);color:var(--none)">Off</span>')+'</div>'+
      '<div class="small muted">'+(/moisture/i.test(t.appliesTo)?'At properties with <b>Has a Moisture Master unit</b> ticked (Setup › Properties)':'At every active property')+'</div>'+
      // 1.1.0: a job can be turned off (it leaves the list and sends no reminders; its history is kept)
      '<label class="switch"><input type="checkbox" data-k="active"'+(t.active?' checked':'')+'>Active (on the list, with reminders)</label>'+
      '<div class="pair">'+
      '<label class="fld"><span>Every (months)</span><input type="number" inputmode="numeric" min="1" max="60" step="1" data-k="every" value="'+t.every+'"></label>'+
      '<label class="fld"><span>Remind (days before)</span><input type="number" inputmode="numeric" min="0" max="90" step="1" data-k="remind" value="'+t.remind+'"></label></div>'+
      '<label class="fld"><span>How to (shown on each job)</span><textarea data-k="howTo" maxlength="500">'+esc(t.howTo)+'</textarea></label>'+
      '<button class="btn primary" type="button" data-save-type="'+esc(t.id)+'">Save</button> <span class="err" data-type-err></span></div>';
  }).join('');
}

/* ---------- actions ---------- */
var toastTimer=null;
function toast(msg,undo){
  var t=$('#toast'); t.innerHTML='<span>'+esc(msg)+'</span>'+(undo?'<button type="button" data-undo="'+esc(undo)+'">Undo</button>':'');
  t.classList.remove('hidden'); clearTimeout(toastTimer); toastTimer=setTimeout(function(){ t.classList.add('hidden'); },undo?9000:3500);
}
function busy(b,p){ if(b){ b.disabled=true; b.dataset.label=b.textContent; b.textContent='Saving…'; } return p.then(function(r){ if(b){ b.disabled=false; b.textContent=b.dataset.label; } return r; },function(e){ if(b){ b.disabled=false; b.textContent=b.dataset.label; } throw e; }); }
function markDone(b,ymd){
  var k=taskOf(S.key), note=($('#note')||{}).value||'';
  busy(b,api('mtMarkDone',[k.typeId,k.propertyId,ymd||'',note])).then(function(d){
    S.d=keep(d); S.other=false;
    var mine=(d.log||[]).filter(function(e){ return e.typeId===k.typeId&&e.propertyId===k.propertyId; }).sort(function(a,b){ return b.row-a.row; })[0];
    var n=taskOf(S.key); render(); toast('Recorded'+(n&&n.due?'. Next due '+dayName(n.due):'')+'.',mine?mine.row:'');
  },function(e){ var x=$('#taskErr'); if(x) x.textContent=e&&e.message||'Couldn’t save'; });
}
function removeEntry(row,b){
  var k=taskOf(S.key); if(!k) return;
  return busy(b,api('mtDeleteEntry',[Number(row),k.typeId,k.propertyId])).then(function(d){ S.d=keep(d); render(); toast('Removed.'); },function(e){ toast(e&&e.message||'Couldn’t remove it'); });
}
document.addEventListener('click',function(e){
  var t=e.target.closest('button'); if(!t) return;
  if(t.id==='backBtn'){ if(S.fromSetup&&S.view==='manage'){ location.href='../#setup'; return; } S.view='list'; S.other=false; render(); return; }
  if(t.dataset.tab){ S.view=t.dataset.tab; S.other=false; S.fromSetup=false; render(); return; }   // the bottom menu
  if(t.dataset.task){ S.key=t.dataset.task; S.view='task'; S.other=false; render(); return; }
  if(t.dataset.filter){ S.filter=t.dataset.filter; render(); return; }
  if(t.dataset.undo){ $('#toast').classList.add('hidden'); removeEntry(t.dataset.undo,null); return; }
  if(t.dataset.del){ if(confirm('Remove this entry from the history?')) removeEntry(t.dataset.del,t); return; }
  if(t.dataset.saveType){
    var c=t.closest('[data-type]'), v=function(k){ return $('[data-k="'+k+'"]',c).value; }, er=$('[data-type-err]',c);
    busy(t,api('mtSaveType',[t.dataset.saveType,{every:Number(v('every')),remind:Number(v('remind')),howTo:v('howTo'),active:$('[data-k="active"]',c).checked}])).then(function(d){ S.d=keep(d); render(); toast('Saved.'); },function(x){ er.textContent=x&&x.message||'Couldn’t save'; });
    return;
  }
  var a=t.dataset.act;
  if(a==='reload'){ S.err=''; render(); load(); }
  else if(a==='manage'||a==='reminders'){ S.view=a; render(); }
  else if(a==='done') markDone(t,'');
  else if(a==='other'){ S.other=true; render(); }
  else if(a==='other-off'){ S.other=false; render(); }
  else if(a==='done-on'){ var v=($('#doneOn')||{}).value; if(!v){ $('#taskErr').textContent='Choose the day.'; return; } markDone(t,v); }
});

/* ---------- demo (?demo): sample jobs, kept in memory ---------- */
var Demo={
  d:null,
  init:function(){
    var today=new Date(), iso=function(x){ return x.toISOString().slice(0,10); }, ago=function(m,dd){ var x=new Date(today); x.setMonth(x.getMonth()-m); x.setDate(x.getDate()+(dd||0)); return iso(x); };
    this.d={ version:APP_VERSION, today:iso(today), names:{'dad@example.com':'Dad'},
      types:[{id:'MM',name:'Moisture Master filter change',every:12,remind:7,appliesTo:'Moisture Master',howTo:'Change the filter in the Moisture Master unit.',active:true},
             {id:'INS',name:'Ceiling insulation inspection',every:12,remind:7,appliesTo:'All properties',howTo:'Check the ceiling insulation is in place and in reasonable condition.',active:true}],
      props:[{propertyId:'P1',label:'12 Smith Street, Mornington',mm:true},{propertyId:'P2',label:'3 Anzac Avenue, Dunedin',mm:true},{propertyId:'P3',label:'9 Hill Road, Mosgiel',mm:false}],
      log:[{row:2,typeId:'MM',propertyId:'P1',doneOn:ago(12,-3),by:'dad@example.com',note:''},{row:3,typeId:'MM',propertyId:'P2',doneOn:ago(12,5),by:'dad@example.com',note:'Spare filter in the garage'},
           {row:4,typeId:'INS',propertyId:'P1',doneOn:ago(4),by:'dad@example.com',note:''},{row:5,typeId:'INS',propertyId:'P2',doneOn:ago(11,-20),by:'dad@example.com',note:''}],
      next:6 };
  },
  state:function(){
    var d=this.d, today=d.today, add=function(s,m){ var x=new Date(s+'T00:00:00Z'); x.setUTCMonth(x.getUTCMonth()+m); return x.toISOString().slice(0,10); }, tasks=[];
    d.types.filter(function(t){ return t.active; }).forEach(function(t){ d.props.forEach(function(p){
      if(/moisture/i.test(t.appliesTo)&&!p.mm) return;
      var mine=d.log.filter(function(e){ return e.typeId===t.id&&e.propertyId===p.propertyId; }).sort(function(a,b){ return a.doneOn.localeCompare(b.doneOn); }).pop();
      var due=mine?add(mine.doneOn,t.every):'', days=due?Math.round((new Date(due)-new Date(today))/864e5):null;
      tasks.push({typeId:t.id,typeName:t.name,propertyId:p.propertyId,property:p.label,lastDone:mine?mine.doneOn:'',lastBy:mine?mine.by:'',due:due,days:days,
        status:!due?'none':days<0?'overdue':days===0?'due':days<=t.remind?'soon':'ok'});
    }); });
    var rank={overdue:0,due:1,soon:2,none:3,ok:4};
    tasks.sort(function(a,b){ return rank[a.status]-rank[b.status]||(a.due||'').localeCompare(b.due||''); });
    return JSON.parse(JSON.stringify({version:d.version,today:today,names:d.names,types:d.types,tasks:tasks,log:d.log}));
  },
  call:function(fn,a){
    var self=this; if(!this.d) this.init();
    return new Promise(function(ok,fail){ setTimeout(function(){
      try{
        if(fn==='mtMarkDone') self.d.log.push({row:self.d.next++,typeId:a[0],propertyId:a[1],doneOn:a[2]||self.d.today,by:'dad@example.com',note:a[3]||''});
        else if(fn==='mtDeleteEntry') self.d.log=self.d.log.filter(function(e){ return e.row!==a[0]; });
        else if(fn==='mtSaveType'){ var t=self.d.types.filter(function(x){ return x.id===a[0]; })[0]; t.every=a[1].every; t.remind=a[1].remind; t.howTo=a[1].howTo; if(a[1].active!==undefined) t.active=!!a[1].active; }
        ok(self.state());
      }catch(e){ fail(e); }
    },250); });
  }
};
if(DEMO) $('#demoBanner').classList.remove('hidden');
if(location.hash==='#manage'&&canEdit()){ S.view='manage'; S.fromSetup=true; try{ history.replaceState(null,'',location.pathname+location.search); }catch(x){} }   // from Setup on the home screen
S.d=readCache();   // the saved copy first (if there is one), then the server
if(S.d) render();
load();
})();