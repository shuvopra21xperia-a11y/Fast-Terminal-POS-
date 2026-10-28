/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Module: Medicine Stock Adjustment & Physical Inventory Audit Engine
 * Features:
 * - Fast Search with Arrow Key Navigation (↓ / ↑ to navigate, Enter to open child window)
 * - Clickable Medicine Rows with instant adjustment trigger
 * - Child Window for Stock Adjustment:
 *   - Type selector: Manual Adjust, Expire Adjust, Damage Adjust
 *   - Positive (+ add to stock) & Negative (- deduct from stock) quantity delta
 *   - Live stock re-calculation & financial cost preview
 * - Physical Audit Mode (Toggled from Settings or direct switch):
 *   - Ready child window for rapid shelf stock counting
 *   - Physical count input with real-time variance calculation
 *   - Audit Engine auto-reconciles stock and logs verification
 * - Adjustment Reports filterable by Date Range (Today, Yesterday, 7 Days, Month, Custom)
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Medicine, Batch, StockAdjustment, AdjustmentType } from '../../types/pharmacy';
import {
  SlidersHorizontal,
  Search,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ClipboardCheck,
  Calendar,
  Layers,
  ArrowUpDown,
  CornerDownLeft,
  X,
  Plus,
  Minus,
  Printer,
  FileText,
  TrendingDown,
  TrendingUp,
  History,
  ShieldCheck,
  Check,
  BarChart3,
  Boxes,
  Pill,
  RefreshCw,
  AlertCircle,
  Tag,
  Clock,
} from 'lucide-react';

