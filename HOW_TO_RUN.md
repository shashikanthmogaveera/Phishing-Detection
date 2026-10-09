# CyberShield AI — How to Run

## Start the Backend Server

```bash
cd server
node index.js
```

The server starts at **http://localhost:3001**

- Frontend: http://localhost:3001/index.html
- Admin Panel: http://localhost:3001/admin.html
- API base: http://localhost:3001/api

> **After any backend change, stop and restart `node index.js`.**

---

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/signup` | No | Register user or admin |
| POST | `/api/auth/login` | No | Login user or admin |

### Detections (permanent — cannot be cleared)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/detections` | JWT | Save a scan result |
| GET | `/api/detections` | JWT | Get user's full scan history |
| GET | `/api/detections/stats` | JWT | Today's scan stats |

### Admin Dashboard
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/users` | Admin JWT | All registered users |
| GET | `/api/admin/stats` | Admin JWT | Platform-wide stats |
| GET | `/api/admin/stats/today` | Admin JWT | Today's verdict breakdown (pie chart) |
| GET | `/api/admin/stats/monthly` | Admin JWT | Last 6 months trend (bar chart) |
| GET | `/api/admin/detections` | Admin JWT | All detections log |

### Admin Support Center
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/support/stats` | Admin JWT | Ticket KPI counts |
| GET | `/api/admin/support/tickets` | Admin JWT | All tickets (with filters) |
| GET | `/api/admin/support/tickets/:id` | Admin JWT | Single ticket + messages |
| POST | `/api/admin/support/tickets/:id/reply` | Admin JWT | Admin reply to ticket |
| PATCH | `/api/admin/support/tickets/:id/status` | Admin JWT | Update status / priority |
| POST | `/api/admin/support/blacklist` | Admin JWT | Add domain to global blocklist |
| GET | `/api/admin/support/intelligence` | Admin JWT | Threat intelligence data |

### User Support
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/support/tickets` | JWT | Create support ticket |
| GET | `/api/support/tickets` | JWT | Get user's tickets |
| GET | `/api/support/tickets/:id` | JWT | Single ticket + messages |
| POST | `/api/support/tickets/:id/messages` | JWT | Send reply |
| PATCH | `/api/support/tickets/:id/status` | JWT | Close / reopen ticket |
| GET | `/api/support/stats` | JWT | User's ticket stats |

### Other
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/contact` | No | Submit contact message |
| GET | `/api/health` | No | Server health check |

---

## Database

SQLite database stored at `server/cybershield.db` — created automatically on first run.

All detection history and support tickets are **permanent** and tied to each user account. They cannot be deleted by users.

---

## Timestamps

All timestamps are stored as **ISO 8601 strings** (`new Date().toISOString()`) by Node.js directly — not by SQLite's `datetime('now')` — so they are consistent regardless of server timezone.

The frontend displays timestamps as: `"5 min ago · 10:35 AM"` and refreshes every 60 seconds automatically.

---

## Environment Variables (`server/.env`)

```
PORT=3001
JWT_SECRET=cybershield_jwt_secret_2025_change_in_production
ADMIN_SECRET=CYBER@ADMIN2025
```

---

## Architecture

```
Frontend (HTML/CSS/JS)
    ├── api.js           ← API client with all endpoint methods
    ├── auth.js          ← Auth + session management
    ├── admin.js         ← Admin dashboard + Support Center SOC
    ├── support.js       ← User support ticket portal
    ├── history.js       ← Detection history (permanent)
    ├── detection.js     ← Real-time threat scanner
    ├── chatbot.js       ← AI chat assistant
    └── app.js           ← Landing page

Backend (Node.js + Express + SQLite via sql.js)
    server/
    ├── index.js         ← Express entry point
    ├── db.js            ← SQLite setup (all tables)
    ├── .env             ← Environment config
    ├── middleware/
    │   └── auth.js      ← JWT verification (requireAuth / requireAdmin)
    └── routes/
        ├── auth.js      ← Signup / Login
        ├── detections.js ← Scan history (permanent)
        ├── admin.js     ← Admin dashboard + Support Center endpoints
        ├── support.js   ← User support tickets
        ├── chat.js      ← Chatbot sessions
        ├── blocklist.js ← Sender blacklist
        └── contact.js   ← Contact form
```
