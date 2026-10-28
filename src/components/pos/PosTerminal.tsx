/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Module E: Fast Sales Interface (POS)
 * Retail Pharmacy Dispensing:
 * - Sells per Piece / Tablet by default (loose pieces allowed, not forced into box).
 * - Settings option & live POS header switch for Wholesale Mode (full box/pack).
 * - Dynamic fast search with [↓] [↑] arrow key navigation.
 * - [Enter] to confirm medicine -> Opens Child Window for Quantity & Discount.
 * - [Enter] inside Child Window: Qty -> Discount -> Add to Cart & auto-focus search.
 * - [Ctrl + C]: Jump to Current Cart / Chart to adjust items, quantities & discounts.
 * - [Alt + T]: Post / Tender Sale (Alt+t or Alt+T).
 * - [Alt + P]: Print POS Thermal Receipt (Alt+p or Alt+P).
 * - [Alt + N]: Open New Sale.
 * - [Esc]: Return to Find.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { Medicine, Batch, Customer, SaleItem, Sale } from '../../types/pharmacy';
import { resolveEffectiveDiscount, validateProfitMarginGuardrail } from '../../utils/costCalculator';
import { printThermalReceipt } from '../../utils/thermalPrinter';
import { ReceiptModal } from './ReceiptModal';
import {
  Search,
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  UserCheck,
  CreditCard,
  Banknote,
  Smartphone,
  Sparkles,
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  X,
  FilePlus,
  Boxes,
  Edit2,
  Check,
  Pill,
  ArrowLeftRight,
  Table as TableIcon,
  List as ListIcon,
  ArrowDownToLine,
  Layers,
  Warehouse,
} from 'lucide-react';

interface CartItem extends SaleItem {
  availableStock: number;
  discountPercent?: number;
  dispensePieces?: number;
  lineKey?: string;
}

interface SearchItem {
  medicine: Medicine;
  totalStock: number;
  fefoBatch: Batch | null;
  supplier: any;
}

interface PosTerminalProps {
  onOpenLiveStock?: () => void;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({ onOpenLiveStock }) => {
  const {
    medicines,
    batches,
    stores,
    storeStocks,
    customers,
    suppliers,
    currentUser,
    processSale,
    findSubstitutes,
    receiptSettings,
    updateReceiptSettings,
    showToast,
    askConfirm,
    currencySymbol,
    formatCurrency,
  } = usePharmacy();

  // Wholesale Mode: false = Retail (per piece/tablet), true = Wholesale (full box)
  const isWholesaleMode = !!receiptSettings.wholesaleMode;

  // Active child warehouses governed by Settings ON/OFF switches
  const activeStores = useMemo(
    () =>
      [...stores]
        .filter((s) => s.IsActive)
        .sort((a, b) => a.StoreNumber - b.StoreNumber),
    [stores]
  );

  const [inspectStoreMedicine, setInspectStoreMedicine] = useState<Medicine | null>(null);

  const getChildStoresBalance = useCallback(
    (med: Medicine, piecesPerPack: number) => {
      const perStore = activeStores.map((st) => {
        const stBatches = storeStocks.filter(
          (item) =>
            item.StoreID === st.StoreID &&
            item.MedicineID === med.MedicineID &&
            item.Quantity > 0
        );
        const packQty = stBatches.reduce((sum, i) => sum + i.Quantity, 0);
        const pieceQty = packQty * piecesPerPack;
        const racks = Array.from(
          new Set(stBatches.map((i) => i.RackLocation).filter(Boolean))
        );
        return {
          store: st,
          packQty,
          pieceQty,
          racks,
          batches: stBatches,
        };
      });

      const totalPacks = perStore.reduce((sum, entry) => sum + entry.packQty, 0);
      const totalPieces = totalPacks * piecesPerPack;
      return { perStore, totalPacks, totalPieces };
    },
    [activeStores, storeStocks]
  );

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [catalogCategory, setCatalogCategory] = useState<string>('All');
  const [searchLatency, setSearchLatency] = useState<number>(0.4);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState<number>(0);

  // Cart & Checkout state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer>(
    customers.find((c) => c.Name.includes('Walk-in')) || customers[0]
  );
  const [globalDiscountAmount, setGlobalDiscountAmount] = useState<number>(0);
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Digital / MFS'>('Cash');

  // Guardrail error state
  const [guardrailError, setGuardrailError] = useState<string | null>(null);

  // Completed sale receipt modal & Mini Child Confirmation Window
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [lastSaleForPrint, setLastSaleForPrint] = useState<Sale | null>(null);
  const [postedSaleConfirmation, setPostedSaleConfirmation] = useState<Sale | null>(null);

  // Substitute modal/drawer state
  const [substituteDrawerOpen, setSubstituteDrawerOpen] = useState(false);
  const [substituteGenericName, setSubstituteGenericName] = useState('');

  // Child Window / Modal State for selected medicine (Quantity & Discount)
  const [selectedMedicineForInput, setSelectedMedicineForInput] = useState<{
    medicine: Medicine;
    batch: Batch;
    availableStock: number;
  } | null>(null);
  const [modalQuantity, setModalQuantity] = useState<number>(1);
  const [modalDiscountPercent, setModalDiscountPercent] = useState<number>(0);
  const [modalDispenseUnit, setModalDispenseUnit] = useState<'Piece' | 'Box'>('Piece');
  const [modalError, setModalError] = useState<string | null>(null);

  // Cart Navigation State (Ctrl+C)
  const [isCartFocused, setIsCartFocused] = useState<boolean>(false);
  const [focusedCartIndex, setFocusedCartIndex] = useState<number>(0);

