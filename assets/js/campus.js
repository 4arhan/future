/* Farfield — the site plan in the hero.
   An isometric drawing of one plot: solar array, battery yard, substation,
   data hall, EV canopy, robotics cell and academy, joined by power cables.

   It follows the page theme. Day: the array tracks the sun, feeds every
   building and charges the batteries. Night: the array stows flat and the
   batteries carry the load. Switching theme plays a short dusk or dawn.

   World units: x runs down-right, y runs down-left, z is up. One unit is
   roughly four meters. Everything is drawn back to front. */
(function () {
  'use strict';

  var canvas = document.getElementById('campus');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var stage = canvas.parentElement;
  var list = document.getElementById('callouts');
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqDark = window.matchMedia('(prefers-color-scheme: dark)');

  var W = 24, D = 30;                       // plot size
  var COS = Math.cos(Math.PI / 6), SIN = 0.5;
  var RX = 1.2247, RY = 0.7071;             // a ground circle projects to this ellipse
  var TAU = Math.PI * 2;
  var s = 18, ox = 0, oy = 0, cw = 0, ch = 0, dpr = 1, compact = false;

  function P(x, y, z) { return [ox + (x - y) * COS * s, oy + (x + y) * SIN * s - (z || 0) * s]; }

  /* ---------- color ---------- */
  function hx(h, a) {
    return [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16), a === undefined ? 1 : a];
  }
  var DAY = {
    ground: hx('#F7F9FA'), field: hx('#E2EBDD'), pad: hx('#E7ECF0'), road: hx('#D2D9E0'), mark: hx('#FFFFFF', 0.95),
    slabS: hx('#BCC7D2'), slabE: hx('#D3DBE3'), under: hx('#0C1A2B', 0.2),
    edge: hx('#0C1A2B', 0.46), edgeSoft: hx('#0C1A2B', 0.17),
    top: hx('#FFFFFF'), east: hx('#EBEFF3'), south: hx('#CDD6DF'),
    glass: hx('#8FBAD6'), win: hx('#A9CADF'), strip: hx('#19A7C2'),
    panel: hx('#27468A'), panelHi: hx('#4470CC'), panelBack: hx('#16284F'), panelLine: hx('#FFFFFF', 0.3),
    steel: hx('#8D9AA9'), dark: hx('#1D2B3F'),
    accent: hx('#FF9F1C'), signal: hx('#19A7C2'), ok: hx('#2FB37A'),
    robot: hx('#FF8A1F'), robotDark: hx('#B8590B'),
    tree: hx('#8FBD9D'), treeDark: hx('#6BA182'), trunk: hx('#7B6C5C'),
    car: hx('#FFFFFF'), carDark: hx('#C6D0D9'),
    shadow: hx('#0C1A2B', 1), label: hx('#0C1A2B', 0.42), cable: hx('#0C1A2B', 0.2),
    pin: hx('#0C1A2B'), pinText: hx('#FFFFFF')
  };
  var NIGHT = {
    ground: hx('#111C30'), field: hx('#0F2230'), pad: hx('#16233B'), road: hx('#0B1525'), mark: hx('#5A6E96', 0.55),
    slabS: hx('#0A1322'), slabE: hx('#0E192C'), under: hx('#000000', 0.5),
    edge: hx('#9DB9E6', 0.36), edgeSoft: hx('#9DB9E6', 0.14),
    top: hx('#22314F'), east: hx('#1B2944'), south: hx('#141F36'),
    glass: hx('#7BE3F2'), win: hx('#FFD18A'), strip: hx('#7BE3F2'),
    panel: hx('#12244E'), panelHi: hx('#1A3166'), panelBack: hx('#0B1630'), panelLine: hx('#8CAAFF', 0.22),
    steel: hx('#3D4D6A'), dark: hx('#060B15'),
    accent: hx('#FFB347'), signal: hx('#6FDDEE'), ok: hx('#59E3A2'),
    robot: hx('#FF9638'), robotDark: hx('#A8571A'),
    tree: hx('#1E4141'), treeDark: hx('#153133'), trunk: hx('#2A303B'),
    car: hx('#2C3D5E'), carDark: hx('#1D2A45'),
    shadow: hx('#000000', 1), label: hx('#F1F0EA', 0.46), cable: hx('#9DB9E6', 0.22),
    pin: hx('#F1F0EA'), pinText: hx('#0A1220')
  };
  var KEYS = Object.keys(DAY);
  var C = {}, S = {}, blended = -1;

  function str(c, m) {
    return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (c[3] * (m === undefined ? 1 : m)).toFixed(3) + ')';
  }
  function setPalette(n) {
    if (Math.abs(n - blended) < 0.002) return false;
    blended = n;
    for (var i = 0; i < KEYS.length; i++) {
      var k = KEYS[i], a = DAY[k], b = NIGHT[k];
      C[k] = [a[0] + (b[0] - a[0]) * n, a[1] + (b[1] - a[1]) * n, a[2] + (b[2] - a[2]) * n, a[3] + (b[3] - a[3]) * n];
      S[k] = str(C[k]);
    }
    return true;
  }
  function A(k, m) { return str(C[k], m); }
  function mix(k1, k2, f) {
    var a = C[k1], b = C[k2];
    return str([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f]);
  }

  /* ---------- small math ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, f) { return a + (b - a) * f; }
  function ease(f) { f = clamp(f, 0, 1); return f * f * (3 - 2 * f); }
  function easeOut(f) { f = clamp(f, 0, 1); return 1 - Math.pow(1 - f, 3); }
  function smooth(a, b, v) { return ease((v - a) / (b - a)); }
  var seed = 11;
  function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }

  /* ---------- drawing primitives ---------- */
  function trace(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  function fill(pts, color, stroke, lw) {
    trace(pts);
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function seg(a, b, color, lw) {
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    ctx.strokeStyle = color; ctx.lineWidth = lw || 1; ctx.stroke();
  }
  function rectG(x, y, w, d, z) { return [P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)]; }
  /* A rectangle on a wall that faces +y ("south") or +x ("east"). */
  function wallS(x0, x1, y, z0, z1, color, stroke) { fill([P(x0, y, z1), P(x1, y, z1), P(x1, y, z0), P(x0, y, z0)], color, stroke); }
  function wallE(x, y0, y1, z0, z1, color, stroke) { fill([P(x, y0, z1), P(x, y1, z1), P(x, y1, z0), P(x, y0, z0)], color, stroke); }

  function box(x, y, z, w, d, h, top, east, south, edge) {
    var a = P(x, y, z + h), b = P(x + w, y, z + h), c = P(x + w, y + d, z + h), e = P(x, y + d, z + h);
    var b0 = P(x + w, y, z), c0 = P(x + w, y + d, z), e0 = P(x, y + d, z);
    fill([e, c, c0, e0], south, edge);
    fill([b, c, c0, b0], east, edge);
    fill([a, b, c, e], top, edge);
  }
  function house(x, y, z, w, d, h) { box(x, y, z, w, d, h, S.top, S.east, S.south, S.edge); }

  function ellipse(p, r) { ctx.beginPath(); ctx.ellipse(p[0], p[1], r * s * RX, r * s * RY, 0, 0, TAU); }
  function cyl(x, y, z, r, h, top, side, edge) {
    var pb = P(x, y, z), pt = P(x, y, z + h), rx = r * s * RX, ry = r * s * RY;
    ctx.beginPath();
    ctx.moveTo(pt[0] - rx, pt[1]);
    ctx.lineTo(pb[0] - rx, pb[1]);
    ctx.ellipse(pb[0], pb[1], rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(pt[0] + rx, pt[1]);
    ctx.closePath();
    ctx.fillStyle = side; ctx.fill();
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.beginPath(); ctx.ellipse(pt[0], pt[1], rx, ry, 0, 0, TAU);
    ctx.fillStyle = top; ctx.fill();
    if (edge) ctx.stroke();
  }
  function dot(p, r, color) { ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fillStyle = color; ctx.fill(); }

  /* Light that adds to what is under it. Only used after dark. */
  function glow(p, r, key, a) {
    if (night < 0.02 || a <= 0) return;
    var g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
    g.addColorStop(0, A(key, a * night));
    g.addColorStop(1, A(key, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, TAU); ctx.fill();
    ctx.restore();
  }
  /* A pool of light lying on the ground. */
  function pool(x, y, r, key, a) {
    if (night < 0.02) return;
    var p = P(x, y, 0);
    ctx.save();
    ctx.translate(p[0], p[1]);
    ctx.scale(RX, RY);
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * s);
    g.addColorStop(0, A(key, a * night));
    g.addColorStop(1, A(key, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r * s, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* Lettering that lies on a wall or on the ground. */
  function letter(plane, x, y, z, text, size, color, align) {
    if (compact) return;
    var p = P(x, y, z), k = s * size / 10;
    ctx.save();
    if (plane === 'S') ctx.transform(COS * k, SIN * k, 0, k, p[0], p[1]);
    else if (plane === 'E') ctx.transform(COS * k, -SIN * k, 0, k, p[0], p[1]);
    else ctx.transform(COS * k, SIN * k, -COS * k, SIN * k, p[0], p[1]);
    ctx.font = '700 10px Archivo, "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  /* ---------- time of day ---------- */
  var SUN = [0.55, -0.38, 0.74];            // direction to the sun by day
  var KX = -SUN[0] / SUN[2], KY = -SUN[1] / SUN[2];   // where a shadow lands, per unit of height
  var PHI_DAY = Math.atan2(SUN[0], SUN[2]); // tracker tilt that faces the sun
  var night = 0, phi = PHI_DAY, shLen = 1, shAlpha = 1;
  var trans = null;                         // running dusk or dawn
  var TRANS_MS = 2400;

  function wantNight() {
    if (window.FF && window.FF.isDark) return window.FF.isDark();
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : mqDark.matches;
  }
  function settle(isNight) {
    night = isNight ? 1 : 0;
    phi = isNight ? 0 : PHI_DAY;
    shLen = 1;
    shAlpha = isNight ? 0 : 1;
    trans = null;
  }
  function stepTransition(ms) {
    if (!trans) return;
    var u = clamp((ms - trans.start) / TRANS_MS, 0, 1);
    if (trans.toNight) {
      // dusk: panels follow the sun down, shadows stretch and fade, then the array stows flat
      phi = u < 0.45 ? lerp(PHI_DAY, 0.96, ease(u / 0.45)) : lerp(0.96, 0, ease((u - 0.45) / 0.55));
      shLen = 1 + 2.4 * ease(u / 0.5);
      shAlpha = 1 - smooth(0.08, 0.55, u);
      night = smooth(0.12, 0.88, u);
    } else {
      // dawn: the array wakes facing east, then swings round to follow the sun
      phi = u < 0.3 ? lerp(0, -0.72, ease(u / 0.3)) : lerp(-0.72, PHI_DAY, ease((u - 0.3) / 0.7));
      shLen = 1 + 2.2 * (1 - ease(u));
      shAlpha = smooth(0.4, 1, u);
      night = 1 - smooth(0.04, 0.7, u);
    }
    if (u >= 1) settle(trans.toNight);
  }
  function onTheme() {
    var n = wantNight();
    var current = trans ? trans.toNight : night > 0.5;
    if (n === current) return;
    if (reduce.matches || !visible) { settle(n); requestDraw(); return; }
    trans = { toNight: n, start: performance.now() };
    start();
  }

  /* ---------- build-in ---------- */
  var born = performance.now(), built = false, T = 0;
  function grow(delay) {
    if (built) return 1;
    return easeOut(((performance.now() - born) / 1000 - delay * 0.72) / 0.6);
  }

  /* ---------- cables ---------- */
  var CABLES = [
    [[1.4, 16.6], [13.95, 16.6]], [[1.4, 22.6], [13.95, 22.6]],
    [[13.95, 28.2], [13.95, 8.05]], [[13.95, 10.2], [23.45, 10.2]],
    [[13.95, 8.05], [4.0, 8.05]], [[17.0, 10.2], [17.0, 7.45]],
    [[19.35, 10.2], [19.35, 15.6]], [[23.45, 10.2], [23.45, 18.7], [22.6, 18.7]],
    [[13.95, 28.2], [16.75, 28.2]], [[8.8, 8.05], [8.8, 7.3]], [[4.0, 8.05], [4.0, 4.9]]
  ];
  var ROUTES_DAY = [
    [[1.4, 16.6], [13.95, 16.6], [13.95, 10.2], [17.0, 10.2], [17.0, 7.45]],
    [[1.4, 22.6], [13.95, 22.6], [13.95, 10.2], [19.35, 10.2], [19.35, 15.6]],
    [[1.4, 16.6], [13.95, 16.6], [13.95, 10.2], [23.45, 10.2], [23.45, 18.7], [22.6, 18.7]],
    [[1.4, 22.6], [13.95, 22.6], [13.95, 28.2], [16.75, 28.2]],
    [[6.5, 16.6], [13.95, 16.6], [13.95, 8.05], [8.8, 8.05], [8.8, 7.3]],
    [[6.5, 22.6], [13.95, 22.6], [13.95, 8.05], [4.0, 8.05], [4.0, 4.9]]
  ];
  var ROUTES_NIGHT = [
    [[19.35, 15.6], [19.35, 10.2], [17.0, 10.2], [17.0, 7.45]],
    [[19.35, 15.6], [19.35, 10.2], [13.95, 10.2], [13.95, 28.2], [16.75, 28.2]],
    [[19.35, 15.6], [19.35, 10.2], [13.95, 10.2], [13.95, 8.05], [8.8, 8.05], [8.8, 7.3]],
    [[19.35, 15.6], [19.35, 10.2], [13.95, 10.2], [13.95, 8.05], [4.0, 8.05], [4.0, 4.9]]
  ];
  function measure(route) {
    var len = [0];
    for (var i = 1; i < route.length; i++) len.push(len[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
    return { pts: route, len: len, total: len[len.length - 1] };
  }
  function along(r, d) {
    d = clamp(d, 0, r.total);
    for (var i = 1; i < r.pts.length; i++) {
      if (d <= r.len[i] || i === r.pts.length - 1) {
        var f = (d - r.len[i - 1]) / (r.len[i] - r.len[i - 1] || 1), a = r.pts[i - 1], b = r.pts[i];
        return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
      }
    }
    return r.pts[0];
  }
  var routesDay = ROUTES_DAY.map(measure), routesNight = ROUTES_NIGHT.map(measure);

  function drawCables() {
    var g = grow(0.9);
    if (g <= 0) return;
    ctx.save();
    ctx.globalAlpha = g;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = S.cable;
    ctx.lineWidth = Math.max(1, s * 0.07);
    ctx.setLineDash([s * 0.16, s * 0.16]);
    CABLES.forEach(function (c) {
      ctx.beginPath();
      c.forEach(function (pt, i) { var p = P(pt[0], pt[1], 0.01); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.stroke();
    });
    ctx.setLineDash([]);
    pulses(routesDay, 'accent', 1 - night);
    pulses(routesNight, 'signal', night);
    ctx.restore();
  }
  function pulses(routes, key, amount) {
    if (amount < 0.03) return;
    var speed = 3.4, gap = 6.5, tail = 0.9;
    ctx.lineCap = 'round';
    routes.forEach(function (r, ri) {
      var n = Math.ceil(r.total / gap) + 1, off = (T * speed + ri * 2.3) % gap;
      for (var i = -1; i < n; i++) {
        var d = i * gap + off;
        if (d < 0 || d > r.total) continue;
        var fade = Math.min(1, d / 1.2, (r.total - d) / 0.8) * amount;
        var a = along(r, d - tail), m = along(r, d - tail / 2), b = along(r, d);
        var pa = P(a[0], a[1], 0.02), pm = P(m[0], m[1], 0.02), pb = P(b[0], b[1], 0.02);
        ctx.strokeStyle = A(key, 0.55 * fade);
        ctx.lineWidth = Math.max(1.5, s * 0.11);
        ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pm[0], pm[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
        dot(pb, Math.max(1.6, s * 0.1), A(key, fade));
        glow(pb, s * 0.55, key, 0.5 * fade);
      }
    });
  }

  /* ---------- ground (cached between frames) ---------- */
  var bg = document.createElement('canvas'), bgDirty = true;
  function renderGround() {
    var main = ctx;
    bg.width = canvas.width; bg.height = canvas.height;
    ctx = bg.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineJoin = 'round';
    var TH = 0.85;

    // the plot is a slab; a soft shadow lifts it off the page
    ctx.save();
    ctx.shadowColor = S.under;
    ctx.shadowBlur = 34 * dpr;
    ctx.shadowOffsetY = 20 * dpr;
    fill([P(0, 0, -TH), P(W, 0, -TH), P(W, D, -TH), P(0, D, -TH)], S.slabS);
    ctx.restore();
    fill([P(0, D, 0), P(W, D, 0), P(W, D, -TH), P(0, D, -TH)], S.slabS, S.edgeSoft);
    fill([P(W, 0, 0), P(W, D, 0), P(W, D, -TH), P(W, 0, -TH)], S.slabE, S.edgeSoft);
    seg(P(0, D, -TH * 0.42), P(W, D, -TH * 0.42), S.edgeSoft);
    seg(P(W, 0, -TH * 0.42), P(W, D, -TH * 0.42), S.edgeSoft);
    fill(rectG(0, 0, W, D, 0), S.ground, A('edge', 0.62));

    // surfaces
    fill(rectG(1, 10.6, 12.6, 18.6, 0), S.field, S.edgeSoft);
    fill(rectG(16.4, 10.6, 6.6, 5.6, 0), S.pad, S.edgeSoft);
    fill(rectG(16.4, 17.0, 6.6, 3.4, 0), S.pad, S.edgeSoft);
    fill(rectG(7.2, 2.0, 3.2, 5.6, 0), S.pad, S.edgeSoft);
    fill(rectG(1.5, 4.8, 5.0, 3.0, 0), S.pad, S.edgeSoft);
    fill(rectG(11.2, 7.4, 11.8, 0.6, 0), S.pad);
    fill(rectG(0, 8.4, W, 1.4, 0), S.road);
    fill(rectG(14.4, 9.8, 1.2, D - 9.8, 0), S.road);

    // road markings
    ctx.save();
    ctx.strokeStyle = S.mark;
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.setLineDash([s * 0.45, s * 0.45]);
    var a = P(0.3, 9.1, 0), b = P(W - 0.3, 9.1, 0);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    a = P(15.0, 10.1, 0); b = P(15.0, D - 0.3, 0);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.restore();

    // parking bays under the EV canopy
    [2.4, 4.0, 5.6, 7.2].forEach(function (y) { seg(P(7.5, y, 0), P(10.1, y, 0), S.mark, Math.max(1, s * 0.05)); });

    // robotics cell floor with a hazard border
    fill(rectG(16.4, 21.4, 6.8, 7.8, 0), S.pad, S.edgeSoft);
    ctx.save();
    ctx.setLineDash([s * 0.3, s * 0.22]);
    fill(rectG(16.75, 21.75, 6.1, 5.3, 0), null, A('accent', 0.9), Math.max(1.2, s * 0.07));
    ctx.restore();

    // scale bar, as on any site plan
    if (!compact) {
      var y0 = 29.55, x0 = 17.4, col = S.label;
      seg(P(x0, y0, 0), P(x0 + 5, y0, 0), col, 1.2);
      [0, 2.5, 5].forEach(function (dx) { seg(P(x0 + dx, y0 - 0.14, 0), P(x0 + dx, y0 + 0.14, 0), col, 1.2); });
      letter('G', x0 + 5.25, y0 + 0.16, 0, '20 m', 0.42, col);
      letter('G', x0 - 0.5, y0 + 0.16, 0, '0', 0.42, col);
    }
    ctx = main;
    bgDirty = false;
  }

  /* ---------- shadows ---------- */
  var sh = document.createElement('canvas'), shx = sh.getContext('2d');
  var kx = KX, ky = KY;
  function shadowBox(x, y, w, d, h) {
    var ax = h * kx, ay = h * ky;
    shadePoly([P(x, y, 0), P(x + w, y, 0), P(x + w, y + d, 0), P(x + w + ax, y + d + ay, 0), P(x + ax, y + d + ay, 0), P(x + ax, y + ay, 0)]);
  }
  function shadePoly(pts) {
    shx.beginPath();
    shx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) shx.lineTo(pts[i][0], pts[i][1]);
    shx.closePath();
    shx.fill();
  }
  function shadePt(p) { return P(p[0] + p[2] * kx, p[1] + p[2] * ky, 0); }
  function shadeLine(pts, width) {
    shx.lineWidth = width; shx.lineCap = 'round'; shx.lineJoin = 'round';
    shx.beginPath();
    pts.forEach(function (p, i) { var q = shadePt(p); if (i) shx.lineTo(q[0], q[1]); else shx.moveTo(q[0], q[1]); });
    shx.stroke();
  }
  function shadeDisc(x, y, z, r) {
    var p = P(x + z * kx, y + z * ky, 0);
    shx.beginPath(); shx.ellipse(p[0], p[1], r * s * RX, r * s * RY, 0, 0, TAU); shx.fill();
  }

  /* ---------- the plot ---------- */
  var HALL = { x: 11.2, y: 1.5, w: 11.8, d: 5.9, h: 2.8 };
  var ACAD = { x: 1.5, y: 1.6, w: 5.0, d: 3.2, h: 1.7 };
  var CELL = { xB: 18.3, xA: 21.2, beltY: 22.7, baseY: 24.3 };
  var CYCLE = 3.8;                           // seconds for one robot cycle
  var TREES = [
    [0.55, 11.2, 0.5], [0.5, 13.7, 0.42], [0.6, 16.3, 0.52], [0.5, 19.2, 0.44], [0.6, 21.9, 0.5], [0.5, 24.7, 0.44], [0.6, 27.5, 0.5],
    [0.7, 0.8, 0.5], [2.5, 0.7, 0.42], [4.5, 0.65, 0.5], [6.6, 0.8, 0.44], [0.6, 3.0, 0.46], [0.6, 5.4, 0.5], [0.7, 7.4, 0.42],
    [8.1, 1.0, 0.46], [9.9, 1.05, 0.5], [23.45, 21.6, 0.42], [23.5, 24.4, 0.48], [23.45, 27.2, 0.42]
  ];
  var LAMPS = [[2.6, 8.22], [7.0, 8.22], [11.4, 8.22], [18.0, 8.22], [22.4, 8.22], [15.78, 13.4], [15.78, 19.0], [15.78, 25.6]];
  var PEOPLE = [
    // academy yard: one instructor in a white helmet, trainees around the practice array
    [3.75, 6.95, 1], [2.35, 7.25, 0], [3.0, 7.5, 0], [4.45, 7.4, 0], [5.0, 6.95, 0], [5.75, 6.75, 0], [6.1, 6.2, 0],
    // technicians at work
    [16.9, 16.0, 0], [12.6, 7.75, 1], [17.55, 28.55, 0], [22.3, 20.0, 0]
  ];
  var ZONES = {
    pv: { r: [1, 10.6, 12.6, 18.6], h: 1.2, at: [6.4, 20.4, 1.1], up: 2.3 },
    bess: { r: [16.4, 10.6, 6.6, 5.6], h: 1.1, at: [19.35, 13.2, 1.05], up: 1.9 },
    ev: { r: [7.2, 2.0, 3.2, 5.6], h: 1.7, at: [9.5, 3.5, 1.6], up: 2.0 },
    hall: { r: [11.2, 1.5, 11.8, 5.9], h: 3.3, at: [17.6, 4.4, 3.25], up: 1.35 },
    robot: { r: [16.4, 21.4, 6.8, 7.8], h: 1.6, at: [19.75, 24.9, 2.0], up: 1.9 },
    academy: { r: [1.5, 1.6, 5.0, 6.2], h: 1.7, at: [3.2, 3.0, 1.7], up: 1.8 }
  };

  function tree(x, y, r, g) {
    if (g <= 0) return;
    var hgt = (0.42 + r * 1.05) * g, p0 = P(x, y, 0), p1 = P(x, y, hgt);
    seg(p0, P(x, y, 0.5 * g), S.trunk, Math.max(1, s * 0.07));
    var rr = r * s * g * 1.02;
    ctx.beginPath(); ctx.arc(p1[0], p1[1], rr, 0, TAU); ctx.fillStyle = S.treeDark; ctx.fill();
    ctx.beginPath(); ctx.arc(p1[0] + rr * 0.2, p1[1] - rr * 0.2, rr * 0.74, 0, TAU); ctx.fillStyle = S.tree; ctx.fill();
  }

  function person(x, y, lead) {
    var p = P(x, y, 0), u = s * 0.105;
    if (u < 1.1) { dot([p[0], p[1] - 2], 1.3, lead ? S.top : S.accent); return; }
    ctx.lineCap = 'round';
    seg(p, [p[0], p[1] - u * 1.7], S.dark, u * 0.95);
    seg([p[0], p[1] - u * 1.9], [p[0], p[1] - u * 3.1], S.accent, u * 1.55);
    dot([p[0], p[1] - u * 4.05], u * 0.82, lead ? S.top : S.accent);
    ctx.lineCap = 'butt';
  }

  function lamp(x, y) {
    var top = P(x, y, 1.55), head = P(x + 0.28, y + 0.28, 1.55);
    seg(P(x, y, 0), top, S.steel, Math.max(1, s * 0.05));
    seg(top, head, S.steel, Math.max(1, s * 0.05));
    if (night > 0.02) {
      pool(x + 0.5, y + 0.5, 1.9, 'win', 0.2);
      dot(head, Math.max(1.3, s * 0.07), A('win', night));
      glow(head, s * 0.5, 'win', 0.55);
    }
  }

  /* One tracker table: a long panel turning on a north-south tube. */
  function pvTable(x, y0, y1, g) {
    if (g <= 0) return;
    var zc = 0.66 * g, hw = 0.74;
    var cs = Math.cos(phi), sn = Math.sin(phi);
    var xl = x - hw * cs, zl = zc + hw * sn, xr = x + hw * cs, zr = zc - hw * sn;
    var lw = Math.max(1, s * 0.05), yy;

    ctx.strokeStyle = S.steel; ctx.lineWidth = lw;
    ctx.beginPath();
    for (yy = y0 + 0.45; yy < y1; yy += 1.5) {
      var a = P(x, yy, 0), b = P(x, yy, zc);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.stroke();

    var q = [P(xl, y0, zl), P(xr, y0, zr), P(xr, y1, zr), P(xl, y1, zl)];
    if (sn + cs <= 0.06) { fill(q, S.panelBack, S.edge); return; }   // we are looking at the back of the glass
    var lit = clamp(sn * SUN[0] + cs * SUN[2], 0, 1) * (1 - night);
    fill(q, mix('panel', 'panelHi', lit * lit));

    if (!compact) {
      ctx.strokeStyle = S.panelLine; ctx.lineWidth = 1;
      ctx.beginPath();
      for (yy = y0 + 0.6; yy < y1 - 0.2; yy += 0.6) {
        var c = P(xl, yy, zl), e = P(xr, yy, zr);
        ctx.moveTo(c[0], c[1]); ctx.lineTo(e[0], e[1]);
      }
      var m0 = P(x, y0, zc), m1 = P(x, y1, zc);
      ctx.moveTo(m0[0], m0[1]); ctx.lineTo(m1[0], m1[1]);
      ctx.stroke();
    }
    trace(q); ctx.strokeStyle = S.edge; ctx.lineWidth = 1; ctx.stroke();
    // the raised edge catches the light
    if (lit > 0.3) seg(q[0], q[3], A('top', 0.75 * lit), Math.max(1, s * 0.06));
  }
  function pvShadow(x, y0, y1, g) {
    var zc = 0.66 * g, hw = 0.74, cs = Math.cos(phi), sn = Math.sin(phi);
    var l = [x - hw * cs, zc + hw * sn], r = [x + hw * cs, zc - hw * sn];
    shadePoly([shadePt([l[0], y0, l[1]]), shadePt([r[0], y0, r[1]]), shadePt([r[0], y1, r[1]]), shadePt([l[0], y1, l[1]])]);
  }

  function bessUnit(x, y, i, g) {
    if (g <= 0) return;
    var z = (1 - g) * 2.4, w = 2.4, d = 0.95, h = 1.05, f = y + d;
    ctx.globalAlpha = clamp(g * 1.6, 0, 1);
    house(x, y, z, w, d, h);
    wallS(x, x + w, f, z, z + 0.1, S.accent);
    // state of charge: fills by day, drains at night
    var charge = clamp(lerp(0.5 + 0.34 * Math.sin(T * 0.35 + i * 0.7), 0.42 + 0.26 * Math.sin(T * 0.3 + i), night), 0.08, 1);
    wallS(x + 0.25, x + 1.45, f, z + 0.6, z + 0.76, S.dark);
    wallS(x + 0.25, x + 0.25 + 1.2 * charge, f, z + 0.6, z + 0.76, S.ok);
    if (!compact) {
      for (var k = 0; k < 4; k++) seg(P(x + 1.7 + k * 0.15, f, z + 0.3), P(x + 1.7 + k * 0.15, f, z + 0.82), S.edgeSoft);
      seg(P(x + w, y + d / 2, z + 0.06), P(x + w, y + d / 2, z + h - 0.06), S.edgeSoft);
    }
    glow(P(x + 0.85, f, z + 0.68), s * 0.75, 'ok', 0.35);
    ctx.globalAlpha = 1;
  }

  function dataHall(g) {
    if (g <= 0) return;
    var H = HALL, h = H.h * g, x1 = H.x + H.w, y1 = H.y + H.d, i;
    pool(H.x + H.w * 0.5, y1 + 0.9, 5.2, 'strip', 0.13);
    house(H.x, H.y, 0, H.w, H.d, h);

    // south wall: cladding joints, entrance, lettering and a light strip under the eaves
    if (!compact) for (i = 1; i < 10; i++) seg(P(H.x + i * H.w / 10, y1, 0), P(H.x + i * H.w / 10, y1, h), S.edgeSoft);
    wallS(H.x + 0.7, H.x + 2.1, y1, 0, Math.min(h, 1.25), S.glass, S.edge);
    seg(P(H.x + 1.4, y1, 0), P(H.x + 1.4, y1, Math.min(h, 1.25)), S.edge);
    if (h > 2.4) {
      wallS(H.x + 0.3, x1 - 0.3, y1, h - 0.52, h - 0.38, S.strip);
      letter('S', H.x + 3.2, y1, 0.95, 'DATA HALL 01', 0.62, A('label', 0.9));
      if (night > 0.02) {
        ctx.save();
        ctx.shadowColor = A('strip', night); ctx.shadowBlur = 12 * dpr;
        wallS(H.x + 0.3, x1 - 0.3, y1, h - 0.52, h - 0.38, A('strip', night));
        ctx.restore();
      }
    }
    glow(P(H.x + 1.4, y1, 0.6), s * 1.5, 'glass', 0.45);

    // east wall: two dock doors and louvres
    [[2.2, 3.5], [4.0, 5.3]].forEach(function (dk) {
      wallE(x1, H.y + dk[0], H.y + dk[1], 0, Math.min(h, 1.45), S.south, S.edge);
      if (!compact) for (var k = 1; k < 4; k++) seg(P(x1, H.y + dk[0], k * 0.36 * g), P(x1, H.y + dk[1], k * 0.36 * g), S.edgeSoft);
    });
    if (h > 2.4 && !compact) for (i = 0; i < 3; i++) seg(P(x1, H.y + 0.5, h - 0.4 - i * 0.14), P(x1, y1 - 0.5, h - 0.4 - i * 0.14), S.edgeSoft);

    if (g < 0.98) return;
    // roof: parapet line, coolant pipes and two rows of cooling units with fans
    fill(rectG(H.x + 0.22, H.y + 0.22, H.w - 0.44, H.d - 0.44, h), null, S.edgeSoft);
    seg(P(H.x + 0.7, H.y + 2.85, h + 0.1), P(x1 - 0.7, H.y + 2.85, h + 0.1), S.signal, Math.max(1, s * 0.07));
    seg(P(H.x + 0.7, H.y + 3.1, h + 0.1), P(x1 - 0.7, H.y + 3.1, h + 0.1), S.accent, Math.max(1, s * 0.07));
    [0.55, 3.85].forEach(function (ry, row) {
      for (var u = 0; u < 6; u++) {
        var ux = H.x + 0.75 + u * 1.82, uy = H.y + ry;
        box(ux, uy, h, 1.3, 1.5, 0.42, S.top, S.east, S.south, S.edge);
        var c = P(ux + 0.65, uy + 0.75, h + 0.42);
        ellipse(c, 0.44); ctx.fillStyle = S.south; ctx.fill(); ctx.strokeStyle = S.edge; ctx.lineWidth = 1; ctx.stroke();
        if (!compact) {
          var ang = T * 5 + u + row;
          ctx.beginPath();
          for (var b = 0; b < 3; b++) {
            var q = P(ux + 0.65 + Math.cos(ang + b * TAU / 3) * 0.4, uy + 0.75 + Math.sin(ang + b * TAU / 3) * 0.4, h + 0.42);
            ctx.moveTo(c[0], c[1]); ctx.lineTo(q[0], q[1]);
          }
          ctx.strokeStyle = S.edge; ctx.stroke();
        }
        if ((u + row) % 3 === 0) {
          var on = Math.sin(T * 2.2 + u * 1.7 + row) > 0;
          glow(P(ux + 1.3, uy + 1.5, h + 0.3), s * 0.4, 'signal', on ? 0.8 : 0.15);
        }
      }
    });
  }

  function academy(g) {
    if (g <= 0) return;
    var B = ACAD, h = B.h * g, x1 = B.x + B.w, y1 = B.y + B.d;
    pool(B.x + 2.6, y1 + 1.2, 3.2, 'win', 0.16);
    house(B.x, B.y, 0, B.w, B.d, h);
    if (h < 1.5) return;
    // south wall: windows either side of a door, and the sign
    wallS(B.x + 0.35, B.x + 1.75, y1, 0.55, 1.2, S.win, S.edge);
    wallS(B.x + 3.15, B.x + 4.65, y1, 0.55, 1.2, S.win, S.edge);
    wallS(B.x + 2.05, B.x + 2.85, y1, 0, 1.15, S.glass, S.edge);
    wallS(B.x, x1, y1, h - 0.16, h, S.accent);
    wallE(x1, B.y + 0.5, B.y + 1.4, 0.55, 1.2, S.win, S.edge);
    wallE(x1, B.y + 1.8, B.y + 2.7, 0.55, 1.2, S.win, S.edge);
    glow(P(B.x + 1.05, y1, 0.85), s * 1.2, 'win', 0.5);
    glow(P(B.x + 3.9, y1, 0.85), s * 1.2, 'win', 0.5);
    // rooftop solar
    for (var i = 0; i < 3; i++) {
      fill(rectG(B.x + 0.45 + i * 1.45, B.y + 0.5, 1.2, 2.2, h + 0.03), S.panel, S.edge);
      if (!compact) seg(P(B.x + 1.05 + i * 1.45, B.y + 0.5, h + 0.03), P(B.x + 1.05 + i * 1.45, B.y + 2.7, h + 0.03), S.panelLine);
    }
  }

  /* The practice array and a training cabinet in the academy yard. */
  function trainingRig() {
    var x0 = 2.3, x1 = 4.6, y = 6.1;
    seg(P(x0 + 0.3, y, 0), P(x0 + 0.3, y, 0.55), S.steel, Math.max(1, s * 0.05));
    seg(P(x1 - 0.3, y, 0), P(x1 - 0.3, y, 0.55), S.steel, Math.max(1, s * 0.05));
    fill([P(x0, y - 0.42, 0.78), P(x1, y - 0.42, 0.78), P(x1, y + 0.42, 0.34), P(x0, y + 0.42, 0.34)], S.panel, S.edge);
    if (!compact) for (var i = 1; i < 4; i++) seg(P(x0 + i * 0.575, y - 0.42, 0.78), P(x0 + i * 0.575, y + 0.42, 0.34), S.panelLine);
    box(5.5, 5.55, 0, 0.5, 0.42, 1.0, S.top, S.east, S.dark, S.edge);
    glow(P(5.75, 5.97, 0.7), s * 0.5, 'signal', 0.6);
  }

  function car(x, y, tone) {
    var body = tone ? S.signal : S.car, side = tone ? mix('signal', 'dark', 0.35) : S.carDark;
    box(x, y, 0.1, 1.2, 0.56, 0.24, body, side, side, S.edge);
    box(x + 0.3, y + 0.05, 0.34, 0.62, 0.46, 0.2, S.glass, S.glass, S.glass, S.edge);
  }
  function evHub(g) {
    if (g <= 0) return;
    var x0 = 7.4, x1 = 10.2, y0 = 2.3, y1 = 7.3, zt = 1.62 * g, zb = 1.42 * g, lw = Math.max(1, s * 0.06);
    pool(8.8, 4.8, 3.0, 'win', 0.2);
    // back posts, chargers, cars, front posts, then the solar roof
    [[x0, y0, zt], [x1, y0, zt]].forEach(function (p) { seg(P(p[0], p[1], 0), P(p[0], p[1], p[2]), S.steel, lw); });
    [3.2, 4.8, 6.4].forEach(function (cy, i) {
      box(7.5, cy - 0.12, 0, 0.16, 0.24, 0.8 * g, S.dark, S.dark, S.dark, S.edge);
      if (g > 0.9) {
        dot(P(7.66, cy, 0.62), Math.max(1.2, s * 0.06), S.ok);
        glow(P(7.66, cy, 0.62), s * 0.45, 'ok', 0.7);
        if (i !== 1) car(8.15, cy - 0.28, i === 2);
      }
    });
    [[x0, y1, zb], [x1, y1, zb]].forEach(function (p) { seg(P(p[0], p[1], 0), P(p[0], p[1], p[2]), S.steel, lw); });
    var q = [P(x0 - 0.15, y0 - 0.15, zt), P(x1 + 0.15, y0 - 0.15, zt), P(x1 + 0.15, y1 + 0.15, zb), P(x0 - 0.15, y1 + 0.15, zb)];
    fill(q, S.panel, S.edge);
    if (!compact) {
      ctx.strokeStyle = S.panelLine; ctx.lineWidth = 1;
      ctx.beginPath();
      for (var yy = y0 + 0.7; yy < y1; yy += 0.75) {
        var f = (yy - y0) / (y1 - y0), z = lerp(zt, zb, f), a = P(x0 - 0.15, yy, z), b = P(x1 + 0.15, yy, z);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      }
      var c = P(8.8, y0 - 0.15, zt), d = P(8.8, y1 + 0.15, zb);
      ctx.moveTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
      ctx.stroke();
    }
    seg(q[3], q[2], S.steel, Math.max(1.5, s * 0.09));
    seg(q[2], q[1], S.steel, Math.max(1.5, s * 0.09));
  }

  function transformer(x, y, g) {
    if (g <= 0) return;
    box(x, y, 0, 1.3, 1.0, 1.0 * g, S.top, S.east, S.south, S.edge);
    if (g < 0.95) return;
    if (!compact) for (var i = 1; i < 7; i++) seg(P(x + i * 0.186, y + 1.0, 0.12), P(x + i * 0.186, y + 1.0, 0.88), S.edgeSoft);
    for (var k = 0; k < 3; k++) {
      var bx = x + 0.3 + k * 0.35;
      seg(P(bx, y + 0.5, 1.0), P(bx, y + 0.5, 1.4), S.steel, Math.max(1, s * 0.07));
      dot(P(bx, y + 0.5, 1.42), Math.max(1.2, s * 0.06), S.accent);
    }
  }
  function gantry(g) {
    if (g <= 0) return;
    var y = 19.5, h = 2.5 * g, lw = Math.max(1, s * 0.07);
    seg(P(16.9, y, 0), P(16.9, y, h), S.steel, lw);
    seg(P(22.5, y, 0), P(22.5, y, h), S.steel, lw);
    seg(P(16.9, y, h), P(22.5, y, h), S.steel, lw);
    if (g < 0.95) return;
    [18.1, 19.7, 21.3].forEach(function (x) {
      seg(P(x, y, h), P(x, y, h - 0.4), S.dark, Math.max(1, s * 0.05));
      // down to the transformers, and away to the grid
      seg(P(x, y, h - 0.4), P(x - 0.6, 18.0, 1.4), S.edge);
      var a = P(x, y, h - 0.4), b = P(x + 4.6, y, h - 0.9), grad = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
      grad.addColorStop(0, S.edge); grad.addColorStop(1, A('edge', 0));
      seg(a, b, grad);
    });
  }

  /* --- robotics cell: one arm fastens each solar module, the next stacks it on a pallet --- */
  function armPose(bx, by, yaw, r, z) {
    var H = 0.7, L1 = 1.45, L2 = 1.32, TOOL = 0.26;
    var pz = z + TOOL - H;
    var d = clamp(Math.hypot(r, pz), 0.3, L1 + L2 - 0.03);
    var a = Math.atan2(pz, r);
    var b = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    var a1 = a + b, c = Math.cos(yaw), sn = Math.sin(yaw);
    var er = L1 * Math.cos(a1), ez = H + L1 * Math.sin(a1);
    var wr = d * Math.cos(a), wz = H + d * Math.sin(a);
    return {
      base: [bx, by, 0], sh: [bx, by, H],
      el: [bx + er * c, by + er * sn, ez],
      wr: [bx + wr * c, by + wr * sn, wz],
      tip: [bx + wr * c, by + wr * sn, wz - TOOL]
    };
  }
  function drawArm(p, g) {
    if (g <= 0) return;
    var k = Math.max(0.6, s / 18) * 1.2;
    cyl(p.base[0], p.base[1], 0, 0.38, 0.2, S.dark, S.dark, S.edge);
    cyl(p.base[0], p.base[1], 0.2, 0.27, 0.44 * g, S.robot, S.robotDark, S.edge);
    var a = P(p.sh[0], p.sh[1], p.sh[2] * g), b = P(p.el[0], p.el[1], p.el[2] * g), c = P(p.wr[0], p.wr[1], p.wr[2] * g), d = P(p.tip[0], p.tip[1], p.tip[2] * g);
    ctx.lineCap = 'round';
    seg(a, b, S.robotDark, 6.4 * k); seg(a, b, S.robot, 4.6 * k);
    seg(b, c, S.robotDark, 5.2 * k); seg(b, c, S.robot, 3.5 * k);
    seg(c, d, S.dark, 2.6 * k);
    ctx.lineCap = 'butt';
    dot(a, 3.9 * k, S.dark); dot(a, 1.6 * k, S.steel);
    dot(b, 3.3 * k, S.dark); dot(b, 1.3 * k, S.steel);
    dot(c, 2.5 * k, S.dark);
    seg([d[0] - 2.6 * k, d[1]], [d[0] + 2.6 * k, d[1]], S.dark, 2 * k);
  }
  function armShadow(p) { shadeLine([p.base, p.sh, p.el, p.wr], Math.max(2, s * 0.2)); }

  /* A solar module lying flat, turned by `ang` about its center. */
  function module(cx, cy, z, ang, alpha) {
    var hw = 0.52, hd = 0.33, c = Math.cos(ang), sn = Math.sin(ang);
    var pts = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(function (v) {
      return P(cx + v[0] * c - v[1] * sn, cy + v[0] * sn + v[1] * c, z);
    });
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    fill(pts, S.panel, S.edge);
    seg([(pts[0][0] + pts[3][0]) / 2, (pts[0][1] + pts[3][1]) / 2], [(pts[1][0] + pts[2][0]) / 2, (pts[1][1] + pts[2][1]) / 2], S.panelLine);
    if (alpha !== undefined) ctx.globalAlpha = 1;
  }

  /* Where arm A's tool is during a cycle: angle round the base, reach, height, and whether it grips. */
  function armA(u, count) {
    var HOVER = 1.5, PICK = 0.66, place = 0.2 + count * 0.075;
    var yaw, r, z;
    if (u < 0.12) { yaw = -0.5; r = 1.6; z = lerp(HOVER, PICK, ease(u / 0.12)); }
    else if (u < 0.22) { yaw = -0.5; r = 1.6; z = PICK; }
    else if (u < 0.32) { yaw = -0.5; r = 1.6; z = lerp(PICK, HOVER, ease((u - 0.22) / 0.1)); }
    else if (u < 0.5) { var f = ease((u - 0.32) / 0.18); yaw = lerp(-0.5, 0.5, f); r = lerp(1.6, 2.1, f); z = HOVER; }
    else if (u < 0.6) { yaw = 0.5; r = 2.1; z = lerp(HOVER, place, ease((u - 0.5) / 0.1)); }
    else if (u < 0.66) { yaw = 0.5; r = 2.1; z = place; }
    else if (u < 0.76) { yaw = 0.5; r = 2.1; z = lerp(place, HOVER, ease((u - 0.66) / 0.1)); }
    else { var f2 = ease((u - 0.76) / 0.24); yaw = lerp(0.5, -0.5, f2); r = lerp(2.1, 1.6, f2); z = HOVER; }
    return { yaw: yaw * Math.PI, r: r, z: z, grip: u >= 0.17 && u < 0.62 };
  }
  /* Arm B touches four fixing points on the module in front of it, then stands clear while the belt moves. */
  function armB(u) {
    var pts = [[-0.34, -0.2], [0.34, -0.2], [0.34, 0.2], [-0.34, 0.2]];
    var UP = 0.98, DOWN = 0.74;
    if (u > 0.56) {
      var f = ease((u - 0.56) / 0.12) - ease((u - 0.86) / 0.14);
      return { dx: pts[3][0], dy: lerp(pts[3][1], 0.75, f), z: lerp(UP, 1.45, f), fire: false };
    }
    var q = u / 0.14, i = Math.min(3, Math.floor(q)), w = q - i, from = pts[(i + 3) % 4], to = pts[i];
    var m = ease(w / 0.36), z;
    if (w < 0.38) z = UP;
    else if (w < 0.5) z = lerp(UP, DOWN, ease((w - 0.38) / 0.12));
    else if (w < 0.9) z = DOWN;
    else z = lerp(DOWN, UP, ease((w - 0.9) / 0.1));
    return { dx: lerp(from[0], to[0], m), dy: lerp(from[1], to[1], m), z: z, fire: w > 0.5 && w < 0.9 };
  }

  function roboticsCell(g) {
    if (g <= 0) return;
    var cyc = T / CYCLE, n = Math.floor(cyc), u = cyc - n, count = n % 6;
    var beltTop = 0.55 * g, pitch = (CELL.xA - CELL.xB) / 2, bx0 = 16.8, bx1 = 22.9;
    var shift = smooth(0.6, 0.95, u);
    var i;
    pool(19.8, 24.6, 4.4, 'win', 0.2);

    // conveyor
    box(bx0, 22.3, 0, bx1 - bx0, 0.8, beltTop, S.dark, S.steel, S.steel, S.edge);
    if (!compact) {
      ctx.strokeStyle = A('steel', 0.7); ctx.lineWidth = 1;
      ctx.beginPath();
      var off = (shift * pitch) % 0.3;
      for (var xx = bx0 + 0.15 + off; xx < bx1; xx += 0.3) {
        var a = P(xx, 22.3, beltTop), b = P(xx, 23.1, beltTop);
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    }
    if (g < 0.98) return;

    // modules riding the belt; the one at arm A's station is gone once it has been picked
    for (i = -1; i <= 2; i++) {
      var mx = CELL.xB + (i + shift) * pitch;
      if (mx < bx0 + 0.5 || mx > CELL.xA + 0.02) continue;
      if (i === 2 && u >= 0.17 && u < 0.6) continue;
      module(mx, CELL.beltY, beltTop + 0.05, 0, clamp((mx - bx0 - 0.5) / 0.5, 0, 1));
    }

    // finished pallets waiting for the cart, and the control cabinet
    box(17.6, 26.45, 0, 1.4, 0.95, 0.14, S.steel, S.steel, S.steel, S.edge);
    for (i = 0; i < 5; i++) module(18.3, 26.92, 0.2 + i * 0.075, 0);
    box(16.6, 27.75, 0, 0.42, 0.75, 1.15, S.top, S.east, S.south, S.edge);
    wallE(17.02, 27.9, 28.35, 0.62, 0.95, S.strip);
    glow(P(17.02, 28.12, 0.8), s * 0.6, 'strip', 0.6);

    // pallet being loaded; a full one slides away to the cart
    var leaving = count === 5 && u > 0.72 ? ease((u - 0.72) / 0.26) : 0;
    var stack = count + (u >= 0.62 ? 1 : 0);
    ctx.globalAlpha = count === 0 ? ease(u / 0.14) : 1 - leaving;   // a fresh pallet fades in for the next stack
    box(20.5 + leaving * 1.6, 25.95, 0, 1.4, 0.95, 0.14, S.steel, S.steel, S.steel, S.edge);
    for (i = 0; i < stack; i++) module(21.2 + leaving * 1.6, 26.42, 0.2 + i * 0.075, 0, 1 - leaving);
    ctx.globalAlpha = 1;

    // arm B fastening
    var tb = armB(u);
    var tx = CELL.xB + tb.dx, ty = CELL.beltY + tb.dy;
    var pb = armPose(CELL.xB, CELL.baseY, Math.atan2(ty - CELL.baseY, tx - CELL.xB), Math.hypot(tx - CELL.xB, ty - CELL.baseY), tb.z);
    drawArm(pb, g);
    if (tb.fire && !reduce.matches) {
      var tip = P(pb.tip[0], pb.tip[1], pb.tip[2]);
      ctx.strokeStyle = S.accent; ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (i = 0; i < 6; i++) {
        var ang = Math.random() * TAU, len = (0.18 + Math.random() * 0.3) * s;
        ctx.moveTo(tip[0], tip[1]); ctx.lineTo(tip[0] + Math.cos(ang) * len, tip[1] + Math.sin(ang) * len * 0.6 - len * 0.2);
      }
      ctx.stroke();
      dot(tip, Math.max(1.5, s * 0.09), S.top);
      glow(tip, s * 1.3, 'accent', 0.9);
    }

    // arm A stacking
    var ta = armA(u, count);
    var pa = armPose(CELL.xA, CELL.baseY, ta.yaw, ta.r, ta.z);
    drawArm(pa, g);
    if (ta.grip) module(pa.tip[0], pa.tip[1], pa.tip[2] - 0.05, ta.yaw + Math.PI / 2);
    glow(P(pa.tip[0], pa.tip[1], pa.tip[2]), s * 0.9, 'win', 0.35);

    cellPoses = [pb, pa];
  }
  var cellPoses = null;

  /* --- things that move across the plot --- */
  function cart() {
    var g = grow(1.1);
    if (g <= 0) return;
    var route = cartRoute, loop = 34, ph = T % loop, f, loaded;
    if (ph < 14) { f = ease(ph / 14); loaded = true; }
    else if (ph < 17) { f = 1; loaded = false; }
    else if (ph < 31) { f = 1 - ease((ph - 17) / 14); loaded = false; }
    else { f = 0; loaded = true; }
    var d = f * route.total, p = along(route, d), alongY = d < route.len[1];
    var w = alongY ? 0.5 : 0.84, dp = alongY ? 0.84 : 0.5;
    ctx.globalAlpha = g;
    if (night > 0.02) pool(p[0] + (alongY ? 0 : (ph < 17 ? -0.9 : 0.9)), p[1] + (alongY ? (ph < 17 ? -0.9 : 0.9) : 0), 1.2, 'win', 0.3);
    box(p[0] - w / 2, p[1] - dp / 2, 0.06, w, dp, 0.22, S.dark, S.dark, S.dark, S.edge);
    wallS(p[0] - w / 2, p[0] + w / 2, p[1] + dp / 2, 0.1, 0.17, S.accent);
    if (loaded) for (var i = 0; i < 3; i++) module(p[0], p[1], 0.31 + i * 0.07, alongY ? Math.PI / 2 : 0);
    ctx.globalAlpha = 1;
    cartAt = [p[0] - w / 2, p[1] - dp / 2, w, dp];
  }
  var cartRoute = measure([[15.0, 27.4], [15.0, 9.1], [3.4, 9.1]]), cartAt = null;

  function dronePos() {
    var a = T * TAU / 30 + 0.8;
    return [7.3 + Math.cos(a) * 4.6, 19.6 + Math.sin(a) * 7.2, 3.3 + Math.sin(T * 1.3) * 0.12, a];
  }
  function drone() {
    var g = grow(1.3);
    if (g <= 0) return;
    var d = dronePos(), c = P(d[0], d[1], d[2]), k = Math.max(0.6, s / 18), h = d[3] + Math.PI / 4;
    ctx.globalAlpha = g;
    for (var i = 0; i < 4; i++) {
      var r = P(d[0] + Math.cos(h + i * Math.PI / 2) * 0.42, d[1] + Math.sin(h + i * Math.PI / 2) * 0.42, d[2] + 0.04);
      seg(c, r, S.dark, 1.5 * k);
      ctx.beginPath(); ctx.ellipse(r[0], r[1], 4.2 * k, 2.4 * k, 0, 0, TAU);
      ctx.fillStyle = A('edge', 0.5); ctx.fill();
    }
    dot(c, 2.5 * k, S.dark);
    var blink = Math.sin(T * 6) > 0.4;
    if (night > 0.02) { glow(c, s * 0.7, 'accent', blink ? 0.9 : 0.25); dot(c, 1.2 * k, A('accent', night)); }
    ctx.globalAlpha = 1;
  }

  /* ---------- scene list, sorted back to front once ---------- */
  var scene = [];
  function add(depth, draw, shade) { scene.push({ d: depth, draw: draw, shade: shade || null }); }

  (function build() {
    seed = 11;
    TREES.forEach(function (t) {
      var delay = 0.15 + rnd() * 0.5;
      add(t[0] + t[1], function () { tree(t[0], t[1], t[2], grow(delay)); },
        function () { if (grow(delay) > 0.9) shadeDisc(t[0], t[1], 0.42 + t[2], t[2] * 0.95); });
    });
    add(ACAD.x + ACAD.w / 2 + ACAD.y + ACAD.d / 2, function () { academy(grow(0.4)); },
      function () { var g = grow(0.4); if (g > 0) shadowBox(ACAD.x, ACAD.y, ACAD.w, ACAD.d, ACAD.h * g); });
    add(3.4 + 6.1, function () { if (grow(0.9) > 0.5) trainingRig(); },
      function () { if (grow(0.9) > 0.5) { shadePoly([shadePt([2.3, 5.68, 0.78]), shadePt([4.6, 5.68, 0.78]), shadePt([4.6, 6.52, 0.34]), shadePt([2.3, 6.52, 0.34])]); shadowBox(5.5, 5.55, 0.5, 0.42, 1.0); } });
    add(8.8 + 4.8, function () { evHub(grow(0.55)); },
      function () { var g = grow(0.55); if (g > 0.3) shadePoly([shadePt([7.25, 2.15, 1.62 * g]), shadePt([10.35, 2.15, 1.62 * g]), shadePt([10.35, 7.45, 1.42 * g]), shadePt([7.25, 7.45, 1.42 * g])]); });
    add(HALL.x + HALL.w / 2 + HALL.y + HALL.d / 2, function () { dataHall(grow(0.25)); },
      function () { var g = grow(0.25); if (g > 0) shadowBox(HALL.x, HALL.y, HALL.w, HALL.d, HALL.h * g); });
    LAMPS.forEach(function (l) {
      add(l[0] + l[1], function () { if (grow(1.0) > 0.5) lamp(l[0], l[1]); },
        function () { if (grow(1.0) > 0.5) shadeLine([[l[0], l[1], 0], [l[0], l[1], 1.55]], Math.max(1, s * 0.06)); });
    });
    for (var i = 0; i < 7; i++) {
      [[10.95, 16.3], [16.9, 22.3], [22.9, 28.5]].forEach(function (yr, j) {
        var x = 2.0 + i * 1.75, delay = 0.1 + (i + j * 1.4) * 0.045;
        add(x + (yr[0] + yr[1]) / 2, function () { pvTable(x, yr[0], yr[1], grow(delay)); },
          function () { var g = grow(delay); if (g > 0) pvShadow(x, yr[0], yr[1], g); });
      });
    }
    [16.7, 19.6].forEach(function (x, ci) {
      [10.9, 12.2, 13.5, 14.8].forEach(function (y, ri) {
        var idx = ci * 4 + ri, delay = 0.55 + idx * 0.06;
        add(x + 1.2 + y + 0.5, function () { bessUnit(x, y, idx, grow(delay)); },
          function () { if (grow(delay) > 0.95) shadowBox(x, y, 2.4, 0.95, 1.05); });
      });
    });
    [[17.0, 17.5], [18.9, 17.5]].forEach(function (t, i) {
      add(t[0] + 0.65 + t[1] + 0.5, function () { transformer(t[0], t[1], grow(0.75 + i * 0.08)); },
        function () { if (grow(0.75 + i * 0.08) > 0.9) shadowBox(t[0], t[1], 1.3, 1.0, 1.0); });
    });
    add(21.7 + 17.95, function () { var g = grow(0.9); if (g > 0) { house(20.9, 17.4, 0, 1.6, 1.1, 1.15 * g); if (g > 0.9) glow(P(21.7, 18.5, 0.7), s * 0.5, 'ok', 0.5); } },
      function () { if (grow(0.9) > 0.9) shadowBox(20.9, 17.4, 1.6, 1.1, 1.15); });
    add(19.7 + 19.5, function () { gantry(grow(0.95)); },
      function () { if (grow(0.95) > 0.9) { shadeLine([[16.9, 19.5, 0], [16.9, 19.5, 2.5], [22.5, 19.5, 2.5], [22.5, 19.5, 0]], Math.max(1, s * 0.07)); } });
    add(19.8 + 24.6, function () { roboticsCell(grow(0.8)); },
      function () {
        if (grow(0.8) < 0.98) return;
        shadowBox(16.8, 22.3, 6.1, 0.8, 0.55);
        shadowBox(17.6, 26.45, 1.4, 0.95, 0.5);
        shadowBox(20.5, 25.95, 1.4, 0.95, 0.3);
        shadowBox(16.6, 27.75, 0.42, 0.75, 1.15);
        if (cellPoses) cellPoses.forEach(armShadow);
      });
    PEOPLE.forEach(function (p) {
      add(p[0] + p[1] + 0.01, function () { if (grow(1.2) > 0.5) person(p[0], p[1], p[2]); },
        function () { if (grow(1.2) > 0.5) shadeLine([[p[0], p[1], 0], [p[0], p[1], 0.42]], Math.max(1.5, s * 0.14)); });
    });
    // the academy flag
    add(6.95 + 5.2, function () {
      var g = grow(1.0); if (g <= 0) return;
      seg(P(6.95, 5.2, 0), P(6.95, 5.2, 2.3 * g), S.steel, Math.max(1, s * 0.05));
      if (g > 0.95) { var w = Math.sin(T * 2.4) * 0.05; fill([P(6.95, 5.2, 2.3), P(7.75, 5.2, 2.14 + w), P(6.95, 5.2, 1.86)], S.accent); }
    }, null);
    scene.sort(function (a, b) { return a.d - b.d; });
  })();

  /* ---------- callouts and hover ---------- */
  var hot = null, links = {};
  if (list) {
    Array.prototype.forEach.call(list.querySelectorAll('.callout'), function (a) {
      var z = a.getAttribute('data-zone');
      links[z] = a;
      a.addEventListener('mouseenter', function () { setHot(z); });
      a.addEventListener('mouseleave', function () { setHot(null); });
      a.addEventListener('focus', function () { setHot(z); });
      a.addEventListener('blur', function () { setHot(null); });
    });
  }
  function setHot(z) {
    if (z === hot) return;
    if (hot && links[hot]) links[hot].classList.remove('is-hot');
    hot = z;
    if (hot && links[hot]) links[hot].classList.add('is-hot');
    canvas.style.cursor = hot ? 'pointer' : '';
    requestDraw();
  }
  function placeCallouts() {
    if (!list) return;
    list.classList.toggle('is-placed', !compact);
    list.classList.toggle('is-list', compact);
    Object.keys(ZONES).forEach(function (k) {
      var a = links[k], z = ZONES[k];
      if (!a) return;
      var p = P(z.at[0], z.at[1], z.at[2] + z.up);
      a.style.setProperty('--x', p[0].toFixed(1) + 'px');
      a.style.setProperty('--y', p[1].toFixed(1) + 'px');
    });
  }
  function zoneAt(px, py) {
    var u = (px - ox) / (COS * s), v = (py - oy) / (SIN * s);
    var gx = (u + v) / 2, gy = (v - u) / 2, best = null;
    Object.keys(ZONES).forEach(function (k) {
      var r = ZONES[k].r, h = ZONES[k].h;
      // a point over a roof projects onto the ground h units further "back"
      if (gx >= r[0] - h * 0.1 && gx <= r[0] + r[2] && gy >= r[1] - h * 0.1 && gy <= r[1] + r[3]) best = k;
      else if (gx + h >= r[0] && gx + h <= r[0] + r[2] && gy + h >= r[1] && gy + h <= r[1] + r[3]) best = best || k;
    });
    return best;
  }
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var r = canvas.getBoundingClientRect();
    setHot(zoneAt(e.clientX - r.left, e.clientY - r.top));
  });
  canvas.addEventListener('pointerleave', function () { setHot(null); });
  canvas.addEventListener('click', function (e) {
    var r = canvas.getBoundingClientRect(), z = zoneAt(e.clientX - r.left, e.clientY - r.top);
    if (z && links[z]) window.location.hash = links[z].getAttribute('href');
  });

  function drawHot() {
    if (!hot || !ZONES[hot]) return;
    var r = ZONES[hot].r;
    ctx.save();
    ctx.lineJoin = 'round';
    fill(rectG(r[0] - 0.18, r[1] - 0.18, r[2] + 0.36, r[3] + 0.36, 0.02), A('accent', 0.14), S.accent, 2);
    ctx.restore();
  }
  function drawLeaders() {
    var g = grow(1.25);
    if (g <= 0) return;
    ctx.save();
    ctx.globalAlpha = g;
    Object.keys(ZONES).forEach(function (k) {
      var z = ZONES[k], a = P(z.at[0], z.at[1], z.at[2]);
      var b = P(z.at[0], z.at[1], z.at[2] + (compact ? z.up * 0.7 : z.up));
      var on = hot === k;
      seg(a, compact ? [b[0], b[1] + 9] : b, on ? S.accent : S.label, on ? 1.6 : 1);
      dot(a, on ? 3.4 : 2.6, on ? S.accent : S.pin);
      if (compact && links[k]) {
        var code = links[k].querySelector('.callout__code');
        ctx.beginPath(); ctx.arc(b[0], b[1], 9.5, 0, TAU); ctx.fillStyle = S.pin; ctx.fill();
        ctx.fillStyle = S.pinText;
        ctx.font = '700 9px Archivo, Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(code ? code.textContent : '', b[0], b[1] + 0.5);
      }
    });
    ctx.restore();
  }

  /* ---------- frame ---------- */
  var raf = 0, visible = true, t0 = performance.now();

  function resize() {
    var r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    cw = r.width; ch = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    sh.width = canvas.width; sh.height = canvas.height;
    compact = cw < 560;
    var topRoom = compact ? 3.0 : 3.5, botRoom = 2.2;
    s = Math.min((cw * 0.985) / ((W + D) * COS), ch / ((W + D) * SIN + topRoom + botRoom));
    ox = cw / 2 + (D - W) / 2 * COS * s;
    oy = (ch - ((W + D) * SIN + topRoom + botRoom) * s) / 2 + topRoom * s;
    bgDirty = true;
    placeCallouts();
  }

  function draw(ms) {
    if (!cw) return;
    T = reduce.matches ? 0 : (ms - t0) / 1000;
    if (!built && (reduce.matches || (ms - born) / 1000 > 1.7)) built = true;
    stepTransition(ms);
    if (setPalette(night) || bgDirty) renderGround();
    kx = KX * shLen; ky = KY * shLen;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.lineJoin = 'round';
    ctx.drawImage(bg, 0, 0, cw, ch);
    drawHot();
    drawCables();

    var i;
    if (shAlpha > 0.01) {
      shx.setTransform(dpr, 0, 0, dpr, 0, 0);
      shx.clearRect(0, 0, cw, ch);
      shx.fillStyle = S.shadow; shx.strokeStyle = S.shadow;
      for (i = 0; i < scene.length; i++) if (scene[i].shade) scene[i].shade();
      if (cartAt) shadowBox(cartAt[0], cartAt[1], cartAt[2], cartAt[3], 0.3);
      var dp = dronePos();
      if (grow(1.3) > 0.5) shadeDisc(dp[0], dp[1], dp[2], 0.3);
      ctx.globalAlpha = 0.16 * shAlpha;
      ctx.drawImage(sh, 0, 0, cw, ch);
      ctx.globalAlpha = 1;
    }

    for (i = 0; i < scene.length; i++) scene[i].draw();
    cart();
    drone();
    drawLeaders();
  }

  function loop(ms) {
    raf = 0;
    draw(ms);
    if (visible && !document.hidden && (!reduce.matches || trans)) raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf) raf = requestAnimationFrame(loop); }
  function requestDraw() { start(); }

  settle(wantNight());
  setPalette(night);
  resize();
  draw(performance.now());
  start();

  if ('ResizeObserver' in window) new ResizeObserver(function () { resize(); requestDraw(); }).observe(stage);
  else window.addEventListener('resize', function () { resize(); requestDraw(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) start(); }, { rootMargin: '120px' }).observe(stage);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
  window.addEventListener('ff:theme', onTheme);
  if (reduce.addEventListener) reduce.addEventListener('change', function () { built = true; requestDraw(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { bgDirty = true; requestDraw(); });
})();
