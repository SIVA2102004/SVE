import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';

export const getCashFlowReport = async (req: AuthRequest, res: Response) => {
  try {
    const { year = '2026' } = req.query;
    const y = parseInt(String(year));

    const settings = await prisma.shopSettings.findFirst();
    const openingBalance = settings?.openingBalance || 0;

    const startOfYear = new Date(y, 0, 1);
    const endOfYear = new Date(y, 11, 31, 23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: startOfYear, lte: endOfYear },
        status: 'COMPLETED',
      },
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let runningBalance = openingBalance;

    const monthlySummary = months.map((mName, idx) => {
      let income = 0;
      let expense = 0;

      transactions.forEach((tx) => {
        if (tx.date.getMonth() === idx) {
          if (tx.type === 'INCOME' || tx.type === 'RECEIVABLE_PAYMENT') {
            income += tx.amount;
          } else if (tx.type !== 'TRANSFER') {
            expense += tx.amount;
          }
        }
      });

      const net = income - expense;
      const monthOpening = runningBalance;
      runningBalance += net;
      const monthClosing = runningBalance;

      return {
        month: mName,
        opening: monthOpening,
        income,
        expense,
        net,
        closing: monthClosing,
      };
    });

    res.json({
      success: true,
      report: {
        year: y,
        openingBalance,
        totalIncome: monthlySummary.reduce((s, m) => s + m.income, 0),
        totalExpense: monthlySummary.reduce((s, m) => s + m.expense, 0),
        closingBalance: runningBalance,
        monthlySummary,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getProfitLossReport = async (req: AuthRequest, res: Response) => {
  try {
    const { year = '2026' } = req.query;
    const y = parseInt(String(year));

    const startOfYear = new Date(y, 0, 1);
    const endOfYear = new Date(y, 11, 31, 23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: {
        date: { gte: startOfYear, lte: endOfYear },
        status: 'COMPLETED',
      },
    });

    let revenue = 0;
    let costOfGoods = 0;
    let operatingExpenses = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'INCOME' || tx.type === 'RECEIVABLE_PAYMENT') {
        revenue += tx.amount;
      } else if (tx.type === 'PAYABLE_PAYMENT' || tx.category === 'Purchases') {
        costOfGoods += tx.amount;
      } else if (tx.type !== 'TRANSFER') {
        operatingExpenses += tx.amount;
      }
    });

    const grossProfit = revenue - costOfGoods;
    const netProfit = grossProfit - operatingExpenses;

    res.json({
      success: true,
      report: {
        year: y,
        revenue,
        costOfGoods,
        grossProfit,
        operatingExpenses,
        netProfit,
        profitMargin: revenue > 0 ? ((netProfit / revenue) * 100).toFixed(2) + '%' : '0%',
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
