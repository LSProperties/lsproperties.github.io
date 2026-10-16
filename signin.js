/* Rentals app home: sign in (Google, or an emailed code), then open Inspections or Tenancies. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var CFG = window.RENTALS_CONFIG, S = window.RentalsSession, call = window.rentalsCall;
  var next = (location.search.match(/[?&]next=(fi|tm)\b/) || [])[1] || '';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function show(id) { ['loading', 'signin', 'home'].forEach(function (x) { $(x).hidden = x !== id; }); }
  function msg(t, bad) { $('signMsg').textContent = t || ''; $('signMsg').className = 'msg' + (bad ? ' bad' : ''); }
  $('ver').textContent = 'Version ' + CFG.version;

  function signedIn(r) {
    S.set({ session: r.session, sid: r.sid, email: r.email, name: r.name, role: r.role });
    if (next) { location.replace(next + '/'); return; }
    home();
  }
  function home() {
    var s = S.get();
    $('who').textContent = s ? (s.name ? s.name + ' · ' : '') + s.email + (s.role === 'viewer' ? ' · View only' : '') : '';
    show('home');
  }

  /* Google sign-in */
  var tries = 0;
  function google() {
    if (!(window.google && window.google.accounts && window.google.accounts.id)) {
      if (tries++ < 50) return setTimeout(google, 200);
      $('gNote').textContent = navigator.onLine ? 'Google sign-in did not load. Use an emailed code instead.' : 'You are offline. Signing in needs signal.';
      $('codeBox').open = true; return;
    }
    window.google.accounts.id.initialize({ client_id: CFG.clientId, auto_select: false, callback: function (r) {
      msg('Signing in…');
      call('auth', 'signInGoogle', [], { idToken: r.credential }).then(signedIn, function (e) { msg(e.message, true); });
    } });
    window.google.accounts.id.renderButton($('gbtn'), { theme: 'outline', size: 'large', text: 'signin_with', width: 280 });
  }

  /* Emailed code */
  $('sendCode').onclick = function () {
    var em = $('email').value.trim(); if (!em) return msg('Enter your email first.', true);
    msg('Sending…');
    call('auth', 'requestCode', [], { email: em }).then(function () {
      $('codeRow').hidden = false; $('code').focus();
      msg('If that email can use the app, a 6-digit code is on its way. It lasts 10 minutes.');
    }, function (e) { msg(e.message, true); });
  };
  $('useCode').onclick = function () {
    msg('Checking…');
    call('auth', 'verifyCode', [], { email: $('email').value.trim(), code: $('code').value.trim() }).then(signedIn, function (e) { msg(e.message, true); });
  };
  $('code').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('useCode').click(); });

  /* Devices and sign out */
  $('devBox').addEventListener('toggle', function () {
    if (!$('devBox').open) return;
    $('devices').textContent = 'Loading…';
    call('auth', 'devices').then(function (list) {
      $('devices').innerHTML = list.map(function (d) {
        return '<div class="dev"><span><b>' + esc(d.device) + '</b>' + (d.current ? ' (this one)' : '') + '<br>Signed in ' + esc(new Date(d.created).toLocaleDateString('en-NZ')) +
          ' with ' + esc(d.how) + ', last used ' + esc(new Date(d.lastUsed).toLocaleDateString('en-NZ')) + '</span>' +
          (d.current ? '' : '<button type="button" class="quiet" data-sid="' + esc(d.sid) + '">Sign out</button>') + '</div>';
      }).join('') || 'None.';
    }, function (e) { $('devices').textContent = e.message; });
  });
  $('devices').addEventListener('click', function (e) {
    var b = e.target.closest('[data-sid]'); if (!b) return;
    b.disabled = true;
    call('auth', 'revokeDevice', [], { sid: b.getAttribute('data-sid') }).then(function () { b.closest('.dev').remove(); }, function (x) { b.disabled = false; alert(x.message); });
  });
  $('signout').onclick = function () {
    if (!confirm('Sign out of the Rentals app on this phone? Anything not yet saved online stays on the phone, but you will need to sign in again to send it.')) return;
    call('auth', 'signOut').catch(function () {}).then(function () {
      // the saved copies of applicant and property lists go too; unsent inspection work (drafts, photos) stays
      S.clear();
      ['tm-cache', 'fi-props-cache', 'fi-recent-cache', 'fi-inprogress-cache'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      location.replace('./');
    });
  };

  /* Start: signed in already? (works offline too: the session is checked when there is signal) */
  if (S.get()) {
    if (next) { location.replace(next + '/'); return; }
    home();
    call('auth', 'whoami').then(function (u) { var s = S.get(); s.name = u.name; s.role = u.role; S.set(s); home(); },
      function (e) { if (e.code === 'AUTH') { S.clear(); show('signin'); msg('Please sign in again.'); google(); } });
  } else { show('signin'); google(); }
})();
