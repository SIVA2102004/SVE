import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatDate, formatINR } from '../utils/formatters';
import { Reminder } from '../types';
import { Bell, Plus, CheckCircle2, RefreshCw, X, Calendar, AlertCircle } from 'lucide-react';

const Reminders: React.FC = () => {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('HIGH');
  const [saving, setSaving] = useState(false);

  const fetchReminders = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reminders');
      const list = Array.isArray(res.data) ? res.data : res.data?.reminders || [];
      const normalized = list.map((r: any) => ({
        ...r,
        priority: r.priority || 'MEDIUM',
        status: r.isCompleted ? 'COMPLETED' : 'PENDING',
      }));
      setReminders(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/reminders', {
        title,
        description,
        dueDate,
        amountRupees: amountRupees ? parseFloat(amountRupees) : undefined,
        priority,
      });
      setModalOpen(false);
      setTitle('');
      setDescription('');
      setDueDate('');
      setAmountRupees('');
      await fetchReminders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create reminder');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await api.patch(`/reminders/${id}/complete`);
      await fetchReminders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update reminder');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Payment & Tax Reminders</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Never miss GST filings, supplier bill cutoffs, insurance renewals, or rent
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Reminder</span>
          </button>
        </div>
      </div>

      {/* Reminders List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
            <span>Loading reminders...</span>
          </div>
        ) : reminders.length === 0 ? (
          <div className="bg-white p-12 text-center text-slate-400 font-medium rounded-2xl border border-slate-200/80">
            No active reminders. You're completely up to date!
          </div>
        ) : (
          reminders.map((r) => (
            <div
              key={r.id}
              className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
                r.status === 'COMPLETED'
                  ? 'bg-slate-50 border-slate-200/60 opacity-60 line-through'
                  : 'bg-white border-slate-200 shadow-sm hover:border-brand-300'
              }`}
            >
              <div className="flex items-start space-x-4">
                <div
                  className={`p-2.5 rounded-xl mt-0.5 ${
                    r.priority === 'HIGH'
                      ? 'bg-rose-100 text-rose-700'
                      : r.priority === 'MEDIUM'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-slate-800 text-sm">{r.title}</h3>
                    <span
                      className={`px-2 py-0.2 rounded text-[10px] font-bold uppercase ${
                        r.priority === 'HIGH'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {r.priority}
                    </span>
                  </div>
                  {r.description && <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>}
                  <p className="text-[11px] font-semibold text-rose-600 mt-1 flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>Due: {formatDate(r.dueDate)}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {r.amount ? (
                  <span className="font-black text-rose-600 text-sm">{formatINR(r.amount)}</span>
                ) : null}
                {r.status === 'PENDING' ? (
                  <button
                    onClick={() => handleComplete(r.id)}
                    className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors font-bold text-xs flex items-center space-x-1"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Done</span>
                  </button>
                ) : (
                  <span className="text-xs text-emerald-700 font-bold">Completed</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE REMINDER MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">New Payment Reminder</h3>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateReminder} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GST-3B Filing Deadline"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Description / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Review sales register with CA"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Amount (₹, optional)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 15000"
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Set Reminder'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reminders;
