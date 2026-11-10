import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { rupeesToPaise } from '../utils/currency.js';
import { broadcastEvent } from '../websocket/socket.js';

/**
 * Generate default scheduled installments for a chit scheme if they don't exist yet.
 */
async function ensureInstallmentsExist(chit: any) {
  const existingCount = await prisma.chitInstallment.count({
    where: { chitSchemeId: chit.id },
  });

  if (existingCount === 0 && chit.totalMonths > 0) {
    const installmentsData = [];
    const baseDate = new Date(chit.startDate || new Date());
    const dueDay = chit.dueDayOfMonth || 10;

    for (let m = 1; m <= chit.totalMonths; m++) {
      const dueDate = new Date(baseDate);
      dueDate.setMonth(dueDate.getMonth() + (m - 1));
      // Safe set date for month length
      const daysInTargetMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
      dueDate.setDate(Math.min(dueDay, daysInTargetMonth));

      installmentsData.push({
        chitSchemeId: chit.id,
        monthNumber: m,
        dueDate,
        amountExpected: chit.monthlyContribution,
        dividendEarned: 0,
        netInstalment: chit.monthlyContribution,
        amountPaid: 0,
        status: 'PENDING',
        paymentMethod: 'BANK',
      });
    }

    await prisma.chitInstallment.createMany({
      data: installmentsData,
    });
  }
}

/**
 * GET /api/chits
 * Returns all chit schemes with auctions and installments, plus computed statistics.
 */
export const getChitSchemes = async (req: AuthRequest, res: Response) => {
  try {
    const { scope } = req.query;
    const where: any = {};
    if (scope && scope !== 'OVERALL') where.scope = String(scope);

    const chits = await prisma.chitScheme.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        installments: {
          orderBy: { monthNumber: 'asc' },
          include: {
            transaction: {
              select: { id: true, paymentMethodAccountId: true, reference: true },
            },
            paymentLogs: {
              orderBy: { paidDate: 'desc' },
            },
          },
        },
        auctions: {
          orderBy: { auctionMonth: 'asc' },
        },
        paymentLogs: {
          orderBy: { paidDate: 'desc' },
          take: 50,
        },
      },
    });

    res.json({ success: true, chits });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/chits/:chitId
 */
