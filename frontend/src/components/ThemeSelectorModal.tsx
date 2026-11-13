import React, { useRef } from 'react';
import { useDialog } from '../hooks/useDialog';
import { X, Sun, Moon, Palette, Check, Monitor, Sliders } from 'lucide-react';

export type ThemeMode = 'light' | 'contrast' | 'dark';
export type AccentColor = 'blue' | 'teal' | 'emerald' | 'cyan' | 'amber' | 'slate';

interface ThemeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: ThemeMode;
  onSelectMode: (mode: ThemeMode) => void;
  currentAccent: AccentColor;
  onSelectAccent: (accent: AccentColor) => void;
}

export const ThemeSelectorModal: React.FC<ThemeSelectorModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  onSelectMode,
  currentAccent,
  onSelectAccent
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(dialogRef, onClose, isOpen);
  if (!isOpen) return null;

  const themes: { id: ThemeMode; label: string; desc: string; icon: any }[] = [
    {
      id: 'light',
      label: 'Clean All-White',
      desc: 'Crisp white canvas with soft borders and slate typography.',
      icon: Sun
    },
    {
      id: 'contrast',
      label: 'Contrast Minimal',
      desc: 'Subtle gray background with dark navigation rail.',
      icon: Monitor
    },
    {
      id: 'dark',
      label: 'Obsidian Midnight',
      desc: 'Deep dark background with high-contrast cards.',
      icon: Moon
    }
  ];

  const accents: { id: AccentColor; label: string; hex: string; bgClass: string }[] = [
    { id: 'blue', label: 'Linear Blue', hex: '#2563EB', bgClass: 'bg-[#2563EB]' },
    { id: 'teal', label: 'Precision Teal', hex: '#0D9488', bgClass: 'bg-[#0D9488]' },
    { id: 'emerald', label: 'Terminal Emerald', hex: '#059669', bgClass: 'bg-[#059669]' },
    { id: 'cyan', label: 'Nordic Steel Cyan', hex: '#0891B2', bgClass: 'bg-[#0891B2]' },
    { id: 'amber', label: 'Industrial Amber', hex: '#D97706', bgClass: 'bg-[#D97706]' },
    { id: 'slate', label: 'Carbon Slate', hex: '#475569', bgClass: 'bg-[#475569]' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn select-none" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-title"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white dark:bg-[#0E131F] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-6"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
              <Sliders className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="theme-title" className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                Appearance &amp; Accent System
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Configure interface theme and active brand accent in real time
              </p>
            </div>
          </div>

          <button type="button"
            onClick={onClose}
            aria-label="Close appearance settings"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* 1. Theme Mode */}
        <div className="space-y-2.5">
          <h3 id="theme-mode-label" className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
            Canvas Background
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-labelledby="theme-mode-label">
            {themes.map((t) => {
              const Icon = t.icon;
              const isSelected = currentMode === t.id;

              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  key={t.id}
                  onClick={() => onSelectMode(t.id)}
                  className={`text-left p-3 rounded-xl border cursor-pointer transition-colors flex flex-col justify-between ${
                    isSelected
                      ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800/60 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-4 h-4 text-slate-600 dark:text-slate-300" aria-hidden="true" />
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                      {t.label}
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-1">
                      {t.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Professional Accent Palette */}
        <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between">
            <h3 id="accent-label" className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
              Active Brand Accent
            </h3>
            <span className="text-[11px] font-mono text-teal-600 dark:text-teal-400 font-semibold">
              Live Applied
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-labelledby="accent-label">
            {accents.map((a) => {
              const isSelected = currentAccent === a.id;

              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onSelectAccent(a.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all text-left ${
                    isSelected
                      ? 'border-slate-900 dark:border-white bg-slate-50 dark:bg-slate-800/60 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span 
                      className={`w-3.5 h-3.5 rounded-full ${a.bgClass} flex-shrink-0 shadow-sm`}
                      aria-hidden="true"
                    />
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {a.label}
                    </span>
                  </div>

                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-slate-900 dark:text-white flex-shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Done / Apply Button */}
        <div className="pt-2">
          <button type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-[0.99]"
          >
            Apply & Close
          </button>
        </div>

      </div>
    </div>
  );
};
