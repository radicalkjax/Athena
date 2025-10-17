# 🚀 START HERE - Athena Modernization Project

**Single prompt to start/continue work on Athena malware analysis platform**

---

## COPY-PASTE THIS PROMPT INTO CLAUDE CODE

```
You are working on Athena, an AI-powered malware analysis platform being modernized to become "the everything program" for malware analysts and reverse engineers.

PROJECT LOCATION: /Users/kali/Athena/Athena
BRANCH: tauri-migration
STATUS: 95% complete migration, 25 tasks remaining

═══════════════════════════════════════════════════════════════════

FIRST TIME STARTING? Read these 3 files in order:

1. /Users/kali/Athena/Athena/agentdocs/CLAUDE.md
   (Quick reference - memorize project structure, paths, critical TODOs)

2. /Users/kali/Athena/Athena/agentdocs/SESSION_CONTINUATION.md
   (Learn how to save/restore context across windows)

3. /Users/kali/Athena/Athena/agentdocs/tasks/README.md
   (Understand task priorities and recommended order)

Then proceed to STARTING WORK below.

═══════════════════════════════════════════════════════════════════

CONTINUING FROM PREVIOUS SESSION? Check progress first:

1. List existing checkpoints:
   ls -lt /Users/kali/Athena/Athena/agentdocs/checkpoints/

2. Read the most recent checkpoint to see what's done

3. Check git status to see any uncommitted work:
   cd /Users/kali/Athena/Athena && git status && git log --oneline -5

4. Continue with the next incomplete task

═══════════════════════════════════════════════════════════════════

STARTING WORK:

Begin with TASK-01 (Tauri Upgrade - 1-2 day quick win)

Read: /Users/kali/Athena/Athena/agentdocs/tasks/TASK-01-TAURI-UPGRADE.md

This file contains:
- Step-by-step implementation instructions
- Code examples and configuration changes
- Testing/validation procedures
- Rollback plan if something fails
- Completion checkpoint template

WORKFLOW:
1. Create todos using TodoWrite tool (track your progress through task steps)
2. Execute each step methodically
3. Test after each major change
4. Git commit logical changes with descriptive messages
5. When complete, create checkpoint using template in task file
6. Save critical context with #memory command before running out

═══════════════════════════════════════════════════════════════════

CONTEXT MANAGEMENT (CRITICAL):

Monitor your context usage constantly:
- Auto-compact happens at 80%
- Use /compact at 70% to control what stays
- Use #memory to save critical information:
  #current_task TASK-01: Tauri Upgrade
  #last_step Step 5: Updated package.json dependencies
  #next_step Step 6: Test build process
  #blockers None currently
  #files_modified athena-v2/package.json, athena-v2/src-tauri/Cargo.toml

When approaching context limit:
1. Create a checkpoint IMMEDIATELY
2. Commit current work to git
3. Use #memory to save state
4. Stop and tell human to continue in new window

═══════════════════════════════════════════════════════════════════

QUALITY STANDARDS:

Before marking any task complete:
✓ All tests pass (npm test && cargo test)
✓ Build succeeds (npm run build)
✓ No compiler warnings
✓ Code follows patterns in agentdocs/guides/CODING_PATTERNS.md
✓ Changes committed to git with clear messages
✓ Checkpoint created in agentdocs/checkpoints/
✓ All validation checklist items checked

═══════════════════════════════════════════════════════════════════

WHEN TO ASK FOR HELP:

ASK immediately if:
- Blocked for >30 minutes
- Tests failing and can't figure out why
- Breaking changes not documented in task file
- Security concerns
- Architecture decisions needed

DON'T GUESS - this is production security software.

═══════════════════════════════════════════════════════════════════

TASK SEQUENCE (DO IN ORDER):

Week 1-2 Quick Wins:
→ TASK-01: Tauri Upgrade (START HERE)
→ TASK-06: TypeScript Upgrade
→ TASK-07: SolidJS Upgrade

Month 1 Critical Path:
→ TASK-02: WASM Execution (TypedFunc pattern)
→ TASK-03: Signature Verification
→ TASK-04: Wasmtime Upgrade
→ TASK-05: Vite Upgrade

Month 2+ Features:
→ TASK-08 through TASK-25 (see agentdocs/tasks/COMPLETE-TASK-OVERVIEW.md)

═══════════════════════════════════════════════════════════════════

IMPORTANT REMINDERS:

• Use "think harder" mode for complex decisions
• This is a LONG project - manage context aggressively
• Create checkpoints BEFORE running out of context
• Git commit frequently with descriptive messages
• Use TodoWrite to track progress through task steps
• Test continuously, not just at the end
• Read the task file completely before starting
• Follow the rollback plan if something breaks

═══════════════════════════════════════════════════════════════════

NOW BEGIN:

IF FIRST TIME: Read CLAUDE.md, SESSION_CONTINUATION.md, then tasks/TASK-01-TAURI-UPGRADE.md

IF CONTINUING: Check latest checkpoint, then continue with next task

Use TodoWrite immediately to create your task list, then start executing step-by-step.

Remember: Quality over speed. This is production malware analysis software.
```

---

## That's it. Use the prompt above for EVERY session.

**How it works:**
1. First agent reads the 3 setup files, starts TASK-01
2. Agent creates checkpoint before context runs out
3. Next agent uses same prompt, sees checkpoint, continues where left off
4. Repeat until all 25 tasks complete

**Context continuity is maintained via:**
- Checkpoints in agentdocs/checkpoints/
- Git commits with clear messages
- #memory commands for critical state
- SESSION_CONTINUATION.md protocol

**No need for different prompts - this ONE prompt handles everything.**
