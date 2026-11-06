import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { rupeesToPaise } from '../utils/currency.js';
import { getTodayIST, parseDateIST } from '../utils/date.js';
import { broadcastEvent } from '../websocket/socket.js';

/**
 * Get daily savings entries for a given month or year.
 * Defaults to current month in IST.
 */
export const getDailySavings = async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query; // month: 1-12, year: 2026

    const now = new Date();
    const targetYear = year ? parseInt(String(year), 10) : now.getFullYear();
    const targetMonth = month ? parseInt(String(month), 10) : now.getMonth() + 1;

    // Start & End of target month in UTC
    const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

    const entries = await prisma.dailySavingsEntry.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Compute monthly summary
    const totalCollectedPaise = entries
      .filter((e) => e.status === 'COLLECTED')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalDaysRecorded = entries.length;

    // Also get all-time grand total
    const allEntries = await prisma.dailySavingsEntry.findMany({
      where: { status: 'COLLECTED' },
      select: { amount: true },
    });
    const grandTotalPaise = allEntries.reduce((sum, e) => sum + e.amount, 0);

    // Check today's status
    const today = getTodayIST();
    const todayEntry = await prisma.dailySavingsEntry.findUnique({
      where: { date: today },
    });

    const cleanPhone = '7981037237';
    const todayDateStr = today.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const isCollectedToday = todayEntry && todayEntry.status === 'COLLECTED';
    const todayAmountRupees = todayEntry ? todayEntry.amount / 100 : 3000;

    const reminderMessage = isCollectedToday
      ? `✅ SVE Daily Future Savings: ₹${todayAmountRupees.toLocaleString('en-IN')} for today (${todayDateStr}) is marked as COLLECTED. Grand Total: ₹${(grandTotalPaise / 100).toLocaleString('en-IN')}.`
      : `🔔 12:30 PM Mandatory Alert: Collect today's savings amount of ₹${todayAmountRupees.toLocaleString('en-IN')} (${todayDateStr}) for your future savings fund!`;

    const whatsappUrl = `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(reminderMessage)}`;

    res.json({
      success: true,
      month: targetMonth,
      year: targetYear,
      entries,
      totalCollectedRupees: totalCollectedPaise / 100,
      totalDaysRecorded,
      grandTotalRupees: grandTotalPaise / 100,
      todayStatus: todayEntry?.status || 'PENDING',
      todayAmountRupees,
      reminder: {
        isCollected: !!isCollectedToday,
        message: reminderMessage,
        whatsappUrl,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Record or update a single day's savings amount or status.
 * Default amount is ₹3,000. Allows user to edit amount only.
 */
export const upsertDailySavingsEntry = async (req: AuthRequest, res: Response) => {
  try {
    const { date, amountRupees, status = 'COLLECTED', notes } = req.body;

    const entryDate = parseDateIST(date);
    const amountPaise = amountRupees !== undefined ? rupeesToPaise(amountRupees) : 300000; // default ₹3,000

    const entry = await prisma.dailySavingsEntry.upsert({
      where: { date: entryDate },
      update: {
        amount: amountPaise,
        status,
        notes: notes !== undefined ? notes : undefined,
      },
      create: {
        date: entryDate,
        amount: amountPaise,
        status,
        notes: notes || null,
      },
    });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          action: 'DAILY_SAVINGS_UPDATED',
          entityType: 'DAILY_SAVINGS',
          entityId: entry.id,
          amount: entry.amount,
          details: JSON.stringify({
            date: entryDate.toISOString().split('T')[0],
            amountRupees: entry.amount / 100,
            status: entry.status,
            notes: entry.notes,
          }),
        },
      });
    }

    broadcastEvent('daily_savings_updated', entry);

    res.json({
      success: true,
      entry,
      message: `Daily savings for ${entryDate.toLocaleDateString('en-IN')} updated to ₹${(entry.amount / 100).toLocaleString('en-IN')}`,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
