import { getIntentHandler } from '../core/registry';
import { registerFlowIntents } from './flowIntents';
import { registerFlowView } from './flowView';

/** Registers the flow intent handlers and the view filter. Safe to call more than once. */
export function registerFlow(): void {
  if (getIntentHandler('flow.next')) return;
  registerFlowIntents();
  registerFlowView();
}
