import { readDb, updateDb } from "./db";
import { discoverCompany, inspectCareerDocument, probeKnownFeeds } from "./discover";
import { buildDigest, buildRoleMail, type DigestRole } from "./digest";
import { sendDigestEmail, smtpConfigured } from "./email";
import { FetchError, fetchText, normalizeWebsite } from "./http";
import { fetchJobs, type FetchedJob } from "./jobs";
import { matchJob } from "./match";
import { hiringSignals } from "./signals";
import { daysAgo, excerpt, hostOf } from "./text";
import type { Company, Database, DigestRecord, JobRecord, Level, Profile, RoleView, StateView } from "./types";
import { LEVELS } from "./types";

function applyJobs(db: Database, company: Company, fetched: FetchedJob[]) {
  const now = new Date().toISOString();
  const seen = new Set<string>();
  for (const job of fetched) {
    const id = `${company.id}:${job.externalId}`;
    seen.add(id);
    const existing = db.jobs.find((item) => item.id === id);
    if (!existing) {
      db.jobs.push({
        id,
        companyId: company.id,
        externalId: job.externalId,
        title: job.title,
        url: job.url,
        location: job.location,
        department: job.department,
        descriptionText: job.descriptionText,
        postedAt: job.postedAt,
        dateKind: job.dateKind,
        employmentHint: job.employmentHint,
        firstSeenAt: now,
        lastSeenAt: now,
        seenCount: 1,
        active: true,
      });
    } else {
      existing.title = job.title;
      existing.url = job.url;
      existing.location = job.location;
      existing.department = job.department;
      existing.descriptionText = job.descriptionText || existing.descriptionText;
      existing.postedAt = job.postedAt || existing.postedAt;
      existing.dateKind = job.dateKind || existing.dateKind;
      existing.employmentHint = job.employmentHint;
      existing.lastSeenAt = now;
      existing.seenCount += 1;
      existing.active = true;
    }
  }
  for (const job of db.jobs) {
    if (job.companyId === company.id && !seen.has(job.id)) job.active = false;
  }
  company.scanCount += 1;
  company.lastScannedAt = now;
  company.status = "ready";
  company.error = null;
  company.note = fetched.length
    ? `${fetched.length} roles via ${company.source?.label || "the careers page"}`
    : `No open roles found via ${company.source?.label || "the careers page"}.`;
}

async function refreshCompany(company: Company): Promise<{ company: Company; jobs: FetchedJob[]; failed: boolean }> {
  let pageHtml: string | null = null;
  let pageUrl: string | null = company.careersUrl;
  const next = { ...company, source: company.source ? { ...company.source } : null };

  if (!next.source || next.status === "error") {
    const found = await discoverCompany(next.website);
    next.name = found.name || next.name;
    next.blurb = found.blurb;
    next.website = found.website || next.website;
    next.careersUrl = found.careersUrl;
    next.source = found.source;
    pageHtml = found.pageHtml;
    pageUrl = found.pageUrl;
    if (found.error || !found.source) {
      next.status = "error";
      next.error = found.error || "No careers source found.";
      next.note = next.error;
      return { company: next, jobs: [], failed: true };
    }
  }

  if (next.source?.provider === "webpage") {
    const probed = await probeKnownFeeds(next.website);
    if (probed) {
      next.source = probed;
      pageHtml = null;
    }
  }

  if (next.source?.provider === "webpage" && !pageHtml && (pageUrl || next.source.jobsUrl)) {
    try {
      const page = await fetchText(pageUrl || next.source.jobsUrl || next.website);
      pageHtml = page.text;
      pageUrl = page.url;
      next.careersUrl = page.url;
    } catch (error) {
      next.status = "error";
      next.error = error instanceof Error ? error.message : "The careers page could not be read.";
      next.note = next.error;
      return { company: next, jobs: [], failed: true };
    }
  }

  if (pageHtml && (pageUrl || next.careersUrl)) {
    const detected = await inspectCareerDocument(pageUrl || next.careersUrl || next.website, pageHtml);
    if (detected && (next.source?.provider === "webpage" || next.source?.provider === "kula")) {
      const previous = pageUrl;
      next.source = detected;
      if (detected.provider === "webpage" && detected.jobsUrl && detected.jobsUrl !== previous) {
        pageHtml = null;
        pageUrl = detected.jobsUrl;
      }
    }
  }

  const result = await fetchJobs(next.source!, pageHtml, pageUrl);
  if (!result.ok) {
    next.status = "error";
    next.error = result.error;
    next.note = result.error;
    return { company: next, jobs: [], failed: true };
  }
  return { company: next, jobs: result.jobs, failed: false };
}

function candidate(job: JobRecord, company: Company, relevant: boolean): boolean {
  if (!job.active || !relevant) return false;
  if (company.scanCount <= 1) {
    if (!job.postedAt) return true;
    const age = daysAgo(job.postedAt);
    return age !== null && age <= 21;
  }
  return job.seenCount === 1;
}

