/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Native Desktop Thermal Printer Manager (Rongta / POS-80 / POS-58)
 * Zero Browser WebUSB or WebSerial dependencies — eliminates all browser permission policy errors.
 *
 * Native Hardware Channels:
 * 1. Electron Native Silent Spooler (`window.electronPOS.printReceiptHtml` — zero-dialog graphic & barcode spooling)
 * 2. Native Win32 RAW USB Spooler (`/api/printer/raw-spooler-print` via `winspool.Drv` RAW ESC/POS + cutter/drawer kick)
 * 3. Native Node SerialPort (`/api/printer/serial-print` via `node-serialport` COM1/COM3/ttyUSB0 ESC/POS streaming)
 * 4. Native Direct TCP Socket (`/api/printer/network-print` via Node `net.Socket` on Port 9100)
 * 5. Theme-Isolated In-Window Receipt Frame fallback (when previewing without physical printer attached)
 */

import { Sale, ReceiptSettings, PrinterTransportMode } from '../types/pharmacy';
import { buildSaleEscPosBytes, buildTestEscPosBytes } from './escposEncoder';
import { generateThermalReceiptHtml, generateTestReceiptHtml } from './thermalPrinter';

export interface SystemPrinterInfo {
  name: string;
  driverName?: string;
  isDefault?: boolean;
  portName?: string;
  status?: string;
  isThermalCandidate?: boolean;
}

export interface NativeSerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
  friendlyName?: string;
}

declare global {
  interface Window {
    electronPOS?: {
      isElectron: boolean;
      platform?: string;
      minimizeWindow?: () => Promise<boolean>;
      toggleMaximizeWindow?: () => Promise<{ isMaximized: boolean }>;
      isWindowMaximized?: () => Promise<boolean>;
      closeWindow?: () => Promise<boolean>;
      onMaximizedChange?: (callback: (isMaximized: boolean) => void) => () => void;
      getPrinters: () => Promise<SystemPrinterInfo[]>;
      printReceiptHtml: (payload: {
        html: string;
        deviceName?: string;
        widthMm?: number;
        copies?: number;
        silent?: boolean;
      }) => Promise<{ success: boolean; deviceName?: string; error?: string }>;
    };
  }
}

export interface PrinterHardwareStatus {
  isElectron: boolean;
  platform: string;
  detectedPrintersCount: number;
  detectedSerialPortsCount: number;
  preferredRongtaPrinter: string | null;
}

let cachedPrinters: SystemPrinterInfo[] = [];
let cachedSerialPorts: NativeSerialPortInfo[] = [];
const statusListeners = new Set<(status: PrinterHardwareStatus) => void>();

function notifyStatusListeners() {
  const snapshot = getHardwarePrinterStatus();
  statusListeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      // ignore
    }
  });
}

export function getHardwarePrinterStatus(): PrinterHardwareStatus {
  const isBrowser = typeof window !== 'undefined';
  const isElectron = isBrowser && Boolean(window.electronPOS?.isElectron);
  const rongtaMatch = cachedPrinters.find((p) =>
    /rongta|rp80|rp58|rp326|pos-80|pos80|thermal/i.test(`${p.name} ${p.portName || ''}`)
  );

  return {
    isElectron,
    platform: (isBrowser && window.electronPOS?.platform) || 'desktop',
    detectedPrintersCount: cachedPrinters.length,
    detectedSerialPortsCount: cachedSerialPorts.length,
    preferredRongtaPrinter: rongtaMatch ? rongtaMatch.name : cachedPrinters[0]?.name || null,
  };
}

export function subscribeHardwarePrinterStatus(
  listener: (status: PrinterHardwareStatus) => void
): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function uint8ToBase64(data: Uint8Array): string {
  let binary = '';
  const len = data.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(data[i]);
  }
  return btoa(binary);
}

/**
 * Enumerates installed OS / Windows Spooler printers (via Electron IPC or Node backend)
 */
