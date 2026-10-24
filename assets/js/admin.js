/* ==========================================================================
   ПИГ „Св. Климент Охридски“ – административен панел
   ========================================================================== */
(function () {
  'use strict';

  var DRAFT_KEY = 'pig_admin_draft_v1';
  var $ = function (s, r) { return (r || document).querySelector(s); };

  var state = {
    content: null,
    section: 'dashboard',
    editing: null,
    dirty: false,
    offline: false,
    user: null,
    busy: false
  };

  /* ------------------------------------------------------------------ utils */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var MONTHS = ['януари', 'февруари', 'март', 'април', 'май', 'юни', 'юли',
    'август', 'септември', 'октомври', 'ноември', 'декември'];

  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return iso || '';
    return (+m[3]) + ' ' + MONTHS[(+m[2]) - 1] + ' ' + m[1];
  }

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function uid(prefix) {
    return (prefix || 'id') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function getPath(obj, path) {
    if (!path) return obj;
    return path.split('.').reduce(function (o, k) {
      return (o == null) ? undefined : o[k];
    }, obj);
  }

  function setPath(obj, path, val) {
    var parts = path.split('.');
    var o = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var k = parts[i];
      if (o[k] == null || typeof o[k] !== 'object') {
        o[k] = /^\d+$/.test(parts[i + 1]) ? [] : {};
      }
      o = o[k];
    }
    o[parts[parts.length - 1]] = val;
  }

  function toast(msg, kind) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.className = 'toast'; }, kind === 'err' ? 6000 : 3200);
  }

  function isMedia(v) { return /^media\/[A-Za-z0-9_-]+$/.test(String(v || '')); }

  /* ------------------------------------------------------------------- auth */
  var loginView = $('#loginView'), appView = $('#appView');

  function showLogin(msg) {
    appView.hidden = true;
    loginView.hidden = false;
    if (msg) {
      var e = $('#loginError');
      e.textContent = msg;
      e.classList.add('show');
    }
  }

  $('#loginForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var btn = $('#loginBtn');
    var err = $('#loginError');
    err.classList.remove('show');
    if (!PIG.online) {
      err.textContent = 'Firebase не е достъпен. Проверете интернет връзката или използвайте „Продължи без връзка“.';
      err.classList.add('show');
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Влизане…';
    PIG.signIn($('#loginEmail').value.trim(), $('#loginPassword').value)
      .catch(function (e) {
        err.textContent = PIG.explainError(e);
        err.classList.add('show');
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = 'Вход в панела';
      });
  });

  $('#offlineBtn').addEventListener('click', function () {
    state.offline = true;
    enterApp(null);
  });

  $('#logoutBtn').addEventListener('click', function () {
    if (state.dirty && !confirm('Има непубликувани промени. Сигурни ли сте, че искате да излезете?')) return;
    if (state.offline) { location.reload(); return; }
    PIG.signOut().then(function () { location.reload(); });
  });

  if (window.PIG && PIG.onAuth) {
    PIG.onAuth(function (user) {
      if (user) enterApp(user);
      else if (!state.offline) showLogin();
    });
  } else {
    showLogin('Библиотеките на Firebase не са заредени.');
  }

  /* -------------------------------------------------------------- app start */
  function enterApp(user) {
    if (!user) { openApp(null, ''); return; }
    PIG.checkAccess(user).then(function (acc) {
      if (!acc.allowed) {
        PIG.signOut();
        showLogin('Профилът „' + user.email + '“ няма достъп до панела. ' +
          (acc.error === 'rules'
            ? 'Правилата в Realtime Database още не са публикувани — вижте README, раздел „Правила“.'
            : 'Помолете администратор да ви добави от раздел „Потребители“.'));
        return;
      }
      state.role = acc.role;
      openApp(user, acc.role === 'admin' ? 'администратор' : 'редактор');
    });
  }

  function openApp(user, roleLabel) {
    state.user = user;
    state.offline = !user;
    loginView.hidden = true;
    appView.hidden = false;

    $('#sbUser').innerHTML = user
      ? '<b>' + esc(user.email) + '</b>' + esc(roleLabel || '')
      : '<b>Офлайн режим</b>промените се пазят в браузъра';

    loadContent().then(function (c) {
      state.content = c;
      buildNav();
      go('dashboard');
    });
  }

  function loadContent() {
    var seed = window.PIG_CONTENT || {};
    var draft = null;
    try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { draft = null; }

    if (state.offline) {
      return Promise.resolve(draft || JSON.parse(JSON.stringify(seed)));
    }
    return PIG.loadContent().then(function (remote) {
      if (draft && draft.site) {
        state.dirty = true;
        setTimeout(function () {
          toast('Възстановени са непубликувани промени от предишна сесия.', 'warn');
          updateDirty();
        }, 400);
        return draft;
      }
      return remote;
    });
  }

  /* ------------------------------------------------------------------- nav */
  var ICONS = {
    dash: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    news: '<path d="M5 5h14v14H5z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" stroke-width="1.5"/>',
    classes: '<path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    teachers: '<circle cx="12" cy="8.5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 20c1.2-3.6 3.8-5.2 7-5.2s5.8 1.6 7 5.2" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    gallery: '<rect x="4" y="5" width="16" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="10" r="1.6" fill="currentColor"/><path d="m5 17 5-5 4 4 3-2 3 3" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    docs: '<path d="M7 3h7l4 4v14H7z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    jobs: '<rect x="3" y="7.5" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 7.5V5.6h6v1.9" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 12.5h18" stroke="currentColor" stroke-width="1.6"/>',
    pages: '<path d="M6 3h9l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 11h7M9 15h7" stroke="currentColor" stroke-width="1.5"/>',
    gear: '<circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" stroke="currentColor" stroke-width="1.5"/>',
    publish: '<path d="M12 19V6M12 6l-5 5M12 6l5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    account: '<rect x="5" y="10" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" fill="none" stroke="currentColor" stroke-width="1.6"/>'
  };

  var NAV = [
    { group: 'Съдържание' },
    { id: 'dashboard', label: 'Табло', icon: 'dash' },
    { id: 'news', label: 'Новини', icon: 'news' },
    { id: 'classes', label: 'Паралелки', icon: 'classes' },
    { id: 'teachers', label: 'Учители', icon: 'teachers' },
    { id: 'gallery', label: 'Галерия', icon: 'gallery' },
    { id: 'documents', label: 'Документи', icon: 'docs' },
    { id: 'careers', label: 'Кариери', icon: 'jobs' },
    { id: 'pages', label: 'Страници', icon: 'pages' },
    { group: 'Настройки на сайта' },
    { id: 'general', label: 'Основни данни', icon: 'gear' },
    { id: 'home', label: 'Начало и херо', icon: 'gear' },
    { id: 'about', label: 'За училището', icon: 'gear' },
    { id: 'admission', label: 'Прием и въпроси', icon: 'gear' },
    { group: 'Система' },
    { id: 'users', label: 'Потребители', icon: 'teachers' },
    { id: 'publish', label: 'Публикуване', icon: 'publish' },
    { id: 'account', label: 'Профил и достъп', icon: 'account' }
  ];

  function buildNav() {
    var html = '';
    NAV.forEach(function (n) {
      if (n.group) { html += '<div class="sb-group">' + n.group + '</div>'; return; }
      if (n.id === 'users' && state.role && state.role !== 'admin') return;
      var count = '';
      if (n.id === 'news') count = (state.content.news || []).length;
      if (n.id === 'gallery') count = (state.content.gallery || []).length;
      html += '<button class="sb-item" data-sec="' + n.id + '">' +
        '<span class="ic"><svg width="18" height="18" viewBox="0 0 24 24">' + ICONS[n.icon] + '</svg></span>' +
        esc(n.label) + (count !== '' ? '<span class="badge">' + count + '</span>' : '') +
        '</button>';
    });
    $('#sbNav').innerHTML = html;
  }

  $('#sbNav').addEventListener('click', function (e) {
    var b = e.target.closest('.sb-item');
    if (!b) return;
    go(b.getAttribute('data-sec'));
    $('#sidebar').classList.remove('open');
  });

  $('#sbToggle').addEventListener('click', function () { $('#sidebar').classList.toggle('open'); });

  function go(sec) {
    state.section = sec;
    state.editing = null;
    if (sec === 'users') staffCache = null;
    Array.prototype.forEach.call(document.querySelectorAll('.sb-item'), function (b) {
      b.classList.toggle('active', b.getAttribute('data-sec') === sec);
    });
    renderSection();
  }

  /* --------------------------------------------------------------- dirty/fx */
  var saveTimer = null;
  function markDirty() {
    state.dirty = true;
    updateDirty();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify(state.content)); } catch (e) {}
    }, 500);
  }

  function updateDirty() {
    var b = $('#dirtyBadge');
    if (b) b.hidden = !state.dirty;
  }

  /* ------------------------------------------------------------- field html */
  function fieldWrap(label, inner, hint) {
    return '<div class="f-group"><label class="f-label">' + esc(label) + '</label>' + inner +
      (hint ? '<div class="hint">' + esc(hint) + '</div>' : '') + '</div>';
  }

  function fieldHtml(f, path) {
    var val = getPath(state.content, path);
    var id = 'f_' + path.replace(/\./g, '_');
    var inner = '';

    if (f.type === 'textarea') {
      inner = '<textarea class="f-textarea" id="' + id + '" data-path="' + path + '" rows="' + (f.rows || 6) + '"' +
        (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '>' + esc(val || '') + '</textarea>';
    } else if (f.type === 'date') {
      inner = '<input class="f-input" type="date" id="' + id + '" data-path="' + path + '" value="' + esc(val || '') + '">';
    } else if (f.type === 'number') {
      inner = '<input class="f-input" type="number" id="' + id + '" data-path="' + path + '" data-type="number" value="' + esc(val == null ? '' : val) + '">';
    } else if (f.type === 'checkbox') {
      inner = '<label class="switch"><input type="checkbox" id="' + id + '" data-path="' + path + '"' +
        (val ? ' checked' : '') + '> ' + esc(f.text || 'Да') + '</label>';
    } else if (f.type === 'select') {
      inner = '<select class="f-select" id="' + id + '" data-path="' + path + '">' +
        (f.options || []).map(function (o) {
          return '<option value="' + esc(o) + '"' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join('') + '</select>';
    } else if (f.type === 'image') {
      inner = '<div class="img-pick">' +
        '<img class="img-prev empty" data-prev="' + path + '" alt="">' +
        '<div class="img-tools">' +
          '<label class="btn btn-ghost btn-sm file-btn">Качи снимка<input type="file" accept="image/*" data-upload="' + path + '"></label>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-act="clear-img" data-path="' + path + '">Премахни</button>' +
        '</div></div>';
    } else {
      inner = '<input class="f-input" type="text" id="' + id + '" data-path="' + path + '" value="' + esc(val || '') + '"' +
        (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + '>';
    }
    return fieldWrap(f.label, inner, f.hint);
  }

  function fieldsHtml(fields, base) {
    var half = fields.filter(function (f) { return f.half; });
    var html = '', buf = '';
    fields.forEach(function (f) {
      var h = fieldHtml(f, base ? base + '.' + f.k : f.k);
      if (f.half) {
        buf += h;
        if (buf.split('class="f-group"').length - 1 === 2) { html += '<div class="grid-2c">' + buf + '</div>'; buf = ''; }
      } else {
        if (buf) { html += '<div class="grid-2c">' + buf + '</div>'; buf = ''; }
        html += h;
      }
    });
    if (buf) html += '<div class="grid-2c">' + buf + '</div>';
    return html;
  }

  /* --------------------------------------------------------------- repeater */
  function repeaterHtml(path, items, fields, label) {
    items = items || [];
    var html = items.map(function (it, i) {
      return '<div class="rep-item">' +
        '<div class="rep-head"><span class="rep-idx">' + esc(label || 'Елемент') + ' ' + (i + 1) + '</span>' +
        '<div class="rep-tools">' +
          '<button type="button" class="icon-btn" data-act="rep-up" data-path="' + path + '" data-i="' + i + '" title="Нагоре">↑</button>' +
          '<button type="button" class="icon-btn" data-act="rep-down" data-path="' + path + '" data-i="' + i + '" title="Надолу">↓</button>' +
          '<button type="button" class="icon-btn danger" data-act="rep-del" data-path="' + path + '" data-i="' + i + '" title="Изтрий">✕</button>' +
        '</div></div>' +
        fields.map(function (f) { return fieldHtml(f, path + '.' + i + '.' + f.k); }).join('') +
        '</div>';
    }).join('');

    if (!items.length) html = '<div class="rep-empty">Няма добавени елементи.</div>';
    return html + '<button type="button" class="btn btn-ghost btn-sm" data-act="rep-add" data-path="' + path + '" style="margin-top:6px">＋ Добави</button>';
  }

  function strListHtml(path, arr, ph) {
    arr = arr || [];
    var html = arr.map(function (v, i) {
      return '<div class="rep-item" style="padding:10px 12px"><div class="f-row">' +
        '<input class="f-input" type="text" data-path="' + path + '.' + i + '" value="' + esc(v) + '" placeholder="' + esc(ph || '') + '">' +
        '<button type="button" class="icon-btn danger" data-act="rep-del" data-path="' + path + '" data-i="' + i + '">✕</button>' +
        '</div></div>';
    }).join('');
    if (!arr.length) html = '<div class="rep-empty">Няма добавени елементи.</div>';
    return html + '<button type="button" class="btn btn-ghost btn-sm" data-act="rep-add" data-path="' + path + '" style="margin-top:6px">＋ Добави</button>';
  }

  /* ---------------------------------------------------------- list sections */
  var LISTS = {
    news: {
      title: 'Новини', single: 'новина', key: 'news',
      blank: function () { return { id: uid('n'), date: today(), title: '', category: 'Училищен живот', excerpt: '', body: '', image: '', pinned: false }; },
      fields: [
        { k: 'title', label: 'Заглавие', type: 'text', ph: 'Например: Откриване на учебната година' },
        { k: 'date', label: 'Дата', type: 'date', half: true },
        { k: 'category', label: 'Категория', type: 'text', half: true, ph: 'Училищен живот' },
        { k: 'pinned', label: 'Акцент', type: 'checkbox', text: 'Покажи в началото на списъка' },
        { k: 'excerpt', label: 'Кратко резюме', type: 'textarea', rows: 3, hint: 'Показва се в списъка с новини (1–2 изречения).' },
        { k: 'body', label: 'Пълен текст', type: 'textarea', rows: 12, hint: 'Празен ред = нов абзац. **удебелен**, *курсив*, [текст](https://адрес).' },
        { k: 'image', label: 'Снимка', type: 'image', hint: 'По избор. Без снимка новината се показва с дата.' }
      ],
      row: function (it) {
        return { title: it.title || '(без заглавие)', sub: fmtDate(it.date) + (it.category ? ' · ' + it.category : ''), img: it.image };
      }
    },
    classes: {
      title: 'Паралелки', single: 'паралелка', key: 'classes',
      blank: function () { return { name: '', profile: '', students: 0, curator: '', room: '', description: '' }; },
      fields: [
        { k: 'name', label: 'Паралелка', type: 'text', half: true, ph: '8.А' },
        { k: 'students', label: 'Брой ученици', type: 'number', half: true },
        { k: 'profile', label: 'Профил', type: 'text', ph: 'Математически профил' },
        { k: 'curator', label: 'Класен ръководител', type: 'text', half: true },
        { k: 'room', label: 'Кабинет', type: 'text', half: true, ph: 'каб. 204' },
        { k: 'description', label: 'Описание', type: 'textarea', rows: 3 }
      ],
      row: function (it) {
        return { title: it.name || '(без име)', sub: (it.profile || '') + ' · ' + (it.students || 0) + ' ученици' };
      }
    },
    teachers: {
      title: 'Учители', single: 'учител', key: 'teachers',
      blank: function () { return { name: '', role: 'Учител', subject: '', bio: '', photo: '' }; },
      fields: [
        { k: 'name', label: 'Име', type: 'text', half: true },
        { k: 'role', label: 'Роля', type: 'text', half: true, ph: 'Учител / Директор' },
        { k: 'subject', label: 'Предмет', type: 'text' },
        { k: 'bio', label: 'Кратка биография', type: 'textarea', rows: 3 },
        { k: 'photo', label: 'Снимка', type: 'image', hint: 'Без снимка се показват инициалите.' }
      ],
      row: function (it) { return { title: it.name || '(без име)', sub: (it.role || '') + ' · ' + (it.subject || ''), img: it.photo }; }
    },
    gallery: {
      title: 'Галерия', single: 'снимка', key: 'gallery',
      blank: function () { return { id: uid('g'), title: '', date: today(), image: '' }; },
      fields: [
        { k: 'title', label: 'Описание', type: 'text', ph: 'Есенен поход до Витоша' },
        { k: 'date', label: 'Дата', type: 'date', half: true },
        { k: 'image', label: 'Снимка', type: 'image' }
      ],
      row: function (it) { return { title: it.title || '(без описание)', sub: fmtDate(it.date), img: it.image }; }
    },
    documents: {
      title: 'Документи', single: 'документ', key: 'documents',
      blank: function () { return { id: uid('d'), title: '', category: 'Нормативни документи', date: today(), url: '', note: '' }; },
      fields: [
        { k: 'title', label: 'Заглавие', type: 'text' },
        { k: 'category', label: 'Категория', type: 'text', half: true, ph: 'Нормативни документи' },
        { k: 'date', label: 'Дата', type: 'date', half: true },
        { k: 'url', label: 'Връзка към файла', type: 'text', ph: 'https://… или uploads/файл.pdf', hint: 'Качете файла в хранилището на GitHub (папка uploads) и поставете пътя до него. Ако е празно, редът се показва като „Очаква качване“.', },
        { k: 'note', label: 'Бележка', type: 'text', ph: 'PDF · 1,2 MB' }
      ],
      row: function (it) { return { title: it.title || '(без заглавие)', sub: (it.category || '') + ' · ' + fmtDate(it.date) }; }
    },
    pages: {
      title: 'Страници', single: 'страница', key: 'pages',
      blank: function () { return { id: uid('p'), slug: '', title: '', inNav: false, body: '' }; },
      fields: [
        { k: 'title', label: 'Заглавие', type: 'text' },
        { k: 'slug', label: 'Адрес (slug)', type: 'text', half: true, hint: 'Латиница, без интервали: klubove' },
        { k: 'inNav', label: 'Показвай в менюто', type: 'checkbox', text: 'Добави връзка във футъра' },
        { k: 'body', label: 'Съдържание', type: 'textarea', rows: 14, hint: 'Празен ред = абзац. „- “ в началото на ред = списък. **удебелен**.' }
      ],
      row: function (it) { return { title: it.title || '(без заглавие)', sub: '/stranica/' + (it.slug || '') }; }
    },
    careers: {
      title: 'Обяви за работа', single: 'обява', key: 'careers',
      blank: function () {
        return {
          id: uid('j'), title: '', type: 'Пълен работен ден', department: '', location: 'София',
          salary: '', deadline: '', active: true, summary: '', description: '', requirements: ''
        };
      },
      fields: [
        { k: 'title', label: 'Позиция', type: 'text', ph: 'Учител по математика' },
        { k: 'type', label: 'Вид заетост', type: 'text', half: true, ph: 'Пълен работен ден' },
        { k: 'department', label: 'Направление', type: 'text', half: true, ph: 'Математика' },
        { k: 'location', label: 'Място', type: 'text', half: true },
        { k: 'salary', label: 'Възнаграждение', type: 'text', half: true, ph: '1 600 – 2 100 лв.' },
        { k: 'deadline', label: 'Краен срок', type: 'date', half: true },
        { k: 'active', label: 'Видимост', type: 'checkbox', text: 'Обявата е видима на сайта' },
        { k: 'summary', label: 'Кратко описание', type: 'textarea', rows: 3, hint: 'Показва се в картата на обявата.' },
        { k: 'description', label: 'Пълно описание', type: 'textarea', rows: 9, hint: 'Празен ред = нов абзац.' },
        { k: 'requirements', label: 'Изисквания', type: 'textarea', rows: 5, hint: 'Едно изискване на ред.' }
      ],
      row: function (it) {
        return {
          title: it.title || '(без заглавие)',
          sub: [it.type, it.deadline ? 'до ' + fmtDate(it.deadline) : '', it.active === false ? 'скрита' : 'активна']
            .filter(Boolean).join(' · ')
        };
      }
    }
  };

  function renderList(key) {
    var cfg = LISTS[key];
    var items = state.content[cfg.key] || [];

    if (state.editing && state.editing.list === key) {
      var idx = state.editing.index;
      var item = items[idx];
      if (!item) { state.editing = null; return renderList(key); }
      return '<div class="card">' +
        '<div class="card-head"><div><h3>' + (idx >= 0 ? 'Редакция на ' + esc(cfg.single) : 'Нова ' + esc(cfg.single)) + '</h3>' +
        '<p>Промените се запазват в паметта — натиснете „Публикувай“, за да станат видими на сайта.</p></div>' +
        '<button class="btn btn-ghost btn-sm" data-act="list-back">← Назад</button></div>' +
        fieldsHtml(cfg.fields, cfg.key + '.' + idx) +
        '<div class="f-row" style="margin-top:8px">' +
          '<button class="btn btn-primary btn-sm" data-act="list-back">Готово</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="list-del" data-list="' + key + '" data-i="' + idx + '">Изтрий</button>' +
        '</div>' +
        '</div>';
    }

    var rows = items.map(function (it, i) {
      var r = cfg.row(it);
      var thumb = r.img
        ? '<img class="thumb" data-prev="' + cfg.key + '.' + i + '.' + (it.image !== undefined ? 'image' : 'photo') + '" alt="">'
        : '';
      return '<tr>' +
        '<td><div class="t-cell">' + thumb +
          '<div><div class="t-title">' + esc(r.title) + '</div><div class="t-sub">' + esc(r.sub || '') + '</div></div>' +
        '</div></td>' +
        '<td class="row-actions">' +
          '<button class="icon-btn" data-act="list-edit" data-list="' + key + '" data-i="' + i + '" title="Редакция">✎</button>' +
          '<button class="icon-btn" data-act="list-up" data-list="' + key + '" data-i="' + i + '" title="Нагоре">↑</button>' +
          '<button class="icon-btn" data-act="list-down" data-list="' + key + '" data-i="' + i + '" title="Надолу">↓</button>' +
          '<button class="icon-btn danger" data-act="list-del" data-list="' + key + '" data-i="' + i + '" title="Изтрий">✕</button>' +
        '</td></tr>';
    }).join('');

    return '<div class="card">' +
      '<div class="card-head"><div><h3>' + esc(cfg.title) + '</h3>' +
      '<p>' + items.length + ' записа. Редът тук е редът на сайта.</p></div>' +
      '<button class="btn btn-primary btn-sm" data-act="list-add" data-list="' + key + '">＋ Нова ' + esc(cfg.single) + '</button></div>' +
      (items.length
        ? '<table class="tbl"><thead><tr><th>Заглавие</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
        : '<div class="rep-empty">Все още няма записи. Натиснете „＋ Нова ' + esc(cfg.single) + '“.</div>') +
      '</div>';
  }

  /* --------------------------------------------------------------- sections */
  function sectionDashboard() {
    var c = state.content;
    var counts = [
      { n: (c.news || []).length, l: 'новини', sec: 'news' },
      { n: (c.classes || []).length, l: 'паралелки', sec: 'classes' },
      { n: (c.teachers || []).length, l: 'учители', sec: 'teachers' },
      { n: (c.gallery || []).length, l: 'снимки', sec: 'gallery' },
      { n: (c.careers || []).filter(function (j) { return j.active !== false; }).length, l: 'обяви', sec: 'careers' }
    ];
    var upd = (c.meta && c.meta.updated) ? new Date(c.meta.updated).toLocaleString('bg-BG') : '—';

    return (state.offline ? '<div class="notice warn"><b>Офлайн режим.</b> Промените се пазят само в този браузър. За да ги публикувате, влезте с администраторски профил.</div>' : '') +
      '<div class="dash-grid">' + counts.map(function (x) {
        return '<button class="dash-card" data-sec="' + x.sec + '"><span class="n">' + x.n + '</span><span class="l">' + x.l + '</span></button>';
      }).join('') + '</div>' +

      '<div class="card"><div class="card-head"><h3>Състояние</h3></div>' +
        '<table class="tbl"><tbody>' +
        '<tr><td style="width:190px">Връзка с базата</td><td>' + ((PIG.online && !state.offline) ? '<span class="notice ok" style="display:inline-block;margin:0;padding:4px 10px">активна</span>' : '<span class="notice err" style="display:inline-block;margin:0;padding:4px 10px">' + (PIG.online ? 'без вход' : 'няма връзка') + '</span>') + '</td></tr>' +
        '<tr><td>Влязъл потребител</td><td>' + esc(state.user ? state.user.email : 'офлайн режим') + '</td></tr>' +
        '<tr><td>Последна публикация</td><td>' + esc(upd) + '</td></tr>' +
        '<tr><td>Непубликувани промени</td><td>' + (state.dirty ? 'да' : 'не') + '</td></tr>' +
        '</tbody></table></div>' +

      '<div class="card"><div class="card-head"><div><h3>Бързи действия</h3><p>Най-често използваното.</p></div></div>' +
        '<div class="f-row" style="flex-wrap:wrap;gap:9px">' +
          '<button class="btn btn-ghost btn-sm" data-act="quick-news">＋ Нова новина</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="quick-gallery">＋ Снимка в галерията</button>' +
          '<button class="btn btn-ghost btn-sm" data-sec="general">Основни данни</button>' +
          '<a class="btn btn-ghost btn-sm" href="index.html" target="_blank" rel="noopener">Отвори сайта</a>' +
        '</div></div>' +

      '<div class="card"><div class="card-head"><div><h3>Как работи</h3></div></div>' +
        '<p class="small muted" style="margin:0;line-height:1.7">Редактирате съдържанието в панела, то се пази като чернова. С бутона <b>„Публикувай“</b> промените се записват в базата и се появяват на сайта веднага. Снимките се качват автоматично при избор и се компресират до разумен размер.</p>' +
      '</div>';
  }

  function sectionGeneral() {
    var s = 'site';
    return '<div class="card"><div class="card-head"><div><h3>Основни данни</h3><p>Име, адрес и контакти — използват се в цялия сайт.</p></div></div>' +
      fieldsHtml([
        { k: 'name', label: 'Пълно име на училището', type: 'text' },
        { k: 'shortName', label: 'Кратко име', type: 'text', half: true },
        { k: 'city', label: 'Град', type: 'text', half: true },
        { k: 'tagline', label: 'Подзаглавие', type: 'text', ph: 'Профилирана гимназия с традиции от 1894 година' },
        { k: 'founded', label: 'Година на основаване', type: 'number', half: true },
        { k: 'motto', label: 'Мото', type: 'text', half: true }
      ], s) + '</div>' +

      '<div class="card"><div class="card-head"><h3>Контакти</h3></div>' +
      fieldsHtml([
        { k: 'address', label: 'Адрес', type: 'text' },
        { k: 'phone', label: 'Телефон', type: 'text', half: true },
        { k: 'phoneNote', label: 'Пояснение към телефона', type: 'text', half: true },
        { k: 'email', label: 'Електронна поща', type: 'text', half: true },
        { k: 'emailNote', label: 'Пояснение към пощата', type: 'text', half: true },
        { k: 'workHours', label: 'Работно време', type: 'text' },
        { k: 'mapLink', label: 'Връзка към карта', type: 'text' },
        { k: 'mapEmbed', label: 'Адрес за вградена карта (iframe src)', type: 'text', hint: 'OpenStreetMap → Share → HTML → копирайте адреса от src="…"' }
      ], s) + '</div>' +

      '<div class="card"><div class="card-head"><h3>Социални мрежи</h3></div>' +
      fieldsHtml([
        { k: 'facebook', label: 'Facebook', type: 'text' },
        { k: 'instagram', label: 'Instagram', type: 'text' },
        { k: 'youtube', label: 'YouTube', type: 'text' }
      ], 'site.social') + '</div>';
  }

  function sectionHome() {
    return '<div class="card"><div class="card-head"><div><h3>Първи екран</h3><p>Текстът и снимката, които посетителят вижда първи.</p></div></div>' +
      fieldsHtml([
        { k: 'heroKicker', label: 'Надпис над заглавието', type: 'text', ph: 'Прием 2026/2027 · Ден на отворените врати' },
        { k: 'heroTitle', label: 'Заглавие', type: 'text' },
        { k: 'heroLead', label: 'Встъпителен текст', type: 'textarea', rows: 3 },
        { k: 'heroImage', label: 'Основна снимка', type: 'image' }
      ], 'site') + '</div>' +

      '<div class="card"><div class="card-head"><div><h3>Цифри под първия екран</h3><p>Показани в лента от четири полета.</p></div></div>' +
      repeaterHtml('site.stats', state.content.site.stats || [], [
        { k: 'value', label: 'Стойност', type: 'text', half: true },
        { k: 'label', label: 'Пояснение', type: 'text', half: true }
      ], 'Показател') + '</div>';
  }

  function sectionAbout() {
    return '<div class="card"><div class="card-head"><h3>За училището</h3></div>' +
      fieldsHtml([
        { k: 'title', label: 'Заглавие на раздела', type: 'text' },
        { k: 'lead', label: 'Въведение', type: 'textarea', rows: 3 },
        { k: 'body', label: 'Основен текст', type: 'textarea', rows: 10, hint: 'Празен ред = нов абзац.' }
      ], 'site.about') + '</div>' +

      '<div class="card"><div class="card-head"><div><h3>Принципи</h3><p>Показват се в блок от четири карти.</p></div></div>' +
      repeaterHtml('site.about.values', state.content.site.about.values || [], [
        { k: 'title', label: 'Заглавие', type: 'text' },
        { k: 'text', label: 'Текст', type: 'textarea', rows: 2 }
      ], 'Принцип') + '</div>' +

      '<div class="card"><div class="card-head"><h3>Директор</h3></div>' +
      fieldsHtml([
        { k: 'name', label: 'Име', type: 'text', half: true },
        { k: 'role', label: 'Длъжност', type: 'text', half: true },
        { k: 'greeting', label: 'Обръщение', type: 'textarea', rows: 8 },
        { k: 'photo', label: 'Снимка', type: 'image' }
      ], 'site.about.director') + '</div>' +

      '<div class="card"><div class="card-head"><div><h3>График на звънците</h3></div></div>' +
      repeaterHtml('site.bells', state.content.site.bells || [], [
        { k: 'n', label: 'Час', type: 'text', half: true, ph: '1. час' },
        { k: 'from', label: 'Начало', type: 'text', half: true, ph: '08:00' },
        { k: 'to', label: 'Край', type: 'text', half: true, ph: '08:40' }
      ], 'Час') + '</div>';
  }

  function sectionAdmission() {
    var a = state.content.site.admission || {};
    return '<div class="card"><div class="card-head"><h3>Прием</h3></div>' +
      fieldsHtml([
        { k: 'year', label: 'Учебна година', type: 'text', half: true, ph: '2026/2027' },
        { k: 'contact', label: 'Контакт за прием', type: 'text', half: true },
        { k: 'intro', label: 'Въведение', type: 'textarea', rows: 4 }
      ], 'site.admission') + '</div>' +

      '<div class="card"><div class="card-head"><div><h3>Стъпки</h3></div></div>' +
      repeaterHtml('site.admission.steps', a.steps || [], [
        { k: 'title', label: 'Заглавие', type: 'text' },
        { k: 'text', label: 'Описание', type: 'textarea', rows: 2 }
      ], 'Стъпка') + '</div>' +

      '<div class="card"><div class="card-head"><div><h3>Важни дати</h3></div></div>' +
      repeaterHtml('site.admission.dates', a.dates || [], [
        { k: 'date', label: 'Дата', type: 'text', half: true, ph: '14.11.2026' },
        { k: 'text', label: 'Събитие', type: 'text', half: true }
      ], 'Дата') + '</div>' +

      '<div class="card"><div class="card-head"><div><h3>Необходими документи</h3></div></div>' +
      strListHtml('site.admission.documents', a.documents || [], 'Копие от удостоверението…') + '</div>' +

      '<div class="card"><div class="card-head"><div><h3>Често задавани въпроси</h3></div></div>' +
      repeaterHtml('site.faq', state.content.site.faq || [], [
        { k: 'q', label: 'Въпрос', type: 'text' },
        { k: 'a', label: 'Отговор', type: 'textarea', rows: 3 }
      ], 'Въпрос') + '</div>';
  }

  function sectionCareers() {
    if (state.editing && state.editing.list === 'careers') return renderList('careers');
    return '<div class="card"><div class="card-head"><div><h3>Настройки на формата</h3>' +
      '<p>Къде пристигат кандидатурите и какво вижда кандидатът на сайта.</p></div></div>' +
      fieldsHtml([
        { k: 'intro', label: 'Въведение на страницата', type: 'textarea', rows: 2 },
        { k: 'webhook', label: 'Discord webhook адрес', type: 'text', hint: 'Discord → канал → Edit Channel → Integrations → Webhooks → Copy Webhook URL.' },
        { k: 'contactEmail', label: 'Имейл за връзка', type: 'text', half: true },
        { k: 'minAge', label: 'Минимална възраст', type: 'number', half: true, hint: 'Проверява се спрямо текущата година.' },
        { k: 'note', label: 'Бележка под формата', type: 'textarea', rows: 2 }
      ], 'site.careers') +
      '<div class="notice" style="margin-top:2px">Всяка попълнена кандидатура се изпраща директно в Discord — не се пази в базата.</div>' +
      '<button class="btn btn-ghost btn-sm" data-act="test-webhook" style="margin-top:10px">Изпрати тестово съобщение</button>' +
      '</div>' + renderList('careers');
  }

  function testWebhook() {
    var url = getPath(state.content, 'site.careers.webhook') || '';
    if (!url) { toast('Първо поставете webhook адрес.', 'err'); return; }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'ПИГ „Св. Климент Охридски“ · Кариери',
        embeds: [{
          title: '✅ Тестово съобщение от панела',
          description: 'Връзката с Discord работи. Истинските кандидатури ще изглеждат по същия начин.',
          color: 731983,
          timestamp: new Date().toISOString()
        }]
      })
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      toast('Тестовото съобщение е изпратено в Discord.', 'ok');
    }).catch(function (e) {
      toast('Неуспешно изпращане: ' + e.message, 'err');
    });
  }

  /* ------------------------------------------------------------ потребители */
  var staffCache = null;          // null = още не е заредено
  var staffError = '';
  var ROLE_LABEL = { admin: 'администратор', editor: 'редактор' };
  var ROLE_SHORT = { admin: 'админ', editor: 'редактор' };

  function loadStaff(force) {
    if (staffCache !== null && !force) return;
    staffCache = null;
    staffError = '';
    PIG.listStaff().then(function (v) {
      staffCache = v || {};
      if (state.section === 'users') renderSection();
    }).catch(function (e) {
      staffCache = {};
      staffError = PIG.explainError(e);
      if (state.section === 'users') renderSection();
    });
  }

  function staffRows() {
    var out = [];
    var bootstrap = PIG.BOOTSTRAP_ADMINS || [];
    bootstrap.forEach(function (em) {
      out.push({ uid: null, email: em, name: 'Основен администратор', role: 'admin', locked: true });
    });
    Object.keys(staffCache || {}).forEach(function (u) {
      var v = staffCache[u] || {};
      var em = String(v.email || '');
      if (bootstrap.indexOf(em.toLowerCase()) !== -1) return;   // вече е горе
      out.push({ uid: u, email: em, name: v.name || '', role: v.role || 'editor', locked: false, createdAt: v.createdAt });
    });
    return out;
  }

  function sectionUsers() {
    if (state.offline) {
      return '<div class="card"><div class="card-head"><h3>Потребители</h3></div>' +
        '<div class="notice warn">В офлайн режим управлението на потребители е недостъпно. ' +
        'Влезте с администраторски профил, за да добавяте и премахвате достъп.</div></div>';
    }
    if (staffCache === null) {
      loadStaff();
      return '<div class="card"><div class="card-head"><h3>Потребители</h3></div>' +
        '<div class="rep-empty">Зареждане на списъка…</div></div>';
    }

    var rows = staffRows();
    var isAdmin = state.role === 'admin';

    /* ---- редакция на един потребител ---- */
    if (state.editing && state.editing.list === 'users') {
      var ed = rows.filter(function (r) { return r.uid === state.editing.index; })[0];
      if (!ed || ed.locked) { state.editing = null; return sectionUsers(); }
      return '<div class="card"><div class="card-head">' +
        '<div><h3>Редакция на потребител</h3><p>Промените влизат в сила веднага.</p></div>' +
        '<button class="btn btn-ghost btn-sm" data-act="user-cancel">← Назад</button></div>' +
        '<div class="grid-2c">' +
          fieldWrap('Име', '<input class="f-input" id="euName" value="' + esc(ed.name) + '">') +
          fieldWrap('Имейл', '<input class="f-input" id="euEmail" value="' + esc(ed.email) + '" disabled>', 'Имейлът не може да се променя оттук.') +
        '</div>' +
        fieldWrap('Роля', '<select class="f-select" id="euRole">' +
          '<option value="editor"' + (ed.role === 'editor' ? ' selected' : '') + '>Редактор — може да променя съдържанието</option>' +
          '<option value="admin"' + (ed.role === 'admin' ? ' selected' : '') + '>Администратор — може и да управлява потребители</option>' +
        '</select>') +
        '<div class="f-row" style="margin-top:8px;flex-wrap:wrap">' +
          '<button class="btn btn-primary btn-sm" data-act="user-save" data-uid="' + esc(ed.uid) + '">Запази</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="user-reset" data-email="' + esc(ed.email) + '">Изпрати имейл за нова парола</button>' +
          '<button class="btn btn-ghost btn-sm" data-act="user-del" data-uid="' + esc(ed.uid) + '" data-email="' + esc(ed.email) + '">Премахни достъпа</button>' +
        '</div>' +
        '<div class="notice" style="margin-top:16px">Премахването спира достъпа до панела, но акаунтът остава в Firebase. ' +
        'Пълно изтриване се прави в Firebase Console → Authentication → Users.</div>' +
        '</div>';
    }

    /* ---- списък ---- */
    var listHtml = rows.map(function (r) {
      var actions = r.locked
        ? '<span class="tag tag-locked"><span class="tag-full">постоянен достъп</span><span class="tag-short">постоянен</span></span>'
        : (isAdmin
          ? '<button class="icon-btn" data-act="user-edit" data-uid="' + esc(r.uid) + '" title="Редакция">✎</button>' +
            '<button class="icon-btn" data-act="user-reset" data-email="' + esc(r.email) + '" title="Изпрати имейл за нова парола">↻</button>' +
            '<button class="icon-btn danger" data-act="user-del" data-uid="' + esc(r.uid) + '" data-email="' + esc(r.email) + '" title="Премахни достъпа">✕</button>'
          : '');
      return '<tr>' +
        '<td><div class="t-title">' + esc(r.name || r.email) + '</div>' +
        '<div class="t-sub">' + esc(r.email) + '</div></td>' +
        '<td><span class="tag' + (r.role === 'admin' ? ' tag-admin' : '') + '">' +
        '<span class="tag-full">' + esc(ROLE_LABEL[r.role] || r.role) + '</span>' +
        '<span class="tag-short">' + esc(ROLE_SHORT[r.role] || r.role) + '</span>' +
        '</span></td>' +
        '<td class="row-actions">' + actions + '</td>' +
        '</tr>';
    }).join('');

    var addHtml = '';
    if (isAdmin) {
      addHtml = '<div class="card"><div class="card-head"><div><h3>Нов потребител</h3>' +
        '<p>Създава акаунт в Firebase и му дава достъп до панела.</p></div></div>' +
        '<div class="grid-2c">' +
          fieldWrap('Име и фамилия', '<input class="f-input" id="nuName" placeholder="Алекс Тодоров" autocomplete="off">') +
          fieldWrap('Имейл', '<input class="f-input" id="nuEmail" type="email" placeholder="ime@primer.bg" autocomplete="off">') +
          fieldWrap('Парола', '<input class="f-input" id="nuPass" type="text" placeholder="поне 6 знака" autocomplete="new-password">',
            'Показва се в явен вид, за да я предадете на човека. Той може да я смени от „Профил и достъп“.') +
          fieldWrap('Роля', '<select class="f-select" id="nuRole">' +
            '<option value="editor">Редактор — променя съдържанието</option>' +
            '<option value="admin">Администратор — управлява и потребители</option>' +
          '</select>') +
        '</div>' +
        '<div class="f-row" style="margin-top:8px">' +
          '<button class="btn btn-primary btn-sm" data-act="user-add">Създай потребител</button>' +
        '</div>' +
        '<div class="notice" style="margin-top:16px">Ако получите грешка, че входът с имейл и парола не е активиран: ' +
        'Firebase Console → Authentication → Sign-in method → Email/Password → Enable.</div>' +
        '</div>';
    } else {
      addHtml = '<div class="notice warn">Само администратор може да добавя и премахва потребители.</div>';
    }

    return '<div class="card"><div class="card-head"><div><h3>Потребители с достъп</h3>' +
      '<p>' + rows.length + ' профила. Всеки от тях може да влезе в панела.</p></div>' +
      '<button class="btn btn-ghost btn-sm" data-act="user-refresh">Обнови</button></div>' +
      (staffError ? '<div class="notice err">Списъкът не можа да се зареди: ' + esc(staffError) + '</div>' : '') +
      '<table class="tbl tbl-users"><thead><tr><th>Потребител</th><th class="th-role">Роля</th><th class="th-act"></th></tr></thead>' +
      '<tbody>' + listHtml + '</tbody></table>' +
      '</div>' + addHtml;
  }

  function addUser() {
    var name = ($('#nuName').value || '').trim();
    var email = ($('#nuEmail').value || '').trim().toLowerCase();
    var pass = $('#nuPass').value || '';
    var role = $('#nuRole').value || 'editor';

    if (name.length < 3) { toast('Напишете име и фамилия.', 'err'); $('#nuName').focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast('Невалиден имейл адрес.', 'err'); $('#nuEmail').focus(); return; }
    if (pass.length < 6) { toast('Паролата трябва да е поне 6 знака.', 'err'); $('#nuPass').focus(); return; }

    var btn = document.querySelector('[data-act="user-add"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Създаване…'; }

    PIG.createAuthUser(email, pass, name).then(function (uid) {
      return PIG.saveStaff(uid, {
        email: email, name: name, role: role, createdAt: new Date().toISOString()
      }).then(function () { return uid; });
    }).then(function (uid) {
      toast('Потребителят „' + name + '“ е създаден с достъп до панела.', 'ok');
      staffCache = null;
      loadStaff(true);
    }).catch(function (e) {
      console.error(e);
      toast('Неуспешно създаване: ' + PIG.explainError(e), 'err');
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = 'Създай потребител'; }
    });
  }

  function saveUser(uid) {
    var name = ($('#euName').value || '').trim();
    var role = $('#euRole').value || 'editor';
    if (name.length < 3) { toast('Напишете име и фамилия.', 'err'); return; }
    var prev = (staffCache && staffCache[uid]) || {};
    PIG.saveStaff(uid, {
      email: prev.email || '', name: name, role: role,
      createdAt: prev.createdAt || new Date().toISOString()
    }).then(function () {
      toast('Промените са запазени.', 'ok');
      state.editing = null;
      loadStaff(true);
    }).catch(function (e) {
      toast('Грешка: ' + PIG.explainError(e), 'err');
    });
  }

  function removeUser(uid, email) {
    if (!confirm('Да премахна ли достъпа на ' + email + ' до панела?')) return;
    PIG.removeStaff(uid).then(function () {
      toast('Достъпът е премахнат.', 'ok');
      state.editing = null;
      loadStaff(true);
    }).catch(function (e) {
      toast('Грешка: ' + PIG.explainError(e), 'err');
    });
  }

  function resetUser(email) {
    PIG.sendReset(email).then(function () {
      toast('Изпратен е имейл за нова парола на ' + email + '.', 'ok');
    }).catch(function (e) {
      toast('Грешка: ' + PIG.explainError(e), 'err');
    });
  }

  function sectionPublish() {
    var upd = (state.content.meta && state.content.meta.updated)
      ? new Date(state.content.meta.updated).toLocaleString('bg-BG') : '—';
    return '<div class="card"><div class="card-head"><div><h3>Публикуване</h3>' +
      '<p>Записва текущото съдържание в базата, откъдето сайтът го чете.</p></div></div>' +
      (state.offline
        ? '<div class="notice warn">В момента сте в офлайн режим — публикуването е недостъпно. Влезте с администраторски профил.</div>'
        : '<div class="notice ok">Връзката е активна. Последна публикация: ' + esc(upd) + '.</div>') +
      '<div class="f-row" style="gap:9px;flex-wrap:wrap">' +
        '<button class="btn btn-primary btn-sm" data-act="publish"' + (state.offline ? ' disabled' : '') + '>Публикувай сега</button>' +
        '<button class="btn btn-ghost btn-sm" data-act="export">Изтегли резервно копие (JSON)</button>' +
        '<label class="btn btn-ghost btn-sm file-btn">Възстанови от JSON<input type="file" accept="application/json" id="importFile"></label>' +
      '</div>' +
      (state.dirty ? '<p class="small" style="color:#8a5a00;margin:14px 0 0">Има непубликувани промени.</p>' : '') +
      '</div>' +

      '<div class="card"><div class="card-head"><div><h3>Правила за достъп (Firebase)</h3>' +
      '<p>Поставете този текст в Realtime Database → Rules.</p></div>' +
      '<button class="btn btn-ghost btn-sm" data-act="copy-rules">Копирай</button></div>' +
      '<pre class="code-box" id="rulesBox">' + esc(RULES) + '</pre></div>';
  }

  function sectionAccount() {
    return '<div class="card"><div class="card-head"><h3>Профил</h3></div>' +
      '<table class="tbl"><tbody>' +
      '<tr><td style="width:170px">Имейл</td><td>' + esc(state.user ? state.user.email : '—') + '</td></tr>' +
      '<tr><td>Роля</td><td>' + esc(ROLE_LABEL[state.role] || 'администратор') + '</td></tr>' +
      '<tr><td>Достъп до базата</td><td>' + (state.user ? 'разрешен според правилата' : 'няма') + '</td></tr>' +
      '</tbody></table></div>' +

      (state.user ?
      '<div class="card"><div class="card-head"><div><h3>Смяна на паролата</h3><p>Препоръчително след първия вход.</p></div></div>' +
        '<div class="grid-2c">' +
        fieldWrap('Текуща парола', '<input class="f-input" type="password" id="pwCurrent" autocomplete="current-password">') +
        fieldWrap('Нова парола', '<input class="f-input" type="password" id="pwNew" autocomplete="new-password">') +
        '</div>' +
        '<div class="f-row"><button class="btn btn-primary btn-sm" data-act="change-pw">Смени паролата</button></div>' +
        '<div class="notice" style="margin-top:16px">Още потребители с достъп се добавят от раздел „Потребители“ — там се създава акаунтът и се задава роля. ' +
        'Промяната на имейл или пълно изтриване на акаунт се прави в Firebase Console → Authentication → Users.</div>' +
      '</div>' : '') +

      '<div class="card"><div class="card-head"><h3>Изход</h3></div>' +
      '<button class="btn btn-ghost btn-sm" data-act="logout">Излез от панела</button></div>';
  }

  /* --------------------------------------------------------------- rendering */
  var TITLES = {
    dashboard: 'Табло', news: 'Новини', classes: 'Паралелки', teachers: 'Учители',
    gallery: 'Галерия', documents: 'Документи', pages: 'Страници', careers: 'Кариери',
    general: 'Основни данни', home: 'Начало и херо', about: 'За училището',
    admission: 'Прием и въпроси', users: 'Потребители', publish: 'Публикуване', account: 'Профил и достъп'
  };

  function renderSection() {
    var html = '';
    var sec = state.section;

    if (sec === 'dashboard') html = sectionDashboard();
    else if (sec === 'careers') html = sectionCareers();
    else if (LISTS[sec]) html = renderList(sec);
    else if (sec === 'general') html = sectionGeneral();
    else if (sec === 'home') html = sectionHome();
    else if (sec === 'about') html = sectionAbout();
    else if (sec === 'admission') html = sectionAdmission();
    else if (sec === 'users') html = sectionUsers();
    else if (sec === 'publish') html = sectionPublish();
    else if (sec === 'account') html = sectionAccount();

    var box = $('#adminContent');
    box.innerHTML = html;
    $('#pageTitle').textContent = TITLES[sec] || '';
    updateDirty();
    hydrateImages(box);
  }

  function hydrateImages(root) {
    var els = root.querySelectorAll('[data-prev]');
    Array.prototype.forEach.call(els, function (el) {
      var val = getPath(state.content, el.getAttribute('data-prev'));
      if (!val) {
        el.classList.add('empty');
        if (el.tagName === 'IMG') { el.removeAttribute('src'); }
        return;
      }
      el.classList.remove('empty');
      var done = function (u) { if (u) el.src = u; };
      if (isMedia(val)) PIG.resolveImage(val).then(done);
      else if (String(val).indexOf('data:') === 0) el.src = val;
      else el.src = val;
    });
  }

  /* ---------------------------------------------------------------- events */
  var content = function () { return $('#adminContent'); };

  content().addEventListener('input', function (e) {
    var t = e.target;
    var path = t.getAttribute && t.getAttribute('data-path');
    if (!path) return;
    if (t.type === 'checkbox') { setPath(state.content, path, t.checked); markDirty(); return; }
    if (t.getAttribute('data-type') === 'number') { setPath(state.content, path, t.value === '' ? 0 : Number(t.value)); markDirty(); return; }
    setPath(state.content, path, t.value);
    markDirty();
  });

  content().addEventListener('change', function (e) {
    var t = e.target;
    if (t.type === 'checkbox' && t.getAttribute('data-path')) {
      setPath(state.content, t.getAttribute('data-path'), t.checked);
      markDirty();
    }
    if (t.type === 'file') {
      if (t.id === 'importFile') { importJson(t); return; }
      if (t.getAttribute('data-upload')) { pickImage(t); }
    }
  });

  content().addEventListener('click', function (e) {
    var btn = e.target.closest('[data-act], [data-sec]');
    if (!btn) return;
    var sec = btn.getAttribute('data-sec');
    if (sec) { go(sec); return; }

    var act = btn.getAttribute('data-act');
    var list = btn.getAttribute('data-list');
    var path = btn.getAttribute('data-path');
    var i = parseInt(btn.getAttribute('data-i'), 10);

    if (act === 'list-add') {
      var cfg = LISTS[list];
      state.content[cfg.key] = state.content[cfg.key] || [];
      state.content[cfg.key].unshift(cfg.blank());
      state.editing = { list: list, index: 0 };
      markDirty(); renderSection(); buildNav();
      return;
    }
    if (act === 'list-edit') { state.editing = { list: list, index: i }; renderSection(); return; }
    if (act === 'list-back') { state.editing = null; renderSection(); buildNav(); return; }
    if (act === 'list-del') {
      var c2 = LISTS[list];
      if (!confirm('Да изтрия ли този запис?')) return;
      state.content[c2.key].splice(i, 1);
      state.editing = null;
      markDirty(); renderSection(); buildNav();
      toast('Записът е изтрит от черновата. Натиснете „Публикувай“, за да го премахнете от сайта.');
      return;
    }
    if (act === 'list-up' || act === 'list-down') {
      var arr = state.content[LISTS[list].key];
      var j = act === 'list-up' ? i - 1 : i + 1;
      if (j < 0 || j >= arr.length) return;
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      markDirty(); renderSection();
      return;
    }
    if (act === 'rep-add') {
      var a = getPath(state.content, path);
      if (!Array.isArray(a)) { a = []; setPath(state.content, path, a); }
      var tmpl = { 'site.stats': { value: '', label: '' } }[path] || {};
      if (/^site\.(bells)$/.test(path)) tmpl = { n: '', from: '', to: '' };
      if (/documents$/.test(path) && !/\.\d/.test(path)) { a.push(''); }
      else a.push(JSON.parse(JSON.stringify(tmpl)));
      markDirty(); renderSection();
      return;
    }
    if (act === 'rep-del') {
      var arr2 = getPath(state.content, path);
      if (Array.isArray(arr2)) arr2.splice(i, 1);
      markDirty(); renderSection();
      return;
    }
    if (act === 'rep-up' || act === 'rep-down') {
      var arr3 = getPath(state.content, path);
      var k = act === 'rep-up' ? i - 1 : i + 1;
      if (!Array.isArray(arr3) || k < 0 || k >= arr3.length) return;
      var t2 = arr3[i]; arr3[i] = arr3[k]; arr3[k] = t2;
      markDirty(); renderSection();
      return;
    }
    if (act === 'clear-img') {
      setPath(state.content, path, '');
      markDirty(); renderSection();
      return;
    }
    if (act === 'export') { exportJson(); return; }
    if (act === 'test-webhook') { testWebhook(); return; }
    if (act === 'publish') { publish(); return; }
    if (act === 'copy-rules') {
      navigator.clipboard.writeText(RULES).then(function () { toast('Правилата са копирани.', 'ok'); },
        function () { toast('Копирането не е разрешено от браузъра.', 'err'); });
      return;
    }
    if (act === 'change-pw') { changePassword(); return; }
    if (act === 'user-add') { addUser(); return; }
    if (act === 'user-save') { saveUser(btn.getAttribute('data-uid')); return; }
    if (act === 'user-edit') {
      state.editing = { list: 'users', index: btn.getAttribute('data-uid') };
      renderSection();
      return;
    }
    if (act === 'user-cancel') { state.editing = null; renderSection(); return; }
    if (act === 'user-del') {
      removeUser(btn.getAttribute('data-uid'), btn.getAttribute('data-email'));
      return;
    }
    if (act === 'user-reset') { resetUser(btn.getAttribute('data-email')); return; }
    if (act === 'user-refresh') { loadStaff(true); return; }
    if (act === 'logout') { $('#logoutBtn').click(); return; }
    if (act === 'quick-news') { go('news'); setTimeout(function () { var b = document.querySelector('[data-act="list-add"][data-list="news"]'); if (b) b.click(); }, 30); return; }
    if (act === 'quick-gallery') { go('gallery'); setTimeout(function () { var b = document.querySelector('[data-act="list-add"][data-list="gallery"]'); if (b) b.click(); }, 30); return; }
  });

  /* --------------------------------------------------------------- images */
  function resizeImage(file, maxSide, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var objUrl = URL.createObjectURL(file);
      img.onload = function () {
        var scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        var w = Math.max(1, Math.round(img.width * scale));
        var h = Math.max(1, Math.round(img.height * scale));
        var cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(objUrl);
        resolve(cv.toDataURL('image/jpeg', quality));
      };
      img.onerror = function () { URL.revokeObjectURL(objUrl); reject(new Error('bad image')); };
      img.src = objUrl;
    });
  }

  function uploadDataUrl(dataUrl) {
    var id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    return PIG.saveMedia(id, dataUrl).then(function () { return 'media/' + id; });
  }

  function pickImage(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var path = input.getAttribute('data-upload');
    if (!/^image\//.test(file.type)) { toast('Изберете файл с изображение.', 'err'); return; }

    resizeImage(file, 1600, 0.82).then(function (dataUrl) {
      if (dataUrl.length > 950000) return resizeImage(file, 1150, 0.72);
      return dataUrl;
    }).then(function (dataUrl) {
      if (PIG.online && PIG.user) {
        return uploadDataUrl(dataUrl).then(function (ref) {
          setPath(state.content, path, ref);
          toast('Снимката е качена.', 'ok');
        });
      }
      setPath(state.content, path, dataUrl);
      toast('Офлайн: снимката ще се качи при публикуване.', 'warn');
    }).then(function () {
      markDirty();
      renderSection();
    }).catch(function (e) {
      toast('Снимката не можа да бъде обработена: ' + (e && e.message), 'err');
    });
  }

  /* --------------------------------------------------------------- publish */
  function collectDataUrls(obj) {
    var out = [];
    (function walk(o, p) {
      if (typeof o === 'string') { if (o.indexOf('data:image/') === 0) out.push(p); return; }
      if (Array.isArray(o)) { o.forEach(function (v, i) { walk(v, p ? p + '.' + i : String(i)); }); return; }
      if (o && typeof o === 'object') {
        Object.keys(o).forEach(function (k) { walk(o[k], p ? p + '.' + k : k); });
      }
    })(obj, '');
    return out;
  }

  function publish() {
    if (state.offline || !PIG.user) { toast('Влезте с администраторски профил, за да публикувате.', 'err'); return; }
    if (state.busy) return;
    state.busy = true;
    var btns = document.querySelectorAll('#publishBtn, #publishBtn2');
    Array.prototype.forEach.call(btns, function (b) { b.disabled = true; b.textContent = 'Публикуване…'; });

    var paths = collectDataUrls(state.content);
    var chain = Promise.resolve();
    paths.forEach(function (p) {
      chain = chain.then(function () {
        return uploadDataUrl(getPath(state.content, p)).then(function (ref) { setPath(state.content, p, ref); });
      });
    });

    chain.then(function () { return PIG.saveContent(state.content); })
      .then(function () {
        state.dirty = false;
        localStorage.removeItem(DRAFT_KEY);
        updateDirty();
        toast('Публикувано успешно. Промените са на сайта.', 'ok');
      })
      .catch(function (e) {
        console.error(e);
        toast('Грешка при публикуване: ' + PIG.explainError(e), 'err');
      })
      .then(function () {
        state.busy = false;
        Array.prototype.forEach.call(document.querySelectorAll('#publishBtn'), function (b) { b.disabled = false; b.textContent = 'Публикувай'; });
        var b2 = $('#publishBtn2');
        if (b2) { b2.disabled = false; b2.textContent = 'Публикувай сега'; }
        if (state.section === 'publish') renderSection();
      });
  }

  $('#publishBtn').addEventListener('click', publish);

  /* ------------------------------------------------------- export / import */
  function exportJson() {
    var blob = new Blob([JSON.stringify(state.content, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'pig-content-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  function importJson(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var data = JSON.parse(fr.result);
        if (!data || !data.site) throw new Error('Файлът не съдържа валидно съдържание.');
        state.content = data;
        state.dirty = true;
        markDirty();
        buildNav();
        renderSection();
        toast('Съдържанието е заредено. Проверете и публикувайте.', 'ok');
      } catch (e) {
        toast('Неуспешно четене: ' + e.message, 'err');
      }
    };
    fr.readAsText(file);
  }

  function changePassword() {
    var cur = $('#pwCurrent'), nw = $('#pwNew');
    if (!cur.value || !nw.value) { toast('Попълнете текущата и новата парола.', 'err'); return; }
    if (nw.value.length < 6) { toast('Новата парола трябва да е поне 6 знака.', 'err'); return; }
    PIG.changePassword(cur.value, nw.value).then(function () {
      cur.value = ''; nw.value = '';
      toast('Паролата е сменена.', 'ok');
    }).catch(function (e) {
      toast(PIG.explainError(e), 'err');
    });
  }

  /* ------------------------------------------------------------------ rules */
  var RULES = [
    '{',
    '  "rules": {',
    '    ".read": false,',
    '    ".write": false,',
    '',
    '    "content": {',
    '      ".read": true,',
    '      ".write": "auth != null && (auth.token.email == \'admin@pig-ohridski.bg\' || auth.token.email == \'atodorov434@gmail.com\' || root.child(\'staff\').child(auth.uid).exists())"',
    '    },',
    '',
    '    "media": {',
    '      ".read": true,',
    '      ".write": "auth != null && (auth.token.email == \'admin@pig-ohridski.bg\' || auth.token.email == \'atodorov434@gmail.com\' || root.child(\'staff\').child(auth.uid).exists())",',
    '      "$id": { ".validate": "newData.isString() && newData.val().length < 1200000" }',
    '    },',
    '',
    '    "staff": {',
    '      ".read": "auth != null",',
    '      ".write": "auth != null && (auth.token.email == \'admin@pig-ohridski.bg\' || auth.token.email == \'atodorov434@gmail.com\' || root.child(\'staff\').child(auth.uid).child(\'role\').val() == \'admin\')",',
    '      "$uid": { ".validate": "newData.hasChildren([\'email\'])" }',
    '    }',
    '  }',
    '}'
  ].join('\n');

  /* ---------------------------------------------------------------- startup */
  window.addEventListener('beforeunload', function (e) {
    if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
  });
})();
