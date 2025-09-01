// Season and week utilities for dynamic season/week calculation

export function inferSeason(d = new Date()): number {
  // NFL season typically runs from August to February
  // Use current year if we're in NFL season months (Aug-Dec), 
  // otherwise use previous year (Jan-Jul)
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // 0-indexed to 1-indexed
  
  // NFL season starts in August and ends in February of next year
  return month >= 8 ? year : year - 1;
}

export function getCurrentWeekFromStoreOr1(storeWeek?: number): number {
  return Number.isFinite(storeWeek) && storeWeek! > 0 ? storeWeek! : 1;
}

export function getCurrentSeason(): number {
  return inferSeason();
}

export function getCurrentWeek(): number {
  // For now, default to week 1 - this can be enhanced with actual NFL schedule logic
  return 1;
}