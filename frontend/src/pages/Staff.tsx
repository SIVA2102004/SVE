import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { Staff } from '../types';
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
} from 'lucide-react';

const StaffPage: React.FC = () => {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [newStaffModal, setNewStaffModal] = useState(false);
  const [attendanceModal, setAttendanceModal] = useState<Staff | null>(null);
  const [salaryModal, setSalaryModal] = useState<Staff | null>(null);

  // New Staff form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('');
  const [monthlySalaryRupees, setMonthlySalaryRupees] = useState('');

  // Attendance Form
  const [attDate, setAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [attStatus, setAttStatus] = useState<'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LEAVE'>('PRESENT');
  const [attNotes, setAttNotes] = useState('');

  // Salary Payment Form
  const [month, setMonth] = useState('2026-10');
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
        designation: st.designation || 'Staff Member',
        status: st.status || 'ACTIVE',
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

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/staff', {
        name,
        phone,
        designation,
        monthlySalaryRupees: parseFloat(monthlySalaryRupees),
      });
      setNewStaffModal(false);
      setName('');
      setPhone('');
      setDesignation('');
      setMonthlySalaryRupees('');
      await fetchStaff();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create staff');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendanceModal) return;
    setSaving(true);
    try {
      await api.post('/staff/attendance', {
        staffId: attendanceModal.id,
        date: attDate,
        status: attStatus,
        notes: attNotes,
      });
      alert(`Attendance for ${attendanceModal.name} on ${attDate} recorded as ${attStatus}!`);
      setAttendanceModal(null);
      setAttNotes('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to mark attendance');
    } finally {
      setSaving(false);
    }
  };

  const openSalaryModal = async (staff: Staff) => {
    setSalaryModal(staff);
    try {
      const res = await api.get(`/staff/${staff.id}/salary/calculate?month=${month}`);
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
      alert(err.response?.data?.error || 'Failed to pay salary');
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
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setNewStaffModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
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
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                    {st.status}
                  </span>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Monthly Salary</span>
                    <p className="text-sm font-black text-slate-800">{formatINR(st.monthlySalary)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Daily Rate</span>
                    <p className="text-xs font-bold text-slate-600">{formatINR(st.dailyRate)} / day</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAttendanceModal(st)}
                  className="py-2 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Attendance</span>
                </button>
                <button
                  onClick={() => openSalaryModal(st)}
                  className="py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1"
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Pay Salary</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* NEW STAFF MODAL */}
      {newStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">Add New Employee</h3>
              <button onClick={() => setNewStaffModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
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
                {saving ? 'Saving...' : 'Save Employee'}
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
              {salaryCalc ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Days in Month:</span>
                    <span className="font-bold text-slate-700">{salaryCalc.daysInMonth} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Present (Full + Half):</span>
                    <span className="font-bold text-emerald-600">{salaryCalc.presentDays} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unpaid Absences:</span>
                    <span className="font-bold text-rose-600">{salaryCalc.absentDays} days</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm">
                    <span className="font-bold text-slate-800">Net Calculated Pay:</span>
                    <span className="font-black text-emerald-700">₹{salaryCalc.payableRupees.toLocaleString('en-IN')}</span>
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
    </div>
  );
};

export default StaffPage;
