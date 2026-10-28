/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * POS Thermal Receipt & Native Rongta Hardware Configuration Modal (58mm / 80mm ESC/POS)
 * Zero Browser WebUSB/WebSerial — uses Electron Silent Spooler, Win32 RAW USB, node-serialport, and TCP 9100
 */

import React, { useState, useEffect } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import { ReceiptSettings, PrinterTransportMode } from '../../types/pharmacy';
import { printTestReceipt } from '../../utils/thermalPrinter';
import {
  Printer,
  X,
  Coins,
  Zap,
  Scissors,
  Wallet,
  Usb,
  Cpu,
  Globe,
  RefreshCw,
} from 'lucide-react';
import {
  getHardwarePrinterStatus,
  subscribeHardwarePrinterStatus,
  fetchAvailableSystemPrinters,
  fetchNativeSerialPorts,
  testNativeSerialPort,
  testNetworkPrinterConnection,
  SystemPrinterInfo,
  NativeSerialPortInfo,
} from '../../utils/hardwarePrinterManager';

interface ReceiptSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFullSettings?: () => void;
}

const COMMON_PRINTERS = [
  'RONGTA 80mm Series Printer',
  'Rongta RP80 / RP326 / RP332 Thermal',
  'Rongta RP58 USB Thermal Printer',
  'Default POS Thermal Printer (80mm)',
  'EPSON TM-T88 / TM-T20 Series',
  'Xprinter XP-N160M / XP-80C',
  'POS-80 / POS-58 USB Thermal',
  'Star Micronics TSP100 / TSP650',
];

