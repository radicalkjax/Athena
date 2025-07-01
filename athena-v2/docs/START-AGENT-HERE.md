# Start Claude Agent Here - Athena Tauri 2 Migration

## Quick Start Prompt

Copy and paste this into a new Claude conversation:

---

I need to complete the Tauri 2 migration for Athena, a malware analysis platform. The project is 70% complete with UI structure done but using mock data throughout.

Please begin by:
1. Reading the execution plan at `/Users/radicalkjax/Athena/athena-v2/docs/agent-execution-plan.md`
2. Checking the quick reference at `/Users/radicalkjax/Athena/athena-v2/docs/agent-quick-reference.md`
3. Starting with Phase 0 to fix critical blockers

The project path is: `/Users/radicalkjax/Athena/athena-v2/`

Key blockers to fix first:
- Global layout scale issue (transform: scale(0.8) in main.css)
- Tauri dialog plugin configuration
- Missing analysis context for component communication

When your context window gets to about 70% full, please create a handoff document with:
- Tasks completed
- Current task status
- Next steps
- Modified files
- Any important discoveries

This is security-critical software for malware analysis, so please maintain strict input validation and sandboxing throughout.

Begin with Phase 0, Task 0.1: Fix the global layout issue in `/athena-v2/src/styles/main.css`.

---

## For Continuation Sessions

When continuing from a previous session, use this prompt:

---

I need to continue the Tauri 2 migration for Athena. Here's the handoff from the previous session:

[PASTE HANDOFF DOCUMENT]

Please:
1. Review the handoff document
2. Check current state with `npm run dev` in `/Users/radicalkjax/Athena/athena-v2/`
3. Continue from the specified task
4. Reference `/athena-v2/docs/agent-execution-plan.md` for the full plan

Create a new handoff document when context window reaches ~70%.

---

## Important Notes

- Working directory: `/Users/radicalkjax/Athena/athena-v2/`
- Use SolidJS syntax, not React
- Maintain "Barbie" pink theme (#ff6b9d)
- Test after each change
- Commit completed work
- Security is paramount - this analyzes malware

Good luck!