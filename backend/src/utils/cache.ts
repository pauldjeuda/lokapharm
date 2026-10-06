interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Cache mémoire TTL — fluide type Google Maps (réponses instantanées sur zones déjà vues). */
export class TtlCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /** Stale-while-revalidate : renvoie même expiré si encore dans graceMs. */
  getStale<T>(key: string, graceMs: number): { value: T; fresh: boolean } | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }
    const now = Date.now();
    if (now <= entry.expiresAt) {
      return { value: entry.value, fresh: true };
    }
    if (now <= entry.expiresAt + graceMs) {
      return { value: entry.value, fresh: false };
    }
    this.store.delete(key);
    return null;
  }
}

export const memoryCache = new TtlCache();
