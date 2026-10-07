import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { Loan } from '../types';
import {
  CreditCard,
  Plus,
  RefreshCw,
  X,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
} from 'lucide-react';

const Loans: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeLoanSchedule, setActiveLoanSchedule] = useState<Loan | null>(null);
  const [payEmiModal, setPayEmiModal] = useState<{ loan: Loan; installment: any } | null>(null);

  // New Loan Form
  const [newLoanModal, setNewLoanModal] = useState(false);
  const [bankName, setBankName] = useState('');
  const [loanType, setLoanType] = useState('Business Expansion Loan');
  const [principalRupees, setPrincipalRupees] = useState('');
  const [interestRate, setInterestRate] = useState('11.5');
  const [tenureMonths, setTenureMonths] = useState('36');
  const [dueDayOfMonth, setDueDayOfMonth] = useState('5');

  // Pay EMI form
  const [selectedAcc, setSelectedAcc] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const [lRes, aRes] = await Promise.all([api.get('/loans'), api.get('/payment-accounts')]);
      const list = Array.isArray(lRes.data) ? lRes.data : lRes.data?.loans || [];
      const normalized = list.map((l: any) => ({
        ...l,
        emiAmount: l.monthlyEmi || l.emiAmount,
      }));
      setLoans(normalized);
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
    fetchLoans();
  }, []);

  const handleCreateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/loans', {
        bankName,
        loanType,
        principalAmountRupees: parseFloat(principalRupees),
        interestRate: parseFloat(interestRate),
        tenureMonths: parseInt(tenureMonths, 10),
        startDate: new Date().toISOString().split('T')[0],
        dueDayOfMonth: parseInt(dueDayOfMonth, 10),
      });
      setNewLoanModal(false);
      setBankName('');
      setPrincipalRupees('');
      await fetchLoans();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create loan');
    } finally {
      setSaving(false);
    }
  };

  const handlePayEmi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payEmiModal) return;
    setSaving(true);
    try {
      await api.post(`/loans/installments/${payEmiModal.installment.id}/pay`, {
        paymentAccountId: selectedAcc,
      });
      alert('EMI installment recorded successfully!');
      setPayEmiModal(null);
      await fetchLoans();
      if (activeLoanSchedule && activeLoanSchedule.id === payEmiModal.loan.id) {
        const refreshed = await api.get('/loans');
        const updated = refreshed.data.find((l: any) => l.id === payEmiModal.loan.id);
        setActiveLoanSchedule(updated);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to pay EMI');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Loans, EMIs & Liabilities</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Bank loans, vehicle financing, EMI amortization schedules, and payment tracking
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setNewLoanModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Loan</span>
          </button>
        </div>
      </div>

      {/* Loans Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
            <span>Loading loans...</span>
          </div>
        ) : loans.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 font-medium bg-white rounded-2xl border border-slate-200/80">
            No active loans recorded. Click "+ Add Loan" to set up bank financing.
          </div>
        ) : (
          loans.map((loan) => (
            <div
              key={loan.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{loan.bankName}</h3>
                    <p className="text-xs text-brand-600 font-semibold">{loan.loanType}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                    {loan.status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Principal</span>
                    <p className="font-bold text-slate-700">{formatINR(loan.principalAmount)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Monthly EMI</span>
                    <p className="font-bold text-rose-600">{formatINR(loan.emiAmount)}</p>
                  </div>
                  <div className="mt-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Tenure</span>
                    <p className="font-bold text-slate-700">{loan.tenureMonths} Months</p>
                  </div>
                  <div className="mt-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Interest</span>
                    <p className="font-bold text-slate-700">{loan.interestRate}% p.a.</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500">Due day: {loan.dueDayOfMonth}th of month</span>
                <button
                  onClick={() => setActiveLoanSchedule(loan)}
                  className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold rounded-xl text-xs transition-colors flex items-center space-x-1"
                >
                  <span>Amortization Table</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* AMORTIZATION SCHEDULE MODAL */}
      {activeLoanSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-800">
                  EMI Schedule – {activeLoanSchedule.bankName} ({activeLoanSchedule.loanType})
                </h3>
                <p className="text-xs text-slate-500">
                  EMI Amount: {formatINR(activeLoanSchedule.emiAmount)} / Month
                </p>
              </div>
              <button onClick={() => setActiveLoanSchedule(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Principal</th>
                    <th className="py-2.5 px-3">Interest</th>
                    <th className="py-2.5 px-3 text-right">EMI Amount</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeLoanSchedule.installments?.map((inst) => (
                    <tr key={inst.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-500">{inst.installmentNo}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-700">{formatDate(inst.dueDate)}</td>
                      <td className="py-2.5 px-3 text-slate-600">{formatINR(inst.principalComponent)}</td>
                      <td className="py-2.5 px-3 text-slate-600">{formatINR(inst.interestComponent)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                        {formatINR(inst.emiAmount)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inst.status === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {inst.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {inst.status !== 'PAID' && (
                          <button
                            onClick={() =>
                              setPayEmiModal({ loan: activeLoanSchedule, installment: inst })
                            }
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px]"
                          >
                            Pay EMI
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PAY EMI MODAL */}
      {payEmiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <h3 className="font-bold text-base text-emerald-950">Pay EMI Installment</h3>
              <button onClick={() => setPayEmiModal(null)}>
                <X className="w-5 h-5 text-emerald-800" />
              </button>
            </div>
            <form onSubmit={handlePayEmi} className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl space-y-1 text-xs">
                <p>
                  <strong>Loan:</strong> {payEmiModal.loan.bankName}
                </p>
                <p>
                  <strong>Installment #:</strong> {payEmiModal.installment.installmentNo}
                </p>
                <p className="text-base font-black text-rose-600 pt-1">
                  Amount: {formatINR(payEmiModal.installment.emiAmount)}
                </p>
              </div>

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
                disabled={saving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Processing...' : 'Confirm EMI Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* NEW LOAN MODAL */}
      {newLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">Add Bank Loan / EMI</h3>
              <button onClick={() => setNewLoanModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateLoan} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Lender Bank / NBFC *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Bank, SBI, Bajaj Finance"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Principal Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 500000"
                  value={principalRupees}
                  onChange={(e) => setPrincipalRupees(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Interest Rate (% p.a.)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Tenure (Months)
                  </label>
                  <input
                    type="number"
                    required
                    value={tenureMonths}
                    onChange={(e) => setTenureMonths(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Calculating Amortization...' : 'Create Loan & Schedule'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Loans;
