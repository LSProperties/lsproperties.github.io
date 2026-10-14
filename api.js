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
            if (r && (name === 'getVersion' || name === 'tmGetVersion')) { r.url = location.origin + location.pathname; r.pageVersion = r.version; }
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

  /* Offline start and updates */
  if ('serviceWorker' in navigator) navigator.serviceWorker.register((APP ? '../' : './') + 'sw.js').catch(function () {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
})();
