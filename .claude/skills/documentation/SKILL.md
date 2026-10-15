---
name: documentation
description: Conventions for writing and updating README files, code comments, and inline docs. Use when asked to document a feature, update a README, or add docstrings/comments.
---

# Documentation

## Principles
- Document *why*, not just *what* — code already shows what it does.
- Keep README/top-level docs in sync with actual behavior; update them in
  the same change that alters behavior they describe.
- Comment only non-obvious code (tricky algorithms, workarounds, business
  rules); avoid comments that restate the code.
- Prefer examples over long prose for API/usage docs.

## README structure (for new modules/services)
1. What it is / what problem it solves (1–2 sentences)
2. How to install/run it
3. Key usage examples
4. Configuration options
5. Links to further docs, if any
