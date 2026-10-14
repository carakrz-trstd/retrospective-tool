import { render, within } from '@testing-library/preact';
import { vi, type Mock } from 'vitest';
import { App } from '../../src/app/App';
import type { TimeBudget } from '../../src/formats/types';
import { MemoryNetwork } from '../../src/transport/MemoryTransport';
import { chooseFormat, makeApp, type TestApp } from '../appHelpers';

export interface FlowDevice {
  t: TestApp;
  q: ReturnType<typeof within>;
  container: HTMLElement;
  sound: { unlock: Mock; beep: Mock };
}

function mount(t: TestApp): { q: FlowDevice['q']; container: HTMLElement } {
  const view = render(<App controller={t.app} />, {
    container: document.body.appendChild(document.createElement('div')),
  });
  t.app.boot();
  return { q: within(view.container as HTMLElement), container: view.container as HTMLElement };
}

function makeSound() {
  return { unlock: vi.fn(), beep: vi.fn(() => true) };
}

/** A Facilitator and some participants in a running session (each with its own app and fake sound). */
export async function runningSession(
  opts: { participants?: string[]; formatId?: string; budget?: TimeBudget; start?: boolean } = {},
) {
  const net = new MemoryNetwork();
  const hostSound = makeSound();
  const hostApp = makeApp(net, { services: { sound: hostSound } });
  const hm = mount(hostApp);
  chooseFormat(hostApp.app, opts.formatId ?? 'start-stop-continue', opts.budget ?? 50);
  await hostApp.app.createSession({ name: 'Fiona', role: 'Scrum Master' });
  const code = hostApp.app.state.value!.joinCode;
  const host: FlowDevice = { t: hostApp, ...hm, sound: hostSound };

  const people: Record<string, FlowDevice> = {};
  for (const name of opts.participants ?? []) {
    const sound = makeSound();
    const t = makeApp(net, { services: { sound } });
    const m = mount(t);
    await t.app.join(code, name, 'Developer');
    people[name] = { t, ...m, sound };
  }
  if (opts.start !== false) {
    hostApp.app.startSession();
    await host.q.findByRole('heading', { name: /^Session/ });
    for (const p of Object.values(people)) await p.q.findByRole('heading', { name: /^Session/ });
  }
  return { net, host, people, code };
}
