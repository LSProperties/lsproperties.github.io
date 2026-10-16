/* Notifications, shown in Setup in both apps (Tenancies > Setup > Notifications, Inspections > Setup > Notifications):
   turn them on for this phone or computer, and tick what to be told about, for your own forms and agreements and for
   everyone's. Sent by the Rentals API (Push.gs). On iPhone they only work in the app opened from the Home Screen icon
   (iOS 16.4 or later), and permission has to be asked from a tap. Uses the page's own card and button styles.
   window.RentalsPush.mount(element) draws it; the pages show the Setup card only when this file is loaded. */
(function () {
  var call = window.rentalsCall;
  // [label, note, mine key, everyone's key]: a missing key = no box in that column
  var ROWS = [['An application form is submitted', '', 'applications', 'applicationsAll'],
              ['Someone signs or declines an agreement', 'Says who is still to sign', 'signing', 'signingAll'],
              ['An agreement is ready for me to sign', '', 'toSign', ''],
              ['An inspection is submitted', 'By someone else', '', 'inspections'],
              ['Morning summary at 8 am', 'Bonds and Bond Hub notices due, fixed terms ending, agreements waiting on someone', 'digest', 'digestAll'],
              ['A device signs in to Rentals', 'Mine = my account', 'signIns', 'signInsAll'],
              ['Maintenance is due', 'A week ahead, on the day, and weekly if it’s overdue', '', 'maintenance']];   // Maintenance (API 0.4.0)
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var can = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function key(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function same(a, b) { if (!a || !b || a.byteLength !== b.byteLength) return false; a = new Uint8Array(a); for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  // the app's service worker (registered by api.js); null if it isn't there, so nothing waits for ever
  function reg() { return navigator.serviceWorker.getRegistration('../').then(function (r) { return r || navigator.serviceWorker.getRegistration(); }); }
  function sub() { return reg().then(function (r) { return r ? r.pushManager.getSubscription() : null; }); }
  // this person's settings, kept on this device so the panel opens straight away (the server is only waited for when
  // there's no copy yet: first use, or the phone's storage cleared)
  // One copy per person (by email), so people sharing a phone each see their own. The phone has only one push
  // subscription, so each copy also remembers which subscription is theirs (endpoint): on for them only if it's still here.
  function cacheKey() { var s = window.RentalsSession && window.RentalsSession.get(), e = String((s && s.email) || '').trim().toLowerCase(); return e ? 'rentals-push:' + e : ''; }
  function readCache() { var k = cacheKey(); if (!k) return null; try { var c = JSON.parse(localStorage.getItem(k) || 'null'); return c && c.prefs && c.publicKey ? c : null; } catch (e) { return null; } }
  function writeCache(i) { var k = cacheKey(); if (!k) return; try { localStorage.setItem(k, JSON.stringify({ publicKey: i.publicKey, prefs: i.prefs, thisDevice: !!i.thisDevice, endpoint: i.thisDevice ? i.endpoint || '' : '' })); } catch (e) {} }

  /* opts.only: [keys] shows just those choices, one big tick box each (the Maintenance page: "maintenance") */
  function mount(el, opts) {
    opts = opts || {};
    var info = readCache();
    if (!info) el.innerHTML = '<div class="card"><div class="small muted">Loading…</div></div>';
    function msg(t, bad) { var m = el.querySelector('[data-rp-msg]'); if (m) { m.textContent = t || ''; m.style.color = bad ? 'var(--bad, #b42318)' : ''; } }
    function draw(note, bad) {
      var on = info.thisDevice, blocked = can && Notification.permission === 'denied';
      var state = !can ? 'This browser can’t show notifications' + (/iPhone|iPad/.test(navigator.userAgent) && !standalone ? '. Open Rentals from its Home Screen icon (iOS 16.4 or later).' : '.')
        : blocked ? 'Notifications are blocked for Rentals. Allow them in Settings › Notifications › Rentals, then come back here.'
        : on ? 'On for this ' + (/iPhone/.test(navigator.userAgent) ? 'iPhone' : 'device') + '.' : 'Off for this device.';
      var cell = function (k) {
        return '<td style="text-align:center;padding:10px 4px">' + (k ? '<input type="checkbox" data-rp="' + k + '"' + (info.prefs[k] ? ' checked' : '') +
          ' style="width:22px;height:22px;min-width:0;margin:0;accent-color:var(--brand, #0f766e)" aria-label="' + (/All$|^(inspections|maintenance)$/.test(k) ? 'Everyone’s' : 'Mine') + '">' : '<span class="muted">—</span>') + '</td>';
      };
      var only = opts.only ? ROWS.filter(function (r) { return opts.only.indexOf(r[2]) >= 0 || opts.only.indexOf(r[3]) >= 0; }) : null;
      var choices = only ? '<div class="card"><div class="title">Remind me</div>' + only.map(function (r) {
          var k = opts.only.indexOf(r[3]) >= 0 ? r[3] : r[2];
          return '<label style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;cursor:pointer"><input type="checkbox" data-rp="' + k + '"' + (info.prefs[k] ? ' checked' : '') +
            ' style="width:26px;height:26px;min-width:0;margin:0;flex:none;accent-color:var(--brand, #0f766e)"><span><b>' + esc(r[0]) + '</b>' + (r[1] ? '<div class="small muted">' + esc(r[1]) + '</div>' : '') + '</span></label>';
        }).join('') + '<div class="small muted">Turn notifications on for this device above, too.</div></div>' : null;
      el.innerHTML =
        '<div class="card"><div class="title">This device</div><div class="small muted" style="margin-block:4px 10px">' + esc(state) + '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
          (can && !on && !blocked ? '<button class="btn primary" type="button" data-rp-act="on">Turn on notifications</button>' : '') +
          (on ? '<button class="btn" type="button" data-rp-act="test">Send a test</button><button class="btn" type="button" data-rp-act="off">Turn off</button>' : '') +
          '</div></div>' + (choices ||
        '<div class="card"><div class="title">Tell me when</div>' +
          '<div class="small muted" style="margin-block:4px 6px"><b>Mine</b> = forms, agreements and tenancies you sent. <b>Everyone’s</b> = the ones other people sent too. Applies to all your devices.</div>' +
          '<table style="width:100%;border-collapse:collapse"><thead><tr><th></th><th class="small" style="width:64px;font-weight:700">Mine</th><th class="small" style="width:84px;font-weight:700">Everyone’s</th></tr></thead><tbody>' +
          ROWS.map(function (r) {
            return '<tr style="border-block-start:1px solid var(--line, #e2e8f0)"><td style="padding:10px 4px 10px 0">' + esc(r[0]) + (r[1] ? '<div class="small muted">' + esc(r[1]) + '</div>' : '') + '</td>' + cell(r[2]) + cell(r[3]) + '</tr>';
          }).join('') + '</tbody></table></div>') +
        '<div class="small" data-rp-msg role="status" style="margin:4px 6px 12px"></div>';
      if (note) msg(note, bad);
    }
    function busy(b, p) { if (b) b.disabled = true; return p.then(function (r) { if (b) b.disabled = false; return r; }, function (e) { if (b) b.disabled = false; throw e; }); }

    el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-rp-act]'); if (!b) return;
      var act = b.getAttribute('data-rp-act');
      if (act === 'on') {
        msg('Turning on…');
        busy(b, Notification.requestPermission().then(function (p) {
          if (p !== 'granted') throw new Error(p === 'denied' ? 'Notifications are blocked. Allow them in Settings › Notifications › Rentals.' : 'Notifications weren’t allowed.');
          return reg();
        }).then(function (reg) {
          if (!reg) throw new Error('The app isn’t fully loaded. Close Rentals, open it again and try once more.');
          var want = key(info.publicKey);
          return reg.pushManager.getSubscription().then(function (old) {
            // a subscription made with another key (the earlier test) has to go first
            if (old && !same(old.options && old.options.applicationServerKey, want)) return old.unsubscribe().then(function () { return null; });
            return old;
          }).then(function (old) { return old || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want }); });
        }).then(function (s) { ep = s.endpoint; return call('auth', 'pushSubscribe', [], { sub: s.toJSON() }); }))
          .then(function (r) { info = r; info.thisDevice = true; info.endpoint = ep; writeCache(info); draw('Notifications are on.'); }, function (x) { msg(x.message, true); });
      } else if (act === 'off') {
        busy(b, sub().then(function (s) { var ep = s ? s.endpoint : ''; return (s ? s.unsubscribe() : Promise.resolve()).then(function () { return call('auth', 'pushUnsubscribe', [], { endpoint: ep }); }); }))
          .then(function (r) { info = r; info.thisDevice = false; info.endpoint = ''; writeCache(info); draw('Notifications are off for this device.'); }, function (x) { msg(x.message, true); });
      } else if (act === 'test') {
        msg('Sending…');
        busy(b, call('auth', 'pushTest')).then(function (r) { msg(r.sent ? 'Sent. It should appear in a few seconds.' : 'It didn’t go through. Turn notifications off and on again.', !r.sent); }, function (x) { msg(x.message, true); });
      }
    });
    el.addEventListener('change', function (e) {
      var k = e.target.getAttribute && e.target.getAttribute('data-rp'); if (!k) return;
      var v = e.target.checked, p = {}; p[k] = v; info.prefs[k] = v; writeCache(info);
      call('auth', 'pushPrefs', [], { prefs: p }).then(function () { msg('Saved.'); }, function (x) { e.target.checked = !v; info.prefs[k] = !v; writeCache(info); msg(x.message, true); });
    });
    var local = can ? sub() : Promise.resolve(null);
    if (info) {
      draw();   // straight from this device
      // on only if this person's own subscription is still on this device (no network needed)
      local.then(function (s) { var on = !!(s && info.endpoint && s.endpoint === info.endpoint); if (on !== !!info.thisDevice) { info.thisDevice = on; writeCache(info); draw(); } }, function () {});
    }
    // then quietly bring it up to date (changes made on another of your devices); only drawn again if something differs
    var ep = '';
    local.then(function (s) { ep = s ? s.endpoint : ''; return call('auth', 'pushInfo', [], { endpoint: ep }); })
      .then(function (r) {
        var was = info ? JSON.stringify([info.prefs, !!info.thisDevice, info.publicKey]) : '';
        info = r; info.endpoint = ep; writeCache(info);
        if (JSON.stringify([info.prefs, !!info.thisDevice, info.publicKey]) !== was) draw();
      }, function (x) { if (!info) el.innerHTML = '<div class="card"><div class="small" style="color:var(--bad, #b42318)">' + esc(x.message) + '</div></div>'; });
  }
  window.RentalsPush = { mount: mount };
})();
