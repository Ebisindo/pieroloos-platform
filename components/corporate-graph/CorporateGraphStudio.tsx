"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { CorporateGraphRelationType } from "@prisma/client";
import Link from "next/link";
import {
  layoutCorporateGraph,
  validateGraphEdge,
} from "@/lib/domain/corporate-graph";

type NodeRecord = {
  id: string;
  name: string;
  nodeType: string;
  jurisdictionCode: string | null;
  entityType: string | null;
  clientId: string | null;
  createdAt: string;
};

type EdgeRecord = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: CorporateGraphRelationType;
  ownershipPercent: string | null;
  fromNode: { name: string };
  toNode: { name: string };
};

type GraphData = { nodes: NodeRecord[]; edges: EdgeRecord[] };
type ApiErrorPayload = { error?: string };
type GraphAuditEvent = {
  id: string;
  action: string;
  subjectType: string;
  subjectId: string;
  details: Record<string, unknown> | null;
  occurredAt: string;
  actor: { name: string | null };
};
type ArchiveRequest = { type: "node" | "edge"; id: string; label: string };

const nodeTypes = [
  "COMPANY",
  "PERSON",
  "TRUST",
  "PARTNERSHIP",
  "BRANCH",
  "BANKING_RELATIONSHIP",
  "LICENSE",
  "TAX_REGISTRATION",
  "OTHER",
] as const;

const relations: CorporateGraphRelationType[] = [
  "OWNS",
  "CONTROLS",
  "SUBSIDIARY_OF",
  "BRANCH_OF",
  "BANKS_WITH",
  "LICENSED_BY",
  "TAX_REGISTERED_WITH",
  "RELATED_TO",
];

function displayLabel(value: string): string {
  return value.replaceAll("_", " ");
}

