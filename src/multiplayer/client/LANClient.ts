import { io, type Socket } from 'socket.io-client';
import type { GameAction, GameEvent, GameState, TokenId } from '../../game/types';
import type { LobbySnapshot } from '../server/RoomManager';

export interface JoinResult {
  ok: boolean;
  error?: string;
  duplicate?: boolean;
  playerId?: string;
  sessionToken?: string;
}

type Handler<T> = (payload: T) => void;

export class LANClient {
  private socket: Socket | null = null;
  private welcomed = false;
  private session: { roomCode: string; name: string; token: TokenId; hostToken?: string; sessionToken?: string } | null = null;
  private lobbyHandlers = new Set<Handler<LobbySnapshot>>();
  private gameHandlers = new Set<Handler<{ state: GameState; events: GameEvent[]; actionId?: string }>>();
  private closedHandlers = new Set<Handler<{ reason: string }>>();
  private statusHandlers = new Set<Handler<string>>();

  connect(url: string): Promise<void> {
    this.disconnect();
    const socket = io(url, {
      reconnection: true,
      reconnectionAttempts: 12,
      timeout: 8000,
      transports: ['websocket', 'polling'],
    });
    this.socket = socket;
    socket.on('lobby:state', (lobby: LobbySnapshot) => this.lobbyHandlers.forEach((handler) => handler(lobby)));
    socket.on('game:state', (payload: { state: GameState; events: GameEvent[]; actionId?: string }) => {
      this.gameHandlers.forEach((handler) => handler(payload));
    });
    socket.on('room:closed', (payload: { reason: string }) => this.closedHandlers.forEach((handler) => handler(payload)));
    socket.on('game:error', (payload: { message: string }) => this.statusHandlers.forEach((handler) => handler(payload.message)));
    socket.on('connect', () => {
      this.statusHandlers.forEach((handler) => handler('Connected'));
      if (this.welcomed && this.session) void this.join(this.session);
    });
    socket.on('disconnect', (reason) => this.statusHandlers.forEach((handler) => handler(`Disconnected (${reason})`)));
    socket.on('connect_error', (error) => this.statusHandlers.forEach((handler) => handler(error.message || 'Could not reach the host')));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Timed out looking for the host. Check the IP address, port, and firewall.'));
      }, 8000);
      socket.once('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      socket.once('connect_error', (error) => {
        clearTimeout(timer);
        reject(new Error(error.message || 'Could not reach the host. If this is Windows, allow the app through the private firewall.'));
      });
    });
  }

  join(input: { roomCode: string; name: string; token: TokenId; hostToken?: string; sessionToken?: string }): Promise<JoinResult> {
    this.session = input;
    return this.emitAck('lobby:join', input).then((result) => {
      if (result.ok) {
        this.welcomed = true;
        this.session = { ...input, sessionToken: result.sessionToken ?? input.sessionToken };
      }
      return result;
    });
  }

  ready(ready: boolean): void {
    this.socket?.emit('lobby:ready', ready);
  }

  updateSettings(patch: unknown): void {
    this.socket?.emit('lobby:settings', patch);
  }

  addAi(difficulty: string, personality: string): void {
    this.socket?.emit('lobby:add-ai', { difficulty, personality });
  }

  kick(playerId: string): void {
    this.socket?.emit('lobby:kick', playerId);
  }

  start(): Promise<JoinResult> {
    return this.emitAck('lobby:start', undefined);
  }

  act(actionId: string, action: GameAction): Promise<JoinResult> {
    return this.emitAck('game:action', { actionId, action });
  }

  onLobby(handler: Handler<LobbySnapshot>): () => void {
    this.lobbyHandlers.add(handler);
    return () => this.lobbyHandlers.delete(handler);
  }

  onGame(handler: Handler<{ state: GameState; events: GameEvent[]; actionId?: string }>): () => void {
    this.gameHandlers.add(handler);
    return () => this.gameHandlers.delete(handler);
  }

  onClosed(handler: Handler<{ reason: string }>): () => void {
    this.closedHandlers.add(handler);
    return () => this.closedHandlers.delete(handler);
  }

  onStatus(handler: Handler<string>): () => void {
    this.statusHandlers.add(handler);
    return () => this.statusHandlers.delete(handler);
  }

  disconnect(): void {
    this.welcomed = false;
    this.session = null;
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  private emitAck(event: string, payload: unknown): Promise<JoinResult> {
    const socket = this.socket;
    if (!socket) return Promise.resolve({ ok: false, error: 'Not connected' });
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'The host did not answer' }), 8000);
      const finish = (result: JoinResult) => {
        clearTimeout(timer);
        resolve(result ?? { ok: false, error: 'Empty response' });
      };
      if (payload === undefined) socket.emit(event, finish);
      else socket.emit(event, payload, finish);
    });
  }
}
