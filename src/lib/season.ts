export function isHalloweenSeason(date: Date): boolean {
  const month = date.getMonth();
  const day = date.getDate();
  return month === 9 && day >= 5;
}