const appUrl = process.env.APP_BASE_URL;
const password = process.env.ALIGNERLOG_LOGIN_PASSWORD;

if (!appUrl) {
  console.error("APP_BASE_URL is required.");
  process.exit(1);
}

const base = appUrl.replace(/\/$/u, "");

async function expectStatus(path, init, expectedStatus) {
  const response = await fetch(`${base}${path}`, init);

  if (response.status !== expectedStatus) {
    throw new Error(`${path} expected ${expectedStatus}, received ${response.status}`);
  }

  return response;
}

async function expectOk(path, init) {
  const response = await fetch(`${base}${path}`, init);

  if (!response.ok) {
    throw new Error(`${path} expected ok response, received ${response.status}`);
  }

  return response;
}

await expectStatus("/login", undefined, 200);
await expectStatus("/today", { redirect: "manual" }, 307);
await expectStatus("/api/snapshot", undefined, 401);
await expectStatus("/manifest.webmanifest", undefined, 200);
await expectStatus("/sw.js", undefined, 200);
await expectStatus(
  "/api/auth/login",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong-password" })
  },
  401
);

if (password) {
  const login = await expectStatus(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    },
    200
  );
  const cookie = login.headers.get("set-cookie")?.split(";")[0];

  if (!cookie) {
    throw new Error("Login did not return a session cookie.");
  }

  await expectStatus("/api/snapshot", { headers: { cookie } }, 200);
  const calendar = await expectOk("/api/calendar", { headers: { cookie } });
  const calendarPayload = await calendar.json();
  if (!Array.isArray(calendarPayload.days) || calendarPayload.days.length < 28) {
    throw new Error("Calendar API did not return a month grid.");
  }
  const today = new Date().toISOString().slice(0, 10);
  await expectOk("/api/notes", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ date: today, note: "cloud smoke note" })
  });
  const settings = await expectOk("/api/settings", { headers: { cookie } });
  const settingsPayload = await settings.json();
  await expectOk("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      treatmentPlan: {
        dailyGoalMinutes: settingsPayload.treatmentPlan.dailyGoalMinutes
      }
    })
  });
  await expectOk("/api/export/json", { headers: { cookie } });
  await expectOk("/api/export/csv", { headers: { cookie } });
}

console.log("AlignerLog cloud smoke passed.");
