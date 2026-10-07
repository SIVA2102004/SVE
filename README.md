# ShopFlow – Secure Real-Time Shop Money Flow & Business Finance Management System

**ShopFlow** is a secure, real-time, production-ready financial management system built for retail stores, spare parts outlets, and small-to-medium businesses. It provides full control over cash, bank, and UPI liquidity, customer credit dues, dealer payables, staff salaries, EMIs, and expenses.

---

## 🌟 Key Capabilities & Architecture

1. **Integer Paise Architecture (Never Floating Point):**
   - All internal storage and arithmetic use integer paise (`1 Rupee = 100 Paise`), completely eliminating floating-point rounding errors.
   - Formatted using standard Indian numbering system (`₹1,00,000.00`).

2. **Atomic Financial Transactions & Idempotency:**
   - Every payment or receipt updates account balances and party ledgers inside database transactions (`prisma.$transaction`). If any step fails, the entire transaction rolls back.
   - Idempotency keys prevent duplicate payments from being submitted twice.

3. **Immutable Ledger & Audit Log:**
   - Completed transactions cannot be silently deleted.
   - Owner-only `VOID` functionality creates a reverse journal entry and records reasons for complete audit compliance.

4. **Multi-Role RBAC (Role-Based Access Control):**
   - **`OWNER`**: Full control over settings, accounts, voiding transactions, and viewing audit logs.
   - **`MANAGER`**: Manages customers, dealers, bills, attendance, and views reports.
   - **`STAFF`**: Day-to-day operations (record customer receipts, mark attendance, enter expenses).

5. **Real-Time WebSocket Updates:**
   - Socket.IO broadcasts updates on payment creation, voiding, and balance updates across connected devices instantaneously.

6. **Automated Salary Proration & Loan Amortization:**
   - Calculates monthly salary automatically based on calendar days, present count, and absences.
   - Amortization schedules for loans with principal and interest components and one-click installment payments.

7. **Receipts Vault & Instant PDF Statements:**
   - Upload invoices, bills, and tax receipts.
   - 1-click professional PDF receipt generation and WhatsApp reminders for customer outstanding balances.

---

## 🛠️ Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts, jsPDF, Axios, Socket.IO Client.
- **Backend:** Node.js, Express, TypeScript, Prisma ORM, Socket.IO, Multer, Helmet, Rate Limiter, bcryptjs, jsonwebtoken.
- **Database:** Relational schema configured with SQLite (`file:./shopflow.db`) for immediate zero-config execution (fully compatible with PostgreSQL for cloud deployment).

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js (v18+)
- npm

### 2. Backend Setup & Run
Open a terminal in `backend`:
```powershell
cd D:\SHOP\backend
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```
The backend server runs on `http://localhost:5000` with WebSocket support on port `5000`.

### 3. Frontend Setup & Run
Open a second terminal in `frontend`:
```powershell
cd D:\SHOP\frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🔑 Demo Credentials (Pre-seeded)

All demo accounts share the password: **`ShopFlow@123`**

| Role | Username | Email |
| :--- | :--- | :--- |
| **Owner (Admin)** | `owner` | `owner@shopflow.in` |
| **Manager** | `manager` | `manager@shopflow.in` |
| **Staff** | `staff` | `staff@shopflow.in` |

---

## 📱 Pages & Features

- **Dashboard:** Liquidity overview (Cash in hand, Bank balance, UPI), 7-day upcoming commitments, cash flow charts, and quick actions.
- **Money Flow:** Complete real-time transaction journal with filter and void mechanisms.
- **Customers (Receive):** Credit limits, outstanding receivables, payment recording, PDF receipts, and WhatsApp balance reminders.
- **Dealers (Pay):** Supplier bills, pending balances, and settlement payments.
- **Expenses:** Categorized overheads (electricity, tea, freight, maintenance, rent).
- **Staff & Salaries:** Daily attendance tracking and prorated salary payout calculations.
- **Loans & EMIs:** Loan tracking with complete installment amortization schedules.
- **Receipts Vault:** Document and invoice storage with direct proof preview.
- **Reminders:** Calendar reminders for GST, taxes, and supplier cutoff dates.
- **Reports & Statements:** Cash Flow statements, P&L reports, and CSV / PDF downloads.
- **Audit Logs:** System security trail tracking user activities, IP addresses, and void actions.
