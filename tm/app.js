(function(){
'use strict';

var APP_VERSION = '3.17.5';  // shown on the home screen - must match TM.VERSION in TenantApp.gs; bump both on every change
var TENANCY = ['12 months','6 months','Periodic','Fixed term (other)'];
var REF_STATUSES = ['Not started','No contact','Completed','Not required'];
var OUTCOMES = ['Positive','Neutral','Concern'];

/* ================= Helpers ================= */
function $(s,r){ return (r||document).querySelector(s); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
function fmt(iso){ if(!iso) return ''; var d=new Date(iso); if(isNaN(d)) return iso; return d.toLocaleString('en-NZ',{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}); }
function fmtDate(iso){ if(!iso) return ''; var d=new Date(iso); if(isNaN(d)) return iso; return d.toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'}); }
function money(v){ if(v===''||v==null) return ''; var n=Number(v); return isFinite(n)? '$'+n.toLocaleString('en-NZ',{maximumFractionDigits:2})+' pw' : String(v); }
function initials(n){ return String(n||'?').trim().split(/\s+/).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase(); }
function toast(msg,ms){ var t=$('#toast'); t.innerHTML='<span>'+esc(msg)+'</span>'; clearTimeout(toast._t); toast._t=setTimeout(function(){t.innerHTML='';},ms||2600); }
function pad(n){ return (n<10?'0':'')+n; }
function localInput(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes()); }
function dateInput(iso){ if(!iso) return ''; var d=new Date(iso); return isNaN(d)? '' : d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function telHref(p){ return 'tel:'+String(p||'').replace(/[^\d+]/g,''); }
function smsHref(p,body){ return 'sms:'+String(p||'').replace(/[^\d+]/g,'')+(body?'?&body='+encodeURIComponent(body):''); }
/* The text to a referee: who gave their number (everyone in the group who did), signed from My details.
   No address: a referee isn't told where the applicant is moving. */
function refSmsText(c,app,others){
  var first=String(c.contact||'').trim().split(/\s+/)[0]||'', names=[app.name].concat((others||[]).map(function(o){ return o.applicant; })).filter(Boolean);
  var me=myName();
  return 'Hi'+(first?' '+first:'')+', I was given your number by '+nameList(names)+' as a reference for their rental application. '+
    'Can you please let me know a good time to call and ask a couple of questions? Many thanks'+(me?', '+me:'');
}
/* ---- Email addresses: checked as they're typed, so a form or agreement never goes to an address Gmail will refuse ----
   cleanEmail: drops spaces at the ends, invisible characters pasted in with it and a "mailto:".
   emailProblem: '' if fine, else what's wrong ("has two dots in a row"). emailSuggest: a likely fix for a misspelt
   provider (gmial.com -> gmail.com), offered but never forced. Every email box gets this as it's typed in. */
function cleanEmail(v){ return String(v==null?'':v).replace(/[\u200B-\u200D\u2060\uFEFF\u00A0]/g,'').replace(/^\s*mailto:/i,'').trim(); }
function emailProblem(v){
  v=cleanEmail(v); if(!v) return '';
  if(/\s/.test(v)) return 'has a space in it';
  var at=v.split('@'); if(at.length<2) return 'is missing the @'; if(at.length>2) return 'has more than one @';
  var local=at[0], domain=at[1];
  if(!local) return 'is missing the part before the @';
  if(!domain) return 'is missing the part after the @';
  if(/^\.|\.$/.test(local)||/\.\./.test(local)) return 'has a dot in the wrong place before the @';
  if(!/^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+$/.test(local)) return 'has a character email addresses can\u2019t contain';
  if(!/\./.test(domain)) return 'is missing the ending (e.g. .com or .co.nz)';
  if(/^\.|\.$/.test(domain)||/\.\./.test(domain)) return 'has a dot in the wrong place after the @';
  var labels=domain.split('.');
  if(!labels.every(function(l){ return /^[A-Za-z0-9-]+$/.test(l) && !/^-|-$/.test(l); })) return 'has a character email addresses can\u2019t contain';
  if(!/^[A-Za-z]{2,}$/.test(labels[labels.length-1])) return 'doesn\u2019t end properly (e.g. .com or .co.nz)';
  if(v.length>254) return 'is too long';
  return '';
}
function validEmail(v){ return !emailProblem(v); }
var EMAIL_DOMAINS=['gmail.com','googlemail.com','mail.com','email.com','ymail.com','aol.com','gmx.com','zoho.com','fastmail.com','hey.com','hotmail.com.au','outlook.com.au','live.com.au','bigpond.com','optusnet.com.au','xnet.co.nz','snap.net.nz','ihug.co.nz','kinect.co.nz','hotmail.com','outlook.com','yahoo.com','icloud.com','live.com','me.com','xtra.co.nz','hotmail.co.nz','yahoo.co.nz','outlook.co.nz','live.co.nz','windowslive.com','msn.com','protonmail.com','proton.me','orcon.net.nz','vodafone.co.nz','slingshot.co.nz','actrix.co.nz','clear.net.nz','paradise.net.nz','inspire.net.nz'];
function emailSuggest(v){
  v=cleanEmail(v); if(emailProblem(v)&&!/end properly|missing the ending/.test(emailProblem(v))) return '';
  var at=v.lastIndexOf('@'); if(at<1) return '';
  var local=v.slice(0,at), domain=v.slice(at+1).toLowerCase();
  if(EMAIL_DOMAINS.indexOf(domain)>=0) return '';
  var fixed=domain.replace(/\.con$|\.cmo$|\.ocm$|\.vom$|\.xom$|\.comm$|\.cim$/,'.com').replace(/\.conz$|\.co\.n$|\.co\.nzz$|\.co\.mz$|\.co\.bz$|\.cp\.nz$|\.co\.za$/,'.co.nz');
  if(fixed==='gmail.co.nz'||fixed==='gmail.co') fixed='gmail.com';
  if(EMAIL_DOMAINS.indexOf(fixed)>=0 && fixed!==domain) return local+'@'+fixed;
  // one or two letters off a common provider (gmial.com, hotmial.com, outlok.com)
  function dist(a,b){ var d=[],i,j; for(i=0;i<=a.length;i++){ d[i]=[i]; } for(j=0;j<=b.length;j++) d[0][j]=j;
    for(i=1;i<=a.length;i++) for(j=1;j<=b.length;j++){ d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1]) d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1); }
    return d[a.length][b.length]; }
  var best='',bd=3; EMAIL_DOMAINS.forEach(function(c){ var n=dist(fixed,c); if(n<bd && n<=(c.length>9?2:1)){ bd=n; best=c; } });
  return best? local+'@'+best : '';
}
/* the note under an email box: what's wrong (once they've left the box), or a suggested fix (tap to use it) */
function emailHint(input,final){
  var v=cleanEmail(input.value), p=emailProblem(v), s=p&&!/end properly|missing the ending/.test(p)? '' : emailSuggest(v), box=input.parentNode;
  var h=box.querySelector('.emhint'); if(!h){ h=document.createElement('div'); h.className='emhint small'; h.setAttribute('role','status'); h.style.marginBlockStart='4px'; box.appendChild(h); }
  if(p && final){ h.style.color='var(--bad)'; h.innerHTML='This email address '+esc(p)+'.'+(s?' Did you mean <button type="button" class="linkbtn" data-em-fix="'+esc(s)+'">'+esc(s)+'</button>?':''); input.setAttribute('aria-invalid','true'); return; }
  input.removeAttribute('aria-invalid');
  if(s && (final || !p)){ h.style.color=''; h.innerHTML='Did you mean <button type="button" class="linkbtn" data-em-fix="'+esc(s)+'">'+esc(s)+'</button>?'; return; }
  h.innerHTML='';
}
document.addEventListener('input',function(e){ var t=e.target; if(t&&t.type==='email') emailHint(t,false); },true);
document.addEventListener('focusout',function(e){ var t=e.target; if(!t||t.type!=='email') return;
  var c=cleanEmail(t.value); if(c!==t.value){ t.value=c; t.dispatchEvent(new Event('input',{bubbles:true})); }
  emailHint(t,true); },true);
document.addEventListener('click',function(e){ var b=e.target.closest&&e.target.closest('[data-em-fix]'); if(!b) return;
  var hb=b.closest('.emhint'), input=hb&&hb.parentNode.querySelector('input[type=email]'); if(!input) return;
  e.preventDefault(); input.value=b.getAttribute('data-em-fix'); input.dispatchEvent(new Event('input',{bubbles:true})); input.dispatchEvent(new Event('change',{bubbles:true})); emailHint(input,true); },true);
function buzz(){ try{ if(navigator.vibrate) navigator.vibrate(12); }catch(e){} }

/* ================= Backend (Apps Script, or an in-browser demo) ================= */
var HAS_GAS = !!(window.google && google.script && google.script.run);
function gas(fn){
  var args=[].slice.call(arguments,1);
  return new Promise(function(res,rej){
    var r=google.script.run.withSuccessHandler(res).withFailureHandler(function(e){ rej(new Error((e&&e.message)||String(e))); });
    r[fn].apply(r,args);
  });
}
var api = {};
/* calls that only read: they don't hold the leave-page warning */
var TM_READS = /^tm(Bootstrap|Refresh|GetVersion|GetReferences|CreditDetails|PhotoIdFile|DriveFile|ScreeningQuestions|TribunalSearch|GetProgress|AgreementSearch|AgreementFields|CheckTemplate|PreviewAgreement|TenancySummary|BodyCorporateFiles|TenantProfile|GroupDeletePlan|AgreementProgress|ChangeProgress|RefreshAgreement|RefreshTenancyChange)$/;
/* Speed check: the last 40 calls (in memory only) */
function speedNote(fn,ms,timing,ok){ S.speed=S.speed||[]; S.speed.unshift({fn:fn,ms:ms,server:timing?timing.serverMs:null,parts:timing?timing.parts:null,ok:ok,at:new Date().toISOString()}); S.speed=S.speed.slice(0,40); }
['tmBootstrap','tmSaveViewing','tmSetViewingStatus','tmSaveAttendee','tmRemoveAttendee','tmSendApplications','tmRefresh',
 'tmUpdateApplication','tmGetReferences','tmCreditDetails','tmPhotoIdFile','tmDriveFile','tmScreeningQuestions','tmSaveScreeningQuestions','tmSaveReferenceCheck','tmAddContact','tmMarkEmailSent','tmGetVersion','tmSetGroup','tmDetachFromViewing','tmDeleteViewing','tmResendApplyLink','tmCancelApplyForm','tmCreateGroup','tmUpdateGroupDetails','tmAddToGroup','tmSetGroupArrival','tmSetAttendance','tmMoveGroupToViewing','tmSaveTribunalCheck','tmTribunalSearch','tmGetProgress','tmSaveAgreementSettings','tmSendAgreement','tmRefreshAgreement','tmCancelAgreement',
 'tmSaveProperty','tmSetPropertyActive','tmSaveLandlord','tmDeleteLandlord','tmSaveTenancy','tmDeleteTenancy','tmCreateTenancyFromGroup',
 'tmRecordBondPayment','tmDeleteBondPayment','tmSendBondReceipt','tmMarkBondLodged','tmSetBondNumber','tmSetBondMethod',
 'tmPreviewAgreement','tmResendAgreementLink','tmChangeTenants','tmRefreshTenancyChange','tmCancelTenancyChange','tmResendChangeLink','tmSetBondTask','tmTenancySummary','tmSaveTermsMaster','tmCopyTermsToProperties','tmBodyCorporateFiles','tmUploadBodyCorporateRules','tmTenantProfile','tmSaveTenantProfile','tmGroupDeletePlan','tmDeleteGroup','tmSetAdminPin','tmSavePerson','tmMergePeople','tmAgreementProgress','tmChangeProgress','tmSaveMyProfile','tmTestCreateGroup','tmTestSendForms','tmTestFillForm','tmTestApprove','tmTestSendAgreement','tmTestSignNext','tmTestStartChange','tmTestNextName','tmTestFinish'].forEach(function(n){
  api[n]=function(){ var a=[].slice.call(arguments), t0=Date.now(), w=!TM_READS.test(n);
    if(w) S.saving=(S.saving||0)+1;   // a save in progress: leaving the page now could lose it
    // every call is timed for Setup > Speed check: round trip here, and the server's own time when it reports it
    return (HAS_GAS? gas.apply(null,[n].concat(a)) : Demo.call(n,a)).then(function(r){ if(w){ S.saving--; S.dirtyEl=null; } speedNote(n,Date.now()-t0,r&&r.timing,true); return r; },
      function(e){ if(w) S.saving--; speedNote(n,Date.now()-t0,null,false); throw e; }); };
});

/* ================= State & navigation ================= */
var S = { st:null, stack:[], cur:null, filter:'active', q:'', refs:{}, join:{}, tab:(function(){ try{ var v=localStorage.getItem('tm-tab'); return ['viewings','groups','tenancies','setup'].indexOf(v)>=0?v:(v?'groups':'viewings'); }catch(e){ return 'viewings'; } })(), tfilter:'current', gfilter:'active', people:null };
function go(view,arg){ if(S.cur) S.stack.push(S.cur); S.cur={view:view,arg:arg}; S.sectVisit={}; render(); window.scrollTo(0,0); }
function back(){ var p=S.stack.pop(); S.cur=p||{view:'home'}; S.sectVisit={}; render(); window.scrollTo(0,0); }
function home(){ S.stack=[]; S.cur={view:'home'}; S.sectVisit={}; render(); window.scrollTo(0,0); }
function setFooter(html){ var f=$('#footer'); if(html){ $('#footerIn').innerHTML=html; f.classList.remove('hidden'); } else f.classList.add('hidden'); }
function setTitle(t){ $('#title').textContent=t; $('#backBtn').classList.toggle('hidden', S.cur.view==='home'); }
/* Leaving the page (refresh, closing the tab, the update link) while a save is running or a form on screen has
   typing that hasn't been saved: the browser asks first. iPhones don't show this warning. */
function unsavedWork(){ return (S.saving||0)>0 || !!(S.dirtyEl && document.contains(S.dirtyEl)); }
document.addEventListener('input',function(ev){
  var el=ev.target; if(!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
  if(el.type==='search' || /^(peQ|pplSearch|grpSearch)$/.test(el.id||'')) return;   // searches aren't work to lose
  S.dirtyEl=el;
},true);
window.addEventListener('beforeunload',function(ev){
  if(!unsavedWork()) return;
  ev.preventDefault(); ev.returnValue='You have changes that haven\u2019t been saved yet.'; return ev.returnValue;
});
/* ================= Redrawing without flicker =================
   When the same screen is drawn again (fresh data from the server, a save, a tick), only what changed is updated in
   place: cards don't replay their entrance animation, pictures don't reload, open sections stay open, the box being
   typed in is left alone and the page doesn't jump. Going to a different screen draws it fresh, with its animation.
   Views keep writing $('#app').innerHTML as before; the main area and the footer route that through paintInto(), and
   so does any element marked data-paint (a box or list updated on its own). A data-paint box that is also data-later is
   filled after the screen draws (references, last inspection): a whole-screen update leaves what it has loaded alone. */
var Paint={key:'',same:false};
function paintKey(){ return S.cur.view+'|'+JSON.stringify(S.cur.arg===undefined?null:S.cur.arg)+'|'+(S.tab||''); }
function paintKeyOf(n){ return n.nodeType===1? n.tagName+'#'+(n.id||'')+'@'+(n.getAttribute('data-id')||'')+'@'+(n.getAttribute('data-key')||'') : '#'+n.nodeType; }
function paintChildren(from,to){
  var kids=[].slice.call(to.childNodes), i=0;
  kids.forEach(function(n){
    var o=from.childNodes[i], k=paintKeyOf(n);
    if(o && paintKeyOf(o)===k){ paintNode(o,n); i++; return; }
    // the same thing further on (an item removed above it): move it up rather than draw it again
    if(n.nodeType===1 && (n.id||n.getAttribute('data-id')||n.getAttribute('data-key'))){
      for(var j=i+1;j<from.childNodes.length;j++){ var c=from.childNodes[j]; if(paintKeyOf(c)===k){ from.insertBefore(c,o); paintNode(c,n); i++; return; } }
    }
    from.insertBefore(n,o||null); i++;   // new: it comes in with its animation
  });
  while(from.childNodes.length>i) from.removeChild(from.lastChild);
}
function paintNode(o,n){
  if(o.nodeType!==1){ if(o.nodeValue!==n.nodeValue) o.nodeValue=n.nodeValue; return; }
  var tag=o.tagName, active=o===document.activeElement, keepOpen=tag==='DETAILS';
  [].slice.call(o.attributes).forEach(function(a){ if(!n.hasAttribute(a.name) && !(keepOpen && a.name==='open')) o.removeAttribute(a.name); });
  [].slice.call(n.attributes).forEach(function(a){ if(keepOpen && a.name==='open') return; if(o.getAttribute(a.name)!==a.value) o.setAttribute(a.name,a.value); });
  if(o._painted!==undefined && o.hasAttribute('data-later')) return;   // filled on its own: keep what it has loaded
  if(tag==='TEXTAREA'){ if(!active && o.value!==n.value) o.value=n.value; return; }
  if(tag==='INPUT' && !active){
    if(o.type==='checkbox'||o.type==='radio') o.checked=n.hasAttribute('checked');
    else if(o.type!=='file'){ var v=n.getAttribute('value')||''; if(o.value!==v) o.value=v; }
  }
  paintChildren(o,n);
  if(tag==='SELECT' && !active && o.selectedIndex!==n.selectedIndex) o.selectedIndex=n.selectedIndex;
}
function paintInto(el,html){
  if(el._painted===html) return;   // nothing changed: leave the screen exactly as it is
  var t=document.createElement('template'); t.innerHTML=html;
  paintChildren(el,t.content); el._painted=html;
}
(function(){
  var d=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  Object.defineProperty(Element.prototype,'innerHTML',{configurable:true,get:function(){ return d.get.call(this); },
    set:function(h){ if(this.nodeType===1 && this.hasAttribute('data-paint')) paintInto(this,String(h)); else d.set.call(this,h); }});
  ['app','footerIn'].forEach(function(id){
    var el=document.getElementById(id); if(!el) return;
    Object.defineProperty(el,'innerHTML',{configurable:true,get:function(){ return d.get.call(this); },
      set:function(h){ h=String(h); if(Paint.same) paintInto(this,h); else { d.set.call(this,h); this._painted=h; } }});
  });
})();
function render(){
  var pk=paintKey(); Paint.same=pk===Paint.key; Paint.key=pk;   // the same screen again: update in place
  // filter strips scroll sideways on a phone: remember where they were so a redraw doesn't jump back to the start
  var view=S.cur.view+'|'+S.tab, keep=S.filterView===view? [].map.call(document.querySelectorAll('.filters'),function(f){ return f.scrollLeft; }) : [];
  var fn=VIEWS[S.cur.view], cur=S.cur; setFooter(null);
  Promise.resolve(fn(S.cur.arg)).then(function(){ S.filterView=view; keepFilters(keep); if(S.cur===cur) Paint.key=paintKey(); })   // the view may have chosen its tab
    .catch(function(e){ $('#app').innerHTML='<div class="card">Couldn\u2019t open this screen: '+esc(e.message)+'</div>'; });
}
/* puts each filter strip back where it was, then makes sure the chosen filter can be seen */
function keepFilters(keep){
  [].forEach.call(document.querySelectorAll('.filters'),function(f,i){
    if(keep[i]) f.scrollLeft=keep[i];
    var on=f.querySelector('button.on'); if(!on) return;
    var fr=f.getBoundingClientRect(), br=on.getBoundingClientRect();
    if(br.left<fr.left) f.scrollLeft-=fr.left-br.left+12;
    else if(br.right>fr.right) f.scrollLeft+=br.right-fr.right+12;
  });
}
/* DocHub statuses can reach the sheet in different casings/spellings ("in progress", "IN_PROGRESS") - normalise them */
var CANON={'draft':'Draft','ready':'Ready','send pending':'Send Pending','sent':'Sent','in progress':'In Progress','finalized':'Finalized','finalised':'Finalized',
  'rejected':'Rejected','voided':'Voided','expired':'Expired','error':'Error','bounce':'Error','preparing':'Sent'};
function canonStatus(v){ var k=String(v||'').trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' '); return CANON[k]||String(v||'').trim(); }
/* The form counts as opened once DocHub reports it in progress (or done), even if no "viewed" time came back */
function isOpened(a){ return !!a.viewedAt || a.status==='In Progress' || a.status==='Finalized'; }
function apply(st){ if(st&&st.applications){
    // A reply made before the one already shown (a refresh that started before a delete or save, but finished after it)
    // is out of date: keep what's shown, so a deleted record can't come back.
    if(S.st && S.st.serverTime && st.serverTime && st.serverTime<S.st.serverTime) return S.st;
    st.applications.forEach(function(a){ a.status=canonStatus(a.status)||'Draft'; });
    if(st.propertiesError && S.propErrShown!==st.propertiesError){ S.propErrShown=st.propertiesError; toast('Property list: '+st.propertiesError,6000); }
    // the copy kept on this phone always matches the server's latest reply; if the phone won't store it, none is kept
    S.st=st; try{ localStorage.setItem('tm-cache',JSON.stringify(st)); }catch(e){ try{ localStorage.removeItem('tm-cache'); }catch(x){} }
    if((st.matched||[]).length){ var mm=st.matched.map(function(x){ var pp=personById(x.personId); return x.as+(pp?' ('+pp.status+')':''); }); toast('Already known: '+nameList(mm)+'. Linked to their person record.',6000); } } return st; }
function apps(){ return (S.st&&S.st.applications)||[]; }
/* The signed-in user's details (Setup > My details) */
function myProfile(){ return (S.st&&S.st.profile)||{}; }
/* the name to put on things: their profile name, else a name they typed before (never an email address) */
function myName(){ var p=myProfile(), typed=localStorage.getItem('tm-checker')||''; return p.name || (/@/.test(typed)?'':typed); }
/* email sign-off lines under "Thank you," / "Kind regards,": name, then a phone number */
function mySignoff(){ var p=myProfile(); return [myName()||p.email||'', p.mobile||p.phone||''].filter(Boolean).join('\n'); }
/* ---------- People (data model 2): one record per person, with their history ---------- */
var PERSON_STATUSES=['Tenant','Applicant','Past Tenant','Past Applicant','Viewer'];
function persons(){ return (S.st&&S.st.people)||[]; }
function personById(id){ return id? persons().find(function(p){ return p.id===id; }) : null; }
/* "Fangqian Lu (Cindy)" when they go by another name */
function nameWithKnown(name,known){ return esc(name)+(known?' <span class="muted">('+esc(known)+')</span>':''); }
/* The name someone goes by, when it's different from their name: their own record, else their person record (by id, then email) */
function knownOf(o){
  if(!o) return '';
  var k=o.knownAs;
  if(k===undefined){ var pp=(o.personId&&personById(o.personId))||(o.email&&persons().find(function(x){ return x.email&&String(x.email).toLowerCase()===String(o.email).toLowerCase(); })); k=pp&&pp.knownAs; }
  k=String(k||'').trim();
  return k&&nameKey(k)!==nameKey(o.name)? k : '';
}
/* "Fangqian Lu (Cindy)": as text, and as HTML with the known-as name muted */
function whoText(o){ var k=knownOf(o); return String((o&&o.name)||'')+(k?' ('+k+')':''); }
function whoHtml(o){ return nameWithKnown((o&&o.name)||'',knownOf(o)); }
function personPill(st){ return '<span class="pill '+({Tenant:'st-done',Applicant:'st-sent'}[st]||'')+'">'+esc(st||'Viewer')+'</span>'; }
function personApps(id){ return apps().filter(function(a){ return a.personId===id; }).sort(function(a,b){ return String(b.attendedAt||b.sentAt||'').localeCompare(String(a.attendedAt||a.sentAt||'')); }); }
function personTenancies(id){ return tenancies().filter(function(t){ return (t.tenants||[]).concat(t.formerTenants||[]).some(function(p){ return p.personId===id; }); }); }
function nameKey(n){ return String(n||'').toLowerCase().replace(/[^a-z\s]/g,'').replace(/\s+/g,' ').trim(); }
/* people who might be the same person: the same name, or the same first and last name */
function personDupes(p){
  var k=nameKey(p.name), w=k.split(' ');
  return persons().filter(function(x){ if(x.id===p.id) return false; var xk=nameKey(x.name), xw=xk.split(' ');
    return xk===k || (w.length>1 && xw.length>1 && xw[0]===w[0] && xw[xw.length-1]===w[w.length-1]); });
}
function peopleHome(){
  setTitle('People');
  var all=persons(), f=S.pfilter||'all', raw=String(S.pq||'').trim(), q=nameKey(raw), qd=raw.replace(/\D/g,'');
  if(!all.length && S.st && S.st.dataModel!==2){
    $('#app').innerHTML='<div class="card small muted">People appear here once version 3 has finished its one-off upgrade, which runs the next time the app opens online.</div>'+versionLine(); setFooter(tabBar()); return; }
  var count={all:all.length}; all.forEach(function(p){ count[p.status]=(count[p.status]||0)+1; });
  var list=all.filter(function(p){ return (f==='all'||p.status===f) &&
      (!raw || nameKey(p.name).indexOf(q)>=0 || nameKey(p.knownAs).indexOf(q)>=0 || String(p.email||'').toLowerCase().indexOf(raw.toLowerCase())>=0 || (qd.length>=3 && String(p.mobile||'').replace(/\D/g,'').indexOf(qd)>=0)); })
    .sort(function(a,b){ return String(b.lastAt||'').localeCompare(String(a.lastAt||'')) || String(a.name).localeCompare(String(b.name)); });
  var h='<div class="row" style="gap:8px;margin-block-end:10px"><input type="search" id="pplSearch" class="grow" placeholder="Search name, email or phone\u2026" value="'+esc(S.pq||'')+'"></div>'+
    '<div class="filters">'+[['all','All']].concat(PERSON_STATUSES.map(function(x){ return [x,x]; })).map(function(x){ return '<button type="button" data-act="pfilter" data-id="'+esc(x[0])+'" class="'+(f===x[0]?'on':'')+'">'+esc(x[1])+' <span class="fcount">'+(count[x[0]]||0)+'</span></button>'; }).join('')+'</div>';
  if(!list.length) h+='<div class="card empty small">'+(raw?'Nobody matches \u201C'+esc(raw)+'\u201D.':'Nobody here yet.')+'</div>';
  h+=list.slice(0,200).map(function(p){
    return '<div class="card tap" data-act="person" data-id="'+esc(p.id)+'"><div class="row"><div class="avatar">'+esc(initials(p.name))+'</div><div class="grow">'+
      '<div class="title">'+nameWithKnown(p.name,p.knownAs)+'</div><div class="small muted">'+[p.email,p.mobile].filter(Boolean).map(esc).join(' \u00B7 ')+'</div>'+
      '<div style="margin-block-start:6px">'+personPill(p.status)+(p.applications?'<span class="pill">'+p.applications+' application'+(p.applications>1?'s':'')+'</span>':'')+
        (p.tenancies?'<span class="pill">'+p.tenancies+' tenanc'+(p.tenancies>1?'ies':'y')+'</span>':'')+(personDupes(p).length?'<span class="pill st-warn">Possible duplicate</span>':'')+'</div></div><span class="chev">\u203A</span></div></div>';
  }).join('');
  if(list.length>200) h+='<div class="small muted" style="text-align:center">Showing 200 of '+list.length+' \u2014 search to narrow it down.</div>';
  $('#app').innerHTML=h+versionLine();
  setFooter(tabBar());
}
var PS_FIELDS=[['name','Full legal name','text'],['knownAs','Known as (if different)','text'],['email','Email','email'],['mobile','Mobile','tel'],['otherPhone','Other phone','tel'],['dob','Date of birth','date'],['address','Current address','text']];
var PS_ID=[['licenceNumber','Driver licence number','text'],['licenceVersion','Licence version','text'],['passportNumber','Passport number','text'],['passportExpiry','Passport expiry','date'],['winz','WINZ number','text']];
var PS_EMERGENCY=[['emergencyName','Name','text'],['emergencyRelationship','Relationship','text'],['emergencyPhone','Phone','tel'],['emergencyAddress','Address','text']];
function personView(id){
  var p=personById(id); if(!p){ back(); return; }
  if(!S.ps||S.ps._for!==id){ S.ps={_for:id}; PS_FIELDS.concat(PS_ID,PS_EMERGENCY,[['notes']]).forEach(function(f){ S.ps[f[0]]=p[f[0]]||''; }); }
  var e=S.ps; setTitle(whoText(p));
  var fld=function(f){ return '<label class="fld"><span>'+esc(f[1])+'</span><input type="'+f[2]+'" data-ps="'+f[0]+'" value="'+esc(e[f[0]]||'')+'"></label>'; };
  var grid=function(list){ var o=''; for(var i=0;i<list.length;i+=2) o+=list[i+1]?'<div class="grid2">'+fld(list[i])+fld(list[i+1])+'</div>':fld(list[i]); return o; };
  var h='<div class="card"><div class="row"><div class="avatar">'+esc(initials(p.name))+'</div><div class="grow"><div class="title">'+nameWithKnown(p.name,p.knownAs)+'</div>'+
    '<div style="margin-block-start:6px">'+personPill(p.status)+'<span class="pill">'+esc(p.id)+'</span></div>'+
    '<div class="small muted" style="margin-block-start:6px">'+({Tenant:'On a current tenancy.',Applicant:'Has an application under way.','Past Tenant':'Was a tenant before.','Past Applicant':'Applied before, without becoming a tenant.',Viewer:'Has been to a viewing but hasn\u2019t been sent a form or decided on.'}[p.status]||'')+'</div></div></div></div>';
  h+='<div class="sasec" style="margin:14px 6px 8px">Details</div><div class="card">'+grid(PS_FIELDS)+'</div>';
  h+='<div class="sasec" style="margin:14px 6px 8px">ID on file</div><div class="card">'+grid(PS_ID)+'</div>';
  h+='<div class="sasec" style="margin:14px 6px 8px">Emergency contact</div><div class="card">'+grid(PS_EMERGENCY)+
    '<label class="fld"><span>Notes about '+esc(String(p.name).split(' ')[0])+'</span><textarea data-ps="notes" rows="2">'+esc(e.notes||'')+'</textarea></label></div>';
  var pa=personApps(id), pt=personTenancies(id);
  h+=sectStart('ps-apps','Applications',countPill(pa.length,'application'))+'<div class="card">'+(pa.length? pa.map(function(a,i){ var st=stInfo(a);
      return '<div class="member"'+(i?'':' style="border-block-start:0"')+'><div class="grow"><div style="font-weight:750">'+esc(a.address1||'No property')+'</div>'+
        '<div class="small muted">'+esc(a.ref)+(a.attendedAt?' \u00B7 '+esc(fmtDate(a.attendedAt)):'')+'</div>'+
        '<div style="margin-block-start:6px"><span class="pill '+st.c+'">'+esc(st.t)+'</span>'+(a.decision?'<span class="pill dec">'+esc(a.decision)+'</span>':'')+(agreementPill(a)||'')+'</div></div>'+
        '<div class="row" style="gap:6px;flex-direction:column"><button class="btn sm" type="button" data-act="group" data-id="'+esc(groupKey(a))+'">Group</button><button class="btn sm ghost" type="button" data-act="app" data-id="'+esc(a.ref)+'">Application</button></div></div>'; }).join('')
    :'<div class="small muted">No applications.</div>')+'</div>'+SECT_END;
  h+=sectStart('ps-ten','Tenancies',countPill(pt.length,'tenancy','tenancies'))+'<div class="card">'+(pt.length? pt.map(function(t,i){
      var cur=(t.tenants||[]).some(function(x){ return x.personId===id; }), role=cur?(t.status==='Ended'?'Tenant (tenancy ended)':'Current tenant'):'Former tenant';
      var fx=(t.formerTenants||[]).find(function(x){ return x.personId===id; });
      return '<div class="member tap" data-act="tenancy" data-id="'+esc(t.id)+'"'+(i?'':' style="border-block-start:0"')+'><div class="grow"><div style="font-weight:750">'+esc(tenancyPropLabel(t))+'</div>'+
        '<div class="small muted">'+esc(tenancyDates(t))+(fx&&fx.moveOut?' \u00B7 moved out '+esc(ymdLabel(fx.moveOut)):'')+'</div><div style="margin-block-start:6px"><span class="pill '+(cur&&t.status!=='Ended'?'st-done':'')+'">'+esc(role)+'</span></div></div><span class="chev">\u203A</span></div>'; }).join('')
    :'<div class="small muted">No tenancies.</div>')+'</div>'+SECT_END;
  var dup=personDupes(p);
  if(dup.length) h+=sectStart('ps-dup','Possible duplicates','<span class="pill st-warn">'+dup.length+'</span>')+'<div class="card"><div class="small muted" style="margin-block-end:8px">Same name as someone else on file. If it\u2019s the same person, merge them: their applications and tenancies move to this record and any blank details are filled in.</div>'+
    dup.map(function(x){ return '<div class="member"><div class="grow"><div style="font-weight:750">'+whoHtml(x)+'</div><div class="small muted">'+[x.email,x.mobile].filter(Boolean).map(esc).join(' \u00B7 ')+'</div><div style="margin-block-start:4px">'+personPill(x.status)+'</div></div>'+
      '<div class="row" style="gap:6px;flex-direction:column"><button class="btn sm ghost" type="button" data-act="person" data-id="'+esc(x.id)+'">View</button><button class="btn sm" type="button" data-act="person-merge" data-id="'+esc(x.id)+'">Merge here</button></div></div>'; }).join('')+'</div>'+SECT_END;
  h+='<div id="psErr" class="err" style="margin:0 6px 8px"></div>';
  $('#app').innerHTML=h;
  setFooter('<button class="btn" type="button" data-act="back">Back</button><button class="btn primary" type="button" data-act="person-save" id="psSave"'+(psDirty()?'':' disabled')+'>Save changes</button>');
}
function psDirty(){ var p=S.ps&&personById(S.ps._for); if(!p) return false; return Object.keys(S.ps).some(function(k){ return k!=='_for' && String(S.ps[k]||'')!==String(p[k]||''); }); }
function appByRef(ref){ return apps().find(function(a){ return a.ref===ref; }); }
function viewingById(id){ return ((S.st&&S.st.viewings)||[]).find(function(v){ return v.id===id; }); }
/* Sent by DocHub (sign request) or by the online form (private link) */
/* First progress box: from a viewing it's Viewed / No-show; otherwise the enquiry itself, ticked with the date they were added */
/* Small date under a progress box, e.g. "6 Oct" (with the year if it isn't this year) */
function stepDate(iso){
  var d=iso? new Date(iso) : null; if(!d||isNaN(d)) return '';
  var o={day:'numeric',month:'short'}; if(d.getFullYear()!==new Date().getFullYear()) o.year='2-digit';
  return '<span class="tl-d">'+esc(d.toLocaleDateString('en-NZ',o))+'</span>';
}
function stepCell(on,label,iso){ return '<div class="'+(on?'on':'')+'"><b>'+(on?'\u2713':'\u2013')+'</b>'+label+(on?stepDate(iso):'')+'</div>'; }
/* Form sent, or (red, with a cross) Form cancelled on the day it was cancelled; Resend link puts it back to Form sent */
function sentStep(a){ return a.status==='Cancelled'? '<div class="off"><b>\u2715</b>Form cancelled'+stepDate(a.applyExpires)+'</div>' : stepCell(!!a.sentAt,'Form sent',a.sentAt); }
function firstStep(a){
  if(a.viewingId){
    var on=a.attendance==='Came', v=viewingById(a.viewingId);
    return '<div class="'+(on?'on':'')+'"><b>'+(on?'\u2713':a.attendance==='No-show'?'\u2715':'\u2013')+'</b>'+(a.attendance==='No-show'?'No-show':'Viewed')+(a.attendance&&v?stepDate(v.viewingAt):'')+'</div>';
  }
  return '<div class="on"><b>\u2713</b>Enquired'+stepDate(a.attendedAt)+'</div>';
}
/* A section that folds away (tap its heading); open/closed is remembered on this device. The summary stays
   visible when it's closed. force=true keeps it open (e.g. while searching). */
function sectOpen(id){ try{ return localStorage.getItem('tm-sect-'+id)!=='closed'; }catch(e){ return true; } }
/* done: a finished section (decision made, references complete...) starts collapsed every time the screen is opened;
   opening it lasts until you leave the screen (S.sectVisit, cleared on navigation) */
function sectStart(id,title,summary,force,done){
  var open=force||(done? !!(S.sectVisit&&S.sectVisit[id]) : sectOpen(id));
  return '<div class="sect'+(open?'':' closed')+'" data-sect="'+esc(id)+'"'+(done?' data-done="1"':'')+'><button type="button" class="sect-h" data-act="sect" data-id="'+esc(id)+'" aria-expanded="'+open+'">'+
    '<span class="sect-t">'+esc(title)+'</span><span class="sect-s">'+(summary||'')+'</span><span class="sect-c" aria-hidden="true">\u25BE</span></button><div class="sect-b">';
}
var SECT_END='</div></div>';
function sectionHtml(id,title,summary,body,force,done){ return sectStart(id,title,summary,force,done)+body+SECT_END; }
function countPill(n,word,plural){ return '<span class="pill">'+n+' '+(n===1?word:(plural||word+'s'))+'</span>'; }
function sectKey(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,40); }
function sent(a){ return !!(a.srid||a.applyToken); }
/* Same landlord / referee listed by more than one applicant (from the server's matching on phone, email or full name) */
function sharedOf(ref,slot){ var m=(S.st&&S.st.shared)||{}; return m[ref+'|'+slot]||[]; }
function sharedForApp(ref){ var m=(S.st&&S.st.shared)||{}, n=0; Object.keys(m).forEach(function(k){ if(k.indexOf(ref+'|')===0) n++; }); return n; }
/* Groups a person could move between: same viewing, or (not from a viewing) same property */
function groupsLike(a){ return a.viewingId? groupsAt(a.viewingId) : allGroups().filter(function(g){ return !g.lead.viewingId && g.lead.address1===a.address1; }); }
/* Every active group a person could join (not declined or withdrawn), grouped by property */
function activeGroupsFor(a){
  var key=groupKey(a);
  return allGroups().filter(function(g){ return g.key!==key && ['Declined','Withdrawn'].indexOf(g.lead.decision)<0 &&
    !g.members.every(function(x){ return ['Rejected','Voided','Expired'].indexOf(x.status)>=0; }); });
}
function groupOptionLabel(g){
  var l=g.lead, v=l.viewingId? viewingById(l.viewingId) : null, t=groupArrival(g.key);
  return groupName(g.key)+' \u00b7 '+g.members.length+(v? ' \u2014 viewing '+new Date(v.viewingAt).toLocaleDateString('en-NZ',{weekday:'short',day:'numeric',month:'short'})+(t?' '+fmtTime(t):'') : ' \u2014 '+(l.source||'added directly'));
}
/* The "Applying with" picker used when editing someone or moving them */
function groupPickerHtml(a,id){
  var key=groupKey(a), alone=groupMembers(key).length===1, others=activeGroupsFor(a), by={}, props=[];
  others.forEach(function(g){ var p=g.lead.address1||'No property'; if(!by[p]){ by[p]=[]; props.push(p); } by[p].push(g); });
  props.sort(function(x,y){ return (x===a.address1?-1:y===a.address1?1:0)||x.localeCompare(y); });
  return '<label class="fld"><span>Applying with</span><select id="'+id+'"><option value="'+esc(key)+'" selected>'+(alone?'Nobody \u2014 on their own':esc(groupName(key))+' (current)')+'</option>'+
    (!alone?'<option value="">Move out \u2014 on their own</option>':'')+
    props.map(function(p){ return '<optgroup label="'+esc(p)+'">'+by[p].map(function(g){ return '<option value="'+esc(g.key)+'" data-prop="'+esc(p)+'">'+esc(groupOptionLabel(g))+'</option>'; }).join('')+'</optgroup>'; }).join('')+
    '</select></label><div class="small" id="'+id+'Note" style="color:var(--miss);margin-block:-6px 10px"></div>';
}
function wireGroupPicker(m,id,a){
  var sel=$('#'+id,m); if(!sel) return;
  sel.addEventListener('change',function(){
    var o=sel.options[sel.selectedIndex], p=o&&o.getAttribute('data-prop');
    $('#'+id+'Note',m).textContent= p && p!==a.address1? 'That group is applying for '+p+' \u2014 '+a.name.split(' ')[0]+'\u2019s property will change to match.' : '';
  });
}
/* Can this person be sent the form? By email, or (online form only) by text when there's a mobile number */
function mobileOk(a){ return String(a.mobile||'').replace(/\D/g,'').length>8; }
function canSend(a){ return !!a.email || (!!(S.st&&S.st.applyMode) && mobileOk(a)); }
function byText(a){ return !a.email && !!(S.st&&S.st.applyMode) && mobileOk(a); }
function groupKey(a){ return a.group||a.ref; }
function groupMembers(key){ return apps().filter(function(x){ return groupKey(x)===key; }).sort(function(a,b){ return (a.attendedAt||'').localeCompare(b.attendedAt||'') || a.ref.localeCompare(b.ref); }); }
function groupLead(key){ var m=groupMembers(key); return m.find(function(x){ return x.ref===key; })||m[0]; }
function groupName(key){ var l=groupLead(key); return l? String(l.knownAs||l.name).split(' ')[0]+'\u2019s group' : 'Group'; }
/* Groups at one viewing, most recently added-to first */
function groupsAt(viewingId){
  var by={}, order=[];
  attendees(viewingId).forEach(function(a){ var k=groupKey(a); if(!by[k]){ by[k]={key:k,members:[],last:''}; order.push(k); } by[k].members.push(a); if((a.attendedAt||'')>by[k].last) by[k].last=a.attendedAt||''; });
  return order.map(function(k){ return by[k]; }).sort(function(a,b){ return b.last.localeCompare(a.last); });
}
function groupLine(a){
  var mates=groupMembers(groupKey(a)).filter(function(x){ return x.ref!==a.ref; });
  return mates.length? '<div class="small muted" style="margin-block-start:6px">\uD83D\uDC65 With '+esc(mates.map(function(x){ return x.name.split(' ')[0]; }).join(', '))+'</div>' : '';
}
function attendees(id){ return apps().filter(function(a){ return a.viewingId===id; }).sort(function(a,b){ return (a.attendedAt||'').localeCompare(b.attendedAt||''); }); }

/* Busy wrapper: disables the button, shows progress, reports the result plainly */
function busy(btn,label,p){
  var old=btn?btn.innerHTML:''; if(btn){ btn.disabled=true; btn.innerHTML='<span class="spin" style="width:18px;height:18px"></span> '+esc(label); }
  return p.then(function(r){ if(btn){ btn.disabled=false; btn.innerHTML=old; } return r; },
    function(e){ if(btn){ btn.disabled=false; btn.innerHTML=old; } toast(e.message,5000); throw e; });
}

/* ================= Status language ================= */
function stInfo(a){
  var s=(a.status||'Draft');
  if(!sent(a) && (s==='Draft'||s==='Ready'||s==='')) return {t:'Not sent',c:'st-draft'};
  if(s==='Send Pending') return {t:'Sending\u2026',c:'st-sent'};
  if(s==='Sent') return {t:'Form sent',c:'st-sent'};
  if(s==='In Progress') return {t:'Form opened',c:'st-sent'};
  if(s==='Finalized') return {t:'Form returned',c:'st-done'};
  if(s==='Cancelled') return {t:'Form cancelled',c:'st-draft'};
  if(s==='Error') return {t:'Send failed',c:'st-bad'};
  return {t:s,c:'st-bad'};
}
function refInfo(a){
  var r=a.refs; if(a.status!=='Finalized') return '';
  if(!r) return '<span class="pill st-warn">References not imported</span>';
  if(r.none && !r.total) return '<span class="pill st-warn">No references given</span>';
  var h=checkedPill(r);
  var sh=sharedForApp(a.ref); if(sh) h+='<span class="pill shared">\uD83D\uDD17 '+(sh>1?sh+' shared references':'Shared reference')+'</span>';
  return h;
}
/* One pill for reference progress and how they went: " 2/2 checked ". The colour follows the outcomes -
   green all positive, red any concern, amber a positive/neutral mix \u2014 and the breakdown shows on press-and-hold */
function checkedPill(r){
  var pos=r.positive||0, neu=r.neutral||0, con=r.concerns||0, n=pos+neu+con;
  var parts=[]; if(pos) parts.push(pos+' positive'); if(neu) parts.push(neu+' neutral'); if(con) parts.push(con+' concern'+(con>1?'s':''));
  var icon='', cls=r.done>=r.total?'st-done':'st-warn';
  if(n){ if(con){ icon=' \uD83D\uDC4E'; cls='st-bad'; } else if(!neu){ icon=' \uD83D\uDC4D'; cls='st-done'; } else { icon=' \uD83E\uDD14'; cls='st-warn'; } }
  var tip=r.done+' of '+r.total+' references checked'+(n?': '+parts.join(', '):'');
  return '<span class="pill '+cls+'" title="'+esc(tip)+'" aria-label="'+esc(tip)+'">\u260E '+r.done+'/'+r.total+' checked'+icon+'</span>';
}
/* Checks each applicant needs before a decision: references, Tenancy Tribunal check and credit check */
/* Outstanding court fines from the credit check: a warning when there are some */
function finesPill(a){
  if(a.courtFines==='Yes') return '<span class="pill st-warn">\u26A0 Court fines</span>';
  if(a.courtFines==='No') return '<span class="pill">No court fines</span>';
  return '';
}
function checksLeft(a){
  var left=[];
  if(!a.refs || a.refs.done<a.refs.total || (a.refs.none&&!a.refs.total)) left.push('references');
  if(!a.tribunal) left.push('Tribunal check');
  if(!String(a.creditCheck||'').trim()) left.push('credit check');
  return left;
}
function needsChecks(a){ return a.status==='Finalized' && !a.decision && checksLeft(a).length>0; }
/* Where a group is up to - each group is in exactly one stage:
   forms (a form not sent or not back) -> checks (all back, checks outstanding) -> decide (checks done, or Shortlisted)
   -> agreement (Approved, not yet signed) -> done (signed, Declined, Withdrawn, or every form expired / cancelled) */
var STAGES=[['active','Active'],['forms','Forms'],['checks','Checks'],['decide','Decide'],['agreement','Agreement'],['done','Done']];
function groupStage(g){
  var m=g.members, d=g.lead.decision||'', ag=g.lead.agreement||{};
  if(d==='Declined'||d==='Withdrawn') return 'done';
  if(d==='Approved') return ag.status==='Signed'? 'done' : 'agreement';
  if(d==='Shortlisted') return 'decide';
  if(m.every(function(a){ return ['Rejected','Voided','Expired'].indexOf(a.status)>=0; })) return 'done';
  if(!m.every(function(a){ return a.status==='Finalized'; })) return 'forms';
  return m.some(function(a){ return checksLeft(a).length; })? 'checks' : 'decide';
}
function personCard(a,extra){
  var st=stInfo(a);
  return '<div class="card tap" data-act="app" data-id="'+esc(a.ref)+'"><div class="person"><div class="avatar">'+esc(initials(a.name))+'</div><div class="grow">'+
    '<div class="row"><div class="title grow">'+whoHtml(a)+'</div><span class="chev">\u203A</span></div>'+
    '<div class="contact-line">'+(a.address1?'<span>\uD83C\uDFE0 '+esc(a.address1)+'</span>':'')+'<span>'+esc(a.ref)+'</span></div>'+
    '<div style="margin-block-start:8px"><span class="pill '+st.c+'">'+esc(st.t)+'</span>'+(a.decision?'<span class="pill dec">'+esc(a.decision)+'</span>':'')+refInfo(a)+tribunalPill(a)+'</div>'+
    groupLine(a)+(extra||'')+'</div></div></div>';
}

/* Applicants needing reference checks, gathered into the groups they're applying with (most recent group first) */
function checkGroups(list){
  var by={}, out=[];
  list.forEach(function(a){ var k=groupKey(a); if(!by[k]){ by[k]={key:k,todo:[],last:''}; out.push(by[k]); } by[k].todo.push(a); var t=a.signedAt||a.sentAt||a.attendedAt||''; if(t>by[k].last) by[k].last=t; });
  return out.sort(function(a,b){ return b.last.localeCompare(a.last); });
}
function checkGroupCard(g,deciding){
  var all=groupMembers(g.key), rest=all.filter(function(x){ return g.todo.indexOf(x)<0; });
  var todo=g.todo.slice().sort(function(a,b){ return all.indexOf(a)-all.indexOf(b); });
  var head=all.length>1? '\uD83D\uDC65 '+esc(groupName(g.key))+' \u00B7 '+all.length : '\uD83D\uDE4B On their own';
  var prop=(all[0]&&all[0].address1)? '<div class="small muted">'+esc(all[0].address1)+'</div>' : '';
  return '<div class="card group"><div class="ghead"><div class="grow"><div class="title">'+head+'</div>'+prop+'</div>'+
    (all.length>1?'<span class="pill '+(deciding?'st-done':'st-warn')+'">'+todo.length+(deciding?' ready':' to check')+'</span>':'')+'</div>'+
    todo.map(memberRow).join('')+
    (rest.length?'<div class="small muted" style="padding-block-start:10px;border-block-start:1px solid var(--line)">Also in this group: '+
      rest.map(function(x){ return '<a href="#" data-act="app" data-id="'+esc(x.ref)+'" style="color:inherit;font-weight:700">'+esc(x.name.split(' ')[0])+'</a> ('+esc(x.decision||stInfo(x).t.toLowerCase())+')'; }).join(', ')+'</div>':'')+'</div>';
}

/* ================= Views ================= */
var VIEWS = {};

/* Home tabs: Viewings (bookings and who came), Applicant groups (forms, references, decisions), Tenancies, Setup */
VIEWS.home = function(){ return S.tab==='groups'? groupsHome() : S.tab==='people'? peopleHome() : S.tab==='tenancies'? tenanciesHome() : S.tab==='setup'? setupHome() : viewingsHome(); };
function tabBar(){
  var todo=allGroups().filter(function(g){ return g.members.some(needsChecks); }).length;
  return '<div class="tabbar">'+
    '<button type="button" data-act="tab" data-id="viewings" class="'+(S.tab==='viewings'?'on':'')+'"><span class="ic">\uD83D\uDDDD</span>Viewings</button>'+
    '<button type="button" data-act="tab" data-id="groups" class="'+(S.tab==='groups'?'on':'')+'"><span class="ic">\uD83D\uDC65</span>Groups'+(todo?'<span class="n">'+todo+'</span>':'')+'</button>'+
    '<button type="button" data-act="tab" data-id="people" class="'+(S.tab==='people'?'on':'')+'"><span class="ic">\uD83E\uDDD1</span>People</button>'+
    '<button type="button" data-act="tab" data-id="tenancies" class="'+(S.tab==='tenancies'?'on':'')+'"><span class="ic">\uD83C\uDFE0</span>Tenancies'+(bondTodo()?'<span class="n">'+bondTodo()+'</span>':'')+'</button>'+
    '<button type="button" data-act="tab" data-id="setup" class="'+(S.tab==='setup'?'on':'')+'"><span class="ic">\u2699\uFE0F</span>Setup</button>'+
    '<button type="button" data-act="refresh"><span class="ic">\u21BB</span>Refresh</button></div>';
}
function versionLine(){ return '<div class="small muted" style="text-align:center;margin-block-start:18px">App version '+APP_VERSION+(S.st&&S.st.version?' \u00B7 backend '+esc(S.st.version):'')+(HAS_GAS?'':' \u00B7 demo')+'</div>'; }
function greeting(){ var hr=new Date().getHours(); return hr<12?'Good morning':hr<18?'Good afternoon':'Good evening'; }

/* ---------- Time helpers ---------- */
function fmtTime(ms){ var d=new Date(ms); return isNaN(d)? '' : d.toLocaleTimeString('en-NZ',{hour:'numeric',minute:'2-digit'}).replace(/\s/g,'').toLowerCase().replace(/(am|pm)$/,' $1'); }
function timeInput(iso){ if(!iso) return ''; var d=new Date(iso); return isNaN(d)? '' : pad(d.getHours())+':'+pad(d.getMinutes()); }
/* The arrival times a viewing offers: first group, then every N minutes until the last group */
function slotsFor(v){
  var start=new Date(v.viewingAt).getTime(); if(isNaN(start)) return [];
  var step=Math.max(1,Number(v.slotMinutes)||5)*60000, end=v.lastAt? new Date(v.lastAt).getTime() : start+30*60000, out=[];
  if(isNaN(end)||end<start) end=start;
  for(var t=start;t<=end && out.length<60;t+=step) out.push(t);
  return out;
}
function groupArrival(key){ var m=groupMembers(key), l=groupLead(key); var a=(l&&l.arrival)||(m.find(function(x){ return x.arrival; })||{}).arrival; return a? new Date(a).getTime() : 0; }
function groupAttendance(key){ var l=groupLead(key); return (l&&l.attendance)||''; }

/* ---------- Groups ---------- */
function allGroups(){
  var by={}, out=[];
  apps().forEach(function(a){ var k=groupKey(a); if(!by[k]){ by[k]={key:k,members:[],last:''}; out.push(by[k]); } by[k].members.push(a); var t=a.signedAt||a.sentAt||a.attendedAt||''; if(t>by[k].last) by[k].last=t; });
  out.forEach(function(g){ g.members.sort(function(a,b){ return (a.ref===g.key?-1:b.ref===g.key?1:0) || (a.attendedAt||'').localeCompare(b.attendedAt||''); }); g.lead=g.members[0]; });
  return out;
}
function groupOf(key){ return allGroups().find(function(g){ return g.key===key; }); }
function originPill(lead,link){
  if(lead.viewingId){ var v=viewingById(lead.viewingId), when=v? new Date(v.viewingAt).toLocaleDateString('en-NZ',{weekday:'short',day:'numeric',month:'short'}) : 'viewing';
    return '<span class="pill view"'+(link&&v?' data-act="viewing" data-id="'+esc(v.id)+'" style="cursor:pointer"':'')+'>\uD83D\uDDDD '+(link?'From viewing \u00B7 ':'Viewing \u00B7 ')+esc(when)+(link&&v?' \u203A':'')+'</span>'; }
  return '<span class="pill wom">\uD83E\uDD1D '+esc(lead.source||'Added directly')+'</span>';
}
function groupStats(g){
  var m=g.members, back=m.filter(function(a){ return a.status==='Finalized'; }).length, refT=0, refD=0, conc=0, shared=0;
  m.forEach(function(a){ if(a.refs){ refT+=a.refs.total; refD+=a.refs.done; conc+=a.refs.concerns||0; } shared+=sharedForApp(a.ref); });
  var decision=g.lead.decision||'';
  var toCheck=m.filter(needsChecks).length;
  var ready=!decision && groupStage(g)==='decide';
  return {back:back,refT:refT,refD:refD,conc:conc,shared:shared,decision:decision,toCheck:toCheck,ready:ready};
}
function statusWord(a){
  var st=stInfo(a), col={'st-done':'var(--ok)','st-sent':'var(--clean)','st-bad':'var(--bad)'}[st.c]||'var(--muted)';
  return '<span style="white-space:nowrap">'+esc(a.name.split(' ')[0])+' <b style="color:'+col+'">'+esc(st.c==='st-done'?'\u2713 returned':st.t.toLowerCase())+'</b></span>';
}
function groupSummaryCard(g){
  var x=groupStats(g), n=g.members.length;
  var flags=(x.toCheck?'<span class="pill st-warn" title="References, Tribunal check and credit check">\uD83D\uDD0D '+x.toCheck+' to check</span>':'')+(x.shared?'<span class="pill shared">\uD83D\uDD17 Shared reference</span>':'')+
    (x.conc?'<span class="pill st-bad">\u26A0 '+x.conc+' concern'+(x.conc>1?'s':'')+'</span>':'')+(g.members.some(function(a){ return a.tribunal==='Order found'; })?'<span class="pill st-bad">\u2696 Tribunal order</span>':'')+(x.ready?'<span class="pill st-done">Ready for a decision</span>':'')+
    (x.decision?'<span class="pill dec">'+esc(x.decision)+'</span>':'')+agreementPill(g.lead);
  return '<div class="card tap group" data-act="group" data-id="'+esc(g.key)+'"><div class="ghead"><div class="title">'+(n>1?'\uD83D\uDC65 '+esc(groupName(g.key))+' \u00B7 '+n:'\uD83D\uDE4B '+whoHtml(g.lead))+'</div><span class="chev">\u203A</span></div>'+
    '<div>'+originPill(g.lead,false)+'</div>'+
    '<div class="small" style="margin-block-start:8px;line-height:1.7;display:flex;flex-wrap:wrap;gap:2px 10px">'+g.members.map(statusWord).join('<span class="muted">\u00B7</span>')+'</div>'+
    '<div class="small muted" style="margin-block-start:4px">Forms '+x.back+' of '+n+' back'+(x.refT?' \u00B7 References '+x.refD+' of '+x.refT+' checked':'')+'</div>'+
    (flags?'<div>'+flags+'</div>':'')+'</div>';
}

/* ---------- Viewings tab ---------- */
function viewingsHome(){
  setTitle('Viewings');
  var st=S.st||{viewings:[],applications:[]};
  var upcoming=st.viewings.filter(function(v){ return v.status==='Scheduled'; }).sort(function(a,b){ return a.viewingAt.localeCompare(b.viewingAt); });
  var recent=st.viewings.filter(function(v){ return v.status!=='Scheduled'; }).slice(0,6);
  var waiting=apps().filter(function(a){ return sent(a) && (a.status==='Sent'||a.status==='In Progress'); });
  var booked=0; upcoming.forEach(function(v){ booked+=groupsAt(v.id).length; });
  var errs=apps().filter(function(a){ return a.status==='Error' || (a.lastError && a.viewingId); });
  var h='<div class="card hero"><div class="small" style="position:relative;z-index:1">'+greeting()+' \uD83D\uDC4B</div>'+
    '<div class="big" style="position:relative;z-index:1">'+(upcoming.length&&upcoming[0].viewingAt.slice(0,10)===localInput(new Date()).slice(0,10)?'Viewing today':'Find your next tenant')+'</div>'+
    '<div class="stats"><div class="stat"><b>'+upcoming.length+'</b><span>Upcoming</span></div><div class="stat"><b>'+booked+'</b><span>Groups booked</span></div><div class="stat"><b>'+waiting.length+'</b><span>Forms out</span></div></div></div>';
  if(errs.length){ h+='<h2>Needs fixing</h2>'; errs.forEach(function(a){ h+=personCard(a,'<div class="err">'+esc(a.lastError||'The form could not be sent.')+'</div>'); }); }
  h+='<div class="row" style="margin:24px 6px 10px"><h2 class="grow" style="margin:0">Upcoming</h2><button class="btn sm primary" type="button" data-act="new-viewing">\uFF0B New viewing</button></div>';
  if(!upcoming.length) h+='<div class="card empty small">No viewings coming up. Create one, then book each group into an arrival time.</div>';
  upcoming.forEach(function(v){ h+=viewingCard(v); });
  if(recent.length){ h+=sectStart('v-recent','Recent',countPill(recent.length,'viewing')); recent.forEach(function(v){ h+=viewingCard(v); }); h+=SECT_END; }
  if(waiting.length){
    h+=sectStart('v-waiting','Waiting for the form back',countPill(waiting.length,'person','people'));
    waiting.forEach(function(a){ h+=personCard(a,'<div class="small muted" style="margin-block-start:6px">Sent '+esc(fmt(a.sentAt))+(a.viewedAt?' \u00B7 opened '+esc(fmt(a.viewedAt)):isOpened(a)?' \u00B7 opened':'')+'</div>'); });
    h+=SECT_END;
  }
  $('#app').innerHTML=h+versionLine();
  setFooter(tabBar());
}
function viewingCard(v){
  var d=new Date(v.viewingAt), gs=groupsAt(v.id), list=attendees(v.id), past=v.status!=='Scheduled';
  var times=gs.map(function(g){ return groupArrival(g.key); }).filter(Boolean).sort(function(a,b){ return a-b; });
  var sentN=list.filter(function(a){ return sent(a); }).length, back=list.filter(function(a){ return a.status==='Finalized'; }).length;
  var came=gs.filter(function(g){ return groupAttendance(g.key)==='Came'; }).length, ns=gs.filter(function(g){ return groupAttendance(g.key)==='No-show'; }).length;
  var bookTxt=gs.length? '\uD83D\uDD52 '+gs.length+' group'+(gs.length>1?'s':'')+' booked'+(times.length?' \u00B7 '+fmtTime(times[0])+(times.length>1?'\u2013'+fmtTime(times[times.length-1]):''):'') : '\uD83D\uDD52 No groups booked yet';
  return '<div class="card tap" data-act="viewing" data-id="'+esc(v.id)+'"><div class="row" style="align-items:flex-start">'+
    '<div class="when'+(past?' past':'')+'"><b>'+(isNaN(d)?'?':d.getDate())+'</b><span>'+(isNaN(d)?'':d.toLocaleDateString('en-NZ',{month:'short'}))+'</span></div>'+
    '<div class="grow"><div class="title">'+esc(v.address1)+'</div><div class="small muted">'+esc(d.toLocaleDateString('en-NZ',{weekday:'short',day:'numeric',month:'short'}))+', from '+esc(fmtTime(d))+(v.rent!==''?' \u00B7 '+esc(money(v.rent)):'')+(v.hostedBy?' \u00B7 run by '+esc(v.hostedBy):'')+'</div>'+
    '<div style="margin-block-start:8px"><span class="pill">'+bookTxt+'</span>'+(came||ns?'<span class="pill st-done">\u2713 '+came+' came</span>'+(ns?'<span class="pill st-bad">'+ns+' no-show</span>':''):'')+
    (sentN?'<span class="pill st-sent">\u2709 '+sentN+' sent</span>':'')+(back?'<span class="pill st-done">\u2713 '+back+' returned</span>':'')+
    (v.status==='Cancelled'?'<span class="pill st-bad">Cancelled</span>':'')+'</div></div><span class="chev">\u203A</span></div></div>';
}

/* ---------- Applicant groups tab ---------- */
function groupsHome(){
  setTitle('Applicant groups');
  var f=S.gfilter, q=(S.q||'').toLowerCase();
  if(!STAGES.some(function(s){ return s[0]===f; })) f=S.gfilter='active';
  // counts per stage (Active = everything not Done); a search looks across every group whatever the filter
  var all=allGroups(), stageOf={}, count={active:0,forms:0,checks:0,decide:0,agreement:0,done:0};
  all.forEach(function(g){ var s=stageOf[g.key]=groupStage(g); count[s]++; if(s!=='done') count.active++; });
  var gs=all.filter(function(g){
    if(q) return g.members.some(function(a){ return (a.name+' '+knownOf(a)+' '+a.address1+' '+a.ref+' '+a.email+' '+a.mobile).toLowerCase().indexOf(q)>=0; });
    return f==='active'? stageOf[g.key]!=='done' : stageOf[g.key]===f;
  }).sort(function(a,b){ return (b.last||'').localeCompare(a.last||''); });
  var sharedN=allGroups().filter(function(g){ var x=groupStats(g); return x.shared && x.toCheck; }).length;
  var h='<div class="row" style="gap:8px;margin-block-end:10px"><input type="search" id="grpSearch" class="grow" placeholder="Search name, property, phone\u2026" value="'+esc(S.q||'')+'"><button class="btn primary" type="button" data-act="new-group">\uFF0B New</button></div>'+
    '<div class="filters">'+STAGES.map(function(s){ return '<button type="button" data-act="gfilter" data-id="'+s[0]+'" class="'+(!q&&f===s[0]?'on':'')+'">'+s[1]+' <span class="fcount">'+count[s[0]]+'</span></button>'; }).join('')+'</div>'+
    (q?'<div class="small muted" style="margin:-4px 6px 10px">Searching every group, including Done.</div>':'');
  if(sharedN) h+='<div class="sharebox"><div class="title">\uD83D\uDD17 Shared references</div><div class="small">'+sharedN+' group'+(sharedN>1?'s have':' has')+' a landlord or referee that another applicant also listed \u2014 one call can cover them all.</div></div>';
  var by={}, props=[];
  gs.forEach(function(g){ var p=g.lead.address1||'No property'; if(!by[p]){ by[p]=[]; props.push(p); } by[p].push(g); });
  // each property folds away; while searching, every property stays open so no match is hidden
  props.forEach(function(p){ h+=sectStart('gp-'+sectKey(p),p,countPill(by[p].length,'group'),!!q); by[p].forEach(function(g){ h+=groupSummaryCard(g); }); h+=SECT_END; });
  if(!gs.length) h+='<div class="card empty small">'+(q?'No groups match that search.':all.length?'No groups at this stage.':'No applicant groups yet. Groups are created when you book them into a viewing, or tap \uFF0B New for a word-of-mouth enquiry.')+'</div>';
  $('#app').innerHTML=h+versionLine();
  setFooter(tabBar());
}

/* ---------- New / edit viewing ---------- */
function hostField(cur){
  var hosts=((S.st&&S.st.hosts)||[]).slice();
  return '<label class="fld"><span>Who\u2019s running the viewing</span><input type="text" id="vfHost" autocomplete="off" autocapitalize="words" placeholder="Name" value="'+esc(cur||'')+'"></label>'+
    (hosts.length?'<div class="hosts">'+hosts.map(function(n){ return '<button type="button" data-act="pick-host" data-id="'+esc(n)+'" class="'+(n===cur?'on':'')+'">'+esc(n)+'</button>'; }).join('')+'</div>':'');
}
var GAPS=[5,10,15];
/* The applicant asked us not to contact this landlord (the online form records it in Relationship / Type) */
function noContact(c){ return /not to contact/i.test(String(c&&c.relationship||'')); }
/* Red DO NOT CONTACT flag; tapping it explains why */
function dncFlag(size){ return '<button type="button" class="dnc'+(size?' '+size:'')+'" data-act="dnc-info">DO NOT CONTACT</button>'; }
function dncInfo(){
  var m=modal('<div class="dnc" style="margin:0 0 10px">DO NOT CONTACT</div>'+
    '<div style="margin-block-end:14px">The applicant said in their application that we can\u2019t contact this landlord for a reference.</div>'+
    '<div class="row" style="justify-content:flex-end"><button class="btn primary" data-r="1" type="button">OK</button></div>');
  m.addEventListener('click',function(e){ if(e.target.closest('[data-r]')||e.target===m) m.remove(); });
}
/* Shared property list entry: the property's name (street address if it has none) */
function propLabel(p){ return String(p.name||'').trim() || p.address1+(p.address2?', '+p.address2:''); }
VIEWS.viewingForm = function(id){
  var v=id? viewingById(id) : null, props=(S.st&&S.st.properties)||[];
  setTitle(v?'Edit viewing':'New viewing');
  var start=new Date(); start.setMinutes(start.getMinutes()<30?30:60,0,0);
  // late at night or early morning, suggest 5:30 pm (tomorrow if it's evening) so the default times never run past midnight
  if(start.getHours()>=21 || start.getHours()<7){ if(start.getHours()>=21) start.setDate(start.getDate()+1); start.setHours(17,30,0,0); }
  var gap=v? (v.slotMinutes||5) : (+localStorage.getItem('tm-gap')||10);
  S.vfGap=gap;
  var first=v? timeInput(v.viewingAt) : pad(start.getHours())+':'+pad(start.getMinutes());
  var last=v? (v.lastAt? timeInput(v.lastAt) : timeInput(new Date(new Date(v.viewingAt).getTime()+30*60000))) : (function(){ var e=new Date(start.getTime()+30*60000); return pad(e.getHours())+':'+pad(e.getMinutes()); })();
  S.vfPropId=v? (v.propertyId||'') : '';
  var h='<div class="card">';
  if(!v && props.length){
    h+='<label class="fld"><span>Property</span><select id="vfPick"><option value="">Choose a property\u2026</option>'+
      props.map(function(p,i){ return '<option value="'+i+'">'+esc(propLabel(p))+'</option>'; }).join('')+'<option value="new">A new property (adds it to the list)</option></select></label>';
  }
  h+='<div class="grid2"><label class="fld"><span>Street address</span><input type="text" id="vfA1" value="'+esc(v?v.address1:'')+'" placeholder="36 Grange St"></label>'+
    '<label class="fld"><span>Suburb / city</span><input type="text" id="vfA2" value="'+esc(v?v.address2:'')+'" placeholder="North Dunedin"></label></div>'+
    '<div id="vfAddrNote" class="small muted hidden" style="margin:-6px 0 12px">The address comes from the property \u2014 change it in Property settings (group screen) or Flat Inspections Admin.</div>'+
    '<div class="grid2"><label class="fld"><span>Rent per week ($)</span><input type="number" inputmode="decimal" id="vfRent" value="'+esc(v?v.rent:'')+'"></label>'+
    '<label class="fld"><span>Available from</span><input type="date" id="vfMove" value="'+esc(v?dateInput(v.moveIn):'')+'"></label></div>'+
    '<label class="fld"><span>Length of tenancy</span><select id="vfTen">'+TENANCY.map(function(t){ return '<option'+(v&&v.tenancy===t?' selected':'')+'>'+t+'</option>'; }).join('')+
      (v&&v.tenancy&&TENANCY.indexOf(v.tenancy)<0?'<option selected>'+esc(v.tenancy)+'</option>':'')+'</select></label>'+
    '<label class="fld"><span>Viewing date</span><input type="date" id="vfDate" value="'+esc(v?dateInput(v.viewingAt):dateInput(start.toISOString()))+'"></label>'+
    '<div class="grid2"><label class="fld"><span>First group at</span><input type="time" id="vfFirst" value="'+esc(first)+'"></label>'+
    '<label class="fld"><span>Last group by</span><input type="time" id="vfLast" value="'+esc(last)+'"></label></div>'+
    '<label class="fld" style="margin-block-end:4px"><span>Time between groups</span></label>'+
    '<div class="seg c4" id="vfGaps">'+GAPS.map(function(g){ return '<button type="button" data-act="gap" data-id="'+g+'" class="'+(gap===g?'on':'')+'">'+g+' min</button>'; }).join('')+
      '<button type="button" data-act="gap" data-id="other" class="'+(GAPS.indexOf(gap)<0?'on':'')+'">Other\u2026</button></div>'+
    '<label class="fld'+(GAPS.indexOf(gap)<0?'':' hidden')+'" id="vfGapOther"><span>Minutes between groups</span><input type="number" inputmode="numeric" id="vfGapN" min="1" max="120" value="'+esc(gap)+'"></label>'+
    '<div class="slotprev" id="vfPrev"></div>'+
    hostField(v? v.hostedBy : (localStorage.getItem('tm-host')||myName()||((S.st&&S.st.hosts)||[])[0]||''))+
    '<label class="fld"><span>Notes (optional)</span><textarea id="vfNotes" placeholder="Parking, access\u2026">'+esc(v?v.notes:'')+'</textarea></label>'+
    '<div id="vfErr" class="err"></div></div>';
  if(v) h+='<div class="small muted" style="margin:0 6px 12px">Changing the times or the gap only changes the open times \u2014 groups already booked keep their time.</div>'+
    '<div class="row wrap">'+(!attendees(v.id).length?'<button class="btn danger sm" type="button" data-act="delete-viewing" data-id="'+esc(v.id)+'">\uD83D\uDDD1 Delete viewing</button>':'')+(v.status!=='Cancelled'?'<button class="btn danger sm" type="button" data-act="viewing-status" data-id="Cancelled">Cancel viewing</button>':'<button class="btn sm" type="button" data-act="viewing-status" data-id="Scheduled">Reinstate viewing</button>')+'</div>';
  $('#app').innerHTML=h;
  // one address per property: a listed property's address is shown read-only; only "A new property" is typed
  function lockAddr(on){ ['#vfA1','#vfA2'].forEach(function(id){ $(id).readOnly=on; }); $('#vfAddrNote').classList.toggle('hidden',!on||!$('#vfA1').value); }
  var pick=$('#vfPick');
  lockAddr(v? !!v.propertyId : !!pick);
  if(pick) pick.onchange=function(){   // onchange, not addEventListener: the screen can be redrawn in place
    var p=props[+pick.value]; S.vfPropId=p? (p.propertyId||'') : '';
    if(!p){ $('#vfA1').value=''; $('#vfA2').value=''; lockAddr(pick.value!=='new'); if(pick.value==='new') $('#vfA1').focus(); return; }
    $('#vfA1').value=p.address1; $('#vfA2').value=p.address2||''; $('#vfRent').value=p.rent; if(p.tenancy) $('#vfTen').value=p.tenancy;
    lockAddr(true);
  };
  slotPreview();
  setFooter('<button class="btn" type="button" data-act="back">Cancel</button><button class="btn primary" type="button" data-act="save-viewing" data-id="'+esc(id||'')+'">'+(v?'Save changes':'Create viewing')+'</button>');
};
function vfGap(){ var o=$('#vfGapOther'); return o&&!o.classList.contains('hidden')? Math.max(1,Math.min(120,+$('#vfGapN').value||0)) : S.vfGap; }
function slotPreview(){
  var box=$('#vfPrev'); if(!box) return;
  var d=$('#vfDate').value, f=$('#vfFirst').value, l=$('#vfLast').value, g=vfGap();
  if(!d||!f||!g){ box.textContent=''; return; }
  var v={viewingAt:new Date(d+'T'+f).toISOString(),lastAt:l?new Date(d+'T'+l).toISOString():'',slotMinutes:g}, s=slotsFor(v);
  box.textContent=s.length+' arrival time'+(s.length>1?'s':'')+': '+s.slice(0,12).map(fmtTime).join(' \u00B7 ')+(s.length>12?' \u2026':'');
}
function readViewingForm(){
  var d=$('#vfDate').value, f=$('#vfFirst').value, l=$('#vfLast').value, g=vfGap();
  var v={address1:$('#vfA1').value.trim(),address2:$('#vfA2').value.trim(),rent:$('#vfRent').value,moveIn:$('#vfMove').value,tenancy:$('#vfTen').value,
         viewingAt:d&&f? d+'T'+f : '', lastAt:d&&l? d+'T'+l : '', slotMinutes:g, notes:$('#vfNotes').value,hostedBy:$('#vfHost').value.trim(),
         propertyId:S.vfPropId||''};
  var pk=$('#vfPick');
  if(pk && pk.value===''){ $('#vfErr').textContent='Choose the property, or \u201CA new property\u201D.'; pk.focus(); return null; }
  if(!v.address1){ $('#vfErr').textContent='Enter the street address.'; $('#vfA1').focus(); return null; }
  v.address2=v.address2.replace(/[\s,]+\d{4}$/,'').trim();      // suburb / city only, no postcode
  if(!v.viewingAt){ $('#vfErr').textContent='Choose the date and when the first group arrives.'; return null; }
  if(v.lastAt && v.lastAt<v.viewingAt){ $('#vfErr').textContent='The last group can\u2019t be before the first.'; return null; }
  if(!g){ $('#vfErr').textContent='Enter the minutes between groups.'; return null; }
  try{ if(v.hostedBy) localStorage.setItem('tm-host',v.hostedBy); localStorage.setItem('tm-gap',String(g)); }catch(e){}
  return v;
}

/* ---------- A viewing: the arrival schedule ---------- */
VIEWS.viewing = function(id){
  var v=viewingById(id); if(!v){ home(); return; }
  setTitle(v.address1);
  var gs=groupsAt(id), list=attendees(id), unsent=list.filter(function(a){ return !sent(a) && canSend(a); });
  var bySlot={}, noTime=[];
  gs.forEach(function(g){ var t=groupArrival(g.key); if(t) (bySlot[t]=bySlot[t]||[]).push(g); else noTime.push(g); });
  var times=slotsFor(v); Object.keys(bySlot).forEach(function(t){ t=+t; if(times.indexOf(t)<0) times.push(t); }); times.sort(function(a,b){ return a-b; });
  var came=gs.filter(function(g){ return groupAttendance(g.key)==='Came'; }).length, ns=gs.filter(function(g){ return groupAttendance(g.key)==='No-show'; }).length;
  var times0=slotsFor(v), d=new Date(v.viewingAt);
  var h='<div class="card"><div class="row" style="align-items:flex-start"><div class="grow"><div class="title">'+esc(v.address1)+(v.address2?', '+esc(v.address2):'')+'</div>'+
    '<div class="small muted">'+esc(d.toLocaleDateString('en-NZ',{weekday:'short',day:'numeric',month:'short'}))+', from '+esc(fmtTime(d))+(v.hostedBy?' \u00B7 run by '+esc(v.hostedBy):'')+'</div><div style="margin-block-start:8px">'+
    (v.rent!==''?'<span class="pill">'+esc(money(v.rent))+'</span>':'')+(v.tenancy?'<span class="pill">'+esc(v.tenancy)+'</span>':'')+(v.moveIn?'<span class="pill">From '+esc(fmtDate(v.moveIn))+'</span>':'')+
    '<span class="pill">'+esc(times0.length?fmtTime(times0[0])+'\u2013'+fmtTime(times0[times0.length-1])+' \u00B7 groups every '+(v.slotMinutes||5)+' min':'')+'</span></div>'+
    (v.notes?'<div class="small" style="margin-block-start:8px">'+esc(v.notes)+'</div>':'')+'</div>'+
    '<button type="button" class="trash pencil" data-act="edit-viewing" data-id="'+esc(id)+'" aria-label="Edit viewing">\u270F\uFE0F</button></div></div>';
  h+='<div class="row" style="margin:18px 6px 10px"><h2 class="grow" style="margin:0">Arrival times</h2><span class="small muted">'+gs.length+' group'+(gs.length===1?'':'s')+' booked'+(came?' \u00B7 '+came+' came':'')+(ns?' \u00B7 '+ns+' no-show':'')+'</span></div>';
  times.forEach(function(t){
    var here=bySlot[t]||[];
    h+='<div class="slot"><div class="slot-t">'+esc(fmtTime(t))+'</div><div class="grow">'+
      (here.length? here.map(function(g){ return bookedGroupCard(g); }).join('') : '<button class="btn block slot-free" type="button" data-act="book" data-id="'+esc(id)+'" data-slot="'+t+'">\uFF0B Book a group</button>')+'</div></div>';
  });
  if(noTime.length){ h+='<h2>No arrival time set</h2>'; noTime.forEach(function(g){ h+=bookedGroupCard(g); }); }
  $('#app').innerHTML=h;
  var foot='<button class="btn" type="button" data-act="book" data-id="'+esc(id)+'" data-slot="">\uFF0B Book a group</button>';
  if(unsent.length) foot+='<button class="btn primary" type="button" data-act="send-all" data-id="'+esc(id)+'">\u2709 Send forms ('+unsent.length+')</button>';
  else if(v.status==='Scheduled' && list.length) foot+='<button class="btn" type="button" data-act="viewing-done" data-id="'+esc(id)+'">\u2713 Viewing finished</button>';
  setFooter(foot);
};
function bookedGroupCard(g){
  var att=groupAttendance(g.key), unsent=g.members.filter(function(a){ return !sent(a) && canSend(a); });
  return '<div class="card group"><div class="ghead"><div class="title grow" data-act="group" data-id="'+esc(g.key)+'" style="cursor:pointer">'+(g.members.length>1?'\uD83D\uDC65 '+esc(groupName(g.key))+' \u00B7 '+g.members.length:'\uD83D\uDE4B '+whoHtml(g.members[0]))+' \u203A</div>'+
    '<button class="btn sm" type="button" data-act="book-add" data-id="'+esc(g.key)+'">\uFF0B Person</button></div>'+
    g.members.map(memberRow).join('')+
    '<div class="seg c3" style="margin-block:10px 0"><button type="button" data-act="attend" data-id="'+esc(g.key)+'" data-v="Came" class="'+(att==='Came'?'on':'')+'">\u2713 Came</button>'+
      '<button type="button" data-act="attend" data-id="'+esc(g.key)+'" data-v="No-show" class="'+(att==='No-show'?'on':'')+'">No-show</button>'+
      '<button type="button" data-act="change-time" data-id="'+esc(g.key)+'">\uD83D\uDD52 Move</button></div>'+
    (unsent.length>1?'<button class="btn sm primary block" type="button" style="margin-block-start:8px" data-act="send-group" data-id="'+esc(g.key)+'">\u2709 Send forms to this group ('+unsent.length+')</button>':'')+'</div>';
}
/* someone who's been here before: their status as a person, when it says more than this application does */
function returningPill(a){ var p=personById(a.personId); if(!p||personApps(p.id).length<2&&!p.tenancies) return ''; return /^(Tenant|Past Tenant|Past Applicant)$/.test(p.status)?'<span class="pill st-warn" title="Known from before">\u21BA '+esc(p.status)+'</span>':''; }
function memberRow(a){
  var st=stInfo(a), lead=a.ref===groupKey(a) && groupMembers(groupKey(a)).length>1;
  return '<div class="member" data-act="app" data-id="'+esc(a.ref)+'"><div class="avatar">'+esc(initials(a.name))+'</div><div class="grow">'+
    '<div style="font-weight:750">'+nameWithKnown(a.name,a.knownAs)+(lead?'<span class="lead">first</span>':'')+'</div>'+
    '<div class="contact-line">'+(a.mobile?'<span>\uD83D\uDCF1 '+esc(a.mobile)+'</span>':'')+(a.email?'<span>\u2709 '+esc(a.email)+'</span>':byText(a)?'<span>\uD83D\uDCAC Form goes by text</span>':'<span style="color:var(--miss)">'+(mobileOk(a)?'No email \u2014 add one to send the DocHub form':a.mobile?'No email, and the mobile looks too short to text':'No email or mobile \u2014 add one to send the form')+'</span>')+'</div>'+
    '<div style="margin-block-start:6px"><span class="pill '+st.c+'">'+esc(st.t)+'</span>'+refInfo(a)+tribunalPill(a)+returningPill(a)+'</div></div>'+
    (!sent(a)&&canSend(a)?'<button class="btn sm ghost" type="button" data-act="send-one" data-id="'+esc(a.ref)+'" aria-label="Send application form to '+esc(a.name)+'">\u2709</button>':'<span class="chev">\u203A</span>')+'</div>';
}

/* ---------- People editor (booking a group, new word-of-mouth group) ---------- */
function peopleHtml(){
  return S.people.map(function(p,i){
    return '<div class="card"><div class="row"><div class="small muted grow" style="font-weight:800;letter-spacing:.06em">PERSON '+(i+1)+(i===0&&S.people.length>1?' \u00B7 FIRST IN GROUP':'')+'</div>'+
      (S.people.length>1?'<button class="btn sm danger" type="button" data-act="rm-person" data-id="'+i+'">Remove</button>':'')+'</div>'+
      '<label class="fld" style="margin-block-start:8px"><span>Full name</span><input type="text" data-pi="'+i+'" data-pf="name" autocomplete="off" autocapitalize="words" value="'+esc(p.name)+'"></label>'+
      '<div class="grid2"><label class="fld"><span>Mobile</span><input type="tel" data-pi="'+i+'" data-pf="mobile" autocomplete="off" value="'+esc(p.mobile)+'"></label>'+
      '<label class="fld"><span>Email</span><input type="email" data-pi="'+i+'" data-pf="email" autocomplete="off" autocapitalize="off" value="'+esc(p.email)+'"></label></div></div>';
  }).join('')+'<button class="btn ghost block" type="button" data-act="add-person" style="margin-block-end:12px">\uFF0B Add another person</button>';
}
function checkPeople(){
  var ppl=S.people.filter(function(p){ return (p.name+p.mobile+p.email).trim(); });
  if(!ppl.length) return 'Add at least one person.';
  for(var i=0;i<ppl.length;i++){ var p=ppl[i];
    if(!p.name.trim()) return 'Every person needs a name.';
    if(!p.mobile.trim()&&!p.email.trim()) return 'Add a mobile or email for '+p.name.trim()+'.';
    if(!validEmail(p.email)) return 'Check the email address for '+p.name.trim()+'.'; }
  return '';
}
function blankPerson(){ return {name:'',mobile:'',email:''}; }

/* ---------- Book a group into a viewing (or add one person to a booked group) ---------- */
VIEWS.book = function(arg){
  var v=viewingById(arg.viewingId); if(!v){ back(); return; }
  if(!S.people||S.peopleFor!==JSON.stringify(arg)){ S.people=[blankPerson()]; S.peopleFor=JSON.stringify(arg); S.bookSlot=arg.slot?+arg.slot:0; }
  if(arg.group){
    var g=groupOf(arg.group), t=groupArrival(arg.group);
    setTitle('Add to '+groupName(arg.group));
    $('#app').innerHTML='<div class="card"><div class="title">'+esc(groupName(arg.group))+'</div><div class="small muted">'+esc(v.address1)+(t?' \u00B7 arriving '+esc(fmtTime(t)):'')+' \u00B7 '+g.members.length+' already booked</div></div>'+
      peopleHtml().replace(/<button class="btn ghost block"[^>]*>[^<]*<\/button>$/,'')+'<div id="bkErr" class="err"></div>';
    setFooter('<button class="btn" type="button" data-act="back">Cancel</button><button class="btn primary" type="button" data-act="save-book" data-id="'+esc(arg.group)+'">Add to group</button>');
    return;
  }
  setTitle('Book a group');
  var taken={}; groupsAt(v.id).forEach(function(g){ var t=groupArrival(g.key); if(t) taken[t]=groupName(g.key); });
  var slots=slotsFor(v);
  if(!S.bookSlot||taken[S.bookSlot]) S.bookSlot=(slots.find(function(t){ return !taken[t]; })||0);
  var other=S.bookSlot && slots.indexOf(S.bookSlot)<0;
  var takenList=Object.keys(taken).sort().map(function(t){ return fmtTime(+t)+' '+taken[t]; });
  $('#app').innerHTML='<div class="card"><div class="title">'+esc(v.address1)+'</div><div class="small muted">Viewing '+esc(new Date(v.viewingAt).toLocaleDateString('en-NZ',{weekday:'short',day:'numeric',month:'short'}))+', groups every '+(v.slotMinutes||5)+' min</div></div>'+
    '<div class="card"><label class="fld" style="margin-block-end:6px"><span>Ask them to arrive at</span></label><div class="slotpick">'+
    slots.map(function(t){ return '<button type="button" data-act="pick-slot" data-id="'+t+'" class="'+(taken[t]?'taken':'')+(S.bookSlot===t?' on':'')+'"'+(taken[t]?' disabled':'')+'>'+esc(fmtTime(t))+'</button>'; }).join('')+
    '<button type="button" data-act="pick-slot" data-id="other" class="'+(other?'on':'')+'">Other\u2026</button></div>'+
    '<label class="fld'+(other?'':' hidden')+'" id="bkOther" style="margin-block-start:10px"><span>Other time</span><input type="time" id="bkOtherT" value="'+esc(other?timeInput(new Date(S.bookSlot).toISOString()):'')+'"></label>'+
    (takenList.length?'<div class="small muted" style="margin-block-start:8px">Taken: '+esc(takenList.join(' \u00B7 '))+'</div>':'')+'</div>'+
    '<h2>People in this group</h2>'+peopleHtml()+
    '<div class="small muted" style="margin:0 6px 12px">Everyone in the group shares the arrival time.</div><div id="bkErr" class="err"></div>';
  setFooter('<button class="btn" type="button" data-act="back">Cancel</button><button class="btn primary" type="button" data-act="save-book" data-id="">'+(S.bookSlot?'Book '+esc(fmtTime(S.bookSlot)):'Book group')+'</button>');
};

/* ---------- New group that didn't come through a viewing ---------- */
var SOURCES=['Word of mouth','Referral','Other'];
VIEWS.newGroup = function(){
  setTitle('New applicant group');
  if(!S.people||S.peopleFor!=='newGroup'){ S.people=[blankPerson()]; S.peopleFor='newGroup'; S.ngSource='Word of mouth'; S.ngProp=''; }
  var props=(S.st&&S.st.properties)||[];
  var h='<div class="card"><label class="fld"><span>Property</span><select id="ngProp"><option value="">Choose the property\u2026</option>'+
    props.map(function(p,i){ return '<option value="'+i+'"'+(S.ngProp===String(i)?' selected':'')+'>'+esc(propLabel(p))+(p.rent!==''&&p.rent!=null?' \u2014 '+esc(money(p.rent)):'')+'</option>'; }).join('')+
    '<option value="new"'+(S.ngProp==='new'?' selected':'')+'>A new property (adds it to the list)</option></select></label>'+
    '<div id="ngNew" class="'+(S.ngProp==='new'?'':'hidden')+'"><div class="grid2"><label class="fld"><span>Street address</span><input type="text" id="ngA1"></label><label class="fld"><span>Suburb / city</span><input type="text" id="ngA2"></label></div>'+
      '<div class="grid2"><label class="fld"><span>Rent per week ($)</span><input type="number" inputmode="decimal" id="ngRent"></label><label class="fld"><span>Length of tenancy</span><select id="ngTen">'+TENANCY.map(function(t){ return '<option>'+t+'</option>'; }).join('')+'</select></label></div></div>'+
    '<label class="fld" style="margin-block-end:4px"><span>How did they hear about it?</span></label><div class="seg c3">'+SOURCES.map(function(s){ return '<button type="button" data-act="pick-source" data-id="'+esc(s)+'" class="'+(S.ngSource===s?'on':'')+'">'+esc(s)+'</button>'; }).join('')+'</div>'+
    '<label class="fld"><span>Notes (optional)</span><input type="text" id="ngNotes" placeholder="e.g. friend of the current tenants"></label></div>'+
    '<h2>People in this group</h2>'+peopleHtml()+'<div id="bkErr" class="err"></div>';
  $('#app').innerHTML=h;
  $('#ngProp').onchange=function(e){ S.ngProp=e.target.value; $('#ngNew').classList.toggle('hidden',S.ngProp!=='new'); };   // not addEventListener: redrawn in place
  setFooter('<button class="btn" type="button" data-act="back">Cancel</button><button class="btn primary" type="button" data-act="save-group">Create group</button>');
};

/* ---------- A group: people, progress and the decision ---------- */
VIEWS.group = function(key){
  var g=groupOf(key); if(!g){ back(); return; }
  var x=groupStats(g), l=g.lead, n=g.members.length, unsent=g.members.filter(function(a){ return !sent(a) && canSend(a); });
  setTitle(n>1? groupName(key) : l.name);
  var h='<div class="card"><button class="btn sm ghost" type="button" data-act="group-edit" data-id="'+esc(key)+'" aria-label="Edit the group\u2019s details" title="Edit" style="float:right;margin:-4px -6px 0 8px">\u270F\uFE0F</button>'+
    '<div class="title">'+esc(l.address1)+(l.address2?', '+esc(l.address2):'')+'</div>'+
    '<div class="small muted">'+[l.rent!==''?money(l.rent):'',l.tenancy,l.moveIn?'from '+fmtDate(l.moveIn):''].filter(Boolean).map(esc).join(' \u00B7 ')+'</div>'+
    '<div>'+originPill(l,true)+(l.sourceNotes?'<span class="pill">'+esc(l.sourceNotes)+'</span>':'')+'</div>'+
    '<div class="timeline" style="grid-template-columns:repeat(3,1fr)"><div class="on"><b>'+n+'</b>'+(n>1?'people':'person')+'</div>'+
      '<div class="'+(x.back===n?'on':'')+'"><b>'+x.back+'/'+n+'</b>forms back</div><div class="'+(x.refT&&x.refD>=x.refT?'on':'')+'"><b>'+(x.refT?x.refD+'/'+x.refT:'\u2013')+'</b>refs checked</div></div></div>';
  h+=sectStart('g-people','People',countPill(n,'person','people')+(unsent.length?'<span class="pill st-warn">'+unsent.length+' form'+(unsent.length>1?'s':'')+' to send</span>':''))+
    '<div class="card group" style="padding-block:4px 12px">'+g.members.map(memberRow).join('').replace('class="member"','class="member" style="border-block-start:0"')+
    '<div class="row" style="gap:8px;margin-block-start:10px"><button class="btn sm grow" type="button" data-act="'+(l.viewingId?'book-add':'add-to-group')+'" data-id="'+esc(key)+'">\uFF0B Add person</button>'+
    (unsent.length?'<button class="btn sm primary grow" type="button" data-act="send-group" data-id="'+esc(key)+'">\u2709 Send forms ('+unsent.length+')</button>':'')+'</div></div>'+SECT_END;
  h+=sectStart('g-decision','Decision for the '+(n>1?'group':'applicant'),l.decision?'<span class="pill dec">'+esc(l.decision)+'</span>':'<span class="pill">Not decided</span>',false,!!l.decision)+'<div class="card"><div class="seg c4">'+(S.st.decisions||[]).map(function(d){ return '<button type="button" data-seg="dec" data-v="'+esc(d)+'" class="'+(l.decision===d?'on':'')+'">'+esc(d)+'</button>'; }).join('')+'</div>'+
    '<label class="fld"><span>Decision notes</span><textarea id="gDecNotes">'+esc(l.decisionNotes)+'</textarea></label>'+
    '<div class="row" style="gap:8px"><button class="btn grow'+(l.decision==='Declined'?'':' hidden')+'" type="button" id="gDecline" data-act="decline-email" data-id="'+esc(l.ref)+'">\u2709 Decline email</button><button class="btn primary grow" type="button" data-act="save-group-decision" data-id="'+esc(key)+'">Save decision</button></div></div>'+SECT_END;
  h+=sectionHtml('g-agreement','Tenancy agreement',agreementPill(l)||(l.decision==='Approved'?'<span class="pill st-warn">Ready to send</span>':''),agreementCard(key,l));
  h+='<div class="sep"></div><button class="btn block danger" type="button" data-act="group-delete" data-id="'+esc(key)+'">\uD83D\uDDD1 Delete '+(n>1?'group':'applicant')+' and all their records</button>'+
    '<div class="small muted" style="margin:6px 6px 0;text-align:center">Admin: for clearing test data. Removes their forms, uploads, agreement and tenancy.</div>';
  $('#app').innerHTML=h;
};
/* Edit a group's header: property, rent, tenancy length, move-in date, how they heard about it, notes (saved on every member) */
function groupEditDialog(key){
  var g=groupOf(key); if(!g) return; var l=g.lead, props=(S.st&&S.st.properties)||[], src=SOURCES.indexOf(l.source)>=0? l.source : 'Other';
  var locked=l.agreement&&/^(Sent|Signed)$/.test(l.agreement.status);
  var known=props.some(function(p){ return p.propertyId&&p.propertyId===l.propertyId; });
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:10px">Edit details</div>'+
    '<label class="fld"><span>Property</span><select id="geProp"'+(locked?' disabled':'')+'>'+(known?'':'<option value="">'+esc(l.address1||'No property')+' (as entered)</option>')+
      props.map(function(p){ return '<option value="'+esc(p.propertyId)+'"'+(p.propertyId===l.propertyId?' selected':'')+'>'+esc(propLabel(p))+'</option>'; }).join('')+'</select></label>'+
    (locked?'<div class="small muted" style="margin:-6px 0 10px">The agreement has been sent, so the property can\u2019t be changed.</div>':'')+
    '<div class="grid2"><label class="fld"><span>Rent per week ($)</span><input type="number" inputmode="decimal" min="0" step="1" id="geRent" value="'+esc(l.rent)+'"></label>'+
    '<label class="fld"><span>Length of tenancy</span><select id="geTen">'+(TENANCY.indexOf(l.tenancy)<0&&l.tenancy?'<option selected>'+esc(l.tenancy)+'</option>':'')+
      TENANCY.map(function(t){ return '<option'+(t===l.tenancy?' selected':'')+'>'+esc(t)+'</option>'; }).join('')+'</select></label></div>'+
    '<label class="fld"><span>Preferred move-in date (optional)</span><input type="date" id="geMove" value="'+esc(String(l.moveIn||'').slice(0,10))+'"></label>'+
    '<label class="fld" style="margin-block-end:4px"><span>How did they hear about it?</span></label><div class="seg c3" id="geSrc">'+
      SOURCES.map(function(x){ return '<button type="button" data-src="'+esc(x)+'" class="'+(x===src?'on':'')+'">'+esc(x)+'</button>'; }).join('')+'</div>'+
    '<label class="fld"><span>Notes (optional)</span><input type="text" id="geNotes" value="'+esc(l.sourceNotes||'')+'" placeholder="e.g. friend of the current tenants"></label>'+
    '<div id="geErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-ge="cancel">Cancel</button><button class="btn primary" type="button" data-ge="save">Save</button></div>');
  // picking a property fills in its usual rent and tenancy length (still editable)
  $('#geProp',m).onchange=function(){ var p=props.filter(function(x){ return x.propertyId===this.value; },this)[0]; if(!p) return;
    if(p.rent!==''&&p.rent!=null) $('#geRent',m).value=p.rent; if(p.tenancy&&TENANCY.indexOf(p.tenancy)>=0) $('#geTen',m).value=p.tenancy; };
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-src]'); if(b){ src=b.getAttribute('data-src'); [].forEach.call(m.querySelectorAll('[data-src]'),function(x){ x.classList.toggle('on',x===b); }); return; }
    var a=e.target.closest('[data-ge]'); if(!a) return;
    if(a.getAttribute('data-ge')==='cancel') return m.remove();
    var d={propertyId:$('#geProp',m).value,rent:$('#geRent',m).value.trim(),tenancy:$('#geTen',m).value,moveIn:$('#geMove',m).value,source:src,notes:$('#geNotes',m).value.trim()};
    if(d.rent!==''&&!(+d.rent>=0)){ $('#geErr',m).textContent='Check the rent per week.'; return; }
    busy(a,'Saving',api.tmUpdateGroupDetails(key,d)).then(function(st){ m.remove(); apply(st); toast('Details saved'); keepScroll(render); })
      .catch(function(x){ $('#geErr',m).textContent=x&&x.message||'Couldn\u2019t save'; });
  });
}
/* Admin delete: shows exactly what goes, then asks for the admin PIN when forms were submitted, the agreement signed or a tenancy exists */
function groupDeleteDialog(key,btn){
  return busy(btn,'Checking',api.tmGroupDeletePlan(key)).then(function(p){
    var li=function(t){ return '<li>'+t+'</li>'; }, ag=p.agreement;
    var items=[li(p.people.length+' application'+(p.people.length>1?'s':'')+': '+esc(nameList(p.people.map(whoText))))];
    if(p.submissions) items.push(li(p.submissions+' submitted form'+(p.submissions>1?'s':'')+', with their uploaded documents and signed PDFs'));
    items.push(li('Reference checks, notes and drafts'));
    if(ag) items.push(li('The tenancy agreement ('+(ag.provider==='esign'?'built-in signing':'DocHub')+', '+esc(String(ag.status||'').toLowerCase()||'sent')+')'+(ag.provider==='esign'?', its audit trail and files':'')));
    p.tenancies.forEach(function(t){ items.push(li('Tenancy at '+esc(t.property)+(p.bondPayments?' and '+p.bondPayments+' bond payment'+(p.bondPayments>1?'s':'')+' with receipts':''))); });
    var pinHtml=!p.needsPin?'':(p.pinSet?'<label class="fld"><span>Admin PIN</span><input type="password" inputmode="numeric" id="gdPin" autocomplete="off"></label>'
      :'<div class="small" style="margin-block-end:8px">No admin PIN has been set yet. Create one now (4 to 8 digits). You\u2019ll need it for deletes like this.</div><div class="grid2"><label class="fld"><span>New admin PIN</span><input type="password" inputmode="numeric" id="gdNew" autocomplete="new-password"></label><label class="fld"><span>Repeat it</span><input type="password" inputmode="numeric" id="gdNew2" autocomplete="new-password"></label></div>');
    var m=modal('<div class="title" style="font-size:1.1rem;color:var(--bad)">Delete everything for this '+(p.people.length>1?'group':'applicant')+'?</div>'+
      '<div class="small" style="margin-block:8px">This removes:</div><ul class="small" style="margin:0 0 10px 18px;padding:0">'+items.join('')+'</ul>'+
      '<div class="small muted" style="margin-block-end:12px">Records are deleted straight away and can\u2019t be undone. Files go to the Google Drive bin, which empties itself after 30 days.</div>'+pinHtml+
      '<div id="gdErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-gd="cancel">Cancel</button><button class="btn danger" type="button" data-gd="go">\uD83D\uDDD1 Delete everything</button></div>');
    var f=$('#gdPin',m)||$('#gdNew',m); if(f) setTimeout(function(){ f.focus(); },50);
    m.addEventListener('click',function(e){ var b=e.target.closest('[data-gd]'); if(!b) return;
      if(b.getAttribute('data-gd')==='cancel'){ m.remove(); return; }
      var err=$('#gdErr',m); err.textContent='';
      var pin=$('#gdPin',m)?$('#gdPin',m).value.trim():'', first=Promise.resolve();
      if(p.needsPin&&!p.pinSet){ var n1=$('#gdNew',m).value.trim(), n2=$('#gdNew2',m).value.trim();
        if(!/^\d{4,8}$/.test(n1)){ err.textContent='The PIN must be 4 to 8 digits.'; return; }
        if(n1!==n2){ err.textContent='The two PINs don\u2019t match.'; return; }
        pin=n1; first=api.tmSetAdminPin('',n1).then(function(st){ apply(st); p.pinSet=true; }); }
      else if(p.needsPin&&!pin){ err.textContent='Enter the admin PIN.'; return; }
      busy(b,'Deleting',first.then(function(){ return api.tmDeleteGroup(key,pin); })).then(function(st){ m.remove(); apply(st);
        var d=st.deleted||{}; toast('Deleted '+d.people+' application'+(d.people===1?'':'s')+(d.agreements?', the agreement':'')+(d.tenancies?', the tenancy':'')+(d.files?' and '+d.files+' file'+(d.files===1?'':'s'):''),5000);
        if((d.notes||[]).length) info('Deleted', d.notes.join(' '));
        S.stack=[]; S.cur={view:'home'}; S.tab='groups'; render(); window.scrollTo(0,0); })
        .catch(function(x){ err.textContent=x&&x.message||'Couldn\u2019t delete'; });
    });
  }).catch(function(){});
}
/* Setup: create or change the admin PIN */
/* Setup > Speed check: how long things take for real, to see where the seconds go */
/* Setup > My details: the signed-in user's name and phone numbers */
/* ================= Setup > Test suite =================
   Real end-to-end runs with made-up people whose emails are plus-addresses of one inbox (kelvin.box+ben@gmail.com).
   Agreements it sends are TEST agreements: marked as tests everywhere and signed automatically. */
var TEST_FIRST=['Ben','Amy'];
function testBase(){ try{ return localStorage.getItem('tm-test-email')||'kelvin.box@gmail.com'; }catch(e){ return 'kelvin.box@gmail.com'; } }
function testEmail(base,first){ var m=/^([^@+\s]+)(?:\+[^@\s]*)?@([^@\s]+\.[^@\s]+)$/.exec(String(base||'').trim()); return m? m[1]+'+'+first.toLowerCase()+'@'+m[2] : ''; }
function nextMonthFirst(){ var d=new Date(); d=new Date(d.getFullYear(),d.getMonth()+1,1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01'; }
function plusDays(n){ var d=new Date(); d.setDate(d.getDate()+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function testTenancies(){ return tenancies().filter(function(t){ return String(t.notes||'').indexOf('TEST:')===0 && t.agreementProvider==='esign' && t.requestId && tenancyPhase(t)!=='ended'; }); }
VIEWS.testSuite = function(){
  setTitle('Test suite');
  var tt=testTenancies();
  $('#app').innerHTML='<div class="small muted" style="margin:4px 6px 10px">Runs the real steps end to end with made-up people. Their emails go to plus-addresses of your inbox (e.g. kelvin.box+ben@gmail.com), so you get every email they would. '+
    'Agreements it sends are marked <b>TEST</b> on every page, email and PDF, and are signed automatically. It creates real records in the Register: delete the group afterwards with its Delete button.</div>'+
    (esignOn()?'':'<div class="card" style="border-color:var(--miss)"><b>Built-in signing is off.</b> <span class="small">The tests sign automatically, which only built-in signing can do. Turn it on in Setup first.</span></div>')+
    '<div class="card"><div class="title">\ud83e\uddea New tenants, start to finish</div><div class="small muted" style="margin-block:4px 10px">Creates a group of two (Ben and Amy Tester), sends them the application form, fills it in and submits it for each, approves the group, sends a one-year tenancy agreement, '+
      'then signs it as each tenant and the landlord. Checking status then creates the tenancy.</div><button class="btn primary" type="button" data-act="test-new"'+(esignOn()?'':' disabled')+'>Run\u2026</button></div>'+
    '<div class="card"><div class="title">\u2795 Add a tenant to a test tenancy</div><div class="small muted" style="margin-block:4px 10px">Picks a tenancy the first test created, then adds a new tenant end to end: application form, approval, change of tenants, '+
      'signed by the new tenant, the existing tenants and the landlord, then the tenancy updates.</div>'+
      (tt.length?'<button class="btn primary" type="button" data-act="test-add"'+(esignOn()?'':' disabled')+'>Run\u2026</button>':'<div class="small muted">No test tenancies yet: run the first test.</div>')+'</div>';
};
function testPropOptions(sel){
  return setupProps().filter(function(p){ return p.active; }).map(function(p){ var miss=esignMissing(p);
    return '<option value="'+esc(p.propertyId)+'"'+(p.propertyId===sel?' selected':'')+(miss.length?' disabled':'')+'>'+esc(p.name||p.address1)+(miss.length?' (agreement details not finished)':'')+'</option>'; }).join('');
}
/* Test 1: questions, then the run */
function testNewDialog(){
  var props=setupProps().filter(function(p){ return p.active && !esignMissing(p).length; }), first=props[0]||{};
  var m=modal('<div class="title" style="font-size:1.1rem">New tenants, start to finish</div>'+
    '<label class="fld"><span>Your email address (each tester gets a +name version of it)</span><input type="email" id="tsEmail" autocapitalize="off" value="'+esc(testBase())+'"></label>'+
    '<div class="small muted" id="tsWho" style="margin-block:-4px 10px"></div>'+
    '<label class="fld"><span>Property</span><select id="tsProp">'+testPropOptions(first.propertyId)+'</select></label>'+(props.length?'':'<div class="small" style="color:var(--bad);margin-block:-4px 10px">No property has all its agreement details filled in yet (Setup &gt; Properties).</div>')+
    '<label class="fld"><span>Landlord</span><select id="tsLL">'+landlords().map(function(l){ return '<option'+(l.name===first.landlord?' selected':'')+'>'+esc(l.name)+'</option>'; }).join('')+'</select></label>'+
    '<div class="grid2"><label class="fld"><span>Application form</span><select id="tsForm"><option>Full</option><option>Tenancy Services</option></select></label>'+
    '<label class="fld"><span>Tenancy starts (runs one year)</span><input type="date" id="tsStart" value="'+nextMonthFirst()+'"></label></div>'+
    '<div class="small" style="color:var(--miss);margin-block:2px 10px">This sends real emails (to the addresses above) and makes a real group, applications, a TEST agreement and a tenancy in the Register.</div>'+
    '<div id="tsErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-ts="cancel">Cancel</button><button class="btn primary" type="button" data-ts="go">Run test</button></div>');
  function who(){ var b=$('#tsEmail',m).value; $('#tsWho',m).innerHTML=TEST_FIRST.map(function(n){ var e=testEmail(b,n); return esc(n+' Tester')+': '+(e?esc(e):'<span style="color:var(--bad)">check the email address</span>'); }).join('<br>'); }
  who();
  $('#tsEmail',m).addEventListener('input',who);
  $('#tsProp',m).addEventListener('change',function(){ var p=setupPropById(this.value); if(p&&p.landlord) $('#tsLL',m).value=p.landlord; });
  m.addEventListener('click',function(e){ var b=e.target.closest('[data-ts]'); if(!b) return;
    if(b.getAttribute('data-ts')==='cancel') return m.remove();
    var o={base:$('#tsEmail',m).value.trim(),propertyId:$('#tsProp',m).value,landlord:$('#tsLL',m).value,formType:$('#tsForm',m).value,start:$('#tsStart',m).value};
    if(!testEmail(o.base,'x')){ $('#tsErr',m).textContent='Enter a valid email address.'; return; }
    if(!o.propertyId){ $('#tsErr',m).textContent='Choose a property (one with all its agreement details filled in).'; return; }
    if(!o.landlord){ $('#tsErr',m).textContent='Choose a landlord.'; return; }
    if(!o.start){ $('#tsErr',m).textContent='Choose the start date.'; return; }
    try{ localStorage.setItem('tm-test-email',o.base); }catch(x){}
    m.remove(); runNewTenantsTest(o);
  });
}
function runNewTenantsTest(o){
  var c={};
  testRunner('New tenants, start to finish',[
    {label:'Create the group (Ben and Amy Tester)',run:function(){ return api.tmTestCreateGroup({base:o.base,propertyId:o.propertyId,names:TEST_FIRST}).then(function(r){ c.group=r.group; c.refs=r.refs; return r.refs.join(', '); }); }},
    {label:'Send them the application form ('+o.formType+')',run:function(){ return api.tmTestSendForms(c.refs,o.formType).then(function(){ return 'emailed to the +ben and +amy addresses'; }); }},
    {label:'Fill in and submit Ben\u2019s application',run:function(){ return api.tmTestFillForm(c.refs[0],o.start,o.base).then(function(){ return 'with ID photo, consents, signature and location'; }); }},
    {label:'Fill in and submit Amy\u2019s application',run:function(){ return api.tmTestFillForm(c.refs[1],o.start,o.base).then(function(){ return ''; }); }},
    {label:'Approve the group',run:function(){ return api.tmTestApprove(c.group).then(function(){ return ''; }); }},
    {label:'Send the tenancy agreement (TEST)',run:function(){ return api.tmTestSendAgreement(c.group,o.landlord,o.start).then(function(r){ return r.term+' \u00b7 $'+r.rent+' pw \u00b7 bond $'+r.bond; }); }},
    {label:'Sign as each tenant, then the landlord',run:function(ctx){ return testSignAll('agreement',c.group,ctx).then(function(r){ c.tenancy=r.tenancyId; return r.tenancyId?'tenancy '+r.tenancyId+' created':''; }); }}
  ],function(){ if(c.group) go('group',c.group); });
}
/* Test 2 */
function testAddDialog(){
  var tt=testTenancies();
  var m=modal('<div class="title" style="font-size:1.1rem">Add a tenant to a test tenancy</div>'+
    '<label class="fld"><span>Your email address (the new tester gets a +name version of it)</span><input type="email" id="taEmail" autocapitalize="off" value="'+esc(testBase())+'"></label>'+
    '<label class="fld"><span>Test tenancy</span><select id="taTen">'+tt.map(function(t){ var live=t.pendingChange&&t.pendingChange.status==='Sent';
      return '<option value="'+esc(t.id)+'"'+(live?' disabled':'')+'>'+esc((t.room?t.room+', ':'')+(t.property||'')+' \u00b7 '+tenancyNames(t))+(live?' (a change is already out)':'')+'</option>'; }).join('')+'</select></label>'+
    '<div class="grid2"><label class="fld"><span>Application form</span><select id="taForm"><option>Full</option><option>Tenancy Services</option></select></label>'+
    '<label class="fld"><span>Joins on</span><input type="date" id="taEff" value="'+plusDays(7)+'"></label></div>'+
    '<div class="small" style="color:var(--miss);margin-block:2px 10px">This sends real emails and signs the change for everyone on the tenancy (only test tenancies are listed).</div>'+
    '<div id="taErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-ta="cancel">Cancel</button><button class="btn primary" type="button" data-ta="go">Run test</button></div>');
  m.addEventListener('click',function(e){ var b=e.target.closest('[data-ta]'); if(!b) return;
    if(b.getAttribute('data-ta')==='cancel') return m.remove();
    var o={base:$('#taEmail',m).value.trim(),tenancyId:$('#taTen',m).value,formType:$('#taForm',m).value,effective:$('#taEff',m).value};
    if(!testEmail(o.base,'x')){ $('#taErr',m).textContent='Enter a valid email address.'; return; }
    if(!o.tenancyId){ $('#taErr',m).textContent='Choose a tenancy.'; return; }
    try{ localStorage.setItem('tm-test-email',o.base); }catch(x){}
    m.remove(); runAddTenantTest(o);
  });
}
function runAddTenantTest(o){
  var c={};
  testRunner('Add a tenant to a test tenancy',[
    {label:'Choose a new tester',run:function(){ return api.tmTestNextName(o.tenancyId).then(function(r){ c.name=r.name; c.propertyId=r.propertyId; return r.name+' Tester <'+testEmail(o.base,r.name)+'>'; }); }},
    {label:'Create their application',run:function(){ return api.tmTestCreateGroup({base:o.base,propertyId:c.propertyId,names:[c.name]}).then(function(r){ c.group=r.group; c.ref=r.refs[0]; return r.refs[0]; }); }},
    {label:'Send them the application form ('+o.formType+')',run:function(){ return api.tmTestSendForms([c.ref],o.formType).then(function(){ return ''; }); }},
    {label:'Fill in and submit their application',run:function(){ return api.tmTestFillForm(c.ref,o.effective,o.base).then(function(){ return ''; }); }},
    {label:'Approve them',run:function(){ return api.tmTestApprove(c.group).then(function(){ return ''; }); }},
    {label:'Send the change of tenants (TEST)',run:function(){ return api.tmTestStartChange(o.tenancyId,c.ref,o.effective).then(function(r){ return 'joining on '+o.effective; }); }},
    {label:'Sign as the new tenant, the existing tenants, then the landlord',run:function(ctx){ return testSignAll('change',o.tenancyId,ctx).then(function(){ return 'tenancy updated'; }); }}
  ],function(){ go('tenancy',o.tenancyId); });
}
/* Signs one person at a time until everyone has (each shown as it happens) */
function testSignAll(kind,key,ctx){
  var n=0;
  function next(){ return api.tmTestSignNext(kind,key).then(function(r){
    ctx.sub('\u270d '+r.signed+' ('+r.role+') signed'+(r.remaining&&r.remaining.length?' \u00b7 still to sign: '+r.remaining.join(', '):''));
    if(r.status==='Completed') return r;
    if(++n>=10) throw new Error('Stopped after 10 signatures without finishing.');
    return next(); }); }
  return next();
}
/* The run: one line per step with a tick or cross and how long it took; stops at the first failure */
function testRunner(title,steps,openAfter){
  var m=modal('<div class="title" style="font-size:1.1rem">'+esc(title)+'</div><div class="small muted" style="margin-block:4px 10px">Keep this open until it finishes. Each step uses the real app.</div>'+
    '<ol class="tslog" id="tsLog" style="padding-inline-start:18px;margin:0"></ol><div id="tsEnd" style="margin-block-start:10px"></div>'+
    '<div class="row" style="justify-content:flex-end;gap:8px;margin-block-start:10px"><button class="btn" type="button" data-tr="open" disabled>Open what it made</button><button class="btn primary" type="button" data-tr="close" disabled>Close</button></div>');
  var log=$('#tsLog',m), ok=true, t0=Date.now();
  var p=Promise.resolve();
  steps.forEach(function(s){ p=p.then(function(){
    var li=document.createElement('li'); li.style.marginBlockEnd='8px'; li.innerHTML='<span class="spin" style="width:14px;height:14px;vertical-align:middle"></span> '+esc(s.label); log.appendChild(li);
    var t=Date.now(), ctx={ sub:function(x){ var d=document.createElement('div'); d.className='small muted'; d.textContent=x; li.appendChild(d); } };
    return Promise.resolve(s.run(ctx)).then(function(note){
      var subs=[].slice.call(li.querySelectorAll('div'));
      li.innerHTML='\u2705 '+esc(s.label)+' <span class="small muted">'+((Date.now()-t)/1000).toFixed(1)+' s'+(note?' \u00b7 '+esc(note):'')+'</span>'; subs.forEach(function(d){ li.appendChild(d); });
    },function(e){ ok=false; li.innerHTML='\u274c '+esc(s.label)+'<div class="err">'+esc(e&&e.message||String(e))+'</div>'; throw e; });
  }); });
  p.catch(function(){}).then(function(){
    $('#tsEnd',m).innerHTML=ok?'<b style="color:var(--ok)">\u2713 Passed</b> in '+Math.round((Date.now()-t0)/1000)+' s':'<b style="color:var(--bad)">\u2717 Stopped at the step marked \u274c</b> (anything made before it is still in the Register)';
    return api.tmTestFinish().then(function(st){ apply(st); }).catch(function(){});
  }).then(function(){ [].forEach.call(m.querySelectorAll('[data-tr]'),function(b){ b.disabled=false; }); });
  m.addEventListener('click',function(e){ var b=e.target.closest('[data-tr]'); if(!b||b.disabled) return; m.remove(); if(b.getAttribute('data-tr')==='open'&&openAfter) openAfter(); else render(); });
}
function myDetailsDialog(){
  var p=myProfile();
  var m=modal('<div class="title" style="font-size:1.1rem">My details</div><div class="small muted" style="margin-block:6px 12px">Used to sign off emails you send from the app (reference questions, decline emails), for example:<br><i>Thank you,<br>'+esc(p.name||'Your name')+'<br>'+esc(p.mobile||'021 123 4567')+'</i>'+(p.email?'<br>Signed in as '+esc(p.email)+'.':'')+'</div>'+
    '<label class="fld"><span>Your name</span><input type="text" id="mdName" value="'+esc(p.name||myName())+'" autocomplete="name"></label>'+
    '<div class="grid2"><label class="fld"><span>Mobile</span><input type="tel" id="mdMob" value="'+esc(p.mobile||'')+'" autocomplete="tel"></label>'+
    '<label class="fld"><span>Other phone (optional)</span><input type="tel" id="mdPhone" value="'+esc(p.phone||'')+'"></label></div>'+
    '<div id="mdErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-md="cancel">Cancel</button><button class="btn primary" type="button" data-md="save">Save</button></div>');
  m.addEventListener('click',function(e){ var b=e.target.closest('[data-md]'); if(!b) return; if(b.getAttribute('data-md')==='cancel'){ m.remove(); return; }
    busy(b,'Saving',api.tmSaveMyProfile({name:$('#mdName',m).value,mobile:$('#mdMob',m).value,phone:$('#mdPhone',m).value})).then(function(st){ apply(st); m.remove(); toast('Saved'); render(); })
      .catch(function(x){ $('#mdErr',m).textContent=x&&x.message||'Couldn\u2019t save'; });
  });
}
/* Each action's own parts (latest call): lock wait, calls to the signing service, saving, and "reload" = re-reading everything after */
var SPEED_STATE=['applications','viewings','references','properties','tenancies','setup','landlords','bond','settings','people'];
function speedParts(list){
  var seen={}, out=[];
  list.forEach(function(x){ if(!x.parts||x.fn==='tmBootstrap'||seen[x.fn]) return; seen[x.fn]=1;
    var reload=0, bits=[]; Object.keys(x.parts).forEach(function(k){ if(SPEED_STATE.indexOf(k)>=0) reload+=x.parts[k]; else bits.push(k+' '+x.parts[k]); });
    bits.push('reload '+reload); out.push(x.fn.replace(/^tm/,'').replace(/([a-z])([A-Z])/g,'$1 $2')+' (latest): '+bits.join(', ')); });
  return out.length? '\nParts (ms):\n'+out.join('\n') : '';
}
function speedDialog(){
  var list=S.speed||[], first=list.filter(function(x){ return x.fn==='tmBootstrap'&&x.parts; })[0]||list.filter(function(x){ return x.parts; })[0];
  var by={}; list.forEach(function(x){ var o=by[x.fn]=by[x.fn]||{n:0,ms:0,server:0,sn:0}; o.n++; o.ms+=x.ms; if(x.server!=null){ o.server+=x.server; o.sn++; } });
  var label=function(fn){ return fn.replace(/^tm/,'').replace(/([a-z])([A-Z])/g,'$1 $2'); };
  var rows=Object.keys(by).map(function(fn){ var o=by[fn], avg=Math.round(o.ms/o.n), sv=o.sn?Math.round(o.server/o.sn):null;
    return '<tr><td>'+esc(label(fn))+'</td><td style="text-align:right">'+o.n+'</td><td style="text-align:right">'+avg+'</td><td style="text-align:right">'+(sv==null?'\u2013':sv)+'</td><td style="text-align:right">'+(sv==null?'\u2013':Math.max(0,avg-sv))+'</td></tr>'; }).join('');
  var parts=first&&first.parts? Object.keys(first.parts).sort(function(a,b){ return first.parts[b]-first.parts[a]; }).map(function(k){ return '<tr><td>'+esc(k)+'</td><td style="text-align:right">'+first.parts[k]+'</td></tr>'; }).join('') : '';
  var text='Tenant Management '+APP_VERSION+' speed check '+new Date().toLocaleString('en-NZ')+'\n'+
    Object.keys(by).map(function(fn){ var o=by[fn], avg=Math.round(o.ms/o.n), sv=o.sn?Math.round(o.server/o.sn):null; return label(fn)+': '+o.n+'x, round trip '+avg+' ms'+(sv==null?'':', server '+sv+' ms, overhead '+Math.max(0,avg-sv)+' ms'); }).join('\n')+
    (first&&first.parts?'\nLoad breakdown (ms): '+Object.keys(first.parts).map(function(k){ return k+' '+first.parts[k]; }).join(', '):'')+
    speedParts(list);
  var m=modal('<div class="title" style="font-size:1.1rem">Speed check</div>'+
    '<div class="small muted" style="margin-block:6px 10px">Times in milliseconds for what you\u2019ve done since opening the app. <b>Round trip</b> is the whole wait; <b>server</b> is the app\u2019s own work; <b>overhead</b> is Google starting the script and the network.</div>'+
    (rows?'<table class="kv small" style="width:100%"><tr><th>Action</th><th style="text-align:right">Times</th><th style="text-align:right">Round trip</th><th style="text-align:right">Server</th><th style="text-align:right">Overhead</th></tr>'+rows+'</table>':'<div class="small muted">Nothing timed yet. Use the app for a bit (open a few screens, save something), then come back.</div>')+
    (parts?'<div class="sasec" style="margin-block:14px 6px">Loading the data (server, ms)</div><table class="kv small" style="width:100%">'+parts+'</table>':'')+
    '<div class="row" style="justify-content:flex-end;gap:8px;margin-block-start:12px"><button class="btn" type="button" data-sp="close">Close</button><button class="btn primary" type="button" data-sp="copy">Copy results</button></div>');
  m.addEventListener('click',function(e){ var b=e.target.closest('[data-sp]'); if(!b){ if(e.target===m) m.remove(); return; }
    if(b.getAttribute('data-sp')==='close'){ m.remove(); return; }
    (navigator.clipboard&&navigator.clipboard.writeText? navigator.clipboard.writeText(text) : Promise.reject()).then(function(){ toast('Copied \u2014 paste it into the chat'); },function(){ info('Speed check',text); });
  });
}
function adminPinDialog(){
  var has=!!(S.st&&S.st.adminPinSet);
  var m=modal('<div class="title" style="font-size:1.1rem">'+(has?'Change':'Create')+' the admin PIN</div><div class="small muted" style="margin-block:6px 12px">Needed to delete a group that has submitted forms, a signed agreement or a tenancy. 4 to 8 digits.</div>'+
    (has?'<label class="fld"><span>Current PIN</span><input type="password" inputmode="numeric" id="apCur" autocomplete="off"></label>':'')+
    '<div class="grid2"><label class="fld"><span>New PIN</span><input type="password" inputmode="numeric" id="apNew" autocomplete="new-password"></label><label class="fld"><span>Repeat it</span><input type="password" inputmode="numeric" id="apNew2" autocomplete="new-password"></label></div>'+
    '<div id="apErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-ap="cancel">Cancel</button><button class="btn primary" type="button" data-ap="save">Save PIN</button></div>');
  m.addEventListener('click',function(e){ var b=e.target.closest('[data-ap]'); if(!b) return; if(b.getAttribute('data-ap')==='cancel'){ m.remove(); return; }
    var n1=$('#apNew',m).value.trim(), n2=$('#apNew2',m).value.trim(), err=$('#apErr',m);
    if(!/^\d{4,8}$/.test(n1)){ err.textContent='The PIN must be 4 to 8 digits.'; return; }
    if(n1!==n2){ err.textContent='The two PINs don\u2019t match.'; return; }
    busy(b,'Saving',api.tmSetAdminPin(has?$('#apCur',m).value.trim():'',n1)).then(function(st){ apply(st); m.remove(); toast('Admin PIN saved'); render(); }).catch(function(x){ err.textContent=x&&x.message||'Couldn\u2019t save'; });
  });
}
/* Agreement states: '' (none), Sent, Signed, Cancelled, Declined, Expired */
function agreementLive(l){ var ag=l.agreement||{}; return !!ag.requestId && (ag.status==='Sent'||ag.status==='Signed'); }
function agreementPill(l){
  var ag=l.agreement||{}; if(!ag.requestId) return '';
  if(ag.status==='Signed') return '<span class="pill st-done">\u270D Agreement signed</span>';
  if(ag.status==='Sent') return '<span class="pill st-warn">\u270D Agreement '+esc(ag.signed||'sent')+' signed</span>';
  return '<span class="pill st-bad">\u270D Agreement '+esc(String(ag.status).toLowerCase())+'</span>';
}
function agreementCard(key,l){
  var pp=propOf(l), ag=l.agreement||{}, h='<div class="card">';
  if(ag.requestId){
    var st=ag.status==='Signed'?'<span class="pill st-done">Signed by everyone</span>':ag.status==='Sent'?'<span class="pill st-warn">'+esc(ag.signed||'0')+' signed</span>':'<span class="pill st-bad">'+esc(ag.status)+'</span>';
    h+='<div class="row" style="align-items:flex-start"><div class="grow"><div style="font-weight:750">Agreement '+(ag.status==='Signed'?'signed':ag.status==='Sent'?'sent':esc(String(ag.status).toLowerCase()))+' '+st+'</div>'+
      '<div class="small muted">'+[ag.sentAt?'Sent '+fmtDate(ag.sentAt):'',ag.landlord?'landlord '+esc(ag.landlord):'',ag.status==='Signed'&&ag.signedAt?'signed '+fmtDate(ag.signedAt):''].filter(Boolean).join(' \u00B7 ')+'</div>'+
      (ag.details?'<div class="small muted">'+esc([dateParts(ag.details.start)+(ag.details.end?' to '+dateParts(ag.details.end):' (periodic)'),
        '$'+money2(ag.details.rent)+' pw','bond $'+money2(ag.details.bond),'max '+ag.details.maxOccupants+' occupants'].join(' \u00B7 '))+'</div>':'')+'</div></div>'+
      agreementSignersHtml(ag,ag.status==='Sent'&&isEsign(ag)?{act:'agreement-resend',id:key}:null)+
      '<div class="row wrap" style="gap:8px;margin-block-start:10px">'+
      (ag.pdf?'<a class="btn sm primary" target="_blank" rel="noopener" href="'+esc(ag.pdf)+'">\uD83D\uDCC4 Signed agreement</a>':'')+
      (ag.status!=='Signed'||!ag.pdf?'<button class="btn sm" type="button" data-act="refresh-agreement" data-id="'+esc(key)+'">\u21BB Check status</button>':'')+
      (ag.status==='Sent'&&isEsign(ag)?'<button class="btn sm" type="button" data-act="progress-preview" data-id="'+esc(key)+'">\uD83D\uDC41 Preview progress</button>':'')+

      (ag.status==='Sent'?'<button class="btn sm danger" type="button" data-act="cancel-agreement" data-id="'+esc(key)+'">Cancel agreement</button>':'')+
      (!agreementLive(l)&&l.decision==='Approved'?'<button class="btn sm primary" type="button" data-act="send-agreement" data-id="'+esc(key)+'">\u270D Send a new agreement</button>':'')+
      (!agreementLive(l)&&l.decision==='Approved'&&tenanciesAtProperty(l).length?'<button class="btn sm" type="button" data-act="add-to-tenancy" data-id="'+esc(key)+'">\u2795 Add to existing agreement</button>':'')+
      (ag.status==='Signed'?tenancyButton(key,ag):'')+
      '</div>';
    if(ag.status==='Signed'&&!ag.pdf) h+='<div class="small muted" style="margin-block-start:8px">The signed copy is saved to Drive when you check status (needs a Drive folder on the Setup tab).</div>';
  } else if(l.decision==='Approved'){
    h+='<button class="btn primary block" type="button" data-act="send-agreement" data-id="'+esc(key)+'">\u270D Send tenancy agreement</button>';
    // joining people already renting there: a change of tenants on their tenancy instead of a new agreement
    if(tenanciesAtProperty(l).length) h+='<button class="btn block" type="button" data-act="add-to-tenancy" data-id="'+esc(key)+'" style="margin-block-start:8px">\u2795 Add to existing agreement</button>';
  } else {
    h+='<div class="small muted">You can send the tenancy agreement once the '+(groupMembers(key).length>1?'group is':'applicant is')+' marked Approved.</div>';
  }
  h+='<div class="row" style="align-items:flex-start;margin-block-start:12px;padding-block-start:10px;border-block-start:1px solid var(--line)"><div class="grow small">'+
    (pp? (esignOn()? '<span class="muted">Signing:</span> Built-in'+(esignMissing(pp).length?' <span style="color:var(--bad);font-weight:700">(add '+esc(nameList(esignMissing(pp)))+')</span>':'')
           : '<span class="muted">Template:</span> '+(pp.templateId?esc(pp.templateTitle||pp.templateId):'<span style="color:var(--bad);font-weight:700">none set up yet</span>'))+
         '<br><span class="muted">Default landlord:</span> '+(pp.landlord?esc(pp.landlord):'<span class="muted">not chosen</span>')
       : '<span class="muted">This property isn\u2019t on the shared property list, so it has no agreement settings.</span>')+
    '</div>'+(pp?'<button class="btn sm" type="button" data-act="agreement-settings" data-id="'+esc(pp.propertyId)+'">\u2699\uFE0F Settings</button>':'')+'</div></div>';
  return h;
}
/* A signed agreement's tenancy: open it, or create it (agreements signed before tenancies existed) */
function tenancyButton(key,ag){
  var t=tenancies().find(function(x){ return ag.requestId&&x.requestId===ag.requestId; });
  return t? '<button class="btn sm" type="button" data-act="tenancy" data-id="'+esc(t.id)+'">\uD83C\uDFE0 Open tenancy</button>'
          : '<button class="btn sm primary" type="button" data-act="tenancy-create" data-id="'+esc(key)+'">\uD83C\uDFE0 Create tenancy</button>';
}
/* Each signer in order with when they were sent the agreement, opened it and signed it (updated by Check status) */
/* resend: {act, id} adds Email again / Text / Copy to each person who has a link but hasn't signed (several can be signing at once) */
/* Cancel a built-in agreement (TM 3.17.4): choose whether the tenants who were sent a link are emailed, and add your own message */
function cancelAgreementDialog(key){
  var ag=(groupLead(key)||{}).agreement||{};
  // 3.17.5: tenants who have already signed are told too (their signature won't be used)
  var told=(ag.signers||[]).filter(function(s){ return (s.sentAt||s.signedAt)&&!/landlord/i.test(s.role||''); });
  var names=told.map(function(s){ return esc(s.name||s.email||'Tenant')+(s.signedAt?' <span class="muted">(signed)</span>':''); }), list=names.length<2?names.join(''):names.slice(0,-1).join(', ')+' and '+names[names.length-1];
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:8px">Cancel the agreement?</div>'+
    '<div class="small muted" style="margin-block-end:12px">The signing links for <b>'+esc(groupName(key))+'</b> stop working, and you can then send a new agreement.</div>'+
    (told.length?'<label class="row" style="gap:10px;align-items:flex-start;margin-block-end:10px;cursor:pointer"><input type="checkbox" id="caNotify" checked style="width:20px;height:20px;margin:2px 0 0;flex:none">'+
      '<span>Email '+list+' to say it\u2019s been cancelled</span></label>'+
      '<label class="fld" id="caMsgWrap"><span>Your message (optional)</span><textarea id="caMsg" rows="4" maxlength="2000" placeholder="e.g. We\u2019ve corrected the address and will send you a new agreement shortly."></textarea></label>'+
      '<div class="small muted" id="caNote" style="margin:-6px 0 12px">Added to the cancellation email, under the standard wording.</div>'
      :'<div class="small muted" style="margin-block-end:12px">No tenant has been sent a link yet, so nobody needs to be told.</div>')+
    '<div id="caErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-ca="keep">Keep it</button><button class="btn danger" type="button" data-ca="go">Cancel agreement</button></div>');
  var nt=$('#caNotify',m);
  if(nt) nt.onchange=function(){ $('#caMsgWrap',m).style.display=$('#caNote',m).style.display=nt.checked?'':'none'; };
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-ca]'); if(!b) return;
    if(b.getAttribute('data-ca')==='keep') return m.remove();
    var opts={notify:!!(nt&&nt.checked),message:nt&&nt.checked?$('#caMsg',m).value.trim():''};
    busy(b,'Cancelling',api.tmCancelAgreement(key,opts)).then(function(st){ m.remove(); apply(st); toast(opts.notify?'Agreement cancelled \u2014 tenants emailed':'Agreement cancelled'); render(); })
      .catch(function(x){ $('#caErr',m).textContent=x&&x.message||'Couldn\u2019t cancel the agreement'; });
  });
}
function agreementSignersHtml(ag,resend){
  var list=ag.signers||[]; if(!list.length) return '';
  var stopped=ag.status==='Cancelled'||ag.status==='Declined'||ag.status==='Expired';
  return '<div class="agsig">'+list.map(function(s,i){
    var step=s.signedAt?'signed':stopped?'stopped':s.viewedAt?'opened':s.sentAt?'sent':'waiting';
    var badge={signed:'<span class="pill st-done">\u2705 Signed</span>',opened:'<span class="pill st-warn">\uD83D\uDC41 Opened</span>',
      sent:'<span class="pill st-warn">\u2709 Sent</span>',waiting:'<span class="pill">\u23F3 Waiting</span>',stopped:'<span class="pill st-bad">'+esc(ag.status)+'</span>'}[step];
    return '<div class="agrow"><b class="agn">'+(i+1)+'</b><div class="grow"><div class="agname">'+whoHtml(s)+' <span class="small muted">'+esc(s.role||'')+'</span></div>'+
      '<div class="agsteps">'+agStep('Sent',s.sentAt)+agStep('Opened',s.viewedAt)+agStep('Signed',s.signedAt)+'</div>'+
      (step==='waiting'?'<div class="small muted">'+(/landlord/i.test(s.role||'')?'Sent once all the tenants have signed':'Not sent yet')+'</div>':'')+
      (resend&&(step==='sent'||step==='opened')&&s.email?'<div class="row wrap" style="gap:6px;margin-block-start:6px">'+[['email','\u2709 Email again'],['sms','\uD83D\uDCAC Text'],['copy','\uD83D\uDD17 Copy link']].map(function(c){
        return '<button class="btn sm" type="button" data-act="'+resend.act+'" data-v="'+c[0]+'" data-id="'+esc(resend.id)+'" data-who="'+esc(s.email)+'" data-name="'+esc(s.name||'')+'">'+c[1]+'</button>'; }).join('')+'</div>':'')+'</div>'+badge+'</div>';
  }).join('')+'<div class="small muted" style="margin-block-start:4px">Updated when you tap Check status.</div></div>';
}
function agStep(label,iso){ return '<span class="agstep'+(iso?' on':'')+'">'+(iso?'\u2713 '+label+' '+esc(shortWhen(iso)):label+' \u2013')+'</span>'; }
function shortWhen(iso){ var d=new Date(iso); return isNaN(d)?'':d.toLocaleDateString('en-NZ',{day:'numeric',month:'short'})+', '+fmtTime(iso); }
/* Group members in signing order: first person, then the rest in the order they joined (same as the server) */
function signingOrder(key){
  return groupMembers(key).slice().sort(function(a,b){ return (a.ref===key?-1:b.ref===key?1:0)||String(a.attendedAt||'').localeCompare(String(b.attendedAt||''))||a.ref.localeCompare(b.ref); });
}
/* What stops the agreement going out, checked before the pop-up (the server checks again) */
/* New agreements use the service chosen on the Setup tab; existing ones keep the service they were sent with */
function esignOn(){ return true; }   // DocHub is retired: agreements always use built-in signing
function isEsign(ag){ return !!ag && ag.provider==='esign'; }
/* Property statements built-in agreements need that are still blank */
function agreementProblem(key,landlordName){
  var ms=signingOrder(key), l=ms[0], pp=propOf(l), es=esignOn();
  if(!pp) return (l.address1||'This property')+' isn\u2019t on the shared property list, so it has no tenancy agreement set up.';
  if(es){ var mi=esignMissing(pp); if(mi.length) return 'Add '+nameList(mi)+' in Setup \u2192 Properties \u2192 '+(pp.name||l.address1)+'.'; }
  else if(!pp.templateId) return 'No tenancy agreement is set up for '+(pp.name||l.address1)+'. Open Settings below to choose its DocHub template.';
  if(ms.length>5) return 'The agreement has room for 5 tenants, but this group has '+ms.length+'.';
  var noEm=ms.filter(function(a){ return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a.email||''); });
  if(noEm.length) return 'The agreement is sent by email. Add an email address for '+noEm.map(function(a){ return a.name; }).join(', ')+'.';
  var ll=((S.st&&S.st.landlords)||[]).find(function(x){ return x.name===landlordName; });
  if(!ll) return 'Choose the landlord who signs last.';
  var seen={}, dup=[];
  var all=ms.map(function(a){ return {who:a.name,e:String(a.email).toLowerCase()}; }).concat([{who:ll.name+' (landlord)',e:String(ll.email).toLowerCase()}]);
  if(es&&ll.signer2Name&&ll.signer2Email) all.push({who:ll.signer2Name+' (second landlord signer)',e:String(ll.signer2Email).toLowerCase()});
  all.forEach(function(x){ if(seen[x.e]) dup.push(seen[x.e]+' and '+x.who); else seen[x.e]=x.who; });
  if(dup.length) return 'Every signer needs their own email address \u2014 '+dup.join('; ')+' share one.';
  return '';
}
function sendAgreementDialog(key){
  var ms=signingOrder(key), l=ms[0], pp=propOf(l), lls=(S.st&&S.st.landlords)||[];
  var first=agreementProblem(key,(pp&&pp.landlord)||'');
  if(first && !/landlord|share one/i.test(first)){ return info('Can\u2019t send the agreement yet',first); }
  var roles=['Tenant1','Tenant2','Tenant3','Tenant4','Tenant5'];
  // defaults: rent at the viewing they applied for (else the property's), the property's bond and occupants,
  // start = their preferred move-in date, end = start + tenancy length - 1 day (blank for periodic)
  var rent0=(l.rent!==''&&l.rent!=null)?l.rent:(pp.rent!=null?pp.rent:''), start0=l.moveIn?dateInput(l.moveIn):'';
  var m=modal('<div class="title" style="font-size:1.1rem">Send tenancy agreement</div>'+
    '<div class="small muted" style="margin-block-end:12px">'+esc(pp.name||l.address1)+' \u00B7 '+(esignOn()?'Built-in signing':esc(pp.templateTitle||''))+'</div>'+
    '<div class="sa-cols"><div class="sa-main"><div class="sasec">Agreement details</div>'+
    '<label class="fld"><span>Landlord (signs last)</span><select id="saLL"><option value="">Choose\u2026</option>'+lls.map(function(x){ return '<option value="'+esc(x.name)+'"'+(x.name===pp.landlord?' selected':'')+'>'+esc(x.name)+'</option>'; }).join('')+'</select></label>'+
    '<div class="small muted" id="saLLEmail" style="margin:-6px 0 10px"></div>'+
    '<label class="fld"><span>Landlord\u2019s address for service</span><textarea id="saAddr" rows="2" placeholder="Physical address in New Zealand"></textarea></label>'+
    ((pp.rooms||[]).length?'<label class="fld"><span>Room</span><select id="saRoom"><option value="?">Choose\u2026</option><option value="">Whole property</option>'+
      pp.rooms.map(function(r){ return '<option value="'+esc(r.name)+'">'+esc(r.name)+'</option>'; }).join('')+'</select></label><div class="small" id="saRoomWarn" style="color:var(--miss);font-weight:700;margin:-6px 0 10px"></div>':'')+
    '<div class="grid2"><label class="fld"><span>Rent per week ($)</span><input type="number" inputmode="decimal" id="saRent" value="'+esc(rent0)+'"></label>'+
    '<label class="fld"><span>Bond ($)</span><input type="number" inputmode="decimal" id="saBond" value="'+esc(pp.bond!=null?pp.bond:'')+'"></label></div>'+
    '<div class="small muted" id="saBondHint" style="margin:-6px 0 10px"></div>'+
    '<label class="fld"><span>Maximum occupants</span><input type="number" inputmode="numeric" min="1" id="saOcc" value="'+esc(pp.maxOccupants!=null?pp.maxOccupants:'')+'"></label>'+
    '<div class="grid2"><label class="fld"><span>Tenancy start</span><input type="date" id="saStart" value="'+esc(start0)+'"></label>'+
    '<label class="fld"><span>Tenancy end</span><input type="date" id="saEnd" value="'+esc(endFrom(start0,l.tenancy))+'"></label></div>'+
    '<div class="small muted" id="saDates" style="margin:-6px 0 4px"></div>'+
    '<div class="small muted" style="margin-block-end:12px">Leave the end date blank for a periodic tenancy. Rent, bond and occupants are saved to the property (or the room), and the address to the landlord.'+
      (!esignOn()&&((pp.rooms||[]).length||pp.internetIncluded||(pp.power&&pp.power!=='tenant'))?' <b>DocHub templates don\u2019t include the room, internet or electricity settings</b>: add them to the template yourself.':'')+'</div>'+
    '</div><div class="sa-side"><div id="saExtra"><div class="small muted" style="margin-block-end:12px">Checking which other details the agreement template needs\u2026</div></div>'+
    '<div class="sasec">Signing order</div><div class="small muted" style="margin-block-end:6px">Each person signs after the one before</div><div class="saorder">'+
    roles.map(function(r,i){ var a=ms[i]; return a? '<div class="sarow"><b>'+(i+1)+'</b><span class="pill">'+r+'</span><span class="grow">'+whoHtml(a)+'<br><span class="small muted">'+esc(a.email)+'</span></span></div>'
      : esignOn()? '' : '<div class="sarow off"><b>\u2013</b><span class="pill">'+r+'</span><span class="grow">Disabled (not needed)</span></div>'; }).join('')+
    '<div class="sarow"><b>'+(ms.length+1)+'</b><span class="pill st-done">Landlord</span><span class="grow" id="saLLName">\u2013</span></div><div id="saLL2"></div></div></div></div>'+
    '<div class="small muted" style="margin-block:8px 10px">'+(esignOn()?'Each person is emailed their own signing link in turn. Their name, contact details and ID come from their application, and they confirm them (and their address for service) when they sign.':(pp.unitTitle?'This is a unit title property: attach the body corporate rules to the agreement in DocHub yourself. ':'')+'DocHub emails each person in turn. The details above are filled in on the agreement. Each tenant\u2019s name, email, phone, ID and under-18 answer are pre-filled from their application, and they can change them when they sign.')+'</div>'+
    '<div class="sa-foot"><div id="saWarn" class="small" style="color:var(--miss);font-weight:700;margin-block-end:6px"></div>'+
    '<div id="saErr" class="err"></div>'+
    '<div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-sa="cancel">Cancel</button>'+(esignOn()?'<button class="btn" type="button" data-sa="preview">\uD83D\uDC41 Preview</button>':'')+'<button class="btn primary" type="button" data-sa="send">Send for signing</button></div></div>');
  m.querySelector('.box').classList.add('wide');
  var lastLL=null, keys=null, guessed=false, es=esignOn();    // keys = optional data fields the template has (null until DocHub answers)
  function val(id){ var x=$(id,m); return x? x.value.trim() : ''; }
  function details(){ return {room:$('#saRoom',m)?$('#saRoom',m).value:'',rent:$('#saRent',m).value,bond:$('#saBond',m).value,maxOccupants:$('#saOcc',m).value,start:$('#saStart',m).value,end:$('#saEnd',m).value,landlordAddress:$('#saAddr',m).value.trim(),
    landlordPhone:val('#saPhone'),landlordMobile:val('#saMob'),insulationDate:val('#saIns'),insurer:val('#saInsurer'),insurancePolicy:val('#saPolicy'),excess:val('#saExcess')}; }
  function upd(){
    var v=$('#saLL',m).value, ll=lls.find(function(x){ return x.name===v; });
    if(ll!==lastLL){ lastLL=ll; $('#saAddr',m).value=ll?ll.address||'':'';      // a different landlord brings their own address and phones
      if($('#saPhone',m)) $('#saPhone',m).value=ll?ll.phone||'':''; if($('#saMob',m)) $('#saMob',m).value=ll?ll.mobile||'':''; }
    $('#saLLName',m).innerHTML=ll? esc(ll.signer||ll.name)+'<br><span class="small muted">'+esc(ll.email)+'</span>' : '<span class="muted">Choose above</span>';
    $('#saLL2',m).innerHTML=es&&ll&&ll.signer2Name&&ll.signer2Email? '<div class="sarow"><b>'+(ms.length+2)+'</b><span class="pill st-done">Landlord 2</span><span class="grow">'+esc(ll.signer2Name)+'<br><span class="small muted">'+esc(ll.signer2Email)+'</span></span></div>' : '';
    $('#saLLEmail',m).textContent=ll? 'Email: '+ll.email : '';
    var d=details(), r=+d.rent;
    $('#saBondHint',m).textContent=r>0? 'Up to 4 weeks\u2019 rent: $'+money2(r*4) : '';
    $('#saDates',m).innerHTML=(d.start?'Start: <b>'+esc(dateParts(d.start))+'</b>':'')+(d.end?' \u00b7 End: <b>'+esc(dateParts(d.end))+'</b>':d.start?' \u00b7 periodic (no end date)':'');
    $('#saWarn',m).textContent=(+d.maxOccupants>0 && ms.length>+d.maxOccupants)? '\u26a0 This group has '+ms.length+' people but the maximum is '+d.maxOccupants+'.' : '';
    if($('#saRoomWarn',m)){ var taken=d.room==='?'?[]:roomTaken(pp.propertyId,d.room,d.start,d.end);
      $('#saRoomWarn',m).textContent=taken.length?'\u26a0 '+(d.room||'The whole property')+' already has a tenancy for those dates: '+taken.map(function(t){ return (t.room?t.room+' \u2013 ':'')+tenancyNames(t)+' ('+tenancyDates(t).replace(/^From /,'from ')+')'; }).join('; ')+'.':''; }
    $('#saErr',m).textContent=keys? agreementProblem(key,v)||detailsProblem(d,guessed?[]:keys) : '';
  }
  var saRentWas=$('#saRent',m).value;
  if($('#saBond',m).value===''&&+saRentWas>0) $('#saBond',m).value=bond4(saRentWas);
  $('#saRent',m).addEventListener('input',function(){ var b=$('#saBond',m); if(bondFollows(b.value,saRentWas)) b.value=bond4(this.value); saRentWas=this.value; });
  m.addEventListener('input',upd); m.addEventListener('change',upd);
  var roomSel=$('#saRoom',m);
  if(roomSel) roomSel.addEventListener('change',function(){
    var r=(pp.rooms||[]).find(function(x){ return x.name===roomSel.value; })||(roomSel.value===''?{rent:pp.rent,bond:pp.bond,maxOccupants:pp.maxOccupants}:null);
    if(r) [['#saRent',r.rent],['#saBond',r.bond!==''&&r.bond!=null?r.bond:bond4(r.rent)],['#saOcc',r.maxOccupants]].forEach(function(x){ if(x[1]!==''&&x[1]!=null) $(x[0],m).value=x[1]; });
    saRentWas=$('#saRent',m).value;
    upd();
  });
  upd();
  // built-in signing: no template to ask about; show the property statements that go into the agreement
  if(es){ keys=[]; var row=function(label,v,dflt,req){ return '<div style="margin-block-end:8px"><span class="muted">'+esc(label)+':</span><div style="white-space:pre-line">'+(v?esc(v):(req?'<b style="color:var(--bad)">missing</b>':'<span class="muted">'+esc(dflt)+'</span>'))+'</div></div>'; };
    $('#saExtra',m).innerHTML='<div class="sasec">From the property</div><div class="card small" style="margin-block-end:12px">'+
      row('How rent is paid',String(pp.rentPaymentDetails||'').trim(),'',true)+row('Chattels',(pp.chattels||[]).join('\n'),'None')+
      row('Insulation statement',insProblems(pp.insulation).length?'':insText(pp.insulation),'',true)+row('Healthy homes statement',hhProblems(pp.healthyHomes).length?'':hhText(pp.healthyHomes,(lls.find(function(x){ return x.name===$('#saLL',m).value; })||{}).name||pp.landlord),'',true)+
      row('Unit title',pp.unitTitle?(pp.bodyCorporateRules?'Yes \u2014 body corporate rules attached: '+(pp.bodyCorporateRulesName||'chosen file'):''):'',pp.unitTitle?'':'No',!!pp.unitTitle)+
      row('Internet',pp.internetIncluded?'Included in the rent':'','Tenant arranges and pays')+
      row('Electricity',pp.power==='included'?'Included in the rent':pp.power==='capped'?'Included up to $'+money2(pp.powerCap)+' a month; anything over is paid within '+(pp.powerDays||14)+' days'+((pp.rooms||[]).length?', split equally between '+pp.rooms.length+' rooms':''):'','Tenant pays')+
      row('Bottled gas',pp.bottledGas?'Yes \u2014 the tenant pays for the gas they use; the landlord pays the bottle hire':'','No')+
      row('Pets',String(pp.pets||'').trim(),'Standard wording')+row('Additional terms',(pp.additionalTerms||[]).map(function(x,i){ return (i+1)+'. '+x; }).join('\n'),'None')+
      '<button class="btn sm" type="button" data-sa="setup">\u270E Edit in Setup</button></div>'; upd(); }
  else api.tmAgreementFields(pp.propertyId).then(function(r){
    if(!document.body.contains(m)) return;
    if((r.missingKeys||[]).length){ $('#saExtra',m).innerHTML=''; keys=[]; $('#saErr',m).textContent='The agreement template is missing '+r.missingKeys.join(', ')+'. Fix it in DocHub first.'; return; }
    keys=r.optionalKeys||[]; drawExtra();
  }).catch(function(){ if(!document.body.contains(m)) return; keys=AGREEMENT_EXTRA_KEYS.slice(); guessed=true; drawExtra(true); });
  function drawExtra(guess){
    var ll=lls.find(function(x){ return x.name===$('#saLL',m).value; })||{}, has={}; keys.forEach(function(k){ has[k]=1; });
    var h='';
    if(has.LandlordPhone||has.LandlordMobile) h+='<div class="grid2">'+
      (has.LandlordPhone?'<label class="fld"><span>Landlord\u2019s phone</span><input type="tel" id="saPhone" value="'+esc(ll.phone||'')+'"></label>':'')+
      (has.LandlordMobile?'<label class="fld"><span>Landlord\u2019s mobile</span><input type="tel" id="saMob" value="'+esc(ll.mobile||'')+'"></label>':'')+'</div>';
    if(has.TenancyAddress) h+='<div class="small" style="margin-block-end:10px"><span class="muted">Tenancy address:</span> <b>'+esc([pp.address1,pp.address2].filter(Boolean).join(', '))+'</b></div>';
    if(has.InsulationInspectionDate) h+='<label class="fld"><span>Insulation inspection date</span><input type="date" id="saIns" value="'+esc(pp.insulationDate||'')+'"></label>';
    if(has.Insurer||has.InsurancePolicy) h+='<div class="grid2">'+
      (has.Insurer?'<label class="fld"><span>Insurer</span><input type="text" id="saInsurer" placeholder="e.g. AMI, or Not insured" value="'+esc(pp.insurer||'')+'"></label>':'')+
      (has.InsurancePolicy?'<label class="fld"><span>Insurance policy</span><input type="text" id="saPolicy" value="'+esc(pp.insurancePolicy||'')+'"></label>':'')+'</div>';
    if(has.ExcessAmount) h+='<label class="fld"><span>Insurance excess ($)</span><input type="number" inputmode="decimal" min="0" id="saExcess" value="'+esc(pp.excess!=null?pp.excess:'')+'"></label>';
    $('#saExtra',m).innerHTML=h? '<div class="sasec">Also on this agreement</div>'+h+'<div class="small muted" style="margin-block-end:12px">'+
      (guess?'Couldn\u2019t check the template, so all of these are shown; only the ones it has are filled in. ':'Only the fields this template has are shown. ')+
      'Insurance and insulation details are saved to the property, and phone numbers to the landlord.</div>' : '';
    upd();
  }
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-sa]'); if(!b) return;
    if(b.getAttribute('data-sa')==='cancel') return m.remove();
    if(b.getAttribute('data-sa')==='setup'){ m.remove(); S.pe=null; S.peTabNext='terms'; return go('propEdit',pp.propertyId); }
    if(b.getAttribute('data-sa')==='preview'){ var pv=$('#saLL',m).value, pd=details(), pe=(pd.room==='?'?'Choose the room (or Whole property).':'')||agreementProblem(key,pv)||detailsProblem(pd,[]); if(pe){ $('#saErr',m).textContent=pe; return; }
      return busy(b,'Preparing',api.tmPreviewAgreement(key,{landlord:pv,details:pd})).then(function(r){ if(r.errors&&r.errors.length){ $('#saErr',m).textContent=r.errors.join(' '); return; } previewDialog('Agreement preview',r.html,r.warnings); }).catch(function(x){ $('#saErr',m).textContent=x&&x.message||'Couldn\u2019t make the preview'; }); }
    if(!keys){ $('#saErr',m).textContent='Still checking the agreement template \u2014 try again in a moment.'; return; }
    var v=$('#saLL',m).value, d=details(), err=(d.room==='?'?'Choose the room (or Whole property).':'')||agreementProblem(key,v)||detailsProblem(d,guessed?[]:keys); if(err){ $('#saErr',m).textContent=err; return; }
    busy(b,'Sending',api.tmSendAgreement(key,{landlord:v,details:d})).then(function(st){ apply(st); m.remove(); render();
      if(st.firstLink) return linkDialog('The email to '+ms[0].name.split(' ')[0]+' didn\u2019t send',st.firstLink,ms[0]);
      toast('Agreement sent \u2014 '+(es?'':'DocHub is ')+'emailing '+ms[0].name.split(' ')[0]+' first'); })
      .catch(function(x){ $('#saErr',m).textContent=x&&x.message||'Couldn\u2019t send the agreement'; });
  });
}
/* Built-in signing: an unsigned agreement or summary shown in a frame (srcdoc keeps it separate from the app) */
function previewDialog(title,html,warnings){
  var m=modal('<div class="row" style="align-items:center;margin-block-end:8px"><div class="title grow" style="font-size:1.05rem">'+esc(title)+'</div><button class="btn sm" type="button" data-pv="close" aria-label="Close">\u2715</button></div>'+
    ((warnings||[]).length?'<div class="small" style="color:var(--miss);margin-block-end:8px">'+warnings.map(esc).join('<br>')+'</div>':'')+
    '<iframe class="pvframe" title="'+esc(title)+'" sandbox="allow-same-origin"></iframe>');
  m.querySelector('.box').style.maxWidth='760px';
  m.querySelector('.pvframe').srcdoc=String(html||'');
  m.addEventListener('click',function(e){ if(e.target.closest('[data-pv]')||e.target===m) m.remove(); });
}
/* A signing link to pass on by hand (the email didn't go, or a resend): Copy, and Text when there's a mobile */
function linkDialog(title,link,person,smsBody){
  var mob=person&&String(person.mobile||'').replace(/[^\d+]/g,'');
  var body=smsBody||('Hi '+String((person&&person.name)||'').split(' ')[0]+', here is your link to sign the tenancy agreement: '+link);
  var m=modal('<div class="title" style="font-size:1.05rem;margin-block-end:6px">'+esc(title)+'</div>'+
    '<div class="small muted" style="margin-block-end:10px">Send this link to '+esc((person&&person.name)||'them')+' yourself. It\u2019s their personal signing link, so don\u2019t share it with anyone else.</div>'+
    '<div class="card small" style="word-break:break-all;margin-block-end:10px">'+esc(link)+'</div>'+
    '<div class="row wrap" style="gap:8px;justify-content:flex-end"><button class="btn" type="button" data-lk="close">Close</button>'+
    '<button class="btn" type="button" data-copy="'+esc(link)+'">\uD83D\uDD17 Copy link</button>'+
    (mob&&mob.replace(/\D/g,'').length>8?'<a class="btn primary" target="_blank" rel="noopener" href="'+esc('sms:'+mob+'?&body='+encodeURIComponent(body))+'">\uD83D\uDCAC Text it</a>':'')+'</div>');
  m.addEventListener('click',function(e){ if(e.target.closest('[data-lk]')||e.target===m) m.remove(); });
}
/* Resend the signing link to whoever's turn it is (built-in signing). A new link cancels the previous one, so ask first. */
function resendDialog(kind,id,channel,who,name){
  var them=name?esc(name):'them', words={email:'Email '+them+' a new signing link',sms:'Make a new link to text '+them,copy:'Make a new link to copy for '+them}[channel];
  ask(words+'?<div class="small muted" style="margin-block-start:8px">The link they were sent before will stop working.</div>','Make new link').then(function(ok){ if(!ok) return;
    var p=kind==='change'? api.tmResendChangeLink(id,channel,who||'') : api.tmResendAgreementLink(id,channel,who||'');
    p.then(function(r){
      if(channel==='email') return toast('New link emailed to '+(r.name||'them'));
      linkDialog('New signing link for '+(r.name||'them'),r.link,{name:r.name,mobile:r.mobile},channel==='sms'?r.smsBody:'');
    }).catch(function(x){ toast(x&&x.message||'Couldn\u2019t make a new link',6000); });
  });
}
/* Optional DocHub data fields, filled in only when the template has them (matches TM.AGREEMENT_OPTIONAL_KEYS) */
var AGREEMENT_EXTRA_KEYS=['LandlordPhone','LandlordMobile','TenancyAddress','InsulationInspectionDate','InsurancePolicy','Insurer','ExcessAmount'];
/* Agreement details checks (the server checks again); keys = the optional fields the template has */
function detailsProblem(d,keys){
  var p=basicDetailsProblem(d); if(p) return p;
  var has={}; (keys||[]).forEach(function(k){ has[k]=1; });
  if((has.LandlordPhone||has.LandlordMobile) && !(has.LandlordPhone&&d.landlordPhone) && !(has.LandlordMobile&&d.landlordMobile))
    return 'Enter the landlord\u2019s '+(has.LandlordPhone&&has.LandlordMobile?'phone or mobile':has.LandlordPhone?'phone number':'mobile')+'.';
  if(has.InsulationInspectionDate){ if(!d.insulationDate) return 'Enter the insulation inspection date.'; if(d.insulationDate>todayYmd()) return 'The insulation inspection date can\u2019t be in the future.'; }
  if(has.Insurer && !d.insurer) return 'Enter the insurer (or \u201CNot insured\u201D).';
  if(has.InsurancePolicy && !d.insurancePolicy) return 'Enter the insurance policy.';
  if(has.ExcessAmount && !(d.excess!==''&&+d.excess>=0)) return 'Enter the insurance excess (0 if there\u2019s none).';
  return '';
}
function todayYmd(){ var n=new Date(); return n.getFullYear()+'-'+('0'+(n.getMonth()+1)).slice(-2)+'-'+('0'+n.getDate()).slice(-2); }
function basicDetailsProblem(d){
  var r=+d.rent, b=d.bond===''?NaN:+d.bond, o=+d.maxOccupants;
  if(!(r>0)) return 'Enter the rent per week.';
  if(!(b>=0)) return 'Enter the bond amount (0 if there\u2019s no bond).';
  if(b>r*4+0.005) return 'The bond can\u2019t be more than 4 weeks\u2019 rent ($'+money2(r*4)+').';
  if(!(o>=1)||Math.floor(o)!==o) return 'Enter the maximum number of occupants.';
  if(!d.landlordAddress) return 'Enter the landlord\u2019s address for service.';
  if(!d.start) return 'Choose the tenancy start date.';
  if(d.end && d.end<=d.start) return 'The tenancy end date must be after the start date.';
  return '';
}
var MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
function ordinal(n){ var s=['th','st','nd','rd'], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
/* yyyy-mm-dd -> "1st January 2027" (how the day, month and year fields are filled in) */
function dateParts(ymd){ var p=String(ymd).split('-').map(Number); return p.length===3&&p[1]? ordinal(p[2])+' '+MONTHS[p[1]-1]+' '+p[0] : ''; }
/* End date from a start date and a tenancy length like "12 months": start + months - 1 day; '' for periodic or unknown */
function endFrom(start,tenancy){
  var mm=/(\d+)\s*month/i.exec(String(tenancy||'')), yy=/(\d+)\s*year/i.exec(String(tenancy||''));
  var n=mm? +mm[1] : yy? 12*+yy[1] : 0; if(!start||!n) return '';
  var p=start.split('-').map(Number), d=new Date(Date.UTC(p[0],p[1]-1+n,p[2]-1));
  return d.toISOString().slice(0,10);
}
function money2(n){ var r=Math.round(n*100)/100; return r%1? r.toFixed(2) : String(r); }
/* Simple message pop-up with an OK button */
function info(title,msg){
  var m=modal('<div class="title" style="font-size:1.05rem;margin-block-end:8px">'+esc(title)+'</div><div style="margin-block-end:14px">'+esc(msg)+'</div><div class="row" style="justify-content:flex-end"><button class="btn primary" data-r="1" type="button">OK</button></div>');
  m.addEventListener('click',function(e){ if(e.target.closest('[data-r]')||e.target===m) m.remove(); });
}
/* The shared-list property a group is applying for (by Property ID, else by street address) */
function propOf(a){
  var ps=(S.st&&S.st.properties)||[];
  return (a.propertyId&&ps.find(function(p){ return p.propertyId===a.propertyId; })) ||
    ps.find(function(p){ return String(p.address1||'').toLowerCase()===String(a.address1||'').toLowerCase(); }) || null;
}
/* A template has every signer role the app needs */
function rolesOk(roles){ var have={}; (roles||[]).forEach(function(r){ have[String(r).toLowerCase()]=1; });
  return ['tenant1','tenant2','tenant3','tenant4','tenant5','landlord'].every(function(r){ return have[r]; }); }
/* ================= Setup: properties and landlords ================= */
function setupProps(){ return (S.st&&S.st.setupProperties)||[]; }
function landlords(){ return (S.st&&S.st.landlords)||[]; }
function termsMaster(){ return (S.st&&S.st.termsMaster)||[]; }
/* terms as a tidy list (one line each, blanks dropped), and whether two lists are the same */
function cleanTerms(l){ return (l||[]).map(function(x){ return String(x||'').replace(/\s+/g,' ').trim(); }).filter(Boolean); }
function sameTerms(a,b){ return cleanTerms(a).join('\n')===cleanTerms(b).join('\n'); }
/* what copying the master list would do to one property: its terms after the copy */
function termsAfterCopy(mine,master,mode){ mine=cleanTerms(mine); master=cleanTerms(master); if(mode!=='add') return master;
  var have={}; mine.forEach(function(x){ have[x.toLowerCase()]=1; }); return mine.concat(master.filter(function(x){ return !have[x.toLowerCase()]; })); }
function setupPropById(id){ return setupProps().find(function(p){ return p.propertyId===id; }); }
/* Setup: a menu, with properties and landlords on their own screens */
function setupHome(){
  setTitle('Setup');
  var ps=setupProps(), act=ps.filter(function(p){ return p.active; }), arch=ps.length-act.length, lls=landlords();
  var noTpl=act.filter(function(p){ return esignOn()? esignMissing(p).length : !p.templateId; }).length, noAddr=lls.filter(function(l){ return !l.address; }).length;
  var h='<div class="card tap" data-act="setup-props"><div class="row"><div class="tile">\uD83C\uDFE0</div><div class="grow"><div class="title">Properties</div>'+
      '<div class="small muted">Rooms and inspection checks, letting details, insurance and the tenancy agreement for each property</div>'+
      '<div style="margin-block-start:6px"><span class="pill">'+act.length+' active</span>'+(arch?'<span class="pill">'+arch+' archived</span>':'')+(noTpl?'<span class="pill st-warn">'+noTpl+(esignOn()?' with agreement details to complete':' without an agreement')+'</span>':'')+'</div></div><span class="chev">\u203A</span></div></div>'+
    '<div class="card tap" data-act="setup-landlords"><div class="row"><div class="tile t2">\uD83D\uDC64</div><div class="grow"><div class="title">Landlords</div>'+
      '<div class="small muted">Who signs tenancy agreements, their contact details and address for service</div>'+
      '<div style="margin-block-start:6px"><span class="pill">'+lls.length+' landlord'+(lls.length===1?'':'s')+'</span>'+(noAddr?'<span class="pill st-warn">'+noAddr+' without an address for service</span>':'')+'</div></div><span class="chev">\u203A</span></div></div>';
  var tm=termsMaster(), tdiff=act.filter(function(p){ return !sameTerms(p.additionalTerms,tm); }).length;
  if(window.RentalsPush) h+='<div class="card tap" data-act="setup-notify"><div class="row"><div class="tile t1">\uD83D\uDD14</div><div class="grow"><div class="title">Notifications</div>'+
    '<div class="small muted">Get told on this phone when a form is submitted, an agreement is signed or an inspection is in</div></div><span class="chev">\u203A</span></div></div>';
  h+='<div class="card tap" data-act="setup-questions"><div class="row"><div class="tile t2">\uD83D\uDCDD</div><div class="grow"><div class="title">Screening questions</div>'+
    '<div class="small muted">The questions you ask each referee, by referee type, and the red flags to listen for</div></div><span class="chev">\u203A</span></div></div>';
  h+='<div class="card tap" data-act="setup-terms"><div class="row"><div class="tile t4">\uD83D\uDCDC</div><div class="grow"><div class="title">Additional terms</div>'+
      '<div class="small muted">The master list of extra terms for tenancy agreements, copied to each property</div>'+
      '<div style="margin-block-start:6px"><span class="pill">'+tm.length+' term'+(tm.length===1?'':'s')+'</span>'+(tdiff?'<span class="pill st-warn">'+tdiff+' propert'+(tdiff>1?'ies differ':'y differs')+'</span>':'')+'</div></div><span class="chev">\u203A</span></div></div>';
  var mp=myProfile();
  h+='<div class="card tap" data-act="test-suite"><div class="row"><div class="tile t2">\uD83E\uDDEA</div><div class="grow"><div class="title">Test suite</div>'+
    '<div class="small muted">Run the whole process end to end with made-up tenants, to check everything works</div></div><span class="chev">\u203A</span></div></div>';
  h+='<div class="card tap" data-act="my-details"><div class="row"><div class="tile t3">\uD83D\uDE4B</div><div class="grow"><div class="title">My details</div>'+
    '<div class="small muted">Your name and phone, used to sign off the emails you send from the app'+(mp.email?' ('+esc(mp.email)+')':'')+'</div>'+
    '<div style="margin-block-start:6px">'+(mp.name?'<span class="pill st-done">'+esc(mp.name)+(mp.mobile?' \u00B7 '+esc(mp.mobile):'')+'</span>':'<span class="pill st-warn">Not set</span>')+'</div></div><span class="chev">\u203A</span></div></div>';
  h+='<div class="card tap" data-act="speed-check"><div class="row"><div class="tile t2">\u23F1</div><div class="grow"><div class="title">Speed check</div>'+
    '<div class="small muted">How long loading and saving actually take on this device, to see where the time goes</div></div><span class="chev">\u203A</span></div></div>';
  var pinOn=!!(S.st&&S.st.adminPinSet);
  h+='<div class="card tap" data-act="admin-pin"><div class="row"><div class="tile t1">\uD83D\uDD12</div><div class="grow"><div class="title">Admin PIN</div>'+
    '<div class="small muted">Needed to delete a group with submitted forms, a signed agreement or a tenancy</div>'+
    '<div style="margin-block-start:6px"><span class="pill '+(pinOn?'st-done':'st-warn')+'">'+(pinOn?'Set':'Not set')+'</span></div></div><span class="chev">\u203A</span></div></div>';
  if(S.st&&S.st.propertiesError) h+='<div class="card err">Couldn\u2019t open the shared property list: '+esc(S.st.propertiesError)+'</div>';
  $('#app').innerHTML=h+versionLine();
  setFooter(tabBar());
}
VIEWS.setupProps = function(){
  setTitle('Properties');
  var ps=setupProps(), act=ps.filter(function(p){ return p.active; }), arch=ps.filter(function(p){ return !p.active; });
  var h='<div class="small muted" style="margin:4px 6px 10px">Each property has its own inspection template \u2014 the areas and checks inspectors will see \u2014 shared with Flat Inspections.</div>';
  if(S.st&&S.st.propertiesError) h+='<div class="card err">Couldn\u2019t open the shared property list: '+esc(S.st.propertiesError)+'</div>';
  if(!act.length) h+='<div class="card empty small">No properties yet. Tap \uFF0B New property.</div>';
  act.forEach(function(p){ h+=setupPropCard(p); });
  if(arch.length){ h+=sectStart('s-archived','Archived',countPill(arch.length,'property','properties')); arch.forEach(function(p){ h+=setupPropCard(p); }); h+=SECT_END; }
  $('#app').innerHTML=h;
  setFooter('<button class="btn primary" type="button" data-act="prop-new">\uFF0B New property</button>');
};
VIEWS.setupLandlords = function(){
  setTitle('Landlords');
  var ps=setupProps(), lls=landlords();
  var h='<div class="small muted" style="margin:4px 6px 10px">The people who sign tenancy agreements. Choose each property\u2019s default landlord in its settings.</div>';
  if(!lls.length) h+='<div class="card empty small">No landlords yet. Tap \uFF0B New landlord.</div>';
  lls.forEach(function(l){
    var n=ps.filter(function(p){ return p.landlord===l.name; }).length;
    h+='<div class="card"><div class="row"><div class="tile t2">\uD83D\uDC64</div><div class="grow tap" data-act="landlord-edit" data-id="'+esc(l.name)+'"><div class="title">'+esc(l.name)+'</div>'+
      '<div class="small muted">'+[l.email,l.mobile||l.phone].filter(Boolean).map(esc).join(' \u00B7 ')+'</div>'+
      '<div style="margin-block-start:6px">'+(l.signer2Name&&l.signer2Email?'<span class="pill">\u270D 2 signers</span>':'')+(n?'<span class="pill">\uD83C\uDFE0 Default for '+n+' propert'+(n>1?'ies':'y')+'</span>':'')+(!l.address?'<span class="pill st-warn">No address for service</span>':'')+'</div></div><span class="chev">\u203A</span></div></div>';
  });
  $('#app').innerHTML=h;
  setFooter('<button class="btn primary" type="button" data-act="landlord-new">\uFF0B New landlord</button>');
};/* Same card as Flat Inspections' Manage properties: areas and checks, plus the letting and agreement set-up */
function setupPropCard(p){
  var areas=p.areas||[], n=0; areas.forEach(function(a){ n+=(a.items||[]).length; });
  return '<div class="card"><div class="row"><div class="tile">\uD83C\uDFE0</div><div class="grow tap" data-act="prop-edit" data-id="'+esc(p.propertyId)+'"><div class="title">'+esc(p.name||p.address1)+'</div>'+
    '<div class="small muted">'+esc([p.address1,p.address2].filter(Boolean).join(', '))+(p.rent!==''&&p.rent!=null?' \u00B7 '+esc(money(p.rent)):'')+'</div>'+
    '<div style="margin-block-start:6px"><span class="pill">\uD83D\uDEAA '+areas.length+' area'+(areas.length===1?'':'s')+'</span><span class="pill">\u2705 '+n+' check'+(n===1?'':'s')+'</span>'+
    ((esignOn()?!esignMissing(p).length:p.templateId)?'<span class="pill st-done">\u270D Agreement'+(esignOn()?' ready':'')+'</span>':'<span class="pill st-warn">'+(esignOn()?'Agreement details to complete':'No agreement')+'</span>')+(p.landlord?'<span class="pill">'+esc(p.landlord)+'</span>':'')+
    (p.active?'':'<span class="pill st-bad">Archived</span>')+'</div></div></div>'+
    '<div class="row" style="margin-block-start:12px"><button class="btn sm grow" type="button" data-act="prop-edit" data-id="'+esc(p.propertyId)+'">\u270E Edit</button>'+
    '<button class="btn sm ghost grow" type="button" data-act="prop-clone" data-id="'+esc(p.propertyId)+'">\u29C9 Clone</button></div></div>';
}
/* Inspection areas: the same library and quick layout builder as Flat Inspections */
var COMMON=['Walls','Ceiling','Floor / carpet','Skirting boards','Windows & glass','Curtains / blinds','Doors, handles & locks','Light fittings & bulbs','Power points & switches'];
var LIB={
  'Bedroom': COMMON.concat(['Wardrobe / storage','Smoke alarm \u2013 present & working']),
  'Living / Dining': COMMON.concat(['Heat pump / heater','Smoke alarm \u2013 present & working']),
  'Kitchen': COMMON.concat(['Benchtops','Cupboards & drawers','Oven & hob','Rangehood','Sink & taps','Dishwasher (chattel)','Fridge (chattel)']),
  'Bathroom': ['Walls','Ceiling','Floor / tiles','Skirting boards','Windows & glass','Light fittings & bulbs','Shower / bath','Toilet','Vanity & basin','Mirror & cabinet','Extractor fan','Mould / mildew','Towel rail'],
  'Toilet': ['Walls','Floor','Toilet','Hand basin','Light fittings & bulbs','Extractor fan'],
  'Laundry': ['Walls','Floor','Skirting boards','Tub & taps','Washing machine connections','Dryer (chattel)','Light fittings & bulbs'],
  'Hallway / Entry': COMMON.concat(['Smoke alarm \u2013 present & working']),
  'Garage': ['Floor \u2013 oil stains','Garage door & opener','Walls','Light fittings & bulbs','Rubbish removed'],
  'Exterior / Grounds': ['Lawns & gardens','Rubbish removed / bins','Driveway & paths','Fences & gates','Clothesline','Exterior windows','Exterior walls & cladding','Letterbox','Outdoor lighting'],
  'General / Whole property': ['Smoke alarms \u2013 all present & working','Rubbish removed from property','Keys & remotes','Meter readings (power / water)','Ventilation & insulation','Pests \u2013 any evidence'],
  'Special features': [],
  'Custom': []
};
var AREA_TYPES=Object.keys(LIB);
function uid(p){ return p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7); }
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
/* New property: blank (standard 2-bedroom layout) or an exact copy of another property */
function newPropDialog(fromId){
  var ps=setupProps().filter(function(p){ return p.active; });
  var m=modal('<div class="title" style="font-size:1.15rem;margin-block-end:12px">'+(fromId?'\u29C9 Clone property':'\uFF0B New property')+'</div>'+
    '<label class="fld"><span>Start from</span><select id="npFrom"><option value="">Blank template (use the quick builder)</option>'+ps.map(function(p){ return '<option value="'+esc(p.propertyId)+'"'+(p.propertyId===fromId?' selected':'')+'>Clone: '+esc(p.name||p.address1)+'</option>'; }).join('')+'</select></label>'+
    '<div id="npInfo" class="small muted" style="margin:-6px 0 12px"></div>'+
    '<label class="fld"><span>New property name</span><input type="text" id="npName" placeholder="e.g. Flat 2, 45 George St"></label>'+
    '<label class="fld"><span>Street address</span><input type="text" id="npA1" placeholder="e.g. 208 Hanover Street"></label>'+
    '<label class="fld"><span>Suburb / city</span><input type="text" id="npA2" placeholder="e.g. Dunedin"></label>'+
    '<div id="npErr" class="err"></div>'+
    '<div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-np="cancel">Cancel</button><button class="btn primary" type="button" data-np="go">Continue</button></div>');
  function src(){ return setupPropById($('#npFrom',m).value); }
  function info(){ var p=src();
    if(!p){ $('#npInfo',m).textContent='Starts with a standard 2-bedroom layout you can change.'; $('[data-np=go]',m).textContent='Continue'; return; }
    var n=0; (p.areas||[]).forEach(function(a){ n+=(a.items||[]).length; });
    $('#npInfo',m).textContent='Copies all '+(p.areas||[]).length+' areas, '+n+' checks, guidance and inspector notes, plus the rent, bond, insurance, agreement terms, template and landlord from '+(p.name||p.address1)+'.';
    $('[data-np=go]',m).textContent='Clone'; }
  info(); $('#npFrom',m).addEventListener('change',info); setTimeout(function(){ $('#npName',m).focus(); },60);
  m.addEventListener('click',function(ev){
    var b=ev.target.closest('[data-np]'); if(!b) return;
    if(b.getAttribute('data-np')==='cancel') return m.remove();
    var name=$('#npName',m).value.trim(), a1=$('#npA1',m).value.trim(), a2=$('#npA2',m).value.trim(), p=src();
    if(!name){ $('#npErr',m).textContent='Enter a name for the new property.'; return; }
    if(!a1){ $('#npErr',m).textContent='Enter the street address.'; return; }
    if(setupProps().some(function(x){ return x.active && String(x.name||'').trim().toLowerCase()===name.toLowerCase(); })){ $('#npErr',m).textContent='A property with that name already exists \u2014 use a different name.'; return; }
    m.remove();
    var e={_for:'new'}; PE_FIELDS.forEach(function(k){ e[k]=''; });
    if(p){ ['notes','rent','tenancy','bond','maxOccupants','insurer','insurancePolicy','excess','templateId','templateTitle','landlord','rentPaymentDetails','pets','unitTitle','bodyCorporateRules','bottledGas','internetIncluded','power','powerCap','powerDays'].forEach(function(k){ e[k]=p[k]!=null?p[k]:''; });
      e.rooms=clone(p.rooms||[]);
      e.additionalTerms=(p.additionalTerms||[]).slice();
      e.chattels=(p.chattels||[]).slice(); e.insulation=insOf(p.insulation); e.healthyHomes=hhOf(p.healthyHomes);
      e.areas=(p.areas||[]).map(function(a){ return {id:uid('A'),name:a.name,type:a.type,items:(a.items||[]).slice(),notes:a.notes||''}; }); e.clonedFrom=p.name||p.address1; }
    else { e.areas=buildLayout(2,1,0,['Laundry','Hallway / Entry','Exterior / Grounds'],[]); e.chattels=[]; e.additionalTerms=[]; e.insulation=blankIns(); e.healthyHomes=blankHH(); e.rooms=[]; }
    e.name=name; e.address1=a1; e.address2=a2;
    S.pe=e; S.peCheck=null; S.peResults=null; S.peQ=null; S.peTab='details';
    if(S.cur.view==='propEdit'){ S.cur={view:'propEdit',arg:''}; render(); window.scrollTo(0,0); } else go('propEdit','');
  });
}
/* Letting details checks (the server checks again) */
function propProblem(p){
  var r=p.rent===''||p.rent==null?NaN:+p.rent, b=p.bond===''||p.bond==null?NaN:+p.bond, o=p.maxOccupants===''||p.maxOccupants==null?NaN:+p.maxOccupants;
  if(!String(p.address1||'').trim()) return 'Enter the street address.';
  if(p.rent!==''&&p.rent!=null&&!(r>=0)) return 'Check the rent per week.';
  if(p.bond!==''&&p.bond!=null&&!(b>=0)) return 'Check the bond.';
  if(r>0&&b>r*4+0.005) return 'The bond can\u2019t be more than 4 weeks\u2019 rent ($'+money2(r*4)+').';
  if(!isNaN(o)&&(o<1||Math.floor(o)!==o)) return 'Maximum occupants must be a whole number.';
  if(p.excess!==''&&p.excess!=null&&!(+p.excess>=0)) return 'Check the insurance excess.';
  return '';
}
var PE_FIELDS=['propertyId','name','address1','address2','notes','rent','tenancy','bond','maxOccupants','insurer','insurancePolicy','excess','insulationDate','templateId','templateTitle','landlord',
  'rentPaymentDetails','pets','unitTitle','bodyCorporateRules','bottledGas','internetIncluded','power','powerCap','powerDays'];
/* Free-text property terms written into built-in agreements: [key, label, required for built-in, placeholder] */
var ESIGN_TERMS=[['rentPaymentDetails','How rent is paid',true,'e.g. Weekly in advance to 12-3456-7890123-00 (K Box), reference: your surname'],
  ['pets','Pets',false,'Leave blank to use the standard wording']];
/* Insulation (ceiling / underfloor / walls) and healthy homes details - the same rules and wording as the server */
var INS_AREAS=[['ceiling','Ceiling'],['underfloor','Underfloor'],['walls','Walls']];
var INS_TYPES=['Glass wool batts','Polyester batts','Wool batts','Polystyrene','Foil','Loose fill','Blown-in','Reflective foil','Sheep wool'];
var INS_REASONS={ceiling:['No ceiling cavity','Skillion roof with no access','Not safe to access'],underfloor:['Concrete floors','No floor cavity space','No access to the subfloor'],walls:['Walls lined and can\u2019t be checked without damage','Solid brick walls']};
var GROUND_REASONS=['A professional installer has confirmed it isn\u2019t reasonably practicable to install one','Too little space under the house to install one','No access to the subfloor'];
var INS_FIELDS=['status','type','rValue','thickness','installed','lastInspected','condition','conditionNotes','partialNotes','reason','layers','type2','rValue2','thickness2','installed2'];   // layers '2' = a second layer (ceiling)
var HH_FIELDS=['complianceDate','heatingComplies','heatingCapacity','heatingProvided','heater1','heater2','toleranceApplies','toleranceKw','toleranceReason','heatingExemptReason','additionalHeating','ventilation','ventilationNotes','kitchenFan','bathroomFan','fanNotes','gutters','guttersNotes','enclosedSubfloor','groundCover','groundCoverReason','drafts','draughtFree','draughtNotes','openFireplace','fireplaceNotes'];
function blankIns(){ var o={}; INS_AREAS.forEach(function(a){ o[a[0]]={}; INS_FIELDS.forEach(function(k){ o[a[0]][k]=''; }); }); return o; }
function blankHH(){ var o={}; HH_FIELDS.forEach(function(k){ o[k]=''; }); return o; }
function insOf(v){ var o=blankIns(); INS_AREAS.forEach(function(a){ var x=(v||{})[a[0]]||{}; INS_FIELDS.forEach(function(k){ if(x[k]!=null) o[a[0]][k]=x[k]; }); }); return o; }
function hhOf(v){ var o=blankHH(); v=v||{}; HH_FIELDS.forEach(function(k){ if(v[k]!=null) o[k]=v[k]; });
  if(!o.heatingComplies && (tx(o.heater1)||tx(o.heatingCapacity))) o.heatingComplies='yes';
  if(!o.enclosedSubfloor && o.groundCover) o.enclosedSubfloor='yes';
  if(!o.draughtFree && tx(o.drafts)) o.draughtFree='yes';   // a statement written before 3.16.2 said it was free of draughts   // answered before 3.16.2: the barrier question implied an enclosed subfloor   // before 3.16.0 every property complied
  if(o.ventilation&&['yes','partial'].indexOf(o.ventilation)<0){ if(!o.ventilationNotes) o.ventilationNotes=o.ventilation; o.ventilation=''; }   // 2.23.0 free text
  return o; }
function tx(v){ return String(v==null?'':v).trim(); }
function insProblems(v){
  var ins=insOf(v), out=[];
  INS_AREAS.forEach(function(a){ var x=ins[a[0]], l=a[1].toLowerCase();
    if(!x.status) out.push('whether the '+l+(a[0]==='walls'?' are':' is')+' insulated');
    else if(x.status==='insulated'||x.status==='partial'){
      if(x.status==='partial'&&!tx(x.partialNotes)) out.push('why the '+l+' is only partly insulated');
      if(!tx(x.type)) out.push('the '+l+' insulation type');
      var opt=a[0]!=='ceiling';   // underfloor and walls: R-value (or thickness) is optional
      if(!opt&&tx(x.rValue)===''&&tx(x.thickness)==='') out.push('the '+l+' insulation R-value (or its thickness if the R-value isn\u2019t known)');
      if(a[0]!=='walls'&&!x.installed) out.push('when the '+l+' insulation was installed');
      if(x.layers==='2'){ if(!tx(x.type2)) out.push('the second '+l+' layer\u2019s insulation type');
        if(tx(x.rValue2)===''&&tx(x.thickness2)==='') out.push('the second '+l+' layer\u2019s R-value (or its thickness if the R-value isn\u2019t known)');
        if(!x.installed2) out.push('when the second '+l+' layer was installed'); }
      if(a[0]==='ceiling'&&!x.condition) out.push('whether the '+l+' insulation is in reasonable condition');
      else if(x.condition==='no'&&!tx(x.conditionNotes)) out.push('what\u2019s wrong with the '+l+' insulation\u2019s condition'); }
    else if(x.status==='none'&&a[0]!=='walls'&&!tx(x.reason)) out.push('why there\u2019s no '+l+' insulation');
    else if(x.status==='unknown'&&!tx(x.reason)) out.push('why the '+l+' insulation isn\u2019t known'); });
  return out;
}
function hhProblems(v){
  var h=hhOf(v), out=[];
  if(!h.complianceDate) out.push('the healthy homes compliance date');
  if(!h.heatingComplies) out.push('whether the main living room meets the heating standard');
  else if(h.heatingComplies==='no'){ if(!tx(h.heatingExemptReason)) out.push('why the heating doesn\u2019t comply'); }
  else {
    if(!(+h.heatingCapacity>0)) out.push('the heating required for the main living area (kW)');
    if(!(+h.heatingProvided>0)) out.push('the heating provided in the main living room (kW)');
    if(!tx(h.heater1)) out.push('the qualifying heater in the main living room');
    if(!h.toleranceApplies) out.push('whether a heating top-up applies');
    else if(h.toleranceApplies==='yes'){ if(!(+h.toleranceKw>0)) out.push('how much the heating top-up is (kW)'); if(!tx(h.toleranceReason)) out.push('why the heating top-up is acceptable'); }
    else if(+h.heatingProvided>0 && +h.heatingCapacity>0 && +h.heatingProvided < +h.heatingCapacity) out.push('more heating, a top-up, or \u201CDoesn\u2019t comply\u201D: '+kwText(h.heatingProvided)+' provided is less than the '+kwText(h.heatingCapacity)+' required');
  }
  if(!h.ventilation) out.push('whether all habitable spaces meet the ventilation standard'); else if(h.ventilation==='partial'&&!tx(h.ventilationNotes)) out.push('which spaces do and don\u2019t meet the ventilation standard');
  if(!h.kitchenFan) out.push('the kitchen rangehood or extractor fan');
  if(!h.bathroomFan) out.push('the bathroom extractor fan');
  if((h.kitchenFan==='none'||h.bathroomFan==='none')&&!tx(h.fanNotes)) out.push('notes on the missing extractor fan');
  if(!h.gutters) out.push('whether the gutters and downpipes drain to an appropriate outfall'); else if(h.gutters==='no'&&!tx(h.guttersNotes)) out.push('notes on the gutters and downpipes');
  if(!h.enclosedSubfloor) out.push('whether there\u2019s an enclosed subfloor');
  else if(h.enclosedSubfloor==='yes'){ if(!h.groundCover) out.push('whether there\u2019s a ground moisture barrier'); else if(h.groundCover==='no'&&!tx(h.groundCoverReason)) out.push('why there\u2019s no ground moisture barrier'); }
  if(!h.draughtFree) out.push('whether the property is free from gaps or holes that allow noticeable draughts');
  else if(h.draughtFree==='no'&&!tx(h.draughtNotes)) out.push('the gaps or holes that allow draughts');
  if(!h.openFireplace) out.push('whether there are any open fireplaces');
  return out;
}
function kwText(v){ return tx(v)===''||!isFinite(+v)? 'not stated' : String(+v)+' kW'; }
function instText(v){ v=tx(v); return /^\d{4}-\d{2}$/.test(v)? monthText(v) : trimEnd(v); }   // a month saved before 3.16.8, or free text
function inspText(v){ v=tx(v); return /^\d{4}-\d{2}-\d{2}$/.test(v)? dayText(v) : trimEnd(v); }   // a date saved before 3.16.6, or free text
function sentence(s){ s=tx(s); return s&&!/[.!?]$/.test(s)? s+'.' : s; }
function trimEnd(s){ return tx(s).replace(/[.\s]+$/,''); }
function monthText(ym){ var p=String(ym||'').split('-'); return p.length===2? MONTHS[+p[1]-1]+' '+p[0] : ''; }
function dayText(ymd){ var p=String(ymd||'').split('-'); return p.length===3? (+p[2])+' '+MONTHS[+p[1]-1]+' '+p[0] : ''; }
function insText(v){ var ins=insOf(v); return INS_AREAS.map(function(a){ var x=ins[a[0]];
  if((x.status==='insulated'||x.status==='partial')&&x.layers==='2'){
    var layer=function(t,r,th,inst){ return [tx(t),tx(r)!==''?'R'+tx(r):tx(th)!==''?tx(th)+' mm thick (R-value not known)':'',tx(inst)?'installed '+instText(inst):''].filter(Boolean).join(', '); };
    var rest=[tx(x.lastInspected)?'Last inspected '+inspText(x.lastInspected):'',x.condition==='yes'?'in reasonable condition':x.condition==='no'?'not in reasonable condition'+(tx(x.conditionNotes)?' ('+trimEnd(x.conditionNotes)+')':''):''].filter(Boolean).join(', ');
    return a[1]+': '+(x.status==='partial'?'Partly insulated'+(tx(x.partialNotes)?' ('+trimEnd(x.partialNotes)+')':'')+'. ':'')+'Two layers. Layer 1: '+layer(x.type,x.rValue,x.thickness,x.installed)+'. Layer 2: '+layer(x.type2,x.rValue2,x.thickness2,x.installed2)+'.'+(rest?' '+rest.charAt(0).toUpperCase()+rest.slice(1)+'.':''); }
  if(x.status==='insulated'||x.status==='partial'){
    var bits=[tx(x.type),tx(x.rValue)!==''?'R'+tx(x.rValue):tx(x.thickness)!==''?tx(x.thickness)+' mm thick (R-value not known)':'',a[0]!=='walls'&&tx(x.installed)?'installed '+instText(x.installed):'',a[0]!=='walls'&&tx(x.lastInspected)?'last inspected '+inspText(x.lastInspected):'',
      x.condition==='yes'?'in reasonable condition':x.condition==='no'?'not in reasonable condition'+(tx(x.conditionNotes)?' ('+trimEnd(x.conditionNotes)+')':''):''].filter(Boolean);
    return a[1]+': '+(x.status==='partial'?'Partly insulated'+(tx(x.partialNotes)?' ('+trimEnd(x.partialNotes)+')':'')+'. ':'')+bits.join(', ')+'.'; }
  if(x.status==='none') return a[1]+': No insulation.'+(tx(x.reason)?' Reason: '+sentence(x.reason):'');
  if(x.status==='unknown') return a[1]+': Not known.'+(tx(x.reason)?' '+sentence(x.reason):'');
  return a[1]+': Not stated.'; }).join('\n'); }
var FIREPLACE_TEXT={none:'none.',closed:'yes, closed off or chimney blocked to prevent draughts.',usable:'yes, and the landlord and tenant have agreed in writing that it can be used.'};
var FAN_TEXT={'150':'extractor fan or rangehood of at least 150 mm, vented outside',pre2019:'extractor fan smaller than 150 mm, installed before 1 July 2019',none:'no extractor fan'};
function hhText(v,landlordName){ var h=hhOf(v), heaters=[tx(h.heater1),tx(h.heater2)].filter(Boolean);
  return ['Heating: '+(h.heatingComplies==='no'? 'The main living room does not meet the heating standard. '+sentence(h.heatingExemptReason) :
      'The main living room meets the heating standard. Heating required for the main living area: '+kwText(h.heatingCapacity)+'. Heating provided: '+kwText(h.heatingProvided)+'.'+
      ' Qualifying heater'+(heaters.length>1?'s':'')+' installed in the main living room: '+(heaters.length?heaters.map(trimEnd).join('; '):'not stated')+'.'+
      (h.toleranceApplies==='yes'?' A heating top-up of '+kwText(h.toleranceKw)+' applies: '+sentence(h.toleranceReason):h.toleranceApplies==='no'?' No heating top-up applies.':''))+
      (tx(h.additionalHeating)?' Additional heating provided: '+sentence(h.additionalHeating):''),
    'Ventilation: '+(h.ventilation==='yes'?'All habitable spaces meet the ventilation standard.'+(tx(h.ventilationNotes)?' '+sentence(h.ventilationNotes):''):h.ventilation==='partial'?'Partly. '+sentence(h.ventilationNotes):'Not stated.')+
      ' Kitchen: '+(FAN_TEXT[h.kitchenFan]||'not stated')+'. Bathroom: '+(FAN_TEXT[h.bathroomFan]||'not stated')+'.'+((h.kitchenFan==='none'||h.bathroomFan==='none')&&tx(h.fanNotes)?' '+sentence(h.fanNotes):''),
    'Moisture and drainage: '+(h.gutters==='yes'?'Gutters and downpipes efficiently drain water to an appropriate outfall.':h.gutters==='no'?'Gutters and downpipes do not efficiently drain water to an appropriate outfall.'+(tx(h.guttersNotes)?' '+sentence(h.guttersNotes):''):'Gutters and downpipes not stated.')+
      (h.enclosedSubfloor==='no'?' No enclosed subfloor, so a ground moisture barrier isn\u2019t required.':
       (h.enclosedSubfloor==='yes'?' Enclosed subfloor: yes.':'')+' Ground moisture barrier: '+(h.groundCover==='yes'?'installed.':h.groundCover==='no'?'none.'+(tx(h.groundCoverReason)?' Reason: '+sentence(h.groundCoverReason):''):'not stated.')),
    'Draught stopping: '+(h.draughtFree==='yes'?'The property is free from unintentional and unreasonable gaps or holes that allow noticeable draughts.':h.draughtFree==='no'?'The property is not free from unintentional and unreasonable gaps or holes that allow noticeable draughts: '+sentence(h.draughtNotes):'Not stated.')+' Open fireplaces: '+(FIREPLACE_TEXT[h.openFireplace]||'not stated.')+(h.openFireplace&&h.openFireplace!=='none'&&tx(h.fireplaceNotes)?' '+sentence(h.fireplaceNotes):''),
    'The healthy homes compliance date for this tenancy is: '+(h.complianceDate?dayText(h.complianceDate):'not stated')+'.'].join('\n'); }
/* Editor pieces for the built-in agreement terms */
function chattelsHtml(list){
  return '<div class="fld"><span>Chattels provided (optional)</span></div>'+list.map(function(c,i){ return '<div class="row" style="gap:6px;margin-block-end:6px"><input type="text" class="grow" data-pe-ch="'+i+'" value="'+esc(c)+'" placeholder="e.g. Fridge" aria-label="Chattel '+(i+1)+'">'+
    '<button class="btn sm danger" type="button" data-act="ch-del" data-id="'+i+'" aria-label="Remove">\u2715</button></div>'; }).join('')+
    '<button class="btn sm" type="button" data-act="ch-add" style="margin-block-end:12px">\uFF0B Add chattel</button>';
}
/* Internet and electricity, and rooms let on their own (each with its own defaults for that room's agreements) */
var POWER_OPTS=[['tenant','Tenant pays for their own electricity'],['included','Included in the rent'],['capped','Included up to a monthly cap']];
function nextRoomName(rooms){ for(var i=0;i<26;i++){ var n='Room '+String.fromCharCode(65+i); if(!rooms.some(function(r){ return r.name===n; })) return n; } return 'Room '+(rooms.length+1); }
function utilitiesHtml(e){
  var rooms=e.rooms||[], pw=e.power||'tenant';
  var h='<label class="row" style="gap:10px;margin-block-end:12px;cursor:pointer;align-items:flex-start"><input type="checkbox" data-pe-cb="internetIncluded"'+(e.internetIncluded?' checked':'')+' style="width:22px;height:22px;flex:none"><span>Internet is included in the rent</span></label>'+
    '<label class="fld"><span>Electricity</span><select data-pe="power">'+POWER_OPTS.map(function(o){ return '<option value="'+o[0]+'"'+(o[0]===pw?' selected':'')+'>'+esc(o[1])+'</option>'; }).join('')+'</select></label>';
  if(pw==='capped') h+='<div class="grid2"><label class="fld"><span>Monthly cap for the whole property ($)</span><input type="number" inputmode="decimal" min="0" data-pe="powerCap" value="'+esc(e.powerCap)+'" placeholder="e.g. 200"></label>'+
    '<label class="fld"><span>Days to pay anything over the cap</span><input type="number" inputmode="numeric" min="1" max="90" data-pe="powerDays" value="'+esc(e.powerDays)+'" placeholder="14"></label></div>'+
    '<div class="small muted" style="margin:-6px 0 12px">'+(rooms.length?'Anything over the cap is split equally between all '+rooms.length+' rooms.':'Anything over the cap is paid by the tenants of the whole property. Add rooms below to split it between rooms.')+'</div>';
  h+='<div class="fld"><span>Rooms let on their own (optional)</span></div>'+
    (rooms.length?'<div class="small muted" style="margin-block-end:8px">Each room is let with its own tenancy agreement. Its rent, bond and occupants fill in when you send an agreement for it.</div>':'')+
    rooms.map(function(r,i){ return '<div style="background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:10px;margin-block-end:8px"><div class="row" style="gap:6px;margin-block-end:6px">'+
      '<input type="text" class="grow" data-pe-room="'+i+'.name" value="'+esc(r.name)+'" placeholder="e.g. Room A" aria-label="Room name">'+
      '<button class="btn sm danger" type="button" data-act="room-del" data-id="'+i+'" aria-label="Remove room">\u2715</button></div>'+
      '<div class="grid3"><label class="fld small" style="margin:0"><span>Rent / week ($)</span><input type="number" inputmode="decimal" min="0" data-pe-room="'+i+'.rent" value="'+esc(r.rent)+'"></label>'+
      '<label class="fld small" style="margin:0"><span>Bond ($)</span><input type="number" inputmode="decimal" min="0" data-pe-room="'+i+'.bond" value="'+esc(r.bond)+'"></label>'+
      '<label class="fld small" style="margin:0"><span>Max occupants</span><input type="number" inputmode="numeric" min="1" data-pe-room="'+i+'.maxOccupants" value="'+esc(r.maxOccupants)+'"></label></div></div>'; }).join('')+
    '<button class="btn sm" type="button" data-act="room-add">\uFF0B Add room</button>';
  return h;
}
/* redraws just the Utilities and rooms card */
function peUtilRedraw(focus){ var c=$('#peUtil'); if(!c||!S.pe) return keepScroll(render); c.innerHTML=utilitiesHtml(S.pe); peMenuRefresh();
  if(focus){ var f=c.querySelector(focus); if(f){ f.focus(); try{ f.select(); }catch(x){} } } }
function roomsProblem(e){
  var seen={}, rooms=e.rooms||[];
  for(var i=0;i<rooms.length;i++){ var r=rooms[i], n=String(r.name||'').trim(), k=n.toLowerCase();
    if(!n) return 'Give room '+(i+1)+' a name.'; if(seen[k]) return 'There are two rooms called '+n+'.'; seen[k]=1;
    if(r.rent!==''&&r.rent!=null&&!(+r.rent>0)) return 'Check the rent for '+n+'.';
    if(r.bond!==''&&r.bond!=null&&!(+r.bond>=0)) return 'Check the bond for '+n+'.';
    if(+r.rent>0&&r.bond!==''&&r.bond!=null&&+r.bond>+r.rent*4+0.005) return 'The bond for '+n+' can\u2019t be more than 4 weeks\u2019 rent ($'+money2(+r.rent*4)+').';
    if(r.maxOccupants!==''&&r.maxOccupants!=null&&!(+r.maxOccupants>=1&&Math.floor(+r.maxOccupants)===+r.maxOccupants)) return 'Maximum occupants for '+n+' must be a whole number.'; }
  if((e.power||'tenant')==='capped'){ if(!(+e.powerCap>0)) return 'Enter the monthly electricity cap.';
    var dd=e.powerDays===''||e.powerDays==null?14:+e.powerDays; if(!(dd>=1&&dd<=90&&Math.floor(dd)===dd)) return 'Enter how many days tenants have to pay electricity over the cap (1 to 90).'; }
  return '';
}
/* Additional terms: each is its own numbered item in section 8 of the agreement */
function termsListHtml(list){
  var mt=termsMaster(), same=sameTerms(list,mt);
  return '<div class="fld"><span>Additional terms (optional) \u2014 each becomes a numbered term</span></div>'+
    (mt.length?'<div class="row" style="gap:8px;margin-block-end:8px;flex-wrap:wrap">'+(same?'<span class="pill st-done">Matches the master list</span>':'<span class="pill st-warn">Differs from the master list</span><button class="btn sm" type="button" data-act="at-master">\u21BB Use master list</button>')+'</div>':'')+
    list.map(function(c,i){ return '<div class="row" style="gap:6px;margin-block-end:6px;align-items:flex-start"><b style="padding-block-start:12px;min-width:18px">'+(i+1)+'.</b>'+
    '<textarea class="grow" rows="2" data-pe-at="'+i+'" placeholder="e.g. The tenant will mow the lawns fortnightly" aria-label="Additional term '+(i+1)+'">'+esc(c)+'</textarea>'+
    '<button class="btn sm danger" type="button" data-act="at-del" data-id="'+i+'" aria-label="Remove">\u2715</button></div>'; }).join('')+
    '<button class="btn sm" type="button" data-act="at-add" style="margin-block-end:12px">\uFF0B Add term</button>';
}
/* a row of choice buttons; tapping the chosen one again clears it */
function segHtml(act,id,cur,opts,cls){ return '<div class="seg '+(cls||'c'+opts.length)+'" style="margin-block:4px 10px">'+opts.map(function(o){ return '<button type="button" data-act="'+act+'" data-id="'+id+'" data-v="'+o[0]+'" class="'+(cur===o[0]?'on':'')+'">'+o[1]+'</button>'; }).join('')+'</div>'; }
function fldLabel(t){ return '<div class="fld" style="margin-block-end:0"><span>'+esc(t)+'</span></div>'; }
/* when it was installed: the ceiling and underfloor take text ("March 2010", "Unknown"); underfloor and walls a month */
function instBox(key,f,v){ return key!=='walls'?   // ceiling and underfloor: text (3.16.10)
  '<label class="fld"><span>Installed</span><input type="text" data-ins="'+key+'.'+f+'" value="'+esc(v)+'" placeholder="e.g. March 2010, or Unknown"></label>'
  : '<label class="fld"><span>Installed (month and year)</span><input type="month" data-ins="'+key+'.'+f+'" value="'+esc(v)+'"></label>'; }
function insAreaHtml(key,label,x){
  var h='<div class="editor-area"><div style="font-weight:750;margin-block-end:6px">'+esc(label)+'</div>'+
    segHtml('ins-seg',key+'.status',x.status,[['insulated','Insulated'],['partial','Partial'],['none','None'],['unknown','Not known']],'c4');
  if(x.status==='insulated'||x.status==='partial'){
    if(x.status==='partial') h+='<label class="fld"><span>Why it\u2019s only partly insulated (required)</span><textarea rows="2" data-ins="'+key+'.partialNotes" placeholder="e.g. No insulation over the back bedroom extension">'+esc(x.partialNotes)+'</textarea></label>';
    var two=key==='ceiling'&&x.layers==='2';
    if(key==='ceiling') h+=fldLabel('Layers of insulation')+segHtml('ins-seg',key+'.layers',two?'2':'1',[['1','One layer'],['2','Two layers']]);
    h+=(two?'<div class="small" style="font-weight:750;margin-block:4px 6px">Layer 1</div>':'')+
      '<label class="fld"><span>Insulation type</span><input type="text" list="insTypes" data-ins="'+key+'.type" value="'+esc(x.type)+'" placeholder="e.g. Glass wool batts"></label>'+
      '<div class="grid2"><label class="fld"><span>R-value'+(key!=='ceiling'?' (optional)':'')+'</span><input type="number" inputmode="decimal" step="0.1" min="0" data-ins="'+key+'.rValue" value="'+esc(x.rValue)+'" placeholder="e.g. 3.2"></label>'+
      '<label class="fld"><span>Thickness (mm, if R-value not known)'+(key!=='ceiling'?' (optional)':'')+'</span><input type="number" inputmode="numeric" min="0" data-ins="'+key+'.thickness" value="'+esc(x.thickness)+'" placeholder="e.g. 140"></label></div>'+
      (two?''+instBox(key,'installed',x.installed)+''+
        '<div class="small" style="font-weight:750;margin-block:10px 6px">Layer 2</div>'+
        '<label class="fld"><span>Insulation type</span><input type="text" list="insTypes" data-ins="'+key+'.type2" value="'+esc(x.type2)+'" placeholder="e.g. Polyester batts (top-up)"></label>'+
        '<div class="grid2"><label class="fld"><span>R-value</span><input type="number" inputmode="decimal" step="0.1" min="0" data-ins="'+key+'.rValue2" value="'+esc(x.rValue2)+'" placeholder="e.g. 3.6"></label>'+
        '<label class="fld"><span>Thickness (mm, if R-value not known)</span><input type="number" inputmode="numeric" min="0" data-ins="'+key+'.thickness2" value="'+esc(x.thickness2)+'" placeholder="e.g. 140"></label></div>'+
        ''+instBox(key,'installed2',x.installed2)+''+
        '<div class="small" style="font-weight:750;margin-block:10px 6px">Whole ceiling</div>'+
        '<label class="fld"><span>Last inspected (optional)</span><input type="text" data-ins="'+key+'.lastInspected" value="'+esc(x.lastInspected)+'" placeholder="e.g. June 2026, or Unknown"></label>'
      :key==='walls'?'':'<div class="grid2">'+instBox(key,'installed',x.installed)+''+   // walls: no installed or inspected date (3.16.9)
      '<label class="fld"><span>Last inspected (optional)</span><input type="text" data-ins="'+key+'.lastInspected" value="'+esc(x.lastInspected)+'" placeholder="e.g. June 2026, or Unknown"></label></div>')+
      fldLabel('In reasonable condition?'+(key!=='ceiling'?' (optional)':''))+segHtml('ins-seg',key+'.condition',x.condition,[['yes','Yes'],['no','No']]);
    if(x.condition==='no') h+='<label class="fld" style="margin:0"><span>What\u2019s wrong with it (required)</span><input type="text" data-ins="'+key+'.conditionNotes" value="'+esc(x.conditionNotes)+'" placeholder="e.g. Batts displaced near the hatch"></label>';
  } else if(x.status==='none'||x.status==='unknown') h+='<label class="fld" style="margin:0"><span>'+(x.status==='none'?(key==='walls'?'Reason (optional)':'Why there\u2019s no insulation (required)'):'Why it isn\u2019t known (required)')+'</span>'+
    '<input type="text" list="insReason-'+key+'" data-ins="'+key+'.reason" value="'+esc(x.reason)+'" placeholder="'+esc((INS_REASONS[key]||[])[0]||'')+'"></label>'+
    '<datalist id="insReason-'+key+'">'+(INS_REASONS[key]||[]).map(function(r){ return '<option value="'+esc(r)+'">'; }).join('')+'</datalist>';
  return h+'</div>';
}
function hhHtml(h){
  var none=h.kitchenFan==='none'||h.bathroomFan==='none';
  return '<label class="fld"><span>Healthy homes compliance date</span><input type="date" data-hh="complianceDate" value="'+esc(h.complianceDate)+'"></label>'+
    '<div class="sasec">Heating</div>'+fldLabel('Does the main living room meet the heating standard?')+
    segHtml('hh-seg','heatingComplies',h.heatingComplies,[['yes','Complies'],['no','Doesn\u2019t comply']])+
    (h.heatingComplies==='no'?'<label class="fld"><span>Why it doesn\u2019t comply (required)</span><textarea rows="3" data-hh="heatingExemptReason" placeholder="e.g. Partial exemption: the body corporate rules don\u2019t allow a heat pump on the external walls, there\u2019s no mains gas and a woodburner can\u2019t be installed.">'+esc(h.heatingExemptReason)+'</textarea></label>' :
     h.heatingComplies==='yes'?
      '<div class="grid2"><label class="fld"><span>Heating required (kW)</span><input type="number" inputmode="decimal" step="0.1" min="0" data-hh="heatingCapacity" value="'+esc(h.heatingCapacity)+'" placeholder="e.g. 5.7"></label>'+
      '<label class="fld"><span>Heating provided (kW)</span><input type="number" inputmode="decimal" step="0.1" min="0" data-hh="heatingProvided" value="'+esc(h.heatingProvided)+'" placeholder="e.g. 6.0"></label></div>'+
      '<label class="fld"><span>Qualifying heater installed in the main living room</span><input type="text" data-hh="heater1" value="'+esc(h.heater1)+'" placeholder="e.g. Daikin heat pump, 6.0 kW heating"></label>'+
      '<label class="fld"><span>Second qualifying heater (optional)</span><input type="text" data-hh="heater2" value="'+esc(h.heater2)+'" placeholder="e.g. 2.4 kW fixed electric heater with thermostat"></label>'+
      fldLabel('Has a top-up been applied?')+segHtml('hh-seg','toleranceApplies',h.toleranceApplies,[['yes','Yes'],['no','No']])+
      (h.toleranceApplies==='yes'?'<label class="fld"><span>Top-up amount (kW)</span><input type="number" inputmode="decimal" step="0.1" min="0" data-hh="toleranceKw" value="'+esc(h.toleranceKw)+'" placeholder="e.g. 2.4"></label>'+
        '<label class="fld"><span>Why the top-up is acceptable (required)</span><textarea rows="3" data-hh="toleranceReason" placeholder="e.g. Required heating capacity is 5.7 kW and the existing heat pump (installed before 1 July 2019) has 3.3 kW. A 2.4 kW fixed electric heater with a thermostat has been installed to top up to the required amount.">'+esc(h.toleranceReason)+'</textarea></label>':'')
     : '')+
    '<label class="fld"><span>Additional heating provided (optional)</span><textarea rows="2" data-hh="additionalHeating" placeholder="e.g. Panel heaters with thermostats in bedrooms 1 and 2; heated towel rail in the bathroom">'+esc(h.additionalHeating)+'</textarea></label>'+
    '<div class="sasec">Ventilation</div>'+fldLabel('Do all habitable spaces meet the ventilation standard?')+
    segHtml('hh-seg','ventilation',h.ventilation,[['yes','Yes, all habitable spaces'],['partial','Partial']])+
    (h.ventilation==='partial'?'<label class="fld"><span>Which spaces do and don\u2019t (required)</span><textarea rows="2" data-hh="ventilationNotes" placeholder="e.g. All bedrooms and the lounge have opening windows; the hallway has none">'+esc(h.ventilationNotes)+'</textarea></label>':'')+
    fldLabel('Kitchen: rangehood or extractor fan')+segHtml('hh-seg','kitchenFan',h.kitchenFan,[['150','150 mm or more'],['pre2019','Smaller, before 1 Jul 2019'],['none','None']])+
    fldLabel('Bathroom: extractor fan')+segHtml('hh-seg','bathroomFan',h.bathroomFan,[['150','150 mm or more'],['pre2019','Smaller, before 1 Jul 2019'],['none','None']])+
    (none?'<label class="fld"><span>Notes on the missing fan (required)</span><input type="text" data-hh="fanNotes" value="'+esc(h.fanNotes)+'" placeholder="e.g. Bathroom fan being installed in March"></label>':'')+
    '<div class="sasec">Moisture and drainage</div>'+fldLabel('Do the gutters and downpipes efficiently drain water to an appropriate outfall?')+
    segHtml('hh-seg','gutters',h.gutters,[['yes','Yes'],['no','No']])+
    (h.gutters==='no'?'<label class="fld"><span>Notes (required)</span><input type="text" data-hh="guttersNotes" value="'+esc(h.guttersNotes)+'"></label>':'')+
    fldLabel('Is there an enclosed subfloor?')+segHtml('hh-seg','enclosedSubfloor',h.enclosedSubfloor,[['yes','Yes'],['no','No']])+
    (h.enclosedSubfloor==='yes'?'':'<div class="small muted" style="margin-block:-6px 10px">Enclosed means air can\u2019t flow freely in and out along at least half of the subfloor\u2019s perimeter. A concrete slab has no subfloor.</div>')+
    (h.enclosedSubfloor!=='yes'?'':fldLabel('Ground moisture barrier (damp-proof ground cover)')+segHtml('hh-seg','groundCover',h.groundCover,[['yes','Yes, installed'],['no','No']]))+
    (h.enclosedSubfloor==='yes'&&h.groundCover==='no'?'<label class="fld"><span>Why there isn\u2019t one (required)</span><input type="text" list="groundReasons" data-hh="groundCoverReason" value="'+esc(h.groundCoverReason)+'" placeholder="e.g. Too little space under the house to install one"></label>'+
      '<datalist id="groundReasons">'+GROUND_REASONS.map(function(r){ return '<option value="'+esc(r)+'">'; }).join('')+'</datalist>':'')+
    '<div class="sasec">Draught stopping</div>'+
    fldLabel('Is the property free from unintentional gaps or holes that allow noticeable draughts?')+segHtml('hh-seg','draughtFree',h.draughtFree,[['yes','Yes'],['no','No']])+
    (h.draughtFree==='no'?'<label class="fld"><span>Explain (required)</span><textarea data-hh="draughtNotes" rows="2" placeholder="e.g. Gap under the back door; a draught seal is being fitted in March.">'+esc(h.draughtNotes)+'</textarea></label>':'')+
    fldLabel('Any open fireplaces?')+segHtml('hh-seg','openFireplace',h.openFireplace,[['none','None'],['closed','Yes, closed off or chimney blocked'],['usable','Yes, can be used (agreed in writing)']])+
    (h.openFireplace==='usable'?'<div class="small muted" style="margin-block:-6px 8px">The healthy homes standards require an open fireplace to be closed off or its chimney blocked, unless you and the tenant agree in writing that it can be used. Put that in the additional terms.</div>':'')+
    (h.openFireplace&&h.openFireplace!=='none'?'<label class="fld"><span>Fireplace notes (optional)</span><input type="text" data-hh="fireplaceNotes" value="'+esc(h.fireplaceNotes)+'" placeholder="e.g. Lounge fireplace, chimney blocked with a sealed plate"></label>':'');
}
/* What a property still needs before a built-in agreement can be sent (same list as the server's) */
function keepScroll(fn){ var y=window.scrollY; fn(); window.scrollTo(0,y); }
function esignMissing(pp){ pp=pp||{}; return (String(pp.rentPaymentDetails||'').trim()?[]:['how rent is paid']).concat(insProblems(pp.insulation),hhProblems(pp.healthyHomes),
  pp.unitTitle&&!pp.bodyCorporateRules?['the body corporate rules (it\u2019s a unit title property)']:[]); }
/* Unit title (body corporate rules, kept in one shared Drive folder) and bottled gas */
function bcCardHtml(e){ return bcHtml(e).replace('margin-block:14px 8px','margin-block:0 8px'); }
/* redraws just the Unit title and gas card (cards animate in when drawn, so the whole form isn't redrawn) */
function peBcRedraw(){ var c=$('#peBc'); if(!c||!S.pe) return keepScroll(render); c.innerHTML=bcCardHtml(S.pe); peMenuRefresh(); if(S.pe.unitTitle) loadBcFiles(); }
function bcHtml(e){
  var cb=function(k,label){ return '<label class="row" style="gap:10px;margin-block-end:10px;cursor:pointer;align-items:flex-start"><input type="checkbox" data-pe-cb="'+k+'"'+(e[k]?' checked':'')+' style="width:22px;height:22px;flex:none"><span>'+label+'</span></label>'; };
  var h='<div class="sasec" style="margin-block:14px 8px">Unit title and gas</div>'+cb('unitTitle','Unit title property (it has a body corporate)');
  if(e.unitTitle){
    var bc=S.bcFiles, cur=e.bodyCorporateRules||'', f=bc&&bc.files.find(function(x){ return x.id===cur; });
    var usedBy=function(id){ return setupProps().filter(function(p){ return id&&p.bodyCorporateRules===id&&p.propertyId!==e.propertyId; }).map(function(p){ return p.name||p.address1; }); };
    var others=usedBy(cur), nm=f?f.name:(cur?((setupPropById(e.propertyId)||{}).bodyCorporateRulesName||'Chosen file'):'');
    h+='<div class="small" style="background:var(--surface-2);border:1px solid var(--line);border-radius:12px;padding:12px;margin-block-end:12px">'+
      (cur?'<div style="font-weight:750">\uD83D\uDCC4 '+esc(nm)+(f?' \u00B7 <a href="'+esc(f.url)+'" target="_blank" rel="noopener">Open</a>':'')+'</div>'+
        '<div class="muted">'+(others.length?'Also used by: '+esc(others.join(', ')):'Not used by any other property')+'</div>'
        :'<div style="color:var(--bad);font-weight:700">Choose or upload the body corporate rules (PDF). They are attached to every built-in agreement for this property.</div>')+
      (bc?'<div class="muted" style="margin-block:8px">All rules files are kept in <a href="'+esc(bc.folder.url)+'" target="_blank" rel="noopener">'+esc(bc.folder.path)+'</a>. Changing a file there changes it for every property that uses it.</div>'
        :'<div class="muted" style="margin-block:8px">'+(S.bcErr?esc(S.bcErr):'Loading the rules folder\u2026')+'</div>')+
      (bc&&bc.files.length?'<label class="fld"><span>Use a rules file already in the folder</span><select data-pe="bodyCorporateRules"><option value="">Choose\u2026</option>'+
        bc.files.map(function(x){ var u=usedBy(x.id); return '<option value="'+esc(x.id)+'"'+(x.id===cur?' selected':'')+'>'+esc(x.name)+(u.length?' \u2014 used by '+esc(u.join(', ')):'')+'</option>'; }).join('')+'</select></label>':'')+
      '<label class="btn sm" style="cursor:pointer">\u2B06 Upload a new PDF<input type="file" accept="application/pdf,.pdf" data-bc-upload style="display:none"></label> <span id="bcBusy" class="small muted"></span></div>';
  }
  return h+cb('bottledGas','Bottled gas (the tenant pays for the gas they use; the landlord pays the bottle hire)');
}
function loadBcFiles(force){
  if(S.bcLoading||(S.bcFiles&&!force)) return;
  S.bcLoading=true; S.bcErr='';
  api.tmBodyCorporateFiles().then(function(r){ S.bcLoading=false; S.bcFiles=r; if(S.pe&&S.cur&&S.cur.view==='propEdit') peBcRedraw(); })
    .catch(function(x){ S.bcLoading=false; S.bcErr='Couldn\u2019t open the rules folder: '+(x&&x.message||x); if(S.pe) peBcRedraw(); });
}
function uploadBc(file){
  if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf') return toast('Upload the rules as a PDF.',4000);
  if(file.size>20*1024*1024) return toast('That file is too large (20 MB at most).',4000);
  var b=$('#bcBusy'); if(b) b.textContent='Uploading '+file.name+'\u2026';
  var rd=new FileReader();
  rd.onload=function(){ api.tmUploadBodyCorporateRules(file.name,String(rd.result).split(',')[1]).then(function(r){ S.bcFiles=r; if(S.pe) S.pe.bodyCorporateRules=r.id; peBcRedraw(); toast('Rules uploaded \u2014 tap Save property'); })
    .catch(function(x){ var b2=$('#bcBusy'); if(b2) b2.textContent=''; toast(x&&x.message||'Couldn\u2019t upload the file',5000); }); };
  rd.readAsDataURL(file);
}
/* Property editor tabs: [id, icon, label] - the menu sits above Save / Cancel */
var PE_TABS=[['details','\uD83C\uDFE0','Property'],['terms','\uD83D\uDCDD','Agreement'],['insure','\uD83D\uDEE1\uFE0F','Insurance'],['hh','\u2668\uFE0F','Healthy homes'],['layout','\uD83D\uDCD0','Layout']];
/* how many things each tab still needs (shown as a badge on the menu) */
function peTabTodo(e){
  return { details:(!String(e.name||'').trim()||propProblem(e)?1:0)+(e.unitTitle&&!e.bodyCorporateRules?1:0),
    terms:(String(e.rentPaymentDetails||'').trim()?0:1)+(roomsProblem(e)?1:0), insure:0, hh:insProblems(e.insulation).length+hhProblems(e.healthyHomes).length,
    layout:e.areas.some(function(a){ return String(a.name||'').trim(); })?0:1 };
}
function peMenu(e){
  var todo=peTabTodo(e);
  return '<div class="tabbar petabs">'+PE_TABS.map(function(t){ return '<button type="button" data-act="pe-tab" data-id="'+t[0]+'" class="'+(S.peTab===t[0]?'on':'')+'"'+(S.peTab===t[0]?' aria-current="page"':'')+'><span class="ic">'+t[1]+'</span>'+esc(t[2]).replace('|','<br>')+
    (todo[t[0]]?'<span class="n" title="'+todo[t[0]]+' to complete">'+todo[t[0]]+'</span>':'')+'</button>'; }).join('')+'</div>';
}
VIEWS.propEdit = function(id){
  var p=id? setupPropById(id) : null; if(id&&!p){ back(); return; }
  if(!S.pe||S.pe._for!==(id||'new')){ S.pe={_for:id||'new'}; PE_FIELDS.forEach(function(k){ S.pe[k]=p&&p[k]!=null?p[k]:''; }); S.peCheck=null; S.peResults=null;
    S.pe.areas=p? clone(p.areas||[]) : buildLayout(2,1,0,['Laundry','Hallway / Entry','Exterior / Grounds'],[]);
    S.pe.chattels=p? (p.chattels||[]).slice() : []; S.pe.rooms=p? clone(p.rooms||[]) : []; S.pe.additionalTerms=p? (p.additionalTerms||[]).slice() : []; S.pe.insulation=insOf(p&&p.insulation); S.pe.healthyHomes=hhOf(p&&p.healthyHomes);
    S.peTab=S.peTabNext||'details'; S.peTabNext=null; }
  if(!PE_TABS.some(function(t){ return t[0]===S.peTab; })) S.peTab='details';
  var e=S.pe, tab=S.peTab, ten=e.tenancy||'', tens=['12 months','6 months','Periodic','Fixed term (other)'];
  setTitle(id?(p.name||p.address1):(e.clonedFrom?'Cloned property':'New property'));
  var h=(e.clonedFrom?'<div class="card small" style="background:var(--brand-soft);border-color:transparent">\u29C9 Exact copy of <b>'+esc(e.clonedFrom)+'</b> \u2014 '+e.areas.length+' areas copied. Adjust anything you need, then <b>Save property</b>.</div>':'');
  var pill=function(n){ return n?'<span class="pill st-warn">'+n+' to complete</span>':'<span class="pill st-done">Complete</span>'; };
  if(tab==='details'){
    h+='<div class="card"><label class="fld"><span>Property name</span><input type="text" data-pe="name" value="'+esc(e.name)+'" placeholder="e.g. Flat 2, 45 George St"></label>'+
      '<div class="grid2"><label class="fld"><span>Street address</span><input type="text" data-pe="address1" value="'+esc(e.address1)+'" placeholder="e.g. 208 Hanover Street"></label>'+
      '<label class="fld"><span>Suburb / city</span><input type="text" data-pe="address2" value="'+esc(e.address2)+'" placeholder="e.g. Dunedin"></label></div>'+
      '<label class="fld"><span>Notes for inspectors (access, keys, alarms\u2026)</span><textarea data-pe="notes">'+esc(e.notes)+'</textarea></label></div>';
    h+='<div class="sasec" style="margin:14px 6px 8px">Letting details</div><div class="card">'+
      '<div class="grid2"><label class="fld"><span>Rent per week ($)</span><input type="number" inputmode="decimal" min="0" data-pe="rent" value="'+esc(e.rent)+'"></label>'+
      '<label class="fld"><span>Bond ($)</span><input type="number" inputmode="decimal" min="0" data-pe="bond" value="'+esc(e.bond)+'"></label></div>'+
      '<div id="peBondHint" class="small muted" style="margin:-6px 0 10px"></div>'+
      '<div class="grid2"><label class="fld"><span>Maximum occupants</span><input type="number" inputmode="numeric" min="1" data-pe="maxOccupants" value="'+esc(e.maxOccupants)+'"></label>'+
      '<label class="fld"><span>Length of tenancy</span><select data-pe="tenancy"><option value="">\u2014</option>'+tens.map(function(t){ return '<option'+(t===ten?' selected':'')+'>'+esc(t)+'</option>'; }).join('')+
        (ten&&tens.indexOf(ten)<0?'<option selected>'+esc(ten)+'</option>':'')+'</select></label></div></div>';
    h+='<div class="card" id="peBc" data-paint>'+bcCardHtml(e)+'</div>';
    if(e.unitTitle) loadBcFiles();
    if(id) h+='<div class="sep"></div><button class="btn block'+(p.active?' danger':'')+'" type="button" data-act="prop-active" data-id="'+esc(id)+'">'+(p.active?'Archive property':'Restore property')+'</button>'+
      '<button class="btn ghost block" type="button" data-act="prop-clone" data-id="'+esc(id)+'" style="margin-block-start:10px">\u29C9 Clone this property</button>';
  }
  else if(tab==='terms'){
    h+='<div class="sasec" style="margin:4px 6px 8px">'+(esignOn()?'Landlord':'Landlord and DocHub template')+'</div><div class="card" id="peAgreement" data-paint>'+peAgreementHtml()+'</div>';
    h+='<div class="row" style="margin:14px 6px 8px;gap:8px"><div class="sasec grow" style="margin:0">Agreement terms'+(esignOn()?'':' (built-in signing)')+'</div>'+pill(String(e.rentPaymentDetails||'').trim()?0:1)+'</div><div class="card">'+
      (esignOn()?'':'<div class="small muted" style="margin-block-end:10px">Written into agreements sent with built-in signing. Not used by DocHub.</div>')+
      '<label class="fld"><span>'+esc(ESIGN_TERMS[0][1])+' (required)</span><textarea data-pe="rentPaymentDetails" rows="2" placeholder="'+esc(ESIGN_TERMS[0][3])+'">'+esc(e.rentPaymentDetails)+'</textarea></label>'+
      chattelsHtml(e.chattels)+
      ESIGN_TERMS.slice(1).map(function(x){ return '<label class="fld"><span>'+esc(x[1])+' (optional)</span><textarea data-pe="'+x[0]+'" rows="2" placeholder="'+esc(x[3])+'">'+esc(e[x[0]])+'</textarea></label>'; }).join('')+
      termsListHtml(e.additionalTerms)+'</div>';
    h+='<div class="sasec" style="margin:14px 6px 8px">Utilities and rooms</div><div class="card" id="peUtil" data-paint>'+utilitiesHtml(e)+'</div>';
  }
  else if(tab==='insure'){
    h+='<div class="sasec" style="margin:4px 6px 8px">Insurance</div><div class="card">'+
      '<div class="grid2"><label class="fld"><span>Insurer</span><input type="text" data-pe="insurer" value="'+esc(e.insurer)+'" placeholder="e.g. AMI, or Not insured"></label>'+
      '<label class="fld"><span>Insurance policy</span><input type="text" data-pe="insurancePolicy" value="'+esc(e.insurancePolicy)+'"></label></div>'+
      '<label class="fld"><span>Insurance excess ($)</span><input type="number" inputmode="decimal" min="0" data-pe="excess" value="'+esc(e.excess)+'"></label></div>';
  }
  else if(tab==='hh'){
    // the insulation statement is part of the healthy homes information, so both are here
    var insMiss=insProblems(e.insulation).length;
    h+=sectStart('pe-ins','Insulation statement',pill(insMiss))+
      '<div class="small muted" style="margin:0 6px 8px">For each part of the house: is it insulated, and if so its type, R-value (or thickness if that isn\u2019t known) and when it was installed. If there\u2019s none, say why for the ceiling and underfloor.</div>'+
      INS_AREAS.map(function(a){ return insAreaHtml(a[0],a[1],e.insulation[a[0]]); }).join('')+
      '<datalist id="insTypes">'+INS_TYPES.map(function(x){ return '<option value="'+esc(x)+'">'; }).join('')+'</datalist>'+
      '<div class="card small">'+   // 3.16.4: no whole-house inspection date; each area has its own
      '<div class="muted" style="margin-block-end:4px">On the agreement:</div><div id="insPreview" style="white-space:pre-line">'+esc(insText(e.insulation))+'</div></div>'+SECT_END;
    h+=sectStart('pe-hh','Healthy homes statement',pill(hhProblems(e.healthyHomes).length))+'<div class="card">'+hhHtml(e.healthyHomes)+
      '<div class="small" style="margin-block-start:12px"><div class="muted" style="margin-block-end:4px">On the agreement:</div><div id="hhPreview" style="white-space:pre-line">'+esc(hhText(e.healthyHomes,e.landlord))+'</div></div></div>'+SECT_END;
  }
  else {
    h+=sectStart('pe-builder','Quick layout builder','')+'<div class="card small"><div class="grid3">'+
      '<label class="fld"><span>Bedrooms</span><input type="number" id="qbBed" min="0" max="12" value="2"></label>'+
      '<label class="fld"><span>Bathrooms</span><input type="number" id="qbBath" min="0" max="6" value="1"></label>'+
      '<label class="fld"><span>Separate toilets</span><input type="number" id="qbWc" min="0" max="4" value="0"></label></div>'+
      '<div class="row wrap" style="gap:14px;margin-block-end:10px">'+['Laundry','Hallway / Entry','Garage','Exterior / Grounds'].map(function(t,i){ return '<label><input type="checkbox" class="qbOpt" value="'+esc(t)+'"'+(i!==2?' checked':'')+'> '+esc(t)+'</label>'; }).join('')+'</div>'+
      '<label class="fld"><span>Special features to inspect (one per line)</span><textarea id="qbSpecial" placeholder="Heat pump&#10;Spa pool&#10;Garden shed"></textarea></label>'+
      '<button class="btn block" type="button" data-act="ed-quick">Generate areas (replaces list below)</button></div>'+SECT_END;
    var nChecks=0; e.areas.forEach(function(a){ nChecks+=(a.items||[]).length; });
    h+=sectStart('pe-areas','Areas & checks','<span class="pill">\uD83D\uDEAA '+e.areas.length+'</span><span class="pill">\u2705 '+nChecks+'</span>');
    e.areas.forEach(function(a,i){
      h+='<div class="editor-area"><div class="row" style="gap:6px"><input type="text" class="grow" data-ea="name" data-i="'+i+'" value="'+esc(a.name)+'" aria-label="Area name">'+
        '<button class="btn sm" type="button" data-act="ed-up" data-id="'+i+'" aria-label="Move up">\u2191</button><button class="btn sm" type="button" data-act="ed-down" data-id="'+i+'" aria-label="Move down">\u2193</button><button class="btn sm danger" type="button" data-act="ed-del" data-id="'+i+'" aria-label="Remove">\u2715</button></div>'+
        '<label class="fld small" style="margin-block-start:8px"><span>Type</span><select data-ea="type" data-i="'+i+'">'+AREA_TYPES.map(function(x){ return '<option'+(x===a.type?' selected':'')+'>'+esc(x)+'</option>'; }).join('')+'</select></label>'+
        '<label class="fld small"><span>Checks (one per line)</span><textarea rows="5" data-ea="items" data-i="'+i+'">'+esc((a.items||[]).join('\n'))+'</textarea></label>'+
        '<label class="fld small" style="margin:0"><span>Guidance note for this area (optional)</span><input type="text" data-ea="notes" data-i="'+i+'" value="'+esc(a.notes||'')+'"></label></div>';
    });
    h+='<div class="row" style="gap:8px"><select id="newAreaType" class="grow">'+AREA_TYPES.map(function(x){ return '<option>'+esc(x)+'</option>'; }).join('')+'</select><button class="btn" type="button" data-act="ed-add">\uFF0B Add area</button></div>'+SECT_END;
  }
  h+='<div id="peErr" class="err" style="margin:0 6px 8px"></div><div style="height:84px"></div>';
  $('#app').innerHTML=h; peHint();
  setFooter('<div class="pefoot">'+peMenu(e)+'<div class="row" style="gap:8px"><button class="btn" type="button" data-act="back">Cancel</button><button class="btn primary" type="button" data-act="prop-save">Save property</button></div></div>');
  markNeeds();   // outline what's still needed
};
/* keep the menu badges in step while typing */
/* ---- Property setup: the boxes still needed get an amber border (the same rules as the "to complete" counts on the tabs) ----
   peNeeds lists them as 'pe:<field>', 'hh:<field>' or 'ins:<area>.<field>'; markNeeds outlines them on screen, and runs again
   after every edit so a box clears as soon as it's filled. */
function peNeeds(e){
  var out=[], h=hhOf(e.healthyHomes), ins=insOf(e.insulation);
  function add(k){ out.push(k); }
  if(!tx(e.name)) add('pe:name');
  if(!tx(e.rentPaymentDetails)) add('pe:rentPaymentDetails');
  INS_AREAS.forEach(function(a){ var k=a[0], x=ins[k], opt=k==='walls', p='ins:'+k+'.';
    if(!x.status){ add(p+'status'); return; }
    if(x.status==='insulated'||x.status==='partial'){
      if(x.status==='partial'&&!tx(x.partialNotes)) add(p+'partialNotes');
      if(!tx(x.type)) add(p+'type');
      if(k==='ceiling'&&tx(x.rValue)===''&&tx(x.thickness)===''){ add(p+'rValue'); add(p+'thickness'); }
      if(k!=='walls'&&!x.installed) add(p+'installed');
      if(x.layers==='2'){ if(!tx(x.type2)) add(p+'type2'); if(tx(x.rValue2)===''&&tx(x.thickness2)===''){ add(p+'rValue2'); add(p+'thickness2'); } if(!x.installed2) add(p+'installed2'); }
      if(k==='ceiling'&&!x.condition) add(p+'condition'); else if(x.condition==='no'&&!tx(x.conditionNotes)) add(p+'conditionNotes');
    } else if((x.status==='none'&&!opt||x.status==='unknown')&&!tx(x.reason)) add(p+'reason'); });
  if(!h.complianceDate) add('hh:complianceDate');
  if(!h.heatingComplies) add('hh:heatingComplies');
  else if(h.heatingComplies==='no'){ if(!tx(h.heatingExemptReason)) add('hh:heatingExemptReason'); }
  else {
    if(!(+h.heatingCapacity>0)) add('hh:heatingCapacity');
    if(!(+h.heatingProvided>0)) add('hh:heatingProvided');
    if(!tx(h.heater1)) add('hh:heater1');
    if(!h.toleranceApplies) add('hh:toleranceApplies');
    else if(h.toleranceApplies==='yes'){ if(!(+h.toleranceKw>0)) add('hh:toleranceKw'); if(!tx(h.toleranceReason)) add('hh:toleranceReason'); }
    else if(+h.heatingProvided>0&&+h.heatingCapacity>0&&+h.heatingProvided<+h.heatingCapacity){ add('hh:heatingProvided'); add('hh:toleranceApplies'); }
  }
  if(!h.ventilation) add('hh:ventilation'); else if(h.ventilation==='partial'&&!tx(h.ventilationNotes)) add('hh:ventilationNotes');
  if(!h.kitchenFan) add('hh:kitchenFan');
  if(!h.bathroomFan) add('hh:bathroomFan');
  if((h.kitchenFan==='none'||h.bathroomFan==='none')&&!tx(h.fanNotes)) add('hh:fanNotes');
  if(!h.gutters) add('hh:gutters'); else if(h.gutters==='no'&&!tx(h.guttersNotes)) add('hh:guttersNotes');
  if(!h.enclosedSubfloor) add('hh:enclosedSubfloor');
  else if(h.enclosedSubfloor==='yes'){ if(!h.groundCover) add('hh:groundCover'); else if(h.groundCover==='no'&&!tx(h.groundCoverReason)) add('hh:groundCoverReason'); }
  if(!h.draughtFree) add('hh:draughtFree'); else if(h.draughtFree==='no'&&!tx(h.draughtNotes)) add('hh:draughtNotes');
  if(!h.openFireplace) add('hh:openFireplace');
  return out;
}
function markNeeds(){
  var app=document.getElementById('app'); if(!app||!S.pe||S.cur.view!=='propEdit') return;
  [].forEach.call(app.querySelectorAll('.need'),function(el){ el.classList.remove('need'); });
  peNeeds(S.pe).forEach(function(n){
    var kind=n.slice(0,n.indexOf(':')), key=n.slice(n.indexOf(':')+1), attr={pe:'data-pe',hh:'data-hh',ins:'data-ins'}[kind];
    var box=app.querySelector('['+attr+'="'+key+'"]');
    if(box){ box.classList.add('need'); return; }
    var seg=app.querySelector('[data-act="'+kind+'-seg"][data-id="'+key+'"]');   // a row of answer buttons: outline the row
    if(seg&&seg.parentNode) seg.parentNode.classList.add('need');
  });
}
function peMenuRefresh(){ var m=document.querySelector('.petabs'); if(m&&S.pe) m.outerHTML=peMenu(S.pe); markNeeds(); }
function peAgreementHtml(){
  var e=S.pe, lls=landlords(), c=S.peCheck, h='<div class="small muted">DocHub template</div>';
  var llSel='<label class="fld"'+(esignOn()?' style="margin:0"':'')+'><span>Default landlord (signs last)</span><select data-pe="landlord"><option value="">Choose when sending</option>'+lls.map(function(l){ return '<option value="'+esc(l.name)+'"'+(l.name===e.landlord?' selected':'')+'>'+esc(l.name)+'</option>'; }).join('')+'</select></label>';
  if(esignOn()) return llSel;   // built-in signing (Setup, Agreement signing): no DocHub template to set up
  h+=e.templateId? '<div class="row" style="align-items:flex-start;gap:8px;margin-block:2px 8px"><div class="grow" style="font-weight:750">'+esc(e.templateTitle||e.templateId)+'</div>'+
      '<button class="btn sm" type="button" data-act="pe-check">\u2713 Check</button><button class="btn sm" type="button" data-act="pe-clear">Remove</button></div>'
    : '<div style="color:var(--bad);font-weight:750;margin-block:2px 8px">None set up yet</div>';
  if(c) h+='<div class="small" style="margin-block-end:10px">'+templateSummary(c)+'</div>';
  h+='<div class="row" style="gap:8px"><input type="text" id="peQ" class="grow" placeholder="Search DocHub templates, e.g. Hanover" value="'+esc(S.peQ!=null?S.peQ:String(e.name||e.address1||'').split(',')[0])+'"><button class="btn sm" type="button" data-act="pe-search">'+(e.templateId?'Change':'Search')+'</button></div>'+
    '<div id="peRes" style="margin-block:8px 12px">'+(S.peResults||'')+'</div>'+
    '<div class="small muted" style="margin-block-end:12px">Templates need signer roles Tenant1\u20135 and Landlord, and the 12 agreement data fields. Edit the template itself in <a target="_blank" rel="noopener" href="https://dochub.com/">DocHub</a>, then tap Check.</div>'+
    llSel;
  return h;
}
/* What a template has: signer roles, the 12 required data fields, optional and tenant fields */
function templateSummary(t){
  var bits=[];
  bits.push(rolesOk(t.roles)?'<span style="color:var(--ok,#0f766e)">\u2713 Signers Tenant1\u20135 and Landlord</span>':'<span style="color:var(--bad)">\u26A0 Needs signer roles Tenant1\u20135 and Landlord (has: '+esc((t.roles||[]).join(', ')||'none')+')</span>');
  bits.push((t.missingKeys||[]).length?'<span style="color:var(--bad)">\u26A0 Missing data field'+(t.missingKeys.length>1?'s':'')+': '+esc(t.missingKeys.join(', '))+'</span>':'<span style="color:var(--ok,#0f766e)">\u2713 All 12 agreement data fields</span>');
  if((t.optionalKeys||[]).length) bits.push('Also fills: '+esc(t.optionalKeys.join(', ')));
  if(t.tenantFields) bits.push(t.tenantFields.length?'Tenant details: '+esc(t.tenantFields.join(', ')):'<span class="muted">No tenant detail fields (Tenant1 Name\u2026), so tenants fill those in themselves</span>');
  return bits.join('<br>');
}
function peHint(){
  var el=$('#peBondHint'); if(!el||!S.pe) return;
  var r=+S.pe.rent||0, p=propProblem(S.pe);
  el.textContent=p&&/bond|rent/i.test(p)?p:(r>0?'Up to 4 weeks\u2019 rent: $'+money2(r*4):'');
  el.style.color=p&&/bond|rent/i.test(p)?'var(--bad)':'';
}
function peSearch(){
  var q=$('#peQ').value; S.peQ=q;
  $('#peRes').innerHTML='<div class="small muted">Searching DocHub\u2026</div>';
  api.tmAgreementSearch(q).then(function(list){
    S.peResults=list.length? list.map(function(t){
      return '<button type="button" class="btn sm" style="display:block;width:100%;text-align:start;margin-block-end:6px'+(t.ok?'':';opacity:.8;cursor:default')+'"'+(t.ok?' data-act="pe-use"':'')+' data-id="'+esc(t.id)+'" data-title="'+esc(t.title)+'">'+esc(t.title)+
        '<div class="small" style="font-weight:500;margin-block-start:4px">'+templateSummary(t)+'</div></button>'; }).join('')
      : '<div class="small muted">No DocHub templates with that in the title.</div>';
    var r=$('#peRes'); if(r) r.innerHTML=S.peResults;
  }).catch(function(err){ var r=$('#peRes'); if(r) r.innerHTML='<div class="err">'+esc(err&&err.message||'Search failed')+'</div>'; });
}
function peRedrawAgreement(){ var b=$('#peAgreement'); if(b) b.innerHTML=peAgreementHtml(); }

var LE_FIELDS=['name','signer','email','phone','mobile','address','notes','signer2Name','signer2Email','signer2Mobile','signer2EmailOnAgreement',
  'brandStyle','brandColour','brandLogo','brandName','brandContact','brandFooter'];
/* Landlord look: Classic (navy, serif, centred letterhead) or Modern (teal, colour bar, left letterhead); colour, logo or initials */
var BRAND_DEFAULT={classic:'#1f3a5f',modern:'#0f766e'};
function brandStyleOf(e){ return e.brandStyle==='modern'?'modern':'classic'; }
function brandColourOf(e){ return /^#[0-9a-f]{6}$/i.test(e.brandColour||'')?e.brandColour.toLowerCase():BRAND_DEFAULT[brandStyleOf(e)]; }
function brandInitials(name){ var w=String(name||'').split(/[\s&]+/).filter(function(x){ return /^[A-Za-z0-9]/.test(x); }),
  k=w.filter(function(x){ return !/^(the|of|and|trust|trustees|ltd|limited|nz)$/i.test(x); }); return ((k.length?k:w).slice(0,2).map(function(x){ return x.charAt(0); }).join('')||'?').toUpperCase(); }
/* a small mock-up of the top of their agreement, updated as they change things */
function brandPreview(e){
  var st=brandStyleOf(e), c=brandColourOf(e), shown=String(e.brandName||'').trim(), name=shown||String(e.name||'').trim(), modern=st==='modern';   // blank: no name at the top (initials still from the landlord)
  var n=parseInt(c.slice(1),16), light=(0.299*(n>>16&255)+0.587*(n>>8&255)+0.114*(n&255))/255>0.62;
  var mark=e.brandLogo?'<img src="'+esc(e.brandLogo)+'" alt="" style="max-height:72px;max-width:270px;vertical-align:middle">':
    '<span style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:'+(modern?'9px':'50%')+';background:'+c+';color:'+(light?'#111':'#fff')+';font:700 17px Arial,sans-serif;letter-spacing:1px">'+esc(brandInitials(name))+'</span>';
  var contact=e.brandContact?'<div style="font-size:11px;color:#555">'+esc(e.brandContact)+'</div>':'';
  var serif=modern?'Arial,Helvetica,sans-serif':'Georgia,Times New Roman,serif';
  var head=modern? '<div style="height:5px;background:'+c+';margin:-2px -2px 10px"></div><div style="display:flex;gap:10px;align-items:center">'+mark+'<div>'+(shown?'<div style="font:700 15px Arial,sans-serif;color:'+c+'">'+esc(shown)+'</div>':'')+contact+'</div></div>'
    : '<div style="text-align:center">'+mark+(shown?'<div style="font:16px '+serif+';color:'+c+';margin-top:4px">'+esc(shown)+'</div>':'')+contact+'<div style="border-top:2px solid '+c+';border-bottom:1px solid '+c+';height:2px;margin-top:8px"></div></div>';
  return '<div style="background:#fff;color:#111;border:1px solid var(--line);border-radius:12px;padding:12px 14px;overflow:hidden">'+head+
    '<div style="font:700 17px '+serif+';margin-top:10px;'+(modern?'':'text-align:center;color:'+c)+'">Residential Tenancy Agreement</div>'+
    '<div style="margin-top:8px;font:'+(modern?'700 13px Arial,sans-serif':'14px '+serif)+';color:'+c+';'+(modern?'border-left:4px solid '+c+';padding:2px 0 2px 7px;background:'+c+'14':'border-bottom:1px solid '+c+';padding-bottom:2px')+'">6. The tenant agrees to</div>'+
    '<div style="font:12px Arial,sans-serif;margin-top:5px"><b style="color:'+c+';display:inline-block;width:28px">6.1</b>pay the rent on time</div>'+
    (e.brandFooter?'<div style="font:11px Arial,sans-serif;color:#555;border-top:1px solid '+c+';margin-top:10px;padding-top:4px">'+esc(e.brandFooter)+'</div>':'')+'</div>';
}
/* a logo picture, shrunk to fit a sheet cell (PNG if small enough, else JPEG on white) */
function leLogo(file){
  if(!/^image\//.test(file.type)) return toast('Choose a picture (PNG or JPEG).',4000);
  var rd=new FileReader();
  rd.onload=function(){ var img=new Image(); img.onload=function(){
    var out='', tries=[[600,200,'png'],[480,160,'png'],[600,200,'jpeg',.88],[480,160,'jpeg',.8],[360,120,'jpeg',.75],[240,80,'jpeg',.7]];
    for(var i=0;i<tries.length&&!out;i++){ var t=tries[i], k=Math.min(1,t[0]/img.width,t[1]/img.height), cv=document.createElement('canvas');
      cv.width=Math.max(1,Math.round(img.width*k)); cv.height=Math.max(1,Math.round(img.height*k)); var cx=cv.getContext('2d');
      if(t[2]==='jpeg'){ cx.fillStyle='#fff'; cx.fillRect(0,0,cv.width,cv.height); }
      cx.drawImage(img,0,0,cv.width,cv.height); var d=cv.toDataURL('image/'+t[2],t[3]); if(d.length<=45000) out=d; }
    if(!out) return toast('That picture is too detailed to use as a logo. Try a simpler one.',5000);
    if(S.le){ S.le.brandLogo=out; keepScroll(render); toast('Logo added \u2014 tap Save landlord'); }
  }; img.onerror=function(){ toast('Couldn\u2019t read that picture.',4000); }; img.src=String(rd.result); };
  rd.readAsDataURL(file);
}
/* ================= Setup: screening questions =================
   The question sets reference checks use (and the red-flag lists shown alongside them). Each set says which kind of
   referee it's for, so the right set opens for a landlord, an employer, family or a friend. Saved to the Screening Sets
   and Screening Questions tabs. Answers already given stay with the words they were given to. */
var QS_USES=[['Landlord','Landlords / property managers'],['Employer','Employers'],['Family','Family'],['Friend','Friends / character']];
function qsClone(sets){ return (sets||[]).map(function(s){ return {id:s.id||'',name:s.name||'',note:s.note||'',kind:s.flags?'Red flags':'Questions',usedFor:(s.usedFor||[]).slice(),items:(s.items||[]).slice()}; }); }
function qsSame(a,b){ return JSON.stringify(a)===JSON.stringify(b); }
function qsDirty(){ var e=S.qsE, sv=S.qsSaved; return !!(e&&sv) && !qsSame(e,sv); }
function qsMarkUnsaved(){ var d=qsDirty(), b=$('#qsSave'), u=$('#qsUnsaved'); if(b) b.disabled=!d; if(u) u.style.display=d?'':'none'; }
VIEWS.setupQuestions = function(){
  setTitle('Screening questions');
  if(!S.qsE){
    $('#app').innerHTML='<div class="card row"><span class="spin"></span><span class="title">Loading\u2026</span></div>';
    return api.tmScreeningQuestions().then(function(r){ S.qsSaved=qsClone(r.sets); S.qsE=qsClone(r.sets); S.qsLegacy=!!r.legacy; S.qsOpen={}; if(S.cur.view==='setupQuestions') render(); });
  }
  var e=S.qsE, open=S.qsOpen||(S.qsOpen={});
  var h='<div class="small muted" style="margin:4px 6px 10px">The questions you ask each referee. A set is picked for each referee from who they are (landlord, employer, family or friend), and you can switch sets on the reference screen. Red-flag lists show beside the questions as things to listen for.</div>';
  if(S.qsLegacy) h+='<div class="card small" style="background:var(--miss-soft)">These came from the older <b>Reference Questions</b> tab. Saving here moves them to two new tabs, <b>Screening Sets</b> and <b>Screening Questions</b>; the old tab is left as it was and is no longer used.</div>';
  e.forEach(function(s,si){
    var isOpen=!!open[si];
    h+='<div class="card" style="padding:0;overflow:hidden">'+
      '<div class="row tap" data-act="qs-toggle" data-id="'+si+'" style="padding:14px 16px;gap:10px"><div class="grow"><div class="title">'+esc(s.name||'(no name yet)')+'</div>'+
        '<div style="margin-block-start:6px"><span class="pill'+(s.kind==='Red flags'?' st-warn':'')+'">'+(s.kind==='Red flags'?'\u26a0 Red flags':s.items.length+' question'+(s.items.length===1?'':'s'))+'</span>'+
        (s.kind==='Red flags'?'<span class="pill">'+s.items.length+' item'+(s.items.length===1?'':'s')+'</span>':(s.usedFor.length?'<span class="pill">For '+esc(s.usedFor.join(', '))+'</span>':'<span class="pill">Not matched to a referee type</span>'))+'</div></div>'+
        '<span class="chev" style="transform:rotate('+(isOpen?90:0)+'deg)">\u203a</span></div>';
    if(isOpen){
      h+='<div style="padding:0 16px 16px">'+
        '<label class="fld"><span>Name</span><input type="text" data-qs-name="'+si+'" value="'+esc(s.name)+'" placeholder="e.g. Previous landlord"></label>'+
        '<div class="fld"><span>Kind</span></div><div class="seg" style="grid-template-columns:1fr 1fr;margin-block:0 12px">'+
          ['Questions','Red flags'].map(function(k){ return '<button type="button" data-act="qs-kind" data-id="'+si+'" data-k="'+k+'" class="'+(s.kind===k?'on':'')+'">'+(k==='Questions'?'Questions to ask':'Red flags to listen for')+'</button>'; }).join('')+'</div>'+
        (s.kind==='Questions'?'<div class="fld"><span>Use this set for</span></div><div class="row wrap" style="gap:6px;margin-block-end:12px">'+
          QS_USES.map(function(u){ var on=s.usedFor.indexOf(u[0])>=0; return '<label class="pill" style="cursor:pointer;padding:6px 10px;'+(on?'background:var(--brand-soft);color:var(--brand)':'')+'"><input type="checkbox" data-qs-use="'+si+'" value="'+u[0]+'"'+(on?' checked':'')+' style="margin-inline-end:6px">'+esc(u[1])+'</label>'; }).join('')+'</div>':'')+
        '<label class="fld"><span>Note shown with the set (optional)</span><input type="text" data-qs-note="'+si+'" value="'+esc(s.note)+'" placeholder="e.g. Ask for the property address first"></label>'+
        '<div class="fld"><span>'+(s.kind==='Red flags'?'Red flags':'Questions')+'</span></div>'+
        s.items.map(function(q,qi){ return '<div class="row" style="gap:6px;margin-block-end:6px;align-items:flex-start"><b style="padding-block-start:12px;min-width:18px">'+(qi+1)+'.</b>'+
          '<textarea class="grow" rows="2" data-qs-q="'+si+':'+qi+'" placeholder="'+(s.kind==='Red flags'?'e.g. Hesitates when asked about rent':'e.g. Were rent payments on time?')+'" aria-label="Question '+(qi+1)+'">'+esc(q)+'</textarea>'+
          '<div style="display:flex;flex-direction:column;gap:4px"><button class="btn sm" type="button" data-act="qs-q-up" data-id="'+si+':'+qi+'" aria-label="Move up"'+(qi?'':' disabled')+'>\u2191</button>'+
          '<button class="btn sm" type="button" data-act="qs-q-down" data-id="'+si+':'+qi+'" aria-label="Move down"'+(qi<s.items.length-1?'':' disabled')+'>\u2193</button></div>'+
          '<button class="btn sm danger" type="button" data-act="qs-q-del" data-id="'+si+':'+qi+'" aria-label="Remove">\u2715</button></div>'; }).join('')+
        '<button class="btn sm" type="button" data-act="qs-q-add" data-id="'+si+'">\uff0b Add '+(s.kind==='Red flags'?'red flag':'question')+'</button>'+
        '<div class="row wrap" style="gap:8px;margin-block-start:14px;padding-block-start:12px;border-block-start:1px solid var(--line)">'+
          '<button class="btn sm" type="button" data-act="qs-set-up" data-id="'+si+'"'+(si?'':' disabled')+'>\u2191 Move set up</button>'+
          '<button class="btn sm" type="button" data-act="qs-set-down" data-id="'+si+'"'+(si<e.length-1?'':' disabled')+'>\u2193 Move set down</button>'+
          '<button class="btn sm danger" type="button" data-act="qs-set-del" data-id="'+si+'">Delete set</button></div>'+
        '</div>';
    }
    h+='</div>';
  });
  if(!e.length) h+='<div class="card small muted">No question sets yet.</div>';
  h+='<button class="btn block dashed" type="button" data-act="qs-set-add">\uff0b Add a question set</button><div id="qsErr" class="err" style="margin:8px 6px"></div>';
  $('#app').innerHTML=h;
  var d=qsDirty();
  setFooter('<div class="row" style="gap:8px;width:100%"><span class="pill st-warn" id="qsUnsaved" style="align-self:center'+(d?'':';display:none')+'">Unsaved</span>'+
    '<button class="btn primary grow" type="button" data-act="qs-save" id="qsSave"'+(d?'':' disabled')+'>Save questions</button></div>');
};
/* Setup > Notifications (Rentals app only: the panel comes from ../push.js) */
VIEWS.notify = function(){
  setTitle('Notifications'); setFooter('');
  $('#app').innerHTML='<div id="rpNotify" data-paint></div>';
  if(window.RentalsPush) window.RentalsPush.mount($('#rpNotify'));
};
VIEWS.setupTerms = function(){
  setTitle('Additional terms');
  if(!S.tmE) S.tmE=termsMaster().slice();
  var e=S.tmE, saved=sameTerms(e,termsMaster()), act=setupProps().filter(function(p){ return p.active; });
  var h='<div class="small muted" style="margin:4px 6px 10px">The master list of additional terms. Each term becomes its own numbered item in section 8 of the agreement. Properties keep their own copy, so you can still change a property\u2019s terms in its settings \u2014 copy the master list across when it changes.</div>'+
    '<div class="card">'+e.map(function(c,i){ return '<div class="row" style="gap:6px;margin-block-end:6px;align-items:flex-start"><b style="padding-block-start:12px;min-width:18px">'+(i+1)+'.</b>'+
      '<textarea class="grow" rows="2" data-tm-at="'+i+'" placeholder="e.g. The tenant will mow the lawns fortnightly" aria-label="Term '+(i+1)+'">'+esc(c)+'</textarea>'+
      '<div style="display:flex;flex-direction:column;gap:4px"><button class="btn sm" type="button" data-act="tm-up" data-id="'+i+'" aria-label="Move up"'+(i?'':' disabled')+'>\u2191</button>'+
      '<button class="btn sm" type="button" data-act="tm-down" data-id="'+i+'" aria-label="Move down"'+(i<e.length-1?'':' disabled')+'>\u2193</button></div>'+
      '<button class="btn sm danger" type="button" data-act="tm-del" data-id="'+i+'" aria-label="Remove">\u2715</button></div>'; }).join('')+
    (e.length?'':'<div class="small muted" style="margin-block-end:10px">No terms yet.</div>')+
    '<button class="btn sm" type="button" data-act="tm-add">\uFF0B Add term</button></div>'+
    '<div class="card"><div class="sasec" style="margin-block-end:8px">Properties</div>'+
    (act.length? act.map(function(p){ var pt=cleanTerms(p.additionalTerms), same=sameTerms(pt,termsMaster());
      return '<div class="row" style="padding-block:6px;border-block-end:1px solid var(--line)"><span class="grow">'+esc(p.name||p.address1)+'</span>'+
        (same?'<span class="pill st-done">Matches</span>':!pt.length?'<span class="pill st-warn">No terms</span>':'<span class="pill st-warn">Differs \u00B7 '+pt.length+' term'+(pt.length>1?'s':'')+'</span>')+'</div>'; }).join('')
      : '<div class="small muted">No active properties.</div>')+
    '<div class="small muted" style="margin-block-start:8px">Compared with the saved master list.</div></div>'+
    '<div id="tmErr" class="err" style="margin:0 6px 8px"></div>';
  $('#app').innerHTML=h;
  setFooter('<div class="row" style="gap:8px;width:100%"><span class="pill st-warn" id="tmUnsaved" style="align-self:center'+(saved?';display:none':'')+'">Unsaved</span>'+
    '<button class="btn grow" type="button" data-act="tm-copy"'+(act.length?'':' disabled')+'>\u21BB Copy to properties\u2026</button>'+
    '<button class="btn primary grow" type="button" data-act="tm-save" id="tmSave"'+(saved?' disabled':'')+'>Save list</button></div>');
};
/* Copy the master list to properties: replace their terms, or only add the ones they're missing */
function copyTermsDialog(){
  var master=cleanTerms(S.tmE), act=setupProps().filter(function(p){ return p.active; }), mode='replace';
  var m=modal('<div class="title" style="font-size:1.1rem">Copy terms to properties</div>'+
    '<div class="small muted" style="margin-block-end:12px">'+master.length+' term'+(master.length===1?'':'s')+' in the master list'+(sameTerms(S.tmE,termsMaster())?'':' (your changes are saved first)')+'. Agreements already sent don\u2019t change.</div>'+
    '<div class="seg" style="grid-template-columns:1fr 1fr;margin-block:0 6px"><button class="on" type="button" data-cm="replace">Replace</button><button type="button" data-cm="add">Add missing only</button></div>'+
    '<div class="small muted" id="cmHint" style="margin-block-end:12px"></div>'+
    '<div id="cmList"></div>'+
    '<div id="cmErr" class="err"></div>'+
    '<div class="row" style="justify-content:flex-end;gap:8px;margin-block-start:10px"><button class="btn" type="button" data-cm="cancel">Cancel</button><button class="btn primary" type="button" data-cm="go">Copy</button></div>');
  var pick={}; act.forEach(function(p){ pick[p.propertyId]=true; });
  function draw(){
    $('#cmHint',m).textContent=mode==='add'? 'Each property keeps its own terms, and master terms it doesn\u2019t have yet are added on the end.' : 'Each property\u2019s terms become exactly the master list. Terms only that property had are removed.';
    var n=0;
    $('#cmList',m).innerHTML=act.map(function(p){ var after=termsAfterCopy(p.additionalTerms,master,mode), ch=!sameTerms(after,p.additionalTerms); if(ch&&pick[p.propertyId]) n++;
      var lost=mode==='add'?0:cleanTerms(p.additionalTerms).filter(function(x){ return !master.some(function(y){ return y.toLowerCase()===x.toLowerCase(); }); }).length;
      return '<label class="row" style="gap:10px;padding-block:7px;border-block-end:1px solid var(--line);cursor:pointer"><input type="checkbox" data-cp="'+esc(p.propertyId)+'"'+(pick[p.propertyId]?' checked':'')+' style="width:20px;height:20px">'+
        '<span class="grow">'+esc(p.name||p.address1)+(lost?'<br><span class="small" style="color:var(--miss)">'+lost+' term'+(lost>1?'s':'')+' only this property has will be removed</span>':'')+'</span>'+
        (ch?'<span class="pill st-warn">Will change</span>':'<span class="pill st-done">Up to date</span>')+'</label>'; }).join('');
    var go=$('[data-cm=go]',m); go.textContent=n?'Copy to '+n+' propert'+(n>1?'ies':'y'):'Nothing to change'; go.disabled=!n;
  }
  draw();
  m.addEventListener('change',function(ev){ var c=ev.target.getAttribute&&ev.target.getAttribute('data-cp'); if(c!=null){ pick[c]=ev.target.checked; draw(); } });
  m.addEventListener('click',function(ev){ var b=ev.target.closest('[data-cm]'); if(!b) return; var k=b.getAttribute('data-cm');
    if(k==='cancel'){ m.remove(); return; }
    if(k==='replace'||k==='add'){ mode=k; [].forEach.call(m.querySelectorAll('.seg [data-cm]'),function(x){ x.classList.toggle('on',x===b); }); draw(); return; }
    if(k==='go'){ var ids=act.filter(function(p){ return pick[p.propertyId]; }).map(function(p){ return p.propertyId; });
      busy(b,'Copying',api.tmCopyTermsToProperties(ids,mode,S.tmE)).then(function(st){ apply(st); S.tmE=termsMaster().slice(); m.remove();
        toast(st.termsCopied?'Terms copied to '+st.termsCopied+' propert'+(st.termsCopied>1?'ies':'y'):'Everything was already up to date'); render(); })
        .catch(function(x){ $('#cmErr',m).textContent=x&&x.message||'Couldn\u2019t copy the terms'; }); }
  });
}
VIEWS.landlordEdit = function(name){
  var l=name? landlords().find(function(x){ return x.name===name; }) : null; if(name&&!l){ back(); return; }
  if(!S.le||S.le._for!==(name||'new')){ S.le={_for:name||'new'}; LE_FIELDS.forEach(function(k){ S.le[k]=l&&l[k]!=null?l[k]:''; }); }
  var e=S.le, uses=name? setupProps().filter(function(p){ return p.landlord===name; }) : [];
  setTitle(name||'New landlord');
  var h='<div class="card"><label class="fld"><span>Landlord</span><input type="text" data-le="name" value="'+esc(e.name)+'" placeholder="e.g. Les and Jennifer Box"></label>'+
    '<label class="fld"><span>Signer name (as it appears on the agreement)</span><input type="text" data-le="signer" value="'+esc(e.signer)+'" placeholder="Same as above if blank"></label>'+
    '<label class="fld"><span>Email (DocHub sends the agreement here)</span><input type="email" data-le="email" autocapitalize="off" value="'+esc(e.email)+'"></label>'+
    '<div class="grid2"><label class="fld"><span>Phone</span><input type="tel" data-le="phone" value="'+esc(e.phone)+'"></label>'+
    '<label class="fld"><span>Mobile</span><input type="tel" data-le="mobile" value="'+esc(e.mobile)+'"></label></div>'+
    '<label class="fld"><span>Address for service</span><textarea data-le="address" rows="2" placeholder="Physical address in New Zealand">'+esc(e.address)+'</textarea></label>'+
    '<label class="fld"><span>Notes</span><textarea data-le="notes">'+esc(e.notes)+'</textarea></label></div>'+
    '<div class="card"><div class="sasec" style="margin-block-end:4px">Second signer (optional)</div><div class="small muted" style="margin-block-end:10px">Built-in signing can have two people sign for the landlord, one after the other. DocHub uses the first signer only.</div>'+
    '<label class="fld"><span>Name</span><input type="text" data-le="signer2Name" value="'+esc(e.signer2Name)+'"></label>'+
    '<div class="grid2"><label class="fld"><span>Email</span><input type="email" data-le="signer2Email" autocapitalize="off" value="'+esc(e.signer2Email)+'"></label>'+
    '<label class="fld"><span>Mobile</span><input type="tel" data-le="signer2Mobile" value="'+esc(e.signer2Mobile)+'"></label></div>'+
    '<label class="row" style="gap:10px;cursor:pointer;align-items:flex-start"><input type="checkbox" data-le-cb="signer2EmailOnAgreement"'+(e.signer2EmailOnAgreement?' checked':'')+' style="width:22px;height:22px;flex:none">'+
      '<span>Show their email on the tenancy agreement<br><span class="small muted">Ticked: it is listed as an address for service, so notices can be emailed to them. Unticked: only their name and mobile are shown. Either way their signing link and code are still emailed to them.</span></span></label></div>'+
    '<div class="card"><div class="sasec" style="margin-block-end:4px">How their agreements look</div><div class="small muted" style="margin-block-end:10px">Built-in agreements, signing emails and bond receipts for this landlord. Agreements already sent keep the look they were sent with.</div>'+
    '<div class="seg" style="grid-template-columns:1fr 1fr;margin-block:0 10px"><button type="button" data-act="le-style" data-id="classic"'+(brandStyleOf(e)==='classic'?' class="on"':'')+'>Classic</button><button type="button" data-act="le-style" data-id="modern"'+(brandStyleOf(e)==='modern'?' class="on"':'')+'>Modern</button></div>'+
    '<div id="leBrandPrev">'+brandPreview(e)+'</div>'+
    '<div class="row" style="gap:10px;align-items:center;margin-block:12px 6px"><input type="color" data-le="brandColour" value="'+brandColourOf(e)+'" aria-label="Colour" style="width:52px;height:40px;padding:0;border:1px solid var(--line);border-radius:8px;background:none;flex:none">'+
      '<span class="grow small">Colour<br><span class="muted">'+(e.brandColour?'Chosen':'Default for '+(brandStyleOf(e)==='modern'?'Modern (teal)':'Classic (navy)'))+'</span></span>'+
      (e.brandColour?'<button class="btn sm" type="button" data-act="le-colour-reset">Use default</button>':'')+'</div>'+
    '<div class="row" style="gap:10px;align-items:center;margin-block:6px 10px"><span class="grow small">Logo<br><span class="muted">'+(e.brandLogo?'Shown at the top':'None \u2014 their initials are shown in a badge')+'</span></span>'+
      '<label class="btn sm" style="cursor:pointer">'+(e.brandLogo?'Change':'\u2B06 Upload')+'<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-le-logo style="display:none"></label>'+
      (e.brandLogo?'<button class="btn sm danger" type="button" data-act="le-logo-remove">Remove</button>':'')+'</div>'+
    '<label class="fld"><span>Name at the top (optional)</span><input type="text" data-le="brandName" maxlength="80" value="'+esc(e.brandName)+'" placeholder="Blank = no name shown"></label>'+
    '<label class="fld"><span>Contact line (optional)</span><input type="text" data-le="brandContact" maxlength="160" value="'+esc(e.brandContact)+'" placeholder="e.g. 021 123 4567 \u00B7 rentals@example.com"></label>'+
    '<label class="fld"><span>Footer note (optional)</span><textarea data-le="brandFooter" rows="2" maxlength="300" placeholder="e.g. Thank you for renting with us.">'+esc(e.brandFooter)+'</textarea></label></div>'+
    (uses.length?'<div class="small muted" style="margin:0 8px 10px">Default landlord for '+esc(uses.map(function(p){ return p.name||p.address1; }).join(', '))+'.</div>':'')+
    '<div id="leErr" class="err" style="margin:0 6px 8px"></div><div class="row" style="gap:8px;margin:0 6px">'+
    (name?'<button class="btn danger grow" type="button" data-act="landlord-delete" data-id="'+esc(name)+'">Delete</button>':'')+
    '<button class="btn primary grow" type="button" data-act="landlord-save">Save landlord</button></div>';
  $('#app').innerHTML=h;
};

/* ================= Tenancies ================= */
function tenancies(){ return (S.st&&S.st.tenancies)||[]; }
/* Tenant details: everything on file about one tenant - their tenancy entry and their submitted application, all editable */
VIEWS.person = personView;
VIEWS.tenantProfile = function(arg){
  var parts=String(arg).split('|'), tid=parts[0], idx=+parts[1];
  var t=tenancyById(tid), p=t&&(t.tenants||[])[idx]; if(!p){ back(); return; }
  setTitle(p.name||'Tenant');
  if(!S.tp||S.tp.key!==arg){
    S.tp={key:arg,loading:true,data:null,ten:null,ans:{}};
    api.tmTenantProfile(tid,idx).then(function(r){ if(!S.tp||S.tp.key!==arg) return; S.tp.loading=false; S.tp.data=r; S.tp.ten=clone(r.tenant); if(S.cur.view==='tenantProfile') render(); })
      .catch(function(x){ if(!S.tp||S.tp.key!==arg) return; S.tp.loading=false; S.tp.err=x&&x.message||String(x); if(S.cur.view==='tenantProfile') render(); });
  }
  var tp=S.tp;
  if(tp.loading){ $('#app').innerHTML='<div class="card small muted">Loading '+esc(String(p.name||'').split(' ')[0])+'\u2019s details\u2026</div>'; setFooter('<button class="btn" type="button" data-act="back">Back</button>'); return; }
  if(tp.err){ $('#app').innerHTML='<div class="card err">Couldn\u2019t load the details: '+esc(tp.err)+'</div>'; setFooter('<button class="btn" type="button" data-act="back">Back</button>'); return; }
  var d=tp.data, e=tp.ten, ans=Object.assign({},d.answers||{},tp.ans), first=String(e.name||p.name||'').split(' ')[0];
  var fld=function(label,k,type){ return '<label class="fld"><span>'+esc(label)+'</span><input type="'+(type||'text')+'" data-tp="'+k+'" value="'+esc(e[k]||'')+'"></label>'; };
  var h=(d.personId&&personById(d.personId)?'<div class="row" style="gap:8px;margin:0 6px 10px;align-items:center">'+personPill(personById(d.personId).status)+'<button class="btn sm" type="button" data-act="person" data-id="'+esc(d.personId)+'">\uD83E\uDDD1 Full person record and history</button></div>':'')+
    '<div class="sasec" style="margin:4px 6px 8px">On this tenancy</div><div class="card">'+
    '<div class="small muted" style="margin-block-end:10px">Used for Bond Hub, notices and the tenancy record.</div>'+
    fld('Full legal name','name')+'<div class="grid2">'+fld('Email','email','email')+fld('Mobile','mobile','tel')+'</div>'+
    '<div class="grid2">'+fld('Date of birth','dob','date')+fld('Moved in','moveIn','date')+'</div>'+
    '<label class="fld"><span>Address for service</span><textarea data-tp="addressForService" rows="2">'+esc(e.addressForService||'')+'</textarea></label>'+
    (e.idType||e.idNumber?'<div class="small muted">ID: '+esc([e.idType,e.idNumber].filter(Boolean).join(' '))+'</div>':'')+'</div>';
  if(!d.meta){
    h+='<div class="card small muted">'+(p.ref?'There\u2019s no submitted online application on file for '+esc(first)+'.':'Added by hand, so there\u2019s no application on file.')+
      (d.app?' <button class="btn sm" type="button" data-act="app" data-id="'+esc(d.app.ref)+'">Open application</button>':'')+'</div>';
  } else {
    h+='<div class="sasec" style="margin:14px 6px 8px">From their application</div><div class="card small">'+
      'Submitted '+esc(fmtDate(d.meta.submittedAt))+(d.meta.signedName?' \u00B7 signed by '+esc(d.meta.signedName):'')+' \u00B7 '+(d.meta.formType==='Tenancy Services'?'Tenancy Services pre-tenancy form':'Full application')+
      '<div class="row wrap" style="gap:8px;margin-block-start:8px">'+(d.meta.signedPdf?'<a class="btn sm" target="_blank" rel="noopener" href="'+esc(d.meta.signedPdf)+'">\uD83D\uDCC4 Signed application</a>':'')+
        (d.meta.uploadsFolder?'<a class="btn sm" target="_blank" rel="noopener" href="'+esc(d.meta.uploadsFolder)+'">\uD83D\uDCC1 Uploaded files</a>':'')+
        (d.app?'<button class="btn sm" type="button" data-act="app" data-id="'+esc(d.app.ref)+'">References &amp; decision</button>':'')+'</div>'+
      '<div class="muted" style="margin-block-start:8px">Changes here update their saved answers. The signed application PDF stays as they submitted it.</div></div>';
    (d.sections||[]).forEach(function(sec){
      var rows=sec.fields.filter(function(f){ return tpShown(f,ans); });
      if(!rows.length) return;
      h+=sectStart('tp-'+sec.title.replace(/\W+/g,'-').toLowerCase(),sec.title,'')+'<div class="card">'+rows.map(function(f){ return tpField(f,ans[f.k]); }).join('')+'</div>'+SECT_END;
    });
  }
  h+='<div id="tpErr" class="err" style="margin:0 6px 8px"></div>';
  $('#app').innerHTML=h;
  setFooter('<button class="btn" type="button" data-act="back">Back</button><button class="btn primary" type="button" data-act="tp-save" id="tpSave"'+(tpDirty()?'':' disabled')+'>Save changes</button>');
};
/* show a question if it has an answer, or if it applies (its "only when" answer matches) */
function tpShown(f,ans){
  if(String(ans[f.k]==null?'':ans[f.k]).trim()) return true;
  if(f.t==='upload') return false;
  if(!f['if']) return true;
  var w=String(ans[f['if'][0]]||''); return f['if'][1]==='*'? !!w.trim() : w===f['if'][1];
}
function tpField(f,v){
  v=v==null?'':String(v);
  var lab='<span>'+esc(f.l)+(f.group?' <span class="muted">('+esc(f.group)+')</span>':'')+'</span>', at=' data-tpa="'+esc(f.k)+'"';
  if(f.t==='upload'){   // TM 3.17.2: the files themselves, opening in the app's viewer (else just the names)
    var fg=((S.tp&&S.tp.data&&S.tp.data.files)||[]).filter(function(g){ return g.k===f.k; })[0];
    return '<div class="fld">'+lab+'<div class="small" style="padding-block:4px 8px">'+(fg?suppliedFilesHtml([{label:'',files:fg.files}]).replace(/^<div class="small muted"[^>]*><\/div>/,''):v?esc(v):'<span class="muted">None</span>')+'</div></div>'; }
  if(f.t==='yesno'||f.t==='choice'){ var opts=f.t==='yesno'?['Yes','No']:(f.o||[]).slice(); if(v&&opts.indexOf(v)<0) opts.push(v);
    return '<label class="fld">'+lab+'<select'+at+'><option value=""></option>'+opts.map(function(o){ return '<option'+(o===v?' selected':'')+'>'+esc(o)+'</option>'; }).join('')+'</select></label>'; }
  if(f.t==='textarea'||v.length>80) return '<label class="fld">'+lab+'<textarea rows="2"'+at+'>'+esc(v)+'</textarea></label>';
  var type=f.t==='date'&&(!v||/^\d{4}-\d{2}-\d{2}$/.test(v))?'date':f.t==='email'?'email':f.t==='tel'?'tel':'text';
  return '<label class="fld">'+lab+'<input type="'+type+'"'+at+' value="'+esc(v)+'"'+(f.t==='money'||f.t==='number'?' inputmode="decimal"':'')+'></label>';
}
function tpDirty(){
  var tp=S.tp; if(!tp||!tp.data) return false;
  return ['name','email','mobile','dob','moveIn','addressForService'].some(function(k){ return String(tp.data.tenant[k]||'')!==String(tp.ten[k]||''); }) ||
    Object.keys(tp.ans).some(function(k){ return String(tp.ans[k])!==String((tp.data.answers||{})[k]||''); });
}
function tenancyById(id){ return tenancies().find(function(t){ return t.id===id; }); }
/* current, upcoming (starts in the future) or ended */
function tenancyPhase(t){ return t.status==='Ended'?'ended':(t.start&&t.start>todayYmd()?'upcoming':'current'); }
function ymdLabel(ymd){ if(!ymd) return ''; var p=String(ymd).split('-').map(Number); var d=new Date(p[0],p[1]-1,p[2]); return isNaN(d)?ymd:d.toLocaleDateString('en-NZ',{day:'numeric',month:'short',year:'numeric'}); }
function tenancyNames(t){ return nameList((t.tenants||[]).map(whoText)) || 'No tenants'; }
function tenancyDates(t){ return (t.start?'From '+ymdLabel(t.start):'')+(t.end?' to '+ymdLabel(t.end):' \u00B7 periodic'); }
/* Tenancies at a property for a room (or the whole property, room '') whose dates overlap start..end */
function roomTaken(propertyId,room,start,end){
  return tenancies().filter(function(t){
    if(t.propertyId!==propertyId||tenancyPhase(t)==='ended') return false;
    if(room&&t.room&&t.room!==room) return false;          // a different room
    if(!start) return true;
    return (!t.end||t.end>=start)&&(!end||!t.start||t.start<=end);
  });
}
function tenancyPropLabel(t){ var p=setupPropById(t.propertyId); return p? (p.name||p.address1) : (t.property||'Unknown property'); }
function tenancyFlags(t){
  var f='';
  if(t.status!=='Ended'&&t.end&&t.end<todayYmd()) f+='<span class="pill st-warn">Fixed term ended '+esc(ymdLabel(t.end))+'</span>';
  var noDob=(t.tenants||[]).filter(function(p){ return !p.dob; }).map(function(p){ return String(p.name||'').trim().split(/\s+/)[0]||'a tenant'; });
  if(noDob.length) f+='<span class="pill st-warn" title="Bond Hub asks for each tenant\u2019s date of birth. Add it with Edit tenancy.">Tenant date of birth missing: '+esc(nameList(noDob))+'</span>';
  return f;
}
var T_FILTERS=[['current','Current'],['upcoming','Upcoming'],['ended','Ended']];
function tenanciesHome(){
  setTitle('Tenancies');
  var f=S.tfilter||'current', all=tenancies(), count={current:0,upcoming:0,ended:0};
  all.forEach(function(t){ count[tenancyPhase(t)]++; });
  var list=all.filter(function(t){ return tenancyPhase(t)===f; }).sort(function(a,b){ return (b.start||'').localeCompare(a.start||''); });
  var h='<div class="row" style="margin:6px 6px 10px"><h2 class="grow" style="margin:0">Tenancies</h2><button class="btn sm primary" type="button" data-act="tenancy-new">\uFF0B Add tenancy</button></div>'+
    '<div class="filters">'+T_FILTERS.map(function(x){ return '<button type="button" data-act="tfilter" data-id="'+x[0]+'" class="'+(f===x[0]?'on':'')+'">'+x[1]+' <span class="fcount">'+count[x[0]]+'</span></button>'; }).join('')+'</div>';
  var by={}, props=[];
  list.forEach(function(t){ var p=tenancyPropLabel(t); if(!by[p]){ by[p]=[]; props.push(p); } by[p].push(t); });
  props.forEach(function(p){ h+=sectStart('tp-'+sectKey(p),p,countPill(by[p].length,'tenancy','tenancies')); by[p].forEach(function(t){ h+=tenancyCard(t); }); h+=SECT_END; });
  if(!list.length) h+='<div class="card empty small">'+(all.length?'No '+f+' tenancies.':'No tenancies yet. One is created when everyone signs a tenancy agreement, or tap \uFF0B New to add a tenancy you already have.')+'</div>';
  $('#app').innerHTML=h+versionLine();
  setFooter(tabBar());
}
function tenancyCard(t){
  return '<div class="card tap" data-act="tenancy" data-id="'+esc(t.id)+'"><div class="ghead"><div class="title">'+((t.tenants||[]).length>1?'\uD83D\uDC65 ':'\uD83C\uDFE0 ')+esc(tenancyNames(t))+'</div><span class="chev">\u203A</span></div>'+
    '<div class="small muted">'+(t.room?'<b>'+esc(t.room)+'</b> \u00B7 ':'')+esc(tenancyDates(t))+(t.rent!==''?' \u00B7 '+esc(money(t.rent)):'')+(t.bond!==''&&t.bond!=null?' \u00B7 bond $'+esc(money2(t.bond)):'')+'</div>'+
    '<div>'+bondPill(t)+tenancyFlags(t)+'</div></div>';
}
VIEWS.tenancy = function(id){
  var t=tenancyById(id); if(!t){ back(); return; }
  var ph=tenancyPhase(t), pp=setupPropById(t.propertyId), lead=t.groupKey? groupLead(t.groupKey) : null, pdf=t.pdf||(lead&&lead.agreement&&lead.agreement.pdf)||'';
  setTitle(tenancyNames(t));
  var h='<div class="card"><div class="row" style="align-items:flex-start"><div class="grow"><div class="title">'+(t.room?esc(t.room)+', ':'')+esc(pp?[pp.address1,pp.address2].filter(Boolean).join(', '):t.property)+'</div>'+
    '<div class="small muted">'+esc(tenancyDates(t))+'</div></div>'+
    '<span class="pill '+(ph==='current'?'st-done':ph==='upcoming'?'st-sent':'')+'">'+{current:'Current',upcoming:'Upcoming',ended:'Ended'}[ph]+'</span></div>'+
    '<div class="timeline" style="grid-template-columns:repeat(3,1fr)"><div class="on"><b>'+esc(t.rent!==''?'$'+money2(t.rent):'\u2013')+'</b>per week</div>'+
    '<div class="on"><b>'+esc(t.bond!==''&&t.bond!=null?'$'+money2(t.bond):'\u2013')+'</b>bond</div><div class="on"><b>'+(t.tenants||[]).length+'</b>'+((t.tenants||[]).length===1?'tenant':'tenants')+'</div></div>'+
    (tenancyFlags(t)?'<div>'+tenancyFlags(t)+'</div>':'')+
    (t.landlord?'<div class="small muted" style="margin-block-start:8px">Landlord: '+esc(t.landlord)+'</div>':'')+'</div>';
  h+=sectStart('t-bond','Bond',bondPill(t))+bondSection(t)+SECT_END;
  if((t.bondTasks||[]).length){ var openT=(t.bondTasks||[]).filter(function(k){ return k.status!=='Done'; }).length; h+=sectStart('t-bondhub','Bond Hub tasks',openT?'<span class="pill st-warn">'+openT+' to do</span>':'<span class="pill st-done">All done</span>')+bondTasksHtml(t)+SECT_END; }
  h+=sectStart('t-tenants','Tenants',countPill((t.tenants||[]).length,'tenant'))+'<div class="card">'+(t.tenants||[]).map(function(p,i){
    return '<div class="member"'+(i?'':' style="border-block-start:0"')+'><div class="grow"><div style="font-weight:750">'+whoHtml(p)+'</div>'+
      '<div class="contact-line small">'+(p.mobile?'<a target="_blank" rel="noopener" href="'+esc(telHref(p.mobile))+'">\uD83D\uDCF1 '+esc(p.mobile)+'</a>':'')+(p.email?'<a target="_blank" rel="noopener" href="mailto:'+esc(p.email)+'">\u2709 '+esc(p.email)+'</a>':'')+'</div>'+
      '<div class="small muted">'+(p.dob?'Born '+esc(ymdLabel(p.dob)):'<span style="color:var(--miss)">Date of birth not recorded</span>')+(p.moveIn?' \u00B7 moved in '+esc(ymdLabel(p.moveIn)):'')+'</div>'+
      (p.addressForService?'<div class="small muted">Address for service: '+esc(p.addressForService)+'</div>':'')+'</div>'+
      '<button class="btn sm" type="button" data-act="tenant-profile" data-id="'+esc(t.id+'|'+i)+'">\uD83D\uDC64 Details</button></div>'; }).join('')+
    ((t.formerTenants||[]).length?'<div class="sep"></div><div class="small muted" style="margin-block-end:4px">Former tenants</div>'+t.formerTenants.map(function(p){ return '<div class="small">'+whoHtml(p)+' <span class="muted">\u00B7 moved in '+esc(ymdLabel(p.moveIn))+' \u00B7 moved out '+esc(ymdLabel(p.moveOut))+'</span></div>'; }).join(''):'')+'</div>'+SECT_END;
  if(t.agreementProvider==='esign'&&t.requestId) h+=sectStart('t-change','Change of tenants',t.pendingChange&&t.pendingChange.status==='Sent'?'<span class="pill st-warn">Out for signing</span>':'')+tenancyEsignSection(t)+SECT_END;
  h+=sectStart('t-agreement','Tenancy agreement',pdf?'<span class="pill st-done">Signed</span>':'')+'<div class="card"><div class="row wrap" style="gap:8px">'+
    (pdf?'<a class="btn sm primary" target="_blank" rel="noopener" href="'+esc(pdf)+'">\uD83D\uDCC4 Signed agreement</a>':'<span class="small muted">No signed agreement linked'+(t.groupKey?' yet \u2014 open the group and tap Check status.':' (added by hand).')+'</span>')+
    (lead?'<button class="btn sm" type="button" data-act="group" data-id="'+esc(t.groupKey)+'">Applicant group</button>':'')+'</div></div>'+SECT_END;
  if(t.notes) h+=sectionHtml('t-notes','Notes','','<div class="card small" style="white-space:pre-wrap">'+esc(t.notes)+'</div>');
  h+='<div class="small muted" style="margin:6px 8px 12px">'+(t.createdAt?'Added '+esc(fmtDate(t.createdAt))+(t.createdBy?' by '+esc(t.createdBy):''):'')+'</div>'+
    '<div class="row" style="gap:8px;margin:0 6px"><button class="btn danger grow" type="button" data-act="tenancy-delete" data-id="'+esc(id)+'">Delete</button>'+
    '<button class="btn primary grow" type="button" data-act="tenancy-edit" data-id="'+esc(id)+'">\u270F\uFE0F Edit</button></div>';
  $('#app').innerHTML=h;
};
function blankTenant(start){ return {ref:'',name:'',email:'',mobile:'',dob:'',moveIn:start||''}; }
VIEWS.tenancyForm = function(id){
  var t=id? tenancyById(id) : null; if(id&&!t){ back(); return; }
  if(!S.tf||S.tf._for!==(id||'new')){
    S.tf=t? clone(t) : {id:'',propertyId:'',room:'',status:'Current',start:'',end:'',rent:'',bond:'',landlord:'',notes:'',tenants:[blankTenant('')]};
    S.tf._for=id||'new'; if(!S.tf.tenants.length) S.tf.tenants.push(blankTenant(S.tf.start));
  }
  var e=S.tf, ps=setupProps().filter(function(p){ return p.active||p.propertyId===e.propertyId; });
  setTitle(id?'Edit tenancy':'New tenancy');
  var h='<div class="card"><label class="fld"><span>Property</span><select data-tf="propertyId"><option value="">Choose\u2026</option>'+ps.map(function(p){ return '<option value="'+esc(p.propertyId)+'"'+(p.propertyId===e.propertyId?' selected':'')+'>'+esc(p.name||p.address1)+'</option>'; }).join('')+'</select></label>'+
    (function(){ var tp=setupPropById(e.propertyId), rs=(tp&&tp.rooms)||[]; if(!rs.length&&!e.room) return '';
      return '<label class="fld"><span>Room</span><select data-tf="room"><option value="">Whole property</option>'+rs.map(function(r){ return '<option'+(r.name===e.room?' selected':'')+'>'+esc(r.name)+'</option>'; }).join('')+
        (e.room&&!rs.some(function(r){ return r.name===e.room; })?'<option selected>'+esc(e.room)+'</option>':'')+'</select></label>'; })()+
    (id?'<div class="seg" style="margin-block-end:12px">'+['Current','Ended'].map(function(s){ return '<button type="button" data-act="tf-status" data-id="'+s+'" class="'+(e.status===s?'on':'')+'">'+s+'</button>'; }).join('')+'</div>':'')+
    '<div class="grid2"><label class="fld"><span>Start date</span><input type="date" data-tf="start" value="'+esc(e.start)+'"></label>'+
    '<label class="fld"><span>End date (blank = periodic)</span><input type="date" data-tf="end" value="'+esc(e.end)+'"></label></div>'+
    '<div class="grid2"><label class="fld"><span>Rent per week ($)</span><input type="number" inputmode="decimal" min="0" data-tf="rent" value="'+esc(e.rent)+'"></label>'+
    '<label class="fld"><span>Bond ($)</span><input type="number" inputmode="decimal" min="0" data-tf="bond" value="'+esc(e.bond)+'"></label></div>'+
    '<label class="fld"><span>Landlord</span><select data-tf="landlord"><option value="">\u2014</option>'+landlords().map(function(l){ return '<option value="'+esc(l.name)+'"'+(l.name===e.landlord?' selected':'')+'>'+esc(l.name)+'</option>'; }).join('')+
      (e.landlord&&!landlords().some(function(l){ return l.name===e.landlord; })?'<option selected>'+esc(e.landlord)+'</option>':'')+'</select></label></div>';
  h+='<h2 style="margin:18px 8px 8px">Tenants</h2>'+e.tenants.map(function(p,i){
    return '<div class="card"><div class="row" style="margin-block-end:6px"><b class="grow">Tenant '+(i+1)+'</b>'+(e.tenants.length>1?'<button class="btn sm" type="button" data-act="tf-rm" data-id="'+i+'">Remove</button>':'')+'</div>'+
      '<label class="fld"><span>Full name</span><input type="text" data-tt="name" data-ti="'+i+'" autocapitalize="words" value="'+esc(p.name)+'"></label>'+
      '<div class="grid2"><label class="fld"><span>Email</span><input type="email" data-tt="email" data-ti="'+i+'" autocapitalize="off" value="'+esc(p.email)+'"></label>'+
      '<label class="fld"><span>Mobile</span><input type="tel" data-tt="mobile" data-ti="'+i+'" value="'+esc(p.mobile)+'"></label></div>'+
      '<div class="grid2"><label class="fld"><span>Date of birth</span><input type="date" data-tt="dob" data-ti="'+i+'" value="'+esc(p.dob)+'"></label>'+
      '<label class="fld"><span>Move-in date</span><input type="date" data-tt="moveIn" data-ti="'+i+'" value="'+esc(p.moveIn)+'"></label></div></div>';
  }).join('')+'<button class="btn block" type="button" data-act="tf-add" style="margin:0 0 12px">\uFF0B Add tenant</button>';
  h+='<div class="card"><label class="fld"><span>Notes</span><textarea data-tf="notes">'+esc(e.notes)+'</textarea></label></div>'+
    '<div id="tfErr" class="err" style="margin:0 6px 8px"></div><div class="row" style="gap:8px;margin:0 6px"><button class="btn grow" type="button" data-act="back">Cancel</button>'+
    '<button class="btn primary grow" type="button" data-act="tf-save">Save tenancy</button></div>';
  $('#app').innerHTML=h;
};
/* Tenancy checks (the server checks again) */
function tenancyProblem(t){
  var r=+t.rent, b=t.bond===''?NaN:+t.bond;
  if(!t.propertyId) return 'Choose the property.';
  if(!t.start) return 'Enter the tenancy start date.';
  if(t.end&&t.end<=t.start) return 'The end date must be after the start date.';
  if(!(r>0)) return 'Enter the rent per week.';
  if(!(b>=0)) return 'Enter the bond (0 if there isn\u2019t one).';
  if(b>r*4+0.005) return 'The bond can\u2019t be more than 4 weeks\u2019 rent ($'+money2(r*4)+').';
  for(var i=0;i<t.tenants.length;i++){ var p=t.tenants[i]; if(!String(p.name||'').trim()) return 'Enter a name for tenant '+(i+1)+'.'; if(!validEmail(p.email)) return 'Check '+p.name+'\u2019s email address.'; }
  return '';
}
/* ================= Bond lodgement ================= */
var BOND_DAYS=23, BOND_HUB='https://www.tenancy.govt.nz/rent-bond-and-bills/bond/bond-hub/';
/* yyyy-mm-dd date maths (UTC, so daylight saving never shifts a day) */
function ymdAdd(ymd,n){ var p=ymd.split('-').map(Number), d=new Date(Date.UTC(p[0],p[1]-1,p[2]+n)); return d.toISOString().slice(0,10); }
function holidaySet(){ var s={}; ((S.st&&S.st.holidays)||[]).forEach(function(h){ s[h.date]=1; }); return s; }
/* Residential Tenancies Act working day: not a weekend, a listed public holiday, or 25 December to 15 January */
function isWorkingDay(ymd,hol){
  var p=ymd.split('-').map(Number), dow=new Date(Date.UTC(p[0],p[1]-1,p[2])).getUTCDay();
  if(dow===0||dow===6||hol[ymd]) return false;
  if((p[1]===12&&p[2]>=25)||(p[1]===1&&p[2]<=15)) return false;
  return true;
}
/* the nth working day after a date (the day itself doesn't count) */
function addWorkingDays(ymd,n,hol){ var d=ymd, c=0; while(c<n){ d=ymdAdd(d,1); if(isWorkingDay(d,hol)) c++; } return d; }
/* working days after "from" up to and including "to" (0 when "to" isn't after "from") */
function workingDaysBetween(from,to,hol){ var d=from, c=0; while(d<to){ d=ymdAdd(d,1); if(isWorkingDay(d,hol)) c++; } return c; }
function bondPays(id){ return ((S.st&&S.st.bondPayments)||[]).filter(function(p){ return p.tenancyId===id; }).sort(function(a,b){ return (a.received||'').localeCompare(b.received||'')||a.receiptNo.localeCompare(b.receiptNo); }); }
function sumPays(list){ return list.reduce(function(s,p){ return s+(+p.amount||0); },0); }
/* Where the bond is at: text for the pill, its colour, and urgency ('bad' overdue, 'warn' needs doing soon) */
function bondInfo(t){
  var hol=holidaySet(), today=todayYmd(), bond=+t.bond||0, pays=bondPays(t.id), paid=sumPays(pays), num=t.bondNumber;
  function deadline(by,prefix,extra){
    var left=workingDaysBetween(today,by,hol);
    if(by<today) return {code:'overdue',text:prefix+ymdLabel(by)+' \u00B7 overdue'+(extra||''),cls:'st-bad',urgent:'bad',by:by};
    return {code:'due',text:prefix+ymdLabel(by)+' \u00B7 '+(by===today?'today':left+' working day'+(left===1?'':'s')+' left')+(extra||''),cls:left<=5?'st-warn':'',urgent:left<=5?'warn':'',by:by,left:left};
  }
  function waiting(at){ var since=workingDaysBetween(at,today,hol);
    return {code:'waiting',text:'Lodged '+ymdLabel(at)+' \u00B7 waiting for the bond number',cls:since>15?'st-warn':'st-sent',urgent:since>15?'warn':'',chase:since>15}; }
  if(t.bondMethod==='Tenancy Services'){
    if(num) return {code:'done',text:'Lodged \u2713 bond '+num,cls:'st-done'};
    if(t.bondLodgedAt) return waiting(t.bondLodgedAt);
    if(!t.bondDueBy) return {code:'ts',text:'Tenant pays Tenancy Services \u00B7 set the lodge-by date',cls:'st-warn',urgent:'warn'};
    return deadline(t.bondDueBy,'Lodge request by ');
  }
  if(!bond&&!pays.length) return {code:'none',text:'No bond',cls:''};
  var open=pays.filter(function(p){ return !p.lodgedAt; }), part=paid<bond-0.005;
  if(open.length){
    var by=open.map(function(p){ return addWorkingDays(p.received,BOND_DAYS,hol); }).sort()[0];
    return deadline(by,'Lodge by ',part?' \u00B7 $'+money2(paid)+' of $'+money2(bond)+' received':'');
  }
  if(!pays.length) return {code:'unpaid',text:'Bond not received yet',cls:t.start&&t.start<=today?'st-warn':'',urgent:t.start&&t.start<=today&&t.status!=='Ended'?'warn':''};
  if(num) return {code:'done',text:(part?'$'+money2(paid)+' of $'+money2(bond)+' lodged':'Lodged')+' \u2713 bond '+num,cls:part?'st-warn':'st-done'};
  var last=pays.map(function(p){ return p.lodgedAt; }).sort().pop();
  return waiting(last);
}
function bondPill(t){ var b=bondInfo(t); return b.code==='none'?'':'<span class="pill '+b.cls+'">\uD83D\uDCB0 '+esc(b.text)+'</span>'; }
function bondTodo(){ return tenancies().filter(function(t){ return t.status!=='Ended' && !!bondInfo(t).urgent; }).length; }
function dmy(ymd){ if(!ymd) return ''; var p=ymd.split('-'); return p[2]+'/'+p[1]+'/'+p[0]; }

function bondSection(t){
  var b=bondInfo(t), pays=bondPays(t.id), paid=sumPays(pays), bond=+t.bond||0, ts=t.bondMethod==='Tenancy Services';
  var open=pays.filter(function(p){ return !p.lodgedAt; });
  var h='<div class="card"><div class="row" style="align-items:flex-start;gap:8px"><div class="grow"><div style="font-weight:750">$'+esc(money2(bond))+' bond'+(ts?'':pays.length?' \u00B7 $'+esc(money2(paid))+' received':'')+'</div>'+
    (b.code!=='none'?'<div style="margin-block-start:4px"><span class="pill '+b.cls+'">'+esc(b.text)+'</span></div>':'')+'</div>'+
    '<button class="btn sm" type="button" data-act="bond-method" data-id="'+esc(t.id)+'">'+(ts?'Paid to Tenancy Services':'Paid to you')+' \u25BE</button></div>';
  if(b.chase) h+='<div class="small" style="color:var(--miss);margin-block-start:6px">It\u2019s been more than 15 working days. Check Bond Hub for the bond number, or contact Tenancy Services.</div>';
  if(ts) h+='<div class="small muted" style="margin-block-start:8px">You lodge the bond request in Bond Hub and nominate a tenant to pay; Tenancy Services emails them a payment link. No receipts are needed.</div>';
  if(!ts&&pays.length) h+='<div style="margin-block-start:10px">'+pays.map(function(p){
    return '<div class="member" style="align-items:flex-start"><div class="grow"><div><b>$'+esc(money2(p.amount))+'</b> from '+esc(p.paidBy)+(p.lodgedAt?' <span class="pill st-done">Lodged '+esc(ymdLabel(p.lodgedAt))+'</span>':'')+'</div>'+
      '<div class="small muted">'+esc([ymdLabel(p.received),p.method,p.receiptNo].filter(Boolean).join(' \u00B7 '))+'</div>'+
      '<div class="small '+(p.receiptSentAt?'muted':'')+'" style="'+(p.receiptSentAt?'':'color:var(--miss)')+'">'+(p.receiptSentAt?'Receipt sent '+esc(fmtDate(p.receiptSentAt))+(p.receiptSentTo?' to '+esc(p.receiptSentTo):''):'Receipt not sent yet')+'</div></div>'+
      '<div class="row" style="gap:6px">'+(p.receiptPdf?'<a class="btn sm" target="_blank" rel="noopener" href="'+esc(p.receiptPdf)+'" aria-label="Open receipt">\uD83D\uDCC4</a>':'')+
      '<button class="btn sm" type="button" data-act="bond-receipt" data-id="'+esc(p.id)+'">\u2709 Receipt</button>'+
      (p.lodgedAt?'':'<button class="btn sm" type="button" data-act="bond-pay-del" data-id="'+esc(p.id)+'" aria-label="Delete payment">\uD83D\uDDD1</button>')+'</div></div>'; }).join('')+'</div>';
  var acts='';
  if(!ts&&paid<bond-0.005) acts+='<button class="btn sm primary" type="button" data-act="bond-pay" data-id="'+esc(t.id)+'">\uFF0B Record payment</button>';
  if((!ts&&open.length)||(ts&&!t.bondLodgedAt&&!t.bondNumber)) acts+='<button class="btn sm primary" type="button" data-act="bond-lodge" data-id="'+esc(t.id)+'">\uD83C\uDFDB Lodge in Bond Hub</button>';
  if((b.code==='waiting'||b.code==='done')) acts+='<button class="btn sm" type="button" data-act="bond-number" data-id="'+esc(t.id)+'">'+(t.bondNumber?'Bond number':'\uFF0B Add bond number')+'</button>';
  if(acts) h+='<div class="row wrap" style="gap:8px;margin-block-start:10px">'+acts+'</div>';
  return h+'</div>';
}

/* Record a bond payment received, and email the receipt */
function bondPayDialog(t){
  var paid=sumPays(bondPays(t.id)), left=Math.max(0,(+t.bond||0)-paid), people=t.tenants||[];
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:10px">Record bond payment</div>'+
    '<div class="grid2"><label class="fld"><span>Amount ($)</span><input type="number" inputmode="decimal" min="0" id="bpAmt" value="'+esc(left?money2(left):'')+'"></label>'+
    '<label class="fld"><span>Date received</span><input type="date" id="bpDate" value="'+esc(todayYmd())+'"></label></div>'+
    '<div class="grid2"><label class="fld"><span>Paid by</span><select id="bpWho">'+people.map(function(p){ return '<option value="'+esc(p.name)+'">'+esc(whoText(p))+'</option>'; }).join('')+'<option value="">Someone else\u2026</option></select></label>'+
    '<label class="fld"><span>How</span><select id="bpHow"><option>Bank transfer</option><option>Cash</option><option>Other</option></select></label></div>'+
    '<label class="fld hidden" id="bpOtherL"><span>Name of the person who paid</span><input type="text" id="bpOther"></label>'+
    '<label class="fld"><span>Notes (optional)</span><input type="text" id="bpNotes"></label>'+
    '<div class="small muted" style="margin-block-end:6px">Email the receipt to</div><div id="bpTo">'+receiptTargets(people,people[0]&&people[0].name)+'</div>'+
    '<div class="small muted" style="margin-block:8px 10px">You must give a receipt for every bond payment and lodge it with Tenancy Services within 23 working days.</div>'+
    '<div id="bpErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-bp="cancel">Cancel</button><button class="btn primary" type="button" data-bp="save">Save payment</button></div>');
  var who=$('#bpWho',m);
  who.addEventListener('change',function(){ $('#bpOtherL',m).classList.toggle('hidden',!!who.value); $('#bpTo',m).innerHTML=receiptTargets(people,who.value); });
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-bp]'); if(!b){ if(e.target===m) m.remove(); return; }
    if(b.getAttribute('data-bp')==='cancel') return m.remove();
    var amt=+$('#bpAmt',m).value, dt=$('#bpDate',m).value, name=who.value||$('#bpOther',m).value.trim();
    var err=!(amt>0)?'Enter the amount received.':!dt?'Enter the date it was received.':dt>todayYmd()?'The date received can\u2019t be in the future.':!name?'Enter who paid it.':
      amt>left+0.005?'That\u2019s more than the bond still owed ($'+money2(left)+').':'';
    if(err){ $('#bpErr',m).textContent=err; return; }
    var to=[].filter.call(m.querySelectorAll('.rcpt'),function(c){ return c.checked; }).map(function(c){ return c.value; });
    busy(b,'Saving',api.tmRecordBondPayment(t.id,{amount:amt,received:dt,paidBy:name,method:$('#bpHow',m).value,notes:$('#bpNotes',m).value,sendTo:to})).then(function(st){
      apply(st); m.remove(); var r=st.receipt;
      toast(r? (r.ok?'Payment recorded \u2014 receipt emailed':'Payment recorded, but the receipt wasn\u2019t sent: '+r.error) : 'Payment recorded', r&&!r.ok?7000:3000); render();
    }).catch(function(x){ $('#bpErr',m).textContent=x&&x.message||'Couldn\u2019t save'; });
  });
}
/* tick boxes for each tenant with an email (the payer ticked) */
function receiptTargets(people,payer){
  var withEmail=people.filter(function(p){ return p.email; });
  if(!withEmail.length) return '<div class="small muted">No tenant has an email address recorded \u2014 add one by editing the tenancy.</div>';
  return withEmail.map(function(p){ return '<label class="small" style="display:flex;gap:8px;align-items:center;margin-block-end:6px"><input type="checkbox" class="rcpt" value="'+esc(p.email)+'"'+(p.name===payer?' checked':'')+'> '+whoHtml(p)+' <span class="muted">'+esc(p.email)+'</span></label>'; }).join('');
}
/* Email (or re-send) a payment's receipt */
function bondReceiptDialog(pay){
  var t=tenancyById(pay.tenancyId), people=(t&&t.tenants)||[];
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:4px">Email receipt '+esc(pay.receiptNo)+'</div><div class="small muted" style="margin-block-end:10px">$'+esc(money2(pay.amount))+' from '+esc(pay.paidBy)+', '+esc(ymdLabel(pay.received))+(pay.receiptSentAt?' \u00B7 last sent '+esc(fmtDate(pay.receiptSentAt)):'')+'</div>'+
    receiptTargets(people,pay.paidBy)+'<label class="fld" style="margin-block-start:6px"><span>Another email (optional)</span><input type="email" id="rcExtra" autocapitalize="off"></label>'+
    '<div id="rcErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-rc="cancel">Cancel</button><button class="btn primary" type="button" data-rc="send">Send receipt</button></div>');
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-rc]'); if(!b){ if(e.target===m) m.remove(); return; }
    if(b.getAttribute('data-rc')==='cancel') return m.remove();
    var to=[].filter.call(m.querySelectorAll('.rcpt'),function(c){ return c.checked; }).map(function(c){ return c.value; }), ex=$('#rcExtra',m).value.trim();
    if(ex){ if(!validEmail(ex)){ $('#rcErr',m).textContent='Check the extra email address.'; return; } to.push(ex); }
    if(!to.length){ $('#rcErr',m).textContent='Choose who to send it to.'; return; }
    busy(b,'Sending',api.tmSendBondReceipt(pay.id,to)).then(function(st){ apply(st); m.remove(); toast('Receipt emailed'); render(); })
      .catch(function(x){ $('#rcErr',m).textContent=x&&x.message||'Couldn\u2019t send'; });
  });
}
/* Everything Bond Hub asks for, ready to copy, then "Mark as lodged" */
function bondLodgeDialog(t){
  var pp=setupPropById(t.propertyId), ts=t.bondMethod==='Tenancy Services', open=bondPays(t.id).filter(function(p){ return !p.lodgedAt; });
  var amount=ts? +t.bond||0 : sumPays(open), first=!bondPays(t.id).some(function(p){ return p.lodgedAt; });
  function line(label,val,warn){ return '<div class="row" style="gap:8px;padding-block:6px;border-block-end:1px solid var(--line)"><div class="grow"><div class="small muted">'+esc(label)+'</div><div style="font-weight:650">'+
    (val?esc(val):'<span style="color:var(--miss)">'+esc(warn||'Not recorded')+'</span>')+'</div></div>'+(val?'<button class="btn sm" type="button" data-copy="'+esc(val)+'">Copy</button>':'')+'</div>'; }
  var h='<div class="title" style="font-size:1.1rem">Lodge in Bond Hub</div><div class="small muted" style="margin-block-end:10px">'+(first?'New bond':'Top-up of a bond already lodged')+' \u00B7 copy each value into Bond Hub</div>'+
    '<a class="btn primary block" target="_blank" rel="noopener" href="'+BOND_HUB+'">Open Bond Hub \u2197</a>'+
    '<div class="sasec" style="margin-block-start:12px">Tenancy</div>'+
    line('Tenancy address',pp?[pp.address1,pp.address2].filter(Boolean).join(', '):t.property)+line('Weekly rent',t.rent!==''?money2(t.rent):'')+
    line(first?'General bond':'Top-up amount',money2(amount))+line('Pet bond','0');
  (t.tenants||[]).forEach(function(p,i){
    h+='<div class="sasec" style="margin-block-start:12px">Tenant '+(i+1)+'</div>'+line('Full name',p.name)+line('Date of birth',dmy(p.dob),'Not recorded \u2014 Bond Hub needs it')+
      line('Email',p.email)+line('Mobile',p.mobile)+line('Contact preference',p.email?'Email':p.mobile?'Text message':'Post')+line('Entry date (moving in)',dmy(p.moveIn||t.start));
  });
  if(ts) h+='<div class="small muted" style="margin-block-start:10px">Choose a tenant with an email address as the payer \u2014 Tenancy Services emails them a link to pay.</div>';
  h+='<div class="sasec" style="margin-block-start:14px">Once it\u2019s lodged</div><div class="grid2"><label class="fld"><span>Date lodged</span><input type="date" id="blDate" value="'+esc(todayYmd())+'"></label>'+
    '<label class="fld"><span>Bond number (if you have it)</span><input type="text" id="blNum" value="'+esc(t.bondNumber||'')+'" autocapitalize="characters"></label></div>'+
    '<div class="small muted" style="margin-block-end:10px">The bond number comes in Tenancy Services\u2019 confirmation; you can add it later.</div>'+
    '<div id="blErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-bl="cancel">Close</button><button class="btn primary" type="button" data-bl="save">Mark as lodged</button></div>';
  var m=modal(h);
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-bl]'); if(!b){ if(e.target===m) m.remove(); return; }
    if(b.getAttribute('data-bl')==='cancel') return m.remove();
    var dt=$('#blDate',m).value, num=$('#blNum',m).value.trim();
    if(!dt||dt>todayYmd()){ $('#blErr',m).textContent='Enter the date you lodged it (not in the future).'; return; }
    if(num&&!/^[A-Za-z0-9-]{4,20}$/.test(num)){ $('#blErr',m).textContent='Check the bond number.'; return; }
    busy(b,'Saving',api.tmMarkBondLodged(t.id,{lodgedAt:dt,bondNumber:num})).then(function(st){ apply(st); m.remove(); toast('Bond marked as lodged'); render(); })
      .catch(function(x){ $('#blErr',m).textContent=x&&x.message||'Couldn\u2019t save'; });
  });
}
function bondNumberDialog(t){
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:10px">Bond number</div><label class="fld"><span>From Tenancy Services\u2019 confirmation</span><input type="text" id="bnNum" value="'+esc(t.bondNumber||'')+'" autocapitalize="characters"></label>'+
    '<div id="bnErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-bn="cancel">Cancel</button><button class="btn primary" type="button" data-bn="save">Save</button></div>');
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-bn]'); if(!b){ if(e.target===m) m.remove(); return; }
    if(b.getAttribute('data-bn')==='cancel') return m.remove();
    var num=$('#bnNum',m).value.trim(); if(num&&!/^[A-Za-z0-9-]{4,20}$/.test(num)){ $('#bnErr',m).textContent='Check the bond number.'; return; }
    busy(b,'Saving',api.tmSetBondNumber(t.id,num)).then(function(st){ apply(st); m.remove(); toast(num?'Bond number saved':'Bond number cleared'); render(); }).catch(function(x){ $('#bnErr',m).textContent=x&&x.message||'Couldn\u2019t save'; });
  });
}
function bondMethodDialog(t){
  var ts=t.bondMethod==='Tenancy Services';
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:10px">How is the bond paid?</div>'+
    '<div class="seg" style="margin-block-end:12px"><button type="button" data-v="Landlord" class="'+(ts?'':'on')+'">To you</button><button type="button" data-v="Tenancy Services" class="'+(ts?'on':'')+'">Straight to Tenancy Services</button></div>'+
    '<div id="bmTs" class="'+(ts?'':'hidden')+'"><label class="fld"><span>Lodge the bond request by (the date agreed with the tenant)</span><input type="date" id="bmDue" value="'+esc(t.bondDueBy||'')+'"></label></div>'+
    '<div class="small muted" id="bmHelp" style="margin-block-end:12px"></div>'+
    '<div id="bmErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-bm="cancel">Cancel</button><button class="btn primary" type="button" data-bm="save">Save</button></div>');
  var pick=ts?'Tenancy Services':'Landlord';
  function help(){ $('#bmHelp',m).textContent=pick==='Landlord'?'They pay you; you give a receipt for each payment and lodge it within 23 working days.':'You lodge the request in Bond Hub and nominate a tenant to pay; Tenancy Services emails them a link.'; $('#bmTs',m).classList.toggle('hidden',pick!=='Tenancy Services'); }
  help();
  m.addEventListener('click',function(e){
    var s=e.target.closest('.seg [data-v]'); if(s){ pick=s.getAttribute('data-v'); [].forEach.call(s.parentNode.children,function(x){ x.classList.toggle('on',x===s); }); help(); return; }
    var b=e.target.closest('[data-bm]'); if(!b){ if(e.target===m) m.remove(); return; }
    if(b.getAttribute('data-bm')==='cancel') return m.remove();
    busy(b,'Saving',api.tmSetBondMethod(t.id,pick,$('#bmDue',m).value)).then(function(st){ apply(st); m.remove(); toast('Saved'); render(); }).catch(function(x){ $('#bmErr',m).textContent=x&&x.message||'Couldn\u2019t save'; });
  });
}

/* ================= Change of tenants (built-in signing only) ================= */
function changeSigners(rec){ return {status:rec.status,sentAt:rec.sentAt,signers:(rec.signers||[]).map(function(s,i){ return {role:s.role,name:s.name,email:s.email,pos:i+1,sentAt:s.sentAt||'',viewedAt:s.openedAt||s.viewedAt||s.signedAt||'',signedAt:s.signedAt||''}; })}; }
function tenancyEsignSection(t){
  if(t.agreementProvider!=='esign'||!t.requestId) return '';
  var pc=t.pendingChange, live=pc&&pc.status==='Sent', h='<div class="card">';
  if(pc){
    h+='<div style="font-weight:750">Change of tenants '+(pc.status==='Sent'?'<span class="pill st-warn">'+esc(pc.signed||'0')+' signed</span>':'<span class="pill st-bad">'+esc(pc.status)+'</span>')+'</div>'+
      (pc.changeSummary?'<div class="small muted">'+esc(pc.changeSummary)+'</div>':'')+agreementSignersHtml(changeSigners(pc),live?{act:'change-resend',id:t.id}:null)+
      '<div class="row wrap" style="gap:8px;margin-block-start:8px"><button class="btn sm" type="button" data-act="change-refresh" data-id="'+esc(t.id)+'">\u21BB Check status</button>'+
      (live?'<button class="btn sm" type="button" data-act="change-progress" data-id="'+esc(t.id)+'">\uD83D\uDC41 Preview progress</button>':'')+
      (live?'<button class="btn sm danger" type="button" data-act="change-cancel" data-id="'+esc(t.id)+'">Cancel change</button>':'')+'</div>';
  }
  if(!live) h+=(pc?'<div class="sep"></div>':'')+'<div class="small muted" style="margin-block-end:8px">Someone leaving, or an approved applicant joining? Everyone signs a change of tenants, and the tenancy updates when it\u2019s fully signed.</div>'+
    '<button class="btn sm primary" type="button" data-act="change-tenants" data-id="'+esc(t.id)+'">\uD83D\uDC65 Change tenants</button>';
  h+='<button class="btn sm" type="button" data-act="tenancy-summary" data-id="'+esc(t.id)+'" style="margin-inline-start:8px">\uD83D\uDCC4 Tenancy summary</button>';
  if((t.agreementVersions||[]).length>1) h+='<div class="sep"></div><div class="small muted" style="margin-block-end:4px">Signed versions</div>'+t.agreementVersions.map(function(v,i){
    return '<div class="small">'+(i?'Change '+i:'Original agreement')+(v.effective?' \u00B7 from '+esc(ymdLabel(v.effective)):'')+(v.pdf?' \u00B7 <a target="_blank" rel="noopener" href="'+esc(v.pdf)+'">PDF</a>':'')+'</div>'; }).join('');
  return h+'</div>';
}
/* Bond Hub change-of-tenant tasks: due 10 working days after the change */
function bondTasksHtml(t){
  var tasks=t.bondTasks||[]; if(!tasks.length) return '';
  var hol=holidaySet(), today=todayYmd();
  return '<div class="card">'+tasks.map(function(k){
    var done=k.status==='Done', left=workingDaysBetween(today,k.due,hol), cls=done?'st-done':k.due<today?'st-bad':left<=5?'st-warn':'';
    return '<div class="member" style="align-items:flex-start"><div class="grow"><div style="font-weight:750">\uD83C\uDFDB '+esc(k.type)+' <span class="pill '+cls+'">'+(done?'Done '+esc(ymdLabel(k.doneAt)):k.due<today?'Overdue \u00B7 was due '+esc(ymdLabel(k.due)):'Notify by '+esc(ymdLabel(k.due))+' \u00B7 '+left+' working day'+(left===1?'':'s')+' left')+'</span></div>'+
      '<div class="small muted">'+[k.leaving&&k.leaving.length?'Leaving: '+esc(k.leaving.join(', ')):'',k.joining&&k.joining.length?'Joining: '+esc(k.joining.join(', ')):'','From '+esc(ymdLabel(k.effective))].filter(Boolean).join(' \u00B7 ')+'</div>'+
      (k.bondArrangement?'<div class="small muted">Bond: '+esc(k.bondArrangement)+'</div>':'')+
      '<div class="small muted">In Bond Hub, removing and adding tenants are separate requests; every tenant agrees within 12 working days.</div></div>'+
      '<button class="btn sm" type="button" data-act="bond-task" data-v="'+(done?'0':'1')+'" data-task="'+esc(k.id)+'" data-id="'+esc(t.id)+'">'+(done?'Reopen':'\u2713 Done')+'</button></div>'; }).join('')+'</div>';
}
/* Approved applicants for this property who aren't already tenants (the only people who can join) */
function joinCandidates(t){
  var inT={}; tenancies().forEach(function(x){ if(x.status!=='Ended') (x.tenants||[]).forEach(function(p){ if(p.ref) inT[p.ref]=1; }); });
  var pp=setupPropById(t.propertyId)||{};
  return apps().filter(function(a){ return a.decision==='Approved' && !inT[a.ref] && (a.propertyId===t.propertyId || (pp.address1&&String(a.address1||'').toLowerCase()===String(pp.address1).toLowerCase())); });
}
/* Current tenancies at the same property as an applicant (by property ID, else street address) */
function tenanciesAtProperty(l){
  var pp=setupPropById(l.propertyId)||{}, a1=String(l.address1||pp.address1||'').trim().toLowerCase();
  return tenancies().filter(function(x){ if(tenancyPhase(x)==='ended') return false; var xp=setupPropById(x.propertyId)||{};
    return (l.propertyId&&x.propertyId===l.propertyId) || (a1&&String(xp.address1||x.property||'').trim().toLowerCase().indexOf(a1)===0); });
}
/* Why a tenancy can't take a change of tenants here ('' when it can) */
function changeBlocked(t){
  if(t.agreementProvider!=='esign'||!t.requestId) return 'Its agreement wasn\u2019t signed with built-in signing, so tenants can\u2019t be changed here';
  if(t.pendingChange&&t.pendingChange.status==='Sent') return 'A change of tenants is already out for signing';
  return '';
}
/* Approved group -> pick one of the property's tenancies -> the Change tenants dialog, with the group ticked as joining */
function addToTenancyDialog(key){
  var l=groupLead(key), list=tenanciesAtProperty(l), refs=groupMembers(key).map(function(a){ return a.ref; }), pick='';
  var ok=list.filter(function(t){ return !changeBlocked(t); });
  if(ok.length===1) pick=ok[0].id;
  var m=modal('<div class="title" style="font-size:1.1rem">Add to existing agreement</div>'+
    '<div class="small muted" style="margin-block:6px 12px">Choose the tenancy '+esc(refs.length>1?groupName(key):l.name)+' '+(refs.length>1?'are':'is')+' joining. Next you\u2019ll set up the change of tenants: everyone signs it, and the tenancy updates once it\u2019s fully signed.</div>'+
    list.map(function(t){ var why=changeBlocked(t);
      return '<label class="row" style="gap:10px;align-items:flex-start;padding-block:9px;border-block-end:1px solid var(--line);'+(why?'opacity:.55;':'cursor:pointer')+'">'+
        '<input type="radio" name="attT" value="'+esc(t.id)+'"'+(why?' disabled':'')+(t.id===pick?' checked':'')+' style="width:20px;height:20px;flex:none;margin-block-start:2px">'+
        '<span class="grow"><b>'+esc((t.room?t.room+', ':'')+(t.property||'Tenancy'))+'</b><br><span class="small muted">'+esc((t.tenants||[]).map(whoText).join(', ')||'No tenants listed')+
        (t.start?' \u00B7 from '+esc(ymdLabel(t.start)):'')+(t.end?' to '+esc(ymdLabel(t.end)):'')+'</span>'+
        (why?'<br><span class="small" style="color:var(--miss)">'+esc(why)+'</span>':'')+'</span></label>'; }).join('')+
    '<div id="attErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px;margin-block-start:12px"><button class="btn" type="button" data-att="cancel">Cancel</button><button class="btn primary" type="button" data-att="next">Next</button></div>');
  m.addEventListener('change',function(e){ if(e.target.name==='attT') pick=e.target.value; });
  m.addEventListener('click',function(e){ var b=e.target.closest('[data-att]'); if(!b){ if(e.target===m) m.remove(); return; }
    if(b.getAttribute('data-att')==='cancel') return m.remove();
    var t=tenancyById(pick); if(!t){ $('#attErr',m).textContent='Choose a tenancy.'; return; }
    m.remove(); changeTenantsDialog(t,refs);
  });
}
function changeTenantsDialog(t,join){
  var cands=joinCandidates(t);
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:10px">Change tenants</div>'+
    '<div class="sasec">Who is leaving</div>'+(t.tenants||[]).map(function(p){ return '<label class="small" style="display:flex;gap:8px;align-items:center;margin-block-end:6px"><input type="checkbox" class="ctOut" value="'+esc(p.email)+'"> '+whoHtml(p)+'</label>'; }).join('')+
    '<div class="sasec" style="margin-block-start:10px">Who is joining</div>'+(cands.length? cands.map(function(a){ return '<label class="small" style="display:flex;gap:8px;align-items:center;margin-block-end:6px"><input type="checkbox" class="ctIn" value="'+esc(a.ref)+'"'+(join&&join.indexOf(a.ref)>=0?' checked':'')+'> '+whoHtml(a)+' <span class="muted">'+esc(a.email||'no email')+'</span></label>'; }).join('')
      : '<div class="small muted" style="margin-block-end:8px">No approved applicants for this property. Someone joining has to apply and be Approved first.</div>')+
    '<div class="grid2" style="margin-block-start:8px"><label class="fld"><span>Takes effect on</span><input type="date" id="ctEff" value="'+esc(todayYmd())+'"></label>'+
    '<label class="fld"><span>Total bond ($, blank = no change)</span><input type="number" inputmode="decimal" min="0" id="ctBond" placeholder="'+esc(t.bond!==''&&t.bond!=null?money2(t.bond):'')+'"></label></div>'+
    '<label class="fld"><span>How the bond is being settled between tenants (required)</span><textarea id="ctArr" rows="2" placeholder="e.g. Ana pays Ben his $1,040 share directly"></textarea></label>'+
    '<label class="fld"><span>Reason (optional)</span><input type="text" id="ctWhy"></label>'+
    '<div id="ctErr" class="err"></div><div class="row" style="justify-content:flex-end;gap:8px"><button class="btn" type="button" data-ct="cancel">Cancel</button><button class="btn" type="button" data-ct="preview">\uD83D\uDC41 Preview</button><button class="btn primary" type="button" data-ct="send">Send for signing</button></div>');
  function read(){ return {leaving:[].filter.call(m.querySelectorAll('.ctOut'),function(c){ return c.checked; }).map(function(c){ return c.value; }),
    joining:[].filter.call(m.querySelectorAll('.ctIn'),function(c){ return c.checked; }).map(function(c){ return c.value; }),
    effectiveDate:$('#ctEff',m).value,bondTotal:$('#ctBond',m).value,bondArrangement:$('#ctArr',m).value.trim(),reason:$('#ctWhy',m).value.trim()}; }
  function problem(c){
    if(!c.leaving.length&&!c.joining.length) return 'Choose who is leaving and/or who is joining.';
    if(c.leaving.length>=(t.tenants||[]).length&&!c.joining.length) return 'At least one tenant has to stay or join. To finish the tenancy, mark it Ended instead.';
    if(!c.effectiveDate) return 'Choose the date the change takes effect.';
    if(c.bondTotal!==''&&!(+c.bondTotal>=0)) return 'Check the total bond (or leave it blank to keep it the same).';
    if(!c.bondArrangement) return 'Say how the bond is being settled between the tenants.';
    return '';
  }
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-ct]'); if(!b){ if(e.target===m) m.remove(); return; }
    var a=b.getAttribute('data-ct'); if(a==='cancel') return m.remove();
    var c=read(), err=problem(c); if(err){ $('#ctErr',m).textContent=err; return; }
    if(a==='preview') return busy(b,'Preparing',api.tmChangeTenants(t.id,c,true)).then(function(r){ if(r.errors&&r.errors.length){ $('#ctErr',m).textContent=r.errors.join(' '); return; } previewDialog('Change of tenants preview',r.html,r.warnings); }).catch(function(x){ $('#ctErr',m).textContent=x&&x.message||'Couldn\u2019t make the preview'; });
    busy(b,'Sending',api.tmChangeTenants(t.id,c,false)).then(function(st){ apply(st); m.remove(); render();
      if(st.firstLink) return linkDialog('The first email didn\u2019t send',st.firstLink,null); toast('Change of tenants sent for signing'); })
      .catch(function(x){ $('#ctErr',m).textContent=x&&x.message||'Couldn\u2019t send'; });
  });
}

/* Bond defaults to 4 weeks' rent: when the rent changes, a blank bond (or one still 4 weeks of the old rent) follows it */
function bond4(rent){ var r=+rent; return r>0? String(Math.round(r*400)/100) : ''; }
function bondFollows(bond,oldRent){ return bond===''||bond==null||(+oldRent>0&&Math.abs(+bond-(+oldRent)*4)<0.005); }
/* Form fields for the Setup and tenancy screens (typing and picking) */
function editField(el){
  if(!el.hasAttribute) return false;
  if(/^(internetIncluded|bottledGas)$/.test(el.getAttribute('data-pe-cb')||'')&&S.pe){ S.pe[el.getAttribute('data-pe-cb')]=el.checked; return true; }
  if(el.getAttribute('data-pe-cb')==='unitTitle'&&S.pe){ if(S.pe.unitTitle!==el.checked){ S.pe.unitTitle=el.checked; peBcRedraw(); } return true; }
  if(el.hasAttribute('data-pe-cb')&&S.pe){ if(S.pe[el.getAttribute('data-pe-cb')]!==el.checked){ S.pe[el.getAttribute('data-pe-cb')]=el.checked; keepScroll(render); } return true; }
  if(el.hasAttribute('data-bc-upload')&&S.pe){ var bf=el.files&&el.files[0]; if(bf&&!el._sent){ el._sent=1; uploadBc(bf); } return true; }
  if(el.hasAttribute('data-pe')&&S.pe){ var pk=el.getAttribute('data-pe'), pwas=S.pe[pk]; S.pe[pk]=el.value;
    if(pk==='rent'&&bondFollows(S.pe.bond,pwas)){ S.pe.bond=bond4(el.value); var pb=document.querySelector('[data-pe=bond]'); if(pb) pb.value=S.pe.bond; } if(/^(rent|bond)$/.test(el.getAttribute('data-pe'))) peHint(); peMenuRefresh();
    if(el.getAttribute('data-pe')==='power'){ peUtilRedraw(); return true; } if(el.getAttribute('data-pe')==='bodyCorporateRules') peBcRedraw(); return true; }
  if(el.hasAttribute('data-qs-name')&&S.qsE){ S.qsE[+el.getAttribute('data-qs-name')].name=el.value; qsMarkUnsaved(); return true; }
  if(el.hasAttribute('data-qs-note')&&S.qsE){ S.qsE[+el.getAttribute('data-qs-note')].note=el.value; qsMarkUnsaved(); return true; }
  if(el.hasAttribute('data-qs-q')&&S.qsE){ var qp=el.getAttribute('data-qs-q').split(':'); S.qsE[+qp[0]].items[+qp[1]]=el.value; qsMarkUnsaved(); return true; }
  if(el.hasAttribute('data-qs-use')&&S.qsE){ var qu=S.qsE[+el.getAttribute('data-qs-use')], uv=el.value; qu.usedFor=qu.usedFor.filter(function(x){ return x!==uv; }); if(el.checked) qu.usedFor.push(uv);
    qu.usedFor.sort(function(a,b){ return QS_USES.map(function(x){ return x[0]; }).indexOf(a)-QS_USES.map(function(x){ return x[0]; }).indexOf(b); }); keepScroll(render); return true; }
  if(el.hasAttribute('data-tm-at')&&S.tmE){ S.tmE[+el.getAttribute('data-tm-at')]=el.value; var tsv=sameTerms(S.tmE,termsMaster());
    var tsb=$('#tmSave'), tsu=$('#tmUnsaved'); if(tsb) tsb.disabled=tsv; if(tsu) tsu.style.display=tsv?'none':''; return true; }
  if(el.hasAttribute('data-pe-at')&&S.pe){ S.pe.additionalTerms[+el.getAttribute('data-pe-at')]=el.value; return true; }
  if(el.hasAttribute('data-pe-room')&&S.pe){ var rp=el.getAttribute('data-pe-room').split('.'), rr0=S.pe.rooms[+rp[0]], rwas=rr0[rp[1]]; rr0[rp[1]]=el.value;
    if(rp[1]==='rent'&&bondFollows(rr0.bond,rwas)){ rr0.bond=bond4(el.value); var rb=document.querySelector('[data-pe-room="'+rp[0]+'.bond"]'); if(rb) rb.value=rr0.bond; } peMenuRefresh(); return true; }
  if(el.hasAttribute('data-pe-ch')&&S.pe){ S.pe.chattels[+el.getAttribute('data-pe-ch')]=el.value; return true; }
  if(el.hasAttribute('data-ins')&&S.pe){ var ip=el.getAttribute('data-ins').split('.'), iv=el.value; if(/^(rValue|thickness)2?$/.test(ip[1])) iv=iv===''?'':+iv;
    S.pe.insulation[ip[0]][ip[1]]=iv; var pv=$('#insPreview'); if(pv) pv.textContent=insText(S.pe.insulation); peMenuRefresh(); return true; }
  if(el.hasAttribute('data-hh')&&S.pe){ S.pe.healthyHomes[el.getAttribute('data-hh')]=el.value; var hv=$('#hhPreview'); if(hv) hv.textContent=hhText(S.pe.healthyHomes,S.pe.landlord); peMenuRefresh(); return true; }
  if(el.hasAttribute('data-ea')&&S.pe&&S.pe.areas){ var ar=S.pe.areas[+el.getAttribute('data-i')], ek=el.getAttribute('data-ea');
    if(ek==='items') ar.items=el.value.split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
    else if(ek==='type'){ ar.type=el.value; if(!ar.items.length&&LIB[el.value]&&LIB[el.value].length){ ar.items=LIB[el.value].slice(); render(); } }
    else ar[ek]=el.value;
    return true; }
  if(el.hasAttribute('data-ps')&&S.ps){ S.ps[el.getAttribute('data-ps')]=el.value; var pb=$('#psSave'); if(pb) pb.disabled=!psDirty(); return true; }
  if(el.hasAttribute('data-tp')&&S.tp&&S.tp.ten){ S.tp.ten[el.getAttribute('data-tp')]=el.value; var tb=$('#tpSave'); if(tb) tb.disabled=!tpDirty(); return true; }
  if(el.hasAttribute('data-tpa')&&S.tp&&S.tp.data){ S.tp.ans[el.getAttribute('data-tpa')]=el.value; var tb2=$('#tpSave'); if(tb2) tb2.disabled=!tpDirty(); if(el.tagName==='SELECT') keepScroll(render); return true; }
  if(el.hasAttribute('data-le-cb')&&S.le){ S.le[el.getAttribute('data-le-cb')]=el.checked; return true; }
  if(el.hasAttribute('data-le')&&S.le){ var lk=el.getAttribute('data-le'); S.le[lk]=el.value;
    if(/^brand|^name$/.test(lk)){ var bp=$('#leBrandPrev'); if(bp) bp.innerHTML=brandPreview(S.le); } return true; }
  if(el.hasAttribute('data-le-logo')&&S.le){ var lf=el.files&&el.files[0]; if(lf&&!el._sent){ el._sent=1; leLogo(lf); } return true; }
  if(el.hasAttribute('data-tf')&&S.tf){ var k=el.getAttribute('data-tf'), was=S.tf[k]; S.tf[k]=el.value;
    if(k==='rent'&&bondFollows(S.tf.bond,was)){ S.tf.bond=bond4(el.value); var tbd=document.querySelector('[data-tf=bond]'); if(tbd) tbd.value=S.tf.bond; }
    // move-in dates follow the start date (unless changed); a new tenancy takes the property's rent, bond and landlord
    if(k==='start') S.tf.tenants.forEach(function(p,i){ if(!p.moveIn||p.moveIn===was){ p.moveIn=el.value; var mi=document.querySelector('[data-tt=moveIn][data-ti="'+i+'"]'); if(mi) mi.value=el.value; } });
    if(k==='propertyId'){ S.tf.room=''; keepScroll(render); }
    if(k==='room'&&!S.tf.id){ var rp0=setupPropById(S.tf.propertyId), rr=rp0&&(rp0.rooms||[]).find(function(x){ return x.name===el.value; });
      if(rr) [['rent',rr.rent],['bond',rr.bond!==''&&rr.bond!=null?rr.bond:bond4(rr.rent)]].forEach(function(x){ if(x[1]!==''&&x[1]!=null){ S.tf[x[0]]=x[1]; var f=document.querySelector('[data-tf='+x[0]+']'); if(f) f.value=x[1]; } }); }
    if(k==='propertyId'&&!S.tf.id){ var pp=setupPropById(el.value); if(pp){
      [['rent',pp.rent],['bond',pp.bond!==''&&pp.bond!=null?pp.bond:bond4(pp.rent)],['landlord',pp.landlord]].forEach(function(x){ if((S.tf[x[0]]===''||S.tf[x[0]]==null)&&x[1]!==''&&x[1]!=null){ S.tf[x[0]]=x[1]; var f=document.querySelector('[data-tf='+x[0]+']'); if(f) f.value=x[1]; } }); } }
    return true; }
  if(el.hasAttribute('data-tt')&&S.tf){ S.tf.tenants[+el.getAttribute('data-ti')][el.getAttribute('data-tt')]=el.value; return true; }
  return false;
}

function attendeeFields(a){
  return '<label class="fld"><span>Full name</span><input type="text" id="atName" autocomplete="off" autocapitalize="words" value="'+esc(a.name||'')+'"></label>'+
    '<div class="grid2"><label class="fld"><span>Mobile</span><input type="tel" id="atMobile" autocomplete="off" value="'+esc(a.mobile||'')+'"></label>'+
    '<label class="fld"><span>Email</span><input type="email" id="atEmail" autocomplete="off" autocapitalize="off" value="'+esc(a.email||'')+'"></label></div>'+
    '<label class="fld"><span>Notes (optional)</span><input type="text" id="atNotes" placeholder="Pets, move-in timing\u2026" value="'+esc(a.notes||'')+'"></label>';
}

VIEWS.app = function(ref){
  var a=appByRef(ref); if(!a){ back(); return; }
  setTitle(whoText(a));
  var st=stInfo(a), v=a.viewingId? viewingById(a.viewingId) : null;
  var h='<div class="card"><div class="person"><div class="avatar">'+esc(initials(a.name))+'</div><div class="grow">'+
    '<div class="row" style="align-items:flex-start"><div class="title grow">'+nameWithKnown(a.name,a.knownAs)+'</div><button type="button" class="trash pencil" data-act="edit-app" data-id="'+esc(ref)+'" aria-label="Edit details">\u270F\uFE0F</button><button type="button" class="trash" data-act="remove-app" data-id="'+esc(ref)+'" aria-label="Delete applicant" title="Delete applicant">\uD83D\uDDD1</button></div>'+
    '<div class="contact-line">'+(a.mobile?'<a target="_blank" rel="noopener" href="'+esc(telHref(a.mobile))+'">\uD83D\uDCF1 '+esc(a.mobile)+'</a>':'')+(a.email?'<a target="_blank" rel="noopener" href="mailto:'+esc(a.email)+'">\u2709 '+esc(a.email)+'</a>':'')+'</div>'+
    '<div style="margin-block-start:8px"><span class="pill '+st.c+'">'+esc(st.t)+'</span><span class="pill">'+esc(a.ref)+'</span></div>'+
    (personById(a.personId)?'<div class="row" style="gap:8px;margin-block-start:8px;align-items:center">'+personPill(personById(a.personId).status)+'<button class="btn sm" type="button" data-act="person" data-id="'+esc(a.personId)+'">\uD83E\uDDD1 Person record'+(personApps(a.personId).length>1?' \u00B7 '+personApps(a.personId).length+' applications':'')+'</button></div>':'')+'</div></div>'+
    '<dl class="kv"><dt>Property</dt><dd>'+esc(a.address1)+(a.address2?', '+esc(a.address2):'')+'</dd>'+(a.rent!==''?'<dt>Rent</dt><dd>'+esc(money(a.rent))+'</dd>':'')+
      (a.applyToken?'<dt>Form</dt><dd>'+(a.formType==='Tenancy Services'?'Tenancy Services pre-tenancy form':'Full application')+'</dd>':'')+
    (a.moveIn?'<dt>Move in</dt><dd>'+esc(fmtDate(a.moveIn))+'</dd>':'')+(a.tenancy?'<dt>Tenancy</dt><dd>'+esc(a.tenancy)+'</dd>':'')+
    (v?'<dt>Viewing</dt><dd>'+esc(fmt(v.viewingAt))+'</dd>':'')+(a.source?'<dt>Heard via</dt><dd>'+esc(a.source)+'</dd>':'')+(a.notes?'<dt>Notes</dt><dd>'+esc(a.notes)+'</dd>':'')+'</dl>'+
    '<div class="timeline">'+firstStep(a)+sentStep(a)+stepCell(isOpened(a),'Opened',a.viewedAt)+stepCell(a.status==='Finalized','Returned',a.signedAt)+'</div>'+
    (a.lastError?'<div class="err" style="margin-block-start:10px">'+esc(a.lastError)+'</div>':'')+
    (a.applyToken&&a.status==='Cancelled'?'<div class="small muted" style="margin-block-start:10px">Online form <b>cancelled</b> '+esc(fmtDate(a.applyExpires))+' \u2014 the link no longer works'+(a.email?'. Resend link sends them a new one.':'.')+'</div>':'')+
    (a.applyToken&&a.status!=='Finalized'&&a.status!=='Cancelled'&&a.applyExpires?'<div class="small muted" style="margin-block-start:10px">Online form link '+(new Date(a.applyExpires)<new Date()?'<b style="color:var(--bad)">expired</b> '+esc(fmtDate(a.applyExpires))+' \u2014 tap Resend link for a new one':'works until '+esc(fmtDate(a.applyExpires)))+'</div>':'')+
    '<div class="row wrap" style="margin-block-start:12px">'+
      (!sent(a)&&canSend(a)?'<button class="btn sm primary" type="button" data-act="send-one" data-id="'+esc(ref)+'">\u2709 Send application form</button>':'')+
      (a.srid&&a.status!=='Finalized'?'<button class="btn sm" type="button" data-act="refresh-one" data-id="'+esc(ref)+'">\u21BB Check status</button>':'')+
      (a.applyToken&&a.applyLink&&a.status!=='Finalized'&&a.status!=='Cancelled'&&String(a.mobile||'').replace(/\D/g,'').length>8?'<a class="btn sm primary" target="_blank" rel="noopener" href="'+esc(smsLinkFor(a))+'">\uD83D\uDCAC Text the link</a>':'')+
      (a.applyToken&&a.status!=='Finalized'?(a.status==='Cancelled'?'':'<button class="btn sm" type="button" data-act="copy-link" data-id="'+esc(ref)+'">\uD83D\uDD17 Copy form link</button>')+(a.email?'<button class="btn sm" type="button" data-act="resend-link" data-id="'+esc(ref)+'">\u2709 Resend link</button>':'')+'':'')+
      (a.applyToken&&a.status==='In Progress'?'<button class="btn sm ghost" type="button" data-act="show-progress" data-id="'+esc(ref)+'">\uD83D\uDCCB Show progress</button>':'')+
      (a.applyToken&&(a.status==='Sent'||a.status==='In Progress')?'<button class="btn sm danger" type="button" data-act="cancel-form" data-id="'+esc(ref)+'">\u2715 Cancel form</button>':'')+
      (a.pdfUrl?'<a class="btn sm ghost" target="_blank" rel="noopener" href="'+esc(a.pdfUrl)+'">\uD83D\uDCC4 Signed application</a>':'')+
      (a.viewingId?'<button class="btn sm" type="button" data-act="detach-app" data-id="'+esc(ref)+'">Remove from viewing</button>':'')+
      '</div></div>';
  // TM 3.17.2: the files they uploaded with the form, each opening in the app's viewer (loaded with the credit details)
  // 3.17.3: a section, closed until you open it (then it stays open while you move around, like the others)
  if(a.status==='Finalized') h+=sectionHtml('files','\uD83D\uDCCE Supplied files',S.credit&&S.credit[ref]?filesPill(S.credit[ref].files):'',
    '<div class="card" id="filesBox" data-paint data-later>'+(S.credit&&S.credit[ref]?suppliedFilesHtml(S.credit[ref].files):'<div class="row"><span class="spin"></span><span class="small muted">Loading their files\u2026</span></div>')+'</div>',false,true);

  var g=groupOf(groupKey(a));
  h+='<div class="card tap" data-act="group" data-id="'+esc(groupKey(a))+'" style="padding-block:12px"><div class="row"><div class="grow"><div class="small muted">Applying with</div><div style="font-weight:750">'+
    (g&&g.members.length>1? '\uD83D\uDC65 '+esc(groupName(groupKey(a)))+' \u00B7 '+g.members.length+' people' : '\uD83D\uDE4B On their own')+'</div><div>'+originPill(g?g.lead:a,false)+
    (g&&g.lead.decision?'<span class="pill dec">'+esc(g.lead.decision)+'</span>':'')+'</div></div><span class="chev">\u203A</span></div></div>';
  if(a.status==='Finalized'){
    h+=sectionHtml('refs','Reference checks',a.refs?checkedPill(a.refs):'','<div class="card" id="refBox" data-paint data-later><div class="row"><span class="spin"></span><span class="small muted">Loading references\u2026</span></div></div>',false,
      !!(a.refs&&a.refs.total&&a.refs.done>=a.refs.total));
  } else if(sent(a)){
    h+='<div class="card small muted">Reference details appear here once '+esc(a.name.split(' ')[0])+' completes and signs the application form.</div>';
  }
  h+=sectionHtml('tt','Tenancy Tribunal check',tribunalPill(a),'<div class="card" id="ttBox" data-paint data-later><div class="row"><span class="spin"></span><span class="small muted">Preparing searches\u2026</span></div></div>',false,!!tribunalPill(a));
  h+=sectionHtml('credit','Credit check',(a.creditCheck?'<span class="pill">'+esc(a.creditCheck)+'</span>':'<span class="pill">Not recorded</span>')+finesPill(a),
    '<div class="card"><div id="cxId" data-paint data-later class="row wrap" style="gap:8px;align-items:center;margin-block-end:12px"><span class="small muted">Looking for their photo ID\u2026</span></div>'+
    '<div class="row" style="gap:8px;align-items:flex-end"><label class="fld grow" style="margin:0"><span>Credit check score</span><input type="text" id="apCredit" value="'+esc(a.creditCheck)+'" placeholder="e.g. 637/1000"></label></div>'+
    '<div class="row" style="gap:8px;align-items:flex-end;margin-block-start:10px"><label class="fld grow" style="margin:0"><span>Outstanding court fines?</span><select id="apFines">'+[['','Not checked'],['No','No'],['Yes','Yes']].map(function(o){ return '<option value="'+o[0]+'"'+(String(a.courtFines||'')===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('')+'</select></label>'+
    '<button class="btn primary" type="button" data-act="save-credit" data-id="'+esc(ref)+'">Save</button></div>'+
    '<div class="row wrap" style="gap:10px;align-items:center;margin-block-start:12px"><button class="btn sm" type="button" data-act="centrix-copy" data-id="'+esc(ref)+'">\uD83D\uDCCB Copy for Centrix</button>'+
    '<a class="btn sm" target="_blank" rel="noopener" href="'+CENTRIX_URL+'" data-cx-open="'+esc(ref)+'">\uD83D\uDD0E Open Centrix</a>'+
    '<a class="small" target="_blank" rel="noopener" href="'+CENTRIX_SETUP+'">How to fill Centrix with it</a></div><div class="small muted" id="cxNote" data-paint data-later style="margin-block-start:6px"></div></div>');
  $('#app').innerHTML=h;
  loadCredit(ref).then(function(c){ var n=$('#cxNote'); if(n) n.innerHTML=centrixNote(c); var p=$('#cxId'); if(p) p.innerHTML=photoIdHtml(c); var fb=$('#filesBox'); if(fb) fb.innerHTML=suppliedFilesHtml(c.files); var fs=$('[data-sect="files"] .sect-s'); if(fs) fs.innerHTML=filesPill(c.files); })
    .catch(function(e){ var p=$('#cxId'); if(p) p.innerHTML=''; var fb=$('#filesBox'); if(fb) fb.innerHTML='<div class="err">'+esc(e&&e.message||'Couldn\u2019t load their files')+'</div>'; });
  loadRefs(ref).then(function(r){ var box=$('#refBox'); if(box) box.innerHTML=refListHtml(r); var tb=$('#ttBox'); if(tb) tb.innerHTML=tribunalHtml(a,r); })
    .catch(function(e){ var box=$('#refBox'); if(box) box.innerHTML='<div class="err">'+esc(e.message)+'</div>'; var tb=$('#ttBox'); if(tb) tb.innerHTML='<div class="err">'+esc(e.message)+'</div>'; });
};
/* ---- Centrix credit check: copy the applicant's details for the Fill Centrix bookmark ---- */
/* Centrix report options: court fines and property ownership both included, and the court fines terms ticked
   (the application form's credit check consent covers the fines check) */
var CENTRIX_OPTIONS={courtFines:'Y',propertyOwnership:'Y',acceptTerms:true};
var CENTRIX_SETUP='https://kelvinbox.github.io/tenancy-esign/centrix.html', CENTRIX_URL='https://ws.centrix.co.nz/Bureau/Secure/ConsumerCreditReport.aspx';
function loadCredit(ref){
  S.credit=S.credit||{};
  if(S.credit[ref]) return Promise.resolve(S.credit[ref]);
  return api.tmCreditDetails(ref).then(function(c){ S.credit[ref]=c; return c; });
}
/* Legal name -> first, middle and surname ("van der Berg" stays together) */
function splitName(n){
  var w=String(n||'').trim().split(/\s+/).filter(Boolean), last=[];
  if(!w.length) return {first:'',middle:'',last:''};
  last.unshift(w.pop());
  while(w.length>1 && /^(van|von|der|den|de|da|di|du|del|della|le|la|st|bin|binti|al|el|ter|ten)$/i.test(w[w.length-1])) last.unshift(w.pop());
  return {first:w.shift()||'',middle:w.join(' '),last:last.join(' ')};
}
/* One-line NZ address -> the form's lines: "Flat 2, 12 Smith St, Mornington, Dunedin 9011" */
function nzAddress(s){
  var parts=String(s||'').split(/\s*[,\n]\s*/).map(function(x){ return x.trim(); }).filter(Boolean);
  var out={line1:'',line2:'',suburb:'',city:'',postcode:''};
  if(parts.length && /^(new zealand|nz|aotearoa)$/i.test(parts[parts.length-1])) parts.pop();
  if(!parts.length) return out;
  var m=/^(.*?)\s*\b(\d{4})$/.exec(parts[parts.length-1]);
  if(m){ out.postcode=m[2]; if(m[1]) parts[parts.length-1]=m[1]; else parts.pop(); }
  if(!parts.length) return out;
  out.line1=parts.shift();
  var u=/^(?:flat|unit|apartment|apt)\s*(\w+)$/i.exec(out.line1);
  if(u && parts.length && /^\d/.test(parts[0])) out.line1=u[1]+'/'+parts.shift();
  if(parts.length) out.city=parts.pop();
  if(parts.length) out.suburb=parts.pop();
  if(parts.length) out.line2=parts.join(', ');
  return out;
}
/* "2 years 3 months" -> "2"; "6 months" -> "0"; "since 2019" -> years since; "" if it can't tell */
function yearsAt(s){
  s=String(s||'').toLowerCase();
  var y=/(\d+(?:\.\d+)?)\s*(?:years?|yrs?|y\b)/.exec(s), mo=/(\d+)\s*(?:months?|mths?|mos?|m\b)/.exec(s), since=/\b(19|20)\d{2}\b/.exec(s);
  if(y||mo) return String(Math.floor((y?+y[1]:0)+(mo?+mo[1]:0)/12));
  if(since) return String(Math.max(0,new Date().getFullYear()-(+since[0])));
  var n=/^\s*(\d+(?:\.\d+)?)\s*$/.exec(s); return n? String(Math.floor(+n[1])) : '';
}
function addrKey(s){ return String(s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }
function centrixData(c){
  var nm=splitName(c.name), dob=String(c.dob||'').slice(0,10).split('-'), a1=nzAddress(c.address), a2=null;
  a1.years=yearsAt(c.howLong);
  if(c.prevAddress && addrKey(c.prevAddress)!==addrKey(c.address)){ a2=nzAddress(c.prevAddress); a2.years=yearsAt(c.prevHowLong); }
  return {reference:c.ref||'',fullName:c.name||'',surname:nm.last,firstName:nm.first,middleName:nm.middle,
    dobDay:dob.length===3?dob[2]:'',dobMonth:dob.length===3?dob[1]:'',dobYear:dob.length===3?dob[0]:'',
    licenceNumber:c.licenceNumber||'',licenceVersion:c.licenceVersion||'',email:c.email||'',a1:a1,a2:a2,
    options:CENTRIX_OPTIONS};
}
/* Every file supplied with the online form, under the question it answered: [{k, label, files: [{name, url}]}].
   They're Drive file links, so a tap opens them in the app's viewer (see DRIVE_FILE below), for everyone using the app. */
function filesPill(groups){ var n=(groups||[]).reduce(function(t,g){ return t+g.files.length; },0); return countPill(n,'file'); }
function suppliedFilesHtml(groups){
  groups=groups||[];
  if(!groups.length) return '<div class="small muted">No files were uploaded with this application.</div>';
  return groups.map(function(g){
    return '<div class="small muted" style="margin-block:8px 4px">'+esc(g.label)+'</div><div class="row wrap" style="gap:8px">'+
      g.files.map(function(f){ return '<a class="btn sm ghost" target="_blank" rel="noopener" href="'+esc(f.url)+'" title="'+esc(f.name)+'" style="max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+
        (/\.pdf$/i.test(f.name)?'\uD83D\uDCC4 ':'\uD83D\uDDBC\uFE0F ')+esc(f.name)+'</a>'; }).join('')+'</div>';
  }).join('');
}
/* Quick links to the photo ID uploaded on the online form (else the uploads folder) */
function photoIdHtml(c){
  var list=c.photoId||[];
  if(list.length) return list.map(function(f,i){ return '<button class="btn sm ghost" type="button" data-act="photo-id" data-id="'+esc(c.ref)+'" data-i="'+i+'" data-n="'+esc(f.name)+'" title="'+esc(f.name)+'">\uD83E\uDEAA Photo ID'+(list.length>1?' '+(i+1):'')+'</button>'; }).join('');
  if(c.uploadsFolder) return '<a class="btn sm ghost" target="_blank" rel="noopener" href="'+esc(c.uploadsFolder)+'">\uD83D\uDCC1 Uploaded files</a>';
  return '<span class="small muted">No photo ID was uploaded with this application.</span>';
}
/* Files kept in Google Drive (photo ID, signed applications, agreements, receipts) open here, fetched by the server, so
   they open for everyone using the app, not only the Drive owner. p resolves to {name, mime, data (base64)}. */
function fileView(p,name,driveUrl){
  var m=modal('<div class="row" style="gap:8px"><b class="grow" style="overflow-wrap:anywhere">'+esc(name||'File')+'</b><button class="btn sm" type="button" data-x>Close</button></div>'+
    '<div id="fvBody" style="margin-block-start:12px;text-align:center"><div class="row" style="justify-content:center;gap:8px;padding:30px 0"><span class="spin"></span><span class="muted">Loading\u2026</span></div></div>'), url='';
  $('.box',m).classList.add('wide');
  function close(){ m.remove(); if(url) URL.revokeObjectURL(url); }
  m.addEventListener('click',function(e){ if(e.target===m||e.target.closest('[data-x]')) close(); });
  var drive=driveUrl? ' <a class="btn sm ghost" target="_blank" rel="noopener" href="'+esc(driveUrl)+'">Open in Google Drive</a>' : '';
  p.then(function(r){
    var bin=atob(r.data), u8=new Uint8Array(bin.length); for(var k=0;k<bin.length;k++) u8[k]=bin.charCodeAt(k);
    url=URL.createObjectURL(new Blob([u8],{type:r.mime}));
    var btns='<div class="row wrap" style="justify-content:center;gap:8px;margin-block-start:10px"><a class="btn sm" href="'+url+'" download="'+esc(r.name)+'">Save a copy</a>'+
      (r.mime==='application/pdf'?'<a class="btn sm" href="'+url+'" target="_blank" rel="noopener">Open full screen</a>':'')+drive+'</div>', box=$('#fvBody',m); if(!box) return;
    if(/^image\//.test(r.mime)){
      box.innerHTML='<img alt="'+esc(r.name)+'" src="'+url+'" style="max-width:100%;max-height:72vh;border-radius:12px;display:block;margin:0 auto">'+btns;
      $('img',box).addEventListener('error',function(){ box.innerHTML='<div class="small muted">This browser can\u2019t show this kind of picture ('+esc(r.mime)+'). Save a copy to open it.</div>'+btns; });
    } else if(r.mime==='application/pdf') box.innerHTML='<iframe title="'+esc(r.name)+'" src="'+url+'" style="width:100%;height:72vh;border:0;border-radius:12px;background:#fff"></iframe>'+btns;
    else box.innerHTML='<div class="small muted">This file can\u2019t be shown here.</div>'+btns;
  }).catch(function(x){ var box=$('#fvBody',m); if(box) box.innerHTML='<div class="err">'+esc(x&&x.message||'Couldn\u2019t load the file')+'</div>'+(drive?'<div style="margin-block-start:10px">'+drive+'</div>':''); });
}
/* Any link to a single Drive file opens in the viewer instead (folders still open in Drive) */
var DRIVE_FILE=/^https:\/\/(drive|docs)\.google\.com\/(file\/d\/|open\?id=|uc\?|(document|spreadsheets)\/d\/)/;
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a[href]'); if(!a||a.hasAttribute('download')||a.closest('.modal #fvBody')) return;
  var href=a.getAttribute('href'); if(!DRIVE_FILE.test(href)) return;
  e.preventDefault(); e.stopPropagation();
  fileView(api.tmDriveFile(href),(a.textContent||'').replace(/^[^A-Za-z0-9]+/,'').trim()||'File',href);
},true);
function centrixText(c){ return 'CENTRIX-FILL '+JSON.stringify(centrixData(c)); }
/* What will be filled, and what's missing (Centrix needs name, date of birth and an address) */
function centrixNote(c){
  var d=centrixData(c), miss=[];
  if(!d.dobYear) miss.push('date of birth');
  if(!d.a1.line1) miss.push('current address');
  if(!d.licenceNumber) miss.push('driver licence');
  return 'Copies '+esc([d.firstName,d.middleName,d.surname].filter(Boolean).join(' '))+(d.dobYear?', born '+esc(d.dobDay+'/'+d.dobMonth+'/'+d.dobYear):'')+
    (d.a1.line1?', '+esc([d.a1.line1,d.a1.suburb,d.a1.city,d.a1.postcode].filter(Boolean).join(', ')):'')+(d.a2?' and a previous address':'')+'.'+
    (miss.length?' <span style="color:var(--warn,#b45309);font-weight:700">Not on file: '+esc(miss.join(', '))+'.</span>':'');
}
function loadRefs(ref,force){
  if(!force && S.refs[ref]) return Promise.resolve(S.refs[ref]);
  return api.tmGetReferences(ref).then(function(r){ S.refs[ref]=r; if(r.shared && S.st) S.st.shared=r.shared; return r; });
}
function refListHtml(r){
  var list=r.contacts.filter(function(c){ return c.slot!=='None provided'; }), ref=r.app.ref;
  var h='';
  if(!r.contacts.length) h+='<div class="small muted">No references have been imported for this application. If the form was completed on the new template, re-import them below.</div>';
  else if(!list.length) h+='<div class="small muted">The applicant left every reference field blank. Ask for references directly, then add them here.</div>';
  list.forEach(function(c){
    var concern=c.outcome==='Concern';
    h+='<div class="ref-row" data-act="ref" data-id="'+esc(c.slot)+'" data-ref="'+esc(ref)+'"><span class="dot'+(concern?' concern':'')+'" data-s="'+esc(c.status)+'"></span><div class="grow">'+
      '<div class="title" style="font-size:.95rem">'+esc(c.contact||'(no name given)')+(sharedOf(ref,c.slot).length?' <span class="pill shared" style="vertical-align:2px">\uD83D\uDD17 Also for '+esc(sharedOf(ref,c.slot).map(function(o){ return o.applicant.split(' ')[0]; }).join(', '))+'</span>':'')+'</div><div class="small muted">'+esc(c.slot)+(c.relationship&&c.slot.indexOf('Landlord')<0?' \u00B7 '+esc(c.relationship):'')+''+(c.emailSent?' \u00B7 \u2709 emailed':'')+'</div>'+
      (noContact(c)?dncFlag('sm'):'')+'</div>'+
      '<div style="text-align:end"><div class="small" style="font-weight:700">'+esc(c.status)+'</div>'+(c.outcome?'<div class="small" style="color:'+(concern?'var(--bad)':c.outcome==='Positive'?'var(--ok)':'var(--muted)')+';font-weight:700">'+esc(c.outcome)+'</div>':'')+'</div><span class="chev">\u203A</span></div>';
  });
  h+='<div class="row wrap" style="margin-block-start:12px"><button class="btn sm ghost" type="button" data-act="add-contact" data-id="'+esc(ref)+'">\uFF0B Add a reference</button>'+
    '</div>';
  return h;
}

/* ----- The reference call ----- */
function guessSet(c,sets){
  var rel=(c.slot+' '+c.relationship).toLowerCase(), want;
  if(/landlord|property manager|\bpm\b|agent/.test(rel)) want=/landlord|property/;
  else if(/employ|manager|boss|work|supervisor|colleague/.test(rel)) want=/employ/;
  else if(/family|mum|dad|mother|father|sister|brother|aunt|uncle|parent|cousin|grand|nan|partner/.test(rel)) want=/family/;
  else want=/friend|flatmate|character/;
  var cat=want.test('landlord')?'Landlord':want.test('employ')?'Employer':want.test('family')?'Family':'Friend';
  var s=sets.find(function(x){ return !x.flags && (x.usedFor||[]).indexOf(cat)>=0; }) || sets.find(function(x){ return !x.flags && !(x.usedFor||[]).length && want.test(x.name.toLowerCase()); });
  return s? s.name : (sets.find(function(x){ return !x.flags; })||{}).name;
}
/* The applicant's signed application, archived in Google Drive */
function pdfLink(a){
  var url=a.driveUrl || (/drive\.google\.com|docs\.google\.com/.test(a.pdfUrl||'')? a.pdfUrl : '');
  if(url) return '<a class="btn sm ghost block" style="margin-block-start:8px" target="_blank" rel="noopener" href="'+esc(url)+'">\uD83D\uDCC4 '+esc(a.name.split(' ')[0])+'\u2019s signed application</a>';
  var msg= a.applyToken? (a.status==='Finalized'? 'The signed application isn\u2019t linked yet \u2014 tap \u21bb Refresh in a moment.' : 'The signed application appears here once '+a.name.split(' ')[0]+' submits the online form.')
    : a.srid? 'The signed DocHub application isn\u2019t in Google Drive yet \u2014 tap \u21bb Refresh to save it (a Drive folder needs to be set on the Setup tab).'
    : 'There\u2019s no signed application on file for '+a.name.split(' ')[0]+'.';
  return '<div class="small muted" style="margin-block-start:8px;text-align:center">'+esc(msg)+'</div>';
}
function draftKey(ref,slot){ return 'tm-ref-'+ref+'|'+slot; }
VIEWS.ref = function(arg){
  return loadRefs(arg.ref).then(function(r){
    var c=r.contacts.find(function(x){ return x.slot===arg.slot; }); if(!c){ back(); return; }
    setTitle(c.contact||c.slot);
    var sets=r.questions.filter(function(s){ return !s.flags; }), flags=r.questions.filter(function(s){ return s.flags; });
    var saved=r.answers[c.slot]||null, draft=null;
    try{ draft=JSON.parse(localStorage.getItem(draftKey(arg.ref,c.slot))||'null'); }catch(e){}
    var F=S.form={ ref:arg.ref, slot:c.slot,
      set: (draft&&draft.set)||(saved&&saved.set)||guessSet(c,sets),
      answers: (draft&&draft.answers)||(saved?saved.items:{})||{},
      status: (draft&&REF_STATUSES.indexOf(draft.status)>=0&&draft.status)||c.status||'Not started',
      outcome: (draft&&draft.outcome!=null)?draft.outcome:c.outcome,
      notes: (draft&&draft.notes!=null)?draft.notes:c.notes,
      checkedBy: (draft&&draft.checkedBy)||c.checkedBy||myName()||r.me||'' };
    var h='<div class="card"><div class="person"><div class="avatar">'+esc(initials(c.contact||c.slot))+'</div><div class="grow">'+
      '<div class="title">'+esc(c.contact||'(no name given)')+'</div><div class="small muted">'+esc(c.slot)+' for '+esc(r.app.name)+'</div>'+
      (noContact(c)?dncFlag(''):'')+'</div></div>'+
      '<dl class="kv">'+(c.relationship?'<dt>Relationship</dt><dd>'+esc(c.relationship)+'</dd>':'')+(c.phone?'<dt>Phone</dt><dd class="copy" data-copy="'+esc(c.phone)+'">'+esc(c.phone)+' <span>\uD83D\uDCCB</span></dd>':'')+
      (c.email?'<dt>Email</dt><dd class="copy" data-copy="'+esc(c.email)+'">'+esc(c.email)+' <span>\uD83D\uDCCB</span></dd>':'')+(c.address?'<dt>Rental</dt><dd>'+esc(c.address)+'</dd>':'')+
      (c.rent!==''?'<dt>Rent paid</dt><dd>'+esc(isFinite(Number(c.rent))?money(c.rent):c.rent)+'</dd>':'')+(c.vacated?'<dt>Moved out</dt><dd>'+esc(/^\d{4}-\d\d-\d\dT/.test(c.vacated)?fmtDate(c.vacated):c.vacated)+'</dd>':'')+
      (c.emailSent?'<dt>Emailed</dt><dd><button type="button" data-act="clear-emailed" title="Tap to clear" style="background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:underline dotted;cursor:pointer">\u2709 '+esc(fmt(c.emailSent))+'</button></dd>':'')+
      (c.checkedAt?'<dt>Last checked</dt><dd>'+esc(fmt(c.checkedAt))+(c.checkedBy?' by '+esc(c.checkedBy):'')+'</dd>':'')+'</dl>'+
      '<div class="callbar">'+(c.phone?'<a class="btn sm primary" target="_blank" rel="noopener" href="'+esc(telHref(c.phone))+'">\uD83D\uDCDE Call</a><a class="btn sm" target="_blank" rel="noopener" href="'+esc(smsHref(c.phone,refSmsText(c,r.app,sharedOf(arg.ref,c.slot))))+'">\uD83D\uDCAC Text</a>':'<span></span><span></span>')+
      (c.email?'<button class="btn sm" type="button" data-act="email-ref">\u2709 Email</button>':'<span></span>')+'</div>'+pdfLink(r.app)+'</div>';
    var others=sharedOf(arg.ref,c.slot);
    if(others.length){
      h+='<div class="sharebox"><div class="title">\uD83D\uDD17 '+esc(c.contact||'This contact')+' is also a reference for '+esc(others.length>1?others.length+' other applicants':others[0].applicant)+'</div>'+
        '<div class="small" style="margin-block-start:6px">One call can cover '+(others.length>1?'them all':'both')+' \u2014 ask about each applicant, and save the result for everyone below.</div>'+
        others.map(function(o){ return '<div class="row small" style="margin-block-start:8px;cursor:pointer" data-act="ref" data-ref="'+esc(o.ref)+'" data-id="'+esc(o.slot)+'"><span class="grow"><a href="#" data-noop="1">'+esc(o.applicant)+'</a> \u00B7 '+esc(o.slot)+(o.contact&&o.contact!==c.contact?' (listed as '+esc(o.contact)+')':'')+'</span><b>'+esc(o.status)+(o.outcome?' \u00B7 '+esc(o.outcome):'')+'</b></div>'; }).join('')+'</div>';
    }
    if(flags.length) h+='<details class="flags"><summary>\u26A0 What to listen for</summary>'+flags.map(function(f){ return (f.note?'<div style="margin-block-start:6px">'+esc(f.note)+'</div>':'')+'<ul>'+f.items.map(function(i){ return '<li>'+esc(i)+'</li>'; }).join('')+'</ul>'; }).join('')+'</details>';
    h+=sectStart('r-questions','Questions','')+'<div class="card"><div class="filters" style="margin-block-end:4px">'+sets.map(function(s){ return '<button type="button" data-act="qset" data-id="'+esc(s.name)+'" class="'+(F.set===s.name?'on':'')+'">'+esc(s.name)+'</button>'; }).join('')+'</div><div id="qList" data-paint data-later></div></div>'+SECT_END;
    h+=sectStart('r-result','Result','<span class="pill">'+esc(F.status)+'</span>'+(F.outcome?'<span class="pill">'+esc(F.outcome)+'</span>':''))+'<div class="card"><label class="fld" style="margin-block-end:4px"><span>Call status</span></label><div class="seg c4">'+
      REF_STATUSES.map(function(s){ return '<button type="button" data-seg="status" data-v="'+esc(s)+'" class="'+(F.status===s?'on':'')+'">'+esc(s)+'</button>'; }).join('')+'</div>'+
      '<label class="fld" style="margin-block-end:4px"><span>Outcome</span></label><div class="seg c3">'+
      OUTCOMES.map(function(s){ return '<button type="button" data-seg="outcome" data-v="'+esc(s)+'" class="'+(F.outcome===s?'on':'')+'">'+(s==='Positive'?'\uD83D\uDC4D ':s==='Concern'?'\u26A0 ':'\u3030 ')+esc(s)+'</button>'; }).join('')+'</div>'+
      '<label class="fld"><span>Summary notes</span><textarea id="rfNotes" placeholder="The overall picture in a sentence or two">'+esc(F.notes)+'</textarea></label>'+
      '<label class="fld"><span>Checked by</span><input type="text" id="rfBy" value="'+esc(F.checkedBy)+'"></label>'+
      (others.length?'<div class="fld" style="margin-block-end:12px"><span style="display:block;font-size:.78rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-block-end:6px">Also save this result for</span>'+
        others.map(function(o){ return '<label class="row small" style="gap:8px;margin-block-end:6px"><input type="checkbox" class="rfAlso" data-ref="'+esc(o.ref)+'" data-slot="'+esc(o.slot)+'"'+(o.status==='Not started'?' checked':'')+'><span><b>'+esc(o.applicant)+'</b> \u00B7 '+esc(o.slot)+(o.status!=='Not started'?' <span class="muted">(already '+esc(o.status.toLowerCase())+')</span>':'')+'</span></label>'; }).join('')+'</div>':'')+
      (saved&&saved.recordedAt?'<div class="small muted">Answers last saved '+esc(fmt(saved.recordedAt))+'</div>':'')+'</div>'+SECT_END;
    $('#app').innerHTML=h; drawQuestions(r);
    setFooter('<button class="btn" type="button" data-act="back">Close</button><button class="btn primary" type="button" data-act="save-ref">Save check</button>');
  });
};
function drawQuestions(r){
  var F=S.form, set=r.questions.find(function(s){ return s.name===F.set; }), box=$('#qList'); if(!box) return;
  if(!set && r.questions.some(function(s){ return !s.flags; })){ var c0=r.contacts.find(function(x){ return x.slot===F.slot; })||{slot:F.slot,relationship:''}; F.set=guessSet(c0,r.questions); set=r.questions.find(function(s){ return s.name===F.set; }); }
  if(!set){ box.innerHTML='<div class="small muted">Add screening questions in Setup \u203A Screening questions to see them here.</div>'; return; }
  box.innerHTML=(set.note?'<div class="small muted" style="margin-block:8px">'+esc(set.note)+'</div>':'')+set.items.map(function(q,i){
    var yn=/^(would|did|were|was|are|is|do|does|have|has|can)\b/i.test(q);
    return '<div class="q"><div class="qt"><i>'+(i+1)+'</i>'+esc(q)+'</div><textarea data-q="'+esc(q)+'" rows="2">'+esc(F.answers[q]||'')+'</textarea>'+
      (yn?'<div class="quick"><button type="button" data-quick="Yes">Yes</button><button type="button" data-quick="No">No</button><button type="button" data-quick="Hesitated">Hesitated</button></div>':'')+'</div>';
  }).join('');
}
function keepDraft(){ var F=S.form; if(!F) return; try{ localStorage.setItem(draftKey(F.ref,F.slot),JSON.stringify(F)); }catch(e){} }

/* ================= Tenancy Tribunal check =================
   "Run searches" asks your Apps Script to run each search on the Ministry of Justice Tenancy Tribunal search,
   one at a time. If that's unavailable, every search also has copy buttons for searching by hand on the site.
   Orders from the last 3 years only; names in orders aren't verified, so check the details. */
var TT_SITE='https://forms.justice.govt.nz/search/TT/index.html';
var STREET_WORDS=/^(street|st|road|rd|avenue|ave|lane|ln|place|pl|crescent|cres|drive|dr|terrace|tce|way|court|ct|grove|gr|close|parade|pde|highway|hwy|square|sq|flat|unit|apartment|apt)$/i;
function ttWords(t){ return String(t||'').replace(/\s+/g,' ').trim(); }
/* The searches for one applicant: full name, initial + wildcard, surname only, and every address they've given */
function ttPlan(a,addresses){
  var words=ttWords(a.name).split(' '), first=words[0]||'', surname=words.length>1? words[words.length-1] : '', plan=[];
  if(first&&surname){
    plan.push({label:'Full name',parts:[['First name',first],['Last name',surname]]});
    plan.push({label:'Initial + surname',parts:[['First name',first[0].toUpperCase()+'*'],['Last name',surname]]});
    plan.push({label:'Surname only',parts:[['Last name',surname]],broad:true});
  }
  (addresses||[]).forEach(function(ad){ var p=ttAddressParts(ad.address); if(p) plan.push({label:ad.label,parts:p,full:ad.address}); });
  return plan;
}
/* Street number + street name from the part of the address that names the street ("Flat 2, 12 Kent Rd" -> 12 / Kent Rd) */
function ttAddressParts(addr){
  var parts=String(addr||'').split(',');
  for(var i=0;i<parts.length;i++){
    var w=ttWords(parts[i]).split(' ').filter(function(x){ return x && !/^(flat|unit|apartment|apt)$/i.test(x); });
    var num=w.filter(function(x){ return /^\d+[a-z]?(\/\d+[a-z]?)?$/i.test(x); })[0]||'';
    var name=w.filter(function(x){ return x!==num && !/^\d+$/.test(x); }).join(' ');
    if(name && /[a-z]/i.test(name)){ var out=[]; if(num) out.push(['Street number',num]); out.push(['Street name',name]); return out; }
  }
  return null;
}
function ttSpec(p){ var m={'First name':'first','Last name':'last','Street number':'number','Street name':'street'}, o={}; p.parts.forEach(function(x){ o[m[x[0]]]=x[1]; }); return o; }
function ttDate(s){ s=String(s||''); return s.length===8? +s.slice(6,8)+'/'+ +s.slice(4,6)+'/'+s.slice(0,4) : ''; }
function ttResultHtml(d){
  return '<div class="ttdoc"><div class="row" style="align-items:flex-start;gap:8px"><div class="grow"><b>'+esc(ttDate(d.date))+'</b> \u00b7 Application '+esc(d.app)+'</div>'+
    (d.costs?'<span class="pill" style="margin:0">Costs to '+esc(d.costs.toLowerCase())+'</span>':'')+'</div>'+
    '<div class="small"><span class="muted">Applicant</span> '+esc(d.applicant)+'</div><div class="small"><span class="muted">Respondent</span> '+esc(d.respondent)+'</div>'+
    '<div class="small muted">'+esc(d.address)+'</div>'+
    (d.summary?'<details class="small" style="margin-block-start:4px"><summary style="cursor:pointer;color:var(--brand);font-weight:700">Order summary</summary><div style="margin-block-start:4px">'+esc(d.summary)+'\u2026</div></details>':'')+'</div>';
}
function ttResults(p){
  var r=S.tt.results[ttKey(p)]; if(!r) return '';
  if(r.busy) return '<div class="small muted" style="margin-block-start:8px"><span class="spin" style="width:14px;height:14px;border-width:2px;vertical-align:-2px"></span> Searching\u2026</div>';
  if(r.error) return '<div class="small" style="color:var(--miss);margin-block-start:8px">Couldn\u2019t search automatically ('+esc(r.error)+'). Use the copy buttons to search on the Justice site.</div>';
  var n=r.numFound, docs=r.docs||[];
  if(!n) return '<div class="small" style="color:var(--ok);font-weight:700;margin-block-start:8px">\u2713 No orders found</div>';
  return '<div class="small" style="color:var(--bad);font-weight:700;margin-block-start:8px">'+n+' order'+(n>1?'s':'')+' found \u2014 check whether '+(n>1?'any are':'it is')+' your applicant, then mark below</div>'+
    '<div class="ttlist">'+docs.slice(0,3).map(ttResultHtml).join('')+
    (docs.length>3?'<details><summary class="small" style="cursor:pointer;color:var(--brand);font-weight:700;padding:4px 0">Show '+(docs.length-3)+' more</summary><div class="ttlist">'+docs.slice(3).map(ttResultHtml).join('')+'</div></details>':'')+
    (n>docs.length?'<div class="small muted">Showing the latest '+docs.length+' of '+n+(p.broad?' \u2014 a broad search; check names and addresses carefully':'')+'.</div>':'')+'</div>';
}
function ttRunAll(){
  var plan=S.tt.plan.slice(), i=0;
  plan.forEach(function(p){ S.tt.results[ttKey(p)]={busy:true}; }); ttKeepRedraw();
  function next(){
    if(i>=plan.length){ ttSuggest(); return; }
    var p=plan[i++], k=ttKey(p);
    api.tmTribunalSearch(ttSpec(p)).then(function(r){ S.tt.results[k]=r; if(!r.numFound && !S.tt.marks[k]) S.tt.marks[k]='None'; },
      function(e){ S.tt.results[k]={error:e.message}; }).then(function(){ ttKeepRedraw(); setTimeout(next,300); });   // one at a time
  }
  next();
}
function ttKeepRedraw(){ var y=window.scrollY; ttRedraw(); window.scrollTo(0,y); }
/* Overall result follows the marks: any order found -> Order found; every search clear -> Clear */
function ttSuggest(){
  var anyFound=S.tt.plan.some(function(p){ return S.tt.marks[ttKey(p)]==='Found'; }), allNone=S.tt.plan.length && S.tt.plan.every(function(p){ return S.tt.marks[ttKey(p)]==='None'; });
  if(anyFound||allNone){ var want=anyFound?'Order found':'Clear'; [].forEach.call(document.querySelectorAll('[data-seg=tt]'),function(b){ b.classList.toggle('on',b.getAttribute('data-v')===want); }); }
}
function ttKey(p){ return p.label+'|'+p.parts.map(function(x){ return x[1]; }).join(' '); }
function tribunalPill(a){
  if(a.tribunal==='Clear') return '<span class="pill st-done" title="Tenancy Tribunal check clear">\u2696 Clear</span>';
  if(a.tribunal==='Order found') return '<span class="pill st-bad" title="Tenancy Tribunal order found">\u2696 Order found</span>';
  return '';
}
function tribunalHtml(a,r){
  var plan=ttPlan(a,(r&&r.tribunal&&r.tribunal.addresses)||[]);
  if(!S.tt||S.tt.ref!==a.ref) S.tt={ref:a.ref,marks:{},custom:[],results:{}};
  S.tt.plan=plan.concat(S.tt.custom);
  var ran=Object.keys(S.tt.results).length;
  var h='<div class="small muted" style="margin-block-end:10px">Searches the Ministry of Justice\u2019s published Tenancy Tribunal orders (last 3 years). Names in orders aren\u2019t verified \u2014 check the address and details before relying on a match.</div>'+
    '<div class="row" style="gap:8px;margin-block-end:6px"><button class="btn primary grow" type="button" data-act="tt-run">\u2696 '+(ran?'Run searches again':'Run searches')+'</button>'+
    '<a class="btn" target="_blank" rel="noopener" href="'+TT_SITE+'">Justice site</a></div>';
  h+=S.tt.plan.map(function(p,i){
    var mark=S.tt.marks[ttKey(p)]||'';
    return '<div class="ttrow"><div class="row" style="gap:8px;align-items:flex-start"><div class="grow"><div style="font-weight:700">'+esc(p.label)+(p.broad?' <span class="small muted" style="font-weight:600">(broad \u2014 many results for common names)</span>':'')+'</div>'+
      (p.full?'<div class="small muted">'+esc(p.full)+'</div>':'')+'</div></div>'+ttResults(p)+
      '<div class="ttparts">'+p.parts.map(function(x){ return '<button type="button" class="ttcopy" data-copy="'+esc(x[1])+'"><span class="muted">'+esc(x[0])+'</span> <b>'+esc(x[1])+'</b> <span aria-hidden="true">\uD83D\uDCCB</span></button>'; }).join('')+'</div>'+
      '<div class="seg c2" style="margin:8px 0 0"><button type="button" data-act="tt-mark" data-id="'+i+'" data-v="None" class="'+(mark==='None'?'on':'')+'">\u2713 Nothing found</button><button type="button" data-act="tt-mark" data-id="'+i+'" data-v="Found" class="'+(mark==='Found'?'on':'')+'" style="'+(mark==='Found'?'background:var(--grad-hot)':'')+'">\u2696 Order found</button></div></div>';
  }).join('');
  h+='<button class="btn sm block" type="button" data-act="tt-add" style="margin-block:12px 4px">\uFF0B Another name or address</button>';
  var done=S.tt.plan.filter(function(p){ return S.tt.marks[ttKey(p)]; }).length;
  h+='<div class="small muted" style="margin-block:8px">'+done+' of '+S.tt.plan.length+' searches marked</div>'+
    '<label class="fld" style="margin-block-end:4px"><span>Overall result</span></label>'+
    '<div class="seg c3"><button type="button" data-seg="tt" data-v="Clear" class="'+(a.tribunal==='Clear'?'on':'')+'">\u2713 Clear</button><button type="button" data-seg="tt" data-v="Order found" class="'+(a.tribunal==='Order found'?'on':'')+'">\u2696 Order found</button><button type="button" data-seg="tt" data-v="" class="">Not checked</button></div>'+
    '<label class="fld"><span>Notes</span><textarea id="ttNotes" placeholder="e.g. 2025 order for rent arrears, paid in full">'+esc(a.tribunalNotes)+'</textarea></label>'+
    (a.tribunalAt?'<div class="small muted" style="margin-block-end:8px">Last recorded '+esc(fmt(a.tribunalAt))+(a.tribunalBy?' by '+esc(a.tribunalBy):'')+'</div>':'')+
    '<button class="btn primary block" type="button" data-act="tt-save" data-id="'+esc(a.ref)+'">Save Tribunal check</button>';
  return h;
}
function ttRedraw(){ var a=appByRef(S.tt.ref), box=$('#ttBox'); if(a&&box) box.innerHTML=tribunalHtml(a,S.refs[a.ref]); }
function ttAddDialog(){
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:12px">Another search</div>'+
    '<div class="seg c2" id="ttKind"><button type="button" data-k="name" class="on">Name</button><button type="button" data-k="address">Address</button></div>'+
    '<label class="fld" id="ttF"><span>First name (optional)</span><input type="text" id="ttFirst" placeholder="e.g. Aroha or A*"></label>'+
    '<label class="fld" id="ttL"><span>Last name</span><input type="text" id="ttLast"></label>'+
    '<label class="fld hidden" id="ttA"><span>Address</span><input type="text" id="ttAddr" placeholder="e.g. 147a Cargill Street"></label>'+
    '<div class="row" style="justify-content:flex-end"><button class="btn" data-r="0" type="button">Cancel</button><button class="btn primary" data-r="1" type="button">Add search</button></div>');
  var kind='name';
  m.addEventListener('click',function(e){
    var k=e.target.closest('[data-k]'); if(k){ kind=k.getAttribute('data-k'); [].forEach.call(k.parentNode.children,function(b){ b.classList.toggle('on',b===k); });
      $('#ttF',m).classList.toggle('hidden',kind!=='name'); $('#ttL',m).classList.toggle('hidden',kind!=='name'); $('#ttA',m).classList.toggle('hidden',kind==='name'); return; }
    var b=e.target.closest('[data-r]'); if(!b) return;
    if(b.getAttribute('data-r')==='0'){ m.remove(); return; }
    var p=null;
    if(kind==='name'){
      var f=ttWords($('#ttFirst',m).value), l=ttWords($('#ttLast',m).value);
      if(!l){ toast('Enter at least a last name'); return; }
      p={label:'Name',parts:(f?[['First name',f]]:[]).concat([['Last name',l]])};
    } else {
      var ad=ttWords($('#ttAddr',m).value), parts=ttAddressParts(ad); if(!parts){ toast('Enter an address with a street name'); return; }
      p={label:'Address',parts:parts,full:ad};
    }
    S.tt.custom.push(p); m.remove(); ttRedraw();
    var k=ttKey(p); S.tt.results[k]={busy:true}; ttKeepRedraw();
    api.tmTribunalSearch(ttSpec(p)).then(function(r){ S.tt.results[k]=r; if(!r.numFound && !S.tt.marks[k]) S.tt.marks[k]='None'; },function(e){ S.tt.results[k]={error:e.message}; }).then(function(){ ttKeepRedraw(); ttSuggest(); });
  });
}
function ttSearchSummary(){
  return S.tt.plan.map(function(p){ var m=S.tt.marks[ttKey(p)]; return p.label+' "'+p.parts.map(function(x){ return x[1]; }).join(' ')+'": '+(m==='Found'?'order found':m==='None'?'nothing found':'not marked'); }).join('; ');
}

/* ================= Dialogs ================= */
function modal(inner){ var m=document.createElement('div'); m.className='modal'; m.innerHTML='<div class="box">'+inner+'</div>'; document.body.appendChild(m); return m; }
function ask(msg,ok){
  return new Promise(function(res){
    var m=modal('<div style="margin-block-end:14px">'+msg+'</div><div class="row" style="justify-content:flex-end"><button class="btn" data-r="0" type="button">Cancel</button><button class="btn primary" data-r="1" type="button">'+esc(ok||'OK')+'</button></div>');
    m.addEventListener('click',function(e){ var b=e.target.closest('[data-r]'); if(!b) return;
      S.askVals={}; Array.prototype.forEach.call(m.querySelectorAll('[data-keep]'),function(x){ S.askVals[x.id]=x.value; });
      m.remove(); res(b.getAttribute('data-r')==='1'); });
  });
}
/* Which online form to send: the full application or the shorter Tenancy Services pre-tenancy form (remembered) */
var FORM_TYPES=[['Full','Full application'],['Tenancy Services','Tenancy Services pre-tenancy form (shorter)']];
function formPickHtml(){
  if(!(S.st&&S.st.applyMode)) return '';
  var cur='Full'; try{ cur=localStorage.getItem('tm-form')||'Full'; }catch(e){}
  return '<label class="fld" style="margin-block-start:12px"><span>Form to send</span><select id="askForm" data-keep>'+
    FORM_TYPES.map(function(f){ return '<option value="'+esc(f[0])+'"'+(f[0]===cur?' selected':'')+'>'+esc(f[1])+'</option>'; }).join('')+'</select></label>';
}
function pickedForm(){ var f=(S.askVals||{}).askForm||''; if(f){ try{ localStorage.setItem('tm-form',f); }catch(e){} } return f; }
function editAppDialog(a){
  var key=groupKey(a), sel=groupPickerHtml(a,'atGroup');
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:12px">Edit details</div>'+attendeeFields(a)+sel+'<div id="atErr" class="err"></div>'+
    '<div class="row" style="justify-content:flex-end;margin-block-start:8px"><button class="btn" data-r="0" type="button">Cancel</button><button class="btn primary" data-r="1" type="button">Save</button></div>');
  wireGroupPicker(m,'atGroup',a);
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-r]'); if(!b) return;
    if(b.getAttribute('data-r')==='0'){ m.remove(); return; }
    var d=readAttendee(m); if(!d) return;
    d.ref=a.ref;
    var gs=$('#atGroup',m); if(gs && gs.value!==key) d.group=gs.value;
    busy(b,'Saving',api.tmSaveAttendee(a.viewingId,d)).then(function(r){ apply(r.state); m.remove();
      var moved=d.email && a.email && d.email.toLowerCase()!==a.email.toLowerCase() && sent(a) && a.status!=='Finalized';
      toast(moved? (a.applyToken?'Saved. The form link went to the old email \u2014 tap Resend link to send it to the new one.':'Saved. The DocHub form was sent to the old email.') : 'Details saved', moved?6000:2600); render(); }).catch(function(){});
  });
}
function moveGroupDialog(a){
  var key=groupKey(a);
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:12px">Who is '+esc(a.name.split(' ')[0])+' applying with?</div>'+groupPickerHtml(a,'mgSel')+
    '<div class="row" style="justify-content:flex-end;margin-block-start:8px"><button class="btn" data-r="0" type="button">Cancel</button><button class="btn primary" data-r="1" type="button">Save</button></div>');
  wireGroupPicker(m,'mgSel',a);
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-r]'); if(!b) return;
    var v=$('#mgSel',m).value;
    if(b.getAttribute('data-r')==='0' || v===key){ m.remove(); return; }
    busy(b,'Saving',api.tmSetGroup(a.ref,v)).then(function(st){ apply(st); m.remove(); toast('Group updated'); render(); }).catch(function(){});
  });
}
/* ----- Decline email for a whole group ----- */
function nameList(names){ return names.length<2? names.join('') : names.slice(0,-1).join(', ')+' and '+names[names.length-1]; }
function declineText(people,a,from){
  var multi=people.length>1;
  return { subject:'Your application for '+a.address1,
    body:['Hi '+nameList(people.map(function(x){ return x.name.split(' ')[0]; }))+',','',
      'Thank you for coming to view '+a.address1+' and for taking the time to apply'+(multi?' together':'')+'.','',
      'We\u2019ve now considered all the applications, and unfortunately on this occasion your application has not been successful.','',
      'We really appreciate your interest and wish you all the best in finding a suitable property.','',
      'Kind regards,'].concat(String(from||'').split('\n').filter(Boolean)).join('\n') };
}
function declineDialog(a){
  var all=groupMembers(groupKey(a)), withEmail=all.filter(function(x){ return x.email; }), noEmail=all.filter(function(x){ return !x.email; });
  var from=mySignoff()||localStorage.getItem('tm-host')||'';
  if(/^[^\n]*@[^\n]*$/.test(from)) from='';
  var t=declineText(withEmail.length?withEmail:all,a,from);
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:4px">Decline email'+(all.length>1?' \u2014 '+esc(groupName(groupKey(a))):'')+'</div>'+
    '<div class="small muted" style="margin-block-end:12px">Check the wording, then open it in your mail app to send.</div>'+
    '<label class="fld" style="margin-block-end:8px"><span>Send to</span></label>'+
    withEmail.map(function(x){ return '<label class="row small" style="gap:8px;margin-block-end:6px"><input type="checkbox" data-to="'+esc(x.email)+'" data-first="'+esc(x.name.split(' ')[0])+'" checked><b>'+whoHtml(x)+'</b><span class="muted">'+esc(x.email)+'</span></label>'; }).join('')+
    (noEmail.length?'<div class="small" style="color:var(--miss);margin-block:4px 8px">No email for '+esc(nameList(noEmail.map(whoText)))+' \u2014 they won\u2019t receive this.</div>':'')+
    '<label class="fld" style="margin-block-start:10px"><span>Subject</span><input type="text" id="dcSubj" value="'+esc(t.subject)+'"></label>'+
    '<label class="fld"><span>Your name</span><input type="text" id="dcFrom" value="'+esc(from)+'" placeholder="Sign off as\u2026"></label>'+
    '<label class="fld"><span>Message</span><textarea id="dcBody" rows="10" style="min-height:220px">'+esc(t.body)+'</textarea></label>'+
    (all.some(function(x){ return x.decision!=='Declined'; })?'<label class="row small" style="gap:8px;margin-block-end:12px"><input type="checkbox" id="dcMark" checked> Mark '+(all.length>1?'everyone in the group':esc(a.name.split(' ')[0]))+' as Declined</label>':'')+
    '<div id="dcErr" class="err"></div>'+
    '<div class="row wrap" style="justify-content:flex-end;margin-block-start:8px"><button class="btn" data-r="0" type="button">Cancel</button>'+
    '<button class="btn" data-r="copy" type="button">Copy text</button><a class="btn primary" id="dcGo" target="_blank" rel="noopener" href="#">\u2709 Open email</a></div>');
  var edited=false;
  function to(){ return [].filter.call(m.querySelectorAll('[data-to]'),function(c){ return c.checked; }); }
  function update(){
    // keep the greeting and sign-off in step with who's ticked, unless the message has been edited by hand
    if(!edited){ var who=to().map(function(c){ return {name:c.getAttribute('data-first')}; }); $('#dcBody',m).value=declineText(who.length?who:withEmail,a,$('#dcFrom',m).value.trim()).body; }
    var list=to().map(function(c){ return c.getAttribute('data-to'); }), go=$('#dcGo',m);
    go.href='mailto:'+list.join(',')+'?subject='+encodeURIComponent($('#dcSubj',m).value)+'&body='+encodeURIComponent($('#dcBody',m).value.replace(/\n/g,'\r\n'));
    go.style.pointerEvents=list.length?'':'none'; go.style.opacity=list.length?'':'.45';
    $('#dcErr',m).textContent=list.length?'':'Tick at least one person to send to.';
  }
  m.addEventListener('input',function(e){ if(e.target.id==='dcBody') edited=true; if(e.target.id==='dcFrom'){ try{ localStorage.setItem('tm-checker',e.target.value.trim()); }catch(x){} } update(); });
  m.addEventListener('change',update); update();
  function markDeclined(){
    var mk=$('#dcMark',m); if(!mk||!mk.checked) return Promise.resolve();
    return api.tmUpdateApplication(a.ref,{decision:'Declined',applyToGroup:true}).then(function(st){ apply(st); toast(all.length>1?'Group marked as Declined':'Marked as Declined'); });
  }
  m.addEventListener('click',function(e){
    if(e.target.closest('#dcGo')){ if(!to().length){ e.preventDefault(); return; } markDeclined().then(function(){ m.remove(); render(); }).catch(function(x){ toast(x.message,5000); }); return; }
    var b=e.target.closest('[data-r]'); if(!b) return;
    if(b.getAttribute('data-r')==='0'){ m.remove(); return; }
    if(b.getAttribute('data-r')==='copy'){ var list=to().map(function(c){ return c.getAttribute('data-to'); });
      copyText('To: '+list.join(', ')+'\nSubject: '+$('#dcSubj',m).value+'\n\n'+$('#dcBody',m).value,'Email text copied'); }
  });
}
/* Delete an applicant at any stage - says exactly what goes, and asks for confirmation */
function deleteDialog(a,btn){
  var mates=groupMembers(groupKey(a)).filter(function(x){ return x.ref!==a.ref; });
  var lost=['their row on the Applications sheet'];
  if(a.status==='Finalized'||a.refs) lost.push('their reference contacts and any reference-check answers you\u2019ve recorded');
  if(a.applyToken) lost.push('their online application answers');
  if(a.decision) lost.push('the decision ('+a.decision+')');
  if(String(a.creditCheck||'').trim()||a.courtFines) lost.push('the credit check result');
  var hasFiles=!!(a.applyToken||a.driveUrl);
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:8px">Delete '+whoHtml(a)+'?</div>'+
    '<div class="small" style="margin-block-end:8px">This permanently removes '+esc(lost.length>1? lost.slice(0,-1).join(', ')+' and '+lost[lost.length-1] : lost[0])+'.</div>'+
    (a.status==='Finalized'?'<div class="small" style="color:var(--miss);margin-block-end:8px">'+esc(a.name.split(' ')[0])+' has already submitted their application.</div>':'')+
    (a.srid&&a.status!=='Finalized'?'<div class="small" style="color:var(--miss);margin-block-end:8px">Their DocHub form has been sent. Void it in DocHub as well so they can\u2019t still sign it.</div>':'')+
    (a.applyToken&&a.status!=='Finalized'?'<div class="small muted" style="margin-block-end:8px">Their online form link stops working straight away.</div>':'')+
    (mates.length?'<div class="small muted" style="margin-block-end:8px">The rest of '+esc(groupName(groupKey(a)))+' stays as a group.</div>':'')+
    (hasFiles?'<label class="row small" style="gap:8px;margin-block:4px 10px"><input type="checkbox" id="delFiles" checked> Also move their uploaded documents and signed application to the Drive bin (recoverable for 30 days)</label>':'')+
    '<div class="row" style="justify-content:flex-end;margin-block-start:8px"><button class="btn" data-r="0" type="button">Cancel</button><button class="btn danger" data-r="1" type="button" id="delGo">Delete</button></div>');
  var go=$('#delGo',m);
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-r]'); if(!b) return;
    if(b.getAttribute('data-r')==='0'){ m.remove(); return; }
    if(go.disabled) return;
    var files=!!($('#delFiles',m)&&$('#delFiles',m).checked);
    busy(go,'Deleting',api.tmRemoveAttendee(a.ref,{trashFiles:files})).then(function(st){
      apply(st); m.remove(); delete S.refs[a.ref];
      toast(a.name.split(' ')[0]+' deleted'+(st.removed&&st.removed.files?' (documents moved to the Drive bin)':''));
      back();
    }).catch(function(){});
  });
}
/* Move a booked group to another arrival time */
/* Text message with the online form link; wording comes from "Online SMS Message" on the Setup tab */
function smsText(a){
  var t=(S.st&&S.st.smsTemplate)||'Your application form for {{Property}} can be found here: {{Link}}';
  return t.replace(/{{\s*Property\s*}}/g,a.address1||'the property').replace(/{{\s*Link\s*}}/g,a.applyLink||'')
          .replace(/{{\s*FirstName\s*}}/g,String(a.name).split(' ')[0]).replace(/{{\s*Name\s*}}/g,a.name);
}
/* "Show progress": what the applicant has filled in so far (saved answers from the online form), step by step */
function progressDialog(a){
  var first=String(a.name||'').split(' ')[0]||'Applicant';
  var m=modal('<div class="row" style="align-items:flex-start"><div class="grow"><div class="title" style="font-size:1.1rem">'+esc(first)+'\u2019s form so far</div>'+
    '<div class="small muted" id="pgMeta">Loading\u2026</div></div><button class="btn sm" type="button" data-pg="close" aria-label="Close">\u2715</button></div>'+
    '<div id="pgBody" class="pg"><div class="small muted" style="padding:18px 0">Getting their latest answers \u2014 this can take a few seconds.</div></div>'+
    '<div class="row wrap" style="justify-content:flex-end;margin-block-start:12px">'+
      (mobileOk(a)?'<a class="btn sm primary" target="_blank" rel="noopener" href="'+esc(nudgeLink(a))+'">\uD83D\uDCAC Text them a nudge</a>':'')+
      '<button class="btn sm" type="button" data-pg="refresh">\u21BB Refresh</button></div>');
  m.querySelector('.box').classList.add('pgbox');
  function load(){
    $('#pgMeta',m).textContent='Loading\u2026';
    api.tmGetProgress(a.ref).then(function(p){ if(document.body.contains(m)) drawProgress(m,p); })
      .catch(function(e){ $('#pgMeta',m).textContent=''; $('#pgBody',m).innerHTML='<div class="err" style="padding:12px 0">'+esc(e&&e.message||'Couldn\u2019t load their progress')+'</div>'; });
  }
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-pg]'); if(!b){ if(e.target===m) m.remove(); return; }
    if(b.getAttribute('data-pg')==='close') m.remove(); else load();
  });
  load();
}
function drawProgress(m,p){
  if(p.submitted){ $('#pgMeta',m).textContent=''; $('#pgBody',m).innerHTML='<div style="padding:12px 0">They\u2019ve submitted their application \u2014 refresh the app to open the signed copy.</div>'; return; }
  var pct=Math.round(p.done/p.total*100);
  $('#pgMeta',m).textContent=(p.formType==='Tenancy Services'?'Tenancy Services form':'Full application')+(p.lastSaved?' \u00B7 last saved '+ago(p.lastSaved):' \u00B7 nothing saved yet');
  var h='<div class="pgbar"><i style="width:'+pct+'%"></i></div><div class="small muted" style="margin-block-end:6px">'+p.done+' of '+p.total+' steps done'+
    (p.missing?' \u00B7 '+p.missing+' required answer'+(p.missing>1?'s':'')+' missing':'')+'</div><div class="pglist">';
  p.steps.forEach(function(s){
    var icon=s.status==='done'?'\u2705':s.status==='started'?'\uD83D\uDFE1':'\u25CB';
    h+='<div class="pgstep '+s.status+'"><div class="pghead">'+icon+' '+esc(s.title)+(s.current?' <span class="pill" style="margin-inline-start:6px">up to here</span>':'')+'</div>';
    if(s.status==='empty') h+='<div class="small muted pgnone">Not started</div>';
    else h+='<dl class="pgkv">'+s.rows.map(function(r){
      if(r.files&&r.files.length) return '<dt>'+esc(r.l)+'</dt><dd>'+r.files.map(function(f){
        return '<a class="pgfile" target="_blank" rel="noopener" href="'+esc(f.url)+'">'+(/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)?'\uD83D\uDDBC\uFE0F ':'\uD83D\uDCC4 ')+esc(f.name)+'</a>'; }).join('')+'</dd>';
      return '<dt>'+esc(r.l)+'</dt><dd>'+(r.v?(r.file?'\uD83D\uDCCE ':'')+esc(r.v).replace(/\n/g,'<br>'):'')+(r.note?'<span class="pgmiss">'+esc(r.note)+'</span>':'')+(!r.v&&!r.note?'<span class="muted">\u2014</span>':'')+'</dd>'; }).join('')+'</dl>';
    h+='</div>';
  });
  h+='<div class="pgstep empty"><div class="pghead">\u25CB Agree and sign</div><div class="small muted pgnone">Their ticks and signature are only saved when they submit.</div></div></div>';
  $('#pgBody',m).innerHTML=h;
}
/* "x min ago" for a saved time */
function ago(iso){
  var t=new Date(iso).getTime(); if(!t) return '';
  var s=Math.max(0,(Date.now()-t)/1000);
  return s<90?'just now':s<3600?Math.round(s/60)+' min ago':s<86400?Math.round(s/3600)+' h ago':fmtDate(iso);
}
/* Text message reminding them about their form, with their private link */
function nudgeLink(a){
  var first=String(a.name||'').split(' ')[0]||'there';
  var body='Hi '+first+', just checking in on your rental application for '+(a.address1||'the property')+'. You can pick up where you left off here: '+(a.applyLink||'');
  return 'sms:'+String(a.mobile||'').replace(/[^\d+]/g,'')+'?&body='+encodeURIComponent(body);
}
function smsLinkFor(a){ return 'sms:'+String(a.mobile||'').replace(/[^\d+]/g,'')+'?&body='+encodeURIComponent(smsText(a)); }
/* Move a booked group: another open time at this viewing, or a different viewing and one of its times */
function changeTimeDialog(key){
  var l=groupLead(key), cur=viewingById(l.viewingId); if(!cur) return;
  var mine=groupArrival(key), vid=cur.id, pick=mine;
  var choices=((S.st&&S.st.viewings)||[]).filter(function(v){ return v.id===cur.id || v.status==='Scheduled'; })
    .sort(function(a,b){ return a.viewingAt.localeCompare(b.viewingAt); });
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:10px">Move '+esc(groupName(key))+'</div>'+
    '<label class="fld"><span>Viewing</span><select id="mvView">'+choices.map(function(v){ return '<option value="'+esc(v.id)+'"'+(v.id===cur.id?' selected':'')+'>'+esc(v.address1)+' \u2014 '+esc(new Date(v.viewingAt).toLocaleDateString('en-NZ',{weekday:'short',day:'numeric',month:'short'}))+', '+esc(fmtTime(v.viewingAt))+(v.id===cur.id?' (current)':'')+'</option>'; }).join('')+'</select></label>'+
    '<div id="mvNote" class="small" style="color:var(--miss);margin-block:-4px 8px"></div>'+
    '<label class="fld" style="margin-block-end:6px"><span>Arrival time</span></label><div class="slotpick" id="mvSlots"></div>'+
    '<label class="fld" style="margin-block-start:12px"><span>Or another time</span><input type="time" id="ctOther"></label>'+
    '<div class="row" style="justify-content:flex-end"><button class="btn" data-r="0" type="button">Cancel</button><button class="btn primary" data-r="1" type="button">Move</button></div>');
  function drawSlots(){
    var v=viewingById(vid), taken={};
    groupsAt(v.id).forEach(function(g){ var t=groupArrival(g.key); if(t&&g.key!==key) taken[t]=1; });
    if(vid!==cur.id){ var free=slotsFor(v).filter(function(t){ return !taken[t]; }); pick=free[0]||0; } else pick=mine;
    $('#mvSlots',m).innerHTML=slotsFor(v).map(function(t){ return '<button type="button" data-t="'+t+'" class="'+(taken[t]?'taken':'')+(t===pick?' on':'')+'"'+(taken[t]?' disabled':'')+'>'+esc(fmtTime(t))+'</button>'; }).join('')||'<div class="small muted">This viewing has no arrival times set.</div>';
    $('#mvNote',m).textContent= v.address1!==cur.address1? 'This viewing is for a different property \u2014 the group\u2019s property will change to '+v.address1+'.' : '';
    $('#ctOther',m).value='';
  }
  drawSlots();
  $('#mvView',m).addEventListener('change',function(e){ vid=e.target.value; drawSlots(); });
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-t]'); if(b&&!b.disabled){ pick=+b.getAttribute('data-t'); [].forEach.call(b.parentNode.children,function(x){ x.classList.toggle('on',x===b); }); $('#ctOther',m).value=''; return; }
    var r=e.target.closest('[data-r]'); if(!r) return;
    if(r.getAttribute('data-r')==='0'){ m.remove(); return; }
    var v=viewingById(vid), o=$('#ctOther',m).value; if(o) pick=new Date(dateInput(v.viewingAt)+'T'+o).getTime();
    if(!pick){ toast('Choose an arrival time'); return; }
    if(vid===cur.id && pick===mine){ m.remove(); return; }
    var p= vid===cur.id? api.tmSetGroupArrival(key,new Date(pick).toISOString()) : api.tmMoveGroupToViewing(key,vid,new Date(pick).toISOString());
    busy(r,'Moving',p).then(function(st){ apply(st); m.remove();
      toast(groupName(key)+' moved to '+(vid!==cur.id? v.address1+', '+new Date(v.viewingAt).toLocaleDateString('en-NZ',{weekday:'short',day:'numeric',month:'short'})+' at ' : '')+fmtTime(pick));
      render(); }).catch(function(){});
  });
}
/* Add a person to a group that didn't come from a viewing */
function addToGroupDialog(key){
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:12px">Add to '+esc(groupName(key))+'</div>'+attendeeFields({})+'<div id="atErr" class="err"></div>'+
    '<div class="row" style="justify-content:flex-end;margin-block-start:8px"><button class="btn" data-r="0" type="button">Cancel</button><button class="btn primary" data-r="1" type="button">Add</button></div>');
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-r]'); if(!b) return;
    if(b.getAttribute('data-r')==='0'){ m.remove(); return; }
    var d=readAttendee(m); if(!d) return;
    busy(b,'Adding',api.tmAddToGroup(key,d)).then(function(st){ apply(st); m.remove(); toast(d.name.split(' ')[0]+' added'); render(); }).catch(function(){});
  });
}
function addContactDialog(ref){
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:12px">Add a reference</div>'+
    '<label class="fld"><span>Name</span><input type="text" id="acName"></label>'+
    '<div class="grid2"><label class="fld"><span>Relationship</span><input type="text" id="acRel" placeholder="Employer, landlord, friend\u2026"></label>'+
    '<label class="fld"><span>Phone</span><input type="tel" id="acPhone"></label></div>'+
    '<label class="fld"><span>Email (optional)</span><input type="email" id="acEmail"></label><div id="acErr" class="err"></div>'+
    '<div class="row" style="justify-content:flex-end;margin-block-start:8px"><button class="btn" data-r="0" type="button">Cancel</button><button class="btn primary" data-r="1" type="button">Add reference</button></div>');
  m.addEventListener('click',function(e){
    var b=e.target.closest('[data-r]'); if(!b) return;
    if(b.getAttribute('data-r')==='0'){ m.remove(); return; }
    var c={name:$('#acName',m).value.trim(),relationship:$('#acRel',m).value.trim(),phone:$('#acPhone',m).value.trim(),email:$('#acEmail',m).value.trim()};
    if(!c.name&&!c.phone){ $('#acErr',m).textContent='Enter a name or phone number.'; return; }
    if(!validEmail(c.email)){ $('#acErr',m).textContent='That email address doesn\u2019t look right.'; return; }
    busy(b,'Adding',api.tmAddContact(ref,c)).then(function(r){ S.refs[ref]=r; m.remove(); toast('Reference added'); render(); }).catch(function(){});
  });
}
/* Email a reference: pick which question sets to include, then open a pre-written email */
function slotPhrase(c){
  if(c.slot==='Current Landlord') return 'their current landlord / property manager';
  if(c.slot==='Previous Landlord') return 'a previous landlord / property manager';
  return c.relationship? 'a referee ('+c.relationship.toLowerCase()+')' : 'a referee';
}
function refEmailBody(c,r,sets,from){
  var a=r.app, first=String(c.contact||'').trim().split(/\s+/)[0];
  var L=[(first?'Hi '+first+',':'Hello,'),'',
    a.name+' has applied for a rental property and has listed you as '+slotPhrase(c)+'. '+
    'I\u2019d be grateful if you could answer the questions below \u2014 a short reply under each one is plenty.'];
  var n=0;
  sets.forEach(function(set){
    L.push('');
    if(sets.length>1) L.push(set.name,'');
    set.items.forEach(function(q){ n++; L.push(n+'. '+q,''); });
  });
  L.push('If it\u2019s easier to talk, just reply with a good time to call.','','Thank you,');
  String(from||'').split('\n').forEach(function(x){ if(x) L.push(x); });
  return L.join('\r\n').replace(/(\r\n){3,}/g,'\r\n\r\n');
}
function markEmailSent(sent){
  var F=S.form; if(!F) return;
  api.tmMarkEmailSent(F.ref,F.slot,sent).then(function(r){ S.refs[F.ref]=r; if(S.form===F && S.cur.view==='ref') render(); toast(sent?'Marked as emailed':'Email flag cleared'); })
    .catch(function(e){ toast(e.message,5000); });
}
function emailRefDialog(){
  var F=S.form, r=S.refs[F.ref], c=r.contacts.find(function(x){ return x.slot===F.slot; });
  var sets=r.questions.filter(function(s){ return !s.flags; });
  var from=mySignoff();   // the person writing the email (Setup > My details), not whoever is recorded as checking
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:4px">Email '+esc(c.contact||'this reference')+'</div>'+
    '<div class="small muted" style="margin-block-end:12px">Choose the questions to include. The email opens in your mail app ready to check and send.</div>'+
    sets.map(function(s){ return '<label class="row" style="gap:10px;padding:10px 12px;border:2px solid var(--line);border-radius:14px;margin-block-end:8px;cursor:pointer">'+
      '<input type="checkbox" data-set="'+esc(s.name)+'"'+(s.name===F.set?' checked':'')+'><span class="grow" style="font-weight:700">'+esc(s.name)+'</span><span class="small muted">'+s.items.length+' questions</span></label>'; }).join('')+
    (myProfile().name?'':'<div class="small" style="margin-block:4px 8px">\u270D It will be signed <b>'+esc(from||'(blank)')+'</b>. Add your name and phone in <b>Setup \u203A My details</b> to sign off properly.</div>')+
    '<div id="emWarn" class="small" style="color:var(--miss);margin-block:4px 8px"></div>'+
    '<div class="row wrap" style="justify-content:flex-end;margin-block-start:8px"><button class="btn" data-r="0" type="button">Cancel</button>'+
    '<button class="btn" data-r="copy" type="button">Copy text</button><a class="btn primary" id="emGo" target="_blank" rel="noopener" href="#">\u2709 Open email</a></div>');
  function picked(){ var on={}; [].forEach.call(m.querySelectorAll('[data-set]'),function(cb){ if(cb.checked) on[cb.getAttribute('data-set')]=1; }); return sets.filter(function(s){ return on[s.name]; }); }
  function body(){ return refEmailBody(c,r,picked(),from); }
  function update(){
    var p=picked(), go=$('#emGo',m), href='mailto:'+String(c.email).trim()+'?subject='+encodeURIComponent('Tenancy reference for '+r.app.name)+'&body='+encodeURIComponent(body());
    go.href=href; go.classList.toggle('disabled',!p.length); go.style.pointerEvents=p.length?'':'none'; go.style.opacity=p.length?'':'.45';
    $('#emWarn',m).textContent=!p.length? 'Tick at least one set of questions.' : href.length>1900? 'That\u2019s a long email \u2014 some mail apps cut off very long pre-filled messages. If it looks incomplete, use Copy text instead.' : '';
  }
  m.addEventListener('change',update); update();
  m.addEventListener('click',function(e){
    if(e.target.closest('#emGo')){ if(!picked().length){ e.preventDefault(); return; } F.set=picked()[0].name; keepDraft(); setTimeout(function(){ m.remove(); },300); markEmailSent(true); return; }
    var b=e.target.closest('[data-r]'); if(!b) return;
    if(b.getAttribute('data-r')==='0'){ m.remove(); return; }
    if(b.getAttribute('data-r')==='copy'){
      if(!picked().length) return;
      var txt='To: '+c.email+'\nSubject: Tenancy reference for '+r.app.name+'\n\n'+body().replace(/\r\n/g,'\n');
      copyText(txt,'Email text copied');
    }
  });
}
function readAttendee(scope){
  var d={name:$('#atName',scope).value.trim(),mobile:$('#atMobile',scope).value.trim(),email:$('#atEmail',scope).value.trim(),notes:$('#atNotes',scope).value.trim()};
  var err=$('#atErr',scope);
  if(!d.name){ err.textContent='Enter their name.'; $('#atName',scope).focus(); return null; }
  if(!d.email&&!d.mobile){ err.textContent='Add a mobile or email so you can reach them.'; return null; }
  if(!validEmail(d.email)){ err.textContent='That email address doesn\u2019t look right.'; $('#atEmail',scope).focus(); return null; }
  err.textContent=''; return d;
}

/* ================= Actions ================= */
function sendForms(refs,btn,formType){
  if(!HAS_GAS && !Demo.on) return Promise.resolve();
  return busy(btn,'Sending',api.tmSendApplications(refs,{formType:formType||'Full'})).then(function(r){
    apply(r.state);
    var ok=r.results.filter(function(x){ return x.ok && !x.emailError; }).length, bad=r.results.filter(function(x){ return !x.ok; }), noMail=r.results.filter(function(x){ return x.ok && x.emailError; });
    if(!noMail.length || bad.length || ok) toast(bad.length? (ok?ok+' sent. ':'')+bad.length+' failed: '+bad[0].error : (ok===1?'Application form sent':ok+' application forms sent'),bad.length?6000:2800);
    render();
    // no email address, or the email didn't go (the link is kept): text it
    var textThese=r.results.filter(function(x){ return x.ok; }).map(function(x){ var a=appByRef(x.ref); return a && (!a.email || x.emailError) && a.applyLink && mobileOk(a) ? a : null; }).filter(Boolean);
    if(textThese.length) textLinksDialog(textThese, noMail.length? noMail[0].emailError : '');
  });
}
/* People without an email get their link by text - one tap each opens Messages with the wording filled in */
function textLinksDialog(list,emailError){
  var m=modal('<div class="title" style="font-size:1.1rem;margin-block-end:6px">Text the form link</div>'+
    (emailError?'<div class="small" style="margin-block-end:8px;color:var(--bad)">The email didn\u2019t go: '+esc(emailError)+'</div>':'')+
    '<div class="small muted" style="margin-block-end:12px">'+(emailError?'The link is ready, so send it by text instead.':(list.length>1?'These people don\u2019t':esc(list[0].name.split(' ')[0])+' doesn\u2019t')+' have an email address, so send their link by text.')+' Each button opens Messages with the message ready to send.</div>'+
    list.map(function(a){ return '<a class="btn primary block" style="margin-block-end:8px" target="_blank" rel="noopener" data-done="1" href="'+esc(smsLinkFor(a))+'">\uD83D\uDCAC Text '+esc(whoText(a))+' ('+esc(a.mobile)+')</a>'; }).join('')+
    '<div class="row" style="justify-content:flex-end;margin-block-start:4px"><button class="btn" data-r="0" type="button">Done</button></div>');
  m.addEventListener('click',function(e){
    var a=e.target.closest('[data-done]'); if(a){ a.classList.remove('primary'); a.innerHTML='\u2713 '+a.innerHTML.replace(/^\uD83D\uDCAC /,''); return; }
    if(e.target.closest('[data-r]')) m.remove();
  });
}

function copyText(txt,msg){
  function legacy(){ var ta=document.createElement('textarea'); ta.value=txt; ta.setAttribute('readonly',''); ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0,txt.length);
    var ok=false; try{ ok=document.execCommand('copy'); }catch(x){} ta.remove(); toast(ok?(msg||'Copied'):'Couldn\u2019t copy \u2014 press and hold to select it'); }
  if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){ toast(msg||'Copied'); },legacy); else legacy();
}
document.addEventListener('click',function(e){
  var cp=e.target.closest('[data-copy]'); if(cp){ copyText(cp.getAttribute('data-copy'),'Copied '+cp.getAttribute('data-copy')); return; }
  var cxo=e.target.closest('[data-cx-open]');   // opening Centrix also copies the applicant, ready for Fill Centrix
  if(cxo){ var cxd=S.credit&&S.credit[cxo.getAttribute('data-cx-open')]; if(cxd) copyText(centrixText(cxd),'Copied \u2014 click Fill Centrix once the page opens'); return; }
  var t=e.target.closest('[data-act],[data-seg],[data-quick]'); if(!t) return;
  if(t.hasAttribute('data-quick')){ var ta=t.closest('.q').querySelector('textarea'); ta.value=t.getAttribute('data-quick')+(ta.value?' \u2014 '+ta.value.replace(/^(Yes|No|Hesitated)( \u2014 )?/,''):''); ta.dispatchEvent(new Event('input',{bubbles:true})); buzz(); return; }
  if(t.hasAttribute('data-seg')){
    var k=t.getAttribute('data-seg'), val=t.getAttribute('data-v'), grp=t.parentNode, was=t.classList.contains('on');
    [].forEach.call(grp.children,function(b){ b.classList.remove('on'); });
    if(!was) t.classList.add('on'); buzz();
    if(k==='dec'){ var gd=$('#gDecline'); if(gd) gd.classList.toggle('hidden',!(val==='Declined'&&!was)); }
    if(S.form && k==='status' && was){ t.classList.add('on'); return; }
    if(S.form && (k==='status'||k==='outcome')){ S.form[k]=was?'':val; if(k==='outcome' && !was && (!S.form.status||S.form.status==='Not started')){ S.form.status='Completed'; [].forEach.call(document.querySelectorAll('[data-seg=status]'),function(b){ b.classList.toggle('on',b.getAttribute('data-v')==='Completed'); }); } keepDraft(); }
    return;
  }
  var act=t.getAttribute('data-act'), id=t.getAttribute('data-id');
  if(act==='back') return back();
  if(act==='tab'){ S.tab=id; try{ localStorage.setItem('tm-tab',id); }catch(x){} S.stack=[]; S.cur={view:'home'}; render(); window.scrollTo(0,0); return; }
  if(act==='new-viewing') return go('viewingForm',null);
  if(act==='group') return go('group',id);
  if(act==='gfilter'){ S.gfilter=id; return render(); }
  if(act==='new-group'){ S.people=null; return go('newGroup'); }
  if(act==='book'){ S.people=null; return go('book',{viewingId:id,slot:t.getAttribute('data-slot')||''}); }
  if(act==='book-add'){ var bg=groupOf(id); S.people=null; return go('book',{viewingId:bg.lead.viewingId,group:id}); }
  if(act==='add-to-group') return addToGroupDialog(id);
  if(act==='add-person'){ S.people.push(blankPerson()); render(); var ins=document.querySelectorAll('[data-pf=name]'); if(ins.length) ins[ins.length-1].focus(); return; }
  if(act==='rm-person'){ S.people.splice(+id,1); return render(); }
  if(act==='pick-slot'){
    if(id==='other'){ var bo=$('#bkOther'); bo.classList.remove('hidden'); [].forEach.call(t.parentNode.children,function(b){ b.classList.toggle('on',b===t); }); $('#bkOtherT').focus(); S.bookSlot=0; return; }
    S.bookSlot=+id; return render();
  }
  if(act==='pick-source'){ S.ngSource=id; [].forEach.call(t.parentNode.children,function(b){ b.classList.toggle('on',b===t); }); return; }
  if(act==='gap'){
    [].forEach.call(t.parentNode.children,function(b){ b.classList.toggle('on',b===t); });
    var go2=$('#vfGapOther'); if(id==='other'){ go2.classList.remove('hidden'); $('#vfGapN').focus(); } else { go2.classList.add('hidden'); S.vfGap=+id; }
    slotPreview(); return;
  }
  if(act==='attend'){
    var cur=groupAttendance(id), nv2=t.getAttribute('data-v'); if(cur===nv2) nv2='';
    return busy(t,'Saving',api.tmSetAttendance(id,nv2)).then(function(st){ apply(st); buzz(); render(); }).catch(function(){});
  }
  if(act==='change-time') return changeTimeDialog(id);
  if(act==='save-book'){
    var err=checkPeople(); if(err){ $('#bkErr').textContent=err; return; }
    var ppl=S.people.filter(function(p){ return (p.name+p.mobile+p.email).trim(); });
    var arg=S.cur.arg;
    if(id){ // adding to an existing group
      var chain=Promise.resolve(), last=null;
      ppl.forEach(function(p){ chain=chain.then(function(){ return api.tmAddToGroup(id,p).then(function(st){ last=st; }); }); });
      return busy(t,'Adding',chain).then(function(){ apply(last); S.people=null; toast(ppl[0].name.split(' ')[0]+' added to '+groupName(id)); back(); }).catch(function(){});
    }
    var slot=S.bookSlot; if(!slot){ var ot=$('#bkOtherT'); var vv=viewingById(arg.viewingId); if(ot&&ot.value){ slot=new Date(dateInput(vv.viewingAt)+'T'+ot.value).getTime(); } }
    if(!slot){ $('#bkErr').textContent='Choose an arrival time.'; return; }
    return busy(t,'Booking',api.tmCreateGroup({viewingId:arg.viewingId,arrival:new Date(slot).toISOString(),people:ppl})).then(function(st){
      apply(st); S.people=null; toast((ppl.length>1?'Group':ppl[0].name.split(' ')[0])+' booked for '+fmtTime(slot)); back(); }).catch(function(){});
  }
  if(act==='save-group'){
    var props=(S.st&&S.st.properties)||[], prop=null;
    if(S.ngProp==='new'){ prop={address1:$('#ngA1').value.trim(),address2:$('#ngA2').value.trim(),rent:$('#ngRent').value,tenancy:$('#ngTen').value}; if(!prop.address1) prop=null; }
    else if(S.ngProp!=='') prop=props[+S.ngProp];
    if(!prop){ $('#bkErr').textContent='Choose the property.'; return; }
    var err2=checkPeople(); if(err2){ $('#bkErr').textContent=err2; return; }
    var ppl2=S.people.filter(function(p){ return (p.name+p.mobile+p.email).trim(); });
    return busy(t,'Creating',api.tmCreateGroup({property:prop,source:S.ngSource,notes:$('#ngNotes').value,people:ppl2})).then(function(st){
      apply(st); S.people=null; toast('Group created'); S.stack=[]; S.tab='groups'; S.cur={view:'home'}; if(st.created) go('group',st.created.group); else home(); }).catch(function(){});
  }
  if(act==='save-group-decision'){
    var dec=document.querySelector('[data-seg=dec].on'), gl=groupLead(id);
    return busy(t,'Saving',api.tmUpdateApplication(gl.ref,{decision:dec?dec.getAttribute('data-v'):'',decisionNotes:$('#gDecNotes').value,applyToGroup:true})).then(function(st){ apply(st); S.sectVisit=S.sectVisit||{}; S.sectVisit['g-decision']=true; toast('Decision saved'); render(); }).catch(function(){});
  }
  if(act==='tt-run'){ if(!S.tt) return; S.tt.results={}; ttRunAll(); return; }
  if(act==='tt-mark'){ var tp=S.tt.plan[+id], tk=ttKey(tp), tv=t.getAttribute('data-v'); S.tt.marks[tk]=S.tt.marks[tk]===tv?'':tv;
    ttKeepRedraw(); ttSuggest(); buzz(); return; }
  if(act==='sect'){ var sc=t.closest('.sect'), nowOpen=sc.classList.contains('closed'); sc.classList.toggle('closed',!nowOpen); t.setAttribute('aria-expanded',nowOpen);
    if(sc.hasAttribute('data-done')){ S.sectVisit=S.sectVisit||{}; S.sectVisit[id]=nowOpen; return; }   // finished: only for this visit
    try{ localStorage.setItem('tm-sect-'+id,nowOpen?'open':'closed'); }catch(x){} return; }
  if(act==='tt-add') return ttAddDialog();
  if(act==='tt-save'){
    var tsel=document.querySelector('[data-seg=tt].on'), tres=tsel? tsel.getAttribute('data-v') : '';
    return busy(t,'Saving',api.tmSaveTribunalCheck(id,{result:tres,notes:$('#ttNotes').value,searches:S.tt?ttSearchSummary():'',checkedBy:localStorage.getItem('tm-checker')||''})).then(function(st){ apply(st); toast(tres?'Tribunal check saved \u2014 '+tres:'Tribunal check cleared'); var y=window.scrollY; render(); setTimeout(function(){ window.scrollTo(0,y); },60); }).catch(function(){});
  }
  if(act==='centrix-copy'){
    var cxMsg='Copied \u2014 now click Fill Centrix on the Centrix page', cx=S.credit&&S.credit[id];
    if(cx) return copyText(centrixText(cx),cxMsg);
    return busy(t,'Copying',loadCredit(id)).then(function(c){ copyText(centrixText(c),cxMsg); }).catch(function(){});
  }
  if(act==='save-credit') return busy(t,'Saving',api.tmUpdateApplication(id,{creditCheck:$('#apCredit').value,courtFines:$('#apFines').value})).then(function(st){ apply(st); toast('Credit check saved'); var y=window.scrollY; render(); setTimeout(function(){ window.scrollTo(0,y); },60); }).catch(function(){});
  if(act==='edit-viewing') return go('viewingForm',id);
  if(act==='viewing') return go('viewing',id);
  if(act==='app') return go('app',id);
  if(act==='pick-host'){ $('#vfHost').value=id; [].forEach.call(t.parentNode.children,function(b){ b.classList.toggle('on',b===t); }); return; }
  if(act==='move-group') return moveGroupDialog(appByRef(id));
  if(act==='decline-email') return declineDialog(appByRef(id));
  if(act==='dnc-info') return dncInfo();
  if(act==='show-progress') return progressDialog(appByRef(id));
  if(act==='agreement-settings'){ S.pe=null; S.peTabNext='terms'; return go('propEdit',id); }
  // Setup: properties

  if(act==='photo-id') return fileView(api.tmPhotoIdFile(id,+t.getAttribute('data-i')),t.getAttribute('data-n')||'Photo ID','');
  if(act==='setup-props') return go('setupProps');
  if(act==='setup-landlords') return go('setupLandlords');
  if(act==='setup-notify') return go('notify');
  if(act==='setup-questions'){ S.qsE=null; return go('setupQuestions'); }
  if(act==='qs-toggle'){ S.qsOpen[id]=!S.qsOpen[id]; return keepScroll(render); }
  if(act==='qs-kind'){ var qk=S.qsE[+id]; qk.kind=t.getAttribute('data-k'); if(qk.kind==='Red flags') qk.usedFor=[]; return keepScroll(render); }
  if(act==='qs-set-add'){ S.qsE.push({id:'',name:'',note:'',kind:'Questions',usedFor:[],items:['']}); S.qsOpen[S.qsE.length-1]=true; keepScroll(render); var qn=document.querySelectorAll('[data-qs-name]'); if(qn.length) qn[qn.length-1].focus(); return; }
  if(act==='qs-set-up'||act==='qs-set-down'){ var a1=+id, b1=act==='qs-set-up'?a1-1:a1+1; if(b1<0||b1>=S.qsE.length) return;
    S.qsE.splice(b1,0,S.qsE.splice(a1,1)[0]); var o1=!!S.qsOpen[a1]; S.qsOpen[a1]=!!S.qsOpen[b1]; S.qsOpen[b1]=o1; return keepScroll(render); }
  if(act==='qs-set-del'){ var ds=S.qsE[+id];
    return ask('Delete the set <b>'+esc(ds.name||'(no name)')+'</b> and its '+ds.items.filter(String).length+' question(s)? Answers already given to it are kept with those referees.','Delete set').then(function(ok){
      if(!ok) return; S.qsE.splice(+id,1); S.qsOpen={}; keepScroll(render); }); }
  if(act==='qs-q-add'){ S.qsE[+id].items.push(''); keepScroll(render); var qq=document.querySelectorAll('[data-qs-q^="'+id+':"]'); if(qq.length) qq[qq.length-1].focus(); return; }
  if(act==='qs-q-del'||act==='qs-q-up'||act==='qs-q-down'){ var pq=id.split(':'), qset=S.qsE[+pq[0]], qi=+pq[1];
    if(act==='qs-q-del') qset.items.splice(qi,1);
    else { var qj=act==='qs-q-up'?qi-1:qi+1; if(qj<0||qj>=qset.items.length) return; qset.items.splice(qj,0,qset.items.splice(qi,1)[0]); }
    return keepScroll(render); }
  if(act==='qs-save'){ $('#qsErr').textContent='';
    return busy(t,'Saving',api.tmSaveScreeningQuestions(S.qsE)).then(function(r){ S.qsSaved=qsClone(r.sets); S.qsE=qsClone(r.sets); S.qsLegacy=false; S.refs={}; toast('Screening questions saved'); keepScroll(render); })
      .catch(function(x){ var er=$('#qsErr'); if(er) er.textContent=x.message; }); }
  if(act==='setup-terms'){ S.tmE=null; return go('setupTerms'); }
  if(act==='tm-add'){ S.tmE.push(''); keepScroll(render); var tq=document.querySelectorAll('[data-tm-at]'); if(tq.length) tq[tq.length-1].focus(); return; }
  if(act==='tm-del'){ S.tmE.splice(+id,1); return keepScroll(render); }
  if(act==='tm-up'||act==='tm-down'){ var ti=+id, tj=act==='tm-up'?ti-1:ti+1; if(tj<0||tj>=S.tmE.length) return; S.tmE.splice(tj,0,S.tmE.splice(ti,1)[0]); return keepScroll(render); }
  if(act==='tm-save') return busy(t,'Saving',api.tmSaveTermsMaster(S.tmE)).then(function(st){ apply(st); S.tmE=termsMaster().slice(); toast('Master list saved'); render(); })
    .catch(function(x){ $('#tmErr').textContent=x&&x.message||'Couldn\u2019t save'; });
  if(act==='tm-copy') return copyTermsDialog();
  if(act==='at-master'){ var mt=termsMaster().slice(); if(!mt.length) return toast('The master list is empty \u2014 add terms under Setup \u203A Additional terms',4500);
    var useM=function(){ S.pe.additionalTerms=mt; keepScroll(render); toast('Master list copied \u2014 tap Save property'); };
    if(!cleanTerms(S.pe.additionalTerms).length) return useM();
    return ask('Replace this property\u2019s '+cleanTerms(S.pe.additionalTerms).length+' term(s) with the master list ('+mt.length+')?','Replace').then(function(ok){ if(ok) useM(); }).catch(function(){}); }
  if(act==='prop-new') return newPropDialog('');
  if(act==='prop-clone') return newPropDialog(id);
  if(act==='hh-seg'){ var hs=S.pe.healthyHomes; hs[id]=hs[id]===t.getAttribute('data-v')?'':t.getAttribute('data-v'); return keepScroll(render); }
  if(act==='ins-seg'){ var ik=id.split('.'), io=S.pe.insulation[ik[0]]; io[ik[1]]=io[ik[1]]===t.getAttribute('data-v')?'':t.getAttribute('data-v'); return keepScroll(render); }
  if(act==='ch-add'){ S.pe.chattels.push(''); keepScroll(render); var ci=document.querySelectorAll('[data-pe-ch]'); if(ci.length) ci[ci.length-1].focus(); return; }
  if(act==='at-add'){ S.pe.additionalTerms.push(''); keepScroll(render); var ta=document.querySelectorAll('[data-pe-at]'); if(ta.length) ta[ta.length-1].focus(); return; }
  if(act==='at-del'){ S.pe.additionalTerms.splice(+id,1); return keepScroll(render); }
  if(act==='ch-del'){ S.pe.chattels.splice(+id,1); return keepScroll(render); }
  if(act==='ed-quick'){ var qo=[].filter.call(document.querySelectorAll('.qbOpt'),function(x){ return x.checked; }).map(function(x){ return x.value; });
    var qs=$('#qbSpecial').value.split('\n').map(function(x){ return x.trim(); }).filter(Boolean);
    S.pe.areas=buildLayout(+$('#qbBed').value||0,+$('#qbBath').value||0,+$('#qbWc').value||0,qo,qs); render(); toast('Areas generated \u2014 review and save'); return; }
  if(act==='ed-add'){ var at=$('#newAreaType').value, same=S.pe.areas.filter(function(a){ return a.type===at; }).length; S.pe.areas.push({id:uid('A'),name:same?at+' '+(same+1):at,type:at,items:LIB[at].slice(),notes:''}); return render(); }
  if(act==='ed-del'){ S.pe.areas.splice(+id,1); return render(); }
  if(act==='ed-up'){ var ui=+id, UA=S.pe.areas; if(ui>0){ UA.splice(ui-1,0,UA.splice(ui,1)[0]); render(); } return; }
  if(act==='ed-down'){ var di=+id, DA=S.pe.areas; if(di<DA.length-1){ DA.splice(di+1,0,DA.splice(di,1)[0]); render(); } return; }
  if(act==='prop-edit'){ S.pe=null; S.peQ=null; return go('propEdit',id); }
  if(act==='pe-search') return peSearch();

  if(act==='pe-tab'){ S.peTab=id; render(); window.scrollTo(0,0); return; }
  if(act==='room-add'&&S.pe){ S.pe.rooms=S.pe.rooms||[]; S.pe.rooms.push({name:nextRoomName(S.pe.rooms),rent:S.pe.rent,bond:S.pe.bond!==''&&S.pe.bond!=null?S.pe.bond:bond4(S.pe.rent),maxOccupants:1});
    return peUtilRedraw('[data-pe-room="'+(S.pe.rooms.length-1)+'.name"]'); }
  if(act==='room-del'&&S.pe){ S.pe.rooms.splice(+id,1); return peUtilRedraw(); }
  if(act==='prop-save'){
    var pe=S.pe, pErr=!String(pe.name||'').trim()?'Enter the property name.':propProblem(pe)||(!pe.areas.some(function(a){ return String(a.name||'').trim(); })?'Add at least one inspection area.':''), rErr=pErr?'':roomsProblem(pe);
    if(rErr) pErr=rErr;
    if(pErr){ var pt=rErr?'terms':/inspection area/.test(pErr)?'layout':'details'; if(S.peTab!==pt){ S.peTab=pt; render(); window.scrollTo(0,0); } $('#peErr').textContent=pErr; toast(pErr,4000); return; }
    var isNew=!pe.propertyId;
    return busy(t,'Saving',api.tmSaveProperty(pe)).then(function(st){ apply(st); S.pe=null; S.peResults=null; toast(isNew?'Property added':'Property saved'); back(); })
      .catch(function(x){ $('#peErr').textContent=x&&x.message||'Couldn\u2019t save'; });
  }
  if(act==='prop-active'){ var ap=setupPropById(id), on=!ap.active;
    var live=tenancies().filter(function(x){ return x.propertyId===id && tenancyPhase(x)!=='ended'; }).length;
    return ask((on?'Restore <b>'+esc(ap.name||ap.address1)+'</b>? It will show in the property lists and in Flat Inspections again.':'Archive <b>'+esc(ap.name||ap.address1)+'</b>? It won\u2019t show in property lists or to inspectors (past inspections and applications are kept).'+(live?'<div class="small" style="color:var(--bad);margin-block-start:8px">It has '+live+' current tenanc'+(live>1?'ies':'y')+'.</div>':'')),on?'Restore':'Archive').then(function(ok){ if(!ok) return;
      return busy(t,on?'Restoring':'Archiving',api.tmSetPropertyActive(id,on)).then(function(st){ apply(st); S.pe=null; toast(on?'Property restored':'Property archived'); back(); }); }).catch(function(){}); }
  // Setup: landlords
  if(act==='landlord-new'){ S.le=null; return go('landlordEdit',''); }
  if(act==='le-style'&&S.le){ S.le.brandStyle=id; return keepScroll(render); }
  if(act==='le-colour-reset'&&S.le){ S.le.brandColour=''; return keepScroll(render); }
  if(act==='le-logo-remove'&&S.le){ S.le.brandLogo=''; return keepScroll(render); }
  if(act==='landlord-edit'){ S.le=null; return go('landlordEdit',id); }
  if(act==='landlord-save'){
    var le=S.le, old=le._for==='new'?'':le._for;
    if(!le.name.trim()){ $('#leErr').textContent='Enter the landlord\u2019s name.'; return; }
    if(!le.email.trim()||!validEmail(le.email)){ $('#leErr').textContent='Enter an email address \u2014 the agreement is sent there.'; return; }
    var s2=[le.signer2Name,le.signer2Email,le.signer2Mobile].map(function(x){ return String(x||'').trim(); });
    if((s2[0]||s2[1]||s2[2])&&!(s2[0]&&s2[1])){ $('#leErr').textContent='For a second signer, enter both their name and email (or clear all three second-signer boxes).'; return; }
    if(s2[1]&&!validEmail(s2[1])){ $('#leErr').textContent='Check the second signer\u2019s email address.'; return; }
    if(s2[1]&&s2[1].toLowerCase()===le.email.trim().toLowerCase()){ $('#leErr').textContent='The two landlord signers need different email addresses.'; return; }
    return busy(t,'Saving',api.tmSaveLandlord(le,old)).then(function(st){ apply(st); S.le=null; toast(old?'Landlord saved':'Landlord added'); back(); })
      .catch(function(x){ $('#leErr').textContent=x&&x.message||'Couldn\u2019t save'; });
  }
  if(act==='landlord-delete') return ask('Delete <b>'+esc(id)+'</b> from the landlords list? Agreements already sent aren\u2019t affected.','Delete').then(function(ok){ if(!ok) return;
    return busy(t,'Deleting',api.tmDeleteLandlord(id)).then(function(st){ apply(st); S.le=null; toast('Landlord deleted'); back(); }); }).catch(function(x){ if(x) $('#leErr').textContent=x.message||'Couldn\u2019t delete'; });
  // Tenancies
  if(act==='tfilter'){ S.tfilter=id; return render(); }
  if(act==='tenancy') return go('tenancy',id);
  if(act==='tenant-profile'){ S.tp=null; return go('tenantProfile',id); }
  if(act==='group-edit') return groupEditDialog(id);
  if(act==='group-delete') return groupDeleteDialog(id,t);
  if(act==='progress-preview'||act==='change-progress') return busy(t,'Loading',act==='progress-preview'?api.tmAgreementProgress(id):api.tmChangeProgress(id))
    .then(function(r){ previewDialog('Signing progress: '+r.signed+' of '+r.signers+' signed',r.html); }).catch(function(){});
  if(act==='pfilter'){ S.pfilter=id; return render(); }
  if(act==='person'){ S.ps=null; return go('person',id); }
  if(act==='person-save'){ var psv={id:S.ps._for}; Object.keys(S.ps).forEach(function(k){ if(k!=='_for') psv[k]=S.ps[k]; });
    return busy(t,'Saving',api.tmSavePerson(psv)).then(function(st){ apply(st); S.ps=null; toast('Saved'); render(); }).catch(function(x){ var pe=$('#psErr'); if(pe) pe.textContent=x&&x.message||'Couldn\u2019t save'; }); }
  if(act==='person-merge'){ var keep=personById(S.cur.arg), drop=personById(id); if(!keep||!drop) return;
    return ask('Merge <b>'+esc(drop.name)+'</b> into <b>'+esc(keep.name)+'</b>? Their applications and tenancies move to '+esc(keep.name)+'\u2019s record, blank details are filled in from theirs, and their separate record is removed.','Merge').then(function(ok){ if(!ok) return;
      return busy(t,'Merging',api.tmMergePeople(keep.id,drop.id)).then(function(st){ apply(st); S.ps=null; toast('Merged'); render(); }); }).catch(function(x){ if(x) toast(x.message||'Couldn\u2019t merge',5000); }); }
  if(act==='admin-pin') return adminPinDialog();
  if(act==='speed-check') return speedDialog();
  if(act==='my-details') return myDetailsDialog();
  if(act==='test-suite') return go('testSuite');
  if(act==='test-new') return testNewDialog();
  if(act==='test-add') return testAddDialog();
  if(act==='tp-save'){ var tpp=String(S.tp.key).split('|');
    return busy(t,'Saving',api.tmSaveTenantProfile(tpp[0],+tpp[1],S.tp.ten,S.tp.ans)).then(function(st){ apply(st); S.tp.data=st.profile; S.tp.ten=clone(st.profile.tenant); S.tp.ans={}; toast('Tenant details saved'); render(); })
      .catch(function(x){ var te=$('#tpErr'); if(te) te.textContent=x&&x.message||'Couldn\u2019t save'; }); }
  if(act==='tenancy-new'){ S.tf=null; return go('tenancyForm',''); }
  if(act==='tenancy-edit'){ S.tf=null; return go('tenancyForm',id); }
  if(act==='tf-status'){ S.tf.status=id; [].forEach.call(t.parentNode.children,function(b){ b.classList.toggle('on',b===t); }); return; }
  if(act==='tf-add'){ S.tf.tenants.push(blankTenant(S.tf.start)); render(); var tn=document.querySelectorAll('[data-tt=name]'); if(tn.length) tn[tn.length-1].focus(); return; }
  if(act==='tf-rm'){ S.tf.tenants.splice(+id,1); return render(); }
  if(act==='tf-save'){
    var tf=S.tf, tErr=tenancyProblem(tf); if(tErr){ $('#tfErr').textContent=tErr; return; }
    var tNew=!tf.id;
    return busy(t,'Saving',api.tmSaveTenancy(tf)).then(function(st){ apply(st); S.tf=null; toast(tNew?'Tenancy added':'Tenancy saved');
      if(tNew&&st.savedTenancyId){ S.cur={view:'tenancy',arg:st.savedTenancyId}; render(); } else back(); })
      .catch(function(x){ $('#tfErr').textContent=x&&x.message||'Couldn\u2019t save'; });
  }
  if(act==='tenancy-delete') return ask('Delete this tenancy record for <b>'+esc(tenancyNames(tenancyById(id)))+'</b>? If the tenancy has finished, edit it and mark it Ended instead.','Delete').then(function(ok){ if(!ok) return;
    return busy(t,'Deleting',api.tmDeleteTenancy(id)).then(function(st){ apply(st); toast('Tenancy deleted'); back(); }); }).catch(function(){});
  if(act==='bond-pay') return bondPayDialog(tenancyById(id));
  if(act==='bond-receipt') return bondReceiptDialog(((S.st&&S.st.bondPayments)||[]).find(function(p){ return p.id===id; }));
  if(act==='bond-lodge') return bondLodgeDialog(tenancyById(id));
  if(act==='bond-number') return bondNumberDialog(tenancyById(id));
  if(act==='bond-method') return bondMethodDialog(tenancyById(id));
  if(act==='bond-pay-del'){ var bp=((S.st&&S.st.bondPayments)||[]).find(function(p){ return p.id===id; });
    return ask('Delete the payment of <b>$'+esc(money2(bp.amount))+'</b> from '+esc(bp.paidBy)+' ('+esc(bp.receiptNo)+')? Only do this if it was recorded by mistake.','Delete').then(function(ok){ if(!ok) return;
      return busy(t,'Deleting',api.tmDeleteBondPayment(id)).then(function(st){ apply(st); toast('Payment deleted'); render(); }); }).catch(function(){}); }
  if(act==='change-tenants') return changeTenantsDialog(tenancyById(id));
  if(act==='add-to-tenancy') return addToTenancyDialog(id);
  if(act==='change-refresh') return busy(t,'Checking',api.tmRefreshTenancyChange(id)).then(function(st){ apply(st); var x=tenancyById(id); toast(x&&!x.pendingChange?'Change of tenants signed \u2014 tenancy updated':'Change: '+((x&&x.pendingChange&&x.pendingChange.signed)||'0')+' signed'); render(); }).catch(function(){});
  if(act==='change-resend') return resendDialog('change',id,t.getAttribute('data-v'),t.getAttribute('data-who'),t.getAttribute('data-name'));
  if(act==='change-cancel') return ask('Cancel this change of tenants? Anyone already sent a link will be told. The tenancy stays as it is.','Cancel change').then(function(ok){ if(!ok) return;
    return busy(t,'Cancelling',api.tmCancelTenancyChange(id)).then(function(st){ apply(st); toast('Change cancelled'); render(); }); }).catch(function(){});
  if(act==='tenancy-summary') return busy(t,'Loading',api.tmTenancySummary(id)).then(function(r){ previewDialog('Tenancy summary',r.html); }).catch(function(){});
  if(act==='bond-task') return busy(t,'Saving',api.tmSetBondTask(id,t.getAttribute('data-task'),t.getAttribute('data-v')==='1')).then(function(st){ apply(st); render(); }).catch(function(){});
  if(act==='tenancy-create') return busy(t,'Creating',api.tmCreateTenancyFromGroup(id)).then(function(st){ apply(st); toast('Tenancy created'); if(st.savedTenancyId) go('tenancy',st.savedTenancyId); else render(); }).catch(function(){});
  if(act==='send-agreement') return sendAgreementDialog(id);
  if(act==='refresh-agreement') return busy(t,'Checking',api.tmRefreshAgreement(id)).then(function(st){ apply(st); var g=groupLead(id), ag=(g&&g.agreement)||{};
    toast(ag.status==='Signed'?'Everyone has signed'+(ag.pdf?' \u2014 saved to Drive':''):'Agreement: '+(ag.signed||'0')+' signed'); render(); }).catch(function(){});
  if(act==='agreement-resend') return resendDialog('agreement',id,t.getAttribute('data-v'),t.getAttribute('data-who'),t.getAttribute('data-name'));   // not 'resend-link': that's the application form's Resend link
  if(act==='clear-emailed') return ask('Clear the emailed flag for this reference? The emailed time is removed, so it shows as not emailed yet.','Clear').then(function(ok){
    if(!ok) return;
    // gone from the screen at once; saved in the background (put back, with a message, if the save fails)
    var F=S.form, rr=F&&S.refs[F.ref], c=rr&&rr.contacts.find(function(x){ return x.slot===F.slot; }), was=c?c.emailSent:'';
    if(!F) return;
    if(c) c.emailSent='';
    render(); toast('Email flag cleared');
    api.tmMarkEmailSent(F.ref,F.slot,false).then(function(r){ S.refs[F.ref]=r; })
      .catch(function(e){ if(c) c.emailSent=was; if(S.form===F && S.cur.view==='ref') render(); toast('The email flag wasn'+String.fromCharCode(8217)+'t cleared: '+e.message,6000); });
  });
  if(act==='cancel-agreement'){
    if(isEsign((groupLead(id)||{}).agreement)) return cancelAgreementDialog(id);
    return ask('Cancel the agreement sent to <b>'+esc(groupName(id))+'</b>? DocHub will tell the signers it\u2019s been cancelled, and you can then send a new one.','Cancel agreement').then(function(ok){ if(!ok) return;
      return busy(t,'Cancelling',api.tmCancelAgreement(id)).then(function(st){ apply(st); toast('Agreement cancelled'); render(); }).catch(function(){}); }); }
  if(act==='copy-link'){ var la=appByRef(id); if(!la.applyLink){ toast('The online form address isn\u2019t set up (APPLY_URL)'); return; } copyText(la.applyLink,'Link copied \u2014 paste it into a text to '+la.name.split(' ')[0]); return; }
  if(act==='cancel-form'){ var ca=appByRef(id);
    return ask('Cancel <b>'+whoHtml(ca)+'</b>\u2019s application form? Their link stops working straight away'+(ca.status==='In Progress'?' and anything they\u2019ve filled in can\u2019t be sent':'')+'. They aren\u2019t emailed. You can send them a new link later with Resend link.','Yes, cancel form').then(function(ok){ if(!ok) return;
      return busy(t,'Cancelling',api.tmCancelApplyForm(id)).then(function(st){ apply(st); toast('Form cancelled'); render(); }); }).catch(function(){}); }
  if(act==='resend-link') return busy(t,'Sending',api.tmResendApplyLink(id)).then(function(st){ apply(st); toast('Link emailed to '+appByRef(id).email); render(); }).catch(function(){});
  if(act==='send-group'){
    var gl=groupMembers(id).filter(function(a){ return !sent(a) && canSend(a); });
    return ask('Send the application form to everyone in '+esc(groupName(id))+'?<div class="small muted" style="margin-block-start:8px">'+gl.map(function(a){ return esc(whoText(a)); }).join(', ')+'</div>'+formPickHtml(),'Send '+gl.length).then(function(ok){ if(ok) return sendForms(gl.map(function(a){ return a.ref; }),t,pickedForm()); });
  }
  if(act==='refresh'){
    // Online forms update the sheet the moment they're opened or submitted, so a refresh just reloads them;
    // the message reports what changed.
    var before={}; apps().forEach(function(a){ before[a.ref]=a.status; });
    return busy(t,'Checking',api.tmRefresh([])).then(function(r){
      apply(r.state); S.refs={};
      var returned=0, opened=0, out=0, bad=r.results.filter(function(x){ return !x.ok; });
      apps().forEach(function(a){
        var was=before[a.ref];
        if(a.status==='Finalized' && was && was!=='Finalized') returned++;
        else if(a.status==='In Progress' && was && was!=='In Progress' && was!=='Finalized') opened++;
        if(sent(a) && (a.status==='Sent'||a.status==='In Progress')) out++;
      });
      var bits=[];
      if(returned) bits.push(returned+' form'+(returned>1?'s':'')+' returned');
      if(opened) bits.push(opened+' opened');
      var msg=bits.length? bits.join(' \u00b7 ') : 'Up to date';
      msg+=out? ' \u2014 '+out+' form'+(out>1?'s':'')+' still out' : (bits.length?'':' \u2014 no forms waiting');
      toast(msg, bad.length?6000:3000); render();
    }).catch(function(){});
  }
  if(act==='refresh-one') return busy(t,'Checking',api.tmRefresh([id])).then(function(r){ apply(r.state); delete S.refs[id]; var a=appByRef(id); toast(a? stInfo(a).t : 'Updated'); render(); }).catch(function(){});
  if(act==='save-viewing'){
    var v=readViewingForm(); if(!v) return; v.id=id||'';
    var vw=id? viewingById(id) : null; if(vw) v.status=vw.status;
    return busy(t,'Saving',api.tmSaveViewing(v)).then(function(st){ apply(st);
      if(id){ toast('Viewing updated'); return back(); }
      var nv=st.viewings.find(function(x){ return x.address1===v.address1 && localInput(new Date(x.viewingAt))===v.viewingAt; });
      toast('Viewing created'); S.stack=[]; S.cur={view:'home'}; if(nv) go('viewing',nv.id); else home(); }).catch(function(){});
  }
  if(act==='viewing-status'){ var vid=S.cur.arg; return busy(t,'Saving',api.tmSetViewingStatus(vid,id)).then(function(st){ apply(st); toast(id==='Cancelled'?'Viewing cancelled':'Viewing reinstated'); back(); }).catch(function(){}); }
  if(act==='viewing-done') return busy(t,'Saving',api.tmSetViewingStatus(id,'Completed')).then(function(st){ apply(st); toast('Viewing marked finished'); home(); }).catch(function(){});
  if(act==='send-one'){
    var a=appByRef(id);
    return ask((a.email? 'Send the tenancy application form to <b>'+whoHtml(a)+'</b> at '+esc(a.email)+'?' : 'Create a form link for <b>'+whoHtml(a)+'</b> and text it to '+esc(a.mobile)+'?')+formPickHtml(), a.email?'Send form':'Create link').then(function(ok){ if(ok) return sendForms([id],t,pickedForm()); });
  }
  if(act==='send-all'){
    var list=attendees(id).filter(function(a){ return !sent(a) && canSend(a); });
    return ask('Send the application form to '+list.length+' '+(list.length>1?'people':'person')+'?<div class="small muted" style="margin-block-start:8px">'+list.map(function(a){ return esc(whoText(a)); }).join(', ')+'</div>'+formPickHtml(),'Send '+list.length).then(function(ok){ if(ok) return sendForms(list.map(function(a){ return a.ref; }),t,pickedForm()); });
  }
  if(act==='edit-app') return editAppDialog(appByRef(id));
  if(act==='remove-app') return deleteDialog(appByRef(id),t);
  if(act==='detach-app'){
    var da=appByRef(id), dv=viewingById(da.viewingId);
    return ask('Remove <b>'+whoHtml(da)+'</b> from the '+(dv?esc(dv.address1)+' ':'')+'viewing? Their application stays in the sheet'+(groupMembers(groupKey(da)).length>1?' and they leave their group':'')+'.','Remove').then(function(ok){ if(!ok) return;
      return busy(t,'Removing',api.tmDetachFromViewing(id)).then(function(st){ apply(st); toast(da.name.split(' ')[0]+' removed from the viewing'); render(); }); }).catch(function(){});
  }
  if(act==='delete-viewing'){
    var xv=viewingById(id);
    if(attendees(id).length){ toast('Remove everyone from this viewing first'); return; }
    return ask('Delete the viewing at <b>'+esc(xv.address1)+'</b> on '+esc(fmt(xv.viewingAt))+'?','Delete').then(function(ok){ if(!ok) return;
      return busy(t,'Deleting',api.tmDeleteViewing(id)).then(function(st){ apply(st); toast('Viewing deleted'); home(); }); }).catch(function(){});
  }
  if(act==='ref') return go('ref',{ref:t.getAttribute('data-ref'),slot:id});
  if(act==='add-contact') return addContactDialog(id);

  if(act==='email-ref') return emailRefDialog();
  if(act==='qset'){ S.form.set=id; [].forEach.call(t.parentNode.children,function(b){ b.classList.toggle('on',b===t); }); keepDraft(); drawQuestions(S.refs[S.form.ref]); return; }
  if(act==='save-ref'){
    var F=S.form, r=S.refs[F.ref], set=r.questions.find(function(s){ return s.name===F.set; });
    F.notes=$('#rfNotes').value; F.checkedBy=$('#rfBy').value.trim(); try{ localStorage.setItem('tm-checker',F.checkedBy); }catch(x){}
    var answers=(set?set.items:[]).map(function(q){ return {question:q,answer:F.answers[q]||''}; });
    Object.keys(F.answers||{}).forEach(function(q){ if(set && set.items.indexOf(q)>=0) return; if(String(F.answers[q]||'').trim()) answers.push({question:q,answer:F.answers[q]}); });   // earlier answers are kept
    var also=[].filter.call(document.querySelectorAll('.rfAlso'),function(c){ return c.checked; }).map(function(c){ return {ref:c.getAttribute('data-ref'),slot:c.getAttribute('data-slot')}; });
    return busy(t,'Saving',api.tmSaveReferenceCheck(F.ref,F.slot,{set:F.set,answers:answers,status:F.status,outcome:F.outcome,notes:F.notes,checkedBy:F.checkedBy,alsoFor:also}))
      .then(function(res){ S.refs={}; S.refs[F.ref]=res; try{ localStorage.removeItem(draftKey(F.ref,F.slot)); also.forEach(function(o){ localStorage.removeItem(draftKey(o.ref,o.slot)); }); }catch(x){}

        return api.tmBootstrap().then(apply).catch(function(){}); })
      .then(function(){ toast(also.length?'Saved for '+(also.length+1)+' applicants':'Reference check saved'); S.form=null; back(); }).catch(function(){});
  }
});
document.addEventListener('change',function(e){ editField(e.target); });
document.addEventListener('input',function(e){
  var el=e.target;
  if(editField(el)) return;
  if(el.id==='pplSearch'){ S.pq=el.value; var pp0=el.selectionStart; render(); var pn=$('#pplSearch'); if(pn){ pn.focus(); try{ pn.setSelectionRange(pp0,pp0); }catch(x){} } return; }
  if(el.id==='grpSearch'){ S.q=el.value; var pos=el.selectionStart; render(); var n=$('#grpSearch'); if(n){ n.focus(); try{ n.setSelectionRange(pos,pos); }catch(x){} } return; }
  if(el.hasAttribute&&el.hasAttribute('data-pf')&&S.people){ S.people[+el.getAttribute('data-pi')][el.getAttribute('data-pf')]=el.value; return; }
  if(/^vf(Date|First|Last|GapN)$/.test(el.id)) slotPreview();
  if(el.id==='bkOtherT'){ var vv=viewingById(S.cur.arg.viewingId); S.bookSlot=el.value? new Date(dateInput(vv.viewingAt)+'T'+el.value).getTime() : 0; var sb=document.querySelector('[data-act=save-book]'); if(sb) sb.textContent=S.bookSlot?'Book '+fmtTime(S.bookSlot):'Book group'; }
  if(S.form && el.hasAttribute('data-q')){ S.form.answers[el.getAttribute('data-q')]=el.value; keepDraft(); }
  if(S.form && el.id==='rfNotes'){ S.form.notes=el.value; keepDraft(); }
  if(S.form && el.id==='rfBy'){ S.form.checkedBy=el.value; keepDraft(); }
});
document.addEventListener('keydown',function(e){

});
$('#backBtn').addEventListener('click',back);
function net(){ var b=$('#netBadge'); b.textContent=navigator.onLine?(S.syncing?'Updating...':HAS_GAS?'Online':'Demo'):'Offline'; b.classList.toggle('off',!navigator.onLine); }
window.addEventListener('online',function(){ net(); checkForUpdate(); }); window.addEventListener('offline',net);
document.addEventListener('visibilitychange',function(){ if(document.hidden){ if(S.form) persist(true); } else checkForUpdate(); });
setInterval(function(){ checkForUpdate(); },30*60*1000);

/* ================= Self-update =================
   Home-screen apps can keep an old copy of the page. On load, when the app returns to the
   foreground, and every 30 minutes, ask the server which version is deployed. If it's newer,
   save everything and reload from the live link (or show a one-tap "Update" banner if the
   browser blocks the automatic reload). */
function cmpVer(a,b){ a=String(a||'0').split('.').map(Number); b=String(b||'0').split('.').map(Number);
  for(var i=0;i<Math.max(a.length,b.length);i++){ var x=a[i]||0,y=b[i]||0; if(x!==y) return x>y?1:-1; } return 0; }
/* Anything typed but not yet sent to the sheet: reference answers are kept on the device; an attendee half-entered is not */
function persist(){ keepDraft(); }
function typingAttendee(){ return !!(S.people && S.people.some(function(p){ return (p.name+p.mobile+p.email).trim(); })) || ['#atName','#atMobile','#atEmail'].some(function(sel){ var el=$(sel); return el && el.value.trim(); }); }
var lastCheck=0;
function checkForUpdate(force){
  if(!HAS_GAS || !navigator.onLine) return;
  if(!force && Date.now()-lastCheck<60000) return; lastCheck=Date.now();
  api.tmGetVersion().then(function(r){
    if(!r || !r.version) return;
    // pageVersion = the version of the TenantIndex page the live deployment actually serves.
    var target=r.pageVersion||r.version, c=cmpVer(target,APP_VERSION);
    if(c<=0){
      hideUpdateBanner(); try{ sessionStorage.removeItem('tm-update-tried'); }catch(e){}
      if(cmpVer(r.version,APP_VERSION)!==0) showMismatch(r.version,target);
      return;
    }
    var snooze=0; try{ snooze=+localStorage.getItem('tm-update-snooze-'+target)||0; }catch(e){}
    var busy=!!document.querySelector('.btn .spin') || typingAttendee();
    var tried=''; try{ tried=sessionStorage.getItem('tm-update-tried')||''; }catch(e){}
    var url=(r.url||'')+(r.url&&r.url.indexOf('?')>=0?'&':'?')+'v='+encodeURIComponent(target)+'&t='+Date.now();
    // Google's app frame only lets the page reload itself from a real tap, so never reload
    // automatically (that is what caused the blank screen) - ask once, then fall back to the banner.
    if(!r.url) return;
    var asked=''; try{ asked=sessionStorage.getItem('tm-update-asked')||''; }catch(e){}
    if(busy || asked===target || tried===target || $('.modal')){ if(Date.now()>snooze) showUpdateBanner(target,url); return; }
    try{ sessionStorage.setItem('tm-update-asked',target); }catch(e){}
    persist(true); showUpdatePrompt(target,url);
  }).catch(function(){});
}
function bannerEl(){
  var b=$('#updBanner'); if(!b){ b=document.createElement('div'); b.id='updBanner'; b.className='banner'; b.style.cssText='display:flex;align-items:center;gap:10px;background:var(--grad);position:relative;z-index:6'; document.body.insertBefore(b,$('main'));
    b.addEventListener('click',function(ev){
      var x=ev.target.closest('[data-upd]'); if(!x) return;
      var v=b.getAttribute('data-ver');
      if(x.getAttribute('data-upd')==='go'){ persist(true); x.textContent='Updating\u2026'; try{ sessionStorage.setItem('tm-update-tried',v); }catch(e){} }
      else { try{ localStorage.setItem('tm-update-snooze-'+v,String(Date.now()+12*3600*1000)); }catch(e){} hideUpdateBanner(); }
    });
  }
  return b;
}
function showUpdateBanner(ver,url){
  var b=bannerEl(); b.setAttribute('data-ver',ver); b.style.background='var(--grad)';
  b.innerHTML='<span style="flex:1">\u2728 Version '+esc(ver)+' is available.</span><a class="btn sm" data-upd="go" style="background:#fff;color:#0f766e;border:0" target="_top" href="'+esc(url)+'">Update now</a>'+
    '<button type="button" class="icon-btn" data-upd="later" aria-label="Dismiss" style="font-size:1.1rem;width:32px;height:32px">\u2715</button>';
}
function showMismatch(backendVer,pageVer){
  var b=bannerEl(); b.setAttribute('data-ver','mismatch-'+backendVer);
  var snooze=0; try{ snooze=+localStorage.getItem('tm-update-snooze-mismatch-'+backendVer)||0; }catch(e){} if(Date.now()<snooze){ b.remove(); return; }
  b.style.background='var(--grad-miss)';
  b.innerHTML='<span style="flex:1">\u26A0 The live deployment has backend '+esc(backendVer)+' but app page '+esc(pageVer)+'. Paste the latest TenantIndex file into Apps Script, then deploy a new version.</span>'+
    '<button type="button" class="icon-btn" data-upd="later" aria-label="Dismiss" style="font-size:1.1rem;width:32px;height:32px">\u2715</button>';
}
function showUpdatePrompt(ver,url){
  var m=document.createElement('div'); m.className='modal';
  m.innerHTML='<div class="box" style="text-align:center"><div style="font-size:2.6rem;line-height:1">\u2728</div>'+
    '<div class="title" style="font-size:1.2rem;margin-block:8px 4px">Update available</div>'+
    '<div class="small muted" style="margin-block-end:16px">Version '+esc(ver)+' is ready (you have '+esc(APP_VERSION)+'). Everything is saved in the sheet, and reference answers you\u2019ve typed are kept on this device \u2014 nothing will be lost.</div>'+
    '<div class="row" style="justify-content:center"><button class="btn" type="button" data-up="later">Later</button>'+
    '<a class="btn primary" data-up="go" target="_top" href="'+esc(url)+'">Update now</a></div></div>';
  document.body.appendChild(m);
  m.addEventListener('click',function(ev){
    var b=ev.target.closest('[data-up]'); if(!b) return;
    if(b.getAttribute('data-up')==='go'){ try{ sessionStorage.setItem('tm-update-tried',ver); }catch(e){} b.textContent='Updating\u2026'; return; }  // let the link navigate
    m.remove(); showUpdateBanner(ver,url);
  });
}
function hideUpdateBanner(){ var b=$('#updBanner'); if(b) b.remove(); }

/* ================= Demo backend (when opened outside Google) ================= */
var Demo = {
  on:!HAS_GAS,
  key:'tm-demo',
  load:function(){ try{ var d=JSON.parse(localStorage.getItem(Demo.key)); if(d&&d.applications) return d; }catch(e){} return Demo.seedExtra(Demo.seed()); },
  save:function(d){ try{ localStorage.setItem(Demo.key,JSON.stringify(d)); }catch(e){} },
  seed:function(){
    var t=new Date(); t.setHours(17,30,0,0); var y=new Date(t.getTime()-86400000*5);
    var Q=[{id:'QS-d1',usedFor:['Landlord'],name:'Previous Property Manager / Landlord',note:'',items:['How long did they rent from you?','Would you rent to them again without hesitation?','Were rent payments generally on time?','Did they keep the property in reasonable condition?']},
           {id:'QS-d2',usedFor:['Employer'],name:'Employer / Manager',note:'',items:['How long have you known them?','Are they reliable and punctual?','Would you rehire them if given the opportunity?']},
           {id:'QS-d3',usedFor:['Family'],name:'Family Member',note:'Use with caution. Focus more on behaviours than opinions.',items:['Are they generally organised with money?','How do they treat property that belongs to other people?']},
           {id:'QS-d4',usedFor:['Friend'],name:'Friend / Flatmate',note:'',items:['How long have you known them?','Would you choose to live with them again?']},
           {id:'QS-d5',usedFor:[],name:'Red Flags',note:'Watch for:',items:['Long pauses before answering simple questions.','Overly enthusiastic praise with no examples.'],flags:true}];
    return { viewings:[{id:'V-1',address1:'36 Grange St',address2:'North Dunedin',rent:950,moveIn:'2027-01-01T00:00:00.000Z',tenancy:'12 months',viewingAt:t.toISOString(),notes:'Park on the street',status:'Scheduled',hostedBy:'Kelvin',lastAt:new Date(t.getTime()+20*60000).toISOString(),slotMinutes:5},
                       {id:'V-0',address1:'54 Grange St',address2:'Dunedin 9016',rent:555,moveIn:'',tenancy:'12 months',viewingAt:y.toISOString(),notes:'',status:'Completed',lastAt:new Date(y.getTime()+30*60000).toISOString(),slotMinutes:10}],
      applications:[
        {ref:'KB-30009',name:'Lena Park',address1:'54 Grange St',address2:'Dunedin 9016',rent:555,moveIn:'',tenancy:'12 months',mobile:'027 555 0177',email:'lena@example.com',status:'Finalized',srid:'z',documentId:'d2',sentAt:y.toISOString(),viewedAt:y.toISOString(),signedAt:y.toISOString(),pdfUrl:'',driveUrl:'',lastError:'',creditCheck:'',viewingId:'V-0',attendedAt:y.toISOString(),notes:'',decision:'',decisionNotes:'',group:''},
        {ref:'KB-20017',name:'Shahrbano Hosseini',address1:'36 Grange St',address2:'North Dunedin',rent:950,moveIn:'2027-01-01T00:00:00.000Z',tenancy:'12 months',mobile:'021 555 0142',email:'shahrbano@example.com',status:'Finalized',srid:'x',documentId:'d',sentAt:y.toISOString(),viewedAt:y.toISOString(),signedAt:y.toISOString(),pdfUrl:'#',driveUrl:'',lastError:'',creditCheck:'618/1000',viewingId:'V-1',attendedAt:y.toISOString(),notes:'',decision:'',decisionNotes:'',arrival:t.toISOString(),attendance:''},
        {ref:'KB-20018',name:'Tom Wright',address1:'36 Grange St',address2:'North Dunedin',rent:950,moveIn:'',tenancy:'12 months',mobile:'027 555 0199',email:'tom@example.com',status:'In Progress',applyToken:'demo',applyLink:'https://example.github.io/apply/?t=demo',srid:'',documentId:'',sentAt:y.toISOString(),viewedAt:'',signedAt:'',pdfUrl:'',driveUrl:'',lastError:'',creditCheck:'',viewingId:'V-1',attendedAt:y.toISOString(),notes:'Two flatmates',decision:'',decisionNotes:'',group:'KB-20017',arrival:t.toISOString(),attendance:''}],
      __wom:1,
      contacts:{'KB-20017':[
        {slot:'Current Landlord',contact:'Christine Manning',relationship:'Current landlord / PM - applicant asked us not to contact them',phone:'03 473 1721',email:'christine@example.co.nz',address:'145 Harbour Terrace',rent:'255',vacated:'',source:'DocHub',status:'Not started',outcome:'',notes:'',checkedBy:'',checkedAt:''},
        {slot:'Referee 1',contact:'Priya Shah',relationship:'Employer',phone:'021 555 0101',email:'',address:'',rent:'',vacated:'',source:'DocHub',status:'Completed',outcome:'Positive',notes:'Glowing',checkedBy:'Kelvin',checkedAt:y.toISOString()}],
        'KB-30009':[{slot:'Previous Landlord',contact:'C Manning',relationship:'Previous landlord / PM',phone:'+64 3 473 1721',email:'',address:'145 Harbour Terrace',rent:'240',vacated:'2025',source:'DocHub',status:'Not started',outcome:'',notes:'',checkedBy:'',checkedAt:''}]},
      answers:{}, questions:Q, n:20019 };
  },
  seedExtra:function(d){
    if(!d.__wom) return d;
    delete d.__wom;
    d.applications.forEach(function(a){ if(a.ref==='KB-30009'){ a.arrival=new Date(new Date(d.viewings[1].viewingAt).getTime()+10*60000).toISOString(); a.attendance='Came'; } });
    d.applications.push({ref:'KB-30010',name:'Mia Chen',address1:'36 Grange St',address2:'North Dunedin',rent:950,moveIn:'',tenancy:'12 months',mobile:'021 555 0177',email:'mia@example.com',status:'Draft',srid:'',documentId:'',sentAt:'',viewedAt:'',signedAt:'',pdfUrl:'',driveUrl:'',lastError:'',creditCheck:'',viewingId:'',attendedAt:new Date().toISOString(),notes:'',decision:'',decisionNotes:'',group:'KB-30010',source:'Word of mouth',sourceNotes:'Friend of the current tenants',arrival:'',attendance:''});
    return d;
  },
  state:function(d){
    Demo.people(d);   // links applications and tenancies to people before anything is copied out
    if(!d.bondPayments) d.bondPayments=[{id:'BP-DEMO1',tenancyId:'T-DEMO1',received:ymdAdd(todayYmd(),-12),amount:1040,paidBy:'Aroha Ngata',method:'Bank transfer',receiptNo:'R-0001',receiptSentAt:new Date(Date.now()-11*864e5).toISOString(),receiptSentTo:'aroha@example.com',receiptPdf:'',lodgedAt:'',notes:'',recordedBy:'demo@example.com'}];
    if(!d.tenancies) d.tenancies=[{id:'T-DEMO1',propertyId:'P-JUB',property:'37/3 Jubilee Street',status:'Current',start:'2026-02-01',end:'2027-01-31',rent:520,bond:2080,landlord:'Kelvin Box',groupKey:'',requestId:'',pdf:'',notes:'Existing tenancy added by hand.',createdAt:'2026-10-01T00:00:00.000Z',createdBy:'demo@example.com',
      tenants:[{ref:'',name:'Aroha Ngata',email:'aroha@example.com',mobile:'021 555 0101',dob:'1999-08-02',moveIn:'2026-02-01'},{ref:'',name:'Ben Carter',email:'ben@example.com',mobile:'022 555 0102',dob:'',moveIn:'2026-02-01'}]}];
    var sum={}; Object.keys(d.contacts).forEach(function(r){ var o=sum[r]={total:0,done:0,concerns:0,positive:0,neutral:0,none:false}; d.contacts[r].forEach(function(c){ if(c.slot==='None provided'){o.none=true;return;} o.total++; if(c.status==='Completed'||c.status==='Not required') o.done++; if(c.outcome==='Positive') o.positive++; if(c.outcome==='Neutral') o.neutral++; if(c.outcome==='Concern') o.concerns++; }); });
    return clone({appName:'Tenant Management',version:APP_VERSION+' (demo)',me:'demo@example.com',hosts:['Kelvin'],applyMode:true,smsTemplate:'Your application form for {{Property}} can be found here: {{Link}}',viewings:d.viewings.slice().sort(function(a,b){ return b.viewingAt.localeCompare(a.viewingAt); }),
      decisions:['Shortlisted','Approved','Declined','Withdrawn'],applications:d.applications.map(function(a){ var o=clone(a); o.refs=sum[a.ref]||null; return o; }),shared:Demo.shared(d),properties:Demo.props(d).filter(function(p){ return p.active; }),
      setupProperties:Demo.props(d),landlords:Demo.landlords(d),tenancies:d.tenancies||[],bondPayments:d.bondPayments||[],holidays:Demo.holidays,agreementProvider:'esign',adminPinSet:!!d.pin,profile:d.profile||{email:'demo@example.com',name:'',mobile:'',phone:''},people:Demo.people(d),dataModel:2,
      termsMaster:d.termsMaster||(d.termsMaster=['The tenant must not smoke anywhere inside the premises.','The tenant will mow the lawns at least fortnightly in summer.','Rubbish and recycling bins go out on the night before collection.'])});
  },
  props:function(d){
    if(!d.props){ var by={}; d.viewings.forEach(function(v){ by[v.address1]={propertyId:'P-'+v.id,name:v.address1,address1:v.address1,address2:v.address2,rent:v.rent,tenancy:v.tenancy}; });
      by['37/3 Jubilee Street']={propertyId:'P-JUB',name:'Flat 3, Jubilee',address1:'37/3 Jubilee Street',address2:'Mornington',rent:'',tenancy:''};
      d.props=Object.keys(by).map(function(k){ var o=by[k], s=(d.agree||{})[o.propertyId]||{};
        ['bond','maxOccupants','insurer','insurancePolicy','excess','insulationDate','templateId','templateTitle','landlord','notes'].forEach(function(f){ o[f]=s[f]!=null?s[f]:''; });
        if(s.rent!=null&&s.rent!=='') o.rent=s.rent; o.active=true; return o; }); }
    d.props.forEach(function(p){ if(!p.areas) p.areas=buildLayout(2,1,0,['Laundry','Hallway / Entry','Exterior / Grounds'],[]); if(!Array.isArray(p.chattels)) p.chattels=p.chattels?String(p.chattels).split('\n'):[]; if(!Array.isArray(p.additionalTerms)) p.additionalTerms=p.additionalTerms?String(p.additionalTerms).split('\n'):[]; if(!p.insulation) p.insulation=blankIns(); if(!p.healthyHomes) p.healthyHomes=blankHH(); });
    return d.props;
  },
  landlords:function(d){
    if(!d.landlords) d.landlords=[{name:'Kelvin Box',signer:'Kelvin Box',email:'kelvin.box@gmail.com',address:'',phone:'',mobile:'',notes:''},{name:'Les and Jennifer Box',signer:'Les and Jennifer Box',email:'landjbox@outlook.com',address:'37 District Road, Roseneath, Dunedin 9023',phone:'',mobile:'',notes:''},{name:'Leanne Hopgood',signer:'Leanne Hopgood',email:'leanne_hopgood@hotmail.com',address:'',phone:'',mobile:'',notes:''}];
    return d.landlords;
  },  holidays:[['2026-02-06','Waitangi Day'],['2026-04-03','Good Friday'],['2026-04-06','Easter Monday'],['2026-04-27','Anzac Day (observed)'],['2026-06-01','King\u2019s Birthday'],['2026-10-26','Labour Day'],
    ['2027-02-08','Waitangi Day (observed)'],['2027-03-26','Good Friday'],['2027-03-29','Easter Monday'],['2027-04-26','Anzac Day (observed)'],['2027-06-07','King\u2019s Birthday'],['2027-10-25','Labour Day']].map(function(h){ return {date:h[0],name:h[1]}; }),  tenancyFromGroup:function(d,key){
    var gm=d.applications.filter(function(x){ return (x.group||x.ref)===key; }), l=gm.find(function(x){ return x.ref===key; })||gm[0], ag=l&&l.agreement;
    if(!ag||ag.status!=='Signed') return '';
    d.tenancies=d.tenancies||[]; var have=d.tenancies.find(function(x){ return x.requestId===ag.requestId; }); if(have) return have.id;
    var p=Demo.props(d).find(function(x){ return x.address1===l.address1; })||{}, dt=ag.details||{};
    var t={id:'T-D'+Date.now(),agreementProvider:ag.provider==='esign'?'esign':'dochub',agreementVersions:ag.provider==='esign'?[{id:ag.requestId,pdf:ag.pdf||'',effective:dt.start||''}]:[],propertyId:p.propertyId||'',property:l.address1,status:'Current',start:dt.start||'',end:dt.end||'',rent:dt.rent,bond:dt.bond,room:dt.room||'',landlord:ag.landlord,groupKey:key,requestId:ag.requestId,pdf:ag.pdf||'',notes:'',createdAt:new Date().toISOString(),createdBy:'demo@example.com',
      tenants:gm.map(function(x){ return {ref:x.ref,name:x.name,email:x.email,mobile:x.mobile,dob:x.ref==='KB-20017'?'1996-04-12':'',moveIn:dt.start||'',addressForService:ag.provider==='esign'?'Confirmed when signing (demo)':''}; })};
    d.tenancies.push(t); return t.id;
  },
  bc:function(d){ return {folder:{name:'Body Corporate Rules',path:'Google Drive \u203A Tenancy Applications \u203A Body Corporate Rules',url:'#'},files:(d.bcFiles||[]).slice().sort(function(a,b){ return a.name.localeCompare(b.name); })}; },
  /* demo people: one per email (else mobile), linked from applications and tenancies; status as the server works it out */
  people:function(d){
    d.ppl=d.ppl||[];
    function find(e,m){ e=String(e||'').toLowerCase(); m=String(m||'').replace(/\D/g,'').replace(/^64/,'0'); return d.ppl.find(function(p){ return (e&&String(p.email).toLowerCase()===e)||(m.length>=7&&String(p.mobile).replace(/\D/g,'').replace(/^64/,'0')===m); }); }
    function link(o){ if(o.personId&&d.ppl.some(function(p){ return p.id===o.personId; })) return o.personId; var p=find(o.email,o.mobile);
      if(!p){ p={id:'PN-D'+(d.ppl.length+1),name:o.name,email:o.email||'',mobile:o.mobile||'',dob:o.dob||'',createdAt:new Date().toISOString()}; d.ppl.push(p); } return p.id; }
    d.applications.forEach(function(a){ a.personId=link(a); var p=d.ppl.find(function(x){ return x.id===a.personId; }); if(p){ a.name=p.name||a.name; if(p.email) a.email=p.email; if(p.mobile) a.mobile=p.mobile; } });
    (d.tenancies||[]).forEach(function(t){ (t.tenants||[]).concat(t.formerTenants||[]).forEach(function(x){ if(x.ref){ var ap=d.applications.find(function(a){ return a.ref===x.ref; }); if(ap) x.personId=ap.personId; } x.personId=link(x); }); });
    var rank={Tenant:5,Applicant:4,'Past Tenant':3,'Past Applicant':2,Viewer:1}, st={};
    function bump(id,s,kind){ var o=st[id]=st[id]||{status:'Viewer',applications:0,tenancies:0}; if(rank[s]>rank[o.status]) o.status=s; o[kind]++; }
    var hasT={}; (d.tenancies||[]).forEach(function(t){ if(t.groupKey) hasT[t.groupKey]=1; if(t.requestId) hasT[t.requestId]=1; });
    d.applications.forEach(function(a){ var sent=!!(a.applyToken||a.sentAt), signed=!!(a.agreement&&a.agreement.status==='Signed'), closed=/^(Declined|Withdrawn)$/.test(a.decision||'')||signed;
      bump(a.personId,signed&&!hasT[a.group||a.ref]&&!hasT[a.agreement.requestId]?'Tenant':(sent||/^(Approved|Declined|Withdrawn)$/.test(a.decision||''))?(closed?'Past Applicant':'Applicant'):'Viewer','applications'); });
    (d.tenancies||[]).forEach(function(t){ (t.tenants||[]).forEach(function(x){ bump(x.personId,t.status==='Ended'?'Past Tenant':'Tenant','tenancies'); }); (t.formerTenants||[]).forEach(function(x){ bump(x.personId,'Past Tenant','tenancies'); }); });
    return d.ppl.filter(function(p){ return st[p.id]; }).map(function(p){ var o=clone(p), x=st[p.id]; o.status=x.status; o.applications=x.applications; o.tenancies=x.tenancies; o.lastAt=p.createdAt; return o; });
  },
  deletePlan:function(d,key){
    var ms=d.applications.filter(function(x){ return Demo.gk(x)===key; }), lead=ms.find(function(x){ return x.ref===key; })||ms[0]||{}, ag=lead.agreement||{};
    var ts=(d.tenancies||[]).filter(function(t){ return t.groupKey===key; }), ids=ts.map(function(t){ return t.id; });
    var people=ms.map(function(x){ return {ref:x.ref,name:x.name,submitted:x.status==='Finalized'}; }), sub=people.filter(function(x){ return x.submitted; }).length;
    return {groupKey:key,people:people,submissions:sub,agreement:ag.requestId?{provider:ag.provider||'dochub',status:ag.status,signed:ag.status==='Signed'}:null,
      tenancies:ts.map(function(t){ return {id:t.id,property:t.property,status:t.status}; }),bondPayments:(d.bondPayments||[]).filter(function(p){ return ids.indexOf(p.tenancyId)>=0; }).length,
      needsPin:sub>0||ag.status==='Signed'||ts.length>0,pinSet:!!d.pin};
  },
  files:function(){ var u=function(n){ return 'https://drive.google.com/file/d/DEMO'+n+'XXXXXXXXXXXXXXXXXXXX/view'; };
    return [{k:'UploadPhotoId',label:'Photo of your driver licence or passport',files:[{name:'licence.jpg',url:u(1)}]},
      {k:'UploadReferences',label:'Written tenancy references or rent ledger (optional)',files:[{name:'Rent ledger 2025.pdf',url:u(2)},{name:'Reference - Smith Property.pdf',url:u(3)}]},
      {k:'UploadIncome',label:'Proof of income: your last 3 payslips or a current bank statement',files:[{name:'Payslip Sept.pdf',url:u(4)}]}]; },
  profile:function(d,tid,idx){
    var t=(d.tenancies||[]).find(function(x){ return x.id===tid; }), p=t&&t.tenants[idx]; if(!p) return {};
    var app=p.ref&&d.applications.find(function(x){ return x.ref===p.ref; });
    var out={tenancyId:tid,index:idx,personId:p.personId||'',tenant:clone(p),app:app?{ref:app.ref,name:app.name}:null,answers:null,sections:[],meta:null};
    if(app){ out.meta={submittedAt:app.signedAt||new Date().toISOString(),signedName:app.name,signedPdf:'#',uploadsFolder:'#',formType:'Full'}; out.files=Demo.files();
      out.answers=Object.assign({ApplicantName:app.name,ApplicantEmail:app.email,ApplicantMobile:app.mobile,CurrentAddress:'14 Kowhai Lane, Roslyn',DateOfBirth:p.dob||'',LicenceNumber:'DX000001',
        Pets:'No',Smoker:'No',Employed:'Yes',EmployerName:'Example Ltd',Occupation:'Analyst',GrossIncome:'1400',EmergencyName:'Sam Example',EmergencyRelationship:'Parent',EmergencyPhone:'021 555 0100',UploadPhotoId:'licence.jpg'},(d.answers2||{})[app.ref]||{});
      out.sections=[{title:'About you',fields:[{k:'ApplicantName',l:'Full legal name',t:'text'},{k:'ApplicantEmail',l:'Email',t:'email'},{k:'ApplicantMobile',l:'Mobile',t:'tel'},{k:'CurrentAddress',l:'Your current address',t:'text'}]},
        {title:'Identification',fields:[{k:'LicenceNumber',l:'Driver licence number (5a)',t:'text'},{k:'DateOfBirth',l:'Date of birth',t:'date'},{k:'UploadPhotoId',l:'Photo of your driver licence or passport',t:'upload'}]},
        {title:'Your household',fields:[{k:'Pets',l:'Do you have any pets?',t:'yesno'},{k:'PetDetails',l:'What type of pet(s)?',t:'text','if':['Pets','Yes']},{k:'Smoker',l:'Is anyone who will live there a smoker or vaper?',t:'choice',o:['No','Yes (outside only)','Yes (inside)']}]},
        {title:'Employment and income',fields:[{k:'Employed',l:'Are you currently employed?',t:'yesno'},{k:'EmployerName',l:'Employer / company',t:'text','if':['Employed','Yes']},{k:'Occupation',l:'Occupation',t:'text','if':['Employed','Yes']},{k:'GrossIncome',l:'Gross income per week ($)',t:'money','if':['Employed','Yes']}]},
        {title:'Emergency contact',fields:[{k:'EmergencyName',l:'Name',t:'text'},{k:'EmergencyRelationship',l:'Relationship to you',t:'text'},{k:'EmergencyPhone',l:'Phone',t:'tel'}]}]; }
    return out;
  },
  gk:function(a){ return a.group||a.ref; },
  handOn:function(d,app){ if(Demo.gk(app)!==app.ref) return; var o=d.applications.filter(function(x){ return x.ref!==app.ref && Demo.gk(x)===app.ref; }).sort(function(a,b){ return (a.attendedAt||'').localeCompare(b.attendedAt||''); }); o.forEach(function(x){ x.group=o[0].ref; }); },
  move:function(d,ref,lead){ var app=d.applications.find(function(x){return x.ref===ref;}), t=lead? d.applications.find(function(x){return x.ref===lead;}) : null;
    var ok=Demo.gk(app), nk=t? Demo.gk(t) : app.ref; if(ok===nk) return; if(ok===app.ref) Demo.handOn(d,app); app.group=nk;
    if(t){ ['viewingId','arrival','attendance','source','sourceNotes','address1','address2','rent','moveIn','tenancy'].forEach(function(k){ app[k]=t[k]||''; }); } else { app.arrival=''; app.attendance=''; } },
  tribunal:function(spec){
    var txt=JSON.stringify(spec).toLowerCase(), n=/smith/.test(txt)?23:/harbour/.test(txt)?1:0;
    var doc={date:'20250908',app:'5565764',applicant:'PROPERTY BROKERS LIMITED as agent for the owner',respondent:'Example, Person',address:'145 Harbour Terrace, Dunedin 9016',costs:'Landlord',summary:'1. The tenant owes the landlord $2,067.57 for rent arrears, to be paid by 8 weekly payments.'};
    var docs=[]; for(var i=0;i<Math.min(n,20);i++) docs.push(doc);
    return {numFound:n,docs:docs};
  },
  shared:function(d){
    var items=[]; Object.keys(d.contacts).forEach(function(r){ var a=d.applications.find(function(x){return x.ref===r;}); (d.contacts[r]||[]).forEach(function(c){ if(c.slot!=='None provided') items.push({ref:r,slot:c.slot,applicant:a?a.name:'',contact:c.contact,status:c.status,outcome:c.outcome,ph:String(c.phone||'').replace(/\D/g,'').replace(/^64/,'0'),em:String(c.email||'').toLowerCase()}); }); });
    var out={}; items.forEach(function(it){ var o=items.filter(function(x){ return x.ref!==it.ref && ((it.ph.length>=7&&x.ph===it.ph)||(it.em&&x.em===it.em)); }).map(function(x){ return {ref:x.ref,slot:x.slot,applicant:x.applicant,contact:x.contact,status:x.status,outcome:x.outcome}; }); if(o.length) out[it.ref+'|'+it.slot]=o; });
    return out;
  },
  refs:function(d,ref){ var a=d.applications.find(function(x){ return x.ref===ref; }); return clone({app:a,contacts:d.contacts[ref]||[],answers:d.answers[ref]||{},questions:d.questions,me:'demo@example.com',shared:Demo.shared(d),tribunal:{addresses:(d.contacts[ref]||[]).filter(function(c){ return /Landlord/.test(c.slot)&&c.address; }).map(function(c){ return {label:c.slot==='Current Landlord'?'Current rental':'Previous rental',address:c.address}; })}}); },
  call:function(n,a){
    var d=Demo.load(), out;
    function done(v){ Demo.save(d); return new Promise(function(r){ setTimeout(function(){ r(v); },250); }); }
    function fail(m){ return Promise.reject(new Error(m)); }
    function fix(v){ ['viewingAt','moveIn'].forEach(function(k){ if(v[k]) v[k]=new Date(v[k]).toISOString(); }); return v; }
    switch(n){
      case 'tmBootstrap': var dsb=Demo.state(d); dsb.timing={stateMs:420,serverMs:610,parts:{applications:150,viewings:40,references:60,properties:120,tenancies:20,setup:10,landlords:10,bond:10,settings:0,people:0,schema:110,addressSync:80}}; return done(dsb);
      case 'tmAgreementFields': return done({optionalKeys:['LandlordPhone','LandlordMobile','TenancyAddress','InsulationInspectionDate','Insurer','ExcessAmount'],missingKeys:[]});
      case 'tmAgreementSearch': return done([{id:'tplH',title:'208 Hanover RTA 2026 Template',roles:['Tenant1','Tenant2','Tenant3','Tenant4','Tenant5','Landlord'],optionalKeys:['LandlordPhone','TenancyAddress','Insurer','ExcessAmount'],ok:true},
        {id:'tplOld',title:'Hanover RTA 2025 (old)',roles:['Tenant1','Landlord'],ok:false}]);
      case 'tmSaveAgreementSettings': var sp0=Demo.props(d).find(function(x){ return x.propertyId===a[0]; }); if(sp0){ sp0.templateId=a[1].templateId; sp0.templateTitle=a[1].templateTitle; sp0.landlord=a[1].landlord; } return done(Demo.state(d));
      case 'tmSaveProperty': var pp0=clone(a[0]), ps0=Demo.props(d); delete pp0._for;
        if(ps0.some(function(x){ return x.propertyId!==pp0.propertyId && x.active && String(x.address1).toLowerCase()===String(pp0.address1).toLowerCase(); })) return fail(pp0.address1+' is already on the list.');
        pp0.name=pp0.name||pp0.address1; var bf0=(d.bcFiles||[]).find(function(x){ return x.id===pp0.bodyCorporateRules; }); pp0.bodyCorporateRulesName=bf0?bf0.name:'';
        if(pp0.propertyId){ Object.assign(ps0.find(function(x){ return x.propertyId===pp0.propertyId; }),pp0); } else { pp0.propertyId='P-D'+Date.now(); pp0.active=true; ps0.push(pp0); }
        var st2=Demo.state(d); st2.savedPropertyId=pp0.propertyId; return done(st2);
      case 'tmBodyCorporateFiles': return done(Demo.bc(d));
      case 'tmUploadBodyCorporateRules': d.bcFiles=d.bcFiles||[]; var bid='BC-D'+Date.now(); d.bcFiles.push({id:bid,name:a[0],url:'#',updated:todayYmd()}); var br=Demo.bc(d); br.id=bid; return done(br);
      case 'tmSavePerson': var dpp=(d.ppl||[]).find(function(x){ return x.id===a[0].id; }); if(!dpp) return fail('Person not found.'); if(!String(a[0].name||'').trim()) return fail('Enter their full name.');
        Object.keys(a[0]).forEach(function(k){ if(k!=='id') dpp[k]=a[0][k]; }); return done(Demo.state(d));
      case 'tmMergePeople': var dk=(d.ppl||[]).find(function(x){ return x.id===a[0]; }), dd=(d.ppl||[]).find(function(x){ return x.id===a[1]; }); if(!dk||!dd) return fail('Person not found.');
        Object.keys(dd).forEach(function(k){ if(!dk[k]&&dd[k]) dk[k]=dd[k]; }); d.applications.forEach(function(x){ if(x.personId===dd.id) x.personId=dk.id; });
        (d.tenancies||[]).forEach(function(t){ (t.tenants||[]).concat(t.formerTenants||[]).forEach(function(x){ if(x.personId===dd.id) x.personId=dk.id; }); }); d.ppl=d.ppl.filter(function(x){ return x.id!==dd.id; }); return done(Demo.state(d));
      case 'tmTestCreateGroup': return done({group:'KB-TEST1',refs:a[0].names.map(function(n,i){ return 'KB-TEST'+(i+1); }),people:[]});
      case 'tmTestSendForms': case 'tmTestFillForm': case 'tmTestApprove': case 'tmTestStartChange': return done({ok:true});
      case 'tmTestSendAgreement': d.testSigns=0; return done({requestId:'AGR-TEST',term:a[2]+' to a year later',rent:500,bond:2000});
      case 'tmTestSignNext': d.testSigns=(d.testSigns||0)+1; var tsn=['Ben Tester','Amy Tester','Kelvin Box'], tsi=Math.min(d.testSigns,3);
        return done({signed:tsn[tsi-1],role:tsi<3?'Tenant '+tsi:'Landlord',status:tsi>=3?'Completed':'Sent',remaining:tsn.slice(tsi),tenancyId:tsi>=3?'T-TEST':undefined});
      case 'tmTestNextName': return done({name:'Cara',propertyId:'',effective:''});
      case 'tmTestFinish': return done(Demo.state(d));
      case 'tmSaveMyProfile': if(!String(a[0].name||'').trim()) return fail('Enter your name.'); d.profile={email:'demo@example.com',name:a[0].name.trim(),mobile:a[0].mobile||'',phone:a[0].phone||''}; return done(Demo.state(d));
      case 'tmSetAdminPin': if(d.pin&&a[0]!==d.pin) return fail('That PIN isn\u2019t right.'); d.pin=a[1]; return done(Demo.state(d));
      case 'tmGroupDeletePlan': return done(Demo.deletePlan(d,a[0]));
      case 'tmDeleteGroup': var dp=Demo.deletePlan(d,a[0]); if(dp.needsPin&&a[1]!==d.pin) return fail(d.pin?'That PIN isn\u2019t right.':'Set an admin PIN first.');
        var drefs=dp.people.map(function(x){ return x.ref; }), dtids=dp.tenancies.map(function(x){ return x.id; });
        d.applications=d.applications.filter(function(x){ return drefs.indexOf(x.ref)<0; }); drefs.forEach(function(r){ delete d.contacts[r]; delete d.answers[r]; });
        d.tenancies=(d.tenancies||[]).filter(function(x){ return dtids.indexOf(x.id)<0; }); d.bondPayments=(d.bondPayments||[]).filter(function(x){ return dtids.indexOf(x.tenancyId)<0; });
        var dds=Demo.state(d); dds.deleted={people:drefs.length,agreements:dp.agreement?1:0,tenancies:dtids.length,bondPayments:dp.bondPayments,files:dp.submissions*2,notes:[]}; return done(dds);
      case 'tmAgreementProgress': case 'tmChangeProgress': return done({signed:1,signers:3,html:'<!DOCTYPE html><html><body style="font-family:Arial;padding:16px"><div style="border:2px solid #b45309;background:#fffbeb;padding:10px;border-radius:8px"><b>Progress preview, not a signed copy.</b> Demo: 1 of 3 signed.</div><h2>Residential Tenancy Agreement</h2><p>(The agreement as it stands, with the signatures given so far.)</p></body></html>'});
      case 'tmTenantProfile': return done(Demo.profile(d,a[0],a[1]));
      case 'tmSaveTenantProfile': var dt0=(d.tenancies||[]).find(function(x){ return x.id===a[0]; }); if(!dt0||!dt0.tenants[a[1]]) return fail('Tenant not found on this tenancy.');
        if(!String(a[2].name||'').trim()) return fail('Enter the tenant\u2019s full name.');
        Object.assign(dt0.tenants[a[1]],a[2]); var dref=dt0.tenants[a[1]].ref; if(dref){ d.answers2=d.answers2||{}; d.answers2[dref]=Object.assign(d.answers2[dref]||{},a[3]); }
        var dst=Demo.state(d); dst.profile=Demo.profile(d,a[0],a[1]); return done(dst);
      case 'tmSaveTermsMaster': d.termsMaster=cleanTerms(a[0]); return done(Demo.state(d));
      case 'tmCopyTermsToProperties': if(a[2]) d.termsMaster=cleanTerms(a[2]); var cn=0, cm=d.termsMaster||[];
        Demo.props(d).forEach(function(p){ if(a[0]&&a[0].length? a[0].indexOf(p.propertyId)<0 : !p.active) return; var nx=termsAfterCopy(p.additionalTerms,cm,a[1]); if(!sameTerms(nx,p.additionalTerms)){ p.additionalTerms=nx; cn++; } });
        var stc=Demo.state(d); stc.termsCopied=cn; return done(stc);
      case 'tmSetPropertyActive': Demo.props(d).find(function(x){ return x.propertyId===a[0]; }).active=!!a[1]; return done(Demo.state(d));
      case 'tmCheckTemplate': return done({id:a[0],title:'208 Hanover RTA 2026 Template',roles:['Tenant1','Tenant2','Tenant3','Tenant4','Tenant5','Landlord'],missingKeys:[],optionalKeys:['LandlordPhone','TenancyAddress','Insurer','ExcessAmount'],tenantFields:['Name','Email','Phone','Drivers','Passport','ID Number','18 Yes','18 No'],ok:true});
      case 'tmSaveLandlord': var ll0=Demo.landlords(d), nl=clone(a[0]), on0=a[1]; delete nl._for; nl.signer=nl.signer||nl.name;
        if(ll0.some(function(x){ return x.name.toLowerCase()===nl.name.toLowerCase() && x.name!==on0; })) return fail(nl.name+' is already on the landlords list.');
        if(on0){ Object.assign(ll0.find(function(x){ return x.name===on0; }),nl); Demo.props(d).forEach(function(x){ if(x.landlord===on0) x.landlord=nl.name; }); } else ll0.push(nl);
        return done(Demo.state(d));
      case 'tmDeleteLandlord': var us=Demo.props(d).filter(function(x){ return x.landlord===a[0]; });
        if(us.length) return fail(a[0]+' is the default landlord for '+us.map(function(x){ return x.name; }).join(', ')+'. Choose another landlord first.');
        d.landlords=Demo.landlords(d).filter(function(x){ return x.name!==a[0]; }); return done(Demo.state(d));
      case 'tmSaveTenancy': var tn0=clone(a[0]); delete tn0._for; d.tenancies=d.tenancies||[];
        tn0.property=(Demo.props(d).find(function(x){ return x.propertyId===tn0.propertyId; })||{}).address1||'';
        if(tn0.id){ Object.assign(d.tenancies.find(function(x){ return x.id===tn0.id; }),tn0); } else { tn0.id='T-D'+Date.now(); tn0.createdAt=new Date().toISOString(); tn0.createdBy='demo@example.com'; d.tenancies.push(tn0); }
        var st3=Demo.state(d); st3.savedTenancyId=tn0.id; return done(st3);
      case 'tmRecordBondPayment': var bt=d.tenancies.find(function(x){ return x.id===a[0]; }), bps=d.bondPayments=d.bondPayments||[];
        var had=bps.filter(function(x){ return x.tenancyId===a[0]; }).reduce(function(s,x){ return s+(+x.amount||0); },0);
        if(had+(+a[1].amount)>(+bt.bond||0)+0.005) return fail('That\u2019s more than the bond.');
        var nx=bps.reduce(function(m,x){ var n=+String(x.receiptNo).replace(/\D/g,''); return n>m?n:m; },0)+1, sent=(a[1].sendTo||[]).length;
        var np={id:'BP-D'+Date.now(),tenancyId:a[0],received:a[1].received,amount:+a[1].amount,paidBy:a[1].paidBy,method:a[1].method,receiptNo:'R-'+('000'+nx).slice(-4),receiptSentAt:sent?new Date().toISOString():'',receiptSentTo:(a[1].sendTo||[]).join(', '),receiptPdf:'',lodgedAt:'',notes:a[1].notes||'',recordedBy:'demo@example.com'};
        bps.push(np); var st5=Demo.state(d); st5.savedPaymentId=np.id; st5.receipt=sent?{ok:true}:null; return done(st5);
      case 'tmDeleteBondPayment': d.bondPayments=(d.bondPayments||[]).filter(function(x){ return x.id!==a[0]; }); return done(Demo.state(d));
      case 'tmSendBondReceipt': var rp=d.bondPayments.find(function(x){ return x.id===a[0]; }); rp.receiptSentAt=new Date().toISOString(); rp.receiptSentTo=a[1].join(', '); return done(Demo.state(d));
      case 'tmMarkBondLodged': var lt=d.tenancies.find(function(x){ return x.id===a[0]; });
        if(lt.bondMethod!=='Tenancy Services'){ var op=(d.bondPayments||[]).filter(function(x){ return x.tenancyId===a[0]&&!x.lodgedAt; }); if(!op.length) return fail('There are no bond payments waiting to be lodged.'); op.forEach(function(x){ x.lodgedAt=a[1].lodgedAt; }); }
        lt.bondLodgedAt=a[1].lodgedAt; if(a[1].bondNumber) lt.bondNumber=a[1].bondNumber; return done(Demo.state(d));
      case 'tmSetBondNumber': d.tenancies.find(function(x){ return x.id===a[0]; }).bondNumber=a[1]; return done(Demo.state(d));
      case 'tmSetBondMethod': var mt=d.tenancies.find(function(x){ return x.id===a[0]; });
        if(a[1]==='Tenancy Services'&&(d.bondPayments||[]).some(function(x){ return x.tenancyId===a[0]; })) return fail('Bond payments to you are already recorded for this tenancy.');
        mt.bondMethod=a[1]; mt.bondDueBy=a[1]==='Tenancy Services'?a[2]:''; return done(Demo.state(d));      case 'tmPreviewAgreement': return done({errors:[],warnings:[],html:'<html><body style="font-family:Arial;padding:16px"><h2>Residential tenancy agreement (preview)</h2><p>Demo preview of the built-in agreement for '+esc(a[0])+'. Rent $'+esc(a[1].details.rent)+' per week, bond $'+esc(a[1].details.bond)+'.</p><p><i>Unsigned preview</i></p></body></html>'});
      case 'tmResendAgreementLink': case 'tmResendChangeLink': return done({name:a[2]||'Demo signer',mobile:'021 555 0142',link:'https://kelvinbox.github.io/tenancy-esign/sign.html#demo-'+Date.now(),smsBody:'Here is your new link to sign: https://kelvinbox.github.io/tenancy-esign/sign.html#demo',emailed:a[1]==='email'});
      case 'tmTenancySummary': var ts=d.tenancies.find(function(x){ return x.id===a[0]; });
        return done({html:'<html><body style="font-family:Arial;padding:16px"><h2>Tenancy summary</h2><p>'+esc(ts.property)+'</p><ul>'+ts.tenants.map(function(p){ return '<li>'+esc(p.name)+' (from '+esc(p.moveIn)+')</li>'; }).join('')+'</ul><p>Signed versions: '+((ts.agreementVersions||[]).length||1)+'</p></body></html>'});
      case 'tmChangeTenants':
        var ct=d.tenancies.find(function(x){ return x.id===a[0]; }), cg=a[1];
        if(a[2]) return done({errors:[],warnings:[],html:'<html><body style="font-family:Arial;padding:16px"><h2>Change of tenants (preview)</h2><p>Leaving: '+esc(cg.leaving.join(', ')||'nobody')+'<br>Joining: '+esc(cg.joining.join(', ')||'nobody')+'<br>From '+esc(cg.effectiveDate)+'</p><p>Bond: '+esc(cg.bondArrangement)+'</p></body></html>'});
        var joiners=cg.joining.map(function(r){ var x=d.applications.find(function(y){ return y.ref===r; }); return {ref:r,name:x.name,email:x.email,mobile:x.mobile}; });
        var staying=ct.tenants.filter(function(p){ return cg.leaving.indexOf(p.email)<0; });
        var csg=staying.concat(joiners).map(function(p,i){ return {role:'Tenant'+(i+1),name:p.name,email:p.email,status:i?'Waiting':'Sent',sentAt:i?'':new Date().toISOString(),openedAt:'',signedAt:''}; });
        csg.push({role:'Landlord',name:ct.landlord||'Landlord',email:'landlord@example.com',status:'Waiting',sentAt:'',openedAt:'',signedAt:''});
        ct.pendingChange={provider:'esign',kind:'variation',status:'Sent',requestId:'ESV-'+Date.now(),signed:'0/'+csg.length,signers:csg,sentAt:new Date().toISOString(),
          changeSummary:(cg.leaving.length?'Leaving: '+ct.tenants.filter(function(p){ return cg.leaving.indexOf(p.email)>=0; }).map(function(p){ return p.name; }).join(', ')+'. ':'')+(joiners.length?'Joining: '+joiners.map(function(p){ return p.name; }).join(', ')+'.':''),
          _change:{effectiveDate:cg.effectiveDate,leaving:cg.leaving,joining:joiners,bondTotal:cg.bondTotal,bondArrangement:cg.bondArrangement}};
        return done(Demo.state(d));
      case 'tmRefreshTenancyChange':
        var rt=d.tenancies.find(function(x){ return x.id===a[0]; }), pc=rt.pendingChange, now1=new Date().toISOString();
        if(pc.status==='Sent'){ var nx1=pc.signers.find(function(s){ return !s.signedAt; });
          if(nx1){ if(!nx1.openedAt){ nx1.openedAt=now1; nx1.status='Opened'; } else { nx1.signedAt=now1; nx1.status='Signed'; var af=pc.signers[pc.signers.indexOf(nx1)+1]; if(af){ af.sentAt=now1; af.status='Sent'; } } }
          var n1=pc.signers.filter(function(s){ return s.signedAt; }).length; pc.signed=n1+'/'+pc.signers.length;
          if(n1===pc.signers.length){ var c1=pc._change, eff=c1.effectiveDate;
            rt.formerTenants=(rt.formerTenants||[]).concat(rt.tenants.filter(function(p){ return c1.leaving.indexOf(p.email)>=0; }).map(function(p){ var o=clone(p); o.moveOut=eff; return o; }));
            rt.tenants=rt.tenants.filter(function(p){ return c1.leaving.indexOf(p.email)<0; }).concat(c1.joining.map(function(p){ return {ref:p.ref,name:p.name,email:p.email,mobile:p.mobile,dob:'',moveIn:eff,addressForService:'Demo address for service'}; }));
            rt.agreementVersions=(rt.agreementVersions&&rt.agreementVersions.length?rt.agreementVersions:[{id:rt.requestId,pdf:rt.pdf,effective:rt.start}]).concat([{id:pc.requestId,pdf:'https://drive.google.com/file/d/demo-change/view',effective:eff}]);
            rt.requestId=pc.requestId; if(c1.bondTotal!==''&&c1.bondTotal!=null) rt.bond=+c1.bondTotal;
            rt.bondTasks=(rt.bondTasks||[]).concat([{id:'BH-'+Date.now(),type:'Change of tenant',effective:eff,due:addWorkingDays(eff,10,holidaySet()),leaving:rt.formerTenants.filter(function(p){ return p.moveOut===eff; }).map(function(p){ return p.name; }),joining:c1.joining.map(function(p){ return p.name; }),bondTotal:c1.bondTotal,bondArrangement:c1.bondArrangement,status:'Open',doneAt:''}]);
            rt.pendingChange=null; } }
        return done(Demo.state(d));
      case 'tmCancelTenancyChange': var cx=d.tenancies.find(function(x){ return x.id===a[0]; }); cx.pendingChange.status='Cancelled'; return done(Demo.state(d));
      case 'tmSetBondTask': var bt2=d.tenancies.find(function(x){ return x.id===a[0]; }); (bt2.bondTasks||[]).forEach(function(k){ if(k.id===a[1]){ k.status=a[2]?'Done':'Open'; k.doneAt=a[2]?todayYmd():''; } }); return done(Demo.state(d));      case 'tmDemoSetProvider': d.provider=d.provider==='esign'?'dochub':'esign'; return done(Demo.state(d));
      case 'tmDeleteTenancy': d.tenancies=(d.tenancies||[]).filter(function(x){ return x.id!==a[0]; }); return done(Demo.state(d));
      case 'tmCreateTenancyFromGroup': var id0=Demo.tenancyFromGroup(d,a[0]); if(!id0) return fail('The tenancy is created once everyone has signed the agreement.'); var st4=Demo.state(d); st4.savedTenancyId=id0; return done(st4);
      case 'tmSendAgreement': var gm=d.applications.filter(function(x){ return (x.group||x.ref)===a[0]; });
        var esD=d.provider==='esign', llD=Demo.landlords(d).find(function(x){ return x.name===a[1].landlord; })||{};
        var now0=new Date().toISOString(), sg=gm.map(function(x,i){ return {role:'Tenant'+(i+1),name:x.name,email:x.email,pos:i+1,sentAt:esD||!i?now0:'',viewedAt:'',signedAt:''}; });
        sg.push({role:'Landlord',name:a[1].landlord,email:'landlord@example.com',pos:gm.length+1,sentAt:'',viewedAt:'',signedAt:''});
        if(esD&&llD.signer2Name&&llD.signer2Email) sg.push({role:'Landlord 2',name:llD.signer2Name,email:llD.signer2Email,pos:gm.length+2,sentAt:'',viewedAt:'',signedAt:''});
        gm.forEach(function(x){ x.agreement={provider:esD?'esign':'dochub',status:'Sent',requestId:esD?'ES-'+a[0]+'-'+Date.now():'SR-demo',landlord:a[1].landlord,sentAt:now0,signed:'0/'+sg.length,signedAt:'',pdf:'',signers:JSON.parse(JSON.stringify(sg)),
          details:{rent:+a[1].details.rent,bond:+a[1].details.bond,maxOccupants:+a[1].details.maxOccupants,start:a[1].details.start,end:a[1].details.end,landlordAddress:a[1].details.landlordAddress,room:a[1].details.room||''}}; }); return done(Demo.state(d));
      case 'tmRefreshAgreement': d.applications.filter(function(x){ return (x.group||x.ref)===a[0]&&x.agreement; }).forEach(function(x){
          var sl=x.agreement.signers||[], nx=sl.find(function(s){ return !s.signedAt; }), t=new Date().toISOString();
          if(nx){ if(!nx.viewedAt) nx.viewedAt=t; else { nx.signedAt=t;
            if(x.agreement.provider==='esign'){ if(sl.every(function(s){ return /landlord/i.test(s.role)||s.signedAt; })) sl.forEach(function(s){ if(/landlord/i.test(s.role)&&!s.sentAt) s.sentAt=t; }); }
            else { var after=sl[sl.indexOf(nx)+1]; if(after) after.sentAt=t; } } }
          var n=sl.filter(function(s){ return s.signedAt; }).length; x.agreement.signed=n+'/'+sl.length;
          if(n===sl.length){ x.agreement.status='Signed'; x.agreement.signedAt=t; x.agreement.pdf='https://drive.google.com/file/d/demo/view'; } });
        Demo.tenancyFromGroup(d,a[0]); return done(Demo.state(d));
      case 'tmCancelAgreement': d.applications.filter(function(x){ return (x.group||x.ref)===a[0]&&x.agreement; }).forEach(function(x){ x.agreement.status='Cancelled'; }); return done(Demo.state(d));
      case 'tmResendApplyLink': var rsa=d.applications.find(function(x){ return x.ref===a[0]; }); if(rsa){ if(rsa.status!=='In Progress') rsa.status='Sent'; rsa.sentAt=new Date().toISOString(); rsa.applyExpires=new Date(Date.now()+14*86400000).toISOString(); } return done(Demo.state(d));
      case 'tmCancelApplyForm': var cfa=d.applications.find(function(x){ return x.ref===a[0]; }); if(cfa){ cfa.status='Cancelled'; cfa.applyExpires=new Date().toISOString(); } return done(Demo.state(d));
      case 'tmGetProgress': return done({ok:true,formType:'Full',lastSaved:new Date(Date.now()-12*60000).toISOString(),done:3,total:12,missing:2,status:'In Progress',submitted:false,steps:[
        {title:'Moving in',status:'done',current:false,rows:[{l:'When would you like to move in?',v:'01/12/2026',note:''},{l:'Length of tenancy you are looking for',v:'12 months',note:''}]},
        {title:'About you',status:'done',current:false,rows:[{l:'Full legal name',v:'Tom Wright',note:''},{l:'Mobile',v:'027 555 0199',note:''},{l:'How long have you lived there?',v:'3 years',note:''}]},
        {title:'Identification',status:'done',current:false,rows:[{l:'Driver licence number (5a)',v:'DL123456',note:''},{l:'Photo of your driver licence or passport',v:'2 files: licence.jpg, passport.pdf',note:'',file:true,files:[{name:'licence.jpg',url:'https://drive.google.com/file/d/demo1/view'},{name:'passport.pdf',url:'https://drive.google.com/file/d/demo2/view'}]}]},
        {title:'Your household',status:'started',current:true,rows:[{l:'How many people will live in the property, including you?',v:'2',note:''},{l:'Names of everyone who will live there',v:'',note:'Not answered yet'},{l:'Do you have any pets?',v:'',note:'Not answered yet'}]},
        {title:'Current rental',status:'empty',current:false,rows:[]},{title:'Previous rental',status:'empty',current:false,rows:[]}]});
      case 'tmSaveViewing': var v=fix(clone(a[0])); if(v.id){ var i=d.viewings.findIndex(function(x){return x.id===v.id;}); d.viewings[i]=Object.assign(d.viewings[i],v); } else { v.id='V-'+Date.now(); v.status='Scheduled'; d.viewings.push(v); } return done(Demo.state(d));
      case 'tmSetViewingStatus': d.viewings.find(function(x){return x.id===a[0];}).status=a[1]; return done(Demo.state(d));
      case 'tmSetGroup': Demo.move(d,a[0],a[1]); return done(Demo.state(d));
      case 'tmCreateGroup': var g=a[0], lead=null, vw=g.viewingId? d.viewings.find(function(x){return x.id===g.viewingId;}) : null, pr=vw||g.property;
        if(g.arrival && d.applications.some(function(x){ return x.viewingId===g.viewingId && x.arrival && new Date(x.arrival).getTime()===new Date(g.arrival).getTime(); })) return fail('That time has just been booked by another group. Pick another time.');
        g.people.forEach(function(p){ var r='KB-'+(d.n++); d.applications.push({ref:r,name:p.name,mobile:p.mobile,email:p.email,notes:'',address1:pr.address1,address2:pr.address2||'',rent:pr.rent,moveIn:pr.moveIn||'',tenancy:pr.tenancy||'',status:'Draft',srid:'',documentId:'',sentAt:'',viewedAt:'',signedAt:'',pdfUrl:'',driveUrl:'',lastError:'',creditCheck:'',viewingId:g.viewingId||'',attendedAt:new Date().toISOString(),decision:'',decisionNotes:'',group:lead||r,arrival:g.arrival||'',attendance:'',source:g.viewingId?'':g.source,sourceNotes:g.viewingId?'':(g.notes||'')}); if(!lead) lead=r; });
        var st1=Demo.state(d); st1.created={group:lead}; return done(st1);
      case 'tmAddToGroup': var ld=d.applications.find(function(x){return (x.group||x.ref)===a[0];}), r2='KB-'+(d.n++), p2=a[1];
        d.applications.push(Object.assign(clone(ld),{ref:r2,name:p2.name,mobile:p2.mobile,email:p2.email,notes:'',status:'Draft',srid:'',applyToken:'',sentAt:'',viewedAt:'',signedAt:'',pdfUrl:'',driveUrl:'',creditCheck:'',decision:ld.decision||'',attendedAt:new Date().toISOString(),group:ld.group||ld.ref}));
        return done(Demo.state(d));
      case 'tmSetGroupArrival': d.applications.forEach(function(x){ if((x.group||x.ref)===a[0]) x.arrival=a[1]; }); return done(Demo.state(d));
      case 'tmMoveGroupToViewing': var tv=d.viewings.find(function(x){return x.id===a[1];}); d.applications.forEach(function(x){ if((x.group||x.ref)===a[0]){ x.viewingId=a[1]; x.arrival=a[2]; x.attendance=''; x.address1=tv.address1; x.address2=tv.address2; x.rent=tv.rent; x.tenancy=tv.tenancy; } }); return done(Demo.state(d));
      case 'tmTribunalSearch': return done(Demo.tribunal(a[0]));
      case 'tmSaveTribunalCheck': var ta=d.applications.find(function(x){return x.ref===a[0];}); ta.tribunal=a[1].result; ta.tribunalNotes=a[1].notes; ta.tribunalSearches=a[1].searches; ta.tribunalAt=a[1].result?new Date().toISOString():''; ta.tribunalBy=a[1].checkedBy; return done(Demo.state(d));
      case 'tmSetAttendance': d.applications.forEach(function(x){ if((x.group||x.ref)===a[0]) x.attendance=a[1]; }); return done(Demo.state(d));
      case 'tmDetachFromViewing': var dx=d.applications.find(function(x){return x.ref===a[0];}); Demo.handOn(d,dx); dx.viewingId=''; dx.group=dx.ref; return done(Demo.state(d));
      case 'tmDeleteViewing': if(d.applications.some(function(x){return x.viewingId===a[0];})) return fail('Remove everyone from this viewing before deleting it.'); d.viewings=d.viewings.filter(function(x){return x.id!==a[0];}); return done(Demo.state(d));
      case 'tmSaveAttendee':
        var vw=d.viewings.find(function(x){return x.id===a[0];}), p=a[1], ex=p.ref? d.applications.find(function(x){return x.ref===p.ref;}) : null;
        if(ex){ Object.assign(ex,{name:p.name,mobile:p.mobile,email:p.email,notes:p.notes}); if(p.group!==undefined) Demo.move(d,ex.ref,p.group); return done({app:clone(ex),state:Demo.state(d)}); }
        var app={ref:'KB-'+(d.n++),name:p.name,mobile:p.mobile,email:p.email,notes:p.notes,address1:vw.address1,address2:vw.address2,rent:vw.rent,moveIn:vw.moveIn,tenancy:vw.tenancy,status:'Draft',srid:'',documentId:'',sentAt:'',viewedAt:'',signedAt:'',pdfUrl:'',driveUrl:'',lastError:'',creditCheck:'',viewingId:a[0],attendedAt:new Date().toISOString(),decision:'',decisionNotes:''};
        var ld=p.group? d.applications.find(function(x){return x.ref===p.group;}) : null; app.group=ld?(ld.group||ld.ref):app.ref;
        d.applications.push(app); return done({app:clone(app),state:Demo.state(d)});
      case 'tmRemoveAttendee': var rx=d.applications.find(function(x){return x.ref===a[0];}); delete d.contacts[a[0]]; Demo.handOn(d,d.applications.find(function(x){return x.ref===a[0];})); d.applications=d.applications.filter(function(x){ return x.ref!==a[0]; }); return done(Demo.state(d));
      case 'tmSendApplications': var res=a[0].map(function(r){ var x=d.applications.find(function(y){return y.ref===r;}); x.applyToken='demo'; x.formType=(a[1]&&a[1].formType)||'Full'; x.applyLink='https://example.github.io/apply/?t=demo'; x.applyExpires=new Date(Date.now()+14*864e5).toISOString(); x.status='Sent'; x.sentAt=new Date().toISOString(); return {ref:r,ok:true}; }); return done({results:res,state:Demo.state(d)});
      case 'tmRefresh': return done({checked:0,results:[],state:Demo.state(d)});
      case 'tmUpdateApplication': var u=d.applications.find(function(x){return x.ref===a[0];}); if(a[1].decision!==undefined) u.decision=a[1].decision; if(a[1].decisionNotes!==undefined) u.decisionNotes=a[1].decisionNotes; if(a[1].creditCheck!==undefined) u.creditCheck=a[1].creditCheck; if(a[1].courtFines!==undefined) u.courtFines=a[1].courtFines;
        if(a[1].applyToGroup) d.applications.forEach(function(x){ if((x.group||x.ref)===(u.group||u.ref)){ x.decision=u.decision; x.decisionNotes=u.decisionNotes; } }); return done(Demo.state(d));
      case 'tmUpdateGroupDetails': var gx=a[1], gp=(d.properties||[]).filter(function(p){ return p.propertyId===gx.propertyId; })[0];
        d.applications.forEach(function(x){ if((x.group||x.ref)!==a[0]) return; if(gp){ x.propertyId=gp.propertyId; x.address1=gp.address1; x.address2=gp.address2; }
          x.rent=gx.rent===''?'':+gx.rent; x.tenancy=gx.tenancy; x.moveIn=gx.moveIn?gx.moveIn+'T00:00:00.000Z':''; x.source=gx.source; x.sourceNotes=gx.notes; });
        return done(Demo.state(d));
      case 'tmGetReferences': return done(Demo.refs(d,a[0]));
      case 'tmScreeningQuestions': return done({sets:JSON.parse(JSON.stringify(d.questions)),legacy:false});
      case 'tmSaveScreeningQuestions': d.questions=a[0].map(function(q,i){ return {id:q.id||('QS-n'+i),name:q.name.trim(),note:q.note||'',flags:q.kind==='Red flags',usedFor:q.kind==='Red flags'?[]:q.usedFor.slice(),items:q.items.map(function(x){ return String(x).trim(); }).filter(String)}; }); return done({sets:JSON.parse(JSON.stringify(d.questions)),legacy:false});
      case 'tmDriveFile': return done({name:'Signed application.pdf',mime:'image/svg+xml',data:btoa('<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560"><rect width="420" height="560" fill="#fff" stroke="#ccc"/><text x="30" y="60" font-size="26" font-family="sans-serif">DEMO SIGNED DOCUMENT</text></svg>')});
      case 'tmPhotoIdFile': return done({name:'licence.svg',mime:'image/svg+xml',data:btoa('<svg xmlns="http://www.w3.org/2000/svg" width="540" height="340"><rect width="540" height="340" rx="24" fill="#e8f4ee"/><text x="40" y="80" font-size="34" font-family="sans-serif">DEMO DRIVER LICENCE</text><rect x="40" y="120" width="140" height="170" fill="#bbb"/></svg>')});
      case 'tmCreditDetails': var ca=d.applications.find(function(x){return x.ref===a[0];})||{};
        return done({ref:a[0],name:ca.name||'',dob:'1998-04-07',email:ca.email||'',licenceNumber:'AB123456',licenceVersion:'123',
          address:'12 Smith Street, Mornington, Dunedin 9011',howLong:'2 years 3 months',prevAddress:'Flat 2, 45 Queen Street, North Dunedin, Dunedin 9016',prevHowLong:'18 months',photoId:[{name:'licence.jpg',url:'https://example.com/licence.jpg'}],uploadsFolder:'',files:Demo.files()});
      case 'tmSaveReferenceCheck': var c=(d.contacts[a[0]]||[]).find(function(x){return x.slot===a[1];}), pl=a[2];
        Object.assign(c,{status:pl.status,outcome:pl.outcome,notes:pl.notes,checkedBy:pl.checkedBy,checkedAt:new Date().toISOString()});
        (pl.alsoFor||[]).forEach(function(t){ var oc=(d.contacts[t.ref]||[]).find(function(x){return x.slot===t.slot;}); if(oc) Object.assign(oc,{status:pl.status,outcome:pl.outcome,notes:pl.notes,checkedBy:pl.checkedBy,checkedAt:new Date().toISOString()}); });
        var items={}; pl.answers.forEach(function(q){ if(q.answer) items[q.question]=q.answer; }); (d.answers[a[0]]=d.answers[a[0]]||{})[a[1]]={set:pl.set,items:items,recordedAt:new Date().toISOString(),recordedBy:pl.checkedBy};
        return done(Demo.refs(d,a[0]));
      case 'tmAddContact': var list=d.contacts[a[0]]=d.contacts[a[0]]||[], k=1; while(list.some(function(x){return x.slot==='Additional '+k;})) k++;
        list.push({slot:'Additional '+k,contact:a[1].name,relationship:a[1].relationship,phone:a[1].phone,email:a[1].email,address:'',rent:'',vacated:'',source:'Manual',status:'Not started',outcome:'',notes:'',checkedBy:'',checkedAt:''}); return done(Demo.refs(d,a[0]));
      case 'tmReimportReferences': return done(Demo.refs(d,a[0]));
      case 'tmMarkEmailSent': (d.contacts[a[0]]||[]).find(function(x){return x.slot===a[1];}).emailSent=a[2]?new Date().toISOString():''; return done(Demo.refs(d,a[0]));
    }
    return fail('Unknown call '+n);
  }
};
function clone(o){ return JSON.parse(JSON.stringify(o)); }

/* The old app (inside Google's frame) is being replaced by the Rentals app: say so, with a link (hidden for the day on request) */
var OLD_APP = HAS_GAS && !window.RENTALS_CONFIG;
function moveBanner(){
  var b=$('#moveBanner'); if(!OLD_APP || !b) return;
  try{ if(localStorage.getItem('tm-move-hide')===new Date().toDateString()) return; }catch(e){}
  b.innerHTML='\uD83C\uDFE0 A new <b>Rentals</b> app is replacing this one. <a href="https://lsproperties.github.io/" target="_blank" rel="noopener" style="color:#fff;font-weight:700">Open the new app</a> '+
    '<button type="button" data-move="hide" style="background:none;border:0;color:#fff;font:inherit;text-decoration:underline;cursor:pointer">Hide today</button>';
  b.classList.remove('hidden');
}
document.addEventListener('click',function(e){ if(e.target.closest('[data-move=hide]')){ try{ localStorage.setItem('tm-move-hide',new Date().toDateString()); }catch(x){} $('#moveBanner').classList.add('hidden'); } });
moveBanner();

/* ================= Boot ================= */
if(!HAS_GAS) $('#demoBanner').classList.remove('hidden');
net();
/* Start from what this phone loaded last time, then refresh from the server in the background. The screen is redrawn
   with the fresh data unless something is being typed. Only the very first open on a phone waits for the server. */
/* Opened from a notification: #app=<ref> or #tenancy=<id> opens that record (once it's loaded; a new application may
   only arrive with the refresh). */
function openFromLink(){
  var m=/^#(app|tenancy)=(.+)$/.exec(location.hash||''); if(!m||!S.st) return;
  var id=decodeURIComponent(m[2]), ok=m[1]==='app'? appByRef(id) : tenancyById(id); if(!ok) return;
  try{ history.replaceState(null,'',location.pathname+location.search); }catch(x){}
  S.stack=[]; S.cur={view:'home'}; go(m[1],id);
}
window.addEventListener('hashchange',openFromLink);
var saved=null; try{ saved=JSON.parse(localStorage.getItem('tm-cache')||'null'); }catch(x){}
if(HAS_GAS && saved && saved.applications){
  S.st=saved; S.cur={view:'home'}; render(); openFromLink();
  S.syncing=true; net();
  api.tmBootstrap().then(function(st){
    apply(st); S.syncing=false; net();
    var typing=/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement||{}).tagName||'');
    if(!unsavedWork() && !typing && !document.querySelector('.modal')){ var y=window.scrollY; render(); setTimeout(function(){ window.scrollTo(0,y); },0); }
    openFromLink();
    checkForUpdate(true);
  }).catch(function(){ S.syncing=false; net(); toast('Offline: showing what was last loaded',6000); });
} else api.tmBootstrap().then(apply).catch(function(e){
  try{ S.st=JSON.parse(localStorage.getItem('tm-cache')||'null'); }catch(x){}
  toast(S.st? 'Offline \u2014 showing what was last loaded' : e.message, 6000);
}).then(function(){ S.cur={view:'home'}; render(); openFromLink(); checkForUpdate(true); });
})();