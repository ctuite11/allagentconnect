import contextlib
import copy
import importlib.util
import io
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("privacy_storage", Path(__file__).with_name("privacy-storage.py"))
storage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(storage)


class StorageCutoverTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.buckets = [{"id": name, "name": name, "public": True,
                         "file_size_limit": 10485760, "allowed_mime_types": ["image/png"]}
                        for name in (*storage.PRIVATE, "agent-headshots", "agent-logos", "brand-assets")]
        self.lock = {"target_project_ref": storage.TARGET, "database_locked": True,
                     **{field: 0 for field in ("active_cron_jobs", "active_http_triggers", "queued_http_requests",
                                              "unguarded_network_routines", "changed_quarantined_routines")}}

    def api(self, key, method, path, body=None):
        self.calls.append((method, path, body))
        if path == "/rest/v1/rpc/migration_no_contact_status":
            return self.lock
        if path == "/rest/v1/rpc/get_shared_listing":
            return None
        if method == "GET" and path == "/storage/v1/bucket":
            return copy.deepcopy(self.buckets)
        if method == "PUT":
            bucket = next(item for item in self.buckets if item["id"] == path.rsplit("/", 1)[1])
            bucket.update(body)
            return {"message": "updated"}
        if method == "DELETE" and path.startswith("/storage/v1/cdn/"):
            return {"message": "success"}
        self.fail("Unexpected request")

    def run_quietly(self, apply):
        with contextlib.redirect_stdout(io.StringIO()):
            return storage.run("offline-fake-key", apply, self.api)

    def test_check_is_read_only(self):
        self.assertFalse(self.run_quietly(False))
        self.assertFalse(any(method in {"PUT", "DELETE"} for method, _, _ in self.calls))

    def test_apply_changes_only_four_flags_preserves_restrictions_and_purges_cache(self):
        before = copy.deepcopy(self.buckets)
        self.assertTrue(self.run_quietly(True))
        self.assertEqual(sum(method == "PUT" for method, _, _ in self.calls), 4)
        self.assertEqual(sum(path.startswith("/storage/v1/cdn/") for _, path, _ in self.calls), 8)
        for previous, current in zip(before, self.buckets):
            self.assertEqual(previous["file_size_limit"], current["file_size_limit"])
            self.assertEqual(previous["allowed_mime_types"], current["allowed_mime_types"])
            self.assertEqual(current["public"], current["id"] not in storage.PRIVATE)

    def test_wrong_project_or_broken_outbound_guard_stops_before_mutation(self):
        self.lock["target_project_ref"] = "wrong-project"
        with self.assertRaisesRegex(RuntimeError, "outbound lock"):
            self.run_quietly(True)
        self.assertFalse(any(method in {"PUT", "DELETE"} for method, _, _ in self.calls))

    def test_apply_is_idempotent_and_repeats_only_cache_purge(self):
        self.run_quietly(True)
        self.calls.clear()
        self.assertTrue(self.run_quietly(True))
        self.assertFalse(any(method == "PUT" for method, _, _ in self.calls))

    def test_purge_failure_keeps_buckets_private_and_reports_partial_cutover(self):
        def limited_api(key, method, path, body=None):
            if path.startswith("/storage/v1/cdn/"):
                raise RuntimeError("Provider plan does not support manual purge")
            return self.api(key, method, path, body)
        with self.assertRaisesRegex(RuntimeError, "buckets are private, but CDN purge did not complete"):
            storage.run("offline-key", True, limited_api)
        self.assertTrue(all(b["public"] is False for b in self.buckets if b["id"] in storage.PRIVATE))


if __name__ == "__main__":
    unittest.main()
