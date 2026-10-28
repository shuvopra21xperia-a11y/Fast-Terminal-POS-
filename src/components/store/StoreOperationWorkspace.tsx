/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Regional Store Operation Workspace (Store In, Store Out, Store Inter-Change)
 * Purchase-Dashboard-Style Split View with Right-Docked Add Medicine Child Window (F2)
 * Auto-Generated Invoice Numbers + Required Sender & Receiver Name Chain-of-Custody
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import {
  WarehouseStore,
  StoreTransactionType,
  StoreTransactionItem,
  Medicine,
  StoreStockItem,
  Batch,
} from '../../types/pharmacy';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
  Search,
  Layers,
  Boxes,
  X,
  ChevronDown,
  Building,
  Globe,
  CornerDownLeft,
  Percent,
  PanelLeft,
  Zap,
  UserCheck,
  ShieldAlert,
  RotateCcw,
  Warehouse,
} from 'lucide-react';

interface StoreOperationWorkspaceProps {
  store: WarehouseStore;
  mode: StoreTransactionType;
  onTransactionCompleted?: () => void;
  onOpenStoreSettings?: () => void;
}

interface DraftStoreLine {
  medicineId: string;
  tradeName: string;
  genericName: string;
  group: string;
  supplierId: string;
  supplierName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  tp: number;
  vatPercent: number;
  vatAmount: number;
  discountPercent: number;
  discountAmount: number;
  costPrice: number;
  mrp: number;
  totalCost: number;
  rackLocation: string;
}

