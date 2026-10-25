# Start Codex implementation

## Quick start (Windows PowerShell)

```powershell
cd C:\Users\vijit\Documents\GitHub\royal-auction-house
# Copy the contents of this starter pack into this repository root.
git status
codex
```

## Paste this as the first Codex instruction

> Read AGENTS.md, docs/PRODUCT.md, docs/EXECUTION_PLAN.md and docs/ACCEPTANCE.md. Implement **Phase 0 only** with real, runnable code in this repository. Set up pnpm monorepo, web, API, shared packages, MongoDB Atlas and the official MongoDB Node.js driver, docker compose, test/lint/typecheck scripts and README. Run install and all available checks, fix failures, and update docs/PROGRESS.md. Do not claim other phases are implemented. When complete, show changed files and exact local start commands.

Then for each next phase:

> Read AGENTS.md and docs/PROGRESS.md. Implement Phase N from docs/EXECUTION_PLAN.md fully, adding automated tests, running checks, and updating docs/PROGRESS.md. Don't move to the next phase until acceptance criteria for this phase pass.

## Local requirements

Node.js 22 LTS or currently supported active LTS, pnpm via Corepack, Git, Docker Desktop, MongoDB Atlas access (or a local MongoDB replica-set container), Codex CLI or Codex extension authenticated with your account. Keep `.env` private. The project is not built by this instruction pack; it directs Codex to build it incrementally.
