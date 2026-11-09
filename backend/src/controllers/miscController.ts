import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { rupeesToPaise } from '../utils/currency.js';
import { broadcastEvent } from '../websocket/socket.js';

export const getPaymentAccounts = async (_req: AuthRequest, res: Response) => {
  try {
    const accounts = await prisma.paymentMethodAccount.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    // Return both formats for complete backward & forward compatibility
    res.json(accounts);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePaymentAccountBalance = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { balanceRupees, reason } = req.body;

    if (balanceRupees === undefined || balanceRupees === null) {
      return res.status(400).json({ success: false, message: 'Balance amount in rupees is required.' });
    }

    const newBalancePaise = rupeesToPaise(balanceRupees);

    const account = await prisma.$transaction(async (tx) => {
      const existing = await tx.paymentMethodAccount.findUnique({ where: { id } });
      if (!existing) throw new Error('Account not found');

      const updated = await tx.paymentMethodAccount.update({
        where: { id },
        data: { currentBalance: newBalancePaise },
      });

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userEmail: req.user!.email,
          action: 'ACCOUNT_BALANCE_ADJUSTED',
          entityType: 'PAYMENT_ACCOUNT',
          entityId: id,
          amount: newBalancePaise,
          details: JSON.stringify({
            accountName: existing.name,
            oldBalance: existing.currentBalance,
            newBalance: newBalancePaise,
            reason: reason || 'Manual opening/correction balance update',
          }),
        },
      });

      return updated;
    });

    broadcastEvent('payment_account_updated', account);
    res.json({ success: true, message: 'Account balance updated successfully', account });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getInsurancePolicies = async (req: AuthRequest, res: Response) => {
  try {
    const policies = await prisma.insurancePolicy.findMany({
      orderBy: { expiryDate: 'asc' },
    });
    res.json({ success: true, policies });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createInsurancePolicy = async (req: AuthRequest, res: Response) => {
  try {
    const {
      scope = 'BUSINESS',
      insuranceType = 'Shop Insurance',
      policyName,
      company,
      policyNumber,
      policyHolder,
      nominee,
      sumAssuredRupees,
      premiumAmountRupees,
      frequency = 'YEARLY',
      startDate,
      expiryDate,
      maturityDate,
      intimationDate,
      remindDays = 7,
      vehicleOrAsset,
      notes,
    } = req.body;

    const premiumPaise = rupeesToPaise(premiumAmountRupees);
    const sumAssuredPaise = sumAssuredRupees ? rupeesToPaise(sumAssuredRupees) : 0;

    const policy = await prisma.insurancePolicy.create({
      data: {
        scope,
        insuranceType,
        policyName,
        company,
        policyNumber,
        policyHolder: policyHolder || null,
        nominee: nominee || null,
        sumAssured: sumAssuredPaise,
        premiumAmount: premiumPaise,
        frequency,
        startDate: startDate ? new Date(startDate) : new Date(),
        expiryDate: new Date(expiryDate),
        maturityDate: maturityDate ? new Date(maturityDate) : null,
        nextPaymentDate: new Date(expiryDate),
        reminderDays: parseInt(String(remindDays)) || 7,
        vehicleOrAsset: vehicleOrAsset || null,
        notes: notes || null,
        status: 'ACTIVE',
      },
    });

    // Automatically create a Reminder notification for premium renewal & intimation
    const reminderDueDate = intimationDate ? new Date(intimationDate) : new Date(expiryDate);
    await prisma.reminder.create({
      data: {
        title: `Insurance Premium Due: ${policyName} (${company})`,
        description: `Policy #${policyNumber} renewal premium of ₹${parseFloat(premiumAmountRupees).toLocaleString('en-IN')}. Frequency: ${frequency}.`,
        dueDate: reminderDueDate,
        amount: premiumPaise,
        type: 'INSURANCE_EXPIRY',
        referenceId: policy.id,
        remindDays: parseInt(String(remindDays)) || 7,
      },
    });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          action: 'INSURANCE_CREATED',
          entityType: 'INSURANCE',
          entityId: policy.id,
          amount: premiumPaise,
          details: JSON.stringify({
            policyName: policy.policyName,
            company: policy.company,
            policyNumber: policy.policyNumber,
            scope: policy.scope,
            premiumRupees: premiumAmountRupees,
            frequency: policy.frequency,
          }),
        },
      });
    }

    broadcastEvent('insurance_created', policy);
    res.status(201).json({ success: true, policy });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateInsurancePolicy = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      scope,
      insuranceType,
      policyName,
      company,
      policyNumber,
      policyHolder,
      nominee,
      sumAssuredRupees,
      premiumAmountRupees,
      frequency,
      startDate,
      expiryDate,
      maturityDate,
      remindDays,
      status,
      vehicleOrAsset,
      notes,
    } = req.body;

    const data: any = {};
    if (scope !== undefined) data.scope = scope;
    if (insuranceType !== undefined) data.insuranceType = insuranceType;
    if (policyName !== undefined) data.policyName = policyName;
    if (company !== undefined) data.company = company;
    if (policyNumber !== undefined) data.policyNumber = policyNumber;
    if (policyHolder !== undefined) data.policyHolder = policyHolder || null;
    if (nominee !== undefined) data.nominee = nominee || null;
    if (sumAssuredRupees !== undefined) data.sumAssured = rupeesToPaise(sumAssuredRupees);
    if (premiumAmountRupees !== undefined) data.premiumAmount = rupeesToPaise(premiumAmountRupees);
    if (frequency !== undefined) data.frequency = frequency;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (expiryDate !== undefined) {
      data.expiryDate = new Date(expiryDate);
      data.nextPaymentDate = new Date(expiryDate);
    }
    if (maturityDate !== undefined) data.maturityDate = maturityDate ? new Date(maturityDate) : null;
    if (remindDays !== undefined) data.reminderDays = parseInt(String(remindDays)) || 7;
    if (status !== undefined) data.status = status;
    if (vehicleOrAsset !== undefined) data.vehicleOrAsset = vehicleOrAsset || null;
    if (notes !== undefined) data.notes = notes || null;

    const policy = await prisma.insurancePolicy.update({
      where: { id },
      data,
    });

    // Update associated reminders if exists
    if (data.expiryDate || data.premiumAmount || data.policyName) {
      await prisma.reminder.updateMany({
        where: { referenceId: id },
        data: {
          title: `Insurance Premium Due: ${policy.policyName} (${policy.company})`,
          dueDate: policy.expiryDate,
          amount: policy.premiumAmount,
        },
      });
    }

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          action: 'INSURANCE_UPDATED',
          entityType: 'INSURANCE',
          entityId: policy.id,
          amount: policy.premiumAmount,
          details: JSON.stringify({
            policyName: policy.policyName,
            company: policy.company,
            policyNumber: policy.policyNumber,
            scope: policy.scope,
            status: policy.status,
          }),
        },
      });
    }

    broadcastEvent('insurance_updated', policy);
    res.json({ success: true, policy });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteInsurancePolicy = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Delete associated reminders first
    await prisma.reminder.deleteMany({
      where: { referenceId: id },
    });

    const deleted = await prisma.insurancePolicy.delete({
      where: { id },
    });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          action: 'INSURANCE_DELETED',
          entityType: 'INSURANCE',
          entityId: deleted.id,
          amount: deleted.premiumAmount,
          details: JSON.stringify({
            policyName: deleted.policyName,
            company: deleted.company,
            policyNumber: deleted.policyNumber,
            scope: deleted.scope,
          }),
        },
      });
    }

    broadcastEvent('insurance_deleted', { id });
    res.json({ success: true, message: 'Insurance policy deleted successfully', id: deleted.id });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getReminders = async (req: AuthRequest, res: Response) => {
  try {
    const reminders = await prisma.reminder.findMany({
      where: { isCompleted: false },
      orderBy: { dueDate: 'asc' },
    });
    res.json({ success: true, reminders });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createReminder = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, dueDate, amountRupees, type = 'OTHER', remindDays = 3 } = req.body;
    const amountPaise = amountRupees ? rupeesToPaise(amountRupees) : null;

    const reminder = await prisma.reminder.create({
      data: {
        title,
        description: description || null,
        dueDate: new Date(dueDate),
        amount: amountPaise,
        type,
        remindDays: parseInt(String(remindDays)),
      },
    });

    broadcastEvent('reminder_created', reminder);
    res.status(201).json({ success: true, reminder });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const completeReminder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reminder = await prisma.reminder.update({
      where: { id },
      data: { isCompleted: true },
    });
    res.json({ success: true, reminder });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteReminder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.reminder.delete({
      where: { id },
    });
    res.json({ success: true, message: 'Reminder deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const uploadReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'No file uploaded.' });

    const { title, category = 'OTHER', referenceId, notes } = req.body;
    const fileUrl = `/uploads/${file.filename}`;

    const receipt = await prisma.documentReceipt.create({
      data: {
        title: title || file.originalname,
        category,
        fileUrl,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        referenceId: referenceId || null,
        notes: notes || null,
      },
    });

    res.status(201).json({ success: true, receipt });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getReceipts = async (req: AuthRequest, res: Response) => {
  try {
    const { category } = req.query;
    const where: any = {};
    if (category && category !== 'ALL') where.category = String(category);

    const receipts = await prisma.documentReceipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, receipts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getShopSettings = async (_req: AuthRequest, res: Response) => {
  try {
    let settings = await prisma.shopSettings.findFirst();
    if (!settings) {
      settings = await prisma.shopSettings.create({
        data: {
          shopName: 'SVE Store',
          tagline: 'Automotive Spare Parts & Retail',
          email: 'contact@sve.in',
          accessCode: 'SVE-2026',
        },
      });
    }
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateShopSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { shopName, tagline, address, phone, email, gstNumber, upiId, accessCode } = req.body;
    let settings = await prisma.shopSettings.findFirst();

    const updateData: any = {};
    if (shopName !== undefined) updateData.shopName = shopName;
    if (tagline !== undefined) updateData.tagline = tagline;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (gstNumber !== undefined) updateData.gstNumber = gstNumber;
    if (upiId !== undefined) updateData.upiId = upiId ? upiId.trim() : '';
    if (accessCode !== undefined) updateData.accessCode = accessCode.trim();

    if (!settings) {
      settings = await prisma.shopSettings.create({
        data: {
          shopName: shopName || 'SVE Store',
          accessCode: accessCode || 'SVE-2026',
          ...updateData,
        },
      });
    } else {
      settings = await prisma.shopSettings.update({
        where: { id: settings.id },
        data: updateData,
      });
    }

    broadcastEvent('settings_updated', settings);
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
    });
    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ================= CHIT FUNDS CONTROLLER =================
export const getChitSchemes = async (req: AuthRequest, res: Response) => {
  try {
    const { scope } = req.query;
    const where: any = {};
    if (scope && scope !== 'OVERALL') where.scope = String(scope);

    const chits = await prisma.chitScheme.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        installments: { orderBy: { monthNumber: 'desc' }, take: 12 },
      },
    });
    res.json({ success: true, chits });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createChitScheme = async (req: AuthRequest, res: Response) => {
  try {
    const {
      scope = 'PERSONAL',
      chitName,
      chitCompany,
      chitNumber,
      totalValueRupees,
      monthlyContributionRupees,
      totalMonths,
      startDate,
      dueDayOfMonth = 10,
      notes,
    } = req.body;

    const totalValuePaise = rupeesToPaise(totalValueRupees);
    const monthlyContributionPaise = rupeesToPaise(monthlyContributionRupees);

    const chit = await prisma.chitScheme.create({
      data: {
        scope,
        chitName,
        chitCompany,
        chitNumber: chitNumber || null,
        totalValue: totalValuePaise,
        monthlyContribution: monthlyContributionPaise,
        totalMonths: parseInt(totalMonths) || 50,
        startDate: startDate ? new Date(startDate) : new Date(),
        dueDayOfMonth: parseInt(dueDayOfMonth) || 10,
        notes: notes || null,
        status: 'ACTIVE',
      },
    });

    broadcastEvent('chit_created', chit);
    res.status(201).json({ success: true, chit });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const payChitInstallment = async (req: AuthRequest, res: Response) => {
  try {
    const { chitId } = req.params;
    const { amountRupees, dividendRupees = 0, paymentAccountId } = req.body;

    const amountPaise = rupeesToPaise(amountRupees);
    const dividendPaise = rupeesToPaise(dividendRupees);

    const chit = await prisma.chitScheme.findUnique({ where: { id: chitId } });
    if (!chit) return res.status(404).json({ success: false, message: 'Chit scheme not found' });

    const result = await prisma.$transaction(async (tx) => {
      const installment = await tx.chitInstallment.create({
        data: {
          chitSchemeId: chit.id,
          monthNumber: chit.currentMonth,
          dueDate: new Date(),
          amountExpected: chit.monthlyContribution,
          amountPaid: amountPaise,
          dividendEarned: dividendPaise,
          status: 'PAID',
          paidDate: new Date(),
          paymentMethod: 'BANK',
        },
      });

      await tx.chitScheme.update({
        where: { id: chit.id },
        data: { currentMonth: { increment: 1 } },
      });

      if (paymentAccountId) {
        await tx.paymentMethodAccount.update({
          where: { id: paymentAccountId },
          data: { currentBalance: { decrement: amountPaise } },
        });
      }

      await tx.transaction.create({
        data: {
          scope: chit.scope,
          type: 'CHIT_CONTRIBUTION',
          category: 'Chit Contribution',
          amount: amountPaise,
          paymentMethod: 'BANK',
          paymentMethodAccountId: paymentAccountId || null,
          source: 'Account',
          destination: chit.chitCompany,
          description: `Chit Installment #${chit.currentMonth} for ${chit.chitName}`,
          chitInstallmentId: installment.id,
          createdById: req.user!.id,
        },
      });

      return installment;
    });

    broadcastEvent('chit_paid', result);
    res.json({ success: true, installment: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// ================= PERSONAL INCOME CONTROLLER =================
export const getPersonalIncomes = async (req: AuthRequest, res: Response) => {
  try {
    const { scope } = req.query;
    const where: any = {};
    if (scope && scope !== 'OVERALL') where.scope = String(scope);

    const incomes = await prisma.personalIncome.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        paymentMethodAccount: { select: { id: true, name: true } },
      },
    });
    res.json({ success: true, incomes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createPersonalIncome = async (req: AuthRequest, res: Response) => {
  try {
    const {
      scope = 'PERSONAL',
      source,
      amountRupees,
      date,
      paymentMethod = 'BANK',
      paymentMethodAccountId,
      description,
    } = req.body;

    const amountPaise = rupeesToPaise(amountRupees);
    if (amountPaise <= 0) {
      return res.status(400).json({ success: false, message: 'Income amount must be greater than zero.' });
    }

    const income = await prisma.$transaction(async (tx) => {
      const newIncome = await tx.personalIncome.create({
        data: {
          scope,
          source,
          amount: amountPaise,
          date: date ? new Date(date) : new Date(),
          paymentMethod,
          paymentMethodAccountId: paymentMethodAccountId || null,
          description: description || null,
          createdById: req.user!.id,
        },
      });

      if (paymentMethodAccountId) {
        await tx.paymentMethodAccount.update({
          where: { id: paymentMethodAccountId },
          data: { currentBalance: { increment: amountPaise } },
        });
      }

      await tx.transaction.create({
        data: {
          scope,
          type: 'INCOME',
          category: `Personal: ${source}`,
          amount: amountPaise,
          date: date ? new Date(date) : new Date(),
          paymentMethod,
          paymentMethodAccountId: paymentMethodAccountId || null,
          source,
          destination: 'Personal Account',
          description: description || `Personal income from ${source}`,
          personalIncomeId: newIncome.id,
          createdById: req.user!.id,
        },
      });

      return newIncome;
    });

    broadcastEvent('personal_income_created', income);
    res.status(201).json({ success: true, income });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

