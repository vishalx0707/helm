// HELM landing — interactions
// Every DOM lookup is guarded: a missing element must never blank the page.

/* ── Nav scroll state ───────────────────────────────── */
const nav = document.getElementById('main-nav');
if (nav) {
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 40);
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── Mobile menu ────────────────────────────────────── */
const burger = document.getElementById('burger');
const mobileMenu = document.getElementById('mobile-menu');

function closeMobile() {
  burger && burger.classList.remove('open');
  mobileMenu && mobileMenu.classList.remove('open');
}
// exposed for the inline onclick="closeMobile()" handlers in the markup
window.closeMobile = closeMobile;

if (burger && mobileMenu) {
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });
}

/* ── Scroll reveals (.anim-in → .show) ──────────────── */
const revealEls = document.querySelectorAll('.anim-in');
if (revealEls.length) {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('show');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(el => io.observe(el));
    // Failsafe: nothing should ever stay hidden. If the observer hasn't
    // revealed an element within 3s, force it visible.
    setTimeout(() => revealEls.forEach(el => el.classList.add('show')), 3000);
  } else {
    // No observer support → just show everything.
    revealEls.forEach(el => el.classList.add('show'));
  }
}

/* ── Subtle parallax on scroll ──────────────────────── */
// Only run on desktop where performance is fine
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReduced && window.innerWidth > 900) {
  const heroGlow = document.querySelector('.hero-bg-glow');
  const phoneShell = document.querySelector('.phone-shell');
  const scrollHint = document.querySelector('.scroll-hint');

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (y > window.innerHeight) return; // don't compute past hero

    if (heroGlow) heroGlow.style.transform = `translateX(-50%) translateY(${y * 0.08}px)`;
    if (scrollHint) scrollHint.style.opacity = Math.max(0, 1 - y / 300);
  }, { passive: true });
}

/* ── Magnetic cursor effect on CTA buttons ──────────── */
if (!prefersReduced && window.innerWidth > 900) {
  document.querySelectorAll('.btn-main, .btn-ghost').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      btn.style.transform = `translateY(-2px) translate(${x * 0.08}px, ${y * 0.08}px)`;
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = '';
    });
  });
}

/* ── Counter animation for architecture section ─────── */
function animateCountUp(el, target, suffix = '') {
  let current = 0;
  const step = Math.max(1, Math.floor(target / 30));
  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = current + suffix;
  }, 30);
}

/* ── Phone clock ────────────────────────────────────── */
function formattedTime() {
  const now = new Date();
  let h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}
const phTime = document.getElementById('ph-time');
if (phTime) phTime.textContent = formattedTime();

/* ── Hero phone demo loop ───────────────────────────── */
const phBody = document.getElementById('ph-body');
const taskText = 'Add input validation to the login form';
const consoleSteps = [
  { text: '$ claude-code',                              status: 'INITIALIZING',  delay: 300,  type: 'dim' },
  { text: '✔ Scanning git repository',                  status: 'PLANNING',      delay: 800,  type: 'ok'  },
  { text: 'Found: src/components/LoginForm.js',         status: 'PLANNING',      delay: 1300, type: 'dim' },
  { text: '$ Analysing import dependencies…',           status: 'ANALYZING',     delay: 1800, type: 'dim' },
  { text: '✏ Applying patch to LoginForm.js',           status: 'APPLYING',      delay: 2400, type: 'ok'  },
  { text: '$ npm run test',                             status: 'TESTING',       delay: 3100, type: 'dim' },
  { text: '✔ Test suite passed (8 tests)',              status: 'COMPILING',     delay: 3800, type: 'ok'  },
  { text: '✔ Task completed successfully',              status: 'DONE',          delay: 4500, type: 'ok'  },
];

let typingTimer = null;
let stepTimers = [];
let originalBodyHTML = null;

function clearDemoTimers() {
  if (typingTimer) clearInterval(typingTimer);
  stepTimers.forEach(clearTimeout);
  stepTimers = [];
}

