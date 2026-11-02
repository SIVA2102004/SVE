import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR } from '../utils/formatters';
import { useSocket } from '../context/SocketContext';
import { useScope } from '../context/ScopeContext';
import {
  Shield,
  Plus,
  RefreshCw,
  X,
  Calendar,
  AlertCircle,
  Building,
  User,
  CreditCard,
  FileText,
  Clock,
  CheckCircle,
} from 'lucide-react';

interface InsurancePolicy {
  id: string;
  scope: string;
  insuranceType: string;
  policyName: string;
  company: string;
  policyNumber: string;
  policyHolder?: string;
  nominee?: string;
  sumAssured: number;
  premiumAmount: number;
  frequency: string;
  startDate: string;
  expiryDate: string;
  maturityDate?: string;
  nextPaymentDate?: string;
  vehicleOrAsset?: string;
  status: string;
  notes?: string;
}

const Insurance: React.FC = () => {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [payModalPolicy, setPayModalPolicy] = useState<InsurancePolicy | null>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAcc, setSelectedAcc] = useState('');
  const [payMode, setPayMode] = useState('BANK');
  const [saving, setSaving] = useState(false);

  // Form State
  const { scope } = useScope();
  const [formScope, setFormScope] = useState<'PERSONAL' | 'FAMILY' | 'BUSINESS'>(
    scope === 'OVERALL' ? 'PERSONAL' : (scope as 'PERSONAL' | 'FAMILY' | 'BUSINESS')
  );
  const [policyName, setPolicyName] = useState('');
  const [company, setCompany] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [policyHolder, setPolicyHolder] = useState('');
  const [nominee, setNominee] = useState('');
  const [insuranceType, setInsuranceType] = useState('Health Insurance');
  const [sumAssuredRupees, setSumAssuredRupees] = useState('');
  const [premiumAmountRupees, setPremiumAmountRupees] = useState('');
  const [frequency, setFrequency] = useState('YEARLY');
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [vehicleOrAsset, setVehicleOrAsset] = useState('');
  const [notes, setNotes] = useState('');

  const { lastEvent } = useSocket();

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const [pRes, aRes] = await Promise.all([
        api.get('/insurance'),
        api.get('/payment-accounts'),
      ]);
      const list = Array.isArray(pRes.data) ? pRes.data : pRes.data?.policies || [];
      const accs = Array.isArray(aRes.data) ? aRes.data : aRes.data?.accounts || [];
      setPolicies(list);
      setAccounts(accs);
      if (accs.length > 0) setSelectedAcc(accs[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  useEffect(() => {
    if (lastEvent) fetchPolicies();
  }, [lastEvent]);

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/insurance', {
        scope: formScope,
        policyName,
        company,
        policyNumber,
        policyHolder: policyHolder || undefined,
        nominee: nominee || undefined,
        insuranceType,
        sumAssuredRupees: sumAssuredRupees ? parseFloat(sumAssuredRupees) : 0,
        premiumAmountRupees: parseFloat(premiumAmountRupees),
        frequency,
        startDate: startDate || undefined,
        expiryDate,
        vehicleOrAsset: vehicleOrAsset || undefined,
        notes: notes || undefined,
      });
      setModalOpen(false);
      // Reset form
      setPolicyName('');
      setCompany('');
      setPolicyNumber('');
      setPolicyHolder('');
      setNominee('');
      setSumAssuredRupees('');
      setPremiumAmountRupees('');
      setVehicleOrAsset('');
      setNotes('');
      await fetchPolicies();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create insurance policy');
    } finally {
      setSaving(false);
    }
  };

  const handlePayPremium = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalPolicy) return;
    setSaving(true);
    try {
      await api.post('/expenses', {
        name: `Premium: ${payModalPolicy.policyName} (${payModalPolicy.company})`,
        category: 'Insurance',
        amountRupees: payModalPolicy.premiumAmount / 100,
        paymentMethod: payMode,
        paymentMethodAccountId: selectedAcc,
        description: `Policy #${payModalPolicy.policyNumber} premium renewal`,
        scope: payModalPolicy.scope,
      });
      alert(`Premium of ${formatINR(payModalPolicy.premiumAmount)} recorded successfully!`);
      setPayModalPolicy(null);
      await fetchPolicies();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record premium payment');
    } finally {
      setSaving(false);
    }
  };

  // Filter policies based on active global scope
  const filteredPolicies = policies.filter((p) => {
    if (scope === 'OVERALL') return true;
    return (p.scope || 'BUSINESS') === scope;
  });

  const totalAnnualPremium = filteredPolicies.reduce((acc, p) => acc + p.premiumAmount, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Insurance Portfolio</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {filteredPolicies.length} Policies
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Track health, life, vehicle, property, and shop insurance policies, premiums, and renewal dates
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] uppercase font-bold text-slate-400">Total Committed Premiums</span>
            <p className="text-base font-black text-indigo-600">{formatINR(totalAnnualPremium)}</p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Policy</span>
          </button>
        </div>
      </div>

      {/* Grid of Policies */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
            <span>Loading policies...</span>
          </div>
        ) : filteredPolicies.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 font-medium bg-white rounded-2xl border border-slate-200/80 p-8">
            <Shield className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-bold text-slate-700">No insurance policies found in this scope</p>
            <p className="text-xs text-slate-400 mt-1">Click "+ Add Policy" to manage your 14 policies across personal, family, and shop.</p>
          </div>
        ) : (
          filteredPolicies.map((p) => {
            const isDueSoon =
              new Date(p.expiryDate).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000;
            return (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    p.scope === 'PERSONAL'
                      ? 'bg-emerald-500'
                      : p.scope === 'FAMILY'
                      ? 'bg-purple-500'
                      : 'bg-brand-600'
                  }`}
                />

                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {p.insuranceType}
                      </span>
                      <h3 className="font-bold text-slate-800 text-base mt-0.5">{p.policyName}</h3>
                      <p className="text-xs font-semibold text-slate-600">{p.company}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        p.scope === 'PERSONAL'
                          ? 'bg-emerald-50 text-emerald-700'
                          : p.scope === 'FAMILY'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-brand-50 text-brand-700'
                      }`}
                    >
                      {p.scope}
                    </span>
                  </div>

                  <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Policy No:</span>
                      <span className="font-mono font-bold text-slate-800">{p.policyNumber}</span>
                    </div>
                    {p.policyHolder && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Insured Person:</span>
                        <span className="font-semibold text-slate-700">{p.policyHolder}</span>
                      </div>
                    )}
                    {p.nominee && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Nominee:</span>
                        <span className="font-medium text-slate-600">{p.nominee}</span>
                      </div>
                    )}
                    {p.sumAssured > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Sum Assured:</span>
                        <span className="font-bold text-emerald-700">{formatINR(p.sumAssured)}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Premium ({p.frequency})</span>
                      <p className="text-base font-black text-rose-600">{formatINR(p.premiumAmount)}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Next Renewal</span>
                      <p
                        className={`text-xs font-bold flex items-center justify-end ${
                          isDueSoon ? 'text-amber-600' : 'text-slate-700'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 mr-1" />
                        {new Date(p.expiryDate).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setPayModalPolicy(p)}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Pay Premium</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* CREATE POLICY MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">Add Insurance Policy</h3>
              <button onClick={() => setModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreatePolicy} className="p-6 space-y-3.5 overflow-y-auto flex-1">
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
                    <option value="BUSINESS">Business (SVE)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Policy Type *
                  </label>
                  <select
                    value={insuranceType}
                    onChange={(e) => setInsuranceType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="Health Insurance">Health Insurance (Mediclaim)</option>
                    <option value="Life Insurance">Life Insurance / LIC</option>
                    <option value="Vehicle Insurance">Vehicle Insurance (Bike/Car/Truck)</option>
                    <option value="Shop Insurance">Shop / Commercial Insurance</option>
                    <option value="Property Insurance">Property / Home Insurance</option>
                    <option value="Other">Other Insurance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Policy Name / Plan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Star Health Family Optima or LIC Jeevan Labh"
                  value={policyName}
                  onChange={(e) => setPolicyName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Company Provider *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. LIC, Star Health, HDFC Ergo"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Policy Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 129482910"
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Insured Person (Holder)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Self, Spouse, Child"
                    value={policyHolder}
                    onChange={(e) => setPolicyHolder(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Nominee Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Nominee Full Name"
                    value={nominee}
                    onChange={(e) => setNominee(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Premium Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 18500"
                    value={premiumAmountRupees}
                    onChange={(e) => setPremiumAmountRupees(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Payment Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="YEARLY">Yearly</option>
                    <option value="HALF_YEARLY">Half Yearly (6 Months)</option>
                    <option value="QUARTERLY">Quarterly (3 Months)</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="SINGLE">Single One-Time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Sum Assured / Cover (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 1000000"
                    value={sumAssuredRupees}
                    onChange={(e) => setSumAssuredRupees(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Renewal / Expiry Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Vehicle / Asset Ref (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. AP 04 AB 1234 or Shop Stock Cover"
                  value={vehicleOrAsset}
                  onChange={(e) => setVehicleOrAsset(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs disabled:opacity-50 shadow-md transition-all mt-2"
              >
                {saving ? 'Saving...' : 'Save Policy'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PAY PREMIUM MODAL */}
      {payModalPolicy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <div>
                <h3 className="font-bold text-base text-emerald-950">Record Premium Payment</h3>
                <p className="text-xs text-emerald-700 mt-0.5">{payModalPolicy.policyName}</p>
              </div>
              <button onClick={() => setPayModalPolicy(null)}>
                <X className="w-5 h-5 text-emerald-800" />
              </button>
            </div>
            <form onSubmit={handlePayPremium} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between font-semibold">
                <span className="text-slate-500">Premium Amount Due:</span>
                <span className="text-rose-600 font-bold">{formatINR(payModalPolicy.premiumAmount)}</span>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Pay From Account
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
                  Payment Mode
                </label>
                <select
                  value={payMode}
                  onChange={(e) => setPayMode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="BANK">Bank Transfer / NetBanking</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs disabled:opacity-50 shadow-md"
              >
                {saving ? 'Processing...' : 'Confirm Premium Payment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Insurance;
