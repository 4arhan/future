/* Farwatt — the two small drawings in the Energy and Compute sections:
   1. "24 hours on a solar-plus-storage site", an SVG line chart with a crosshair readout.
   2. The rack row, a decorative canvas.
   Colors come from CSS (styles.css, "Chart series"), so both follow the theme. */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ====================================================================
     1. Day chart
     ==================================================================== */
  (function () {
    var host = document.getElementById('day-chart');
    if (!host || !document.createElementNS) return;

    var NS = 'http://www.w3.org/2000/svg';
    var LOAD = 0.28;   // site load as a share of peak solar output
    var STEP = 0.25;   // crosshair snaps to 15 minutes

    /* A clear day: nothing before 06:00 or after 18:00, peak at noon. */
    function solar(t) {
      if (t <= 6 || t >= 18) return 0;
      return Math.pow(Math.sin(Math.PI * (t - 6) / 12), 1.2);
    }
    /* Hours at which the solar curve crosses the load line. */
    var CROSS = 12 * Math.asin(Math.pow(LOAD, 1 / 1.2)) / Math.PI;
    var T1 = 6 + CROSS, T2 = 18 - CROSS;

    var pct = function (v) { return Math.round(v * 100) + '%'; };
    var clock = function (t) {
      var h = Math.floor(t + 1e-6), m = Math.round((t - h) * 60);
      return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    };
    function battery(t) {
      var s = solar(t);
      if (s >= LOAD) return 'charging with the spare ' + pct(s - LOAD);
      return 'supplying ' + pct(LOAD - s);
    }

    function el(name, attrs, parent) {
      var n = document.createElementNS(NS, name);
      for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
      if (parent) parent.appendChild(n);
      return n;
    }
    function label(parent, x, y, text, anchor, cls) {
      var t = el('text', { x: x, y: y, 'text-anchor': anchor || 'start', 'class': cls || '' }, parent);
      t.textContent = text;
      return t;
    }

    var svg, tip, cross, dotS, dotL, geom, current = null;

    function render() {
      var width = Math.max(260, Math.round(host.clientWidth));
      var height = Math.round(Math.min(330, Math.max(230, width * 0.5)));
      var m = { l: 40, r: 12, t: 14, b: 28 };
      var pw = width - m.l - m.r, ph = height - m.t - m.b;
      var x = function (t) { return m.l + t / 24 * pw; };
      var y = function (v) { return m.t + (1 - v / 1.04) * ph; };
      geom = { x: x, y: y, m: m, pw: pw, ph: ph, width: width, height: height };

      if (svg) host.removeChild(svg);
      svg = el('svg', {
        viewBox: '0 0 ' + width + ' ' + height, width: width, height: height, role: 'img', tabindex: '0',
        'aria-label': 'Line chart of one day. Solar output rises from zero at 06:00 to 100 percent at noon and falls to zero at 18:00. Site load is flat at 28 percent. Use the left and right arrow keys to read values.'
      });

      // grid and axes
      [0, 0.25, 0.5, 0.75, 1].forEach(function (v) {
        el('line', { x1: m.l, x2: width - m.r, y1: y(v), y2: y(v), 'class': v === 0 ? 'c-axis' : 'c-grid' }, svg);
        label(svg, m.l - 8, y(v) + 4, pct(v), 'end');
      });
      [0, 6, 12, 18, 24].forEach(function (t, i, a) {
        label(svg, x(t), height - 8, clock(t), i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle');
        if (i > 0 && i < a.length - 1) el('line', { x1: x(t), x2: x(t), y1: y(0), y2: y(0) + 4, 'class': 'c-axis' }, svg);
      });

      // areas: surplus above the load line, battery supply below it
      var t, d;
      d = 'M' + x(T1) + ' ' + y(LOAD);
      for (t = T1; t <= T2 + 1e-6; t += 0.1) d += 'L' + x(t).toFixed(1) + ' ' + y(solar(t)).toFixed(1);
      d += 'L' + x(T2) + ' ' + y(LOAD) + 'Z';
      el('path', { d: d, 'class': 'c-area-solar' }, svg);

      d = 'M' + x(0) + ' ' + y(0) + 'L' + x(0) + ' ' + y(LOAD) + 'L' + x(T1) + ' ' + y(LOAD);
      for (t = T1; t >= 6; t -= 0.1) d += 'L' + x(t).toFixed(1) + ' ' + y(solar(t)).toFixed(1);
      d += 'L' + x(6) + ' ' + y(0) + 'Z';
      el('path', { d: d, 'class': 'c-area-batt' }, svg);

      d = 'M' + x(24) + ' ' + y(0) + 'L' + x(24) + ' ' + y(LOAD) + 'L' + x(T2) + ' ' + y(LOAD);
      for (t = T2; t <= 18; t += 0.1) d += 'L' + x(t).toFixed(1) + ' ' + y(solar(t)).toFixed(1);
      d += 'L' + x(18) + ' ' + y(0) + 'Z';
      el('path', { d: d, 'class': 'c-area-batt' }, svg);

      // lines
      el('line', { x1: x(0), x2: x(24), y1: y(LOAD), y2: y(LOAD), 'class': 'c-load' }, svg);
      d = 'M' + x(0) + ' ' + y(0);
      for (t = 6; t <= 18 + 1e-6; t += 0.1) d += 'L' + x(t).toFixed(1) + ' ' + y(solar(t)).toFixed(1);
      d += 'L' + x(24) + ' ' + y(0);
      el('path', { d: d, 'class': 'c-solar' }, svg);

      // direct labels: selective, in text ink, sitting next to their marks
      var roomy = pw > 430;
      label(svg, x(14.1), y(0.98) + 4, 'Solar output', 'start', 'c-label');
      label(svg, x(24) - 4, y(LOAD) - 8, 'Site load ' + pct(LOAD), 'end', 'c-label');
      label(svg, x(12), y((1 + LOAD) / 2 - 0.06), 'Charging', 'middle', 'c-label');
      if (roomy) {
        label(svg, x(3), y(LOAD / 2) + 4, 'From batteries', 'middle', 'c-label');
        label(svg, x(21), y(LOAD / 2) + 4, 'From batteries', 'middle', 'c-label');
      }

      // crosshair
      cross = el('g', { 'aria-hidden': 'true', style: 'display:none' }, svg);
      el('line', { x1: 0, x2: 0, y1: m.t, y2: y(0), 'class': 'c-cross' }, cross);
      dotL = el('circle', { r: 5, cx: 0, cy: y(LOAD), 'class': 'c-dot c-dot--load' }, cross);
      dotS = el('circle', { r: 5, cx: 0, cy: 0, 'class': 'c-dot c-dot--solar' }, cross);

      var hit = el('rect', { x: m.l, y: m.t, width: pw, height: ph + m.b, 'class': 'c-hit' }, svg);
      hit.addEventListener('pointermove', function (e) {
        var r = svg.getBoundingClientRect();
        var px = (e.clientX - r.left) * (width / r.width);
        showAt((px - m.l) / pw * 24);
      });
      hit.addEventListener('pointerdown', function (e) {
        var r = svg.getBoundingClientRect();
        showAt(((e.clientX - r.left) * (width / r.width) - m.l) / pw * 24);
      });
      svg.addEventListener('pointerleave', hide);
      svg.addEventListener('focus', function () { if (current === null) showAt(12); });
      svg.addEventListener('blur', hide);
      svg.addEventListener('keydown', function (e) {
        var step = e.shiftKey ? 2 : 0.5;
        if (e.key === 'ArrowLeft') { e.preventDefault(); showAt((current === null ? 12 : current) - step); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); showAt((current === null ? 12 : current) + step); }
        else if (e.key === 'Escape') hide();
      });

      host.insertBefore(svg, host.firstChild);
      if (current !== null) showAt(current);
    }

    function row(parent, cls, name, value) {
      var r = document.createElement('div');
      r.className = 'tip__row';
      if (cls) {
        var k = document.createElement('span');
        k.className = 'tip__key';
        k.style.background = 'var(' + cls + ')';
        r.appendChild(k);
      }
      r.appendChild(document.createTextNode(name));
      var b = document.createElement('b');
      b.textContent = value;
      r.appendChild(b);
      parent.appendChild(r);
      return r;
    }

    function showAt(t) {
      t = Math.min(24, Math.max(0, Math.round(t / STEP) * STEP));
      current = t;
      var g = geom, s = solar(t), cx = g.x(t);
      cross.style.display = '';
      cross.setAttribute('transform', 'translate(' + cx + ' 0)');
      dotS.setAttribute('cy', g.y(s));

      if (!tip) {
        tip = document.createElement('div');
        tip.className = 'tip';
        tip.setAttribute('role', 'status');
        host.appendChild(tip);
      }
      tip.textContent = '';
      var time = document.createElement('div');
      time.className = 'tip__time';
      time.textContent = clock(t);
      tip.appendChild(time);
      row(tip, '--series-solar', 'Solar output', pct(s));
      row(tip, '--series-load', 'Site load', pct(LOAD));
      var st = document.createElement('div');
      st.className = 'tip__state';
      st.textContent = 'Batteries ' + battery(t);
      tip.appendChild(st);
      tip.hidden = false;

      var scale = host.clientWidth / g.width;
      var tw = tip.offsetWidth, left = cx * scale + 14;
      if (left + tw > host.clientWidth) left = cx * scale - tw - 14;
      if (left < 0) left = Math.max(0, Math.min(host.clientWidth - tw, cx * scale - tw / 2));
      tip.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(g.m.t + 6) + 'px)';
    }

    function hide() {
      current = null;
      if (cross) cross.style.display = 'none';
      if (tip) tip.hidden = true;
    }

    /* The same data as a table, for anyone who would rather read numbers. */
    function buildTable() {
      var wrap = document.getElementById('day-table');
      var btn = document.getElementById('day-table-toggle');
      if (!wrap || !btn) return;
      var table = document.createElement('table');
      var cap = document.createElement('caption');
      cap.textContent = 'Share of peak solar output, every two hours';
      table.appendChild(cap);
      var head = table.createTHead().insertRow();
      ['Time', 'Solar output', 'Site load', 'Batteries'].forEach(function (h, i) {
        var th = document.createElement('th');
        th.scope = 'col';
        th.textContent = h;
        if (i === 1 || i === 2) th.className = 'num';
        head.appendChild(th);
      });
      var body = table.createTBody();
      for (var t = 0; t <= 24; t += 2) {
        var r = body.insertRow();
        var th = document.createElement('th');
        th.scope = 'row';
        th.textContent = clock(t);
        r.appendChild(th);
        var c1 = r.insertCell(); c1.className = 'num'; c1.textContent = pct(solar(t));
        var c2 = r.insertCell(); c2.className = 'num'; c2.textContent = pct(LOAD);
        var c3 = r.insertCell();
        var txt = battery(t);
        c3.textContent = txt.charAt(0).toUpperCase() + txt.slice(1);
      }
      wrap.appendChild(table);
      btn.addEventListener('click', function () {
        var open = wrap.hidden;
        wrap.hidden = !open;
        btn.setAttribute('aria-expanded', String(open));
        btn.textContent = open ? 'Hide the numbers' : 'Show the numbers';
      });
    }

    render();
    buildTable();
    var lastW = host.clientWidth;
    var onResize = function () {
      if (Math.abs(host.clientWidth - lastW) < 2) return;
      lastW = host.clientWidth;
      render();
    };
    if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(host);
    else window.addEventListener('resize', onResize);
  })();

  /* ====================================================================
     2. Rack row
     The hardware is dark in both themes, so this palette is fixed and sits
     on the always-dark .racks background.
     ==================================================================== */
  (function () {
    var canvas = document.getElementById('racks');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var INK = '#F1F0EA', BODY = '#132338', SLED = '#1B3049', SLED_HI = '#243D5B';
    var COLD = '#6FDDEE', WARM = '#FFB347', OK = '#59E3A2';
    var w = 0, h = 0, dpr = 1, racks = [], visible = false, raf = 0, lastFlip = 0;

    /* Small repeatable random, so the lights look the same on every load. */
    var seed = 7;
    function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }

    function layout() {
      var r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      seed = 7;
      racks = [];
      var n = w < 420 ? 5 : w < 640 ? 6 : 8;
      var padX = Math.max(14, w * 0.035), gap = Math.max(5, w * 0.012);
      var top = h * 0.25, bottom = h * 0.88;
      var rw = (w - padX * 2 - gap * (n - 1)) / n;
      var sledH = Math.max(5, Math.min(9, (bottom - top) / 16));
      var rows = Math.floor((bottom - top - 10) / (sledH + 2.5));
      for (var i = 0; i < n; i++) {
        var sleds = [];
        for (var j = 0; j < rows; j++) {
          sleds.push({ on: rnd() > 0.08, warn: rnd() > 0.955, a: rnd() > 0.5, b: rnd() > 0.5 });
        }
        racks.push({ x: padX + i * (rw + gap), y: top, w: rw, h: bottom - top, sledH: sledH, sleds: sleds });
      }
    }

    function led(x, y, size, color, alpha) {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5 * dpr;
      ctx.fillRect(x, y, size, size);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    function draw(time) {
      if (!w || !h) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      var flow = reduce.matches ? 0 : time / 60;

      // overhead coolant pipes: supply (cold) and return (warm)
      var first = racks[0], last = racks[racks.length - 1];
      var pipeY = h * 0.105;
      [[COLD, pipeY, 1], [WARM, pipeY + Math.max(7, h * 0.05), -1]].forEach(function (p) {
        ctx.strokeStyle = p[0];
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 3;
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(0, p[1]); ctx.lineTo(w, p[1]); ctx.stroke();
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([10, 16]);
        ctx.lineDashOffset = -flow * p[2];
        ctx.beginPath(); ctx.moveTo(0, p[1]); ctx.lineTo(w, p[1]); ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // floor
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, first.y + first.h + 5.5); ctx.lineTo(w, first.y + first.h + 5.5); ctx.stroke();
      ctx.globalAlpha = 1;

      racks.forEach(function (r, i) {
        var mx = r.x + r.w - Math.max(7, r.w * 0.13); // manifold column
        // drops from the overhead pipes
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = COLD;
        ctx.beginPath(); ctx.moveTo(mx, pipeY); ctx.lineTo(mx, r.y); ctx.stroke();
        ctx.strokeStyle = WARM;
        ctx.beginPath(); ctx.moveTo(mx + 4, pipeY + Math.max(7, h * 0.05)); ctx.lineTo(mx + 4, r.y); ctx.stroke();
        ctx.globalAlpha = 1;

        // cabinet
        ctx.fillStyle = BODY;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = INK;
        ctx.globalAlpha = 0.34;
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        ctx.globalAlpha = 1;
        ctx.fillStyle = INK;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(r.x + 3, r.y + r.h, 4, 5);
        ctx.fillRect(r.x + r.w - 7, r.y + r.h, 4, 5);
        ctx.globalAlpha = 1;

        // manifolds inside the cabinet
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = COLD;
        ctx.beginPath(); ctx.moveTo(mx, r.y); ctx.lineTo(mx, r.y + r.h - 5); ctx.stroke();
        ctx.strokeStyle = WARM;
        ctx.beginPath(); ctx.moveTo(mx + 4, r.y); ctx.lineTo(mx + 4, r.y + r.h - 5); ctx.stroke();
        ctx.globalAlpha = 1;

        // servers
        var sx = r.x + 4, sw = mx - 4 - sx;
        r.sleds.forEach(function (s, j) {
          var sy = r.y + 6 + j * (r.sledH + 2.5);
          ctx.fillStyle = s.on ? SLED : BODY;
          ctx.fillRect(sx, sy, sw, r.sledH);
          if (!s.on) {
            ctx.strokeStyle = INK; ctx.globalAlpha = 0.14; ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, r.sledH - 1); ctx.globalAlpha = 1;
            return;
          }
          ctx.fillStyle = SLED_HI;
          ctx.fillRect(sx + sw * 0.34, sy + 1.5, sw * 0.4, Math.max(1, r.sledH - 3));
          var d = Math.max(2, Math.min(3, r.sledH - 3)), ly = sy + (r.sledH - d) / 2;
          led(sx + 3, ly, d, s.warn ? WARM : OK, 1);
          if (sw > 34) {
            led(sx + sw - d - 3, ly, d, COLD, s.a ? 1 : 0.22);
            led(sx + sw - d * 2 - 6, ly, d, COLD, s.b ? 1 : 0.22);
          }
          // stub to the manifold
          ctx.strokeStyle = COLD; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(sx + sw, sy + r.sledH / 2); ctx.lineTo(mx, sy + r.sledH / 2); ctx.stroke();
          ctx.globalAlpha = 1;
        });

        // rack number
        if (r.w > 44 && h > 170) {
          ctx.fillStyle = INK;
          ctx.globalAlpha = 0.62;
          ctx.font = '600 10px Archivo, Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText('R' + (i < 9 ? '0' : '') + (i + 1), r.x, r.y - 6);
          ctx.globalAlpha = 1;
        }
      });
    }

    function tick(time) {
      raf = 0;
      if (time - lastFlip > 110) {
        lastFlip = time;
        racks.forEach(function (r) {
          r.sleds.forEach(function (s) {
            if (Math.random() < 0.16) s.a = !s.a;
            if (Math.random() < 0.1) s.b = !s.b;
          });
        });
      }
      draw(time);
      if (visible && !reduce.matches && !document.hidden) raf = requestAnimationFrame(tick);
    }
    function start() { if (!raf && visible && !reduce.matches) raf = requestAnimationFrame(tick); }

    layout();
    draw(0);
    if ('ResizeObserver' in window) new ResizeObserver(function () { layout(); draw(performance.now()); }).observe(canvas);
    else window.addEventListener('resize', function () { layout(); draw(performance.now()); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; start(); }, { rootMargin: '80px' }).observe(canvas);
    } else { visible = true; start(); }
    document.addEventListener('visibilitychange', start);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { draw(performance.now()); });
  })();
})();
