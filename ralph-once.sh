#!/bin/bash

claude --permission-mode acceptEdits "@risk_legacy_spec.md @progress.txt \
1. Read the spec and progress file. \
2. Find the next incomplete task from Section 20 (Implementation Order). \
3. Implement it following the spec exactly. \
4. Run any relevant tests if they exist. \
5. Commit your changes with a descriptive message. \
6. Update progress.txt with what you completed. \
ONLY DO ONE TASK AT A TIME. \
Start with Phase 1 tasks if progress.txt is empty."
