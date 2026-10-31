import type { Settings } from '../platform/types';

export const DEFAULT_SETTINGS: Settings = {
  playerName: 'Player',
  token: 'car',
  sound: true,
  volume: 0.7,
  reducedMotion: false,
  turnSpeed: 'normal',
  theme: 'classic',
  gameMode: 'classic',
  port: 3000,
  startingCash: 1500,
  freeParkingPot: false,
  auctions: true,
  incomeTaxChoice: true,
  disconnectMode: 'autoplay',
};

export function speedMs(speed: Settings['turnSpeed'], reduced: boolean): number {
  if (reduced) return 40;
  if (speed === 'fast') return 90;
  if (speed === 'relaxed') return 280;
  return 160;
}
