/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Module: Sale Ledger & High-Density Receipts Intelligence
 * Features:
 * - Date Range, Daily Sales & Real-Time Live Sales Feed
 * - Counter / Terminal-Wise Sales Breakdown
 * - Salesman-Wise Sales Performance Reports
 * - Universal Deep Search: Receipt / Invoice #, Customer Name, Phone, Address, Medicine Name
 * - Expandable Line-Item Receipt Inspector
 * - Direct Complaint / Shortage / Admin Remarks Logging against any receipt
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Sale, CustomerComplaint, ComplaintCategory, ComplaintStatus } from '../../types/pharmacy';
import { printThermalReceipt } from '../../utils/thermalPrinter';
import {
  Search,
  Calendar,
  DollarSign,
  ShoppingCart,
  Users,
  Store,
  Clock,
  Printer,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  PlusCircle,
  MessageSquareWarning,
  UserCheck,
  CreditCard,
  Banknote,
  Receipt,
  Download,
  X,
  Send,
} from 'lucide-react';

type LedgerSubTab = 'all' | 'daily' | 'live' | 'terminals' | 'salesmen';

interface SaleLedgerProps {
  onOpenComplaintDesk?: () => void;
}

export const SaleLedger: React.FC<SaleLedgerProps> = ({ onOpenComplaintDesk }) => {
  const {
    sales,
    customers,
    complaints,
    addComplaint,
    formatCurrency,
    receiptSettings,
    showToast,
  } = usePharmacy();

  const [activeSubTab, setActiveSubTab] = useState<LedgerSubTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedTerminal, setSelectedTerminal] = useState<string>('all');
  const [selectedSalesman, setSelectedSalesman] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'due'>('all');
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);
  const [saleHighlightIndex, setSaleHighlightIndex] = useState<number>(-1);
  const saleRowRefs = useRef<{ [key: number]: HTMLTableRowElement | null }>({});

  // Complaint modal state
  const [complaintModalSale, setComplaintModalSale] = useState<Sale | null>(null);
  const [complaintCategory, setComplaintCategory] = useState<ComplaintCategory>('Medicine Missed / Short Dispensed');
  const [complaintMissedMed, setComplaintMissedMed] = useState('');
  const [complaintMissedQty, setComplaintMissedQty] = useState(1);
  const [complaintDesc, setComplaintDesc] = useState('');
  const [complaintAdminRemarks, setComplaintAdminRemarks] = useState('');
  const [complaintCoachingNotes, setComplaintCoachingNotes] = useState('');

  // Receipt Preview Modal
  const [receiptPreviewSale, setReceiptPreviewSale] = useState<Sale | null>(null);

  // Quick Preset Handlers
  const handleSetDatePreset = (preset: 'today' | 'yesterday' | '7days' | 'month' | 'clear') => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'clear') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'today') {
      const dStr = formatYMD(today);
      setStartDate(dStr);
      setEndDate(dStr);
    } else if (preset === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      const yStr = formatYMD(y);
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === '7days') {
      const past = new Date(today);
      past.setDate(today.getDate() - 7);
      setStartDate(formatYMD(past));
      setEndDate(formatYMD(today));
    } else if (preset === 'month') {
      const past = new Date(today);
      past.setDate(today.getDate() - 30);
      setStartDate(formatYMD(past));
      setEndDate(formatYMD(today));
    }
  };

  // Distinct Terminals & Salesmen
  const terminalOptions = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if (s.TerminalName) set.add(s.TerminalName);
    });
    return Array.from(set).sort();
  }, [sales]);

  const salesmanOptions = useMemo(() => {
    const set = new Set<string>();
    sales.forEach((s) => {
      if (s.SalesmanName) set.add(s.SalesmanName);
    });
    return Array.from(set).sort();
  }, [sales]);

  // Deep Search & Filter logic
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      // 1. Date Range
      if (startDate) {
        const saleD = s.SaleDate.substring(0, 10);
        if (saleD < startDate) return false;
      }
      if (endDate) {
        const saleD = s.SaleDate.substring(0, 10);
        if (saleD > endDate) return false;
      }

      // 2. Terminal Filter
      if (selectedTerminal !== 'all' && s.TerminalName !== selectedTerminal) {
        return false;
      }

      // 3. Salesman Filter
      if (selectedSalesman !== 'all' && s.SalesmanName !== selectedSalesman) {
        return false;
      }

      // 4. Payment status
      if (paymentFilter === 'paid' && (s.DueAmount || 0) > 0) return false;
      if (paymentFilter === 'due' && (s.DueAmount || 0) <= 0) return false;

      // 5. Universal Search Query:
      // Invoice #, Customer Name, Phone, Address, Medicine Name
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchInvoice = (s.InvoiceNumber || '').toLowerCase().includes(q) || s.SaleID.toLowerCase().includes(q);
        const matchCustomerName = (s.CustomerName || '').toLowerCase().includes(q);
        const matchCustomerPhone = (s.CustomerPhone || '').toLowerCase().includes(q);
        const matchCustomerAddr = (s.CustomerAddress || '').toLowerCase().includes(q);
        const matchSalesman = (s.SalesmanName || '').toLowerCase().includes(q);
        const matchMedicine = (s.Items || []).some(
          (item) =>
            item.TradeName.toLowerCase().includes(q) ||
            (item.GenericName && item.GenericName.toLowerCase().includes(q)) ||
            item.BatchNumber.toLowerCase().includes(q) ||
            item.MedicineID.toLowerCase().includes(q)
        );

        if (!matchInvoice && !matchCustomerName && !matchCustomerPhone && !matchCustomerAddr && !matchSalesman && !matchMedicine) {
          return false;
        }
      }

      return true;
    });
  }, [sales, startDate, endDate, selectedTerminal, selectedSalesman, paymentFilter, searchQuery]);

  useEffect(() => {
    if (searchQuery.trim().length > 0 && filteredSales.length > 0) {
      setSaleHighlightIndex(0);
    } else {
      setSaleHighlightIndex(-1);
    }
  }, [searchQuery, filteredSales.length]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredSales.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSaleHighlightIndex((prev) => {
        const next = prev < filteredSales.length - 1 ? prev + 1 : 0;
        saleRowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSaleHighlightIndex((prev) => {
        const next = prev > 0 ? prev - 1 : filteredSales.length - 1;
        saleRowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetSale =
        saleHighlightIndex >= 0 && saleHighlightIndex < filteredSales.length
          ? filteredSales[saleHighlightIndex]
          : filteredSales[0];
      if (targetSale) {
        setReceiptPreviewSale(targetSale);
      }
    } else if (e.key === 'Escape') {
      setSearchQuery('');
      setSaleHighlightIndex(-1);
    }
  };

  // Financial KPI totals for current filtered view
  const summaryKpis = useMemo(() => {
    let totalRevenue = 0;
    let totalPaid = 0;
    let totalDue = 0;
    let totalDiscount = 0;
    let totalItemsCount = 0;

    filteredSales.forEach((s) => {
      totalRevenue += s.FinalAmount || s.TotalAmount;
      totalPaid += s.PaidAmount || 0;
      totalDue += s.DueAmount || 0;
      totalDiscount += s.DiscountAmount || 0;
      (s.Items || []).forEach((item) => {
        totalItemsCount += item.Quantity;
      });
    });

    const averageTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

    return {
      totalRevenue,
      totalPaid,
      totalDue,
      totalDiscount,
      totalItemsCount,
      receiptsCount: filteredSales.length,
      averageTicket,
    };
  }, [filteredSales]);

  // Terminal-Wise Breakdown Data
  const terminalBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        terminalName: string;
        count: number;
        revenue: number;
        paid: number;
        due: number;
        items: number;
      }
    >();

    filteredSales.forEach((s) => {
      const term = s.TerminalName || 'Counter 1 - Fast POS';
      if (!map.has(term)) {
        map.set(term, {
          terminalName: term,
          count: 0,
          revenue: 0,
          paid: 0,
          due: 0,
          items: 0,
        });
      }
      const data = map.get(term)!;
      data.count += 1;
      data.revenue += s.FinalAmount || s.TotalAmount;
      data.paid += s.PaidAmount || 0;
      data.due += s.DueAmount || 0;
      (s.Items || []).forEach((item) => (data.items += item.Quantity));
    });

    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  // Salesman-Wise Breakdown Data
  const salesmanBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        salesmanName: string;
        count: number;
        revenue: number;
        avgTicket: number;
        dueIssued: number;
        complaintsCount: number;
      }
    >();

    filteredSales.forEach((s) => {
      const sm = s.SalesmanName || 'General Staff';
      if (!map.has(sm)) {
        map.set(sm, {
          salesmanName: sm,
          count: 0,
          revenue: 0,
          avgTicket: 0,
          dueIssued: 0,
          complaintsCount: 0,
        });
      }
      const data = map.get(sm)!;
      data.count += 1;
      data.revenue += s.FinalAmount || s.TotalAmount;
      data.dueIssued += s.DueAmount || 0;
    });

    // Count complaints mapped to salesman
    complaints.forEach((c) => {
      if (c.SalesmanName && map.has(c.SalesmanName)) {
        map.get(c.SalesmanName)!.complaintsCount += 1;
      }
    });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        avgTicket: item.count > 0 ? item.revenue / item.count : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, complaints]);

  // Daily Aggregation Data
  const dailyBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        count: number;
        revenue: number;
        paid: number;
        due: number;
        items: number;
      }
    >();

    filteredSales.forEach((s) => {
      const dateKey = s.SaleDate.substring(0, 10);
      if (!map.has(dateKey)) {
        map.set(dateKey, {
          date: dateKey,
          count: 0,
          revenue: 0,
          paid: 0,
          due: 0,
          items: 0,
        });
      }
      const d = map.get(dateKey)!;
      d.count += 1;
      d.revenue += s.FinalAmount || s.TotalAmount;
      d.paid += s.PaidAmount || 0;
      d.due += s.DueAmount || 0;
      (s.Items || []).forEach((item) => (d.items += item.Quantity));
    });

    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredSales]);

  // Complaints count map by ReceiptNumber / InvoiceNumber
  const complaintsByInvoice = useMemo(() => {
    const map = new Map<string, CustomerComplaint[]>();
    complaints.forEach((c) => {
      if (!map.has(c.ReceiptNumber)) {
        map.set(c.ReceiptNumber, []);
      }
      map.get(c.ReceiptNumber)!.push(c);
    });
    return map;
  }, [complaints]);

  // Open modal to file complaint
  const handleOpenComplaintModal = (sale: Sale) => {
    setComplaintModalSale(sale);
    setComplaintCategory('Medicine Missed / Short Dispensed');
    setComplaintMissedMed(sale.Items?.[0]?.TradeName || '');
    setComplaintMissedQty(1);
    setComplaintDesc('');
    setComplaintAdminRemarks('');
    setComplaintCoachingNotes(
      'Cross-check physical blister count against terminal invoice before sealing the dispensing pouch.'
    );
  };

  // Submit Complaint
  const handleSubmitComplaint = (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintModalSale) return;

    if (!complaintDesc.trim()) {
      showToast('Please enter the customer complaint description.', 'warning');
      return;
    }

    addComplaint({
      ReceiptNumber: complaintModalSale.InvoiceNumber,
      SaleID: complaintModalSale.SaleID,
      CustomerID: complaintModalSale.CustomerID || undefined,
      CustomerName: complaintModalSale.CustomerName,
      CustomerPhone: complaintModalSale.CustomerPhone || '',
      CustomerAddress: complaintModalSale.CustomerAddress,
      SalesmanID: complaintModalSale.SalesmanID || 'EMP-001',
      SalesmanName: complaintModalSale.SalesmanName || 'General Staff',
      TerminalName: complaintModalSale.TerminalName || 'Counter 1',
      Category: complaintCategory,
      Status: 'Pending / Under Review' as ComplaintStatus,
      ShortOrMissedMedicine: complaintMissedMed
        ? `${complaintMissedMed} (Short: ${complaintMissedQty} pcs)`
        : undefined,
      IssueDescription: complaintDesc.trim(),
      AdminRemarks: complaintAdminRemarks.trim() || 'Logged via Sale Ledger for quality inspection.',
      SalesmanCoachingNotes: complaintCoachingNotes.trim() || undefined,
    });

    showToast(
      `Complaint registered against ${complaintModalSale.InvoiceNumber}. Added to Coaching Desk!`,
      'success',
      'Complaint Logged'
    );
    setComplaintModalSale(null);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredSales.length === 0) {
      showToast('No sales data to export.', 'info');
      return;
    }

    const headers = [
      'Invoice #',
      'Date Time',
      'Terminal',
      'Salesman',
      'Customer',
      'Phone',
      'Address',
      'Total Amount',
      'Discount',
      'Final Amount',
      'Paid Amount',
      'Due Amount',
      'Items Count',
      'Items Detail',
    ];

    const rows = filteredSales.map((s) => {
      const itemsStr = (s.Items || [])
        .map((i) => `${i.TradeName} (Qty: ${i.Quantity}, Batch: ${i.BatchNumber})`)
        .join('; ');

      return [
        s.InvoiceNumber,
        s.SaleDate,
        `"${s.TerminalName || ''}"`,
        `"${s.SalesmanName || ''}"`,
        `"${s.CustomerName}"`,
        `"${s.CustomerPhone || ''}"`,
        `"${s.CustomerAddress || ''}"`,
        s.TotalAmount,
        s.DiscountAmount,
        s.FinalAmount,
        s.PaidAmount,
        s.DueAmount,
        s.Items?.length || 0,
        `"${itemsStr}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sale_Ledger_Export_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Sale ledger exported to CSV successfully.', 'success');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-900 text-slate-100 overflow-hidden">
      {/* Top Ledger Header Bar */}
      <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-400">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                Pharmacy Sale Ledger & Receipts Intelligence
              </h1>
              <span className="text-[10px] uppercase font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                Master Audit & Traceability
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Multi-counter breakdowns, salesman performance, deep receipt item search, and customer grievance tracking
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors shadow-xs"
            title="Export filtered records to CSV"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="px-5 pt-2 pb-0 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setActiveSubTab('all')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-x ${
              activeSubTab === 'all'
                ? 'bg-slate-900 text-emerald-400 border-slate-700 font-bold'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <Receipt className="w-3.5 h-3.5" />
              <span>All Invoices Archive ({filteredSales.length})</span>
            </div>
          </button>

          <button
            onClick={() => setActiveSubTab('daily')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-x ${
              activeSubTab === 'daily'
                ? 'bg-slate-900 text-emerald-400 border-slate-700 font-bold'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Daily Sales Ledger ({dailyBreakdown.length} Days)</span>
            </div>
          </button>

          <button
            onClick={() => setActiveSubTab('live')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-x ${
              activeSubTab === 'live'
                ? 'bg-slate-900 text-emerald-400 border-slate-700 font-bold'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 -ml-2" />
              <span>Live POS Stream</span>
            </div>
          </button>

          <button
            onClick={() => setActiveSubTab('terminals')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-x ${
              activeSubTab === 'terminals'
                ? 'bg-slate-900 text-emerald-400 border-slate-700 font-bold'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <Store className="w-3.5 h-3.5 text-purple-400" />
              <span>Counter / Terminal Wise ({terminalBreakdown.length})</span>
            </div>
          </button>

          <button
            onClick={() => setActiveSubTab('salesmen')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-colors border-t border-x ${
              activeSubTab === 'salesmen'
                ? 'bg-slate-900 text-emerald-400 border-slate-700 font-bold'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <div className="flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>Salesman Performance & Coaching ({salesmanBreakdown.length})</span>
            </div>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center space-x-2 pb-1.5">
          <Clock className="w-3 h-3 text-slate-400" />
          <span>Synchronized with POS SQL Server</span>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="p-4 bg-slate-950/60 border-b border-slate-800 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 shrink-0">
        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase text-slate-400 block tracking-wider">
            Total Sales Volume
          </span>
          <span className="text-base font-bold text-emerald-400 font-mono mt-0.5 block">
            {formatCurrency(summaryKpis.totalRevenue)}
          </span>
          <span className="text-[10px] text-slate-400">{summaryKpis.receiptsCount} invoices</span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase text-slate-400 block tracking-wider">
            Total Settled Inflow
          </span>
          <span className="text-base font-bold text-emerald-300 font-mono mt-0.5 block">
            {formatCurrency(summaryKpis.totalPaid)}
          </span>
          <span className="text-[10px] text-slate-400">Cash & digital receipts</span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase text-slate-400 block tracking-wider">
            Credit / Due Given
          </span>
          <span className="text-base font-bold text-amber-400 font-mono mt-0.5 block">
            {formatCurrency(summaryKpis.totalDue)}
          </span>
          <span className="text-[10px] text-slate-400">Booked to customer ledgers</span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase text-slate-400 block tracking-wider">
            Units Dispensed
          </span>
          <span className="text-base font-bold text-purple-400 font-mono mt-0.5 block">
            {summaryKpis.totalItemsCount.toLocaleString()} Pcs
          </span>
          <span className="text-[10px] text-slate-400">Medicine units sold</span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase text-slate-400 block tracking-wider">
            Average Basket
          </span>
          <span className="text-base font-bold text-cyan-400 font-mono mt-0.5 block">
            {formatCurrency(summaryKpis.averageTicket)}
          </span>
          <span className="text-[10px] text-slate-400">Per invoice average</span>
        </div>

        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
          <span className="text-[10px] font-semibold uppercase text-slate-400 block tracking-wider">
            Total Discounts
          </span>
          <span className="text-base font-bold text-rose-300 font-mono mt-0.5 block">
            {formatCurrency(summaryKpis.totalDiscount)}
          </span>
          <span className="text-[10px] text-slate-400">Promotions & concessions</span>
        </div>
      </div>

      {/* Filter and Deep Search Ribbon */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center gap-2.5 shrink-0">
        {/* Universal Search Input */}
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search by Invoice #, Customer, Phone, or Medicine Name... (↓/↑ to navigate, Enter to view)"
            className="w-full bg-slate-950 border border-slate-700 rounded-md pl-9 pr-7 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Date Filter & Presets */}
        <div className="flex items-center space-x-1.5">
          <span className="text-xs text-slate-400 flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" /> From:
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
          <span className="text-xs text-slate-400">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Quick Date Presets */}
        <div className="flex items-center space-x-1">
          <button
            onClick={() => handleSetDatePreset('today')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium border border-slate-700 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => handleSetDatePreset('yesterday')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium border border-slate-700 transition-colors"
          >
            Yesterday
          </button>
          <button
            onClick={() => handleSetDatePreset('7days')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium border border-slate-700 transition-colors"
          >
            7 Days
          </button>
          <button
            onClick={() => handleSetDatePreset('month')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-medium border border-slate-700 transition-colors"
          >
            30 Days
          </button>
          {(startDate || endDate) && (
            <button
              onClick={() => handleSetDatePreset('clear')}
              className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-[11px] text-rose-300 border border-rose-800/60 transition-colors"
            >
              Clear Dates
            </button>
          )}
        </div>

        {/* Terminal Filter */}
        <div className="flex items-center space-x-1.5">
          <Store className="w-3.5 h-3.5 text-purple-400" />
          <select
            value={selectedTerminal}
            onChange={(e) => setSelectedTerminal(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Counters</option>
            {terminalOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        {/* Salesman Filter */}
        <div className="flex items-center space-x-1.5">
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <select
            value={selectedSalesman}
            onChange={(e) => setSelectedSalesman(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Salesmen</option>
            {salesmanOptions.map((sm) => (
              <option key={sm} value={sm}>
                {sm}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Type */}
        <div className="flex items-center space-x-1.5">
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Payments</option>
            <option value="paid">Fully Settled</option>
            <option value="due">With Dues / Credit</option>
          </select>
        </div>
      </div>

      {/* Main Content Area based on Sub-Tab */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* SUB-TAB 1: ALL RECEIPTS ARCHIVE */}
        {activeSubTab === 'all' && (
          <div className="space-y-2">
            {filteredSales.length === 0 ? (
              <div className="text-center py-16 bg-slate-950/60 rounded-xl border border-slate-800">
                <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-300">No sale receipts match criteria</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Try clearing date filters, expanding search terms, or looking up by invoice number, customer phone or medicine name.
                </p>
              </div>
            ) : (
              <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-md">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider select-none font-semibold">
                      <th className="py-2.5 px-3 w-8"></th>
                      <th className="py-2.5 px-3">Invoice / Date</th>
                      <th className="py-2.5 px-3">Counter / Salesman</th>
                      <th className="py-2.5 px-3">Customer Information</th>
                      <th className="py-2.5 px-3 text-center">Items Sold</th>
                      <th className="py-2.5 px-3 text-right">Net Bill</th>
                      <th className="py-2.5 px-3 text-right">Paid / Due</th>
                      <th className="py-2.5 px-3 text-center">Complain / Coaching</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredSales.map((sale, idx) => {
                      const isExpanded = expandedSaleId === sale.SaleID;
                      const isHighlighted = idx === saleHighlightIndex;
                      const invoiceComplaints = complaintsByInvoice.get(sale.InvoiceNumber) || [];
                      const hasComplaint = invoiceComplaints.length > 0;
                      const hasDue = (sale.DueAmount || 0) > 0;

                      return (
                        <React.Fragment key={sale.SaleID}>
                          <tr
                            ref={(el) => { saleRowRefs.current[idx] = el; }}
                            className={`transition-colors cursor-pointer ${
                              isHighlighted
                                ? 'bg-emerald-950/70 ring-1 ring-emerald-500/70 text-white'
                                : isExpanded
                                ? 'bg-slate-900/40'
                                : 'hover:bg-slate-900/60'
                            }`}
                            onClick={() => {
                              setSaleHighlightIndex(idx);
                              setExpandedSaleId(isExpanded ? null : sale.SaleID);
                            }}
                          >
                            {/* Expand Chevron */}
                            <td className="py-2.5 px-3 text-center text-slate-400">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </td>

                            {/* Invoice Number & Date */}
                            <td className="py-2.5 px-3">
                              <div className="font-mono font-bold text-white flex items-center space-x-1.5">
                                <span>{sale.InvoiceNumber}</span>
                                {hasDue && (
                                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/80">
                                    DUE
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center space-x-1">
                                <Clock className="w-2.5 h-2.5 text-slate-400" />
                                <span>{sale.SaleDate}</span>
                              </div>
                            </td>

                            {/* Terminal & Salesman */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center space-x-1.5">
                                <Store className="w-3 h-3 text-purple-400 shrink-0" />
                                <span className="font-medium text-slate-200">
                                  {sale.TerminalName || 'Counter 1 - Fast POS'}
                                </span>
                              </div>
                              <div className="text-[10px] text-amber-300/90 flex items-center space-x-1 mt-0.5">
                                <UserCheck className="w-2.5 h-2.5 text-amber-400" />
                                <span>By: {sale.SalesmanName || 'General Staff'}</span>
                              </div>
                            </td>

                            {/* Customer Information */}
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-200 flex items-center space-x-1.5">
                                <span>{sale.CustomerName}</span>
                                {sale.CustomerID && (
                                  <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950 px-1 rounded border border-emerald-800/60">
                                    {sale.CustomerID}
                                  </span>
                                )}
                              </div>
                              {(sale.CustomerPhone || sale.CustomerAddress) && (
                                <div className="text-[10px] text-slate-400 mt-0.5 flex flex-wrap gap-x-2">
                                  {sale.CustomerPhone && (
                                    <span className="flex items-center space-x-1 font-mono">
                                      <span>{sale.CustomerPhone}</span>
                                    </span>
                                  )}
                                  {sale.CustomerAddress && (
                                    <span className="truncate max-w-[200px]" title={sale.CustomerAddress}>
                                      · {sale.CustomerAddress}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Items Count */}
                            <td className="py-2.5 px-3 text-center">
                              <span className="font-mono font-medium text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                {sale.Items?.length || 0} line items
                              </span>
                            </td>

                            {/* Net Bill */}
                            <td className="py-2.5 px-3 text-right">
                              <span className="font-mono font-bold text-white block">
                                {formatCurrency(sale.FinalAmount || sale.TotalAmount)}
                              </span>
                              {sale.DiscountAmount > 0 && (
                                <span className="text-[10px] text-rose-400 font-mono block">
                                  Disc: -{formatCurrency(sale.DiscountAmount)}
                                </span>
                              )}
                            </td>

                            {/* Paid / Due breakdown */}
                            <td className="py-2.5 px-3 text-right">
                              <div className="text-[11px] font-mono text-emerald-400">
                                Paid: {formatCurrency(sale.PaidAmount || 0)}
                              </div>
                              {hasDue ? (
                                <div className="text-[10px] font-mono font-bold text-amber-400 mt-0.5">
                                  Due: {formatCurrency(sale.DueAmount)}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400 mt-0.5">Cleared</div>
                              )}
                            </td>

                            {/* Complain / Quality Desk */}
                            <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                              {hasComplaint ? (
                                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-medium font-mono">
                                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                                  <span>{invoiceComplaints.length} Complain</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">Normal</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => handleOpenComplaintModal(sale)}
                                  className="px-2 py-1 rounded bg-rose-950/70 hover:bg-rose-900 text-[10px] font-semibold text-rose-300 border border-rose-800/80 transition-colors flex items-center space-x-1 shadow-xs"
                                  title="Log customer grievance, shortage, or salesman remarks"
                                >
                                  <MessageSquareWarning className="w-3 h-3 text-rose-400" />
                                  <span>+ Complain</span>
                                </button>
                                <button
                                  onClick={() => setReceiptPreviewSale(sale)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-medium text-slate-200 border border-slate-700 transition-colors flex items-center space-x-1"
                                  title="View printed invoice layout"
                                >
                                  <Printer className="w-3 h-3 text-slate-400" />
                                  <span>Print</span>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Detailed Line Items */}
                          {isExpanded && (
                            <tr className="bg-slate-900/90">
                              <td colSpan={9} className="p-3 pl-10 border-b border-slate-800">
                                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                    <div className="text-xs font-semibold text-emerald-400 flex items-center space-x-2">
                                      <ShoppingCart className="w-3.5 h-3.5" />
                                      <span>Dispensed Medicines in Invoice #{sale.InvoiceNumber}</span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 font-mono">
                                      Payment Method: {sale.PaymentMethod} | Total: {formatCurrency(sale.TotalAmount)}
                                    </div>
                                  </div>

                                  {/* Items Table */}
                                  <table className="w-full text-left text-xs">
                                    <thead>
                                      <tr className="text-slate-400 border-b border-slate-800/80 uppercase text-[9px]">
                                        <th className="py-1">#</th>
                                        <th className="py-1">Medicine Name</th>
                                        <th className="py-1">Batch Number</th>
                                        <th className="py-1">Expiry</th>
                                        <th className="py-1 text-center">Qty</th>
                                        <th className="py-1 text-right">Unit MRP</th>
                                        <th className="py-1 text-right">Line Total</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                      {(sale.Items || []).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-900/50">
                                          <td className="py-1.5 text-slate-400 font-mono">{idx + 1}</td>
                                          <td className="py-1.5 font-medium text-slate-200">
                                            {item.TradeName}
                                          </td>
                                          <td className="py-1.5 font-mono text-cyan-300">{item.BatchNumber}</td>
                                          <td className="py-1.5 font-mono text-slate-400">{item.ExpiryDate}</td>
                                          <td className="py-1.5 text-center font-mono font-bold text-white">
                                            {item.Quantity}
                                          </td>
                                          <td className="py-1.5 text-right font-mono text-slate-300">
                                            {formatCurrency(item.UnitPrice)}
                                          </td>
                                          <td className="py-1.5 text-right font-mono font-bold text-emerald-400">
                                            {formatCurrency(item.TotalPrice)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>

                                  {/* If there are complaints against this invoice */}
                                  {invoiceComplaints.length > 0 && (
                                    <div className="mt-3 p-2.5 rounded bg-rose-950/40 border border-rose-900/70 space-y-2">
                                      <div className="text-[11px] font-bold text-rose-300 flex items-center space-x-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                                        <span>Customer Complaints Recorded ({invoiceComplaints.length})</span>
                                      </div>
                                      <div className="space-y-1.5">
                                        {invoiceComplaints.map((c) => (
                                          <div
                                            key={c.ComplaintID}
                                            className="p-2 rounded bg-slate-950/80 border border-rose-900/50 text-xs"
                                          >
                                            <div className="flex items-center justify-between">
                                              <span className="font-semibold text-rose-200">
                                                [{c.Category}] {c.ShortOrMissedMedicine ? `Detail: ${c.ShortOrMissedMedicine}` : ''}
                                              </span>
                                              <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-rose-900/80 text-rose-200 font-mono">
                                                {c.Status}
                                              </span>
                                            </div>
                                            <p className="text-[11px] text-slate-300 mt-1 italic">"{c.IssueDescription}"</p>
                                            {c.AdminRemarks && (
                                              <div className="text-[10px] text-amber-300 mt-1">
                                                <strong>Admin Assessment:</strong> {c.AdminRemarks}
                                              </div>
                                            )}
                                            {c.SalesmanCoachingNotes && (
                                              <div className="text-[10px] text-cyan-300 mt-0.5">
                                                <strong>Coaching Guidance:</strong> {c.SalesmanCoachingNotes}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUB-TAB 2: DAILY SALES LEDGER */}
        {activeSubTab === 'daily' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>Day-by-Day Aggregated Sales Ledger</span>
              </h2>
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-semibold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-center">Invoices Count</th>
                    <th className="py-2.5 px-3 text-center">Medicine Units</th>
                    <th className="py-2.5 px-3 text-right">Settled Payment</th>
                    <th className="py-2.5 px-3 text-right">Due / Credit</th>
                    <th className="py-2.5 px-3 text-right">Gross Sales</th>
                    <th className="py-2.5 px-3 text-right">Average Bill</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {dailyBreakdown.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-mono font-bold text-white flex items-center space-x-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-400" />
                        <span>{row.date}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                        {row.count} receipts
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-purple-300">
                        {row.items} units
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-400">
                        {formatCurrency(row.paid)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-400">
                        {formatCurrency(row.due)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                        {formatCurrency(row.revenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-cyan-300">
                        {formatCurrency(row.count > 0 ? row.revenue / row.count : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUB-TAB 3: LIVE POS STREAM */}
        {activeSubTab === 'live' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 -ml-2.5" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Live POS Stream & Real-Time Checkout Telemetry
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Listening on Counter 1, Counter 2, Counter 3
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSales.slice(0, 12).map((sale) => (
                <div
                  key={sale.SaleID}
                  className="p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all space-y-2 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {sale.InvoiceNumber}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {sale.SaleDate.substring(11, 16) || 'Just now'}
                    </span>
                  </div>

                  <div className="text-xs font-medium text-slate-200">
                    {sale.CustomerName}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-1.5">
                    <span>{sale.TerminalName || 'Counter 1'}</span>
                    <span className="text-amber-300 font-medium">{sale.SalesmanName}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono pt-1">
                    <span className="text-slate-400">{sale.Items?.length || 0} medicines</span>
                    <span className="text-sm font-bold text-white">
                      {formatCurrency(sale.FinalAmount || sale.TotalAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SUB-TAB 4: COUNTER / TERMINAL WISE SUMMARY */}
        {activeSubTab === 'terminals' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {terminalBreakdown.map((t) => {
                const percentShare =
                  summaryKpis.totalRevenue > 0
                    ? Math.round((t.revenue / summaryKpis.totalRevenue) * 100)
                    : 0;

                return (
                  <div
                    key={t.terminalName}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Store className="w-4 h-4 text-purple-400" />
                        <h3 className="text-xs font-bold text-white">{t.terminalName}</h3>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800/80">
                        {percentShare}% share
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block">Total Revenue</span>
                        <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                          {formatCurrency(t.revenue)}
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-900 border border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block">Bills Issued</span>
                        <span className="text-sm font-bold text-slate-200 mt-0.5 block">
                          {t.count} receipts
                        </span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
                      <span>Settled: {formatCurrency(t.paid)}</span>
                      <span>Due: {formatCurrency(t.due)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SUB-TAB 5: SALESMAN PERFORMANCE & COACHING */}
        {activeSubTab === 'salesmen' && (
          <div className="space-y-3">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Salesman Ledger & Customer Grievance Correlation</span>
              </h2>

              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-[10px] font-semibold">
                    <th className="py-2.5 px-3">Salesman Name</th>
                    <th className="py-2.5 px-3 text-center">Invoices Cut</th>
                    <th className="py-2.5 px-3 text-right">Total Sales</th>
                    <th className="py-2.5 px-3 text-right">Avg Ticket Size</th>
                    <th className="py-2.5 px-3 text-right">Due Issued</th>
                    <th className="py-2.5 px-3 text-center">Complaints Against</th>
                    <th className="py-2.5 px-3 text-center">Quality Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {salesmanBreakdown.map((sm) => (
                    <tr key={sm.salesmanName} className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-200 flex items-center space-x-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>{sm.salesmanName}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                        {sm.count}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(sm.revenue)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-cyan-300">
                        {formatCurrency(sm.avgTicket)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-400">
                        {formatCurrency(sm.dueIssued)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {sm.complaintsCount > 0 ? (
                          <span className="font-mono font-bold text-rose-400 bg-rose-950 px-2 py-0.5 rounded border border-rose-800">
                            {sm.complaintsCount} Incidents
                          </span>
                        ) : (
                          <span className="font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                            0 Grievances
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {sm.complaintsCount > 0 ? (
                          <span className="text-[10px] text-amber-300 bg-amber-950 px-2 py-0.5 rounded border border-amber-800/80">
                            Coaching Needed
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/80">
                            High Quality
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* COMPLAINT & REMARK LOGGING MODAL */}
      {complaintModalSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-rose-400">
                <MessageSquareWarning className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">
                  Log Customer Complaint & Salesman Coaching Note
                </h3>
              </div>
              <button
                onClick={() => setComplaintModalSale(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmitComplaint} className="p-4 space-y-3.5 text-xs">
              {/* Receipt Reference Banner */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">INVOICE #</span>
                  <span className="font-bold text-white">{complaintModalSale.InvoiceNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">CUSTOMER</span>
                  <span className="font-medium text-slate-200">{complaintModalSale.CustomerName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">SALESMAN</span>
                  <span className="font-medium text-amber-300">{complaintModalSale.SalesmanName || 'General Staff'}</span>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Grievance Category *
                </label>
                <select
                  value={complaintCategory}
                  onChange={(e) => setComplaintCategory(e.target.value as ComplaintCategory)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="Medicine Missed / Short Dispensed">Medicine Missed / Short Dispensed</option>
                  <option value="Wrong Medicine Dispensed">Wrong Medicine Dispensed</option>
                  <option value="Damaged / Expired Batch">Damaged / Expired Batch</option>
                  <option value="Overcharge / Billing Error">Overcharge / Billing Error</option>
                  <option value="Salesman Conduct / Delay">Salesman Conduct / Delay</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Shortage or Missed Medicine details (if applicable) */}
              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-amber-300 block">
                  Shortage / Missed Medicine Item (Optional)
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-400 mb-0.5">Medicine Name</label>
                    <select
                      value={complaintMissedMed}
                      onChange={(e) => setComplaintMissedMed(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    >
                      <option value="">-- None / General Dispute --</option>
                      {(complaintModalSale.Items || []).map((i) => (
                        <option key={i.MedicineID} value={i.TradeName}>
                          {i.TradeName} (Sold: {i.Quantity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Missed Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={complaintMissedQty}
                      onChange={(e) => setComplaintMissedQty(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Customer Grievance Description */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Customer Grievance / Complain Details *
                </label>
                <textarea
                  rows={2}
                  value={complaintDesc}
                  onChange={(e) => setComplaintDesc(e.target.value)}
                  placeholder="e.g. Customer states 1 strip of Paracetamol was paid for but missing from the medicine packet when unpacked at home..."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  required
                />
              </div>

              {/* Admin Remarks */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Admin Internal Assessment & Remarks
                </label>
                <textarea
                  rows={2}
                  value={complaintAdminRemarks}
                  onChange={(e) => setComplaintAdminRemarks(e.target.value)}
                  placeholder="e.g. Inventory count verified; 1 strip excess was found in shelf B-02. Verified salesman oversight during rush hour."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Salesman Coaching Guidance */}
              <div>
                <label className="block text-cyan-300 font-semibold mb-1">
                  Salesman Coaching & Prevention Note
                </label>
                <textarea
                  rows={2}
                  value={complaintCoachingNotes}
                  onChange={(e) => setComplaintCoachingNotes(e.target.value)}
                  placeholder="e.g. Advise salesman to cross-tick invoice items physically in front of customer before handing over the bag."
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setComplaintModalSale(null)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold transition-colors flex items-center space-x-1.5 shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Save Complaint & Coaching Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIPT PREVIEW MODAL */}
      {receiptPreviewSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-white text-slate-900 rounded-lg shadow-2xl max-w-sm w-full p-4 font-mono text-xs overflow-hidden flex flex-col">
            <div className="flex justify-between items-center border-b pb-2 mb-2">
              <span className="font-bold text-sm">{receiptSettings.pharmacyName}</span>
              <button
                onClick={() => setReceiptPreviewSale(null)}
                className="text-slate-500 hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-[10px] text-slate-600 text-center mb-2">
              <p>{receiptSettings.address}</p>
              <p>Phone: {receiptSettings.phone}</p>
            </div>

            <div className="border-t border-b border-dashed py-1.5 my-1 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Invoice: {receiptPreviewSale.InvoiceNumber}</span>
                <span>{receiptPreviewSale.SaleDate.substring(0, 10)}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer: {receiptPreviewSale.CustomerName}</span>
                <span>Counter: {receiptPreviewSale.TerminalName || 'Counter 1'}</span>
              </div>
              <div className="flex justify-between">
                <span>Salesman: {receiptPreviewSale.SalesmanName}</span>
                <span>Time: {receiptPreviewSale.SaleDate.substring(11, 16)}</span>
              </div>
            </div>

            <table className="w-full text-left my-2 text-[10px]">
              <thead>
                <tr className="border-b">
                  <th>Item</th>
                  <th className="text-center">Qty</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {(receiptPreviewSale.Items || []).map((item, i) => (
                  <tr key={i}>
                    <td className="truncate max-w-[120px]">{item.TradeName}</td>
                    <td className="text-center">{item.Quantity}</td>
                    <td className="text-right">{formatCurrency(item.UnitPrice)}</td>
                    <td className="text-right">{formatCurrency(item.TotalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-dashed pt-1.5 space-y-0.5 text-[10px] font-bold">
              <div className="flex justify-between">
                <span>Total:</span>
                <span>{formatCurrency(receiptPreviewSale.TotalAmount)}</span>
              </div>
              {receiptPreviewSale.DiscountAmount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(receiptPreviewSale.DiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs pt-1 border-t">
                <span>Final Payable:</span>
                <span>{formatCurrency(receiptPreviewSale.FinalAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-600 font-normal">
                <span>Paid ({receiptPreviewSale.PaymentMethod}):</span>
                <span>{formatCurrency(receiptPreviewSale.PaidAmount || 0)}</span>
              </div>
              {(receiptPreviewSale.DueAmount || 0) > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Due Balance:</span>
                  <span>{formatCurrency(receiptPreviewSale.DueAmount)}</span>
                </div>
              )}
            </div>

            <div className="text-center text-[9px] text-slate-500 mt-3 pt-2 border-t">
              {receiptSettings.footerMessage}
            </div>

            <button
              onClick={() => {
                showToast(`Printing invoice #${receiptPreviewSale.InvoiceNumber} to ${receiptSettings.printerDevice || 'Default POS Printer'}...`, 'info', 'Printing');
                printThermalReceipt(receiptPreviewSale, receiptSettings);
                setReceiptPreviewSale(null);
              }}
              className="mt-3 w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Direct Print Receipt</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
