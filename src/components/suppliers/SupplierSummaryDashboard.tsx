/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Supplier Summary Dashboard - Responsive Quick Insights Bar & KPI Metrics
 */

import React from 'react';
import { Supplier, Purchase, DueCollection, ExpireVaultItem } from '../../types/pharmacy';
import {
  Building2,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  DollarSign,
  TrendingUp,
  Package,
  Layers,
  RotateCcw,
  Clock,
} from 'lucide-react';

interface SupplierSummaryDashboardProps {
  suppliers: Supplier[];
  purchases: Purchase[];
  dueCollections: DueCollection[];
  expireVault: ExpireVaultItem[];
  formatCurrency: (amount: number) => string;
  selectedFilter: 'all' | 'due' | 'settled';
  onSelectFilter: (filter: 'all' | 'due' | 'settled') => void;
  selectedGroup: string;
  onSelectGroup: (group: string) => void;
  onOpenSupplier: (supplier: Supplier) => void;
}

export const SupplierSummaryDashboard: React.FC<SupplierSummaryDashboardProps> = ({
  suppliers,
  purchases,
  dueCollections,
  expireVault,
  formatCurrency,
  selectedFilter,
  onSelectFilter,
  selectedGroup,
  onSelectGroup,
  onOpenSupplier,
}) => {
  // Aggregate KPIs
  const totalSuppliers = suppliers.length;

  const suppliersWithDue = suppliers.filter((s) => s.TotalDue > 0);
  const totalAccountsPayable = suppliers.reduce((sum, s) => sum + (s.TotalDue || 0), 0);

  const totalPurchasesAmount = purchases.reduce((sum, p) => sum + (p.NetCostPrice || 0), 0);
  const totalInvoicesCount = purchases.length;

  // Direct due payments + purchase advance payments
  const directPaymentsSum = dueCollections
    .filter((c) => c.EntityType === 'Supplier')
    .reduce((sum, c) => sum + (c.Amount || 0), 0);
  const purchasePaidSum = purchases.reduce((sum, p) => sum + (p.PaidAmount || 0), 0);
  const totalSettledPayments = directPaymentsSum + purchasePaidSum;

  // Vault return credits/refunds
  const totalVaultCredits = expireVault
    .filter((v) => v.ReturnStatus === 'CashReceived' || v.ReconciliationType === 'CreditDeduction')
    .reduce((sum, v) => sum + (v.ReconciledAmount || 0), 0);

  // Settlement Rate %
  const totalLiability = totalPurchasesAmount;
  const settlementRate = totalLiability > 0 ? Math.min(100, Math.round((totalSettledPayments / totalLiability) * 100)) : 100;

  // Top payables (suppliers with largest outstanding due)
  const topDueSuppliers = [...suppliersWithDue]
    .sort((a, b) => b.TotalDue - a.TotalDue)
    .slice(0, 3);

  // Available groups
  const allGroups = Array.from(
    new Set(suppliers.flatMap((s) => s.GroupsHandled || []))
  ).filter(Boolean);

  return (
    <div className="bg-slate-950/80 border-b border-slate-800 p-4 space-y-3.5">
      {/* Top Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Suppliers */}
        <div
          onClick={() => onSelectFilter('all')}
          className={`p-3 rounded-lg border transition-all cursor-pointer ${
            selectedFilter === 'all'
              ? 'bg-slate-900 border-emerald-500/60 shadow-sm shadow-emerald-950'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Total Partners
            </span>
            <div className="w-7 h-7 rounded-md bg-emerald-950/80 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-white tracking-tight font-mono">
              {totalSuppliers}
            </span>
            <span className="text-[11px] text-slate-400">active vendors</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 truncate">
            {allGroups.length} therapeutic groups covered
          </div>
        </div>

        {/* Card 2: Accounts Payable (Outstanding Due) */}
        <div
          onClick={() => onSelectFilter('due')}
          className={`p-3 rounded-lg border transition-all cursor-pointer ${
            selectedFilter === 'due'
              ? 'bg-amber-950/30 border-amber-500/80 shadow-sm shadow-amber-950'
              : 'bg-slate-900/60 border-slate-800 hover:border-amber-800/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-amber-300 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              Payable Dues
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
              {suppliersWithDue.length} Due
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-amber-400 tracking-tight font-mono">
              {formatCurrency(totalAccountsPayable)}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            {suppliersWithDue.length > 0 ? 'Settlements pending disbursement' : 'All accounts settled'}
          </div>
        </div>

        {/* Card 3: Total Purchases Volume */}
        <div className="p-3 rounded-lg border bg-slate-900/60 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Procurement Total
            </span>
            <div className="w-7 h-7 rounded-md bg-blue-950/80 border border-blue-800/40 flex items-center justify-center text-blue-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-100 tracking-tight font-mono">
              {formatCurrency(totalPurchasesAmount)}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
            <Package className="w-3 h-3 text-blue-400" />
            <span>Across {totalInvoicesCount} purchase invoices</span>
          </div>
        </div>

        {/* Card 4: Total Settled Payments */}
        <div
          onClick={() => onSelectFilter('settled')}
          className={`p-3 rounded-lg border transition-all cursor-pointer ${
            selectedFilter === 'settled'
              ? 'bg-slate-900 border-emerald-500/60 shadow-sm shadow-emerald-950'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Settled Funds
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-400">
              {settlementRate}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-400 tracking-tight font-mono">
              {formatCurrency(totalSettledPayments)}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${settlementRate}%` }}
            />
          </div>
        </div>

        {/* Card 5: Expire Vault Credits */}
        <div className="p-3 rounded-lg border bg-slate-900/60 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Vault Adjustments
            </span>
            <div className="w-7 h-7 rounded-md bg-purple-950/80 border border-purple-800/40 flex items-center justify-center text-purple-400">
              <RotateCcw className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-purple-300 tracking-tight font-mono">
              {formatCurrency(totalVaultCredits)}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Reconciled credit & return value
          </div>
        </div>
      </div>

      {/* Quick Filters and Top Due Insights Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Status:</span>
          <button
            onClick={() => onSelectFilter('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              selectedFilter === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            All ({totalSuppliers})
          </button>
          <button
            onClick={() => onSelectFilter('due')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              selectedFilter === 'due'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-900 text-amber-400 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Due Pending ({suppliersWithDue.length})</span>
          </button>
          <button
            onClick={() => onSelectFilter('settled')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              selectedFilter === 'settled'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Settled ({totalSuppliers - suppliersWithDue.length})</span>
          </button>
        </div>

        {/* Group Selector */}
        {allGroups.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
            <span className="text-[11px] text-slate-400 font-medium">Group:</span>
            <button
              onClick={() => onSelectGroup('All')}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                selectedGroup === 'All'
                  ? 'bg-slate-200 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              All Groups
            </button>
            {allGroups.map((grp) => (
              <button
                key={grp}
                onClick={() => onSelectGroup(grp)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors whitespace-nowrap ${
                  selectedGroup === grp
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {grp}
              </button>
            ))}
          </div>
        )}

        {/* Top Payables Quick Jump */}
        {topDueSuppliers.length > 0 && (
          <div className="hidden xl:flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500">Highest Dues:</span>
            {topDueSuppliers.map((s) => (
              <button
                key={s.SupplierID}
                onClick={() => onOpenSupplier(s)}
                className="px-2 py-0.5 rounded bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/40 text-amber-300 flex items-center gap-1 transition-colors"
                title={`Click to open ${s.Name} data and history`}
              >
                <span className="truncate max-w-[110px] font-medium">{s.Name}</span>
                <span className="font-mono font-bold text-amber-400">
                  {formatCurrency(s.TotalDue)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
