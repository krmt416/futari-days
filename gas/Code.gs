/**
 * Futari Days — GAS backend (v1.1.0 / 合言葉方式)
 *
 * 役割:   スプレッドシートをDBにした JSON API。GitHub Pages のフロントから呼ばれる。
 * 安全性: ① 合言葉(10文字以上)をサーバー側で照合。正しい人だけにセッションを発行
 *         ② 失敗が続くとロック＋遅延。合言葉を変えると全セッションが自動で無効
 *         ③ ログイン後は独自セッショントークン(30日・ハッシュ保存・失効可能)
 *         ④ メンバーは2枠(a/b)のみ。全入力をサーバー側で検証、数式注入を防止
 *         ⑤ 監査ログ、書き込み排他制御
 *
 * 設定(Script properties) — コードには書かない:
 *   PASSPHRASE  ふたりの合言葉（10文字以上。日本語OK）
 */

var APP = {
  VERSION: '1.0.0',
  SESSION_DAYS: 30,
  SESSION_RENEW_DAYS: 15,
  MAX_SESSIONS_PER_USER: 8,
  MAX_EVENTS: 200,
  MAX_TASKS: 3000,
  LOGIN_FAIL_LIMIT: 5,
  LOGIN_LOCK_SEC: 900,
  PASS_MIN: 10
};

var SHEETS = { events: 'events', tasks: 'tasks', members: 'members', sessions: '_sessions', audit: '_audit' };

var SCHEMA = {
  events:   ['id', 'title', 'emoji', 'kind', 'date', 'time', 'place', 'color', 'note', 'createdBy', 'createdAt', 'updatedAt', 'deleted'],
  tasks:    ['id', 'eventId', 'title', 'note', 'due', 'assignee', 'done', 'doneBy', 'doneAt', 'createdBy', 'createdAt', 'updatedAt', 'deleted'],
  members:  ['uid', 'name', 'emoji', 'color', 'profileSet', 'updatedAt'],
  sessions: ['hash', 'uid', 'pf', 'exp', 'createdAt'],
  audit:    ['ts', 'uid', 'action', 'target', 'result']
};

var SLOTS = ['a', 'b'];
var KINDS = ['engagement', 'yuino', 'kaomiwase', 'nyuseki', 'maeduri', 'wedding', 'afterparty', 'honeymoon', 'anniversary', 'custom'];
var COLORS = ['rose', 'coral', 'gold', 'sage', 'teal', 'lilac', 'mocha'];

/* ============================== エントリポイント ============================== */

function doGet() {
  // 疎通確認のみ。データや設定は一切返さない。
  return json_({ ok: true, app: 'futari-days', v: APP.VERSION });
}

