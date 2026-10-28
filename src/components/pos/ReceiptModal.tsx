/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * POS Thermal Receipt Print Modal (58mm / 80mm ESC/POS layout)
 */

import React, { useState } from 'react';
import { Sale, ReceiptSettings } from '../../types/pharmacy';
import { generateBarcodeSvg } from '../../utils/barcodeGenerator';
import { printThermalReceipt } from '../../utils/thermalPrinter';
import { Printer, X, CheckCircle2 } from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale;
  settings: ReceiptSettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  sale,
  settings,
  onClose,
}) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);
  const { svgPath, totalWidth } = generateBarcodeSvg(sale.InvoiceNumber, 36, 1.4);

  const handlePrint = async () => {
    setIsPrinting(true);
    await printThermalReceipt(sale, settings, () => {
      setIsPrinting(false);
      setPrintSuccess(true);
      setTimeout(() => {
        onClose();
      }, 700);
    });
  };


  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP')) ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.code === 'KeyP')) ||
        e.key === 'Enter'
      ) {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, sale, settings]);

  const is58mm = settings.printerWidth === '58mm';
  const currency = settings.currencySymbol || '$';

  return (
    <div className="print-container-active fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl max-w-md w-full flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">
                Thermal Receipt Preview ({settings.printerWidth})
              </h3>
              <p className="text-[10px] text-emerald-400 font-mono">
                Target: {settings.printerDevice || 'Default Thermal POS Printer'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 transition-colors p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Receipt Content Wrapper */}
        <div className="p-4 overflow-y-auto bg-slate-800/40 flex justify-center">
          <div
            id="printable-receipt"
            className={`bg-white text-black p-4 shadow-md font-mono text-[11px] leading-tight select-text ${
              is58mm ? 'w-[230px]' : 'w-[310px]'
            }`}
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-neutral-400">
              <h2 className="font-bold text-xs uppercase tracking-tight">
                {settings.pharmacyName}
              </h2>
              <p className="text-[10px] text-neutral-600 mt-0.5">{settings.address}</p>
              <p className="text-[10px] text-neutral-600">{settings.phone}</p>
              <p className="text-[9px] text-neutral-500 mt-0.5">{settings.taxNumber}</p>
            </div>

            {/* Meta */}
            <div className="py-2 border-b border-dashed border-neutral-400 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Invoice:</span>
                <span className="font-bold">{sale.InvoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(sale.SaleDate).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Dispenser:</span>
                <span>{sale.SalesmanName}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span className="truncate max-w-[140px]">{sale.CustomerName}</span>
              </div>
              {sale.CustomerPhone && sale.CustomerPhone !== 'N/A' && (
                <div className="flex justify-between">
                  <span>Phone:</span>
                  <span>{sale.CustomerPhone}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2 border-b border-dashed border-neutral-400">
              <div className="flex justify-between font-bold pb-1 text-[10px] border-b border-neutral-300">
                <span className="w-1/2">Item Description</span>
                <span className="w-1/6 text-center">Qty</span>
                <span className="w-1/6 text-right">Rate</span>
                <span className="w-1/6 text-right">Total</span>
              </div>

              <div className="pt-1 space-y-1.5">
                {sale.Items.map((item, idx) => (
                  <div key={idx} className="text-[10px]">
                    <div className="flex justify-between">
                      <span className="font-semibold truncate w-1/2">{item.TradeName}</span>
                      <span className="w-1/6 text-center tabular-nums text-[9px]">
                        {item.Quantity} {item.DispenseUnit === 'Piece' ? 'pcs' : item.DispenseUnit === 'Box' ? 'box' : ''}
                      </span>
                      <span className="w-1/6 text-right tabular-nums">{item.UnitPrice.toFixed(2)}</span>
                      <span className="w-1/6 text-right tabular-nums font-semibold">
                        {(item.Quantity * item.UnitPrice).toFixed(2)}
                      </span>
                    </div>

                    {(settings.showGenericName || settings.showBatchNo) && (
                      <div className="text-[9px] text-neutral-500 flex flex-wrap gap-1">
                        {settings.showGenericName && <span>[{item.GenericName}]</span>}
                        {settings.showBatchNo && (
                          <span>
                            B:{item.BatchNumber} Exp:{item.ExpiryDate}
                          </span>
                        )}
                        {settings.showRackNo && <span>Rack:{item.RackNo}</span>}
                      </div>
                    )}

                    {item.DiscountAmount > 0 && (
                      <div className="text-[9px] text-neutral-600 flex justify-between italic">
                        <span>Item Discount:</span>
                        <span>-{currency}{item.DiscountAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="py-2 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="tabular-nums">{currency}{sale.TotalAmount.toFixed(2)}</span>
              </div>
              {sale.DiscountAmount > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>Total Discount:</span>
                  <span className="tabular-nums">-{currency}{sale.DiscountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-neutral-300">
                <span>Net Payable:</span>
                <span className="tabular-nums">{currency}{sale.FinalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Paid ({sale.PaymentMethod}):</span>
                <span className="tabular-nums">{currency}{sale.PaidAmount.toFixed(2)}</span>
              </div>
              {sale.DueAmount > 0 && (
                <div className="flex justify-between text-rose-700 font-bold text-[10px]">
                  <span>Outstanding Due:</span>
                  <span className="tabular-nums">{currency}{sale.DueAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Barcode & Footer */}
            <div className="text-center pt-3 space-y-1">
              <div className="flex justify-center py-1">
                <svg
                  width={Math.min(totalWidth, is58mm ? 190 : 260)}
                  height={36}
                  viewBox={`0 0 ${totalWidth} 36`}
                  className="fill-black"
                >
                  <path d={svgPath} />
                </svg>
              </div>
              <p className="text-[9px] tracking-widest">{sale.InvoiceNumber}</p>
              <p className="text-[9px] text-neutral-600 pt-1 leading-snug">
                {settings.footerMessage}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between p-3 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              Press <strong className="text-slate-200">Alt+P</strong> or <strong className="text-slate-200">Enter</strong> to direct print
            </span>
            {printSuccess && (
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Job dispatched!</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isPrinting}
              className="px-3 py-1.5 rounded text-xs text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              disabled={isPrinting}
              title="Direct Print to Thermal Printer (Alt+P or Enter)"
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              <Printer className={`w-3.5 h-3.5 ${isPrinting ? 'animate-spin' : ''}`} />
              <span>{isPrinting ? 'Triggering Printer...' : 'Direct Print (Alt+P)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
