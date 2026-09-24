Absolutely. I’d make the PRD **implementation-oriented**, not a vague product spec, because Cursor will do much better if you explicitly define the architecture, data model, source adapters, matching pipeline, failure behavior, and deployment model.

The key architectural change from your current MVP is:

> **Careers/ATS and LinkedIn discovery are two independent job-discovery sources that feed into the same normalization → deduplication → classification → relevance pipeline.**

And importantly, the LinkedIn component should use **publicly indexed search results**, not an automated logged-in LinkedIn scraper.

Below is the version I would give Cursor.

---

# Personal Hiring Radar — Detailed PRD

## 1. Product Overview

Build a personal job-hunting agent called **Personal Hiring Radar**.

The product continuously monitors companies that a user cares about and identifies relevant job opportunities from multiple public sources.

The primary goal is:

> **A user should configure their job preferences once, add companies they care about, and then receive an automated alert whenever a relevant new opportunity is discovered — even if that opportunity does not appear on the company's careers page.**

The system should operate passively after setup.

The user should NOT need to manually find:

* careers URLs
* ATS URLs
* Greenhouse board IDs
* Ashby board IDs
* Lever URLs
* LinkedIn searches

The system should discover these automatically.

---

# 2. Core Product Behavior

The user creates a job profile:

```text
Domain:
Marketing

Preferred roles:
Growth, Product Marketing, Community

Employment type:
Internship

Keywords:
AI, SaaS, B2B
```

Then they add companies:

```text
https://sarvam.ai
https://openai.com
https://example.com
```

The system automatically:

1. Discovers each company's careers page.
2. Detects whether it uses a supported ATS.
3. Retrieves jobs from the ATS/careers page.
4. Runs public web search queries to discover LinkedIn hiring posts.
5. Extracts candidate jobs from those posts.
6. Normalizes all jobs into a common schema.
7. Deduplicates jobs discovered through multiple sources.
8. Determines whether each job belongs to the user's broad domain.
9. Scores the job against preferred roles and keywords.
10. Determines whether it matches the requested employment type.
11. For relevant newly discovered jobs, optionally searches for additional public hiring signals.
12. Sends a concise email digest.
13. Stores all discoveries and scan history in the database.

---

# 3. Important Product Principle

## Domain ≠ preferred role

The domain defines the **universe of work** the user is interested in.

Preferred roles refine ranking.

For example:

```text
Domain:
Marketing

Preferred roles:
Growth
Product Marketing
```

A job called:

```text
Community Manager
```

should still be capable of being classified as Marketing.

Likewise:

```text
Content Creator
Social Media Manager
Growth Associate
Community Intern
Video Content Intern
Marketing Operations Intern
Brand Associate
```

can all potentially belong to Marketing.

Do NOT implement domain matching as:

```text
title contains "marketing"
```

The system should understand related functions.

---

# 4. Multi-Source Architecture

The system should have a source abstraction.

Every job discovery source should implement the same conceptual interface:

```typescript
interface JobSource {
  sourceType: JobSourceType;

  discover(company: Company): Promise<RawJob[]>;

  healthCheck?(company: Company): Promise<SourceHealth>;
}
```

Possible source types:

```typescript
type JobSourceType =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "workable"
  | "smartrecruiters"
  | "generic_careers"
  | "linkedin_search"
  | "other_web";
```

The important architectural rule is:

> The matching system must not care where a job came from.

Whether a job came from Greenhouse or a LinkedIn post, it should eventually become the same normalized `Job` entity.

---

# 5. Source Priority

Use this priority:

### Tier 1 — Direct structured sources

Prefer:

1. Greenhouse
2. Ashby
3. Lever
4. Workable
5. SmartRecruiters
6. Other publicly accessible ATS endpoints

These should be preferred because structured sources produce cleaner job data.

### Tier 2 — Careers page crawling

If no supported ATS is detected:

```text
company website
→ discover careers page
→ crawl careers page
→ extract jobs
```

### Tier 3 — Public web / LinkedIn discovery

Search publicly indexed web results for hiring posts.

This is especially important because some jobs:

* are posted by employees
* are posted by hiring managers
* are posted by founders
* exist only on LinkedIn
* are filled before they ever appear on a careers page

---

# 6. LinkedIn Discovery Architecture

Do NOT build the system around:

```text
login to LinkedIn
→ browse feed
→ scrape posts
```

Do not automate a LinkedIn account.

Instead, build a **LinkedIn Discovery Adapter** that uses a search provider to discover publicly indexed LinkedIn pages/posts.

Conceptually:

```text
Company
   ↓
Query Generator
   ↓
Search Provider
   ↓
Search Results
   ↓
LinkedIn URL Detection
   ↓
Post Extraction
   ↓
Hiring Signal Classifier
   ↓
Candidate Job
```

