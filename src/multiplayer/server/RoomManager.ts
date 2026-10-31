import type { Difficulty, GameRules, Personality, TokenId } from '../../game/types';
import { CLASSIC_RULES } from '../../game/types';
import { cleanName, makeRoomCode } from '../protocol';

export interface LobbyPlayer {
  id: string;
  name: string;
  token: TokenId;
  ready: boolean;
  isHost: boolean;
  isAI: boolean;
  connected: boolean;
  difficulty: Difficulty;
  personality: Personality;
  sessionToken: string;
}

export interface LobbySnapshot {
  roomCode: string;
  roomName: string;
  hostName: string;
  status: 'lobby' | 'playing' | 'closed';
  players: Array<Omit<LobbyPlayer, 'sessionToken'>>;
  rules: GameRules;
  maxPlayers: number;
  message?: string;
}

const AI_NAMES = ['Casey', 'Morgan', 'Riley', 'Quinn', 'Avery'];

export class RoomManager {
  readonly roomCode = makeRoomCode();
  readonly hostToken: string;
  roomName: string;
  status: LobbySnapshot['status'] = 'lobby';
  rules: GameRules;
  players: LobbyPlayer[] = [];
  closedReason = '';

  constructor(hostName: string, hostToken: string, rules?: Partial<GameRules>) {
    this.hostToken = hostToken;
    this.roomName = `${hostName}'s table`;
    this.rules = { ...CLASSIC_RULES, ...rules, startingCash: rules?.startingCash ?? CLASSIC_RULES.startingCash };
  }

  snapshot(): LobbySnapshot {
    const host = this.players.find((player) => player.isHost);
    return {
      roomCode: this.roomCode,
      roomName: this.roomName,
      hostName: host?.name ?? 'Host',
      status: this.status,
      players: this.players.map(({ sessionToken: _session, ...player }) => player),
      rules: this.rules,
      maxPlayers: 6,
      message: this.closedReason || undefined,
    };
  }

  addHuman(input: { name: string; token: TokenId; isHost: boolean; sessionToken: string; id?: string }): LobbyPlayer | string {
    const name = cleanName(input.name);
    if (!name) return 'Enter a player name';
    if (this.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) return 'That name is already at the table';
    if (this.players.some((player) => player.token === input.token)) return 'That token is already taken';
    if (this.players.length >= 6) return 'The table is full';
    const player: LobbyPlayer = {
      id: input.id ?? `p_${Math.random().toString(36).slice(2, 10)}`,
      name,
      token: input.token,
      ready: input.isHost,
      isHost: input.isHost,
      isAI: false,
      connected: true,
      difficulty: 'normal',
      personality: 'cautious',
      sessionToken: input.sessionToken,
    };
    this.players.push(player);
    return player;
  }

  addAi(difficulty: Difficulty, personality: Personality): LobbyPlayer | string {
    if (this.status !== 'lobby') return 'The match has already started';
    if (this.players.length >= 6) return 'The table is full';
    const used = new Set(this.players.map((player) => player.token));
    const tokens: TokenId[] = ['car', 'dog', 'hat', 'ship', 'shoe', 'thimble', 'cannon', 'wheelbarrow'];
    const token = tokens.find((entry) => !used.has(entry));
    if (!token) return 'No tokens left';
    const name = AI_NAMES.find((entry) => !this.players.some((player) => player.name === entry)) ?? `Partner ${this.players.length}`;
    const player: LobbyPlayer = {
      id: `ai_${Math.random().toString(36).slice(2, 10)}`,
      name,
      token,
      ready: true,
      isHost: false,
      isAI: true,
      connected: true,
      difficulty,
      personality,
      sessionToken: '',
    };
    this.players.push(player);
    return player;
  }

  remove(playerId: string): string | null {
    const player = this.players.find((entry) => entry.id === playerId);
    if (!player) return 'Player not found';
    if (player.isHost) return 'The host cannot be removed';
    this.players = this.players.filter((entry) => entry.id !== playerId);
    return null;
  }
}