function doPost(e) {
  var out;
  try {
    out = route_(parse_(e));
  } catch (err) {
    out = fail_(err);
  }
  return json_(out);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function AppError(code, message) {
  this.code = code;
  this.message = message;
}

function fail_(err) {
  if (err instanceof AppError) return { ok: false, error: { code: err.code, message: err.message } };
  try { console.error(String(err && err.stack || err)); } catch (x) {}
  return { ok: false, error: { code: 'SERVER', message: 'サーバーでエラーが発生しました。少し待ってからもう一度お試しください。' } };
}

function ok_(data) {
  return { ok: true, data: data };
}

function parse_(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string') throw new AppError('BAD_REQUEST', '不正なリクエストです');
  var raw = e.postData.contents;
  if (raw.length > 60000) throw new AppError('BAD_REQUEST', 'リクエストが大きすぎます');
  var req;
  try { req = JSON.parse(raw); } catch (x) { throw new AppError('BAD_REQUEST', '不正なリクエストです'); }
  if (!req || typeof req !== 'object' || typeof req.a !== 'string') throw new AppError('BAD_REQUEST', '不正なリクエストです');
  return req;
}

/* ================================== ルーター ================================== */

function route_(req) {
  var action = req.a;
  var p = (req.p && typeof req.p === 'object') ? req.p : {};

  if (action === 'login') return ok_(login_(p));

  var user = authSession_(req.s);

  switch (action) {
    case 'bootstrap':  return ok_(snapshot_(user));
    case 'poll':       return ok_({ version: version_() });
    case 'saveProfile': return ok_(locked_(function () { return saveProfile_(user, p); }));
    case 'saveEvent':  return ok_(locked_(function () { return saveEvent_(user, p); }));
    case 'deleteEvent': return ok_(locked_(function () { return deleteEvent_(user, p); }));
    case 'saveTask':   return ok_(locked_(function () { return saveTask_(user, p); }));
    case 'toggleTask': return ok_(locked_(function () { return toggleTask_(user, p); }));
    case 'deleteTask': return ok_(locked_(function () { return deleteTask_(user, p); }));
    case 'logout':     return ok_(logout_(user, req.s, false));
    case 'logoutAll':  return ok_(logout_(user, req.s, true));
    default: throw new AppError('BAD_REQUEST', '不明な操作です');
  }
}

function locked_(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    throw new AppError('BUSY', '混み合っています。もう一度お試しください。');
  }
  try {
    var before = version_();
    var out = fn();
    // 直前のバージョンを返す → クライアントが「自分以外の更新があったか」を判定できる
    if (out && typeof out === 'object') out.prevVersion = before;
    return out;
  } finally {
    lock.releaseLock();
  }
}

/* ================================= 設定・認証 ================================= */

function config_() {
  var pass = norm_(PropertiesService.getScriptProperties().getProperty('PASSPHRASE'));
  // fail closed: 未設定・短すぎる合言葉では全拒否
  if (pass.length < APP.PASS_MIN) throw new AppError('CONFIG', 'サーバー設定が未完了です（PASSPHRASE は' + APP.PASS_MIN + '文字以上）。');
  return { passHash: sha256_('futari-days:pass:' + pass), fp: sha256_('futari-days:fp:' + pass).slice(0, 16) };
}

// 全角/半角の揺れ（日本語キーボード対策）を吸収して比較する
function norm_(v) {
  var s = String(v == null ? '' : v);
  try { s = s.normalize('NFKC'); } catch (e) { /* noop */ }
  return s.trim();
}

function safeEq_(a, b) {
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function sha256_(str) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { var v = (b < 0 ? b + 256 : b).toString(16); return v.length === 1 ? '0' + v : v; }).join('');
}

function uidOfSlot_(slot) { return 'm_' + slot; }

function membersPublic_() {
  var rows = readAll_('members');
  return SLOTS.map(function (slot) {
    var uid = uidOfSlot_(slot);
    var r = rows.filter(function (m) { return m.uid === uid; })[0];
    return r
      ? { uid: uid, slot: slot, name: r.name, emoji: r.emoji, color: r.color, joined: true, profileSet: r.profileSet === '1' }
      : { uid: uid, slot: slot, name: '', emoji: slot === 'a' ? '🌸' : '🌿', color: slot === 'a' ? 'rose' : 'sage', joined: false, profileSet: false };
  });
}

function login_(p) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('login_fail') || 0);
  if (fails >= APP.LOGIN_FAIL_LIMIT) throw new AppError('TOO_MANY', '試行回数が多すぎます。しばらく（15分ほど）してからお試しください。');

  var cfg = config_();
  var given = norm_(typeof p.passphrase === 'string' ? p.passphrase.slice(0, 200) : '');
  var okPass = safeEq_(sha256_('futari-days:pass:' + given), cfg.passHash);
  if (!okPass) {
    Utilities.sleep(800); // 総当たりを遅くする
    cache.put('login_fail', String(fails + 1), APP.LOGIN_LOCK_SEC);
    audit_('-', 'login', '-', 'bad');
    throw new AppError('AUTH', '合言葉が違います。');
  }
  cache.remove('login_fail');

  var slot = typeof p.slot === 'string' ? p.slot : '';
  if (!slot) return { needSlot: true, members: membersPublic_() };   // 合言葉OK → どちらか選んでもらう
  if (SLOTS.indexOf(slot) < 0) throw new AppError('INVALID', '選択が正しくありません');

  var uid = uidOfSlot_(slot);
  var token = locked_(function () {
    ensureMember_(slot);
    return issueSession_(uid, cfg);
  });
  audit_(uid, 'login', '-', 'ok');
  var snap = snapshot_({ uid: uid });
  snap.session = token;
  return snap;
}

