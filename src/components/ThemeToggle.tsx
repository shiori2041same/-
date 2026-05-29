/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Sun, Moon, Eye } from "lucide-react";

export type ThemeMode = "light" | "dark" | "high-contrast";

interface ThemeToggleProps {
  theme: ThemeMode;
  onThemeChange: (newTheme: ThemeMode) => void;
}

export default function ThemeToggle({ theme, onThemeChange }: ThemeToggleProps) {
  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50">
      <div className="text-sm font-semibold tracking-wide text-zinc-700 dark:text-zinc-300">
        <span id="theme-select-label">画面の表示モードの変更</span>
      </div>
      <div 
        className="grid grid-cols-3 gap-2" 
        role="group" 
        aria-labelledby="theme-select-label"
      >
        <button
          type="button"
          onClick={() => onThemeChange("light")}
          aria-pressed={theme === "light"}
          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-md border-2 transition-all cursor-pointer min-h-[56px] focus-visible:ring-4 ${
            theme === "light"
              ? "bg-zinc-950 text-white border-zinc-950"
              : "bg-white text-zinc-800 border-zinc-300 hover:border-zinc-400"
          }`}
        >
          <Sun className="w-5 h-5" aria-hidden="true" />
          <span className="text-xs font-medium">標準（明るい）</span>
        </button>

        <button
          type="button"
          onClick={() => onThemeChange("dark")}
          aria-pressed={theme === "dark"}
          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-md border-2 transition-all cursor-pointer min-h-[56px] focus-visible:ring-4 ${
            theme === "dark"
              ? "bg-amber-400 text-black border-amber-400"
              : "bg-zinc-900 text-zinc-100 border-zinc-700 hover:border-zinc-600"
          }`}
        >
          <Moon className="w-5 h-5" aria-hidden="true" />
          <span className="text-xs font-medium">ダーク（暗い）</span>
        </button>

        <button
          type="button"
          onClick={() => onThemeChange("high-contrast")}
          aria-pressed={theme === "high-contrast"}
          className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-md border-4 transition-all cursor-pointer min-h-[56px] focus-visible:ring-4 ${
            theme === "high-contrast"
              ? "bg-black text-yellow-300 border-yellow-300"
              : "bg-white text-black border-black hover:bg-zinc-100"
          }`}
        >
          <Eye className="w-5 h-5" aria-hidden="true" />
          <span className="text-xs font-bold leading-none">明瞭（白黒高対比）</span>
        </button>
      </div>
    </div>
  );
}
