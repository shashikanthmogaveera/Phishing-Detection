$base = "C:\Users\amash\Desktop\PROJECT_6\AI-Powered Spam & Phishing Detection System"

# ── admin.js ─────────────────────────────────────────────────
$adminJs = '/* admin.js - CyberShield AI Admin Panel */

function getAdminSession() {
  return JSON.parse(localStorage.getItem("cs_admin_session") || "null");
}
function getUsers() {
  return JSON.parse(localStorage.getItem("cs_users") || "[]");
}

document.addEventListener("DOMContentLoaded", () => {
  const session = getAdminSession();
  if (!session) { window.location.href = "login.html"; return; }

  // Set admin name
  document.getElementById("adminName").textContent = session.name;
  document.getElementById("topAdminName").textContent = session.name;

  // Settings
  const si = document.getElementById("set-name");
  const se = document.getElementById("set-email");
  const sp = document.getElementById("set-phone");
  if (si) si.textContent = session.name;
  if (se) se.textContent = session.email;
  if (sp) sp.textContent = session.phone || "-";

  // Stats
  const users = getUsers();
  const su = document.getElementById("stat-users");
  const st = document.getElementById("stat-threats");
  const sf = document.getElementById("stat-phishing");
  if (su) su.textContent = users.length;
  if (st) st.textContent = (users.length * 3 + 12).toString();
  if (sf) sf.textContent = Math.floor(users.length * 1.2 + 5).toString();

  // Populate users table
  renderUsersTable(users);

  // Nav
  document.querySelectorAll(".ap-nav-item").forEach(item => {
    item.addEventListener("click", e => {
      e.preventDefault();
      const sec = item.getAttribute("data-section");
      switchSection(sec);
      document.querySelectorAll(".ap-nav-item").forEach(i => i.classList.remove("active"));
      item.classList.add("active");
    });
  });
});

function switchSection(name) {
  document.querySelectorAll(".ap-section").forEach(s => s.classList.remove("active"));
  const sec = document.getElementById("sec-" + name);
  if (sec) sec.classList.add("active");
  const titles = { dashboard:"Dashboard", users:"Users", detections:"Detection Log", analytics:"Analytics", settings:"Settings" };
  const subs = { dashboard:"System overview and key metrics", users:"All registered user accounts", detections:"Real-time threat detection log", analytics:"AI performance and signal analysis", settings:"Admin account configuration" };
  const t = document.getElementById("pageTitle");
  const s = document.getElementById("pageSub");
  if (t) t.textContent = titles[name] || name;
  if (s) s.textContent = subs[name] || "";
}

function renderUsersTable(users) {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;
  if (!users.length) { tbody.innerHTML = "<tr><td colspan=''6'' class=''ap-empty''>No users registered yet.</td></tr>"; return; }
  tbody.innerHTML = users.map((u, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong style="color:#e2e8f0">${u.username}</strong></td>
      <td>${u.email}</td>
      <td>${u.phone || "-"}</td>
      <td style="color:#4a5568;font-size:.75rem">Today</td>
      <td><span class="badge-safe">Active</span></td>
    </tr>`).join("");
}

function filterUsers() {
  const q = document.getElementById("userSearch").value.toLowerCase();
  const users = getUsers().filter(u =>
    u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  );
  renderUsersTable(users);
}

function adminLogout() {
  localStorage.removeItem("cs_admin_session");
  window.location.href = "index.html";
}'
[System.IO.File]::WriteAllText("$base\admin.js", $adminJs)
Write-Host "admin.js OK:" (Get-Item "$base\admin.js").Length