function issueSession_(uid, cfg) {
  var now = Date.now();
  var rows = readAll_('sessions').filter(function (r) { return Number(r.exp) > now && r.pf === cfg.fp; });
  var mine = rows.filter(function (r) { return r.uid === uid; }).sort(function (a, b) { return Number(a.exp) - Number(b.exp); });
  while (mine.length >= APP.MAX_SESSIONS_PER_USER) {
    var drop = mine.shift();
    rows = rows.filter(function (r) { return r.hash !== drop.hash; });
  }
  var token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  rows.push({ hash: sha256_(token), uid: uid, pf: cfg.fp, exp: String(now + APP.SESSION_DAYS * 86400000), createdAt: new Date(now).toISOString() });
  rewrite_('sessions', rows);
  return token;
}

function authSession_(token) {
  var cfg = config_();
  if (typeof token !== 'string' || token.length < 32 || token.length > 200) throw new AppError('AUTH', 'ログインが必要です');
  var hash = sha256_(token);
  var cache = CacheService.getScriptCache();
  var uid = null;
  var cached = cache.get('ss_' + hash);
  if (cached) {
    var parts = cached.split('|');
    if (parts[1] === cfg.fp) uid = parts[0];
  }
  if (!uid) {
    var now = Date.now();
    var row = readAll_('sessions').filter(function (r) { return r.hash === hash; })[0];
    // 合言葉を変えると fp が変わり、既存セッションは全て無効になる
    if (!row || !(Number(row.exp) > now) || row.pf !== cfg.fp) throw new AppError('AUTH', 'ログインが必要です');
    uid = row.uid;
    if (Number(row.exp) - now < APP.SESSION_RENEW_DAYS * 86400000) {
      locked_(function () {
        var fresh = readAll_('sessions').filter(function (r) { return r.hash === hash; })[0];
        if (fresh) { fresh.exp = String(now + APP.SESSION_DAYS * 86400000); updateRow_('sessions', fresh); }
      });
    }
    cache.put('ss_' + hash, uid + '|' + cfg.fp, 600);
  }
  if (SLOTS.map(uidOfSlot_).indexOf(uid) < 0) throw new AppError('AUTH', 'ログインが必要です');
  return { uid: uid, hash: hash };
}

function logout_(user, token, all) {
  locked_(function () {
    var cache = CacheService.getScriptCache();
    var rows = readAll_('sessions');
    var keep = rows.filter(function (r) {
      var gone = all ? true : r.hash === user.hash;   // 合言葉共有なので「全端末」は両者の全セッション
      if (gone) cache.remove('ss_' + r.hash);
      return !gone;
    });
    rewrite_('sessions', keep);
  });
  audit_(user.uid, all ? 'logoutAll' : 'logout', '-', 'ok');
  return { done: true };
}

/* ================================== スナップショット ================================== */

function version_() {
  return PropertiesService.getScriptProperties().getProperty('DV') || '0';
}

function bump_() {
  var v = String(Date.now());
  PropertiesService.getScriptProperties().setProperty('DV', v);
  return v;
}

