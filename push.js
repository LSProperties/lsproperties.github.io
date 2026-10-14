/* Push notifications spike (home screen > "Notifications test"). Turns notifications on for this phone and shows the
   subscription to copy, so a test push can be sent from the PC (rentals-app/push-spike/send.js). On iPhone this only
   works in the app added to the Home Screen (iOS 16.4 or later), and permission must be asked from a tap. */
(function () {
  var VAPID_PUBLIC = 'BK4VNPpko8P2DDzUAzkPHEkn-A8wpwII9O3MPVCxb_bTn5SXdJIYWeStdRaygzO3KJ6H8SIO30AObe2qr6iXlwg';
  var box = document.getElementById('pushBox'); if (!box) return;
  var out = document.getElementById('pushState'), subOut = document.getElementById('pushSub');
  function key(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); s += '===='.slice(s.length % 4 || 4); var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var can = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  function line(t) { out.textContent = t; }
  function showSub(s) {
    subOut.value = s ? JSON.stringify(s) : ''; subOut.hidden = !s;
    document.getElementById('pushCopy').hidden = !s; document.getElementById('pushOff').hidden = !s; document.getElementById('pushLocal').hidden = !s;
  }
  function refresh() {
    if (!can) { line('This browser can’t do push notifications' + (/iPhone|iPad/.test(navigator.userAgent) && !standalone ? ' here. Open Rentals from its Home Screen icon (iOS 16.4 or later).' : '.')); return; }
    navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (s) {
      line('Permission: ' + Notification.permission + ' · ' + (standalone ? 'Home Screen app' : 'browser tab') + ' · ' + (s ? 'subscribed (' + new URL(s.endpoint).host + ')' : 'not subscribed'));
      showSub(s);
    });
  }
  document.getElementById('pushOn').addEventListener('click', function () {
    if (!can) return refresh();
    line('Asking…');
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { line('Permission: ' + p + '. Allow notifications for Rentals in Settings › Notifications.'); return; }
      return navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key(VAPID_PUBLIC) }); })
        .then(function () { refresh(); });
    }).catch(function (e) { line('Couldn’t turn on: ' + (e && e.message || e)); });
  });
  document.getElementById('pushCopy').addEventListener('click', function () {
    var t = subOut.value; subOut.select();
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { line('Copied. Paste it to Claude.'); }, function () { line('Select the text below and copy it.'); });
  });
  document.getElementById('pushLocal').addEventListener('click', function () {
    navigator.serviceWorker.ready.then(function (reg) { return reg.showNotification('Rentals test', { body: 'Shown by this phone (no push). Notifications display fine.', icon: 'icon-192.png' }); })
      .catch(function (e) { line('Couldn’t show: ' + (e && e.message || e)); });
  });
  document.getElementById('pushOff').addEventListener('click', function () {
    navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (s) { return s && s.unsubscribe(); }).then(refresh);
  });
  box.addEventListener('toggle', function () { if (box.open) refresh(); });
})();
