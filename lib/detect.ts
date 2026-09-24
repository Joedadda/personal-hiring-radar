import type { JobSource } from "./types";

const SKIP_BOARDS = new Set(["embed", "job_board", "v1", "jobs", "job", "api"]);

function cleanBoard(value: string | undefined): string | null {
  if (!value) return null;
  const board = decodeURIComponent(value).replace(/\/+$/, "").split("/")[0]?.trim();
  if (!board || SKIP_BOARDS.has(board.toLowerCase())) return null;
  return board;
}

function source(partial: JobSource): JobSource {
  return partial;
}

export function detectSource(pageUrl: string, html: string): JobSource | null {
  const blob = `${pageUrl}\n${html.slice(0, 400_000)}`;

  const greenhouse = blob.match(
    /https?:\/\/(?:job-boards|boards-api|boards|boards\.eu)\.greenhouse\.io\/(?:embed\/job_board\?for=|v1\/boards\/)?([a-z0-9_-]+)/i
  );
  const ghBoard = cleanBoard(greenhouse?.[1]);
  if (ghBoard && /greenhouse/i.test(blob)) {
    return source({
      provider: "greenhouse",
      board: ghBoard,
      jobsUrl: `https://boards-api.greenhouse.io/v1/boards/${ghBoard}/jobs?content=true`,
      label: "Greenhouse",
    });
  }

  const lever = blob.match(/https?:\/\/jobs\.lever\.co\/([a-z0-9_-]+)/i);
  const leverBoard = cleanBoard(lever?.[1]);
  if (leverBoard) {
    return source({
      provider: "lever",
      board: leverBoard,
      jobsUrl: `https://api.lever.co/v0/postings/${leverBoard}?mode=json`,
      label: "Lever",
    });
  }

  const ashby = blob.match(/https?:\/\/jobs\.ashbyhq\.com\/([a-zA-Z0-9._-]+)/i);
  const ashbyBoard = cleanBoard(ashby?.[1]);
  if (ashbyBoard) {
    return source({
      provider: "ashby",
      board: ashbyBoard,
      jobsUrl: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(ashbyBoard)}`,
      label: "Ashby",
    });
  }

  const smart = blob.match(/https?:\/\/(?:jobs|careers)\.smartrecruiters\.com\/([a-zA-Z0-9._%-]+)/i);
  const smartBoard = cleanBoard(smart?.[1]);
  if (smartBoard) {
    return source({
      provider: "smartrecruiters",
      board: smartBoard,
      jobsUrl: `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(smartBoard)}/postings?limit=100`,
      label: "SmartRecruiters",
    });
  }

  const workday = blob.match(
    /https?:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([a-zA-Z0-9_-]+)/i
  );
  if (workday) {
    const tenant = workday[1];
    const wd = workday[2];
    const site = workday[3];
    const host = `${tenant}.${wd}.myworkdayjobs.com`;
    return source({
      provider: "workday",
      board: site,
      jobsUrl: `https://${host}/wday/cxs/${tenant}/${site}/jobs`,
      label: "Workday",
    });
  }

  const bamboo = blob.match(/https?:\/\/([a-z0-9-]+)\.bamboohr\.com\/careers/i);
  if (bamboo) {
    const board = bamboo[1];
    return source({
      provider: "bamboohr",
      board,
      jobsUrl: `https://${board}.bamboohr.com/careers/list`,
      label: "BambooHR",
    });
  }

  const recruitee = blob.match(/https?:\/\/([a-z0-9-]+)\.recruitee\.com/i);
  if (recruitee) {
    const board = recruitee[1];
    return source({
      provider: "recruitee",
      board,
      jobsUrl: `https://${board}.recruitee.com/api/offers/`,
      label: "Recruitee",
    });
  }

  const kula = blob.match(/https?:\/\/careers\.kula\.ai\/([a-z0-9_-]+)\/\d+/i);
  const kulaBoard = cleanBoard(kula?.[1]);
  if (kulaBoard) {
    return source({
      provider: "kula",
      board: kulaBoard,
      jobsUrl: pageUrl,
      label: "Kula",
    });
  }

  return null;
}

export function providerLabel(provider: JobSource["provider"]): string {
  switch (provider) {
    case "greenhouse":
      return "Greenhouse";
    case "lever":
      return "Lever";
    case "ashby":
      return "Ashby";
    case "smartrecruiters":
      return "SmartRecruiters";
    case "workday":
      return "Workday";
    case "bamboohr":
      return "BambooHR";
    case "recruitee":
      return "Recruitee";
    case "kula":
      return "Kula";
    default:
      return "Careers page";
  }
}
