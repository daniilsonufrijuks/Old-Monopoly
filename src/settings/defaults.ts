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
  language: 'en',
  diceStyle: 'ivory',
  lighting: 'day',
  commentary: false,
  played: 0,
  won: 0,
  extraCardText: '',
  extraCardAmount: 50,
  port: 3000,
  startingCash: 1500,
  freeParkingPot: false,
  auctions: true,
  incomeTaxChoice: true,
  disconnectMode: 'autoplay',
};

export function speedMs(speed: Settings['turnSpeed'], reduced: boolean): number {
  if (reduced) return 40;
  if (speed === 'fast') return 70;
  if (speed === 'slow') return 760;
  if (speed === 'leisurely') return 460;
  if (speed === 'relaxed') return 280;
  return 160;
}

export function pauseMs(speed: Settings['turnSpeed'], reduced: boolean): number {
  if (reduced) return 0;
  if (speed === 'slow') return 1400;
  if (speed === 'leisurely') return 700;
  if (speed === 'relaxed') return 280;
  return 0;
}

export function cardHoldMs(speed: Settings['turnSpeed'], reduced: boolean): number {
  if (reduced) return 700;
  if (speed === 'slow') return 25000;
  if (speed === 'leisurely') return 14000;
  if (speed === 'relaxed') return 9000;
  if (speed === 'fast') return 2500;
  return 6000;
}
