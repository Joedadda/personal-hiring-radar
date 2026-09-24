import { allGraphs, resolveDomain, type DomainGraph } from "./domains";
import { phraseHit, splitList } from "./text";
import type { Level, MatchResult, Profile } from "./types";

export type JobText = {
  title: string;
  body: string;
  employmentHint?: string;
  department?: string;
};

type GraphScore = {
  score: number;
  matched: string[];
  titleSaysDomain: boolean;
};

function scoreGraph(job: JobText, graph: DomainGraph): GraphScore {
  const title = job.title || "";
  const body = job.body || "";
  let score = 0;
  const matched: string[] = [];

  for (const cluster of graph.clusters) {
    const inBody = cluster.phrases.some((phrase) => phraseHit(body, phrase));
    const inTitle = cluster.phrases.some((phrase) => phraseHit(title, phrase));
    if (inBody) {
      score += 16;
      matched.push(cluster.label);
    } else if (inTitle) {
      score += 12;
      matched.push(cluster.label);
    }
  }

  const titleSaysDomain = graph.labels.some((label) => phraseHit(title, label));
  const departmentSaysDomain = graph.labels.some(
    (label) => phraseHit(job.department || "", label) || phraseHit(label, job.department || "")
  );
  const bodySaysDomain = graph.labels.some((label) => label.trim().length >= 9 && phraseHit(body, label));
  if (titleSaysDomain || departmentSaysDomain) score += 14;
  else if (bodySaysDomain) score += 8;

  return { score: Math.min(score, 72), matched, titleSaysDomain: titleSaysDomain || departmentSaysDomain };
}

export function detectEmployment(job: JobText): {
  employment: MatchResult["employment"];
  detectedLevel: string;
} {
  const blob = `${job.title}\n${job.employmentHint || ""}\n${(job.body || "").slice(0, 1800)}`;
  const title = `${job.title}\n${job.employmentHint || ""}`;

  if (/\b(intern|internship|co-op|coop|apprentice)\b/i.test(blob)) {
    return { employment: "internship", detectedLevel: "Internship" };
  }
  if (/\bfreelance(?:r)?\b/i.test(blob)) {
    return { employment: "freelance", detectedLevel: "Freelance" };
  }
  if (/\b(contract|contractor|contract-to-hire)\b/i.test(title) || /\b(fixed[- ]term contract|contractor)\b/i.test(blob)) {
    return { employment: "contract", detectedLevel: "Contract" };
  }
  if (/\b(senior|sr\.|staff|principal|director|head of|vp\b|vice president|\blead\b)\b/i.test(title)) {
    return { employment: "full-time", detectedLevel: "Senior" };
  }
  if (/\b(junior|jr\.|entry[- ]level|new grad|graduate program|associate)\b/i.test(title)) {
    return { employment: "full-time", detectedLevel: "Entry-level" };
  }
  return { employment: "full-time", detectedLevel: "Full-time" };
}

function levelOk(employment: MatchResult["employment"], selected: Level[]): boolean {
  if (selected.includes("any")) return true;
  if (employment === "internship") return selected.includes("internship");
  if (employment === "freelance") return selected.includes("freelance");
  if (employment === "contract") return selected.includes("contract") || selected.includes("freelance");
  return selected.includes("full-time");
}

function listJoin(items: string[]): string {
  const unique = [...new Set(items)];
  if (unique.length <= 1) return unique[0] ?? "";
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")}, and ${unique[unique.length - 1]}`;
}

export function matchJob(job: JobText, profile: Pick<Profile, "domain" | "preferredRoles" | "levels" | "keywords">): MatchResult {
  const { graph } = resolveDomain(profile.domain);
  const userScore = scoreGraph(job, graph);
  const rivals = allGraphs()
    .filter((candidate) => candidate.id !== graph.id)
    .map((candidate) => ({ graph: candidate, score: scoreGraph(job, candidate) }));
  const bestOther = rivals.reduce((max, rival) => Math.max(max, rival.score.score), 0);
  const heading = `${job.title}\n${job.department || ""}`;
  const namedHere = graph.labels.some((label) => phraseHit(heading, label));
  const titleNamesHere = graph.labels.some((label) => phraseHit(job.title, label));
  const titleNamesRival = rivals.some(
    (rival) =>
      rival.score.score > 0 && rival.graph.labels.some((label) => phraseHit(job.title, label))
  );
  const rivalNamed = rivals.some(
    (rival) =>
      rival.score.score >= userScore.score &&
      rival.score.score > 0 &&
      rival.graph.labels.some((label) => phraseHit(heading, label))
  );
  const dominated =
    (titleNamesRival && !titleNamesHere) ||
    (!titleNamesHere && bestOther > userScore.score) ||
    (!titleNamesHere && bestOther === userScore.score && bestOther > 0 && (!namedHere || rivalNamed));

  const domainOk =
    userScore.score >= 12 &&
    userScore.matched.length + (userScore.titleSaysDomain ? 1 : 0) >= 1 &&
    !dominated;
  const { employment, detectedLevel } = detectEmployment(job);
  const fitsLevel = levelOk(employment, profile.levels);

  const roles = splitList(profile.preferredRoles);
  const roleHits = roles.filter((role) => phraseHit(job.title, role) || phraseHit(job.body, role));
  const roleScore = Math.min(18, roleHits.length * 12);

  const keywords = splitList(profile.keywords);
  const keywordHits = keywords.filter((keyword) => phraseHit(job.title, keyword) || phraseHit(job.body, keyword));
  const keywordScore = Math.min(12, keywordHits.length * 4);

  const levelFit = fitsLevel ? 10 : 0;
  const reasons: string[] = [];

  if (userScore.matched.length > 0) {
    const covered = listJoin(userScore.matched.slice(0, 3));
    if (!userScore.titleSaysDomain) {
      reasons.push(
        `“${job.title}” does not need the word ${profile.domain.toLowerCase()}. The responsibilities cover ${covered}.`
      );
    } else {
      reasons.push(`The description sits in ${profile.domain.toLowerCase()}: ${covered}.`);
    }
  } else if (userScore.titleSaysDomain) {
    reasons.push(`The title itself is ${profile.domain.toLowerCase()} work.`);
  }

  if (dominated) {
    reasons.push("A different profession fits this description more closely, so it stays off the desk.");
  }

  if (roleHits.length > 0) {
    reasons.push(`Preferred roles add weight (${listJoin(roleHits)}) without hiding the rest of ${profile.domain.toLowerCase()}.`);
  }

  if (keywordHits.length > 0) {
    reasons.push(`Your keywords show up here: ${listJoin(keywordHits)}.`);
  }

  reasons.push(fitsLevel ? `Reads as ${detectedLevel.toLowerCase()}.` : `Set aside because this reads as ${detectedLevel.toLowerCase()}.`);

  const domainMatch = domainOk;
  const relevant = domainMatch && fitsLevel;
  const score = relevant
    ? Math.min(99, userScore.score + roleScore + keywordScore + levelFit)
    : Math.min(40, userScore.score);

  return {
    score,
    domainScore: userScore.score,
    roleScore,
    keywordScore,
    levelFit,
    detectedLevel,
    employment,
    reasons,
    matchedClusters: userScore.matched,
    relevant,
    domainMatch,
    titleSaysDomain: userScore.titleSaysDomain,
  };
}
