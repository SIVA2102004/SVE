import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { Customer } from '../types';
import {
  Users,
  Search,
  Plus,
  ArrowDownRight,
  Phone,
  FileText,
  Share2,
  RefreshCw,
  X,
  Printer,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newCustModal, setNewCustModal] = useState(false);
  const [paymentModalCust, setPaymentModalCust] = useState<Customer | null>(null);
  const [billModalCust, setBillModalCust] = useState<Customer | null>(null);

  // New Customer Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimitRupees, setCreditLimitRupees] = useState('50000');
  const [initialDueAmount, setInitialDueAmount] = useState('');
  const [initialInvoiceNo, setInitialInvoiceNo] = useState('');
  const [initialDueDate, setInitialDueDate] = useState('');

  // Payment Form
  const [payAmount, setPayAmount] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAcc, setSelectedAcc] = useState('');
  const [payMode, setPayMode] = useState<'CASH' | 'BANK' | 'UPI'>('CASH');
  const [notes, setNotes] = useState('');

  // New Bill Form
  const [billInvoiceNo, setBillInvoiceNo] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billDesc, setBillDesc] = useState('');
  const [billDueDate, setBillDueDate] = useState('');

  const [saving, setSaving] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const [cRes, aRes] = await Promise.all([api.get('/customers'), api.get('/payment-accounts')]);
      const custList = Array.isArray(cRes.data) ? cRes.data : cRes.data?.customers || [];
      const accList = Array.isArray(aRes.data) ? aRes.data : aRes.data?.accounts || [];
      setCustomers(custList);
      setAccounts(accList);
      if (accList.length > 0) setSelectedAcc(accList[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/customers', {
        name,
        phone,
        email,
        address,
        creditLimitRupees: parseFloat(creditLimitRupees) || 0,
        initialReceivableAmountRupees: initialDueAmount ? parseFloat(initialDueAmount) : 0,
        initialReceivableInvoice: initialInvoiceNo || undefined,
        dueDate: initialDueDate || undefined,
      });
      setNewCustModal(false);
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setInitialDueAmount('');
      setInitialInvoiceNo('');
      setInitialDueDate('');
      await fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalCust) return;
    setSaving(true);

    try {
      const res = await api.post(`/customers/${paymentModalCust.id}/payment`, {
        amountRupees: parseFloat(payAmount),
        paymentAccountId: selectedAcc,
        paymentMode: payMode,
        notes,
      });

      const updatedCust = res.data.customer;
      const receiptNo = res.data.transaction.transactionNo;

      // Ask to generate PDF or WhatsApp share
      if (confirm(`Payment of ₹${payAmount} recorded successfully!\nWould you like to download the payment receipt PDF?`)) {
        generateReceiptPDF(paymentModalCust.name, paymentModalCust.phone, payAmount, receiptNo, notes);
      }

      setPaymentModalCust(null);
      setPayAmount('');
      setNotes('');
      await fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to record customer payment');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billModalCust) return;
    setSaving(true);

    try {
      await api.post(`/customers/${billModalCust.id}/receivables`, {
        invoiceNo: billInvoiceNo,
        description: billDesc,
        totalAmountRupees: parseFloat(billAmount),
        dueDate: billDueDate,
      });
      setBillModalCust(null);
      setBillInvoiceNo('');
      setBillAmount('');
      setBillDesc('');
      setBillDueDate('');
      await fetchCustomers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add customer bill');
    } finally {
      setSaving(false);
    }
  };

  const generateReceiptPDF = (custName: string, custPhone: string, amt: string, txNo: string, remarks: string) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('SHOPFLOW RETAIL & FINANCE', 14, 20);
    doc.setFontSize(10);
    doc.text('Official Payment Receipt / Acknowledgement', 14, 28);
    doc.line(14, 32, 196, 32);

    autoTable(doc, {
      startY: 40,
      head: [['Field', 'Details']],
      body: [
        ['Receipt / Txn Number', txNo],
        ['Date', new Date().toLocaleDateString('en-IN')],
        ['Customer Name', custName],
        ['Phone Number', custPhone],
        ['Amount Received', `₹${parseFloat(amt).toLocaleString('en-IN')}`],
        ['Payment Method', payMode],
        ['Remarks / Purpose', remarks || 'Payment towards outstanding bill balance'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] },
    });

    doc.text('Thank you for your business!', 14, (doc as any).lastAutoTable.finalY + 20);
    doc.save(`Receipt_${txNo}.pdf`);
  };

  const openWhatsAppShare = (cust: Customer) => {
    const pending = (cust.pendingBalance / 100).toLocaleString('en-IN');
    const msg = `Dear ${cust.name}, this is a gentle reminder from ShopFlow that your outstanding balance is ₹${pending}. Please clear the due amount at your earliest convenience. Thank you!`;
    const cleanPhone = cust.phone.replace(/[^0-9]/g, '');
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) ||
      (c.address && c.address.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Customers & Receivables</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Track money customers owe your shop, record payments, and send WhatsApp reminders
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setNewCustModal(true)}
            className="flex items-center space-x-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer by name, mobile number, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* Customer List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
            <span>Loading customers...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 font-medium bg-white rounded-2xl border border-slate-200/80">
            No customers found. Click "+ Add Customer" to create one.
          </div>
        ) : (
          filtered.map((cust) => (
            <div
              key={cust.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{cust.name}</h3>
                    <div className="flex items-center text-xs text-slate-500 mt-1">
                      <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      <span>{cust.phone}</span>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      cust.pendingBalance > 0
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {cust.pendingBalance > 0 ? 'Pending' : 'Cleared'}
                  </span>
                </div>

                {cust.address && (
                  <p className="text-xs text-slate-400 mt-2 truncate">{cust.address}</p>
                )}

                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Total Billed</span>
                    <p className="text-xs font-bold text-slate-700">{formatINR(cust.totalReceivable)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-emerald-600">Pending Due</span>
                    <p className="text-sm font-black text-rose-600">{formatINR(cust.pendingBalance)}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setBillModalCust(cust)}
                  className="flex-1 py-2 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  + Add Bill
                </button>
                <button
                  onClick={() => setPaymentModalCust(cust)}
                  className="flex-1 py-2 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1"
                >
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  <span>Receive</span>
                </button>
                {cust.pendingBalance > 0 && (
                  <button
                    onClick={() => openWhatsAppShare(cust)}
                    title="Send WhatsApp payment reminder"
                    className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE CUSTOMER MODAL */}
      {newCustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">Add New Customer</h3>
              <button onClick={() => setNewCustModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Address / City (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Market Road, Shop #12"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Initial Opening Due / Receivable Section */}
              <div className="pt-2 border-t border-slate-200">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-700 mb-2">
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
                      placeholder="e.g. 25000"
                      value={initialDueAmount}
                      onChange={(e) => setInitialDueAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">
                      Expected Return Date
                    </label>
                    <input
                      type="date"
                      value={initialDueDate}
                      onChange={(e) => setInitialDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    Invoice / Bill # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. OLD-BILL-202"
                    value={initialInvoiceNo}
                    onChange={(e) => setInitialInvoiceNo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Customer'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RECORD CUSTOMER PAYMENT MODAL */}
      {paymentModalCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50">
              <div>
                <h3 className="font-bold text-base text-emerald-950">Receive Payment</h3>
                <p className="text-xs text-emerald-700 mt-0.5">From: {paymentModalCust.name}</p>
              </div>
              <button onClick={() => setPaymentModalCust(null)}>
                <X className="w-5 h-5 text-emerald-800" />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between font-semibold">
                <span className="text-slate-500">Current Due:</span>
                <span className="text-rose-600 font-bold">{formatINR(paymentModalCust.pendingBalance)}</span>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Amount Received (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 5000"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Received Into Account
                </label>
                <select
                  value={selectedAcc}
                  onChange={(e) => setSelectedAcc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notes / Bill Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cleared bill #104"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm disabled:opacity-50"
              >
                {saving ? 'Processing...' : 'Confirm Payment & Print Receipt'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW BILL MODAL */}
      {billModalCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-800">Add Customer Bill / Debit</h3>
                <p className="text-xs text-slate-500 mt-0.5">For: {billModalCust.name}</p>
              </div>
              <button onClick={() => setBillModalCust(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateBill} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Invoice / Bill No
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-089"
                  value={billInvoiceNo}
                  onChange={(e) => setBillInvoiceNo(e.target.value)}
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
                  placeholder="e.g. 15000"
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
                  placeholder="e.g. Spare bearings & lubricant batch"
                  value={billDesc}
                  onChange={(e) => setBillDesc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Due Date (Optional)
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
                {saving ? 'Creating...' : 'Add Bill to Receivables'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
