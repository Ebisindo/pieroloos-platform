# Session 07 API Contract

POST `/api/formation/decisions`
Create an explicit working-jurisdiction decision.

POST `/api/formation/plans`
Generate a formation plan from the explicit decision.

GET `/api/formation/plans/:id`
Return plan, stages, tasks, evidence and reviews.

PATCH `/api/formation/tasks/:id`
Accept domain actions:
- START
- COMPLETE
- WAIVE
- BLOCK
- REVIEW_APPROVE

The API must reject arbitrary direct status mutation. Domain transition rules must be authoritative.
