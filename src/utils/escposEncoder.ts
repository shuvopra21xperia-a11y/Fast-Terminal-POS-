/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ESC/POS Binary Command Encoder for Direct Hardware Thermal Printers
 * Supports 80mm (48 columns) & 58mm (32 columns) raw ESC/POS commands
 * for Native Node SerialPort (COM), Win32 RAW USB Spooler, and TCP Port 9100 Rongta printers.
 */

import { Sale, ReceiptSettings } from '../types/pharmacy';

export class EscPosEncoder {
  private buffer: number[] = [];
  private cols: number = 48; // 48 cols for 80mm, 32 cols for 58mm

  constructor(is58mm: boolean = false) {
    this.cols = is58mm ? 32 : 48;
  }

  public initialize(): this {
    // ESC @ (Initialize printer)
    this.buffer.push(0x1b, 0x40);
    return this;
  }

  public alignCenter(): this {
    // ESC a 1
    this.buffer.push(0x1b, 0x61, 0x01);
    return this;
  }

  public alignLeft(): this {
    // ESC a 0
    this.buffer.push(0x1b, 0x61, 0x00);
    return this;
  }

  public alignRight(): this {
    // ESC a 2
    this.buffer.push(0x1b, 0x61, 0x02);
    return this;
  }

  public bold(enabled: boolean = true): this {
    // ESC E n
    this.buffer.push(0x1b, 0x45, enabled ? 0x01 : 0x00);
    return this;
  }

  public textSize(widthMultiplier: number = 1, heightMultiplier: number = 1): this {
    // GS ! n (0x00 = 1x1, 0x11 = 2x2)
    const w = Math.min(Math.max(widthMultiplier - 1, 0), 7);
    const h = Math.min(Math.max(heightMultiplier - 1, 0), 7);
    const n = (w << 4) | h;
    this.buffer.push(0x1d, 0x21, n);
    return this;
  }

  public text(str: string): this {
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      this.buffer.push(code > 127 ? 0x3f : code); // map ascii
    }
    return this;
  }

  public line(str: string = ''): this {
    this.text(str);
    this.buffer.push(0x0a); // LF
    return this;
  }

  public divider(char: string = '-'): this {
    this.line(char.repeat(this.cols));
    return this;
  }

  public twoColumns(left: string, right: string): this {
    const space = this.cols - left.length - right.length;
    if (space <= 0) {
      this.line(left);
      this.line(' '.repeat(Math.max(0, this.cols - right.length)) + right);
    } else {
      this.line(left + ' '.repeat(space) + right);
    }
    return this;
  }

  public fourColumns(c1: string, c2: string, c3: string, c4: string): this {
    // For 80mm (48 col): 24 / 6 / 9 / 9
    // For 58mm (32 col): 16 / 4 / 6 / 6
    const is58 = this.cols === 32;
    const w1 = is58 ? 16 : 24;
    const w2 = is58 ? 4 : 6;
    const w3 = is58 ? 6 : 9;
    const w4 = is58 ? 6 : 9;

    const s1 = c1.padEnd(w1).substring(0, w1);
    const s2 = c2.padStart(w2).substring(0, w2);
    const s3 = c3.padStart(w3).substring(0, w3);
    const s4 = c4.padStart(w4).substring(0, w4);

    this.line(s1 + s2 + s3 + s4);
    return this;
  }

  public barcodeCode128(code: string): this {
    // GS h 50 (height 50)
    this.buffer.push(0x1d, 0x68, 50);
    // GS w 2 (width)
    this.buffer.push(0x1d, 0x77, 0x02);
    // GS H 2 (human readable below barcode)
    this.buffer.push(0x1d, 0x48, 0x02);
    // GS k 73 len bytes (Code 128)
    const clean = code.replace(/[^A-Za-z0-9\-]/g, '');
    this.buffer.push(0x1d, 0x6b, 0x49, clean.length);
    for (let i = 0; i < clean.length; i++) {
      this.buffer.push(clean.charCodeAt(i));
    }
    this.buffer.push(0x0a);
    return this;
  }

  public feedLines(count: number = 3): this {
    // ESC d n
    this.buffer.push(0x1b, 0x64, count);
    return this;
  }

  public cutPaper(): this {
    // GS V 0 (Full Cut)
    this.buffer.push(0x1d, 0x56, 0x00);
    return this;
  }

  public kickDrawer(): this {
    // ESC p 0 25 250 (pulse cash drawer pin 2)
    this.buffer.push(0x1b, 0x70, 0x00, 25, 250);
    return this;
  }

  public getBytes(): Uint8Array {
    return new Uint8Array(this.buffer);
  }
}

/**
 * Builds raw ESC/POS binary byte stream for a sale transaction
 */