export const getChitById = async (req: AuthRequest, res: Response) => {
  try {
    const { chitId } = req.params;
    const chit = await prisma.chitScheme.findUnique({
      where: { id: chitId },
      include: {
        installments: {
          orderBy: { monthNumber: 'asc' },
          include: {
            transaction: {
              select: { id: true, paymentMethodAccountId: true, reference: true },
            },
            paymentLogs: {
              orderBy: { paidDate: 'desc' },
            },
          },
        },
        auctions: {
          orderBy: { auctionMonth: 'asc' },
        },
        paymentLogs: {
          orderBy: { paidDate: 'desc' },
        },
      },
    });

    if (!chit) {
      return res.status(404).json({ success: false, message: 'Chit scheme not found' });
    }

    // Ensure all monthly installment slots exist
    await ensureInstallmentsExist(chit);

    const refreshed = await prisma.chitScheme.findUnique({
      where: { id: chitId },
      include: {
        installments: {
          orderBy: { monthNumber: 'asc' },
          include: {
            transaction: {
              select: { id: true, paymentMethodAccountId: true, reference: true },
            },
            paymentLogs: {
              orderBy: { paidDate: 'desc' },
            },
          },
        },
        auctions: {
          orderBy: { auctionMonth: 'asc' },
        },
        paymentLogs: {
          orderBy: { paidDate: 'desc' },
        },
      },
    });

    res.json({ success: true, chit: refreshed });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/chits
 * Create a new Chit Fund Scheme with member configuration.
 */
export const createChitScheme = async (req: AuthRequest, res: Response) => {
  try {
    const {
      scope = 'PERSONAL',
      chitName,
      chitCompany,
      chitNumber,
      totalValueRupees,
      totalMembers,
      monthlyContributionRupees,
      totalMonths,
      memberNumber,
      startDate,
      endDate,
      dueDayOfMonth = 10,
      foremanCommissionPercent = 5.0,
      paymentFrequency = 'MONTHLY',
      targetDailyAmountRupees = 0,
      status = 'ACTIVE',
      notes,
    } = req.body;

    const totalValuePaise = rupeesToPaise(totalValueRupees);
    const parsedTotalMembers = parseInt(totalMembers) || 50;
    const targetDailyAmountPaise = targetDailyAmountRupees ? rupeesToPaise(targetDailyAmountRupees) : 0;
    
    // Auto calculate monthlyContribution if not manually provided: Total Value / Total Members
    let monthlyContributionPaise: number;
    if (monthlyContributionRupees !== undefined && monthlyContributionRupees !== '' && !isNaN(Number(monthlyContributionRupees))) {
      monthlyContributionPaise = rupeesToPaise(monthlyContributionRupees);
    } else {
      monthlyContributionPaise = Math.round(totalValuePaise / parsedTotalMembers);
    }

    const parsedTotalMonths = parseInt(totalMonths) || parsedTotalMembers;
    const startDt = startDate ? new Date(startDate) : new Date();

    let endDt: Date | null = null;
    if (endDate) {
      endDt = new Date(endDate);
    } else {
      endDt = new Date(startDt);
      endDt.setMonth(endDt.getMonth() + parsedTotalMonths);
    }

    const chit = await prisma.chitScheme.create({
      data: {
        scope,
        chitName,
        chitCompany,
        chitNumber: chitNumber || null,
        totalValue: totalValuePaise,
        totalMembers: parsedTotalMembers,
        memberNumber: memberNumber || null,
        monthlyContribution: monthlyContributionPaise,
        totalMonths: parsedTotalMonths,
        currentMonth: 1,
        startDate: startDt,
        endDate: endDt,
        dueDayOfMonth: parseInt(dueDayOfMonth) || 10,
        foremanCommissionPercent: parseFloat(foremanCommissionPercent) || 5.0,
        paymentFrequency: paymentFrequency || 'MONTHLY',
        targetDailyAmount: targetDailyAmountPaise,
        status: status || 'ACTIVE',
        notes: notes || null,
      },
    });

    // Auto generate installment schedule
    await ensureInstallmentsExist(chit);

    const fullChit = await prisma.chitScheme.findUnique({
      where: { id: chit.id },
      include: {
        installments: { orderBy: { monthNumber: 'asc' } },
        auctions: true,
      },
    });

    broadcastEvent('chit_created', fullChit);
    res.status(201).json({ success: true, chit: fullChit });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/chits/:chitId
 * Update Chit Membership details
 */
export const updateChitScheme = async (req: AuthRequest, res: Response) => {
  try {
    const { chitId } = req.params;
    const {
      scope,
      chitName,
      chitCompany,
      chitNumber,
      totalValueRupees,
      totalMembers,
      monthlyContributionRupees,
      totalMonths,
      memberNumber,
      startDate,
      endDate,
      dueDayOfMonth,
      foremanCommissionPercent,
      paymentFrequency,
      targetDailyAmountRupees,
      status,
      notes,
    } = req.body;

    const existing = await prisma.chitScheme.findUnique({ where: { id: chitId } });
    if (!existing) return res.status(404).json({ success: false, message: 'Chit scheme not found' });

    const data: any = {};
    if (scope !== undefined) data.scope = scope;
    if (chitName !== undefined) data.chitName = chitName;
    if (chitCompany !== undefined) data.chitCompany = chitCompany;
    if (chitNumber !== undefined) data.chitNumber = chitNumber || null;
    if (memberNumber !== undefined) data.memberNumber = memberNumber || null;
    if (totalValueRupees !== undefined) data.totalValue = rupeesToPaise(totalValueRupees);
    if (totalMembers !== undefined) data.totalMembers = parseInt(totalMembers) || 50;
    if (monthlyContributionRupees !== undefined) data.monthlyContribution = rupeesToPaise(monthlyContributionRupees);
    if (totalMonths !== undefined) data.totalMonths = parseInt(totalMonths) || 50;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
    if (dueDayOfMonth !== undefined) data.dueDayOfMonth = parseInt(dueDayOfMonth) || 10;
    if (foremanCommissionPercent !== undefined) data.foremanCommissionPercent = parseFloat(foremanCommissionPercent) || 5.0;
    if (paymentFrequency !== undefined) data.paymentFrequency = paymentFrequency;
    if (targetDailyAmountRupees !== undefined) data.targetDailyAmount = rupeesToPaise(targetDailyAmountRupees);
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes || null;

    const updated = await prisma.chitScheme.update({
      where: { id: chitId },
      data,
      include: {
        installments: { orderBy: { monthNumber: 'asc' } },
        auctions: { orderBy: { auctionMonth: 'asc' } },
      },
    });

    broadcastEvent('chit_updated', updated);
    res.json({ success: true, chit: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/chits/:chitId
 */
export const deleteChitScheme = async (req: AuthRequest, res: Response) => {
  try {
    const { chitId } = req.params;
    await prisma.chitScheme.delete({ where: { id: chitId } });
    broadcastEvent('chit_deleted', { id: chitId });
    res.json({ success: true, message: 'Chit scheme deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/chits/:chitId/auctions
 * Record or edit a monthly auction entry.
 */
export const recordChitAuction = async (req: AuthRequest, res: Response) => {
  try {
    const { chitId } = req.params;
    const {
      auctionMonth,
      auctionDate,
      bidDiscountRupees,
      winningMemberNumber,
      foremanCommissionRupees,
      otherDeductionsRupees = 0,
      customDividendPerMemberRupees,
      isUserWon = false,
      notes,
    } = req.body;

    const chit = await prisma.chitScheme.findUnique({
      where: { id: chitId },
      include: { installments: true },
    });
    if (!chit) return res.status(404).json({ success: false, message: 'Chit scheme not found' });

    const monthNum = parseInt(auctionMonth);
    const bidDiscountPaise = rupeesToPaise(bidDiscountRupees);
    const otherDeductionsPaise = rupeesToPaise(otherDeductionsRupees || 0);

    let commissionPaise: number;
    if (foremanCommissionRupees !== undefined && foremanCommissionRupees !== '' && !isNaN(Number(foremanCommissionRupees))) {
      commissionPaise = rupeesToPaise(foremanCommissionRupees);
    } else {
      commissionPaise = Math.round(chit.totalValue * ((chit.foremanCommissionPercent || 5.0) / 100));
    }

    const dividendPoolPaise = Math.max(0, bidDiscountPaise - commissionPaise - otherDeductionsPaise);

    let dividendPerMemberPaise: number;
    if (customDividendPerMemberRupees !== undefined && customDividendPerMemberRupees !== '' && !isNaN(Number(customDividendPerMemberRupees))) {
      dividendPerMemberPaise = rupeesToPaise(customDividendPerMemberRupees);
    } else {
      dividendPerMemberPaise = chit.totalMembers > 0 ? Math.round(dividendPoolPaise / chit.totalMembers) : 0;
    }

    const auction = await prisma.$transaction(async (tx: any) => {
      const savedAuction = await tx.chitAuction.upsert({
        where: {
          chitSchemeId_auctionMonth: {
            chitSchemeId: chit.id,
            auctionMonth: monthNum,
          },
        },
        create: {
          chitSchemeId: chit.id,
          auctionMonth: monthNum,
          auctionDate: auctionDate ? new Date(auctionDate) : new Date(),
          bidDiscountAmount: bidDiscountPaise,
          winningMemberNumber: winningMemberNumber || null,
          foremanCommissionAmount: commissionPaise,
          otherDeductionsAmount: otherDeductionsPaise,
          dividendPoolAmount: dividendPoolPaise,
          dividendPerMember: dividendPerMemberPaise,
          isUserWon: Boolean(isUserWon),
          notes: notes || null,
        },
        update: {
          auctionDate: auctionDate ? new Date(auctionDate) : new Date(),
          bidDiscountAmount: bidDiscountPaise,
          winningMemberNumber: winningMemberNumber || null,
          foremanCommissionAmount: commissionPaise,
          otherDeductionsAmount: otherDeductionsPaise,
          dividendPoolAmount: dividendPoolPaise,
          dividendPerMember: dividendPerMemberPaise,
          isUserWon: Boolean(isUserWon),
          notes: notes || null,
        },
      });

      const existingInst = chit.installments.find((i: any) => i.monthNumber === monthNum);
      const originalInstalment = existingInst ? existingInst.amountExpected : chit.monthlyContribution;
      const netInstalment = Math.max(0, originalInstalment - dividendPerMemberPaise);

      if (existingInst) {
        let newStatus = existingInst.status;
        if (existingInst.amountPaid >= netInstalment && netInstalment > 0) {
          newStatus = 'PAID';
        } else if (existingInst.amountPaid > 0) {
          newStatus = 'PARTIALLY_PAID';
        } else {
          newStatus = 'PENDING';
        }

        await tx.chitInstallment.update({
          where: { id: existingInst.id },
          data: {
            dividendEarned: dividendPerMemberPaise,
            netInstalment: netInstalment,
            status: newStatus,
          },
        });
      } else {
        const dueDate = new Date(chit.startDate);
        dueDate.setMonth(dueDate.getMonth() + (monthNum - 1));
        const daysInMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
        dueDate.setDate(Math.min(chit.dueDayOfMonth, daysInMonth));

        await tx.chitInstallment.create({
          data: {
            chitSchemeId: chit.id,
            monthNumber: monthNum,
            dueDate,
            amountExpected: originalInstalment,
            dividendEarned: dividendPerMemberPaise,
            netInstalment: netInstalment,
            amountPaid: 0,
            status: 'PENDING',
          },
        });
      }

      if (isUserWon) {
        const grossPrize = chit.totalValue - bidDiscountPaise;
        const netPrize = grossPrize - commissionPaise - otherDeductionsPaise;

        await tx.chitScheme.update({
          where: { id: chit.id },
          data: {
            isPrized: true,
            prizedMonth: monthNum,
            winningDate: auctionDate ? new Date(auctionDate) : new Date(),
            auctionDiscount: bidDiscountPaise,
            grossPrizeAmount: grossPrize,
            foremanCommissionAmount: commissionPaise,
            otherDeductionsAmount: otherDeductionsPaise,
            netPrizeAmount: netPrize,
            prizedAmount: netPrize,
          },
        });
      }

      return savedAuction;
    });

    const refreshedChit = await prisma.chitScheme.findUnique({
      where: { id: chitId },
      include: {
        installments: { orderBy: { monthNumber: 'asc' } },
        auctions: { orderBy: { auctionMonth: 'asc' } },
      },
    });

    broadcastEvent('chit_auction_recorded', { chit: refreshedChit, auction });
    res.json({ success: true, auction, chit: refreshedChit });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/chits/:chitId/prize
 * Record Chit Winning / Prize Money Details & Receipts.
 */
export const recordChitPrize = async (req: AuthRequest, res: Response) => {
  try {
    const { chitId } = req.params;
    const {
      winningMonth,
      winningDate,
      auctionDiscountRupees,
      foremanCommissionRupees,
      otherDeductionsRupees = 0,
      actualAmountReceivedRupees,
      amountReceivedDate,
      paymentReference,
      paymentAccountId,
      notes,
    } = req.body;

    const chit = await prisma.chitScheme.findUnique({ where: { id: chitId } });
    if (!chit) return res.status(404).json({ success: false, message: 'Chit scheme not found' });

    const auctionDiscountPaise = rupeesToPaise(auctionDiscountRupees);
    const grossPrizePaise = chit.totalValue - auctionDiscountPaise;

    let commissionPaise: number;
    if (foremanCommissionRupees !== undefined && foremanCommissionRupees !== '' && !isNaN(Number(foremanCommissionRupees))) {
      commissionPaise = rupeesToPaise(foremanCommissionRupees);
    } else {
      commissionPaise = Math.round(chit.totalValue * ((chit.foremanCommissionPercent || 5.0) / 100));
    }

    const otherDeductionsPaise = rupeesToPaise(otherDeductionsRupees || 0);
    const netPrizePaise = Math.max(0, grossPrizePaise - commissionPaise - otherDeductionsPaise);

    const actualReceivedPaise = actualAmountReceivedRupees !== undefined && actualAmountReceivedRupees !== ''
      ? rupeesToPaise(actualAmountReceivedRupees)
      : netPrizePaise;

    const result = await prisma.$transaction(async (tx: any) => {
      const updatedChit = await tx.chitScheme.update({
        where: { id: chit.id },
        data: {
          isPrized: true,
          prizedMonth: parseInt(winningMonth) || chit.currentMonth,
          winningDate: winningDate ? new Date(winningDate) : new Date(),
          auctionDiscount: auctionDiscountPaise,
          grossPrizeAmount: grossPrizePaise,
          foremanCommissionAmount: commissionPaise,
          otherDeductionsAmount: otherDeductionsPaise,
          netPrizeAmount: netPrizePaise,
          prizeReceivedAmount: actualReceivedPaise,
          prizeReceivedDate: amountReceivedDate ? new Date(amountReceivedDate) : new Date(),
          prizePaymentReference: paymentReference || null,
          prizedAmount: actualReceivedPaise,
          notes: notes ? (chit.notes ? `${chit.notes}\n${notes}` : notes) : chit.notes,
        },
        include: {
          installments: { orderBy: { monthNumber: 'asc' } },
          auctions: { orderBy: { auctionMonth: 'asc' } },
        },
      });

      if (actualReceivedPaise > 0 && paymentAccountId) {
        await tx.paymentMethodAccount.update({
          where: { id: paymentAccountId },
          data: { currentBalance: { increment: actualReceivedPaise } },
        });

        await tx.transaction.create({
          data: {
            scope: chit.scope,
            type: 'CHIT_PRIZE_PAYOUT',
            category: 'Chit Prize Money',
            amount: actualReceivedPaise,
            paymentMethod: 'BANK',
            paymentMethodAccountId: paymentAccountId,
            source: chit.chitCompany,
            destination: 'Account',
            reference: paymentReference || null,
            description: `Chit Prize Lifted for ${chit.chitName} (Month ${winningMonth || chit.currentMonth})`,
            createdById: req.user!.id,
          },
        });
      }

      return updatedChit;
    });

    broadcastEvent('chit_prize_recorded', result);
    res.json({ success: true, chit: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/chits/:chitId/pay
 * Record an installment payment.
 */
export const payChitInstallment = async (req: AuthRequest, res: Response) => {
  try {
    const { chitId } = req.params;
    const {
      monthNumber,
      amountRupees,
      dividendRupees = 0,
      paymentMethod = 'BANK',
      paymentAccountId,
      upiTransactionId,
      paidDate,
      notes,
    } = req.body;

    const receiptUrl = (req as any).fileUrl || (req.body.receiptUrl ? String(req.body.receiptUrl) : null);

    const chit = await prisma.chitScheme.findUnique({
      where: { id: chitId },
      include: { installments: true },
    });
    if (!chit) return res.status(404).json({ success: false, message: 'Chit scheme not found' });

    const targetMonth = parseInt(monthNumber) || chit.currentMonth;
    const amountPaise = rupeesToPaise(amountRupees);
    const dividendPaise = rupeesToPaise(dividendRupees);

    if (amountPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero.' });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      let inst = chit.installments.find((i: any) => i.monthNumber === targetMonth);
      const originalAmount = inst ? inst.amountExpected : chit.monthlyContribution;
      const netInstalment = Math.max(0, originalAmount - dividendPaise);

      const cumulativePaid = (inst ? inst.amountPaid : 0) + amountPaise;
      let newStatus = 'PAID';
      if (cumulativePaid < netInstalment) {
        newStatus = 'PARTIALLY_PAID';
      }

      if (inst) {
        inst = await tx.chitInstallment.update({
          where: { id: inst.id },
          data: {
            amountPaid: cumulativePaid,
            dividendEarned: dividendPaise > 0 ? dividendPaise : inst.dividendEarned,
            netInstalment,
            status: newStatus,
            paidDate: paidDate ? new Date(paidDate) : new Date(),
            paymentMethod,
            paymentMethodAccountId: paymentAccountId || null,
            upiTransactionId: upiTransactionId || null,
            receiptUrl: receiptUrl || inst.receiptUrl,
            notes: notes || inst.notes,
          },
        });
      } else {
        const dueDate = new Date(chit.startDate);
        dueDate.setMonth(dueDate.getMonth() + (targetMonth - 1));
        const daysInMonth = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate();
        dueDate.setDate(Math.min(chit.dueDayOfMonth, daysInMonth));

        inst = await tx.chitInstallment.create({
          data: {
            chitSchemeId: chit.id,
            monthNumber: targetMonth,
            dueDate,
            amountExpected: originalAmount,
            dividendEarned: dividendPaise,
            netInstalment,
            amountPaid: cumulativePaid,
            status: newStatus,
            paidDate: paidDate ? new Date(paidDate) : new Date(),
            paymentMethod,
            paymentMethodAccountId: paymentAccountId || null,
            upiTransactionId: upiTransactionId || null,
            receiptUrl,
            notes,
          },
        });
      }

      // Record in ChitPaymentLog so user can view every daily / partial payment entry
      await tx.chitPaymentLog.create({
        data: {
          chitSchemeId: chit.id,
          installmentId: inst!.id,
          amount: amountPaise,
          paidDate: paidDate ? new Date(paidDate) : new Date(),
          paymentMethod,
          paymentMethodAccountId: paymentAccountId || null,
          reference: upiTransactionId || null,
          receiptUrl,
          notes,
          createdById: req.user!.id,
        },
      });

      // Advance current month if needed (only if full net instalment is paid)
      if (newStatus === 'PAID' && targetMonth >= chit.currentMonth && chit.currentMonth < chit.totalMonths) {
        await tx.chitScheme.update({
          where: { id: chit.id },
          data: { currentMonth: targetMonth + 1 },
        });
      }

      // Deduct from payment account if provided
      if (paymentAccountId) {
        await tx.paymentMethodAccount.update({
          where: { id: paymentAccountId },
          data: { currentBalance: { decrement: amountPaise } },
        });
      }

      // Create transaction record
      await tx.transaction.create({
        data: {
          scope: chit.scope,
          type: 'CHIT_CONTRIBUTION',
          category: 'Chit Contribution',
          amount: amountPaise,
          paymentMethod,
          paymentMethodAccountId: paymentAccountId || null,
          reference: upiTransactionId || null,
          source: 'Account',
          destination: chit.chitCompany,
          description: `Chit Installment #${targetMonth} for ${chit.chitName}`,
          chitInstallmentId: inst!.id,
          createdById: req.user!.id,
        },
      });

      return inst;
    });

    const refreshed = await prisma.chitScheme.findUnique({
      where: { id: chitId },
      include: {
        installments: { orderBy: { monthNumber: 'asc' } },
        auctions: { orderBy: { auctionMonth: 'asc' } },
      },
    });

    broadcastEvent('chit_paid', { chit: refreshed, installment: result });
    res.json({ success: true, installment: result, chit: refreshed });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/chits/installments/:installmentId
 * Edit an installment record.
 */
export const updateChitInstallment = async (req: AuthRequest, res: Response) => {
  try {
    const { installmentId } = req.params;
    const {
      amountPaidRupees,
      dividendRupees,
      status,
      paymentMethod,
      upiTransactionId,
      paidDate,
      notes,
    } = req.body;

    const existing = await prisma.chitInstallment.findUnique({
      where: { id: installmentId },
      include: { chitScheme: true, transaction: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Installment record not found' });

    const newAmountPaid = amountPaidRupees !== undefined ? rupeesToPaise(amountPaidRupees) : existing.amountPaid;
    const newDividend = dividendRupees !== undefined ? rupeesToPaise(dividendRupees) : existing.dividendEarned;
    const netInstalment = Math.max(0, existing.amountExpected - newDividend);

    let finalStatus = status || existing.status;
    if (!status && amountPaidRupees !== undefined) {
      if (newAmountPaid >= netInstalment && netInstalment > 0) finalStatus = 'PAID';
      else if (newAmountPaid > 0) finalStatus = 'PARTIALLY_PAID';
      else finalStatus = 'PENDING';
    }

    const differencePaise = newAmountPaid - existing.amountPaid;

    const result = await prisma.$transaction(async (tx: any) => {
      if (differencePaise !== 0 && existing.transaction?.paymentMethodAccountId) {
        await tx.paymentMethodAccount.update({
          where: { id: existing.transaction.paymentMethodAccountId },
          data: { currentBalance: { decrement: differencePaise } },
        });

        await tx.transaction.update({
          where: { id: existing.transaction.id },
          data: {
            amount: newAmountPaid,
            reference: upiTransactionId !== undefined ? upiTransactionId : existing.transaction.reference,
          },
        });
      }

      const updated = await tx.chitInstallment.update({
        where: { id: installmentId },
        data: {
          amountPaid: newAmountPaid,
          dividendEarned: newDividend,
          netInstalment,
          status: finalStatus,
          paymentMethod: paymentMethod || existing.paymentMethod,
          upiTransactionId: upiTransactionId !== undefined ? upiTransactionId : existing.upiTransactionId,
          paidDate: paidDate ? new Date(paidDate) : existing.paidDate,
          notes: notes !== undefined ? notes : existing.notes,
        },
      });

      return updated;
    });

    const refreshedChit = await prisma.chitScheme.findUnique({
      where: { id: existing.chitSchemeId },
      include: {
        installments: { orderBy: { monthNumber: 'asc' } },
        auctions: { orderBy: { auctionMonth: 'asc' } },
      },
    });

    broadcastEvent('chit_installment_updated', { installment: result, chit: refreshedChit });
    res.json({ success: true, installment: result, chit: refreshedChit });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/chits/installments/:installmentId/payment
 * Revert/delete a payment only after confirmation.
 */
export const revertChitPayment = async (req: AuthRequest, res: Response) => {
  try {
    const { installmentId } = req.params;

    const existing = await prisma.chitInstallment.findUnique({
      where: { id: installmentId },
      include: { chitScheme: true, transaction: true },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Installment not found' });

    await prisma.$transaction(async (tx: any) => {
      if (existing.amountPaid > 0 && existing.transaction?.paymentMethodAccountId) {
        await tx.paymentMethodAccount.update({
          where: { id: existing.transaction.paymentMethodAccountId },
          data: { currentBalance: { increment: existing.amountPaid } },
        });
      }

      if (existing.transaction) {
        await tx.transaction.delete({ where: { id: existing.transaction.id } });
      }

      // Also clean up any payment logs attached to this installment
      await tx.chitPaymentLog.deleteMany({
        where: { installmentId },
      });

      await tx.chitInstallment.update({
        where: { id: installmentId },
        data: {
          amountPaid: 0,
          status: 'PENDING',
          paidDate: null,
          upiTransactionId: null,
          receiptUrl: null,
        },
      });
    });

    const refreshedChit = await prisma.chitScheme.findUnique({
      where: { id: existing.chitSchemeId },
      include: {
        installments: { orderBy: { monthNumber: 'asc' } },
        auctions: { orderBy: { auctionMonth: 'asc' } },
      },
    });

    broadcastEvent('chit_payment_reverted', { installmentId, chit: refreshedChit });
    res.json({ success: true, message: 'Payment reverted successfully', chit: refreshedChit });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
