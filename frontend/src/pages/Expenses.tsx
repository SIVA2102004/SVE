import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import {
  TrendingDown,
  Plus,
  Search,
  Filter,
  Receipt,
  RefreshCw,
  X,
  PieChart as PieIcon,
} from 'lucide-react';

const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Form State
  const [amountRupees, setAmountRupees] = useState('');
  const [category, setCategory] = useState('Electricity & Utilities');
  const [description, setDescription] = useState('');
  const [selectedAcc, setSelectedAcc] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const [txRes, accRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/payment-accounts'),
      ]);
      const txList = Array.isArray(txRes.data) ? txRes.data : txRes.data?.transactions || [];
      const expenseOnly = txList
        .filter((t: any) => t.type === 'EXPENSE' || t.type === 'PAYABLE_PAYMENT')
        .map((t: any) => ({
          ...t,
          createdAt: t.date || t.createdAt,
          paymentAccount: t.paymentMethodAccount,
        }));
      setExpenses(expenseOnly);
      const accList = Array.isArray(accRes.data) ? accRes.data : accRes.data?.accounts || [];
      setAccounts(accList);
      if (accList.length > 0) setSelectedAcc(accList[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/transactions/expense', {
        amountRupees: parseFloat(amountRupees),
        paymentAccountId: selectedAcc,
        category,
        description: description || category,
      });
      setModalOpen(false);
      setAmountRupees('');
      setDescription('');
      await fetchExpenses();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to record expense');
    } finally {
      setSaving(false);
    }
  };

  const categories = [
    'Electricity & Utilities',
    'Tea & Refreshments',
    'Shop Maintenance & Repairs',
    'Packaging & Stationery',
    'Transport & Freight',
    'Rent',
    'Miscellaneous',
  ];

  const filtered = expenses.filter((e) =>
    categoryFilter === 'ALL' ? true : e.category === categoryFilter
  );

  const totalSpent = filtered.reduce((acc, curr) => (curr.isVoid ? acc : acc + curr.amount), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Shop Daily Expenses</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Categorized shop expenses, petty cash, tea, electricity, rent, maintenance
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Overview Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <span className="text-xs uppercase font-bold text-slate-400">Total Filtered Expenses</span>
          <div className="text-2xl font-black text-rose-600 mt-2">{formatINR(totalSpent)}</div>
          <p className="text-xs text-slate-400 mt-1">{filtered.length} Recorded items</p>
        </div>
        <div className="col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-slate-800">Filter by Expense Category</h4>
            <p className="text-xs text-slate-400">Review departmental costs and petty cash</p>
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
            <span>Loading expenses...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-medium">No expenses found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Paid From</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-xs text-slate-600 font-medium">{formatDate(item.createdAt)}</td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/50">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-800">{item.description}</td>
                    <td className="py-3 px-4 text-xs text-slate-500">{item.paymentAccount?.name}</td>
                    <td className="py-3 px-4 text-right font-black text-rose-600 text-sm">
                      {formatINR(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECORD EXPENSE MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50">
              <h3 className="font-bold text-base text-rose-950">Record Shop Expense</h3>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-rose-800" />
              </button>
            </div>
            <form onSubmit={handleRecordExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 1250"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Paid From Account
                </label>
                <select
                  value={selectedAcc}
                  onChange={(e) => setSelectedAcc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Balance: {formatINR(acc.balance)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Description / Vendor / Item Details
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly electricity bill for ground floor"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Recording...' : 'Save Expense'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