export default function CorporateGraphStudio() {
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] });
  const [name, setName] = useState("");
  const [nodeType, setNodeType] = useState<(typeof nodeTypes)[number]>("COMPANY");
  const [jurisdictionCode, setJurisdictionCode] = useState("");
  const [entityType, setEntityType] = useState("COMPANY");
  const [fromNodeId, setFromNodeId] = useState("");
  const [toNodeId, setToNodeId] = useState("");
  const [relation, setRelation] = useState<CorporateGraphRelationType>("OWNS");
  const [ownershipPercent, setOwnershipPercent] = useState("");
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [pendingArchive, setPendingArchive] = useState<ArchiveRequest | null>(null);
  const [auditEvents, setAuditEvents] = useState<GraphAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refreshGraph = useCallback(async (showLoading = true, signal?: AbortSignal) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch("/api/corporate-graph", {
        cache: "no-store",
        signal,
      });
      const payload = (await response.json()) as GraphData & ApiErrorPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load the corporate graph.");
      }
      if (signal?.aborted) return;
      setGraph({
        nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
        edges: Array.isArray(payload.edges) ? payload.edges : [],
      });
      setError("");
    } catch (cause: unknown) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Unable to load the corporate graph.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch("/api/corporate-graph", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as GraphData & ApiErrorPayload;
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load the corporate graph.");
        }
        if (mounted) {
          setGraph({
            nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
            edges: Array.isArray(payload.edges) ? payload.edges : [],
          });
          setError("");
        }
      })
      .catch((cause: unknown) => {
        if (mounted) {
          setError(cause instanceof Error ? cause.message : "Unable to load the corporate graph.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const refreshAudit = useCallback(async () => {
    try {
      const response = await fetch("/api/corporate-graph/audit", { cache: "no-store" });
      const payload = (await response.json()) as { events?: GraphAuditEvent[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to load graph activity.");
      setAuditEvents(Array.isArray(payload.events) ? payload.events : []);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to load graph activity.");
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch("/api/corporate-graph/audit", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { events?: GraphAuditEvent[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to load graph activity.");
        if (mounted) setAuditEvents(Array.isArray(payload.events) ? payload.events : []);
      })
      .catch((cause: unknown) => {
        if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load graph activity.");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const layout = useMemo(
    () => layoutCorporateGraph(graph.nodes.map((node) => ({ id: node.id }))),
    [graph.nodes],
  );
  const pointById = useMemo(
    () => new Map(layout.points.map((point) => [point.id, point])),
    [layout.points],
  );

  async function createNode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const editing = editingNodeId !== null;
    try {
      const response = await fetch(
        editing ? `/api/corporate-graph/nodes/${editingNodeId}` : "/api/corporate-graph/nodes",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            nodeType,
            jurisdictionCode: jurisdictionCode || undefined,
            entityType: entityType || undefined,
          }),
        },
      );
      const payload = (await response.json()) as ApiErrorPayload;
      if (!response.ok) throw new Error(payload.error ?? (editing ? "Unable to update entity." : "Unable to create entity."));
      setName("");
      setJurisdictionCode("");
      setEntityType("COMPANY");
      setEditingNodeId(null);
      setMessage(editing ? "Entity updated." : "Entity added to the workspace graph.");
      await refreshGraph(false);
      await refreshAudit();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to save entity.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmArchive() {
    if (!pendingArchive) return;
    setBusy(true);
    setError("");
    setMessage("");
    const item = pendingArchive;
    try {
      const response = await fetch(
        item.type === "node"
          ? `/api/corporate-graph/nodes/${item.id}`
          : `/api/corporate-graph/edges/${item.id}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as ApiErrorPayload;
      if (!response.ok) throw new Error(payload.error ?? "Unable to archive graph record.");
      if (item.type === "node" && editingNodeId === item.id) {
        setEditingNodeId(null);
        setName("");
        setJurisdictionCode("");
        setEntityType("COMPANY");
      }
      setPendingArchive(null);
      setMessage(item.type === "node" ? "Entity and connected relationships archived." : "Relationship archived.");
      await refreshGraph(false);
      await refreshAudit();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to archive graph record.");
    } finally {
      setBusy(false);
    }
  }

  async function createEdge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const parsedOwnership = ownershipPercent === "" ? undefined : Number(ownershipPercent);
      const validationError = validateGraphEdge({
        fromNodeId,
        toNodeId,
        relation,
        ownershipPercent: parsedOwnership,
      });
      if (validationError) throw new Error(validationError);

      const response = await fetch("/api/corporate-graph/edges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromNodeId,
          toNodeId,
          relation,
          ownershipPercent: parsedOwnership,
        }),
      });
      const payload = (await response.json()) as ApiErrorPayload;
      if (!response.ok) throw new Error(payload.error ?? "Unable to create relationship.");
      setOwnershipPercent("");
      setMessage("Relationship added to the workspace graph.");
      await refreshGraph(false);
      await refreshAudit();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Unable to create relationship.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-stack">
      <header className="page-header">
        <div>
          <div className="eyebrow">PBOF · PIEROLOOS V2</div>
          <h1>Corporate Graph Studio</h1>
          <p>
            Map entities and relationships within the active workspace. Structures remain
            drafts until reviewed by appropriate professionals.
          </p>
        </div>
        <Link href="/command-center" className="button button-secondary">
          Command Centre
        </Link>
      </header>

      <div className="metric-grid">
        <section className="glass-panel metric-card metric-gold">
          <div className="metric-label">Graph entities</div>
          <div className="metric-value">{graph.nodes.length}</div>
          <div className="metric-detail">Workspace-scoped nodes</div>
        </section>
        <section className="glass-panel metric-card metric-violet">
          <div className="metric-label">Relationships</div>
          <div className="metric-value">{graph.edges.length}</div>
          <div className="metric-detail">Ownership, control and other links</div>
        </section>
        <section className="glass-panel metric-card metric-cyan">
          <div className="metric-label">Governance status</div>
          <div className="metric-value">Draft</div>
          <div className="metric-detail">Human review required</div>
        </section>
      </div>

      {loading ? <p role="status" aria-live="polite">Loading corporate graph…</p> : null}
      {error ? (
        <div className="graph-error" role="alert">
          <p>{error}</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void refreshGraph()}
            disabled={loading || busy}
          >
            Retry loading
          </button>
        </div>
      ) : null}
      {message ? <p className="graph-success" role="status" aria-live="polite">{message}</p> : null}
      {pendingArchive ? (
        <section className="graph-error" aria-label="Confirm archive">
          <p>Archive {pendingArchive.type === "node" ? "entity" : "relationship"} “{pendingArchive.label}”? This preserves its audit history but removes it from the active graph.</p>
          <div className="graph-form-actions">
            <button className="button button-primary" type="button" disabled={busy} onClick={() => void confirmArchive()}>
              Confirm archive
            </button>
            <button className="button button-secondary" type="button" disabled={busy} onClick={() => setPendingArchive(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <div className="graph-grid">
        <section className="glass-panel">
          <div className="section-header">
            <div>
              <h2>{editingNodeId ? "Edit entity" : "Add an entity"}</h2>
              <p>Create a company, person or related corporate object.</p>
            </div>
          </div>
          <form className="graph-form" onSubmit={createNode}>
            <label>
              Display name
              <input
                required
                minLength={2}
                maxLength={160}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Node type
              <select
                value={nodeType}
                onChange={(event) => {
                  const nextType = nodeTypes.find((value) => value === event.target.value);
                  if (nextType) setNodeType(nextType);
                }}
              >
                {nodeTypes.map((value) => (
                  <option key={value} value={value}>{displayLabel(value)}</option>
                ))}
              </select>
            </label>
            <label>
              Jurisdiction code
              <input
                maxLength={8}
                placeholder="e.g. NG, GB, AE"
                value={jurisdictionCode}
                onChange={(event) => setJurisdictionCode(event.target.value.toUpperCase())}
              />
            </label>
            <label>
              Entity type
              <input
                maxLength={80}
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
              />
            </label>
            <div className="graph-form-actions">
              <button className="button button-primary" disabled={busy || loading}>
                {editingNodeId ? "Save changes" : "Add entity"}
              </button>
              {editingNodeId ? (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setEditingNodeId(null);
                    setName("");
                    setJurisdictionCode("");
                    setEntityType("COMPANY");
                  }}
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </section>

        <section className="glass-panel">
          <div className="section-header">
            <div>
              <h2>Connect entities</h2>
              <p>Ownership links are validated separately from other relationships.</p>
            </div>
          </div>
          <form className="graph-form" onSubmit={createEdge}>
            <label>
              From entity
              <select required value={fromNodeId} onChange={(event) => setFromNodeId(event.target.value)}>
                <option value="">Choose entity</option>
                {graph.nodes.map((node) => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </label>
            <label>
              Relationship
              <select
                value={relation}
                onChange={(event) => {
                  const nextRelation = relations.find((value) => value === event.target.value);
                  if (!nextRelation) return;
                  setRelation(nextRelation);
                  if (nextRelation !== "OWNS") setOwnershipPercent("");
                }}
              >
                {relations.map((value) => (
                  <option key={value} value={value}>{displayLabel(value)}</option>
                ))}
              </select>
            </label>
            <label>
              To entity
              <select required value={toNodeId} onChange={(event) => setToNodeId(event.target.value)}>
                <option value="">Choose entity</option>
                {graph.nodes.map((node) => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </label>
            {relation === "OWNS" ? (
              <label>
                Ownership percentage (optional)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={ownershipPercent}
                  onChange={(event) => setOwnershipPercent(event.target.value)}
                />
              </label>
            ) : null}
            <button className="button button-primary" disabled={busy || loading || graph.nodes.length < 2}>
              Add relationship
            </button>
          </form>
        </section>
      </div>

      <section className="glass-panel">
        <div className="section-header">
          <div>
            <h2>Visual corporate structure</h2>
            <p>Spatial overview of stored entities and their relationships.</p>
          </div>
        </div>
        {graph.nodes.length === 0 && !loading ? (
          <p className="graph-empty">No entities yet. Add your first entity above.</p>
        ) : null}
        {graph.nodes.length > 0 ? (
          <div style={{ overflowX: "auto", maxWidth: "100%" }}>
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              style={{ display: "block", width: "100%", minWidth: "760px", height: layout.height }}
            >
              <defs>
                <marker id="corporate-graph-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L6,3 z" fill="#a99ad8" />
                </marker>
              </defs>
              <g stroke="#8f83c4" strokeWidth="2" fill="none" markerEnd="url(#corporate-graph-arrow)">
                {graph.edges.map((edge) => {
                  const from = pointById.get(edge.fromNodeId);
                  const to = pointById.get(edge.toNodeId);
                  if (!from || !to) return null;
                  return (
                    <line
                      key={edge.id}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                    />
                  );
                })}
              </g>
              <g fill="#e3d8c4" fontSize="12" textAnchor="middle">
                {graph.edges.map((edge) => {
                  const from = pointById.get(edge.fromNodeId);
                  const to = pointById.get(edge.toNodeId);
                  if (!from || !to) return null;
                  return (
                    <text key={edge.id} x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 8}>
                      {displayLabel(edge.relation)}
                    </text>
                  );
                })}
              </g>
              {graph.nodes.map((node) => {
                const point = pointById.get(node.id);
                if (!point) return null;
                const nodeLabel = node.name.length > 22 ? `${node.name.slice(0, 19)}…` : node.name;
                return (
                  <g key={node.id}>
                    <title>{node.name}</title>
                    <rect
                      x={point.x - 82}
                      y={point.y - 34}
                      width="164"
                      height="68"
                      rx="12"
                      fill="#121f38"
                      stroke="#c7a96a"
                      strokeWidth="1.5"
                    />
                    <text x={point.x} y={point.y - 3} textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="600">
                      {nodeLabel}
                    </text>
                    <text x={point.x} y={point.y + 17} textAnchor="middle" fill="#d6deeb" fontSize="10">
                      {node.jurisdictionCode ?? "Jurisdiction pending"}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : null}
        <p className="graph-disclaimer">
          The visual map is a spatial overview. Use the relationship inventory below for
          complete, screen-reader-friendly relationship details.
        </p>
      </section>

      <section className="glass-panel">
        <div className="section-header">
          <div>
            <h2>Accessible entity inventory</h2>
            <p>Entity facts and full relationship details are available without relying on the graphic.</p>
          </div>
        </div>
        {graph.nodes.length === 0 && !loading ? (
          <p className="graph-empty">The inventory will appear here when entities are added.</p>
        ) : null}
        {graph.nodes.length > 0 ? (
          <div className="graph-node-list" aria-label="Corporate entities">
            {graph.nodes.map((node) => (
              <article className="graph-node" key={node.id}>
                <div>
                  <strong>{node.name}</strong>
                  <p>
                    {displayLabel(node.nodeType)}
                    {node.entityType ? ` · ${node.entityType}` : ""}
                  </p>
                  <div className="graph-form-actions">
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={busy || loading}
                      onClick={() => {
                        const nextNodeType = nodeTypes.find((value) => value === node.nodeType) ?? "OTHER";
                        setEditingNodeId(node.id);
                        setName(node.name);
                        setNodeType(nextNodeType);
                        setJurisdictionCode(node.jurisdictionCode ?? "");
                        setEntityType(node.entityType ?? "");
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={busy || loading}
                      onClick={() => setPendingArchive({ type: "node", id: node.id, label: node.name })}
                    >
                      Archive
                    </button>
                  </div>
                </div>
                <span className="graph-tag">{node.jurisdictionCode ?? "Jurisdiction pending"}</span>
              </article>
            ))}
          </div>
        ) : null}
        {graph.edges.length > 0 ? (
          <div className="graph-edge-list">
            <h3>Relationships</h3>
            <ul aria-label="Corporate relationships">
              {graph.edges.map((edge) => (
                <li key={edge.id}>
                  <strong>{edge.fromNode.name}</strong>
                  {" — "}
                  <span>{displayLabel(edge.relation)}</span>
                  {" → "}
                  <strong>{edge.toNode.name}</strong>
                  {edge.ownershipPercent !== null ? ` (${edge.ownershipPercent}%)` : ""}
                  {" "}
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={busy || loading}
                    onClick={() => setPendingArchive({
                      type: "edge",
                      id: edge.id,
                      label: `${edge.fromNode.name} ${displayLabel(edge.relation)} ${edge.toNode.name}`,
                    })}
                  >
                    Archive relationship
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
      <section className="glass-panel">
        <div className="section-header">
          <div>
            <h2>Recent graph activity</h2>
            <p>Workspace-scoped audit events for graph changes.</p>
          </div>
          <button className="button button-secondary" type="button" disabled={busy} onClick={() => void refreshAudit()}>
            Refresh activity
          </button>
        </div>
        {auditEvents.length === 0 ? (
          <p className="graph-empty">No graph audit events are recorded yet.</p>
        ) : (
          <ul className="graph-audit-list">
            {auditEvents.map((event) => (
              <li key={event.id}>
                <strong>{displayLabel(event.action)}</strong>
                {" · "}
                {event.actor.name ?? "Workspace user"}
                {" · "}
                {displayLabel(event.subjectType)}
                {" · "}
                <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="graph-disclaimer">
        PieroloOS is decision-support software. It does not determine legal validity, tax
        treatment, banking eligibility or regulatory compliance. Confirm proposed structures
        with appropriately qualified professionals.
      </p>
    </main>
  );
}
