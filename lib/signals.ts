import { daysAgo, formatWhen } from "./text";
import type { Company, JobRecord } from "./types";

export function hiringSignals(job: JobRecord, company: Company, companyJobs: JobRecord[]): string[] {
  const signals: string[] = [];
  const age = job.postedAt ? daysAgo(job.postedAt) : null;
  if (job.postedAt && age !== null) {
    const verb = job.dateKind === "updated" ? "Updated on the board" : "Posted";
    if (age <= 1) signals.push(`${verb} in the last day`);
    else if (age <= 14) signals.push(`${verb} ${age} days ago`);
    else signals.push(`${verb} ${formatWhen(job.postedAt)}`);
  } else {
    signals.push("The board did not publish a posting date");
  }

  if (job.department) {
    const siblings = companyJobs.filter((item) => item.active && item.department === job.department).length;
    if (siblings >= 3) signals.push(`${siblings} open roles in ${job.department}`);
  }

  const firstLook = company.scanCount <= 1;
  const newcomers = companyJobs.filter((item) => item.active && item.seenCount === 1).length;
  if (!firstLook && newcomers >= 2) {
    signals.push(`${newcomers} roles at ${company.name} showed up on this check`);
  }

  if (company.blurb) signals.push(company.blurb);
  return signals.slice(0, 3);
}
