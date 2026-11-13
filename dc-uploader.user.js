// ==UserScript==
// @name         Dollar Classics slow uploader
// @namespace    dollarclassics
// @version      1.0
// @description  Adds queued books to Payhip slowly (random gaps, daily cap, breaks, stops on warnings)
// @match        https://payhip.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
  'use strict';
  var MANIFEST = 'https://raw.githubusercontent.com/sefianekahloul-dev/dc-batch6/main/manifest.json';
  var CAP = 200;                 // max books per day
  var GAP = [45, 120];           // seconds between books (random)
  var EVERY = [18, 30];          // a long break after this many books
  var BREAK = [6, 14];           // minutes
  var ADD = 'https://payhip.com/product/add/digital';
  var K = 'dc6';
  var S = JSON.parse(localStorage.getItem(K) || '{"on":false,"done":[],"day":"","n":0,"next":0,"left":22,"pending":""}');
  var save = function () { localStorage.setItem(K, JSON.stringify(S)); };
  var rnd = function (a, b) { return a + Math.random() * (b - a); };
  var today = new Date().toDateString();
  if (S.day !== today) { S.day = today; S.n = 0; save(); }

  var box = document.createElement('div');
  box.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:999999;background:#222;color:#fff;font:12px sans-serif;padding:8px;border-radius:6px;max-width:260px';
  var msg = document.createElement('div'); var btn = document.createElement('button');
  btn.style.cssText = 'margin-top:4px;padding:2px 8px'; box.append(msg, btn); document.body.append(box);
  var say = function (t) { msg.textContent = 'DC: ' + t + ' | done ' + S.done.length + ' | today ' + S.n + '/' + CAP; };
  var refresh = function () { btn.textContent = S.on ? 'Stop' : 'Start'; };
  btn.onclick = function () { S.on = !S.on; save(); refresh(); if (S.on) location.href = ADD; else say('stopped'); };
  refresh(); say(S.on ? 'running' : 'idle');
  if (!S.on) return;

  function halt(why) { S.on = false; save(); refresh(); say('STOPPED: ' + why); }
  var warn = /captcha|unusual activity|too many (requests|attempts)|temporarily|suspended|violat|verify you are human|rate limit/i;
  if (warn.test(document.body.innerText.slice(0, 4000))) return halt('Payhip warning on page');

  var onAdd = location.pathname.indexOf('/product/add/digital') === 0;

  // Came back from a submit?
  if (S.pending) {
    if (onAdd) return halt('form reloaded after submit (error?) for ' + S.pending);
    S.done.push(S.pending); S.n++; S.left--; S.pending = '';
    var wait = rnd(GAP[0], GAP[1]);
    if (S.left <= 0) { wait = rnd(BREAK[0], BREAK[1]) * 60; S.left = Math.round(rnd(EVERY[0], EVERY[1])); }
    S.next = Date.now() + wait * 1000; save();
  }
  if (S.n >= CAP) { var t = new Date(); t.setHours(24, 5, 0, 0); S.next = t.getTime(); say('daily cap reached, resuming tomorrow'); save(); }

  function countdown() {
    var left = Math.round((S.next - Date.now()) / 1000);
    if (left > 0) { say('next in ' + Math.floor(left / 60) + 'm' + (left % 60) + 's'); setTimeout(countdown, 1000); return; }
    if (!onAdd) { location.href = ADD; return; }
    go();
  }

  async function go() {
    try {
      var m = await (await fetch(MANIFEST, { cache: 'no-store' })).json();
      var it = m.items.find(function (x) { return S.done.indexOf(x.key) < 0; });
      if (!it) return halt('ALL DONE');
      say('uploading ' + it.t.slice(0, 30));
      var zb = await (await fetch(it.zu)).blob(), cb = await (await fetch(it.cu)).blob();
      var ins = document.querySelectorAll('input[type=file]');
      var put = function (inp, f) { var dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files; inp.dispatchEvent(new Event('change', { bubbles: true })); };
      var zn = it.zu.split('/').pop();
      put(ins[0], new File([zb], zn, { type: 'application/zip' }));
      put(ins[1], new File([cb], it.cu.split('/').pop(), { type: 'image/jpeg' }));
      var nm = document.querySelector('input[name=p_name]'); nm.value = it.t; nm.dispatchEvent(new Event('input', { bubbles: true }));
      var pr = document.querySelector('input[name=p_price]'); pr.value = it.p; pr.dispatchEvent(new Event('input', { bubbles: true }));
      var ed = document.querySelector('.ql-editor');
      ed.closest('.ql-container').__quill.clipboard.dangerouslyPasteHTML(it.h);
      for (var i = 0; i < 120; i++) {
        await new Promise(function (r) { setTimeout(r, 1000); });
        var txt = document.body.innerText;
        if (txt.indexOf(zn) >= 0 && !/\d{1,2}%/.test(txt)) break;
      }
      if (document.body.innerText.indexOf(zn) < 0) return halt('upload failed for ' + it.key);
      await new Promise(function (r) { setTimeout(r, 2000 + Math.random() * 3000); });
      document.querySelector('input[name=p_desc]').value = ed.innerHTML;
      S.pending = it.key; save();
      [].slice.call(document.querySelectorAll('button[type=submit],input[type=submit]')).find(function (x) { return /add product/i.test(x.innerText || x.value); }).click();
    } catch (e) { halt('error ' + e.message); }
  }
  countdown();
})();
