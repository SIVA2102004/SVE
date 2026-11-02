# Upgrade Roadmap – SVE 2.0 Unified Platform
**Phased Implementation Plan**  

---

## Phase 0: Complete Audit & Baseline Documentation (CURRENT)
- [x] Full repository audit (Frontend, Backend, Database, Cloud Config).
- [x] Generate system documentation:
  - `documentation/EXISTING_SYSTEM_AUDIT.md`
  - `documentation/CURRENT_ARCHITECTURE.md`
  - `documentation/DATABASE_AUDIT.md`
  - `documentation/FEATURE_STATUS.md`
  - `documentation/ACCOUNTING_DESIGN.md`
  - `documentation/UPGRADE_ROADMAP.md`
- [x] Establish zero-downtime, non-destructive migration rules.

---

## Phase 1: Core Architecture & Workspace Scoping
- **Schema Updates**:
  - Add `scope` (`BUSINESS`, `PERSONAL`, `FAMILY`) to `PaymentMethodAccount`, `Transaction`, `Expense`, `Loan`, `InsurancePolicy`.
  - Add `ChitScheme`, `ChitInstallment`, and `PersonalIncome` models.
- **Backend Authorization**:
  - Enforce scope boundary in API middleware (`requireOwnerForPersonalScope`).
- **Frontend Workspace Switcher**:
  - Global scope state: `OVERALL`, `PERSONAL`, `FAMILY`, `BUSINESS`.
  - Scoped data filtering in layout, navigation, and API calls.

---

## Phase 2: Double-Entry Accounting Engine
- Implement `JournalEntry` and `JournalLine` models.
- Build double-entry balance verification helper (`totalDebits === totalCredits`).
- Automatic journal creation for:
  - Customer Payments & Invoices
  - Dealer Payments & Purchases
  - Personal Expenses & Drawings
  - Insurance Premiums & Loan EMIs
- Audit-safe transaction reversal & adjustment entries.

---

## Phase 3: Personal & Family Finance Modules
- **Personal Daily Expenses**:
  - Categories: Food, Groceries, Medical, Petrol, Electricity, Water, Education, Travel, Maintenance, etc.
  - Quick entry interface and receipt attachment.
- **Personal & Family Income**:
  - Salary, Rental, Drawings from Business, Interest, Agricultural.
  - Internal transfer handling (Business-to-Personal drawings without double-counting revenue).

---

## Phase 4: Insurance Management Module
- Support up to 14+ policies (Life, Health, Vehicle, Shop, Property).
- Policy fields: Number, Holder, Nominee, Sum Assured, Premium, Frequency, Next Due Date, Document URL.
- Premium payment recording with direct bank/cash account deduction.
- Upcoming premium calendar and alerts.

---

## Phase 5: Loan, EMI & Chit Fund Management
- **Loans & EMIs**:
  - Categorization: Personal, Business, Home, Vehicle, Gold Loan.
  - Accurate principal vs. interest breakdown in accounting.
  - Installment payment vouchers and outstanding principal tracking.
- **Chit Funds**:
  - Chit schemes (total value, months, monthly installment).
  - Monthly contribution payments.
  - Auction payout receipts, dividends, and commission accounting.

---

## Phase 6: Scoped Dashboards, Payment Calendar & Reports
- **4-View Dashboard**:
  - `OVERALL`: Total Net Worth, Consolidated Cash/Bank, Total Receivables, Total Payables, Loan Outstanding, Insurance Commitments.
  - `PERSONAL`: Personal savings, personal loans, monthly personal expenses.
  - `FAMILY`: Household expenses, shared commitments.
  - `BUSINESS`: SVE Store sales, customer receivables, dealer payables, profit.
- **Centralized Payment Calendar**:
  - Consolidated view of due dates for Insurance, EMIs, Chits, Dealer visits, Customer follow-ups.
- **Advanced Financial Reports**:
  - Personal Net Worth Statement.
  - General Ledger, Trial Balance, Profit & Loss, Balance Sheet.
  - PDF & Print exports.

---

## Phase 7: Verification, Testing & Production Deployment
- End-to-end testing of 12 test scenarios (Acceptance Criteria).
- PWA network-first cache and offline sync verification.
- Safe database migration applied to Supabase via `npx prisma db push`.
- Push to GitHub (`main`) for automatic Vercel (frontend) and Render (backend) deployment.
