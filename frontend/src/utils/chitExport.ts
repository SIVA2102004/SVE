import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ChitScheme, ChitInstallment, ChitAuction } from '../types';

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    [headers.join(','), ...rows.map((e) => e.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportChitStatementPDF(chit: ChitScheme) {
  const doc = new jsPDF();

  // Header Title
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text('CHIT FUND STATEMENT', 14, 18);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 25);

  // Chit Details Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 30, 182, 38, 2, 2, 'FD');

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`${chit.chitName} (${chit.chitCompany})`, 18, 38);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Member / Ticket #: ${chit.memberNumber || chit.chitNumber || 'N/A'}`, 18, 45);
  doc.text(`Total Value: Rs. ${(chit.totalValue / 100).toLocaleString('en-IN')}`, 18, 51);
  doc.text(`Total Members: ${chit.totalMembers} | Duration: ${chit.totalMonths} Months`, 18, 57);
  doc.text(`Original Monthly Instalment: Rs. ${(chit.monthlyContribution / 100).toLocaleString('en-IN')}`, 18, 63);

  doc.text(`Foreman Commission: ${chit.foremanCommissionPercent || 5}%`, 110, 45);
  doc.text(`Due Day: ${chit.dueDayOfMonth}th of every month`, 110, 51);
  doc.text(`Status: ${chit.status}`, 110, 57);
  doc.text(`Auction Status: ${chit.isPrized ? `Won Month ${chit.prizedMonth} (Rs. ${((chit.prizedAmount || 0) / 100).toLocaleString('en-IN')})` : 'Active / Non-Prized'}`, 110, 63);

  // Financial Calculations Summary
  const installments = chit.installments || [];
  const totalPaidPaise = installments.reduce((acc, i) => acc + (i.amountPaid || 0), 0);
  const totalDividendPaise = installments.reduce((acc, i) => acc + (i.dividendEarned || 0), 0);
  const totalPrizePaise = chit.isPrized ? (chit.prizeReceivedAmount || chit.prizedAmount || 0) : 0;
  const netCashFlowPaise = totalPrizePaise - totalPaidPaise;

  const totalNetExpectedPaise = installments.reduce((acc, i) => acc + (i.netInstalment ?? (i.amountExpected - i.dividendEarned)), 0);
  const outstandingPaise = Math.max(0, totalNetExpectedPaise - totalPaidPaise);

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(14, 72, 182, 18, 2, 2, 'FD');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Paid: Rs. ${(totalPaidPaise / 100).toLocaleString('en-IN')}`, 18, 80);
  doc.text(`Total Dividends: Rs. ${(totalDividendPaise / 100).toLocaleString('en-IN')}`, 70, 80);
  doc.text(`Prize Money: Rs. ${(totalPrizePaise / 100).toLocaleString('en-IN')}`, 125, 80);
  doc.text(`Net Cash Flow: Rs. ${(netCashFlowPaise / 100).toLocaleString('en-IN')}`, 18, 86);
  doc.text(`Outstanding Due: Rs. ${(outstandingPaise / 100).toLocaleString('en-IN')}`, 70, 86);

  // Monthly Table
  const tableRows = installments.map((i) => {
    const orig = i.amountExpected / 100;
    const div = i.dividendEarned / 100;
    const net = (i.netInstalment ?? (i.amountExpected - i.dividendEarned)) / 100;
    const paid = i.amountPaid / 100;
    const dueDt = new Date(i.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const paidDt = i.paidDate ? new Date(i.paidDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-';

    return [
      `M${i.monthNumber}`,
      dueDt,
      orig.toLocaleString('en-IN'),
      div.toLocaleString('en-IN'),
      net.toLocaleString('en-IN'),
      paid.toLocaleString('en-IN'),
      paidDt,
      i.paymentMethod || '-',
      i.status,
    ];
  });

  autoTable(doc, {
    startY: 94,
    head: [['Month', 'Due Date', 'Original', 'Dividend', 'Net Due', 'Amount Paid', 'Paid Date', 'Mode', 'Status']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42], fontSize: 8, textColor: [255, 255, 255] },
    bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    styles: { cellPadding: 2 },
  });

  doc.save(`${chit.chitName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Statement.pdf`);
}