function ensureMember_(slot) {
  var uid = uidOfSlot_(slot);
  if (readAll_('members').some(function (r) { return r.uid === uid; })) return;
  appendRow_('members', {
    uid: uid, name: slot === 'a' ? 'わたし' : 'パートナー', emoji: slot === 'a' ? '🌸' : '🌿', color: slot === 'a' ? 'rose' : 'sage',
    profileSet: '0', updatedAt: new Date().toISOString()
  });
}

function snapshot_(user) {
  config_();
  return {
    me: user.uid,
    members: membersPublic_(),
    events: readAll_('events').filter(notDeleted_).map(pubEvent_),
    tasks: readAll_('tasks').filter(notDeleted_).map(pubTask_),
    version: version_(),
    serverTime: new Date().toISOString()
  };
}

function notDeleted_(r) { return r.deleted !== '1'; }

function pubEvent_(r) {
  return { id: r.id, title: r.title, emoji: r.emoji, kind: r.kind, date: r.date, time: r.time, place: r.place,
           color: r.color, note: r.note, createdBy: r.createdBy, createdAt: r.createdAt, updatedAt: r.updatedAt };
}

function pubTask_(r) {
  return { id: r.id, eventId: r.eventId, title: r.title, note: r.note, due: r.due, assignee: r.assignee,
           done: r.done === '1', doneBy: r.doneBy, doneAt: r.doneAt, createdBy: r.createdBy,
           createdAt: r.createdAt, updatedAt: r.updatedAt };
}

/* ================================== 入力検証 ================================== */

function clip_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}

function vStr_(v, max, required, label) {
  var s = clip_(v, max);
  if (required && !s) throw new AppError('INVALID', label + 'を入力してください');
  return s;
}

function vDate_(v, required, label) {
  var s = clip_(v, 10);
  if (!s) {
    if (required) throw new AppError('INVALID', label + 'を入力してください');
    return '';
  }
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) throw new AppError('INVALID', label + 'の形式が正しくありません');
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3] || +m[1] < 1990 || +m[1] > 2100) {
    throw new AppError('INVALID', label + 'が正しくありません');
  }
  return s;
}

function vTime_(v) {
  var s = clip_(v, 5);
  if (!s) return '';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(s)) throw new AppError('INVALID', '時刻の形式が正しくありません');
  return s;
}

function vOneOf_(v, list, fallback) {
  var s = clip_(v, 20);
  return list.indexOf(s) >= 0 ? s : fallback;
}

function vEmoji_(v, fallback) {
  var s = clip_(v, 16);
  return s || fallback;
}

function addDays_(dateStr, n) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  var t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) + n * 86400000);
  return t.getUTCFullYear() + '-' + ('0' + (t.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + t.getUTCDate()).slice(-2);
}

function diffDays_(a, b) {
  var pa = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a), pb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
  return Math.round((Date.UTC(+pb[1], +pb[2] - 1, +pb[3]) - Date.UTC(+pa[1], +pa[2] - 1, +pa[3])) / 86400000);
}

function vAssignee_(v) {
  var s = clip_(v, 20);
  if (s === 'both' || !s) return 'both';
  if (SLOTS.map(uidOfSlot_).indexOf(s) < 0) throw new AppError('INVALID', '担当者が正しくありません');
  return s;
}

/* ================================== 書き込み系 ================================== */

function saveProfile_(user, p) {
  var rows = readAll_('members');
  var me = rows.filter(function (r) { return r.uid === user.uid; })[0];
  if (!me) throw new AppError('NOT_FOUND', 'メンバーが見つかりません');
  me.name = vStr_(p.name, 12, true, '名前');
  me.emoji = vEmoji_(p.emoji, me.emoji || '🌸');
  me.color = vOneOf_(p.color, COLORS, me.color || 'rose');
  me.profileSet = '1';
  me.updatedAt = new Date().toISOString();
  updateRow_('members', me);
  audit_(user.uid, 'saveProfile', user.uid, 'ok');
  return { version: bump_() };
}

