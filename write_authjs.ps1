$base = "C:\Users\amash\Desktop\PROJECT_6\AI-Powered Spam & Phishing Detection System"

$js = '/* auth.js - CyberShield AI | User + Admin Auth */

const ADMIN_SECRET = "CYBER@ADMIN2025";

// ── Storage helpers ───────────────────────────────────────────
const $ = id => document.getElementById(id);
function getUsers()  { return JSON.parse(localStorage.getItem("cs_users")  || "[]"); }
function saveUsers(u){ localStorage.setItem("cs_users", JSON.stringify(u)); }
function getAdmins() { return JSON.parse(localStorage.getItem("cs_admins") || "[]"); }
function saveAdmins(a){ localStorage.setItem("cs_admins", JSON.stringify(a)); }
function setSession(user)  { localStorage.setItem("cs_session", JSON.stringify({ username: user.username, email: user.email })); }
function setAdminSession(a){ localStorage.setItem("cs_admin_session", JSON.stringify({ name: a.name, email: a.email, phone: a.phone })); }
function getSession()      { return JSON.parse(localStorage.getItem("cs_session") || "null"); }
function getAdminSession() { return JSON.parse(localStorage.getItem("cs_admin_session") || "null"); }
function clearSession()    { localStorage.removeItem("cs_session"); }

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type) {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; t.innerHTML = "<span class=''toast-dot''></span><span class=''toast-msg''></span>"; document.body.appendChild(t); }
  t.className = "toast " + (type || "success");
  t.querySelector(".toast-msg").textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 3200);
}

// ── Alert ─────────────────────────────────────────────────────
function showAlert(msg, type) { const b = $("alertBox"); if (!b) return; b.textContent = msg; b.className = "alert show " + (type || "error"); }
function clearAlert()         { const b = $("alertBox"); if (b) b.className = "alert"; }

// ── Field state ───────────────────────────────────────────────
function setError(id, eid, msg) { const i=$(id),e=$(eid); if(i){i.classList.add("invalid");i.classList.remove("valid")} if(e)e.textContent=msg; return false; }
function setValid(id, eid)      { const i=$(id),e=$(eid); if(i){i.classList.add("valid");i.classList.remove("invalid")} if(e)e.textContent=""; return true; }

