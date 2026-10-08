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
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 1. Current Available Balance across all payment accounts
    // Execute all independent database queries in parallel with Promise.all
    const [
      accounts,
      pendingReceivables,
      pendingPayables,
      todayTransactions,
      monthTransactions,
      upcomingPayables,
      upcomingReceivables,
      recentTransactions,
      activeLoans,
      activeStaff,
    ] = await Promise.all([
      // 1. Current Available Balance across all payment accounts
      prisma.paymentMethodAccount.findMany({ where: { isActive: true } }),
      // 2. Total Customer Receivables
      prisma.receivable.findMany({
        where: { status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
        select: { pendingAmount: true },
      }),
      // 3. Total Dealer Payables
      prisma.payable.findMany({
        where: { status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
        select: { pendingAmount: true },
      }),
      // 4. Today's Transactions
      prisma.transaction.findMany({
        where: {
          date: { gte: startOfToday, lte: endOfToday },
          status: 'COMPLETED',
        },
        select: { type: true, amount: true },
      }),
      // 5. This Month Transactions
      prisma.transaction.findMany({
        where: {
          date: { gte: startOfMonth, lte: endOfMonth },
          status: 'COMPLETED',
        },
        select: { type: true, amount: true, category: true },
      }),
      // 6. Upcoming Payables (next 7 days)
      prisma.payable.findMany({
        where: {
          dueDate: { gte: startOfToday, lte: next7Days },
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        },
        include: { dealer: true },
        take: 5,
        orderBy: { dueDate: 'asc' },
      }),
      // Upcoming Receivables (next 7 days)
      prisma.receivable.findMany({
        where: {
          dueDate: { gte: startOfToday, lte: next7Days },
          status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        },
        include: { customer: true },
        take: 5,
        orderBy: { dueDate: 'asc' },
      }),
      // 7. Recent Transactions
      prisma.transaction.findMany({
        orderBy: { date: 'desc' },
        take: 10,
        include: { paymentMethodAccount: true },
      }),
      // 8. Active Loans & Staff
      prisma.loan.findMany({
        where: { status: 'ACTIVE' },
        select: { emiAmount: true },
      }),
      prisma.staff.findMany({
        where: { status: 'ACTIVE' },
        select: { monthlySalary: true },
      }),
    ]);

    const currentBalancePaise = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0);
    const totalReceivablePaise = pendingReceivables.reduce((sum, r) => sum + r.pendingAmount, 0);
    const totalPayablePaise = pendingPayables.reduce((sum, p) => sum + p.pendingAmount, 0);

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

    let monthIncomePaise = 0;
    let monthExpensePaise = 0;
    const categoryTotals: Record<string, number> = {};
    monthTransactions.forEach((tx) => {
      if (tx.type === 'INCOME' || tx.type === 'RECEIVABLE_PAYMENT') {
        monthIncomePaise += tx.amount;
      } else {
        if (
          tx.type === 'EXPENSE' ||
          tx.type === 'PAYABLE_PAYMENT' ||
          tx.type === 'SALARY' ||
          tx.type === 'EMI' ||
          tx.type === 'INSURANCE'
        ) {
          monthExpensePaise += tx.amount;
        }
        if (tx.type !== 'TRANSFER') {
          categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
        }
      }
    });

    const netCashFlowPaise = monthIncomePaise - monthExpensePaise;

    let cashPaise = 0;
    let bankPaise = 0;
    let upiPaise = 0;
    accounts.forEach((acc) => {
      if (acc.type === 'CASH') cashPaise += acc.currentBalance;
      else if (acc.type === 'BANK') bankPaise += acc.currentBalance;
      else if (acc.type === 'UPI') upiPaise += acc.currentBalance;
    });

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
