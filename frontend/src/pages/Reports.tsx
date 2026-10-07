import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatINR, formatDate } from '../utils/formatters';
import { BarChart3, Download, RefreshCw, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const Reports: React.FC = () => {
  const [cashFlowData, setCashFlowData] = useState<any>(null);
  const [pnlData, setPnlData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'CASH_FLOW' | 'PNL'>('CASH_FLOW');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [cfRes, pnlRes] = await Promise.all([
        api.get('/reports/cash-flow'),
        api.get('/reports/profit-loss'),
      ]);
      setCashFlowData(cfRes.data);
      setPnlData(pnlRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const exportCashFlowPDF = () => {
    if (!cashFlowData) return;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('SVE – MONTHLY CASH FLOW STATEMENT', 14, 20);
    doc.setFontSize(10);
    doc.text(`Period: ${cashFlowData.period.start} to ${cashFlowData.period.end}`, 14, 28);
    doc.line(14, 32, 196, 32);

    const body = [
      ['Opening Liquid Balance', formatINR(cashFlowData.summary.openingBalance)],
      ['Total Cash Inflow (+)', formatINR(cashFlowData.summary.totalInflow)],
      ['Total Cash Outflow (-)', formatINR(cashFlowData.summary.totalOutflow)],
      ['Net Cash Flow', formatINR(cashFlowData.summary.netCashFlow)],
      ['Closing Liquid Balance', formatINR(cashFlowData.summary.closingBalance)],
    ];

    autoTable(doc, {
      startY: 40,
      head: [['Metric', 'Amount (INR)']],
      body,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] },
    });

    doc.save(`Cash_Flow_${cashFlowData.period.start}.pdf`);
  };

  const exportCSV = () => {
    if (!cashFlowData) return;
    let csv = 'Metric,Amount (INR)\n';
    csv += `Opening Balance,${cashFlowData.summary.openingBalance / 100}\n`;
    csv += `Total Inflow,${cashFlowData.summary.totalInflow / 100}\n`;
    csv += `Total Outflow,${cashFlowData.summary.totalOutflow / 100}\n`;
    csv += `Net Flow,${cashFlowData.summary.netCashFlow / 100}\n`;
    csv += `Closing Balance,${cashFlowData.summary.closingBalance / 100}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `SVE_Statement.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Financial Reports & P&L</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Cash flow reconciliation, profit and loss breakdown, PDF & CSV export
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={exportCSV}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={exportCashFlowPDF}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Statement PDF</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 border">
        <button
          onClick={() => setActiveTab('CASH_FLOW')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'CASH_FLOW'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Cash Flow Statement
        </button>
        <button
          onClick={() => setActiveTab('PNL')}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'PNL'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Profit & Loss Overview
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
          <span>Generating report numbers...</span>
        </div>
      ) : activeTab === 'CASH_FLOW' && cashFlowData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs uppercase font-bold text-slate-400">Total Money In (Inflow)</span>
              <div className="text-2xl font-black text-emerald-600 mt-2">
                {formatINR(cashFlowData.summary.totalInflow)}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs uppercase font-bold text-slate-400">Total Money Out (Outflow)</span>
              <div className="text-2xl font-black text-rose-600 mt-2">
                {formatINR(cashFlowData.summary.totalOutflow)}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs uppercase font-bold text-slate-400">Net Cash Flow</span>
              <div
                className={`text-2xl font-black mt-2 ${
                  cashFlowData.summary.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatINR(cashFlowData.summary.netCashFlow)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-800 text-base">Liquidity Statement Breakdown</h3>
            <div className="divide-y divide-slate-100 text-sm">
              <div className="py-3 flex justify-between font-semibold text-slate-600">
                <span>Calculated Opening Liquid Balance:</span>
                <span>{formatINR(cashFlowData.summary.openingBalance)}</span>
              </div>
              <div className="py-3 flex justify-between font-bold text-emerald-600">
                <span>Total Received / Income (+):</span>
                <span>{formatINR(cashFlowData.summary.totalInflow)}</span>
              </div>
              <div className="py-3 flex justify-between font-bold text-rose-600">
                <span>Total Disbursed / Expenses / Purchases (-):</span>
                <span>{formatINR(cashFlowData.summary.totalOutflow)}</span>
              </div>
              <div className="py-3 flex justify-between font-black text-slate-900 text-base pt-4">
                <span>Current Available Closing Balance:</span>
                <span className="text-brand-600">{formatINR(cashFlowData.summary.closingBalance)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'PNL' && pnlData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs uppercase font-bold text-slate-400">Gross Inflow</span>
              <div className="text-2xl font-black text-emerald-600 mt-2">
                {formatINR(pnlData.totalRevenue)}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs uppercase font-bold text-slate-400">Direct & Overhead Expenses</span>
              <div className="text-2xl font-black text-rose-600 mt-2">
                {formatINR(pnlData.totalDirectExpenses)}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
              <span className="text-xs uppercase font-bold text-slate-400">Net Operational Margin</span>
              <div
                className={`text-2xl font-black mt-2 ${
                  pnlData.netOperatingProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatINR(pnlData.netOperatingProfit)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 text-base mb-4">Overhead Expense Breakdown by Category</h3>
            <div className="space-y-2">
              {Object.entries(pnlData.breakdown).map(([cat, amt]: [string, any]) => (
                <div key={cat} className="flex justify-between p-3 bg-slate-50 rounded-xl text-xs font-semibold">
                  <span className="text-slate-700">{cat}</span>
                  <span className="text-rose-600 font-bold">{formatINR(amt)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Reports;
