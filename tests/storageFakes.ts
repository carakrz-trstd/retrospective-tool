import type { StorageLike } from '../src/storage/storage';

/** A simple in-memory Storage for tests. */
export class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  key(index: number): string | null {
    return Array.from(this.data.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  keys(): string[] {
    return Array.from(this.data.keys());
  }
}

/** A Storage that always throws, like localStorage in some private-browsing modes. */
export class ThrowingStorage implements StorageLike {
  get length(): number {
    throw new Error('storage unavailable');
  }
  key(): string | null {
    throw new Error('storage unavailable');
  }
  getItem(): string | null {
    throw new Error('storage unavailable');
  }
  setItem(): void {
    throw new Error('storage unavailable');
  }
  removeItem(): void {
    throw new Error('storage unavailable');
  }
}
