"use client";
// React access to the local store without setState-in-effect: components read
// through useSyncExternalStore and writers call notifyStore().
import { useSyncExternalStore } from "react";
import { getStore, type Store } from "./storage";

const listeners = new Set<() => void>();
let version = 0;

export function notifyStore() {
  version++;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = () => notifyStore();
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

/** Store version; -1 on the server and during hydration. */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => -1);
}

/** The local store once hydrated on the client, otherwise null. */
export function useStore(): Store | null {
  const v = useStoreVersion();
  return v < 0 ? null : getStore();
}
