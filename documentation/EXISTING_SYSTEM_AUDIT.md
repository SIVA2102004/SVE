# Existing System Audit – SVE 1.0 to SVE 2.0 Evolution
**Date**: November 2, 2026  
**System**: Sri Venkateswara Enterprises (SVE)  
**Role**: Principal Software Architect & QA Audit Team  

---

## 1. Executive Summary
The SVE application is a functional, production-deployed system managing automotive spare parts retail finances. The architecture comprises:
- **Frontend**: React 18 / Vite / Tailwind CSS / TypeScript / PWA hosted on **Vercel** (`https://svesve-git-main-siva2102004s-projects.vercel.app` & custom aliases).
- **Backend**: Node.js / Express / TypeScript / Prisma ORM / Socket.IO hosted on **Render** (`https://sve-filx.onrender.com`).
- **Database**: PostgreSQL hosted on **Supabase** via PgBouncer connection pooler (`aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true`) with direct connection fallback (`port 5432`).
- **State & Data Representation**: Integer paise for monetary values (1 INR = 100 paise), avoiding floating-point precision loss.

The existing system is stable, responsive on mobile/desktop, supports real-time multi-device synchronization via WebSockets, and possesses working Customer, Dealer, Staff, Transaction, and basic Loan/Insurance entities.

This audit evaluates the codebase to establish a baseline for evolving SVE into a unified **Personal, Family & Business Financial Management System** without breaking or regressing any existing features.

---

## 2. Frontend Inspection & Inventory

### 2.1 Route & Page Inventory
| Route | Page File | Status | Evaluation |
|---|---|---|---|
| `/login` | `src/pages/Login.tsx` | Fully functional | Secure JWT authentication, user registration with secret Access Code verification (`SVE-2026`), role caching in `localStorage`. |
| `/` | `src/pages/Dashboard.tsx` | Fully functional | Summarizes today's cash inflow, customer receivables, dealer payables, bank balance, net revenue, recent transactions, customer reminders. |
| `/money-flow` | `src/pages/MoneyFlow.tsx` | Fully functional | Transaction ledger listing all movements (Income, Expense, Payments). Filtering by date, category, type. Voiding capability. |
| `/customers` | `src/pages/Customers.tsx` | Fully functional | Customer cards, direct balance edit, add debit/bill with file upload (photo/PDF), payment receipt modal with PDF generation, dynamic UPI QR code generator, WhatsApp reminder link with scheduled weekday. |
| `/dealers` | `src/pages/Dealers.tsx` | Fully functional | Supplier cards, company name, collector person name, collection weekday/date schedule, purchase bill addition, partial payment tracking, full field editing. |
| `/expenses` | `src/pages/Expenses.tsx` | Fully functional | Direct expense logging, category breakdown, account assignment, recurring flag. |
| `/staff` | `src/pages/Staff.tsx` | Fully functional | Staff directory, daily attendance register (Present/Absent/Half-day/Leave), salary calculation engine with deductions/advances/overtime, salary payment. |
| `/loans` | `src/pages/Loans.tsx` | Partially implemented | Basic loan creation, EMI calculation, installment list, payment button. Lacks personal/family/business scope tagging and principal/interest ledger separation. |
| `/receipts` | `src/pages/Receipts.tsx` | Fully functional | Document repository (`DocumentReceipt`), category filters, file downloads/previews. |
| `/reminders` | `src/pages/Reminders.tsx` | Fully functional | Upcoming payment calendar, customer due reminders, dealer visit schedule. |
| `/reports` | `src/pages/Reports.tsx` | Implemented (needs expansion) | Cash flow summary, Profit & Loss report, date filtering, print & PDF export. Needs formal double-entry Balance Sheet, Trial Balance, and Personal Net Worth statements. |
| `/audit-logs` | `src/pages/AuditLogs.tsx` | Fully functional | Tracks user actions, transaction creation, voids, edits, IP address. |
| `/settings` | `src/pages/Settings.tsx` | Fully functional | Shop details, GSTIN, UPI ID, registered staff user list with delete capability, data backup download. |

### 2.2 Reusable Components & Hooks
- `src/components/Layout.tsx`: Responsive navigation shell with desktop sidebar, mobile header, 1-tap "Update App" service-worker refresh button, real-time sync status indicator, user drawer.
- `src/components/QuickAddModal.tsx`: Global shortcut modal to record fast income or expense from any page.
- `src/context/AuthContext.tsx`: Session hydration, login, registration, logout, role check.
- `src/context/SocketContext.tsx`: WebSocket client with automatic infinite reconnection, `sve_main` room subscription, and global `DATA_UPDATED` broadcast event listener.
- `src/utils/formatters.ts`: `formatINR(paise)` converting integer paise into standard Indian formatting (e.g., `₹55,912.00`).
- `src/api/client.ts`: Axios instance with JWT request interceptor, 401 unauthenticated redirect, and automated `/ping` keep-alive (every 3 minutes) preventing Render container hibernation.

### 2.3 PWA & Service Worker
- `public/manifest.json`: Mobile standalone PWA manifest with icons and theme colors.
- `public/sw.js`: Service worker version 4 utilizing a **Network-First** strategy for application assets and caching fallback for offline use, ensuring mobile devices immediately receive code updates on refresh without manual uninstallation.

