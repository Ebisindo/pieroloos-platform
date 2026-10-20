# Session 17 — Professional responsibility and collaboration

Session 17 connects recorded compliance obligations to accountable workspace team members and makes responsibility changes auditable.

## Delivered

- Added a workspace-scoped obligation assignment endpoint using the existing `ownerUserId` field.
- Validates assignees against membership in the active organization; arbitrary user IDs cannot be assigned.
- Supports explicit unassignment and records the previous and new owner in `ComplianceActivity`.
- Shows the active organization's members in the Compliance workflow for authorized managers.

This workflow tracks organizational responsibility. It does not establish that an assignee is licensed or qualified; organizations must make and verify that determination outside this system.
