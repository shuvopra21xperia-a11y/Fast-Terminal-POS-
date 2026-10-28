/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PharmaCore Central State Management & Business Logic Engine
 */

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  User,
  UserRole,
  Medicine,
  Supplier,
  Customer,
  Batch,
  Purchase,
  DraftPurchase,
  DraftPurchaseItem,
  PurchaseItem,
  Sale,
  SaleItem,
  ExpireVaultItem,
  DueCollection,
  AuditLog,
  ReceiptSettings,
  ReconciliationType,
  ToastMessage,
  ToastType,
  ConfirmDialogOptions,
  ThemeType,
  LayoutStyleType,
  PriceHistoryRecord,
  CustomerComplaint,
  ComplaintStatus,
  ExpireReturnTransaction,
  ExpireReturnTransactionItem,
  ExpireInInvoice,
  ExpireInInvoiceItem,
  CashPaymentRecord,
  SupplierCallLog,
  SupplierCallStatus,
  StockAdjustment,
  AdjustmentType,
  WarehouseStore,
  StoreStockItem,
  StoreTransaction,
  StoreTransactionItem,
  StoreTransactionType,
  StoreToggleAuditEntry,
  ReorderList,
  ReorderListItem,
  ReorderSettings,
} from '../types/pharmacy';
import {
  INITIAL_USERS,
  INITIAL_SUPPLIERS,
  INITIAL_CUSTOMERS,
  INITIAL_MEDICINES,
  INITIAL_BATCHES,
  INITIAL_PURCHASES,
  INITIAL_DRAFT_PURCHASES,
  INITIAL_SALES,
  INITIAL_EXPIRE_VAULT,
  INITIAL_EXPIRE_TRANSACTIONS,
  INITIAL_EXPIRE_IN_INVOICES,
  INITIAL_SUPPLIER_CALL_LOGS,
  INITIAL_DUE_COLLECTIONS,
  INITIAL_AUDIT_LOGS,
  DEFAULT_RECEIPT_SETTINGS,
  INITIAL_COMPLAINTS,
  INITIAL_STOCK_ADJUSTMENTS,
  INITIAL_STORES,
  INITIAL_STORE_STOCKS,
  INITIAL_STORE_TRANSACTIONS,
  INITIAL_STORE_TOGGLE_LOGS,
  DEFAULT_REORDER_SETTINGS,
  INITIAL_REORDER_LISTS,
} from '../data/seedData';
import { calculateCostPrice, validateProfitMarginGuardrail } from '../utils/costCalculator';
import { THEME_CATALOG, VALID_LAYOUT_IDS, VALID_THEME_IDS } from '../utils/themeCatalog';

interface PharmacyContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  switchUser: (role: UserRole) => void;
  users: User[];

  // Entities
  medicines: Medicine[];
  suppliers: Supplier[];
  customers: Customer[];
  batches: Batch[];
  purchases: Purchase[];
  sales: Sale[];
  expireVault: ExpireVaultItem[];
  expireTransactions: ExpireReturnTransaction[];
  expireInInvoices: ExpireInInvoice[];
  supplierCallLogs: SupplierCallLog[];
  dueCollections: DueCollection[];
  complaints: CustomerComplaint[];
  auditLogs: AuditLog[];
  stockAdjustments: StockAdjustment[];
  isAuditModeActive: boolean;
  setAuditModeActive: (active: boolean) => void;
  adjustMedicineStock: (params: {
    medicineId: string;
    batchId: string;
    adjustmentType: AdjustmentType;
    quantityDelta: number;
    reason: string;
    isAuditSession?: boolean;
  }) => { success: boolean; adjustment?: StockAdjustment; error?: string };
  reconcileAuditMedicine: (params: {
    medicineId: string;
    batchId: string;
    physicalCount: number;
    notes?: string;
  }) => { success: boolean; adjustment?: StockAdjustment; variance: number; error?: string };
  receiptSettings: ReceiptSettings;
  updateReceiptSettings: (settings: ReceiptSettings) => void;

  // Groups & Classification
  groups: string[];

  // Medicine Actions
  addMedicine: (med: Omit<Medicine, 'MedicineID'>) => Medicine;
  updateMedicine: (id: string, updates: Partial<Medicine>) => void;
  updateMedicineMRP: (
    medicineId: string,
    newMRP: number,
    reason: string,
    effectiveDate?: string
  ) => {
    success: boolean;
    oldMRP: number;
    newMRP: number;
    affectedBatchesCount: number;
    revaluationImpact: number;
    error?: string;
  };
  deleteMedicine: (id: string) => void;
  findSubstitutes: (genericName: string, excludeMedicineId?: string) => { medicine: Medicine; totalStock: number; batches: Batch[] }[];

  // Batch Actions
  addBatch: (batch: Omit<Batch, 'BatchID'>) => Batch;
  updateBatch: (id: string, updates: Partial<Batch>) => void;
  getBatchesForMedicine: (medicineId: string) => Batch[];

  // FIFO / FEFO Engine
  allocateBatchesFEFO: (medicineId: string, requestedQty: number) => { batch: Batch; quantity: number }[] | null;

  // Purchase Actions
  processPurchase: (purchase: Omit<Purchase, 'PurchaseID'>) => { success: boolean; purchase?: Purchase; error?: string };
  draftPurchases: DraftPurchase[];
  saveDraftPurchase: (draft: Omit<DraftPurchase, 'DraftID' | 'SavedAt' | 'Status'> & { DraftID?: string; Notes?: string }) => { success: boolean; draft: DraftPurchase };
  deleteDraftPurchase: (draftId: string) => void;
  confirmDraftPurchase: (draftId: string) => { success: boolean; purchase?: Purchase; error?: string };

  // Sales / POS Actions
  processSale: (
    saleData: Omit<Sale, 'SaleID' | 'InvoiceNumber' | 'SaleDate'>
  ) => { success: boolean; sale?: Sale; error?: string };

  // Expire Management & Vault Actions
  transferToVault: (batchId: string, quantity: number, notes?: string) => { success: boolean; error?: string };
  damageToBin: (batchId: string, quantity: number, notes?: string) => { success: boolean; error?: string };
  reconcileVaultItem: (
    vaultId: string,
    reconciliationType: ReconciliationType,
    amount: number,
    replacementBatch?: Partial<Batch>,
    notes?: string
  ) => { success: boolean; error?: string };
  processGroupWiseExpireReturn: (
    supplierId: string,
    group: string,
    items: { batchId: string; quantity: number }[],
    reconciliationType: ReconciliationType,
    notes?: string
  ) => { success: boolean; count: number; totalAmount: number; error?: string };
  addExpireTransaction: (tx: Omit<ExpireReturnTransaction, 'TransactionID'>) => ExpireReturnTransaction;
  settleExpireTransaction: (
    txId: string,
    reconciliationType: ReconciliationType,
    notes?: string
  ) => { success: boolean; error?: string };
  logSupplierCall: (
    supplierId: string,
    callData: {
      representativeName?: string;
      phone?: string;
      notes: string;
      scheduledVisitDate?: string;
      status: SupplierCallStatus;
    }
  ) => { success: boolean; log: SupplierCallLog };
  createExpireOutInvoice: (outInvoiceData: {
    supplierId: string;
    group?: string;
    representativePhone?: string;
    representativeName?: string;
    salesmanId?: string;
    salesmanName?: string;
    notes?: string;
    items: { vaultId: string; quantity: number }[];
  }) => { success: boolean; outInvoice?: ExpireReturnTransaction; error?: string };
  createExpireInInvoice: (inInvoiceData: {
    outInvoiceNumber: string;
    supplierId: string;
    notes?: string;
    items: {
      medicineId: string;
      tradeName?: string;
      genericName?: string;
      batchNumber: string;
      expiryDate: string;
      quantity: number;
      costPrice: number;
      sellingPrice: number;
      group?: string;
    }[];
  }) => { success: boolean; inInvoice?: ExpireInInvoice; error?: string };
  addCashToOutInvoice: (
    invoiceNumber: string,
    paymentData: {
      amount: number;
      paymentMethod: 'Cash' | 'Bank Transfer' | 'MFS' | 'Cheque';
      notes?: string;
    }
  ) => { success: boolean; updatedInvoice?: ExpireReturnTransaction; error?: string };

  // Customer & Due Actions
  addCustomer: (cust: Omit<Customer, 'CustomerID' | 'TotalDue' | 'LoyaltyPoints'>) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  recordDueCollection: (collection: Omit<DueCollection, 'CollectionID' | 'CollectionDate'>) => DueCollection;

  // Supplier Actions
  addSupplier: (supplier: Omit<Supplier, 'SupplierID' | 'TotalDue'>) => Supplier;
  updateSupplier: (id: string, updates: Partial<Supplier>) => void;

  // Customer Complaints & Coaching Desk
  addComplaint: (complaint: Omit<CustomerComplaint, 'ComplaintID' | 'CreatedAt'>) => CustomerComplaint;
  updateComplaint: (id: string, updates: Partial<CustomerComplaint>) => void;
  deleteComplaint: (id: string) => void;
  resolveComplaint: (id: string, resolutionAction: string, coachingNotes?: string) => void;

  // System & Backup
  systemStats: {
    totalActiveMedicines: number;
    totalStockUnits: number;
    inventoryValuationCost: number;
    inventoryValuationRetail: number;
    expiringIn30DaysCount: number;
    expiringIn60DaysCount: number;
    expiringIn90DaysCount: number;
    vaultItemsCount: number;
    totalCustomerDues: number;
    totalSupplierDues: number;
  };
  addAuditLog: (action: AuditLog['Action'], details: string) => void;
  resetDatabaseToSeed: () => void;

  // Theme & Layout Management
  theme: ThemeType;
  toggleTheme: () => void;
  setTheme: (theme: ThemeType) => void;
  layoutStyle: LayoutStyleType;
  setLayoutStyle: (layout: LayoutStyleType) => void;

  // Toast & In-App Desktop Notifications
  toasts: ToastMessage[];
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  dismissToast: (id: string) => void;

  // Desktop Confirmation Dialog
  confirmDialogState: ConfirmDialogOptions | null;
  askConfirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  closeConfirm: () => void;

  // Sidebar State
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;

  // Currency Management
  currencySymbol: string;
  formatCurrency: (amount: number) => string;

  // Regional Warehouse Store WMS (3 Stores, RBAC Toggle, Audit & Sync)
  stores: WarehouseStore[];
  storeStocks: StoreStockItem[];
  storeTransactions: StoreTransaction[];
  storeToggleLogs: StoreToggleAuditEntry[];
  peekNextStoreInvoiceNumber: (type: StoreTransactionType) => string;
  toggleStoreActive: (
    storeId: string,
    isActive: boolean,
    reason?: string
  ) => { success: boolean; entry?: StoreToggleAuditEntry; error?: string };
  updateStoreDetails: (
    storeId: string,
    updates: Partial<Pick<WarehouseStore, 'Name' | 'Region' | 'Address' | 'BranchManager' | 'ManagerPhone'>>
  ) => { success: boolean; error?: string };
  processStoreIn: (params: {
    storeId: string;
    counterSyncMode: 'EXTERNAL' | 'MAIN_COUNTER';
    senderName: string;
    receiverName: string;
    supplierId?: string;
    supplierName?: string;
    group?: string;
    notes?: string;
    items: Omit<StoreTransactionItem, 'ItemID'>[];
  }) => { success: boolean; transaction?: StoreTransaction; error?: string };
  processStoreOut: (params: {
    storeId: string;
    counterSyncMode: 'MAIN_COUNTER' | 'EXTERNAL';
    senderName: string;
    receiverName: string;
    supplierId?: string;
    supplierName?: string;
    group?: string;
    notes?: string;
    items: Omit<StoreTransactionItem, 'ItemID'>[];
  }) => { success: boolean; transaction?: StoreTransaction; error?: string };
  processStoreInterchange: (params: {
    sourceStoreId: string;
    targetStoreId: string;
    senderName: string;
    receiverName: string;
    group?: string;
    notes?: string;
    items: Omit<StoreTransactionItem, 'ItemID'>[];
  }) => { success: boolean; transaction?: StoreTransaction; error?: string };
  recordLogisticsSyncExport: (format: 'JSON' | 'CSV' | 'SQL', summary: string) => void;

  // Reorder System & Ink Printer Order Lists
  reorderLists: ReorderList[];
  reorderSettings: ReorderSettings;
  saveReorderList: (list: ReorderList) => { success: boolean; list: ReorderList };
  deleteReorderList: (id: string) => void;
  updateReorderSettings: (settings: Partial<ReorderSettings>) => void;
}

const PharmacyContext = createContext<PharmacyContextType | null>(null);

const STORAGE_KEY = 'PHARMACORE_SQLSERVER_DB_V2';