function runDemo() {
  if (!phBody) return;
  if (originalBodyHTML === null) originalBodyHTML = phBody.innerHTML;

  // Reset to the original chat layout each cycle.
  phBody.innerHTML = originalBodyHTML;
  phBody.style.opacity = '1';

  const typedTask = document.getElementById('typed-task');
  const phConsole = document.getElementById('ph-console');
  const phLines = document.getElementById('ph-lines');
  const phStatus = document.getElementById('ph-status-text');
  const phInput = document.getElementById('ph-input-label');

  if (!typedTask || !phConsole || !phLines || !phStatus || !phInput) return;

  clearDemoTimers();
  typedTask.textContent = '';
  phLines.innerHTML = '';
  phConsole.classList.remove('visible');
  phStatus.textContent = 'WAITING';
  phInput.textContent = 'Typing…';

  // 1) Type the task prompt.
  let i = 0;
  typingTimer = setInterval(() => {
    typedTask.textContent += taskText[i++];
    if (i >= taskText.length) {
      clearInterval(typingTimer);
      typingTimer = null;
      phInput.textContent = 'Deploying…';
      stepTimers.push(setTimeout(() => {
        phInput.textContent = 'Agent running…';
        phConsole.classList.add('visible');
        runConsole(phLines, phStatus);
      }, 900));
    }
  }, 50);
}

function runConsole(phLines, phStatus) {
  consoleSteps.forEach(step => {
    stepTimers.push(setTimeout(() => {
      phStatus.textContent = step.status;
      const line = document.createElement('div');
      line.className = 'c-line ' + (step.type === 'ok' ? 'c-ok' : 'c-dim');
      line.textContent = step.text;
      phLines.appendChild(line);
      phLines.scrollTop = phLines.scrollHeight;
      if (step.status === 'DONE') {
        stepTimers.push(setTimeout(showCompletion, 1000));
      }
    }, step.delay));
  });
}

function showCompletion() {
  if (!phBody) return;
  phBody.style.transition = 'opacity 0.35s ease';
  phBody.style.opacity = '0';

  stepTimers.push(setTimeout(() => {
    phBody.innerHTML = `
      <div class="ph-done">
        <div class="ph-done-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h3>Task Completed</h3>
        <p>Claude Code updated LoginForm.js in 42.1s.</p>
        <div class="ph-done-stats">
          <div class="ph-done-stat"><strong>+18 −4</strong><small>Diff lines</small></div>
          <div class="ph-done-stat"><strong>8</strong><small>Tests passed</small></div>
        </div>
        <div class="ph-done-restart">Restarting demo…</div>
      </div>`;
    phBody.style.opacity = '1';
    stepTimers.push(setTimeout(() => {
      phBody.style.opacity = '0';
      stepTimers.push(setTimeout(runDemo, 400));
    }, 3500));
  }, 350));
}

/* ── OS-aware download buttons ──────────────────────── */
function applyOSDownloads() {
  const ua = (navigator.userAgent || '').toLowerCase();
  const plat = (navigator.platform || '').toLowerCase();
  const base = 'https://github.com/vishalx0707/helm/releases/latest/download/';

  let label = 'Download for macOS';
  let href = base + 'helm-mac.zip';
  if (ua.includes('win') || plat.includes('win')) {
    label = 'Download for Windows';
    href = base + 'helm-setup.exe';
  } else if (ua.includes('linux') || plat.includes('linux')) {
    label = 'Download for Linux';
    href = base + 'helm.AppImage';
  }

  const dlIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17V3"/><path d="m5 10 7 7 7-7"/><path d="M19 21H5"/></svg>`;
  ['hero-dl-btn', 'cta-dl-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.innerHTML = dlIcon + ' ' + label;
      btn.setAttribute('href', href);
    }
  });
}

/* ── Smooth section scroll ──────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ── Boot ───────────────────────────────────────────── */
function boot() {
  applyOSDownloads();
  runDemo();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
