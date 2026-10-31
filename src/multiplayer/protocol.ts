import { z } from 'zod';
import { TOKEN_IDS } from '../game/types';

export const PROTOCOL_VERSION = 1;
export const DISCOVERY_PORT = 47390;
export const DISCOVERY_MAGIC = 'MONOPOLY_LAN_V1';
export const DEFAULT_PORT = 3000;

export const gameActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('roll') }),
  z.object({ type: z.literal('buy') }),
  z.object({ type: z.literal('decline') }),
  z.object({ type: z.literal('pay-tax'), method: z.enum(['flat', 'percent']) }),
  z.object({ type: z.literal('auction-bid'), amount: z.number().int().positive().max(100000) }),
  z.object({ type: z.literal('auction-pass') }),
  z.object({ type: z.literal('auction-close') }),
  z.object({ type: z.literal('end-turn') }),
  z.object({ type: z.literal('pay-jail') }),
  z.object({ type: z.literal('use-jail-card') }),
  z.object({ type: z.literal('build'), propertyId: z.string().min(1).max(40) }),
  z.object({ type: z.literal('sell-building'), propertyId: z.string().min(1).max(40) }),
  z.object({ type: z.literal('mortgage'), propertyId: z.string().min(1).max(40) }),
  z.object({ type: z.literal('unmortgage'), propertyId: z.string().min(1).max(40) }),
  z.object({
    type: z.literal('propose-trade'),
    toId: z.string().min(1).max(40),
    offerCash: z.number().int().min(0).max(100000),
    requestCash: z.number().int().min(0).max(100000),
    offerProperties: z.array(z.string().max(40)).max(28),
    requestProperties: z.array(z.string().max(40)).max(28),
    offerCards: z.number().int().min(0).max(2),
    requestCards: z.number().int().min(0).max(2),
    rentShareTurns: z.number().int().min(0).max(6).optional(),
  }),
  z.object({
    type: z.literal('counter-trade'),
    offerCash: z.number().int().min(0).max(100000),
    requestCash: z.number().int().min(0).max(100000),
    offerProperties: z.array(z.string().max(40)).max(28),
    requestProperties: z.array(z.string().max(40)).max(28),
    offerCards: z.number().int().min(0).max(2),
    requestCards: z.number().int().min(0).max(2),
    rentShareTurns: z.number().int().min(0).max(6).optional(),
  }),
  z.object({ type: z.literal('accept-trade') }),
  z.object({ type: z.literal('reject-trade') }),
  z.object({ type: z.literal('cancel-trade') }),
  z.object({ type: z.literal('settle-debt') }),
  z.object({ type: z.literal('declare-bankruptcy') }),
]);

export const joinSchema = z.object({
  roomCode: z.string().regex(/^MONO\d{3}$/),
  name: z.string().min(1).max(16),
  token: z.enum(TOKEN_IDS),
  hostToken: z.string().min(10).max(128).optional(),
  sessionToken: z.string().min(10).max(128).optional(),
  spectator: z.boolean().optional(),
});

export const rulesPatchSchema = z.object({
  modeId: z.enum(['classic', 'short', 'speed', 'tycoon', 'friendly', 'cutthroat']).optional(),
  startingCash: z.number().int().min(500).max(3000).optional(),
  goSalary: z.number().int().min(100).max(500).optional(),
  landOnGoDouble: z.boolean().optional(),
  turnLimit: z.number().int().min(0).max(200).optional(),
  houseCostFactor: z.union([z.literal(0.5), z.literal(1)]).optional(),
  freeParkingPot: z.boolean().optional(),
  auctions: z.boolean().optional(),
  incomeTax: z.number().int().min(0).max(500).optional(),
  luxuryTax: z.number().int().min(0).max(500).optional(),
  incomeTaxChoice: z.boolean().optional(),
  auctionSeconds: z.number().int().min(0).max(60).optional(),
  disconnectMode: z.enum(['wait', 'autoplay']).optional(),
}).strict();

export const aiSchema = z.object({
  difficulty: z.enum(['easy', 'normal', 'hard']),
  personality: z.enum(['cautious', 'aggressive', 'trader', 'tycoon', 'opportunist']),
});

export const discoverySchema = z.object({
  magic: z.literal(DISCOVERY_MAGIC),
  version: z.literal(PROTOCOL_VERSION),
  roomCode: z.string(),
  roomName: z.string(),
  hostName: z.string(),
  port: z.number().int(),
  players: z.number().int(),
  maxPlayers: z.number().int(),
});

export type DiscoveryBeacon = z.infer<typeof discoverySchema>;

export function cleanName(name: string): string | null {
  const cleaned = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);
  return cleaned.length ? cleaned : null;
}

export function makeRoomCode(): string {
  return `MONO${100 + Math.floor(Math.random() * 900)}`;
}

export function isPrivateIPv4(address: string): boolean {
  return (
    address.startsWith('10.') ||
    address.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}
