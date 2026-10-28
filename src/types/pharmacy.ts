/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Database Schema and Entity Types for SQL Server 2008 R2 Pharmacy System
 */

export type UserRole = 'Admin' | 'Moderator' | 'Salesman';

export interface User {
  UserID: string;
  Username: string;
  Password: string;
  PasswordHash?: string;
  Role: UserRole;
  FullName: string;
  CreatedAt: string;
}

export type UnitType = 'Pcs' | 'Box' | 'Strip' | 'Bottle' | 'Vial' | 'Tube';

export interface PriceHistoryRecord {
  HistoryID: string;
  MedicineID: string;
  OldMRP: number;
  NewMRP: number;
  EffectiveDate: string; // ISO date string e.g. '2026-03-01T00:00:00Z'
  ChangedBy: string;
  Reason: string; // e.g. 'March Price Hike', 'Manufacturer circular', 'Govt Gazette'
  StockAtChange: number; // Stock count at moment of price change
  RevaluationImpact: number; // (NewMRP - OldMRP) * StockAtChange
  Notes?: string;
}

export interface Medicine {
  MedicineID: string;
  TradeName: string;
  GenericName: string;
  RackNo: string;
  Unit: UnitType;
  DefaultDiscountPercent: number; // If 0 or null, falls back to Supplier.DefaultDiscountPercent
  ReorderLevel: number;
  Status: 'Active' | 'Discontinued';
  SupplierID: string;
  Barcode: string;
  Strength?: string;
  Category?: string;
  Group: string; // Group classification: 'Cardiac', 'General', 'Herbal', 'Skin', 'Antibiotic', 'Antidiabetic', etc.
  MRP: number; // Active Maximum Retail Price in BDT (৳ / Tk)
  PriceHistory?: PriceHistoryRecord[];
  PiecesPerBox?: number; // Retail dispensing: number of loose pieces/tablets per box (default 10)
}

export interface Supplier {
  SupplierID: string;
  Name: string;
  Phone: string;
  Address: string;
  DefaultDiscountPercent: number; // Fallback discount rule
  TotalDue: number; // Payable balance
  GroupsHandled?: string[]; // Groups supplied e.g. ['Cardiac', 'General', 'Herbal']
}

export interface Customer {
  CustomerID: string;
  Name: string;
  Phone: string;
  Address: string;
  TotalDue: number;
  LoyaltyPoints: number;
}

export interface Batch {
  BatchID: string;
  MedicineID: string;
  BatchNumber: string;
  ExpiryDate: string; // YYYY-MM-DD
  PurchasePrice: number; // Base TP
  TradePrice: number;
  TradePriceVat: number; // VAT percentage, e.g. 17.4
  CostPrice: number; // Calculated: (TP + VAT) - Discount
  SellingPrice: number; // MRP / Retail price (synced with Medicine.MRP)
  CurrentStock: number;
  SupplierID: string;
  Group?: string; // Synced medicine group e.g. 'Cardiac', 'Herbal'
}

export interface PurchaseItem {
  PurchaseItemID: string;
  PurchaseID: string;
  MedicineID: string;
  TradeName: string;
  BatchNumber: string;
  ExpiryDate: string;
  Quantity: number;
  TP: number;
  VATPercent: number;
  DiscountPercent: number;
  DiscountAmount: number;
  CostPrice: number; // Exact calculated unit cost
  TotalCost: number;
  Group?: string; // Group classification
  SupplierID?: string; // Originating supplier ID
  SupplierName?: string; // Originating supplier name
}

export interface Purchase {
  PurchaseID: string;
  SupplierID: string;
  SupplierName: string;
  InvoiceNumber: string;
  TotalTP: number;
  TotalVAT: number;
  TotalDiscount: number;
  NetCostPrice: number;
  PaidAmount: number;
  DueAmount: number;
  PurchaseDate: string;
  Items: PurchaseItem[];
  Group?: string; // Primary or selected group for group-wise procurement (e.g. 'Cardiac')
  SupplierMode?: 'single' | 'all'; // Whether purchase is for single supplier or consolidated all suppliers
  Status?: 'Confirmed' | 'Draft'; // Transaction status
  VerifiedBy?: string; // Staff/user name who checked and verified the products for audit trail
  VerifiedAt?: string; // Timestamp of verification
}

