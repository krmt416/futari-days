/* API層: 本番(GAS)とデモ(localStorage)を同じインターフェースで扱う */
(() => {
  'use strict';
  const CFG = Object.assign({ GAS_URL: '' }, window.FUTARI_CONFIG || {});
  const DEMO = new URLSearchParams(location.search).has('demo');
  const SESSION_KEY = 'fd.session';

  class ApiError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }

  const store = {
    get() { try { return localStorage.getItem(SESSION_KEY) || ''; } catch (e) { return ''; } },
    set(v) { try { localStorage.setItem(SESSION_KEY, v); } catch (e) { /* noop */ } },
    clear() { try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* noop */ } }
  };

  /* ---------------- 本番 ---------------- */
  let queue = Promise.resolve();

  async function post(action, payload, withSession = true) {
    if (!CFG.GAS_URL) throw new ApiError('CONFIG', 'config.js の GAS_URL が未設定です');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(CFG.GAS_URL, {
        method: 'POST',
        // text/plain にすることで CORS プリフライト(OPTIONS)を発生させない
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ a: action, s: withSession ? store.get() : '', p: payload || {} }),
        redirect: 'follow',
        keepalive: true,   // 画面を閉じる直前の書き込みも最後まで送る
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        signal: ctrl.signal
      });
      const json = await res.json();
      if (!json || json.ok !== true) {
        const err = (json && json.error) || { code: 'SERVER', message: 'エラーが発生しました' };
        throw new ApiError(err.code, err.message);
      }
      return json.data;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (e && e.name === 'AbortError') throw new ApiError('NETWORK', '通信がタイムアウトしました');
      throw new ApiError('NETWORK', '通信できませんでした。電波の良い場所でもう一度お試しください。');
    } finally {
      clearTimeout(timer);
    }
  }

  const WRITES = new Set(['saveProfile', 'saveEvent', 'deleteEvent', 'saveTask', 'toggleTask', 'togglePaid', 'deleteTask']);

  const real = {
    async call(action, payload) {
      if (action === 'login') return post('login', payload, false);
      if (WRITES.has(action)) {
        // 書き込みは順番を保って1件ずつ送る（連打しても順序が崩れない）
        const run = () => post(action, payload);
        const p = queue.then(run, run);
        queue = p.catch(() => {});
        return p;
      }
      return post(action, payload);
    }
  };

  /* ---------------- デモ（ブラウザ内だけで完結） ---------------- */
  const DEMO_KEY = 'fd.demo.db';
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 13) : String(Math.random()).slice(2, 15));
  const pad = (n) => String(n).padStart(2, '0');
  const dstr = (offset) => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  function seed() {
    const now = new Date().toISOString();
    const me = 'u_me', pt = 'u_pt';
    const ev = (title, emoji, kind, off, color, place, time) => ({
      id: uuid(), title, emoji, kind, date: dstr(off), time: time || '', place: place || '', color, note: '',
      createdBy: me, createdAt: now, updatedAt: now
    });
    const e1 = ev('婚約の日', '💍', 'engagement', -128, 'lilac', '');
    const e2 = ev('両家顔合わせ', '🍽️', 'kaomiwase', 34, 'coral', '個室 和食 さくら亭', '12:00');
    const e3 = ev('入籍', '📝', 'nyuseki', 121, 'sage', '');
    const e4 = ev('結婚式', '💒', 'wedding', 301, 'rose', 'ホテル グランベル', '11:30');
    const events = [e1, e2, e3, e4];
    const tk = (eventId, title, due, assignee, done, who) => ({
      id: uuid(), eventId, title, note: '', due, assignee, done: !!done,
      doneBy: done ? (who === 'pt' || assignee === pt ? pt : me) : '', doneAt: done ? new Date(Date.now() - 3600e3 * (who === 'pt' ? 2 : 5)).toISOString() : '',
      createdBy: who === 'pt' ? pt : me, createdAt: who === 'pt' ? new Date(Date.now() - 3600e3 * 3).toISOString() : now, updatedAt: now
    });
    const tasks = [
      tk(e2.id, '双方の親に顔合わせを打診', dstr(-26), 'both', true),
      tk(e2.id, '候補日を3つ出して日程調整', dstr(-16), 'both', true, 'pt'),
      Object.assign(tk(e2.id, 'お店を予約（個室・アレルギー確認）', dstr(-6), pt, false), { cost: 30000, paid: true }),
      tk(e2.id, '席順と当日の進行を決める', dstr(13), me, false),
      Object.assign(tk(e2.id, '手土産・記念品を用意', dstr(20), pt, false, 'pt'), { cost: 8000, paid: false }),
      tk(e2.id, '服装・集合時間を両家に共有', dstr(24), 'both', false),
      tk(e3.id, '戸籍謄本など必要書類を取得', dstr(100), me, false),
      tk(e3.id, '婚姻届を記入・証人に署名をお願い', dstr(107), 'both', false),
      Object.assign(tk(e4.id, '式場を見学して仮予約', dstr(61), 'both', false), { cost: 50000, paid: false }),
      tk(e4.id, '招待客リストを作る', dstr(151), 'both', false),
      tk('', '新居の家具をリストアップ', '', pt, false)
    ];
    return {
      me,
      members: [
        { uid: me, name: 'ゆう', emoji: '🌸', color: 'rose', joined: true, profileSet: true },
        { uid: pt, name: 'みお', emoji: '🌿', color: 'sage', joined: true, profileSet: true }
      ],
      events, tasks, version: String(Date.now())
    };
  }

  function db() {
    try { const j = localStorage.getItem(DEMO_KEY); if (j) return JSON.parse(j); } catch (e) { /* noop */ }
    const d = seed(); saveDb(d); return d;
  }
  function saveDb(d) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); } catch (e) { /* noop */ } }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const snap = (d) => ({ me: d.me, members: d.members, events: d.events, tasks: d.tasks, version: d.version, serverTime: new Date().toISOString() });
  const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

  const demo = {
    async call(action, p = {}) {
      await wait(action === 'poll' ? 10 : 120);
      const d = db();
      const prev = d.version;
      const out = await demo.run(action, p, d);
      if (out && out.version && out.version !== prev) out.prevVersion = prev;
      return out;
    },
    async run(action, p, d) {
      const bump = () => { d.version = String(Date.now()); saveDb(d); return d.version; };
      switch (action) {
        case 'login': { const s = snap(d); s.session = 'demo-session'; return s; }
        case 'bootstrap': return snap(d);
        case 'poll': return { version: d.version };
        case 'logout': case 'logoutAll': return { done: true };
        case 'saveProfile': {
          const m = d.members.find((x) => x.uid === d.me);
          m.name = clip(p.name, 12) || m.name; m.emoji = clip(p.emoji, 16) || m.emoji; m.color = p.color || m.color; m.profileSet = true;
          return { version: bump() };
        }
        case 'saveEvent': {
          const s = p.event || {}; const now = new Date().toISOString();
          if (!clip(s.title, 40)) throw new ApiError('INVALID', 'タイトルを入力してください');
          if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date || '')) throw new ApiError('INVALID', '日付を入力してください');
          let rec = s.id && d.events.find((e) => e.id === s.id);
          const oldDate = rec && rec.date;
          const created = [];
          if (!rec) { rec = { id: uuid(), createdBy: d.me, createdAt: now }; d.events.push(rec); }
          Object.assign(rec, { title: clip(s.title, 40), emoji: clip(s.emoji, 16) || '💗', kind: s.kind || 'custom', date: s.date, time: s.time || '',
            place: clip(s.place, 60), color: s.color || 'rose', note: clip(s.note, 400), updatedAt: now });
          if (Array.isArray(p.tasks) && p.tasks.length) {
            p.tasks.slice(0, 30).forEach((it) => {
              const dt = new Date(rec.date + 'T00:00:00'); dt.setDate(dt.getDate() - Math.round(it.daysBefore || 0));
              const t = { id: uuid(), eventId: rec.id, title: clip(it.title, 80), note: '', due: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`,
                assignee: 'both', done: false, doneBy: '', doneAt: '', createdBy: d.me, createdAt: now, updatedAt: now };
              d.tasks.push(t); created.push(t);
            });
          }
          if (s.id && oldDate && oldDate !== rec.date && p.shiftTasks === true) {
            const delta = Math.round((new Date(rec.date) - new Date(oldDate)) / 86400000);
            d.tasks.filter((t) => t.eventId === rec.id && t.due).forEach((t) => {
              const dt = new Date(t.due + 'T00:00:00'); dt.setDate(dt.getDate() + delta);
              t.due = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`; created.push(t);
            });
          }
          return { event: rec, tasks: created, version: bump() };
        }
        case 'deleteEvent': {
          d.events = d.events.filter((e) => e.id !== p.id);
          const removed = d.tasks.filter((t) => t.eventId === p.id).map((t) => t.id);
          d.tasks = d.tasks.filter((t) => t.eventId !== p.id);
          return { id: p.id, removedTasks: removed, version: bump() };
        }
        case 'saveTask': {
          const s = p.task || {}; const now = new Date().toISOString();
          if (!clip(s.title, 80)) throw new ApiError('INVALID', 'タスク名を入力してください');
          let rec = s.id && d.tasks.find((t) => t.id === s.id);
          if (!rec) { rec = { id: uuid(), done: false, doneBy: '', doneAt: '', createdBy: d.me, createdAt: now }; d.tasks.push(rec); }
          Object.assign(rec, { eventId: s.eventId || '', title: clip(s.title, 80), note: clip(s.note, 300), due: s.due || '', assignee: s.assignee || 'both', updatedAt: now });
          if ('cost' in s) { const n = s.cost === null || s.cost === '' ? null : Number(s.cost); if (n !== null && (!Number.isInteger(n) || n < 0 || n > 99999999)) throw new ApiError('INVALID', '費用は 0〜99,999,999 の整数（円）で入力してください'); rec.cost = n; }
          if ('paid' in s) rec.paid = s.paid === true;
          return { task: rec, version: bump() };
        }
        case 'toggleTask': {
          const t = d.tasks.find((x) => x.id === p.id);
          if (!t) throw new ApiError('NOT_FOUND', 'タスクが見つかりません');
          t.done = p.done === true; t.doneBy = t.done ? d.me : ''; t.doneAt = t.done ? new Date().toISOString() : '';
          return { task: t, version: bump() };
        }
        case 'togglePaid': {
          const t = d.tasks.find((x) => x.id === p.id);
          if (!t) throw new ApiError('NOT_FOUND', 'タスクが見つかりません');
          t.paid = p.paid === true; return { task: t, version: bump() };
        }
        case 'deleteTask': {
          d.tasks = d.tasks.filter((t) => t.id !== p.id);
          return { id: p.id, version: bump() };
        }
        default: throw new ApiError('BAD_REQUEST', '不明な操作です');
      }
    }
  };

  window.FDApi = {
    ApiError, CFG, DEMO, session: store,
    call: (action, payload) => (DEMO ? demo : real).call(action, payload),
    resetDemo() { try { localStorage.removeItem(DEMO_KEY); } catch (e) { /* noop */ } }
  };
})();
