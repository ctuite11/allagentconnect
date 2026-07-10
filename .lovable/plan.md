## Restart the dev server

Refresh didn't recover the preview. The Vite dev server's HMR socket is likely stuck even though HTML still serves. Fix:

1. Restart the sandbox dev server (`code--restart_dev_server`).
2. Wait for Vite to come back up and confirm `/` returns the HTML shell.
3. You refresh the Lovable preview tab.

If it's still blank after that, I'll pull the browser console + network logs from the preview to find the actual runtime error.

No code changes.
