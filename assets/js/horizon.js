/* Farwatt — the technology horizon in the "What's next" section.
   A half-circle with the sun at its center. Each numbered dot is one business
   from the lists below it: the wedge says which field it belongs to and the
   ring says how soon. The lists in index.html are the source: this script
   only reads them, so editing the HTML is all it takes to change the chart. */
(function () {
  'use strict';

  var host = document.getElementById('horizon-chart');
  var lists = document.getElementById('horizon-lists');
  if (!host || !lists || !document.createElementNS) return;

  var NS = 'http://www.w3.org/2000/svg';
  var RINGS = ['Now', 'Next five years', 'Further out'];
  var RINGS_SHORT = ['Now', 'Next', 'Later'];

  // read the lists
  var sectors = Array.prototype.map.call(lists.querySelectorAll('.wave'), function (sec) {
    return {
      code: sec.getAttribute('data-sector'),
      items: Array.prototype.map.call(sec.querySelectorAll('li[data-n]'), function (li) {
        return { n: li.getAttribute('data-n'), ring: Number(li.getAttribute('data-ring')), li: li };
      })
    };
  });
  if (!sectors.length) return;

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, cls, anchor) {
    var t = el('text', { x: x, y: y, 'class': cls, 'text-anchor': anchor || 'middle' }, parent);
    t.textContent = str;
    return t;
  }

  var svg = null, dots = {};

  function setHot(n, on) {
    var d = dots[n];
    if (!d) return;
    d.g.classList.toggle('is-hot', on);
    d.li.classList.toggle('is-hot', on);
  }

  function render() {
    var width = Math.max(280, Math.min(960, Math.round(host.clientWidth)));
    var small = width < 560;
    var pad = small ? 20 : 30;
    var R = width / 2 - pad;                       // outer radius
    var cx = width / 2, cy = pad + R + 2;          // the sun sits on the baseline
    var height = cy + (small ? 30 : 36);
    var r0 = R * (small ? 0.2 : 0.16);             // the sun
    var band = (R - r0) / 3;
    var dotR = small ? 10 : 14;
    var pt = function (r, a) { return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
    var half = function (r) { return 'M' + (cx - r) + ' ' + cy + 'A' + r + ' ' + r + ' 0 0 1 ' + (cx + r) + ' ' + cy; };

    if (svg) host.removeChild(svg);
    dots = {};
    svg = el('svg', {
      viewBox: '0 0 ' + width + ' ' + height, width: width, height: height, role: 'img',
      'aria-label': 'Half-circle chart with the sun at its center. Thirteen numbered businesses sit in three rings: scaling now, the next five years, and further out. The lists below name each one.'
    });

    // light reaching outward: each ring a little fainter than the last
    [3, 2, 1].forEach(function (i) {
      el('path', { d: half(r0 + band * i) + 'Z', 'class': 'hz-band hz-band--' + i }, svg);
    });
    [1, 2, 3].forEach(function (i) {
      el('path', { d: half(r0 + band * i), 'class': 'hz-arc' + (i === 3 ? ' hz-arc--outer' : '') }, svg);
    });
    // one slow pulse travelling from the sun to the edge
    var pulse = el('path', { d: half(R), 'class': 'hz-pulse' }, svg);
    pulse.style.transformOrigin = cx + 'px ' + cy + 'px';

    // wedges
    var n = sectors.length, step = Math.PI / n, i;
    for (i = 1; i < n; i++) {
      var a = Math.PI - i * step, p0 = pt(r0, a), p1 = pt(R, a);
      el('line', { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], 'class': 'hz-spoke' }, svg);
    }
    el('line', { x1: cx - R - pad / 2, x2: cx + R + pad / 2, y1: cy, y2: cy, 'class': 'hz-base' }, svg);

    // the sun
    el('path', { d: half(r0) + 'Z', 'class': 'hz-sun' }, svg);
    if (!small) text(svg, cx, cy - r0 * 0.32, 'Today', 'hz-today');

    // ring names along the baseline, on both sides
    for (i = 0; i < 3; i++) {
      var mid = r0 + band * (i + 0.5), label = (small ? RINGS_SHORT : RINGS)[i];
      text(svg, cx + mid, cy + (small ? 17 : 20), label, 'hz-ring');
      text(svg, cx - mid, cy + (small ? 17 : 20), label, 'hz-ring');
    }

    sectors.forEach(function (sec, si) {
      var a0 = Math.PI - si * step, a1 = a0 - step, am = (a0 + a1) / 2;
      // wedge letter, just outside the rim
      var c = pt(R + (small ? 11 : 15), am), s = small ? 16 : 20;
      el('rect', { x: c[0] - s / 2, y: c[1] - s / 2, width: s, height: s, rx: 2, 'class': 'hz-code' }, svg);
      text(svg, c[0], c[1] + (small ? 3.5 : 4), sec.code, 'hz-code-t');

      [1, 2, 3].forEach(function (ring) {
        var group = sec.items.filter(function (it) { return it.ring === ring; });
        group.forEach(function (it, j) {
          var f = (j + 1) / (group.length + 1);
          var ang = a0 - step * (0.14 + 0.72 * f);
          if (group.length === 1) ang = am;
          var r = r0 + band * (ring - 0.5) + (group.length > 1 ? (j % 2 ? 0.2 : -0.2) * band : 0);   // stagger neighbors so they never touch
          var p = pt(r, ang);
          var g = el('g', { 'class': 'hz-dot hz-dot--' + ring, transform: 'translate(' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ')' }, svg);
          el('circle', { r: dotR + 8, 'class': 'hz-hit' }, g);
          el('circle', { r: dotR, 'class': 'hz-mark' }, g);
          text(g, 0, small ? 3.5 : 4.5, it.n, 'hz-num');
          var title = el('title', {}, g);
          var h = it.li.querySelector('h4');
          title.textContent = (h ? h.textContent : '') + ' (' + RINGS[ring - 1].toLowerCase() + ')';
          dots[it.n] = { g: g, li: it.li };
          g.addEventListener('pointerenter', function () { setHot(it.n, true); });
          g.addEventListener('pointerleave', function () { setHot(it.n, false); });
          g.addEventListener('click', function () {
            it.li.scrollIntoView({ block: 'center', behavior: 'smooth' });
            setHot(it.n, true);
            setTimeout(function () { setHot(it.n, false); }, 1800);
          });
        });
      });
    });

    host.appendChild(svg);
  }

  // the lists light up their dot too
  sectors.forEach(function (sec) {
    sec.items.forEach(function (it) {
      it.li.addEventListener('pointerenter', function () { setHot(it.n, true); });
      it.li.addEventListener('pointerleave', function () { setHot(it.n, false); });
    });
  });

  render();
  var lastW = host.clientWidth;
  var onResize = function () {
    if (Math.abs(host.clientWidth - lastW) < 2) return;
    lastW = host.clientWidth;
    render();
  };
  if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(host);
  else window.addEventListener('resize', onResize);
})();
