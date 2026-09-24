import { deskUrl } from "./desk-url";
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

let running = false;

export function startDailyCheck() {
  const tick = () => {
    const { today, hour } = istParts();
    if (hour < 16 || running) return;
    running = true;
    void runDailyCheck(deskUrl(), today)
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        running = false;
      });
  };
  setInterval(tick, 60_000);
  tick();
}
