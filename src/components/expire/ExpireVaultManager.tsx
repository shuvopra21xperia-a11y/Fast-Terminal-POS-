/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Simple Expire In-Out System (Same as Purchase Workflow) with Child Window
 * 
 * Workflow:
 * 1. Expire Out-Invoice:
 *    - Child Window allows inputting ONLY items kept in the vault for that supplier.
 *    - Assembled in procurement grid and confirmed to create Out-Invoice.
 * 2. Expire In-Invoice (Goods Exchange):
 *    - When supplier brings replacement goods for exchange, input them in this expire purchase system.
 *    - Child Window adds fresh batches (batch #, future expiry, qty, cost, MRP).
 *    - Automatically increments inventory counts in active batches.
 * 3. Direct Cash Back:
 *    - If supplier comes to cash back against out-invoice, open by invoice # and add cash directly.
 * 4. Invoices Register & History:
 *    - Full transaction ledger and printable slips.
 * 5. Send Medicine to Vault:
 *    - Quick search child dialog to quarantine active inventory into the vault.
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import {
  ExpireVaultItem,
  ExpireReturnTransaction,
  ExpireInInvoice,
  CashPaymentRecord,
  Supplier,
  Medicine,
  Batch,
  SupplierCallLog,
  SupplierCallStatus,
} from '../../types/pharmacy';
import {
  Truck,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
  Calculator,
  Receipt,
  Search,
  Layers,
  Printer,
  Boxes,
  X,
  ChevronDown,
  Building,
  Globe,
  CornerDownLeft,
  Hash,
  Percent,
  PanelLeft,
  Zap,
  Sparkles,
  ArrowRight,
  BookmarkCheck,
  Bookmark,
  Clock,
  Eye,
  Edit3,
  AlertCircle,
  RotateCcw,
  Check,
  ArrowRightLeft,
  Banknote,
  ShieldCheck,
  Lock,
  Calendar,
  User,
  Phone,
  PhoneCall,
  FolderTree,
  ExternalLink,
  MessageSquare,
  Filter,
  ChevronRight,
  Maximize2,
  Minimize2,
  Tag,
  ArrowUpDown,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  ExpireOutInvoiceSlipModal,
  ExpireInInvoiceSlipModal,
  CashRefundSlipModal,
} from './ExpirePrintSlips';

type ExpireSystemTab = 'vault_tree' | 'out_invoice' | 'in_invoice' | 'cash_settlement' | 'register';

export const ExpireVaultManager: React.FC = () => {
  const {
    suppliers,
    medicines,
    batches,
    expireVault,
    expireTransactions,
    expireInInvoices,
    supplierCallLogs,
    logSupplierCall,
    createExpireOutInvoice,
    createExpireInInvoice,
    addCashToOutInvoice,
    transferToVault,
    currentUser,
    users,
    formatCurrency,
    showToast,
    setIsSidebarCollapsed,
  } = usePharmacy();

  // Top Tabs: Same as Purchase style (Default to Vault Stock & Supplier Tree)
  const [activeTab, setActiveTab] = useState<ExpireSystemTab>('vault_tree');

  // Supplier selection
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    suppliers[0]?.SupplierID || ''
  );
  const activeSupplier = useMemo(
    () => suppliers.find((s) => s.SupplierID === selectedSupplierId) || suppliers[0],
    [suppliers, selectedSupplierId]
  );

  // Representative details
  const [representativeName, setRepresentativeName] = useState('Mr. Representative');
  const [representativePhone, setRepresentativePhone] = useState(activeSupplier?.Phone || '');
  const [notes, setNotes] = useState('Supplier return transaction');

  // =========================================================================
  // 0. VAULT STOCK & SUPPLIER TREE WITH GROUP STATE
  // =========================================================================
  const [treeSearch, setTreeSearch] = useState('');
  const [treeSelectedSupplierId, setTreeSelectedSupplierId] = useState<string>('ALL');
  const [treeSelectedGroup, setTreeSelectedGroup] = useState<string>('ALL');
  const [expandedSuppliersInTree, setExpandedSuppliersInTree] = useState<Record<string, boolean>>({
    'SUP-001': true,
    'SUP-002': true,
    'SUP-003': true,
    'SUP-004': true,
    'SUP-005': true,
  });

  // Maximum Rows & View Controls
  const [isMaxRowsView, setIsMaxRowsView] = useState<boolean>(true); // default to maximum row density
  const [isTreeCollapsed, setIsTreeCollapsed] = useState<boolean>(false);
  const [selectedVaultBatchIds, setSelectedVaultBatchIds] = useState<Set<string>>(new Set());
  const [vaultSortField, setVaultSortField] = useState<'expiry' | 'valuation' | 'quantity' | 'name' | 'group'>('expiry');
  const [vaultSortDirection, setVaultSortDirection] = useState<'asc' | 'desc'>('asc');

  // Supplier Call Modal State
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callModalSupplier, setCallModalSupplier] = useState<Supplier | null>(null);
  const [callModalRepName, setCallModalRepName] = useState('');
  const [callModalPhone, setCallModalPhone] = useState('');
  const [callModalNotes, setCallModalNotes] = useState('');
  const [callModalVisitDate, setCallModalVisitDate] = useState('');
  const [callModalStatus, setCallModalStatus] = useState<SupplierCallStatus>('Called');

  // Update representative phone when supplier changes
  useEffect(() => {
    if (activeSupplier) {
      setRepresentativePhone(activeSupplier.Phone || '');
    }
  }, [activeSupplier]);

  // Collapse navigation sidebar on open to maximize workspace (same as Purchase)
  useEffect(() => {
    setIsSidebarCollapsed(true);
  }, [setIsSidebarCollapsed]);

  // =========================================================================
  // 1. EXPIRE OUT-INVOICE STATE (ONLY VAULT ITEMS PERMITTED!)
  // =========================================================================
  const outInvoiceNumber = useMemo(() => {
    return `EXP-OUT-2026-${String(expireTransactions.length + 101).padStart(4, '0')}`;
  }, [expireTransactions.length]);

  interface OutLineItem {
    vaultId: string;
    medicineId: string;
    tradeName: string;
    genericName: string;
    batchNumber: string;
    expiryDate: string;
    availableInVault: number;
    returnQty: number;
    costPrice: number;
    totalCost: number;
    group?: string;
  }
  const [outLines, setOutLines] = useState<OutLineItem[]>([]);

  // Eligible items currently kept in vault ONLY for this supplier!
  const eligibleVaultItems = useMemo(() => {
    return expireVault.filter(
      (v) => v.ReturnStatus === 'InVault' && v.SupplierID === selectedSupplierId
    );
  }, [expireVault, selectedSupplierId]);

  // =========================================================================
  // 2. EXPIRE IN-INVOICE STATE (GOODS EXCHANGE -> ACTIVE STOCK INCREMENT)
  // =========================================================================
  const inInvoiceNumber = useMemo(() => {
    return `EXP-IN-2026-${String(expireInInvoices.length + 101).padStart(4, '0')}`;
  }, [expireInInvoices.length]);

  // Pending out-invoices that can be exchanged
  const pendingOutInvoices = useMemo(() => {
    return expireTransactions.filter((t) => t.Status !== 'Settled');
  }, [expireTransactions]);

  const [selectedOutInvoiceForExchange, setSelectedOutInvoiceForExchange] = useState<string>(() => {
    return pendingOutInvoices[0]?.VoucherNumber || '';
  });

  const activeOutInvoiceRecord = useMemo(() => {
    return (
      expireTransactions.find(
        (t) =>
          t.VoucherNumber.toUpperCase() === selectedOutInvoiceForExchange.toUpperCase() ||
          t.TransactionID.toUpperCase() === selectedOutInvoiceForExchange.toUpperCase()
      ) || pendingOutInvoices[0] || null
    );
  }, [expireTransactions, selectedOutInvoiceForExchange, pendingOutInvoices]);

  interface InLineItem {
    lineId: string;
    medicineId: string;
    tradeName: string;
    genericName: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    costPrice: number;
    sellingPrice: number;
    totalCost: number;
    group?: string;
  }
  const [inLines, setInLines] = useState<InLineItem[]>([]);

  // =========================================================================
  // 3. CASH BACK DIRECTLY AGAINST OUT-INVOICE STATE
  // =========================================================================
  const [cashSearchInvoiceNum, setCashSearchInvoiceNum] = useState<string>('');
  const [activeCashInvoiceNum, setActiveCashInvoiceNum] = useState<string>('');
  const [cashAmountInput, setCashAmountInput] = useState<number>(0);
  const [cashPaymentMethod, setCashPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'MFS' | 'Cheque'>('Cash');
  const [cashNotes, setCashNotes] = useState<string>('');

  const activeCashOutInvoice = useMemo(() => {
    const q = (activeCashInvoiceNum || cashSearchInvoiceNum).trim().toUpperCase();
    if (!q) return pendingOutInvoices[0] || expireTransactions[0] || null;
    return (
      expireTransactions.find(
        (t) =>
          t.VoucherNumber.toUpperCase() === q ||
          t.TransactionID.toUpperCase() === q ||
          t.VoucherNumber.toUpperCase().includes(q)
      ) || null
    );
  }, [expireTransactions, activeCashInvoiceNum, cashSearchInvoiceNum, pendingOutInvoices]);

  useEffect(() => {
    if (activeCashOutInvoice) {
      const remaining =
        activeCashOutInvoice.DueBalance !== undefined
          ? activeCashOutInvoice.DueBalance
          : activeCashOutInvoice.TotalAmount - (activeCashOutInvoice.PaidAmount || 0);
      setCashAmountInput(Math.max(0, remaining));
      setCashNotes(`Cash refund from ${activeCashOutInvoice.SupplierName}`);
    }
  }, [activeCashOutInvoice]);

  // =========================================================================
  // 4. RIGHT-SIDE CHILD WINDOW STATE (SAME AS PURCHASE SYSTEM)
  // =========================================================================
  const [isChildWindowOpen, setIsChildWindowOpen] = useState<boolean>(true);

  // Child Window - Out-Invoice Vault Item Selector
  const [childVaultSearch, setChildVaultSearch] = useState('');
  const [selectedVaultItem, setSelectedVaultItem] = useState<ExpireVaultItem | null>(null);
  const [childOutQty, setChildOutQty] = useState<number>(1);
  const vaultItemSearchInputRef = useRef<HTMLInputElement>(null);
  const outQtyInputRef = useRef<HTMLInputElement>(null);

  // Filtered vault items for Child Window
  const filteredChildVaultItems = useMemo(() => {
    if (!childVaultSearch.trim()) return eligibleVaultItems;
    const q = childVaultSearch.toLowerCase().trim();
    return eligibleVaultItems.filter(
      (v) =>
        v.TradeName.toLowerCase().includes(q) ||
        v.GenericName.toLowerCase().includes(q) ||
        v.BatchNumber.toLowerCase().includes(q)
    );
  }, [eligibleVaultItems, childVaultSearch]);

  // Child Window - In-Invoice Fresh Medicine Selector
  const [childInMedSearch, setChildInMedSearch] = useState('');
  const [selectedInMed, setSelectedInMed] = useState<Medicine | null>(null);
  const [childInBatchNum, setChildInBatchNum] = useState<string>(`EX-${Math.floor(100 + Math.random() * 900)}`);
  const [childInExpiry, setChildInExpiry] = useState<string>('2028-12-31');
  const [childInQty, setChildInQty] = useState<number>(10);
  const [childInCostPrice, setChildInCostPrice] = useState<number>(100);
  const [childInSellingPrice, setChildInSellingPrice] = useState<number>(140);
  const inMedSearchInputRef = useRef<HTMLInputElement>(null);

  // Filtered active catalog medicines for In-Invoice child window
  const filteredCatalogMedicines = useMemo(() => {
    if (!childInMedSearch.trim()) return [];
    const q = childInMedSearch.toLowerCase().trim();
    return medicines
      .filter(
        (m) =>
          m.Status === 'Active' &&
          (m.TradeName.toLowerCase().includes(q) ||
            m.GenericName.toLowerCase().includes(q) ||
            m.Barcode.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [medicines, childInMedSearch]);

  // =========================================================================
  // 5. QUICK MODAL: SEND TO VAULT DIALOG
  // =========================================================================
  const [isSendToVaultModalOpen, setIsSendToVaultModalOpen] = useState(false);
  const [vaultModalSearch, setVaultModalSearch] = useState('');
  const [vaultModalSelectedBatch, setVaultModalSelectedBatch] = useState<Batch | null>(null);
  const [vaultModalSelectedMed, setVaultModalSelectedMed] = useState<Medicine | null>(null);
  const [vaultModalQty, setVaultModalQty] = useState<number>(1);
  const [vaultModalReason, setVaultModalReason] = useState('Quarantined near-expiry stock');

  const availableBatchesForVault = useMemo(() => {
    if (!vaultModalSearch.trim()) return [];
    const q = vaultModalSearch.toLowerCase().trim();
    return batches
      .filter((b) => b.CurrentStock > 0)
      .filter((b) => {
        const med = medicines.find((m) => m.MedicineID === b.MedicineID);
        if (!med) return false;
        return (
          med.TradeName.toLowerCase().includes(q) ||
          med.GenericName.toLowerCase().includes(q) ||
          b.BatchNumber.toLowerCase().includes(q)
        );
      })
      .slice(0, 8)
      .map((b) => {
        const med = medicines.find((m) => m.MedicineID === b.MedicineID)!;
        const supp = suppliers.find((s) => s.SupplierID === b.SupplierID);
        return { batch: b, medicine: med, supplier: supp };
      });
  }, [batches, medicines, suppliers, vaultModalSearch]);

  // =========================================================================
  // PRINT SLIPS MODALS
  // =========================================================================
  const [slipOutInvoice, setSlipOutInvoice] = useState<ExpireReturnTransaction | null>(null);
  const [slipInInvoice, setSlipInInvoice] = useState<ExpireInInvoice | null>(null);
  const [slipCashReceipt, setSlipCashReceipt] = useState<CashPaymentRecord | null>(null);
  const [slipCashInvoice, setSlipCashInvoice] = useState<ExpireReturnTransaction | null>(null);

  // =========================================================================
  // VAULT STOCK & SUPPLIER TREE COMPUTATIONS
  // =========================================================================
  // =========================================================================
  // VAULT STOCK & SUPPLIER TREE WITH GROUP COMPUTATIONS
  // =========================================================================
  const waitingVaultItems = useMemo(() => {
    return expireVault.filter((v) => v.ReturnStatus === 'InVault');
  }, [expireVault]);

  interface SupplierTreeGroup {
    groupName: string;
    count: number;
    totalUnits: number;
    totalCost: number;
    items: ExpireVaultItem[];
  }

  interface SupplierTreeNode {
    supplier: Supplier;
    count: number;
    totalUnits: number;
    totalCost: number;
    items: ExpireVaultItem[];
    groups: SupplierTreeGroup[];
  }

  // Supplier & Group Tree Aggregation
  const supplierTreeData = useMemo<SupplierTreeNode[]>(() => {
    const suppMap = new Map<
      string,
      {
        supplier: Supplier;
        count: number;
        totalUnits: number;
        totalCost: number;
        items: ExpireVaultItem[];
        groupMap: Map<string, SupplierTreeGroup>;
      }
    >();

    for (const item of waitingVaultItems) {
      const supp = suppliers.find((s) => s.SupplierID === item.SupplierID) || {
        SupplierID: item.SupplierID,
        Name: item.SupplierName,
        Phone: item.SupplierPhone || 'N/A',
        Address: 'Dhaka',
        DefaultDiscountPercent: 0,
        TotalDue: 0,
      };

      if (!suppMap.has(supp.SupplierID)) {
        suppMap.set(supp.SupplierID, {
          supplier: supp,
          count: 0,
          totalUnits: 0,
          totalCost: 0,
          items: [],
          groupMap: new Map(),
        });
      }

      const entry = suppMap.get(supp.SupplierID)!;
      entry.count += 1;
      entry.totalUnits += item.Quantity;
      entry.totalCost += item.Quantity * item.CostPrice;
      entry.items.push(item);

      const grp = item.Group || 'General';
      if (!entry.groupMap.has(grp)) {
        entry.groupMap.set(grp, {
          groupName: grp,
          count: 0,
          totalUnits: 0,
          totalCost: 0,
          items: [],
        });
      }
      const grpEntry = entry.groupMap.get(grp)!;
      grpEntry.count += 1;
      grpEntry.totalUnits += item.Quantity;
      grpEntry.totalCost += item.Quantity * item.CostPrice;
      grpEntry.items.push(item);
    }

    return Array.from(suppMap.values())
      .map((entry) => ({
        supplier: entry.supplier,
        count: entry.count,
        totalUnits: entry.totalUnits,
        totalCost: entry.totalCost,
        items: entry.items,
        groups: Array.from(entry.groupMap.values()).sort((a, b) => b.totalCost - a.totalCost),
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }, [waitingVaultItems, suppliers]);

  // All distinct groups in the vault with aggregations
  const allVaultGroups = useMemo(() => {
    const map = new Map<string, { count: number; totalUnits: number; totalCost: number }>();
    for (const item of waitingVaultItems) {
      const grp = item.Group || 'General';
      if (!map.has(grp)) {
        map.set(grp, { count: 0, totalUnits: 0, totalCost: 0 });
      }
      const entry = map.get(grp)!;
      entry.count += 1;
      entry.totalUnits += item.Quantity;
      entry.totalCost += item.Quantity * item.CostPrice;
    }
    return Array.from(map.entries())
      .map(([groupName, data]) => ({ groupName, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [waitingVaultItems]);

  // Filtered & Sorted Vault Items for Maximum Row View
  const filteredTreeVaultItems = useMemo(() => {
    const list = waitingVaultItems.filter((item) => {
      // Supplier filter
      if (treeSelectedSupplierId !== 'ALL' && item.SupplierID !== treeSelectedSupplierId) {
        return false;
      }
      // Group filter
      if (treeSelectedGroup !== 'ALL' && (item.Group || 'General') !== treeSelectedGroup) {
        return false;
      }
      // Search filter
      if (treeSearch.trim()) {
        const q = treeSearch.toLowerCase().trim();
        return (
          item.TradeName.toLowerCase().includes(q) ||
          item.GenericName.toLowerCase().includes(q) ||
          item.BatchNumber.toLowerCase().includes(q) ||
          item.SupplierName.toLowerCase().includes(q) ||
          (item.Group && item.Group.toLowerCase().includes(q)) ||
          (item.Notes && item.Notes.toLowerCase().includes(q))
        );
      }
      return true;
    });

    // Sorting
    list.sort((a, b) => {
      let cmp = 0;
      if (vaultSortField === 'expiry') {
        const expA = a.ExpiryDate || '9999-99-99';
        const expB = b.ExpiryDate || '9999-99-99';
        cmp = expA.localeCompare(expB);
      } else if (vaultSortField === 'valuation') {
        cmp = a.Quantity * a.CostPrice - b.Quantity * b.CostPrice;
      } else if (vaultSortField === 'quantity') {
        cmp = a.Quantity - b.Quantity;
      } else if (vaultSortField === 'name') {
        cmp = a.TradeName.localeCompare(b.TradeName);
      } else if (vaultSortField === 'group') {
        cmp = (a.Group || 'General').localeCompare(b.Group || 'General');
      }
      return vaultSortDirection === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [waitingVaultItems, treeSelectedSupplierId, treeSelectedGroup, treeSearch, vaultSortField, vaultSortDirection]);

  // Checkbox Selection for Bulk Out-Invoice
  const handleToggleSelectAll = () => {
    if (selectedVaultBatchIds.size === filteredTreeVaultItems.length && filteredTreeVaultItems.length > 0) {
      setSelectedVaultBatchIds(new Set());
    } else {
      setSelectedVaultBatchIds(new Set(filteredTreeVaultItems.map((i) => i.VaultID)));
    }
  };

  const handleToggleSelectOne = (vaultId: string) => {
    setSelectedVaultBatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(vaultId)) {
        next.delete(vaultId);
      } else {
        next.add(vaultId);
      }
      return next;
    });
  };

  const handleCreateOutInvoiceForSelected = () => {
    const selectedItems = waitingVaultItems.filter((i) => selectedVaultBatchIds.has(i.VaultID));
    if (selectedItems.length === 0) {
      showToast('No items selected.', 'warning');
      return;
    }
    const supplierIds = Array.from(new Set(selectedItems.map((i) => i.SupplierID)));
    const targetSupplierId = supplierIds[0];
    const itemsForTarget = selectedItems.filter((i) => i.SupplierID === targetSupplierId);

    setSelectedSupplierId(targetSupplierId);
    setOutLines(
      itemsForTarget.map((v) => ({
        vaultId: v.VaultID,
        medicineId: v.MedicineID,
        tradeName: v.TradeName,
        genericName: v.GenericName,
        batchNumber: v.BatchNumber,
        expiryDate: v.ExpiryDate || 'Expired',
        availableInVault: v.Quantity,
        returnQty: v.Quantity,
        costPrice: v.CostPrice,
        totalCost: Math.round(v.Quantity * v.CostPrice * 100) / 100,
        group: v.Group,
      }))
    );
    setSelectedVaultBatchIds(new Set());
    setActiveTab('out_invoice');
    setIsChildWindowOpen(true);
    showToast(
      `Loaded ${itemsForTarget.length} selected batches for ${suppliers.find((s) => s.SupplierID === targetSupplierId)?.Name} into Out-Invoice.`,
      'success'
    );
  };

  // Group Badge Color
  const getGroupBadgeClass = (groupName?: string) => {
    const g = (groupName || 'General').toLowerCase();
    if (g.includes('cardiac')) return 'bg-purple-950/80 text-purple-300 border-purple-800';
    if (g.includes('antibiotic')) return 'bg-rose-950/80 text-rose-300 border-rose-800';
    if (g.includes('gastro')) return 'bg-cyan-950/80 text-cyan-300 border-cyan-800';
    if (g.includes('skin')) return 'bg-amber-950/80 text-amber-300 border-amber-800';
    if (g.includes('herbal')) return 'bg-emerald-950/80 text-emerald-300 border-emerald-800';
    if (g.includes('antidiabetic')) return 'bg-blue-950/80 text-blue-300 border-blue-800';
    if (g.includes('respiratory')) return 'bg-teal-950/80 text-teal-300 border-teal-800';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  // Tree action: Start Out-Invoice directly for a supplier (optionally with an item or group preselected)
  const handleStartOutInvoiceFromTree = (supplierId: string, initialItem?: ExpireVaultItem, groupFilter?: string) => {
    setSelectedSupplierId(supplierId);
    if (initialItem) {
      setOutLines([
        {
          vaultId: initialItem.VaultID,
          medicineId: initialItem.MedicineID,
          tradeName: initialItem.TradeName,
          genericName: initialItem.GenericName,
          batchNumber: initialItem.BatchNumber,
          expiryDate: initialItem.ExpiryDate || 'Expired',
          availableInVault: initialItem.Quantity,
          returnQty: initialItem.Quantity,
          costPrice: initialItem.CostPrice,
          totalCost: Math.round(initialItem.Quantity * initialItem.CostPrice * 100) / 100,
          group: initialItem.Group,
        },
      ]);
    } else {
      let itemsForSupp = waitingVaultItems.filter((v) => v.SupplierID === supplierId);
      if (groupFilter && groupFilter !== 'ALL') {
        itemsForSupp = itemsForSupp.filter((v) => (v.Group || 'General') === groupFilter);
      }
      if (itemsForSupp.length > 0) {
        setOutLines(
          itemsForSupp.map((v) => ({
            vaultId: v.VaultID,
            medicineId: v.MedicineID,
            tradeName: v.TradeName,
            genericName: v.GenericName,
            batchNumber: v.BatchNumber,
            expiryDate: v.ExpiryDate || 'Expired',
            availableInVault: v.Quantity,
            returnQty: v.Quantity,
            costPrice: v.CostPrice,
            totalCost: Math.round(v.Quantity * v.CostPrice * 100) / 100,
            group: v.Group,
          }))
        );
      } else {
        setOutLines([]);
      }
    }
    setActiveTab('out_invoice');
    setIsChildWindowOpen(true);
    showToast(`Loaded ${supplierId} into Out-Invoice. Review quantities or pick more from Child Window.`, 'info');
  };

  // Tree action: Open Call Modal
  const handleOpenCallModal = (supplier: Supplier) => {
    setCallModalSupplier(supplier);
    setCallModalRepName('Representative');
    setCallModalPhone(supplier.Phone || '');
    setCallModalNotes(`Called representative regarding expired medicine waiting in vault.`);
    const d = new Date(Date.now() + 86400000 * 2);
    setCallModalVisitDate(d.toISOString().split('T')[0]);
    setCallModalStatus('ScheduledVisit');
    setIsCallModalOpen(true);
  };

  // Tree action: Save Call Log
  const handleSaveCallModal = () => {
    if (!callModalSupplier) return;
    const res = logSupplierCall(callModalSupplier.SupplierID, {
      representativeName: callModalRepName,
      phone: callModalPhone,
      notes: callModalNotes,
      scheduledVisitDate: callModalVisitDate,
      status: callModalStatus,
    });
    if (res.success) {
      showToast(
        `Call logged for ${callModalSupplier.Name}. Scheduled visit: ${callModalVisitDate || 'N/A'}`,
        'success',
        'Call Recorded'
      );
      setIsCallModalOpen(false);
    } else {
      showToast('Failed to log supplier call.', 'error');
    }
  };

  // =========================================================================
  // ACTION HANDLERS
  // =========================================================================

  // Out-Invoice: Pick vault item in Child Window
  const handleSelectVaultItemInChild = (vItem: ExpireVaultItem) => {
    setSelectedVaultItem(vItem);
    setChildOutQty(vItem.Quantity); // Default to full available quantity
    setTimeout(() => {
      outQtyInputRef.current?.focus();
      outQtyInputRef.current?.select();
    }, 50);
  };

  // Out-Invoice: Add Line from Child Window to Main Grid
  const handleAddVaultLine = () => {
    if (!selectedVaultItem) {
      showToast('Please select an item from the vault list.', 'warning');
      return;
    }

    if (childOutQty <= 0) {
      showToast('Quantity must be greater than zero.', 'warning');
      return;
    }

    if (childOutQty > selectedVaultItem.Quantity) {
      showToast(`Quantity cannot exceed available in vault (${selectedVaultItem.Quantity}).`, 'warning');
      return;
    }

    // Check if already in lines
    const existingIdx = outLines.findIndex((l) => l.vaultId === selectedVaultItem.VaultID);
    if (existingIdx >= 0) {
      const updated = [...outLines];
      updated[existingIdx].returnQty = childOutQty;
      updated[existingIdx].totalCost = Math.round(childOutQty * selectedVaultItem.CostPrice * 100) / 100;
      setOutLines(updated);
      showToast(`Updated quantity for ${selectedVaultItem.TradeName}.`, 'info');
    } else {
      const newLine: OutLineItem = {
        vaultId: selectedVaultItem.VaultID,
        medicineId: selectedVaultItem.MedicineID,
        tradeName: selectedVaultItem.TradeName,
        genericName: selectedVaultItem.GenericName,
        batchNumber: selectedVaultItem.BatchNumber,
        expiryDate: selectedVaultItem.ExpiryDate || 'Expired',
        availableInVault: selectedVaultItem.Quantity,
        returnQty: childOutQty,
        costPrice: selectedVaultItem.CostPrice,
        totalCost: Math.round(childOutQty * selectedVaultItem.CostPrice * 100) / 100,
        group: selectedVaultItem.Group,
      };
      setOutLines((prev) => [...prev, newLine]);
      showToast(`Added ${selectedVaultItem.TradeName} to Out-Invoice.`, 'success');
    }

    setSelectedVaultItem(null);
    setChildVaultSearch('');
    setTimeout(() => {
      vaultItemSearchInputRef.current?.focus();
    }, 50);
  };

  // Out-Invoice: Bulk Add all eligible vault items for this supplier
  const handleAddAllEligibleVaultItems = () => {
    if (eligibleVaultItems.length === 0) {
      showToast('No items waiting in vault for this supplier.', 'info');
      return;
    }
    const newLines = eligibleVaultItems.map((v) => ({
      vaultId: v.VaultID,
      medicineId: v.MedicineID,
      tradeName: v.TradeName,
      genericName: v.GenericName,
      batchNumber: v.BatchNumber,
      expiryDate: v.ExpiryDate || 'Expired',
      availableInVault: v.Quantity,
      returnQty: v.Quantity,
      costPrice: v.CostPrice,
      totalCost: Math.round(v.Quantity * v.CostPrice * 100) / 100,
      group: v.Group,
    }));
    setOutLines(newLines);
    showToast(`Added all ${newLines.length} vault items to Out-Invoice.`, 'success');
  };

  // Out-Invoice: Confirm and generate
  const handleConfirmOutInvoice = () => {
    if (outLines.length === 0) {
      showToast('Add at least one vault item to issue an Expire Out-Invoice.', 'warning');
      return;
    }

    const res = createExpireOutInvoice({
      supplierId: selectedSupplierId,
      group: 'All Groups',
      representativeName,
      representativePhone,
      salesmanId: currentUser?.UserID || 'USR-001',
      salesmanName: currentUser?.FullName || 'Pharmacist',
      notes,
      items: outLines.map((l) => ({
        vaultId: l.vaultId,
        quantity: l.returnQty,
      })),
    });

    if (res.success && res.outInvoice) {
      showToast(
        `Expire Out-Invoice #${res.outInvoice.VoucherNumber} issued successfully! Stock deducted from vault.`,
        'success',
        'Out-Invoice Generated'
      );
      setSlipOutInvoice(res.outInvoice);
      setOutLines([]);
    } else {
      showToast(res.error || 'Failed to create Out-Invoice.', 'error');
    }
  };

  // In-Invoice: Auto-fill replacement lines from Out-Invoice
  const handleAutoFillExchangeLines = () => {
    if (!activeOutInvoiceRecord || !activeOutInvoiceRecord.Items) return;
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    const defaultFutureExpiry = futureDate.toISOString().split('T')[0];

    const filled: InLineItem[] = activeOutInvoiceRecord.Items.map((item, idx) => {
      const med = medicines.find((m) => m.MedicineID === item.MedicineID);
      const randomCode = String.fromCharCode(65 + Math.floor(Math.random() * 26));

      return {
        lineId: `line-${Date.now()}-${idx}`,
        medicineId: item.MedicineID,
        tradeName: item.TradeName,
        genericName: item.GenericName,
        batchNumber: `${item.BatchNumber.slice(0, 3)}-26${randomCode}01`,
        expiryDate: defaultFutureExpiry,
        quantity: item.Quantity,
        costPrice: item.CostPrice,
        sellingPrice: med?.MRP || item.CostPrice * 1.35,
        totalCost: Math.round(item.Quantity * item.CostPrice * 100) / 100,
        group: item.Group,
      };
    });

    setInLines(filled);
    showToast(`Auto-filled ${filled.length} replacement lines matching returned items.`, 'success');
  };

  // In-Invoice: Pick medicine in Child Window
  const handleSelectInMed = (med: Medicine) => {
    setSelectedInMed(med);
    setChildInMedSearch(med.TradeName);
    setChildInCostPrice(Math.round(med.MRP * 0.75 * 100) / 100);
    setChildInSellingPrice(med.MRP);
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    setChildInExpiry(futureDate.toISOString().split('T')[0]);
    setChildInBatchNum(`EX-${Math.floor(100 + Math.random() * 900)}`);
  };

  // In-Invoice: Add Line from Child Window to Main Grid
  const handleAddInLine = () => {
    if (!selectedInMed) {
      showToast('Select a medicine from the search list.', 'warning');
      return;
    }
    if (!childInBatchNum.trim()) {
      showToast('Enter a batch number.', 'warning');
      return;
    }
    if (childInQty <= 0) {
      showToast('Quantity must be greater than zero.', 'warning');
      return;
    }

    const newLine: InLineItem = {
      lineId: `line-${Date.now()}`,
      medicineId: selectedInMed.MedicineID,
      tradeName: selectedInMed.TradeName,
      genericName: selectedInMed.GenericName,
      batchNumber: childInBatchNum.trim().toUpperCase(),
      expiryDate: childInExpiry,
      quantity: childInQty,
      costPrice: childInCostPrice,
      sellingPrice: childInSellingPrice,
      totalCost: Math.round(childInQty * childInCostPrice * 100) / 100,
      group: selectedInMed.Group,
    };

    setInLines((prev) => [...prev, newLine]);
    showToast(`Added ${selectedInMed.TradeName} replacement stock.`, 'success');

    setSelectedInMed(null);
    setChildInMedSearch('');
    setChildInBatchNum(`EX-${Math.floor(100 + Math.random() * 900)}`);
    setTimeout(() => {
      inMedSearchInputRef.current?.focus();
    }, 50);
  };

  // In-Invoice: Confirm and increment inventory
  const handleConfirmInInvoice = () => {
    if (!activeOutInvoiceRecord) {
      showToast('Select an Out-Invoice being exchanged.', 'warning');
      return;
    }
    if (inLines.length === 0) {
      showToast('Add at least one fresh replacement medicine to the In-Invoice.', 'warning');
      return;
    }

    const res = createExpireInInvoice({
      outInvoiceNumber: activeOutInvoiceRecord.VoucherNumber,
      supplierId: activeOutInvoiceRecord.SupplierID,
      notes: `Goods exchange against Out-Invoice #${activeOutInvoiceRecord.VoucherNumber}`,
      items: inLines.map((l) => ({
        medicineId: l.medicineId,
        tradeName: l.tradeName,
        genericName: l.genericName,
        batchNumber: l.batchNumber,
        expiryDate: l.expiryDate,
        quantity: l.quantity,
        costPrice: l.costPrice,
        sellingPrice: l.sellingPrice,
        group: l.group,
      })),
    });

    if (res.success && res.inInvoice) {
      showToast(
        `Expire In-Invoice #${res.inInvoice.InInvoiceNumber} confirmed! Fresh replacement batches added to active inventory stock.`,
        'success',
        'Active Stock Incremented'
      );
      setSlipInInvoice(res.inInvoice);
      setInLines([]);
    } else {
      showToast(res.error || 'Failed to create In-Invoice.', 'error');
    }
  };

  // Cash Back: Confirm
  const handleConfirmCashBack = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCashOutInvoice) {
      showToast('Select or enter an Out-Invoice number.', 'warning');
      return;
    }
    if (cashAmountInput <= 0) {
      showToast('Enter a valid cash amount.', 'warning');
      return;
    }

    const res = addCashToOutInvoice(activeCashOutInvoice.VoucherNumber, {
      amount: cashAmountInput,
      paymentMethod: cashPaymentMethod,
      notes: cashNotes,
    });

    if (res.success && res.updatedInvoice) {
      const record: CashPaymentRecord = {
        PaymentID: `CSH-${Date.now()}`,
        Amount: cashAmountInput,
        PaymentMethod: cashPaymentMethod,
        Date: new Date().toISOString(),
        ReceivedBy: currentUser?.FullName || 'Pharmacist',
        ReferenceNote: cashNotes,
      };
      setSlipCashReceipt(record);
      setSlipCashInvoice(res.updatedInvoice);
      showToast(
        `Cash refund of ${formatCurrency(cashAmountInput)} recorded against Out-Invoice #${activeCashOutInvoice.VoucherNumber}. Financial ledger updated.`,
        'success',
        'Cash Refund Credited'
      );
    } else {
      showToast(res.error || 'Failed to record cash refund.', 'error');
    }
  };

  // Send to Vault Modal Confirmation
  const handleConfirmSendToVault = () => {
    if (!vaultModalSelectedBatch || !vaultModalSelectedMed) {
      showToast('Select a medicine batch to quarantine.', 'warning');
      return;
    }
    if (vaultModalQty <= 0 || vaultModalQty > vaultModalSelectedBatch.CurrentStock) {
      showToast(`Invalid quantity. Maximum available: ${vaultModalSelectedBatch.CurrentStock}`, 'warning');
      return;
    }

    const res = transferToVault(
      vaultModalSelectedBatch.BatchID,
      vaultModalQty,
      vaultModalReason || 'Quarantined near-expiry stock'
    );

    if (res.success) {
      showToast(
        `Moved ${vaultModalQty} units of ${vaultModalSelectedMed.TradeName} to Expire Vault.`,
        'success',
        'Quarantined to Vault'
      );
      setIsSendToVaultModalOpen(false);
      setVaultModalSearch('');
      setVaultModalSelectedBatch(null);
      setVaultModalSelectedMed(null);
    } else {
      showToast(res.error || 'Failed to move to vault.', 'error');
    }
  };

  // Out-Invoice Totals
  const totalOutUnits = useMemo(() => outLines.reduce((s, l) => s + l.returnQty, 0), [outLines]);
  const totalOutAmount = useMemo(
    () => Math.round(outLines.reduce((s, l) => s + l.totalCost, 0) * 100) / 100,
    [outLines]
  );

  // In-Invoice Totals
  const totalInUnits = useMemo(() => inLines.reduce((s, l) => s + l.quantity, 0), [inLines]);
  const totalInAmount = useMemo(
    () => Math.round(inLines.reduce((s, l) => s + l.totalCost, 0) * 100) / 100,
    [inLines]
  );

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-slate-900 text-slate-100 select-none overflow-hidden font-sans">
      {/* 1. Header Toolbar (Mode Tabs + Actions) */}
      <header className="bg-slate-950 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-tight">
                Expire In-Out System (Purchase-Style)
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-950 text-amber-300 border border-amber-800 font-mono">
                Direct Inventory Sync
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Input vault items to return via Out-Invoice, exchange for fresh goods via In-Invoice, or add cash directly
            </p>
          </div>
        </div>

        {/* Tab Buttons & Fast Actions */}
        <div className="flex items-center gap-2">
          {/* Main Mode Tabs */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs gap-1">
            <button
              onClick={() => setActiveTab('vault_tree')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === 'vault_tree'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Vault Stock & Supplier Tree</span>
            </button>

            <button
              onClick={() => setActiveTab('out_invoice')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === 'out_invoice'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Expire Out-Invoice</span>
            </button>

            <button
              onClick={() => setActiveTab('in_invoice')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === 'in_invoice'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Expire In-Invoice (Exchange)</span>
            </button>

            <button
              onClick={() => setActiveTab('cash_settlement')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === 'cash_settlement'
                  ? 'bg-green-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              <span>Cash Back</span>
            </button>

            <button
              onClick={() => setActiveTab('register')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition ${
                activeTab === 'register'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Invoices Register</span>
            </button>
          </div>

          {/* Quick Action: Send to Vault Dialog */}
          <button
            onClick={() => setIsSendToVaultModalOpen(true)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Send to Vault</span>
          </button>

          {/* Toggle Child Window */}
          <button
            onClick={() => setIsChildWindowOpen((prev) => !prev)}
            title="Toggle Add Item Child Window (F2)"
            className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
              isChildWindowOpen
                ? 'bg-slate-800 text-white border-slate-700'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <PanelLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Child Window</span>
          </button>
        </div>
      </header>

      {/* 2. Secondary Context Header Bar (Supplier, Invoice #, Representative) */}
      {(activeTab === 'out_invoice' || activeTab === 'in_invoice') && (
        <div className="bg-slate-950/80 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex items-center gap-4 flex-wrap">
            {/* Supplier selector */}
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-slate-500" />
                Supplier:
              </span>
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  setSelectedSupplierId(e.target.value);
                  setOutLines([]); // Clear lines to prevent supplier mixing
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white font-bold focus:outline-none focus:border-amber-500"
              >
                {suppliers.map((s) => (
                  <option key={s.SupplierID} value={s.SupplierID}>
                    {s.Name} ({s.SupplierID})
                  </option>
                ))}
              </select>
            </div>

            {/* Representative Phone */}
            <div className="flex items-center gap-1.5 text-slate-300">
              <Phone className="w-3.5 h-3.5 text-slate-500" />
              <span>Rep: <strong>{representativePhone || activeSupplier?.Phone || 'N/A'}</strong></span>
            </div>

            {/* In-Vault Stock badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-[11px]">
              <Lock className="w-3 h-3 text-amber-400" />
              <span className="text-slate-400">In-Vault Waiting Stock:</span>
              <strong className="text-amber-300 font-mono">{eligibleVaultItems.length} batches</strong>
            </div>
          </div>

          {/* Invoice # Tag */}
          <div className="flex items-center gap-2 font-mono">
            <span className="text-slate-400 text-[11px]">
              {activeTab === 'out_invoice' ? 'Out-Invoice #:' : 'In-Invoice #:'}
            </span>
            <span className="font-bold text-amber-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {activeTab === 'out_invoice' ? outInvoiceNumber : inInvoiceNumber}
            </span>
          </div>
        </div>
      )}

      {/* 3. Main Workspace Area: Main Grid Table + Right-Side Child Window */}
      <div className="flex-1 flex overflow-hidden">
        {/* =========================================================================
            CENTER/LEFT: MAIN PROCUREMENT GRID (SAME AS PURCHASE SYSTEM)
            ========================================================================= */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-900">
          {/* TAB 0: VAULT STOCK & SUPPLIER TREE WITH GROUP (MAXIMUM ROW VIEW) */}
          {activeTab === 'vault_tree' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 1. Search & Control Toolbar */}
              <div className="p-2.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                {/* Search & Active Filter Chips */}
                <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-2xl flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={treeSearch}
                      onChange={(e) => setTreeSearch(e.target.value)}
                      placeholder="Search trade name, generic, batch, group, supplier..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    {treeSearch && (
                      <button
                        onClick={() => setTreeSearch('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Active Filter Chips */}
                  {(treeSelectedSupplierId !== 'ALL' || treeSelectedGroup !== 'ALL') && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {treeSelectedSupplierId !== 'ALL' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-950 border border-blue-700 text-blue-200 text-[11px] font-semibold">
                          <Building className="w-3 h-3 text-blue-400" />
                          <span className="truncate max-w-[120px]">
                            {suppliers.find((s) => s.SupplierID === treeSelectedSupplierId)?.Name || treeSelectedSupplierId}
                          </span>
                          <button
                            onClick={() => setTreeSelectedSupplierId('ALL')}
                            className="hover:text-white"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      )}

                      {treeSelectedGroup !== 'ALL' && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getGroupBadgeClass(treeSelectedGroup)}`}>
                          <Tag className="w-3 h-3" />
                          <span>{treeSelectedGroup}</span>
                          <button
                            onClick={() => setTreeSelectedGroup('ALL')}
                            className="hover:text-white"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      )}

                      <button
                        onClick={() => {
                          setTreeSelectedSupplierId('ALL');
                          setTreeSelectedGroup('ALL');
                        }}
                        className="text-[10px] text-slate-400 hover:text-white underline"
                      >
                        Reset Filters
                      </button>
                    </div>
                  )}
                </div>

                {/* Right Action Controls: Density Toggle, Sort, Tree Toggle */}
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  {/* Sort Selector */}
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    <select
                      value={vaultSortField}
                      onChange={(e) => setVaultSortField(e.target.value as any)}
                      className="bg-transparent text-[11px] text-slate-200 font-semibold focus:outline-none"
                    >
                      <option value="expiry" className="bg-slate-900 text-white">Sort: Expiry (Urgent First)</option>
                      <option value="valuation" className="bg-slate-900 text-white">Sort: Valuation (High to Low)</option>
                      <option value="quantity" className="bg-slate-900 text-white">Sort: Quantity (High to Low)</option>
                      <option value="name" className="bg-slate-900 text-white">Sort: Medicine Name (A-Z)</option>
                      <option value="group" className="bg-slate-900 text-white">Sort: Group Name (A-Z)</option>
                    </select>
                  </div>

                  {/* Maximum Rows / Density Toggle */}
                  <button
                    onClick={() => setIsMaxRowsView((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${
                      isMaxRowsView
                        ? 'bg-blue-900/60 text-blue-200 border-blue-700'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                    title="Toggle Maximum Row Density"
                  >
                    <Layers className="w-3 h-3" />
                    <span>{isMaxRowsView ? 'Max Rows (Compact)' : 'Standard Rows'}</span>
                  </button>

                  {/* Hide/Show Supplier Tree Toggle (Full Width View) */}
                  <button
                    onClick={() => setIsTreeCollapsed((prev) => !prev)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition ${
                      isTreeCollapsed
                        ? 'bg-amber-900/40 text-amber-300 border-amber-700'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                    title="Collapse or Expand Supplier Tree to Maximize Row View"
                  >
                    {isTreeCollapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                    <span>{isTreeCollapsed ? 'Show Tree' : 'Hide Tree (Max Width)'}</span>
                  </button>

                  {/* Summary Metric Chips */}
                  <div className="hidden lg:flex items-center gap-3 pl-2 border-l border-slate-800 text-[11px] font-mono">
                    <span className="text-slate-400">
                      Total: <strong className="text-white">{waitingVaultItems.length} batches</strong>
                    </span>
                    <span className="text-slate-400">
                      Valuation: <strong className="text-amber-300">{formatCurrency(waitingVaultItems.reduce((s, v) => s + v.Quantity * v.CostPrice, 0))}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Select Floating / Sticky Banner */}
              {selectedVaultBatchIds.size > 0 && (
                <div className="bg-blue-950/90 border-b border-blue-800 px-4 py-2 flex items-center justify-between gap-4 text-xs shrink-0 animate-in fade-in duration-150">
                  <div className="flex items-center gap-3">
                    <CheckSquare className="w-4 h-4 text-blue-400" />
                    <span className="font-semibold text-white">
                      <strong>{selectedVaultBatchIds.size} batches selected</strong> ({filteredTreeVaultItems.filter((i) => selectedVaultBatchIds.has(i.VaultID)).reduce((s, i) => s + i.Quantity, 0)} units • {formatCurrency(filteredTreeVaultItems.filter((i) => selectedVaultBatchIds.has(i.VaultID)).reduce((s, i) => s + i.Quantity * i.CostPrice, 0))})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedVaultBatchIds(new Set())}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                    >
                      Deselect All
                    </button>
                    <button
                      onClick={handleCreateOutInvoiceForSelected}
                      className="px-4 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold flex items-center gap-1.5 shadow-md"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Create Out-Invoice for Selected Batches</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 2. Workspace: Supplier Tree on Left + Maximum Row Table on Right */}
              <div className="flex-1 flex overflow-hidden">
                {/* LEFT: SUPPLIER TREE WITH GROUP (Expandable / Collapsible) */}
                {!isTreeCollapsed && (
                  <aside className="w-80 md:w-92 bg-slate-950/80 border-r border-slate-800 flex flex-col shrink-0">
                    {/* Tree Header */}
                    <div className="p-2.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-blue-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          Supplier & Group Tree
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const allOpen = Object.keys(expandedSuppliersInTree).length === supplierTreeData.length;
                            if (allOpen) {
                              setExpandedSuppliersInTree({});
                            } else {
                              const next: Record<string, boolean> = {};
                              supplierTreeData.forEach((s) => (next[s.supplier.SupplierID] = true));
                              setExpandedSuppliersInTree(next);
                            }
                          }}
                          className="text-[10px] text-slate-400 hover:text-white underline font-mono"
                        >
                          {Object.keys(expandedSuppliersInTree).length === supplierTreeData.length
                            ? 'Collapse All'
                            : 'Expand All'}
                        </button>
                      </div>
                    </div>

                    {/* Consolidated Root Node: All Suppliers & Groups */}
                    <div className="p-2 border-b border-slate-800/80 bg-slate-900/40">
                      <button
                        onClick={() => {
                          setTreeSelectedSupplierId('ALL');
                          setTreeSelectedGroup('ALL');
                        }}
                        className={`w-full text-left p-2 rounded-lg border text-xs transition flex items-center justify-between ${
                          treeSelectedSupplierId === 'ALL' && treeSelectedGroup === 'ALL'
                            ? 'bg-blue-950/70 border-blue-500 text-white shadow-sm'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-400" />
                          <div>
                            <div className="font-bold">All Suppliers & Groups</div>
                            <div className="text-[10px] text-slate-400">Consolidated Vault Inventory</div>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono font-bold text-blue-300">
                          {waitingVaultItems.length}
                        </span>
                      </button>

                      {/* Cross-Supplier Group Filter Pills Bar */}
                      <div className="mt-2">
                        <div className="text-[10px] text-slate-400 uppercase font-semibold mb-1 flex items-center gap-1">
                          <Tag className="w-3 h-3 text-slate-500" />
                          <span>Vault Groups ({allVaultGroups.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            onClick={() => setTreeSelectedGroup('ALL')}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                              treeSelectedGroup === 'ALL'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            All
                          </button>
                          {allVaultGroups.map((grp) => {
                            const isGroupActive = treeSelectedGroup === grp.groupName;
                            return (
                              <button
                                key={grp.groupName}
                                onClick={() => setTreeSelectedGroup(grp.groupName)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                                  isGroupActive
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <span>{grp.groupName}</span>
                                <span className="font-mono text-[9px] opacity-80">({grp.count})</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Hierarchical Supplier Nodes with Nested Groups */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                      {supplierTreeData.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                          No expired medicine waiting in vault.
                        </div>
                      ) : (
                        supplierTreeData.map((node) => {
                          const isSupplierSelected = treeSelectedSupplierId === node.supplier.SupplierID;
                          const isExpanded = !!expandedSuppliersInTree[node.supplier.SupplierID];
                          const hasVisitScheduled = node.items.some(
                            (i) => i.CallStatus === 'ScheduledVisit' || i.CallStatus === 'Called'
                          );

                          return (
                            <div
                              key={node.supplier.SupplierID}
                              className={`rounded-xl border text-xs overflow-hidden transition ${
                                isSupplierSelected && treeSelectedGroup === 'ALL'
                                  ? 'bg-slate-900 border-blue-500 shadow-md'
                                  : isSupplierSelected
                                  ? 'bg-slate-900/80 border-blue-700/60'
                                  : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                              }`}
                            >
                              {/* Supplier Header Row */}
                              <div className="p-2.5">
                                <div className="flex items-start justify-between gap-1">
                                  <div className="flex items-start gap-1.5 flex-1 min-w-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setExpandedSuppliersInTree((prev) => ({
                                          ...prev,
                                          [node.supplier.SupplierID]: !prev[node.supplier.SupplierID],
                                        }))
                                      }
                                      className="p-0.5 mt-0.5 text-slate-400 hover:text-white rounded"
                                      title={isExpanded ? 'Collapse Groups' : 'Expand Groups'}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                                      ) : (
                                        <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                      )}
                                    </button>

                                    <div
                                      onClick={() => {
                                        setTreeSelectedSupplierId(node.supplier.SupplierID);
                                        setTreeSelectedGroup('ALL');
                                      }}
                                      className="cursor-pointer flex-1 min-w-0"
                                    >
                                      <div className="font-bold text-white truncate leading-tight hover:text-blue-300 transition">
                                        {node.supplier.Name}
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                                        <span className="flex items-center gap-1">
                                          <Phone className="w-2.5 h-2.5 text-slate-500" />
                                          {node.supplier.Phone || 'N/A'}
                                        </span>
                                        <span className="font-mono text-slate-300">
                                          {node.count} {node.count === 1 ? 'batch' : 'batches'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-right shrink-0">
                                    <span className="text-[11px] font-mono font-bold text-amber-300 block">
                                      {formatCurrency(node.totalCost)}
                                    </span>
                                  </div>
                                </div>

                                {/* Action Buttons for Supplier */}
                                <div className="flex items-center gap-1.5 pt-1.5 mt-1.5 border-t border-slate-800/80">
                                  <button
                                    onClick={() => handleOpenCallModal(node.supplier)}
                                    className={`flex-1 py-1 px-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition ${
                                      hasVisitScheduled
                                        ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                                    }`}
                                  >
                                    <PhoneCall className="w-3 h-3 text-emerald-400" />
                                    <span>{hasVisitScheduled ? 'Call Info' : 'Call Rep'}</span>
                                  </button>

                                  <button
                                    onClick={() => handleStartOutInvoiceFromTree(node.supplier.SupplierID)}
                                    className="flex-1 py-1 px-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition shadow-xs"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>Out-Invoice</span>
                                  </button>
                                </div>
                              </div>

                              {/* Nested Groups Under This Supplier */}
                              {isExpanded && node.groups.length > 0 && (
                                <div className="bg-slate-950/90 border-t border-slate-800/80 px-2.5 py-1.5 space-y-1">
                                  <div className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                                    Supplier Groups ({node.groups.length})
                                  </div>
                                  {node.groups.map((grp) => {
                                    const isGroupSelected =
                                      isSupplierSelected && treeSelectedGroup === grp.groupName;

                                    return (
                                      <div
                                        key={grp.groupName}
                                        onClick={() => {
                                          setTreeSelectedSupplierId(node.supplier.SupplierID);
                                          setTreeSelectedGroup(grp.groupName);
                                        }}
                                        className={`p-1.5 rounded-lg border text-[11px] cursor-pointer transition flex items-center justify-between ${
                                          isGroupSelected
                                            ? 'bg-blue-950/80 border-blue-500 text-white font-bold'
                                            : 'bg-slate-900/60 border-slate-800/70 text-slate-300 hover:border-slate-700'
                                        }`}
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <span className={`w-2 h-2 rounded-full ${grp.groupName === 'Cardiac' ? 'bg-purple-400' : grp.groupName === 'Antibiotic' ? 'bg-rose-400' : grp.groupName === 'Gastroenterology' ? 'bg-cyan-400' : grp.groupName === 'Skin' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                                          <span>{grp.groupName}</span>
                                          <span className="text-[10px] text-slate-400 font-mono">
                                            ({grp.count})
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2 font-mono">
                                          <span className="text-amber-300 text-[10px]">
                                            {formatCurrency(grp.totalCost)}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleStartOutInvoiceFromTree(
                                                node.supplier.SupplierID,
                                                undefined,
                                                grp.groupName
                                              );
                                            }}
                                            className="px-1.5 py-0.5 bg-slate-800 hover:bg-amber-600 text-slate-300 hover:text-white rounded text-[9px] font-sans font-bold"
                                            title={`Create Out-Invoice for ${grp.groupName} group only`}
                                          >
                                            + Out-Inv
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Recent Call Logs Summary */}
                    {supplierCallLogs.length > 0 && (
                      <div className="p-2 border-t border-slate-800 bg-slate-950 text-xs shrink-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Recent Call Logs
                          </span>
                          <span className="text-[10px] text-blue-400 font-mono">
                            {supplierCallLogs.length} total
                          </span>
                        </div>
                        <div className="max-h-24 overflow-y-auto space-y-1">
                          {supplierCallLogs.slice(-2).reverse().map((log) => (
                            <div
                              key={log.CallID}
                              className="p-1 rounded bg-slate-900 border border-slate-800 text-[10px]"
                            >
                              <div className="flex justify-between font-bold text-white">
                                <span className="truncate max-w-[130px]">{log.SupplierName}</span>
                                <span className="text-emerald-400">{log.Status}</span>
                              </div>
                              <div className="text-slate-400 truncate mt-0.5">{log.Notes}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </aside>
                )}

                {/* RIGHT: MAXIMUM ROW VIEW TABLE OF EXPIRED VAULT ITEMS */}
                <div className="flex-1 flex flex-col overflow-hidden bg-slate-900">
                  {/* Context Bar for Table */}
                  <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-400 font-medium">Active View:</span>
                      <strong className="text-white">
                        {treeSelectedSupplierId === 'ALL'
                          ? 'All Vault Stock'
                          : suppliers.find((s) => s.SupplierID === treeSelectedSupplierId)?.Name || treeSelectedSupplierId}
                      </strong>
                      {treeSelectedGroup !== 'ALL' && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getGroupBadgeClass(treeSelectedGroup)}`}>
                          Group: {treeSelectedGroup}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 text-[10px] font-mono font-bold">
                        {filteredTreeVaultItems.length} batches (
                        {filteredTreeVaultItems.reduce((s, i) => s + i.Quantity, 0)} units •{' '}
                        {formatCurrency(filteredTreeVaultItems.reduce((s, i) => s + i.Quantity * i.CostPrice, 0))})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {treeSelectedSupplierId !== 'ALL' && (
                        <button
                          onClick={() => handleStartOutInvoiceFromTree(treeSelectedSupplierId, undefined, treeSelectedGroup)}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Create Out-Invoice for this Filter</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Maximum Rows Table Container */}
                  <div className="flex-1 overflow-y-auto">
                    {filteredTreeVaultItems.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                        <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 mb-3 text-blue-400">
                          <Boxes className="w-10 h-10" />
                        </div>
                        <h4 className="text-base font-bold text-white mb-1">
                          No Expired Medicine Found
                        </h4>
                        <p className="text-xs text-slate-400 max-w-md mb-4">
                          {treeSearch
                            ? `No vault items matched "${treeSearch}".`
                            : 'There are currently no expired items waiting in the vault for the selected supplier/group filter.'}
                        </p>
                        <button
                          onClick={() => setIsSendToVaultModalOpen(true)}
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Send Near-Expiry Active Medicine to Vault</span>
                        </button>
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        {/* Sticky Header */}
                        <thead className="sticky top-0 bg-slate-950 z-10 border-b border-slate-800 shadow-sm text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <tr>
                            <th className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} w-8 text-center`}>
                              <input
                                type="checkbox"
                                checked={
                                  selectedVaultBatchIds.size === filteredTreeVaultItems.length &&
                                  filteredTreeVaultItems.length > 0
                                }
                                onChange={handleToggleSelectAll}
                                className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                                title="Select All"
                              />
                            </th>
                            <th className={`px-2 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} w-8 text-slate-500`}>#</th>
                            <th className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'}`}>Medicine & Generic</th>
                            <th className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-center`}>Group</th>
                            <th className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'}`}>Batch #</th>
                            <th className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-center`}>Expiry Date</th>
                            <th className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'}`}>Supplier & Contact</th>
                            <th className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-center`}>Call Status</th>
                            <th className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-center`}>Vault Qty</th>
                            <th className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-right`}>Cost (৳)</th>
                            <th className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-right`}>Total (৳)</th>
                            <th className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-center`}>Actions</th>
                          </tr>
                        </thead>

                        {/* High-Density Maximum Row Body */}
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                          {filteredTreeVaultItems.map((item, idx) => {
                            const supp = suppliers.find((s) => s.SupplierID === item.SupplierID);
                            const isSelected = selectedVaultBatchIds.has(item.VaultID);
                            const isExpiredAlready = item.ExpiryDate ? new Date(item.ExpiryDate) < new Date() : true;

                            return (
                              <tr
                                key={item.VaultID}
                                className={`transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-950/40 hover:bg-blue-950/60'
                                    : 'hover:bg-slate-900/80'
                                }`}
                                onClick={() => handleToggleSelectOne(item.VaultID)}
                              >
                                {/* Checkbox */}
                                <td
                                  className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-center`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelectOne(item.VaultID)}
                                    className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                                  />
                                </td>

                                {/* # Index */}
                                <td className={`px-2 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-[10px] text-slate-500 font-mono`}>
                                  {idx + 1}
                                </td>

                                {/* Medicine Trade Name & Generic */}
                                <td className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} font-sans`}>
                                  <div className="font-bold text-white text-xs truncate max-w-[220px]">
                                    {item.TradeName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[220px]">
                                    {item.GenericName}
                                  </div>
                                </td>

                                {/* Group Badge */}
                                <td className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-center font-sans`}>
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${getGroupBadgeClass(
                                      item.Group
                                    )}`}
                                  >
                                    {item.Group || 'General'}
                                  </span>
                                </td>

                                {/* Batch Number */}
                                <td className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-amber-300 font-bold text-xs`}>
                                  {item.BatchNumber}
                                </td>

                                {/* Expiry Date */}
                                <td className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-center font-sans`}>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      isExpiredAlready
                                        ? 'bg-red-950/80 border-red-800 text-red-300'
                                        : 'bg-amber-950/80 border-amber-800 text-amber-300'
                                    }`}
                                  >
                                    {item.ExpiryDate || 'Expired'}
                                  </span>
                                </td>

                                {/* Supplier & Contact */}
                                <td className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} font-sans`}>
                                  <div className="text-white text-xs truncate max-w-[160px] font-medium">
                                    {item.SupplierName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                                    <Phone className="w-2.5 h-2.5 text-slate-500" />
                                    <span>{item.SupplierPhone || supp?.Phone || 'N/A'}</span>
                                  </div>
                                </td>

                                {/* Call Status */}
                                <td className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-center font-sans`}>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                      item.CallStatus === 'ScheduledVisit'
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                        : item.CallStatus === 'Called'
                                        ? 'bg-blue-950 text-blue-300 border-blue-800'
                                        : 'bg-slate-900 text-slate-400 border-slate-800'
                                    }`}
                                  >
                                    {item.CallStatus || 'Not Called'}
                                  </span>
                                </td>

                                {/* In Vault Quantity */}
                                <td className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-center font-bold text-amber-400 text-xs`}>
                                  {item.Quantity}
                                </td>

                                {/* Unit Cost */}
                                <td className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-right text-slate-300 text-xs`}>
                                  {formatCurrency(item.CostPrice)}
                                </td>

                                {/* Total Valuation */}
                                <td className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-right font-bold text-white text-xs`}>
                                  {formatCurrency(item.Quantity * item.CostPrice)}
                                </td>

                                {/* Row Actions */}
                                <td
                                  className={`px-2.5 ${isMaxRowsView ? 'py-1.5' : 'py-2.5'} text-center font-sans`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => {
                                        if (supp) handleOpenCallModal(supp);
                                      }}
                                      title="Call Supplier Representative"
                                      className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition"
                                    >
                                      <PhoneCall className="w-3 h-3 text-blue-400" />
                                    </button>

                                    <button
                                      onClick={() => handleStartOutInvoiceFromTree(item.SupplierID, item)}
                                      title="Create Out-Invoice with this item"
                                      className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold flex items-center gap-1 shadow-xs transition"
                                    >
                                      <FileText className="w-2.5 h-2.5" />
                                      <span>Out-Inv</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: EXPIRE OUT-INVOICE MAIN GRID */}
          {activeTab === 'out_invoice' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Notice Bar */}
              <div className="px-4 py-2 bg-amber-950/30 border-b border-amber-800/40 flex items-center justify-between text-xs text-amber-200">
                <span className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    <strong>Strict Vault Restriction:</strong> You can only add items currently kept in the vault for <strong>{activeSupplier.Name}</strong>. Use the Child Window on the right.
                  </span>
                </span>
                {eligibleVaultItems.length > 0 && outLines.length === 0 && (
                  <button
                    onClick={handleAddAllEligibleVaultItems}
                    className="text-xs text-amber-300 hover:text-white underline font-bold"
                  >
                    + Add All {eligibleVaultItems.length} Waiting Vault Items
                  </button>
                )}
              </div>

              {/* Grid Table */}
              <div className="flex-1 overflow-y-auto p-4">
                {outLines.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                    <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 mb-3 text-amber-400">
                      <FileText className="w-10 h-10" />
                    </div>
                    <h4 className="text-base font-bold text-white mb-1">
                      No Vault Items in Out-Invoice
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md mb-4">
                      Select items from the <strong>Add Vault Item Child Window</strong> on the right to return quarantined stock to {activeSupplier.Name}.
                    </p>
                    {eligibleVaultItems.length > 0 && (
                      <button
                        onClick={handleAddAllEligibleVaultItems}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-amber-900/30"
                      >
                        Add All {eligibleVaultItems.length} Waiting Vault Items ({activeSupplier.Name})
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-3 w-10">#</th>
                          <th className="py-3 px-3">Medicine & Generic</th>
                          <th className="py-3 px-3">Batch #</th>
                          <th className="py-3 px-3 text-center">Expiry</th>
                          <th className="py-3 px-3 text-center">In Vault</th>
                          <th className="py-3 px-3 text-center w-32">Return Qty</th>
                          <th className="py-3 px-3 text-right">Unit Cost (৳)</th>
                          <th className="py-3 px-3 text-right">Subtotal (৳)</th>
                          <th className="py-3 px-3 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {outLines.map((line, idx) => (
                          <tr key={line.vaultId} className="hover:bg-slate-900/60 transition-colors">
                            <td className="py-2.5 px-3 text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-sans">
                              <div className="font-bold text-white">{line.tradeName}</div>
                              <div className="text-[10px] text-slate-400">{line.genericName}</div>
                            </td>
                            <td className="py-2.5 px-3 text-amber-300 font-bold">{line.batchNumber}</td>
                            <td className="py-2.5 px-3 text-center text-slate-400">{line.expiryDate}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-slate-300">
                              {line.availableInVault}
                            </td>
                            <td className="py-2.5 px-3 text-center font-sans">
                              <input
                                type="number"
                                min={1}
                                max={line.availableInVault}
                                value={line.returnQty}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  const clamped = Math.max(1, Math.min(val, line.availableInVault));
                                  setOutLines((prev) =>
                                    prev.map((l, i) =>
                                      i === idx
                                        ? {
                                            ...l,
                                            returnQty: clamped,
                                            totalCost: Math.round(clamped * l.costPrice * 100) / 100,
                                          }
                                        : l
                                    )
                                  );
                                }}
                                className="w-16 bg-slate-900 border border-slate-700 rounded py-1 text-center font-mono font-bold text-white text-xs focus:outline-none focus:border-amber-500"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-300">
                              {formatCurrency(line.costPrice)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-amber-300 text-sm">
                              {formatCurrency(line.totalCost)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => setOutLines((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bottom Summary & Confirmation Bar (Same as Purchase) */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[11px] text-slate-400 block uppercase font-semibold">Total Items</span>
                    <span className="text-base font-bold text-white">{outLines.length} batches</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block uppercase font-semibold">Total Returning</span>
                    <span className="text-base font-bold text-white font-mono">{totalOutUnits} units</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block uppercase font-semibold">Total Out-Invoice Value</span>
                    <span className="text-xl font-extrabold text-amber-400 font-mono">
                      {formatCurrency(totalOutAmount)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {outLines.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setOutLines([])}
                      className="px-3 py-2 text-xs text-red-400 hover:text-red-300 font-medium"
                    >
                      Clear Grid
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleConfirmOutInvoice}
                    disabled={outLines.length === 0}
                    className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${
                      outLines.length > 0
                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40 cursor-pointer'
                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm & Generate Expire Out-Invoice ({formatCurrency(totalOutAmount)})</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EXPIRE IN-INVOICE (GOODS EXCHANGE) MAIN GRID */}
          {activeTab === 'in_invoice' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Reference Bar for Exchanging Out-Invoice */}
              <div className="px-4 py-2 bg-emerald-950/30 border-b border-emerald-800/40 flex items-center justify-between text-xs text-emerald-200">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-300">Exchanging Against Out-Invoice:</span>
                  {pendingOutInvoices.length === 0 ? (
                    <span className="text-amber-400">No pending Out-Invoices found.</span>
                  ) : (
                    <select
                      value={selectedOutInvoiceForExchange}
                      onChange={(e) => {
                        setSelectedOutInvoiceForExchange(e.target.value);
                        setInLines([]);
                      }}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-amber-300 font-mono font-bold focus:outline-none"
                    >
                      {pendingOutInvoices.map((tx) => (
                        <option key={tx.TransactionID} value={tx.VoucherNumber}>
                          {tx.VoucherNumber} • {tx.SupplierName} ({formatCurrency(tx.TotalAmount)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {activeOutInvoiceRecord && (
                  <button
                    onClick={handleAutoFillExchangeLines}
                    className="text-xs text-emerald-400 hover:text-white underline font-bold flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Auto-Fill Lines Matching Returned Items
                  </button>
                )}
              </div>

              {/* Grid Table */}
              <div className="flex-1 overflow-y-auto p-4">
                {inLines.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                    <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700/60 mb-3 text-emerald-400">
                      <ArrowRightLeft className="w-10 h-10" />
                    </div>
                    <h4 className="text-base font-bold text-white mb-1">
                      No Replacement Medicines in In-Invoice
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md mb-4">
                      When the supplier brings fresh goods for exchange, input them using the Child Window on the right, or click Auto-Fill below.
                    </p>
                    {activeOutInvoiceRecord && (
                      <button
                        onClick={handleAutoFillExchangeLines}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors shadow-lg shadow-emerald-900/30 flex items-center gap-2"
                      >
                        <Sparkles className="w-4 h-4" />
                        Auto-Fill Replacement Lines from #{activeOutInvoiceRecord.VoucherNumber}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-3 px-3 w-10">#</th>
                          <th className="py-3 px-3">Good Replacement Medicine</th>
                          <th className="py-3 px-3 w-32">Fresh Batch #</th>
                          <th className="py-3 px-3 w-36">Fresh Expiry Date</th>
                          <th className="py-3 px-3 text-center w-24">Quantity</th>
                          <th className="py-3 px-3 text-right w-24">Cost Price (৳)</th>
                          <th className="py-3 px-3 text-right w-24">Retail MRP (৳)</th>
                          <th className="py-3 px-3 text-right">Subtotal (৳)</th>
                          <th className="py-3 px-3 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono">
                        {inLines.map((line, idx) => (
                          <tr key={line.lineId} className="hover:bg-slate-900/60 transition-colors">
                            <td className="py-2.5 px-3 text-slate-500">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-sans">
                              <div className="font-bold text-white">{line.tradeName}</div>
                              <div className="text-[10px] text-slate-400">{line.genericName}</div>
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={line.batchNumber}
                                onChange={(e) =>
                                  setInLines((prev) =>
                                    prev.map((l, i) => (i === idx ? { ...l, batchNumber: e.target.value.toUpperCase() } : l))
                                  )
                                }
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-300 font-bold focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3">
                              <input
                                type="date"
                                value={line.expiryDate}
                                onChange={(e) =>
                                  setInLines((prev) =>
                                    prev.map((l, i) => (i === idx ? { ...l, expiryDate: e.target.value } : l))
                                  )
                                }
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min={1}
                                value={line.quantity}
                                onChange={(e) => {
                                  const q = parseInt(e.target.value) || 1;
                                  setInLines((prev) =>
                                    prev.map((l, i) =>
                                      i === idx ? { ...l, quantity: q, totalCost: Math.round(q * l.costPrice * 100) / 100 } : l
                                    )
                                  );
                                }}
                                className="w-16 bg-slate-900 border border-slate-700 rounded py-1 text-center font-bold text-white text-xs focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={line.costPrice}
                                onChange={(e) => {
                                  const c = parseFloat(e.target.value) || 0;
                                  setInLines((prev) =>
                                    prev.map((l, i) =>
                                      i === idx ? { ...l, costPrice: c, totalCost: Math.round(l.quantity * c * 100) / 100 } : l
                                    )
                                  );
                                }}
                                className="w-20 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-right text-xs text-white focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={line.sellingPrice}
                                onChange={(e) => {
                                  const s = parseFloat(e.target.value) || 0;
                                  setInLines((prev) => prev.map((l, i) => (i === idx ? { ...l, sellingPrice: s } : l)));
                                }}
                                className="w-20 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-right text-xs text-emerald-300 focus:outline-none"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-400 text-sm">
                              {formatCurrency(line.totalCost)}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => setInLines((prev) => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 text-slate-500 hover:text-red-400 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bottom Summary Bar for In-Invoice */}
              <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[11px] text-slate-400 block uppercase font-semibold">Out-Invoice Value</span>
                    <span className="text-sm font-bold text-amber-400 font-mono">
                      {formatCurrency(activeOutInvoiceRecord?.TotalAmount || 0)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block uppercase font-semibold">Replacement Value</span>
                    <span className="text-sm font-bold text-emerald-400 font-mono">
                      {formatCurrency(totalInAmount)} ({totalInUnits} units)
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block uppercase font-semibold">Stock Integration</span>
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Auto-increments active inventory
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {inLines.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setInLines([])}
                      className="px-3 py-2 text-xs text-red-400 hover:text-red-300 font-medium"
                    >
                      Clear Lines
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleConfirmInInvoice}
                    disabled={inLines.length === 0}
                    className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg ${
                      inLines.length > 0
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 cursor-pointer'
                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirm In-Invoice & Increment Active Stock</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CASH SETTLEMENT AGAINST OUT-INVOICE */}
          {activeTab === 'cash_settlement' && (
            <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
              <div className="w-full max-w-3xl space-y-6">
                {/* Search Bar to open Out-Invoice */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Open Out-Invoice by Number to Add Cash
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="text"
                        value={cashSearchInvoiceNum}
                        onChange={(e) => setCashSearchInvoiceNum(e.target.value)}
                        placeholder="Type Out-Invoice number (e.g. RET-2026-0102, EXP-OUT-2026-0101)..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-green-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveCashInvoiceNum(cashSearchInvoiceNum)}
                      className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold"
                    >
                      Open Invoice
                    </button>
                  </div>
                </div>

                {/* Out-Invoice Details & Direct Cash Input */}
                {activeCashOutInvoice ? (
                  <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white font-mono">
                            {activeCashOutInvoice.VoucherNumber}
                          </h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            {activeCashOutInvoice.Status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Supplier: <strong className="text-white">{activeCashOutInvoice.SupplierName}</strong> • Date: {new Date(activeCashOutInvoice.TransactionDate).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 uppercase font-semibold block">Remaining Due</span>
                        <span className="text-2xl font-black text-amber-400 font-mono">
                          {formatCurrency(
                            activeCashOutInvoice.DueBalance !== undefined
                              ? activeCashOutInvoice.DueBalance
                              : activeCashOutInvoice.TotalAmount - (activeCashOutInvoice.PaidAmount || 0)
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Cash Form */}
                    <form onSubmit={handleConfirmCashBack} className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Cash Amount to Add (৳)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={cashAmountInput}
                            onChange={(e) => setCashAmountInput(parseFloat(e.target.value) || 0)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-base font-mono font-bold text-green-400 focus:outline-none focus:border-green-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">
                            Payment Method
                          </label>
                          <select
                            value={cashPaymentMethod}
                            onChange={(e) => setCashPaymentMethod(e.target.value as any)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500"
                          >
                            <option value="Cash">Cash (Counter Register)</option>
                            <option value="Bank Transfer">Bank Wire / Electronic Deposit</option>
                            <option value="MFS">MFS (bKash / Nagad / Rocket)</option>
                            <option value="Cheque">Bank Cheque</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Payment Notes / Remarks
                        </label>
                        <input
                          type="text"
                          value={cashNotes}
                          onChange={(e) => setCashNotes(e.target.value)}
                          placeholder="e.g. Received counter cash from representative..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500"
                        />
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-green-900/40"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Add Cash Directly Against Out-Invoice ({formatCurrency(cashAmountInput)})</span>
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    No Out-Invoice found. Type invoice number above.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: INVOICES REGISTER / HISTORY */}
          {activeTab === 'register' && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col">
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60 shadow-sm flex-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-3">Invoice #</th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Supplier</th>
                      <th className="py-3 px-3">Items Returned</th>
                      <th className="py-3 px-3 text-right">Invoice Value</th>
                      <th className="py-3 px-3 text-right">Paid / Refunded</th>
                      <th className="py-3 px-3 text-center">Status</th>
                      <th className="py-3 px-3 text-center">Print Slip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {expireTransactions.map((tx) => (
                      <tr key={tx.TransactionID} className="hover:bg-slate-900/60">
                        <td className="py-3 px-3 font-bold text-amber-300">{tx.VoucherNumber}</td>
                        <td className="py-3 px-3 text-slate-400 text-[11px]">
                          {new Date(tx.TransactionDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 font-sans font-semibold text-white">{tx.SupplierName}</td>
                        <td className="py-3 px-3 font-sans text-slate-300">
                          {tx.Items.length} batches ({tx.TotalQuantity} units)
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-white">
                          {formatCurrency(tx.TotalAmount)}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-400">
                          {formatCurrency(tx.PaidAmount || 0)}
                        </td>
                        <td className="py-3 px-3 text-center font-sans">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              tx.Status === 'Settled'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            }`}
                          >
                            {tx.Status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-sans">
                          <button
                            onClick={() => setSlipOutInvoice(tx)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>

        {/* =========================================================================
            RIGHT-SIDE CHILD WINDOW: DOCKED ADD ITEM PANEL (SAME AS PURCHASE SYSTEM)
            ========================================================================= */}
        {isChildWindowOpen && (
          <aside className="w-80 md:w-96 bg-slate-950 border-l border-slate-800 flex flex-col shrink-0 shadow-2xl animate-in slide-in-from-right-4 duration-150">
            {/* Child Window Header */}
            <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    {activeTab === 'out_invoice'
                      ? 'Add Vault Item (Child Window)'
                      : activeTab === 'in_invoice'
                      ? 'Add Fresh Medicine (Child Window)'
                      : 'Child Window Helper'}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    {activeTab === 'out_invoice'
                      ? 'Input ONLY items from vault'
                      : 'Input goods for exchange'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsChildWindowOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Child Window Body for Out-Invoice: Pick from Vault ONLY */}
            {activeTab === 'out_invoice' && (
              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                <div className="p-2.5 bg-amber-950/40 border border-amber-500/30 rounded-lg text-[11px] text-amber-200">
                  🔒 <strong>Strict Vault Rule:</strong> Only stock quarantined in the Expire Vault for <strong>{activeSupplier.Name}</strong> can be added here.
                </div>

                {/* Search Vault Items for Selected Supplier */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Search Vault Items ({eligibleVaultItems.length} available)
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      ref={vaultItemSearchInputRef}
                      type="text"
                      value={childVaultSearch}
                      onChange={(e) => setChildVaultSearch(e.target.value)}
                      placeholder="Search vault items by name or batch..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                {/* Dropdown / List of Vault Items */}
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                  {filteredChildVaultItems.length === 0 ? (
                    <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-lg text-center text-xs text-slate-500">
                      No items waiting in vault for {activeSupplier.Name}.
                    </div>
                  ) : (
                    filteredChildVaultItems.map((item) => {
                      const isSelected = selectedVaultItem?.VaultID === item.VaultID;
                      return (
                        <div
                          key={item.VaultID}
                          onClick={() => handleSelectVaultItemInChild(item)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                            isSelected
                              ? 'bg-amber-950/40 border-amber-500'
                              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex justify-between font-bold text-white">
                            <span className="truncate max-w-[180px]">{item.TradeName}</span>
                            <span className="font-mono text-emerald-400">{formatCurrency(item.CostPrice)}</span>
                          </div>
                          <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                            <span className="text-amber-300">Batch: {item.BatchNumber}</span>
                            <span>In Vault: <strong className="text-white">{item.Quantity} units</strong></span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Selected Vault Item Details & Return Qty */}
                {selectedVaultItem && (
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-semibold">Selected Item</span>
                      <p className="text-xs font-bold text-white">{selectedVaultItem.TradeName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        Batch: {selectedVaultItem.BatchNumber} • Exp: {selectedVaultItem.ExpiryDate || 'Expired'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Return Quantity (Max: {selectedVaultItem.Quantity})
                      </label>
                      <input
                        ref={outQtyInputRef}
                        type="number"
                        min={1}
                        max={selectedVaultItem.Quantity}
                        value={childOutQty}
                        onChange={(e) => setChildOutQty(parseInt(e.target.value) || 1)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddVaultLine();
                          }
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
                      <span className="text-slate-400">Line Subtotal:</span>
                      <strong className="text-amber-400 font-mono text-sm">
                        {formatCurrency(childOutQty * selectedVaultItem.CostPrice)}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddVaultLine}
                      className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add to Out-Invoice Rows (Enter)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Child Window Body for In-Invoice: Input Fresh Replacement Goods */}
            {activeTab === 'in_invoice' && (
              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-[11px] text-emerald-200">
                  ✓ <strong>Goods Exchange:</strong> Input the replacement medicines brought by the supplier. These will be added directly into inventory stock.
                </div>

                {/* Search Medicine Catalog */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Search Replacement Medicine
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      ref={inMedSearchInputRef}
                      type="text"
                      value={childInMedSearch}
                      onChange={(e) => setChildInMedSearch(e.target.value)}
                      placeholder="Type medicine name to receive..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Filtered catalog medicines */}
                {filteredCatalogMedicines.length > 0 && !selectedInMed && (
                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900 divide-y divide-slate-800">
                    {filteredCatalogMedicines.map((med) => (
                      <div
                        key={med.MedicineID}
                        onClick={() => handleSelectInMed(med)}
                        className="p-2 hover:bg-slate-800 cursor-pointer flex justify-between items-center text-xs"
                      >
                        <div>
                          <div className="font-bold text-white">{med.TradeName}</div>
                          <div className="text-[10px] text-slate-400">{med.GenericName}</div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-400">+ Select</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Replacement Inputs */}
                {selectedInMed && (
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                    <div>
                      <span className="text-[10px] text-slate-400 block uppercase font-semibold">Selected Medicine</span>
                      <p className="text-xs font-bold text-white">{selectedInMed.TradeName}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Fresh Batch #</label>
                        <input
                          type="text"
                          value={childInBatchNum}
                          onChange={(e) => setChildInBatchNum(e.target.value.toUpperCase())}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-300 font-bold focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Fresh Expiry</label>
                        <input
                          type="date"
                          value={childInExpiry}
                          onChange={(e) => setChildInExpiry(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Qty</label>
                        <input
                          type="number"
                          min={1}
                          value={childInQty}
                          onChange={(e) => setChildInQty(parseInt(e.target.value) || 1)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white font-bold text-center focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">Cost (৳)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={childInCostPrice}
                          onChange={(e) => setChildInCostPrice(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white text-right focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">MRP (৳)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={childInSellingPrice}
                          onChange={(e) => setChildInSellingPrice(parseFloat(e.target.value) || 0)}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-300 text-right focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddInLine}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Replacement Medicine (Enter)</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Child Window Body for Vault Stock & Supplier Tree */}
            {activeTab === 'vault_tree' && (
              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                <div className="p-2.5 bg-blue-950/40 border border-blue-500/30 rounded-lg text-[11px] text-blue-200">
                  📁 <strong>Vault Tree Helper:</strong> Select a supplier to inspect waiting batches, log calls with their representative, or click <strong>Create Out-Invoice</strong> when they arrive.
                </div>

                {treeSelectedSupplierId !== 'ALL' ? (
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-3">
                    <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                      Selected Supplier
                    </span>
                    <p className="text-xs font-bold text-white">
                      {suppliers.find((s) => s.SupplierID === treeSelectedSupplierId)?.Name}
                    </p>

                    <div className="space-y-1.5 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Waiting Batches:</span>
                        <strong className="font-mono text-white">
                          {filteredTreeVaultItems.length}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Total Value:</span>
                        <strong className="font-mono text-amber-300">
                          {formatCurrency(
                            filteredTreeVaultItems.reduce((s, v) => s + v.Quantity * v.CostPrice, 0)
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="pt-2 space-y-2">
                      <button
                        onClick={() => handleStartOutInvoiceFromTree(treeSelectedSupplierId)}
                        className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md transition"
                      >
                        <FileText className="w-4 h-4" />
                        <span>Assemble Out-Invoice for This Supplier</span>
                      </button>

                      {suppliers.find((s) => s.SupplierID === treeSelectedSupplierId) && (
                        <button
                          onClick={() =>
                            handleOpenCallModal(
                              suppliers.find((s) => s.SupplierID === treeSelectedSupplierId)!
                            )
                          }
                          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"
                        >
                          <PhoneCall className="w-4 h-4 text-emerald-400" />
                          <span>Log / Schedule Call with Representative</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
                    <p>Click on any supplier in the <strong>Supplier Tree</strong> to filter their waiting stock and take fast actions.</p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={() => setIsSendToVaultModalOpen(true)}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Send Near-Expiry Active Medicine to Vault</span>
                  </button>
                </div>
              </div>
            )}

            {/* Other modes placeholder */}
            {(activeTab === 'cash_settlement' || activeTab === 'register') && (
              <div className="p-4 text-center text-slate-400 text-xs">
                Switch to <strong>Expire Out-Invoice</strong> or <strong>Expire In-Invoice</strong> to use the Child Window.
              </div>
            )}
          </aside>
        )}
      </div>

      {/* QUICK CHILD MODAL: SEND MEDICINE TO VAULT */}
      {isSendToVaultModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Send Active Medicine to Expire Vault</h3>
              </div>
              <button
                onClick={() => setIsSendToVaultModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Search Active Inventory to Quarantine
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={vaultModalSearch}
                    onChange={(e) => setVaultModalSearch(e.target.value)}
                    placeholder="Search by trade name, generic, or batch..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Batches matching search */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {availableBatchesForVault.map((item) => {
                  const isSelected = vaultModalSelectedBatch?.BatchID === item.batch.BatchID;
                  return (
                    <div
                      key={item.batch.BatchID}
                      onClick={() => {
                        setVaultModalSelectedBatch(item.batch);
                        setVaultModalSelectedMed(item.medicine);
                        setVaultModalQty(Math.min(10, item.batch.CurrentStock));
                      }}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        isSelected
                          ? 'bg-amber-950/40 border-amber-500'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between font-bold text-white">
                        <span>{item.medicine.TradeName}</span>
                        <span className="font-mono text-emerald-400">{formatCurrency(item.batch.CostPrice)}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-400 mt-1 font-mono">
                        <span className="text-amber-300">Batch: {item.batch.BatchNumber} (Exp: {item.batch.ExpiryDate})</span>
                        <span>Stock: <strong className="text-white">{item.batch.CurrentStock} units</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {vaultModalSelectedBatch && vaultModalSelectedMed && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Quantity to Move to Vault (Max: {vaultModalSelectedBatch.CurrentStock})
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={vaultModalSelectedBatch.CurrentStock}
                      value={vaultModalQty}
                      onChange={(e) => setVaultModalQty(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Reason / Quarantine Notes
                    </label>
                    <input
                      type="text"
                      value={vaultModalReason}
                      onChange={(e) => setVaultModalReason(e.target.value)}
                      placeholder="e.g. Expired batch segregated for supplier return"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSendToVaultModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSendToVault}
                  disabled={!vaultModalSelectedBatch}
                  className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    vaultModalSelectedBatch
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Transfer to Expire Vault</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CALL SUPPLIER MODAL */}
      {isCallModalOpen && callModalSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Call Supplier Representative</h3>
              </div>
              <button
                onClick={() => setIsCallModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="text-slate-400">
                  Supplier: <strong className="text-white">{callModalSupplier.Name}</strong>
                </div>
                <div className="text-slate-400">
                  Official Phone:{' '}
                  <strong className="text-amber-300 font-mono">
                    {callModalSupplier.Phone || 'N/A'}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Representative Name
                  </label>
                  <input
                    type="text"
                    value={callModalRepName}
                    onChange={(e) => setCallModalRepName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={callModalPhone}
                    onChange={(e) => setCallModalPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Call Outcome Status
                  </label>
                  <select
                    value={callModalStatus}
                    onChange={(e) => setCallModalStatus(e.target.value as SupplierCallStatus)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-blue-500"
                  >
                    <option value="Called">Called (Spoke with Rep)</option>
                    <option value="ScheduledVisit">Scheduled Visit (Promised)</option>
                    <option value="AwaitingArrival">Awaiting Arrival</option>
                    <option value="NotCalled">Not Called</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Scheduled Visit Date
                  </label>
                  <input
                    type="date"
                    value={callModalVisitDate}
                    onChange={(e) => setCallModalVisitDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Call Notes / Agreed Terms
                </label>
                <textarea
                  rows={3}
                  value={callModalNotes}
                  onChange={(e) => setCallModalNotes(e.target.value)}
                  placeholder="e.g. Rep Mr. Rahman agreed to visit on Thursday to pick up expired stock and exchange with good medicine / cash refund."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCallModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCallModal}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-900/30"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Call Log & Status</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT SLIP MODALS */}
      <ExpireOutInvoiceSlipModal
        isOpen={!!slipOutInvoice}
        onClose={() => setSlipOutInvoice(null)}
        outInvoice={slipOutInvoice}
      />

      <ExpireInInvoiceSlipModal
        isOpen={!!slipInInvoice}
        onClose={() => setSlipInInvoice(null)}
        inInvoice={slipInInvoice}
      />

      <CashRefundSlipModal
        isOpen={!!slipCashReceipt}
        onClose={() => setSlipCashReceipt(null)}
        outInvoice={slipCashInvoice}
        paymentRecord={slipCashReceipt}
      />
    </div>
  );
};
