// Registers the contribution intents, view filter, counters and removal hook (rules only; the
// screens are registered by ui/contrib/registerViews.ts).
import {
  getIntentHandler,
  registerIntentHandler,
  registerRemovalHook,
  registerViewFilter,
} from '../core/registry';
import { registerFlow } from '../flow';
import { getContributionCounter, registerContributionCounter } from '../flow/registries';
import { CONTRIB_INTENTS, applyIntent } from './reducer';
import { contribRemovalHook, contribViewFilter, countFor } from './view';

/** Safe to call more than once. Registers the flow module first: its counts must see hidden entries. */
export function registerContrib(): void {
  registerFlow();
  if (!getIntentHandler('entry.add')) {
    for (const kind of CONTRIB_INTENTS) {
      registerIntentHandler(
        kind,
        (ctx) => {
          const me = ctx.senderId ? ctx.state.participants[ctx.senderId] : undefined;
          const actor = { participantId: ctx.senderId, isFacilitator: me?.isFacilitator === true };
          const result = applyIntent(ctx.state, actor, { kind, payload: ctx.payload }, 'host', ctx.now);
          return result.ok ? { ok: true, state: result.state } : { ok: false, reason: result.reason };
        },
        // the host does not record who sent a survey answer (AD-11)
        { anonymous: kind === 'survey.submit' },
      );
    }
    registerViewFilter(contribViewFilter);
    registerRemovalHook(contribRemovalHook);
  }
  if (!getContributionCounter('checkIn'))
    registerContributionCounter('checkIn', (s) => countFor(s, 'checkIn'));
  if (!getContributionCounter('retro')) registerContributionCounter('retro', (s) => countFor(s, 'retro'));
}
