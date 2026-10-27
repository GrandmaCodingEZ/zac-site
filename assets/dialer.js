// Dialer console: simulated call log, keypad navigation, LCD readout.
// Vanilla JS module. No dependencies.

const SECTIONS = {
  '1': { label: 'About', id: 'about' },
  '2': { label: 'Work', id: 'work' },
  '3': { label: 'Projects', id: 'projects' },
  '4': { label: 'Now', id: 'now' },
  '5': { label: 'Writing', id: 'writing' },
  '6': { label: 'Contact', id: 'contact' },
};

// Fictional business names. Not real companies.
const NAMES = [
  'Sunshine Tree & Stump', 'Gulf Coast Arbor', 'Treasure Coast Canopy',
  'Palmetto Ridge Tree Care', 'Indian River Arbor Works', 'Seabreeze Stump Grinding',
  'Mangrove & Oak Tree Service', 'Cypress Bend Tree Service', 'Saw Palmetto Tree Pros',
  'Lakewood Limb & Stump', 'Hurricane Ready Tree Service', 'Bayou Pine Tree & Crane',
  'Sandhill Crane Tree Care', 'Live Oak Lane Arborists', 'Coquina Coast Tree Service',
  'Everglade Edge Tree Works', 'St. Lucie Stump & Limb', 'Tarpon Bay Tree Service',
  'Flatwoods Tree & Land', 'Sabal Palm Tree Care',
];

const IDLE_LINES = ['Zachary Spencer', 'Port St. Lucie, FL', 'paid ads · dialers · bots'];
const MAX_ROWS = 14;
const SEED_ROWS = 12;

const html = document.documentElement;
const lcdText = document.getElementById('lcd-text');
const logEl = document.getElementById('log');
const logCount = document.getElementById('log-count');
const keys = [...document.querySelectorAll('.key')];
const soundKey = document.querySelector('[data-key="*"]');
const motionKey = document.querySelector('[data-key="#"]');

const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
const state = {
  sound: false,
  motion: !reduceQuery.matches,
  dialed: 0,
  busy: false,
  idleIndex: 0,
  idleTimer: 0,
  logTimer: 0,
  nameBag: [],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min, max) => min + Math.random() * (max - min);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- LCD ----------

function setLcd(text) {
  lcdText.textContent = text;
}

function startIdle() {
  clearTimeout(state.idleTimer);
  const tick = () => {
    if (state.busy) return;
    setLcd(IDLE_LINES[state.idleIndex % IDLE_LINES.length]);
    state.idleIndex += 1;
    state.idleTimer = setTimeout(tick, 3200);
  };
  tick();
}

function hold(text, ms) {
  state.busy = true;
  clearTimeout(state.idleTimer);
  setLcd(text);
  clearTimeout(state.holdTimer);
  state.holdTimer = setTimeout(() => { state.busy = false; startIdle(); }, ms);
}

// ---------- Motion / sound ----------

function applyMotion() {
  html.dataset.motion = state.motion ? 'on' : 'off';
  motionKey.setAttribute('aria-pressed', String(state.motion));
}

function applySound() {
  soundKey.setAttribute('aria-pressed', String(state.sound));
}

const audio = {};
function play(name) {
  if (!state.sound) return;
  try {
    if (!audio[name]) {
      audio[name] = new Audio(`/assets/sounds/${name}.mp3`);
      audio[name].preload = 'auto';
    }
    audio[name].currentTime = 0;
    audio[name].volume = 0.5;
    audio[name].play().catch(() => {});
  } catch { /* no audio, fine */ }
}

// ---------- Call log ----------

function nextName() {
  if (state.nameBag.length === 0) {
    state.nameBag = NAMES.slice().sort(() => Math.random() - 0.5);
  }
  return state.nameBag.pop();
}

function stamp() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, '0')).join(':');
}

function outcome() {
  const r = Math.random();
  if (r < 0.5) return ['noanswer', 'No answer'];
  if (r < 0.8) return ['voicemail', 'Voicemail'];
  return ['connected', 'Connected'];
}

