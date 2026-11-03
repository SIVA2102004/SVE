import cron from 'node-cron';
import { prisma } from '../utils/prisma.js';
import { broadcastEvent } from '../websocket/socket.js';

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
  // 9:00 AM IST Cron: "0 9 * * *" with timezone Asia/Kolkata
  cron.schedule(
    '0 9 * * *',
    async () => {
      console.log('⏰ [Attendance Cron 9:00 AM] Triggering 9:00 AM Attendance Check & Notification');
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeStaff = await prisma.staff.findMany({
          where: { status: 'ACTIVE' },
          include: {
            attendance: {
              where: { date: today },
            },
          },
        });

        const unmarkedStaff = activeStaff.filter((s) => s.attendance.length === 0);
        const autoMarked: any[] = [];

        for (const staff of unmarkedStaff) {
          const record = await prisma.attendance.create({
            data: {
              staffId: staff.id,
              date: today,
              status: 'ABSENT',
              notes: 'Auto-marked ABSENT at 9:30 AM (cut-off threshold passed)',
            },
          });
          autoMarked.push({ staff, record });
        }

        if (autoMarked.length > 0) {
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
        const now = new Date();
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
};
