export type MarketSession = 'Sydney' | 'Tokyo' | 'London' | 'New York';

export interface SessionInfo {
  name: MarketSession;
  active: boolean;
  recommendedPairs: string[];
}

// UTC Times for sessions
const SESSIONS = {
  Sydney: { start: 22, end: 7, pairs: ['AUD', 'NZD'] },
  Tokyo: { start: 23, end: 8, pairs: ['JPY', 'AUD', 'NZD'] },
  London: { start: 8, end: 17, pairs: ['EUR', 'GBP', 'CHF'] },
  NewYork: { start: 13, end: 22, pairs: ['USD', 'CAD'] }
};

export function getCurrentSessions(): SessionInfo[] {
  const now = new Date();
  const currentHourUTC = now.getUTCHours();

  const isSessionActive = (start: number, end: number) => {
    if (start < end) {
      return currentHourUTC >= start && currentHourUTC < end;
    } else {
      // Crosses midnight
      return currentHourUTC >= start || currentHourUTC < end;
    }
  };

  return [
    {
      name: 'Sydney',
      active: isSessionActive(SESSIONS.Sydney.start, SESSIONS.Sydney.end),
      recommendedPairs: SESSIONS.Sydney.pairs
    },
    {
      name: 'Tokyo',
      active: isSessionActive(SESSIONS.Tokyo.start, SESSIONS.Tokyo.end),
      recommendedPairs: SESSIONS.Tokyo.pairs
    },
    {
      name: 'London',
      active: isSessionActive(SESSIONS.London.start, SESSIONS.London.end),
      recommendedPairs: SESSIONS.London.pairs
    },
    {
      name: 'New York',
      active: isSessionActive(SESSIONS.NewYork.start, SESSIONS.NewYork.end),
      recommendedPairs: SESSIONS.NewYork.pairs
    }
  ];
}

export function getActiveSessions(): SessionInfo[] {
  return getCurrentSessions().filter(s => s.active);
}

export function isPairRecommendedForCurrentSession(asset: string): boolean {
  const activeSessions = getActiveSessions();
  if (activeSessions.length === 0) return false;

  // Extract base and quote currencies (e.g., EURUSD -> EUR, USD)
  // Assuming asset format like EURUSD, GBPJPY, etc.
  const base = asset.substring(0, 3);
  const quote = asset.substring(3, 6);

  return activeSessions.some(session => 
    session.recommendedPairs.includes(base) || session.recommendedPairs.includes(quote)
  );
}

export function getSessionBoost(asset: string): number {
  if (isPairRecommendedForCurrentSession(asset)) {
    return 5; // +5% confidence boost for pairs active in current session
  }
  return -5; // -5% penalty for pairs not in active session
}
