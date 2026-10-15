import { registerContrib } from '../../src/contrib/register';
import { cleanup as flowCleanup, flowSetup } from '../flow/flowHelpers';
import type { HostController } from '../../src/host/HostController';

/** A running host with the flow and contribution handlers registered, plus raw test clients. */
export async function contribSetup(opts: { start?: boolean; clients?: string[] } = {}) {
  const s = await flowSetup({ ...opts, start: false });
  registerContrib();
  if (opts.start !== false) s.host.startSession();
  return s;
}

export function cleanup(hosts: HostController[]): void {
  flowCleanup(hosts);
}
