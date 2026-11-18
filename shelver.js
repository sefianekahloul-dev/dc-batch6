(function () {
  if (window.__sh && window.__sh.running) return;
  var sh = window.__sh = { running: true, stop: false, msg: 'init', log: [] };
  var K = 'dc6shelved';
  function say(m) { sh.msg = m; sh.log.push(new Date().toISOString().slice(11, 19) + ' ' + m); if (sh.log.length > 80) sh.log.shift(); }
  function sleep(ms) { return new Promise(function (r) { var w = new Worker(URL.createObjectURL(new Blob(['setTimeout(function(){postMessage(1)},' + ms + ')']))); w.onmessage = function () { w.terminate(); r(); }; }); }
  async function waitFor(fn, ms) { var t = 0; while (t < ms) { try { if (fn()) return true; } catch (e) {} await sleep(500); t += 500; } return false; }
  async function shelve(id, titles) {
    var f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:-9999px;top:0;width:1200px;height:900px';
    f.src = '/collection/edit/' + id; document.body.appendChild(f);
    try {
      var ok = await waitFor(function () { return f.contentDocument && f.contentWindow.location.pathname === '/collection/edit/' + id && f.contentDocument.querySelectorAll('.js-product-checkbox').length > 50; }, 120000);
      if (!ok) return { ok: false, why: 'load' };
      var d = f.contentDocument, want = {}, i, hit = 0, already = 0;
      titles.forEach(function (t) { want[t] = 1; });
      var rows = d.querySelectorAll('.js-product-row'), seen = {};
      for (i = 0; i < rows.length; i++) {
        var lab = (rows[i].innerText || '').trim();
        if (want[lab]) { seen[lab] = 1; hit++; var cb = rows[i].querySelector('.js-product-checkbox'); if (cb.checked) already++; else cb.click(); }
      }
      var missing = titles.filter(function (t) { return !seen[t]; }).length;
      if (hit - already === 0) return { ok: true, hit: hit, already: already, missing: missing, saved: false };
      var btn = [].slice.call(d.querySelectorAll('button,input[type=submit]')).filter(function (b) { return /save changes/i.test(b.innerText || b.value || ''); })[0];
      if (!btn) return { ok: false, why: 'nosave' };
      btn.click();
      await waitFor(function () { return f.contentWindow.location.pathname !== '/collection/edit/' + id; }, 40000);
      await sleep(3000);
      f.src = '/collection/edit/' + id + '?v=' + Date.now();
      await sleep(4000);
      var ok2 = await waitFor(function () { return f.contentDocument && f.contentWindow.location.pathname === '/collection/edit/' + id && f.contentDocument.querySelectorAll('.js-product-checkbox').length > 50; }, 120000);
      if (!ok2) return { ok: false, why: 'verifyload', saved: true };
      var rows2 = f.contentDocument.querySelectorAll('.js-product-row'), on = 0;
      for (i = 0; i < rows2.length; i++) { var l2 = (rows2[i].innerText || '').trim(); if (want[l2] && rows2[i].querySelector('.js-product-checkbox').checked) on++; }
      return { ok: on >= hit, hit: hit, on: on, missing: missing, saved: true, why: on >= hit ? '' : 'notsaved' };
    } catch (e) { return { ok: false, why: String(e).slice(0, 60) }; }
    finally { await sleep(1500); f.remove(); }
  }
  async function cycle() {
    var m = await (await fetch('https://raw.githubusercontent.com/sefianekahloul-dev/dc-batch6/main/manifest.json?v=' + Date.now(), { cache: 'no-store' })).json();
    var items = m.items, S = parseInt(localStorage[K] || '0', 10) || 0;
    var DN = {}; (JSON.parse(localStorage.dc6run || '{}').done || []).forEach(function (k) { DN[k] = 1; });
    var end = S;
    while (end < items.length && end - S < 400 && DN[items[end].key]) end++;
    if (end - S < 30) { say('waiting ' + (end - S) + ' new (from ' + S + ')'); return; }
    var by = {};
    items.slice(S, end).forEach(function (x) { (x.col || []).forEach(function (c) { (by[c] = by[c] || []).push(x.t); }); });
    var all = true, ids = Object.keys(by);
    for (var i = 0; i < ids.length && !sh.stop; i++) {
      say('shelving ' + ids[i] + ' (' + by[ids[i]].length + ')');
      var r = await shelve(ids[i], by[ids[i]]);
      sh.log.push(ids[i] + ' ' + JSON.stringify(r));
      if (!r.ok) all = false;
      await sleep(3000);
    }
    if (all) { localStorage[K] = String(end); say('shelved to ' + end); } else say('retry later from ' + S);
  }
  (async function () {
    while (!sh.stop) { try { await cycle(); } catch (e) { say('err ' + String(e).slice(0, 80)); } await sleep(5 * 60 * 1000); }
    sh.running = false;
  })();
})();
