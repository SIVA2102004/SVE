import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR } from '../utils/formatters';
import { useSocket } from '../context/SocketContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Edit2,
  DollarSign,
  Send,
  Sparkles,
  RefreshCw,
  X,
  AlertCircle,
  PiggyBank,
  ArrowUpRight,
} from 'lucide-react';

interface DailySavingsEntry {
  id: string;
  date: string;
  amount: number;
  status: 'COLLECTED' | 'PENDING' | 'SKIPPED';
  notes?: string;
}

const DailySavings: React.FC = () => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [entries, setEntries] = useState<DailySavingsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCollectedRupees, setTotalCollectedRupees] = useState(0);
  const [grandTotalRupees, setGrandTotalRupees] = useState(0);
  const [reminder, setReminder] = useState<any>(null);

  // Edit Amount Modal State
  const [editingDay, setEditingDay] = useState<{ dateStr: string; amountRupees: number; notes: string; status: string } | null>(null);
  const [editAmountInput, setEditAmountInput] = useState('3000');
  const [editNotesInput, setEditNotesInput] = useState('');
  const [editStatusInput, setEditStatusInput] = useState<'COLLECTED' | 'PENDING' | 'SKIPPED'>('COLLECTED');
  const [saving, setSaving] = useState(false);

  const { lastEvent } = useSocket();

  const fetchMonthData = async (y = currentYear, m = currentMonth) => {
    try {
      setLoading(true);
      const res = await api.get(`/daily-savings?year=${y}&month=${m}`);
      if (res.data.success) {
        setEntries(res.data.entries || []);
        setTotalCollectedRupees(res.data.totalCollectedRupees || 0);
        setGrandTotalRupees(res.data.grandTotalRupees || 0);
        setReminder(res.data.reminder || null);
      }
    } catch (err) {
      console.error('Failed to fetch daily savings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthData(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  useEffect(() => {
    if (lastEvent && (lastEvent.type === 'DAILY_SAVINGS_UPDATED' || lastEvent.type === 'DAILY_SAVINGS_REMINDER')) {
      fetchMonthData(currentYear, currentMonth);
    }
  }, [lastEvent]);

  // Navigate months
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleGoToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
  };

  // Calendar math
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 = Sun, 1 = Mon...

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Open Edit Modal for a day
  const handleOpenDayModal = (dayNumber: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${currentYear}-${pad(currentMonth)}-${pad(dayNumber)}`;

    // Find if entry already exists in current list
    const found = entries.find((e) => {
      const eDateStr = new Date(e.date).toISOString().split('T')[0];
      return eDateStr === dateStr;
    });

    if (found) {
      setEditingDay({
        dateStr,
        amountRupees: found.amount / 100,
        notes: found.notes || '',
        status: found.status,
      });
      setEditAmountInput((found.amount / 100).toString());
      setEditNotesInput(found.notes || '');
      setEditStatusInput(found.status);
    } else {
      setEditingDay({
        dateStr,
        amountRupees: 3000,
        notes: '',
        status: 'COLLECTED',
      });
      setEditAmountInput('3000');
      setEditNotesInput('');
      setEditStatusInput('COLLECTED');
    }
  };

  // Quick One-Click Toggle for Collected status
  const handleQuickCollectToday = async () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

    try {
      await api.post('/daily-savings', {
        date: todayStr,
        amountRupees: 3000,
        status: 'COLLECTED',
        notes: 'Collected ₹3,000 via quick-action',
      });
      await fetchMonthData(currentYear, currentMonth);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update today savings');
    }
  };

  // Save Modal Form
  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDay) return;
    setSaving(true);
    try {
      await api.post('/daily-savings', {
        date: editingDay.dateStr,
        amountRupees: parseFloat(editAmountInput) || 3000,
        status: editStatusInput,
        notes: editNotesInput || undefined,
      });
      setEditingDay(null);
      await fetchMonthData(currentYear, currentMonth);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save daily savings');
    } finally {
      setSaving(false);
    }
  };

  // Map entries by day for fast grid lookup
  const entriesByDay: { [day: number]: DailySavingsEntry } = {};
  entries.forEach((e) => {
    const day = new Date(e.date).getUTCDate();
    entriesByDay[day] = e;
  });

  const todayDate = new Date();
  const isCurrentViewingMonth =
    todayDate.getFullYear() === currentYear && todayDate.getMonth() + 1 === currentMonth;
  const currentTodayDayNumber = isCurrentViewingMonth ? todayDate.getDate() : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-gradient-to-tr from-amber-500 to-amber-600 rounded-xl text-white shadow-sm">
              <PiggyBank className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Daily Future Savings Calendar</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-amber-300">
              Target ₹3,000 / day
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1.5">
            Dedicated savings locked away daily for the future • <strong className="text-slate-700">Separate safe fund: Never merged with Business, Personal, or Family accounts</strong>
          </p>
        </div>

        {/* Global Summary Metrics */}
        <div className="flex items-center space-x-3">
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">This Month ({monthNames[currentMonth - 1]})</span>
            <p className="text-base font-black text-emerald-700">{formatINR(totalCollectedRupees * 100)}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl p-3 text-right">
            <span className="text-[10px] uppercase font-bold text-amber-800 block">All-Time Vault Total</span>
            <p className="text-base font-black text-amber-950">{formatINR(grandTotalRupees * 100)}</p>
          </div>
        </div>
      </div>

      {/* Reminder Notification & Quick-Action Card */}
      {reminder && (
        <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          reminder.isCollected
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
            : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 text-amber-950'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-xl ${reminder.isCollected ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-900'}`}>
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {reminder.isCollected ? '✅ Today\'s ₹3,000 Future Savings Secured' : '🔔 Today\'s Daily Savings Reminder'}
              </h4>
              <p className="text-xs mt-0.5 opacity-90 whitespace-pre-line">{reminder.message}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            {!reminder.isCollected && (
              <button
                onClick={handleQuickCollectToday}
                className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-sm transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark ₹3,000 Collected</span>
              </button>
            )}
            <a
              href={reminder.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-emerald-700 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 border border-slate-200 shadow-xs"
              title="Send notification to your WhatsApp (+91 7981037237)"
            >
              <Send className="w-3.5 h-3.5" />
              <span>WhatsApp Alert</span>
            </a>
          </div>
        </div>
      )}

      {/* Calendar Navigation & Month Controller */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevMonth}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-black text-slate-800 tracking-tight min-w-[200px] text-center">
              {monthNames[currentMonth - 1]} {currentYear}
            </h3>
            <button
              onClick={handleNextMonth}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={handleGoToday}
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg ml-2"
            >
              Today
            </button>
          </div>

          <div className="flex items-center space-x-4 text-xs font-semibold">
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-slate-600">Collected</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 inline-block"></span>
              <span className="text-slate-600">Pending</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-300 inline-block"></span>
              <span className="text-slate-600">Skipped</span>
            </div>
          </div>
        </div>

        {/* Calendar Day Grid */}
        <div className="grid grid-cols-7 gap-2 sm:gap-3 text-center">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-2 text-[11px] font-black text-slate-400 uppercase tracking-wider">
              {d}
            </div>
          ))}

          {/* Empty prefix slots for first week offset */}
          {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
            <div key={`empty-${idx}`} className="h-24 sm:h-28 rounded-xl bg-slate-50/50 border border-transparent" />
          ))}

          {/* Days of Month */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const entry = entriesByDay[dayNum];
            const isToday = currentTodayDayNumber === dayNum;
            const isCollected = entry && entry.status === 'COLLECTED';
            const isSkipped = entry && entry.status === 'SKIPPED';
            const amount = entry ? entry.amount / 100 : 3000;

            return (
              <div
                key={`day-${dayNum}`}
                onClick={() => handleOpenDayModal(dayNum)}
                className={`h-24 sm:h-28 rounded-xl p-2 sm:p-2.5 flex flex-col justify-between text-left cursor-pointer transition-all border relative group ${
                  isCollected
                    ? 'bg-emerald-50/60 border-emerald-300 hover:border-emerald-500 hover:shadow-md'
                    : isSkipped
                    ? 'bg-slate-100/80 border-slate-200 opacity-60'
                    : isToday
                    ? 'bg-amber-50/70 border-amber-400 shadow-xs hover:border-amber-500'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Header (Day number + badges) */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black ${
                      isToday
                        ? 'bg-amber-600 text-white shadow-xs'
                        : isCollected
                        ? 'text-emerald-900 bg-emerald-100'
                        : 'text-slate-700'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {isCollected ? (
                    <span className="p-0.5 text-emerald-600" title="Collected">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-brand-600 transition-opacity">
                      <Edit2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* Amount display */}
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    {isCollected ? 'Collected' : isSkipped ? 'Skipped' : 'Target'}
                  </span>
                  <p
                    className={`text-xs sm:text-sm font-black tracking-tight ${
                      isCollected
                        ? 'text-emerald-700'
                        : isSkipped
                        ? 'text-slate-400 line-through'
                        : 'text-amber-700'
                    }`}
                  >
                    ₹{amount.toLocaleString('en-IN')}
                  </p>
                  {entry?.notes && (
                    <p className="text-[9px] text-slate-400 truncate max-w-[80px]" title={entry.notes}>
                      {entry.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* EDIT AMOUNT & STATUS MODAL */}
      {editingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-800">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-amber-950">
                    Daily Savings: {new Date(editingDay.dateStr).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </h3>
                  <p className="text-xs text-amber-800 font-medium">Locked Future Savings (Isolated from Business/Family)</p>
                </div>
              </div>
              <button onClick={() => setEditingDay(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Savings Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editAmountInput}
                    onChange={(e) => setEditAmountInput(e.target.value)}
                    placeholder="3000"
                    className="w-full pl-8 pr-3 py-2.5 border border-slate-300 rounded-xl text-base font-black text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div className="flex items-center space-x-1.5 mt-2">
                  <span className="text-[11px] text-slate-400">Quick Select:</span>
                  {[2000, 3000, 4000, 5000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setEditAmountInput(amt.toString())}
                      className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 transition-colors"
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditStatusInput('COLLECTED')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      editStatusInput === 'COLLECTED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Collected
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatusInput('PENDING')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      editStatusInput === 'PENDING'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatusInput('SKIPPED')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                      editStatusInput === 'SKIPPED'
                        ? 'bg-slate-600 text-white border-slate-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Skipped
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Put in safe locker / gold coin fund"
                  value={editNotesInput}
                  onChange={(e) => setEditNotesInput(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setEditingDay(null)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !editAmountInput}
                  className="w-1/2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Update Amount'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailySavings;
