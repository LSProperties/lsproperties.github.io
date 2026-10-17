/* Rentals app home: Setup, one place for both apps' settings (API 0.5.0).
   Everyone: My details (name = the inspector name and the email sign-off), this device's notifications, signed-in devices.
   With access: the Tenancies settings screens (Properties with inspection areas, Landlords, Screening questions,
   Additional terms) and Maintenance jobs, opened in those apps; Back there comes back here.
   Admins: the admin PIN, users and access (each change needs the PIN, is logged and emailed to the owner), test tools. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var S = window.RentalsSession, call = window.rentalsCall;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var D = { profile: null, users: null, pin: null, editing: null, tab: '' };
  var TAB_KEY = 'rentals-setup-tab';

  function open() {
    window.RentalsHome.show('setup');
    if (!D.tab) { try { D.tab = localStorage.getItem(TAB_KEY) || 'me'; } catch (e) { D.tab = 'me'; } }
    draw();
    // a load only redraws its own tab, so nothing being typed on another tab is lost
    call('auth', 'profile').then(function (p) { D.profile = p; if (D.tab === 'me') draw(); }, function (e) { D.profile = { error: e.message }; if (D.tab === 'me') draw(); });
    if (isAdmin()) {
      call('auth', 'users').then(function (r) { D.users = r; D.pin = r.pinSet; if (D.tab === 'admin') draw(); }, function (e) { D.users = { error: e.message }; if (D.tab === 'admin') draw(); });
    }
    window.scrollTo(0, 0);
  }
  function head(ic, cls, title, note) {
    return '<div class="card-h"><div class="ic-tile ' + cls + '" aria-hidden="true">' + ic + '</div><div class="grow"><div class="title">' + esc(title) + '</div>' + (note ? '<div class="small">' + esc(note) + '</div>' : '') + '</div></div>';
  }
  function initials(n, e) { var w = String(n || '').trim().split(/\s+/).filter(String); return (w.length ? (w[0][0] + (w.length > 1 ? w[w.length - 1][0] : '')) : String(e || '?')[0]).toUpperCase(); }
  function isAdmin() { var s = S.get(); return !!(s && s.role === 'admin'); }
  function level(a) { return S.level(a); }

  /* The bottom menu: Me (details, devices), Alerts (notifications), Settings (each area's settings), Admin (admins) */
  function tabs() {
    var t = [['me', '🙋', 'Me'], ['alerts', '🔔', 'Alerts']];
    if (settingsLinks().length) t.push(['settings', '⚙️', 'Settings']);
    if (isAdmin()) t.push(['admin', '🔒', 'Admin']);
    return t;
  }
  function settingsLinks() {
    var links = [];
    if (level('tm') !== 'none') {
      links.push(['tm/#setup=props', 'Properties', 'Letting details, agreement set-up and inspection areas and checks', '\uD83C\uDFE0', 't2']);
      links.push(['tm/#setup=landlords', 'Landlords', 'Who signs tenancy agreements and their contact details', '\uD83D\uDC64', 't5']);
      links.push(['tm/#setup=questions', 'Screening questions', 'What you ask each referee, and the red flags', '\uD83D\uDCDD', 't1']);
      links.push(['tm/#setup=terms', 'Additional terms', 'The master list of extra terms for agreements', '\uD83D\uDCDC', 't4']);
    }
    if (level('mt') === 'edit') links.push(['mt/#manage', 'Maintenance jobs', 'How often each job is done, the reminders, and which jobs are on', '\uD83D\uDD27', 't3']);
    return links;
  }
  function tabBarHtml(list) {
    return list.map(function (t) {
      return '<button type="button" data-sutab="' + t[0] + '" class="' + (D.tab === t[0] ? 'on' : '') + '"' + (D.tab === t[0] ? ' aria-current="page"' : '') + '><span class="ic" aria-hidden="true">' + t[1] + '</span>' + t[2] + '</button>';
    }).join('');
  }

  function draw() {
    var list = tabs();
    if (!list.some(function (t) { return t[0] === D.tab; })) D.tab = 'me';
    var bar = $('suTabs');
    if (!bar) { bar = document.createElement('nav'); bar.id = 'suTabs'; bar.className = 'sutabs'; bar.setAttribute('aria-label', 'Setup sections'); $('setup').appendChild(bar); }
    bar.innerHTML = tabBarHtml(list);
    $('devBox').hidden = D.tab !== 'me';
    var h = D.tab === 'alerts' ? '<div id="suPush"></div>'
      : D.tab === 'settings' ? settingsHtml() : D.tab === 'admin' ? adminHtml() : meHtml();
    $('setupBody').innerHTML = h;
    var box = $('suPush');
    if (box && window.RentalsPush) window.RentalsPush.mount(box); else if (box) box.innerHTML = '<div class="small">Notifications need the app opened from its Home Screen icon.</div>';
  }
  function settingsHtml() {
    var links = settingsLinks();
    return (level('tm') === 'view' ? '<div class="small" style="margin:0 4px 10px">You can look at the Tenancies settings, but not change them.</div>' : '') + links.map(function (l) {
      return '<a class="link" href="' + l[0] + '"><span class="ic-tile ' + l[4] + '" aria-hidden="true">' + l[3] + '</span><span class="txt"><b>' + esc(l[1]) + '</b><span class="small">' + esc(l[2]) + '</span></span></a>';
    }).join('');
  }

  function meHtml() {
    var h = '', p = D.profile;
    h += '<div class="card"><div class="card-h"><div class="avatar big" aria-hidden="true">' + esc(initials(p && p.name, p && p.email)) + '</div><div class="grow"><div class="title">My details</div>' +
      '<div class="small">Your name shows as the inspector on inspections, and signs off the emails you send.</div></div></div>';
    if (!p) h += '<div class="small">Loading…</div>';
    else if (p.error) h += '<div class="err">' + esc(p.error) + '</div>';
    else h += '<label class="fld"><span>Name</span><input id="pfName" autocomplete="name" value="' + esc(p.name) + '"></label>' +
      '<div class="pair"><label class="fld"><span>Mobile</span><input id="pfMobile" type="tel" autocomplete="tel" value="' + esc(p.mobile) + '"></label>' +
      '<label class="fld"><span>Other phone</span><input id="pfPhone" type="tel" value="' + esc(p.phone) + '"></label></div>' +
      '<button class="btn primary" type="button" data-su="profile">Save</button> <span class="small" id="pfMsg"></span>';
    h += '</div>';
    return h;
  }

  function adminHtml() {
    var u = D.users, h = '';
    // the admin PIN
    h += '<div class="card">' + head('\uD83D\uDD12', 't1', 'Admin PIN', 'One PIN for both apps: deleting groups with forms, agreements or tenancies, editing or deleting submitted inspections, and changing users and access.') +
      '<div class="pair">' +
      (D.pin ? '<label class="fld"><span>Current PIN</span><input id="pinCur" type="password" inputmode="numeric" autocomplete="off"></label>' : '') +
      '<label class="fld"><span>' + (D.pin ? 'New PIN' : 'PIN (4 to 8 digits)') + '</span><input id="pinNew" type="password" inputmode="numeric" autocomplete="off"></label></div>' +
      '<button class="btn primary" type="button" data-su="pin">' + (D.pin ? 'Change PIN' : 'Set PIN') + '</button> <span class="small" id="pinMsg">' + (D.pin === null ? '' : D.pin ? 'Set' : '<b class="err">Not set</b>') + '</span></div>';
    // users and access
    h += '<div class="card"><div class="card-h"><div class="ic-tile t5" aria-hidden="true">\uD83D\uDC65</div><div class="grow"><div class="title">Users and access</div>' +
      '<div class="small">Who can sign in, and Edit / View / None for each area. Changes need the admin PIN, are logged and emailed to the owner, and apply within 5 minutes.</div></div>' +
      '<button class="btn" type="button" data-su="add" style="align-self:flex-start">\uFF0B Add</button></div>';
    if (!u) h += '<div class="small">Loading…</div>';
    else if (u.error) h += '<div class="err">' + esc(u.error) + '</div>';
    else {
      h += u.users.map(function (x) {
        var lv = function (k, n) { var v = x.access[k]; return '<span class="pill ' + v + '">' + n + ' \u00B7 ' + ({ edit: 'Edit', view: 'View', none: 'None' })[v] + '</span>'; };
        return '<div class="urow" data-user="' + esc(x.email) + '"><div class="avatar" aria-hidden="true"' + (x.active ? '' : ' style="filter:grayscale(1);opacity:.6"') + '>' + esc(initials(x.name, x.email)) + '</div><div class="txt"><b>' + esc(x.name || x.email) + '</b>' +
          (x.owner ? ' <span class="pill tag">Owner</span>' : '') + (x.me ? ' <span class="pill tag">You</span>' : '') + (x.active ? '' : ' <span class="pill bad">Can\u2019t sign in</span>') +
          '<div class="small">' + esc(x.email) + ' \u00B7 ' + esc(x.role.charAt(0).toUpperCase() + x.role.slice(1)) + '</div>' + lv('tm', 'Tenancies') + lv('fi', 'Inspections') + lv('mt', 'Maintenance') + '</div></div>';
          (x.active ? '' : ' <span class="pill" style="color:var(--bad)">Not active</span>') + '<br><span class="small">' + esc(x.email) + ' · ' + esc(x.role) + '</span><br>' +
          lv('tm', 'Tenancies') + lv('fi', 'Inspections') + lv('mt', 'Maintenance') + '</span><span aria-hidden="true">›</span></div>';
      }).join('');
    }
    h += '</div>';
    // tools
    if (level('tm') === 'edit') h += '<div class="small" style="margin:4px 4px 10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">Tools</div>' +
      '<a class="link" href="tm/#setup=test"><span class="ic-tile t2" aria-hidden="true">\uD83E\uDDEA</span><span class="txt"><b>Test suite</b><span class="small">Run the whole tenancy process with made-up tenants</span></span></a>' +
      '<a class="link" href="tm/#setup=speed"><span class="ic-tile t5" aria-hidden="true">\u23F1</span><span class="txt"><b>Speed check</b><span class="small">How long loading and saving take on this device</span></span></a>';
    return h;
  }
  function userForm(e) {
    var isNew = e === 'new', x = isNew ? { email: '', name: '', role: 'member', active: true, tenancies: '', inspections: '', maintenance: '' } : D.users.users.filter(function (u) { return u.email === e; })[0];
    if (!x) return '';
    var locked = !isNew && (x.owner || x.me);
    var sel = function (id, v) {
      return '<label class="fld"><span>' + id + '</span><select data-uf="' + id.toLowerCase() + '"' + (locked ? ' disabled' : '') + '>' +
        [['', 'From role'], ['Edit', 'Edit'], ['View', 'View'], ['None', 'None']].map(function (o) { return '<option value="' + o[0] + '"' + (String(v) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>';
    };
    return '<div id="userForm"><div class="title" style="font-size:1.2rem;margin-bottom:10px">' + (isNew ? 'Add someone' : esc(x.name || x.email)) + '</div>' +
      (locked ? '<div class="small" style="margin:4px 0 10px">' + (x.owner ? 'The owner account can only be changed in the spreadsheet.' : 'You can’t change your own access. Ask another admin.') + '</div>' : '') +
      (isNew ? '<label class="fld"><span>Email</span><input data-uf="email" type="email" autocomplete="off"></label>' : '') +
      '<label class="fld"><span>Name</span><input data-uf="name" value="' + esc(x.name) + '"' + (locked ? ' disabled' : '') + '></label>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end"><label class="fld"><span>Role</span><select data-uf="role"' + (locked ? ' disabled' : '') + '>' +
        [['admin', 'Admin'], ['member', 'Member'], ['viewer', 'Viewer']].map(function (o) { return '<option value="' + o[0] + '"' + (x.role === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld"><span>Can sign in</span><select data-uf="active"' + (locked ? ' disabled' : '') + '><option value="yes"' + (x.active ? ' selected' : '') + '>Yes</option><option value="no"' + (x.active ? '' : ' selected') + '>No</option></select></label></div>' +
      '<div class="grid3">' + sel('Tenancies', x.tenancies) + sel('Inspections', x.inspections) + sel('Maintenance', x.maintenance) + '</div>' +
      '<div class="small" style="margin:-4px 0 10px">From role: a Viewer gets View, everyone else Edit.</div>' +
      (locked ? '' : '<label class="fld"><span>Admin PIN</span><input data-uf="pin" type="password" inputmode="numeric" autocomplete="off"></label>') +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' + (locked ? '' : '<button class="btn primary" type="button" data-su="save-user" data-new="' + (isNew ? '1' : '') + '">Save</button>') +
      '<button class="btn" type="button" data-su="cancel-user">' + (locked ? 'Close' : 'Cancel') + '</button></div><div class="err" id="ufMsg" style="margin-top:8px"></div></div>';
  }

  function busy(b, p) { b.disabled = true; return p.then(function (r) { b.disabled = false; return r; }, function (e) { b.disabled = false; throw e; }); }
  /* A person's details open in a pop-up over the list (tap outside, Cancel or Esc closes it) */
  function userModal(key) {
    closeUserModal();
    D.editing = key;
    var m = document.createElement('div');
    m.className = 'modal'; m.id = 'userModal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = '<div class="box">' + userForm(key) + '</div>';
    document.body.appendChild(m); document.body.classList.add('modal-open');
    m.addEventListener('click', function (e) {
      if (e.target === m) return closeUserModal();
      var b = e.target.closest('[data-su]'); if (!b) return;
      var act = b.getAttribute('data-su');
      if (act === 'cancel-user') return closeUserModal();
      if (act === 'save-user') {
        var f = $('userForm'), v = function (k) { var el = f.querySelector('[data-uf="' + k + '"]'); return el ? el.value : ''; }, isNew = !!b.getAttribute('data-new');
        var u = { email: isNew ? v('email') : D.editing, name: v('name'), role: v('role'), active: v('active') === 'yes', tenancies: v('tenancies'), inspections: v('inspections'), maintenance: v('maintenance') };
        $('ufMsg').textContent = '';
        busy(b, call('auth', 'saveUser', [], { pin: v('pin'), user: u, isNew: isNew })).then(function (r) { D.users = r; closeUserModal(); draw(); },
          function (x) { $('ufMsg').textContent = x.message; });
      }
    });
    var first = m.querySelector('input:not([disabled]),select:not([disabled])'); if (first && key === 'new') first.focus();
  }
  function closeUserModal() { var m = $('userModal'); if (m) m.remove(); document.body.classList.remove('modal-open'); D.editing = null; }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('userModal')) closeUserModal(); });

  $('setupBody').addEventListener('click', function (e) {
    var row = e.target.closest('[data-user]');
    if (row) return userModal(row.getAttribute('data-user'));
    var b = e.target.closest('[data-su]'); if (!b) return;
    var act = b.getAttribute('data-su');
    if (act === 'profile') {
      $('pfMsg').textContent = 'Saving…';
      busy(b, call('auth', 'saveProfile', [], { profile: { name: $('pfName').value, mobile: $('pfMobile').value, phone: $('pfPhone').value } })).then(function (p) {
        D.profile = p; var s = S.get(); if (s) { s.name = p.name; S.set(s); }
        $('who').textContent = (p.name ? p.name + ' · ' : '') + (s ? s.email : '');
        draw(); $('pfMsg').textContent = 'Saved.';
      }, function (x) { $('pfMsg').innerHTML = '<span class="err">' + esc(x.message) + '</span>'; });
    } else if (act === 'pin') {
      $('pinMsg').textContent = 'Saving…';
      busy(b, call('auth', 'setPin', [], { current: ($('pinCur') || {}).value || '', next: $('pinNew').value })).then(function () { D.pin = true; draw(); $('pinMsg').textContent = 'PIN saved.'; },
        function (x) { $('pinMsg').innerHTML = '<span class="err">' + esc(x.message) + '</span>'; });
    } else if (act === 'add') userModal('new');
  });
  $('setup').addEventListener('click', function (e) {
    var t = e.target.closest('[data-sutab]'); if (!t) return;
    D.tab = t.getAttribute('data-sutab'); D.editing = null;
    try { localStorage.setItem(TAB_KEY, D.tab); } catch (x) {}
    draw(); window.scrollTo(0, 0);
  });
  // the app icon in the header does the same as Back (as in the apps)
  $('hdrHome').addEventListener('click', function (e) { e.preventDefault(); $('setupBack').click(); });
  $('setupBack').onclick = function () { try { history.replaceState(null, '', location.pathname + location.search); } catch (x) {} window.RentalsHome.home(); window.scrollTo(0, 0); };
  window.RentalsSetup = { open: open };
  if (location.hash === '#setup' && S.get()) open();
})();
