import assert from "node:assert/strict";
import test from "node:test";
import { buildDigest, buildRoleMail } from "./digest";
import { istParts } from "./schedule";

test("four pm India time is the daily check", () => {
  const afternoon = istParts(new Date("2026-09-23T10:30:00.000Z"));
  assert.equal(afternoon.hour, 16);
  assert.equal(afternoon.today, "2026-09-23");
  const before = istParts(new Date("2026-09-23T10:29:00.000Z"));
  assert.equal(before.hour, 15);
});

test("digest subject distinguishes new roles from a quiet day", () => {
  const fresh = buildDigest({
    domain: "Marketing",
    kind: "new",
    overflow: 0,
    roles: [
      {
        id: "1",
        title: "Community Intern",
        companyName: "Sarvam",
        url: "https://example.com/jobs/1",
        detectedLevel: "Internship",
        reasons: ["The responsibilities cover community."],
        signals: ["Posted in the last day"],
      },
    ],
  });
  assert.match(fresh.subject, /1 new Marketing role/);
  assert.match(fresh.text, /Community Intern/);

  const quiet = buildDigest({ domain: "Marketing", kind: "quiet", roles: [], overflow: 0 });
  assert.match(quiet.subject, /no new Marketing roles/);
});

test("role mail lists jobs and links back to the desk", () => {
  const all = buildRoleMail({
    domain: "Engineering",
    kind: "all",
    appUrl: "http://127.0.0.1:3456",
    roles: [{ title: "Robotics Engineer", companyName: "Skild AI", location: "San Mateo", detectedLevel: "Full-time" }],
  });
  assert.match(all.subject, /1 Engineering role you can apply for/);
  assert.match(all.text, /Robotics Engineer/);
  assert.match(all.text, /http:\/\/127\.0\.0\.1:3456/);
  assert.doesNotMatch(all.text, /boards\.greenhouse/);

  const fresh = buildRoleMail({
    domain: "Engineering",
    kind: "new",
    appUrl: "http://127.0.0.1:3456",
    roles: [{ title: "Firmware Engineer", companyName: "Skild AI", location: "", detectedLevel: "Full-time" }],
  });
  assert.match(fresh.subject, /1 new Engineering role/);
  assert.match(fresh.html, /Open the desk to apply/);
});
