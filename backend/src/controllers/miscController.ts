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
      insuranceType = 'Shop Insurance',
      policyName,
      company,
      policyNumber,
      premiumAmountRupees,
      frequency = 'YEARLY',
      startDate,
      expiryDate,
      vehicleOrAsset,
    } = req.body;

    const premiumPaise = rupeesToPaise(premiumAmountRupees);

    const policy = await prisma.insurancePolicy.create({
      data: {
        insuranceType,
        policyName,
        company,
        policyNumber,
        premiumAmount: premiumPaise,
        frequency,
        startDate: startDate ? new Date(startDate) : new Date(),
        expiryDate: new Date(expiryDate),
        nextPaymentDate: new Date(expiryDate),
        vehicleOrAsset: vehicleOrAsset || null,
        status: 'ACTIVE',
      },
    });

    broadcastEvent('insurance_created', policy);
    res.status(201).json({ success: true, policy });
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

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
