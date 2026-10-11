# Digital Command Center

Use the existing isolated checkout; do not create a worktree unless the user requests one. Read installed Next.js guides in `node_modules/next/dist/docs/` before changing framework code.

This is the separate private operations app. Do not alter or deploy the public websites as an incidental part of Command Center work. Never invent metrics. Missing and failed measurements must stay null; a measured zero is different. API credentials belong only in server-side encrypted environment variables. Never log them, serialize them to clients, or add them to site metadata.

All data pages and registry routes must enforce owner sessions. Cron uses independent bearer authorization. Tests must verify auth rejection, provider failures, pagination, and no PHI reads. Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, then `npm run test:browser`. Build and browser checks must run sequentially. Node 24 and installed `/usr/bin/chromium` are available.

Do not apply database/schema.sql to existing website projects. It belongs in a dedicated Command Center database. Live credentials, domains and provider access must be verified independently of fixture tests. Do not interpret a proxy/network error as website downtime.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