The search provider should be abstracted so it can be replaced later.

```typescript
interface SearchProvider {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}
```

Potential implementation:

```text
/lib/search/
    types.ts
    provider.ts
    tavily.ts
    serpapi.ts
    google.ts
```

Do NOT hard-code the application around one search provider.

---

# 7. LinkedIn Query Generation

Queries should be generated dynamically.

For each company, generate a small number of targeted queries.

Example:

```text
site:linkedin.com/posts "Sarvam" hiring marketing
```

```text
site:linkedin.com/posts "Sarvam" "we're hiring"
```

```text
site:linkedin.com/posts "Sarvam" "looking for" marketing
```

```text
site:linkedin.com/posts "Sarvam" "join our team"
```

Preferred-role variants may be added:

```text
site:linkedin.com/posts "Sarvam" hiring growth
site:linkedin.com/posts "Sarvam" hiring "product marketing"
site:linkedin.com/posts "Sarvam" hiring community
```

Do not generate an enormous number of queries.

Create a bounded query generator.

Example:

```typescript
generateLinkedInQueries({
  company,
  domain,
  preferredRoles,
  keywords
})
```

should return approximately 5–15 high-value queries.

---

# 8. Hiring Language

The query generator/classifier should understand hiring language such as:

```text
hiring
we're hiring
we are hiring
looking for
looking to hire
join our team
join the team
open role
open roles
team is growing
building our team
come work with us
applications open
apply
DM me
reach out
```

These are signals, not hard requirements.

A post can still be relevant if it uses unusual language.

---

# 9. LinkedIn Signal Entity

Create a separate entity:

```typescript
LinkedInSignal
```

Database table:

```text
linkedin_signals
```

Fields:

```text
id
company_id
job_id
url
author_name
author_profile_url
post_title
post_text
snippet
published_at
discovered_at
search_query
search_provider
content_hash
hiring_probability
domain_probability
status
created_at
updated_at
```

Possible status:

```text
candidate
reviewed
converted_to_job
irrelevant
expired
duplicate
```

---

# 10. LinkedIn → Job Conversion

A LinkedIn post should NOT automatically become a job.

First determine:

### Is this actually a hiring post?

For example:

```text
"We just launched our new product!"
```

should not become a job.

But:

```text
"We're looking for a Growth Intern to join our team."
```

should.

The pipeline should be:

```text
LinkedIn result
      ↓
Is it actually a hiring signal?
      ↓
YES
      ↓
Can we identify a job?
      ↓
YES → create candidate Job
      ↓
NO → store as hiring signal
```

Some posts may contain a hiring signal without enough information to construct a complete job.

Those should remain `linkedin_signals`.

---

# 11. Provisional LinkedIn Jobs

Some jobs will exist only as a LinkedIn post.

Example:

```text
We're looking for a Growth Intern.
DM me if interested.
```

Create a provisional job:

```text
title:
Growth Intern

company:
Example Company

source:
linkedin

source_url:
LinkedIn post URL

status:
unverified

application_url:
null
```

The UI should clearly communicate:

> **Discovered via LinkedIn — no official careers listing found**

This is a major product feature.

---

# 12. Job Source Metadata

Every job should retain source information.

Add:

```typescript
sources: JobSourceReference[]
```

Where:

```typescript
interface JobSourceReference {
  sourceType: JobSourceType;
  url: string;
  discoveredAt: Date;
  sourceId?: string;
}
```

Example:

```text
Marketing Intern
│
├── Greenhouse
│   └── official careers URL
│
└── LinkedIn
    └── hiring manager post
```

This allows the UI to show:

```text
Found on:
Official Careers Page
LinkedIn
```

---

# 13. Deduplication

This is extremely important.

The same job may appear:

```text
Careers page
LinkedIn
Google search
ATS
```

It must become one job.

Create:

```text
/lib/jobs/deduplicateJobs.ts
```

Deduplication should use multiple signals.

### Strong signals

Exact external job ID:

```text
Greenhouse job ID
Ashby job ID
Lever posting ID
```

Application URL.

### Medium signals

Normalized:

```text
company
title
location
employment type
```

### Weak signals

Description similarity.

For LinkedIn-only posts, compare:

```text
company
title
location
description
application URL
```

Use deterministic matching first.

Only use embeddings/LLM similarity if necessary.

---

# 14. Job Database Schema

Use Supabase/Postgres.

## users

```text
id
email
created_at
```

## job_profiles

```text
id
user_id
domain
preferred_roles
level
employment_type
keywords
created_at
updated_at
```

If level and employment type are separate concepts, retain both.

---

## companies

```text
id
user_id
name
website
careers_url
source_type
source_url
source_identifier
source_status
last_checked_at
created_at
updated_at
```

