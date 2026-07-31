#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-run
/**
 * Local-only JWT caller matrix against Edge Functions served by local Supabase.
 * Never uses production credentials. Never calls Resend (workers stay paused).
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://127.0.0.1:54321";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DB_URL = Deno.env.get("DB_URL") ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const EMAIL_SENDING_PAUSED = (Deno.env.get("EMAIL_SENDING_PAUSED") ?? "").trim();

if (!ANON_KEY || !SERVICE_KEY) {
  console.error("Missing local SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}
if (EMAIL_SENDING_PAUSED !== "true") {
  console.error("EMAIL_SENDING_PAUSED must be true for this matrix");
  Deno.exit(1);
}
if (!SUPABASE_URL.includes("127.0.0.1") && !SUPABASE_URL.includes("localhost")) {
  console.error("Refusing non-local SUPABASE_URL:", SUPABASE_URL);
  Deno.exit(1);
}
if (!DB_URL.includes("127.0.0.1") && !DB_URL.includes("localhost")) {
  console.error("Refusing non-local DB_URL");
  Deno.exit(1);
}

type CaseResult = { name: string; ok: boolean; detail: string };
const results: CaseResult[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

async function invoke(
  fn: string,
  opts: { authorization?: string | null; body?: unknown } = {},
): Promise<{ status: number; json: Record<string, unknown> }> {
  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    "Content-Type": "application/json",
  };
  if (typeof opts.authorization === "string") {
    headers.Authorization = opts.authorization;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(opts.body ?? {}),
  });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  return { status: res.status, json };
}

async function signUp(
  email: string,
  password: string,
): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  const token = json?.access_token as string | undefined;
  const userId = (json?.user?.id ?? json?.id) as string | undefined;
  if (!token || !userId) {
    throw new Error(`signup failed for ${email}: ${JSON.stringify(json)}`);
  }
  return { token, userId };
}

async function promoteAdmin(userId: string): Promise<void> {
  const sql =
    `INSERT INTO public.user_roles (user_id, role)
VALUES ('${userId}'::uuid, 'admin'::public.app_role)
ON CONFLICT (user_id, role) DO NOTHING;`;
  const cmd = new Deno.Command("psql", {
    args: [DB_URL, "-v", "ON_ERROR_STOP=1", "-c", sql],
    stdout: "piped",
    stderr: "piped",
  });
  const out = await cmd.output();
  if (!out.success) {
    throw new Error(
      `promoteAdmin failed: ${new TextDecoder().decode(out.stderr)}`,
    );
  }
}

function isUnauthorized(status: number): boolean {
  return status === 401 || status === 403;
}

function isPausedOrDisabled(
  status: number,
  json: Record<string, unknown>,
): boolean {
  if (status !== 200) return false;
  if (json.paused === true) return true;
  if (json.disabled === true) return true;
  if (typeof json.switch === "string" && /PAUSE/i.test(json.switch)) return true;
  return false;
}

const WORKERS = ["process-email-queue", "kick-email-queue"] as const;
const PRIVILEGED = [
  "send-new-match-notification",
  "notify-agents-client-need",
  "notify-agents-new-listing",
  "process-comms-digests",
] as const;

async function main() {
  const stamp = Date.now();
  const user = await signUp(
    `ci-user-${stamp}@example.com`,
    `CiUserPass-${stamp}!a`,
  );
  const admin = await signUp(
    `ci-admin-${stamp}@example.com`,
    `CiAdminPass-${stamp}!a`,
  );
  await promoteAdmin(admin.userId);

  for (const fn of [...WORKERS, ...PRIVILEGED]) {
    const noAuth = await invoke(fn, { authorization: null });
    record(
      `${fn} / no Authorization`,
      isUnauthorized(noAuth.status),
      `status=${noAuth.status}`,
    );

    const badJwt = await invoke(fn, {
      authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.sig",
    });
    record(
      `${fn} / invalid JWT`,
      isUnauthorized(badJwt.status),
      `status=${badJwt.status}`,
    );

    const userCall = await invoke(fn, {
      authorization: `Bearer ${user.token}`,
    });
    record(
      `${fn} / normal authenticated user`,
      isUnauthorized(userCall.status),
      `status=${userCall.status}`,
    );
  }

  for (const fn of WORKERS) {
    const svc = await invoke(fn, {
      authorization: `Bearer ${SERVICE_KEY}`,
      body: {},
    });
    const sent = svc.json.sent;
    record(
      `${fn} / service-role paused`,
      isPausedOrDisabled(svc.status, svc.json) &&
        (sent === 0 || sent == null),
      `status=${svc.status} body=${JSON.stringify(svc.json).slice(0, 200)}`,
    );
  }

  for (const fn of PRIVILEGED) {
    const svc = await invoke(fn, {
      authorization: `Bearer ${SERVICE_KEY}`,
      body: fn === "notify-agents-client-need"
        ? {
          client_need_id: "00000000-0000-4000-8000-000000000001",
          dry_run: true,
        }
        : {},
    });
    record(
      `${fn} / service-role accepted (paused|disabled)`,
      isPausedOrDisabled(svc.status, svc.json),
      `status=${svc.status} body=${JSON.stringify(svc.json).slice(0, 200)}`,
    );
  }

  const adminKick = await invoke("kick-email-queue", {
    authorization: `Bearer ${admin.token}`,
    body: {},
  });
  record(
    "kick-email-queue / admin JWT paused",
    isPausedOrDisabled(adminKick.status, adminKick.json),
    `status=${adminKick.status} body=${JSON.stringify(adminKick.json).slice(0, 200)}`,
  );

  const posture = new Deno.Command("psql", {
    args: [
      DB_URL,
      "-v",
      "ON_ERROR_STOP=1",
      "-tAc",
      `SELECT
         (SELECT COUNT(*) FROM public.email_jobs WHERE status = 'sent'
            AND payload->>'to' LIKE 'ci-%@example.com')::text
       || ',' ||
       (SELECT COUNT(*) FROM public.email_delivery_ledger
            WHERE recipient_email LIKE 'ci-%@example.com')::text
       || ',' ||
       (SELECT CASE WHEN global_paused AND hot_sheet_paused AND communications_paused
                         AND transactional_paused AND system_paused
                    THEN 'pauses_true' ELSE 'pauses_false' END
          FROM public.email_control_state WHERE id = true);`,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const postureOut = await posture.output();
  const postureText = new TextDecoder().decode(postureOut.stdout).trim();
  const [sentJobs, ledgerRows, pauses] = postureText.split(",");
  record(
    "Resend/delivery posture",
    sentJobs === "0" && ledgerRows === "0" && pauses === "pauses_true",
    `sent_jobs=${sentJobs} ledger=${ledgerRows} ${pauses}`,
  );

  const failed = results.filter((r) => !r.ok);
  console.log("\n== JWT caller matrix summary ==");
  console.log(`total=${results.length} failed=${failed.length}`);
  if (failed.length) {
    for (const f of failed) console.error(`FAIL: ${f.name} — ${f.detail}`);
    Deno.exit(1);
  }

  console.log("Unauthorized function invokes rejected: PASS");
  console.log("Authorized function invokes accepted but paused: PASS");
  console.log("Resend calls: 0");
  console.log("Deliveries created: 0");
  console.log("Production email_jobs modified: 0");
  console.log("EMAIL_SENDING_PAUSED=true");
  console.log("All local DB stream pauses=true");
}

await main();
