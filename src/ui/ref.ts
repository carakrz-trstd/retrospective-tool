import { signal, type Signal } from '@preact/signals';

/** A signal with a set() method, so controller code reads "x.set(value)". */
export type Ref<T> = Signal<T> & { set(value: T): void };

export function ref<T>(initial: T): Ref<T> {
  const s = signal(initial);
  return Object.assign(s, {
    set(value: T) {
      s.value = value;
    },
  });
}