export const StoreOperationWorkspace: React.FC<StoreOperationWorkspaceProps> = ({
  store,
  mode,
  onTransactionCompleted,
  onOpenStoreSettings,
}) => {
  const {
    stores,
    storeStocks,
    medicines,
    batches,
    suppliers,
    groups,
    currentUser,
    peekNextStoreInvoiceNumber,
    processStoreIn,
    processStoreOut,
    processStoreInterchange,
    showToast,
    formatCurrency,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    toggleSidebar,
  } = usePharmacy();

  // Auto-collapse main navigation sidebar on workspace entry (Purchase Dashboard behavior)
  useEffect(() => {
    setIsSidebarCollapsed(true);
  }, [mode, store.StoreID, setIsSidebarCollapsed]);

  // Auto-generated Invoice Number (strictly system-generated, read-only)
  const autoInvoiceNumber = useMemo(
    () => peekNextStoreInvoiceNumber(mode),
    [peekNextStoreInvoiceNumber, mode]
  );

  // Active other stores for Store Inter-Change
  const otherActiveStores = useMemo(
    () => stores.filter((s) => s.StoreID !== store.StoreID && s.IsActive),
    [stores, store.StoreID]
  );

  const [targetStoreId, setTargetStoreId] = useState<string>(
    otherActiveStores[0]?.StoreID || ''
  );

  useEffect(() => {
    if (!otherActiveStores.some((s) => s.StoreID === targetStoreId)) {
      setTargetStoreId(otherActiveStores[0]?.StoreID || '');
    }
  }, [otherActiveStores, targetStoreId]);

  const targetStore = useMemo(
    () => otherActiveStores.find((s) => s.StoreID === targetStoreId) || null,
    [otherActiveStores, targetStoreId]
  );

  // Counter Sync Mode for Store In & Store Out
  const [counterSyncMode, setCounterSyncMode] = useState<'EXTERNAL' | 'MAIN_COUNTER'>(() =>
    mode === 'STORE_OUT' ? 'MAIN_COUNTER' : 'EXTERNAL'
  );

  useEffect(() => {
    setCounterSyncMode(mode === 'STORE_OUT' ? 'MAIN_COUNTER' : 'EXTERNAL');
  }, [mode]);

  // Sender & Receiver Name inputs (Required for every Store transaction)
  const [senderName, setSenderName] = useState<string>('');
  const [receiverName, setReceiverName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Reset draft & sensible defaults when switching store or mode
  const [items, setItems] = useState<DraftStoreLine[]>([]);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);

  useEffect(() => {
    setItems([]);
    setLastAddedKey(null);
    setNotes('');
    if (mode === 'STORE_IN') {
      setSenderName('');
      setReceiverName(store.BranchManager);
    } else if (mode === 'STORE_OUT') {
      setSenderName(store.BranchManager);
      setReceiverName('Farhan Kabir (Main POS Counter)');
    } else {
      setSenderName(store.BranchManager);
      setReceiverName(otherActiveStores[0]?.BranchManager || '');
    }
  }, [store.StoreID, mode]);

  // Supplier Searchable Dropdown (for Store In / Filter)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    suppliers[0]?.SupplierID || ''
  );
  const [supplierSearchText, setSupplierSearchText] = useState<string>('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState<boolean>(false);
  const [supplierMode, setSupplierMode] = useState<'single' | 'all'>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.SupplierID === selectedSupplierId) || suppliers[0],
    [suppliers, selectedSupplierId]
  );

  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((s) => map.set(s.SupplierID, s.Name));
    return map;
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchText.trim()) return suppliers;
    const q = supplierSearchText.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.Name.toLowerCase().includes(q) ||
        s.SupplierID.toLowerCase().includes(q) ||
        s.Phone.toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearchText]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(e.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // =========================================================================
  // RIGHT-SIDE DOCKED CHILD WINDOW STATE & REFS
  // =========================================================================
  const [isChildWindowOpen, setIsChildWindowOpen] = useState<boolean>(true);
  const [modalVat, setModalVat] = useState<string>('17.4');
  const [modalDiscount, setModalDiscount] = useState<string>('0');
  const [modalSearch, setModalSearch] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [highlightIndex, setHighlightIndex] = useState<number>(0);

  // Selected source entity depending on mode
  const [selectedCatalogMed, setSelectedCatalogMed] = useState<Medicine | null>(null);
  const [selectedCounterBatch, setSelectedCounterBatch] = useState<Batch | null>(null);
  const [selectedStoreStock, setSelectedStoreStock] = useState<StoreStockItem | null>(null);

  const [modalQty, setModalQty] = useState<string>('25');
  const [modalTP, setModalTP] = useState<string>('100');
  const [modalBatchNum, setModalBatchNum] = useState<string>(
    `S${store.StoreNumber}-BTH-${Math.floor(100 + Math.random() * 900)}`
  );
  const [modalExpiry, setModalExpiry] = useState<string>('2028-12-31');
  const [modalRack, setModalRack] = useState<string>(`S${store.StoreNumber}-BAY-A1`);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownListRef = useRef<HTMLDivElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const tpInputRef = useRef<HTMLInputElement>(null);
  const tableBottomRef = useRef<HTMLDivElement>(null);

  // Draft reserved quantities per (MedicineID::BatchNumber) for accurate live availability
  const reservedDraftMap = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((it) => {
      const k = `${it.medicineId}::${it.batchNumber.toUpperCase()}`;
      map.set(k, (map.get(k) || 0) + it.quantity);
    });
    return map;
  }, [items]);

  // Unified Candidate Option in Child Window
  interface CandidateOption {
    key: string;
    medicineId: string;
    tradeName: string;
    genericName: string;
    group: string;
    supplierId: string;
    supplierName: string;
    batchNumber: string;
    expiryDate: string;
    availableStock: number | null; // null when external intake
    tp: number;
    vatPercent: number;
    discountPercent: number;
    costPrice: number;
    mrp: number;
    rackLocation: string;
    rawMed?: Medicine;
    rawBatch?: Batch;
    rawStoreStock?: StoreStockItem;
  }

  const candidateOptions = useMemo<CandidateOption[]>(() => {
    const q = modalSearch.trim().toLowerCase();

    if (mode === 'STORE_IN' && counterSyncMode === 'EXTERNAL') {
      return medicines
        .filter((m) => {
          if (m.Status !== 'Active') return false;
          if (supplierMode === 'single' && m.SupplierID !== selectedSupplierId) return false;
          if (selectedGroup !== 'All' && (m.Group || 'General') !== selectedGroup) return false;
          if (!q) return true;
          const supName = supplierMap.get(m.SupplierID) || '';
          return (
            m.TradeName.toLowerCase().includes(q) ||
            m.GenericName.toLowerCase().includes(q) ||
            (m.Group || '').toLowerCase().includes(q) ||
            supName.toLowerCase().includes(q)
          );
        })
        .map((m) => {
          const defaultTp = Math.round((m.MRP || 20) * 0.75 * 100) / 100;
          return {
            key: m.MedicineID,
            medicineId: m.MedicineID,
            tradeName: m.TradeName,
            genericName: m.GenericName,
            group: m.Group || 'General',
            supplierId: m.SupplierID,
            supplierName: supplierMap.get(m.SupplierID) || selectedSupplier?.Name || 'Supplier',
            batchNumber: `S${store.StoreNumber}-${m.TradeName.slice(0, 3).toUpperCase()}-26`,
            expiryDate: '2028-12-31',
            availableStock: null,
            tp: defaultTp,
            vatPercent: 17.4,
            discountPercent: m.DefaultDiscountPercent || 0,
            costPrice: defaultTp,
            mrp: m.MRP || 20,
            rackLocation: `S${store.StoreNumber}-${m.RackNo || 'BAY-A1'}`,
            rawMed: m,
          };
        });
    }

    if (mode === 'STORE_IN' && counterSyncMode === 'MAIN_COUNTER') {
      return batches
        .filter((b) => b.CurrentStock > 0)
        .map((b) => {
          const med = medicines.find((m) => m.MedicineID === b.MedicineID);
          const reserved =
            reservedDraftMap.get(`${b.MedicineID}::${b.BatchNumber.toUpperCase()}`) || 0;
          const netAvail = Math.max(0, b.CurrentStock - reserved);
          return {
            key: b.BatchID,
            medicineId: b.MedicineID,
            tradeName: med?.TradeName || b.MedicineID,
            genericName: med?.GenericName || '',
            group: b.Group || med?.Group || 'General',
            supplierId: b.SupplierID || med?.SupplierID || 'SUP-001',
            supplierName:
              supplierMap.get(b.SupplierID || med?.SupplierID || '') || 'Primary Supplier',
            batchNumber: b.BatchNumber,
            expiryDate: b.ExpiryDate,
            availableStock: netAvail,
            tp: b.TradePrice || b.PurchasePrice,
            vatPercent: b.TradePriceVat || 0,
            discountPercent: 0,
            costPrice: b.CostPrice,
            mrp: b.SellingPrice || med?.MRP || b.CostPrice * 1.25,
            rackLocation: `S${store.StoreNumber}-${med?.RackNo || 'BAY-A1'}`,
            rawBatch: b,
            rawMed: med,
          };
        })
        .filter((opt) => {
          if (opt.availableStock !== null && opt.availableStock <= 0) return false;
          if (selectedGroup !== 'All' && opt.group !== selectedGroup) return false;
          if (!q) return true;
          return (
            opt.tradeName.toLowerCase().includes(q) ||
            opt.genericName.toLowerCase().includes(q) ||
            opt.batchNumber.toLowerCase().includes(q) ||
            opt.supplierName.toLowerCase().includes(q)
          );
        });
    }

    // STORE_OUT or STORE_INTERCHANGE -> pick from current Store's storeStocks
    return storeStocks
      .filter((st) => st.StoreID === store.StoreID && st.Quantity > 0)
      .map((st) => {
        const reserved =
          reservedDraftMap.get(`${st.MedicineID}::${st.BatchNumber.toUpperCase()}`) || 0;
        const netAvail = Math.max(0, st.Quantity - reserved);
        return {
          key: st.StoreStockID,
          medicineId: st.MedicineID,
          tradeName: st.TradeName,
          genericName: st.GenericName,
          group: st.Group || 'General',
          supplierId: st.SupplierID,
          supplierName: st.SupplierName,
          batchNumber: st.BatchNumber,
          expiryDate: st.ExpiryDate,
          availableStock: netAvail,
          tp: st.TP,
          vatPercent: st.VATPercent,
          discountPercent: st.DiscountPercent,
          costPrice: st.CostPrice,
          mrp: st.MRP,
          rackLocation: st.RackLocation,
          rawStoreStock: st,
        };
      })
      .filter((opt) => {
        if (opt.availableStock !== null && opt.availableStock <= 0) return false;
        if (supplierMode === 'single' && opt.supplierId !== selectedSupplierId) return false;
        if (selectedGroup !== 'All' && opt.group !== selectedGroup) return false;
        if (!q) return true;
        return (
          opt.tradeName.toLowerCase().includes(q) ||
          opt.genericName.toLowerCase().includes(q) ||
          opt.batchNumber.toLowerCase().includes(q) ||
          opt.supplierName.toLowerCase().includes(q) ||
          opt.rackLocation.toLowerCase().includes(q)
        );
      });
  }, [
    mode,
    counterSyncMode,
    medicines,
    batches,
    storeStocks,
    store.StoreID,
    store.StoreNumber,
    supplierMode,
    selectedSupplierId,
    selectedGroup,
    modalSearch,
    supplierMap,
    selectedSupplier,
    reservedDraftMap,
  ]);

  useEffect(() => {
    if (highlightIndex >= candidateOptions.length) {
      setHighlightIndex(Math.max(0, candidateOptions.length - 1));
    }
  }, [candidateOptions.length, highlightIndex]);

  useEffect(() => {
    if (isDropdownOpen && dropdownListRef.current) {
      const el = dropdownListRef.current.querySelector(
        `[data-opt-idx="${highlightIndex}"]`
      ) as HTMLElement | null;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, isDropdownOpen]);

  // Auto-scroll draft grid to bottom when row added
  useEffect(() => {
    if (items.length > 0) {
      tableBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [items.length]);

  // Global F2 / Escape hotkey for Child Window
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setIsChildWindowOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 60);
      } else if (e.key === 'Escape' && isChildWindowOpen && !isDropdownOpen) {
        setIsChildWindowOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isChildWindowOpen, isDropdownOpen]);

  const numericVat = modalVat.trim() === '' ? 0 : Math.max(0, parseFloat(modalVat) || 0);
  const numericDiscount =
    modalDiscount.trim() === '' ? 0 : Math.max(0, parseFloat(modalDiscount) || 0);
  const numericTP = modalTP.trim() === '' ? 0 : Math.max(0, parseFloat(modalTP) || 0);
  const numericQty = modalQty.trim() === '' ? 0 : Math.max(0, parseInt(modalQty, 10) || 0);

  const liveCalculation = useMemo(() => {
    const vatAmount = Math.round(((numericTP * numericVat) / 100) * 100) / 100;
    const discountAmount = Math.round(((numericTP * numericDiscount) / 100) * 100) / 100;
    const costPrice = Math.max(0, Math.round((numericTP + vatAmount - discountAmount) * 100) / 100);
    const lineTotal = Math.round(costPrice * numericQty * 100) / 100;
    return { vatAmount, discountAmount, costPrice, lineTotal };
  }, [numericTP, numericVat, numericDiscount, numericQty]);

  const selectedCandidateSummary = useMemo(() => {
    if (selectedStoreStock) {
      const reserved =
        reservedDraftMap.get(
          `${selectedStoreStock.MedicineID}::${selectedStoreStock.BatchNumber.toUpperCase()}`
        ) || 0;
      return {
        tradeName: selectedStoreStock.TradeName,
        genericName: selectedStoreStock.GenericName,
        group: selectedStoreStock.Group,
        supplierName: selectedStoreStock.SupplierName,
        mrp: selectedStoreStock.MRP,
        maxAvail: Math.max(0, selectedStoreStock.Quantity - reserved),
      };
    }
    if (selectedCounterBatch) {
      const med = medicines.find((m) => m.MedicineID === selectedCounterBatch.MedicineID);
      const reserved =
        reservedDraftMap.get(
          `${selectedCounterBatch.MedicineID}::${selectedCounterBatch.BatchNumber.toUpperCase()}`
        ) || 0;
      return {
        tradeName: med?.TradeName || selectedCounterBatch.MedicineID,
        genericName: med?.GenericName || '',
        group: selectedCounterBatch.Group || med?.Group || 'General',
        supplierName:
          supplierMap.get(selectedCounterBatch.SupplierID || med?.SupplierID || '') || 'Supplier',
        mrp: selectedCounterBatch.SellingPrice || med?.MRP || 0,
        maxAvail: Math.max(0, selectedCounterBatch.CurrentStock - reserved),
      };
    }
    if (selectedCatalogMed) {
      return {
        tradeName: selectedCatalogMed.TradeName,
        genericName: selectedCatalogMed.GenericName,
        group: selectedCatalogMed.Group || 'General',
        supplierName:
          supplierMap.get(selectedCatalogMed.SupplierID) || selectedSupplier?.Name || 'Supplier',
        mrp: selectedCatalogMed.MRP || 0,
        maxAvail: null as number | null,
      };
    }
    return null;
  }, [
    selectedStoreStock,
    selectedCounterBatch,
    selectedCatalogMed,
    medicines,
    supplierMap,
    selectedSupplier,
    reservedDraftMap,
  ]);

  const handleSelectOption = (opt: CandidateOption) => {
    setModalSearch(opt.tradeName);
    setIsDropdownOpen(false);
    setSelectedCatalogMed(opt.rawMed || null);
    setSelectedCounterBatch(opt.rawBatch || null);
    setSelectedStoreStock(opt.rawStoreStock || null);

    setModalTP(String(opt.tp));
    setModalVat(String(opt.vatPercent));
    setModalDiscount(String(opt.discountPercent));
    setModalBatchNum(opt.batchNumber);
    setModalExpiry(opt.expiryDate);
    setModalRack(opt.rackLocation);

    if (opt.availableStock !== null) {
      setModalQty(String(Math.min(20, Math.max(1, opt.availableStock))));
    } else {
      setModalQty('50');
    }

    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 40);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsDropdownOpen(true);
      setHighlightIndex((prev) => (prev < candidateOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsDropdownOpen(true);
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(0, candidateOptions.length - 1)
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (candidateOptions.length > 0 && isDropdownOpen) {
        handleSelectOption(candidateOptions[highlightIndex] || candidateOptions[0]);
      } else if (candidateOptions.length > 0 && !selectedCandidateSummary) {
        handleSelectOption(candidateOptions[0]);
      } else if (selectedCandidateSummary) {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const handleAddLineItem = () => {
    if (!selectedCandidateSummary) {
      showToast('Select a medicine from the Child Window search list first.', 'warning', 'No Medicine Selected');
      searchInputRef.current?.focus();
      return;
    }

    if (numericQty <= 0) {
      showToast('Quantity must be at least 1 unit.', 'warning', 'Invalid Quantity');
      qtyInputRef.current?.focus();
      return;
    }

    if (
      selectedCandidateSummary.maxAvail !== null &&
      numericQty > selectedCandidateSummary.maxAvail
    ) {
      showToast(
        `Requested quantity (${numericQty}) exceeds available batch stock (${selectedCandidateSummary.maxAvail}).`,
        'error',
        'Insufficient Batch Stock'
      );
      qtyInputRef.current?.focus();
      return;
    }

    const medId =
      selectedStoreStock?.MedicineID ||
      selectedCounterBatch?.MedicineID ||
      selectedCatalogMed?.MedicineID ||
      '';
    const supId =
      selectedStoreStock?.SupplierID ||
      selectedCounterBatch?.SupplierID ||
      selectedCatalogMed?.SupplierID ||
      selectedSupplier?.SupplierID ||
      'SUP-001';

    const cleanBatch =
      modalBatchNum.trim().toUpperCase() ||
      `S${store.StoreNumber}-BTH-${Date.now().toString().slice(-4)}`;

    const newRow: DraftStoreLine = {
      medicineId: medId,
      tradeName: selectedCandidateSummary.tradeName,
      genericName: selectedCandidateSummary.genericName,
      group: selectedCandidateSummary.group,
      supplierId: supId,
      supplierName: selectedCandidateSummary.supplierName,
      batchNumber: cleanBatch,
      expiryDate: modalExpiry || '2028-12-31',
      quantity: numericQty,
      tp: numericTP,
      vatPercent: numericVat,
      vatAmount: liveCalculation.vatAmount,
      discountPercent: numericDiscount,
      discountAmount: liveCalculation.discountAmount,
      costPrice: liveCalculation.costPrice,
      mrp: selectedCandidateSummary.mrp || Math.round(liveCalculation.costPrice * 1.25 * 100) / 100,
      totalCost: liveCalculation.lineTotal,
      rackLocation: modalRack.trim() || `S${store.StoreNumber}-BAY-A1`,
    };

    setItems((prev) => [...prev, newRow]);
    setLastAddedKey(`${medId}::${cleanBatch}`);

    showToast(
      `Added ${newRow.tradeName} (${newRow.quantity} units · Batch ${newRow.batchNumber}) to bottom of voucher`,
      'success',
      'Line Item Added'
    );

    // Reset selection & loop focus back to Search input
    setSelectedCatalogMed(null);
    setSelectedCounterBatch(null);
    setSelectedStoreStock(null);
    setModalSearch('');
    setIsDropdownOpen(false);
    setModalBatchNum(`S${store.StoreNumber}-BTH-${Math.floor(100 + Math.random() * 900)}`);

    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Totals
  const totalUnits = useMemo(() => items.reduce((s, i) => s + i.quantity, 0), [items]);
  const totalTP = useMemo(() => items.reduce((s, i) => s + i.tp * i.quantity, 0), [items]);
  const totalVAT = useMemo(() => items.reduce((s, i) => s + i.vatAmount * i.quantity, 0), [items]);
  const totalDiscount = useMemo(
    () => items.reduce((s, i) => s + i.discountAmount * i.quantity, 0),
    [items]
  );
  const netValuation = useMemo(() => items.reduce((s, i) => s + i.totalCost, 0), [items]);

  const handleConfirmTransaction = () => {
    if (!store.IsActive) {
      showToast(
        `${store.ShortName} is switched OFF in Settings and locked against transactions.`,
        'error',
        'Store Inactive'
      );
      return;
    }

    if (!senderName.trim()) {
      showToast('Please enter the Sender Name before confirming.', 'warning', 'Sender Name Required');
      return;
    }

    if (!receiverName.trim()) {
      showToast('Please enter the Receiver Name before confirming.', 'warning', 'Receiver Name Required');
      return;
    }

    if (items.length === 0) {
      showToast('Add at least one medicine line item using the right-side Child Window.', 'warning', 'Empty Voucher');
      return;
    }

    const payloadItems: Omit<StoreTransactionItem, 'ItemID'>[] = items.map((it) => ({
      MedicineID: it.medicineId,
      TradeName: it.tradeName,
      GenericName: it.genericName,
      Group: it.group,
      SupplierID: it.supplierId,
      SupplierName: it.supplierName,
      BatchNumber: it.batchNumber,
      ExpiryDate: it.expiryDate,
      Quantity: it.quantity,
      TP: it.tp,
      VATPercent: it.vatPercent,
      VATAmount: it.vatAmount,
      DiscountPercent: it.discountPercent,
      DiscountAmount: it.discountAmount,
      CostPrice: it.costPrice,
      MRP: it.mrp,
      TotalCost: it.totalCost,
      RackLocation: it.rackLocation,
    }));

    if (mode === 'STORE_IN') {
      const res = processStoreIn({
        storeId: store.StoreID,
        counterSyncMode,
        senderName,
        receiverName,
        supplierId: selectedSupplier?.SupplierID,
        supplierName:
          counterSyncMode === 'MAIN_COUNTER'
            ? 'Main Pharmacy POS Counter'
            : supplierMode === 'all'
            ? `${selectedSupplier?.Name || 'Supplier'} (Consolidated)`
            : selectedSupplier?.Name,
        group: selectedGroup !== 'All' ? selectedGroup : items[0]?.group || 'General',
        notes,
        items: payloadItems,
      });

      if (res.success && res.transaction) {
        showToast(
          `Store In Voucher ${res.transaction.InvoiceNumber} posted to ${store.ShortName} (+${res.transaction.TotalUnits} units).`,
          'success',
          'Store In Confirmed'
        );
        setItems([]);
        setLastAddedKey(null);
        setNotes('');
        onTransactionCompleted?.();
      } else {
        showToast(res.error || 'Unable to complete Store In.', 'error', 'Transaction Failed');
      }
      return;
    }

    if (mode === 'STORE_OUT') {
      const res = processStoreOut({
        storeId: store.StoreID,
        counterSyncMode,
        senderName,
        receiverName,
        supplierId: items[0]?.supplierId,
        supplierName: items[0]?.supplierName,
        group: selectedGroup !== 'All' ? selectedGroup : items[0]?.group || 'General',
        notes,
        items: payloadItems,
      });

      if (res.success && res.transaction) {
        showToast(
          `Store Out Voucher ${res.transaction.InvoiceNumber} dispatched from ${store.ShortName} (-${res.transaction.TotalUnits} units).`,
          'success',
          'Store Out Confirmed'
        );
        setItems([]);
        setLastAddedKey(null);
        setNotes('');
        onTransactionCompleted?.();
      } else {
        showToast(res.error || 'Unable to complete Store Out.', 'error', 'Transaction Failed');
      }
      return;
    }

    // STORE_INTERCHANGE
    if (!targetStoreId) {
      showToast(
        'No active destination store selected. Activate another regional store in Settings first.',
        'error',
        'Destination Store Required'
      );
      return;
    }

    const res = processStoreInterchange({
      sourceStoreId: store.StoreID,
      targetStoreId,
      senderName,
      receiverName,
      group: selectedGroup !== 'All' ? selectedGroup : items[0]?.group || 'General',
      notes,
      items: payloadItems,
    });

    if (res.success && res.transaction) {
      showToast(
        `Inter-Change Voucher ${res.transaction.InvoiceNumber} completed (${store.ShortName} -> ${targetStore?.ShortName}).`,
        'success',
        'Store Inter-Change Confirmed'
      );
      setItems([]);
      setLastAddedKey(null);
      setNotes('');
      onTransactionCompleted?.();
    } else {
      showToast(res.error || 'Unable to complete Store Inter-Change.', 'error', 'Transfer Failed');
    }
  };

  const modeMeta = useMemo(() => {
    if (mode === 'STORE_IN') {
      return {
        title: `${store.ShortName} · Store In Receiving Handler`,
        ctaLabel: 'Confirm Store In',
        icon: ArrowDownToLine,
        accentText: 'text-emerald-400',
        buttonBg: 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500',
        draftHeading: 'Draft Store In Receiving Items',
      };
    }
    if (mode === 'STORE_OUT') {
      return {
        title: `${store.ShortName} · Store Out Dispatch Handler`,
        ctaLabel: 'Confirm Store Out',
        icon: ArrowUpFromLine,
        accentText: 'text-amber-400',
        buttonBg: 'bg-amber-600 hover:bg-amber-500 border-amber-500',
        draftHeading: 'Draft Store Out Dispatch Items',
      };
    }
    return {
      title: `${store.ShortName} · Inter-Warehouse Transfer Handler`,
      ctaLabel: 'Confirm Inter-Change',
      icon: ArrowLeftRight,
      accentText: 'text-sky-400',
      buttonBg: 'bg-sky-600 hover:bg-sky-500 border-sky-500',
      draftHeading: 'Draft Store Inter-Change Transfer Items',
    };
  }, [mode, store.ShortName]);

  const ModeIcon = modeMeta.icon;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* Workspace Action Header (Matches Purchase Dashboard) */}
      <div className="px-4 py-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Expand Left Navigation Sidebar"
            >
              <PanelLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Menu</span>
            </button>
          )}

          <ModeIcon className={`w-4 h-4 shrink-0 ${modeMeta.accentText}`} />
          <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
            {modeMeta.title}
          </h3>
          <span className="hidden xl:inline text-xs text-slate-500 whitespace-nowrap">
            · Formula: <code className="text-emerald-400 font-mono">(TP + VAT) - Discount</code>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Read-only System Auto-Generated Invoice Display */}
          <div
            className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800 flex items-center gap-2 text-xs whitespace-nowrap"
            title="Invoice numbers are automatically generated by PharmaCore WMS for every new store transaction"
          >
            <span className="text-slate-400">Auto Voucher:</span>
            <span className="font-mono font-bold text-emerald-400 tabular-nums">
              {autoInvoiceNumber}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsChildWindowOpen((prev) => !prev);
              if (!isChildWindowOpen) {
                setTimeout(() => searchInputRef.current?.focus(), 80);
              }
            }}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer border ${
              isChildWindowOpen
                ? 'bg-slate-900 text-emerald-300 border-emerald-700/70'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isChildWindowOpen ? 'Child Window Open' : 'Add Medicine'}</span>
            <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-300">
              F2
            </kbd>
          </button>
        </div>
      </div>

      {/* SPLIT WORKSPACE: LEFT (DRAFT VOUCHER & CONTROLS) | RIGHT (DOCKED CHILD WINDOW) */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* ========================================================================= */}
        {/* LEFT PANEL: SENDER/RECEIVER, SOURCE/DEST CONTROLS & DRAFT ITEMS GRID      */}
        {/* ========================================================================= */}
        <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-2.5 min-w-0">
          {/* Inter-Change Inactive Warning if all other stores are OFF */}
          {mode === 'STORE_INTERCHANGE' && otherActiveStores.length === 0 && (
            <div className="p-3 bg-amber-950/60 border border-amber-700/60 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-200 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  All other regional stores are currently switched <strong>OFF</strong> in Settings. Inter-warehouse transfers require at least two active stores.
                </span>
              </div>
              {currentUser?.Role === 'Admin' && onOpenStoreSettings && (
                <button
                  type="button"
                  onClick={onOpenStoreSettings}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Activate Store in Settings
                </button>
              )}
            </div>
          )}

          {/* TOP COMPACT CONTROLS CARD */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5 shrink-0">
            {/* Row 1: Auto Voucher (No manual input) + Sender Name + Receiver Name */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              {/* Auto-Generated Invoice Box */}
              <div className="md:col-span-3">
                <label className="block text-slate-400 mb-1 text-[11px] font-medium">
                  Auto Invoice No (System Generated)
                </label>
                <div className="w-full bg-slate-900/90 border border-slate-800 rounded px-2.5 py-1.5 text-xs flex items-center justify-between">
                  <span className="font-mono font-bold text-emerald-400 tabular-nums">
                    {autoInvoiceNumber}
                  </span>
                  <span className="text-[10px] text-slate-500">Auto</span>
                </div>
              </div>

              {/* Sender Name Input */}
              <div className="md:col-span-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 text-[11px] font-semibold flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-emerald-400" />
                    <span>Sender Name *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setSenderName(
                        mode === 'STORE_IN'
                          ? counterSyncMode === 'MAIN_COUNTER'
                            ? 'Farhan Kabir (Main POS Counter)'
                            : `${selectedSupplier?.Name || 'Supplier'} Dispatch Rep`
                          : store.BranchManager
                      )
                    }
                    className="text-[10px] text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Quick Fill
                  </button>
                </div>
                <input
                  type="text"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder={
                    mode === 'STORE_IN'
                      ? 'Enter supplier rep or dispatcher name...'
                      : 'Enter dispatching store officer name...'
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Receiver Name Input */}
              <div className="md:col-span-5">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 text-[11px] font-semibold flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-sky-400" />
                    <span>Receiver Name *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setReceiverName(
                        mode === 'STORE_IN'
                          ? store.BranchManager
                          : mode === 'STORE_INTERCHANGE'
                          ? targetStore?.BranchManager || 'Receiving Branch Manager'
                          : counterSyncMode === 'MAIN_COUNTER'
                          ? 'Farhan Kabir (Main POS Counter)'
                          : 'Regional Requisition Officer'
                      )
                    }
                    className="text-[10px] text-sky-400 hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Use Default Receiver
                  </button>
                </div>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder={
                    mode === 'STORE_INTERCHANGE'
                      ? 'Enter destination store receiver name...'
                      : 'Enter receiving person name...'
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Row 2: Mode-Specific Routing & Scope Controls */}
            <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
              {mode === 'STORE_INTERCHANGE' ? (
                <>
                  <div className="md:col-span-4">
                    <label className="block text-slate-400 mb-0.5 text-[10px]">
                      Source Warehouse (Active)
                    </label>
                    <div className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 font-medium flex items-center justify-between">
                      <span className="truncate">{store.Name}</span>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0 ml-2">
                        {store.Code}
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-5">
                    <label className="block text-slate-300 mb-0.5 text-[10px] font-semibold">
                      Destination Active Warehouse *
                    </label>
                    <select
                      value={targetStoreId}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        setTargetStoreId(nextId);
                        const found = otherActiveStores.find((s) => s.StoreID === nextId);
                        if (found) setReceiverName(found.BranchManager);
                      }}
                      disabled={otherActiveStores.length === 0}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-semibold focus:outline-none focus:border-sky-500 disabled:opacity-50"
                    >
                      {otherActiveStores.length === 0 ? (
                        <option value="">No other active stores available</option>
                      ) : (
                        otherActiveStores.map((s) => (
                          <option key={s.StoreID} value={s.StoreID}>
                            {s.Name} ({s.Region})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-slate-400 mb-0.5 text-[10px]">
                      Filter Group
                    </label>
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="All">All Therapeutic Groups</option>
                      {groups.map((g) => (
                        <option key={g} value={g}>
                          {g} Group
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  {/* Channel Switch: External vs Main Counter Sync */}
                  <div className="md:col-span-4">
                    <label className="block text-slate-400 mb-0.5 text-[10px]">
                      {mode === 'STORE_IN' ? 'Store In Source Channel' : 'Store Out Dispatch Channel'}
                    </label>
                    <div className="grid grid-cols-2 gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setCounterSyncMode('EXTERNAL')}
                        className={`py-1 px-2 rounded text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          counterSyncMode === 'EXTERNAL'
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode === 'STORE_IN' ? 'Supplier / Logistics' : 'Branch Requisition'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCounterSyncMode('MAIN_COUNTER')}
                        className={`py-1 px-2 rounded text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                          counterSyncMode === 'MAIN_COUNTER'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {mode === 'STORE_IN' ? 'From POS Counter' : 'To POS Counter'}
                      </button>
                    </div>
                  </div>

                  {/* Supplier Combobox */}
                  <div className="md:col-span-5 relative" ref={supplierDropdownRef}>
                    <div className="flex items-center justify-between mb-0.5 text-[10px]">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Building className="w-3 h-3 text-emerald-400" />
                        Supplier Filter / Consignor
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSupplierMode('single')}
                          className={`px-1.5 py-0.2 rounded text-[10px] cursor-pointer ${
                            supplierMode === 'single'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          Single
                        </button>
                        <button
                          type="button"
                          onClick={() => setSupplierMode('all')}
                          className={`px-1.5 py-0.2 rounded text-[10px] cursor-pointer ${
                            supplierMode === 'all'
                              ? 'bg-indigo-950 text-indigo-300 border border-indigo-700/60'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          All Suppliers
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                      <input
                        type="text"
                        value={
                          isSupplierDropdownOpen
                            ? supplierSearchText
                            : supplierMode === 'all'
                            ? `All Suppliers (${suppliers.length})`
                            : selectedSupplier?.Name || ''
                        }
                        onFocus={() => {
                          setIsSupplierDropdownOpen(true);
                          setSupplierSearchText('');
                        }}
                        onChange={(e) => {
                          setSupplierSearchText(e.target.value);
                          setIsSupplierDropdownOpen(true);
                        }}
                        placeholder="Search supplier..."
                        className="w-full bg-slate-900 border border-slate-700 rounded pl-8 pr-7 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setIsSupplierDropdownOpen((p) => !p)}
                        className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-white"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {isSupplierDropdownOpen && (
                      <div className="absolute z-40 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-2xl max-h-52 overflow-y-auto">
                        <div
                          onClick={() => {
                            setSupplierMode('all');
                            setIsSupplierDropdownOpen(false);
                          }}
                          className="p-2 hover:bg-slate-800 cursor-pointer border-b border-slate-800 text-xs text-indigo-300 font-semibold flex items-center justify-between"
                        >
                          <span className="flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5" />
                            All Pharmaceutical Suppliers
                          </span>
                          <span className="font-mono text-[10px]">{suppliers.length}</span>
                        </div>
                        {filteredSuppliers.map((s) => (
                          <div
                            key={s.SupplierID}
                            onClick={() => {
                              setSelectedSupplierId(s.SupplierID);
                              setSupplierMode('single');
                              setIsSupplierDropdownOpen(false);
                              setSupplierSearchText('');
                            }}
                            className={`p-2 hover:bg-slate-800 cursor-pointer border-b border-slate-800/60 last:border-b-0 flex items-center justify-between text-xs ${
                              supplierMode === 'single' && s.SupplierID === selectedSupplierId
                                ? 'bg-emerald-950/40 text-emerald-300 font-semibold'
                                : 'text-slate-300'
                            }`}
                          >
                            <span className="truncate">{s.Name}</span>
                            <span className="font-mono text-[10px] text-slate-400 ml-2">
                              {s.SupplierID}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Group Filter */}
                  <div className="md:col-span-3">
                    <label className="block text-slate-400 mb-0.5 text-[10px] flex items-center gap-1">
                      <Layers className="w-3 h-3 text-emerald-400" />
                      Therapeutic Group
                    </label>
                    <select
                      value={selectedGroup}
                      onChange={(e) => setSelectedGroup(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="All">All Groups</option>
                      {groups.map((g) => (
                        <option key={g} value={g}>
                          {g} Group
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* DRAFT VOUCHER ITEMS GRID (HIGH-DENSITY) */}
          <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg flex flex-col overflow-hidden min-h-0">
            <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                <h4 className="font-semibold text-white text-xs">
                  {modeMeta.draftHeading} ({items.length})
                </h4>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                <span className="text-slate-400">
                  Units: <strong className="text-white">{totalUnits}</strong>
                </span>
                <span className="text-slate-400">
                  Valuation: <strong className="text-emerald-400">{formatCurrency(netValuation)}</strong>
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-900/95 border-b border-slate-800 text-slate-400 text-[11px] font-semibold">
                  <tr>
                    <th className="py-2 px-2.5">#</th>
                    <th className="py-2 px-2.5">Medicine & Generic</th>
                    <th className="py-2 px-2.5">Supplier · Group</th>
                    <th className="py-2 px-2.5">Batch & Expiry</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-right">Base TP</th>
                    <th className="py-2 px-2 text-right">VAT</th>
                    <th className="py-2 px-2 text-right">Disc</th>
                    <th className="py-2 px-2.5 text-right">Unit Cost</th>
                    <th className="py-2 px-2.5 text-right">Line Value</th>
                    <th className="py-2 px-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                  {items.map((item, idx) => {
                    const isNewest =
                      idx === items.length - 1 &&
                      lastAddedKey === `${item.medicineId}::${item.batchNumber.toUpperCase()}`;
                    return (
                      <tr
                        key={`${item.medicineId}-${item.batchNumber}-${idx}`}
                        className={`transition-colors ${
                          isNewest
                            ? 'bg-emerald-950/40 ring-1 ring-inset ring-emerald-500/40'
                            : 'hover:bg-slate-900/60'
                        }`}
                      >
                        <td className="py-2 px-2.5 text-slate-500 font-sans">{idx + 1}</td>
                        <td className="py-2 px-2.5 font-sans">
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{item.tradeName}</span>
                            {isNewest && (
                              <span className="text-[10px] text-emerald-400 font-medium">
                                · Added
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                            {item.genericName} · {item.rackLocation}
                          </div>
                        </td>
                        <td className="py-2 px-2.5 font-sans text-slate-300">
                          <div className="truncate max-w-[160px] text-xs">{item.supplierName}</div>
                          <div className="text-[11px] text-slate-400">{item.group}</div>
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="text-white font-medium">{item.batchNumber}</div>
                          <div className="text-[11px] text-slate-500">{item.expiryDate}</div>
                        </td>
                        <td className="py-2 px-2 text-right text-white font-bold">{item.quantity}</td>
                        <td className="py-2 px-2 text-right text-slate-300">
                          {formatCurrency(item.tp)}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-400">
                          {item.vatPercent > 0 ? `${item.vatPercent}%` : '0%'}
                        </td>
                        <td className="py-2 px-2 text-right text-emerald-400">
                          {item.discountPercent > 0 ? `-${item.discountPercent}%` : '0%'}
                        </td>
                        <td className="py-2 px-2.5 text-right text-emerald-400 font-semibold">
                          {formatCurrency(item.costPrice)}
                        </td>
                        <td className="py-2 px-2.5 text-right text-white font-bold">
                          {formatCurrency(item.totalCost)}
                        </td>
                        <td className="py-2 px-2 text-center font-sans">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
                            title="Remove line item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {items.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-10 text-center text-slate-400 font-sans">
                        <div className="max-w-sm mx-auto space-y-2">
                          <Boxes className="w-8 h-8 text-slate-600 mx-auto" />
                          <div className="text-sm font-semibold text-slate-300">
                            No medicines added to {autoInvoiceNumber} yet
                          </div>
                          <p className="text-xs text-slate-500">
                            Use the docked <strong className="text-emerald-400">Add Medicine Child Window</strong> on the right ([↓/↑] + [Enter]) to add batches rapidly.
                          </p>
                          {!isChildWindowOpen && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsChildWindowOpen(true);
                                setTimeout(() => searchInputRef.current?.focus(), 60);
                              }}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer mt-2"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Open Add Medicine Child Window</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div ref={tableBottomRef} />
            </div>
          </div>

          {/* BOTTOM CONFIRMATION & SUMMARY BAR */}
          <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs">
            <div className="flex flex-wrap items-center gap-4 font-mono tabular-nums text-slate-400">
              <span>
                Gross TP: <strong className="text-white">{formatCurrency(totalTP)}</strong>
              </span>
              <span>
                VAT: <strong className="text-slate-300">+{formatCurrency(totalVAT)}</strong>
              </span>
              <span>
                Discount: <strong className="text-emerald-400">-{formatCurrency(totalDiscount)}</strong>
              </span>
              <span className="text-sm">
                Net Value: <strong className="text-emerald-400">{formatCurrency(netValuation)}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional remarks / dispatch vehicle / reference..."
                className="w-48 lg:w-64 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />

              {items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setItems([])}
                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleConfirmTransaction}
                disabled={
                  items.length === 0 ||
                  (mode === 'STORE_INTERCHANGE' && otherActiveStores.length === 0)
                }
                className={`px-4 py-1.5 text-white rounded font-semibold text-xs flex items-center gap-1.5 border transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${modeMeta.buttonBg}`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {modeMeta.ctaLabel} ({items.length})
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT PANEL: DOCKED "ADD MEDICINE" CHILD WINDOW (PURCHASE DASHBOARD STYLE) */}
        {/* ========================================================================= */}
        {isChildWindowOpen && (
          <div className="w-[410px] shrink-0 border-l border-slate-800 bg-slate-950 flex flex-col h-full z-20">
            {/* Child Window Header */}
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Add Medicine Child Window</h4>
                  <p className="text-[10px] text-slate-400">
                    {mode === 'STORE_IN' && counterSyncMode === 'EXTERNAL'
                      ? 'Catalog Intake · Auto Batch & Cost Formula'
                      : mode === 'STORE_IN' && counterSyncMode === 'MAIN_COUNTER'
                      ? 'Main POS Counter Stock -> Store Intake'
                      : `${store.ShortName} Live Stock (${candidateOptions.length} batches)`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsChildWindowOpen(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors cursor-pointer"
                title="Close Child Window (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Child Window Body */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
              {/* 1. VAT & Discount Formula Controls */}
              <div className="p-2.5 bg-slate-900/90 rounded border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-[11px] flex items-center gap-1">
                    <Percent className="w-3 h-3 text-emerald-400" />
                    VAT % & Discount %
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Blank = 0%</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-0.5 text-[10px]">VAT %</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={modalVat}
                      onChange={(e) => setModalVat(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white font-mono tabular-nums text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-0.5 text-[10px]">Discount %</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={modalDiscount}
                      onChange={(e) => setModalDiscount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white font-mono tabular-nums text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Search Medicine / Batch Dropdown */}
              <div className="relative">
                <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1">
                    <Search className="w-3 h-3 text-emerald-400" />
                    {mode === 'STORE_IN' && counterSyncMode === 'EXTERNAL'
                      ? 'Search Medicine Catalog'
                      : 'Search Available Batch Stock'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">↓ / Enter</span>
                </label>

                <div className="relative">
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={modalSearch}
                    onFocus={() => setIsDropdownOpen(true)}
                    onChange={(e) => {
                      setModalSearch(e.target.value);
                      setIsDropdownOpen(true);
                      setHighlightIndex(0);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Type trade name, generic, or batch..."
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-medium text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <div className="absolute right-2.5 top-2.5 pointer-events-none text-slate-400">
                    <CornerDownLeft className="w-3.5 h-3.5" />
                  </div>
                </div>

                {isDropdownOpen && (
                  <div
                    ref={dropdownListRef}
                    className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-2xl max-h-56 overflow-y-auto"
                  >
                    <div className="px-2.5 py-1 text-[10px] text-slate-400 bg-slate-950 border-b border-slate-800 flex justify-between">
                      <span>{candidateOptions.length} matching records</span>
                      <span>[↓/↑] + [Enter]</span>
                    </div>

                    {candidateOptions.length === 0 ? (
                      <div className="p-3 text-center text-slate-500 text-xs">
                        No matching stock or medicine found.
                      </div>
                    ) : (
                      candidateOptions.map((opt, idx) => {
                        const isHighlighted = idx === highlightIndex;
                        return (
                          <div
                            key={opt.key}
                            data-opt-idx={idx}
                            onMouseEnter={() => setHighlightIndex(idx)}
                            onClick={() => handleSelectOption(opt)}
                            className={`p-2 border-b border-slate-800/60 last:border-b-0 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                              isHighlighted
                                ? 'bg-emerald-950/90 text-white ring-1 ring-inset ring-emerald-500/50'
                                : 'hover:bg-slate-800/70 text-slate-300'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-semibold text-white truncate">
                                {opt.tradeName}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {opt.genericName} · {opt.group}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate">
                                {opt.supplierName}
                                {opt.availableStock !== null && ` · Batch ${opt.batchNumber}`}
                              </div>
                            </div>

                            <div className="text-right shrink-0 font-mono tabular-nums">
                              {opt.availableStock !== null ? (
                                <>
                                  <div className="text-emerald-400 font-bold text-xs">
                                    Avail: {opt.availableStock}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    Cost: {formatCurrency(opt.costPrice)}
                                  </div>
                                </>
                              ) : (
                                <div className="text-emerald-400 font-bold text-xs">
                                  MRP: {formatCurrency(opt.mrp)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* 3. Selected Item Preview */}
              {selectedCandidateSummary && (
                <div className="p-2.5 bg-slate-900 border border-emerald-800/60 rounded text-xs space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-white truncate">
                      {selectedCandidateSummary.tradeName}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium shrink-0">
                      {selectedCandidateSummary.group}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {selectedCandidateSummary.genericName} · {selectedCandidateSummary.supplierName}
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 font-mono tabular-nums text-[11px]">
                    <span className="text-slate-400">
                      MRP: <strong className="text-white">{formatCurrency(selectedCandidateSummary.mrp)}</strong>
                    </span>
                    {selectedCandidateSummary.maxAvail !== null && (
                      <span className="text-emerald-400 font-semibold">
                        Available: {selectedCandidateSummary.maxAvail} units
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Quantity & TP Fast-Loop Inputs */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between text-[11px]">
                    <span>Quantity</span>
                    <kbd className="text-[9px] font-mono text-emerald-400">[Enter → TP]</kbd>
                  </label>
                  <input
                    ref={qtyInputRef}
                    type="number"
                    min="1"
                    max={selectedCandidateSummary?.maxAvail ?? undefined}
                    value={modalQty}
                    onChange={(e) => setModalQty(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        tpInputRef.current?.focus();
                        tpInputRef.current?.select();
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono tabular-nums font-bold text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between text-[11px]">
                    <span>Trade Price (TP)</span>
                    <kbd className="text-[9px] font-mono text-emerald-400">[Enter → Add]</kbd>
                  </label>
                  <input
                    ref={tpInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    value={modalTP}
                    onChange={(e) => setModalTP(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLineItem();
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono tabular-nums font-bold text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* 5. Batch, Expiry & Rack */}
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <label className="block text-slate-400 mb-0.5 text-[10px]">Batch No</label>
                  <input
                    type="text"
                    value={modalBatchNum}
                    readOnly={mode !== 'STORE_IN' || counterSyncMode === 'MAIN_COUNTER'}
                    onChange={(e) => setModalBatchNum(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono text-xs read-only:opacity-75 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5 text-[10px]">Expiry Date</label>
                  <input
                    type="date"
                    value={modalExpiry}
                    readOnly={mode !== 'STORE_IN' || counterSyncMode === 'MAIN_COUNTER'}
                    onChange={(e) => setModalExpiry(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono text-xs read-only:opacity-75 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5 text-[10px]">Bay / Rack</label>
                  <input
                    type="text"
                    value={modalRack}
                    onChange={(e) => setModalRack(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* 6. Live Formula Breakdown */}
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded space-y-1 font-mono tabular-nums text-[11px]">
                <div className="flex justify-between text-slate-400">
                  <span>Base TP:</span>
                  <span className="text-white">{formatCurrency(numericTP)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>+ VAT ({numericVat}%):</span>
                  <span className="text-slate-300">+{formatCurrency(liveCalculation.vatAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>- Discount ({numericDiscount}%):</span>
                  <span className="text-emerald-400">
                    -{formatCurrency(liveCalculation.discountAmount)}
                  </span>
                </div>
                <div className="pt-1 border-t border-slate-800 flex justify-between font-bold text-xs">
                  <span className="text-slate-200 font-sans">Unit Cost Price:</span>
                  <span className="text-emerald-400">{formatCurrency(liveCalculation.costPrice)}</span>
                </div>
                <div className="flex justify-between font-bold text-xs">
                  <span className="text-slate-200 font-sans">Line Total ({numericQty} units):</span>
                  <span className="text-white">{formatCurrency(liveCalculation.lineTotal)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddLineItem}
                className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Medicine to Voucher [Enter]</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
