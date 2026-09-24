"use client";

import { previewTitles } from "@/lib/domains";
import type { Level, StateView } from "@/lib/types";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import { useEffect, useMemo, useState } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;
const LEVELS: Array<{ id: Level; label: string }> = [
  { id: "internship", label: "Internship" },
  { id: "full-time", label: "Full-time" },
  { id: "freelance", label: "Freelance" },
  { id: "contract", label: "Contract" },
  { id: "any", label: "Any" },
];

async function requestState(url: string, init?: RequestInit): Promise<StateView> {
  const response = await fetch(url, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const data = (await response.json()) as StateView & { error?: string; state?: StateView; sent?: boolean; reason?: string };
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data.state || data;
}

function Count({ value }: { value: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 650);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className="count">{shown}</span>;
}

function Boot() {
  return (
    <main className="shell" id="desk">
      <Mast />
      <section className="boot">
        <div className="radar" aria-hidden="true"><i /></div>
        <p className="kicker">Opening the desk</p>
        <h1>One moment…</h1>
      </section>
    </main>
  );
}

function Mast({
  date,
  profile,
  egg,
  onEgg,
  onEdit,
  onReset,
}: {
  date?: string;
  profile?: StateView["profile"];
  egg?: string;
  onEgg?: () => void;
  onEdit?: () => void;
  onReset?: () => void;
}) {
  return (
    <header className="mast">
      <button className="mark" type="button" onClick={onEgg} translate="no">
        <small>Personal</small>
        <strong>Hiring <em>Radar</em></strong>
      </button>
      <div className="mast-side">
        <p>{date || egg || "A private clipping desk"}</p>
        {profile ? (
          <div className="mast-actions">
            <button className="profile-btn" type="button" onClick={onEdit}>
              {profile.domain}
              {profile.levels.includes("any")
                ? " · Any"
                : ` · ${profile.levels.map((level) => LEVELS.find((item) => item.id === level)?.label || level).join(", ")}`}
            </button>
            <button className="texty start-over" type="button" onClick={onReset}>
              Start over
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function Onboarding({ onDone }: { onDone: (state: StateView) => void }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [domain, setDomain] = useState("");
  const [roles, setRoles] = useState("");
  const [levels, setLevels] = useState<Level[]>([]);
  const [keywords, setKeywords] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [opened, setOpened] = useState(false);
  const titles = useMemo(() => previewTitles(domain), [domain]);

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
    setError("");
  };

  const toggleLevel = (level: Level) => {
    setLevels((current) => {
      if (level === "any") return current.includes("any") ? [] : ["any"];
      const withoutAny = current.filter((item) => item !== "any");
      return withoutAny.includes(level) ? withoutAny.filter((item) => item !== level) : [...withoutAny, level];
    });
  };

  const finish = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter an email address so the list has somewhere to go.");
      document.getElementById("email")?.focus();
      return;
    }
    setSaving(true);
    setError("");
    try {
      await requestState("/api/profile", {
        method: "PUT",
        body: JSON.stringify({ domain, preferredRoles: roles, levels, keywords, email }),
      });
      setOpened(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the search.");
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!opened) return;
    const timer = window.setTimeout(async () => {
      onDone(await requestState("/api/state"));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [opened, onDone]);

  return (
    <main className="shell" id="desk">
      <Mast />
      <section className="step-card">
        <div className="progress" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => (
            <i key={index} className={index <= step ? "on" : ""} />
          ))}
        </div>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={opened ? "done" : step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            {opened ? (
              <>
                <p className="kicker">Ready</p>
                <h1>Watching {domain.trim()}.</h1>
                <p className="lede">Add a company website next. The radar will find the careers desk itself.</p>
              </>
            ) : null}
            {!opened && step === 0 ? (
              <>
                <p className="kicker">Field</p>
                <h1>What Field Are You Watching?</h1>
                <p className="lede">Type it in your own words. You do not need a job-title list.</p>
                <div className="stack">
                  <label htmlFor="domain">Domain</label>
                  <input id="domain" name="domain" autoComplete="off" value={domain} placeholder="Marketing…" onChange={(event) => setDomain(event.target.value)} />
                </div>
                {titles.length > 0 ? (
                  <div className="examples" aria-label="Example titles this field can include">
                    {titles.slice(0, 5).map((title) => (
                      <span key={title}>{title}</span>
                    ))}
                  </div>
                ) : domain.trim().length > 2 ? (
                  <p className="hint">Descriptions will be read for “{domain.trim()}”, even when the title never says it.</p>
                ) : (
                  <p className="hint">Marketing, design, finance, or anything more specific.</p>
                )}
              </>
            ) : null}
            {!opened && step === 1 ? (
              <>
                <p className="kicker">Optional</p>
                <h1>Any Roles to Lean Toward?</h1>
                <p className="lede">These raise a match. They never hide the rest of {domain.trim() || "the field"}.</p>
                <div className="stack">
                  <label htmlFor="roles">Preferred roles</label>
                  <input id="roles" name="preferred-roles" autoComplete="off" value={roles} placeholder="Growth, product marketing…" onChange={(event) => setRoles(event.target.value)} />
                </div>
                <p className="hint">Leave this blank to watch the whole field.</p>
              </>
            ) : null}
            {!opened && step === 2 ? (
              <>
                <p className="kicker">Level</p>
                <h1>What Kind of Work?</h1>
                <div className="chips">
                  {LEVELS.map((level) => (
                    <button key={level.id} type="button" aria-pressed={levels.includes(level.id)} onClick={() => toggleLevel(level.id)}>
                      {level.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            {!opened && step === 3 ? (
              <>
                <p className="kicker">Optional</p>
                <h1>Anything Else on Your Mind?</h1>
                <p className="lede">Keywords nudge ranking. A role can still qualify without them.</p>
                <div className="stack">
                  <label htmlFor="keywords">Keywords</label>
                  <input id="keywords" name="keywords" autoComplete="off" value={keywords} placeholder="AI, SaaS, B2B…" onChange={(event) => setKeywords(event.target.value)} />
                </div>
              </>
            ) : null}
            {!opened && step === 4 ? (
              <>
                <p className="kicker">Email</p>
                <h1>Where Should the List Go?</h1>
                <p className="lede">This address stays in the app. Notes about roles you can apply for are sent here.</p>
                <div className="stack">
                  <label htmlFor="email">Email</label>
                  <input id="email" name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} value={email} placeholder="you@example.com" onChange={(event) => setEmail(event.target.value)} />
                </div>
              </>
            ) : null}
          </motion.div>
        </AnimatePresence>
        {error ? <p className="error-line" aria-live="polite">{error}</p> : null}
        {!opened ? (
          <div className="step-actions">
            {step > 0 ? (
              <button className="texty" type="button" onClick={() => go(step - 1)}>Back</button>
            ) : null}
            {step < 4 ? (
              <button
                className="primary"
                type="button"
                onClick={() => {
                  if (step === 0 && domain.trim().length < 2) {
                    setError("Enter a field of at least 2 characters.");
                    document.getElementById("domain")?.focus();
                    return;
                  }
                  if (step === 2 && levels.length === 0) {
                    setError("Choose at least one kind of work.");
                    return;
                  }
                  go(step + 1);
                }}
              >
                <span className="btn-label">
                  {step === 0 ? "Continue to Roles" : step === 1 ? "Continue to Level" : step === 2 ? "Continue to Keywords" : "Continue to Email"}
                </span>
              </button>
            ) : (
              <button className="primary" type="button" disabled={saving} onClick={finish}>
                <span className="btn-label">{saving ? "Saving…" : "Open the Desk"}</span>
              </button>
            )}
          </div>
        ) : null}
      </section>
    </main>
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
  const [egg, setEgg] = useState("");
  const [eggCount, setEggCount] = useState(0);
  const [burst, setBurst] = useState(false);
  const [date, setDate] = useState("");

  useEffect(() => {
    setDate(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
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
      const previous = state.companies.length;
      const next = await requestState(urlPath, init);
      setState(next);
      if (kind === "add" && previous === 0 && next.companies.some((company) => company.status === "ready")) setBurst(true);
      if (kind === "add") setUrl("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="shell" id="desk">
      <Mast
        date={date}
        egg={egg}
        profile={profile}
        onEdit={() => setEditing(true)}
        onReset={() => setResetting(true)}
        onEgg={() => {
          const next = eggCount + 1;
          setEggCount(next);
          if (next === 5) setEgg("Still not a job board.");
        }}
      />
      <div className={state.companies.length === 0 ? "desk is-empty" : "desk"}>
        <section>
          {state.companies.length === 0 ? (
            <div className="hero">
              <div className={`radar ${burst ? "burst" : ""}`} aria-hidden="true">
                <i />
                {burst ? <Burst /> : null}
              </div>
              <p className="kicker">Companies to monitor</p>
              <h1>Add a Website</h1>
              <p className="lede">Only the company site. Careers pages and the hiring system behind them are found for you.</p>
              <form
                className="field"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run("add", "/api/companies", { method: "POST", body: JSON.stringify({ url }) });
                }}
              >
                <input
                  aria-label="Company website"
                  placeholder="https://sarvam.ai"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
                <button className="primary" disabled={busy !== null || url.trim().length < 3}>
                  <span className="btn-label">{busy === "add" ? phases[phase] : "Add company"}</span>
                </button>
              </form>
              {error ? <p className="error-line" aria-live="polite">{error}</p> : null}
            </div>
          ) : (
            <>
              <div className="desk-head">
                <div>
                  <p className="kicker">{state.digest?.kind === "quiet" ? "Today" : "Today's note"}</p>
                  <h1>
                    {state.digest?.kind === "quiet" ? headline : (
                      <>
                        <Count value={noted.length || state.roles.length} /> {headline.replace(/^\d+\s/, "")}
                      </>
                    )}
                  </h1>
                </div>
                <div className="actions">
                  <button className="primary" type="button" disabled={busy !== null} onClick={() => void run("scan", "/api/scan", { method: "POST" })}>
                    <span className="btn-label">{busy === "scan" ? phases[phase] : "Check companies"}</span>
                  </button>
                  <button
                    className="texty"
                    type="button"
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
                    {busy === "send" ? "Sending" : "Email me these roles"}
                  </button>
                  <p className="hint">
                    {profile.email
                      ? `At 4:00 PM the desk checks for new roles and emails ${profile.email} if any appeared.`
                      : "Add your email in the search. At 4:00 PM, new roles are emailed to that address."}
                  </p>
                  {notice ? <p className="hint">{notice}</p> : null}
                </div>
              </div>
              {error ? <p className="error-line" aria-live="polite">{error}</p> : null}
              {noted.length > 0 ? <RoleList roles={noted} label={state.digest?.kind === "baseline" ? "First look" : "New"} /> : null}
              {rest.length > 0 ? <RoleList roles={rest} label="Already open" offset={noted.length} /> : null}
              {aside.length > 0 ? (
                <RoleList roles={aside} label="Outside this level" offset={noted.length + rest.length} />
              ) : null}
              {state.roles.length === 0 ? (
                <p className="lede">The companies are on the desk. Nothing in the open roles reads as {profile.domain.toLowerCase()} yet.</p>
              ) : null}
            </>
          )}
        </section>
        {state.companies.length > 0 ? (
          <aside className="rail">
            <h2>Companies</h2>
            <form
              className="field"
              onSubmit={(event) => {
                event.preventDefault();
                void run("add", "/api/companies", { method: "POST", body: JSON.stringify({ url }) });
              }}
            >
              <input aria-label="Company website" placeholder="https://company.com" value={url} onChange={(event) => setUrl(event.target.value)} />
              <button className="primary" disabled={busy !== null || url.trim().length < 3}>
                <span className="btn-label">{busy === "add" ? phases[phase] : "Add company"}</span>
              </button>
            </form>
            <ul className="companies">
              {state.companies.map((company) => (
                <li key={company.id} className="company">
                  <strong>{company.name}</strong>
                  <p>{company.host}</p>
                  <p>{company.sourceLabel ? `${company.sourceLabel} · ${company.note}` : company.note}</p>
                  {company.error ? <p className="bad">{company.error}</p> : null}
                  <div className="company-actions">
                    <button className="texty" type="button" onClick={() => void run("scan", `/api/companies/${company.id}`, { method: "POST" })}>
                      {company.status === "error" ? "Try again" : "Check"}
                    </button>
                    <button
                      className="texty"
                      type="button"
                      onClick={() => {
                        if (confirmRemove !== company.id) {
                          setConfirmRemove(company.id);
                          return;
                        }
                        setConfirmRemove(null);
                        setError("");
                        void requestState(`/api/companies/${company.id}`, { method: "DELETE" })
                          .then(setState)
                          .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not remove it."));
                      }}
                    >
                      {confirmRemove === company.id ? "Remove now" : "Remove"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
      {resetting ? (
        <ResetTray
          onClose={() => setResetting(false)}
          onReset={async () => {
            const next = await requestState("/api/state", { method: "DELETE" });
            setState(next);
          }}
        />
      ) : null}
      {editing ? (
        <ProfileTray
          state={state}
          onClose={() => setEditing(false)}
          onSaved={(next) => {
            setState(next);
            setEditing(false);
          }}
        />
      ) : null}
      {reading && letter ? (
        <DigestTray
          subject={letter.subject}
          text={letter.text}
          notice={notice}
          onClose={() => setReading(false)}
        />
      ) : null}
    </main>
  );
}

function RoleList({ roles, label, offset = 0 }: { roles: StateView["roles"]; label: string; offset?: number }) {
  return (
    <>
      <p className="group-label">{label}</p>
      <ol className="clippings">
        {roles.map((role, index) => (
          <motion.li
            key={role.id}
            className="clipping"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.04, ease: EASE }}
          >
            <p className="index">{String(offset + index + 1).padStart(2, "0")}</p>
            <div>
              <h2>{role.title}</h2>
              <p className="meta">
                {role.companyName}
                {role.location ? ` · ${role.location}` : ""}
                {` · ${role.match.detectedLevel}`}
              </p>
              <p className="why">{role.match.reasons[0]}</p>
              <ul className="signals">
                {role.signals.map((signal) => (
                  <li key={signal}>{signal}</li>
                ))}
              </ul>
              <a className="open-role" href={role.url} target="_blank" rel="noreferrer">Open role</a>
              <div className="meter" aria-label={`Match ${role.match.score}`}>
                <span style={{ width: `${role.match.score}%` }} />
              </div>
            </div>
          </motion.li>
        ))}
      </ol>
    </>
  );
}

function Burst() {
  return (
    <>
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 8;
        return (
          <i
            key={index}
            style={{ ["--x" as string]: `${Math.cos(angle) * 42}px`, ["--y" as string]: `${Math.sin(angle) * 42}px` }}
          />
        );
      })}
    </>
  );
}

function ResetTray({ onClose, onReset }: { onClose: () => void; onReset: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button className="backdrop" type="button" aria-label="Close reset" onClick={onClose} />
      <aside className="tray short" role="dialog" aria-labelledby="reset-title">
        <header>
          <h2 id="reset-title">Start over</h2>
          <button className="texty" type="button" onClick={onClose}>Close</button>
        </header>
        <p className="lede">This clears the search, every company, and the roles already read. You begin again at the first question.</p>
        {error ? <p className="error-line" aria-live="polite">{error}</p> : null}
        <button
          className="primary"
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError("");
            void onReset().catch((caught) => {
              setError(caught instanceof Error ? caught.message : "Could not reset.");
              setBusy(false);
            });
          }}
        >
          <span className="btn-label">{busy ? "Clearing" : "Reset the desk"}</span>
        </button>
      </aside>
    </>
  );
}

function ProfileTray({
  state,
  onClose,
  onSaved,
}: {
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

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleLevel = (level: Level) => {
    setLevels((current) => {
      if (level === "any") return current.includes("any") ? [] : ["any"];
      const withoutAny = current.filter((item) => item !== "any");
      return withoutAny.includes(level) ? withoutAny.filter((item) => item !== level) : [...withoutAny, level];
    });
  };

  return (
    <>
      <button className="backdrop" type="button" aria-label="Close search" onClick={onClose} />
      <aside className="tray" role="dialog" aria-labelledby="search-title">
        <header>
          <h2 id="search-title">Your search</h2>
          <button className="texty" type="button" onClick={onClose}>Close</button>
        </header>
        <div className="stack">
          <label htmlFor="edit-domain">Domain</label>
          <input id="edit-domain" value={domain} onChange={(event) => setDomain(event.target.value)} />
          <label htmlFor="edit-email">Email</label>
          <input id="edit-email" type="email" value={email} placeholder="you@example.com" onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="edit-roles">Preferred roles</label>
          <input id="edit-roles" value={roles} onChange={(event) => setRoles(event.target.value)} />
        </div>
        <div className="chips">
          {LEVELS.map((level) => (
            <button key={level.id} type="button" aria-pressed={levels.includes(level.id)} onClick={() => toggleLevel(level.id)}>
              {level.label}
            </button>
          ))}
        </div>
        <div className="stack">
          <label htmlFor="edit-keywords">Keywords</label>
          <input id="edit-keywords" value={keywords} onChange={(event) => setKeywords(event.target.value)} />
        </div>
        {error ? <p className="error-line" aria-live="polite">{error}</p> : null}
        <button
          className="primary"
          type="button"
          disabled={saving}
          onClick={() => {
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
          <span className="btn-label">{saving ? "Saving" : "Save search"}</span>
        </button>
      </aside>
    </>
  );
}

function DigestTray({
  subject,
  text,
  notice,
  onClose,
}: {
  subject: string;
  text: string;
  notice: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button className="backdrop" type="button" aria-label="Close digest" onClick={onClose} />
      <aside className="tray short" role="dialog" aria-labelledby="digest-title">
        <header>
          <h2 id="digest-title">Today's note</h2>
          <button className="texty" type="button" onClick={onClose}>Close</button>
        </header>
        <p className="lede">{notice || subject}</p>
        <pre className="note">{text}</pre>
        <button
          className="primary"
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(text).then(() => setCopied(true));
          }}
        >
          <span className="btn-label">{copied ? "Copied" : "Copy note"}</span>
        </button>
      </aside>
    </>
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

  return (
    <MotionConfig reducedMotion="user">
      {booting || !state ? <Boot /> : state.profile ? <Desk state={state} setState={setState} /> : <Onboarding onDone={setState} />}
    </MotionConfig>
  );
}
