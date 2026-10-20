# Formation State Machine

## Plan
DRAFT → READY → IN_PROGRESS → COMPLETED
                    ↘ BLOCKED ↗
Non-terminal states may be cancelled.

## Stage
PENDING → READY → IN_PROGRESS → COMPLETED
                    ↘ BLOCKED ↗

SKIPPED requires an explicit authorized action.

## Task
PENDING → READY → IN_PROGRESS → IN_REVIEW → COMPLETED
                    ↘ BLOCKED ↗
WAIVED requires explicit authorization.

## Dependency rule
A task cannot become READY until every required dependency is COMPLETED or WAIVED.

## Evidence rule
A task with required evidence cannot become COMPLETED until all required evidence requirements are satisfied.

## Review rule
A task requiring professional review cannot become COMPLETED until an approved/reviewed outcome is recorded.

## Exception rule
Blocked tasks must expose a human-readable blocking reason. Do not silently bypass blockers.
