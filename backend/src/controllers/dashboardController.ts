import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getDashboardMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 1. Current Available Balance across all payment accounts
    const accounts = await prisma.paymentMethodAccount.findMany({
      where: { isActive: true },
    });
    const currentBalancePaise = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);

    // 2. Total Customer Receivables (Customers Owe You)
    const pendingReceivables = await prisma.receivable.findMany({
      where: { status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
    });
    const totalReceivablePaise = pendingReceivables.reduce((sum, r) => sum + r.pendingAmount, 0);

    // 3. Total Dealer Payables (You Owe Dealers)
    const pendingPayables = await prisma.payable.findMany({
      where: { status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
    });
    const totalPayablePaise = pendingPayables.reduce((sum, p) => sum + p.pendingAmount, 0);

    // 4. Today's Income & Expenses
    const todayTransactions = await prisma.transaction.findMany({
      where: {
        date: { gte: startOfToday, lte: endOfToday },
        status: 'COMPLETED',
      },
    });

    let todayIncomePaise = 0;
    let todayExpensePaise = 0;
    todayTransactions.forEach((tx) => {
      if (tx.type === 'INCOME' || tx.type === 'RECEIVABLE_PAYMENT') {
        todayIncomePaise += tx.amount;
      } else if (
        tx.type === 'EXPENSE' ||
        tx.type === 'PAYABLE_PAYMENT' ||
        tx.type === 'SALARY' ||
        tx.type === 'EMI' ||
        tx.type === 'INSURANCE'
      ) {
        todayExpensePaise += tx.amount;
      }
    });

    // 5. This Month Income & Expenses
    const monthTransactions = await prisma.transaction.findMany({
      where: {
        date: { gte: startOfMonth, lte: endOfMonth },
        status: 'COMPLETED',
      },
    });

    let monthIncomePaise = 0;
    let monthExpensePaise = 0;
    monthTransactions.forEach((tx) => {
      if (tx.type === 'INCOME' || tx.type === 'RECEIVABLE_PAYMENT') {
        monthIncomePaise += tx.amount;
      } else if (
        tx.type === 'EXPENSE' ||
        tx.type === 'PAYABLE_PAYMENT' ||
        tx.type === 'SALARY' ||
        tx.type === 'EMI' ||
        tx.type === 'INSURANCE'
      ) {
        monthExpensePaise += tx.amount;
      }
    });

    const netCashFlowPaise = monthIncomePaise - monthExpensePaise;

    // 6. Upcoming Payments & Reminders (Next 7 days)
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingPayables = await prisma.payable.findMany({
      where: {
        dueDate: { gte: startOfToday, lte: next7Days },
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      },
      include: { dealer: true },
      take: 5,
      orderBy: { dueDate: 'asc' },
    });

    const upcomingReceivables = await prisma.receivable.findMany({
      where: {
        dueDate: { gte: startOfToday, lte: next7Days },
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      },
      include: { customer: true },
      take: 5,
      orderBy: { dueDate: 'asc' },
    });

    // 7. Recent Money Flow transactions
    const recentTransactions = await prisma.transaction.findMany({
      orderBy: { date: 'desc' },
      take: 10,
      include: {
        paymentMethodAccount: true,
      },
    });

    // 8. Expense Category Breakdown for this month
    const categoryTotals: Record<string, number> = {};
    monthTransactions.forEach((tx) => {
      if (tx.type !== 'INCOME' && tx.type !== 'RECEIVABLE_PAYMENT' && tx.type !== 'TRANSFER') {
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
      }
    });

    // Compute breakdown of accounts by type
    let cashPaise = 0;
    let bankPaise = 0;
    let upiPaise = 0;
    accounts.forEach((acc) => {
      if (acc.type === 'CASH') cashPaise += acc.currentBalance;
      else if (acc.type === 'BANK') bankPaise += acc.currentBalance;
      else if (acc.type === 'UPI') upiPaise += acc.currentBalance;
    });

    const activeLoans = await prisma.loan.findMany({ where: { status: 'ACTIVE' } });
    const activeStaff = await prisma.staff.findMany({ where: { status: 'ACTIVE' } });
    const monthlyEmiPaise = activeLoans.reduce((sum, l) => sum + (l.emiAmount || 0), 0);
    const monthlySalaryPaise = activeStaff.reduce((sum, s) => sum + s.monthlySalary, 0);

    const upcomingList = [
      ...upcomingPayables.map((p) => ({
        type: 'Dealer Payable',
        party: p.dealer.name,
        amount: p.pendingAmount,
        dueDate: p.dueDate ? p.dueDate.toISOString() : new Date().toISOString(),
        description: p.notes || `Invoice #${p.invoiceNumber}`,
        refId: p.id,
      })),
      ...upcomingReceivables.map((r) => ({
        type: 'Customer Receivable',
        party: r.customer.name,
        amount: r.pendingAmount,
        dueDate: r.dueDate ? r.dueDate.toISOString() : new Date().toISOString(),
        description: r.notes || `Bill #${r.invoiceNumber}`,
        refId: r.id,
      })),
    ];

    res.json({
      currentBalance: currentBalancePaise,
      accounts: {
        cash: cashPaise,
        bank: bankPaise,
        upi: upiPaise,
      },
      accountList: accounts,
      totalReceivable: totalReceivablePaise,
      totalPayable: totalPayablePaise,
      todayIncome: todayIncomePaise,
      todayExpense: todayExpensePaise,
      todayNetFlow: todayIncomePaise - todayExpensePaise,
      monthlyIncome: monthIncomePaise,
      monthlyExpense: monthExpensePaise,
      monthlyNetFlow: netCashFlowPaise,
      activeLoansCount: activeLoans.length,
      monthlyEmiCommitment: monthlyEmiPaise,
      activeStaffCount: activeStaff.length,
      monthlySalaryLiability: monthlySalaryPaise,
      upcomingPayments: upcomingList,
      recentTransactions,
      expenseCategories: Object.entries(categoryTotals).map(([name, amount]) => ({
        name,
        amount,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
