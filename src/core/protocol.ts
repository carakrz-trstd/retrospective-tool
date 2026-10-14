// Messages between participants and the host. Every message is { v, type, ... }.
// Every host-to-client message also carries `hostTime` (the host's Date.now() at send time),
// which later epics use to agree on a common clock (Epic 3, AD-12).

import type { SessionState } from './types';

export const PROTOCOL_VERSION = 1;

/** A change a participant asks the host to make. `opId` makes re-sends harmless. */
export interface Intent {
  opId: string;
  /** The intent's type, for example "survey.submit". */
  kind: string;
  payload: unknown;
}

/** Replace the item at `path` with `value`; `null` deletes it. */
export interface Change {
  path: string[];
  value: unknown;
}

export type ClientMessage =
  | { v: number; type: 'lookup'; code: string }
  | { v: number; type: 'join'; name: string; role: string }
  | { v: number; type: 'rejoin'; token: string }
  | ({ v: number; type: 'intent' } & Intent)
  | { v: number; type: 'leave' }
  | { v: number; type: 'resync'; haveSeq: number };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A client message without the version field (added when sending). */
export type ClientMessageBody = DistributiveOmit<ClientMessage, 'v'>;

export type RejectReason =
  | 'version'
  | 'session-ended'
  | 'name-required'
  | 'role-required'
  | 'unknown-token'
  | 'removed'
  | 'not-joined'
  | 'unknown-intent'
  | string;

export type HostMessage =
  | { v: number; type: 'resolved'; hostTime: number; sessionId: string }
  | { v: number; type: 'notFound'; hostTime: number }
  | {
      v: number;
      type: 'welcome';
      hostTime: number;
      token?: string;
      participantId: string;
      seq: number;
      state: SessionState;
    }
  | { v: number; type: 'update'; hostTime: number; seq: number; rev: number; changes: Change[] }
  | { v: number; type: 'ack'; hostTime: number; opId: string; seq: number }
  | { v: number; type: 'removed'; hostTime: number }
  | { v: number; type: 'ended'; hostTime: number; payload?: unknown }
  | { v: number; type: 'rejected'; hostTime: number; reason: RejectReason; opId?: string };

export function isClientMessage(msg: unknown): msg is ClientMessage {
  return typeof msg === 'object' && msg !== null && typeof (msg as { type?: unknown }).type === 'string';
}

export function isHostMessage(msg: unknown): msg is HostMessage {
  return typeof msg === 'object' && msg !== null && typeof (msg as { type?: unknown }).type === 'string';
}
