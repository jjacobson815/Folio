import type { DateRange, DateValue } from "./types";

const MONTH_INDEX: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const SEASON_INDEX: Record<string, number> = { spring: 3, summer: 6, fall: 9, autumn: 9, winter: 12 };
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;
const SEASON = String.raw`(?:spring|summer|fall|autumn|winter)`;
const YEAR = String.raw`(?:19\d{2}|20\d{2})(?!\d)`;
const SHORT_YEAR = String.raw`'\d{2}(?!\d)`;
const MONTH_NUMBER = String.raw`(?:0?[1-9]|1[0-2])`;
const PRESENT = String.raw`(?:present|current(?:ly)?|now|today|ongoing|to\s+date|till\s+date|date)`;

const TOKEN = [
  String.raw`(?:${MONTH}|${SEASON})\s*,?\s*(?:${YEAR}|${SHORT_YEAR})`,
  String.raw`${YEAR}\s*[-/.]\s*${MONTH_NUMBER}(?:\s*[-/.]\s*(?:0?[1-9]|[12]\d|3[01]))?(?![\d])`,
  String.raw`${MONTH_NUMBER}\s*[/.]\s*${YEAR}`,
  String.raw`${MONTH_NUMBER}-${YEAR}`,
  YEAR,
].join("|");

const SEPARATOR = String.raw`\s*(?:-{1,2}|–|—|―|‒|to|until|till|through|thru|→|->|~)\s*`;

const RANGE_RE = new RegExp(String.raw`(?<![\w'])(${TOKEN})${SEPARATOR}(${TOKEN}|${PRESENT})(?![\w])`, "i");
const SINCE_RE = new RegExp(String.raw`(?<![\w])(?:since|from)\s+(${TOKEN})(?![\w])`, "i");
const OPEN_RANGE_RE = new RegExp(String.raw`(?<![\w'])(${TOKEN})\s*(?:-|–|—)\s*(?=$|[)\]|,])`, "i");
const SINGLE_RE = new RegExp(String.raw`(?<![\w'])(${TOKEN})(?![\w])`, "i");
const PRESENT_ONLY = new RegExp(String.raw`^${PRESENT}$`, "i");

export interface DateMatch {
  range: DateRange;
  /** Exact text that matched, so callers can remove it from the surrounding header. */
  text: string;
  index: number;
}

function expandShortYear(value: string): number {
  const twoDigits = Number(value.replace(/\D/g, ""));
  const pivot = (new Date().getFullYear() % 100) + 5;
  return twoDigits <= pivot ? 2000 + twoDigits : 1900 + twoDigits;
}

/** Parses a single date token ("Mar 2021", "2021-03-15", "03/2021", "Summer '19", "Present"). */
export function parseDateToken(input: string): DateValue | null {
  const raw = input.trim().replace(/[.,]$/, "");
  if (!raw) return null;
  if (PRESENT_ONLY.test(raw)) return { raw, year: null, month: null, isPresent: true };

  let match = /^([a-z]+)\.?\s*,?\s*('?\d{2}|\d{4})$/i.exec(raw);
  if (match) {
    const word = (match[1] ?? "").toLowerCase();
    const month = MONTH_INDEX[word.slice(0, 3)] ?? SEASON_INDEX[word] ?? null;
    const yearText = match[2] ?? "";
    const year = yearText.length === 4 ? Number(yearText) : expandShortYear(yearText);
    if (month !== null || SEASON_INDEX[word] !== undefined) return { raw, year, month, isPresent: false };
  }

  match = /^(\d{4})\s*[-/.]\s*(\d{1,2})(?:\s*[-/.]\s*\d{1,2})?(?:T.*)?$/.exec(raw);
  if (match) {
    const month = Number(match[2]);
    return { raw, year: Number(match[1]), month: month >= 1 && month <= 12 ? month : null, isPresent: false };
  }

  match = /^(\d{1,2})\s*[-/.]\s*(\d{4})$/.exec(raw);
  if (match) {
    const month = Number(match[1]);
    return { raw, year: Number(match[2]), month: month >= 1 && month <= 12 ? month : null, isPresent: false };
  }

  match = /^(\d{4})$/.exec(raw);
  if (match) return { raw, year: Number(match[1]), month: null, isPresent: false };

  return null;
}

/**
 * Finds the first date range in free text. Handles "Jan 2020 – Present", "2019-2021", "03/2018 to 06/2020",
 * "Since 2021", open ranges like "2022 –", and falls back to a lone date ("2016") when no range exists.
 */
export function findDateRange(text: string): DateMatch | null {
  const range = RANGE_RE.exec(text);
  if (range) {
    const start = parseDateToken(range[1] ?? "");
    const end = parseDateToken(range[2] ?? "");
    if (start || end) return { range: { start, end }, text: range[0], index: range.index };
  }

  const since = SINCE_RE.exec(text);
  if (since) {
    const start = parseDateToken(since[1] ?? "");
    if (start) {
      return { range: { start, end: { raw: "Present", year: null, month: null, isPresent: true } }, text: since[0], index: since.index };
    }
  }

  const open = OPEN_RANGE_RE.exec(text);
  if (open) {
    const start = parseDateToken(open[1] ?? "");
    if (start) {
      return { range: { start, end: { raw: "Present", year: null, month: null, isPresent: true } }, text: open[0], index: open.index };
    }
  }

  const single = SINGLE_RE.exec(text);
  if (single) {
    const start = parseDateToken(single[1] ?? "");
    if (start) return { range: { start, end: null }, text: single[0], index: single.index };
  }
  return null;
}

export function hasDateRange(text: string): boolean {
  return RANGE_RE.test(text) || SINCE_RE.test(text) || OPEN_RANGE_RE.test(text);
}

export function hasAnyDate(text: string): boolean {
  return hasDateRange(text) || SINGLE_RE.test(text);
}

/** Removes the matched date text (and any brackets that wrapped it) from a header string. */
export function removeDateText(text: string, match: DateMatch): string {
  let before = text.slice(0, match.index);
  let after = text.slice(match.index + match.text.length);
  if (/[([]\s*$/.test(before) && /^\s*[)\]]/.test(after)) {
    before = before.replace(/[([]\s*$/, "");
    after = after.replace(/^\s*[)\]]/, "");
  }
  before = before.replace(/\s+/g, " ").trim();
  after = after.replace(/\s+/g, " ").trim();
  // Keep a boundary where the date was, so column-aligned text ("Anna University   2016   GPA 8.9") still splits.
  if (before && after) return `${before} | ${after}`;
  return before || after;
}

/** Converts free-form input (JSON values, loose strings) into a DateValue. */
export function coerceDate(value: unknown): DateValue | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return parseDateToken(String(Math.trunc(value)));
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const direct = parseDateToken(trimmed);
  if (direct) return direct;
  const found = SINGLE_RE.exec(trimmed);
  return found ? parseDateToken(found[1] ?? "") : null;
}

