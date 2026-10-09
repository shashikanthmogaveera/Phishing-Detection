// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 20);
});

// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navMobile = document.getElementById('navMobile');
navToggle.addEventListener('click', () => navMobile.classList.toggle('open'));
navMobile.querySelectorAll('a').forEach(l => l.addEventListener('click', () => navMobile.classList.remove('open')));

// Scroll fade-up animations
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
}, { threshold: 0.12 });

document.querySelectorAll('.step-card,.feature-card,.dp-stat-card,.dp-chart-card,.dp-recent-card,.dp-ai-panel,.contact-block,.contact-form').forEach((el, i) => {
  el.classList.add('fade-up');
  el.style.transitionDelay = `${(i % 4) * 80}ms`;
  observer.observe(el);
});

// Animate signal bars
const sigObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('.signal-bar div').forEach(bar => {
        const w = bar.style.width; bar.style.width = '0';
        setTimeout(() => { bar.style.width = w; }, 150);
      });
      sigObs.unobserve(e.target);
    }
  });
}, { threshold: 0.3 });
document.querySelectorAll('.dp-ai-panel').forEach(el => sigObs.observe(el));

// ── Auth guard: update navbar + protect nav links ────────────────────────────
(function initIndexAuth() {
  const session      = JSON.parse(localStorage.getItem('cs_session')       || 'null');
  const adminSession = JSON.parse(localStorage.getItem('cs_admin_session') || 'null');

  const loginBtn  = document.querySelector('.nav-actions .btn-ghost');
  const signupBtn = document.querySelector('.nav-actions .btn-primary-sm');

  if (session || adminSession) {
    const name = session ? session.username : adminSession.name;
    if (loginBtn)  { loginBtn.textContent  = name; loginBtn.href = '#'; loginBtn.style.color = '#63b3ed'; }
    if (signupBtn) { signupBtn.textContent = 'Sign Out'; signupBtn.href = '#';
      signupBtn.addEventListener('click', e => {
        e.preventDefault();
        localStorage.removeItem('cs_session');
        localStorage.removeItem('cs_admin_session');
        location.reload();
      });
    }
  } else {
    if (loginBtn)  { loginBtn.href  = 'login.html';  }
    if (signupBtn) { signupBtn.href = 'signup.html'; }
  }

  // "Start Detection" hero button
  const startBtn = document.querySelector('.btn-primary[href="#"]');
  if (startBtn) {
    startBtn.href = (session || adminSession) ? 'detection.html' : 'login.html';
  }

  // Protect nav links that need auth
  document.querySelectorAll('[data-protected]').forEach(link => {
    link.addEventListener('click', e => {
      if (!session && !adminSession) {
        e.preventDefault();
        // Store where they wanted to go so we can redirect after login
        const dest = link.getAttribute('href');
        if (dest && dest !== '#') {
          sessionStorage.setItem('cs_redirect', dest);
        }
        showIndexAuthModal(dest);
      }
    });
  });
})();

function showIndexAuthModal(dest) {
  let o = document.querySelector('.modal-overlay');
  if (!o) {
    o = document.createElement('div'); o.className = 'modal-overlay';
    o.innerHTML = `<div class="modal-box">
      <div class="modal-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v7c0 5.5 4.3 10.7 8 12 3.7-1.3 8-6.5 8-12V6L12 2z" stroke="#63b3ed" stroke-width="1.5"/><path d="M9 12l2.5 2.5L15 9" stroke="#63b3ed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <h3>Sign In Required</h3>
      <p>You need to be signed in to access <strong style="color:#63b3ed">${dest && dest !== '#' ? dest.replace('.html','') : 'this feature'}</strong>.</p>
      <div class="modal-actions">
        <button class="modal-btn-ghost" id="mCancel">Cancel</button>
        <button class="modal-btn-primary" id="mLogin">Sign In</button>
        <button class="modal-btn-primary" id="mSignup" style="background:linear-gradient(135deg,#553c9a,#2b6cb0)">Sign Up</button>
      </div></div>`;
    document.body.appendChild(o);
    o.querySelector('#mCancel').onclick  = () => o.classList.remove('show');
    o.querySelector('#mLogin').onclick   = () => { window.location.href = 'login.html'; };
    o.querySelector('#mSignup').onclick  = () => { window.location.href = 'signup.html'; };
    o.addEventListener('click', e => { if (e.target === o) o.classList.remove('show'); });
  }
  requestAnimationFrame(() => o.classList.add('show'));
}

// ── Contact form → Formspree ─────────────────────────────────────────────────
const FORMSPREE_URL = 'https://formspree.io/f/mojrvyka';

const form = document.getElementById('contactForm');
if (form) {
  // Field refs
  const nameInput  = document.getElementById('cname');
  const emailInput = document.getElementById('cemail');
  const msgInput   = document.getElementById('cmsg');
  const submitBtn  = form.querySelector('button[type="submit"]');

  // Inline error helpers
  function setFieldError(input, msg) {
    input.classList.add('cf-invalid');
    let err = input.parentElement.querySelector('.cf-err');
    if (!err) { err = document.createElement('span'); err.className = 'cf-err'; input.parentElement.appendChild(err); }
    err.textContent = msg;
  }
  function clearFieldError(input) {
    input.classList.remove('cf-invalid');
    const err = input.parentElement.querySelector('.cf-err');
    if (err) err.textContent = '';
  }
  function validateForm() {
    let ok = true;
    if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
      setFieldError(nameInput, 'Please enter your name.'); ok = false;
    } else clearFieldError(nameInput);
    if (!emailInput.value.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value.trim())) {
      setFieldError(emailInput, 'Enter a valid email address.'); ok = false;
    } else clearFieldError(emailInput);
    if (!msgInput.value.trim() || msgInput.value.trim().length < 10) {
      setFieldError(msgInput, 'Message must be at least 10 characters.'); ok = false;
    } else clearFieldError(msgInput);
    return ok;
  }

  // Live clear errors on input
  [nameInput, emailInput, msgInput].forEach(el => {
    el.addEventListener('input', () => clearFieldError(el));
  });

  // Show status banner
  function showFormStatus(type, msg) {
    let banner = form.querySelector('.cf-status');
    if (!banner) { banner = document.createElement('div'); banner.className = 'cf-status'; form.prepend(banner); }
    banner.className = 'cf-status cf-status-' + type;
    banner.innerHTML = (type === 'success'
      ? '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5 6.5-7" stroke="#68d391" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 5v4M8 11v.5" stroke="#fc8181" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="8" r="6" stroke="#fc8181" stroke-width="1.3"/></svg>'
    ) + ' ' + msg;
    banner.style.display = 'flex';
    if (type === 'success') setTimeout(() => { banner.style.display = 'none'; }, 6000);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="cf-spinner"></span> Sending...';

    const payload = {
      name:    nameInput.value.trim(),
      email:   emailInput.value.trim(),
      message: msgInput.value.trim()
    };

    let backendOk = false;

    // 1. Try our own backend first
    try {
      await Api.sendContact(payload);
      backendOk = true;
    } catch (err) {
      // backend offline — fall through to Formspree
    }

    // 2. Always also send to Formspree (guaranteed delivery)
    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Formspree failed');
    } catch (err) {
      if (!backendOk) {
        showFormStatus('error', 'Network error. Check your connection and try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Message';
        return;
      }
    }

    showFormStatus('success', "Message sent! We'll respond within 24 hours.");
    form.reset();
    [nameInput, emailInput, msgInput].forEach(el => clearFieldError(el));
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Message';
  });
}