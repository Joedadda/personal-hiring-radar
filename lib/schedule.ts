import { deskUrl } from "./desk-url";
import { listDeskUserIds, withDesk } from "./db";
import { runDailyCheck } from "./pipeline";

const ZONE = "Asia/Kolkata";

export function istParts(now = new Date()): { today: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return {
    today: `${value("year")}-${value("month")}-${value("day")}`,
    hour: Number(value("hour")),
  };
}

let running: Promise<void> | null = null;

export function startDailyChecks(appUrl?: string): Promise<void> {
  if (running) return running;
  const task = (async () => {
    const { today } = istParts();
    const ids = await listDeskUserIds();
    for (const userId of ids) {
      await withDesk(userId, () => runDailyCheck(appUrl || deskUrl(), today));
    }
  })();
  running = task.finally(() => {
    running = null;
  });
  return running;
}
