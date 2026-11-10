#!/usr/bin/env python3
"""Read/check or privatize existing buckets in the fixed migration destination.

Uses only Storage's API. Never copies/deletes files or changes MIME/size limits.
The service key is entered locally, hidden; never pass it on the command line.
"""
import argparse
import getpass
import json
import sys
import urllib.error
import urllib.request

TARGET = "kwfqjnepesiihjkdnxou"
BASE = f"https://{TARGET}.supabase.co"
PRIVATE = ("listing-photos", "listing-floorplans", "agent-match-photos", "email-attachments")


def api(key, method, path, body=None):
    headers = {"apikey": key, "Content-Type": "application/json", "User-Agent": "AAC-Privacy-Cutover/1.0"}
    if not key.startswith("sb_secret_"):
        headers["Authorization"] = "Bearer " + key
    request = urllib.request.Request(BASE + path, method=method, headers=headers,
                                     data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"Destination API refused {method} {path}: HTTP {error.code}") from None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        raise RuntimeError("Destination API connection or response failed; rerun the read-only check.") from None


def run(key, apply=False, call=api):
    lock = call(key, "GET", "/rest/v1/rpc/migration_no_contact_status")
    if not isinstance(lock, dict) or lock.get("target_project_ref") != TARGET or lock.get("database_locked") is not True or any(
        lock.get(field) != 0 for field in ("active_cron_jobs", "active_http_triggers", "queued_http_requests",
                                         "unguarded_network_routines", "changed_quarantined_routines")):
        raise RuntimeError("The expected destination outbound lock is not intact; no bucket was changed.")
    # Ensure the database privacy migration exists before cutting over images.
    call(key, "POST", "/rest/v1/rpc/get_shared_listing", {"p_token": "invalid"})
    buckets = call(key, "GET", "/storage/v1/bucket")
    by_id = {bucket["id"]: bucket for bucket in buckets}
    if any(name not in by_id for name in PRIVATE):
        raise RuntimeError("A required bucket is missing; no bucket was changed.")
    for name in PRIVATE:
        before = by_id[name]
        if apply and before.get("public") is not False:
            call(key, "PUT", "/storage/v1/bucket/" + name, {
                "name": before["name"], "public": False,
                "file_size_limit": before.get("file_size_limit"),
                "allowed_mime_types": before.get("allowed_mime_types"),
            })
    after = {bucket["id"]: bucket for bucket in call(key, "GET", "/storage/v1/bucket")}
    for name in PRIVATE:
        if any(after[name].get(field) != by_id[name].get(field) for field in ("file_size_limit", "allowed_mime_types")):
            raise RuntimeError("A bucket restriction changed unexpectedly; keep delivery locked and review settings.")
    for name in ("agent-headshots", "agent-logos", "brand-assets"):
        if name in by_id and after.get(name) != by_id[name]:
            raise RuntimeError("A public branding bucket changed unexpectedly.")
    private = all(after[name].get("public") is False for name in PRIVATE)
    if apply and private:
        # Cache deletion only, never object deletion. The transformations=true
        # option purges ONLY transformations, so request originals separately.
        for name in PRIVATE:
            try:
                call(key, "DELETE", "/storage/v1/cdn/" + name)
                call(key, "DELETE", "/storage/v1/cdn/" + name + "?transformations=true")
            except RuntimeError:
                raise RuntimeError("Confidential buckets are private, but CDN purge did not complete. "
                                   "Keep delivery locked; arrange provider/CDN cache purge and verify old URLs. "
                                   "Do not make buckets public again.") from None
    print(json.dumps({"project": TARGET, "confidential_buckets": {
        name: {"private": after[name].get("public") is False} for name in PRIVATE}, "all_private": private}))
    print("PRIVACY_STORAGE_PRIVATE" if private else "PRIVACY_STORAGE_CUTOVER_REQUIRED")
    if apply:
        print("CDN_PURGE_REQUESTED: verify old anonymous URLs after propagation; purge any separate CDN too.")
    return private


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply", action="store_true", help="Make the four existing confidential buckets private.")
    mode.add_argument("--check", action="store_true", help="Read settings only (default).")
    args = parser.parse_args()
    key = getpass.getpass(f"NEW project {TARGET} service-role JWT or secret API key: ").strip()
    if not key or any(character.isspace() for character in key):
        raise RuntimeError("Enter the new project's service key at the hidden prompt.")
    success = run(key, args.apply)
    return 0 if success else 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (RuntimeError, KeyboardInterrupt) as error:
        print("ERROR: " + (str(error) or "Interrupted; rerun --check before continuing."), file=sys.stderr)
        sys.exit(1)