  // Inline Cart Item Edit Modal State
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);

  // Layout & View Density States
  const [cartOnLeft, setCartOnLeft] = useState<boolean>(true); // Current sale chart on LEFT as requested
  const [cartViewMode, setCartViewMode] = useState<'table' | 'cards'>('table'); // Dense Table for MAXIMUM visible rows
  const [lastAddedLineKey, setLastAddedLineKey] = useState<string | null>(null); // Highlight for down row

  // Refs
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalQtyInputRef = useRef<HTMLInputElement>(null);
  const modalDiscInputRef = useRef<HTMLInputElement>(null);
  const discountInputRef = useRef<HTMLInputElement>(null);
  const customerSelectRef = useRef<HTMLSelectElement>(null);
  const paidInputRef = useRef<HTMLInputElement>(null);
  const searchListContainerRef = useRef<HTMLDivElement>(null);
  const cartListContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll cart so the newly added medicine on the down row is always in view
  useEffect(() => {
    if (cart.length > 0 && cartListContainerRef.current) {
      cartListContainerRef.current.scrollTo({
        top: cartListContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [cart.length, lastAddedLineKey]);

  // Helper: Calculate pack info and per-piece rates
  const getPackInfo = useCallback((med: Medicine, batch?: Batch | null) => {
    let piecesPerPack = med.PiecesPerBox || 1;
    if (!med.PiecesPerBox) {
      if (med.Unit === 'Strip') piecesPerPack = 10;
      else if (med.Unit === 'Box') piecesPerPack = 10;
      else piecesPerPack = 1;
    }

    const packPrice = batch ? batch.SellingPrice : 0;
    const piecePrice = piecesPerPack > 1 ? packPrice / piecesPerPack : packPrice;
    const packCost = batch ? batch.CostPrice : 0;
    const pieceCost = piecesPerPack > 1 ? packCost / piecesPerPack : packCost;

    return {
      piecesPerPack,
      packPrice: Math.round(packPrice * 100) / 100,
      piecePrice: Math.round(piecePrice * 100) / 100,
      packCost: Math.round(packCost * 100) / 100,
      pieceCost: Math.round(pieceCost * 100) / 100,
    };
  }, []);

  // High-performance dynamic medicine search matching trade name, generic, barcode, rack
  const searchResults = useMemo<SearchItem[]>(() => {
    const startTime = performance.now();
    const query = searchQuery.trim().toLowerCase();

    const activeMeds = medicines.filter((m) => m.Status === 'Active');

    const mapped = activeMeds.map((m) => {
      const availableBatches = batches.filter(
        (b) => b.MedicineID === m.MedicineID && b.CurrentStock > 0
      );
      const totalStock = availableBatches.reduce((acc, b) => acc + b.CurrentStock, 0);

      // FEFO: Closest expiring batch first
      const sortedBatches = [...availableBatches].sort(
        (a, b) => new Date(a.ExpiryDate).getTime() - new Date(b.ExpiryDate).getTime()
      );
      const fefoBatch = sortedBatches[0] || null;

      return {
        medicine: m,
        totalStock,
        fefoBatch,
        supplier: suppliers.find((s) => s.SupplierID === m.SupplierID),
      };
    });

    let filtered: SearchItem[] = [];
    if (!query) {
      filtered = mapped;
    } else {
      filtered = mapped.filter(({ medicine }) => {
        return (
          medicine.TradeName.toLowerCase().includes(query) ||
          medicine.GenericName.toLowerCase().includes(query) ||
          medicine.Barcode.toLowerCase().includes(query) ||
          medicine.RackNo.toLowerCase().includes(query)
        );
      });
    }

    if (catalogCategory !== 'All') {
      filtered = filtered.filter(({ medicine }) => medicine.Category === catalogCategory);
    }

    if (!query && catalogCategory === 'All') {
      filtered = filtered.slice(0, 35);
    }

    const elapsed = performance.now() - startTime;
    setSearchLatency(Math.max(0.2, Math.round(elapsed * 10) / 10));
    return filtered;
  }, [searchQuery, catalogCategory, medicines, batches, suppliers]);

  // Dynamic available categories for quick filtering
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach((m) => {
      if (m.Category) set.add(m.Category);
    });
    return ['All', ...Array.from(set)];
  }, [medicines]);

  // Keep selectedSearchIndex within bounds when results change
  useEffect(() => {
    if (selectedSearchIndex >= searchResults.length) {
      setSelectedSearchIndex(Math.max(0, searchResults.length - 1));
    }
  }, [searchResults.length, selectedSearchIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (searchListContainerRef.current) {
      const activeEl = searchListContainerRef.current.querySelector(
        `[data-search-idx="${selectedSearchIndex}"]`
      ) as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedSearchIndex]);

  // Direct Barcode scan match
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 8 && !selectedMedicineForInput) {
      const match = searchResults.find(
        (r) => r.medicine.Barcode.toLowerCase() === trimmed.toLowerCase()
      );
      if (match && match.fefoBatch && match.totalStock > 0) {
        openItemInputModal(match.medicine, match.fefoBatch, match.totalStock);
        setSearchQuery('');
      }
    }
  }, [searchQuery, searchResults, selectedMedicineForInput]);

  // Open Child Window to take Quantity and Discount
  const openItemInputModal = useCallback(
    (med: Medicine, batch: Batch, availableStock: number) => {
      const supplier = suppliers.find((s) => s.SupplierID === med.SupplierID);
      const resolved = resolveEffectiveDiscount(med, supplier);
      const defaultDiscountPercent = Math.round(resolved.rate * 10) / 10;

      // Default unit: If Wholesale switch is active, default to Box; otherwise default to Piece (Retail)
      const defaultUnit: 'Piece' | 'Box' = isWholesaleMode ? 'Box' : 'Piece';

      setSelectedMedicineForInput({ medicine: med, batch, availableStock });
      setModalDispenseUnit(defaultUnit);
      setModalQuantity(1);
      setModalDiscountPercent(defaultDiscountPercent);
      setModalError(null);
      setIsCartFocused(false);

      // Autofocus quantity input on next tick
      setTimeout(() => {
        if (modalQtyInputRef.current) {
          modalQtyInputRef.current.focus();
          modalQtyInputRef.current.select();
        }
      }, 50);
    },
    [suppliers, isWholesaleMode]
  );

  // Confirm Child Window: Add Item to Cart with entered Quantity, Discount, and Dispense Unit
  const confirmAddItemFromModal = useCallback(() => {
    if (!selectedMedicineForInput) return;

    const { medicine: med, batch, availableStock } = selectedMedicineForInput;
    const packInfo = getPackInfo(med, batch);
    const qty = modalQuantity;
    const discPct = Math.max(0, modalDiscountPercent);

    if (isNaN(qty) || qty <= 0) {
      setModalError('Quantity must be at least 1.');
      modalQtyInputRef.current?.focus();
      return;
    }

    // Determine unit price, cost price, and stock limits based on Piece vs Box
    const isPiece = modalDispenseUnit === 'Piece';
    const effectiveUnitPrice = isPiece ? packInfo.piecePrice : packInfo.packPrice;
    const effectiveCostPrice = isPiece ? packInfo.pieceCost : packInfo.packCost;
    const availablePieces = availableStock * packInfo.piecesPerPack;

    if (isPiece && qty > availablePieces) {
      setModalError(
        `Quantity cannot exceed available stock (${availablePieces} pieces / ${availableStock} ${med.Unit}).`
      );
      modalQtyInputRef.current?.focus();
      return;
    }

    if (!isPiece && qty > availableStock) {
      setModalError(
        `Quantity cannot exceed available boxes (${availableStock} ${med.Unit}).`
      );
      modalQtyInputRef.current?.focus();
      return;
    }

    // Calculate discount and net line total
    const itemTotalGross = effectiveUnitPrice * qty;
    const totalItemDiscount = (itemTotalGross * discPct) / 100;
    const unitDiscount = totalItemDiscount / qty;

    // Validate profit margin guardrail (selling price cannot be less than cost price)
    const guard = validateProfitMarginGuardrail(
      effectiveUnitPrice,
      totalItemDiscount,
      effectiveCostPrice,
      qty
    );

    if (!guard.valid) {
      setModalError(`Margin Violation: ${guard.error}`);
      modalDiscInputRef.current?.focus();
      return;
    }

    const finalItemTotal = itemTotalGross - totalItemDiscount;
    const lineKey = `${batch.BatchID}-${modalDispenseUnit}`;

    // Add or update cart
    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => (item as any).lineKey === lineKey);
      if (existingIdx >= 0) {
        const item = prev[existingIdx];
        const newQty = item.Quantity + qty;
        const maxLimit = isPiece ? availablePieces : availableStock;
        if (newQty > maxLimit) {
          showToast(`Cannot exceed available batch stock (${maxLimit} ${isPiece ? 'pieces' : med.Unit}).`, 'warning', 'Stock Limit Exceeded');
          return prev;
        }

        const newGross = effectiveUnitPrice * newQty;
        const newTotalDiscount = (newGross * discPct) / 100;
        const newTotal = newGross - newTotalDiscount;

        const updatedItem: CartItem & { lineKey: string } = {
          ...item,
          lineKey: (item as any).lineKey || lineKey,
          Quantity: newQty,
          discountPercent: discPct,
          DiscountAmount: Math.round(newTotalDiscount * 100) / 100,
          EffectivePrice: Math.round((effectiveUnitPrice - (newTotalDiscount / newQty)) * 100) / 100,
          TotalPrice: Math.round(newTotal * 100) / 100,
        };

        // Move to the bottom ("down row") as requested
        const remaining = prev.filter((_, idx) => idx !== existingIdx);
        return [...remaining, updatedItem];
      }

      const displayTradeName =
        isPiece && packInfo.piecesPerPack > 1
          ? `${med.TradeName} [Loose Piece]`
          : `${med.TradeName}`;

      const newItem: CartItem & { lineKey: string } = {
        lineKey,
        SaleItemID: `SALI-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        SaleID: '',
        MedicineID: med.MedicineID,
        TradeName: displayTradeName,
        GenericName: med.GenericName,
        BatchID: batch.BatchID,
        BatchNumber: batch.BatchNumber,
        ExpiryDate: batch.ExpiryDate,
        Quantity: qty,
        UnitPrice: effectiveUnitPrice,
        CostPrice: effectiveCostPrice,
        discountPercent: discPct,
        DiscountAmount: Math.round(totalItemDiscount * 100) / 100,
        EffectivePrice: Math.round((effectiveUnitPrice - unitDiscount) * 100) / 100,
        TotalPrice: Math.round(finalItemTotal * 100) / 100,
        RackNo: med.RackNo,
        availableStock: isPiece ? availablePieces : availableStock,
        DispenseUnit: isPiece ? 'Piece' : 'Box',
        PiecesDispensed: isPiece ? qty : qty * packInfo.piecesPerPack,
        Group: med.Group || 'General',
        HistoricalMRP: effectiveUnitPrice,
      };

      // New item always placed on the down row (bottom)
      return [...prev, newItem];
    });

    setLastAddedLineKey(lineKey);
    setTimeout(() => setLastAddedLineKey(null), 2500);

    setTimeout(() => {
      if (cartListContainerRef.current) {
        cartListContainerRef.current.scrollTop = cartListContainerRef.current.scrollHeight;
      }
    }, 50);

    // Close child window
    setSelectedMedicineForInput(null);
    setSearchQuery('');

    // Automatically return focus to search input for immediate next entry
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    }, 50);
  }, [selectedMedicineForInput, modalQuantity, modalDiscountPercent, modalDispenseUnit, getPackInfo]);

  // Cart operations
  const updateQuantity = (lineKeyOrBatchId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          const key = (item as any).lineKey || item.BatchID;
          if (key === lineKeyOrBatchId || item.BatchID === lineKeyOrBatchId) {
            const newQty = item.Quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.availableStock) {
              showToast(`Maximum available stock in batch ${item.BatchNumber} is ${item.availableStock}.`, 'warning', 'Batch Stock Limit');
              return item;
            }

            const discPct = item.discountPercent ?? 0;
            const gross = item.UnitPrice * newQty;
            const newDiscount = (gross * discPct) / 100;
            const total = gross - newDiscount;

            return {
              ...item,
              Quantity: newQty,
              DiscountAmount: Math.round(newDiscount * 100) / 100,
              TotalPrice: Math.round(total * 100) / 100,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (lineKeyOrBatchId: string) => {
    setCart((prev) => {
      const next = prev.filter((item) => {
        const key = (item as any).lineKey || item.BatchID;
        return key !== lineKeyOrBatchId && item.BatchID !== lineKeyOrBatchId;
      });
      if (focusedCartIndex >= next.length) {
        setFocusedCartIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
  };

  // Cart Totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.UnitPrice * item.Quantity, 0);
  }, [cart]);

  const itemsDiscountTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.DiscountAmount, 0);
  }, [cart]);

  const totalDiscount = itemsDiscountTotal + globalDiscountAmount;
  const finalAmount = Math.max(0, subtotal - totalDiscount);

  // Cart Guardrail Check
  const cartGuardrailCheck = useMemo(() => {
    if (cart.length === 0) return { valid: true };

    let totalCartCost = 0;
    for (const item of cart) {
      totalCartCost += item.CostPrice * item.Quantity;
      const itemCheck = validateProfitMarginGuardrail(
        item.UnitPrice,
        item.DiscountAmount,
        item.CostPrice,
        item.Quantity
      );
      if (!itemCheck.valid) {
        return {
          valid: false,
          error: itemCheck.error,
          itemName: item.TradeName,
        };
      }
    }

    if (finalAmount < totalCartCost - 0.01) {
      return {
        valid: false,
        error: `Discount rejected: Selling price cannot be lower than cost price (${currencySymbol}${totalCartCost.toFixed(2)}).`,
        itemName: 'Overall Bill',
      };
    }

    return { valid: true };
  }, [cart, finalAmount, currencySymbol]);

  const numericPaid = paidAmount === '' ? finalAmount : parseFloat(paidAmount) || 0;
  const dueAmount = Math.max(0, finalAmount - numericPaid);
  const changeAmount = Math.max(0, numericPaid - finalAmount);

  // Complete Sale (Post)
  const handleCompleteSale = useCallback(() => {
    if (cart.length === 0) {
      showToast('Cart is empty. Search and add medicines first.', 'warning', 'Cart Empty');
      searchInputRef.current?.focus();
      return;
    }

    if (!cartGuardrailCheck.valid) {
      setGuardrailError(cartGuardrailCheck.error || 'Selling price cannot be lower than Cost Price.');
      return;
    }

    const salePayload = {
      CustomerID: selectedCustomer.CustomerID,
      CustomerName: selectedCustomer.Name,
      CustomerPhone: selectedCustomer.Phone,
      SalesmanID: currentUser?.UserID || 'USR-POS',
      SalesmanName: currentUser?.FullName || 'POS Salesman',
      TotalAmount: Math.round(subtotal * 100) / 100,
      DiscountAmount: Math.round(totalDiscount * 100) / 100,
      FinalAmount: Math.round(finalAmount * 100) / 100,
      PaidAmount: Math.round(numericPaid * 100) / 100,
      DueAmount: Math.round(dueAmount * 100) / 100,
      PaymentMethod: paymentMethod,
      Items: cart.map(({ availableStock, discountPercent, ...item }) => item),
    };

    const result = processSale(salePayload);

    if (result.success && result.sale) {
      const createdSale = result.sale;
      setLastSaleForPrint(createdSale);
      setGuardrailError(null);
      setIsCartFocused(false);
      showToast(`Sale Invoice #${createdSale.InvoiceNumber} posted successfully!`, 'success', 'Sale Posted');

      // Requirement: Once a sale is posted, automatically open a mini child confirmation window.
      setPostedSaleConfirmation(createdSale);
      return createdSale;
    } else {
      setGuardrailError(result.error || 'Failed to complete sale.');
      showToast(result.error || 'Failed to complete sale.', 'error', 'Transaction Error');
      return null;
    }
  }, [
    cart,
    cartGuardrailCheck,
    selectedCustomer,
    currentUser,
    subtotal,
    totalDiscount,
    finalAmount,
    numericPaid,
    dueAmount,
    paymentMethod,
    processSale,
    showToast,
  ]);

  const resetSaleState = useCallback(() => {
    setCart([]);
    setGlobalDiscountAmount(0);
    setPaidAmount('');
    setGuardrailError(null);
    setSelectedMedicineForInput(null);
    setEditingCartItem(null);
    setSubstituteDrawerOpen(false);
    setCompletedSale(null);
    setIsCartFocused(false);
    setSearchQuery('');
    setSelectedCustomer(customers.find((c) => c.Name.includes('Walk-in')) || customers[0]);

    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 50);
  }, [customers]);

  // Requirement: In mini window, pressing Enter or Space triggers final transaction receipt print,
  // then immediately after printing resets the POS interface cleanly for next customer entry.
  const handleFinalizePrint = useCallback(
    async (saleToPrint?: Sale) => {
      const targetSale = saleToPrint || postedSaleConfirmation || lastSaleForPrint;
      if (!targetSale) return;

      try {
        await printThermalReceipt(targetSale, receiptSettings);
        showToast(
          `🖨️ Receipt Printed: #${targetSale.InvoiceNumber} -> ${receiptSettings.printerDevice || 'Thermal POS Printer'}`,
          'success',
          'Receipt Printed'
        );
      } catch (e) {
        showToast('Thermal receipt print command dispatched.', 'info', 'Printer');
      }

      // Immediately after printing, reset the POS interface cleanly for the next customer entry
      resetSaleState();
      setPostedSaleConfirmation(null);
    },
    [postedSaleConfirmation, lastSaleForPrint, receiptSettings, resetSaleState, showToast]
  );

  // Skip printing from mini confirmation window and reset cleanly for next customer entry
  const handleSkipPrintAndReset = useCallback(() => {
    resetSaleState();
    setPostedSaleConfirmation(null);
    showToast('POS interface cleanly reset for next customer.', 'info', 'Next Customer');
  }, [resetSaleState, showToast]);

  // Open New Sale (Alt+N)
  const handleNewSale = useCallback(() => {
    if (cart.length > 0) {
      askConfirm({
        title: 'Discard Sale Transaction',
        message: 'Are you sure you want to discard the active cart items and start a new transaction?',
        confirmLabel: 'Discard Cart',
        cancelLabel: 'Keep Items',
        isDestructive: true,
        onConfirm: () => {
          resetSaleState();
          showToast('New sale session started.', 'info', 'Sale Reset');
        },
      });
      return;
    }

    resetSaleState();
  }, [cart.length, askConfirm, resetSaleState, showToast]);

  // POS Print Receipt Handler
  // Requirement: Salesmen must NOT be able to print an empty sale or print without clicking 'Post' first.
  const handlePrintReceipt = useCallback(async () => {
    // 1. If the mini confirmation window is open, trigger print immediately
    if (postedSaleConfirmation) {
      handleFinalizePrint(postedSaleConfirmation);
      return;
    }

    // 2. Rule: Salesmen must NOT be able to print an empty sale
    if (cart.length === 0) {
      showToast(
        'Cannot print an empty sale! Please search and add medicines to the cart, then click "Post" first.',
        'warning',
        'Empty Sale'
      );
      searchInputRef.current?.focus();
      return;
    }

    // 3. Rule: Salesmen must NOT be able to print without clicking 'Post' first
    showToast(
      'Salesmen must NOT print without clicking "Post" first! Please click "Post Sale (Alt+T)" to finalize and post this transaction.',
      'warning',
      'Post Sale Required'
    );
  }, [postedSaleConfirmation, cart.length, handleFinalizePrint, showToast]);

  // Global Keyboard Shortcuts Handler
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Priority 1: Mini child confirmation window active after sale posting
      // Requirement: In this mini window, pressing Enter key or Space bar will trigger the final transaction receipt print
      if (postedSaleConfirmation) {
        if (e.key === 'Enter' || e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          handleFinalizePrint(postedSaleConfirmation);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          handleSkipPrintAndReset();
          return;
        }
        return; // Intercept all other keys while confirmation window is open
      }

      // 0. Ctrl + F: Find new medicine item to add (instant focus to search bar, closing any open dialogs)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setIsCartFocused(false);
        setSubstituteDrawerOpen(false);
        setEditingCartItem(null);
        setSelectedMedicineForInput(null);
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
        showToast('Find Medicine Search Active (Ctrl+F)', 'info', 'Find Medicine', 1200);
        return;
      }

      if (selectedMedicineForInput) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setSelectedMedicineForInput(null);
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }
        return;
      }

      if (completedSale) {
        if (
          (e.altKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP')) ||
          (e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP'))
        ) {
          e.preventDefault();
          printThermalReceipt(completedSale, receiptSettings);
          showToast(
            `🖨️ Direct Print Sent: #${completedSale.InvoiceNumber} -> ${receiptSettings.printerDevice || 'Thermal Printer'}`,
            'success',
            'Direct Print'
          );
          setCompletedSale(null);
          return;
        }
        if (e.key === 'Escape' || (e.altKey && (e.key === 'n' || e.key === 'N'))) {
          e.preventDefault();
          setCompletedSale(null);
          handleNewSale();
          return;
        }
      }

      // 1. Ctrl + C: Jump focus to Current Cart / Chart
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        if (cart.length > 0) {
          setIsCartFocused(true);
          setFocusedCartIndex(0);
        } else {
          searchInputRef.current?.focus();
        }
        return;
      }

      // 2. Alt + T (or Alt+t): Post / Tender Sale
      if (
        (e.altKey && (e.key === 't' || e.key === 'T' || e.code === 'KeyT')) ||
        (e.ctrlKey && (e.key === 't' || e.key === 'T' || e.code === 'KeyT'))
      ) {
        e.preventDefault();
        handleCompleteSale();
        return;
      }

      // 3. Alt + P (or Alt+p): Print POS Thermal Receipt
      if (
        (e.altKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP')) ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP'))
      ) {
        e.preventDefault();
        handlePrintReceipt();
        return;
      }

      // 4. Alt + N: Open New Sale
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        handleNewSale();
        return;
      }

      // 5. Esc or F1: Jump back to Search/Find
      if (e.key === 'Escape' || e.key === 'F1') {
        e.preventDefault();
        setIsCartFocused(false);
        setSubstituteDrawerOpen(false);
        setEditingCartItem(null);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // 6. F2: Focus Extra Bill Discount
      if (e.key === 'F2') {
        e.preventDefault();
        discountInputRef.current?.focus();
        discountInputRef.current?.select();
        return;
      }

      // 7. F3: Focus Customer select
      if (e.key === 'F3') {
        e.preventDefault();
        customerSelectRef.current?.focus();
        return;
      }

      // 8. If Cart is focused (Ctrl+C mode), handle cart keyboard navigation
      if (isCartFocused && cart.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedCartIndex((prev) => (prev < cart.length - 1 ? prev + 1 : 0));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedCartIndex((prev) => (prev > 0 ? prev - 1 : cart.length - 1));
          return;
        }
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          const target = cart[focusedCartIndex];
          if (target) updateQuantity((target as any).lineKey || target.BatchID, 1);
          return;
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          const target = cart[focusedCartIndex];
          if (target) updateQuantity((target as any).lineKey || target.BatchID, -1);
          return;
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          const target = cart[focusedCartIndex];
          if (target) removeFromCart((target as any).lineKey || target.BatchID);
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const target = cart[focusedCartIndex];
          if (target) setEditingCartItem(target);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    postedSaleConfirmation,
    handleFinalizePrint,
    handleSkipPrintAndReset,
    selectedMedicineForInput,
    completedSale,
    cart,
    isCartFocused,
    focusedCartIndex,
    handleCompleteSale,
    handlePrintReceipt,
    handleNewSale,
  ]);

  // Handle Search Input Keydown (ArrowDown, ArrowUp, Enter)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchResults.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex((prev) =>
        prev < searchResults.length - 1 ? prev + 1 : 0
      );
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex((prev) =>
        prev > 0 ? prev - 1 : searchResults.length - 1
      );
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = searchResults[selectedSearchIndex];
      if (selected) {
        if (selected.fefoBatch && selected.totalStock > 0) {
          openItemInputModal(selected.medicine, selected.fefoBatch, selected.totalStock);
        } else {
          const availableBatch = batches.find(
            (b) => b.MedicineID === selected.medicine.MedicineID && b.CurrentStock > 0
          );
          if (availableBatch) {
            openItemInputModal(selected.medicine, availableBatch, availableBatch.CurrentStock);
          } else {
            const pInfo = getPackInfo(selected.medicine, null);
            const childInfo = getChildStoresBalance(selected.medicine, pInfo.piecesPerPack);
            if (childInfo.totalPacks > 0) {
              setInspectStoreMedicine(selected.medicine);
            } else {
              showToast(
                `Stock Alert: ${selected.medicine.TradeName} is out of stock across Pharmacy & Child Stores. Press Alt to view generic substitutes.`,
                'warning',
                'Out of Stock'
              );
            }
          }
        }
      }
      return;
    }
  };

  // Open substitute drawer for a generic
  const handleOpenSubstitute = (genericName: string) => {
    setSubstituteGenericName(genericName);
    setSubstituteDrawerOpen(true);
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col bg-slate-950 select-none overflow-hidden font-sans">
      {/* TOP FAST ACTION & SHORTCUT BAR */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 font-bold text-sm tracking-tight text-white">
            <ShoppingCart className="w-4 h-4 text-emerald-400" />
            <span>Fast Sales Terminal</span>
          </div>

          {/* RETAIL (PER PIECE) VS WHOLESALE (BOX) LIVE TOGGLE SWITCH */}
          <button
            type="button"
            onClick={() =>
              updateReceiptSettings({
                ...receiptSettings,
                wholesaleMode: !receiptSettings.wholesaleMode,
              })
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
              isWholesaleMode
                ? 'bg-amber-950/90 text-amber-300 border-amber-600/70 hover:bg-amber-900/60'
                : 'bg-emerald-950/90 text-emerald-300 border-emerald-600/70 hover:bg-emerald-900/60'
            }`}
            title="Click to toggle between Retail (Per Piece) and Wholesale (Full Box) dispensing"
          >
            {isWholesaleMode ? (
              <>
                <Boxes className="w-3.5 h-3.5 text-amber-400" />
                <span>Mode: Wholesale (Box)</span>
              </>
            ) : (
              <>
                <Pill className="w-3.5 h-3.5 text-emerald-400" />
                <span>Mode: Retail (Per Piece)</span>
              </>
            )}
          </button>

          <div className="h-4 w-px bg-slate-700" />

          {/* User-friendly Shortcut Pills Strip */}
          <div className="hidden xl:flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => {
                setIsCartFocused(false);
                setSelectedMedicineForInput(null);
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
              }}
              className="flex items-center gap-1 text-slate-200 bg-emerald-950/80 hover:bg-emerald-900/80 px-2 py-0.5 rounded border border-emerald-700/60 transition-colors shadow-xs"
              title="Find new medicine item to add (Ctrl+F)"
            >
              <kbd className="font-mono text-emerald-400 font-bold">Ctrl+F</kbd>
              <span className="font-medium text-emerald-300">Find Item</span>
            </button>
            <span className="flex items-center gap-1 text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              <kbd className="font-mono text-emerald-400 font-bold">↓ / ↑</kbd>
              <span>Select Item</span>
            </span>
            <span className="flex items-center gap-1 text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              <kbd className="font-mono text-emerald-400 font-bold">Enter</kbd>
              <span>Take Qty & Disc</span>
            </span>
            <span className="flex items-center gap-1 text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              <kbd className="font-mono text-emerald-400 font-bold">Ctrl+C</kbd>
              <span>Chart / Cart</span>
            </span>
            <span className="flex items-center gap-1 text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              <kbd className="font-mono text-emerald-400 font-bold">Alt+T</kbd>
              <span>Post Sale</span>
            </span>
            <span className="flex items-center gap-1 text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              <kbd className="font-mono text-emerald-400 font-bold">Alt+P</kbd>
              <span>Print POS</span>
            </span>
            <span className="flex items-center gap-1 text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
              <kbd className="font-mono text-emerald-400 font-bold">Alt+N</kbd>
              <span>New Sale</span>
            </span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2">
          {onOpenLiveStock && (
            <button
              type="button"
              onClick={onOpenLiveStock}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold bg-sky-950/80 hover:bg-sky-900/70 text-sky-300 border border-sky-700/60 transition-colors whitespace-nowrap shrink-0"
              title="Open Live Stock Supplier Tree (Pharmacy + Store-1 + Store-2 + Store-3 Balances)"
            >
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Live Stock</span>
            </button>
          )}
          {/* Layout Orientation: Chart on Left (Default) vs Chart on Right */}
          <button
            type="button"
            onClick={() => {
              const next = !cartOnLeft;
              setCartOnLeft(next);
              showToast(next ? 'Current Sale Chart moved to Left' : 'Current Sale Chart moved to Right', 'info', 'Layout Position');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
              cartOnLeft
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60 hover:bg-emerald-900/60'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle layout orientation between Current Sale Chart on Left and Right"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
            <span>{cartOnLeft ? 'Chart: Left (Active)' : 'Chart: Right'}</span>
          </button>

          {/* View Mode: Dense Table (Maximum Rows) vs Cards */}
          <button
            type="button"
            onClick={() => {
              const next = cartViewMode === 'table' ? 'cards' : 'table';
              setCartViewMode(next);
              showToast(next === 'table' ? 'Dense Table Grid (Maximum Rows) Active' : 'Card View Active', 'info', 'Cart View Mode');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
              cartViewMode === 'table'
                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-600/60 hover:bg-indigo-900/60'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle between Dense Table Grid (Maximum Visible Rows) and Card view"
          >
            {cartViewMode === 'table' ? (
              <>
                <TableIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Max Rows View</span>
              </>
            ) : (
              <>
                <ListIcon className="w-3.5 h-3.5 text-sky-400" />
                <span>Cards View</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleNewSale}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition-colors"
            title="Start fresh new sale (Alt+N)"
          >
            <FilePlus className="w-3.5 h-3.5 text-sky-400" />
            <span>New Sale (Alt+N)</span>
          </button>

          <button
            type="button"
            onClick={handlePrintReceipt}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-xs font-medium transition-colors"
            title={`Direct Print to ${receiptSettings.printerDevice || 'Default Thermal Printer'} (Alt+P)`}
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" />
            <span>Direct Print (Alt+P)</span>
          </button>
        </div>
      </div>

      {/* MAIN SALES INTERFACE BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* Helper layout: when cartOnLeft is true, Cart Pane is on the Left, Search Pane on the Right */}
        {cartOnLeft ? (
          <>
            {/* CART PANE ON LEFT */}
            <div
              className={`flex-[1.2] xl:flex-[1.35] min-w-0 xl:min-w-[520px] flex flex-col bg-slate-950 border-r border-slate-800 justify-between shrink-0 transition-all ${
                isCartFocused ? 'ring-2 ring-emerald-500/80 bg-slate-950' : ''
              }`}
            >
              {/* Cart Header */}
              <div className="p-3 border-b border-slate-800 bg-slate-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                      Current Sale Chart ({cart.length} items)
                    </h2>
                    {cart.length > 0 && (
                      <span className="text-[10px] bg-emerald-950/80 text-emerald-300 font-mono border border-emerald-700/60 px-2 py-0.5 rounded flex items-center gap-1">
                        <ArrowDownToLine className="w-3 h-3 text-emerald-400 animate-pulse" />
                        <span>Down Row Active</span>
                      </span>
                    )}
                    {isCartFocused && (
                      <span className="text-[10px] bg-emerald-500 text-slate-950 font-bold px-1.5 py-0.2 rounded animate-pulse">
                        ACTIVE (Ctrl+C)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCartFocused(true);
                        setFocusedCartIndex(Math.max(0, cart.length - 1));
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded border ${
                        isCartFocused
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                      title="Focus Cart Navigation (Ctrl+C)"
                    >
                      Ctrl+C
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await askConfirm({
                          title: 'Clear Current Sale?',
                          message: 'Are you sure you want to remove all items from this transaction chart?',
                          confirmText: 'Clear All Items',
                          destructive: true,
                        });
                        if (ok) {
                          setCart([]);
                          showToast('Cart cleared', 'info', 'Sale Reset');
                        }
                      }}
                      disabled={cart.length === 0}
                      className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Customer Selector */}
                <div className="flex items-center gap-2 pt-1">
                  <label className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Customer (F3):</span>
                  </label>
                  <select
                    ref={customerSelectRef}
                    value={selectedCustomer.CustomerID}
                    onChange={(e) => {
                      const found = customers.find((c) => c.CustomerID === e.target.value);
                      if (found) setSelectedCustomer(found);
                    }}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-emerald-500"
                  >
                    {customers.map((c) => (
                      <option key={c.CustomerID} value={c.CustomerID}>
                        {c.Name} {c.TotalDue > 0 ? `(Due: ${currencySymbol}${c.TotalDue.toFixed(2)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCustomer.TotalDue > 0 && (
                  <div className="text-[10px] bg-amber-950/40 border border-amber-800/40 text-amber-300 px-2 py-1 rounded flex justify-between">
                    <span>Existing Customer Due:</span>
                    <span className="font-mono font-bold">{currencySymbol}{selectedCustomer.TotalDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Cart Items Table / List */}
              <div
                ref={cartListContainerRef}
                className="flex-1 overflow-y-auto select-none"
              >
                {cart.length === 0 ? (
                  <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-slate-500 text-xs space-y-2 p-6 text-center">
                    <ShoppingCart className="w-10 h-10 text-slate-800" />
                    <p className="font-semibold text-slate-400">Current Sale Chart is empty</p>
                    <p className="text-[11px] text-slate-600 max-w-sm">
                      Select a medicine from the catalog on the right using <kbd className="text-emerald-400">↓ / ↑</kbd> then press{' '}
                      <kbd className="text-emerald-400">Enter</kbd> to add. Newly added medicine will appear on the <strong>bottom row</strong>.
                    </p>
                  </div>
                ) : cartViewMode === 'table' ? (
                  /* DENSE TABLE GRID (MAXIMUM VISIBLE ROWS) */
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-900 text-slate-400 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider shadow-xs">
                      <tr>
                        <th className="py-2 px-2 text-center w-10">#</th>
                        <th className="py-2 px-2">Medicine & Molecule</th>
                        <th className="py-2 px-2 text-center w-14">Rack</th>
                        <th className="py-2 px-2 w-28">Batch · Exp</th>
                        <th className="py-2 px-2 text-right w-20">Rate</th>
                        <th className="py-2 px-2 text-center w-28">Qty</th>
                        <th className="py-2 px-2 text-right w-18">Disc.</th>
                        <th className="py-2 px-2 text-right w-24">Total</th>
                        <th className="py-2 px-2 text-center w-16">Act</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {cart.map((item, idx) => {
                        const isFocused = isCartFocused && idx === focusedCartIndex;
                        const isLastRow = idx === cart.length - 1;
                        const itemKey = (item as any).lineKey || item.BatchID;
                        const isRecentlyAdded = itemKey === lastAddedLineKey;
                        const guard = validateProfitMarginGuardrail(
                          item.UnitPrice,
                          item.DiscountAmount,
                          item.CostPrice,
                          item.Quantity
                        );

                        return (
                          <tr
                            key={itemKey}
                            onClick={() => {
                              setIsCartFocused(true);
                              setFocusedCartIndex(idx);
                            }}
                            className={`transition-colors cursor-pointer ${
                              isRecentlyAdded
                                ? 'bg-emerald-950/80 text-emerald-200 ring-2 ring-emerald-400 font-medium'
                                : isFocused
                                ? 'bg-slate-800/90 text-white ring-1 ring-emerald-500'
                                : isLastRow
                                ? 'bg-emerald-950/30 hover:bg-slate-900'
                                : idx % 2 === 0
                                ? 'bg-slate-950 hover:bg-slate-900/80'
                                : 'bg-slate-900/40 hover:bg-slate-900/80'
                            } ${!guard.valid ? 'bg-rose-950/40 border-l-4 border-l-rose-500' : ''}`}
                          >
                            {/* Sequence / Down Row Badge */}
                            <td className="py-2 px-2 text-center font-mono text-[11px]">
                              {isLastRow ? (
                                <span
                                  className="inline-flex items-center gap-0.5 text-emerald-400 font-bold bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-600/60"
                                  title="Latest added medicine on down row"
                                >
                                  <span>{idx + 1}</span>
                                  <ArrowDown className="w-2.5 h-2.5 animate-bounce" />
                                </span>
                              ) : (
                                <span className="text-slate-400">{idx + 1}</span>
                              )}
                            </td>

                            {/* Medicine TradeName & Molecule */}
                            <td className="py-2 px-2 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-slate-100 truncate text-xs">
                                  {item.TradeName}
                                </span>
                                {isRecentlyAdded && (
                                  <span className="text-[9px] bg-emerald-500 text-slate-950 font-bold px-1 rounded uppercase tracking-wider shrink-0">
                                    NEW
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {item.GenericName}
                              </div>
                            </td>

                            {/* Rack No */}
                            <td className="py-2 px-2 text-center">
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/50">
                                {item.RackNo}
                              </span>
                            </td>

                            {/* Batch & Expiry */}
                            <td className="py-2 px-2 text-[11px] font-mono text-slate-300">
                              <div className="truncate font-semibold text-slate-200">{item.BatchNumber}</div>
                              <div className="text-[10px] text-slate-400">{item.ExpiryDate}</div>
                            </td>

                            {/* Rate */}
                            <td className="py-2 px-2 text-right font-mono text-[11px] text-slate-300">
                              <div>{currencySymbol}{item.UnitPrice.toFixed(2)}</div>
                              <div className="text-[9px] text-slate-500">
                                /{item.DispenseUnit === 'Piece' ? 'pc' : 'box'}
                              </div>
                            </td>

                            {/* Quantity Stepper */}
                            <td className="py-1.5 px-2">
                              <div className="flex items-center justify-center gap-1 bg-slate-950 rounded border border-slate-700/80 p-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateQuantity(itemKey, -1);
                                  }}
                                  className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                                  title="Decrease (-)"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCartItem(item);
                                  }}
                                  className="w-8 text-center font-mono font-bold text-slate-100 text-xs hover:text-emerald-400 cursor-pointer"
                                  title="Click to edit quantity or discount"
                                >
                                  {item.Quantity}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateQuantity(itemKey, 1);
                                  }}
                                  className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
                                  title="Increase (+)"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </td>

                            {/* Discount */}
                            <td className="py-2 px-2 text-right font-mono text-[11px]">
                              {item.DiscountAmount > 0 ? (
                                <span className="text-emerald-400 font-semibold">
                                  -{currencySymbol}{item.DiscountAmount.toFixed(2)}
                                  {item.discountPercent ? (
                                    <span className="block text-[9px] text-emerald-500/80">
                                      ({item.discountPercent}%)
                                    </span>
                                  ) : null}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>

                            {/* Line Total */}
                            <td className="py-2 px-2 text-right font-mono font-bold text-xs text-white">
                              {currencySymbol}{item.TotalPrice.toFixed(2)}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-2 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCartItem(item);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors"
                                  title="Edit item"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFromCart(itemKey);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  /* CARD VIEW */
                  <div className="p-3 space-y-2">
                    {cart.map((item, idx) => {
                      const isFocused = isCartFocused && idx === focusedCartIndex;
                      const isLastRow = idx === cart.length - 1;
                      const itemKey = (item as any).lineKey || item.BatchID;
                      const isRecentlyAdded = itemKey === lastAddedLineKey;
                      const guard = validateProfitMarginGuardrail(
                        item.UnitPrice,
                        item.DiscountAmount,
                        item.CostPrice,
                        item.Quantity
                      );

                      return (
                        <div
                          key={itemKey}
                          onClick={() => {
                            setIsCartFocused(true);
                            setFocusedCartIndex(idx);
                          }}
                          className={`p-2.5 rounded-lg border transition-all ${
                            isRecentlyAdded
                              ? 'bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-400 shadow-md'
                              : isFocused
                              ? 'bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/50 shadow-md'
                              : isLastRow
                              ? 'bg-emerald-950/20 border-emerald-900/60'
                              : !guard.valid
                              ? 'bg-rose-950/30 border-rose-600'
                              : 'bg-slate-900/80 border-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {isLastRow && (
                                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1 py-0.2 rounded border border-emerald-800 flex items-center gap-0.5 shrink-0">
                                    <span>#{idx + 1}</span>
                                    <ArrowDown className="w-2.5 h-2.5" />
                                  </span>
                                )}
                                <span className="font-bold text-white text-xs break-words">
                                  {item.TradeName}
                                </span>
                                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1 rounded border border-emerald-800/40 shrink-0">
                                  {item.RackNo}
                                </span>
                                {isRecentlyAdded && (
                                  <span className="text-[9px] bg-emerald-500 text-slate-950 font-bold px-1 rounded shrink-0">
                                    NEW
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Batch: {item.BatchNumber} · Exp: {item.ExpiryDate}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-sm font-mono font-bold text-white">
                                {currencySymbol}{item.TotalPrice.toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromCart(itemKey);
                                }}
                                className="text-slate-500 hover:text-rose-400 ml-2 transition-colors inline-block"
                                title="Remove (Del)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-slate-800/80 text-xs">
                            <div className="flex items-center gap-1 bg-slate-950 rounded border border-slate-700 p-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(itemKey, -1);
                                }}
                                className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white rounded"
                                title="Decrease (-)"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center font-mono font-bold text-slate-100 text-xs">
                                {item.Quantity}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(itemKey, 1);
                                }}
                                className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white rounded"
                                title="Increase (+)"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <span className="text-[11px] font-mono text-slate-300">
                              @{currencySymbol}{item.UnitPrice.toFixed(2)} / {item.DispenseUnit === 'Piece' ? 'pc' : 'box'}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {item.DiscountAmount > 0 && (
                                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 font-mono">
                                  -{currencySymbol}{item.DiscountAmount.toFixed(2)}{' '}
                                  {item.discountPercent ? `(${item.discountPercent}%)` : ''}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCartItem(item);
                                }}
                                className="text-slate-400 hover:text-white p-1 rounded bg-slate-800"
                                title="Edit Qty / Discount (Enter)"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {!guard.valid && (
                            <div className="mt-1 text-[10px] text-rose-300 bg-rose-950 p-1 rounded flex items-center gap-1 border border-rose-700/50">
                              <AlertTriangle className="w-3 h-3 shrink-0 text-rose-400" />
                              <span>{guard.error}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CHECKOUT TOTALS & POST ACTIONS */}
              <div className="p-3.5 bg-slate-900 border-t border-slate-800 space-y-2.5">
                {guardrailError && (
                  <div className="p-2 rounded bg-rose-950 border border-rose-600 text-rose-200 text-xs flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-semibold text-[11px]">{guardrailError}</div>
                  </div>
                )}

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Gross Subtotal:</span>
                    <span className="font-mono text-slate-200">{currencySymbol}{subtotal.toFixed(2)}</span>
                  </div>

                  {itemsDiscountTotal > 0 && (
                    <div className="flex justify-between text-emerald-400 text-[11px]">
                      <span>Items Discount:</span>
                      <span className="font-mono">-{currencySymbol}{itemsDiscountTotal.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-400">
                    <label htmlFor="global-extra-disc" className="flex items-center gap-1">
                      <span>Additional Bill Discount (F2):</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 font-mono">{currencySymbol}</span>
                      <input
                        id="global-extra-disc"
                        ref={discountInputRef}
                        type="number"
                        min="0"
                        step="1"
                        value={globalDiscountAmount || ''}
                        onChange={(e) => setGlobalDiscountAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-right text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
                    <span className="text-sm font-bold text-white uppercase tracking-tight">
                      Net Payable:
                    </span>
                    <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                      {currencySymbol}{finalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(['Cash', 'Card', 'Digital / MFS'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMethod(mode)}
                      className={`py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1 border transition-colors ${
                        paymentMethod === mode
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {mode === 'Cash' && <Banknote className="w-3.5 h-3.5" />}
                      {mode === 'Card' && <CreditCard className="w-3.5 h-3.5" />}
                      {mode === 'Digital / MFS' && <Smartphone className="w-3.5 h-3.5" />}
                      <span>{mode}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">Paid Tendered ({currencySymbol}):</span>
                    <input
                      ref={paidInputRef}
                      type="number"
                      step="1"
                      min="0"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder={finalAmount.toFixed(2)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-white text-xs outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">
                      {changeAmount > 0 ? 'Change Return:' : 'Customer Due:'}
                    </span>
                    <div
                      className={`font-mono text-xs font-semibold px-2 py-1 rounded bg-slate-950 border border-slate-800 ${
                        dueAmount > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {currencySymbol}{(changeAmount > 0 ? changeAmount : dueAmount).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCompleteSale}
                    disabled={cart.length === 0 || !cartGuardrailCheck.valid}
                    className={`py-2.5 rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md ${
                      cart.length === 0 || !cartGuardrailCheck.valid
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                    }`}
                    title="Post sale into database (Alt+T or Alt+t)"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Post Sale (Alt+T)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintReceipt}
                    disabled={cart.length === 0}
                    className={`py-2.5 rounded font-bold text-xs border flex items-center justify-center gap-1.5 transition-all ${
                      cart.length === 0
                        ? 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 cursor-pointer'
                    }`}
                    title={
                      cart.length === 0
                        ? 'Cannot print an empty sale'
                        : 'Click "Post Sale" (Alt+T) first to finalize and print receipt'
                    }
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>Print Receipt (Alt+P)</span>
                  </button>
                </div>
              </div>
            </div>

            {/* MEDICINE SEARCH & CATALOG ON RIGHT */}
            <div className="flex-1 min-w-0 xl:min-w-[360px] flex flex-col overflow-hidden bg-slate-900/60">
              {/* SEARCH INPUT BAR */}
              <div className="p-3 bg-slate-950 border-b border-slate-800 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedSearchIndex(0);
                      setIsCartFocused(false);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Find Medicine: Type name, generic, barcode, or rack... (↓/↑ to navigate, Enter to choose)"
                    className="w-full pl-10 pr-28 py-2.5 bg-slate-900 border-2 border-emerald-500/50 focus:border-emerald-400 rounded text-sm text-white placeholder-slate-400 font-sans shadow-inner outline-none transition-all"
                    autoFocus
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>{searchLatency}ms</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded">
                      POS Ready
                    </span>
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin text-[11px]">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCatalogCategory(cat)}
                      className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors shrink-0 ${
                        catalogCategory === cat
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Quick Helper Bar with Mode Indicator */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 px-1">
                  <span className="flex items-center gap-2">
                    <span className="text-slate-300 font-medium">
                      {searchQuery.trim() === ''
                        ? 'Catalog (Frequently Dispensed)'
                        : `Matches for "${searchQuery}"`}
                    </span>
                    <span className="text-slate-500">· {searchResults.length} items</span>
                    <span className="text-emerald-400 font-semibold">
                      · {isWholesaleMode ? '📦 Wholesale Box Dispensing' : '💊 Retail Loose Piece Dispensing'}
                    </span>
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    <kbd className="text-emerald-400 font-bold">↓ / ↑</kbd> step,{' '}
                    <kbd className="text-emerald-400 font-bold">Enter</kbd> choose
                  </span>
                </div>
              </div>

              {/* DYNAMIC MEDICINE RESULTS LIST */}
              <div
                ref={searchListContainerRef}
                className="flex-1 overflow-y-auto p-3 space-y-1.5 focus:outline-none"
              >
                {searchResults.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
                    <Search className="w-8 h-8 text-slate-700" />
                    <p>No active medicine found matching "{searchQuery}".</p>
                    <p className="text-[11px] text-slate-600">
                      Try typing the active molecule / generic name (e.g. Paracetamol, Omeprazole).
                    </p>
                  </div>
                ) : (
                  searchResults.map(({ medicine: med, totalStock, fefoBatch }, idx) => {
                    const isSelected = idx === selectedSearchIndex;
                    const isOutOfStock = totalStock <= 0 || !fefoBatch;
                    const isLow = totalStock <= med.ReorderLevel;
                    const isExpiringSoon =
                      fefoBatch &&
                      new Date(fefoBatch.ExpiryDate).getTime() - new Date().getTime() <=
                        45 * 24 * 60 * 60 * 1000;

                    const packInfo = getPackInfo(med, fefoBatch);
                    const displayPrice = isWholesaleMode
                      ? packInfo.packPrice
                      : packInfo.piecePrice;
                    const displayUnit = isWholesaleMode ? med.Unit : 'pc';
                    const childStoreInfo = getChildStoresBalance(med, packInfo.piecesPerPack);
                    const useLooseDisplay = !isWholesaleMode && packInfo.piecesPerPack > 1;
                    const pharmDisplayCount = useLooseDisplay
                      ? totalStock * packInfo.piecesPerPack
                      : totalStock;
                    const grandTotalCount = useLooseDisplay
                      ? pharmDisplayCount + childStoreInfo.totalPieces
                      : totalStock + childStoreInfo.totalPacks;

                    return (
                      <div
                        key={med.MedicineID}
                        data-search-idx={idx}
                        onClick={() => {
                          setSelectedSearchIndex(idx);
                          if (!isOutOfStock && fefoBatch) {
                            openItemInputModal(med, fefoBatch, totalStock);
                          } else if (childStoreInfo.totalPacks > 0) {
                            setInspectStoreMedicine(med);
                          }
                        }}
                        className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-wrap sm:flex-nowrap items-start justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-emerald-950/70 border-emerald-500 ring-2 ring-emerald-500/40 shadow-md'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Item Information */}
                        <div className="flex-1 min-w-[160px]">
                          {/* Prominent Dedicated Medicine Brand / Trade Name Line */}
                          <h3 className="font-bold text-white text-sm leading-snug break-words">
                            {med.TradeName}
                          </h3>

                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60 shrink-0">
                              Rack {med.RackNo}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              [{med.Barcode}]
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 break-words mt-1">
                            Generic: <span className="text-slate-200 font-medium">{med.GenericName}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400 mt-1">
                            <span>
                              Batch: <strong className="font-mono text-slate-200">{fefoBatch?.BatchNumber || 'None'}</strong>
                            </span>
                            <span>
                              Expiry:{' '}
                              <strong
                                className={`font-mono ${
                                  isExpiringSoon ? 'text-amber-400 font-bold' : 'text-slate-300'
                                }`}
                              >
                                {fefoBatch?.ExpiryDate || '—'}
                              </strong>
                            </span>
                            <span>
                              Pharmacy:{' '}
                              <strong
                                className={`font-mono tabular-nums ${
                                  isOutOfStock
                                    ? 'text-rose-400 font-bold'
                                    : isLow
                                    ? 'text-amber-400'
                                    : 'text-emerald-400 font-bold'
                                }`}
                              >
                                {useLooseDisplay
                                  ? `${pharmDisplayCount} pcs (${totalStock} ${med.Unit})`
                                  : `${totalStock} ${med.Unit}`}
                              </strong>
                            </span>
                          </div>

                          {/* Live Child Stores Balance Breakdown at Sale Time */}
                          {activeStores.length > 0 && (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-800/70 font-mono tabular-nums">
                              {childStoreInfo.perStore.map((stEntry, sIdx) => {
                                const val = useLooseDisplay ? stEntry.pieceQty : stEntry.packQty;
                                return (
                                  <React.Fragment key={stEntry.store.StoreID}>
                                    {sIdx > 0 && <span className="text-slate-600">·</span>}
                                    <span>
                                      Store-{stEntry.store.StoreNumber}:{' '}
                                      <strong
                                        className={
                                          val > 0 ? 'text-sky-400 font-semibold' : 'text-slate-500'
                                        }
                                      >
                                        {val}
                                      </strong>
                                    </span>
                                  </React.Fragment>
                                );
                              })}
                              <span className="text-slate-600">·</span>
                              <span>
                                Total:{' '}
                                <strong className="text-slate-200 font-semibold">
                                  {grandTotalCount} {useLooseDisplay ? 'pcs' : med.Unit}
                                </strong>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Price & Action */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-base font-bold font-mono text-white block">
                              {currencySymbol}{displayPrice.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              per {displayUnit}
                              {!isWholesaleMode && packInfo.piecesPerPack > 1 && (
                                <span className="block text-[9px] text-slate-500">
                                  (Pack: {currencySymbol}{packInfo.packPrice.toFixed(2)})
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSubstitute(med.GenericName);
                              }}
                              className="px-2 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                              title="View alternative brands for this molecule"
                            >
                              Alt
                            </button>

                            <button
                              type="button"
                              disabled={isOutOfStock}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (fefoBatch) {
                                  openItemInputModal(med, fefoBatch, totalStock);
                                }
                              }}
                              className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1 transition-colors ${
                                isOutOfStock
                                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                            >
                              <CornerDownLeft className="w-3.5 h-3.5" />
                              <span>Select</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        ) : (
          /* CART ON RIGHT (WHEN USER TOGGLES) */
          <>
            {/* MEDICINE SEARCH & CATALOG ON LEFT */}
            <div className="flex-1 min-w-0 xl:min-w-[360px] flex flex-col overflow-hidden border-r border-slate-800 bg-slate-900/60">
              {/* SEARCH INPUT BAR */}
              <div className="p-3 bg-slate-950 border-b border-slate-800 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedSearchIndex(0);
                      setIsCartFocused(false);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Find Medicine: Type name, generic, barcode, or rack... (↓/↑ to navigate, Enter to choose)"
                    className="w-full pl-10 pr-28 py-2.5 bg-slate-900 border-2 border-emerald-500/50 focus:border-emerald-400 rounded text-sm text-white placeholder-slate-400 font-sans shadow-inner outline-none transition-all"
                    autoFocus
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>{searchLatency}ms</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-800 px-1.5 py-0.5 rounded">
                      POS Ready
                    </span>
                  </div>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-thin text-[11px]">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCatalogCategory(cat)}
                      className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors shrink-0 ${
                        catalogCategory === cat
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Quick Helper Bar with Mode Indicator */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 px-1">
                  <span className="flex items-center gap-2">
                    <span className="text-slate-300 font-medium">
                      {searchQuery.trim() === ''
                        ? 'Catalog (Frequently Dispensed)'
                        : `Matches for "${searchQuery}"`}
                    </span>
                    <span className="text-slate-500">· {searchResults.length} items</span>
                    <span className="text-emerald-400 font-semibold">
                      · {isWholesaleMode ? '📦 Wholesale Box Dispensing' : '💊 Retail Loose Piece Dispensing'}
                    </span>
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    <kbd className="text-emerald-400 font-bold">↓ / ↑</kbd> step,{' '}
                    <kbd className="text-emerald-400 font-bold">Enter</kbd> choose
                  </span>
                </div>
              </div>

              {/* DYNAMIC MEDICINE RESULTS LIST */}
              <div
                ref={searchListContainerRef}
                className="flex-1 overflow-y-auto p-3 space-y-1.5 focus:outline-none"
              >
                {searchResults.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs space-y-2">
                    <Search className="w-8 h-8 text-slate-700" />
                    <p>No active medicine found matching "{searchQuery}".</p>
                    <p className="text-[11px] text-slate-600">
                      Try typing the active molecule / generic name (e.g. Paracetamol, Omeprazole).
                    </p>
                  </div>
                ) : (
                  searchResults.map(({ medicine: med, totalStock, fefoBatch }, idx) => {
                    const isSelected = idx === selectedSearchIndex;
                    const isOutOfStock = totalStock <= 0 || !fefoBatch;
                    const isLow = totalStock <= med.ReorderLevel;
                    const isExpiringSoon =
                      fefoBatch &&
                      new Date(fefoBatch.ExpiryDate).getTime() - new Date().getTime() <=
                        45 * 24 * 60 * 60 * 1000;

                    const packInfo = getPackInfo(med, fefoBatch);
                    const displayPrice = isWholesaleMode
                      ? packInfo.packPrice
                      : packInfo.piecePrice;
                    const displayUnit = isWholesaleMode ? med.Unit : 'pc';
                    const childStoreInfo = getChildStoresBalance(med, packInfo.piecesPerPack);
                    const useLooseDisplay = !isWholesaleMode && packInfo.piecesPerPack > 1;
                    const pharmDisplayCount = useLooseDisplay
                      ? totalStock * packInfo.piecesPerPack
                      : totalStock;
                    const grandTotalCount = useLooseDisplay
                      ? pharmDisplayCount + childStoreInfo.totalPieces
                      : totalStock + childStoreInfo.totalPacks;

                    return (
                      <div
                        key={med.MedicineID}
                        data-search-idx={idx}
                        onClick={() => {
                          setSelectedSearchIndex(idx);
                          if (!isOutOfStock && fefoBatch) {
                            openItemInputModal(med, fefoBatch, totalStock);
                          } else if (childStoreInfo.totalPacks > 0) {
                            setInspectStoreMedicine(med);
                          }
                        }}
                        className={`p-2.5 rounded-lg border transition-all cursor-pointer flex flex-wrap sm:flex-nowrap items-start justify-between gap-2.5 ${
                          isSelected
                            ? 'bg-emerald-950/70 border-emerald-500 ring-2 ring-emerald-500/40 shadow-md'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Item Information */}
                        <div className="flex-1 min-w-[160px]">
                          {/* Prominent Dedicated Medicine Brand / Trade Name Line */}
                          <h3 className="font-bold text-white text-sm leading-snug break-words">
                            {med.TradeName}
                          </h3>

                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60 shrink-0">
                              Rack {med.RackNo}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              [{med.Barcode}]
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-400 break-words mt-1">
                            Generic: <span className="text-slate-200 font-medium">{med.GenericName}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400 mt-1">
                            <span>
                              Batch: <strong className="font-mono text-slate-200">{fefoBatch?.BatchNumber || 'None'}</strong>
                            </span>
                            <span>
                              Expiry:{' '}
                              <strong
                                className={`font-mono ${
                                  isExpiringSoon ? 'text-amber-400 font-bold' : 'text-slate-300'
                                }`}
                              >
                                {fefoBatch?.ExpiryDate || '—'}
                              </strong>
                            </span>
                            <span>
                              Pharmacy:{' '}
                              <strong
                                className={`font-mono tabular-nums ${
                                  isOutOfStock
                                    ? 'text-rose-400 font-bold'
                                    : isLow
                                    ? 'text-amber-400'
                                    : 'text-emerald-400 font-bold'
                                }`}
                              >
                                {useLooseDisplay
                                  ? `${pharmDisplayCount} pcs (${totalStock} ${med.Unit})`
                                  : `${totalStock} ${med.Unit}`}
                              </strong>
                            </span>
                          </div>

                          {/* Live Child Stores Balance Breakdown at Sale Time */}
                          {activeStores.length > 0 && (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-400 mt-1 pt-1 border-t border-slate-800/70 font-mono tabular-nums">
                              {childStoreInfo.perStore.map((stEntry, sIdx) => {
                                const val = useLooseDisplay ? stEntry.pieceQty : stEntry.packQty;
                                return (
                                  <React.Fragment key={stEntry.store.StoreID}>
                                    {sIdx > 0 && <span className="text-slate-600">·</span>}
                                    <span>
                                      Store-{stEntry.store.StoreNumber}:{' '}
                                      <strong
                                        className={
                                          val > 0 ? 'text-sky-400 font-semibold' : 'text-slate-500'
                                        }
                                      >
                                        {val}
                                      </strong>
                                    </span>
                                  </React.Fragment>
                                );
                              })}
                              <span className="text-slate-600">·</span>
                              <span>
                                Total:{' '}
                                <strong className="text-slate-200 font-semibold">
                                  {grandTotalCount} {useLooseDisplay ? 'pcs' : med.Unit}
                                </strong>
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Price & Action */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-base font-bold font-mono text-white block">
                              {currencySymbol}{displayPrice.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              per {displayUnit}
                              {!isWholesaleMode && packInfo.piecesPerPack > 1 && (
                                <span className="block text-[9px] text-slate-500">
                                  (Pack: {currencySymbol}{packInfo.packPrice.toFixed(2)})
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenSubstitute(med.GenericName);
                              }}
                              className="px-2 py-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                              title="View alternative brands for this molecule"
                            >
                              Alt
                            </button>

                            <button
                              type="button"
                              disabled={isOutOfStock}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (fefoBatch) {
                                  openItemInputModal(med, fefoBatch, totalStock);
                                }
                              }}
                              className={`px-3 py-1.5 text-xs font-semibold rounded flex items-center gap-1 transition-colors ${
                                isOutOfStock
                                  ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                  : isSelected
                                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                              }`}
                            >
                              <CornerDownLeft className="w-3.5 h-3.5" />
                              <span>Select</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* CART PANE ON RIGHT */}
            <div
              className={`w-[46%] xl:w-[520px] min-w-0 flex flex-col bg-slate-950 justify-between shrink-0 transition-all ${
                isCartFocused ? 'ring-2 ring-emerald-500/80 bg-slate-950' : ''
              }`}
            >
              {/* Cart Header */}
              <div className="p-3 border-b border-slate-800 bg-slate-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                      Current Sale Chart ({cart.length} items)
                    </h2>
                    {isCartFocused && (
                      <span className="text-[10px] bg-emerald-500 text-slate-950 font-bold px-1.5 py-0.2 rounded animate-pulse">
                        ACTIVE (Ctrl+C)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCartFocused(true);
                        setFocusedCartIndex(Math.max(0, cart.length - 1));
                      }}
                      className={`text-[10px] px-2 py-0.5 rounded border ${
                        isCartFocused
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                      }`}
                      title="Focus Cart Navigation (Ctrl+C)"
                    >
                      Ctrl+C
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await askConfirm({
                          title: 'Clear Current Sale?',
                          message: 'Are you sure you want to remove all items from this transaction chart?',
                          confirmText: 'Clear All Items',
                          destructive: true,
                        });
                        if (ok) {
                          setCart([]);
                          showToast('Cart cleared', 'info', 'Sale Reset');
                        }
                      }}
                      disabled={cart.length === 0}
                      className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-40"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Customer Selector */}
                <div className="flex items-center gap-2 pt-1">
                  <label className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Customer (F3):</span>
                  </label>
                  <select
                    ref={customerSelectRef}
                    value={selectedCustomer.CustomerID}
                    onChange={(e) => {
                      const found = customers.find((c) => c.CustomerID === e.target.value);
                      if (found) setSelectedCustomer(found);
                    }}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 outline-none focus:border-emerald-500"
                  >
                    {customers.map((c) => (
                      <option key={c.CustomerID} value={c.CustomerID}>
                        {c.Name} {c.TotalDue > 0 ? `(Due: ${currencySymbol}${c.TotalDue.toFixed(2)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCustomer.TotalDue > 0 && (
                  <div className="text-[10px] bg-amber-950/40 border border-amber-800/40 text-amber-300 px-2 py-1 rounded flex justify-between">
                    <span>Existing Customer Due:</span>
                    <span className="font-mono font-bold">{currencySymbol}{selectedCustomer.TotalDue.toFixed(2)}</span>
                  </div>
                )}
              </div>

              {/* Cart Items Table / List */}
              <div
                ref={cartListContainerRef}
                className="flex-1 overflow-y-auto select-none"
              >
                {cart.length === 0 ? (
                  <div className="h-full min-h-[280px] flex flex-col items-center justify-center text-slate-500 text-xs space-y-2 p-6 text-center">
                    <ShoppingCart className="w-10 h-10 text-slate-800" />
                    <p className="font-semibold text-slate-400">Cart is empty</p>
                    <p className="text-[11px] text-slate-600 max-w-sm">
                      Select a medicine using <kbd className="text-emerald-400">↓ / ↑</kbd> then press{' '}
                      <kbd className="text-emerald-400">Enter</kbd> to input quantity and discount. Newly added medicine will appear on the <strong>bottom row</strong>.
                    </p>
                  </div>
                ) : cartViewMode === 'table' ? (
                  /* DENSE TABLE GRID (MAX ROWS) */
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-900 text-slate-400 border-b border-slate-800 text-[11px] font-semibold uppercase tracking-wider shadow-xs">
                      <tr>
                        <th className="py-2 px-2 text-center w-8">#</th>
                        <th className="py-2 px-2">Medicine & Molecule</th>
                        <th className="py-2 px-2 text-center w-12">Rack</th>
                        <th className="py-2 px-2 w-24">Batch</th>
                        <th className="py-2 px-2 text-right w-16">Rate</th>
                        <th className="py-2 px-2 text-center w-24">Qty</th>
                        <th className="py-2 px-2 text-right w-16">Disc.</th>
                        <th className="py-2 px-2 text-right w-20">Total</th>
                        <th className="py-2 px-2 text-center w-14">Act</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {cart.map((item, idx) => {
                        const isFocused = isCartFocused && idx === focusedCartIndex;
                        const isLastRow = idx === cart.length - 1;
                        const itemKey = (item as any).lineKey || item.BatchID;
                        const isRecentlyAdded = itemKey === lastAddedLineKey;
                        const guard = validateProfitMarginGuardrail(
                          item.UnitPrice,
                          item.DiscountAmount,
                          item.CostPrice,
                          item.Quantity
                        );

                        return (
                          <tr
                            key={itemKey}
                            onClick={() => {
                              setIsCartFocused(true);
                              setFocusedCartIndex(idx);
                            }}
                            className={`transition-colors cursor-pointer ${
                              isRecentlyAdded
                                ? 'bg-emerald-950/80 text-emerald-200 ring-2 ring-emerald-400 font-medium'
                                : isFocused
                                ? 'bg-slate-800/90 text-white ring-1 ring-emerald-500'
                                : isLastRow
                                ? 'bg-emerald-950/30 hover:bg-slate-900'
                                : idx % 2 === 0
                                ? 'bg-slate-950 hover:bg-slate-900/80'
                                : 'bg-slate-900/40 hover:bg-slate-900/80'
                            } ${!guard.valid ? 'bg-rose-950/40 border-l-4 border-l-rose-500' : ''}`}
                          >
                            <td className="py-2 px-2 text-center font-mono text-[11px]">
                              {isLastRow ? (
                                <span
                                  className="inline-flex items-center gap-0.5 text-emerald-400 font-bold bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-600/60"
                                  title="Latest added medicine on down row"
                                >
                                  <span>{idx + 1}</span>
                                  <ArrowDown className="w-2.5 h-2.5 animate-bounce" />
                                </span>
                              ) : (
                                <span className="text-slate-400">{idx + 1}</span>
                              )}
                            </td>
                            <td className="py-2 px-2 min-w-0">
                              <div className="font-semibold text-slate-100 truncate text-xs">
                                {item.TradeName}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {item.GenericName}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1 py-0.5 rounded border border-emerald-800/50">
                                {item.RackNo}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-[10px] font-mono text-slate-300">
                              <div className="truncate font-semibold">{item.BatchNumber}</div>
                              <div className="text-[9px] text-slate-500">{item.ExpiryDate}</div>
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-[10px] text-slate-300">
                              {currencySymbol}{item.UnitPrice.toFixed(2)}
                            </td>
                            <td className="py-1.5 px-2">
                              <div className="flex items-center justify-center gap-1 bg-slate-950 rounded border border-slate-700/80 p-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateQuantity(itemKey, -1);
                                  }}
                                  className="w-4 h-4 flex items-center justify-center text-slate-300 hover:text-white rounded"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <span className="w-6 text-center font-mono font-bold text-slate-100 text-[11px]">
                                  {item.Quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateQuantity(itemKey, 1);
                                  }}
                                  className="w-4 h-4 flex items-center justify-center text-slate-300 hover:text-white rounded"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-[10px]">
                              {item.DiscountAmount > 0 ? (
                                <span className="text-emerald-400 font-semibold">
                                  -{currencySymbol}{item.DiscountAmount.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold text-xs text-white">
                              {currencySymbol}{item.TotalPrice.toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingCartItem(item);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-slate-800"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFromCart(itemKey);
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  /* CARD VIEW (Cart on right) */
                  <div className="p-3 space-y-2">
                    {cart.map((item, idx) => {
                      const isFocused = isCartFocused && idx === focusedCartIndex;
                      const isLastRow = idx === cart.length - 1;
                      const itemKey = (item as any).lineKey || item.BatchID;
                      const isRecentlyAdded = itemKey === lastAddedLineKey;
                      const guard = validateProfitMarginGuardrail(
                        item.UnitPrice,
                        item.DiscountAmount,
                        item.CostPrice,
                        item.Quantity
                      );

                      return (
                        <div
                          key={itemKey}
                          onClick={() => {
                            setIsCartFocused(true);
                            setFocusedCartIndex(idx);
                          }}
                          className={`p-2.5 rounded-lg border transition-all ${
                            isRecentlyAdded
                              ? 'bg-emerald-950/80 border-emerald-400 ring-2 ring-emerald-400 shadow-md'
                              : isFocused
                              ? 'bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/50 shadow-md'
                              : isLastRow
                              ? 'bg-emerald-950/20 border-emerald-900/60'
                              : !guard.valid
                              ? 'bg-rose-950/30 border-rose-600'
                              : 'bg-slate-900/80 border-slate-800'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {isLastRow && (
                                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-1 py-0.2 rounded border border-emerald-800 flex items-center gap-0.5 shrink-0">
                                    <span>#{idx + 1}</span>
                                    <ArrowDown className="w-2.5 h-2.5" />
                                  </span>
                                )}
                                <span className="font-bold text-white text-xs break-words">
                                  {item.TradeName}
                                </span>
                                <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/80 px-1 rounded border border-emerald-800/40 shrink-0">
                                  {item.RackNo}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Batch: {item.BatchNumber} · Exp: {item.ExpiryDate}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-sm font-mono font-bold text-white">
                                {currencySymbol}{item.TotalPrice.toFixed(2)}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromCart(itemKey);
                                }}
                                className="text-slate-500 hover:text-rose-400 ml-2 transition-colors inline-block"
                                title="Remove (Del)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-slate-800/80 text-xs">
                            <div className="flex items-center gap-1 bg-slate-950 rounded border border-slate-700 p-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(itemKey, -1);
                                }}
                                className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white rounded"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-8 text-center font-mono font-bold text-slate-100 text-xs">
                                {item.Quantity}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateQuantity(itemKey, 1);
                                }}
                                className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-white rounded"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <span className="text-[11px] font-mono text-slate-300">
                              @{currencySymbol}{item.UnitPrice.toFixed(2)} / {item.DispenseUnit === 'Piece' ? 'pc' : 'box'}
                            </span>

                            <div className="flex items-center gap-1.5">
                              {item.DiscountAmount > 0 && (
                                <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 font-mono">
                                  -{currencySymbol}{item.DiscountAmount.toFixed(2)}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCartItem(item);
                                }}
                                className="text-slate-400 hover:text-white p-1 rounded bg-slate-800"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CHECKOUT TOTALS & POST ACTIONS */}
              <div className="p-3.5 bg-slate-900 border-t border-slate-800 space-y-2.5">
                {guardrailError && (
                  <div className="p-2 rounded bg-rose-950 border border-rose-600 text-rose-200 text-xs flex items-start gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="flex-1 font-semibold text-[11px]">{guardrailError}</div>
                  </div>
                )}

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Gross Subtotal:</span>
                    <span className="font-mono text-slate-200">{currencySymbol}{subtotal.toFixed(2)}</span>
                  </div>

                  {itemsDiscountTotal > 0 && (
                    <div className="flex justify-between text-emerald-400 text-[11px]">
                      <span>Items Discount:</span>
                      <span className="font-mono">-{currencySymbol}{itemsDiscountTotal.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-400">
                    <label htmlFor="global-extra-disc-r" className="flex items-center gap-1">
                      <span>Additional Bill Discount (F2):</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 font-mono">{currencySymbol}</span>
                      <input
                        id="global-extra-disc-r"
                        ref={discountInputRef}
                        type="number"
                        min="0"
                        step="1"
                        value={globalDiscountAmount || ''}
                        onChange={(e) => setGlobalDiscountAmount(parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-right text-xs text-white outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-baseline pt-2 border-t border-slate-800">
                    <span className="text-sm font-bold text-white uppercase tracking-tight">
                      Net Payable:
                    </span>
                    <span className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
                      {currencySymbol}{finalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(['Cash', 'Card', 'Digital / MFS'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMethod(mode)}
                      className={`py-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1 border transition-colors ${
                        paymentMethod === mode
                          ? 'bg-emerald-600 text-white border-emerald-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {mode === 'Cash' && <Banknote className="w-3.5 h-3.5" />}
                      {mode === 'Card' && <CreditCard className="w-3.5 h-3.5" />}
                      {mode === 'Digital / MFS' && <Smartphone className="w-3.5 h-3.5" />}
                      <span>{mode}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">Paid Tendered ({currencySymbol}):</span>
                    <input
                      ref={paidInputRef}
                      type="number"
                      step="1"
                      min="0"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder={finalAmount.toFixed(2)}
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 font-mono text-white text-xs outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 block mb-0.5">
                      {changeAmount > 0 ? 'Change Return:' : 'Customer Due:'}
                    </span>
                    <div
                      className={`font-mono text-xs font-semibold px-2 py-1 rounded bg-slate-950 border border-slate-800 ${
                        dueAmount > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {currencySymbol}{(changeAmount > 0 ? changeAmount : dueAmount).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCompleteSale}
                    disabled={cart.length === 0 || !cartGuardrailCheck.valid}
                    className={`py-2.5 rounded font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md ${
                      cart.length === 0 || !cartGuardrailCheck.valid
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                    }`}
                    title="Post sale into database (Alt+T or Alt+t)"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Post Sale (Alt+T)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintReceipt}
                    disabled={cart.length === 0}
                    className={`py-2.5 rounded font-bold text-xs border flex items-center justify-center gap-1.5 transition-all ${
                      cart.length === 0
                        ? 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 cursor-pointer'
                    }`}
                    title={
                      cart.length === 0
                        ? 'Cannot print an empty sale'
                        : 'Click "Post Sale" (Alt+T) first to finalize and print receipt'
                    }
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>Print Receipt (Alt+P)</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* CHILD WINDOW: INPUT QUANTITY & DISCOUNT MODAL */}
      {selectedMedicineForInput && (() => {
        const packInfo = getPackInfo(
          selectedMedicineForInput.medicine,
          selectedMedicineForInput.batch
        );
        const isPiece = modalDispenseUnit === 'Piece';
        const activeUnitPrice = isPiece ? packInfo.piecePrice : packInfo.packPrice;
        const activeCostPrice = isPiece ? packInfo.pieceCost : packInfo.packCost;
        const availableCount = isPiece
          ? selectedMedicineForInput.availableStock * packInfo.piecesPerPack
          : selectedMedicineForInput.availableStock;

        const childStoresBalance = getChildStoresBalance(
          selectedMedicineForInput.medicine,
          packInfo.piecesPerPack
        );
        const childStoresAvailableCount = isPiece
          ? childStoresBalance.totalPieces
          : childStoresBalance.totalPacks;
        const totalCombinedAvailableCount = availableCount + childStoresAvailableCount;

        const qty = modalQuantity || 1;
        const gross = activeUnitPrice * qty;
        const discAmt = (gross * (modalDiscountPercent || 0)) / 100;
        const net = gross - discAmt;
        const guard = validateProfitMarginGuardrail(
          activeUnitPrice,
          discAmt,
          activeCostPrice,
          qty
        );

        const unitShortLabel = isPiece
          ? 'pcs'
          : selectedMedicineForInput.medicine.Unit;

        return (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-slate-900 border-2 border-emerald-500 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-100">
              {/* Child Window Header */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white">
                    Item Entry: Dispense Quantity & Discount
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMedicineForInput(null);
                    setTimeout(() => searchInputRef.current?.focus(), 50);
                  }}
                  className="text-slate-400 hover:text-white"
                  title="Close (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Selected Medicine Info Card */}
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-bold text-white">
                      {selectedMedicineForInput.medicine.TradeName}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {selectedMedicineForInput.medicine.GenericName}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                    Rack {selectedMedicineForInput.medicine.RackNo}
                  </span>
                </div>

                {/* DISPENSING UNIT SELECTOR: PIECE (RETAIL) VS BOX (WHOLESALE) */}
                <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setModalDispenseUnit('Piece');
                      modalQtyInputRef.current?.focus();
                      modalQtyInputRef.current?.select();
                    }}
                    className={`flex-1 py-1.5 px-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                      isPiece
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Pill className="w-3.5 h-3.5" />
                    <span>Sell Per Piece (Loose)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setModalDispenseUnit('Box');
                      modalQtyInputRef.current?.focus();
                      modalQtyInputRef.current?.select();
                    }}
                    className={`flex-1 py-1.5 px-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
                      !isPiece
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Boxes className="w-3.5 h-3.5" />
                    <span>Sell Full {selectedMedicineForInput.medicine.Unit} (Box)</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-0.5 text-[11px] text-slate-400">
                  <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Batch No:</span>
                    <span className="font-mono font-semibold text-slate-200">
                      {selectedMedicineForInput.batch.BatchNumber}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">
                      {isPiece ? 'Rate / Piece:' : 'Rate / Pack:'}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-emerald-400">
                      {currencySymbol}{activeUnitPrice.toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Pharmacy Counter:</span>
                    <span className="font-mono tabular-nums font-semibold text-white">
                      {availableCount} {unitShortLabel}
                    </span>
                  </div>
                </div>

                {/* LIVE MULTI-LOCATION BALANCE MATRIX (PHARMACY + CHILD STORES + TOTAL) */}
                <div className="rounded-lg border border-slate-800 bg-slate-900/90 overflow-hidden">
                  <div className="px-2.5 py-1.5 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Warehouse className="w-3 h-3 text-sky-400" />
                      <span>Live Pharmacy & Child Stores Balance ({unitShortLabel})</span>
                    </span>
                    <span className="font-mono tabular-nums text-slate-400">
                      {activeStores.length} Active Store{activeStores.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div
                    className={`grid divide-x divide-slate-800 text-center ${
                      activeStores.length === 0
                        ? 'grid-cols-2'
                        : activeStores.length === 1
                        ? 'grid-cols-3'
                        : activeStores.length === 2
                        ? 'grid-cols-4'
                        : 'grid-cols-5'
                    }`}
                  >
                    <div className="py-1.5 px-1.5">
                      <span className="text-[10px] text-slate-400 block truncate">Pharmacy</span>
                      <span className="font-mono tabular-nums text-xs font-bold text-emerald-400 block">
                        {availableCount}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500 block truncate">
                        {selectedMedicineForInput.medicine.RackNo}
                      </span>
                    </div>

                    {childStoresBalance.perStore.map((stEntry) => {
                      const stVal = isPiece ? stEntry.pieceQty : stEntry.packQty;
                      return (
                        <div key={stEntry.store.StoreID} className="py-1.5 px-1.5">
                          <span className="text-[10px] text-slate-400 block truncate">
                            Store-{stEntry.store.StoreNumber}
                          </span>
                          <span
                            className={`font-mono tabular-nums text-xs font-bold block ${
                              stVal > 0 ? 'text-sky-400' : 'text-slate-600'
                            }`}
                          >
                            {stVal}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500 block truncate">
                            {stEntry.racks[0] || '—'}
                          </span>
                        </div>
                      );
                    })}

                    <div className="py-1.5 px-1.5 bg-slate-950/60">
                      <span className="text-[10px] text-slate-300 font-semibold block truncate">
                        Total
                      </span>
                      <span className="font-mono tabular-nums text-xs font-bold text-white block">
                        {totalCombinedAvailableCount}
                      </span>
                      <span className="text-[9px] text-slate-500 block truncate">
                        All Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Child Window Input Form */}
              <div className="p-4 space-y-4">
                {modalError && (
                  <div className="p-2 rounded bg-rose-950 border border-rose-600 text-rose-200 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                {modalQuantity > availableCount && childStoresAvailableCount > 0 && (
                  <div className="p-2 rounded bg-sky-950/70 border border-sky-700/60 text-sky-200 text-[11px]">
                    Counter has <strong>{availableCount} {unitShortLabel}</strong>, while Child Stores hold an extra{' '}
                    <strong className="font-mono tabular-nums">
                      {childStoresAvailableCount} {unitShortLabel}
                    </strong>{' '}
                    (Total: {totalCombinedAvailableCount} {unitShortLabel}). Dispense up to {availableCount} now and request Store Out replenishment for the rest.
                  </div>
                )}

                {/* INPUT 1: QUANTITY */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="modal-qty-input" className="text-xs font-bold text-slate-300">
                      1. Quantity ({isPiece ? 'Pieces' : selectedMedicineForInput.medicine.Unit}):
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Press <kbd className="text-emerald-400 font-bold">Enter</kbd> to Confirm & Add (or <kbd className="text-slate-400">Tab</kbd> for Discount)
                    </span>
                  </div>
                  <input
                    id="modal-qty-input"
                    ref={modalQtyInputRef}
                    type="number"
                    min="1"
                    max={availableCount}
                    value={modalQuantity || ''}
                    onChange={(e) => setModalQuantity(parseInt(e.target.value) || 0)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (modalQuantity <= 0) {
                          setModalError('Quantity must be at least 1.');
                          return;
                        }
                        if (modalQuantity > availableCount) {
                          setModalError(`Cannot exceed Pharmacy Counter stock (${availableCount} ${isPiece ? 'pieces' : selectedMedicineForInput.medicine.Unit}).`);
                          return;
                        }
                        setModalError(null);
                        confirmAddItemFromModal();
                      }
                    }}
                    className="w-full bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 rounded-lg p-2.5 text-lg font-mono text-white outline-none"
                  />
                </div>

                {/* INPUT 2: DISCOUNT PERCENT */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label htmlFor="modal-disc-input" className="text-xs font-bold text-slate-300">
                      2. Discount (%):
                    </label>
                    <span className="text-[10px] text-slate-500">
                      Press <kbd className="text-emerald-400 font-bold">Enter</kbd> to add item & find next
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="modal-disc-input"
                      ref={modalDiscInputRef}
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={modalDiscountPercent}
                      onChange={(e) => setModalDiscountPercent(parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          confirmAddItemFromModal();
                        }
                      }}
                      className="flex-1 bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 rounded-lg p-2.5 text-lg font-mono text-white outline-none"
                    />
                    {/* Preset quick discount buttons */}
                    <div className="flex items-center gap-1">
                      {[0, 5, 10, 15].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setModalDiscountPercent(pct);
                            modalDiscInputRef.current?.focus();
                          }}
                          className={`px-2 py-2 text-xs font-semibold rounded border ${
                            modalDiscountPercent === pct
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* LIVE TOTAL CALCULATION PREVIEW */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>
                      Gross ({qty} {isPiece ? 'pcs' : selectedMedicineForInput.medicine.Unit} × {currencySymbol}{activeUnitPrice.toFixed(2)}):
                    </span>
                    <span className="font-mono text-slate-200">{currencySymbol}{gross.toFixed(2)}</span>
                  </div>
                  {discAmt > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Discount ({modalDiscountPercent}%):</span>
                      <span className="font-mono">-{currencySymbol}{discAmt.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-white pt-1 border-t border-slate-800">
                    <span>Item Total:</span>
                    <span className="font-mono text-emerald-400">{currencySymbol}{net.toFixed(2)}</span>
                  </div>
                  {!guard.valid && (
                    <div className="text-[10px] text-rose-400 font-semibold pt-1">
                      ⚠️ Margin Warning: {guard.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Child Window Actions */}
              <div className="p-3 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
                <span className="text-[11px] text-slate-400">
                  Press <kbd className="text-emerald-400 font-bold">Enter</kbd> to Confirm ·{' '}
                  <kbd className="text-slate-300">Esc</kbd> to Cancel
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMedicineForInput(null);
                      setTimeout(() => searchInputRef.current?.focus(), 50);
                    }}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded transition-colors"
                  >
                    Cancel (Esc)
                  </button>
                  <button
                    type="button"
                    onClick={confirmAddItemFromModal}
                    className="px-4 py-1.5 text-xs font-bold rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition-colors shadow-md"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirm & Add (Enter)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* INLINE CART ITEM EDIT MODAL */}
      {editingCartItem && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-sm w-full p-4 space-y-3 text-slate-100">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-sm">Adjust Cart Item</h3>
              <button
                onClick={() => setEditingCartItem(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <p className="font-semibold text-white text-xs">{editingCartItem.TradeName}</p>
              <p className="text-[10px] text-slate-400">
                Batch: {editingCartItem.BatchNumber} · Rate: {currencySymbol}{editingCartItem.UnitPrice.toFixed(2)} / {editingCartItem.DispenseUnit || 'pc'}
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[11px] text-slate-300 block mb-1">
                  Quantity ({editingCartItem.DispenseUnit || 'Units'}):
                </label>
                <input
                  type="number"
                  min="1"
                  max={editingCartItem.availableStock}
                  value={editingCartItem.Quantity}
                  onChange={(e) => {
                    const q = parseInt(e.target.value) || 1;
                    setEditingCartItem({ ...editingCartItem, Quantity: q });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 font-mono text-white outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1">Discount Amount ({currencySymbol}):</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editingCartItem.DiscountAmount}
                  onChange={(e) => {
                    const d = parseFloat(e.target.value) || 0;
                    setEditingCartItem({ ...editingCartItem, DiscountAmount: d });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 font-mono text-white outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingCartItem(null)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setCart((prev) =>
                    prev.map((item) => {
                      const itemKey = (item as any).lineKey || item.BatchID;
                      const editKey = (editingCartItem as any).lineKey || editingCartItem.BatchID;
                      if (itemKey === editKey || item.BatchID === editingCartItem.BatchID) {
                        const total =
                          item.UnitPrice * editingCartItem.Quantity - editingCartItem.DiscountAmount;
                        return {
                          ...item,
                          Quantity: editingCartItem.Quantity,
                          DiscountAmount: editingCartItem.DiscountAmount,
                          TotalPrice: Math.round(total * 100) / 100,
                        };
                      }
                      return item;
                    })
                  );
                  setEditingCartItem(null);
                  setIsCartFocused(true);
                }}
                className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Brand Substitute Drawer */}
      {substituteDrawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-end backdrop-blur-xs">
          <div className="w-[420px] h-full bg-slate-950 border-l border-slate-800 p-4 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-semibold text-slate-100 text-sm">
                    Generic Molecule Substitutes
                  </h3>
                </div>
                <button
                  onClick={() => setSubstituteDrawerOpen(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  ✕ Close
                </button>
              </div>

              <div className="py-2 text-xs text-slate-400">
                Alternative brands with identical molecule:{' '}
                <strong className="text-emerald-400 font-medium">{substituteGenericName}</strong>
              </div>

              <div className="space-y-2 mt-2 max-h-[70vh] overflow-y-auto">
                {findSubstitutes(substituteGenericName).map(
                  ({ medicine: subMed, totalStock, batches: subBatches }) => {
                    const fefo = subBatches.sort(
                      (a, b) => new Date(a.ExpiryDate).getTime() - new Date(b.ExpiryDate).getTime()
                    )[0];

                    const packInfo = getPackInfo(subMed, fefo);
                    const subChildStores = getChildStoresBalance(subMed, packInfo.piecesPerPack);

                    return (
                      <div
                        key={subMed.MedicineID}
                        className="p-3 rounded bg-slate-900 border border-slate-800 text-xs space-y-1.5"
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold text-slate-100">{subMed.TradeName}</span>
                          <span className="font-mono text-emerald-400 text-[11px] bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                            Rack {subMed.RackNo}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>
                            Pharmacy:{' '}
                            <strong className="text-emerald-300 font-mono tabular-nums">
                              {!isWholesaleMode
                                ? `${totalStock * packInfo.piecesPerPack} pcs`
                                : `${totalStock} ${subMed.Unit}`}
                            </strong>
                            {' · '}Stores:{' '}
                            <strong className="text-sky-300 font-mono tabular-nums">
                              {!isWholesaleMode
                                ? `${subChildStores.totalPieces} pcs`
                                : `${subChildStores.totalPacks} ${subMed.Unit}`}
                            </strong>
                          </span>
                          <span>
                            Rate:{' '}
                            <strong className="text-white font-mono tabular-nums">
                              {currencySymbol}{!isWholesaleMode ? packInfo.piecePrice.toFixed(2) : packInfo.packPrice.toFixed(2)}
                            </strong>
                          </span>
                        </div>
                        <div className="pt-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              if (fefo) {
                                openItemInputModal(subMed, fefo, totalStock);
                                setSubstituteDrawerOpen(false);
                              }
                            }}
                            disabled={!fefo || totalStock <= 0}
                            className="px-2.5 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-40"
                          >
                            Select Alternative
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}

                {findSubstitutes(substituteGenericName).length === 0 && (
                  <p className="text-slate-500 text-xs p-4 text-center">
                    No alternative active brands currently stocked for this generic molecule.
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => setSubstituteDrawerOpen(false)}
              className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs rounded transition-colors"
            >
              Back to POS
            </button>
          </div>
        </div>
      )}

      {/* CHILD STORE AVAILABILITY INSPECTOR MODAL (When Pharmacy Counter is 0 but Child Stores have stock) */}
      {inspectStoreMedicine && (() => {
        const pInfo = getPackInfo(inspectStoreMedicine, null);
        const childInfo = getChildStoresBalance(inspectStoreMedicine, pInfo.piecesPerPack);

        return (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-slate-100">
              <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-white">
                    Child Store Stock Availability
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectStoreMedicine(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {inspectStoreMedicine.TradeName}
                  </h4>
                  <p className="text-slate-400 text-[11px]">
                    {inspectStoreMedicine.GenericName} · Pharmacy Counter Balance: <strong className="text-rose-400 font-mono">0</strong>
                  </p>
                </div>

                <div className="divide-y divide-slate-800 rounded border border-slate-800 bg-slate-950">
                  {childInfo.perStore.map((entry) => (
                    <div
                      key={entry.store.StoreID}
                      className="p-2.5 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-200 block">
                          Store-{entry.store.StoreNumber} ({entry.store.Code})
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {entry.racks.length > 0
                            ? `Rack: ${entry.racks.join(', ')}`
                            : 'Not stocked in this store'}{' '}
                          · Mgr: {entry.store.BranchManager}
                        </span>
                      </div>
                      <div className="text-right font-mono tabular-nums">
                        <span
                          className={`text-sm font-bold block ${
                            entry.packQty > 0 ? 'text-sky-400' : 'text-slate-600'
                          }`}
                        >
                          {entry.packQty} {inspectStoreMedicine.Unit}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {entry.pieceQty} pcs
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="p-2.5 bg-slate-900 flex items-center justify-between font-semibold">
                    <span className="text-slate-200">Total Child Stores Balance</span>
                    <span className="font-mono tabular-nums text-white">
                      {childInfo.totalPacks} {inspectStoreMedicine.Unit} ({childInfo.totalPieces} pcs)
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const generic = inspectStoreMedicine.GenericName;
                      setInspectStoreMedicine(null);
                      handleOpenSubstitute(generic);
                    }}
                    className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
                  >
                    View Generic Substitutes
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectStoreMedicine(null)}
                    className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* POS Thermal Receipt Print Modal */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          settings={receiptSettings}
          onClose={() => setCompletedSale(null)}
        />
      )}

      {/* MINI CHILD CONFIRMATION WINDOW FOR POSTED SALE */}
      {/* Salesmen must NOT print empty sale or without clicking Post first. */}
      {/* Once sale is posted, automatically opens this mini window. */}
      {/* Pressing Enter key or Space bar triggers the final transaction receipt print. */}
      {/* Immediately after printing, resets the POS interface cleanly for next customer entry. */}
      {postedSaleConfirmation && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-slate-900 border-2 border-emerald-500 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden text-slate-100 flex flex-col animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-gradient-to-b from-emerald-950/80 to-slate-950 border-b border-slate-800 text-center relative">
              <button
                type="button"
                onClick={handleSkipPrintAndReset}
                className="absolute right-3 top-3 text-slate-400 hover:text-white p-1 rounded-full transition-colors cursor-pointer"
                title="Skip & Next Customer (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto mb-2 shadow-lg shadow-emerald-950">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Sale Posted Successfully!
              </h3>
              <p className="text-xs text-emerald-400 font-mono mt-0.5 font-semibold">
                Invoice #{postedSaleConfirmation.InvoiceNumber}
              </p>
            </div>

            {/* Summary Details */}
            <div className="p-4 space-y-3 bg-slate-900 text-xs">
              <div className="bg-slate-950 rounded-lg p-3 border border-slate-800 space-y-1.5 font-sans">
                <div className="flex justify-between text-slate-400">
                  <span>Customer:</span>
                  <span className="font-semibold text-white truncate max-w-[170px]">
                    {postedSaleConfirmation.CustomerName}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Dispensed Items:</span>
                  <span className="font-mono text-slate-200">
                    {postedSaleConfirmation.Items.length} line(s) ({postedSaleConfirmation.Items.reduce((acc, i) => acc + i.Quantity, 0)} units)
                  </span>
                </div>
                <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Payment Mode:</span>
                  <span className="font-medium text-emerald-400">{postedSaleConfirmation.PaymentMethod}</span>
                </div>
                <div className="flex justify-between items-center text-sm pt-1 border-t border-slate-800">
                  <span className="font-bold text-white">Net Total:</span>
                  <span className="font-mono font-bold text-emerald-400 text-base">
                    {currencySymbol}{postedSaleConfirmation.FinalAmount.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Paid: {currencySymbol}{postedSaleConfirmation.PaidAmount.toFixed(2)}</span>
                  <span>
                    {postedSaleConfirmation.DueAmount > 0
                      ? `Due: ${currencySymbol}${postedSaleConfirmation.DueAmount.toFixed(2)}`
                      : `Change: ${currencySymbol}${Math.max(0, postedSaleConfirmation.PaidAmount - postedSaleConfirmation.FinalAmount).toFixed(2)}`}
                  </span>
                </div>
              </div>

              {/* Primary Print Receipt Button */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  autoFocus
                  onClick={() => handleFinalizePrint(postedSaleConfirmation)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/60 cursor-pointer transition-all border border-emerald-400/40"
                  title="Press Enter or Space bar to Print Receipt"
                >
                  <Printer className="w-5 h-5 text-white" />
                  <span>Print Transaction Receipt</span>
                  <span className="ml-1 text-[10px] bg-emerald-800/90 text-emerald-100 px-2 py-0.5 rounded border border-emerald-400/50 font-mono font-normal">
                    Enter / Space
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleSkipPrintAndReset}
                  className="w-full py-2 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium border border-slate-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  title="Skip printing receipt and reset POS for next customer"
                >
                  <span>Skip Print & Next Customer</span>
                  <span className="text-[10px] text-slate-500 font-mono">[Esc]</span>
                </button>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="px-4 py-2 bg-slate-950/90 border-t border-slate-800/80 text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5">
              <span>🖨️ Thermal Device:</span>
              <span className="text-emerald-400 font-mono font-semibold">
                {receiptSettings.printerDevice || 'Thermal POS Printer (80mm)'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
