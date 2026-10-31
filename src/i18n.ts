export type Language = 'en' | 'ru';

const EN: Record<string, string> = {
  roll: 'Roll dice',
  rollJail: 'Roll for doubles',
  payJail: 'Pay $50',
  useCard: 'Use jail card',
  decline: 'Decline',
  declineAuction: 'Decline & auction',
  endTurn: 'End turn',
  trade: 'Offer trade',
  bankrupt: 'Go bankrupt',
  accept: 'Accept trade',
  reject: 'Reject trade',
  cancel: 'Cancel trade',
  counter: 'Counter',
  bid: 'Bid',
  pass: 'Pass',
  ok: 'OK',
  auction: 'Auction',
  highBid: 'High bid',
  bidding: 'Anyone still in may bid',
  seconds: 'seconds left',
  dashboard: 'Books',
  history: 'History',
  chat: 'Table talk',
  send: 'Send',
  worth: 'Worth',
  portfolio: 'Deeds',
  mortgages: 'Mortgages',
  rentIn: 'Rent in',
  rentOut: 'Rent out',
  risk: 'Risk',
  safe: 'Steady',
  watch: 'Watch the cash',
  danger: 'Near bankruptcy',
  futureRent: 'Future rent shares',
  spectator: 'Watch as a spectator',
  language: 'Language',
  lighting: 'Table light',
  day: 'Day',
  night: 'Night',
  dice: 'Dice',
  commentary: 'Voice commentary',
  houseCards: 'Extra Chance card',
};

const RU: Record<string, string> = {
  roll: 'Бросить кости',
  rollJail: 'Бросить на дубль',
  payJail: 'Заплатить $50',
  useCard: 'Карта выхода',
  decline: 'Отказаться',
  declineAuction: 'На аукцион',
  endTurn: 'Закончить ход',
  trade: 'Предложить обмен',
  bankrupt: 'Банкротство',
  accept: 'Принять обмен',
  reject: 'Отклонить',
  cancel: 'Отменить обмен',
  counter: 'Встречное',
  bid: 'Ставка',
  pass: 'Пас',
  ok: 'ОК',
  auction: 'Аукцион',
  highBid: 'Старшая ставка',
  bidding: 'Ставку может сделать любой, кто не спасовал',
  seconds: 'секунд',
  dashboard: 'Книги',
  history: 'История',
  chat: 'Разговор',
  send: 'Отправить',
  worth: 'Состояние',
  portfolio: 'Участки',
  mortgages: 'Залоги',
  rentIn: 'Рента получена',
  rentOut: 'Рента уплачена',
  risk: 'Риск',
  safe: 'Устойчиво',
  watch: 'Берегите кассу',
  danger: 'Близко к банкротству',
  futureRent: 'Доля будущей ренты',
  spectator: 'Смотреть как зритель',
  language: 'Язык',
  lighting: 'Свет стола',
  day: 'День',
  night: 'Ночь',
  dice: 'Кости',
  commentary: 'Голосовые реплики',
  houseCards: 'Своя карта Шанс',
};

const CARD_RU: Record<string, string> = {
  'ch-boardwalk': 'Отправляйтесь на Boardwalk.',
  'ch-go': 'Отправляйтесь на GO. Получите $200.',
  'ch-illinois': 'Отправляйтесь на Illinois Avenue.',
  'ch-st-charles': 'Отправляйтесь на St. Charles Place.',
  'ch-rr-1': 'К ближайшей железной дороге. Владельцу — двойная рента. Если свободна, можно купить.',
  'ch-rr-2': 'К ближайшей железной дороге. Владельцу — двойная рента. Если свободна, можно купить.',
  'ch-utility': 'К ближайшей коммунальной службе. Если занята, бросьте кости и заплатите десятикратную сумму.',
  'ch-dividend': 'Банк выплачивает дивиденд $50.',
  'ch-jailcard': 'Бесплатный выход из тюрьмы. Карту можно хранить или обменять.',
  'ch-back': 'Вернитесь на три клетки назад.',
  'ch-jail': 'Отправляйтесь в тюрьму. Не проходите GO. Не получайте $200.',
  'ch-repairs': 'Ремонт: $25 за дом, $100 за отель.',
  'ch-poor': 'Налог в пользу бедных: заплатите $15.',
  'ch-reading': 'Поездка на Reading Railroad. Если проходите GO, получите $200.',
  'ch-chairman': 'Вас избрали председателем. Заплатите каждому игроку $50.',
  'ch-loan': 'Строительный заём погашен. Получите $150.',
  'cc-go': 'Отправляйтесь на GO. Получите $200.',
  'cc-error': 'Ошибка банка в вашу пользу. Получите $200.',
  'cc-doctor': 'Гонорар врача. Заплатите $50.',
  'cc-stock': 'От продажи акций вы получаете $50.',
  'cc-jailcard': 'Бесплатный выход из тюрьмы. Карту можно хранить или обменять.',
  'cc-jail': 'Отправляйтесь в тюрьму. Не проходите GO. Не получайте $200.',
  'cc-opera': 'Вечер в опере. Соберите $50 с каждого игрока.',
  'cc-holiday': 'Отпускной фонд созрел. Получите $100.',
  'cc-refund': 'Возврат подоходного налога. Получите $20.',
  'cc-insurance': 'Страховка выплачена. Получите $100.',
  'cc-hospital': 'Больничные расходы: заплатите $100.',
  'cc-school': 'Школьный взнос: заплатите $50.',
  'cc-consult': 'Гонорар консультанта: получите $25.',
  'cc-repairs': 'Ремонт улиц: $40 за дом, $115 за отель.',
  'cc-beauty': 'Вторая премия конкурса красоты. Получите $10.',
  'cc-inherit': 'Вы получаете наследство $100.',
};

export function t(language: Language, key: string): string {
  const table = language === 'ru' ? RU : EN;
  return table[key] ?? EN[key] ?? key;
}

export function cardText(language: Language, cardId: string, fallback: string): string {
  if (language === 'ru' && CARD_RU[cardId]) return CARD_RU[cardId];
  return fallback;
}

export function speak(text: string, language: Language): void {
  if (typeof speechSynthesis === 'undefined' || !text) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'ru' ? 'ru-RU' : 'en-US';
  utterance.rate = 1;
  speechSynthesis.speak(utterance);
}
