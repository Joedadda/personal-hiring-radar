import { splitList } from "../text";

const QUERY_CAP = 10;

export function generateLinkedInQueries(input: {
  company: string;
  domain: string;
  preferredRoles?: string;
  host?: string;
}): string[] {
  const company = input.company.trim().replace(/"/g, "");
  const domain = input.domain.trim().replace(/"/g, "");
  const host = (input.host || "").trim().replace(/^www\./, "").replace(/"/g, "");
  if (!company) return [];
  const queries = [
    `site:linkedin.com/posts "${company}" hiring ${domain}`.trim(),
    `site:linkedin.com/posts "${company}" "we're hiring"`,
    `site:linkedin.com/posts "at ${company}" hiring ${domain}`.trim(),
    `site:linkedin.com/posts "at ${company}" "we're hiring"`,
    `site:linkedin.com/posts "at ${company}" "looking for" ${domain}`.trim(),
  ];
  if (host.includes(".")) {
    queries.push(`site:linkedin.com/posts "${host}" "we're hiring"`);
    queries.push(`site:linkedin.com/posts "${host}" hiring`);
  }
  const role = splitList(input.preferredRoles || "")[0];
  if (role) queries.push(`site:linkedin.com/posts "at ${company}" hiring "${role.replace(/"/g, "")}"`);
  return [...new Set(queries.map((query) => query.replace(/\s+/g, " ").trim()))].slice(0, QUERY_CAP);
}
