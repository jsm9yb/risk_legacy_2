#!/bin/bash
set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

for ((i=1; i<=$1; i++)); do
  echo ""
  echo "============================================"
  echo "=== RALPH ITERATION $i of $1 ==="
  echo "============================================"
  echo ""

  result=$(claude --dangerously-skip-permissions -p "@risk_legacy_spec.md @progress.txt \
1. Read the spec (Section 20: Implementation Order) and progress.txt. \
2. Find the next incomplete task. \
3. Implement it following the spec exactly. \
4. Run tests if they exist. \
5. Commit your changes. \
6. Update progress.txt with what you completed. \
ONLY WORK ON A SINGLE TASK. \
If all tasks in Section 20 are complete, output <promise>COMPLETE</promise>.")

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "============================================"
    echo "=== PRD COMPLETE after $i iterations ==="
    echo "============================================"
    exit 0
  fi
done

echo ""
echo "============================================"
echo "=== Completed $1 iterations ==="
echo "============================================"
