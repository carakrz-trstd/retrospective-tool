import { fireEvent, type RenderResult } from '@testing-library/preact';
import { registerContrib } from '../../src/contrib/register';
import { resetRegistries } from '../../src/core/registry';
import { resetFlowRegistries } from '../../src/flow/registries';
import { registerContribViews } from '../../src/ui/contrib/registerViews';
import type { StopId } from '../../src/flow/types';
import { runningSession, type FlowDevice } from './flowHelpers';

export type { FlowDevice };

/** A running session with the real contributions module (rules and screens) registered. */
export async function contribSession(opts: Parameters<typeof runningSession>[0] = {}) {
  resetRegistries();
  resetFlowRegistries();
  registerContrib();
  registerContribViews();
  return runningSession(opts);
}

export function resetContrib(): void {
  resetRegistries();
  resetFlowRegistries();
  localStorage.clear();
}

/** The Facilitator moves everybody to a stop. */
export function goTo(host: FlowDevice, stop: StopId): void {
  host.t.app.flowIntent('flow.goto', { stop });
}

/** Types into a field the way a person does (the input event carries the whole new value). */
export function type(field: HTMLElement, value: string): void {
  fireEvent.input(field, { target: { value } });
}

export type Query = RenderResult['getByRole'];
