const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
  if (!match) throw new Error("日期格式应为 YYYY-MM-DD");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const epoch = Date.UTC(year, month - 1, day);
  const date = new Date(epoch);
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new Error("日期不存在");
  }
  return epoch;
}

function formatDate(epoch) {
  const date = new Date(epoch);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function getLocalToday(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function weekdayName(value) {
  return WEEKDAY_NAMES[new Date(parseDate(value)).getUTCDay()];
}

function addNaturalDays(value, amount) {
  const days = Number(amount);
  if (!Number.isInteger(days)) throw new Error("天数必须是整数");
  return formatDate(parseDate(value) + days * DAY_MS);
}

function isWeekendEpoch(epoch) {
  const day = new Date(epoch).getUTCDay();
  return day === 0 || day === 6;
}

function addWorkdays(value, amount) {
  const days = Number(amount);
  if (!Number.isInteger(days)) throw new Error("工作日天数必须是整数");
  let epoch = parseDate(value);
  let remaining = Math.abs(days);
  const direction = days < 0 ? -1 : 1;
  while (remaining > 0) {
    epoch += direction * DAY_MS;
    if (!isWeekendEpoch(epoch)) remaining -= 1;
  }
  return formatDate(epoch);
}

function getInterval(start, end) {
  const signedDays = Math.round((parseDate(end) - parseDate(start)) / DAY_MS);
  const days = Math.abs(signedDays);
  return {
    signedDays,
    days,
    inclusiveDays: days + 1,
    weeks: Math.floor(days / 7),
    remainingDays: days % 7,
    direction: signedDays === 0 ? "same" : signedDays > 0 ? "after" : "before",
    startWeekday: weekdayName(start),
    endWeekday: weekdayName(end)
  };
}

function getCountdown(target, today = getLocalToday()) {
  const signedDays = Math.round((parseDate(target) - parseDate(today)) / DAY_MS);
  return {
    signedDays,
    days: Math.abs(signedDays),
    state: signedDays === 0 ? "today" : signedDays > 0 ? "future" : "past",
    weekday: weekdayName(target)
  };
}

function buildIntervalCopy(start, end, result) {
  const relation = result.direction === "same"
    ? "是同一天"
    : `${end} 比 ${start} ${result.direction === "after" ? "晚" : "早"} ${result.days} 天`;
  return [
    "日期间隔",
    `${start} ${result.startWeekday} → ${end} ${result.endWeekday}`,
    relation,
    `相隔 ${result.days} 天，含首尾共 ${result.inclusiveDays} 天`,
    `即 ${result.weeks} 周 ${result.remainingDays} 天`
  ].join("\n");
}

function buildOffsetCopy(baseDate, amount, unit, resultDate) {
  const direction = amount < 0 ? "前" : "后";
  const label = unit === "workday" ? "工作日" : "自然日";
  return `${baseDate} ${Math.abs(amount)} 个${label}${direction}是 ${resultDate} ${weekdayName(resultDate)}`;
}

function buildCountdownCopy(target, today, result) {
  if (result.state === "today") return `${target} ${result.weekday} 就是今天`;
  return `${target} ${result.weekday}${result.state === "future" ? "距离今天还有" : "已经过去"} ${result.days} 天`;
}

module.exports = {
  DAY_MS,
  WEEKDAY_NAMES,
  addNaturalDays,
  addWorkdays,
  buildCountdownCopy,
  buildIntervalCopy,
  buildOffsetCopy,
  formatDate,
  getCountdown,
  getInterval,
  getLocalToday,
  isWeekendEpoch,
  parseDate,
  weekdayName
};
