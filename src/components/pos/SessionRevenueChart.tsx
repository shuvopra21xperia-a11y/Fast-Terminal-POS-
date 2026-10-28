/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PharmaCore Retail POS: Session Performance & Daily Sales Revenue Chart
 * Powered by Recharts
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  Clock,
  UserCheck,
  CreditCard,
  Banknote,
  Smartphone,
  X,
  Receipt,
  Sparkles,
  BarChart2,
} from 'lucide-react';
import { Sale, ThemeType, User } from '../../types/pharmacy';

interface ChartPoint {
  date: string;
  label: string;
  fullLabel: string;
  revenue: number;
  invoices: number;
  cash: number;
  card: number;
  mfs: number;
  isToday: boolean;
  isCurrentHour: boolean;
}

interface SessionRevenueChartProps {
  sales: Sale[];
  currentUser: User | null;
  currencySymbol: string;
  theme: ThemeType;
  isOpen: boolean;
  onClose: () => void;
}

export const SessionRevenueChart: React.FC<SessionRevenueChartProps> = ({
  sales,
  currentUser,
  currencySymbol,
  theme,
  isOpen,
  onClose,
}) => {
  const [timeframe, setTimeframe] = useState<'daily' | 'hourly'>('daily');
  const [filterUserOnly, setFilterUserOnly] = useState<boolean>(true);

  const isLight = theme !== 'dark';

  // Current session sales filtered by current logged-in user
  const relevantSales = useMemo(() => {
    if (!filterUserOnly || !currentUser) {
      return sales;
    }
    const userFiltered = sales.filter(
      (s) =>
        s.SalesmanID === currentUser.UserID ||
        s.SalesmanName.toLowerCase().includes(currentUser.Username.toLowerCase()) ||
        s.SalesmanName.toLowerCase().includes((currentUser.FullName || '').toLowerCase())
    );
    // If user has zero recorded sales, fallback gracefully to all sales
    return userFiltered.length > 0 ? userFiltered : sales;
  }, [sales, currentUser, filterUserOnly]);

  // Today's Date String in local format (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Today's Sales & KPIs for Current User
  const todayStats = useMemo(() => {
    const todaySales = relevantSales.filter((s) => {
      const saleDateStr = s.SaleDate.substring(0, 10);
      return saleDateStr === todayStr;
    });

    const revenue = todaySales.reduce((acc, s) => acc + s.FinalAmount, 0);
    const invoiceCount = todaySales.length;
    const avgBasket = invoiceCount > 0 ? revenue / invoiceCount : 0;
    const cashTotal = todaySales
      .filter((s) => s.PaymentMethod === 'Cash')
      .reduce((acc, s) => acc + s.FinalAmount, 0);
    const cardTotal = todaySales
      .filter((s) => s.PaymentMethod === 'Card')
      .reduce((acc, s) => acc + s.FinalAmount, 0);
    const mfsTotal = todaySales
      .filter((s) => s.PaymentMethod === 'Digital / MFS')
      .reduce((acc, s) => acc + s.FinalAmount, 0);

    const maxSale = todaySales.reduce((max, s) => Math.max(max, s.FinalAmount), 0);

    return {
      revenue,
      invoiceCount,
      avgBasket,
      cashTotal,
      cardTotal,
      mfsTotal,
      maxSale,
    };
  }, [relevantSales, todayStr]);

  // 7-Day Daily Data Aggregation (From 6 days ago up to today)
  const dailyData = useMemo<ChartPoint[]>(() => {
    const days: ChartPoint[] = [];

    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);

      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${dayNum}`;

      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      const isToday = i === 0;

      const matchingSales = relevantSales.filter((s) => s.SaleDate.startsWith(dateKey));

      const rev = matchingSales.reduce((acc, s) => acc + s.FinalAmount, 0);
      const invoices = matchingSales.length;
      const cash = matchingSales
        .filter((s) => s.PaymentMethod === 'Cash')
        .reduce((acc, s) => acc + s.FinalAmount, 0);
      const card = matchingSales
        .filter((s) => s.PaymentMethod === 'Card')
        .reduce((acc, s) => acc + s.FinalAmount, 0);
      const mfs = matchingSales
        .filter((s) => s.PaymentMethod === 'Digital / MFS')
        .reduce((acc, s) => acc + s.FinalAmount, 0);

      days.push({
        date: dateKey,
        label: isToday ? `Today (${dayNum})` : `${weekday} ${dayNum}`,
        fullLabel: isToday ? `Today (${monthName} ${dayNum})` : `${weekday}, ${monthName} ${dayNum}`,
        revenue: Math.round(rev * 100) / 100,
        invoices,
        cash,
        card,
        mfs,
        isToday,
        isCurrentHour: false,
      });
    }

    return days;
  }, [relevantSales]);

  // Today's Hourly Data Aggregation (e.g. 09:00 - 21:00)
  const hourlyData = useMemo<ChartPoint[]>(() => {
    const hours: ChartPoint[] = [];

    const currentHour = new Date().getHours();
    const todaySales = relevantSales.filter((s) => s.SaleDate.startsWith(todayStr));

    for (let h = 8; h <= 21; h++) {
      const hStr = h < 12 ? `${h}:00 AM` : h === 12 ? `12:00 PM` : `${h - 12}:00 PM`;

      const matchedSales = todaySales.filter((s) => {
        try {
          const sHour = new Date(s.SaleDate).getHours();
          return sHour === h;
        } catch {
          return false;
        }
      });

      const rev = matchedSales.reduce((acc, s) => acc + s.FinalAmount, 0);

      hours.push({
        date: todayStr,
        label: hStr,
        fullLabel: `Today @ ${hStr}`,
        revenue: Math.round(rev * 100) / 100,
        invoices: matchedSales.length,
        cash: matchedSales
          .filter((s) => s.PaymentMethod === 'Cash')
          .reduce((acc, s) => acc + s.FinalAmount, 0),
        card: matchedSales
          .filter((s) => s.PaymentMethod === 'Card')
          .reduce((acc, s) => acc + s.FinalAmount, 0),
        mfs: matchedSales
          .filter((s) => s.PaymentMethod === 'Digital / MFS')
          .reduce((acc, s) => acc + s.FinalAmount, 0),
        isToday: true,
        isCurrentHour: h === currentHour,
      });
    }

    return hours;
  }, [relevantSales, todayStr]);

  const activeChartData: ChartPoint[] = timeframe === 'daily' ? dailyData : hourlyData;

  // Custom Interactive Tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          className={`p-3 rounded-lg shadow-xl border text-xs space-y-1.5 backdrop-blur-md ${
            isLight
              ? 'bg-white/95 border-slate-200 text-slate-800'
              : 'bg-slate-900/95 border-slate-700 text-white'
          }`}
        >
          <div className="flex items-center justify-between gap-3 border-b pb-1 border-slate-700/40">
            <span className="font-bold text-xs">{data.fullLabel || label}</span>
            {data.isToday && (
              <span className="text-[10px] bg-emerald-500 text-slate-950 font-bold px-1.5 py-0.2 rounded">
                Active Session
              </span>
            )}
          </div>

          <div className="text-base font-bold font-mono text-emerald-400">
            {currencySymbol}
            {data.revenue.toFixed(2)}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Receipt className="w-3.5 h-3.5" />
            <span>
              {data.invoices} {data.invoices === 1 ? 'sale completed' : 'sales completed'}
            </span>
          </div>

          {data.revenue > 0 && (
            <div className="pt-1 border-t border-slate-700/40 space-y-0.5 text-[10px] text-slate-400 font-mono">
              <div className="flex justify-between">
                <span>Cash:</span>
                <span className="text-slate-200">
                  {currencySymbol}
                  {data.cash.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Card:</span>
                <span className="text-slate-200">
                  {currencySymbol}
                  {data.card.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Digital / MFS:</span>
                <span className="text-slate-200">
                  {currencySymbol}
                  {data.mfs.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div
      className={`border-b transition-all select-none ${
        isLight
          ? 'bg-slate-100 border-slate-200 text-slate-900'
          : 'bg-slate-900 border-slate-800 text-slate-100'
      }`}
    >
      <div className="p-3.5 space-y-3">
        {/* Top Header Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-white">
                  Daily Sales Revenue · Session Performance
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Recharts Engine Active</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                <UserCheck className="w-3 h-3 text-emerald-400" />
                <span>Salesman:</span>
                <strong className="text-emerald-300 font-semibold">
                  {currentUser?.FullName || 'POS Salesman'}
                </strong>
                <span className="text-slate-500">({currentUser?.Role || 'Salesman'})</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Timeframe Toggle */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setTimeframe('daily')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  timeframe === 'daily'
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>Last 7 Days (Daily)</span>
              </button>
              <button
                type="button"
                onClick={() => setTimeframe('hourly')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1 transition-colors ${
                  timeframe === 'hourly'
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>Today (Hourly)</span>
              </button>
            </div>

            {/* Filter Toggle: Current User vs All Registers */}
            <button
              type="button"
              onClick={() => setFilterUserOnly(!filterUserOnly)}
              className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-colors ${
                filterUserOnly
                  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
              }`}
              title="Toggle between sales for your current logged-in shift vs all store registers"
            >
              {filterUserOnly ? '👤 My Session Only' : '🏪 All Cashier Registers'}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Collapse Chart (F4)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Session Performance KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
          {/* KPI 1: Today's Revenue */}
          <div
            className={`p-2.5 rounded-lg border ${
              isLight
                ? 'bg-white border-slate-200'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
              <span className="font-semibold uppercase tracking-wider">Today's Revenue</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-bold font-mono text-emerald-400">
              {currencySymbol}
              {todayStats.revenue.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Current active shift performance
            </div>
          </div>

          {/* KPI 2: Invoices Completed */}
          <div
            className={`p-2.5 rounded-lg border ${
              isLight
                ? 'bg-white border-slate-200'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
              <span className="font-semibold uppercase tracking-wider">Invoices Billed</span>
              <Receipt className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="text-lg font-bold font-mono text-white">
              {todayStats.invoiceCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Patients served today
            </div>
          </div>

          {/* KPI 3: Average Basket Value (AOV) */}
          <div
            className={`p-2.5 rounded-lg border ${
              isLight
                ? 'bg-white border-slate-200'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
              <span className="font-semibold uppercase tracking-wider">Avg Transaction</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-bold font-mono text-amber-300">
              {currencySymbol}
              {todayStats.avgBasket.toFixed(2)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Highest sale: {currencySymbol}{todayStats.maxSale.toFixed(2)}
            </div>
          </div>

          {/* KPI 4: Payment Method Split */}
          <div
            className={`p-2.5 rounded-lg border ${
              isLight
                ? 'bg-white border-slate-200'
                : 'bg-slate-950/80 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
              <span className="font-semibold uppercase tracking-wider">Tender Collections</span>
              <Banknote className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] font-semibold text-slate-200">
              <span className="flex items-center gap-1 text-emerald-400" title="Cash">
                <Banknote className="w-3 h-3" />
                {currencySymbol}{todayStats.cashTotal.toFixed(0)}
              </span>
              <span className="flex items-center gap-1 text-sky-400" title="Card">
                <CreditCard className="w-3 h-3" />
                {currencySymbol}{todayStats.cardTotal.toFixed(0)}
              </span>
              <span className="flex items-center gap-1 text-purple-400" title="Digital/MFS">
                <Smartphone className="w-3 h-3" />
                {currencySymbol}{todayStats.mfsTotal.toFixed(0)}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Cash vs Card vs Digital
            </div>
          </div>
        </div>

        {/* Recharts BarChart Area */}
        <div
          className={`p-3 rounded-lg border ${
            isLight
              ? 'bg-white border-slate-200'
              : 'bg-slate-950/90 border-slate-800'
          }`}
        >
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeChartData}
                margin={{ top: 10, right: 15, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={isLight ? '#e2e8f0' : '#2f405e'}
                />
                <XAxis
                  dataKey="label"
                  stroke={isLight ? '#475569' : '#cbd5e1'}
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: isLight ? '#cbd5e1' : '#42567a' }}
                />
                <YAxis
                  stroke={isLight ? '#475569' : '#cbd5e1'}
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: any) => `${currencySymbol}${val}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="revenue"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                  animationDuration={600}
                >
                  {activeChartData.map((entry: any, index: number) => {
                    const isHighlighted =
                      timeframe === 'daily' ? entry.isToday : entry.isCurrentHour;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isHighlighted ? '#10b981' : '#6366f1'}
                        fillOpacity={isHighlighted ? 1 : 0.85}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-800/60 text-[10px] text-slate-400">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />
                <span className="text-slate-300">
                  {timeframe === 'daily' ? "Today's Active Shift" : 'Current Hour'}
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-indigo-500 inline-block" />
                <span className="text-slate-400">
                  {timeframe === 'daily' ? 'Prior Days Revenue' : 'Past Hours'}
                </span>
              </span>
            </div>

            <span className="italic text-slate-500">
              💡 Posting new sales in POS instantly updates this chart in real-time.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
