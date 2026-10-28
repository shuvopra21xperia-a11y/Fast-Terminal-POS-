/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Standalone Windows Desktop Authentication Screen
 * RBAC: Admin (Full Access), Moderator (Sale & Purchase only), Salesman (Sale only)
 * Minimum 4-digit / character password validation
 */

import React, { useState } from 'react';
import { usePharmacy } from '../../context/PharmacyContext';
import {
  Lock,
  User,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  UserCheck,
  ShieldAlert,
  Server,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Minus,
  Square,
  X,
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { login } = usePharmacy();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin2008');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isPasswordMinValid = password.length >= 4;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim()) {
      setErrorMsg('Please enter your assigned username.');
      return;
    }

    if (password.length < 4) {
      setErrorMsg('Password error: Minimum 4 digits / characters required.');
      return;
    }

    setIsLoading(true);

    // Snappy local desktop authentication check (150ms)
    setTimeout(() => {
      const result = login(username, password);
      setIsLoading(false);
      if (!result.success) {
        setErrorMsg(result.error || 'Authentication failed. Please check credentials.');
      }
    }, 150);
  };

  const handleQuickSelect = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg(null);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 font-sans text-slate-100 select-none overflow-hidden">
      {/* Standalone Native Desktop Window Title Bar */}
      <div
        onDoubleClick={() => window.electronPOS?.toggleMaximizeWindow?.()}
        className="app-titlebar flex items-center justify-between px-3 py-1.5 border-b border-slate-800 bg-slate-950 text-slate-400 text-xs shrink-0"
      >
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded bg-emerald-600 flex items-center justify-center font-bold text-[9px] text-white tracking-tighter">
            Rx
          </div>
          <span className="font-semibold text-slate-200">
            PharmaCore Desktop POS · SQL Server (192.168.0.13)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">
            Standalone Desktop Window
          </span>
          <div className="flex items-center gap-1 -mr-1">
            <button
              type="button"
              onClick={() => window.electronPOS?.minimizeWindow?.()}
              title="Minimize Window"
              className="w-7 h-5 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded transition-colors cursor-pointer"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => window.electronPOS?.toggleMaximizeWindow?.()}
              title="Maximize / Restore Window"
              className="w-7 h-5 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded transition-colors cursor-pointer"
            >
              <Square className="w-2.5 h-2.5" />
            </button>
            <button
              type="button"
              onClick={() => window.electronPOS?.closeWindow?.()}
              title="Close Application"
              className="app-titlebar-close w-7 h-5 flex items-center justify-center text-slate-400 hover:bg-rose-600 hover:text-white rounded transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Login Viewport */}
      <div className="flex-1 flex items-center justify-center p-6 bg-radial from-slate-900 to-slate-950">
        <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-xl shadow-2xl p-6 backdrop-blur-md">
          {/* Logo & Header */}
          <div className="text-center pb-5 border-b border-slate-800">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center mb-2 shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              PharmaCore Desktop
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Role-Based Authentication · Enter credentials to proceed
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="pt-5 space-y-4 text-xs">
            {errorMsg && (
              <div className="p-2.5 rounded bg-rose-950/80 border border-rose-800/80 text-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="text-[11px] font-medium leading-tight">{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin, moderator, salesman"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded text-xs text-white placeholder-slate-600 focus:outline-hidden focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">
                  Password (min 4 digits)
                </label>
                <span
                  className={`text-[10px] font-mono ${
                    password.length === 0
                      ? 'text-slate-500'
                      : isPasswordMinValid
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {password.length >= 4
                    ? '✓ 4+ characters'
                    : `${password.length}/4 digits min`}
                </span>
              </div>

              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter minimum 4-digit password..."
                  className={`w-full pl-9 pr-10 py-2 bg-slate-950 border rounded text-xs text-white placeholder-slate-600 focus:outline-hidden font-mono ${
                    password.length > 0 && !isPasswordMinValid
                      ? 'border-amber-600/80 focus:border-amber-500'
                      : 'border-slate-700 focus:border-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isPasswordMinValid}
              className={`w-full py-2.5 rounded font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                !isPasswordMinValid || isLoading
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
              }`}
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick-Fill Demo Credentials & Role Scope Cards */}
          <div className="mt-5 pt-4 border-t border-slate-800 space-y-2 text-xs">
            <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider block">
              Quick Role Switch (Demo Accounts)
            </span>

            <div className="grid grid-cols-1 gap-1.5">
              {/* Admin Card */}
              <button
                type="button"
                onClick={() => handleQuickSelect('admin', 'admin2008')}
                className={`p-2 rounded border text-left flex items-center justify-between transition-colors ${
                  username === 'admin'
                    ? 'bg-indigo-950/50 border-indigo-500 text-indigo-100'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-[11px] leading-tight">Admin Account</div>
                    <div className="text-[10px] text-slate-400 font-mono">admin / admin2008</div>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800/60">
                  Full Access
                </span>
              </button>

              {/* Moderator Card */}
              <button
                type="button"
                onClick={() => handleQuickSelect('moderator', 'mod1234')}
                className={`p-2 rounded border text-left flex items-center justify-between transition-colors ${
                  username === 'moderator'
                    ? 'bg-sky-950/50 border-sky-500 text-sky-100'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-[11px] leading-tight">Moderator Account</div>
                    <div className="text-[10px] text-slate-400 font-mono">moderator / mod1234</div>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-sky-300 bg-sky-950/80 px-1.5 py-0.5 rounded border border-sky-800/60">
                  Sale & Purchase Only
                </span>
              </button>

              {/* Salesman Card */}
              <button
                type="button"
                onClick={() => handleQuickSelect('salesman', 'sale1234')}
                className={`p-2 rounded border text-left flex items-center justify-between transition-colors ${
                  username === 'salesman'
                    ? 'bg-emerald-950/50 border-emerald-500 text-emerald-100'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="font-semibold text-[11px] leading-tight">Salesman Account</div>
                    <div className="text-[10px] text-slate-400 font-mono">salesman / sale1234</div>
                  </div>
                </div>
                <span className="text-[10px] font-medium text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">
                  Sale Interface Only
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
