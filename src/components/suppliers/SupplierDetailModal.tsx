/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Supplier Detail Modal - All Data & History View
 * Features:
 * - Date-wise invoice history
 * - Invoices searchable by invoice number AND by medicine name
 * - Date-wise payment history (direct settlements, invoice advance payments, vault credits)
 * - Medicine catalog & stock levels for this supplier
 * - Expire vault returns & reconciliations
 * - Comprehensive account statement / printable ledger
 * - Quick payment settlement trigger
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Supplier, Purchase, DueCollection, ExpireVaultItem, Medicine, Batch } from '../../types/pharmacy';
import {
  X,
  Building2,
  Phone,
  MapPin,
  Percent,
  DollarSign,
  Calendar,
  Search,
  FileText,
  CreditCard,
  Package,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Printer,
  Plus,
  ArrowUpDown,
  Filter,
  Tag,
  ShieldAlert,
} from 'lucide-react';

interface SupplierDetailModalProps {
  supplier: Supplier;
  onClose: () => void;
  purchases: Purchase[];
  dueCollections: DueCollection[];
  expireVault: ExpireVaultItem[];
  medicines: Medicine[];
  batches: Batch[];
  formatCurrency: (amount: number) => string;
  onOpenPay: (supplier: Supplier) => void;
}

type TabType = 'invoices' | 'payments' | 'medicines' | 'vault' | 'statement';

