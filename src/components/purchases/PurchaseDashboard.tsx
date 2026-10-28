/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Module D: Fast Purchase Dashboard & Cost Price Calculation Formula Engine
 * 
 * Enhanced Layout & Features:
 * - Left side Navigation panel automatically closes on opening New Purchase Order
 * - Purchase & Fast Procurement Handler moves all the way left to maximize workspace
 * - Add Medicine Child Window opens docked on the RIGHT side of the procurement grid
 * - Maximum row visibility in draft purchase items grid
 * - Newly added medicines always appear at the bottom of the rows with auto-scroll to bottom
 * - Rapid keyboard progression: Med Search [↓/↑ + Enter] -> Qty [Enter] -> TP [Enter to Add & Loop]
 * - Blank VAT % and Discount % fully permitted (defaults to 0%)
 * - Exact Formula Engine: Cost Price = (TP + VAT Amount) - Discount Amount
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { PurchaseItem, Purchase, DraftPurchase, Supplier, Medicine } from '../../types/pharmacy';
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
  UserCheck,
  ShieldCheck,
} from 'lucide-react';

export const PurchaseDashboard: React.FC = () => {
  const {
    suppliers,
    medicines,
    purchases,
    draftPurchases,
    groups,
    users,
    currentUser,
    processPurchase,
    saveDraftPurchase,
    deleteDraftPurchase,
    confirmDraftPurchase,
    showToast,
    currencySymbol,
    formatCurrency,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    toggleSidebar,
  } = usePharmacy();

  // Active view: 'new' or 'history'
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  // Sub-filter for history/register: 'all' | 'drafts' | 'confirmed'
  const [purchaseListFilter, setPurchaseListFilter] = useState<'all' | 'drafts' | 'confirmed'>('all');
  // Track if currently editing a saved draft
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<string>('');
  const [searchRegisterQuery, setSearchRegisterQuery] = useState<string>('');
  // Modals for inspecting details
  const [selectedDraftForModal, setSelectedDraftForModal] = useState<DraftPurchase | null>(null);
  const [selectedPurchaseForModal, setSelectedPurchaseForModal] = useState<Purchase | null>(null);

  // Left side Navigation panel will close automatically when I open new purchase order
  useEffect(() => {
    if (activeTab === 'new') {
      setIsSidebarCollapsed(true);
    }
  }, [activeTab, setIsSidebarCollapsed]);

  // Supplier Selection & Searchable Dropdown state
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>(
    suppliers[0]?.SupplierID || ''
  );
  const [supplierSearchText, setSupplierSearchText] = useState<string>('');
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState<boolean>(false);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.SupplierID === selectedSupplierId) || suppliers[0],
    [suppliers, selectedSupplierId]
  );

  // Map supplier IDs to names
  const supplierMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((s) => map.set(s.SupplierID, s.Name));
    return map;
  }, [suppliers]);

  // Filtered suppliers for combobox
  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchText.trim()) return suppliers;
    const query = supplierSearchText.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.Name.toLowerCase().includes(query) ||
        s.SupplierID.toLowerCase().includes(query) ||
        s.Phone.toLowerCase().includes(query) ||
        s.Address.toLowerCase().includes(query)
    );
  }, [suppliers, supplierSearchText]);

  // Close supplier dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(e.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Staff / User Verifier Searchable Dropdown State for Complete Audit Trail
  const defaultVerifier = useMemo(() => {
    if (currentUser) {
      return `${currentUser.FullName} (${currentUser.Role})`;
    }
    const mgr = users.find((u) => u.Role === 'Moderator') || users[0];
    return mgr ? `${mgr.FullName} (${mgr.Role})` : 'Sajid Karim (Inventory & Purchase Manager)';
  }, [currentUser, users]);

  const [selectedVerifier, setSelectedVerifier] = useState<string>(defaultVerifier);
  const [verifierSearchText, setVerifierSearchText] = useState<string>('');
  const [isVerifierDropdownOpen, setIsVerifierDropdownOpen] = useState<boolean>(false);
  const verifierDropdownRef = useRef<HTMLDivElement>(null);

  // Sync defaultVerifier
  useEffect(() => {
    if (!selectedVerifier && defaultVerifier) {
      setSelectedVerifier(defaultVerifier);
    }
  }, [defaultVerifier, selectedVerifier]);

  // Close verifier dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (verifierDropdownRef.current && !verifierDropdownRef.current.contains(e.target as Node)) {
        setIsVerifierDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Available staff verifiers for complete audit accountability
  const availableVerifiers = useMemo(() => {
    const list: { id: string; name: string; role: string; fullLabel: string }[] = users.map((u) => ({
      id: u.UserID,
      name: u.FullName,
      role: u.Role,
      fullLabel: `${u.FullName} (${u.Role})`,
    }));

    const additionalStaff = [
      { id: 'QA-01', name: 'Quality Assurance Inspector', role: 'QA Staff', fullLabel: 'Quality Assurance Inspector (QA Staff)' },
      { id: 'WH-01', name: 'Warehouse Receiving Officer', role: 'Store Keeper', fullLabel: 'Warehouse Receiving Officer (Store Keeper)' },
    ];
    additionalStaff.forEach((extra) => {
      if (!list.some((item) => item.fullLabel === extra.fullLabel)) {
        list.push(extra);
      }
    });

    return list;
  }, [users]);

  // Filtered staff verifiers for combobox
  const filteredVerifiers = useMemo(() => {
    if (!verifierSearchText.trim()) return availableVerifiers;
    const query = verifierSearchText.toLowerCase();
    return availableVerifiers.filter(
      (v) =>
        v.name.toLowerCase().includes(query) ||
        v.role.toLowerCase().includes(query) ||
        v.id.toLowerCase().includes(query) ||
        v.fullLabel.toLowerCase().includes(query)
    );
  }, [availableVerifiers, verifierSearchText]);

  // Supplier Scope Switch: 'single' = only selected supplier's medicines, 'all' = all suppliers' medicines
  const [supplierMode, setSupplierMode] = useState<'single' | 'all'>('single');

  // Group filter for purchase (e.g. All, Cardiac, General, Herbal, Skin)
  const [selectedPurchaseGroup, setSelectedPurchaseGroup] = useState<string>('All');
  const [historyGroupFilter, setHistoryGroupFilter] = useState<string>('All');

  // Invoice Number
  const [invoiceNumber, setInvoiceNumber] = useState(
    `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
  );

  // Draft invoice items
  const [items, setItems] = useState<
    {
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
      totalCost: number;
      sourceOfDiscount: string;
    }[]
  >([]);

  // Track ID of the medicine added most recently for visual highlight
  const [lastAddedMedicineId, setLastAddedMedicineId] = useState<string | null>(null);

  // Ref to the bottom of the table to auto-scroll when a new medicine is added
  const tableBottomRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------
  // RIGHT-SIDE CHILD WINDOW: "ADD MEDICINE" DOCKED PANEL
  // -------------------------------------------------------------
  const [isAddMedicineChildOpen, setIsAddMedicineChildOpen] = useState<boolean>(true);

  // VAT and Discount in Child Window: can be kept blank!
  const [modalVat, setModalVat] = useState<string>('17.4');
  const [modalDiscount, setModalDiscount] = useState<string>('0');

  // Medicine search & dropdown in Child Window
  const [modalMedSearch, setModalMedSearch] = useState<string>('');
  const [isMedDropdownOpen, setIsMedDropdownOpen] = useState<boolean>(false);
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  const [medHighlightIndex, setMedHighlightIndex] = useState<number>(0);

  // Line item fields in Child Window
  const [modalQty, setModalQty] = useState<number | string>(50);
  const [modalTP, setModalTP] = useState<number | string>(100.0);
  const [modalBatchNum, setModalBatchNum] = useState<string>(
    `BTH-${Math.floor(100 + Math.random() * 900)}`
  );
  const [modalExpiry, setModalExpiry] = useState<string>('2028-12-31');

  // Input DOM Refs for fast Enter key progression
  const medSearchInputRef = useRef<HTMLInputElement>(null);
  const medDropdownListRef = useRef<HTMLDivElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const tpInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const expiryInputRef = useRef<HTMLInputElement>(null);

  // Candidate medicines available for selection based on supplierMode and selectedPurchaseGroup
  const candidateMedicines = useMemo(() => {
    return medicines.filter((m) => {
      // If single supplier mode, restrict to selectedSupplierId
      if (supplierMode === 'single' && m.SupplierID !== selectedSupplierId) {
        return false;
      }
      // Group filter (if not 'All')
      if (selectedPurchaseGroup !== 'All' && m.Group !== selectedPurchaseGroup) {
        return false;
      }
      return true;
    });
  }, [medicines, supplierMode, selectedSupplierId, selectedPurchaseGroup]);

  // Filtered medicines in dropdown as user types in modal search bar
  const filteredModalMedicines = useMemo(() => {
    if (!modalMedSearch.trim()) return candidateMedicines;
    const query = modalMedSearch.toLowerCase();
    return candidateMedicines.filter((m) => {
      const matchTrade = m.TradeName.toLowerCase().includes(query);
      const matchGeneric = m.GenericName.toLowerCase().includes(query);
      const matchGroup = (m.Group || '').toLowerCase().includes(query);
      const supplierName = supplierMap.get(m.SupplierID) || '';
      const matchSupplier = supplierName.toLowerCase().includes(query);
      return matchTrade || matchGeneric || matchGroup || matchSupplier;
    });
  }, [candidateMedicines, modalMedSearch, supplierMap]);

  // Keep highlighted index in bounds
  useEffect(() => {
    if (medHighlightIndex >= filteredModalMedicines.length) {
      setMedHighlightIndex(Math.max(0, filteredModalMedicines.length - 1));
    }
  }, [filteredModalMedicines, medHighlightIndex]);

  // Scroll highlighted dropdown item into view
  useEffect(() => {
    if (isMedDropdownOpen && medDropdownListRef.current) {
      const activeElement = medDropdownListRef.current.querySelector(
        `[data-med-idx="${medHighlightIndex}"]`
      ) as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [medHighlightIndex, isMedDropdownOpen]);

  // Auto-scroll the draft table to the bottom when a new medicine is added
  useEffect(() => {
    if (items.length > 0) {
      tableBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [items.length]);

  // Numeric parsed values for live formula computation
  const numericVat = modalVat.trim() === '' ? 0 : Math.max(0, parseFloat(modalVat) || 0);
  const numericDiscount = modalDiscount.trim() === '' ? 0 : Math.max(0, parseFloat(modalDiscount) || 0);
  const numericTP = typeof modalTP === 'string' ? (modalTP.trim() === '' ? 0 : parseFloat(modalTP) || 0) : modalTP;
  const numericQty = typeof modalQty === 'string' ? (modalQty.trim() === '' ? 1 : parseInt(modalQty) || 1) : modalQty;

  // Live Cost Calculation using exact formula: (TP + VAT Amount) - Discount Amount
  const liveCalculation = useMemo(() => {
    const vatAmount = Math.round(((numericTP * numericVat) / 100) * 100) / 100;
    const discountAmount = Math.round(((numericTP * numericDiscount) / 100) * 100) / 100;
    const costPrice = Math.round((numericTP + vatAmount - discountAmount) * 100) / 100;
    const lineTotal = Math.round(costPrice * numericQty * 100) / 100;
    return {
      vatAmount,
      discountAmount,
      costPrice,
      lineTotal,
    };
  }, [numericTP, numericVat, numericDiscount, numericQty]);

  // Open Child Window and set focus
  const handleOpenChildWindow = () => {
    setIsAddMedicineChildOpen(true);
    setSelectedMed(null);
    setModalMedSearch('');
    setIsMedDropdownOpen(false);
    setMedHighlightIndex(0);
    setModalBatchNum(`BTH-${Math.floor(100 + Math.random() * 900)}`);
    setModalExpiry('2028-12-31');
    setTimeout(() => {
      medSearchInputRef.current?.focus();
    }, 100);
  };

  // Close Child Window
  const handleCloseChildWindow = () => {
    setIsAddMedicineChildOpen(false);
    setIsMedDropdownOpen(false);
  };

  // Select a medicine from the dropdown list
  const handleSelectMedicine = (med: Medicine) => {
    setSelectedMed(med);
    setModalMedSearch(med.TradeName);
    setIsMedDropdownOpen(false);

    // If modalTP is empty or default 100, prefill with a sensible TP (e.g. from active MRP * 0.75)
    if (med.MRP && (!modalTP || Number(modalTP) === 100)) {
      setModalTP(Math.round(med.MRP * 0.75 * 100) / 100);
    }

    // Auto-advance focus to Quantity input immediately
    setTimeout(() => {
      qtyInputRef.current?.focus();
      qtyInputRef.current?.select();
    }, 50);
  };

  // Keyboard navigation on Medicine Search Input
  const handleMedSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsMedDropdownOpen(true);
      setMedHighlightIndex((prev) =>
        prev < filteredModalMedicines.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsMedDropdownOpen(true);
      setMedHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : Math.max(0, filteredModalMedicines.length - 1)
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredModalMedicines.length > 0 && isMedDropdownOpen) {
        handleSelectMedicine(filteredModalMedicines[medHighlightIndex]);
      } else if (filteredModalMedicines.length > 0 && !selectedMed) {
        handleSelectMedicine(filteredModalMedicines[0]);
      } else if (selectedMed) {
        qtyInputRef.current?.focus();
        qtyInputRef.current?.select();
      }
    } else if (e.key === 'Escape') {
      setIsMedDropdownOpen(false);
    }
  };

  // Fast Process Handler: Add Line Item to Invoice and show in bottom of rows
  const handleAddLineItem = () => {
    if (!selectedMed) {
      showToast('Please select a medicine from the search list.', 'warning', 'No Medicine Selected');
      medSearchInputRef.current?.focus();
      return;
    }

    if (numericQty <= 0) {
      showToast('Quantity must be greater than zero.', 'warning', 'Invalid Quantity');
      qtyInputRef.current?.focus();
      return;
    }

    const medSupplier = suppliers.find((s) => s.SupplierID === selectedMed.SupplierID) || selectedSupplier;

    const newItem = {
      medicineId: selectedMed.MedicineID,
      tradeName: selectedMed.TradeName,
      genericName: selectedMed.GenericName,
      group: selectedMed.Group || (selectedPurchaseGroup !== 'All' ? selectedPurchaseGroup : 'General'),
      supplierId: selectedMed.SupplierID || selectedSupplier.SupplierID,
      supplierName: supplierMap.get(selectedMed.SupplierID) || selectedSupplier.Name,
      batchNumber: modalBatchNum.trim().toUpperCase() || `BTH-${Date.now().toString().slice(-4)}`,
      expiryDate: modalExpiry || '2028-12-31',
      quantity: numericQty,
      tp: numericTP,
      vatPercent: numericVat,
      vatAmount: liveCalculation.vatAmount,
      discountPercent: numericDiscount,
      discountAmount: liveCalculation.discountAmount,
      costPrice: liveCalculation.costPrice,
      totalCost: liveCalculation.lineTotal,
      sourceOfDiscount: numericDiscount > 0 ? `Custom (${numericDiscount}%)` : 'None (0%)',
    };

    // Append to the bottom of the rows
    setItems((prev) => [...prev, newItem]);
    setLastAddedMedicineId(selectedMed.MedicineID);

    showToast(
      `Added ${selectedMed.TradeName} [${selectedMed.Group || 'General'}] (Qty: ${numericQty}, TP: ${formatCurrency(numericTP)}) to bottom of invoice`,
      'success',
      'Medicine Added'
    );

    // Fast Loop Handler: Reset selection, clear search, regenerate batch, refocus search input
    setSelectedMed(null);
    setModalMedSearch('');
    setIsMedDropdownOpen(false);
    setModalBatchNum(`BTH-${Math.floor(100 + Math.random() * 900)}`);
    setModalQty(50);

    setTimeout(() => {
      medSearchInputRef.current?.focus();
    }, 50);
  };

  // Global Keyboard Shortcuts (F2 = Open Child Window, Escape = Close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        if (activeTab === 'new') {
          handleOpenChildWindow();
        }
      } else if (e.key === 'Escape') {
        if (isAddMedicineChildOpen && !isMedDropdownOpen) {
          handleCloseChildWindow();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddMedicineChildOpen, isMedDropdownOpen, activeTab]);

  // Remove draft item
  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Invoice Aggregate Totals
  const totalTP = useMemo(
    () => items.reduce((sum, item) => sum + item.tp * item.quantity, 0),
    [items]
  );
  const totalVAT = useMemo(
    () => items.reduce((sum, item) => sum + item.vatAmount * item.quantity, 0),
    [items]
  );
  const totalDiscount = useMemo(
    () => items.reduce((sum, item) => sum + item.discountAmount * item.quantity, 0),
    [items]
  );
  const netCostPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.totalCost, 0),
    [items]
  );

  // Payment
  const [paidAmount, setPaidAmount] = useState<string>('');
  const numericPaid = paidAmount === '' ? netCostPrice : parseFloat(paidAmount) || 0;
  const dueAmount = Math.max(0, netCostPrice - numericPaid);

  // Confirm Purchase Invoice
  const handleConfirmPurchase = () => {
    if (items.length === 0) {
      showToast('Please add at least one medicine item to the purchase invoice.', 'warning', 'Empty Invoice');
      return;
    }

    const purchaseItems: PurchaseItem[] = items.map((item, idx) => ({
      PurchaseItemID: `PURI-${Date.now()}-${idx}`,
      PurchaseID: '',
      MedicineID: item.medicineId,
      TradeName: item.tradeName,
      BatchNumber: item.batchNumber,
      ExpiryDate: item.expiryDate,
      Quantity: item.quantity,
      TP: item.tp,
      VATPercent: item.vatPercent,
      DiscountPercent: item.discountPercent,
      DiscountAmount: item.discountAmount,
      CostPrice: item.costPrice,
      TotalCost: item.totalCost,
      Group: item.group,
      SupplierID: item.supplierId,
      SupplierName: item.supplierName,
    }));

    const result = processPurchase({
      SupplierID: selectedSupplier.SupplierID,
      SupplierName: supplierMode === 'all' ? `${selectedSupplier.Name} (Consolidated / All Suppliers)` : selectedSupplier.Name,
      InvoiceNumber: invoiceNumber,
      Group: selectedPurchaseGroup !== 'All' ? selectedPurchaseGroup : (items[0]?.group || 'General'),
      TotalTP: Math.round(totalTP * 100) / 100,
      TotalVAT: Math.round(totalVAT * 100) / 100,
      TotalDiscount: Math.round(totalDiscount * 100) / 100,
      NetCostPrice: Math.round(netCostPrice * 100) / 100,
      PaidAmount: Math.round(numericPaid * 100) / 100,
      DueAmount: Math.round(dueAmount * 100) / 100,
      PurchaseDate: new Date().toISOString(),
      Items: purchaseItems,
      SupplierMode: supplierMode,
      VerifiedBy: selectedVerifier || defaultVerifier,
    });

    if (result.success) {
      if (activeDraftId) {
        deleteDraftPurchase(activeDraftId);
        setActiveDraftId(null);
      }
      showToast(
        `Purchase Invoice ${invoiceNumber} confirmed successfully! Checked & verified by ${selectedVerifier || defaultVerifier}.`,
        'success',
        'Purchase Recorded'
      );
      setItems([]);
      setPaidAmount('');
      setDraftNotes('');
      setLastAddedMedicineId(null);
      setInvoiceNumber(
        `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
      );
      setActiveTab('history');
    } else {
      showToast(result.error || 'Failed to process purchase.', 'error', 'Purchase Failed');
    }
  };

  // Save purchase as draft for final confirmation
  const handleSaveDraftPurchase = () => {
    if (items.length === 0) {
      showToast('Please add at least one medicine item to save as draft.', 'warning', 'Empty Invoice');
      return;
    }

    const draftItems = items.map((item) => ({
      medicineId: item.medicineId,
      tradeName: item.tradeName,
      genericName: item.genericName,
      group: item.group,
      supplierId: item.supplierId,
      supplierName: item.supplierName,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate,
      quantity: item.quantity,
      tp: item.tp,
      vatPercent: item.vatPercent,
      vatAmount: item.vatAmount,
      discountPercent: item.discountPercent,
      discountAmount: item.discountAmount,
      costPrice: item.costPrice,
      totalCost: item.totalCost,
      sourceOfDiscount: item.sourceOfDiscount,
    }));

    const result = saveDraftPurchase({
      DraftID: activeDraftId || undefined,
      InvoiceNumber: invoiceNumber,
      SupplierID: selectedSupplier.SupplierID,
      SupplierName: supplierMode === 'all' ? `${selectedSupplier.Name} (Consolidated / All Suppliers)` : selectedSupplier.Name,
      SupplierMode: supplierMode,
      Group: selectedPurchaseGroup !== 'All' ? selectedPurchaseGroup : (items[0]?.group || 'General'),
      Items: draftItems,
      TotalTP: Math.round(totalTP * 100) / 100,
      TotalVAT: Math.round(totalVAT * 100) / 100,
      TotalDiscount: Math.round(totalDiscount * 100) / 100,
      NetCostPrice: Math.round(netCostPrice * 100) / 100,
      PaidAmount: Math.round(numericPaid * 100) / 100,
      DueAmount: Math.round(dueAmount * 100) / 100,
      Notes: draftNotes || 'Saved draft awaiting final confirmation',
      VerifiedBy: selectedVerifier || defaultVerifier,
    });

    if (result.success) {
      setActiveDraftId(result.draft.DraftID);
      showToast(
        `Purchase Invoice ${invoiceNumber} saved for final confirmation! Verifier: ${selectedVerifier || defaultVerifier}.`,
        'success',
        'Draft Saved'
      );
    }
  };

  // Resume / Load draft back into editor
  const handleResumeDraft = (draft: DraftPurchase) => {
    setActiveDraftId(draft.DraftID);
    setSelectedSupplierId(draft.SupplierID);
    setSupplierMode(draft.SupplierMode || 'single');
    setSelectedPurchaseGroup(draft.Group || 'All');
    setInvoiceNumber(draft.InvoiceNumber);
    setPaidAmount(draft.PaidAmount > 0 ? draft.PaidAmount.toString() : '');
    setDraftNotes(draft.Notes || '');
    if (draft.VerifiedBy) {
      setSelectedVerifier(draft.VerifiedBy);
    }
    setItems(
      draft.Items.map((item) => ({
        medicineId: item.medicineId,
        tradeName: item.tradeName,
        genericName: item.genericName,
        group: item.group,
        supplierId: item.supplierId,
        supplierName: item.supplierName,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        quantity: item.quantity,
        tp: item.tp,
        vatPercent: item.vatPercent,
        vatAmount: item.vatAmount,
        discountPercent: item.discountPercent,
        discountAmount: item.discountAmount,
        costPrice: item.costPrice,
        totalCost: item.totalCost,
        sourceOfDiscount: item.sourceOfDiscount || (item.discountPercent > 0 ? `Custom (${item.discountPercent}%)` : 'None (0%)'),
      }))
    );
    setActiveTab('new');
    setIsAddMedicineChildOpen(true);
    setSelectedDraftForModal(null);
    showToast(
      `Loaded draft invoice ${draft.InvoiceNumber} (${draft.Items.length} items). Modify and click "Confirm Order" to post to stock!`,
      'info',
      'Draft Loaded'
    );
  };

  // Direct confirmation of a saved draft from the list
  const handleDirectConfirmDraft = (draft: DraftPurchase) => {
    const res = confirmDraftPurchase(draft.DraftID);
    if (res.success) {
      showToast(
        `Draft Invoice ${draft.InvoiceNumber} confirmed & posted to inventory batches and supplier ledger!`,
        'success',
        'Purchase Confirmed'
      );
      if (activeDraftId === draft.DraftID) {
        handleStartNewOrder();
      }
      setSelectedDraftForModal(null);
    } else {
      showToast(res.error || 'Failed to confirm draft purchase.', 'error', 'Confirmation Error');
    }
  };

  // Delete draft with notification
  const handleDeleteDraft = (draftId: string) => {
    deleteDraftPurchase(draftId);
    if (activeDraftId === draftId) {
      handleStartNewOrder();
    }
    setSelectedDraftForModal(null);
    showToast('Saved draft deleted successfully.', 'info', 'Draft Deleted');
  };

  // Start fresh order
  const handleStartNewOrder = () => {
    setActiveDraftId(null);
    setItems([]);
    setPaidAmount('');
    setDraftNotes('');
    setLastAddedMedicineId(null);
    setSelectedVerifier(defaultVerifier);
    setInvoiceNumber(
      `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    );
  };

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
    return 'bg-blue-950/80 text-blue-300 border-blue-800/60';
  };

  // Summary for history
  const groupPurchasesSummary = useMemo(() => {
    const map = new Map<string, { totalAmount: number; count: number }>();
    purchases.forEach((p) => {
      const g = p.Group || 'General';
      const cur = map.get(g) || { totalAmount: 0, count: 0 };
      cur.totalAmount += p.NetCostPrice;
      cur.count += 1;
      map.set(g, cur);
    });
    return Array.from(map.entries()).map(([groupName, data]) => ({
      groupName,
      ...data,
    }));
  }, [purchases]);

  // Unified item for list display
  type PurchaseRowItem = {
    id: string;
    isDraft: boolean;
    invoiceNumber: string;
    supplierId: string;
    supplierName: string;
    group: string;
    date: string;
    totalTP: number;
    totalVAT: number;
    totalDiscount: number;
    netCostPrice: number;
    dueAmount: number;
    paidAmount: number;
    itemsCount: number;
    notes?: string;
    verifiedBy?: string;
    rawDraft?: DraftPurchase;
    rawPurchase?: Purchase;
  };

  const combinedPurchaseRows = useMemo<PurchaseRowItem[]>(() => {
    const list: PurchaseRowItem[] = [];

    // 1. Add saved drafts
    draftPurchases.forEach((d) => {
      list.push({
        id: d.DraftID,
        isDraft: true,
        invoiceNumber: d.InvoiceNumber,
        supplierId: d.SupplierID,
        supplierName: d.SupplierName,
        group: d.Group || 'General',
        date: d.SavedAt,
        totalTP: d.TotalTP,
        totalVAT: d.TotalVAT,
        totalDiscount: d.TotalDiscount,
        netCostPrice: d.NetCostPrice,
        dueAmount: d.DueAmount,
        paidAmount: d.PaidAmount,
        itemsCount: d.Items.length,
        notes: d.Notes,
        verifiedBy: d.VerifiedBy || 'Pending Staff Verification',
        rawDraft: d,
      });
    });

    // 2. Add confirmed purchases
    purchases.forEach((p) => {
      list.push({
        id: p.PurchaseID,
        isDraft: false,
        invoiceNumber: p.InvoiceNumber,
        supplierId: p.SupplierID,
        supplierName: p.SupplierName,
        group: p.Group || 'General',
        date: p.PurchaseDate,
        totalTP: p.TotalTP,
        totalVAT: p.TotalVAT,
        totalDiscount: p.TotalDiscount,
        netCostPrice: p.NetCostPrice,
        dueAmount: p.DueAmount,
        paidAmount: p.PaidAmount,
        itemsCount: p.Items.length,
        verifiedBy: p.VerifiedBy || 'Dr. Tariq Rahman (Chief Pharmacist & Admin)',
        rawPurchase: p,
      });
    });

    // Sort by date descending
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [draftPurchases, purchases]);

  const filteredCombinedRows = useMemo(() => {
    return combinedPurchaseRows.filter((row) => {
      // 1. Status Filter
      if (purchaseListFilter === 'drafts' && !row.isDraft) return false;
      if (purchaseListFilter === 'confirmed' && row.isDraft) return false;

      // 2. Group Filter
      if (historyGroupFilter !== 'All' && row.group !== historyGroupFilter) return false;

      // 3. Search Query
      if (searchRegisterQuery.trim()) {
        const q = searchRegisterQuery.toLowerCase();
        const matchInvoice = row.invoiceNumber.toLowerCase().includes(q);
        const matchSupplier = row.supplierName.toLowerCase().includes(q);
        const matchGroup = row.group.toLowerCase().includes(q);
        const matchNotes = (row.notes || '').toLowerCase().includes(q);
        const matchVerifier = (row.verifiedBy || '').toLowerCase().includes(q);
        return matchInvoice || matchSupplier || matchGroup || matchNotes || matchVerifier;
      }

      return true;
    });
  }, [combinedPurchaseRows, purchaseListFilter, historyGroupFilter, searchRegisterQuery]);

  // Drafts volume totals
  const totalDraftsAmount = useMemo(
    () => draftPurchases.reduce((sum, d) => sum + d.NetCostPrice, 0),
    [draftPurchases]
  );
  const totalConfirmedAmount = useMemo(
    () => purchases.reduce((sum, p) => sum + p.NetCostPrice, 0),
    [purchases]
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-slate-900 select-none">
      {/* Title Bar with Navigation Uncollapse indicator */}
      <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Quick toggle if sidebar is collapsed */}
          {isSidebarCollapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 text-[11px] font-medium transition-colors cursor-pointer"
              title="Show Navigation Sidebar"
            >
              <PanelLeft className="w-3.5 h-3.5 text-emerald-400" />
              <span>Menu</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white tracking-tight">
              Purchase & Fast Procurement Handler
            </h2>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Keyboard Fast Track
            </span>
          </div>
          <span className="text-[11px] text-slate-500 hidden lg:inline">
            Formula: <code className="text-emerald-400 font-mono">(TP + VAT Amount) - Discount Amount</code>
          </span>
        </div>

        {/* Action Controls & Tab switch */}
        <div className="flex items-center gap-2">
          {activeTab === 'new' && (
            <button
              type="button"
              onClick={() => setIsAddMedicineChildOpen((prev) => !prev)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                isAddMedicineChildOpen
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700/80 shadow-xs'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm'
              }`}
              title="Toggle Add Medicine Child Window on right side (F2)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAddMedicineChildOpen ? 'Child Window Open' : '+ Add Medicine'}</span>
              <kbd className="bg-emerald-800/80 px-1.5 py-0.2 rounded text-[10px] font-mono text-emerald-200">
                F2
              </kbd>
            </button>
          )}

          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
            <button
              onClick={() => setActiveTab('new')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'new'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>New Order</span>
              {activeDraftId && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Editing active draft" />
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                setPurchaseListFilter('all');
              }}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'history' && purchaseListFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Receipt className="w-3 h-3" />
              <span>All Purchases ({purchases.length + draftPurchases.length})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                setPurchaseListFilter('drafts');
              }}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'history' && purchaseListFilter === 'drafts'
                  ? 'bg-amber-600 text-white shadow-xs font-bold'
                  : draftPurchases.length > 0
                  ? 'text-amber-400 hover:text-amber-300 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="View saved draft purchases pending final confirmation"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Saved Drafts</span>
              {draftPurchases.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-extrabold animate-pulse">
                  {draftPurchases.length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                setPurchaseListFilter('confirmed');
              }}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'history' && purchaseListFilter === 'confirmed'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Confirmed ({purchases.length})</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'new' ? (
        /* SPLIT WORKSPACE: LEFT (PURCHASE GRID MOVED LEFT) & RIGHT (CHILD WINDOW) */
        <div className="flex-1 flex overflow-hidden">
          
          {/* ========================================================================= */}
          {/* LEFT PANEL: MAIN PURCHASE & FAST PROCUREMENT HANDLER (MOVED LEFT)        */}
          {/* ========================================================================= */}
          <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-2.5">
            
            {/* ACTIVE DRAFT RESUMED BANNER */}
            {activeDraftId && (
              <div className="p-2.5 bg-amber-950/80 border border-amber-600/70 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200 shrink-0 shadow-lg">
                <div className="flex items-center gap-2">
                  <BookmarkCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-300">Editing Saved Draft:</span>{' '}
                    <span className="font-mono text-white font-bold">{invoiceNumber}</span> • {selectedSupplier?.Name} ({items.length} items)
                    <span className="ml-2 text-[11px] text-amber-400/80 font-normal">Pending final confirmation</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDraftPurchase}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>Update Draft</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPurchase}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Post Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStartNewOrder}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    title="Clear and start new blank order"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Start Fresh</span>
                  </button>
                </div>
              </div>
            )}

            {/* AWAITING DRAFTS ALERT BANNER (WHEN NOT EDITING A DRAFT) */}
            {!activeDraftId && draftPurchases.length > 0 && (
              <div className="px-3 py-1.5 bg-slate-950 border border-amber-800/60 rounded-lg flex items-center justify-between text-xs text-slate-300 shrink-0">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    You have <strong className="text-amber-400 font-mono font-bold">{draftPurchases.length}</strong> saved purchase draft(s) awaiting final confirmation.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('history');
                    setPurchaseListFilter('drafts');
                  }}
                  className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 text-[11px] hover:underline cursor-pointer"
                >
                  <span>Find & Confirm Drafts ({draftPurchases.length})</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* TOP COMPACT CONTROLS: Supplier Dropdown, Invoice No & Scope Switch */}
            <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center">
                
                {/* 1. SEARCHABLE SUPPLIER DROPDOWN */}
                <div className="md:col-span-4 relative" ref={supplierDropdownRef}>
                  <label className="block text-slate-400 mb-0.5 text-[11px] font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Building className="w-3 h-3 text-emerald-400" />
                      Supplier Search Drop-down
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Due: <strong className="text-amber-400">{formatCurrency(selectedSupplier?.TotalDue || 0)}</strong>
                    </span>
                  </label>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                      <Search className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={isSupplierDropdownOpen ? supplierSearchText : selectedSupplier?.Name || ''}
                      onFocus={() => {
                        setIsSupplierDropdownOpen(true);
                        setSupplierSearchText('');
                      }}
                      onChange={(e) => {
                        setSupplierSearchText(e.target.value);
                        setIsSupplierDropdownOpen(true);
                      }}
                      placeholder="Search supplier by name or code..."
                      className="w-full bg-slate-900 border border-slate-700 rounded pl-7 pr-7 py-1.5 text-xs text-white font-medium focus:outline-hidden focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setIsSupplierDropdownOpen((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-1.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Dropdown Popover List */}
                  {isSupplierDropdownOpen && (
                    <div className="absolute z-40 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-2xl max-h-56 overflow-y-auto">
                      <div className="text-[10px] text-slate-400 bg-slate-950/90 border-b border-slate-800 px-2.5 py-1">
                        Showing {filteredSuppliers.length} suppliers
                      </div>
                      {filteredSuppliers.length === 0 ? (
                        <div className="p-3 text-xs text-slate-500 text-center">
                          No matching suppliers found.
                        </div>
                      ) : (
                        filteredSuppliers.map((s) => (
                          <div
                            key={s.SupplierID}
                            onClick={() => {
                              setSelectedSupplierId(s.SupplierID);
                              setIsSupplierDropdownOpen(false);
                              setSupplierSearchText('');
                            }}
                            className={`p-2 hover:bg-emerald-950/50 hover:text-white cursor-pointer border-b border-slate-800/60 last:border-b-0 flex items-center justify-between text-xs transition-colors ${
                              s.SupplierID === selectedSupplierId ? 'bg-slate-800/80 text-emerald-400 font-semibold' : 'text-slate-300'
                            }`}
                          >
                            <div>
                              <div className="font-medium text-white flex items-center gap-1.5">
                                {s.Name}
                                <span className="text-[9px] text-slate-400 font-mono bg-slate-800 px-1 py-0.2 rounded">
                                  {s.SupplierID}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Phone: {s.Phone} · {s.Address}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 block font-mono">Total Due</span>
                              <span className="font-mono text-amber-400 font-bold text-xs">
                                {formatCurrency(s.TotalDue)}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* 2. INVOICE NUMBER */}
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-0.5 text-[11px] font-medium flex items-center gap-1">
                    <Hash className="w-3 h-3 text-emerald-400" />
                    Invoice No
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="INV-2026-001"
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white font-mono font-semibold focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                {/* 3. SEARCHABLE VERIFIER (AUDIT TRAIL) DROPDOWN BOX */}
                <div className="md:col-span-3 relative" ref={verifierDropdownRef}>
                  <label className="block text-slate-400 mb-0.5 text-[11px] font-medium flex items-center justify-between">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold truncate">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Verified & Checked By</span>
                    </span>
                    <span className="text-[9px] text-emerald-400 font-mono bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-800/60 shrink-0">
                      Audit Trail
                    </span>
                  </label>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-emerald-400">
                      <UserCheck className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={isVerifierDropdownOpen ? verifierSearchText : selectedVerifier}
                      onFocus={() => {
                        setIsVerifierDropdownOpen(true);
                        setVerifierSearchText('');
                      }}
                      onChange={(e) => {
                        setVerifierSearchText(e.target.value);
                        setSelectedVerifier(e.target.value);
                        setIsVerifierDropdownOpen(true);
                      }}
                      placeholder="Search or type staff verifier..."
                      className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded pl-7 pr-7 py-1.5 text-xs text-white font-medium focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setIsVerifierDropdownOpen((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-1.5 flex items-center text-slate-400 hover:text-white cursor-pointer"
                      title="Toggle verifier dropdown"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Dropdown Popover List */}
                  {isVerifierDropdownOpen && (
                    <div className="absolute z-40 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-2xl max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-100">
                      <div className="text-[10px] text-slate-400 bg-slate-950/90 border-b border-slate-800 px-2.5 py-1 flex items-center justify-between">
                        <span>Select staff verifying product quality & counts</span>
                        <span className="text-emerald-400 font-mono">{filteredVerifiers.length} staff</span>
                      </div>
                      {filteredVerifiers.map((v) => {
                        const isCurrentSelected = selectedVerifier === v.fullLabel || selectedVerifier === v.name;
                        return (
                          <div
                            key={v.id}
                            onClick={() => {
                              setSelectedVerifier(v.fullLabel);
                              setIsVerifierDropdownOpen(false);
                              setVerifierSearchText('');
                            }}
                            className={`p-2 hover:bg-emerald-950/50 hover:text-white cursor-pointer border-b border-slate-800/60 last:border-b-0 flex items-center justify-between text-xs transition-colors ${
                              isCurrentSelected ? 'bg-emerald-950/70 text-emerald-400 font-semibold' : 'text-slate-300'
                            }`}
                          >
                            <div>
                              <div className="font-medium text-white flex items-center gap-1.5">
                                <UserCheck className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span>{v.name}</span>
                                <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                                  v.role === 'Admin'
                                    ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                                    : v.role === 'Moderator'
                                    ? 'bg-sky-950 text-sky-300 border border-sky-800/60'
                                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                }`}>
                                  {v.role}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                ID: {v.id} · Audit Accountability
                              </div>
                            </div>
                            {isCurrentSelected && (
                              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                      {verifierSearchText.trim() && !filteredVerifiers.some(v => v.name.toLowerCase() === verifierSearchText.toLowerCase()) && (
                        <div
                          onClick={() => {
                            setSelectedVerifier(verifierSearchText.trim());
                            setIsVerifierDropdownOpen(false);
                            setVerifierSearchText('');
                          }}
                          className="p-2 bg-slate-950/90 hover:bg-emerald-950/60 text-emerald-300 text-xs cursor-pointer border-t border-slate-800 flex items-center gap-1.5 font-medium"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Use custom verifier: "<strong>{verifierSearchText.trim()}</strong>"</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 4. SUPPLIER SCOPE SWITCH */}
                <div className="md:col-span-3 bg-slate-900/90 p-1.5 rounded border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-300 font-medium">Scope:</span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {supplierMode === 'single' ? 'Single' : 'All'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSupplierMode('single')}
                      className={`py-1 px-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                        supplierMode === 'single'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Building className="w-3 h-3" />
                      <span>Single Supplier</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSupplierMode('all')}
                      className={`py-1 px-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                        supplierMode === 'all'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Globe className="w-3 h-3" />
                      <span>All Suppliers</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Group selection sub-bar */}
              <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium flex items-center gap-1">
                    <Layers className="w-3 h-3 text-emerald-400" />
                    Filter by Group:
                  </span>
                  <select
                    value={selectedPurchaseGroup}
                    onChange={(e) => setSelectedPurchaseGroup(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white text-xs font-medium focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="All">All Groups (Cardiac, General, Herbal, Skin, etc.)</option>
                    <option value="Cardiac">Cardiac Group</option>
                    <option value="General">General Group</option>
                    <option value="Herbal">Herbal Group</option>
                    <option value="Skin">Skin Group</option>
                    <option value="Antibiotic">Antibiotic Group</option>
                    <option value="Antidiabetic">Antidiabetic Group</option>
                    {groups
                      .filter((g) => !['Cardiac', 'General', 'Herbal', 'Skin', 'Antibiotic', 'Antidiabetic'].includes(g))
                      .map((g) => (
                        <option key={g} value={g}>
                          {g} Group
                        </option>
                      ))}
                  </select>
                </div>

                <div className="text-[10px] text-slate-400 truncate max-w-sm">
                  {supplierMode === 'single' ? (
                    <span>Locked to <strong className="text-emerald-400">{selectedSupplier.Name}</strong></span>
                  ) : (
                    <span>Purchasing across <strong className="text-indigo-400">All {suppliers.length} Suppliers</strong></span>
                  )}
                </div>
              </div>
            </div>

            {/* DRAFT PURCHASE ITEMS GRID - MAXIMUM ROWS VISIBILITY */}
            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg flex flex-col overflow-hidden min-h-0">
              <div className="px-3 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider">
                    Draft Purchase Items ({items.length})
                  </h3>
                  {lastAddedMedicineId && items.length > 0 && (
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/80 px-2 py-0.2 rounded font-mono animate-pulse">
                      ✦ Bottom row updated
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-300">
                    Net Cost: <strong className="text-emerald-400 font-bold">{formatCurrency(netCostPrice)}</strong>
                  </span>
                </div>
              </div>

              {/* HIGH-DENSITY SCROLLABLE TABLE WITH MAXIMUM VISIBLE ROWS */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur-xs border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2 px-2.5">#</th>
                      <th className="py-2 px-2.5">Medicine & Generic</th>
                      <th className="py-2 px-2.5">Supplier</th>
                      <th className="py-2 px-2.5">Group</th>
                      <th className="py-2 px-2.5">Batch & Expiry</th>
                      <th className="py-2 px-2 text-right">Qty</th>
                      <th className="py-2 px-2 text-right">Base TP</th>
                      <th className="py-2 px-2 text-right">VAT</th>
                      <th className="py-2 px-2 text-right">Disc</th>
                      <th className="py-2 px-2.5 text-right">Unit Cost</th>
                      <th className="py-2 px-2.5 text-right">Total Cost</th>
                      <th className="py-2 px-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-mono">
                    {items.map((item, idx) => {
                      const isLastAdded = idx === items.length - 1 && lastAddedMedicineId === item.medicineId;
                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            isLastAdded
                              ? 'bg-emerald-950/60 border-l-4 border-l-emerald-400 ring-1 ring-emerald-500/20'
                              : 'hover:bg-slate-900/50'
                          }`}
                        >
                          <td className="py-2 px-2.5 text-slate-500 text-[11px] font-sans">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 font-sans">
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{item.tradeName}</span>
                              {isLastAdded && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-600 text-white font-mono uppercase">
                                  Last Added
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-xs">{item.genericName}</div>
                          </td>
                          <td className="py-2 px-2.5 font-sans text-slate-300">
                            <span className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 block truncate max-w-[130px]" title={item.supplierName}>
                              {item.supplierName}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 font-sans">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getGroupBadgeClass(item.group)}`}>
                              {item.group}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-slate-300">
                            <div className="font-medium text-white">{item.batchNumber}</div>
                            <div className="text-[10px] text-slate-500">{item.expiryDate}</div>
                          </td>
                          <td className="py-2 px-2 text-right text-white font-bold text-xs">{item.quantity}</td>
                          <td className="py-2 px-2 text-right text-slate-300">{formatCurrency(item.tp)}</td>
                          <td className="py-2 px-2 text-right text-slate-400 text-[11px]">
                            {item.vatPercent > 0 ? `${item.vatPercent}%` : <span className="text-slate-600">0%</span>}
                          </td>
                          <td className="py-2 px-2 text-right text-emerald-400 text-[11px]">
                            {item.discountPercent > 0 ? `-${item.discountPercent}%` : <span className="text-slate-600">0%</span>}
                          </td>
                          <td className="py-2 px-2.5 text-right text-emerald-400 font-semibold">{formatCurrency(item.costPrice)}</td>
                          <td className="py-2 px-2.5 text-right text-white font-bold">{formatCurrency(item.totalCost)}</td>
                          <td className="py-2 px-2 text-center font-sans">
                            <button
                              type="button"
                              onClick={() => removeItem(idx)}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {items.length === 0 && (
                      <tr>
                        <td colSpan={12} className="p-10 text-center text-slate-400 font-sans">
                          <div className="max-w-sm mx-auto space-y-2">
                            <Boxes className="w-8 h-8 text-slate-600 mx-auto" />
                            <div className="text-sm font-semibold text-slate-300">
                              No medicines added yet
                            </div>
                            <p className="text-xs text-slate-500">
                              Use the <strong className="text-emerald-400">Add Medicine Child Window</strong> on the right side to select medicines with [↓/↑] and press [Enter] to add!
                            </p>
                            {!isAddMedicineChildOpen && (
                              <button
                                type="button"
                                onClick={handleOpenChildWindow}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer mt-2"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Open Add Medicine Window</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {/* Anchor to scroll to bottom */}
                <div ref={tableBottomRef} />
              </div>
            </div>

            {/* BOTTOM COMPACT SETTLEMENT BAR */}
            {items.length > 0 && (
              <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex flex-wrap items-center justify-between gap-3 shrink-0 text-xs font-mono">
                <div className="flex items-center gap-4 text-slate-400">
                  <div>
                    Gross TP: <span className="text-white font-bold">{formatCurrency(totalTP)}</span>
                  </div>
                  <div>
                    VAT: <span className="text-slate-300">+{formatCurrency(totalVAT)}</span>
                  </div>
                  <div>
                    Discount: <span className="text-emerald-400">-{formatCurrency(totalDiscount)}</span>
                  </div>
                  <div className="text-sm">
                    Net Cost: <span className="text-emerald-400 font-bold">{formatCurrency(netCostPrice)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-[11px] font-sans">Paid:</span>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder={netCostPrice.toFixed(2)}
                      className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white font-mono text-xs focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-slate-400 text-[11px] font-sans">Due:</span>
                    <span className="text-amber-400 font-bold">{formatCurrency(dueAmount)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveDraftPurchase}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all font-sans cursor-pointer"
                    title="Save this purchase as draft for final confirmation later"
                  >
                    <BookmarkCheck className="w-3.5 h-3.5" />
                    <span>{activeDraftId ? 'Update Draft' : 'Save for Final Confirmation'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmPurchase}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all font-sans cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Order ({items.length})</span>
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* ========================================================================= */}
          {/* RIGHT PANEL: "ADD MEDICINE" CHILD WINDOW (DOCKED ON RIGHT SIDE)          */}
          {/* ========================================================================= */}
          {isAddMedicineChildOpen && (
            <div className="w-[430px] shrink-0 border-l border-slate-800 bg-slate-950 flex flex-col h-full shadow-2xl z-20 animate-in slide-in-from-right-4 duration-200">
              
              {/* CHILD WINDOW HEADER */}
              <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Add Medicine Child Window</span>
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Scope: <strong className="text-emerald-300">{supplierMode === 'single' ? selectedSupplier.Name : 'All Suppliers'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleCloseChildWindow}
                    className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                    title="Close Child Window (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* CHILD WINDOW BODY: FAST KEYBOARD ENTRY FORM */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
                
                {/* 1. VAT & DISCOUNT INPUTS (CAN BE KEPT BLANK / 0) */}
                <div className="p-2.5 bg-slate-900/90 rounded border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200 text-[11px] flex items-center gap-1">
                      <Percent className="w-3 h-3 text-emerald-400" />
                      Set VAT % & Discount %
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      (Blank = 0%)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-0.5 text-[10px]">
                        VAT % (or blank)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={modalVat}
                        onChange={(e) => setModalVat(e.target.value)}
                        placeholder="0 (Blank ok)"
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white font-mono text-xs focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-0.5 text-[10px]">
                        Discount % (or blank)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={modalDiscount}
                        onChange={(e) => setModalDiscount(e.target.value)}
                        placeholder="0 (Blank ok)"
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white font-mono text-xs focus:outline-hidden focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setModalVat('0');
                        setModalDiscount('0');
                      }}
                      className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                    >
                      Zero Both (0/0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalVat('17.4')}
                      className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                    >
                      17.4% VAT
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModalVat('');
                        setModalDiscount('');
                      }}
                      className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-400 font-medium"
                    >
                      Clear Both
                    </button>
                  </div>
                </div>

                {/* 2. MEDICINE SEARCH BAR WITH DROP-DOWN LIST & DOWN ARROW KEY NAVIGATION */}
                <div className="relative">
                  <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1">
                      <Search className="w-3 h-3 text-emerald-400" />
                      Search Medicine (Drop-down)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Press <kbd className="text-emerald-300 font-mono bg-slate-800 px-1 rounded">↓</kbd> / <kbd className="text-emerald-300 font-mono bg-slate-800 px-1 rounded">Enter</kbd>
                    </span>
                  </label>

                  <div className="relative">
                    <input
                      ref={medSearchInputRef}
                      type="text"
                      value={modalMedSearch}
                      onFocus={() => setIsMedDropdownOpen(true)}
                      onChange={(e) => {
                        setModalMedSearch(e.target.value);
                        setIsMedDropdownOpen(true);
                        setMedHighlightIndex(0);
                      }}
                      onKeyDown={handleMedSearchKeyDown}
                      placeholder="Type trade name, generic, or group..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-white font-medium text-xs focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <div className="absolute right-2.5 top-2.5 flex items-center gap-1 pointer-events-none text-slate-400">
                      <CornerDownLeft className="w-3 h-3" />
                    </div>
                  </div>

                  {/* Dropdown Options List */}
                  {isMedDropdownOpen && (
                    <div
                      ref={medDropdownListRef}
                      className="absolute z-50 left-0 right-0 mt-1 bg-slate-900 border border-slate-700 rounded-md shadow-2xl max-h-52 overflow-y-auto"
                    >
                      <div className="p-1 text-[10px] text-slate-400 bg-slate-950/90 border-b border-slate-800 px-2 flex justify-between">
                        <span>{filteredModalMedicines.length} items found</span>
                        <span>Use [↓/↑] to navigate</span>
                      </div>

                      {filteredModalMedicines.length === 0 ? (
                        <div className="p-3 text-center text-slate-500 text-xs">
                          No matching medicines.
                        </div>
                      ) : (
                        filteredModalMedicines.map((m, idx) => {
                          const isHighlighted = idx === medHighlightIndex;
                          return (
                            <div
                              key={m.MedicineID}
                              data-med-idx={idx}
                              onMouseEnter={() => setMedHighlightIndex(idx)}
                              onClick={() => handleSelectMedicine(m)}
                              className={`p-2 border-b border-slate-800/60 last:border-b-0 cursor-pointer flex items-center justify-between transition-colors ${
                                isHighlighted
                                  ? 'bg-emerald-950/90 text-white border-l-4 border-l-emerald-500'
                                  : 'hover:bg-slate-800/60 text-slate-300'
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="font-semibold text-white flex items-center gap-1.5">
                                  <span>{m.TradeName}</span>
                                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-semibold border ${getGroupBadgeClass(m.Group)}`}>
                                    {m.Group || 'General'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                                  {m.GenericName}
                                </div>
                                {supplierMode === 'all' && (
                                  <div className="text-[9px] text-slate-400">
                                    Supplier: {supplierMap.get(m.SupplierID) || 'Supplier'}
                                  </div>
                                )}
                              </div>

                              <div className="text-right">
                                <div className="font-mono text-emerald-400 font-bold text-xs">
                                  MRP: {formatCurrency(m.MRP || 15.0)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* 3. SELECTED MEDICINE PREVIEW CARD */}
                {selectedMed && (
                  <div className="p-2.5 bg-emerald-950/40 border border-emerald-800/60 rounded-md text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{selectedMed.TradeName}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${getGroupBadgeClass(selectedMed.Group)}`}>
                        {selectedMed.Group || 'General'} Group
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-300">
                      Generic: {selectedMed.GenericName}
                    </div>
                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-emerald-800/40 font-mono">
                      <span className="text-slate-400">
                        Supplier: <strong className="text-white">{supplierMap.get(selectedMed.SupplierID) || selectedSupplier.Name}</strong>
                      </span>
                      <span className="text-emerald-300 font-bold">
                        MRP: {formatCurrency(selectedMed.MRP || 15.0)}
                      </span>
                    </div>
                  </div>
                )}

                {/* 4. QUANTITY & TP INPUTS WITH RAPID ENTER PROGRESSION */}
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-slate-300 mb-1 font-semibold flex items-center justify-between text-[11px]">
                      <span>Quantity</span>
                      <kbd className="text-[9px] font-mono text-emerald-400">[Enter → TP]</kbd>
                    </label>
                    <input
                      ref={qtyInputRef}
                      type="number"
                      min="1"
                      value={modalQty}
                      onChange={(e) => setModalQty(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          tpInputRef.current?.focus();
                          tpInputRef.current?.select();
                        }
                      }}
                      placeholder="50"
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono font-bold text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
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
                      step="0.5"
                      min="0"
                      value={modalTP}
                      onChange={(e) => setModalTP(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddLineItem();
                        }
                      }}
                      placeholder="100.00"
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono font-bold text-sm focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* 5. BATCH NUMBER & EXPIRY (PRE-FILLED DEFAULTS) */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <label className="block text-slate-400 mb-0.5 text-[10px]">Batch No</label>
                    <input
                      ref={batchInputRef}
                      type="text"
                      value={modalBatchNum}
                      onChange={(e) => setModalBatchNum(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white font-mono text-xs focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-0.5 text-[10px]">Expiry Date</label>
                    <input
                      ref={expiryInputRef}
                      type="date"
                      value={modalExpiry}
                      onChange={(e) => setModalExpiry(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-white font-mono text-xs focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* 6. LIVE EXACT FORMULA CALLOUT */}
                <div className="p-2.5 rounded bg-slate-900 border border-emerald-800/40 text-xs font-mono space-y-1">
                  <div className="flex items-center justify-between text-slate-400 text-[10px]">
                    <span className="text-emerald-400 font-semibold font-sans flex items-center gap-1">
                      <Calculator className="w-3 h-3" />
                      Cost Formula:
                    </span>
                    <span>
                      ({numericTP.toFixed(2)} + {liveCalculation.vatAmount.toFixed(2)}) - {liveCalculation.discountAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-white font-bold">
                    <span>
                      Cost Price: <strong className="text-emerald-400">{formatCurrency(liveCalculation.costPrice)}</strong>
                    </span>
                    <span>
                      Line Total: <strong className="text-emerald-300">{formatCurrency(liveCalculation.lineTotal)}</strong>
                    </span>
                  </div>
                </div>

                {/* 7. ADD BUTTON */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer font-sans"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add to Invoice Bottom (Enter)</span>
                  </button>
                  <p className="text-[10px] text-slate-400 text-center mt-1.5">
                    Fast process handler loops focus back to search automatically!
                  </p>
                </div>

              </div>

              {/* CHILD WINDOW FOOTER */}
              <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0 text-xs">
                <span className="text-slate-400 font-mono text-[11px]">
                  {items.length} items in invoice
                </span>
                <button
                  type="button"
                  onClick={handleCloseChildWindow}
                  className="px-2.5 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded text-xs transition-colors"
                >
                  Close Panel (Esc)
                </button>
              </div>

            </div>
          )}

        </div>
      ) : (
        /* ========================================================================= */
        /* PURCHASE REGISTER & SAVED DRAFTS DASHBOARD                               */
        /* ========================================================================= */
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* 1. EXECUTIVE KPI SUMMARY METRICS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {/* Confirmed Volume */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Confirmed & Posted
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-950 px-1.5 py-0.5 rounded border border-emerald-800/60">
                  {purchases.length} Orders
                </span>
              </div>
              <div className="font-mono font-bold text-white text-lg mt-2">
                {formatCurrency(totalConfirmedAmount)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Active in inventory stock batches & supplier ledger
              </div>
            </div>

            {/* Saved Drafts (Pending Confirmation) */}
            <div className={`p-3 rounded-lg border shadow-sm transition-all ${
              draftPurchases.length > 0
                ? 'bg-amber-950/40 border-amber-600/70'
                : 'bg-slate-950 border-slate-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`font-bold flex items-center gap-1.5 ${
                  draftPurchases.length > 0 ? 'text-amber-300' : 'text-slate-400'
                }`}>
                  <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
                  Saved Drafts (Pending)
                </span>
                <span className={`text-[11px] font-mono font-extrabold px-1.5 py-0.5 rounded border ${
                  draftPurchases.length > 0
                    ? 'bg-amber-500 text-slate-950 border-amber-400 animate-pulse'
                    : 'bg-slate-900 text-slate-500 border-slate-800'
                }`}>
                  {draftPurchases.length} Drafts
                </span>
              </div>
              <div className="font-mono font-bold text-amber-300 text-lg mt-2">
                {formatCurrency(totalDraftsAmount)}
              </div>
              <div className="text-[10px] text-amber-400/80 mt-1">
                Saved for final confirmation; not yet posted to stock
              </div>
            </div>

            {/* Total Due to Suppliers */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 shadow-sm">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-medium flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-rose-400" />
                  Supplier Due Balance
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Payable</span>
              </div>
              <div className="font-mono font-bold text-rose-400 text-lg mt-2">
                {formatCurrency(
                  purchases.reduce((sum, p) => sum + (p.DueAmount || 0), 0)
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Outstanding liabilities across confirmed suppliers
              </div>
            </div>

            {/* Quick Action to New Order */}
            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-col justify-between shadow-sm">
              <div className="text-slate-400 font-medium flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-emerald-400" />
                Procurement Handler
              </div>
              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleStartNewOrder();
                    setActiveTab('new');
                  }}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Purchase Order</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. GROUP VOLUME BREAKDOWN */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-2 text-xs">
            <h4 className="font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              Group-Wise Procurement Volume & Spending Breakdown
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 pt-1">
              {groupPurchasesSummary.map((item) => (
                <div key={item.groupName} className="p-2.5 bg-slate-900 rounded border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getGroupBadgeClass(item.groupName)}`}>
                      {item.groupName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.count} Invoices</span>
                  </div>
                  <div className="font-mono font-bold text-white text-xs mt-1.5">
                    {formatCurrency(item.totalAmount)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. MULTI-LEVEL FILTER BAR & SEARCH */}
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            
            {/* Left: Status Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-400 text-xs font-medium">View Option:</span>
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-md border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPurchaseListFilter('all')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    purchaseListFilter === 'all'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Receipt className="w-3 h-3" />
                  <span>All ({combinedPurchaseRows.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPurchaseListFilter('drafts')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    purchaseListFilter === 'drafts'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : draftPurchases.length > 0
                      ? 'text-amber-400 hover:text-amber-300'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <BookmarkCheck className="w-3 h-3" />
                  <span>Saved Drafts</span>
                  {draftPurchases.length > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      purchaseListFilter === 'drafts'
                        ? 'bg-white text-slate-950'
                        : 'bg-amber-500 text-slate-950 animate-pulse'
                    }`}>
                      {draftPurchases.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPurchaseListFilter('confirmed')}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    purchaseListFilter === 'confirmed'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Confirmed ({purchases.length})</span>
                </button>
              </div>

              {/* Group Filter */}
              <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-md border border-slate-800 ml-2">
                {['All', 'Cardiac', 'General', 'Herbal', 'Skin'].map((grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setHistoryGroupFilter(grp)}
                    className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      historyGroupFilter === grp ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {grp}
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Search & Print */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={searchRegisterQuery}
                  onChange={(e) => setSearchRegisterQuery(e.target.value)}
                  placeholder="Search invoice #, supplier..."
                  className="bg-slate-900 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-emerald-500 w-52"
                />
                {searchRegisterQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchRegisterQuery('')}
                    className="absolute right-2 top-2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                title="Print purchases register"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>

          </div>

          {/* 4. UNIFIED PURCHASES & SAVED DRAFTS TABLE */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 text-[10px] uppercase tracking-wider font-semibold">
                  <th className="p-3">Status</th>
                  <th className="p-3">Invoice No</th>
                  <th className="p-3">Group Division</th>
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3">Date / Saved</th>
                  <th className="p-3">Verified By (Audit)</th>
                  <th className="p-3 text-right">Gross TP</th>
                  <th className="p-3 text-right">VAT</th>
                  <th className="p-3 text-right">Discount</th>
                  <th className="p-3 text-right">Net Cost</th>
                  <th className="p-3 text-right">Due Balance</th>
                  <th className="p-3 text-center">Items</th>
                  <th className="p-3 text-right">Process Handler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 font-mono text-xs">
                {filteredCombinedRows.map((row) => {
                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        row.isDraft
                          ? 'bg-amber-950/20 hover:bg-amber-950/35 border-l-4 border-l-amber-500'
                          : 'hover:bg-slate-900/40 border-l-4 border-l-emerald-600/60'
                      }`}
                    >
                      {/* Status */}
                      <td className="p-3 font-sans">
                        {row.isDraft ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600/70 inline-flex items-center gap-1 shadow-xs">
                            <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
                            <span>Pending Confirmation</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Confirmed & Posted</span>
                          </span>
                        )}
                      </td>

                      {/* Invoice No */}
                      <td className="p-3 font-semibold text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span>{row.invoiceNumber}</span>
                          {row.isDraft && (
                            <span className="px-1 py-0.2 rounded text-[9px] bg-amber-900/80 text-amber-300 font-mono uppercase">
                              Draft
                            </span>
                          )}
                        </div>
                        {row.notes && (
                          <div className="text-[10px] text-slate-400 font-sans truncate max-w-xs" title={row.notes}>
                            {row.notes}
                          </div>
                        )}
                      </td>

                      {/* Group Division */}
                      <td className="p-3 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${getGroupBadgeClass(row.group)}`}>
                          {row.group || 'General'}
                        </span>
                      </td>

                      {/* Supplier */}
                      <td className="p-3 font-sans text-slate-300">
                        <div className="font-medium text-white">{row.supplierName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{row.supplierId}</div>
                      </td>

                      {/* Date */}
                      <td className="p-3 text-slate-400 text-[11px]">
                        <div>{new Date(row.date).toLocaleDateString()}</div>
                        <div className="text-[10px] text-slate-500">
                          {new Date(row.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Verified By Audit Trail */}
                      <td className="p-3 font-sans">
                        <div className="flex items-center gap-1.5 text-xs">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="font-medium text-slate-200 truncate max-w-[130px]" title={row.verifiedBy}>
                            {row.verifiedBy}
                          </span>
                        </div>
                      </td>

                      {/* TP */}
                      <td className="p-3 text-right text-slate-400">{formatCurrency(row.totalTP)}</td>

                      {/* VAT */}
                      <td className="p-3 text-right text-slate-400">+{formatCurrency(row.totalVAT)}</td>

                      {/* Discount */}
                      <td className="p-3 text-right text-emerald-400">-{formatCurrency(row.totalDiscount)}</td>

                      {/* Net Cost */}
                      <td className="p-3 text-right font-bold text-white text-sm">
                        {formatCurrency(row.netCostPrice)}
                      </td>

                      {/* Due */}
                      <td className="p-3 text-right font-bold text-amber-400">
                        {formatCurrency(row.dueAmount)}
                      </td>

                      {/* Items Count */}
                      <td className="p-3 text-center text-slate-300 font-sans">
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 text-xs">
                          {row.itemsCount}
                        </span>
                      </td>

                      {/* Action Process Handler */}
                      <td className="p-3 text-right font-sans">
                        {row.isDraft && row.rawDraft ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {/* 1. Direct Confirm & Post Button */}
                            <button
                              type="button"
                              onClick={() => handleDirectConfirmDraft(row.rawDraft!)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                              title="Confirm and post this draft immediately to inventory stock batches"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Confirm & Post</span>
                            </button>

                            {/* 2. Resume / Edit Draft Button */}
                            <button
                              type="button"
                              onClick={() => handleResumeDraft(row.rawDraft!)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-[11px] font-semibold flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
                              title="Load into New Purchase Order editor to add/edit medicines"
                            >
                              <Edit3 className="w-3 h-3 text-amber-400" />
                              <span>Edit</span>
                            </button>

                            {/* 3. View Draft Items */}
                            <button
                              type="button"
                              onClick={() => setSelectedDraftForModal(row.rawDraft!)}
                              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                              title="Inspect draft items"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* 4. Delete Draft */}
                            <button
                              type="button"
                              onClick={() => handleDeleteDraft(row.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                              title="Discard draft"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedPurchaseForModal(row.rawPurchase!)}
                              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] font-medium flex items-center gap-1 border border-slate-700 transition-colors cursor-pointer"
                            >
                              <FileText className="w-3 h-3 text-slate-400" />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => window.print()}
                              className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
                              title="Print invoice"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredCombinedRows.length === 0 && (
                  <tr>
                    <td colSpan={13} className="p-10 text-center text-slate-500 font-sans">
                      <div className="max-w-xs mx-auto space-y-2">
                        <Boxes className="w-8 h-8 text-slate-600 mx-auto" />
                        <div className="text-sm font-semibold text-slate-400">
                          No matching purchases or saved drafts found
                        </div>
                        <p className="text-xs text-slate-500">
                          {purchaseListFilter === 'drafts'
                            ? 'No saved purchase drafts currently pending confirmation.'
                            : 'Try adjusting your group filter or search query.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SAVED DRAFT DETAIL INSPECTOR MODAL                                */}
      {/* ========================================================================= */}
      {selectedDraftForModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden">
            
            {/* Header */}
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BookmarkCheck className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Draft Invoice: {selectedDraftForModal.InvoiceNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-700/60">
                      Pending Confirmation
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-sans flex items-center gap-2 flex-wrap mt-0.5">
                    <span>Supplier: <strong className="text-white">{selectedDraftForModal.SupplierName}</strong> • Saved on {new Date(selectedDraftForModal.SavedAt).toLocaleString()}</span>
                    {selectedDraftForModal.VerifiedBy && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-700/50">
                        <UserCheck className="w-3 h-3 text-emerald-400" />
                        <span>Verified by: {selectedDraftForModal.VerifiedBy}</span>
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDraftForModal(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items Table */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedDraftForModal.Notes && (
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300">
                  <span className="text-slate-500 font-semibold uppercase text-[10px] block">Notes / Reason:</span>
                  {selectedDraftForModal.Notes}
                </div>
              )}

              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="p-2.5">Medicine</th>
                      <th className="p-2.5">Batch</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">TP</th>
                      <th className="p-2.5 text-right">VAT</th>
                      <th className="p-2.5 text-right">Disc</th>
                      <th className="p-2.5 text-right">Cost Price</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-mono">
                    {selectedDraftForModal.Items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-sans font-semibold text-white">
                          {item.tradeName}
                          <div className="text-[10px] text-slate-400 font-normal">{item.genericName}</div>
                        </td>
                        <td className="p-2.5 text-slate-400 text-[11px]">{item.batchNumber}</td>
                        <td className="p-2.5 text-right text-white font-bold">{item.quantity}</td>
                        <td className="p-2.5 text-right text-slate-300">{formatCurrency(item.tp)}</td>
                        <td className="p-2.5 text-right text-slate-400">+{item.vatPercent}%</td>
                        <td className="p-2.5 text-right text-emerald-400">-{item.discountPercent}%</td>
                        <td className="p-2.5 text-right text-emerald-400 font-semibold">{formatCurrency(item.costPrice)}</td>
                        <td className="p-2.5 text-right text-white font-bold">{formatCurrency(item.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Aggregates Summary */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between text-xs font-mono">
                <div className="space-y-1 text-slate-400">
                  <div>Gross TP: <span className="text-white font-bold">{formatCurrency(selectedDraftForModal.TotalTP)}</span></div>
                  <div>Total VAT: <span className="text-slate-300">+{formatCurrency(selectedDraftForModal.TotalVAT)}</span></div>
                  <div>Total Discount: <span className="text-emerald-400">-{formatCurrency(selectedDraftForModal.TotalDiscount)}</span></div>
                </div>
                <div className="text-right space-y-1">
                  <div>Net Cost Price: <span className="text-emerald-400 font-bold text-sm">{formatCurrency(selectedDraftForModal.NetCostPrice)}</span></div>
                  <div className="text-amber-400">Due Balance: <span className="font-bold">{formatCurrency(selectedDraftForModal.DueAmount)}</span></div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => handleDeleteDraft(selectedDraftForModal.DraftID)}
                className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 rounded text-xs font-semibold border border-rose-800/60 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Draft</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResumeDraft(selectedDraftForModal)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Open in Editor</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDirectConfirmDraft(selectedDraftForModal)}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm & Post Now</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRMED PURCHASE DETAIL MODAL                                   */}
      {/* ========================================================================= */}
      {selectedPurchaseForModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden">
            
            {/* Header */}
            <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Receipt className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Invoice: {selectedPurchaseForModal.InvoiceNumber}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                      Confirmed & Posted
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-sans flex items-center gap-2 flex-wrap mt-0.5">
                    <span>Supplier: <strong className="text-white">{selectedPurchaseForModal.SupplierName}</strong> • Confirmed on {new Date(selectedPurchaseForModal.PurchaseDate).toLocaleString()}</span>
                    {selectedPurchaseForModal.VerifiedBy && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-700/50">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>Audit Verified by: {selectedPurchaseForModal.VerifiedBy}</span>
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPurchaseForModal(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Items Table */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="p-2.5">Medicine</th>
                      <th className="p-2.5">Batch</th>
                      <th className="p-2.5 text-right">Qty</th>
                      <th className="p-2.5 text-right">TP</th>
                      <th className="p-2.5 text-right">VAT</th>
                      <th className="p-2.5 text-right">Disc</th>
                      <th className="p-2.5 text-right">Cost Price</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-mono">
                    {selectedPurchaseForModal.Items.map((item, i) => (
                      <tr key={i} className="hover:bg-slate-800/40">
                        <td className="p-2.5 font-sans font-semibold text-white">
                          {item.TradeName}
                        </td>
                        <td className="p-2.5 text-slate-400 text-[11px]">{item.BatchNumber}</td>
                        <td className="p-2.5 text-right text-white font-bold">{item.Quantity}</td>
                        <td className="p-2.5 text-right text-slate-300">{formatCurrency(item.TP)}</td>
                        <td className="p-2.5 text-right text-slate-400">+{item.VATPercent}%</td>
                        <td className="p-2.5 text-right text-emerald-400">-{item.DiscountPercent}%</td>
                        <td className="p-2.5 text-right text-emerald-400 font-semibold">{formatCurrency(item.CostPrice)}</td>
                        <td className="p-2.5 text-right text-white font-bold">{formatCurrency(item.TotalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Aggregates Summary */}
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between text-xs font-mono">
                <div className="space-y-1 text-slate-400">
                  <div>Gross TP: <span className="text-white font-bold">{formatCurrency(selectedPurchaseForModal.TotalTP)}</span></div>
                  <div>Total VAT: <span className="text-slate-300">+{formatCurrency(selectedPurchaseForModal.TotalVAT)}</span></div>
                  <div>Total Discount: <span className="text-emerald-400">-{formatCurrency(selectedPurchaseForModal.TotalDiscount)}</span></div>
                </div>
                <div className="text-right space-y-1">
                  <div>Net Cost Price: <span className="text-emerald-400 font-bold text-sm">{formatCurrency(selectedPurchaseForModal.NetCostPrice)}</span></div>
                  <div>Paid Amount: <span className="text-slate-200">{formatCurrency(selectedPurchaseForModal.PaidAmount)}</span></div>
                  <div className="text-amber-400">Due Balance: <span className="font-bold">{formatCurrency(selectedPurchaseForModal.DueAmount)}</span></div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedPurchaseForModal(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-medium"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
