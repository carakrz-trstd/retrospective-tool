// Host-side handlers of the flow.* intents. All of them are Facilitator-only and need a running session.
import { registerIntentHandler, type IntentContext, type IntentResult } from '../core/registry';
import type { SessionState } from '../core/types';
import { getFlow, setFlow } from './flowState';
import { STOPS, isRetro, next, prev } from './stops';
import { suggestedMs } from './suggested';
import { IDLE, pause, reset, start } from './timer';
import type { FlowState, StopId } from './types';

const fail = (reason: string): IntentResult => ({ ok: false, reason });

function durationOf(state: SessionState, stop: StopId): number {
  return suggestedMs(stop, state.format, state.timeBudgetMin);
}

/** Moves to a stop: pauses the timer of the stop being left; arriving at reveal/discuss reveals the retro entries. */
function moveTo(state: SessionState, flow: FlowState, to: StopId, now: number): FlowState {
  if (to === flow.stop) return flow;
  const left = flow.timers[flow.stop];
  const timers = { ...flow.timers };
  if (left?.status === 'running') timers[flow.stop] = pause(left, durationOf(state, flow.stop), now);
  const revealed = {
    ...flow.revealed,
    retro: flow.revealed.retro || to === 'retro.reveal' || to === 'retro.discuss',
  };
  return { ...flow, stop: to, timers, revealed };
}

function guarded(fn: (ctx: IntentContext, flow: FlowState) => IntentResult) {
  return (ctx: IntentContext): IntentResult => {
    if (ctx.state.status !== 'running') return fail('session-not-running');
    if (!ctx.senderId || !ctx.state.participants[ctx.senderId]?.isFacilitator) return fail('not-facilitator');
    return fn(ctx, getFlow(ctx.state));
  };
}

const ok = (state: SessionState, flow: FlowState): IntentResult => ({
  ok: true,
  state: setFlow(state, flow),
});

export function registerFlowIntents(): void {
  registerIntentHandler(
    'flow.goto',
    guarded((ctx, flow) => {
      const stop = (ctx.payload as { stop?: unknown } | null)?.stop;
      if (typeof stop !== 'string' || !STOPS.includes(stop as StopId)) return fail('unknown-stop');
      return ok(ctx.state, moveTo(ctx.state, flow, stop as StopId, ctx.now));
    }),
  );
  registerIntentHandler(
    'flow.next',
    guarded((ctx, flow) => ok(ctx.state, moveTo(ctx.state, flow, next(flow.stop), ctx.now))),
  );
  registerIntentHandler(
    'flow.prev',
    guarded((ctx, flow) => ok(ctx.state, moveTo(ctx.state, flow, prev(flow.stop), ctx.now))),
  );
  registerIntentHandler(
    'flow.reveal',
    guarded((ctx, flow) => {
      const key = (ctx.payload as { key?: unknown } | null)?.key;
      if (key !== 'checkIn' && key !== 'retro') return fail('unknown-key');
      const inPhase = key === 'checkIn' ? flow.stop === 'checkIn' : isRetro(flow.stop);
      if (!inPhase) return fail('wrong-phase');
      if (flow.revealed[key]) return ok(ctx.state, flow);
      const revealed = { ...flow.revealed, [key]: true };
      if (flow.stop === 'retro.write')
        return ok(ctx.state, moveTo(ctx.state, { ...flow, revealed }, 'retro.reveal', ctx.now));
      return ok(ctx.state, { ...flow, revealed });
    }),
  );
  registerIntentHandler(
    'flow.timer',
    guarded((ctx, flow) => {
      const action = (ctx.payload as { action?: unknown } | null)?.action;
      if (action !== 'start' && action !== 'pause' && action !== 'reset') return fail('unknown-action');
      const duration = durationOf(ctx.state, flow.stop);
      const current = flow.timers[flow.stop] ?? IDLE;
      const updated =
        action === 'start'
          ? start(current, duration, ctx.now)
          : action === 'pause'
            ? pause(current, duration, ctx.now)
            : reset();
      if (updated === current) return ok(ctx.state, flow);
      return ok(ctx.state, { ...flow, timers: { ...flow.timers, [flow.stop]: updated } });
    }),
  );
  registerIntentHandler(
    'flow.muteAll',
    guarded((ctx, flow) => {
      const muted = (ctx.payload as { muted?: unknown } | null)?.muted;
      if (typeof muted !== 'boolean') return fail('invalid-payload');
      return ok(ctx.state, { ...flow, soundMutedForAll: muted });
    }),
  );
}
