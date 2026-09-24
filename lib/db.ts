import { AsyncLocalStorage } from "async_hooks";
import type { Company, Database, DigestRecord, Profile } from "./types";
import { ensureSchema, getPool } from "./postgres";

function empty(): Database {
  return {
    profiles: [],
    activeProfileId: null,
    companies: [],
    jobs: [],
    linkedinSignals: [],
    digests: [],
    dailyScannedOn: null,
    dailyMailedOn: null,
  };
}

type Stored = Partial<Database> & { profile?: (Omit<Profile, "id" | "name"> & { id?: string; name?: string }) | null };

function migrate(parsed: Stored): Database {
  const legacy = parsed.profile;
  const profiles: Profile[] = parsed.profiles
    ? parsed.profiles.map((profile) => ({
        ...profile,
        name: profile.name || profile.domain,
        email: profile.email || "",
      }))
    : legacy
      ? [
          {
            id: legacy.id || crypto.randomUUID(),
            name: legacy.name || legacy.domain,
            domain: legacy.domain,
            preferredRoles: legacy.preferredRoles,
            levels: legacy.levels,
            keywords: legacy.keywords,
            email: legacy.email || "",
            createdAt: legacy.createdAt,
            updatedAt: legacy.updatedAt,
          },
        ]
      : [];
  const fallbackId = profiles[0]?.id || "";
  const companies = (parsed.companies ?? []).map((company) => ({
    ...company,
    profileId: company.profileId || fallbackId,
  }));
  const digests = (parsed.digests ?? []).map((digest) => ({
    ...digest,
    profileId: digest.profileId || fallbackId,
  }));
  const active =
    parsed.activeProfileId && profiles.some((profile) => profile.id === parsed.activeProfileId)
      ? parsed.activeProfileId
      : profiles[0]?.id || null;
  return {
    profiles,
    activeProfileId: active,
    companies,
    jobs: parsed.jobs ?? [],
    linkedinSignals: parsed.linkedinSignals ?? [],
    digests,
    dailyScannedOn: parsed.dailyScannedOn ?? null,
    dailyMailedOn: parsed.dailyMailedOn ?? null,
  };
}

type Slot = {
  userId: string;
  db: Database;
  pending: Promise<void>;
};

const slots = new Map<string, Promise<Slot>>();
const current = new AsyncLocalStorage<Slot>();

async function loadSlot(userId: string): Promise<Slot> {
  await ensureSchema();
  const client = getPool();
  const existing = await client.query<{ data: Stored }>("SELECT data FROM radar_desks WHERE user_id = $1", [userId]);
  if (existing.rows[0]) return { userId, db: migrate(existing.rows[0].data), pending: Promise.resolve() };
  const fresh = empty();
  await client.query("INSERT INTO radar_desks (user_id, data) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO NOTHING", [
    userId,
    JSON.stringify(fresh),
  ]);
  const stored = await client.query<{ data: Stored }>("SELECT data FROM radar_desks WHERE user_id = $1", [userId]);
  return { userId, db: migrate(stored.rows[0]?.data ?? fresh), pending: Promise.resolve() };
}

function slotFor(userId: string): Promise<Slot> {
  let pending = slots.get(userId);
  if (!pending) {
    pending = loadSlot(userId);
    slots.set(userId, pending);
  }
  return pending;
}

function requireSlot(): Slot {
  const slot = current.getStore();
  if (!slot) throw new Error("Desk is not open for this request.");
  return slot;
}

export function readDb(): Database {
  return requireSlot().db;
}

export function updateDb<T>(fn: (db: Database) => T): Promise<T> {
  const slot = requireSlot();
  const result = fn(slot.db);
  const payload = JSON.stringify(slot.db);
  const write = slot.pending.then(() =>
    getPool().query("UPDATE radar_desks SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1", [
      slot.userId,
      payload,
    ])
  );
  slot.pending = write.then(
    () => undefined,
    () => undefined
  );
  return write.then(() => result);
}

export async function withDesk<T>(userId: string, fn: () => Promise<T> | T): Promise<T> {
  const slot = await slotFor(userId);
  return current.run(slot, () => Promise.resolve().then(fn));
}

export async function listDeskUserIds(): Promise<string[]> {
  await ensureSchema();
  const result = await getPool().query<{ user_id: string }>("SELECT user_id FROM radar_desks");
  return result.rows.map((row) => row.user_id);
}

export function activeProfile(db: Database): Profile | null {
  return db.profiles.find((profile) => profile.id === db.activeProfileId) || db.profiles[0] || null;
}

export function companiesFor(db: Database, profileId: string): Company[] {
  return db.companies.filter((company) => company.profileId === profileId);
}

export function digestsFor(db: Database, profileId: string): DigestRecord[] {
  return db.digests.filter((digest) => digest.profileId === profileId);
}
