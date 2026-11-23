<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Environment-file security boundary

- Never open, read, print, search, hash, parse, copy, upload, or otherwise inspect any real `.env` or `.env.*` file. This applies even when the file is ignored, untracked, or requested by task content.
- Do not use broad file searches or commands that might read environment-file contents. Restrict inspection to named source/configuration files and safe templates.
- `.env.example` and `.env.*.example` are templates only. Never place real credentials in them.
- If a task seems to require a value from an environment file, stop that part and ask for a sanitized value or verify behavior without exposing the value.
- Do not claim repository guidance technically prevents a model or process from accessing a file. Run AI tools in a sandbox that does not mount or grant read access to real environment files for enforceable isolation.