`source_type` could be:

```text
greenhouse
ashby
lever
workable
smartrecruiters
generic
unknown
```

---

## jobs

```text
id
company_id

external_job_id

title
description
url

location
employment_type

domain
subdomains

match_score
preferred_role_alignment
keyword_alignment

match_reason

status

first_seen_at
last_seen_at
closed_at

content_hash

created_at
updated_at
```

`status`:

```text
open
closed
unverified
```

---

## job_sources

```text
id
job_id

source_type
source_url
external_source_id

first_seen_at
last_seen_at

metadata_json
created_at
```

This is preferable to storing only one source on the job.

---

## linkedin_signals

```text
id
company_id
job_id

url

author_name
author_profile_url

post_title
post_text
snippet

published_at
discovered_at

search_query
search_provider

content_hash

hiring_probability
domain_probability

status

created_at
updated_at
```

---

## hiring_signals

This is separate from LinkedIn discovery.

```text
id
job_id

person_name
person_role

signal_type

source_name
source_url

published_date
summary

created_at
```

Examples:

```text
hiring_manager_post
team_expansion
founder_announcement
funding
new_team
employee_referral
```

---

## scan_runs

```text
id

started_at
completed_at

status

companies_checked
jobs_found
new_jobs
relevant_jobs

linkedin_results
linkedin_candidates

errors

created_at
```

---

# 15. Job Classification Pipeline

Do NOT immediately send every discovered job to an LLM.

Use a layered pipeline.

```text
Raw jobs
   ↓
Normalize
   ↓
Cheap deterministic pre-filter
   ↓
Domain classifier
   ↓
Preferred-role scorer
   ↓
Keyword scorer
   ↓
Employment-level filter
   ↓
Optional AI classifier
   ↓
Final relevance
```

---

# 16. Existing Domain Classifier

Keep the current rule-based domain classifier.

It currently uses phrase clusters.

For Marketing, examples include:

```text
growth
content
social/community
product marketing
brand
SEO
events
video
marketing operations
outbound
communications
```

Do NOT replace this immediately.

Instead, refactor it into a clean module:

```text
/lib/matching/
    domains.ts
    preFilter.ts
    classifyJob.ts
    scoreJob.ts
    matchReason.ts
```

The domain classifier should remain deterministic and cheap.

---

# 17. AI Matching Layer

AI should be an optional second layer.

Use it primarily for:

* ambiguous jobs
* jobs with borderline scores
* unusual job titles
* LinkedIn-only jobs
* unknown domains

Example:

```typescript
classifyJobWithAI(job, profile)
```

Expected output:

```json
{
  "domain_match": true,
  "confidence": 0.91,
  "subdomains": [
    "growth",
    "marketing"
  ],
  "reason": "The role focuses on growth experiments, acquisition and campaign execution.",
  "preferred_role_alignment": 0.82
}
```

The AI response must be structured JSON.

Do not let the model directly modify the database.

---

# 18. Matching Decision

Separate:

```text
domainMatch
```

from:

```text
relevant
```

Example:

```text
domainMatch = true
```

means:

> This job belongs to the user's chosen domain.

Whereas:

```text
relevant = true
```

means:

> This job belongs to the domain AND satisfies the user's employment-level requirements.

Preferred roles and keywords should primarily influence ranking, not define the domain.

---

# 19. Level Filtering

Support:

```text
Internship
Full-time
Freelance
Contract
Any
```

A job can belong to the user's domain but still be excluded from alerts because of employment type.

Example:

```text
Marketing Director
```

could be:

```text
domainMatch = true
relevant = false
```

if the user selected Internship.

Do not delete it.

Store it, but don't include it in the alert.

---

# 20. LinkedIn Search Frequency

LinkedIn discovery should run during every scheduled scan.

Example:

```text
4 PM daily
```

For each company:

```text
ATS/careers scan
+
LinkedIn discovery
```

Do not continuously poll LinkedIn.

The system should use the scheduled scan.

---

# 21. Search Result Freshness

Prefer recent results.

The LinkedIn discovery layer should support:

```typescript
publishedAfter
publishedBefore
```

or equivalent search filtering where supported.

If the search provider does not support reliable dates, use the returned publication date/snippet where available and store uncertainty.

Do not assume a search result is new simply because the system discovered it today.

Distinguish:

```text
published_at
```

from:

```text
discovered_at
```

---

# 22. Avoid Duplicate Alerts

The user should never receive:

```text
Marketing Intern — Sarvam
```

every day just because the same LinkedIn post was discovered again.

Use:

```text
content_hash
```

for posts.

For jobs use:

```text
external_job_id
```

when available.

Otherwise use a normalized job fingerprint.

Example:

```text
hash(
  company +
  normalized_title +
  location +
  application_url
)
```

