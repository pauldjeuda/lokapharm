import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { from, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class CacheService {
  private ready = false;

  constructor(private readonly storage: Storage) {}

  async init(): Promise<void> {
    if (!this.ready) {
      await this.storage.create();
      this.ready = true;
    }
  }

  get<T>(key: string): Observable<T | null> {
    return from(this.init().then(() => this.storage.get(key))).pipe(
      map((entry: CacheEntry<T> | null) => entry?.data ?? null)
    );
  }

  set<T>(key: string, data: T): Observable<void> {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    return from(this.init().then(() => this.storage.set(key, entry))).pipe(map(() => undefined));
  }

  isExpired(key: string, ttlMs: number): Observable<boolean> {
    return from(this.init().then(() => this.storage.get(key))).pipe(
      map((entry: CacheEntry<unknown> | null) => {
        if (!entry?.timestamp) {
          return true;
        }
        return Date.now() - entry.timestamp > ttlMs;
      })
    );
  }

  getTimestamp(key: string): Observable<number | null> {
    return from(this.init().then(() => this.storage.get(key))).pipe(
      map((entry: CacheEntry<unknown> | null) => entry?.timestamp ?? null)
    );
  }

  clear(key: string): Observable<void> {
    return from(this.init().then(() => this.storage.remove(key))).pipe(map(() => undefined));
  }

  empty<T>(): Observable<T | null> {
    return of(null);
  }
}
