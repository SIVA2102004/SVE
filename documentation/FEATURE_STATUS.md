# Feature Status Matrix – SVE 1.0 to SVE 2.0
**Evaluation Date**: November 2, 2026  

---

## 1. Feature Classification

| Domain | Feature | Current Status | Notes & SVE 2.0 Plan |
|---|---|---|---|
| **Auth & Security** | JWT Authentication & Session Lockout | **Fully implemented & tested** | Login, access code verification, role checks (`OWNER`, `MANAGER`, `STAFF`). |
| **Auth & Security** | Personal / Family / Business RBAC | **Not implemented** | Needs workspace-level authorization to protect private personal data from staff. |
| **Customers** | Customer Directory & Balance Tracking | **Fully implemented & tested** | Real-time balance calculations, mobile-responsive cards. |
| **Customers** | Add Bill with File Attachment (Photo/PDF) | **Fully implemented & tested** | Integrated with Multer; uploaded to `/uploads` and logged in `DocumentReceipt`. |
| **Customers** | Direct Due Balance Correction | **Fully implemented & tested** | Added to edit modal; fixes ledger discrepancies cleanly. |
| **Customers** | WhatsApp Reminders & Scheduled Weekday | **Fully implemented & tested** | Generates direct wa.me link with scheduled weekday reminder and pending balance. |
| **Customers** | Dynamic UPI QR Code Generation | **Fully implemented & tested** | Pre-fills exact customer pending due; supports direct payment link sharing. |
| **Dealers** | Supplier Directory & Balance Tracking | **Fully implemented & tested** | Outstanding balance cards, mobile cards, edit/delete actions. |
| **Dealers** | Company Name & Collector Person Details | **Fully implemented & tested** | Stores `companyName`, `collectorName`, `collectionDay`, `collectionDate`. |
| **Dealers** | Purchase Bills & Outbound Payments | **Fully implemented & tested** | Tracks invoices, partial payments, payment accounts, and UTR/cheque references. |
| **Accounts** | Cash, Bank, Shop UPI Multi-Account | **Fully implemented & tested** | Tracks current balances in paise across register, bank accounts, and merchant UPI. |
| **Accounts** | Inter-Account & Personal Drawings Transfers | **Partially implemented** | Bank transfers exist; need non-income/non-expense accounting for owner drawings. |
| **Accounting** | Double-Entry General Ledger | **Partially implemented** | Single-entry transaction logs with atomic balances. Needs formal General Ledger & Journal Entries where Total Debits = Total Credits. |
| **Loans & EMIs** | Loan Tracking & Amortization | **Implemented but requires improvement** | Calculates EMI and generates installments. Needs scope separation (Personal/Business) and principal vs interest ledger breakdown. |
| **Insurance** | Policy Management | **Partially implemented** | Basic `insurance_policies` table. Lacks support for 14 policies, nominee details, personal/family categorization, and premium payment vouchers. |
| **Chit Funds** | Chit Scheme & Installment Management | **Not implemented** | Completely new module required in SVE 2.0. |
| **Personal Finance**| Daily Expense Entry (Food, Groceries, etc.)| **Partially implemented** | Current `expenses` table covers business expenses. Needs Personal/Family categories and budget tracking. |
| **Personal Finance**| Personal & Family Income Tracking | **Partially implemented** | Current manual income is shop-focused. Needs Personal Income sources (Salary, Rental, Drawings). |
| **Dashboard** | Unified & Scoped Dashboard | **Implemented but requires improvement** | Dashboard is currently business-only. Needs Workspace Switcher: `[ OVERALL ] [ PERSONAL ] [ FAMILY ] [ BUSINESS ]`. |
| **Reminders** | Centralized Payment Calendar | **Implemented but requires improvement** | Reminders exist for customer/dealer/loans. Needs centralized calendar view for Insurance, EMIs, Chits, and utility bills. |
| **Reports** | Cash Flow & P&L Statements | **Implemented but requires improvement** | Cash flow & P&L work for business. Needs Balance Sheet, Trial Balance, Personal Net Worth, and Scope comparisons. |
| **PWA & Offline**| Service Worker & 1-Tap Mobile Update | **Fully implemented & tested** | Network-first v4 SW, 1-tap update button in header and drawer, background auto-sync. |
| **Audit Logs** | Security & Financial Action Audit | **Fully implemented & tested** | Records logins, transactions, voids, edits, and IP addresses. |

---

## 2. Risk & Vulnerability Analysis

1. **Staff Access to Personal Data**:
   - Currently, staff members with `STAFF` role can view `transactions` if authorized by basic JWT.
   - **Resolution**: Filter backend queries by user role; non-owners can only query `scope = "BUSINESS"`. Personal and Family records must be strictly restricted to `OWNER` (and configured Family Members).
2. **Transaction Voids and Balance Integrity**:
   - The transaction void mechanism was updated to reverse customer and dealer balances safely.
   - Must ensure new modules (Insurance payments, EMI payments, Chit contributions) also provide atomic rollback handlers in `voidTransaction`.
