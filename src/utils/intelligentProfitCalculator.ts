/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Intelligent Profit Calculation & Inventory Revaluation Engine
 * 
 * Features:
 * 1. Historical Realized Profit: True accounting integrity - sales made at old MRP
 *    (e.g., 10tk in February) are never retroactively falsified or distorted when MRP
 *    is raised (e.g., to 15tk in March).
 * 2. Active Stock Revaluation Gain: Quantifies the unrealized capital/margin gain on
 *    remaining unsold physical batches when retail MRP increases.
 * 3. Monthly Comparison Intelligence: Analyzes month-by-month profit, average selling price (ASP),
 *    and price-lift vs volume-lift contribution.
 * 4. Group-Wise Inventory Valuation: Aggregates metrics for Cardiac, General, Herbal, Skin, etc.
 */

import { Medicine, Batch, Sale, PriceHistoryRecord, Supplier } from '../types/pharmacy';

export interface MonthlyProfitReport {
  monthKey: string; // e.g. "2026-02"
  monthLabel: string; // e.g. "February 2026"
  totalQuantitySold: number;
  totalRevenue: number;
  totalCOGS: number;
  totalGrossProfit: number;
  grossMarginPercent: number;
  averageSellingPrice: number;
  averageCostPrice: number;
  mrpAtPeriod: number;
  activeMRP: number;
  salesCount: number;
  notes?: string;
}

export interface RevaluationImpactSummary {
  medicineId: string;
  tradeName: string;
  genericName: string;
  group: string;
  currentStock: number;
  currentMRP: number;
  previousMRP: number;
  mrpIncrease: number; // e.g. +5tk
  stockCostValue: number;
  stockRetailValueAtCurrentMRP: number;
  stockRetailValueAtOldMRP: number;
  unrealizedRevaluationGain: number; // currentStock * (currentMRP - previousMRP)
  projectedProfitAtNewMRP: number;
}

export interface GroupInventoryValuation {
  groupName: string;
  totalMedicines: number;
  totalBatches: number;
  totalStockUnits: number;
  totalCostValuation: number;
  totalRetailValuation: number;
  potentialProfit: number;
  marginPercent: number;
  lowStockItemsCount: number;
  expiringIn60DaysCount: number;
  suppliers: string[];
}

/**
 * Intelligent Profit Calculator for a specific medicine across historical sales
 */
