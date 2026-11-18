const KEY = 'belajarku-v1';
const PRESETS = ['#f4a6c0', '#c3b1e8', '#a8dcc4', '#f7c5a0', '#a9d0f0', '#f3e0a0'];
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const $ = id => document.getElementById(id);
const defaults = {
  subjects: ['Matematika', 'Informatika', 'Bahasa Inggris'],
  sessions: [],
  schedule: [],
  settings: { accent: PRESETS[0], dark: false, goalHours: 4 },
  runningStart: null,
  runningSubject: null
};

let state = load();
let tick = null;

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s) return { ...defaults, ...s, settings: { ...defaults.settings, ...s.settings } };
  } catch (e) { /* data kosong atau rusak, mulai baru */ }
  return structuredClone(defaults);
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* abaikan */ }
}

function dateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const todayStr = () => dateStr(new Date());
function fmtClock(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}
function fmtHM(sec) {
  return `${Math.floor(sec / 3600)}j ${Math.floor(sec % 3600 / 60)}m`;
}
function esc(v) {
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function fmtDate(v) {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
}

/* ---------- Tema ---------- */
function applyTheme() {
  const r = document.documentElement;
  r.style.setProperty('--accent', state.settings.accent);
  r.dataset.dark = String(state.settings.dark);
  $('customColor').value = state.settings.accent;
  $('darkToggle').checked = state.settings.dark;
  $('goalInput').value = state.settings.goalHours;
  document.querySelectorAll('.swatch').forEach(s =>
    s.classList.toggle('active', s.dataset.color === state.settings.accent));
}
function buildSwatches() {
  $('swatches').innerHTML = PRESETS.map(c =>
    `<button class="swatch" data-color="${c}" style="background:${c}" aria-label="Warna ${c}"></button>`).join('');
}

/* ---------- Timer ---------- */
function elapsed() {
  return state.runningStart ? Math.floor((Date.now() - state.runningStart) / 1000) : 0;
}
function updateTimer() {
  $('timerDisplay').textContent = fmtClock(elapsed());
  renderStats();
}
function startTimer() {
  if (state.runningStart) return;
  state.runningStart = Date.now();
  state.runningSubject = $('subjectSelect').value;
  save(); syncTimerUI();
}
function stopTimer() {
  if (!state.runningStart) return;
  const sec = elapsed();
  if (sec >= 1) {
    state.sessions.push({
      id: `${Date.now()}`, subject: state.runningSubject || 'Umum',
      seconds: sec, date: todayStr()
    });
  }
  state.runningStart = null; state.runningSubject = null;
  save(); syncTimerUI(); render();
}
function syncTimerUI() {
  const on = !!state.runningStart;
  $('startBtn').disabled = on;
  $('stopBtn').disabled = !on;
  $('subjectSelect').disabled = on;
  $('timerDisplay').classList.toggle('running', on);
  if (on && state.runningSubject) $('subjectSelect').value = state.runningSubject;
  clearInterval(tick);
  if (on) tick = setInterval(updateTimer, 1000);
  updateTimer();
}

/* ---------- Render ---------- */
function secondsOn(date) {
  let t = state.sessions.filter(s => s.date === date).reduce((a, s) => a + s.seconds, 0);
  if (state.runningStart && date === todayStr()) t += elapsed();
  return t;
}
function renderStats() {
  const today = secondsOn(todayStr());
  let week = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    week += secondsOn(dateStr(d));
  }
  const goal = state.settings.goalHours * 3600;
  const pct = Math.min(100, Math.round(today / goal * 100));
  $('todayTotal').textContent = fmtHM(today);
  $('weekTotal').textContent = fmtHM(week);
  $('goalText').textContent = `${pct}%`;
  $('goalBar').style.width = `${pct}%`;
}
function renderSubjects() {
  const cur = $('subjectSelect').value;
  $('subjectSelect').innerHTML = state.subjects.map(s => `<option>${esc(s)}</option>`).join('');
  if (state.subjects.includes(cur)) $('subjectSelect').value = cur;
}
function renderChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push({ label: DAYS[d.getDay()], sec: secondsOn(dateStr(d)) });
  }
  const max = Math.max(...days.map(d => d.sec), 3600);
  $('chart').innerHTML = days.map(d =>
    `<div class="bar-col"><span>${d.sec ? (d.sec / 3600).toFixed(1) + 'j' : ''}</span>` +
    `<div class="bar" style="height:${d.sec / max * 80}%"></div><span>${d.label}</span></div>`).join('');
}
function renderHistory() {
  const items = [...state.sessions].reverse().slice(0, 20);
  $('historyList').innerHTML = items.length ? items.map(s =>
    `<li><div class="info"><strong>${esc(s.subject)}</strong><span>${fmtDate(s.date)} · ${fmtHM(s.seconds)}</span></div>` +
    `<button class="del" data-del-session="${s.id}" aria-label="Hapus sesi">×</button></li>`).join('')
    : '<li class="empty">Belum ada sesi belajar. Yuk mulai!</li>';
}
function renderSchedule() {
  const items = [...state.schedule].sort((a, b) =>
    (a.done - b.done) || (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  $('scheduleList').innerHTML = items.length ? items.map(s =>
    `<li class="${s.done ? 'done' : ''}">` +
    `<input type="checkbox" data-done="${s.id}" ${s.done ? 'checked' : ''} aria-label="Tandai selesai" />` +
    `<div class="info"><strong>${esc(s.title)}</strong><span>${fmtDate(s.date)}${s.time ? ' · ' + s.time : ''}</span></div>` +
    `<button class="del" data-del-sch="${s.id}" aria-label="Hapus jadwal">×</button></li>`).join('')
    : '<li class="empty">Belum ada jadwal. Tambahkan di atas.</li>';
}
function render() {
  renderStats(); renderChart(); renderHistory(); renderSchedule();
}

/* ---------- Event ---------- */
$('startBtn').addEventListener('click', startTimer);
$('stopBtn').addEventListener('click', stopTimer);

$('addSubject').addEventListener('click', () => {
  const v = $('newSubject').value.trim();
  if (!v || state.subjects.includes(v)) return;
  state.subjects.push(v); $('newSubject').value = '';
  save(); renderSubjects(); $('subjectSelect').value = v;
});

$('scheduleForm').addEventListener('submit', e => {
  e.preventDefault();
  const title = $('schTitle').value.trim();
  if (!title || !$('schDate').value) return;
  state.schedule.push({ id: `${Date.now()}`, title, date: $('schDate').value, time: $('schTime').value, done: false });
  save(); e.target.reset(); $('schDate').value = todayStr(); renderSchedule();
});
$('scheduleList').addEventListener('click', e => {
  const del = e.target.closest('[data-del-sch]');
  if (del) { state.schedule = state.schedule.filter(s => s.id !== del.dataset.delSch); save(); renderSchedule(); }
});
$('scheduleList').addEventListener('change', e => {
  const id = e.target.dataset.done;
  if (!id) return;
  const item = state.schedule.find(s => s.id === id);
  if (item) { item.done = e.target.checked; save(); renderSchedule(); }
});
$('historyList').addEventListener('click', e => {
  const del = e.target.closest('[data-del-session]');
  if (del) { state.sessions = state.sessions.filter(s => s.id !== del.dataset.delSession); save(); render(); }
});

$('openSettings').addEventListener('click', () => { $('settingsPanel').hidden = false; });
$('closeSettings').addEventListener('click', () => { $('settingsPanel').hidden = true; });
$('settingsPanel').addEventListener('click', e => { if (e.target.id === 'settingsPanel') e.target.hidden = true; });
$('swatches').addEventListener('click', e => {
  const b = e.target.closest('.swatch');
  if (!b) return;
  state.settings.accent = b.dataset.color; save(); applyTheme();
});
$('customColor').addEventListener('input', e => { state.settings.accent = e.target.value; save(); applyTheme(); });
$('darkToggle').addEventListener('change', e => { state.settings.dark = e.target.checked; save(); applyTheme(); });
$('goalInput').addEventListener('change', e => {
  const v = Number(e.target.value);
  if (v > 0) { state.settings.goalHours = v; save(); renderStats(); }
});

/* ---------- Mulai ---------- */
$('todayLabel').textContent = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
$('schDate').value = todayStr();
buildSwatches(); applyTheme(); renderSubjects(); syncTimerUI(); render();