export const MedicineAdjustmentPage: React.FC = () => {
  const {
    medicines,
    batches,
    suppliers,
    groups,
    stockAdjustments,
    isAuditModeActive,
    setAuditModeActive,
    adjustMedicineStock,
    reconcileAuditMedicine,
    currentUser,
    showToast,
    formatCurrency,
    currencySymbol,
  } = usePharmacy();

  // Active view tab: 'adjust' | 'audit' | 'report'
  const [activeTab, setActiveTab] = useState<'adjust' | 'audit' | 'report'>(() => {
    return isAuditModeActive ? 'audit' : 'adjust';
  });

  // Keep active tab in sync if audit mode is turned ON/OFF
  useEffect(() => {
    if (isAuditModeActive && activeTab === 'adjust') {
      setActiveTab('audit');
    }
  }, [isAuditModeActive]);

  // Fast Search State
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<{ [key: number]: HTMLTableRowElement | null }>({});

  // Child Window: Single Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [targetMedicine, setTargetMedicine] = useState<Medicine | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>('Manual Adjust');
  const [isDeductMode, setIsDeductMode] = useState<boolean>(true); // default deduct for damage/expire
  const [quantityInput, setQuantityInput] = useState<string>('1');
  const [reasonInput, setReasonInput] = useState<string>('');

  // Child Window: Audit Physical Count State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditSelectedMedId, setAuditSelectedMedId] = useState<string>('');
  const [auditSelectedBatchId, setAuditSelectedBatchId] = useState<string>('');
  const [auditPhysicalCount, setAuditPhysicalCount] = useState<string>('');
  const [auditNotes, setAuditNotes] = useState<string>('Routine shelf stock count verification');
  const auditCountInputRef = useRef<HTMLInputElement>(null);
  const auditSearchInputRef = useRef<HTMLInputElement>(null);
  const [auditHighlightIndex, setAuditHighlightIndex] = useState<number>(0);
  const auditRowRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Audited session tracking
  const [sessionAuditedIds, setSessionAuditedIds] = useState<Set<string>>(new Set());

  // Report Date Range State
  const [dateRangePreset, setDateRangePreset] = useState<'today' | 'yesterday' | '7days' | 'month' | 'all' | 'custom'>('7days');
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('All');
  const [reportSearch, setReportSearch] = useState<string>('');

  // Fast search filtered medicines
  const filteredMedicines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return medicines.filter((m) => {
      const supp = suppliers.find((s) => s.SupplierID === m.SupplierID);
      const suppName = (supp?.Name || '').toLowerCase();
      const medBatches = batches.filter((b) => b.MedicineID === m.MedicineID);
      const batchNumbers = medBatches.map((b) => b.BatchNumber.toLowerCase()).join(' ');

      const matchesSearch =
        !q ||
        m.TradeName.toLowerCase().includes(q) ||
        m.GenericName.toLowerCase().includes(q) ||
        m.RackNo.toLowerCase().includes(q) ||
        m.Barcode.toLowerCase().includes(q) ||
        (m.Group || '').toLowerCase().includes(q) ||
        suppName.includes(q) ||
        batchNumbers.includes(q);

      const matchesGroup = selectedGroup === 'All' || m.Group === selectedGroup;

      return matchesSearch && matchesGroup;
    });
  }, [medicines, search, selectedGroup, suppliers, batches]);

  // Auto-highlight first row when searching so Enter/Arrows work instantly
  useEffect(() => {
    if (search.trim().length > 0 && filteredMedicines.length > 0) {
      setSelectedIndex(0);
    } else {
      setSelectedIndex(-1);
    }
  }, [search, selectedGroup, filteredMedicines.length]);

  // Keyboard navigation for search input
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (filteredMedicines.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev < filteredMedicines.length - 1 ? prev + 1 : 0;
        rowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : filteredMedicines.length - 1;
        rowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const targetMed =
        selectedIndex >= 0 && selectedIndex < filteredMedicines.length
          ? filteredMedicines[selectedIndex]
          : filteredMedicines[0];
      if (targetMed) {
        handleOpenAdjustModal(targetMed);
      }
    } else if (e.key === 'Escape') {
      if (search) {
        setSearch('');
        setSelectedIndex(-1);
      }
    }
  };

  // Open Child Window for single medicine adjustment
  const handleOpenAdjustModal = (med: Medicine, defaultType: AdjustmentType = 'Manual Adjust') => {
    setTargetMedicine(med);
    const medBatches = batches.filter((b) => b.MedicineID === med.MedicineID);
    const primaryBatch = medBatches.find((b) => b.CurrentStock > 0) || medBatches[0];
    setSelectedBatchId(primaryBatch?.BatchID || '');
    setAdjustmentType(defaultType);
    setIsDeductMode(defaultType === 'Expire Adjust' || defaultType === 'Damage Adjust');
    setQuantityInput('1');
    setReasonInput(
      defaultType === 'Expire Adjust'
        ? 'Expired units removed from shelf for quarantine return'
        : defaultType === 'Damage Adjust'
        ? 'Damaged blister/ampoule package discarded to disposal bin'
        : 'Physical shelf recount adjustment'
    );
    setIsAdjustModalOpen(true);
  };

  // Current selected batch in modal
  const activeBatch = useMemo(() => {
    if (!selectedBatchId) return null;
    return batches.find((b) => b.BatchID === selectedBatchId) || null;
  }, [selectedBatchId, batches]);

  // Calculation of effective delta and resulting stock
  const parsedQty = Math.max(0, parseInt(quantityInput, 10) || 0);
  const effectiveDelta = isDeductMode ? -parsedQty : parsedQty;
  const currentBatchStock = activeBatch ? activeBatch.CurrentStock : 0;
  const resultingStock = currentBatchStock + effectiveDelta;
  const costPrice = activeBatch ? activeBatch.CostPrice : (targetMedicine?.MRP || 0) * 0.8;
  const financialCostImpact = effectiveDelta * costPrice;

  // Handle adjustment submission from child window
  const handleSubmitAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMedicine || !selectedBatchId) {
      showToast('Please select a valid medicine and batch to adjust.', 'warning', 'Invalid Selection');
      return;
    }

    if (parsedQty <= 0) {
      showToast('Adjustment quantity must be greater than 0.', 'warning', 'Invalid Quantity');
      return;
    }

    if (resultingStock < 0) {
      showToast(
        `Cannot deduct ${parsedQty} units. Batch has only ${currentBatchStock} units available.`,
        'error',
        'Stock Underflow'
      );
      return;
    }

    const res = adjustMedicineStock({
      medicineId: targetMedicine.MedicineID,
      batchId: selectedBatchId,
      adjustmentType,
      quantityDelta: effectiveDelta,
      reason: reasonInput.trim() || `${adjustmentType} applied manually`,
    });

    if (res.success) {
      showToast(
        `${adjustmentType} applied for ${targetMedicine.TradeName}: ${effectiveDelta > 0 ? '+' : ''}${effectiveDelta} units. New Stock: ${resultingStock}`,
        'success',
        'Stock Adjusted'
      );
      setIsAdjustModalOpen(false);
    } else {
      showToast(res.error || 'Failed to adjust stock', 'error', 'Adjustment Error');
    }
  };

  // Quick suggestion chips for reasons
  const reasonSuggestions = [
    'Physical shelf recount discrepancy',
    'Damaged packaging / crushed strip',
    'Expired batch removed for return',
    'Supplier bonus sample added',
    'Broken ampoule / leakage write-off',
    'Dispensing variance reconciliation',
  ];

  // --------------------------------------------------------------------------
  // Physical Audit Engine Logic
  // --------------------------------------------------------------------------

  // Filtered medicines for audit mode search
  const auditFilteredMedicines = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return medicines.slice(0, 30);
    return medicines.filter((m) => {
      return (
        m.TradeName.toLowerCase().includes(q) ||
        m.GenericName.toLowerCase().includes(q) ||
        m.RackNo.toLowerCase().includes(q) ||
        m.Barcode.toLowerCase().includes(q)
      );
    });
  }, [medicines, auditSearch]);

  // Keep audit highlight in bounds & reset on search
  useEffect(() => {
    setAuditHighlightIndex(0);
  }, [auditSearch]);

  // Keyboard navigation for audit shelf search (ArrowDown, ArrowUp, Enter)
  const handleAuditSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (auditFilteredMedicines.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAuditHighlightIndex((prev) => {
        const next = prev < auditFilteredMedicines.length - 1 ? prev + 1 : 0;
        auditRowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        const target = auditFilteredMedicines[next];
        if (target) {
          setAuditSelectedMedId(target.MedicineID);
          const medBatches = batches.filter((b) => b.MedicineID === target.MedicineID);
          if (medBatches[0]) setAuditSelectedBatchId(medBatches[0].BatchID);
        }
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAuditHighlightIndex((prev) => {
        const next = prev > 0 ? prev - 1 : auditFilteredMedicines.length - 1;
        auditRowRefs.current[next]?.scrollIntoView({ block: 'nearest' });
        const target = auditFilteredMedicines[next];
        if (target) {
          setAuditSelectedMedId(target.MedicineID);
          const medBatches = batches.filter((b) => b.MedicineID === target.MedicineID);
          if (medBatches[0]) setAuditSelectedBatchId(medBatches[0].BatchID);
        }
        return next;
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = auditFilteredMedicines[auditHighlightIndex] || auditFilteredMedicines[0];
      if (target) {
        setAuditSelectedMedId(target.MedicineID);
        const medBatches = batches.filter((b) => b.MedicineID === target.MedicineID);
        if (medBatches[0]) setAuditSelectedBatchId(medBatches[0].BatchID);
        setAuditPhysicalCount('');
        setTimeout(() => auditCountInputRef.current?.focus(), 50);
      }
    }
  };

  // Selected audit medicine and batch
  const auditTargetMedicine = useMemo(() => {
    if (!auditSelectedMedId) return medicines[0] || null;
    return medicines.find((m) => m.MedicineID === auditSelectedMedId) || medicines[0] || null;
  }, [auditSelectedMedId, medicines]);

  const auditMedBatches = useMemo(() => {
    if (!auditTargetMedicine) return [];
    return batches.filter((b) => b.MedicineID === auditTargetMedicine.MedicineID);
  }, [auditTargetMedicine, batches]);

  const auditTargetBatch = useMemo(() => {
    if (!auditSelectedBatchId && auditMedBatches.length > 0) {
      return auditMedBatches[0];
    }
    return batches.find((b) => b.BatchID === auditSelectedBatchId) || auditMedBatches[0] || null;
  }, [auditSelectedBatchId, auditMedBatches, batches]);

  // Auto set audit batch if changed
  useEffect(() => {
    if (auditMedBatches.length > 0 && !auditMedBatches.some((b) => b.BatchID === auditSelectedBatchId)) {
      setSelectedBatchId(auditMedBatches[0].BatchID);
    }
  }, [auditMedBatches, auditSelectedBatchId]);

  const auditSystemStock = auditTargetBatch ? auditTargetBatch.CurrentStock : 0;
  const parsedAuditCount = auditPhysicalCount === '' ? null : parseInt(auditPhysicalCount, 10);
  const auditVariance = parsedAuditCount !== null && !isNaN(parsedAuditCount) ? parsedAuditCount - auditSystemStock : 0;
  const auditCostPrice = auditTargetBatch?.CostPrice || 0;
  const auditFinancialVariance = auditVariance * auditCostPrice;

  // Execute Audit Stock Reconciliation
  const handleApplyAuditCount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditTargetMedicine || !auditTargetBatch) {
      showToast('Select a valid medicine and batch for physical count.', 'warning', 'Audit Engine');
      return;
    }

    if (parsedAuditCount === null || isNaN(parsedAuditCount) || parsedAuditCount < 0) {
      showToast('Please enter a valid physical count number (≥ 0).', 'warning', 'Invalid Physical Count');
      return;
    }

    const res = reconcileAuditMedicine({
      medicineId: auditTargetMedicine.MedicineID,
      batchId: auditTargetBatch.BatchID,
      physicalCount: parsedAuditCount,
      notes: auditNotes.trim() || `Physical audit count: shelf ${auditTargetMedicine.RackNo}`,
    });

    if (res.success) {
      setSessionAuditedIds((prev) => new Set(prev).add(auditTargetBatch.BatchID));

      if (res.variance === 0) {
        showToast(
          `Verified ${auditTargetMedicine.TradeName} (Batch ${auditTargetBatch.BatchNumber}): Zero variance (${parsedAuditCount} units matched physical stock).`,
          'info',
          'Audit Count Matched'
        );
      } else {
        showToast(
          `Audit Engine reconciled ${auditTargetMedicine.TradeName}: Adjusted ${res.variance > 0 ? '+' : ''}${res.variance} units to match physical count (${parsedAuditCount} units).`,
          'success',
          'Audit Stock Reconciled'
        );
      }

      // Reset count field and focus back for next count
      setAuditPhysicalCount('');
      auditSearchInputRef.current?.focus();
    } else {
      showToast(res.error || 'Failed to reconcile audit count', 'error', 'Audit Engine Error');
    }
  };

  // --------------------------------------------------------------------------
  // Adjustment Report Filtering
  // --------------------------------------------------------------------------
  const handleSetPreset = (preset: 'today' | 'yesterday' | '7days' | 'month' | 'all') => {
    setDateRangePreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      setReportStartDate(todayStr);
      setReportEndDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      setReportStartDate(yStr);
      setReportEndDate(yStr);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setReportStartDate(d.toISOString().split('T')[0]);
      setReportEndDate(todayStr);
    } else if (preset === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setReportStartDate(d.toISOString().split('T')[0]);
      setReportEndDate(todayStr);
    } else if (preset === 'all') {
      setReportStartDate('2025-01-01');
      setReportEndDate(todayStr);
    }
  };

  const filteredAdjustments = useMemo(() => {
    return stockAdjustments.filter((adj) => {
      // Date filter
      const adjDateStr = adj.AdjustedAt ? adj.AdjustedAt.split('T')[0] : '';
      const inDateRange =
        (!reportStartDate || adjDateStr >= reportStartDate) &&
        (!reportEndDate || adjDateStr <= reportEndDate);

      // Type filter
      const matchesType =
        reportTypeFilter === 'All' || adj.AdjustmentType === reportTypeFilter;

      // Search filter
      const q = reportSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        adj.TradeName.toLowerCase().includes(q) ||
        adj.GenericName.toLowerCase().includes(q) ||
        adj.BatchNumber.toLowerCase().includes(q) ||
        adj.Reason.toLowerCase().includes(q) ||
        adj.AdjustedBy.toLowerCase().includes(q);

      return inDateRange && matchesType && matchesSearch;
    });
  }, [stockAdjustments, reportStartDate, reportEndDate, reportTypeFilter, reportSearch]);

  // Report Summary Statistics
  const reportStats = useMemo(() => {
    let totalPositiveUnits = 0;
    let totalNegativeUnits = 0;
    let totalPositiveValue = 0;
    let totalNegativeValue = 0;
    let expireWriteOffValue = 0;
    let damageWriteOffValue = 0;

    for (const adj of filteredAdjustments) {
      if (adj.QuantityDelta > 0) {
        totalPositiveUnits += adj.QuantityDelta;
        totalPositiveValue += adj.FinancialImpact;
      } else {
        const absQty = Math.abs(adj.QuantityDelta);
        const absVal = Math.abs(adj.FinancialImpact);
        totalNegativeUnits += absQty;
        totalNegativeValue += absVal;

        if (adj.AdjustmentType === 'Expire Adjust') {
          expireWriteOffValue += absVal;
        } else if (adj.AdjustmentType === 'Damage Adjust') {
          damageWriteOffValue += absVal;
        }
      }
    }

    const netUnits = totalPositiveUnits - totalNegativeUnits;
    const netValue = totalPositiveValue - totalNegativeValue;

    return {
      count: filteredAdjustments.length,
      netUnits,
      netValue,
      totalPositiveUnits,
      totalNegativeUnits,
      totalPositiveValue,
      totalNegativeValue,
      expireWriteOffValue,
      damageWriteOffValue,
    };
  }, [filteredAdjustments]);

  // Badge class helper
  const getAdjustmentTypeBadge = (type: AdjustmentType) => {
    switch (type) {
      case 'Manual Adjust':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/60';
      case 'Expire Adjust':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/60';
      case 'Damage Adjust':
        return 'bg-rose-950/80 text-rose-300 border-rose-800/60';
      case 'Audit Reconciliation':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
      default:
        return 'bg-slate-850 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* Module Title & Main Action Header */}
      <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded bg-emerald-950/70 border border-emerald-800/50 text-emerald-400">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">
                Medicine Stock Adjustment & Physical Audit Engine
              </h2>
              {isAuditModeActive && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-slate-950 shadow-sm animate-pulse">
                  <Flame className="w-3 h-3 fill-slate-950" />
                  <span>AUDIT MODE ACTIVE</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Manual Adjust, Expire Adjust, Damage Adjust (positive adds, negative deducts) & Physical Recount Engine
            </p>
          </div>
        </div>

        {/* Audit Mode Switch & Mode Navigation Tabs */}
        <div className="flex items-center gap-3">
          {/* Audit Mode Toggle Switch */}
          <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-xs">
            <div className="text-right">
              <span className="text-[11px] font-bold text-slate-200 block leading-tight">
                Physical Audit Mode
              </span>
              <span className="text-[9px] text-slate-400 block">
                {isAuditModeActive ? 'Engine Ready for Count' : 'Off (Standard Mode)'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isAuditModeActive}
                onChange={(e) => setAuditModeActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-800 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* View Tab Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab('adjust')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'adjust'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Pill className="w-3.5 h-3.5" />
              <span>Adjust Stock & Fast Search</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'audit'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Physical Audit Engine</span>
              {isAuditModeActive && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors flex items-center gap-1.5 ${
                activeTab === 'report'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Adjustment Reports ({stockAdjustments.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ADJUST STOCK & FAST SEARCH WORKSPACE                                */}
      {/* ========================================================================= */}
      {activeTab === 'adjust' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Fast Search & Keyboard Hints Toolbar */}
          <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[280px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Fast search (Trade Name, Generic, Batch, Rack, Barcode)..."
                className="w-full pl-9 pr-9 py-1.5 bg-slate-950 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setSelectedIndex(-1);
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800 transition-colors"
                  title="Clear search (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <kbd
                  onClick={() => searchInputRef.current?.focus()}
                  className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] text-slate-500 bg-slate-900 border border-slate-800 rounded font-mono cursor-pointer hover:text-slate-300"
                  title="Press / to focus search"
                >
                  /
                </kbd>
              )}
            </div>

            {/* Fast Keyboard Navigation Pill */}
            <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-400 bg-slate-950/80 border border-slate-800 px-2.5 py-1 rounded">
              <span className="text-slate-500 font-semibold uppercase text-[10px]">Fast Navigate:</span>
              <div className="flex items-center gap-0.5 font-mono text-[10px]">
                <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">↓</kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">↑</kbd>
              </div>
              <span className="text-slate-600">·</span>
              <kbd className="px-1.5 py-0.5 bg-emerald-950/90 text-emerald-300 rounded font-mono text-[10px] border border-emerald-800/80 flex items-center gap-1">
                <span>Enter</span>
                <CornerDownLeft className="w-2.5 h-2.5" />
              </kbd>
              <span className="text-slate-400">Open Adjust Window</span>
              <span className="text-slate-600">·</span>
              <span className="text-emerald-400 font-medium">Click row to adjust</span>
              <span className="text-slate-600">|</span>
              <span className="font-mono text-slate-400">
                {filteredMedicines.length} medicine{filteredMedicines.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Group Selector Chips */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 overflow-x-auto">
              <span className="text-[10px] font-semibold text-slate-500 uppercase px-2">Group:</span>
              {['All', 'General', 'Cardiac', 'Herbal', 'Skin', 'Antibiotic'].map((grp) => (
                <button
                  key={grp}
                  onClick={() => setSelectedGroup(grp)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                    selectedGroup === grp
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {grp}
                </button>
              ))}
            </div>
          </div>

          {/* Table of Medicines & Active Batches */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="p-3">Medicine Profile</th>
                    <th className="p-3">Group Division</th>
                    <th className="p-3">Shelf Rack</th>
                    <th className="p-3">Total Stock</th>
                    <th className="p-3">Active Batches & Expiry</th>
                    <th className="p-3">MRP / Cost</th>
                    <th className="p-3 text-right">Quick Adjust Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredMedicines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-400">
                          No medicines found matching &ldquo;{search}&rdquo;
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">Esc</kbd> to clear search.
                        </p>
                      </td>
                    </tr>
                  )}

                  {filteredMedicines.map((med, index) => {
                    const medBatches = batches.filter((b) => b.MedicineID === med.MedicineID);
                    const totalStock = medBatches.reduce((sum, b) => sum + b.CurrentStock, 0);
                    const isSelected = index === selectedIndex;

                    return (
                      <tr
                        key={med.MedicineID}
                        ref={(el) => {
                          rowRefs.current[index] = el;
                        }}
                        onClick={() => handleOpenAdjustModal(med)}
                        className={`transition-all duration-150 cursor-pointer group border-l-4 select-none ${
                          isSelected
                            ? 'bg-emerald-950/60 border-l-emerald-400 ring-1 ring-inset ring-emerald-500/50 shadow-md text-white'
                            : 'hover:bg-slate-900/80 border-l-transparent text-slate-300'
                        }`}
                        title={`Click row or press Enter to open Stock Adjustment Child Window for ${med.TradeName}`}
                      >
                        {/* Trade Name & Generic */}
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {isSelected && (
                              <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500 text-slate-950 flex items-center gap-0.5 shadow-xs animate-pulse">
                                <span>ENTER ADJUST</span>
                                <CornerDownLeft className="w-2.5 h-2.5" />
                              </span>
                            )}
                            <div className="font-semibold text-slate-100 text-sm group-hover:text-emerald-300 transition-colors">
                              {med.TradeName}
                            </div>
                          </div>
                          <div className="text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5">
                            <span className="text-emerald-400 font-medium">{med.GenericName}</span>
                            <span className="text-slate-600">·</span>
                            <span className="font-mono text-slate-500">[{med.Barcode}]</span>
                          </div>
                        </td>

                        {/* Group Badge */}
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border bg-slate-900 border-slate-700/80 text-slate-300">
                            <Layers className="w-3 h-3 text-slate-400" />
                            {med.Group || 'General'}
                          </span>
                        </td>

                        {/* Shelf Rack */}
                        <td className="p-3">
                          <span className="font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded text-[11px]">
                            {med.RackNo}
                          </span>
                        </td>

                        {/* Total Stock */}
                        <td className="p-3">
                          <div
                            className={`font-mono text-sm font-bold ${
                              totalStock <= med.ReorderLevel ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            {totalStock} {med.Unit}
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {medBatches.length} batch(es) registered
                          </span>
                        </td>

                        {/* Active Batches */}
                        <td className="p-3 max-w-[220px]">
                          <div className="space-y-1">
                            {medBatches.slice(0, 2).map((b) => (
                              <div
                                key={b.BatchID}
                                className="flex items-center justify-between text-[11px] bg-slate-900/90 px-2 py-0.5 rounded border border-slate-800 font-mono"
                              >
                                <span className="text-slate-300 font-medium">{b.BatchNumber}</span>
                                <span className="text-emerald-400">{b.CurrentStock} pcs</span>
                              </div>
                            ))}
                            {medBatches.length > 2 && (
                              <span className="text-[10px] text-slate-500 italic block">
                                +{medBatches.length - 2} more batches
                              </span>
                            )}
                          </div>
                        </td>

                        {/* MRP / Cost Price */}
                        <td className="p-3">
                          <div className="font-mono font-bold text-white text-xs">
                            MRP: {formatCurrency(med.MRP || 15.0)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Cost: {formatCurrency(medBatches[0]?.CostPrice || med.MRP * 0.8)}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Manual Adjust */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAdjustModal(med, 'Manual Adjust');
                              }}
                              className="px-2.5 py-1 rounded bg-blue-950/80 hover:bg-blue-900 text-blue-300 border border-blue-800/60 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                              title="Manual Adjust Stock (+ or -)"
                            >
                              <SlidersHorizontal className="w-3 h-3" />
                              <span>Adjust</span>
                            </button>

                            {/* Expire Write-off */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAdjustModal(med, 'Expire Adjust');
                              }}
                              className="px-2 py-1 rounded bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-800/60 text-[11px] font-medium flex items-center gap-1 transition-colors"
                              title="Expire Adjust (Write-off expired stock to quarantine)"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>Expire</span>
                            </button>

                            {/* Damage Write-off */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAdjustModal(med, 'Damage Adjust');
                              }}
                              className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/60 text-[11px] font-medium flex items-center gap-1 transition-colors"
                              title="Damage Adjust (Deduct broken/spoiled units)"
                            >
                              <Flame className="w-3 h-3" />
                              <span>Damage</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PHYSICAL AUDIT ENGINE WORKSPACE (READY CHILD WINDOW)                */}
      {/* ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="flex-1 flex overflow-hidden p-4 gap-4">
          {/* Left Column: Fast Shelf Medicine Selector */}
          <div className="w-96 flex flex-col bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shrink-0">
            <div className="p-3 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                  <ClipboardCheck className="w-4 h-4 text-emerald-400" />
                  <span>Shelf Audit Medicine List</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">
                  Audited: <strong className="text-emerald-400">{sessionAuditedIds.size}</strong>
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={auditSearchInputRef}
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  onKeyDown={handleAuditSearchKeyDown}
                  placeholder="Filter shelf medicines (↓/↑ to navigate, Enter to audit)..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-850">
              {auditFilteredMedicines.map((med, idx) => {
                const medBatches = batches.filter((b) => b.MedicineID === med.MedicineID);
                const totalStock = medBatches.reduce((sum, b) => sum + b.CurrentStock, 0);
                const isSelected = med.MedicineID === auditTargetMedicine?.MedicineID || idx === auditHighlightIndex;
                const isAudited = medBatches.some((b) => sessionAuditedIds.has(b.BatchID));

                return (
                  <div
                    key={med.MedicineID}
                    ref={(el) => { auditRowRefs.current[idx] = el; }}
                    onClick={() => {
                      setAuditHighlightIndex(idx);
                      setAuditSelectedMedId(med.MedicineID);
                      const b = medBatches[0];
                      if (b) setAuditSelectedBatchId(b.BatchID);
                      setAuditPhysicalCount('');
                      setTimeout(() => auditCountInputRef.current?.focus(), 50);
                    }}
                    className={`p-3 cursor-pointer transition-colors border-l-4 ${
                      isSelected
                        ? 'bg-emerald-950/70 border-l-emerald-500 text-white'
                        : 'hover:bg-slate-900 border-l-transparent text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                        <span>{med.TradeName}</span>
                        {isAudited && (
                          <span className="p-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold" title="Audited in this session">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        {totalStock} {med.Unit}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                      <span className="truncate max-w-[170px] text-slate-400">{med.GenericName}</span>
                      <span className="font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded text-[10px] border border-emerald-900/60">
                        {med.RackNo}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Physical Audit Child Window / Counting Engine */}
          <div className="flex-1 flex flex-col bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
            {/* Child Window Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded bg-emerald-600/20 border border-emerald-500/40 text-emerald-400">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <span>Physical Stock Recount Child Window</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                      Auto-Reconciliation Engine
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Count physical units on shelf. The engine instantly computes variance and adjusts batch stock.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSessionAuditedIds(new Set());
                    showToast('Physical audit session counter cleared.', 'info', 'Audit Session');
                  }}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white rounded bg-slate-900 border border-slate-800 hover:bg-slate-850"
                  title="Clear Session Audit Count Checklist"
                >
                  Clear Session
                </button>
              </div>
            </div>

            {/* Audit Child Window Body */}
            {auditTargetMedicine && auditTargetBatch ? (
              <form onSubmit={handleApplyAuditCount} className="flex-1 p-6 overflow-y-auto space-y-6">
                {/* Active Medicine Snapshot */}
                <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Selected Medicine</span>
                    <span className="text-sm font-bold text-white block mt-0.5">{auditTargetMedicine.TradeName}</span>
                    <span className="text-xs text-emerald-400 block mt-0.5">{auditTargetMedicine.GenericName}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Shelf Rack Location</span>
                    <span className="text-sm font-mono font-bold text-emerald-400 block mt-0.5">{auditTargetMedicine.RackNo}</span>
                    <span className="text-xs text-slate-400 block mt-0.5">Barcode: {auditTargetMedicine.Barcode}</span>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Batch Number & Expiry</span>
                    <select
                      value={auditTargetBatch.BatchID}
                      onChange={(e) => setAuditSelectedBatchId(e.target.value)}
                      className="mt-1 w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono focus:outline-hidden focus:border-emerald-500"
                    >
                      {auditMedBatches.map((b) => (
                        <option key={b.BatchID} value={b.BatchID}>
                          {b.BatchNumber} (Exp: {b.ExpiryDate}) - Stock: {b.CurrentStock} pcs
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Valuation Cost / Unit</span>
                    <span className="text-sm font-mono font-bold text-white block mt-0.5">{formatCurrency(auditCostPrice)}</span>
                    <span className="text-xs text-slate-400 block mt-0.5">Retail MRP: {formatCurrency(auditTargetMedicine.MRP)}</span>
                  </div>
                </div>

                {/* Expected Stock vs Physical Count Engine Box */}
                <div className="p-5 rounded-lg bg-slate-900/60 border border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                  {/* System Stock Card */}
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-center">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      Expected System Stock
                    </span>
                    <div className="text-3xl font-mono font-bold text-white mt-1">
                      {auditSystemStock}
                    </div>
                    <span className="text-xs text-slate-500 font-medium mt-1 block">
                      Registered in SQL database
                    </span>
                  </div>

                  {/* Physical Count Input Card */}
                  <div className="p-4 rounded-lg bg-emerald-950/40 border border-emerald-800/80 text-center ring-1 ring-emerald-500/40">
                    <label className="text-[10px] font-bold uppercase text-emerald-300 block">
                      Physical Shelf Count (Input Here)
                    </label>
                    <div className="mt-2 flex items-center justify-center">
                      <input
                        ref={auditCountInputRef}
                        type="number"
                        min="0"
                        value={auditPhysicalCount}
                        onChange={(e) => setAuditPhysicalCount(e.target.value)}
                        placeholder="Count..."
                        className="w-32 py-1 text-center font-mono text-3xl font-bold bg-slate-950 border-2 border-emerald-500 rounded text-emerald-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-400 shadow-inner"
                        autoFocus
                      />
                    </div>
                    <span className="text-[10px] text-emerald-400/80 font-medium mt-1 block">
                      Press Enter to Reconcile
                    </span>
                  </div>

                  {/* Variance Live Calculation Card */}
                  <div
                    className={`p-4 rounded-lg border text-center transition-colors ${
                      parsedAuditCount === null
                        ? 'bg-slate-950 border-slate-800 text-slate-400'
                        : auditVariance === 0
                        ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                        : auditVariance > 0
                        ? 'bg-blue-950/60 border-blue-800 text-blue-300'
                        : 'bg-rose-950/60 border-rose-800 text-rose-300'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase block">
                      Variance & Audit Impact
                    </span>
                    <div className="text-3xl font-mono font-bold mt-1">
                      {parsedAuditCount === null ? (
                        '—'
                      ) : (
                        <span>
                          {auditVariance > 0 ? `+${auditVariance}` : auditVariance}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold mt-1">
                      {parsedAuditCount === null ? (
                        'Awaiting physical count'
                      ) : auditVariance === 0 ? (
                        <span className="text-emerald-400 font-bold flex items-center justify-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Zero Variance (Verified)
                        </span>
                      ) : auditVariance > 0 ? (
                        <span>Surplus: +{formatCurrency(auditFinancialVariance)}</span>
                      ) : (
                        <span>Deficit / Shortage: {formatCurrency(auditFinancialVariance)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Audit Notes field */}
                <div>
                  <label className="block text-slate-400 text-xs font-medium mb-1">
                    Audit Verification Notes / Remarks
                  </label>
                  <input
                    type="text"
                    value={auditNotes}
                    onChange={(e) => setAuditNotes(e.target.value)}
                    placeholder="e.g. Physical audit count verified by Dr. Tariq Rahman"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                {/* Submit Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <span className="text-emerald-400 font-bold">Audit Engine Ready:</span>
                    <span>Auto-adjusts batch stock to physical count.</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAuditPhysicalCount(auditSystemStock.toString());
                        setTimeout(() => auditCountInputRef.current?.focus(), 10);
                      }}
                      className="px-3 py-2 rounded bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-700 text-xs font-medium transition-colors"
                      title="Quick fill with expected stock if shelf matches"
                    >
                      Match Expected ({auditSystemStock})
                    </button>

                    <button
                      type="submit"
                      disabled={parsedAuditCount === null}
                      className="px-5 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-md"
                    >
                      <Check className="w-4 h-4" />
                      <span>Reconcile & Adjust Stock (Enter)</span>
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500">
                <AlertCircle className="w-12 h-12 text-slate-600 mb-2" />
                <p className="text-sm font-medium text-slate-400">Select a medicine to begin physical audit count.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ADJUSTMENT REPORTS & AUDIT LOG WORKSPACE                             */}
      {/* ========================================================================= */}
      {activeTab === 'report' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Filters Bar: Date Range, Presets & Type Filters */}
          <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            {/* Date Range Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>Range:</span>
              </span>
              {(['today', 'yesterday', '7days', 'month', 'all'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleSetPreset(preset)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    dateRangePreset === preset
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-850'
                  }`}
                >
                  {preset === 'today'
                    ? 'Today'
                    : preset === 'yesterday'
                    ? 'Yesterday'
                    : preset === '7days'
                    ? 'Last 7 Days'
                    : preset === 'month'
                    ? 'This Month'
                    : 'All Time'}
                </button>
              ))}

              <div className="flex items-center gap-1 pl-2 text-xs">
                <input
                  type="date"
                  value={reportStartDate}
                  onChange={(e) => {
                    setDateRangePreset('custom');
                    setReportStartDate(e.target.value);
                  }}
                  className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs font-mono focus:outline-hidden"
                />
                <span className="text-slate-500 font-mono">to</span>
                <input
                  type="date"
                  value={reportEndDate}
                  onChange={(e) => {
                    setDateRangePreset('custom');
                    setReportEndDate(e.target.value);
                  }}
                  className="bg-slate-900 border border-slate-800 text-slate-200 rounded px-2 py-1 text-xs font-mono focus:outline-hidden"
                />
              </div>
            </div>

            {/* Type Filter & Search Filter */}
            <div className="flex items-center gap-2">
              <select
                value={reportTypeFilter}
                onChange={(e) => setReportTypeFilter(e.target.value)}
                className="bg-slate-900 border border-slate-850 text-slate-300 rounded px-2.5 py-1 text-xs focus:outline-hidden"
              >
                <option value="All">All Types ({stockAdjustments.length})</option>
                <option value="Manual Adjust">Manual Adjust</option>
                <option value="Expire Adjust">Expire Adjust</option>
                <option value="Damage Adjust">Damage Adjust</option>
                <option value="Audit Reconciliation">Audit Reconciliation</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  placeholder="Filter report..."
                  className="pl-8 pr-2.5 py-1 bg-slate-900 border border-slate-850 rounded text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
                title="Print Official Adjustment & Audit Report"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span>Print Report</span>
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 bg-slate-900/60 border-b border-slate-800">
            {/* Total Adjustments */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Adjustments</span>
              <div className="text-xl font-mono font-bold text-white mt-0.5">{reportStats.count}</div>
              <span className="text-[10px] text-slate-500">in selected date range</span>
            </div>

            {/* Net Quantity Delta */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Net Stock Delta</span>
              <div
                className={`text-xl font-mono font-bold mt-0.5 ${
                  reportStats.netUnits >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {reportStats.netUnits > 0 ? `+${reportStats.netUnits}` : reportStats.netUnits} units
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                +{reportStats.totalPositiveUnits} / -{reportStats.totalNegativeUnits}
              </span>
            </div>

            {/* Expire Write-Offs */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-amber-400 block">Expire Adjustments</span>
              <div className="text-xl font-mono font-bold text-amber-300 mt-0.5">
                {formatCurrency(reportStats.expireWriteOffValue)}
              </div>
              <span className="text-[10px] text-slate-500">Quarantined from shelf</span>
            </div>

            {/* Damage Write-Offs */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-rose-400 block">Damage Adjustments</span>
              <div className="text-xl font-mono font-bold text-rose-300 mt-0.5">
                {formatCurrency(reportStats.damageWriteOffValue)}
              </div>
              <span className="text-[10px] text-slate-500">Disposed to waste bin</span>
            </div>

            {/* Net Cost Impact */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Net Cost Impact</span>
              <div
                className={`text-xl font-mono font-bold mt-0.5 ${
                  reportStats.netValue >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {reportStats.netValue > 0 ? `+${formatCurrency(reportStats.netValue)}` : formatCurrency(reportStats.netValue)}
              </div>
              <span className="text-[10px] text-slate-500">inventory valuation impact</span>
            </div>
          </div>

          {/* Adjustments Report Data Table */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Medicine & Generic</th>
                    <th className="p-3">Batch & Expiry</th>
                    <th className="p-3">Adjustment Type</th>
                    <th className="p-3">Stock Delta (+ / -)</th>
                    <th className="p-3">Previous &rarr; New</th>
                    <th className="p-3">Cost Valuation</th>
                    <th className="p-3">Adjusted By</th>
                    <th className="p-3">Reason / Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredAdjustments.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-500">
                        <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-400">
                          No stock adjustments recorded for the selected date range.
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          Try expanding your date range or adjusting medicines in Tab 1.
                        </p>
                      </td>
                    </tr>
                  )}

                  {filteredAdjustments.map((adj) => {
                    const isPositive = adj.QuantityDelta > 0;
                    return (
                      <tr key={adj.AdjustmentID} className="hover:bg-slate-900/60 transition-colors">
                        {/* Timestamp */}
                        <td className="p-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          <div>{adj.AdjustedAt.split('T')[0]}</div>
                          <div className="text-[10px] text-slate-500">
                            {new Date(adj.AdjustedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        {/* Medicine */}
                        <td className="p-3">
                          <div className="font-semibold text-white">{adj.TradeName}</div>
                          <div className="text-[10px] text-emerald-400">{adj.GenericName}</div>
                        </td>

                        {/* Batch */}
                        <td className="p-3 font-mono text-[11px] text-slate-300">
                          <div>{adj.BatchNumber}</div>
                          {adj.ExpiryDate && (
                            <div className="text-[10px] text-slate-500">Exp: {adj.ExpiryDate}</div>
                          )}
                        </td>

                        {/* Type */}
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getAdjustmentTypeBadge(
                              adj.AdjustmentType
                            )}`}
                          >
                            {adj.AdjustmentType === 'Manual Adjust' && <SlidersHorizontal className="w-2.5 h-2.5" />}
                            {adj.AdjustmentType === 'Expire Adjust' && <AlertTriangle className="w-2.5 h-2.5" />}
                            {adj.AdjustmentType === 'Damage Adjust' && <Flame className="w-2.5 h-2.5" />}
                            {adj.AdjustmentType === 'Audit Reconciliation' && <CheckCircle2 className="w-2.5 h-2.5" />}
                            <span>{adj.AdjustmentType}</span>
                          </span>
                        </td>

                        {/* Delta */}
                        <td className="p-3 font-mono font-bold text-sm">
                          <span
                            className={`px-2 py-0.5 rounded border inline-block ${
                              isPositive
                                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80'
                                : 'bg-rose-950/80 text-rose-400 border-rose-800/80'
                            }`}
                          >
                            {isPositive ? `+${adj.QuantityDelta}` : adj.QuantityDelta} pcs
                          </span>
                        </td>

                        {/* Prev -> New Stock */}
                        <td className="p-3 font-mono text-xs text-slate-300">
                          <span className="text-slate-500">{adj.PreviousStock}</span>
                          <span className="text-slate-600 px-1">&rarr;</span>
                          <span className="text-white font-bold">{adj.NewStock}</span>
                        </td>

                        {/* Financial Impact */}
                        <td className="p-3 font-mono text-xs font-semibold">
                          <span className={adj.FinancialImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {adj.FinancialImpact >= 0
                              ? `+${formatCurrency(adj.FinancialImpact)}`
                              : formatCurrency(adj.FinancialImpact)}
                          </span>
                        </td>

                        {/* Adjusted By */}
                        <td className="p-3 text-slate-300 text-xs">
                          <div>{adj.AdjustedBy}</div>
                        </td>

                        {/* Reason */}
                        <td className="p-3 text-slate-400 text-xs max-w-xs truncate" title={adj.Reason}>
                          {adj.Reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CHILD WINDOW MODAL: SINGLE MEDICINE ADJUSTMENT (MANUAL, EXPIRE, DAMAGE)   */}
      {/* ========================================================================= */}
      {isAdjustModalOpen && targetMedicine && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs select-none">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">
                  Stock Adjustment Child Window: {targetMedicine.TradeName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitAdjustment} className="p-5 space-y-4">
              {/* Medicine Card Snapshot */}
              <div className="p-3 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-sm">{targetMedicine.TradeName}</div>
                  <div className="text-[11px] text-emerald-400">{targetMedicine.GenericName}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Rack: {targetMedicine.RackNo} · Unit: {targetMedicine.Unit}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase block font-semibold">Active MRP</span>
                  <span className="font-mono font-bold text-white text-sm">{formatCurrency(targetMedicine.MRP)}</span>
                </div>
              </div>

              {/* Batch Selector */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select Batch to Adjust</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono focus:outline-hidden focus:border-emerald-500"
                >
                  {batches
                    .filter((b) => b.MedicineID === targetMedicine.MedicineID)
                    .map((b) => (
                      <option key={b.BatchID} value={b.BatchID}>
                        Batch: {b.BatchNumber} | Exp: {b.ExpiryDate} | Current Stock: {b.CurrentStock} {targetMedicine.Unit}
                      </option>
                    ))}
                </select>
              </div>

              {/* Adjustment Type Selector (Dropdown) */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Adjustment Type Option</label>
                <select
                  value={adjustmentType}
                  onChange={(e) => {
                    const newType = e.target.value as AdjustmentType;
                    setAdjustmentType(newType);
                    if (newType === 'Expire Adjust' || newType === 'Damage Adjust') {
                      setIsDeductMode(true);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-semibold focus:outline-hidden focus:border-emerald-500"
                >
                  <option value="Manual Adjust">Manual Adjust (Physical Count Recount / Correction)</option>
                  <option value="Expire Adjust">Expire Adjust (Remove Expired Stock to Vault Quarantine)</option>
                  <option value="Damage Adjust">Damage Adjust (Discard Damaged / Crushed Units to Bin)</option>
                </select>
              </div>

              {/* Add (+) vs Deduct (-) Mode Switch */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-300 font-semibold">Adjustment Direction</label>
                  <span className="text-[10px] text-slate-400">
                    {isDeductMode ? 'Negative delta (deducts stock)' : 'Positive delta (adds to stock)'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsDeductMode(true)}
                    className={`py-2 px-3 rounded border flex items-center justify-center gap-1.5 font-bold transition-all ${
                      isDeductMode
                        ? 'bg-rose-950/80 border-rose-500 text-rose-300 ring-1 ring-rose-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>Deduct from Stock (-)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsDeductMode(false)}
                    className={`py-2 px-3 rounded border flex items-center justify-center gap-1.5 font-bold transition-all ${
                      !isDeductMode
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add to Stock (+)</span>
                  </button>
                </div>
              </div>

              {/* Quantity Input with Live Stock Calculation */}
              <div className="p-3 rounded bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold">Adjustment Quantity Units</label>
                  <div className="flex items-center gap-1">
                    {[1, 5, 10, 20].map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => setQuantityInput(quick.toString())}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono"
                      >
                        {quick}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-2 rounded text-sm font-bold font-mono border ${
                      isDeductMode
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    }`}
                  >
                    {isDeductMode ? '—' : '+'}
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-white font-mono text-base font-bold focus:outline-hidden focus:border-emerald-500"
                    placeholder="Enter quantity..."
                    autoFocus
                  />
                </div>

                {/* Live Stock Transformation Preview */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">
                    Current: <strong className="text-white">{currentBatchStock}</strong>
                  </span>
                  <span className={isDeductMode ? 'text-rose-400' : 'text-emerald-400'}>
                    Delta: {effectiveDelta > 0 ? `+${effectiveDelta}` : effectiveDelta}
                  </span>
                  <span className="text-slate-300">
                    New Stock:{' '}
                    <strong className={resultingStock < 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {resultingStock} {targetMedicine.Unit}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Reason / Remarks with Quick Chips */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reason / Remarks Note</label>
                <input
                  type="text"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="Enter adjustment rationale..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                />

                <div className="flex flex-wrap gap-1 mt-1.5">
                  {reasonSuggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setReasonInput(sug)}
                      className="text-[10px] bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded border border-slate-800"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              {/* Financial Valuation Preview */}
              <div className="p-2.5 rounded bg-slate-900 border border-slate-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Valuation Cost Impact:</span>
                <span className={`font-bold ${financialCostImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {financialCostImpact >= 0 ? `+${formatCurrency(financialCostImpact)}` : formatCurrency(financialCostImpact)}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resultingStock < 0 || parsedQty <= 0}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white font-bold transition-colors shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Apply Stock Adjustment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
