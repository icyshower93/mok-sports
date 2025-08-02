export function generateJoinCode(): string {
  // Generate a 6-character alphanumeric code (avoiding confusing characters like 0, O, 1, I)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}