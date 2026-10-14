// Item-level difference between two views of the session state (what a participant could see
// before and after a change), and applying such a difference. The host sends the difference
// as `changes`; a change replaces a whole item, and `value: null` deletes it.
//
// Granularity (AD-13 in the Epic 4 spec, needed from the start so later epics need no code here):
//   top-level field                       -> ['status']
//   participant                           -> ['participants', id]
//   extension field or collection item    -> ['extensions', extension, field]
//                                            ['extensions', extension, collection, itemId]

import type { Change } from './protocol';
import type { SessionState } from './types';

type Plain = Record<string, unknown>;

function isPlain(value: unknown): value is Plain {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (isPlain(a) && isPlain(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => k in b && deepEqual(a[k], b[k]));
  }
  return false;
}

const SKIPPED = new Set(['rev', 'participants', 'extensions']);

export function diffViews(prev: SessionState, next: SessionState): Change[] {
  const changes: Change[] = [];
  const p = prev as unknown as Plain;
  const n = next as unknown as Plain;

  // top-level fields (rev travels in the update envelope)
  for (const key of new Set([...Object.keys(p), ...Object.keys(n)])) {
    if (SKIPPED.has(key)) continue;
    if (!deepEqual(p[key], n[key]))
      changes.push({ path: [key], value: n[key] === undefined ? null : n[key] });
  }

  // participants: whole items
  const ids = new Set([...Object.keys(prev.participants), ...Object.keys(next.participants)]);
  for (const id of ids) {
    const a = prev.participants[id];
    const b = next.participants[id];
    if (!deepEqual(a, b)) changes.push({ path: ['participants', id], value: b ?? null });
  }

  // extensions: extension -> field -> (collection) item
  const extKeys = new Set([...Object.keys(prev.extensions), ...Object.keys(next.extensions)]);
  for (const ext of extKeys) {
    const a = prev.extensions[ext];
    const b = next.extensions[ext];
    if (deepEqual(a, b)) continue;
    if (!isPlain(b)) {
      changes.push({ path: ['extensions', ext], value: b === undefined ? null : b });
      continue;
    }
    const aObj = isPlain(a) ? a : {};
    for (const field of new Set([...Object.keys(aObj), ...Object.keys(b)])) {
      const fa = aObj[field];
      const fb = b[field];
      if (deepEqual(fa, fb)) continue;
      if (isPlain(fb) || (fb === undefined && isPlain(fa))) {
        const fbObj = isPlain(fb) ? fb : {};
        const faObj = isPlain(fa) ? fa : {};
        if (fb === undefined) {
          changes.push({ path: ['extensions', ext, field], value: null });
          continue;
        }
        for (const item of new Set([...Object.keys(faObj), ...Object.keys(fbObj)])) {
          if (!deepEqual(faObj[item], fbObj[item])) {
            changes.push({ path: ['extensions', ext, field, item], value: fbObj[item] ?? null });
          }
        }
      } else {
        changes.push({ path: ['extensions', ext, field], value: fb === undefined ? null : fb });
      }
    }
  }
  return changes;
}

/** Returns a new state with the changes applied; the input is not modified. */
export function applyChanges(state: SessionState, changes: Change[]): SessionState {
  const result = structuredClone(state) as unknown as Plain;
  for (const { path, value } of changes) {
    let node = result;
    for (let i = 0; i < path.length - 1; i++) {
      const key = path[i]!;
      const child = node[key];
      if (!isPlain(child)) node[key] = {};
      node = node[key] as Plain;
    }
    const last = path[path.length - 1]!;
    if (value === null) delete node[last];
    else node[last] = structuredClone(value);
  }
  return result as unknown as SessionState;
}