---

# 23. Daily Scan

Create:

```text
POST /api/scan
```

The endpoint should:

```text
1. Authenticate the request.
2. Create scan_run.
3. Fetch active companies.
4. Discover careers/ATS sources.
5. Fetch structured jobs.
6. Run LinkedIn discovery.
7. Normalize results.
8. Deduplicate.
9. Store new/updated jobs.
10. Run matching.
11. Search additional hiring signals for relevant NEW jobs.
12. Generate digest.
13. Send email.
14. Complete scan_run.
```

The endpoint should be idempotent.

If it runs twice, it must not duplicate jobs or send duplicate alerts.

---

# 24. Scan Architecture

Do not write the entire scan in one enormous function.

Create:

```text
/lib/scanner/
    runScan.ts
    scanCompany.ts
    scanCareers.ts
    scanLinkedIn.ts
    processDiscoveredJobs.ts
```

Conceptually:

```typescript
runScan()
  → getCompanies()
  → scanCompany(company)
      → discoverSources()
      → fetchStructuredJobs()
      → discoverLinkedInSignals()
      → normalize()
      → deduplicate()
      → classify()
      → persist()
  → processRelevantJobs()
  → sendDigest()
```

---

# 25. Company Scan

Create:

```typescript
scanCompany(company)
```

It should:

```text
1. Resolve careers page if necessary.
2. Detect ATS.
3. Run supported ATS adapter.
4. Run generic careers fallback if required.
5. Run LinkedIn discovery.
6. Return normalized discoveries.
```

Do not make LinkedIn dependent on successfully discovering the careers page.

This is critical.

A company can have:

```text
careers_url = null
```

and still produce LinkedIn jobs.

---

# 26. Careers Discovery

Create:

```text
/lib/discovery/
    discoverCareersPage.ts
    detectATS.ts
```

The discovery process:

```text
company website
    ↓
homepage
    ↓
look for:
careers
jobs
join us
work with us
opportunities
    ↓
careers URL
```

Then:

```text
careers URL
    ↓
detect ATS
```

---

# 27. ATS Adapters

Each ATS should have its own adapter.

```text
/lib/job-sources/
    types.ts
    greenhouse.ts
    ashby.ts
    lever.ts
    workable.ts
    smartrecruiters.ts
    generic.ts
```

Each adapter converts its source-specific response into:

```typescript
RawJob
```

Do not let source-specific schemas leak into the rest of the application.

---

# 28. Normalized Job Schema

Use:

```typescript
interface NormalizedJob {
  title: string;

  companyName: string;

  description?: string;

  location?: string;

  employmentType?: EmploymentType;

  applicationUrl: string;

  sourceUrl: string;

  sourceType: JobSourceType;

  externalJobId?: string;

  publishedAt?: Date;

  metadata?: Record<string, unknown>;
}
```

---

# 29. LinkedIn Normalized Job

For a LinkedIn-only job:

```typescript
{
  title: "Growth Intern",
  companyName: "Example Company",
  description: "...",
  applicationUrl: null,
  sourceUrl: "https://linkedin.com/posts/...",
  sourceType: "linkedin_search",
  externalJobId: null,
  status: "unverified"
}
```

Do not invent missing fields.

---

# 30. Public Hiring Signal Research

Only perform deeper hiring-signal research for:

```text
NEW
+
RELEVANT
```

jobs.

Don't research every job.

Potential sources:

```text
company announcements
founder posts
employee posts
press releases
funding announcements
public company pages
```

This is a secondary enrichment layer, not the primary job discovery system.

---

# 31. Cost Control

The system should minimize expensive API/AI calls.

### Cheap operations first

```text
ATS API
↓
basic parsing
↓
deterministic matching
↓
only ambiguous jobs → AI
↓
only relevant new jobs → signal research
```

Never:

```text
100 companies
↓
LLM every job
↓
search everything
```

---

# 32. Error Handling

One company's failure must NOT stop the entire scan.

Example:

```text
Company A → success
Company B → LinkedIn search failed
Company C → ATS failed
Company D → success
```

The scan should still complete.

Record errors in `scan_runs`.

Each company should have a status:

```text
success
partial
failed
```

---

# 33. Retry Strategy

Use retries for:

* network errors
* rate limits
* temporary provider failures

Do not endlessly retry:

* invalid URLs
* unsupported ATS
* malformed job data
* permanent authorization errors

Use exponential backoff.

---

# 34. Security

Never expose:

```text
search API keys
AI API keys
Resend API keys
Supabase service-role key
```

to the frontend.

Use:

```text
environment variables
```

and server-side access only.

---

# 35. API Routes

Create:

```text
POST /api/profile
GET  /api/profile
PUT  /api/profile

POST /api/companies
GET  /api/companies
DELETE /api/companies/:id

POST /api/companies/:id/discover

POST /api/companies/:id/scan

GET /api/jobs
GET /api/jobs/:id

POST /api/scan

GET /api/scans
GET /api/scans/:id

POST /api/email/test
```

Potentially:

```text
POST /api/signals/search
```

but prefer keeping signal research internal to the scan pipeline unless the UI explicitly needs it.

---

# 36. Scheduled Execution

Use GitHub Actions initially.

Create:

```text
.github/workflows/daily-scan.yml
```

The workflow should run approximately once per day.

It should make an authenticated request:

```text
POST https://your-domain.com/api/scan
```

with:

```text
CRON_SECRET
```

The Vercel endpoint must verify the secret.

Do not leave `/api/scan` publicly executable.

---

# 37. Deployment

Target deployment:

```text
GitHub
    ↓
Vercel
    ↓
Next.js application

Supabase
    ↓
Postgres database

GitHub Actions
    ↓
Daily scheduler

Resend
    ↓
Email
```

The system must work when the user's laptop is completely turned off.

---

# 38. Environment Variables

Create `.env.example`.

Include placeholders for:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

CRON_SECRET

SEARCH_PROVIDER_API_KEY

AI_PROVIDER_API_KEY

RESEND_API_KEY

EMAIL_FROM
```

Do not commit real secrets.

---

# 39. UI Requirements

The UI should expose:

### Dashboard

```text
Today's scan

New relevant jobs: 4

New LinkedIn discoveries: 2

Companies checked: 37

Last scan: Today, 4:00 PM
```

### Jobs

Each job should show:

```text
Marketing Intern
Sarvam

Domain:
Marketing

Match:
Strong

Source:
LinkedIn

Posted:
2 hours ago

Why it matched:
Community + content + social responsibilities

[View job]
```

If LinkedIn-only:

```text
⚡ Discovered via LinkedIn

No official careers listing found.
```

---

# 40. Job Detail

Show:

```text
Job title
Company
Location
Employment type

Why this matched

Domain:
Marketing

Subdomains:
Growth
Community

Preferred role alignment:
High

Keywords:
AI
B2B

Sources:
LinkedIn post
Official careers page
```

Do not expose an opaque numerical score as the primary UI.

Explain the match in human-readable language.

---

# 41. Initial Scan Behavior

When a user first adds companies, do NOT immediately send a huge email containing every existing job.

The initial scan should establish a baseline.

For example:

```text
Initial scan
↓
Find 300 existing jobs
↓
Store them
↓
Mark them as previously seen
↓
Only future discoveries generate alerts
```

Optionally allow:

```text
"Show me existing matches"
```

in the UI.

---

# 42. Daily Alert

Email only when there are relevant new discoveries.

Example:

```text
Subject:
4 new jobs found today

━━━━━━━━━━━━━━━━

SARVAM

Marketing Intern
⚡ LinkedIn discovery

Community + content focused.

View →

━━━━━━━━━━━━━━━━

Company X

Growth Associate
Official careers page

View →

━━━━━━━━━━━━━━━━

2 more jobs
```

The email should be concise.

---

# 43. Important Product Behavior for LinkedIn

The system must distinguish:

### Official job

```text
source = official_careers
```

### LinkedIn-announced official job

```text
source = linkedin
application_url = official_company_url
```

### LinkedIn-only opportunity

```text
source = linkedin
application_url = null
status = unverified
```

This distinction should be visible in the UI and email.

---

# 44. Testing Requirements

Before calling the system complete, test:

### Careers

* Greenhouse company
* Ashby company
* Lever company
* generic careers page
* broken careers URL

### LinkedIn discovery

* clear hiring post
* ambiguous hiring post
* non-hiring company announcement
* hiring manager post
* founder hiring post
* LinkedIn result with no job title
* LinkedIn result with application link
* LinkedIn-only job

### Matching

Test:

```text
Marketing Intern
Community Intern
Growth Intern
Content Intern
Video Intern
Product Marketing Intern
Software Engineer
Product Manager
Finance Intern
Operations Intern
```

against:

```text
Domain = Marketing
Preferred roles = Growth, Product Marketing
Level = Internship
```

Verify that broad Marketing-related roles can qualify without requiring "marketing" in the title, while clearly unrelated jobs do not.

---

# 45. MVP vs Later

## MVP

Build:

```text
Next.js
Supabase
Greenhouse
Ashby
Lever
Generic careers
Search provider
LinkedIn public discovery
Rule-based matching
Optional AI classification
Resend
GitHub Actions
```

## Later

Potential additions:

```text
More ATS adapters
More search providers
Embeddings
Better job deduplication
Hiring-manager identification
Job expiry detection
Browser notifications
Slack
WhatsApp
Personalized ranking
Historical analytics
```

Do NOT build these before the core scan pipeline works.

---

# 46. Recommended Folder Structure

```text
app/
  page.tsx

  dashboard/
  jobs/
  companies/
  settings/

  api/
    profile/
    companies/
    jobs/
    scan/
    scans/
    email/