---

## 3. Backend Architecture & Controller Inspection

### 3.1 Routing & Middleware
- `src/routes/apiRoutes.ts`: Central router mounting routes for Auth, Dashboard, Customers, Dealers, Transactions, Loans, Staff, Insurance, Reminders, Documents, Reports, and Audit Logs.
- `src/middleware/auth.ts`: JWT bearer token validation and `requireRoles('OWNER', 'MANAGER')` RBAC enforcement.
- `src/middleware/upload.ts`: Multer disk storage engine handling bill photos and PDF documents under `/uploads`.

### 3.2 Controllers & Business Logic
1. `customerController.ts`:
   - `getCustomers`: Fetches customers with total billed, total paid, pending balance, and weekly reminder day.
   - `createCustomerReceivable`: Accepts multipart form data with attached bill receipt (`req.file`), increments `pendingBalance`, creates `Receivable` and `DocumentReceipt`.
   - `recordCustomerPayment`: Atomic `$transaction` recording payment, reducing receivable and customer pending balance, crediting `PaymentMethodAccount`, generating receipt number, creating audit log, and firing WebSocket notification.
   - `updateCustomer`: Allows direct due balance correction along with customer profile fields.
2. `dealerController.ts`:
   - Handles supplier bills, partial payments, company name, collector details (`collectorName`, `collectionDay`, `collectionDate`), and balance updates.
3. `transactionController.ts`:
   - Handles manual income and expenses.
   - `voidTransaction`: Robust reversal mechanism that restores customer/dealer pending balances, reverses account balances, and logs audit events.
4. `loanController.ts`:
   - Basic amortization calculation via `calculateEMI(principal, rate, tenure)`. Generates monthly installments.
5. `staffController.ts`:
   - Calculates monthly salary based on daily wages or monthly base, adjusting for attendance, overtime, bonus, and advances.
6. `dashboardController.ts`:
   - Uses `Promise.all` for parallel aggregation of accounts, receivables, payables, today's transactions, and monthly statistics.

---

## 4. Database Schema Audit (Prisma / PostgreSQL)

### 4.1 Existing Models
- `User`: RBAC authentication (`OWNER`, `MANAGER`, `STAFF`).
- `Session`: Token management.
- `ShopSettings`: Business metadata, GSTIN, UPI ID, access code.
- `PaymentMethodAccount`: Asset accounts (`CASH`, `BANK`, `UPI`).
- `Customer`: Customer entity with `weeklyReminderDay`, `pendingBalance`, `totalBilled`, `totalPaid`.
- `Dealer`: Supplier entity with `companyName`, `collectorName`, `collectionDay`, `collectionDate`, `pendingBalance`.
- `Receivable` & `Payable`: Invoice-level tracking with attachment URLs.
- `Expense`: Categorized business expenses.
- `Transaction`: Unified transaction log with source/destination, status (`COMPLETED`, `VOID`), links to payment, expense, salary, or loan installment.
- `Payment`: Financial payment voucher linked to customer or dealer.
- `Staff`, `Attendance`, `SalaryRecord`: Payroll and attendance tracking.
- `Loan` & `LoanInstallment`: Loan and EMI schedule tracking.
- `InsurancePolicy`: Policy records with premium and renewal dates.
- `RecurringPayment` & `Reminder`: Scheduled commitments and alerts.
- `DocumentReceipt`: Document attachments metadata.
- `AuditLog`: Action tracking for financial governance.

### 4.2 Database Health & Safety Observations
- **Integer Paise Representation**: All monetary values (`amount`, `pendingBalance`, `currentBalance`) are stored as integers in paise, eliminating rounding bugs.
- **Datasource Configuration**: Uses `postgresql` provider targeting Supabase.
- **Migration Strategy**: Migrations must be non-destructive (`ALTER TABLE ADD COLUMN` with optional/default values). Existing customer, dealer, payment, and transaction records must never be dropped or overwritten.

---

## 5. Architectural Deficiencies & Evolution Requirements

1. **Absence of Scope Partitioning**:
   - Currently, all accounts and transactions belong implicitly to the single shop (`SVE Store`).
   - Need first-class `workspace` or `scope` (`PERSONAL`, `FAMILY`, `BUSINESS`) across accounts, transactions, expenses, loans, and assets.
2. **Double-Entry Accounting Engine**:
   - Currently, transactions use single-entry tracking with account balance increments/decrements.
   - To support audit-proof Balance Sheets, Trial Balances, and Owner Equity/Drawings tracking, a proper double-entry Journal Entry & Ledger model (`debitAccountId`, `creditAccountId` where Total Debits = Total Credits) must be integrated while maintaining backward compatibility with existing transactions.
3. **Insurance Management Expansion**:
   - The existing `InsurancePolicy` model is basic and shop-centric.
   - Needs expansion for personal life/health/vehicle policies (14+ policies), nominee tracking, premium payment transaction linkage, and frequency schedules.
4. **Chit Fund Management Module**:
   - Currently missing. Must support chit schemes, monthly installments, auction payouts, dividends, commissions, and non-expense accounting.
5. **Personal & Family Income/Expense Separation**:
   - Need dedicated personal income logging (salary, rental, drawings) and categorized household expenses without mixing them into the business P&L.
