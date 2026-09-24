export const LEVELS = ["internship", "full-time", "freelance", "contract", "any"] as const;

export type Level = (typeof LEVELS)[number];

export type Profile = {
  id: string;
  name: string;
  domain: string;
  preferredRoles: string;
  levels: Level[];
  keywords: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export type ProfileSummary = {
  id: string;
  name: string;
  domain: string;
};

export type JobSource = {
  provider:
    | "greenhouse"
    | "lever"
    | "ashby"
    | "smartrecruiters"
    | "workday"
    | "bamboohr"
    | "recruitee"
    | "kula"
    | "webpage";
  board: string | null;
  jobsUrl: string | null;
  label: string;
};

export type Company = {
  id: string;
  profileId: string;
  website: string;
  name: string;
  blurb: string;
  careersUrl: string | null;
  source: JobSource | null;
  status: "ready" | "error";
  error: string | null;
  note: string;
  scanCount: number;
  lastScannedAt: string | null;
  createdAt: string;
};

export type JobRecord = {
  id: string;
  companyId: string;
  externalId: string;
  title: string;
  url: string;
  location: string;
  department: string;
  descriptionText: string;
  postedAt: string | null;
  dateKind: "posted" | "updated" | null;
  employmentHint: string;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
  active: boolean;
  origin?: "careers" | "linkedin" | "both";
  authorName?: string | null;
  unverified?: boolean;
};

export type LinkedInSignal = {
  id: string;
  companyId: string;
  jobId: string | null;
  url: string;
  authorName: string | null;
  snippet: string;
  publishedAt: string | null;
  discoveredAt: string;
  searchQuery: string;
  contentHash: string;
  status: "candidate" | "converted" | "irrelevant" | "duplicate";
};

export type MatchResult = {
  score: number;
  domainScore: number;
  roleScore: number;
  keywordScore: number;
  levelFit: number;
  detectedLevel: string;
  employment: "internship" | "full-time" | "freelance" | "contract";
  reasons: string[];
  matchedClusters: string[];
  relevant: boolean;
  domainMatch: boolean;
  titleSaysDomain: boolean;
};

export type DigestRecord = {
  id: string;
  profileId: string;
  createdAt: string;
  sentAt: string | null;
  subject: string;
  text: string;
  html: string;
  jobIds: string[];
  kind: "new" | "baseline" | "quiet";
};

export type Database = {
  profiles: Profile[];
  activeProfileId: string | null;
  companies: Company[];
  jobs: JobRecord[];
  linkedinSignals: LinkedInSignal[];
  digests: DigestRecord[];
  dailyScannedOn: string | null;
  dailyMailedOn: string | null;
};

export type RoleView = {
  id: string;
  title: string;
  url: string;
  location: string;
  department: string;
  companyId: string;
  companyName: string;
  excerpt: string;
  match: MatchResult;
  signals: string[];
  sourceNote: string;
  freshness: "new" | "baseline" | "open";
  inDigest: boolean;
};

export type CompanyView = {
  id: string;
  name: string;
  website: string;
  host: string;
  blurb: string;
  careersUrl: string | null;
  sourceLabel: string | null;
  status: Company["status"];
  error: string | null;
  note: string;
  scanCount: number;
  lastScannedAt: string | null;
  openRoles: number;
};

export type StateView = {
  profile: Profile | null;
  profiles: ProfileSummary[];
  companies: CompanyView[];
  roles: RoleView[];
  digest: {
    subject: string;
    text: string;
    html: string;
    kind: DigestRecord["kind"];
    jobIds: string[];
    sentAt: string | null;
    createdAt: string;
  } | null;
  mailConfigured: boolean;
};
