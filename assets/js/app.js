/* ==========================================================================
   JAPA AGENCY · app.js
   --------------------------------------------------------------------------
   No dependencies, no build step. Everything here is progressive: if the
   script fails to load the page is still readable, navigable and styled.

   Contents
     01  config
     02  helpers
     03  theme
     04  scroll progress + sticky nav
     05  reveal on scroll
     06  hand-drawn marks (SVG draw-on) + handwriting
     07  marquees
     08  count-up numbers
     09  parallax
     10  scrollspy (nav links)
     11  FAQ accordion
     12  eligibility checker
     13  lead form
     14  mobile menu
   ========================================================================== */

(function () {
  'use strict';

  /* ---- 01 · CONFIG ----------------------------------------------------- */

  /**
   * Where the consultation form posts.
   *
   * LEAVE EMPTY AND THE FORM ONLY SIMULATES A SUBMISSION — it validates and
   * shows the success state, but nothing is sent anywhere. Set this to your
   * endpoint (Formspree, Basin, a Netlify function, your own API) before this
   * site goes anywhere near a real visitor.
   */
  var FORM_ENDPOINT = '';

  var THEME_KEY = 'japa-theme';

  /* ---- 02 · HELPERS ---------------------------------------------------- */

  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** rAF-throttled scroll handler registry — one listener for the whole page. */
  var scrollJobs = [];
  var ticking = false;

  function onScroll(fn) { scrollJobs.push(fn); }

  function runScrollJobs() {
    var y = window.pageYOffset || document.documentElement.scrollTop;
    for (var i = 0; i < scrollJobs.length; i++) scrollJobs[i](y);
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(runScrollJobs); }
  }, { passive: true });

  window.addEventListener('resize', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(runScrollJobs); }
  }, { passive: true });

  /** Build an IntersectionObserver that fires once per element. */
  function once(cb, options) {
    if (!('IntersectionObserver' in window)) {
      return { observe: function (el) { cb(el); }, disconnect: function () {} };
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        cb(entry.target);
        io.unobserve(entry.target);
      });
    }, options || { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    return io;
  }

  /* ---- 03 · THEME ------------------------------------------------------ */

  (function theme() {
    var root = document.documentElement;
    var btn = $('#theme');
    if (!btn) return;

    function sync() {
      var isDark = root.getAttribute('data-theme') === 'dark';
      btn.setAttribute('aria-checked', String(isDark));
      var meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', isDark ? '#070707' : '#FBFCFE');
    }

    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* private mode */ }
      sync();
    });

    // Follow the OS only while the visitor has not chosen for themselves.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
      var stored = null;
      try { stored = localStorage.getItem(THEME_KEY); } catch (err) {}
      if (stored) return;
      root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      sync();
    });

    sync();
  })();

  /* ---- 04 · SCROLL PROGRESS + STICKY NAV ------------------------------- */

  (function chrome() {
    var bar = $('#progress');
    var nav = $('#nav');

    onScroll(function (y) {
      if (bar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
      }
      if (nav) nav.classList.toggle('is-stuck', y > 24);
    });
  })();

  /* ---- 05 · REVEAL ON SCROLL ------------------------------------------- */

  (function reveal() {
    var els = $$('.rv');
    if (!els.length) return;

    if (reduceMotion) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = once(function (el) { el.classList.add('is-in'); });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ---- 06 · HAND-DRAWN MARKS ------------------------------------------
     Each drawable path is measured, its length written to --len, and the
     dash offset animated to zero when the mark scrolls into view. Measuring
     rather than guessing is what stops the stroke from snapping at the end.
     -------------------------------------------------------------------- */

  (function marks() {
    $$('.draw').forEach(function (path) {
      var len;
      try { len = path.getTotalLength(); } catch (e) { len = 0; }
      if (!len) return;
      // a hair of overshoot so the cap lands cleanly past the end
      path.style.setProperty('--len', Math.ceil(len + 2));
    });

    var io = once(function (el) { el.classList.add('is-drawn'); },
                  { rootMargin: '0px 0px -18% 0px', threshold: 0.2 });

    $$('[data-draw]').forEach(function (el) { io.observe(el); });

    // handwriting: the class lands on the parent, since .write is the target
    var ioWrite = once(function (el) {
      (el.parentElement || el).classList.add('is-drawn');
    }, { rootMargin: '0px 0px -20% 0px', threshold: 0.4 });

    $$('[data-write]').forEach(function (el) { ioWrite.observe(el); });
  })();

  /* ---- 07 · MARQUEES ---------------------------------------------------
     The CSS loop translates the track by exactly -50%, so the track has to
     hold precisely two copies of its content for the seam to be invisible.
     -------------------------------------------------------------------- */

  (function marquees() {
    $$('[data-marquee]').forEach(function (track) {
      var originals = Array.prototype.slice.call(track.children);
      if (!originals.length) return;

      var fragment = document.createDocumentFragment();
      originals.forEach(function (node) {
        var clone = node.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        // never let a screen reader or the tab order walk the duplicate
        $$('a, button, input', clone).forEach(function (el) { el.setAttribute('tabindex', '-1'); });
        fragment.appendChild(clone);
      });
      track.appendChild(fragment);
    });
  })();

  /* ---- 08 · COUNT-UP --------------------------------------------------- */

  (function counters() {
    var els = $$('[data-count]');
    if (!els.length) return;

    function format(n) { return n.toLocaleString('en-US'); }

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var suffix = el.getAttribute('data-suffix') || '';

      if (reduceMotion) { el.textContent = format(target) + suffix; return; }

      var duration = 1500;
      var start = null;

      function step(ts) {
        if (start === null) start = ts;
        var p = Math.min((ts - start) / duration, 1);
        // easeOutExpo — fast off the line, long settle
        var eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
        el.textContent = format(Math.round(target * eased)) + suffix;
        if (p < 1) window.requestAnimationFrame(step);
      }
      window.requestAnimationFrame(step);
    }

    var io = once(run, { threshold: 0.5 });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ---- 09 · PARALLAX ---------------------------------------------------
     Written to `translate`, not `transform`, so it composes with the float
     animations already running on the same elements instead of fighting them.
     -------------------------------------------------------------------- */

  (function parallax() {
    var els = $$('[data-px]');
    if (!els.length || reduceMotion) return;

    onScroll(function () {
      var vh = window.innerHeight;
      els.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        var strength = parseFloat(el.getAttribute('data-px')) || 0;
        // -1 at the top of the viewport, +1 at the bottom
        var progress = ((rect.top + rect.height / 2) - vh / 2) / (vh / 2);
        el.style.translate = '0 ' + (progress * strength).toFixed(2) + 'px';
      });
    });
  })();

  /* ---- 10 · SCROLLSPY -------------------------------------------------- */

  (function scrollspy() {
    var links = $$('.nav__link');
    var ids = ['services', 'process', 'destinations', 'why', 'stories', 'check', 'faq', 'contact'];
    var sections = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!sections.length) return;

    onScroll(function (y) {
      var line = y + window.innerHeight * 0.34;
      var current = 'top';

      for (var i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop <= line) current = sections[i].id;
      }

      links.forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
      });
    });
  })();

  /* ---- 11 · FAQ -------------------------------------------------------- */

  (function faq() {
    var list = $('#faqList');
    if (!list) return;

    $$('.faq__q', list).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var item = btn.closest('.faq__item');
        var isOpen = item.classList.contains('is-open');

        // accordion: only one panel open at a time
        $$('.faq__item', list).forEach(function (other) {
          other.classList.remove('is-open');
          var q = $('.faq__q', other);
          if (q) q.setAttribute('aria-expanded', 'false');
        });

        if (!isOpen) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  })();

  /* ---- 12 · ELIGIBILITY CHECKER ---------------------------------------
     A rough indicator only, and the interface says so. It runs entirely in
     the browser; nothing is stored and nothing is transmitted.
     -------------------------------------------------------------------- */

  (function checker() {
    var form = $('#checkForm');
    if (!form) return;

    var out = {
      n: $('#scoreN'),
      bar: $('#scoreBar'),
      verdict: $('#scoreVerdict'),
      notes: $('#scoreNotes')
    };

    var COUNTRY = {
      uk: { name: 'the UK',    mod:  0 },
      ca: { name: 'Canada',    mod: -3 },
      us: { name: 'the US',    mod: -6 },
      au: { name: 'Australia', mod: -4 },
      de: { name: 'Germany',   mod:  2 },
      ie: { name: 'Ireland',   mod:  0 },
      ae: { name: 'the UAE',   mod:  4 }
    };

    var GRADE   = { '4': 28, '3': 22, '2': 15, '1': 8 };
    var ENGLISH = { '3': 26, '2': 19, '1': 8, '0': 4 };
    var FUNDS   = { '4': 32, '3': 24, '2': 14, '1': 6 };
    var LEVEL   = { phd: 10, pg: 8, ug: 6, dip: 4 };

    function icon(text) {
      var li = document.createElement('li');
      li.innerHTML = '<svg class="i i--xs"><use href="#i-check-c"/></svg><span>' + text + '</span>';
      return li;
    }

    function compute() {
      var country = COUNTRY[$('#c-country').value] || COUNTRY.uk;
      var grade = $('#c-grade').value;
      var english = $('#c-english').value;
      var funds = $('#c-funds').value;
      var level = $('#c-level').value;

      var score = (GRADE[grade] || 0) + (ENGLISH[english] || 0) +
                  (FUNDS[funds] || 0) + (LEVEL[level] || 0) + country.mod;
      score = Math.max(4, Math.min(100, Math.round(score)));

      var verdict;
      if (score >= 78)      verdict = 'Strong. A file like this is normally straightforward for ' + country.name + '.';
      else if (score >= 60) verdict = 'Workable. There are gaps, but they are the kind we usually close before filing.';
      else if (score >= 40) verdict = 'Not yet. Two or three things need to move before an application to ' + country.name + ' makes sense.';
      else                  verdict = 'Too early. Worth talking about a twelve-month plan rather than an application.';

      var notes = [];
      if (+english <= 1) notes.push('Sit IELTS, TOEFL or PTE before applying &mdash; nearly every offer is conditional on it.');
      if (+funds <= 2)   notes.push('Evidenced funds are your binding constraint. Ask us for the exact maintenance threshold and holding period for ' + country.name + '.');
      if (+grade <= 2)   notes.push('Your classification narrows the school list, not the country. Pre-masters and foundation routes exist.');
      if (country.mod < 0 && +funds <= 3) notes.push(country.name.replace('the ', 'The ') + ' expects noticeably higher liquid funds than the UK or Ireland.');
      if (+english >= 3 && +funds >= 3)   notes.push('Your English score and funds are both above the usual bar &mdash; the school shortlist is where the work is.');
      notes.push('This is an indicator, not an assessment. The real one takes twenty minutes on the phone.');

      out.n.textContent = score;
      out.bar.style.width = score + '%';
      out.verdict.textContent = verdict;
      out.notes.innerHTML = '';
      notes.slice(0, 4).forEach(function (t) { out.notes.appendChild(icon(t)); });
    }

    form.addEventListener('change', compute);
    form.addEventListener('submit', function (e) { e.preventDefault(); compute(); });

    // Run once the panel is first seen, so the bar animates in rather than
    // being already full when the visitor arrives.
    var io = once(compute, { threshold: 0.3 });
    io.observe(form);
  })();

  /* ---- 13 · LEAD FORM -------------------------------------------------- */

  (function leadForm() {
    var form = $('#leadForm');
    if (!form) return;

    var status = $('#formStatus');
    var submit = $('button[type="submit"]', form);

    function say(message, tone) {
      if (!status) return;
      status.hidden = false;
      status.textContent = message;
      status.style.color = tone === 'error' ? 'var(--blue)' : 'var(--text)';
    }

    function invalid(field) {
      field.style.borderColor = 'var(--blue)';
      field.addEventListener('input', function reset() {
        field.style.borderColor = '';
        field.removeEventListener('input', reset);
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var required = $$('[required]', form);
      var firstBad = null;

      required.forEach(function (field) {
        var ok = field.value.trim() !== '' &&
                 (field.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(field.value.trim()));
        if (!ok) { invalid(field); if (!firstBad) firstBad = field; }
      });

      if (firstBad) {
        firstBad.focus();
        say('Please check the highlighted fields and try again.', 'error');
        return;
      }

      var data = {};
      new FormData(form).forEach(function (value, key) { data[key] = value; });

      submit.disabled = true;
      submit.textContent = 'Sending…';

      function done(message) {
        form.reset();
        submit.disabled = false;
        submit.innerHTML = 'Request my free consultation ' +
          '<svg class="i i--sm"><use href="#i-arrow-r"/></svg>';
        say(message);
      }

      if (!FORM_ENDPOINT) {
        console.warn(
          '[Japa Agency] FORM_ENDPOINT is empty in assets/js/app.js — this ' +
          'submission was NOT sent anywhere. Set FORM_ENDPOINT before launch.',
          data
        );
        window.setTimeout(function () {
          done('Thank you — your request has been received. A case officer will call you within one working day.');
        }, 650);
        return;
      }

      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          done('Thank you — your request has been received. A case officer will call you within one working day.');
        })
        .catch(function (err) {
          console.error('[Japa Agency] form submission failed:', err);
          submit.disabled = false;
          submit.innerHTML = 'Request my free consultation ' +
            '<svg class="i i--sm"><use href="#i-arrow-r"/></svg>';
          say('That did not go through. Please call or message us on WhatsApp instead.', 'error');
        });
    });
  })();

  /* ---- 14 · MOBILE MENU ------------------------------------------------ */

  (function menu() {
    var el = $('#menu');
    var burger = $('#burger');
    if (!el || !burger) return;

    var lastFocus = null;

    function open() {
      lastFocus = document.activeElement;
      el.hidden = false;
      // one frame so the transition has a starting state to animate from
      window.requestAnimationFrame(function () { el.classList.add('is-open'); });
      document.body.classList.add('is-locked');
      burger.setAttribute('aria-expanded', 'true');
      var first = $('a', el);
      if (first) first.focus();
    }

    function close() {
      el.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      burger.setAttribute('aria-expanded', 'false');
      window.setTimeout(function () { el.hidden = true; }, 400);
      if (lastFocus) lastFocus.focus();
    }

    burger.addEventListener('click', function () {
      el.classList.contains('is-open') ? close() : open();
    });

    $$('[data-close]', el).forEach(function (node) {
      node.addEventListener('click', close);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && el.classList.contains('is-open')) close();
    });
  })();

  /* ---- boot ------------------------------------------------------------- */
  runScrollJobs();

})();
