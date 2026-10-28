/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Central Catalog for Multi-Theme & Classic/Simple Layout Engine
 */

import { LayoutStyleType, ThemeType } from '../types/pharmacy';

export interface ThemeDefinition {
  id: ThemeType;
  name: string;
  shortLabel: string;
  category: 'Light & Paper' | 'Classic & OS' | 'Modern & Neon' | 'Dark';
  description: string;
  isDark: boolean;
  recommendedLayout: LayoutStyleType;
  swatches: {
    titlebar: string;
    titlebarFg: string;
    sidebar: string;
    canvas: string;
    card: string;
    border: string;
    primary: string;
    primaryFg: string;
    radiusPx: number;
  };
}

export interface LayoutStyleDefinition {
  id: LayoutStyleType;
  name: string;
  shortLabel: string;
  description: string;
  highlights: string;
}

export const THEME_CATALOG: ThemeDefinition[] = [
  {
    id: 'light',
    name: 'Light Theme',
    shortLabel: 'Light',
    category: 'Light & Paper',
    description: 'Clean clinical daylight white surfaces with cool slate borders and emerald actions.',
    isDark: false,
    recommendedLayout: 'standard',
    swatches: {
      titlebar: '#f1f5f9',
      titlebarFg: '#0f172a',
      sidebar: '#ffffff',
      canvas: '#f8fafc',
      card: '#ffffff',
      border: '#cbd5e1',
      primary: '#059669',
      primaryFg: '#ffffff',
      radiusPx: 8,
    },
  },
  {
    id: 'classic',
    name: 'Classic Theme',
    shortLabel: 'Classic ERP',
    category: 'Classic & OS',
    description: 'Traditional desktop accounting ERP look with navy title bar, warm battleship gray chrome, and crisp square edges.',
    isDark: false,
    recommendedLayout: 'classic',
    swatches: {
      titlebar: '#0a246a',
      titlebarFg: '#ffffff',
      sidebar: '#dbd8d0',
      canvas: '#ebe8e0',
      card: '#ffffff',
      border: '#9c988e',
      primary: '#004a8f',
      primaryFg: '#ffffff',
      radiusPx: 1,
    },
  },
  {
    id: 'off-white',
    name: 'Off-White Theme',
    shortLabel: 'Off-White',
    category: 'Light & Paper',
    description: 'Warm ivory and parchment paper palette engineered for zero eye strain during long pharmacy shifts.',
    isDark: false,
    recommendedLayout: 'standard',
    swatches: {
      titlebar: '#ede8dc',
      titlebarFg: '#1c1917',
      sidebar: '#f5f1e7',
      canvas: '#faf7f0',
      card: '#fffdf9',
      border: '#d6cfc2',
      primary: '#15803d',
      primaryFg: '#ffffff',
      radiusPx: 6,
    },
  },
  {
    id: 'off-white-gray',
    name: 'Off-White & Gray Theme',
    shortLabel: 'Off-White & Gray',
    category: 'Light & Paper',
    description: 'Balanced two-tone contrast pairing structured architectural gray navigation with warm off-white workspaces.',
    isDark: false,
    recommendedLayout: 'standard',
    swatches: {
      titlebar: '#d8dce2',
      titlebarFg: '#1f2937',
      sidebar: '#e3e6eb',
      canvas: '#f7f6f0',
      card: '#fdfcf8',
      border: '#c2c7d0',
      primary: '#0f766e',
      primaryFg: '#ffffff',
      radiusPx: 6,
    },
  },
  {
    id: 'white-gray',
    name: 'White & Gray Theme',
    shortLabel: 'White & Gray',
    category: 'Light & Paper',
    description: 'Crisp pure white data tables and forms framed by neutral studio gray chrome and corporate blue actions.',
    isDark: false,
    recommendedLayout: 'standard',
    swatches: {
      titlebar: '#e2e5e9',
      titlebarFg: '#111827',
      sidebar: '#eceef1',
      canvas: '#f3f4f6',
      card: '#ffffff',
      border: '#cbd5e1',
      primary: '#1d4ed8',
      primaryFg: '#ffffff',
      radiusPx: 6,
    },
  },
  {
    id: 'windows-10',
    name: 'Windows 10 Theme',
    shortLabel: 'Windows 10',
    category: 'Classic & OS',
    description: 'Fluent Metro desktop frame with #0078D7 accent title bar, Light Mica sidebar, and sharp 1px geometry.',
    isDark: false,
    recommendedLayout: 'classic',
    swatches: {
      titlebar: '#0078d7',
      titlebarFg: '#ffffff',
      sidebar: '#f0f0f0',
      canvas: '#f8f8f8',
      card: '#ffffff',
      border: '#cccccc',
      primary: '#0078d7',
      primaryFg: '#ffffff',
      radiusPx: 1,
    },
  },
  {
    id: 'windows-xp',
    name: 'Windows XP Theme',
    shortLabel: 'Windows XP',
    category: 'Classic & OS',
    description: 'Iconic Luna Royal Blue title bar, warm #ECE9D8 command bar, Explorer task pane, and XP Kelly Green buttons.',
    isDark: false,
    recommendedLayout: 'classic',
    swatches: {
      titlebar: '#0053ee',
      titlebarFg: '#ffffff',
      sidebar: '#dce4f9',
      canvas: '#f4f2e8',
      card: '#ffffff',
      border: '#7f9db9',
      primary: '#2e8b22',
      primaryFg: '#ffffff',
      radiusPx: 4,
    },
  },
  {
    id: 'modern',
    name: 'Modern Theme',
    shortLabel: 'Modern',
    category: 'Modern & Neon',
    description: 'Contemporary studio SaaS workspace with cool alabaster canvas, elevated white cards, and smooth geometry.',
    isDark: false,
    recommendedLayout: 'simple',
    swatches: {
      titlebar: '#ffffff',
      titlebarFg: '#0f172a',
      sidebar: '#ffffff',
      canvas: '#f4f7fb',
      card: '#ffffff',
      border: '#dce3ee',
      primary: '#0d9488',
      primaryFg: '#ffffff',
      radiusPx: 10,
    },
  },
  {
    id: 'white-green-neon',
    name: 'White · Off-White · Light Green · Neon',
    shortLabel: 'Mint & Neon',
    category: 'Modern & Neon',
    description: 'Pure white cards over calm off-white canvas, soft light-green navigation, and electric neon-green active controls.',
    isDark: false,
    recommendedLayout: 'standard',
    swatches: {
      titlebar: '#dcfce7',
      titlebarFg: '#052e16',
      sidebar: '#ecfdf3',
      canvas: '#f8faf5',
      card: '#ffffff',
      border: '#86efac',
      primary: '#00e676',
      primaryFg: '#032210',
      radiusPx: 8,
    },
  },
  {
    id: 'dark',
    name: 'Dark Slate Pro',
    shortLabel: 'Dark Pro',
    category: 'Dark',
    description: 'Balanced soft charcoal-slate night console with elevated surface contrast, bright readable labels, and emerald actions.',
    isDark: true,
    recommendedLayout: 'standard',
    swatches: {
      titlebar: '#111827',
      titlebarFg: '#f8fafc',
      sidebar: '#141d2f',
      canvas: '#1c273d',
      card: '#141d2f',
      border: '#2f405e',
      primary: '#059669',
      primaryFg: '#ffffff',
      radiusPx: 8,
    },
  },
];

