import type { CardDef } from '../types';

export const CARDS: CardDef[] = [
  { id: 'ch-boardwalk', deck: 'chance', text: 'Advance to Boardwalk.', action: { type: 'advance', space: 39 } },
  { id: 'ch-go', deck: 'chance', text: 'Advance to GO. Collect $200.', action: { type: 'advance', space: 0 } },
  { id: 'ch-illinois', deck: 'chance', text: 'Advance to Illinois Avenue.', action: { type: 'advance', space: 24 } },
  { id: 'ch-st-charles', deck: 'chance', text: 'Advance to St. Charles Place.', action: { type: 'advance', space: 11 } },
  { id: 'ch-rr-1', deck: 'chance', text: 'Advance to the nearest Railroad and pay the owner twice the rental. If unowned, you may buy it.', action: { type: 'advance-nearest', target: 'railroad' } },
  { id: 'ch-rr-2', deck: 'chance', text: 'Advance to the nearest Railroad and pay the owner twice the rental. If unowned, you may buy it.', action: { type: 'advance-nearest', target: 'railroad' } },
  { id: 'ch-utility', deck: 'chance', text: 'Advance to the nearest Utility. If owned, throw the dice and pay the owner ten times the amount thrown.', action: { type: 'advance-nearest', target: 'utility' } },
  { id: 'ch-dividend', deck: 'chance', text: 'Bank pays you a dividend of $50.', action: { type: 'cash', amount: 50 } },
  { id: 'ch-jailcard', deck: 'chance', text: 'Get Out of Jail Free. This card may be kept until needed or traded.', action: { type: 'jail-card' } },
  { id: 'ch-back', deck: 'chance', text: 'Go back three spaces.', action: { type: 'go-back', spaces: 3 } },
  { id: 'ch-jail', deck: 'chance', text: 'Go directly to Jail. Do not pass GO. Do not collect $200.', action: { type: 'jail' } },
  { id: 'ch-repairs', deck: 'chance', text: 'Make general repairs on all your property: $25 per house, $100 per hotel.', action: { type: 'repairs', perHouse: 25, perHotel: 100 } },
  { id: 'ch-poor', deck: 'chance', text: 'Pay poor tax of $15.', action: { type: 'cash', amount: -15 } },
  { id: 'ch-reading', deck: 'chance', text: 'Take a trip to Reading Railroad. If you pass GO, collect $200.', action: { type: 'advance', space: 5 } },
  { id: 'ch-chairman', deck: 'chance', text: 'You have been elected Chairman of the Board. Pay each player $50.', action: { type: 'pay-each', amount: 50 } },
  { id: 'ch-loan', deck: 'chance', text: 'Your building loan matures. Collect $150.', action: { type: 'cash', amount: 150 } },
  { id: 'cc-go', deck: 'community', text: 'Advance to GO. Collect $200.', action: { type: 'advance', space: 0 } },
  { id: 'cc-error', deck: 'community', text: 'Bank error in your favor. Collect $200.', action: { type: 'cash', amount: 200 } },
  { id: 'cc-doctor', deck: 'community', text: "Doctor's fee. Pay $50.", action: { type: 'cash', amount: -50 } },
  { id: 'cc-stock', deck: 'community', text: 'From sale of stock you get $50.', action: { type: 'cash', amount: 50 } },
  { id: 'cc-jailcard', deck: 'community', text: 'Get Out of Jail Free. This card may be kept until needed or traded.', action: { type: 'jail-card' } },
  { id: 'cc-jail', deck: 'community', text: 'Go directly to Jail. Do not pass GO. Do not collect $200.', action: { type: 'jail' } },
  { id: 'cc-opera', deck: 'community', text: 'Grand Opera Night. Collect $50 from every player.', action: { type: 'collect-each', amount: 50 } },
  { id: 'cc-holiday', deck: 'community', text: 'Holiday fund matures. Collect $100.', action: { type: 'cash', amount: 100 } },
  { id: 'cc-refund', deck: 'community', text: 'Income tax refund. Collect $20.', action: { type: 'cash', amount: 20 } },
  { id: 'cc-insurance', deck: 'community', text: 'Life insurance matures. Collect $100.', action: { type: 'cash', amount: 100 } },
  { id: 'cc-hospital', deck: 'community', text: 'Pay hospital fees of $100.', action: { type: 'cash', amount: -100 } },
  { id: 'cc-school', deck: 'community', text: 'Pay school fees of $50.', action: { type: 'cash', amount: -50 } },
  { id: 'cc-consult', deck: 'community', text: 'Receive $25 consultancy fee.', action: { type: 'cash', amount: 25 } },
  { id: 'cc-repairs', deck: 'community', text: 'You are assessed for street repairs: $40 per house, $115 per hotel.', action: { type: 'repairs', perHouse: 40, perHotel: 115 } },
  { id: 'cc-beauty', deck: 'community', text: 'You have won second prize in a beauty contest. Collect $10.', action: { type: 'cash', amount: 10 } },
  { id: 'cc-inherit', deck: 'community', text: 'You inherit $100.', action: { type: 'cash', amount: 100 } },
];

export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARDS.map((card) => [card.id, card]));

export function deckIds(deck: 'chance' | 'community'): string[] {
  return CARDS.filter((card) => card.deck === deck).map((card) => card.id);
}
