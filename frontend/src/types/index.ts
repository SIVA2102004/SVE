export interface User {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  phone?: string;
  isActive: boolean;
}

export interface PaymentAccount {
  id: string;
  name: string;
  type: 'CASH' | 'BANK' | 'UPI';
  accountNumber?: string;
  balance: number; // in paise
  isActive: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  creditLimit: number;
  totalReceivable: number;
  totalReceived: number;
  pendingBalance: number;
  receivables?: Receivable[];
}

export interface Receivable {
  id: string;
  customerId: string;
  customer?: Customer;
  invoiceNo?: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  pendingBalance: number;
  dueDate?: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  createdAt: string;
}

export interface Dealer {
  id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  gstin?: string;
  bankDetails?: string;
  totalPayable: number;
  totalPaid: number;
  pendingBalance: number;
  payables?: Payable[];
}

export interface Payable {
  id: string;
  dealerId: string;
  dealer?: Dealer;
  billNo?: string;
  description: string;
  totalAmount: number;
  paidAmount: number;
  pendingBalance: number;
  dueDate?: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  createdAt: string;
}

export interface Transaction {
  id: string;
  transactionNo: string;
  type: 'INCOME' | 'EXPENSE' | 'CUSTOMER_PAYMENT' | 'DEALER_PAYMENT' | 'SALARY' | 'LOAN_EMI' | 'INSURANCE' | 'TRANSFER';
  direction: 'IN' | 'OUT';
  amount: number; // in paise
  paymentAccountId: string;
  paymentAccount?: PaymentAccount;
  category: string;
  description: string;
  partyName?: string;
  referenceNo?: string;
  isVoid: boolean;
  voidReason?: string;
  voidedAt?: string;
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
    role: string;
  };
}

export interface Staff {
  id: string;
  name: string;
  phone: string;
  designation: string;
  monthlySalary: number; // in paise
  dailyRate: number; // in paise
  joiningDate: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface Attendance {
  id: string;
  staffId: string;
  staff?: Staff;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE';
  notes?: string;
}

export interface Loan {
  id: string;
  bankName: string;
  loanType: string;
  accountNo?: string;
  principalAmount: number;
  interestRate: number;
  tenureMonths: number;
  emiAmount: number;
  startDate: string;
  endDate: string;
  dueDayOfMonth: number;
  totalPaid: number;
  status: 'ACTIVE' | 'CLOSED';
  installments?: LoanInstallment[];
}

export interface LoanInstallment {
  id: string;
  loanId: string;
  installmentNo: number;
  dueDate: string;
  emiAmount: number;
  principalComponent: number;
  interestComponent: number;
  paidAmount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
}

export interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  amount?: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'PENDING' | 'COMPLETED';
}

export interface DocumentReceipt {
  id: string;
  title: string;
  category: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
}

export interface DashboardMetrics {
  currentBalance: number;
  accounts: {
    cash: number;
    bank: number;
    upi: number;
  };
  totalReceivable: number;
  totalPayable: number;
  todayIncome: number;
  todayExpense: number;
  todayNetFlow: number;
  monthlyIncome: number;
  monthlyExpense: number;
  monthlyNetFlow: number;
  activeLoansCount: number;
  monthlyEmiCommitment: number;
  activeStaffCount: number;
  monthlySalaryLiability: number;
  upcomingPayments: Array<{
    type: string;
    party: string;
    amount: number;
    dueDate: string;
    description: string;
    refId: string;
  }>;
  recentTransactions: Transaction[];
}
