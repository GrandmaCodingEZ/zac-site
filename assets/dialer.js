// Rotary dial: drag or tap a hole to the finger stop, the dial returns, the call connects.
// Vanilla JS module. No dependencies.

const SECTIONS = {
  '1': { label: 'About', id: 'about' },
  '2': { label: 'Work', id: 'work' },
  '3': { label: 'Projects', id: 'projects' },
  '4': { label: 'Now', id: 'now' },
  '5': { label: 'Writing', id: 'writing' },
  '6': { label: 'Contact', id: 'contact' },
};

// Dial geometry, matching the render. Angles are degrees, counter-clockwise from 3 o'clock.
const STOP = -35;
const holeAngle = (i) => STOP + 28 + (i - 1) * 30;      // i = 1..10, 10 is "0"
const travel = (i) => holeAngle(i) - STOP;               // clockwise degrees to the stop
const RETURN_SPEED = 300;                                // degrees per second on the way back
const PULL_SPEED = 420;                                  // degrees per second when auto-dialing

const html = document.documentElement;
const phone = document.getElementById('phone');
const wheel = document.getElementById('wheel');
const status = document.getElementById('status-text');
const dirButtons = [...document.querySelectorAll('[data-key]')];
const soundBtn = document.querySelector('[data-toggle="sound"]');
const motionBtn = document.querySelector('[data-toggle="motion"]');

const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
const state = {
  sound: false,
  motion: !reduceQuery.matches,
  busy: false,
  angle: 0,
  drag: null,
  idleTimer: 0,
  holdTimer: 0,
};

const IDLE = ['Line 1 · ready', 'Zachary Spencer', 'Port St. Lucie, FL', 'paid ads · dialers · bots'];
let idleIndex = 0;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- status line ----------

function setStatus(text) { status.textContent = text; }

function startIdle() {
  clearTimeout(state.idleTimer);
  const tick = () => {
    if (state.busy) return;
    setStatus(IDLE[idleIndex % IDLE.length]);
    idleIndex += 1;
    state.idleTimer = setTimeout(tick, 3200);
  };
  tick();
}

function hold(text, ms) {
  state.busy = true;
  clearTimeout(state.idleTimer);
  clearTimeout(state.holdTimer);
  setStatus(text);
  state.holdTimer = setTimeout(() => { state.busy = false; startIdle(); }, ms);
}

// ---------- sound / motion ----------

const audio = {};
function play(name) {
  if (!state.sound) return;
  try {
    if (!audio[name]) { audio[name] = new Audio(`/assets/sounds/${name}.mp3`); audio[name].preload = 'auto'; }
    audio[name].currentTime = 0;
    audio[name].volume = name === 'tick' ? 0.35 : 0.5;
    audio[name].play().catch(() => {});
  } catch { /* no audio */ }
}

function applyToggles() {
  html.dataset.motion = state.motion ? 'on' : 'off';
  soundBtn.setAttribute('aria-pressed', String(state.sound));
  motionBtn.setAttribute('aria-pressed', String(state.motion));
  soundBtn.querySelector('.dir__val').textContent = state.sound ? 'on' : 'off';
  motionBtn.querySelector('.dir__val').textContent = state.motion ? 'on' : 'off';
}

// ---------- wheel ----------

function setAngle(deg, transitionMs) {
  state.angle = deg;
  wheel.style.transition = transitionMs && state.motion ? `transform ${transitionMs}ms linear` : 'none';
  wheel.style.transform = `rotate(${deg}deg)`;
}

function geometry() {
  const r = phone.getBoundingClientRect();
  return { cx: r.left + r.width * 0.5, cy: r.top + r.height * 0.6569, radius: r.width * 0.151 };
}

function pointerAngle(e, g) {
  // counter-clockwise degrees from 3 o'clock, y up
  return Math.atan2(-(e.clientY - g.cy), e.clientX - g.cx) * 180 / Math.PI;
}

function nearestHole(theta) {
  let best = null;
  for (let i = 1; i <= 10; i += 1) {
    let d = ((theta - holeAngle(i)) % 360 + 540) % 360 - 180;
    d = Math.abs(d);
    if (d < 17 && (!best || d < best.d)) best = { i, d };
  }
  return best ? best.i : null;
}

async function returnToRest() {
  const from = state.angle;
  if (from <= 0) return;
  const ms = state.motion ? (from / RETURN_SPEED) * 1000 : 0;
  setAngle(0, ms);
  if (!ms) return;
  // the governor's clicks on the way back
  const ticks = Math.max(1, Math.round(from / 30));
  for (let k = 0; k < ticks; k += 1) { play('tick'); await wait(ms / ticks); }
}

async function pullTo(i) {
  const target = travel(i);
  const ms = state.motion ? (target / PULL_SPEED) * 1000 : 0;
  setAngle(target, ms);
  await wait(ms + 60);
}

// ---------- dialing ----------

let dialing = false;

async function dial(i) {
  // i is 1..10; 10 means the "0" hole
  if (dialing) return;
  dialing = true;
  const key = i === 10 ? '0' : String(i);
  phone.classList.add('is-dialing');
  hold(`Dialing ${key}…`, 60000);
  await returnToRest();
  phone.classList.remove('is-dialing');
  await connect(key);
  dialing = false;
}

