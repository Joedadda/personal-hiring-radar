import fs from "fs";
import path from "path";
import type { Database } from "./types";

const file = path.join(process.cwd(), "data", "radar.json");

function empty(): Database {
  return { profile: null, companies: [], jobs: [], digests: [], dailyScannedOn: null, dailyMailedOn: null };
}

export function readDb(): Database {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<Database>;
    const profile = parsed.profile
      ? { ...parsed.profile, email: parsed.profile.email || "" }
      : null;
    return {
      profile,
      companies: parsed.companies ?? [],
      jobs: parsed.jobs ?? [],
      digests: parsed.digests ?? [],
      dailyScannedOn: parsed.dailyScannedOn ?? null,
      dailyMailedOn: parsed.dailyMailedOn ?? null,
    };
  } catch {
    return empty();
  }
}

function writeDb(db: Database) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(db));
}

let chain: Promise<unknown> = Promise.resolve();

export function updateDb<T>(fn: (db: Database) => T): Promise<T> {
  const run = chain.then(() => {
    const db = readDb();
    const result = fn(db);
    writeDb(db);
    return result;
  });
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
