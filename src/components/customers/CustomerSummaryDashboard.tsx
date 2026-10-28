/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Customer Summary Dashboard - Responsive Quick Insights Bar & KPI Metrics
 */

import React from 'react';
import { Customer, Sale, DueCollection } from '../../types/pharmacy';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Receipt,
  Award,
  CreditCard,
} from 'lucide-react';

interface CustomerSummaryDashboardProps {
  customers: Customer[];
  sales: Sale[];
  dueCollections: DueCollection[];
  formatCurrency: (amount: number) => string;
  selectedFilter: 'all' | 'due' | 'settled';
  onSelectFilter: (filter: 'all' | 'due' | 'settled') => void;
  onOpenCustomer: (customer: Customer) => void;
}

export const CustomerSummaryDashboard: React.FC<CustomerSummaryDashboardProps> = ({
  customers,
  sales,
  dueCollections,
  formatCurrency,
  selectedFilter,
  onSelectFilter,
  onOpenCustomer,
}) => {
  const totalCustomers = customers.length;
  const customersWithDue = customers.filter((c) => c.TotalDue > 0);
  const totalAccountsReceivable = customers.reduce((sum, c) => sum + (c.TotalDue || 0), 0);

  // Total retail sales across all customer receipts
  const totalSalesRevenue = sales.reduce((sum, s) => sum + (s.FinalAmount || 0), 0);
  const totalReceiptsCount = sales.length;

  // Direct due collections from customers
  const directCollectionsSum = dueCollections
    .filter((c) => c.EntityType === 'Customer')
    .reduce((sum, c) => sum + (c.Amount || 0), 0);

  // Initial cash paid at counter upon sale
  const salePaidSum = sales.reduce((sum, s) => sum + (s.PaidAmount || 0), 0);
  const totalReceivedFunds = directCollectionsSum + salePaidSum;

  // Loyalty Points
  const totalLoyaltyPoints = customers.reduce((sum, c) => sum + (c.LoyaltyPoints || 0), 0);

  // Top Debtors
  const topDueCustomers = [...customersWithDue]
    .sort((a, b) => b.TotalDue - a.TotalDue)
    .slice(0, 3);

  // Collection recovery rate %
  const recoveryRate = totalSalesRevenue > 0
    ? Math.min(100, Math.round((totalReceivedFunds / totalSalesRevenue) * 100))
    : 100;

  return (
    <div className="bg-slate-950/80 border-b border-slate-800 p-4 space-y-3.5 select-none">
      {/* Top Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Customers */}
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
              Registered Clients
            </span>
            <div className="w-7 h-7 rounded-md bg-emerald-950/80 border border-emerald-800/40 flex items-center justify-center text-emerald-400">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-white tracking-tight font-mono">
              {totalCustomers}
            </span>
            <span className="text-[11px] text-slate-400">profiles</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-500 truncate">
            {customers.filter((c) => c.LoyaltyPoints > 0).length} active reward members
          </div>
        </div>

        {/* Card 2: Accounts Receivable (Outstanding Dues) */}
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
              Customer Dues
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800/60">
              {customersWithDue.length} Due
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-amber-400 tracking-tight font-mono">
              {formatCurrency(totalAccountsReceivable)}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            {customersWithDue.length > 0 ? 'Pending collection from patients' : 'All accounts settled'}
          </div>
        </div>

        {/* Card 3: Total Sales Revenue */}
        <div className="p-3 rounded-lg border bg-slate-900/60 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Retail Sales
            </span>
            <div className="w-7 h-7 rounded-md bg-blue-950/80 border border-blue-800/40 flex items-center justify-center text-blue-400">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-slate-100 tracking-tight font-mono">
              {formatCurrency(totalSalesRevenue)}
            </span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-1">
            <Receipt className="w-3 h-3 text-blue-400" />
            <span>Across {totalReceiptsCount} sales receipts</span>
          </div>
        </div>

        {/* Card 4: Total Dues Collected */}
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
              Funds Collected
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-400">
              {recoveryRate}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-emerald-400 tracking-tight font-mono">
              {formatCurrency(totalReceivedFunds)}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-1.5 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${recoveryRate}%` }}
            />
          </div>
        </div>

        {/* Card 5: Loyalty Points */}
        <div className="p-3 rounded-lg border bg-slate-900/60 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Loyalty Pool
            </span>
            <div className="w-7 h-7 rounded-md bg-purple-950/80 border border-purple-800/40 flex items-center justify-center text-purple-400">
              <Award className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-xl font-bold text-purple-300 tracking-tight font-mono">
              {totalLoyaltyPoints.toLocaleString()}
            </span>
            <span className="text-[11px] text-purple-400">pts</span>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            Active pharmacy patient credits
          </div>
        </div>
      </div>

      {/* Quick Filters and Top Due Insights Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-xs">
        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-slate-400 font-medium mr-1">Filter:</span>
          <button
            onClick={() => onSelectFilter('all')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              selectedFilter === 'all'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            All Customers ({totalCustomers})
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
            <span>Dues Pending ({customersWithDue.length})</span>
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
            <span>Zero Balance / Cleared ({totalCustomers - customersWithDue.length})</span>
          </button>
        </div>

        {/* Top Debtors Quick Jump */}
        {topDueCustomers.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500">Highest Outstanding:</span>
            {topDueCustomers.map((c) => (
              <button
                key={c.CustomerID}
                onClick={() => onOpenCustomer(c)}
                className="px-2 py-0.5 rounded bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/40 text-amber-300 flex items-center gap-1 transition-colors"
                title={`Click to open ${c.Name} data and history`}
              >
                <span className="truncate max-w-[120px] font-medium">{c.Name}</span>
                <span className="font-mono font-bold text-amber-400">
                  {formatCurrency(c.TotalDue)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
