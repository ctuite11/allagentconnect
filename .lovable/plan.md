Plan:
1. Verify the local repository is on `main` at commit `221e636e` or newer and confirm the email builder contains `aac-hotsheet-preview:simple-v1`.
2. Redeploy only `send-hot-sheet-preview-blast` from the committed git file without editing or regenerating any email HTML.
3. Invoke exactly one test send with `{"testEmail":"chris@allagentconnect.com"}` and do not run a live blast.
4. Verify the newest send/job from that invocation only, extracting:
   - deployed git commit hash
   - Resend message id
   - exact HTML marker in that message HTML
   - function invoke JSON response
5. Reply only with the requested facts. If the marker is not `aac-hotsheet-preview:simple-v1`, treat deploy as failed and retry redeploy once before reporting failure.