export async function fetchAvailableSystemPrinters(): Promise<SystemPrinterInfo[]> {
  try {
    if (typeof window !== 'undefined' && window.electronPOS?.getPrinters) {
      const list = await window.electronPOS.getPrinters();
      if (Array.isArray(list) && list.length > 0) {
        cachedPrinters = list;
        notifyStatusListeners();
        return list;
      }
    }
  } catch {
    // Fall through to Node backend API
  }

  try {
    const res = await fetch('/api/printer/system-printers');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.printers)) {
        cachedPrinters = data.printers;
        notifyStatusListeners();
        return data.printers;
      }
    }
  } catch {
    // Ignore when offline
  }

  return cachedPrinters;
}

/**
 * Enumerates physical COM / Serial ports via Node `serialport` backend (zero browser WebSerial)
 */
export async function fetchNativeSerialPorts(): Promise<NativeSerialPortInfo[]> {
  try {
    const res = await fetch('/api/printer/serial-ports');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.ports)) {
        cachedSerialPorts = data.ports;
        notifyStatusListeners();
        return data.ports;
      }
    }
  } catch {
    // Ignore when offline
  }
  return cachedSerialPorts;
}

/**
 * Verifies native Node SerialPort COM connection (`ESC @` non-printing handshake)
 */
export async function testNativeSerialPort(
  portPath: string,
  baudRate: number = 9600
): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanPort = (portPath || '').trim();
  if (!cleanPort) {
    return { success: false, error: 'Select or enter a COM port (e.g. COM3).' };
  }

  try {
    const res = await fetch('/api/printer/serial-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portPath: cleanPort, baudRate: baudRate || 9600 }),
    });
    const data = await res.json();
    if (data?.success) {
      return { success: true, message: data.message || `Connected to ${cleanPort}` };
    }
    return { success: false, error: data?.error || `Unable to open ${cleanPort}` };
  } catch (err: any) {
    return { success: false, error: err?.message || `Failed to verify ${cleanPort}` };
  }
}

/**
 * Streams raw ESC/POS bytes to a Rongta Serial/COM printer via Node `serialport`
 */
export async function sendToNativeSerialPrinter(
  portPath: string,
  baudRate: number,
  data: Uint8Array
): Promise<boolean> {
  const cleanPort = (portPath || '').trim();
  if (!cleanPort) return false;

  try {
    const res = await fetch('/api/printer/serial-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        portPath: cleanPort,
        baudRate: baudRate || 9600,
        data: uint8ToBase64(data),
      }),
    });
    const result = await res.json();
    return result?.success === true;
  } catch (err) {
    console.warn('Native serial print failed:', err);
    return false;
  }
}

/**
 * Sends raw binary ESC/POS bytes (including Rongta cutter & drawer kick) directly to
 * Windows USB001 / OS print queue via native Win32 `winspool.Drv` WritePrinter
 */
export async function sendToNativeRawSpooler(
  printerName: string | undefined,
  data: Uint8Array
): Promise<boolean> {
  try {
    const res = await fetch('/api/printer/raw-spooler-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        printerName: (printerName || '').trim(),
        data: uint8ToBase64(data),
      }),
    });
    if (!res.ok) return false;
    const result = await res.json();
    return result?.success === true;
  } catch {
    return false;
  }
}

/**
 * Tests TCP Port 9100 reachability for a Network IP ESC/POS Printer via Node `net.Socket`
 */
export async function testNetworkPrinterConnection(
  ipWithOptionalPort: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const trimmed = (ipWithOptionalPort || '').trim();
  if (!trimmed || !trimmed.includes('.')) {
    return { success: false, error: 'Enter a valid printer IP (e.g. 192.168.0.200:9100).' };
  }

  const [ip, portStr] = trimmed.split(':');
  const port = parseInt(portStr || '9100', 10) || 9100;

  try {
    const res = await fetch('/api/printer/test-network', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip: ip.trim(), port }),
    });
    const data = await res.json();
    if (data?.success) {
      return { success: true, message: data.message || `Connected to ${ip}:${port}` };
    }
    return { success: false, error: data?.error || `Cannot reach ${ip}:${port}` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network printer check failed' };
  }
}

/**
 * Dispatches raw ESC/POS bytes over TCP socket to network thermal printer (Port 9100)
 */
