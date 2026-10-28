/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PharmaCore POS Thermal Receipt Direct Print Engine
 * Supports 80mm & 58mm ESC/POS layout with direct silent iframe printing,
 * eliminating manual print preview dialogs and full-screen browser distortion.
 */

import { Sale, ReceiptSettings } from '../types/pharmacy';
import { generateBarcodeSvg } from './barcodeGenerator';

/**
 * Generates an isolated, self-contained HTML document formatted strictly for
 * 80mm (72mm printable, 576 dots) or 58mm (48mm printable, 384 dots) thermal receipt printers.
 */
export function generateThermalReceiptHtml(sale: Sale, settings: ReceiptSettings): string {
  const is58mm = settings.printerWidth === '58mm';
  const paperWidthMm = is58mm ? 58 : 80;
  const contentWidthMm = is58mm ? 50 : 72;
  const currency = settings.currencySymbol || '$';
  const { svgPath, totalWidth } = generateBarcodeSvg(sale.InvoiceNumber, 32, is58mm ? 1.2 : 1.4);
  const barcodeRenderWidth = Math.min(totalWidth, is58mm ? 170 : 250);

  const saleDateFormatted = new Date(sale.SaleDate).toLocaleString();

  const itemsHtml = (sale.Items || [])
    .map((item) => {
      const lineTotal = item.Quantity * item.UnitPrice;
      const unitLabel = item.DispenseUnit === 'Piece' ? 'pcs' : item.DispenseUnit === 'Box' ? 'box' : '';
      const genericLine = settings.showGenericName && item.GenericName ? `<div class="sub-meta">[${escapeHtml(item.GenericName)}]</div>` : '';
      const batchLine = settings.showBatchNo && (item.BatchNumber || item.ExpiryDate)
        ? `<div class="sub-meta">B:${escapeHtml(item.BatchNumber || '')} Exp:${escapeHtml(item.ExpiryDate || '')}${settings.showRackNo && item.RackNo ? ' | Rack:' + escapeHtml(item.RackNo) : ''}</div>`
        : '';
      const discountLine = item.DiscountAmount && item.DiscountAmount > 0
        ? `<div class="sub-meta discount-text">Item Disc: -${currency}${item.DiscountAmount.toFixed(2)}</div>`
        : '';

      return `
        <div class="item-row">
          <div class="item-header">
            <span class="item-name">${escapeHtml(item.TradeName)}</span>
            <span class="item-qty">${item.Quantity} ${unitLabel}</span>
            <span class="item-rate">${item.UnitPrice.toFixed(2)}</span>
            <span class="item-total">${lineTotal.toFixed(2)}</span>
          </div>
          ${genericLine}
          ${batchLine}
          ${discountLine}
        </div>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt #${escapeHtml(sale.InvoiceNumber)}</title>
  <style>
    @page {
      size: auto;
      margin: 0mm !important;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      html, body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .receipt-container {
        width: ${contentWidthMm}mm !important;
        max-width: ${contentWidthMm}mm !important;
        margin: 0 auto !important;
        padding: 2mm 0 6mm 0 !important;
        box-shadow: none !important;
        background: #ffffff !important;
      }
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #0f172a;
      color: #000000;
      font-family: 'Courier New', Courier, 'Lucida Console', Monaco, monospace;
      font-size: ${is58mm ? '10px' : '11px'};
      line-height: 1.25;
      font-weight: 500;
    }
    .receipt-container {
      width: ${contentWidthMm}mm;
      max-width: ${contentWidthMm}mm;
      margin: 16px auto;
      padding: 4mm 2mm 8mm 2mm;
      background: #ffffff;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .uppercase { text-transform: uppercase; }
    
    .dashed-divider {
      border-top: 1px dashed #000000;
      margin: 4px 0;
    }
    .solid-divider {
      border-top: 1px solid #000000;
      margin: 4px 0;
    }
    
    /* Header section */
    .pharmacy-title {
      font-size: ${is58mm ? '13px' : '15px'};
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.2px;
      margin-bottom: 2px;
    }
    .header-sub {
      font-size: ${is58mm ? '9px' : '10px'};
      line-height: 1.2;
    }
    
    /* Meta section */
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: ${is58mm ? '9.5px' : '10.5px'};
      line-height: 1.3;
    }
    
    /* Items table */
    .items-table-header {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      font-size: ${is58mm ? '9.5px' : '10px'};
      padding-bottom: 2px;
    }
    .col-desc { width: ${is58mm ? '48%' : '52%'}; text-align: left; }
    .col-qty { width: 14%; text-align: center; }
    .col-rate { width: 17%; text-align: right; }
    .col-total { width: 17%; text-align: right; }
    
    .item-row {
      margin-top: 4px;
      margin-bottom: 4px;
    }
    .item-header {
      display: flex;
      justify-content: space-between;
      font-size: ${is58mm ? '9.5px' : '10.5px'};
    }
    .item-name { width: ${is58mm ? '48%' : '52%'}; font-weight: 700; word-break: break-word; }
    .item-qty { width: 14%; text-align: center; }
    .item-rate { width: 17%; text-align: right; }
    .item-total { width: 17%; text-align: right; font-weight: 700; }
    
    .sub-meta {
      font-size: ${is58mm ? '8.5px' : '9px'};
      color: #333333;
      padding-left: 2px;
      line-height: 1.15;
    }
    .discount-text {
      font-style: italic;
    }
    
    /* Totals section */
    .totals-row {
      display: flex;
      justify-content: space-between;
      font-size: ${is58mm ? '10px' : '11px'};
      line-height: 1.35;
    }
    .grand-total {
      font-size: ${is58mm ? '12px' : '13px'};
      font-weight: 800;
      padding-top: 2px;
      padding-bottom: 2px;
    }
    .due-amount {
      font-weight: 700;
    }
    
    /* Barcode & Footer */
    .barcode-wrapper {
      margin: 6px auto 2px auto;
      text-align: center;
    }
    .invoice-id {
      letter-spacing: 1.5px;
      font-size: 9px;
      font-weight: bold;
      margin-top: 2px;
    }
    .footer-terms {
      font-size: ${is58mm ? '8.5px' : '9px'};
      line-height: 1.25;
      margin-top: 4px;
      text-align: center;
    }
    .cut-spacing {
      height: 15mm;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- Header -->
    <div class="text-center">
      <div class="pharmacy-title uppercase">${escapeHtml(settings.pharmacyName || 'PHARMACORE PHARMACY')}</div>
      <div class="header-sub">${escapeHtml(settings.address || '')}</div>
      <div class="header-sub">${escapeHtml(settings.phone || '')}</div>
      ${settings.taxNumber ? `<div class="header-sub bold">${escapeHtml(settings.taxNumber)}</div>` : ''}
    </div>

    <div class="dashed-divider"></div>

    <!-- Metadata -->
    <div class="meta-section">
      <div class="meta-row">
        <span>Invoice #:</span>
        <span class="bold">${escapeHtml(sale.InvoiceNumber)}</span>
      </div>
      <div class="meta-row">
        <span>Date:</span>
        <span>${escapeHtml(saleDateFormatted)}</span>
      </div>
      <div class="meta-row">
        <span>Dispenser:</span>
        <span>${escapeHtml(sale.SalesmanName || 'Salesman')}</span>
      </div>
      <div class="meta-row">
        <span>Customer:</span>
        <span class="bold">${escapeHtml(sale.CustomerName || 'Walk-in Customer')}</span>
      </div>
      ${sale.CustomerPhone && sale.CustomerPhone !== 'N/A' ? `
        <div class="meta-row">
          <span>Phone:</span>
          <span>${escapeHtml(sale.CustomerPhone)}</span>
        </div>
      ` : ''}
    </div>

    <div class="dashed-divider"></div>

    <!-- Items Table Header -->
    <div class="items-table-header">
      <span class="col-desc">ITEM</span>
      <span class="col-qty">QTY</span>
      <span class="col-rate">RATE</span>
      <span class="col-total">TOTAL</span>
    </div>
    <div class="solid-divider"></div>

    <!-- Items List -->
    <div class="items-list">
      ${itemsHtml}
    </div>

    <div class="dashed-divider"></div>

    <!-- Financial Totals -->
    <div class="totals-section">
      <div class="totals-row">
        <span>Subtotal:</span>
        <span>${currency}${sale.TotalAmount.toFixed(2)}</span>
      </div>
      ${sale.DiscountAmount > 0 ? `
        <div class="totals-row">
          <span>Discount:</span>
          <span>-${currency}${sale.DiscountAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      <div class="solid-divider"></div>
      <div class="totals-row grand-total">
        <span>NET PAYABLE:</span>
        <span>${currency}${sale.FinalAmount.toFixed(2)}</span>
      </div>
      <div class="solid-divider"></div>
      <div class="totals-row">
        <span>Paid (${escapeHtml(sale.PaymentMethod || 'Cash')}):</span>
        <span>${currency}${sale.PaidAmount.toFixed(2)}</span>
      </div>
      ${sale.DueAmount > 0 ? `
        <div class="totals-row due-amount">
          <span>Outstanding Due:</span>
          <span>${currency}${sale.DueAmount.toFixed(2)}</span>
        </div>
      ` : ''}
      ${(sale.PaidAmount - sale.FinalAmount > 0) ? `
        <div class="totals-row">
          <span>Change Returned:</span>
          <span>${currency}${(sale.PaidAmount - sale.FinalAmount).toFixed(2)}</span>
        </div>
      ` : ''}
    </div>

    <div class="dashed-divider"></div>

    <!-- Barcode & Verification -->
    <div class="barcode-wrapper">
      <svg width="${barcodeRenderWidth}" height="32" viewBox="0 0 ${totalWidth} 32" style="display:block;margin:0 auto;fill:#000;">
        <path d="${svgPath}" />
      </svg>
      <div class="invoice-id">${escapeHtml(sale.InvoiceNumber)}</div>
    </div>

    <!-- Footer Notice -->
    <div class="footer-terms">
      ${escapeHtml(settings.footerMessage || 'Thank you for your visit. Keep medicines stored in dry, cool conditions.')}
    </div>

    ${settings.cutPaper ? '<div class="cut-spacing"></div>' : ''}
  </div>
</body>
</html>`;
}

/**
 * Generates a diagnostic test receipt to verify printer connection and alignment
 */
export function generateTestReceiptHtml(settings: ReceiptSettings): string {
  const is58mm = settings.printerWidth === '58mm';
  const paperWidthMm = is58mm ? 58 : 80;
  const contentWidthMm = is58mm ? 50 : 72;
  const currency = settings.currencySymbol || '$';
  const { svgPath, totalWidth } = generateBarcodeSvg('TEST-PRINT-80MM', 30, is58mm ? 1.1 : 1.3);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Printer Diagnostic Test</title>
  <style>
    @page { 
      size: auto; 
      margin: 0mm !important; 
    }
    @media print {
      .no-print {
        display: none !important;
      }
      html, body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .container {
        width: ${contentWidthMm}mm !important;
        max-width: ${contentWidthMm}mm !important;
        margin: 0 auto !important;
        padding: 2mm 0 6mm 0 !important;
        box-shadow: none !important;
        background: #fff !important;
      }
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #0f172a;
      color: #000;
      font-family: 'Courier New', monospace;
      font-size: ${is58mm ? '10px' : '11px'};
    }
    .container {
      width: ${contentWidthMm}mm;
      max-width: ${contentWidthMm}mm;
      margin: 16px auto;
      padding: 4mm 2mm;
      text-align: center;
      background: #ffffff;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .divider { border-top: 1px dashed #000; margin: 4px 0; }
    .bold { font-weight: bold; }
    .ruler { letter-spacing: 1px; font-size: 9px; }
  </style>
</head>
<body>
  <div class="no-print" style="position: sticky; top: 0; background: #0f172a; color: #fff; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #10b981; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; z-index: 99999; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
    <div style="display:flex; align-items:center; gap: 8px;">
      <span style="display:inline-block; width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></span>
      <strong>Diagnostic Test Slip (${settings.printerWidth})</strong>
    </div>
    <div style="display: flex; gap: 10px;">
      <button onclick="window.focus(); window.print();" style="background: #10b981; color: white; border: none; padding: 6px 16px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">
        🖨️ Send to Printer (Ctrl+P)
      </button>
      <button onclick="window.close()" style="background: #334155; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">
        Close
      </button>
    </div>
  </div>

  <div class="container">
    <div class="bold" style="font-size: 13px;">*** THERMAL PRINTER TEST ***</div>
    <div>${escapeHtml(settings.pharmacyName || 'PHARMACORE POS')}</div>
    <div class="divider"></div>
    <div style="text-align:left; font-size: 10px;">
      <div>Printer Target: <strong>${escapeHtml(settings.printerDevice || 'Default POS Thermal')}</strong></div>
      <div>Roll Width: <strong>${settings.printerWidth}</strong></div>
      <div>Print Mode: <strong>${settings.printMode || 'direct'} (Direct Silent)</strong></div>
      <div>Currency: <strong>${currency} (${settings.currencyCode || 'USD'})</strong></div>
      <div>Auto-Cut Command: <strong>${settings.cutPaper ? 'Enabled (GS V 0)' : 'Disabled'}</strong></div>
      <div>Cash Drawer Kick: <strong>${settings.openCashDrawer ? 'Enabled (ESC p 0)' : 'Disabled'}</strong></div>
      <div>Timestamp: ${new Date().toLocaleString()}</div>
    </div>
    <div class="divider"></div>
    <div class="ruler">|....+....1....+....2....+....3....+....4|</div>
    <div style="margin: 6px 0;">
      <svg width="${Math.min(totalWidth, is58mm ? 160 : 220)}" height="30" viewBox="0 0 ${totalWidth} 30" style="margin:0 auto;display:block;fill:#000;">
        <path d="${svgPath}" />
      </svg>
      <div style="font-size: 9px; letter-spacing: 1px;">TEST-PRINT-80MM</div>
    </div>
    <div class="divider"></div>
    <div style="font-size: 9px;">Thermal Head & Alignment Verified OK!</div>
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.focus();
        window.print();
      }, 300);
    });
    window.addEventListener('afterprint', function() {
      setTimeout(function() {
        try { window.close(); } catch(e) {}
      }, 1000);
    });
  </script>
</body>
</html>`;
}

import { dispatchUniversalThermalPrint, dispatchUniversalTestPrint } from './hardwarePrinterManager';

/**
 * Dispatches direct thermal receipt printing through native desktop hardware channels:
 * 1. Electron Native Silent Spooler (zero-dialog Rongta graphic & barcode print)
 * 2. Native Win32 RAW USB Spooler (`winspool.Drv` RAW ESC/POS + cutter/drawer kick)
 * 3. Native Node SerialPort (`node-serialport` COM port ESC/POS streaming)
 * 4. Direct TCP Socket (Port 9100 ESC/POS raw socket)
 * 5. Theme-isolated in-window print frame fallback
 */
export async function printThermalReceipt(
  sale: Sale,
  settings: ReceiptSettings,
  onComplete?: () => void
): Promise<boolean> {
  try {
    const res = await dispatchUniversalThermalPrint(sale, settings, onComplete);
    return res.success;
  } catch (err) {
    console.error('Failed to dispatch thermal receipt printing:', err);
    window.print();
    onComplete?.();
    return false;
  }
}

/**
 * Dispatches diagnostic test print to physical thermal printer
 */
export async function printTestReceipt(
  settings: ReceiptSettings,
  onComplete?: () => void
): Promise<boolean> {
  try {
    const res = await dispatchUniversalTestPrint(settings, onComplete);
    return res.success;
  } catch (err) {
    console.error('Failed to dispatch test print:', err);
    window.print();
    onComplete?.();
    return false;
  }
}

/**
 * Creates or reuses a hidden iframe to send raw formatted receipt HTML directly to the printer
 */
function triggerIframePrint(htmlContent: string, onComplete?: () => void): boolean {
  const FRAME_ID = 'pharmacore-thermal-print-frame';
  let frame = document.getElementById(FRAME_ID) as HTMLIFrameElement | null;

  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = FRAME_ID;
    frame.name = FRAME_ID;
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = 'none';
    frame.style.opacity = '0';
    frame.style.pointerEvents = 'none';
    frame.style.zIndex = '-9999';
    document.body.appendChild(frame);
  }

  const frameDoc = frame.contentDocument || frame.contentWindow?.document;
  if (!frameDoc) {
    console.warn('Iframe print document unavailable, falling back to window.print');
    window.print();
    onComplete?.();
    return false;
  }

  frameDoc.open();
  frameDoc.write(htmlContent);
  frameDoc.close();

  // Allow brief tick for fonts/SVG render in the isolated document before invoking print
  setTimeout(() => {
    try {
      frame?.contentWindow?.focus();
      frame?.contentWindow?.print();
      onComplete?.();
    } catch (printErr) {
      console.error('Error invoking iframe.contentWindow.print:', printErr);
      window.print();
      onComplete?.();
    }
  }, 120);

  return true;
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
