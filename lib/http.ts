export class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchError";
  }
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host === "0.0.0.0" || host === "::1") {
    return true;
  }
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;
  const match = host.match(/^172\.(\d+)\./);
  if (match) {
    const octet = Number(match[1]);
    if (octet >= 16 && octet <= 31) return true;
  }
  return false;
}

export function assertPublicUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new FetchError("That doesn't look like a website address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new FetchError("Use an http or https website.");
  }
  if (url.username || url.password) {
    throw new FetchError("Remove the username and password from the URL.");
  }
  if (isPrivateHost(url.hostname)) {
    throw new FetchError("Private and local addresses are skipped.");
  }
  return url;
}

export function normalizeWebsite(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new FetchError("Enter a company website.");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = assertPublicUrl(withProtocol);
  url.hash = "";
  return url.toString();
}

export async function fetchText(input: string, timeoutMs = 12_000): Promise<{
  url: string;
  status: number;
  text: string;
  contentType: string;
}> {
  const url = assertPublicUrl(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": BROWSER_UA,
        accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
      },
    });
    assertPublicUrl(response.url);
    const text = (await response.text()).slice(0, 1_500_000);
    return {
      url: response.url,
      status: response.status,
      text,
      contentType: response.headers.get("content-type") || "",
    };
  } catch (error) {
    if (error instanceof FetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new FetchError("The site took too long to answer.");
    }
    throw new FetchError("The site could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJson<T>(input: string, init?: { method?: string; body?: unknown }, timeoutMs = 12_000): Promise<{
  url: string;
  status: number;
  data: T;
}> {
  const url = assertPublicUrl(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      method: init?.method || "GET",
      signal: controller.signal,
      headers: {
        "user-agent": BROWSER_UA,
        accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
        ...(init?.body ? { "content-type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
    assertPublicUrl(response.url);
    const text = (await response.text()).slice(0, 12_000_000);
    let data = {} as T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new FetchError("The job feed did not return readable data.");
    }
    return { url: response.url, status: response.status, data };
  } catch (error) {
    if (error instanceof FetchError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new FetchError("The job feed took too long.");
    throw new FetchError("The job feed could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}