export const LAYOUT_STYLE_CATALOG: LayoutStyleDefinition[] = [
  {
    id: 'standard',
    name: 'Standard Desktop Layout',
    shortLabel: 'Standard',
    description: 'Full desktop window title bar, live database/AI status bar, and balanced card spacing.',
    highlights: 'Full Header · Balanced Padding · Theme Radius',
  },
  {
    id: 'simple',
    name: 'Simple Clean Layout',
    shortLabel: 'Simple',
    description: 'Streamlined minimalist workspace — hides window frame chrome and technical status bars for pure focus.',
    highlights: 'Minimal Single Bar · Clean Focus · Zero Clutter',
  },
  {
    id: 'classic',
    name: 'Classic Spreadsheet Grid',
    shortLabel: 'Classic Grid',
    description: 'Traditional high-density accounting layout with crisp square corners and visible cell gridlines on all tables.',
    highlights: 'Square Edges · Dense Rows · Ledger Gridlines',
  },
];

export const VALID_THEME_IDS = new Set<ThemeType>(THEME_CATALOG.map((t) => t.id));
export const VALID_LAYOUT_IDS = new Set<LayoutStyleType>(LAYOUT_STYLE_CATALOG.map((l) => l.id));

export function getThemeDefinition(themeId: ThemeType): ThemeDefinition {
  return THEME_CATALOG.find((t) => t.id === themeId) || THEME_CATALOG[0];
}