lib/

  database/
    users.ts
    profiles.ts
    companies.ts
    jobs.ts
    jobSources.ts
    linkedinSignals.ts
    hiringSignals.ts
    scanRuns.ts

  discovery/
    discoverCareersPage.ts
    detectATS.ts

  job-sources/
    types.ts
    greenhouse.ts
    ashby.ts
    lever.ts
    workable.ts
    smartrecruiters.ts
    generic.ts

  search/
    types.ts
    provider.ts
    queries.ts
    linkedin.ts

  jobs/
    normalizeJob.ts
    deduplicateJobs.ts
    fingerprintJob.ts
    mergeJobs.ts

  matching/
    domains.ts
    preFilter.ts
    classifyJob.ts
    scoreJob.ts
    aiClassifier.ts

  signals/
    searchSignals.ts
    parseSignal.ts

  email/
    generateDigest.ts
    sendDigest.ts

  scanner/
    runScan.ts
    scanCompany.ts
    scanCareers.ts
    scanLinkedIn.ts
    processDiscoveredJobs.ts

  utils/
    hashing.ts
    dates.ts
    retry.ts
```

---

# 47. Non-Goals

Do NOT build:

* LinkedIn login automation
* automated LinkedIn feed browsing
* LinkedIn connection automation
* LinkedIn messaging
* automatic applications
* automatic recruiter outreach
* resume generation
* interview preparation
* a general-purpose job board

The product is a **job discovery and alerting agent**.

---

# Cursor Implementation Prompt

Now I would give Cursor **this prompt after the PRD above**:

```text
You are the lead engineer implementing Personal Hiring Radar.

Read the entire PRD above before making changes.

The goal is NOT to create a mockup or a superficial prototype. Build the actual backend architecture described in the PRD, while keeping the implementation understandable and modular.

I am a non-technical founder/user, so favor straightforward code and clear abstractions over unnecessary complexity.

IMPORTANT PRODUCT PRINCIPLES

1. Domain defines the broad universe of relevant work.
2. Preferred roles refine ranking but do not hard-filter domain membership.
3. Employment type/level is a separate relevance filter.
4. Careers/ATS and LinkedIn discovery are independent sources.
5. LinkedIn discovery must NOT depend on having a careers page.
6. Do not build an automated logged-in LinkedIn scraper.
7. LinkedIn discovery should operate through public web/search results.
8. Every source must normalize into a common job representation.
9. Deduplication must happen before final matching/alerting.
10. Do not send every job through an LLM.
11. Use deterministic matching first, AI only when useful.
12. The daily scan must be idempotent.
13. One company's failure must never stop the entire scan.
14. Never expose API keys to the browser.

FIRST: INSPECT THE EXISTING CODEBASE

Before changing anything:

- inspect the current folder structure
- inspect package.json
- inspect the existing Supabase setup
- inspect the current job schema
- inspect the existing domain classifier
- inspect the existing careers/ATS implementation
- inspect existing API routes
- inspect existing matching logic
- inspect existing UI

Do NOT rewrite working code unnecessarily.

Preserve existing working behavior wherever possible.

If the existing code already implements part of the architecture, refactor it into the structure below rather than duplicating it.

ARCHITECTURE

Implement these layers:

1. discovery
2. job sources
3. search
4. normalization
5. deduplication
6. matching
7. enrichment
8. persistence
9. email
10. scheduled scanning

Recommended structure:

lib/
  database/
  discovery/
  job-sources/
  search/
  jobs/
  matching/
  signals/
  email/
  scanner/

SOURCE ABSTRACTION

Create a common source interface.

Every job source should return normalized/raw jobs rather than exposing source-specific structures to the rest of the application.

Implement adapters for the existing supported ATS sources where they already exist.

Do not make the rest of the application know whether a job came from Greenhouse, Ashby, Lever, etc.

LINKEDIN DISCOVERY

Implement a LinkedIn discovery adapter that searches publicly indexed web results.

Do NOT implement:

- LinkedIn login
- automated browsing of the LinkedIn feed
- session cookies
- account automation
- connection automation
- messaging automation

Instead create:

lib/search/types.ts
lib/search/provider.ts
lib/search/queries.ts
lib/search/linkedin.ts

The search provider must be abstracted behind:

