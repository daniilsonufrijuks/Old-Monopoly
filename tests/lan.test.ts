import { afterEach, describe, expect, it } from 'vitest';
import { actingPlayerId } from '../src/game/engine/TurnManager';
import { LANClient } from '../src/multiplayer/client/LANClient';
import { LANServer } from '../src/multiplayer/server/LANServer';
import type { GameState } from '../src/game/types';

const servers: LANServer[] = [];
const clients: LANClient[] = [];

afterEach(async () => {
  clients.splice(0).forEach((client) => client.disconnect());
  await Promise.all(servers.splice(0).map((server) => server.close('test')));
});

async function table() {
  const server = new LANServer({ port: 0, hostName: 'Ada', aiDelayMs: 30, aiGraceMs: 0 });
  servers.push(server);
  const info = await server.start();
  const host = new LANClient();
  const guest = new LANClient();
  clients.push(host, guest);
  await host.connect(`http://127.0.0.1:${info.port}`);
  await guest.connect(`http://127.0.0.1:${info.port}`);
  const hostJoin = await host.join({ roomCode: info.roomCode, name: 'Ada', token: 'car', hostToken: info.hostToken });
  const guestJoin = await guest.join({ roomCode: info.roomCode, name: 'Bea', token: 'dog' });
  return { server, info, host, guest, hostJoin, guestJoin };
}

function nextState(client: LANClient): Promise<GameState> {
  return new Promise((resolve) => {
    const stop = client.onGame((payload) => {
      stop();
      resolve(payload.state);
    });
  });
}

describe('LAN table', () => {
  it('hosts, joins, rejects illegal actions, and reconnects', async () => {
    const { server, info, host, guest, hostJoin, guestJoin } = await table();
    expect(hostJoin.ok).toBe(true);
    expect(guestJoin.ok).toBe(true);
    const wrong = await guest.join({ roomCode: 'MONO000', name: 'Cal', token: 'hat' });
    expect(wrong.ok).toBe(false);

    const early = await host.start();
    expect(early.ok).toBe(false);
    const bothReady = new Promise<void>((resolve) => {
      const stop = host.onLobby((lobby) => {
        if (lobby.players.length === 2 && lobby.players.every((player) => player.ready)) {
          stop();
          resolve();
        }
      });
    });
    guest.ready(true);
    await bothReady;
    const started = nextState(host);
    const start = await host.start();
    expect(start.ok, start.error).toBe(true);
    const state = await started;
    expect(state.players).toHaveLength(2);
    expect(server.lobby().status).toBe('playing');

    const actor = actingPlayerId(state)!;
    const actorClient = actor === hostJoin.playerId ? host : guest;
    const other = actorClient === host ? guest : host;
    const rejected = await other.act('bad-1', { type: 'roll' });
    expect(rejected.ok).toBe(false);

    const seen = nextState(other);
    const rolled = await actorClient.act('roll-1', { type: 'roll' });
    expect(rolled.ok).toBe(true);
    const duplicate = await actorClient.act('roll-1', { type: 'roll' });
    expect(duplicate.duplicate).toBe(true);
    const after = await seen;
    expect(after.log.length).toBeGreaterThan(state.log.length);

    guest.disconnect();
    clients.splice(clients.indexOf(guest), 1);
    await new Promise((resolve) => setTimeout(resolve, 40));
    const returned = new LANClient();
    clients.push(returned);
    await returned.connect(`http://127.0.0.1:${info.port}`);
    const again = await returned.join({
      roomCode: info.roomCode,
      name: 'Bea',
      token: 'dog',
      sessionToken: guestJoin.sessionToken,
    });
    expect(again.ok).toBe(true);
    expect(again.playerId).toBe(guestJoin.playerId);
    const restored = server.gameState();
    expect(restored?.id).toBe(after.id);
    expect(restored?.players.find((player) => player.id === guestJoin.playerId)?.connected).toBe(true);
  });
});
