import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR, formatDate, formatTime } from '../utils/formatters';
import { DashboardMetrics } from '../types';
import { useSocket } from '../context/SocketContext';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Building,
  CreditCard,
  Users,
  AlertTriangle,
  Calendar,
  Clock,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { lastEvent } = useSocket();

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard');
      setData(res.data?.data || res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  // Real-time auto reload on transactions
  useEffect(() => {
    if (lastEvent) {
      fetchDashboard();
    }
  }, [lastEvent]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-10 h-10 text-brand-600 animate-spin" />
        <p className="text-slate-500 font-medium">Crunching shop numbers in real time...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 font-semibold">
        {error || 'Unable to load dashboard metrics.'}
      </div>
    );
  }

  const accounts = data.accounts || { cash: 0, bank: 0, upi: 0 };
  const accountDistribution = [
    { name: 'Cash in Hand', value: (accounts.cash || 0) / 100, color: '#10b981' },
    { name: 'Bank Balance', value: (accounts.bank || 0) / 100, color: '#0ea5e9' },
    { name: 'UPI & Wallets', value: (accounts.upi || 0) / 100, color: '#8b5cf6' },
  ];

  const cashFlowComparison = [
    {
      period: 'Today',
      Inflow: (data.todayIncome || 0) / 100,
      Outflow: (data.todayExpense || 0) / 100,
    },
    {
      period: 'This Month',
      Inflow: (data.monthlyIncome || 0) / 100,
      Outflow: (data.monthlyExpense || 0) / 100,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner with Summary */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Shop Financial Overview</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time balance, receivables, payables, and commitments
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchDashboard}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* TOP 8 METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Current Balance */}
        <div className="bg-gradient-to-br from-navy-900 to-navy-950 text-white p-5 rounded-2xl shadow-md border border-navy-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Total Balance</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-white">{formatINR(data.currentBalance)}</div>
            <div className="mt-2 pt-2 border-t border-navy-800 flex justify-between text-[11px] text-slate-400">
              <span>Cash: {formatINR(accounts.cash || 0)}</span>
              <span>Bank: {formatINR(accounts.bank || 0)}</span>
            </div>
          </div>
        </div>

        {/* 2. Total Receivables (From Customers) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-700">Customer Dues (Receive)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-600">{formatINR(data.totalReceivable)}</div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Pending customer bills</span>
              <Link to="/customers" className="text-emerald-700 font-bold hover:underline flex items-center">
                View <ArrowRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 3. Total Payables (To Dealers) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-bold tracking-wider text-rose-700">Dealer Dues (Pay)</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-rose-600">{formatINR(data.totalPayable)}</div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Pending purchase bills</span>
              <Link to="/dealers" className="text-rose-700 font-bold hover:underline flex items-center">
                View <ArrowRight className="w-3 h-3 ml-0.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* 4. Net Monthly Cash Flow */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs uppercase font-bold tracking-wider text-brand-700">Monthly Net Flow</span>
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className={`text-2xl font-black ${data.monthlyNetFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {formatINR(data.monthlyNetFlow)}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>In: {formatINR(data.monthlyIncome)}</span>
              <span>Out: {formatINR(data.monthlyExpense)}</span>
            </div>
          </div>
        </div>

        {/* 5. Today's Inflow */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-500">Today's Income</span>
          <div className="text-xl font-bold text-slate-800 mt-2">{formatINR(data.todayIncome)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Receipts & direct sales today</p>
        </div>

        {/* 6. Today's Outflow */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-500">Today's Expenses</span>
          <div className="text-xl font-bold text-slate-800 mt-2">{formatINR(data.todayExpense)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Dealer payments & shop costs</p>
        </div>

        {/* 7. Active EMIs & Commitments */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-500">Monthly EMI Liability</span>
          <div className="text-xl font-bold text-amber-700 mt-2">{formatINR(data.monthlyEmiCommitment)}</div>
          <p className="text-[11px] text-slate-400 mt-1">{data.activeLoansCount} Active bank loan(s)</p>
        </div>

        {/* 8. Monthly Staff Salary Liability */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
          <span className="text-xs uppercase font-bold tracking-wider text-slate-500">Staff Salary Liability</span>
          <div className="text-xl font-bold text-indigo-700 mt-2">{formatINR(data.monthlySalaryLiability)}</div>
          <p className="text-[11px] text-slate-400 mt-1">{data.activeStaffCount} active employees</p>
        </div>
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income vs Outflow Bar Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-base">Inflow vs Outflow Comparison</h3>
            <span className="text-xs text-slate-400 font-medium">INR (₹)</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowComparison}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="period" stroke="#64748b" fontSize={12} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`} />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="Inflow" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Outflow" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Account Balance Distribution Pie */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-base mb-1">Account Liquidity</h3>
            <p className="text-xs text-slate-500">Breakdown of total liquid funds</p>
          </div>
          <div className="h-48 w-full flex items-center justify-center my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={accountDistribution}
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {accountDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
            {accountDistribution.map((acc) => (
              <div key={acc.name} className="flex items-center justify-between">
                <span className="flex items-center text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: acc.color }}></span>
                  {acc.name}
                </span>
                <span className="font-bold text-slate-800">₹{acc.value.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* LOWER SECTION: UPCOMING PAYMENTS & RECENT TRANSACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming 7-day Payment Schedule */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-amber-600" />
              <h3 className="font-bold text-slate-800 text-base">Upcoming 7-Day Due Payments</h3>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
              {data.upcomingPayments.length} Due
            </span>
          </div>

          {data.upcomingPayments.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              No payments due in the next 7 days.
            </div>
          ) : (
            <div className="space-y-3">
              {data.upcomingPayments.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/70 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2 bg-amber-100/70 text-amber-700 rounded-lg shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800 text-sm">{item.party}</span>
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                          {item.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      <p className="text-[11px] font-semibold text-rose-600 mt-0.5">
                        Due: {formatDate(item.dueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-rose-600 text-sm">{formatINR(item.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Real-Time Recent Transactions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-base">Recent Transactions</h3>
            <Link to="/money-flow" className="text-xs text-brand-600 font-bold hover:underline flex items-center">
              View All <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>

          <div className="space-y-3">
            {data.recentTransactions.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/60"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                      tx.direction === 'IN'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {tx.direction === 'IN' ? '+' : '-'}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-xs sm:text-sm">
                      {tx.partyName || tx.description}
                    </p>
                    <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                      <span>{tx.category}</span>
                      <span>•</span>
                      <span>{formatDate(tx.createdAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-black text-xs sm:text-sm ${
                      tx.direction === 'IN' ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {tx.direction === 'IN' ? '+' : '-'} {formatINR(tx.amount)}
                  </div>
                  <span className="text-[10px] text-slate-400 uppercase">
                    {tx.paymentAccount?.name || 'Account'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