export interface DraftPurchaseItem {
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
  sourceOfDiscount?: string;
}

export interface DraftPurchase {
  DraftID: string;
  InvoiceNumber: string;
  SupplierID: string;
  SupplierName: string;
  SupplierMode: 'single' | 'all';
  Group: string;
  Items: DraftPurchaseItem[];
  TotalTP: number;
  TotalVAT: number;
  TotalDiscount: number;
  NetCostPrice: number;
  PaidAmount: number;
  DueAmount: number;
  SavedAt: string;
  Status: 'Draft';
  Notes?: string;
  VerifiedBy?: string; // Staff/user who verified the products
}

export interface SaleItem {
  SaleItemID: string;
  SaleID: string;
  MedicineID: string;
  TradeName: string;
  GenericName: string;
  BatchID: string;
  BatchNumber: string;
  ExpiryDate: string;
  Quantity: number;
  UnitPrice: number; // Base selling price (MRP at transaction time)
  CostPrice: number; // Item cost price for margin guardrail
  DiscountAmount: number; // Applied discount per unit or line
  EffectivePrice: number; // UnitPrice - (DiscountAmount / Quantity)
  TotalPrice: number;
  RackNo: string;
  DispenseUnit?: 'Piece' | 'Box' | 'Strip'; // Dispensed unit (Piece for retail, Box/Strip for wholesale)
  PiecesDispensed?: number;
  Group?: string;
  HistoricalMRP?: number; // Snapshot of MRP at time of sale
}

export interface Sale {
  SaleID: string;
  InvoiceNumber: string;
  CustomerID: string | null;
  CustomerName: string;
  CustomerPhone: string;
  CustomerAddress?: string;
  SalesmanID: string;
  SalesmanName: string;
  TerminalID?: string;
  TerminalName?: string;
  TotalAmount: number;
  DiscountAmount: number;
  FinalAmount: number;
  PaidAmount: number;
  DueAmount: number;
  PaymentMethod: 'Cash' | 'Card' | 'Digital / MFS';
  SaleDate: string;
  Items: SaleItem[];
}

export type ComplaintCategory =
  | 'Medicine Missed / Short Dispensed'
  | 'Wrong Medicine Dispensed'
  | 'Overcharge / Billing Error'
  | 'Damaged / Expired Batch'
  | 'Salesman Conduct / Delay'
  | 'Other';

export type ComplaintStatus =
  | 'Pending / Under Review'
  | 'Investigating'
  | 'Resolved / Reconciled'
  | 'Medicine Replaced / Refunded';

export interface CustomerComplaint {
  ComplaintID: string;
  ReceiptNumber: string; // Associated receipt e.g. REC-2026-1001 or 'General'
  SaleID?: string;
  CustomerID?: string;
  CustomerName: string;
  CustomerPhone: string;
  CustomerAddress?: string;
  SalesmanID: string;
  SalesmanName: string;
  TerminalName?: string;
  Category: ComplaintCategory;
  ShortOrMissedMedicine?: string; // e.g. "Napa Extra 500mg (Short 2 pcs)"
  IssueDescription: string;
  AdminRemarks: string; // Admin notes/remarks for coaching and investigation
  SalesmanCoachingNotes?: string; // Advice/coaching points for the salesman to improve
  Status: ComplaintStatus;
  CreatedAt: string;
  ResolvedAt?: string;
  ResolvedBy?: string;
  ResolutionAction?: string;
}

export type VaultReturnStatus =
  | 'InVault'
  | 'OutInvoiced'
  | 'ReturnedToSupplier'
  | 'CashReceived'
  | 'GoodMedicineReturned'
  | 'DamagedInBin';

export type ReconciliationType = 'Cash' | 'CreditDeduction' | 'MedicineExchange';

export type SupplierCallStatus = 'NotCalled' | 'Called' | 'ScheduledVisit' | 'AwaitingArrival';

