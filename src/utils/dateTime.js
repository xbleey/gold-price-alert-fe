const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const ISO_DATE_TIME_PREFIX_PATTERN =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;
const NUMERIC_STRING_PATTERN = /^-?\d+$/;

const toTwoDigits = (value) => String(value).padStart(2, '0');

const formatFromDate = (date) => {
  const year = date.getFullYear();
  const month = toTwoDigits(date.getMonth() + 1);
  const day = toTwoDigits(date.getDate());
  const hours = toTwoDigits(date.getHours());
  const minutes = toTwoDigits(date.getMinutes());
  const seconds = toTwoDigits(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const normalizeTimestamp = (value) => {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : NaN;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Math.abs(value) < 1e12) {
      return value * 1000;
    }
    return value;
  }

  if (typeof value !== 'string') {
    return NaN;
  }

  const text = value.trim();
  if (!text) {
    return NaN;
  }

  if (NUMERIC_STRING_PATTERN.test(text)) {
    const number = Number(text);
    if (!Number.isFinite(number)) {
      return NaN;
    }
    if (Math.abs(number) < 1e12) {
      return number * 1000;
    }
    return number;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : NaN;
};

export const formatDateTimeValue = (value) => {
  if (value == null) {
    return '-';
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) {
      return '-';
    }
    if (DATE_TIME_PATTERN.test(text)) {
      return text;
    }
    const normalizedIso = text.match(ISO_DATE_TIME_PREFIX_PATTERN);
    if (normalizedIso) {
      return `${normalizedIso[1]} ${normalizedIso[2]}`;
    }
  }

  const timestamp = normalizeTimestamp(value);
  if (!Number.isFinite(timestamp)) {
    return '-';
  }
  return formatFromDate(new Date(timestamp));
};
