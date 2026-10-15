// Rules of action items: description, one or more owners from the session, optional due date.
import { ACTION_DESCRIPTION_MAX, validateText } from './limits';
import { fail, type ActionItem, type ActionOwner, type RuleContext, type RuleResult } from './types';

const id = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 && v.length <= 100 ? v : undefined;

/** 'YYYY-MM-DD' that is a real calendar date (any date, also in the past). */
export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Owners from the IDs: active participants, or owners the item already has (their name stays as plain text). */
function resolveOwners(
  c: RuleContext,
  ownerIds: unknown,
  current: ActionOwner[] = [],
): ActionOwner[] | string {
  if (!Array.isArray(ownerIds) || ownerIds.some((o) => typeof o !== 'string')) return 'invalid';
  const unique = [...new Set(ownerIds as string[])];
  if (unique.length === 0) return 'owner-required';
  const owners: ActionOwner[] = [];
  for (const pid of unique) {
    const kept = current.find((o) => o.participantId === pid);
    const person = c.state.participants[pid];
    if (person?.status === 'active')
      owners.push({ participantId: pid, name: kept?.name ?? person.displayName });
    else if (kept) owners.push(kept);
    else return 'invalid-owner';
  }
  return owners;
}

export function addAction(c: RuleContext): RuleResult {
  const actionId = id(c.payload.id);
  if (!actionId || typeof c.payload.description !== 'string') return fail('invalid');
  const text = validateText(c.payload.description, ACTION_DESCRIPTION_MAX);
  if (!text.ok) return fail(text.reason);
  const owners = resolveOwners(c, c.payload.ownerIds);
  if (typeof owners === 'string') return fail(owners);
  const due = c.payload.dueDate;
  if (due !== undefined && due !== null && !isValidDate(due)) return fail('invalid-date');
  const existing = c.contrib.actions[actionId];
  if (existing)
    return existing.createdBy === c.actor.participantId ? { ok: true, contrib: c.contrib } : fail('id-taken');
  const item: ActionItem = {
    id: actionId,
    description: text.text,
    owners,
    ...(typeof due === 'string' ? { dueDate: due } : {}),
    createdBy: c.actor.participantId!,
    createdAt: c.now,
    updatedAt: c.now,
  };
  return { ok: true, contrib: { ...c.contrib, actions: { ...c.contrib.actions, [actionId]: item } } };
}

export function editAction(c: RuleContext): RuleResult {
  const actionId = id(c.payload.id);
  const item = actionId ? c.contrib.actions[actionId] : undefined;
  if (!actionId || !item) return fail('unknown-item');
  const next: ActionItem = { ...item, updatedAt: c.now };
  if (c.payload.description !== undefined) {
    if (typeof c.payload.description !== 'string') return fail('invalid');
    const text = validateText(c.payload.description, ACTION_DESCRIPTION_MAX);
    if (!text.ok) return fail(text.reason);
    next.description = text.text;
  }
  if (c.payload.ownerIds !== undefined) {
    const owners = resolveOwners(c, c.payload.ownerIds, item.owners);
    if (typeof owners === 'string') return fail(owners);
    next.owners = owners;
  }
  if (c.payload.dueDate === null) delete next.dueDate;
  else if (c.payload.dueDate !== undefined) {
    if (!isValidDate(c.payload.dueDate)) return fail('invalid-date');
    next.dueDate = c.payload.dueDate;
  }
  return { ok: true, contrib: { ...c.contrib, actions: { ...c.contrib.actions, [actionId]: next } } };
}

export function deleteAction(c: RuleContext): RuleResult {
  const actionId = id(c.payload.id);
  if (!actionId || !c.contrib.actions[actionId]) return fail('unknown-item');
  const { [actionId]: _removed, ...rest } = c.contrib.actions;
  return { ok: true, contrib: { ...c.contrib, actions: rest } };
}
