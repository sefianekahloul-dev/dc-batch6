// Slow in-page uploader for Payhip. Run once in a payhip.com tab; it keeps going without page navigation.
(function () {
  if (window.__dcs && window.__dcs.running) return 'already running';
  var HB = 'dc6beat'; if (Date.now() - Number(localStorage.getItem(HB) || 0) < 60000) return 'another runner is active';
  setInterval(function () { localStorage.setItem(HB, String(Date.now())); }, 10000); localStorage.setItem(HB, String(Date.now()));
  var RAW = 'https://raw.githubusercontent.com/sefianekahloul-dev/dc-batch6/main/';
  var K = 'dc6run', CAP = 200, GAP = [45, 120], EVERY = [18, 30], BRK = [6, 14];
  var st = window.__dcs = { running: true, stop: false, msg: 'init', ok: 0 };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var load = function () { return JSON.parse(localStorage.getItem(K) || '{"done":[],"day":"","n":0,"left":20}'); };
  var save = function (s) { localStorage.setItem(K, JSON.stringify(s)); };
  var rid = function () { return 'o_1k7b' + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 5); };
  var warn = /captcha|unusual activity|too many (requests|attempts)|temporarily|suspend|violat|verify you are human|rate limit|blocked/i;

  async function s3(url, fields, file) {
    var fd = new FormData();
    fields.forEach(function (p) { fd.append(p[0], p[1]); });
    fd.append('file', file);
    var r = await fetch(url, { method: 'POST', body: fd });
    if (r.status !== 201) throw new Error('s3 ' + r.status);
  }
  async function addOne(it) {
    var html = await (await fetch('/product/add/digital', { credentials: 'include' })).text();
    if (warn.test(html.slice(0, 6000)) && !/Add Digital Product/.test(html)) throw new Error('warning page');
    var d = new DOMParser().parseFromString(html, 'text/html');
    var meta = function (n) { var m = d.querySelector('meta[property="' + n + '"]'); return m ? m.getAttribute('value') : ''; };
    var base = meta('aws-s3-url'), ak = meta('aws-access-key');
    if (!base || !ak) throw new Error('no upload config');
    var form = d.querySelector('input[name=p_name]').form;
    var fd = new FormData(form);
    var zb = await (await fetch(it.zu)).blob(), cb = await (await fetch(it.cu)).blob();
    var zid = rid(), cid = rid(), zn = it.zu.split('/').pop(), cn = it.cu.split('/').pop();
    await s3(base, [['name', zn], ['key', 'compressed/' + zid + '.zip'], ['Filename', zid + '.zip'], ['acl', 'private'], ['Content-Type[]', 'application/zip'], ['success_action_status', '201'], ['AWSAccessKeyId', ak], ['policy', meta('digital-file-uploader-s3-policy')], ['signature', meta('digital-file-uploader-s3-signature')]], new File([zb], zn, { type: 'application/zip' }));
    await s3(base, [['name', cn], ['key', cid + '.jpg'], ['Filename', cid + '.jpg'], ['acl', 'public-read'], ['Content-Type[]', 'image/jpeg'], ['success_action_status', '201'], ['AWSAccessKeyId', ak], ['policy', meta('cover-image-uploader-s3-policy')], ['signature', meta('cover-image-uploader-s3-signature')]], new File([cb], cn, { type: 'image/jpeg' }));
    var bm = await createImageBitmap(cb);
    var set = function (k, v) { fd.delete(k); fd.append(k, v); };
    set('p_name', it.t); set('p_price', it.p); set('p_desc', it.h);
    set('ebookfiles', JSON.stringify([{ file: base + 'compressed%2F' + zid + '.zip', file_orig: zn, type: 'application/zip', size: zb.size, payhip_type: 'ebook', status: 'add', id: zid, file_orig_custom: zn }]));
    set('coverfile', JSON.stringify([{ thumb: base + cid + '.jpg', name: cn, type: 'image', image_type: 'image/jpeg', size: cb.size, status: 'add', id: cid, height: bm.height, width: bm.width, order: 1 }]));
    set('previewfile', '[]'); set('allVariantsData', '[]'); set('variantsAdvancedOptions', '{"displayType":"radio","label":""}');
    set('safeToProcessVariants', '1'); set('productAdvancedContentEditorData', '{}'); set('enabledProductAdvancedContentEditor', '0');
    set('filesReferenceDataProductAdvancedContentEditor', '{}'); set('shouldSaveProductAdvancedContentEditorChangesOnServerSide', '0'); set('shouldUpdateLastEditedDateAdvancedContentEditor', '{}');
    fd.delete('associated_collections[]'); (it.col || []).forEach(function (c) { fd.append('associated_collections[]', c); });
    var body = new URLSearchParams(); fd.forEach(function (v, k) { body.append(k, v); });
    var r = await fetch('/product/addit', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body });
    var t = await r.text();
    if (/was added successfully/i.test(t)) return true;
    if (warn.test(t)) throw new Error('warning after submit');
    throw new Error('not confirmed ' + r.status + ' ' + t.replace(/\s+/g, ' ').slice(0, 200));
  }
  (async function loop() {
    try {
      while (!st.stop) {
        var S = load(), today = new Date().toDateString();
        if (S.day !== today) { S.day = today; S.n = 0; save(S); }
        if (S.n >= CAP) { st.msg = 'daily cap reached, waiting'; await sleep(10 * 60 * 1000); continue; }
        var m = await (await fetch(RAW + 'manifest.json?v=' + Date.now(), { cache: 'no-store' })).json();
        var it = m.items.find(function (x) { return S.done.indexOf(x.key) < 0; });
        if (!it) { st.msg = 'ALL DONE'; break; }
        st.msg = 'adding ' + it.t.slice(0, 40);
        if (load().done.indexOf(it.key) >= 0) continue;
        await addOne(it);
        S = load(); S.done.push(it.key); S.n++; S.left--; save(S); st.ok++;
        var w = rnd(GAP[0], GAP[1]);
        if (S.left <= 0) { w = rnd(BRK[0], BRK[1]) * 60; S.left = Math.round(rnd(EVERY[0], EVERY[1])); save(S); }
        st.msg = 'added ' + S.done.length + ' (today ' + S.n + '); next in ' + Math.round(w) + 's';
        await sleep(w * 1000);
      }
    } catch (e) { st.msg = 'STOPPED: ' + e.message; }
    st.running = false;
  })();
  return 'started';
})();
