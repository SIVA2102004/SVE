import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR, formatDate, formatTime } from '../utils/formatters';
import { Transaction } from '../types';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  Search,
  Slash,
  AlertOctagon,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';

const MoneyFlow: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [voidModalTx, setVoidModalTx] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidLoading, setVoidLoading] = useState(false);
  const [error, setError] = useState('');
  const { hasRole } = useAuth();
  const { lastEvent } = useSocket();

  const fetchTransactions = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await api.get('/transactions');
      const list = Array.isArray(res.data) ? res.data : res.data?.transactions || [];
      const normalized = list.map((tx: any) => ({
        ...tx,
        transactionNo: tx.reference || `TXN-${tx.id.slice(-6)}`,
        direction: tx.type === 'INCOME' || tx.type === 'RECEIVABLE_PAYMENT' ? 'IN' : 'OUT',
        partyName: tx.source || tx.destination,
        paymentAccount: tx.paymentMethodAccount,
        isVoid: tx.status === 'VOID' || !!tx.voidReason,
        createdAt: tx.date || tx.createdAt,
      }));
      setTransactions(normalized);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch ledger transactions');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Instant real-time auto sync across all devices
  useEffect(() => {
    if (lastEvent) {
      fetchTransactions(true);
    }
  }, [lastEvent]);

  const handleVoidTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidModalTx || !voidReason) return;
    setVoidLoading(true);

    try {
      await api.post(`/transactions/${voidModalTx.id}/void`, { reason: voidReason });
      setVoidModalTx(null);
      setVoidReason('');
      await fetchTransactions();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to void transaction');
    } finally {
      setVoidLoading(false);
    }
  };

  const filtered = transactions.filter((tx) => {
    const matchesSearch =
      tx.transactionNo.toLowerCase().includes(search.toLowerCase()) ||
      tx.description.toLowerCase().includes(search.toLowerCase()) ||
      (tx.partyName && tx.partyName.toLowerCase().includes(search.toLowerCase())) ||
      tx.category.toLowerCase().includes(search.toLowerCase());

    const matchesType =
      typeFilter === 'ALL'
        ? true
        : typeFilter === 'IN'
        ? tx.direction === 'IN'
        : typeFilter === 'OUT'
        ? tx.direction === 'OUT'
        : tx.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const exportTransactionsCSV = () => {
    if (filtered.length === 0) {
      alert('No transactions to export');
      return;
    }
    let csv = 'Txn No,Date,Party / Destination,Category,Account,Direction,Amount (INR),Status\n';
    filtered.forEach((tx) => {
      const dateStr = formatDate(tx.createdAt);
      const party = (tx.partyName || tx.description || '').replace(/,/g, ' ');
      const cat = (tx.category || '').replace(/,/g, ' ');
      const acc = (tx.paymentAccount?.name || 'Account').replace(/,/g, ' ');
      const dir = tx.direction;
      const amt = tx.amount / 100;
      const status = tx.isVoid ? 'VOID' : 'COMPLETED';
      csv += `${tx.transactionNo},${dateStr},${party},${cat},${acc},${dir},${amt},${status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SVE_Transactions_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">SVE Money Flow & Ledger</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Complete immutable transaction log with audit capability & void tracking
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={exportTransactionsCSV}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download CSV</span>
          </button>
          <button
            onClick={() => fetchTransactions()}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by transaction ID, customer, dealer, notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="ALL">All Flows</option>
            <option value="IN">Money In (+)</option>
            <option value="OUT">Money Out (-)</option>
            <option value="CUSTOMER_PAYMENT">Customer Payments</option>
            <option value="DEALER_PAYMENT">Dealer Payments</option>
            <option value="EXPENSE">Direct Expenses</option>
            <option value="SALARY">Salaries</option>
            <option value="LOAN_EMI">Loan EMIs</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
            <span>Loading ledger...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-medium">No transactions found matching your criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase font-bold tracking-wider">
                  <th className="py-3.5 px-4">Txn #</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Party / Reason</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Account</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  {hasRole(['OWNER']) && <th className="py-3.5 px-4 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((tx) => (
                  <tr
                    key={tx.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      tx.isVoid ? 'opacity-50 bg-rose-50/20 line-through' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono text-xs font-bold text-slate-700">
                      {tx.transactionNo}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <div>{formatDate(tx.createdAt)}</div>
                      <div className="text-[10px] text-slate-400">{formatTime(tx.createdAt)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 text-xs sm:text-sm">
                        {tx.partyName || tx.description}
                      </div>
                      {tx.partyName && (
                        <div className="text-xs text-slate-500 truncate max-w-xs">{tx.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {tx.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700">
                      {tx.paymentAccount?.name || 'Cash'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-black text-sm ${
                          tx.isVoid
                            ? 'text-slate-400'
                            : tx.direction === 'IN'
                            ? 'text-emerald-600'
                            : 'text-rose-600'
                        }`}
                      >
                        {tx.direction === 'IN' ? '+' : '-'} {formatINR(tx.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {tx.isVoid ? (
                        <span
                          title={`Voided: ${tx.voidReason}`}
                          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800"
                        >
                          VOIDED
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          SUCCESS
                        </span>
                      )}
                    </td>
                    {hasRole(['OWNER']) && (
                      <td className="py-3 px-4 text-center">
                        {!tx.isVoid ? (
                          <button
                            onClick={() => setVoidModalTx(tx)}
                            title="Void this transaction with audit reason"
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <AlertOctagon className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300">-</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VOID TRANSACTION MODAL */}
      {voidModalTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 bg-rose-600 text-white flex items-center space-x-2">
              <AlertOctagon className="w-5 h-5" />
              <h3 className="font-bold text-base">Confirm Transaction Void</h3>
            </div>
            <form onSubmit={handleVoidTransaction} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Voiding <strong>{voidModalTx.transactionNo}</strong> ({formatINR(voidModalTx.amount)}) will
                automatically reverse account balances and customer/dealer pending balances. The ledger entry
                is preserved for immutable audit logs.
              </p>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Reason for Voiding (Mandatory)
                </label>
                <textarea
                  required
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Duplicate entry by staff, wrong bill selected..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVoidModalTx(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voidLoading || !voidReason.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl disabled:opacity-50"
                >
                  {voidLoading ? 'Voiding...' : 'Yes, Void Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MoneyFlow;
