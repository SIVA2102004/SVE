import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { rupeesToPaise } from '../utils/currency.js';
import { broadcastEvent } from '../websocket/socket.js';

export const getStaff = async (req: AuthRequest, res: Response) => {
  try {
    const staff = await prisma.staff.findMany({
      orderBy: { name: 'asc' },
      include: {
        attendance: {
          orderBy: { date: 'desc' },
          take: 31,
        },
        salaryRecords: {
          orderBy: { createdAt: 'desc' },
          take: 6,
        },
      },
    });

    res.json({ success: true, staff });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { name, mobile, address, salaryType = 'MONTHLY', monthlySalaryRupees, dailyWageRupees, bankDetails, notes } =
      req.body;

    if (!name || !mobile) {
      return res.status(400).json({ success: false, message: 'Staff name and mobile are required.' });
    }

    const monthlyPaise = monthlySalaryRupees ? rupeesToPaise(monthlySalaryRupees) : 0;
    const dailyPaise = dailyWageRupees ? rupeesToPaise(dailyWageRupees) : 0;

    const staffMember = await prisma.staff.create({
      data: {
        name,
        mobile,
        address: address || null,
        salaryType,
        monthlySalary: monthlyPaise,
        dailyWage: dailyPaise,
        bankDetails: bankDetails || null,
        notes: notes || null,
      },
    });

    broadcastEvent('staff_created', staffMember);
    res.status(201).json({ success: true, staffMember });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const markAttendance = async (req: AuthRequest, res: Response) => {
  try {
    const { staffId, date, status, notes } = req.body;
    // status: PRESENT, ABSENT, HALF_DAY, LEAVE, HOLIDAY

    if (!staffId || !status) {
      return res.status(400).json({ success: false, message: 'Staff ID and attendance status are required.' });
    }

    const attDate = date ? new Date(date) : new Date();
    attDate.setHours(0, 0, 0, 0);

    const record = await prisma.attendance.upsert({
      where: {
        staffId_date: {
          staffId,
          date: attDate,
        },
      },
      update: {
        status,
        notes: notes || null,
      },
      create: {
        staffId,
        date: attDate,
        status,
        notes: notes || null,
      },
    });

    broadcastEvent('attendance_marked', record);
    res.json({ success: true, record });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const calculateAndPaySalary = async (req: AuthRequest, res: Response) => {
  try {
    const { staffId, month, year, advanceRupees = 0, bonusRupees = 0, deductionRupees = 0, paymentMethod = 'CASH', paymentMethodAccountId } =
      req.body;

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: { attendance: true },
    });

    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });

    // Calculate attendance for specified month
    const m = parseInt(String(month));
    const y = parseInt(String(year));

    const startOfMonth = new Date(y, m - 1, 1);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);

    const monthAttendance = await prisma.attendance.findMany({
      where: {
        staffId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    const totalDaysInMonth = new Date(y, m, 0).getDate();
    const workingDaysStandard = 26;

    let presentDays = 0;
    let halfDays = 0;
    monthAttendance.forEach((a) => {
      if (a.status === 'PRESENT') presentDays += 1;
      else if (a.status === 'HALF_DAY') halfDays += 0.5;
    });

    const effectivePresentDays = presentDays + halfDays;

    let baseSalaryPaise = staff.monthlySalary;
    let calculatedSalaryPaise = baseSalaryPaise;

    if (staff.salaryType === 'DAILY') {
      calculatedSalaryPaise = Math.round(effectivePresentDays * staff.dailyWage);
    } else {
      // Monthly with attendance proration
      calculatedSalaryPaise = Math.round((baseSalaryPaise / workingDaysStandard) * Math.min(workingDaysStandard, effectivePresentDays || workingDaysStandard));
    }

    const advancePaise = rupeesToPaise(advanceRupees);
    const bonusPaise = rupeesToPaise(bonusRupees);
    const deductionPaise = rupeesToPaise(deductionRupees);

    const finalSalaryPaise = Math.max(0, calculatedSalaryPaise + bonusPaise - advancePaise - deductionPaise);

    const result = await prisma.$transaction(async (tx) => {
      const salaryRecord = await tx.salaryRecord.upsert({
        where: {
          staffId_month_year: { staffId, month: m, year: y },
        },
        update: {
          baseSalary: baseSalaryPaise,
          attendanceAdjustment: calculatedSalaryPaise - baseSalaryPaise,
          advance: advancePaise,
          bonus: bonusPaise,
          deduction: deductionPaise,
          finalSalary: finalSalaryPaise,
          paidAmount: finalSalaryPaise,
          pendingAmount: 0,
          status: 'PAID',
          paymentMethod,
          paidDate: new Date(),
        },
        create: {
          staffId,
          month: m,
          year: y,
          baseSalary: baseSalaryPaise,
          attendanceAdjustment: calculatedSalaryPaise - baseSalaryPaise,
          advance: advancePaise,
          bonus: bonusPaise,
          deduction: deductionPaise,
          finalSalary: finalSalaryPaise,
          paidAmount: finalSalaryPaise,
          pendingAmount: 0,
          status: 'PAID',
          paymentMethod,
          paidDate: new Date(),
        },
      });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          type: 'SALARY',
          category: 'Staff Salary',
          amount: finalSalaryPaise,
          paymentMethod,
          paymentMethodAccountId: paymentMethodAccountId || null,
          source: 'Shop Account',
          destination: staff.name,
          description: `Salary paid to ${staff.name} for ${m}/${y}`,
          salaryRecordId: salaryRecord.id,
          createdById: req.user!.id,
        },
      });

      if (paymentMethodAccountId) {
        await tx.paymentMethodAccount.update({
          where: { id: paymentMethodAccountId },
          data: { currentBalance: { decrement: finalSalaryPaise } },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user!.id,
          userEmail: req.user!.email,
          action: 'SALARY_PAID',
          entityType: 'STAFF',
          entityId: staff.id,
          amount: finalSalaryPaise,
          details: JSON.stringify({ staff: staff.name, month: m, year: y }),
        },
      });

      return { salaryRecord, transaction };
    });

    broadcastEvent('salary_paid', result);
    res.json({ success: true, message: 'Salary calculated and paid successfully', data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};
