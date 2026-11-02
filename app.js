(() => {
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const LS_STATE = 'pinner.state';
const LS_CFG = 'pinner.cfg';
const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const GG = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#6366f1','#a855f7','#ec4899','#64748b'];
const EMOJIS = ['🏃','🏋️','🧘','🚴','🏊','⚽','🥗','💧','😴','📚','💼','🏠','✈️','🎉','🍷','🚭','💊','🧠','❤️','⭐','😀','😐','😞','🤒'];
const DEFAULT_ICONS = [
  { id: 'i-sport', emoji: '🏃', label: 'Sport', color: '#22c55e' },
  { id: 'i-lavoro', emoji: '💼', label: 'Lavoro', color: '#3b82f6' },
  { id: 'i-relax', emoji: '🧘', label: 'Relax', color: '#a855f7' },
];

const cfg = Object.assign(JSON.parse(localStorage.getItem(LS_CFG) || '{}'), { url: (window.PINNER_CONFIG || {}).url });
const state = Object.assign(
  { icons: [], days: {}, pendingDates: {}, pendingIcons: false },
  JSON.parse(localStorage.getItem(LS_STATE) || '{}')
);
const ui = { tab: 'calendar', view: 'month', cursor: new Date(), sync: 'idle' };

/* ---------- utilità ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekStart = d => addDays(d, -((d.getDay() + 6) % 7));
const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const iconById = id => state.icons.find(i => i.id === id);
const save = () => localStorage.setItem(LS_STATE, JSON.stringify(state));
// days: { 'yyyy-mm-dd': { iconId: quantità } } (migra il vecchio formato ad array)
for (const [d, v] of Object.entries(state.days)) {
  if (Array.isArray(v)) state.days[d] = Object.fromEntries(v.map(id => [id, 1]));
}
const qty = (ds, id) => (state.days[ds] || {})[id] || 0;
const dayIcons = ds => Object.keys(state.days[ds] || {})
  .map(id => { const ic = iconById(id); return ic && { ...ic, n: qty(ds, id) }; }).filter(Boolean);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 2600);
}

const dot = (ic, cls = '') =>
  `<span class="dot ${cls}" style="--c:${esc(ic.color)}"><i>${esc(ic.emoji)}</i>${ic.counter && ic.n ? `<b class="badge">${ic.n}</b>` : ''}</span>`;

/* ---------- periodo ---------- */
function periodDays() {
  const c = ui.cursor, out = [];
  if (ui.view === 'week') {
    const s = weekStart(c);
    for (let i = 0; i < 7; i++) out.push(fmt(addDays(s, i)));
  } else {
    const n = new Date(c.getFullYear(), c.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= n; i++) out.push(fmt(new Date(c.getFullYear(), c.getMonth(), i)));
  }
  return out;
}

function periodTitle() {
  const ds = periodDays();
  if (ui.view === 'month') return `${MESI[ui.cursor.getMonth()]} ${ui.cursor.getFullYear()}`;
  const a = parse(ds[0]), b = parse(ds[6]);
  const m = d => MESI[d.getMonth()].slice(0, 3);
  return `${a.getDate()} ${m(a)} – ${b.getDate()} ${m(b)} ${b.getFullYear()}`;
}

function shift(dir) {
  const c = ui.cursor;
  ui.cursor = ui.view === 'week' ? addDays(c, 7 * dir) : new Date(c.getFullYear(), c.getMonth() + dir, 1);
  render();
}

/* ---------- API / sync ---------- */
const configured = () => cfg.url && cfg.token;

async function api(action, payload = {}) {
  const res = await fetch(cfg.url, {
    method: 'POST',
    redirect: 'follow',
    body: JSON.stringify({ action, token: cfg.token, ...payload }), // text/plain: niente preflight CORS
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'Errore server');
  return data;
}

function setSync(s) {
  ui.sync = s;
  const b = $('#sync');
  b.dataset.state = s;
  $('#sync-text').textContent = { idle: 'Non configurato', ok: 'Sincronizzato', busy: 'Sync…', pending: 'Da sincronizzare', error: 'Errore' }[s];
}

let syncing = false;
async function sync({ pull = true } = {}) {
  if (!configured()) { setSync('idle'); return; }
  if (syncing) return;
  syncing = true; setSync('busy');
  try {
    if (state.pendingIcons) { await api('saveIcons', { icons: state.icons }); state.pendingIcons = false; save(); }
    for (const date of Object.keys(state.pendingDates)) {
      await api('setDay', { date, icons: Object.entries(state.days[date] || {}) });
      delete state.pendingDates[date]; save();
    }
    if (pull) {
      const data = await api('getAll');
      if (!data.icons.length && !state.icons.length) {
        state.icons = DEFAULT_ICONS.slice();
        await api('saveIcons', { icons: state.icons });
      } else {
        state.icons = data.icons;
      }
      const days = {};
      data.entries.forEach(([d, id, n]) => ((days[d] = days[d] || {})[id] = n || 1));
      state.days = days;
      save();
    }
    setSync('ok');
  } catch (e) {
    console.error(e);
    setSync(navigator.onLine ? 'error' : 'pending');
    toast(navigator.onLine ? 'Sync fallita: ' + e.message : 'Offline: modifiche salvate in locale');
  } finally {
    syncing = false;
    render();
  }
}

function touchDay(ds) { state.pendingDates[ds] = true; save(); setSync('pending'); sync({ pull: false }); }
function touchIcons() { state.pendingIcons = true; save(); setSync('pending'); sync({ pull: false }); }

/* ---------- viste ---------- */
function renderToolbar() {
  const el = $('#toolbar');
  if (ui.tab !== 'calendar' && ui.tab !== 'stats') { el.innerHTML = ''; return; }
  el.innerHTML = `
    <div class="seg">
      <button data-action="view" data-v="week" class="${ui.view === 'week' ? 'on' : ''}">Settimana</button>
      <button data-action="view" data-v="month" class="${ui.view === 'month' ? 'on' : ''}">Mese</button>
    </div>
    <div class="nav">
      <button data-action="prev" aria-label="Precedente">‹</button>
      <div class="title">${periodTitle()}</div>
      <button data-action="today">Oggi</button>
      <button data-action="next" aria-label="Successivo">›</button>
    </div>`;
}

function renderCalendar() {
  const today = fmt(new Date());
  if (!state.icons.length) {
    return `<div class="empty-state">Nessuna icona definita.<br>Creane qualcuna nella scheda 🎨 Icone.</div>`;
  }
  if (ui.view === 'week') {
    return periodDays().map(ds => {
      const d = parse(ds), ics = dayIcons(ds);
      return `<button class="weekrow ${ds === today ? 'today' : ''}" data-action="day" data-date="${ds}">
        <div class="d"><small>${GG[(d.getDay() + 6) % 7]}</small><b>${d.getDate()}</b></div>
        <div class="items">${ics.length
          ? ics.map(i => `<span class="chip">${dot(i)}${esc(i.label)}${i.counter ? ` ×${i.n}` : ''}</span>`).join('')
          : '<span class="empty">Tocca per aggiungere</span>'}</div>
      </button>`;
    }).join('');
  }
  const first = new Date(ui.cursor.getFullYear(), ui.cursor.getMonth(), 1);
  const start = weekStart(first);
  const days = periodDays();
  const weeks = Math.ceil(((first - start) / 864e5 + days.length) / 7);
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const d = addDays(start, i), ds = fmt(d), ics = dayIcons(ds);
    const out = d.getMonth() !== ui.cursor.getMonth();
    cells += `<button class="cell ${out ? 'out' : ''} ${ds === today ? 'today' : ''}" data-action="day" data-date="${ds}">
      <span class="n">${d.getDate()}</span>
      <span class="dots">${ics.slice(0, 4).map(i => dot(i, 'sm')).join('')}</span>
      ${ics.length > 4 ? `<span class="more">+${ics.length - 4}</span>` : ''}
    </button>`;
  }
  return `<div class="dow">${GG.map(g => `<div>${g}</div>`).join('')}</div><div class="grid">${cells}</div>`;
}

function renderStats() {
  if (!state.icons.length) return `<div class="empty-state">Nessuna icona definita.</div>`;
  const today = fmt(new Date());
  const elapsed = periodDays().filter(d => d <= today); // i giorni futuri non contano
  const total = elapsed.length;
  const logged = elapsed.filter(d => dayIcons(d).length).length;
  const rows = state.icons.map(ic => {
    const n = elapsed.filter(d => qty(d, ic.id) > 0).length;
    const sum = elapsed.reduce((s, d) => s + qty(d, ic.id), 0);
    return { ic, n, sum, pct: total ? (n / total) * 100 : 0 };
  }).sort((a, b) => b.n - a.n);
  return `<div class="card">
    <p class="summary">${total} ${total === 1 ? 'giorno' : 'giorni'} nel periodo · ${logged} con almeno un'icona</p>
    ${rows.map(r => `<div class="stat" style="--c:${esc(r.ic.color)}">
      ${dot(r.ic)}
      <div><div class="lbl">${esc(r.ic.label)}</div><div class="num">${r.n} / ${total} giorni${r.ic.counter
        ? ` · totale ${r.sum}${r.n ? ` · media ${(r.sum / r.n).toFixed(1).replace(/\.0$/, '')}/giorno` : ''}` : ''}</div></div>
      <div class="pct">${r.pct.toFixed(r.pct % 1 ? 1 : 0)}%</div>
      <div class="bar"><div style="width:${r.pct}%"></div></div>
    </div>`).join('')}
  </div>`;
}

function renderIcons() {
  return `<div class="card">
    ${state.icons.map(ic => `<div class="row">${dot(ic, 'lg')}
      <div class="grow">${esc(ic.label)}</div>
      <button class="btn sm" data-action="edit-icon" data-id="${esc(ic.id)}">Modifica</button>
    </div>`).join('') || '<div class="empty-state">Nessuna icona.</div>'}
    <div class="actions"><button class="btn primary" data-action="edit-icon" data-id="">+ Nuova icona</button></div>
  </div>`;
}

function renderSettings() {
  return `<div class="card">
    ${cfg.url ? '' : '<p class="hint">⚠️ URL non configurato: impostalo in <b>config.js</b>.</p>'}
    <label class="field"><span>Password (uguale a SECRET in Code.gs)</span>
      <input type="password" id="cfg-token" value="${esc(cfg.token || '')}"></label>
    <div class="actions"><button class="btn primary" data-action="save-cfg">Salva e sincronizza</button></div>
    <p class="hint">I dati sono salvati anche in locale: l'app funziona offline e sincronizza appena possibile.</p>
  </div>`;
}

function render() {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  renderToolbar();
  $('#main').innerHTML = { calendar: renderCalendar, stats: renderStats, icons: renderIcons, settings: renderSettings }[ui.tab]();
}

/* ---------- modali ---------- */
const modal = $('#modal');
const closeModal = () => modal.close();

function openDay(ds) {
  const d = parse(ds);
  const paint = () => {
    modal.innerHTML = `<h2>${GG[(d.getDay() + 6) % 7]} ${d.getDate()} ${MESI[d.getMonth()]}</h2>
      ${state.icons.map(ic => {
        const n = qty(ds, ic.id), on = n > 0 ? 'on' : '', id = esc(ic.id), c = `style="--c:${esc(ic.color)}"`;
        return ic.counter
          ? `<div class="pick ${on}" ${c}>${dot(ic, 'lg')}<span class="lbl">${esc(ic.label)}</span>
              <span class="stepper"><button data-action="dec" data-id="${id}" aria-label="Meno">−</button><b>${n}</b><button data-action="inc" data-id="${id}" aria-label="Più">+</button></span></div>`
          : `<button class="pick ${on}" ${c} data-action="toggle" data-id="${id}">
              ${dot(ic, 'lg')}<span class="lbl">${esc(ic.label)}</span><span class="ck">✔</span></button>`;
      }).join('')}
      <div class="actions"><button class="btn primary" data-action="close">Fatto</button></div>`;
  };
  modal.dataset.mode = 'day'; modal.dataset.date = ds;
  paint(); modal._paint = paint;
  modal.showModal();
}

function setQty(ds, id, n) {
  const day = state.days[ds] || (state.days[ds] = {});
  if (n > 0) day[id] = Math.min(n, 99); else delete day[id];
  if (!Object.keys(day).length) delete state.days[ds];
}

function changeQty(id, delta) {
  const ds = modal.dataset.date;
  setQty(ds, id, delta === 0 ? (qty(ds, id) ? 0 : 1) : qty(ds, id) + delta); // delta 0 = on/off
  touchDay(ds);
  modal._paint();
  render();
}

function openIconEditor(id) {
  const ic = id ? iconById(id) : null;
  const draft = ic ? { ...ic } : { id: uid(), emoji: EMOJIS[0], label: '', color: COLORS[5] };
  const paint = () => {
    modal.innerHTML = `<h2>${ic ? 'Modifica icona' : 'Nuova icona'}</h2>
      <div style="text-align:center;margin:8px 0">${dot(draft, 'lg')}</div>
      <label class="field"><span>Etichetta</span><input type="text" id="ic-label" maxlength="30" value="${esc(draft.label)}"></label>
      <div class="field"><span>Icona</span>
        <div class="emojis">${EMOJIS.map(e => `<button data-action="pick-emoji" data-e="${e}" class="${e === draft.emoji ? 'on' : ''}">${e}</button>`).join('')}</div></div>
      <label class="field"><span>Oppure scrivi una emoji</span><input type="text" id="ic-emoji" maxlength="4" value="${esc(draft.emoji)}"></label>
      <label class="check"><input type="checkbox" id="ic-counter" ${draft.counter ? 'checked' : ''}> Conta la quantità per giorno (es. 3 bicchieri)</label>
      <div class="field"><span>Colore</span>
        <div class="swatches">${COLORS.map(c => `<button class="swatch ${c === draft.color ? 'on' : ''}" style="--c:${c}" data-action="pick-color" data-c="${c}"></button>`).join('')}
        <input type="color" id="ic-color" value="${esc(draft.color)}"></div></div>
      <div class="actions">
        ${ic ? '<button class="btn danger" data-action="del-icon">Elimina</button>' : ''}
        <button class="btn" data-action="close">Annulla</button>
        <button class="btn primary" data-action="save-icon">Salva</button>
      </div>`;
  };
  // mantiene label/emoji digitati prima di ridisegnare
  const keep = () => {
    const l = $('#ic-label'), e = $('#ic-emoji');
    if (l) draft.label = l.value;
    if (e && e.value.trim()) draft.emoji = e.value.trim();
    const c = $('#ic-counter');
    if (c) draft.counter = c.checked;
  };
  modal.dataset.mode = 'icon';
  modal._paint = paint;
  modal._icon = { draft, ic, keep };
  paint();
  modal.showModal();
}

function saveIcon() {
  const { draft, ic, keep } = modal._icon;
  keep();
  if (!draft.label.trim()) { toast('Inserisci un\'etichetta'); return; }
  draft.label = draft.label.trim();
  if (ic) Object.assign(ic, draft); else state.icons.push(draft);
  touchIcons(); closeModal(); render();
}

function deleteIcon() {
  const { ic } = modal._icon;
  if (!confirm(`Eliminare "${ic.label}"? Verrà rimossa da tutti i giorni.`)) return;
  state.icons = state.icons.filter(i => i.id !== ic.id);
  const touched = [];
  for (const d of Object.keys(state.days)) {
    if (qty(d, ic.id)) { setQty(d, ic.id, 0); touched.push(d); }
  }
  touched.forEach(d => (state.pendingDates[d] = true));
  touchIcons(); closeModal(); render();
}

/* ---------- eventi ---------- */
document.addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { ui.tab = tab.dataset.tab; render(); return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const d = el.dataset;
  switch (d.action) {
    case 'view': ui.view = d.v; render(); break;
    case 'prev': shift(-1); break;
    case 'next': shift(1); break;
    case 'today': ui.cursor = new Date(); render(); break;
    case 'day': openDay(d.date); break;
    case 'toggle': changeQty(d.id, 0); break;
    case 'inc': changeQty(d.id, 1); break;
    case 'dec': changeQty(d.id, -1); break;
    case 'close': closeModal(); break;
    case 'edit-icon': openIconEditor(d.id); break;
    case 'pick-emoji': modal._icon.keep(); modal._icon.draft.emoji = d.e; modal._paint(); break;
    case 'pick-color': modal._icon.keep(); modal._icon.draft.color = d.c; modal._paint(); break;
    case 'save-icon': saveIcon(); break;
    case 'del-icon': deleteIcon(); break;
    case 'sync': configured() ? sync() : (ui.tab = 'settings', render()); break;
    case 'save-cfg':
      cfg.token = $('#cfg-token').value.trim();
      localStorage.setItem(LS_CFG, JSON.stringify({ token: cfg.token }));
      ui.tab = 'calendar'; render(); sync();
      break;
  }
});

document.addEventListener('input', e => {
  if (e.target.id === 'ic-color') { modal._icon.keep(); modal._icon.draft.color = e.target.value; modal._paint(); $('#ic-color').focus(); }
});
modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
window.addEventListener('online', () => sync());
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });

/* ---------- avvio ---------- */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(console.error);
if (!configured()) ui.tab = 'settings';
setSync(configured() ? (Object.keys(state.pendingDates).length || state.pendingIcons ? 'pending' : 'ok') : 'idle');
render();
sync();
})();
