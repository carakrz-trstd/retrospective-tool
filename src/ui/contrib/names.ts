import type { SessionState } from '../../core/types';
import { texts } from '../../texts';

/** The name to show for a participant (also for somebody who is not in the view any more). */
export function nameOf(state: SessionState, participantId: string): string {
  return state.participants[participantId]?.displayName ?? texts.contrib.formerParticipant;
}

export function activeParticipants(state: SessionState) {
  return Object.values(state.participants)
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

export const byCreated = <T extends { createdAt: number; id: string }>(a: T, b: T): number =>
  a.createdAt - b.createdAt || a.id.localeCompare(b.id);
