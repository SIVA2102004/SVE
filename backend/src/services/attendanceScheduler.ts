import cron from 'node-cron';
import { prisma } from '../utils/prisma.js';
import { getTodayIST, isPast930AmIST, isPast1230PmIST, getNextDayOfWeekDate } from '../utils/date.js';
import { broadcastEvent } from '../websocket/socket.js';
import { syncDealerReminder } from '../controllers/dealerController.js';

/**
 * Executes the 9:30 AM Auto-Absent check for any unmarked staff.
 * Safe to call both on schedule and catch-up on server wake/startup or client requests.
 */
export async function executeAutoAbsentCheck(): Promise<number> {
  const today = getTodayIST();

  const activeStaff = await prisma.staff.findMany({
    where: { status: 'ACTIVE' },
    include: {
      attendance: {
        where: { date: today },
      },
    },
  });

  const unmarkedStaff = activeStaff.filter((s) => s.attendance.length === 0);
  if (unmarkedStaff.length === 0) return 0;

  const autoMarked: any[] = [];

  for (const staff of unmarkedStaff) {
    try {
      const record = await prisma.attendance.create({
        data: {
          staffId: staff.id,
          date: today,
          status: 'ABSENT',
          notes: 'Auto-marked ABSENT at 9:30 AM (cut-off threshold passed)',
        },
      });
      autoMarked.push({ staff, record });
    } catch (e: any) {
      // Catch unique constraint violation if marked concurrently
      console.warn(`Could not auto-mark absent for ${staff.name}:`, e.message);
    }
  }

  if (autoMarked.length > 0) {
    console.log(`⚠️ [Auto-Absent] Successfully marked ${autoMarked.length} staff member(s) ABSENT for ${today.toISOString()}`);
    broadcastEvent('attendance_auto_absent_930am', {
      message: `⚠️ 9:30 AM Cutoff: ${autoMarked.length} staff member(s) auto-marked as ABSENT.`,
      autoMarked: autoMarked.map((a) => ({
        staffId: a.staff.id,
        name: a.staff.name,
        phone: a.staff.mobile,
        status: 'ABSENT',
      })),
    });
  }

  return autoMarked.length;
}

/**
 * Checks and broadcasts Daily Future Savings reminder (12:30 PM IST requirement).
 */
export async function checkAndBroadcastDailySavingsReminder(): Promise<void> {
  try {
    const today = getTodayIST();
    const existing = await prisma.dailySavingsEntry.findUnique({
      where: { date: today },
    });

    const isCollected = existing && existing.status === 'COLLECTED';
    const amountRupees = existing ? existing.amount / 100 : 3000;
    const cleanPhone = '7981037237';

    const todayDateStr = today.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    if (!isCollected) {
      const message = `🔔 12:30 PM Mandatory Alert: Collect today's savings amount of ₹${amountRupees.toLocaleString('en-IN')} (${todayDateStr}) for your future savings fund!`;
      const whatsappUrl = `https://api.whatsapp.com/send?phone=91${cleanPhone}&text=${encodeURIComponent(message)}`;

      console.log(`📢 [12:30 PM Reminder] Emitting mandatory daily savings reminder for ₹${amountRupees}`);
      broadcastEvent('daily_savings_reminder', {
        time: '12:30 PM',
        date: today.toISOString(),
        amountRupees,
        message,
        whatsappUrl,
      });
    }
  } catch (err) {
    console.error('Error in checkAndBroadcastDailySavingsReminder:', err);
  }
}

/**
 * Checks and auto-marks unrecorded staff if the current IST time is past 9:30 AM.
 * Ensures that if Render slept until after 9:30 AM, the cutoff applies immediately upon server wake.
 */
export async function catchUpPast930AmAttendance(): Promise<void> {
  if (isPast930AmIST()) {
    console.log('⏰ [Startup Catch-Up] Current IST time is past 9:30 AM. Running cutoff attendance check...');
    try {
      await executeAutoAbsentCheck();
    } catch (err) {
      console.error('Error during 9:30 AM attendance catch-up:', err);
    }
  }
}

/**
 * Staff Attendance Auto Scheduler:
 * 1. At 09:00 AM daily (Asia/Kolkata):
 *    - Broadcasts "ATTENDANCE_CHECK_9AM" reminder to all connected devices.
 *    - Creates an alert reminder in database for owner/manager to mark attendance.
 *
 * 2. At 09:30 AM daily (Asia/Kolkata):
 *    - For any active staff who has NOT been marked PRESENT / HALF_DAY / LEAVE for today,
 *      automatically marks them as ABSENT.
 *    - Generates WhatsApp notification payload and broadcasts real-time update.
 */
