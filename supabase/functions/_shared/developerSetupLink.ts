// Shared Developer setup-link issuance.
//
// One code path is used by both `admin-approve-developer-request` (issued as
// part of Verify) and `send-developer-setup-link` (the admin recovery action),
// so the token, template, subject and deleted-user rules can never drift.
//
// The plaintext token never leaves this module: it is signed, hashed, and the
// hash alone is handed to the database. The queue worker re-derives the CTA.
import {
  ACTIVATION_TOKEN_TTL_DAYS,
  sha256Hex,
  signActivationToken,
} from "./activationTokens.ts";
import { findDeletedAgent } from "./checkDeletedAgent.ts";

/** Developer-facing setup email — same durable token, developer wording. */
export const DEVELOPER_SETUP_TEMPLATE = "admin-created-invite";
export const DEVELOPER_SETUP_SUBJECT = "Your All Agent Connect Developer account is ready";
export const DEVELOPER_SETUP_REPLY_TO = "chris@allagentconnect.com";

export type DeveloperSetupLinkResult =
  | { status: "queued"; tokenId: string | null; jobId: string }
  | { status: "deduped"; tokenId: string | null; jobId: string | null }
  | { status: "previously_deleted"; reason: string; match: unknown }
  | { status: "failed"; reason: string };

/** Admin-readable explanation for every non-success issuance status. */
export function describeIssuanceFailure(status: string): string {
  const reasons: Record<string, string> = {
    previously_deleted:
      "This email was deleted previously — acknowledge the deletion to send anyway.",
    ineligible:
      "This user is not eligible for a setup link (missing developer access, or already activated).",
    blocked: "A setup link for this developer is being redeemed right now. Try again shortly.",
    already_live: "A setup link is already live for this developer.",
    no_recipient: "This developer has no valid email address on file.",
    no_secret: "Activation signing secret is not configured.",
  };
  return reasons[status] ?? `Setup link could not be issued (${status}).`;
}

/** Developer wording applied over the shared activation payload. */
export function developerSetupPayload(
  basePayload: Record<string, unknown>,
  firstName: string | null,
): Record<string, unknown> {
  return {
    ...basePayload,
    template: DEVELOPER_SETUP_TEMPLATE,
    subject: DEVELOPER_SETUP_SUBJECT,
    reply_to: DEVELOPER_SETUP_REPLY_TO,
    first_name: firstName ?? null,
  };
}

export interface IssueDeveloperSetupLinkInput {
  // deno-lint-ignore no-explicit-any
  admin: any;
  supabaseUrl: string;
  serviceKey: string;
  secret: string | undefined;
  userId: string;
  email: string;
  firstName?: string | null;
  /** Explicit admin acknowledgement of a `deleted_users` tombstone. */
  acknowledgeDeleted?: boolean;
}

export async function issueDeveloperSetupLink(
  input: IssueDeveloperSetupLinkInput,
): Promise<DeveloperSetupLinkResult> {
  const { admin, supabaseUrl, serviceKey, secret, userId, email } = input;
  const firstName = input.firstName?.trim() || null;
  const acknowledgeDeleted = input.acknowledgeDeleted === true;

  if (!secret) return { status: "failed", reason: "no_secret" };

  // Tombstones are never bypassed silently — the admin must acknowledge them.
  if (!acknowledgeDeleted) {
    const deletedMatch = await findDeletedAgent(admin, email);
    if (deletedMatch) {
      return {
        status: "previously_deleted",
        reason: describeIssuanceFailure("previously_deleted"),
        match: deletedMatch,
      };
    }
  }

  const tokenId = crypto.randomUUID();
  const expiresAt = new Date(
    Math.floor(Date.now() / 1000) * 1000 + ACTIVATION_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  const activationToken = await signActivationToken(secret, {
    id: tokenId,
    userId,
    expiresAtEpoch: Math.floor(expiresAt.getTime() / 1000),
  });

  const { data: issued, error: issueErr } = await admin.rpc("reissue_agent_activation_token", {
    p_id: tokenId,
    p_user_id: userId,
    p_token_hash: await sha256Hex(activationToken),
    p_expires_at: expiresAt.toISOString(),
    p_subject: DEVELOPER_SETUP_SUBJECT,
    p_reply_to: DEVELOPER_SETUP_REPLY_TO,
    p_agent_name: firstName,
    p_allow_previously_deleted: acknowledgeDeleted,
  });

  if (issueErr) {
    console.error("[developerSetupLink] issuance error:", issueErr.message);
    return { status: "failed", reason: describeIssuanceFailure("error") };
  }

  const status = (issued as { status?: string } | null)?.status ?? "unknown";
  const jobId = (issued as { job_id?: string } | null)?.job_id ?? null;
  const issuedTokenId = (issued as { token_id?: string } | null)?.token_id ?? null;

  if (status !== "created" && status !== "deduped") {
    return { status: "failed", reason: describeIssuanceFailure(status) };
  }

  if (status === "created" && jobId) {
    const { data: jobRow } = await admin
      .from("email_jobs")
      .select("payload")
      .eq("id", jobId)
      .maybeSingle();
    await admin
      .from("email_jobs")
      .update({
        payload: developerSetupPayload(
          (jobRow?.payload ?? {}) as Record<string, unknown>,
          firstName,
        ),
      })
      .eq("id", jobId);
  }

  // Best-effort nudge so the queue drains immediately.
  void fetch(`${supabaseUrl}/functions/v1/kick-email-queue`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => {});

  if (status === "deduped") {
    return { status: "deduped", tokenId: issuedTokenId, jobId };
  }
  return { status: "queued", tokenId: issuedTokenId, jobId: jobId as string };
}
