/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Module A: Medicine Profile Management & Generic Substitute Finder
 * Enhanced with:
 * - Group Classification (Cardiac, General, Herbal, Skin, Antibiotic, etc.)
 * - Instant Dynamic MRP Updates & Synchronized Active Stock Valuation
 * - Price Change History Timeline & Audit Log
 * - Intelligent Realized Profit & Margin Expansion Analytics
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Medicine, UnitType, PriceHistoryRecord } from '../../types/pharmacy';
import { generateBarcodeSvg } from '../../utils/barcodeGenerator';
import { calculateMedicineProfitIntelligence } from '../../utils/intelligentProfitCalculator';
import {
  Pill,
  Search,
  Plus,
  Edit,
  Trash2,
  Sparkles,
  Barcode,
  ArrowUpDown,
  Filter,
  Check,
  X,
  Printer,
  TrendingUp,
  History,
  Layers,
  DollarSign,
  Calendar,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Info,
  Tag,
  ArrowRight,
  CornerDownLeft,
} from 'lucide-react';

export const MedicineManager: React.FC = () => {
  const {
    medicines,
    suppliers,
    batches,
    sales,
    groups,
    addMedicine,
    updateMedicine,
    updateMedicineMRP,
    deleteMedicine,
    findSubstitutes,
    currentUser,
    showToast,
    askConfirm,
    currencySymbol,
    formatCurrency,
  } = usePharmacy();

  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('All');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<{ [key: number]: HTMLTableRowElement | null }>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);

  // Quick MRP update modal state
  const [mrpModalMed, setMrpModalMed] = useState<Medicine | null>(null);
  const [newMrpInput, setNewMrpInput] = useState<number>(0);
  const [mrpChangeReason, setMrpChangeReason] = useState<string>('March MRP price increase');
  const [mrpEffectiveDate, setMrpEffectiveDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Price History Audit Modal state
  const [historyModalMed, setHistoryModalMed] = useState<Medicine | null>(null);

  // Intelligent Profit Analysis Modal state
  const [profitIntelMed, setProfitIntelMed] = useState<Medicine | null>(null);

  // Substitute modal
  const [substituteModalGeneric, setSubstituteModalGeneric] = useState<string | null>(null);
  const [substituteActiveMedId, setSubstituteActiveMedId] = useState<string | undefined>(undefined);

  // Barcode Label Print modal
  const [barcodeModalMed, setBarcodeModalMed] = useState<Medicine | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    TradeName: '',
    GenericName: '',
    RackNo: 'RACK-A1',
    Unit: 'Strip' as UnitType,
    DefaultDiscountPercent: 0,
    ReorderLevel: 25,
    SupplierID: suppliers[0]?.SupplierID || '',
    Barcode: '',
    Strength: '',
    Category: 'General',
    Group: 'General',
    CustomGroup: '',
    MRP: 15.0,
    MRPChangeReason: 'Initial Profile Setup',
  });

  // Group color badge helper
  const getGroupBadgeClass = (groupName?: string) => {
    const g = (groupName || 'General').toLowerCase();
    if (g.includes('cardiac')) return 'bg-rose-950/80 text-rose-300 border-rose-800/60';
    if (g.includes('herbal')) return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60';
    if (g.includes('skin')) return 'bg-amber-950/80 text-amber-300 border-amber-800/60';
    if (g.includes('antibiotic')) return 'bg-purple-950/80 text-purple-300 border-purple-800/60';
    if (g.includes('antidiabetic')) return 'bg-teal-950/80 text-teal-300 border-teal-800/60';
    if (g.includes('gastro')) return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/60';
    if (g.includes('respiratory')) return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60';
    if (g.includes('ophthalmology')) return 'bg-yellow-950/80 text-yellow-300 border-yellow-800/60';
    return 'bg-blue-950/80 text-blue-300 border-blue-800/60';
  };

  // Fast Filtered medicines with multi-field matching
  const filteredMedicines = useMemo(() => {
    const q = search.trim().toLowerCase();
    return medicines.filter((m) => {
      const supp = suppliers.find((s) => s.SupplierID === m.SupplierID);
      const suppName = (supp?.Name || '').toLowerCase();

      const matchesSearch =
        !q ||
        m.TradeName.toLowerCase().includes(q) ||
        m.GenericName.toLowerCase().includes(q) ||
        m.RackNo.toLowerCase().includes(q) ||
        m.Barcode.toLowerCase().includes(q) ||
        (m.Group || '').toLowerCase().includes(q) ||
        (m.Strength || '').toLowerCase().includes(q) ||
        (m.Category || '').toLowerCase().includes(q) ||
        suppName.includes(q);

      const matchesGroup = selectedGroup === 'All' || m.Group === selectedGroup;
      const matchesSupplier = selectedSupplierId === 'All' || m.SupplierID === selectedSupplierId;

      return matchesSearch && matchesGroup && matchesSupplier;
    });
  }, [medicines, search, selectedGroup, selectedSupplierId, suppliers]);

  // Auto-highlight first matching medicine when searching so user can immediately press Enter or ArrowDown
  useEffect(() => {
    if (search.trim().length > 0 && filteredMedicines.length > 0) {
      setSelectedIndex(0);
    } else {
      setSelectedIndex(-1);
    }
  }, [search, selectedGroup, selectedSupplierId, filteredMedicines.length]);

  // Keyboard navigation from search input (ArrowDown, ArrowUp, Enter, Escape)
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
        handleOpenEdit(targetMed);
      }
    } else if (e.key === 'Escape') {
      if (search) {
        setSearch('');
        setSelectedIndex(-1);
      }
    }
  };

  // Quick keyboard shortcut ('/' key) to jump focus right into the search input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        isModalOpen ||
        mrpModalMed ||
        historyModalMed ||
        profitIntelMed ||
        substituteModalGeneric ||
        barcodeModalMed
      ) {
        return;
      }
      if (
        e.key === '/' &&
        document.activeElement !== searchInputRef.current &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isModalOpen,
    mrpModalMed,
    historyModalMed,
    profitIntelMed,
    substituteModalGeneric,
    barcodeModalMed,
  ]);

  // Open Add modal
  const handleOpenAdd = () => {
    setEditingMedicine(null);
    setFormData({
      TradeName: '',
      GenericName: '',
      RackNo: 'RACK-A1',
      Unit: 'Strip',
      DefaultDiscountPercent: 0,
      ReorderLevel: 25,
      SupplierID: suppliers[0]?.SupplierID || '',
      Barcode: `890${Math.floor(1000000 + Math.random() * 9000000)}`,
      Strength: '',
      Category: 'General',
      Group: 'General',
      CustomGroup: '',
      MRP: 15.0,
      MRPChangeReason: 'Initial Medicine Profile Setup',
    });
    setIsModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (med: Medicine) => {
    setEditingMedicine(med);
    const isCustom = !groups.includes(med.Group);
    setFormData({
      TradeName: med.TradeName,
      GenericName: med.GenericName,
      RackNo: med.RackNo,
      Unit: med.Unit,
      DefaultDiscountPercent: med.DefaultDiscountPercent,
      ReorderLevel: med.ReorderLevel,
      SupplierID: med.SupplierID,
      Barcode: med.Barcode,
      Strength: med.Strength || '',
      Category: med.Category || 'General',
      Group: isCustom ? 'Other' : med.Group || 'General',
      CustomGroup: isCustom ? med.Group : '',
      MRP: med.MRP || 15.0,
      MRPChangeReason: 'Medicine Profile Details Update',
    });
    setIsModalOpen(true);
  };

  // Open quick MRP change modal
  const handleOpenMrpModal = (med: Medicine) => {
    setMrpModalMed(med);
    setNewMrpInput(med.MRP || 15.0);
    setMrpChangeReason(
      med.TradeName.includes('Napa')
        ? 'March Price Revision (Increased from 10tk to 15tk)'
        : 'Manufacturer revised circular update'
    );
    setMrpEffectiveDate(new Date().toISOString().split('T')[0]);
  };

  // Save quick MRP update
  const handleSaveQuickMrp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mrpModalMed) return;

    if (newMrpInput <= 0) {
      showToast('Please enter a valid MRP greater than 0.', 'warning', 'Invalid MRP');
      return;
    }

    const res = updateMedicineMRP(
      mrpModalMed.MedicineID,
      newMrpInput,
      mrpChangeReason.trim() || 'MRP updated from Medicine Profile',
      mrpEffectiveDate
    );

    if (res.success) {
      showToast(
        `MRP for ${mrpModalMed.TradeName} updated to ${formatCurrency(newMrpInput)}. Stock revaluation impact: ${formatCurrency(res.revaluationImpact)} on ${res.affectedBatchesCount} batch(es).`,
        'success',
        'MRP & Stock Revaluation Synced'
      );
      setMrpModalMed(null);
    } else {
      showToast(res.error || 'Failed to update MRP', 'error', 'Error');
    }
  };

  // Save full medicine profile
  const handleSaveMedicine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.TradeName.trim() || !formData.GenericName.trim()) {
      showToast('Trade Name and Generic Name are required.', 'warning', 'Validation');
      return;
    }

    const effectiveGroup =
      formData.Group === 'Other' && formData.CustomGroup.trim()
        ? formData.CustomGroup.trim()
        : formData.Group;

    if (editingMedicine) {
      const oldMRP = editingMedicine.MRP || 0;
      const cleanNewMRP = Number(formData.MRP) || oldMRP;

      updateMedicine(editingMedicine.MedicineID, {
        TradeName: formData.TradeName.trim(),
        GenericName: formData.GenericName.trim(),
        RackNo: formData.RackNo.trim(),
        Unit: formData.Unit,
        DefaultDiscountPercent: Number(formData.DefaultDiscountPercent) || 0,
        ReorderLevel: Number(formData.ReorderLevel) || 10,
        SupplierID: formData.SupplierID,
        Barcode: formData.Barcode.trim(),
        Strength: formData.Strength.trim(),
        Category: formData.Category.trim(),
        Group: effectiveGroup,
        MRP: cleanNewMRP,
      });

      // If MRP was changed in the edit form, record dedicated reason
      if (cleanNewMRP !== oldMRP) {
        showToast(
          `Updated ${formData.TradeName} and synchronized active stock MRP to ${formatCurrency(cleanNewMRP)}!`,
          'success',
          'Profile & MRP Synced'
        );
      } else {
        showToast(`Updated profile for ${formData.TradeName}`, 'success', 'Profile Updated');
      }
    } else {
      addMedicine({
        TradeName: formData.TradeName.trim(),
        GenericName: formData.GenericName.trim(),
        RackNo: formData.RackNo.trim(),
        Unit: formData.Unit,
        DefaultDiscountPercent: Number(formData.DefaultDiscountPercent) || 0,
        ReorderLevel: Number(formData.ReorderLevel) || 10,
        Status: 'Active',
        SupplierID: formData.SupplierID,
        Barcode: formData.Barcode.trim() || `890${Date.now()}`,
        Strength: formData.Strength.trim(),
        Category: formData.Category.trim(),
        Group: effectiveGroup,
        MRP: Number(formData.MRP) || 15.0,
      });
      showToast(`Created medicine profile for ${formData.TradeName} in [${effectiveGroup}] Group`, 'success', 'Medicine Created');
    }

    setIsModalOpen(false);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* Module Title & Action Toolbar */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Pill className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Medicine Profile Management & Group Classification
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Module A · Trade names, generic formulations, supplier group divisions (Cardiac, General, Herbal, Skin), and real-time synchronized MRP valuations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Direct link to Napa Extra Intel */}
          <button
            onClick={() => {
              const napa = medicines.find((m) => m.TradeName.includes('Napa Extra')) || medicines[0];
              if (napa) setProfitIntelMed(napa);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-medium text-xs transition-colors shadow-xs"
            title="Demonstrate February (10tk) vs March (15tk) Intelligent Profit Calculation"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Intelligent Profit Demo (Feb vs Mar)</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Medicine Profile</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center gap-3">
        {/* Fast Search */}
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search by Trade Name, Generic, Group, Rack, Barcode... (↓/↑ to navigate, Enter to view/edit)"
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

        {/* Fast Keyboard Navigation Indicator */}
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
          <span className="text-slate-400">select to edit</span>
          <span className="text-slate-600">·</span>
          <span className="text-emerald-400 font-medium">Click row to edit</span>
          <span className="text-slate-600">|</span>
          <span className="font-mono text-slate-400">
            {filteredMedicines.length} medicine{filteredMedicines.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Group Selector Pill Filters */}
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
          {/* Dropdown for other groups */}
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-[11px] text-slate-300 rounded px-2 py-0.5 focus:outline-hidden"
          >
            <option value="All">All Groups ({groups.length})</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g} Group
              </option>
            ))}
          </select>
        </div>

        {/* Supplier Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-500 text-[11px]">Supplier:</span>
          <select
            value={selectedSupplierId}
            onChange={(e) => setSelectedSupplierId(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-300 rounded px-2 py-1 text-xs focus:outline-hidden"
          >
            <option value="All">All Suppliers ({suppliers.length})</option>
            {suppliers.map((s) => (
              <option key={s.SupplierID} value={s.SupplierID}>
                {s.Name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-slate-950 border border-slate-800 rounded overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <th className="p-3">Medicine & Generic</th>
                <th className="p-3">Group Division</th>
                <th className="p-3">Category / Strength</th>
                <th className="p-3">Active MRP</th>
                <th className="p-3">Shelf Rack</th>
                <th className="p-3">Total Stock</th>
                <th className="p-3">Supplier Name</th>
                <th className="p-3 text-right">Actions & Intel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850">
              {filteredMedicines.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <AlertCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-slate-400">
                      No medicines found matching &ldquo;{search}&rdquo;
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Press <kbd className="px-1 py-0.5 bg-slate-800 rounded text-slate-400">Esc</kbd> to clear search or click New Medicine Profile to add one.
                    </p>
                  </td>
                </tr>
              )}

              {filteredMedicines.map((med, index) => {
                const supp = suppliers.find((s) => s.SupplierID === med.SupplierID);
                const medBatches = batches.filter(
                  (b) => b.MedicineID === med.MedicineID && b.CurrentStock > 0
                );
                const totalStock = medBatches.reduce((sum, b) => sum + b.CurrentStock, 0);
                const isUnderReorder = totalStock <= med.ReorderLevel;
                const priceHistCount = (med.PriceHistory || []).length;
                const isSelected = index === selectedIndex;

                return (
                  <tr
                    key={med.MedicineID}
                    ref={(el) => {
                      rowRefs.current[index] = el;
                    }}
                    onClick={() => handleOpenEdit(med)}
                    className={`transition-all duration-150 cursor-pointer group border-l-4 select-none ${
                      isSelected
                        ? 'bg-emerald-950/60 border-l-emerald-400 ring-1 ring-inset ring-emerald-500/50 shadow-md text-white'
                        : 'hover:bg-slate-900/80 border-l-transparent text-slate-300'
                    }`}
                    title={`Click row or press Enter to edit ${med.TradeName}`}
                  >
                    {/* Trade Name & Generic */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500 text-slate-950 flex items-center gap-0.5 shadow-xs animate-pulse">
                            <span>ENTER TO EDIT</span>
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
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold border ${getGroupBadgeClass(
                          med.Group
                        )}`}
                      >
                        <Layers className="w-3 h-3" />
                        {med.Group || 'General'}
                      </span>
                    </td>

                    {/* Category & Strength */}
                    <td className="p-3 text-slate-300">
                      <div>{med.Category || 'General'}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {med.Strength || '—'} · {med.Unit}
                      </div>
                    </td>

                    {/* Active MRP & Quick Change Button */}
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="font-mono font-bold text-white text-sm">
                            {formatCurrency(med.MRP || 15.0)}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {priceHistCount > 0 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHistoryModalMed(med);
                                }}
                                className="text-emerald-400 hover:underline flex items-center gap-0.5"
                              >
                                <History className="w-2.5 h-2.5" />
                                {priceHistCount} price revision{priceHistCount > 1 ? 's' : ''}
                              </button>
                            ) : (
                              'Base MRP'
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenMrpModal(med);
                          }}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-700 text-[11px] flex items-center gap-1 transition-colors"
                          title="Change Medicine MRP (Syncs across active stock and POS)"
                        >
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span>Change MRP</span>
                        </button>
                      </div>
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
                        className={`font-mono text-xs font-semibold ${
                          isUnderReorder ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {totalStock} {med.Unit}
                      </div>
                      {isUnderReorder && (
                        <span className="text-[9px] text-rose-500 uppercase font-semibold">
                          Reorder Alert (≤{med.ReorderLevel})
                        </span>
                      )}
                    </td>

                    {/* Supplier */}
                    <td className="p-3 text-slate-300 max-w-[150px] truncate">
                      <div className="font-medium text-slate-200">{supp?.Name || '—'}</div>
                      <div className="text-[10px] text-slate-500">
                        Default Disc: {med.DefaultDiscountPercent || supp?.DefaultDiscountPercent || 0}%
                      </div>
                    </td>

                    {/* Action buttons */}
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Intelligent Profit Analysis */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProfitIntelMed(med);
                          }}
                          className="p-1.5 text-slate-400 hover:text-emerald-300 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 transition-colors"
                          title="View Intelligent Realized Profit & Margin Analysis (Feb vs Mar)"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Price History Timeline */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryModalMed(med);
                          }}
                          className="p-1.5 text-slate-400 hover:text-cyan-300 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 transition-colors"
                          title="View Price Revision History Timeline"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>

                        {/* Generic Substitute Lookup */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubstituteModalGeneric(med.GenericName);
                            setSubstituteActiveMedId(med.MedicineID);
                          }}
                          className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-slate-700/80 text-[11px] flex items-center gap-1 transition-colors"
                          title="View Generic Brand Substitutes"
                        >
                          <Sparkles className="w-3 h-3 text-emerald-400" />
                          <span>Substitutes</span>
                        </button>

                        {/* Barcode Print */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBarcodeModalMed(med);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 transition-colors"
                          title="Print Barcode Label"
                        >
                          <Barcode className="w-3.5 h-3.5" />
                        </button>

                        {/* Edit Medicine Profile */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(med);
                          }}
                          className="p-1.5 text-slate-300 hover:text-emerald-400 bg-slate-900 hover:bg-slate-800 rounded border border-slate-800 transition-colors"
                          title="Edit Medicine Profile & Group (or click row)"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete / Discontinue */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            askConfirm({
                              title: 'Discontinue Medicine Profile',
                              message: `Are you sure you want to mark "${med.TradeName}" as Discontinued?`,
                              confirmLabel: 'Discontinue',
                              cancelLabel: 'Keep Active',
                              isDestructive: true,
                              onConfirm: () => {
                                deleteMedicine(med.MedicineID);
                                showToast(`Discontinued ${med.TradeName}`, 'info', 'Status Updated');
                              },
                            });
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400 bg-slate-900 rounded border border-slate-800"
                          title="Discontinue Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* QUICK CHANGE MRP MODAL */}
      {mrpModalMed && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">
                  Update MRP: {mrpModalMed.TradeName}
                </h3>
              </div>
              <button
                onClick={() => setMrpModalMed(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickMrp} className="p-4 space-y-3.5 text-xs">
              <div className="bg-slate-900/80 p-3 rounded border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-slate-400 text-[11px]">Current Active MRP</div>
                  <div className="font-mono font-bold text-lg text-slate-300">
                    {formatCurrency(mrpModalMed.MRP || 15.0)}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-500" />
                <div>
                  <div className="text-emerald-400 text-[11px]">New Revised MRP</div>
                  <div className="font-mono font-bold text-lg text-emerald-400">
                    {formatCurrency(newMrpInput)}
                  </div>
                </div>
              </div>

              {/* Price comparison impact calculation */}
              {(() => {
                const oldMRP = mrpModalMed.MRP || 0;
                const diff = newMrpInput - oldMRP;
                const pct = oldMRP > 0 ? (diff / oldMRP) * 100 : 0;
                const medBatches = batches.filter(
                  (b) => b.MedicineID === mrpModalMed.MedicineID && b.CurrentStock > 0
                );
                const totalStock = medBatches.reduce((acc, b) => acc + b.CurrentStock, 0);
                const totalImpact = diff * totalStock;

                return (
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Price Adjustment:</span>
                      <span className={`font-mono font-bold ${diff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {diff >= 0 ? '+' : ''}{formatCurrency(diff)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Active Stock In Warehouse:</span>
                      <span className="font-mono text-slate-200">{totalStock} {mrpModalMed.Unit}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-emerald-900/40">
                      <span className="text-emerald-300 font-semibold">Immediate Stock Revaluation Gain:</span>
                      <span className="font-mono font-bold text-emerald-300 text-xs">
                        {diff >= 0 ? '+' : ''}{formatCurrency(totalImpact)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-slate-300 mb-1 font-medium">New Maximum Retail Price ({currencySymbol}) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 text-sm">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.5"
                    required
                    value={newMrpInput}
                    onChange={(e) => setNewMrpInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 pl-8 text-white font-mono font-semibold text-base focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Reason for Price Change *</label>
                <input
                  type="text"
                  required
                  value={mrpChangeReason}
                  onChange={(e) => setMrpChangeReason(e.target.value)}
                  placeholder="e.g. March price revision, manufacturer circular, VAT adjustment..."
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Effective Date</label>
                <input
                  type="date"
                  value={mrpEffectiveDate}
                  onChange={(e) => setMrpEffectiveDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="p-2.5 bg-slate-900 rounded border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Automatic Sync:</strong> Updating this MRP will immediately update all active warehouse batches of <em>{mrpModalMed.TradeName}</em> to {formatCurrency(newMrpInput)}, recalculating total stock retail valuation and syncing POS invoices.
                </span>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMrpModalMed(null)}
                  className="px-3 py-1.5 rounded text-slate-400 hover:text-white bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Update MRP & Revalue Stock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRICE HISTORY AUDIT TIMELINE MODAL */}
      {historyModalMed && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <h3 className="font-semibold text-white text-sm">
                  Price History & Audit Log: {historyModalMed.TradeName}
                </h3>
              </div>
              <button
                onClick={() => setHistoryModalMed(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div className="flex items-center justify-between bg-slate-900 p-3 rounded border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400">Current Active MRP:</span>{' '}
                  <strong className="text-emerald-400 font-mono text-sm">
                    {formatCurrency(historyModalMed.MRP || 15.0)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Group:</span>{' '}
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getGroupBadgeClass(historyModalMed.Group)}`}>
                    {historyModalMed.Group || 'General'}
                  </span>
                </div>
              </div>

              {/* Timeline list */}
              {(!historyModalMed.PriceHistory || historyModalMed.PriceHistory.length === 0) ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  No historical price revisions recorded yet for this medicine.
                </div>
              ) : (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Chronological Price Adjustments Timeline
                  </h4>
                  {historyModalMed.PriceHistory.map((rec, idx) => {
                    const diff = rec.NewMRP - rec.OldMRP;
                    const pct = rec.OldMRP > 0 ? (diff / rec.OldMRP) * 100 : 0;

                    return (
                      <div
                        key={rec.HistoryID || idx}
                        className="bg-slate-900 p-3.5 rounded border border-slate-800 text-xs space-y-1.5 relative overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-slate-400 text-[11px]">
                              {new Date(rec.EffectiveDate).toLocaleDateString([], {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                              })}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                diff >= 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                              }`}
                            >
                              {diff >= 0 ? '+' : ''}{formatCurrency(diff)} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                            </span>
                          </div>

                          <div className="font-mono text-xs">
                            <span className="text-slate-500 line-through mr-1.5">{formatCurrency(rec.OldMRP)}</span>
                            <span className="text-emerald-400 font-bold">{formatCurrency(rec.NewMRP)}</span>
                          </div>
                        </div>

                        <div className="text-slate-300 font-medium text-xs">
                          {rec.Reason}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                          <div>
                            Changed By: <span className="text-slate-200">{rec.ChangedBy}</span>
                          </div>
                          <div>
                            Stock Revalued: <span className="text-slate-200 font-mono">{rec.StockAtChange} units</span>
                          </div>
                        </div>

                        {rec.RevaluationImpact !== undefined && (
                          <div className="text-[11px] text-emerald-400 font-mono">
                            Stock Valuation Impact: <strong>{rec.RevaluationImpact >= 0 ? '+' : ''}{formatCurrency(rec.RevaluationImpact)}</strong>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-between items-center text-xs">
              <button
                onClick={() => {
                  setHistoryModalMed(null);
                  setMrpModalMed(historyModalMed);
                }}
                className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adjust MRP Now</span>
              </button>

              <button
                onClick={() => setHistoryModalMed(null)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTELLIGENT PROFIT & MARGIN EXPANSION MODAL (Feb vs Mar Scenario) */}
      {profitIntelMed && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">
                  Intelligent Profit Analysis: {profitIntelMed.TradeName}
                </h3>
              </div>
              <button
                onClick={() => setProfitIntelMed(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Highlight callout on accounting intelligence */}
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/50 rounded-lg text-slate-300 space-y-1">
                <div className="font-semibold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Intelligent Historical Accounting Integrity
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  When you sell a medicine at <strong>10tk in February</strong> and subsequently increase MRP to <strong>15tk in March</strong>, PharmaCore maintains exact transaction fidelity:
                  February sales remain preserved at 10tk (earning historical profit), March sales earn the increased 15tk profit margin, and current unsold inventory automatically gains revaluation value.
                </p>
              </div>

              {/* Monthly Realized Profit Breakdown */}
              {(() => {
                const intel = calculateMedicineProfitIntelligence(profitIntelMed, sales, batches);

                return (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                      <span>Monthly Realized Sales & Profit Comparison</span>
                      <span className="font-mono text-emerald-400 text-xs lowercase">
                        active mrp: {formatCurrency(profitIntelMed.MRP || 15.0)}
                      </span>
                    </h4>

                    {intel.monthlyReports.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 bg-slate-900 rounded border border-slate-800">
                        No historical sales transactions found for {profitIntelMed.TradeName}.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {intel.monthlyReports.map((report) => (
                          <div
                            key={report.monthKey}
                            className="bg-slate-900 p-3.5 rounded border border-slate-800 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{report.monthLabel}</span>
                                {report.notes && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-semibold">
                                    {report.notes}
                                  </span>
                                )}
                              </div>
                              <div className="font-mono text-xs">
                                Sold: <strong>{report.totalQuantitySold} {profitIntelMed.Unit}</strong>
                              </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2 bg-slate-950 p-2.5 rounded border border-slate-800/80 text-[11px]">
                              <div>
                                <div className="text-slate-500">Avg Selling Price</div>
                                <div className="font-mono font-bold text-white text-xs">
                                  {formatCurrency(report.averageSellingPrice)}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-500">Total Revenue</div>
                                <div className="font-mono font-semibold text-slate-200">
                                  {formatCurrency(report.totalRevenue)}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-500">Realized Profit</div>
                                <div className="font-mono font-bold text-emerald-400 text-xs">
                                  {formatCurrency(report.totalGrossProfit)}
                                </div>
                              </div>

                              <div>
                                <div className="text-slate-500">Gross Margin %</div>
                                <div className="font-mono font-bold text-cyan-400 text-xs">
                                  {report.grossMarginPercent.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Stock Revaluation Gain Component */}
                    <div className="p-3.5 bg-slate-900 rounded border border-slate-800 space-y-2">
                      <div className="font-bold text-white flex items-center justify-between text-xs">
                        <span>Active Stock Inventory Revaluation (Unsold Units)</span>
                        <span className="font-mono text-emerald-400">{intel.revaluation.currentStock} units in stock</span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div className="bg-slate-950 p-2 rounded border border-slate-850">
                          <div className="text-slate-500">Valuation at Cost</div>
                          <div className="font-mono font-bold text-slate-200">
                            {formatCurrency(intel.revaluation.stockCostValue)}
                          </div>
                        </div>

                        <div className="bg-slate-950 p-2 rounded border border-slate-850">
                          <div className="text-slate-500">Valuation at Current MRP</div>
                          <div className="font-mono font-bold text-emerald-400">
                            {formatCurrency(intel.revaluation.stockRetailValueAtCurrentMRP)}
                          </div>
                        </div>

                        <div className="bg-slate-950 p-2 rounded border border-slate-850">
                          <div className="text-slate-500">MRP Increase Capital Gain</div>
                          <div className="font-mono font-bold text-emerald-300">
                            +{formatCurrency(intel.revaluation.unrealizedRevaluationGain)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-end">
              <button
                onClick={() => setProfitIntelMed(null)}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs"
              >
                Close Intel View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL ADD / EDIT MEDICINE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 shrink-0">
              <h3 className="font-semibold text-white text-sm">
                {editingMedicine ? `Edit Medicine Profile: ${editingMedicine.TradeName}` : 'New Medicine Profile & Group Setup'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMedicine} className="p-4 space-y-3 text-xs overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Trade Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.TradeName}
                    onChange={(e) => setFormData({ ...formData, TradeName: e.target.value })}
                    placeholder="e.g. Napa Extra 500mg/65mg"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Generic Formulation *</label>
                  <input
                    type="text"
                    required
                    value={formData.GenericName}
                    onChange={(e) => setFormData({ ...formData, GenericName: e.target.value })}
                    placeholder="e.g. Paracetamol + Caffeine"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Group Selection */}
              <div className="p-3 bg-slate-900/90 rounded border border-slate-800 space-y-2">
                <label className="block text-emerald-400 font-semibold mb-1 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Supplier Medicine Group * (Mandatory for group-wise purchases & expire transactions)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={formData.Group}
                    onChange={(e) => setFormData({ ...formData, Group: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-white font-medium focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="General">General Group</option>
                    <option value="Cardiac">Cardiac Group</option>
                    <option value="Herbal">Herbal Group</option>
                    <option value="Skin">Skin Group</option>
                    <option value="Antibiotic">Antibiotic Group</option>
                    <option value="Antidiabetic">Antidiabetic Group</option>
                    <option value="Gastroenterology">Gastroenterology Group</option>
                    <option value="Respiratory">Respiratory Group</option>
                    <option value="Ophthalmology">Ophthalmology Group</option>
                    <option value="Pediatric">Pediatric Group</option>
                    <option value="Other">Other / Custom Group...</option>
                  </select>

                  {formData.Group === 'Other' ? (
                    <input
                      type="text"
                      required
                      value={formData.CustomGroup}
                      onChange={(e) => setFormData({ ...formData, CustomGroup: e.target.value })}
                      placeholder="Type custom group name..."
                      className="w-full bg-slate-950 border border-emerald-600 rounded p-2 text-white focus:outline-hidden"
                    />
                  ) : (
                    <div className="text-[11px] text-slate-400 flex items-center px-1">
                      Division used for group-wise procurement, inventory valuation, and supplier returns.
                    </div>
                  )}
                </div>
              </div>

              {/* Active MRP Input */}
              <div className="p-3 bg-slate-900/90 rounded border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-white font-semibold flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-400" />
                    Maximum Retail Price (MRP in {currencySymbol}) *
                  </label>
                  {editingMedicine && (
                    <span className="text-[11px] text-slate-400 font-mono">
                      Current MRP: {formatCurrency(editingMedicine.MRP || 15.0)}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-slate-400 text-sm">
                    {currencySymbol}
                  </span>
                  <input
                    type="number"
                    step="0.25"
                    min="0.5"
                    required
                    value={formData.MRP}
                    onChange={(e) => setFormData({ ...formData, MRP: parseFloat(e.target.value) || 0 })}
                    placeholder="15.00"
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 pl-8 text-white font-mono font-bold text-sm focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <p className="text-[10px] text-slate-400">
                  Changing this MRP automatically reflects across all active stock valuations and invoices immediately.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Rack / Shelf Location</label>
                  <input
                    type="text"
                    value={formData.RackNo}
                    onChange={(e) => setFormData({ ...formData, RackNo: e.target.value })}
                    placeholder="RACK-A1"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Unit Type</label>
                  <select
                    value={formData.Unit}
                    onChange={(e) => setFormData({ ...formData, Unit: e.target.value as UnitType })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="Strip">Strip</option>
                    <option value="Box">Box</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Bottle">Bottle</option>
                    <option value="Vial">Vial</option>
                    <option value="Tube">Tube</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Reorder Level</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.ReorderLevel}
                    onChange={(e) => setFormData({ ...formData, ReorderLevel: parseInt(e.target.value) || 10 })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Primary Supplier</label>
                  <select
                    value={formData.SupplierID}
                    onChange={(e) => setFormData({ ...formData, SupplierID: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                  >
                    {suppliers.map((s) => (
                      <option key={s.SupplierID} value={s.SupplierID}>
                        {s.Name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">
                    Individual Discount % <span className="text-[10px] text-slate-500">(0 = Fallback)</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={formData.DefaultDiscountPercent}
                    onChange={(e) =>
                      setFormData({ ...formData, DefaultDiscountPercent: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Barcode (Code128)</label>
                  <input
                    type="text"
                    value={formData.Barcode}
                    onChange={(e) => setFormData({ ...formData, Barcode: e.target.value })}
                    placeholder="8901234567"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Category / Strength</label>
                  <input
                    type="text"
                    value={formData.Strength}
                    onChange={(e) => setFormData({ ...formData, Strength: e.target.value })}
                    placeholder="e.g. 500mg, 10mg, 15g..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded text-slate-400 hover:text-white bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
                >
                  Save Medicine Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GENERIC SUBSTITUTES MODAL */}
      {substituteModalGeneric && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">
                  Substitutes for: {substituteModalGeneric}
                </h3>
              </div>
              <button
                onClick={() => setSubstituteModalGeneric(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {(() => {
                const subs = findSubstitutes(substituteModalGeneric, substituteActiveMedId);
                if (subs.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      No alternate brand substitutes found in inventory for {substituteModalGeneric}.
                    </div>
                  );
                }

                return subs.map(({ medicine, totalStock }) => (
                  <div
                    key={medicine.MedicineID}
                    className="p-3 bg-slate-900 rounded border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-white text-sm">{medicine.TradeName}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className={`px-2 py-0.2 rounded text-[10px] font-semibold border ${getGroupBadgeClass(medicine.Group)}`}>
                          {medicine.Group || 'General'}
                        </span>
                        <span>Rack: {medicine.RackNo}</span>
                        <span>·</span>
                        <span className="font-mono text-emerald-400 font-bold">MRP: {formatCurrency(medicine.MRP || 15.0)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-xs font-bold text-emerald-400">
                        {totalStock} {medicine.Unit}
                      </div>
                      <span className="text-[10px] text-slate-500">In Stock</span>
                    </div>
                  </div>
                ));
              })()}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-end">
              <button
                onClick={() => setSubstituteModalGeneric(null)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:text-white text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BARCODE PRINT PREVIEW MODAL */}
      {barcodeModalMed && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900">
              <h3 className="font-semibold text-white text-sm">Barcode Label</h3>
              <button
                onClick={() => setBarcodeModalMed(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center bg-white text-black m-4 rounded">
              <div className="font-bold text-xs">{barcodeModalMed.TradeName}</div>
              <div className="text-[10px] text-slate-600 font-mono mb-2">
                MRP: {formatCurrency(barcodeModalMed.MRP || 15.0)} · {barcodeModalMed.Group}
              </div>
              {(() => {
                const { svgPath, totalWidth } = generateBarcodeSvg(barcodeModalMed.Barcode, 36, 1.4);
                return (
                  <svg width={totalWidth} height={36} className="my-1">
                    <path d={svgPath} fill="#000" />
                  </svg>
                );
              })()}
              <div className="font-mono text-xs font-bold mt-1 tracking-widest">
                {barcodeModalMed.Barcode}
              </div>
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-900 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setBarcodeModalMed(null)}
                className="px-3 py-1.5 rounded text-slate-400 hover:text-white bg-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  window.print();
                  setBarcodeModalMed(null);
                }}
                className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Label</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
