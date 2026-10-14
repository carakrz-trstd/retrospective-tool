import { render } from '@testing-library/preact';
import { App } from '../src/app/App';
import { AppController, type AppServices } from '../src/app/AppController';
import { parseHash, type Route, type Router } from '../src/app/router';
import { getFormat } from '../src/formats/library';
import type { TimeBudget } from '../src/formats/types';
import { TabGuard } from '../src/tabs/TabGuard';
import { MemoryNetwork, MemoryTransport } from '../src/transport/MemoryTransport';
import { makeDevice, type Device } from './sessionHelpers';
import { FakeChannels, FakeLocks } from './tabFakes';

/** An in-memory router: records the address bar instead of touching the browser. */
export class FakeRouter implements Router {
  hash: string;
  history: string[] = [];
  private cbs = new Set<(r: Route) => void>();

  constructor(hash = '') {
    this.hash = hash;
  }

  current(): Route {
    return parseHash(this.hash);
  }

  navigate(hash: string): void {
    this.hash = hash;
    this.history.push(hash);
    for (const cb of this.cbs) cb(this.current());
  }

  replace(hash: string): void {
    this.hash = hash;
    this.history.push(`replace:${hash}`);
    for (const cb of this.cbs) cb(this.current());
  }

  subscribe(cb: (r: Route) => void): () => void {
    this.cbs.add(cb);
    return () => this.cbs.delete(cb);
  }
}

export interface TestApp {
  app: AppController;
  device: Device;
  router: FakeRouter;
  tabGuard: TabGuard;
}

/** The shared fakes for tab guarding: tabs of the same browser share locks and channels. */
export function makeBrowser() {
  return { locks: new FakeLocks(), channels: new FakeChannels() };
}

export function makeApp(
  net: MemoryNetwork,
  options: {
    hash?: string;
    device?: Device;
    browser?: ReturnType<typeof makeBrowser>;
    services?: Partial<AppServices>;
  } = {},
): TestApp {
  const device = options.device ?? makeDevice(net);
  const browser = options.browser ?? makeBrowser();
  const router = new FakeRouter(options.hash ?? '');
  const tabGuard = new TabGuard({
    locks: browser.locks,
    createChannel: browser.channels.create,
    takeOverTimeoutMs: 500,
  });
  const app = new AppController({
    createTransport: () => new MemoryTransport(net),
    store: device.store,
    tabGuard,
    router,
    baseUrl: () => 'https://retro.example/app/',
    ...options.services,
  });
  return { app, device, router, tabGuard };
}

export function renderApp(testApp: TestApp) {
  testApp.app.boot();
  return render(<App controller={testApp.app} />);
}

/** Chooses a library format the way the format selection would (answers first, then "Use this format"). */
export function chooseFormat(
  app: AppController,
  formatId = 'start-stop-continue',
  budget: TimeBudget = 50,
): void {
  const flow = app.flow;
  flow.setAnswer('mood', 'neutral');
  flow.setAnswer('goal', 'reflect-period');
  flow.setAnswer('timeBudgetMin', budget);
  flow.setAnswer('depth', 'lean');
  flow.setAnswer('setting', 'remote');
  flow.useFormat(getFormat(formatId)!);
}
