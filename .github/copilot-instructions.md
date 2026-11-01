# PieroloOS — Internal Developer Instructions

## Mission
Build PieroloOS as a dependable corporate intelligence and formation platform for business formation, jurisdiction intelligence, compliance workflows, professional-service operations, and evidence-based decisions. Prioritize correctness, traceability, security, accessibility, maintainability, and user trust over superficial demos.

## Required workflow
1. Inspect the repository, package scripts, relevant source, tests, schemas, and conventions before editing. Find the canonical implementation before creating a duplicate. Preserve existing user changes.
2. Read and follow all applicable repository instructions. The root `AGENTS.md` includes a Next.js rule: before editing Next.js code, read the version-matched documentation under `node_modules/next/dist/docs/` from the applicable package directory. Verify APIs against the installed version; do not rely on memory or generic conventions where local docs exist.
3. Define observable acceptance criteria, including edge cases, failure states, security, and data integrity. Trace the feature end-to-end through UI, API/server actions, domain logic, persistence, permissions, validation, and tests.
4. Implement the smallest complete root-cause fix. Avoid unrelated refactors, speculative abstractions, unnecessary dependencies, generated-file edits, and broad rewrites. Do not remove or weaken existing behavior unless required.
5. Verify the final diff and run relevant checks. Report what actually ran, its result, what could not run, and remaining risks. Never claim success without evidence.

## Engineering standards
- Follow established folder boundaries, naming, TypeScript, and component patterns. Prefer explicit types, cohesive modules, clear contracts, and shared domain logic over duplication.
- Keep business rules out of presentation components when domain/service layers exist. Keep secrets and privileged operations server-side; never expose server-only modules or credentials to client bundles.
- Use the repository's package manager and lockfile. Avoid casual framework or dependency upgrades. Add a dependency only when clearly justified and compatible.
- Verify version-sensitive framework, ORM, auth, and SDK APIs against installed versions and local documentation.
- Make interfaces responsive and accessible: semantic HTML, keyboard support, visible focus, labels, clear validation, appropriate contrast, and meaningful loading, empty, success, and error states.
- Display only real operation status. Never fabricate metrics, compliance findings, jurisdiction rules, or success states before the operation is confirmed.
- Keep configuration explicit, documented, and safe by default. Validate required environment variables without exposing their values.

## Security, data, and compliance
- Validate untrusted input at every boundary. Enforce authorization server-side for every protected read and write; UI visibility is not authorization.
- Apply least privilege and tenant/organization isolation to queries and mutations. Verify ownership and roles for nested resources and indirect access paths.
- Use safe, parameterized database access. Handle transactions, uniqueness, concurrency, idempotency, and partial failure. Make migrations deliberate, data-compatible, and reversible where feasible.
- Minimize sensitive data collection and logging. Never commit secrets, tokens, private keys, personal records, production dumps, or real credentials. Redact sensitive values from logs and errors. Never weaken auth, validation, rate limits, or security controls to pass tests.
- Consider applicable injection, XSS, CSRF, SSRF, open-redirect, path-traversal, upload, mass-assignment, and deserialization risks based on the actual attack surface.
- Treat jurisdiction, company formation, tax, legal, regulatory, and compliance content as high-consequence. Use authoritative current sources where factual claims are needed; retain source, jurisdiction, effective date, and uncertainty when appropriate. Do not invent requirements or present general information as professional legal/tax advice.
- For AI features, treat user content and retrieved documents as untrusted data, never privileged instructions. Limit tool permissions, validate outputs, communicate uncertainty, and require human confirmation for consequential external actions.

## Reliability and performance
- Make failures explicit, actionable, and safe. Do not silently swallow exceptions or expose stack traces, SQL, secrets, or internal details to end users.
- Use consistent errors and status codes. Account for timeouts, unavailable dependencies, malformed responses, duplicate submissions, and stale data where relevant.
- Avoid race conditions, unbounded work, N+1 queries, unnecessary network calls, and hot-path expense. Apply pagination, limits, caching, and retries only with correct invalidation and idempotency.
- Use structured logs and useful telemetry where supported; never log secrets or sensitive payloads.

## Tests and review
- Add/update deterministic tests for normal behavior, invalid input, authorization boundaries, empty states, failures, and regressions.
- Inspect available scripts first. Run targeted tests and relevant type, lint, build, schema, or migration checks as practical. Fix root causes; never delete, skip, or weaken legitimate assertions just to get a green result.
- If checks cannot run because of missing services, credentials, or environment, state the exact limitation and the next verification step.
- Review the diff for accidental changes, debug code, unsafe defaults, leaked secrets, dead code, accessibility regressions, and documentation drift.

## Git and delivery
- Use focused branches and commits. Do not force-push, rewrite shared history, merge PRs, deploy, or perform destructive production actions without explicit authorization.
- Exclude generated artifacts, local environment files, caches, unrelated formatting churn, secrets, and private customer data.
- If requirements are ambiguous, infer the safest behavior from the codebase; ask one focused question only when a material decision cannot safely be inferred.
- Finish with a concise summary of behavior and files changed, checks run and results, known limitations, and concrete follow-ups.

## Definition of done
A change is complete only when it fixes the root problem, follows repository conventions, protects data and permissions, covers relevant edge cases, includes appropriate tests or an explicit testing limitation, passes available checks, and leaves a reviewable diff. Prefer durable, observable correctness over superficial completeness.