---
name: pr-review
description: Prepares a change for pull request - verifies the diff is complete, self-consistent, and ready to submit. Use before opening a PR. For line-level bug hunting, delegate to the code-reviewer subagent instead.
---

# PR Review

## Current changes

!`git status --short`

!`git diff HEAD`

## Instructions

The diff above is already inlined — do not re-run `git diff` unless you need
more context than is shown.

Work through this pre-submission checklist:

1. **Completeness** — does the diff contain everything the change needs
   (code, tests, docs, config), and nothing unrelated?
2. **Self-consistency** — are renamed symbols updated everywhere? Any leftover
   debug output, commented-out code, or TODOs that should be resolved?
3. **Secrets** — no credentials, tokens, or `.env` content in the diff.
4. **Docs** — is any documentation the change invalidates updated in the same
   diff?
5. **Depth** — for line-level correctness and security analysis, delegate to
   the `code-reviewer` subagent rather than duplicating that work here; it
   runs in its own context and returns only the findings.

Then produce the PR description: what changed, why, and how it was verified.
Follow the `git-workflow` skill for branch/PR conventions.
