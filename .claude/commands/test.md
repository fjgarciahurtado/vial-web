---
description: Run the project's test suite and summarize results
---

Detect the project's test runner (npm/yarn/pnpm test, pytest, go test, dotnet
test, etc.) and run the smallest relevant test scope for recent changes. If
tests fail, summarize the failures with file:line references. Do not modify
source code unless asked — reporting results is the goal of this command.
