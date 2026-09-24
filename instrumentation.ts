export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const globalKey = globalThis as typeof globalThis & { __radarSchedule?: boolean };
  if (globalKey.__radarSchedule) return;
  globalKey.__radarSchedule = true;
  const href = `file:///${process.cwd().replace(/\\/g, "/")}/instrumentation.node.mjs`;
  await import(/* webpackIgnore: true */ href);
}