export interface SupplierCallLog {
  CallID: string;
  SupplierID: string;
  SupplierName: string;
  Phone: string;
  RepresentativeName: string;
  CallDate: string;
  ScheduledVisitDate?: string;
  Notes: string;
  Status: SupplierCallStatus;
  LoggedBy: string;
}

export interface ExpireVaultItem {
  VaultID: string;
  MedicineID: string;
  TradeName: string;
  GenericName: string;
  BatchID: string;
  BatchNumber: string;
  ExpiryDate?: string;
  SupplierID: string;
  SupplierName: string;
  SupplierPhone?: string;
  SupplierRepresentative?: string;
  CallStatus?: SupplierCallStatus;
  LastCalledAt?: string;
  CallNotes?: string;
  Quantity: number;
  CostPrice: number;
  TransferDate: string;
  ReturnStatus: VaultReturnStatus;
  ReturnDate: string | null;
  ReconciliationType: ReconciliationType | null;
  ReconciledAmount: number;
  Notes: string;
  Group?: string; // Group classification e.g. 'Herbal', 'Cardiac'
  OutInvoiceNumber?: string;
  InInvoiceNumber?: string;
}

export interface ExpireReturnTransactionItem {
  VaultID?: string;
  MedicineID: string;
  TradeName: string;
  GenericName: string;
  BatchID: string;
  BatchNumber: string;
  ExpiryDate: string;
  Quantity: number;
  CostPrice: number;
  TotalCost: number;
  Group?: string;
}

export interface CashPaymentRecord {
  PaymentID: string;
  Amount: number;
  PaymentMethod: 'Cash' | 'Bank Transfer' | 'MFS' | 'Cheque';
  Date: string;
  ReceivedBy: string;
  ReferenceNote?: string;
}

export interface ExpireReturnTransaction {
  TransactionID: string;
  VoucherNumber: string; // e.g. EXP-OUT-2026-0101
  SupplierID: string;
  SupplierName: string;
  SupplierPhone: string;
  RepresentativePhone?: string;
  RepresentativeName?: string;
  Group: string;
  SalesmanID: string;
  SalesmanName: string;
  TransactionDate: string;
  Status: 'Pending' | 'Settled' | 'PartiallySettled';
  SettledDate?: string;
  ReconciliationType?: ReconciliationType;
  TotalAmount: number;
  TotalQuantity: number;
  PaidAmount?: number;
  DueBalance?: number;
  CashReceipts?: CashPaymentRecord[];
  LinkedInInvoiceNumber?: string;
  Notes?: string;
  Items: ExpireReturnTransactionItem[];
}

export interface ExpireInInvoiceItem {
  MedicineID: string;
  TradeName: string;
  GenericName: string;
  BatchNumber: string;
  ExpiryDate: string;
  Quantity: number;
  CostPrice: number;
  SellingPrice: number;
  TotalCost: number;
  Group?: string;
  NewBatchID?: string;
}

export interface ExpireInInvoice {
  InInvoiceID: string;
  InInvoiceNumber: string; // e.g. EXP-IN-2026-0001
  OutInvoiceNumber?: string; // Linked Expire Out-Invoice
  SupplierID: string;
  SupplierName: string;
  SupplierPhone?: string;
  ReceivedDate: string;
  ReceivedBy: string;
  TotalAmount: number;
  TotalQuantity: number;
  Items: ExpireInInvoiceItem[];
  Notes?: string;
}

export interface DueCollection {
  CollectionID: string;
  EntityType: 'Customer' | 'Supplier';
  EntityID: string;
  EntityName: string;
  Amount: number;
  PaymentMethod: 'Cash' | 'Bank Transfer' | 'MFS';
  CollectionDate: string;
  ReceivedBy: string;
  Notes: string;
}

