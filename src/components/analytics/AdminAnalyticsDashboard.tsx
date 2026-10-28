/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Module A-0: Executive Admin Analytics & Operational Summary Dashboard
 * Opens default first when Admin accesses PharmaCore Desktop.
 * Provides all-in-one real-time summary across Sales, Procurement, Receivables,
 * Payables, Inventory Valuation, Expiry Watchdog, and Group Distributions.
 */

import React, { useState, useMemo } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { NavTab } from '../NavigationSidebar';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Truck,
  Users,
  Building2,
  AlertTriangle,
  Boxes,
  RotateCcw,
  Pill,
  Calendar,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Clock,
  Printer,
  Sparkles,
  Database,
  ChevronRight,
  ShieldCheck,
  Percent,
  RefreshCw,
  Wallet,
  Activity,
  Award,
  Store,
  ReceiptText,
  MessageSquareWarning,
  FileSpreadsheet,
} from 'lucide-react';

interface AdminAnalyticsDashboardProps {
  onNavigate: (tab: NavTab) => void;
}

type TimeframeOption = 'today' | 'week' | 'month' | 'all';

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsDashboardProps> = ({
  onNavigate,
}) => {
  const {
    medicines,
    batches,
    purchases,
    sales,
    customers,
    suppliers,
    expireVault,
    dueCollections,
    complaints,
    auditLogs,
    formatCurrency,
    systemStats,
  } = usePharmacy();

  const [timeframe, setTimeframe] = useState<TimeframeOption>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 400);
  };

  // Filter sales and purchases by selected timeframe
  const filteredSales = useMemo(() => {
    if (timeframe === 'all') return sales;
    const now = new Date();
    const nowTime = now.getTime();

    return sales.filter((s) => {
      const sTime = new Date(s.SaleDate).getTime();
      const diffHours = (nowTime - sTime) / (1000 * 3600);
      if (timeframe === 'today') return diffHours <= 24;
      if (timeframe === 'week') return diffHours <= 24 * 7;
      if (timeframe === 'month') return diffHours <= 24 * 30;
      return true;
    });
  }, [sales, timeframe]);

  const filteredPurchases = useMemo(() => {
    if (timeframe === 'all') return purchases;
    const now = new Date();
    const nowTime = now.getTime();

    return purchases.filter((p) => {
      const pTime = new Date(p.PurchaseDate).getTime();
      const diffHours = (nowTime - pTime) / (1000 * 3600);
      if (timeframe === 'today') return diffHours <= 24;
      if (timeframe === 'week') return diffHours <= 24 * 7;
      if (timeframe === 'month') return diffHours <= 24 * 30;
      return true;
    });
  }, [purchases, timeframe]);

  // Aggregate Financial Analytics
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + (s.FinalAmount || 0), 0);
  }, [filteredSales]);

  const totalCostOfGoodsSold = useMemo(() => {
    return filteredSales.reduce((sum, s) => {
      const lineCost = s.Items.reduce((iSum, item) => iSum + (item.CostPrice * item.Quantity), 0);
      return sum + lineCost;
    }, 0);
  }, [filteredSales]);

  const totalGrossProfit = totalRevenue - totalCostOfGoodsSold;
  const grossProfitMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

  const totalProcurementCost = useMemo(() => {
    return filteredPurchases.reduce((sum, p) => sum + (p.NetCostPrice || 0), 0);
  }, [filteredPurchases]);

  // Receivables & Payables
  const totalCustomerReceivables = useMemo(() => {
    return customers.reduce((sum, c) => sum + (c.TotalDue || 0), 0);
  }, [customers]);

  const totalSupplierPayables = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (s.TotalDue || 0), 0);
  }, [suppliers]);

  // Cash In vs Cash Out
  const cashInSales = filteredSales.reduce((sum, s) => sum + (s.PaidAmount || 0), 0);
  const cashInDueCollections = dueCollections
    .filter((c) => c.EntityType === 'Customer')
    .reduce((sum, c) => sum + (c.Amount || 0), 0);
  const totalCashIn = cashInSales + cashInDueCollections;

  const cashOutPurchases = filteredPurchases.reduce((sum, p) => sum + (p.PaidAmount || 0), 0);
  const cashOutSupplierPayments = dueCollections
    .filter((c) => c.EntityType === 'Supplier')
    .reduce((sum, c) => sum + (c.Amount || 0), 0);
  const totalCashOut = cashOutPurchases + cashOutSupplierPayments;

  const netCashFlow = totalCashIn - totalCashOut;

  // Inventory Real-time Valuation
  const inventoryValuationCost = useMemo(() => {
    return batches.reduce((sum, b) => sum + (b.CostPrice * (b.CurrentStock || 0)), 0);
  }, [batches]);

  const inventoryValuationRetail = useMemo(() => {
    return batches.reduce((sum, b) => sum + (b.SellingPrice * (b.CurrentStock || 0)), 0);
  }, [batches]);

  const potentialGrossProfit = inventoryValuationRetail - inventoryValuationCost;

  // Expiry Risk Classification
  const expiryRiskStats = useMemo(() => {
    const nowTime = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    let in30Count = 0;
    let in30Units = 0;
    let in30CostVal = 0;

    let in60Count = 0;
    let in60Units = 0;

    let in90Count = 0;
    let in90Units = 0;

    batches.forEach((b) => {
      if ((b.CurrentStock || 0) <= 0) return;
      const expTime = new Date(b.ExpiryDate).getTime();
      const diffDays = Math.ceil((expTime - nowTime) / dayMs);

      if (diffDays <= 30) {
        in30Count += 1;
        in30Units += b.CurrentStock;
        in30CostVal += b.CostPrice * b.CurrentStock;
      } else if (diffDays <= 60) {
        in60Count += 1;
        in60Units += b.CurrentStock;
      } else if (diffDays <= 90) {
        in90Count += 1;
        in90Units += b.CurrentStock;
      }
    });

    const vaultReconciledSum = expireVault.reduce((sum, v) => sum + (v.ReconciledAmount || 0), 0);

    return {
      in30Count,
      in30Units,
      in30CostVal,
      in60Count,
      in60Units,
      in90Count,
      in90Units,
      vaultItemsCount: expireVault.length,
      vaultReconciledSum,
    };
  }, [batches, expireVault]);

  // Top Selling Medicines
  const topSellingMedicines = useMemo(() => {
    type MedicineSales = {
      medicineId: string;
      tradeName: string;
      genericName: string;
      group: string;
      unitsSold: number;
      revenue: number;
      profit: number;
    };

    const map = new Map<string, MedicineSales>();

    filteredSales.forEach((sale) => {
      sale.Items.forEach((item) => {
        const key = item.MedicineID || item.TradeName;
        const profit = item.TotalPrice - (item.CostPrice * item.Quantity);
        const existing = map.get(key);

        if (!existing) {
          map.set(key, {
            medicineId: item.MedicineID,
            tradeName: item.TradeName,
            genericName: item.GenericName || '',
            group: item.Group || 'General',
            unitsSold: item.Quantity,
            revenue: item.TotalPrice,
            profit,
          });
        } else {
          existing.unitsSold += item.Quantity;
          existing.revenue += item.TotalPrice;
          existing.profit += profit;
        }
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 5);
  }, [filteredSales]);

  // Low Stock Items (Stock <= ReorderLevel)
  const lowStockMedicines = useMemo(() => {
    return medicines
      .map((m) => {
        const medBatches = batches.filter((b) => b.MedicineID === m.MedicineID);
        const totalStock = medBatches.reduce((sum, b) => sum + (b.CurrentStock || 0), 0);
        return {
          ...m,
          currentStock: totalStock,
          batchesCount: medBatches.length,
        };
      })
      .filter((m) => m.currentStock <= (m.ReorderLevel || 10))
      .sort((a, b) => a.currentStock - b.currentStock)
      .slice(0, 5);
  }, [medicines, batches]);

  // Therapeutic Group Revenue & Stock Share
  const groupStats = useMemo(() => {
    const groupRevMap = new Map<string, number>();
    const groupStockMap = new Map<string, number>();

    // Calculate revenue by group
    filteredSales.forEach((s) => {
      s.Items.forEach((item) => {
        const grp = item.Group || 'General';
        groupRevMap.set(grp, (groupRevMap.get(grp) || 0) + item.TotalPrice);
      });
    });

    // Calculate stock by group
    batches.forEach((b) => {
      const grp = b.Group || 'General';
      groupStockMap.set(grp, (groupStockMap.get(grp) || 0) + (b.CurrentStock || 0));
    });

    const allGroups = Array.from(new Set([...groupRevMap.keys(), ...groupStockMap.keys()]));
    const totalGroupRev = Array.from(groupRevMap.values()).reduce((a, b) => a + b, 0) || 1;

    return allGroups.map((grp) => {
      const rev = groupRevMap.get(grp) || 0;
      const stock = groupStockMap.get(grp) || 0;
      const pct = Math.round((rev / totalGroupRev) * 100);
      return { group: grp, revenue: rev, stock, percent: pct };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, batches]);

  // Top Debtors (Customers)
  const topDebtorCustomers = useMemo(() => {
    return customers
      .filter((c) => c.TotalDue > 0)
      .sort((a, b) => b.TotalDue - a.TotalDue)
      .slice(0, 4);
  }, [customers]);

  // Top Creditors (Suppliers)
  const topDueSuppliers = useMemo(() => {
    return suppliers
      .filter((s) => s.TotalDue > 0)
      .sort((a, b) => b.TotalDue - a.TotalDue)
      .slice(0, 4);
  }, [suppliers]);

  // Terminal / Counter-Wise Sales Breakdown
  const terminalStats = useMemo(() => {
    const map = new Map<string, { terminalName: string; count: number; revenue: number }>();
    filteredSales.forEach((s) => {
      const t = s.TerminalName || 'Counter 1 - Fast POS';
      if (!map.has(t)) map.set(t, { terminalName: t, count: 0, revenue: 0 });
      const obj = map.get(t)!;
      obj.count += 1;
      obj.revenue += s.FinalAmount || s.TotalAmount;
    });
    const totalRev = filteredSales.reduce((sum, s) => sum + (s.FinalAmount || s.TotalAmount), 0) || 1;
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        share: Math.round((item.revenue / totalRev) * 100),
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales]);

  // Salesman Performance & Quality Correlation
  const salesmanStats = useMemo(() => {
    const map = new Map<
      string,
      {
        salesmanName: string;
        count: number;
        revenue: number;
        complaintsCount: number;
        shortageCount: number;
      }
    >();

    filteredSales.forEach((s) => {
      const sm = s.SalesmanName || 'General Staff';
      if (!map.has(sm)) {
        map.set(sm, {
          salesmanName: sm,
          count: 0,
          revenue: 0,
          complaintsCount: 0,
          shortageCount: 0,
        });
      }
      const obj = map.get(sm)!;
      obj.count += 1;
      obj.revenue += s.FinalAmount || s.TotalAmount;
    });

    complaints.forEach((c) => {
      const sm = c.SalesmanName || 'General Staff';
      if (map.has(sm)) {
        map.get(sm)!.complaintsCount += 1;
        if (c.Category === 'Medicine Missed / Short Dispensed') {
          map.get(sm)!.shortageCount += 1;
        }
      }
    });

    return Array.from(map.values())
      .map((sm) => ({
        ...sm,
        avgTicket: sm.count > 0 ? sm.revenue / sm.count : 0,
        qualityScore:
          sm.count > 0
            ? Math.max(0, Math.round(((sm.count - sm.complaintsCount) / sm.count) * 100))
            : 100,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, complaints]);

  // Active Complaints & Coaching Alerts
  const coachingAlerts = useMemo(() => {
    return complaints.filter(
      (c) => c.Status === 'Pending / Under Review' || c.Status === 'Investigating'
    );
  }, [complaints]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* Executive Header Bar */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-600/50 flex items-center justify-center text-emerald-400 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">
                Executive Analytics & Operations Summary
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
                Default Admin Launchpad
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live enterprise summary: Revenue, profit margins, receivables, payables, stock valuation, and expiry watchdog.
            </p>
          </div>
        </div>

        {/* Timeframe & Action Bar */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Timeframe Pills */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setTimeframe('today')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                timeframe === 'today'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeframe('week')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                timeframe === 'week'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setTimeframe('month')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                timeframe === 'month'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setTimeframe('all')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                timeframe === 'all'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            className={`p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-all ${
              isRefreshing ? 'animate-spin text-emerald-400' : ''
            }`}
            title="Refresh Real-Time Analytics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Print Summary */}
          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Analytics View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Row 1: High Impact Financial Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          {/* Card 1: Sales Revenue */}
          <div
            onClick={() => onNavigate('pos')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Sales Revenue
              </span>
              <div className="w-6 h-6 rounded bg-emerald-950 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-lg font-bold text-white font-mono block">
                {formatCurrency(totalRevenue)}
              </span>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 mt-0.5">
                <ArrowUpRight className="w-3 h-3" />
                <span>{filteredSales.length} receipts dispensed</span>
              </div>
            </div>
          </div>

          {/* Card 2: Gross Profit & Margin */}
          <div
            onClick={() => onNavigate('profit')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer group shadow-xs"
            title="Open comprehensive Profit & Margins Intelligence Ledger"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-emerald-300 transition-colors">
                Gross Profit
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-800/40">
                {grossProfitMargin.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2">
              <span className="text-lg font-bold text-emerald-400 font-mono block">
                {formatCurrency(totalGrossProfit)}
              </span>
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-0.5">
                <span className="truncate">COGS: {formatCurrency(totalCostOfGoodsSold)}</span>
                <span className="text-emerald-400/80 text-[9px] group-hover:underline">Audit &rarr;</span>
              </div>
            </div>
          </div>

          {/* Card 3: Accounts Receivable (Customer Due) */}
          <div
            onClick={() => onNavigate('customers')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 transition-all cursor-pointer group shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
                Customer Dues
              </span>
              <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950 px-1 py-0.2 rounded border border-amber-800/60">
                {customers.filter((c) => c.TotalDue > 0).length} Due
              </span>
            </div>
            <div className="mt-2">
              <span className="text-lg font-bold text-amber-400 font-mono block">
                {formatCurrency(totalCustomerReceivables)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block group-hover:text-amber-300 transition-colors">
                Pending collections &rarr;
              </span>
            </div>
          </div>

          {/* Card 4: Accounts Payable (Supplier Due) */}
          <div
            onClick={() => onNavigate('suppliers')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-rose-500/50 transition-all cursor-pointer group shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-rose-300 uppercase tracking-wider">
                Supplier Dues
              </span>
              <span className="text-[9px] font-mono font-bold text-rose-300 bg-rose-950 px-1 py-0.2 rounded border border-rose-800/60">
                {suppliers.filter((s) => s.TotalDue > 0).length} Due
              </span>
            </div>
            <div className="mt-2">
              <span className="text-lg font-bold text-rose-400 font-mono block">
                {formatCurrency(totalSupplierPayables)}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block group-hover:text-rose-300 transition-colors">
                Accounts payable &rarr;
              </span>
            </div>
          </div>

          {/* Card 5: Inventory Valuation (Retail MRP) */}
          <div
            onClick={() => onNavigate('batches')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Retail Valuation
              </span>
              <div className="w-6 h-6 rounded bg-blue-950 text-blue-400 flex items-center justify-center">
                <Boxes className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-lg font-bold text-white font-mono block">
                {formatCurrency(inventoryValuationRetail)}
              </span>
              <span className="text-[10px] text-blue-400 mt-0.5 block">
                Spread: +{formatCurrency(potentialGrossProfit)}
              </span>
            </div>
          </div>

          {/* Card 6: Cost Basis Tied in Stock */}
          <div
            onClick={() => onNavigate('batches')}
            className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-indigo-500/50 transition-all cursor-pointer group shadow-xs"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Stock Cost Basis
              </span>
              <div className="w-6 h-6 rounded bg-indigo-950 text-indigo-400 flex items-center justify-center">
                <Pill className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-lg font-bold text-indigo-300 font-mono block">
                {formatCurrency(inventoryValuationCost)}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block">
                {systemStats.totalStockUnits} total units in stock
              </span>
            </div>
          </div>

          {/* Card 7: Net Cash Position */}
          <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Net Cash Flow
              </span>
              <div className="w-6 h-6 rounded bg-emerald-950 text-emerald-400 flex items-center justify-center">
                <Wallet className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <span
                className={`text-lg font-bold font-mono block ${
                  netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {formatCurrency(netCashFlow)}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                In: {formatCurrency(totalCashIn)} · Out: {formatCurrency(totalCashOut)}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Operational Domain Breakdowns (Two Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Column 1: Fast Movers & Sales Performance (1 col) */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                  Top Selling Medicines
                </h3>
              </div>
              <button
                onClick={() => onNavigate('pos')}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>POS Terminal</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {topSellingMedicines.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No sales recorded in the selected timeframe.
                </div>
              ) : (
                topSellingMedicines.map((m, idx) => (
                  <div
                    key={m.medicineId || m.tradeName}
                    className="p-2 rounded bg-slate-900/70 border border-slate-850 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded bg-slate-800 text-slate-300 font-bold font-mono text-[10px] flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0 truncate">
                        <div className="font-semibold text-slate-100 truncate">{m.tradeName}</div>
                        <div className="text-[10px] text-slate-500 truncate">{m.group}</div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-bold text-white text-xs">
                        {m.unitsSold} sold
                      </div>
                      <div className="text-[10px] font-mono text-emerald-400 font-medium">
                        {formatCurrency(m.revenue)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Inventory Stock Watch & Expiry Risk Matrix (1 col) */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                  Stock Watch & Expiry Matrix
                </h3>
              </div>
              <button
                onClick={() => onNavigate('expire')}
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
              >
                <span>Expire Vault</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Expiry Risk Counter Grid */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-rose-950/40 border border-rose-800/40">
                <span className="text-[10px] text-rose-300 block font-medium">&le; 30 Days</span>
                <span className="font-bold text-rose-400 font-mono text-sm block mt-0.5">
                  {expiryRiskStats.in30Units}
                </span>
                <span className="text-[9px] text-slate-400 block">{expiryRiskStats.in30Count} batches</span>
              </div>

              <div className="p-2 rounded bg-amber-950/40 border border-amber-800/40">
                <span className="text-[10px] text-amber-300 block font-medium">31 - 60 Days</span>
                <span className="font-bold text-amber-400 font-mono text-sm block mt-0.5">
                  {expiryRiskStats.in60Units}
                </span>
                <span className="text-[9px] text-slate-400 block">{expiryRiskStats.in60Count} batches</span>
              </div>

              <div className="p-2 rounded bg-blue-950/40 border border-blue-800/40">
                <span className="text-[10px] text-blue-300 block font-medium">61 - 90 Days</span>
                <span className="font-bold text-blue-400 font-mono text-sm block mt-0.5">
                  {expiryRiskStats.in90Units}
                </span>
                <span className="text-[9px] text-slate-400 block">{expiryRiskStats.in90Count} batches</span>
              </div>
            </div>

            {/* Low Stock Alert List */}
            <div className="pt-1">
              <div className="text-[11px] text-slate-400 font-medium mb-1.5 flex items-center justify-between">
                <span>Critical Reorder Alert Items:</span>
                <button
                  onClick={() => onNavigate('medicines')}
                  className="text-[10px] text-slate-400 hover:text-white"
                >
                  View All ({medicines.length})
                </button>
              </div>

              <div className="space-y-1.5">
                {lowStockMedicines.length === 0 ? (
                  <div className="text-[11px] text-slate-500 py-2 text-center">
                    All inventory items above reorder thresholds.
                  </div>
                ) : (
                  lowStockMedicines.map((m) => (
                    <div
                      key={m.MedicineID}
                      className="p-1.5 rounded bg-slate-900 border border-slate-850 flex items-center justify-between text-[11px]"
                    >
                      <div className="min-w-0 truncate">
                        <span className="font-semibold text-slate-200 truncate block">{m.TradeName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Reorder at: {m.ReorderLevel || 10} units
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            m.currentStock === 0
                              ? 'bg-rose-950 text-rose-400 border border-rose-800/60'
                              : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                          }`}
                        >
                          {m.currentStock} in stock
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Column 3: Therapeutic Group Revenue Breakdown (1 col) */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                  Therapeutic Group Share
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {groupStats.length} Active Groups
              </span>
            </div>

            <div className="space-y-2.5">
              {groupStats.slice(0, 6).map((grp) => (
                <div key={grp.group} className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200 text-[11px]">{grp.group}</span>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span className="text-slate-400">{grp.stock} units</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(grp.revenue)}</span>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(5, Math.min(100, grp.percent))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Outstanding Receivables & Payables Watchdog */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Customer Receivables Watchlist */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                  Customer Receivables Watchlist
                </h3>
              </div>
              <button
                onClick={() => onNavigate('customers')}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Customer Ledger</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {topDebtorCustomers.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  All customer accounts are settled with zero outstanding dues.
                </div>
              ) : (
                topDebtorCustomers.map((c) => (
                  <div
                    key={c.CustomerID}
                    onClick={() => onNavigate('customers')}
                    className="p-2.5 rounded bg-slate-900/70 hover:bg-slate-900 border border-slate-850 flex items-center justify-between text-xs cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{c.Name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {c.Phone} · {c.Address}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-amber-400 text-sm">
                        {formatCurrency(c.TotalDue)}
                      </div>
                      <span className="text-[10px] text-emerald-400 hover:underline">
                        Collect due &rarr;
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Supplier Payables Watchlist */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                  Supplier Payables & Vendor Liabilities
                </h3>
              </div>
              <button
                onClick={() => onNavigate('suppliers')}
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Supplier Ledger</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {topDueSuppliers.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  All supplier liabilities settled in full.
                </div>
              ) : (
                topDueSuppliers.map((s) => (
                  <div
                    key={s.SupplierID}
                    onClick={() => onNavigate('suppliers')}
                    className="p-2.5 rounded bg-slate-900/70 hover:bg-slate-900 border border-slate-850 flex items-center justify-between text-xs cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{s.Name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Default Discount: {s.DefaultDiscountPercent}% · {s.Phone}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-rose-400 text-sm">
                        {formatCurrency(s.TotalDue)}
                      </div>
                      <span className="text-[10px] text-emerald-400 hover:underline">
                        Disburse payment &rarr;
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Row 4: Terminal-Wise Breakdown, Salesman Performance & Grievance Coaching Intelligence */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Column 1: Counter / Terminal-Wise Sales Breakdown */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-purple-400" />
                <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                  Terminal / Counter Breakdown
                </h3>
              </div>
              <button
                onClick={() => onNavigate('salesLedger')}
                className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
              >
                <span>Sale Ledger</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {terminalStats.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No terminal data recorded for this period.
                </div>
              ) : (
                terminalStats.map((t) => (
                  <div key={t.terminalName} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-200 text-[11px] flex items-center gap-1">
                        <Store className="w-3 h-3 text-purple-400" />
                        <span>{t.terminalName}</span>
                      </span>
                      <div className="flex items-center gap-2 font-mono text-[10px]">
                        <span className="text-slate-400">{t.count} bills</span>
                        <span className="text-emerald-400 font-bold">{formatCurrency(t.revenue)}</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                      <div
                        className="bg-purple-500 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(5, Math.min(100, t.share))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Contribution: {t.share}%</span>
                      <span>Avg: {formatCurrency(t.count > 0 ? t.revenue / t.count : 0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: Salesman Performance Summary */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                  Salesman Performance Leaderboard
                </h3>
              </div>
              <button
                onClick={() => onNavigate('salesLedger')}
                className="text-[11px] text-amber-400 hover:underline flex items-center gap-1"
              >
                <span>Full Ledger</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {salesmanStats.map((sm, idx) => (
                <div
                  key={sm.salesmanName}
                  className="p-2 rounded bg-slate-900/70 border border-slate-850 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded bg-slate-800 text-amber-400 font-bold font-mono text-[10px] flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0 truncate">
                      <div className="font-semibold text-slate-100 truncate">{sm.salesmanName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {sm.count} bills · Avg {formatCurrency(sm.avgTicket)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono font-bold text-emerald-400 text-xs">
                      {formatCurrency(sm.revenue)}
                    </div>
                    <div className="text-[9px] font-mono">
                      {sm.complaintsCount > 0 ? (
                        <span className="text-rose-400 font-semibold">{sm.complaintsCount} complaints</span>
                      ) : (
                        <span className="text-emerald-400">100% Quality</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Salesman Quality, Missed Items & Coaching Desk */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="w-4 h-4 text-rose-400" />
                <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
                  Quality & Coaching Desk
                </h3>
              </div>
              <button
                onClick={() => onNavigate('complaints')}
                className="text-[11px] text-rose-400 hover:underline flex items-center gap-1"
              >
                <span>Complain Box</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {coachingAlerts.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Zero pending complaints. Dispenser accuracy is 100%.
                </div>
              ) : (
                coachingAlerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.ComplaintID}
                    onClick={() => onNavigate('complaints')}
                    className="p-2 rounded bg-rose-950/30 hover:bg-rose-950/50 border border-rose-900/60 cursor-pointer transition-colors text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[10px] text-rose-300">
                        {alert.ReceiptNumber}
                      </span>
                      <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-rose-900 text-rose-200">
                        {alert.Status}
                      </span>
                    </div>

                    <div className="text-slate-200 font-medium text-[11px] truncate">
                      {alert.CustomerName} &bull; <span className="text-amber-300">{alert.SalesmanName}</span>
                    </div>

                    {alert.ShortOrMissedMedicine && (
                      <div className="text-[10px] text-amber-200 flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                        <span>{alert.ShortOrMissedMedicine}</span>
                      </div>
                    )}

                    {alert.SalesmanCoachingNotes && (
                      <p className="text-[9px] text-cyan-300 italic truncate">
                        Coaching: {alert.SalesmanCoachingNotes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => onNavigate('complaints')}
              className="w-full py-1.5 rounded bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs font-semibold border border-slate-800 transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageSquareWarning className="w-3.5 h-3.5 text-rose-400" />
              <span>Open Salesman Coaching Desk &rarr;</span>
            </button>
          </div>
        </div>

        {/* Row 5: Quick Navigation Launchpad for Admin */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-400 font-medium">Direct Operations Quick-Jump:</span>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onNavigate('salesLedger')}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Sale Ledger & Receipts</span>
            </button>
            <button
              onClick={() => onNavigate('complaints')}
              className="px-3 py-1.5 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 font-medium flex items-center gap-1.5 transition-colors"
            >
              <MessageSquareWarning className="w-3.5 h-3.5 text-rose-400" />
              <span>Complain Box ({coachingAlerts.length})</span>
            </button>
            <button
              onClick={() => onNavigate('pos')}
              className="px-3 py-1.5 rounded bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition-colors"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Fast POS (F1)</span>
            </button>
            <button
              onClick={() => onNavigate('purchases')}
              className="px-3 py-1.5 rounded bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Truck className="w-3.5 h-3.5 text-blue-400" />
              <span>Purchases</span>
            </button>
            <button
              onClick={() => onNavigate('ai')}
              className="px-3 py-1.5 rounded bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>AI Purchasing</span>
            </button>
            <button
              onClick={() => onNavigate('expire')}
              className="px-3 py-1.5 rounded bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Expire Vault</span>
            </button>
            <button
              onClick={() => onNavigate('database')}
              className="px-3 py-1.5 rounded bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>SQL Server Console</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