function addRow(animate) {
  const li = document.createElement('li');
  li.className = 'log__row' + (animate ? ' is-new' : '');
  const chip = document.createElement('span');
  chip.className = 'chip chip--dialing';
  chip.textContent = 'Dialing';

  const cells = [
    ['log__time', stamp()],
    ['log__name', nextName()],
    ['log__num', '(772) ••• ••••'],
  ];
  for (const [cls, text] of cells) {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = text;
    li.appendChild(span);
  }
  li.appendChild(chip);
  logEl.appendChild(li);

  while (logEl.children.length > MAX_ROWS) logEl.firstElementChild.remove();

  state.dialed += 1;
  logCount.textContent = `${state.dialed} dialed`;

  const settle = () => {
    const [cls, text] = outcome();
    chip.className = `chip chip--${cls}`;
    chip.textContent = text;
  };
  if (animate) setTimeout(settle, rand(900, 2200)); else settle();
}

async function seedLog() {
  if (!state.motion) {
    for (let i = 0; i < SEED_ROWS; i += 1) addRow(false);
    return;
  }
  for (let i = 0; i < SEED_ROWS; i += 1) {
    addRow(true);
    await wait(400);
  }
  scheduleIdleRow();
}

function scheduleIdleRow() {
  clearTimeout(state.logTimer);
  state.logTimer = setTimeout(() => {
    if (state.motion && !document.hidden) addRow(true);
    scheduleIdleRow();
  }, rand(6000, 10000));
}

// ---------- Chat widget ----------

function openChat() {
  try {
    const lc = window.leadConnector;
    if (lc && lc.chatWidget && typeof lc.chatWidget.openWidget === 'function') {
      lc.chatWidget.openWidget();
      return true;
    }
  } catch { /* fall through */ }
  const widget = document.querySelector('chat-widget');
  const root = widget && widget.shadowRoot;
  const btn = root && root.querySelector('.lc_text-widget--bubble, button, [role="button"]');
  if (btn) { btn.click(); return true; }
  return false;
}

async function callZac() {
  hold('Dialing 0…', 60000);
  play('ringback');
  await wait(600);
  let opened = false;
  for (let i = 0; i < 6 && !opened; i += 1) {
    opened = openChat();
    if (!opened) await wait(500);
  }
  if (opened) {
    play('connect');
    hold('Connected — Zac', 4000);
  } else {
    hold('Chat unavailable — see contact', 4000);
    goTo('contact');
  }
}

// ---------- Navigation ----------

function goTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: state.motion ? 'smooth' : 'auto', block: 'start' });
  history.replaceState(null, '', `#${id}`);
}

async function dial(key) {
  const target = SECTIONS[key];
  flash(key);
  if (target) {
    hold(`Dialing ${key}…`, 60000);
    play('ringback');
    await wait(600);
    play('connect');
    hold(`Connected — ${target.label}`, 4000);
    await wait(350);
    goTo(target.id);
    return;
  }
  if (key === '0') { callZac(); return; }
  if (key === '*') {
    state.sound = !state.sound;
    applySound();
    if (state.sound) play('connect');
    hold(state.sound ? 'Sound on' : 'Sound off', 2000);
    return;
  }
  if (key === '#') {
    state.motion = !state.motion;
    applyMotion();
    if (state.motion) scheduleIdleRow(); else clearTimeout(state.logTimer);
    hold(state.motion ? 'Motion on' : 'Motion off', 2000);
    return;
  }
  hold(`${key} — not in service`, 2000);
}

function flash(key) {
  const btn = keys.find((k) => k.dataset.key === key);
  if (!btn) return;
  btn.classList.add('is-pressed');
  setTimeout(() => btn.classList.remove('is-pressed'), 160);
}

// ---------- Wire up ----------

keys.forEach((btn) => btn.addEventListener('click', () => dial(btn.dataset.key)));

document.querySelectorAll('[data-press]').forEach((a) => {
  a.addEventListener('click', (e) => { e.preventDefault(); dial(a.dataset.press); });
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (!/^[0-9*#]$/.test(e.key)) return;
  e.preventDefault();
  dial(e.key);
});

reduceQuery.addEventListener('change', (e) => {
  state.motion = !e.matches;
  applyMotion();
});

applyMotion();
applySound();
startIdle();
seedLog();
