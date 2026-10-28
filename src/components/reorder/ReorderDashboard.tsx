/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PharmaCore Enterprise Reorder System & Ink Printer Dashboard
 * Four Comprehensive Operational Pages:
 * 1) All Items / Live Stock Reorder (with never-purchased & no-medicine supplier filters)
 * 2) Regional Warehouse Stores Reorder
 * 3) On-Demand Reorder (Sold today / in date range and fell below reorder level)
 * 4) Llama 3 AI Analysis (Urgent restocks, long-term stocking, high-demand profit maximizers)
 *
 * Full Interactive & Keyboard Controls:
 * - Clickable rows across all pages
 * - Fast-search bar on each page
 * - Up / Down arrows: navigate and select medicines
 * - Left / Right arrows: switch focus between Supplier Tree and Medicine list
 * - + / - keys: increment or decrement medicine order quantity
 * - Enter / Spacebar: open child modal to input quantities directly
 * - Save, Edit, Delete order lists with creator's name on each order list
 * - Post-creation editing with +/- keys & Up/Down navigation
 * - Printable Ink Printer document with adjustable paper sizes (A4, Letter, Legal, A5)
 * - PDF Export with configurable download directory path in settings
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import {
  Medicine,
  Supplier,
  Batch,
  Sale,
  WarehouseStore,
  StoreStockItem,
  ReorderList,
  ReorderListItem,
  ReorderPaperSize,
  ReorderSettings,
} from '../../types/pharmacy';
import {
  ClipboardList,
  Search,
  Printer,
  Download,
  Settings,
  Plus,
  Minus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  Building2,
  Warehouse,
  Boxes,
  TrendingUp,
  Layers,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  FileText,
  Clock,
  UserCheck,
  ShieldAlert,
  ArrowUpDown,
  Filter,
  Eye,
  EyeOff,
  FolderTree,
  DollarSign,
  Send,
  RefreshCw,
  X,
  FileCheck,
  Zap,
} from 'lucide-react';

interface ReorderDashboardProps {
  onOpenSettings?: () => void;
}

type ReorderSubPage = 'all-items' | 'stores' | 'on-demand' | 'ai-analysis';

