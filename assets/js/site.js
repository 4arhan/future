/* Farwatt — page behaviour: theme, navigation, reveals, tabs, estimator, contact form.
   Each block is independent, so removing a section from the page never breaks another. */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var mqDark = window.matchMedia('(prefers-color-scheme: dark)');
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var onMq = function (mq, fn) { if (mq.addEventListener) mq.addEventListener('change', fn); else if (mq.addListener) mq.addListener(fn); };

  /* ---------- Day / night ----------
     An explicit choice is written to <html data-theme>. With no choice the page
     follows the device setting. Canvases listen for the "ff:theme" event. */
  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : mqDark.matches;
  }

  function syncTheme() {
    var dark = isDark();
    $$('[data-set-theme]').forEach(function (b) {
      b.setAttribute('aria-pressed', String((b.getAttribute('data-set-theme') === 'dark') === dark));
    });
    var toggle = $('#theme-toggle');
    if (toggle) toggle.setAttribute('aria-label', dark ? 'Switch to day view' : 'Switch to night view');
    window.dispatchEvent(new CustomEvent('ff:theme', { detail: { dark: dark } }));
  }

  function setTheme(t) {
    try { localStorage.setItem('ff-theme', t); } catch (e) {}
    if (root.getAttribute('data-theme') === t) return;
    root.setAttribute('data-theme', t); // the observer below calls syncTheme
  }

  window.FF = { isDark: isDark, reduceMotion: function () { return mqReduce.matches; } };

  $$('[data-set-theme]').forEach(function (b) {
    b.addEventListener('click', function () { setTheme(b.getAttribute('data-set-theme')); });
  });
  var themeToggle = $('#theme-toggle');
  if (themeToggle) themeToggle.addEventListener('click', function () { setTheme(isDark() ? 'light' : 'dark'); });
  if (window.MutationObserver) {
    new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  }
  onMq(mqDark, syncTheme);
  syncTheme();

  /* ---------- Header ---------- */
  var hdr = $('.hdr');
  var nav = $('#nav');
  var menuBtn = $('#menu-toggle');

  function onScroll() { if (hdr) hdr.classList.toggle('is-stuck', window.scrollY > 6); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function setMenu(open) {
    if (!nav || !menuBtn) return;
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () { setMenu(menuBtn.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') { setMenu(false); menuBtn.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 940) setMenu(false); });
  }

  /* Mark the nav link for the section in view. */
  if ('IntersectionObserver' in window && nav) {
    var links = {};
    $$('a[href^="#"]', nav).forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var a = links[en.target.id];
        if (!a) return;
        if (en.isIntersecting) {
          Object.keys(links).forEach(function (k) { links[k].removeAttribute('aria-current'); });
          a.setAttribute('aria-current', 'true');
        } else if (a.getAttribute('aria-current')) {
          a.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-42% 0px -52% 0px' });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) spy.observe(s); });
  }

  /* ---------- Scroll reveal ----------
     Everything is visible by default. Once the visitor starts scrolling, an
     element is hidden only while it is still below the viewport and about to
     arrive, then eased in as it enters. A static capture, a jump link or a
     missing observer therefore always shows the full page. */
  (function () {
    var els = $$('.rv');
    if (!els.length || !('IntersectionObserver' in window) || mqReduce.matches) return;
    var started = false;

    function arm(el) {
      if (el._rvDone || el._rvArmed) return;
      if (el.getBoundingClientRect().top <= window.innerHeight) return; // already on screen
      el._rvArmed = true;
      el.classList.add('rv--armed');
    }

    var approach = new IntersectionObserver(function (entries) {
      if (!started) return;
      entries.forEach(function (en) { if (en.isIntersecting) arm(en.target); });
    }, { rootMargin: '0px 0px 45% 0px' });

    var enter = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el._rvDone = true;
        enter.unobserve(el);
        approach.unobserve(el);
        if (el._rvArmed) {
          var sibs = el.parentElement ? $$(':scope > .rv', el.parentElement) : [el];
          var delay = Math.min(Math.max(sibs.indexOf(el), 0), 5) * 70;
          el.classList.add('rv--in');
          el.style.transitionDelay = delay + 'ms';
          requestAnimationFrame(function () { el.classList.remove('rv--armed'); });
          setTimeout(function () { el.classList.remove('rv--in'); el.style.transitionDelay = ''; }, 900 + delay);
        }
      });
    }, { rootMargin: '0px 0px -6% 0px' });

    els.forEach(function (el) { approach.observe(el); enter.observe(el); });

    window.addEventListener('scroll', function first() {
      window.removeEventListener('scroll', first);
      started = true;
      var limit = window.innerHeight * 1.45;
      els.forEach(function (el) {
        var top = el.getBoundingClientRect().top;
        if (top > window.innerHeight && top < limit) arm(el);
      });
    }, { passive: true });
  })();

  /* ---------- Academy tracks (tabs) ---------- */
  (function () {
    var list = $('.tracks__tabs');
    if (!list) return;
    var tabs = $$('[role="tab"]', list);
    var panels = tabs.map(function (t) { return document.getElementById(t.getAttribute('aria-controls')); });

    function select(i, focus) {
      tabs.forEach(function (t, j) {
        var on = j === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (panels[j]) panels[j].hidden = !on;
      });
      if (focus) tabs[i].focus();
    }

    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(i, false); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, n = tabs.length, j = -1;
        if (k === 'ArrowDown' || k === 'ArrowRight') j = (i + 1) % n;
        else if (k === 'ArrowUp' || k === 'ArrowLeft') j = (i - 1 + n) % n;
        else if (k === 'Home') j = 0;
        else if (k === 'End') j = n - 1;
        if (j > -1) { e.preventDefault(); select(j, true); }
      });
    });
    select(0, false);
  })();

  /* ---------- Solar estimator ----------
     Every assumption is a named constant and is printed under the result. */
  (function () {
    var form = $('#calc');
    if (!form) return;
    var HECTARES_PER_MWP = 2;        // ground mount with trackers
    var KWH_PER_HOME = 4000;         // one household for a year
    var TONNES_CO2_PER_MWH = 0.45;   // grid power displaced
    var PUE = 1.2;                   // data center overhead
    var STORAGE_EFFICIENCY = 0.9;    // battery round trip
    var ACRES_PER_HECTARE = 2.471;

    var area = $('#calc-area');
    var fmt = function (n) { return Math.round(n).toLocaleString('en-US'); };
    var nice = function (n) { return n < 10 ? (Math.round(n * 10) / 10).toFixed(1) : fmt(n); };
    var roundTo = function (n, step) { return Math.round(n / step) * step; };
    var set = function (id, text) { var el = document.getElementById(id); if (el) el.textContent = text; };

    function update() {
      var ha = Number(area.value);
      var sun = Number((form.querySelector('input[name="sun"]:checked') || {}).value || 1600);
      var mwp = ha / HECTARES_PER_MWP;
      var gwh = mwp * sun / 1000;
      var homes = gwh * 1e6 / KWH_PER_HOME;
      var co2 = gwh * 1000 * TONNES_CO2_PER_MWH;
      var it = gwh * 1000 / 8760 / PUE * STORAGE_EFFICIENCY;

      set('calc-area-out', fmt(ha) + ' hectares (' + fmt(ha * ACRES_PER_HECTARE) + ' acres)');
      set('out-mwp', nice(mwp));
      set('out-gwh', nice(gwh));
      set('out-homes', fmt(roundTo(homes, homes > 5000 ? 100 : 10)));
      set('out-co2', fmt(roundTo(co2, co2 > 5000 ? 100 : 10)));
      set('out-it', nice(it));
      set('out-yield', fmt(sun));
      var pct = (ha - area.min) / (area.max - area.min) * 100;
      area.style.setProperty('--fill', pct + '%');
    }

    form.addEventListener('input', update);
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    update();
  })();

  /* ---------- Copy buttons ---------- */
  function selectText(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  $$('[data-copy]').forEach(function (btn) {
    var label = btn.textContent;
    btn.addEventListener('click', function () {
      var target = $(btn.getAttribute('data-copy'));
      if (!target) return;
      var text = target.textContent;
      var done = function () {
        btn.textContent = 'Copied';
        setTimeout(function () { btn.textContent = label; }, 1800);
      };
      var fallback = function () { selectText(target); btn.textContent = 'Selected. Press Ctrl or Cmd + C'; setTimeout(function () { btn.textContent = label; }, 3200); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    });
  });

  /* ---------- Contact form ----------
     Set data-endpoint on the <form> to a service that accepts a JSON POST
     (Formspree, Basin, your own API route) and messages are sent there.
     While it is empty nothing can be sent, so the form says so plainly and
     hands the visitor a ready-to-send draft instead. */
  (function () {
    var form = $('#contact-form');
    if (!form) return;
    var result = $('#form-result');
    var title = $('#form-result-title');
    var text = $('#form-result-text');
    var draft = $('#form-draft');
    var mailto = $('#form-mailto');
    var endpoint = (form.getAttribute('data-endpoint') || '').trim();
    var address = form.getAttribute('data-email') || '';
    var fields = [
      { el: $('#f-name'), err: $('#f-name-err'), ok: function (v) { return v.trim().length > 1; } },
      { el: $('#f-email'), err: $('#f-email-err'), ok: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); } },
      { el: $('#f-msg'), err: $('#f-msg-err'), ok: function (v) { return v.trim().length > 4; } }
    ];

    function check(f, show) {
      var valid = f.ok(f.el.value);
      if (show || valid) {
        f.el.setAttribute('aria-invalid', String(!valid));
        f.err.hidden = valid;
        if (!valid) f.el.setAttribute('aria-describedby', f.err.id); else f.el.removeAttribute('aria-describedby');
      }
      return valid;
    }
    fields.forEach(function (f) {
      f.el.addEventListener('blur', function () { if (f.el.value) check(f, true); });
      f.el.addEventListener('input', function () { if (f.el.getAttribute('aria-invalid') === 'true') check(f, true); });
    });

    function show(heading, body, withDraft) {
      title.textContent = heading;
      text.textContent = body;
      draft.hidden = !withDraft;
      draft.parentElement.querySelector('.form__resultactions').hidden = !withDraft;
      result.hidden = false;
      result.focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = fields.filter(function (f) { return !check(f, true); });
      if (bad.length) { bad[0].el.focus(); return; }

      var data = {
        name: $('#f-name').value.trim(),
        email: $('#f-email').value.trim(),
        organization: $('#f-org').value.trim(),
        topic: (form.querySelector('input[name="topic"]:checked') || {}).value || '',
        message: $('#f-msg').value.trim()
      };
      var subject = 'Website message: ' + data.topic;
      var body = [
        'Name: ' + data.name,
        'Email: ' + data.email,
        data.organization ? 'Organization: ' + data.organization : null,
        'About: ' + data.topic,
        '',
        data.message
      ].filter(function (l) { return l !== null; }).join('\n');

      draft.textContent = 'To: ' + address + '\nSubject: ' + subject + '\n\n' + body;
      if (mailto) mailto.href = 'mailto:' + address + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);

      if (!endpoint) {
        show('Your message is ready, but it has not been sent.',
          'This site is not connected to a mailbox yet. Copy the message below and email it to ' + address + '.', true);
        return;
      }

      var btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      }).then(function (res) {
        if (!res.ok) throw new Error('Request failed');
        form.reset();
        show('Message sent.', 'Thanks, ' + data.name + '. We will reply to ' + data.email + '.', false);
      }).catch(function () {
        show('We could not send that.', 'Check your connection and try again, or copy the message below and email it to ' + address + '.', true);
      }).then(function () { btn.disabled = false; });
    });
  })();

  /* Links such as "Join the waitlist" pre-select a topic in the contact form. */
  $$('a[data-topic]').forEach(function (a) {
    a.addEventListener('click', function () {
      var want = a.getAttribute('data-topic');
      $$('input[name="topic"]').forEach(function (r) { if (r.value === want) r.checked = true; });
    });
  });

  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
