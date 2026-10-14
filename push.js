/* Notifications (home screen > Notifications): turn them on for this phone or computer, and choose what to be told
   about. Sent by the Rentals API (Push.gs). On iPhone they work only in the app opened from the Home Screen icon
   (iOS 16.4 or later), and permission has to be asked from a tap. */
(function () {
  var box = document.getElementById('pushBox'); if (!box) return;
  var call = window.rentalsCall, $ = function (id) { return document.getElementById(id); };
  var CATS = [['applications', 'An application form is submitted', 'forms you sent'],
              ['signing', 'Someone signs an agreement', 'agreements you sent, with who is left to sign'],
              ['toSign', 'An agreement is ready for me to sign', ''],
              ['inspections', 'An inspection is submitted', 'by someone else']];
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var can = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var info = null, loaded = false;
  function key(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function same(a, b) { if (!a || !b || a.byteLength !== b.byteLength) return false; a = new Uint8Array(a); for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  function msg(t, bad) { var m = $('pushMsg'); m.textContent = t || ''; m.style.color = bad ? '#b42318' : ''; }
  function sub() { return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }); }

  function draw() {
    var on = info && info.thisDevice;
    $('pushState').textContent = !can ? 'This browser can’t show notifications' + (/iPhone|iPad/.test(navigator.userAgent) && !standalone ? '. Open Rentals from its Home Screen icon (iOS 16.4 or later).' : '.')
      : Notification.permission === 'denied' ? 'Notifications are blocked for Rentals. Allow them in Settings › Notifications › Rentals.'
      : on ? 'On for this ' + (/iPhone/.test(navigator.userAgent) ? 'iPhone' : 'device') + '.' : 'Off for this device.';
    $('pushOn').hidden = !can || on || Notification.permission === 'denied';
    $('pushOff').hidden = !on; $('pushTest').hidden = !on;
    $('pushPrefs').innerHTML = info ? CATS.map(function (c) {
      return '<label class="chk"><input type="checkbox" data-cat="' + c[0] + '"' + (info.prefs[c[0]] ? ' checked' : '') + '> <span>' + c[1] +
        (c[2] ? '<br><span class="small">' + c[2] + '</span>' : '') + '</span></label>';
    }).join('') : '';
  }
  function load() {
    loaded = true;
    (can ? sub() : Promise.resolve(null)).then(function (s) { return call('auth', 'pushInfo', [], { endpoint: s ? s.endpoint : '' }); })
      .then(function (r) { info = r; draw(); }, function (e) { msg(e.message, true); });
  }
  box.addEventListener('toggle', function () { if (box.open && !loaded) load(); });

  $('pushOn').addEventListener('click', function () {
    var b = this; b.disabled = true; msg('Turning on…');
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') throw new Error(p === 'denied' ? 'Notifications are blocked. Allow them in Settings › Notifications › Rentals.' : 'Notifications weren’t allowed.');
      return navigator.serviceWorker.ready;
    }).then(function (reg) {
      var want = key(info.publicKey);
      return reg.pushManager.getSubscription().then(function (old) {
        // an earlier subscription made with another key (the test) has to go first
        if (old && !same(old.options && old.options.applicationServerKey, want)) return old.unsubscribe().then(function () { return null; });
        return old;
      }).then(function (old) { return old || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: want }); });
    }).then(function (s) { return call('auth', 'pushSubscribe', [], { sub: s.toJSON() }); })
      .then(function (r) { info = r; info.thisDevice = true; draw(); msg('Notifications are on.'); }, function (e) { msg(e.message, true); })
      .then(function () { b.disabled = false; });
  });
  $('pushOff').addEventListener('click', function () {
    var b = this; b.disabled = true;
    sub().then(function (s) { var ep = s ? s.endpoint : ''; return (s ? s.unsubscribe() : Promise.resolve()).then(function () { return call('auth', 'pushUnsubscribe', [], { endpoint: ep }); }); })
      .then(function (r) { info = r; info.thisDevice = false; draw(); msg('Notifications are off for this device.'); }, function (e) { msg(e.message, true); })
      .then(function () { b.disabled = false; });
  });
  $('pushTest').addEventListener('click', function () {
    var b = this; b.disabled = true; msg('Sending…');
    call('auth', 'pushTest').then(function (r) { msg(r.sent ? 'Sent. It should appear in a few seconds.' : 'It didn’t go through. Turn notifications off and on again.', !r.sent); }, function (e) { msg(e.message, true); })
      .then(function () { b.disabled = false; });
  });
  $('pushPrefs').addEventListener('change', function (e) {
    var c = e.target.getAttribute('data-cat'); if (!c) return;
    var p = {}; p[c] = e.target.checked; info.prefs[c] = e.target.checked;
    call('auth', 'pushPrefs', [], { prefs: p }).then(function () { msg('Saved.'); }, function (x) { e.target.checked = !e.target.checked; info.prefs[c] = e.target.checked; msg(x.message, true); });
  });
})();