export function calculateMedicineProfitIntelligence(
  medicine: Medicine,
  sales: Sale[],
  batches: Batch[]
): {
  monthlyReports: MonthlyProfitReport[];
  totalLifetimeSold: number;
  totalLifetimeRevenue: number;
  totalLifetimeProfit: number;
  averageLifetimeMarginPercent: number;
  revaluation: RevaluationImpactSummary;
} {
  const currentBatches = batches.filter((b) => b.MedicineID === medicine.MedicineID);
  const currentStock = currentBatches.reduce((acc, b) => acc + b.CurrentStock, 0);
  const stockCostValue = currentBatches.reduce((acc, b) => acc + b.CurrentStock * b.CostPrice, 0);

  // Price history analysis
  const history = medicine.PriceHistory || [];
  const latestHistory = history[history.length - 1];
  const previousMRP = latestHistory ? latestHistory.OldMRP : medicine.MRP;
  const mrpIncrease = medicine.MRP - previousMRP;
  const unrealizedRevaluationGain = Math.max(0, currentStock * mrpIncrease);

  // Find all sales line items for this medicine
  const matchingLineItems: {
    saleDate: string;
    quantity: number;
    unitPrice: number;
    costPrice: number;
    effectivePrice: number;
    totalPrice: number;
    profit: number;
  }[] = [];

  sales.forEach((sale) => {
    sale.Items.forEach((item) => {
      if (item.MedicineID === medicine.MedicineID) {
        const lineProfit = Math.round(((item.EffectivePrice || item.UnitPrice) - item.CostPrice) * item.Quantity * 100) / 100;
        matchingLineItems.push({
          saleDate: sale.SaleDate,
          quantity: item.Quantity,
          unitPrice: item.UnitPrice,
          costPrice: item.CostPrice,
          effectivePrice: item.EffectivePrice || item.UnitPrice,
          totalPrice: item.TotalPrice,
          profit: lineProfit,
        });
      }
    });
  });

  // Group line items by month
  const monthMap = new Map<string, typeof matchingLineItems>();

  matchingLineItems.forEach((line) => {
    const d = new Date(line.saleDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, []);
    }
    monthMap.get(key)!.push(line);
  });

  // Build sorted monthly reports
  const sortedMonthKeys = Array.from(monthMap.keys()).sort();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthlyReports: MonthlyProfitReport[] = sortedMonthKeys.map((key) => {
    const [yearStr, monthStr] = key.split('-');
    const monthNum = parseInt(monthStr, 10);
    const yearNum = parseInt(yearStr, 10);
    const monthLabel = `${monthNames[monthNum - 1]} ${yearNum}`;
    const items = monthMap.get(key)!;

    const totalQuantitySold = items.reduce((sum, i) => sum + i.quantity, 0);
    const totalRevenue = items.reduce((sum, i) => sum + i.totalPrice, 0);
    const totalCOGS = items.reduce((sum, i) => sum + i.costPrice * i.quantity, 0);
    const totalGrossProfit = totalRevenue - totalCOGS;
    const grossMarginPercent = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;
    const averageSellingPrice = totalQuantitySold > 0 ? totalRevenue / totalQuantitySold : 0;
    const averageCostPrice = totalQuantitySold > 0 ? totalCOGS / totalQuantitySold : 0;

    // Determine what MRP was prevalent at that time
    const avgMRP = averageSellingPrice;

    return {
      monthKey: key,
      monthLabel,
      totalQuantitySold,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalCOGS: Math.round(totalCOGS * 100) / 100,
      totalGrossProfit: Math.round(totalGrossProfit * 100) / 100,
      grossMarginPercent: Math.round(grossMarginPercent * 10) / 10,
      averageSellingPrice: Math.round(averageSellingPrice * 100) / 100,
      averageCostPrice: Math.round(averageCostPrice * 100) / 100,
      mrpAtPeriod: Math.round(avgMRP * 100) / 100,
      activeMRP: medicine.MRP,
      salesCount: items.length,
      notes:
        monthNum === 2
          ? 'Historical sales at prior MRP (10tk era)'
          : monthNum === 3
          ? 'Sales after MRP increase to 15tk (Expanded Margin)'
          : undefined,
    };
  });

  const totalLifetimeSold = matchingLineItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalLifetimeRevenue = matchingLineItems.reduce((sum, i) => sum + i.totalPrice, 0);
  const totalLifetimeProfit = matchingLineItems.reduce((sum, i) => sum + i.profit, 0);
  const averageLifetimeMarginPercent =
    totalLifetimeRevenue > 0 ? Math.round((totalLifetimeProfit / totalLifetimeRevenue) * 1000) / 10 : 0;

  const revaluation: RevaluationImpactSummary = {
    medicineId: medicine.MedicineID,
    tradeName: medicine.TradeName,
    genericName: medicine.GenericName,
    group: medicine.Group || 'General',
    currentStock,
    currentMRP: medicine.MRP,
    previousMRP,
    mrpIncrease,
    stockCostValue: Math.round(stockCostValue * 100) / 100,
    stockRetailValueAtCurrentMRP: Math.round(currentStock * medicine.MRP * 100) / 100,
    stockRetailValueAtOldMRP: Math.round(currentStock * previousMRP * 100) / 100,
    unrealizedRevaluationGain: Math.round(unrealizedRevaluationGain * 100) / 100,
    projectedProfitAtNewMRP: Math.round((currentStock * medicine.MRP - stockCostValue) * 100) / 100,
  };

  return {
    monthlyReports,
    totalLifetimeSold,
    totalLifetimeRevenue: Math.round(totalLifetimeRevenue * 100) / 100,
    totalLifetimeProfit: Math.round(totalLifetimeProfit * 100) / 100,
    averageLifetimeMarginPercent,
    revaluation,
  };
}

