/* Farwatt — the robot arm in the Robotics section.
   A side view of an arm that reaches for the pointer. It solves its two main
   joint angles from the tool position (inverse kinematics), keeps the tool
   pointing down, and can pick up the three battery modules on the bench.
   Left alone, it runs its own pick-and-place cycle.

   Mouse or pen: move to steer, press and hold to grip.
   Touch: tap where the tool should go; it grips or lets go when it arrives. */
(function () {
  'use strict';

  var canvas = document.getElementById('arm');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var stage = canvas.parentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var coarse = window.matchMedia('(hover: none)');
  var out = {
    j1: document.getElementById('arm-j1'), j2: document.getElementById('arm-j2'),
    j3: document.getElementById('arm-j3'), grip: document.getElementById('arm-grip')
  };
  var cap = document.querySelector('.armfig__cap');
  if (cap && coarse.matches) {
    cap.innerHTML = '<strong>Try it.</strong> Tap a battery module and the arm picks it up. Tap the tray and it puts the module down. The arm works out its joint angles as it goes, a simple version of the math an industrial robot controller solves hundreds of times a second.';
  }

  var TAU = Math.PI * 2;
  var w = 0, h = 0, dpr = 1, u = 20;
  var G = {};                 // geometry in pixels, rebuilt on resize
  var col = {};               // colors from CSS
  var parts = [], held = null, doneAt = 0, bornAt = 0;
  var cur = { x: 0, y: 0 }, goal = { x: 0, y: 0 };
  var pose = { t1: -1.1, t2: 0.5 }, side = 1, fk = null;
  var grip = false, gripAmt = 0;
  var mode = 'auto', plan = [], wait = 0, lastInput = -1e9, inside = false;
  var touch = null;
  var raf = 0, visible = false, last = 0, lastReadout = 0;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(f) { f = clamp(f, 0, 1); return f * f * (3 - 2 * f); }

  function readColors() {
    var cs = getComputedStyle(canvas);
    var get = function (name, fallback) { return (cs.getPropertyValue(name) || '').trim() || fallback; };
    col.ink = get('--ink', '#F1F0EA');
    col.ink2 = get('--ink-2', '#A9B5C6');
    col.ink3 = get('--ink-3', '#8794A8');
    col.line = get('--line', 'rgba(241,240,234,.2)');
    col.soft = get('--line-soft', 'rgba(241,240,234,.1)');
    col.bg = get('--surface', '#14253B');
    col.sun = get('--sun', '#FF9F1C');
    col.signal = get('--signal', '#6FDDEE');
  }

  /* ---------- layout ---------- */
  function layout() {
    var r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var first = !w;
    w = r.width; h = r.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var cols = w < 520 ? 13.2 : 16;            // a tighter frame on phones, so the arm stays large
    u = Math.min(w / cols, h / 11.5);
    var off = (w - cols * u) / 2;
    G.ground = h - 1.45 * u;
    G.bx = off + (cols < 16 ? 2.6 : 4.7) * u;
    G.sh = { x: G.bx, y: G.ground - 2.35 * u };
    G.L1 = 4.6 * u; G.L2 = 4.2 * u; G.L3 = 1.2 * u;
    G.size = 0.96 * u;
    G.grab = G.size * 0.42;
    G.table = { x0: G.bx + 3.5 * u, x1: G.bx + 9.05 * u, y: G.ground - 1.5 * u };
    G.tray = { x0: G.table.x0 + 3.28 * u, x1: G.table.x0 + 5.38 * u };
    G.hover = G.table.y - 3.5 * u;
    resetParts();
    plan = [];
    if (first) {
      cur.x = goal.x = G.bx + 4.4 * u; cur.y = goal.y = G.hover;
      var s0 = solve(cur); pose.t1 = s0.t1; pose.t2 = s0.t2;
    }
  }

  function resetParts(fadeIn) {
    var t = G.table, z = G.size;
    parts = [
      { x: t.x0 + 0.78 * u, y: t.y, falling: false },
      { x: t.x0 + 2.05 * u, y: t.y, falling: false },
      { x: t.x0 + 0.78 * u, y: t.y - z, falling: false }
    ];
    held = null; doneAt = 0; bornAt = fadeIn ? performance.now() : -1e9;   // only fade in after a finished cycle
  }

  /* ---------- world rules ---------- */
  /* Highest surface under a part centred at x (smaller y is higher on screen). */
  function supportAt(x, skip) {
    var y = G.ground;
    if (x > G.table.x0 - G.size * 0.3 && x < G.table.x1 + G.size * 0.3) y = G.table.y;
    parts.forEach(function (p) {
      if (p === skip || p === held || p.falling) return;
      if (Math.abs(p.x - x) < G.size * 0.9) y = Math.min(y, p.y - G.size);
    });
    return y;
  }
  function hasPartOnTop(p) {
    return parts.some(function (q) { return q !== p && !q.falling && q !== held && Math.abs(q.x - p.x) < G.size * 0.9 && Math.abs(q.y - (p.y - G.size)) < 2; });
  }
  /* Keep the finger tips out of the bench, the floor and the modules. */
  function limit(p) {
    var x = clamp(p.x, u * 0.6, w - u * 0.6), floor;
    if (held) floor = supportAt(x, held) - G.size + G.grab;
    else {
      floor = G.ground;
      if (x > G.table.x0 - u * 0.3 && x < G.table.x1 + u * 0.3) floor = G.table.y;
      parts.forEach(function (q) {
        if (q.falling) return;
        var dx = Math.abs(q.x - x), top = q.y - G.size;
        if (dx < G.size * 0.34) floor = Math.min(floor, hasPartOnTop(q) ? top : top + G.grab);
        else if (dx < G.size * 0.98) floor = Math.min(floor, top - 2);
      });
    }
    return { x: x, y: clamp(p.y, u * 1.4, floor) };
  }

  function setGrip(on) {
    if (on === grip) return;
    grip = on;
    if (on) {
      var tip = fk ? fk.tip : cur, best = null, bd = 1e9;
      parts.forEach(function (p) {
        if (p.falling || hasPartOnTop(p)) return;
        var dx = Math.abs(p.x - tip.x), dy = Math.abs(tip.y - (p.y - G.size + G.grab));
        if (dx < G.size * 0.4 && dy < G.size * 0.42 && dx + dy < bd) { bd = dx + dy; best = p; }
      });
      held = best;
    } else if (held) {
      held.falling = true; held.vy = 0; held = null;
    }
  }

  /* ---------- inverse kinematics ---------- */
  function solve(tip) {
    var S = G.sh, dx = tip.x - S.x, dy = tip.y - G.L3 - S.y, d = Math.hypot(dx, dy);
    var max = G.L1 + G.L2 - u * 0.12, min = Math.abs(G.L1 - G.L2) + u * 1.1;
    if (d > max) { dx *= max / d; dy *= max / d; d = max; }
    if (d < min) { if (d < 0.001) { dx = min; dy = 0; } else { dx *= min / d; dy *= min / d; } d = min; }
    if (dx > u * 0.5) side = 1; else if (dx < -u * 0.5) side = -1;   // elbow stays on the upper side
    var a = Math.atan2(dy, dx);
    var b = Math.acos(clamp((G.L1 * G.L1 + d * d - G.L2 * G.L2) / (2 * G.L1 * d), -1, 1));
    var t1 = a - side * b;
    var ex = S.x + G.L1 * Math.cos(t1), ey = S.y + G.L1 * Math.sin(t1);
    return { t1: t1, t2: Math.atan2(S.y + dy - ey, S.x + dx - ex) };
  }
  function turn(from, to, f) {
    var d = ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
    return from + d * f;
  }
  function forward() {
    var S = G.sh;
    var e = { x: S.x + G.L1 * Math.cos(pose.t1), y: S.y + G.L1 * Math.sin(pose.t1) };
    var wr = { x: e.x + G.L2 * Math.cos(pose.t2), y: e.y + G.L2 * Math.sin(pose.t2) };
    return { s: S, e: e, w: wr, tip: { x: wr.x, y: wr.y + G.L3 } };
  }

  /* ---------- the built-in cycle ---------- */
  function trayFull() {
    return parts.every(function (p) { return !p.falling && p !== held && p.x > G.tray.x0 && p.x < G.tray.x1 && p.y <= G.table.y + 1; });
  }
  function autoPlan() {
    // take the next free module that is not yet in the tray
    var cand = parts.filter(function (p) { return !(p.x > G.tray.x0 && p.x < G.tray.x1) && !hasPartOnTop(p) && !p.falling; });
    if (!cand.length) return;
    cand.sort(function (a, b) { return a.y - b.y; });
    var p = cand[0];
    var inTray = parts.filter(function (q) { return q.x > G.tray.x0 && q.x < G.tray.x1; }).length;
    var slotX = [G.tray.x0 + 0.56 * u, G.tray.x0 + 1.58 * u, G.tray.x0 + 1.07 * u][Math.min(2, inTray)];
    var dropY = supportAt(slotX, p) - G.size + G.grab;
    plan = [
      { x: p.x, y: G.hover },
      { x: p.x, y: p.y - G.size + G.grab },
      { pause: 0.1 },
      { grip: true, wait: 0.28 },
      { x: p.x, y: G.hover },
      { x: slotX, y: G.hover },
      { x: slotX, y: dropY - 1 },
      { pause: 0.1 },
      { grip: false, wait: 0.3 },
      { x: slotX, y: G.hover }
    ];
  }
  /* A tap. On a module: fetch the top one of that stack. While holding one: set it down there.
     Anywhere else: just move the tool. */
  function tapPlan(p) {
    var rise = { x: cur.x, y: Math.min(cur.y, G.hover) };
    if (held) {
      var x = limit({ x: p.x, y: 0 }).x, low = limit({ x: x, y: h });
      plan = [rise, { x: x, y: G.hover }, { x: x, y: low.y }, { pause: 0.12 }, { grip: false, wait: 0.26 }, { x: x, y: G.hover }];
      return;
    }
    var best = null, bd = 1e9;
    parts.forEach(function (q) {
      if (q.falling) return;
      var d = Math.hypot(q.x - p.x, q.y - G.size / 2 - p.y);
      if (d < G.size * 1.3 && d < bd) { bd = d; best = q; }
    });
    if (!best) {
      var t = limit(p);
      plan = [rise, { x: t.x, y: Math.min(t.y, G.hover) }, { x: t.x, y: t.y }];
      return;
    }
    parts.forEach(function (q) {            // climb to the top of the stack that was tapped
      if (!q.falling && Math.abs(q.x - best.x) < G.size * 0.9 && q.y < best.y) best = q;
    });
    plan = [{ grip: false, wait: 0 }, rise, { x: best.x, y: G.hover }, { x: best.x, y: best.y - G.size + G.grab },
      { pause: 0.12 }, { grip: true, wait: 0.26 }, { x: best.x, y: G.hover }];
  }
  function runPlan(dt) {
    if (wait > 0) { wait -= dt; return; }
    if (!plan.length) return;
    var step = plan[0];
    if (step.pause !== undefined) { wait = step.pause; plan.shift(); return; }
    if (step.grip !== undefined) {
      setGrip(step.grip);
      wait = step.wait || 0;
      plan.shift();
      if (step.grip && !held) plan.unshift({ grip: false, wait: 0.1 });   // closed on nothing: open again
      return;
    }
    goal.x = step.x; goal.y = step.y;
    if (Math.hypot(cur.x - step.x, cur.y - step.y) < u * 0.07) plan.shift();
  }

  /* ---------- input ---------- */
  function at(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function take() {
    if (mode !== 'user') { mode = 'user'; plan = []; wait = 0; }
    lastInput = performance.now();
    start();
  }
  canvas.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch') inside = true; });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') {
      if (!touch) return;
      var p = at(e);
      if (Math.hypot(p.x - touch.x, p.y - touch.y) > 10) { touch.moved = true; take(); plan = []; goal = limit(p); }
      return;
    }
    inside = true;
    take();
    if (!e.buttons) setGrip(false);          // the gripper only stays shut while the button is held
    goal = limit(at(e));
  });
  canvas.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') { touch = at(e); touch.moved = false; return; }
    take();
    goal = limit(at(e));
    setGrip(true);
  });
  canvas.addEventListener('pointerup', function (e) {
    if (e.pointerType === 'touch') {
      if (touch && !touch.moved) { take(); tapPlan(at(e)); }
      touch = null;
      return;
    }
    setGrip(false);
    lastInput = performance.now();
  });
  canvas.addEventListener('pointercancel', function () { touch = null; });
  canvas.addEventListener('pointerleave', function (e) {
    if (e.pointerType === 'touch') return;
    inside = false;
    setGrip(false);
    lastInput = performance.now();
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- simulation step ---------- */
  function update(dt, now) {
    var idle = now - lastInput;
    if (mode === 'user' && !inside && !touch && idle > (plan.length ? 9000 : coarse.matches ? 6000 : 1800)) {
      mode = 'auto'; plan = []; setGrip(false);
    }
    if (doneAt) {
      if (now - doneAt > 2400) { resetParts(true); plan = []; }
    } else if (mode === 'auto' && !reduce.matches) {
      if (!plan.length && wait <= 0) autoPlan();
      runPlan(dt);
    } else if (plan.length || wait > 0) {
      runPlan(dt);
    }

    // the tool chases its goal with a speed limit, so it reads as a machine and not a cursor
    var g = limit(goal), dx = g.x - cur.x, dy = g.y - cur.y, dist = Math.hypot(dx, dy);
    var stepLen = Math.min(dist, Math.max(dist * (1 - Math.exp(-dt * 9)), 0), 26 * u * dt);
    if (dist > 0.01) { cur.x += dx / dist * stepLen; cur.y += dy / dist * stepLen; }
    var c = limit(cur); cur.x = c.x; cur.y = c.y;

    var sol = solve(cur), k = 1 - Math.exp(-dt * 16);
    pose.t1 = turn(pose.t1, sol.t1, k);
    pose.t2 = turn(pose.t2, sol.t2, k);
    fk = forward();
    gripAmt += ((grip ? 1 : 0) - gripAmt) * (1 - Math.exp(-dt * 18));

    if (held) { held.x = fk.tip.x; held.y = fk.tip.y - G.grab + G.size; }
    parts.forEach(function (p) {
      if (!p.falling) return;
      p.vy += 70 * u * dt;
      p.y += p.vy * dt;
      var floor = supportAt(p.x, p);
      if (p.y >= floor) { p.y = floor; p.falling = false; p.vy = 0; }
    });
    if (!doneAt && trayFull()) doneAt = now;
  }

  /* ---------- drawing ---------- */
  function line(x0, y0, x1, y1, color, lw) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
  }
  function disc(x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function rounded(x, y, ww, hh, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + ww, y, x + ww, y + hh, r);
    ctx.arcTo(x + ww, y + hh, x, y + hh, r);
    ctx.arcTo(x, y + hh, x, y, r);
    ctx.arcTo(x, y, x + ww, y, r);
    ctx.closePath();
  }
  function label(text, x, y, align, color, size) {
    ctx.font = '600 ' + (size || 11) + 'px Archivo, "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function draw(now) {
    if (!w || !fk) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var S = G.sh, t = G.table, i;

    // drawing-sheet grid
    ctx.beginPath();
    for (var gx = S.x % u; gx < w; gx += u) { ctx.moveTo(gx, 0); ctx.lineTo(gx, G.ground); }
    for (var gy = G.ground; gy > 0; gy -= u) { ctx.moveTo(0, gy); ctx.lineTo(w, gy); }
    ctx.strokeStyle = col.soft; ctx.lineWidth = 1; ctx.globalAlpha = 0.55; ctx.stroke(); ctx.globalAlpha = 1;

    // work envelope: the furthest the finger tips can reach
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, w, G.ground); ctx.clip();
    ctx.setLineDash([2, 7]);
    ctx.beginPath(); ctx.arc(S.x, S.y + G.L3, G.L1 + G.L2 - u * 0.12, -1.02, 0.7);
    ctx.strokeStyle = col.ink3; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    var lx = S.x + Math.cos(-0.62) * (G.L1 + G.L2), ly = S.y + G.L3 + Math.sin(-0.62) * (G.L1 + G.L2);
    if (lx < w - 30) label('REACH', Math.min(lx + 8, w - 46), ly, 'left', col.ink3, 10);

    // floor, with the hatching used for ground on engineering drawings
    line(0, G.ground, w, G.ground, col.line, 1.5);
    ctx.beginPath();
    for (var hx = -u; hx < w + u; hx += u * 0.6) { ctx.moveTo(hx, G.ground + u * 0.42); ctx.lineTo(hx + u * 0.42, G.ground); }
    ctx.strokeStyle = col.soft; ctx.lineWidth = 1; ctx.stroke();

    // bench and tray
    var full = !!doneAt;
    line(t.x0 + u * 0.5, t.y, t.x0 + u * 0.5, G.ground, col.line, 2);
    line(t.x1 - u * 0.5, t.y, t.x1 - u * 0.5, G.ground, col.line, 2);
    line(t.x0, t.y + 1.5, t.x1, t.y + 1.5, col.ink2, 3);
    ctx.save();
    if (!full) ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(G.tray.x0, t.y - G.size * 2.25); ctx.lineTo(G.tray.x0, t.y - 2); ctx.lineTo(G.tray.x1, t.y - 2); ctx.lineTo(G.tray.x1, t.y - G.size * 2.25);
    ctx.strokeStyle = full ? col.sun : col.ink3; ctx.lineWidth = full ? 2 : 1.3; ctx.stroke();
    ctx.restore();
    var inTray = parts.filter(function (p) { return !p.falling && p !== held && p.x > G.tray.x0 && p.x < G.tray.x1 && p.y <= t.y + 1; }).length;
    label(full ? 'TRAY FULL' : 'TRAY ' + inTray + ' / 3', (G.tray.x0 + G.tray.x1) / 2, t.y + u * 0.72, 'center', full ? col.sun : col.ink3, 10.5);
    label('IN', t.x0 + 1.42 * u, t.y + u * 0.72, 'center', col.ink3, 10.5);

    // battery modules
    var appear = ease((now - bornAt) / 450);
    parts.forEach(function (p) {
      var x = p.x - G.size / 2, y = p.y - G.size, z = G.size;
      ctx.globalAlpha = appear;
      rounded(x + 1, y + 1, z - 2, z - 2, z * 0.14);
      ctx.fillStyle = col.bg; ctx.fill();
      ctx.globalAlpha = appear * 0.2; ctx.fillStyle = full ? col.sun : col.signal; ctx.fill();
      ctx.globalAlpha = appear;
      ctx.strokeStyle = full ? col.sun : col.signal; ctx.lineWidth = 1.6; ctx.stroke();
      // terminals and a charge mark
      ctx.fillStyle = full ? col.sun : col.signal;
      ctx.fillRect(x + z * 0.24, y + z * 0.2, z * 0.14, z * 0.07);
      ctx.fillRect(x + z * 0.62, y + z * 0.2, z * 0.14, z * 0.07);
      ctx.beginPath();
      ctx.moveTo(x + z * 0.55, y + z * 0.38); ctx.lineTo(x + z * 0.4, y + z * 0.62); ctx.lineTo(x + z * 0.52, y + z * 0.62);
      ctx.lineTo(x + z * 0.45, y + z * 0.84); ctx.lineTo(x + z * 0.62, y + z * 0.56); ctx.lineTo(x + z * 0.5, y + z * 0.56);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    });

    // pedestal
    var bw = 1.15 * u;
    rounded(S.x - 1.45 * u, G.ground - 0.34 * u, 2.9 * u, 0.34 * u, 3);
    ctx.fillStyle = col.ink2; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(S.x - bw, G.ground - 0.34 * u); ctx.lineTo(S.x - bw * 0.62, S.y + 0.35 * u); ctx.lineTo(S.x + bw * 0.62, S.y + 0.35 * u); ctx.lineTo(S.x + bw, G.ground - 0.34 * u);
    ctx.closePath();
    ctx.fillStyle = col.bg; ctx.fill(); ctx.strokeStyle = col.ink2; ctx.lineWidth = 1.8; ctx.stroke();
    for (i = -1; i <= 1; i += 2) disc(S.x + i * 1.15 * u, G.ground - 0.17 * u, 2.2, col.bg);

    // hose from the upper arm to the forearm
    var m1 = { x: S.x + (fk.e.x - S.x) * 0.5, y: S.y + (fk.e.y - S.y) * 0.5 };
    var m2 = { x: fk.e.x + (fk.w.x - fk.e.x) * 0.55, y: fk.e.y + (fk.w.y - fk.e.y) * 0.55 };
    var bis = Math.atan2(fk.e.y - (m1.y + m2.y) / 2, fk.e.x - (m1.x + m2.x) / 2);
    ctx.beginPath(); ctx.moveTo(m1.x, m1.y);
    ctx.quadraticCurveTo(fk.e.x + Math.cos(bis) * u * 1.5, fk.e.y + Math.sin(bis) * u * 1.5, m2.x, m2.y);
    ctx.strokeStyle = col.ink3; ctx.lineWidth = 2.2; ctx.stroke();

    // links
    function link(a, b, width) {
      line(a.x, a.y, b.x, b.y, col.bg, width + 5);
      line(a.x, a.y, b.x, b.y, col.sun, width);
      ctx.globalAlpha = 0.28;
      var n = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2, o = width * 0.24;
      line(a.x + Math.cos(n) * o, a.y + Math.sin(n) * o, b.x + Math.cos(n) * o, b.y + Math.sin(n) * o, '#FFFFFF', Math.max(1.5, width * 0.16));
      ctx.globalAlpha = 1;
    }
    link(fk.e, fk.w, 0.74 * u);
    link(S, fk.e, 0.98 * u);
    function joint(p, r) {
      disc(p.x, p.y, r, col.bg, col.ink, 2);
      disc(p.x, p.y, r * 0.55, null, col.ink2, 1.3);
      disc(p.x, p.y, r * 0.16, col.ink);
    }
    joint(S, 0.72 * u);
    joint(fk.e, 0.56 * u);

    // wrist, tool and fingers (the tool always hangs straight down)
    var wr = fk.w, tip = fk.tip, open = (1 - gripAmt), half = G.size * 0.5 + 3 + open * u * 0.3;
    line(wr.x, wr.y, wr.x, tip.y - u * 0.78, col.bg, 0.5 * u + 5);
    line(wr.x, wr.y, wr.x, tip.y - u * 0.78, col.ink2, 0.5 * u);
    rounded(wr.x - u * 0.95, tip.y - u * 0.86, u * 1.9, u * 0.26, 3);
    ctx.fillStyle = col.ink; ctx.fill();
    for (i = -1; i <= 1; i += 2) {
      line(wr.x + i * half, tip.y - u * 0.74, wr.x + i * half, tip.y, col.bg, 7);
      line(wr.x + i * half, tip.y - u * 0.74, wr.x + i * half, tip.y, col.ink, 3.4);
    }
    joint(wr, 0.4 * u);

    // where the tool is being sent
    if (mode === 'user') {
      var g = limit(goal);
      disc(g.x, g.y, 7, null, col.signal, 1.4);
      line(g.x - 12, g.y, g.x - 4, g.y, col.signal, 1.4); line(g.x + 4, g.y, g.x + 12, g.y, col.signal, 1.4);
      line(g.x, g.y - 12, g.x, g.y - 4, col.signal, 1.4); line(g.x, g.y + 4, g.x, g.y + 12, col.signal, 1.4);
    }

    // one line of status under the floor
    var msg = full ? 'Cycle complete. Resetting.'
      : mode === 'auto' ? (reduce.matches ? 'Move your pointer over the drawing to steer the arm.' : (coarse.matches ? 'Running on its own. Tap a module to take over.' : 'Running on its own. Move your pointer to take over.'))
      : (coarse.matches ? 'You are in control. Tap the tray to set a module down.' : 'You are in control. Press and hold to grip.');
    label(msg, u * 0.7, h - u * 0.5, 'left', col.ink3, w < 420 ? 10.5 : 11.5);

    // joint readout, a few times a second
    if (now - lastReadout > 90) {
      lastReadout = now;
      var deg = function (r) { return Math.round(r * 180 / Math.PI); };
      var j1 = deg(-pose.t1);
      var bend = ((pose.t2 - pose.t1 + Math.PI) % TAU + TAU) % TAU - Math.PI;
      var wrist = ((Math.PI / 2 - pose.t2 + Math.PI) % TAU + TAU) % TAU - Math.PI;
      if (out.j1) out.j1.textContent = j1 + '°';
      if (out.j2) out.j2.textContent = (180 - Math.abs(deg(bend))) + '°';
      if (out.j3) out.j3.textContent = (180 - Math.abs(deg(wrist))) + '°';
      if (out.grip) out.grip.textContent = held ? 'Holding' : grip ? 'Closed' : 'Open';
    }
  }

  /* ---------- loop ---------- */
  function frame(now) {
    raf = 0;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    update(dt, now);
    draw(now);
    var busy = mode === 'user' || plan.length || wait > 0 || doneAt || parts.some(function (p) { return p.falling; });
    if (visible && !document.hidden && (!reduce.matches || busy || inside)) raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }

  readColors();
  layout();
  fk = forward();
  draw(performance.now());

  if ('ResizeObserver' in window) new ResizeObserver(function () { layout(); fk = forward(); draw(performance.now()); start(); }).observe(stage);
  else window.addEventListener('resize', function () { layout(); start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) start(); }, { rootMargin: '60px' }).observe(stage);
  } else { visible = true; start(); }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
  window.addEventListener('ff:theme', function () { readColors(); if (fk) draw(performance.now()); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (fk) draw(performance.now()); });
})();
