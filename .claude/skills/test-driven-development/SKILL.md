---
name: test-driven-development
description: Red-green-refactor workflow for building features or fixing bugs test-first. Use when the user wants TDD, or when adding new behavior where a failing test should be written before the implementation.
---

# Test-Driven Development

## Loop
1. **Red** — Write the smallest failing test that describes the next bit of
   desired behavior. Run it and confirm it fails for the expected reason.
2. **Green** — Write the minimal code needed to make the test pass. Resist
   the urge to build more than what the test requires.
3. **Refactor** — With tests passing, clean up duplication and improve
   naming/structure without changing behavior. Re-run tests after each
   refactor step.
4. Repeat for the next increment of behavior.

## Guidelines
- Prefer testing behavior/contracts over implementation details.
- Keep tests fast and deterministic; avoid real network/filesystem calls
  unless that is exactly what's being tested (use fakes/mocks otherwise).
- One logical assertion focus per test; use clear, descriptive test names.
- When fixing a bug, first write a test that reproduces it (red), then fix.