export interface AuditLog {
  LogID: string;
  Timestamp: string;
  UserID: string;
  Username: string;
  Action:
    | 'STOCK_TRANSFER_VAULT'
    | 'PRICE_UPDATE'
    | 'PURCHASE_CONFIRM'
    | 'SALE_COMPLETE'
    | 'DUE_COLLECTION'
    | 'VAULT_RECONCILIATION'
    | 'SYSTEM_BACKUP'
    | 'COMPLAINT_ACTION'
    | 'EXPIRE_OUT_INVOICE'
    | 'EXPIRE_IN_INVOICE'
    | 'EXPIRE_CASH_REFUND'
    | 'SUPPLIER_CALL_LOG'
    | 'STOCK_ADJUSTMENT'
    | 'AUDIT_RECONCILIATION'
    | 'STORE_IN'
    | 'STORE_OUT'
    | 'STORE_INTERCHANGE'
    | 'STORE_STATUS_TOGGLE'
    | 'LOGISTICS_SYNC_EXPORT';
  Details: string;
  InvoiceNumber?: string;
  SupplierName?: string;
  StockDelta?: number;
  FinancialDelta?: number;
}

export type PrinterTransportMode = 'auto' | 'spooler' | 'raw-usb' | 'serial' | 'network';

export interface ReceiptSettings {
  pharmacyName: string;
  address: string;
  phone: string;
  taxNumber: string;
  printerWidth: '58mm' | '80mm';
  printerDevice?: string; // Selected thermal printer device (e.g. RONGTA 80mm Series Printer)
  printerTransport?: PrinterTransportMode; // Native desktop hardware transport channel
  serialPortPath?: string; // Native node-serialport COM path (e.g. COM3, /dev/ttyUSB0)
  serialBaudRate?: number; // Native serial baud rate (9600, 19200, 38400, 115200)
  printMode?: 'direct' | 'preview'; // 'direct' = bypass manual preview prompt & trigger printer directly; 'preview' = show modal first
  autoPrintOnSale?: boolean; // automatically trigger print when cashier tenders sale
  copies?: number; // 1, 2, 3
  openCashDrawer?: boolean; // pulse cash drawer kick
  cutPaper?: boolean; // auto paper cut
  networkPrinterIp?: string; // optional network IP:Port (Port 9100)
  footerMessage: string;
  showGenericName: boolean;
  showRackNo: boolean;
  showBatchNo: boolean;
  wholesaleMode?: boolean; // false = Retail Mode (per piece/tablet), true = Wholesale Mode (full box)
  currencySymbol?: string; // e.g. '$', '৳', '₹', '€', '£', 'AED', 'SAR'
  currencyCode?: string; // e.g. 'USD', 'BDT', 'INR', 'EUR', 'GBP'
  auditModeEnabled?: boolean; // Physical inventory audit mode switch
}

export type AdjustmentType =
  | 'Manual Adjust'
  | 'Expire Adjust'
  | 'Damage Adjust'
  | 'Audit Reconciliation';

export interface StockAdjustment {
  AdjustmentID: string;
  MedicineID: string;
  TradeName: string;
  GenericName: string;
  BatchID: string;
  BatchNumber: string;
  ExpiryDate?: string;
  AdjustmentType: AdjustmentType;
  PreviousStock: number;
  QuantityDelta: number; // positive = added to stock, negative = deducted from stock
  NewStock: number;
  CostPrice: number;
  SellingPrice: number;
  FinancialImpact: number; // QuantityDelta * CostPrice
  Reason: string;
  AdjustedBy: string; // User Name / Role
  AdjustedAt: string; // ISO timestamp
  IsAuditSession?: boolean;
  AuditSessionID?: string;
}

export interface WarehouseStore {
  StoreID: string;
  StoreNumber: 1 | 2 | 3;
  ShortName: string; // 'Store 1' | 'Store 2' | 'Store 3'
  Name: string;
  Code: string;
  Region: string;
  Address: string;
  BranchManager: string;
  ManagerPhone: string;
  IsActive: boolean;
  LastToggledAt?: string;
  LastToggledBy?: string;
  StatusNote?: string;
}

export interface StoreStockItem {
  StoreStockID: string;
  StoreID: string;
  MedicineID: string;
  TradeName: string;
  GenericName: string;
  Group: string;
  Unit: UnitType;
  SupplierID: string;
  SupplierName: string;
  BatchNumber: string;
  ExpiryDate: string;
  Quantity: number;
  TP: number;
  VATPercent: number;
  DiscountPercent: number;
  CostPrice: number;
  MRP: number;
  RackLocation: string;
  LastUpdated: string;
}

