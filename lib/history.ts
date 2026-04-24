/**
 * Client-side history store backed by localStorage.
 * Keeps the last MAX_ENTRIES analyses so users can return to prior runs
 * without a database. All reads/writes are safe to call during SSR — they
 * no-op when `window` is undefined.
 */

import type { AnalysisResult } from "@/types";
import type { FixOutput } from "@/lib/schemas";

const STORAGE_KEY = "sooko-devos:history:v1";
const MAX_ENTRIES = 20;

export interface HistoryEntry {
  id: string;
  savedAt: string; // ISO timestamp
  task: string;    // denormalized for cheap list rendering
  result: AnalysisResult;
  fix?: FixOutput;
}

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readRaw(): HistoryEntry[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeRaw(entries: HistoryEntry[]): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (err) {
    // Quota exceeded or storage disabled. Drop the oldest half and retry once.
    try {
      const trimmed = entries.slice(0, Math.max(1, Math.floor(entries.length / 2)));
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      console.warn("[Sooko History] Failed to persist history:", err);
    }
  }
}

export function listHistory(): HistoryEntry[] {
  return readRaw();
}

export function saveHistory(result: AnalysisResult, fix?: FixOutput): HistoryEntry {
  const entry: HistoryEntry = {
    id: result.task.id,
    savedAt: new Date().toISOString(),
    task: result.task.prompt,
    result,
    fix,
  };
  const existing = readRaw().filter((e) => e.id !== entry.id);
  const next = [entry, ...existing].slice(0, MAX_ENTRIES);
  writeRaw(next);
  return entry;
}

export function updateHistoryFix(id: string, fix: FixOutput): void {
  const existing = readRaw();
  const idx = existing.findIndex((e) => e.id === id);
  if (idx === -1) return;
  existing[idx] = { ...existing[idx], fix };
  writeRaw(existing);
}

export function removeHistory(id: string): void {
  writeRaw(readRaw().filter((e) => e.id !== id));
}

export function clearHistory(): void {
  writeRaw([]);
}

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