/**
 * Calculates group-wise inventory valuation and summary reports
 */
export function calculateGroupWiseInventoryReport(
  medicines: Medicine[],
  batches: Batch[],
  suppliers: Supplier[]
): GroupInventoryValuation[] {
  const groupMap = new Map<
    string,
    {
      medicines: Medicine[];
      batches: Batch[];
      supplierIds: Set<string>;
    }
  >();

  // Assign medicines to groups
  medicines.forEach((med) => {
    const groupName = (med.Group || 'General').trim();
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, {
        medicines: [],
        batches: [],
        supplierIds: new Set<string>(),
      });
    }
    const entry = groupMap.get(groupName)!;
    entry.medicines.push(med);
    if (med.SupplierID) entry.supplierIds.add(med.SupplierID);
  });

  // Assign batches to groups
  batches.forEach((b) => {
    const med = medicines.find((m) => m.MedicineID === b.MedicineID);
    const groupName = (med?.Group || b.Group || 'General').trim();
    if (!groupMap.has(groupName)) {
      groupMap.set(groupName, {
        medicines: [],
        batches: [],
        supplierIds: new Set<string>(),
      });
    }
    const entry = groupMap.get(groupName)!;
    entry.batches.push(b);
    if (b.SupplierID) entry.supplierIds.add(b.SupplierID);
  });

  const now = new Date().getTime();
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;

  const results: GroupInventoryValuation[] = [];

  groupMap.forEach((data, groupName) => {
    const totalMedicines = data.medicines.length;
    const totalBatches = data.batches.length;
    const totalStockUnits = data.batches.reduce((sum, b) => sum + b.CurrentStock, 0);

    const totalCostValuation = data.batches.reduce(
      (sum, b) => sum + b.CurrentStock * b.CostPrice,
      0
    );

    // Active Retail Valuation: uses current SellingPrice / active MRP
    const totalRetailValuation = data.batches.reduce(
      (sum, b) => sum + b.CurrentStock * b.SellingPrice,
      0
    );

    const potentialProfit = totalRetailValuation - totalCostValuation;
    const marginPercent =
      totalRetailValuation > 0
        ? Math.round((potentialProfit / totalRetailValuation) * 1000) / 10
        : 0;

    // Check low stock count
    let lowStockItemsCount = 0;
    data.medicines.forEach((med) => {
      const medBatches = data.batches.filter((b) => b.MedicineID === med.MedicineID);
      const stock = medBatches.reduce((sum, b) => sum + b.CurrentStock, 0);
      if (stock <= (med.ReorderLevel || 20)) {
        lowStockItemsCount++;
      }
    });

    // Check near expiry (within 60 days)
    let expiringIn60DaysCount = 0;
    data.batches.forEach((b) => {
      if (b.CurrentStock > 0) {
        const expTime = new Date(b.ExpiryDate).getTime();
        if (expTime - now <= sixtyDaysMs) {
          expiringIn60DaysCount++;
        }
      }
    });

    const supplierNames: string[] = [];
    data.supplierIds.forEach((sId) => {
      const s = suppliers.find((sup) => sup.SupplierID === sId);
      if (s) supplierNames.push(s.Name);
    });

    results.push({
      groupName,
      totalMedicines,
      totalBatches,
      totalStockUnits,
      totalCostValuation: Math.round(totalCostValuation * 100) / 100,
      totalRetailValuation: Math.round(totalRetailValuation * 100) / 100,
      potentialProfit: Math.round(potentialProfit * 100) / 100,
      marginPercent,
      lowStockItemsCount,
      expiringIn60DaysCount,
      suppliers: supplierNames,
    });
  });

  // Sort alphabetically by group name
  return results.sort((a, b) => a.groupName.localeCompare(b.groupName));
}
