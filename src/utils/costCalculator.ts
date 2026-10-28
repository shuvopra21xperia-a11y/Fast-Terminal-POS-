/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Cost Price Calculation Engine & Discount Fallback Logic
 * 
 * Formula: Cost Price = (TP + VAT Amount) - Discount Amount
 * Example:
 *   TP = 100
 *   VAT = 17.4% -> VAT Amount = 17.4
 *   Discount = 3% -> Discount Amount = 3
 *   Cost Price = (100 + 17.4) - 3 = 114.4
 */

import { Medicine, Supplier } from '../types/pharmacy';

export interface CostCalculationResult {
  tp: number;
  vatPercent: number;
  vatAmount: number;
  discountPercent: number;
  discountAmount: number;
  costPrice: number;
  sourceOfDiscount: 'Medicine' | 'Supplier' | 'Custom';
}

/**
 * Calculates the exact cost price based on Trade Price (TP), VAT %, and Discount %
 */
export function calculateCostPrice(
  tp: number,
  vatPercent: number,
  discountPercent: number,
  source: 'Medicine' | 'Supplier' | 'Custom' = 'Custom'
): CostCalculationResult {
  const cleanTp = Math.max(0, tp);
  const cleanVatPercent = Math.max(0, vatPercent);
  const cleanDiscountPercent = Math.max(0, discountPercent);

  const vatAmount = (cleanTp * cleanVatPercent) / 100;
  const discountAmount = (cleanTp * cleanDiscountPercent) / 100;

  // Exact prompt formula: (TP + VAT) - Discount
  const rawCostPrice = (cleanTp + vatAmount) - discountAmount;
  const costPrice = Math.round(rawCostPrice * 100) / 100;

  return {
    tp: cleanTp,
    vatPercent: cleanVatPercent,
    vatAmount: Math.round(vatAmount * 100) / 100,
    discountPercent: cleanDiscountPercent,
    discountAmount: Math.round(discountAmount * 100) / 100,
    costPrice,
    sourceOfDiscount: source,
  };
}

/**
 * Resolves discount rate according to the Fallback Discount Rule:
 * If medicine has an individual discount rate (> 0), use it.
 * If individual discount is NULL or 0, fallback to Supplier Default Discount.
 */
export function resolveEffectiveDiscount(
  medicine?: Medicine | null,
  supplier?: Supplier | null,
  customOverride?: number
): { rate: number; source: 'Medicine' | 'Supplier' | 'Custom' } {
  if (customOverride !== undefined && customOverride !== null && customOverride >= 0) {
    return { rate: customOverride, source: 'Custom' };
  }

  if (medicine && medicine.DefaultDiscountPercent && medicine.DefaultDiscountPercent > 0) {
    return { rate: medicine.DefaultDiscountPercent, source: 'Medicine' };
  }

  if (supplier && supplier.DefaultDiscountPercent && supplier.DefaultDiscountPercent > 0) {
    return { rate: supplier.DefaultDiscountPercent, source: 'Supplier' };
  }

  return { rate: 0, source: 'Supplier' };
}

/**
 * Validates the strict Hard Profit Margin & Discount Guardrail:
 * STRICT RESTRICTION: System MUST prevent checkout if Selling Price after Discount < Cost Price.
 * 
 * Returns { valid: boolean, error?: string }
 */
export function validateProfitMarginGuardrail(
  sellingPrice: number,
  discountAmount: number,
  costPrice: number,
  quantity: number = 1
): { valid: boolean; error?: string; effectiveUnitPrice: number } {
  const totalSelling = sellingPrice * quantity;
  const netSelling = totalSelling - discountAmount;
  const effectiveUnitPrice = quantity > 0 ? netSelling / quantity : 0;

  // We compare per unit or total: netSelling < totalCost
  const totalCost = costPrice * quantity;

  // Margin check with small floating point tolerance (0.001)
  if (netSelling < totalCost - 0.001) {
    return {
      valid: false,
      effectiveUnitPrice: Math.round(effectiveUnitPrice * 100) / 100,
      error: `Discount rejected: Selling price ($${effectiveUnitPrice.toFixed(2)}) cannot be lower than item Cost Price ($${costPrice.toFixed(2)}).`,
    };
  }

  return {
    valid: true,
    effectiveUnitPrice: Math.round(effectiveUnitPrice * 100) / 100,
  };
}
