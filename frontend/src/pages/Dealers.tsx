import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { Dealer } from '../types';
import { useSocket } from '../context/SocketContext';
import {
  Building2,
  Search,
  Plus,
  ArrowUpRight,
  Phone,
  CreditCard,
  RefreshCw,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';

const Dealers: React.FC = () => {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newDealerModal, setNewDealerModal] = useState(false);
  const [editModalDealer, setEditModalDealer] = useState<Dealer | null>(null);
  const [paymentModalDealer, setPaymentModalDealer] = useState<Dealer | null>(null);
  const [billModalDealer, setBillModalDealer] = useState<Dealer | null>(null);

  // Edit Dealer Form
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [editPendingRupees, setEditPendingRupees] = useState('');

  // New Dealer Form
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [initialDueAmount, setInitialDueAmount] = useState('');
  const [initialBillNo, setInitialBillNo] = useState('');
  const [initialDueDate, setInitialDueDate] = useState('');

  // Payment Form
  const [payAmount, setPayAmount] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAcc, setSelectedAcc] = useState('');
  const [payMode, setPayMode] = useState<'CASH' | 'BANK' | 'UPI'>('BANK');
  const [notes, setNotes] = useState('');

  // New Purchase Bill Form
  const [billNo, setBillNo] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDesc, setBillDesc] = useState('');
  const [billDueDate, setBillDueDate] = useState('');

  const [saving, setSaving] = useState(false);
  const { lastEvent } = useSocket();

  const fetchDealers = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const [dRes, aRes] = await Promise.all([api.get('/dealers'), api.get('/payment-accounts')]);
      const dealerList = Array.isArray(dRes.data) ? dRes.data : dRes.data?.dealers || [];
      const accList = Array.isArray(aRes.data) ? aRes.data : aRes.data?.accounts || [];
      setDealers(dealerList);
      setAccounts(accList);
      if (accList.length > 0) setSelectedAcc((prev) => prev || accList[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDealers();
  }, []);

  // Instant real-time auto sync across all devices
  useEffect(() => {
    if (lastEvent) {
      fetchDealers(true);
    }
  }, [lastEvent]);

  const handleCreateDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/dealers', {
        name,
        contactPerson,
        phone,
        email,
        gstin,
        bankDetails,
        initialPayableAmountRupees: initialDueAmount ? parseFloat(initialDueAmount) : 0,
        initialPayableInvoice: initialBillNo || undefined,
        dueDate: initialDueDate || undefined,
      });
      setNewDealerModal(false);
      setName('');
      setContactPerson('');
      setPhone('');
      setEmail('');
      setGstin('');
      setBankDetails('');
      setInitialDueAmount('');
      setInitialBillNo('');
      setInitialDueDate('');
      await fetchDealers();
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to create dealer');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (dealer: Dealer) => {
    setEditModalDealer(dealer);
    setEditName(dealer.name);
    setEditPhone(dealer.phone || '');
    setEditGstin(dealer.gstin || '');
    setEditPendingRupees((dealer.pendingBalance / 100).toString());
  };

  const handleUpdateDealer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalDealer) return;
    setSaving(true);
    try {
      await api.put(`/dealers/${editModalDealer.id}`, {
        name: editName,
        companyName: editName,
        phone: editPhone,
        mobile: editPhone,
        gstin: editGstin,
        pendingBalanceRupees: parseFloat(editPendingRupees) || 0,
      });
      setEditModalDealer(null);
      await fetchDealers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update dealer');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDealer = async (dealerId: string, dealerName: string) => {
    if (!window.confirm(`Are you sure you want to delete supplier "${dealerName}"? All associated payables will also be removed.`)) {
      return;
    }
    try {
      await api.delete(`/dealers/${dealerId}`);
      await fetchDealers();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete dealer');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalDealer) return;
    setSaving(true);

    try {
      await api.post(`/dealers/${paymentModalDealer.id}/payment`, {
        amountRupees: parseFloat(payAmount),
        paymentAccountId: selectedAcc,
        paymentMode: payMode,
        notes,
      });

      alert(`Payment of ₹${payAmount} to ${paymentModalDealer.name} recorded!`);
      setPaymentModalDealer(null);
      setPayAmount('');
      setNotes('');
      await fetchDealers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to record dealer payment');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billModalDealer) return;
    setSaving(true);

    try {
      await api.post(`/dealers/${billModalDealer.id}/payables`, {
        billNo,
        description: billDesc,
        totalAmountRupees: parseFloat(billAmount),
        dueDate: billDueDate,
      });
      setBillModalDealer(null);
      setBillNo('');
      setBillAmount('');
      setBillDesc('');
      setBillDueDate('');
      await fetchDealers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add dealer bill');
    } finally {
      setSaving(false);
    }
  };

  const filtered = dealers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search) ||
      (d.gstin && d.gstin.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Dealers & Payables</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Track suppliers you owe, record payments, and manage purchase bills
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setNewDealerModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Dealer</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search dealer by company name, contact, phone, GSTIN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Dealers List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
            <span>Loading dealers...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 font-medium bg-white rounded-2xl border border-slate-200/80">
            No dealers found. Click "+ Add Dealer" to add one.
          </div>
        ) : (
          filtered.map((dealer) => (
            <div
              key={dealer.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{dealer.name}</h3>
                    <div className="flex items-center text-xs text-slate-500 mt-1">
                      <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      <span>{dealer.phone}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        dealer.pendingBalance > 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {dealer.pendingBalance > 0 ? 'Payable' : 'Cleared'}
                    </span>
                    <button
                      onClick={() => openEditModal(dealer)}
                      title="Edit Dealer / Balance"
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDealer(dealer.id, dealer.name)}
                      title="Delete Dealer"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {dealer.gstin && (
                  <p className="text-[11px] font-mono text-slate-400 mt-2">GSTIN: {dealer.gstin}</p>
                )}

                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Total Billed</span>
                    <p className="text-xs font-bold text-slate-700">{formatINR(dealer.totalPayable)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-rose-600">Pending Payable</span>
                    <p className="text-sm font-black text-rose-600">{formatINR(dealer.pendingBalance)}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => openEditModal(dealer)}
                  className="py-2 px-2.5 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1"
                  title="Edit Supplier / Due Amount"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => setBillModalDealer(dealer)}
                  className="flex-1 py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  + Add Bill
                </button>
                <button
                  onClick={() => setPaymentModalDealer(dealer)}
                  className="flex-1 py-2 px-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>Pay Now</span>
                </button>
                <button
                  onClick={() => handleDeleteDealer(dealer.id, dealer.name)}
                  title="Delete Supplier"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE DEALER MODAL */}
      {newDealerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">Add New Dealer / Supplier</h3>
              <button onClick={() => setNewDealerModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateDealer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Supplier / Company Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. XYZ Auto Bearings Pvt Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Contact Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9845123456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="29AAAAA0000A1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Contact Person
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Suresh Rep"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Initial Opening Due / Payable Amount Section */}
              <div className="pt-2 border-t border-slate-200">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-rose-600 mb-2">
                  Opening Due / Pending Bill (Optional)
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Due Amount (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 50000"
                      value={initialDueAmount}
                      onChange={(e) => setInitialDueAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Payment Due Date
                    </label>
                    <input
                      type="date"
                      value={initialDueDate}
                      onChange={(e) => setInitialDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Bill / Invoice Reference # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. OPENING-BILL-101"
                    value={initialBillNo}
                    onChange={(e) => setInitialBillNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Dealer'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RECORD DEALER PAYMENT MODAL */}
      {paymentModalDealer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50">
              <div>
                <h3 className="font-bold text-base text-rose-950">Pay Dealer</h3>
                <p className="text-xs text-rose-700 mt-0.5">To: {paymentModalDealer.name}</p>
              </div>
              <button onClick={() => setPaymentModalDealer(null)}>
                <X className="w-5 h-5 text-rose-800" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between font-semibold">
                <span className="text-slate-500">Total Pending Bill:</span>
                <span className="text-rose-600 font-bold">{formatINR(paymentModalDealer.pendingBalance)}</span>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Amount to Pay (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 25000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Pay From Account
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
                  Notes / Reference / UTR
                </label>
                <input
                  type="text"
                  placeholder="e.g. NEFT UTR #982138 or Chq #44321"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Processing...' : 'Confirm Dealer Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE DEALER BILL MODAL */}
      {billModalDealer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-800">Add Purchase Bill / Credit</h3>
                <p className="text-xs text-slate-500 mt-0.5">From: {billModalDealer.name}</p>
              </div>
              <button onClick={() => setBillModalDealer(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateBill} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Purchase Bill / Invoice #
                </label>
                <input
                  type="text"
                  placeholder="e.g. BILL-98234"
                  value={billNo}
                  onChange={(e) => setBillNo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Bill Amount (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 50000"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Description / Items
                </label>
                <input
                  type="text"
                  placeholder="e.g. 50 Boxes Oil Filters & Gaskets"
                  value={billDesc}
                  onChange={(e) => setBillDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Payment Due Date
                </label>
                <input
                  type="date"
                  value={billDueDate}
                  onChange={(e) => setBillDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Creating...' : 'Add Bill to Payables'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DEALER MODAL */}
      {editModalDealer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">Edit Dealer & Due Balance</h3>
              <button onClick={() => setEditModalDealer(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleUpdateDealer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Supplier / Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={editGstin}
                  onChange={(e) => setEditGstin(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm uppercase font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-rose-700 mb-1">
                  Correct Due / Pending Payable (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={editPendingRupees}
                  onChange={(e) => setEditPendingRupees(e.target.value)}
                  placeholder="e.g. 55912"
                  className="w-full px-3 py-2 border border-rose-300 bg-rose-50/50 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter exact rupees here (e.g. 55912). This will immediately correct the pending balance.
                </p>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-all shadow-md"
              >
                {saving ? 'Updating...' : 'Save & Update Dealer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dealers;