export const SupplierDetailModal: React.FC<SupplierDetailModalProps> = ({
  supplier,
  onClose,
  purchases,
  dueCollections,
  expireVault,
  medicines,
  batches,
  formatCurrency,
  onOpenPay,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('invoices');

  // Search and filter states for Invoices
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceDateFilter, setInvoiceDateFilter] = useState<'all' | '7days' | '30days' | 'thisYear'>('all');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'all' | 'due' | 'paid'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});

  // Payment search and filter states
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'all' | 'Cash' | 'Bank Transfer' | 'MFS'>('all');

  // Medicines search
  const [medicineSearch, setMedicineSearch] = useState('');

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

  // Supplier Invoices
  const supplierPurchases = useMemo(() => {
    return purchases.filter(
      (p) =>
        p.SupplierID === supplier.SupplierID ||
        p.SupplierName.toLowerCase() === supplier.Name.toLowerCase()
    );
  }, [purchases, supplier]);

  // Medicine ID to Generic map for deep search
  const medicineGenericMap = useMemo(() => {
    const map = new Map<string, string>();
    medicines.forEach((m) => {
      map.set(m.MedicineID, m.GenericName);
    });
    return map;
  }, [medicines]);

  // Filtered Invoices (Searchable by Invoice # AND Medicine Name, Date-wise)
  const filteredPurchases = useMemo(() => {
    const query = invoiceSearch.trim().toLowerCase();
    const now = new Date();

    return supplierPurchases
      .filter((p) => {
        // Status filter
        if (invoiceStatusFilter === 'due' && (p.DueAmount || 0) <= 0) return false;
        if (invoiceStatusFilter === 'paid' && (p.DueAmount || 0) > 0) return false;

        // Date filter
        if (invoiceDateFilter !== 'all') {
          const pDate = new Date(p.PurchaseDate);
          const diffDays = (now.getTime() - pDate.getTime()) / (1000 * 3600 * 24);
          if (invoiceDateFilter === '7days' && diffDays > 7) return false;
          if (invoiceDateFilter === '30days' && diffDays > 30) return false;
          if (invoiceDateFilter === 'thisYear' && pDate.getFullYear() !== now.getFullYear()) return false;
        }

        // Search query: by invoice number OR by medicine name in items
        if (!query) return true;

        const matchesInvoiceNumber = p.InvoiceNumber.toLowerCase().includes(query);
        const matchesGroup = (p.Group || '').toLowerCase().includes(query);

        // Check each item for medicine trade name, generic name, or batch
        const matchesMedicineName = p.Items.some((item) => {
          const tradeMatch = item.TradeName.toLowerCase().includes(query);
          const batchMatch = item.BatchNumber.toLowerCase().includes(query);
          const generic = medicineGenericMap.get(item.MedicineID)?.toLowerCase() || '';
          const genericMatch = generic.includes(query);
          return tradeMatch || batchMatch || genericMatch;
        });

        return matchesInvoiceNumber || matchesGroup || matchesMedicineName;
      })
      .sort((a, b) => {
        const timeA = new Date(a.PurchaseDate).getTime();
        const timeB = new Date(b.PurchaseDate).getTime();
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
      });
  }, [supplierPurchases, invoiceSearch, invoiceDateFilter, invoiceStatusFilter, sortOrder, medicineGenericMap]);

  // Auto-expand invoices when searching by medicine name
  useEffect(() => {
    if (invoiceSearch.trim()) {
      const newExpanded: Record<string, boolean> = {};
      filteredPurchases.forEach((p) => {
        newExpanded[p.PurchaseID] = true;
      });
      setExpandedInvoices(newExpanded);
    }
  }, [invoiceSearch, filteredPurchases]);

  const toggleInvoiceExpand = (id: string) => {
    setExpandedInvoices((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Supplier Payments (Direct Due Collections + Purchase Advance Payments + Vault Credits)
  const paymentHistory = useMemo(() => {
    const list: Array<{
      id: string;
      date: string;
      type: 'Direct Settlement' | 'Invoice Payment' | 'Vault Credit Return';
      reference: string;
      method: string;
      notes: string;
      amount: number;
      actor: string;
    }> = [];

    // 1. Direct due collections / settlements
    dueCollections
      .filter((c) => c.EntityType === 'Supplier' && (c.EntityID === supplier.SupplierID || c.EntityName === supplier.Name))
      .forEach((c) => {
        list.push({
          id: c.CollectionID,
          date: c.CollectionDate,
          type: 'Direct Settlement',
          reference: c.CollectionID,
          method: c.PaymentMethod,
          notes: c.Notes || 'Supplier ledger balance disbursement',
          amount: c.Amount,
          actor: c.ReceivedBy || 'Pharmacist Staff',
        });
      });

    // 2. Payments recorded upon purchase creation
    supplierPurchases
      .filter((p) => (p.PaidAmount || 0) > 0)
      .forEach((p) => {
        list.push({
          id: `PAY-INV-${p.PurchaseID}`,
          date: p.PurchaseDate,
          type: 'Invoice Payment',
          reference: `Inv: ${p.InvoiceNumber}`,
          method: 'Bank Transfer / Voucher',
          notes: `Advance payment for invoice ${p.InvoiceNumber} (${p.Items?.length || 0} items)`,
          amount: p.PaidAmount,
          actor: 'Accounts Payable',
        });
      });

    // 3. Vault reconciliation credit deductions
    expireVault
      .filter(
        (v) =>
          (v.SupplierID === supplier.SupplierID || v.SupplierName === supplier.Name) &&
          (v.ReturnStatus === 'CashReceived' || v.ReconciliationType === 'CreditDeduction') &&
          v.ReconciledAmount > 0
      )
      .forEach((v) => {
        list.push({
          id: `VLT-REC-${v.VaultID}`,
          date: v.ReturnDate || v.TransferDate,
          type: 'Vault Credit Return',
          reference: `Vault: ${v.VaultID}`,
          method: v.ReconciliationType === 'Cash' ? 'Cash Refund' : 'Credit Note Deducted',
          notes: `Reconciled credit for expired return: ${v.TradeName} (${v.Quantity} units)`,
          amount: v.ReconciledAmount,
          actor: 'Store Vault Manager',
        });
      });

    // Filter by search & method
    const q = paymentSearch.trim().toLowerCase();
    return list
      .filter((item) => {
        if (paymentMethodFilter !== 'all' && item.method !== paymentMethodFilter) return false;
        if (!q) return true;
        return (
          item.reference.toLowerCase().includes(q) ||
          item.notes.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          item.method.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dueCollections, supplierPurchases, expireVault, supplier, paymentSearch, paymentMethodFilter]);

  // Medicines catalog for this supplier
  const supplierMedicines = useMemo(() => {
    const q = medicineSearch.trim().toLowerCase();
    return medicines
      .filter((m) => m.SupplierID === supplier.SupplierID)
      .filter((m) => {
        if (!q) return true;
        return (
          m.TradeName.toLowerCase().includes(q) ||
          m.GenericName.toLowerCase().includes(q) ||
          m.RackNo.toLowerCase().includes(q) ||
          (m.Group || '').toLowerCase().includes(q)
        );
      });
  }, [medicines, supplier, medicineSearch]);

  const [medHighlightIndex, setMedHighlightIndex] = useState<number>(0);
  const medRowRefs = useRef<{ [key: number]: HTMLTableRowElement | null }>({});

  useEffect(() => {
    setMedHighlightIndex(0);
  }, [medicineSearch]);

  const handleMedSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (supplierMedicines.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMedHighlightIndex((prev) => {
        const next = prev < supplierMedicines.length - 1 ? prev + 1 : 0;
        medRowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMedHighlightIndex((prev) => {
        const next = prev > 0 ? prev - 1 : supplierMedicines.length - 1;
        medRowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Escape') {
      setMedicineSearch('');
    }
  };

  // Expire Vault items for this supplier
  const supplierVaultItems = useMemo(() => {
    return expireVault.filter(
      (v) => v.SupplierID === supplier.SupplierID || v.SupplierName === supplier.Name
    );
  }, [expireVault, supplier]);

  // Financial aggregates
  const totalPurchasedAmount = supplierPurchases.reduce((sum, p) => sum + (p.NetCostPrice || 0), 0);
  const totalPaidSum = paymentHistory.reduce((sum, p) => sum + p.amount, 0);
  const totalInvoicesCount = supplierPurchases.length;
  const unsettledInvoicesCount = supplierPurchases.filter((p) => (p.DueAmount || 0) > 0).length;

  // Running Ledger Statement for Tab 5
  const accountStatement = useMemo(() => {
    // Collect all debit events (purchases) and credit events (payments & returns)
    type StatementRow = {
      id: string;
      date: string;
      description: string;
      refNumber: string;
      type: 'INVOICE' | 'PAYMENT' | 'VAULT_RETURN';
      debit: number; // Increases liability
      credit: number; // Decreases liability
      runningBalance: number;
    };

    const rows: Array<Omit<StatementRow, 'runningBalance'>> = [];

    // Add invoices as Debits
    supplierPurchases.forEach((p) => {
      rows.push({
        id: p.PurchaseID,
        date: p.PurchaseDate,
        description: `Purchase Consignment: ${p.InvoiceNumber} (${p.Group || 'General'})`,
        refNumber: p.InvoiceNumber,
        type: 'INVOICE',
        debit: p.NetCostPrice,
        credit: 0,
      });
    });

    // Add direct payments as Credits
    dueCollections
      .filter((c) => c.EntityType === 'Supplier' && (c.EntityID === supplier.SupplierID || c.EntityName === supplier.Name))
      .forEach((c) => {
        rows.push({
          id: c.CollectionID,
          date: c.CollectionDate,
          description: `Disbursement Payment (${c.PaymentMethod}) - ${c.Notes}`,
          refNumber: c.CollectionID,
          type: 'PAYMENT',
          debit: 0,
          credit: c.Amount,
        });
      });

    // Add purchase initial payments as Credits
    supplierPurchases
      .filter((p) => (p.PaidAmount || 0) > 0)
      .forEach((p) => {
        rows.push({
          id: `PAID-${p.PurchaseID}`,
          date: p.PurchaseDate,
          description: `Advance Settlement for ${p.InvoiceNumber}`,
          refNumber: p.InvoiceNumber,
          type: 'PAYMENT',
          debit: 0,
          credit: p.PaidAmount,
        });
      });

    // Add vault reconciliations
    expireVault
      .filter(
        (v) =>
          (v.SupplierID === supplier.SupplierID || v.SupplierName === supplier.Name) &&
          v.ReconciledAmount > 0
      )
      .forEach((v) => {
        rows.push({
          id: v.VaultID,
          date: v.ReturnDate || v.TransferDate,
          description: `Expired Stock Return Credit: ${v.TradeName}`,
          refNumber: v.VaultID,
          type: 'VAULT_RETURN',
          debit: 0,
          credit: v.ReconciledAmount,
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
  }, [supplierPurchases, dueCollections, expireVault, supplier]);

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
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {supplier.Name}
                </h2>
                <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                  {supplier.SupplierID}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                  <Percent className="w-3 h-3" />
                  Default Fallback Discount: {supplier.DefaultDiscountPercent}%
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 mt-1 flex-wrap">
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {supplier.Phone}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-500" />
                  {supplier.Address}
                </span>
                {supplier.GroupsHandled && supplier.GroupsHandled.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-slate-500" />
                    <span className="text-slate-400">Therapeutic:</span>
                    <span className="text-slate-300 font-medium">
                      {supplier.GroupsHandled.join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {supplier.TotalDue > 0 ? (
              <button
                onClick={() => onOpenPay(supplier)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <DollarSign className="w-4 h-4" />
                <span>Pay Due Balance</span>
              </button>
            ) : (
              <span className="px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-800/40 text-emerald-400 font-medium text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Account Settled</span>
              </span>
            )}

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors"
              title="Print Supplier Profile & Statement"
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

        {/* Mini KPI Dashboard for this Supplier */}
        <div className="bg-slate-900/60 border-b border-slate-800 p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">
              Outstanding Balance
            </span>
            <span
              className={`text-base font-bold font-mono block mt-0.5 ${
                supplier.TotalDue > 0 ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {formatCurrency(supplier.TotalDue)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {supplier.TotalDue > 0 ? `${unsettledInvoicesCount} invoices pending` : 'Fully cleared'}
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">
              Lifetime Invoices
            </span>
            <span className="text-base font-bold text-white font-mono block mt-0.5">
              {formatCurrency(totalPurchasedAmount)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {totalInvoicesCount} purchase orders
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">
              Total Disbursed
            </span>
            <span className="text-base font-bold text-emerald-400 font-mono block mt-0.5">
              {formatCurrency(totalPaidSum)}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {paymentHistory.length} recorded payments
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">
              Settlement Rate
            </span>
            <span className="text-base font-bold text-blue-400 font-mono block mt-0.5">
              {totalPurchasedAmount > 0
                ? `${Math.min(100, Math.round((totalPaidSum / totalPurchasedAmount) * 100))}%`
                : '100%'}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Paid vs invoiced ratio
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">
              Medicines Supplied
            </span>
            <span className="text-base font-bold text-indigo-400 font-mono block mt-0.5">
              {supplierMedicines.length}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Active items in catalog
            </span>
          </div>

          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800">
            <span className="text-[10px] uppercase font-medium text-slate-400 block">
              Vault Adjustments
            </span>
            <span className="text-base font-bold text-purple-400 font-mono block mt-0.5">
              {supplierVaultItems.length}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Expired batches handled
            </span>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center justify-between px-4 bg-slate-950 border-b border-slate-800 overflow-x-auto">
          <div className="flex items-center gap-1 py-1.5">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-3 py-1.5 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'invoices'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Invoices & Purchases ({supplierPurchases.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`px-3 py-1.5 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'payments'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Payment History ({paymentHistory.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('medicines')}
              className={`px-3 py-1.5 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'medicines'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Medicines Catalog ({supplierMedicines.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('vault')}
              className={`px-3 py-1.5 rounded-md font-medium text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                activeTab === 'vault'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Expire Vault Returns ({supplierVaultItems.length})</span>
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

        {/* Tab 1: Invoices & Purchases (Date-Wise, Searchable by Invoice # & Medicine Name) */}
        {activeTab === 'invoices' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search and Filters Bar */}
            <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Dual Search Input */}
              <div className="relative flex-1 min-w-[280px] max-w-lg">
                <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  placeholder="Search by Invoice # (e.g. SQ-INV-9921) or Medicine Name (e.g. Napa, Cardizem, Losectil)..."
                  className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
                {invoiceSearch && (
                  <button
                    onClick={() => setInvoiceSearch('')}
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
                    onClick={() => setInvoiceDateFilter('all')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      invoiceDateFilter === 'all'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setInvoiceDateFilter('7days')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      invoiceDateFilter === '7days'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    7 Days
                  </button>
                  <button
                    onClick={() => setInvoiceDateFilter('30days')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      invoiceDateFilter === '30days'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    30 Days
                  </button>
                  <button
                    onClick={() => setInvoiceDateFilter('thisYear')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      invoiceDateFilter === 'thisYear'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    This Year
                  </button>
                </div>

                <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5">
                  <button
                    onClick={() => setInvoiceStatusFilter('all')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      invoiceStatusFilter === 'all'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Status
                  </button>
                  <button
                    onClick={() => setInvoiceStatusFilter('due')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      invoiceStatusFilter === 'due'
                        ? 'bg-amber-600 text-white font-medium'
                        : 'text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    Due
                  </button>
                  <button
                    onClick={() => setInvoiceStatusFilter('paid')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      invoiceStatusFilter === 'paid'
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

            {/* Invoices List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredPurchases.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
                  <p className="text-sm font-medium text-slate-400">No invoices match your search criteria</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Try searching a different invoice number or medicine name, or clear active filters.
                  </p>
                  {invoiceSearch && (
                    <button
                      onClick={() => setInvoiceSearch('')}
                      className="mt-3 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                    >
                      Clear search "{invoiceSearch}"
                    </button>
                  )}
                </div>
              ) : (
                filteredPurchases.map((purchase) => {
                  const isExpanded = !!expandedInvoices[purchase.PurchaseID];
                  const hasDue = (purchase.DueAmount || 0) > 0;
                  const dateStr = new Date(purchase.PurchaseDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  });
                  const timeStr = new Date(purchase.PurchaseDate).toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  // Check if this invoice matched specifically via medicine name
                  const matchedItems = invoiceSearch.trim()
                    ? purchase.Items.filter((i) => {
                        const q = invoiceSearch.trim().toLowerCase();
                        return (
                          i.TradeName.toLowerCase().includes(q) ||
                          (medicineGenericMap.get(i.MedicineID) || '').toLowerCase().includes(q) ||
                          i.BatchNumber.toLowerCase().includes(q)
                        );
                      })
                    : [];

                  return (
                    <div
                      key={purchase.PurchaseID}
                      className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden transition-all hover:border-slate-700 shadow-sm"
                    >
                      {/* Invoice Summary Header */}
                      <div
                        onClick={() => toggleInvoiceExpand(purchase.PurchaseID)}
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
                                {purchase.InvoiceNumber}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                                {purchase.PurchaseID}
                              </span>
                              {purchase.Group && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                                  {purchase.Group}
                                </span>
                              )}
                              {matchedItems.length > 0 && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800/50 flex items-center gap-1">
                                  <Package className="w-3 h-3" />
                                  <span>Matches {matchedItems.length} item(s)</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>{dateStr} at {timeStr}</span>
                              <span className="text-slate-600">·</span>
                              <span>{purchase.Items.length} medicine line items</span>
                            </div>
                          </div>
                        </div>

                        {/* Invoice Financial Amounts */}
                        <div className="flex items-center gap-4 text-right">
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 uppercase block">Total Net Cost</span>
                            <span className="font-mono font-bold text-white text-sm">
                              {formatCurrency(purchase.NetCostPrice)}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 uppercase block">Paid</span>
                            <span className="font-mono text-emerald-400 font-semibold">
                              {formatCurrency(purchase.PaidAmount)}
                            </span>
                          </div>

                          <div className="text-right min-w-[90px]">
                            <span className="text-[10px] text-slate-500 uppercase block">Balance Due</span>
                            <span
                              className={`font-mono font-bold text-sm ${
                                hasDue ? 'text-amber-400' : 'text-slate-400'
                              }`}
                            >
                              {formatCurrency(purchase.DueAmount)}
                            </span>
                          </div>

                          <div className="shrink-0">
                            {hasDue ? (
                              <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-800/60 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Due Pending</span>
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
                            <span>Itemized Medicines Breakdown:</span>
                            <div className="flex items-center gap-3 text-slate-500 font-mono text-[10px]">
                              <span>TP: {formatCurrency(purchase.TotalTP)}</span>
                              <span>VAT: {formatCurrency(purchase.TotalVAT)}</span>
                              <span>Discount: {formatCurrency(purchase.TotalDiscount)}</span>
                            </div>
                          </div>

                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-900 text-slate-400 text-[10px] uppercase font-semibold border-b border-slate-800">
                                <th className="p-2">Medicine Trade & Generic</th>
                                <th className="p-2">Batch #</th>
                                <th className="p-2">Expiry</th>
                                <th className="p-2 text-center">Quantity</th>
                                <th className="p-2 text-right">TP Unit</th>
                                <th className="p-2 text-center">VAT</th>
                                <th className="p-2 text-center">Discount</th>
                                <th className="p-2 text-right">Unit Cost</th>
                                <th className="p-2 text-right">Total Cost</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850">
                              {purchase.Items.map((item) => {
                                const q = invoiceSearch.trim().toLowerCase();
                                const isMatchedMedicine =
                                  q &&
                                  (item.TradeName.toLowerCase().includes(q) ||
                                    (medicineGenericMap.get(item.MedicineID) || '').toLowerCase().includes(q) ||
                                    item.BatchNumber.toLowerCase().includes(q));

                                return (
                                  <tr
                                    key={item.PurchaseItemID}
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
                                        {medicineGenericMap.get(item.MedicineID) || 'Pharmaceutical Item'}
                                      </div>
                                    </td>

                                    <td className="p-2 font-mono text-slate-300">{item.BatchNumber}</td>

                                    <td className="p-2 font-mono text-slate-400">{item.ExpiryDate}</td>

                                    <td className="p-2 text-center font-mono font-bold text-slate-200">
                                      {item.Quantity}
                                    </td>

                                    <td className="p-2 text-right font-mono text-slate-400">
                                      {formatCurrency(item.TP)}
                                    </td>

                                    <td className="p-2 text-center font-mono text-slate-400">
                                      {item.VATPercent}%
                                    </td>

                                    <td className="p-2 text-center font-mono text-emerald-400">
                                      {item.DiscountPercent}%
                                    </td>

                                    <td className="p-2 text-right font-mono text-slate-300">
                                      {formatCurrency(item.CostPrice)}
                                    </td>

                                    <td className="p-2 text-right font-mono font-bold text-slate-100">
                                      {formatCurrency(item.TotalCost)}
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

            {/* Bottom Summary Bar for Invoices */}
            <div className="p-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <div>
                Showing <span className="font-bold text-white">{filteredPurchases.length}</span> of {supplierPurchases.length} invoices
                {invoiceSearch && <span className="ml-1 text-emerald-400 font-medium">(Filtered by "{invoiceSearch}")</span>}
              </div>
              <div className="flex items-center gap-4 font-mono text-xs">
                <span>
                  Sum: <span className="font-bold text-white">{formatCurrency(filteredPurchases.reduce((s, p) => s + (p.NetCostPrice || 0), 0))}</span>
                </span>
                <span>
                  Paid: <span className="font-bold text-emerald-400">{formatCurrency(filteredPurchases.reduce((s, p) => s + (p.PaidAmount || 0), 0))}</span>
                </span>
                <span>
                  Due: <span className="font-bold text-amber-400">{formatCurrency(filteredPurchases.reduce((s, p) => s + (p.DueAmount || 0), 0))}</span>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Payment History (Date-Wise) */}
        {activeTab === 'payments' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Payment Filter Bar */}
            <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  placeholder="Search payments by Ref #, Cheque, Bank Wire, Notes..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5">
                  <span className="text-[10px] text-slate-500 px-2 font-medium">Method:</span>
                  <button
                    onClick={() => setPaymentMethodFilter('all')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      paymentMethodFilter === 'all'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setPaymentMethodFilter('Bank Transfer')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      paymentMethodFilter === 'Bank Transfer'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Bank / Wire
                  </button>
                  <button
                    onClick={() => setPaymentMethodFilter('Cash')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      paymentMethodFilter === 'Cash'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Cash Voucher
                  </button>
                  <button
                    onClick={() => setPaymentMethodFilter('MFS')}
                    className={`px-2 py-0.5 rounded text-[11px] ${
                      paymentMethodFilter === 'MFS'
                        ? 'bg-emerald-600 text-white font-medium'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    MFS / Digital
                  </button>
                </div>

                {supplier.TotalDue > 0 && (
                  <button
                    onClick={() => onOpenPay(supplier)}
                    className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center gap-1 shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Disburse Payment</span>
                  </button>
                )}
              </div>
            </div>

            {/* Payment Ledger Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="p-3">Date & Time</th>
                      <th className="p-3">Reference / Transaction ID</th>
                      <th className="p-3">Transaction Type</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Notes / Cheque Ref</th>
                      <th className="p-3">Disbursed By</th>
                      <th className="p-3 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {paymentHistory.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          No payment transactions recorded for this supplier.
                        </td>
                      </tr>
                    ) : (
                      paymentHistory.map((pay) => {
                        const dateFormatted = new Date(pay.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });
                        const timeFormatted = new Date(pay.date).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={pay.id} className="hover:bg-slate-900/60 transition-colors">
                            <td className="p-3 font-mono text-slate-300">
                              <div>{dateFormatted}</div>
                              <div className="text-[10px] text-slate-500">{timeFormatted}</div>
                            </td>

                            <td className="p-3 font-mono text-slate-200 font-semibold">
                              {pay.reference}
                            </td>

                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  pay.type === 'Direct Settlement'
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                                    : pay.type === 'Invoice Payment'
                                    ? 'bg-blue-950 text-blue-300 border border-blue-800/40'
                                    : 'bg-purple-950 text-purple-300 border border-purple-800/40'
                                }`}
                              >
                                {pay.type}
                              </span>
                            </td>

                            <td className="p-3 text-slate-300">{pay.method}</td>

                            <td className="p-3 text-slate-400 max-w-xs truncate" title={pay.notes}>
                              {pay.notes}
                            </td>

                            <td className="p-3 text-slate-400">{pay.actor}</td>

                            <td className="p-3 text-right font-mono font-bold text-emerald-400 text-sm">
                              {formatCurrency(pay.amount)}
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
              <span>Total Disbursed Transactions: <span className="font-bold text-white">{paymentHistory.length}</span></span>
              <span className="font-mono text-xs">
                Cumulative Paid: <span className="font-bold text-emerald-400">{formatCurrency(paymentHistory.reduce((s, p) => s + p.amount, 0))}</span>
              </span>
            </div>
          </div>
        )}

        {/* Tab 3: Medicines Catalog & Stock */}
        {activeTab === 'medicines' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={medicineSearch}
                  onChange={(e) => setMedicineSearch(e.target.value)}
                  onKeyDown={handleMedSearchKeyDown}
                  placeholder="Filter medicines by Name, Generic, Rack, Group... (↓/↑ to navigate)"
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div className="text-slate-400 text-xs">
                Total Products: <span className="font-bold text-white">{supplierMedicines.length}</span>
              </div>
            </div>

            {/* Medicines Table */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                      <th className="p-3">Medicine & Generic</th>
                      <th className="p-3">Group</th>
                      <th className="p-3">Rack</th>
                      <th className="p-3 text-center">Unit</th>
                      <th className="p-3 text-center">Discount</th>
                      <th className="p-3 text-right">Retail MRP</th>
                      <th className="p-3 text-right">Current Stock</th>
                      <th className="p-3 text-center">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {supplierMedicines.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">
                          No medicines found matching criteria for this supplier.
                        </td>
                      </tr>
                    ) : (
                      supplierMedicines.map((med, idx) => {
                        // Calculate total stock across active batches
                        const medBatches = batches.filter((b) => b.MedicineID === med.MedicineID);
                        const totalStock = medBatches.reduce((sum, b) => sum + (b.CurrentStock || 0), 0);
                        const isLowStock = totalStock <= (med.ReorderLevel || 10);
                        const isOutOfStock = totalStock === 0;
                        const isSelected = idx === medHighlightIndex;

                        return (
                          <tr
                            key={med.MedicineID}
                            ref={(el) => { medRowRefs.current[idx] = el; }}
                            onClick={() => setMedHighlightIndex(idx)}
                            className={`transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-950/80 ring-2 ring-emerald-500/50'
                                : 'hover:bg-slate-900/60'
                            }`}
                          >
                            <td className="p-3">
                              <div className="font-semibold text-white flex items-center gap-1.5">
                                {isSelected && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                                )}
                                <span>{med.TradeName}</span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{med.GenericName}</div>
                              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                ID: {med.MedicineID} · Batches: {medBatches.length}
                              </div>
                            </td>

                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-850 text-slate-300 border border-slate-700">
                                {med.Group || 'General'}
                              </span>
                            </td>

                            <td className="p-3 font-mono text-slate-300">{med.RackNo}</td>

                            <td className="p-3 text-center text-slate-300">{med.Unit}</td>

                            <td className="p-3 text-center font-mono">
                              <span className="text-emerald-400 font-bold">
                                {med.DefaultDiscountPercent || supplier.DefaultDiscountPercent}%
                              </span>
                            </td>

                            <td className="p-3 text-right font-mono font-bold text-slate-100">
                              {formatCurrency(med.MRP)}
                            </td>

                            <td className="p-3 text-right font-mono font-bold text-white text-sm">
                              {totalStock}
                            </td>

                            <td className="p-3 text-center">
                              {isOutOfStock ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-400 border border-rose-800/60">
                                  Out of Stock
                                </span>
                              ) : isLowStock ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
                                  Low Stock
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                                  Adequate
                                </span>
                              )}
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

        {/* Tab 4: Expire Vault Returns */}
        {activeTab === 'vault' && (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="p-3">Transfer Date</th>
                    <th className="p-3">Medicine & Batch</th>
                    <th className="p-3 text-center">Quantity</th>
                    <th className="p-3 text-right">Cost Value</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Reconciliation</th>
                    <th className="p-3 text-right">Reconciled ($)</th>
                    <th className="p-3">Resolution Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {supplierVaultItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No expired or returned batches in the vault for this supplier.
                      </td>
                    </tr>
                  ) : (
                    supplierVaultItems.map((vault) => {
                      return (
                        <tr key={vault.VaultID} className="hover:bg-slate-900/60 transition-colors">
                          <td className="p-3 font-mono text-slate-300">
                            {new Date(vault.TransferDate).toLocaleDateString()}
                          </td>

                          <td className="p-3">
                            <div className="font-semibold text-slate-100">{vault.TradeName}</div>
                            <div className="text-[10px] font-mono text-slate-400">
                              Batch: {vault.BatchNumber}
                            </div>
                          </td>

                          <td className="p-3 text-center font-mono font-bold text-slate-200">
                            {vault.Quantity}
                          </td>

                          <td className="p-3 text-right font-mono text-slate-300">
                            {formatCurrency(vault.CostPrice * vault.Quantity)}
                          </td>

                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                vault.ReturnStatus === 'CashReceived'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/40'
                                  : vault.ReturnStatus === 'ReturnedToSupplier'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800/40'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800/40'
                              }`}
                            >
                              {vault.ReturnStatus}
                            </span>
                          </td>

                          <td className="p-3 text-center text-slate-400 font-mono">
                            {vault.ReconciliationType || 'Pending'}
                          </td>

                          <td className="p-3 text-right font-mono font-bold text-emerald-400">
                            {formatCurrency(vault.ReconciledAmount)}
                          </td>

                          <td className="p-3 text-slate-400 max-w-xs truncate" title={vault.Notes}>
                            {vault.Notes}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Account Statement (Printable Ledger) */}
        {activeTab === 'statement' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">
                Comprehensive Chronological Financial Ledger Statement
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
                      Central Healthcare Commercial Road, Dhaka · Accounts Payable Dept.
                    </p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      STATEMENT OF ACCOUNT · VENDOR LEDGER
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-white">{supplier.Name}</div>
                    <div className="text-xs text-slate-400 font-mono">Vendor ID: {supplier.SupplierID}</div>
                    <div className="text-xs text-slate-400">{supplier.Address}</div>
                    <div className="text-xs text-slate-400 font-mono">{supplier.Phone}</div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">
                    Generated Date: <strong className="text-white font-mono">{new Date().toLocaleString()}</strong>
                  </span>
                  <span className="text-slate-300">
                    Closing Payable Balance: <strong className="text-amber-400 font-mono text-sm ml-1">{formatCurrency(supplier.TotalDue)}</strong>
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
                    <th className="p-2.5 text-right">Debit (Invoiced)</th>
                    <th className="p-2.5 text-right">Credit (Paid)</th>
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
                  <span>Prepared By: Chief Pharmacist / Accounts</span>
                </div>
                <div className="text-right">
                  <div className="w-48 border-b border-slate-700 pb-1 mb-1 ml-auto" />
                  <span>Received & Acknowledged by Vendor Rep</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
