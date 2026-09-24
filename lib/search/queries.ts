import { splitList } from "../text";

const QUERY_CAP = 6;

export function generateLinkedInQueries(input: {
  company: string;
  domain: string;
  preferredRoles?: string;
}): string[] {
  const company = input.company.trim().replace(/"/g, "");
  const domain = input.domain.trim().replace(/"/g, "");
  if (!company) return [];
  const queries = [
    `site:linkedin.com/posts "${company}" hiring ${domain}`.trim(),
    `site:linkedin.com/posts "${company}" "we're hiring"`,
    `site:linkedin.com/posts "${company}" "looking for" ${domain}`.trim(),
    `site:linkedin.com/posts "${company}" "join our team"`,
  ];
  for (const role of splitList(input.preferredRoles || "").slice(0, 2)) {
    queries.push(`site:linkedin.com/posts "${company}" hiring "${role.replace(/"/g, "")}"`);
  }
  return [...new Set(queries.map((query) => query.replace(/\s+/g, " ").trim()))].slice(0, QUERY_CAP);
}
