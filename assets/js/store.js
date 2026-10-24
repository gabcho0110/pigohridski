/* ==========================================================================
   ПИГ „Св. Климент Охридски“ – слой за данни
   Firebase Realtime Database (съдържание) + Firebase Auth (администрация)
   Изображенията се пазят като base64 в RTDB (възел media), за да не се
   изисква платен план за Cloud Storage.
   ========================================================================== */
(function () {
  'use strict';

  var CONFIG = {
    apiKey: "AIzaSyCbLVVMd2ezq11VtoxWIOkYqkryQbMFHxE",
    authDomain: "pigsite-5b862.firebaseapp.com",
    databaseURL: "https://pigsite-5b862-default-rtdb.firebaseio.com",
    projectId: "pigsite-5b862",
    storageBucket: "pigsite-5b862.firebasestorage.app",
    messagingSenderId: "865348764495",
    appId: "1:865348764495:web:161e917f25792f7e1d07fa",
    measurementId: "G-5RWLE9EYNF"
  };

  var DB_URL = CONFIG.databaseURL;

  var PIG = window.PIG = {
    config: CONFIG,
    dbUrl: DB_URL,
    online: false,
    user: null,
    content: null,
    mediaCache: {}
  };

  var auth = null, db = null;

  try {
    if (window.firebase && window.firebase.initializeApp) {
      var app = window.firebase.apps && window.firebase.apps.length
        ? window.firebase.app()
        : window.firebase.initializeApp(CONFIG);
      auth = window.firebase.auth(app);
      db = window.firebase.database(app);
      PIG.online = true;
    }
  } catch (e) {
    console.warn('[PIG] Firebase не е инициализиран:', e && e.message);
  }

  PIG.auth = auth;
  PIG.db = db;

  /* --------------------------------------------------------------- content */
  PIG.loadContent = function () {
    var seed = window.PIG_CONTENT || {};
    if (!db) return Promise.resolve(seed);
    return db.ref('content').once('value').then(function (snap) {
      var v = snap.val();
      if (v && typeof v === 'object' && v.site) return v;
      return seed;
    }).catch(function (e) {
      console.warn('[PIG] Четенето от базата е неуспешно:', e && e.message);
      return seed;
    });
  };

  PIG.saveContent = function (content) {
    if (!db) return Promise.reject(new Error('Няма връзка с Firebase.'));
    var payload = JSON.parse(JSON.stringify(content));
    payload.meta = payload.meta || {};
    payload.meta.updated = new Date().toISOString();
    return db.ref('content').set(payload);
  };

  /* ----------------------------------------------------------------- media */
  PIG.mediaUrl = function (id) { return DB_URL + '/media/' + id + '.json'; };

  PIG.loadMedia = function (id) {
    if (!id) return Promise.resolve('');
    if (PIG.mediaCache[id]) return Promise.resolve(PIG.mediaCache[id]);
    return fetch(PIG.mediaUrl(id), { cache: 'force-cache' })
      .then(function (r) { return r.ok ? r.json() : ''; })
      .then(function (v) {
        if (typeof v === 'string' && v) PIG.mediaCache[id] = v;
        return PIG.mediaCache[id] || '';
      })
      .catch(function () { return ''; });
  };

  PIG.saveMedia = function (id, dataUrl) {
    if (!db) return Promise.reject(new Error('Няма връзка с Firebase.'));
    return db.ref('media/' + id).set(dataUrl);
  };

  PIG.deleteMedia = function (id) {
    if (!db) return Promise.reject(new Error('Няма връзка с Firebase.'));
    return db.ref('media/' + id).remove();
  };

  /* Изображение: или относителен път/uploads..., или "media/<id>" */
  PIG.resolveImage = function (value) {
    if (!value) return Promise.resolve('');
    var m = /^media\/([A-Za-z0-9_-]+)$/.exec(value);
    if (!m) return Promise.resolve(value);
    return PIG.loadMedia(m[1]);
  };

  /* -------------------------------------------------------------- auth api */
  PIG.signIn = function (email, password) {
    if (!auth) return Promise.reject(new Error('Firebase не е достъпен.'));
    return auth.signInWithEmailAndPassword(email, password).then(function (cred) {
      PIG.user = cred.user;
      return cred.user;
    });
  };

  PIG.signOut = function () {
    if (!auth) return Promise.resolve();
    return auth.signOut();
  };

  PIG.onAuth = function (cb) {
    if (!auth) { cb(null); return; }
    auth.onAuthStateChanged(function (u) { PIG.user = u; cb(u); });
  };

  PIG.changePassword = function (current, next) {
    if (!auth || !auth.currentUser) return Promise.reject(new Error('Няма влязъл потребител.'));
    var user = auth.currentUser;
    var cred = window.firebase.auth.EmailAuthProvider.credential(user.email, current);
    return user.reauthenticateWithCredential(cred).then(function () {
      return user.updatePassword(next);
    });
  };

  /* ------------------------------------------------------------ потребители */
  /* Основни администратори — винаги имат достъп, дори без запис в staff. */
  var BOOTSTRAP_ADMINS = ['admin@pig-ohridski.bg', 'atodorov434@gmail.com'];
  PIG.BOOTSTRAP_ADMINS = BOOTSTRAP_ADMINS;

  function isBootstrap(email) {
    return BOOTSTRAP_ADMINS.indexOf(String(email || '').toLowerCase()) !== -1;
  }
  PIG.isBootstrap = isBootstrap;

  /* Създава акаунт в Firebase Auth, без да изхвърля текущия потребител
     (втори app instance). Връща uid. */
  PIG.createAuthUser = function (email, password, displayName) {
    if (!window.firebase) return Promise.reject(new Error('Firebase не е достъпен.'));
    var appName = 'pig-provision-' + Date.now();
    var secondary = null;
    try {
      secondary = window.firebase.initializeApp(CONFIG, appName);
    } catch (e) {
      return Promise.reject(e);
    }
    var secAuth = secondary.auth();
    return secAuth.createUserWithEmailAndPassword(email, password).then(function (cred) {
      var uid = cred.user.uid;
      var p = displayName ? cred.user.updateProfile({ displayName: displayName }) : Promise.resolve();
      return p.then(function () { return secAuth.signOut(); }).then(function () {
        try { secondary.delete(); } catch (e) {}
        return uid;
      });
    }).catch(function (err) {
      try { secAuth.signOut(); } catch (e) {}
      try { secondary.delete(); } catch (e) {}
      throw err;
    });
  };

  PIG.listStaff = function () {
    if (!db) return Promise.reject(new Error('Няма връзка с базата.'));
    return db.ref('staff').once('value').then(function (s) { return s.val() || {}; });
  };

  PIG.saveStaff = function (uid, data) {
    if (!db) return Promise.reject(new Error('Няма връзка с базата.'));
    return db.ref('staff/' + uid).set(data);
  };

  PIG.removeStaff = function (uid) {
    if (!db) return Promise.reject(new Error('Няма връзка с базата.'));
    return db.ref('staff/' + uid).remove();
  };

  PIG.sendReset = function (email) {
    if (!auth) return Promise.reject(new Error('Firebase не е достъпен.'));
    return auth.sendPasswordResetEmail(email);
  };

  /* Дали влезлият потребител има достъп до панела */
  PIG.checkAccess = function (user) {
    if (!user) return Promise.resolve({ allowed: false });
    if (isBootstrap(user.email)) {
      return Promise.resolve({ allowed: true, role: 'admin', name: 'Основен администратор' });
    }
    if (!db) return Promise.resolve({ allowed: false });
    return db.ref('staff/' + user.uid).once('value').then(function (s) {
      var v = s.val();
      if (v) return { allowed: true, role: v.role || 'editor', name: v.name || user.email };
      return { allowed: false };
    }).catch(function () {
      return { allowed: false, error: 'rules' };
    });
  };

  /* ------------------------------------------------------- приятелски грешки */  PIG.explainError = function (e) {
    var code = (e && (e.code || e.message)) || '';
    var map = {
      'auth/invalid-email': 'Невалиден имейл адрес.',
      'auth/user-not-found': 'Няма регистриран потребител с този имейл.',
      'auth/wrong-password': 'Грешна парола.',
      'auth/invalid-credential': 'Грешен имейл или парола.',
      'auth/invalid-login-credentials': 'Грешен имейл или парола.',
      'auth/too-many-requests': 'Твърде много опити. Изчакайте няколко минути.',
      'auth/network-request-failed': 'Няма връзка с интернет.',
      'auth/operation-not-allowed': 'Входът с имейл и парола не е активиран в Firebase Console (Authentication → Sign-in method → Email/Password).',
      'auth/unauthorized-domain': 'Домейнът не е разрешен в Firebase Console (Authentication → Settings → Authorized domains).',
      'auth/weak-password': 'Паролата трябва да е поне 6 знака.',
      'auth/missing-password': 'Въведете парола.',
      'auth/email-already-in-use': 'Този имейл вече има акаунт. Ако човекът е забравил паролата си, използвайте „Изпрати имейл за нова парола“.',
      'auth/user-disabled': 'Този акаунт е блокиран в Firebase Console.',
      'auth/requires-recent-login': 'Минало е много време от последния вход. Излезте и влезте отново, после опитайте пак.',
      'auth/admin-restricted-operation': 'Създаването на нови акаунти е изключено в Firebase Console (Authentication → Settings → User actions → Create).'
    };
    for (var k in map) { if (code.indexOf(k) !== -1) return map[k]; }
    if (/permission_denied/.test(code)) return 'Базата отказа достъп. Проверете правилата (Rules) в Realtime Database.';
    return (e && (e.message || e.code)) || 'Неизвестна грешка.';
  };
})();
