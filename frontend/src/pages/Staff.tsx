import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { Staff } from '../types';
import { useSocket } from '../context/SocketContext';
import {
  UserCheck,
  Calendar,
  DollarSign,
  Plus,
  RefreshCw,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  Users,
  CreditCard,
  Banknote,
  Send,
  MessageSquare,
  Bell,
  AlertTriangle,
  Edit2,
} from 'lucide-react';

const StaffPage: React.FC = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [newStaffModal, setNewStaffModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [attendanceModal, setAttendanceModal] = useState<Staff | null>(null);
  const [historyModal, setHistoryModal] = useState<Staff | null>(null);
  const [salaryModal, setSalaryModal] = useState<Staff | null>(null);
  const [advanceModal, setAdvanceModal] = useState<Staff | null>(null);

  // New Staff form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [monthlySalaryRupees, setMonthlySalaryRupees] = useState('');

  // Advance Form
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [advancePayMode, setAdvancePayMode] = useState('CASH');
  const [advanceAcc, setAdvanceAcc] = useState('');
  const [advanceNotes, setAdvanceNotes] = useState('');

  // Attendance Form
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attStatus, setAttStatus] = useState<'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'>('PRESENT');
  const [attNotes, setAttNotes] = useState('');
  const [lastWhatsAppUrl, setLastWhatsAppUrl] = useState<string | null>(null);
  const [lastWhatsAppMessage, setLastWhatsAppMessage] = useState<string | null>(null);
  const [whatsAppModalStaff, setWhatsAppModalStaff] = useState<any>(null);

  // 9:00 AM & 9:30 AM Timer & Auto-Intimation State
  const { lastEvent } = useSocket();
  const [timerAlert, setTimerAlert] = useState<{ type: '9AM' | '930AM'; message: string; count?: number } | null>(null);
  const [autoAbsentRunning, setAutoAbsentRunning] = useState(false);

  // Salary Payment Form
  const [month, setMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [salaryCalc, setSalaryCalc] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAcc, setSelectedAcc] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const [sRes, aRes] = await Promise.all([api.get('/staff'), api.get('/payment-accounts')]);
      const list = Array.isArray(sRes.data) ? sRes.data : sRes.data?.staff || [];
      const normalized = list.map((st: any) => ({
        ...st,
        phone: st.mobile,
        designation: st.designation || (st.notes && st.notes.startsWith('Designation:') ? st.notes.replace('Designation:', '').trim() : 'Staff Member'),
        status: st.status || 'ACTIVE',
        attendance: Array.isArray(st.attendance) ? st.attendance : [],
      }));
      setStaffList(normalized);
      const accList = Array.isArray(aRes.data) ? aRes.data : aRes.data?.accounts || [];
      setAccounts(accList);
      if (accList.length > 0) setSelectedAcc(accList[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    if (!lastEvent) return;
    if (
      lastEvent.type === 'ATTENDANCE_MARKED' ||
      lastEvent.type === 'ATTENDANCE_REMINDER_9AM' ||
      lastEvent.type === 'ATTENDANCE_AUTO_ABSENT_930AM' ||
      lastEvent.type === 'staff_created' ||
      lastEvent.type === 'salary_paid' ||
      lastEvent.type === 'salary_advance_paid'
    ) {
      fetchStaff();
      if (lastEvent.type === 'ATTENDANCE_REMINDER_9AM') {
        setTimerAlert({
          type: '9AM',
          message: lastEvent.payload?.message || '9:00 AM Attendance Check Intimation',
          count: lastEvent.payload?.unmarkedStaffCount,
        });
      } else if (lastEvent.type === 'ATTENDANCE_AUTO_ABSENT_930AM') {
        setTimerAlert({
          type: '930AM',
          message: lastEvent.payload?.message || '9:30 AM Cutoff: Unmarked staff auto-marked ABSENT',
          count: lastEvent.payload?.autoMarked?.length,
        });
      }
    }
  }, [lastEvent]);

  const resetStaffForm = () => {
    setName('');
    setPhone('');
    setDesignation('');
    setMonthlySalaryRupees('');
    setEditingStaff(null);
  };

  const openCreateStaffModal = () => {
    resetStaffForm();
    setNewStaffModal(true);
  };

  const openEditStaffModal = (st: Staff) => {
    setEditingStaff(st);
    setName(st.name || '');
    setPhone(st.phone || '');
    setDesignation(st.designation || '');
    setMonthlySalaryRupees(st.monthlySalary ? (st.monthlySalary / 100).toString() : '');
    setNewStaffModal(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name,
        phone,
        mobile: phone,
        designation,
        monthlySalaryRupees: parseFloat(monthlySalaryRupees),
      };

      if (editingStaff) {
        await api.put(`/staff/${editingStaff.id}`, payload);
      } else {
        await api.post('/staff', payload);
      }

      setNewStaffModal(false);
      resetStaffForm();
      await fetchStaff();
    } catch (err: any) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Failed to save staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendanceModal) return;
    setSaving(true);
    try {
      const res = await api.post('/staff/attendance', {
        staffId: attendanceModal.id,
        date: attDate,
        status: attStatus,
        notes: attNotes,
      });

      const { whatsappUrl, whatsappMessage } = res.data;
      const targetStaff = attendanceModal;

      setAttendanceModal(null);
      setAttNotes('');
      await fetchStaff();

      // Prompt to dispatch WhatsApp notification immediately
      if (whatsappUrl) {
        setWhatsAppModalStaff({
          name: targetStaff.name,
          phone: targetStaff.phone,
          status: attStatus,
          message: whatsappMessage,
          url: whatsappUrl,
        });
        // Open WhatsApp web / mobile app automatically in separate tab
        window.open(whatsappUrl, '_blank');
      } else {
        alert(`Attendance for ${targetStaff.name} on ${attDate} recorded as ${attStatus}!`);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to mark attendance');
    } finally {
      setSaving(false);
    }
  };

  // Trigger manual or timer-based 9:30 AM Cutoff Auto-Absent check
  const handleAutoAbsentTrigger = async () => {
    if (!window.confirm('Mark all staff who have not arrived yet as ABSENT for today? (9:30 AM Cutoff)')) return;
    setAutoAbsentRunning(true);
    try {
      const res = await api.post('/staff/attendance-timer-check', { action: 'AUTO_ABSENT_930AM' });
      alert(res.data?.message || '9:30 AM cutoff executed successfully!');
      await fetchStaff();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to run auto-absent check');
    } finally {
      setAutoAbsentRunning(false);
    }
  };

  const openSalaryModal = async (staff: Staff, targetMonth = month) => {
    setSalaryModal(staff);
    try {
      const res = await api.get(`/staff/${staff.id}/salary/calculate?month=${targetMonth}`);
      setSalaryCalc(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePaySalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryModal || !salaryCalc) return;
    setSaving(true);
    try {
      await api.post(`/staff/${salaryModal.id}/salary/pay`, {
        month,
        amountRupees: salaryCalc.payableRupees,
        paymentAccountId: selectedAcc,
        presentDays: salaryCalc.presentDays,
        absentDays: salaryCalc.absentDays,
        bonusRupees: 0,
        deductionRupees: 0,
      });
      alert(`Salary payment of ₹${salaryCalc.payableRupees} to ${salaryModal.name} recorded!`);
      setSalaryModal(null);
      setSalaryCalc(null);
    } catch (err: any) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Failed to pay salary');
    } finally {
      setSaving(false);
    }
  };

  const handlePayAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceModal) return;
    setSaving(true);
    try {
      await api.post(`/staff/${advanceModal.id}/advance`, {
        staffId: advanceModal.id,
        amountRupees: parseFloat(advanceAmount),
        date: advanceDate,
        paymentMethod: advancePayMode,
        paymentMethodAccountId: advanceAcc || undefined,
        notes: advanceNotes || undefined,
      });
      alert(`Advance payment of ₹${advanceAmount} to ${advanceModal.name} recorded successfully!`);
      setAdvanceModal(null);
      setAdvanceAmount('');
      setAdvanceNotes('');
      await fetchStaff();
    } catch (err: any) {
      alert(err.response?.data?.message || err.response?.data?.error || 'Failed to record advance salary');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Staff, Attendance & Salaries</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Track daily employee attendance, automatic prorated pay calculation, and payouts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAutoAbsentTrigger}
            disabled={autoAbsentRunning}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 shadow-sm transition-all"
            title="Auto-marks all unmarked employees as ABSENT for today (9:30 AM Cutoff rule)"
          >
            <Clock className="w-4 h-4 text-rose-600" />
            <span>{autoAbsentRunning ? 'Checking...' : '9:30 AM Auto-Absent'}</span>
          </button>
          <button
            onClick={openCreateStaffModal}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {/* Real-time 9:00 AM / 9:30 AM Alert Popup Bar */}
      {timerAlert && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-sm animate-fade-in ${
          timerAlert.type === '930AM'
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl ${timerAlert.type === '930AM' ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'}`}>
              <Clock className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider">
                {timerAlert.type === '930AM' ? '⚠️ 9:30 AM Cutoff Auto-Absent Executed' : '⏰ 9:00 AM Attendance Reminder'}
              </p>
              <p className="text-xs mt-0.5">{timerAlert.message}</p>
            </div>
          </div>
          <button
            onClick={() => setTimerAlert(null)}
            className="text-xs px-3 py-1.5 bg-white/80 hover:bg-white rounded-lg font-bold border border-slate-200 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 9:00 AM & 9:30 AM Real-time Policy Notice Card */}
      <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Mandatory Daily Attendance Schedule (9:00 AM & 9:30 AM)
            </h4>
            <p className="text-xs text-amber-800 mt-0.5">
              • <strong>09:00 AM Intimation:</strong> Check and mark attendance (Present / Absent) with automated WhatsApp notice to employee.
              <br className="hidden sm:inline" /> • <strong>09:30 AM Cutoff:</strong> Unmarked employees are strictly auto-flagged as <strong>ABSENT</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Staff List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
            <span>Loading staff...</span>
          </div>
        ) : staffList.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 font-medium bg-white rounded-2xl border border-slate-200/80">
            No employees registered yet. Click "+ Add Employee" to add your team.
          </div>
        ) : (
          staffList.map((st) => (
            <div
              key={st.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{st.name}</h3>
                    <p className="text-xs font-semibold text-brand-600 mt-0.5">{st.designation}</p>
                    <p className="text-xs text-slate-400 mt-1">{st.phone}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                      {st.status}
                    </span>
                    <button
                      onClick={() => openEditStaffModal(st)}
                      title="Edit Employee Details"
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Monthly Salary</span>
                    <p className="text-sm font-black text-slate-800">{formatINR(st.monthlySalary)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Daily Rate</span>
                    <p className="text-xs font-bold text-slate-600">{formatINR(st.dailyRate || Math.round(st.monthlySalary / 30))} / day</p>
                  </div>
                </div>

                {/* Present / Absent Quick Stats Bar */}
                {st.attendance && st.attendance.length > 0 && (
                  <div className="mt-3 p-2.5 bg-slate-50/80 rounded-xl border border-slate-100 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Recent Attendance</span>
                      <button
                        onClick={() => setHistoryModal(st)}
                        className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 flex items-center space-x-1"
                      >
                        <History className="w-3 h-3" />
                        <span>View Log</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="p-1 bg-emerald-50 rounded-lg border border-emerald-100">
                        <span className="block text-[10px] font-bold text-emerald-700 uppercase">Present</span>
                        <span className="text-xs font-black text-emerald-800">
                          {st.attendance.filter((a) => a.status === 'PRESENT').length}
                        </span>
                      </div>
                      <div className="p-1 bg-rose-50 rounded-lg border border-rose-100">
                        <span className="block text-[10px] font-bold text-rose-700 uppercase">Absent</span>
                        <span className="text-xs font-black text-rose-800">
                          {st.attendance.filter((a) => a.status === 'ABSENT').length}
                        </span>
                      </div>
                      <div className="p-1 bg-amber-50 rounded-lg border border-amber-100">
                        <span className="block text-[10px] font-bold text-amber-700 uppercase">Half/Leave</span>
                        <span className="text-xs font-black text-amber-800">
                          {st.attendance.filter((a) => a.status === 'HALF_DAY' || a.status === 'LEAVE').length}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2">
                <button
                  onClick={() => setAttendanceModal(st)}
                  className="py-2 px-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-[11px] transition-colors flex items-center justify-center space-x-1"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Attendance</span>
                </button>
                <button
                  onClick={() => {
                    setAdvanceModal(st);
                    setAdvanceAmount('');
                    setAdvanceDate(new Date().toISOString().split('T')[0]);
                    setAdvancePayMode('CASH');
                    if (accounts.length > 0) setAdvanceAcc(accounts[0].id);
                  }}
                  className="py-2 px-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold rounded-xl text-[11px] transition-colors flex items-center justify-center space-x-1 border border-amber-200/60"
                >
                  <Banknote className="w-3.5 h-3.5" />
                  <span>Advance</span>
                </button>
                <button
                  onClick={() => openSalaryModal(st)}
                  className="py-2 px-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-[11px] transition-colors flex items-center justify-center space-x-1 shadow-sm"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Salary</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ADD / EDIT STAFF MODAL */}
      {newStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">
                {editingStaff ? 'Edit Employee Details' : 'Add New Employee'}
              </h3>
              <button onClick={() => { setNewStaffModal(false); resetStaffForm(); }}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleSaveStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Worker"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Designation / Role *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Billing Assistant / Mechanic"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Monthly Base Salary (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 20000"
                  value={monthlySalaryRupees}
                  onChange={(e) => setMonthlySalaryRupees(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingStaff ? 'Update Employee' : 'Save Employee'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MARK ATTENDANCE MODAL */}
      {attendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50">
              <div>
                <h3 className="font-bold text-base text-indigo-950">Record Attendance</h3>
                <p className="text-xs text-indigo-700">{attendanceModal.name}</p>
              </div>
              <button onClick={() => setAttendanceModal(null)}>
                <X className="w-5 h-5 text-indigo-900" />
              </button>
            </div>
            <form onSubmit={handleMarkAttendance} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={attDate}
                  onChange={(e) => setAttDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setAttStatus(st)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-colors ${
                        attStatus === st
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Worked 2hr overtime"
                  value={attNotes}
                  onChange={(e) => setAttNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Recording...' : 'Save Attendance'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PAY SALARY MODAL */}
      {salaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <div>
                <h3 className="font-bold text-base text-emerald-950">Pay Employee Salary</h3>
                <p className="text-xs text-emerald-700">{salaryModal.name}</p>
              </div>
              <button onClick={() => setSalaryModal(null)}>
                <X className="w-5 h-5 text-emerald-900" />
              </button>
            </div>
            <form onSubmit={handlePaySalary} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Salary Month
                </label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    if (salaryModal) openSalaryModal(salaryModal, e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {salaryCalc ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Base Salary:</span>
                    <span className="font-bold text-slate-800">{formatINR((salaryCalc.baseSalaryRupees || 0) * 100)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Daily Rate ({salaryCalc.daysInMonth} days in month):</span>
                    <span className="font-semibold text-slate-700">₹{(salaryCalc.dailyRateRupees || ((salaryCalc.baseSalaryRupees || 0) / (salaryCalc.daysInMonth || 30))).toFixed(2)} / day</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Days Present (Full + Half):</span>
                    <span className="font-bold text-emerald-600">{salaryCalc.presentDays} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Days Absent:</span>
                    <span className="font-bold text-rose-600">{salaryCalc.absentDays} days</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-semibold bg-emerald-50/70 p-2 rounded-lg">
                    <span>Pay for Present Days ({salaryCalc.presentDays} days × ₹{(salaryCalc.dailyRateRupees || 0).toFixed(2)}):</span>
                    <span className="font-bold">₹{Number(salaryCalc.calculatedSalaryRupees || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {salaryCalc.advanceRupees > 0 && (
                    <div className="flex justify-between text-amber-700 font-semibold">
                      <span>Deducted Advance Salary:</span>
                      <span>- {formatINR(salaryCalc.advanceRupees * 100)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm">
                    <span className="font-bold text-slate-800">Net Calculated Pay:</span>
                    <span className="font-black text-emerald-700">₹{Number(salaryCalc.payableRupees || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-400">Calculating attendance breakdown...</div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Pay From Account
                </label>
                <select
                  value={selectedAcc}
                  onChange={(e) => setSelectedAcc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Balance: {formatINR(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={saving || !salaryCalc}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Processing...' : 'Disburse Salary Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PAY ADVANCE SALARY MODAL */}
      {advanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div>
                <h3 className="font-bold text-base text-amber-950">Give Salary Advance</h3>
                <p className="text-xs text-amber-800">{advanceModal.name} ({advanceModal.designation})</p>
              </div>
              <button onClick={() => setAdvanceModal(null)}>
                <X className="w-5 h-5 text-amber-900" />
              </button>
            </div>
            <form onSubmit={handlePayAdvance} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Advance Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 2000"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Advance Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={advanceDate}
                    onChange={(e) => setAdvanceDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={advancePayMode}
                    onChange={(e) => setAdvancePayMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="BANK_TRANSFER">Bank Transfer / NEFT</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              {advancePayMode !== 'CASH' && accounts.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Disburse From Account
                  </label>
                  <select
                    value={advanceAcc}
                    onChange={(e) => setAdvanceAcc(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Balance: {formatINR(acc.balance)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Reason / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Festival advance / emergency loan"
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving || !advanceAmount}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 shadow-md transition-all mt-2"
              >
                {saving ? 'Recording...' : 'Disburse Advance'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ATTENDANCE HISTORY LOG MODAL */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-800">Attendance Log</h3>
                <p className="text-xs text-slate-500">{historyModal.name} ({historyModal.designation})</p>
              </div>
              <button onClick={() => setHistoryModal(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {historyModal.attendance && historyModal.attendance.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {historyModal.attendance.map((att) => (
                    <div key={att.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-800">
                          {new Date(att.date).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                        {att.notes && <p className="text-[11px] text-slate-400 mt-0.5">{att.notes}</p>}
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                          att.status === 'PRESENT'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : att.status === 'ABSENT'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {att.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No attendance records logged for this employee yet.
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setHistoryModal(null)}
                className="py-1.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WHATSAPP CONFIRMATION POPUP MODAL */}
      {whatsAppModalStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-emerald-950">WhatsApp Notification</h3>
                  <p className="text-xs text-emerald-700">{whatsAppModalStaff.name}</p>
                </div>
              </div>
              <button onClick={() => setWhatsAppModalStaff(null)}>
                <X className="w-5 h-5 text-emerald-800" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-500 uppercase text-[10px]">Auto-Generated Message:</span>
                <p className="text-slate-800 whitespace-pre-line font-mono text-[11px] bg-white p-3 rounded-lg border border-slate-100">
                  {whatsAppModalStaff.message}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setWhatsAppModalStaff(null)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Dismiss
                </button>
                <a
                  href={whatsAppModalStaff.url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send on WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffPage;