function saveEvent_(user, p) {
  var src = (p.event && typeof p.event === 'object') ? p.event : {};
  var now = new Date().toISOString();
  var events = readAll_('events');
  var existing = null;

  if (src.id) {
    existing = events.filter(function (r) { return r.id === String(src.id) && notDeleted_(r); })[0];
    if (!existing) throw new AppError('NOT_FOUND', '予定が見つかりません');
  } else if (events.filter(notDeleted_).length >= APP.MAX_EVENTS) {
    throw new AppError('LIMIT', '予定の登録数が上限です');
  }

  var rec = existing || { id: Utilities.getUuid().slice(0, 13), createdBy: user.uid, createdAt: now, deleted: '0' };
  var oldDate = existing ? existing.date : '';
  rec.title = vStr_(src.title, 40, true, 'タイトル');
  rec.emoji = vEmoji_(src.emoji, '💗');
  rec.kind = vOneOf_(src.kind, KINDS, 'custom');
  rec.date = vDate_(src.date, true, '日付');
  rec.time = vTime_(src.time);
  rec.place = vStr_(src.place, 60, false, '場所');
  rec.color = vOneOf_(src.color, COLORS, 'rose');
  rec.note = vStr_(src.note, 400, false, 'メモ');
  rec.updatedAt = now;

  if (existing) updateRow_('events', rec); else appendRow_('events', rec);

  var createdTasks = [];
  var changedTasks = [];

  // おすすめタスクを一括追加（新規作成時、または詳細画面の「おすすめタスクを追加」）
  if (Array.isArray(p.tasks) && p.tasks.length) {
    var taskCount = readAll_('tasks').filter(notDeleted_).length;
    var items = p.tasks.slice(0, 30);
    if (taskCount + items.length > APP.MAX_TASKS) throw new AppError('LIMIT', 'タスクの登録数が上限です');
    items.forEach(function (it) {
      if (!it || typeof it !== 'object') return;
      var title = clip_(it.title, 80);
      if (!title) return;
      var due = '';
      if (it.daysBefore !== undefined && it.daysBefore !== null && isFinite(Number(it.daysBefore))) {
        var n = Math.max(0, Math.min(1000, Math.round(Number(it.daysBefore))));
        due = addDays_(rec.date, -n);
      }
      var t = newTask_(user, { eventId: rec.id, title: title, due: due, assignee: 'both' }, now);
      appendRow_('tasks', t);
      createdTasks.push(pubTask_(t));
    });
  }

  // 日付変更時: 期限をずらす
  if (existing && oldDate && oldDate !== rec.date && p.shiftTasks === true) {
    var delta = diffDays_(oldDate, rec.date);
    readAll_('tasks').filter(function (t) { return notDeleted_(t) && t.eventId === rec.id && t.due; }).forEach(function (t) {
      t.due = addDays_(t.due, delta);
      t.updatedAt = now;
      updateRow_('tasks', t);
      changedTasks.push(pubTask_(t));
    });
  }

  audit_(user.uid, existing ? 'updateEvent' : 'createEvent', rec.id, 'ok');
  return { event: pubEvent_(rec), tasks: createdTasks.concat(changedTasks), version: bump_() };
}

function deleteEvent_(user, p) {
  var id = clip_(p.id, 40);
  var now = new Date().toISOString();
  var ev = readAll_('events').filter(function (r) { return r.id === id && notDeleted_(r); })[0];
  if (!ev) throw new AppError('NOT_FOUND', '予定が見つかりません');
  ev.deleted = '1'; ev.updatedAt = now;
  updateRow_('events', ev);
  var removed = [];
  readAll_('tasks').filter(function (t) { return t.eventId === id && notDeleted_(t); }).forEach(function (t) {
    t.deleted = '1'; t.updatedAt = now;
    updateRow_('tasks', t);
    removed.push(t.id);
  });
  audit_(user.uid, 'deleteEvent', id, 'ok');
  return { id: id, removedTasks: removed, version: bump_() };
}

