# Platform administration

## Security boundary and roles

PieroloOS staff continue to authenticate through NextAuth (GitHub or OIDC) and must already have an organization membership. Workspace roles (`OWNER`, `ADMIN`, `ADVISOR`, `MEMBER`, `VIEWER`) remain separate from platform-wide administration.

The platform role is authoritative in PostgreSQL:

- `PlatformSuperAdmin` is a singleton assignment. Its database check constraint fixes the row ID to `singleton`, and its user foreign key prevents deleting the assigned account. Only the designated account is the Super Administrator (`isSuperAdmin` in server-side policy code).
- `PlatformAdministrator` identifies an ordinary platform administrator. It does not confer permissions by itself. The assignment may be revoked without deleting the user or its audit history.
- `PlatformAdministratorPermission` stores explicit permission grants and the grantor. No new users receive a role or permission by default. Existing membership roles do not imply platform permissions.
- Privileged operations resolve the current server session, then read current assignments from the database. Authorization does not use browser-supplied roles, permissions, or JWT role claims.

The permissions implemented in this stage are:

| Permission | Scope |
| --- | --- |
| `dashboard.read` | Operational dashboard metrics. Ordinary administrators see client aggregates only across organizations where they hold a membership. |
| `clients.read` | Recent client record names and IDs, scoped to the administrator's organizations; the Super Administrator can read platform-wide records. The current view also requires `dashboard.read`. |
| `partnership-inquiries.read` | Read the separate public partnership-inquiry table. These records are inquiries, not verified partners or partner applications. |
| `admins.read` | Read ordinary administrator assignments and their explicit permission grants. |
| `audit.read` | Read recent platform-administration audit activity. The current view also requires `dashboard.read`. |

There are no client verification or partner-account permissions because those lifecycle models do not exist in the current schema. `admins.manage` is Super-Admin-only and is enforced as such by the management API rather than being delegable as an ordinary permission.

## Initial Super Administrator provisioning

Apply the additive migration first (`npm run db:deploy`). Then, using a trusted operator shell connected to the intended database, deliberately identify an existing staff user's email and run:

```sh
npm run admin:provision-superadmin -- --email staff@example.com
```

The command requires an existing user with an organization membership. It does not create a user, accept a browser request, grant the first registrant, or use environment-listed emails. The first invocation creates the singleton assignment and a `SYSTEM_BOOTSTRAP` audit event in one serializable transaction. Repeating it for the same account is a no-op; it refuses to replace a different existing Super Administrator. Treat access to the command's database credentials as privileged production access.

## Ordinary administrator management

Navigate to `/admin/dashboard`, then choose **Manage administrators**. Only the Super Administrator may assign, edit, or revoke ordinary platform-administrator access. Each grant/change/revocation requires a reason, validates the target as an existing staff member, and writes an audit event transactionally with the permission change. The route also checks request origin. An ordinary administrator cannot grant or edit permissions, create a Super Administrator, or change the singleton assignment. Revocation removes the platform assignment and its permission rows while preserving the user and audit history.

To transfer a compromised or departing Super Administrator outside the application, use a trusted operator shell and independently verify both user IDs and the reason:

```sh
npm run admin:transfer-superadmin -- \
  --from-user-id <current-user-id> \
  --to-user-id <existing-staff-user-id> \
  --reason "Documented owner-approved transfer"
```

The operation atomically changes the singleton to an existing staff account and records the old actor, new subject, and reason. It removes any ordinary-admin assignment from the new Super Administrator. Do not run this using untrusted input or an application-exposed credential. This is the operator recovery route; the web interface does not offer a Super Administrator self-transfer control.

## Routes and current data limits

- `/admin` redirects to `/admin/dashboard`.
- `/admin/dashboard` requires `dashboard.read` or the Super Administrator assignment.
- `/admin/administrators` requires `admins.read`; write operations require the live Super Administrator assignment.
- `GET /api/partnerships/inquiries` requires `partnership-inquiries.read` and audits successful reads and denials. Public `POST` remains governed by its existing origin, rate-limit and validation controls.
- `/api/admin/administrators` lists assignments for `admins.read` and supports Super-Admin-only grant/update/revoke operations.

The dashboard uses persisted client and inquiry rows, never demonstration counts. “New clients” means client records created in the previous 30 days. The current client table has no verification, onboarding, suspension or account-status lifecycle. The current partnership table stores public inquiries only; it has no partner accounts, documents, approval decisions or rejection workflow. No client/partner approval, suspension, transaction/payment administration, settings editor, reports module, session-revocation UI, or organization-independent partner directory is claimed by this stage. Those require their actual domain workflows and resource authorization before they can be exposed.

Administrative tables are deliberately bounded to recent records, but this stage does not yet provide interactive search, filters, full history pagination, or localized admin-page copy. The navigation label follows the existing four-locale catalog. Administrator write routes have an origin check, an 8 KiB request limit, and a 10-per-minute per-process rate limit; as with the rest of the current application, multi-instance deployments need a shared limiter or edge/WAF enforcement.

## Audit, migration, and operational limits

`PlatformAuditEvent` is a separate append-only-by-application record for bootstrap, permission changes, administrator revocation, inquiry reads and denied privilege operations. There is no application update/delete path. The application database credential can still alter records directly; production PostgreSQL privileges, backups, retention and immutable export should further protect this table. Audit metadata deliberately excludes emails, raw inquiry text, credentials and session tokens.

Migration `20261013000000_platform_admin_rbac` creates only new tables, an enum, indexes and foreign keys; it does not change existing user, client, partner-inquiry, membership, or workspace rows. All existing users start with no platform assignment. Apply through the existing `npm run db:deploy` process after backing up the database. A rollback that drops the new tables would erase newly created grants and audit history; export those records and obtain an operational approval before removing the schema.

Current authentication integrations do not expose an application-level step-up/recent-authentication signal. Enforce MFA and reauthentication for privileged operator identities at the identity provider. Permission checks are refreshed from the database on server requests, so revoking an administrator does not depend on waiting for a JWT role claim to expire; already-rendered UI may need a refresh.

## Validation

```sh
npm run db:validate
npm run db:inventory
npm run db:generate
npm test -- tests/auth-session.test.ts tests/platform-access.test.ts tests/platform-admin-route.test.ts tests/partnership-inquiry-route.test.ts
npm run typecheck
```

`npm run test:db` requires a disposable PostgreSQL database and should be run in addition to unit tests when a database is available. Never point migration tests at production.
