import type { Team } from '@/components/team-manager';
export interface LiveState {
  auction: {
    id: string;
    name: string;
    version: number;
    status: string;
    denomination: string;
    minimumPrice: number | null;
  };
  engine: {
    version: number;
    round: number;
    queue: string[];
    pendingId: string | null;
    paused: boolean;
    completed: boolean;
    autoNext: boolean;
    delayMs: number;
  } | null;
  current: {
    _id: string;
    selectionIndex: number;
    eligibleCount: number;
    player: {
      _id: string;
      name: string;
      registrationId: string | null;
      category: string | null;
      previousTeam: string | null;
      dob: string | null;
      playerPhotoURL: string | null;
    } | null;
  } | null;
  teams: Team[];
  history: {
    _id: string;
    playerId: string;
    status: string;
    round: number;
    decisionVersion: number;
    playerName?: string;
  }[];
}
