export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const globalKey = globalThis as typeof globalThis & { __radarSchedule?: boolean };
  if (globalKey.__radarSchedule) return;
  globalKey.__radarSchedule = true;
  const { startDailyCheck } = await import("./lib/schedule");
  startDailyCheck();
}