export async function sendToNetworkPrinter(
  ip: string,
  port: number,
  data: Uint8Array
): Promise<boolean> {
  try {
    const res = await fetch('/api/printer/network-print', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port, data: uint8ToBase64(data) }),
    });
    const result = await res.json();
    return result?.success === true;
  } catch (err) {
    console.warn('Network print request failed:', err);
    return false;
  }
}

/**
 * THEME-ISOLATED IN-WINDOW PRINT ENGINE (Fallback when running without Electron/OS Spooler):
 * Renders 80mm/58mm receipt inside an isolated hidden frame without opening any external browser window.
 */
export function executeIsolatedFramePrint(htmlContent: string, onComplete?: () => void): boolean {
  try {
    const FRAME_ID = 'pharmacore-thermal-print-frame';
    let frame = document.getElementById(FRAME_ID) as HTMLIFrameElement | null;

    if (!frame) {
      frame = document.createElement('iframe');
      frame.id = FRAME_ID;
      frame.name = FRAME_ID;
      frame.setAttribute('aria-hidden', 'true');
      frame.style.position = 'fixed';
      frame.style.right = '0';
      frame.style.bottom = '0';
      frame.style.width = '320px';
      frame.style.height = '1px';
      frame.style.border = '0';
      frame.style.opacity = '0';
      frame.style.pointerEvents = 'none';
      frame.style.zIndex = '-9999';
      document.body.appendChild(frame);
    }

    const frameWin = frame.contentWindow;
    const frameDoc = frame.contentDocument || frameWin?.document;
    if (!frameDoc || !frameWin) {
      return executeDirectDomPrint(htmlContent, onComplete);
    }

    const cleanHtml = htmlContent.replace(/<script[\s\S]*?<\/script>/gi, '');
    frameDoc.open();
    frameDoc.write(cleanHtml);
    frameDoc.close();

    let completed = false;
    const finishOnce = () => {
      if (completed) return;
      completed = true;
      onComplete?.();
    };

    setTimeout(() => {
      try {
        frameWin.addEventListener('afterprint', finishOnce, { once: true });
        frameWin.focus();
        frameWin.print();
        setTimeout(finishOnce, 600);
      } catch (err) {
        console.warn('Isolated frame print fallback to DOM print:', err);
        executeDirectDomPrint(cleanHtml, finishOnce);
      }
    }, 150);

    return true;
  } catch (err) {
    console.error('Isolated frame print failed:', err);
    return executeDirectDomPrint(htmlContent, onComplete);
  }
}

export function executeDirectDomPrint(htmlContent: string, onComplete?: () => void): boolean {
  try {
    const CONTAINER_ID = 'pos-direct-print-container';
    let container = document.getElementById(CONTAINER_ID);

    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      document.body.appendChild(container);
    }

    const cleanHtml = htmlContent.replace(/<script[\s\S]*?<\/script>/gi, '');
    container.innerHTML = cleanHtml;
    document.body.classList.add('is-thermal-printing');

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove('is-thermal-printing');
      if (container) {
        container.innerHTML = '';
      }
      window.removeEventListener('afterprint', cleanup);
      onComplete?.();
    };

    window.addEventListener('afterprint', cleanup);
    window.focus();
    window.print();
    setTimeout(cleanup, 30000);
    return true;
  } catch (err) {
    console.error('Direct DOM print failed:', err);
    return false;
  }
}

/**
 * In-window / Electron silent print helper (no external browser popups)
 */
export function executePopupWindowPrint(htmlContent: string, onComplete?: () => void): boolean {
  if (typeof window !== 'undefined' && window.electronPOS?.printReceiptHtml) {
    window.electronPOS
      .printReceiptHtml({ html: htmlContent, silent: true })
      .then((res) => {
        if (res?.success) {
          onComplete?.();
        } else {
          executeIsolatedFramePrint(htmlContent, onComplete);
        }
      })
      .catch(() => {
        executeIsolatedFramePrint(htmlContent, onComplete);
      });
    return true;
  }
  return executeIsolatedFramePrint(htmlContent, onComplete);
}

