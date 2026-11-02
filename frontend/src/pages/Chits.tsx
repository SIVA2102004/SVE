import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR } from '../utils/formatters';
import { useSocket } from '../context/SocketContext';
import { useScope } from '../context/ScopeContext';
import {
  Coins,
  Plus,
  RefreshCw,
  X,
  Calendar,
  Award,
  TrendingUp,
  CheckCircle,
  FileText,
  DollarSign,
  Clock,
} from 'lucide-react';

interface ChitInstallment {
  id: string;
  monthNumber: number;
  dueDate: string;
  amountExpected: number;
  amountPaid: number;
  dividendEarned: number;
  status: string;
  paidDate?: string;
}

interface ChitScheme {
  id: string;
  scope: string;
  chitName: string;
  chitCompany: string;
  chitNumber?: string;
  totalValue: number;
  monthlyContribution: number;
  totalMonths: number;
  currentMonth: number;
  startDate: string;
  endDate?: string;
  dueDayOfMonth: number;
  status: string;
  isPrized: boolean;
  prizedMonth?: number;
  prizedAmount?: number;
  notes?: string;
  installments?: ChitInstallment[];
}

const Chits: React.FC = () => {
  const [chits, setChits] = useState<ChitScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [payModalChit, setPayModalChit] = useState<ChitScheme | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAcc, setSelectedAcc] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [dividendAmount, setDividendAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Form State
  const { scope } = useScope();
  const [formScope, setFormScope] = useState<'PERSONAL' | 'FAMILY' | 'BUSINESS'>(
    scope === 'OVERALL' ? 'PERSONAL' : (scope as 'PERSONAL' | 'FAMILY' | 'BUSINESS')
  );
  const [chitName, setChitName] = useState('');
  const [chitCompany, setChitCompany] = useState('');
  const [chitNumber, setChitNumber] = useState('');
  const [totalValueRupees, setTotalValueRupees] = useState('');
  const [monthlyContributionRupees, setMonthlyContributionRupees] = useState('');
  const [totalMonths, setTotalMonths] = useState('50');
  const [startDate, setStartDate] = useState('');
  const [dueDayOfMonth, setDueDayOfMonth] = useState('10');
  const [notes, setNotes] = useState('');

  const { lastEvent } = useSocket();

  const fetchChits = async () => {
    try {
      setLoading(true);
      const [cRes, aRes] = await Promise.all([
        api.get('/chits'),
        api.get('/payment-accounts'),
      ]);
      const list = Array.isArray(cRes.data) ? cRes.data : cRes.data?.chits || [];
      const accs = Array.isArray(aRes.data) ? aRes.data : aRes.data?.accounts || [];
      setChits(list);
      setAccounts(accs);
      if (accs.length > 0) setSelectedAcc(accs[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChits();
  }, []);

  useEffect(() => {
    if (lastEvent) fetchChits();
  }, [lastEvent]);

  const handleCreateChit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/chits', {
        scope: formScope,
        chitName,
        chitCompany,
        chitNumber: chitNumber || undefined,
        totalValueRupees: parseFloat(totalValueRupees),
        monthlyContributionRupees: parseFloat(monthlyContributionRupees),
        totalMonths: parseInt(totalMonths),
        startDate: startDate || new Date().toISOString(),
        dueDayOfMonth: parseInt(dueDayOfMonth),
        notes: notes || undefined,
      });
      setModalOpen(false);
      // Reset form
      setChitName('');
      setChitCompany('');
      setChitNumber('');
      setTotalValueRupees('');
      setMonthlyContributionRupees('');
      setNotes('');
      await fetchChits();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create chit scheme');
    } finally {
      setSaving(false);
    }
  };

  const handlePayInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalChit) return;
    setSaving(true);
    try {
      await api.post(`/chits/${payModalChit.id}/pay`, {
        amountRupees: parseFloat(payAmount),
        dividendRupees: dividendAmount ? parseFloat(dividendAmount) : 0,
        paymentAccountId: selectedAcc,
      });
      alert('Chit contribution payment recorded successfully!');
      setPayModalChit(null);
      setPayAmount('');
      setDividendAmount('');
      await fetchChits();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record chit payment');
    } finally {
      setSaving(false);
    }
  };

  const filteredChits = chits.filter((c) => {
    if (scope === 'OVERALL') return true;
    return (c.scope || 'PERSONAL') === scope;
  });

  const totalCommittedValue = filteredChits.reduce((acc, c) => acc + c.totalValue, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Chit Funds & Savings</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              {filteredChits.length} Schemes
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Manage your personal and family chit funds, track monthly contributions, dividends, and auction payouts
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Chit Value</span>
            <p className="text-base font-black text-amber-600">{formatINR(totalCommittedValue)}</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Chit Scheme</span>
          </button>
        </div>
      </div>

      {/* Grid of Chits */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
            <span>Loading chit schemes...</span>
          </div>
        ) : filteredChits.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 font-medium bg-white rounded-2xl border border-slate-200/80 p-8">
            <Coins className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-bold text-slate-700">No chit schemes found in this scope</p>
            <p className="text-xs text-slate-400 mt-1">Click "+ Add Chit Scheme" to start tracking your chit accounts.</p>
          </div>
        ) : (
          filteredChits.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
            >
              <div
                className={`absolute top-0 left-0 right-0 h-1.5 ${
                  c.scope === 'PERSONAL'
                    ? 'bg-emerald-500'
                    : c.scope === 'FAMILY'
                    ? 'bg-purple-500'
                    : 'bg-brand-600'
                }`}
              />

              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {c.chitCompany}
                    </span>
                    <h3 className="font-bold text-slate-800 text-base mt-0.5">{c.chitName}</h3>
                    {c.chitNumber && (
                      <p className="text-xs font-mono text-slate-500 mt-0.5">#{c.chitNumber}</p>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      c.scope === 'PERSONAL'
                        ? 'bg-emerald-50 text-emerald-700'
                        : c.scope === 'FAMILY'
                        ? 'bg-purple-50 text-purple-700'
                        : 'bg-brand-50 text-brand-700'
                    }`}
                  >
                    {c.scope}
                  </span>
                </div>

                <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Total Chit Value:</span>
                    <span className="font-black text-slate-900 text-sm">{formatINR(c.totalValue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Monthly Contribution:</span>
                    <span className="font-bold text-amber-600">{formatINR(c.monthlyContribution)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Tenure / Progress:</span>
                    <span className="font-semibold text-slate-700">
                      Month {c.currentMonth} of {c.totalMonths}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Due Day:</span>
                    <span className="font-medium text-slate-600">{c.dueDayOfMonth}th of every month</span>
                  </div>
                </div>

                {c.isPrized ? (
                  <div className="mt-3 p-2 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center space-x-2 text-xs text-emerald-800 font-semibold">
                    <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Auction Lifted: {formatINR(c.prizedAmount || 0)} (Month {c.prizedMonth})</span>
                  </div>
                ) : (
                  <div className="mt-3 p-2 bg-slate-100 rounded-xl flex items-center space-x-1.5 text-xs text-slate-600 font-medium">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Active Non-Prized Chit</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => {
                    setPayModalChit(c);
                    setPayAmount((c.monthlyContribution / 100).toString());
                  }}
                  className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>Pay Installment</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE CHIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">Add New Chit Fund Scheme</h3>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateChit} className="p-6 space-y-3.5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Financial Scope *
                  </label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 font-semibold"
                  >
                    <option value="PERSONAL">Personal</option>
                    <option value="FAMILY">Family</option>
                    <option value="BUSINESS">Business</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Monthly Due Day (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDayOfMonth}
                    onChange={(e) => setDueDayOfMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Chit Scheme Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5 Lakhs 50 Months Chit #1"
                  value={chitName}
                  onChange={(e) => setChitName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Chit Company / Organizer *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shriram Chits, Kapil Chits, Local Group"
                    value={chitCompany}
                    onChange={(e) => setChitCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Chit Ref / Passbook #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. C-1048"
                    value={chitNumber}
                    onChange={(e) => setChitNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Total Chit Value (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 500000"
                    value={totalValueRupees}
                    onChange={(e) => setTotalValueRupees(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Monthly Contribution (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 10000"
                    value={monthlyContributionRupees}
                    onChange={(e) => setMonthlyContributionRupees(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Total Duration (Months) *
                  </label>
                  <input
                    type="number"
                    required
                    value={totalMonths}
                    onChange={(e) => setTotalMonths(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs disabled:opacity-50 shadow-md transition-all mt-2"
              >
                {saving ? 'Saving...' : 'Save Chit Scheme'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PAY CHIT INSTALLMENT MODAL */}
      {payModalChit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div>
                <h3 className="font-bold text-base text-amber-950">Pay Chit Installment</h3>
                <p className="text-xs text-amber-700 mt-0.5">{payModalChit.chitName}</p>
              </div>
              <button onClick={() => setPayModalChit(null)}>
                <X className="w-5 h-5 text-amber-800" />
              </button>
            </div>
            <form onSubmit={handlePayInstallment} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Amount Paid (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Dividend / Discount (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 1500"
                    value={dividendAmount}
                    onChange={(e) => setDividendAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Pay From Account
                </label>
                <select
                  value={selectedAcc}
                  onChange={(e) => setSelectedAcc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}) - Balance: {formatINR(acc.balance || acc.currentBalance || 0)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs disabled:opacity-50 shadow-md"
              >
                {saving ? 'Processing...' : 'Confirm Chit Payment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chits;
