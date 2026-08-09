# Roadmap

## V0 — prove the autonomous loop

- [x] deterministic state-machine foundation
- [x] supervisor/executor boundary
- [x] atomic checkpoint persistence foundation
- [x] max-cycle fail-closed behavior
- [x] Codex `exec` adapter scaffold
- [x] generic command supervisor adapter
- [x] central structured supervisor/executor schemas
- [x] core unit tests
- [x] structured error taxonomy
- [ ] explicit durable transition/recovery model for full process resume
- [ ] cancellation support
- [ ] disposable-project integration test

## V1 — reliable executor + semantic supervisor

- [x] structured Codex JSON event parsing
- [x] distinguish process failure/timeout/fatal turn events from recoverable item failures
- [x] compact handoff report extraction
- [x] bounded executor raw-log retention
- [x] supervisor adapter with strict structured output
- [x] durable supervisor operation ids/state
- [x] duplicate-submit prevention contract after a committed supervisor prompt
- [ ] verifier hooks: git diff/stat, tests, build, screenshots
- [ ] end-to-end autonomous run with a real supervisor transport

## V1.5 — minimal browser supervisor transport

Tracked by GitHub issue #1.

- [ ] attach to a user-controlled browser through CDP
- [ ] identify/reuse an explicitly intended conversation safely
- [x] deterministic data-only interaction recipe format
- [x] current bundled ChatGPT recipe fallback set
- [x] structured browser/UI blocker codes
- [x] semantic browser-driver contract (`prepare/submit/waitForResponse`)
- [x] positive-proof response terminal classifier
- [x] login/human-verification/access-control are defined as non-healable blockers
- [ ] live composer interaction + insertion postcondition
- [ ] positive prompt-commit proof
- [ ] live assistant-turn observation feeding response gate
- [ ] same-conversation smoke test

## V2 — bounded UI drift recovery

- [x] deterministic cached/runtime recipes first
- [x] candidate recipe schema validation
- [x] reject persistence of unverified AI candidates
- [x] previous runtime recipe snapshot for rollback/debugging
- [ ] bounded DOM/AX diagnostic collector
- [ ] semantic/DOM mechanic invoked only on recipe failure
- [ ] deterministic live verification of mechanic candidate
- [ ] optional OpenAI-compatible mechanic provider (for example a local router)
- [ ] browser console/network diagnostics
- [ ] optional vision fallback

## V3 — executor ecosystem and safety

- [ ] Codex resume/app-server adapter
- [ ] OpenCode adapter
- [ ] git branch/worktree isolation
- [ ] command policies
- [ ] run time/cost/cycle budgets
- [ ] pause/resume/kill
- [ ] audit log + artifact viewer

## V4 — productization

- [ ] Windows installer/launcher
- [ ] local dashboard
- [ ] project picker
- [ ] run history
- [ ] adapter SDK
- [ ] stable configuration migration
