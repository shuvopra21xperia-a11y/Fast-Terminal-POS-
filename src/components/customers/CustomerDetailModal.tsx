/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Customer Detail Modal - All Data & History View
 * Features:
 * - Date-wise sale receipts
 * - Receipts searchable by receipt number AND by medicine name
 * - Comprehensive medicine buy history (aggregated medicines purchased across receipts)
 * - Date-wise due collections & payment history
 * - Printable account statement / running ledger
 * - Quick due collection trigger
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Sale, DueCollection, Medicine } from '../../types/pharmacy';
import {
  X,
  Users,
  Phone,
  MapPin,
  Award,
  DollarSign,
  Calendar,
  Search,
  Receipt,
  FileText,
  CreditCard,
  Package,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Printer,
  Plus,
  ArrowUpDown,
  History,
  Clock,
  Sparkles,
} from 'lucide-react';

interface CustomerDetailModalProps {
  customer: Customer;
  onClose: () => void;
  sales: Sale[];
  dueCollections: DueCollection[];
  medicines: Medicine[];
  formatCurrency: (amount: number) => string;
  onOpenCollect: (customer: Customer) => void;
}

type TabType = 'receipts' | 'buyHistory' | 'dueCollections' | 'statement';

export const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({
  customer,
  onClose,
  sales,
  dueCollections,
  medicines,
  formatCurrency,
  onOpenCollect,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('receipts');

  // Search and filter states for Receipts
  const [receiptSearch, setReceiptSearch] = useState('');
  const [receiptDateFilter, setReceiptDateFilter] = useState<'all' | '7days' | '30days' | 'thisYear'>('all');
  const [receiptStatusFilter, setReceiptStatusFilter] = useState<'all' | 'due' | 'paid'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [expandedReceipts, setExpandedReceipts] = useState<Record<string, boolean>>({});

  // Search states for Buy History & Due Collections
  const [buyHistorySearch, setBuyHistorySearch] = useState('');
  const [collectionSearch, setCollectionSearch] = useState('');
  const [collectionMethodFilter, setCollectionMethodFilter] = useState<'all' | 'Cash' | 'Bank Transfer' | 'MFS'>('all');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Customer Sales (Receipts)
  const customerSales = useMemo(() => {
    return sales.filter(
      (s) =>
        s.CustomerID === customer.CustomerID ||
        (s.CustomerName && s.CustomerName.toLowerCase() === customer.Name.toLowerCase()) ||
        (customer.Phone !== 'N/A' && s.CustomerPhone === customer.Phone)
    );
  }, [sales, customer]);

  // Filtered Sales Receipts (Searchable by Receipt # AND Medicine Name, Date-wise)
  const filteredSales = useMemo(() => {
    const query = receiptSearch.trim().toLowerCase();
    const now = new Date();

    return customerSales
      .filter((s) => {
        // Status filter
        if (receiptStatusFilter === 'due' && (s.DueAmount || 0) <= 0) return false;
        if (receiptStatusFilter === 'paid' && (s.DueAmount || 0) > 0) return false;

        // Date filter
        if (receiptDateFilter !== 'all') {
          const sDate = new Date(s.SaleDate);
          const diffDays = (now.getTime() - sDate.getTime()) / (1000 * 3600 * 24);
          if (receiptDateFilter === '7days' && diffDays > 7) return false;
          if (receiptDateFilter === '30days' && diffDays > 30) return false;
          if (receiptDateFilter === 'thisYear' && sDate.getFullYear() !== now.getFullYear()) return false;
        }

        // Search query: by receipt number OR by medicine name in items
        if (!query) return true;

        const matchesReceiptNumber = (s.InvoiceNumber || s.SaleID).toLowerCase().includes(query);
        const matchesSalesman = (s.SalesmanName || '').toLowerCase().includes(query);

        const matchesMedicineName = s.Items.some((item) => {
          const tradeMatch = item.TradeName.toLowerCase().includes(query);
          const genericMatch = (item.GenericName || '').toLowerCase().includes(query);
          const batchMatch = (item.BatchNumber || '').toLowerCase().includes(query);
          return tradeMatch || genericMatch || batchMatch;
        });

        return matchesReceiptNumber || matchesSalesman || matchesMedicineName;
      })
      .sort((a, b) => {
        const timeA = new Date(a.SaleDate).getTime();
        const timeB = new Date(b.SaleDate).getTime();
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
      });
  }, [customerSales, receiptSearch, receiptDateFilter, receiptStatusFilter, sortOrder]);

  // Auto-expand receipts when searching by medicine name
  useEffect(() => {
    if (receiptSearch.trim()) {
      const newExpanded: Record<string, boolean> = {};
      filteredSales.forEach((s) => {
        newExpanded[s.SaleID] = true;
      });
      setExpandedReceipts(newExpanded);
    }
  }, [receiptSearch, filteredSales]);

  const toggleReceiptExpand = (id: string) => {
    setExpandedReceipts((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Medicine Buy History: Aggregated list of all medicines this customer has ever purchased
  const medicineBuyHistory = useMemo(() => {
    type AggregatedMedicine = {
      medicineId: string;
      tradeName: string;
      genericName: string;
      group: string;
      totalQuantity: number;
      purchasesCount: number;
      lastPurchaseDate: string;
      lastPrice: number;
      totalSpent: number;
      batches: string[];
    };

    const map = new Map<string, AggregatedMedicine>();

    customerSales.forEach((sale) => {
      sale.Items.forEach((item) => {
        const key = item.MedicineID || item.TradeName;
        const existing = map.get(key);

        if (!existing) {
          map.set(key, {
            medicineId: item.MedicineID,
            tradeName: item.TradeName,
            genericName: item.GenericName || 'N/A',
            group: item.Group || 'General',
            totalQuantity: item.Quantity,
            purchasesCount: 1,
            lastPurchaseDate: sale.SaleDate,
            lastPrice: item.UnitPrice,
            totalSpent: item.TotalPrice,
            batches: item.BatchNumber ? [item.BatchNumber] : [],
          });
        } else {
          existing.totalQuantity += item.Quantity;
          existing.purchasesCount += 1;
          existing.totalSpent += item.TotalPrice;
          if (new Date(sale.SaleDate) > new Date(existing.lastPurchaseDate)) {
            existing.lastPurchaseDate = sale.SaleDate;
            existing.lastPrice = item.UnitPrice;
          }
          if (item.BatchNumber && !existing.batches.includes(item.BatchNumber)) {
            existing.batches.push(item.BatchNumber);
          }
        }
      });
    });

    const q = buyHistorySearch.trim().toLowerCase();
    return Array.from(map.values())
      .filter((m) => {
        if (!q) return true;
        return (
          m.tradeName.toLowerCase().includes(q) ||
          m.genericName.toLowerCase().includes(q) ||
          m.group.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.lastPurchaseDate).getTime() - new Date(a.lastPurchaseDate).getTime());
  }, [customerSales, buyHistorySearch]);

  // Due Collections & Payment History
  const collectionHistory = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      type: 'Direct Due Settlement' | 'Sale Counter Payment';
      reference: string;
      method: string;
      notes: string;
      amount: number;
      actor: string;
    }> = [];

    // 1. Direct due collections
    dueCollections
      .filter((c) => c.EntityType === 'Customer' && (c.EntityID === customer.CustomerID || c.EntityName === customer.Name))
      .forEach((c) => {
        list.push({
          id: c.CollectionID,
          date: c.CollectionDate,
          type: 'Direct Due Settlement',
          reference: c.CollectionID,
          method: c.PaymentMethod,
          notes: c.Notes || 'Customer outstanding balance payment',
          amount: c.Amount,
          actor: c.ReceivedBy || 'Pharmacist Staff',
        });
      });

    // 2. Initial payments made at time of sale
    customerSales
      .filter((s) => (s.PaidAmount || 0) > 0)
      .forEach((s) => {
        list.push({
          id: `PAY-REC-${s.SaleID}`,
          date: s.SaleDate,
          type: 'Sale Counter Payment',
          reference: s.InvoiceNumber || s.SaleID,
          method: s.PaymentMethod || 'Cash',
          notes: `Counter payment for Receipt ${s.InvoiceNumber || s.SaleID} (${s.Items?.length || 0} items)`,
          amount: s.PaidAmount,
          actor: s.SalesmanName || 'POS Terminal',
        });
      });

    // Search and filter
    const q = collectionSearch.trim().toLowerCase();
    return list
      .filter((item) => {
        if (collectionMethodFilter !== 'all' && item.method !== collectionMethodFilter) return false;
        if (!q) return true;
        return (
          item.reference.toLowerCase().includes(q) ||
          item.notes.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          item.method.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dueCollections, customerSales, customer, collectionSearch, collectionMethodFilter]);

  // Financial aggregates
  const totalBilledAmount = customerSales.reduce((sum, s) => sum + (s.FinalAmount || 0), 0);
  const totalPaidSum = collectionHistory.reduce((sum, c) => sum + c.amount, 0);
  const totalReceiptsCount = customerSales.length;
  const unsettledReceiptsCount = customerSales.filter((s) => (s.DueAmount || 0) > 0).length;

  // Running Ledger Statement for Tab 4
  const accountStatement = useMemo(() => {
    type StatementRow = {
      id: string;
      date: string;
      description: string;
      refNumber: string;
      type: 'SALE' | 'COLLECTION';
      debit: number; // Sale increases receivable
      credit: number; // Payment decreases receivable
      runningBalance: number;
    };

    const rows: Array<Omit<StatementRow, 'runningBalance'>> = [];

    // Add sales as Debits
    customerSales.forEach((s) => {
      rows.push({
        id: s.SaleID,
        date: s.SaleDate,
        description: `Dispensed Medicines (${s.Items.map((i) => i.TradeName).slice(0, 2).join(', ')}${s.Items.length > 2 ? '...' : ''})`,
        refNumber: s.InvoiceNumber || s.SaleID,
        type: 'SALE',
        debit: s.FinalAmount,
        credit: 0,
      });
    });

    // Add direct due collections as Credits
    dueCollections
      .filter((c) => c.EntityType === 'Customer' && (c.EntityID === customer.CustomerID || c.EntityName === customer.Name))
      .forEach((c) => {
        rows.push({
          id: c.CollectionID,
          date: c.CollectionDate,
          description: `Due Collection (${c.PaymentMethod}) - ${c.Notes}`,
          refNumber: c.CollectionID,
          type: 'COLLECTION',
          debit: 0,
          credit: c.Amount,
        });
      });

    // Add sale initial payments as Credits
    customerSales
      .filter((s) => (s.PaidAmount || 0) > 0)
      .forEach((s) => {
        rows.push({
          id: `PAID-${s.SaleID}`,
          date: s.SaleDate,
          description: `Cash/Card Counter Settlement for ${s.InvoiceNumber || s.SaleID}`,
          refNumber: s.InvoiceNumber || s.SaleID,
          type: 'COLLECTION',
          debit: 0,
          credit: s.PaidAmount,
        });
      });

    // Sort chronologically ascending
    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let balance = 0;
    return rows.map((r) => {
      balance += r.debit - r.credit;
      return {
        ...r,
        runningBalance: Math.max(0, balance),
      };
    });
  }, [customerSales, dueCollections, customer]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 backdrop-blur-xs select-none">
      <div className="bg-slate-950 border border-slate-700 rounded-xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden text-xs">
        {/* Modal Top Header Bar */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-700/50 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {customer.Name}
                </h2>
                <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                  {customer.CustomerID}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-950 text-purple-300 border border-purple-800/60 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-purple-400" />
                  <span>{customer.LoyaltyPoints} Loyalty Points</span>
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 mt-1 flex-wrap">
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {customer.Phone}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  {customer.Address}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {customer.TotalDue > 0 ? (
              <button
                onClick={() => onOpenCollect(customer)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                <span>Collect Due Balance</span>
              </button>
            ) : (
              <span className="px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800/40 text-emerald-400 font-medium text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Outstanding Due</span>
              </span>
            )}

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors"
              title="Print Customer Profile & Statement"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mini KPI Dashboard for this Customer */}
        <div className="bg-slate-900/60 border-b border-slate-800 p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">
              Current Due Balance
            </span>
            <span
              className={`text-base font-bold font-mono block mt-0.5 ${
                customer.TotalDue > 0 ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {formatCurrency(customer.TotalDue)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {customer.TotalDue > 0 ? `${unsettledReceiptsCount} receipts pending` : 'All cleared'}
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">
              Lifetime Purchases
            </span>
            <span className="text-base font-bold text-white font-mono block mt-0.5">
              {formatCurrency(totalBilledAmount)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {totalReceiptsCount} sales receipts
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">
              Total Dues Collected
            </span>
            <span className="text-base font-bold text-emerald-400 font-mono block mt-0.5">
              {formatCurrency(totalPaidSum)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {collectionHistory.length} recorded payments
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">
              Settlement Rate
            </span>
            <span className="text-base font-bold text-blue-400 font-mono block mt-0.5">
              {totalBilledAmount > 0
                ? `${Math.min(100, Math.round((totalPaidSum / totalBilledAmount) * 100))}%`
                : '100%'}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Paid vs billed ratio
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">
              Medicines Bought
            </span>
            <span className="text-base font-bold text-indigo-400 font-mono block mt-0.5">
              {medicineBuyHistory.length}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Unique items dispensed
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">
              Loyalty Credits
            </span>
            <span className="text-base font-bold text-purple-400 font-mono block mt-0.5">
              {customer.LoyaltyPoints}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Reward member tier
            </span>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between px-4 bg-slate-950 border-b border-slate-800 overflow-x-auto">
          <div className="flex items-center gap-1 py-1.5">
            <button
              onClick={() => setActiveTab('receipts')}
              className={`px-3 py-1.5 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'receipts'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Sale Receipts ({customerSales.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('buyHistory')}
              className={`px-3 py-1.5 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'buyHistory'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Medicine Buy History ({medicineBuyHistory.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('dueCollections')}
              className={`px-3 py-1.5 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'dueCollections'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Due Collections History ({collectionHistory.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('statement')}
              className={`px-3 py-1.5 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'statement'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Account Statement (Ledger)</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Sale Receipts (Date-Wise, Searchable by Receipt # & Medicine Name) */}
        {activeTab === 'receipts' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search and Filters Bar */}
            <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Dual Search Input */}
              <div className="relative flex-1 min-w-[280px] max-w-lg">
                <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={receiptSearch}
                  onChange={(e) => setReceiptSearch(e.target.value)}
                  placeholder="Search by Receipt # (e.g. REC-2026-1001) or Medicine Name (e.g. Napa, Seclo, Zimax)..."
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                {receiptSearch && (
                  <button
                    onClick={() => setReceiptSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Date Filter & Status Filter */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5">
                  <span className="text-[10px] text-slate-500 px-2 font-medium">Date:</span>
                  <button
                    onClick={() => setReceiptDateFilter('all')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      receiptDateFilter === 'all'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setReceiptDateFilter('7days')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      receiptDateFilter === '7days'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    7 Days
                  </button>
                  <button
                    onClick={() => setReceiptDateFilter('30days')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      receiptDateFilter === '30days'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    30 Days
                  </button>
                  <button
                    onClick={() => setReceiptDateFilter('thisYear')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      receiptDateFilter === 'thisYear'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    This Year
                  </button>
                </div>

                <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5">
                  <button
                    onClick={() => setReceiptStatusFilter('all')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      receiptStatusFilter === 'all'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Status
                  </button>
                  <button
                    onClick={() => setReceiptStatusFilter('due')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      receiptStatusFilter === 'due'
                        ? 'bg-amber-600 text-white font-medium'
                        : 'text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    Due
                  </button>
                  <button
                    onClick={() => setReceiptStatusFilter('paid')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      receiptStatusFilter === 'paid'
                        ? 'bg-emerald-700 text-white font-medium'
                        : 'text-emerald-400 hover:text-emerald-300'
                    }`}
                  >
                    Paid
                  </button>
                </div>

                <button
                  onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
                  className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1"
                >
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  <span>{sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
                </button>
              </div>
            </div>

            {/* Receipts List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredSales.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Receipt className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
                  <p className="text-sm font-medium text-slate-400">No sale receipts match your search criteria</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Try searching a different receipt number or medicine name, or clear active filters.
                  </p>
                  {receiptSearch && (
                    <button
                      onClick={() => setReceiptSearch('')}
                      className="mt-3 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                    >
                      Clear search "{receiptSearch}"
                    </button>
                  )}
                </div>
              ) : (
                filteredSales.map((sale) => {
                  const isExpanded = !!expandedReceipts[sale.SaleID];
                  const hasDue = (sale.DueAmount || 0) > 0;
                  const dateStr = new Date(sale.SaleDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                  const timeStr = new Date(sale.SaleDate).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  // Check if this receipt matched specifically via medicine name
                  const matchedItems = receiptSearch.trim()
                    ? sale.Items.filter((i) => {
                        const q = receiptSearch.trim().toLowerCase();
                        return (
                          i.TradeName.toLowerCase().includes(q) ||
                          (i.GenericName || '').toLowerCase().includes(q) ||
                          (i.BatchNumber || '').toLowerCase().includes(q)
                        );
                      })
                    : [];

                  return (
                    <div
                      key={sale.SaleID}
                      className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden transition-all hover:border-slate-700 shadow-sm"
                    >
                      {/* Receipt Summary Header */}
                      <div
                        onClick={() => toggleReceiptExpand(sale.SaleID)}
                        className="p-3 bg-slate-900/70 hover:bg-slate-900 flex flex-wrap items-center justify-between gap-3 cursor-pointer border-b border-slate-850"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className="text-slate-400 hover:text-white"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </button>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-white text-sm font-mono tracking-tight">
                                {sale.InvoiceNumber || sale.SaleID}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                                {sale.SaleID}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                {sale.PaymentMethod || 'Cash'}
                              </span>
                              {matchedItems.length > 0 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800/50 flex items-center gap-1">
                                  <Package className="w-3 h-3" />
                                  <span>Contains {matchedItems.length} matched medicine(s)</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>{dateStr} at {timeStr}</span>
                              <span className="text-slate-600">·</span>
                              <span>Dispensed by: {sale.SalesmanName || 'Pharmacist'}</span>
                              <span className="text-slate-600">·</span>
                              <span>{sale.Items.length} items</span>
                            </div>
                          </div>
                        </div>

                        {/* Receipt Financial Amounts */}
                        <div className="flex items-center gap-4 text-right">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 uppercase block">Total Amount</span>
                            <span className="font-mono font-bold text-white text-sm">
                              {formatCurrency(sale.FinalAmount)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 uppercase block">Paid</span>
                            <span className="font-mono text-emerald-400 font-semibold">
                              {formatCurrency(sale.PaidAmount)}
                            </span>
                          </div>

                          <div className="text-right min-w-[90px]">
                            <span className="text-[10px] text-slate-500 uppercase block">Balance Due</span>
                            <span
                              className={`font-mono font-bold text-sm ${
                                hasDue ? 'text-amber-400' : 'text-slate-400'
                              }`}
                            >
                              {formatCurrency(sale.DueAmount)}
                            </span>
                          </div>

                          <div className="shrink-0">
                            {hasDue ? (
                              <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800/60 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Due: {formatCurrency(sale.DueAmount)}</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Paid in Full</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expandable Line Items Breakdown */}
                      {isExpanded && (
                        <div className="p-3 bg-slate-950 overflow-x-auto">
                          <div className="text-[11px] font-medium text-slate-400 mb-2 flex items-center justify-between">
                            <span>Dispensed Medicine Line Items:</span>
                            <div className="flex items-center gap-3 text-slate-500 font-mono text-[10px]">
                              <span>Gross: {formatCurrency(sale.TotalAmount)}</span>
                              <span>Discount: {formatCurrency(sale.DiscountAmount)}</span>
                              <span>Net: {formatCurrency(sale.FinalAmount)}</span>
                            </div>
                          </div>

                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-900 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
                                <th className="p-2">Medicine Trade & Generic</th>
                                <th className="p-2">Group</th>
                                <th className="p-2">Batch #</th>
                                <th className="p-2">Expiry</th>
                                <th className="p-2 text-center">Qty Dispensed</th>
                                <th className="p-2 text-right">Unit MRP</th>
                                <th className="p-2 text-right">Discount</th>
                                <th className="p-2 text-right">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850">
                              {sale.Items.map((item) => {
                                const q = receiptSearch.trim().toLowerCase();
                                const isMatchedMedicine =
                                  q &&
                                  (item.TradeName.toLowerCase().includes(q) ||
                                    (item.GenericName || '').toLowerCase().includes(q) ||
                                    (item.BatchNumber || '').toLowerCase().includes(q));

                                return (
                                  <tr
                                    key={item.SaleItemID}
                                    className={`transition-colors ${
                                      isMatchedMedicine
                                        ? 'bg-amber-950/40 text-white ring-1 ring-amber-500/50'
                                        : 'hover:bg-slate-900/60 text-slate-300'
                                    }`}
                                  >
                                    <td className="p-2">
                                      <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                                        <span>{item.TradeName}</span>
                                        {isMatchedMedicine && (
                                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500 text-slate-950 font-bold uppercase">
                                            Match
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-500">
                                        {item.GenericName || 'Pharmaceutical Item'}
                                      </div>
                                    </td>

                                    <td className="p-2">
                                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-850 text-slate-300 border border-slate-750">
                                        {item.Group || 'General'}
                                      </span>
                                    </td>

                                    <td className="p-2 font-mono text-slate-300">{item.BatchNumber || 'N/A'}</td>

                                    <td className="p-2 font-mono text-slate-400">{item.ExpiryDate || 'N/A'}</td>

                                    <td className="p-2 text-center font-mono font-bold text-slate-200">
                                      {item.Quantity} {item.DispenseUnit || 'Pcs'}
                                    </td>

                                    <td className="p-2 text-right font-mono text-slate-300">
                                      {formatCurrency(item.UnitPrice)}
                                    </td>

                                    <td className="p-2 text-right font-mono text-emerald-400">
                                      {item.DiscountAmount > 0 ? formatCurrency(item.DiscountAmount) : '—'}
                                    </td>

                                    <td className="p-2 text-right font-mono font-bold text-slate-100">
                                      {formatCurrency(item.TotalPrice)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Summary Bar for Receipts */}
            <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing <span className="font-bold text-white">{filteredSales.length}</span> of {customerSales.length} sale receipts
                {receiptSearch && <span className="ml-1 text-emerald-400 font-medium">(Filtered by "{receiptSearch}")</span>}
              </div>
              <div className="flex items-center gap-4 font-mono text-xs">
                <span>
                  Billed: <span className="font-bold text-white">{formatCurrency(filteredSales.reduce((s, r) => s + (r.FinalAmount || 0), 0))}</span>
                </span>
                <span>
                  Paid: <span className="font-bold text-emerald-400">{formatCurrency(filteredSales.reduce((s, r) => s + (r.PaidAmount || 0), 0))}</span>
                </span>
                <span>
                  Due: <span className="font-bold text-amber-400">{formatCurrency(filteredSales.reduce((s, r) => s + (r.DueAmount || 0), 0))}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Medicine Buy History (All Medicines Bought) */}
        {activeTab === 'buyHistory' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filter Bar */}
            <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={buyHistorySearch}
                  onChange={(e) => setBuyHistorySearch(e.target.value)}
                  placeholder="Filter bought medicines by Trade Name, Generic, or Group..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div className="text-slate-400 text-xs">
                Total Unique Medicines: <span className="font-bold text-white">{medicineBuyHistory.length}</span>
              </div>
            </div>

            {/* Medicine Buy History Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="p-3">Medicine & Generic</th>
                      <th className="p-3">Therapeutic Group</th>
                      <th className="p-3 text-center">Total Qty Bought</th>
                      <th className="p-3 text-center">Purchase Frequency</th>
                      <th className="p-3">Last Purchased On</th>
                      <th className="p-3 text-right">Last Price Paid</th>
                      <th className="p-3 text-right">Total Spent</th>
                      <th className="p-3">Batches Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {medicineBuyHistory.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">
                          No medicine purchase history recorded for this customer.
                        </td>
                      </tr>
                    ) : (
                      medicineBuyHistory.map((item) => {
                        const dateFormatted = new Date(item.lastPurchaseDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });

                        return (
                          <tr key={item.medicineId || item.tradeName} className="hover:bg-slate-900/60 transition-colors">
                            <td className="p-3">
                              <div className="font-semibold text-white">{item.tradeName}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{item.genericName}</div>
                            </td>

                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-850 text-slate-300 border border-slate-700">
                                {item.group}
                              </span>
                            </td>

                            <td className="p-3 text-center font-mono font-bold text-white text-sm">
                              {item.totalQuantity} units
                            </td>

                            <td className="p-3 text-center font-mono text-slate-300">
                              {item.purchasesCount} receipt(s)
                            </td>

                            <td className="p-3 font-mono text-slate-300">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-slate-500" />
                                <span>{dateFormatted}</span>
                              </div>
                            </td>

                            <td className="p-3 text-right font-mono text-slate-300">
                              {formatCurrency(item.lastPrice)}
                            </td>

                            <td className="p-3 text-right font-mono font-bold text-emerald-400 text-sm">
                              {formatCurrency(item.totalSpent)}
                            </td>

                            <td className="p-3 text-slate-400 font-mono text-[10px]">
                              {item.batches.slice(0, 2).join(', ')}
                              {item.batches.length > 2 && ` (+${item.batches.length - 2})`}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Due Collections & Payment History (Date-Wise) */}
        {activeTab === 'dueCollections' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filter Bar */}
            <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={collectionSearch}
                  onChange={(e) => setCollectionSearch(e.target.value)}
                  placeholder="Search payments by Ref #, Method, Voucher notes..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5">
                  <span className="text-[10px] text-slate-500 px-2 font-medium">Method:</span>
                  <button
                    onClick={() => setCollectionMethodFilter('all')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      collectionMethodFilter === 'all'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setCollectionMethodFilter('Cash')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      collectionMethodFilter === 'Cash'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    onClick={() => setCollectionMethodFilter('Bank Transfer')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      collectionMethodFilter === 'Bank Transfer'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Bank
                  </button>
                  <button
                    onClick={() => setCollectionMethodFilter('MFS')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      collectionMethodFilter === 'MFS'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    MFS / Digital
                  </button>
                </div>

                {customer.TotalDue > 0 && (
                  <button
                    onClick={() => onOpenCollect(customer)}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1 shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Collect Payment</span>
                  </button>
                )}
              </div>
            </div>

            {/* Collection Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="p-3">Date & Time</th>
                      <th className="p-3">Reference / Voucher ID</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Payment Method</th>
                      <th className="p-3">Notes</th>
                      <th className="p-3">Received By</th>
                      <th className="p-3 text-right">Amount Received</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {collectionHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          No payment receipts or due collections recorded for this customer.
                        </td>
                      </tr>
                    ) : (
                      collectionHistory.map((col) => {
                        const dateFormatted = new Date(col.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });
                        const timeFormatted = new Date(col.date).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={col.id} className="hover:bg-slate-900/60 transition-colors">
                            <td className="p-3 font-mono text-slate-300">
                              <div>{dateFormatted}</div>
                              <div className="text-[10px] text-slate-500">{timeFormatted}</div>
                            </td>

                            <td className="p-3 font-mono text-slate-200 font-semibold">
                              {col.reference}
                            </td>

                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  col.type === 'Direct Due Settlement'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                                    : 'bg-blue-950 text-blue-300 border border-blue-800/40'
                                }`}
                              >
                                {col.type}
                              </span>
                            </td>

                            <td className="p-3 text-slate-300">{col.method}</td>

                            <td className="p-3 text-slate-400 max-w-xs truncate" title={col.notes}>
                              {col.notes}
                            </td>

                            <td className="p-3 text-slate-400">{col.actor}</td>

                            <td className="p-3 text-right font-mono font-bold text-emerald-400 text-sm">
                              {formatCurrency(col.amount)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Total Bar */}
            <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Total Received Payments: <span className="font-bold text-white">{collectionHistory.length}</span></span>
              <span className="font-mono text-xs">
                Cumulative Collections: <span className="font-bold text-emerald-400">{formatCurrency(collectionHistory.reduce((s, c) => s + c.amount, 0))}</span>
              </span>
            </div>
          </div>
        )}

        {/* Tab 4: Account Statement (Ledger & Printable) */}
        {activeTab === 'statement' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">
                Comprehensive Customer Credit Ledger Statement & Balance Timeline
              </span>
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Statement</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6" id="printable-statement">
              {/* Printable Header */}
              <div className="border-b-2 border-slate-700 pb-4 mb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-base font-bold text-white tracking-tight uppercase">
                      FATEMA PHARMACY & HEALTHCARE
                    </h1>
                    <p className="text-xs text-slate-400">
                      Central Healthcare Commercial Road, Dhaka · Customer Accounts & Dispensing Dept.
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      PATIENT ACCOUNT STATEMENT · CREDIT & RECEIPT LEDGER
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{customer.Name}</div>
                    <div className="text-xs text-slate-400 font-mono">Patient ID: {customer.CustomerID}</div>
                    <div className="text-xs text-slate-400">{customer.Address}</div>
                    <div className="text-xs text-slate-400 font-mono">{customer.Phone}</div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">
                    Generated Date: <strong className="text-white font-mono">{new Date().toLocaleString()}</strong>
                  </span>
                  <span className="text-slate-300">
                    Current Receivable Balance: <strong className="text-amber-400 font-mono text-sm ml-1">{formatCurrency(customer.TotalDue)}</strong>
                  </span>
                </div>
              </div>

              {/* Ledger Statement Table */}
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-700 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Reference #</th>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-right">Debit (Dispensed)</th>
                    <th className="p-2.5 text-right">Credit (Collected)</th>
                    <th className="p-2.5 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {accountStatement.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No financial transactions on record.
                      </td>
                    </tr>
                  ) : (
                    accountStatement.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-900/60 font-mono text-slate-300">
                        <td className="p-2.5 text-slate-400 font-sans">
                          {new Date(row.date).toLocaleDateString()}
                        </td>

                        <td className="p-2.5 font-bold text-white">{row.refNumber}</td>

                        <td className="p-2.5 font-sans text-slate-300">{row.description}</td>

                        <td className="p-2.5 text-right text-slate-100">
                          {row.debit > 0 ? formatCurrency(row.debit) : '—'}
                        </td>

                        <td className="p-2.5 text-right text-emerald-400 font-semibold">
                          {row.credit > 0 ? formatCurrency(row.credit) : '—'}
                        </td>

                        <td className="p-2.5 text-right font-bold text-amber-400">
                          {formatCurrency(row.runningBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Statement Sign-off */}
              <div className="mt-12 pt-8 border-t border-slate-800 grid grid-cols-2 gap-8 text-xs text-slate-400">
                <div>
                  <div className="w-48 border-b border-slate-700 pb-1 mb-1" />
                  <span>Dispensed & Audited By: Registered Pharmacist</span>
                </div>
                <div className="text-right">
                  <div className="w-48 border-b border-slate-700 pb-1 mb-1 ml-auto" />
                  <span>Customer / Patient Signature</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
