# Roadmap

## V0 — prove the autonomous loop

- [x] deterministic state-machine foundation
- [x] supervisor/executor boundary
- [x] checkpoint persistence foundation
- [x] max-cycle fail-closed behavior
- [x] Codex `exec` adapter scaffold
- [x] generic command supervisor adapter
- [x] core unit tests
- [ ] explicit durable state-transition model
- [ ] cancellation support
- [ ] structured executor result schema
- [ ] disposable-project integration test

## V1 — reliable executor + supervisor transport

- [ ] structured Codex JSON event parsing
- [ ] distinguish task failure/process failure/timeout
- [ ] compact handoff report extraction
- [ ] verifier hooks: git diff/stat, tests, build, screenshots
- [ ] supervisor adapter with strict structured output
- [ ] end-to-end autonomous run

## V1.5 — browser supervisor experiments

Only where permitted by the upstream service's current terms:

- [ ] attach to user-controlled browser through a replaceable adapter
- [ ] identify/reuse a specific thread safely
- [ ] deterministic interaction recipes
- [ ] structured UI blocker codes
- [ ] login/CAPTCHA/access-control -> BLOCKED

## V2 — bounded UI drift recovery

- [ ] cached recipes first
- [ ] semantic/DOM mechanic only on recipe failure
- [ ] candidate-recipe validation
- [ ] learned per-domain recipes
- [ ] optional OpenAI-compatible mechanic provider
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