function newTask_(user, f, now) {
  return {
    id: Utilities.getUuid().slice(0, 13), eventId: f.eventId || '', title: f.title, note: f.note || '',
    due: f.due || '', assignee: f.assignee || 'both', done: '0', doneBy: '', doneAt: '',
    createdBy: user.uid, createdAt: now, updatedAt: now, deleted: '0'
  };
}

function saveTask_(user, p) {
  var src = (p.task && typeof p.task === 'object') ? p.task : {};
  var now = new Date().toISOString();
  var tasks = readAll_('tasks');
  var existing = null;

  if (src.id) {
    existing = tasks.filter(function (r) { return r.id === String(src.id) && notDeleted_(r); })[0];
    if (!existing) throw new AppError('NOT_FOUND', 'タスクが見つかりません');
  } else if (tasks.filter(notDeleted_).length >= APP.MAX_TASKS) {
    throw new AppError('LIMIT', 'タスクの登録数が上限です');
  }

  var eventId = clip_(src.eventId, 40);
  if (eventId) {
    var ev = readAll_('events').filter(function (r) { return r.id === eventId && notDeleted_(r); })[0];
    if (!ev) throw new AppError('INVALID', '紐づける予定が見つかりません');
  }

  var fields = {
    eventId: eventId,
    title: vStr_(src.title, 80, true, 'タスク名'),
    note: vStr_(src.note, 300, false, 'メモ'),
    due: vDate_(src.due, false, '期限'),
    assignee: vAssignee_(src.assignee)
  };

  var rec;
  if (existing) {
    rec = existing;
    rec.eventId = fields.eventId; rec.title = fields.title; rec.note = fields.note;
    rec.due = fields.due; rec.assignee = fields.assignee; rec.updatedAt = now;
    updateRow_('tasks', rec);
  } else {
    rec = newTask_(user, fields, now);
    appendRow_('tasks', rec);
  }
  audit_(user.uid, existing ? 'updateTask' : 'createTask', rec.id, 'ok');
  return { task: pubTask_(rec), version: bump_() };
}

function toggleTask_(user, p) {
  var id = clip_(p.id, 40);
  var rec = readAll_('tasks').filter(function (r) { return r.id === id && notDeleted_(r); })[0];
  if (!rec) throw new AppError('NOT_FOUND', 'タスクが見つかりません');
  var done = p.done === true;
  rec.done = done ? '1' : '0';
  rec.doneBy = done ? user.uid : '';
  rec.doneAt = done ? new Date().toISOString() : '';
  rec.updatedAt = new Date().toISOString();
  updateRow_('tasks', rec);
  audit_(user.uid, done ? 'doneTask' : 'undoTask', id, 'ok');
  return { task: pubTask_(rec), version: bump_() };
}

function deleteTask_(user, p) {
  var id = clip_(p.id, 40);
  var rec = readAll_('tasks').filter(function (r) { return r.id === id && notDeleted_(r); })[0];
  if (!rec) throw new AppError('NOT_FOUND', 'タスクが見つかりません');
  rec.deleted = '1'; rec.updatedAt = new Date().toISOString();
  updateRow_('tasks', rec);
  audit_(user.uid, 'deleteTask', id, 'ok');
  return { id: id, version: bump_() };
}

/* ================================== シートDB層 ================================== */

var memo_ = { ss: null, sheets: {} };

function ss_() {
  if (memo_.ss) return memo_.ss;
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SHEET_ID');
  var ss = null;
  if (id) {
    ss = SpreadsheetApp.openById(id);
  } else {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      ss = SpreadsheetApp.create('Futari Days DB');
      props.setProperty('SHEET_ID', ss.getId());
    }
  }
  memo_.ss = ss;
  return ss;
}