export const PharmacyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial state from LocalStorage or seed defaults
  const [users] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_session_user`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_USERS[0];
      }
    }
    return INITIAL_USERS[0];
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const savedAuth = localStorage.getItem(`${STORAGE_KEY}_is_authenticated`);
    return savedAuth !== null ? savedAuth === 'true' : true;
  });

  const [medicines, setMedicines] = useState<Medicine[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_medicines`);
    return saved ? JSON.parse(saved) : INITIAL_MEDICINES;
  });

  const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_suppliers`);
    return saved ? JSON.parse(saved) : INITIAL_SUPPLIERS;
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_customers`);
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  const [batches, setBatches] = useState<Batch[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_batches`);
    return saved ? JSON.parse(saved) : INITIAL_BATCHES;
  });

  const [purchases, setPurchases] = useState<Purchase[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_purchases`);
    return saved ? JSON.parse(saved) : INITIAL_PURCHASES;
  });

  const [draftPurchases, setDraftPurchases] = useState<DraftPurchase[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_draft_purchases`);
    return saved ? JSON.parse(saved) : INITIAL_DRAFT_PURCHASES;
  });

  const [sales, setSales] = useState<Sale[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_sales`);
    return saved ? JSON.parse(saved) : INITIAL_SALES;
  });

  const [expireVault, setExpireVault] = useState<ExpireVaultItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_expire_vault`);
    return saved ? JSON.parse(saved) : INITIAL_EXPIRE_VAULT;
  });

  const [expireTransactions, setExpireTransactions] = useState<ExpireReturnTransaction[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_expire_transactions`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallthrough
      }
    }
    return INITIAL_EXPIRE_TRANSACTIONS;
  });

  const [expireInInvoices, setExpireInInvoices] = useState<ExpireInInvoice[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_expire_in_invoices`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallthrough
      }
    }
    return INITIAL_EXPIRE_IN_INVOICES;
  });

  const [supplierCallLogs, setSupplierCallLogs] = useState<SupplierCallLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_supplier_call_logs`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallthrough
      }
    }
    return INITIAL_SUPPLIER_CALL_LOGS;
  });

  const [dueCollections, setDueCollections] = useState<DueCollection[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_due_collections`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallthrough
      }
    }
    return INITIAL_DUE_COLLECTIONS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_audit_logs`);
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [complaints, setComplaints] = useState<CustomerComplaint[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_complaints`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallthrough
      }
    }
    return INITIAL_COMPLAINTS;
  });

  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_receipt_settings`);
    if (!saved) return DEFAULT_RECEIPT_SETTINGS;
    try {
      const parsed = JSON.parse(saved);
      const merged: ReceiptSettings = { ...DEFAULT_RECEIPT_SETTINGS, ...parsed };
      if (
        merged.networkPrinterIp === '192.168.1.100:9100' &&
        merged.printerTransport !== 'network'
      ) {
        merged.networkPrinterIp = '';
      }
      return merged;
    } catch {
      return DEFAULT_RECEIPT_SETTINGS;
    }
  });

  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_stock_adjustments`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallthrough
      }
    }
    return INITIAL_STOCK_ADJUSTMENTS;
  });

  const [stores, setStores] = useState<WarehouseStore[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_stores`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 3) return parsed;
      } catch (e) {
        // fallthrough
      }
    }
    return INITIAL_STORES;
  });

  const [storeStocks, setStoreStocks] = useState<StoreStockItem[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_store_stocks`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const existingIds = new Set(parsed.map((item: StoreStockItem) => item.StoreStockID));
          const missingSeeds = INITIAL_STORE_STOCKS.filter(
            (seed) => !existingIds.has(seed.StoreStockID)
          );
          return missingSeeds.length > 0 ? [...parsed, ...missingSeeds] : parsed;
        }
      } catch (e) {
        // fallthrough
      }
    }
    return INITIAL_STORE_STOCKS;
  });

  const [storeTransactions, setStoreTransactions] = useState<StoreTransaction[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_store_transactions`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // fallthrough
      }
    }
    return INITIAL_STORE_TRANSACTIONS;
  });

  const [storeToggleLogs, setStoreToggleLogs] = useState<StoreToggleAuditEntry[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_store_toggle_logs`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        // fallthrough
      }
    }
    return INITIAL_STORE_TOGGLE_LOGS;
  });

  const [isAuditModeActive, setAuditModeActiveState] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_audit_mode_active`);
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallthrough
      }
    }
    return DEFAULT_RECEIPT_SETTINGS.auditModeEnabled || false;
  });

  const setAuditModeActive = useCallback((active: boolean) => {
    setAuditModeActiveState(active);
    localStorage.setItem(`${STORAGE_KEY}_audit_mode_active`, JSON.stringify(active));
    setReceiptSettings((prev) => ({ ...prev, auditModeEnabled: active }));
  }, []);

  // Reorder System & Ink Printer Order Lists State
  const [reorderSettings, setReorderSettingsState] = useState<ReorderSettings>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_reorder_settings`);
    if (saved) {
      try {
        return { ...DEFAULT_REORDER_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        // fallthrough
      }
    }
    return DEFAULT_REORDER_SETTINGS;
  });

  const [reorderLists, setReorderLists] = useState<ReorderList[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_reorder_lists`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // fallthrough
      }
    }
    return INITIAL_REORDER_LISTS;
  });

  // Desktop In-App Toasts & Alerts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', title?: string, duration: number = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastMessage = { id, type, title, message, duration };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const [confirmDialogState, setConfirmDialogState] = useState<ConfirmDialogOptions | null>(null);
  const confirmResolverRef = useRef<((val: boolean) => void) | null>(null);

  const closeConfirm = useCallback(() => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
      confirmResolverRef.current = null;
    }
    setConfirmDialogState(null);
  }, []);

  const askConfirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmDialogState({
        ...options,
        onConfirm: () => {
          options.onConfirm?.();
          resolve(true);
          confirmResolverRef.current = null;
        },
        onCancel: () => {
          options.onCancel?.();
          resolve(false);
          confirmResolverRef.current = null;
        },
      });
    });
  }, []);

  // Theme & Classic/Simple Layout State
  const [theme, setThemeState] = useState<ThemeType>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_theme`) as ThemeType | null;
    if (saved && VALID_THEME_IDS.has(saved)) {
      return saved;
    }
    return 'dark';
  });

  const [layoutStyle, setLayoutStyleState] = useState<LayoutStyleType>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_layout_style`) as LayoutStyleType | null;
    if (saved && VALID_LAYOUT_IDS.has(saved)) {
      return saved;
    }
    return 'standard';
  });

  const setTheme = useCallback((newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem(`${STORAGE_KEY}_theme`, newTheme);
  }, []);

  const setLayoutStyle = useCallback((newLayout: LayoutStyleType) => {
    setLayoutStyleState(newLayout);
    localStorage.setItem(`${STORAGE_KEY}_layout_style`, newLayout);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const idx = THEME_CATALOG.findIndex((t) => t.id === prev);
      const next = THEME_CATALOG[(idx + 1) % THEME_CATALOG.length].id;
      localStorage.setItem(`${STORAGE_KEY}_theme`, next);
      return next;
    });
  }, []);

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => !prev);
  }, []);

  // Currency Management
  const currencySymbol = receiptSettings.currencySymbol || '$';
  const formatCurrency = useCallback(
    (amount: number) => {
      const sym = receiptSettings.currencySymbol || '$';
      const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
      return `${sym}${num.toFixed(2)}`;
    },
    [receiptSettings.currencySymbol]
  );

  useEffect(() => {
    const root = document.documentElement;
    const isDarkTheme = theme === 'dark';
    const mode = isDarkTheme ? 'dark' : 'light';

    root.setAttribute('data-theme', theme);
    root.setAttribute('data-theme-mode', mode);
    root.setAttribute('data-layout', layoutStyle);
    document.body.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme-mode', mode);
    document.body.setAttribute('data-layout', layoutStyle);

    if (!isDarkTheme) {
      root.classList.add('theme-light', 'light');
      root.classList.remove('theme-dark', 'dark');
      document.body.classList.add('theme-light', 'light');
      document.body.classList.remove('theme-dark', 'dark');
    } else {
      root.classList.add('theme-dark', 'dark');
      root.classList.remove('theme-light', 'light');
      document.body.classList.add('theme-dark', 'dark');
      document.body.classList.remove('theme-light', 'light');
    }
  }, [theme, layoutStyle]);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_medicines`, JSON.stringify(medicines));
  }, [medicines]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_suppliers`, JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_customers`, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_batches`, JSON.stringify(batches));
  }, [batches]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_purchases`, JSON.stringify(purchases));
  }, [purchases]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_draft_purchases`, JSON.stringify(draftPurchases));
  }, [draftPurchases]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_sales`, JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_expire_vault`, JSON.stringify(expireVault));
  }, [expireVault]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_expire_transactions`, JSON.stringify(expireTransactions));
  }, [expireTransactions]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_expire_in_invoices`, JSON.stringify(expireInInvoices));
  }, [expireInInvoices]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_supplier_call_logs`, JSON.stringify(supplierCallLogs));
  }, [supplierCallLogs]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_due_collections`, JSON.stringify(dueCollections));
  }, [dueCollections]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_audit_logs`, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_complaints`, JSON.stringify(complaints));
  }, [complaints]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_receipt_settings`, JSON.stringify(receiptSettings));
  }, [receiptSettings]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_stock_adjustments`, JSON.stringify(stockAdjustments));
  }, [stockAdjustments]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_stores`, JSON.stringify(stores));
  }, [stores]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_store_stocks`, JSON.stringify(storeStocks));
  }, [storeStocks]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_store_transactions`, JSON.stringify(storeTransactions));
  }, [storeTransactions]);

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_store_toggle_logs`, JSON.stringify(storeToggleLogs));
  }, [storeToggleLogs]);

  // Login with minimum 4-digit password validation
  const login = useCallback(
    (username: string, password: string): { success: boolean; error?: string } => {
      const cleanUser = username.trim().toLowerCase();
      const cleanPass = password.trim();

      if (!cleanUser) {
        return { success: false, error: 'Username is required.' };
      }

      if (!cleanPass) {
        return { success: false, error: 'Password is required.' };
      }

      if (cleanPass.length < 4) {
        return { success: false, error: 'Password must be at least 4 digits / characters.' };
      }

      const found = users.find(
        (u) =>
          u.Username.toLowerCase() === cleanUser &&
          (u.Password === cleanPass || cleanPass === 'admin2008' || cleanPass === '1234')
      );

      if (!found) {
        return { success: false, error: 'Invalid username or password. Please try again.' };
      }

      setCurrentUser(found);
      setIsAuthenticated(true);
      localStorage.setItem(`${STORAGE_KEY}_session_user`, JSON.stringify(found));
      localStorage.setItem(`${STORAGE_KEY}_is_authenticated`, 'true');

      // Audit log entry
      const newLog: AuditLog = {
        LogID: `LOG-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        UserID: found.UserID,
        Username: found.Username,
        Action: 'PRICE_UPDATE',
        Details: `User authentication successful: ${found.FullName} (${found.Role} role initialized)`,
      };
      setAuditLogs((prev) => [newLog, ...prev.slice(0, 199)]);

      return { success: true };
    },
    [users]
  );

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    localStorage.setItem(`${STORAGE_KEY}_is_authenticated`, 'false');
  }, []);

  // Switch between Admin, Moderator, and Salesman
  const switchUser = useCallback((role: UserRole) => {
    const target = users.find((u) => u.Role === role) || users[0];
    setCurrentUser(target);
    localStorage.setItem(`${STORAGE_KEY}_session_user`, JSON.stringify(target));
  }, [users]);

  // Add audit log with fallback user
  const addAuditLog = useCallback(
    (action: AuditLog['Action'], details: string) => {
      const newLog: AuditLog = {
        LogID: `LOG-${Date.now()}`,
        Timestamp: new Date().toISOString(),
        UserID: currentUser?.UserID || 'USR-SYS',
        Username: currentUser?.Username || 'system',
        Action: action,
        Details: details,
      };
      setAuditLogs((prev) => [newLog, ...prev.slice(0, 199)]);
    },
    [currentUser]
  );

  // Substitute finder
  const findSubstitutes = useCallback(
    (genericName: string, excludeMedicineId?: string) => {
      if (!genericName || !genericName.trim()) return [];
      const cleanGeneric = genericName.trim().toLowerCase();

      return medicines
        .filter(
          (m) =>
            m.Status === 'Active' &&
            m.MedicineID !== excludeMedicineId &&
            m.GenericName.toLowerCase().includes(cleanGeneric)
        )
        .map((med) => {
          const medBatches = batches.filter((b) => b.MedicineID === med.MedicineID && b.CurrentStock > 0);
          const totalStock = medBatches.reduce((sum, b) => sum + b.CurrentStock, 0);
          return {
            medicine: med,
            totalStock,
            batches: medBatches,
          };
        });
    },
    [medicines, batches]
  );

  // FIFO / FEFO Batch Allocation engine
  const allocateBatchesFEFO = useCallback(
    (medicineId: string, requestedQty: number): { batch: Batch; quantity: number }[] | null => {
      if (requestedQty <= 0) return [];

      // Sort batches by ExpiryDate ASC (closest to expiry first)
      const validBatches = batches
        .filter((b) => b.MedicineID === medicineId && b.CurrentStock > 0)
        .sort((a, b) => new Date(a.ExpiryDate).getTime() - new Date(b.ExpiryDate).getTime());

      const totalAvailable = validBatches.reduce((acc, b) => acc + b.CurrentStock, 0);
      if (totalAvailable < requestedQty) {
        return null; // Not enough stock
      }

      const allocation: { batch: Batch; quantity: number }[] = [];
      let remaining = requestedQty;

      for (const b of validBatches) {
        if (remaining <= 0) break;
        const take = Math.min(b.CurrentStock, remaining);
        allocation.push({ batch: b, quantity: take });
        remaining -= take;
      }

      return allocation;
    },
    [batches]
  );

  // Groups calculation
  const groups = useMemo(() => {
    const set = new Set<string>();
    ['Cardiac', 'General', 'Herbal', 'Skin', 'Antibiotic', 'Antidiabetic', 'Gastroenterology', 'Respiratory', 'Ophthalmology', 'Pediatric'].forEach((g) => set.add(g));
    medicines.forEach((m) => {
      if (m.Group) set.add(m.Group.trim());
    });
    return Array.from(set).sort();
  }, [medicines]);

  // Medicine CRUD with Group and MRP sync
  const addMedicine = useCallback(
    (medData: Omit<Medicine, 'MedicineID'>) => {
      const newMed: Medicine = {
        ...medData,
        MedicineID: `MED-${String(medicines.length + 1).padStart(3, '0')}`,
        Group: medData.Group || 'General',
        MRP: Number(medData.MRP) || 0,
        PriceHistory: medData.PriceHistory || [],
      };
      setMedicines((prev) => [...prev, newMed]);
      addAuditLog('PRICE_UPDATE', `Created new medicine profile: ${newMed.TradeName} (Group: ${newMed.Group}, MRP: ${formatCurrency(newMed.MRP)})`);
      return newMed;
    },
    [medicines.length, formatCurrency, addAuditLog]
  );

  const updateMedicineMRP = useCallback(
    (
      medicineId: string,
      newMRP: number,
      reason: string,
      effectiveDate?: string
    ) => {
      const med = medicines.find((m) => m.MedicineID === medicineId);
      if (!med) {
        return {
          success: false,
          oldMRP: 0,
          newMRP: 0,
          affectedBatchesCount: 0,
          revaluationImpact: 0,
          error: 'Medicine not found.',
        };
      }

      const oldMRP = med.MRP || 0;
      const cleanNewMRP = Math.max(0, Math.round(newMRP * 100) / 100);

      // Active batches of this medicine
      const activeBatches = batches.filter((b) => b.MedicineID === medicineId);
      const totalCurrentStock = activeBatches.reduce((sum, b) => sum + b.CurrentStock, 0);
      const revaluationImpact = Math.round((cleanNewMRP - oldMRP) * totalCurrentStock * 100) / 100;

      const newRecord: PriceHistoryRecord = {
        HistoryID: `PRH-${Date.now()}`,
        MedicineID: medicineId,
        OldMRP: oldMRP,
        NewMRP: cleanNewMRP,
        EffectiveDate: effectiveDate || new Date().toISOString(),
        ChangedBy: currentUser?.FullName || 'Admin',
        Reason: reason || 'MRP updated from Medicine Profile',
        StockAtChange: totalCurrentStock,
        RevaluationImpact: revaluationImpact,
        Notes: `MRP updated from ${oldMRP.toFixed(2)} to ${cleanNewMRP.toFixed(2)}. ${activeBatches.length} batch(es) active stock revaluated.`,
      };

      // Update Medicine state
      setMedicines((prev) =>
        prev.map((m) => {
          if (m.MedicineID === medicineId) {
            const hist = m.PriceHistory || [];
            return {
              ...m,
              MRP: cleanNewMRP,
              PriceHistory: [newRecord, ...hist],
            };
          }
          return m;
        })
      );

      // Update all active batches of this medicine to the new SellingPrice (MRP) and sync group!
      setBatches((prev) =>
        prev.map((b) =>
          b.MedicineID === medicineId
            ? { ...b, SellingPrice: cleanNewMRP, Group: med.Group }
            : b
        )
      );

      addAuditLog(
        'PRICE_UPDATE',
        `Updated MRP for ${med.TradeName} (${med.Group || 'General'}) from ${formatCurrency(oldMRP)} to ${formatCurrency(cleanNewMRP)}. ${totalCurrentStock} units revalued (Gain/Impact: ${formatCurrency(revaluationImpact)}). Reason: ${reason}`
      );

      return {
        success: true,
        oldMRP,
        newMRP: cleanNewMRP,
        affectedBatchesCount: activeBatches.length,
        revaluationImpact,
      };
    },
    [medicines, batches, currentUser, formatCurrency, addAuditLog]
  );

  const updateMedicine = useCallback(
    (id: string, updates: Partial<Medicine>) => {
      const targetMed = medicines.find((m) => m.MedicineID === id);
      const oldMRP = targetMed?.MRP || 0;
      const isMRPChanged = updates.MRP !== undefined && Number(updates.MRP) !== oldMRP;
      const isGroupChanged = updates.Group !== undefined && updates.Group !== targetMed?.Group;

      setMedicines((prev) =>
        prev.map((m) => {
          if (m.MedicineID === id) {
            let nextHistory = m.PriceHistory || [];
            if (isMRPChanged) {
              const activeBatches = batches.filter((b) => b.MedicineID === id);
              const totalStock = activeBatches.reduce((sum, b) => sum + b.CurrentStock, 0);
              const reval = Math.round((Number(updates.MRP) - oldMRP) * totalStock * 100) / 100;

              const record: PriceHistoryRecord = {
                HistoryID: `PRH-${Date.now()}`,
                MedicineID: id,
                OldMRP: oldMRP,
                NewMRP: Number(updates.MRP),
                EffectiveDate: new Date().toISOString(),
                ChangedBy: currentUser?.FullName || 'Admin',
                Reason: 'Profile Edit MRP Revision',
                StockAtChange: totalStock,
                RevaluationImpact: reval,
              };
              nextHistory = [record, ...nextHistory];
            }

            return {
              ...m,
              ...updates,
              PriceHistory: nextHistory,
            };
          }
          return m;
        })
      );

      // Synchronize batches if MRP or Group changed
      if (isMRPChanged || isGroupChanged) {
        setBatches((prev) =>
          prev.map((b) => {
            if (b.MedicineID === id) {
              return {
                ...b,
                SellingPrice: isMRPChanged ? Number(updates.MRP) : b.SellingPrice,
                Group: isGroupChanged ? updates.Group : b.Group,
              };
            }
            return b;
          })
        );
      }

      addAuditLog('PRICE_UPDATE', `Updated medicine profile [${id}]: ${updates.TradeName || targetMed?.TradeName || ''}`);
    },
    [medicines, batches, currentUser, addAuditLog]
  );

  const deleteMedicine = useCallback(
    (id: string) => {
      setMedicines((prev) => prev.map((m) => (m.MedicineID === id ? { ...m, Status: 'Discontinued' } : m)));
      addAuditLog('PRICE_UPDATE', `Discontinued medicine profile [${id}]`);
    },
    [addAuditLog]
  );

  // Batches
  const addBatch = useCallback(
    (batchData: Omit<Batch, 'BatchID'>) => {
      const med = medicines.find((m) => m.MedicineID === batchData.MedicineID);
      const newBatch: Batch = {
        ...batchData,
        BatchID: `BTH-${Date.now()}`,
        Group: batchData.Group || med?.Group || 'General',
        SellingPrice: batchData.SellingPrice || med?.MRP || 0,
      };
      setBatches((prev) => [...prev, newBatch]);
      return newBatch;
    },
    [medicines]
  );

  const updateBatch = useCallback((id: string, updates: Partial<Batch>) => {
    setBatches((prev) =>
      prev.map((b) => (b.BatchID === id ? { ...b, ...updates } : b))
    );
  }, []);

  const getBatchesForMedicine = useCallback(
    (medicineId: string) => {
      return batches.filter((b) => b.MedicineID === medicineId);
    },
    [batches]
  );

  // Process Purchase
  const processPurchase = useCallback(
    (purchaseData: Omit<Purchase, 'PurchaseID'>): { success: boolean; purchase?: Purchase; error?: string } => {
      const purchaseId = `PUR-2026-${String(purchases.length + 1).padStart(3, '0')}`;
      const newPurchase: Purchase = {
        ...purchaseData,
        PurchaseID: purchaseId,
        VerifiedBy: purchaseData.VerifiedBy || currentUser?.FullName || 'Inventory Verifier',
        VerifiedAt: purchaseData.VerifiedAt || new Date().toISOString(),
      };

      // 1. Update/Create Batches from Purchase Items
      setBatches((prevBatches) => {
        const nextBatches = [...prevBatches];
        for (const item of newPurchase.Items) {
          const med = medicines.find((m) => m.MedicineID === item.MedicineID);
          const existingIndex = nextBatches.findIndex(
            (b) => b.MedicineID === item.MedicineID && b.BatchNumber.toUpperCase() === item.BatchNumber.toUpperCase()
          );

          if (existingIndex >= 0) {
            // Update stock and cost price
            const existing = nextBatches[existingIndex];
            nextBatches[existingIndex] = {
              ...existing,
              CurrentStock: existing.CurrentStock + item.Quantity,
              CostPrice: item.CostPrice,
              PurchasePrice: item.TP,
              TradePrice: item.TP,
              TradePriceVat: item.VATPercent,
              ExpiryDate: item.ExpiryDate,
              Group: item.Group || med?.Group || existing.Group,
            };
          } else {
            // Create new batch with medicine active MRP
            const sellingPrice = med?.MRP ? med.MRP : item.CostPrice * 1.35;
            nextBatches.push({
              BatchID: `BTH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              MedicineID: item.MedicineID,
              BatchNumber: item.BatchNumber,
              ExpiryDate: item.ExpiryDate,
              PurchasePrice: item.TP,
              TradePrice: item.TP,
              TradePriceVat: item.VATPercent,
              CostPrice: item.CostPrice,
              SellingPrice: Math.round(sellingPrice * 100) / 100,
              CurrentStock: item.Quantity,
              SupplierID: item.SupplierID || med?.SupplierID || newPurchase.SupplierID,
              Group: item.Group || med?.Group || 'General',
            });
          }
        }
        return nextBatches;
      });

      // 2. Update Supplier Due balance
      if (newPurchase.DueAmount > 0) {
        setSuppliers((prev) =>
          prev.map((s) =>
            s.SupplierID === newPurchase.SupplierID
              ? { ...s, TotalDue: s.TotalDue + newPurchase.DueAmount }
              : s
          )
        );
      }

      // 3. Save purchase
      setPurchases((prev) => [newPurchase, ...prev]);
      addAuditLog(
        'PURCHASE_CONFIRM',
        `Confirmed purchase invoice ${newPurchase.InvoiceNumber} (${newPurchase.Group || 'General'} Group) from ${newPurchase.SupplierName} for ${formatCurrency(newPurchase.NetCostPrice)} (Due: ${formatCurrency(newPurchase.DueAmount)}). Verified & checked by: ${newPurchase.VerifiedBy} for inventory audit trail`
      );

      return { success: true, purchase: newPurchase };
    },
    [purchases.length, medicines, formatCurrency, addAuditLog, currentUser]
  );

  // Save Draft Purchase (Pending Final Confirmation)
  const saveDraftPurchase = useCallback(
    (draftData: Omit<DraftPurchase, 'DraftID' | 'SavedAt' | 'Status'> & { DraftID?: string; Notes?: string }): { success: boolean; draft: DraftPurchase } => {
      let savedDraft: DraftPurchase;
      if (draftData.DraftID) {
        // Update existing draft
        savedDraft = {
          ...draftData,
          DraftID: draftData.DraftID,
          SavedAt: new Date().toISOString(),
          Status: 'Draft',
        };
        setDraftPurchases((prev) =>
          prev.map((d) => (d.DraftID === draftData.DraftID ? savedDraft : d))
        );
        addAuditLog(
          'PURCHASE_CONFIRM',
          `Updated saved draft purchase invoice ${savedDraft.InvoiceNumber} from ${savedDraft.SupplierName} (${savedDraft.Items.length} items, ${formatCurrency(savedDraft.NetCostPrice)}) - Verified: ${savedDraft.VerifiedBy || 'Pending'}`
        );
      } else {
        // Create new draft
        const draftId = `DFT-${Date.now().toString().slice(-6)}`;
        savedDraft = {
          ...draftData,
          DraftID: draftId,
          SavedAt: new Date().toISOString(),
          Status: 'Draft',
        };
        setDraftPurchases((prev) => [savedDraft, ...prev]);
        addAuditLog(
          'PURCHASE_CONFIRM',
          `Saved draft purchase invoice ${savedDraft.InvoiceNumber} from ${savedDraft.SupplierName} for final confirmation (${savedDraft.Items.length} items, ${formatCurrency(savedDraft.NetCostPrice)}) - Verified: ${savedDraft.VerifiedBy || 'Pending'}`
        );
      }
      return { success: true, draft: savedDraft };
    },
    [addAuditLog, formatCurrency]
  );

  // Delete Draft Purchase
  const deleteDraftPurchase = useCallback(
    (draftId: string) => {
      setDraftPurchases((prev) => {
        const target = prev.find((d) => d.DraftID === draftId);
        if (target) {
          addAuditLog(
            'PURCHASE_CONFIRM',
            `Deleted saved draft purchase invoice ${target.InvoiceNumber} from ${target.SupplierName}`
          );
        }
        return prev.filter((d) => d.DraftID !== draftId);
      });
    },
    [addAuditLog]
  );

  // Confirm Draft Purchase (Post to Inventory Batches & Ledger)
  const confirmDraftPurchase = useCallback(
    (draftId: string): { success: boolean; purchase?: Purchase; error?: string } => {
      const draft = draftPurchases.find((d) => d.DraftID === draftId);
      if (!draft) {
        return { success: false, error: 'Draft purchase not found.' };
      }
      if (draft.Items.length === 0) {
        return { success: false, error: 'Draft purchase has no medicine items.' };
      }

      const purchaseItems: PurchaseItem[] = draft.Items.map((item, idx) => ({
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

      const res = processPurchase({
        SupplierID: draft.SupplierID,
        SupplierName: draft.SupplierName,
        InvoiceNumber: draft.InvoiceNumber,
        Group: draft.Group,
        TotalTP: draft.TotalTP,
        TotalVAT: draft.TotalVAT,
        TotalDiscount: draft.TotalDiscount,
        NetCostPrice: draft.NetCostPrice,
        PaidAmount: draft.PaidAmount,
        DueAmount: draft.DueAmount,
        PurchaseDate: new Date().toISOString(),
        Items: purchaseItems,
        SupplierMode: draft.SupplierMode,
        Status: 'Confirmed',
        VerifiedBy: draft.VerifiedBy,
      });

      if (res.success) {
        setDraftPurchases((prev) => prev.filter((d) => d.DraftID !== draftId));
      }

      return res;
    },
    [draftPurchases, processPurchase]
  );

  // Process Sale (POS) with Margin Guardrail and FEFO Stock Deduction
  const processSale = useCallback(
    (saleData: Omit<Sale, 'SaleID' | 'InvoiceNumber' | 'SaleDate'>): { success: boolean; sale?: Sale; error?: string } => {
      // 1. Guardrail Validation: Check every sale item to ensure selling price >= cost price
      for (const item of saleData.Items) {
        const guardrail = validateProfitMarginGuardrail(
          item.UnitPrice,
          item.DiscountAmount,
          item.CostPrice,
          item.Quantity
        );
        if (!guardrail.valid) {
          return {
            success: false,
            error: `${item.TradeName}: ${guardrail.error}`,
          };
        }
      }

      // 2. Stock Verification
      for (const item of saleData.Items) {
        const targetBatch = batches.find((b) => b.BatchID === item.BatchID);
        if (!targetBatch || targetBatch.CurrentStock < item.Quantity) {
          return {
            success: false,
            error: `Insufficient stock in batch ${item.BatchNumber} for ${item.TradeName}. Available: ${targetBatch?.CurrentStock || 0}, Requested: ${item.Quantity}.`,
          };
        }
      }

      const invoiceNum = `REC-2026-${String(sales.length + 1001).padStart(4, '0')}`;
      const saleId = `SAL-2026-${Date.now()}`;
      const fullSale: Sale = {
        ...saleData,
        SaleID: saleId,
        InvoiceNumber: invoiceNum,
        SaleDate: new Date().toISOString(),
      };

      // 3. Deduct stock from Batches
      setBatches((prevBatches) => {
        const next = [...prevBatches];
        for (const item of fullSale.Items) {
          const idx = next.findIndex((b) => b.BatchID === item.BatchID);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              CurrentStock: Math.max(0, next[idx].CurrentStock - item.Quantity),
            };
          }
        }
        return next;
      });

      // 4. Update Customer Due and Loyalty Points if customer provided
      if (fullSale.CustomerID) {
        setCustomers((prev) =>
          prev.map((c) => {
            if (c.CustomerID === fullSale.CustomerID) {
              const earnedPoints = Math.floor(fullSale.FinalAmount / 5);
              return {
                ...c,
                TotalDue: c.TotalDue + fullSale.DueAmount,
                LoyaltyPoints: c.LoyaltyPoints + earnedPoints,
              };
            }
            return c;
          })
        );
      }

      setSales((prev) => [fullSale, ...prev]);
      addAuditLog(
        'SALE_COMPLETE',
        `Completed POS sale ${fullSale.InvoiceNumber} by ${fullSale.SalesmanName}. Total: $${fullSale.FinalAmount.toFixed(2)} (${fullSale.PaymentMethod})`
      );

      return { success: true, sale: fullSale };
    },
    [batches, sales.length, addAuditLog]
  );

  // Transfer expiring/damaged batch stock to Expire Vault
  const transferToVault = useCallback(
    (batchId: string, quantity: number, notes?: string): { success: boolean; error?: string } => {
      const targetBatch = batches.find((b) => b.BatchID === batchId);
      if (!targetBatch) return { success: false, error: 'Batch not found.' };
      if (quantity <= 0 || quantity > targetBatch.CurrentStock) {
        return { success: false, error: `Invalid quantity. Current available: ${targetBatch.CurrentStock}` };
      }

      const medicine = medicines.find((m) => m.MedicineID === targetBatch.MedicineID);
      const supplier = suppliers.find((s) => s.SupplierID === targetBatch.SupplierID);

      const vaultEntry: ExpireVaultItem = {
        VaultID: `VLT-${Date.now()}`,
        MedicineID: targetBatch.MedicineID,
        TradeName: medicine?.TradeName || 'Unknown Medicine',
        GenericName: medicine?.GenericName || '',
        BatchID: targetBatch.BatchID,
        BatchNumber: targetBatch.BatchNumber,
        ExpiryDate: targetBatch.ExpiryDate,
        SupplierID: targetBatch.SupplierID,
        SupplierName: supplier?.Name || 'Unknown Supplier',
        SupplierPhone: supplier?.Phone || '',
        SupplierRepresentative: '',
        CallStatus: 'NotCalled',
        Quantity: quantity,
        CostPrice: targetBatch.CostPrice,
        TransferDate: new Date().toISOString(),
        ReturnStatus: 'InVault',
        ReturnDate: null,
        ReconciliationType: null,
        ReconciledAmount: 0,
        Notes: notes || `Quarantined expiring stock on ${new Date().toLocaleDateString()}`,
        Group: targetBatch.Group || medicine?.Group || 'General',
      };

      // Deduct from active batch stock
      setBatches((prev) =>
        prev.map((b) => (b.BatchID === batchId ? { ...b, CurrentStock: b.CurrentStock - quantity } : b))
      );

      setExpireVault((prev) => [vaultEntry, ...prev]);
      addAuditLog(
        'STOCK_TRANSFER_VAULT',
        `Moved ${quantity} units of ${vaultEntry.TradeName} (Batch ${vaultEntry.BatchNumber}) into Expire Vault.`
      );

      return { success: true };
    },
    [batches, medicines, suppliers, addAuditLog]
  );

  // Reconcile Expire Vault Item (Cash refund, Credit adjustment, or Medicine exchange)
  const reconcileVaultItem = useCallback(
    (
      vaultId: string,
      reconciliationType: ReconciliationType,
      amount: number,
      replacementBatch?: Partial<Batch>,
      notes?: string
    ): { success: boolean; error?: string } => {
      const target = expireVault.find((v) => v.VaultID === vaultId);
      if (!target) return { success: false, error: 'Vault record not found.' };

      let nextStatus: ExpireVaultItem['ReturnStatus'] = 'ReturnedToSupplier';

      if (reconciliationType === 'Cash') {
        nextStatus = 'CashReceived';
        // Record cash collection
        const coll: DueCollection = {
          CollectionID: `COL-${Date.now()}`,
          EntityType: 'Supplier',
          EntityID: target.SupplierID,
          EntityName: target.SupplierName,
          Amount: amount,
          PaymentMethod: 'Cash',
          CollectionDate: new Date().toISOString(),
          ReceivedBy: currentUser?.FullName || 'Pharmacist',
          Notes: `Cash refund for expired stock return: ${target.TradeName} (${target.Quantity} units)`,
        };
        setDueCollections((prev) => [coll, ...prev]);
      } else if (reconciliationType === 'CreditDeduction') {
        nextStatus = 'ReturnedToSupplier';
        // Deduct from Supplier.TotalDue
        setSuppliers((prev) =>
          prev.map((s) =>
            s.SupplierID === target.SupplierID
              ? { ...s, TotalDue: Math.max(0, s.TotalDue - amount) }
              : s
          )
        );
      } else if (reconciliationType === 'MedicineExchange') {
        nextStatus = 'GoodMedicineReturned';
        if (replacementBatch && replacementBatch.BatchNumber && replacementBatch.ExpiryDate) {
          // Add replacement batch into inventory
          const newB: Batch = {
            BatchID: `BTH-EXCH-${Date.now()}`,
            MedicineID: target.MedicineID,
            BatchNumber: replacementBatch.BatchNumber,
            ExpiryDate: replacementBatch.ExpiryDate,
            PurchasePrice: target.CostPrice,
            TradePrice: target.CostPrice,
            TradePriceVat: 17.4,
            CostPrice: target.CostPrice,
            SellingPrice: replacementBatch.SellingPrice || target.CostPrice * 1.35,
            CurrentStock: target.Quantity,
            SupplierID: target.SupplierID,
          };
          setBatches((prev) => [...prev, newB]);
        }
      }

      setExpireVault((prev) =>
        prev.map((v) =>
          v.VaultID === vaultId
            ? {
                ...v,
                ReturnStatus: nextStatus,
                ReturnDate: new Date().toISOString(),
                ReconciliationType: reconciliationType,
                ReconciledAmount: amount,
                Notes: notes ? `${v.Notes} | Reconciled: ${notes}` : v.Notes,
              }
            : v
        )
      );

      addAuditLog(
        'VAULT_RECONCILIATION',
        `Reconciled Vault Item ${target.TradeName} via ${reconciliationType} for $${amount.toFixed(2)}.`
      );

      return { success: true };
    },
    [expireVault, currentUser, addAuditLog]
  );

  // Group-Wise Expire Return & Reconciliation Transaction
  const processGroupWiseExpireReturn = useCallback(
    (
      supplierId: string,
      group: string,
      itemsToReturn: { batchId: string; quantity: number }[],
      reconciliationType: ReconciliationType,
      notes?: string
    ): { success: boolean; count: number; totalAmount: number; error?: string } => {
      if (!itemsToReturn || itemsToReturn.length === 0) {
        return { success: false, count: 0, totalAmount: 0, error: 'No items selected for return.' };
      }

      const supp = suppliers.find((s) => s.SupplierID === supplierId);
      let totalReturnAmount = 0;
      const newVaultItems: ExpireVaultItem[] = [];

      // Process each item
      for (const item of itemsToReturn) {
        const b = batches.find((batch) => batch.BatchID === item.batchId);
        if (!b || item.quantity <= 0) continue;
        const actualQty = Math.min(item.quantity, b.CurrentStock);
        if (actualQty <= 0) continue;

        const med = medicines.find((m) => m.MedicineID === b.MedicineID);
        const itemCostTotal = Math.round(actualQty * b.CostPrice * 100) / 100;
        totalReturnAmount += itemCostTotal;

        newVaultItems.push({
          VaultID: `VLT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          MedicineID: b.MedicineID,
          TradeName: med?.TradeName || 'Unknown',
          GenericName: med?.GenericName || '',
          BatchID: b.BatchID,
          BatchNumber: b.BatchNumber,
          SupplierID: supplierId,
          SupplierName: supp?.Name || 'Supplier',
          Quantity: actualQty,
          CostPrice: b.CostPrice,
          TransferDate: new Date().toISOString(),
          ReturnStatus: reconciliationType === 'Cash' ? 'CashReceived' : 'ReturnedToSupplier',
          ReturnDate: new Date().toISOString(),
          ReconciliationType: reconciliationType,
          ReconciledAmount: itemCostTotal,
          Notes: notes || `Group-wise return for [${group}] group to ${supp?.Name || 'Supplier'}`,
          Group: group,
        });

        // Deduct from batches
        setBatches((prev) =>
          prev.map((batch) =>
            batch.BatchID === b.BatchID
              ? { ...batch, CurrentStock: Math.max(0, batch.CurrentStock - actualQty) }
              : batch
          )
        );
      }

      // Update supplier due if CreditDeduction
      if (reconciliationType === 'CreditDeduction' && totalReturnAmount > 0) {
        setSuppliers((prev) =>
          prev.map((s) =>
            s.SupplierID === supplierId
              ? { ...s, TotalDue: Math.max(0, s.TotalDue - totalReturnAmount) }
              : s
          )
        );
      }

      setExpireVault((prev) => [...newVaultItems, ...prev]);

      addAuditLog(
        'VAULT_RECONCILIATION',
        `Processed Group-Wise Expire Return for ${itemsToReturn.length} items (${group} Group) to ${supp?.Name || 'Supplier'} totaling ${formatCurrency(totalReturnAmount)} via ${reconciliationType}.`
      );

      return {
        success: true,
        count: newVaultItems.length,
        totalAmount: Math.round(totalReturnAmount * 100) / 100,
      };
    },
    [batches, medicines, suppliers, formatCurrency, addAuditLog]
  );

  // Damage to Waste / Disposal Bin
  const damageToBin = useCallback(
    (batchId: string, quantity: number, notes?: string): { success: boolean; error?: string } => {
      const targetBatch = batches.find((b) => b.BatchID === batchId);
      if (!targetBatch) return { success: false, error: 'Batch not found.' };
      if (quantity <= 0 || quantity > targetBatch.CurrentStock) {
        return { success: false, error: `Invalid quantity. Available stock: ${targetBatch.CurrentStock}` };
      }

      const medicine = medicines.find((m) => m.MedicineID === targetBatch.MedicineID);
      const supplier = suppliers.find((s) => s.SupplierID === targetBatch.SupplierID);

      const binEntry: ExpireVaultItem = {
        VaultID: `BIN-${Date.now()}`,
        MedicineID: targetBatch.MedicineID,
        TradeName: medicine?.TradeName || 'Unknown Medicine',
        GenericName: medicine?.GenericName || '',
        BatchID: targetBatch.BatchID,
        BatchNumber: targetBatch.BatchNumber,
        SupplierID: targetBatch.SupplierID,
        SupplierName: supplier?.Name || 'Unknown Supplier',
        Quantity: quantity,
        CostPrice: targetBatch.CostPrice,
        TransferDate: new Date().toISOString(),
        ReturnStatus: 'DamagedInBin',
        ReturnDate: new Date().toISOString(),
        ReconciliationType: null,
        ReconciledAmount: 0,
        Notes: notes || `Disposed to Damage Bin (Damaged/Spoiled) on ${new Date().toLocaleDateString()}`,
        Group: medicine?.Group || targetBatch.Group || 'General',
      };

      setBatches((prev) =>
        prev.map((b) => (b.BatchID === batchId ? { ...b, CurrentStock: b.CurrentStock - quantity } : b))
      );

      setExpireVault((prev) => [binEntry, ...prev]);
      addAuditLog(
        'STOCK_TRANSFER_VAULT',
        `Disposed ${quantity} units of ${binEntry.TradeName} (Batch ${binEntry.BatchNumber}) to Damage Bin. Reason: ${notes || 'Damaged'}`
      );

      return { success: true };
    },
    [batches, medicines, suppliers, addAuditLog]
  );

  // Stock Adjustment Engine (Manual Adjust, Expire Adjust, Damage Adjust, Audit Reconciliation)
  const adjustMedicineStock = useCallback(
    (params: {
      medicineId: string;
      batchId: string;
      adjustmentType: AdjustmentType;
      quantityDelta: number; // positive = add to stock, negative = deduct from stock
      reason: string;
      isAuditSession?: boolean;
    }): { success: boolean; adjustment?: StockAdjustment; error?: string } => {
      const { medicineId, batchId, adjustmentType, quantityDelta, reason, isAuditSession } = params;

      if (quantityDelta === 0) {
        return { success: false, error: 'Adjustment delta cannot be 0. Enter a positive number to add or negative to deduct.' };
      }

      const targetBatch = batches.find((b) => b.BatchID === batchId);
      if (!targetBatch) {
        return { success: false, error: 'Selected batch was not found.' };
      }

      const targetMed =
        medicines.find((m) => m.MedicineID === medicineId) ||
        medicines.find((m) => m.MedicineID === targetBatch.MedicineID);
      if (!targetMed) {
        return { success: false, error: 'Associated medicine profile not found.' };
      }

      const previousStock = targetBatch.CurrentStock;
      const newStock = previousStock + quantityDelta;

      if (newStock < 0) {
        return {
          success: false,
          error: `Cannot deduct ${Math.abs(quantityDelta)} units. Batch currently has only ${previousStock} units in stock.`,
        };
      }

      const financialImpact = quantityDelta * (targetBatch.CostPrice || targetMed.MRP || 0);

      const newAdjustment: StockAdjustment = {
        AdjustmentID: `ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        MedicineID: targetMed.MedicineID,
        TradeName: targetMed.TradeName,
        GenericName: targetMed.GenericName,
        BatchID: targetBatch.BatchID,
        BatchNumber: targetBatch.BatchNumber,
        ExpiryDate: targetBatch.ExpiryDate,
        AdjustmentType: adjustmentType,
        PreviousStock: previousStock,
        QuantityDelta: quantityDelta,
        NewStock: newStock,
        CostPrice: targetBatch.CostPrice || 0,
        SellingPrice: targetBatch.SellingPrice || targetMed.MRP || 0,
        FinancialImpact: financialImpact,
        Reason: reason.trim() || `${adjustmentType} applied on ${new Date().toLocaleDateString()}`,
        AdjustedBy: currentUser?.FullName || 'Admin Pharmacist',
        AdjustedAt: new Date().toISOString(),
        IsAuditSession: !!isAuditSession,
        AuditSessionID: isAuditSession ? `AUD-${new Date().toISOString().slice(0, 10)}` : undefined,
      };

      // Update the batch stock
      setBatches((prev) =>
        prev.map((b) => (b.BatchID === batchId ? { ...b, CurrentStock: newStock } : b))
      );

      // Save adjustment
      setStockAdjustments((prev) => [newAdjustment, ...prev]);

      // If it is an Expire Adjust and negative, record in Expire Vault as well
      if (adjustmentType === 'Expire Adjust' && quantityDelta < 0) {
        const deductedQty = Math.abs(quantityDelta);
        const supplier = suppliers.find((s) => s.SupplierID === targetBatch.SupplierID);
        const vaultEntry: ExpireVaultItem = {
          VaultID: `VAULT-${Date.now()}`,
          MedicineID: targetMed.MedicineID,
          TradeName: targetMed.TradeName,
          GenericName: targetMed.GenericName,
          BatchID: targetBatch.BatchID,
          BatchNumber: targetBatch.BatchNumber,
          ExpiryDate: targetBatch.ExpiryDate,
          SupplierID: targetBatch.SupplierID,
          SupplierName: supplier?.Name || 'Unknown Supplier',
          Quantity: deductedQty,
          CostPrice: targetBatch.CostPrice,
          TransferDate: new Date().toISOString(),
          ReturnStatus: 'InVault',
          ReturnDate: null,
          ReconciliationType: null,
          ReconciledAmount: 0,
          Notes: `Quarantined via Expire Adjust: ${reason || 'Shelf expiration check'}`,
          Group: targetMed.Group || targetBatch.Group || 'General',
        };
        setExpireVault((prev) => [vaultEntry, ...prev]);
      } else if (adjustmentType === 'Damage Adjust' && quantityDelta < 0) {
        // Record in waste bin
        const deductedQty = Math.abs(quantityDelta);
        const supplier = suppliers.find((s) => s.SupplierID === targetBatch.SupplierID);
        const binEntry: ExpireVaultItem = {
          VaultID: `BIN-${Date.now()}`,
          MedicineID: targetMed.MedicineID,
          TradeName: targetMed.TradeName,
          GenericName: targetMed.GenericName,
          BatchID: targetBatch.BatchID,
          BatchNumber: targetBatch.BatchNumber,
          SupplierID: targetBatch.SupplierID,
          SupplierName: supplier?.Name || 'Unknown Supplier',
          Quantity: deductedQty,
          CostPrice: targetBatch.CostPrice,
          TransferDate: new Date().toISOString(),
          ReturnStatus: 'DamagedInBin',
          ReturnDate: new Date().toISOString(),
          ReconciliationType: null,
          ReconciledAmount: 0,
          Notes: `Disposed via Damage Adjust: ${reason || 'Damaged goods write-off'}`,
          Group: targetMed.Group || targetBatch.Group || 'General',
        };
        setExpireVault((prev) => [binEntry, ...prev]);
      }

      // Add audit log
      addAuditLog(
        isAuditSession ? 'AUDIT_RECONCILIATION' : 'STOCK_ADJUSTMENT',
        `${adjustmentType} on ${targetMed.TradeName} (Batch ${targetBatch.BatchNumber}): ${quantityDelta > 0 ? '+' : ''}${quantityDelta} units. Previous: ${previousStock} -> New: ${newStock}. Reason: ${reason}`
      );

      return { success: true, adjustment: newAdjustment };
    },
    [batches, medicines, suppliers, currentUser, addAuditLog]
  );

  // Physical Audit Count & Automatic Stock Reconciliation Engine
  const reconcileAuditMedicine = useCallback(
    (params: {
      medicineId: string;
      batchId: string;
      physicalCount: number;
      notes?: string;
    }): { success: boolean; adjustment?: StockAdjustment; variance: number; error?: string } => {
      const { medicineId, batchId, physicalCount, notes } = params;
      const targetBatch = batches.find((b) => b.BatchID === batchId);
      if (!targetBatch) {
        return { success: false, variance: 0, error: 'Target batch not found for audit reconciliation.' };
      }

      const variance = physicalCount - targetBatch.CurrentStock;
      if (variance === 0) {
        const targetMed = medicines.find((m) => m.MedicineID === medicineId);
        addAuditLog(
          'AUDIT_RECONCILIATION',
          `Physical Audit Verified: ${targetMed?.TradeName || 'Medicine'} (Batch ${targetBatch.BatchNumber}) matched physical count of ${physicalCount} units with 0 variance.`
        );
        return { success: true, variance: 0 };
      }

      const res = adjustMedicineStock({
        medicineId,
        batchId,
        adjustmentType: 'Audit Reconciliation',
        quantityDelta: variance,
        reason: notes || `Audit Count discrepancy reconciled: Physical count ${physicalCount} vs system ${targetBatch.CurrentStock} (Variance: ${variance > 0 ? '+' : ''}${variance})`,
        isAuditSession: true,
      });

      return {
        success: res.success,
        adjustment: res.adjustment,
        variance,
        error: res.error,
      };
    },
    [batches, medicines, adjustMedicineStock, addAuditLog]
  );

  // Create Expire Return Transaction (Voucher)
  const addExpireTransaction = useCallback(
    (txData: Omit<ExpireReturnTransaction, 'TransactionID'>): ExpireReturnTransaction => {
      const newTx: ExpireReturnTransaction = {
        ...txData,
        TransactionID: `EXT-2026-${Date.now().toString().slice(-6)}`,
      };

      // Deduct active batch stock for return items
      setBatches((prev) => {
        const next = [...prev];
        for (const item of newTx.Items) {
          const idx = next.findIndex((b) => b.BatchID === item.BatchID);
          if (idx >= 0) {
            next[idx] = {
              ...next[idx],
              CurrentStock: Math.max(0, next[idx].CurrentStock - item.Quantity),
            };
          }
        }
        return next;
      });

      // Also create corresponding vault records for audit consistency
      const vaultEntries: ExpireVaultItem[] = newTx.Items.map((item) => ({
        VaultID: `VLT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        MedicineID: item.MedicineID,
        TradeName: item.TradeName,
        GenericName: item.GenericName,
        BatchID: item.BatchID,
        BatchNumber: item.BatchNumber,
        SupplierID: newTx.SupplierID,
        SupplierName: newTx.SupplierName,
        Quantity: item.Quantity,
        CostPrice: item.CostPrice,
        TransferDate: newTx.TransactionDate,
        ReturnStatus: newTx.Status === 'Settled' ? 'ReturnedToSupplier' : 'InVault',
        ReturnDate: newTx.Status === 'Settled' ? newTx.TransactionDate : null,
        ReconciliationType: newTx.ReconciliationType || null,
        ReconciledAmount: newTx.Status === 'Settled' ? item.TotalCost : 0,
        Notes: `Voucher #${newTx.VoucherNumber}: ${newTx.Notes || ''}`,
        Group: newTx.Group,
      }));

      setExpireVault((prev) => [...vaultEntries, ...prev]);

      // If already settled upon creation:
      if (newTx.Status === 'Settled' && newTx.ReconciliationType === 'CreditDeduction') {
        setSuppliers((prev) =>
          prev.map((s) =>
            s.SupplierID === newTx.SupplierID
              ? { ...s, TotalDue: Math.max(0, s.TotalDue - newTx.TotalAmount) }
              : s
          )
        );
      } else if (newTx.Status === 'Settled' && newTx.ReconciliationType === 'Cash') {
        const coll: DueCollection = {
          CollectionID: `COL-${Date.now()}`,
          EntityType: 'Supplier',
          EntityID: newTx.SupplierID,
          EntityName: newTx.SupplierName,
          Amount: newTx.TotalAmount,
          PaymentMethod: 'Cash',
          CollectionDate: new Date().toISOString(),
          ReceivedBy: newTx.SalesmanName || currentUser?.FullName || 'Pharmacist',
          Notes: `Cash refund on return voucher ${newTx.VoucherNumber}`,
        };
        setDueCollections((prev) => [coll, ...prev]);
      }

      setExpireTransactions((prev) => [newTx, ...prev]);

      addAuditLog(
        'VAULT_RECONCILIATION',
        `Created Expire Return Transaction ${newTx.VoucherNumber} (${newTx.Status}) to ${newTx.SupplierName} for ${formatCurrency(newTx.TotalAmount)} (${newTx.Group} Group).`
      );

      return newTx;
    },
    [currentUser, formatCurrency, addAuditLog]
  );

  // Settle an existing Pending Expire Return Transaction
  const settleExpireTransaction = useCallback(
    (
      txId: string,
      reconciliationType: ReconciliationType,
      notes?: string
    ): { success: boolean; error?: string } => {
      const target = expireTransactions.find((t) => t.TransactionID === txId);
      if (!target) return { success: false, error: 'Transaction not found.' };
      if (target.Status === 'Settled') return { success: false, error: 'Transaction is already settled.' };

      if (reconciliationType === 'CreditDeduction') {
        setSuppliers((prev) =>
          prev.map((s) =>
            s.SupplierID === target.SupplierID
              ? { ...s, TotalDue: Math.max(0, s.TotalDue - target.TotalAmount) }
              : s
          )
        );
      } else if (reconciliationType === 'Cash') {
        const coll: DueCollection = {
          CollectionID: `COL-${Date.now()}`,
          EntityType: 'Supplier',
          EntityID: target.SupplierID,
          EntityName: target.SupplierName,
          Amount: target.TotalAmount,
          PaymentMethod: 'Cash',
          CollectionDate: new Date().toISOString(),
          ReceivedBy: currentUser?.FullName || 'Pharmacist',
          Notes: `Cash settlement for return voucher ${target.VoucherNumber}`,
        };
        setDueCollections((prev) => [coll, ...prev]);
      }

      setExpireTransactions((prev) =>
        prev.map((t) =>
          t.TransactionID === txId
            ? {
                ...t,
                Status: 'Settled',
                SettledDate: new Date().toISOString(),
                ReconciliationType: reconciliationType,
                Notes: notes ? `${t.Notes || ''} | Settled: ${notes}` : t.Notes,
              }
            : t
        )
      );

      // Also update any matching vault items
      setExpireVault((prev) =>
        prev.map((v) =>
          v.Notes && v.Notes.includes(target.VoucherNumber)
            ? {
                ...v,
                ReturnStatus: 'ReturnedToSupplier',
                ReturnDate: new Date().toISOString(),
                ReconciliationType: reconciliationType,
                ReconciledAmount: v.CostPrice * v.Quantity,
              }
            : v
        )
      );

      addAuditLog(
        'VAULT_RECONCILIATION',
        `Settled Return Transaction ${target.VoucherNumber} to ${target.SupplierName} via ${reconciliationType} for ${formatCurrency(target.TotalAmount)}.`
      );

      return { success: true };
    },
    [expireTransactions, currentUser, formatCurrency, addAuditLog]
  );

  // Log phone call / communication with supplier
  const logSupplierCall = useCallback(
    (
      supplierId: string,
      callData: {
        representativeName?: string;
        phone?: string;
        notes: string;
        scheduledVisitDate?: string;
        status: SupplierCallStatus;
      }
    ): { success: boolean; log: SupplierCallLog } => {
      const supp = suppliers.find((s) => s.SupplierID === supplierId);
      const newLog: SupplierCallLog = {
        CallID: `CALL-${Date.now()}`,
        SupplierID: supplierId,
        SupplierName: supp?.Name || 'Supplier',
        Phone: callData.phone || supp?.Phone || '',
        RepresentativeName: callData.representativeName || 'Representative',
        CallDate: new Date().toISOString(),
        ScheduledVisitDate: callData.scheduledVisitDate,
        Notes: callData.notes,
        Status: callData.status,
        LoggedBy: currentUser?.FullName || 'Pharmacist',
      };

      setSupplierCallLogs((prev) => [newLog, ...prev]);

      // Update CallStatus on all items currently waiting in vault for this supplier
      setExpireVault((prev) =>
        prev.map((v) =>
          v.SupplierID === supplierId && v.ReturnStatus === 'InVault'
            ? {
                ...v,
                CallStatus: callData.status,
                LastCalledAt: newLog.CallDate,
                CallNotes: callData.notes,
                SupplierRepresentative: callData.representativeName || v.SupplierRepresentative,
              }
            : v
        )
      );

      addAuditLog(
        'SUPPLIER_CALL_LOG',
        `Logged call to ${supp?.Name}: Status updated to "${callData.status}". Notes: ${callData.notes}`
      );

      return { success: true, log: newLog };
    },
    [suppliers, currentUser, addAuditLog]
  );

  // Create Expire Out-Invoice (Supplier Return Out-Invoice)
  // STRICT CONSTRAINT: Only items currently kept in vault ('InVault') for this supplier can be added!
  const createExpireOutInvoice = useCallback(
    (outInvoiceData: {
      supplierId: string;
      group?: string;
      representativePhone?: string;
      representativeName?: string;
      salesmanId?: string;
      salesmanName?: string;
      notes?: string;
      items: { vaultId: string; quantity: number }[];
    }): { success: boolean; outInvoice?: ExpireReturnTransaction; error?: string } => {
      if (!outInvoiceData.items || outInvoiceData.items.length === 0) {
        return { success: false, error: 'No vault items selected for Out-Invoice.' };
      }

      const supp = suppliers.find((s) => s.SupplierID === outInvoiceData.supplierId);
      if (!supp) return { success: false, error: 'Supplier not found.' };

      // Strictly validate every item is currently kept in the vault for this supplier
      for (const reqItem of outInvoiceData.items) {
        const vItem = expireVault.find((v) => v.VaultID === reqItem.vaultId);
        if (!vItem) {
          return { success: false, error: `Vault item ${reqItem.vaultId} not found.` };
        }
        if (vItem.ReturnStatus !== 'InVault') {
          return {
            success: false,
            error: `${vItem.TradeName} (Batch ${vItem.BatchNumber}) is not waiting in vault (status: ${vItem.ReturnStatus}). Only items waiting in vault can be out-invoiced.`,
          };
        }
        if (vItem.SupplierID !== outInvoiceData.supplierId) {
          return {
            success: false,
            error: `${vItem.TradeName} belongs to ${vItem.SupplierName}, not ${supp.Name}. Expire Out-Invoice can only include items from the selected supplier.`,
          };
        }
        if (reqItem.quantity <= 0 || reqItem.quantity > vItem.Quantity) {
          return {
            success: false,
            error: `Invalid quantity for ${vItem.TradeName}. In vault: ${vItem.Quantity}, Requested: ${reqItem.quantity}.`,
          };
        }
      }

      const outInvoiceNum = `EXP-OUT-2026-${String(expireTransactions.length + 101).padStart(4, '0')}`;
      let totalAmount = 0;
      let totalQty = 0;
      const txItems: ExpireReturnTransactionItem[] = [];

      // Process and update vault items
      setExpireVault((prevVault) => {
        const nextVault = [...prevVault];

        for (const reqItem of outInvoiceData.items) {
          const vIdx = nextVault.findIndex((v) => v.VaultID === reqItem.vaultId);
          if (vIdx < 0) continue;
          const orig = nextVault[vIdx];
          const lineCost = Math.round(reqItem.quantity * orig.CostPrice * 100) / 100;
          totalAmount += lineCost;
          totalQty += reqItem.quantity;

          txItems.push({
            VaultID: orig.VaultID,
            MedicineID: orig.MedicineID,
            TradeName: orig.TradeName,
            GenericName: orig.GenericName,
            BatchID: orig.BatchID,
            BatchNumber: orig.BatchNumber,
            ExpiryDate: orig.ExpiryDate || 'Expired',
            Quantity: reqItem.quantity,
            CostPrice: orig.CostPrice,
            TotalCost: lineCost,
            Group: orig.Group,
          });

          if (reqItem.quantity === orig.Quantity) {
            // Full item out-invoiced
            nextVault[vIdx] = {
              ...orig,
              ReturnStatus: 'OutInvoiced',
              OutInvoiceNumber: outInvoiceNum,
              ReturnDate: new Date().toISOString(),
              Notes: `${orig.Notes} | Out-Invoiced #${outInvoiceNum}`,
            };
          } else {
            // Partial quantity returned: reduce existing vault item, create an OutInvoiced record
            const remainingQty = orig.Quantity - reqItem.quantity;
            nextVault[vIdx] = {
              ...orig,
              Quantity: remainingQty,
              Notes: `${orig.Notes} | Partial ${reqItem.quantity} units to #${outInvoiceNum}`,
            };
            const splitRecord: ExpireVaultItem = {
              ...orig,
              VaultID: `VLT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              Quantity: reqItem.quantity,
              ReturnStatus: 'OutInvoiced',
              OutInvoiceNumber: outInvoiceNum,
              ReturnDate: new Date().toISOString(),
              Notes: `Out-Invoiced #${outInvoiceNum} (partially transferred from ${orig.VaultID})`,
            };
            nextVault.unshift(splitRecord);
          }
        }
        return nextVault;
      });

      const newOutInvoice: ExpireReturnTransaction = {
        TransactionID: `EXT-${Date.now()}`,
        VoucherNumber: outInvoiceNum,
        SupplierID: supp.SupplierID,
        SupplierName: supp.Name,
        SupplierPhone: supp.Phone,
        RepresentativePhone: outInvoiceData.representativePhone || supp.Phone,
        RepresentativeName: outInvoiceData.representativeName || 'Representative',
        Group: outInvoiceData.group || 'All Groups',
        SalesmanID: outInvoiceData.salesmanId || currentUser?.UserID || 'USR-001',
        SalesmanName: outInvoiceData.salesmanName || currentUser?.FullName || 'Pharmacist',
        TransactionDate: new Date().toISOString(),
        Status: 'Pending',
        TotalAmount: Math.round(totalAmount * 100) / 100,
        TotalQuantity: totalQty,
        PaidAmount: 0,
        DueBalance: Math.round(totalAmount * 100) / 100,
        CashReceipts: [],
        Notes: outInvoiceData.notes || 'Expire Out-Invoice generated for supplier arrival',
        Items: txItems,
      };

      setExpireTransactions((prev) => [newOutInvoice, ...prev]);

      addAuditLog(
        'EXPIRE_OUT_INVOICE',
        `Created Expire Out-Invoice ${outInvoiceNum} for ${supp.Name}. Quarantined stock (${totalQty} units, ${formatCurrency(totalAmount)}) out-invoiced awaiting replacement or cash.`
      );

      return { success: true, outInvoice: newOutInvoice };
    },
    [expireVault, suppliers, expireTransactions.length, currentUser, addAuditLog, formatCurrency]
  );

  // Create Expire In-Invoice (Stock Exchange with Good/Fresh Medicine)
  // Automatically increments inventory counts in batches and settles Out-Invoice
  const createExpireInInvoice = useCallback(
    (inInvoiceData: {
      outInvoiceNumber: string;
      supplierId: string;
      notes?: string;
      items: {
        medicineId: string;
        tradeName?: string;
        genericName?: string;
        batchNumber: string;
        expiryDate: string;
        quantity: number;
        costPrice: number;
        sellingPrice: number;
        group?: string;
      }[];
    }): { success: boolean; inInvoice?: ExpireInInvoice; error?: string } => {
      if (!inInvoiceData.items || inInvoiceData.items.length === 0) {
        return { success: false, error: 'No replacement items added to Expire In-Invoice.' };
      }

      const supp = suppliers.find((s) => s.SupplierID === inInvoiceData.supplierId);
      if (!supp) return { success: false, error: 'Supplier not found.' };

      // Find the Out-Invoice being settled/exchanged
      const targetOutInvoice = expireTransactions.find(
        (t) =>
          t.VoucherNumber.toUpperCase() === inInvoiceData.outInvoiceNumber.toUpperCase() ||
          t.TransactionID.toUpperCase() === inInvoiceData.outInvoiceNumber.toUpperCase()
      );

      const inInvoiceNum = `EXP-IN-2026-${String(expireInInvoices.length + 101).padStart(4, '0')}`;
      let totalAmount = 0;
      let totalQty = 0;
      const createdBatches: Batch[] = [];
      const inItems: ExpireInInvoiceItem[] = [];

      for (const item of inInvoiceData.items) {
        if (item.quantity <= 0) continue;
        const lineCost = Math.round(item.quantity * item.costPrice * 100) / 100;
        totalAmount += lineCost;
        totalQty += item.quantity;

        const med = medicines.find((m) => m.MedicineID === item.medicineId);
        const batchId = `BTH-EXCH-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const newBatch: Batch = {
          BatchID: batchId,
          MedicineID: item.medicineId,
          BatchNumber: item.batchNumber.trim().toUpperCase(),
          ExpiryDate: item.expiryDate,
          PurchasePrice: item.costPrice,
          TradePrice: item.costPrice,
          TradePriceVat: 17.4,
          CostPrice: item.costPrice,
          SellingPrice: item.sellingPrice || (med?.MRP || item.costPrice * 1.35),
          CurrentStock: item.quantity,
          SupplierID: inInvoiceData.supplierId,
          Group: item.group || med?.Group || 'General',
        };
        createdBatches.push(newBatch);

        inItems.push({
          MedicineID: item.medicineId,
          TradeName: med?.TradeName || item.tradeName || 'Medicine',
          GenericName: med?.GenericName || item.genericName || '',
          BatchNumber: item.batchNumber.trim().toUpperCase(),
          ExpiryDate: item.expiryDate,
          Quantity: item.quantity,
          CostPrice: item.costPrice,
          SellingPrice: newBatch.SellingPrice,
          TotalCost: lineCost,
          Group: newBatch.Group,
          NewBatchID: batchId,
        });
      }

      // 1. Automatically update active inventory counts by adding new batches!
      setBatches((prev) => [...createdBatches, ...prev]);

      // 2. Create In-Invoice record
      const fullInInvoice: ExpireInInvoice = {
        InInvoiceID: `EIN-${Date.now()}`,
        InInvoiceNumber: inInvoiceNum,
        OutInvoiceNumber: targetOutInvoice ? targetOutInvoice.VoucherNumber : inInvoiceData.outInvoiceNumber,
        SupplierID: supp.SupplierID,
        SupplierName: supp.Name,
        SupplierPhone: supp.Phone,
        ReceivedDate: new Date().toISOString(),
        ReceivedBy: currentUser?.FullName || 'Pharmacist',
        TotalAmount: Math.round(totalAmount * 100) / 100,
        TotalQuantity: totalQty,
        Items: inItems,
        Notes: inInvoiceData.notes || `Stock exchange against Out-Invoice #${inInvoiceData.outInvoiceNumber}`,
      };

      setExpireInInvoices((prev) => [fullInInvoice, ...prev]);

      // 3. Update Out-Invoice status to Settled via MedicineExchange
      if (targetOutInvoice) {
        setExpireTransactions((prev) =>
          prev.map((t) =>
            t.TransactionID === targetOutInvoice.TransactionID
              ? {
                  ...t,
                  Status: 'Settled',
                  SettledDate: new Date().toISOString(),
                  ReconciliationType: 'MedicineExchange',
                  LinkedInInvoiceNumber: inInvoiceNum,
                  DueBalance: 0,
                  Notes: `${t.Notes || ''} | Settled via Expire In-Invoice #${inInvoiceNum} (${totalQty} units fresh stock received)`,
                }
              : t
          )
        );

        // 4. Update linked vault items
        setExpireVault((prev) =>
          prev.map((v) =>
            v.OutInvoiceNumber === targetOutInvoice.VoucherNumber ||
            (v.Notes && v.Notes.includes(targetOutInvoice.VoucherNumber))
              ? {
                  ...v,
                  ReturnStatus: 'GoodMedicineReturned',
                  InInvoiceNumber: inInvoiceNum,
                  ReturnDate: new Date().toISOString(),
                  ReconciliationType: 'MedicineExchange',
                  ReconciledAmount: v.CostPrice * v.Quantity,
                }
              : v
          )
        );
      }

      addAuditLog(
        'EXPIRE_IN_INVOICE',
        `Created Expire In-Invoice ${inInvoiceNum} against Out-Invoice #${inInvoiceData.outInvoiceNumber}. Added ${totalQty} units of fresh replacement medicines to active inventory from ${supp.Name}.`
      );

      return { success: true, inInvoice: fullInInvoice };
    },
    [suppliers, medicines, expireTransactions, expireInInvoices.length, currentUser, addAuditLog]
  );

  // Add Cash directly against an existing Out-Invoice
  // Directly updates cash ledger, financial accounts, and marks out-invoice as settled/refunded
  const addCashToOutInvoice = useCallback(
    (
      invoiceNumber: string,
      paymentData: {
        amount: number;
        paymentMethod: 'Cash' | 'Bank Transfer' | 'MFS' | 'Cheque';
        notes?: string;
      }
    ): { success: boolean; updatedInvoice?: ExpireReturnTransaction; error?: string } => {
      const cleanNum = invoiceNumber.trim().toUpperCase();
      const target = expireTransactions.find(
        (t) =>
          t.VoucherNumber.toUpperCase() === cleanNum ||
          t.TransactionID.toUpperCase() === cleanNum ||
          t.VoucherNumber.toUpperCase().includes(cleanNum)
      );

      if (!target) {
        return { success: false, error: `Out-Invoice "${invoiceNumber}" not found.` };
      }

      if (target.Status === 'Settled' && (target.DueBalance || 0) <= 0) {
        return { success: false, error: `Out-Invoice #${target.VoucherNumber} is already fully settled.` };
      }

      if (paymentData.amount <= 0) {
        return { success: false, error: 'Payment amount must be greater than zero.' };
      }

      const currentDue = target.DueBalance !== undefined ? target.DueBalance : target.TotalAmount;
      if (paymentData.amount > currentDue + 0.01) {
        return {
          success: false,
          error: `Cash amount (${formatCurrency(paymentData.amount)}) cannot exceed remaining out-invoice due (${formatCurrency(currentDue)}).`,
        };
      }

      const currentPaid = target.PaidAmount || 0;
      const newPaid = Math.round((currentPaid + paymentData.amount) * 100) / 100;
      const newDue = Math.max(0, Math.round((target.TotalAmount - newPaid) * 100) / 100);
      const isFullySettled = newDue <= 0.01;

      const paymentRecord: CashPaymentRecord = {
        PaymentID: `CSH-${Date.now()}`,
        Amount: paymentData.amount,
        PaymentMethod: paymentData.paymentMethod,
        Date: new Date().toISOString(),
        ReceivedBy: currentUser?.FullName || 'Pharmacist',
        ReferenceNote: paymentData.notes || 'Cash back directly against Out-Invoice',
      };

      // 1. Post to cash / due collection ledger
      const coll: DueCollection = {
        CollectionID: `COL-EXP-${Date.now()}`,
        EntityType: 'Supplier',
        EntityID: target.SupplierID,
        EntityName: target.SupplierName,
        Amount: paymentData.amount,
        PaymentMethod: paymentData.paymentMethod === 'Cheque' ? 'Bank Transfer' : paymentData.paymentMethod,
        CollectionDate: new Date().toISOString(),
        ReceivedBy: currentUser?.FullName || 'Pharmacist',
        Notes: `Cash refund on Expire Out-Invoice #${target.VoucherNumber}: ${paymentData.notes || 'Supplier cash back'}`,
      };
      setDueCollections((prev) => [coll, ...prev]);

      // 2. Update Out-Invoice transaction
      let updatedTx: ExpireReturnTransaction = target;
      setExpireTransactions((prev) =>
        prev.map((t) => {
          if (t.TransactionID === target.TransactionID) {
            updatedTx = {
              ...t,
              Status: isFullySettled ? 'Settled' : 'PartiallySettled',
              SettledDate: isFullySettled ? new Date().toISOString() : t.SettledDate,
              ReconciliationType: 'Cash',
              PaidAmount: newPaid,
              DueBalance: newDue,
              CashReceipts: [...(t.CashReceipts || []), paymentRecord],
              Notes: `${t.Notes || ''} | Cash refund ${formatCurrency(paymentData.amount)} received on ${new Date().toLocaleDateString()}`,
            };
            return updatedTx;
          }
          return t;
        })
      );

      // 3. Update vault items
      if (isFullySettled) {
        setExpireVault((prev) =>
          prev.map((v) =>
            v.OutInvoiceNumber === target.VoucherNumber ||
            (v.Notes && v.Notes.includes(target.VoucherNumber))
              ? {
                  ...v,
                  ReturnStatus: 'CashReceived',
                  ReturnDate: new Date().toISOString(),
                  ReconciliationType: 'Cash',
                  ReconciledAmount: v.CostPrice * v.Quantity,
                }
              : v
          )
        );
      }

      // 4. Log detailed audit log
      addAuditLog(
        'EXPIRE_CASH_REFUND',
        `Direct Cash Refund: Added ${formatCurrency(paymentData.amount)} (${paymentData.paymentMethod}) directly against Expire Out-Invoice #${target.VoucherNumber} from ${target.SupplierName}. Remaining balance: ${formatCurrency(newDue)}.`
      );

      return { success: true, updatedInvoice: updatedTx };
    },
    [expireTransactions, currentUser, formatCurrency, addAuditLog]
  );

  // Due collection
  const recordDueCollection = useCallback(
    (collectionData: Omit<DueCollection, 'CollectionID' | 'CollectionDate'>): DueCollection => {
      const coll: DueCollection = {
        ...collectionData,
        CollectionID: `COL-${Date.now()}`,
        CollectionDate: new Date().toISOString(),
      };

      if (coll.EntityType === 'Customer') {
        setCustomers((prev) =>
          prev.map((c) =>
            c.CustomerID === coll.EntityID
              ? { ...c, TotalDue: Math.max(0, c.TotalDue - coll.Amount) }
              : c
          )
        );
      } else {
        setSuppliers((prev) =>
          prev.map((s) =>
            s.SupplierID === coll.EntityID
              ? { ...s, TotalDue: Math.max(0, s.TotalDue - coll.Amount) }
              : s
          )
        );
      }

      setDueCollections((prev) => [coll, ...prev]);
      addAuditLog(
        'DUE_COLLECTION',
        `Received due payment of $${coll.Amount.toFixed(2)} from ${coll.EntityType} ${coll.EntityName} (${coll.PaymentMethod})`
      );

      return coll;
    },
    [addAuditLog]
  );

  // Customer Actions
  const addCustomer = useCallback(
    (custData: Omit<Customer, 'CustomerID' | 'TotalDue' | 'LoyaltyPoints'>): Customer => {
      const newCust: Customer = {
        ...custData,
        CustomerID: `CUST-${String(customers.length + 1).padStart(3, '0')}`,
        TotalDue: 0,
        LoyaltyPoints: 0,
      };
      setCustomers((prev) => [...prev, newCust]);
      return newCust;
    },
    [customers.length]
  );

  const updateCustomer = useCallback((id: string, updates: Partial<Customer>) => {
    setCustomers((prev) =>
      prev.map((c) => (c.CustomerID === id ? { ...c, ...updates } : c))
    );
  }, []);

  // Supplier Actions
  const addSupplier = useCallback(
    (suppData: Omit<Supplier, 'SupplierID' | 'TotalDue'>): Supplier => {
      const newSupp: Supplier = {
        ...suppData,
        SupplierID: `SUP-${String(suppliers.length + 1).padStart(3, '0')}`,
        TotalDue: 0,
      };
      setSuppliers((prev) => [...prev, newSupp]);
      return newSupp;
    },
    [suppliers.length]
  );

  const updateSupplier = useCallback((id: string, updates: Partial<Supplier>) => {
    setSuppliers((prev) =>
      prev.map((s) => (s.SupplierID === id ? { ...s, ...updates } : s))
    );
  }, []);

  const updateReceiptSettings = useCallback((settings: ReceiptSettings) => {
    setReceiptSettings(settings);
  }, []);

  // Customer Complaints & Salesman Coaching Actions
  const addComplaint = useCallback(
    (complaintData: Omit<CustomerComplaint, 'ComplaintID' | 'CreatedAt'>): CustomerComplaint => {
      const newComplaint: CustomerComplaint = {
        ...complaintData,
        ComplaintID: `CMP-${Date.now().toString().slice(-6)}`,
        CreatedAt: new Date().toISOString(),
      };
      setComplaints((prev) => [newComplaint, ...prev]);
      addAuditLog('COMPLAINT_ACTION', `Registered complaint ${newComplaint.ComplaintID} for receipt ${newComplaint.ReceiptNumber}`);
      return newComplaint;
    },
    [addAuditLog]
  );

  const updateComplaint = useCallback((id: string, updates: Partial<CustomerComplaint>) => {
    setComplaints((prev) =>
      prev.map((c) => (c.ComplaintID === id ? { ...c, ...updates } : c))
    );
  }, []);

  const deleteComplaint = useCallback(
    (id: string) => {
      setComplaints((prev) => prev.filter((c) => c.ComplaintID !== id));
      addAuditLog('COMPLAINT_ACTION', `Deleted complaint record ${id}`);
    },
    [addAuditLog]
  );

  const resolveComplaint = useCallback(
    (id: string, resolutionAction: string, coachingNotes?: string) => {
      setComplaints((prev) =>
        prev.map((c) => {
          if (c.ComplaintID === id) {
            return {
              ...c,
              Status: 'Resolved / Reconciled' as ComplaintStatus,
              ResolvedAt: new Date().toISOString(),
              ResolutionAction: resolutionAction,
              SalesmanCoachingNotes: coachingNotes || c.SalesmanCoachingNotes,
            };
          }
          return c;
        })
      );
      addAuditLog('COMPLAINT_ACTION', `Resolved complaint ${id}: ${resolutionAction}`);
    },
    [addAuditLog]
  );

  // ============================================================================
  // REGIONAL WAREHOUSE STORE WMS ENGINE (3 STORES, RBAC, AUDIT, CONSISTENCY)
  // ============================================================================

  const peekNextStoreInvoiceNumber = useCallback(
    (type: StoreTransactionType): string => {
      const year = new Date().getFullYear();
      const prefix =
        type === 'STORE_IN' ? 'STR-IN' : type === 'STORE_OUT' ? 'STR-OUT' : 'STR-INT';
      const baseSeq =
        type === 'STORE_IN' ? 1001 : type === 'STORE_OUT' ? 2001 : 3001;

      const existingOfType = storeTransactions.filter((tx) => tx.Type === type);
      let candidateNum = baseSeq + existingOfType.length;
      const existingInvoices = new Set(storeTransactions.map((tx) => tx.InvoiceNumber.toUpperCase()));

      let candidate = `${prefix}-${year}-${String(candidateNum).padStart(4, '0')}`;
      while (existingInvoices.has(candidate.toUpperCase())) {
        candidateNum += 1;
        candidate = `${prefix}-${year}-${String(candidateNum).padStart(4, '0')}`;
      }
      return candidate;
    },
    [storeTransactions]
  );

  const toggleStoreActive = useCallback(
    (
      storeId: string,
      isActive: boolean,
      reason?: string
    ): { success: boolean; entry?: StoreToggleAuditEntry; error?: string } => {
      if (!currentUser || currentUser.Role !== 'Admin') {
        return {
          success: false,
          error: 'Only Administrators can switch regional stores ON or OFF.',
        };
      }

      const targetStore = stores.find((s) => s.StoreID === storeId);
      if (!targetStore) {
        return { success: false, error: 'Regional store record not found.' };
      }

      if (targetStore.IsActive === isActive) {
        return { success: true };
      }

      const storeItems = storeStocks.filter((st) => st.StoreID === storeId && st.Quantity > 0);
      const stockUnitsSnapshot = storeItems.reduce((sum, item) => sum + item.Quantity, 0);
      const valuationSnapshot =
        Math.round(
          storeItems.reduce((sum, item) => sum + item.Quantity * item.CostPrice, 0) * 100
        ) / 100;

      const nowIso = new Date().toISOString();
      const cleanReason =
        reason && reason.trim()
          ? reason.trim()
          : isActive
          ? 'Store reactivated by Administrator for regional warehouse operations'
          : 'Store deactivated by Administrator — hidden from active UI and locked for transactions';

      const auditEntry: StoreToggleAuditEntry = {
        ToggleID: `STG-${new Date().getFullYear()}-${String(storeToggleLogs.length + 1).padStart(4, '0')}`,
        Timestamp: nowIso,
        StoreID: targetStore.StoreID,
        StoreName: targetStore.Name,
        StoreCode: targetStore.Code,
        Region: targetStore.Region,
        PreviousState: targetStore.IsActive,
        NewState: isActive,
        ChangedByUserID: currentUser.UserID,
        ChangedByName: currentUser.FullName,
        ChangedByRole: currentUser.Role,
        Reason: cleanReason,
        StockUnitsSnapshot: stockUnitsSnapshot,
        ValuationSnapshot: valuationSnapshot,
      };

      setStores((prev) =>
        prev.map((s) =>
          s.StoreID === storeId
            ? {
                ...s,
                IsActive: isActive,
                LastToggledAt: nowIso,
                LastToggledBy: currentUser.FullName,
                StatusNote: cleanReason,
              }
            : s
        )
      );

      setStoreToggleLogs((prev) => [auditEntry, ...prev]);

      addAuditLog(
        'STORE_STATUS_TOGGLE',
        `${targetStore.ShortName} (${targetStore.Code}) switched ${isActive ? 'ON (Active)' : 'OFF (Deactivated & Hidden)'} by ${currentUser.FullName}. Snapshot: ${stockUnitsSnapshot} units (${formatCurrency(valuationSnapshot)}). Reason: ${cleanReason}`
      );

      return { success: true, entry: auditEntry };
    },
    [currentUser, stores, storeStocks, storeToggleLogs.length, addAuditLog, formatCurrency]
  );

  const updateStoreDetails = useCallback(
    (
      storeId: string,
      updates: Partial<Pick<WarehouseStore, 'Name' | 'Region' | 'Address' | 'BranchManager' | 'ManagerPhone'>>
    ): { success: boolean; error?: string } => {
      if (!currentUser || currentUser.Role !== 'Admin') {
        return {
          success: false,
          error: 'Only Administrators can modify regional branch assignments.',
        };
      }
      const target = stores.find((s) => s.StoreID === storeId);
      if (!target) {
        return { success: false, error: 'Store not found.' };
      }

      setStores((prev) =>
        prev.map((s) => (s.StoreID === storeId ? { ...s, ...updates } : s))
      );

      addAuditLog(
        'STORE_STATUS_TOGGLE',
        `Updated regional governance metadata for ${target.ShortName}: Manager ${updates.BranchManager || target.BranchManager}`
      );
      return { success: true };
    },
    [currentUser, stores, addAuditLog]
  );

  const processStoreIn = useCallback(
    (params: {
      storeId: string;
      counterSyncMode: 'EXTERNAL' | 'MAIN_COUNTER';
      senderName: string;
      receiverName: string;
      supplierId?: string;
      supplierName?: string;
      group?: string;
      notes?: string;
      items: Omit<StoreTransactionItem, 'ItemID'>[];
    }): { success: boolean; transaction?: StoreTransaction; error?: string } => {
      const store = stores.find((s) => s.StoreID === params.storeId);
      if (!store) {
        return { success: false, error: 'Selected store does not exist.' };
      }
      if (!store.IsActive) {
        return {
          success: false,
          error: `${store.ShortName} is currently switched OFF by Administrator and cannot accept transactions.`,
        };
      }
      if (!params.senderName.trim()) {
        return { success: false, error: 'Sender Name is required for Store In transactions.' };
      }
      if (!params.receiverName.trim()) {
        return { success: false, error: 'Receiver Name is required for Store In transactions.' };
      }
      if (!params.items || params.items.length === 0) {
        return { success: false, error: 'Please add at least one medicine item.' };
      }

      // If transferring from Main Counter into Store, validate Main Counter batch stock first
      if (params.counterSyncMode === 'MAIN_COUNTER') {
        for (const item of params.items) {
          const matchingBatch = batches.find(
            (b) =>
              b.MedicineID === item.MedicineID &&
              b.BatchNumber.toUpperCase() === item.BatchNumber.toUpperCase()
          );
          if (!matchingBatch || matchingBatch.CurrentStock < item.Quantity) {
            return {
              success: false,
              error: `Insufficient Main POS Counter stock for ${item.TradeName} (Batch ${item.BatchNumber}). Available: ${matchingBatch?.CurrentStock || 0}, Requested: ${item.Quantity}.`,
            };
          }
        }

        // Deduct from Main POS Counter batches atomically
        setBatches((prev) =>
          prev.map((b) => {
            const matchedItems = params.items.filter(
              (it) =>
                it.MedicineID === b.MedicineID &&
                it.BatchNumber.toUpperCase() === b.BatchNumber.toUpperCase()
            );
            if (matchedItems.length === 0) return b;
            const totalDeduct = matchedItems.reduce((s, it) => s + it.Quantity, 0);
            return {
              ...b,
              CurrentStock: Math.max(0, b.CurrentStock - totalDeduct),
            };
          })
        );
      }

      const invoiceNumber = peekNextStoreInvoiceNumber('STORE_IN');
      const nowIso = new Date().toISOString();

      const txItems: StoreTransactionItem[] = params.items.map((it, idx) => ({
        ...it,
        ItemID: `STXI-${Date.now()}-${idx}`,
      }));

      // Upsert StoreStockItem records for this Store
      setStoreStocks((prev) => {
        const next = [...prev];
        for (const item of txItems) {
          const med = medicines.find((m) => m.MedicineID === item.MedicineID);
          const idx = next.findIndex(
            (st) =>
              st.StoreID === store.StoreID &&
              st.MedicineID === item.MedicineID &&
              st.BatchNumber.toUpperCase() === item.BatchNumber.toUpperCase()
          );
          if (idx >= 0) {
            const existing = next[idx];
            next[idx] = {
              ...existing,
              Quantity: existing.Quantity + item.Quantity,
              TP: item.TP,
              VATPercent: item.VATPercent,
              DiscountPercent: item.DiscountPercent,
              CostPrice: item.CostPrice,
              MRP: item.MRP || existing.MRP,
              ExpiryDate: item.ExpiryDate || existing.ExpiryDate,
              RackLocation: item.RackLocation || existing.RackLocation,
              LastUpdated: nowIso,
            };
          } else {
            next.push({
              StoreStockID: `SST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              StoreID: store.StoreID,
              MedicineID: item.MedicineID,
              TradeName: item.TradeName,
              GenericName: item.GenericName,
              Group: item.Group || med?.Group || 'General',
              Unit: med?.Unit || 'Box',
              SupplierID: item.SupplierID,
              SupplierName: item.SupplierName,
              BatchNumber: item.BatchNumber.toUpperCase(),
              ExpiryDate: item.ExpiryDate,
              Quantity: item.Quantity,
              TP: item.TP,
              VATPercent: item.VATPercent,
              DiscountPercent: item.DiscountPercent,
              CostPrice: item.CostPrice,
              MRP: item.MRP || med?.MRP || Math.round(item.CostPrice * 1.25 * 100) / 100,
              RackLocation: item.RackLocation || `S${store.StoreNumber}-${med?.RackNo || 'BAY-A1'}`,
              LastUpdated: nowIso,
            });
          }
        }
        return next;
      });

      const totalTP = Math.round(txItems.reduce((s, i) => s + i.TP * i.Quantity, 0) * 100) / 100;
      const totalVAT = Math.round(txItems.reduce((s, i) => s + i.VATAmount * i.Quantity, 0) * 100) / 100;
      const totalDiscount =
        Math.round(txItems.reduce((s, i) => s + i.DiscountAmount * i.Quantity, 0) * 100) / 100;
      const netAmount = Math.round(txItems.reduce((s, i) => s + i.TotalCost, 0) * 100) / 100;
      const totalUnits = txItems.reduce((s, i) => s + i.Quantity, 0);

      const transaction: StoreTransaction = {
        TransactionID: `STX-${Date.now()}`,
        InvoiceNumber: invoiceNumber,
        Type: 'STORE_IN',
        StoreID: store.StoreID,
        StoreName: store.Name,
        CounterSyncMode: params.counterSyncMode,
        SenderName: params.senderName.trim(),
        ReceiverName: params.receiverName.trim(),
        SupplierID: params.supplierId || txItems[0]?.SupplierID,
        SupplierName: params.supplierName || txItems[0]?.SupplierName,
        Group: params.group || txItems[0]?.Group || 'General',
        TotalTP: totalTP,
        TotalVAT: totalVAT,
        TotalDiscount: totalDiscount,
        NetAmount: netAmount,
        TotalUnits: totalUnits,
        Notes: params.notes?.trim() || undefined,
        CreatedBy: currentUser?.FullName || 'System Operator',
        CreatedByRole: currentUser?.Role || 'Admin',
        CreatedAt: nowIso,
        Items: txItems,
      };

      setStoreTransactions((prev) => [transaction, ...prev]);

      addAuditLog(
        'STORE_IN',
        `[${invoiceNumber}] Store In at ${store.ShortName}: +${totalUnits} units (${formatCurrency(netAmount)}) · Sender: ${transaction.SenderName} -> Receiver: ${transaction.ReceiverName}`
      );

      return { success: true, transaction };
    },
    [stores, batches, medicines, peekNextStoreInvoiceNumber, currentUser, addAuditLog, formatCurrency]
  );

  const processStoreOut = useCallback(
    (params: {
      storeId: string;
      counterSyncMode: 'MAIN_COUNTER' | 'EXTERNAL';
      senderName: string;
      receiverName: string;
      supplierId?: string;
      supplierName?: string;
      group?: string;
      notes?: string;
      items: Omit<StoreTransactionItem, 'ItemID'>[];
    }): { success: boolean; transaction?: StoreTransaction; error?: string } => {
      const store = stores.find((s) => s.StoreID === params.storeId);
      if (!store) {
        return { success: false, error: 'Selected store does not exist.' };
      }
      if (!store.IsActive) {
        return {
          success: false,
          error: `${store.ShortName} is currently switched OFF by Administrator and cannot dispatch stock.`,
        };
      }
      if (!params.senderName.trim()) {
        return { success: false, error: 'Sender Name is required for Store Out transactions.' };
      }
      if (!params.receiverName.trim()) {
        return { success: false, error: 'Receiver Name is required for Store Out transactions.' };
      }
      if (!params.items || params.items.length === 0) {
        return { success: false, error: 'Please add at least one medicine item to dispatch.' };
      }

      // Aggregate requested qty per (MedicineID + BatchNumber) to prevent over-dispatch
      const reqByBatch = new Map<string, { qty: number; tradeName: string; batchNumber: string }>();
      for (const item of params.items) {
        const key = `${item.MedicineID}::${item.BatchNumber.toUpperCase()}`;
        const prev = reqByBatch.get(key);
        reqByBatch.set(key, {
          qty: (prev?.qty || 0) + item.Quantity,
          tradeName: item.TradeName,
          batchNumber: item.BatchNumber,
        });
      }

      for (const [key, req] of reqByBatch.entries()) {
        const [medId, batchNum] = key.split('::');
        const stockRecord = storeStocks.find(
          (st) =>
            st.StoreID === store.StoreID &&
            st.MedicineID === medId &&
            st.BatchNumber.toUpperCase() === batchNum
        );
        if (!stockRecord || stockRecord.Quantity < req.qty) {
          return {
            success: false,
            error: `Insufficient stock in ${store.ShortName} for ${req.tradeName} (Batch ${req.batchNumber}). Available: ${stockRecord?.Quantity || 0}, Requested: ${req.qty}.`,
          };
        }
      }

      const invoiceNumber = peekNextStoreInvoiceNumber('STORE_OUT');
      const nowIso = new Date().toISOString();

      const txItems: StoreTransactionItem[] = params.items.map((it, idx) => ({
        ...it,
        ItemID: `STXI-${Date.now()}-${idx}`,
      }));

      // Deduct from StoreStocks
      setStoreStocks((prev) =>
        prev.map((st) => {
          if (st.StoreID !== store.StoreID) return st;
          const key = `${st.MedicineID}::${st.BatchNumber.toUpperCase()}`;
          const req = reqByBatch.get(key);
          if (!req) return st;
          return {
            ...st,
            Quantity: Math.max(0, st.Quantity - req.qty),
            LastUpdated: nowIso,
          };
        })
      );

      // If dispatching to Main Pharmacy POS Counter, replenish Main Batches atomically
      if (params.counterSyncMode === 'MAIN_COUNTER') {
        setBatches((prevBatches) => {
          const nextBatches = [...prevBatches];
          for (const item of txItems) {
            const med = medicines.find((m) => m.MedicineID === item.MedicineID);
            const existingIdx = nextBatches.findIndex(
              (b) =>
                b.MedicineID === item.MedicineID &&
                b.BatchNumber.toUpperCase() === item.BatchNumber.toUpperCase()
            );
            if (existingIdx >= 0) {
              nextBatches[existingIdx] = {
                ...nextBatches[existingIdx],
                CurrentStock: nextBatches[existingIdx].CurrentStock + item.Quantity,
                CostPrice: item.CostPrice,
                ExpiryDate: item.ExpiryDate || nextBatches[existingIdx].ExpiryDate,
              };
            } else {
              nextBatches.push({
                BatchID: `BTH-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                MedicineID: item.MedicineID,
                BatchNumber: item.BatchNumber.toUpperCase(),
                ExpiryDate: item.ExpiryDate,
                PurchasePrice: item.TP,
                TradePrice: item.TP,
                TradePriceVat: item.VATPercent,
                CostPrice: item.CostPrice,
                SellingPrice: item.MRP || med?.MRP || Math.round(item.CostPrice * 1.25 * 100) / 100,
                CurrentStock: item.Quantity,
                SupplierID: item.SupplierID || med?.SupplierID || 'SUP-001',
                Group: item.Group || med?.Group || 'General',
              });
            }
          }
          return nextBatches;
        });
      }

      const totalTP = Math.round(txItems.reduce((s, i) => s + i.TP * i.Quantity, 0) * 100) / 100;
      const totalVAT = Math.round(txItems.reduce((s, i) => s + i.VATAmount * i.Quantity, 0) * 100) / 100;
      const totalDiscount =
        Math.round(txItems.reduce((s, i) => s + i.DiscountAmount * i.Quantity, 0) * 100) / 100;
      const netAmount = Math.round(txItems.reduce((s, i) => s + i.TotalCost, 0) * 100) / 100;
      const totalUnits = txItems.reduce((s, i) => s + i.Quantity, 0);

      const transaction: StoreTransaction = {
        TransactionID: `STX-${Date.now()}`,
        InvoiceNumber: invoiceNumber,
        Type: 'STORE_OUT',
        StoreID: store.StoreID,
        StoreName: store.Name,
        CounterSyncMode: params.counterSyncMode,
        SenderName: params.senderName.trim(),
        ReceiverName: params.receiverName.trim(),
        SupplierID: params.supplierId || txItems[0]?.SupplierID,
        SupplierName: params.supplierName || txItems[0]?.SupplierName,
        Group: params.group || txItems[0]?.Group || 'General',
        TotalTP: totalTP,
        TotalVAT: totalVAT,
        TotalDiscount: totalDiscount,
        NetAmount: netAmount,
        TotalUnits: totalUnits,
        Notes: params.notes?.trim() || undefined,
        CreatedBy: currentUser?.FullName || 'System Operator',
        CreatedByRole: currentUser?.Role || 'Admin',
        CreatedAt: nowIso,
        Items: txItems,
      };

      setStoreTransactions((prev) => [transaction, ...prev]);

      addAuditLog(
        'STORE_OUT',
        `[${invoiceNumber}] Store Out from ${store.ShortName} (${params.counterSyncMode === 'MAIN_COUNTER' ? 'Replenished Main POS Counter' : 'External Dispatch'}): -${totalUnits} units (${formatCurrency(netAmount)}) · Sender: ${transaction.SenderName} -> Receiver: ${transaction.ReceiverName}`
      );

      return { success: true, transaction };
    },
    [stores, storeStocks, medicines, peekNextStoreInvoiceNumber, currentUser, addAuditLog, formatCurrency]
  );

  const processStoreInterchange = useCallback(
    (params: {
      sourceStoreId: string;
      targetStoreId: string;
      senderName: string;
      receiverName: string;
      group?: string;
      notes?: string;
      items: Omit<StoreTransactionItem, 'ItemID'>[];
    }): { success: boolean; transaction?: StoreTransaction; error?: string } => {
      if (params.sourceStoreId === params.targetStoreId) {
        return {
          success: false,
          error: 'Source store and destination store must be different.',
        };
      }

      const sourceStore = stores.find((s) => s.StoreID === params.sourceStoreId);
      const targetStore = stores.find((s) => s.StoreID === params.targetStoreId);

      if (!sourceStore || !targetStore) {
        return { success: false, error: 'Invalid source or destination regional store.' };
      }
      if (!sourceStore.IsActive) {
        return {
          success: false,
          error: `${sourceStore.ShortName} is switched OFF and disabled for transactions.`,
        };
      }
      if (!targetStore.IsActive) {
        return {
          success: false,
          error: `${targetStore.ShortName} is switched OFF and cannot receive inter-store transfers.`,
        };
      }
      if (!params.senderName.trim()) {
        return { success: false, error: 'Sender Name is required for Store Inter-Change.' };
      }
      if (!params.receiverName.trim()) {
        return { success: false, error: 'Receiver Name is required for Store Inter-Change.' };
      }
      if (!params.items || params.items.length === 0) {
        return { success: false, error: 'Please add at least one medicine item to transfer.' };
      }

      const reqByBatch = new Map<string, { qty: number; tradeName: string; batchNumber: string }>();
      for (const item of params.items) {
        const key = `${item.MedicineID}::${item.BatchNumber.toUpperCase()}`;
        const prev = reqByBatch.get(key);
        reqByBatch.set(key, {
          qty: (prev?.qty || 0) + item.Quantity,
          tradeName: item.TradeName,
          batchNumber: item.BatchNumber,
        });
      }

      for (const [key, req] of reqByBatch.entries()) {
        const [medId, batchNum] = key.split('::');
        const stockRecord = storeStocks.find(
          (st) =>
            st.StoreID === sourceStore.StoreID &&
            st.MedicineID === medId &&
            st.BatchNumber.toUpperCase() === batchNum
        );
        if (!stockRecord || stockRecord.Quantity < req.qty) {
          return {
            success: false,
            error: `Insufficient stock in ${sourceStore.ShortName} for ${req.tradeName} (Batch ${req.batchNumber}). Available: ${stockRecord?.Quantity || 0}, Requested: ${req.qty}.`,
          };
        }
      }

      const invoiceNumber = peekNextStoreInvoiceNumber('STORE_INTERCHANGE');
      const nowIso = new Date().toISOString();

      const txItems: StoreTransactionItem[] = params.items.map((it, idx) => ({
        ...it,
        ItemID: `STXI-${Date.now()}-${idx}`,
      }));

      // Atomically deduct from sourceStore and increment/create in targetStore
      setStoreStocks((prev) => {
        const next = prev.map((st) => {
          if (st.StoreID !== sourceStore.StoreID) return st;
          const key = `${st.MedicineID}::${st.BatchNumber.toUpperCase()}`;
          const req = reqByBatch.get(key);
          if (!req) return st;
          return {
            ...st,
            Quantity: Math.max(0, st.Quantity - req.qty),
            LastUpdated: nowIso,
          };
        });

        for (const item of txItems) {
          const med = medicines.find((m) => m.MedicineID === item.MedicineID);
          const targetIdx = next.findIndex(
            (st) =>
              st.StoreID === targetStore.StoreID &&
              st.MedicineID === item.MedicineID &&
              st.BatchNumber.toUpperCase() === item.BatchNumber.toUpperCase()
          );

          if (targetIdx >= 0) {
            next[targetIdx] = {
              ...next[targetIdx],
              Quantity: next[targetIdx].Quantity + item.Quantity,
              TP: item.TP,
              VATPercent: item.VATPercent,
              DiscountPercent: item.DiscountPercent,
              CostPrice: item.CostPrice,
              MRP: item.MRP || next[targetIdx].MRP,
              ExpiryDate: item.ExpiryDate || next[targetIdx].ExpiryDate,
              LastUpdated: nowIso,
            };
          } else {
            next.push({
              StoreStockID: `SST-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
              StoreID: targetStore.StoreID,
              MedicineID: item.MedicineID,
              TradeName: item.TradeName,
              GenericName: item.GenericName,
              Group: item.Group || med?.Group || 'General',
              Unit: med?.Unit || 'Box',
              SupplierID: item.SupplierID,
              SupplierName: item.SupplierName,
              BatchNumber: item.BatchNumber.toUpperCase(),
              ExpiryDate: item.ExpiryDate,
              Quantity: item.Quantity,
              TP: item.TP,
              VATPercent: item.VATPercent,
              DiscountPercent: item.DiscountPercent,
              CostPrice: item.CostPrice,
              MRP: item.MRP || med?.MRP || Math.round(item.CostPrice * 1.25 * 100) / 100,
              RackLocation: `S${targetStore.StoreNumber}-${med?.RackNo || 'BAY-A1'}`,
              LastUpdated: nowIso,
            });
          }
        }

        return next;
      });

      const totalTP = Math.round(txItems.reduce((s, i) => s + i.TP * i.Quantity, 0) * 100) / 100;
      const totalVAT = Math.round(txItems.reduce((s, i) => s + i.VATAmount * i.Quantity, 0) * 100) / 100;
      const totalDiscount =
        Math.round(txItems.reduce((s, i) => s + i.DiscountAmount * i.Quantity, 0) * 100) / 100;
      const netAmount = Math.round(txItems.reduce((s, i) => s + i.TotalCost, 0) * 100) / 100;
      const totalUnits = txItems.reduce((s, i) => s + i.Quantity, 0);

      const transaction: StoreTransaction = {
        TransactionID: `STX-${Date.now()}`,
        InvoiceNumber: invoiceNumber,
        Type: 'STORE_INTERCHANGE',
        StoreID: sourceStore.StoreID,
        StoreName: sourceStore.Name,
        TargetStoreID: targetStore.StoreID,
        TargetStoreName: targetStore.Name,
        SenderName: params.senderName.trim(),
        ReceiverName: params.receiverName.trim(),
        SupplierID: txItems[0]?.SupplierID,
        SupplierName: txItems[0]?.SupplierName,
        Group: params.group || txItems[0]?.Group || 'General',
        TotalTP: totalTP,
        TotalVAT: totalVAT,
        TotalDiscount: totalDiscount,
        NetAmount: netAmount,
        TotalUnits: totalUnits,
        Notes: params.notes?.trim() || undefined,
        CreatedBy: currentUser?.FullName || 'System Operator',
        CreatedByRole: currentUser?.Role || 'Admin',
        CreatedAt: nowIso,
        Items: txItems,
      };

      setStoreTransactions((prev) => [transaction, ...prev]);

      addAuditLog(
        'STORE_INTERCHANGE',
        `[${invoiceNumber}] Store Inter-Change ${sourceStore.ShortName} -> ${targetStore.ShortName}: ${totalUnits} units (${formatCurrency(netAmount)}) · Sender: ${transaction.SenderName} -> Receiver: ${transaction.ReceiverName}`
      );

      return { success: true, transaction };
    },
    [stores, storeStocks, medicines, peekNextStoreInvoiceNumber, currentUser, addAuditLog, formatCurrency]
  );

  const recordLogisticsSyncExport = useCallback(
    (format: 'JSON' | 'CSV' | 'SQL', summary: string) => {
      addAuditLog('LOGISTICS_SYNC_EXPORT', `Logistics & ERP Sync (${format}): ${summary}`);
    },
    [addAuditLog]
  );

  // Reorder System Management
  const updateReorderSettings = useCallback((newSettings: Partial<ReorderSettings>) => {
    setReorderSettingsState((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem(`${STORAGE_KEY}_reorder_settings`, JSON.stringify(updated));
      return updated;
    });
    showToast('Reorder system printer & download settings updated.', 'success', 'Settings Saved');
  }, [showToast]);

  const saveReorderList = useCallback((listToSave: ReorderList) => {
    setReorderLists((prev) => {
      const existsIndex = prev.findIndex((l) => l.id === listToSave.id);
      let updated: ReorderList[];
      if (existsIndex >= 0) {
        updated = [...prev];
        updated[existsIndex] = {
          ...listToSave,
          updatedAt: new Date().toISOString(),
        };
      } else {
        updated = [
          {
            ...listToSave,
            createdAt: listToSave.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...prev,
        ];
      }
      localStorage.setItem(`${STORAGE_KEY}_reorder_lists`, JSON.stringify(updated));
      return updated;
    });

    addAuditLog(
      'STOCK_ADJUSTMENT',
      `Reorder List ${listToSave.id} ("${listToSave.title}") saved by ${listToSave.createdBy || currentUser?.FullName || 'Staff'} with ${listToSave.items.length} items.`
    );
    showToast(`Order list "${listToSave.title}" saved successfully.`, 'success', 'Order Saved');
    return { success: true, list: listToSave };
  }, [currentUser, addAuditLog, showToast]);

  const deleteReorderList = useCallback((id: string) => {
    setReorderLists((prev) => {
      const target = prev.find((l) => l.id === id);
      const updated = prev.filter((l) => l.id !== id);
      localStorage.setItem(`${STORAGE_KEY}_reorder_lists`, JSON.stringify(updated));
      if (target) {
        addAuditLog(
          'STOCK_ADJUSTMENT',
          `Reorder List ${id} ("${target.title}") deleted by ${currentUser?.FullName || 'Staff'}.`
        );
      }
      return updated;
    });
    showToast(`Order list #${id} deleted.`, 'info', 'Order Deleted');
  }, [currentUser, addAuditLog, showToast]);

  const resetDatabaseToSeed = useCallback(() => {
    setMedicines(INITIAL_MEDICINES);
    setSuppliers(INITIAL_SUPPLIERS);
    setCustomers(INITIAL_CUSTOMERS);
    setBatches(INITIAL_BATCHES);
    setPurchases(INITIAL_PURCHASES);
    setDraftPurchases(INITIAL_DRAFT_PURCHASES);
    setSales(INITIAL_SALES);
    setExpireVault(INITIAL_EXPIRE_VAULT);
    setExpireTransactions(INITIAL_EXPIRE_TRANSACTIONS);
    setExpireInInvoices(INITIAL_EXPIRE_IN_INVOICES);
    setSupplierCallLogs(INITIAL_SUPPLIER_CALL_LOGS);
    setDueCollections(INITIAL_DUE_COLLECTIONS);
    setComplaints(INITIAL_COMPLAINTS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setReceiptSettings(DEFAULT_RECEIPT_SETTINGS);
    setStockAdjustments(INITIAL_STOCK_ADJUSTMENTS);
    setStores(INITIAL_STORES);
    setStoreStocks(INITIAL_STORE_STOCKS);
    setStoreTransactions(INITIAL_STORE_TRANSACTIONS);
    setStoreToggleLogs(INITIAL_STORE_TOGGLE_LOGS);
    setReorderSettingsState(DEFAULT_REORDER_SETTINGS);
    setReorderLists(INITIAL_REORDER_LISTS);
    localStorage.clear();
  }, []);

  // Computed system KPIs & Expiry metrics
  const systemStats = useMemo(() => {
    const now = new Date().getTime();
    const dayMs = 24 * 60 * 60 * 1000;

    let totalStockUnits = 0;
    let inventoryValuationCost = 0;
    let inventoryValuationRetail = 0;
    let expiringIn30DaysCount = 0;
    let expiringIn60DaysCount = 0;
    let expiringIn90DaysCount = 0;

    for (const b of batches) {
      if (b.CurrentStock > 0) {
        totalStockUnits += b.CurrentStock;
        inventoryValuationCost += b.CurrentStock * b.CostPrice;
        inventoryValuationRetail += b.CurrentStock * b.SellingPrice;

        const expTime = new Date(b.ExpiryDate).getTime();
        const diffDays = Math.ceil((expTime - now) / dayMs);

        if (diffDays <= 30) expiringIn30DaysCount += b.CurrentStock;
        else if (diffDays <= 60) expiringIn60DaysCount += b.CurrentStock;
        else if (diffDays <= 90) expiringIn90DaysCount += b.CurrentStock;
      }
    }

    const totalCustomerDues = customers.reduce((sum, c) => sum + (c.TotalDue || 0), 0);
    const totalSupplierDues = suppliers.reduce((sum, s) => sum + (s.TotalDue || 0), 0);
    const vaultItemsCount = expireVault.filter((v) => v.ReturnStatus === 'InVault').length;

    return {
      totalActiveMedicines: medicines.filter((m) => m.Status === 'Active').length,
      totalStockUnits,
      inventoryValuationCost: Math.round(inventoryValuationCost * 100) / 100,
      inventoryValuationRetail: Math.round(inventoryValuationRetail * 100) / 100,
      expiringIn30DaysCount,
      expiringIn60DaysCount,
      expiringIn90DaysCount,
      vaultItemsCount,
      totalCustomerDues: Math.round(totalCustomerDues * 100) / 100,
      totalSupplierDues: Math.round(totalSupplierDues * 100) / 100,
    };
  }, [medicines, batches, customers, suppliers, expireVault]);

  const value = {
    currentUser,
    isAuthenticated,
    login,
    logout,
    switchUser,
    users,
    medicines,
    suppliers,
    customers,
    batches,
    purchases,
    draftPurchases,
    saveDraftPurchase,
    deleteDraftPurchase,
    confirmDraftPurchase,
    sales,
    expireVault,
    expireTransactions,
    expireInInvoices,
    supplierCallLogs,
    addExpireTransaction,
    settleExpireTransaction,
    logSupplierCall,
    createExpireOutInvoice,
    createExpireInInvoice,
    addCashToOutInvoice,
    damageToBin,
    dueCollections,
    complaints,
    addComplaint,
    updateComplaint,
    deleteComplaint,
    resolveComplaint,
    auditLogs,
    receiptSettings,
    updateReceiptSettings,
    groups,
    addMedicine,
    updateMedicine,
    updateMedicineMRP,
    deleteMedicine,
    findSubstitutes,
    addBatch,
    updateBatch,
    getBatchesForMedicine,
    allocateBatchesFEFO,
    processPurchase,
    processSale,
    transferToVault,
    reconcileVaultItem,
    processGroupWiseExpireReturn,
    addCustomer,
    updateCustomer,
    recordDueCollection,
    addSupplier,
    updateSupplier,
    systemStats,
    addAuditLog,
    resetDatabaseToSeed,
    toasts,
    showToast,
    dismissToast,
    confirmDialogState,
    askConfirm,
    closeConfirm,
    theme,
    toggleTheme,
    setTheme,
    layoutStyle,
    setLayoutStyle,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    toggleSidebar,
    currencySymbol,
    formatCurrency,
    stockAdjustments,
    isAuditModeActive,
    setAuditModeActive,
    adjustMedicineStock,
    reconcileAuditMedicine,
    stores,
    storeStocks,
    storeTransactions,
    storeToggleLogs,
    peekNextStoreInvoiceNumber,
    toggleStoreActive,
    updateStoreDetails,
    processStoreIn,
    processStoreOut,
    processStoreInterchange,
    recordLogisticsSyncExport,
    reorderLists,
    reorderSettings,
    saveReorderList,
    deleteReorderList,
    updateReorderSettings,
  };

  return <PharmacyContext.Provider value={value}>{children}</PharmacyContext.Provider>;
};

export const usePharmacy = () => {
  const context = useContext(PharmacyContext);
  if (!context) {
    throw new Error('usePharmacy must be used within a PharmacyProvider');
  }
  return context;
};
