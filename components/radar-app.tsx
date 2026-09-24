"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { previewTitles } from "@/lib/domains";
import type { Level, StateView } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

const LEVELS: Array<{ id: Level; label: string }> = [
  { id: "internship", label: "Internship" },
  { id: "full-time", label: "Full-time" },
  { id: "freelance", label: "Freelance" },
  { id: "contract", label: "Contract" },
  { id: "any", label: "Any" },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function requestState(url: string, init?: RequestInit): Promise<StateView> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const data = (await response.json()) as StateView & { error?: string };
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function levelLabel(profile: NonNullable<StateView["profile"]>) {
  if (profile.levels.includes("any")) return "Any";
  return profile.levels.map((level) => LEVELS.find((item) => item.id === level)?.label || level).join(", ");
}

function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

function LevelPicker({ levels, onToggle }: { levels: Level[]; onToggle: (level: Level) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {LEVELS.map((level) => {
        const pressed = levels.includes(level.id);
        return (
          <Button
            key={level.id}
            type="button"
            variant={pressed ? "default" : "outline"}
            aria-pressed={pressed}
            onClick={() => onToggle(level.id)}
          >
            {level.label}
          </Button>
        );
      })}
    </div>
  );
}

function Boot() {
  return (
    <main id="desk" className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-24 w-full" />
    </main>
  );
}

function Mast({
  date,
  profile,
  onEdit,
  onReset,
}: {
  date?: string;
  profile?: StateView["profile"];
  onEdit?: () => void;
  onReset?: () => void;
}) {
  return (
    <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Personal</p>
        <p className="text-lg font-semibold" translate="no">Hiring Radar</p>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <p className="text-sm text-muted-foreground">{date || "A private clipping desk"}</p>
        {profile ? (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onEdit}>
              {profile.domain} · {levelLabel(profile)}
            </Button>
            <Button type="button" variant="ghost" onClick={onReset}>
              Start Over
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function Onboarding({ onDone }: { onDone: (state: StateView) => void }) {
  const [step, setStep] = useState(0);
  const [domain, setDomain] = useState("");
  const [roles, setRoles] = useState("");
  const [levels, setLevels] = useState<Level[]>([]);
  const [keywords, setKeywords] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const titles = useMemo(() => previewTitles(domain), [domain]);

  const toggleLevel = (level: Level) => {
    setLevels((current) => {
      if (level === "any") return current.includes("any") ? [] : ["any"];
      const withoutAny = current.filter((item) => item !== "any");
      return withoutAny.includes(level) ? withoutAny.filter((item) => item !== level) : [...withoutAny, level];
    });
  };

  const next = () => {
    if (step === 0 && domain.trim().length < 2) {
      setError("Enter a field of at least 2 characters.");
      document.getElementById("domain")?.focus();
      return;
    }
    if (step === 2 && levels.length === 0) {
      setError("Choose at least one kind of work.");
      return;
    }
    setError("");
    setStep((current) => current + 1);
  };

  const finish = async () => {
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Enter an email address so the list has somewhere to go.");
      document.getElementById("email")?.focus();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await requestState("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ domain, preferredRoles: roles, levels, keywords, email }),
      });
      onDone(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the search.");
      setSaving(false);
    }
  };

  return (
    <main id="desk" className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      <Mast />
      <Card>
        <CardHeader>
          <Progress value={((step + 1) / 5) * 100} aria-label={`Step ${step + 1} of 5`} />
          <CardTitle>
            {step === 0 && "What Field Are You Watching?"}
            {step === 1 && "Any Roles to Lean Toward?"}
            {step === 2 && "What Kind of Work?"}
            {step === 3 && "Anything Else on Your Mind?"}
            {step === 4 && "Where Should the List Go?"}
          </CardTitle>
          <CardDescription>
            {step === 0 && "Type it in your own words. You do not need a job-title list."}
            {step === 1 && `These raise a match. They never hide the rest of ${domain.trim() || "the field"}.`}
            {step === 3 && "Keywords nudge ranking. A role can still qualify without them."}
            {step === 4 && "This address stays in the app. Notes about roles you can apply for are sent here."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {step === 0 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" name="domain" autoComplete="off" value={domain} placeholder="Marketing…" onChange={(event) => setDomain(event.target.value)} />
              {titles.length > 0 ? (
                <div className="flex flex-wrap gap-2" aria-label="Example titles this field can include">
                  {titles.slice(0, 5).map((title) => (
                    <Badge key={title} variant="secondary">{title}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {domain.trim().length > 2
                    ? `Descriptions will be read for “${domain.trim()}”, even when the title never says it.`
                    : "Marketing, design, finance, or anything more specific."}
                </p>
              )}
            </div>
          ) : null}
          {step === 1 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="roles">Preferred roles</Label>
              <Input id="roles" name="preferred-roles" autoComplete="off" value={roles} placeholder="Growth, product marketing…" onChange={(event) => setRoles(event.target.value)} />
              <p className="text-sm text-muted-foreground">Leave this blank to watch the whole field.</p>
            </div>
          ) : null}
          {step === 2 ? <LevelPicker levels={levels} onToggle={toggleLevel} /> : null}
          {step === 3 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="keywords">Keywords</Label>
              <Input id="keywords" name="keywords" autoComplete="off" value={keywords} placeholder="AI, SaaS, B2B…" onChange={(event) => setKeywords(event.target.value)} />
            </div>
          ) : null}
          {step === 4 ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} value={email} placeholder="you@example.com" onChange={(event) => setEmail(event.target.value)} />
            </div>
          ) : null}
          <ErrorNote message={error} />
        </CardContent>
        <CardFooter className="justify-between">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => { setError(""); setStep((current) => current - 1); }}>
              Back
            </Button>
          ) : <span />}
          {step < 4 ? (
            <Button type="button" onClick={next}>
              {step === 0 ? "Continue to Roles" : step === 1 ? "Continue to Level" : step === 2 ? "Continue to Keywords" : "Continue to Email"}
            </Button>
          ) : (
            <Button type="button" disabled={saving} onClick={() => void finish()}>
              {saving ? "Saving…" : "Open the Desk"}
            </Button>
          )}
        </CardFooter>
      </Card>
    </main>
  );
}

