# Agent Instructions

- Start every response with the wizard emoji "🧙" to signal context is active
- Projects Use **pnpm**
- Run pnpm build at the end of work on the web app only.
- Web apps use file-based routing via `unplugin-vue-router`; page components live in `src/pages` (not `src/views`).

## Landing the Plane (Session Completion)

**When ending a work session**, complete all steps below. For direct-to-`main` repos, prioritize safety over speed.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Verify git scope** - Confirm only intended files are changed/staged for this task
4. **Update issue status** - Close finished work, update in-progress items
5. **Before any push to `main`** - Share a short summary and get explicit user confirmation
6. **Push safely**:
   ```bash
   git status
   git pull --rebase
   bd sync
   git push
   git status  # MUST show "up to date with origin"
   ```
7. **Verify** - Intended changes are committed and pushed (or explicitly deferred by user)
8. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- NEVER force-push `main`
- NEVER run destructive cleanup commands (stash drop/clear, branch prune, reset --hard) unless user asks
- For direct-to-`main`, NEVER push without explicit user confirmation
- If push fails, resolve and retry with the same safety checks
