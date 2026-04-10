# YallaDJ Media — Nursery Website Platform

A professional, bilingual (EN/AR) website template built specifically for nurseries and kindergartens in the UAE. Includes a full no-code admin panel for content management.

---

## Live Preview

> Hosted on Vercel — link coming soon.

---

## What's Inside

| File / Folder | Purpose |
|---|---|
| `index.html` | Sales landing page (public-facing) |
| `admin.html` | Admin control panel (password protected) |
| `css/style.css` | Landing page styles |
| `css/admin-style.css` | Admin panel styles (dark theme, neon lime) |
| `js/main.js` | Landing page logic + content loader |
| `js/admin.js` | Admin panel logic (login, editors, save/load) |
| `fonts/` | Handel Gothic (Latin + Arabic) |
| `images/` | Brand assets, logos, profile images |
| `nursery-api/` | **V2 backend** — Vercel serverless + Neon Postgres + Prisma (TypeScript) |

---

## Admin Panel

Access at `/admin.html` — password protected.

**Default password:** `yalladj2026`

### Sections you can edit (no code needed):

| # | Section | Status |
|---|---|---|
| 1 | Hero | ✅ Live |
| 2 | Pain Points | ✅ Live |
| 3 | Services | ✅ Live |
| 4 | Packages | 🔧 Coming (11D) |
| 5 | Process | 🔧 Coming (11E) |
| 6 | Why Choose Us | 🔧 Coming (11E) |
| 7 | Portfolio | 🔧 Coming (11F) |
| 8 | App Showcase | 🔧 Coming (11D) |
| 9 | Upsells | 🔧 Coming (11F) |
| 10 | Contact | 🔧 Coming (11F) |
| 11 | Footer | ✅ Live |
| 12 | General Settings | ✅ Live |

V1 content is saved to `localStorage`. V2 (in progress) migrates everything to a Neon Postgres backend — see `nursery-api/`.

---

## Tech Stack

- **Frontend:** Vanilla HTML + CSS + JavaScript (no frameworks)
- **Fonts:** Handel Gothic (Latin + Arabic via ITC)
- **Icons:** Bootstrap Icons (CDN)
- **Animations:** AOS (Animate on Scroll)
- **Storage:** localStorage (admin panel content)
- **Hosting:** Vercel (planned)
- **DNS:** Cloudflare

---

## Build Progress

### V1 — localStorage admin panel

| Step | Description | Status |
|---|---|---|
| 11A | Content schema + localStorage loader in main.js | ✅ Done |
| 11B | Admin login + sidebar + dashboard shell | ✅ Done |
| 11C | Hero, Pain Points, Services editors | ✅ Done |
| 11D | Packages editor + App Showcase section | ✅ Done |
| 11E | App Showcase, Process, Why Choose Us editors | ✅ Done |
| 11F | Portfolio, Upsells, Contact, Footer editors | ✅ Done |
| 11G | General Settings + Export/Import/Reset | ✅ Done |

### V2 — Cloud backend (`nursery-api/`)

| Phase | Description | Status |
|---|---|---|
| A1 | Prisma schema (11 resources, users/roles/sessions, audit_logs) | ✅ Done |
| A2 | Neon Postgres setup + schema deployed + contract_types seeded | ✅ Done |
| A3 | REST layer (@vercel/node) + audit helper + settings migration | ✅ Done |
| **B1** | **Auth system — password hashing, sessions, cookies, middleware** | ✅ **Done** |
| B2 | Login pages + `/api/auth/{login,logout,me}` | ⏳ Next |
| B3 | Role system (admin/manager/designer/sales) + permissions | ⏳ Planned |
| B4 | Admin-only employee invites via Resend | ⏳ Planned |
| B5 | Tag all mutations with `createdBy` / `updatedBy` | ⏳ Planned |
| C–F | Learning bot, Vercel deploy, AI agents, etc. | ⏳ Planned |

**B1 Auth System (this release)** — [`nursery-api/src/lib/`](nursery-api/src/lib/)
- `password.ts` — bcryptjs (cost 12) hash/verify + 8–128 char policy
- `auth.ts` — 256-bit session tokens, 30-day TTL, lazy expired-row GC, `revokeAllUserSessions` for "log out everywhere"
- `cookies.ts` — `HttpOnly; Secure; SameSite=Lax` session cookie (no signing — token is crypto-random + DB-validated)
- `http.ts` — `route()` wrapper auto-populates `req.user` before every handler; audit logs transparently pick up the actor
- Smoke tests: **48/48 passing** (10 password + 38 auth round-trip)

---

## Business

**YallaDJ Media FZE**
- Email: Support@yalladj.com
- Phone: +971 54 450 3515
- Location: UAE
