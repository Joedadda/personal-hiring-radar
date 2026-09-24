const ZONE = "Asia/Kolkata";

function serverPort() {
  if (process.env.PORT) return process.env.PORT;
  const flag = process.argv.findIndex((arg) => arg === "--port" || arg === "-p");
  if (flag !== -1 && process.argv[flag + 1]) return process.argv[flag + 1];
  const eq = process.argv.find((arg) => arg.startsWith("--port="));
  if (eq) return eq.slice("--port=".length);
  return "3000";
}

function istHour(now = new Date()) {
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now).find((part) => part.type === "hour")?.value;
  return Number(hour);
}

let running = false;

async function tick() {
  if (istHour() < 16 || running) return;
  running = true;
  try {
    const response = await fetch(`http://127.0.0.1:${serverPort()}/api/daily-check`, { method: "POST" });
    if (!response.ok) {
      console.error(`Daily check failed: ${response.status}`);
    }
  } catch (error) {
    console.error(error);
  } finally {
    running = false;
  }
}

setInterval(tick, 60_000);
tick();
