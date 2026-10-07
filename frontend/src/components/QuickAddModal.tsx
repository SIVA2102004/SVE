import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { toPaise } from '../utils/formatters';
import { X, ArrowDownRight, ArrowUpRight, TrendingDown, UserPlus, Truck, RefreshCw } from 'lucide-react';

interface QuickAddModalProps {
  onClose: () => void;
}

const QuickAddModal: React.FC<QuickAddModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'RECEIVE' | 'PAY' | 'EXPENSE'>('RECEIVE');
  const [customers, setCustomers] = useState<any[]>([]);
  const [dealers, setDealers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [selectedDealer, setSelectedDealer] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK' | 'UPI'>('CASH');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [custRes, dealRes, accRes] = await Promise.all([
          api.get('/customers'),
          api.get('/dealers'),
          api.get('/payment-accounts'),
        ]);
        const custList = Array.isArray(custRes.data) ? custRes.data : custRes.data?.customers || [];
        const dealList = Array.isArray(dealRes.data) ? dealRes.data : dealRes.data?.dealers || [];
        const accList = Array.isArray(accRes.data) ? accRes.data : accRes.data?.accounts || [];
        setCustomers(custList);
        setDealers(dealList);
        setAccounts(accList);
        if (accList.length > 0) {
          setSelectedAccount(accList[0].id);
        }
      } catch (err) {
        console.error('Failed to load modal dependencies', err);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const val = parseFloat(amountRupees);
    if (isNaN(val) || val <= 0) {
      setError('Please enter a valid positive amount.');
      setLoading(false);
      return;
    }

    try {
      if (activeTab === 'RECEIVE') {
        if (!selectedCustomer) {
          setError('Please select a customer.');
          setLoading(false);
          return;
        }
        await api.post(`/customers/${selectedCustomer}/payment`, {
          amountRupees: val,
          paymentAccountId: selectedAccount,
          paymentMode,
          notes: description || 'Customer payment received via Quick Add',
        });
        setSuccess('Customer payment recorded successfully!');
      } else if (activeTab === 'PAY') {
        if (!selectedDealer) {
          setError('Please select a dealer.');
          setLoading(false);
          return;
        }
        await api.post(`/dealers/${selectedDealer}/payment`, {
          amountRupees: val,
          paymentAccountId: selectedAccount,
          paymentMode,
          notes: description || 'Dealer bill paid via Quick Add',
        });
        setSuccess('Dealer payment recorded successfully!');
      } else if (activeTab === 'EXPENSE') {
        await api.post('/transactions/expense', {
          amountRupees: val,
          paymentAccountId: selectedAccount,
          category: category || 'Shop Expense',
          description: description || 'Direct shop expense',
        });
        setSuccess('Expense recorded successfully!');
      }

      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 800);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Operation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold">
              +
            </div>
            <h3 className="text-lg font-bold text-slate-800">Quick Record Transaction</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-100/60 p-1">
          <button
            onClick={() => setActiveTab('RECEIVE')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'RECEIVE'
                ? 'bg-white text-emerald-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowDownRight className="w-4 h-4 text-emerald-600" />
            <span>Receive Money</span>
          </button>
          <button
            onClick={() => setActiveTab('PAY')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'PAY'
                ? 'bg-white text-rose-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
            <span>Pay Dealer</span>
          </button>
          <button
            onClick={() => setActiveTab('EXPENSE')}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg flex items-center justify-center space-x-1.5 transition-all ${
              activeTab === 'EXPENSE'
                ? 'bg-white text-amber-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingDown className="w-4 h-4 text-amber-600" />
            <span>Shop Expense</span>
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-700">
              {success}
            </div>
          )}

          {activeTab === 'RECEIVE' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Customer
              </label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">-- Choose Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone}) - Due: ₹{(c.pendingBalance / 100).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'PAY' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Dealer / Supplier
              </label>
              <select
                value={selectedDealer}
                onChange={(e) => setSelectedDealer(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">-- Choose Dealer --</option>
                {dealers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.phone}) - Due: ₹{(d.pendingBalance / 100).toLocaleString('en-IN')}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTab === 'EXPENSE' && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Expense Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="Electricity & Utilities">Electricity & Utilities</option>
                <option value="Tea & Refreshments">Tea & Refreshments</option>
                <option value="Shop Maintenance & Repairs">Shop Maintenance & Repairs</option>
                <option value="Packaging & Stationery">Packaging & Stationery</option>
                <option value="Transport & Freight">Transport & Freight</option>
                <option value="Miscellaneous">Miscellaneous</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Amount (₹)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder="e.g. 5000"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-bold text-base focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Payment Account
              </label>
              <select
                value={selectedAccount}
                onChange={(e) => {
                  setSelectedAccount(e.target.value);
                  const acc = accounts.find((a) => a.id === e.target.value);
                  if (acc) setPaymentMode(acc.type);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({acc.type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Notes / Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Bill #104 part payment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {loading && <RefreshCw className="w-5 h-5 animate-spin" />}
              <span>{loading ? 'Processing...' : 'Confirm Transaction'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickAddModal;