export const ReceiptSettingsModal: React.FC<ReceiptSettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenFullSettings,
}) => {
  const { receiptSettings, updateReceiptSettings, showToast } = usePharmacy();
  const [formData, setFormData] = useState<ReceiptSettings>({ ...receiptSettings });
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [isTestingNetwork, setIsTestingNetwork] = useState(false);
  const [isTestingSerial, setIsTestingSerial] = useState(false);
  const [isRefreshingPorts, setIsRefreshingPorts] = useState(false);
  const [hardwareStatus, setHardwareStatus] = useState(getHardwarePrinterStatus());
  const [systemPrinters, setSystemPrinters] = useState<SystemPrinterInfo[]>([]);
  const [serialPorts, setSerialPorts] = useState<NativeSerialPortInfo[]>([]);

  useEffect(() => {
    const unsub = subscribeHardwarePrinterStatus((st) => setHardwareStatus(st));
    return unsub;
  }, []);

  const refreshHardwareLists = async () => {
    setIsRefreshingPorts(true);
    try {
      const [printers, ports] = await Promise.all([
        fetchAvailableSystemPrinters(),
        fetchNativeSerialPorts(),
      ]);
      setSystemPrinters(printers);
      setSerialPorts(ports);
    } finally {
      setIsRefreshingPorts(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...receiptSettings });
      setHardwareStatus(getHardwarePrinterStatus());
      refreshHardwareLists();
    }
  }, [isOpen, receiptSettings]);

  if (!isOpen) return null;

  const handleTestSerial = async () => {
    setIsTestingSerial(true);
    const res = await testNativeSerialPort(
      formData.serialPortPath || '',
      formData.serialBaudRate || 9600
    );
    setIsTestingSerial(false);
    if (res.success) {
      const updated = { ...formData, printerTransport: 'serial' as PrinterTransportMode };
      setFormData(updated);
      updateReceiptSettings(updated);
      showToast(res.message || 'Native COM/Serial link verified!', 'success', 'Serial Ready');
    } else {
      showToast(res.error || 'Could not open COM/Serial port.', 'error', 'Serial Port Error');
    }
  };

  const handleTestNetworkIp = async () => {
    setIsTestingNetwork(true);
    const res = await testNetworkPrinterConnection(formData.networkPrinterIp || '');
    setIsTestingNetwork(false);
    if (res.success) {
      const updated = { ...formData, printerTransport: 'network' as PrinterTransportMode };
      setFormData(updated);
      updateReceiptSettings(updated);
      showToast(res.message || 'Network ESC/POS printer reachable!', 'success', 'TCP 9100 Ready');
    } else {
      showToast(res.error || 'Could not reach printer on Port 9100.', 'error', 'Network Unreachable');
    }
  };

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    showToast(
      `Dispatching diagnostic receipt to ${formData.printerDevice || 'Rongta Thermal Printer'}...`,
      'info',
      'Native Test Print'
    );
    const ok = await printTestReceipt(formData, () => {
      setIsTestPrinting(false);
      showToast('Diagnostic test receipt dispatched via native printer bridge!', 'success', 'Printer OK');
    });
    if (!ok) {
      setIsTestPrinting(false);
      showToast('Printer job could not complete. Check selected transport & port.', 'warning', 'Printer Notice');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateReceiptSettings(formData);
    showToast('Rongta thermal printer & receipt settings saved!', 'success', 'Settings Saved');
    onClose();
  };

  const activeTransport: PrinterTransportMode = formData.printerTransport || 'auto';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-xs select-none">
      <div className="bg-slate-950 border border-slate-700 rounded-lg shadow-2xl max-w-lg w-full overflow-hidden text-xs">
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-white text-sm">
              Rongta Thermal Printer &amp; POS Receipt Setup
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {onOpenFullSettings && (
              <button
                type="button"
                onClick={onOpenFullSettings}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-[10px] font-semibold cursor-pointer"
              >
                Full Printer Studio →
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 font-sans max-h-[82vh] overflow-y-auto">
          {/* SALES OPERATION MODE SWITCH: RETAIL (PER PIECE) VS WHOLESALE (BOX) */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-white text-xs block">Sales Operation Mode</span>
                <span className="text-[10px] text-slate-400">
                  Select whether salesmen dispense per loose piece/tablet or whole box
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                  formData.wholesaleMode
                    ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                    : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                }`}
              >
                {formData.wholesaleMode ? 'Wholesale (Box)' : 'Retail (Per Piece)'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, wholesaleMode: false })}
                className={`p-2 rounded text-left border transition-all cursor-pointer ${
                  !formData.wholesaleMode
                    ? 'bg-emerald-600/30 border-emerald-500 text-white ring-1 ring-emerald-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Retail Mode</span>
                  {!formData.wholesaleMode && <span className="text-emerald-400 text-[10px]">Active</span>}
                </div>
                <p className="text-[10px] text-slate-300 mt-1 leading-snug">
                  Sale per <strong>Piece / Tablet</strong> (loose pieces allowed).
                </p>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, wholesaleMode: true })}
                className={`p-2 rounded text-left border transition-all cursor-pointer ${
                  formData.wholesaleMode
                    ? 'bg-amber-600/30 border-amber-500 text-white ring-1 ring-amber-500'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Wholesale Mode</span>
                  {formData.wholesaleMode && <span className="text-amber-400 text-[10px]">Active</span>}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">
                  Sale in <strong>Full Boxes / Packs</strong> only for bulk distribution.
                </p>
              </button>
            </div>
          </div>

          {/* NATIVE RONGTA HARDWARE & DESKTOP PRINT TRANSPORT */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="font-bold text-white text-xs block">
                    Native Rongta Hardware Bridge
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Direct OS / Node.js hardware access — zero browser permissions
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={refreshHardwareLists}
                  disabled={isRefreshingPorts}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded cursor-pointer"
                  title="Rescan installed Rongta printers & COM ports"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPorts ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleTestPrint}
                  disabled={isTestPrinting}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-semibold transition-all disabled:opacity-50 cursor-pointer"
                  title="Send diagnostic test receipt to the Rongta thermal printer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isTestPrinting ? 'Printing...' : 'Test Print'}</span>
                </button>
              </div>
            </div>

            {hardwareStatus.isElectron && (
              <div className="px-2.5 py-1.5 rounded bg-emerald-950/60 border border-emerald-700/60 text-emerald-300 text-[10.5px] flex items-center justify-between">
                <span>Standalone Electron Desktop Bridge Active — Silent Rongta Printing Ready</span>
                <span className="font-mono font-bold">NATIVE</span>
              </div>
            )}

            {/* Transport Channel Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">
                Hardware Transport Channel
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, printerTransport: 'auto' })}
                  className={`p-2 rounded text-left border cursor-pointer ${
                    activeTransport === 'auto' || activeTransport === 'spooler'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-semibold text-[11px] flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Desktop Silent Spooler</span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 mt-0.5">
                    Zero-dialog Rongta USB/Windows driver (supports ৳ &amp; barcodes)
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, printerTransport: 'raw-usb' })}
                  className={`p-2 rounded text-left border cursor-pointer ${
                    activeTransport === 'raw-usb'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-semibold text-[11px] flex items-center gap-1.5">
                    <Usb className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Win32 RAW USB ESC/POS</span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 mt-0.5">
                    Direct USB001 binary ESC/POS + GS V 0 cutter &amp; drawer kick
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, printerTransport: 'serial' })}
                  className={`p-2 rounded text-left border cursor-pointer ${
                    activeTransport === 'serial'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-semibold text-[11px] flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-sky-400" />
                    <span>Native SerialPort (COM)</span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 mt-0.5">
                    Direct node-serialport COM1/COM3 RS-232 ESC/POS stream
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, printerTransport: 'network' })}
                  className={`p-2 rounded text-left border cursor-pointer ${
                    activeTransport === 'network'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-semibold text-[11px] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Direct TCP Socket (9100)</span>
                  </div>
                  <p className="text-[9.5px] text-slate-400 mt-0.5">
                    Node net.Socket LAN Ethernet / Wi-Fi Rongta printer
                  </p>
                </button>
              </div>
            </div>

            {/* Target Printer Queue Selection */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Rongta / OS Printer Queue Name
              </label>
              <div className="space-y-1.5">
                <select
                  value={
                    [...systemPrinters.map((s) => s.name), ...COMMON_PRINTERS].includes(
                      formData.printerDevice || ''
                    )
                      ? formData.printerDevice
                      : 'custom'
                  }
                  onChange={(e) => {
                    if (e.target.value !== 'custom') {
                      setFormData({ ...formData, printerDevice: e.target.value });
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-white focus:outline-hidden focus:border-emerald-500 font-mono"
                >
                  {systemPrinters.length > 0 && (
                    <optgroup label="Detected Local OS Printers">
                      {systemPrinters.map((sp) => (
                        <option key={`sys-${sp.name}`} value={sp.name}>
                          {sp.name} {sp.portName ? `[${sp.portName}]` : ''} {sp.isDefault ? '(Default)' : ''}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Rongta & Standard POS Profiles">
                    {COMMON_PRINTERS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </optgroup>
                  <option value="custom">Custom Printer Name...</option>
                </select>

                <input
                  type="text"
                  value={formData.printerDevice || ''}
                  onChange={(e) => setFormData({ ...formData, printerDevice: e.target.value })}
                  placeholder="e.g. RONGTA 80mm Series Printer, POS-80C"
                  className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-white font-mono focus:outline-hidden focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Native SerialPort (COM) Configuration */}
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[10.5px] font-semibold text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-sky-400" />
                  <span>Native Serial / COM Port (`node-serialport`)</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {serialPorts.length} port{serialPorts.length === 1 ? '' : 's'} detected
                </span>
              </div>

              <div className="grid grid-cols-12 gap-1.5">
                <div className="col-span-6">
                  {serialPorts.length > 0 ? (
                    <select
                      value={formData.serialPortPath || ''}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          serialPortPath: e.target.value,
                          ...(e.target.value ? { printerTransport: 'serial' } : {}),
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-[11px] text-white font-mono"
                    >
                      <option value="">-- Select COM Port --</option>
                      {serialPorts.map((sp) => (
                        <option key={sp.path} value={sp.path}>
                          {sp.path} {sp.friendlyName ? `(${sp.friendlyName})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formData.serialPortPath || ''}
                      onChange={(e) => setFormData({ ...formData, serialPortPath: e.target.value })}
                      placeholder="COM3 or /dev/ttyUSB0"
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-[11px] text-white font-mono"
                    />
                  )}
                </div>

                <div className="col-span-3">
                  <select
                    value={formData.serialBaudRate || 9600}
                    onChange={(e) =>
                      setFormData({ ...formData, serialBaudRate: Number(e.target.value) || 9600 })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-[11px] text-white font-mono"
                    title="Serial Baud Rate"
                  >
                    <option value={9600}>9600 bd</option>
                    <option value={19200}>19200 bd</option>
                    <option value={38400}>38400 bd</option>
                    <option value={115200}>115200 bd</option>
                  </select>
                </div>

                <div className="col-span-3">
                  <button
                    type="button"
                    disabled={isTestingSerial}
                    onClick={handleTestSerial}
                    className="w-full py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10.5px] font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {isTestingSerial ? 'Testing...' : 'Test COM'}
                  </button>
                </div>
              </div>
            </div>

            {/* Direct TCP Socket (Port 9100) */}
            <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1.5">
              <label className="text-[10.5px] font-semibold text-slate-200 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-400" />
                <span>Direct LAN TCP Socket (Rongta Ethernet Port 9100)</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={formData.networkPrinterIp || ''}
                  onChange={(e) => setFormData({ ...formData, networkPrinterIp: e.target.value })}
                  placeholder="Optional LAN IP e.g. 192.168.0.200:9100"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded p-1.5 text-[11px] text-white font-mono focus:outline-hidden focus:border-emerald-500"
                />
                <button
                  type="button"
                  disabled={isTestingNetwork}
                  onClick={handleTestNetworkIp}
                  className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[10.5px] font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
                >
                  {isTestingNetwork ? 'Checking...' : 'Test IP'}
                </button>
              </div>
            </div>

            {/* Paper Width & Workflow */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, printerWidth: '80mm' })}
                className={`py-1.5 rounded text-center border text-xs transition-colors cursor-pointer ${
                  formData.printerWidth === '80mm'
                    ? 'bg-emerald-600/30 border-emerald-500 text-white font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                80mm Roll (Rongta RP80)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, printerWidth: '58mm' })}
                className={`py-1.5 rounded text-center border text-xs transition-colors cursor-pointer ${
                  formData.printerWidth === '58mm'
                    ? 'bg-emerald-600/30 border-emerald-500 text-white font-semibold'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                }`}
              >
                58mm Roll (Rongta RP58)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={formData.autoPrintOnSale ?? false}
                  onChange={(e) => setFormData({ ...formData, autoPrintOnSale: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-emerald-600"
                />
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Auto-Print on Tender</span>
                </span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={formData.cutPaper ?? true}
                  onChange={(e) => setFormData({ ...formData, cutPaper: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-emerald-600"
                />
                <span className="flex items-center gap-1">
                  <Scissors className="w-3 h-3 text-emerald-400" />
                  <span>Auto-Cut Paper (GS V 0)</span>
                </span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={formData.openCashDrawer ?? true}
                  onChange={(e) => setFormData({ ...formData, openCashDrawer: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-emerald-600"
                />
                <span className="flex items-center gap-1">
                  <Wallet className="w-3 h-3 text-emerald-400" />
                  <span>Kick Cash Drawer (ESC p)</span>
                </span>
              </label>

              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>Copies:</span>
                <div className="flex gap-1">
                  {[1, 2].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setFormData({ ...formData, copies: num })}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                        (formData.copies || 1) === num
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {num}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* CURRENCY & HEADER SUMMARY */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>Currency &amp; Pharmacy Receipt Header</span>
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {formData.currencySymbol || '৳'} ({formData.currencyCode || 'BDT'})
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              {[
                { symbol: '৳', code: 'BDT' },
                { symbol: '$', code: 'USD' },
                { symbol: '₹', code: 'INR' },
                { symbol: '€', code: 'EUR' },
              ].map((cur) => (
                <button
                  key={cur.code}
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, currencySymbol: cur.symbol, currencyCode: cur.code })
                  }
                  className={`py-1 px-2 rounded text-center border cursor-pointer ${
                    formData.currencySymbol === cur.symbol
                      ? 'bg-emerald-600/30 border-emerald-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="font-mono text-xs text-emerald-400 font-bold">{cur.symbol}</span>{' '}
                  <span className="text-[10px]">{cur.code}</span>
                </button>
              ))}
            </div>

            <input
              type="text"
              required
              value={formData.pharmacyName}
              onChange={(e) => setFormData({ ...formData, pharmacyName: e.target.value })}
              placeholder="Pharmacy Receipt Header"
              className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-white uppercase font-bold"
            />
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-slate-900 text-slate-400 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm cursor-pointer"
            >
              Save Rongta &amp; Receipt Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