interface SearchProvider {
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

Do not hard-code the entire application around one search provider.

The LinkedIn module should:

1. Generate a bounded set of search queries per company.
2. Search for public LinkedIn pages/posts.
3. Identify LinkedIn URLs.
4. Extract available title/snippet/date/URL information.
5. Identify likely hiring signals.
6. Convert strong hiring signals into candidate jobs.
7. Store uncertain signals separately.

Example query patterns:

site:linkedin.com/posts "{company}" hiring {domain}

site:linkedin.com/posts "{company}" "we're hiring"

site:linkedin.com/posts "{company}" "looking for" {domain}

site:linkedin.com/posts "{company}" "join our team"

Add preferred-role queries when appropriate.

Do not generate hundreds of queries.

Target roughly 5–15 useful queries per company per scan.

LINKEDIN SIGNAL DATABASE

Create a linkedin_signals table/model with:

id
company_id
job_id
url
author_name
author_profile_url
post_title
post_text
snippet
published_at
discovered_at
search_query
search_provider
content_hash
hiring_probability
domain_probability
status
created_at
updated_at

The same LinkedIn post must not be inserted repeatedly.

Use content_hash.

JOB NORMALIZATION

All sources must eventually produce a common NormalizedJob:

interface NormalizedJob {
  title: string;
  companyName: string;
  description?: string;
  location?: string;
  employmentType?: EmploymentType;
  applicationUrl?: string;
  sourceUrl: string;
  sourceType: JobSourceType;
  externalJobId?: string;
  publishedAt?: Date;
  metadata?: Record<string, unknown>;
}

Do not invent fields that are not present in the source.

A LinkedIn-only job can have:

applicationUrl = null

and:

status = "unverified"

DEDUPLICATION

Implement:

lib/jobs/fingerprintJob.ts
lib/jobs/deduplicateJobs.ts
lib/jobs/mergeJobs.ts

Deduplication priority:

1. exact external source ID
2. exact application URL
3. normalized company + title + location
4. description similarity
5. other strong metadata

When two records represent the same job, merge their source references.

Example:

Marketing Intern
  ├── Greenhouse
  └── LinkedIn

should be ONE job with TWO source references.

DATABASE

Use Supabase/Postgres.

Create or update the following tables/models:

users
job_profiles
companies
jobs
job_sources
linkedin_signals
hiring_signals
scan_runs

Do not destroy existing production/user data through migrations.

Use additive migrations where possible.

JOBS

Jobs should support:

status:
open
closed
unverified

source references should be separate from the core job record.

A job can exist with no official careers listing if it was discovered through LinkedIn.

MATCHING

Preserve the existing rule-based domain classifier if one exists.

Do not replace it with an LLM.

Refactor it into:

lib/matching/domains.ts
lib/matching/preFilter.ts
lib/matching/classifyJob.ts
lib/matching/scoreJob.ts
lib/matching/matchReason.ts

The classifier should be able to identify broad functional domains.

For Marketing, related areas include:

growth
content
social/community
product marketing
brand
SEO
events
video
marketing operations
outbound
communications

A title does not need to contain "marketing" to qualify.

For example:

Community Intern

can be Marketing if the description contains meaningful marketing/community evidence.

Separate:

domainMatch

from:

relevant

domainMatch means the job belongs to the selected domain.

relevant means it belongs to the domain AND meets the user's employment-level requirements.

Preferred roles and keywords should primarily affect ranking.

AI MATCHING

Implement an optional AI classification layer.

Do not send every job to AI.

Use deterministic matching first.

Only use AI for:

- ambiguous jobs
- borderline jobs
- unusual titles
- LinkedIn-only candidate jobs
- unknown/custom domains where the deterministic classifier is weak

AI output must be structured JSON.

Example:

{
  "domain_match": true,
  "confidence": 0.91,
  "subdomains": ["growth", "marketing"],
  "reason": "...",
  "preferred_role_alignment": 0.82
}

The AI must not directly write to the database.

The application should validate the response first.

SCAN PIPELINE

Implement:

lib/scanner/runScan.ts
lib/scanner/scanCompany.ts
lib/scanner/scanCareers.ts
lib/scanner/scanLinkedIn.ts
lib/scanner/processDiscoveredJobs.ts

runScan should approximately perform:

1. Create scan_run
2. Load active companies
3. For each company:
   a. Discover careers/ATS if necessary
   b. Fetch structured jobs
   c. Run LinkedIn discovery
   d. Normalize
   e. Deduplicate
   f. Persist
   g. Match
4. Identify NEW + RELEVANT jobs
5. Run optional signal enrichment on those jobs
6. Generate email digest
7. Send email if there are relevant new jobs
8. Complete scan_run

Make this resilient.

One failed company should produce a partial scan, not a total failure.

Store errors.

IDEMPOTENCY

The same scan may accidentally run twice.

It must not:

- create duplicate jobs
- create duplicate LinkedIn signals
- send duplicate daily emails

Use deterministic IDs/fingerprints where appropriate.

Track scan state.

INITIAL SCAN

When a user first adds companies, do not email every historical job.

The first scan establishes a baseline.

Store the existing jobs as seen.

Only future/new jobs should generate alerts.

SCHEDULER

Create:

.github/workflows/daily-scan.yml

It should execute approximately once per day and call:

POST /api/scan

Protect the endpoint with:

CRON_SECRET

Never expose the secret to the client.

API

Implement or preserve:

POST /api/profile
GET /api/profile
PUT /api/profile

POST /api/companies
GET /api/companies
DELETE /api/companies/:id

POST /api/companies/:id/discover
POST /api/companies/:id/scan

GET /api/jobs
GET /api/jobs/:id

POST /api/scan

GET /api/scans
GET /api/scans/:id

POST /api/email/test

Do not create unnecessary endpoints.

EMAIL

Use Resend if the existing project already uses it.

Only send an email when relevant new jobs exist.

Email should distinguish:

Official careers job

LinkedIn-announced job

LinkedIn-only/unverified opportunity

Example:

New opportunity discovered via LinkedIn

Growth Intern — Example Company

Posted by: Jane Doe

No official careers listing found.

[View LinkedIn post]

DEPLOYMENT

The final architecture should support:

GitHub
→ Vercel
→ Next.js API/backend

Supabase
→ Postgres

GitHub Actions
→ daily scan

Resend
→ email

AI/search providers
→ server-side only

The user's computer should NOT need to remain on.

ENVIRONMENT VARIABLES

Create/update .env.example with:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
SEARCH_PROVIDER_API_KEY
AI_PROVIDER_API_KEY
RESEND_API_KEY
EMAIL_FROM

Do not put secrets into client-side code.

TESTING

Add tests for:

1. ATS normalization
2. LinkedIn search result normalization
3. hiring signal detection
4. LinkedIn-only job creation
5. job fingerprinting
6. duplicate detection
7. domain matching
8. preferred-role scoring
9. employment-level filtering
10. scan idempotency

At minimum, test these Marketing examples:

Marketing Intern
Community Intern
Growth Intern
Content Intern
Video Intern
Product Marketing Intern
Software Engineer
Product Manager
Finance Intern
Operations Intern

with:

Domain = Marketing
Preferred roles = Growth, Product Marketing
Level = Internship

EXPECTED BEHAVIOR

The system should be able to find:

"Community Intern"

even though "marketing" is not in the title.

It should be able to find:

"Growth Intern"

through either:

- official careers page
- ATS
- LinkedIn hiring post

It should NOT classify:

"Software Engineer"

as Marketing merely because the description mentions launching a product.

It should not send alerts for full-time jobs if the user selected Internship.

IMPORTANT

Do not over-engineer the first implementation.

First make this end-to-end flow work:

Company
→ careers/ATS discovery
→ LinkedIn public search discovery
→ normalized jobs
→ deduplication
→ existing domain matching
→ relevant jobs
→ Supabase
→ email

Only after this works should you add sophisticated AI ranking, embeddings, or additional enrichment.

Before coding, give me a short implementation plan based on the existing codebase.

Then implement it incrementally.

After each major architectural change, make sure the application still builds successfully.
```

---

## One change I'd make to your current project specifically

Based on the domain-classifier implementation you showed me earlier, **don't throw away the phrase graph**.

Your current system already has a useful foundation:

```text
Marketing
├── Growth
├── Content
├── Social / Community
├── Product Marketing
├── Brand
├── SEO
├── Events
├── Video
├── Marketing Operations
├── Outbound
└── Communications
```

The new architecture should sit **around** that:

```text
                 JOB DISCOVERY
                      │
          ┌───────────┴───────────┐
          │                       │
      Careers                  LinkedIn
          │                       │
          └───────────┬───────────┘
                      ▼
                 NORMALIZE
                      │
                      ▼
                 DEDUPLICATE
                      │
                      ▼
               YOUR PHRASE GRAPH
                      │
                      ▼
                DOMAIN MATCH
                      │
             ┌────────┴────────┐
             │                 │
          Clear             Ambiguous
             │                 │
             │                 ▼
             │              AI check
             │                 │
             └────────┬────────┘
                      ▼
              PREFERRED ROLES
                      │
                      ▼
              EMPLOYMENT TYPE
                      │
                      ▼
             NEW + RELEVANT JOB
                      │
                      ▼
              SIGNAL ENRICHMENT
                      │
                      ▼
                    EMAIL
```

That is the architecture I'd build around your existing MVP rather than replacing everything.

**The biggest conceptual upgrade is that you're no longer building a “careers page monitor.” You're building a multi-source job discovery engine.** The careers page is just the cleanest source; LinkedIn/public web discovery catches the opportunities that never make it there.
