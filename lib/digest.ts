import { escapeHtml } from "./text";

export type DigestRole = {
  id: string;
  title: string;
  companyName: string;
  url: string;
  detectedLevel: string;
  reasons: string[];
  signals: string[];
};

export function buildDigest(input: {
  domain: string;
  kind: "new" | "baseline" | "quiet";
  roles: DigestRole[];
  overflow: number;
}): { subject: string; text: string; html: string } {
  const domain = input.domain.trim() || "your domain";
  const count = input.roles.length;

  const subject =
    input.kind === "quiet"
      ? `Hiring Radar: no new ${domain} roles`
      : input.kind === "baseline"
        ? `Hiring Radar: ${count} open ${domain} role${count === 1 ? "" : "s"}`
        : `Hiring Radar: ${count} new ${domain} role${count === 1 ? "" : "s"}`;

  if (input.kind === "quiet" || count === 0) {
    const text = [
      subject,
      "",
      `Nothing new on the companies you watch fits ${domain} closely enough to send.`,
      "Roles already on your desk stay there until they leave the board.",
    ].join("\n");
    return { subject, text, html: `<p>${escapeHtml(text).replaceAll("\n", "<br>")}</p>` };
  }

  const intro =
    input.kind === "baseline"
      ? `This is the first look. These ${domain} roles are already open, judged from the description rather than the job title.`
      : `New since the last check. Relevance comes from the description, not from whether the title says “${domain}”.`;

  const lines = input.roles.map((role, index) => {
    const why = role.reasons[0] || "";
    const signal = role.signals.filter((item) => item.length < 140)[0] || "";
    return [
      `${index + 1}. ${role.title} — ${role.companyName} (${role.detectedLevel})`,
      why,
      signal,
      role.url,
    ]
      .filter(Boolean)
      .join("\n");
  });

  const extra = input.overflow > 0 ? `\n\n${input.overflow} more relevant roles are on your desk.` : "";
  const text = [subject, "", intro, "", ...lines.flatMap((line) => [line, ""]), extra.trimEnd()].join("\n").trim();

  const items = input.roles
    .map((role) => {
      const why = role.reasons[0] || "";
      const signal = role.signals.filter((item) => item.length < 140)[0] || "";
      return `<li style="margin:0 0 18px">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px">${escapeHtml(role.title)}</div>
        <div style="color:#5c5348;margin:4px 0">${escapeHtml(role.companyName)} · ${escapeHtml(role.detectedLevel)}</div>
        <div>${escapeHtml(why)}</div>
        ${signal ? `<div style="color:#5c5348;margin-top:4px">${escapeHtml(signal)}</div>` : ""}
        <div style="margin-top:6px"><a href="${escapeHtml(role.url)}">${escapeHtml(role.url)}</a></div>
      </li>`;
    })
    .join("");

  const html = `<div style="background:#ffffff;color:#1a1612;padding:28px;font-family:Arial,Helvetica,sans-serif">
    <div style="letter-spacing:.14em;text-transform:uppercase;font-size:12px">Hiring Radar</div>
    <h1 style="font-weight:500;font-size:28px;margin:8px 0 12px">${escapeHtml(subject.replace("Hiring Radar: ", ""))}</h1>
    <p>${escapeHtml(intro)}</p>
    <ol style="padding-left:18px">${items}</ol>
    ${input.overflow > 0 ? `<p>${input.overflow} more relevant roles are on your desk.</p>` : ""}
  </div>`;

  return { subject, text, html };
}

export function buildRoleMail(input: {
  domain: string;
  kind: "all" | "new";
  roles: Array<{ title: string; companyName: string; location: string; detectedLevel: string }>;
  appUrl: string;
}): { subject: string; text: string; html: string } {
  const domain = input.domain.trim() || "your field";
  const count = input.roles.length;
  const subject =
    input.kind === "new"
      ? `Hiring Radar: ${count} new ${domain} role${count === 1 ? "" : "s"}`
      : `Hiring Radar: ${count} ${domain} role${count === 1 ? "" : "s"} you can apply for`;
  const intro =
    input.kind === "new"
      ? "These roles showed up since the last check. Open the desk to apply."
      : "These are the open roles that fit your search. Open the desk to apply.";
  const lines = input.roles.map(
    (role, index) =>
      `${index + 1}. ${role.title} — ${role.companyName}${role.location ? ` · ${role.location}` : ""} (${role.detectedLevel})`
  );
  const text = [subject, "", intro, "", ...lines, "", `Open the desk: ${input.appUrl}`].join("\n");
  const items = input.roles
    .map(
      (role) => `<li style="margin:0 0 14px">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px">${escapeHtml(role.title)}</div>
        <div style="color:#5c5348;margin-top:4px">${escapeHtml(role.companyName)}${role.location ? ` · ${escapeHtml(role.location)}` : ""} · ${escapeHtml(role.detectedLevel)}</div>
      </li>`
    )
    .join("");
  const html = `<div style="background:#ffffff;color:#1a1612;padding:28px;font-family:Arial,Helvetica,sans-serif">
    <div style="letter-spacing:.14em;text-transform:uppercase;font-size:12px">Hiring Radar</div>
    <h1 style="font-weight:500;font-size:28px;margin:8px 0 12px">${escapeHtml(subject.replace("Hiring Radar: ", ""))}</h1>
    <p>${escapeHtml(intro)}</p>
    <ol style="padding-left:18px">${items}</ol>
    <p style="margin-top:22px"><a href="${escapeHtml(input.appUrl)}">Open the desk to apply</a></p>
  </div>`;
  return { subject, text, html };
}
