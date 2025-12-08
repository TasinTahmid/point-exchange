export function getDateOneYearFromNow() {
  const now = new Date();
  const oneYearLater = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate(), 23, 59, 59, 0);
  
  // Convert to UTC ISO string
  const year = oneYearLater.getUTCFullYear();
  const month = String(oneYearLater.getUTCMonth() + 1).padStart(2, '0');
  const day = String(oneYearLater.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}T23:59:59.000Z`;
}