async function dispatchByTransport(
  escposData: Uint8Array,
  html: string,
  settings: ReceiptSettings,
  copies: number,
  onComplete?: () => void
): Promise<{
  channel: 'electron' | 'raw-usb' | 'serial' | 'network' | 'dom';
  success: boolean;
}> {
  const mode: PrinterTransportMode = settings.printerTransport || 'auto';

  // 1. Explicit Native Serial / COM Port (node-serialport)
  if (mode === 'serial' || (mode === 'auto' && settings.serialPortPath?.trim())) {
    const portPath = (settings.serialPortPath || '').trim();
    if (portPath) {
      let ok = true;
      for (let i = 0; i < copies; i++) {
        ok = (await sendToNativeSerialPrinter(portPath, settings.serialBaudRate || 9600, escposData)) && ok;
      }
      if (ok) {
        onComplete?.();
        return { channel: 'serial', success: true };
      }
      if (mode === 'serial') {
        return { channel: 'serial', success: false };
      }
    }
  }

  // 2. Explicit Direct TCP Socket (Port 9100)
  if (mode === 'network' || (mode === 'auto' && settings.networkPrinterIp && settings.networkPrinterIp.includes('.'))) {
    const rawIp = (settings.networkPrinterIp || '').trim();
    if (rawIp.includes('.')) {
      const [ip, portStr] = rawIp.split(':');
      const port = parseInt(portStr || '9100', 10) || 9100;
      let ok = true;
      for (let i = 0; i < copies; i++) {
        ok = (await sendToNetworkPrinter(ip.trim(), port, escposData)) && ok;
      }
      if (ok) {
        onComplete?.();
        return { channel: 'network', success: true };
      }
      if (mode === 'network') {
        return { channel: 'network', success: false };
      }
    }
  }

  // 3. Explicit Win32 RAW USB Spooler (winspool.Drv WritePrinter RAW ESC/POS)
  if (mode === 'raw-usb') {
    let ok = true;
    for (let i = 0; i < copies; i++) {
      ok = (await sendToNativeRawSpooler(settings.printerDevice, escposData)) && ok;
    }
    if (ok) {
      onComplete?.();
      return { channel: 'raw-usb', success: true };
    }
  }

  // 4. Electron Standalone Desktop Silent Spooler (Zero-Dialog Graphic + Barcode Print to Rongta)
  if (typeof window !== 'undefined' && window.electronPOS?.printReceiptHtml) {
    try {
      const res = await window.electronPOS.printReceiptHtml({
        html,
        deviceName: settings.printerDevice,
        widthMm: settings.printerWidth === '58mm' ? 58 : 80,
        copies,
        silent: true,
      });
      if (res?.success) {
        onComplete?.();
        return { channel: 'electron', success: true };
      }
    } catch (err) {
      console.warn('Electron silent print fallback to Win32 RAW spooler:', err);
    }
  }

  // 5. Try Native Win32/CUPS RAW Spooler silently before falling back to frame print
  const rawOk = await sendToNativeRawSpooler(settings.printerDevice, escposData);
  if (rawOk) {
    onComplete?.();
    return { channel: 'raw-usb', success: true };
  }

  // 6. Theme-Isolated In-Window Print Frame fallback (for cloud preview / non-spooler testing)
  const frameOk = executeIsolatedFramePrint(html, onComplete);
  return { channel: 'dom', success: frameOk };
}

export async function dispatchUniversalThermalPrint(
  sale: Sale,
  settings: ReceiptSettings,
  onComplete?: () => void
) {
  const copies = Math.max(1, Math.min(3, settings.copies || 1));
  const escposData = buildSaleEscPosBytes(sale, settings);
  const html = generateThermalReceiptHtml(sale, settings);
  return dispatchByTransport(escposData, html, settings, copies, onComplete);
}

export async function dispatchUniversalTestPrint(
  settings: ReceiptSettings,
  onComplete?: () => void
) {
  const escposData = buildTestEscPosBytes(settings);
  const html = generateTestReceiptHtml(settings);
  return dispatchByTransport(escposData, html, settings, 1, onComplete);
}
