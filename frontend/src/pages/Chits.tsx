import React, { useEffect, useState, useMemo } from 'react';
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
  Clock,
  Search,
  Filter,
  Download,
  Edit2,
  Trash2,
  Eye,
  FileText,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  Upload,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart as PieChartIcon,
  BarChart3,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { ChitScheme, ChitInstallment, ChitAuction } from '../types';
import { downloadCSV, exportChitStatementPDF } from '../utils/chitExport';

const Chits: React.FC = () => {
  const { scope } = useScope();
  const { lastEvent } = useSocket();

  const [chits, setChits] = useState<ChitScheme[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterPrized, setFilterPrized] = useState<string>('ALL');
  const [filterCompany, setFilterCompany] = useState<string>('ALL');

  // Modals & Active Chit
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeChitDetail, setActiveChitDetail] = useState<ChitScheme | null>(null);
  const [activeTab, setActiveTab] = useState<'INSTALLMENTS' | 'AUCTIONS' | 'PRIZE' | 'SUMMARY'>('INSTALLMENTS');

  // Add / Edit Chit Form State
  const [editingChitId, setEditingChitId] = useState<string | null>(null);
  const [formScope, setFormScope] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [chitName, setChitName] = useState('');
  const [chitCompany, setChitCompany] = useState('');
  const [chitNumber, setChitNumber] = useState('');
  const [memberNumber, setMemberNumber] = useState('');
  const [totalValueRupees, setTotalValueRupees] = useState('');
  const [totalMembers, setTotalMembers] = useState('50');
  const [monthlyContributionRupees, setMonthlyContributionRupees] = useState('');
  const [totalMonths, setTotalMonths] = useState('50');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [dueDayOfMonth, setDueDayOfMonth] = useState('10');
  const [foremanCommissionPercent, setForemanCommissionPercent] = useState('5');
  const [chitStatus, setChitStatus] = useState('ACTIVE');
  const [notes, setNotes] = useState('');

  // Payment Modal State
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payingInstallment, setPayingInstallment] = useState<ChitInstallment | null>(null);
  const [payMonthNumber, setPayMonthNumber] = useState<number>(1);
  const [payAmountRupees, setPayAmountRupees] = useState('');
  const [payDividendRupees, setPayDividendRupees] = useState('0');
  const [payAccountId, setPayAccountId] = useState('');
  const [payMethod, setPayMethod] = useState<'BANK' | 'CASH' | 'UPI' | 'CHEQUE'>('UPI');
  const [upiRefId, setUpiRefId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Edit Installment Modal State
  const [editInstModalOpen, setEditInstModalOpen] = useState(false);
  const [editingInst, setEditingInst] = useState<ChitInstallment | null>(null);
  const [editAmountPaidRupees, setEditAmountPaidRupees] = useState('');
  const [editDividendRupees, setEditDividendRupees] = useState('');
  const [editStatus, setEditStatus] = useState<string>('PAID');
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('BANK');
  const [editUpiId, setEditUpiId] = useState('');

  // Auction Entry Modal State
  const [auctionModalOpen, setAuctionModalOpen] = useState(false);
  const [aucMonth, setAucMonth] = useState('1');
  const [aucDate, setAucDate] = useState(new Date().toISOString().split('T')[0]);
  const [aucBidDiscount, setAucBidDiscount] = useState('');
  const [aucWinnerTicket, setAucWinnerTicket] = useState('');
  const [aucCommission, setAucCommission] = useState('');
  const [aucOtherDeductions, setAucOtherDeductions] = useState('0');
  const [aucCustomDividendPerMember, setAucCustomDividendPerMember] = useState('');
  const [aucIsUserWon, setAucIsUserWon] = useState(false);
  const [aucNotes, setAucNotes] = useState('');

  // Chit Prize Money Modal State
  const [prizeModalOpen, setPrizeModalOpen] = useState(false);
  const [przWinningMonth, setPrzWinningMonth] = useState('1');
  const [przWinningDate, setPrzWinningDate] = useState(new Date().toISOString().split('T')[0]);
  const [przDiscountRupees, setPrzDiscountRupees] = useState('');
  const [przCommissionRupees, setPrzCommissionRupees] = useState('');
  const [przOtherDeductionsRupees, setPrzOtherDeductionsRupees] = useState('0');
  const [przReceivedRupees, setPrzReceivedRupees] = useState('');
  const [przReceivedDate, setPrzReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [przReference, setPrzReference] = useState('');
  const [przAccountId, setPrzAccountId] = useState('');
  const [przNotes, setPrzNotes] = useState('');

  // 1. Fetch All Chits
  const fetchChits = async () => {
    try {
      setLoading(true);
      const [cRes, aRes] = await Promise.all([
        api.get('/chits'),
        api.get('/payment-accounts'),
      ]);
      const list: ChitScheme[] = Array.isArray(cRes.data) ? cRes.data : cRes.data?.chits || [];
      const accs = Array.isArray(aRes.data) ? aRes.data : aRes.data?.accounts || [];
      setChits(list);
      setAccounts(accs);
      if (accs.length > 0 && !payAccountId) setPayAccountId(accs[0].id);

      // Refresh currently open chit details if any
      if (activeChitDetail) {
        const found = list.find((c) => c.id === activeChitDetail.id);
        if (found) setActiveChitDetail(found);
      }
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

  // Handle auto-calc of monthly installment in create form
  useEffect(() => {
    const val = parseFloat(totalValueRupees);
    const mem = parseInt(totalMembers);
    if (!isNaN(val) && !isNaN(mem) && mem > 0 && !monthlyContributionRupees) {
      setMonthlyContributionRupees((val / mem).toFixed(0));
    }
  }, [totalValueRupees, totalMembers]);

  // Filtered Chits list
  const filteredChits = useMemo(() => {
    return chits.filter((c) => {
      // Scope match
      if (scope !== 'OVERALL' && (c.scope || 'PERSONAL') !== scope) return false;

      // Status match
      if (filterStatus !== 'ALL' && c.status !== filterStatus) return false;

      // Prized match
      if (filterPrized === 'PRIZED' && !c.isPrized) return false;
      if (filterPrized === 'NON_PRIZED' && c.isPrized) return false;

      // Company match
      if (filterCompany !== 'ALL' && c.chitCompany !== filterCompany) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = c.chitName.toLowerCase().includes(q);
        const compMatch = c.chitCompany.toLowerCase().includes(q);
        const numMatch = (c.chitNumber || '').toLowerCase().includes(q);
        const memMatch = (c.memberNumber || '').toLowerCase().includes(q);
        if (!nameMatch && !compMatch && !numMatch && !memMatch) return false;
      }

      return true;
    });
  }, [chits, scope, filterStatus, filterPrized, filterCompany, searchQuery]);

  // Unique organizers for filter dropdown
  const companiesList = useMemo(() => {
    const set = new Set<string>();
    chits.forEach((c) => {
      if (c.chitCompany) set.add(c.chitCompany);
    });
    return Array.from(set);
  }, [chits]);

  // Dashboard Aggregates
  const stats = useMemo(() => {
    let totalChitValue = 0;
    let totalPaid = 0;
    let totalDividends = 0;
    let totalPrizeReceived = 0;
    let pendingInstalmentsCount = 0;
    let activeChitsCount = 0;
    let totalExpectedToDate = 0;

    filteredChits.forEach((c) => {
      totalChitValue += c.totalValue;
      if (c.status === 'ACTIVE') activeChitsCount++;

      if (c.isPrized) {
        totalPrizeReceived += c.prizeReceivedAmount || c.prizedAmount || 0;
      }

      const insts = c.installments || [];
      insts.forEach((inst) => {
        totalPaid += inst.amountPaid || 0;
        totalDividends += inst.dividendEarned || 0;

        const netDue = inst.netInstalment ?? (inst.amountExpected - inst.dividendEarned);
        if (inst.status !== 'PAID') {
          pendingInstalmentsCount++;
        }
        totalExpectedToDate += netDue;
      });
    });

    const netCashFlow = totalPrizeReceived - totalPaid;

    return {
      totalChitValue,
      totalPaid,
      totalDividends,
      totalPrizeReceived,
      pendingInstalmentsCount,
      activeChitsCount,
      netCashFlow,
      totalExpectedToDate,
    };
  }, [filteredChits]);

  // Open Create Chit Modal
  const openCreateModal = () => {
    setEditingChitId(null);
    setFormScope(scope === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL');
    setChitName('');
    setChitCompany('');
    setChitNumber('');
    setMemberNumber('');
    setTotalValueRupees('');
    setTotalMembers('50');
    setMonthlyContributionRupees('');
    setTotalMonths('50');
    setStartDate(new Date().toISOString().split('T')[0]);
    setEndDate('');
    setDueDayOfMonth('10');
    setForemanCommissionPercent('5');
    setChitStatus('ACTIVE');
    setNotes('');
    setCreateModalOpen(true);
  };

  // Open Edit Chit Modal
  const openEditModal = (chit: ChitScheme) => {
    setEditingChitId(chit.id);
    setFormScope((chit.scope as any) || 'PERSONAL');
    setChitName(chit.chitName);
    setChitCompany(chit.chitCompany);
    setChitNumber(chit.chitNumber || '');
    setMemberNumber(chit.memberNumber || '');
    setTotalValueRupees((chit.totalValue / 100).toString());
    setTotalMembers(chit.totalMembers.toString());
    setMonthlyContributionRupees((chit.monthlyContribution / 100).toString());
    setTotalMonths(chit.totalMonths.toString());
    setStartDate(chit.startDate ? chit.startDate.split('T')[0] : '');
    setEndDate(chit.endDate ? chit.endDate.split('T')[0] : '');
    setDueDayOfMonth(chit.dueDayOfMonth.toString());
    setForemanCommissionPercent((chit.foremanCommissionPercent || 5).toString());
    setChitStatus(chit.status || 'ACTIVE');
    setNotes(chit.notes || '');
    setCreateModalOpen(true);
  };

  // Submit Create or Edit Chit
  const handleSaveChit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        scope: formScope,
        chitName,
        chitCompany,
        chitNumber: chitNumber || undefined,
        memberNumber: memberNumber || undefined,
        totalValueRupees: parseFloat(totalValueRupees),
        totalMembers: parseInt(totalMembers),
        monthlyContributionRupees: parseFloat(monthlyContributionRupees),
        totalMonths: parseInt(totalMonths),
        startDate: startDate || new Date().toISOString(),
        endDate: endDate || undefined,
        dueDayOfMonth: parseInt(dueDayOfMonth),
        foremanCommissionPercent: parseFloat(foremanCommissionPercent),
        status: chitStatus,
        notes: notes || undefined,
      };

      if (editingChitId) {
        await api.put(`/chits/${editingChitId}`, payload);
      } else {
        await api.post('/chits', payload);
      }

      setCreateModalOpen(false);
      await fetchChits();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save chit scheme');
    } finally {
      setSaving(false);
    }
  };

  // Delete Chit Scheme
  const handleDeleteChit = async (chitId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? All installments and auction data will be deleted.`)) {
      return;
    }
    try {
      await api.delete(`/chits/${chitId}`);
      if (activeChitDetail?.id === chitId) setActiveChitDetail(null);
      await fetchChits();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete chit scheme');
    }
  };

  // Open Payment Modal for an Installment
  const openPayModal = (chit: ChitScheme, inst?: ChitInstallment) => {
    setActiveChitDetail(chit);
    const month = inst ? inst.monthNumber : chit.currentMonth;
    setPayMonthNumber(month);

    const origDue = inst ? inst.amountExpected : chit.monthlyContribution;
    const div = inst ? inst.dividendEarned : 0;
    const netDue = (origDue - div) / 100;
    const alreadyPaid = inst ? inst.amountPaid / 100 : 0;
    const outstanding = Math.max(0, netDue - alreadyPaid);

    setPayingInstallment(inst || null);
    setPayAmountRupees(outstanding > 0 ? outstanding.toString() : (chit.monthlyContribution / 100).toString());
    setPayDividendRupees((div / 100).toString());
    setPayMethod('UPI');
    setUpiRefId('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentNotes('');
    setReceiptFile(null);
    setPayModalOpen(true);
  };

  // Submit Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChitDetail) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('monthNumber', payMonthNumber.toString());
      formData.append('amountRupees', payAmountRupees);
      formData.append('dividendRupees', payDividendRupees || '0');
      formData.append('paymentMethod', payMethod);
      if (payAccountId) formData.append('paymentAccountId', payAccountId);
      if (upiRefId) formData.append('upiTransactionId', upiRefId);
      if (paymentDate) formData.append('paidDate', paymentDate);
      if (paymentNotes) formData.append('notes', paymentNotes);
      if (receiptFile) formData.append('file', receiptFile);

      const res = await api.post(`/chits/${activeChitDetail.id}/pay`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setPayModalOpen(false);
      if (res.data?.chit) setActiveChitDetail(res.data.chit);
      await fetchChits();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  // Open Edit Installment Modal
  const openEditInstModal = (inst: ChitInstallment) => {
    setEditingInst(inst);
    setEditAmountPaidRupees((inst.amountPaid / 100).toString());
    setEditDividendRupees((inst.dividendEarned / 100).toString());
    setEditStatus(inst.status);
    setEditPaymentMethod(inst.paymentMethod || 'BANK');
    setEditUpiId(inst.upiTransactionId || '');
    setEditInstModalOpen(true);
  };

  // Submit Edit Installment
  const handleUpdateInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInst || !activeChitDetail) return;
    setSaving(true);
    try {
      const res = await api.put(`/chits/installments/${editingInst.id}`, {
        amountPaidRupees: parseFloat(editAmountPaidRupees) || 0,
        dividendRupees: parseFloat(editDividendRupees) || 0,
        status: editStatus,
        paymentMethod: editPaymentMethod,
        upiTransactionId: editUpiId || undefined,
      });

      setEditInstModalOpen(false);
      if (res.data?.chit) setActiveChitDetail(res.data.chit);
      await fetchChits();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update installment');
    } finally {
      setSaving(false);
    }
  };

  // Revert/Delete Payment
  const handleRevertPayment = async (inst: ChitInstallment) => {
    if (!window.confirm(`Are you sure you want to revert payment of ₹${(inst.amountPaid / 100).toLocaleString('en-IN')} for Month ${inst.monthNumber}? This will restore account balance and reset status to PENDING.`)) {
      return;
    }
    setSaving(true);
    try {
      const res = await api.delete(`/chits/installments/${inst.id}/payment`);
      if (res.data?.chit) setActiveChitDetail(res.data.chit);
      await fetchChits();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to revert payment');
    } finally {
      setSaving(false);
    }
  };

  // Open Auction Entry Modal
  const openAuctionModal = (month?: number) => {
    if (!activeChitDetail) return;
    const m = month || activeChitDetail.currentMonth;
    setAucMonth(m.toString());
    setAucDate(new Date().toISOString().split('T')[0]);

    // Check existing auction for this month
    const existing = activeChitDetail.auctions?.find((a) => a.auctionMonth === m);
    if (existing) {
      setAucBidDiscount((existing.bidDiscountAmount / 100).toString());
      setAucWinnerTicket(existing.winningMemberNumber || '');
      setAucCommission((existing.foremanCommissionAmount / 100).toString());
      setAucOtherDeductions((existing.otherDeductionsAmount / 100).toString());
      setAucCustomDividendPerMember((existing.dividendPerMember / 100).toString());
      setAucIsUserWon(existing.isUserWon);
      setAucNotes(existing.notes || '');
    } else {
      setAucBidDiscount('');
      setAucWinnerTicket('');
      const defaultComm = Math.round(activeChitDetail.totalValue * ((activeChitDetail.foremanCommissionPercent || 5) / 100)) / 100;
      setAucCommission(defaultComm.toString());
      setAucOtherDeductions('0');
      setAucCustomDividendPerMember('');
      setAucIsUserWon(false);
      setAucNotes('');
    }
    setAuctionModalOpen(true);
  };

  // Auto calculate dividend per member preview in auction modal
  const computedAuctionPreview = useMemo(() => {
    if (!activeChitDetail) return { pool: 0, perMember: 0 };
    const discount = parseFloat(aucBidDiscount) || 0;
    const comm = parseFloat(aucCommission) || 0;
    const deductions = parseFloat(aucOtherDeductions) || 0;
    const pool = Math.max(0, discount - comm - deductions);
    const members = activeChitDetail.totalMembers || 50;
    const perMember = members > 0 ? Math.round(pool / members) : 0;
    return { pool, perMember };
  }, [activeChitDetail, aucBidDiscount, aucCommission, aucOtherDeductions]);

  // Submit Auction Entry
  const handleSaveAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChitDetail) return;
    setSaving(true);
    try {
      const res = await api.post(`/chits/${activeChitDetail.id}/auctions`, {
        auctionMonth: parseInt(aucMonth),
        auctionDate: aucDate,
        bidDiscountRupees: parseFloat(aucBidDiscount),
        winningMemberNumber: aucWinnerTicket || undefined,
        foremanCommissionRupees: parseFloat(aucCommission),
        otherDeductionsRupees: parseFloat(aucOtherDeductions) || 0,
        customDividendPerMemberRupees: aucCustomDividendPerMember ? parseFloat(aucCustomDividendPerMember) : undefined,
        isUserWon: aucIsUserWon,
        notes: aucNotes || undefined,
      });

      setAuctionModalOpen(false);
      if (res.data?.chit) setActiveChitDetail(res.data.chit);
      await fetchChits();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save auction');
    } finally {
      setSaving(false);
    }
  };

  // Open Prize Money Modal
  const openPrizeModal = () => {
    if (!activeChitDetail) return;
    setPrzWinningMonth(activeChitDetail.prizedMonth?.toString() || activeChitDetail.currentMonth.toString());
    setPrzWinningDate(activeChitDetail.winningDate ? activeChitDetail.winningDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setPrzDiscountRupees(activeChitDetail.auctionDiscount ? (activeChitDetail.auctionDiscount / 100).toString() : '');
    setPrzCommissionRupees(
      activeChitDetail.foremanCommissionAmount
        ? (activeChitDetail.foremanCommissionAmount / 100).toString()
        : ((activeChitDetail.totalValue * ((activeChitDetail.foremanCommissionPercent || 5) / 100)) / 100).toString()
    );
    setPrzOtherDeductionsRupees(activeChitDetail.otherDeductionsAmount ? (activeChitDetail.otherDeductionsAmount / 100).toString() : '0');
    setPrzReceivedRupees(activeChitDetail.prizeReceivedAmount ? (activeChitDetail.prizeReceivedAmount / 100).toString() : '');
    setPrzReceivedDate(activeChitDetail.prizeReceivedDate ? activeChitDetail.prizeReceivedDate.split('T')[0] : new Date().toISOString().split('T')[0]);
    setPrzReference(activeChitDetail.prizePaymentReference || '');
    setPrzAccountId(accounts[0]?.id || '');
    setPrzNotes('');
    setPrizeModalOpen(true);
  };

  // Computed Prize Preview
  const computedPrizePreview = useMemo(() => {
    if (!activeChitDetail) return { gross: 0, net: 0 };
    const totalVal = activeChitDetail.totalValue / 100;
    const discount = parseFloat(przDiscountRupees) || 0;
    const comm = parseFloat(przCommissionRupees) || 0;
    const ded = parseFloat(przOtherDeductionsRupees) || 0;
    const gross = Math.max(0, totalVal - discount);
    const net = Math.max(0, gross - comm - ded);
    return { gross, net };
  }, [activeChitDetail, przDiscountRupees, przCommissionRupees, przOtherDeductionsRupees]);

  // Submit Prize Record
  const handleSavePrize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChitDetail) return;
    setSaving(true);
    try {
      const res = await api.post(`/chits/${activeChitDetail.id}/prize`, {
        winningMonth: parseInt(przWinningMonth),
        winningDate: przWinningDate,
        auctionDiscountRupees: parseFloat(przDiscountRupees),
        foremanCommissionRupees: parseFloat(przCommissionRupees),
        otherDeductionsRupees: parseFloat(przOtherDeductionsRupees) || 0,
        actualAmountReceivedRupees: przReceivedRupees ? parseFloat(przReceivedRupees) : undefined,
        amountReceivedDate: przReceivedDate,
        paymentReference: przReference || undefined,
        paymentAccountId: przAccountId || undefined,
        notes: przNotes || undefined,
      });

      setPrizeModalOpen(false);
      if (res.data?.chit) setActiveChitDetail(res.data.chit);
      await fetchChits();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record prize details');
    } finally {
      setSaving(false);
    }
  };

  // Detailed Summary for Active Chit
  const activeChitStats = useMemo(() => {
    if (!activeChitDetail) return null;
    const insts = activeChitDetail.installments || [];
    const totalMonths = activeChitDetail.totalMonths;

    let totalPaidPaise = 0;
    let totalDividendsPaise = 0;
    let totalNetExpectedPaise = 0;
    let paidCount = 0;

    insts.forEach((i) => {
      totalPaidPaise += i.amountPaid || 0;
      totalDividendsPaise += i.dividendEarned || 0;
      const net = i.netInstalment ?? (i.amountExpected - i.dividendEarned);
      totalNetExpectedPaise += net;
      if (i.status === 'PAID') paidCount++;
    });

    const totalPrizePaise = activeChitDetail.isPrized
      ? (activeChitDetail.prizeReceivedAmount || activeChitDetail.prizedAmount || 0)
      : 0;

    const netCashFlowPaise = totalPrizePaise - totalPaidPaise;
    const outstandingPaise = Math.max(0, totalNetExpectedPaise - totalPaidPaise);
    const remainingMonths = Math.max(0, totalMonths - paidCount);

    // Projected future liability (assuming average net instalment for remaining months)
    const avgNetInstalment = insts.length > 0 ? totalNetExpectedPaise / insts.length : activeChitDetail.monthlyContribution;
    const projectedFutureLiabilities = remainingMonths * avgNetInstalment;

    return {
      totalPaidPaise,
      totalDividendsPaise,
      totalPrizePaise,
      netCashFlowPaise,
      outstandingPaise,
      remainingMonths,
      paidCount,
      projectedFutureLiabilities,
    };
  }, [activeChitDetail]);

  // Chart Data: Paid vs Dividends by Month for Active Chit
  const activeChitChartData = useMemo(() => {
    if (!activeChitDetail) return [];
    return (activeChitDetail.installments || []).map((i) => ({
      month: `M${i.monthNumber}`,
      paid: (i.amountPaid || 0) / 100,
      dividend: (i.dividendEarned || 0) / 100,
      expected: (i.netInstalment ?? (i.amountExpected - i.dividendEarned)) / 100,
    }));
  }, [activeChitDetail]);

  // Export CSV for an individual chit
  const handleExportChitCSV = (chit: ChitScheme) => {
    const headers = ['Month', 'Due Date', 'Original Instalment', 'Dividend Earned', 'Net Instalment', 'Amount Paid', 'Paid Date', 'Payment Mode', 'Status', 'Notes'];
    const rows = (chit.installments || []).map((i) => [
      `Month ${i.monthNumber}`,
      new Date(i.dueDate).toLocaleDateString('en-IN'),
      (i.amountExpected / 100).toFixed(2),
      (i.dividendEarned / 100).toFixed(2),
      ((i.netInstalment ?? (i.amountExpected - i.dividendEarned)) / 100).toFixed(2),
      ((i.amountPaid || 0) / 100).toFixed(2),
      i.paidDate ? new Date(i.paidDate).toLocaleDateString('en-IN') : '',
      i.paymentMethod || '',
      i.status,
      i.notes || '',
    ]);

    downloadCSV(`${chit.chitName.replace(/\s+/g, '_')}_Statement.csv`, headers, rows);
  };

  // Export All Chits Financial Summary CSV
  const handleExportAllChitsCSV = () => {
    const headers = ['Chit Name', 'Company', 'Ticket/Member #', 'Total Value', 'Members', 'Duration (M)', 'Amount Paid', 'Dividends Received', 'Prize Money Received', 'Net Cash Flow', 'Status'];
    const rows = filteredChits.map((c) => {
      const insts = c.installments || [];
      const paid = insts.reduce((acc, i) => acc + (i.amountPaid || 0), 0) / 100;
      const divs = insts.reduce((acc, i) => acc + (i.dividendEarned || 0), 0) / 100;
      const prize = (c.prizeReceivedAmount || c.prizedAmount || 0) / 100;
      const netFlow = prize - paid;

      return [
        c.chitName,
        c.chitCompany,
        c.memberNumber || c.chitNumber || '',
        (c.totalValue / 100).toFixed(2),
        c.totalMembers,
        c.totalMonths,
        paid.toFixed(2),
        divs.toFixed(2),
        prize.toFixed(2),
        netFlow.toFixed(2),
        c.status,
      ];
    });

    downloadCSV('Chit_Fund_Complete_Financial_Summary.csv', headers, rows);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Chit Funds & Member Manager</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              {filteredChits.length} Memberships
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Personal chit memberships, monthly instalment calculations, auctions & dividends, prize payout tracking, and complete cash flow analysis
          </p>
        </div>

        <div className="flex items-center space-x-2.5 flex-wrap">
          <button
            onClick={handleExportAllChitsCSV}
            className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
            title="Export complete financial summary CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Summary CSV</span>
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Chit Membership</span>
          </button>
        </div>
      </div>

      {/* 2. Top Summary Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Active Chits</span>
          <p className="text-xl font-black text-slate-800 mt-1">{stats.activeChitsCount}</p>
          <span className="text-[10px] text-slate-400 font-medium">{filteredChits.length} total enrolled</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Chit Value</span>
          <p className="text-xl font-black text-slate-900 mt-1">{formatINR(stats.totalChitValue)}</p>
          <span className="text-[10px] text-slate-400 font-medium">Committed capital</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Paid</span>
          <p className="text-xl font-black text-rose-600 mt-1">{formatINR(stats.totalPaid)}</p>
          <span className="text-[10px] text-slate-400 font-medium">Actual cash deposited</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Dividend Earned</span>
          <p className="text-xl font-black text-emerald-600 mt-1">{formatINR(stats.totalDividends)}</p>
          <span className="text-[10px] text-slate-400 font-medium">Saved via auction pools</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Prize Received</span>
          <p className="text-xl font-black text-amber-600 mt-1">{formatINR(stats.totalPrizeReceived)}</p>
          <span className="text-[10px] text-slate-400 font-medium">Won & lifted payouts</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Pending Dues</span>
          <p className="text-xl font-black text-amber-500 mt-1">{stats.pendingInstalmentsCount}</p>
          <span className="text-[10px] text-slate-400 font-medium">Unpaid monthly slots</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-400">Net Cash Flow</span>
          <p className={`text-xl font-black mt-1 ${stats.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatINR(stats.netCashFlow)}
          </p>
          <span className="text-[10px] text-slate-400 font-medium">Prize - Total Paid</span>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by chit name, company, ticket/member #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 font-medium"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto flex-wrap">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <select
            value={filterPrized}
            onChange={(e) => setFilterPrized(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 bg-white"
          >
            <option value="ALL">All Payouts</option>
            <option value="PRIZED">Prized (Won)</option>
            <option value="NON_PRIZED">Non-Prized (Running)</option>
          </select>

          {companiesList.length > 0 && (
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="ALL">All Organizers</option>
              {companiesList.map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          )}

          {(searchQuery || filterStatus !== 'ALL' || filterPrized !== 'ALL' || filterCompany !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('ALL');
                setFilterPrized('ALL');
                setFilterCompany('ALL');
              }}
              className="px-2 py-1 text-xs text-rose-600 hover:text-rose-700 font-semibold"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 4. Grid of Chit Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
            <span>Loading chit fund memberships...</span>
          </div>
        ) : filteredChits.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 font-medium bg-white rounded-2xl border border-slate-200/80 p-8">
            <Coins className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-base font-bold text-slate-700">No chit schemes match your criteria</p>
            <p className="text-xs text-slate-400 mt-1">Click "+ Add Chit Membership" to start tracking your chit passbooks.</p>
          </div>
        ) : (
          filteredChits.map((c) => {
            const insts = c.installments || [];
            const paidSum = insts.reduce((acc, i) => acc + (i.amountPaid || 0), 0);
            const divSum = insts.reduce((acc, i) => acc + (i.dividendEarned || 0), 0);
            const paidCount = insts.filter((i) => i.status === 'PAID').length;
            const progressPercent = Math.min(100, Math.round((c.currentMonth / c.totalMonths) * 100));

            return (
              <div
                key={c.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 right-0 h-1.5 ${
                    c.isPrized ? 'bg-amber-500' : c.scope === 'BUSINESS' ? 'bg-brand-600' : 'bg-emerald-500'
                  }`}
                />

                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {c.chitCompany}
                      </span>
                      <h3 className="font-bold text-slate-800 text-base mt-0.5">{c.chitName}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        {c.memberNumber && (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-mono font-bold text-slate-600">
                            Ticket: {c.memberNumber}
                          </span>
                        )}
                        {c.chitNumber && (
                          <span className="text-[10px] font-mono text-slate-400">Ref #{c.chitNumber}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700'
                            : c.status === 'COMPLETED'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {c.status}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {c.totalMembers} Members
                      </span>
                    </div>
                  </div>

                  {/* Key Metrics Box */}
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
                      <span className="text-slate-500">Actual Money Paid:</span>
                      <span className="font-bold text-slate-800">{formatINR(paidSum)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Dividends Saved:</span>
                      <span className="font-bold text-emerald-600">{formatINR(divSum)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500">Progress:</span>
                      <span className="font-semibold text-slate-700">
                        Month {c.currentMonth} of {c.totalMonths} ({paidCount} Paid)
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                      <div className="bg-brand-600 h-full rounded-full" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>

                  {/* Prize Status Alert */}
                  {c.isPrized ? (
                    <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-xs text-amber-900">
                      <div className="flex items-center space-x-2">
                        <Award className="w-4 h-4 text-amber-600 shrink-0" />
                        <div>
                          <p className="font-bold">Prize Lifted: {formatINR(c.prizeReceivedAmount || c.prizedAmount || 0)}</p>
                          <span className="text-[10px] text-amber-700">Won Month {c.prizedMonth || 1} • Instalments continue</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-2 bg-slate-100 rounded-xl flex items-center space-x-1.5 text-xs text-slate-600 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Non-Prized Chit • Eligible for next auction</span>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setActiveChitDetail(c);
                      setActiveTab('INSTALLMENTS');
                    }}
                    className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-sm"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Passbook</span>
                  </button>

                  <button
                    onClick={() => openPayModal(c)}
                    className="py-2 px-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1 shadow-sm"
                    title="Pay Monthly Instalment"
                  >
                    <Coins className="w-3.5 h-3.5" />
                    <span>Pay</span>
                  </button>

                  <button
                    onClick={() => openEditModal(c)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Edit Chit Details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteChit(c.id, c.chitName)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    title="Delete Chit"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. COMPLETE CHIT DETAIL DRAWER / MODAL */}
      {activeChitDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-navy-950/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-400 text-slate-900">
                    {activeChitDetail.chitCompany}
                  </span>
                  <h3 className="font-black text-lg text-white">{activeChitDetail.chitName}</h3>
                  {activeChitDetail.memberNumber && (
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-xs font-mono text-amber-300">
                      Ticket #{activeChitDetail.memberNumber}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Total Value: {formatINR(activeChitDetail.totalValue)} • Original Instalment:{' '}
                  {formatINR(activeChitDetail.monthlyContribution)} • {activeChitDetail.totalMembers} Members •{' '}
                  {activeChitDetail.totalMonths} Months
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => exportChitStatementPDF(activeChitDetail)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                  title="Export PDF Statement"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF Statement</span>
                </button>
                <button
                  onClick={() => handleExportChitCSV(activeChitDetail)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold"
                  title="Export CSV"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => setActiveChitDetail(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex items-center space-x-1 px-5 pt-3 border-b border-slate-200 bg-slate-50 text-xs font-bold">
              <button
                onClick={() => setActiveTab('INSTALLMENTS')}
                className={`px-4 py-2.5 border-b-2 transition-all flex items-center space-x-1.5 ${
                  activeTab === 'INSTALLMENTS'
                    ? 'border-brand-600 text-brand-600 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Monthly Instalments ({activeChitDetail.installments?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('AUCTIONS')}
                className={`px-4 py-2.5 border-b-2 transition-all flex items-center space-x-1.5 ${
                  activeTab === 'AUCTIONS'
                    ? 'border-brand-600 text-brand-600 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Auctions & Dividends ({activeChitDetail.auctions?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('PRIZE')}
                className={`px-4 py-2.5 border-b-2 transition-all flex items-center space-x-1.5 ${
                  activeTab === 'PRIZE'
                    ? 'border-brand-600 text-brand-600 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Prize Money / Winning Details</span>
              </button>

              <button
                onClick={() => setActiveTab('SUMMARY')}
                className={`px-4 py-2.5 border-b-2 transition-all flex items-center space-x-1.5 ${
                  activeTab === 'SUMMARY'
                    ? 'border-brand-600 text-brand-600 bg-white rounded-t-lg'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Financial Summary & Cash Flow</span>
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* TAB 1: MONTHLY INSTALMENTS */}
              {activeTab === 'INSTALLMENTS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Monthly Instalment Schedule</h4>
                      <p className="text-xs text-slate-400">
                        Net Instalment = Original Instalment - Dividend Per Member. Payment must be recorded explicitly.
                      </p>
                    </div>
                    <button
                      onClick={() => openPayModal(activeChitDetail)}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Record Payment</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="py-2.5 px-3">Month</th>
                          <th className="py-2.5 px-3">Due Date</th>
                          <th className="py-2.5 px-3 text-right">Original (₹)</th>
                          <th className="py-2.5 px-3 text-right">Dividend (₹)</th>
                          <th className="py-2.5 px-3 text-right">Net Due (₹)</th>
                          <th className="py-2.5 px-3 text-right">Paid (₹)</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Paid Date / Mode</th>
                          <th className="py-2.5 px-3 text-center">Receipt</th>
                          <th className="py-2.5 px-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(activeChitDetail.installments || []).map((inst) => {
                          const original = inst.amountExpected / 100;
                          const div = inst.dividendEarned / 100;
                          const net = (inst.netInstalment ?? (inst.amountExpected - inst.dividendEarned)) / 100;
                          const paid = inst.amountPaid / 100;
                          const outstanding = Math.max(0, net - paid);

                          return (
                            <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 font-bold text-slate-800">Month {inst.monthNumber}</td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {new Date(inst.dueDate).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                                {original.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-emerald-600">
                                {div > 0 ? `-${div.toLocaleString('en-IN')}` : '₹0'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                {net.toLocaleString('en-IN')}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-amber-600">
                                {paid > 0 ? paid.toLocaleString('en-IN') : '-'}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    inst.status === 'PAID'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : inst.status === 'PARTIALLY_PAID'
                                      ? 'bg-amber-50 text-amber-700'
                                      : inst.status === 'OVERDUE'
                                      ? 'bg-rose-50 text-rose-700'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {inst.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {inst.paidDate ? (
                                  <div>
                                    <span className="font-medium">
                                      {new Date(inst.paidDate).toLocaleDateString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                      })}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block font-mono">
                                      {inst.paymentMethod} {inst.upiTransactionId ? `(${inst.upiTransactionId})` : ''}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {inst.receiptUrl ? (
                                  <a
                                    href={inst.receiptUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded bg-brand-50 text-brand-600 hover:text-brand-800 text-[10px] font-bold inline-flex items-center space-x-0.5"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>View</span>
                                  </a>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center space-x-1.5">
                                  {inst.status !== 'PAID' && (
                                    <button
                                      onClick={() => openPayModal(activeChitDetail, inst)}
                                      className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold"
                                    >
                                      Pay
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openEditInstModal(inst)}
                                    className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                    title="Edit payment details"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  {inst.amountPaid > 0 && (
                                    <button
                                      onClick={() => handleRevertPayment(inst)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                      title="Revert payment"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: AUCTION & DIVIDEND CALCULATOR */}
              {activeTab === 'AUCTIONS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Monthly Auction & Dividend Tracker</h4>
                      <p className="text-xs text-slate-400">
                        Formula: Dividend Pool = Winning Bid Discount - Foreman Commission - Deductions • Dividend Per Member = Pool / Total Members
                      </p>
                    </div>
                    <button
                      onClick={() => openAuctionModal()}
                      className="px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Record Monthly Auction</span>
                    </button>
                  </div>

                  {(!activeChitDetail.auctions || activeChitDetail.auctions.length === 0) ? (
                    <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Layers className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-bold text-slate-700 text-sm">No auctions recorded yet</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Add the monthly winning bid to automatically calculate and apply member dividends.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold">
                          <tr>
                            <th className="py-2.5 px-3">Month</th>
                            <th className="py-2.5 px-3">Auction Date</th>
                            <th className="py-2.5 px-3 text-right">Winning Bid Discount</th>
                            <th className="py-2.5 px-3">Winner Member #</th>
                            <th className="py-2.5 px-3 text-right">Foreman Commission</th>
                            <th className="py-2.5 px-3 text-right">Deductions</th>
                            <th className="py-2.5 px-3 text-right">Net Dividend Pool</th>
                            <th className="py-2.5 px-3 text-right">Dividend Per Member</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeChitDetail.auctions.map((auc) => (
                            <tr key={auc.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-bold text-slate-800">Month {auc.auctionMonth}</td>
                              <td className="py-2.5 px-3 text-slate-600">
                                {new Date(auc.auctionDate).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-slate-900">
                                {formatINR(auc.bidDiscountAmount)}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-medium text-slate-700">
                                {auc.winningMemberNumber || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                                {formatINR(auc.foremanCommissionAmount)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600 font-medium">
                                {formatINR(auc.otherDeductionsAmount || 0)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                                {formatINR(auc.dividendPoolAmount)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-emerald-600 text-sm">
                                {formatINR(auc.dividendPerMember)}
                              </td>
                              <td className="py-2.5 px-3">
                                {auc.isUserWon ? (
                                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 text-[10px] font-bold">
                                    I Won
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold">
                                    Distributed
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <button
                                  onClick={() => openAuctionModal(auc.auctionMonth)}
                                  className="p-1 text-slate-400 hover:text-brand-600 rounded"
                                  title="Edit auction details"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: CHIT WINNING / PRIZE MONEY CALCULATOR */}
              {activeTab === 'PRIZE' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Chit Winning / Prize Amount Calculator</h4>
                      <p className="text-xs text-slate-400">
                        Record when you win the auction. Formula: Gross Prize = Total Value - Auction Discount • Net Prize = Gross Prize - Commission - Deductions.
                      </p>
                    </div>
                    <button
                      onClick={openPrizeModal}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-sm flex items-center space-x-1"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>{activeChitDetail.isPrized ? 'Update Prize Details' : 'Record Chit Winning'}</span>
                    </button>
                  </div>

                  {activeChitDetail.isPrized ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* Left: Summary Card */}
                      <div className="bg-amber-50/60 rounded-2xl p-5 border border-amber-200/80 space-y-3">
                        <div className="flex items-center space-x-2">
                          <Award className="w-5 h-5 text-amber-600" />
                          <h5 className="font-black text-amber-950 text-base">Winning & Payout Status</h5>
                        </div>

                        <div className="space-y-2 text-xs pt-2">
                          <div className="flex justify-between">
                            <span className="text-slate-600">Winning Month:</span>
                            <span className="font-bold text-slate-900">Month {activeChitDetail.prizedMonth || 1}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Winning Date:</span>
                            <span className="font-bold text-slate-900">
                              {activeChitDetail.winningDate
                                ? new Date(activeChitDetail.winningDate).toLocaleDateString('en-IN')
                                : '-'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Auction Discount (Bid):</span>
                            <span className="font-bold text-rose-600">
                              {formatINR(activeChitDetail.auctionDiscount || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Gross Prize Amount:</span>
                            <span className="font-bold text-slate-900">
                              {formatINR(
                                activeChitDetail.grossPrizeAmount ||
                                  activeChitDetail.totalValue - (activeChitDetail.auctionDiscount || 0)
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Foreman Commission:</span>
                            <span className="font-bold text-rose-600">
                              -{formatINR(activeChitDetail.foremanCommissionAmount || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600">Other Deductions:</span>
                            <span className="font-bold text-rose-600">
                              -{formatINR(activeChitDetail.otherDeductionsAmount || 0)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-amber-200 pt-2 text-sm">
                            <span className="font-black text-slate-900">Net Prize Amount:</span>
                            <span className="font-black text-amber-600">
                              {formatINR(activeChitDetail.netPrizeAmount || activeChitDetail.prizedAmount || 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actual Received vs Remaining */}
                      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
                        <div>
                          <h5 className="font-bold text-slate-800 text-sm">Amount Received & Liquidity</h5>
                          <div className="mt-4 space-y-3 text-xs">
                            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                              <span className="font-bold text-emerald-900">Actual Amount Received:</span>
                              <span className="font-black text-emerald-700 text-base">
                                {formatINR(activeChitDetail.prizeReceivedAmount || activeChitDetail.prizedAmount || 0)}
                              </span>
                            </div>

                            {activeChitDetail.netPrizeAmount &&
                              (activeChitDetail.prizeReceivedAmount || 0) < activeChitDetail.netPrizeAmount && (
                                <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 flex justify-between items-center">
                                  <span className="font-bold text-rose-900">Pending Prize Balance:</span>
                                  <span className="font-black text-rose-700 text-base">
                                    {formatINR(
                                      activeChitDetail.netPrizeAmount - (activeChitDetail.prizeReceivedAmount || 0)
                                    )}
                                  </span>
                                </div>
                              )}

                            <div className="text-slate-500 space-y-1 pt-1">
                              <p>
                                <span className="font-semibold text-slate-700">Receipt Date:</span>{' '}
                                {activeChitDetail.prizeReceivedDate
                                  ? new Date(activeChitDetail.prizeReceivedDate).toLocaleDateString('en-IN')
                                  : '-'}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-700">Payment Reference:</span>{' '}
                                {activeChitDetail.prizePaymentReference || 'N/A'}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 bg-amber-50 rounded-xl text-[11px] text-amber-800 font-medium flex items-center space-x-2">
                          <Info className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>
                            Important: Winning a chit does not stop future instalments. All remaining monthly instalments must still be paid until month {activeChitDetail.totalMonths}.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <Award className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                      <p className="font-bold text-slate-700 text-sm">Chit Not Yet Won / Non-Prized</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        When you successfully bid in an auction, click "Record Chit Winning" to calculate your net payout and record receipts.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: FINANCIAL SUMMARY & CASH FLOW */}
              {activeTab === 'SUMMARY' && activeChitStats && (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Total Money Paid</span>
                      <p className="text-lg font-black text-rose-600 mt-0.5">
                        {formatINR(activeChitStats.totalPaidPaise)}
                      </p>
                      <span className="text-[10px] text-slate-400">Across {activeChitStats.paidCount} instalments</span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Total Dividends Saved</span>
                      <p className="text-lg font-black text-emerald-600 mt-0.5">
                        {formatINR(activeChitStats.totalDividendsPaise)}
                      </p>
                      <span className="text-[10px] text-slate-400">Discounted from dues</span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Prize Money Received</span>
                      <p className="text-lg font-black text-amber-600 mt-0.5">
                        {formatINR(activeChitStats.totalPrizePaise)}
                      </p>
                      <span className="text-[10px] text-slate-400">Lifted cash inflow</span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Net Cash Flow</span>
                      <p
                        className={`text-lg font-black mt-0.5 ${
                          activeChitStats.netCashFlowPaise >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {formatINR(activeChitStats.netCashFlowPaise)}
                      </p>
                      <span className="text-[10px] text-slate-400">Received - Paid to date</span>
                    </div>
                  </div>

                  {/* Future Projections & Liabilities */}
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
                    <h5 className="font-bold text-slate-800 text-sm">Liabilities & Remaining Commitments</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500">Remaining Months:</span>
                        <p className="font-black text-slate-800 text-base">{activeChitStats.remainingMonths} Months</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Current Overdue / Outstanding:</span>
                        <p className="font-black text-rose-600 text-base">
                          {formatINR(activeChitStats.outstandingPaise)}
                        </p>
                      </div>
                      <div>
                        <span className="text-slate-500">Projected Future Liabilities:</span>
                        <p className="font-black text-slate-700 text-base">
                          {formatINR(activeChitStats.projectedFutureLiabilities)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Monthly Trend Chart */}
                  {activeChitChartData.length > 0 && (
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                      <h5 className="font-bold text-slate-800 text-sm">Monthly Paid vs Dividend Trend</h5>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={activeChitChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `₹${v}`} />
                            <Tooltip
                              formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, '']}
                              contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            <Bar dataKey="paid" name="Amount Paid" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="dividend" name="Dividend Earned" fill="#10b981" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. CREATE / EDIT CHIT MEMBERSHIP MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-base text-slate-800">
                {editingChitId ? 'Edit Chit Membership Details' : 'Add New Chit Membership'}
              </h3>
              <button onClick={() => setCreateModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSaveChit} className="p-6 space-y-4 overflow-y-auto flex-1">
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
                    <option value="BUSINESS">Business</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Current Status *
                  </label>
                  <select
                    value={chitStatus}
                    onChange={(e) => setChitStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 font-semibold"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
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

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Chit Company / Organizer *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Shriram Chits, Vasavi Temple, Local Group"
                    value={chitCompany}
                    onChange={(e) => setChitCompany(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Member / Ticket #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. T-14, 28"
                    value={memberNumber}
                    onChange={(e) => setMemberNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Total Value (₹) *
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
                    Total Members *
                  </label>
                  <input
                    type="number"
                    required
                    value={totalMembers}
                    onChange={(e) => setTotalMembers(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Duration (Months) *
                  </label>
                  <input
                    type="number"
                    required
                    value={totalMonths}
                    onChange={(e) => setTotalMonths(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Monthly Instalment (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="Auto: Total Value / Members"
                    value={monthlyContributionRupees}
                    onChange={(e) => setMonthlyContributionRupees(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-amber-600 focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="text-[10px] text-slate-400">Total Value ÷ Members (Editable)</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Foreman Commission (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={foremanCommissionPercent}
                    onChange={(e) => setForemanCommissionPercent(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="text-[10px] text-slate-400">Usually 5% of Chit Value</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
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

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notes / Agreement Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Notes about organizer, terms, or auction schedule..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs disabled:opacity-50 shadow-md transition-all mt-2"
              >
                {saving ? 'Saving...' : editingChitId ? 'Update Chit Membership' : 'Create Chit Membership'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 7. RECORD MONTHLY PAYMENT MODAL */}
      {payModalOpen && activeChitDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div>
                <h3 className="font-bold text-base text-amber-950">Record Chit Payment</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  {activeChitDetail.chitName} • Month {payMonthNumber}
                </p>
              </div>
              <button onClick={() => setPayModalOpen(false)}>
                <X className="w-5 h-5 text-amber-800" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Month Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={activeChitDetail.totalMonths}
                    value={payMonthNumber}
                    onChange={(e) => setPayMonthNumber(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Amount Paid (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={payAmountRupees}
                    onChange={(e) => setPayAmountRupees(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Dividend Earned (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={payDividendRupees}
                    onChange={(e) => setPayDividendRupees(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-semibold"
                  >
                    <option value="UPI">UPI</option>
                    <option value="BANK">Bank Transfer (NEFT/IMPS)</option>
                    <option value="CASH">Cash</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    UPI Ref / UTR / Cheque #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 332491028475"
                    value={upiRefId}
                    onChange={(e) => setUpiRefId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Pay From Account
                </label>
                <select
                  value={payAccountId}
                  onChange={(e) => setPayAccountId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  <option value="">-- No Account Deduction --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}) - Balance: {formatINR(acc.balance || acc.currentBalance || 0)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Upload Receipt Image / PDF
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional payment notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs disabled:opacity-50 shadow-md transition-all mt-2"
              >
                {saving ? 'Processing...' : 'Confirm Chit Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 8. EDIT INSTALLMENT MODAL */}
      {editInstModalOpen && editingInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h4 className="font-bold text-sm text-slate-800">Edit Month {editingInst.monthNumber} Record</h4>
              <button onClick={() => setEditInstModalOpen(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleUpdateInstallment} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Amount Paid (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editAmountPaidRupees}
                  onChange={(e) => setEditAmountPaidRupees(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Dividend Earned (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={editDividendRupees}
                  onChange={(e) => setEditDividendRupees(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold"
                >
                  <option value="PAID">Paid</option>
                  <option value="PENDING">Pending</option>
                  <option value="PARTIALLY_PAID">Partially Paid</option>
                  <option value="OVERDUE">Overdue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Payment Mode
                </label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs"
                >
                  <option value="UPI">UPI</option>
                  <option value="BANK">Bank</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  UPI / Tx Ref
                </label>
                <input
                  type="text"
                  value={editUpiId}
                  onChange={(e) => setEditUpiId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs mt-2"
              >
                {saving ? 'Updating...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 9. RECORD AUCTION ENTRY MODAL */}
      {auctionModalOpen && activeChitDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-base text-slate-800">Monthly Auction & Dividend Entry</h3>
                <p className="text-xs text-slate-500 mt-0.5">{activeChitDetail.chitName}</p>
              </div>
              <button onClick={() => setAuctionModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSaveAuction} className="p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Auction Month *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={activeChitDetail.totalMonths}
                    value={aucMonth}
                    onChange={(e) => setAucMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Auction Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={aucDate}
                    onChange={(e) => setAucDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Winning Bid Discount (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 100000"
                    value={aucBidDiscount}
                    onChange={(e) => setAucBidDiscount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Winning Member / Ticket #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 18"
                    value={aucWinnerTicket}
                    onChange={(e) => setAucWinnerTicket(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Foreman Commission (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={aucCommission}
                    onChange={(e) => setAucCommission(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                  <span className="text-[10px] text-slate-400">
                    Default: {activeChitDetail.foremanCommissionPercent || 5}% of Total Value
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Other Deductions (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={aucOtherDeductions}
                    onChange={(e) => setAucOtherDeductions(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Automatic Calculation Preview Box */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-emerald-800">Computed Dividend Pool:</span>
                  <span className="font-bold text-emerald-950">₹{computedAuctionPreview.pool.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-emerald-800">Auto Dividend Per Member:</span>
                  <span className="font-black text-emerald-700 text-sm">
                    ₹{computedAuctionPreview.perMember.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Custom Dividend Per Member (₹) (Override)
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="Leave empty to use automatic calculation above"
                  value={aucCustomDividendPerMember}
                  onChange={(e) => setAucCustomDividendPerMember(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="userWonChk"
                  checked={aucIsUserWon}
                  onChange={(e) => setAucIsUserWon(e.target.checked)}
                  className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500"
                />
                <label htmlFor="userWonChk" className="text-xs font-bold text-slate-800 cursor-pointer">
                  I won this auction (Mark Chit as Prized / Won)
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="Optional auction notes..."
                  value={aucNotes}
                  onChange={(e) => setAucNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl text-xs disabled:opacity-50 shadow-md transition-all mt-2"
              >
                {saving ? 'Saving...' : 'Save Auction & Apply Dividends'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 10. CHIT PRIZE MONEY ENTRY MODAL */}
      {prizeModalOpen && activeChitDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-amber-50">
              <div>
                <h3 className="font-bold text-base text-amber-950">Record Chit Winning & Prize Amount</h3>
                <p className="text-xs text-amber-700 mt-0.5">{activeChitDetail.chitName}</p>
              </div>
              <button onClick={() => setPrizeModalOpen(false)}>
                <X className="w-5 h-5 text-amber-800" />
              </button>
            </div>

            <form onSubmit={handleSavePrize} className="p-6 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Winning Month *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={activeChitDetail.totalMonths}
                    value={przWinningMonth}
                    onChange={(e) => setPrzWinningMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Winning Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={przWinningDate}
                    onChange={(e) => setPrzWinningDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Auction Discount / Bid (₹) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 120000"
                  value={przDiscountRupees}
                  onChange={(e) => setPrzDiscountRupees(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Foreman Commission (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={przCommissionRupees}
                    onChange={(e) => setPrzCommissionRupees(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Other Deductions (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={przOtherDeductionsRupees}
                    onChange={(e) => setPrzOtherDeductionsRupees(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Automatic Calculation Preview */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-amber-800">Gross Prize (Value - Discount):</span>
                  <span className="font-bold text-amber-950">₹{computedPrizePreview.gross.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-800 font-bold">Net Prize Amount (Payable to you):</span>
                  <span className="font-black text-amber-900 text-sm">
                    ₹{computedPrizePreview.net.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Actual Received (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Defaults to Net Prize"
                    value={przReceivedRupees}
                    onChange={(e) => setPrzReceivedRupees(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-emerald-700 focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="text-[10px] text-slate-400">Supports partial receipts</span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Received Date
                  </label>
                  <input
                    type="date"
                    value={przReceivedDate}
                    onChange={(e) => setPrzReceivedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Deposit To Account
                  </label>
                  <select
                    value={przAccountId}
                    onChange={(e) => setPrzAccountId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-medium"
                  >
                    <option value="">-- No Account Deposit --</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    UTR / Cheque Ref #
                  </label>
                  <input
                    type="text"
                    placeholder="Bank reference..."
                    value={przReference}
                    onChange={(e) => setPrzReference(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs disabled:opacity-50 shadow-md transition-all mt-2"
              >
                {saving ? 'Processing...' : 'Confirm Chit Prize & Winning'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chits;
