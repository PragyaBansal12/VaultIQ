# VaultIQ: AI-Powered Expense & Budget Management Platform

VaultIQ is a full-stack web application for tracking expenses and income, setting monthly category budgets, viewing analytics and reports, scanning receipts, managing subscriptions, and getting AI-generated financial insights from your own data.

## Team

| Name | Reg. No. | Role | GitHub |
|---|---|---|---|
| Pragya Bansal (Team Leader) | 20243208 | Backend: config, middleware, auth / budget / AI modules | [PragyaBansal12](https://github.com/PragyaBansal12) |
| Nihira Raj | 20243180 | Backend: Prisma schema and database, expense / OCR / subscription modules | [nihira91](https://github.com/nihira91) |
| Meenakshi Choudhary | 20243166 | Frontend: Dashboard, Expenses, Budgets, Analytics, AI Assistant, Forgot Password, Help Center | [M-eena-kshi](https://github.com/M-eena-kshi) |
| Pranav Pandey | 20243210 | Frontend: Login, Signup, Reset Password, Notifications, Reports, Settings, Subscriptions | [PranavPandey5955](https://github.com/PranavPandey5955) |

Course: Software Engineering and Project Management, Group 3, Section D.

## Architecture and Evolution

The first prototype used **MongoDB** for flexible, fast experimentation. Money data needs strict integrity (a budget belongs to exactly one user, category and month; deleting a user must delete their records; monthly totals are sums over rows), so the storage layer was migrated to **PostgreSQL** (hosted on Aiven) with **Prisma** as the ORM. Foreign keys with cascade delete, a unique constraint on `(userId, category, month)` for budgets, and indexes on the columns used by queries keep the data consistent and the aggregations fast.

```text
  React 19 + Vite (SPA, React Router, Tailwind, Recharts, jsPDF)
                       |  REST / JSON + Bearer JWT   (Vite proxies /api)
                       v
  Node.js + Express 5   (helmet, cors, morgan, multer, protect middleware)
     authController | expenseController | budgetController
     subscriptionController | ocrController | aiController
                       |                          |
                       v                          v
  Prisma + pg pool (SSL)                 External services
  PostgreSQL (Aiven)                     Google Gemini API (receipt vision, AI coach)
                                         SMTP via Nodemailer (password-reset e-mail)
```

## Features

**Authentication and security**
- Sign up, log in, forgot password and reset password (one-time link valid 15 minutes, stored as a SHA-256 hash)
- Passwords hashed with `bcryptjs`; JWT sessions valid 30 days
- Protected API routes (`protect` middleware) and protected front-end pages; `helmet` security headers

**Expenses and income**
- Add expenses and income with category, merchant, date and notes
- List, delete one, or delete all transactions; every query is filtered by the logged-in user
- Receipt upload: Gemini vision reads the image and pre-fills the Add Expense form (the uploaded file is deleted after processing)

**Budgets**
- One monthly limit per category (create or update, list, delete)
- Overspend check whenever an expense is added

**Analytics and reports**
- Category distribution, budget-vs-actual and monthly trend charts (Recharts)
- Reports for a date range with summary, top expenses and a detailed table, exportable as CSV and PDF

**AI Assistant (Google Gemini, with a rule-based fallback)**
- Financial health score, forecast and anomaly alerts
- Coach chat that answers from a live summary of your income, expenses and budgets
- Savings simulator: reduce a category by a percentage and see the monthly and yearly saving

**Subscriptions**
- Add, edit, pause or cancel and delete recurring payments; renewal timeline

**Other**
- Notifications page (built from your budgets and expenses; read state kept in the browser)
- Settings: profile, theme, accent colour, alert and AI preferences
- Help Center with FAQ and guides

## Not implemented yet / known limitations

- Editing an existing expense (no update endpoint yet)
- E-mail alerts for exceeded budgets, upcoming renewals and monthly summaries (planned)
- The Dashboard "Transfer" form is a visual prototype and does not save anything
- AI chat history and OCR scan history tables exist in the schema but are not used yet
- Amounts are stored as floating-point numbers (decimal type is future work)
- Security hardening still to do: CORS allow-list, rate limiting, certificate verification for the database connection

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 8, React Router 7, Tailwind CSS 3, Recharts 3, jsPDF + autotable |
| Backend | Node.js, Express 5, helmet, cors, morgan, multer, Nodemailer |
| Auth | bcryptjs, jsonwebtoken |
| Database | PostgreSQL (Aiven), Prisma 7 with `@prisma/adapter-pg` and a `pg` pool |
| AI / OCR | Google Gemini via `@google/genai` |

## API Overview

All routes except health, register, login, forgot-password and reset-password need `Authorization: Bearer <token>`.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/update`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password/:token` |
| Expenses | `GET /api/expenses`, `POST /api/expenses`, `DELETE /api/expenses/:id`, `DELETE /api/expenses` |
| Budgets | `GET /api/budgets`, `POST /api/budgets`, `DELETE /api/budgets/:id`, `DELETE /api/budgets` |
| Subscriptions | `GET /api/subscriptions`, `POST /api/subscriptions`, `PUT /api/subscriptions/:id`, `DELETE /api/subscriptions/:id` |
| OCR | `POST /api/ocr/process` (multipart field `receipt`) |
| AI | `GET /api/ai/insights`, `POST /api/ai/chat`, `POST /api/ai/simulate` |

## Getting Started

**Prerequisites:** Node.js 18+ (tested with 22), a PostgreSQL database reachable over SSL, a Google Gemini API key, and SMTP credentials (for password-reset e-mails).

### 1. Backend

```bash
cd backend
cp .env.example .env     # then fill in the values
npm install
npx prisma generate
npx prisma db push       # creates the tables (the repo has no migrations)
npm run dev              # API on http://localhost:<PORT>
```

Environment variables (see `.env.example` for the exact names): `PORT`, `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, the SMTP settings, and `FRONTEND_URL` (used in the reset-password link, default `http://localhost:5173`).

### 2. Frontend

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

The Vite dev server proxies `/api` to the backend. Make sure the proxy target in `frontend/vite.config.js` uses the same port as `PORT` in `backend/.env`.

## Project Structure

```text
backend/
  index.js              Express app, security middleware, routes
  config/prismaClient.js
  controllers/          auth, expense, budget, subscription, ocr, ai
  routes/
  middleware/authMiddleware.js
  prisma/schema.prisma  User, Expense, Budget, Subscription (+ unused ChatMessage, OcrScan, Category)
frontend/
  src/App.jsx           routes
  src/pages/            Login, Signup, Dashboard, Expenses, Budgets, Analytics,
                        AIAssistant, Reports, Subscriptions, Notifications,
                        Settings, HelpCenter, ForgotPassword, ResetPassword
```

## Security Notes

- Never commit `.env`; only `.env.example` belongs in the repository.
- AI and OCR output can be wrong; VaultIQ gives information, not financial advice.

## License

[Add a license if required by your course.]
