import { randomBytes } from 'node:crypto';
import { createServer, type Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { chooseAction, fallbackAction } from '../../game/ai/AIController';
import { GameEngine } from '../../game/engine/GameEngine';
import { actingPlayerId } from '../../game/engine/TurnManager';
import type { GameEvent, GameRules, GameState } from '../../game/types';
import { aiSchema, gameActionSchema, joinSchema, rulesPatchSchema } from '../protocol';
import { RoomManager, type LobbySnapshot } from './RoomManager';

export interface LANServerOptions {
  port: number;
  hostName: string;
  rules?: Partial<GameRules>;
  aiDelayMs?: number;
  aiGraceMs?: number;
  onState?: (state: GameState, sessions: Record<string, string>) => void;
}

interface Ack {
  ok: boolean;
  error?: string;
  duplicate?: boolean;
  playerId?: string;
  sessionToken?: string;
}

export class LANServer {
  readonly room: RoomManager;
  private http: HttpServer | null = null;
  private io: Server | null = null;
  private engine: GameEngine | null = null;
  private socketByPlayer = new Map<string, string>();
  private playerBySocket = new Map<string, string>();
  private recentActionIds = new Set<string>();
  private disconnectedAt = new Map<string, number>();
  private aiTimer: NodeJS.Timeout | null = null;
  private rates = new Map<string, number[]>();
  port = 0;
  private closed = false;

  constructor(private readonly options: LANServerOptions) {
    this.room = new RoomManager(options.hostName, randomBytes(24).toString('hex'), options.rules);
  }

  get hostToken(): string {
    return this.room.hostToken;
  }

  async start(): Promise<{ port: number; roomCode: string; hostToken: string }> {
    let lastError: unknown;
    for (let port = this.options.port; port < this.options.port + 12; port += 1) {
      try {
        await this.listen(port);
        return { port: this.port, roomCode: this.room.roomCode, hostToken: this.room.hostToken };
      } catch (error) {
        lastError = error;
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'EADDRINUSE') break;
      }
    }
    const code = (lastError as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'EACCES' || code === 'EPERM') {
      throw new Error('The operating system blocked the table. Allow Classic Monopoly through the firewall on private networks, then host again.');
    }
    throw new Error(code === 'EADDRINUSE' ? 'Every nearby port is already in use.' : 'The LAN table could not start.');
  }

  async close(reason = 'The host closed the table.'): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.aiTimer) clearTimeout(this.aiTimer);
    this.room.status = 'closed';
    this.room.closedReason = reason;
    this.io?.emit('room:closed', { reason });
    await new Promise<void>((resolve) => this.io?.close(() => resolve()));
    await new Promise<void>((resolve) => this.http?.close(() => resolve()));
  }

  lobby(): LobbySnapshot {
    return this.room.snapshot();
  }

  gameState(): GameState | null {
    return this.engine ? this.decorate(this.engine.getState()) : null;
  }

  restore(state: GameState, sessions: Record<string, string> = {}): void {
    this.engine = new GameEngine(structuredClone(state));
    this.room.status = 'playing';
    this.room.rules = { ...state.rules };
    this.room.players = state.players.map((player) => ({
      id: player.id,
      name: player.name,
      token: player.token,
      ready: true,
      isHost: player.isHost,
      isAI: player.isAI,
      connected: player.isAI,
      difficulty: player.difficulty,
      personality: player.personality,
      sessionToken: sessions[player.id] || (player.isAI ? '' : randomBytes(24).toString('hex')),
    }));
    this.emitLobby();
    this.emitGame();
  }

  private listen(port: number): Promise<void> {
    const http = createServer();
    const io = new Server(http, {
      cors: { origin: true, methods: ['GET', 'POST'] },
      maxHttpBufferSize: 1_000_000,
      pingTimeout: 20000,
      pingInterval: 10000,
      connectTimeout: 8000,
    });
    this.http = http;
    this.io = io;
    io.on('connection', (socket) => this.onConnection(socket));
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => {
        http.close();
        reject(error);
      };
      http.once('error', onError);
      http.listen(port, '0.0.0.0', () => {
        http.off('error', onError);
        const address = http.address();
        this.port = typeof address === 'object' && address ? address.port : port;
        resolve();
      });
    });
  }

  private onConnection(socket: Socket): void {
    const fail = (ack: ((result: Ack) => void) | undefined, error: string) => {
      if (typeof ack === 'function') ack({ ok: false, error });
      else socket.emit('game:error', { message: error });
    };

    socket.on('lobby:join', (raw: unknown, ack?: (result: Ack) => void) => {
      if (!this.allow(socket.id)) return fail(ack, 'Too many requests');
      const parsed = joinSchema.safeParse(raw);
      if (!parsed.success) return fail(ack, 'Invalid join request');
      if (parsed.data.roomCode !== this.room.roomCode) return fail(ack, 'That room code does not match this table');
      if (this.room.status === 'closed') return fail(ack, 'The host closed this table');

      const bySession = parsed.data.sessionToken
        ? this.room.players.find((player) => player.sessionToken && player.sessionToken === parsed.data.sessionToken)
        : undefined;
      if (bySession) {
        this.attach(socket, bySession.id);
        bySession.connected = true;
        this.disconnectedAt.delete(bySession.id);
        this.emitLobby();
        this.emitGame();
        ack?.({ ok: true, playerId: bySession.id, sessionToken: bySession.sessionToken });
        this.scheduleAi();
        return;
      }

      if (parsed.data.hostToken && parsed.data.hostToken === this.room.hostToken) {
        const host = this.room.players.find((player) => player.isHost);
        if (host) {
          this.attach(socket, host.id);
          host.connected = true;
          this.disconnectedAt.delete(host.id);
          this.emitLobby();
          this.emitGame();
          ack?.({ ok: true, playerId: host.id, sessionToken: host.sessionToken });
          return;
        }
      }

      if (this.room.status === 'playing') {
        const seat = this.room.players.find((player) => !player.isAI && !player.connected && player.name.toLowerCase() === parsed.data.name.toLowerCase());
        if (!seat) return fail(ack, 'This match has started. Rejoin with the same name if your seat is still open.');
        seat.sessionToken = randomBytes(24).toString('hex');
        seat.connected = true;
        this.disconnectedAt.delete(seat.id);
        this.attach(socket, seat.id);
        this.emitLobby();
        this.emitGame();
        ack?.({ ok: true, playerId: seat.id, sessionToken: seat.sessionToken });
        return;
      }

      const isHost = parsed.data.hostToken === this.room.hostToken;
      const sessionToken = randomBytes(24).toString('hex');
      const created = this.room.addHuman({ name: parsed.data.name, token: parsed.data.token, isHost, sessionToken });
      if (typeof created === 'string') return fail(ack, created);
      this.attach(socket, created.id);
      this.emitLobby();
      ack?.({ ok: true, playerId: created.id, sessionToken });
    });

    socket.on('lobby:ready', (ready: unknown) => {
      const player = this.player(socket.id);
      if (!player || this.room.status !== 'lobby') return;
      player.ready = Boolean(ready);
      this.emitLobby();
    });

    socket.on('lobby:settings', (raw: unknown) => {
      const player = this.player(socket.id);
      if (!player?.isHost || this.room.status !== 'lobby') return;
      const parsed = rulesPatchSchema.safeParse(raw);
      if (!parsed.success) return;
      this.room.rules = { ...this.room.rules, ...parsed.data };
      this.emitLobby();
    });

    socket.on('lobby:add-ai', (raw: unknown) => {
      const player = this.player(socket.id);
      if (!player?.isHost) return;
      const parsed = aiSchema.safeParse(raw);
      if (!parsed.success) return;
      const result = this.room.addAi(parsed.data.difficulty, parsed.data.personality);
      if (typeof result !== 'string') this.emitLobby();
    });

    socket.on('lobby:kick', (playerId: unknown) => {
      const player = this.player(socket.id);
      if (!player?.isHost || typeof playerId !== 'string') return;
      const error = this.room.remove(playerId);
      if (error) return;
      const socketId = this.socketByPlayer.get(playerId);
      if (socketId) this.io?.sockets.sockets.get(socketId)?.disconnect(true);
      this.socketByPlayer.delete(playerId);
      this.emitLobby();
    });

    socket.on('lobby:start', (ack?: (result: Ack) => void) => {
      const player = this.player(socket.id);
      if (!player?.isHost) return fail(ack, 'Only the host can start');
      if (this.room.status !== 'lobby') return fail(ack, 'The match has already started');
      if (this.room.players.length < 2) return fail(ack, 'Invite at least one more player');
      if (this.room.players.some((entry) => !entry.isAI && entry.connected && !entry.ready && !entry.isHost)) {
        return fail(ack, 'Wait until every player is ready');
      }
      this.engine = GameEngine.create({
        mode: 'lan',
        rules: this.room.rules,
        players: this.room.players.map((entry) => ({
          id: entry.id,
          name: entry.name,
          token: entry.token,
          isAI: entry.isAI,
          isHost: entry.isHost,
          difficulty: entry.difficulty,
          personality: entry.personality,
        })),
      });
      this.room.status = 'playing';
      this.emitLobby();
      this.push(this.engine.getState(), [], undefined);
      ack?.({ ok: true });
      this.scheduleAi();
    });

    socket.on('game:action', (raw: unknown, ack?: (result: Ack) => void) => {
      if (!this.allow(socket.id)) return fail(ack, 'Too many requests');
      const player = this.player(socket.id);
      if (!player || !this.engine) return fail(ack, 'You are not in a match');
      const body = raw as { actionId?: unknown; action?: unknown };
      if (typeof body?.actionId !== 'string' || body.actionId.length > 80) return fail(ack, 'Invalid action');
      if (this.recentActionIds.has(body.actionId)) return ack?.({ ok: true, duplicate: true });
      const parsed = gameActionSchema.safeParse(body.action);
      if (!parsed.success) return fail(ack, 'That action was not understood');
      const result = this.engine.apply(player.id, parsed.data);
      if (!result.ok) return fail(ack, result.error ?? 'Illegal action');
      this.remember(body.actionId);
      this.push(result.state, result.events, body.actionId);
      ack?.({ ok: true });
      this.scheduleAi();
    });

    socket.on('disconnect', () => {
      const playerId = this.playerBySocket.get(socket.id);
      this.playerBySocket.delete(socket.id);
      if (!playerId || this.socketByPlayer.get(playerId) !== socket.id) return;
      this.socketByPlayer.delete(playerId);
      const player = this.room.players.find((entry) => entry.id === playerId);
      if (!player) return;
      player.connected = false;
      if (!player.isHost) player.ready = false;
      this.disconnectedAt.set(playerId, Date.now());
      this.emitLobby();
      this.emitGame();
      this.scheduleAi();
    });
  }

  private attach(socket: { id: string; disconnect: (close?: boolean) => void }, playerId: string): void {
    const previous = this.socketByPlayer.get(playerId);
    if (previous && previous !== socket.id) {
      this.io?.sockets.sockets.get(previous)?.disconnect(true);
      this.playerBySocket.delete(previous);
    }
    this.socketByPlayer.set(playerId, socket.id);
    this.playerBySocket.set(socket.id, playerId);
  }

  private player(socketId: string) {
    const playerId = this.playerBySocket.get(socketId);
    return this.room.players.find((player) => player.id === playerId);
  }

  private allow(socketId: string): boolean {
    const now = Date.now();
    const recent = (this.rates.get(socketId) ?? []).filter((stamp) => now - stamp < 1000);
    if (recent.length >= 12) return false;
    recent.push(now);
    this.rates.set(socketId, recent);
    return true;
  }

  private remember(actionId: string): void {
    this.recentActionIds.add(actionId);
    if (this.recentActionIds.size > 200) {
      const first = this.recentActionIds.values().next().value as string | undefined;
      if (first) this.recentActionIds.delete(first);
    }
  }

  private decorate(state: GameState): GameState {
    const copy = structuredClone(state);
    for (const player of copy.players) {
      const lobby = this.room.players.find((entry) => entry.id === player.id);
      if (lobby && !player.isAI) player.connected = lobby.connected;
    }
    return copy;
  }

  private emitLobby(): void {
    this.io?.emit('lobby:state', this.room.snapshot());
  }

  private emitGame(): void {
    if (!this.engine || this.room.status !== 'playing') return;
    this.io?.emit('game:state', { state: this.decorate(this.engine.getState()), events: [] });
  }

  private push(state: GameState, events: GameEvent[], actionId?: string): void {
    const decorated = this.decorate(state);
    this.io?.emit('game:state', { state: decorated, events, actionId });
    const sessions = Object.fromEntries(this.room.players.filter((player) => player.sessionToken).map((player) => [player.id, player.sessionToken]));
    this.options.onState?.(decorated, sessions);
  }

  private scheduleAi(): void {
    if (this.aiTimer || !this.engine || this.room.status !== 'playing') return;
    const state = this.engine.getState();
    if (state.phase.kind === 'ended') return;
    const actor = actingPlayerId(state);
    if (!actor) return;
    const lobby = this.room.players.find((player) => player.id === actor);
    const enginePlayer = state.players.find((player) => player.id === actor);
    if (!lobby || !enginePlayer) return;
    const awayFor = Date.now() - (this.disconnectedAt.get(actor) ?? Date.now());
    const cover = !lobby.isAI && !lobby.connected && this.room.rules.disconnectMode === 'autoplay' && awayFor >= (this.options.aiGraceMs ?? 15000);
    if (!lobby.isAI && !enginePlayer.isAI && !cover) return;
    this.aiTimer = setTimeout(() => {
      this.aiTimer = null;
      this.runAi(actor);
    }, this.options.aiDelayMs ?? 450);
  }

  private runAi(expectedActor: string): void {
    if (!this.engine || this.closed) return;
    const state = this.engine.getState();
    const actor = actingPlayerId(state);
    if (!actor || actor !== expectedActor || state.phase.kind === 'ended') return;
    const action = chooseAction(state, actor);
    let result = this.engine.apply(actor, action);
    if (!result.ok) result = this.engine.apply(actor, fallbackAction(state, actor));
    if (result.ok) this.push(result.state, result.events);
    this.scheduleAi();
  }
}