// ── Validators ────────────────────────────────────────────────
function vName(val, id, eid) {
  if (!val || !val.trim()) return setError(id, eid, "Name is required.");
  if (val.trim().length < 2) return setError(id, eid, "At least 2 characters required.");
  if (!/^[a-zA-Z\s]+$/.test(val.trim())) return setError(id, eid, "Name must contain letters only.");
  return setValid(id, eid);
}
function vUsername(val, id, eid) {
  if (!val || !val.trim()) return setError(id, eid, "Username is required.");
  if (val.length < 3) return setError(id, eid, "At least 3 characters required.");
  if (!/^[a-zA-Z0-9_]+$/.test(val)) return setError(id, eid, "Only letters, numbers, and underscores.");
  return setValid(id, eid);
}
function vPhone(val, id, eid) {
  if (!val || !val.trim()) return setError(id, eid, "Phone number is required.");
  let c = val.replace(/[\s\-\(\)]/g, "");
  if (c.startsWith("+91")) c = c.slice(3);
  else if (c.startsWith("91") && c.length === 12) c = c.slice(2);
  if (!/^\d+$/.test(c)) return setError(id, eid, "Phone number must contain digits only.");
  if (c.length !== 10) return setError(id, eid, "Phone number must be exactly 10 digits.");
  if (!/^[6-9]/.test(c)) return setError(id, eid, "Must start with 6, 7, 8, or 9.");
  return setValid(id, eid);
}
function vEmail(val, id, eid) {
  if (!val || !val.trim()) return setError(id, eid, "Email address is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return setError(id, eid, "Enter a valid email address.");
  return setValid(id, eid);
}
function vPassword(val, id, eid) {
  if (!val) return setError(id, eid, "Password is required.");
  if (val.length < 8) return setError(id, eid, "Minimum 8 characters required.");
  if (!/[A-Z]/.test(val)) return setError(id, eid, "Include at least one uppercase letter.");
  if (!/[0-9]/.test(val)) return setError(id, eid, "Include at least one number.");
  return setValid(id, eid);
}
function vConfirm(val, pw, id, eid) {
  if (!val) return setError(id, eid, "Please confirm your password.");
  if (val !== pw) return setError(id, eid, "Passwords do not match.");
  return setValid(id, eid);
}
function vSecret(val, id, eid) {
  if (!val || !val.trim()) return setError(id, eid, "Secret code is required.");
  if (val.trim() !== ADMIN_SECRET) return setError(id, eid, "Invalid secret code.");
  return setValid(id, eid);
}

// ── Password strength ─────────────────────────────────────────
function updateStrength(val, barsId, labelId) {
  const bars = $(barsId), label = $(labelId);
  if (!bars || !label) return;
  let s = 0;
  if (val.length >= 8) s++;
  if (/[A-Z]/.test(val) && /[a-z]/.test(val)) s++;
  if (/[0-9]/.test(val)) s++;
  if (/[^A-Za-z0-9]/.test(val)) s++;
  bars.className = "pw-bars" + (val ? " s" + s : "");
  const ls = ["","Weak","Fair","Good","Strong"];
  const cs = ["","#fc8181","#f6ad55","#63b3ed","#68d391"];
  label.textContent = val ? ls[s] : "Strength";
  label.style.color = val ? cs[s] : "#4a5568";
}

// ── Toggle password ───────────────────────────────────────────
function togglePw(inputId, btn) {
  const inp = $(inputId); if (!inp) return;
  const show = inp.type === "password";
  inp.type = show ? "text" : "password";
  btn.innerHTML = show
    ? "<svg width=''16'' height=''16'' viewBox=''0 0 16 16'' fill=''none''><path d=''M2 2l12 12M6.5 6.6A2 2 0 009.4 9.5M4.2 4.3C2.8 5.3 1.7 6.6 1 8c1.3 2.8 4.2 5 7 5 1.2 0 2.4-.3 3.4-.9M7 3.1C7.3 3 7.7 3 8 3c2.8 0 5.7 2.2 7 5-.5 1-1.2 2-2.1 2.7'' stroke=''currentColor'' stroke-width=''1.3'' stroke-linecap=''round''/></svg>"
    : "<svg width=''16'' height=''16'' viewBox=''0 0 16 16'' fill=''none''><path d=''M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z'' stroke=''currentColor'' stroke-width=''1.3''/><circle cx=''8'' cy=''8'' r=''2'' stroke=''currentColor'' stroke-width=''1.3''/></svg>";
}

// ── Role tab switcher ─────────────────────────────────────────
function switchRole(role, page) {
  document.querySelectorAll(".role-tab").forEach(t => t.classList.toggle("active", t.dataset.role === role));
  clearAlert();
  const isAdmin = role === "admin";
  const title = $("formTitle"), sub = $("formSubtitle");
  if (page === "signup") {
    $("userSignupForm").style.display  = isAdmin ? "none" : "";
    $("adminSignupForm").style.display = isAdmin ? "" : "none";
    if (title) title.textContent = isAdmin ? "Create admin account" : "Create your account";
    if (sub)   sub.textContent   = isAdmin ? "Admin access requires a valid secret code." : "Join CyberShield AI to start detecting threats.";
  } else {
    $("userLoginForm").style.display  = isAdmin ? "none" : "";
    $("adminLoginForm").style.display = isAdmin ? "" : "none";
    if (title) title.textContent = isAdmin ? "Admin sign in" : "Welcome back";
    if (sub)   sub.textContent   = isAdmin ? "Sign in with your admin credentials and secret code." : "Sign in to your CyberShield AI account.";
  }
}

// ── Loading ───────────────────────────────────────────────────
function setLoading(formId, on) {
  const form = $(formId); if (!form) return;
  const btn = form.querySelector("button[type=submit]");
  const txt = btn && btn.querySelector(".btn-text");
  const spin = btn && btn.querySelector(".btn-spinner");
  if (btn) btn.disabled = on;
  if (txt) txt.style.opacity = on ? "0.5" : "1";
  if (spin) spin.classList.toggle("show", on);
}

// ── Phone input filter ────────────────────────────────────────
function initPhoneInput(id) {
  const el = $(id); if (!el) return;
  el.setAttribute("maxlength", "15");
  el.addEventListener("keypress", e => { if (!/[\d\+\s\-]/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); });
  el.addEventListener("input", () => { el.value = el.value.replace(/[^0-9\+\s\-]/g, ""); });
}

// ── Live validation wiring ────────────────────────────────────
function wire(id, eid, fn) {
  const el = $(id); if (!el) return;
  el.addEventListener("blur",  () => fn(el.value));
  el.addEventListener("input", () => { fn(el.value); clearAlert(); });
}

// ══════════════════════════════════════════════════════════════
//  SIGNUP PAGE
// ══════════════════════════════════════════════════════════════
function initSignup() {
  if (getSession() || getAdminSession()) { window.location.href = getAdminSession() ? "admin.html" : "index.html"; return; }

  initPhoneInput("u_phone");
  initPhoneInput("a_phone");

  // User form live validation
  wire("u_username", "u_usernameErr", v => vUsername(v, "u_username", "u_usernameErr"));
  wire("u_phone",    "u_phoneErr",    v => vPhone(v, "u_phone", "u_phoneErr"));
  wire("u_email",    "u_emailErr",    v => vEmail(v, "u_email", "u_emailErr"));
  wire("u_password", "u_passwordErr", v => { vPassword(v, "u_password", "u_passwordErr"); updateStrength(v, "u_pwBars", "u_pwLabel"); });
  wire("u_confirm",  "u_confirmErr",  v => vConfirm(v, $("u_password") ? $("u_password").value : "", "u_confirm", "u_confirmErr"));

  // Admin form live validation
  wire("a_name",     "a_nameErr",     v => vName(v, "a_name", "a_nameErr"));
  wire("a_email",    "a_emailErr",    v => vEmail(v, "a_email", "a_emailErr"));
  wire("a_phone",    "a_phoneErr",    v => vPhone(v, "a_phone", "a_phoneErr"));
  wire("a_password", "a_passwordErr", v => { vPassword(v, "a_password", "a_passwordErr"); updateStrength(v, "a_pwBars", "a_pwLabel"); });
  wire("a_secret",   "a_secretErr",   v => vSecret(v, "a_secret", "a_secretErr"));

  // User signup submit
  const uForm = $("userSignupForm");
  if (uForm) uForm.addEventListener("submit", e => {
    e.preventDefault(); clearAlert();
    const username = $("u_username").value.trim();
    const phone    = $("u_phone").value.trim();
    const email    = $("u_email").value.trim();
    const password = $("u_password").value;
    const confirm  = $("u_confirm").value;
    const ok = [
      vUsername(username, "u_username", "u_usernameErr"),
      vPhone(phone, "u_phone", "u_phoneErr"),
      vEmail(email, "u_email", "u_emailErr"),
      vPassword(password, "u_password", "u_passwordErr"),
      vConfirm(confirm, password, "u_confirm", "u_confirmErr"),
    ].every(Boolean);
    if (!ok) return;
    const users = getUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return showAlert("Username already taken.");
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) return showAlert("An account with this email already exists.");
    setLoading("userSignupForm", true);
    setTimeout(() => {
      users.push({ username, phone, email, password });
      saveUsers(users);
      setSession({ username, email });
      showToast("Account created! Redirecting...", "success");
      setTimeout(() => { window.location.href = "index.html"; }, 1400);
    }, 900);
  });

  // Admin signup submit
  const aForm = $("adminSignupForm");
  if (aForm) aForm.addEventListener("submit", e => {
    e.preventDefault(); clearAlert();
    const name     = $("a_name").value.trim();
    const email    = $("a_email").value.trim();
    const phone    = $("a_phone").value.trim();
    const password = $("a_password").value;
    const secret   = $("a_secret").value.trim();
    const ok = [
      vName(name, "a_name", "a_nameErr"),
      vEmail(email, "a_email", "a_emailErr"),
      vPhone(phone, "a_phone", "a_phoneErr"),
      vPassword(password, "a_password", "a_passwordErr"),
      vSecret(secret, "a_secret", "a_secretErr"),
    ].every(Boolean);
    if (!ok) return;
    const admins = getAdmins();
    if (admins.find(a => a.email.toLowerCase() === email.toLowerCase())) return showAlert("An admin account with this email already exists.");
    setLoading("adminSignupForm", true);
    setTimeout(() => {
      admins.push({ name, email, phone, password, secret });
      saveAdmins(admins);
      setAdminSession({ name, email, phone });
      showToast("Admin account created!", "success");
      setTimeout(() => { window.location.href = "admin.html"; }, 1400);
    }, 900);
  });
}