export function buildSaleEscPosBytes(sale: Sale, settings: ReceiptSettings): Uint8Array {
  const is58mm = settings.printerWidth === '58mm';
  const encoder = new EscPosEncoder(is58mm);
  const currency = settings.currencySymbol || '$';

  encoder.initialize();

  // Kick cash drawer if enabled
  if (settings.openCashDrawer) {
    encoder.kickDrawer();
  }

  // Header
  encoder.alignCenter();
  encoder.textSize(2, 2);
  encoder.bold(true);
  encoder.line(settings.pharmacyName || 'PHARMACORE PHARMACY');
  encoder.textSize(1, 1);
  encoder.bold(false);
  encoder.line(settings.address || '');
  encoder.line(settings.phone || '');
  if (settings.taxNumber) {
    encoder.line(settings.taxNumber);
  }

  encoder.divider('=');

  // Metadata
  encoder.alignLeft();
  encoder.twoColumns('Invoice #:', sale.InvoiceNumber);
  encoder.twoColumns('Date:', new Date(sale.SaleDate).toLocaleString());
  encoder.twoColumns('Dispenser:', sale.SalesmanName || 'POS Staff');
  encoder.twoColumns('Customer:', sale.CustomerName || 'Walk-in');
  if (sale.CustomerPhone && sale.CustomerPhone !== 'N/A') {
    encoder.twoColumns('Phone:', sale.CustomerPhone);
  }

  encoder.divider('-');

  // Items table header
  encoder.bold(true);
  encoder.fourColumns('ITEM', 'QTY', 'RATE', 'TOTAL');
  encoder.bold(false);
  encoder.divider('-');

  // Line items
  (sale.Items || []).forEach((item) => {
    const total = (item.Quantity * item.UnitPrice).toFixed(2);
    encoder.fourColumns(
      item.TradeName,
      String(item.Quantity),
      item.UnitPrice.toFixed(2),
      total
    );

    if (settings.showGenericName && item.GenericName) {
      encoder.line(` [${item.GenericName}]`);
    }
    if (settings.showBatchNo && (item.BatchNumber || item.ExpiryDate)) {
      encoder.line(` B:${item.BatchNumber || ''} Exp:${item.ExpiryDate || ''}`);
    }
  });

  encoder.divider('-');

  // Financial totals
  encoder.twoColumns('Subtotal:', `${currency}${sale.TotalAmount.toFixed(2)}`);
  if (sale.DiscountAmount > 0) {
    encoder.twoColumns('Discount:', `-${currency}${sale.DiscountAmount.toFixed(2)}`);
  }
  encoder.bold(true);
  encoder.textSize(1, 2);
  encoder.twoColumns('NET PAYABLE:', `${currency}${sale.FinalAmount.toFixed(2)}`);
  encoder.textSize(1, 1);
  encoder.bold(false);
  encoder.twoColumns(`Paid (${sale.PaymentMethod}):`, `${currency}${sale.PaidAmount.toFixed(2)}`);
  if (sale.DueAmount > 0) {
    encoder.bold(true);
    encoder.twoColumns('Outstanding Due:', `${currency}${sale.DueAmount.toFixed(2)}`);
    encoder.bold(false);
  }
  if (sale.PaidAmount > sale.FinalAmount) {
    encoder.twoColumns('Change Returned:', `${currency}${(sale.PaidAmount - sale.FinalAmount).toFixed(2)}`);
  }

  encoder.divider('=');

  // Barcode & Footer
  encoder.alignCenter();
  encoder.line(sale.InvoiceNumber);
  encoder.feedLines(1);
  encoder.line(settings.footerMessage || 'Thank you for choosing PharmaCore Pharmacy.');

  encoder.feedLines(4);

  // Cut paper if enabled
  if (settings.cutPaper) {
    encoder.cutPaper();
  }

  return encoder.getBytes();
}

/**
 * Builds raw ESC/POS binary byte stream for diagnostic test print
 */
export function buildTestEscPosBytes(settings: ReceiptSettings): Uint8Array {
  const is58mm = settings.printerWidth === '58mm';
  const encoder = new EscPosEncoder(is58mm);

  encoder.initialize();
  if (settings.openCashDrawer) {
    encoder.kickDrawer();
  }

  encoder.alignCenter();
  encoder.textSize(2, 2);
  encoder.bold(true);
  encoder.line('*** POS TEST SLIP ***');
  encoder.textSize(1, 1);
  encoder.bold(false);
  encoder.line(settings.pharmacyName || 'PHARMACORE PHARMACY');
  encoder.divider('=');

  encoder.alignLeft();
  encoder.twoColumns('Printer:', settings.printerDevice || 'Default Thermal');
  encoder.twoColumns('Paper Width:', settings.printerWidth);
  encoder.twoColumns('Print Mode:', settings.printMode || 'direct');
  encoder.twoColumns('Time:', new Date().toLocaleTimeString());
  encoder.divider('-');
  encoder.alignCenter();
  encoder.line('ESC/POS Direct Hardware Protocol OK!');
  encoder.line('Thermal Head Alignment Verified.');

  encoder.feedLines(4);
  if (settings.cutPaper) {
    encoder.cutPaper();
  }

  return encoder.getBytes();
}
