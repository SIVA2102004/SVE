import { Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.js';
import { rupeesToPaise } from '../utils/currency.js';
import { getTodayIST, parseDateIST, isPast930AmIST } from '../utils/date.js';
import { broadcastEvent } from '../websocket/socket.js';
import { executeAutoAbsentCheck } from '../services/attendanceScheduler.js';

export const getStaff = async (req: AuthRequest, res: Response) => {
  try {
    // If client queries staff after 9:30 AM IST, ensure cutoff has run
    if (isPast930AmIST()) {
      await executeAutoAbsentCheck().catch(() => {});
    }

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
    const {
      name,
      mobile,
      phone,
      address,
      designation,
      salaryType = 'MONTHLY',
      monthlySalaryRupees,
      dailyWageRupees,
      bankDetails,
      paidLeavesAllowed = 0,
      notes,
    } = req.body;

    const contactNumber = mobile || phone || '';
    if (!name || !contactNumber) {
      return res.status(400).json({ success: false, message: 'Staff name and mobile number are required.' });
    }

    const monthlyPaise = monthlySalaryRupees ? rupeesToPaise(monthlySalaryRupees) : 0;
    const dailyPaise = dailyWageRupees ? rupeesToPaise(dailyWageRupees) : 0;
    const leavesAllowed = Math.max(0, parseInt(String(paidLeavesAllowed)) || 0);

    const notesPayload = JSON.stringify({
      designation: designation || 'Staff Member',
      paidLeavesAllowed: leavesAllowed,
      customNotes: notes || '',
    });

    const staffMember = await prisma.staff.create({
      data: {
        name,
        mobile: contactNumber,
        address: address || null,
        salaryType,
        monthlySalary: monthlyPaise,
        dailyWage: dailyPaise,
        bankDetails: bankDetails || null,
        notes: notesPayload,
      },
    });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          action: 'STAFF_CREATED',
          entityType: 'STAFF',
          entityId: staffMember.id,
          amount: monthlyPaise,
          details: JSON.stringify({
            name: staffMember.name,
            mobile: staffMember.mobile,
            designation,
            monthlySalaryRupees,
            paidLeavesAllowed: leavesAllowed,
          }),
        },
      });
    }

    broadcastEvent('staff_created', staffMember);
    res.status(201).json({ success: true, staffMember });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      mobile,
      phone,
      address,
      designation,
      salaryType,
      monthlySalaryRupees,
      dailyWageRupees,
      bankDetails,
      paidLeavesAllowed,
      notes,
      status,
    } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    const contactNumber = mobile || phone;
    if (contactNumber !== undefined) data.mobile = contactNumber.trim();
    if (address !== undefined) data.address = address || null;
    if (salaryType !== undefined) data.salaryType = salaryType;
    if (monthlySalaryRupees !== undefined) data.monthlySalary = rupeesToPaise(monthlySalaryRupees);
    if (dailyWageRupees !== undefined) data.dailyWage = rupeesToPaise(dailyWageRupees);
    if (bankDetails !== undefined) data.bankDetails = bankDetails || null;
    if (status !== undefined) data.status = status;

    // Fetch existing staff to maintain notes properties
    if (designation !== undefined || paidLeavesAllowed !== undefined || notes !== undefined) {
      const existing = await prisma.staff.findUnique({ where: { id } });
      let existingObj: any = {};
      if (existing?.notes) {
        try {
          existingObj = JSON.parse(existing.notes);
        } catch {
          if (existing.notes.startsWith('Designation:')) {
            existingObj = { designation: existing.notes.replace('Designation:', '').trim(), paidLeavesAllowed: 0 };
          } else {
            existingObj = { designation: 'Staff Member', customNotes: existing.notes, paidLeavesAllowed: 0 };
          }
        }
      }

      const mergedNotes = {
        designation: designation !== undefined ? designation : (existingObj.designation || 'Staff Member'),
        paidLeavesAllowed: paidLeavesAllowed !== undefined ? Math.max(0, parseInt(String(paidLeavesAllowed)) || 0) : (existingObj.paidLeavesAllowed || 0),
        customNotes: notes !== undefined ? notes : (existingObj.customNotes || ''),
      };

      data.notes = JSON.stringify(mergedNotes);
    }

    const updatedStaff = await prisma.staff.update({
      where: { id },
      data,
    });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          action: 'STAFF_UPDATED',
          entityType: 'STAFF',
          entityId: updatedStaff.id,
          amount: updatedStaff.monthlySalary,
          details: JSON.stringify({
            name: updatedStaff.name,
            mobile: updatedStaff.mobile,
            status: updatedStaff.status,
            changes: data,
          }),
        },
      });
    }

    broadcastEvent('staff_updated', updatedStaff);
    res.json({ success: true, staffMember: updatedStaff });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteStaff = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const staff = await prisma.staff.findUnique({
      where: { id },
      include: {
        attendance: true,
        salaryRecords: true,
      },
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    // Cascade deletes attendance and salaryRecords due to Prisma schema onDelete: Cascade
    await prisma.staff.delete({
      where: { id },
    });

    // Also clean up any audit logs specifically tied to this staff entity
    try {
      await prisma.auditLog.deleteMany({
        where: { entityType: 'STAFF', entityId: id },
      });
    } catch (e) {
      // Ignore if audit log constraint
    }

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.id,
          userEmail: req.user.email,
          action: 'STAFF_DELETED',
          entityType: 'STAFF',
          entityId: id,
          details: JSON.stringify({
            name: staff.name,
            mobile: staff.mobile,
            deletedAt: new Date(),
          }),
        },
      });
    }

    broadcastEvent('staff_deleted', { id, name: staff.name });
    res.json({ success: true, message: `Staff member "${staff.name}" deleted successfully` });
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

    const attDate = parseDateIST(date);

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

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

    const dateStr = attDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    // Formulate automated WhatsApp message content
    let whatsappMessage = '';
    const cleanPhone = (staff?.mobile || '').replace(/[^0-9]/g, '');

    if (status === 'PRESENT') {
      whatsappMessage = `Namaste ${staff?.name || 'Staff'},\nYour attendance has been marked *PRESENT* for today (${dateStr}) at SVE.\nThank you! Have a productive workday.`;
    } else if (status === 'ABSENT') {
      whatsappMessage = `Namaste ${staff?.name || 'Staff'},\nYou have been marked *ABSENT* for today (${dateStr}) at SVE.\nIf this is an error or you need leave approval, please inform management immediately.`;
    } else if (status === 'HALF_DAY') {
      whatsappMessage = `Namaste ${staff?.name || 'Staff'},\nYour attendance for today (${dateStr}) has been marked as *HALF DAY* at SVE.`;
    } else {
      whatsappMessage = `Namaste ${staff?.name || 'Staff'},\nYour attendance status for today (${dateStr}) has been updated to *${status}* at SVE.`;
    }

    const whatsappUrl = cleanPhone
      ? `https://api.whatsapp.com/send?phone=91${cleanPhone.slice(-10)}&text=${encodeURIComponent(whatsappMessage)}`
      : null;

    broadcastEvent('attendance_marked', {
      ...record,
      staffName: staff?.name,
      staffPhone: staff?.mobile,
      whatsappMessage,
      whatsappUrl,
    });

    res.json({
      success: true,
      record,
      staff: {
        name: staff?.name,
        phone: staff?.mobile,
      },
      whatsappMessage,
      whatsappUrl,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const calculateAndPaySalary = async (req: AuthRequest, res: Response) => {
  try {
    const {
      staffId: bodyStaffId,
      month: bodyMonth,
      year: bodyYear,
      paidLeaves: queryPaidLeaves,
      advanceRupees = 0,
      bonusRupees = 0,
      deductionRupees = 0,
      paymentMethod = 'CASH',
      paymentMethodAccountId,
    } = req.method === 'GET' ? req.query : req.body;

    const staffId = (req.params.staffId || bodyStaffId) as string;

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
      include: { attendance: true },
    });

    if (!staff) return res.status(404).json({ success: false, message: 'Staff member not found.' });

    // Extract default paidLeavesAllowed from staff notes if present
    let defaultPaidLeaves = 0;
    if (staff.notes) {
      try {
        const parsed = JSON.parse(staff.notes);
        if (typeof parsed.paidLeavesAllowed === 'number') {
          defaultPaidLeaves = parsed.paidLeavesAllowed;
        }
      } catch {
        // regular string note
      }
    }

    const appliedPaidLeaves =
      queryPaidLeaves !== undefined && queryPaidLeaves !== null && queryPaidLeaves !== ''
        ? Math.max(0, parseFloat(String(queryPaidLeaves)) || 0)
        : defaultPaidLeaves;

    // Calculate attendance for specified month
    let m = new Date().getMonth() + 1;
    let y = new Date().getFullYear();

    if (bodyMonth) {
      if (typeof bodyMonth === 'string' && bodyMonth.includes('-')) {
        const parts = bodyMonth.split('-');
        y = parseInt(parts[0]);
        m = parseInt(parts[1]);
      } else {
        m = parseInt(String(bodyMonth));
      }
    }
    if (bodyYear) {
      y = parseInt(String(bodyYear));
    }

    const startOfMonth = new Date(y, m - 1, 1);
    const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999);
    const totalDaysInMonth = new Date(y, m, 0).getDate();

    const monthAttendance = await prisma.attendance.findMany({
      where: {
        staffId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
    });

    let presentDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    monthAttendance.forEach((a) => {
      if (a.status === 'PRESENT') presentDays += 1;
      else if (a.status === 'HALF_DAY') halfDays += 1;
      else if (a.status === 'ABSENT') absentDays += 1;
    });

    const effectivePresentDays = presentDays + halfDays * 0.5;
    // Total payable days includes present days plus paid leaves (capped at total days in month)
    const effectivePayableDays = Math.min(totalDaysInMonth, effectivePresentDays + appliedPaidLeaves);

    let baseSalaryPaise = staff.monthlySalary;
    let calculatedSalaryPaise = baseSalaryPaise;

    // Daily rate based on total days in month (₹11,500 / 30 = ₹383.33/day)
    const dailyRatePaise = Math.round(baseSalaryPaise / (totalDaysInMonth || 30));

    if (staff.salaryType === 'DAILY') {
      calculatedSalaryPaise = Math.round(effectivePayableDays * staff.dailyWage);
    } else {
      // User rule: Total payable days = Present Days + Paid Leaves
      // e.g., 20 days present + 3 days paid leaves = 23 days salary
      calculatedSalaryPaise = Math.round(effectivePayableDays * dailyRatePaise);
    }

    // Check existing advance already taken for this month in salaryRecord
    const existingRecord = await prisma.salaryRecord.findUnique({
      where: {
        staffId_month_year: { staffId, month: m, year: y },
      },
    });

    const recordedAdvancePaise = existingRecord?.advance || 0;
    const additionalAdvancePaise = rupeesToPaise(Number(advanceRupees) || 0);
    const totalAdvancePaise = recordedAdvancePaise + additionalAdvancePaise;

    const bonusPaise = rupeesToPaise(Number(bonusRupees) || 0);
    const deductionPaise = rupeesToPaise(Number(deductionRupees) || 0);

    const payablePaise = Math.max(0, calculatedSalaryPaise + bonusPaise - totalAdvancePaise - deductionPaise);
    const payableRupees = payablePaise / 100;

    // If it's a GET request, just return the calculation breakdown
    if (req.method === 'GET') {
      const effectiveAbsentDays = absentDays + halfDays * 0.5;
      const unexcusedAbsentDays = Math.max(0, effectiveAbsentDays - appliedPaidLeaves);
      const absentDeductionRupees = Math.round(unexcusedAbsentDays * dailyRatePaise) / 100;

      return res.json({
        success: true,
        staffId,
        staffName: staff.name,
        month: m,
        year: y,
        daysInMonth: totalDaysInMonth,
        dailyRateRupees: dailyRatePaise / 100,
        presentDays: effectivePresentDays,
        absentDays,
        effectiveAbsentDays,
        paidLeaves: appliedPaidLeaves,
        effectivePayableDays,
        absentDeductionRupees,
        baseSalaryRupees: baseSalaryPaise / 100,
        calculatedSalaryRupees: calculatedSalaryPaise / 100,
        advanceRupees: totalAdvancePaise / 100,
        bonusRupees: bonusPaise / 100,
        deductionRupees: deductionPaise / 100,
        payableRupees,
        payablePaise,
      });
    }

    const finalSalaryPaise = payablePaise;

    const result = await prisma.$transaction(async (tx) => {
      const salaryRecord = await tx.salaryRecord.upsert({
        where: {
          staffId_month_year: { staffId, month: m, year: y },
        },
        update: {
          baseSalary: baseSalaryPaise,
          attendanceAdjustment: calculatedSalaryPaise - baseSalaryPaise,
          advance: totalAdvancePaise,
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
          advance: totalAdvancePaise,
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
          description: `Salary paid to ${staff.name} for ${m}/${y} (Net: ₹${payableRupees})`,
          salaryRecordId: salaryRecord.id,
          createdById: req.user!.id,
        },
      });

      if (paymentMethodAccountId && finalSalaryPaise > 0) {
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
          details: JSON.stringify({
            staff: staff.name,
            month: m,
            year: y,
            presentDays: effectivePresentDays,
            absentDays,
            payableRupees,
          }),
        },
      });

      return { salaryRecord, transaction };
    });

    broadcastEvent('salary_paid', result);
    res.json({
      success: true,
      message: `Salary of ₹${payableRupees.toLocaleString('en-IN')} calculated and paid successfully to ${staff.name}`,
      data: result,
      payableRupees,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const payAdvanceSalary = async (req: AuthRequest, res: Response) => {
  try {
    const {
      staffId,
      amountRupees,
      date,
      paymentMethod = 'CASH',
      paymentMethodAccountId,
      notes,
    } = req.body;

    if (!staffId || !amountRupees || parseFloat(amountRupees) <= 0) {
      return res.status(400).json({ success: false, message: 'Staff ID and valid advance amount are required.' });
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId },
    });

    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    const advanceDate = date ? new Date(date) : new Date();
    const amountPaise = rupeesToPaise(parseFloat(amountRupees));
    const m = advanceDate.getMonth() + 1;
    const y = advanceDate.getFullYear();

    const result = await prisma.$transaction(async (tx) => {
      // Upsert salary record for that month to accumulate the advance
      const salaryRecord = await tx.salaryRecord.upsert({
        where: {
          staffId_month_year: { staffId, month: m, year: y },
        },
        update: {
          advance: { increment: amountPaise },
        },
        create: {
          staffId,
          month: m,
          year: y,
          baseSalary: staff.monthlySalary,
          attendanceAdjustment: 0,
          advance: amountPaise,
          bonus: 0,
          deduction: 0,
          finalSalary: Math.max(0, staff.monthlySalary - amountPaise),
          paidAmount: 0,
          pendingAmount: Math.max(0, staff.monthlySalary - amountPaise),
          status: 'PARTIAL',
          paymentMethod,
        },
      });

      // Create an EXPENSE transaction
      const transaction = await tx.transaction.create({
        data: {
          type: 'EXPENSE',
          category: 'Staff Advance',
          amount: amountPaise,
          date: advanceDate,
          paymentMethod,
          paymentMethodAccountId: paymentMethodAccountId || null,
          source: 'Shop Account',
          destination: staff.name,
          description: notes || `Salary advance of Rs.${parseFloat(amountRupees)} paid to ${staff.name}`,
          createdById: req.user!.id,
        },
      });

      // Create Expense record
      await tx.expense.create({
        data: {
          name: `Salary Advance: ${staff.name}`,
          category: 'Staff Salary',
          amount: amountPaise,
          date: advanceDate,
          paymentMethod,
          paidTo: staff.name,
          description: notes || `Advance payment for ${m}/${y}`,
        },
      });

      // Deduct from account balance if account is specified
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
          action: 'STAFF_ADVANCE_PAID',
          entityType: 'STAFF',
          entityId: staff.id,
          amount: amountPaise,
          transactionId: transaction.id,
          details: JSON.stringify({
            staff: staff.name,
            amountRupees,
            date: advanceDate,
            paymentMethod,
            reason: notes || 'Salary Advance',
            notes: notes || '',
          }),
        },
      });

      return { salaryRecord, transaction };
    });

    broadcastEvent('salary_advance_paid', { staffId, result });
    res.json({
      success: true,
      message: `Salary advance of Rs.${parseFloat(amountRupees)} recorded successfully for ${staff.name}`,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Returns the history of advance disbursements given to a staff member (or all staff)
 * along with purpose/notes, dates, payment method, and disbursing user.
 */
export const getStaffAdvanceLogs = async (req: AuthRequest, res: Response) => {
  try {
    const { staffId } = req.params;

    const whereClause: any = {
      action: 'STAFF_ADVANCE_PAID',
      entityType: 'STAFF',
    };
    if (staffId) {
      whereClause.entityId = staffId;
    }

    const logs = await prisma.auditLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        transaction: {
          select: {
            id: true,
            description: true,
            paymentMethod: true,
            reference: true,
            date: true,
            paymentMethodAccount: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
    });

    // Format logs into clean readable objects
    const formattedLogs = logs.map((log) => {
      let parsedDetails: any = {};
      try {
        parsedDetails = log.details ? JSON.parse(log.details) : {};
      } catch (e) {
        parsedDetails = {};
      }

      const purpose =
        parsedDetails.reason ||
        parsedDetails.notes ||
        log.transaction?.description ||
        'Salary Advance';

      return {
        id: log.id,
        staffId: log.entityId,
        staffName: parsedDetails.staff || 'Staff Member',
        amount: log.amount || 0, // in paise
        amountRupees: (log.amount || 0) / 100,
        date: parsedDetails.date || log.transaction?.date || log.createdAt,
        paymentMethod: parsedDetails.paymentMethod || log.transaction?.paymentMethod || 'CASH',
        accountName: log.transaction?.paymentMethodAccount?.name || null,
        purpose,
        notes: parsedDetails.notes || parsedDetails.reason || '',
        paidBy: log.user?.name || log.userEmail || 'Store Owner',
        createdAt: log.createdAt,
      };
    });

    res.json({ success: true, logs: formattedLogs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const runAutoAttendanceCheck = async (req: AuthRequest, res: Response) => {
  try {
    const { action } = req.body; // 'CHECK_9AM' or 'AUTO_ABSENT_930AM'
    const today = getTodayIST();

    const activeStaff = await prisma.staff.findMany({
      where: { status: 'ACTIVE' },
      include: {
        attendance: {
          where: { date: today },
        },
      },
    });

    if (action === 'AUTO_ABSENT_930AM') {
      const unmarked = activeStaff.filter((s) => s.attendance.length === 0);
      const absentResults: any[] = [];

      for (const staff of unmarked) {
        try {
          const record = await prisma.attendance.create({
            data: {
              staffId: staff.id,
              date: today,
              status: 'ABSENT',
              notes: 'Auto-marked ABSENT at 9:30 AM cutoff',
            },
          });

          const dateStr = today.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          });

          const cleanPhone = (staff.mobile || '').replace(/[^0-9]/g, '');
          const whatsappMessage = `Namaste ${staff.name},\nYou have been marked *ABSENT* for today (${dateStr}) at SVE.\nIf this is an error, please reach out to the store manager.`;
          const whatsappUrl = cleanPhone
            ? `https://api.whatsapp.com/send?phone=91${cleanPhone.slice(-10)}&text=${encodeURIComponent(whatsappMessage)}`
            : null;

          absentResults.push({
            staffId: staff.id,
            name: staff.name,
            phone: staff.mobile,
            status: 'ABSENT',
            whatsappMessage,
            whatsappUrl,
          });
        } catch (e: any) {
          console.warn(`Already marked or error for ${staff.name}:`, e.message);
        }
      }

      broadcastEvent('attendance_auto_absent_930am', {
        count: absentResults.length,
        autoMarked: absentResults,
      });

      return res.json({
        success: true,
        message: `${absentResults.length} staff member(s) auto-marked ABSENT for 9:30 AM cutoff`,
        autoMarked: absentResults,
      });
    }

    // Default 9:00 AM check
    const pendingList = activeStaff
      .filter((s) => s.attendance.length === 0)
      .map((s) => ({ id: s.id, name: s.name, phone: s.mobile }));

    broadcastEvent('attendance_reminder_9am', {
      unmarkedStaffCount: pendingList.length,
      pendingList,
    });

    res.json({
      success: true,
      pendingCount: pendingList.length,
      pendingList,
      message: `9:00 AM intimation: ${pendingList.length} staff member(s) pending attendance`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