export function formatDate(value: DateValue | null): string {
  if (!value) return "";
  if (value.isPresent) return "Present";
  const season = /^(spring|summer|fall|autumn|winter)\b/i.exec(value.raw);
  if (season && value.year !== null) return `${(season[1] ?? "").charAt(0).toUpperCase()}${(season[1] ?? "").slice(1).toLowerCase()} ${value.year}`;
  if (value.year !== null && value.month !== null) return `${MONTH_LABELS[value.month - 1] ?? ""} ${value.year}`.trim();
  if (value.year !== null) return String(value.year);
  return value.raw;
}

export function formatRange(range: DateRange | null): string {
  if (!range) return "";
  const start = formatDate(range.start);
  const end = formatDate(range.end);
  if (start && end && start !== end) return `${start} – ${end}`;
  return start || end;
}

function toMonthIndex(value: DateValue, fallbackMonth: number, now: Date): number | null {
  if (value.isPresent) return now.getFullYear() * 12 + now.getMonth();
  if (value.year === null) return null;
  return value.year * 12 + ((value.month ?? fallbackMonth) - 1);
}

/** Converts a range into a half-open [start, end) interval measured in absolute months. */
export function rangeToInterval(range: DateRange | null, now: Date = new Date()): [number, number] | null {
  if (!range?.start) return null;
  const start = toMonthIndex(range.start, 1, now);
  const endValue = range.end ?? (range.start.isPresent ? null : range.start);
  const end = endValue ? toMonthIndex(endValue, 12, now) : null;
  if (start === null || end === null || end < start) return null;
  return [start, end + 1];
}

export function formatDuration(months: number): string {
  if (months <= 0) return "";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years) parts.push(`${years} yr${years === 1 ? "" : "s"}`);
  if (rest) parts.push(`${rest} mo${rest === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export function rangeDuration(range: DateRange | null, now: Date = new Date()): string {
  const interval = rangeToInterval(range, now);
  return interval ? formatDuration(interval[1] - interval[0]) : "";
}

/** Total months covered by a set of ranges, merging overlaps so concurrent roles are not double counted. */
export function totalMonths(ranges: ReadonlyArray<DateRange | null>, now: Date = new Date()): number {
  const intervals = ranges
    .map((range) => rangeToInterval(range, now))
    .filter((interval): interval is [number, number] => interval !== null)
    .sort((a, b) => a[0] - b[0]);
  let total = 0;
  let current: [number, number] | null = null;
  for (const interval of intervals) {
    if (!current || interval[0] > current[1]) {
      if (current) total += current[1] - current[0];
      current = [interval[0], interval[1]];
    } else {
      current[1] = Math.max(current[1], interval[1]);
    }
  }
  if (current) total += current[1] - current[0];
  return total;
}

/** "2021-03" style ISO string used by the JSON Resume exporter. */
export function toIsoDate(value: DateValue | null): string | undefined {
  if (!value || value.isPresent || value.year === null) return undefined;
  return value.month ? `${value.year}-${String(value.month).padStart(2, "0")}` : String(value.year);
}
