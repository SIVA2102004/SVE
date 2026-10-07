import { Router } from 'express';
import { authenticateToken, requireRoles } from '../middleware/auth.js';
import { uploadMiddleware } from '../middleware/upload.js';

// Controllers
import {
  login,
  logout,
  logoutAllDevices,
  getMe,
  register,
  validateAccessCode,
  getAllUsers,
  deleteUser,
} from '../controllers/authController.js';
import { getDashboardMetrics } from '../controllers/dashboardController.js';
import {
  getCustomers,
  createCustomer,
  createCustomerReceivable,
  recordCustomerPayment,
} from '../controllers/customerController.js';
import {
  getDealers,
  createDealer,
  createDealerPayable,
  payDealer,
} from '../controllers/dealerController.js';
import {
  getTransactions,
  createManualIncome,
  createExpense,
  voidTransaction,
} from '../controllers/transactionController.js';
import { getLoans, createLoan, payEmiInstallment } from '../controllers/loanController.js';
import { getStaff, createStaff, markAttendance, calculateAndPaySalary } from '../controllers/staffController.js';
import {
  getPaymentAccounts,
  getInsurancePolicies,
  createInsurancePolicy,
  getReminders,
  createReminder,
  uploadReceipt,
  getReceipts,
  getAuditLogs,
  getShopSettings,
  updateShopSettings,
} from '../controllers/miscController.js';
import { getCashFlowReport, getProfitLossReport } from '../controllers/reportController.js';

const router = Router();

// ================= AUTH & PUBLIC ROUTES =================
router.post('/auth/login', login as any);
router.post('/auth/register', register as any);
router.post('/auth/validate-code', validateAccessCode as any);
router.post('/auth/logout', authenticateToken as any, logout as any);
router.post('/auth/logout-all', authenticateToken as any, logoutAllDevices as any);
router.get('/auth/me', authenticateToken as any, getMe as any);

// ================= PROTECTED CORE ROUTES =================
router.use(authenticateToken as any);

// Settings
router.get('/settings', getShopSettings as any);
router.put('/settings', requireRoles('OWNER'), updateShopSettings as any);

// Users Management (Owner Only)
router.get('/users', requireRoles('OWNER'), getAllUsers as any);
router.delete('/users/:userId', requireRoles('OWNER'), deleteUser as any);


// Payment Accounts
router.get('/payment-accounts', getPaymentAccounts as any);

// 1. Dashboard
router.get('/dashboard', getDashboardMetrics as any);

// 2. Customers & Receivables
router.get('/customers', getCustomers as any);
router.post('/customers', createCustomer as any);
router.post('/customers/:customerId/receivables', createCustomerReceivable as any);
router.post('/customers/:customerId/pay', recordCustomerPayment as any);
router.post('/customers/:customerId/payment', recordCustomerPayment as any);

// 3. Dealers & Payables
router.get('/dealers', getDealers as any);
router.post('/dealers', createDealer as any);
router.post('/dealers/:dealerId/payables', createDealerPayable as any);
router.post('/dealers/:dealerId/pay', payDealer as any);
router.post('/dealers/:dealerId/payment', payDealer as any);

// 4. Money Flow & Transactions
router.get('/transactions', getTransactions as any);
router.post('/transactions/income', createManualIncome as any);
router.post('/transactions/expense', createExpense as any);
router.post('/expenses', createExpense as any);
router.post('/transactions/:id/void', requireRoles('OWNER', 'MANAGER'), voidTransaction as any);

// 5. Loans & EMIs
router.get('/loans', getLoans as any);
router.post('/loans', requireRoles('OWNER', 'MANAGER'), createLoan as any);
router.post('/loans/installments/:installmentId/pay', payEmiInstallment as any);

// 6. Staff, Attendance & Salaries
router.get('/staff', getStaff as any);
router.post('/staff', requireRoles('OWNER', 'MANAGER'), createStaff as any);
router.post('/staff/attendance', markAttendance as any);
router.post('/attendance', markAttendance as any);
router.get('/staff/:staffId/salary/calculate', calculateAndPaySalary as any);
router.post('/staff/:staffId/salary/pay', requireRoles('OWNER', 'MANAGER'), calculateAndPaySalary as any);
router.post('/salary/pay', requireRoles('OWNER', 'MANAGER'), calculateAndPaySalary as any);

// 7. Insurance & Reminders
router.get('/insurance', getInsurancePolicies as any);
router.post('/insurance', requireRoles('OWNER', 'MANAGER'), createInsurancePolicy as any);
router.get('/reminders', getReminders as any);
router.post('/reminders', createReminder as any);
router.patch('/reminders/:id/complete', createReminder as any);

// 8. Receipts & Documents
router.post('/documents/upload', uploadMiddleware.single('file'), uploadReceipt as any);
router.get('/documents', getReceipts as any);
router.post('/receipts/upload', uploadMiddleware.single('file'), uploadReceipt as any);
router.get('/receipts', getReceipts as any);

// 9. Reports
router.get('/reports/cash-flow', getCashFlowReport as any);
router.get('/reports/profit-loss', getProfitLossReport as any);

// 10. Audit Logs
router.get('/audit-logs', requireRoles('OWNER'), getAuditLogs as any);

export default router;
