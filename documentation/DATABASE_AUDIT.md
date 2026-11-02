# Database Audit & Schema Evolution Plan
**Target**: Supabase PostgreSQL via Prisma ORM  
**Safety Principle**: Zero Data Loss / Strict Non-Destructive Additions  

---

## 1. Existing Tables & Physical Architecture

| Table Name | Model Name | Primary Key | Key Indexes | Purpose |
|---|---|---|---|---|
| `users` | `User` | UUID | `username` (UQ), `email` (UQ) | Store owner, managers, staff profiles. |
| `sessions` | `Session` | UUID | `token` (UQ), `userId` | User authentication sessions. |
| `shop_settings` | `ShopSettings` | UUID | PK | Shop metadata, access code, UPI ID, default prefix. |
| `payment_method_accounts` | `PaymentMethodAccount` | UUID | PK | Cash Drawer, Bank accounts, Shop UPI accounts. |
| `customers` | `Customer` | UUID | `mobile` | Store customers, total billed/paid, pending receivables. |
| `dealers` | `Dealer` | UUID | `mobile` | Auto parts suppliers, collector name, visit schedules. |
| `receivables` | `Receivable` | UUID | `customerId`, `status` | Customer invoices/debits. |
| `payables` | `Payable` | UUID | `dealerId`, `status` | Supplier purchase bills/credits. |
| `expenses` | `Expense` | UUID | `category`, `date` | Shop operational expenses. |
| `transactions` | `Transaction` | UUID | `date`, `type` | Historical transaction records. |
| `payments` | `Payment` | UUID | `receiptNumber` (UQ), `customerId`, `dealerId` | Payment vouchers. |
| `staff` | `Staff` | UUID | PK | Employee profiles, salary basis. |
| `attendance` | `Attendance` | UUID | `staffId`, `date` (UQ composite) | Daily attendance tracking. |
| `salary_records` | `SalaryRecord` | UUID | `staffId`, `month`, `year` (UQ composite) | Monthly salary vouchers. |
| `loans` | `Loan` | UUID | PK | Business loans & liabilities. |
| `loan_installments` | `LoanInstallment` | UUID | `loanId`, `dueDate` | Monthly EMI schedule items. |
| `insurance_policies` | `InsurancePolicy` | UUID | PK | Insurance policies. |
| `recurring_payments` | `RecurringPayment` | UUID | PK | Periodic recurring obligations. |
| `reminders` | `Reminder` | UUID | `dueDate` | Financial alerts & reminders. |
| `document_receipts` | `DocumentReceipt` | UUID | `category` | Uploaded bill photos & receipts. |
| `audit_logs` | `AuditLog` | UUID | `createdAt` | Comprehensive audit trail. |

---

## 2. Integer-Safe Currency Standard
- **Unit**: Integer paise (`Int` in Prisma schema, representing cents/paise).
- **Rule**: `1 INR = 100 Paise`.
- **Display**: All frontend rendering uses `formatINR(paise)` which divides by 100 and applies Indian numbering (`en-IN`).
- **Input**: User inputs in standard rupees (e.g., `55912`) and the backend converts using `rupeesToPaise(val) = Math.round(Number(val) * 100)`.

---

## 3. Schema Evolution Plan for SVE 2.0

To incorporate Personal, Family, and Business financial management without disrupting existing data, the following non-destructive extensions will be introduced:

### 3.1 Workspace / Scope Partitioning
Add an optional/defaulted `scope` column to financial tables:
- `PaymentMethodAccount`:
  - `scope String @default("BUSINESS")` (`PERSONAL`, `FAMILY`, `BUSINESS`)
  - `ownerId String?` (references User for private personal accounts)
  - `isShared Boolean @default(false)` (for shared family accounts)
- `Transaction`:
  - `scope String @default("BUSINESS")` (`PERSONAL`, `FAMILY`, `BUSINESS`)
- `Expense`:
  - `scope String @default("BUSINESS")` (`PERSONAL`, `FAMILY`, `BUSINESS`)
- `Loan`:
  - `scope String @default("BUSINESS")` (`PERSONAL`, `FAMILY`, `BUSINESS`)
  - `loanType String?` (Personal Loan, Home Loan, Vehicle Loan, Business Loan, Gold Loan)
- `InsurancePolicy`:
  - `scope String @default("BUSINESS")` (`PERSONAL`, `FAMILY`, `BUSINESS`)
  - `policyHolder String?`
  - `sumAssured Int @default(0)`
  - `nominee String?`
  - `paymentAccountId String?`

### 3.2 New Entities to Support SVE 2.0
1. **`ChitScheme` & `ChitInstallment`**:
   - `ChitScheme`: Chit Name, Company, Total Chit Value, Monthly Contribution, Duration, Start/End Date, Status, Scope (`PERSONAL`, `FAMILY`, `BUSINESS`).
   - `ChitInstallment`: Installment No, Due Date, Paid Date, Amount Paid, Dividend/Discount, Prize Received Flag, Auction Payout Amount, Status.
2. **`PersonalIncome`**:
   - Source (Salary, Rental, Drawings from Business, Interest, Agricultural, Other), Amount, Date, Scope, Account ID, Description, Attachments.
3. **`JournalEntry` & `JournalLine` (Double-Entry Engine)**:
   - `JournalEntry`: Entry No, Date, Reference, Description, Scope, Posted Status.
   - `JournalLine`: Entry ID, Account ID, Debit Amount (paise), Credit Amount (paise), Description.
   - **Constraint**: `SUM(Debit) == SUM(Credit)`.

### 3.3 Zero-Downtime Migration Safety Checklist
- [x] No existing table or column dropped or renamed.
- [x] All new columns have default values or are nullable.
- [x] Existing records default to `scope = "BUSINESS"` so current operations remain 100% unaffected.
- [x] Existing API endpoints continue to return data intact while accepting the new scope parameter.