export const initAttendanceScheduler = () => {
  // Catch-up immediately on server initialization if waking up after 9:30 AM IST
  catchUpPast930AmAttendance();

  // If server wakes up after 12:30 PM, verify if daily savings reminder needs to be broadcast
  if (isPast1230PmIST()) {
    checkAndBroadcastDailySavingsReminder();
  }

  // 9:00 AM IST Cron: "0 9 * * *" with timezone Asia/Kolkata
  cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('⏰ [Attendance Cron 9:00 AM] Triggering 9:00 AM Attendance Check & Notification');
      try {
        const today = getTodayIST();

        const activeStaff = await prisma.staff.findMany({
          where: { status: 'ACTIVE' },
          include: {
            attendance: {
              where: { date: today },
            },
          },
        });

        const pendingCount = activeStaff.filter((s) => s.attendance.length === 0).length;

        // Broadcast to all active clients (displays visual banner & chime in UI)
        broadcastEvent('attendance_reminder_9am', {
          time: '09:00 AM',
          message: `⏰ 9:00 AM Attendance Intimation: Please verify and mark attendance for ${pendingCount} employee(s). Unmarked staff will be auto-marked ABSENT at 9:30 AM.`,
          unmarkedStaffCount: pendingCount,
          date: today.toISOString(),
        });
      } catch (err) {
        console.error('Error in 9:00 AM Attendance Cron:', err);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  // 9:30 AM IST Cron: "30 9 * * *" with timezone Asia/Kolkata
  cron.schedule(
    '30 9 * * *',
    async () => {
      console.log('⏰ [Attendance Cron 9:30 AM] Auto-marking unrecorded staff as ABSENT');
      try {
        await executeAutoAbsentCheck();
      } catch (err) {
        console.error('Error in 9:30 AM Attendance Cron:', err);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  console.log('✅ Staff Attendance 9:00 AM & 9:30 AM Schedulers initialized (Asia/Kolkata timezone)');

  // 3. Daily 8:30 AM IST Cron: Check and broadcast all upcoming/due Pay & Receive Reminders
  cron.schedule(
    '30 8 * * *',
    async () => {
      console.log('⏰ [Reminders Cron 8:30 AM] Scanning pending payment & receipt reminders');
      try {
        const todayIST = getTodayIST();
        const now = new Date();

        // Auto-roll over dealer collection reminders if past visit date and pending balance still exists
        const dealersWithBalance = await prisma.dealer.findMany({
          where: {
            status: 'ACTIVE',
            pendingBalance: { gt: 0 },
            collectionDay: { not: null },
          },
        });

        for (const dealer of dealersWithBalance) {
          if (dealer.collectionDate && new Date(dealer.collectionDate) < todayIST) {
            // Visit date has passed and balance remains -> advance to next week's collection day
            const nextDate = getNextDayOfWeekDate(dealer.collectionDay!, todayIST);
            await prisma.dealer.update({
              where: { id: dealer.id },
              data: { collectionDate: nextDate },
            });
            await syncDealerReminder(
              dealer.id,
              dealer.name,
              dealer.collectorName,
              dealer.collectionDay,
              nextDate,
              dealer.pendingBalance
            );
          }
        }

        const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const dueReminders = await prisma.reminder.findMany({
          where: {
            isCompleted: false,
            dueDate: { lte: next7Days },
          },
          orderBy: { dueDate: 'asc' },
        });

        if (dueReminders.length > 0) {
          broadcastEvent('daily_payment_reminders', {
            count: dueReminders.length,
            reminders: dueReminders,
            message: `🔔 You have ${dueReminders.length} upcoming/due payment & receipt reminder(s).`,
          });
        }
      } catch (err) {
        console.error('Error in Daily Reminders Cron:', err);
      }
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );

  // 4. Daily 12:30 PM IST Cron: Mandatory Daily Future Savings Reminder
  cron.schedule(
    '30 12 * * *',
    async () => {
      console.log('⏰ [Daily Savings Cron 12:30 PM] Triggering mandatory 12:30 PM daily savings reminder');
      await checkAndBroadcastDailySavingsReminder();
    },
    {
      timezone: 'Asia/Kolkata',
    }
  );
};