function CompanyForm({
  url,
  setUrl,
  busy,
  label,
  onSubmit,
}: {
  url: string;
  setUrl: (value: string) => void;
  busy: boolean;
  label: string;
  onSubmit: () => void;
}) {
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Input
        id="company-url"
        name="website"
        type="text"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        aria-label="Company website"
        placeholder="company.com"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
      />
      <Button type="submit" disabled={busy}>
        {label}
      </Button>
    </form>
  );
}

function Desk({ state, setState }: { state: StateView; setState: (state: StateView) => void }) {
  const profile = state.profile;
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<"add" | "scan" | "send" | null>(null);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [reading, setReading] = useState(false);
  const [letter, setLetter] = useState<{ subject: string; text: string } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [date, setDate] = useState("");

  useEffect(() => {
    setDate(new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()));
  }, []);

  useEffect(() => {
    if (!busy) return;
    const timer = window.setInterval(() => setPhase((value) => (value + 1) % 3), 1600);
    return () => window.clearInterval(timer);
  }, [busy]);

  if (!profile) return null;
  const phases = ["Opening the website…", "Finding the careers desk…", "Reading the roles…"];
  const noted = state.roles.filter((role) => role.inDigest);
  const fitting = state.roles.filter((role) => role.match.relevant);
  const aside = state.roles.filter((role) => !role.match.relevant);
  const rest = fitting.filter((role) => !role.inDigest);
  const headline =
    state.digest?.kind === "new"
      ? `${noted.length} new role${noted.length === 1 ? "" : "s"} in ${profile.domain}`
      : state.digest?.kind === "baseline"
        ? `${noted.length} open role${noted.length === 1 ? "" : "s"} in ${profile.domain}`
        : fitting.length > 0
          ? `No new roles. ${fitting.length} still open.`
          : aside.length > 0
            ? `${aside.length} ${profile.domain} role${aside.length === 1 ? " is" : "s are"} open, outside this level.`
            : `Nothing on the boards fits ${profile.domain} yet.`;
  const removing = state.companies.find((company) => company.id === confirmRemove);

  const addCompany = () => {
    if (url.trim().length < 3) {
      setError("Enter a company website, like company.com.");
      document.getElementById("company-url")?.focus();
      return;
    }
    void run("add", "/api/companies", { method: "POST", body: JSON.stringify({ url }) });
  };

  const run = async (kind: "add" | "scan" | "send", urlPath: string, init?: RequestInit) => {
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      if (kind === "send") {
        const response = await fetch(urlPath, { method: "POST" });
        const data = (await response.json()) as {
          error?: string;
          reason?: string;
          sent?: boolean;
          subject?: string;
          text?: string;
          state?: StateView;
        };
        if (!response.ok) throw new Error(data.error || "Could not send.");
        if (data.state) setState(data.state);
        setNotice(data.sent ? `Sent to ${profile.email}.` : data.reason || "The note is ready to copy.");
        if (!data.sent && data.text && data.subject) {
          setLetter({ subject: data.subject, text: data.text });
          setReading(true);
        }
        return;
      }
      const next = await requestState(urlPath, init);
      setState(next);
      if (kind === "add") setUrl("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main id="desk" className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8">
      <Mast date={date} profile={profile} onEdit={() => setEditing(true)} onReset={() => setResetting(true)} />
      {state.companies.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Add a Website</CardTitle>
            <CardDescription>Only the company site. Careers pages and the hiring system behind them are found for you.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <CompanyForm url={url} setUrl={setUrl} busy={busy !== null} label={busy === "add" ? phases[phase] : "Add Company"} onSubmit={addCompany} />
            <ErrorNote message={error} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="text-3xl font-semibold tracking-tight text-balance">{headline}</h1>
              <div className="flex flex-col items-start gap-2 sm:items-end">
                <Button type="button" disabled={busy !== null} onClick={() => void run("scan", "/api/scan", { method: "POST" })}>
                  {busy === "scan" ? phases[phase] : "Check Companies"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null || fitting.length === 0}
                  onClick={() => {
                    if (!profile.email) {
                      setEditing(true);
                      setNotice("Add your email, then send the list.");
                      return;
                    }
                    void run("send", "/api/digest", { method: "POST" });
                  }}
                >
                  {busy === "send" ? "Sending…" : "Send the Role List"}
                </Button>
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {notice ||
                    (profile.email
                      ? `At 4:00 PM the desk checks for new roles and emails ${profile.email} if any appeared.`
                      : "Add your email in the search. At 4:00 PM, new roles are emailed to that address.")}
                </p>
              </div>
            </div>
            <ErrorNote message={error} />
            {noted.length > 0 ? <RoleList roles={noted} label={state.digest?.kind === "baseline" ? "First look" : "New"} /> : null}
            {rest.length > 0 ? <RoleList roles={rest} label="Already open" offset={noted.length} /> : null}
            {aside.length > 0 ? <RoleList roles={aside} label="Outside this level" offset={noted.length + rest.length} /> : null}
            {state.roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">The companies are on the desk. Nothing in the open roles reads as {profile.domain.toLowerCase()} yet.</p>
            ) : null}
          </section>
          <Card>
            <CardHeader>
              <CardTitle>Companies</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <CompanyForm url={url} setUrl={setUrl} busy={busy !== null} label={busy === "add" ? phases[phase] : "Add Company"} onSubmit={addCompany} />
              <Separator />
              <ScrollArea className="max-h-[60vh]">
                <ul className="flex flex-col gap-3">
                  {state.companies.map((company) => (
                    <li key={company.id} className="flex flex-col gap-1">
                      <p className="font-medium">{company.name}</p>
                      <p className="text-sm text-muted-foreground">{company.host}</p>
                      <p className="text-sm text-muted-foreground">{company.sourceLabel ? `${company.sourceLabel} · ${company.note}` : company.note}</p>
                      {company.error ? <p className="text-sm text-destructive">{company.error}</p> : null}
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => void run("scan", `/api/companies/${company.id}`, { method: "POST" })}>
                          {company.status === "error" ? `Try ${company.name} Again` : `Check ${company.name}`}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRemove(company.id)}>
                          Remove {company.name}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog open={confirmRemove !== null} onOpenChange={(open) => { if (!open) setConfirmRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name || "this company"}?</AlertDialogTitle>
            <AlertDialogDescription>The roles already read for this company leave the desk.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const id = confirmRemove;
                setConfirmRemove(null);
                if (!id) return;
                void requestState(`/api/companies/${id}`, { method: "DELETE" })
                  .then(setState)
                  .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not remove it."));
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetting} onOpenChange={(open) => { if (!open) setResetting(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Over</AlertDialogTitle>
            <AlertDialogDescription>This clears the search, every company, and the roles already read. You begin again at the first question.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                void requestState("/api/state", { method: "DELETE" }).then(setState);
              }}
            >
              Reset the Desk
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ProfileTray
        open={editing}
        state={state}
        onClose={() => setEditing(false)}
        onSaved={(next) => {
          setState(next);
          setEditing(false);
        }}
      />

      <Sheet open={reading} onOpenChange={(open) => { if (!open) setReading(false); }}>
        <SheetContent side="bottom" className="z-[60] max-h-[80vh]">
          <SheetHeader>
            <SheetTitle>Today’s Note</SheetTitle>
            <SheetDescription>{notice || letter?.subject}</SheetDescription>
          </SheetHeader>
          <ScrollArea className="max-h-[50vh] px-4">
            <pre className="font-sans text-sm whitespace-pre-wrap">{letter?.text}</pre>
          </ScrollArea>
          <SheetFooter>
            <Button
              type="button"
              onClick={() => {
                if (letter) void navigator.clipboard.writeText(letter.text);
              }}
            >
              Copy Note
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </main>
  );
}

function RoleList({ roles, label, offset = 0 }: { roles: StateView["roles"]; label: string; offset?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      {roles.map((role, index) => (
        <Card key={role.id}>
          <CardHeader>
            <CardDescription className="tabular-nums">{String(offset + index + 1).padStart(2, "0")}</CardDescription>
            <CardTitle className="text-lg">{role.title}</CardTitle>
            <CardDescription>
              {role.companyName}
              {role.location ? ` · ${role.location}` : ""}
              {` · ${role.match.detectedLevel}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p>{role.match.reasons[0]}</p>
            <ul className="text-sm text-muted-foreground">
              {role.signals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
            <Button variant="link" className="h-auto justify-start px-0" render={<a href={role.url} target="_blank" rel="noreferrer" />}>
              Open {role.title}
            </Button>
            <Progress value={role.match.score} aria-label={`Match ${role.match.score}`} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProfileTray({
  open,
  state,
  onClose,
  onSaved,
}: {
  open: boolean;
  state: StateView;
  onClose: () => void;
  onSaved: (state: StateView) => void;
}) {
  const profile = state.profile;
  const [domain, setDomain] = useState(profile?.domain || "");
  const [email, setEmail] = useState(profile?.email || "");
  const [roles, setRoles] = useState(profile?.preferredRoles || "");
  const [keywords, setKeywords] = useState(profile?.keywords || "");
  const [levels, setLevels] = useState<Level[]>(profile?.levels || []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleLevel = (level: Level) => {
    setLevels((current) => {
      if (level === "any") return current.includes("any") ? [] : ["any"];
      const withoutAny = current.filter((item) => item !== "any");
      return withoutAny.includes(level) ? withoutAny.filter((item) => item !== level) : [...withoutAny, level];
    });
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent className="z-[60] overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your Search</SheetTitle>
          <SheetDescription>Update the field, level, and address used for the desk.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-domain">Domain</Label>
            <Input id="edit-domain" name="domain" autoComplete="off" value={domain} placeholder="Marketing…" onChange={(event) => setDomain(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} value={email} placeholder="you@example.com" onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-roles">Preferred roles</Label>
            <Input id="edit-roles" name="preferred-roles" autoComplete="off" value={roles} placeholder="Growth, product marketing…" onChange={(event) => setRoles(event.target.value)} />
          </div>
          <LevelPicker levels={levels} onToggle={toggleLevel} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-keywords">Keywords</Label>
            <Input id="edit-keywords" name="keywords" autoComplete="off" value={keywords} placeholder="AI, SaaS, B2B…" onChange={(event) => setKeywords(event.target.value)} />
          </div>
          <ErrorNote message={error} />
        </div>
        <SheetFooter>
          <Button
            type="button"
            disabled={saving}
            onClick={() => {
              if (!EMAIL_PATTERN.test(email.trim())) {
                setError("Enter an email address so the list has somewhere to go.");
                document.getElementById("edit-email")?.focus();
                return;
              }
              if (domain.trim().length < 2) {
                setError("Enter a field of at least 2 characters.");
                document.getElementById("edit-domain")?.focus();
                return;
              }
              if (levels.length === 0) {
                setError("Choose at least one kind of work.");
                return;
              }
              setSaving(true);
              void requestState("/api/profile", {
                method: "PUT",
                body: JSON.stringify({ domain, preferredRoles: roles, levels, keywords, email }),
              })
                .then(onSaved)
                .catch((caught) => {
                  setError(caught instanceof Error ? caught.message : "Could not save.");
                  setSaving(false);
                });
            }}
          >
            {saving ? "Saving…" : "Save Search"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export function RadarApp() {
  const [state, setState] = useState<StateView | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let live = true;
    requestState("/api/state")
      .then((next) => {
        if (live) setState(next);
      })
      .catch(() => {
        if (live) setState({ profile: null, companies: [], roles: [], digest: null, smtpConfigured: false });
      })
      .finally(() => {
        if (live) setBooting(false);
      });
    return () => {
      live = false;
    };
  }, []);

  if (booting || !state) return <Boot />;
  if (!state.profile) return <Onboarding onDone={setState} />;
  return <Desk state={state} setState={setState} />;
}
