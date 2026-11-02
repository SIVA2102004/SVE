import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR } from '../utils/formatters';
import { useSocket } from '../context/SocketContext';
import { useScope } from '../context/ScopeContext';
import {
  Wallet,
  Plus,
  RefreshCw,
  X,
  Calendar,
  Building,
  TrendingUp,
  CreditCard,
  FileText,
  DollarSign,
  ArrowDownLeft,
} from 'lucide-react';

interface PersonalIncomeRecord {
  id: string;
  scope: string;
  source: string;
  amount: number;
  date: string;
  paymentMethod: string;
  description?: string;
  paymentMethodAccount?: {
    id: string;
    name: string;
  };
}

const PersonalIncome: React.FC = () => {
  const [incomes, setIncomes] = useState<PersonalIncomeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAcc, setSelectedAcc] = useState('');
  const [saving, setSaving] = useState(false);

  // Form State
  const { scope } = useScope();
  const [formScope, setFormScope] = useState<'PERSONAL' | 'FAMILY'>(
    scope === 'FAMILY' ? 'FAMILY' : 'PERSONAL'
  );
  const [source, setSource] = useState('Salary');
  const [amountRupees, setAmountRupees] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('BANK');
  const [description, setDescription] = useState('');

  const { lastEvent } = useSocket();

  const fetchIncomes = async () => {
    try {
      setLoading(true);
      const [iRes, aRes] = await Promise.all([
        api.get('/personal-income'),
        api.get('/payment-accounts'),
      ]);
      const list = Array.isArray(iRes.data) ? iRes.data : iRes.data?.incomes || [];
      const accs = Array.isArray(aRes.data) ? aRes.data : aRes.data?.accounts || [];
      setIncomes(list);
      setAccounts(accs);
      if (accs.length > 0) setSelectedAcc(accs[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncomes();
  }, []);

  useEffect(() => {
    if (lastEvent) fetchIncomes();
  }, [lastEvent]);

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/personal-income', {
        scope: formScope,
        source,
        amountRupees: parseFloat(amountRupees),
        date: date || new Date().toISOString(),
        paymentMethod,
        paymentMethodAccountId: selectedAcc || undefined,
        description: description || undefined,
      });
      setModalOpen(false);
      setAmountRupees('');
      setDescription('');
      await fetchIncomes();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record personal income');
    } finally {
      setSaving(false);
    }
  };

  const filteredIncomes = incomes.filter((i) => {
    if (scope === 'OVERALL') return true;
    return (i.scope || 'PERSONAL') === scope;
  });

  const totalIncomePaise = filteredIncomes.reduce((acc, i) => acc + i.amount, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Personal & Family Income</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              {filteredIncomes.length} Entries
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Track non-business earnings including salary, rental receipts, agricultural returns, and business drawings
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Recorded Income</span>
            <p className="text-base font-black text-emerald-600">{formatINR(totalIncomePaise)}</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Record Income</span>
          </button>
        </div>
      </div>

      {/* Income List Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
            <span>Loading income records...</span>
          </div>
        ) : filteredIncomes.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-medium p-8">
            <Wallet className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-bold text-slate-700">No income entries found in this scope</p>
            <p className="text-xs text-slate-400 mt-1">Click "+ Record Income" to add salary, rental or personal drawing entries.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4">Destination Account</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIncomes.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-slate-600 whitespace-nowrap">
                      {new Date(inc.date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">
                      <div className="flex items-center space-x-1.5">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{inc.source}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          inc.scope === 'PERSONAL'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-purple-50 text-purple-700'
                        }`}
                      >
                        {inc.scope}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {inc.paymentMethodAccount?.name || 'Cash in Hand'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-600">
                        {inc.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">
                      {inc.description || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-600 text-sm">
                      +{formatINR(inc.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD INCOME MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <h3 className="font-bold text-base text-emerald-950">Record Personal / Family Income</h3>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-emerald-800" />
              </button>
            </div>
            <form onSubmit={handleAddIncome} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Financial Scope *
                  </label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    <option value="PERSONAL">Personal</option>
                    <option value="FAMILY">Family</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Income Source *
                  </label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Salary">Salary / Professional Fees</option>
                    <option value="Rental Income">Rental Income (Property / House)</option>
                    <option value="Business Drawings">Drawings from SVE Store</option>
                    <option value="Agriculture Income">Agriculture / Farm Income</option>
                    <option value="Interest & Investments">Interest / Fixed Deposits</option>
                    <option value="Other Income">Other Personal Income</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Amount Received (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 45000"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Received Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="BANK">Bank Account</option>
                    <option value="UPI">UPI / GooglePay / PhonePe</option>
                    <option value="CASH">Cash in Hand</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Deposit Into Account
                </label>
                <select
                  value={selectedAcc}
                  onChange={(e) => setSelectedAcc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}) - Balance: {formatINR(acc.balance || acc.currentBalance || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notes / Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. October monthly house rent from 1st floor tenant"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs disabled:opacity-50 shadow-md transition-all mt-2"
              >
                {saving ? 'Processing...' : 'Save Income Entry'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalIncome;
