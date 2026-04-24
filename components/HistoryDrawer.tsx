"use client";

import { useEffect, useState } from "react";
import { History as HistoryIcon, Trash2, X } from "lucide-react";
import type { HistoryEntry } from "@/lib/history";
import {
  listHistory,
  removeHistory,
  clearHistory,
  relativeTime,
} from "@/lib/history";

interface HistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  onRestore: (entry: HistoryEntry) => void;
}

function ConfidenceBadge({ value }: { value: number }) {
  const color = value >= 80 ? "#34d399" : value >= 65 ? "#fbbf24" : "#f87171";
  return (
    <span
      className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono tabular-nums"
      style={{
        color,
        borderColor: `${color}40`,
        backgroundColor: `${color}12`,
      }}
    >
      {value}
    </span>
  );
}

export function HistoryDrawer({ open, onClose, onRestore }: HistoryDrawerProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    if (open) {
      setEntries(listHistory());
      setConfirmingClear(false);
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function handleRemove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    removeHistory(id);
    setEntries(listHistory());
  }

  function handleClearAll() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    clearHistory();
    setEntries([]);
    setConfirmingClear(false);
  }

  function handleRestore(entry: HistoryEntry) {
    onRestore(entry);
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 z-40 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Analysis history"
        aria-hidden={!open}
        className={`fixed top-0 right-0 h-full w-[420px] max-w-[92vw] bg-[#0c0c0f] border-l border-white/[0.06] z-50 transform transition-transform duration-300 flex flex-col ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.05]">
          <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2 tracking-wide">
            <HistoryIcon className="w-4 h-4" strokeWidth={2} />
            History
            {entries.length > 0 && (
              <span className="text-[11px] text-white/35 font-normal">
                · {entries.length}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="text-white/40 hover:text-white/80 p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {entries.length === 0 ? (
            <div className="text-center py-16 px-6">
              <p className="text-xs text-white/35 leading-relaxed">
                No past runs yet.
                <br />
                Your analyses will appear here once they complete.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {entries.map((entry) => (
                <li
                  key={entry.id}
                  tabIndex={0}
                  role="button"
                  onClick={() => handleRestore(entry)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleRestore(entry);
                    }
                  }}
                  className="group px-3 py-2.5 rounded-lg hover:bg-white/[0.04] cursor-pointer flex items-start gap-2.5 focus:outline-none focus:ring-1 focus:ring-accent/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white/75 leading-snug line-clamp-2">
                      {entry.task}
                    </p>
                    <p className="text-[11px] text-white/35 mt-1">
                      {relativeTime(entry.savedAt)}
                    </p>
                  </div>
                  <ConfidenceBadge value={entry.result.consensus.confidence} />
                  <button
                    onClick={(e) => handleRemove(entry.id, e)}
                    aria-label="Delete this run"
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {entries.length > 0 && (
          <footer className="px-6 py-3 border-t border-white/[0.05] flex justify-between items-center">
            <p className="text-[11px] text-white/30">
              Stored locally · max 20 runs
            </p>
            <button
              onClick={handleClearAll}
              className={`text-[11px] transition-colors ${
                confirmingClear
                  ? "text-red-400 hover:text-red-300"
                  : "text-white/40 hover:text-red-400"
              }`}
            >
              {confirmingClear ? "Confirm clear all?" : "Clear all"}
            </button>
          </footer>
        )}
      </aside>
    </>
  );
}
