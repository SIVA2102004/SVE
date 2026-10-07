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
      startDate,
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
          nextEmiDate: new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000),
          remainingAmount: principalPaise,
          accountNumberMasked: accountNumberMasked || null,
          notes: notes || null,
        },
      });

      // Generate Amortization Schedule
      let curPrincipal = principalPaise;
      const monthlyRate = rate > 0 ? rate / (12 * 100) : 0;

      for (let i = 1; i <= tenure; i++) {
        const dueDate = new Date(start);
        dueDate.setMonth(dueDate.getMonth() + i);

        let interestComponent = Math.round(curPrincipal * monthlyRate);
        let principalComponent = emiPaise - interestComponent;

        if (i === tenure || principalComponent > curPrincipal) {
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

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userEmail: req.user!.email,
          action: 'LOAN_CREATED',
          entityType: 'LOAN',
          entityId: newLoan.id,
          amount: principalPaise,
          details: JSON.stringify({ loanName, lender, emiPaise }),
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
