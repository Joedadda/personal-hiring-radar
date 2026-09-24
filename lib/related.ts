import type { MatchResult } from "./types";

export type RelatedRole = { title: string; excerpt: string };

export function relatedField(input: { domain: string; preferredRoles?: string; keywords?: string }): string {
  return [input.domain, input.preferredRoles || "", input.keywords || ""].map((part) => part.trim()).join("\n");
}

export function applyRelatedFit(match: MatchResult, fieldLabel: string, title: string): MatchResult {
  if (match.domainMatch) return match;
  const fitsLevel = match.levelFit > 0;
  return {
    ...match,
    domainMatch: true,
    relevant: fitsLevel,
    titleSaysDomain: false,
    reasons: [`Related to ${fieldLabel}: ${title} is the same kind of work.`, ...match.reasons],
    score: fitsLevel ? Math.min(99, Math.max(match.score, 12) + match.roleScore + match.keywordScore + match.levelFit) : match.score,
  };
}

export async function judgeRelated(input: {
  domain: string;
  preferredRoles?: string;
  keywords?: string;
  roles: RelatedRole[];
  apiKey?: string;
  fetchImpl?: typeof fetch;
}): Promise<Set<string> | null> {
  const apiKey = input.apiKey ?? process.env.MATCH_API_KEY ?? "";
  if (!apiKey || input.roles.length === 0) return null;
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: [
                    "You decide which roles are the same kind of work as the user's field.",
                    "Reply with JSON {\"titles\": string[]}.",
                    "Include a title only when the role is that kind of work.",
                    "Do not include near misses from other professions.",
                    JSON.stringify({
                      field: input.domain,
                      preferredRoles: input.preferredRoles || "",
                      keywords: input.keywords || "",
                      roles: input.roles,
                    }),
                  ].join("\n"),
                },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      }
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = body.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(content) as { titles?: string[] };
    return new Set((parsed.titles || []).map((title) => title.trim().toLowerCase()).filter(Boolean));
  } catch {
    return null;
  }
}
