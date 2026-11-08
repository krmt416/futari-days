/* Futari Days — UI本体 */
(() => {
  'use strict';
  const FD = window.FD;
  const Api = window.FDApi;
  const CFG = Api.CFG;

  /* ============================== ユーティリティ ============================== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dayNum = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) / 86400000; };
  const daysFrom = (s, base = todayStr()) => Math.round(dayNum(s) - dayNum(base));
  const addDays = (s, n) => { const t = new Date((dayNum(s) + n) * 86400000); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`; };
  const wdOf = (s) => { const [y, m, d] = s.split('-').map(Number); return WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; };
  const fmtDate = (s) => { const [y, m, d] = s.split('-').map(Number); return `${y}年${m}月${d}日（${wdOf(s)}）`; };
  const fmtMD = (s) => { const [, m, d] = s.split('-').map(Number); return `${m}/${d}`; };
  const fmtMDW = (s) => `${fmtMD(s)}(${wdOf(s)})`;

  const ago = (iso) => {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'たった今';
    if (m < 60) return `${m}分前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}時間前`;
    return `${Math.floor(h / 24)}日前`;
  };

  const haptic = (ms = 12) => { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* noop */ } };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* noop */ } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* noop */ } };

  const I = (p, extra = '') => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${p}</svg>`;
  const ICON = {
    home: I('<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9.5a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/>'),
    tasks: I('<path d="m4 6.5 1.6 1.6L8.5 5"/><path d="m4 12.5 1.6 1.6 2.9-3.1"/><path d="m4 18.5 1.6 1.6 2.9-3.1"/><path d="M12 7h8M12 13h8M12 19h8"/>'),
    gear: I('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
    edit: I('<path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z"/>'),
    check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    clock: I('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    pin: I('<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>'),
    note: I('<path d="M6 4h12a1 1 0 0 1 1 1v14l-4-3H6a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/>'),
    refresh: I('<path d="M20 11a8 8 0 0 0-14.5-4M4 13a8 8 0 0 0 14.5 4"/><path d="M5.5 3v4h4M18.5 21v-4h-4"/>'),
    trash: I('<path d="M5 7h14M10 11v6M14 11v6M7 7l1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12M9 7V4h6v3"/>'),
    cal: I('<rect x="4" y="5.5" width="16" height="14.5" rx="3"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>'),
    lock: I('<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>'),
    spark: I('<path d="M12 3.5 13.8 9l5.7 1.8-5.7 1.8L12 18l-1.8-5.4L4.5 10.8 10.2 9z"/>')
  };

  /* ============================== 状態 ============================== */
  const S = {
    status: 'boot', // boot | login | app
    me: '', members: [], events: [], tasks: [], version: '',
    tab: 'home', scope: lsGet('fd.scope') || 'all', evFilter: lsGet('fd.evf') || '', showDone: false,
    heroIdx: 0, enter: true, syncing: false, offline: !navigator.onLine,
    loginError: '', loginBusy: false, theme: lsGet('fd.theme') || 'auto'
  };
  S.seenAt = (() => { const v = Number(lsGet('fd.seen')); if (v) return v; lsSet('fd.seen', String(Date.now())); return Date.now(); })();
  S.collapsed = (() => { try { return new Set(JSON.parse(lsGet('fd.col') || '[]')); } catch (e) { return new Set(); } })();
  const counted = new Set();
  const hidden = new Set();          // 「元に戻す」待ちで一時的に隠している id
  const pendingDel = new Map();      // 削除の確定待ち
  const MS_DAYS = [100, 50, 30, 14, 7, 3, 1];   // カウントダウンの節目
  let sheetRender = null;
  let sheetOpen = false;
  let lastFocus = null;

  const CACHE_KEY = 'fd.cache.v1';
  const saveCache = () => {
    if (Api.DEMO) return;
    lsSet(CACHE_KEY, JSON.stringify({ me: S.me, members: S.members, events: S.events, tasks: S.tasks, version: S.version }));
  };
  const loadCache = () => {
    try {
      const c = JSON.parse(lsGet(CACHE_KEY) || 'null');
      if (c && c.me && Array.isArray(c.events)) { Object.assign(S, { me: c.me, members: c.members || [], events: c.events, tasks: c.tasks || [], version: c.version || '' }); return true; }
    } catch (e) { /* noop */ }
    return false;
  };
  const applySnapshot = (snap) => {
    S.me = snap.me; S.members = snap.members || []; S.events = (snap.events || []).filter((e) => !hidden.has(e.id)); S.tasks = (snap.tasks || []).filter((t) => !hidden.has(t.id)); S.version = snap.version || '';
    saveCache();
  };

  const mem = (uid) => S.members.find((m) => m.uid === uid);
  const meM = () => mem(S.me) || { uid: S.me, name: 'あなた', emoji: '🌸', color: 'rose', profileSet: false };
  const ptM = () => S.members.find((m) => m.uid !== S.me);
  const nameOf = (uid) => { const m = mem(uid); return m && m.name ? m.name : (uid === S.me ? 'あなた' : 'パートナー'); };
  const evById = (id) => S.events.find((e) => e.id === id);
  const colorOf = (k) => FD.COLORS[k] ? k : 'rose';
  const kindOf = (ev) => FD.KINDS[ev.kind] || FD.KINDS.custom;

  const av = (m, cls = '') => {
    if (!m) return '';
    const ghost = m.joined === false ? ' ghost' : '';
    return `<span class="av c-${colorOf(m.color)}${ghost} ${cls}" title="${esc(m.name || '')}">${esc(m.emoji || '💗')}</span>`;
  };
  const assigneeHtml = (t) => {
    if (t.assignee === 'both' || !mem(t.assignee)) {
      const p = ptM();
      return `<span class="av-pair">${av(meM())}${p ? av(p) : ''}</span>`;
    }
    return av(mem(t.assignee));
  };

  const evStats = (id) => {
    const ts = S.tasks.filter((t) => t.eventId === id);
    const done = ts.filter((t) => t.done).length;
    return { total: ts.length, done, pct: ts.length ? done / ts.length : 0 };
  };
  const isNewTask = (t) => {
    const p = ptM(); if (!p || String(t.id).startsWith('tmp_')) return false;
    return (t.createdBy === p.uid && Date.parse(t.createdAt) > S.seenAt) || (t.done && t.doneBy === p.uid && Date.parse(t.doneAt) > S.seenAt);
  };
  const activityItems = () => {
    const p = ptM(); if (!p) return [];
    const lim = Date.now() - 14 * 86400000; const out = [];
    S.tasks.forEach((t) => {   // 1つのタスクにつき、いちばん新しい動きだけ
      const c = t.createdBy === p.uid && Date.parse(t.createdAt) > lim ? { at: t.createdAt, type: 'add', id: t.id, title: t.title } : null;
      const d = t.done && t.doneBy === p.uid && Date.parse(t.doneAt) > lim ? { at: t.doneAt, type: 'done', id: t.id, title: t.title } : null;
      const pick = d && (!c || d.at >= c.at) ? d : c; if (pick) out.push(pick);
    });
    S.events.forEach((e) => { if (e.createdBy === p.uid && Date.parse(e.createdAt) > lim) out.push({ at: e.createdAt, type: 'ev', id: e.id, title: e.title }); });
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
  };
  const clipTxt = (x, n = 14) => (x.length > n ? `${x.slice(0, n)}…` : x);
  const yen = (n) => `¥${Number(n).toLocaleString('ja-JP')}`;
  const costStats = (ts) => {
    let total = 0; let paid = 0; let n = 0;
    ts.forEach((t) => { if (t.cost != null) { n++; total += t.cost; if (t.paid) paid += t.cost; } });
    return { n, total, paid, unpaid: total - paid, pct: total ? paid / total : 0 };
  };
  const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.createdAt || '').localeCompare(b.createdAt || '');

  /* ============================== トースト / 紙吹雪 ============================== */
  const toast = (msg, kind = '', opts = {}) => {
    const el = document.createElement('div');
    el.className = `toast ${kind}${opts.action ? ' act' : ''}`;
    const sp = document.createElement('span'); sp.textContent = msg; el.appendChild(sp);
    let timer = 0;
    const close = () => { clearTimeout(timer); el.classList.remove('in'); setTimeout(() => el.remove(), 300); };
    if (opts.action) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = opts.action.label;
      b.addEventListener('click', () => { close(); opts.action.fn(); }); el.appendChild(b);
    }
    $('#toasts').appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    timer = setTimeout(close, opts.ttl || (kind === 'err' ? 4200 : 2200));
    return close;
  };
  const toastErr = (e) => toast((e && e.message) || 'うまくいきませんでした', 'err');

  let parts = []; let raf = 0;
  const burst = (o = {}) => {
    if (reduceMotion()) return;
    const cv = $('#confetti'); const ctx = cv.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const ox = o.x != null ? o.x : innerWidth / 2; const oy = o.y != null ? o.y : innerHeight * 0.4;
    const cols = ['#FF8FA7', '#F8DB8E', '#CDBDF5', '#8FD8CE', '#FFB08A', '#ffffff'];
    const n = o.n || 80;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const v = (o.power || 9) * (0.4 + Math.random() * 0.9);
      parts.push({ x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: 4 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
        c: cols[i % cols.length], life: 0, ttl: 90 + Math.random() * 50, emoji: Math.random() < 0.18 ? ['💗', '✨', '💍'][i % 3] : '' });
    }
    if (!raf) raf = requestAnimationFrame(tickConfetti);
  };
  const tickConfetti = () => {
    const cv = $('#confetti'); const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.life < p.ttl && p.y < innerHeight + 40);
    parts.forEach((p) => {
      p.life++; p.vy += 0.34; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = Math.max(0, 1 - p.life / p.ttl);
      if (p.emoji) { ctx.font = `${p.r * 3}px serif`; ctx.fillText(p.emoji, -p.r, p.r); } else { ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.5); }
      ctx.restore();
    });
    if (parts.length) raf = requestAnimationFrame(tickConfetti); else { raf = 0; ctx.clearRect(0, 0, innerWidth, innerHeight); }
  };

  /* ============================== 描画: ログイン（合言葉） ============================== */
  const SLOT_KEY = 'fd.slot';
  const loginState = { step: 'pass', pass: '', members: [] };

  const renderLogin = () => {
    const configured = !!CFG.GAS_URL;
    const head = `<div class="rings" aria-hidden="true">
        <svg viewBox="0 0 160 110"><defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF9DB0"/><stop offset="1" stop-color="#E4577B"/></linearGradient><linearGradient id="lg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F8DB8E"/><stop offset="1" stop-color="#D9A13A"/></linearGradient></defs>
          <circle class="r1" cx="62" cy="62" r="34" fill="none" stroke="url(#lg1)" stroke-width="9"/>
          <circle class="r2" cx="98" cy="62" r="34" fill="none" stroke="url(#lg2)" stroke-width="9"/>
          <path class="sp" d="M80 14l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="#E4577B"/></svg></div>
      <h1 class="logo">Futari Days</h1>`;
    let body;
    if (!configured) {
      body = `<p class="tag">ふたりのカウントダウン ＆ タスク帳</p>
        <div class="notice">セットアップがまだ完了していません。<br><small>README の手順で config.js に GAS_URL を設定してください。</small></div>
        <a class="btn primary" href="?demo=1">デモで触ってみる</a>`;
    } else if (loginState.step === 'slot') {
      body = `<p class="tag">どっちがあなた？</p>
        <div class="slots">${loginState.members.map((m) => `<button class="slot c-${colorOf(m.color)}" data-action="pick-slot" data-slot="${esc(m.slot)}">${av(m, 'lg')}<b>${m.joined ? esc(m.name) : 'はじめて'}</b><small>${m.joined ? 'この名前で入る' : 'ここに登録する'}</small></button>`).join('')}</div>
        <button class="btn ghost" data-action="login-back">戻る</button>`;
    } else {
      body = `<p class="tag">ふたりの合言葉で入ろう</p>
        <form class="pwform" data-form="login" autocomplete="on" novalidate>
          <div class="pw"><input id="pw" name="pass" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false" placeholder="合言葉" aria-label="合言葉" required>
            <button type="button" class="pwtoggle" data-action="show-pw" aria-label="合言葉を表示">👁</button></div>
          <button class="btn primary wide lg" type="submit">入る</button>
        </form>`;
    }
    $('#app').innerHTML = `<main class="login"><section class="login-card">${head}${body}
      <p class="login-err" role="alert">${esc(S.loginError)}</p>
      <p class="fine">${ICON.lock}<span>合言葉を知っているふたりだけが入れます</span></p></section></main>`;
    const pw = $('#pw'); if (pw) setTimeout(() => pw.focus(), 350);
  };

  const finishLogin = (snap) => {
    Api.session.set(snap.session);
    lsSet(SLOT_KEY, String(snap.me).replace(/^m_/, ''));
    loginState.pass = ''; loginState.step = 'pass';
    applySnapshot(snap);
    enterApp(true);
  };

  const doLogin = async (slot) => {
    const card = $('.login-card'); if (card) card.classList.add('busy');
    S.loginError = '';
    try {
      const res = await Api.call('login', { passphrase: loginState.pass, slot: slot || '' });
      if (res.needSlot) {
        const remembered = lsGet(SLOT_KEY);
        if (remembered && res.members.some((m) => m.slot === remembered)) { doLogin(remembered); return; }
        loginState.step = 'slot'; loginState.members = res.members; S.status = 'login'; render(); return;
      }
      finishLogin(res);
    } catch (e) {
      S.loginError = e.message || 'ログインできませんでした';
      loginState.step = 'pass'; loginState.pass = '';
      render();
    }
  };

  /* ============================== 描画: ホーム ============================== */
  const greeting = () => { const h = new Date().getHours(); return h < 5 ? 'おつかれさま' : h < 11 ? 'おはよう' : h < 18 ? 'こんにちは' : 'こんばんは'; };

  const ringSvg = (pct, label) => {
    const C = 2 * Math.PI * 22; const off = C * (1 - Math.max(0, Math.min(1, pct)));
    return `<div class="ring" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="22" class="ring-bg"/><circle cx="28" cy="28" r="22" class="ring-fg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg><span>${Math.round(pct * 100)}<small>%</small></span></div>`;
  };

  const weeksText = (days) => {
    if (days < 7) return '';
    const w = Math.floor(days / 7); const r = days % 7;
    return `${w}週間${r ? `と${r}日` : 'ちょうど'}`;
  };
  const heroMsg = (days) => days === 0 ? '今日はふたりの大切な日。おめでとう！' : days === 1 ? 'いよいよ明日。ゆっくり休んでね' : days <= 7 ? 'もうすぐ！最終チェックしよう' : days <= 30 ? 'あと1か月。準備を進めよう' : 'ふたりのペースで準備しよう';

  const heroHtml = (ev) => {
    const days = daysFrom(ev.date); const st = evStats(ev.id);
    let pct; let label;
    if (st.total) { pct = st.pct; label = `準備 ${st.done}/${st.total}`; } else {
      const start = (ev.createdAt || '').slice(0, 10) || todayStr();
      const span = Math.max(1, daysFrom(ev.date, start)); pct = Math.min(1, Math.max(0, 1 - days / span)); label = '経過';
    }
    const wk = weeksText(days);
    const pills = [];
    if (MS_DAYS.includes(days)) pills.push(`🎯 あと${days}日の節目`);
    if (st.total > 0 && st.done === st.total) pills.push('✨ 準備ばっちり');
    return `<article class="hero c-${colorOf(ev.color)}" data-action="open-event" data-id="${esc(ev.id)}" role="button" tabindex="0" aria-label="${esc(ev.title)} まであと${days}日">
      <i class="orb o1"></i><i class="orb o2"></i><i class="orb o3"></i>
      <div class="hero-top"><span class="hero-kind"><span class="hero-emoji">${esc(ev.emoji)}</span>${esc(kindOf(ev).label)}</span>${ringSvg(pct, label)}</div>
      <div class="hero-main">
        ${days === 0 ? '<div class="hero-today">TODAY</div><div class="hero-num today" data-count="0">🎉</div>' : `<span class="hero-pre">あと</span><span class="hero-num d${Math.min(String(days).length, 4)}" data-count="${days}" data-id="${esc(ev.id)}">${days}</span><span class="hero-unit">日</span>`}
      </div>
      <h2 class="hero-title">${esc(ev.title)}</h2>
      <p class="hero-date">${fmtDate(ev.date)}${ev.time ? `　${esc(ev.time)}〜` : ''}</p>
      ${pills.length ? `<div class="hero-pills">${pills.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
      <p class="hero-sub">${wk ? `<b>${wk}</b>　` : ''}${esc(heroMsg(days))}</p>
      <span class="hero-label">${esc(label)}</span>
    </article>`;
  };

  const sinceCardHtml = () => {
    const past = S.events.filter((e) => daysFrom(e.date) < 0).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!past) return '';
    const elapsed = -daysFrom(past.date);
    const next = FD.MILESTONES.find((m) => m > elapsed) || elapsed + 365;
    const prev = [...FD.MILESTONES].reverse().find((m) => m <= elapsed) || 0;
    const pct = (elapsed - prev) / (next - prev);
    const remain = next - elapsed;
    return `<section class="since card c-${colorOf(past.color)}">
      <div class="since-row"><span class="since-emoji">${esc(past.emoji)}</span>
        <div class="since-text"><small>${esc(past.title)}から</small><b>${elapsed}<span>日目</span></b></div>
        <div class="since-next"><small>次の記念日</small><strong>${next}日</strong><em>あと${remain}日（${fmtMD(addDays(todayStr(), remain))}）</em></div></div>
      <div class="bar"><i style="width:${Math.round(pct * 100)}%"></i></div></section>`;
  };

  const ecardHtml = (ev, past) => {
    const days = daysFrom(ev.date); const st = evStats(ev.id);
    const when = days === 0 ? '<em class="today">今日</em>' : past ? `<em>${-days}</em><small>日前</small>` : `<em>${days}</em><small>日後</small>`;
    return `<button class="ecard c-${colorOf(ev.color)} ${past ? 'past' : ''}" data-action="open-event" data-id="${esc(ev.id)}">
      <span class="ebadge">${esc(ev.emoji)}</span>
      <span class="etext"><b>${esc(ev.title)}</b><small>${fmtMDW(ev.date)}${ev.time ? ` ${esc(ev.time)}` : ''}${ev.place ? ` ・ ${esc(ev.place)}` : ''}</small>
        ${st.total ? `<span class="mini"><span class="bar"><i style="width:${Math.round(st.pct * 100)}%"></i></span><small>${st.done}/${st.total}</small></span>` : ''}</span>
      <span class="edays">${when}</span></button>`;
  };

  const todayHtml = () => {
    if (!S.tasks.length) return '';
    const p = ptM(); const open = S.tasks.filter((t) => !t.done);
    const mineOk = (t) => t.assignee === 'both' || t.assignee === S.me || !mem(t.assignee);
    const mine = open.filter((t) => t.due && daysFrom(t.due) <= 0 && mineOk(t)).sort(byDue);
    const theirs = p ? open.filter((t) => t.due && daysFrom(t.due) <= 0 && t.assignee === p.uid).length : 0;
    if (!mine.length) {
      const next = open.filter((t) => t.due && daysFrom(t.due) > 0 && mineOk(t)).sort(byDue)[0];
      const sub = next ? `次は「${esc(clipTxt(next.title, 18))}」（${fmtMDW(next.due)}）` : theirs ? `${esc(nameOf(p.uid))}の今日ぶんが${theirs}件あります` : 'ゆっくり休んでね';
      return `<section class="card todaydone"><span class="td-emoji">🎉</span><div><b>今日やることは完了！</b><small>${sub}</small></div></section>`;
    }
    return `<section class="today"><h3 class="sec">今日やること<small>${mine.length}</small></h3>
      <ul class="tlist">${mine.slice(0, 5).map((t) => taskRow(t)).join('')}</ul>
      ${mine.length > 5 ? `<button class="more" data-action="goto-tasks">ほか${mine.length - 5}件をタスクで見る ›</button>` : ''}
      ${theirs ? `<p class="fine-note">${esc(nameOf(p.uid))}の今日ぶん：${theirs}件</p>` : ''}</section>`;
  };

  const activityHtml = () => {
    const p = ptM(); const items = activityItems(); if (!p || !items.length) return '';
    const row = (it) => {
      const verb = it.type === 'done' ? 'を完了' : it.type === 'add' ? 'を追加' : 'を予定に追加';
      const nw = Date.parse(it.at) > S.seenAt ? '<i class="newdot">NEW</i>' : '';
      return `<button class="act-row" data-action="${it.type === 'ev' ? 'open-event' : 'edit-task'}" data-id="${esc(it.id)}">${av(p, 'sm')}<span class="act-text"><b>${esc(nameOf(p.uid))}</b>が<em>「${esc(clipTxt(it.title))}」</em>${verb}</span>${nw}<small>${ago(it.at)}</small></button>`;
    };
    return `<section><h3 class="sec">${esc(nameOf(p.uid))}の動き</h3><div class="card actcard">${items.map(row).join('')}</div></section>`;
  };

  const viewHome = () => {
    const m = meM(); const p = ptM();
    const up = S.events.filter((e) => daysFrom(e.date) >= 0).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    const past = S.events.filter((e) => daysFrom(e.date) < 0).sort((a, b) => b.date.localeCompare(a.date));
    const t = todayStr();
    const open = S.tasks.filter((x) => !x.done);
    const soon = open.filter((x) => x.due && daysFrom(x.due) <= 7).length;
    const late = open.filter((x) => x.due && daysFrom(x.due) < 0).length;
    const doneN = S.tasks.length - open.length;
    const d = new Date();
    return `
      <header class="topbar">
        <div><p class="hello">${greeting()}、${esc(m.name || 'あなた')}さん</p><h1 class="big">${d.getMonth() + 1}月${d.getDate()}日<small>（${WD[d.getDay()]}）</small></h1></div>
        <div class="tb-right">
          <button class="iconbtn ${S.syncing ? 'spin' : ''}" data-action="refresh" aria-label="最新の状態に更新">${ICON.refresh}</button>
          <button class="pair" data-action="open-profile" aria-label="プロフィールを編集">${av(m)}${p ? av(p) : ''}</button>
        </div>
      </header>
      ${up.length ? `
        <section class="heroes ${up.length > 1 ? 'multi' : ''}" id="heroes" aria-label="これからの予定">${up.map(heroHtml).join('')}</section>
        ${up.length > 1 ? `<div class="dots" aria-hidden="true">${up.map((_, i) => `<i class="${i === S.heroIdx ? 'on' : ''}"></i>`).join('')}</div>` : ''}`
        : `<section class="empty hero-empty card"><div class="big-emoji">💍</div><h2>最初の「その日」を決めよう</h2><p>婚約・顔合わせ・結婚式…<br>日付を入れると、あと何日かがここに大きく表示されます。</p><button class="btn primary" data-action="new-event">${ICON.plus}予定を追加する</button></section>`}
      ${todayHtml()}
      ${activityHtml()}
      ${sinceCardHtml()}
      <section class="stats">
        <button class="stat" data-action="goto-tasks"><small>今週のやること</small><b>${soon}<span>件</span></b>${late ? `<em class="warn">期限切れ ${late}件</em>` : '<em>順調です</em>'}</button>
        <button class="stat" data-action="goto-tasks"><small>完了したタスク</small><b>${doneN}<span>/ ${S.tasks.length}</span></b><div class="bar"><i style="width:${S.tasks.length ? Math.round(doneN / S.tasks.length * 100) : 0}%"></i></div></button>
      </section>
      ${(() => {
        const cs = costStats(S.tasks); if (!cs.n) return '';
        return `<section class="card costhome"><div class="cc-head"><small>費用の合計（${cs.n}件）</small><strong>${yen(cs.total)}</strong></div><div class="bar"><i style="width:${Math.round(cs.pct * 100)}%"></i></div>
          <div class="cc-sub"><span>支払い済み <b>${yen(cs.paid)}</b></span><span>未払い <b>${yen(cs.unpaid)}</b></span></div></section>`;
      })()}
      ${up.length ? `<section><h3 class="sec">これからの予定<small>${up.length}</small></h3><div class="list">${up.map((e) => ecardHtml(e, false)).join('')}</div></section>` : ''}
      ${past.length ? `<section><h3 class="sec">ふたりのあゆみ<small>${past.length}</small></h3><div class="list">${past.map((e) => ecardHtml(e, true)).join('')}</div></section>` : ''}`;
  };

  /* ============================== 描画: タスク ============================== */
  const dueChip = (t) => {
    if (!t.due) return '';
    const d = daysFrom(t.due); let txt; let cls = '';
    if (t.done) txt = fmtMD(t.due);
    else if (d < 0) { txt = `${-d}日超過`; cls = 'late'; }
    else if (d === 0) { txt = '今日'; cls = 'soon'; }
    else if (d === 1) { txt = '明日'; cls = 'soon'; }
    else if (d <= 7) { txt = `あと${d}日`; cls = 'soon'; }
    else txt = fmtMDW(t.due);
    return `<span class="chip due ${cls}">${ICON.clock}${txt}</span>`;
  };

  const taskRow = (t, showEvent = true) => {
    const ev = t.eventId ? evById(t.eventId) : null;
    const tmp = String(t.id).startsWith('tmp_');
    return `<li class="tw"><div class="swbg" aria-hidden="true"><span class="swl">${ICON.check}${t.done ? '未完了に戻す' : '完了'}</span><span class="swr">削除${ICON.trash}</span></div>
      <div class="task ${t.done ? 'done' : ''} ${tmp ? 'tmp' : ''}" data-id="${esc(t.id)}">
      <button class="check" data-action="toggle-task" data-id="${esc(t.id)}" role="checkbox" aria-checked="${t.done}" aria-label="${esc(t.title)} を${t.done ? '未完了に戻す' : '完了にする'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4.2 4.2L18.5 8"/></svg></button>
      <div class="tmain" data-action="edit-task" data-id="${esc(t.id)}" role="button" tabindex="0">
        <div class="ttitle">${esc(t.title)}</div>
        <div class="tmeta">${isNewTask(t) ? '<span class="chip new">NEW</span>' : ''}${showEvent && ev ? `<span class="chip c-${colorOf(ev.color)}">${esc(ev.emoji)} ${esc(ev.title)}</span>` : ''}${dueChip(t)}${t.cost != null ? `<span class="chip cost ${t.paid ? 'paid' : ''}">${t.paid ? '✓ ' : ''}${yen(t.cost)}</span>` : ''}${t.note ? `<span class="chip">${ICON.note}</span>` : ''}${t.done && t.doneBy ? `<span class="chip ok">${esc(nameOf(t.doneBy))}が完了</span>` : ''}</div>
      </div>
      <div class="tav">${assigneeHtml(t)}</div></div></li>`;
  };

  const scopeFilter = (t) => {
    if (S.scope === 'all') return true;
    const p = ptM();
    if (S.scope === 'mine') return t.assignee === 'both' || t.assignee === S.me;
    return !!p && (t.assignee === 'both' || t.assignee === p.uid);
  };

  const memberProgress = (m) => {
    const mine = S.tasks.filter((t) => t.assignee === 'both' || t.assignee === m.uid);
    const done = mine.filter((t) => t.done).length;
    return { total: mine.length, done, pct: mine.length ? done / mine.length : 0 };
  };

  const viewTasks = () => {
    const m = meM(); const p = ptM();
    if (S.evFilter && S.evFilter !== 'none' && !evById(S.evFilter)) S.evFilter = '';
    const list = S.tasks.filter((t) => scopeFilter(t) && (S.evFilter === '' ? true : S.evFilter === 'none' ? !t.eventId : t.eventId === S.evFilter));
    const open = list.filter((t) => !t.done).sort(byDue); const done = list.filter((t) => t.done).sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
    const g = { overdue: [], today: [], week: [], later: [], nodue: [] };
    open.forEach((t) => {
      if (!t.due) g.nodue.push(t); else { const d = daysFrom(t.due); (d < 0 ? g.overdue : d === 0 ? g.today : d <= 7 ? g.week : g.later).push(t); }
    });
    const sec = (key, title, items, cls = '') => {
      if (!items.length) return '';
      const col = S.collapsed.has(key);
      return `<section class="tgroup ${cls}"><button class="sec fold" data-action="toggle-group" data-key="${key}" aria-expanded="${!col}"><span>${title}<small>${items.length}</small></span><span class="chev ${col ? '' : 'up'}">⌄</span></button>${col ? '' : `<ul class="tlist">${items.map((t) => taskRow(t)).join('')}</ul>`}</section>`;
    };
    const openAll = S.tasks.filter((t) => !t.done);
    const cnt = { all: openAll.length, mine: openAll.filter((t) => t.assignee === 'both' || t.assignee === S.me).length, partner: p ? openAll.filter((t) => t.assignee === 'both' || t.assignee === p.uid).length : 0 };
    const mp = memberProgress(m); const pp = p ? memberProgress(p) : null;
    const total = S.tasks.length; const dn = S.tasks.filter((t) => t.done).length;
    const evChips = S.events.slice().sort((a, b) => a.date.localeCompare(b.date)).map((e) => `<button class="fchip c-${colorOf(e.color)} ${S.evFilter === e.id ? 'on' : ''}" data-action="ev-filter" data-id="${esc(e.id)}">${esc(e.emoji)} ${esc(e.title)}</button>`).join('');
    return `
      <header class="topbar"><div><p class="hello">ふたりでやること</p><h1 class="big">タスク</h1></div>
        <button class="iconbtn ${S.syncing ? 'spin' : ''}" data-action="refresh" aria-label="最新の状態に更新">${ICON.refresh}</button></header>
      <section class="card pcard">
        ${ringSvg(total ? dn / total : 0, 'ぜんぶの進み具合')}
        <div class="pbars">
          <div class="prow">${av(m, 'sm')}<span>${esc(m.name || 'あなた')}</span><div class="bar c-${colorOf(m.color)}"><i style="width:${Math.round(mp.pct * 100)}%"></i></div><small>${mp.done}/${mp.total}</small></div>
          ${p ? `<div class="prow">${av(p, 'sm')}<span>${esc(p.name || 'パートナー')}</span><div class="bar c-${colorOf(p.color)}"><i style="width:${Math.round(pp.pct * 100)}%"></i></div><small>${pp.done}/${pp.total}</small></div>` : ''}
        </div>
      </section>
      <form class="quick" data-form="quick-task" autocomplete="off">
        <input id="quick-title" name="title" maxlength="80" placeholder="やることをすばやく追加…" enterkeyhint="done" aria-label="タスク名">
        <button class="btn primary sq" aria-label="追加">${ICON.plus}</button>
      </form>
      <div class="seg" role="tablist" aria-label="担当で絞り込み">
        <button role="tab" aria-selected="${S.scope === 'all'}" class="${S.scope === 'all' ? 'on' : ''}" data-action="scope" data-scope="all">ふたり<small class="cnt">${cnt.all}</small></button>
        <button role="tab" aria-selected="${S.scope === 'mine'}" class="${S.scope === 'mine' ? 'on' : ''}" data-action="scope" data-scope="mine">${esc(m.name || '自分')}<small class="cnt">${cnt.mine}</small></button>
        ${p ? `<button role="tab" aria-selected="${S.scope === 'partner'}" class="${S.scope === 'partner' ? 'on' : ''}" data-action="scope" data-scope="partner">${esc(p.name || 'パートナー')}<small class="cnt">${cnt.partner}</small></button>` : ''}
      </div>
      <div class="fchips" role="group" aria-label="予定で絞り込み">
        <button class="fchip ${S.evFilter === '' ? 'on' : ''}" data-action="ev-filter" data-id="">すべて</button>${evChips}<button class="fchip ${S.evFilter === 'none' ? 'on' : ''}" data-action="ev-filter" data-id="none">予定なし</button>
      </div>
      ${sec('overdue', '期限切れ', g.overdue, 'late')}${sec('today', '今日', g.today)}${sec('week', '今週', g.week)}${sec('later', 'これから', g.later)}${sec('nodue', '期限なし', g.nodue)}
      ${!open.length ? `<section class="empty card"><div class="big-emoji">${list.length ? '🎉' : '📝'}</div><h2>${list.length ? 'ぜんぶ完了！' : 'タスクはまだありません'}</h2><p>${list.length ? 'ふたりともおつかれさま。' : '上の入力欄から、思いついたことをどんどん追加しよう。'}</p></section>` : ''}
      ${done.length ? `<section class="tgroup donegrp"><button class="sec fold" data-action="toggle-done" aria-expanded="${S.showDone}"><span>完了したタスク<small>${done.length}</small></span><span class="chev ${S.showDone ? 'up' : ''}">⌄</span></button>${S.showDone ? `<ul class="tlist">${done.map((t) => taskRow(t)).join('')}</ul>` : ''}</section>` : ''}`;
  };

  /* ============================== 描画: 設定 ============================== */
  const viewSettings = () => {
    const m = meM(); const p = ptM();
    return `
      <header class="topbar"><div><p class="hello">ふたりのアプリ</p><h1 class="big">設定</h1></div></header>
      <section class="card prof">
        <button class="prof-btn" data-action="open-profile">${av(m, 'lg')}<span class="ptext"><b>${esc(m.name || 'あなた')}</b><small>プロフィールを編集</small></span><span class="chev r">›</span></button>
        ${p ? `<div class="prof-pt">${av(p)}<span>${esc(p.name || 'パートナー')}${p.joined === false ? '<small>（まだ参加していません）</small>' : ''}</span></div>` : ''}
      </section>
      <section class="card setlist">
        <div class="setrow"><span>テーマ</span><div class="seg sm" role="tablist" aria-label="テーマ">
          ${[['auto', '自動'], ['light', 'ライト'], ['dark', 'ダーク']].map(([k, l]) => `<button role="tab" aria-selected="${S.theme === k}" class="${S.theme === k ? 'on' : ''}" data-action="theme" data-theme="${k}">${l}</button>`).join('')}</div></div>
        <button class="setrow btn-row" data-action="export-ics"><span>${ICON.cal} カレンダーに書き出す（.ics）</span><span class="chev r">›</span></button>
        <button class="setrow btn-row" data-action="export-json"><span>${ICON.note} バックアップを保存（.json）</span><span class="chev r">›</span></button>
        <button class="setrow btn-row" data-action="refresh"><span>${ICON.refresh} 最新の状態に更新</span><span class="chev r">›</span></button>
      </section>
      <section class="card safe">
        <h3>${ICON.lock} ふたりだけの安全設計</h3>
        <ul>
          <li><b>合言葉を知っている人だけ</b>が入れます。合言葉はサーバー側にだけ保存されています</li>
          <li>間違いが続くとロックされ、総当たりはできません</li>
          <li>ログインは端末ごとに30日。合言葉を変えると<b>全端末が自動でログアウト</b>されます</li>
        </ul>
      </section>
      <section class="card setlist">
        <button class="setrow btn-row" data-action="logout"><span>この端末からログアウト</span><span class="chev r">›</span></button>
        <button class="setrow btn-row danger" data-action="logout-all"><span>すべての端末からログアウト</span><span class="chev r">›</span></button>
        ${Api.DEMO ? '<button class="setrow btn-row" data-action="reset-demo"><span>デモデータをリセット</span><span class="chev r">›</span></button>' : ''}
      </section>
      <p class="ver">Futari Days v1.4.0${Api.DEMO ? ' ・ デモモード（この端末のみに保存）' : ''}</p>`;
  };

  /* ============================== 描画: 全体 ============================== */
  const render = () => {
    const app = $('#app');
    if (S.status === 'login') { renderLogin(); return; }
    if (S.status === 'boot') { app.innerHTML = '<div class="boot"><div class="pulse">💍</div></div>'; return; }

    const y = window.scrollY;
    const heroes = $('#heroes'); const hx = heroes ? heroes.scrollLeft : 0;
    const ae = document.activeElement; const keep = ae && ae.id === 'quick-title' ? { v: ae.value, s: ae.selectionStart } : null;

    const view = S.tab === 'home' ? viewHome() : S.tab === 'tasks' ? viewTasks() : viewSettings();
    const overdue = S.tasks.filter((t) => !t.done && t.due && daysFrom(t.due) < 0).length;
    const tab = (k, ic, label, badge) => `<button class="tab ${S.tab === k ? 'on' : ''}" data-action="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${ic}<span>${label}</span>${badge ? `<i class="badge">${badge}</i>` : ''}</button>`;
    app.innerHTML = `
      ${S.offline ? '<div class="offline">オフラインです。保存済みの内容を表示しています</div>' : ''}
      <main class="view ${S.enter ? 'enter' : ''}" id="view">${view}</main>
      <nav class="tabbar" aria-label="メインメニュー">${tab('home', ICON.home, 'ホーム')}${tab('tasks', ICON.tasks, 'タスク', overdue || '')}${tab('settings', ICON.gear, '設定')}</nav>
      ${S.tab !== 'settings' ? `<button class="fab" data-action="fab" aria-label="${S.tab === 'home' ? '予定を追加' : 'タスクを追加'}">${ICON.plus}</button>` : ''}`;
    S.enter = false;
    if (!S.enter) window.scrollTo(0, y);
    const h2 = $('#heroes'); if (h2) h2.scrollLeft = hx;
    if (keep) { const q = $('#quick-title'); if (q) { q.value = keep.v; q.focus(); try { q.setSelectionRange(keep.s, keep.s); } catch (e) { /* noop */ } } }
    runCountUps();
    if (sheetRender) paintSheet();
  };

  const runCountUps = () => {
    $$('.hero-num[data-id]').forEach((el) => {
      const id = el.dataset.id; if (counted.has(id) || reduceMotion()) { counted.add(id); return; }
      counted.add(id);
      const to = Number(el.dataset.count); const t0 = performance.now(); const dur = 1100;
      const step = (t) => {
        if (!el.isConnected) return;
        const k = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - k, 4);
        el.textContent = String(Math.round(to * e));
        if (k < 1) requestAnimationFrame(step);
      };
      el.textContent = '0'; requestAnimationFrame(step);
    });
  };

  /* ============================== シート ============================== */
  const openSheet = (html, opts = {}) => {
    removeSheetDom();
    lastFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap'; wrap.id = 'sheet';
    wrap.innerHTML = `<div class="backdrop" data-action="close-sheet"></div>
      <section class="sheet ${opts.tall ? 'tall' : ''}" role="dialog" aria-modal="true" aria-label="${esc(opts.label || '')}" tabindex="-1">
        <div class="grab" aria-hidden="true"><i></i></div><div class="sheet-body">${html}</div></section>`;
    document.body.appendChild(wrap);
    document.body.classList.add('noscroll');
    if (!sheetOpen) { try { history.pushState({ fdSheet: 1 }, ''); } catch (e) { /* noop */ } }
    sheetOpen = true;
    requestAnimationFrame(() => wrap.classList.add('open'));
    wireDrag(wrap);
    const first = opts.focus ? $(opts.focus, wrap) : null;
    if (first) setTimeout(() => first.focus(), 260); else $('.sheet', wrap).focus({ preventScroll: true });
  };

  const removeSheetDom = () => { const s = $('#sheet'); if (s) s.remove(); document.body.classList.remove('noscroll'); };

  const closeSheet = (fromPop) => {
    if (!sheetOpen) return;
    const wrap = $('#sheet'); sheetOpen = false; sheetRender = null;
    if (wrap) { wrap.classList.remove('open'); wrap.classList.add('closing'); setTimeout(() => { wrap.remove(); if (!$('#sheet')) document.body.classList.remove('noscroll'); }, 260); }
    if (!fromPop && history.state && history.state.fdSheet) { try { history.back(); } catch (e) { /* noop */ } }
    if (lastFocus && lastFocus.isConnected) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* noop */ } }
  };

  const paintSheet = () => {
    const body = $('#sheet .sheet-body'); if (!body || !sheetRender) return;
    const st = body.scrollTop; const html = sheetRender();
    if (html == null) { closeSheet(); return; }
    const ae = document.activeElement; const keep = ae && ae.id === 'sheet-quick' ? { v: ae.value, s: ae.selectionStart } : null;
    body.innerHTML = html; body.scrollTop = st;
    if (keep) { const q = $('#sheet-quick'); if (q) { q.value = keep.v; q.focus(); try { q.setSelectionRange(keep.s, keep.s); } catch (e) { /* noop */ } } }
  };

  const wireDrag = (wrap) => {
    const sheet = $('.sheet', wrap); const grab = $('.grab', wrap); let y0 = null; let dy = 0;
    grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; grab.setPointerCapture(e.pointerId); sheet.style.transition = 'none'; });
    grab.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
    const end = () => { if (y0 == null) return; y0 = null; sheet.style.transition = ''; if (dy > 110) { closeSheet(); } else { sheet.style.transform = ''; } };
    grab.addEventListener('pointerup', end); grab.addEventListener('pointercancel', end);
  };

  const confirmDialog = ({ title, body, ok = 'OK', danger = false }) => new Promise((resolve) => {
    const d = document.createElement('div'); d.className = 'dialog-wrap';
    d.innerHTML = `<div class="backdrop dim"></div><div class="dialog" role="alertdialog" aria-modal="true" aria-label="${esc(title)}"><h3>${esc(title)}</h3><p>${esc(body)}</p><div class="drow"><button class="btn ghost" data-r="0">やめる</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1">${esc(ok)}</button></div></div>`;
    document.body.appendChild(d); requestAnimationFrame(() => d.classList.add('open'));
    const done = (v) => { d.classList.remove('open'); setTimeout(() => d.remove(), 200); resolve(v); };
    d.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) done(b.dataset.r === '1'); else if (e.target.classList.contains('backdrop')) done(false); });
    $('[data-r="0"]', d).focus();
  });

  /* ---- イベント詳細 ---- */
  const eventSheet = (id) => {
    sheetRender = () => {
      const ev = evById(id); if (!ev) return null;
      const days = daysFrom(ev.date); const ts = S.tasks.filter((t) => t.eventId === id);
      const open = ts.filter((t) => !t.done).sort(byDue); const done = ts.filter((t) => t.done);
      const st = evStats(id); const kind = kindOf(ev);
      const missing = kind.tasks.filter((k) => !ts.some((t) => t.title === k.title));
      const when = days === 0 ? '<b>今日</b>' : days > 0 ? `あと<b>${days}</b>日` : `<b>${-days}</b>日前`;
      return `
        <div class="es-head c-${colorOf(ev.color)}">
          <div class="es-top"><span class="es-emoji">${esc(ev.emoji)}</span><div class="es-actions">
            <button class="iconbtn glass" data-action="edit-event" data-id="${esc(id)}" aria-label="予定を編集">${ICON.edit}</button>
            <button class="iconbtn glass" data-action="close-sheet" aria-label="閉じる">${ICON.close}</button></div></div>
          <h2>${esc(ev.title)}</h2>
          <div class="es-count">${when}</div>
          <p>${fmtDate(ev.date)}${ev.time ? `　${esc(ev.time)}〜` : ''}</p>
        </div>
        <div class="es-body">
          ${ev.place ? `<p class="info">${ICON.pin}<span>${esc(ev.place)}</span></p>` : ''}
          ${ev.note ? `<p class="info">${ICON.note}<span>${esc(ev.note).replace(/\n/g, '<br>')}</span></p>` : ''}
          <div class="es-prog"><div class="es-prog-h"><b>この日までの準備</b><small>${st.total ? `${st.done}/${st.total} 完了` : 'タスクなし'}</small></div><div class="bar big"><i style="width:${Math.round(st.pct * 100)}%"></i></div></div>
          ${(() => {
            const cs = costStats(ts); if (!cs.n) return '';
            const rows = ts.filter((t) => t.cost != null).sort(byDue).map((t) => `<div class="cost-row"><span class="ct">${esc(t.title)}</span><b>${yen(t.cost)}</b><button class="paypill ${t.paid ? 'on' : ''}" data-action="toggle-paid" data-id="${esc(t.id)}" aria-pressed="${t.paid}">${t.paid ? '支払い済み' : '未払い'}</button></div>`).join('');
            return `<div class="card costcard"><div class="cc-head"><b>費用</b><strong>${yen(cs.total)}</strong></div><div class="bar"><i style="width:${Math.round(cs.pct * 100)}%"></i></div>
              <div class="cc-sub"><span>支払い済み <b>${yen(cs.paid)}</b></span><span>未払い <b>${yen(cs.unpaid)}</b></span></div>${rows}</div>`;
          })()}
          <form class="quick" data-form="event-task" data-event="${esc(id)}" autocomplete="off">
            <input id="sheet-quick" name="title" maxlength="80" placeholder="この日に必要なことを追加…" enterkeyhint="done" aria-label="タスク名">
            <button class="btn primary sq" aria-label="追加">${ICON.plus}</button></form>
          ${open.length ? `<ul class="tlist">${open.map((t) => taskRow(t, false)).join('')}</ul>` : ''}
          ${done.length ? `<h3 class="sec">完了<small>${done.length}</small></h3><ul class="tlist">${done.map((t) => taskRow(t, false)).join('')}</ul>` : ''}
          ${missing.length ? `<button class="btn soft wide" data-action="add-template" data-id="${esc(id)}">${ICON.spark}おすすめタスクを${missing.length}件追加</button>` : ''}
          <button class="btn danger ghost wide" data-action="delete-event" data-id="${esc(id)}">${ICON.trash}この予定を削除</button>
        </div>`;
    };
    openSheet(sheetRender(), { tall: true, label: '予定の詳細' });
  };

  /* ---- イベント作成/編集 ---- */
  const swatches = (cur) => Object.keys(FD.COLORS).map((k) => `<button type="button" class="sw c-${k} ${cur === k ? 'on' : ''}" data-action="pick-color" data-color="${k}" aria-label="${esc(FD.COLORS[k].name)}" aria-pressed="${cur === k}"></button>`).join('');
  const emojiGrid = (cur) => FD.EMOJIS.map((e) => `<button type="button" class="em ${cur === e ? 'on' : ''}" data-action="pick-emoji" data-emoji="${esc(e)}" aria-label="${esc(e)}">${esc(e)}</button>`).join('');

  const eventForm = (ev, presetKind) => {
    sheetRender = null;
    const editing = !!ev; const kindKey = ev ? ev.kind : (presetKind || 'kaomiwase'); const kind = FD.KINDS[kindKey] || FD.KINDS.custom;
    const cur = ev || { title: kind.label === 'その他' ? '' : kind.label, emoji: kind.emoji, color: kind.color, date: '', time: '', place: '', note: '' };
    openSheet(`
      <form class="form" data-form="event" data-id="${editing ? esc(ev.id) : ''}" data-orig-date="${editing ? esc(ev.date) : ''}" autocomplete="off" novalidate>
        <div class="form-h"><h2>${editing ? '予定を編集' : 'ふたりの「その日」を追加'}</h2><button type="button" class="iconbtn" data-action="close-sheet" aria-label="閉じる">${ICON.close}</button></div>
        <div class="field"><label>どんな日？</label>
          <div class="kinds">${FD.KIND_ORDER.map((k) => `<button type="button" class="kind ${k === kindKey ? 'on' : ''}" data-action="pick-kind" data-kind="${k}"><span>${FD.KINDS[k].emoji}</span>${esc(FD.KINDS[k].label)}</button>`).join('')}</div>
          <input type="hidden" name="kind" value="${esc(kindKey)}"></div>
        <div class="field"><label for="f-title">タイトル</label><input id="f-title" name="title" maxlength="40" value="${esc(cur.title)}" placeholder="例：両家顔合わせ" required></div>
        <div class="row2"><div class="field"><label for="f-date">日付</label><input id="f-date" type="date" name="date" value="${esc(cur.date)}" min="1990-01-01" max="2100-12-31" required></div>
          <div class="field"><label for="f-time">時間（任意）</label><input id="f-time" type="time" name="time" value="${esc(cur.time)}"></div></div>
        <div class="field"><label for="f-place">場所（任意）</label><input id="f-place" name="place" maxlength="60" value="${esc(cur.place)}" placeholder="例：ホテル〇〇 / 和食 さくら亭"></div>
        <div class="field"><label for="f-note">メモ（任意）</label><textarea id="f-note" name="note" maxlength="400" rows="2" placeholder="予約番号・持ち物・連絡先など">${esc(cur.note)}</textarea></div>
        <div class="field"><label>カラー</label><div class="swatches">${swatches(cur.color)}</div><input type="hidden" name="color" value="${esc(cur.color)}"></div>
        <div class="field"><label>アイコン</label><div class="emojis">${emojiGrid(cur.emoji)}</div><input type="hidden" name="emoji" value="${esc(cur.emoji)}"></div>
        ${editing ? `<label class="toggle shift" hidden><input type="checkbox" name="shift" checked><span>日付を変えたら、タスクの期限もいっしょにずらす</span></label>`
          : `<label class="toggle tpl"><input type="checkbox" name="tpl" ${kind.tasks.length ? 'checked' : ''}><span>${ICON.spark}<b>おすすめタスクを自動で追加</b><small class="tpl-n">${kind.tasks.length ? `${kind.tasks.length}件（日付から逆算して期限をセット）` : 'この種類にはありません'}</small></span></label>`}
        <p class="form-err" role="alert"></p>
        <button class="btn primary wide lg" type="submit">${editing ? '保存する' : '追加する'}</button>
      </form>`, { tall: true, label: editing ? '予定を編集' : '予定を追加', focus: editing ? '' : '#f-date' });
  };

  /* ---- タスク作成/編集 ---- */
  const taskForm = (t, defaults = {}) => {
    sheetRender = null;
    const editing = !!t; const p = ptM(); const m = meM();
    const cur = t || { title: '', note: '', due: '', eventId: defaults.eventId || '', assignee: 'both', cost: null, paid: false };
    const ev = S.events.slice().sort((a, b) => a.date.localeCompare(b.date));
    const quick = [['今日', 0], ['明日', 1], ['1週間後', 7], ['2週間後', 14]];
    openSheet(`
      <form class="form" data-form="task" data-id="${editing ? esc(t.id) : ''}" autocomplete="off" novalidate>
        <div class="form-h"><h2>${editing ? 'タスクを編集' : 'タスクを追加'}</h2><button type="button" class="iconbtn" data-action="close-sheet" aria-label="閉じる">${ICON.close}</button></div>
        <div class="field"><label for="t-title">やること</label><input id="t-title" name="title" maxlength="80" value="${esc(cur.title)}" placeholder="例：お店を予約する" required></div>
        <div class="field"><label>担当</label><div class="seg" role="radiogroup" aria-label="担当">
          <button type="button" class="${cur.assignee === 'both' || !mem(cur.assignee) ? 'on' : ''}" data-action="pick-assignee" data-v="both">ふたり</button>
          <button type="button" class="${cur.assignee === m.uid ? 'on' : ''}" data-action="pick-assignee" data-v="${esc(m.uid)}">${esc(m.name || '自分')}</button>
          ${p ? `<button type="button" class="${cur.assignee === p.uid ? 'on' : ''}" data-action="pick-assignee" data-v="${esc(p.uid)}">${esc(p.name || 'パートナー')}</button>` : ''}</div>
          <input type="hidden" name="assignee" value="${esc(mem(cur.assignee) ? cur.assignee : 'both')}"></div>
        <div class="field"><label for="t-due">期限（任意）</label><input id="t-due" type="date" name="due" value="${esc(cur.due)}">
          <div class="qchips">${quick.map(([l, n]) => `<button type="button" class="fchip" data-action="quick-due" data-n="${n}">${l}</button>`).join('')}<button type="button" class="fchip" data-action="quick-due" data-n="clear">なし</button></div></div>
        <div class="field"><label for="t-cost">費用（任意）</label>
          <div class="yen"><span aria-hidden="true">¥</span><input id="t-cost" name="cost" type="text" inputmode="numeric" maxlength="12" autocomplete="off" value="${cur.cost != null ? esc(cur.cost) : ''}" placeholder="例：50000"></div>
          <label class="toggle paidtg"><input type="checkbox" name="paid" ${cur.paid ? 'checked' : ''}><span><b>支払い済み</b><small>支払いが終わったらチェック</small></span></label></div>
        <div class="field"><label for="t-ev">どの予定のため？</label><select id="t-ev" name="eventId"><option value="">（予定なし）</option>${ev.map((e) => `<option value="${esc(e.id)}" ${cur.eventId === e.id ? 'selected' : ''}>${esc(e.emoji)} ${esc(e.title)}（${fmtMD(e.date)}）</option>`).join('')}</select></div>
        <div class="field"><label for="t-note">メモ（任意）</label><textarea id="t-note" name="note" maxlength="300" rows="2" placeholder="URL・電話番号・補足など">${esc(cur.note)}</textarea></div>
        <p class="form-err" role="alert"></p>
        <div class="drow">${editing ? `<button class="btn danger ghost" type="button" data-action="delete-task" data-id="${esc(t.id)}">${ICON.trash}削除</button>` : ''}<button class="btn primary grow lg" type="submit">${editing ? '保存する' : '追加する'}</button></div>
      </form>`, { tall: true, label: editing ? 'タスクを編集' : 'タスクを追加', focus: '#t-title' });
  };

  /* ---- プロフィール ---- */
  const profileSheet = (first) => {
    sheetRender = null; const m = meM();
    openSheet(`
      <form class="form" data-form="profile" autocomplete="off" novalidate>
        <div class="form-h"><h2>${first ? 'はじめまして！' : 'プロフィール'}</h2>${first ? '' : `<button type="button" class="iconbtn" data-action="close-sheet" aria-label="閉じる">${ICON.close}</button>`}</div>
        ${first ? '<p class="lead">ふたりの画面に表示される名前とアイコンを決めよう。あとから変えられます。</p>' : ''}
        <div class="field"><label for="p-name">表示名</label><input id="p-name" name="name" maxlength="12" value="${esc(m.name)}" placeholder="例：ゆう" required></div>
        <div class="field"><label>アイコン</label><div class="emojis">${emojiGrid(m.emoji)}</div><input type="hidden" name="emoji" value="${esc(m.emoji)}"></div>
        <div class="field"><label>カラー</label><div class="swatches">${swatches(m.color)}</div><input type="hidden" name="color" value="${esc(m.color)}"></div>
        <p class="form-err" role="alert"></p>
        <button class="btn primary wide lg" type="submit">${first ? 'はじめる' : '保存する'}</button>
      </form>`, { label: 'プロフィール', focus: '#p-name' });
  };

  /* ============================== データ操作 ============================== */
  const mergeById = (arr, item) => { const i = arr.findIndex((x) => x.id === item.id); if (i >= 0) arr[i] = item; else arr.push(item); };
  const afterWrite = (r) => { if (r && r.version) { if (r.prevVersion === S.version || !S.version) S.version = r.version; } saveCache(); };

  /* ---- 元に戻せる削除（5秒以内なら取り消せる。確定はその後） ---- */
  const queueDelete = ({ key, ids, label, removed, call }) => {
    ids.forEach((i) => hidden.add(i));
    const restore = () => { removed.events.forEach((e) => mergeById(S.events, e)); removed.tasks.forEach((t) => mergeById(S.tasks, t)); render(); };
    const commit = async () => {
      const p = pendingDel.get(key); if (!p) return; pendingDel.delete(key); clearTimeout(p.timer);
      try { const r = await Api.call(call.action, call.payload); afterWrite(r); }
      catch (e) { ids.forEach((i) => hidden.delete(i)); restore(); toastErr(e); handleAuth(e); return; }
      ids.forEach((i) => hidden.delete(i));
    };
    const undo = () => { const p = pendingDel.get(key); if (!p) return; clearTimeout(p.timer); pendingDel.delete(key); ids.forEach((i) => hidden.delete(i)); restore(); haptic(8); };
    pendingDel.set(key, { timer: setTimeout(commit, 5500), commit });
    toast(label, '', { ttl: 5500, action: { label: '元に戻す', fn: undo } });
  };
  const flushPending = () => { Array.from(pendingDel.values()).forEach((p) => p.commit()); };
  const removeTask = (id) => {
    const t = S.tasks.find((x) => x.id === id); if (!t) return;
    S.tasks = S.tasks.filter((x) => x.id !== id); render();
    queueDelete({ key: `t${id}`, ids: [id], label: `「${clipTxt(t.title)}」を削除しました`, removed: { events: [], tasks: [t] }, call: { action: 'deleteTask', payload: { id } } });
  };
  const removeEvent = (id) => {
    const ev = evById(id); if (!ev) return;
    const ts = S.tasks.filter((t) => t.eventId === id);
    S.events = S.events.filter((x) => x.id !== id); S.tasks = S.tasks.filter((t) => t.eventId !== id); render();
    queueDelete({ key: `e${id}`, ids: [id, ...ts.map((t) => t.id)], label: `「${clipTxt(ev.title)}」を削除しました`, removed: { events: [ev], tasks: ts }, call: { action: 'deleteEvent', payload: { id } } });
  };

  const toggleTask = async (id) => {
    const t = S.tasks.find((x) => x.id === id); if (!t || String(id).startsWith('tmp_')) return;
    const prev = { done: t.done, doneBy: t.doneBy, doneAt: t.doneAt };
    const done = !t.done;
    Object.assign(t, { done, doneBy: done ? S.me : '', doneAt: done ? new Date().toISOString() : '' });
    let pos = null;
    if (done) { const el = $(`.task[data-id="${CSS.escape(id)}"] .check`); if (el) { const r = el.getBoundingClientRect(); pos = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; } }
    haptic(done ? 18 : 8); render();
    if (done) {
      if (pos) burst({ x: pos.x, y: pos.y, n: 18, power: 4 });
      if (t.eventId) { const st = evStats(t.eventId); if (st.total > 1 && st.done === st.total) { const ev = evById(t.eventId); setTimeout(() => { burst({ n: 120 }); toast(`🎉 「${ev ? ev.title : ''}」の準備、ぜんぶ完了！`); }, 350); } }
    }
    try { const r = await Api.call('toggleTask', { id, done }); mergeById(S.tasks, r.task); afterWrite(r); render(); } catch (e) { Object.assign(t, prev); render(); toastErr(e); handleAuth(e); }
  };

  const togglePaid = async (id) => {
    const t = S.tasks.find((x) => x.id === id); if (!t || t.cost == null || String(id).startsWith('tmp_')) return;
    const prev = t.paid; t.paid = !prev; haptic(10); render();
    try { const r = await Api.call('togglePaid', { id, paid: t.paid }); mergeById(S.tasks, r.task); afterWrite(r); render(); }
    catch (e) { t.paid = prev; render(); toastErr(e); handleAuth(e); }
  };

  const quickAdd = async (title, eventId) => {
    title = title.trim(); if (!title) return;
    const tmp = { id: `tmp_${Date.now()}`, eventId: eventId || '', title, note: '', due: '', assignee: 'both', done: false, doneBy: '', doneAt: '', createdBy: S.me, createdAt: new Date().toISOString() };
    S.tasks.push(tmp); haptic(10); render();
    try {
      const r = await Api.call('saveTask', { task: { title, eventId: eventId || '', assignee: 'both' } });
      S.tasks = S.tasks.filter((x) => x.id !== tmp.id); mergeById(S.tasks, r.task); afterWrite(r); render();
    } catch (e) { S.tasks = S.tasks.filter((x) => x.id !== tmp.id); render(); toastErr(e); handleAuth(e); }
  };

  const refresh = async (manual) => {
    if (S.syncing) return; S.syncing = true; if (manual) render();
    try { const snap = await Api.call('bootstrap'); applySnapshot(snap); S.offline = false; if (manual) toast('最新の状態になりました'); }
    catch (e) { if (manual) toastErr(e); handleAuth(e); }
    finally { S.syncing = false; if (S.status === 'app') render(); }
  };

  /* GAS無料枠の節約: 画面が見えている間だけ、変化がなければ間隔を 30秒→60秒→120秒 と延ばし、5分操作がなければ停止（操作・復帰で再開） */
  const POLL_STEPS = [30000, 60000, 120000];
  let pollStep = 0, pollTimer = 0, lastAct = Date.now(), pollPaused = false;
  const schedule = () => {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(async () => {
      if (Date.now() - lastAct > 300000) { pollPaused = true; return; }   // 放置中は止める
      await pollTick();
      schedule();
    }, POLL_STEPS[Math.min(pollStep, POLL_STEPS.length - 1)]);
  };
  const wake = () => {
    lastAct = Date.now(); pollStep = 0;
    pollTick();
    if (pollPaused) pollPaused = false;
    schedule();
  };

  const pollTick = async () => {
    if (document.hidden || S.status !== 'app' || S.syncing) return;
    if (pendingDel.size || S.tasks.some((t) => String(t.id).startsWith('tmp_'))) return;   // 自分の書き込み中は待つ
    try {
      const r = await Api.call('poll');
      if (r.version !== S.version) { pollStep = 0; await refresh(false); if (!S.offline) toast('相手の変更を反映しました', 'soft'); }
      else { S.offline = false; pollStep = Math.min(pollStep + 1, POLL_STEPS.length - 1); }
    } catch (e) { handleAuth(e); }
  };

  const handleAuth = (e) => {
    if (e && (e.code === 'AUTH')) { Api.session.clear(); lsDel(CACHE_KEY); S.status = 'login'; S.me = ''; S.loginError = 'ログインの有効期限が切れました。もう一度、合言葉で入ってください。'; closeSheet(true); render(); }
  };

  const logout = async (all) => {
    try { await Api.call(all ? 'logoutAll' : 'logout'); } catch (e) { /* 失敗してもローカルは消す */ }
    Api.session.clear(); lsDel(CACHE_KEY);
    S.status = 'login'; S.me = ''; S.events = []; S.tasks = []; S.loginError = ''; closeSheet(true); render();
  };

  /* ============================== フォーム送信 ============================== */
  const setErr = (form, msg) => { const el = $('.form-err', form); if (el) el.textContent = msg || ''; };
  const busy = (form, on) => { const b = $('button[type="submit"]', form); if (b) { b.disabled = on; b.classList.toggle('loading', on); } };

  const submitEvent = async (form) => {
    const fd = new FormData(form); const id = form.dataset.id;
    const ev = { id: id || undefined, title: String(fd.get('title') || '').trim(), date: String(fd.get('date') || ''), time: String(fd.get('time') || ''), place: String(fd.get('place') || '').trim(),
      note: String(fd.get('note') || '').trim(), color: String(fd.get('color')), emoji: String(fd.get('emoji')), kind: String(fd.get('kind')) };
    if (!ev.title) return setErr(form, 'タイトルを入力してください');
    if (!ev.date) return setErr(form, '日付を選んでください');
    const payload = { event: ev };
    if (!id && fd.get('tpl')) payload.tasks = (FD.KINDS[ev.kind] || FD.KINDS.custom).tasks.map((t) => ({ title: t.title, daysBefore: t.daysBefore }));
    if (id && form.dataset.origDate && form.dataset.origDate !== ev.date && fd.get('shift')) payload.shiftTasks = true;
    setErr(form, ''); busy(form, true);
    try {
      const r = await Api.call('saveEvent', payload);
      mergeById(S.events, r.event); (r.tasks || []).forEach((t) => mergeById(S.tasks, t)); afterWrite(r);
      closeSheet(); render(); toast(id ? '保存しました' : 'ふたりの予定を追加しました ✨');
      if (!id) { S.tab = 'home'; haptic(20); burst({ n: 70 }); }
    } catch (e) { busy(form, false); setErr(form, e.message); handleAuth(e); }
  };

  const submitTask = async (form) => {
    const fd = new FormData(form); const id = form.dataset.id;
    const task = { id: id || undefined, title: String(fd.get('title') || '').trim(), note: String(fd.get('note') || '').trim(), due: String(fd.get('due') || ''), eventId: String(fd.get('eventId') || ''), assignee: String(fd.get('assignee') || 'both') };
    const rawCost = String(fd.get('cost') || '').normalize('NFKC').replace(/[\s,¥￥円]/g, '');
    if (rawCost && !/^\d{1,8}$/.test(rawCost)) return setErr(form, '費用は数字だけで入力してください（上限 99,999,999円）');
    task.cost = rawCost === '' ? null : Number(rawCost); task.paid = rawCost === '' ? false : fd.get('paid') === 'on';
    if (!task.title) return setErr(form, 'タスク名を入力してください');
    setErr(form, ''); busy(form, true);
    try { const r = await Api.call('saveTask', { task }); mergeById(S.tasks, r.task); afterWrite(r); closeSheet(); render(); toast(id ? '保存しました' : 'タスクを追加しました'); }
    catch (e) { busy(form, false); setErr(form, e.message); handleAuth(e); }
  };

  const submitProfile = async (form) => {
    const fd = new FormData(form);
    const name = String(fd.get('name') || '').trim(); if (!name) return setErr(form, '名前を入力してください');
    setErr(form, ''); busy(form, true);
    try {
      const r = await Api.call('saveProfile', { name, emoji: String(fd.get('emoji')), color: String(fd.get('color')) });
      const m = meM(); Object.assign(m, { name, emoji: String(fd.get('emoji')), color: String(fd.get('color')), profileSet: true });
      afterWrite(r); closeSheet(); render(); toast('プロフィールを保存しました');
    } catch (e) { busy(form, false); setErr(form, e.message); handleAuth(e); }
  };

  /* ============================== 書き出し ============================== */
  const download = (name, mime, text) => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime })); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const icsEsc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const exportIcs = () => {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Futari Days//JP', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Futari Days'];
    S.events.forEach((e) => {
      const d = e.date.replace(/-/g, '');
      L.push('BEGIN:VEVENT', `UID:${e.id}@futari-days`, `DTSTAMP:${stamp}`);
      if (e.time) { const hh = Number(e.time.slice(0, 2)); const end = `${pad((hh + 2) % 24)}${e.time.slice(3, 5)}`; L.push(`DTSTART:${d}T${e.time.replace(':', '')}00`, `DTEND:${d}T${end}00`); }
      else L.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${addDays(e.date, 1).replace(/-/g, '')}`);
      L.push(`SUMMARY:${icsEsc(`${e.emoji} ${e.title}`)}`);
      if (e.place) L.push(`LOCATION:${icsEsc(e.place)}`);
      if (e.note) L.push(`DESCRIPTION:${icsEsc(e.note)}`);
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    download('futari-days.ics', 'text/calendar', L.join('\r\n'));
    toast('カレンダー用ファイルを保存しました');
  };
  const exportJson = () => {
    download(`futari-days-backup-${todayStr()}.json`, 'application/json', JSON.stringify({ exportedAt: new Date().toISOString(), members: S.members.map(({ uid, name, emoji }) => ({ uid, name, emoji })), events: S.events, tasks: S.tasks }, null, 2));
    toast('バックアップを保存しました');
  };

  /* ============================== テーマ ============================== */
  const applyTheme = () => {
    const root = document.documentElement;
    if (S.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', S.theme);
    const dark = S.theme === 'dark' || (S.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const m = $('#meta-theme'); if (m) m.setAttribute('content', dark ? '#17120F' : '#FFF6F3');
  };

  /* ============================== イベント委譲 ============================== */
  const pickIn = (form, name, value) => { const i = form.elements[name]; if (i) i.value = value; };

  document.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-action]'); if (!el) return;
    const a = el.dataset.action; const id = el.dataset.id;
    switch (a) {
      case 'tab': S.tab = el.dataset.tab; S.enter = true; render(); window.scrollTo(0, 0); break;
      case 'goto-tasks': S.tab = 'tasks'; S.enter = true; render(); window.scrollTo(0, 0); break;
      case 'fab': if (S.tab === 'home') eventForm(null); else taskForm(null, { eventId: S.evFilter && S.evFilter !== 'none' ? S.evFilter : '' }); break;
      case 'new-event': eventForm(null); break;
      case 'pick-slot': doLogin(el.dataset.slot); break;
      case 'login-back': loginState.step = 'pass'; loginState.pass = ''; S.loginError = ''; render(); break;
      case 'show-pw': { const i = $('#pw'); if (i) { i.type = i.type === 'password' ? 'text' : 'password'; el.textContent = i.type === 'password' ? '👁' : '🙈'; } break; }
      case 'open-event': eventSheet(id); break;
      case 'edit-event': { const ev = evById(id); if (ev) eventForm(ev); break; }
      case 'delete-event': {
        const ev = evById(id); if (!ev) break;
        const n = S.tasks.filter((t) => t.eventId === id).length;
        if (!await confirmDialog({ title: `「${ev.title}」を削除しますか？`, body: n ? `紐づくタスク${n}件もいっしょに消えます。（削除後5秒間は元に戻せます）` : '削除後5秒間は元に戻せます。', ok: '削除する', danger: true })) break;
        closeSheet(); removeEvent(id);
        break;
      }
      case 'add-template': {
        const ev = evById(id); if (!ev) break; const kind = kindOf(ev);
        const items = kind.tasks.filter((k) => !S.tasks.some((t) => t.eventId === id && t.title === k.title));
        if (!items.length) break;
        el.disabled = true; el.classList.add('loading');
        try {
          const r = await Api.call('saveEvent', { event: ev, tasks: items.map((t) => ({ title: t.title, daysBefore: t.daysBefore })) });
          mergeById(S.events, r.event); (r.tasks || []).forEach((t) => mergeById(S.tasks, t)); afterWrite(r); render(); toast(`${items.length}件のタスクを追加しました ✨`);
        } catch (er) { el.disabled = false; el.classList.remove('loading'); toastErr(er); handleAuth(er); }
        break;
      }
      case 'toggle-task': e.stopPropagation(); toggleTask(id); break;
      case 'edit-task': { const t = S.tasks.find((x) => x.id === id); if (t && !String(id).startsWith('tmp_')) taskForm(t); break; }
      case 'delete-task': { closeSheet(); removeTask(id); break; }
      case 'toggle-group': { const k = el.dataset.key; if (S.collapsed.has(k)) S.collapsed.delete(k); else S.collapsed.add(k); lsSet('fd.col', JSON.stringify([...S.collapsed])); render(); break; }
      case 'toggle-paid': e.stopPropagation(); togglePaid(id); break;
      case 'scope': S.scope = el.dataset.scope; lsSet('fd.scope', S.scope); render(); break;
      case 'ev-filter': S.evFilter = id || ''; lsSet('fd.evf', S.evFilter); render(); break;
      case 'toggle-done': S.showDone = !S.showDone; render(); break;
      case 'refresh': refresh(true); break;
      case 'close-sheet': closeSheet(); break;
      case 'open-profile': profileSheet(false); break;
      case 'theme': S.theme = el.dataset.theme; lsSet('fd.theme', S.theme); applyTheme(); render(); break;
      case 'export-ics': exportIcs(); break;
      case 'export-json': exportJson(); break;
      case 'logout': if (await confirmDialog({ title: 'ログアウトしますか？', body: 'この端末のログイン状態だけが解除されます。', ok: 'ログアウト' })) logout(false); break;
      case 'logout-all': if (await confirmDialog({ title: 'すべての端末からログアウト', body: 'ふたりの全端末のログインが解除されます。', ok: 'すべて解除', danger: true })) logout(true); break;
      case 'reset-demo': if (await confirmDialog({ title: 'デモデータをリセット', body: '最初のサンプルに戻します。', ok: 'リセット', danger: true })) { Api.resetDemo(); location.reload(); } break;
      case 'pick-kind': {
        const form = el.closest('form'); const k = el.dataset.kind; const kind = FD.KINDS[k]; const prevKind = FD.KINDS[form.elements.kind.value];
        $$('.kind', form).forEach((b) => b.classList.toggle('on', b === el)); pickIn(form, 'kind', k);
        const t = form.elements.title; if (!form.dataset.id && (!t.value.trim() || (prevKind && t.value === prevKind.label))) t.value = k === 'custom' ? '' : kind.label;
        if (!form.dataset.id) {
          pickIn(form, 'emoji', kind.emoji); pickIn(form, 'color', kind.color);
          $$('.em', form).forEach((b) => b.classList.toggle('on', b.dataset.emoji === kind.emoji)); $$('.sw', form).forEach((b) => b.classList.toggle('on', b.dataset.color === kind.color));
          const tpl = form.elements.tpl; if (tpl) { tpl.checked = kind.tasks.length > 0; tpl.disabled = !kind.tasks.length; const n = $('.tpl-n', form); if (n) n.textContent = kind.tasks.length ? `${kind.tasks.length}件（日付から逆算して期限をセット）` : 'この種類にはありません'; }
        }
        haptic(6); break;
      }
      case 'pick-color': { const f = el.closest('form'); pickIn(f, 'color', el.dataset.color); $$('.sw', f).forEach((b) => { b.classList.toggle('on', b === el); b.setAttribute('aria-pressed', b === el); }); haptic(6); break; }
      case 'pick-emoji': { const f = el.closest('form'); pickIn(f, 'emoji', el.dataset.emoji); $$('.em', f).forEach((b) => b.classList.toggle('on', b === el)); haptic(6); break; }
      case 'pick-assignee': { const f = el.closest('form'); pickIn(f, 'assignee', el.dataset.v); $$('[data-action="pick-assignee"]', f).forEach((b) => b.classList.toggle('on', b === el)); break; }
      case 'quick-due': { const f = el.closest('form'); const n = el.dataset.n; f.elements.due.value = n === 'clear' ? '' : addDays(todayStr(), Number(n)); break; }
      default: break;
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetOpen && !$('.dialog-wrap')) { closeSheet(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[role="button"][data-action]')) { e.preventDefault(); e.target.click(); }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('form[data-form]'); if (!form) return; e.preventDefault();
    switch (form.dataset.form) {
      case 'event': submitEvent(form); break;
      case 'task': submitTask(form); break;
      case 'profile': submitProfile(form); break;
      case 'login': { const v = form.elements.pass.value; if (!v.trim()) { S.loginError = '合言葉を入力してください'; render(); break; } loginState.pass = v; doLogin(''); break; }
      case 'quick-task': { const v = form.elements.title.value; form.elements.title.value = ''; quickAdd(v, S.evFilter && S.evFilter !== 'none' ? S.evFilter : ''); break; }
      case 'event-task': { const v = form.elements.title.value; form.elements.title.value = ''; quickAdd(v, form.dataset.event); break; }
      default: break;
    }
  });

  // 日付を変更したら「期限もずらす」を表示
  document.addEventListener('input', (e) => {
    if (e.target.id === 'f-date') {
      const f = e.target.form; const t = $('.toggle.shift', f);
      if (t && f.dataset.origDate) t.hidden = e.target.value === f.dataset.origDate || !e.target.value;
    }
  });

  // ヒーローのスワイプ位置 → ドット
  document.addEventListener('scroll', (e) => {
    const h = e.target; if (!h || !h.classList || !h.classList.contains('heroes')) return;
    const first = h.firstElementChild; if (!first) return;
    const idx = Math.round(h.scrollLeft / (first.offsetWidth + 12));
    if (idx !== S.heroIdx) { S.heroIdx = idx; $$('.dots i').forEach((d, i) => d.classList.toggle('on', i === idx)); haptic(5); }
  }, true);


  /* ---- タスクのスワイプ: 右=完了/未完了、左=削除（元に戻せる） ---- */
  let swipe = null; let swipeUntil = 0;
  document.addEventListener('click', (e) => { if (Date.now() < swipeUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    const task = e.target.closest && e.target.closest('.task'); if (!task || e.target.closest('.check') || String(task.dataset.id).startsWith('tmp_')) return;
    swipe = { task, tw: task.parentElement, id: task.dataset.id, x0: e.clientX, y0: e.clientY, dx: 0, lock: null, pid: e.pointerId };
  });
  document.addEventListener('pointermove', (e) => {
    if (!swipe || e.pointerId !== swipe.pid) return;
    const dx = e.clientX - swipe.x0; const dy = e.clientY - swipe.y0;
    if (!swipe.lock) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { swipe = null; return; }
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) { swipe.lock = 'x'; swipe.task.classList.add('swiping'); try { swipe.task.setPointerCapture(e.pointerId); } catch (er) { /* noop */ } } else return;
    }
    const v = Math.max(-150, Math.min(150, dx)); swipe.dx = v;
    swipe.task.style.transform = `translateX(${v}px)`;
    swipe.tw.dataset.dir = v > 0 ? 'r' : 'l'; swipe.tw.classList.toggle('armed', Math.abs(v) >= 90);
  });
  const endSwipe = (e, cancel) => {
    if (!swipe || e.pointerId !== swipe.pid) return;
    const s = swipe; swipe = null; if (s.lock !== 'x') return;
    swipeUntil = Date.now() + 350;
    s.task.classList.remove('swiping'); s.task.style.transform = ''; s.tw.classList.remove('armed'); delete s.tw.dataset.dir;
    if (!cancel && Math.abs(s.dx) >= 90) { haptic(14); if (s.dx > 0) toggleTask(s.id); else removeTask(s.id); }
  };
  document.addEventListener('pointerup', (e) => endSwipe(e, false));
  document.addEventListener('pointercancel', (e) => endSwipe(e, true));

  /* ---- 引っ張って更新 ---- */
  (() => {
    const el = document.createElement('div');
    el.className = 'ptr'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = ICON.refresh;
    document.body.appendChild(el);
    let y0 = null; let x0 = 0; let pull = 0; let active = false; let busyPtr = false;
    const LIMIT = 70;
    const show = (v, spin) => {
      el.style.transform = `translate(-50%, ${v - 54}px) rotate(${Math.min(1, v / LIMIT) * 300}deg)`;
      el.style.opacity = String(Math.min(1, v / 40)); el.classList.toggle('ready', v >= LIMIT); el.classList.toggle('spin', !!spin);
    };
    document.addEventListener('touchstart', (e) => {
      if (S.status !== 'app' || sheetOpen || busyPtr || window.scrollY > 0 || e.touches.length !== 1) { y0 = null; return; }
      if (e.target.closest && e.target.closest('input, textarea, select, .fchips')) { y0 = null; return; }
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; pull = 0; active = false; el.style.transition = 'none';
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (y0 == null) return;
      const dy = e.touches[0].clientY - y0; const dx = e.touches[0].clientX - x0;
      if (!active) { if (dy > 10 && dy > Math.abs(dx) * 1.5 && window.scrollY <= 0) active = true; else if (Math.abs(dx) > 14 || dy < -6) { y0 = null; return; } else return; }
      pull = Math.min(LIMIT + 26, dy * 0.5); show(pull, false);
    }, { passive: true });
    const end = async () => {
      if (y0 == null) return; const was = active; y0 = null; active = false; el.style.transition = '';
      if (!was) return;
      if (pull >= LIMIT) {
        busyPtr = true; haptic(14); show(LIMIT - 8, true);
        await refresh(true);
        busyPtr = false;
      }
      show(0, false);
    };
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', end, { passive: true });
  })();

  window.addEventListener('popstate', () => { if (sheetOpen) closeSheet(true); });
  window.addEventListener('online', () => { S.offline = false; if (S.status === 'app') { refresh(false); } });
  window.addEventListener('offline', () => { S.offline = true; if (S.status === 'app') render(); });
  const leave = () => { flushPending(); lsSet('fd.seen', String(Date.now())); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); else wake(); });
  window.addEventListener('pagehide', leave);
  window.addEventListener('focus', () => wake());
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => { lastAct = Date.now(); }, { passive: true }));
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

  /* ============================== 起動 ============================== */
  const celebrateToday = () => {
    const t = todayStr(); let fired = false;
    S.events.forEach((ev) => {
      if (ev.date === t && !lsGet(`fd.cel.${ev.id}.${t}`)) { lsSet(`fd.cel.${ev.id}.${t}`, '1'); fired = true; setTimeout(() => toast(`🎉 今日は「${ev.title}」！おめでとう！`), 700); }
    });
    const past = S.events.filter((e) => daysFrom(e.date) < 0).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (past) { const el = -daysFrom(past.date); if (FD.MILESTONES.includes(el) && !lsGet(`fd.ms.${past.id}.${el}`)) { lsSet(`fd.ms.${past.id}.${el}`, '1'); fired = true; setTimeout(() => toast(`✨ ${past.title}から${el}日！`), 900); } }
    S.events.forEach((ev) => {
      const d = daysFrom(ev.date);
      if (MS_DAYS.includes(d) && !lsGet(`fd.cd.${ev.id}.${d}`)) { lsSet(`fd.cd.${ev.id}.${d}`, '1'); fired = true; setTimeout(() => toast(`🎯 「${clipTxt(ev.title)}」まで、あと${d}日！`), 1100); }
    });
    if (fired) setTimeout(() => burst({ n: 140, power: 11 }), 500);
  };

  const enterApp = (justLoggedIn) => {
    S.status = 'app'; S.enter = true; render(); celebrateToday();
    const m = meM();
    if (m && m.profileSet === false) setTimeout(() => profileSheet(true), 500);
    if (justLoggedIn) haptic(20);
  };

  const boot = async () => {
    applyTheme();
    if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !Api.DEMO) { navigator.serviceWorker.register('sw.js').catch(() => {}); }
    const hasSession = Api.DEMO || !!Api.session.get();
    if (!hasSession) { S.status = 'login'; render(); return; }
    if (Api.DEMO) { S.status = 'boot'; render(); }
    else if (loadCache()) { enterApp(false); } else { S.status = 'boot'; render(); }
    try {
      const snap = await Api.call('bootstrap'); applySnapshot(snap); S.offline = false;
      if (S.status !== 'app') enterApp(false); else { render(); celebrateToday(); const m = meM(); if (m && m.profileSet === false && !sheetOpen) profileSheet(true); }
    } catch (e) {
      if (e.code === 'AUTH' || e.code === 'CONFIG') { handleAuth({ code: 'AUTH' }); if (e.code === 'CONFIG') { S.loginError = e.message; render(); } }
      else if (S.status === 'app') { S.offline = true; render(); toastErr(e); }
      else { S.status = 'login'; S.loginError = e.message; render(); }
    }
  };

  schedule();   // ログイン直後でも動くよう、起動処理とは独立して開始
  boot();
})();