async function autoDial(i) {
  if (dialing || state.drag) return;
  dialing = true;
  const key = i === 10 ? '0' : String(i);
  phone.classList.add('is-dialing');
  hold(`Dialing ${key}…`, 60000);
  await pullTo(i);
  await returnToRest();
  phone.classList.remove('is-dialing');
  await connect(key);
  dialing = false;
}

async function connect(key) {
  const target = SECTIONS[key];
  play('ringback');
  await wait(state.motion ? 350 : 0);
  play('connect');
  phone.classList.add('is-off-hook');
  setTimeout(() => phone.classList.remove('is-off-hook'), 4200);
  if (target) {
    hold(`Connected — ${target.label}`, 4000);
    await wait(state.motion ? 250 : 0);
    goTo(target.id);
    return;
  }
  if (key === '0') { await callZac(); return; }
  hold(`${key} — not in service`, 2500);
}

function goTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ behavior: state.motion ? 'smooth' : 'auto', block: 'start' });
  history.replaceState(null, '', `#${id}`);
}

function openChat() {
  try {
    const lc = window.leadConnector;
    if (lc && lc.chatWidget && typeof lc.chatWidget.openWidget === 'function') { lc.chatWidget.openWidget(); return true; }
  } catch { /* fall through */ }
  const root = document.querySelector('chat-widget')?.shadowRoot;
  const btn = root && root.querySelector('.lc_text-widget--bubble, button, [role="button"]');
  if (btn) { btn.click(); return true; }
  return false;
}

async function callZac() {
  let opened = false;
  for (let k = 0; k < 6 && !opened; k += 1) { opened = openChat(); if (!opened) await wait(500); }
  if (opened) hold('Connected — Zac', 4000);
  else { hold('Chat unavailable — see Contact', 4000); goTo('contact'); }
}

// ---------- pointer handling on the wheel ----------

wheel.addEventListener('pointerdown', (e) => {
  if (dialing) return;
  const g = geometry();
  const dx = e.clientX - g.cx; const dy = e.clientY - g.cy;
  const dist = Math.hypot(dx, dy);
  if (dist < g.radius * 0.45 || dist > g.radius * 1.12) return;
  const theta = pointerAngle(e, g);
  const hole = nearestHole(theta);
  if (!hole) return;
  e.preventDefault();
  try { wheel.setPointerCapture(e.pointerId); } catch { /* synthetic or stale pointer */ }
  state.drag = { hole, startTheta: theta, max: travel(hole), t0: performance.now(), moved: 0, atStop: false };
  setAngle(0, 0);
  phone.classList.add('is-grabbed');
});

wheel.addEventListener('pointermove', (e) => {
  const d = state.drag;
  if (!d) return;
  const g = geometry();
  const theta = pointerAngle(e, g);
  let delta = d.startTheta - theta;             // clockwise is positive
  delta = ((delta % 360) + 540) % 360 - 180;    // -180..180
  if (delta < 0 && d.moved < 5) delta = 0;
  const angle = clamp(delta, 0, d.max);
  d.moved = Math.max(d.moved, angle);
  if (angle >= d.max - 1 && !d.atStop) { d.atStop = true; play('tick'); }
  if (angle < d.max - 1) d.atStop = false;
  setAngle(angle, 0);
});

function endDrag(e) {
  const d = state.drag;
  if (!d) return;
  state.drag = null;
  phone.classList.remove('is-grabbed');
  try { wheel.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  const quickTap = performance.now() - d.t0 < 300 && d.moved < 6;
  if (quickTap) { autoDial(d.hole); return; }
  if (state.angle >= d.max - 8) { dial(d.hole); return; }
  returnToRest();
}
wheel.addEventListener('pointerup', endDrag);
wheel.addEventListener('pointercancel', endDrag);
wheel.addEventListener('dragstart', (e) => e.preventDefault());

// ---------- directory buttons, keyboard, toggles ----------

dirButtons.forEach((btn) => btn.addEventListener('click', () => {
  const k = btn.dataset.key;
  autoDial(k === '0' ? 10 : Number(k));
}));

soundBtn.addEventListener('click', () => {
  state.sound = !state.sound; applyToggles();
  if (state.sound) play('connect');
  hold(state.sound ? 'Sound on' : 'Sound off', 1800);
});
motionBtn.addEventListener('click', () => {
  state.motion = !state.motion; applyToggles();
  hold(state.motion ? 'Motion on' : 'Motion off', 1800);
});

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (e.key === '*') { e.preventDefault(); soundBtn.click(); return; }
  if (e.key === '#') { e.preventDefault(); motionBtn.click(); return; }
  if (!/^[0-9]$/.test(e.key)) return;
  e.preventDefault();
  autoDial(e.key === '0' ? 10 : Number(e.key));
});

document.querySelectorAll('[data-press]').forEach((a) => {
  a.addEventListener('click', (ev) => { ev.preventDefault(); autoDial(a.dataset.press === '0' ? 10 : Number(a.dataset.press)); });
});

reduceQuery.addEventListener('change', (e) => { state.motion = !e.matches; applyToggles(); });

applyToggles();
startIdle();
