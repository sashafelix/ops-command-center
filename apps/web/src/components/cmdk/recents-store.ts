"use client";

import { lsGet, lsSet, StorageKeys } from "@/lib/storage";

export type Recent = { id: string; label: string; href: string };

const MAX_RECENTS = 3;

export function readRecents(): Recent[] {
  return lsGet<Recent[]>(StorageKeys.cmdkRecents, []);
}

export function pushRecent(entry: Recent): Recent[] {
  const existing = readRecents().filter((r) => r.id !== entry.id);
  const next = [entry, ...existing].slice(0, MAX_RECENTS);
  lsSet(StorageKeys.cmdkRecents, next);
  return next;
}
