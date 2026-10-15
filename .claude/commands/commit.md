---
description: Stage relevant changes and create a well-formatted commit
argument-hint: [optional scope or message hint]
allowed-tools: Bash(git add *), Bash(git commit *), Bash(git status *), Bash(git diff *), Bash(git log *)
---

## Current state

!`git status --short`

!`git diff HEAD`

## Instructions

The working tree state is inlined above — do not re-run `git status` or
`git diff` to discover it.

Group the changes logically, stage them, and create a commit following the
`git-workflow` skill's conventions (imperative mood, subject under ~72 chars,
body when the change is non-trivial). If $ARGUMENTS is provided, use it as a
hint for the commit scope or message.

If the changes are clearly unrelated to each other, make separate commits
rather than one mixed commit. Do not push. Show `git log -1` when done.