export const ReorderDashboard: React.FC<ReorderDashboardProps> = ({ onOpenSettings }) => {
  const {
    medicines,
    batches,
    suppliers,
    stores,
    storeStocks,
    purchases,
    sales,
    currentUser,
    currencySymbol,
    formatCurrency,
    showToast,
    askConfirm,
    reorderLists,
    reorderSettings,
    saveReorderList,
    deleteReorderList,
    updateReorderSettings,
  } = usePharmacy();

  // Active top tab (Four pages)
  const [activePage, setActivePage] = useState<ReorderSubPage>('all-items');

  // Search query (independent on each page, but quick synchronized)
  const [searchQuery, setSearchQuery] = useState('');

  // Page 1 specific filters:
  // (a) Hide items that have never been purchased
  const [hideNeverPurchased, setHideNeverPurchased] = useState(false);
  // (b) Hide suppliers that have no medicines
  const [hideEmptySuppliers, setHideEmptySuppliers] = useState(false);
  // Supplier tree selection & collapse states
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});

  // Page 2 Store selection
  const [selectedStoreId, setSelectedStoreId] = useState<string>('ALL');

  // Page 3 Date Range filter for On-Demand items sold & under reorder level
  const [dateRangePreset, setDateRangePreset] = useState<'today' | 'yesterday' | '7days' | '30days' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Page 4 AI Analysis category
  const [aiAnalysisTab, setAiAnalysisTab] = useState<'urgent' | 'longterm' | 'profitability'>('urgent');

  // Keyboard navigation focus state: 'tree' | 'table' | 'order-tray'
  const [keyboardFocusArea, setKeyboardFocusArea] = useState<'tree' | 'table' | 'order-tray'>('table');
  const [selectedTableIndex, setSelectedTableIndex] = useState<number>(0);
  const [selectedTreeIndex, setSelectedTreeIndex] = useState<number>(0);

  // Active Order List being created or edited (Working Order Sheet)
  const [workingListId, setWorkingListId] = useState<string>(() => `ORD-${Date.now().toString().slice(-6)}`);
  const [workingListTitle, setWorkingListTitle] = useState('Central Reorder Sheet');
  const [workingListNotes, setWorkingListNotes] = useState('');
  const [workingItems, setWorkingItems] = useState<ReorderListItem[]>([]);
  const [isEditingExistingList, setIsEditingExistingList] = useState(false);

  // Tray minimization state (minimizes right-hand order tray to give full width on all pages)
  const [isOrderTrayMinimized, setIsOrderTrayMinimized] = useState(false);

  // Print layout mode: '4col' (maximum row density: SL, Medicine Name, Unit/Type, Quantity) vs '8col' (detailed)
  const [printLayoutMode, setPrintLayoutMode] = useState<'4col' | '8col'>('4col');

  // Modals
  const [isQuantityModalOpen, setIsQuantityModalOpen] = useState(false);
  const [quantityModalItem, setQuantityModalItem] = useState<{
    medicine: Medicine;
    currentStock: number;
    defaultQty: number;
    unitType: 'pack' | 'piece';
  } | null>(null);
  const [modalInputQty, setModalInputQty] = useState<string>('10');
  const [modalInputUnit, setModalInputUnit] = useState<'pack' | 'piece'>('pack');

  // Print & PDF Preview Modal
  const [printPreviewList, setPrintPreviewList] = useState<ReorderList | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // View Saved Order Lists Drawer / Archive
  const [showSavedOrdersDrawer, setShowSavedOrdersDrawer] = useState(false);

  // Focus search input on demand
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Map of purchased medicine IDs to check if item was ever purchased
  const purchasedMedicineIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of purchases) {
      if (p.Items) {
        for (const it of p.Items) {
          ids.add(it.MedicineID);
        }
      }
    }
    return ids;
  }, [purchases]);

  // Calculate live total stock for each medicine (Pharmacy Counter Batches + Active Stores)
  const medicineStockLookup = useMemo(() => {
    const map = new Map<string, { counterStock: number; storeStock: number; totalStock: number }>();

    medicines.forEach((m) => {
      // Counter stock
      const counterStock = batches
        .filter((b) => b.MedicineID === m.MedicineID)
        .reduce((sum, b) => sum + (b.CurrentStock > 0 ? b.CurrentStock : 0), 0);

      // Store stock in active stores
      const activeStoreIds = new Set(stores.filter((s) => s.IsActive).map((s) => s.StoreID));
      const storeStock = storeStocks
        .filter((ss) => ss.MedicineID === m.MedicineID && activeStoreIds.has(ss.StoreID))
        .reduce((sum, ss) => sum + (ss.Quantity > 0 ? ss.Quantity : 0), 0);

      map.set(m.MedicineID, {
        counterStock,
        storeStock,
        totalStock: counterStock + storeStock,
      });
    });

    return map;
  }, [medicines, batches, stores, storeStocks]);

  // Suppliers with medicine counts
  const supplierMedicineCounts = useMemo(() => {
    const map = new Map<string, number>();
    suppliers.forEach((s) => map.set(s.SupplierID, 0));
    medicines.forEach((m) => {
      const cur = map.get(m.SupplierID) || 0;
      map.set(m.SupplierID, cur + 1);
    });
    return map;
  }, [suppliers, medicines]);

  // Filtered Suppliers for Page 1 Left Tree
  const treeSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (hideEmptySuppliers) {
        const count = supplierMedicineCounts.get(s.SupplierID) || 0;
        if (count === 0) return false;
      }
      return true;
    });
  }, [suppliers, hideEmptySuppliers, supplierMedicineCounts]);

  // All distinct therapeutic groups for Page 1 Left Supplier & Group Tree
  const allMedicineGroups = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach((m) => {
      if (m.Group) set.add(m.Group);
    });
    return Array.from(set).sort();
  }, [medicines]);

  // ==========================================================================
  // PAGE 1: ALL ITEMS / LIVE STOCK REORDER DATA
  // ==========================================================================
  const page1Items = useMemo(() => {
    return medicines
      .filter((m) => {
        // (a) Filter: hide items that have never been purchased
        if (hideNeverPurchased && !purchasedMedicineIds.has(m.MedicineID)) {
          return false;
        }

        // Supplier filter from left tree
        if (selectedSupplierId && m.SupplierID !== selectedSupplierId) {
          return false;
        }

        // Group filter
        if (selectedGroup !== 'All' && m.Group !== selectedGroup) {
          return false;
        }

        // Fast search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            m.TradeName.toLowerCase().includes(q) ||
            m.GenericName.toLowerCase().includes(q) ||
            m.Category.toLowerCase().includes(q) ||
            (m.Group && m.Group.toLowerCase().includes(q)) ||
            (m.RackNo && m.RackNo.toLowerCase().includes(q));
          if (!matches) return false;
        }

        return true;
      })
      .map((m) => {
        const stockInfo = medicineStockLookup.get(m.MedicineID) || {
          counterStock: 0,
          storeStock: 0,
          totalStock: 0,
        };
        const supplier = suppliers.find((s) => s.SupplierID === m.SupplierID);
        const piecesPerPack = m.PiecesPerPack || (m.Unit === 'Box' ? 10 : 1);
        const fefoBatch = batches.find((b) => b.MedicineID === m.MedicineID && b.CurrentStock > 0);
        const unitCost = fefoBatch?.CostPrice || m.TradePrice || m.MRP * 0.8;

        const isUnderReorder = stockInfo.totalStock <= m.ReorderLevel;
        const shortfall = Math.max(0, m.ReorderLevel * 2 - stockInfo.totalStock);
        const suggestedPacks = Math.max(1, Math.ceil(shortfall / piecesPerPack));

        return {
          medicine: m,
          supplier,
          stockInfo,
          piecesPerPack,
          unitCost,
          isUnderReorder,
          suggestedPacks,
          wasPurchased: purchasedMedicineIds.has(m.MedicineID),
        };
      });
  }, [
    medicines,
    hideNeverPurchased,
    purchasedMedicineIds,
    selectedSupplierId,
    selectedGroup,
    searchQuery,
    medicineStockLookup,
    suppliers,
    batches,
  ]);

  // ==========================================================================
  // PAGE 2: REGIONAL STORES REORDER DATA
  // ==========================================================================
  const page2StoreStockRows = useMemo(() => {
    return storeStocks
      .filter((ss) => {
        if (selectedStoreId !== 'ALL' && ss.StoreID !== selectedStoreId) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            ss.TradeName.toLowerCase().includes(q) ||
            ss.GenericName.toLowerCase().includes(q) ||
            ss.BatchNumber.toLowerCase().includes(q) ||
            ss.RackLocation.toLowerCase().includes(q) ||
            ss.SupplierName.toLowerCase().includes(q);
          if (!matches) return false;
        }
        return true;
      })
      .map((ss) => {
        const store = stores.find((s) => s.StoreID === ss.StoreID);
        const med = medicines.find((m) => m.MedicineID === ss.MedicineID);
        const piecesPerPack = med?.PiecesPerPack || 10;
        return {
          storeStock: ss,
          store,
          medicine: med,
          piecesPerPack,
          isLowInStore: ss.Quantity <= 20,
        };
      });
  }, [storeStocks, selectedStoreId, searchQuery, stores, medicines]);

  // ==========================================================================
  // PAGE 3: ON-DEMAND (Sold Today / in Date Range & Under Reorder Level)
  // ==========================================================================
  const page3OnDemandItems = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Determine target start and end dates
    let startIso = todayStr;
    let endIso = todayStr;

    if (dateRangePreset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      startIso = y.toISOString().split('T')[0];
      endIso = startIso;
    } else if (dateRangePreset === '7days') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 7);
      startIso = d7.toISOString().split('T')[0];
    } else if (dateRangePreset === '30days') {
      const d30 = new Date();
      d30.setDate(d30.getDate() - 30);
      startIso = d30.toISOString().split('T')[0];
    } else if (dateRangePreset === 'custom') {
      startIso = customStartDate;
      endIso = customEndDate;
    }

    // Filter sales within date range
    const matchingSales = sales.filter((s) => {
      const saleDay = s.SaleDate.split('T')[0];
      return saleDay >= startIso && saleDay <= endIso;
    });

    // Aggregate sold units per medicine
    const soldQtyMap = new Map<string, number>();
    for (const sale of matchingSales) {
      if (sale.Items) {
        for (const item of sale.Items) {
          const cur = soldQtyMap.get(item.MedicineID) || 0;
          soldQtyMap.set(item.MedicineID, cur + item.Quantity);
        }
      }
    }

    // Identify medicines sold in date range that fell below or are at their reorder level
    const items: {
      medicine: Medicine;
      supplier: Supplier | undefined;
      unitsSold: number;
      counterStock: number;
      storeStock: number;
      totalStock: number;
      reorderLevel: number;
      shortfall: number;
      suggestedPacks: number;
      piecesPerPack: number;
      unitCost: number;
      urgency: 'Urgent' | 'Normal';
    }[] = [];

    soldQtyMap.forEach((unitsSold, medId) => {
      const med = medicines.find((m) => m.MedicineID === medId);
      if (!med) return;

      const stockInfo = medicineStockLookup.get(medId) || { counterStock: 0, storeStock: 0, totalStock: 0 };

      // Check if item fell below or is at reorder level
      if (stockInfo.totalStock <= med.ReorderLevel) {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            med.TradeName.toLowerCase().includes(q) ||
            med.GenericName.toLowerCase().includes(q) ||
            med.Category.toLowerCase().includes(q);
          if (!match) return;
        }

        const supplier = suppliers.find((s) => s.SupplierID === med.SupplierID);
        const piecesPerPack = med.PiecesPerPack || (med.Unit === 'Box' ? 10 : 1);
        const shortfall = Math.max(0, med.ReorderLevel * 2 - stockInfo.totalStock);
        const suggestedPacks = Math.max(1, Math.ceil((unitsSold * 1.5 + shortfall) / piecesPerPack));
        const fefoBatch = batches.find((b) => b.MedicineID === med.MedicineID && b.CurrentStock > 0);
        const unitCost = fefoBatch?.CostPrice || med.TradePrice || med.MRP * 0.8;

        items.push({
          medicine: med,
          supplier,
          unitsSold,
          counterStock: stockInfo.counterStock,
          storeStock: stockInfo.storeStock,
          totalStock: stockInfo.totalStock,
          reorderLevel: med.ReorderLevel,
          shortfall,
          suggestedPacks,
          piecesPerPack,
          unitCost,
          urgency: stockInfo.totalStock <= 10 || stockInfo.totalStock <= med.ReorderLevel * 0.5 ? 'Urgent' : 'Normal',
        });
      }
    });

    return items.sort((a, b) => b.unitsSold - a.unitsSold);
  }, [sales, dateRangePreset, customStartDate, customEndDate, medicines, medicineStockLookup, searchQuery, suppliers, batches]);

  // ==========================================================================
  // PAGE 4: LLAMA AI INVENTORY ANALYSIS DATA
  // ==========================================================================
  const page4AiRecommendations = useMemo(() => {
    // 1. Urgent Restocks: High burn rate or severe depletion
    const urgentList: any[] = [];
    // 2. Long-Term Stocking: Steady sellers, seasonal, high bulk leverage
    const longTermList: any[] = [];
    // 3. High Demand & Profitability: Top gross margin generators
    const highProfitList: any[] = [];

    medicines.forEach((med) => {
      const stockInfo = medicineStockLookup.get(med.MedicineID) || { counterStock: 0, storeStock: 0, totalStock: 0 };
      const supplier = suppliers.find((s) => s.SupplierID === med.SupplierID);
      const fefoBatch = batches.find((b) => b.MedicineID === med.MedicineID && b.CurrentStock > 0);
      const cost = fefoBatch?.CostPrice || med.TradePrice || med.MRP * 0.78;
      const margin = med.MRP > 0 ? ((med.MRP - cost) / med.MRP) * 100 : 20;
      const piecesPerPack = med.PiecesPerPack || 10;

      // Estimated velocity burn
      const isUrgent = stockInfo.totalStock <= med.ReorderLevel || stockInfo.totalStock <= 15;
      const suggestedPacks = Math.max(5, Math.ceil((med.ReorderLevel * 2.5 - stockInfo.totalStock) / piecesPerPack));

      if (isUrgent) {
        urgentList.push({
          medicine: med,
          supplier,
          stockInfo,
          piecesPerPack,
          unitCost: cost,
          margin: Math.round(margin * 10) / 10,
          suggestedPacks,
          reason:
            stockInfo.totalStock === 0
              ? 'Complete stockout with persistent patient walk-in demand.'
              : `Stock (${stockInfo.totalStock} pcs) breached critical reorder threshold (${med.ReorderLevel} pcs). Burnout in < 3 days.`,
          priority: stockInfo.totalStock === 0 ? 'CRITICAL' : 'HIGH',
        });
      }

      // Long term candidate: high volume general or antibiotic
      if (med.Category === 'Antibiotic' || med.Category === 'Cardiac' || med.Category === 'Analgesic') {
        longTermList.push({
          medicine: med,
          supplier,
          stockInfo,
          piecesPerPack,
          unitCost: cost,
          margin: Math.round(margin * 10) / 10,
          suggestedPacks: Math.max(10, Math.ceil((med.ReorderLevel * 4) / piecesPerPack)),
          reason: `High clinical stability & supplier bulk discount opportunity from ${supplier?.Name || 'Principal Supplier'}. Avoid seasonal price hikes.`,
          priority: 'OPTIMAL',
        });
      }

      // High demand & profit maximizer: margin > 22%
      if (margin >= 22) {
        highProfitList.push({
          medicine: med,
          supplier,
          stockInfo,
          piecesPerPack,
          unitCost: cost,
          margin: Math.round(margin * 10) / 10,
          suggestedPacks: Math.max(8, Math.ceil((med.ReorderLevel * 2.5) / piecesPerPack)),
          reason: `Top profit velocity! Generates +${currencySymbol}${(med.MRP - cost).toFixed(2)} (${margin.toFixed(1)}%) per unit with zero inventory drag.`,
          priority: 'MAX_PROFIT',
        });
      }
    });

    return {
      urgent: urgentList.sort((a, b) => (b.priority === 'CRITICAL' ? 1 : 0) - (a.priority === 'CRITICAL' ? 1 : 0)),
      longterm: longTermList.slice(0, 15),
      profitability: highProfitList.sort((a, b) => b.margin - a.margin).slice(0, 15),
    };
  }, [medicines, medicineStockLookup, suppliers, batches, currencySymbol]);

  // Current active table rows depending on activePage
  const currentActiveTableRows = useMemo(() => {
    if (activePage === 'all-items') return page1Items;
    if (activePage === 'stores') return page2StoreStockRows;
    if (activePage === 'on-demand') return page3OnDemandItems;
    if (activePage === 'ai-analysis') return page4AiRecommendations[aiAnalysisTab];
    return [];
  }, [activePage, page1Items, page2StoreStockRows, page3OnDemandItems, page4AiRecommendations, aiAnalysisTab]);

  // Reset selected row index when page or filters change
  useEffect(() => {
    setSelectedTableIndex(0);
  }, [activePage, selectedSupplierId, selectedGroup, dateRangePreset, aiAnalysisTab, searchQuery]);

  // ==========================================================================
  // WORKING ORDER SHEET MANAGEMENT & ACTIONS
  // ==========================================================================

  // Add or increment medicine in working order list
  const handleAddOrIncrementMedicine = useCallback(
    (
      med: Medicine,
      qtyToAdd: number = 1,
      unitType: 'pack' | 'piece' = 'pack',
      customUrgency: 'Urgent' | 'Normal' = 'Normal'
    ) => {
      const piecesPerPack = med.PiecesPerPack || (med.Unit === 'Box' ? 10 : 1);
      const supplier = suppliers.find((s) => s.SupplierID === med.SupplierID);
      const fefoBatch = batches.find((b) => b.MedicineID === med.MedicineID && b.CurrentStock > 0);
      const unitCost = fefoBatch?.CostPrice || med.TradePrice || med.MRP * 0.8;
      const stockInfo = medicineStockLookup.get(med.MedicineID) || { totalStock: 0 };

      setWorkingItems((prev) => {
        const existingIdx = prev.findIndex((i) => i.medicineId === med.MedicineID);
        if (existingIdx >= 0) {
          const updated = [...prev];
          const item = updated[existingIdx];
          const newQty = Math.max(1, item.orderQuantity + qtyToAdd);
          const estTotal =
            item.unitType === 'pack'
              ? Math.round(newQty * unitCost * piecesPerPack * 100) / 100
              : Math.round(newQty * unitCost * 100) / 100;
          updated[existingIdx] = {
            ...item,
            orderQuantity: newQty,
            estimatedTotalCost: estTotal,
          };
          return updated;
        } else {
          const estTotal =
            unitType === 'pack'
              ? Math.round(qtyToAdd * unitCost * piecesPerPack * 100) / 100
              : Math.round(qtyToAdd * unitCost * 100) / 100;
          const newItem: ReorderListItem = {
            medicineId: med.MedicineID,
            tradeName: med.TradeName,
            genericName: med.GenericName,
            group: med.Group || 'General',
            supplierId: med.SupplierID,
            supplierName: supplier?.Name || 'Principal Supplier',
            currentStock: stockInfo.totalStock,
            reorderLevel: med.ReorderLevel,
            piecesPerPack,
            orderQuantity: qtyToAdd,
            unitType,
            unitCost,
            estimatedTotalCost: estTotal,
            urgency: customUrgency,
          };
          return [...prev, newItem];
        }
      });

      showToast(`Added ${qtyToAdd} ${unitType}(s) of ${med.TradeName} to active order sheet.`, 'success', 'Order Updated', 1500);
    },
    [suppliers, batches, medicineStockLookup, showToast]
  );

  // Decrement quantity in working order list
  const handleDecrementMedicine = useCallback((medId: string) => {
    setWorkingItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.medicineId === medId);
      if (existingIdx < 0) return prev;
      const item = prev[existingIdx];
      if (item.orderQuantity <= 1) {
        // remove
        return prev.filter((i) => i.medicineId !== medId);
      }
      const newQty = item.orderQuantity - 1;
      const estTotal =
        item.unitType === 'pack'
          ? Math.round(newQty * item.unitCost * item.piecesPerPack * 100) / 100
          : Math.round(newQty * item.unitCost * 100) / 100;
      const updated = [...prev];
      updated[existingIdx] = {
        ...item,
        orderQuantity: newQty,
        estimatedTotalCost: estTotal,
      };
      return updated;
    });
  }, []);

  // Remove single item from working order list
  const handleRemoveItem = useCallback((medId: string) => {
    setWorkingItems((prev) => prev.filter((i) => i.medicineId !== medId));
  }, []);

  // Open direct quantity input modal
  const handleOpenQuantityModal = useCallback(
    (med: Medicine, defaultQty: number = 5, unitType: 'pack' | 'piece' = 'pack') => {
      const stockInfo = medicineStockLookup.get(med.MedicineID) || { totalStock: 0 };
      setQuantityModalItem({
        medicine: med,
        currentStock: stockInfo.totalStock,
        defaultQty,
        unitType,
      });
      setModalInputQty(defaultQty.toString());
      setModalInputUnit(unitType);
      setIsQuantityModalOpen(true);
    },
    [medicineStockLookup]
  );

  // Apply modal quantity
  const handleApplyModalQuantity = useCallback(() => {
    if (!quantityModalItem) return;
    const num = parseInt(modalInputQty, 10);
    if (isNaN(num) || num <= 0) {
      showToast('Please enter a valid positive quantity.', 'warning', 'Invalid Quantity');
      return;
    }
    handleAddOrIncrementMedicine(quantityModalItem.medicine, num, modalInputUnit);
    setIsQuantityModalOpen(false);
    setQuantityModalItem(null);
  }, [quantityModalItem, modalInputQty, modalInputUnit, handleAddOrIncrementMedicine, showToast]);

  // Working order aggregates
  const workingAggregates = useMemo(() => {
    const totalCost = workingItems.reduce((sum, item) => sum + item.estimatedTotalCost, 0);
    const totalItems = workingItems.length;
    const totalUnits = workingItems.reduce((sum, item) => sum + item.orderQuantity, 0);
    return {
      totalCost: Math.round(totalCost * 100) / 100,
      totalItems,
      totalUnits,
    };
  }, [workingItems]);

  // Save current working order list
  const handleSaveWorkingList = useCallback(
    (status: 'Draft' | 'Finalized' = 'Finalized') => {
      if (workingItems.length === 0) {
        showToast('Order sheet is empty. Add medicines from any page first.', 'warning', 'Empty Order');
        return;
      }

      const listToSave: ReorderList = {
        id: workingListId,
        title: workingListTitle.trim() || `Reorder Sheet #${workingListId}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser?.FullName || 'Pharmacist / Admin',
        createdByRole: currentUser?.Role || 'Admin',
        status,
        notes: workingListNotes.trim(),
        items: workingItems,
        totalEstimatedCost: workingAggregates.totalCost,
        totalItemsCount: workingAggregates.totalItems,
        totalUnitsCount: workingAggregates.totalUnits,
      };

      saveReorderList(listToSave);
      setIsEditingExistingList(false);
    },
    [
      workingItems,
      workingListId,
      workingListTitle,
      workingListNotes,
      workingAggregates,
      currentUser,
      saveReorderList,
      showToast,
    ]
  );

  // Resume / Edit a saved order list (Post-creation editing)
  const handleResumeSavedOrder = useCallback((order: ReorderList) => {
    setWorkingListId(order.id);
    setWorkingListTitle(order.title);
    setWorkingListNotes(order.notes || '');
    setWorkingItems(order.items || []);
    setIsEditingExistingList(true);
    setShowSavedOrdersDrawer(false);
    showToast(`Loaded "${order.title}" into working editor. You can navigate and adjust quantities with +/- keys.`, 'info', 'Order Loaded');
  }, [showToast]);

  // Clear working sheet
  const handleClearWorkingSheet = useCallback(async () => {
    if (workingItems.length === 0) return;
    const ok = await askConfirm({
      title: 'Clear Active Order Sheet?',
      message: 'Are you sure you want to clear all items from the current active order sheet?',
      destructive: true,
      confirmText: 'Clear Items',
    });
    if (ok) {
      setWorkingItems([]);
      setWorkingListId(`ORD-${Date.now().toString().slice(-6)}`);
      setWorkingListTitle('Central Reorder Sheet');
      setWorkingListNotes('');
      setIsEditingExistingList(false);
      showToast('Active order sheet cleared.', 'info', 'Sheet Reset');
    }
  }, [workingItems.length, askConfirm, showToast]);

  // Delete saved order list
  const handleDeleteSavedOrder = useCallback(
    async (id: string, title: string) => {
      const ok = await askConfirm({
        title: `Delete Order List #${id}?`,
        message: `Are you sure you want to permanently delete "${title}"? This cannot be undone.`,
        destructive: true,
        confirmText: 'Delete Order List',
      });
      if (ok) {
        deleteReorderList(id);
      }
    },
    [askConfirm, deleteReorderList]
  );

  // One-click: add all on-demand items below reorder level to active order list
  const handleAddAllOnDemandToOrder = useCallback(() => {
    if (page3OnDemandItems.length === 0) {
      showToast('No medicines currently below reorder level for this date range.', 'info', 'No Shortfalls');
      return;
    }
    page3OnDemandItems.forEach((item) => {
      handleAddOrIncrementMedicine(item.medicine, item.suggestedPacks, 'pack', item.urgency);
    });
    showToast(`Added all ${page3OnDemandItems.length} under-stocked medicines to active order sheet.`, 'success', 'Bulk Add Complete');
  }, [page3OnDemandItems, handleAddOrIncrementMedicine, showToast]);

  // One-click: add all AI recommended items to active order list
  const handleAddAllAiRecommendationsToOrder = useCallback(() => {
    const list = page4AiRecommendations[aiAnalysisTab];
    if (!list || list.length === 0) return;
    list.forEach((item: any) => {
      handleAddOrIncrementMedicine(item.medicine, item.suggestedPacks, 'pack', 'Urgent');
    });
    showToast(`Added ${list.length} AI-recommended items to active order sheet.`, 'success', 'AI Recommendations Added');
  }, [page4AiRecommendations, aiAnalysisTab, handleAddOrIncrementMedicine, showToast]);

  // ==========================================================================
  // GLOBAL KEYBOARD LISTENER: UP / DOWN, LEFT / RIGHT, +, -, ENTER / SPACEBAR
  // ==========================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If modal is open, let modal handle keys
      if (isQuantityModalOpen || printPreviewList || isSettingsModalOpen) {
        return;
      }

      // If user is typing inside an input or textarea, don't intercept unless Escape
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      // 1. Left / Right arrow keys: Switch focus between Supplier Tree and Medicine list
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setKeyboardFocusArea('tree');
        showToast('Focus: Supplier Tree (Use Up/Down to browse suppliers)', 'info', 'Navigation', 800);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setKeyboardFocusArea('table');
        showToast('Focus: Medicine List (Use Up/Down to browse, +/- to adjust)', 'info', 'Navigation', 800);
        return;
      }

      // 2. Up / Down arrow keys: Navigate and select medicines or suppliers
      if (keyboardFocusArea === 'tree') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedTreeIndex((prev) => (prev < treeSuppliers.length - 1 ? prev + 1 : 0));
          const nextSupp = treeSuppliers[(selectedTreeIndex + 1) % treeSuppliers.length];
          if (nextSupp) setSelectedSupplierId(nextSupp.SupplierID);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedTreeIndex((prev) => (prev > 0 ? prev - 1 : treeSuppliers.length - 1));
          const prevSupp = treeSuppliers[(selectedTreeIndex - 1 + treeSuppliers.length) % treeSuppliers.length];
          if (prevSupp) setSelectedSupplierId(prevSupp.SupplierID);
          return;
        }
      } else {
        // Table navigation
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedTableIndex((prev) =>
            currentActiveTableRows.length > 0 ? (prev < currentActiveTableRows.length - 1 ? prev + 1 : 0) : 0
          );
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedTableIndex((prev) =>
            currentActiveTableRows.length > 0 ? (prev > 0 ? prev - 1 : currentActiveTableRows.length - 1) : 0
          );
          return;
        }
      }

      // 3. + / - keys: Increase or decrease medicine quantity in the active order list
      if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        const activeRow = currentActiveTableRows[selectedTableIndex] as any;
        if (activeRow) {
          const med = activeRow.medicine || activeRow.storeStock || activeRow;
          if (med && med.MedicineID) {
            handleAddOrIncrementMedicine(med, 1, 'pack');
          }
        }
        return;
      }

      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        const activeRow = currentActiveTableRows[selectedTableIndex] as any;
        if (activeRow) {
          const med = activeRow.medicine || activeRow.storeStock || activeRow;
          if (med && med.MedicineID) {
            handleDecrementMedicine(med.MedicineID);
          }
        }
        return;
      }

      // 4. Enter / Spacebar: Open modal/child window to input quantities directly
      if (e.key === 'Enter' || e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        const activeRow = currentActiveTableRows[selectedTableIndex] as any;
        if (activeRow) {
          const med = activeRow.medicine || activeRow.storeStock || activeRow;
          if (med && med.MedicineID) {
            handleOpenQuantityModal(med, activeRow.suggestedPacks || 5, 'pack');
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isQuantityModalOpen,
    printPreviewList,
    isSettingsModalOpen,
    keyboardFocusArea,
    selectedTableIndex,
    selectedTreeIndex,
    currentActiveTableRows,
    treeSuppliers,
    handleAddOrIncrementMedicine,
    handleDecrementMedicine,
    handleOpenQuantityModal,
    showToast,
  ]);

  // ==========================================================================
  // INK PRINTER PRINTING & PDF EXPORT ENGINE
  // ==========================================================================
  const handlePrintInkOrder = useCallback(
    (orderToPrint: ReorderList) => {
      setPrintPreviewList(orderToPrint);
      if (reorderSettings.paperSize === 'Custom') {
        setPrintLayoutMode('4col');
      }
    },
    [reorderSettings.paperSize]
  );

  const executeNativePrint = () => {
    if (!printPreviewList) {
      window.print();
      return;
    }
    const is4Col = reorderSettings.paperSize === 'Custom' || printLayoutMode === '4col';
    const printableContent = generateOrderPrintableHtml(
      printPreviewList,
      reorderSettings,
      currentUser?.FullName,
      is4Col
    );

    try {
      let iframe = document.getElementById('ink-order-print-frame') as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'ink-order-print-frame';
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(printableContent);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }, 200);
        return;
      }
    } catch {
      // Fallback to window.print if iframe fails
    }
    window.print();
  };

  const executeDownloadPdfDocument = (order: ReorderList) => {
    const is4Col = reorderSettings.paperSize === 'Custom' || printLayoutMode === '4col';
    const paperLabel =
      reorderSettings.paperSize === 'Custom'
        ? `Custom_${reorderSettings.customPaperWidth || 3.8}x${reorderSettings.customPaperHeight || 9.0}${reorderSettings.customPaperUnit || 'in'}`
        : reorderSettings.paperSize;
    const modeLabel = is4Col ? '_4Col_MaxRows' : '_Detailed';
    const fileName = `Reorder_List_${order.id}_${paperLabel}${modeLabel}.html`;
    const printableContent = generateOrderPrintableHtml(
      order,
      reorderSettings,
      currentUser?.FullName,
      is4Col
    );

    const blob = new Blob([printableContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(
      `PDF Document (${is4Col ? '4-Column Max Rows' : 'Detailed'}) generated for #${order.id}. Target: ${reorderSettings.pdfDownloadDirectory}\\${fileName}`,
      'success',
      'PDF Export Ready',
      6000
    );
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-slate-950 font-sans text-slate-100 overflow-hidden select-none">
      {/* ===================================================================== */}
      {/* TOP REORDER COMMAND BAR & 4-PAGES SUB-NAVIGATION                       */}
      {/* ===================================================================== */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-950 border border-emerald-600/60 text-emerald-400">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Enterprise Reorder System</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  Ink Printer Edition ({reorderSettings.paperSize === 'Custom' ? `Custom: ${reorderSettings.customPaperWidth || 3.8}" × ${reorderSettings.customPaperHeight || 9.0}"` : reorderSettings.paperSize})
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Created by: <strong className="text-emerald-400">{currentUser?.FullName || 'Admin'}</strong> • Direct Ink Paper Sizing & Audit Trails
              </p>
            </div>
          </div>

          {/* FOUR SUB-PAGES SELECTOR TABS */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 ml-4">
            <button
              type="button"
              onClick={() => setActivePage('all-items')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activePage === 'all-items'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>1. All Items (Live Stock)</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePage('stores')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activePage === 'stores'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <Warehouse className="w-3.5 h-3.5" />
              <span>2. Regional Stores</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePage('on-demand')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activePage === 'on-demand'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>3. On-Demand (Sold & Under Level)</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePage('ai-analysis')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activePage === 'ai-analysis'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>4. Llama AI Analysis</span>
            </button>
          </div>
        </div>

        {/* TOP RIGHT ACTIONS */}
        <div className="flex items-center gap-2">
          {/* Order List Minimize/Expand Toggle */}
          <button
            type="button"
            onClick={() => setIsOrderTrayMinimized((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-all ${
              isOrderTrayMinimized
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80 hover:bg-emerald-900 shadow-xs'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={isOrderTrayMinimized ? 'Expand order sheet to review/adjust' : 'Minimize order sheet to give maximum space to medicine tables'}
          >
            {isOrderTrayMinimized ? (
              <>
                <ChevronLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>Show Order Sheet ({workingItems.length})</span>
              </>
            ) : (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span>Minimize Sheet</span>
              </>
            )}
          </button>

          {/* Working Sheet Badge & Toggle */}
          <button
            type="button"
            onClick={() => setShowSavedOrdersDrawer((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            title="View saved and historical order lists"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Saved Orders ({reorderLists.length})</span>
          </button>

          {/* Reorder Settings (Paper Size & Download Directory) */}
          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            title="Configure Ink Printer Paper Size (A4/Letter/Legal/A5/Custom) & PDF Download Path"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-400" />
            <span>Printer & Paper Setup</span>
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* MAIN TWO-PANE LAYOUT: WORKSPACE (LEFT) + ACTIVE ORDER TRAY (RIGHT)     */}
      {/* ===================================================================== */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT / CENTER VIEWPORT */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 border-r border-slate-800">
          
          {/* ================================================================= */}
          {/* FAST SEARCH & CONTEXTUAL FILTER BAR (INCLUDED ON ALL PAGES)       */}
          {/* ================================================================= */}
          <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-[280px]">
              {/* Fast Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Fast Search in ${
                    activePage === 'all-items'
                      ? 'all medicines, generic, group...'
                      : activePage === 'stores'
                      ? 'store stock by name, rack, batch...'
                      : activePage === 'on-demand'
                      ? 'on-demand shortfalls...'
                      : 'AI recommended items...'
                  }`}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-sans"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* PAGE 1 SPECIFIC FILTERS: (a) Never Purchased & (b) Empty Suppliers */}
              {activePage === 'all-items' && (
                <div className="flex items-center gap-2 text-xs">
                  {/* (a) Toggle: Hide / Show Never Purchased */}
                  <button
                    type="button"
                    onClick={() => setHideNeverPurchased((prev) => !prev)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      hideNeverPurchased
                        ? 'bg-amber-950/70 border-amber-600/80 text-amber-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                    title="Toggle to hide or show medicines that have never been purchased"
                  >
                    {hideNeverPurchased ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{hideNeverPurchased ? 'Hiding Never Purchased' : 'All Catalog Items'}</span>
                  </button>

                  {/* (b) Toggle: Hide / Show Suppliers without Medicines */}
                  <button
                    type="button"
                    onClick={() => setHideEmptySuppliers((prev) => !prev)}
                    className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                      hideEmptySuppliers
                        ? 'bg-sky-950/70 border-sky-600/80 text-sky-300'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                    title="Toggle to hide or show suppliers that have no catalog medicines"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{hideEmptySuppliers ? 'Hiding 0-Medicine Suppliers' : 'All Suppliers'}</span>
                  </button>
                </div>
              )}

              {/* PAGE 2 STORE SELECTOR */}
              {activePage === 'stores' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400 flex items-center gap-1">
                    <Warehouse className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Select Store:</span>
                  </label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                  >
                    <option value="ALL">All Regional Stores (Consolidated)</option>
                    {stores.map((s) => (
                      <option key={s.StoreID} value={s.StoreID}>
                        {s.ShortName} ({s.IsActive ? 'Online' : 'Offline'}) — {s.Name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* PAGE 3 DATE RANGE FILTER FOR ON-DEMAND */}
              {activePage === 'on-demand' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 p-0.5 rounded-lg text-xs">
                    {(['today', 'yesterday', '7days', '30days', 'custom'] as const).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDateRangePreset(preset)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold capitalize transition-colors ${
                          dateRangePreset === preset
                            ? 'bg-amber-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {preset === '7days' ? 'Last 7D' : preset === '30days' ? 'Last 30D' : preset}
                      </button>
                    ))}
                  </div>

                  {dateRangePreset === 'custom' && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                      />
                      <span>to</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddAllOnDemandToOrder}
                    className="px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm ml-auto cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add All Shortfalls to Order ({page3OnDemandItems.length})</span>
                  </button>
                </div>
              )}

              {/* PAGE 4 AI ANALYSIS TABS */}
              {activePage === 'ai-analysis' && (
                <div className="flex items-center gap-2 ml-auto">
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => setAiAnalysisTab('urgent')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        aiAnalysisTab === 'urgent'
                          ? 'bg-rose-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🚨 Urgent Restocks ({page4AiRecommendations.urgent.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiAnalysisTab('longterm')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        aiAnalysisTab === 'longterm'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      📈 Long-Term Recommendations ({page4AiRecommendations.longterm.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiAnalysisTab('profitability')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        aiAnalysisTab === 'profitability'
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      💰 Profit Maximizers ({page4AiRecommendations.profitability.length})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddAllAiRecommendationsToOrder}
                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Add All AI Items</span>
                  </button>
                </div>
              )}
            </div>

            {/* Keyboard Shortcuts Hint Bar */}
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
              <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">↑/↓ Nav</span>
              <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">←/→ Pane</span>
              <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 text-emerald-400">+/- Qty</span>
              <span className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">Enter Input</span>
            </div>
          </div>

          {/* ================================================================= */}
          {/* BODY CONTENT: SWITCHING BETWEEN 4 PAGES                           */}
          {/* ================================================================= */}
          <div className="flex-1 flex overflow-hidden">
            
            {/* --------------------------------------------------------------- */}
            {/* PAGE 1: ALL ITEMS / LIVE STOCK REORDER WITH SUPPLIER TREE       */}
            {/* --------------------------------------------------------------- */}
            {activePage === 'all-items' && (
              <div className="flex-1 flex overflow-hidden">
                {/* Left Supplier Tree Group */}
                <div
                  className={`w-64 border-r border-slate-800 bg-slate-950 flex flex-col shrink-0 ${
                    keyboardFocusArea === 'tree' ? 'ring-1 ring-emerald-500/50' : ''
                  }`}
                >
                  <div className="p-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Suppliers & Groups</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSupplierId(null);
                        setSelectedGroup('All');
                      }}
                      className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                    <button
                      type="button"
                      onClick={() => setSelectedSupplierId(null)}
                      className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        selectedSupplierId === null
                          ? 'bg-emerald-600 text-white font-bold'
                          : 'text-slate-300 hover:bg-slate-850'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <Building2 className="w-3.5 h-3.5 shrink-0" />
                        <span>All Suppliers</span>
                      </span>
                      <span className="text-[10px] font-mono opacity-80">{medicines.length}</span>
                    </button>

                    {treeSuppliers.map((supp, sIdx) => {
                      const count = supplierMedicineCounts.get(supp.SupplierID) || 0;
                      const isSelected = selectedSupplierId === supp.SupplierID;
                      const isFocused = keyboardFocusArea === 'tree' && selectedTreeIndex === sIdx;

                      return (
                        <button
                          key={supp.SupplierID}
                          type="button"
                          onClick={() => {
                            setSelectedSupplierId(supp.SupplierID);
                            setSelectedTreeIndex(sIdx);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-600 text-white font-bold'
                              : isFocused
                              ? 'bg-slate-800 text-white ring-1 ring-emerald-400'
                              : 'text-slate-300 hover:bg-slate-850'
                          }`}
                        >
                          <span className="truncate pr-1">{supp.Name}</span>
                          <span
                            className={`text-[10px] font-mono px-1.5 py-0.2 rounded shrink-0 ${
                              count === 0 ? 'bg-rose-950/60 text-rose-300' : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}

                    {/* Therapeutic Groups Tree Section (Exclusively on Page 1) */}
                    <div className="pt-2.5 mt-2 border-t border-slate-800">
                      <div className="px-1.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3 text-indigo-400" />
                          <span>Medicine Groups</span>
                        </span>
                        {selectedGroup !== 'All' && (
                          <button
                            type="button"
                            onClick={() => setSelectedGroup('All')}
                            className="text-[9px] text-emerald-400 hover:underline cursor-pointer"
                          >
                            All Groups
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedGroup('All')}
                        className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between transition-colors cursor-pointer mt-0.5 ${
                          selectedGroup === 'All'
                            ? 'bg-indigo-600/90 text-white font-bold'
                            : 'text-slate-300 hover:bg-slate-850'
                        }`}
                      >
                        <span className="truncate">All Therapeutic Groups</span>
                        <span className="text-[10px] font-mono opacity-80">{medicines.length}</span>
                      </button>

                      {allMedicineGroups.map((grp) => {
                        const count = medicines.filter((m) => m.Group === grp).length;
                        const isSelected = selectedGroup === grp;
                        return (
                          <button
                            key={grp}
                            type="button"
                            onClick={() => setSelectedGroup(grp)}
                            className={`w-full text-left px-2 py-1 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white font-bold shadow-xs'
                                : 'text-slate-300 hover:bg-slate-850'
                            }`}
                          >
                            <span className="truncate pr-1">{grp}</span>
                            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Medicine Table (Every Row Clickable) */}
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
                  <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold sticky top-0 z-10 border-b border-slate-800 shadow-xs">
                        <tr>
                          <th className="p-2.5 w-8">#</th>
                          <th className="p-2.5">Medicine & Generic</th>
                          <th className="p-2.5">Supplier / Group</th>
                          <th className="p-2.5 text-center">Pack Info</th>
                          <th className="p-2.5 text-right">Counter</th>
                          <th className="p-2.5 text-right">Stores</th>
                          <th className="p-2.5 text-right font-bold text-white">Total Live</th>
                          <th className="p-2.5 text-right">Reorder Level</th>
                          <th className="p-2.5 text-center">Status</th>
                          <th className="p-2.5 text-right">Est. Unit Cost</th>
                          <th className="p-2.5 text-center">Quick Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {page1Items.map((row, idx) => {
                          const isSelected = selectedTableIndex === idx;
                          const inWorking = workingItems.find((i) => i.medicineId === row.medicine.MedicineID);

                          return (
                            <tr
                              key={row.medicine.MedicineID}
                              onClick={() => setSelectedTableIndex(idx)}
                              onDoubleClick={() => handleOpenQuantityModal(row.medicine, row.suggestedPacks, 'pack')}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-emerald-950/50 ring-1 ring-emerald-500'
                                  : inWorking
                                  ? 'bg-emerald-950/20'
                                  : idx % 2 === 0
                                  ? 'bg-slate-900/40 hover:bg-slate-800/60'
                                  : 'bg-slate-900 hover:bg-slate-800/60'
                              }`}
                            >
                              <td className="p-2.5 text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                              <td className="p-2.5">
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{row.medicine.TradeName}</span>
                                  {row.wasPurchased ? (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                      Purchased
                                    </span>
                                  ) : (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60">
                                      Never Purchased
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400">{row.medicine.GenericName}</div>
                              </td>
                              <td className="p-2.5">
                                <div className="text-slate-300 truncate max-w-[150px]">{row.supplier?.Name || 'Principal'}</div>
                                <div className="text-[10px] text-slate-500">{row.medicine.Group || 'General'}</div>
                              </td>
                              <td className="p-2.5 text-center font-mono text-slate-400 text-[11px]">
                                {row.piecesPerPack} pcs/pack
                              </td>
                              <td className="p-2.5 text-right font-mono text-slate-300">{row.stockInfo.counterStock}</td>
                              <td className="p-2.5 text-right font-mono text-slate-400">{row.stockInfo.storeStock}</td>
                              <td className="p-2.5 text-right font-mono font-bold text-white text-sm">
                                {row.stockInfo.totalStock}
                              </td>
                              <td className="p-2.5 text-right font-mono text-amber-400 font-semibold">
                                {row.medicine.ReorderLevel}
                              </td>
                              <td className="p-2.5 text-center">
                                {row.stockInfo.totalStock === 0 ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                    Stockout
                                  </span>
                                ) : row.isUnderReorder ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                    Below Level
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                                    Optimal
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-mono text-slate-200">
                                {formatCurrency(row.unitCost)}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDecrementMedicine(row.medicine.MedicineID);
                                    }}
                                    disabled={!inWorking}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 cursor-pointer"
                                    title="Decrease quantity (- key)"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>

                                  <span className="font-mono font-bold text-emerald-400 text-xs min-w-[20px] text-center">
                                    {inWorking ? inWorking.orderQuantity : 0}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddOrIncrementMedicine(row.medicine, 1, 'pack');
                                    }}
                                    className="p-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer"
                                    title="Add 1 Pack (+ key)"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenQuantityModal(row.medicine, row.suggestedPacks, 'pack');
                                    }}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 ml-1 cursor-pointer"
                                    title="Input custom quantity (Enter / Spacebar)"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {page1Items.length === 0 && (
                          <tr>
                            <td colSpan={11} className="p-8 text-center text-slate-500 font-sans">
                              <Boxes className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                              <p className="text-sm font-semibold text-slate-400">No matching medicines found</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Try adjusting your never-purchased filter or search terms.
                              </p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* --------------------------------------------------------------- */}
            {/* PAGE 2: REGIONAL STORES REORDER                                  */}
            {/* --------------------------------------------------------------- */}
            {activePage === 'stores' && (
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
                {/* Store Header Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-950 border-b border-slate-800 shrink-0">
                  {stores.map((s) => {
                    const storeItems = storeStocks.filter((ss) => ss.StoreID === s.StoreID);
                    const totalUnits = storeItems.reduce((acc, it) => acc + it.Quantity, 0);
                    const totalValuation = storeItems.reduce((acc, it) => acc + it.Quantity * it.CostPrice, 0);

                    return (
                      <div
                        key={s.StoreID}
                        onClick={() => setSelectedStoreId(s.StoreID)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          selectedStoreId === s.StoreID
                            ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white text-xs flex items-center gap-1.5">
                            <Warehouse className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{s.ShortName}</span>
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              s.IsActive
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                            }`}
                          >
                            {s.IsActive ? 'Online' : 'Offline'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 truncate">{s.Name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Manager: {s.BranchManager}</div>
                        <div className="flex items-center justify-between text-xs font-mono pt-2 mt-2 border-t border-slate-800">
                          <span className="text-slate-400">Inventory Units: <strong className="text-white">{totalUnits}</strong></span>
                          <span className="text-emerald-400 font-bold">{formatCurrency(totalValuation)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Store Inventory Items Table */}
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold sticky top-0 z-10 border-b border-slate-800 shadow-xs">
                      <tr>
                        <th className="p-2.5 w-8">#</th>
                        <th className="p-2.5">Regional Store</th>
                        <th className="p-2.5">Medicine & Generic</th>
                        <th className="p-2.5">Batch / Expiry</th>
                        <th className="p-2.5">Rack Location</th>
                        <th className="p-2.5 text-right">Store Balance</th>
                        <th className="p-2.5 text-right">Cost Price</th>
                        <th className="p-2.5 text-right">Store Valuation</th>
                        <th className="p-2.5 text-center">Quick Reorder</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {page2StoreStockRows.map((row, idx) => {
                        const isSelected = selectedTableIndex === idx;
                        const med = row.medicine;
                        const inWorking = med ? workingItems.find((i) => i.medicineId === med.MedicineID) : null;

                        return (
                          <tr
                            key={row.storeStock.StoreStockID}
                            onClick={() => setSelectedTableIndex(idx)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-emerald-950/50 ring-1 ring-emerald-500'
                                : idx % 2 === 0
                                ? 'bg-slate-900/40 hover:bg-slate-800/60'
                                : 'bg-slate-900 hover:bg-slate-800/60'
                            }`}
                          >
                            <td className="p-2.5 text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                                {row.store?.ShortName || 'Store'}
                              </span>
                            </td>
                            <td className="p-2.5">
                              <div className="font-bold text-white">{row.storeStock.TradeName}</div>
                              <div className="text-[10px] text-slate-400">{row.storeStock.GenericName}</div>
                            </td>
                            <td className="p-2.5 font-mono text-slate-300">
                              <div>{row.storeStock.BatchNumber}</div>
                              <div className="text-[10px] text-slate-500">Exp: {row.storeStock.ExpiryDate}</div>
                            </td>
                            <td className="p-2.5 font-mono text-slate-300 text-[11px]">
                              {row.storeStock.RackLocation}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-white text-sm">
                              {row.storeStock.Quantity} pcs
                            </td>
                            <td className="p-2.5 text-right font-mono text-slate-300">
                              {formatCurrency(row.storeStock.CostPrice)}
                            </td>
                            <td className="p-2.5 text-right font-mono text-emerald-400 font-bold">
                              {formatCurrency(row.storeStock.Quantity * row.storeStock.CostPrice)}
                            </td>
                            <td className="p-2.5 text-center">
                              {med ? (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddOrIncrementMedicine(med, 5, 'pack');
                                    }}
                                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Reorder 5 Packs</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-500 text-[10px]">Unlinked</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {page2StoreStockRows.length === 0 && (
                        <tr>
                          <td colSpan={9} className="p-8 text-center text-slate-500 font-sans">
                            <Warehouse className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                            <p className="text-sm font-semibold text-slate-400">No store inventory items found</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --------------------------------------------------------------- */}
            {/* PAGE 3: ON-DEMAND (Sold Today / in Range & Below Reorder Level)  */}
            {/* --------------------------------------------------------------- */}
            {activePage === 'on-demand' && (
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
                <div className="p-3 bg-amber-950/30 border-b border-amber-900/50 flex items-center justify-between text-xs text-amber-300">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>
                      Showing medicines sold in the selected date range that depleted below their safe minimum reorder level.
                    </span>
                  </div>
                  <span className="font-mono font-bold text-white">
                    {page3OnDemandItems.length} items flagged for replenishment
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold sticky top-0 z-10 border-b border-slate-800 shadow-xs">
                      <tr>
                        <th className="p-2.5 w-8">#</th>
                        <th className="p-2.5">Medicine & Generic</th>
                        <th className="p-2.5">Supplier</th>
                        <th className="p-2.5 text-right font-bold text-amber-400">Sold in Period</th>
                        <th className="p-2.5 text-right font-bold text-white">Current Stock</th>
                        <th className="p-2.5 text-right">Reorder Threshold</th>
                        <th className="p-2.5 text-right text-rose-400 font-bold">Depleted Shortfall</th>
                        <th className="p-2.5 text-center">Urgency</th>
                        <th className="p-2.5 text-right">Est. Unit Cost</th>
                        <th className="p-2.5 text-center">Suggested Order</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {page3OnDemandItems.map((row, idx) => {
                        const isSelected = selectedTableIndex === idx;
                        const inWorking = workingItems.find((i) => i.medicineId === row.medicine.MedicineID);

                        return (
                          <tr
                            key={row.medicine.MedicineID}
                            onClick={() => setSelectedTableIndex(idx)}
                            onDoubleClick={() => handleOpenQuantityModal(row.medicine, row.suggestedPacks, 'pack')}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-amber-950/50 ring-1 ring-amber-500'
                                : inWorking
                                ? 'bg-emerald-950/30'
                                : idx % 2 === 0
                                ? 'bg-slate-900/40 hover:bg-slate-800/60'
                                : 'bg-slate-900 hover:bg-slate-800/60'
                            }`}
                          >
                            <td className="p-2.5 text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                            <td className="p-2.5">
                              <div className="font-bold text-white">{row.medicine.TradeName}</div>
                              <div className="text-[10px] text-slate-400">{row.medicine.GenericName}</div>
                            </td>
                            <td className="p-2.5 text-slate-300 truncate max-w-[150px]">
                              {row.supplier?.Name || 'Principal'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-amber-400 text-sm">
                              {row.unitsSold} pcs
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-white text-sm">
                              {row.totalStock} pcs
                            </td>
                            <td className="p-2.5 text-right font-mono text-slate-400">
                              {row.reorderLevel} pcs
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-rose-400">
                              -{row.shortfall} pcs
                            </td>
                            <td className="p-2.5 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  row.urgency === 'Urgent'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                    : 'bg-amber-950 text-amber-300 border border-amber-800'
                                }`}
                              >
                                {row.urgency}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-mono text-slate-200">
                              {formatCurrency(row.unitCost)}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-emerald-400">
                              +{row.suggestedPacks} packs
                            </td>
                            <td className="p-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddOrIncrementMedicine(row.medicine, row.suggestedPacks, 'pack', row.urgency);
                                  }}
                                  className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Add {row.suggestedPacks} Packs</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}

                      {page3OnDemandItems.length === 0 && (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-slate-500 font-sans">
                            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                            <p className="text-sm font-semibold text-slate-300">All fast movers are safely stocked!</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              No medicines sold in this period have fallen below their reorder levels.
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --------------------------------------------------------------- */}
            {/* PAGE 4: LLAMA AI INVENTORY ANALYSIS                              */}
            {/* --------------------------------------------------------------- */}
            {activePage === 'ai-analysis' && (
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
                {/* AI Status Banner */}
                <div className="p-3 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-indigo-800/50 flex items-center justify-between text-xs text-indigo-200">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-indigo-600/30 border border-indigo-500/50 text-indigo-300">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white text-sm">
                        Llama 3 AI Intellectual Inventory Analytics Engine
                      </span>
                      <p className="text-[11px] text-indigo-300/80">
                        Analyzing burn velocity, gross margin spread, and bulk procurement tiers to maximize business profitability.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-600/50 font-bold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Llama 3 AI Online
                    </span>
                  </div>
                </div>

                {/* AI Recommendations Table */}
                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold sticky top-0 z-10 border-b border-slate-800 shadow-xs">
                      <tr>
                        <th className="p-2.5 w-8">#</th>
                        <th className="p-2.5">Medicine & Generic</th>
                        <th className="p-2.5">Supplier</th>
                        <th className="p-2.5 text-right font-bold text-white">Live Stock</th>
                        <th className="p-2.5 text-right font-bold text-emerald-400">Gross Margin</th>
                        <th className="p-2.5">Llama 3 Intelligent Reasoning</th>
                        <th className="p-2.5 text-center font-bold text-indigo-300">AI Suggested Order</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      {page4AiRecommendations[aiAnalysisTab].map((row: any, idx: number) => {
                        const isSelected = selectedTableIndex === idx;
                        const inWorking = workingItems.find((i) => i.medicineId === row.medicine.MedicineID);

                        return (
                          <tr
                            key={row.medicine.MedicineID}
                            onClick={() => setSelectedTableIndex(idx)}
                            onDoubleClick={() => handleOpenQuantityModal(row.medicine, row.suggestedPacks, 'pack')}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-indigo-950/60 ring-1 ring-indigo-500'
                                : inWorking
                                ? 'bg-emerald-950/30'
                                : idx % 2 === 0
                                ? 'bg-slate-900/40 hover:bg-slate-800/60'
                                : 'bg-slate-900 hover:bg-slate-800/60'
                            }`}
                          >
                            <td className="p-2.5 text-slate-500 font-mono text-[10px]">{idx + 1}</td>
                            <td className="p-2.5">
                              <div className="font-bold text-white">{row.medicine.TradeName}</div>
                              <div className="text-[10px] text-slate-400">{row.medicine.GenericName}</div>
                            </td>
                            <td className="p-2.5 text-slate-300 truncate max-w-[140px]">
                              {row.supplier?.Name || 'Principal'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-white text-sm">
                              {row.stockInfo.totalStock} pcs
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-emerald-400 text-sm">
                              {row.margin}%
                            </td>
                            <td className="p-2.5 text-slate-300 font-sans max-w-xs text-xs">
                              {row.reason}
                            </td>
                            <td className="p-2.5 text-center font-mono font-bold text-indigo-300 text-sm">
                              +{row.suggestedPacks} packs
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddOrIncrementMedicine(row.medicine, row.suggestedPacks, 'pack', 'Urgent');
                                }}
                                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Add {row.suggestedPacks} Packs</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {page4AiRecommendations[aiAnalysisTab].length === 0 && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 font-sans">
                            <Sparkles className="w-8 h-8 mx-auto text-indigo-400 mb-2" />
                            <p className="text-sm font-semibold text-slate-300">No suggestions in this category</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT PANE: ACTIVE ORDER SHEET (WORKING ORDER LIST TRAY)            */}
        {/* =================================================================== */}
        {isOrderTrayMinimized ? (
          <div
            onClick={() => setIsOrderTrayMinimized(false)}
            className="w-12 bg-slate-950 border-l border-slate-800 flex flex-col items-center py-3 select-none hover:bg-slate-900 cursor-pointer transition-all shrink-0 justify-between group"
            title="Click to expand Order List (or use header button)"
          >
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOrderTrayMinimized(false);
                }}
                className="p-1.5 rounded-lg bg-slate-800 group-hover:bg-emerald-600 text-slate-300 group-hover:text-white transition-all cursor-pointer shadow-xs"
                title="Expand Order List"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  workingItems.length > 0
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {workingItems.length}
              </span>
            </div>

            {/* Vertical text */}
            <div
              className="text-[11px] font-bold tracking-wider uppercase text-slate-400 group-hover:text-emerald-400 transition-colors whitespace-nowrap"
              style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
            >
              Order Sheet ({workingAggregates.totalUnits} Units)
            </div>

            <div className="flex flex-col items-center gap-2">
              <div className="text-[10px] font-mono font-bold text-emerald-400 text-center leading-tight">
                {currencySymbol}
                {Math.round(workingAggregates.totalCost)}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrintInkOrder({
                    id: workingListId,
                    title: workingListTitle,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdBy: currentUser?.FullName || 'Admin',
                    createdByRole: currentUser?.Role || 'Admin',
                    status: 'Draft',
                    items: workingItems,
                    totalEstimatedCost: workingAggregates.totalCost,
                    totalItemsCount: workingAggregates.totalItems,
                    totalUnitsCount: workingAggregates.totalUnits,
                  });
                }}
                disabled={workingItems.length === 0}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
                title="Quick Print"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="w-80 md:w-96 bg-slate-950 border-l border-slate-800 flex flex-col shrink-0">
            {/* Header */}
            <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <div>
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <span>Working Order Sheet</span>
                    {isEditingExistingList && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-950 text-amber-300 border border-amber-700">
                        Editing
                      </span>
                    )}
                  </h2>
                  <div className="text-[10px] text-slate-400">
                    Order ID: <strong className="text-white font-mono">{workingListId}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsOrderTrayMinimized(true)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Minimize Order List (expands table view)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleClearWorkingSheet}
                  disabled={workingItems.length === 0}
                  className="text-[11px] text-slate-400 hover:text-rose-400 disabled:opacity-30 transition-colors cursor-pointer ml-1"
                >
                  Clear
                </button>
              </div>
            </div>

          {/* Title & Creator Info */}
          <div className="p-3 border-b border-slate-800/80 bg-slate-950/80 space-y-2 text-xs">
            <div>
              <label className="text-[10px] text-slate-400 font-semibold uppercase block mb-1">
                Order Sheet Title:
              </label>
              <input
                type="text"
                value={workingListTitle}
                onChange={(e) => setWorkingListTitle(e.target.value)}
                placeholder="e.g. Weekly Restock Sheet"
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Created by:</span>
              </span>
              <strong className="text-emerald-300 font-medium">
                {currentUser?.FullName || 'Pharmacist / Admin'}
              </strong>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Target Ink Paper Size:</span>
              <span className="font-mono font-bold text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                {reorderSettings.paperSize}
              </span>
            </div>
          </div>

          {/* Working Items Scrollable List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 select-none">
            {workingItems.map((item) => (
              <div
                key={item.medicineId}
                className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 space-y-1.5 text-xs transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate">{item.tradeName}</div>
                    <div className="text-[10px] text-slate-400 truncate">{item.genericName}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(item.medicineId)}
                    className="text-slate-500 hover:text-rose-400 p-0.5"
                    title="Remove item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>Stock: {item.currentStock} pcs</span>
                  <span>Cost: {formatCurrency(item.unitCost)}</span>
                </div>

                {/* Quantity Controls (+/- buttons) */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDecrementMedicine(item.medicineId)}
                      className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center font-bold cursor-pointer"
                      title="Decrease (- key)"
                    >
                      -
                    </button>
                    <span className="font-mono font-bold text-white text-xs px-2">
                      {item.orderQuantity} {item.unitType}(s)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const med = medicines.find((m) => m.MedicineID === item.medicineId);
                        if (med) handleAddOrIncrementMedicine(med, 1, item.unitType);
                      }}
                      className="w-6 h-6 rounded bg-emerald-700 hover:bg-emerald-600 text-white flex items-center justify-center font-bold cursor-pointer"
                      title="Increase (+ key)"
                    >
                      +
                    </button>
                  </div>

                  <div className="font-mono font-bold text-emerald-400 text-xs">
                    {formatCurrency(item.estimatedTotalCost)}
                  </div>
                </div>
              </div>
            ))}

            {workingItems.length === 0 && (
              <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-slate-500 text-xs p-6 text-center space-y-2">
                <ClipboardList className="w-8 h-8 text-slate-600" />
                <p className="font-semibold text-slate-400">Order sheet is empty</p>
                <p className="text-[11px] text-slate-500">
                  Click rows or press + key on any page to add items into this order sheet.
                </p>
              </div>
            )}
          </div>

          {/* Footer Aggregates & Actions */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2.5">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Total Items:</span>
                <span className="text-white font-bold">{workingAggregates.totalItems} line(s)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Total Units / Packs:</span>
                <span className="text-white font-bold">{workingAggregates.totalUnits}</span>
              </div>
              <div className="flex justify-between items-center text-sm pt-1 border-t border-slate-800">
                <span className="font-bold text-white">Estimated Cost:</span>
                <span className="font-mono font-bold text-emerald-400 text-base">
                  {formatCurrency(workingAggregates.totalCost)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSaveWorkingList('Finalized')}
                disabled={workingItems.length === 0}
                className="py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save Order List</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const currentList: ReorderList = {
                    id: workingListId,
                    title: workingListTitle.trim() || `Reorder Sheet #${workingListId}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    createdBy: currentUser?.FullName || 'Pharmacist / Admin',
                    createdByRole: currentUser?.Role || 'Admin',
                    status: 'Finalized',
                    notes: workingListNotes.trim(),
                    items: workingItems,
                    totalEstimatedCost: workingAggregates.totalCost,
                    totalItemsCount: workingAggregates.totalItems,
                    totalUnitsCount: workingAggregates.totalUnits,
                  };
                  handlePrintInkOrder(currentList);
                }}
                disabled={workingItems.length === 0}
                className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 border border-slate-700 transition-all cursor-pointer"
                title="Print on Ink Printer with adjustable paper size (A4/Letter/Legal/A5)"
              >
                <Printer className="w-4 h-4 text-emerald-400" />
                <span>Print & Export</span>
              </button>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* MODAL 1: QUANTITY INPUT CHILD WINDOW (TRIGGERED BY ENTER / SPACEBAR)   */}
      {/* ===================================================================== */}
      {isQuantityModalOpen && quantityModalItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-xl shadow-2xl max-w-sm w-full p-4 space-y-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Input Reorder Quantity</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuantityModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1 text-xs">
              <div className="font-bold text-white text-sm">{quantityModalItem.medicine.TradeName}</div>
              <div className="text-slate-400">{quantityModalItem.medicine.GenericName}</div>
              <div className="flex justify-between text-slate-400 pt-1 font-mono text-[11px]">
                <span>Current Stock: {quantityModalItem.currentStock} pcs</span>
                <span>Reorder Level: {quantityModalItem.medicine.ReorderLevel} pcs</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Quantity to Order:</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  autoFocus
                  value={modalInputQty}
                  onChange={(e) => setModalInputQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyModalQuantity();
                    }
                  }}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono font-bold text-base outline-none focus:border-emerald-500"
                />

                <select
                  value={modalInputUnit}
                  onChange={(e) => setModalInputUnit(e.target.value as 'pack' | 'piece')}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500 font-semibold"
                >
                  <option value="pack">Pack(s)</option>
                  <option value="piece">Piece(s)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsQuantityModalOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyModalQuantity}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                Apply to Order Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: INK PRINTER SHEET PREVIEW & PDF EXPORT MODAL                 */}
      {/* ===================================================================== */}
      {printPreviewList && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 print-container-active">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Printer className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-white text-sm flex items-center gap-2">
                    <span>Ink Printer Order Sheet: {printPreviewList.title}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                      Paper Size: {reorderSettings.paperSize}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Created by: <strong className="text-white">{printPreviewList.createdBy}</strong> • Ready for HP/Canon/Epson Inkjet & LaserJet
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* 4-Col vs 8-Col Layout Toggle */}
                <div className="flex items-center bg-slate-900 border border-slate-700 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setPrintLayoutMode('4col')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      printLayoutMode === '4col'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="4 Columns (SL, Medicine Name, Unit/Type, Quantity) — Best for Custom Paper & Maximum Rows"
                  >
                    4-Col (Max Rows)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintLayoutMode('8col')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      printLayoutMode === '8col'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="8 Columns Detailed (Includes Supplier, Stock, Unit Cost, Total Cost)"
                  >
                    8-Col Detailed
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => executeDownloadPdfDocument(printPreviewList)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                  title={`Download PDF document (Configured path: ${reorderSettings.pdfDownloadDirectory})`}
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={executeNativePrint}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  title="Send to physical Inkjet or LaserJet Printer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPrintPreviewList(null)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 ml-2 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Paper Area (Styled like real high-contrast white paper) */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-950 flex justify-center">
              {(() => {
                const isCustom = reorderSettings.paperSize === 'Custom';
                const customW = reorderSettings.customPaperWidth || 3.8;
                const customH = reorderSettings.customPaperHeight || 9.0;
                const customUnit = reorderSettings.customPaperUnit || 'in';
                const isNarrow = isCustom ? (customUnit === 'in' ? customW <= 4.5 : customW <= 115) : false;
                const is4Col = isCustom || printLayoutMode === '4col';
                const totalUnits = printPreviewList.totalUnitsCount || printPreviewList.items.reduce((s, it) => s + it.orderQuantity, 0);

                return (
                  <div
                    id="printable-ink-order"
                    className={`bg-white text-slate-900 shadow-xl rounded font-sans transition-all space-y-3 ${
                      isNarrow ? 'p-3 sm:p-4 text-[10.5px]' : 'p-6 text-xs'
                    } ${
                      !isCustom && reorderSettings.paperSize === 'A5'
                        ? 'w-full max-w-xl'
                        : !isCustom
                        ? 'w-full max-w-3xl'
                        : 'w-full'
                    }`}
                    style={{
                      width: isCustom ? `${customW}${customUnit}` : undefined,
                      maxWidth: isCustom ? `${customW}${customUnit}` : undefined,
                      minHeight:
                        reorderSettings.paperSize === 'A4'
                          ? '297mm'
                          : isCustom
                          ? `${customH}${customUnit}`
                          : 'auto',
                    }}
                  >
                    {/* Pharmacy Header */}
                    <div className="border-b-2 border-slate-900 pb-2 flex justify-between items-start">
                      <div>
                        <h1 className={`${isNarrow ? 'text-base' : 'text-xl'} font-bold tracking-tight text-slate-950`}>
                          PharmaCore Pharmacy
                        </h1>
                        <p className="text-[10px] text-slate-600">Official Purchase Order & Restock Requisition</p>
                        <p className="text-[9px] text-slate-500">Regional Store & Dispensary Procurement Division</p>
                      </div>
                      <div className="text-right space-y-0.5 font-mono text-[10px]">
                        <div>Order No: <strong className="text-slate-950">{printPreviewList.id}</strong></div>
                        <div>Date: <strong className="text-slate-950">{new Date(printPreviewList.createdAt).toLocaleDateString()}</strong></div>
                        <div>
                          Paper: <span className="font-bold text-emerald-800">
                            {isCustom
                              ? `Custom (${customW} ${customUnit} × ${customH} ${customUnit})`
                              : reorderSettings.paperSize}{' '}
                            ({reorderSettings.printOrientation})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Audit & Creator Meta */}
                    <div className="bg-slate-100 p-2 rounded border border-slate-300 flex justify-between text-[10px] flex-wrap gap-2">
                      <div>
                        <span className="text-slate-500 uppercase text-[9px] block font-semibold">Prepared By:</span>
                        <strong className="text-slate-900">{printPreviewList.createdBy}</strong> ({printPreviewList.createdByRole})
                      </div>
                      <div>
                        <span className="text-slate-500 uppercase text-[9px] block font-semibold">Title:</span>
                        <strong className="text-slate-900">{printPreviewList.title}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 uppercase text-[9px] block font-semibold">Volume:</span>
                        <strong className="text-slate-900">{printPreviewList.items.length} Lines • {totalUnits} Units</strong>
                      </div>
                    </div>

                    {/* Items Table */}
                    {is4Col ? (
                      /* 4-COLUMN ULTRA-COMPACT TABLE (SL, MEDICINE NAME, UNIT/TYPE, QUANTITY) */
                      <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                        <thead className="bg-slate-200 text-slate-800 text-[9.5px] uppercase font-bold border-b border-slate-300">
                          <tr>
                            <th className="p-1.5 border border-slate-300 w-7 text-center">SL</th>
                            <th className="p-1.5 border border-slate-300">Medicine Name</th>
                            <th className="p-1.5 border border-slate-300 text-center w-24">Unit / Type</th>
                            <th className="p-1.5 border border-slate-300 text-right w-20">Quantity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {printPreviewList.items.map((item, i) => {
                            const dosageType = detectDosageType(item.tradeName, item.genericName, item.group, item.unitType);
                            return (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="p-1 border border-slate-300 text-slate-600 text-center font-mono font-bold text-[9.5px]">
                                  {i + 1}
                                </td>
                                <td className="p-1 border border-slate-300">
                                  <div className="font-bold text-slate-900 text-[10.5px] leading-tight">{item.tradeName}</div>
                                  <div className="text-[8.5px] text-slate-500 leading-tight">{item.genericName}</div>
                                </td>
                                <td className="p-1 border border-slate-300 text-center">
                                  <span className="px-1 py-0.2 rounded text-[8.5px] font-bold bg-slate-100 text-slate-800 uppercase tracking-wider">
                                    {dosageType}
                                  </span>
                                </td>
                                <td className="p-1 border border-slate-300 text-right font-bold text-emerald-800 font-mono text-[10.5px] bg-emerald-50/40">
                                  {item.orderQuantity} {item.unitType === 'pack' ? 'Pck' : 'Pcs'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-bold font-mono text-slate-900">
                            <td colSpan={3} className="p-1.5 border border-slate-300 text-right text-[10px] uppercase">
                              Total Lines: {printPreviewList.items.length} | Units: {totalUnits} | Grand Total:
                            </td>
                            <td className="p-1.5 border border-slate-300 text-right text-[11px] text-emerald-800">
                              {formatCurrency(printPreviewList.totalEstimatedCost)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      /* 8-COLUMN DETAILED TABLE */
                      <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                        <thead className="bg-slate-200 text-slate-800 text-[10px] uppercase font-bold border-b border-slate-300">
                          <tr>
                            <th className="p-1.5 border border-slate-300 w-8">#</th>
                            <th className="p-1.5 border border-slate-300">Medicine Trade Name</th>
                            <th className="p-1.5 border border-slate-300">Generic Formula</th>
                            <th className="p-1.5 border border-slate-300">Supplier Name</th>
                            <th className="p-1.5 border border-slate-300 text-right">Stock</th>
                            <th className="p-1.5 border border-slate-300 text-center">Order Qty</th>
                            <th className="p-1.5 border border-slate-300 text-right">Est. Unit Cost</th>
                            <th className="p-1.5 border border-slate-300 text-right font-bold">Total Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-mono">
                          {printPreviewList.items.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="p-1.5 border border-slate-300 text-slate-500 text-center">{i + 1}</td>
                              <td className="p-1.5 border border-slate-300 font-sans font-bold text-slate-900">{item.tradeName}</td>
                              <td className="p-1.5 border border-slate-300 text-slate-600 font-sans text-[11px]">{item.genericName}</td>
                              <td className="p-1.5 border border-slate-300 text-slate-700 font-sans truncate max-w-[140px]">{item.supplierName}</td>
                              <td className="p-1.5 border border-slate-300 text-right text-slate-600">{item.currentStock}</td>
                              <td className="p-1.5 border border-slate-300 text-center font-bold text-slate-900 bg-slate-50">
                                {item.orderQuantity} {item.unitType}(s)
                              </td>
                              <td className="p-1.5 border border-slate-300 text-right text-slate-700">{formatCurrency(item.unitCost)}</td>
                              <td className="p-1.5 border border-slate-300 text-right font-bold text-slate-900">{formatCurrency(item.estimatedTotalCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-slate-100 font-bold font-mono text-slate-900">
                            <td colSpan={7} className="p-2 border border-slate-300 text-right text-xs uppercase">
                              Estimated Grand Total:
                            </td>
                            <td className="p-2 border border-slate-300 text-right text-sm text-emerald-800">
                              {formatCurrency(printPreviewList.totalEstimatedCost)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    )}

                    {/* Sign-off Signatures */}
                    <div className="pt-4 grid grid-cols-3 gap-4 text-center text-xs text-slate-700">
                      <div className="border-t border-slate-400 pt-1">
                        <span className="font-semibold block text-[10px]">{printPreviewList.createdBy}</span>
                        <span className="text-[9px] text-slate-500">Prepared By (Creator)</span>
                      </div>
                      <div className="border-t border-slate-400 pt-1">
                        <span className="font-semibold block text-[10px]">Chief Pharmacist</span>
                        <span className="text-[9px] text-slate-500">Verified & Approved</span>
                      </div>
                      <div className="border-t border-slate-400 pt-1">
                        <span className="font-semibold block text-[10px]">Supplier Rep</span>
                        <span className="text-[9px] text-slate-500">Received & Acknowledged</span>
                      </div>
                    </div>

                    <div className="text-[9px] text-slate-400 text-center pt-2">
                      PharmaCore ERP System • Generated for Inkjet/LaserJet printing ({reorderSettings.paperSize}) • Complete Accountability Audit Trail
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: REORDER SETTINGS MODAL (PAPER SIZE & DOWNLOAD DIRECTORY)     */}
      {/* ===================================================================== */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-white text-sm">Reorder System Settings</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Paper Size */}
              <div>
                <label className="font-bold text-slate-200 block mb-1">
                  Ink Printer Paper Size:
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Select standard paper size or define a custom paper dimension (e.g. 3.8" × 9") for your printer.
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['A4', 'Letter', 'Legal', 'A5', 'Custom'] as ReorderPaperSize[]).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => updateReorderSettings({ paperSize: size })}
                      className={`py-2 rounded-lg font-mono font-bold text-xs border text-center transition-all cursor-pointer ${
                        reorderSettings.paperSize === size
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                          : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>

                {/* Custom Dimensions Form when Custom is selected */}
                {reorderSettings.paperSize === 'Custom' && (
                  <div className="mt-3 p-3 bg-slate-950/80 rounded-xl border border-emerald-600/50 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5" />
                        <span>Custom Paper Dimensions:</span>
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {reorderSettings.customPaperWidth || 3.8} × {reorderSettings.customPaperHeight || 9.0} {reorderSettings.customPaperUnit || 'in'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Width:</label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="20"
                          value={reorderSettings.customPaperWidth ?? 3.8}
                          onChange={(e) => updateReorderSettings({ customPaperWidth: parseFloat(e.target.value) || 3.8 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Height / Length:</label>
                        <input
                          type="number"
                          step="0.1"
                          min="1"
                          max="50"
                          value={reorderSettings.customPaperHeight ?? 9.0}
                          onChange={(e) => updateReorderSettings({ customPaperHeight: parseFloat(e.target.value) || 9.0 })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-emerald-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Unit:</label>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => updateReorderSettings({ customPaperUnit: 'in' })}
                            className={`py-1.5 text-xs font-mono font-bold rounded-lg border cursor-pointer ${
                              (reorderSettings.customPaperUnit || 'in') === 'in'
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            in
                          </button>
                          <button
                            type="button"
                            onClick={() => updateReorderSettings({ customPaperUnit: 'mm' })}
                            className={`py-1.5 text-xs font-mono font-bold rounded-lg border cursor-pointer ${
                              reorderSettings.customPaperUnit === 'mm'
                                ? 'bg-emerald-600 text-white border-emerald-500'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            mm
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Quick Presets */}
                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">Quick Custom Presets:</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateReorderSettings({ customPaperWidth: 3.8, customPaperHeight: 9.0, customPaperUnit: 'in' })}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-emerald-300 border border-emerald-700/60 text-[10px] font-mono cursor-pointer"
                        >
                          3.8" × 9.0" (Voucher / Slip) ★
                        </button>
                        <button
                          type="button"
                          onClick={() => updateReorderSettings({ customPaperWidth: 4.0, customPaperHeight: 6.0, customPaperUnit: 'in' })}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono cursor-pointer"
                        >
                          4" × 6" (Postcard)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateReorderSettings({ customPaperWidth: 8.5, customPaperHeight: 5.5, customPaperUnit: 'in' })}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono cursor-pointer"
                        >
                          8.5" × 5.5" (Statement)
                        </button>
                        <button
                          type="button"
                          onClick={() => updateReorderSettings({ customPaperWidth: 80, customPaperHeight: 200, customPaperUnit: 'mm' })}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono cursor-pointer"
                        >
                          80 × 200 mm (Roll)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Custom Download Directory Path */}
              <div>
                <label className="font-bold text-slate-200 block mb-1">
                  Custom PDF Download Directory Path:
                </label>
                <p className="text-[11px] text-slate-400 mb-1.5">
                  Set the directory where generated order list PDFs are stored on the desktop system.
                </p>
                <input
                  type="text"
                  value={reorderSettings.pdfDownloadDirectory}
                  onChange={(e) => updateReorderSettings({ pdfDownloadDirectory: e.target.value })}
                  placeholder="e.g. C:\PharmaCore\Reorders\PDFs"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-emerald-500"
                />
              </div>

              {/* Orientation */}
              <div>
                <label className="font-bold text-slate-200 block mb-1">
                  Print Page Orientation:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateReorderSettings({ printOrientation: 'portrait' })}
                    className={`py-2 rounded-lg font-semibold text-xs border text-center transition-all cursor-pointer ${
                      reorderSettings.printOrientation === 'portrait'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    Portrait (Standard)
                  </button>
                  <button
                    type="button"
                    onClick={() => updateReorderSettings({ printOrientation: 'landscape' })}
                    className={`py-2 rounded-lg font-semibold text-xs border text-center transition-all cursor-pointer ${
                      reorderSettings.printOrientation === 'landscape'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-slate-950 text-slate-300 border-slate-800'
                    }`}
                  >
                    Landscape (Wide Table)
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg shadow-sm cursor-pointer"
              >
                Close & Save Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DRAWER: SAVED ORDER LISTS ARCHIVE & MANAGEMENT (POST-CREATION EDIT)    */}
      {/* ===================================================================== */}
      {showSavedOrdersDrawer && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border-l border-slate-800 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-white text-sm">Saved Order Lists Archive</h3>
                  <p className="text-xs text-slate-400">Post-creation editing, printing, and creator audit trails</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedOrdersDrawer(false)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {reorderLists.map((order) => (
                <div
                  key={order.id}
                  className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 space-y-2 text-xs transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-white text-sm">{order.title}</h4>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Created by: <strong className="text-white">{order.createdBy}</strong></span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                      {order.id}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono bg-slate-900 p-2 rounded">
                    <span>Items: <strong className="text-white">{order.totalItemsCount || order.items.length}</strong></span>
                    <span>Units: <strong className="text-white">{order.totalUnitsCount || 0}</strong></span>
                    <span className="text-emerald-400 font-bold">{formatCurrency(order.totalEstimatedCost)}</span>
                  </div>

                  <div className="text-[10px] text-slate-500">
                    Saved on {new Date(order.createdAt).toLocaleString()}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedOrder(order.id, order.title)}
                      className="px-2.5 py-1 rounded bg-rose-950/70 hover:bg-rose-900 text-rose-300 text-xs font-semibold border border-rose-800/60 flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleResumeSavedOrder(order)}
                        className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-slate-700 flex items-center gap-1 cursor-pointer"
                        title="Resume editing this order list with Up/Down and +/- keys"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit Order</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handlePrintInkOrder(order)}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Printer className="w-3 h-3" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {reorderLists.length === 0 && (
                <div className="p-8 text-center text-slate-500">
                  <FileText className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-400 text-sm">No saved order lists</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Create an order sheet and click 'Save Order List' to store records here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// HELPER: DETECT DOSAGE FORM & UNIT/TYPE (TABLET, CAPSULE, INJECTION, ETC.)
// ============================================================================
export function detectDosageType(
  tradeName: string = '',
  genericName: string = '',
  group: string = '',
  unitType: string = ''
): string {
  const combined = `${tradeName} ${genericName} ${group} ${unitType}`.toLowerCase();

  if (/\b(inj|injection|vial|ampoule|amp|infusion|saline)\b/i.test(combined)) return 'Injection';
  if (/\b(cap|capsule|caps)\b/i.test(combined)) return 'Capsule';
  if (/\b(tab|tablet|tablets)\b/i.test(combined)) return 'Tablet';
  if (/\b(syp|syrup)\b/i.test(combined)) return 'Syrup';
  if (/\b(susp|suspension)\b/i.test(combined)) return 'Suspension';
  if (/\b(drop|drops|eye drop|ear drop)\b/i.test(combined)) return 'Drops';
  if (/\b(oint|ointment|cream|gel)\b/i.test(combined)) return 'Ointment';
  if (/\b(inhaler|resp|rotacap|nebul|inhalation)\b/i.test(combined)) return 'Inhaler';
  if (/\b(sachet|powder)\b/i.test(combined)) return 'Sachet';
  if (/\b(spray|nasal spray)\b/i.test(combined)) return 'Spray';
  if (/\b(supp|suppository)\b/i.test(combined)) return 'Suppository';
  if (/\b(lotion|wash)\b/i.test(combined)) return 'Lotion';

  // Fallback to unit classification
  const normalizedUnit = (unitType || '').toLowerCase();
  if (normalizedUnit.includes('vial') || normalizedUnit.includes('amp')) return 'Injection';
  if (normalizedUnit.includes('strip')) return 'Tablet';
  if (normalizedUnit.includes('bottle')) return 'Bottle';
  if (normalizedUnit.includes('box')) return 'Box';
  if (unitType) return unitType.charAt(0).toUpperCase() + unitType.slice(1).toLowerCase();

  return 'Tablet';
}

// ============================================================================
// HELPER: GENERATE CLEAN HIGH-CONTRAST HTML DOCUMENT FOR INK PRINTERS / PDF
// Arranged for custom and standard paper sizes with maximum row density.
// ============================================================================
function generateOrderPrintableHtml(
  order: ReorderList,
  settings: ReorderSettings,
  currentUserFullName?: string,
  force4Column: boolean = false
): string {
  const isCustom = settings.paperSize === 'Custom';
  const customW = settings.customPaperWidth || 3.8;
  const customH = settings.customPaperHeight || 9.0;
  const customUnit = settings.customPaperUnit || 'in';
  const orientation = settings.printOrientation || 'portrait';
  const is4Col = isCustom || force4Column;

  const paperSizeRule = isCustom
    ? `size: ${customW}${customUnit} ${customH}${customUnit} ${orientation};`
    : settings.paperSize === 'A4'
    ? `size: A4 ${orientation};`
    : settings.paperSize === 'Letter'
    ? `size: letter ${orientation};`
    : settings.paperSize === 'Legal'
    ? `size: legal ${orientation};`
    : `size: A5 ${orientation};`;

  const isNarrow = isCustom ? (customUnit === 'in' ? customW <= 4.5 : customW <= 115) : false;
  // Maximum row arrangement margins: 3.5mm on narrow custom slips, 6mm on standard pages
  const pageMargin = isNarrow ? '3.5mm 4mm' : is4Col ? '6mm 8mm' : '8mm 10mm';
  const bodyPadding = isNarrow ? '4px 2px' : '10px';
  const fontSize = isNarrow ? '9.5px' : is4Col ? '10.5px' : '11px';
  const paperFormatLabel = isCustom
    ? `Custom ${customW} ${customUnit} × ${customH} ${customUnit}`
    : settings.paperSize;

  const totalUnits = order.totalUnitsCount || order.items.reduce((acc, it) => acc + it.orderQuantity, 0);

  // Rows generation depending on 4-Col (Maximum rows) vs 8-Col Detailed
  const rows = is4Col
    ? order.items
        .map((item, idx) => {
          const dosageType = detectDosageType(item.tradeName, item.genericName, item.group, item.unitType);
          const qtyText = `${item.orderQuantity} ${item.unitType === 'pack' ? 'Pck' : 'Pcs'}`;
          return `
      <tr style="page-break-inside: avoid; break-inside: avoid;">
        <td style="padding: 2.5px 3px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-family: monospace; font-size: ${isNarrow ? '9px' : '10px'}; width: 22px; color: #475569;">${idx + 1}</td>
        <td style="padding: 2.5px 4px; border: 1px solid #cbd5e1; line-height: 1.15;">
          <strong style="display: block; font-size: ${isNarrow ? '9.5px' : '11px'}; color: #090d16; font-weight: 700;">${item.tradeName}</strong>
          <span style="color: #64748b; font-size: ${isNarrow ? '8px' : '9px'}; display: block;">${item.genericName}</span>
        </td>
        <td style="padding: 2.5px 3px; border: 1px solid #cbd5e1; text-align: center; width: ${isNarrow ? '55px' : '75px'};">
          <span style="display: inline-block; padding: 1px 4px; background: #f1f5f9; border-radius: 3px; font-size: ${isNarrow ? '8px' : '9px'}; font-weight: 700; text-transform: uppercase; color: #1e293b; letter-spacing: 0.3px;">
            ${dosageType}
          </span>
        </td>
        <td style="padding: 2.5px 4px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; font-family: monospace; font-size: ${isNarrow ? '9.5px' : '11px'}; width: ${isNarrow ? '45px' : '65px'}; background: #f8fafc; color: #065f46;">
          ${qtyText}
        </td>
      </tr>`;
        })
        .join('')
    : order.items
        .map((item, idx) => `
      <tr style="page-break-inside: avoid; break-inside: avoid;">
        <td style="padding: 4px 3px; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">${idx + 1}</td>
        <td style="padding: 4px 6px; border: 1px solid #cbd5e1;">
          <strong style="display: block; font-size: 11px; color: #0f172a;">${item.tradeName}</strong>
          <span style="color: #64748b; font-size: 9.5px; display: block;">${item.genericName}</span>
        </td>
        <td style="padding: 4px 6px; border: 1px solid #cbd5e1; font-size: 10px; color: #334155;">${item.supplierName}</td>
        <td style="padding: 4px 5px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${item.currentStock}</td>
        <td style="padding: 4px 5px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; background: #f8fafc; font-family: monospace;">${item.orderQuantity} ${item.unitType}(s)</td>
        <td style="padding: 4px 5px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace;">${item.unitCost.toFixed(2)}</td>
        <td style="padding: 4px 6px; border: 1px solid #cbd5e1; text-align: right; font-weight: bold; font-family: monospace; color: #047857;">${item.estimatedTotalCost.toFixed(2)}</td>
      </tr>`
        )
        .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Reorder_${order.id}_${settings.paperSize}${is4Col ? '_4Col_MaxRows' : ''}</title>
  <style>
    @page {
      ${paperSizeRule}
      margin: ${pageMargin};
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: ${bodyPadding};
      font-size: ${fontSize};
      line-height: 1.2;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: ${isNarrow ? '9px' : '10.5px'};
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th {
      background: #e2e8f0 !important;
      border: 1px solid #cbd5e1;
      padding: ${isNarrow ? '3px 2px' : '5px 4px'};
      text-transform: uppercase;
      font-size: ${isNarrow ? '8px' : '9.5px'};
      font-weight: 700;
      letter-spacing: 0.2px;
      color: #1e293b;
    }
  </style>
</head>
<body>
  <div style="border-bottom: 2px solid #0f172a; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <h1 style="margin: 0; font-size: ${isNarrow ? '13px' : '18px'}; font-weight: 800; letter-spacing: -0.3px; line-height: 1.1;">PharmaCore Pharmacy</h1>
      <p style="margin: 1px 0 0 0; color: #475569; font-size: ${isNarrow ? '8px' : '10px'}; font-weight: 600;">Purchase Order & Restock Requisition</p>
    </div>
    <div style="text-align: right; font-family: monospace; font-size: ${isNarrow ? '8px' : '10px'}; line-height: 1.2;">
      <div>Order: <strong>#${order.id}</strong></div>
      <div>Date: ${new Date(order.createdAt).toLocaleDateString()}</div>
      <div>Paper: <strong>${paperFormatLabel}</strong></div>
    </div>
  </div>

  <div style="background: #f8fafc; padding: ${isNarrow ? '4px 6px' : '6px 8px'}; border: 1px solid #cbd5e1; margin-top: 5px; display: flex; justify-content: space-between; font-size: ${isNarrow ? '8.5px' : '10px'}; flex-wrap: wrap; gap: 4px;">
    <div><strong>Created By:</strong> ${order.createdBy || currentUserFullName || 'Admin'} (${order.createdByRole || 'Admin'})</div>
    <div><strong>Title:</strong> ${order.title}</div>
    <div><strong>Summary:</strong> ${order.items.length} Lines • ${totalUnits} Units</div>
  </div>

  <table>
    <thead>
      ${
        is4Col
          ? `<tr>
        <th style="width: 22px; text-align: center;">SL</th>
        <th style="text-align: left;">Medicine Name</th>
        <th style="width: ${isNarrow ? '55px' : '75px'}; text-align: center;">Unit / Type</th>
        <th style="width: ${isNarrow ? '45px' : '65px'}; text-align: right;">Quantity</th>
      </tr>`
          : `<tr>
        <th style="width: 22px; text-align: center;">SL</th>
        <th style="text-align: left;">Medicine Name</th>
        <th style="text-align: left;">Supplier</th>
        <th style="text-align: right;">Stock</th>
        <th style="text-align: center;">Order Qty</th>
        <th style="text-align: right;">Unit Cost</th>
        <th style="text-align: right;">Total Cost</th>
      </tr>`
      }
    </thead>
    <tbody>
      ${rows}
    </tbody>
    <tfoot>
      <tr style="background: #f1f5f9; font-weight: bold; font-family: monospace;">
        <td colspan="${is4Col ? 3 : 6}" style="padding: ${isNarrow ? '3px 4px' : '5px 6px'}; border: 1px solid #cbd5e1; text-align: right; font-size: ${isNarrow ? '8.5px' : '10px'};">
          Total Lines: ${order.items.length} | Units: ${totalUnits} | Grand Total:
        </td>
        <td style="padding: ${isNarrow ? '3px 4px' : '5px 6px'}; border: 1px solid #cbd5e1; text-align: right; color: #047857; font-size: ${isNarrow ? '9px' : '10.5px'};">
          ${order.totalEstimatedCost.toFixed(2)}
        </td>
      </tr>
    </tfoot>
  </table>

  <div style="margin-top: ${isNarrow ? '16px' : '30px'}; display: flex; justify-content: space-between; text-align: center; font-size: ${isNarrow ? '8px' : '10px'}; page-break-inside: avoid; break-inside: avoid;">
    <div style="border-top: 1px solid #94a3b8; width: 30%; padding-top: 3px;">
      <div><strong>${order.createdBy || 'Creator'}</strong></div>
      <div style="color: #64748b; font-size: 7.5px;">Prepared By</div>
    </div>
    <div style="border-top: 1px solid #94a3b8; width: 30%; padding-top: 3px;">
      <div><strong>Chief Pharmacist</strong></div>
      <div style="color: #64748b; font-size: 7.5px;">Authorized</div>
    </div>
    <div style="border-top: 1px solid #94a3b8; width: 30%; padding-top: 3px;">
      <div><strong>Supplier Rep</strong></div>
      <div style="color: #64748b; font-size: 7.5px;">Received</div>
    </div>
  </div>

  <div style="text-align: center; font-size: 7.5px; color: #94a3b8; margin-top: ${isNarrow ? '10px' : '16px'}; page-break-inside: avoid;">
    Export target directory: ${settings.pdfDownloadDirectory} • Maximum Row Ink Print Layout
  </div>
</body>
</html>`;
}