function sheet_(key) {
  if (memo_.sheets[key]) return memo_.sheets[key];
  var ss = ss_();
  var cols = SCHEMA[key];
  var sh = ss.getSheetByName(SHEETS[key]);
  if (!sh) {
    sh = ss.insertSheet(SHEETS[key]);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
    // 全セルをテキスト形式に固定 → 入力値が数式として解釈されない
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');
    if (key === 'sessions' || key === 'audit') sh.hideSheet();
  }
  memo_.sheets[key] = sh;
  return sh;
}

var FORMULA_RE = /^[=+\-@]/;

function enc_(v) {
  var s = String(v == null ? '' : v);
  return FORMULA_RE.test(s) ? "'" + s : s;
}

function dec_(v) {
  var s = String(v == null ? '' : v);
  return /^'[=+\-@]/.test(s) ? s.slice(1) : s;
}

function readAll_(key) {
  var sh = sheet_(key);
  var cols = SCHEMA[key];
  var last = sh.getLastRow();
  if (last < 2) return [];
  var vals = sh.getRange(2, 1, last - 1, cols.length).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (vals[i][0] === '' || vals[i][0] == null) continue;
    var o = { _row: i + 2 };
    for (var c = 0; c < cols.length; c++) o[cols[c]] = dec_(vals[i][c]);
    out.push(o);
  }
  return out;
}

function toRow_(key, obj) {
  return SCHEMA[key].map(function (c) { return enc_(obj[c]); });
}

function ensureRows_(sh, row, ncols) {
  var max = sh.getMaxRows();
  if (row > max) {
    sh.insertRowsAfter(max, Math.max(200, row - max));
    sh.getRange(max + 1, 1, sh.getMaxRows() - max, ncols).setNumberFormat('@');
  }
}

function appendRow_(key, obj) {
  var sh = sheet_(key);
  var row = Math.max(sh.getLastRow() + 1, 2);
  ensureRows_(sh, row, SCHEMA[key].length);
  sh.getRange(row, 1, 1, SCHEMA[key].length).setValues([toRow_(key, obj)]);
  obj._row = row;
}

function updateRow_(key, obj) {
  if (!obj._row) throw new Error('row missing');
  sheet_(key).getRange(obj._row, 1, 1, SCHEMA[key].length).setValues([toRow_(key, obj)]);
}

function rewrite_(key, objs) {
  var sh = sheet_(key);
  var cols = SCHEMA[key].length;
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, cols).clearContent();
  if (!objs.length) return;
  ensureRows_(sh, objs.length + 1, cols);
  sh.getRange(2, 1, objs.length, cols).setValues(objs.map(function (o) { return toRow_(key, o); }));
}

function audit_(uid, action, target, result) {
  try {
    var sh = sheet_('audit');
    var row = Math.max(sh.getLastRow() + 1, 2);
    ensureRows_(sh, row, SCHEMA.audit.length);
    sh.getRange(row, 1, 1, SCHEMA.audit.length).setValues([[new Date().toISOString(), uid, action, target, result]]);
    if (row > 3000) sh.deleteRows(2, 1500);
  } catch (e) { /* 監査ログの失敗で本処理を止めない */ }
}

/* ================================== 管理用（エディタから実行） ================================== */

/** 設定確認: エディタで実行すると、設定が正しいかをログに出す */
function selfCheck() {
  var pass = norm_(PropertiesService.getScriptProperties().getProperty('PASSPHRASE'));
  console.log('PASSPHRASE: ' + (pass.length >= APP.PASS_MIN ? '設定済み（' + pass.length + '文字・OK）' : '未設定、または' + APP.PASS_MIN + '文字未満です'));
  sheet_('events'); sheet_('tasks'); sheet_('members'); sheet_('sessions'); sheet_('audit');
  console.log('シート: 初期化OK');
}

/** 緊急用: 全員のセッションを失効（エディタから実行） */
function revokeAllSessions() {
  rewrite_('sessions', []);
    console.log('全セッションを失効しました。');
}
