import { Market, NaiveDate } from 'longbridge';
import { AuthorizationRequired } from './oauth.js';

// The displayed quotes and charts use regular sessions. Exchange-local clocks
// keep the US schedule aligned through daylight-saving changes.
const schedules = new Map([
  [Market.CN, { zone: 'Asia/Shanghai', hours: [[9 * 60 + 15, 11 * 60 + 30], [13 * 60, 15 * 60]] }],
  [Market.HK, { zone: 'Asia/Hong_Kong', hours: [[9 * 60, 12 * 60], [13 * 60, 16 * 60 + 10]], half: [[9 * 60, 12 * 60 + 10]] }],
  [Market.US, { zone: 'America/New_York', hours: [[9 * 60 + 30, 16 * 60]], half: [[9 * 60 + 30, 13 * 60]] }],
].map(([market, { zone, hours, half }]) => [market, {
  hours, half, clock: new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }),
}]));

export function marketOf(symbol) {
  const suffix = symbol.slice(symbol.lastIndexOf('.') + 1);
  if (suffix === 'US') return Market.US;
  if (suffix === 'HK') return Market.HK;
  if (suffix === 'SH' || suffix === 'SZ') return Market.CN;
  return Market.Unknown;
}

function dayFrom(iso, offset) {
  const date = new Date(iso + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function naiveDate(iso) {
  return new NaiveDate(...iso.split('-').map(Number));
}

export function createMarketCalendar(getContext) {
  const calendars = new Map();

  async function calendarFor(market, day, now) {
    const cached = calendars.get(market);
    if (cached && day >= cached.begin && day <= cached.end && now < cached.expires) return cached.promise;

    const entry = { begin: dayFrom(day, -14), end: dayFrom(day, 15), expires: Infinity };
    entry.promise = (async () => {
      const ctx = await getContext();
      if (typeof ctx.tradingDays !== 'function') return null;
      const resp = await ctx.tradingDays(market, naiveDate(entry.begin), naiveDate(entry.end));
      const halves = new Set(resp.halfTradingDays.map(String));
      const days = [...new Set([...resp.tradingDays.map(String), ...halves])].sort();
      return { days, halves };
    })().catch((error) => {
      // Preserve live polling when the broker's calendar is unavailable.
      if (error instanceof AuthorizationRequired) calendars.delete(market);
      else entry.expires = Date.now() + 300_000;
      return null;
    });
    calendars.set(market, entry);
    return entry.promise;
  }

  return async function closedKey(market, now = Date.now()) {
    const schedule = schedules.get(market);
    if (!schedule) return undefined;
    const parts = Object.fromEntries(schedule.clock.formatToParts(now).map(({ type, value }) => [type, value]));
    const day = parts.year + '-' + parts.month + '-' + parts.day;
    const minutes = 60 * Number(parts.hour) + Number(parts.minute);
    const calendar = await calendarFor(market, day, now);
    if (!calendar) return undefined;
    if (calendar.days.includes(day)) {
      const hours = calendar.halves.has(day) ? schedule.half ?? schedule.hours : schedule.hours;
      for (let index = 0; index < hours.length; index += 1) {
        const [start, end] = hours[index];
        if (minutes >= start && minutes < end) return undefined;
        if (index > 0 && minutes >= hours[index - 1][1] && minutes < start) return day + ':break';
      }
      if (minutes >= hours.at(-1)[1]) return day + ':close';
    }
    const previous = calendar.days.findLast((date) => date < day);
    return previous ? previous + ':close' : undefined;
  };
}