// ══════════════════════════════════════════════════════════════
//  LOGIN PAGE
// ══════════════════════════════════════════════════════════════
function initLogin() {
  if (getAdminSession()) { window.location.href = "admin.html"; return; }
  if (getSession())      { window.location.href = "index.html"; return; }

  // User form live validation
  wire("u_username", "u_usernameErr", v => vUsername(v, "u_username", "u_usernameErr"));
  wire("u_email",    "u_emailErr",    v => vEmail(v, "u_email", "u_emailErr"));
  wire("u_password", "u_passwordErr", v => { if (!v) setError("u_password","u_passwordErr","Password is required."); else setValid("u_password","u_passwordErr"); });

  // Admin form live validation
  wire("a_name",     "a_nameErr",     v => vName(v, "a_name", "a_nameErr"));
  wire("a_email",    "a_emailErr",    v => vEmail(v, "a_email", "a_emailErr"));
  wire("a_password", "a_passwordErr", v => { if (!v) setError("a_password","a_passwordErr","Password is required."); else setValid("a_password","a_passwordErr"); });
  wire("a_secret",   "a_secretErr",   v => vSecret(v, "a_secret", "a_secretErr"));

  // User login submit
  const uForm = $("userLoginForm");
  if (uForm) uForm.addEventListener("submit", e => {
    e.preventDefault(); clearAlert();
    const username = $("u_username").value.trim();
    const email    = $("u_email").value.trim();
    const password = $("u_password").value;
    const okU = vUsername(username, "u_username", "u_usernameErr");
    const okE = vEmail(email, "u_email", "u_emailErr");
    const okP = password ? setValid("u_password","u_passwordErr") : setError("u_password","u_passwordErr","Password is required.");
    if (!okU || !okE || !okP) return;
    setLoading("userLoginForm", true);
    setTimeout(() => {
      const user = getUsers().find(u => u.username.toLowerCase() === username.toLowerCase() && u.email.toLowerCase() === email.toLowerCase() && u.password === password);
      if (!user) { setLoading("userLoginForm", false); return showAlert("Invalid credentials. Please check your details."); }
      setSession(user);
      showToast("Welcome back, " + user.username + "!", "success");
      setTimeout(() => { window.location.href = "index.html"; }, 1200);
    }, 900);
  });

  // Admin login submit
  const aForm = $("adminLoginForm");
  if (aForm) aForm.addEventListener("submit", e => {
    e.preventDefault(); clearAlert();
    const name     = $("a_name").value.trim();
    const email    = $("a_email").value.trim();
    const password = $("a_password").value;
    const secret   = $("a_secret").value.trim();
    const okN = vName(name, "a_name", "a_nameErr");
    const okE = vEmail(email, "a_email", "a_emailErr");
    const okP = password ? setValid("a_password","a_passwordErr") : setError("a_password","a_passwordErr","Password is required.");
    const okS = vSecret(secret, "a_secret", "a_secretErr");
    if (!okN || !okE || !okP || !okS) return;
    setLoading("adminLoginForm", true);
    setTimeout(() => {
      const admin = getAdmins().find(a => a.name.toLowerCase() === name.toLowerCase() && a.email.toLowerCase() === email.toLowerCase() && a.password === password && a.secret === secret);
      if (!admin) { setLoading("adminLoginForm", false); return showAlert("Invalid admin credentials or secret code."); }
      setAdminSession(admin);
      showToast("Welcome, Admin " + admin.name + "!", "success");
      setTimeout(() => { window.location.href = "admin.html"; }, 1200);
    }, 900);
  });
}

