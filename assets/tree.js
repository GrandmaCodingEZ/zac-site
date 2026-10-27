// A thin SVG tree in the left margin that grows as the page is scrolled.
// Trunk follows scroll progress through the sections; one branch per section boundary.
// Desktop only (the stylesheet hides it under 900px). No canvas, no library.

const svg = document.querySelector('.tree');
const main = document.getElementById('main');
const hero = document.getElementById('dialer');
const sections = [...document.querySelectorAll('main .sec')];

if (svg && main && sections.length) {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 84;
  let H = 0;
  let trunk;
  let trunkLen = 0;
  let branches = [];
  let ticking = false;

  function build() {
    H = window.innerHeight;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    branches = [];

    const x = 42;
    const bottom = H + 2;
    const top = Math.round(H * 0.08);

    // Trunk: a gentle S curve from the bottom edge up.
    trunk = document.createElementNS(NS, 'path');
    trunk.setAttribute('class', 'trunk');
    trunk.setAttribute('d', `M ${x} ${bottom} C ${x - 6} ${H * 0.7}, ${x + 6} ${H * 0.4}, ${x} ${top}`);
    svg.appendChild(trunk);
    trunkLen = trunk.getTotalLength();
    trunk.style.strokeDasharray = String(trunkLen);
    trunk.style.strokeDashoffset = String(trunkLen);

    // One branch per section, alternating sides, lowest branch first.
    const n = sections.length;
    const span = bottom - top;
    sections.forEach((_, i) => {
      const y = bottom - span * ((i + 1) / (n + 1));
      const dir = i % 2 === 0 ? -1 : 1;
      const len = 22 + (n - i) * 2;
      const tipX = x + dir * len;
      const tipY = y - len * 0.9;
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('class', 'branch');
      path.setAttribute('d',
        `M ${x} ${y} Q ${x + dir * len * 0.45} ${y - len * 0.25}, ${tipX} ${tipY}` +
        ` M ${x + dir * len * 0.5} ${y - len * 0.33} q ${dir * 4} ${-9}, ${dir * 3} ${-14}`);
      svg.appendChild(path);
      const l = path.getTotalLength();
      path.style.strokeDasharray = String(l);
      path.style.strokeDashoffset = String(l);
      branches.push(path);
    });
  }

  function update() {
    ticking = false;
    if (getComputedStyle(svg).display === 'none') return;

    const vh = window.innerHeight;
    const y = window.scrollY;
    const heroH = hero ? hero.offsetHeight : 0;
    svg.classList.toggle('is-visible', y > heroH * 0.6);

    const mainTop = main.offsetTop;
    const end = document.documentElement.scrollHeight - vh;
    const p = Math.min(1, Math.max(0, (y - mainTop + vh * 0.9) / Math.max(1, end - mainTop + vh * 0.9)));
    trunk.style.strokeDashoffset = String(trunkLen * (1 - p));

    sections.forEach((sec, i) => {
      const rect = sec.getBoundingClientRect();
      const on = rect.top < vh * 0.7;
      branches[i].style.strokeDashoffset = on ? '0' : branches[i].style.strokeDasharray;
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  build();
  update();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', () => { build(); update(); });
}
