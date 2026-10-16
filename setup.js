/* Rentals app home: Setup, one place for both apps' settings (API 0.5.0).
   Everyone: My details (name = the inspector name and the email sign-off), this device's notifications, signed-in devices.
   With access: the Tenancies settings screens (Properties with inspection areas, Landlords, Screening questions,
   Additional terms) and Maintenance jobs, opened in those apps; Back there comes back here.
   Admins: the admin PIN, users and access (each change needs the PIN, is logged and emailed to the owner), test tools. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var S = window.RentalsSession, call = window.rentalsCall;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var D = { profile: null, users: null, pin: null, editing: null };

  function open() {
    window.RentalsHome.show('setup');
    draw();
    call('auth', 'profile').then(function (p) { D.profile = p; draw(); }, function (e) { D.profile = { error: e.message }; draw(); });
    if (isAdmin()) {
      call('auth', 'users').then(function (r) { D.users = r; D.pin = r.pinSet; draw(); }, function (e) { D.users = { error: e.message }; draw(); });
    }
    window.scrollTo(0, 0);
  }
  function isAdmin() { var s = S.get(); return !!(s && s.role === 'admin'); }
  function level(a) { return S.level(a); }

  function draw() {
    var h = '', p = D.profile;
    // My details
    h += '<div class="card"><div class="title">My details</div><div class="small" style="margin:2px 0 10px">Your name shows as the inspector on inspections, and signs off the emails you send.</div>';
    if (!p) h += '<div class="small">Loading…</div>';
    else if (p.error) h += '<div class="err">' + esc(p.error) + '</div>';
    else h += '<label class="fld"><span>Name</span><input id="pfName" autocomplete="name" value="' + esc(p.name) + '"></label>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end"><label class="fld"><span>Mobile</span><input id="pfMobile" type="tel" autocomplete="tel" value="' + esc(p.mobile) + '"></label>' +
      '<label class="fld"><span>Other phone</span><input id="pfPhone" type="tel" value="' + esc(p.phone) + '"></label></div>' +
      '<button class="btn primary" type="button" data-su="profile">Save</button> <span class="small" id="pfMsg"></span>';
    h += '</div>';
    // Notifications (this device)
    h += '<div class="card"><div class="title">Notifications</div><div id="suPush" style="margin-top:8px"></div></div>';
    // Settings for each area (opened in that app)
    var links = [];
    if (level('tm') !== 'none') {
      links.push(['tm/#setup=props', 'Properties', 'Letting details, agreement set-up and inspection areas and checks']);
      links.push(['tm/#setup=landlords', 'Landlords', 'Who signs tenancy agreements and their contact details']);
      links.push(['tm/#setup=questions', 'Screening questions', 'What you ask each referee, and the red flags']);
      links.push(['tm/#setup=terms', 'Additional terms', 'The master list of extra terms for agreements']);
    }
    if (level('mt') === 'edit') links.push(['mt/#manage', 'Maintenance jobs', 'How often each job is done, the reminders, and which jobs are on']);
    if (links.length) h += '<div class="card"><div class="title">Settings</div>' + links.map(function (l) {
      return '<a class="link" href="' + l[0] + '"><span><b>' + esc(l[1]) + '</b><span class="small">' + esc(l[2]) + '</span></span><span aria-hidden="true">›</span></a>';
    }).join('') + (level('tm') === 'view' ? '<div class="small">You can look at these, but not change them.</div>' : '') + '</div>';
    // Admin
    if (isAdmin()) h += adminHtml();
    $('setupBody').innerHTML = h;
    var box = $('suPush');
    if (box && window.RentalsPush) window.RentalsPush.mount(box); else if (box) box.innerHTML = '<div class="small">Notifications need the app opened from its Home Screen icon.</div>';
  }

  function adminHtml() {
    var u = D.users, h = '';
    // the admin PIN
    h += '<div class="card"><div class="title">Admin PIN</div><div class="small" style="margin:2px 0 10px">One PIN for both apps: deleting groups with forms, agreements or tenancies, editing or deleting submitted inspections, and changing users and access.</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end">' +
      (D.pin ? '<label class="fld"><span>Current PIN</span><input id="pinCur" type="password" inputmode="numeric" autocomplete="off"></label>' : '') +
      '<label class="fld"><span>' + (D.pin ? 'New PIN' : 'PIN (4 to 8 digits)') + '</span><input id="pinNew" type="password" inputmode="numeric" autocomplete="off"></label></div>' +
      '<button class="btn primary" type="button" data-su="pin">' + (D.pin ? 'Change PIN' : 'Set PIN') + '</button> <span class="small" id="pinMsg">' + (D.pin === null ? '' : D.pin ? 'Set' : '<b class="err">Not set</b>') + '</span></div>';
    // users and access
    h += '<div class="card"><div style="display:flex;align-items:center;gap:8px"><div class="title" style="flex:1">Users and access</div><button class="btn" type="button" data-su="add">＋ Add</button></div>' +
      '<div class="small" style="margin:2px 0 8px">Who can sign in, and Edit / View / None for each area. Changes need the admin PIN, are logged and emailed to the owner, and take effect within 5 minutes.</div>';
    if (!u) h += '<div class="small">Loading…</div>';
    else if (u.error) h += '<div class="err">' + esc(u.error) + '</div>';
    else {
      if (D.editing) h += userForm(D.editing);
      h += u.users.map(function (x) {
        var lv = function (k, n) { return '<span class="pill">' + n + ': ' + ({ edit: 'Edit', view: 'View', none: 'None' })[x.access[k]] + '</span>'; };
        return '<div class="urow" data-user="' + esc(x.email) + '"><span><b>' + esc(x.name || x.email) + '</b>' + (x.owner ? ' <span class="pill">Owner</span>' : '') + (x.me ? ' <span class="pill">You</span>' : '') +
          (x.active ? '' : ' <span class="pill" style="color:var(--bad)">Not active</span>') + '<br><span class="small">' + esc(x.email) + ' · ' + esc(x.role) + '</span><br>' +
          lv('tm', 'Tenancies') + lv('fi', 'Inspections') + lv('mt', 'Maintenance') + '</span><span aria-hidden="true">›</span></div>';
      }).join('');
    }
    h += '</div>';
    // tools
    if (level('tm') === 'edit') h += '<div class="card"><div class="title">Tools</div>' +
      '<a class="link" href="tm/#setup=test"><span><b>Test suite</b><span class="small">Run the whole tenancy process with made-up tenants</span></span><span aria-hidden="true">›</span></a>' +
      '<a class="link" href="tm/#setup=speed"><span><b>Speed check</b><span class="small">How long loading and saving take on this device</span></span><span aria-hidden="true">›</span></a></div>';
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
    return '<div class="card" style="background:var(--card)" id="userForm"><div class="title">' + (isNew ? 'Add someone' : esc(x.name || x.email)) + '</div>' +
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
  $('setupBody').addEventListener('click', function (e) {
    var row = e.target.closest('[data-user]');
    if (row) { D.editing = row.getAttribute('data-user'); draw(); var f = $('userForm'); if (f) f.scrollIntoView({ block: 'start' }); return; }
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
    } else if (act === 'add') { D.editing = 'new'; draw(); }
    else if (act === 'cancel-user') { D.editing = null; draw(); }
    else if (act === 'save-user') {
      var f = $('userForm'), v = function (k) { var el = f.querySelector('[data-uf="' + k + '"]'); return el ? el.value : ''; }, isNew = !!b.getAttribute('data-new');
      var u = { email: isNew ? v('email') : D.editing, name: v('name'), role: v('role'), active: v('active') === 'yes', tenancies: v('tenancies'), inspections: v('inspections'), maintenance: v('maintenance') };
      $('ufMsg').textContent = '';
      busy(b, call('auth', 'saveUser', [], { pin: v('pin'), user: u, isNew: isNew })).then(function (r) { D.users = r; D.editing = null; draw(); },
        function (x) { $('ufMsg').textContent = x.message; });
    }
  });
  $('setupBack').onclick = function () { try { history.replaceState(null, '', location.pathname + location.search); } catch (x) {} window.RentalsHome.home(); window.scrollTo(0, 0); };
  window.RentalsSetup = { open: open };
  if (location.hash === '#setup' && S.get()) open();
})();
