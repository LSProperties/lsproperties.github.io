/* Rentals app: the connection to the Rentals API, shared by every page.
 *
 * The Inspections and Tenancies pages were written for Google's own app frame and call the server through
 * google.script.run. This file provides that same object, so the pages run unchanged: each call becomes a POST to the
 * Rentals API with this phone's sign-in session. It also:
 *   - sends a page with no sign-in to the sign-in page (only on opening, never mid-task)
 *   - shows a "signed out" banner if a sign-in ends while the page is open, without leaving the page
 *   - points the pages' "new version" link at this page rather than at Google
 *   - replaces the two inline handlers the pages used (blocked by this site's security policy) */
(function () {
  var CFG = window.RENTALS_CONFIG || {};
  var APP = document.documentElement.getAttribute('data-app') || '';
  var KEY = 'rentals-session';

  var Session = window.RentalsSession = {
    get: function () { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } },
    set: function (s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} },
    clear: function () { try { localStorage.removeItem(KEY); } catch (e) {} },
    device: function () {
      var ua = navigator.userAgent || '';
      var dev = /iPhone/.test(ua) ? 'iPhone' : /iPad|Macintosh.*Mobile/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad'
        : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet') : /Windows/.test(ua) ? 'Windows PC' : /Macintosh/.test(ua) ? 'Mac' : 'Device';
      var br = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /FxiOS|Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'browser';
      var standalone = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
      return dev + ' ' + br + (standalone ? ' (app)' : '');
    }
  };

  /** One call to the API: resolves with the result, rejects with an Error whose .code is BAD/AUTH/FORBIDDEN/LOCKED/ERROR/NETWORK. */
  var leaving = false;
  var call = window.rentalsCall = function (app, fn, args, extra) {
    if (leaving) return new Promise(function () {});   // on the way to the sign-in page: nothing to do here
    var s = Session.get(), body = { app: app, fn: fn, args: args || [], session: s ? s.session : '', device: Session.device(), v: CFG.version || '' };
    if (extra) for (var k in extra) body[k] = extra[k];
    return fetch(CFG.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow', cache: 'no-store' })
      .then(function (r) { return r.text(); }, function () { var e = new Error(navigator.onLine ? 'Could not reach the server. Check your connection and try again.' : 'You are offline.'); e.code = 'NETWORK'; throw e; })
      .then(function (t) {
        var j; try { j = JSON.parse(t); } catch (x) { var e = new Error('The server is not available right now. Please try again shortly.'); e.code = 'ERROR'; throw e; }
        if (j.ok) return j.result;
        var err = new Error(j.error || 'Error'); err.code = j.code || 'ERROR';
        if (err.code === 'AUTH' && app !== 'auth') signedOut();
        throw err;
      });
  };

  /* google.script.run, as the pages expect it: run.withSuccessHandler(f).withFailureHandler(g).anyServerFunction(args...) */
  function runner(ok, fail) {
    var base = {
      withSuccessHandler: function (f) { return runner(f, fail); },
      withFailureHandler: function (f) { return runner(ok, f); },
      withUserObject: function () { return runner(ok, fail); }
    };
    return new Proxy(base, {
      get: function (t, name) {
        if (name in t) return t[name];
        if (typeof name !== 'string') return undefined;
        return function () {
          var args = [].slice.call(arguments);
          call(APP, name, args).then(function (r) {
            if (r && (name === 'getVersion' || name === 'tmGetVersion')) {
              // "Is there a newer version?" means a newer page published on GitHub, not a newer server: the server is
              // updated a minute or two before the pages, and offering an update in that gap reloads the same page.
              r.url = location.origin + location.pathname;
              return fetch('../version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (x) { return x.json(); }).then(function (v) {
                if (v && v[APP]) { r.version = v[APP]; r.pageVersion = v[APP]; }
                if (ok) ok(r);
              }, function () { r.pageVersion = r.version; if (ok) ok(r); });
            }
            if (ok) ok(r);
          }, function (e) { if (fail) fail(e); });
        };
      }
    });
  }
  if (APP) {
    window.google = window.google || {};
    window.google.script = { run: runner(null, null), host: { close: function () {}, setHeight: function () {}, setWidth: function () {} } };
  }

  /* No sign-in on this phone: go to the sign-in page first (on opening only) */
  if (APP && !Session.get()) { leaving = true; location.replace('../?next=' + APP); }

  /* A sign-in that ends while a page is open: say so, keep the page (and anything typed) where it is */
  var shown = false;
  function signedOut() {
    if (shown || !APP) return; shown = true;
    var b = document.createElement('div');
    b.setAttribute('role', 'alert');
    b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:99999;background:#7f1d1d;color:#fff;' +
      'border-radius:12px;padding:12px 14px;font:15px/1.4 system-ui,-apple-system,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3)';
    b.innerHTML = '<b>You have been signed out.</b> Your work on this phone is kept. <a href="../?next=' + APP + '" style="color:#fff;text-decoration:underline;font-weight:700">Sign in again</a>';
    document.body.appendChild(b);
  }

  /* A Home button in the page header, back to the Rentals home (devices, sign out, the other section). The pages' own
     leave warnings still apply, so nothing unsaved is lost by tapping it. */
  if (APP) {
    // the Lifestyle Investments mark (the app icon) on a white tile, just left of the page title
    var bar = document.querySelector('header.bar'), title = document.getElementById('title');
    if (bar) {
      var home = document.createElement('a');
      home.href = '../'; home.setAttribute('aria-label', 'Rentals home'); home.title = 'Rentals home';
      home.style.cssText = 'position:relative;flex:none;display:block;width:36px;height:36px;border-radius:10px;overflow:hidden;' +
        'background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.18);line-height:0';
      var logo = document.createElement('img');
      logo.src = '../icon-180.png'; logo.alt = ''; logo.width = 36; logo.height = 36;
      logo.style.cssText = 'display:block;width:36px;height:36px';
      home.appendChild(logo);
      if (title && title.parentNode === bar) bar.insertBefore(home, title); else bar.insertBefore(home, bar.firstChild);
    }
  }

  /* Replacements for the pages' two inline handlers */
  document.addEventListener('error', function (e) {
    var img = e.target;
    if (img && img.tagName === 'IMG' && img.hasAttribute('data-fallback') && !img.hasAttribute('data-fell-back')) {
      img.setAttribute('data-fell-back', '1'); var v = window[img.getAttribute('data-fallback')]; if (v) img.src = v;
    }
  }, true);
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('[data-noop]'); if (a) e.preventDefault(); }, true);

  /* Install on a computer (Chrome / Edge on Windows, Mac or Android): when the browser says the app can be installed,
     offer it once in a while. Installed, it opens in its own window with a taskbar / Start menu icon. iPhones never
     offer this (they use Share > Add to Home Screen), and an installed app never shows it. */
  var installEvt = null, SNOOZE = 'rentals-install-snooze';
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); installEvt = e;
    var until = 0; try { until = +localStorage.getItem(SNOOZE) || 0; } catch (x) {}
    if (Date.now() < until) return;
    var b = document.getElementById('installBar');
    if (b) return;
    b = document.createElement('div'); b.id = 'installBar'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Install Rentals');
    b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom));z-index:99998;width:min(560px,calc(100% - 24px));' +
      'display:flex;gap:12px;align-items:center;background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.18);font:15px/1.4 system-ui,-apple-system,Segoe UI,sans-serif';
    b.innerHTML = '<img src="' + (APP ? '../' : '') + 'icon-180.png" alt="" width="40" height="40" style="border-radius:9px;flex:none">' +
      '<div style="flex:1"><b>Install Rentals on this computer</b><br><span style="color:#475569;font-size:.88rem">Opens in its own window, with an icon on the taskbar and Start menu.</span></div>' +
      '<button type="button" data-inst="no" style="font:inherit;padding:8px 12px;border-radius:10px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;cursor:pointer">Not now</button>' +
      '<button type="button" data-inst="yes" style="font:inherit;padding:8px 14px;border-radius:10px;border:1px solid #0f766e;background:#0f766e;color:#fff;cursor:pointer;font-weight:600">Install</button>';
    b.addEventListener('click', function (ev) {
      var t = ev.target.closest('[data-inst]'); if (!t) return;
      if (t.getAttribute('data-inst') === 'yes' && installEvt) {
        installEvt.prompt();
        installEvt.userChoice.then(function (c) { if (c && c.outcome !== 'accepted') { try { localStorage.setItem(SNOOZE, String(Date.now() + 7 * 864e5)); } catch (x) {} } }).catch(function () {});
        installEvt = null;
      } else { try { localStorage.setItem(SNOOZE, String(Date.now() + 30 * 864e5)); } catch (x) {} }
      b.remove();
    });
    document.body.appendChild(b);
  });
  /* iPhone / iPad: Safari can't offer the install itself, so show how, as an iOS-style sheet (Share > Add to Home
     Screen). Only in the browser, never in the installed app. Matters more here: only the installed app keeps
     inspections and photos safely. */
  (function () {
    var ua = navigator.userAgent || '', ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var installed = !!(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
    if (!ios || installed) return;
    var until = 0; try { until = +localStorage.getItem(SNOOZE) || 0; } catch (x) {}
    if (Date.now() < until) return;
    var CSS =
      '#iosSheetWrap{position:fixed;inset:0;z-index:99998;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0);transition:background .3s}' +
      '#iosSheetWrap.on{background:rgba(0,0,0,.25)}' +
      '#iosSheet{--bg:rgba(242,242,247,.86);--card:rgba(255,255,255,.92);--label:#000;--sub:rgba(60,60,67,.62);--sep:rgba(60,60,67,.18);--fill:rgba(120,120,128,.16);' +
      'width:min(100%,520px);margin:0 8px calc(8px + env(safe-area-inset-bottom));border-radius:22px;padding:8px 16px 16px;color:var(--label);background:var(--bg);' +
      '-webkit-backdrop-filter:blur(24px) saturate(180%);backdrop-filter:blur(24px) saturate(180%);box-shadow:0 12px 40px rgba(0,0,0,.25);' +
      'font:17px/1.35 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;letter-spacing:-.01em;transform:translateY(110%);transition:transform .38s cubic-bezier(.2,.9,.25,1)}' +
      '#iosSheetWrap.on #iosSheet{transform:none}' +
      '@media (prefers-color-scheme:dark){#iosSheet{--bg:rgba(28,28,30,.86);--card:rgba(44,44,46,.9);--label:#fff;--sub:rgba(235,235,245,.6);--sep:rgba(84,84,88,.6);--fill:rgba(118,118,128,.24)}}' +
      '#iosSheet .grab{width:36px;height:5px;border-radius:3px;background:var(--fill);margin:0 auto 10px}' +
      '#iosSheet .head{display:flex;gap:12px;align-items:center;margin-bottom:14px}' +
      '#iosSheet .head img{width:52px;height:52px;border-radius:12px;box-shadow:0 0 0 .5px var(--sep)}' +
      '#iosSheet .name{font-weight:600;font-size:17px}#iosSheet .site{font-size:13px;color:var(--sub)}' +
      '#iosSheet .x{margin-left:auto;align-self:flex-start;width:30px;height:30px;border-radius:50%;border:0;background:var(--fill);color:var(--sub);font:600 15px/30px -apple-system,system-ui;padding:0;cursor:pointer}' +
      '#iosSheet h2{font-size:20px;font-weight:700;margin:0 0 4px;letter-spacing:-.02em}#iosSheet .lead{font-size:15px;color:var(--sub);margin:0 0 14px}' +
      '#iosSheet ol{list-style:none;margin:0 0 12px;padding:0;background:var(--card);border-radius:12px;overflow:hidden}' +
      '#iosSheet li{display:flex;gap:12px;align-items:center;padding:11px 14px;font-size:16px;position:relative}' +
      '#iosSheet li+li:before{content:"";position:absolute;top:0;left:58px;right:0;height:.5px;background:var(--sep)}' +
      '#iosSheet .ic{flex:none;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:var(--fill)}' +
      '#iosSheet .n{color:var(--sub);font-size:13px;margin-right:2px}' +
      '#iosSheet .later{display:block;width:100%;border:0;background:none;color:#0a84ff;font:17px -apple-system,system-ui;padding:8px;cursor:pointer}';
    var SHARE = '<svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true"><path d="M9 1.5v12M4.8 5.7 9 1.5l4.2 4.2" fill="none" stroke="#0a84ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M6 9H3.6A1.6 1.6 0 0 0 2 10.6v7.8A1.6 1.6 0 0 0 3.6 20h10.8a1.6 1.6 0 0 0 1.6-1.6v-7.8A1.6 1.6 0 0 0 14.4 9H12" fill="none" stroke="#0a84ff" stroke-width="2" stroke-linecap="round"/></svg>';
    var PLUS = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect x="1.5" y="1.5" width="17" height="17" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/>' +
      '<path d="M10 6v8M6 10h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    function show() {
      if (document.getElementById('iosSheetWrap') || document.getElementById('installBar')) return;
      var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
      var icon = (APP ? '../' : '') + 'icon-180.png';
      var w = document.createElement('div'); w.id = 'iosSheetWrap';
      w.innerHTML = '<div id="iosSheet" role="dialog" aria-modal="true" aria-labelledby="iosSheetTitle"><div class="grab"></div>' +
        '<div class="head"><img src="' + icon + '" alt=""><div><div class="name">Rentals</div><div class="site">' + location.host + '</div></div>' +
        '<button type="button" class="x" data-sheet="close" aria-label="Close">✕</button></div>' +
        '<h2 id="iosSheetTitle">Add to Home Screen</h2>' +
        '<p class="lead">Use Rentals from its own icon. Only the installed app keeps your inspections and photos safely on this phone.</p>' +
        '<ol><li><span class="ic">' + SHARE + '</span><span><span class="n">1</span> Tap <b>Share</b> in Safari&#8217;s toolbar <span style="color:var(--sub)">(or <b>•••</b> first)</span></span></li>' +
        '<li><span class="ic" style="color:var(--label)">' + PLUS + '</span><span><span class="n">2</span> Choose <b>Add to Home Screen</b></span></li>' +
        '<li><span class="ic" style="background:none"><img src="' + icon + '" alt="" width="32" height="32" style="border-radius:8px"></span><span><span class="n">3</span> Open <b>Rentals</b> from your Home Screen</span></li></ol>' +
        '<button type="button" class="later" data-sheet="later">Not now</button></div>';
      function close() {
        try { localStorage.setItem(SNOOZE, String(Date.now() + 30 * 864e5)); } catch (x) {}
        w.classList.remove('on'); setTimeout(function () { w.remove(); }, 400);
      }
      w.addEventListener('click', function (ev) { if (ev.target === w || ev.target.closest('[data-sheet]')) close(); });
      document.body.appendChild(w);
      requestAnimationFrame(function () { requestAnimationFrame(function () { w.classList.add('on'); }); });
    }
    if (document.body) setTimeout(show, 600); else document.addEventListener('DOMContentLoaded', function () { setTimeout(show, 600); });
  })();
  window.addEventListener('appinstalled', function () { var b = document.getElementById('installBar'); if (b) b.remove(); installEvt = null; });

  /* Offline start and updates */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register((APP ? '../' : './') + 'sw.js').catch(function () {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
})();