export function buildState(db: Database): StateView {
  const profile = db.profile;
  const roles: RoleView[] = [];
  if (profile) {
    for (const job of db.jobs) {
      if (!job.active) continue;
      const company = db.companies.find((item) => item.id === job.companyId);
      if (!company) continue;
      const match = matchJob(
        {
          title: job.title,
          body: job.descriptionText,
          employmentHint: job.employmentHint,
          department: job.department,
        },
        profile
      );
      if (!match.domainMatch) continue;
      const freshness = company.scanCount <= 1 ? "baseline" : job.seenCount === 1 ? "new" : "open";
      roles.push({
        id: job.id,
        title: job.title,
        url: job.url,
        location: job.location,
        department: job.department,
        companyId: company.id,
        companyName: company.name,
        excerpt: excerpt(job.descriptionText, 240),
        match,
        signals: hiringSignals(job, company, db.jobs.filter((item) => item.companyId === company.id)),
        freshness,
        inDigest: false,
      });
    }
  }

  roles.sort((a, b) => b.match.score - a.match.score || a.title.localeCompare(b.title));
  const digestRoles = roles.filter((role) => {
    const company = db.companies.find((item) => item.id === role.companyId);
    const job = db.jobs.find((item) => item.id === role.id);
    if (!company || !job) return false;
    return candidate(job, company, role.match.relevant);
  });
  const capped = digestRoles.slice(0, 12);
  const cappedIds = new Set(capped.map((role) => role.id));
  for (const role of roles) role.inDigest = cappedIds.has(role.id);

  const kind: DigestRecord["kind"] = capped.some((role) => role.freshness === "new")
    ? "new"
    : capped.length > 0
      ? "baseline"
      : "quiet";

  const digestInput: DigestRole[] = capped.map((role) => ({
    id: role.id,
    title: role.title,
    companyName: role.companyName,
    url: role.url,
    detectedLevel: role.match.detectedLevel,
    reasons: role.match.reasons,
    signals: role.signals,
  }));

  const built = profile
    ? buildDigest({
        domain: profile.domain,
        kind,
        roles: digestInput,
        overflow: Math.max(0, digestRoles.length - capped.length),
      })
    : null;

  const prior = db.digests[0];
  const same = prior && prior.jobIds.join("|") === capped.map((role) => role.id).join("|");

  return {
    profile,
    companies: db.companies
      .map((company) => ({
        id: company.id,
        name: company.name,
        website: company.website,
        host: hostOf(company.website),
        blurb: company.blurb,
        careersUrl: company.careersUrl,
        sourceLabel: company.source?.label || null,
        status: company.status,
        error: company.error,
        note: company.note,
        scanCount: company.scanCount,
        lastScannedAt: company.lastScannedAt,
        openRoles: db.jobs.filter((job) => job.companyId === company.id && job.active).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    roles,
    digest: built
      ? {
          subject: built.subject,
          text: built.text,
          html: built.html,
          kind,
          jobIds: capped.map((role) => role.id),
          sentAt: same ? prior?.sentAt || null : null,
          createdAt: new Date().toISOString(),
        }
      : null,
    smtpConfigured: smtpConfigured(),
  };
}

export function getState(): StateView {
  return buildState(readDb());
}

export async function resetDesk(): Promise<StateView> {
  await updateDb((db) => {
    db.profile = null;
    db.companies = [];
    db.jobs = [];
    db.digests = [];
    db.dailyScannedOn = null;
    db.dailyMailedOn = null;
  });
  return getState();
}

function cleanEmail(value: string | undefined): string {
  const email = (value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    throw new FetchError("Enter an email address.");
  }
  return email;
}

export async function saveProfile(input: {
  domain?: string;
  preferredRoles?: string;
  levels?: string[];
  keywords?: string;
  email?: string;
}): Promise<StateView> {
  const domain = (input.domain || "").trim();
  if (!domain) throw new FetchError("Enter a domain.");
  if (domain.length > 80) throw new FetchError("Keep the domain short.");
  const levels = (input.levels || []).filter((level): level is Level => (LEVELS as readonly string[]).includes(level));
  if (levels.length === 0) throw new FetchError("Choose at least one kind of work.");
  const email = cleanEmail(input.email);
  const now = new Date().toISOString();
  await updateDb((db) => {
    const profile: Profile = {
      domain,
      preferredRoles: (input.preferredRoles || "").trim().slice(0, 240),
      levels,
      keywords: (input.keywords || "").trim().slice(0, 240),
      email,
      createdAt: db.profile?.createdAt || now,
      updatedAt: now,
    };
    db.profile = profile;
  });
  return getState();
}

export async function addCompany(rawUrl: string): Promise<StateView> {
  const website = normalizeWebsite(rawUrl);
  const host = hostOf(website);
  const existing = readDb();
  if (!existing.profile) throw new FetchError("Create your search before adding a company.");
  if (existing.companies.some((company) => hostOf(company.website) === host)) {
    throw new FetchError("You're already watching that company.");
  }

  const draft: Company = {
    id: crypto.randomUUID(),
    website,
    name: host.split(".")[0] || "Company",
    blurb: "",
    careersUrl: null,
    source: null,
    status: "error",
    error: null,
    note: "Looking for the careers desk.",
    scanCount: 0,
    lastScannedAt: null,
    createdAt: new Date().toISOString(),
  };
  const refreshed = await refreshCompany(draft);
  await updateDb((db) => {
    if (db.companies.some((company) => hostOf(company.website) === hostOf(refreshed.company.website))) return;
    db.companies.push(refreshed.company);
    if (!refreshed.failed) applyJobs(db, refreshed.company, refreshed.jobs);
  });
  return getState();
}

export async function removeCompany(id: string): Promise<StateView> {
  await updateDb((db) => {
    db.companies = db.companies.filter((company) => company.id !== id);
    db.jobs = db.jobs.filter((job) => job.companyId !== id);
  });
  return getState();
}

export async function scanCompany(id: string): Promise<StateView> {
  const current = readDb().companies.find((company) => company.id === id);
  if (!current) throw new FetchError("That company is not on the desk.");
  const refreshed = await refreshCompany(current);
  await updateDb((db) => {
    const index = db.companies.findIndex((company) => company.id === id);
    if (index === -1) return;
    db.companies[index] = refreshed.company;
    if (!refreshed.failed) applyJobs(db, db.companies[index], refreshed.jobs);
  });
  return getState();
}

export async function scanAll(): Promise<StateView> {
  const ids = readDb().companies.map((company) => company.id);
  for (const id of ids) {
    const current = readDb().companies.find((company) => company.id === id);
    if (!current) continue;
    const refreshed = await refreshCompany(current);
    await updateDb((db) => {
      const index = db.companies.findIndex((company) => company.id === id);
      if (index === -1) return;
      db.companies[index] = refreshed.company;
      if (!refreshed.failed) applyJobs(db, db.companies[index], refreshed.jobs);
    });
  }
  return getState();
}

export async function emailApplicableRoles(appUrl: string): Promise<{
  sent: boolean;
  reason?: string;
  subject: string;
  text: string;
  state: StateView;
}> {
  const state = getState();
  if (!state.profile) throw new FetchError("Create your search before sending a note.");
  if (!state.profile.email) throw new FetchError("Add your email in the search.");
  const roles = state.roles.filter((role) => role.match.relevant);
  if (roles.length === 0) throw new FetchError("Nothing to send yet.");
  const mail = buildRoleMail({
    domain: state.profile.domain,
    kind: "all",
    appUrl,
    roles: roles.map((role) => ({
      title: role.title,
      companyName: role.companyName,
      location: role.location,
      detectedLevel: role.match.detectedLevel,
    })),
  });
  const result = await sendDigestEmail({ to: state.profile.email, ...mail });
  if (result.sent) await rememberMail(mail, roles.map((role) => role.id), "baseline");
  return { ...result, subject: mail.subject, text: mail.text, state: getState() };
}

export async function runDailyCheck(appUrl: string, today: string): Promise<void> {
  const db = readDb();
  if (db.dailyMailedOn === today) return;
  if (db.dailyScannedOn !== today) {
    await scanAll();
    await updateDb((next) => {
      next.dailyScannedOn = today;
    });
  }
  const state = getState();
  const fresh = state.roles.filter((role) => role.freshness === "new" && role.match.relevant);
  if (!state.profile?.email || fresh.length === 0 || !smtpConfigured()) {
    if (fresh.length === 0) {
      await updateDb((next) => {
        next.dailyMailedOn = today;
      });
    }
    return;
  }
  const mail = buildRoleMail({
    domain: state.profile.domain,
    kind: "new",
    appUrl,
    roles: fresh.map((role) => ({
      title: role.title,
      companyName: role.companyName,
      location: role.location,
      detectedLevel: role.match.detectedLevel,
    })),
  });
  const result = await sendDigestEmail({ to: state.profile.email, ...mail });
  if (!result.sent) return;
  await rememberMail(mail, fresh.map((role) => role.id), "new");
  await updateDb((next) => {
    next.dailyMailedOn = today;
  });
}

async function rememberMail(
  mail: { subject: string; text: string; html: string },
  jobIds: string[],
  kind: DigestRecord["kind"]
) {
  await updateDb((db) => {
    db.digests.unshift({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      jobIds,
      kind,
    });
    db.digests = db.digests.slice(0, 14);
  });
}
