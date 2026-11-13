/**
 * Shared Date Formatting Utility for FTC Pulse
 * Implements Requirement UI #17:
 * "Reformat the dates of an event to look nicer (Month name Day - Month name Day, Year; e.g. April 28th - May 2nd, 2026 and do not display the time)"
 */

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}

export function formatNiceEventDateRange(
  dateStartStr?: string | null,
  dateEndStr?: string | null
): string {
  if (!dateStartStr) return '';

  // Strip any time portion by regex-parsing ^(\d{4})-(\d{2})-(\d{2})
  const startMatch = dateStartStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!startMatch) return dateStartStr;

  const startYear = parseInt(startMatch[1], 10);
  const startMonthIndex = parseInt(startMatch[2], 10) - 1;
  const startDay = parseInt(startMatch[3], 10);

  const startMonthName = MONTH_NAMES[startMonthIndex] ?? '';
  const startDayOrdinal = `${startDay}${getOrdinalSuffix(startDay)}`;

  if (!dateEndStr || dateEndStr === dateStartStr) {
    return `${startMonthName} ${startDayOrdinal}, ${startYear}`;
  }

  const endMatch = dateEndStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!endMatch) {
    return `${startMonthName} ${startDayOrdinal}, ${startYear}`;
  }

  const endYear = parseInt(endMatch[1], 10);
  const endMonthIndex = parseInt(endMatch[2], 10) - 1;
  const endDay = parseInt(endMatch[3], 10);

  const endMonthName = MONTH_NAMES[endMonthIndex] ?? '';
  const endDayOrdinal = `${endDay}${getOrdinalSuffix(endDay)}`;

  // If different years: "December 30th, 2025 - January 2nd, 2026"
  if (startYear !== endYear) {
    return `${startMonthName} ${startDayOrdinal}, ${startYear} - ${endMonthName} ${endDayOrdinal}, ${endYear}`;
  }

  // Same year: "April 28th - May 2nd, 2026" or "November 20th - November 22nd, 2026"
  return `${startMonthName} ${startDayOrdinal} - ${endMonthName} ${endDayOrdinal}, ${startYear}`;
}
