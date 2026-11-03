import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { calculateEMI, rupeesToPaise } from '../utils/currency.js';
import { broadcastEvent } from '../websocket/socket.js';

export const getLoans = async (req: AuthRequest, res: Response) => {
  try {
    const loans = await prisma.loan.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        installments: {
          orderBy: { installmentNumber: 'asc' },
        },
      },
    });

    res.json({ success: true, loans });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createLoan = async (req: AuthRequest, res: Response) => {
  try {
    const {
      loanName,
      lender,
      principalAmountRupees,
      interestRate = '10.5',
      tenureMonths = '36',
      frequency = 'MONTHLY', // MONTHLY (1), BI_MONTHLY (2), QUARTERLY (3), HALF_YEARLY (6), YEARLY (12)
      intervalMonths = 1,
      startDate,
      firstEmiDate,
      intimationDate,
      remindDays = 3,
      accountNumberMasked,
      notes,
    } = req.body;

    const principalPaise = rupeesToPaise(principalAmountRupees);
    const tenure = parseInt(String(tenureMonths));
    const rate = parseFloat(String(interestRate));

    if (principalPaise <= 0 || tenure <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid principal or tenure.' });
    }

    const { emiPaise } = calculateEMI(principalPaise, rate, tenure);
    const start = startDate ? new Date(startDate) : new Date();

    // Determine interval step in months
    let stepMonths = parseInt(String(intervalMonths)) || 1;
    if (frequency === 'TWO_MONTHS' || frequency === 'BI_MONTHLY') stepMonths = 2;
    else if (frequency === 'QUARTERLY' || frequency === 'THREE_MONTHS') stepMonths = 3;
    else if (frequency === 'HALF_YEARLY' || frequency === 'SIX_MONTHS') stepMonths = 6;
    else if (frequency === 'YEARLY') stepMonths = 12;

    const initialEmiDate = firstEmiDate
      ? new Date(firstEmiDate)
      : new Date(start.getTime() + stepMonths * 30 * 24 * 60 * 60 * 1000);

    const loan = await prisma.$transaction(async (tx) => {
      const newLoan = await tx.loan.create({
        data: {
          loanName,
          lender,
          principalAmount: principalPaise,
          interestRate: rate,
          tenureMonths: tenure,
          emiAmount: emiPaise,
          startDate: start,
          nextEmiDate: initialEmiDate,
          remainingAmount: principalPaise,
          accountNumberMasked: accountNumberMasked || null,
          notes: notes ? `${notes} | Frequency: Every ${stepMonths} month(s)` : `Frequency: Every ${stepMonths} month(s)`,
        },
      });

      // Generate Amortization Schedule based on interval frequency
      let curPrincipal = principalPaise;
      const monthlyRate = rate > 0 ? (rate * stepMonths) / (12 * 100) : 0;
      const totalInstallments = Math.max(1, Math.ceil(tenure / stepMonths));

      for (let i = 1; i <= totalInstallments; i++) {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + i * stepMonths);

        let interestComponent = Math.round(curPrincipal * monthlyRate);
        let principalComponent = emiPaise - interestComponent;

        if (i === totalInstallments || principalComponent > curPrincipal) {
          principalComponent = curPrincipal;
          interestComponent = Math.max(0, emiPaise - principalComponent);
        }

        const remainingAfter = Math.max(0, curPrincipal - principalComponent);

        await tx.loanInstallment.create({
          data: {
            loanId: newLoan.id,
            installmentNumber: i,
            dueDate,
            emiAmount: emiPaise,
            principalComponent,
            interestComponent,
            remainingPrincipal: remainingAfter,
            status: 'PENDING',
          },
        });

        curPrincipal = remainingAfter;
      }

      // Auto-schedule Reminder notification for loan EMI
      const reminderDueDate = intimationDate ? new Date(intimationDate) : initialEmiDate;
      await tx.reminder.create({
        data: {
          title: `Loan EMI Due: ${loanName} (${lender})`,
          description: `Scheduled EMI payment of ₹${(emiPaise / 100).toLocaleString('en-IN')}. Repayment cycle: Every ${stepMonths} month(s).`,
          dueDate: reminderDueDate,
          amount: emiPaise,
          type: 'EMI_DUE',
          referenceId: newLoan.id,
          remindDays: parseInt(String(remindDays)) || 3,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userEmail: req.user!.email,
          action: 'LOAN_CREATED',
          entityType: 'LOAN',
          entityId: newLoan.id,
          amount: principalPaise,
          details: JSON.stringify({ loanName, lender, emiPaise, stepMonths }),
        },
      });

      return newLoan;
    });

    broadcastEvent('loan_created', loan);
    res.status(201).json({ success: true, loan });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const payEmiInstallment = async (req: AuthRequest, res: Response) => {
  try {
    const { installmentId } = req.params;
    const { paymentMethod = 'BANK_TRANSFER', paymentMethodAccountId } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const installment = await tx.loanInstallment.findUnique({
        where: { id: installmentId },
        include: { loan: true },
      });

      if (!installment) throw new Error('Installment not found');
      if (installment.status === 'PAID') throw new Error('Installment is already marked as paid');

      const paidInst = await tx.loanInstallment.update({
        where: { id: installmentId },
        data: {
          status: 'PAID',
          paidDate: new Date(),
          paidAmount: installment.emiAmount,
          paymentMethod,
        },
      });

      const newRemaining = Math.max(0, installment.loan.remainingAmount - installment.principalComponent);
      await tx.loan.update({
        where: { id: installment.loanId },
        data: {
          remainingAmount: newRemaining,
          status: newRemaining === 0 ? 'CLOSED' : 'ACTIVE',
        },
      });

      // Record financial expense transaction
      const transaction = await tx.transaction.create({
        data: {
          type: 'EMI',
          category: 'Loan EMI',
          amount: installment.emiAmount,
          paymentMethod,
          paymentMethodAccountId: paymentMethodAccountId || null,
          source: 'Shop Account',
          destination: installment.loan.lender,
          description: `EMI Payment: ${installment.loan.loanName} (#${installment.installmentNumber})`,
          loanInstallmentId: installment.id,
          createdById: req.user!.id,
        },
      });

      if (paymentMethodAccountId) {
        await tx.paymentMethodAccount.update({
          where: { id: paymentMethodAccountId },
          data: { currentBalance: { decrement: installment.emiAmount } },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userEmail: req.user!.email,
          action: 'EMI_PAID',
          entityType: 'LOAN',
          entityId: installment.loanId,
          amount: installment.emiAmount,
          details: JSON.stringify({ installmentNo: installment.installmentNumber }),
        },
      });

      return { paidInst, transaction };
    });

    broadcastEvent('emi_paid', result);
    res.json({ success: true, message: 'EMI paid successfully', data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
