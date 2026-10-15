---
name: git-workflow
description: Standard git branching, commit message, and pull request conventions for this project. Use whenever creating a branch, committing code, or preparing a pull request.
---

# Git Workflow

These conventions apply to the **application repositories** this Claude setup
is used in. This configuration repo itself has no CI and is committed directly
to `main` — see `CLAUDE.md`.

## Branching
- Branch from the default branch (`main`).
- Name branches `type/short-description`, e.g. `feature/add-login`,
  `fix/null-pointer-parser`, `chore/update-deps`.

## Commits
- Write commits in imperative mood: "Add X", "Fix Y", not "Added"/"Fixes".
- Keep the first line under ~72 characters; add a body for context if the
  change is non-trivial.
- Make small, logically-scoped commits rather than one giant commit.
- Never commit secrets, `.env` files, or credentials.

## Pull Requests
- Never push directly to `main`/`develop`; always go through a PR.
- PR description should explain *what* changed and *why*, and list how it was
  verified (tests run, manual checks).
- Link related issues/work items when applicable.
- Run the `pr-review` skill, and delegate line-level analysis to the
  `code-reviewer` subagent, before opening the PR.

## Commands reference
```
git checkout -b feature/my-change
git add -p
git commit -m "Add my change"
git push -u origin feature/my-change
```