// ══════════════════════════════════════════════════════════════
//  AUTH GUARD (index.html)
// ══════════════════════════════════════════════════════════════
function initAuthGuard() {
  updateNavbar(getSession());
  document.querySelectorAll("[data-protected]").forEach(link => {
    link.addEventListener("click", e => {
      if (!getSession() && !getAdminSession()) { e.preventDefault(); showAuthModal(); }
    });
  });
}

function updateNavbar(session) {
  const loginBtn  = document.querySelector(".nav-login");
  const signupBtn = document.querySelector(".nav-signup");
  const userMenu  = document.querySelector(".nav-user");
  if (session) {
    if (loginBtn)  loginBtn.style.display  = "none";
    if (signupBtn) signupBtn.style.display = "none";
    if (userMenu) { userMenu.style.display = "flex"; const n = userMenu.querySelector(".nav-username"); if (n) n.textContent = session.username; }
  } else {
    if (loginBtn)  loginBtn.style.display  = "";
    if (signupBtn) signupBtn.style.display = "";
    if (userMenu)  userMenu.style.display  = "none";
  }
}

function showAuthModal() {
  let o = document.querySelector(".modal-overlay");
  if (!o) {
    o = document.createElement("div"); o.className = "modal-overlay";
    o.innerHTML = `<div class="modal-box"><div class="modal-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v7c0 5.5 4.3 10.7 8 12 3.7-1.3 8-6.5 8-12V6L12 2z" stroke="#63b3ed" stroke-width="1.5"/><path d="M9 12l2.5 2.5L15 9" stroke="#63b3ed" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h3>Authentication Required</h3><p>You need to be signed in to access this feature.</p><div class="modal-actions"><button class="modal-btn-ghost" id="mCancel">Cancel</button><button class="modal-btn-primary" id="mLogin">Sign In</button><button class="modal-btn-primary" id="mSignup" style="background:linear-gradient(135deg,#553c9a,#2b6cb0)">Sign Up</button></div></div>`;
    document.body.appendChild(o);
    o.querySelector("#mCancel").onclick = () => o.classList.remove("show");
    o.querySelector("#mLogin").onclick  = () => { window.location.href = "login.html"; };
    o.querySelector("#mSignup").onclick = () => { window.location.href = "signup.html"; };
    o.addEventListener("click", e => { if (e.target === o) o.classList.remove("show"); });
  }
  requestAnimationFrame(() => o.classList.add("show"));
}

function logout() {
  clearSession();
  window.location.href = "index.html";
}'
[System.IO.File]::WriteAllText("$base\auth.js", $js)
Write-Host "auth.js OK:" (Get-Item "$base\auth.js").Length