export type StoreTransactionType = 'STORE_IN' | 'STORE_OUT' | 'STORE_INTERCHANGE';

export interface StoreTransactionItem {
  ItemID: string;
  MedicineID: string;
  TradeName: string;
  GenericName: string;
  Group: string;
  SupplierID: string;
  SupplierName: string;
  BatchNumber: string;
  ExpiryDate: string;
  Quantity: number;
  TP: number;
  VATPercent: number;
  VATAmount: number;
  DiscountPercent: number;
  DiscountAmount: number;
  CostPrice: number;
  MRP: number;
  TotalCost: number;
  RackLocation?: string;
}

export interface StoreTransaction {
  TransactionID: string;
  InvoiceNumber: string; // Auto-generated: STR-IN-2026-XXXX, STR-OUT-2026-XXXX, STR-INT-2026-XXXX
  Type: StoreTransactionType;
  StoreID: string;
  StoreName: string;
  TargetStoreID?: string;
  TargetStoreName?: string;
  CounterSyncMode?: 'EXTERNAL' | 'MAIN_COUNTER';
  SenderName: string;
  ReceiverName: string;
  SupplierID?: string;
  SupplierName?: string;
  Group?: string;
  TotalTP: number;
  TotalVAT: number;
  TotalDiscount: number;
  NetAmount: number;
  TotalUnits: number;
  Notes?: string;
  CreatedBy: string;
  CreatedByRole: UserRole;
  CreatedAt: string;
  Items: StoreTransactionItem[];
}

export interface StoreToggleAuditEntry {
  ToggleID: string;
  Timestamp: string;
  StoreID: string;
  StoreName: string;
  StoreCode: string;
  Region: string;
  PreviousState: boolean;
  NewState: boolean;
  ChangedByUserID: string;
  ChangedByName: string;
  ChangedByRole: UserRole;
  Reason: string;
  StockUnitsSnapshot: number;
  ValuationSnapshot: number;
}

export type ThemeType =
  | 'dark'
  | 'light'
  | 'classic'
  | 'off-white'
  | 'off-white-gray'
  | 'white-gray'
  | 'windows-10'
  | 'windows-xp'
  | 'modern'
  | 'white-green-neon';

export type LayoutStyleType = 'standard' | 'simple' | 'classic';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  isDestructive?: boolean;
  destructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// ============================================================================
// REORDER SYSTEM & INK PRINTER ORDER LIST MODELS
// ============================================================================

export type ReorderPaperSize = 'A4' | 'Letter' | 'Legal' | 'A5' | 'Custom';

export interface ReorderSettings {
  paperSize: ReorderPaperSize;
  customPaperWidth?: number; // e.g., 3.8
  customPaperHeight?: number; // e.g., 9.0
  customPaperUnit?: 'in' | 'mm' | 'cm'; // default 'in'
  pdfDownloadDirectory: string;
  printOrientation: 'portrait' | 'landscape';
  showGenericOnPrint: boolean;
  showBatchCostOnPrint: boolean;
  inkPrinterDevice?: string;
  autoSaveDrafts: boolean;
}

export interface ReorderListItem {
  medicineId: string;
  tradeName: string;
  genericName: string;
  group: string;
  supplierId: string;
  supplierName: string;
  currentStock: number;
  reorderLevel: number;
  piecesPerPack: number;
  orderQuantity: number;
  unitType: 'pack' | 'piece';
  unitCost: number;
  estimatedTotalCost: number;
  notes?: string;
  urgency?: 'Urgent' | 'Normal' | 'Overstock';
}

export interface ReorderList {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string; // Creator's full name for audit accountability
  createdByRole: string;
  status: 'Draft' | 'Finalized' | 'Ordered';
  supplierFilter?: string;
  notes?: string;
  items: ReorderListItem[];
  totalEstimatedCost: number;
  totalItemsCount: number;
  totalUnitsCount: number;
}



