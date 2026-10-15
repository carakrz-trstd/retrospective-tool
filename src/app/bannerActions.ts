// Extra actions that later epics add to the 15-minute "Facilitator offline" hint of the connection banner.
import type { ComponentType } from 'preact';

let actions: ComponentType[] = [];

export function registerOfflineHintAction(action: ComponentType): void {
  if (!actions.includes(action)) actions.push(action);
}

export function getOfflineHintActions(): ComponentType[] {
  return actions;
}

/** For tests. */
export function resetBannerActions(): void {
  actions = [];
}
