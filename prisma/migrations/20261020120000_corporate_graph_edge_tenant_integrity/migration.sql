-- Enforce that both endpoints of a corporate-graph edge belong to the same organization/workspace.
-- Fail closed on historical mismatches; never silently rewrite tenant ownership.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "CorporateGraphEdge" e
    JOIN "CorporateGraphNode" n ON n."id" = e."fromNodeId"
    WHERE n."organizationId" <> e."organizationId" OR n."workspaceId" <> e."workspaceId"
  ) THEN
    RAISE EXCEPTION 'CorporateGraphEdge contains fromNode tenant mismatches; reconcile rows before applying tenant-integrity migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "CorporateGraphEdge" e
    JOIN "CorporateGraphNode" n ON n."id" = e."toNodeId"
    WHERE n."organizationId" <> e."organizationId" OR n."workspaceId" <> e."workspaceId"
  ) THEN
    RAISE EXCEPTION 'CorporateGraphEdge contains toNode tenant mismatches; reconcile rows before applying tenant-integrity migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "CorporateGraphNode_id_organizationId_workspaceId_key"
  ON "CorporateGraphNode" ("id", "organizationId", "workspaceId");

ALTER TABLE "CorporateGraphEdge"
  DROP CONSTRAINT IF EXISTS "CorporateGraphEdge_fromNodeId_fkey",
  DROP CONSTRAINT IF EXISTS "CorporateGraphEdge_toNodeId_fkey";

ALTER TABLE "CorporateGraphEdge"
  ADD CONSTRAINT "CorporateGraphEdge_fromNodeId_organizationId_workspaceId_fkey"
    FOREIGN KEY ("fromNodeId", "organizationId", "workspaceId")
    REFERENCES "CorporateGraphNode" ("id", "organizationId", "workspaceId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CorporateGraphEdge_toNodeId_organizationId_workspaceId_fkey"
    FOREIGN KEY ("toNodeId", "organizationId", "workspaceId")
    REFERENCES "CorporateGraphNode" ("id", "organizationId", "workspaceId")
    ON DELETE CASCADE ON UPDATE CASCADE;
