const appUrl = process.env.APP_BASE_URL;
const smokeEmail = process.env.ALIGNERLOG_SMOKE_EMAIL ?? "smoke@loo-dental.local";
const smokePassword = process.env.ALIGNERLOG_SMOKE_PASSWORD ?? process.env.ALIGNERLOG_LOGIN_PASSWORD;
const confirmImport = process.env.ALIGNERLOG_SMOKE_CONFIRM_IMPORT === "true";

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
await expectStatus("/register", undefined, 200);
await expectStatus("/today", { redirect: "manual" }, 307);
await expectStatus("/api/snapshot", undefined, 401);
await expectStatus("/api/treatment-plan/import", { method: "POST" }, 401);
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

if (smokePassword) {
  const loginResponse = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: smokeEmail, password: smokePassword })
  });
  const login = loginResponse.status === 200
    ? loginResponse
    : await expectStatus(
      "/api/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: smokeEmail, password: smokePassword })
      },
      200
    );

  if (loginResponse.status !== 200 && loginResponse.status !== 401) {
    throw new Error(`/api/auth/login expected 200 or 401 for smoke user, received ${loginResponse.status}`);
  }

  const cookie = login.headers.get("set-cookie")?.split(";")[0];

  if (!cookie) {
    throw new Error("Login/register did not return a session cookie.");
  }

  await expectStatus(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: smokeEmail, password: "wrong-password" })
    },
    401
  );

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
  const importPayload = {
    status: "active",
    seriesType: "active",
    name: confirmImport ? "Smoke Confirm" : "Smoke Preview",
    currentTrayNumber: 1,
    totalTrays: 3,
    overallTotalTrays: 3,
    overallTreatmentDays: 21,
    trayIntervalDays: 7,
    dailyGoalMinutes: 1320,
    currentTrayStartDate: today
  };

  await expectOk("/api/treatment-plan/import", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({
      mode: "preview",
      plan: importPayload
    })
  });

  if (confirmImport) {
    await expectOk("/api/treatment-plan/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({
        mode: "confirm",
        plan: importPayload
      })
    });
    const snapshot = await expectOk("/api/snapshot", { headers: { cookie } });
    const snapshotPayload = await snapshot.json();
    if (!snapshotPayload.planProgress || snapshotPayload.planProgress.currentTrayNumber !== 1) {
      throw new Error("Confirmed treatment import did not appear in snapshot planProgress.");
    }
  }

  await expectOk("/api/export/json", { headers: { cookie } });
  await expectOk("/api/export/csv", { headers: { cookie } });
}

console.log("Loo牙管理器 cloud smoke passed.");
