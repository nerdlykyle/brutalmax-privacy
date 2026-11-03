/* BrutalMaxer landing page. Plain JS, no build step. */
(function () {
  'use strict';

  // ---------- edit these ----------
  var CONFIG = {
    appStoreUrl: 'https://apps.apple.com/us/app/brutalmaxer-workout-tracker/id6761445068',
    playUrl: 'https://play.google.com/store/apps/details?id=com.kyleparsons.brutalmaxer',
    priceNow: '$2.99',
    priceWas: '$5.99',
    showLaunchPrice: true                  // false: show priceWas only, no strike, no tag
  };

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function fmt(n) { return (Math.round(n * 100) / 100).toString(); }

  // ---------- store links + pricing ----------
  var appStore = $('#appstore-link');
  if (appStore) {
    if (/^https?:/.test(CONFIG.appStoreUrl)) appStore.href = CONFIG.appStoreUrl;
    else { appStore.href = '#pricing'; appStore.querySelector('small').textContent = 'Find it on the'; }
  }
  var play = $('#play-link'); if (play) play.href = CONFIG.playUrl;
  // Only the store for this device: iPhone/iPad get the App Store, Android gets Google Play, desktops get both.
  (function () {
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var android = /Android/i.test(ua);
    if (!ios && !android) return;
    if (ios && play) play.hidden = true;
    if (android && appStore) appStore.hidden = true;
    var wrap = $('.stores'); if (wrap) wrap.classList.add('is-one');
  })();
  $$('[data-price-now]').forEach(function (el) { el.textContent = CONFIG.showLaunchPrice ? CONFIG.priceNow : CONFIG.priceWas; });
  $$('[data-price-was], [data-launch-tag]').forEach(function (el) { el.hidden = !CONFIG.showLaunchPrice; });

  // ---------- dark only ----------
  function scheme() { return 'dark'; }

  // ---------- hero video sound ----------
  var heroVideo = $('#hero-video');
  var soundBtn = $('#hero-sound');
  soundBtn.addEventListener('click', function () {
    var on = heroVideo.muted;
    heroVideo.muted = !on;
    if (on) { heroVideo.currentTime = 0; heroVideo.play().catch(function () {}); }
    soundBtn.classList.toggle('is-on', on);
    soundBtn.textContent = on ? 'Sound off' : 'Sound on';
  });
  if (reduceMotion) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); heroVideo.preload = 'auto'; }

  // ---------- ?debug3d: show what the 3D did, on screen (for testing on phones) ----------
  if (/[?&]debug3d\b/.test(location.search)) {
    window.__bm3dLog = window.__bm3dLog || [];
    window.addEventListener('error', function (e) { window.__bm3dLog.push('error: ' + e.message); });
    var dbg = document.createElement('pre');
    dbg.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:99;max-height:45vh;overflow:auto;margin:0;padding:10px;background:#000;color:#62F167;font:11px/1.4 monospace;white-space:pre-wrap;border:2px solid #62F167';
    var info = (function () {
      try {
        var c = document.createElement('canvas'), gl = c.getContext('webgl2');
        if (!gl) return 'WebGL2: no';
        var ext = gl.getExtension('WEBGL_debug_renderer_info');
        return 'WebGL2: yes\nGPU: ' + (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) +
          '\nTex units: ' + gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) + ' · frag uniforms: ' + gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) +
          '\nPrecision hi: ' + gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT).precision;
      } catch (e) { return 'WebGL probe threw: ' + e.message; }
    })();
    var paint = function () {
      dbg.textContent = navigator.userAgent + '\n' + info + '\nsaveData: ' + !!(navigator.connection && navigator.connection.saveData) +
        ' · coarse: ' + (window.matchMedia && matchMedia('(pointer: coarse)').matches) +
        (function () { var v = document.getElementById('hero-video'); return v ? '\nhero video: ' + (v.paused ? 'paused' : 'playing') + ' · ready ' + v.readyState + ' · t ' + v.currentTime.toFixed(1) + 's' + (v.error ? ' · error ' + v.error.code : '') : ''; })() +
        '\n---\n' + window.__bm3dLog.join('\n');
    };
    document.body.appendChild(dbg); paint(); setInterval(paint, 1000);
  }

  // ---------- shared 3D bundle (three.js + the app's demo engine), loaded once, on demand ----------
  var can3D = (function () {
    var conn = navigator.connection || {}, gl = false;
    try { var c = document.createElement('canvas'); gl = !!(window.WebGL2RenderingContext && c.getContext('webgl2')); } catch (e) {}
    // Reduced motion still gets 3D (it only moves when dragged); data saver and weak devices don't.
    return gl && !conn.saveData && !(navigator.deviceMemory && navigator.deviceMemory < 2);
  })();
  var bundle3D = null;
  function load3D() {
    if (!bundle3D) bundle3D = new Promise(function (resolve, reject) {
      if (window.BM3D) return resolve(window.BM3D);
      var sc = document.createElement('script');
      sc.src = 'assets/site3d.js';
      sc.onload = function () { window.BM3D ? resolve(window.BM3D) : reject(new Error('no BM3D')); };
      sc.onerror = reject;
      document.body.appendChild(sc);
    });
    return bundle3D;
  }

  // ---------- 3D iPhone in the hero (flat video stays as the fallback) ----------
  (function () {
    var fig = $('#hero-phone');
    if (!fig || !can3D) return;
    // Hold the flat backup phone back while the 3D one loads, so it doesn't flash and then swap.
    // If 3D fails or takes too long, the flat phone shows.
    fig.classList.add('is-pending');
    var giveUp = setTimeout(function () { fig.classList.remove('is-pending'); }, 9000);
    function flat() { clearTimeout(giveUp); fig.classList.remove('is-pending', 'is-3d'); var cv = document.querySelector('.phone__canvas'); if (cv) cv.remove(); }
    function glbFromPage() {
      if (!window.BM_GLB_B64) return null; // only the artifact preview embeds the model
      var bin = atob(window.BM_GLB_B64), out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out.buffer;
    }
    function go() {
      load3D().then(function (BM3D) {
        BM3D.mountPhone({
          figure: fig, video: heroVideo, modelUrl: 'assets/iphone.glb', modelData: glbFromPage(), still: reduceMotion,
          // zoom only with a mouse/trackpad: on touch screens a zoomed phone would trap page scrolling
          zoom: !(window.matchMedia && matchMedia('(pointer: coarse)').matches),
          // desktop only: four turning phones beside the headline, muted, hands-off
          decor: { sources: ['assets/side-1.mp4', 'assets/side-2.mp4', 'assets/side-3.mp4', 'assets/side-4.mp4'], minWidth: 1100 },
          onReady: function () {
            clearTimeout(giveUp);
            fig.classList.add('is-3d');
            fig.classList.remove('is-pending');
            fig.tabIndex = 0;
            fig.setAttribute('role', 'group');
            fig.setAttribute('aria-label', '3D iPhone playing the BrutalMaxer tour. Drag or use the arrow keys to turn it; pinch, or press plus and minus, to zoom; zero resets.');
          },
          onError: flat
        });
      }).catch(function (e) { console.warn('[BrutalMaxer 3D]', e); flat(); });
    }
    if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
  })();

  // the tour video and hero shouldn't talk over each other
  var tourVideo = $('#tour-video');
  tourVideo.addEventListener('play', function () {
    if (!heroVideo.muted) soundBtn.click();
  });

  // ---------- section titles stamp in once ----------
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.6 });
    $$('.sec-title').forEach(function (el) { io.observe(el); });
  }

  // ---------- shared stepper wiring ----------
  function wireStepper(box, opts) {
    var input = box.querySelector('input');
    function set(v) {
      v = clamp(Math.round(v / opts.round()) * opts.round(), opts.min(), opts.max());
      input.value = fmt(v);
      opts.onChange(v);
    }
    $$('button', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var cur = parseFloat(input.value) || 0;
        set(cur + Number(b.getAttribute('data-d')) * opts.step());
      });
    });
    input.addEventListener('change', function () { set(parseFloat(input.value) || opts.min()); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        set((parseFloat(input.value) || 0) + (e.key === 'ArrowUp' ? 1 : -1) * opts.step());
      }
      if (e.key === 'Enter') input.blur();
    });
    return { set: set, get: function () { return parseFloat(input.value) || 0; } };
  }

  // ---------- 1. next target: today → how it felt → next workout (mirrors src/workout/progression.ts) ----------
  var ICONS = {
    easy: ['m5 12 7-7 7 7', 'M12 19V5'],
    clean: ['M5 9h14', 'M5 15h14'],
    grindy: ['M3 15l4.5-6 4.5 6 4.5-6 4.5 6'],
    broke: ['M18 6 6 18', 'm6 6 12 12']
  };
  var FEEL_NAME = { easy: 'Too easy', clean: 'Clean', grindy: 'Grindy', broke: 'Form broke' };
  $$('.feel button').forEach(function (b) {
    var paths = ICONS[b.getAttribute('data-feel')].map(function (d) { return '<path d="' + d + '"/>'; }).join('');
    b.insertAdjacentHTML('afterbegin', '<svg viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>');
  });

  function radioGroup(group, onPick) {
    var btns = $$('[role="radio"]', group);
    function pick(b, focus) {
      btns.forEach(function (x) { var on = x === b; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
      if (focus) b.focus();
      onPick(b);
    }
    btns.forEach(function (b, i) {
      b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1;
      b.addEventListener('click', function () { pick(b); });
      b.addEventListener('keydown', function (e) {
        var d = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : (e.key === 'ArrowLeft' || e.key === 'ArrowUp') ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        pick(btns[(i + d + btns.length) % btns.length], true);
      });
    });
    return { pick: pick };
  }

  (function () {
    var RANGE = { min: 6, max: 8, text: '6-8' };
    var JUMP = 5, DROP = 5;
    var today = $('#sim-today'), next = $('#sim-next'), sim = $('#sim');
    var w2 = $('#t-weight2');
    var weight, reps1, reps2;

    // titles + details are the app's own strings; `why` explains which input caused it
    function decide(w, reps, q) {
      var missed = reps.filter(function (r) { return r < RANGE.min; }).length;
      var allTop = reps.every(function (r) { return r >= RANGE.max; });
      var allIn = reps.every(function (r) { return r >= RANGE.min; });
      var you = 'You chose ' + FEEL_NAME[q] + ' and did ' + reps.join(' and ') + ' reps. ';
      if (q === 'broke') {
        return missed > 0
          ? { title: 'Clean Up Form', w: w - DROP, detail: 'You marked form breakdown and missed ' + RANGE.text + '. Lower the load and make the reps cleaner.',
              why: you + 'Form broke and a set fell short of ' + RANGE.min + ', so the weight comes down ' + DROP + ' lb.' }
          : { title: 'Repeat Clean', w: w, detail: 'You marked form breakdown. Repeat the load until the set quality catches up.',
              why: you + 'Your reps held up, so the weight stays. Clean sets first. If reps had fallen short too, it would drop ' + DROP + ' lb.' };
      }
      if (allTop) {
        if (q === 'grindy') return { title: 'Own It First', w: w, detail: 'You hit the top of ' + RANGE.text + ', but marked a grindy set. Repeat the load and make it cleaner before adding weight.',
          why: you + 'You hit the top of ' + RANGE.text + ', but it was a grind. Same weight until it moves clean.' };
        return { title: 'Add Load', w: w + JUMP, detail: q === 'easy'
          ? 'You hit the top of ' + RANGE.text + ' and marked the sets too easy. Add load.'
          : 'You hit the top of ' + RANGE.text + ' on every working set.',
          why: you + 'Every set hit ' + RANGE.max + (q === 'easy' ? ' and it felt easy' : ' cleanly') + ', so you earned ' + JUMP + ' more lb.' };
      }
      if (allIn) return { title: 'Chase Reps', w: w, detail: 'You stayed inside ' + RANGE.text + '. Keep the load and push more sets toward ' + RANGE.max + '.',
        why: you + (q === 'easy' ? 'Too easy adds weight once every set reaches ' + RANGE.max + '. ' : '') + 'Same weight. Get every set to ' + RANGE.max + ' first.' };
      return missed > 1
        ? { title: 'Reduce Load', w: w - DROP, detail: 'Multiple sets missed the bottom of ' + RANGE.text + '. Drop slightly and get back in range.',
            why: you + 'Both sets fell short of ' + RANGE.min + ', so the weight drops ' + DROP + ' lb to get you back in range.' }
        : { title: 'Repeat Load', w: w, detail: 'One set missed the bottom of ' + RANGE.text + '. Repeat the load and clean it up.',
            why: you + 'One set fell short of ' + RANGE.min + '. Same weight, clean it up.' };
    }

    function finishWorkout(q) {
      var w = weight.get(), reps = [reps1.get(), reps2.get()];
      var d = decide(w, reps, q), nw = Math.max(0, d.w), delta = nw - w;
      $('#n-last').textContent = 'Last time: ' + fmt(w) + ' lb × ' + reps.join(', ') + ' · ' + FEEL_NAME[q];
      $('#n-title').textContent = d.title;
      $('#n-title').className = 'target__value' + (delta > 0 ? ' is-up' : delta < 0 ? ' is-down' : '');
      $('#n-detail').textContent = d.detail;
      $('#n-load').textContent = fmt(nw);
      var dl = $('#n-delta');
      dl.textContent = delta > 0 ? '+' + fmt(delta) : delta < 0 ? '−' + fmt(-delta) : 'same';
      dl.className = delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : '';
      $('#n-use').textContent = 'Use ' + fmt(nw) + ' lb';
      $('#n-why').textContent = d.why;
      swap(today, next);
      setTimeout(function () { $('#sim-reset').focus({ preventScroll: true }); }, reduceMotion ? 0 : 420);
    }
    function swap(from, to) {
      if (reduceMotion) { from.hidden = true; to.hidden = false; return; }
      from.classList.add('is-out');
      setTimeout(function () {
        from.hidden = true; from.classList.remove('is-out');
        to.hidden = false; to.classList.add('is-in');
        setTimeout(function () { to.classList.remove('is-in'); }, 400);
      }, 260);
    }
    function st(field, step, min, max) {
      return wireStepper($('[data-field="' + field + '"]', today), {
        step: function () { return step; }, round: function () { return step === 5 ? 2.5 : 1; },
        min: function () { return min; }, max: function () { return max; },
        onChange: function () { w2.textContent = fmt(weight ? weight.get() : 145); }
      });
    }
    weight = st('weight', 5, 45, 500);
    reps1 = st('reps1', 1, 0, 20);
    reps2 = st('reps2', 1, 0, 20);
    $$('.feel button', today).forEach(function (b) {
      b.addEventListener('click', function () { finishWorkout(b.getAttribute('data-feel')); });
    });
    $('#sim-reset').addEventListener('click', function () {
      swap(next, today);
      setTimeout(function () { var f = $('.feel button', today); if (f) f.focus({ preventScroll: true }); }, reduceMotion ? 0 : 420);
    });
  })();

  // ---------- 2. personal bests (PR banner + exercise chart, as in the app) ----------
  (function () {
    // e1RM the way the app computes it: weight × (1 + reps / 30)
    var e1 = function (w, r) { return w * (1 + r / 30); };
    var HISTORY = [[125, 8], [130, 7], [130, 8], [135, 7], [135, 8], [140, 6], [140, 8], [145, 7]];
    var sessions, best;
    var toast = $('#pb-toast'), tTitle = $('#pb-toast-title'), tDetail = $('#pb-toast-detail');
    var chart = $('#pb-chart'), metric = 'top', toastTimer = 0;

    function reset() {
      sessions = HISTORY.map(function (h) { return { w: h[0], r: h[1], today: false }; });
      best = { w: 0, e: 0 };
      sessions.forEach(function (s) { best.w = Math.max(best.w, s.w); best.e = Math.max(best.e, e1(s.w, s.r)); });
      toast.hidden = true;
      paintBests(); draw();
    }
    function paintBests() {
      $('#pb-best-w').textContent = fmt(best.w) + ' lb';
      $('#pb-best-e').textContent = String(Math.round(best.e));
    }
    function show(title, detail, isPr) {
      clearTimeout(toastTimer);
      tTitle.textContent = title; tDetail.textContent = detail;
      toast.classList.toggle('is-pr', isPr);
      toast.hidden = false;
      toast.classList.remove('is-pop'); void toast.offsetWidth; toast.classList.add('is-pop');
      toastTimer = setTimeout(function () { toast.hidden = true; }, 4200);
    }
    var wS = wireStepper($('#pb-w'), { step: function () { return 5; }, round: function () { return 2.5; }, min: function () { return 45; }, max: function () { return 500; }, onChange: function () {} });
    var rS = wireStepper($('#pb-r'), { step: function () { return 1; }, round: function () { return 1; }, min: function () { return 1; }, max: function () { return 30; }, onChange: function () {} });
    $('#pb-log').addEventListener('click', function () {
      var w = wS.get(), r = rS.get(), e = e1(w, r);
      // same order as the app: heaviest weight first, then estimated max
      if (w > best.w) show('New PR · ' + fmt(w) + ' lb', 'Barbell incline press · heaviest yet', true);
      else if (e > best.e) show('New PR · e1RM ' + Math.round(e), 'Barbell incline press · ' + fmt(w) + ' × ' + r, true);
      else show('Logged ' + fmt(w) + ' × ' + r, 'No PR this time. Beat ' + fmt(best.w) + ' lb or an e1RM of ' + Math.round(best.e) + '.', false);
      best.w = Math.max(best.w, w); best.e = Math.max(best.e, e);
      sessions.push({ w: w, r: r, today: true });
      if (sessions.length > 12) sessions.shift();
      paintBests(); draw();
    });
    $('#pb-reset').addEventListener('click', function () { reset(); wS.set(145); rS.set(8); });
    radioGroup($('#pb .seg'), function (b) { metric = b.getAttribute('data-metric'); draw(); });

    function value(s) { return metric === 'top' ? s.w : metric === 'e1rm' ? e1(s.w, s.r) : s.w * s.r * 2; }
    function draw() {
      var W = 320, H = 150, L = 34, Rr = 8, T = 12, B = 22;
      var vals = sessions.map(value);
      var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      var pad = (hi - lo) * 0.15 || hi * 0.05; lo -= pad; hi += pad;
      var x = function (i) { return L + (W - L - Rr) * (sessions.length === 1 ? .5 : i / (sessions.length - 1)); };
      var y = function (v) { return T + (H - T - B) * (1 - (v - lo) / (hi - lo)); };
      var pts = vals.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); });
      var top = Math.max.apply(null, vals);
      var grid = [hi - pad, (hi + lo) / 2, lo + pad].map(function (g) {
        return '<line class="chart__grid" x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(g).toFixed(1) + '" y2="' + y(g).toFixed(1) + '"/>' +
          '<text class="chart__lab" x="' + (L - 6) + '" y="' + (y(g) + 3).toFixed(1) + '" text-anchor="end">' + Math.round(g) + '</text>';
      }).join('');
      var dots = vals.map(function (v, i) {
        var s = sessions[i], isTop = v === top;
        return '<rect class="chart__dot' + (s.today ? ' is-today' : '') + (isTop ? ' is-best' : '') + '" x="' + (x(i) - 4).toFixed(1) + '" y="' + (y(v) - 4).toFixed(1) + '" width="8" height="8"/>';
      }).join('');
      chart.innerHTML = grid + '<polyline class="chart__line" points="' + pts.join(' ') + '"/>' + dots +
        '<text class="chart__lab" x="' + L + '" y="' + (H - 6) + '">' + (sessions.length) + ' sessions ago</text>' +
        '<text class="chart__lab" x="' + (W - Rr) + '" y="' + (H - 6) + '" text-anchor="end">' + (sessions[sessions.length - 1].today ? 'Today' : 'Last session') + '</text>';
      var name = metric === 'top' ? 'Top weight' : metric === 'e1rm' ? 'Estimated 1-rep max' : 'Volume';
      chart.setAttribute('aria-label', name + ' over the last ' + sessions.length + ' sessions: ' + vals.map(function (v) { return Math.round(v); }).join(', '));
    }
    reset();
  })();

  // ---------- 6. rest timer: rest picks itself from the kind of set ----------
  var rest = { total: 150, left: 150, running: false, end: 0, raf: 0, done: false, kind: 'Compound' };
  var rEl = $('#rest'), rTime = $('#r-time'), rGo = $('#r-go'), rStatus = $('#r-status');
  var rWedge = $('#r-wedge'), rHand = $('#r-hand'), rTicks = $('#r-ticks');
  var beep = null;
  var CX = 60, CY = 66, R = 44;

  (function ticks() {
    var html = '';
    for (var i = 0; i < 12; i++) {
      var a = i / 12 * Math.PI * 2;
      var x1 = CX + Math.sin(a) * 40, y1 = CY - Math.cos(a) * 40, x2 = CX + Math.sin(a) * 46, y2 = CY - Math.cos(a) * 46;
      html += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
    }
    rTicks.innerHTML = html;
  })();

  function mmss(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function drawRest() {
    var frac = clamp(rest.left / 300, 0, 1); // dial face = 5 minutes, like a kitchen timer
    var a = frac * Math.PI * 2;
    var x = CX + Math.sin(a) * R, y = CY - Math.cos(a) * R;
    rWedge.setAttribute('d', frac <= 0 ? '' : frac >= 1
      ? 'M' + CX + ' ' + (CY - R) + ' A' + R + ' ' + R + ' 0 1 1 ' + (CX - 0.01) + ' ' + (CY - R) + 'Z'
      : 'M' + CX + ' ' + CY + ' L' + CX + ' ' + (CY - R) + ' A' + R + ' ' + R + ' 0 ' + (frac > 0.5 ? 1 : 0) + ' 1 ' + x.toFixed(2) + ' ' + y.toFixed(2) + 'Z');
    rHand.setAttribute('x2', (CX + Math.sin(a) * 36).toFixed(2));
    rHand.setAttribute('y2', (CY - Math.cos(a) * 36).toFixed(2));
    rTime.textContent = rest.done ? 'Ready' : mmss(rest.left);
  }
  function tick() {
    rest.left = (rest.end - performance.now()) / 1000;
    if (rest.left <= 0) { finish(); return; }
    drawRest();
    rest.raf = requestAnimationFrame(tick);
  }
  function startRest() {
    if (rest.done) resetRest();
    rest.running = true;
    rest.end = performance.now() + rest.left * 1000;
    rGo.textContent = 'Pause';
    if (!beep) { try { beep = new Audio('assets/rest_beep.wav'); beep.preload = 'auto'; } catch (e) { beep = null; } }
    rStatus.textContent = 'Rest started, ' + mmss(rest.left) + '.';
    tick();
  }
  function pauseRest() {
    rest.running = false; cancelAnimationFrame(rest.raf);
    rGo.textContent = 'Start';
    rStatus.textContent = 'Paused at ' + mmss(rest.left) + '.';
  }
  function finish() {
    cancelAnimationFrame(rest.raf);
    rest.running = false; rest.done = true; rest.left = 0;
    rEl.classList.add('is-done');
    rGo.textContent = 'Reset';
    $('#r-kind').textContent = 'Rest over';
    rStatus.textContent = 'Rest over. Next set.';
    drawRest();
    if (beep) {
      var n = 0;
      var ring = function () { if (n++ < 3) { beep.currentTime = 0; beep.play().catch(function () {}); setTimeout(ring, 750); } };
      ring();
    }
    if (navigator.vibrate) { try { navigator.vibrate([200, 100, 200]); } catch (e) {} }
  }
  function resetRest() {
    cancelAnimationFrame(rest.raf);
    rest.running = false; rest.done = false; rest.left = rest.total;
    rEl.classList.remove('is-done');
    $('#r-kind').textContent = rest.kind + ' rest';
    rGo.textContent = 'Start';
    drawRest();
  }
  function nudge(sec) {
    if (rest.done) resetRest();
    rest.left = clamp(rest.left + sec, 5, 300);
    if (!rest.running) rest.total = rest.left; else rest.end += sec * 1000;
    rStatus.textContent = mmss(rest.left) + ' left.';
    drawRest();
  }
  rGo.addEventListener('click', function () { rest.done ? resetRest() : rest.running ? pauseRest() : startRest(); });
  $('#r-minus').addEventListener('click', function () { nudge(-15); });
  $('#r-plus').addEventListener('click', function () { nudge(15); });
  radioGroup($('#r-kinds'), function (b) {
    rest.kind = b.getAttribute('data-name');
    rest.total = Number(b.getAttribute('data-sec'));
    $('#r-detail').textContent = b.getAttribute('data-ex');
    resetRest();
    rStatus.textContent = rest.kind + ' set: ' + mmss(rest.total) + ' rest.';
  });
  drawRest();

  // ---------- 5. programs: the app's library ----------
  (function () {
    var PROGRAMS = [{"id": "min-max", "title": "Apex 5: Hypertrophy", "weeks": 12, "days": 5, "free": true, "tags": ["Full Body", "Chest", "Back", "Legs", "Arms"], "desc": "Zero junk volume. A 12-week calculated assault designed to maximize pure muscle mass."}, {"id": "forge-5-peak-hypertrophy", "title": "Forge 5: Peak Hypertrophy", "weeks": 12, "days": 5, "tags": ["Full Body", "Chest", "Back", "Legs", "Shoulders", "Arms"], "desc": "A focused 12-week, five-day hypertrophy split with heavy work, high-rep back-off sets, and targeted substitutions."}, {"id": "spidey-daily", "title": "Spidey", "weeks": 12, "days": 5, "tags": ["Full Body", "Conditioning", "Bodyweight"], "desc": "A repeatable 20-minute bodyweight benchmark: 5 pull-ups, 10 push-ups, and 15 air squats for as many rounds as possible."}, {"id": "venom-daily", "title": "Venom", "weeks": 12, "days": 5, "tags": ["Full Body", "Conditioning", "Strength"], "desc": "A 12-week weighted Spidey progression. Movement feedback sets independent pull-up, push-up, and squat load increases each week."}, {"id": "bodybuilding_12_week", "title": "Bodybuilding 12-Week", "weeks": 12, "days": 5, "free": false, "tags": ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Calves"], "desc": "A classic 5-day bodybuilding split focused on maximal muscle growth through high-volume isolation, peak contraction, and heavy compound lifts."}, {"id": "bodyweight_12_week", "title": "Zero Weight 12-Week", "weeks": 12, "days": 3, "free": false, "tags": ["Full Body", "Chest", "Back", "Legs", "Arms", "Core"], "desc": "A 12-week progressive calisthenics program requiring strictly zero equipment, using leverage and gravity to build muscle and strength."}, {"id": "targeted_12_week", "title": "Targeted 12-Week (Bro Split)", "weeks": 12, "days": 4, "free": false, "tags": ["Chest", "Triceps", "Back", "Biceps", "Legs", "Shoulders", "Core"], "desc": "A 4-day targeted split focusing on isolating specific muscle groups to maximize volume and recovery over three progressive phases."}, {"id": "chest_hypertrophy_12_week", "title": "Chest Hypertrophy 12-Week", "weeks": 12, "days": 2, "free": true, "tags": ["Chest", "Triceps", "Front Delts"], "desc": "A specialized 12-week program focusing entirely on maximizing chest development through a mix of heavy compound presses, high-volume isolation, and multi-angle cable work."}, {"id": "mock_chest_1", "title": "PUMP: Chest & Tris", "weeks": 1, "days": 1, "free": false, "tags": ["Chest", "Arms"], "desc": "A quick brutal 4-exercise blast to maximize upper body pump."}, {"id": "full_body_12_week", "title": "Full Body 12-Week Hypertrophy", "weeks": 12, "days": 3, "free": false, "tags": ["Full Body", "Chest", "Back", "Legs", "Arms", "Shoulders", "Core"], "desc": "A comprehensive 12-week full-body program broken into three 4-week phases, designed to maximize muscle accumulation through progressive overload."}, {"id": "high_frequency_12_week", "title": "High Frequency 12-Week", "weeks": 12, "days": 5, "free": false, "tags": ["Full Body"], "desc": "A 5-day full-body routine designed to stimulate muscle protein synthesis as frequently as possible. Daily volume per muscle is low, but weekly cumulative volume is high."}, {"id": "leg_gravity_blueprint", "title": "The Gravity Blueprint", "weeks": 12, "days": 2, "free": false, "tags": ["Legs", "Glutes", "Calves"], "desc": "Bodyweight leg hypertrophy using leverage, tempo, range of motion, and practical progressions."}, {"id": "leg_iron_blueprint", "title": "The Iron Blueprint", "weeks": 12, "days": 2, "free": false, "tags": ["Legs", "Glutes", "Calves"], "desc": "Heavy compounds, targeted isolation, and split lower-body emphasis across 12 weeks of leg hypertrophy."}, {"id": "ppl_12_week", "title": "Push Pull Legs 12-Week", "weeks": 12, "days": 3, "free": false, "tags": ["Chest", "Back", "Legs", "Shoulders", "Arms"], "desc": "A classic PPL split designed to train all major muscle groups with optimal frequency, structured across three progressive phases."}, {"id": "upper_lower_12_week", "title": "Upper/Lower 12-Week", "weeks": 12, "days": 4, "free": false, "tags": ["Upper Body", "Lower Body"], "desc": "A 4-day split dividing the body into upper and lower days, allowing for high frequency and optimal recovery."}];
    var feat = $('#pg-feat'), list = $('#pg-list'), toggle = $('#pg-toggle');
    var cur = PROGRAMS[0];
    $('#pg-count').textContent = 'All ' + PROGRAMS.length + ' programs';
    function weeksStrip(p) {
      var html = '';
      for (var i = 1; i <= p.weeks; i++) html += '<span class="wk' + (i === 1 && p.free ? ' is-free' : '') + '">' + i + '</span>';
      return html;
    }
    function render() {
      feat.innerHTML =
        '<p class="prog__name">' + esc(cur.title) + '</p>' +
        '<p class="prog__meta">' + cur.weeks + (cur.weeks === 1 ? ' week' : ' weeks') + ' · ' + cur.days + (cur.days === 1 ? ' day' : ' days') + ' a week' + (cur.free ? ' · <b class="free">Week 1 free</b>' : ' · <b class="pro">Pro</b>') + '</p>' +
        '<p class="prog__desc">' + esc(cur.desc) + '</p>' +
        '<div class="prog__weeks" aria-label="' + cur.weeks + ' weeks">' + weeksStrip(cur) + '</div>' +
        '<div class="prog__tags">' + cur.tags.slice(0, 5).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>';
      $$('button', list).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-id') === cur.id)); });
    }
    list.innerHTML = PROGRAMS.map(function (p) {
      return '<li><button type="button" data-id="' + p.id + '"><span class="prog__li-name">' + esc(p.title) + '</span>' +
        '<span class="prog__li-meta">' + p.weeks + ' wk · ' + p.days + '/wk' + (p.free ? ' · Free wk 1' : '') + '</span></button></li>';
    }).join('');
    $$('button', list).forEach(function (b) {
      b.addEventListener('click', function () {
        cur = PROGRAMS.filter(function (p) { return p.id === b.getAttribute('data-id'); })[0] || cur;
        render();
        feat.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      });
    });
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      list.hidden = !open;
    });
    function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    render();
  })();

  // ---------- 4. muscle focus ----------
  // Example: Apex 5 sets a week. floor = maintenance volume the builder never cuts below.
  var MUSCLES = [
    { k: 'Chest', n: 8, floor: 6 }, { k: 'Back', n: 10, floor: 6 }, { k: 'Shoulders', n: 12, floor: 6 },
    { k: 'Biceps', n: 8, floor: 4 }, { k: 'Triceps', n: 8, floor: 4 }, { k: 'Quads', n: 10, floor: 6 },
    { k: 'Hamstrings', n: 7, floor: 4 }, { k: 'Glutes', n: 7, floor: 4 }, { k: 'Calves', n: 6, floor: 3 },
    { k: 'Abs', n: 4, floor: 2 }
  ];
  var FOCUS_ADD = 4, MAX = 20;
  var focus = [], mode = 'same';
  var fChips = $('#f-chips'), fBars = $('#f-bars'), fFine = $('#f-fine');

  MUSCLES.forEach(function (m) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = m.k; b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      var i = focus.indexOf(m.k);
      if (i >= 0) focus.splice(i, 1);
      else { focus.push(m.k); if (focus.length > 2) focus.shift(); }
      renderFocus();
    });
    fChips.appendChild(b);
  });
  radioGroup($('[aria-label="Session length"]'), function (b) { mode = b.getAttribute('data-mode'); renderFocus(); });

  function plan() {
    var out = MUSCLES.map(function (m) { return { k: m.k, n: m.n, floor: m.floor, focus: focus.indexOf(m.k) >= 0 }; });
    var added = 0;
    out.forEach(function (m) { if (m.focus) { m.n += FOCUS_ADD; added += FOCUS_ADD; } });
    if (mode === 'same') {
      // take the added sets back from the biggest non-focus muscles, never below their floor
      var guard = 200;
      while (added > 0 && guard--) {
        var pool = out.filter(function (m) { return !m.focus && m.n > m.floor; });
        if (!pool.length) break;
        pool.sort(function (a, b) { return (b.n - b.floor) - (a.n - a.floor); });
        pool[0].n--; added--;
      }
    }
    return out;
  }
  function renderFocus() {
    $$('.chip', fChips).forEach(function (b) { b.setAttribute('aria-pressed', String(focus.indexOf(b.textContent) >= 0)); });
    var rows = plan();
    var base = MUSCLES.reduce(function (s, m) { return s + m.n; }, 0);
    var total = rows.reduce(function (s, m) { return s + m.n; }, 0);
    fBars.innerHTML = rows.map(function (m) {
      return '<div class="vol__row' + (m.focus ? ' is-focus' : '') + '">' +
        '<span>' + m.k + '</span>' +
        '<span class="vol__track" aria-hidden="true"><span class="vol__fill" style="width:' + (m.n / MAX * 100) + '%"></span>' +
        '<span class="vol__floor" style="left:calc(' + (m.floor / MAX * 100) + '% - 1px)"></span></span>' +
        '<span class="vol__n">' + m.n + '</span></div>';
    }).join('');
    fBars.setAttribute('aria-label', rows.map(function (m) { return m.k + ' ' + m.n + ' sets'; }).join(', '));
    if (!focus.length) fFine.textContent = 'Sets a week, Apex 5 example. The tick is maintenance. Pick a muscle.';
    else if (mode === 'same') fFine.textContent = 'Same ' + total + ' sets a week. ' + focus.join(' and ') + ' get more; the rest trim toward maintenance, never under it.';
    else fFine.textContent = (total - base > 0 ? '+' + (total - base) : '0') + ' sets a week on top. Everything else stays put.';
  }
  renderFocus();

  // ---------- 5. 3D lift turntable ----------
  var lift = (function () {
    var box = $('#lift'), img = $('#lift-img');
    var FRAMES = 24, NAMES = { 0: 'Three-quarter view', 2: 'Side view', 21: 'Front view' };
    var frame = 0, cache = {}, idle = null, touched = false, visible = false;
    var camBtns = $$('[data-frame]');
    var live = null; // the app's real 3D engine, once loaded
    var VIEWS = { 0: 'default', 2: 'side', 21: 'front' };
    var DEMO_ID = 'barbell_incline_press';

    function src(i, s) { return 'assets/3d/' + (s || scheme()) + '/r' + String(i).padStart(2, '0') + '.webp'; }
    function preload(s) {
      if (cache[s]) return;
      cache[s] = [];
      for (var i = 0; i < FRAMES; i++) { var im = new Image(); im.decoding = 'async'; im.src = src(i, s); cache[s].push(im); }
    }
    function show(i) {
      frame = ((i % FRAMES) + FRAMES) % FRAMES;
      img.src = src(frame);
      box.setAttribute('aria-valuenow', String(frame));
      box.setAttribute('aria-valuetext', NAMES[frame] || 'Rotated ' + Math.round(frame / FRAMES * 360) + ' degrees');
      camBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-frame')) === frame)); });
    }
    function stopIdle() { touched = true; clearInterval(idle); idle = null; }
    function startIdle() {
      if (live || reduceMotion || touched || idle || !visible) return;
      idle = setInterval(function () { show(frame + 1); }, 700);
    }
    function look() { return { dark: scheme() === 'dark', accent: '#818cf8' }; }
    function goLive() {
      load3D().then(function (BM3D) {
        if (live || !BM3D.hasDemo(DEMO_ID)) return;
        BM3D.setDemoLook(look());
        var holder = document.createElement('div');
        holder.className = 'lift__live';
        box.insertBefore(holder, box.firstChild);
        // loop at the app's own tempo (lift 1 count, lower 3); a slow turn until someone drags it
        var v = BM3D.createDemoViewer(holder, { exerciseId: DEMO_ID, mode: 'loop', interactive: true, autoSpin: 0.2 });
        if (!v) { holder.remove(); return; }
        // if this browser/GPU draws nothing, keep the baked frames
        if (v.selfTest && !v.selfTest()) { v.dispose(); holder.remove(); return; }
        live = { v: v, BM3D: BM3D };
        clearInterval(idle); idle = null;
        box.classList.add('is-live');
        box.setAttribute('role', 'group');
        ['aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext'].forEach(function (a) { box.removeAttribute(a); });
        box.setAttribute('aria-label', '3D barbell incline press at the app\u2019s rep tempo. Drag, or use the arrow keys, to turn it.');
        setView(0);
      }).catch(function (e) { console.warn('[BrutalMaxer 3D]', e); });
    }
    function setView(f) {
      live.v.setView(VIEWS[f] || 'default');
      camBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-frame')) === f)); });
    }

    var drag = null;
    box.addEventListener('pointerdown', function (e) {
      if (live) return;
      stopIdle();
      drag = { x: e.clientX, f: frame, id: e.pointerId };
      box.setPointerCapture(e.pointerId);
    });
    box.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var per = box.clientWidth / 14; // about 1.7 turns across the card
      show(drag.f - Math.round((e.clientX - drag.x) / per));
    });
    function end() { drag = null; }
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);
    box.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? -1 : e.key === 'ArrowLeft' ? 1 : 0;
      if (live) {
        if (d) { live.v.rotate(d * 0.3); e.preventDefault(); }
        if (e.key === 'Home') { setView(0); e.preventDefault(); }
        return;
      }
      if (e.key === 'Home') { stopIdle(); show(0); e.preventDefault(); }
      if (d) { stopIdle(); show(frame + d); e.preventDefault(); }
    });
    camBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = Number(b.getAttribute('data-frame'));
        if (live) setView(f); else { stopIdle(); show(f); }
      });
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) { if (!live) { preload(scheme()); startIdle(); } } else { clearInterval(idle); idle = null; }
      }, { threshold: 0.4 }).observe(box);
      // start loading the real engine a little before the card scrolls in
      if (can3D) {
        var near = new IntersectionObserver(function (en) {
          if (en[0].isIntersecting) { near.disconnect(); goLive(); }
        }, { rootMargin: '400px 0px' });
        near.observe(box);
      }
    } else preload(scheme());

    show(0);
    return {};
  })();
})();
