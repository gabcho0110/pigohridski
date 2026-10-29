/* ==========================================================================
   ПИГ „Св. Климент Охридски“ – София
   Логика на публичния сайт (рутер, изгледи, галерия)
   ========================================================================== */
(function () {
  'use strict';

  var C = window.PIG_CONTENT || {};
  var S = C.site || {};
  var BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

  /* ------------------------------------------------------------------ utils */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function isMedia(v) { return /^media\/[A-Za-z0-9_-]+$/.test(String(v || '')); }

  /* изображение: относителен път или запис в RTDB (media/<id>) */
  function imgTag(value, alt, extra) {
    if (!value) return '';
    extra = extra || '';
    if (isMedia(value)) {
      return '<img data-media="' + esc(String(value).slice(6)) + '" src="' + BLANK + '" alt="' + esc(alt || '') + '"' + extra + '>';
    }
    return '<img src="' + esc(value) + '" alt="' + esc(alt || '') + '"' + extra + '>';
  }

  function resolveImages(root) {
    if (!window.PIG || !PIG.loadMedia) return;
    var imgs = root.querySelectorAll('img[data-media]');
    Array.prototype.forEach.call(imgs, function (img) {
      PIG.loadMedia(img.getAttribute('data-media')).then(function (u) {
        if (u) img.src = u;
      });
    });
  }

  var MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли',
    'август', 'септември', 'октомври', 'ноември', 'декември'];
  var MONTHS_SHORT = ['ян.', 'февр.', 'март', 'апр.', 'май', 'юни', 'юли',
    'авг.', 'септ.', 'окт.', 'ноем.', 'дек.'];

  function parseDate(iso) {
    if (!iso) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (!m) {
      var d0 = new Date(iso);
      return isNaN(d0) ? null : d0;
    }
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function fmtDate(iso) {
    var d = parseDate(iso);
    if (!d) return '';
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  function fmtShort(iso) {
    var d = parseDate(iso);
    if (!d) return { dd: '', mm: '' };
    return { dd: String(d.getDate()), mm: MONTHS_SHORT[d.getMonth()] };
  }

  function initials(name) {
    return String(name || '').trim().split(/\s+/).slice(0, 2)
      .map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
  }

  function avatar(name, photo, size) {
    var cls = 'avatar' + (size ? ' avatar--' + size : '');
    if (photo) {
      return '<span class="' + cls + '">' + imgTag(photo, name, ' loading="lazy"') + '</span>';
    }
    return '<span class="' + cls + '" aria-hidden="true">' + esc(initials(name)) + '</span>';
  }

  /* ------------------------------------------------------- minimal markdown */
  function inlineMd(t) {
    return esc(t)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(–—])\*([^*\n]+)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function md(src) {
    var blocks = String(src == null ? '' : src).split(/\n{2,}/);
    return blocks.map(function (raw) {
      var b = raw.trim();
      if (!b) return '';
      var lines = b.split('\n');
      var isList = lines.every(function (l) { return /^\s*[-*]\s+/.test(l); });
      if (isList) {
        return '<ul>' + lines.map(function (l) {
          return '<li>' + inlineMd(l.replace(/^\s*[-*]\s+/, '')) + '</li>';
        }).join('') + '</ul>';
      }
      if (/^#{2,3}\s+/.test(b) && lines.length === 1) {
        return '<h3>' + inlineMd(b.replace(/^#{2,3}\s+/, '')) + '</h3>';
      }
      return '<p>' + lines.map(inlineMd).join('<br>') + '</p>';
    }).join('\n');
  }

  /* ------------------------------------------------------------- components */
  function pageHead(title, lead, crumb) {
    return '' +
      '<div class="page-head"><div class="wrap">' +
        (crumb ? '<div class="crumbs" style="padding-top:0;margin-bottom:10px">' + crumb + '</div>' : '') +
        '<h1>' + esc(title) + '</h1>' +
        (lead ? '<p>' + esc(lead) + '</p>' : '') +
      '</div></div>';
  }

  function newsCard(n, feature) {
    var st = fmtShort(n.date);
    var visual = n.image
      ? '<div class="news-thumb">' + imgTag(n.image, n.title, ' loading="lazy"') + '</div>'
      : '<div class="news-stamp"><span class="dd">' + esc(st.dd) + '</span><span class="mm">' + esc(st.mm) + '</span></div>';
    return '' +
      '<article class="news-card' + (feature ? ' news-card--feature' : '') + (n.image ? '' : ' news-card--text') + ' reveal">' +
        visual +
        '<div class="news-body">' +
          '<div class="news-meta">' +
            (n.category ? '<span class="tag">' + esc(n.category) + '</span>' : '') +
            '<span class="news-date">' + esc(fmtDate(n.date)) + '</span>' +
          '</div>' +
          '<h3><a href="#/novina/' + encodeURIComponent(n.id) + '">' + esc(n.title) + '</a></h3>' +
          '<p>' + esc(n.excerpt || '') + '</p>' +
          '<a class="link-arrow" href="#/novina/' + encodeURIComponent(n.id) + '">Прочети <svg width="16" height="16" aria-hidden="true"><use href="#i-arrow"></use></svg></a>' +
        '</div>' +
      '</article>';
  }

  function sortedNews() {
    return (C.news || []).slice().sort(function (a, b) {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  }

  function statStrip() {
    var stats = S.stats || [];
    if (!stats.length) return '';
    return '<div class="wrap"><div class="stats">' + stats.map(function (s) {
      return '<div class="stat"><span class="value">' + esc(s.value) + '</span><span class="label">' + esc(s.label) + '</span></div>';
    }).join('') + '</div></div>';
  }

  function factsCard() {
    var cls = C.classes || [];
    var profiles = {};
    cls.forEach(function (c) { if (c.profile) profiles[c.profile] = 1; });
    var students = cls.reduce(function (s, c) { return s + (Number(c.students) || 0); }, 0);

    function byLabel(re) {
      var list = S.stats || [];
      for (var i = 0; i < list.length; i++) {
        if (re.test(String(list[i].label || ''))) return list[i].value;
      }
      return null;
    }

    var rows = [];
    if (S.founded) rows.push(['Основаване', S.founded]);
    if (Object.keys(profiles).length) rows.push(['Профили', Object.keys(profiles).length]);
    rows.push(['Паралелки', byLabel(/паралелк/i) || cls.length || '—']);
    rows.push(['Ученици', byLabel(/учениц/i) || students || '—']);
    var teachers = byLabel(/учител/i);
    if (teachers) rows.push(['Учители', teachers]);
    if (S.address) rows.push(['Адрес', S.address.replace(/^гр\.\s*/, '')]);

    return '<div class="facts">' +
      '<h3>Училището накратко</h3>' +
      '<dl>' + rows.map(function (r) {
        return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
      }).join('') + '</dl>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ views */
  function viewHome() {
    var news = sortedNews().slice(0, 3);
    var about = S.about || {};
    var dir = about.director || {};
    var gal = (C.gallery || []).slice(0, 3);

    var profiles = {};
    (C.classes || []).forEach(function (c) {
      if (!c.profile) return;
      profiles[c.profile] = profiles[c.profile] || { name: c.profile, classes: 0, students: 0, desc: c.description };
      profiles[c.profile].classes++;
      profiles[c.profile].students += Number(c.students) || 0;
    });
    var profileList = Object.keys(profiles).map(function (k) { return profiles[k]; });

    return '' +
      /* hero */
      '<section class="hero">' +
        '<div class="wrap">' +
          '<div>' +
            (S.heroKicker ? '<div class="hero-kicker"><span class="dot"></span>' + esc(S.heroKicker) + '</div>' : '') +
            '<h1>' + esc(S.heroTitle || '') + '</h1>' +
            '<p class="hero-lead">' + esc(S.heroLead || '') + '</p>' +
            '<div class="hero-actions">' +
              '<a class="btn btn-primary" href="#/za-uchilishteto">За училището</a>' +
            '</div>' +
            (S.motto ? '<div class="hero-motto">' + esc(S.motto) + '</div>' : '') +
          '</div>' +
          '<div class="hero-figure">' +
            '<div class="hero-frame">' +
              imgTag(S.heroImage, 'Сградата на училището', ' fetchpriority="high"') +
            '</div>' +
            '<div class="hero-badge">' +
              '<span class="num">' + esc(String(S.founded || '')) + '</span>' +
              '<span class="lbl">година на основаване<br>' +
              (S.founded ? (new Date().getFullYear() - Number(S.founded)) + ' години традиция' : '') + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      /* stats */
      '<section class="section--tight" style="padding:38px 0 0">' + statStrip() + '</section>' +

      /* news */
      '<section class="section"><div class="wrap">' +
        '<div class="section-head" style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px;max-width:none">' +
          '<div><span class="kicker">Новини</span><h2 style="margin-bottom:0">Какво се случва в училище</h2></div>' +
          '<a class="link-arrow" href="#/novini" style="margin-bottom:6px">Всички новини <svg width="16" height="16" aria-hidden="true"><use href="#i-arrow"></use></svg></a>' +
        '</div>' +
        (news.length
          ? '<div class="grid grid-3">' + news.map(function (n) { return newsCard(n, false); }).join('') + '</div>'
          : '<div class="empty">Все още няма публикувани новини.</div>') +
      '</div></section>' +

      /* about + director */
      '<section class="section section--cream"><div class="wrap">' +
        '<div class="about-grid">' +
          '<div class="reveal">' +
            '<span class="kicker">За училището</span>' +
            '<h2>' + esc(about.title || '') + '</h2>' +
            '<p class="about-lead">' + esc(about.lead || '') + '</p>' +
            '<div class="prose" style="font-size:15.5px">' + md(String(about.body || '').split('\n\n').slice(0, 2).join('\n\n')) + '</div>' +
            '<a class="link-arrow" href="#/za-uchilishteto">Научете повече <svg width="16" height="16" aria-hidden="true"><use href="#i-arrow"></use></svg></a>' +
          '</div>' +
          '<div>' +
            '<div class="director-card reveal">' +
              '<div class="who">' +
                avatar(dir.name, dir.photo, 'lg') +
                '<div><h3>' + esc(dir.name || '') + '</h3><span>' + esc(dir.role || '') + '</span></div>' +
              '</div>' +
              '<div class="prose" style="font-size:14.5px;color:rgba(255,255,255,.76)">' + md(dir.greeting || '') + '</div>' +
              '<div class="sign">' + esc(dir.name || '') + '</div>' +
            '</div>' +
            factsCard() +
          '</div>' +
        '</div>' +
      '</div></section>' +

      /* profiles */
      (profileList.length ?
      '<section class="section"><div class="wrap">' +
        '<div class="section-head section-head--center"><span class="kicker">Обучение</span><h2>Четири посоки, една основа</h2>' +
        '<p>Профилите се избират при кандидатстване в осми клас. Всяка паралелка има класен ръководител и свой кабинет.</p></div>' +
        '<div class="grid grid-4">' + profileList.map(function (p) {
          return '<div class="value-card reveal">' +
            '<span class="idx">' + esc(p.classes) + ' паралелки · ' + esc(p.students) + ' ученици</span>' +
            '<h3>' + esc(p.name) + '</h3>' +
            '<p>' + esc(p.desc || '') + '</p>' +
          '</div>';
        }).join('') + '</div>' +
        '<div style="text-align:center;margin-top:34px"><a class="btn btn-ghost" href="#/paralelki">Всички паралелки</a></div>' +
      '</div></section>' : '') +

      /* gallery strip */
      (gal.length ?
      '<section class="section section--cream"><div class="wrap">' +
        '<div class="section-head" style="display:flex;justify-content:space-between;align-items:flex-end;gap:24px;max-width:none">' +
          '<div><span class="kicker">Галерия</span><h2 style="margin-bottom:0">Училището в кадри</h2></div>' +
          '<a class="link-arrow" href="#/galeria" style="margin-bottom:6px">Цялата галерия <svg width="16" height="16" aria-hidden="true"><use href="#i-arrow"></use></svg></a>' +
        '</div>' +
        '<div class="gallery-grid">' + gal.map(function (g) {
          return '<button class="gallery-item reveal" data-full="' + esc(g.image) + '" data-cap="' + esc(g.title) + '" aria-label="' + esc(g.title) + '">' +
            imgTag(g.image, g.title, ' loading="lazy"') +
            '<figcaption>' + esc(g.title) + '</figcaption></button>';
        }).join('') + '</div>' +
      '</div></section>' : '');
  }

  function viewAbout() {
    var a = S.about || {};
    var dir = a.director || {};
    var bells = S.bells || [];
    var pages = (C.pages || []).filter(function (p) { return p.slug === 'klubove' || p.slug === 'uchenicheski-savet'; });

    return pageHead('За училището', S.tagline || '', '<a href="#/">Начало</a><span>/</span>За училището') +
      '<section class="section"><div class="wrap">' +
        '<div class="about-grid">' +
          '<div>' +
            '<p class="about-lead">' + esc(a.lead || '') + '</p>' +
            '<div class="prose">' + md(a.body || '') + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="director-card reveal">' +
              '<div class="who">' + avatar(dir.name, dir.photo, 'lg') +
                '<div><h3>' + esc(dir.name || '') + '</h3><span>' + esc(dir.role || '') + '</span></div></div>' +
              '<div class="prose" style="font-size:14.6px;color:rgba(255,255,255,.78)">' + md(dir.greeting || '') + '</div>' +
            '</div>' +
            factsCard() +
          '</div>' +
        '</div>' +
      '</div></section>' +

      (bells.length ?
      '<section class="section section--tight section--white"><div class="wrap">' +
        '<div class="section-head"><span class="kicker">Разписание</span><h2>График на звънците</h2>' +
        '<p>Седем учебни часа дневно. Междучасията са с различна дължина — заради обедната почивка след четвъртия час.</p></div>' +
        '<div class="bells-strip">' + bells.map(function (b) {
          return '<div class="bell-cell"><span class="bn">' + esc(b.n) + '</span>' +
            '<span class="bt">' + esc(b.from) + '</span><span class="bd">–</span><span class="bt">' + esc(b.to) + '</span></div>';
        }).join('') + '</div>' +
      '</div></section>' : '') +

      ((a.values || []).length ?
      '<section class="section section--cream"><div class="wrap">' +
        '<div class="section-head"><span class="kicker">Принципи</span><h2>На какво държим</h2></div>' +
        '<div class="grid grid-2">' + a.values.map(function (v, i) {
          return '<div class="value-card reveal"><span class="idx">0' + (i + 1) + '</span><h3>' + esc(v.title) + '</h3><p>' + esc(v.text) + '</p></div>';
        }).join('') + '</div>' +
      '</div></section>' : '') +

      (pages.length ?
      '<section class="section"><div class="wrap">' +
        '<div class="section-head"><span class="kicker">Училищен живот</span><h2>Извън часовете</h2></div>' +
        '<div class="grid grid-2">' + pages.map(function (p) {
          return '<a class="value-card reveal" href="#/stranica/' + encodeURIComponent(p.slug) + '" style="display:block;color:inherit">' +
            '<h3>' + esc(p.title) + '</h3>' +
            '<p>' + esc(String(p.body || '').replace(/[*#\[\]]/g, '').split('\n')[0].slice(0, 150)) + '…</p>' +
            '<span class="link-arrow" style="margin-top:14px">Виж <svg width="16" height="16" aria-hidden="true"><use href="#i-arrow"></use></svg></span>' +
          '</a>';
        }).join('') + '</div>' +
      '</div></section>' : '');
  }

  function viewNews() {
    var list = sortedNews();
    return pageHead('Новини', 'Съобщения, постижения и събития от училищния живот.',
      '<a href="#/">Начало</a><span>/</span>Новини') +
      '<section class="section"><div class="wrap">' +
        (list.length ?
          '<div class="news-list">' + list.map(function (n) {
            var d = parseDate(n.date);
            return '<article class="news-row reveal">' +
              '<div class="d">' + (d ? d.getDate() + ' ' + MONTHS[d.getMonth()] : '') + '<small>' + (d ? d.getFullYear() : '') + '</small></div>' +
              '<div>' +
                (n.category ? '<span class="tag" style="margin-bottom:8px;display:inline-block">' + esc(n.category) + '</span>' : '') +
                '<h3><a href="#/novina/' + encodeURIComponent(n.id) + '">' + esc(n.title) + '</a></h3>' +
                '<p>' + esc(n.excerpt || '') + '</p>' +
              '</div>' +
              '<a class="link-arrow" href="#/novina/' + encodeURIComponent(n.id) + '" aria-label="Прочети">' +
                '<svg width="18" height="18" aria-hidden="true"><use href="#i-arrow"></use></svg></a>' +
            '</article>';
          }).join('') + '</div>'
          : '<div class="empty">Все още няма публикувани новини.</div>') +
      '</div></section>';
  }

  function viewArticle(id) {
    var n = (C.news || []).filter(function (x) { return x.id === id; })[0];
    if (!n) return viewNotFound();
    var others = sortedNews().filter(function (x) { return x.id !== id; }).slice(0, 3);
    return '<div class="page-head" style="padding-bottom:34px"><div class="wrap">' +
        '<div class="crumbs" style="padding-top:0;margin-bottom:16px"><a href="#/">Начало</a><span>/</span><a href="#/novini">Новини</a><span>/</span>' + esc(n.title) + '</div>' +
        '<div class="article-head"><h1>' + esc(n.title) + '</h1>' +
          '<div class="article-meta">' +
            (n.category ? '<span class="tag tag--gold">' + esc(n.category) + '</span>' : '') +
            '<span>' + esc(fmtDate(n.date)) + '</span>' +
          '</div>' +
        '</div>' +
      '</div></div>' +
      '<section class="section" style="padding-top:40px"><div class="wrap">' +
        (n.image ? '<div class="article-cover">' + imgTag(n.image, n.title) + '</div>' : '') +
        '<div class="prose">' + md(n.body || n.excerpt || '') + '</div>' +
        '<div style="margin-top:40px;padding-top:26px;border-top:1px solid var(--line)">' +
          '<a class="link-arrow" href="#/novini">← Всички новини</a>' +
        '</div>' +
      '</div></section>' +
      (others.length ?
      '<section class="section section--cream"><div class="wrap">' +
        '<div class="section-head"><span class="kicker">Още</span><h2>Други новини</h2></div>' +
        '<div class="grid grid-3">' + others.map(function (x) { return newsCard(x, false); }).join('') + '</div>' +
      '</div></section>' : '');
  }

  function viewClasses() {
    var list = C.classes || [];
    return pageHead('Паралелки и профили', 'Учебната 2026/2027 година в 24 паралелки. По-долу са публикуваните класове, техните профили и класни ръководители.',
      '<a href="#/">Начало</a><span>/</span>Паралелки') +
      '<section class="section"><div class="wrap">' +
        (list.length ?
        '<div class="grid grid-3">' + list.map(function (c) {
          return '<div class="class-card reveal">' +
            '<div class="top"><span class="cname">' + esc(c.name) + '</span><span class="count">' + esc(c.students || '') + ' ученици</span></div>' +
            '<span class="profile">' + esc(c.profile || '') + '</span>' +
            '<p>' + esc(c.description || '') + '</p>' +
            '<div class="meta"><span>Класен ръководител: ' + esc(c.curator || '—') + '</span><span>' + esc(c.room || '') + '</span></div>' +
          '</div>';
        }).join('') + '</div>'
        : '<div class="empty">Информацията за паралелките предстои да бъде публикувана.</div>') +
      '</div></section>';
  }

  function viewTeachers() {
    var list = C.teachers || [];
    return pageHead('Учители', 'Екипът, който стои зад всеки учебен час. Можете да се свържете с всеки учител чрез деловодството.',
      '<a href="#/">Начало</a><span>/</span>Учители') +
      '<section class="section"><div class="wrap">' +
        (list.length ?
        '<div class="grid grid-2">' + list.map(function (t) {
          return '<div class="teacher-card reveal">' + avatar(t.name, t.photo) +
            '<div>' +
              (t.role ? '<span class="role">' + esc(t.role) + '</span>' : '') +
              '<h3>' + esc(t.name) + '</h3>' +
              '<div class="subject">' + esc(t.subject || '') + '</div>' +
              '<p class="bio">' + esc(t.bio || '') + '</p>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>'
        : '<div class="empty">Списъкът на учителите предстои да бъде публикуван.</div>') +
      '</div></section>';
  }

  function viewGallery() {
    var list = (C.gallery || []).slice().sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    return pageHead('Галерия', 'Снимки от празници, пътувания, часове и обикновени дни в училището.',
      '<a href="#/">Начало</a><span>/</span>Галерия') +
      '<section class="section"><div class="wrap">' +
        (list.length ?
        '<div class="gallery-grid">' + list.map(function (g) {
          return '<button class="gallery-item reveal" data-full="' + esc(g.image) + '" data-cap="' + esc(g.title) + '" aria-label="' + esc(g.title) + '">' +
            imgTag(g.image, g.title, ' loading="lazy"') +
            '<figcaption>' + esc(g.title) + (g.date ? ' · ' + esc(fmtDate(g.date)) : '') + '</figcaption>' +
          '</button>';
        }).join('') + '</div>'
        : '<div class="empty">Все още няма качени снимки.</div>') +
      '</div></section>';
  }

  function viewDocuments() {
    var list = C.documents || [];
    var cats = {};
    list.forEach(function (d) {
      var k = d.category || 'Друго';
      (cats[k] = cats[k] || []).push(d);
    });
    var body = list.length
      ? Object.keys(cats).map(function (k) {
          return '<h3 style="margin:38px 0 6px;font-size:1.15rem">' + esc(k) + '</h3>' +
            '<div class="doc-list">' + cats[k].map(function (d) {
              var ext = /\.pdf$/i.test(d.url || '') ? 'PDF' : (/\.docx?$/i.test(d.url || '') ? 'DOC' : (/\.html?$/i.test(d.url || '') ? 'HTML' : 'FILE'));
              var isHtml = /\.html?$/i.test(d.url || '');
              return '<div class="doc-row reveal">' +
                '<span class="doc-icon">' + esc(ext) + '</span>' +
                '<div><h3>' + esc(d.title) + '</h3>' +
                  '<div class="dmeta"><span class="cat">' + esc(d.category || '') + '</span>' +
                  (d.date ? '<span>' + esc(fmtDate(d.date)) + '</span>' : '') +
                  (d.note ? '<span>' + esc(d.note) + '</span>' : '') + '</div></div>' +
                (d.url
                  ? '<a class="dl" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + (isHtml ? 'Отвори' : 'Изтегли') + '</a>'
                  : '<span class="dl" aria-disabled="true">Очаква качване</span>') +
              '</div>';
            }).join('') + '</div>';
        }).join('')
      : '<div class="empty">Все още няма публикувани документи.</div>';

    return pageHead('Документи', 'Нормативни документи, учебни планове и образци за изтегляне.',
      '<a href="#/">Начало</a><span>/</span>Документи') +
      '<section class="section" style="padding-top:34px"><div class="wrap">' +
        '<div class="prose" style="max-width:70ch;margin-bottom:10px"><p>Всички документи се публикуват в PDF или DOCX формат. Ако не откривате необходим документ, обърнете се към деловодството.</p></div>' +
        body +
      '</div></section>';
  }

  function viewContacts() {
    var soc = S.social || {};
    var socialLinks = [
      ['facebook', 'i-fb', 'Facebook'],
      ['instagram', 'i-ig', 'Instagram'],
      ['youtube', 'i-yt', 'YouTube']
    ].filter(function (s) { return soc[s[0]]; });

    return pageHead('Контакти', 'Намерете ни, обадете се или ни пишете — отговаряме до един учебен ден.',
      '<a href="#/">Начало</a><span>/</span>Контакти') +
      '<section class="section"><div class="wrap">' +
        '<div class="contact-grid">' +
          '<div>' +
            '<div class="contact-item"><span class="ic"><svg width="18" height="18"><use href="#i-pin"></use></svg></span>' +
              '<div><h4>Адрес</h4><div class="v">' + esc(S.address || '') + '</div><div class="n">Център, до метростанция „Сердика“</div></div></div>' +
            '<div class="contact-item"><span class="ic"><svg width="18" height="18"><use href="#i-phone"></use></svg></span>' +
              '<div><h4>Телефон</h4><div class="v"><a href="tel:' + esc(String(S.phone || '').replace(/\s/g, '')) + '">' + esc(S.phone || '') + '</a></div>' +
              '<div class="n">' + esc(S.phoneNote || '') + '</div></div></div>' +
            '<div class="contact-item"><span class="ic"><svg width="18" height="18"><use href="#i-mail"></use></svg></span>' +
              '<div><h4>Електронна поща</h4><div class="v"><a href="mailto:' + esc(S.email || '') + '">' + esc(S.email || '') + '</a></div>' +
              '<div class="n">' + esc(S.emailNote || '') + '</div></div></div>' +
            '<div class="contact-item"><span class="ic"><svg width="18" height="18"><use href="#i-clock"></use></svg></span>' +
              '<div><h4>Работно време</h4><div class="v">' + esc(S.workHours || '') + '</div>' +
              '<div class="n">Дежурен учител приема родители всеки ден до 17:00 ч.</div></div></div>' +
            (socialLinks.length ? '<div style="margin-top:24px;display:flex;gap:10px">' + socialLinks.map(function (s) {
              return '<a class="btn btn-ghost btn-sm" href="' + esc(soc[s[0]]) + '" target="_blank" rel="noopener">' +
                '<svg width="15" height="15" aria-hidden="true"><use href="#' + s[1] + '"></use></svg> ' + s[2] + '</a>';
            }).join('') + '</div>' : '') +
          '</div>' +
          '<div>' +
            '<div class="map-frame">' + (S.mapEmbed
              ? '<iframe src="' + esc(S.mapEmbed) + '" title="Карта" loading="lazy"></iframe>'
              : '<div class="empty" style="border:0">Картата не е конфигурирана.</div>') + '</div>' +
            (S.mapLink ? '<div style="margin-top:14px"><a class="link-arrow" href="' + esc(S.mapLink) + '" target="_blank" rel="noopener">Отвори в карта <svg width="16" height="16" aria-hidden="true"><use href="#i-arrow"></use></svg></a></div>' : '') +
          '</div>' +
        '</div>' +
      '</div></section>';
  }

  function viewPage(slug) {
    var p = (C.pages || []).filter(function (x) { return x.slug === slug; })[0];
    if (!p) return viewNotFound();
    return pageHead(p.title, '', '<a href="#/">Начало</a><span>/</span>' + esc(p.title)) +
      '<section class="section"><div class="wrap">' +
        '<div class="prose">' + md(p.body || '') + '</div>' +
        '<div style="margin-top:36px;padding-top:24px;border-top:1px solid var(--line)"><a class="link-arrow" href="#/za-uchilishteto">← За училището</a></div>' +
      '</div></section>';
  }

  /* ---------------------------------------------------------------- careers */
  var CURRENT_YEAR = new Date().getFullYear();

  function minBirthAge() {
    return Number((S.careers || {}).minAge) || 14;
  }

  function minBirthYear() {
    return CURRENT_YEAR - minBirthAge();
  }

  function activeJobs() {
    return (C.careers || []).filter(function (j) { return j.active !== false; });
  }

  function jobCard(j) {
    var reqs = String(j.requirements || '').split('\n').filter(function (l) { return l.trim(); });
    return '<article class="job-card reveal">' +
      '<div class="job-body">' +
        '<div class="job-top">' +
          (j.type ? '<span class="tag tag--gold">' + esc(j.type) + '</span>' : '') +
          (j.deadline ? '<span class="job-deadline">Краен срок: ' + esc(fmtDate(j.deadline)) + '</span>' : '') +
        '</div>' +
        '<h3>' + esc(j.title) + '</h3>' +
        '<div class="job-meta">' +
          (j.department ? '<span>' + esc(j.department) + '</span>' : '') +
          (j.location ? '<span>' + esc(j.location) + '</span>' : '') +
          (j.salary ? '<span>' + esc(j.salary) + '</span>' : '') +
        '</div>' +
        '<p class="job-summary">' + esc(j.summary || '') + '</p>' +
        '<details class="job-more"><summary>Пълно описание и изисквания</summary>' +
          '<div class="prose" style="font-size:14.8px">' + md(j.description || '') + '</div>' +
          (reqs.length ? '<h4 class="job-req-title">Изисквания</h4><ul class="job-req">' +
            reqs.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('') + '</ul>' : '') +
        '</details>' +
      '</div>' +
      '<div class="job-side">' +
        '<button type="button" class="btn btn-primary btn-sm" data-apply="' + esc(j.id) + '">Кандидатствай</button>' +
      '</div>' +
    '</article>';
  }

  /* Събеседванията се провеждат в Discord сървъра на училището */
  var DISCORD_ICON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true">' +
    '<path d="M19.3 5.3A16 16 0 0 0 15.4 4l-.3.6a12 12 0 0 0-6.2 0L8.6 4a16 16 0 0 0-3.9 1.3C2.2 9.1 1.5 12.8 1.9 16.4a16 16 0 0 0 4.8 2.4l.6-1a10 10 0 0 1-1.7-.8l.4-.3a11.5 11.5 0 0 0 9.9 0l.4.3c-.5.3-1.1.6-1.7.8l.6 1a16 16 0 0 0 4.8-2.4c.5-4.2-.6-7.8-2.7-11.1ZM8.7 14.4c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9Zm6.6 0c-.9 0-1.7-.9-1.7-1.9s.8-1.9 1.7-1.9 1.7.9 1.7 1.9-.8 1.9-1.7 1.9Z"/></svg>';

  var DISCORD_DEFAULT_NOTE = 'Събеседването се провежда онлайн, в Discord сървъра на училището. ' +
    'Поканата идва по имейл и съдържа връзка към сървъра — нужни са ви микрофон и стабилна връзка.';

  function discordNote(cfg) {
    var text = cfg.interviewNote == null ? DISCORD_DEFAULT_NOTE : cfg.interviewNote;
    var invite = String(cfg.discordInvite || '').trim();
    if (invite && !/^https?:\/\//i.test(invite)) invite = '';
    if (!text && !invite) return '';
    return '<div class="discord-note">' +
      '<span class="dn-ic">' + DISCORD_ICON + '</span>' +
      '<div class="dn-body">' +
        '<b>Събеседването е в Discord</b>' +
        (text ? '<p>' + esc(text) + '</p>' : '') +
        (invite ? '<a class="btn btn-ghost btn-sm" href="' + esc(invite) + '" target="_blank" rel="noopener">Влез в сървъра</a>' : '') +
      '</div></div>';
  }

  function viewCareers() {
    var cfg = S.careers || {};
    var jobs = activeJobs();
    var maxYear = minBirthYear();
    var minAge = Number(cfg.minAge) || 14;

    var options = jobs.map(function (j) {
      return '<option value="' + esc(j.title) + '">' + esc(j.title) + '</option>';
    }).join('');
    var hasJobs = jobs.length > 0;
    var contactMail = cfg.contactEmail || 'karieri@pig-ohridski.bg';

    return pageHead('Кариери', cfg.intro || 'Отворени позиции в училището.',
      '<a href="#/">Начало</a><span>/</span>Кариери') +
      '<section class="section" style="padding-top:44px"><div class="wrap">' +
        (jobs.length
          ? '<div class="jobs">' + jobs.map(jobCard).join('') + '</div>'
          : '<div class="empty">В момента няма отворени позиции. Проверете отново след няколко седмици или ни пишете на ' +
            '<a href="mailto:' + esc(contactMail) + '">' + esc(contactMail) + '</a>.</div>') +
      '</div></section>' +

      (hasJobs ? '<section class="section section--cream" id="apply"><div class="wrap"><div class="apply-grid">' +
          '<div>' +
            '<span class="kicker">Кандидатстване</span>' +
            '<h2>Изпратете кандидатура</h2>' +
            '<p style="color:var(--ink-500);max-width:40ch">Попълнете четири полета — име, телефон, имейл и година на раждане. Кандидатурата пристига директно при нас.</p>' +
            '<ul class="apply-list">' +
              '<li>Отговаряме на всеки кандидат в срок до 10 работни дни.</li>' +
              '<li>Събеседването се провежда в <b>Discord сървъра</b> на училището.</li>' +
              '<li>Минимална възраст за кандидатстване: <b>' + esc(minAge) + ' години</b>.</li>' +
              '<li>Данните се използват само за целите на подбора.</li>' +
            '</ul>' +
            discordNote(cfg) +
            (cfg.note ? '<p class="small" style="color:var(--ink-400);max-width:40ch;margin-top:18px">' + esc(cfg.note) + '</p>' : '') +
          '</div>' +
          '<div class="apply-card">' +
            '<form id="applyForm" novalidate>' +
              '<div class="fld-row">' +
                '<div class="fld">' +
                  '<label for="apName">Име и фамилия</label>' +
                  '<input id="apName" name="name" type="text" autocomplete="name" placeholder="Иван Петров">' +
                  '<span class="err" data-err="name"></span>' +
                '</div>' +
                '<div class="fld">' +
                  '<label for="apYear">Година на раждане</label>' +
                  '<input id="apYear" name="year" type="number" inputmode="numeric" min="1940" max="' + CURRENT_YEAR + '" placeholder="2005">' +
                  '<span class="hint" data-hint="year">Родени през ' + maxYear + ' г. или по-рано.</span>' +
                  '<span class="err" data-err="year"></span>' +
                '</div>' +
              '</div>' +
              '<div class="fld-row">' +
                '<div class="fld">' +
                  '<label for="apPhone">Телефон</label>' +
                  '<input id="apPhone" name="phone" type="tel" autocomplete="tel" placeholder="+359 88 123 4567">' +
                  '<span class="err" data-err="phone"></span>' +
                '</div>' +
                '<div class="fld">' +
                  '<label for="apEmail">Имейл</label>' +
                  '<input id="apEmail" name="email" type="email" autocomplete="email" placeholder="ivan@example.com">' +
                  '<span class="err" data-err="email"></span>' +
                '</div>' +
              '</div>' +
              '<div class="fld">' +
                '<label for="apPos">Позиция</label>' +
                '<select id="apPos" name="position">' + options + '</select>' +
              '</div>' +
              '<label class="consent">' +
                '<input type="checkbox" id="apConsent" name="consent">' +
                '<span>Съгласявам се личните ми данни (име, телефон, имейл и година на раждане) да бъдат обработени за целите на подбора.</span>' +
              '</label>' +
              '<span class="err" data-err="consent"></span>' +
              '<div class="hp" aria-hidden="true"><label>Website<input type="text" id="apSite" tabindex="-1" autocomplete="off"></label></div>' +
              '<button class="btn btn-primary" type="submit" id="apSubmit" style="width:100%;margin-top:6px">Изпрати кандидатура</button>' +
              '<div class="form-status" id="apStatus" role="status"></div>' +
              '<p class="form-note">Полетата са задължителни. Ако имате затруднения, пишете на ' +
                '<a href="mailto:' + esc(cfg.contactEmail || 'karieri@pig-ohridski.bg') + '">' + esc(cfg.contactEmail || 'karieri@pig-ohridski.bg') + '</a>.</p>' +
            '</form>' +
          '</div>' +
        '</div>' +
      '</div></section>'
        : '');
  }

  function bindCareers() {
    var form = document.getElementById('applyForm');
    if (!form) return;

    var status = document.getElementById('apStatus');
    var btn = document.getElementById('apSubmit');

    function setErr(key, msg) {
      var el = form.querySelector('[data-err="' + key + '"]');
      if (!el) return;
      el.textContent = msg || '';
      el.classList.toggle('show', !!msg);
      var field = form.querySelector('[name="' + key + '"]');
      if (field) field.classList.toggle('invalid', !!msg);
    }

    function clearErrors() {
      ['name', 'phone', 'email', 'year', 'consent'].forEach(function (k) { setErr(k, ''); });
      if (status) { status.className = 'form-status'; status.textContent = ''; }
    }

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      clearErrors();

      var name = (form.elements.name.value || '').trim().replace(/\s+/g, ' ');
      var phone = (form.elements.phone.value || '').trim();
      var email = (form.elements.email.value || '').trim();
      var year = parseInt(form.elements.year.value, 10);
      var position = form.elements.position.value;
      var consent = form.elements.consent.checked;
      var honeypot = (document.getElementById('apSite').value || '').trim();

      var ok = true;
      var firstBad = null;

      if (honeypot) { ok = false; } /* бот — спираме тихо */

      if (name.split(' ').filter(function (w) { return w.length >= 2; }).length < 2) {
        setErr('name', 'Въведете име и фамилия (две имена).'); ok = false; firstBad = firstBad || 'name';
      }
      var digits = phone.replace(/[^\d]/g, '');
      if (!/^[+\d][\d\s()\-]{6,}$/.test(phone) || digits.length < 7 || digits.length > 15) {
        setErr('phone', 'Въведете валиден телефонен номер, напр. +359 88 123 4567.'); ok = false; firstBad = firstBad || 'phone';
      }
      if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
        setErr('email', 'Въведете валиден имейл адрес.'); ok = false; firstBad = firstBad || 'email';
      }
      if (!year || !/^\d{4}$/.test(String(form.elements.year.value).trim())) {
        setErr('year', 'Въведете година на раждане с четири цифри, напр. 2005.'); ok = false; firstBad = firstBad || 'year';
      } else if (year < 1940 || year > CURRENT_YEAR) {
        setErr('year', 'Въведете валидна година на раждане.'); ok = false; firstBad = firstBad || 'year';
      } else if (CURRENT_YEAR - year < minBirthAge()) {
        setErr('year', 'Трябва да сте навършили ' + minBirthAge() + ' години, за да кандидатствате. ' +
          'Приемаме кандидати, родени през ' + minBirthYear() + ' г. или по-рано.');
        ok = false; firstBad = firstBad || 'year';
      }
      if (!consent) {
        setErr('consent', 'Маркирайте съгласието за обработка на личните данни.'); ok = false; firstBad = firstBad || 'consent';
      }

      if (!ok) {
        if (firstBad) {
          var f = form.querySelector('[name="' + firstBad + '"]');
          if (f) f.focus();
        }
        if (honeypot) showSuccess(); /* бот: показваме успех, но не изпращаме */
        return;
      }

      /* ограничение срещу повторни изпращания */
      var last = Number(localStorage.getItem('pig_apply_ts') || 0);
      if (Date.now() - last < 45000) {
        if (status) {
          status.className = 'form-status err';
          status.textContent = 'Вече изпратихте кандидатура. Изчакайте минута, преди да опитате отново.';
        }
        return;
      }

      var cfg = S.careers || {};
      var webhook = cfg.webhook || '';
      if (!webhook) {
        if (status) {
          status.className = 'form-status err';
          status.textContent = 'Формата не е конфигурирана. Пишете ни на ' + (cfg.contactEmail || 'karieri@pig-ohridski.bg') + '.';
        }
        return;
      }

      var payload = {
        username: 'ПИГ „Св. Климент Охридски“ · Кариери',
        allowed_mentions: { parse: [] },
        embeds: [{
          title: 'Нова кандидатура · ' + position,
          color: 731983,
          fields: [
            { name: 'Име и фамилия', value: name, inline: true },
            { name: 'Телефон', value: phone, inline: true },
            { name: 'Имейл', value: email, inline: true },
            { name: 'Година на раждане', value: String(year) + ' (' + (CURRENT_YEAR - year) + ' г.)', inline: true },
            { name: 'Позиция', value: position, inline: true }
          ],
          footer: { text: 'pig-ohridski · ' + location.host },
          timestamp: new Date().toISOString()
        }]
      };

      btn.disabled = true;
      btn.textContent = 'Изпращане…';

      fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (r.ok) {
          localStorage.setItem('pig_apply_ts', String(Date.now()));
          showSuccess();
          return;
        }
        if (r.status === 429) throw new Error('Твърде много заявки. Опитайте отново след минута.');
        throw new Error('Сървърът върна грешка (' + r.status + ').');
      }).catch(function (e) {
        if (status) {
          status.className = 'form-status err';
          status.textContent = 'Кандидатурата не беше изпратена: ' + (e.message || 'проблем с връзката') +
            '. Опитайте отново или ни пишете на ' + (cfg.contactEmail || 'karieri@pig-ohridski.bg') + '.';
        }
        btn.disabled = false;
        btn.textContent = 'Изпрати кандидатура';
      });
    });

    function showSuccess() {
      var name = (form.elements.name.value || '').trim().split(' ')[0];
      form.innerHTML =
        '<div class="apply-success">' +
          '<div class="tick">✓</div>' +
          '<h3>Благодарим' + (name ? ', ' + esc(name) : '') + '!</h3>' +
          '<p>Кандидатурата ви пристигна. Ще се свържем с вас на посочения телефон или имейл в срок до 10 работни дни. ' +
            'Ако кандидатурата ви бъде одобрена, ще получите покана за събеседване в Discord сървъра на училището.</p>' +
          '<a class="btn btn-ghost btn-sm" href="#/karieri">Вижте другите позиции</a>' +
        '</div>';
      var card = document.querySelector('.apply-card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-apply]'), function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-apply');
        var job = (C.careers || []).filter(function (j) { return j.id === id; })[0];
        var sel = document.getElementById('apPos');
        if (job && sel) {
          for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].value === job.title) { sel.selectedIndex = i; break; }
          }
        }
        document.getElementById('apply').scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(function () { document.getElementById('apName').focus({ preventScroll: true }); }, 420);
      });
    });
  }

  /* -------------------------------------------------------------- партньори */
  function partnerHost(url) {
    return String(url || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split(/[/?#]/)[0];
  }

  function partnerCard(p) {
    var url = String(p.url || '').trim();
    var logo = p.logo
      ? imgTag(p.logo, p.name, ' loading="lazy"')
      : '<span class="partner-mono" aria-hidden="true">' + esc(initials(p.name)) + '</span>';

    var inner =
      '<span class="partner-logo">' + logo + '</span>' +
      '<span class="partner-body">' +
        '<span class="partner-name">' + esc(p.name) + '</span>' +
        (p.description ? '<span class="partner-desc">' + esc(p.description) + '</span>' : '') +
        (url
          ? '<span class="partner-go">' + esc(partnerHost(url)) +
            '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M7 17 17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</span>'
          : '') +
      '</span>';

    if (!url) {
      return '<div class="partner-card partner-card--plain reveal">' + inner + '</div>';
    }
    return '<a class="partner-card reveal" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"' +
      ' title="' + esc(p.name) + ' — отваря ' + esc(partnerHost(url)) + ' в нов раздел">' + inner + '</a>';
  }

  function viewPartners() {
    var list = (C.partners || []).filter(function (p) { return p && p.active !== false; });
    var intro = String(S.partnersIntro || '').trim() ||
      'Организациите, с които училището работи. Всяко лого е пряк път към сайта на партньора.';
    var mail = S.email || 'info@pig-ohridski.bg';

    return pageHead('Партньорства', intro,
      '<a href="#/">Начало</a><span>/</span>Партньорства') +
      '<section class="section"><div class="wrap">' +
        (list.length
          ? '<div class="partners-grid">' + list.map(partnerCard).join('') + '</div>' +
            '<p class="partners-note">Искате да станете партньор на училището? Пишете ни на ' +
            '<a href="mailto:' + esc(mail) + '">' + esc(mail) + '</a>.</p>'
          : '<div class="empty">Списъкът с партньори предстои да бъде публикуван.</div>') +
      '</div></section>';
  }

  function viewNotFound() {
    return '<section class="section"><div class="wrap" style="text-align:center;padding:80px 0">' +
      '<span class="kicker" style="justify-content:center">Грешка 404</span>' +
      '<h1 style="color:var(--ink-900)">Страницата не е намерена</h1>' +
      '<p style="color:var(--ink-500);max-width:46ch;margin:0 auto 28px">Възможно е адресът да е сгрешен или страницата да е преместена.</p>' +
      '<a class="btn btn-primary" href="#/">Към началото</a>' +
      '</div></section>';
  }

  /* ----------------------------------------------------------------- router */
  var ROUTES = {
    '/': { render: viewHome, nav: '/', title: 'Начало' },
    '/za-uchilishteto': { render: viewAbout, nav: '/za-uchilishteto', title: 'За училището' },
    '/novini': { render: viewNews, nav: '/novini', title: 'Новини' },
    '/paralelki': { render: viewClasses, nav: '/za-uchilishteto', title: 'Паралелки и профили' },
    '/uchiteli': { render: viewTeachers, nav: '/za-uchilishteto', title: 'Учители' },
    '/galeria': { render: viewGallery, nav: '/galeria', title: 'Галерия' },
    '/dokumenti': { render: viewDocuments, nav: '/za-uchilishteto', title: 'Документи' },
    '/karieri': { render: viewCareers, nav: '/karieri', title: 'Кариери' },
    '/partnerstva': { render: viewPartners, nav: '/partnerstva', title: 'Партньорства' },
    '/kontakti': { render: viewContacts, nav: '/kontakti', title: 'Контакти' }
  };

  function parseHash() {
    var raw = location.hash.replace(/^#/, '');
    raw = raw.split('?')[0];
    if (!raw || raw === '/') return { path: '/', parts: [] };
    var parts = raw.replace(/^\//, '').split('/').filter(Boolean).map(function (p) {
      try { return decodeURIComponent(p); } catch (e) { return p; }
    });
    return { path: '/' + parts.join('/'), parts: parts };
  }

  var view = document.getElementById('view');

  function render(keepScroll) {
    var r = parseHash();
    var parts = r.parts;
    var html = '';
    var navKey = null;
    var pageTitle = '';

    if (!parts.length) {
      html = viewHome(); navKey = '/'; pageTitle = 'Начало';
    } else if (parts[0] === 'novina' && parts[1]) {
      html = viewArticle(parts[1]); navKey = '/novini'; pageTitle = 'Новина';
      var art = (C.news || []).filter(function (x) { return x.id === parts[1]; })[0];
      if (art) pageTitle = art.title;
    } else if (parts[0] === 'stranica' && parts[1]) {
      html = viewPage(parts[1]); navKey = '/za-uchilishteto'; pageTitle = 'Страница';
      var pg = (C.pages || []).filter(function (x) { return x.slug === parts[1]; })[0];
      if (pg) pageTitle = pg.title;
    } else if (ROUTES[r.path]) {
      html = ROUTES[r.path].render(); navKey = ROUTES[r.path].nav; pageTitle = ROUTES[r.path].title;
    } else {
      html = viewNotFound(); pageTitle = 'Страницата не е намерена';
    }

    view.innerHTML = html;

    /* document title */
    var name = (S.name || 'ПИГ „Св. Климент Охридски“');
    document.title = (pageTitle === 'Начало' ? name + ' – София' : pageTitle + ' · ' + name);

    /* active nav */
    Array.prototype.forEach.call(document.querySelectorAll('.main-nav a[data-route]'), function (a) {
      a.classList.toggle('active', a.getAttribute('data-route') === navKey);
    });

    /* scroll + reveal */
    if (!keepScroll) window.scrollTo(0, 0);
    resolveImages(view);
    bindReveal();
    bindGallery();
    bindCareers();
    if (document.getElementById('mobileNav').classList.contains('open')) closeNav();
  }

  /* ------------------------------------------------------------- reveal fx */
  function bindReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------- gallery */
  var lb = document.getElementById('lightbox');
  var lbImg = document.getElementById('lbImg');
  var lbCap = document.getElementById('lbCap');
  var lbItems = [];
  var lbIndex = 0;

  function openLb(items, idx) {
    lbIndex = idx;
    lb.classList.add('open');
    document.body.classList.add('nav-open');
    lbItems = items;
    Promise.all(items.map(function (it) {
      if (isMedia(it.src) && window.PIG && PIG.loadMedia) {
        return PIG.loadMedia(String(it.src).slice(6)).then(function (u) { return u || BLANK; });
      }
      return Promise.resolve(it.src);
    })).then(function (urls) {
      lbItems = items.map(function (it, i) { return { src: urls[i], cap: it.cap }; });
      showLb();
    });
  }
  function showLb() {
    var it = lbItems[lbIndex];
    if (!it) return;
    lbImg.src = it.src; lbImg.alt = it.cap || '';
    lbCap.textContent = it.cap || '';
  }
  function closeLb() {
    lb.classList.remove('open');
    document.body.classList.remove('nav-open');
  }
  function bindGallery() {
    var btns = document.querySelectorAll('.gallery-item');
    Array.prototype.forEach.call(btns, function (b, i) {
      b.addEventListener('click', function () {
        var items = Array.prototype.map.call(btns, function (x) {
          return { src: x.getAttribute('data-full'), cap: x.getAttribute('data-cap') };
        });
        openLb(items, i);
      });
    });
  }
  document.getElementById('lbClose').addEventListener('click', closeLb);
  document.getElementById('lbPrev').addEventListener('click', function () {
    lbIndex = (lbIndex - 1 + lbItems.length) % lbItems.length; showLb();
  });
  document.getElementById('lbNext').addEventListener('click', function () {
    lbIndex = (lbIndex + 1) % lbItems.length; showLb();
  });
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') document.getElementById('lbPrev').click();
    if (e.key === 'ArrowRight') document.getElementById('lbNext').click();
  });

  /* ------------------------------------------------------------- mobile nav */
  var mnav = document.getElementById('mobileNav');
  var toggle = document.getElementById('navToggle');
  function openNav() {
    mnav.classList.add('open');
    document.body.classList.add('nav-open');
    toggle.setAttribute('aria-expanded', 'true');
  }
  function closeNav() {
    mnav.classList.remove('open');
    document.body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', function () {
    mnav.classList.contains('open') ? closeNav() : openNav();
  });
  document.getElementById('navClose').addEventListener('click', closeNav);
  Array.prototype.forEach.call(document.querySelectorAll('[data-close-nav]'), function (a) {
    a.addEventListener('click', closeNav);
  });

  /* ----------------------------------------------------------------- footer */
  var footerBase = null;
  function fillFooter() {
    var y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();

    var soc = S.social || {};
    var map = [['facebook', 'i-fb', 'Facebook'], ['instagram', 'i-ig', 'Instagram'], ['youtube', 'i-yt', 'YouTube']];
    var box = document.getElementById('footerSocial');
    if (box) {
      box.innerHTML = map.filter(function (m) { return soc[m[0]]; }).map(function (m) {
        return '<a href="' + esc(soc[m[0]]) + '" target="_blank" rel="noopener" aria-label="' + m[2] + '">' +
          '<svg width="16" height="16"><use href="#' + m[1] + '"></use></svg></a>';
      }).join('');
    }

    var pagesBox = document.getElementById('footerPages');
    var extra = (C.pages || []).filter(function (p) { return p.inNav; });
    if (pagesBox) {
      if (footerBase === null) footerBase = pagesBox.innerHTML;
      pagesBox.innerHTML = footerBase + extra.map(function (p) {
        return '<li><a href="#/stranica/' + encodeURIComponent(p.slug) + '">' + esc(p.title) + '</a></li>';
      }).join('');
    }

    /* top bar / footer contact values from content */
    var tb = document.querySelectorAll('.topbar-info span');
    if (tb.length >= 3) {
      tb[0].innerHTML = '<svg width="14" height="14"><use href="#i-pin"></use></svg> ' + esc(S.address || '');
      tb[1].innerHTML = '<svg width="14" height="14"><use href="#i-phone"></use></svg> <a href="tel:' + esc(String(S.phone || '').replace(/\s/g, '')) + '" style="color:inherit">' + esc(S.phone || '') + '</a>';
      tb[2].innerHTML = '<svg width="14" height="14"><use href="#i-mail"></use></svg> <a href="mailto:' + esc(S.email || '') + '" style="color:inherit">' + esc(S.email || '') + '</a>';
    }
  }

  /* ------------------------------------------------------------------- boot */
  window.addEventListener('hashchange', function () { render(); });
  fillFooter();
  render();

  /* съдържание от базата (ако има) – подменя вграденото копие */
  if (window.PIG && PIG.loadContent) {
    PIG.loadContent().then(function (data) {
      if (!data || !data.site) return;
      C = data;
      S = data.site || {};
      fillFooter();
      render(true);
    });
  }
})();
