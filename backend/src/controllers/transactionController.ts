import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { rupeesToPaise } from '../utils/currency.js';
import { broadcastEvent } from '../websocket/socket.js';

export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const { type, category, startDate, endDate, search, limit = '50', page = '1' } = req.query;
    const where: any = {};

    if (type && type !== 'ALL') where.type = String(type);
    if (category && category !== 'ALL') where.category = String(category);

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(String(startDate));
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { description: { contains: String(search) } },
        { reference: { contains: String(search) } },
        { source: { contains: String(search) } },
        { destination: { contains: String(search) } },
      ];
    }

    const take = parseInt(String(limit));
    const skip = (parseInt(String(page)) - 1) * take;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take,
        include: {
          paymentMethodAccount: true,
          createdBy: { select: { name: true, role: true } },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        page: parseInt(String(page)),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createManualIncome = async (req: AuthRequest, res: Response) => {
  try {
    const { category, amountRupees, date, paymentMethod = 'CASH', paymentMethodAccountId, source, description } =
      req.body;

    const amountPaise = rupeesToPaise(amountRupees);
    if (amountPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be greater than zero.' });
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const newTx = await tx.transaction.create({
        data: {
          type: 'INCOME',
          category: category || 'Cash Sales',
          amount: amountPaise,
          date: date ? new Date(date) : new Date(),
          paymentMethod,
          paymentMethodAccountId: paymentMethodAccountId || null,
          source: source || 'Direct Sale',
          destination: 'Shop Register',
          description: description || 'Direct counter cash/sales income',
          createdById: req.user!.id,
        },
      });

      if (paymentMethodAccountId) {
        await tx.paymentMethodAccount.update({
          where: { id: paymentMethodAccountId },
          data: { currentBalance: { increment: amountPaise } },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userEmail: req.user!.email,
          action: 'CREATE_TRANSACTION',
          entityType: 'TRANSACTION',
          entityId: newTx.id,
          amount: amountPaise,
          details: JSON.stringify({ type: 'INCOME', category, description }),
        },
      });

      return newTx;
    });

    broadcastEvent('transaction_created', transaction);
    res.status(201).json({ success: true, transaction });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const createExpense = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      category,
      amountRupees,
      date,
      paymentMethod = 'CASH',
      paymentMethodAccountId,
      paidTo,
      description,
      isRecurring = false,
      dueDate,
    } = req.body;

    const amountPaise = rupeesToPaise(amountRupees);
    if (amountPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Expense amount must be greater than zero.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          name,
          category: category || 'Shop Rent',
          amount: amountPaise,
          date: date ? new Date(date) : new Date(),
          paymentMethod,
          paidTo: paidTo || null,
          description: description || null,
          isRecurring: Boolean(isRecurring),
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          type: 'EXPENSE',
          category: category || 'General Expense',
          amount: amountPaise,
          date: date ? new Date(date) : new Date(),
          paymentMethod,
          paymentMethodAccountId: paymentMethodAccountId || null,
          source: 'Shop Account',
          destination: paidTo || name,
          description: description || `Expense: ${name}`,
          expenseId: expense.id,
          createdById: req.user!.id,
        },
      });

      if (paymentMethodAccountId) {
        await tx.paymentMethodAccount.update({
          where: { id: paymentMethodAccountId },
          data: { currentBalance: { decrement: amountPaise } },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userEmail: req.user!.email,
          action: 'CREATE_TRANSACTION',
          entityType: 'EXPENSE',
          entityId: expense.id,
          amount: amountPaise,
          details: JSON.stringify({ name, category, paymentMethod }),
        },
      });

      return { expense, transaction };
    });

    broadcastEvent('expense_created', result);
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const voidTransaction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { voidReason } = req.body;

    if (!voidReason) {
      return res.status(400).json({ success: false, message: 'Reason for voiding transaction is required.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({ where: { id } });
      if (!existing || existing.status === 'VOID') {
        throw new Error('Transaction not found or already voided');
      }

      // Reverse account balance effect
      if (existing.paymentMethodAccountId) {
        if (existing.type === 'INCOME' || existing.type === 'RECEIVABLE_PAYMENT') {
          await tx.paymentMethodAccount.update({
            where: { id: existing.paymentMethodAccountId },
            data: { currentBalance: { decrement: existing.amount } },
          });
        } else {
          await tx.paymentMethodAccount.update({
            where: { id: existing.paymentMethodAccountId },
            data: { currentBalance: { increment: existing.amount } },
          });
        }
      }

      const updated = await tx.transaction.update({
        where: { id },
        data: {
          status: 'VOID',
          voidReason,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userEmail: req.user!.email,
          action: 'VOID_TRANSACTION',
          entityType: 'TRANSACTION',
          entityId: id,
          amount: existing.amount,
          details: JSON.stringify({ voidReason }),
        },
      });

      return updated;
    });

    broadcastEvent('transaction_voided', result);
    res.json({ success: true, message: 'Transaction voided and ledger reversed', transaction: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
