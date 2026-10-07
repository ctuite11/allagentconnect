# Give developer read-only access (app + backend)

## Goal
Give an outside developer read-only access to the project and the Lovable Cloud database, with no ability to change code, data, or settings.

## Approach

### 1. Project access (view only)
- User invites the developer via the project **Share** button with the **Viewer** role.
- Viewer can open the project and preview but cannot edit.

### 2. Read-only database access
Lovable Cloud has no built-in read-only collaborator role for the database, so create a dedicated read-only Postgres role:

- Create role `dev_readonly` with a strong generated password (stored as a secret, never shown in chat logs beyond the one-time handoff to the user).
- Grant `CONNECT` on the database, `USAGE` on schema `public`, and `SELECT` on all tables in `public` (plus default privileges for future tables).
- No write grants, no access to `auth`, `storage`, `vault`, or other managed schemas.
- Hand the user a connection string (host, port, database, user, password) to pass to their developer for use with a SQL client (TablePlus, DBeaver, psql).

### 3. Revocation path
- Document the one-command revoke: `DROP ROLE dev_readonly;` (plus removing the project invite).

## Safeguards
- Read-only role cannot INSERT/UPDATE/DELETE, run migrations, or read secrets.
- Sensitive columns (e.g. tokens in `agent_activation_tokens`, `email_jobs` payloads) are still visible as data — flag this to the user before proceeding; optionally exclude the most sensitive tables from the SELECT grant.
- No changes to app code, RLS policies, or existing roles.

## Open question for user
- Should the read-only role see ALL tables, or exclude sensitive ones (auth tokens, email queue contents, credentials)?
