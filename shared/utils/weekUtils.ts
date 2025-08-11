// Utility functions for NFL week handling

export function getWeekLabel(week: number): string {
  if (week <= 0) {
    // Preseason weeks: -3 = PS Week 1, -2 = PS Week 2, -1 = PS Week 3, 0 = PS Week 4
    const psWeek = week + 4;
    return `PS Week ${psWeek}`;
  } else {
    // Regular season weeks: 1-18
    return `Week ${week}`;
  }
}

export function isPreseasonWeek(week: number): boolean {
  return week <= 0;
}

export function isRegularSeasonWeek(week: number): boolean {
  return week >= 1 && week <= 18;
}

export function getPreseasonWeekNumber(week: number): number {
  // Convert database week to preseason week number (1-4)
  return Math.abs(week - 1);
}

export function getSeasonType(week: number): 'preseason' | 'regular' {
  return week <= 0 ? 'preseason' : 'regular';
}